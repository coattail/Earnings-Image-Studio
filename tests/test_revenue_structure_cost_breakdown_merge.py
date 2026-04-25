import sys
import unittest
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = ROOT_DIR / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

import build_dataset  # noqa: E402


class RevenueStructureCostBreakdownMergeTests(unittest.TestCase):
    def test_revenue_structure_history_merges_cost_breakdown_into_entry(self) -> None:
        company = {"id": "tesla", "ticker": "TSLA"}
        company_payload = {
            "id": "tesla",
            "quarters": ["2025Q4"],
            "financials": {
                "2025Q4": {
                    "calendarQuarter": "2025Q4",
                    "revenueBn": 24.901,
                    "costOfRevenueBn": 19.892,
                }
            },
        }
        history = {
            "source": "official-filings-xbrl-hierarchy",
            "quarters": {
                "2025Q4": {
                    "segments": [
                        {"name": "Auto", "memberKey": "auto", "valueBn": 17.693},
                    ],
                    "costBreakdown": [
                        {
                            "name": "Auto",
                            "nameZh": "汽车业务",
                            "memberKey": "auto",
                            "valueBn": 14.08,
                            "sourceUrl": "https://example.com/tsla.xml",
                            "sourceForm": "10-K",
                            "filingDate": "2026-01-29",
                        }
                    ],
                }
            },
            "filingsUsed": [],
            "errors": [],
        }

        result = build_dataset.apply_revenue_structure_history(company_payload, company, history)
        entry = result["financials"]["2025Q4"]

        self.assertEqual(entry["officialCostBreakdown"][0]["name"], "Auto")
        self.assertEqual(entry["officialCostBreakdown"][0]["memberKey"], "auto")
        self.assertEqual(entry["officialCostBreakdown"][0]["valueBn"], 14.08)


if __name__ == "__main__":
    unittest.main()
