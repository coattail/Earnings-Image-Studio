import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from bs4 import BeautifulSoup


ROOT_DIR = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = ROOT_DIR / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

import stockanalysis_financials  # noqa: E402


def _company() -> dict[str, object]:
    return {
        "id": "ibm",
        "ticker": "IBM",
        "slug": "ibm",
        "nameEn": "IBM",
        "nameZh": "IBM",
        "rank": 1,
        "isAdr": False,
        "brand": {},
    }


def _single_quarter_table():
    html = """
    <table>
      <tr><th>Fiscal Quarter</th><th>Q1 2026</th></tr>
      <tr><th>Period Ending</th><td>Mar 31, 2026</td></tr>
      <tr><th>Revenue</th><td>123,000</td></tr>
      <tr><th>Net Income</th><td>12,300</td></tr>
    </table>
    """
    return BeautifulSoup(html, "html.parser").find("table")


class StockAnalysisFinancialContractsTests(unittest.TestCase):
    def test_load_table_prefers_financial_table_over_first_table(self) -> None:
        html = """
        <html>
          <body>
            <table>
              <tr><th>Summary</th><th>Value</th></tr>
              <tr><td>Market Cap</td><td>100</td></tr>
            </table>
            <table>
              <tr><th>Fiscal Quarter</th><th>Q1 2026</th></tr>
              <tr><th>Period Ending</th><td>Mar 31, 2026</td></tr>
              <tr><th>Revenue</th><td>123,000</td></tr>
            </table>
          </body>
        </html>
        """

        with patch.object(stockanalysis_financials, "_request_text", return_value=html):
            _html_text, table = stockanalysis_financials._load_table("https://example.com")

        row_map_value = stockanalysis_financials._row_map(table)
        self.assertIn("Fiscal Quarter", row_map_value)
        self.assertEqual(row_map_value["Revenue"][0], "123,000")

    def test_stale_cache_is_rebuilt_and_current_cache_is_reused(self) -> None:
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
                patch.object(stockanalysis_financials, "CACHE_DIR", cache_dir),
                patch.object(stockanalysis_financials, "STOCKANALYSIS_CACHE_VERSION", "test-current"),
                patch.object(stockanalysis_financials, "_load_table", return_value=("Financials in millions USD", _single_quarter_table())),
            ):
                rebuilt = stockanalysis_financials.fetch_stockanalysis_financial_history(_company(), refresh=False)

            cache_path.write_text(json.dumps(rebuilt), encoding="utf-8")

            with (
                patch.object(stockanalysis_financials, "CACHE_DIR", cache_dir),
                patch.object(stockanalysis_financials, "STOCKANALYSIS_CACHE_VERSION", "test-current"),
                patch.object(stockanalysis_financials, "_load_table", side_effect=AssertionError("should not rebuild")),
            ):
                reused = stockanalysis_financials.fetch_stockanalysis_financial_history(_company(), refresh=False)

        self.assertEqual(rebuilt["_cacheVersion"], "test-current")
        self.assertEqual(rebuilt["financials"]["2026Q1"]["revenueBn"], 123.0)
        self.assertEqual(reused["financials"]["2026Q1"]["revenueBn"], 123.0)


if __name__ == "__main__":
    unittest.main()
