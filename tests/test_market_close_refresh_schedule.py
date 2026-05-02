import importlib.util
import re
import unittest
from datetime import datetime
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
WORKFLOW_PATH = ROOT_DIR / ".github" / "workflows" / "update-data.yml"
SCHEDULE_SCRIPT_PATH = ROOT_DIR / "scripts" / "should_run_market_close_refresh.py"


def load_schedule_module():
    spec = importlib.util.spec_from_file_location("should_run_market_close_refresh", SCHEDULE_SCRIPT_PATH)
    if spec is None or spec.loader is None:
        raise AssertionError("Unable to load market close schedule script")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class MarketCloseRefreshScheduleTests(unittest.TestCase):
    def test_workflow_runs_at_market_close_plus_one_hour_in_both_dst_modes(self) -> None:
        workflow = WORKFLOW_PATH.read_text(encoding="utf-8")

        self.assertIn('cron: "0 21 * * 1-5"', workflow)
        self.assertIn('cron: "0 22 * * 1-5"', workflow)
        self.assertRegex(workflow, re.compile(r"should_run_market_close_refresh\.py"))
        self.assertIn("id: market-close-gate", workflow)
        self.assertIn("should_run=true", workflow)
        self.assertIn("should_run=false", workflow)
        self.assertIn("github.event_name != 'schedule' || steps.market-close-gate.outputs.should_run == 'true'", workflow)

    def test_gate_accepts_nyse_trading_day_at_five_pm_new_york_time(self) -> None:
        schedule = load_schedule_module()

        self.assertTrue(schedule.should_run(datetime.fromisoformat("2026-05-01T21:00:00+00:00")))
        self.assertTrue(schedule.should_run(datetime.fromisoformat("2026-12-01T22:00:00+00:00")))

    def test_gate_rejects_weekends_holidays_and_wrong_hour(self) -> None:
        schedule = load_schedule_module()

        self.assertFalse(schedule.should_run(datetime.fromisoformat("2026-05-02T21:00:00+00:00")))
        self.assertFalse(schedule.should_run(datetime.fromisoformat("2026-12-25T22:00:00+00:00")))
        self.assertFalse(schedule.should_run(datetime.fromisoformat("2026-05-01T22:00:00+00:00")))

    def test_gate_calculates_future_year_market_holidays(self) -> None:
        schedule = load_schedule_module()

        self.assertFalse(schedule.should_run(datetime.fromisoformat("2027-01-01T22:00:00+00:00")))
        self.assertFalse(schedule.should_run(datetime.fromisoformat("2027-03-26T21:00:00+00:00")))


if __name__ == "__main__":
    unittest.main()
