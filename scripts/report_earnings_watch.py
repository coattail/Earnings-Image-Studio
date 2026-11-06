"""Action summary and failure status; never silently green on partial failures."""
import json
import os
from pathlib import Path
import sys

path = Path(sys.argv[1])
if not path.exists():
    print("::notice::No watch report (manual force refresh or interrupted run).")
    raise SystemExit(0)
report = json.loads(path.read_text())
lines = [f"Checked companies: {report['checked']}", f"Updated: {', '.join(report['updatedCompanies']) or 'none'}",
         f"Failed: {', '.join(report['failedCompanies']) or 'none'}", f"Queued for next run: {', '.join(report['deferredCompanies']) or 'none'}"]
if os.environ.get("GITHUB_STEP_SUMMARY"):
    with open(os.environ["GITHUB_STEP_SUMMARY"], "a") as summary:
        summary.write("\n\n".join(lines) + "\n")
for line in lines:
    print(line)
def cell(value):
    return str(value or '').replace('|', '\\|').replace('\r', ' ').replace('\n', ' ')


def annotation(value):
    return str(value).replace('%', '%25').replace('\r', '%0D').replace('\n', '%0A')


failures = [item for item in report.get('report', []) if item.get('companyId') in report['failedCompanies']]
if failures:
    details = ['\nFailure details\n', '| Company | Phase | Quarter | Consecutive failures | Error | Source |',
               '| --- | --- | --- | --- | --- | --- |']
    for item in failures:
        failure = item.get('failure') or {}
        message = failure.get('message') or item.get('refreshError') or item.get('error') or 'See diagnostic artifact'
        values = [item['companyId'], failure.get('phase') or item.get('reason'), failure.get('quarter'),
                  failure.get('consecutiveFailures', 1), message[:500], failure.get('sourceUrl')]
        details.append('| ' + ' | '.join(cell(v) for v in values) + ' |')
        repeated = failure.get('sameFailureCount', 1)
        if repeated >= 3:
            print(f"::error::{annotation(item['companyId'])}: same failure repeated {repeated} times; inspect the source/parser. {annotation(message)}")
        else:
            print(f"::error::{annotation(item['companyId'])}: {annotation(failure.get('phase') or item.get('reason'))}: {annotation(message)}")
    details.append('\nValid sibling updates remain publishable. Failed issuers keep their last validated data and retry on the next eligible run.\n')
    if os.environ.get('GITHUB_STEP_SUMMARY'):
        with open(os.environ['GITHUB_STEP_SUMMARY'], 'a') as summary:
            summary.write('\n'.join(details))
for item in report.get("report", []):
    if item.get("reason") == "outside-classified-reporting-period":
        message = f"{item['companyId']}: {item.get('remoteQuarter')} statement detected; chart publication remains limited to configured half-year / annual classified periods."
        print(f"::notice::{message}")
        if os.environ.get("GITHUB_STEP_SUMMARY"):
            with open(os.environ["GITHUB_STEP_SUMMARY"], "a") as summary:
                summary.write(f"\n{message}\n")
for item in report.get("pendingDetails", []):
    print(f"::warning::{item['companyId']}: core financial data published; classification details pending; retry queued")
if report["failedCompanies"] or report["deferredCompanies"] or report.get("pendingDetails"):
    print("::error::Earnings watch is incomplete. Valid sibling updates were published; see diagnostic artifact. Remaining issuers will be retried.")
    raise SystemExit(1)
