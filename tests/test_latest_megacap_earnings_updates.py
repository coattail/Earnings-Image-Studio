import json
import unittest
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
DATASET_PATH = ROOT_DIR / "data" / "earnings-dataset.json"


class LatestMegacapEarningsUpdateTests(unittest.TestCase):
    def test_alphabet_and_tesla_2026q2_official_updates_are_complete(self) -> None:
        dataset = json.loads(DATASET_PATH.read_text(encoding="utf-8"))
        expected = {
            "alphabet": {
                "revenueBn": 119.796,
                "netIncomeBn": 112.193,
                "costOfRevenueBn": 45.943,
                "operatingExpensesBn": 33.083,
                "segments": {
                    "adrevenue": 81.629,
                    "googlecloud": 24.768,
                    "googleplay": 12.911,
                    "otherrevenue": 0.488,
                },
                "details": {
                    "searchadvertising": 63.271,
                    "youtube": 11.055,
                    "admob": 7.303,
                },
                "source": "https://www.sec.gov/Archives/edgar/data/1652044/000165204426000066/googexhibit991q22026.htm",
            },
            "tesla": {
                "revenueBn": 28.236,
                "netIncomeBn": 1.114,
                "costOfRevenueBn": 23.485,
                "operatingExpensesBn": 4.353,
                "segments": {
                    "auto": 20.516,
                    "energygenerationstorage": 3.139,
                    "services": 4.581,
                },
                "details": {
                    "autosales": 20.006,
                    "regulatorycredits": 0.146,
                    "leasing": 0.364,
                },
                "source": "https://assets-ir.tesla.com/tesla-contents/IR/TSLA-Q2-2026-Update.pdf",
            },
        }

        for company_id, company_expected in expected.items():
            with self.subTest(company_id=company_id):
                company = next(item for item in dataset["companies"] if item["id"] == company_id)
                self.assertEqual(company["quarters"][-1], "2026Q2")
                entry = company["financials"]["2026Q2"]
                self.assertEqual(entry["periodEnd"], "2026-06-30")
                self.assertEqual(entry["statementFilingDate"], "2026-07-22")
                self.assertEqual(entry["statementSourceUrl"], company_expected["source"])
                for field in ("revenueBn", "netIncomeBn", "costOfRevenueBn", "operatingExpensesBn"):
                    self.assertEqual(entry[field], company_expected[field])

                segments = {row["memberKey"]: row["valueBn"] for row in entry["officialRevenueSegments"]}
                details = {row["memberKey"]: row["valueBn"] for row in entry["officialRevenueDetailGroups"]}
                self.assertEqual(segments, company_expected["segments"])
                self.assertEqual(details, company_expected["details"])
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

                detail_parent = "adrevenue" if company_id == "alphabet" else "auto"
                self.assertAlmostEqual(sum(details.values()), segments[detail_parent], places=9)

    def test_new_2026q1_updates_have_complete_segment_growth(self) -> None:
        dataset = json.loads(DATASET_PATH.read_text(encoding="utf-8"))
        expected = {
            "microsoft": {
                "revenueBn": 82.886,
                "segments": {
                    "productivitybusinessprocesses": 35.013,
                    "intelligentcloud": 34.681,
                    "morepersonalcomputing": 13.192,
                },
            },
            "alphabet": {
                "revenueBn": 109.896,
                "segments": {
                    "adrevenue": 77.253,
                    "googlecloud": 20.028,
                    "googleplay": 12.384,
                    "otherrevenue": 0.231,
                },
            },
            "amazon": {
                "revenueBn": 181.519,
                "segments": {
                    "onlinestores": 64.254,
                    "thirdpartysellerservices": 41.578,
                    "amazonwebservices": 37.587,
                    "advertisingservices": 17.243,
                    "subscriptionservices": 13.427,
                    "physicalstores": 5.785,
                    "otherservices": 1.645,
                },
            },
            "meta": {
                "revenueBn": 56.311,
                "segments": {
                    "familyofapps": 55.909,
                    "realitylabs": 0.402,
                },
            },
        }

        for company_id, company_expected in expected.items():
            with self.subTest(company_id=company_id):
                company = next(item for item in dataset["companies"] if item["id"] == company_id)
                self.assertIn("2026Q1", company["quarters"])
                entry = company["financials"]["2026Q1"]
                self.assertEqual(entry["revenueBn"], company_expected["revenueBn"])
                self.assertIsNotNone(entry.get("revenueYoyPct"))
                self.assertIsNotNone(entry.get("revenueQoqPct"))

                rows = {row["memberKey"]: row for row in entry.get("officialRevenueSegments", [])}
                self.assertEqual(set(rows), set(company_expected["segments"]))
                for member_key, value_bn in company_expected["segments"].items():
                    row = rows[member_key]
                    self.assertEqual(row["valueBn"], value_bn)
                    self.assertIsNotNone(row.get("yoyPct"), member_key)
                    self.assertIsNotNone(row.get("qoqPct"), member_key)
                    self.assertIsNotNone(row.get("mixPct"), member_key)


if __name__ == "__main__":
    unittest.main()
