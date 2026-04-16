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

import generic_filing_table_parser  # noqa: E402


def _company() -> dict[str, object]:
    return {
        "id": "ibm",
        "ticker": "IBM",
    }


class GenericFilingTableCacheVersionTests(unittest.TestCase):
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
                patch.object(generic_filing_table_parser, "CACHE_DIR", cache_dir),
                patch.object(generic_filing_table_parser, "GENERIC_FILING_TABLE_CACHE_VERSION", "test-current"),
                patch.object(generic_filing_table_parser, "_resolve_cik", side_effect=AssertionError("should not rebuild")),
            ):
                result = generic_filing_table_parser.fetch_generic_filing_table_history(_company(), refresh=False)

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
                patch.object(generic_filing_table_parser, "CACHE_DIR", cache_dir),
                patch.object(generic_filing_table_parser, "GENERIC_FILING_TABLE_CACHE_VERSION", "test-current"),
                patch.object(generic_filing_table_parser, "_resolve_cik", return_value=None),
            ):
                result = generic_filing_table_parser.fetch_generic_filing_table_history(_company(), refresh=False)

        self.assertEqual(result["_cacheVersion"], "test-current")
        self.assertEqual(result["financials"], {})
        self.assertIn("Unable to resolve SEC CIK.", result["errors"])


if __name__ == "__main__":
    unittest.main()
