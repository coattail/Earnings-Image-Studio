import sys
import unittest
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = ROOT_DIR / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

import build_dataset  # noqa: E402


class MicronBusinessUnitRestatementTests(unittest.TestCase):
    def test_dataset_recent_micron_segments_have_growth_metrics(self) -> None:
        dataset_path = ROOT_DIR / "data" / "earnings-dataset.json"
        dataset = __import__("json").loads(dataset_path.read_text(encoding="utf-8"))
        micron = next(company for company in dataset["companies"] if company["id"] == "micron")
        recent_quarters = ["2024Q3", "2024Q4", "2025Q1", "2025Q2", "2025Q3", "2025Q4", "2026Q1"]

        for quarter_key in recent_quarters:
            rows = [
                row
                for row in micron["financials"][quarter_key].get("officialRevenueSegments", [])
                if float(row.get("valueBn") or 0) > 0.02
            ]
            self.assertGreaterEqual(len(rows), 4, quarter_key)
            self.assertFalse([row["memberKey"] for row in rows if row.get("yoyPct") is None], quarter_key)
            self.assertFalse([row["memberKey"] for row in rows if row.get("qoqPct") is None], quarter_key)

    def test_finalize_applies_official_new_bu_restatement_from_fy25_q4(self) -> None:
        company = {"id": "micron", "ticker": "MU"}
        payload = {
            "id": "micron",
            "ticker": "MU",
            "quarters": ["2024Q3", "2025Q2", "2025Q3"],
            "financials": {
                "2024Q3": {
                    "calendarQuarter": "2024Q3",
                    "fiscalLabel": "FY2024 Q4",
                    "revenueBn": 7.75,
                    "officialRevenueSegments": [
                        {"name": "CNBU", "memberKey": "cnbu", "valueBn": 3.018},
                        {"name": "MBU", "memberKey": "mbu", "valueBn": 1.875},
                    ],
                },
                "2025Q2": {
                    "calendarQuarter": "2025Q2",
                    "fiscalLabel": "FY2025 Q3",
                    "revenueBn": 9.301,
                    "officialRevenueSegments": [
                        {"name": "CNBU", "memberKey": "cnbu", "valueBn": 5.069},
                        {"name": "MBU", "memberKey": "mbu", "valueBn": 1.551},
                    ],
                },
                "2025Q3": {
                    "calendarQuarter": "2025Q3",
                    "fiscalLabel": "FY2025 Q4",
                    "revenueBn": 11.315,
                    "officialRevenueSegments": [{"name": "All Other Segments", "memberKey": "allothersegments", "valueBn": 0.002}],
                },
            },
            "officialRevenueStructureHistory": {
                "source": "official-segment-cache",
                "quarters": {
                    "2025Q3": {
                        "segments": [{"name": "All Other Segments", "memberKey": "allothersegments", "valueBn": 0.002}],
                    },
                },
                "filingsUsed": [],
                "errors": [],
            },
            "parserDiagnostics": {
                "version": "universal-parser-v4",
                "financials": {},
                "segments": {},
                "revenueStructures": {},
                "summary": {},
            },
        }

        result = build_dataset.finalize_company_payload(company, payload, {})

        self.assertEqual(
            [(row["memberKey"], row["valueBn"]) for row in result["financials"]["2024Q3"]["officialRevenueSegments"]],
            [("cnbu", 3.018), ("mbu", 1.875)],
        )
        self.assertEqual(
            [(row["memberKey"], row["valueBn"]) for row in result["financials"]["2025Q2"]["officialRevenueSegments"]],
            [("cnbu", 5.069), ("mbu", 1.551)],
        )
        self.assertEqual(
            [(row["memberKey"], row["valueBn"]) for row in result["financials"]["2025Q3"]["officialRevenueSegments"]],
            [("cmbu", 4.543), ("cdbu", 1.577), ("mcbu", 3.76), ("aebu", 1.434)],
        )
        self.assertEqual(
            [(row["memberKey"], row["yoyPct"], row["qoqPct"]) for row in result["financials"]["2025Q3"]["officialRevenueSegments"]],
            [("cmbu", 213.53, 34.17), ("cdbu", -23.0, 3.07), ("mcbu", 24.54, 15.51), ("aebu", 16.59, 27.24)],
        )
        self.assertEqual(
            [(row["memberKey"], row["valueBn"]) for row in result["officialRevenueStructureHistory"]["quarters"]["2025Q3"]["segments"]],
            [("cmbu", 4.543), ("cdbu", 1.577), ("mcbu", 3.76), ("aebu", 1.434)],
        )

    def test_micron_mixed_rows_prefer_current_schema_from_internal_2025q3(self) -> None:
        rows = [
            {"name": "CNBU", "memberKey": "cnbu", "valueBn": 5.0},
            {"name": "All Other Segments", "memberKey": "allothersegments", "valueBn": 0.03},
            {"name": "CMBU", "memberKey": "cmbu", "valueBn": 4.5},
            {"name": "CDBU", "memberKey": "cdbu", "valueBn": 1.6},
            {"name": "MCBU", "memberKey": "mcbu", "valueBn": 3.8},
            {"name": "AEBU", "memberKey": "aebu", "valueBn": 1.4},
        ]

        filtered = build_dataset.normalize_official_revenue_segments("micron", "2025Q3", rows)

        self.assertEqual([row["memberKey"] for row in filtered], ["cmbu", "cdbu", "mcbu", "aebu"])

    def test_finalize_computes_yoy_for_recent_fy26_bu_quarters(self) -> None:
        company = {"id": "micron", "ticker": "MU"}
        payload = {
            "id": "micron",
            "ticker": "MU",
            "quarters": ["2024Q4", "2025Q1", "2025Q4", "2026Q1"],
            "financials": {
                "2024Q4": {
                    "calendarQuarter": "2024Q4",
                    "fiscalLabel": "FY2025 Q1",
                    "revenueBn": 8.709,
                    "officialRevenueSegments": [{"name": "CNBU", "memberKey": "cnbu", "valueBn": 4.395}],
                },
                "2025Q1": {
                    "calendarQuarter": "2025Q1",
                    "fiscalLabel": "FY2025 Q2",
                    "revenueBn": 8.053,
                    "officialRevenueSegments": [{"name": "CNBU", "memberKey": "cnbu", "valueBn": 4.564}],
                },
                "2025Q4": {
                    "calendarQuarter": "2025Q4",
                    "fiscalLabel": "FY2026 Q1",
                    "revenueBn": 13.643,
                    "officialRevenueSegments": [
                        {"name": "CMBU", "memberKey": "cmbu", "valueBn": 5.284},
                        {"name": "MCBU", "memberKey": "mcbu", "valueBn": 4.255},
                        {"name": "CDBU", "memberKey": "cdbu", "valueBn": 2.379},
                        {"name": "AEBU", "memberKey": "aebu", "valueBn": 1.72},
                    ],
                },
                "2026Q1": {
                    "calendarQuarter": "2026Q1",
                    "fiscalLabel": "FY2026 Q2",
                    "revenueBn": 23.86,
                    "officialRevenueSegments": [
                        {"name": "CMBU", "memberKey": "cmbu", "valueBn": 7.749},
                        {"name": "MCBU", "memberKey": "mcbu", "valueBn": 7.711},
                        {"name": "CDBU", "memberKey": "cdbu", "valueBn": 5.687},
                        {"name": "AEBU", "memberKey": "aebu", "valueBn": 2.708},
                    ],
                },
            },
            "parserDiagnostics": {
                "version": "universal-parser-v4",
                "financials": {},
                "segments": {},
                "revenueStructures": {},
                "summary": {},
            },
        }

        result = build_dataset.finalize_company_payload(company, payload, {})

        self.assertEqual(
            [(row["memberKey"], row["valueBn"]) for row in result["financials"]["2024Q4"]["officialRevenueSegments"]],
            [("cnbu", 4.395)],
        )
        self.assertEqual(
            [(row["memberKey"], row["valueBn"]) for row in result["financials"]["2025Q1"]["officialRevenueSegments"]],
            [("cnbu", 4.564)],
        )
        self.assertEqual(
            [(row["memberKey"], row["yoyPct"]) for row in result["financials"]["2025Q4"]["officialRevenueSegments"]],
            [("cmbu", 99.55), ("mcbu", 63.15), ("cdbu", 3.8), ("aebu", 48.53)],
        )
        self.assertEqual(
            [(row["memberKey"], row["yoyPct"]) for row in result["financials"]["2026Q1"]["officialRevenueSegments"]],
            [("cmbu", 162.95), ("mcbu", 244.86), ("cdbu", 210.77), ("aebu", 161.9)],
        )


if __name__ == "__main__":
    unittest.main()
