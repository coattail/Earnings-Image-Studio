import sys
import unittest
from pathlib import Path
from unittest.mock import patch


ROOT_DIR = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = ROOT_DIR / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

import extraction_engine  # noqa: E402
from source_adapters import AdapterResult  # noqa: E402


class UnifiedExtractionSourceErrorsTests(unittest.TestCase):
    def test_build_unified_extraction_keeps_adapter_error_details(self) -> None:
        adapter = AdapterResult(
            adapter_id="official_financials",
            kind="statement",
            label="SEC companyfacts / filings",
            priority=110,
            payload={"financials": {}},
            errors=["2025Q4: filing missing instance", "2026Q1: companyfacts timeout"],
            error_details=[
                {
                    "message": "filing missing instance",
                    "sourceId": "official_financials",
                    "phase": "filing-fetch",
                    "severity": "error",
                },
                {
                    "message": "companyfacts timeout",
                    "sourceId": "official_financials",
                    "phase": "companyfacts",
                    "severity": "error",
                },
            ],
        )

        with patch.object(extraction_engine, "_adapter_results", return_value=[adapter]):
            result = extraction_engine.build_unified_extraction({"id": "demo"})

        self.assertEqual(len(result["sources"]), 1)
        self.assertEqual(result["sources"][0]["errorCount"], 2)
        self.assertEqual(
            result["sources"][0]["errors"],
            ["2025Q4: filing missing instance", "2026Q1: companyfacts timeout"],
        )
        self.assertEqual(
            result["sources"][0]["errorDetails"],
            [
                {
                    "message": "filing missing instance",
                    "sourceId": "official_financials",
                    "phase": "filing-fetch",
                    "severity": "error",
                },
                {
                    "message": "companyfacts timeout",
                    "sourceId": "official_financials",
                    "phase": "companyfacts",
                    "severity": "error",
                },
            ],
        )

    def test_merge_unified_extraction_preserves_source_error_details(self) -> None:
        payload = {"financials": {}}
        extraction = {
            "engineVersion": "test-engine",
            "sources": [
                {
                    "adapterId": "official_financials",
                    "kind": "statement",
                    "label": "SEC companyfacts / filings",
                    "enabled": True,
                    "priority": 110,
                    "errorCount": 1,
                    "errors": ["2025Q4: filing missing instance"],
                    "errorDetails": [
                        {
                            "message": "filing missing instance",
                            "sourceId": "official_financials",
                            "phase": "filing-fetch",
                            "severity": "error",
                        }
                    ],
                }
            ],
            "quarters": {},
            "provenance": {},
            "diagnostics": {},
        }

        merged = extraction_engine.merge_unified_extraction(payload, extraction)

        self.assertEqual(
            merged["unifiedExtraction"]["sources"][0]["errors"],
            ["2025Q4: filing missing instance"],
        )
        self.assertEqual(
            merged["unifiedExtraction"]["sources"][0]["errorDetails"],
            [
                {
                    "message": "filing missing instance",
                    "sourceId": "official_financials",
                    "phase": "filing-fetch",
                    "severity": "error",
                }
            ],
        )


if __name__ == "__main__":
    unittest.main()
