import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATASET_PATH = ROOT / "data" / "earnings-dataset.json"
SOURCE_URL = (
    "https://www.sec.gov/Archives/edgar/data/1018724/"
    "000101872426000024/amzn-20260630xex991.htm"
)


class LatestAmazonUpdateTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        dataset = json.loads(DATASET_PATH.read_text(encoding="utf-8"))
        cls.company = next(
            company for company in dataset["companies"] if company["id"] == "amazon"
        )

    def test_amazon_q2_2026_official_results(self) -> None:
        self.assertEqual(self.company["quarters"][-1], "2026Q2")
        entry = self.company["financials"]["2026Q2"]

        self.assertEqual(entry["fiscalLabel"], "FY2026 Q2")
        self.assertEqual(entry["revenueBn"], 200.606)
        self.assertEqual(entry["grossProfitBn"], 104.828)
        self.assertEqual(entry["operatingIncomeBn"], 27.461)
        self.assertEqual(entry["netIncomeBn"], 62.647)
        self.assertEqual(entry["statementFilingDate"], "2026-07-30")
        self.assertEqual(entry["statementSourceUrl"], SOURCE_URL)

    def test_product_and_service_sales_reconcile_to_revenue(self) -> None:
        entry = self.company["financials"]["2026Q2"]
        segments = {
            row["memberKey"]: row["valueBn"]
            for row in entry["officialRevenueSegments"]
        }

        self.assertEqual(
            segments,
            {
                "onlinestores": 70.432,
                "thirdpartysellerservices": 46.78,
                "amazonwebservices": 42.232,
                "advertisingservices": 19.809,
                "subscriptionservices": 13.73,
                "physicalstores": 5.794,
                "otherservices": 1.829,
            },
        )
        self.assertAlmostEqual(sum(segments.values()), entry["revenueBn"], places=9)

    def test_operating_expenses_reconcile_to_operating_income(self) -> None:
        entry = self.company["financials"]["2026Q2"]
        opex = sum(row["valueBn"] for row in entry["officialOpexBreakdown"])

        self.assertAlmostEqual(opex, entry["operatingExpensesBn"], places=9)
        self.assertAlmostEqual(
            entry["grossProfitBn"] - opex,
            entry["operatingIncomeBn"],
            places=9,
        )


if __name__ == "__main__":
    unittest.main()
