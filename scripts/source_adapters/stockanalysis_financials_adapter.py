from __future__ import annotations

from typing import Any

from stockanalysis_financials import fetch_stockanalysis_financial_history

from .base import AdapterResult, build_error_detail, payload_error_bundle


FIELD_PRIORITIES = {
    "revenueBn": 72,
    "costOfRevenueBn": 70,
    "grossProfitBn": 70,
    "sgnaBn": 66,
    "rndBn": 66,
    "operatingExpensesBn": 70,
    "operatingIncomeBn": 70,
    "pretaxIncomeBn": 70,
    "taxBn": 66,
    "netIncomeBn": 70,
}


def run(company: dict[str, Any], refresh: bool = False, base_payload: dict[str, Any] | None = None) -> AdapterResult:
    del base_payload
    enabled = str(company.get("financialSource") or "") == "stockanalysis"
    payload: dict[str, Any] = {}
    errors: list[str] = []
    error_details: list[dict[str, Any]] = []
    if enabled:
        try:
            payload = fetch_stockanalysis_financial_history(company, refresh=refresh)
            errors, error_details = payload_error_bundle(
                payload,
                layer="financials",
                source_id="stockanalysis_financials",
                phase="fetch",
            )
        except Exception as exc:
            company_label = str(company.get("ticker") or company.get("id") or "unknown").strip() or "unknown"
            errors = [f"stockanalysis fetch failed for {company_label}: {exc}"]
            error_details = [
                build_error_detail(
                    str(exc),
                    layer="financials",
                    source_id="stockanalysis_financials",
                    phase="fetch",
                    error_type=exc.__class__.__name__,
                )
            ]
            payload = {}
    return AdapterResult(
        adapter_id="stockanalysis_financials",
        kind="statement",
        label="StockAnalysis financials",
        priority=64,
        payload=payload if isinstance(payload, dict) else {},
        field_priorities=FIELD_PRIORITIES,
        errors=errors,
        error_details=error_details,
        enabled=enabled,
    )
