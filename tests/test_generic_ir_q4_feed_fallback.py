import json
import sys
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch


ROOT_DIR = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = ROOT_DIR / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from generic_ir_pdf_parser import (  # noqa: E402
    _extract_q4_widget_feed_pdf_links,
    _trim_recent_contiguous_financials,
    fetch_generic_ir_pdf_history,
)


class Q4WidgetFeedFallbackTests(unittest.TestCase):
    def test_extract_q4_widget_feed_pdf_links_reads_public_financial_feed(self) -> None:
        html = """
        <script type="text/javascript">
        var Q4ApiKey = 'TESTKEY123';
        function GetLanguageId(){ return '1'; }
        $('.module-financial-quarter .module_container--content').financials({
            usePublic: GetViewType() != "0",
            apiKey: Q4ApiKey,
            reportTypes: ["First Quarter", "Second Quarter", "Third Quarter", "Fourth Quarter"],
            showAllYears: true
        });
        </script>
        """
        feed_payload = {
            "GetFinancialReportListResult": [
                {
                    "Documents": [
                        {
                            "DocumentPath": "https://cdn.example.com/files/FY26-Q1-Earnings-Release.pdf",
                            "DocumentFileType": "PDF",
                            "DocumentTitle": "Earnings Release",
                            "DocumentCategory": "news",
                        },
                        {
                            "DocumentPath": "https://cdn.example.com/files/FY26-Q1-Slides.pdf",
                            "DocumentFileType": "PDF",
                            "DocumentTitle": "Slides",
                            "DocumentCategory": "presentation",
                        },
                    ]
                }
            ]
        }

        with patch("generic_ir_pdf_parser._quick_fetch_json", return_value=feed_payload) as quick_fetch_json:
            links = _extract_q4_widget_feed_pdf_links(
                "https://investors.example.com/financial-information/quarterly-results/default.aspx",
                html,
            )

        self.assertEqual(links, ["https://cdn.example.com/files/FY26-Q1-Earnings-Release.pdf"])
        quick_fetch_json.assert_called_once()

    def test_fetch_generic_ir_pdf_history_rebuilds_stale_cache_without_version(self) -> None:
        company = {"id": "fedex-ir-only", "ticker": "", "website": "https://investors.fedex.com"}
        with TemporaryDirectory() as temp_dir:
            cache_path = Path(temp_dir) / "fedex-ir-only.json"
            cache_path.write_text(
                json.dumps(
                    {
                        "id": "fedex-ir-only",
                        "ticker": "",
                        "quarters": [],
                        "financials": {},
                        "statementSource": "generic-ir-pdf",
                        "statementSourceUrl": None,
                        "errors": ["stale"],
                        "filingsUsed": [],
                    }
                ),
                encoding="utf-8",
            )

            with (
                patch("generic_ir_pdf_parser._cache_path", return_value=cache_path),
                patch("generic_ir_pdf_parser._resolve_cik", return_value=None),
                patch("generic_ir_pdf_parser._official_ir_pdf_candidates", return_value=["https://cdn.example.com/fedex-q4.pdf"]),
                patch("generic_ir_pdf_parser._extract_pdf_page_texts", return_value=["stub page"]),
                patch("generic_ir_pdf_parser._period_entries_from_pdf_pages", return_value=[{"calendarQuarter": "2024Q4"}]),
                patch("generic_ir_pdf_parser.finalize_period_entries", return_value={"2024Q4": {"calendarQuarter": "2024Q4"}}),
            ):
                result = fetch_generic_ir_pdf_history(company, refresh=False)

        self.assertEqual(result["quarters"], ["2024Q4"])

    def test_trim_recent_contiguous_financials_drops_sparse_older_outliers(self) -> None:
        financials = {
            "2018Q1": {"calendarQuarter": "2018Q1"},
            "2018Q2": {"calendarQuarter": "2018Q2"},
            "2019Q4": {"calendarQuarter": "2019Q4"},
            "2020Q1": {"calendarQuarter": "2020Q1"},
            "2020Q2": {"calendarQuarter": "2020Q2"},
            "2020Q4": {"calendarQuarter": "2020Q4"},
            "2021Q1": {"calendarQuarter": "2021Q1"},
            "2021Q2": {"calendarQuarter": "2021Q2"},
            "2021Q3": {"calendarQuarter": "2021Q3"},
        }

        trimmed = _trim_recent_contiguous_financials(financials)

        self.assertEqual(list(trimmed.keys()), ["2020Q4", "2021Q1", "2021Q2", "2021Q3"])


if __name__ == "__main__":
    unittest.main()
