from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path
from typing import Any

from build_dataset import ROOT_DIR, TOP30_COMPANIES, company_matches_selection, parse_company_selection, parse_period
from official_segments import ALLOWED_FORMS, MIN_FILING_DATE, _request_json, _resolve_cik, _submission_records
from stockanalysis_financials import fetch_stockanalysis_financial_history


DATASET_PATH = ROOT_DIR / "data" / "earnings-dataset.json"
COMPANY_CACHE_DIR = ROOT_DIR / "data" / "cache"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Detect newly released earnings in the tracked universe and refresh the dataset only when needed.")
    parser.add_argument(
        "--companies",
        type=str,
        default="",
        help="Optional comma-separated company ids, tickers, or slugs to check.",
    )
    parser.add_argument("--dry-run", action="store_true", help="Only report stale companies; do not rebuild the dataset.")
    parser.add_argument("--json", action="store_true", help="Print the final report as JSON.")
    return parser.parse_args()


def load_local_company_payload(company_id: str) -> dict[str, Any] | None:
    cache_path = COMPANY_CACHE_DIR / f"{company_id}.json"
    if cache_path.exists():
        try:
            payload = json.loads(cache_path.read_text(encoding="utf-8"))
        except Exception:
            payload = None
        if isinstance(payload, dict):
            return payload

    if not DATASET_PATH.exists():
        return None
    try:
        dataset = json.loads(DATASET_PATH.read_text(encoding="utf-8"))
    except Exception:
        return None
    for company_payload in dataset.get("companies", []):
        if isinstance(company_payload, dict) and str(company_payload.get("id") or "") == company_id:
            return company_payload
    return None


def latest_local_quarter(payload: dict[str, Any]) -> str:
    quarter_keys = payload.get("quarters") or list((payload.get("financials") or {}).keys())
    quarter_keys = [str(item) for item in quarter_keys if str(item)]
    if not quarter_keys:
        return ""
    return max(quarter_keys, key=parse_period)


def latest_local_filing_marker(payload: dict[str, Any]) -> tuple[str, str]:
    latest_date = ""
    latest_accession = ""
    for history_key in ("officialSegmentHistory", "officialRevenueStructureHistory"):
        filings_used = ((payload.get(history_key) or {}).get("filingsUsed") or [])
        for item in filings_used:
            if not isinstance(item, dict):
                continue
            filing_date = str(item.get("filingDate") or "")
            accession = str(item.get("accession") or "")
            if (filing_date, accession) > (latest_date, latest_accession):
                latest_date, latest_accession = filing_date, accession

    for entry in (payload.get("financials") or {}).values():
        if not isinstance(entry, dict):
            continue
        filing_date = str(entry.get("statementFilingDate") or "")
        if filing_date and (filing_date, "") > (latest_date, latest_accession):
            latest_date = filing_date
            latest_accession = ""
    return latest_date, latest_accession


def latest_remote_sec_filing(company: dict[str, Any]) -> dict[str, str] | None:
    cik = _resolve_cik(str(company.get("ticker") or ""), refresh=False)
    if cik is None:
        return None
    submissions = _request_json(f"https://data.sec.gov/submissions/CIK{cik:010d}.json")
    best_record: tuple[str, str, str] | None = None
    for form, accession, filing_date, _primary_document in _submission_records(submissions):
        if form not in ALLOWED_FORMS or filing_date < MIN_FILING_DATE:
            continue
        candidate = (str(filing_date), str(accession), str(form))
        if best_record is None or candidate > best_record:
            best_record = candidate
    if best_record is None:
        return None
    filing_date, accession, form = best_record
    return {
        "filingDate": filing_date,
        "accession": accession,
        "form": form,
    }


def latest_remote_stockanalysis(company: dict[str, Any]) -> dict[str, str] | None:
    payload = fetch_stockanalysis_financial_history(company, refresh=True)
    latest_quarter = latest_local_quarter(payload)
    if not latest_quarter:
        return None
    entry = (payload.get("financials") or {}).get(latest_quarter) or {}
    filing_date = str(entry.get("statementFilingDate") or entry.get("periodEnd") or "")
    return {
        "quarter": latest_quarter,
        "filingDate": filing_date,
        "accession": "",
        "form": str(payload.get("statementSource") or ""),
    }


def detect_company_update(company: dict[str, Any]) -> dict[str, Any]:
    payload = load_local_company_payload(str(company["id"]))
    if payload is None:
        return {
            "companyId": company["id"],
            "ticker": company["ticker"],
            "needsUpdate": True,
            "reason": "missing-local-cache",
        }

    local_quarter = latest_local_quarter(payload)
    local_filing_date, local_accession = latest_local_filing_marker(payload)

    if company.get("financialSource") == "stockanalysis":
        remote = latest_remote_stockanalysis(company)
        if remote is None:
            return {
                "companyId": company["id"],
                "ticker": company["ticker"],
                "needsUpdate": False,
                "reason": "no-remote-data",
            }
        remote_quarter = str(remote.get("quarter") or "")
        remote_filing_date = str(remote.get("filingDate") or "")
        needs_update = (
            parse_period(remote_quarter) > parse_period(local_quarter)
            or remote_filing_date > local_filing_date
        )
        return {
            "companyId": company["id"],
            "ticker": company["ticker"],
            "needsUpdate": needs_update,
            "reason": "new-quarter-detected" if parse_period(remote_quarter) > parse_period(local_quarter) else ("new-filing-detected" if needs_update else "up-to-date"),
            "localQuarter": local_quarter,
            "remoteQuarter": remote_quarter,
            "localFilingDate": local_filing_date,
            "remoteFilingDate": remote_filing_date,
        }

    remote = latest_remote_sec_filing(company)
    if remote is None:
        return {
            "companyId": company["id"],
            "ticker": company["ticker"],
            "needsUpdate": False,
            "reason": "no-remote-filings",
        }
    remote_filing_date = str(remote.get("filingDate") or "")
    remote_accession = str(remote.get("accession") or "")
    needs_update = (
        remote_filing_date > local_filing_date
        or (remote_filing_date == local_filing_date and remote_accession and remote_accession != local_accession)
    )
    return {
        "companyId": company["id"],
        "ticker": company["ticker"],
        "needsUpdate": needs_update,
        "reason": "new-filing-detected" if needs_update else "up-to-date",
        "localQuarter": local_quarter,
        "localFilingDate": local_filing_date,
        "remoteFilingDate": remote_filing_date,
        "localAccession": local_accession,
        "remoteAccession": remote_accession,
        "remoteForm": str(remote.get("form") or ""),
    }


def build_refresh_command(company_ids: list[str]) -> list[str]:
    return [
        sys.executable,
        str(ROOT_DIR / "scripts" / "build_dataset.py"),
        "--refresh",
        "--companies",
        ",".join(company_ids),
    ]


def main() -> int:
    args = parse_args()
    selected_tokens = parse_company_selection(args.companies)
    companies = [company for company in TOP30_COMPANIES if company_matches_selection(company, selected_tokens)]

    if not companies:
        message = {"checked": 0, "updated": 0, "staleCompanies": [], "report": [], "message": "No companies matched the selection."}
        if args.json:
            print(json.dumps(message, ensure_ascii=False, indent=2))
        else:
            print("[check] no companies matched the selection.", flush=True)
        return 0

    report: list[dict[str, Any]] = []
    stale_company_ids: list[str] = []
    for company in companies:
        print(f"[check] {company['ticker']} ...", flush=True)
        try:
            item = detect_company_update(company)
        except Exception as exc:  # noqa: BLE001
            item = {
                "companyId": company["id"],
                "ticker": company["ticker"],
                "needsUpdate": False,
                "reason": "check-failed",
                "error": str(exc),
            }
        report.append(item)
        if item.get("needsUpdate"):
            stale_company_ids.append(company["id"])

    build_result = {
        "ran": False,
        "updated": False,
        "exitCode": 0,
        "command": [],
    }
    if stale_company_ids and not args.dry_run:
        command = build_refresh_command(stale_company_ids)
        build_result["ran"] = True
        build_result["command"] = command
        completed = subprocess.run(command, cwd=str(ROOT_DIR))
        build_result["exitCode"] = int(completed.returncode)
        build_result["updated"] = completed.returncode == 0
        if completed.returncode != 0:
            if args.json:
                summary = {
                    "checked": len(report),
                    "updated": 0,
                    "staleCompanies": stale_company_ids,
                    "report": report,
                    "build": build_result,
                }
                print(json.dumps(summary, ensure_ascii=False, indent=2))
            return completed.returncode

    summary = {
        "checked": len(report),
        "updated": len(stale_company_ids) if build_result["updated"] or args.dry_run else 0,
        "staleCompanies": stale_company_ids,
        "report": report,
        "build": build_result,
    }

    if args.json:
        print(json.dumps(summary, ensure_ascii=False, indent=2))
    else:
        if stale_company_ids:
            if args.dry_run:
                print(f"[stale] {', '.join(stale_company_ids)}", flush=True)
            else:
                print(f"[updated] {', '.join(stale_company_ids)}", flush=True)
        else:
            print("[up-to-date] no new earnings detected in the selected universe.", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
