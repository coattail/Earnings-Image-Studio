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
for item in report.get("pendingDetails", []):
    print(f"::warning::{item['companyId']}: core financial data published; classification details pending; retry queued")
if report["failedCompanies"] or report["deferredCompanies"] or report.get("pendingDetails"):
    print("::error::Earnings watch is incomplete. Valid sibling updates were published; see diagnostic artifact. Remaining issuers will be retried.")
    raise SystemExit(1)
