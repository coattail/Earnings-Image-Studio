from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor, TimeoutError
import json
import subprocess
import sys
from pathlib import Path
from typing import Any

from build_dataset import ROOT_DIR, TOP30_COMPANIES, company_matches_selection, parse_company_selection, parse_period
from official_segments import ALLOWED_FORMS, MIN_FILING_DATE, _request_json, _resolve_cik, _submission_records
from official_revenue_structures import CUSTOM_INCREMENTAL_HISTORY_COMPANIES, _available_custom_history_items
from stockanalysis_financials import fetch_stockanalysis_financial_history


DATASET_PATH = ROOT_DIR / "data" / "earnings-dataset.json"
COMPANY_CACHE_DIR = ROOT_DIR / "data" / "cache"
OFFICIAL_IR_LOOKUP_TIMEOUT_SECONDS = 25


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


def latest_local_revenue_structure_quarter(payload: dict[str, Any]) -> str:
    history = payload.get("officialRevenueStructureHistory")
    quarters = history.get("quarters") if isinstance(history, dict) else None
    if not isinstance(quarters, dict):
        return ""
    quarter_keys = [str(item) for item in quarters.keys() if str(item)]
    if not quarter_keys:
        return ""
    return max(quarter_keys, key=parse_period)


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


def latest_remote_official_revenue_structure(company: dict[str, Any]) -> dict[str, str] | None:
    company_id = str(company.get("id") or "").strip().lower()
    if company_id not in CUSTOM_INCREMENTAL_HISTORY_COMPANIES:
        return None

    executor = ThreadPoolExecutor(max_workers=1)
    future = executor.submit(_available_custom_history_items, company_id)
    try:
        items = future.result(timeout=OFFICIAL_IR_LOOKUP_TIMEOUT_SECONDS)
    except TimeoutError:
        future.cancel()
        executor.shutdown(wait=False, cancel_futures=True)
        return None
    except Exception:
        executor.shutdown(wait=False, cancel_futures=True)
        return None
    executor.shutdown(wait=False)

    if not items:
        return None
    latest_quarter = max((str(quarter) for quarter in items.keys() if str(quarter)), key=parse_period)
    item = items.get(latest_quarter)
    if not isinstance(item, dict):
        return None
    return {
        "quarter": latest_quarter,
        "filingDate": str(item.get("filingDate") or ""),
        "sourceUrl": str(item.get("sourceUrl") or ""),
        "title": str(item.get("title") or ""),
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
    local_revenue_structure_quarter = latest_local_revenue_structure_quarter(payload)

    if company.get("financialSource") == "stockanalysis":
        remote = latest_remote_stockanalysis(company)
        remote_official = latest_remote_official_revenue_structure(company)
        if remote is None and remote_official is None:
            return {
                "companyId": company["id"],
                "ticker": company["ticker"],
                "needsUpdate": False,
                "reason": "no-remote-data",
            }
        remote_quarter = str((remote or {}).get("quarter") or "")
        remote_filing_date = str((remote or {}).get("filingDate") or "")
        remote_official_quarter = str((remote_official or {}).get("quarter") or "")
        remote_official_filing_date = str((remote_official or {}).get("filingDate") or "")
        official_has_newer_quarter = (
            remote_official_quarter
            and parse_period(remote_official_quarter) > parse_period(local_revenue_structure_quarter or local_quarter)
        )
        needs_update = official_has_newer_quarter or (
            bool(remote_quarter)
            and (
                parse_period(remote_quarter) > parse_period(local_quarter)
                or remote_filing_date > local_filing_date
            )
        )
        reason = "up-to-date"
        if official_has_newer_quarter:
            reason = "new-official-ir-quarter-detected"
        elif needs_update and parse_period(remote_quarter) > parse_period(local_quarter):
            reason = "new-quarter-detected"
        elif needs_update:
            reason = "new-filing-detected"
        return {
            "companyId": company["id"],
            "ticker": company["ticker"],
            "needsUpdate": needs_update,
            "reason": reason,
            "localQuarter": local_quarter,
            "remoteQuarter": remote_quarter,
            "localRevenueStructureQuarter": local_revenue_structure_quarter,
            "remoteOfficialRevenueQuarter": remote_official_quarter,
            "localFilingDate": local_filing_date,
            "remoteFilingDate": remote_filing_date,
            "remoteOfficialFilingDate": remote_official_filing_date,
            "buildRefreshMode": "cache-supplement" if official_has_newer_quarter else "refresh",
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


def build_refresh_command(company_ids: list[str], *, refresh: bool = True) -> list[str]:
    command = [
        sys.executable,
        str(ROOT_DIR / "scripts" / "build_dataset.py"),
        "--companies",
        ",".join(company_ids),
    ]
    if refresh:
        command.insert(2, "--refresh")
    else:
        command.insert(2, "--cache-supplement-only")
    return command


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
    stale_items: list[dict[str, Any]] = []
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
            stale_items.append(item)

    build_result = {
        "ran": False,
        "updated": False,
        "exitCode": 0,
        "command": [],
        "commands": [],
    }
    if stale_company_ids and not args.dry_run:
        cache_supplement_ids = [
            str(item.get("companyId") or "")
            for item in stale_items
            if item.get("buildRefreshMode") == "cache-supplement" and str(item.get("companyId") or "")
        ]
        refresh_ids = [
            str(item.get("companyId") or "")
            for item in stale_items
            if item.get("buildRefreshMode") != "cache-supplement" and str(item.get("companyId") or "")
        ]
        commands: list[list[str]] = []
        if refresh_ids:
            commands.append(build_refresh_command(refresh_ids, refresh=True))
        if cache_supplement_ids:
            commands.append(build_refresh_command(cache_supplement_ids, refresh=False))
        build_result["ran"] = True
        build_result["commands"] = commands
        build_result["command"] = commands[0] if len(commands) == 1 else []
        exit_code = 0
        for command in commands:
            completed = subprocess.run(command, cwd=str(ROOT_DIR))
            if completed.returncode != 0:
                exit_code = int(completed.returncode)
                break
        build_result["exitCode"] = exit_code
        build_result["updated"] = exit_code == 0
        if exit_code != 0:
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
