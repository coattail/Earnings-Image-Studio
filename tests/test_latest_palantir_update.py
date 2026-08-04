import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATASET_PATH = ROOT / "data" / "earnings-dataset.json"
SOURCE_URL = (
    "https://www.sec.gov/Archives/edgar/data/1321655/"
    "000132165526000039/a2026q2ex991pressrelease.htm"
)
HISTORICAL_SOURCE_URL = (
    "https://www.sec.gov/Archives/edgar/data/1321655/"
    "000119312520258493/d904406d424b4.htm"
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

    def test_early_palantir_quarters_are_complete_and_conserved(self) -> None:
        expected = {
            "2019Q1": (0.146336, 0.044809, 0.101527, 0.246265, -0.144738, 0.003415, -0.141323, 0.005070, -0.146393),
            "2019Q2": (0.176320, 0.056589, 0.119731, 0.259846, -0.140115, 0.007438, -0.132677, 0.001389, -0.134066),
            "2019Q4": (0.229358, 0.075902, 0.153456, 0.300907, -0.147451, -0.007986, -0.155437, 0.003890, -0.159327),
        }
        fields = (
            "revenueBn",
            "costOfRevenueBn",
            "grossProfitBn",
            "operatingExpensesBn",
            "operatingIncomeBn",
            "nonOperatingBn",
            "pretaxIncomeBn",
            "taxBn",
            "netIncomeBn",
        )

        for quarter, values in expected.items():
            with self.subTest(quarter=quarter):
                entry = self.company["financials"][quarter]
                self.assertEqual(tuple(entry[field] for field in fields), values)
                self.assertEqual(entry["statementSourceUrl"], HISTORICAL_SOURCE_URL)
                self.assertEqual(entry["statementValueMode"], "reported")
                self.assertEqual(
                    [row["memberKey"] for row in entry["officialOpexBreakdown"]],
                    ["salesandmarketing", "researchanddevelopment", "generalandadministrative"],
                )
                opex = sum(row["valueBn"] for row in entry["officialOpexBreakdown"])
                self.assertAlmostEqual(entry["revenueBn"] - entry["costOfRevenueBn"], entry["grossProfitBn"], places=9)
                self.assertAlmostEqual(opex, entry["operatingExpensesBn"], places=9)
                self.assertAlmostEqual(entry["grossProfitBn"] - opex, entry["operatingIncomeBn"], places=9)
                self.assertAlmostEqual(entry["operatingIncomeBn"] + entry["nonOperatingBn"], entry["pretaxIncomeBn"], places=9)
                self.assertAlmostEqual(entry["pretaxIncomeBn"] - entry["taxBn"], entry["netIncomeBn"], places=9)


if __name__ == "__main__":
    unittest.main()
