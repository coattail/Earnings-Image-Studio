import json
import unittest
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
WALMART_PAYLOAD = ROOT_DIR / "data" / "cache" / "walmart.json"


class WalmartSegmentHistoryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.payload = json.loads(WALMART_PAYLOAD.read_text(encoding="utf-8"))

    def segment_total(self, quarter_key: str) -> float:
        rows = self.payload["financials"][quarter_key]["officialRevenueSegments"]
        return round(sum(float(row.get("valueBn") or 0) for row in rows), 3)

    def test_legacy_segment_quarters_use_total_segment_contexts(self) -> None:
        self.assertEqual(self.segment_total("2018Q2"), 121.63)
        self.assertEqual(self.segment_total("2019Q2"), 122.949)
        self.assertEqual(self.segment_total("2020Q1"), 140.608)

    def test_visible_segment_history_has_no_partial_or_annualized_outlier(self) -> None:
        totals = [self.segment_total(quarter_key) for quarter_key in self.payload["quarters"]]

        self.assertGreaterEqual(min(totals), 120)
        self.assertLessEqual(max(totals), 195)
        neighbors = [self.segment_total("2019Q4"), self.segment_total("2020Q2")]
        self.assertLess(self.segment_total("2020Q1"), max(neighbors) * 1.2)

    def test_legacy_revenue_outliers_are_aligned_after_segment_refresh(self) -> None:
        for quarter_key in ("2018Q2", "2018Q3", "2018Q4", "2019Q1", "2019Q2", "2020Q1"):
            entry = self.payload["financials"][quarter_key]
            self.assertEqual(round(float(entry["revenueBn"]), 3), self.segment_total(quarter_key))
            self.assertIn("revenue-aligned-to-corrected-segment-sum", entry.get("qualityFlags") or [])


if __name__ == "__main__":
    unittest.main()
