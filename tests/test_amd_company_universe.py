import sys
import json
import unittest
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = ROOT_DIR / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

import build_dataset  # noqa: E402


class AmdCompanyUniverseTests(unittest.TestCase):
    def test_amd_is_available_for_dataset_build_and_page_selection(self) -> None:
        amd = next((company for company in build_dataset.TOP30_COMPANIES if company["id"] == "amd"), None)

        self.assertIsNotNone(amd)
        self.assertEqual(amd["ticker"], "AMD")
        self.assertEqual(amd["slug"], "amd")
        self.assertEqual(amd["nameEn"], "AMD")
        self.assertEqual(amd["nameZh"], "超威半导体")
        self.assertFalse(amd["isAdr"])
        self.assertEqual(amd["financialSource"], "stockanalysis")
        self.assertTrue(build_dataset.company_matches_selection(amd, {"amd"}))

    def test_amd_dataset_has_thirty_segmented_bar_quarters_through_latest(self) -> None:
        dataset_path = ROOT_DIR / "data" / "earnings-dataset.json"
        dataset = json.loads(dataset_path.read_text(encoding="utf-8"))
        amd = next((company for company in dataset["companies"] if company["id"] == "amd"), None)

        self.assertIsNotNone(amd)
        self.assertIn("2025Q4", amd["quarters"])
        self.assertGreaterEqual(len(amd["quarters"]), 30)
        segmented_quarters = [
            quarter
            for quarter in amd["quarters"]
            if amd["financials"].get(quarter, {}).get("officialRevenueSegments")
        ]
        self.assertGreaterEqual(len(segmented_quarters), 30)
        self.assertEqual(segmented_quarters[-1], "2025Q4")
        self.assertGreaterEqual(len(amd["financials"]["2018Q3"]["officialRevenueSegments"]), 2)
        self.assertEqual(
            {row["memberKey"] for row in amd["financials"]["2025Q4"]["officialRevenueSegments"]},
            {"datacenter", "client", "gaming", "embedded"},
        )
        for quarter in segmented_quarters:
            entry = amd["financials"][quarter]
            segment_total = round(sum(float(row["valueBn"]) for row in entry["officialRevenueSegments"]), 3)
            self.assertAlmostEqual(segment_total, float(entry["revenueBn"]), delta=0.05, msg=quarter)

    def test_amd_current_segment_taxonomy_uses_official_labels_not_shifted_xbrl_members(self) -> None:
        dataset_path = ROOT_DIR / "data" / "earnings-dataset.json"
        dataset = json.loads(dataset_path.read_text(encoding="utf-8"))
        amd = next((company for company in dataset["companies"] if company["id"] == "amd"), None)

        self.assertIsNotNone(amd)
        expected_by_quarter = {
            "2022Q1": {
                "datacenter": 1.293,
                "client": 2.124,
                "gaming": 1.875,
                "embedded": 0.595,
            },
            "2022Q2": {
                "datacenter": 1.486,
                "client": 2.152,
                "gaming": 1.655,
                "embedded": 1.257,
            },
            "2022Q3": {
                "datacenter": 1.609,
                "client": 1.022,
                "gaming": 1.631,
                "embedded": 1.303,
            },
            "2023Q1": {
                "datacenter": 1.295,
                "client": 0.739,
                "gaming": 1.757,
                "embedded": 1.562,
            },
            "2023Q2": {
                "datacenter": 1.321,
                "client": 0.998,
                "gaming": 1.581,
                "embedded": 1.459,
            },
            "2023Q3": {
                "datacenter": 1.598,
                "client": 1.453,
                "gaming": 1.506,
                "embedded": 1.243,
            },
            "2023Q4": {
                "datacenter": 2.282,
                "client": 1.461,
                "gaming": 1.368,
                "embedded": 1.057,
            },
        }
        for quarter, expected_segments in expected_by_quarter.items():
            segment_map = {
                row["memberKey"]: float(row["valueBn"])
                for row in amd["financials"][quarter]["officialRevenueSegments"]
            }
            self.assertEqual(set(segment_map), set(expected_segments), quarter)
            for member_key, expected_value in expected_segments.items():
                self.assertAlmostEqual(segment_map[member_key], expected_value, delta=0.005, msg=f"{quarter} {member_key}")


if __name__ == "__main__":
    unittest.main()
