from __future__ import annotations

from typing import Any

from official_revenue_structures import fetch_official_revenue_structure_history

from .base import AdapterResult, payload_error_bundle


FIELD_PRIORITIES = {
    "officialRevenueSegments": 114,
    "officialRevenueDetailGroups": 112,
    "revenueBn": 110,
    "statementMeta": 108,
    "officialCostBreakdown": 107,
    "officialOpexBreakdown": 107,
    "officialRevenueStyle": 106,
    "displayCurrency": 106,
    "displayScaleFactor": 106,
}


def run(company: dict[str, Any], refresh: bool = False, base_payload: dict[str, Any] | None = None) -> AdapterResult:
    del base_payload
    payload = fetch_official_revenue_structure_history(company, refresh=refresh)
    errors, error_details = payload_error_bundle(
        payload,
        layer="revenue-structures",
        source_id="official_revenue_structures",
        phase="fetch",
    )
    return AdapterResult(
        adapter_id="official_revenue_structures",
        kind="revenue_structure",
        label="Official filing revenue structure",
        priority=106,
        payload=payload if isinstance(payload, dict) else {},
        field_priorities=FIELD_PRIORITIES,
        errors=errors,
        error_details=error_details,
    )
