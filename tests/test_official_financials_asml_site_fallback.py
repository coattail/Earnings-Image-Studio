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


ASML_RESULTS_INDEX_HTML = """
<html>
  <body>
    <a href="/en/investors/financial-results/q4-2025">Q4 2025</a>
    <a href="/en/investors/financial-results/q1-2026">Q1 2026</a>
    <a href="/en/investors/financial-results/q3-2025">Q3 2025</a>
  </body>
</html>
"""

ASML_RESULTS_PAGE_HTML = """
<html>
  <head>
    <meta property="article:published_time" content="2026-04-15T05:00:00Z" />
  </head>
  <body>
    <a
      href="https://ourbrand.asml.com/asset/3f4235e1-ad38-4af8-a39b-de0d39cb71d1/Financial-statements-US-GAAP-Q1-2026.pdf"
    >
      Financial statements US GAAP PDF
    </a>
  </body>
</html>
"""

ASML_PDF_PAGE_TEXT = """
Three months ended
Mar 30, Mar 29,
(unaudited, in millions €, except per share data) 2025 2026
Net system sales  5,740.4  6,279.4
Net service and field option sales  2,001.1  2,487.5
Total net sales  7,741.5  8,766.9
Total cost of sales  (3,561.8)  (4,121.9)
Gross profit  4,179.7  4,645.0
Research and development costs  (1,161.1)  (1,184.9)
Selling, general and administrative costs  (280.7)  (302.3)
Income from operations  2,737.9  3,157.8
Interest and other, net  49.2  40.9
Income before income taxes  2,787.1  3,198.7
Income tax expense  (465.1)  (546.6)
Income after income taxes  2,322.0  2,652.1
Profit related to equity method investments  33.0  104.6
Net income  2,355.0  2,756.7
"""

ASML_OLD_RESULTS_PAGE_HTML = """
<html>
  <head>
    <meta name="sc:publication_date" content="2019-04-17" />
  </head>
  <body>
    <a href="https://edge.sitecorecloud.io/asml/files/asml_20190417_us_gaap_2019_q1_heofzytu8g.pdf">
      Financial statements US GAAP PDF
    </a>
  </body>
</html>
"""

ASML_OLD_PDF_PAGE_TEXT = """
ASML - Summary US GAAP Consolidated Statements of Operations
Three months ended,
Apr 1,
Mar 31,
2018
2019
(in millions EUR, except per share data)
Net system sales
1,667.7
1,595.7
Net service and field option sales
617.3
633.1
Total net sales
2,285.0
2,228.8
Total cost of sales
(1,171.5)
(1,301.9)
Gross profit
1,113.5
926.9
Research and development costs
(357.1)
(477.7)
Selling, general and administrative costs
(114.2)
(122.7)
Income from operations
642.2
326.5
Interest and other, net
(10.5)
(8.1)
Income before income taxes
631.7
318.4
Benefit from (provision for) income taxes
(74.4)
(38.2)
Net income
539.7
355.1
"""


class _FakePdfPage:
    def __init__(self, text: str) -> None:
        self._text = text

    def extract_text(self) -> str:
        return self._text


class _FakePdfReader:
    def __init__(self, _stream: object) -> None:
        self.pages = [_FakePdfPage(ASML_PDF_PAGE_TEXT)]


class AsmlOfficialFinancialsSiteFallbackTests(unittest.TestCase):
    def test_fetch_official_financial_history_keeps_asml_site_fallback_when_cik_lookup_fails(self) -> None:
        website_entry = {
            "calendarQuarter": "2026Q1",
            "periodEnd": "2026-03-29",
            "fiscalYear": "2026",
            "fiscalQuarter": "Q1",
            "fiscalLabel": "FY2026 Q1",
            "statementCurrency": "EUR",
            "revenueBn": 8.767,
            "netIncomeBn": 2.757,
            "statementSourceUrl": "https://ourbrand.asml.com/example.pdf",
            "statementFilingDate": "2026-04-15",
        }
        company = {
            "id": "asml",
            "ticker": "ASML",
            "nameZh": "阿斯麦",
            "nameEn": "ASML",
            "slug": "asml",
            "rank": 17,
            "isAdr": True,
            "brand": {},
        }

        with tempfile.TemporaryDirectory() as tmp_dir:
            with (
                patch.object(official_financials, "CACHE_DIR", Path(tmp_dir)),
                patch.object(official_financials, "_resolve_cik", side_effect=RuntimeError("ticker feed timeout")),
                patch.object(official_financials, "_load_asml_website_financials", return_value={"2026Q1": website_entry}),
            ):
                result = official_financials.fetch_official_financial_history(company, refresh=True)

        self.assertEqual(result["financials"]["2026Q1"]["revenueBn"], 8.767)
        self.assertEqual(result["quarters"], ["2026Q1"])
        self.assertIn("resolve_cik: ticker feed timeout", result["errors"])

    def test_fetch_official_financial_history_keeps_asml_site_fallback_when_companyfacts_fails(self) -> None:
        website_entry = {
            "calendarQuarter": "2026Q1",
            "periodEnd": "2026-03-29",
            "fiscalYear": "2026",
            "fiscalQuarter": "Q1",
            "fiscalLabel": "FY2026 Q1",
            "statementCurrency": "EUR",
            "revenueBn": 8.767,
            "netIncomeBn": 2.757,
            "statementSourceUrl": "https://ourbrand.asml.com/example.pdf",
            "statementFilingDate": "2026-04-15",
        }
        company = {
            "id": "asml",
            "ticker": "ASML",
            "nameZh": "阿斯麦",
            "nameEn": "ASML",
            "slug": "asml",
            "rank": 17,
            "isAdr": True,
            "brand": {},
        }

        with tempfile.TemporaryDirectory() as tmp_dir:
            with (
                patch.object(official_financials, "CACHE_DIR", Path(tmp_dir)),
                patch.object(official_financials, "_resolve_cik", return_value=937966),
                patch.object(official_financials, "_request_json", side_effect=RuntimeError("upstream timeout")),
                patch.object(official_financials, "_load_asml_website_financials", return_value={"2026Q1": website_entry}),
            ):
                result = official_financials.fetch_official_financial_history(company, refresh=True)

        self.assertEqual(result["financials"]["2026Q1"]["revenueBn"], 8.767)
        self.assertEqual(result["quarters"], ["2026Q1"])
        self.assertIn("companyfacts: upstream timeout", result["errors"])

    def test_extracts_latest_asml_results_page_path(self) -> None:
        self.assertEqual(
            official_financials._extract_asml_latest_results_page_path(ASML_RESULTS_INDEX_HTML),
            "/en/investors/financial-results/q1-2026",
        )

    def test_extracts_asml_financial_statements_pdf_url(self) -> None:
        self.assertEqual(
            official_financials._extract_asml_financial_pdf_url(ASML_RESULTS_PAGE_HTML),
            "https://ourbrand.asml.com/asset/3f4235e1-ad38-4af8-a39b-de0d39cb71d1/Financial-statements-US-GAAP-Q1-2026.pdf",
        )

    def test_extracts_legacy_asml_financial_statements_pdf_url(self) -> None:
        self.assertEqual(
            official_financials._extract_asml_financial_pdf_url(ASML_OLD_RESULTS_PAGE_HTML),
            "https://edge.sitecorecloud.io/asml/files/asml_20190417_us_gaap_2019_q1_heofzytu8g.pdf",
        )

    def test_generates_archive_page_paths_back_to_2018(self) -> None:
        paths = official_financials._extract_asml_results_page_paths(ASML_RESULTS_INDEX_HTML)

        self.assertEqual(paths[0], ("2026Q1", "/en/investors/financial-results/q1-2026"))
        self.assertEqual(paths[-1], ("2018Q1", "/en/investors/financial-results/q1-2018"))

    def test_loads_latest_asml_financials_from_site_pdf(self) -> None:
        request_payloads = {
            official_financials.ASML_FINANCIAL_RESULTS_INDEX_URL: ASML_RESULTS_INDEX_HTML.encode("utf-8"),
            "https://www.asml.com/en/investors/financial-results/q1-2026": ASML_RESULTS_PAGE_HTML.encode("utf-8"),
            "https://ourbrand.asml.com/asset/3f4235e1-ad38-4af8-a39b-de0d39cb71d1/Financial-statements-US-GAAP-Q1-2026.pdf": b"%PDF-1.4 fake",
        }

        with (
            patch.object(official_financials, "_request", side_effect=request_payloads.__getitem__),
            patch.object(official_financials, "PdfReader", _FakePdfReader),
        ):
            financials = official_financials._load_asml_website_financials("EUR", target_quarter_count=1)

        self.assertIn("2026Q1", financials)
        self.assertEqual(financials["2026Q1"]["statementSourceUrl"], "https://ourbrand.asml.com/asset/3f4235e1-ad38-4af8-a39b-de0d39cb71d1/Financial-statements-US-GAAP-Q1-2026.pdf")
        self.assertEqual(financials["2026Q1"]["statementFilingDate"], "2026-04-15")
        self.assertEqual(financials["2026Q1"]["revenueBn"], 8.767)
        self.assertEqual(financials["2026Q1"]["grossProfitBn"], 4.645)
        self.assertEqual(financials["2026Q1"]["rndBn"], 1.185)
        self.assertEqual(financials["2026Q1"]["sgnaBn"], 0.302)
        self.assertEqual(financials["2026Q1"]["operatingIncomeBn"], 3.158)
        self.assertEqual(financials["2026Q1"]["pretaxIncomeBn"], 3.199)
        self.assertEqual(financials["2026Q1"]["taxBn"], 0.547)
        self.assertEqual(financials["2026Q1"]["netIncomeBn"], 2.757)

    def test_loads_missing_legacy_quarter_until_history_reaches_target(self) -> None:
        old_page_url = "https://www.asml.com/en/investors/financial-results/q1-2019"
        old_pdf_url = "https://edge.sitecorecloud.io/asml/files/asml_20190417_us_gaap_2019_q1_heofzytu8g.pdf"
        request_payloads = {
            official_financials.ASML_FINANCIAL_RESULTS_INDEX_URL: ASML_RESULTS_INDEX_HTML.encode("utf-8"),
            old_page_url: ASML_OLD_RESULTS_PAGE_HTML.encode("utf-8"),
            old_pdf_url: b"%PDF-1.4 fake",
        }
        existing_financials = {
            f"{year}Q{quarter}": {}
            for year in range(2019, 2027)
            for quarter in range(1, 5)
            if (year, quarter) >= (2019, 2) and (year, quarter) <= (2026, 1)
        }

        with (
            patch.object(official_financials, "_request", side_effect=request_payloads.__getitem__),
            patch.object(official_financials, "PdfReader", _FakePdfReader),
        ):
            with patch.object(_FakePdfReader, "__init__", lambda self, _stream: setattr(self, "pages", [_FakePdfPage(ASML_OLD_PDF_PAGE_TEXT)])):
                financials = official_financials._load_asml_website_financials(
                    "EUR",
                    existing_financials=existing_financials,
                    target_quarter_count=len(existing_financials) + 1,
                )

        self.assertEqual(list(financials), ["2019Q1"])
        self.assertEqual(financials["2019Q1"]["periodEnd"], "2019-03-31")
        self.assertEqual(financials["2019Q1"]["revenueBn"], 2.229)
        self.assertEqual(financials["2019Q1"]["netSystemSalesBn"], 1.596)
        self.assertEqual(financials["2019Q1"]["installedBaseManagementBn"], 0.633)


if __name__ == "__main__":
    unittest.main()
