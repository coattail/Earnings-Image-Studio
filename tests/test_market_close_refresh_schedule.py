import unittest
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
WORKFLOW_PATH = ROOT_DIR / ".github" / "workflows" / "update-data.yml"
class MarketCloseRefreshScheduleTests(unittest.TestCase):
    def test_workflow_uses_new_york_timezone_without_exact_minute_gate(self) -> None:
        workflow = WORKFLOW_PATH.read_text(encoding="utf-8")

        self.assertIn('timezone: "America/New_York"', workflow)
        self.assertIn('cron: "17 16-21 * 1,2,4,5,7,8,10,11 1-5"', workflow)
        self.assertIn('cron: "17 17 * 3,6,9,12 1-5"', workflow)
        self.assertNotIn("market-close-gate", workflow)
        self.assertNotIn("should_run_market_close_refresh.py", workflow)

    def test_workflow_persists_update_diagnostics(self) -> None:
        workflow = WORKFLOW_PATH.read_text(encoding="utf-8")

        self.assertIn("--report-path output/update-report.json", workflow)
        self.assertIn("--fail-on-check-errors", workflow)
        self.assertIn('if [[ "${{ github.event_name }}" == "workflow_dispatch" ]]', workflow)
        self.assertIn('scheduled_update_limit="1"', workflow)
        self.assertIn("--defer-refresh-failures", workflow)
        self.assertIn("actions/upload-artifact@v7", workflow)


if __name__ == "__main__":
    unittest.main()
