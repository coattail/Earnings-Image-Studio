"""Recover a missed earnings schedule without spawning overlapping refreshes."""
from datetime import datetime, timezone
import json
import os
import subprocess


def decision(runs, now):
    if any(run["status"] in {"queued", "in_progress", "waiting", "pending"} for run in runs):
        return "active"
    if not runs:
        return "dispatch"
    latest = max(datetime.fromisoformat(run["created_at"].replace("Z", "+00:00")) for run in runs)
    return "dispatch" if (now - latest).total_seconds() > 15 * 60 else "recent"


def main():
    repo = os.environ["GITHUB_REPOSITORY"]
    workflow = os.environ["TARGET_WORKFLOW"]
    runs = json.loads(subprocess.check_output(["gh", "api", f"repos/{repo}/actions/workflows/{workflow}/runs?per_page=5&branch=main"]))["workflow_runs"]
    status = decision(runs, datetime.now(timezone.utc))
    print(f"Earnings scheduler: {status}")
    if status == "dispatch":
        subprocess.run(["gh", "workflow", "run", workflow, "--repo", repo, "--ref", "main"], check=True)
        print("::warning::No earnings check started within 15 minutes; a recovery run was dispatched")


if __name__ == "__main__":
    main()
