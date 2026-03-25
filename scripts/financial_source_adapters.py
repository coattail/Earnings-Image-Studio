from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from document_parser import parse_income_statement_from_url, statement_value_to_bn

ROOT_DIR = Path(__file__).resolve().parents[1]
CACHE_DIR = ROOT_DIR / "data" / "cache" / "financial-source-adapters"


def _cache_path(name: str) -> Path:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    return CACHE_DIR / name


def _load_cached_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def _write_cached_json(path: Path, payload: Any) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


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
    if not rows:
        return None
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
    net_income_current = equity_values[0]
    net_income_prior = equity_values[1] if len(equity_values) > 1 else None
    if revenue_current <= 0 or gross_current <= 0 or net_income_current <= 0:
        return None

    cost_current = abs(cost_values[0]) if cost_values else max(revenue_current - gross_current, 0)
    selling_current = abs(selling_values[0]) if selling_values else 0
    ga_current = abs(ga_values[0]) if ga_values else 0
    other_current = other_values[0] if other_values else 0
    explicit_operating_expenses_current = selling_current + ga_current + (abs(other_current) if other_current < 0 else 0)
    if explicit_operating_expenses_current > 0:
        operating_expenses_current = explicit_operating_expenses_current
        operating_current = gross_current - operating_expenses_current
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


def fetch_tencent_ir_pdf_financial_history(
    company: dict[str, Any],
    revenue_structure_history: dict[str, Any],
    refresh: bool = False,
) -> dict[str, Any]:
    cache_path = _cache_path(f"tencent-ir-pdf-{company.get('id')}.json")
    if cache_path.exists() and not refresh:
        return _load_cached_json(cache_path)
    result = {
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
