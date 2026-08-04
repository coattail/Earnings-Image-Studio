import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATASET_PATH = ROOT / "data" / "earnings-dataset.json"
SOURCE_URL = (
    "https://www.sec.gov/Archives/edgar/data/1321655/"
    "000132165526000039/a2026q2ex991pressrelease.htm"
)


class LatestPalantirUpdateTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        dataset = json.loads(DATASET_PATH.read_text(encoding="utf-8"))
        cls.company = next(
            company for company in dataset["companies"] if company["id"] == "palantir"
        )

    def test_palantir_q2_2026_official_results(self) -> None:
        self.assertEqual(self.company["quarters"][-1], "2026Q2")
        entry = self.company["financials"]["2026Q2"]

        self.assertEqual(entry["fiscalLabel"], "FY2026 Q2")
        self.assertEqual(entry["periodEnd"], "2026-06-30")
        self.assertEqual(entry["revenueBn"], 1.935464)
        self.assertEqual(entry["grossProfitBn"], 1.638594)
        self.assertEqual(entry["operatingIncomeBn"], 0.912004)
        self.assertEqual(entry["netIncomeBn"], 1.06189)
        self.assertEqual(entry["statementFilingDate"], "2026-08-03")
        self.assertEqual(entry["statementSourceUrl"], SOURCE_URL)

    def test_government_and_commercial_revenue_are_current(self) -> None:
        entry = self.company["financials"]["2026Q2"]
        segments = {
            row["memberKey"]: row["valueBn"]
            for row in entry["officialRevenueSegments"]
        }

        self.assertEqual(
            segments,
            {"governmentoperating": 0.99, "commercial": 0.945},
        )
        self.assertLess(abs(sum(segments.values()) - entry["revenueBn"]), 0.001)

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
