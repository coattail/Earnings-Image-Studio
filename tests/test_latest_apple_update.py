import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATASET_PATH = ROOT / "data" / "earnings-dataset.json"
SOURCE_URL = (
    "https://www.sec.gov/Archives/edgar/data/320193/"
    "000032019326000018/a8-kex991q3202606272026.htm"
)


class LatestAppleUpdateTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        dataset = json.loads(DATASET_PATH.read_text(encoding="utf-8"))
        cls.company = next(
            company for company in dataset["companies"] if company["id"] == "apple"
        )

    def test_apple_fy2026_q3_official_results(self) -> None:
        self.assertEqual(self.company["quarters"][-1], "2026Q2")
        entry = self.company["financials"]["2026Q2"]

        self.assertEqual(entry["fiscalLabel"], "FY2026 Q3")
        self.assertEqual(entry["periodEnd"], "2026-06-27")
        self.assertEqual(entry["revenueBn"], 109.417)
        self.assertEqual(entry["grossProfitBn"], 54.77)
        self.assertEqual(entry["operatingIncomeBn"], 35.695)
        self.assertEqual(entry["netIncomeBn"], 29.789)
        self.assertEqual(entry["statementFilingDate"], "2026-07-30")
        self.assertEqual(entry["statementSourceUrl"], SOURCE_URL)

    def test_product_and_service_sales_reconcile_to_revenue(self) -> None:
        entry = self.company["financials"]["2026Q2"]
        segments = {
            row["memberKey"]: row["valueBn"]
            for row in entry["officialRevenueSegments"]
        }
        details = {
            row["memberKey"]: row["valueBn"]
            for row in entry["officialRevenueDetailGroups"]
        }

        self.assertEqual(segments, {"products": 78.678, "services": 30.739})
        self.assertEqual(
            details,
            {
                "iphone": 54.252,
                "mac": 10.352,
                "ipad": 6.191,
                "wearables": 7.883,
            },
        )
        self.assertAlmostEqual(sum(segments.values()), entry["revenueBn"], places=9)
        self.assertAlmostEqual(sum(details.values()), segments["products"], places=9)
        self.assertTrue(
            all(row.get("yoyPct") is not None for row in entry["officialRevenueSegments"])
        )
        self.assertTrue(
            all(row.get("qoqPct") is not None for row in entry["officialRevenueDetailGroups"])
        )

    def test_cost_and_operating_expense_breakdowns_reconcile(self) -> None:
        entry = self.company["financials"]["2026Q2"]
        cost_of_sales = sum(
            row["valueBn"] for row in entry["officialCostBreakdown"]
        )
        operating_expenses = sum(
            row["valueBn"] for row in entry["officialOpexBreakdown"]
        )

        self.assertAlmostEqual(cost_of_sales, entry["costOfRevenueBn"], places=9)
        self.assertAlmostEqual(
            operating_expenses,
            entry["operatingExpensesBn"],
            places=9,
        )
        self.assertAlmostEqual(
            entry["grossProfitBn"] - operating_expenses,
            entry["operatingIncomeBn"],
            places=9,
        )


if __name__ == "__main__":
    unittest.main()
