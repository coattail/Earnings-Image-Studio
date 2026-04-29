import json
import unittest
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
DATASET_PATH = ROOT_DIR / "data" / "earnings-dataset.json"


class LatestMegacapEarningsUpdateTests(unittest.TestCase):
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
