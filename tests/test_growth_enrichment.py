from __future__ import annotations

import sys
import unittest
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = ROOT_DIR / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from build_dataset import apply_revenue_structure_history, enrich_growth_rows  # noqa: E402


def _quarter(revenue: float, share: float, qoq: float | None) -> dict:
    row = {
        "name": "Example",
        "memberKey": "example",
        "valueBn": share,
        "mixPct": share,
        "metricMode": "share",
        "yoyPct": None,
        "qoqPct": qoq,
    }
    return {"revenueBn": revenue, "officialRevenueSegments": [row]}


class GrowthEnrichmentTests(unittest.TestCase):
    def test_share_yoy_uses_the_full_category_history(self) -> None:
        financials = {
            "2025Q2": _quarter(100, 1, 6),
            "2025Q3": _quarter(120, 1, -20),
            "2025Q4": _quarter(140, 1, -22),
            "2026Q1": _quarter(160, 1, 28),
            "2026Q2": _quarter(180, 1, 5),
        }

        enrich_growth_rows(financials, "officialRevenueSegments")

        latest = financials["2026Q2"]["officialRevenueSegments"][0]
        self.assertEqual(latest["yoyPct"], -16.13)
        self.assertEqual(latest["qoqPct"], 5)

    def test_missing_growth_falls_back_to_calculated_values(self) -> None:
        financials = {
            "2025Q1": _quarter(80, 10, None),
            "2026Q1": _quarter(100, 20, None),
        }

        enrich_growth_rows(financials, "officialRevenueSegments")

        latest = financials["2026Q1"]["officialRevenueSegments"][0]
        self.assertEqual(latest["yoyPct"], 150.0)

    def test_exact_value_rows_keep_direct_yoy_calculation(self) -> None:
        financials = {
            "2025Q2": {
                "revenueBn": 100,
                "officialRevenueSegments": [{"name": "Exact", "memberKey": "exact", "valueBn": 10, "yoyPct": None, "qoqPct": None}],
            },
            "2026Q2": {
                "revenueBn": 150,
                "officialRevenueSegments": [{"name": "Exact", "memberKey": "exact", "valueBn": 15, "yoyPct": None, "qoqPct": None}],
            },
        }

        enrich_growth_rows(financials, "officialRevenueSegments")

        latest = financials["2026Q2"]["officialRevenueSegments"][0]
        self.assertEqual(latest["yoyPct"], 50.0)

    def test_reported_growth_override_replaces_calculated_growth(self) -> None:
        payload = {
            "id": "example",
            "financials": {
                "2026Q1": _quarter(100, 1, None),
            },
        }
        history = {
            "quarters": {
                "2026Q1": {
                    "growthOverrides": {
                        "example": {"qoqPct": 28},
                    }
                }
            }
        }

        result = apply_revenue_structure_history(payload, {"id": "example"}, history)

        row = result["financials"]["2026Q1"]["officialRevenueSegments"][0]
        self.assertEqual(row["qoqPct"], 28)

    def test_schema_change_does_not_infer_growth_for_an_overlapping_key(self) -> None:
        financials = {
            "2025Q2": {
                "revenueBn": 100,
                "officialRevenueSegments": [
                    {"name": "Legacy", "memberKey": "legacy", "valueBn": 70, "yoyPct": None, "qoqPct": None},
                    {"name": "All others", "memberKey": "allothers", "valueBn": 30, "yoyPct": None, "qoqPct": None},
                ],
            },
            "2026Q1": {
                "revenueBn": 120,
                "officialRevenueSegments": [
                    {"name": "Legacy", "memberKey": "legacy", "valueBn": 75, "yoyPct": None, "qoqPct": None},
                    {"name": "All others", "memberKey": "allothers", "valueBn": 45, "yoyPct": None, "qoqPct": None},
                ],
            },
            "2026Q2": {
                "revenueBn": 150,
                "officialRevenueSegments": [
                    {"name": "New segment", "memberKey": "newsegment", "valueBn": 110, "yoyPct": 10, "qoqPct": None},
                    {"name": "All others", "memberKey": "allothers", "valueBn": 40, "yoyPct": 5, "qoqPct": None},
                ],
            },
        }

        enrich_growth_rows(financials, "officialRevenueSegments")

        latest_rows = {row["memberKey"]: row for row in financials["2026Q2"]["officialRevenueSegments"]}
        self.assertIsNone(latest_rows["allothers"]["qoqPct"])
        self.assertIsNone(latest_rows["allothers"].get("mixYoyDeltaPp"))
        self.assertEqual(latest_rows["allothers"]["yoyPct"], 5)
        self.assertTrue(financials["2026Q2"]["officialRevenueTaxonomyChangedFromPreviousQuarter"])
        self.assertTrue(financials["2026Q2"]["officialRevenueTaxonomyChangedFromPriorYear"])


if __name__ == "__main__":
    unittest.main()
