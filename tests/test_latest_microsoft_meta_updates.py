import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATASET_PATH = ROOT / "data" / "earnings-dataset.json"


class LatestMicrosoftMetaUpdatesTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        dataset = json.loads(DATASET_PATH.read_text(encoding="utf-8"))
        cls.companies = {company["id"]: company for company in dataset["companies"]}

    def test_microsoft_fy2026_q4_official_results(self) -> None:
        company = self.companies["microsoft"]
        self.assertEqual(company["quarters"][-1], "2026Q2")
        entry = company["financials"]["2026Q2"]

        self.assertEqual(entry["fiscalLabel"], "FY2026 Q4")
        self.assertEqual(entry["revenueBn"], 90.007)
        self.assertEqual(entry["grossProfitBn"], 60.482)
        self.assertEqual(entry["operatingIncomeBn"], 40.603)
        self.assertEqual(entry["netIncomeBn"], 35.766)
        self.assertEqual(entry["statementFilingDate"], "2026-07-29")

        segments = {row["memberKey"]: row["valueBn"] for row in entry["officialRevenueSegments"]}
        self.assertEqual(
            segments,
            {
                "productivitybusinessprocesses": 37.847,
                "intelligentcloud": 39.306,
                "morepersonalcomputing": 12.854,
            },
        )
        self.assertAlmostEqual(sum(segments.values()), entry["revenueBn"], places=9)
        self.assertAlmostEqual(
            sum(row["valueBn"] for row in entry["officialCostBreakdown"]),
            entry["costOfRevenueBn"],
            places=9,
        )
        self.assertAlmostEqual(
            sum(row["valueBn"] for row in entry["officialOpexBreakdown"]),
            entry["operatingExpensesBn"],
            places=9,
        )

    def test_meta_q2_2026_official_results(self) -> None:
        company = self.companies["meta"]
        self.assertEqual(company["quarters"][-1], "2026Q2")
        entry = company["financials"]["2026Q2"]

        self.assertEqual(entry["fiscalLabel"], "FY2026 Q2")
        self.assertEqual(entry["revenueBn"], 60.801)
        self.assertEqual(entry["grossProfitBn"], 49.471)
        self.assertEqual(entry["operatingIncomeBn"], 18.775)
        self.assertEqual(entry["netIncomeBn"], 15.848)
        self.assertEqual(entry["statementFilingDate"], "2026-07-29")

        segments = {row["memberKey"]: row["valueBn"] for row in entry["officialRevenueSegments"]}
        self.assertEqual(segments, {"familyofapps": 60.37, "realitylabs": 0.431})
        details = {row["memberKey"]: row["valueBn"] for row in entry["officialRevenueDetailGroups"]}
        self.assertEqual(details, {"advertising": 59.363, "other": 1.007})
        self.assertAlmostEqual(sum(segments.values()), entry["revenueBn"], places=9)
        self.assertAlmostEqual(sum(details.values()), segments["familyofapps"], places=9)
        self.assertAlmostEqual(
            sum(row["valueBn"] for row in entry["officialCostBreakdown"]),
            entry["costOfRevenueBn"],
            places=9,
        )
        self.assertAlmostEqual(
            sum(row["valueBn"] for row in entry["officialOpexBreakdown"]),
            entry["operatingExpensesBn"],
            places=9,
        )


if __name__ == "__main__":
    unittest.main()
