from __future__ import annotations

from copy import deepcopy
from dataclasses import asdict, dataclass, field
import math
from typing import Any, Callable

from official_financials import fetch_official_financial_history
from official_revenue_structures import fetch_official_revenue_structure_history
from official_segments import fetch_official_segment_history
from financial_source_adapters import fetch_tencent_ir_pdf_financial_history
from stockanalysis_financials import fetch_stockanalysis_financial_history
from source_adapters.base import build_error_detail, payload_error_bundle


UNIVERSAL_PARSER_VERSION = "universal-parser-v4"
FINANCIAL_RECONCILER_VERSION = "financial-reconciler-v1"
FINANCIAL_VALIDATION_VERSION = "financial-validation-v1"
FINANCIAL_VALUE_FIELDS = [
    "revenueBn",
    "revenueYoyPct",
    "revenueQoqPct",
    "costOfRevenueBn",
    "grossProfitBn",
    "grossMarginPct",
    "grossMarginYoyDeltaPp",
    "sgnaBn",
    "rndBn",
    "otherOpexBn",
    "operatingExpensesBn",
    "operatingIncomeBn",
    "operatingMarginPct",
    "operatingMarginYoyDeltaPp",
    "nonOperatingBn",
    "pretaxIncomeBn",
    "taxBn",
    "netIncomeBn",
    "netIncomeYoyPct",
    "profitMarginPct",
    "profitMarginYoyDeltaPp",
    "effectiveTaxRatePct",
]
FINANCIAL_METADATA_FIELDS = [
    "calendarQuarter",
    "periodEnd",
    "fiscalYear",
    "fiscalQuarter",
    "fiscalLabel",
    "statementCurrency",
    "statementFilingDate",
    "statementSourceUrl",
]
FINANCIAL_CORE_COMPLETENESS_FIELDS = [
    "revenueBn",
    "costOfRevenueBn",
    "grossProfitBn",
    "operatingExpensesBn",
    "operatingIncomeBn",
    "pretaxIncomeBn",
    "taxBn",
    "netIncomeBn",
]


@dataclass
class SourceAttempt:
    layer: str
    source_id: str
    status: str
    selected: bool = False
    reason: str = ""
    quarter_count: int = 0
    latest_quarter: str = ""
    error: str = ""
    error_details: list[dict[str, Any]] = field(default_factory=list)


def _parse_period(period: str) -> tuple[int, int]:
    raw = str(period or "")
    if len(raw) != 6 or raw[4] != "Q":
        return (0, 0)
    try:
        return (int(raw[:4]), int(raw[5]))
    except ValueError:
        return (0, 0)


def _sorted_quarters(values: list[str]) -> list[str]:
    return sorted((str(value) for value in values if str(value)), key=_parse_period)


def _payload_financial_quarters(payload: dict[str, Any]) -> list[str]:
    financials = payload.get("financials") if isinstance(payload.get("financials"), dict) else {}
    return _sorted_quarters(list(financials.keys()))


def _history_quarters(history: dict[str, Any]) -> list[str]:
    quarter_map = history.get("quarters") if isinstance(history.get("quarters"), dict) else {}
    return _sorted_quarters(list(quarter_map.keys()))


def _preferred_financial_sources(company: dict[str, Any]) -> list[str]:
    configured_sources = company.get("parserFinancialSources")
    if isinstance(configured_sources, list):
        normalized = [str(item).strip().lower() for item in configured_sources if str(item).strip()]
        if normalized:
            return normalized
    preferred_source = str(company.get("financialSource") or "").strip().lower()
    if preferred_source == "stockanalysis":
        return ["stockanalysis", "official"]
    return ["official", "stockanalysis"]


def _effective_financial_source_order(company: dict[str, Any], available_sources: list[str]) -> list[str]:
    order = list(_preferred_financial_sources(company))
    if str(company.get("id") or "").lower() == "tencent" and "tencent-ir-pdf" in available_sources:
        order = ["tencent-ir-pdf", *order]
    for source_id in available_sources:
        if source_id not in order:
            order.append(source_id)
    return order


def _run_source_attempt(
    layer: str,
    source_id: str,
    fetcher: Callable[[dict[str, Any], bool], dict[str, Any]],
    company: dict[str, Any],
    refresh: bool,
    is_usable: Callable[[dict[str, Any]], bool],
    quarter_getter: Callable[[dict[str, Any]], list[str]],
) -> tuple[SourceAttempt, dict[str, Any] | None]:
    try:
        payload = fetcher(company, refresh=refresh)
    except Exception as exc:  # noqa: BLE001
        return (
            SourceAttempt(
                layer=layer,
                source_id=source_id,
                status="error",
                error=str(exc),
                error_details=[
                    build_error_detail(
                        str(exc),
                        layer=layer,
                        source_id=source_id,
                        phase="fetch",
                        error_type=exc.__class__.__name__,
                    )
                ],
            ),
            None,
        )
    if not isinstance(payload, dict):
        return (
            SourceAttempt(
                layer=layer,
                source_id=source_id,
                status="error",
                error="Fetcher returned a non-dict payload.",
                error_details=[
                    build_error_detail(
                        "Fetcher returned a non-dict payload.",
                        layer=layer,
                        source_id=source_id,
                        phase="fetch",
                        error_type="InvalidPayload",
                    )
                ],
            ),
            None,
        )
    payload_errors, payload_error_details = payload_error_bundle(
        payload,
        layer=layer,
        source_id=source_id,
        phase="fetch",
    )
    quarters = quarter_getter(payload)
    status = "success" if is_usable(payload) else "empty"
    return (
        SourceAttempt(
            layer=layer,
            source_id=source_id,
            status=status,
            quarter_count=len(quarters),
            latest_quarter=quarters[-1] if quarters else "",
            error="; ".join(payload_errors) if status != "success" and payload_errors else "",
            error_details=deepcopy(payload_error_details) if status != "success" else [],
        ),
        payload,
    )


def _run_contextual_financial_adapter_attempts(
    company: dict[str, Any],
    refresh: bool,
    revenue_structure_history: dict[str, Any] | None,
) -> list[tuple[SourceAttempt, dict[str, Any] | None]]:
    adapter_attempts: list[tuple[SourceAttempt, dict[str, Any] | None]] = []
    company_id = str(company.get("id") or "").lower()
    if company_id != "tencent":
        return adapter_attempts
    if not isinstance(revenue_structure_history, dict) or not _history_quarters(revenue_structure_history):
        adapter_attempts.append(
            (
                SourceAttempt(
                    layer="financials",
                    source_id="tencent-ir-pdf",
                    status="skipped",
                    reason="Revenue structure history unavailable for Tencent IR PDF adapter.",
                ),
                None,
            )
        )
        return adapter_attempts
    adapter_attempts.append(
        _run_source_attempt(
            "financials",
            "tencent-ir-pdf",
            lambda current_company, refresh=False: fetch_tencent_ir_pdf_financial_history(
                current_company,
                revenue_structure_history,
                refresh=refresh,
            ),
            company,
            refresh,
            lambda payload: bool(_payload_financial_quarters(payload)),
            _payload_financial_quarters,
        )
    )
    return adapter_attempts


def _is_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and not math.isnan(float(value))


def _safe_float(value: Any) -> float | None:
    if not _is_number(value):
        return None
    return float(value)


def _value_tolerance(reference: float | None) -> float:
    anchor = abs(float(reference or 0))
    return max(0.12, anchor * 0.03)


def _rate_tolerance(reference: float | None) -> float:
    anchor = abs(float(reference or 0))
    return max(0.35, anchor * 0.03)


def _validate_financial_entry(entry: dict[str, Any]) -> dict[str, Any]:
    revenue = _safe_float(entry.get("revenueBn"))
    cost = _safe_float(entry.get("costOfRevenueBn"))
    gross = _safe_float(entry.get("grossProfitBn"))
    opex = _safe_float(entry.get("operatingExpensesBn"))
    operating = _safe_float(entry.get("operatingIncomeBn"))
    non_operating = _safe_float(entry.get("nonOperatingBn"))
    pretax = _safe_float(entry.get("pretaxIncomeBn"))
    tax = _safe_float(entry.get("taxBn"))
    net_income = _safe_float(entry.get("netIncomeBn"))
    gross_margin = _safe_float(entry.get("grossMarginPct"))
    operating_margin = _safe_float(entry.get("operatingMarginPct"))
    profit_margin = _safe_float(entry.get("profitMarginPct"))
    tax_rate = _safe_float(entry.get("effectiveTaxRatePct"))

    issues: list[dict[str, Any]] = []
    checks_run = 0
    checks_passed = 0

    def run_relation(
        code: str,
        left_label: str,
        left_value: float | None,
        right_label: str,
        right_value: float | None,
        expected_label: str,
        expected_value: float | None,
        *,
        subtract: bool = True,
    ) -> None:
        nonlocal checks_run, checks_passed
        if left_value is None or right_value is None or expected_value is None:
            return
        checks_run += 1
        derived_value = left_value - right_value if subtract else left_value + right_value
        tolerance = _value_tolerance(expected_value)
        delta = round(expected_value - derived_value, 3)
        if abs(delta) <= tolerance:
            checks_passed += 1
            return
        issues.append(
            {
                "code": code,
                "severity": "warning",
                "message": f"{expected_label} does not reconcile with {left_label} and {right_label}.",
                "expected": round(expected_value, 3),
                "derived": round(derived_value, 3),
                "delta": delta,
                "tolerance": round(tolerance, 3),
            }
        )

    def run_margin(code: str, numerator_label: str, numerator: float | None, denominator_label: str, denominator: float | None, reported_label: str, reported_value: float | None) -> None:
        nonlocal checks_run, checks_passed
        if numerator is None or denominator in (None, 0) or reported_value is None:
            return
        checks_run += 1
        derived_value = round(numerator / denominator * 100, 3)
        tolerance = _rate_tolerance(reported_value)
        delta = round(reported_value - derived_value, 3)
        if abs(delta) <= tolerance:
            checks_passed += 1
            return
        issues.append(
            {
                "code": code,
                "severity": "warning",
                "message": f"{reported_label} does not reconcile with {numerator_label} and {denominator_label}.",
                "expected": round(reported_value, 3),
                "derived": derived_value,
                "delta": delta,
                "tolerance": round(tolerance, 3),
            }
        )

    run_relation("revenue-minus-cost-equals-gross", "revenueBn", revenue, "costOfRevenueBn", cost, "grossProfitBn", gross)
    run_relation("gross-minus-opex-equals-operating", "grossProfitBn", gross, "operatingExpensesBn", opex, "operatingIncomeBn", operating)
    run_relation("operating-plus-nonoperating-equals-pretax", "operatingIncomeBn", operating, "nonOperatingBn", non_operating, "pretaxIncomeBn", pretax, subtract=False)
    run_relation("pretax-minus-tax-equals-net", "pretaxIncomeBn", pretax, "taxBn", tax, "netIncomeBn", net_income)
    run_margin("gross-margin-check", "grossProfitBn", gross, "revenueBn", revenue, "grossMarginPct", gross_margin)
    run_margin("operating-margin-check", "operatingIncomeBn", operating, "revenueBn", revenue, "operatingMarginPct", operating_margin)
    run_margin("profit-margin-check", "netIncomeBn", net_income, "revenueBn", revenue, "profitMarginPct", profit_margin)
    run_margin("tax-rate-check", "taxBn", tax, "pretaxIncomeBn", pretax, "effectiveTaxRatePct", tax_rate)

    completeness_count = sum(1 for field in FINANCIAL_CORE_COMPLETENESS_FIELDS if _is_number(entry.get(field)))
    completeness_score = round(completeness_count / len(FINANCIAL_CORE_COMPLETENESS_FIELDS), 4)
    consistency_score = round(checks_passed / checks_run, 4) if checks_run else 0.5
    confidence_score = round(min(1.0, completeness_score * 0.55 + consistency_score * 0.45), 4)
    if confidence_score >= 0.85:
        status = "high"
    elif confidence_score >= 0.65:
        status = "medium"
    else:
        status = "low"
    return {
        "version": FINANCIAL_VALIDATION_VERSION,
        "status": status,
        "confidenceScore": confidence_score,
        "completenessScore": completeness_score,
        "consistencyScore": consistency_score,
        "checksRun": checks_run,
        "checksPassed": checks_passed,
        "issueCount": len(issues),
        "issues": issues,
    }


def _build_financial_validation_summary(financial_payload: dict[str, Any]) -> dict[str, Any]:
    financials = financial_payload.get("financials") if isinstance(financial_payload.get("financials"), dict) else {}
    ordered_quarters = _sorted_quarters(list(financials.keys()))
    confidence_scores: list[float] = []
    issue_count = 0
    mismatch_quarters = 0
    high_confidence_quarters = 0
    latest_quarter = ordered_quarters[-1] if ordered_quarters else ""
    latest_validation: dict[str, Any] = {}
    for quarter in ordered_quarters:
        entry = financials.get(quarter)
        if not isinstance(entry, dict):
            continue
        validation = _validate_financial_entry(entry)
        entry["parserFinancialValidation"] = validation
        confidence_scores.append(float(validation.get("confidenceScore") or 0))
        issue_count += int(validation.get("issueCount") or 0)
        if int(validation.get("issueCount") or 0) > 0:
            mismatch_quarters += 1
        if str(validation.get("status")) == "high":
            high_confidence_quarters += 1
        if quarter == latest_quarter:
            latest_validation = validation
    average_confidence = round(sum(confidence_scores) / len(confidence_scores), 4) if confidence_scores else 0.0
    if average_confidence >= 0.85:
        status = "high"
    elif average_confidence >= 0.65:
        status = "medium"
    else:
        status = "low"
    return {
        "version": FINANCIAL_VALIDATION_VERSION,
        "status": status,
        "quarterCount": len(ordered_quarters),
        "validatedQuarterCount": len(confidence_scores),
        "issueCount": issue_count,
        "mismatchQuarterCount": mismatch_quarters,
        "highConfidenceQuarterCount": high_confidence_quarters,
        "averageConfidenceScore": average_confidence,
        "latestQuarter": latest_quarter,
        "latestQuarterConfidenceScore": latest_validation.get("confidenceScore"),
        "latestQuarterIssueCount": latest_validation.get("issueCount"),
    }


def _choose_first_non_empty(entries_by_source: dict[str, dict[str, Any]], source_order: list[str], field: str) -> tuple[Any, str]:
    for source_id in source_order:
        entry = entries_by_source.get(source_id)
        if not isinstance(entry, dict):
            continue
        value = entry.get(field)
        if value not in (None, "", []):
            return deepcopy(value), source_id
    return None, ""


def _derive_missing_financial_fields(entry: dict[str, Any], field_sources: dict[str, str]) -> None:
    revenue = entry.get("revenueBn")
    cost = entry.get("costOfRevenueBn")
    gross = entry.get("grossProfitBn")
    operating_expenses = entry.get("operatingExpensesBn")
    operating_income = entry.get("operatingIncomeBn")
    non_operating = entry.get("nonOperatingBn")
    pretax_income = entry.get("pretaxIncomeBn")
    tax = entry.get("taxBn")
    net_income = entry.get("netIncomeBn")

    # Bank-like statements often disclose revenue/opex/pretax but omit a classical
    # cost-of-revenue + gross-profit stage. Recover a stable bridge conservatively.
    if (
        gross is None
        and cost is None
        and _is_number(revenue)
        and _is_number(operating_expenses)
        and (
            _is_number(operating_income)
            or _is_number(pretax_income)
        )
    ):
        revenue_value = float(revenue)
        opex_value = float(operating_expenses)
        operating_proxy = float(operating_income) if _is_number(operating_income) else revenue_value - opex_value
        pretax_value = float(pretax_income) if _is_number(pretax_income) else None
        if pretax_value is not None:
            proxy_gap = abs(operating_proxy - pretax_value)
            proxy_tolerance = max(1.2, abs(revenue_value) * 0.2)
            if proxy_gap > proxy_tolerance:
                operating_proxy = float("nan")
        if _is_number(operating_proxy):
            if operating_income is None:
                entry["operatingIncomeBn"] = round(float(operating_proxy), 3)
                field_sources["operatingIncomeBn"] = "derived"
            entry["grossProfitBn"] = round(revenue_value, 3)
            entry["costOfRevenueBn"] = 0.0
            field_sources["grossProfitBn"] = "derived"
            field_sources["costOfRevenueBn"] = "derived"
            if non_operating is None and _is_number(entry.get("pretaxIncomeBn")) and _is_number(entry.get("operatingIncomeBn")):
                entry["nonOperatingBn"] = round(float(entry["pretaxIncomeBn"]) - float(entry["operatingIncomeBn"]), 3)
                field_sources["nonOperatingBn"] = "derived"

    if gross is None and _is_number(revenue) and _is_number(cost):
        entry["grossProfitBn"] = round(float(revenue) - float(cost), 3)
        field_sources["grossProfitBn"] = "derived"
    if cost is None and _is_number(revenue) and _is_number(entry.get("grossProfitBn")):
        entry["costOfRevenueBn"] = round(float(revenue) - float(entry["grossProfitBn"]), 3)
        field_sources["costOfRevenueBn"] = "derived"
    if operating_expenses is None and _is_number(entry.get("grossProfitBn")) and _is_number(operating_income):
        entry["operatingExpensesBn"] = round(float(entry["grossProfitBn"]) - float(operating_income), 3)
        field_sources["operatingExpensesBn"] = "derived"
    if operating_income is None and _is_number(entry.get("grossProfitBn")) and _is_number(entry.get("operatingExpensesBn")):
        entry["operatingIncomeBn"] = round(float(entry["grossProfitBn"]) - float(entry["operatingExpensesBn"]), 3)
        field_sources["operatingIncomeBn"] = "derived"
    if pretax_income is None and _is_number(entry.get("operatingIncomeBn")) and _is_number(non_operating):
        entry["pretaxIncomeBn"] = round(float(entry["operatingIncomeBn"]) + float(non_operating), 3)
        field_sources["pretaxIncomeBn"] = "derived"
    if non_operating is None and _is_number(entry.get("pretaxIncomeBn")) and _is_number(entry.get("operatingIncomeBn")):
        entry["nonOperatingBn"] = round(float(entry["pretaxIncomeBn"]) - float(entry["operatingIncomeBn"]), 3)
        field_sources["nonOperatingBn"] = "derived"
    if net_income is None and _is_number(entry.get("pretaxIncomeBn")) and _is_number(tax):
        entry["netIncomeBn"] = round(float(entry["pretaxIncomeBn"]) - float(tax), 3)
        field_sources["netIncomeBn"] = "derived"
    if tax is None and _is_number(entry.get("pretaxIncomeBn")) and _is_number(entry.get("netIncomeBn")):
        entry["taxBn"] = round(float(entry["pretaxIncomeBn"]) - float(entry["netIncomeBn"]), 3)
        field_sources["taxBn"] = "derived"
    if entry.get("grossMarginPct") is None and _is_number(entry.get("grossProfitBn")) and _is_number(revenue) and float(revenue) != 0:
        entry["grossMarginPct"] = round(float(entry["grossProfitBn"]) / float(revenue) * 100, 3)
        field_sources["grossMarginPct"] = "derived"
    if entry.get("operatingMarginPct") is None and _is_number(entry.get("operatingIncomeBn")) and _is_number(revenue) and float(revenue) != 0:
        entry["operatingMarginPct"] = round(float(entry["operatingIncomeBn"]) / float(revenue) * 100, 3)
        field_sources["operatingMarginPct"] = "derived"
    if entry.get("profitMarginPct") is None and _is_number(entry.get("netIncomeBn")) and _is_number(revenue) and float(revenue) != 0:
        entry["profitMarginPct"] = round(float(entry["netIncomeBn"]) / float(revenue) * 100, 3)
        field_sources["profitMarginPct"] = "derived"
    if entry.get("effectiveTaxRatePct") is None and _is_number(entry.get("taxBn")) and _is_number(entry.get("pretaxIncomeBn")) and float(entry["pretaxIncomeBn"]) != 0:
        entry["effectiveTaxRatePct"] = round(float(entry["taxBn"]) / float(entry["pretaxIncomeBn"]) * 100, 3)
        field_sources["effectiveTaxRatePct"] = "derived"


def _enrich_growth_metrics(financials: dict[str, dict[str, Any]], field_source_map: dict[str, dict[str, str]]) -> None:
    ordered_quarters = _sorted_quarters(list(financials.keys()))
    for quarter in ordered_quarters:
        entry = financials.get(quarter)
        if not isinstance(entry, dict):
            continue
        year = int(quarter[:4])
        quarter_num = int(quarter[-1])
        prior_year_key = f"{year - 1}Q{quarter_num}"
        prior_quarter_key = f"{year - 1}Q4" if quarter_num == 1 else f"{year}Q{quarter_num - 1}"
        prior_year = financials.get(prior_year_key) if isinstance(financials.get(prior_year_key), dict) else None
        prior_quarter = financials.get(prior_quarter_key) if isinstance(financials.get(prior_quarter_key), dict) else None
        field_sources = field_source_map.setdefault(quarter, {})
        if entry.get("revenueYoyPct") is None and prior_year and _is_number(entry.get("revenueBn")) and _is_number(prior_year.get("revenueBn")) and float(prior_year["revenueBn"]) != 0:
            entry["revenueYoyPct"] = round((float(entry["revenueBn"]) / float(prior_year["revenueBn"]) - 1) * 100, 3)
            field_sources["revenueYoyPct"] = "derived"
        if entry.get("netIncomeYoyPct") is None and prior_year and _is_number(entry.get("netIncomeBn")) and _is_number(prior_year.get("netIncomeBn")) and float(prior_year["netIncomeBn"]) != 0:
            entry["netIncomeYoyPct"] = round((float(entry["netIncomeBn"]) / float(prior_year["netIncomeBn"]) - 1) * 100, 3)
            field_sources["netIncomeYoyPct"] = "derived"
        if entry.get("revenueQoqPct") is None and prior_quarter and _is_number(entry.get("revenueBn")) and _is_number(prior_quarter.get("revenueBn")) and float(prior_quarter["revenueBn"]) != 0:
            entry["revenueQoqPct"] = round((float(entry["revenueBn"]) / float(prior_quarter["revenueBn"]) - 1) * 100, 3)
            field_sources["revenueQoqPct"] = "derived"
        for field_name, delta_field in [
            ("grossMarginPct", "grossMarginYoyDeltaPp"),
            ("operatingMarginPct", "operatingMarginYoyDeltaPp"),
            ("profitMarginPct", "profitMarginYoyDeltaPp"),
        ]:
            if entry.get(delta_field) is None and prior_year and _is_number(entry.get(field_name)) and _is_number(prior_year.get(field_name)):
                entry[delta_field] = round(float(entry[field_name]) - float(prior_year[field_name]), 3)
                field_sources[delta_field] = "derived"


def _reconcile_financial_payloads(
    company: dict[str, Any],
    preferred_sources: list[str],
    financial_attempts_raw: list[tuple[SourceAttempt, dict[str, Any] | None]],
) -> tuple[dict[str, Any], dict[str, Any]]:
    source_payloads = {
        attempt.source_id: payload
        for attempt, payload in financial_attempts_raw
        if attempt.status == "success" and isinstance(payload, dict)
    }
    primary_source = next((source_id for source_id in preferred_sources if source_id in source_payloads), "")
    if not primary_source:
        raise RuntimeError(f"No successful financial payload available for {company.get('ticker') or company.get('id')}")
    primary_payload = deepcopy(source_payloads[primary_source])
    primary_payload["statementSource"] = primary_payload.get("statementSource") or primary_source
    all_quarters = _sorted_quarters(
        list(
            {
            quarter
            for payload in source_payloads.values()
            for quarter in _payload_financial_quarters(payload)
            }
        )
    )
    reconciled_financials: dict[str, dict[str, Any]] = {}
    field_source_map: dict[str, dict[str, str]] = {}
    source_usage_counts = {source_id: 0 for source_id in source_payloads.keys()}
    derived_field_count = 0
    field_override_count = 0
    mixed_source_quarter_count = 0
    for quarter in all_quarters:
        entries_by_source = {
            source_id: (payload.get("financials") or {}).get(quarter)
            for source_id, payload in source_payloads.items()
        }
        template_source = next(
            (source_id for source_id in preferred_sources if isinstance(entries_by_source.get(source_id), dict)),
            next((source_id for source_id, entry in entries_by_source.items() if isinstance(entry, dict)), primary_source),
        )
        template_entry = deepcopy(entries_by_source.get(template_source) or {})
        reconciled_entry = template_entry
        quarter_field_sources: dict[str, str] = {}
        quarter_candidate_counts: dict[str, int] = {}
        for field in FINANCIAL_VALUE_FIELDS:
            candidates = [
                source_id
                for source_id in preferred_sources
                if isinstance(entries_by_source.get(source_id), dict) and entries_by_source[source_id].get(field) is not None
            ]
            quarter_candidate_counts[field] = len(candidates)
            if not candidates:
                continue
            selected_source = candidates[0]
            selected_value = deepcopy(entries_by_source[selected_source].get(field))
            original_value = reconciled_entry.get(field)
            reconciled_entry[field] = selected_value
            quarter_field_sources[field] = selected_source
            source_usage_counts[selected_source] = source_usage_counts.get(selected_source, 0) + 1
            if original_value != selected_value and template_source and selected_source != template_source:
                field_override_count += 1
        for field in FINANCIAL_METADATA_FIELDS:
            selected_value, selected_source = _choose_first_non_empty(entries_by_source, preferred_sources, field)
            if selected_source:
                reconciled_entry[field] = selected_value
                quarter_field_sources.setdefault(field, selected_source)
        _derive_missing_financial_fields(reconciled_entry, quarter_field_sources)
        derived_field_count += sum(1 for source_id in quarter_field_sources.values() if source_id == "derived")
        chosen_non_derived_sources = {
            source_id
            for field_name, source_id in quarter_field_sources.items()
            if field_name in FINANCIAL_VALUE_FIELDS and source_id and source_id != "derived"
        }
        if len(chosen_non_derived_sources) > 1:
            mixed_source_quarter_count += 1
        if quarter_field_sources:
            reconciled_entry["parserFinancialFieldSources"] = quarter_field_sources
            reconciled_entry["parserFinancialCandidateCounts"] = quarter_candidate_counts
        reconciled_financials[quarter] = reconciled_entry
        field_source_map[quarter] = quarter_field_sources
    _enrich_growth_metrics(reconciled_financials, field_source_map)
    primary_payload["financials"] = reconciled_financials
    primary_payload["quarters"] = all_quarters
    primary_payload["statementSource"] = (
        f"{primary_payload.get('statementSource') or primary_source}+field-reconciled"
        if mixed_source_quarter_count or field_override_count
        else (primary_payload.get("statementSource") or primary_source)
    )
    reconciliation_summary = {
        "version": FINANCIAL_RECONCILER_VERSION,
        "primarySource": primary_source,
        "quarterCount": len(all_quarters),
        "fieldOverrideCount": field_override_count,
        "derivedFieldCount": derived_field_count,
        "mixedSourceQuarterCount": mixed_source_quarter_count,
        "sourceUsageCounts": source_usage_counts,
    }
    return primary_payload, reconciliation_summary


def _select_first_successful(
    attempts: list[tuple[SourceAttempt, dict[str, Any] | None]],
    preferred_sources: list[str],
) -> tuple[dict[str, Any] | None, str | None]:
    attempts_by_source = {attempt.source_id: (attempt, payload) for attempt, payload in attempts}
    for source_id in preferred_sources:
        attempt_payload = attempts_by_source.get(source_id)
        if not attempt_payload:
            continue
        attempt, payload = attempt_payload
        if attempt.status == "success" and isinstance(payload, dict):
            attempt.selected = True
            return payload, attempt.source_id
    return None, None


def run_universal_company_parser(company: dict[str, Any], refresh: bool = False) -> dict[str, Any]:
    base_preferred_sources = _preferred_financial_sources(company)
    financial_fetchers: dict[str, Callable[[dict[str, Any], bool], dict[str, Any]]] = {
        "official": fetch_official_financial_history,
        "stockanalysis": fetch_stockanalysis_financial_history,
    }
    financial_attempts_raw: list[tuple[SourceAttempt, dict[str, Any] | None]] = []
    for source_id in base_preferred_sources:
        fetcher = financial_fetchers.get(source_id)
        if fetcher is None:
            financial_attempts_raw.append(
                (
                    SourceAttempt(
                        layer="financials",
                        source_id=source_id,
                        status="skipped",
                        reason="Unregistered financial source.",
                    ),
                    None,
                )
            )
            continue
        financial_attempts_raw.append(
            _run_source_attempt(
                "financials",
                source_id,
                fetcher,
                company,
                refresh,
                lambda payload: bool(_payload_financial_quarters(payload)),
                _payload_financial_quarters,
            )
        )
    segment_attempt, segment_history = _run_source_attempt(
        "segments",
        "official-segments",
        fetch_official_segment_history,
        company,
        refresh,
        lambda payload: bool(_history_quarters(payload)),
        _history_quarters,
    )
    if segment_attempt.status == "success":
        segment_attempt.selected = True
    revenue_structure_attempt, revenue_structure_history = _run_source_attempt(
        "revenue-structures",
        "official-revenue-structures",
        fetch_official_revenue_structure_history,
        company,
        refresh,
        lambda payload: bool(_history_quarters(payload)),
        _history_quarters,
    )
    if revenue_structure_attempt.status == "success":
        revenue_structure_attempt.selected = True
    financial_attempts_raw.extend(
        _run_contextual_financial_adapter_attempts(
            company,
            refresh,
            revenue_structure_history if isinstance(revenue_structure_history, dict) else {},
        )
    )

    successful_financial_sources = [
        attempt.source_id
        for attempt, payload in financial_attempts_raw
        if attempt.status == "success" and isinstance(payload, dict)
    ]
    effective_preferred_sources = _effective_financial_source_order(company, successful_financial_sources)
    selected_financial_payload, selected_financial_source = _select_first_successful(
        financial_attempts_raw,
        effective_preferred_sources,
    )
    if selected_financial_payload is None:
        errors = [attempt.error for attempt, _payload in financial_attempts_raw if attempt.error]
        raise RuntimeError(
            "; ".join(errors) if errors else f"No usable financial payload found for {company.get('ticker') or company.get('id')}"
        )
    if selected_financial_source and selected_financial_source != effective_preferred_sources[0]:
        for attempt, _payload in financial_attempts_raw:
            if attempt.selected:
                attempt.reason = f"Selected after fallback from preferred source {effective_preferred_sources[0]}."
                break

    reconciled_financial_payload, financial_reconciliation_summary = _reconcile_financial_payloads(company, effective_preferred_sources, financial_attempts_raw)
    financial_validation_summary = _build_financial_validation_summary(reconciled_financial_payload)
    diagnostics = {
        "version": UNIVERSAL_PARSER_VERSION,
        "financials": {
            "basePreferredOrder": base_preferred_sources,
            "preferredOrder": effective_preferred_sources,
            "selectedSource": selected_financial_source,
            "attempts": [asdict(attempt) for attempt, _payload in financial_attempts_raw],
            "reconciliation": financial_reconciliation_summary,
            "validation": financial_validation_summary,
        },
        "segments": {
            "selectedSource": segment_attempt.source_id if segment_attempt.status == "success" else "",
            "attempts": [asdict(segment_attempt)],
        },
        "revenueStructures": {
            "selectedSource": revenue_structure_attempt.source_id if revenue_structure_attempt.status == "success" else "",
            "attempts": [asdict(revenue_structure_attempt)],
        },
        "summary": {
            "financialQuarterCount": len(_payload_financial_quarters(reconciled_financial_payload)),
            "segmentQuarterCount": len(_history_quarters(segment_history or {})),
            "revenueStructureQuarterCount": len(_history_quarters(revenue_structure_history or {})),
        },
    }
    return {
        "financialPayload": reconciled_financial_payload,
        "segmentHistory": segment_history if isinstance(segment_history, dict) else {},
        "revenueStructureHistory": revenue_structure_history if isinstance(revenue_structure_history, dict) else {},
        "diagnostics": diagnostics,
    }
