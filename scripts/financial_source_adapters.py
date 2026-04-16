from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from document_parser import parse_income_statement_from_url, statement_value_to_bn

ROOT_DIR = Path(__file__).resolve().parents[1]
CACHE_DIR = ROOT_DIR / "data" / "cache" / "financial-source-adapters"
FINANCIAL_SOURCE_ADAPTERS_CACHE_VERSION = "financial-source-adapters-v1"


def _cache_path(name: str) -> Path:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    return CACHE_DIR / name


def _load_cached_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def _write_cached_json(path: Path, payload: Any) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def _is_current_financial_source_adapter_cache(payload: Any) -> bool:
    return isinstance(payload, dict) and payload.get("_cacheVersion") == FINANCIAL_SOURCE_ADAPTERS_CACHE_VERSION


def quarter_end_date(quarter_key: str) -> str | None:
    if len(quarter_key) != 6 or quarter_key[4] != "Q":
        return None
    try:
        year = int(quarter_key[:4])
        quarter = int(quarter_key[5])
    except ValueError:
        return None
    return {
        1: f"{year:04d}-03-31",
        2: f"{year:04d}-06-30",
        3: f"{year:04d}-09-30",
        4: f"{year:04d}-12-31",
    }.get(quarter)


def parse_period(period: str) -> tuple[int, int]:
    raw = str(period or "")
    if len(raw) != 6 or raw[4] != "Q":
        return (0, 0)
    try:
        return (int(raw[:4]), int(raw[5]))
    except ValueError:
        return (0, 0)


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
    rows = statement.rows
    lines = statement.lines if isinstance(statement.lines, list) else []
    if not rows and not lines:
        return None

    def direct_row_values(label: str) -> list[float]:
        escaped = re.escape(label).replace(r"\ ", r"\s+")
        pattern = re.compile(rf"^{escaped}\s+(.+)$", re.IGNORECASE)
        best_values: list[float] = []
        best_score: tuple[int, int, float] | None = None
        for line in lines:
            match = pattern.match(str(line or ""))
            if not match:
                continue
            values = [
                float(token.replace(",", "").replace("(", "-").replace(")", ""))
                for token in re.findall(r"\(?\d[\d,]*(?:\.\d+)?\)?", match.group(1))
            ]
            if not values:
                continue
            normalized_line = re.sub(r"\s+", " ", str(line or "")).strip()
            score = 0
            if len(values) == 4:
                score += 12
            elif len(values) == 2:
                score += 8
            elif len(values) >= 3:
                score += 4
            if re.search(r"\b(?:was|were|up|down|year-on-year|yoy|quarter)\b|for the year ended|for the fourth quarter", normalized_line, re.IGNORECASE):
                score -= 12
            if ":" in normalized_line:
                score -= 6
            score_key = (score, len(values), abs(values[0]) if values else 0.0)
            if best_score is None or score_key > best_score:
                best_score = score_key
                best_values = values
        return best_values

    def table_or_row_values(label: str, row_key: str) -> list[float]:
        return direct_row_values(label) or rows.get(row_key) or []

    revenue_values = table_or_row_values("Revenues", "revenue")
    cost_values = table_or_row_values("Cost of revenues", "cost_of_revenue")
    gross_values = table_or_row_values("Gross profit", "gross_profit")
    selling_values = table_or_row_values("Selling and marketing expenses", "selling_marketing")
    ga_values = table_or_row_values("General and administrative expenses", "general_admin")
    other_values = table_or_row_values("Other gains/(losses), net", "other_gains_losses")
    operating_values = table_or_row_values("Operating profit", "operating_profit")
    pretax_values = table_or_row_values("Profit before income tax", "pretax_income")
    tax_values = table_or_row_values("Income tax expense", "income_tax")
    equity_values = table_or_row_values("Equity holders of the Company", "net_income_attributable") or rows.get("net_income") or []
    if not (revenue_values and gross_values and operating_values and pretax_values and tax_values and equity_values):
        return None
    bn_scale = statement.metadata.get("bnScale") if isinstance(statement.metadata, dict) else None
    if bn_scale is None:
        sample = "\n".join(lines[:40])
        if re.search(r"\bRMB\s+in\s+millions(?:\s*,\s*unless\s+specified)?\b", sample, re.IGNORECASE):
            bn_scale = 0.001
        elif re.search(r"人民币百万元(?:，除非另有说明)?", sample):
            bn_scale = 0.001
    if bn_scale is None:
        return None

    def to_bn(value: float | int | None) -> float | None:
        if value is None:
            return None
        return round(float(value) * float(bn_scale), 3)

    revenue_current = revenue_values[0]
    revenue_prior = revenue_values[1] if len(revenue_values) > 1 else None
    gross_current = gross_values[0]
    gross_prior = gross_values[1] if len(gross_values) > 1 else None
    reported_operating_current = operating_values[0]
    reported_operating_prior = operating_values[1] if len(operating_values) > 1 else None
    pretax_current = pretax_values[0]
    tax_current = tax_values[0]
    net_income_current = equity_values[0]
    net_income_prior = equity_values[1] if len(equity_values) > 1 else None
    if revenue_current <= 0 or gross_current <= 0 or net_income_current <= 0:
        return None

    cost_current = abs(cost_values[0]) if cost_values else max(revenue_current - gross_current, 0)
    selling_current = abs(selling_values[0]) if selling_values else 0
    ga_current = abs(ga_values[0]) if ga_values else 0
    other_current = other_values[0] if other_values else 0
    explicit_operating_expenses_current = max(selling_current + ga_current - other_current, 0)
    if explicit_operating_expenses_current > 0:
        operating_expenses_current = explicit_operating_expenses_current
        operating_current = reported_operating_current if reported_operating_current is not None else gross_current - operating_expenses_current
    else:
        operating_current = reported_operating_current
        operating_expenses_current = max(gross_current - operating_current, 0)
    operating_prior = reported_operating_prior if gross_prior is not None else None
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
        "revenueBn": to_bn(revenue_current),
        "revenueYoyPct": round((revenue_current / revenue_prior - 1) * 100, 3) if revenue_prior and revenue_prior > 0 else None,
        "costOfRevenueBn": to_bn(cost_current),
        "grossProfitBn": to_bn(gross_current),
        "sgnaBn": to_bn(selling_current + ga_current) if selling_current or ga_current else None,
        "rndBn": None,
        "otherOpexBn": to_bn(abs(other_current)) if other_current < 0 else None,
        "operatingExpensesBn": to_bn(operating_expenses_current),
        "operatingIncomeBn": to_bn(operating_current),
        "nonOperatingBn": to_bn(pretax_current - operating_current),
        "pretaxIncomeBn": to_bn(pretax_current),
        "taxBn": to_bn(abs(tax_current)),
        "netIncomeBn": to_bn(net_income_current),
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


def fetch_tencent_ir_pdf_financial_history(
    company: dict[str, Any],
    revenue_structure_history: dict[str, Any],
    refresh: bool = False,
) -> dict[str, Any]:
    cache_path = _cache_path(f"tencent-ir-pdf-{company.get('id')}.json")
    if cache_path.exists() and not refresh:
        cached_payload = _load_cached_json(cache_path)
        if _is_current_financial_source_adapter_cache(cached_payload):
            return cached_payload
    result = {
        "_cacheVersion": FINANCIAL_SOURCE_ADAPTERS_CACHE_VERSION,
        "id": company["id"],
        "ticker": company["ticker"],
        "nameZh": company["nameZh"],
        "nameEn": company["nameEn"],
        "slug": company["slug"],
        "rank": company["rank"],
        "isAdr": company["isAdr"],
        "brand": company["brand"],
        "quarters": [],
        "financials": {},
        "statementSource": "tencent-ir-pdf",
        "statementSourceUrl": None,
        "reportingCurrency": "CNY",
        "errors": [],
    }
    if str(company.get("id") or "") != "tencent":
        _write_cached_json(cache_path, result)
        return result
    quarter_map = revenue_structure_history.get("quarters") if isinstance(revenue_structure_history.get("quarters"), dict) else {}
    for quarter_key, payload in quarter_map.items():
        segment_rows = payload.get("segments") if isinstance(payload, dict) else []
        if not isinstance(segment_rows, list):
            continue
        source_url = next((str(row.get("sourceUrl") or "") for row in segment_rows if isinstance(row, dict) and str(row.get("sourceUrl") or "").endswith(".pdf")), "")
        filing_date = next((str(row.get("filingDate") or "") for row in segment_rows if isinstance(row, dict) and row.get("filingDate")), "") or quarter_end_date(str(quarter_key)) or ""
        if not source_url:
            continue
        entry = _parse_tencent_pdf_financial_entry(str(quarter_key), source_url, filing_date)
        if not entry:
            continue
        result["financials"][str(quarter_key)] = entry
        if not result["statementSourceUrl"]:
            result["statementSourceUrl"] = source_url
    ordered_quarters = sorted(result["financials"].keys(), key=parse_period)
    for quarter_key in ordered_quarters:
        entry = result["financials"][quarter_key]
        prior_quarter_key = _quarter_prior_key(quarter_key)
        prior_quarter_revenue = float((result["financials"].get(prior_quarter_key or "") or {}).get("revenueBn") or 0)
        prior_year_key = f"{int(quarter_key[:4]) - 1}{quarter_key[4:]}" if quarter_key[:4].isdigit() else ""
        prior_year_revenue = float((result["financials"].get(prior_year_key) or {}).get("revenueBn") or 0)
        revenue_bn = float(entry.get("revenueBn") or 0)
        if revenue_bn > 0 and prior_quarter_revenue > 0:
            entry["revenueQoqPct"] = round((revenue_bn / prior_quarter_revenue - 1) * 100, 3)
        if revenue_bn > 0 and prior_year_revenue > 0:
            entry["revenueYoyPct"] = round((revenue_bn / prior_year_revenue - 1) * 100, 3)
    result["quarters"] = ordered_quarters
    _write_cached_json(cache_path, result)
    return result
