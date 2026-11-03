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
import tempfile
from copy import deepcopy

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
    from release_chart_quality import chart_issues
    pending_chart_issues = chart_issues(local) if not external else []
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
    company = {**company, **({"reportingCurrency": native} if native else {}),
               '_localQuarter':latest,'_localFilingDate':entry.get('statementFilingDate'),'_localSourceUrl':entry.get('statementSourceUrl')}
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
    if company.get('_calendarProbeOnly'):
        return dict(companyId=company['id'],ticker=company['ticker'],needsUpdate=False,reason='outside-company-earnings-window')
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
    if pending_chart_issues and not result.get('needsUpdate'):
        result.update(companyId=company['id'], ticker=company['ticker'], needsUpdate=True,
                      localQuarter=latest, remoteQuarter=latest,
                      reason='incomplete-chart-classification', chartIssues=pending_chart_issues)
    return result


def validate_refresh(item: dict, payload: dict, previous: dict | None = None) -> None:
    quarter = checker.latest_local_quarter(payload)
    entry = payload.get("financials", {}).get(quarter, {})
    if not complete_quarter(entry, item["companyId"]):
        raise ValueError(f"{item['companyId']}: latest quarter lacks validated revenue / net income")
    prior = (previous or {}).get("financials", {})
    sane={}
    for period,values in sorted(prior.items()):
        if period<quarter and complete_quarter(values,item['companyId'])and plausible(values,sane.get(max(sane,default=''),{})):
            sane[period]=values
    if sane and not plausible(entry,sane[max(sane)]):
        raise ValueError(f"{item['companyId']}: refreshed financial amounts have an implausible scale")
    expected = item.get("remoteQuarter") or item.get("remoteOfficialRevenueQuarter")
    if expected and quarter < expected:
        raise ValueError(f"{item['companyId']}: still {quarter}; expected {expected}")
    if not expected and quarter <= (item.get("localQuarter") or ""):
        released = item.get("remoteFilingDate") or ""
        if (entry.get("statementFilingDate") or "") < released:
            raise ValueError(f"{item['companyId']}: earnings detected but refreshed source still lags {released}")
    from release_chart_quality import chart_issues
    issues = chart_issues(payload)
    if issues:
        raise ValueError(f"{item['companyId']}: incomplete Sankey chart: {'; '.join(issues)}")


def save(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

def enrich_reported_period(item,previous):
    """Read the new same-period filing without rebuilding old history."""
    from official_segments import _request,_resolve_cik
    from release_chart_completion import complete_current_chart
    from release_chart_quality import chart_issues,FIELDS
    from build_dataset import finalize_company_payload,apply_usd_display_fields,load_fx_cache
    cfg=next(c for c in TOP30_COMPANIES if c['id']==item['companyId'])
    cik=cfg.get('cik')or _resolve_cik(cfg['ticker'],False)
    accession=item['remoteAccession'];end=item.get('remoteReportDate')or''
    from official_segments import _request_json
    base=f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{accession.replace('-','')}/"
    recent=_request_json(f'https://data.sec.gov/submissions/CIK{int(cik):010d}.json')['filings']['recent']
    name=recent['primaryDocument'][recent['accessionNumber'].index(accession)]
    url=base+name;payload=deepcopy(previous);q=max(payload['financials']);old=deepcopy(payload['financials'][q])
    complete_current_chart(payload,cfg,documents=[(url,_request(url).decode('utf-8',errors='replace'),item['remoteFilingDate'])])
    entry=payload['financials'][q]
    if chart_issues(payload)and not chart_issues(previous)and abs(entry['revenueBn']-old['revenueBn'])<=max(.001,old['revenueBn']*.001):
        for field in (*FIELDS,'officialRevenueStyle','officialRevenueReconciliation','officialRevenueTaxonomyChangedFromPreviousQuarter'):
            if field in old:entry[field]=deepcopy(old[field])
            else:entry.pop(field,None)
    for field in FIELDS:
        for row in entry.get(field)or[]:
            if not row.get('filingDate')and row.get('sourceUrl')==old.get('statementSourceUrl'):
                row['filingDate']=old.get('statementFilingDate')
    entry.update(statementFilingDate=item['remoteFilingDate'],statementSourceUrl=url,statementAccession=accession,
                 automaticEarnings=dict(filingDate=item['remoteFilingDate'],accession=accession,form=item['remoteForm']))
    finalize_company_payload(cfg,payload,payload.get('statementPresets')or{})
    for period,values in previous['financials'].items():
        if period<q:payload['financials'][period]=deepcopy(values)
    return apply_usd_display_fields(payload,load_fx_cache())


def refresh_one(item: dict, timeout: int = 150) -> None:
    paths = [ROOT / "data/earnings-dataset.json", ROOT / "data/dataset-index.json", ROOT / f"data/cache/{item['companyId']}.json"]
    snapshots = {path: path.read_bytes() if path.exists() else None for path in paths}
    try:
        old_dataset=json.loads(snapshots[paths[0]])
        previous=next((c for c in old_dataset['companies']if c['id']==item['companyId']),{})
        # A newly discovered IR split still needs a fresh financial trunk;
        # cache-only supplementation can otherwise publish a structure-only row.
        command = checker.build_refresh_command([item["companyId"]], refresh=True)
        if item.get("buildRefreshMode") == "full-refresh":
            command = [sys.executable, str(ROOT / "scripts/build_dataset.py"), "--refresh", "--companies", item["companyId"]]
        if item.get('reason')=='official-filing-enrichment-ready'and previous and item.get('remoteQuarter')==max(previous.get('financials',{}),default=''):
            payload=enrich_reported_period(item,previous)
            from prepare_pages_artifact import write_dataset_index_file
            old_dataset['companies']=[payload if c['id']==item['companyId']else c for c in old_dataset['companies']]
            save(paths[0],old_dataset);save(paths[-1],payload);write_dataset_index_file(old_dataset,paths[1])
            result=subprocess.CompletedProcess(command,0)
        else:
            result = subprocess.run(command, cwd=ROOT, timeout=300 if item.get("buildRefreshMode") == "full-refresh" else timeout)
            payload = json.loads(paths[-1].read_text())
            # Updating one reporting period must not regenerate historical
            # chart values/layout metadata from a different provider snapshot.
            latest=max(payload.get('financials',{}),default='')
            for period,values in previous.get('financials',{}).items():
                if period<latest and complete_quarter(values,item['companyId']):payload['financials'][period]=deepcopy(values)
            from prepare_pages_artifact import write_dataset_index_file
            combined=json.loads(paths[0].read_text())
            combined['companies']=[payload if c['id']==item['companyId']else c for c in combined['companies']]
            save(paths[-1],payload);save(paths[0],combined);write_dataset_index_file(combined,paths[1])
        validate_refresh(item, payload, previous)
        from margin_metrics import missing_margin_comparisons
        missing = missing_margin_comparisons(payload['financials'], checker.latest_local_quarter(payload))
        if missing:
            raise ValueError(f"{item['companyId']}: missing margin comparisons: {', '.join(missing)}")
        # Exercise the same JS runtime and both chart modes used by the manual
        # chart command. A data-only refresh is not a completed chart update.
        from render_company_charts import run_direct_renderer
        quarter=checker.latest_local_quarter(payload)
        with tempfile.TemporaryDirectory(prefix='earnings-chart-update-') as directory:
            for language in ('zh','en'):
                rendered=run_direct_renderer(paths[-1],Path(directory),quarter,language,['sankey','bars'],f'{item["companyId"]}-{language}')
                for mode in ('sankey','bars'):
                    svg=Path(rendered['outputs'][mode]['svg']).read_text()
                    if not svg.lstrip().startswith('<svg') or not svg.rstrip().endswith('</svg>'):
                        raise ValueError(f'{item["companyId"]}: {mode} did not generate a complete SVG')
                    import re
                    if re.search(r'(?:="|[ ,])(?:NaN|[+-]?Infinity)(?:[" ,<]|$)',svg):
                        raise ValueError(f'{item["companyId"]}: invalid geometry in {mode}')
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
    eligible=[]
    from earnings_windows import release_window
    calendar_day=datetime.now(timezone.utc).date().isoformat()
    for company in companies:
        active,reason=release_window(company,locals_by_id.get(company['id']))
        if active or getattr(args,'companies',''):
            eligible.append(company)
        elif state.get(company['id'],{}).get('lastCalendarCheck')!=calendar_day:
            # A daily official-index probe catches rescheduled releases, but
            # does not scrape financial tables or rebuild charts without one.
            state.setdefault(company['id'],{})['lastCalendarCheck']=calendar_day
            eligible.append({**company,'_calendarProbeOnly':True})
        else:
            report['report'].append(dict(companyId=company['id'],ticker=company['ticker'],needsUpdate=False,reason=reason))
            report['checked']+=1
    with ThreadPoolExecutor(max_workers=3) as pool:
        futures = {pool.submit(bounded_detect, c, locals_by_id.get(c["id"]), bool(args.universe)): c for c in eligible}
        for future in as_completed(futures):
            company = futures[future]
            try:
                item = future.result()
            except Exception as error:
                item = dict(companyId=company["id"], ticker=company["ticker"], needsUpdate=False, reason="check-failed", error=str(error))
                report["failedCompanies"].append(company["id"])
            report["report"].append(item)
            if item.get('reason') == 'incomplete-chart-classification' and state.get(company['id'], {}).get('error'):
                item['buildRefreshMode'] = 'full-refresh'
            if (state.get(company["id"], {}).get("pendingDetails")
                and item.get("reason") not in {"check-failed", "incomplete-chart-classification"}
                and (item.get('remoteQuarter') or '') <= (item.get('localQuarter') or '')):
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
    if not args.dry_run:save(args.state_path,state)
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
