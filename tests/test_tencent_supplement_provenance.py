import sys
import unittest
from pathlib import Path
from unittest.mock import patch


ROOT_DIR = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = ROOT_DIR / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

import build_dataset  # noqa: E402


class TencentSupplementProvenanceTests(unittest.TestCase):
    def test_supplement_updates_statement_provenance_and_meta(self) -> None:
        payload = {
            "id": "tencent",
            "financials": {
                "2025Q4": {
                    "calendarQuarter": "2025Q4",
                    "revenueBn": 10.0,
                    "operatingIncomeBn": 1.0,
                    "netIncomeBn": 0.8,
                    "statementSource": "stockanalysis",
                    "statementSourceUrl": "https://old.example.com/financials",
                    "statementFilingDate": "2025-11-10",
                    "officialRevenueSegments": [
                        {
                            "name": "Games",
                            "valueBn": 5.0,
                            "sourceUrl": "https://example.com/tencent-q4.pdf",
                            "filingDate": "2025-11-15",
                        }
                    ],
                    "fieldSources": {
                        "revenueBn": {"adapterId": "stockanalysis_financials", "score": 95},
                        "officialRevenueSegments": {"adapterId": "official_segments", "score": 100},
                    },
                    "statementMeta": {
                        "statementSource": "stockanalysis",
                        "statementSourceUrl": "https://old.example.com/financials",
                    },
                    "extractionDiagnostics": {
                        "statementSource": "stockanalysis",
                        "qualityScore": 70,
                    },
                }
            },
            "parserDiagnostics": {
                "financials": {
                    "attempts": [],
                }
            },
        }
        parsed_entry = {
            "calendarQuarter": "2025Q4",
            "revenueBn": 12.3,
            "operatingIncomeBn": 2.1,
            "netIncomeBn": 1.7,
            "statementSource": "tencent-ir-pdf",
            "statementSourceUrl": "https://example.com/tencent-q4.pdf",
            "statementFilingDate": "2025-11-15",
        }

        with patch.object(build_dataset, "_parse_tencent_pdf_financial_entry", return_value=parsed_entry):
            result = build_dataset.supplement_tencent_official_financials(payload)

        quarter = result["financials"]["2025Q4"]
        self.assertEqual(quarter["revenueBn"], 12.3)
        self.assertEqual(quarter["operatingIncomeBn"], 2.1)
        self.assertEqual(quarter["netIncomeBn"], 1.7)
        self.assertEqual(quarter["officialRevenueSegments"][0]["sourceUrl"], "https://example.com/tencent-q4.pdf")
        self.assertEqual(quarter["fieldSources"]["revenueBn"]["adapterId"], "tencent_ir_pdf_supplement")
        self.assertEqual(quarter["fieldSources"]["revenueBn"]["sourceUrl"], "https://example.com/tencent-q4.pdf")
        self.assertEqual(quarter["fieldSources"]["officialRevenueSegments"]["adapterId"], "official_segments")
        self.assertEqual(quarter["statementMeta"]["statementSource"], "tencent-ir-pdf")
        self.assertEqual(quarter["statementMeta"]["statementSourceUrl"], "https://example.com/tencent-q4.pdf")
        self.assertEqual(quarter["statementMeta"]["statementValueMode"], "reported")
        self.assertEqual(quarter["extractionDiagnostics"]["statementSource"], "tencent-ir-pdf")
        self.assertEqual(quarter["extractionDiagnostics"]["statementValueMode"], "reported")
        self.assertEqual(quarter["extractionDiagnostics"]["qualityScore"], 70)


if __name__ == "__main__":
    unittest.main()
