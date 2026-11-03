"""Watch every tracked issuer, refresh independently, and verify before publishing.

The same read-only collector is used by Tech-Analysis for its own company list.
Diagnostics are persisted after each operation; source failures never count as
successful updates and do not prevent other issuers from being processed.
"""
from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
import json
from pathlib import Path
import subprocess
import sys
import time

import check_for_updates as checker
from build_dataset import TOP30_COMPANIES, parse_company_selection, company_matches_selection
from earnings_release import discover_release, complete_quarter, discover_ir_statement, plausible
from native_earnings_watch import latest_native_release

ROOT = Path(__file__).resolve().parents[1]


def bounded_detect(company, local, external):
    from official_segments import REQUEST_DEADLINE
    token = REQUEST_DEADLINE.set(time.monotonic() + 60)
    try:
        return detect(company, local, external=external)
    finally:
        REQUEST_DEADLINE.reset(token)


def detect(company: dict, local: dict | None = None, *, external=False) -> dict:
    local = local or checker.load_local_company_payload(company["id"]) or {}
    # A structure-only row or a parsed year/quarter label is not a financial
    # quarter and must not suppress discovery of the actual released results.
    valid = {}
    for quarter, values in sorted(local.get("financials", {}).items()):
        previous = valid.get(max(valid, default=""), {})
        if plausible(values, previous):
            valid[quarter] = values
    local = {**local, "financials": valid, "quarters": sorted(valid)}
    latest = checker.latest_local_quarter(local)
    entry = local.get("financials", {}).get(latest, {})
    native = company.get("reportingCurrency") or entry.get("statementCurrency")
    company = {**company, **({"reportingCurrency": native} if native else {})}
    native_release = latest_native_release(company)
    if native_release and native_release["quarter"] > latest:
        try:
            native_release = discover_ir_statement(company, native_release) or native_release
        except Exception as error:
            native_release["parseError"] = str(error)
        return dict(companyId=company["id"], ticker=company["ticker"], needsUpdate=True,
                    localQuarter=latest, remoteQuarter=native_release["quarter"], remoteFilingDate=native_release.get("filingDate", ""),
                    reason="new-official-ir-quarter-detected", release=native_release)
    release = discover_release(company, local)
    if release:
        if external and release.get("entry", {}).get("statementCurrency", "USD") != "USD":
            from build_dataset import apply_usd_display_fields, load_fx_cache
            apply_usd_display_fields({"financials": {release["quarter"]: release["entry"]}}, load_fx_cache())
        quarter = release.get("quarter") or ""
        needs = quarter > latest or release["filingDate"] > (entry.get("statementFilingDate") or "")
        return dict(companyId=company["id"], ticker=company["ticker"], needsUpdate=needs,
                    localQuarter=latest, remoteQuarter=quarter, remoteFilingDate=release["filingDate"],
                    reason="earnings-release-detected" if needs else "up-to-date",
                    release=release, **({"sourceWarning": release["parseError"]} if release.get("parseError") else {}))
    if external:
        return dict(companyId=company["id"], ticker=company["ticker"], needsUpdate=False, reason="no-new-earnings-release")
    result = checker.detect_company_update(company, payload=local)
    if result.get("reason") == "new-official-ir-quarter-detected":
        from official_revenue_structures import _available_custom_history_items
        candidates = _available_custom_history_items(company["id"])
        item = candidates.get(result.get("remoteOfficialRevenueQuarter"))
        if item:
            try:
                parsed = discover_ir_statement(company, item)
            except Exception as error:
                result["sourceWarning"] = str(error)
                parsed = None
            if parsed:
                result["release"] = parsed
                result["remoteQuarter"] = parsed["quarter"]
    marker = entry.get("automaticEarnings") or {}
    if (not result.get("needsUpdate") and marker.get("form") in {"8-K", "6-K"}
        and result.get("remoteForm") in {"10-Q", "10-K", "20-F"}
        and result.get("remoteQuarter") == latest
        and result.get("remoteAccession") != marker.get("accession")
        and (result.get("remoteFilingDate") or "") >= (entry.get("statementFilingDate") or "")):
        result.update(needsUpdate=True, reason="official-filing-enrichment-ready", buildRefreshMode="full-refresh")
    return result


def validate_refresh(item: dict, payload: dict, previous: dict | None = None) -> None:
    quarter = checker.latest_local_quarter(payload)
    entry = payload.get("financials", {}).get(quarter, {})
    if not complete_quarter(entry, item["companyId"]):
        raise ValueError(f"{item['companyId']}: latest quarter lacks validated revenue / net income")
    prior = (previous or {}).get("financials", {})
    prior_quarters = [q for q in prior if q < quarter and complete_quarter(prior[q])]
    if prior_quarters and not plausible(entry, prior[max(prior_quarters)]):
        raise ValueError(f"{item['companyId']}: refreshed financial amounts have an implausible scale")
    expected = item.get("remoteQuarter") or item.get("remoteOfficialRevenueQuarter")
    if expected and quarter < expected:
        raise ValueError(f"{item['companyId']}: still {quarter}; expected {expected}")
    if not expected and quarter <= (item.get("localQuarter") or ""):
        released = item.get("remoteFilingDate") or ""
        if (entry.get("statementFilingDate") or "") < released:
            raise ValueError(f"{item['companyId']}: earnings detected but refreshed source still lags {released}")


def save(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def refresh_one(item: dict, timeout: int = 150) -> None:
    paths = [ROOT / "data/earnings-dataset.json", ROOT / "data/dataset-index.json", ROOT / f"data/cache/{item['companyId']}.json"]
    snapshots = {path: path.read_bytes() if path.exists() else None for path in paths}
    try:
        # A newly discovered IR split still needs a fresh financial trunk;
        # cache-only supplementation can otherwise publish a structure-only row.
        command = checker.build_refresh_command([item["companyId"]], refresh=True)
        if item.get("buildRefreshMode") == "full-refresh":
            command = [sys.executable, str(ROOT / "scripts/build_dataset.py"), "--refresh", "--companies", item["companyId"]]
        result = subprocess.run(command, cwd=ROOT, timeout=300 if item.get("buildRefreshMode") == "full-refresh" else timeout)
        payload = json.loads(paths[-1].read_text())
        old_dataset = json.loads(snapshots[paths[0]])
        previous = next((c for c in old_dataset["companies"] if c["id"] == item["companyId"]), {})
        validate_refresh(item, payload, previous)
        blockers = payload.get("coverage", {}).get("classification", {}).get("blockers", [])
        if result.returncode and not blockers:
            raise RuntimeError(f"builder exit code {result.returncode}")
        return blockers
    except Exception:
        # The old builder writes before its final audit. Roll those outputs back
        # before processing another issuer or committing a successful sibling.
        for path, data in snapshots.items():
            if data is None:
                path.unlink(missing_ok=True)
            else:
                path.write_bytes(data)
        raise


def run(args) -> int:
    started = time.monotonic()
    report = dict(startedAt=datetime.now(timezone.utc).isoformat(), checked=0, report=[], updatedCompanies=[], failedCompanies=[], deferredCompanies=[], pendingDetails=[])
    if args.universe:
        universe = json.loads(args.universe.read_text())
        companies = universe["companies"]
        locals_by_id = universe.get("local", {})
    else:
        tokens = parse_company_selection(args.companies)
        companies = [c for c in TOP30_COMPANIES if company_matches_selection(c, tokens)]
        published = json.loads(checker.DATASET_PATH.read_text())
        locals_by_id = {c["id"]: c for c in published["companies"]}
    try:
        state = json.loads(args.state_path.read_text())
    except FileNotFoundError:
        state = {}
    # At most three independent SEC requests at a time; heavy rebuilds remain
    # serialized so they cannot race while writing the combined dataset.
    with ThreadPoolExecutor(max_workers=3) as pool:
        futures = {pool.submit(bounded_detect, c, locals_by_id.get(c["id"]), bool(args.universe)): c for c in companies}
        for future in as_completed(futures):
            company = futures[future]
            try:
                item = future.result()
            except Exception as error:
                item = dict(companyId=company["id"], ticker=company["ticker"], needsUpdate=False, reason="check-failed", error=str(error))
                report["failedCompanies"].append(company["id"])
            report["report"].append(item)
            if state.get(company["id"], {}).get("pendingDetails") and item.get("reason") != "check-failed":
                item.update(needsUpdate=True, reason="pending-classification-details", buildRefreshMode="full-refresh")
            report["checked"] += 1
            print(f"[watch] {company['ticker']}: {item['reason']}", flush=True)
            save(args.report_path, report)
    stale = [item for item in report["report"] if item.get("needsUpdate")]
    # Fresh releases and issuers never attempted take priority over previously
    # failing issuers. One unavailable source cannot starve the rest of the list.
    stale.sort(key=lambda item: (state.get(item["companyId"], {}).get("lastAttempt", ""), -(int((item.get("remoteFilingDate") or "0000-00-00").replace("-", "") or 0))))
    if not args.dry_run and not args.universe:
        for item in stale:
            company_id = item["companyId"]
            if time.monotonic() - started >= args.budget_seconds:
                report["deferredCompanies"].append(company_id)
                continue
            state[company_id] = {"lastAttempt": datetime.now(timezone.utc).isoformat()}
            try:
                blockers = refresh_one(item)
                report["updatedCompanies"].append(company_id)
                if blockers:
                    report["pendingDetails"].append(dict(companyId=company_id, issues=blockers))
                    state[company_id]["pendingDetails"] = True
            except Exception as error:
                report["failedCompanies"].append(company_id)
                item["refreshError"] = str(error)
                state[company_id]["error"] = str(error)
            save(args.state_path, state)
            save(args.report_path, report)
    report["finishedAt"] = datetime.now(timezone.utc).isoformat()
    save(args.report_path, report)
    return int(bool(report["failedCompanies"] or report["pendingDetails"] or (not args.dry_run and report["deferredCompanies"])))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--companies", default="")
    parser.add_argument("--universe", type=Path, help="External company's universe and local statements; collect only")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--report-path", type=Path, default=ROOT / "output/update-report.json")
    parser.add_argument("--state-path", type=Path, default=ROOT / "output/earnings-watch-state.json")
    parser.add_argument("--budget-seconds", type=int, default=660)
    return run(parser.parse_args())


if __name__ == "__main__":
    raise SystemExit(main())
