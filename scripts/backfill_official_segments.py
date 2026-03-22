from __future__ import annotations

import argparse
import json
import time
from pathlib import Path
from typing import Any

from official_segments import fetch_official_segment_history


ROOT_DIR = Path(__file__).resolve().parents[1]
DATASET_PATH = ROOT_DIR / "data" / "earnings-dataset.json"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Backfill official segment revenue data into the local dataset.")
    parser.add_argument("--refresh", action="store_true", help="Refresh company-level official segment caches before merging.")
    return parser.parse_args()


def merge_company_segments(company: dict[str, Any], history: dict[str, Any]) -> None:
    financials = company.get("financials", {})
    quarter_map = history.get("quarters", {}) if isinstance(history, dict) else {}
    for quarter, rows in quarter_map.items():
        entry = financials.get(quarter)
        if not isinstance(entry, dict):
            continue
        entry["officialRevenueSegments"] = [
            {
                "name": row.get("name"),
                "memberKey": str(row.get("memberKey") or row.get("name") or ""),
                "valueBn": row.get("valueBn"),
                "yoyPct": None,
                "sourceUrl": row.get("sourceUrl"),
                "sourceForm": row.get("sourceForm"),
                "filingDate": row.get("filingDate"),
                "periodStart": row.get("periodStart"),
                "periodEnd": row.get("periodEnd"),
            }
            for row in rows
            if isinstance(row, dict) and row.get("valueBn") is not None
        ]
        entry["officialSegmentAxis"] = history.get("axis")
        entry["officialSegmentSource"] = history.get("source")

    for quarter, entry in financials.items():
        rows = entry.get("officialRevenueSegments") or []
        prior_period = f"{int(str(quarter)[:4]) - 1}{str(quarter)[4:]}"
        previous_rows = financials.get(prior_period, {}).get("officialRevenueSegments") or []
        previous_map = {str(item.get("memberKey") or item.get("name") or ""): item for item in previous_rows}
        for row in rows:
            previous = previous_map.get(str(row.get("memberKey") or row.get("name") or ""))
            if previous and previous.get("valueBn") not in (None, 0):
                row["yoyPct"] = round((float(row["valueBn"]) / float(previous["valueBn"]) - 1) * 100, 2)

    company["officialSegmentHistory"] = {
        "source": history.get("source"),
        "axis": history.get("axis"),
        "filingsUsed": history.get("filingsUsed", []),
        "errors": history.get("errors", []),
    }
    company.setdefault("coverage", {})["officialSegmentQuarterCount"] = sum(
        1 for value in financials.values() if isinstance(value, dict) and value.get("officialRevenueSegments")
    )


def main() -> int:
    args = parse_args()
    dataset = json.loads(DATASET_PATH.read_text(encoding="utf-8"))
    companies = dataset.get("companies", [])
    for index, company in enumerate(companies, start=1):
        ticker = company.get("ticker") or company.get("id")
        print(f"[{index}/{len(companies)}] {ticker} ...", flush=True)
        history = fetch_official_segment_history(company, refresh=args.refresh)
        merge_company_segments(company, history)
        DATASET_PATH.write_text(json.dumps(dataset, ensure_ascii=False, indent=2), encoding="utf-8")
        print(
            f"  quarters={company.get('coverage', {}).get('officialSegmentQuarterCount', 0)} "
            f"errors={len((history or {}).get('errors', []))}",
            flush=True,
        )
        time.sleep(0.2)
    print(f"[done] updated {DATASET_PATH}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
