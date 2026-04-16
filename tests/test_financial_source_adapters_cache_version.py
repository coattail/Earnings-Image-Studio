import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


ROOT_DIR = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = ROOT_DIR / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

import financial_source_adapters  # noqa: E402


def _company() -> dict[str, object]:
    return {
        "id": "tencent",
        "ticker": "TCEHY",
        "nameZh": "腾讯控股",
        "nameEn": "Tencent",
        "slug": "tcehy",
        "rank": 1,
        "isAdr": True,
        "brand": {},
    }


def _revenue_structure_history() -> dict[str, object]:
    return {
        "quarters": {
            "2025Q4": {
                "segments": [
                    {
                        "name": "Games",
                        "valueBn": 10.0,
                        "sourceUrl": "https://example.com/tencent-q4.pdf",
                        "filingDate": "2025-11-15",
                    }
                ]
            }
        }
    }


class FinancialSourceAdaptersCacheVersionTests(unittest.TestCase):
    def test_tencent_ir_pdf_stale_cache_is_rebuilt_and_current_cache_is_reused(self) -> None:
        parsed_entry = {
            "calendarQuarter": "2025Q4",
            "revenueBn": 12.3,
            "operatingIncomeBn": 2.1,
            "netIncomeBn": 1.7,
            "statementSource": "tencent-ir-pdf",
            "statementSourceUrl": "https://example.com/tencent-q4.pdf",
            "statementFilingDate": "2025-11-15",
        }

        with tempfile.TemporaryDirectory() as tmp_dir:
            cache_dir = Path(tmp_dir)
            cache_path = cache_dir / "tencent-ir-pdf-tencent.json"
            cache_path.write_text(
                json.dumps(
                    {
                        "_cacheVersion": "legacy",
                        "financials": {"2025Q4": {"calendarQuarter": "2025Q4", "revenueBn": 99}},
                    }
                ),
                encoding="utf-8",
            )

            with (
                patch.object(financial_source_adapters, "CACHE_DIR", cache_dir),
                patch.object(financial_source_adapters, "FINANCIAL_SOURCE_ADAPTERS_CACHE_VERSION", "test-current"),
                patch.object(financial_source_adapters, "_parse_tencent_pdf_financial_entry", return_value=parsed_entry),
            ):
                rebuilt = financial_source_adapters.fetch_tencent_ir_pdf_financial_history(
                    _company(),
                    _revenue_structure_history(),
                    refresh=False,
                )

            cache_path.write_text(json.dumps(rebuilt), encoding="utf-8")

            with (
                patch.object(financial_source_adapters, "CACHE_DIR", cache_dir),
                patch.object(financial_source_adapters, "FINANCIAL_SOURCE_ADAPTERS_CACHE_VERSION", "test-current"),
                patch.object(financial_source_adapters, "_parse_tencent_pdf_financial_entry", side_effect=AssertionError("should not rebuild")),
            ):
                reused = financial_source_adapters.fetch_tencent_ir_pdf_financial_history(
                    _company(),
                    _revenue_structure_history(),
                    refresh=False,
                )

        self.assertEqual(rebuilt["_cacheVersion"], "test-current")
        self.assertEqual(rebuilt["financials"]["2025Q4"]["revenueBn"], 12.3)
        self.assertEqual(reused["financials"]["2025Q4"]["revenueBn"], 12.3)


if __name__ == "__main__":
    unittest.main()
