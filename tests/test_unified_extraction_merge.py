import sys
import unittest
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = ROOT_DIR / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

import extraction_engine  # noqa: E402


class UnifiedExtractionMergeTests(unittest.TestCase):
    def test_merge_unified_extraction_preserves_adapter_only_quarter(self) -> None:
        payload = {
            "financials": {
                "2025Q4": {
                    "calendarQuarter": "2025Q4",
                    "revenueBn": 12.3,
                }
            }
        }
        extraction = {
            "engineVersion": "test-engine",
            "sources": [{"adapterId": "generic_ir_pdf"}],
            "quarters": {
                "2026Q1": {
                    "revenueBn": 13.1,
                    "netIncomeBn": 1.9,
                    "statementMeta": {"statementSource": "generic_ir_pdf"},
                }
            },
            "provenance": {
                "2026Q1": {
                    "revenueBn": {"adapterId": "generic_ir_pdf", "score": 42},
                }
            },
            "diagnostics": {
                "2026Q1": {
                    "statementFieldCount": 2,
                }
            },
        }

        merged = extraction_engine.merge_unified_extraction(payload, extraction)

        self.assertEqual(merged["quarters"], ["2025Q4", "2026Q1"])
        self.assertEqual(merged["financials"]["2026Q1"]["calendarQuarter"], "2026Q1")
        self.assertEqual(merged["financials"]["2026Q1"]["revenueBn"], 13.1)
        self.assertEqual(merged["financials"]["2026Q1"]["netIncomeBn"], 1.9)
        self.assertEqual(
            merged["financials"]["2026Q1"]["fieldSources"]["revenueBn"]["adapterId"],
            "generic_ir_pdf",
        )
        self.assertEqual(
            merged["financials"]["2026Q1"]["extractionDiagnostics"]["statementFieldCount"],
            2,
        )

    def test_merge_unified_extraction_preserves_existing_sources_and_diagnostics(self) -> None:
        payload = {
            "financials": {
                "2025Q4": {
                    "calendarQuarter": "2025Q4",
                    "revenueBn": 12.3,
                    "fieldSources": {
                        "revenueBn": {"adapterId": "manual_override", "score": 99},
                    },
                    "extractionDiagnostics": {
                        "legacyIssue": "kept",
                    },
                }
            }
        }
        extraction = {
            "engineVersion": "test-engine",
            "sources": [{"adapterId": "generic_ir_pdf"}],
            "quarters": {
                "2025Q4": {
                    "operatingIncomeBn": 2.4,
                }
            },
            "provenance": {
                "2025Q4": {
                    "operatingIncomeBn": {"adapterId": "generic_ir_pdf", "score": 42},
                }
            },
            "diagnostics": {
                "2025Q4": {
                    "qualityScore": 88,
                }
            },
        }

        merged = extraction_engine.merge_unified_extraction(payload, extraction)

        self.assertEqual(
            merged["financials"]["2025Q4"]["fieldSources"]["revenueBn"]["adapterId"],
            "manual_override",
        )
        self.assertEqual(
            merged["financials"]["2025Q4"]["fieldSources"]["operatingIncomeBn"]["adapterId"],
            "generic_ir_pdf",
        )
        self.assertEqual(
            merged["financials"]["2025Q4"]["extractionDiagnostics"]["legacyIssue"],
            "kept",
        )
        self.assertEqual(
            merged["financials"]["2025Q4"]["extractionDiagnostics"]["qualityScore"],
            88,
        )

    def test_merge_unified_extraction_skips_provenance_when_no_value_was_applied(self) -> None:
        payload = {
            "financials": {
                "2025Q4": {
                    "calendarQuarter": "2025Q4",
                    "revenueBn": 12.3,
                }
            }
        }
        extraction = {
            "engineVersion": "test-engine",
            "sources": [{"adapterId": "generic_ir_pdf"}],
            "quarters": {
                "2025Q4": {
                    "revenueBn": 13.1,
                }
            },
            "provenance": {
                "2025Q4": {
                    "revenueBn": {"adapterId": "generic_ir_pdf", "score": 42},
                }
            },
            "diagnostics": {
                "2025Q4": {
                    "qualityScore": 77,
                    "statementFieldCount": 1,
                }
            },
        }

        merged = extraction_engine.merge_unified_extraction(payload, extraction)

        self.assertEqual(merged["financials"]["2025Q4"]["revenueBn"], 12.3)
        self.assertNotIn("fieldSources", merged["financials"]["2025Q4"])
        self.assertNotIn("extractionDiagnostics", merged["financials"]["2025Q4"])


if __name__ == "__main__":
    unittest.main()
