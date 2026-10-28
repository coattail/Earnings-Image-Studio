"""Revenue growth completion and publication checks; no network dependencies."""
from __future__ import annotations

from copy import deepcopy
from math import isfinite
from typing import Any

def parse_period(period: str) -> tuple[int, int]:
    if len(period) != 6 or period[4] != "Q":
        return (0, 0)
    try:
        return (int(period[:4]), int(period[5]))
    except ValueError:
        return (0, 0)


def enrich_growth_rows(financials: dict[str, Any], field_name: str) -> None:
    ordered_quarters = sorted(financials, key=parse_period)

    def rows_by_member(quarter_key: str) -> dict[str, dict[str, Any]]:
        rows = financials.get(quarter_key, {}).get(field_name) or []
        return {
            str(item.get("memberKey") or item.get("name") or ""): item
            for item in rows
            if isinstance(item, dict)
        }

    def taxonomy_signature(quarter_key: str) -> frozenset[str]:
        return frozenset(rows_by_member(quarter_key))

    def has_matching_taxonomy(left_quarter_key: str, right_quarter_key: str) -> bool:
        left_signature = taxonomy_signature(left_quarter_key)
        right_signature = taxonomy_signature(right_quarter_key)
        return bool(left_signature) and left_signature == right_signature

    def prior_quarter_key(quarter_key: str) -> str:
        if quarter_key.endswith("Q1"):
            return f"{int(quarter_key[:4]) - 1}Q4"
        return f"{quarter_key[:4]}Q{int(quarter_key[-1]) - 1}"

    def historical_yoy_growth(quarter_key: str, member_key: str) -> float | None:
        # Four sequential category ratios are equivalent to dividing the current
        # category revenue by the same category's revenue one year earlier.
        current_to_prior_year_ratio = 1.0
        cursor = quarter_key
        for _ in range(4):
            row = rows_by_member(cursor).get(member_key)
            qoq_pct = row.get("qoqPct") if row else None
            if qoq_pct is None:
                return None
            current_to_prior_year_ratio *= 1 + float(qoq_pct) / 100
            cursor = prior_quarter_key(cursor)
        return round((current_to_prior_year_ratio - 1) * 100, 2)

    # Normalize disclosed share rows into chart values before calculating growth.
    for quarter in ordered_quarters:
        rows = financials.get(quarter, {}).get(field_name) or []
        if not rows:
            continue
        revenue_bn = float(financials.get(quarter, {}).get("revenueBn") or 0)
        for row in rows:
            if revenue_bn and row.get("metricMode") == "share":
                share_pct = float(row.get("mixPct") or row.get("valueBn") or 0)
                row["valueBn"] = round(share_pct / 100 * revenue_bn, 3)
                row["mixPct"] = round(share_pct, 1)
            elif revenue_bn and row.get("mixPct") is None:
                row["mixPct"] = round(float(row.get("valueBn") or 0) / revenue_bn * 100, 1)

    # Preserve reported QoQ growth. Calculate only when the source omitted it.
    for quarter in ordered_quarters:
        rows = financials.get(quarter, {}).get(field_name) or []
        if not rows:
            continue
        previous_quarter = prior_quarter_key(quarter)
        prior_quarter_map = rows_by_member(previous_quarter)
        comparable_to_prior_quarter = has_matching_taxonomy(quarter, previous_quarter)
        prior_quarter_has_taxonomy = bool(taxonomy_signature(previous_quarter))
        taxonomy_flag = (
            "officialRevenueTaxonomyChangedFromPreviousQuarter"
            if field_name == "officialRevenueSegments"
            else "officialRevenueDetailTaxonomyChangedFromPreviousQuarter"
        )
        financials[quarter][taxonomy_flag] = bool(prior_quarter_has_taxonomy and not comparable_to_prior_quarter)
        for row in rows:
            member_key = str(row.get("memberKey") or row.get("name") or "")
            previous = prior_quarter_map.get(member_key)
            previous_value = float(previous.get("valueBn") or 0) if previous else 0
            suppress_qoq = "suppressQoQGrowth" in row and bool(row.get("suppressQoQGrowth"))
            if not suppress_qoq and comparable_to_prior_quarter and row.get("qoqPct") is None and previous_value:
                row["qoqPct"] = round((float(row.get("valueBn") or 0) / previous_value - 1) * 100, 2)

    # Calculate undisclosed YoY growth by dividing current and prior-year category
    # histories. Share-only disclosures use the sequential category ratios because
    # their displayed mix percentages are rounded before publication.
    for quarter in ordered_quarters:
        rows = financials.get(quarter, {}).get(field_name) or []
        if not rows:
            continue
        prior_year_quarter = f"{int(quarter[:4]) - 1}{quarter[4:]}"
        prior_year_map = rows_by_member(prior_year_quarter)
        comparable_to_prior_year = has_matching_taxonomy(quarter, prior_year_quarter)
        prior_year_has_taxonomy = bool(taxonomy_signature(prior_year_quarter))
        prior_year_taxonomy_flag = (
            "officialRevenueTaxonomyChangedFromPriorYear"
            if field_name == "officialRevenueSegments"
            else "officialRevenueDetailTaxonomyChangedFromPriorYear"
        )
        financials[quarter][prior_year_taxonomy_flag] = bool(prior_year_has_taxonomy and not comparable_to_prior_year)
        revenue_bn = float(financials.get(quarter, {}).get("revenueBn") or 0)
        prior_year_revenue_bn = float(financials.get(prior_year_quarter, {}).get("revenueBn") or 0)
        for row in rows:
            member_key = str(row.get("memberKey") or row.get("name") or "")
            previous = prior_year_map.get(member_key)
            previous_value = float(previous.get("valueBn") or 0) if previous else 0
            if row.get("yoyPct") is None:
                historical_growth = historical_yoy_growth(quarter, member_key) if row.get("metricMode") == "share" else None
                if historical_growth is not None:
                    row["yoyPct"] = historical_growth
                elif comparable_to_prior_year and previous_value:
                    row["yoyPct"] = round((float(row.get("valueBn") or 0) / previous_value - 1) * 100, 2)
            if comparable_to_prior_year and revenue_bn and prior_year_revenue_bn and previous_value and row.get("mixYoyDeltaPp") is None:
                current_mix = float(row.get("valueBn") or 0) / revenue_bn * 100
                prior_mix = previous_value / prior_year_revenue_bn * 100
                row["mixYoyDeltaPp"] = round(current_mix - prior_mix, 1)

REVENUE_FIELDS = ("officialRevenueSegments", "officialRevenueDetailGroups")
GROWTH_PERIODS = (("qoqPct", "PreviousQuarter"), ("yoyPct", "PriorYear"))


def _rows(entry: dict, field: str) -> list[dict]:
    return [row for row in entry.get(field) or [] if isinstance(row, dict)]


def _identity(row: dict, field: str) -> tuple[str, str]:
    member = str(row.get("memberKey") or row.get("name") or "")
    parent = str(row.get("targetId") or row.get("targetName") or row.get("target") or row.get("groupName") or "")
    return member, parent if field == "officialRevenueDetailGroups" else ""


def revenue_growth_completion_plan(payload: dict) -> list[dict]:
    """Find missing derivable metrics without changing data or reported rates.

    Use the existing enrichment policy (including rounded-share histories), but
    require explicit comparable source rows before promoting a derived result.
    """
    financials = payload.get("financials") or {}
    candidate = deepcopy(financials)
    plan = []
    for field in REVENUE_FIELDS:
        enrich_growth_rows(candidate, field)
        for quarter, entry in financials.items():
            current_rows = _rows(entry, field)
            identities = [_identity(row, field) for row in current_rows]
            members = [key[0] for key in identities]
            # Ambiguous members must be resolved by the source adapter first.
            if not all(members) or len(set(members)) != len(members):
                continue
            for index, row in enumerate(current_rows):
                if row.get("inferredFromQuarter"):
                    continue
                for metric, suffix in GROWTH_PERIODS:
                    if row.get(metric) is not None:
                        continue
                    if row.get("suppressQoQGrowth" if metric == "qoqPct" else "suppressYoYGrowth"):
                        continue
                    flag = ("officialRevenueTaxonomyChangedFrom" if field == "officialRevenueSegments"
                            else "officialRevenueDetailTaxonomyChangedFrom") + suffix
                    if entry.get(flag):
                        continue
                    year, number = parse_period(quarter)
                    prior = (f"{year - 1}Q{number}" if metric == "yoyPct" else
                             f"{year - 1}Q4" if number == 1 else f"{year}Q{number - 1}")
                    previous_entry = financials.get(prior) or {}
                    previous_rows = _rows(previous_entry, field)
                    previous_ids = [_identity(item, field) for item in previous_rows]
                    if len(set(previous_ids)) != len(previous_ids) or set(identities) != set(previous_ids):
                        continue
                    previous = dict(zip(previous_ids, previous_rows)).get(identities[index])
                    if not previous or previous.get("inferredFromQuarter"):
                        continue
                    if previous.get("metricMode") != row.get("metricMode"):
                        continue
                    currencies = [item.get("statementCurrency") for item in (entry, previous_entry)]
                    if all(currencies) and currencies[0] != currencies[1]:
                        continue
                    values = [item.get("valueBn") for item in (row, previous)]
                    if any(not isinstance(value, (int, float)) or not isfinite(value) for value in values):
                        continue
                    if values[0] < 0 or values[1] <= 0:
                        continue
                    value = candidate[quarter][field][index].get(metric)
                    if isinstance(value, (int, float)) and isfinite(value):
                        plan.append({"quarter": quarter, "field": field, "index": index,
                                     "member": identities[index][0], "metric": metric,
                                     "value": value, "baselineQuarter": prior})
    return plan


def complete_company_revenue_growth(payload: dict) -> list[dict]:
    """Fill only missing rates, after all adapters and manual overrides finish."""
    plan = revenue_growth_completion_plan(payload)
    for change in plan:
        row = payload["financials"][change["quarter"]][change["field"]][change["index"]]
        row[change["metric"]] = change["value"]
        # Mirror existing source-history rows so a later structure merge cannot
        # put the null rates back. Never create or rewrite source amounts.
        history = (payload.get("officialRevenueStructureHistory") or {}).get("quarters") or {}
        field = "segments" if change["field"] == "officialRevenueSegments" else "detailGroups"
        for source in (history.get(change["quarter"]) or {}).get(field) or []:
            if (_identity(source, change["field"]) == _identity(row, change["field"])
                    and source.get("valueBn") == row.get("valueBn")
                    and source.get(change["metric"]) is None):
                source[change["metric"]] = change["value"]
    return plan


def assert_revenue_growth_complete(payload: dict) -> None:
    missing = revenue_growth_completion_plan(payload)
    if missing:
        details = "; ".join(f"{x['quarter']}/{x['field']}/{x['member']}/{x['metric']}" for x in missing[:8])
        raise ValueError(f"{payload.get('id', 'company')}: missing comparable revenue growth ({len(missing)}): {details}")
