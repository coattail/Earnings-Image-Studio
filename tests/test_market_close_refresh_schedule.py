import unittest
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
WORKFLOW_PATH = ROOT_DIR / ".github" / "workflows" / "update-data.yml"
class MarketCloseRefreshScheduleTests(unittest.TestCase):
    def test_workflow_checks_every_market_every_month_at_five_minute_intervals(self) -> None:
        workflow = WORKFLOW_PATH.read_text(encoding="utf-8")

        self.assertIn('cron: "2-59/5 * * * *"', workflow)
        self.assertNotIn("market-close-gate", workflow)
        self.assertNotIn("should_run_market_close_refresh.py", workflow)

    def test_workflow_persists_update_diagnostics(self) -> None:
        workflow = WORKFLOW_PATH.read_text(encoding="utf-8")

        self.assertIn("--report-path output/update-report.json", workflow)
        self.assertIn("scripts/watch_earnings.py", workflow)
        self.assertNotIn('scheduled_update_limit="1"', workflow)
        self.assertNotIn("--defer-refresh-failures", workflow)
        self.assertIn("Surface incomplete checks and refreshes", workflow)
        self.assertIn("actions/upload-artifact@v7", workflow)


if __name__ == "__main__":
    unittest.main()
