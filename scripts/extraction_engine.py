from __future__ import annotations

from collections import Counter
from copy import deepcopy
import re
from typing import Any

from source_adapters import (
    AdapterResult,
    run_generic_filing_tables_adapter,
    run_generic_ir_pdf_adapter,
    run_manual_financials_adapter,
    run_manual_revenue_structures_adapter,
    run_official_financials_adapter,
    run_official_revenue_structures_adapter,
    run_official_segments_adapter,
    run_stockanalysis_financials_adapter,
    run_supplemental_components_adapter,
)
from taxonomy_normalizer import STATEMENT_FIELDS, normalize_breakdown_items, normalize_revenue_segments


ENGINE_VERSION = "20260324-v2"
PROFILE_FIELDS: tuple[str, ...] = ("costBreakdownProfile",)
STATEMENT_META_FIELDS: tuple[str, ...] = ("statementMeta",)
SUSPICIOUS_PLACEHOLDER_EXPENSE_KEYS: set[str] = {
    "financeexpense",
    "finance_expense",
    "fulfillment",
    "ga",
    "generaladministrative",
    "general_administrative",
    "rd",
    "rnd",
    "salesmarketing",
    "sales_marketing",
    "taxessurcharges",
    "taxes_surcharges",
}


def parse_period(period: str) -> tuple[int, int]:
    raw = str(period or "")
    if len(raw) != 6 or raw[4] != "Q":
        return (0, 0)
    try:
        return (int(raw[:4]), int(raw[5]))
    except ValueError:
        return (0, 0)


def _adapter_results(company: dict[str, Any], refresh: bool = False, base_payload: dict[str, Any] | None = None) -> list[AdapterResult]:
    return [
        run_manual_financials_adapter(company, refresh=refresh, base_payload=base_payload),
        run_manual_revenue_structures_adapter(company, refresh=refresh, base_payload=base_payload),
        run_official_financials_adapter(company, refresh=refresh, base_payload=base_payload),
        run_generic_filing_tables_adapter(company, refresh=refresh, base_payload=base_payload),
        run_generic_ir_pdf_adapter(company, refresh=refresh, base_payload=base_payload),
        run_stockanalysis_financials_adapter(company, refresh=refresh, base_payload=base_payload),
        run_supplemental_components_adapter(company, refresh=refresh, base_payload=base_payload),
        run_official_segments_adapter(company, refresh=refresh, base_payload=base_payload),
        run_official_revenue_structures_adapter(company, refresh=refresh, base_payload=base_payload),
    ]


def _statement_score(adapter: AdapterResult, field_name: str, entry: dict[str, Any]) -> float:
    score = float(adapter.field_priorities.get(field_name, adapter.priority))
    if entry.get("statementSourceUrl"):
        score += 2
    if entry.get("statementFilingDate"):
        score += 1
    if entry.get("qualityFlags"):
        score += 0.5
    return score


def _collection_score(adapter: AdapterResult, field_name: str, items: list[dict[str, Any]], total_value: float | None) -> float:
    score = float(adapter.field_priorities.get(field_name, adapter.priority))
    score += min(len(items), 6) * 2
    disclosed_total = sum(float(item.get("valueBn") or 0) for item in items)
    if total_value and total_value > 0:
        coverage = min(disclosed_total / total_value, 1.0)
        score += coverage * 12
    return score


def _source_meta(adapter: AdapterResult, *, score: float, source_url: Any = None) -> dict[str, Any]:
    return {
        "adapterId": adapter.adapter_id,
        "label": adapter.label,
        "score": round(float(score), 2),
        "sourceUrl": source_url,
    }


def _representative_source_url(*collections: Any) -> str | None:
    for collection in collections:
        if isinstance(collection, list):
            for item in collection:
                if not isinstance(item, dict):
                    continue
                source_url = str(item.get("sourceUrl") or "").strip()
                if source_url:
                    return source_url
    return None


def _entry_completeness(entry: dict[str, Any]) -> float:
    score = sum(1 for field_name in STATEMENT_FIELDS if entry.get(field_name) is not None)
    score += min(len(entry.get("officialCostBreakdown") or []) + len(entry.get("officialOpexBreakdown") or []), 6) * 0.2
    if entry.get("statementSourceUrl"):
        score += 0.5
    if entry.get("qualityFlags"):
        score += 0.25
    return float(score)


def _has_mergeable_unified_data(entry: dict[str, Any]) -> bool:
    if not isinstance(entry, dict):
        return False
    if any(entry.get(field_name) is not None for field_name in STATEMENT_FIELDS):
        return True
    list_fields = (
        "officialRevenueSegments",
        "officialRevenueDetailGroups",
        "costBreakdown",
        "opexBreakdown",
    )
    if any(isinstance(entry.get(field_name), list) and entry.get(field_name) for field_name in list_fields):
        return True
    dict_fields = (
        "costBreakdownProfile",
        "statementMeta",
    )
    return any(isinstance(entry.get(field_name), dict) and entry.get(field_name) for field_name in dict_fields)


def _merge_dict_records(existing: Any, incoming: Any) -> dict[str, Any]:
    merged = deepcopy(existing) if isinstance(existing, dict) else {}
    if isinstance(incoming, dict):
        for key, value in incoming.items():
            merged[str(key)] = deepcopy(value)
    return merged


def _normalize_suspicious_breakdown_key(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", "", str(value or "").strip().lower())


def _looks_like_placeholder_echo_cluster(items: list[dict[str, Any]], repeated_value: float) -> bool:
    cluster_keys: set[str] = set()
    cluster_count = 0
    for item in items:
        if not isinstance(item, dict):
            continue
        value = round(abs(float(item.get("valueBn") or 0)), 3)
        if value != repeated_value:
            continue
        cluster_count += 1
        for raw_key in (item.get("taxonomyId"), item.get("memberKey"), item.get("name")):
            normalized = _normalize_suspicious_breakdown_key(raw_key)
            if normalized:
                cluster_keys.add(normalized)
    if cluster_count < 4:
        return False
    return len(cluster_keys & SUSPICIOUS_PLACEHOLDER_EXPENSE_KEYS) >= 4


def _breakdown_collection_looks_suspicious(items: list[dict[str, Any]], total_value: float | None) -> bool:
    if not isinstance(items, list) or len(items) < 4:
        return False
    magnitudes = [round(abs(float(item.get("valueBn") or 0)), 3) for item in items if isinstance(item, dict)]
    if magnitudes and max(magnitudes) <= 0.02:
        return True
    values = [round(abs(float(item.get("valueBn") or 0)), 3) for item in items if float(item.get("valueBn") or 0) > 0.02]
    if len(values) < 4:
        return False
    counts = Counter(values)
    repeated_value, repeated_count = counts.most_common(1)[0]
    if repeated_count < 4:
        return False
    if _looks_like_placeholder_echo_cluster(items, repeated_value):
        return True
    total = float(total_value or 0)
    raw_sum = sum(values)
    if total <= 0:
        return len(counts) <= 1
    return repeated_value > total * 1.08 + max(total * 0.01, 0.12) or raw_sum > total * 1.35 + max(total * 0.03, 0.35)


def _merge_best_breakdown_by_taxonomy(
    kind: str,
    field_name: str,
    candidates: list[dict[str, Any]],
    total_value: float | None,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    if not candidates:
        return [], []

    best_by_taxonomy: dict[str, tuple[float, dict[str, Any], AdapterResult]] = {}
    collection_meta: list[tuple[float, list[dict[str, Any]], AdapterResult]] = []
    for candidate in candidates:
        adapter = candidate["adapter"]
        items = normalize_breakdown_items(kind, candidate.get("items"))
        if not items:
            continue
        if _breakdown_collection_looks_suspicious(items, total_value):
            continue
        collection_score = _collection_score(adapter, field_name, items, total_value)
        collection_meta.append((collection_score, items, adapter))
        for item in items:
            taxonomy_id = str(item.get("taxonomyId") or "")
            if not taxonomy_id:
                continue
            item_score = collection_score + min(float(item.get("valueBn") or 0), 999) / 1000
            current = best_by_taxonomy.get(taxonomy_id)
            if current is None or item_score > current[0]:
                enriched = deepcopy(item)
                enriched["provenance"] = _source_meta(adapter, score=item_score, source_url=item.get("sourceUrl"))
                best_by_taxonomy[taxonomy_id] = (item_score, enriched, adapter)

    selected = [payload for _score, payload, _adapter in best_by_taxonomy.values()]
    selected.sort(key=lambda item: (-float(item.get("valueBn") or 0), str(item.get("taxonomyId") or "")))
    if not selected:
        return [], []
    if _breakdown_collection_looks_suspicious(selected, total_value):
        return [], []

    disclosed_total = sum(float(item.get("valueBn") or 0) for item in selected)
    if total_value and total_value > 0 and disclosed_total > total_value * 1.02 and collection_meta:
        best_collection_score, best_collection, best_adapter = max(collection_meta, key=lambda row: row[0])
        selected = deepcopy(best_collection)
        for item in selected:
            item["provenance"] = _source_meta(best_adapter, score=best_collection_score, source_url=item.get("sourceUrl"))
    elif total_value and total_value > 0 and len(selected) >= 2:
        residual = round(total_value - disclosed_total, 3)
        if residual > max(total_value * 0.015, 0.05):
            selected.append(
                {
                    "taxonomyId": "other_cost" if kind == "cost" else "other_opex",
                    "name": "Other cost" if kind == "cost" else "Other opex",
                    "nameZh": "其他成本" if kind == "cost" else "其他经营费用",
                    "memberKey": "othercost" if kind == "cost" else "otheropex",
                    "valueBn": residual,
                    "provenance": {"adapterId": "derived_residual", "label": "Residual after explicit categories", "score": 30},
                }
            )

    source_meta = []
    for score, items, adapter in sorted(collection_meta, key=lambda row: row[0], reverse=True):
        source_meta.append(
            {
                "adapterId": adapter.adapter_id,
                "label": adapter.label,
                "score": round(score, 2),
                "itemCount": len(items),
            }
        )
    return selected, source_meta


def _reconcile_statement_sources(
    results: list[AdapterResult],
) -> tuple[dict[str, dict[str, Any]], dict[str, dict[str, Any]]]:
    quarter_fields: dict[str, dict[str, list[dict[str, Any]]]] = {}
    for adapter in results:
        if not adapter.enabled or adapter.kind != "statement":
            continue
        financials = adapter.payload.get("financials") or {}
        if not isinstance(financials, dict):
            continue
        for quarter, entry in financials.items():
            if not isinstance(entry, dict):
                continue
            bucket = quarter_fields.setdefault(str(quarter), {})
            for field_name in STATEMENT_FIELDS:
                value = entry.get(field_name)
                if value is None:
                    continue
                bucket.setdefault(field_name, []).append({"adapter": adapter, "entry": entry, "value": value})
            for field_name in PROFILE_FIELDS:
                value = entry.get(field_name)
                if isinstance(value, dict) and value:
                    bucket.setdefault(field_name, []).append({"adapter": adapter, "entry": entry, "value": value})
            for field_name in ("officialCostBreakdown", "officialOpexBreakdown", "costBreakdown", "opexBreakdown"):
                items = entry.get(field_name)
                if isinstance(items, list) and items:
                    bucket.setdefault(field_name, []).append({"adapter": adapter, "items": items, "entry": entry})

    unified: dict[str, dict[str, Any]] = {}
    provenance: dict[str, dict[str, Any]] = {}
    for quarter, fields in quarter_fields.items():
        unified_entry: dict[str, Any] = {}
        provenance_entry: dict[str, Any] = {}
        for field_name in STATEMENT_FIELDS:
            candidates = fields.get(field_name) or []
            if not candidates:
                continue
            best = max(candidates, key=lambda row: _statement_score(row["adapter"], field_name, row["entry"]))
            score = _statement_score(best["adapter"], field_name, best["entry"])
            unified_entry[field_name] = best["value"]
            provenance_entry[field_name] = _source_meta(
                best["adapter"],
                score=score,
                source_url=best["entry"].get("statementSourceUrl"),
            )

        for field_name in PROFILE_FIELDS:
            candidates = fields.get(field_name) or []
            if not candidates:
                continue
            best = max(candidates, key=lambda row: _statement_score(row["adapter"], field_name, row["entry"]))
            score = _statement_score(best["adapter"], field_name, best["entry"])
            unified_entry[field_name] = deepcopy(best["value"])
            provenance_entry[field_name] = _source_meta(
                best["adapter"],
                score=score,
                source_url=best["entry"].get("statementSourceUrl"),
            )

        cost_items, cost_sources = _merge_best_breakdown_by_taxonomy(
            "cost",
            "officialCostBreakdown",
            [*(fields.get("officialCostBreakdown") or []), *(fields.get("costBreakdown") or [])],
            unified_entry.get("costOfRevenueBn"),
        )
        if cost_items:
            unified_entry["costBreakdown"] = cost_items
            provenance_entry["costBreakdown"] = cost_sources

        opex_items, opex_sources = _merge_best_breakdown_by_taxonomy(
            "opex",
            "officialOpexBreakdown",
            [*(fields.get("officialOpexBreakdown") or []), *(fields.get("opexBreakdown") or [])],
            unified_entry.get("operatingExpensesBn"),
        )
        if opex_items:
            unified_entry["opexBreakdown"] = opex_items
            provenance_entry["opexBreakdown"] = opex_sources

        representative_candidates: list[tuple[float, dict[str, Any], AdapterResult]] = []
        seen_entries: set[int] = set()
        for candidate_list in fields.values():
            for candidate in candidate_list:
                entry = candidate.get("entry")
                adapter = candidate.get("adapter")
                if not isinstance(entry, dict) or not isinstance(adapter, AdapterResult):
                    continue
                entry_id = id(entry)
                if entry_id in seen_entries:
                    continue
                seen_entries.add(entry_id)
                representative_candidates.append((_entry_completeness(entry) + float(adapter.priority) / 100.0, entry, adapter))
        if representative_candidates:
            _score, representative_entry, representative_adapter = max(representative_candidates, key=lambda row: row[0])
            meta = {
                "statementSource": representative_entry.get("statementSource"),
                "statementSourceUrl": representative_entry.get("statementSourceUrl"),
                "statementValueMode": representative_entry.get("statementValueMode"),
                "statementSpanQuarters": representative_entry.get("statementSpanQuarters"),
                "qualityFlags": list(representative_entry.get("qualityFlags") or []),
                "adapterId": representative_adapter.adapter_id,
            }
            unified_entry["statementMeta"] = meta
            provenance_entry["statementMeta"] = _source_meta(
                representative_adapter,
                score=_score,
                source_url=representative_entry.get("statementSourceUrl"),
            )

        unified[quarter] = unified_entry
        provenance[quarter] = provenance_entry
    return unified, provenance


def _reconcile_revenue_sources(
    results: list[AdapterResult],
    base_payload: dict[str, Any] | None = None,
) -> tuple[dict[str, dict[str, Any]], dict[str, dict[str, Any]]]:
    unified: dict[str, dict[str, Any]] = {}
    provenance: dict[str, dict[str, Any]] = {}
    base_financials = base_payload.get("financials") if isinstance(base_payload, dict) and isinstance(base_payload.get("financials"), dict) else {}

    for adapter in results:
        if not adapter.enabled:
            continue
        if adapter.kind == "revenue_segments":
            quarter_map = adapter.payload.get("quarters") or {}
            if not isinstance(quarter_map, dict):
                continue
            for quarter, rows in quarter_map.items():
                normalized = normalize_revenue_segments(rows if isinstance(rows, list) else [])
                if not normalized:
                    continue
                bucket = unified.setdefault(str(quarter), {})
                source_url = _representative_source_url(normalized)
                current = bucket.get("officialRevenueSegments") or []
                if len(normalized) >= len(current):
                    bucket["officialRevenueSegments"] = normalized
                    provenance.setdefault(str(quarter), {})["officialRevenueSegments"] = _source_meta(
                        adapter,
                        score=adapter.field_priorities.get("officialRevenueSegments", adapter.priority),
                        source_url=source_url,
                    )

        if adapter.kind == "revenue_structure":
            quarter_map = adapter.payload.get("quarters") or {}
            if not isinstance(quarter_map, dict):
                continue
            for quarter, payload in quarter_map.items():
                if not isinstance(payload, dict):
                    continue
                segments = normalize_revenue_segments(payload.get("segments"))
                detail_groups = normalize_revenue_segments(payload.get("detailGroups"))
                opex_breakdown = payload.get("opexBreakdown") or payload.get("officialOpexBreakdown") or []
                cost_breakdown = payload.get("costBreakdown") or payload.get("officialCostBreakdown") or []
                bucket = unified.setdefault(str(quarter), {})
                provenance_entry = provenance.setdefault(str(quarter), {})
                structure_source_url = _representative_source_url(segments, detail_groups, opex_breakdown, cost_breakdown)
                if segments:
                    bucket["officialRevenueSegments"] = segments
                    provenance_entry["officialRevenueSegments"] = _source_meta(
                        adapter,
                        score=adapter.field_priorities.get("officialRevenueSegments", adapter.priority),
                        source_url=_representative_source_url(segments) or structure_source_url,
                    )
                if detail_groups:
                    bucket["officialRevenueDetailGroups"] = detail_groups
                    provenance_entry["officialRevenueDetailGroups"] = _source_meta(
                        adapter,
                        score=adapter.field_priorities.get("officialRevenueDetailGroups", adapter.priority),
                        source_url=_representative_source_url(detail_groups) or structure_source_url,
                    )
                if isinstance(cost_breakdown, list) and cost_breakdown:
                    bucket["costBreakdown"] = deepcopy(cost_breakdown)
                    provenance_entry["costBreakdown"] = _source_meta(
                        adapter,
                        score=adapter.field_priorities.get("officialCostBreakdown", adapter.priority),
                        source_url=_representative_source_url(cost_breakdown) or structure_source_url,
                    )
                if isinstance(opex_breakdown, list) and opex_breakdown:
                    bucket["opexBreakdown"] = deepcopy(opex_breakdown)
                    provenance_entry["opexBreakdown"] = _source_meta(
                        adapter,
                        score=adapter.field_priorities.get("officialOpexBreakdown", adapter.priority),
                        source_url=_representative_source_url(opex_breakdown) or structure_source_url,
                    )
                if payload.get("style"):
                    bucket["officialRevenueStyle"] = payload.get("style")
                    provenance_entry["officialRevenueStyle"] = _source_meta(
                        adapter,
                        score=adapter.field_priorities.get("officialRevenueStyle", adapter.priority),
                        source_url=structure_source_url,
                    )
                if payload.get("displayCurrency"):
                    bucket["displayCurrency"] = payload.get("displayCurrency")
                    provenance_entry["displayCurrency"] = _source_meta(
                        adapter,
                        score=adapter.field_priorities.get("displayCurrency", adapter.priority),
                        source_url=structure_source_url,
                    )
                if payload.get("displayScaleFactor") is not None:
                    bucket["displayScaleFactor"] = payload.get("displayScaleFactor")
                    provenance_entry["displayScaleFactor"] = _source_meta(
                        adapter,
                        score=adapter.field_priorities.get("displayScaleFactor", adapter.priority),
                        source_url=structure_source_url,
                    )

                base_entry = base_financials.get(str(quarter))
                if isinstance(base_entry, dict) and str(base_entry.get("statementSource") or "") == "official-revenue-structure":
                    statement_source_url = str(base_entry.get("statementSourceUrl") or structure_source_url or "").strip() or None
                    if bucket.get("revenueBn") is None and base_entry.get("revenueBn") is not None:
                        bucket["revenueBn"] = base_entry.get("revenueBn")
                        provenance_entry["revenueBn"] = _source_meta(
                            adapter,
                            score=adapter.field_priorities.get("revenueBn", adapter.priority),
                            source_url=statement_source_url,
                        )
                    statement_meta = {
                        "statementSource": base_entry.get("statementSource"),
                        "statementSourceUrl": base_entry.get("statementSourceUrl"),
                        "statementValueMode": base_entry.get("statementValueMode"),
                        "statementSpanQuarters": base_entry.get("statementSpanQuarters"),
                        "qualityFlags": list(base_entry.get("qualityFlags") or []),
                    }
                    if any(
                        statement_meta.get(key) is not None and statement_meta.get(key) != []
                        for key in ("statementSource", "statementSourceUrl", "statementValueMode", "statementSpanQuarters", "qualityFlags")
                    ):
                        bucket["statementMeta"] = statement_meta
                        provenance_entry["statementMeta"] = _source_meta(
                            adapter,
                            score=adapter.field_priorities.get("statementMeta", adapter.priority),
                            source_url=statement_source_url,
                        )
    return unified, provenance


def _coverage_ratio(total_value: Any, item_list: Any) -> float | None:
    if not isinstance(total_value, (int, float)) or isinstance(total_value, bool) or float(total_value) <= 0:
        return None
    if not isinstance(item_list, list):
        return 0.0
    disclosed_total = sum(float(item.get("valueBn") or 0) for item in item_list if isinstance(item, dict))
    return round(min(disclosed_total / float(total_value), 1.0), 4)


def _sum_value_bn(item_list: Any) -> float:
    if not isinstance(item_list, list):
        return 0.0
    return round(sum(float(item.get("valueBn") or 0) for item in item_list if isinstance(item, dict)), 3)


def _quarter_diagnostics(entry: dict[str, Any], provenance: dict[str, Any]) -> dict[str, Any]:
    required_fields = (
        "revenueBn",
        "operatingIncomeBn",
        "netIncomeBn",
    )
    available_required = [field_name for field_name in required_fields if isinstance(entry.get(field_name), (int, float))]
    missing_required = [field_name for field_name in required_fields if field_name not in available_required]
    revenue_segments = entry.get("officialRevenueSegments") or []
    cost_breakdown = entry.get("officialCostBreakdown") or entry.get("costBreakdown") or []
    opex_breakdown = entry.get("officialOpexBreakdown") or entry.get("opexBreakdown") or []
    has_cost_profile = bool(entry.get("costBreakdownProfile"))
    statement_meta = entry.get("statementMeta") if isinstance(entry.get("statementMeta"), dict) else {}

    revenue_segments_total = _sum_value_bn(revenue_segments)
    revenue_total = float(entry.get("revenueBn") or 0)
    cost_total = float(entry.get("costOfRevenueBn") or 0)
    opex_total = float(entry.get("operatingExpensesBn") or 0)

    revenue_segment_coverage = _coverage_ratio(revenue_total, revenue_segments)
    cost_breakdown_coverage = _coverage_ratio(cost_total, cost_breakdown)
    opex_breakdown_coverage = _coverage_ratio(opex_total, opex_breakdown)

    issues: list[str] = []
    if missing_required:
        issues.append(f"missing-required:{','.join(missing_required)}")
    if revenue_total > 0 and revenue_segment_coverage is not None and revenue_segment_coverage < 0.85:
        issues.append("revenue-segment-coverage-low")
    if cost_total > 0 and not has_cost_profile and cost_breakdown_coverage is not None and cost_breakdown_coverage < 0.6:
        issues.append("cost-breakdown-coverage-low")
    if opex_total > 0 and opex_breakdown_coverage is not None and opex_breakdown_coverage < 0.6:
        issues.append("opex-breakdown-coverage-low")
    if statement_meta.get("statementValueMode") == "derived":
        issues.append("statement-derived-quarter")
    if "summary-quarter-report" in set(statement_meta.get("qualityFlags") or []):
        issues.append("statement-summary-quarter-report")

    source_field_count = len([key for key, value in provenance.items() if value])
    score = 100
    score -= len(missing_required) * 14
    if revenue_segment_coverage is not None:
        score -= int(max(0.85 - revenue_segment_coverage, 0) * 24)
    if not has_cost_profile and cost_breakdown_coverage is not None:
        score -= int(max(0.75 - cost_breakdown_coverage, 0) * 18)
    if opex_breakdown_coverage is not None:
        score -= int(max(0.75 - opex_breakdown_coverage, 0) * 18)
    score += min(source_field_count, 6)
    score = max(0, min(100, score))

    return {
        "qualityScore": score,
        "availableRequiredFieldCount": len(available_required),
        "requiredFieldCount": len(required_fields),
        "sourceFieldCount": source_field_count,
        "hasCostBreakdownProfile": has_cost_profile,
        "costBreakdownMode": "profile-assisted" if has_cost_profile and not cost_breakdown else "explicit" if cost_breakdown else "none",
        "opexBreakdownMode": "explicit" if opex_breakdown else "none",
        "revenueSegmentCoveragePct": round((revenue_segment_coverage or 0) * 100, 1) if revenue_segment_coverage is not None else None,
        "costBreakdownCoveragePct": round((cost_breakdown_coverage or 0) * 100, 1) if cost_breakdown_coverage is not None and not has_cost_profile else None,
        "opexBreakdownCoveragePct": round((opex_breakdown_coverage or 0) * 100, 1) if opex_breakdown_coverage is not None else None,
        "revenueSegmentResidualBn": round(max(revenue_total - revenue_segments_total, 0), 3) if revenue_total > 0 and revenue_segments else None,
        "costBreakdownResidualBn": round(max(cost_total - _sum_value_bn(cost_breakdown), 0), 3) if cost_total > 0 and cost_breakdown and not has_cost_profile else None,
        "opexBreakdownResidualBn": round(max(opex_total - _sum_value_bn(opex_breakdown), 0), 3) if opex_total > 0 and opex_breakdown else None,
        "statementSource": statement_meta.get("statementSource"),
        "statementValueMode": statement_meta.get("statementValueMode"),
        "statementSpanQuarters": statement_meta.get("statementSpanQuarters"),
        "statementQualityFlags": list(statement_meta.get("qualityFlags") or []),
        "issues": issues,
    }


def build_unified_extraction(company: dict[str, Any], refresh: bool = False, base_payload: dict[str, Any] | None = None) -> dict[str, Any]:
    results = _adapter_results(company, refresh=refresh, base_payload=base_payload)
    statement_quarters, statement_provenance = _reconcile_statement_sources(results)
    revenue_quarters, revenue_provenance = _reconcile_revenue_sources(results, base_payload=base_payload)
    ordered_quarters = sorted(set(statement_quarters) | set(revenue_quarters), key=parse_period)

    quarter_payloads: dict[str, Any] = {}
    provenance_payloads: dict[str, Any] = {}
    diagnostics_payloads: dict[str, Any] = {}
    for quarter in ordered_quarters:
        quarter_payloads[quarter] = {}
        quarter_payloads[quarter].update(statement_quarters.get(quarter) or {})
        quarter_payloads[quarter].update(revenue_quarters.get(quarter) or {})

        provenance_payloads[quarter] = {}
        provenance_payloads[quarter].update(statement_provenance.get(quarter) or {})
        provenance_payloads[quarter].update(revenue_provenance.get(quarter) or {})
        diagnostics_payloads[quarter] = _quarter_diagnostics(quarter_payloads[quarter], provenance_payloads[quarter])

    return {
        "engineVersion": ENGINE_VERSION,
        "sources": [
            {
                "adapterId": result.adapter_id,
                "kind": result.kind,
                "label": result.label,
                "enabled": result.enabled,
                "priority": result.priority,
                "errorCount": len(result.errors),
                **({"errors": list(result.errors)} if result.errors else {}),
                **({"errorDetails": deepcopy(result.error_details)} if result.error_details else {}),
            }
            for result in results
        ],
        "quarters": quarter_payloads,
        "provenance": provenance_payloads,
        "diagnostics": diagnostics_payloads,
    }


def merge_unified_extraction(payload: dict[str, Any], extraction: dict[str, Any]) -> dict[str, Any]:
    result = deepcopy(payload)
    financials = result.setdefault("financials", {})
    existing_quarters = {str(item) for item in financials.keys() if str(item)}
    allow_new_quarters = not existing_quarters
    quarter_map = extraction.get("quarters") or {}
    provenance_map = extraction.get("provenance") or {}
    diagnostics_map = extraction.get("diagnostics") or {}
    for quarter, unified_entry in quarter_map.items():
        if not isinstance(unified_entry, dict):
            continue
        quarter_key = str(quarter)
        if quarter_key not in financials and not allow_new_quarters and not _has_mergeable_unified_data(unified_entry):
            continue
        entry = financials.setdefault(quarter_key, {"calendarQuarter": quarter_key})
        if not isinstance(entry, dict):
            continue
        applied_fields: set[str] = set()
        for field_name in STATEMENT_FIELDS:
            if entry.get(field_name) is None and unified_entry.get(field_name) is not None:
                entry[field_name] = unified_entry.get(field_name)
                applied_fields.add(field_name)
        if not entry.get("officialRevenueSegments") and isinstance(unified_entry.get("officialRevenueSegments"), list):
            entry["officialRevenueSegments"] = deepcopy(unified_entry["officialRevenueSegments"])
            applied_fields.add("officialRevenueSegments")
        if not entry.get("officialRevenueDetailGroups") and isinstance(unified_entry.get("officialRevenueDetailGroups"), list):
            entry["officialRevenueDetailGroups"] = deepcopy(unified_entry["officialRevenueDetailGroups"])
            applied_fields.add("officialRevenueDetailGroups")
        if not entry.get("officialRevenueStyle") and unified_entry.get("officialRevenueStyle"):
            entry["officialRevenueStyle"] = unified_entry["officialRevenueStyle"]
            applied_fields.add("officialRevenueStyle")
        if not entry.get("displayCurrency") and unified_entry.get("displayCurrency"):
            entry["displayCurrency"] = unified_entry["displayCurrency"]
            applied_fields.add("displayCurrency")
        if entry.get("displayScaleFactor") is None and unified_entry.get("displayScaleFactor") is not None:
            entry["displayScaleFactor"] = unified_entry["displayScaleFactor"]
            applied_fields.add("displayScaleFactor")
        if not entry.get("costBreakdownProfile") and isinstance(unified_entry.get("costBreakdownProfile"), dict):
            entry["costBreakdownProfile"] = deepcopy(unified_entry["costBreakdownProfile"])
            applied_fields.add("costBreakdownProfile")
        if not entry.get("statementMeta") and isinstance(unified_entry.get("statementMeta"), dict):
            entry["statementMeta"] = deepcopy(unified_entry["statementMeta"])
            applied_fields.add("statementMeta")
        if not entry.get("officialCostBreakdown") and not entry.get("costBreakdown") and isinstance(unified_entry.get("costBreakdown"), list):
            entry["costBreakdown"] = deepcopy(unified_entry["costBreakdown"])
            applied_fields.add("costBreakdown")
        if not entry.get("officialOpexBreakdown") and not entry.get("opexBreakdown") and isinstance(unified_entry.get("opexBreakdown"), list):
            entry["opexBreakdown"] = deepcopy(unified_entry["opexBreakdown"])
            applied_fields.add("opexBreakdown")
        applied_provenance = {
            field_name: deepcopy(source_meta)
            for field_name, source_meta in (provenance_map.get(quarter_key) or {}).items()
            if field_name in applied_fields
        }
        if applied_provenance:
            entry["fieldSources"] = _merge_dict_records(entry.get("fieldSources"), applied_provenance)
        if applied_fields and diagnostics_map.get(quarter_key):
            entry["extractionDiagnostics"] = _merge_dict_records(entry.get("extractionDiagnostics"), diagnostics_map[quarter_key])

    result["quarters"] = sorted([str(item) for item in financials.keys() if str(item)], key=parse_period)
    result["unifiedExtraction"] = {
        "engineVersion": extraction.get("engineVersion"),
        "sources": extraction.get("sources", []),
        "provenance": provenance_map,
        "diagnostics": diagnostics_map,
    }
    return result
