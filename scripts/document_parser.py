from __future__ import annotations

import hashlib
import json
import re
import subprocess
import tempfile
import time
from dataclasses import asdict, dataclass
from html import unescape
from io import BytesIO
from pathlib import Path
from typing import Any

import requests
from pypdf import PdfReader

from official_financials import _extract_html_tables


ROOT_DIR = Path(__file__).resolve().parents[1]
CACHE_DIR = ROOT_DIR / "data" / "cache" / "document-parser"
PARSED_CACHE_DIR = CACHE_DIR / "parsed"
TEXT_MIRROR_CACHE_DIR = CACHE_DIR / "text-mirror"
VISION_OCR_SWIFT = ROOT_DIR / "scripts" / "vision_ocr.swift"
VISION_OCR_BIN = CACHE_DIR / "vision-ocr"
DEFAULT_HEADERS = {
    "User-Agent": "Codex/document-parser yuwan@example.com",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,application/pdf,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Cache-Control": "no-cache",
}
PARSER_VERSION = "document-parser-v4"
TEXT_MIRROR_CACHE_VERSION = "document-parser-text-mirror-v1"
TEXT_MIRROR_CACHE_TTL_SECONDS = 24 * 60 * 60
QUARTER_END_MONTH_DAY = {
    1: (3, 31),
    2: (6, 30),
    3: (9, 30),
    4: (12, 31),
}
ENGLISH_MONTH_NAMES = {
    1: "January",
    2: "February",
    3: "March",
    4: "April",
    5: "May",
    6: "June",
    7: "July",
    8: "August",
    9: "September",
    10: "October",
    11: "November",
    12: "December",
}
TEXT_MIRROR_CACHE: dict[str, dict[str, Any]] = {}
INCOME_STATEMENT_START_PATTERNS = [
    re.compile(r"(?:CONDENSED\s+)?CONSOLIDATED\s+INCOME\s+STATEMENT", re.IGNORECASE),
    re.compile(r"(?:CONDENSED\s+)?CONSOLIDATED\s+STATEMENTS?\s+OF\s+OPERATIONS", re.IGNORECASE),
    re.compile(r"(?:CONDENSED\s+)?CONSOLIDATED\s+STATEMENTS?\s+OF\s+EARNINGS", re.IGNORECASE),
    re.compile(r"(?:简明)?合并(?:利润|损益)表"),
]
INCOME_STATEMENT_END_PATTERNS = [
    re.compile(r"(?:CONDENSED\s+)?CONSOLIDATED\s+STATEMENT\s+OF\s+COMPREHENSIVE\s+INCOME", re.IGNORECASE),
    re.compile(r"(?:CONDENSED\s+)?CONSOLIDATED\s+BALANCE\s+SHEETS?", re.IGNORECASE),
    re.compile(r"(?:CONDENSED\s+)?CONSOLIDATED\s+STATEMENTS?\s+OF\s+FINANCIAL\s+POSITION", re.IGNORECASE),
    re.compile(r"(?:CONDENSED\s+)?CONSOLIDATED\s+STATEMENTS?\s+OF\s+CASH\s+FLOWS?", re.IGNORECASE),
    re.compile(r"(?:简明)?合并综合收益表"),
    re.compile(r"(?:简明)?合并资产负债表"),
    re.compile(r"(?:简明)?合并现金流量表"),
]
INCOME_STATEMENT_ROW_ALIASES: dict[str, list[str]] = {
    "revenue": ["Revenues", "Revenue", "营业收入", "收入"],
    "fulfillment": ["Fulfillment expenses", "Fulfillment Expenses", "履约开支", "履约费用"],
    "marketing": ["Marketing expenses", "Marketing Expenses", "市场及营销开支", "营销开支"],
    "cost_of_revenue": ["Cost of revenues", "Cost of revenue", "营业成本", "收入成本"],
    "gross_profit": ["Gross profit", "毛利", "毛利润"],
    "selling_marketing": [
        "Selling and marketing expenses",
        "Sales and marketing expenses",
        "销售及市场推广开支",
        "销售及营销费用",
        "销售费用",
        "营销费用",
    ],
    "general_admin": [
        "General and administrative expenses",
        "General and administrative",
        "Administrative expenses",
        "一般及行政开支",
        "行政开支",
        "管理费用",
    ],
    "research_development": [
        "Research and development expenses",
        "Research and development",
        "研发费用",
        "研究及开发开支",
    ],
    "other_gains_losses": [
        "Other gains/(losses), net",
        "Other gains or losses, net",
        "Other income, net",
        "其他收益净额",
        "其他亏损净额",
        "其他收益/(亏损)净额",
    ],
    "operating_profit": ["Operating profit", "Operating income", "Income from operations", "Operating (loss)/profit", "营业利润", "经营利润", "经营盈利"],
    "pretax_income": [
        "Profit before income tax",
        "Profit before tax",
        "Income before income taxes",
        "(Loss)/profit before income tax",
        "(Loss)/profit before tax",
        "税前利润",
    ],
    "income_tax": [
        "Income tax expense",
        "Income tax expenses",
        "Income tax credit/(expense)",
        "Income tax credits/(expenses)",
        "Provision for income taxes",
        "所得税费用",
        "所得税开支",
    ],
    "impairment_losses": [
        "Net provisions for impairment losses on financial and contract assets",
        "Impairment losses on financial and contract assets",
        "Impairment losses",
        "减值损失",
    ],
    "net_income_attributable": [
        "Attributable to: Equity holders of the Company",
        "Profit attributable to equity holders of the Company",
        "Profit for the period attributable to: Equity holders of the Company",
        "Profit for the period attributable to the equity holders of the Company",
        "(Loss)/profit for the period attributable to: Equity holders of the Company",
        "Net income attributable to shareholders",
        "Profit attributable to owners of the parent",
        "归属于本公司权益持有人的盈利",
        "归属于母公司股东的净利润",
    ],
    "net_income": ["Net income", "Profit for the period", "(Loss)/profit for the period", "Profit attributable to shareholders", "净利润", "期内利润"],
}


@dataclass
class ParsedDocument:
    version: str
    url: str
    final_url: str
    content_type: str
    kind: str
    extraction_method: str
    language_profile: str
    text: str
    page_texts: list[str]
    html_tables: list[list[list[str]]]
    metadata: dict[str, Any]

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class ParsedFinancialStatement:
    version: str
    statement_kind: str
    section_found: bool
    section_label: str
    language_profile: str
    lines: list[str]
    rows: dict[str, list[float]]
    metadata: dict[str, Any]

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class ParsedLabeledRows:
    version: str
    language_profile: str
    lines: list[str]
    rows: dict[str, list[float]]
    metadata: dict[str, Any]

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class OCRObservation:
    text: str
    x: float
    y: float
    width: float
    height: float

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def _cache_key(url: str) -> str:
    return hashlib.sha1(str(url or "").encode("utf-8")).hexdigest()


def _parsed_cache_path(url: str, *, ocr_fallback: bool) -> Path:
    PARSED_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    suffix = "ocr" if ocr_fallback else "plain"
    return PARSED_CACHE_DIR / f"{_cache_key(url)}-{suffix}.json"


def _mirror_cache_path(url: str) -> Path:
    TEXT_MIRROR_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    return TEXT_MIRROR_CACHE_DIR / f"{_cache_key(url)}.json"


def _load_cached_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def _write_cached_json(path: Path, payload: Any) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def _is_current_parsed_cache(payload: Any) -> bool:
    return isinstance(payload, dict) and str(payload.get("version") or "") == PARSER_VERSION


def _is_current_text_mirror_cache(payload: Any, *, now_ts: int | None = None) -> bool:
    if not isinstance(payload, dict):
        return False
    if str(payload.get("_cacheVersion") or "") != TEXT_MIRROR_CACHE_VERSION:
        return False
    text = payload.get("text")
    if not isinstance(text, str) or not text:
        return False
    try:
        fetched_at = int(payload.get("fetchedAt"))
    except (TypeError, ValueError):
        return False
    current_ts = int(time.time()) if now_ts is None else int(now_ts)
    return current_ts - fetched_at <= TEXT_MIRROR_CACHE_TTL_SECONDS


def _request_timeout(url: str, accept: str | None = None) -> tuple[int, int]:
    normalized_url = str(url or "").lower()
    normalized_accept = str(accept or "").lower()
    is_pdf_like = (
        "application/pdf" in normalized_accept
        or normalized_url.endswith(".pdf")
        or "/static-files/" in normalized_url
        or "/uploads/" in normalized_url
    )
    if is_pdf_like:
        return (20, 120)
    return (15, 30)


def _request_url(url: str, *, accept: str | None = None) -> requests.Response:
    headers = dict(DEFAULT_HEADERS)
    if accept:
        headers["Accept"] = accept
    timeout = _request_timeout(url, accept)
    last_error: Exception | None = None
    candidate_urls = [url]
    if str(url).startswith("http://"):
        candidate_urls.append("https://" + str(url)[7:])
    for attempt in range(4):
        for candidate_url in candidate_urls:
            for trust_env in (True, False):
                try:
                    with requests.Session() as session:
                        session.trust_env = trust_env
                        response = session.get(candidate_url, timeout=timeout, headers=headers)
                    response.raise_for_status()
                    return response
                except Exception as exc:  # noqa: BLE001
                    last_error = exc
                    if trust_env:
                        message = str(exc).lower()
                        if "127.0.0.1" in message or "proxy" in message:
                            continue
                break
        if attempt >= 3:
            break
        time.sleep(0.8 * (attempt + 1))
    if last_error is not None:
        raise last_error
    raise RuntimeError(f"failed to fetch {url}")


def _decode_text(content: bytes) -> str:
    for encoding in ("utf-8", "utf-8-sig", "latin-1"):
        try:
            return content.decode(encoding)
        except UnicodeDecodeError:
            continue
    return content.decode("utf-8", errors="ignore")


def _strip_html_to_text(html_text: str) -> str:
    text = re.sub(r"<script\b.*?</script>", " ", html_text, flags=re.IGNORECASE | re.DOTALL)
    text = re.sub(r"<style\b.*?</style>", " ", text, flags=re.IGNORECASE | re.DOTALL)
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"</(?:p|div|li|tr|h\d|section|article)>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", text)
    text = unescape(text)
    text = re.sub(r"\n\s+\n", "\n\n", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\s+\n", "\n", text)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def _normalize_text_space(text: str) -> str:
    return re.sub(r"\s+", " ", str(text or "")).strip()


def detect_language_profile(text: str) -> str:
    sample = str(text or "")[:12000]
    if not sample.strip():
        return "unknown"
    han_count = len(re.findall(r"[\u4e00-\u9fff]", sample))
    latin_count = len(re.findall(r"[A-Za-z]", sample))
    if han_count and latin_count:
        ratio = han_count / max(han_count + latin_count, 1)
        if 0.15 <= ratio <= 0.85:
            return "mixed"
        if ratio > 0.85:
            return "zh"
        return "en"
    if han_count:
        return "zh"
    if latin_count:
        return "en"
    return "unknown"


def ensure_vision_ocr_binary() -> Path:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    needs_build = not VISION_OCR_BIN.exists()
    if not needs_build:
        needs_build = VISION_OCR_BIN.stat().st_mtime < VISION_OCR_SWIFT.stat().st_mtime
    if needs_build:
        subprocess.run(["swiftc", str(VISION_OCR_SWIFT), "-o", str(VISION_OCR_BIN)], check=True)
    return VISION_OCR_BIN


def ocr_image_path(image_path: str | Path) -> str:
    binary = ensure_vision_ocr_binary()
    result = subprocess.run([str(binary), str(image_path)], check=True, capture_output=True, text=True)
    return result.stdout


def ocr_image_path_json(image_path: str | Path) -> list[OCRObservation]:
    binary = ensure_vision_ocr_binary()
    result = subprocess.run([str(binary), "--json", str(image_path)], check=True, capture_output=True, text=True)
    payload = json.loads(result.stdout or "[]")
    observations: list[OCRObservation] = []
    for item in payload if isinstance(payload, list) else []:
        if not isinstance(item, dict):
            continue
        text = str(item.get("text") or "").strip()
        if not text:
            continue
        try:
            observations.append(
                OCRObservation(
                    text=text,
                    x=float(item.get("x") or 0),
                    y=float(item.get("y") or 0),
                    width=float(item.get("width") or 0),
                    height=float(item.get("height") or 0),
                )
            )
        except (TypeError, ValueError):
            continue
    return observations


def _reconstruct_ocr_lines(observations: list[OCRObservation]) -> list[str]:
    if not observations:
        return []
    sorted_observations = sorted(observations, key=lambda item: (-(item.y + item.height / 2), item.x))
    lines: list[list[OCRObservation]] = []
    for observation in sorted_observations:
        mid_y = observation.y + observation.height / 2
        placed = False
        for line in lines:
            anchor = line[0]
            anchor_mid_y = anchor.y + anchor.height / 2
            y_threshold = max(min(anchor.height, observation.height) * 0.75, 0.015)
            if abs(mid_y - anchor_mid_y) <= y_threshold:
                line.append(observation)
                placed = True
                break
        if not placed:
            lines.append([observation])

    rebuilt_lines: list[str] = []
    for line in lines:
        sorted_line = sorted(line, key=lambda item: item.x)
        parts = []
        for index, observation in enumerate(sorted_line):
            if index > 0:
                previous = sorted_line[index - 1]
                gap = observation.x - (previous.x + previous.width)
                parts.append("    " if gap > 0.08 else " ")
            parts.append(observation.text)
        rebuilt = "".join(parts).strip()
        if rebuilt:
            rebuilt_lines.append(rebuilt)
    return rebuilt_lines


def ocr_image_url(url: str) -> str:
    with tempfile.TemporaryDirectory() as temp_dir:
        suffix = Path(url).suffix or ".png"
        image_path = Path(temp_dir) / f"document-ocr{suffix}"
        image_path.write_bytes(_request_url(url).content)
        return ocr_image_path(image_path)


def extract_next_data_props(html_text: str) -> dict[str, Any]:
    match = re.search(r'__NEXT_DATA__"\s+type="application/json">(.*?)</script>', html_text, re.DOTALL)
    if not match:
        return {}
    try:
        payload = json.loads(match.group(1))
    except json.JSONDecodeError:
        return {}
    props = payload.get("props") if isinstance(payload, dict) else {}
    return props if isinstance(props, dict) else {}


def _extract_pdf_page_texts_from_bytes(pdf_bytes: bytes) -> list[str]:
    reader = PdfReader(BytesIO(pdf_bytes))
    return [page.extract_text() or "" for page in reader.pages]


def _should_try_pdf_ocr(page_texts: list[str]) -> bool:
    joined = " ".join(page_texts)
    normalized = re.sub(r"\s+", " ", joined).strip()
    if not normalized:
        return True
    if len(normalized) < 240:
        return True
    return len(re.findall(r"[A-Za-z0-9\u4e00-\u9fff]", normalized)) < 120


def _extract_pdf_image_ocr_texts(pdf_bytes: bytes) -> list[str]:
    reader = PdfReader(BytesIO(pdf_bytes))
    page_texts: list[str] = []
    with tempfile.TemporaryDirectory() as temp_dir:
        for page_index, page in enumerate(reader.pages):
            page_fragments: list[str] = []
            try:
                images = list(page.images)
            except Exception:  # noqa: BLE001
                images = []
            for image_index, image in enumerate(images):
                suffix = Path(str(getattr(image, "name", "") or f"page-{page_index + 1}-{image_index}.png")).suffix or ".png"
                image_path = Path(temp_dir) / f"page-{page_index + 1}-{image_index}{suffix}"
                try:
                    image_path.write_bytes(image.data)
                    observations = ocr_image_path_json(image_path)
                except Exception:  # noqa: BLE001
                    continue
                ocr_lines = _reconstruct_ocr_lines(observations)
                ocr_text = "\n".join(ocr_lines).strip()
                if ocr_text:
                    page_fragments.append(ocr_text)
            page_texts.append("\n\n".join(page_fragments).strip())
    return page_texts


def _parse_numeric_token(token: str) -> float | None:
    cleaned = str(token or "").strip().replace(",", "").replace("%", "")
    if not cleaned:
        return None
    negative = cleaned.startswith("(") and cleaned.endswith(")")
    if negative:
        cleaned = cleaned[1:-1]
    try:
        value = float(cleaned)
    except ValueError:
        return None
    return -value if negative else value


def _collapse_statement_lines(text: str) -> list[str]:
    collapsed: list[str] = []
    cursor = ""
    for raw_line in str(text or "").splitlines():
        line = _normalize_text_space(raw_line)
        if not line:
            continue
        merged = f"{cursor} {line}".strip() if cursor else line
        if re.search(r"\(?-?\d[\d,]*(?:\.\d+)?\)?%?(?:\s|$)", line):
            collapsed.append(merged)
            cursor = ""
        else:
            cursor = merged
    if cursor:
        collapsed.append(cursor)
    return collapsed


def _extract_normalized_lines(text: str) -> list[str]:
    lines: list[str] = []
    for raw_line in str(text or "").splitlines():
        line = _normalize_text_space(raw_line)
        if line:
            lines.append(line)
    return lines


def _statement_label_pattern(label: str) -> re.Pattern[str]:
    escaped = re.escape(label)
    escaped = escaped.replace(r"\ ", r"\s+")
    escaped = escaped.replace(r"\(", r"\(?").replace(r"\)", r"\)?")
    return re.compile(
        rf"^(?:(?:\([^)]{{1,80}}\)|(?:note|附注)\s*[A-Za-z0-9IVXivx]*|\(?\d+[A-Za-z]?\)?|\(?[IVXivx]{{1,8}}\)?)\s+)*{escaped}(?:\s*[:：]?\s*\(?\d+\)?)?\s+(.+)$",
        re.IGNORECASE,
    )


def _quarter_number(quarter_hint: str | None) -> int | None:
    raw = str(quarter_hint or "")
    if len(raw) != 6 or raw[4] != "Q":
        return None
    try:
        quarter = int(raw[5])
    except ValueError:
        return None
    return quarter if quarter in QUARTER_END_MONTH_DAY else None


def _quarter_context_hints(quarter_hint: str | None) -> dict[str, Any]:
    raw = str(quarter_hint or "")
    if len(raw) != 6 or raw[4] != "Q":
        return {}
    try:
        year = int(raw[:4])
    except ValueError:
        return {}
    quarter = _quarter_number(raw)
    if quarter is None:
        return {}
    month, day = QUARTER_END_MONTH_DAY[quarter]
    current_year = year
    prior_year = year - 1
    english_month = ENGLISH_MONTH_NAMES[month]
    return {
        "quarter": quarter,
        "current_date_patterns": [
            re.compile(rf"{english_month}\s+{day},\s*{current_year}", re.IGNORECASE),
            re.compile(rf"{current_year}\s*[-/]\s*{month:02d}\s*[-/]\s*{day:02d}", re.IGNORECASE),
            re.compile(rf"{current_year}\s*年\s*{month}\s*月\s*{day}\s*日"),
        ],
        "prior_year_date_patterns": [
            re.compile(rf"{english_month}\s+{day},\s*{prior_year}", re.IGNORECASE),
            re.compile(rf"{prior_year}\s*[-/]\s*{month:02d}\s*[-/]\s*{day:02d}", re.IGNORECASE),
            re.compile(rf"{prior_year}\s*年\s*{month}\s*月\s*{day}\s*日"),
        ],
    }


def _context_matches_any(text: str, patterns: list[re.Pattern[str]]) -> bool:
    return any(pattern.search(text) for pattern in patterns)


def _extract_leading_numeric_tokens(text: str) -> list[str]:
    tokens: list[str] = []
    cursor = 0
    source = str(text or "").strip()
    token_pattern = re.compile(r"\s*(\(?-?\d[\d,]*(?:\.\d+)?\)?%?)")
    while cursor < len(source):
        match = token_pattern.match(source, cursor)
        if not match:
            break
        tokens.append(match.group(1))
        cursor = match.end()
    return tokens


def _score_statement_row_candidate(
    lines: list[str],
    index: int,
    raw_tokens: list[str],
    parsed_values: list[float],
    *,
    quarter_hint: str | None,
) -> int:
    if not quarter_hint:
        return 0
    context = " ".join(lines[max(0, index - 12) : index + 1])
    compact_context = re.sub(r"\s+", " ", context).strip()
    current_line = re.sub(r"\s+", " ", str(lines[index] or "")).strip()
    hints = _quarter_context_hints(quarter_hint)
    score = 0
    if re.search(r"three\s+months\s+ended|three-month period|current quarter", compact_context, re.IGNORECASE):
        score += 10
    if re.search(r"截至.*三个月|三个月截至|本季度", compact_context):
        score += 10
    if re.search(r"six\s+months\s+ended|nine\s+months\s+ended|year\s+ended", compact_context, re.IGNORECASE):
        score -= 8
    if re.search(r"截至.*六个月|截至.*九个月|截至.*年度|年度", compact_context):
        score -= 8
    if re.search(r"share-based\s+compensation|stock-?based\s+compensation", compact_context, re.IGNORECASE):
        score -= 12
    if re.search(r"non-gaap|non-ifrs|adjusted|reconciliation|note\s+\d+|附注", compact_context, re.IGNORECASE):
        score -= 14
    if re.search(r"condensed\s+consolidated|income\s+statement|unaudited|audited", compact_context, re.IGNORECASE):
        score += 8
    if re.search(r"\b(?:q[1-4]\s*20\d{2}|20\d{2}\s*q[1-4]|4q20\d{2}|3q20\d{2}|2q20\d{2}|1q20\d{2})\b", compact_context, re.IGNORECASE):
        score += 4
    if re.search(r"\b(?:yoy|year-on-year|quarter-on-quarter|qoq)\b|margin increased|margin decreased|\bwas\b", current_line, re.IGNORECASE):
        score -= 10
    if re.search(r"basic earnings per share|diluted earnings per share|capital expenditure|free cash flow", compact_context, re.IGNORECASE):
        score -= 12
    if len(re.findall(r"(?:^|\s)[—–-](?:\s|$)", current_line)) >= 2:
        score -= 10
    current_date_patterns = hints.get("current_date_patterns")
    if isinstance(current_date_patterns, list) and _context_matches_any(compact_context, current_date_patterns):
        score += 4
    prior_year_date_patterns = hints.get("prior_year_date_patterns")
    if isinstance(prior_year_date_patterns, list) and _context_matches_any(compact_context, prior_year_date_patterns):
        score += 8
    if any(token.endswith("%") for token in raw_tokens):
        score -= 2
    numeric_count = len(parsed_values)
    if numeric_count == 4:
        score += 10
    elif numeric_count == 2:
        score += 6
    elif numeric_count >= 3:
        score += 2
    else:
        score -= 4
    if numeric_count > 4:
        score -= min(12, (numeric_count - 4) * 4)
    return score


def _extract_statement_row_values(lines: list[str], aliases: list[str], *, quarter_hint: str | None = None) -> list[float]:
    best_values: list[float] = []
    best_score: tuple[int, int, int, int] | None = None
    for alias in aliases:
        pattern = _statement_label_pattern(alias)
        for index, line in enumerate(lines):
            match = pattern.match(line)
            if not match:
                continue
            leading_tokens = _extract_leading_numeric_tokens(match.group(1))
            if not leading_tokens:
                continue
            amount_tokens = [token for token in leading_tokens if not token.endswith("%")]
            values = [_parse_numeric_token(token) for token in amount_tokens]
            parsed_values = [value for value in values if value is not None]
            if parsed_values:
                if not quarter_hint:
                    return parsed_values
                score = _score_statement_row_candidate(
                    lines,
                    index,
                    leading_tokens,
                    parsed_values,
                    quarter_hint=quarter_hint,
                )
                desired_count = 4
                score_key = (
                    score,
                    -sum(1 for token in leading_tokens if token.endswith("%")),
                    -abs(len(parsed_values) - desired_count),
                    -len(parsed_values),
                    -index,
                )
                if best_score is None or score_key > best_score:
                    best_score = score_key
                    best_values = parsed_values
    return best_values


def _compile_text_section_patterns(patterns: list[re.Pattern[str] | str] | None) -> list[re.Pattern[str]]:
    compiled: list[re.Pattern[str]] = []
    for pattern in patterns or []:
        if isinstance(pattern, re.Pattern):
            compiled.append(pattern)
        else:
            compiled.append(re.compile(str(pattern), re.IGNORECASE))
    return compiled


def slice_text_section(
    text: str,
    *,
    start_patterns: list[re.Pattern[str] | str],
    end_patterns: list[re.Pattern[str] | str] | None = None,
) -> tuple[str, bool, str]:
    source_text = str(text or "")
    compiled_starts = _compile_text_section_patterns(start_patterns)
    compiled_ends = _compile_text_section_patterns(end_patterns)
    start_index = -1
    start_label = ""
    for pattern in compiled_starts:
        match = pattern.search(source_text)
        if match and (start_index < 0 or match.start() < start_index):
            start_index = match.start()
            start_label = match.group(0)
    if start_index < 0:
        return source_text, False, ""
    end_index = len(source_text)
    for pattern in compiled_ends:
        match = pattern.search(source_text, pos=start_index + 1)
        if match:
            end_index = min(end_index, match.start())
    return source_text[start_index:end_index], True, start_label


def parse_labeled_numeric_rows(
    text: str,
    row_aliases: dict[str, list[str]],
    *,
    language_hint: str | None = None,
    section_start_patterns: list[re.Pattern[str] | str] | None = None,
    section_end_patterns: list[re.Pattern[str] | str] | None = None,
) -> ParsedLabeledRows:
    source_text = str(text or "")
    search_text = source_text
    section_found = False
    section_label = ""
    if section_start_patterns:
        search_text, section_found, section_label = slice_text_section(
            source_text,
            start_patterns=section_start_patterns,
            end_patterns=section_end_patterns,
        )
    raw_lines = _extract_normalized_lines(search_text)
    collapsed_lines = _collapse_statement_lines(search_text)
    raw_line_set = set(raw_lines)
    lines = raw_lines + [line for line in collapsed_lines if line not in raw_line_set]
    rows: dict[str, list[float]] = {}
    for canonical_name, aliases in row_aliases.items():
        values = _extract_statement_row_values(lines, aliases)
        if values:
            rows[canonical_name] = values
    language_profile = language_hint or detect_language_profile(search_text)
    value_scale, value_unit = _detect_statement_value_scale(search_text, lines, rows)
    bn_scale = (value_scale / 1_000_000_000) if value_scale else None
    return ParsedLabeledRows(
        version=f"{PARSER_VERSION}-labeled-rows-v2",
        language_profile=language_profile,
        lines=lines,
        rows=rows,
        metadata={
            "lineCount": len(lines),
            "matchedRowCount": len(rows),
            "valueScale": value_scale,
            "valueUnit": value_unit,
            "bnScale": bn_scale,
            "sectionFound": section_found,
            "sectionLabel": section_label,
        },
    )


def _slice_income_statement_text(text: str) -> tuple[str, bool, str]:
    source_text = str(text or "")
    start_index = -1
    start_label = ""
    for pattern in INCOME_STATEMENT_START_PATTERNS:
        match = pattern.search(source_text)
        if match and (start_index < 0 or match.start() < start_index):
            start_index = match.start()
            start_label = match.group(0)
    if start_index < 0:
        return source_text, False, ""
    end_index = len(source_text)
    for pattern in INCOME_STATEMENT_END_PATTERNS:
        match = pattern.search(source_text, pos=start_index + 1)
        if match:
            end_index = min(end_index, match.start())
    return source_text[start_index:end_index], True, start_label


def _has_fragmented_currency_header(lines: list[str], section_text: str) -> bool:
    repeated_currency_pattern = re.compile(
        r"(?:(?:RMB|USD|HK\$|HKD|CNY|EUR|JPY)\b(?:\s*\([^)]*\))?\s*){3,}",
        re.IGNORECASE,
    )
    for line in lines:
        if repeated_currency_pattern.search(str(line or "")):
            return True
    if section_text and repeated_currency_pattern.search(str(section_text)):
        return True
    return False


def _collect_table_like_numeric_values(lines: list[str]) -> list[float]:
    numeric_values: list[float] = []
    for line in lines:
        normalized_line = str(line or "")
        if "%" in normalized_line:
            continue
        tokens = re.findall(r"\(?\d[\d,]*(?:\.\d+)?\)?", normalized_line)
        if len(tokens) < 3:
            continue
        for token in tokens:
            cleaned = token.replace(",", "")
            if cleaned.startswith("(") and cleaned.endswith(")"):
                cleaned = f"-{cleaned[1:-1]}"
            try:
                numeric = abs(float(cleaned))
            except ValueError:
                continue
            if numeric > 0:
                numeric_values.append(numeric)
    return numeric_values


def _infer_statement_value_scale(
    section_text: str,
    lines: list[str],
    rows: dict[str, list[float]] | None = None,
) -> tuple[float | None, str]:
    if not _has_fragmented_currency_header(lines, section_text):
        return None, ""
    numeric_values: list[float] = []
    for row_values in (rows or {}).values():
        for value in row_values:
            try:
                numeric = abs(float(value))
            except (TypeError, ValueError):
                continue
            if numeric > 0:
                numeric_values.append(numeric)
    if not numeric_values:
        return None, ""
    numeric_values.extend(_collect_table_like_numeric_values(lines))
    max_value = max(numeric_values)
    has_fractional_values = any(abs(value - round(value)) > 1e-6 for value in numeric_values)
    if max_value >= 1_000_000:
        return 1_000.0, "heuristic-currency-thousands"
    if max_value >= 1_000:
        return 1_000_000.0, "heuristic-currency-millions"
    if has_fractional_values:
        return 1_000_000_000.0, "heuristic-currency-billions"
    return None, ""


def _detect_statement_value_scale(
    section_text: str,
    lines: list[str],
    rows: dict[str, list[float]] | None = None,
) -> tuple[float | None, str]:
    sample = "\n".join(lines[:12]) if lines else ""
    if section_text:
        sample = f"{sample}\n{str(section_text)[:1200]}".strip()
    patterns = [
        (
            re.compile(r"\(?(?:RMB|USD|HK\$|HKD|CNY|EUR|JPY)\s+in\s+thousands(?:\s*,\s*unless\s+specified)?\)?", re.IGNORECASE),
            1_000.0,
            "thousands",
        ),
        (
            re.compile(r"\(?(?:RMB|USD|HK\$|HKD|CNY|EUR|JPY)\s+in\s+millions(?:\s*,\s*unless\s+specified)?\)?", re.IGNORECASE),
            1_000_000.0,
            "millions",
        ),
        (
            re.compile(r"\(?(?:RMB|USD|HK\$|HKD|CNY|EUR|JPY)\s+in\s+billions(?:\s*,\s*unless\s+specified)?\)?", re.IGNORECASE),
            1_000_000_000.0,
            "billions",
        ),
        (re.compile(r"人民币千元(?:，除非另有说明)?"), 1_000.0, "cny-thousands"),
        (re.compile(r"人民币百万元(?:，除非另有说明)?"), 1_000_000.0, "cny-millions"),
        (re.compile(r"人民币亿元(?:，除非另有说明)?"), 100_000_000.0, "cny-hundred-millions"),
    ]
    for pattern, value_scale, label in patterns:
        if pattern.search(sample):
            return value_scale, label
    inferred_scale, inferred_label = _infer_statement_value_scale(section_text, lines, rows)
    if inferred_scale is not None:
        return inferred_scale, inferred_label
    return None, ""


def parse_income_statement(
    text: str,
    *,
    language_hint: str | None = None,
    quarter_hint: str | None = None,
) -> ParsedFinancialStatement:
    section_text, section_found, section_label = _slice_income_statement_text(text)
    source_text = str(text or "")
    search_text = source_text if quarter_hint else section_text
    raw_lines = _extract_normalized_lines(search_text)
    collapsed_lines = _collapse_statement_lines(search_text)
    raw_line_set = set(raw_lines)
    lines = raw_lines + [line for line in collapsed_lines if line not in raw_line_set]
    rows: dict[str, list[float]] = {}
    for canonical_name, aliases in INCOME_STATEMENT_ROW_ALIASES.items():
        values = _extract_statement_row_values(lines, aliases, quarter_hint=quarter_hint)
        if values:
            rows[canonical_name] = values
    language_profile = language_hint or detect_language_profile(section_text)
    scale_search_text = section_text or search_text
    value_scale, value_unit = _detect_statement_value_scale(scale_search_text, lines, rows)
    bn_scale = (value_scale / 1_000_000_000) if value_scale else None
    return ParsedFinancialStatement(
        version=f"{PARSER_VERSION}-income-statement-v2",
        statement_kind="income-statement",
        section_found=section_found,
        section_label=section_label,
        language_profile=language_profile,
        lines=lines,
        rows=rows,
        metadata={
            "lineCount": len(lines),
            "matchedRowCount": len(rows),
            "valueScale": value_scale,
            "valueUnit": value_unit,
            "bnScale": bn_scale,
            "quarterHint": quarter_hint or "",
            "lineSearchScope": "document" if quarter_hint else "statement-section",
        },
    )


def parse_income_statement_from_url(
    url: str,
    *,
    refresh: bool = False,
    ocr_fallback: bool = False,
    quarter_hint: str | None = None,
) -> ParsedFinancialStatement:
    try:
        parsed = parse_document_url(url, refresh=refresh, ocr_fallback=ocr_fallback)
        return parse_income_statement(parsed.text, language_hint=parsed.language_profile, quarter_hint=quarter_hint)
    except Exception as exc:
        mirrored_text = extract_text_via_jina(url, refresh=refresh)
        fallback_statement = parse_income_statement(mirrored_text, quarter_hint=quarter_hint)
        fallback_metadata = dict(fallback_statement.metadata) if isinstance(fallback_statement.metadata, dict) else {}
        fallback_metadata["fallbackUsed"] = True
        fallback_metadata["fallbackSource"] = "jina"
        fallback_metadata["fallbackReason"] = str(exc)
        return ParsedFinancialStatement(
            version=fallback_statement.version,
            statement_kind=fallback_statement.statement_kind,
            section_found=fallback_statement.section_found,
            section_label=fallback_statement.section_label,
            language_profile=fallback_statement.language_profile,
            lines=list(fallback_statement.lines),
            rows=dict(fallback_statement.rows),
            metadata=fallback_metadata,
        )


def statement_value_to_bn(value: float | int | None, statement: ParsedFinancialStatement) -> float | None:
    if value is None:
        return None
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return None
    bn_scale = statement.metadata.get("bnScale") if isinstance(statement.metadata, dict) else None
    if bn_scale is None:
        return None
    return round(numeric * float(bn_scale), 3)


def labeled_row_value_to_bn(value: float | int | None, parsed_rows: ParsedLabeledRows) -> float | None:
    if value is None:
        return None
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return None
    bn_scale = parsed_rows.metadata.get("bnScale") if isinstance(parsed_rows.metadata, dict) else None
    if bn_scale is None:
        return None
    return round(numeric * float(bn_scale), 3)


def parse_document_url(url: str, *, refresh: bool = False, ocr_fallback: bool = False) -> ParsedDocument:
    cache_path = _parsed_cache_path(url, ocr_fallback=ocr_fallback)
    if cache_path.exists() and not refresh:
        cached = _load_cached_json(cache_path)
        if _is_current_parsed_cache(cached):
            return ParsedDocument(**cached)

    response = _request_url(url)
    content_type = str(response.headers.get("content-type") or "").lower()
    final_url = str(response.url or url)
    content = response.content
    kind = "binary"
    extraction_method = "binary"
    text = ""
    page_texts: list[str] = []
    html_tables: list[list[list[str]]] = []
    metadata: dict[str, Any] = {}

    is_pdf = "application/pdf" in content_type or final_url.lower().endswith(".pdf")
    is_html = "text/html" in content_type or final_url.lower().endswith((".htm", ".html"))
    is_text = "text/plain" in content_type or final_url.lower().endswith((".txt", ".md"))

    if is_pdf:
        kind = "pdf"
        page_texts = _extract_pdf_page_texts_from_bytes(content)
        text = "\n".join(part for part in page_texts if part.strip()).strip()
        extraction_method = "pdf-text"
        metadata["pageCount"] = len(page_texts)
        if ocr_fallback and _should_try_pdf_ocr(page_texts):
            ocr_texts = _extract_pdf_image_ocr_texts(content)
            if ocr_texts:
                merged_page_texts: list[str] = []
                max_pages = max(len(page_texts), len(ocr_texts))
                for index in range(max_pages):
                    native_text = page_texts[index] if index < len(page_texts) else ""
                    ocr_text = ocr_texts[index] if index < len(ocr_texts) else ""
                    merged_page_texts.append("\n".join(part for part in [native_text, ocr_text] if part.strip()).strip())
                page_texts = merged_page_texts
                text = "\n\n".join(part for part in page_texts if part.strip()).strip()
                extraction_method = "pdf-text+image-ocr"
                metadata["ocrPageCount"] = sum(1 for item in ocr_texts if item.strip())
    elif is_html:
        kind = "html"
        html_text = _decode_text(content)
        text = _strip_html_to_text(html_text)
        html_tables = _extract_html_tables(html_text)
        extraction_method = "html-text"
        metadata["tableCount"] = len(html_tables)
        next_data_props = extract_next_data_props(html_text)
        if next_data_props:
            metadata["hasNextDataProps"] = True
    elif is_text:
        kind = "text"
        text = _decode_text(content).strip()
        extraction_method = "plain-text"

    parsed = ParsedDocument(
        version=PARSER_VERSION,
        url=url,
        final_url=final_url,
        content_type=content_type,
        kind=kind,
        extraction_method=extraction_method,
        language_profile=detect_language_profile(text),
        text=text,
        page_texts=page_texts,
        html_tables=html_tables,
        metadata=metadata,
    )
    _write_cached_json(cache_path, parsed.to_dict())
    return parsed


def extract_pdf_page_texts_from_url(url: str, *, refresh: bool = False, ocr_fallback: bool = False) -> list[str]:
    return parse_document_url(url, refresh=refresh, ocr_fallback=ocr_fallback).page_texts


def extract_pdf_text_from_url(url: str, *, refresh: bool = False, ocr_fallback: bool = False) -> str:
    parsed = parse_document_url(url, refresh=refresh, ocr_fallback=ocr_fallback)
    return parsed.text if parsed.kind == "pdf" else ""


def _jina_proxy_url(url: str) -> str:
    normalized = re.sub(r"^https?://", "", str(url or "").strip())
    return f"https://r.jina.ai/http://{normalized}"


def extract_text_via_jina(url: str, *, refresh: bool = False) -> str:
    now_ts = int(time.time())
    if not refresh:
        cached = TEXT_MIRROR_CACHE.get(url)
        if _is_current_text_mirror_cache(cached, now_ts=now_ts):
            return str(cached.get("text") or "")
        if cached is not None:
            TEXT_MIRROR_CACHE.pop(url, None)
        cache_path = _mirror_cache_path(url)
        if cache_path.exists():
            try:
                cached_payload = _load_cached_json(cache_path)
            except Exception:  # noqa: BLE001
                cached_payload = None
            if _is_current_text_mirror_cache(cached_payload, now_ts=now_ts):
                TEXT_MIRROR_CACHE[url] = cached_payload
                return str(cached_payload.get("text") or "")
    last_error: Exception | None = None
    for attempt in range(3):
        try:
            text = _request_url(_jina_proxy_url(url), accept="text/plain,*/*;q=0.8").text
            cached_payload = {
                "_cacheVersion": TEXT_MIRROR_CACHE_VERSION,
                "fetchedAt": int(time.time()),
                "text": text,
            }
            TEXT_MIRROR_CACHE[url] = cached_payload
            _write_cached_json(_mirror_cache_path(url), cached_payload)
            return text
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            if attempt >= 2:
                break
            time.sleep(1.5 * (attempt + 1))
    if last_error is not None:
        raise last_error
    raise RuntimeError(f"failed to fetch mirrored text for {url}")
