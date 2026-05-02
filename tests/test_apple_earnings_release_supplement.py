import sys
import unittest
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = ROOT_DIR / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

import build_dataset  # noqa: E402


class AppleEarningsReleaseSupplementTests(unittest.TestCase):
    def test_supplement_adds_fy2026_q2_release_before_sec_quarter_arrives(self) -> None:
        payload = {
            "id": "apple",
            "quarters": ["2025Q1"],
            "financials": {
                "2025Q1": {
                    "calendarQuarter": "2025Q1",
                    "periodEnd": "2025-03-29",
                    "revenueBn": 95.359,
                    "netIncomeBn": 24.78,
                    "officialRevenueSegments": [
                        {"name": "Products", "memberKey": "products", "valueBn": 68.714},
                        {"name": "Services", "memberKey": "services", "valueBn": 26.645},
                    ],
                    "officialRevenueDetailGroups": [
                        {"name": "iPhone", "memberKey": "iphone", "valueBn": 46.841},
                        {"name": "Services", "memberKey": "services", "valueBn": 26.645},
                    ],
                },
            },
        }

        updated = build_dataset.supplement_apple_earnings_release_financials(payload)
        entry = updated["financials"]["2026Q1"]

        self.assertIn("2026Q1", updated["quarters"])
        self.assertEqual(entry["fiscalLabel"], "FY2026 Q2")
        self.assertEqual(entry["periodEnd"], "2026-03-28")
        self.assertEqual(entry["revenueBn"], 111.184)
        self.assertEqual(entry["netIncomeBn"], 29.578)
        self.assertEqual(entry["statementSource"], "apple-earnings-release")
        self.assertEqual(entry["statementFilingDate"], "2026-04-30")
        self.assertAlmostEqual(entry["revenueYoyPct"], 16.595)
        self.assertAlmostEqual(entry["profitMarginPct"], 26.602)

        segments = {row["memberKey"]: row["valueBn"] for row in entry["officialRevenueSegments"]}
        self.assertEqual(segments, {"products": 80.208, "services": 30.976})

        details = {row["memberKey"]: row["valueBn"] for row in entry["officialRevenueDetailGroups"]}
        self.assertEqual(details["iphone"], 56.994)
        self.assertEqual(details["mac"], 8.399)
        self.assertEqual(details["ipad"], 6.914)
        self.assertEqual(details["wearables"], 7.901)
        self.assertNotIn("services", details)


if __name__ == "__main__":
    unittest.main()
