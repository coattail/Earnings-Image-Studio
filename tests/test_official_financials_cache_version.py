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

import official_financials  # noqa: E402


def _company() -> dict[str, object]:
    return {
        "id": "ibm",
        "ticker": "IBM",
        "nameZh": "IBM",
        "nameEn": "IBM",
        "slug": "ibm",
        "rank": 1,
        "isAdr": False,
        "brand": {},
    }


class OfficialFinancialsCacheVersionTests(unittest.TestCase):
    def test_current_version_cache_is_reused(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            cache_dir = Path(tmp_dir)
            cache_path = cache_dir / "ibm.json"
            cache_path.write_text(
                json.dumps(
                    {
                        "_cacheVersion": "test-current",
                        "financials": {"2025Q4": {"calendarQuarter": "2025Q4"}},
                    }
                ),
                encoding="utf-8",
            )

            with (
                patch.object(official_financials, "CACHE_DIR", cache_dir),
                patch.object(official_financials, "OFFICIAL_FINANCIALS_CACHE_VERSION", "test-current"),
                patch.object(official_financials, "_resolve_cik", side_effect=AssertionError("should not rebuild")),
            ):
                result = official_financials.fetch_official_financial_history(_company(), refresh=False)

        self.assertEqual(result["financials"]["2025Q4"]["calendarQuarter"], "2025Q4")

    def test_stale_cache_is_rebuilt_instead_of_trusted(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            cache_dir = Path(tmp_dir)
            cache_path = cache_dir / "ibm.json"
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
                patch.object(official_financials, "CACHE_DIR", cache_dir),
                patch.object(official_financials, "OFFICIAL_FINANCIALS_CACHE_VERSION", "test-current"),
                patch.object(official_financials, "_resolve_cik", return_value=None),
            ):
                result = official_financials.fetch_official_financial_history(_company(), refresh=False)

        self.assertEqual(result["_cacheVersion"], "test-current")
        self.assertEqual(result["financials"], {})
        self.assertIn("Unable to resolve SEC CIK.", result["errors"])
        self.assertEqual(
            result["errorDetails"],
            [
                {
                    "message": "Unable to resolve SEC CIK.",
                    "layer": "financials",
                    "sourceId": "official_financials",
                    "phase": "resolve-cik",
                    "severity": "error",
                }
            ],
        )

    def test_companyfacts_fetch_error_emits_structured_error_details(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            cache_dir = Path(tmp_dir)
            with (
                patch.object(official_financials, "CACHE_DIR", cache_dir),
                patch.object(official_financials, "_resolve_cik", return_value=123456),
                patch.object(official_financials, "_request_json", side_effect=RuntimeError("upstream timeout")),
            ):
                result = official_financials.fetch_official_financial_history(_company(), refresh=True)

        self.assertEqual(result["errors"], ["companyfacts: upstream timeout"])
        self.assertEqual(
            result["errorDetails"],
            [
                {
                    "message": "upstream timeout",
                    "layer": "financials",
                    "sourceId": "official_financials",
                    "phase": "companyfacts",
                    "severity": "error",
                    "errorType": "RuntimeError",
                    "url": "https://data.sec.gov/api/xbrl/companyfacts/CIK0000123456.json",
                }
            ],
        )

    def test_tsmc_companyfacts_error_falls_back_to_html_filings(self) -> None:
        tsmc = {
            "id": "tsmc",
            "ticker": "TSM",
            "nameZh": "台积电",
            "nameEn": "TSMC",
            "slug": "tsm",
            "rank": 6,
            "isAdr": True,
            "brand": {},
        }
        fallback_financials = {
            "2026Q1": {
                "calendarQuarter": "2026Q1",
                "revenueBn": 25.53,
                "statementSourceUrl": "https://example.com/tsmc-q1-2026",
                "statementFilingDate": "2026-04-16",
            }
        }

        with tempfile.TemporaryDirectory() as tmp_dir:
            cache_dir = Path(tmp_dir)
            with (
                patch.object(official_financials, "CACHE_DIR", cache_dir),
                patch.object(official_financials, "_resolve_cik", return_value=1046179),
                patch.object(official_financials, "_request_json", side_effect=RuntimeError("companyfacts timeout")),
                patch.object(official_financials, "_load_html_fallback_financials", return_value=fallback_financials),
            ):
                result = official_financials.fetch_official_financial_history(tsmc, refresh=True)

        self.assertEqual(result["quarters"], ["2026Q1"])
        self.assertEqual(result["financials"]["2026Q1"]["calendarQuarter"], "2026Q1")
        self.assertEqual(result["statementSource"], "official-sec-filings-fallback")
        self.assertEqual(result["statementSourceUrl"], "https://example.com/tsmc-q1-2026")
        self.assertEqual(result["reportingCurrency"], "TWD")
        self.assertIn("companyfacts: companyfacts timeout", result["errors"])


if __name__ == "__main__":
    unittest.main()
