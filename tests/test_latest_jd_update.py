import json
import unittest
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]


class LatestJdUpdateTests(unittest.TestCase):
    def test_q2_2026_uses_complete_official_results(self) -> None:
        payload = json.loads((ROOT_DIR / "data" / "cache" / "jd.json").read_text(encoding="utf-8"))
        self.assertEqual(payload["quarters"][-1], "2026Q2")

        financial = payload["financials"]["2026Q2"]
        self.assertEqual(financial["statementFilingDate"], "2026-08-13")
        self.assertAlmostEqual(financial["revenueBn"], 346.401)
        self.assertAlmostEqual(financial["costOfRevenueBn"], 287.094)
        self.assertAlmostEqual(financial["operatingIncomeBn"], 4.547)
        self.assertAlmostEqual(financial["netIncomeBn"], 8.687)
        self.assertAlmostEqual(
            financial["grossProfitBn"] - financial["operatingExpensesBn"],
            financial["operatingIncomeBn"],
        )

        segments = {item["memberKey"]: item for item in financial["officialRevenueSegments"]}
        self.assertAlmostEqual(segments["netproductrevenues"]["valueBn"], 267.115)
        self.assertAlmostEqual(segments["netservicerevenues"]["valueBn"], 79.286)
        self.assertAlmostEqual(sum(item["valueBn"] for item in segments.values()), financial["revenueBn"])

        comparison = {
            item["memberKey"]: item
            for item in payload["financials"]["2025Q2"]["officialRevenueSegments"]
        }
        self.assertAlmostEqual(comparison["netproductrevenues"]["valueBn"], 282.414)
        self.assertAlmostEqual(comparison["netservicerevenues"]["valueBn"], 74.246)

    def test_dataset_exposes_q2_2026_as_jd_latest_quarter(self) -> None:
        dataset = json.loads((ROOT_DIR / "data" / "earnings-dataset.json").read_text(encoding="utf-8"))
        payload = next(company for company in dataset["companies"] if company["id"] == "jd")
        self.assertEqual(payload["quarters"][-1], "2026Q2")
        self.assertAlmostEqual(payload["financials"]["2026Q2"]["revenueBn"], 346.401)


if __name__ == "__main__":
    unittest.main()
