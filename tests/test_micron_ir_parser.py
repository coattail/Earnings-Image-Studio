import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


ROOT_DIR = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = ROOT_DIR / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

import micron_ir  # noqa: E402
import official_financials  # noqa: E402
import official_revenue_structures  # noqa: E402
import official_segments  # noqa: E402


QUARTERLY_RESULTS_HTML = """
<html><body>
  <a href="/news-releases/news-release-details/micron-technology-inc-reports-record-results-third-quarter">View Press Release</a>
  <a href="/news-releases/news-release-details/micron-technology-inc-reports-results-second-quarter-fiscal-2026">View Press Release</a>
</body></html>
"""


RELEASE_HTML = """
<html><head>
  <meta property="og:title" content="Micron Technology, Inc. Reports Record Results for the Third Quarter of Fiscal 2026 | Micron Technology" />
</head><body>
<table>
  <tr><td>Quarterly Financial Results</td><td>GAAP</td><td>Non-GAAP</td></tr>
  <tr><td>(in millions, except per share amounts)</td><td>FQ3-26</td><td>FQ2-26</td><td>FQ3-25</td><td>FQ3-26</td><td>FQ2-26</td><td>FQ3-25</td></tr>
  <tr><td>Revenue</td><td>$</td><td>41,456</td><td>$</td><td>23,860</td><td>$</td><td>9,301</td><td>$</td><td>41,456</td></tr>
  <tr><td>Gross margin</td><td>35,056</td><td>17,755</td><td>3,508</td><td>35,199</td></tr>
  <tr><td>Operating expenses</td><td>1,738</td><td>1,620</td><td>1,339</td><td>1,518</td></tr>
  <tr><td>Operating income</td><td>33,318</td><td>16,135</td><td>2,169</td><td>33,681</td></tr>
  <tr><td>Net income</td><td>28,243</td><td>13,785</td><td>1,885</td><td>28,857</td></tr>
  <tr><td>Diluted earnings per share (EPS)</td><td>24.67</td><td>12.07</td><td>1.68</td><td>25.11</td></tr>
</table>
<table>
  <tr><td>Quarterly Business Unit Financial Results</td><td>FQ3-26</td><td>FQ2-26</td><td>FQ3-25</td></tr>
  <tr><td>Cloud Memory Business Unit</td></tr>
  <tr><td>Revenue</td><td>$</td><td>13,769</td><td>$</td><td>7,749</td><td>$</td><td>3,386</td></tr>
  <tr><td>Gross margin</td><td>83</td><td>%</td><td>74</td><td>%</td><td>58</td><td>%</td></tr>
  <tr><td>Core Data Center Business Unit</td></tr>
  <tr><td>Revenue</td><td>$</td><td>11,524</td><td>$</td><td>5,687</td><td>$</td><td>1,530</td></tr>
  <tr><td>Gross margin</td><td>87</td><td>%</td><td>74</td><td>%</td><td>38</td><td>%</td></tr>
  <tr><td>Mobile and Client Business Unit</td></tr>
  <tr><td>Revenue</td><td>$</td><td>11,521</td><td>$</td><td>7,711</td><td>$</td><td>3,255</td></tr>
  <tr><td>Gross margin</td><td>87</td><td>%</td><td>79</td><td>%</td><td>24</td><td>%</td></tr>
  <tr><td>Automotive and Embedded Business Unit</td></tr>
  <tr><td>Revenue</td><td>$</td><td>4,634</td><td>$</td><td>2,708</td><td>$</td><td>1,127</td></tr>
  <tr><td>Gross margin</td><td>79</td><td>%</td><td>68</td><td>%</td><td>26</td><td>%</td></tr>
</table>
<table>
  <tr><td>MICRON TECHNOLOGY, INC.</td><td>CONSOLIDATED STATEMENTS OF OPERATIONS</td></tr>
  <tr><td>3rd Qtr.</td><td>2nd Qtr.</td><td>3rd Qtr.</td></tr>
  <tr><td>May 28,</td><td>2026</td><td>February 26,</td><td>2026</td><td>May 29,</td><td>2025</td></tr>
  <tr><td>Revenue</td><td>$</td><td>41,456</td><td>$</td><td>23,860</td><td>$</td><td>9,301</td></tr>
  <tr><td>Cost of goods sold</td><td>6,400</td><td>6,105</td><td>5,793</td></tr>
  <tr><td>Research and development</td><td>1,316</td><td>1,250</td><td>965</td></tr>
  <tr><td>Selling, general, and administrative</td><td>407</td><td>344</td><td>318</td></tr>
  <tr><td>Other operating (income) expense, net</td><td>15</td><td>26</td><td>56</td></tr>
  <tr><td>Interest income</td><td>215</td><td>155</td><td>135</td></tr>
  <tr><td>Other non-operating income (expense), net</td><td>(321</td><td>)</td><td>(98</td><td>)</td><td>(68</td><td>)</td></tr>
  <tr><td>Income tax (provision) benefit</td><td>(4,978</td><td>)</td><td>(2,371</td><td>)</td><td>(235</td><td>)</td></tr>
  <tr><td>Equity in net income (loss) of equity method investees</td><td>9</td><td>(4</td><td>)</td><td>7</td></tr>
</table>
<table>
  <tr><td>RECONCILIATION OF GAAP TO NON-GAAP MEASURES, Continued</td><td>3rd Qtr.</td><td>2nd Qtr.</td><td>3rd Qtr.</td></tr>
  <tr><td>May 28,</td><td>2026</td><td>February 26,</td><td>2026</td><td>May 29,</td><td>2025</td></tr>
  <tr><td>GAAP net cash provided by operating activities</td><td>$</td><td>25,388</td><td>$</td><td>11,903</td><td>$</td><td>4,609</td></tr>
  <tr><td>Adjusted free cash flow</td><td>$</td><td>18,304</td><td>$</td><td>6,899</td><td>$</td><td>1,949</td></tr>
</table>
</body></html>
"""


class MicronIrParserTests(unittest.TestCase):
    def _micron_company(self) -> dict:
        return {
            "id": "micron",
            "ticker": "MU",
            "nameZh": "美光科技",
            "nameEn": "Micron Technology",
            "slug": "mu",
            "rank": 10,
            "isAdr": False,
            "brand": {"color": "#8c1d40"},
        }

    def test_discovers_latest_press_release_url_from_quarterly_results_page(self) -> None:
        self.assertEqual(
            micron_ir.discover_latest_release_url(QUARTERLY_RESULTS_HTML),
            "https://investors.micron.com/news-releases/news-release-details/micron-technology-inc-reports-record-results-third-quarter",
        )

    def test_parses_release_financials_and_business_units(self) -> None:
        parsed = micron_ir.parse_release_html(
            RELEASE_HTML,
            "https://investors.micron.com/news-releases/news-release-details/micron-technology-inc-reports-record-results-third-quarter",
            "2026-06-24",
        )

        self.assertEqual(parsed["quarter"], "2026Q2")
        self.assertEqual(parsed["financial"]["fiscalLabel"], "FY2026 Q3")
        self.assertEqual(parsed["financial"]["periodEnd"], "2026-05-28")
        self.assertEqual(parsed["financial"]["revenueBn"], 41.456)
        self.assertEqual(parsed["financial"]["costOfRevenueBn"], 6.4)
        self.assertEqual(parsed["financial"]["netIncomeBn"], 28.243)
        self.assertEqual(parsed["financial"]["dilutedEps"], 24.67)
        self.assertEqual(parsed["financial"]["operatingCashFlowBn"], 25.388)
        self.assertEqual(parsed["financial"]["freeCashFlowBn"], 18.304)
        self.assertEqual(
            [(row["memberKey"], row["valueBn"]) for row in parsed["segments"]],
            [("cmbu", 13.769), ("cdbu", 11.524), ("mcbu", 11.521), ("aebu", 4.634)],
        )

    def test_official_financials_micron_refresh_uses_ir_release_without_sec_companyfacts(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            with (
                patch.object(official_financials, "CACHE_DIR", Path(tmp_dir)),
                patch.object(micron_ir, "fetch_latest_release_html", return_value=("https://example.com/mu-fq3", RELEASE_HTML)),
                patch.object(official_financials, "_resolve_cik", side_effect=AssertionError("SEC should not be used")),
            ):
                payload = official_financials.fetch_official_financial_history(self._micron_company(), refresh=True)

        latest = payload["financials"]["2026Q2"]
        self.assertEqual(payload["quarters"], ["2026Q2"])
        self.assertEqual(latest["statementSource"], micron_ir.MICRON_IR_SOURCE)
        self.assertEqual(latest["revenueBn"], 41.456)
        self.assertEqual(latest["netIncomeBn"], 28.243)

    def test_official_financials_micron_refresh_falls_back_to_current_cache_when_ir_fetch_fails(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            cache_path = Path(tmp_dir) / "micron.json"
            parsed = micron_ir.parse_release_html(RELEASE_HTML, "https://example.com/mu-fq3", "2026-06-24")
            cached_payload = micron_ir.build_financial_payload(parsed, self._micron_company())
            cached_payload["_cacheVersion"] = official_financials.OFFICIAL_FINANCIALS_CACHE_VERSION
            cache_path.write_text(__import__("json").dumps(cached_payload), encoding="utf-8")
            with (
                patch.object(official_financials, "CACHE_DIR", Path(tmp_dir)),
                patch.object(micron_ir, "fetch_latest_release_html", side_effect=RuntimeError("network hiccup")),
                patch.object(official_financials, "_resolve_cik", side_effect=AssertionError("SEC should not be used")),
            ):
                payload = official_financials.fetch_official_financial_history(self._micron_company(), refresh=True)

        self.assertEqual(payload["financials"]["2026Q2"]["statementSource"], micron_ir.MICRON_IR_SOURCE)
        self.assertEqual(payload["financials"]["2026Q2"]["revenueBn"], 41.456)

    def test_revenue_structure_micron_refresh_uses_ir_release_without_sec_segments(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            with (
                patch.object(official_revenue_structures, "CACHE_DIR", Path(tmp_dir)),
                patch.object(micron_ir, "fetch_latest_release_html", return_value=("https://example.com/mu-fq3", RELEASE_HTML)),
                patch.object(official_revenue_structures, "_resolve_cik", side_effect=AssertionError("SEC should not be used")),
            ):
                payload = official_revenue_structures.fetch_official_revenue_structure_history(self._micron_company(), refresh=True)

        segments = payload["quarters"]["2026Q2"]["segments"]
        self.assertEqual(payload["source"], micron_ir.MICRON_IR_SOURCE)
        self.assertEqual(
            [(row["memberKey"], row["valueBn"]) for row in segments],
            [("cmbu", 13.769), ("cdbu", 11.524), ("mcbu", 11.521), ("aebu", 4.634)],
        )

    def test_official_segments_micron_refresh_uses_ir_release_without_sec_filings(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            with (
                patch.object(official_segments, "CACHE_DIR", Path(tmp_dir)),
                patch.object(micron_ir, "fetch_latest_release_html", return_value=("https://example.com/mu-fq3", RELEASE_HTML)),
                patch.object(official_segments, "_resolve_cik", side_effect=AssertionError("SEC should not be used")),
            ):
                payload = official_segments.fetch_official_segment_history(self._micron_company(), refresh=True)

        segments = payload["quarters"]["2026Q2"]
        self.assertEqual(payload["source"], micron_ir.MICRON_IR_SOURCE)
        self.assertEqual(payload["axis"], "MicronBusinessUnit")
        self.assertEqual(
            [(row["memberKey"], row["valueBn"]) for row in segments],
            [("cmbu", 13.769), ("cdbu", 11.524), ("mcbu", 11.521), ("aebu", 4.634)],
        )


if __name__ == "__main__":
    unittest.main()
