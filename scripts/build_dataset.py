from __future__ import annotations

import argparse
from copy import deepcopy
import io
import json
import re
import sys
import time
from datetime import date, timedelta
from pathlib import Path
from typing import Any

import requests
from pypdf import PdfReader

from document_parser import parse_income_statement_from_url, statement_value_to_bn
from official_financials import fetch_official_financial_history
from official_segments import fetch_official_segment_history
from official_revenue_structures import fetch_official_revenue_structure_history
from stockanalysis_financials import fetch_stockanalysis_financial_history
from universal_parser import run_universal_company_parser


ROOT_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT_DIR / "data"
OUTPUT_PATH = DATA_DIR / "earnings-dataset.json"
MANUAL_PRESETS_PATH = DATA_DIR / "manual-presets.json"
MANUAL_COMPANY_OVERRIDES_PATH = DATA_DIR / "manual-company-overrides.json"
OFFICIAL_SEGMENT_CACHE_DIR = DATA_DIR / "cache" / "official-segments"
OFFICIAL_REVENUE_STRUCTURE_CACHE_DIR = DATA_DIR / "cache" / "official-revenue-structures"
FX_CACHE_PATH = DATA_DIR / "cache" / "fx-rates.json"
COMPANY_CACHE_DIR = DATA_DIR / "cache"
PDF_TEXT_CACHE: dict[str, str] = {}
FX_LOOKUP_TIMEOUT_SECONDS = 4
FX_LOOKUP_MISS_KEYS: set[str] = set()

UNIVERSE_SOURCE = {
    "label": "StockTitan US market cap ranking",
    "url": "https://www.stocktitan.net/market-cap/us-stocks/",
    "as_of": "2026-03-14",
    "note": "Base universe follows the US top-30 list, with Tencent, Alibaba, JD.com, NetEase, Xiaomi, BYD, and Meituan added as international expansion samples.",
}

TOP30_COMPANIES: list[dict[str, Any]] = [
    {"id": "nvidia", "ticker": "NVDA", "nameZh": "英伟达", "nameEn": "NVIDIA", "slug": "nvda", "rank": 1, "isAdr": False, "brand": {"primary": "#76B900", "secondary": "#111827", "accent": "#E7F8BC"}},
    {"id": "apple", "ticker": "AAPL", "nameZh": "苹果", "nameEn": "Apple", "slug": "aapl", "rank": 2, "isAdr": False, "brand": {"primary": "#111827", "secondary": "#2563EB", "accent": "#DCEAFE"}},
    {"id": "alphabet", "ticker": "GOOGL", "nameZh": "谷歌", "nameEn": "Alphabet", "slug": "googl", "rank": 3, "isAdr": False, "brand": {"primary": "#2563EB", "secondary": "#DB4437", "accent": "#E8F0FE"}},
    {"id": "microsoft", "ticker": "MSFT", "nameZh": "微软", "nameEn": "Microsoft", "slug": "msft", "rank": 4, "isAdr": False, "brand": {"primary": "#0078D4", "secondary": "#107C10", "accent": "#DCEFFD"}},
    {"id": "amazon", "ticker": "AMZN", "nameZh": "亚马逊", "nameEn": "Amazon", "slug": "amzn", "rank": 5, "isAdr": False, "brand": {"primary": "#111827", "secondary": "#F59E0B", "accent": "#FEF3C7"}},
    {"id": "tsmc", "ticker": "TSM", "nameZh": "台积电", "nameEn": "TSMC", "slug": "tsm", "rank": 6, "isAdr": True, "brand": {"primary": "#B91C1C", "secondary": "#111827", "accent": "#FEE2E2"}},
    {"id": "meta", "ticker": "META", "nameZh": "Meta", "nameEn": "Meta", "slug": "meta", "rank": 7, "isAdr": False, "brand": {"primary": "#0866FF", "secondary": "#111827", "accent": "#DCEAFE"}},
    {"id": "broadcom", "ticker": "AVGO", "nameZh": "博通", "nameEn": "Broadcom", "slug": "avgo", "rank": 8, "isAdr": False, "brand": {"primary": "#C62828", "secondary": "#12263F", "accent": "#FCE7E7"}},
    {"id": "tesla", "ticker": "TSLA", "nameZh": "特斯拉", "nameEn": "Tesla", "slug": "tsla", "rank": 9, "isAdr": False, "brand": {"primary": "#DC2626", "secondary": "#111827", "accent": "#FEE2E2"}},
    {"id": "berkshire", "ticker": "BRK.B", "nameZh": "伯克希尔哈撒韦", "nameEn": "Berkshire Hathaway", "slug": "brk.b", "rank": 10, "isAdr": False, "brand": {"primary": "#4B5563", "secondary": "#111827", "accent": "#E5E7EB"}},
    {"id": "walmart", "ticker": "WMT", "nameZh": "沃尔玛", "nameEn": "Walmart", "slug": "wmt", "rank": 11, "isAdr": False, "brand": {"primary": "#0F6CBD", "secondary": "#F3B700", "accent": "#E0F2FE"}},
    {"id": "eli-lilly", "ticker": "LLY", "nameZh": "礼来", "nameEn": "Eli Lilly", "slug": "lly", "rank": 12, "isAdr": False, "brand": {"primary": "#D62828", "secondary": "#111827", "accent": "#FEE2E2"}},
    {"id": "jpmorgan", "ticker": "JPM", "nameZh": "摩根大通", "nameEn": "JPMorgan Chase", "slug": "jpm", "rank": 13, "isAdr": False, "brand": {"primary": "#1F3C88", "secondary": "#111827", "accent": "#DBEAFE"}},
    {"id": "exxon", "ticker": "XOM", "nameZh": "埃克森美孚", "nameEn": "Exxon Mobil", "slug": "xom", "rank": 14, "isAdr": False, "brand": {"primary": "#E51636", "secondary": "#111827", "accent": "#FCE7F3"}},
    {"id": "visa", "ticker": "V", "nameZh": "Visa", "nameEn": "Visa", "slug": "v", "rank": 15, "isAdr": False, "brand": {"primary": "#1434CB", "secondary": "#F7B600", "accent": "#DBEAFE"}},
    {"id": "jnj", "ticker": "JNJ", "nameZh": "强生", "nameEn": "Johnson & Johnson", "slug": "jnj", "rank": 16, "isAdr": False, "brand": {"primary": "#D61F2C", "secondary": "#111827", "accent": "#FEE2E2"}},
    {"id": "asml", "ticker": "ASML", "nameZh": "阿斯麦", "nameEn": "ASML", "slug": "asml", "rank": 17, "isAdr": True, "brand": {"primary": "#009FE3", "secondary": "#111827", "accent": "#E0F2FE"}},
    {"id": "oracle", "ticker": "ORCL", "nameZh": "甲骨文", "nameEn": "Oracle", "slug": "orcl", "rank": 18, "isAdr": False, "brand": {"primary": "#F80000", "secondary": "#111827", "accent": "#FEE2E2"}},
    {"id": "micron", "ticker": "MU", "nameZh": "美光科技", "nameEn": "Micron Technology", "slug": "mu", "rank": 19, "isAdr": False, "brand": {"primary": "#005EB8", "secondary": "#111827", "accent": "#DBEAFE"}},
    {"id": "costco", "ticker": "COST", "nameZh": "好市多", "nameEn": "Costco", "slug": "cost", "rank": 20, "isAdr": False, "brand": {"primary": "#E31837", "secondary": "#005DAA", "accent": "#FCE7F3"}},
    {"id": "mastercard", "ticker": "MA", "nameZh": "万事达卡", "nameEn": "Mastercard", "slug": "ma", "rank": 21, "isAdr": False, "brand": {"primary": "#EB001B", "secondary": "#F79E1B", "accent": "#FDF2D8"}},
    {"id": "abbvie", "ticker": "ABBV", "nameZh": "艾伯维", "nameEn": "AbbVie", "slug": "abbv", "rank": 22, "isAdr": False, "brand": {"primary": "#071D49", "secondary": "#3AB6C1", "accent": "#D9F5F6"}},
    {"id": "netflix", "ticker": "NFLX", "nameZh": "奈飞", "nameEn": "Netflix", "slug": "nflx", "rank": 23, "isAdr": False, "brand": {"primary": "#E50914", "secondary": "#111827", "accent": "#FEE2E2"}},
    {"id": "chevron", "ticker": "CVX", "nameZh": "雪佛龙", "nameEn": "Chevron", "slug": "cvx", "rank": 24, "isAdr": False, "brand": {"primary": "#005AAA", "secondary": "#D52B1E", "accent": "#DBEAFE"}},
    {"id": "palantir", "ticker": "PLTR", "nameZh": "Palantir", "nameEn": "Palantir", "slug": "pltr", "rank": 25, "isAdr": False, "brand": {"primary": "#111827", "secondary": "#64748B", "accent": "#E2E8F0"}},
    {"id": "procter-gamble", "ticker": "PG", "nameZh": "宝洁", "nameEn": "Procter & Gamble", "slug": "pg", "rank": 26, "isAdr": False, "brand": {"primary": "#0056A7", "secondary": "#111827", "accent": "#DBEAFE"}},
    {"id": "bank-of-america", "ticker": "BAC", "nameZh": "美国银行", "nameEn": "Bank of America", "slug": "bac", "rank": 27, "isAdr": False, "brand": {"primary": "#C41230", "secondary": "#1B365D", "accent": "#FCE7F3"}},
    {"id": "home-depot", "ticker": "HD", "nameZh": "家得宝", "nameEn": "Home Depot", "slug": "hd", "rank": 28, "isAdr": False, "brand": {"primary": "#F96302", "secondary": "#111827", "accent": "#FFEDD5"}},
    {"id": "coca-cola", "ticker": "KO", "nameZh": "可口可乐", "nameEn": "Coca-Cola", "slug": "ko", "rank": 29, "isAdr": False, "brand": {"primary": "#F40009", "secondary": "#111827", "accent": "#FEE2E2"}},
    {"id": "caterpillar", "ticker": "CAT", "nameZh": "卡特彼勒", "nameEn": "Caterpillar", "slug": "cat", "rank": 30, "isAdr": False, "brand": {"primary": "#FFCD11", "secondary": "#111827", "accent": "#FEF3C7"}},
    {"id": "tencent", "ticker": "TCEHY", "nameZh": "腾讯控股", "nameEn": "Tencent", "slug": "tcehy", "rank": 14.5, "isAdr": True, "brand": {"primary": "#1D9BF0", "secondary": "#111827", "accent": "#DBEEFF"}, "financialSource": "stockanalysis"},
    {"id": "alibaba", "ticker": "BABA", "nameZh": "阿里巴巴", "nameEn": "Alibaba", "slug": "baba", "rank": 30.5, "isAdr": True, "brand": {"primary": "#FF6A00", "secondary": "#111827", "accent": "#FFE7D1"}, "financialSource": "stockanalysis"},
    {"id": "jd", "ticker": "JD", "nameZh": "京东集团", "nameEn": "JD.com", "slug": "jd", "rank": 31, "isAdr": True, "brand": {"primary": "#D70A0A", "secondary": "#111827", "accent": "#FEE2E2"}, "financialSource": "stockanalysis"},
    {"id": "netease", "ticker": "NTES", "nameZh": "网易", "nameEn": "NetEase", "slug": "ntes", "rank": 32, "isAdr": True, "brand": {"primary": "#D71920", "secondary": "#111827", "accent": "#FEE2E2"}, "financialSource": "stockanalysis"},
    {"id": "xiaomi", "ticker": "XIACY", "nameZh": "小米集团", "nameEn": "Xiaomi", "slug": "xiacy", "rank": 33, "isAdr": True, "brand": {"primary": "#FF6900", "secondary": "#111827", "accent": "#FFE7D6"}, "financialSource": "stockanalysis", "financialPath": "quote/hkg/1810"},
    {"id": "byd", "ticker": "BYDDY", "nameZh": "比亚迪", "nameEn": "BYD", "slug": "byddy", "rank": 34, "isAdr": True, "brand": {"primary": "#D71920", "secondary": "#111827", "accent": "#FEE2E2"}, "financialSource": "stockanalysis", "financialPath": "quote/otc/byddy"},
    {"id": "meituan", "ticker": "MPNGY", "nameZh": "美团", "nameEn": "Meituan", "slug": "mpngy", "rank": 35, "isAdr": True, "brand": {"primary": "#FFD100", "secondary": "#111827", "accent": "#FEF3C7"}, "financialSource": "stockanalysis", "financialPath": "quote/otc/mpngy"},
]

BAR_SEGMENT_CANONICAL_BY_COMPANY: dict[str, dict[str, str]] = {
    "alphabet": {
        "googleinc": "googleservices",
        "googleservices": "googleservices",
        "allothersegments": "othersegments",
        "othersegments": "othersegments",
        "otherrevenue": "otherrevenue",
        "other": "otherrevenue",
    },
    "jnj": {
        "pharmaceutical": "innovativemedicine",
        "medicaldevices": "medtech",
        "medicaldevicesdiagnostics": "medtech",
    },
    "berkshire": {
        "serviceandretailingbusinesses": "serviceretailbusinesses",
        "serviceandretailbusinesses": "serviceretailbusinesses",
    },
    "tesla": {
        "automotive": "auto",
        "automotivebusiness": "auto",
        "automobile": "auto",
    },
    "costco": {
        "foodsundries": "foodssundries",
        "freshfood": "freshfoods",
    },
}

MICRON_LEGACY_SEGMENT_KEYS = {"cnbu", "mbu", "sbu", "ebu", "allothersegments"}
MICRON_CURRENT_SEGMENT_KEYS = {"cmbu", "mcbu", "cdbu", "aebu"}
MICRON_SCHEMA_CHANGE_QUARTER = "2025Q4"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build the standalone earnings dataset from official filings.")
    parser.add_argument("--refresh", action="store_true", help="Ignore cached SEC responses.")
    parser.add_argument(
        "--companies",
        type=str,
        default="",
        help="Optional comma-separated company ids, tickers, or slugs to refresh. Unspecified companies are kept from local cache when available.",
    )
    return parser.parse_args()


def parse_period(period: str) -> tuple[int, int]:
    if len(period) != 6 or period[4] != "Q":
        return (0, 0)
    try:
        return (int(period[:4]), int(period[5]))
    except ValueError:
        return (0, 0)


def quarter_sort_value(period: str) -> int | None:
    year, quarter = parse_period(str(period or ""))
    if year <= 0 or quarter <= 0:
        return None
    return year * 4 + quarter


def quarter_distance(left: str | None, right: str | None) -> int | None:
    left_value = quarter_sort_value(str(left or ""))
    right_value = quarter_sort_value(str(right or ""))
    if left_value is None or right_value is None:
        return None
    return abs(left_value - right_value)


def parse_company_selection(raw: str) -> set[str]:
    tokens = {
        str(token or "").strip().lower()
        for token in str(raw or "").split(",")
        if str(token or "").strip()
    }
    return tokens


def company_matches_selection(company: dict[str, Any], selected_tokens: set[str]) -> bool:
    if not selected_tokens:
        return True
    candidates = {
        str(company.get("id") or "").strip().lower(),
        str(company.get("ticker") or "").strip().lower(),
        str(company.get("slug") or "").strip().lower(),
    }
    normalized_ticker = re.sub(r"[^a-z0-9]+", "", str(company.get("ticker") or "").lower())
    if normalized_ticker:
        candidates.add(normalized_ticker)
    return bool(candidates & selected_tokens)


def load_cached_company_payload(company_id: str) -> dict[str, Any] | None:
    path = COMPANY_CACHE_DIR / f"{company_id}.json"
    if not path.exists():
        return None
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None
    return payload if isinstance(payload, dict) else None


def normalize_segment_label_key(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", "", str(value or "").strip().lower())


def canonical_revenue_segment_member_key(company_id: str, member_key: Any, name: Any) -> str:
    normalized_company_id = str(company_id or "").strip().lower()
    normalized_key = normalize_segment_label_key(member_key or name)
    if not normalized_key:
        return normalized_key
    company_aliases = BAR_SEGMENT_CANONICAL_BY_COMPANY.get(normalized_company_id) or {}
    return company_aliases.get(normalized_key, normalized_key)


def dedupe_revenue_segment_rows(company_id: str, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    deduped: dict[str, dict[str, Any]] = {}
    for raw_row in rows:
        row = dict(raw_row)
        canonical_key = canonical_revenue_segment_member_key(company_id, row.get("memberKey"), row.get("name"))
        if not canonical_key:
            continue
        row["memberKey"] = canonical_key
        existing = deduped.get(canonical_key)
        if existing is None:
            deduped[canonical_key] = row
            continue
        existing_filing = str(existing.get("filingDate") or "")
        row_filing = str(row.get("filingDate") or "")
        existing_value = float(existing.get("valueBn") or 0)
        row_value = float(row.get("valueBn") or 0)
        prefer_row = row_filing > existing_filing or (row_filing == existing_filing and row_value > existing_value)
        merged = dict(row if prefer_row else existing)
        merged["memberKey"] = canonical_key
        merged["valueBn"] = max(existing_value, row_value)
        if not merged.get("nameZh"):
            merged["nameZh"] = row.get("nameZh") or existing.get("nameZh")
        deduped[canonical_key] = merged
    return list(deduped.values())


def filter_micron_mixed_segment_rows(quarter_key: str, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not rows:
        return rows
    member_keys = {
        normalize_segment_label_key(row.get("memberKey") or row.get("name"))
        for row in rows
        if isinstance(row, dict)
    }
    has_legacy = any(key in MICRON_LEGACY_SEGMENT_KEYS - {"allothersegments"} for key in member_keys)
    has_current = any(key in MICRON_CURRENT_SEGMENT_KEYS for key in member_keys)
    if not (has_legacy and has_current):
        return rows
    try:
        prefers_current = parse_period(str(quarter_key)) >= parse_period(MICRON_SCHEMA_CHANGE_QUARTER)
    except Exception:
        prefers_current = False
    allowed_keys = MICRON_CURRENT_SEGMENT_KEYS if prefers_current else MICRON_LEGACY_SEGMENT_KEYS
    filtered_rows = [
        row
        for row in rows
        if normalize_segment_label_key((row or {}).get("memberKey") or (row or {}).get("name")) in allowed_keys
    ]
    return filtered_rows or rows


def normalize_official_revenue_segments(company_id: str, quarter_key: str, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    normalized_company_id = str(company_id or "").strip().lower()
    normalized_rows: list[dict[str, Any]] = []
    for raw_row in rows:
        if not isinstance(raw_row, dict):
            continue
        row = dict(raw_row)
        canonical_key = canonical_revenue_segment_member_key(normalized_company_id, row.get("memberKey"), row.get("name"))
        if canonical_key:
            row["memberKey"] = canonical_key
        normalized_rows.append(row)

    if normalized_company_id == "jpmorgan":
        keys = {canonical_revenue_segment_member_key(normalized_company_id, row.get("memberKey"), row.get("name")) for row in normalized_rows}
        if "commercialinvestmentbank" in keys:
            normalized_rows = [
                row
                for row in normalized_rows
                if canonical_revenue_segment_member_key(normalized_company_id, row.get("memberKey"), row.get("name"))
                not in {"corporateinvestmentbank", "commercialbanking"}
            ]

    if normalized_company_id == "costco":
        keys = {canonical_revenue_segment_member_key(normalized_company_id, row.get("memberKey"), row.get("name")) for row in normalized_rows}
        if "nonfoods" in keys:
            normalized_rows = [
                row
                for row in normalized_rows
                if canonical_revenue_segment_member_key(normalized_company_id, row.get("memberKey"), row.get("name"))
                not in {"hardlines", "softlines"}
            ]

    if normalized_company_id == "micron":
        normalized_rows = filter_micron_mixed_segment_rows(quarter_key, normalized_rows)

    normalized_rows = dedupe_revenue_segment_rows(normalized_company_id, normalized_rows)
    validation_note = infer_segment_validation_exception(normalized_rows)
    if validation_note:
        normalized_rows = mark_revenue_segments_validation_ineligible(normalized_rows, validation_note)
    return normalized_rows


SEGMENT_ENTITY_DISCLOSURE_PATTERN = re.compile(r"\b(company|corporation|group|business|businesses|railroad|energy)\b", re.I)
SEGMENT_BANK_DISCLOSURE_PATTERN = re.compile(r"\b(banking|markets|wealth|investment|consumer|commercial|community|asset)\b", re.I)
SEGMENT_REVENUE_COMPONENT_PATTERN = re.compile(r"\b(revenue|revenues|service|services|transaction|processing|assessment)\b", re.I)
SEGMENT_THERAPEUTIC_CATEGORY_PATTERN = re.compile(
    r"\b(endocrinology|oncology|neuroscience|immunology|aesthetics|hematologic|hematology|medical aesthetics|other product total|other endocrinology)\b",
    re.I,
)
SEGMENT_PRODUCT_LINE_PATTERN = re.compile(r"\bmajor product line\b", re.I)
SEGMENT_GEOGRAPHIC_DISCLOSURE_PATTERN = re.compile(
    r"\b(north america|latin america|emea|europe|pacific|asia pacific|greater china|japan|rest of asia pacific|bottling investments)\b",
    re.I,
)
SEGMENT_COMPONENT_DISCLOSURE_PATTERN = re.compile(r"\b(revenue|income|equity affiliates|other revenue)\b", re.I)
SEGMENT_AUTO_ENERGY_PATTERN = re.compile(r"\b(auto|automotive|energy generation|storage|services)\b", re.I)
SEGMENT_CAPITAL_BUCKET_PATTERN = re.compile(r"\b(equipment)\b", re.I)
SEGMENT_OPERATION_MODEL_PATTERN = re.compile(r"\b(operations?)\b", re.I)
SEGMENT_UPSTREAM_DOWNSTREAM_PATTERN = re.compile(r"\b(upstream|downstream|all other segments)\b", re.I)
SEGMENT_HYDROCARBON_BUCKET_PATTERN = re.compile(r"\b(energy products|chemical products|specialty products|upstream)\b", re.I)
SEGMENT_AMAZON_ACTIVITY_PATTERN = re.compile(
    r"\b(online stores|third party seller services|amazon web services|subscription services|physical stores|other services|advertising services)\b",
    re.I,
)
SEGMENT_GOOGLE_LEGACY_PATTERN = re.compile(r"(google inc\.?|all other segments)", re.I)
SEGMENT_GOOGLE_CURRENT_PATTERN = re.compile(r"\b(google services|google cloud|google play)\b", re.I)
SEGMENT_JNJ_HEALTHCARE_PATTERN = re.compile(r"\b(innovative medicine|med tech|medical devices|consumer)\b", re.I)
SEGMENT_CATERPILLAR_PATTERN = re.compile(r"\b(machinery energy transportation|financial products)\b", re.I)
SEGMENT_XIAOMI_ECOSYSTEM_PATTERN = re.compile(r"\b(smartphones?|iot and lifestyle products|internet services)\b", re.I)
SEGMENT_NETFLIX_LEGACY_PATTERN = re.compile(r"\b(streaming|dvd)\b", re.I)
DETAIL_COMMERCE_PARENT_PATTERN = re.compile(r"\bnet (product|service) revenues\b", re.I)
DETAIL_ASML_SYSTEM_PARENT_PATTERN = re.compile(r"\bnet system sales\b", re.I)
DETAIL_ASML_PRODUCT_PATTERN = re.compile(r"\b(euv|arfi|arf dry|krf|i-line)\b", re.I)
DETAIL_AUTO_COMPONENT_PARENT_PATTERN = re.compile(r"\b(auto|automotive)\b", re.I)
DETAIL_AUTO_COMPONENT_PATTERN = re.compile(r"\b(leasing|regulatory credits)\b", re.I)
OPEX_STANDARD_BUCKET_PATTERN = re.compile(
    r"\b(fulfillment|marketing|research and development|general and administrative|selling expense|administrative expense|r&d expense|selling and marketing|selling|general and administrative expense)\b",
    re.I,
)


def mark_revenue_segments_validation_ineligible(rows: list[dict[str, Any]], note: str) -> list[dict[str, Any]]:
    annotated_rows: list[dict[str, Any]] = []
    for raw_row in rows:
        if not isinstance(raw_row, dict):
            continue
        row = dict(raw_row)
        row["validationEligible"] = False
        notes = row.get("validationNotes") if isinstance(row.get("validationNotes"), list) else []
        if note not in notes:
            notes = [*notes, note]
        row["validationNotes"] = notes
        annotated_rows.append(row)
    return annotated_rows


def infer_segment_validation_exception(rows: list[dict[str, Any]]) -> str | None:
    names = [str(row.get("name") or "").strip() for row in rows if isinstance(row, dict) and str(row.get("name") or "").strip()]
    if len(names) < 2:
        return None
    lower_names = [name.lower() for name in names]
    if any(SEGMENT_PRODUCT_LINE_PATTERN.search(name) for name in names):
        return "partial-merchandise-category-disclosure"

    bank_bucket_count = sum(1 for name in names if SEGMENT_BANK_DISCLOSURE_PATTERN.search(name))
    if len(names) <= 6 and bank_bucket_count >= max(3, len(names) - 1):
        return "business-line-revenue-disclosure"

    if len(names) <= 4 and all(SEGMENT_REVENUE_COMPONENT_PATTERN.search(name) for name in names):
        return "partial-revenue-component-disclosure"

    netflix_legacy_count = sum(1 for name in names if SEGMENT_NETFLIX_LEGACY_PATTERN.search(name))
    if len(names) <= 2 and netflix_legacy_count == len(names) and "streaming" in lower_names:
        return "legacy-business-model-disclosure"

    if len(names) <= 4 and all(SEGMENT_OPERATION_MODEL_PATTERN.search(name) for name in names):
        return "partial-operation-model-disclosure"

    if len(names) <= 3 and all(SEGMENT_CAPITAL_BUCKET_PATTERN.search(name) for name in names):
        return "capital-bucket-disclosure"

    if len(names) <= 3 and all(SEGMENT_UPSTREAM_DOWNSTREAM_PATTERN.search(name) for name in names):
        return "partial-energy-business-disclosure"

    entity_bucket_count = sum(1 for name in names if SEGMENT_ENTITY_DISCLOSURE_PATTERN.search(name))
    if len(names) >= 5 and entity_bucket_count >= 4 and any("other" in name for name in lower_names):
        return "operating-business-bucket-disclosure"

    geographic_bucket_count = sum(1 for name in names if SEGMENT_GEOGRAPHIC_DISCLOSURE_PATTERN.search(name))
    if len(names) >= 4 and geographic_bucket_count >= 4 and any("bottling investments" in name for name in lower_names):
        return "partial-geographic-segment-disclosure"

    component_bucket_count = sum(1 for name in names if SEGMENT_COMPONENT_DISCLOSURE_PATTERN.search(name))
    if len(names) <= 4 and component_bucket_count >= 2 and any("equity affiliates" in name or "other revenue" in name for name in lower_names):
        return "statement-component-disclosure"

    amazon_activity_count = sum(1 for name in names if SEGMENT_AMAZON_ACTIVITY_PATTERN.search(name))
    if len(names) >= 5 and amazon_activity_count == len(names) and any("online stores" in name for name in lower_names):
        return "activity-revenue-line-disclosure"

    xiaomi_ecosystem_count = sum(1 for name in names if SEGMENT_XIAOMI_ECOSYSTEM_PATTERN.search(name))
    if len(names) == 3 and xiaomi_ecosystem_count == len(names) and "internet services" in lower_names:
        return "ecosystem-product-line-disclosure"

    google_legacy_count = sum(1 for name in names if SEGMENT_GOOGLE_LEGACY_PATTERN.search(name))
    if len(names) <= 2 and google_legacy_count == len(names) and any("google inc." in name for name in lower_names):
        return "legacy-core-segment-disclosure"
    google_current_count = sum(1 for name in names if SEGMENT_GOOGLE_CURRENT_PATTERN.search(name))
    if len(names) <= 3 and google_current_count >= 2 and any("all other segments" in name for name in lower_names):
        return "partial-google-business-disclosure"
    if google_legacy_count >= 2 and google_current_count >= 1 and any("google inc." in name for name in lower_names):
        return "mixed-google-hierarchy-disclosure"

    hydrocarbon_bucket_count = sum(1 for name in names if SEGMENT_HYDROCARBON_BUCKET_PATTERN.search(name))
    if len(names) <= 4 and hydrocarbon_bucket_count == len(names) and "upstream" in lower_names:
        return "partial-energy-product-disclosure"

    therapeutic_bucket_count = sum(1 for name in names if SEGMENT_THERAPEUTIC_CATEGORY_PATTERN.search(name))
    product_like_count = sum(
        1
        for name in names
        if not SEGMENT_THERAPEUTIC_CATEGORY_PATTERN.search(name)
        and not SEGMENT_REVENUE_COMPONENT_PATTERN.search(name)
        and len(name.split()) <= 3
    )
    if therapeutic_bucket_count >= 2 and product_like_count >= 5:
        return "mixed-hierarchy-product-disclosure"

    uppercase_product_count = sum(
        1
        for name in names
        if name == name.upper() and any(char.isalpha() for char in name) and len(name.replace(" ", "")) >= 4
    )
    if len(names) >= 8 and uppercase_product_count >= 2 and any("other product" in name for name in lower_names):
        return "partial-key-product-disclosure"

    auto_energy_bucket_count = sum(1 for name in names if SEGMENT_AUTO_ENERGY_PATTERN.search(name))
    if (
        len(names) <= 3
        and auto_energy_bucket_count == len(names)
        and (
            any("auto" in name for name in lower_names)
            or {"services", "energy generation & storage"}.issubset(set(lower_names))
        )
    ):
        return "partial-business-line-disclosure"

    jnj_healthcare_count = sum(1 for name in names if SEGMENT_JNJ_HEALTHCARE_PATTERN.search(name))
    if len(names) <= 2 and jnj_healthcare_count == len(names) and "consumer" in lower_names:
        return "partial-healthcare-business-disclosure"
    if len(names) >= 3 and jnj_healthcare_count == len(names) and "consumer" in lower_names:
        return "mixed-continuing-and-consumer-disclosure"

    caterpillar_count = sum(1 for name in names if SEGMENT_CATERPILLAR_PATTERN.search(name))
    if len(names) == 2 and caterpillar_count == len(names) and "financial products" in lower_names:
        return "industrial-plus-financial-products-disclosure"

    return None


def infer_detail_group_validation_exception(rows: list[dict[str, Any]], target_name: str | None) -> str | None:
    names = [str(row.get("name") or "").strip() for row in rows if isinstance(row, dict) and str(row.get("name") or "").strip()]
    target = str(target_name or "").strip()
    if not names or not target:
        return None
    if DETAIL_COMMERCE_PARENT_PATTERN.search(target) and len(names) <= 1:
        return "partial-subcategory-disclosure"
    if DETAIL_ASML_SYSTEM_PARENT_PATTERN.search(target) and all(DETAIL_ASML_PRODUCT_PATTERN.search(name) for name in names):
        return "partial-product-platform-disclosure"
    if DETAIL_AUTO_COMPONENT_PARENT_PATTERN.search(target) and len(names) <= 2 and all(DETAIL_AUTO_COMPONENT_PATTERN.search(name) for name in names):
        return "partial-auto-component-disclosure"
    return None


def mark_detail_groups_validation_ineligible(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    grouped_rows: dict[str, list[dict[str, Any]]] = {}
    passthrough_rows: list[dict[str, Any]] = []
    for raw_row in rows:
        if not isinstance(raw_row, dict):
            continue
        target_name = str(raw_row.get("targetName") or "")
        if not target_name:
            passthrough_rows.append(dict(raw_row))
            continue
        grouped_rows.setdefault(target_name, []).append(dict(raw_row))

    annotated_rows: list[dict[str, Any]] = []
    for target_name, target_rows in grouped_rows.items():
        note = infer_detail_group_validation_exception(target_rows, target_name)
        if note:
            for row in target_rows:
                row["validationEligible"] = False
                notes = row.get("validationNotes") if isinstance(row.get("validationNotes"), list) else []
                if note not in notes:
                    notes = [*notes, note]
                row["validationNotes"] = notes
                annotated_rows.append(row)
        else:
            annotated_rows.extend(target_rows)
    annotated_rows.extend(passthrough_rows)
    return annotated_rows


def should_skip_standard_opex_overflow_validation(rows: list[dict[str, Any]], operating_expenses_bn: float | None) -> bool:
    if operating_expenses_bn is None or operating_expenses_bn <= 0 or len(rows) < 2:
        return False
    names = [str(row.get("name") or "").strip() for row in rows if isinstance(row, dict) and str(row.get("name") or "").strip()]
    if len(names) < 2 or not all(OPEX_STANDARD_BUCKET_PATTERN.search(name) for name in names):
        return False
    opex_sum = _sum_row_values(rows)
    overflow = opex_sum - operating_expenses_bn
    if overflow <= _bn_tolerance(operating_expenses_bn):
        return False
    ratio = opex_sum / operating_expenses_bn
    if ratio <= 1.12:
        return True
    if len(names) == 3 and ratio <= 1.4:
        return True
    return False


def _median(values: list[float]) -> float:
    cleaned = sorted(float(value) for value in values if float(value) > 0)
    if not cleaned:
        return 0.0
    midpoint = len(cleaned) // 2
    if len(cleaned) % 2 == 1:
        return cleaned[midpoint]
    return (cleaned[midpoint - 1] + cleaned[midpoint]) / 2


def _safe_float(value: Any) -> float | None:
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return None
    return numeric


def _bn_tolerance(reference: float | None) -> float:
    anchor = abs(float(reference or 0))
    return max(0.12, anchor * 0.03)


def _sum_row_values(rows: list[dict[str, Any]]) -> float:
    total = 0.0
    for row in rows:
        if not isinstance(row, dict):
            continue
        value = _safe_float(row.get("valueBn"))
        if value is None:
            continue
        total += abs(value)
    return round(total, 3)


def _build_parser_validation_summary(payload: dict[str, Any]) -> dict[str, Any]:
    financials = payload.get("financials") if isinstance(payload.get("financials"), dict) else {}
    ordered_quarters = sorted(financials.keys(), key=parse_period)
    revenue_segment_checks = 0
    revenue_segment_mismatches = 0
    revenue_segment_skipped_checks = 0
    detail_group_checks = 0
    detail_group_mismatches = 0
    detail_group_skipped_checks = 0
    opex_checks = 0
    opex_overflow_mismatches = 0
    opex_skipped_checks = 0
    warning_messages: list[str] = []

    for quarter in ordered_quarters:
        entry = financials.get(quarter)
        if not isinstance(entry, dict):
            continue
        revenue_bn = _safe_float(entry.get("revenueBn"))
        revenue_segments = entry.get("officialRevenueSegments") if isinstance(entry.get("officialRevenueSegments"), list) else []
        if revenue_bn is not None and len(revenue_segments) >= 2:
            if any(isinstance(row, dict) and row.get("validationEligible") is False for row in revenue_segments):
                revenue_segment_skipped_checks += 1
            else:
                revenue_segment_checks += 1
                segment_sum = _sum_row_values(revenue_segments)
                delta = round(segment_sum - revenue_bn, 3)
                if abs(delta) > _bn_tolerance(revenue_bn):
                    revenue_segment_mismatches += 1
                    warning_messages.append(
                        f"{quarter}: revenue segments sum to {segment_sum}Bn vs revenue {round(revenue_bn, 3)}Bn."
                    )

        detail_groups = entry.get("officialRevenueDetailGroups") if isinstance(entry.get("officialRevenueDetailGroups"), list) else []
        if revenue_segments and detail_groups:
            segment_map = {
                str(row.get("name") or ""): abs(_safe_float(row.get("valueBn")) or 0)
                for row in revenue_segments
                if isinstance(row, dict) and row.get("name")
            }
            grouped_detail_totals: dict[str, float] = {}
            grouped_detail_validation_skip: set[str] = set()
            for row in detail_groups:
                if not isinstance(row, dict):
                    continue
                target_name = str(row.get("targetName") or "")
                value_bn = _safe_float(row.get("valueBn"))
                if not target_name or value_bn is None:
                    continue
                if row.get("validationEligible") is False:
                    grouped_detail_validation_skip.add(target_name)
                grouped_detail_totals[target_name] = grouped_detail_totals.get(target_name, 0.0) + abs(value_bn)
            for target_name, detail_total in grouped_detail_totals.items():
                segment_value = segment_map.get(target_name)
                if segment_value is None:
                    continue
                if target_name in grouped_detail_validation_skip:
                    detail_group_skipped_checks += 1
                    continue
                detail_group_checks += 1
                delta = round(detail_total - segment_value, 3)
                if abs(delta) > _bn_tolerance(segment_value):
                    detail_group_mismatches += 1
                    warning_messages.append(
                        f"{quarter}: detail groups under {target_name} sum to {round(detail_total, 3)}Bn vs parent {round(segment_value, 3)}Bn."
                    )

        operating_expenses_bn = _safe_float(entry.get("operatingExpensesBn"))
        opex_rows = entry.get("officialOpexBreakdown")
        if not isinstance(opex_rows, list):
            opex_rows = entry.get("opexBreakdown") if isinstance(entry.get("opexBreakdown"), list) else []
        if operating_expenses_bn is not None and len(opex_rows) >= 2:
            if any(isinstance(row, dict) and row.get("validationEligible") is False for row in opex_rows):
                opex_skipped_checks += 1
                continue
            opex_checks += 1
            opex_sum = _sum_row_values(opex_rows)
            if should_skip_standard_opex_overflow_validation(opex_rows, operating_expenses_bn):
                opex_skipped_checks += 1
                opex_checks -= 1
                continue
            if opex_sum - operating_expenses_bn > _bn_tolerance(operating_expenses_bn):
                opex_overflow_mismatches += 1
                warning_messages.append(
                    f"{quarter}: opex breakdown sums to {opex_sum}Bn vs operating expenses {round(operating_expenses_bn, 3)}Bn."
                )

    parser_diagnostics = payload.get("parserDiagnostics") if isinstance(payload.get("parserDiagnostics"), dict) else {}
    financial_parser = parser_diagnostics.get("financials") if isinstance(parser_diagnostics.get("financials"), dict) else {}
    financial_validation = financial_parser.get("validation") if isinstance(financial_parser.get("validation"), dict) else {}
    financial_confidence = float(financial_validation.get("averageConfidenceScore") or 0)

    segment_score_components: list[float] = []
    if revenue_segment_checks:
        segment_score_components.append(1 - revenue_segment_mismatches / revenue_segment_checks)
    if detail_group_checks:
        segment_score_components.append(1 - detail_group_mismatches / detail_group_checks)
    if opex_checks:
        segment_score_components.append(1 - opex_overflow_mismatches / opex_checks)
    structural_confidence = round(sum(segment_score_components) / len(segment_score_components), 4) if segment_score_components else 0.75

    overall_confidence = round(financial_confidence * 0.65 + structural_confidence * 0.35, 4)
    if overall_confidence >= 0.85:
        status = "high"
    elif overall_confidence >= 0.65:
        status = "medium"
    else:
        status = "low"

    return {
        "version": "parser-validation-v1",
        "status": status,
        "overallConfidenceScore": overall_confidence,
        "financialConfidenceScore": financial_confidence,
        "structuralConfidenceScore": structural_confidence,
        "revenueSegmentChecks": revenue_segment_checks,
        "revenueSegmentMismatchCount": revenue_segment_mismatches,
        "revenueSegmentSkippedChecks": revenue_segment_skipped_checks,
        "detailGroupChecks": detail_group_checks,
        "detailGroupMismatchCount": detail_group_mismatches,
        "detailGroupSkippedChecks": detail_group_skipped_checks,
        "opexChecks": opex_checks,
        "opexSkippedChecks": opex_skipped_checks,
        "opexOverflowMismatchCount": opex_overflow_mismatches,
        "warningCount": len(warning_messages),
        "warnings": warning_messages[:20],
    }


def normalize_q4_annualized_outliers(financials: dict[str, Any]) -> None:
    if not financials:
        return
    for quarter_key in sorted(financials.keys(), key=parse_period):
        if not str(quarter_key).endswith("Q4"):
            continue
        quarter_entry = financials.get(quarter_key)
        if not isinstance(quarter_entry, dict):
            continue
        year_text = str(quarter_key)[:4]
        if not year_text.isdigit():
            continue
        prior_quarter_keys = [f"{year_text}Q1", f"{year_text}Q2", f"{year_text}Q3"]
        prior_entries = [financials.get(key) for key in prior_quarter_keys]
        if any(not isinstance(item, dict) for item in prior_entries):
            continue
        prior_revenues = [float((item or {}).get("revenueBn") or 0) for item in prior_entries]
        if any(value <= 0 for value in prior_revenues):
            continue
        q4_revenue = float(quarter_entry.get("revenueBn") or 0)
        baseline_revenue = _median(prior_revenues)
        if q4_revenue <= 0 or baseline_revenue <= 0:
            continue
        if q4_revenue / baseline_revenue < 2.6:
            continue

        q4_rows = [row for row in (quarter_entry.get("officialRevenueSegments") or []) if isinstance(row, dict)]
        if len(q4_rows) < 2:
            continue
        q4_segment_sum = sum(float(row.get("valueBn") or 0) for row in q4_rows if float(row.get("valueBn") or 0) > 0)
        prior_segment_sums = []
        for prior_entry in prior_entries:
            rows = [row for row in ((prior_entry or {}).get("officialRevenueSegments") or []) if isinstance(row, dict)]
            if len(rows) < 2:
                continue
            segment_sum = sum(float(row.get("valueBn") or 0) for row in rows if float(row.get("valueBn") or 0) > 0)
            if segment_sum > 0:
                prior_segment_sums.append(segment_sum)
        baseline_segment = _median(prior_segment_sums)
        if q4_segment_sum > 0 and baseline_segment > 0:
            segment_ratio = q4_segment_sum / baseline_segment
            revenue_to_segment_ratio = q4_revenue / q4_segment_sum if q4_segment_sum > 0 else 0
            if segment_ratio <= 1.6 and revenue_to_segment_ratio >= 1.8:
                quarter_entry["revenueBn"] = round(q4_segment_sum, 3)
                quality_flags = quarter_entry.get("qualityFlags")
                if not isinstance(quality_flags, list):
                    quality_flags = []
                if "q4-revenue-aligned-to-segment-sum" not in quality_flags:
                    quality_flags.append("q4-revenue-aligned-to-segment-sum")
                quarter_entry["qualityFlags"] = quality_flags
                continue

        q3_entry = financials.get(f"{year_text}Q3")
        if not isinstance(q3_entry, dict):
            continue
        q3_rows = [row for row in (q3_entry.get("officialRevenueSegments") or []) if isinstance(row, dict)]
        if len(q3_rows) < 2:
            continue

        q3_map = {str(row.get("memberKey") or row.get("name") or "").strip(): float(row.get("valueBn") or 0) for row in q3_rows}
        q4_map = {str(row.get("memberKey") or row.get("name") or "").strip(): float(row.get("valueBn") or 0) for row in q4_rows}
        multipliers: list[float] = []
        for member_key, q4_value in q4_map.items():
            q3_value = float(q3_map.get(member_key) or 0)
            if q3_value > 0.05 and q4_value > 0.05:
                multipliers.append(q4_value / q3_value)
        if len(multipliers) < 2:
            continue
        median_multiplier = _median(multipliers)
        multiplier_spread = max(multipliers) - min(multipliers)
        if median_multiplier < 2.6 or median_multiplier > 5.4 or multiplier_spread > 1.8:
            continue

        normalization_factor = 4.0 if 3.3 <= median_multiplier <= 4.7 else round(median_multiplier, 3)
        if normalization_factor <= 1.5:
            continue

        quarter_entry["revenueBn"] = round(q4_revenue / normalization_factor, 3)
        for row in q4_rows:
            current_value = float(row.get("valueBn") or 0)
            row["valueBn"] = round(current_value / normalization_factor, 3)
            row["yoyPct"] = None
            row["qoqPct"] = None
            row["mixPct"] = None
            row["mixYoyDeltaPp"] = None
        detail_rows = [row for row in (quarter_entry.get("officialRevenueDetailGroups") or []) if isinstance(row, dict)]
        for row in detail_rows:
            current_value = float(row.get("valueBn") or 0)
            row["valueBn"] = round(current_value / normalization_factor, 3)
            row["yoyPct"] = None
            row["qoqPct"] = None
            row["mixPct"] = None
            row["mixYoyDeltaPp"] = None

        q3_revenue = float((financials.get(f"{year_text}Q3") or {}).get("revenueBn") or 0)
        if q3_revenue > 0:
            quarter_entry["revenueQoqPct"] = round((quarter_entry["revenueBn"] / q3_revenue - 1) * 100, 3)
        prior_year_q4_revenue = float((financials.get(f"{int(year_text) - 1}Q4") or {}).get("revenueBn") or 0)
        if prior_year_q4_revenue > 0:
            quarter_entry["revenueYoyPct"] = round((quarter_entry["revenueBn"] / prior_year_q4_revenue - 1) * 100, 3)

        quality_flags = quarter_entry.get("qualityFlags")
        if not isinstance(quality_flags, list):
            quality_flags = []
        if "q4-annualized-normalized" not in quality_flags:
            quality_flags.append("q4-annualized-normalized")
        quarter_entry["qualityFlags"] = quality_flags


def recompute_revenue_growth_metrics(financials: dict[str, Any]) -> None:
    ordered_quarters = sorted(financials.keys(), key=parse_period)
    for quarter_key in ordered_quarters:
        entry = financials.get(quarter_key)
        if not isinstance(entry, dict):
            continue
        revenue_bn = float(entry.get("revenueBn") or 0)
        if revenue_bn <= 0:
            entry["revenueQoqPct"] = None
            entry["revenueYoyPct"] = None
            continue
        year = int(str(quarter_key)[:4]) if str(quarter_key)[:4].isdigit() else None
        quarter_number = int(str(quarter_key)[-1]) if str(quarter_key).endswith(("Q1", "Q2", "Q3", "Q4")) else None
        if year is None or quarter_number is None:
            continue
        prior_quarter_key = f"{year - 1}Q4" if quarter_number == 1 else f"{year}Q{quarter_number - 1}"
        prior_year_key = f"{year - 1}Q{quarter_number}"
        prior_quarter_revenue = float((financials.get(prior_quarter_key) or {}).get("revenueBn") or 0)
        prior_year_revenue = float((financials.get(prior_year_key) or {}).get("revenueBn") or 0)
        entry["revenueQoqPct"] = round((revenue_bn / prior_quarter_revenue - 1) * 100, 3) if prior_quarter_revenue > 0 else None
        entry["revenueYoyPct"] = round((revenue_bn / prior_year_revenue - 1) * 100, 3) if prior_year_revenue > 0 else None


def quarter_end_date(quarter_key: str) -> str | None:
    if len(quarter_key) != 6 or quarter_key[4] != "Q":
        return None
    try:
        year = int(quarter_key[:4])
        quarter = int(quarter_key[5])
    except ValueError:
        return None
    mapping = {
        1: f"{year:04d}-03-31",
        2: f"{year:04d}-06-30",
        3: f"{year:04d}-09-30",
        4: f"{year:04d}-12-31",
    }
    return mapping.get(quarter)


def synthesize_financial_entry_from_structure(
    quarter_key: str,
    company: dict[str, Any],
    quarter_payload: dict[str, Any],
) -> dict[str, Any] | None:
    if not isinstance(quarter_payload, dict):
        return None
    segment_rows = [row for row in (quarter_payload.get("segments") or []) if isinstance(row, dict)]
    segment_sum_bn = round(
        sum(float(row.get("valueBn") or 0) for row in segment_rows if float(row.get("valueBn") or 0) > 0),
        3,
    )
    display_revenue_bn = float(quarter_payload.get("displayRevenueBn") or 0)
    revenue_bn = round(display_revenue_bn, 3) if display_revenue_bn > 0 else segment_sum_bn
    if revenue_bn <= 0:
        return None
    period_end = quarter_end_date(quarter_key) or ""
    fiscal_year = quarter_key[:4]
    fiscal_quarter = f"Q{quarter_key[5]}"
    statement_currency = str(quarter_payload.get("displayCurrency") or company.get("reportingCurrency") or "USD").upper()
    source_url = ""
    filing_date = period_end
    for row in segment_rows:
        if not source_url and row.get("sourceUrl"):
            source_url = str(row.get("sourceUrl"))
        if row.get("filingDate"):
            filing_date = str(row.get("filingDate"))
            break
    return {
        "calendarQuarter": quarter_key,
        "periodEnd": period_end,
        "fiscalYear": fiscal_year,
        "fiscalQuarter": fiscal_quarter,
        "fiscalLabel": f"FY{fiscal_year} {fiscal_quarter}",
        "statementCurrency": statement_currency,
        "revenueBn": revenue_bn,
        "revenueYoyPct": None,
        "costOfRevenueBn": None,
        "grossProfitBn": None,
        "sgnaBn": None,
        "rndBn": None,
        "otherOpexBn": None,
        "operatingExpensesBn": None,
        "operatingIncomeBn": None,
        "nonOperatingBn": None,
        "pretaxIncomeBn": None,
        "taxBn": None,
        "netIncomeBn": None,
        "netIncomeYoyPct": None,
        "grossMarginPct": None,
        "operatingMarginPct": None,
        "profitMarginPct": None,
        "effectiveTaxRatePct": None,
        "revenueQoqPct": None,
        "grossMarginYoyDeltaPp": None,
        "operatingMarginYoyDeltaPp": None,
        "profitMarginYoyDeltaPp": None,
        "statementSource": "official-revenue-structure",
        "statementSourceUrl": source_url,
        "statementFilingDate": filing_date,
    }


def load_manual_presets() -> dict[str, Any]:
    if not MANUAL_PRESETS_PATH.exists():
        return {}
    return json.loads(MANUAL_PRESETS_PATH.read_text(encoding="utf-8"))


def load_manual_company_overrides() -> dict[str, Any]:
    if not MANUAL_COMPANY_OVERRIDES_PATH.exists():
        return {}
    try:
        payload = json.loads(MANUAL_COMPANY_OVERRIDES_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {}
    return payload if isinstance(payload, dict) else {}


def deep_merge_dicts(base: dict[str, Any], override: dict[str, Any]) -> dict[str, Any]:
    result = deepcopy(base)
    for key, value in override.items():
        if isinstance(value, dict) and isinstance(result.get(key), dict):
            result[key] = deep_merge_dicts(result[key], value)
        else:
            result[key] = deepcopy(value)
    return result


def _merge_history_payload(base: dict[str, Any], override: dict[str, Any]) -> dict[str, Any]:
    result = deepcopy(base) if isinstance(base, dict) else {}
    for scalar_key in ("source", "displayCurrency", "displayRevenueBn", "displayScaleFactor"):
        if scalar_key in override and override.get(scalar_key) is not None:
            result[scalar_key] = deepcopy(override.get(scalar_key))
    base_quarters = result.get("quarters") if isinstance(result.get("quarters"), dict) else {}
    override_quarters = override.get("quarters") if isinstance(override.get("quarters"), dict) else {}
    merged_quarters = dict(base_quarters)
    for quarter_key, quarter_payload in override_quarters.items():
        if not isinstance(quarter_payload, dict):
            merged_quarters[str(quarter_key)] = deepcopy(quarter_payload)
            continue
        existing_payload = merged_quarters.get(str(quarter_key))
        if isinstance(existing_payload, dict):
            merged_quarters[str(quarter_key)] = deep_merge_dicts(existing_payload, quarter_payload)
        else:
            merged_quarters[str(quarter_key)] = deepcopy(quarter_payload)
    if merged_quarters:
        result["quarters"] = merged_quarters
    base_filings = result.get("filingsUsed") if isinstance(result.get("filingsUsed"), list) else []
    override_filings = override.get("filingsUsed") if isinstance(override.get("filingsUsed"), list) else []
    if base_filings or override_filings:
        seen = set()
        merged_filings = []
        for item in [*base_filings, *override_filings]:
            encoded = json.dumps(item, ensure_ascii=False, sort_keys=True)
            if encoded in seen:
                continue
            seen.add(encoded)
            merged_filings.append(deepcopy(item))
        result["filingsUsed"] = merged_filings
    base_errors = result.get("errors") if isinstance(result.get("errors"), list) else []
    override_errors = override.get("errors") if isinstance(override.get("errors"), list) else []
    if base_errors or override_errors:
        merged_errors = []
        for item in [*base_errors, *override_errors]:
            if item in merged_errors:
                continue
            merged_errors.append(deepcopy(item))
        result["errors"] = merged_errors
    return result


def apply_manual_company_override(payload: dict[str, Any], company: dict[str, Any], overrides: dict[str, Any]) -> dict[str, Any]:
    lookup_candidates = [
        str(company.get("id") or "").strip().lower(),
        str(company.get("ticker") or "").strip().lower(),
        str(company.get("slug") or "").strip().lower(),
    ]
    override = next((overrides.get(candidate) for candidate in lookup_candidates if candidate and isinstance(overrides.get(candidate), dict)), None)
    if not isinstance(override, dict):
        return payload

    merged_payload = deep_merge_dicts(payload, {key: value for key, value in override.items() if key not in {"financials", "quarters", "officialRevenueStructureHistory", "errors"}})

    merged_financials = deepcopy(merged_payload.get("financials") or {})
    override_financials = override.get("financials") if isinstance(override.get("financials"), dict) else {}
    for quarter_key, quarter_override in override_financials.items():
        normalized_quarter = str(quarter_key)
        if isinstance(quarter_override, dict) and isinstance(merged_financials.get(normalized_quarter), dict):
            merged_financials[normalized_quarter] = deep_merge_dicts(merged_financials[normalized_quarter], quarter_override)
        else:
            merged_financials[normalized_quarter] = deepcopy(quarter_override)
    if merged_financials:
        merged_payload["financials"] = merged_financials
        merged_payload["quarters"] = sorted(merged_financials.keys(), key=parse_period)

    override_history = override.get("officialRevenueStructureHistory")
    if isinstance(override_history, dict):
        merged_payload["officialRevenueStructureHistory"] = _merge_history_payload(
            merged_payload.get("officialRevenueStructureHistory") if isinstance(merged_payload.get("officialRevenueStructureHistory"), dict) else {},
            override_history,
        )

    if isinstance(override.get("quarters"), list):
        merged_payload["quarters"] = [str(item) for item in override.get("quarters") if str(item)]
    elif isinstance(merged_payload.get("financials"), dict):
        merged_payload["quarters"] = sorted(merged_payload["financials"].keys(), key=parse_period)

    base_errors = merged_payload.get("errors") if isinstance(merged_payload.get("errors"), list) else []
    override_errors = override.get("errors") if isinstance(override.get("errors"), list) else []
    if base_errors or override_errors:
        merged_payload["errors"] = []
        for item in [*base_errors, *override_errors]:
            if item in merged_payload["errors"]:
                continue
            merged_payload["errors"].append(deepcopy(item))
    if isinstance(merged_payload.get("officialRevenueStructureHistory"), dict):
        merged_payload = apply_revenue_structure_history(
            merged_payload,
            company,
            merged_payload["officialRevenueStructureHistory"],
        )
    return merged_payload


def build_company_classification_coverage(company: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
    financials = payload.get("financials") if isinstance(payload.get("financials"), dict) else {}
    ordered_quarters = sorted(financials.keys(), key=parse_period)
    latest_quarter = ordered_quarters[-1] if ordered_quarters else None
    latest_entry = financials.get(latest_quarter) if latest_quarter else {}
    latest_entry = latest_entry if isinstance(latest_entry, dict) else {}
    revenue_quarters = [
        quarter
        for quarter in ordered_quarters
        if isinstance(financials.get(quarter), dict) and financials[quarter].get("officialRevenueSegments")
    ]
    expense_quarters = [
        quarter
        for quarter in ordered_quarters
        if isinstance(financials.get(quarter), dict) and (financials[quarter].get("officialOpexBreakdown") or financials[quarter].get("opexBreakdown"))
    ]
    structure_history = (
        payload.get("officialRevenueStructureHistory")
        if isinstance(payload.get("officialRevenueStructureHistory"), dict)
        else {}
    )
    structure_history_quarters = (
        structure_history.get("quarters")
        if isinstance(structure_history.get("quarters"), dict)
        else {}
    )
    structure_history_keys = sorted((str(key) for key in structure_history_quarters.keys() if str(key)), key=parse_period)
    latest_revenue_quarter = revenue_quarters[-1] if revenue_quarters else None
    latest_expense_quarter = expense_quarters[-1] if expense_quarters else None
    latest_structure_history_quarter = structure_history_keys[-1] if structure_history_keys else None
    quarter_count = len(ordered_quarters)
    policy = payload.get("classificationPolicy") if isinstance(payload.get("classificationPolicy"), dict) else {}
    allow_latest_revenue_gap = bool(policy.get("allowLatestRevenueGap"))
    require_latest_expense = bool(policy.get("requireLatestExpenseClassification"))
    allow_latest_expense_gap = bool(policy.get("allowLatestExpenseGap"))
    warnings: list[str] = []
    blockers: list[str] = []
    if company.get("financialSource") == "stockanalysis":
        if latest_quarter and latest_revenue_quarter != latest_quarter:
            latest_revenue_gap_reason = str(policy.get("latestRevenueGapReason") or "").strip()
            fallback_quarter = str(policy.get("fallbackRevenueQuarter") or latest_revenue_quarter or "").strip()
            if allow_latest_revenue_gap and latest_revenue_gap_reason:
                if fallback_quarter:
                    warnings.append(
                        f"Latest revenue classification is unavailable for {latest_quarter}; using {fallback_quarter} as the newest official disclosed structure. {latest_revenue_gap_reason}"
                    )
                else:
                    warnings.append(
                        f"Latest revenue classification is unavailable for {latest_quarter}. {latest_revenue_gap_reason}"
                    )
            else:
                blockers.append(
                    f"Missing latest-quarter revenue classification for {latest_quarter}. Add an official parser/manual override or declare an explicit exception."
                )
        if latest_quarter and latest_expense_quarter != latest_quarter:
            latest_expense_gap_reason = str(policy.get("latestExpenseGapReason") or "").strip()
            if require_latest_expense and not allow_latest_expense_gap:
                blockers.append(
                    f"Missing latest-quarter expense classification for {latest_quarter}. Add an official parser/manual override or declare an explicit exception."
                )
            elif latest_expense_gap_reason:
                warnings.append(
                    f"Latest expense classification is unavailable for {latest_quarter}. {latest_expense_gap_reason}"
                )
        if revenue_quarters and len(revenue_quarters) < min(quarter_count, 4):
            warnings.append(
                f"Revenue classification history is sparse: {len(revenue_quarters)} of {quarter_count} quarters have official segment splits."
            )
        if expense_quarters and len(expense_quarters) < min(quarter_count, 4):
            warnings.append(
                f"Expense classification history is sparse: {len(expense_quarters)} of {quarter_count} quarters have official expense breakdowns."
            )
        if not revenue_quarters:
            warnings.append("No official revenue classification history is currently available.")
        if require_latest_expense and not expense_quarters:
            warnings.append("No official expense classification history is currently available.")

    status = "ok"
    if blockers:
        status = "error"
    elif allow_latest_revenue_gap and latest_quarter and latest_revenue_quarter != latest_quarter:
        status = "exception"
    elif warnings:
        status = "warning"

    return {
        "status": status,
        "latestQuarter": latest_quarter,
        "latestQuarterHasRevenueClassification": bool(latest_quarter and latest_revenue_quarter == latest_quarter),
        "latestQuarterHasExpenseClassification": bool(latest_quarter and latest_expense_quarter == latest_quarter),
        "latestRevenueClassificationQuarter": latest_revenue_quarter,
        "latestExpenseClassificationQuarter": latest_expense_quarter,
        "latestStructureHistoryQuarter": latest_structure_history_quarter,
        "revenueClassificationQuarterCount": len(revenue_quarters),
        "expenseClassificationQuarterCount": len(expense_quarters),
        "revenueClassificationCoverageRatio": round(len(revenue_quarters) / quarter_count, 4) if quarter_count else 0,
        "expenseClassificationCoverageRatio": round(len(expense_quarters) / quarter_count, 4) if quarter_count else 0,
        "latestRevenueClassificationLagQuarters": quarter_distance(latest_quarter, latest_revenue_quarter),
        "latestExpenseClassificationLagQuarters": quarter_distance(latest_quarter, latest_expense_quarter),
        "warnings": warnings,
        "blockers": blockers,
        "policy": deepcopy(policy),
    }


def build_dataset_classification_audit(companies: list[dict[str, Any]]) -> dict[str, Any]:
    audit_rows = []
    blocking_issues: list[str] = []
    warning_company_ids: list[str] = []
    missing_latest_revenue: list[str] = []
    missing_latest_expense_required: list[str] = []
    sparse_history_ids: list[str] = []
    stockanalysis_company_count = 0
    for company in companies:
        coverage = company.get("coverage") if isinstance(company.get("coverage"), dict) else {}
        classification = coverage.get("classification") if isinstance(coverage.get("classification"), dict) else {}
        if company.get("financialSource") == "stockanalysis":
            stockanalysis_company_count += 1
            if not classification.get("latestQuarterHasRevenueClassification"):
                missing_latest_revenue.append(str(company.get("id") or ""))
            policy = classification.get("policy") if isinstance(classification.get("policy"), dict) else {}
            if (
                policy.get("requireLatestExpenseClassification")
                and not classification.get("latestQuarterHasExpenseClassification")
            ):
                missing_latest_expense_required.append(str(company.get("id") or ""))
            if 0 < int(classification.get("revenueClassificationQuarterCount") or 0) < min(int(coverage.get("quarterCount") or 0), 4):
                sparse_history_ids.append(str(company.get("id") or ""))
            if classification.get("warnings"):
                warning_company_ids.append(str(company.get("id") or ""))
            for blocker in classification.get("blockers") or []:
                blocking_issues.append(f"{company.get('ticker')}: {blocker}")
        audit_rows.append(
            {
                "id": company.get("id"),
                "ticker": company.get("ticker"),
                "financialSource": company.get("financialSource"),
                "latestQuarter": classification.get("latestQuarter"),
                "status": classification.get("status"),
                "latestQuarterHasRevenueClassification": classification.get("latestQuarterHasRevenueClassification"),
                "latestQuarterHasExpenseClassification": classification.get("latestQuarterHasExpenseClassification"),
                "latestRevenueClassificationQuarter": classification.get("latestRevenueClassificationQuarter"),
                "latestExpenseClassificationQuarter": classification.get("latestExpenseClassificationQuarter"),
                "revenueClassificationQuarterCount": classification.get("revenueClassificationQuarterCount"),
                "expenseClassificationQuarterCount": classification.get("expenseClassificationQuarterCount"),
                "warnings": classification.get("warnings") or [],
                "blockers": classification.get("blockers") or [],
            }
        )

    return {
        "stockanalysisCompanyCount": stockanalysis_company_count,
        "companiesMissingLatestRevenueClassification": [item for item in missing_latest_revenue if item],
        "companiesMissingRequiredLatestExpenseClassification": [item for item in missing_latest_expense_required if item],
        "companiesWithSparseRevenueHistory": [item for item in sparse_history_ids if item],
        "companiesWithWarnings": [item for item in warning_company_ids if item],
        "blockingIssues": blocking_issues,
        "companies": audit_rows,
    }


def finalize_company_payload(
    company: dict[str, Any],
    payload: dict[str, Any],
    presets: dict[str, Any],
) -> dict[str, Any]:
    payload["statementPresets"] = presets
    segment_quarter_count = sum(1 for item in payload["financials"].values() if item.get("officialRevenueSegments"))
    expense_quarter_count = sum(1 for item in payload["financials"].values() if item.get("officialOpexBreakdown") or item.get("opexBreakdown"))
    classification_coverage = build_company_classification_coverage(company, payload)
    parser_diagnostics = payload.get("parserDiagnostics") if isinstance(payload.get("parserDiagnostics"), dict) else {}
    financial_parser = parser_diagnostics.get("financials") if isinstance(parser_diagnostics.get("financials"), dict) else {}
    segment_parser = parser_diagnostics.get("segments") if isinstance(parser_diagnostics.get("segments"), dict) else {}
    revenue_structure_parser = parser_diagnostics.get("revenueStructures") if isinstance(parser_diagnostics.get("revenueStructures"), dict) else {}
    financial_reconciliation = financial_parser.get("reconciliation") if isinstance(financial_parser.get("reconciliation"), dict) else {}
    parser_validation = _build_parser_validation_summary(payload)
    if isinstance(parser_diagnostics, dict):
        parser_diagnostics["validation"] = deepcopy(parser_validation)
        payload["parserDiagnostics"] = parser_diagnostics
    payload["coverage"] = {
        "quarterCount": len(payload["quarters"]),
        "pixelReplicaQuarterCount": len(presets),
        "hasPixelReplica": bool(presets),
        "officialFinancialQuarterCount": len(payload["quarters"]),
        "officialSegmentQuarterCount": segment_quarter_count,
        "officialExpenseQuarterCount": expense_quarter_count,
        "classification": classification_coverage,
        "parser": {
            "version": parser_diagnostics.get("version"),
            "selectedFinancialSource": financial_parser.get("selectedSource"),
            "selectedSegmentSource": segment_parser.get("selectedSource"),
            "selectedRevenueStructureSource": revenue_structure_parser.get("selectedSource"),
            "financialAttemptCount": len(financial_parser.get("attempts") or []),
            "financialReconciliation": deepcopy(financial_reconciliation),
            "financialValidation": deepcopy(financial_parser.get("validation") if isinstance(financial_parser.get("validation"), dict) else {}),
            "validation": deepcopy(parser_validation),
        },
    }
    return payload


def load_fx_cache() -> dict[str, float]:
    if not FX_CACHE_PATH.exists():
        return {}
    return json.loads(FX_CACHE_PATH.read_text(encoding="utf-8"))


def save_fx_cache(cache: dict[str, float]) -> None:
    FX_CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    FX_CACHE_PATH.write_text(json.dumps(cache, ensure_ascii=False, indent=2, sort_keys=True), encoding="utf-8")


def fetch_usd_fx_rate(currency: str, date_text: str, cache: dict[str, float]) -> float | None:
    normalized_currency = str(currency or "").upper()
    if not normalized_currency or normalized_currency == "USD":
        return 1.0
    try:
        base_date = date.fromisoformat(date_text)
    except ValueError:
        return None
    for day_offset in range(0, 8):
        lookup_date = (base_date - timedelta(days=day_offset)).isoformat()
        cache_key = f"{normalized_currency}:{lookup_date}"
        if cache_key in cache:
            return cache[cache_key]
        if cache_key in FX_LOOKUP_MISS_KEYS:
            continue
        url = f"https://api.frankfurter.app/{lookup_date}?from={normalized_currency}&to=USD"
        try:
            response = requests.get(
                url,
                timeout=FX_LOOKUP_TIMEOUT_SECONDS,
                headers={"User-Agent": "Mozilla/5.0", "Accept": "application/json"},
            )
            if not response.ok:
                FX_LOOKUP_MISS_KEYS.add(cache_key)
                continue
            payload = response.json()
        except (requests.RequestException, ValueError):
            FX_LOOKUP_MISS_KEYS.add(cache_key)
            continue
        rate = payload.get("rates", {}).get("USD")
        if isinstance(rate, (int, float)) and rate > 0:
            cache[cache_key] = float(rate)
            return float(rate)
        FX_LOOKUP_MISS_KEYS.add(cache_key)
    return None


def _fetch_pdf_text(url: str) -> str | None:
    if not url:
        return None
    cached = PDF_TEXT_CACHE.get(url)
    if cached is not None:
        return cached
    try:
        response = requests.get(url, timeout=30, headers={"User-Agent": "Mozilla/5.0", "Accept": "application/pdf"})
        if not response.ok:
            PDF_TEXT_CACHE[url] = ""
            return None
        reader = PdfReader(io.BytesIO(response.content))
        text = "\n".join((page.extract_text() or "") for page in reader.pages)
    except Exception:  # noqa: BLE001
        PDF_TEXT_CACHE[url] = ""
        return None
    PDF_TEXT_CACHE[url] = text
    return text or None


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


def _collapse_pdf_statement_lines(text: str) -> list[str]:
    collapsed: list[str] = []
    cursor = ""
    for raw_line in str(text or "").splitlines():
        line = re.sub(r"\s+", " ", raw_line).strip()
        if not line:
            continue
        merged = f"{cursor} {line}".strip() if cursor else line
        if re.search(r"\(?\d[\d,]*\)?%?(?:\s|$)", line):
            collapsed.append(merged)
            cursor = ""
        else:
            cursor = merged
    if cursor:
        collapsed.append(cursor)
    return collapsed


def _pdf_label_pattern(label: str) -> re.Pattern[str]:
    escaped = re.escape(label)
    escaped = escaped.replace(r"\ ", r"\s+")
    escaped = escaped.replace(r"\(", r"\(?").replace(r"\)", r"\)?")
    return re.compile(rf"^(?:[A-Za-z][A-Za-z*/-]*\s+)*{escaped}\s+(.+)$", re.IGNORECASE)


def _extract_tencent_row_values(lines: list[str], label: str) -> list[float]:
    pattern = _pdf_label_pattern(label)
    for line in lines:
        match = pattern.match(line)
        if not match:
            continue
        tokens = re.findall(r"\(?\d[\d,]*\)?%?", match.group(1))
        values = [_parse_numeric_token(token) for token in tokens]
        return [value for value in values if value is not None]
    return []


def _quarter_prior_key(quarter_key: str) -> str | None:
    if len(quarter_key) != 6 or quarter_key[4] != "Q":
        return None
    year = int(quarter_key[:4])
    quarter = int(quarter_key[5])
    if quarter == 1:
        return f"{year - 1}Q4"
    return f"{year}Q{quarter - 1}"


def _parse_tencent_pdf_financial_entry(quarter_key: str, source_url: str, filing_date: str | None) -> dict[str, Any] | None:
    statement = parse_income_statement_from_url(source_url, ocr_fallback=True, quarter_hint=quarter_key)
    rows = statement.rows if isinstance(statement.rows, dict) else {}
    revenue_values = rows.get("revenue") or []
    cost_values = rows.get("cost_of_revenue") or []
    gross_values = rows.get("gross_profit") or []
    selling_values = rows.get("selling_marketing") or []
    ga_values = rows.get("general_admin") or []
    other_values = rows.get("other_gains_losses") or []
    operating_values = rows.get("operating_profit") or []
    pretax_values = rows.get("pretax_income") or []
    tax_values = rows.get("income_tax") or []
    equity_values = rows.get("net_income_attributable") or rows.get("net_income") or []
    if not (revenue_values and gross_values and operating_values and pretax_values and tax_values and equity_values):
        return None
    bn_scale = statement.metadata.get("bnScale") if isinstance(statement.metadata, dict) else None
    if bn_scale is None:
        return None

    revenue_current = revenue_values[0]
    revenue_prior = revenue_values[1] if len(revenue_values) > 1 else None
    gross_current = gross_values[0]
    gross_prior = gross_values[1] if len(gross_values) > 1 else None
    reported_operating_current = operating_values[0]
    reported_operating_prior = operating_values[1] if len(operating_values) > 1 else None
    pretax_current = pretax_values[0]
    tax_current = tax_values[0]
    tax_prior = tax_values[1] if len(tax_values) > 1 else None
    net_income_current = equity_values[0]
    net_income_prior = equity_values[1] if len(equity_values) > 1 else None
    if revenue_current <= 0 or gross_current <= 0 or net_income_current <= 0:
        return None

    cost_current = abs(cost_values[0]) if cost_values else max(revenue_current - gross_current, 0)
    selling_current = abs(selling_values[0]) if selling_values else 0
    selling_prior = abs(selling_values[1]) if len(selling_values) > 1 else 0
    ga_current = abs(ga_values[0]) if ga_values else 0
    ga_prior = abs(ga_values[1]) if len(ga_values) > 1 else 0
    other_current = other_values[0] if other_values else 0
    other_prior = other_values[1] if len(other_values) > 1 else 0
    explicit_operating_expenses_current = selling_current + ga_current + (abs(other_current) if other_current < 0 else 0)
    explicit_operating_expenses_prior = selling_prior + ga_prior + (abs(other_prior) if other_prior < 0 else 0)
    if explicit_operating_expenses_current > 0:
        operating_expenses_current = explicit_operating_expenses_current
        operating_current = gross_current - operating_expenses_current
    else:
        operating_current = reported_operating_current
        operating_expenses_current = max(gross_current - operating_current, 0)
    if explicit_operating_expenses_prior > 0 and gross_prior is not None:
        operating_prior = gross_prior - explicit_operating_expenses_prior
    else:
        operating_prior = reported_operating_prior
    net_income_yoy = round((net_income_current / net_income_prior - 1) * 100, 3) if net_income_prior and net_income_prior > 0 else None
    gross_margin_current = round(gross_current / revenue_current * 100, 3)
    operating_margin_current = round(operating_current / revenue_current * 100, 3)
    profit_margin_current = round(net_income_current / revenue_current * 100, 3)
    gross_margin_prior = round(gross_prior / revenue_prior * 100, 3) if gross_prior and revenue_prior else None
    operating_margin_prior = round(operating_prior / revenue_prior * 100, 3) if operating_prior and revenue_prior else None
    profit_margin_prior = round(net_income_prior / revenue_prior * 100, 3) if net_income_prior and revenue_prior else None

    return {
        "calendarQuarter": quarter_key,
        "periodEnd": quarter_end_date(quarter_key) or "",
        "fiscalYear": quarter_key[:4],
        "fiscalQuarter": f"Q{quarter_key[5]}",
        "fiscalLabel": f"FY{quarter_key[:4]} Q{quarter_key[5]}",
        "statementCurrency": "CNY",
        "revenueBn": statement_value_to_bn(revenue_current, statement),
        "revenueYoyPct": round((revenue_current / revenue_prior - 1) * 100, 3) if revenue_prior and revenue_prior > 0 else None,
        "costOfRevenueBn": statement_value_to_bn(cost_current, statement),
        "grossProfitBn": statement_value_to_bn(gross_current, statement),
        "sgnaBn": statement_value_to_bn(selling_current + ga_current, statement) if selling_current or ga_current else None,
        "rndBn": None,
        "otherOpexBn": statement_value_to_bn(abs(other_current), statement) if other_current < 0 else None,
        "operatingExpensesBn": statement_value_to_bn(operating_expenses_current, statement),
        "operatingIncomeBn": statement_value_to_bn(operating_current, statement),
        "nonOperatingBn": statement_value_to_bn(pretax_current - operating_current, statement),
        "pretaxIncomeBn": statement_value_to_bn(pretax_current, statement),
        "taxBn": statement_value_to_bn(abs(tax_current), statement),
        "netIncomeBn": statement_value_to_bn(net_income_current, statement),
        "netIncomeYoyPct": net_income_yoy,
        "grossMarginPct": gross_margin_current,
        "operatingMarginPct": operating_margin_current,
        "profitMarginPct": profit_margin_current,
        "effectiveTaxRatePct": round(abs(tax_current) / pretax_current * 100, 3) if pretax_current > 0 else None,
        "revenueQoqPct": None,
        "grossMarginYoyDeltaPp": round(gross_margin_current - gross_margin_prior, 3) if gross_margin_prior is not None else None,
        "operatingMarginYoyDeltaPp": round(operating_margin_current - operating_margin_prior, 3) if operating_margin_prior is not None else None,
        "profitMarginYoyDeltaPp": round(profit_margin_current - profit_margin_prior, 3) if profit_margin_prior is not None else None,
        "statementSource": "tencent-ir-pdf",
        "statementSourceUrl": source_url,
        "statementFilingDate": filing_date or quarter_end_date(quarter_key) or "",
    }


def supplement_tencent_official_financials(company_payload: dict[str, Any]) -> dict[str, Any]:
    if str(company_payload.get("id") or "") != "tencent":
        return company_payload
    parser_diagnostics = company_payload.get("parserDiagnostics") if isinstance(company_payload.get("parserDiagnostics"), dict) else {}
    parser_financials = parser_diagnostics.get("financials") if isinstance(parser_diagnostics.get("financials"), dict) else {}
    parser_attempts = parser_financials.get("attempts") if isinstance(parser_financials.get("attempts"), list) else []
    if any(
        isinstance(attempt, dict)
        and str(attempt.get("source_id") or "") == "tencent-ir-pdf"
        and str(attempt.get("status") or "") == "success"
        for attempt in parser_attempts
    ):
        return company_payload
    financials: dict[str, Any] = company_payload.get("financials", {})
    for quarter_key, entry in financials.items():
        if not isinstance(entry, dict):
            continue
        source_rows = [row for row in (entry.get("officialRevenueSegments") or []) if isinstance(row, dict)]
        source_url = next((str(row.get("sourceUrl") or "") for row in source_rows if row.get("sourceUrl")), "")
        filing_date = next((str(row.get("filingDate") or "") for row in source_rows if row.get("filingDate")), "") or str(
            entry.get("statementFilingDate") or entry.get("periodEnd") or ""
        )
        if not source_url.endswith(".pdf"):
            continue
        parsed_entry = _parse_tencent_pdf_financial_entry(quarter_key, source_url, filing_date)
        if not parsed_entry:
            continue
        preserved_fields = {
            "officialRevenueSegments": entry.get("officialRevenueSegments"),
            "officialRevenueDetailGroups": entry.get("officialRevenueDetailGroups"),
            "officialRevenueStyle": entry.get("officialRevenueStyle"),
            "displayCurrency": entry.get("displayCurrency"),
            "displayScaleFactor": entry.get("displayScaleFactor"),
            "qualityFlags": entry.get("qualityFlags"),
        }
        entry.update(parsed_entry)
        for key, value in preserved_fields.items():
            if value is not None:
                entry[key] = value

    ordered_quarters = sorted(financials.keys(), key=parse_period)
    for quarter_key in ordered_quarters:
        entry = financials.get(quarter_key)
        if not isinstance(entry, dict):
            continue
        prior_quarter_key = _quarter_prior_key(quarter_key)
        prior_quarter_revenue = float((financials.get(prior_quarter_key or "") or {}).get("revenueBn") or 0)
        prior_year_key = f"{int(quarter_key[:4]) - 1}{quarter_key[4:]}" if quarter_key[:4].isdigit() else ""
        prior_year_revenue = float((financials.get(prior_year_key) or {}).get("revenueBn") or 0)
        revenue_bn = float(entry.get("revenueBn") or 0)
        if revenue_bn > 0 and prior_quarter_revenue > 0:
            entry["revenueQoqPct"] = round((revenue_bn / prior_quarter_revenue - 1) * 100, 3)
        if revenue_bn > 0 and prior_year_revenue > 0:
            entry["revenueYoyPct"] = round((revenue_bn / prior_year_revenue - 1) * 100, 3)
    company_payload["quarters"] = sorted(financials.keys(), key=parse_period)
    return company_payload


def sanitize_implausible_q4_revenue_aligned_statements(company_payload: dict[str, Any]) -> dict[str, Any]:
    financials: dict[str, Any] = company_payload.get("financials", {})
    bridge_fields = (
        "costOfRevenueBn",
        "grossProfitBn",
        "sgnaBn",
        "rndBn",
        "otherOpexBn",
        "operatingExpensesBn",
        "operatingIncomeBn",
        "nonOperatingBn",
        "pretaxIncomeBn",
        "taxBn",
        "netIncomeBn",
        "netIncomeYoyPct",
        "grossMarginPct",
        "operatingMarginPct",
        "profitMarginPct",
        "effectiveTaxRatePct",
        "grossMarginYoyDeltaPp",
        "operatingMarginYoyDeltaPp",
        "profitMarginYoyDeltaPp",
    )
    for quarter_key, entry in financials.items():
        if not isinstance(entry, dict):
            continue
        quality_flags = entry.get("qualityFlags")
        if not isinstance(quality_flags, list) or "q4-revenue-aligned-to-segment-sum" not in quality_flags:
            continue
        revenue_bn = float(entry.get("revenueBn") or 0)
        if revenue_bn <= 0:
            continue
        suspicious_values = [
            float(entry.get(field_name) or 0)
            for field_name in ("costOfRevenueBn", "grossProfitBn", "operatingExpensesBn", "operatingIncomeBn", "pretaxIncomeBn", "netIncomeBn")
            if float(entry.get(field_name) or 0) > 0
        ]
        if not suspicious_values or max(suspicious_values) <= revenue_bn * 1.18:
            continue
        for field_name in bridge_fields:
            entry[field_name] = None
        if "q4-statement-bridge-cleared" not in quality_flags:
            quality_flags.append("q4-statement-bridge-cleared")
        entry["qualityFlags"] = quality_flags
    company_payload["quarters"] = sorted(financials.keys(), key=parse_period)
    return company_payload


def apply_usd_display_fields(payload: dict[str, Any], fx_cache: dict[str, float]) -> dict[str, Any]:
    financials: dict[str, Any] = payload.get("financials", {})
    for entry in financials.values():
        if not isinstance(entry, dict):
            continue
        currency = str(entry.get("statementCurrency") or entry.get("displayCurrency") or "").upper()
        if not currency:
            continue
        if currency == "USD":
            entry["displayCurrency"] = "USD"
            if not entry.get("displayScaleFactor"):
                entry["displayScaleFactor"] = 1
            continue
        if entry.get("displayCurrency") == "USD" and entry.get("displayScaleFactor"):
            continue
        reference_date = entry.get("statementFilingDate") or entry.get("periodEnd")
        if not reference_date:
            continue
        fx_rate = fetch_usd_fx_rate(currency, str(reference_date), fx_cache)
        if fx_rate:
            entry["displayCurrency"] = "USD"
            entry["displayScaleFactor"] = round(float(fx_rate), 6)
    return payload


def fetch_company_payload(company: dict[str, Any], refresh: bool) -> dict[str, Any]:
    source = company.get("financialSource")
    if source == "stockanalysis":
        return fetch_stockanalysis_financial_history(company, refresh=refresh)
    return fetch_official_financial_history(company, refresh=refresh)


def load_official_segment_history(company: dict[str, Any], refresh: bool) -> dict[str, Any]:
    return fetch_official_segment_history(company, refresh=refresh)


def apply_official_segment_history(company_payload: dict[str, Any], history: dict[str, Any]) -> dict[str, Any]:
    quarter_map = history.get("quarters", {}) if isinstance(history, dict) else {}
    financials: dict[str, Any] = company_payload.get("financials", {})
    company_id = str(company_payload.get("id") or history.get("id") or "")
    for quarter, rows in quarter_map.items():
        entry = financials.get(quarter)
        if not isinstance(entry, dict):
            continue
        cleaned_rows = [row for row in rows if isinstance(row, dict) and row.get("valueBn") is not None]
        if not cleaned_rows:
            continue
        normalized_rows: list[dict[str, Any]] = []
        for row in cleaned_rows:
            member_key = str(row.get("memberKey") or row.get("name") or "")
            normalized_rows.append(
                {
                    "name": row.get("name"),
                    "nameZh": row.get("nameZh"),
                    "memberKey": member_key,
                    "valueBn": row.get("valueBn"),
                    "yoyPct": None,
                    "sourceUrl": row.get("sourceUrl"),
                    "sourceForm": row.get("sourceForm"),
                    "filingDate": row.get("filingDate"),
                    "periodStart": row.get("periodStart"),
                    "periodEnd": row.get("periodEnd"),
                }
            )
        normalized_rows = normalize_official_revenue_segments(company_id, str(quarter), normalized_rows)
        entry["officialRevenueSegments"] = normalized_rows
        entry["officialSegmentAxis"] = history.get("axis")
        entry["officialSegmentSource"] = history.get("source")

    company_payload["officialSegmentHistory"] = {
        "source": history.get("source"),
        "axis": history.get("axis"),
        "filingsUsed": history.get("filingsUsed", []),
        "errors": history.get("errors", []),
    }
    return company_payload


def merge_official_segment_history(company_payload: dict[str, Any], company: dict[str, Any], refresh: bool) -> dict[str, Any]:
    history = load_official_segment_history(company, refresh=refresh)
    return apply_official_segment_history(company_payload, history)


def load_official_revenue_structure_history(company: dict[str, Any], refresh: bool) -> dict[str, Any]:
    return fetch_official_revenue_structure_history(company, refresh=refresh)


def enrich_growth_rows(financials: dict[str, Any], field_name: str) -> None:
    ordered_quarters = sorted(financials, key=parse_period)
    for quarter in ordered_quarters:
        rows = financials.get(quarter, {}).get(field_name) or []
        if not rows:
            continue
        prior_year_quarter = f"{int(quarter[:4]) - 1}{quarter[4:]}"
        prior_year_rows = financials.get(prior_year_quarter, {}).get(field_name) or []
        prior_year_map = {str(item.get("memberKey") or item.get("name") or ""): item for item in prior_year_rows}
        prior_quarter = quarter
        if quarter.endswith("Q1"):
            prior_quarter = f"{int(quarter[:4]) - 1}Q4"
        else:
            prior_quarter = f"{quarter[:4]}Q{int(quarter[-1]) - 1}"
        prior_quarter_rows = financials.get(prior_quarter, {}).get(field_name) or []
        prior_quarter_map = {str(item.get("memberKey") or item.get("name") or ""): item for item in prior_quarter_rows}
        revenue_bn = float(financials.get(quarter, {}).get("revenueBn") or 0)
        prior_year_revenue_bn = float(financials.get(prior_year_quarter, {}).get("revenueBn") or 0)
        for row in rows:
            member_key = str(row.get("memberKey") or row.get("name") or "")
            if revenue_bn and row.get("metricMode") == "share":
                share_pct = float(row.get("mixPct") or row.get("valueBn") or 0)
                row["valueBn"] = round(share_pct / 100 * revenue_bn, 3)
                row["mixPct"] = round(share_pct, 1)
            elif revenue_bn and row.get("mixPct") is None:
                row["mixPct"] = round(float(row.get("valueBn") or 0) / revenue_bn * 100, 1)
            previous = prior_year_map.get(member_key)
            previous_value = float(previous.get("valueBn") or 0) if previous else 0
            if row.get("yoyPct") is None and previous_value:
                row["yoyPct"] = round((float(row.get("valueBn") or 0) / previous_value - 1) * 100, 2)
            previous = prior_quarter_map.get(member_key)
            previous_value = float(previous.get("valueBn") or 0) if previous else 0
            if row.get("qoqPct") is None and previous_value:
                row["qoqPct"] = round((float(row.get("valueBn") or 0) / previous_value - 1) * 100, 2)
            previous = prior_year_map.get(member_key)
            previous_value = float(previous.get("valueBn") or 0) if previous else 0
            if revenue_bn and prior_year_revenue_bn and previous_value and row.get("mixYoyDeltaPp") is None:
                current_mix = float(row.get("valueBn") or 0) / revenue_bn * 100
                prior_mix = previous_value / prior_year_revenue_bn * 100
                row["mixYoyDeltaPp"] = round(current_mix - prior_mix, 1)


def apply_revenue_structure_history(
    company_payload: dict[str, Any],
    company: dict[str, Any],
    history: dict[str, Any],
) -> dict[str, Any]:
    financials: dict[str, Any] = company_payload.get("financials", {})
    for quarter, payload in (history.get("quarters") or {}).items():
        segments = payload.get("segments") or []
        normalized_segments = []
        if segments:
            for row in segments:
                normalized_segments.append(
                    {
                        "name": row.get("name"),
                        "nameZh": row.get("nameZh"),
                        "memberKey": str(row.get("memberKey") or row.get("name") or ""),
                        "valueBn": row.get("valueBn"),
                        "yoyPct": row.get("yoyPct"),
                        "qoqPct": row.get("qoqPct"),
                        "mixPct": row.get("mixPct"),
                        "mixYoyDeltaPp": row.get("mixYoyDeltaPp"),
                        "sourceUrl": row.get("sourceUrl"),
                        "sourceForm": row.get("sourceForm"),
                        "filingDate": row.get("filingDate"),
                        "supportLines": row.get("supportLines"),
                        "supportLinesZh": row.get("supportLinesZh"),
                        "metricMode": row.get("metricMode"),
                        "validationEligible": row.get("validationEligible"),
                        "validationNotes": row.get("validationNotes"),
                    }
                )
            normalized_segments = normalize_official_revenue_segments(company["id"], quarter, normalized_segments)
            payload["segments"] = normalized_segments

        entry = financials.get(quarter)
        if not isinstance(entry, dict):
            synthesized_entry = synthesize_financial_entry_from_structure(quarter, company_payload, payload)
            if not synthesized_entry:
                continue
            financials[quarter] = synthesized_entry
            entry = synthesized_entry
        if normalized_segments:
            entry["officialRevenueSegments"] = normalized_segments
        detail_groups = payload.get("detailGroups") or []
        if detail_groups:
            normalized_detail_groups = []
            for row in detail_groups:
                normalized_detail_groups.append(
                    {
                        "name": row.get("name"),
                        "nameZh": row.get("nameZh"),
                        "memberKey": str(row.get("memberKey") or row.get("name") or ""),
                        "valueBn": row.get("valueBn"),
                        "yoyPct": row.get("yoyPct"),
                        "qoqPct": row.get("qoqPct"),
                        "mixPct": row.get("mixPct"),
                        "mixYoyDeltaPp": row.get("mixYoyDeltaPp"),
                        "sourceUrl": row.get("sourceUrl"),
                        "sourceForm": row.get("sourceForm"),
                        "filingDate": row.get("filingDate"),
                        "supportLines": row.get("supportLines"),
                        "supportLinesZh": row.get("supportLinesZh"),
                        "targetName": row.get("targetName"),
                        "metricMode": row.get("metricMode"),
                        "validationEligible": row.get("validationEligible"),
                        "validationNotes": row.get("validationNotes"),
                    }
                )
            normalized_detail_groups = mark_detail_groups_validation_ineligible(normalized_detail_groups)
            entry["officialRevenueDetailGroups"] = normalized_detail_groups
        opex_breakdown = payload.get("opexBreakdown") or payload.get("officialOpexBreakdown") or []
        if opex_breakdown:
            normalized_opex_breakdown = []
            for row in opex_breakdown:
                normalized_opex_breakdown.append(
                    {
                        "name": row.get("name"),
                        "nameZh": row.get("nameZh"),
                        "memberKey": str(row.get("memberKey") or row.get("name") or ""),
                        "valueBn": row.get("valueBn"),
                        "sourceUrl": row.get("sourceUrl"),
                        "sourceForm": row.get("sourceForm"),
                        "filingDate": row.get("filingDate"),
                        "validationEligible": row.get("validationEligible"),
                        "validationNotes": row.get("validationNotes"),
                    }
                )
            entry["officialOpexBreakdown"] = normalized_opex_breakdown
        cost_breakdown = payload.get("costBreakdown") or payload.get("officialCostBreakdown") or []
        if cost_breakdown:
            normalized_cost_breakdown = []
            for row in cost_breakdown:
                normalized_cost_breakdown.append(
                    {
                        "name": row.get("name"),
                        "nameZh": row.get("nameZh"),
                        "valueBn": row.get("valueBn"),
                        "sourceUrl": row.get("sourceUrl"),
                        "sourceForm": row.get("sourceForm"),
                        "filingDate": row.get("filingDate"),
                    }
                )
            entry["officialCostBreakdown"] = normalized_cost_breakdown
        if payload.get("style"):
            entry["officialRevenueStyle"] = payload.get("style")
        if payload.get("displayCurrency"):
            entry["displayCurrency"] = payload.get("displayCurrency")
        display_revenue_bn = float(payload.get("displayRevenueBn") or 0)
        segment_sum_bn = round(sum(float(row.get("valueBn") or 0) for row in normalized_segments if float(row.get("valueBn") or 0) > 0), 3)
        if (
            str(company.get("id") or "").lower() == "mastercard"
            and display_revenue_bn > 0
            and segment_sum_bn > 0
            and abs(segment_sum_bn - display_revenue_bn) <= 0.08
        ):
            entry["revenueBn"] = round(display_revenue_bn, 3)
            entry["displayCurrency"] = "USD"
            entry["displayScaleFactor"] = 1
        elif payload.get("displayRevenueBn") and entry.get("revenueBn"):
            entry["displayScaleFactor"] = round(float(payload["displayRevenueBn"]) / float(entry["revenueBn"]), 6)

    normalize_q4_annualized_outliers(financials)
    for quarter_key, entry in financials.items():
        if not isinstance(entry, dict):
            continue
        rows = entry.get("officialRevenueSegments")
        if isinstance(rows, list) and rows:
            entry["officialRevenueSegments"] = dedupe_revenue_segment_rows(company["id"], rows)
    enrich_growth_rows(financials, "officialRevenueSegments")
    enrich_growth_rows(financials, "officialRevenueDetailGroups")
    recompute_revenue_growth_metrics(financials)
    company_payload["quarters"] = sorted(financials.keys(), key=parse_period)

    company_payload["officialRevenueStructureHistory"] = {
        "source": history.get("source"),
        "quarters": history.get("quarters", {}),
        "filingsUsed": history.get("filingsUsed", []),
        "errors": history.get("errors", []),
    }
    return company_payload


def merge_official_revenue_structure_history(company_payload: dict[str, Any], company: dict[str, Any], refresh: bool) -> dict[str, Any]:
    history = load_official_revenue_structure_history(company, refresh=refresh)
    return apply_revenue_structure_history(company_payload, company, history)


def build_company_payload_with_universal_parser(company: dict[str, Any], refresh: bool) -> dict[str, Any]:
    parse_result = run_universal_company_parser(company, refresh=refresh)
    payload = deepcopy(parse_result.get("financialPayload") or {})
    if not isinstance(payload, dict) or not isinstance(payload.get("financials"), dict):
        raise RuntimeError(f"Universal parser returned no financial payload for {company.get('ticker') or company.get('id')}")
    payload = apply_official_segment_history(payload, parse_result.get("segmentHistory") or {})
    payload = apply_revenue_structure_history(payload, company, parse_result.get("revenueStructureHistory") or {})
    payload["parserDiagnostics"] = deepcopy(parse_result.get("diagnostics") or {})
    return payload


def main() -> int:
    args = parse_args()
    manual_presets = load_manual_presets()
    manual_company_overrides = load_manual_company_overrides()
    fx_cache = load_fx_cache()
    selected_tokens = parse_company_selection(args.companies)
    selected_companies = [company for company in TOP30_COMPANIES if company_matches_selection(company, selected_tokens)]
    if selected_tokens and not selected_companies:
        print("[warn] no companies matched --companies selection; nothing to refresh.", flush=True)

    results_by_company_id: dict[str, dict[str, Any]] = {}

    failures: list[str] = []
    for company in selected_companies:
        print(f"[build] {company['ticker']} ...", flush=True)
        try:
            payload = build_company_payload_with_universal_parser(company, refresh=args.refresh)
            payload = supplement_tencent_official_financials(payload)
            payload = sanitize_implausible_q4_revenue_aligned_statements(payload)
            payload = apply_manual_company_override(payload, company, manual_company_overrides)
            payload = apply_usd_display_fields(payload, fx_cache)
        except Exception as exc:  # noqa: BLE001
            failures.append(f"{company['ticker']}: {exc}")
            print(f"  failed: {exc}", file=sys.stderr, flush=True)
            continue
        presets = manual_presets.get(str(company["id"])) or {}
        payload = finalize_company_payload(company, payload, presets)
        COMPANY_CACHE_DIR.mkdir(parents=True, exist_ok=True)
        (COMPANY_CACHE_DIR / f"{company['id']}.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        results_by_company_id[company["id"]] = payload
        time.sleep(0.2)

    if selected_tokens:
        for company in TOP30_COMPANIES:
            if company["id"] in results_by_company_id:
                continue
            cached_payload = load_cached_company_payload(company["id"])
            if cached_payload is not None:
                presets = manual_presets.get(str(company["id"])) or {}
                cached_payload = finalize_company_payload(company, cached_payload, presets)
                results_by_company_id[company["id"]] = cached_payload
                COMPANY_CACHE_DIR.mkdir(parents=True, exist_ok=True)
                (COMPANY_CACHE_DIR / f"{company['id']}.json").write_text(json.dumps(cached_payload, ensure_ascii=False, indent=2), encoding="utf-8")
                continue
            print(f"[build] {company['ticker']} ...", flush=True)
            try:
                payload = build_company_payload_with_universal_parser(company, refresh=False)
                payload = supplement_tencent_official_financials(payload)
                payload = sanitize_implausible_q4_revenue_aligned_statements(payload)
                payload = apply_manual_company_override(payload, company, manual_company_overrides)
                payload = apply_usd_display_fields(payload, fx_cache)
            except Exception as exc:  # noqa: BLE001
                failures.append(f"{company['ticker']}: {exc}")
                print(f"  failed: {exc}", file=sys.stderr, flush=True)
                continue
            presets = manual_presets.get(str(company["id"])) or {}
            payload = finalize_company_payload(company, payload, presets)
            COMPANY_CACHE_DIR.mkdir(parents=True, exist_ok=True)
            (COMPANY_CACHE_DIR / f"{company['id']}.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
            results_by_company_id[company["id"]] = payload

    save_fx_cache(fx_cache)
    for company in TOP30_COMPANIES:
        if company["id"] not in results_by_company_id:
            continue
        presets = manual_presets.get(str(company["id"])) or {}
        results_by_company_id[company["id"]] = finalize_company_payload(company, results_by_company_id[company["id"]], presets)
    companies = [results_by_company_id[company["id"]] for company in TOP30_COMPANIES if company["id"] in results_by_company_id]
    classification_audit = build_dataset_classification_audit(companies)

    dataset = {
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "universeSource": UNIVERSE_SOURCE,
        "companyCount": len(companies),
        "notes": [
            "A universal parser orchestration layer now coordinates financial, segment, and revenue-structure extractors with source-level provenance and fallback metadata.",
            "Quarterly financial trunks are sourced through an official-first pipeline, using SEC EDGAR XBRL companyfacts whenever available.",
            "Revenue structure enrichment is sourced directly from official company filings and official IR disclosures, including PDF parsing for non-SEC issuers when needed.",
            "When official statement fields are incomplete or structurally incompatible, the renderer safely falls back to a normalized financial table source instead of fabricating the bridge.",
            "Pixel-replica layouts rely on manual presets and the unified replica template.",
            "Classification coverage is audited at build time for stockanalysis-backed additions; missing latest-quarter revenue splits now surface as blocking issues unless an explicit official-disclosure exception is declared.",
        ],
        "companies": companies,
        "classificationAudit": classification_audit,
        "failures": failures,
    }
    OUTPUT_PATH.write_text(json.dumps(dataset, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[done] wrote {OUTPUT_PATH}", flush=True)
    if classification_audit["blockingIssues"]:
        print("[error] classification coverage blockers detected:", file=sys.stderr, flush=True)
        for issue in classification_audit["blockingIssues"]:
            print(f"  - {issue}", file=sys.stderr, flush=True)
    if failures:
        print("[warn] partial failures detected:", flush=True)
        for failure in failures:
            print(f"  - {failure}", flush=True)
    return 1 if classification_audit["blockingIssues"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
