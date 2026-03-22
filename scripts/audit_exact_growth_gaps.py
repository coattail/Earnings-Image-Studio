from __future__ import annotations

import json
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
DATASET_PATH = ROOT_DIR / "data" / "earnings-dataset.json"


def missing_growth_counts(rows: list[dict]) -> dict[str, int]:
    return {
        "rows": len(rows),
        "missingYoy": sum(1 for row in rows if row.get("yoyPct") is None),
        "missingQoq": sum(1 for row in rows if row.get("qoqPct") is None),
        "missingAny": sum(1 for row in rows if row.get("yoyPct") is None or row.get("qoqPct") is None),
    }


def main() -> None:
    payload = json.loads(DATASET_PATH.read_text(encoding="utf-8"))
    summaries: list[dict] = []
    for company in payload.get("companies", []):
        financials = company.get("financials") or {}
        segment_rows = []
        detail_rows = []
        quarter_gaps = []
        for quarter_key, entry in sorted(financials.items()):
            top_rows = [row for row in (entry.get("officialRevenueSegments") or []) if isinstance(row, dict)]
            sub_rows = [row for row in (entry.get("officialRevenueDetailGroups") or []) if isinstance(row, dict)]
            segment_rows.extend(top_rows)
            detail_rows.extend(sub_rows)
            top_counts = missing_growth_counts(top_rows)
            sub_counts = missing_growth_counts(sub_rows)
            if top_counts["missingAny"] or sub_counts["missingAny"]:
                quarter_gaps.append(
                    {
                        "quarter": quarter_key,
                        "topLevel": top_counts,
                        "detail": sub_counts,
                    }
                )
        segment_counts = missing_growth_counts(segment_rows)
        detail_counts = missing_growth_counts(detail_rows)
        summaries.append(
            {
                "companyId": company.get("id"),
                "ticker": company.get("ticker"),
                "segmentCounts": segment_counts,
                "detailCounts": detail_counts,
                "quarterGaps": quarter_gaps,
            }
        )

    summaries.sort(
        key=lambda item: (
            item["segmentCounts"]["missingAny"] + item["detailCounts"]["missingAny"],
            item["segmentCounts"]["rows"] + item["detailCounts"]["rows"],
        ),
        reverse=True,
    )

    for item in summaries:
        total_missing = item["segmentCounts"]["missingAny"] + item["detailCounts"]["missingAny"]
        if total_missing == 0:
            continue
        print(
            f'{item["companyId"]} ({item["ticker"]}): '
            f'top {item["segmentCounts"]["missingAny"]}/{item["segmentCounts"]["rows"]}, '
            f'detail {item["detailCounts"]["missingAny"]}/{item["detailCounts"]["rows"]}'
        )


if __name__ == "__main__":
    main()
