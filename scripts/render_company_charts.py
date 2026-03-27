from __future__ import annotations

import argparse
from copy import deepcopy
import hashlib
import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any
import urllib.request

from build_dataset import (
    COMPANY_CACHE_DIR,
    DATA_DIR,
    TOP30_COMPANIES,
    apply_fused_extraction,
    apply_manual_company_override,
    apply_usd_display_fields,
    build_company_payload_with_universal_parser,
    finalize_company_payload,
    load_cached_company_payload,
    load_fx_cache,
    load_manual_company_overrides,
    load_manual_presets,
    sanitize_implausible_q4_revenue_aligned_statements,
    save_fx_cache,
    supplement_tencent_official_financials,
)


ROOT_DIR = Path(__file__).resolve().parents[1]
DATASET_PATH = DATA_DIR / "earnings-dataset.json"
NODE_RENDERER_PATH = ROOT_DIR / "scripts" / "direct_chart_render.cjs"
DEFAULT_OUTPUT_DIR = ROOT_DIR / "output" / "direct-renders"
SEC_TICKER_CACHE_PATH = DATA_DIR / "cache" / "official-segments" / "sec-company-tickers.json"
RAW_CACHE_DIRS = [
    DATA_DIR / "cache" / "official-financials",
    DATA_DIR / "cache" / "stockanalysis-financials",
    DATA_DIR / "cache" / "generic-ir-pdf",
    DATA_DIR / "cache" / "generic-filing-tables",
]
SEC_HEADERS = {
    "User-Agent": "Codex/earnings-image-studio direct-render yuwan@example.com",
    "Accept": "application/json,text/plain,*/*",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Render a single company's earnings charts without launching the browser UI.")
    parser.add_argument("--company", required=True, help="Company name, ticker, id, or slug.")
    parser.add_argument("--quarter", default="latest", help="Quarter key such as 2025Q4, or latest.")
    parser.add_argument("--language", default="zh", choices=["zh", "en"], help="Render language.")
    parser.add_argument("--modes", default="sankey,bars", help="Comma-separated chart modes: sankey,bars")
    parser.add_argument("--refresh", action="store_true", help="Refresh remote sources instead of using cached payloads when possible.")
    parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR), help="Directory for final SVG and PNG outputs.")
    parser.add_argument("--basename", default="", help="Optional basename prefix for exported files.")
    parser.add_argument("--png-size", type=int, default=3200, help="Rasterization size for SVG to PNG conversion.")
    return parser.parse_args()


def normalize_key(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", "", str(value or "").strip().lower())


def normalize_ticker(value: Any) -> str:
    return re.sub(r"[^A-Z0-9]+", "", str(value or "").strip().upper())


def slugify(value: Any) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", str(value or "").strip().lower()).strip("-")
    return slug or "company"


def quarter_sort_value(period: str) -> int:
    match = re.fullmatch(r"(\d{4})Q([1-4])", str(period or ""))
    if not match:
        return 0
    return int(match.group(1)) * 4 + int(match.group(2))


def available_quarters(payload: dict[str, Any]) -> list[str]:
    quarter_values = payload.get("quarters") if isinstance(payload.get("quarters"), list) else list((payload.get("financials") or {}).keys())
    values = [str(item) for item in quarter_values if re.fullmatch(r"\d{4}Q[1-4]", str(item or ""))]
    return sorted(set(values), key=quarter_sort_value)


def choose_quarter(payload: dict[str, Any], requested: str) -> str:
    quarters = available_quarters(payload)
    if not quarters:
        raise RuntimeError(f"{payload.get('ticker') or payload.get('id') or 'company'} has no usable quarters.")
    if str(requested or "").strip().lower() == "latest":
        return quarters[-1]
    normalized = str(requested).strip().upper()
    if normalized not in quarters:
        raise RuntimeError(f"Quarter {normalized} is unavailable. Available quarters: {', '.join(quarters)}")
    return normalized


def load_dataset_companies() -> list[dict[str, Any]]:
    if not DATASET_PATH.exists():
        return []
    try:
        payload = json.loads(DATASET_PATH.read_text(encoding="utf-8"))
    except Exception:
        return []
    companies = payload.get("companies")
    return [item for item in companies if isinstance(item, dict)] if isinstance(companies, list) else []


def company_aliases(company: dict[str, Any]) -> set[str]:
    aliases = {
        normalize_key(company.get("id")),
        normalize_key(company.get("ticker")),
        normalize_key(company.get("slug")),
        normalize_key(company.get("nameEn")),
        normalize_key(company.get("nameZh")),
        normalize_ticker(company.get("ticker")).lower(),
    }
    return {alias for alias in aliases if alias}


def resolve_from_dataset(query: str) -> dict[str, Any] | None:
    normalized_query = normalize_key(query)
    if not normalized_query:
        return None
    partial_match: dict[str, Any] | None = None
    for company in load_dataset_companies():
        aliases = company_aliases(company)
        if normalized_query in aliases:
            return deepcopy(company)
        if not partial_match and any(normalized_query in alias or alias in normalized_query for alias in aliases):
            partial_match = company
    return deepcopy(partial_match) if partial_match else None


def prettify_company_title(title: str, ticker: str) -> str:
    cleaned = re.sub(r"\s+", " ", str(title or "").strip())
    if not cleaned:
        return str(ticker or "").upper()
    if cleaned.isupper() and len(cleaned.split()) > 1:
        lowered = cleaned.title()
        lowered = re.sub(r"\bIbm\b", "IBM", lowered)
        lowered = re.sub(r"\bAt&T\b", "AT&T", lowered)
        lowered = re.sub(r"\bUs\b", "US", lowered)
        return lowered
    return cleaned


def brand_for_identifier(identifier: str) -> dict[str, str]:
    digest = hashlib.sha256(str(identifier or "company").encode("utf-8")).hexdigest()
    primary = f"#{digest[0:6]}".upper()
    secondary = f"#{digest[6:12]}".upper()
    accent = f"#{digest[12:18]}".upper()
    return {
        "primary": primary,
        "secondary": secondary,
        "accent": accent,
    }


def company_from_payload(payload: dict[str, Any]) -> dict[str, Any]:
    ticker = str(payload.get("ticker") or payload.get("id") or "COMP").upper()
    name_en = str(payload.get("nameEn") or ticker)
    identifier = slugify(payload.get("id") or payload.get("slug") or ticker)
    return {
        "id": str(payload.get("id") or identifier),
        "ticker": str(payload.get("ticker") or ticker),
        "nameZh": str(payload.get("nameZh") or name_en),
        "nameEn": name_en,
        "slug": str(payload.get("slug") or slugify(ticker)),
        "rank": float(payload.get("rank") or 999),
        "isAdr": bool(payload.get("isAdr")),
        "brand": deepcopy(payload.get("brand") or brand_for_identifier(identifier)),
        "financialSource": payload.get("financialSource"),
        "financialPath": payload.get("financialPath"),
        "reportingCurrency": payload.get("reportingCurrency"),
        "cik": payload.get("cik"),
    }


def resolve_from_cached_payloads(query: str) -> dict[str, Any] | None:
    normalized_query = normalize_key(query)
    if not normalized_query:
        return None
    cached_final = load_cached_company_payload(slugify(query))
    if cached_final:
        return company_from_payload(cached_final)
    for cache_dir in RAW_CACHE_DIRS:
        if not cache_dir.exists():
            continue
        exact_path = cache_dir / f"{slugify(query)}.json"
        if exact_path.exists():
            try:
                payload = json.loads(exact_path.read_text(encoding="utf-8"))
            except Exception:
                payload = None
            if isinstance(payload, dict):
                return company_from_payload(payload)
        for path in cache_dir.glob("*.json"):
            try:
                payload = json.loads(path.read_text(encoding="utf-8"))
            except Exception:
                continue
            if not isinstance(payload, dict):
                continue
            aliases = company_aliases(company_from_payload(payload))
            if normalized_query in aliases or any(normalized_query in alias or alias in normalized_query for alias in aliases):
                return company_from_payload(payload)
    return None


def load_sec_ticker_entries(refresh: bool) -> list[dict[str, Any]]:
    payload: Any = None
    if SEC_TICKER_CACHE_PATH.exists() and not refresh:
        try:
            payload = json.loads(SEC_TICKER_CACHE_PATH.read_text(encoding="utf-8"))
        except Exception:
            payload = None
    if payload is None:
        request = urllib.request.Request("https://www.sec.gov/files/company_tickers.json", headers=SEC_HEADERS)
        with urllib.request.urlopen(request, timeout=25) as response:
            payload = json.loads(response.read().decode("utf-8"))
        SEC_TICKER_CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
        SEC_TICKER_CACHE_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    if isinstance(payload, dict):
        values = payload.values()
    elif isinstance(payload, list):
        values = payload
    else:
        values = []
    return [item for item in values if isinstance(item, dict)]


def resolve_from_sec(query: str, refresh: bool) -> dict[str, Any] | None:
    normalized_query = normalize_key(query)
    normalized_ticker = normalize_ticker(query)
    if not normalized_query:
        return None
    entries = load_sec_ticker_entries(refresh=refresh)
    partial_match: dict[str, Any] | None = None
    for entry in entries:
        ticker = str(entry.get("ticker") or "").upper()
        title = str(entry.get("title") or "")
        ticker_key = normalize_ticker(ticker)
        title_key = normalize_key(title)
        if normalized_ticker and normalized_ticker == ticker_key:
            return {
                "id": slugify(ticker.lower()),
                "ticker": ticker,
                "nameZh": prettify_company_title(title, ticker),
                "nameEn": prettify_company_title(title, ticker),
                "slug": ticker.lower(),
                "rank": 999,
                "isAdr": False,
                "brand": brand_for_identifier(ticker),
                "cik": entry.get("cik_str"),
            }
        if normalized_query == title_key:
            return {
                "id": slugify(ticker.lower() or title.lower()),
                "ticker": ticker or normalize_ticker(query),
                "nameZh": prettify_company_title(title, ticker),
                "nameEn": prettify_company_title(title, ticker),
                "slug": (ticker or slugify(title)).lower(),
                "rank": 999,
                "isAdr": False,
                "brand": brand_for_identifier(ticker or title),
                "cik": entry.get("cik_str"),
            }
        if partial_match is None and (normalized_query in title_key or title_key in normalized_query):
            partial_match = entry
    if partial_match is None:
        return None
    ticker = str(partial_match.get("ticker") or "").upper()
    title = str(partial_match.get("title") or "")
    return {
        "id": slugify(ticker.lower() or title.lower()),
        "ticker": ticker or normalize_ticker(query),
        "nameZh": prettify_company_title(title, ticker),
        "nameEn": prettify_company_title(title, ticker),
        "slug": (ticker or slugify(title)).lower(),
        "rank": 999,
        "isAdr": False,
        "brand": brand_for_identifier(ticker or title),
        "cik": partial_match.get("cik_str"),
    }


def resolve_company(query: str, refresh: bool) -> dict[str, Any]:
    for resolver in (resolve_from_dataset, resolve_from_cached_payloads):
        resolved = resolver(query)
        if resolved:
            return resolved
    resolved = resolve_from_sec(query, refresh=refresh)
    if resolved:
        return resolved
    raise RuntimeError(f"Unable to resolve company from input: {query}")


def build_company_payload(company: dict[str, Any], refresh: bool) -> dict[str, Any]:
    manual_presets = load_manual_presets()
    manual_overrides = load_manual_company_overrides()
    fx_cache = load_fx_cache()
    cached_payload = load_cached_company_payload(str(company["id"])) if not refresh else None
    if isinstance(cached_payload, dict):
        payload = deepcopy(cached_payload)
    else:
        payload = build_company_payload_with_universal_parser(company, refresh=refresh)
        payload = supplement_tencent_official_financials(payload)
        payload = sanitize_implausible_q4_revenue_aligned_statements(payload)
        payload = apply_manual_company_override(payload, company, manual_overrides)
        payload = apply_usd_display_fields(payload, fx_cache)
        payload = apply_fused_extraction(payload, company, refresh=refresh)
        save_fx_cache(fx_cache)
    payload = finalize_company_payload(company, payload, manual_presets.get(str(company["id"])) or {})
    COMPANY_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    (COMPANY_CACHE_DIR / f"{company['id']}.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return payload


def rasterize_svg_to_png(svg_path: Path, png_path: Path, size: int) -> None:
    qlmanage_path = shutil.which("qlmanage")
    if not qlmanage_path:
        raise RuntimeError("qlmanage is unavailable; cannot convert SVG to PNG.")
    png_path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="earnings-svg-raster-") as temp_dir:
        subprocess.run(
            [qlmanage_path, "-t", "-s", str(size), "-o", temp_dir, str(svg_path)],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        generated = Path(temp_dir) / f"{svg_path.name}.png"
        if not generated.exists():
            matches = list(Path(temp_dir).glob(f"{svg_path.name}*.png"))
            if not matches:
                raise RuntimeError(f"PNG conversion failed for {svg_path}")
            generated = matches[0]
        shutil.move(str(generated), str(png_path))


def parse_modes(raw: str) -> list[str]:
    modes = []
    for item in str(raw or "").split(","):
        normalized = str(item or "").strip().lower()
        if normalized in {"sankey", "bars"} and normalized not in modes:
            modes.append(normalized)
    return modes or ["sankey", "bars"]


def run_direct_renderer(
    payload_path: Path,
    output_dir: Path,
    quarter: str,
    language: str,
    modes: list[str],
    basename: str,
) -> dict[str, Any]:
    node_binary = shutil.which("node")
    if not node_binary:
        raise RuntimeError("node is unavailable; direct SVG renderer cannot run.")
    command = [
        node_binary,
        str(NODE_RENDERER_PATH),
        "--payload",
        str(payload_path),
        "--output-dir",
        str(output_dir),
        "--quarter",
        quarter,
        "--language",
        language,
        "--modes",
        ",".join(modes),
    ]
    if basename:
        command.extend(["--basename", basename])
    completed = subprocess.run(command, check=True, capture_output=True, text=True)
    return json.loads(completed.stdout)


def main() -> int:
    args = parse_args()
    modes = parse_modes(args.modes)
    output_dir = Path(args.output_dir).expanduser().resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    company = resolve_company(args.company, refresh=args.refresh)
    payload = build_company_payload(company, refresh=args.refresh)
    chosen_quarter = choose_quarter(payload, args.quarter)
    basename = args.basename or f"{company['id']}-{chosen_quarter}"

    with tempfile.TemporaryDirectory(prefix="earnings-direct-render-") as temp_dir:
        payload_path = Path(temp_dir) / f"{company['id']}.json"
        payload_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        render_meta = run_direct_renderer(
            payload_path=payload_path,
            output_dir=output_dir,
            quarter=chosen_quarter,
            language=args.language,
            modes=modes,
            basename=basename,
        )

    final_outputs: dict[str, Any] = {}
    for mode, meta in (render_meta.get("outputs") or {}).items():
        svg_path = Path(str(meta.get("svg"))).resolve()
        png_path = output_dir / f"{basename}-{mode}.png"
        rasterize_svg_to_png(svg_path, png_path, size=max(512, int(args.png_size)))
        final_outputs[mode] = {
            **meta,
            "svg": str(svg_path),
            "png": str(png_path.resolve()),
        }

    result = {
        "companyId": company["id"],
        "ticker": company.get("ticker"),
        "companyNameEn": company.get("nameEn"),
        "companyNameZh": company.get("nameZh"),
        "quarter": chosen_quarter,
        "language": args.language,
        "modes": modes,
        "outputs": final_outputs,
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
