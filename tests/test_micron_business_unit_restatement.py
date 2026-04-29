import sys
import unittest
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = ROOT_DIR / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

import build_dataset  # noqa: E402


class MicronBusinessUnitRestatementTests(unittest.TestCase):
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
                    "officialRevenueSegments": [{"name": "CNBU", "memberKey": "cnbu", "valueBn": 3.018}],
                },
                "2025Q2": {
                    "calendarQuarter": "2025Q2",
                    "fiscalLabel": "FY2025 Q3",
                    "revenueBn": 9.301,
                    "officialRevenueSegments": [{"name": "CNBU", "memberKey": "cnbu", "valueBn": 5.069}],
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
            [(row["memberKey"], row["valueBn"]) for row in result["financials"]["2025Q3"]["officialRevenueSegments"]],
            [("cmbu", 4.543), ("cdbu", 1.577), ("mcbu", 3.76), ("aebu", 1.434)],
        )
        self.assertEqual(
            [(row["memberKey"], row["valueBn"]) for row in result["financials"]["2025Q2"]["officialRevenueSegments"]],
            [("cmbu", 3.386), ("cdbu", 1.53), ("mcbu", 3.255), ("aebu", 1.127)],
        )
        self.assertEqual(
            [(row["memberKey"], row["valueBn"]) for row in result["financials"]["2024Q3"]["officialRevenueSegments"]],
            [("cmbu", 1.449), ("cdbu", 2.048), ("mcbu", 3.019), ("aebu", 1.23)],
        )
        self.assertEqual(
            [(row["memberKey"], row["valueBn"]) for row in result["officialRevenueStructureHistory"]["quarters"]["2025Q3"]["segments"]],
            [("cmbu", 4.543), ("cdbu", 1.577), ("mcbu", 3.76), ("aebu", 1.434)],
        )

    def test_micron_mixed_rows_prefer_current_schema_from_internal_2025q3(self) -> None:
        rows = [
            {"name": "CNBU", "memberKey": "cnbu", "valueBn": 5.0},
            {"name": "CMBU", "memberKey": "cmbu", "valueBn": 4.5},
            {"name": "CDBU", "memberKey": "cdbu", "valueBn": 1.6},
            {"name": "MCBU", "memberKey": "mcbu", "valueBn": 3.8},
            {"name": "AEBU", "memberKey": "aebu", "valueBn": 1.4},
        ]

        filtered = build_dataset.filter_micron_mixed_segment_rows("2025Q3", rows)

        self.assertEqual([row["memberKey"] for row in filtered], ["cmbu", "cdbu", "mcbu", "aebu"])


if __name__ == "__main__":
    unittest.main()
