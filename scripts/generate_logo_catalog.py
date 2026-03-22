from __future__ import annotations

import base64
import json
import re
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any


ROOT_DIR = Path(__file__).resolve().parents[1]
OUTPUT_PATH = ROOT_DIR / "data" / "logo-catalog.json"
DATASET_PATH = ROOT_DIR / "data" / "earnings-dataset.json"
SIMPLE_ICON_URL = "https://raw.githubusercontent.com/simple-icons/simple-icons/develop/icons/{slug}.svg"

COMPANY_DOMAINS: dict[str, str] = {
    "nvidia": "nvidia.com",
    "apple": "apple.com",
    "alphabet": "abc.xyz",
    "microsoft": "microsoft.com",
    "amazon": "amazon.com",
    "tsmc": "tsmc.com",
    "meta": "meta.com",
    "broadcom": "broadcom.com",
    "tesla": "tesla.com",
    "berkshire": "berkshirehathaway.com",
    "walmart": "walmart.com",
    "eli-lilly": "lilly.com",
    "jpmorgan": "jpmorganchase.com",
    "exxon": "exxonmobil.com",
    "visa": "visa.com",
    "jnj": "jnj.com",
    "asml": "asml.com",
    "oracle": "oracle.com",
    "micron": "micron.com",
    "costco": "costco.com",
    "mastercard": "mastercard.com",
    "abbvie": "abbvie.com",
    "netflix": "netflix.com",
    "chevron": "chevron.com",
    "palantir": "palantir.com",
    "procter-gamble": "pg.com",
    "bank-of-america": "bankofamerica.com",
    "home-depot": "homedepot.com",
    "coca-cola": "coca-colacompany.com",
    "caterpillar": "caterpillar.com",
    "tencent": "tencent.com",
    "alibaba": "alibaba.com",
}

OVERRIDE_LOGO_SOURCES: dict[str, dict[str, Any]] = {
    "alphabet": {
        "url": "https://www.gstatic.com/images/branding/productlogos/googleg/v6/192px.svg",
    },
    "amazon": {
        "url": "https://assets.aboutamazon.com/48/8c/1bc5933b414d82435b08581f742d/logo-1.svg",
    },
    "apple": {
        "url": SIMPLE_ICON_URL.format(slug="apple"),
        "fill": "#6B7280",
    },
    "asml": {
        "url": "https://cdn.worldvectorlogo.com/logos/asml.svg",
    },
    "bank-of-america": {
        "url": SIMPLE_ICON_URL.format(slug="bankofamerica"),
        "fill": "#C41230",
    },
    "berkshire": {
        "url": "https://commons.wikimedia.org/wiki/Special:Redirect/file/Berkshire%20Hathaway.svg",
    },
    "broadcom": {
        "url": SIMPLE_ICON_URL.format(slug="broadcom"),
        "fill": "#C62828",
    },
    "caterpillar": {
        "url": SIMPLE_ICON_URL.format(slug="caterpillar"),
        "fill": "#111827",
    },
    "chevron": {
        "url": "https://cdn.worldvectorlogo.com/logos/chevron.svg",
    },
    "coca-cola": {
        "url": SIMPLE_ICON_URL.format(slug="cocacola"),
        "fill": "#F40009",
    },
    "costco": {
        "url": "https://cdn.worldvectorlogo.com/logos/costco-wholesale.svg",
    },
    "eli-lilly": {
        "url": "https://cdn.worldvectorlogo.com/logos/lilly.svg",
    },
    "exxon": {
        "url": "https://corporate.exxonmobil.com/-/media/global/icons/logos/em-default-img-2880-1620.png",
    },
    "jnj": {
        "url": "https://jnj-content-lab2.brightspotcdn.com/ac/25/bd2078f54d5992dd486ed26140ce/johnson-johnson-logo.svg",
    },
    "jpmorgan": {
        "url": "https://www.jpmorganchase.com/content/dam/jpmorganchase/images/logos/jpmc-logo.svg",
    },
    "meta": {
        "url": SIMPLE_ICON_URL.format(slug="meta"),
        "fill": "#0866FF",
    },
    "micron": {
        "url": "https://cdn.worldvectorlogo.com/logos/micron.svg",
    },
    "netflix": {
        "url": SIMPLE_ICON_URL.format(slug="netflix"),
        "fill": "#E50914",
    },
    "nvidia": {
        "url": SIMPLE_ICON_URL.format(slug="nvidia"),
        "fill": "#76B900",
    },
    "palantir": {
        "url": SIMPLE_ICON_URL.format(slug="palantir"),
        "fill": "#111827",
    },
    "procter-gamble": {
        "url": "https://images.ctfassets.net/oggad6svuzkv/6eWEFfxHDZrqJ2DGt1NqpQ/0919f47f4215e2e27fb754a821a5e685/PG_logo_OGtransparent.png",
    },
    "tesla": {
        "url": SIMPLE_ICON_URL.format(slug="tesla"),
        "fill": "#CC0000",
    },
    "visa": {
        "url": SIMPLE_ICON_URL.format(slug="visa"),
        "fill": "#1434CB",
    },
    "walmart": {
        "url": "https://brandcenter.walmart.com/content/brand/us/en/home/brand-identity/spark/_jcr_content/root/container/footer_copy_copy/logo.coreimg.svg/1740780744169/spark.svg",
    },
    "home-depot": {
        "url": "https://cdn.worldvectorlogo.com/logos/the-home-depot.svg",
    },
    "oracle": {
        "url": "https://cdn.worldvectorlogo.com/logos/oracle.svg",
    },
    "tsmc": {
        "url": "https://cdn.worldvectorlogo.com/logos/tsmc.svg",
    },
    "abbvie": {
        "url": SIMPLE_ICON_URL.format(slug="abbvie"),
        "fill": "#071D49",
    },
}

CANDIDATE_URLS = (
    "https://{domain}/apple-touch-icon.png",
    "https://www.{domain}/apple-touch-icon.png",
    "https://{domain}/apple-touch-icon-precomposed.png",
    "https://www.{domain}/apple-touch-icon-precomposed.png",
    "https://www.google.com/s2/favicons?domain_url=https://{domain}&sz=256",
)

REQUEST_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36",
    "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
}


def _request_bytes(url: str) -> tuple[bytes, str]:
    request = urllib.request.Request(url, headers=REQUEST_HEADERS)
    with urllib.request.urlopen(request, timeout=25) as response:
        content_type = response.headers.get_content_type() or "application/octet-stream"
        return response.read(), content_type


def _png_dimensions(data: bytes) -> tuple[int, int] | None:
    if not data.startswith(b"\x89PNG\r\n\x1a\n") or len(data) < 24:
        return None
    return (
        int.from_bytes(data[16:20], "big"),
        int.from_bytes(data[20:24], "big"),
    )


def _normalize_mime(content_type: str, payload: bytes) -> str:
    if payload.startswith(b"<svg") or payload.lstrip().startswith(b"<?xml"):
        return "image/svg+xml"
    if payload.startswith(b"\x89PNG"):
        return "image/png"
    return content_type or "application/octet-stream"


def _apply_svg_fill(payload: bytes, fill: str | None) -> bytes:
    if not fill:
        return payload
    text = payload.decode("utf-8", errors="ignore")
    if "<svg" not in text:
        return payload
    if re.search(r"<svg[^>]+fill=", text):
        return payload
    text = re.sub(r"<svg(\s+)", f'<svg fill="{fill}"\\1', text, count=1)
    return text.encode("utf-8")


def _svg_dimensions(payload: bytes) -> tuple[int, int] | None:
    text = payload.decode("utf-8", errors="ignore")
    view_box_match = re.search(r'viewBox\s*=\s*["\']\s*[0-9.]+\s+[0-9.]+\s+([0-9.]+)\s+([0-9.]+)\s*["\']', text)
    if view_box_match:
      return (max(int(float(view_box_match.group(1))), 1), max(int(float(view_box_match.group(2))), 1))
    size_match = re.search(r'width\s*=\s*["\']([0-9.]+)', text)
    height_match = re.search(r'height\s*=\s*["\']([0-9.]+)', text)
    if size_match and height_match:
      return (max(int(float(size_match.group(1))), 1), max(int(float(height_match.group(1))), 1))
    return None


def _load_brand_colors() -> dict[str, str]:
    if not DATASET_PATH.exists():
        return {}
    payload = json.loads(DATASET_PATH.read_text(encoding="utf-8"))
    return {
        company.get("id"): company.get("brand", {}).get("primary", "#111827")
        for company in payload.get("companies", [])
    }


def _select_logo(company_id: str, domain: str) -> dict[str, Any]:
    last_error: str | None = None
    override_source = OVERRIDE_LOGO_SOURCES.get(company_id)
    if override_source:
        override_url = override_source["url"]
        payload, content_type = _request_bytes(override_url)
        payload = _apply_svg_fill(payload, override_source.get("fill"))
        mime = _normalize_mime(content_type, payload)
        dimensions = _svg_dimensions(payload) if mime == "image/svg+xml" else _png_dimensions(payload)
        return {
            "sourceUrl": override_url,
            "mime": mime,
            "dataUrl": f"data:{mime};base64,{base64.b64encode(payload).decode('ascii')}",
            "width": dimensions[0] if dimensions else 64,
            "height": dimensions[1] if dimensions else 64,
        }
    for template in CANDIDATE_URLS:
        url = template.format(domain=domain)
        try:
            payload, content_type = _request_bytes(url)
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as exc:
            last_error = str(exc)
            continue

        mime = _normalize_mime(content_type, payload)
        if not mime.startswith("image/"):
            last_error = f"unexpected content-type {mime}"
            continue

        dimensions = _png_dimensions(payload)
        if dimensions is None and mime == "image/svg+xml":
            dimensions = _svg_dimensions(payload)
        if dimensions is not None and min(dimensions) < 48 and "google.com/s2/favicons" not in url:
            last_error = f"icon too small {dimensions}"
            continue

        return {
            "sourceUrl": url,
            "mime": mime,
            "dataUrl": f"data:{mime};base64,{base64.b64encode(payload).decode('ascii')}",
            "width": dimensions[0] if dimensions else 64,
            "height": dimensions[1] if dimensions else 64,
        }

    raise RuntimeError(last_error or "no usable logo asset found")


def main() -> int:
    brand_colors = _load_brand_colors()
    catalog: dict[str, Any] = {}
    failures: dict[str, str] = {}
    for company_id, domain in COMPANY_DOMAINS.items():
        try:
            if company_id in OVERRIDE_LOGO_SOURCES and "fill_from_brand" in OVERRIDE_LOGO_SOURCES[company_id]:
                OVERRIDE_LOGO_SOURCES[company_id]["fill"] = brand_colors.get(company_id, "#111827")
            catalog[company_id] = {
                "domain": domain,
                **_select_logo(company_id, domain),
            }
            print(f"[ok] {company_id} <- {catalog[company_id]['sourceUrl']}", flush=True)
        except Exception as exc:  # noqa: BLE001
            failures[company_id] = str(exc)
            print(f"[warn] {company_id}: {exc}", flush=True)

    payload = {
        "generatedAt": __import__("time").strftime("%Y-%m-%dT%H:%M:%SZ", __import__("time").gmtime()),
        "logos": catalog,
        "failures": failures,
    }
    OUTPUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[done] wrote {OUTPUT_PATH}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
