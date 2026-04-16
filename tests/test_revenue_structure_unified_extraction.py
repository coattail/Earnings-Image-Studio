import sys
import unittest
from pathlib import Path
from unittest.mock import patch


ROOT_DIR = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = ROOT_DIR / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

import extraction_engine  # noqa: E402
from source_adapters.base import AdapterResult  # noqa: E402


class RevenueStructureUnifiedExtractionTests(unittest.TestCase):
    def test_build_unified_extraction_carries_synthesized_statement_and_breakdowns(self) -> None:
        adapter = AdapterResult(
            adapter_id="official_revenue_structures",
            kind="revenue_structure",
            label="Official filing revenue structure",
            priority=106,
            field_priorities={
                "officialRevenueSegments": 114,
                "officialRevenueDetailGroups": 112,
                "revenueBn": 110,
                "statementMeta": 108,
                "officialCostBreakdown": 107,
                "officialOpexBreakdown": 107,
                "officialRevenueStyle": 106,
                "displayCurrency": 106,
                "displayScaleFactor": 106,
            },
            payload={
                "quarters": {
                    "2025Q4": {
                        "segments": [
                            {
                                "name": "North America",
                                "memberKey": "na",
                                "valueBn": 8.0,
                                "sourceUrl": "https://example.com/revenue-structure",
                                "sourceForm": "10-Q",
                                "filingDate": "2025-11-01",
                            },
                            {
                                "name": "International",
                                "memberKey": "intl",
                                "valueBn": 4.3,
                                "sourceUrl": "https://example.com/revenue-structure",
                                "sourceForm": "10-Q",
                                "filingDate": "2025-11-01",
                            },
                        ],
                        "detailGroups": [
                            {
                                "name": "Cloud",
                                "memberKey": "cloud",
                                "targetName": "North America",
                                "valueBn": 3.0,
                                "sourceUrl": "https://example.com/revenue-structure",
                                "sourceForm": "10-Q",
                                "filingDate": "2025-11-01",
                            }
                        ],
                        "opexBreakdown": [
                            {
                                "name": "R&D",
                                "memberKey": "rnd",
                                "valueBn": 1.2,
                                "sourceUrl": "https://example.com/revenue-structure",
                            }
                        ],
                        "costBreakdown": [
                            {
                                "name": "Infrastructure",
                                "valueBn": 5.2,
                                "sourceUrl": "https://example.com/revenue-structure",
                            }
                        ],
                        "style": "stacked",
                        "displayCurrency": "USD",
                        "displayScaleFactor": 1,
                    }
                },
                "errors": [],
            },
        )
        base_payload = {
            "financials": {
                "2025Q4": {
                    "calendarQuarter": "2025Q4",
                    "revenueBn": 12.3,
                    "costOfRevenueBn": 5.2,
                    "operatingExpensesBn": 1.2,
                    "statementSource": "official-revenue-structure",
                    "statementSourceUrl": "https://example.com/revenue-structure",
                    "statementFilingDate": "2025-11-01",
                    "statementValueMode": "reported",
                }
            }
        }

        with patch.object(extraction_engine, "_adapter_results", return_value=[adapter]):
            extraction = extraction_engine.build_unified_extraction(
                {"id": "acme", "ticker": "ACME"},
                base_payload=base_payload,
            )

        quarter = extraction["quarters"]["2025Q4"]
        provenance = extraction["provenance"]["2025Q4"]
        diagnostics = extraction["diagnostics"]["2025Q4"]

        self.assertEqual(quarter["revenueBn"], 12.3)
        self.assertEqual(quarter["statementMeta"]["statementSource"], "official-revenue-structure")
        self.assertEqual(quarter["statementMeta"]["statementSourceUrl"], "https://example.com/revenue-structure")
        self.assertEqual(quarter["costBreakdown"][0]["name"], "Infrastructure")
        self.assertEqual(quarter["opexBreakdown"][0]["name"], "R&D")
        self.assertEqual(provenance["revenueBn"]["sourceUrl"], "https://example.com/revenue-structure")
        self.assertEqual(provenance["officialRevenueSegments"]["sourceUrl"], "https://example.com/revenue-structure")
        self.assertEqual(provenance["officialRevenueDetailGroups"]["sourceUrl"], "https://example.com/revenue-structure")
        self.assertEqual(provenance["displayCurrency"]["sourceUrl"], "https://example.com/revenue-structure")
        self.assertNotIn("missing-required:revenueBn,operatingIncomeBn,netIncomeBn", diagnostics["issues"])
        self.assertIn("missing-required:operatingIncomeBn,netIncomeBn", diagnostics["issues"])
        self.assertEqual(diagnostics["costBreakdownMode"], "explicit")
        self.assertEqual(diagnostics["opexBreakdownMode"], "explicit")


if __name__ == "__main__":
    unittest.main()
