from datetime import datetime, timedelta, timezone
from pathlib import Path
import sys
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from check_earnings_scheduler import decision


class SchedulerTests(unittest.TestCase):
    def test_recovery_only_when_poll_is_missing(self):
        now = datetime(2026, 11, 3, tzinfo=timezone.utc)
        self.assertEqual(decision([], now), "dispatch")
        self.assertEqual(decision([dict(status="completed", created_at=(now-timedelta(minutes=95)).isoformat())], now), "dispatch")
        self.assertEqual(decision([dict(status="completed", created_at=(now-timedelta(minutes=20)).isoformat())], now), "recent")
        self.assertEqual(decision([dict(status="completed", created_at=(now-timedelta(minutes=2)).isoformat())], now), "recent")

    def test_active_refresh_is_not_duplicated(self):
        now = datetime(2026, 11, 3, tzinfo=timezone.utc)
        self.assertEqual(decision([dict(status="in_progress", created_at=now.isoformat())], now), "active")


if __name__ == "__main__":
    unittest.main()
