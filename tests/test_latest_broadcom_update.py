from __future__ import annotations

import json
import unittest
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]


class LatestBroadcomUpdateTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        dataset = json.loads((ROOT_DIR / "data" / "earnings-dataset.json").read_text(encoding="utf-8"))
        cls.company = next(company for company in dataset["companies"] if company["id"] == "broadcom")
        cls.quarter = cls.company["financials"]["2026Q3"]

    def test_latest_quarter_matches_official_release(self) -> None:
        self.assertEqual(self.company["quarters"][-1], "2026Q3")
        self.assertEqual(self.quarter["periodEnd"], "2026-08-02")
        self.assertEqual(self.quarter["fiscalLabel"], "FY2026 Q3")
        self.assertEqual(self.quarter["revenueBn"], 29.591)
        self.assertEqual(self.quarter["costOfRevenueBn"], 9.135)
        self.assertEqual(self.quarter["grossProfitBn"], 20.456)
        self.assertEqual(self.quarter["operatingExpensesBn"], 4.501)
        self.assertEqual(self.quarter["operatingIncomeBn"], 15.955)
        self.assertEqual(self.quarter["netIncomeBn"], 13.088)
        self.assertEqual(self.quarter["statementSourceUrl"], "https://investors.broadcom.com/node/64671/pdf")

    def test_official_classifications_reconcile_to_statement_totals(self) -> None:
        segments = {row["memberKey"]: row for row in self.quarter["officialRevenueSegments"]}
        self.assertEqual(segments["semiconductorsolutions"]["valueBn"], 20.839)
        self.assertEqual(segments["infrastructuresoftware"]["valueBn"], 8.752)
        self.assertAlmostEqual(sum(row["valueBn"] for row in segments.values()), self.quarter["revenueBn"], places=3)

        self.assertAlmostEqual(
            sum(row["valueBn"] for row in self.quarter["officialCostBreakdown"]),
            self.quarter["costOfRevenueBn"],
            places=3,
        )
        self.assertAlmostEqual(
            sum(row["valueBn"] for row in self.quarter["officialOpexBreakdown"]),
            self.quarter["operatingExpensesBn"],
            places=3,
        )


if __name__ == "__main__":
    unittest.main()
