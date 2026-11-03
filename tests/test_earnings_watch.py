import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import earnings_release as release
import watch_earnings as watch


def statement(adjusted=False, units=True):
    return f'''<p>{"(in millions, except per share amounts)" if units else ""}</p>
    <table><tr><td>{"Reconciliation of adjusted operating income" if adjusted else "Condensed consolidated statements of operations"}</td></tr>
    <tr><td>Three Months Ended September 27,</td><td>Nine Months Ended September 27,</td></tr>
    <tr><td>2026</td><td>2025</td><td>2026</td><td>2025</td></tr>
    <tr><td>Product revenue</td><td>100</td><td>90</td><td>300</td><td>250</td></tr>
    <tr><td>Total revenue</td><td>1200</td><td>1000</td><td>3200</td><td>3000</td></tr>
    <tr><td>Cost of revenue</td><td>400</td><td>400</td><td>1200</td><td>1200</td></tr>
    <tr><td>Gross profit</td><td>800</td><td>600</td><td>2000</td><td>1800</td></tr>
    <tr><td>Income from operations</td><td>300</td><td>200</td><td>800</td><td>600</td></tr>
    <tr><td>Net income</td><td>260</td><td>160</td><td>700</td><td>500</td></tr>
    <tr><td>Net income attributable to common stockholders</td><td>250</td><td>150</td><td>680</td><td>480</td></tr></table>'''


class ReleaseParserTests(unittest.TestCase):
    def test_fiscal_quarter_from_official_release_identity_is_distinct_from_calendar_quarter(self):
        entries=release.parse_release(statement(),{'id':'sample'},'https://www.sec.gov/earningsreleasefy27q2.htm','2026-11-02')
        self.assertEqual(entries['2026Q3']['fiscalLabel'],'FY2027 Q2')
        self.assertEqual(entries['2025Q3']['fiscalLabel'],'FY2026 Q2')
        # Comparative columns must survive even without a historical cache.
        current=entries['2026Q3']
        self.assertAlmostEqual(current['grossMarginYoyDeltaPp'],6.667,places=3)
        self.assertEqual(current['operatingMarginYoyDeltaPp'],5)
        self.assertAlmostEqual(current['profitMarginYoyDeltaPp'],5.833,places=3)

    def test_quarterly_gaap_total_and_common_earnings_win_over_ytd_and_product_rows(self):
        entries = release.parse_release(statement(), {"id": "sample"}, "https://www.sec.gov/release.htm", "2026-11-02")
        latest = entries["2026Q3"]
        self.assertEqual(latest["revenueBn"], 1.2)
        self.assertEqual(latest["operatingIncomeBn"], .3)
        self.assertEqual(latest["netIncomeBn"], .25)
        self.assertEqual(latest["periodEnd"], "2026-09-27")

    def test_adjusted_tables_are_rejected(self):
        self.assertEqual(release.parse_release(statement(adjusted=True), {}, "https://example.org", "2026-11-02"), {})

    def test_gaap_table_with_later_adjusted_rows_keeps_reported_values(self):
        html = statement().replace("</table>", "<tr><td>Adjusted operating income</td><td>999</td><td>888</td></tr><tr><td>Non-GAAP net income</td><td>777</td><td>666</td></tr></table>")
        entry = release.parse_release(html, {}, "https://example.org", "2026-11-02")["2026Q3"]
        self.assertEqual(entry["operatingIncomeBn"], .3)
        self.assertEqual(entry["netIncomeBn"], .25)

    def test_managed_basis_does_not_replace_reported_bank_revenue(self):
        html = statement().replace('<tr><td>Product revenue', '<tr><td>Reported Basis</td></tr><tr><td>Product revenue')
        html = html.replace('</table>', '<tr><td>Managed Basis</td></tr><tr><td>Total revenue</td><td>1500</td><td>1400</td></tr><tr><td>Net income</td><td>500</td><td>400</td></tr></table>')
        self.assertEqual(release.parse_release(html, {}, 'https://example.org', '2026-11-02')['2026Q3']['revenueBn'], 1.2)

    def test_revenue_only_table_cannot_borrow_income_from_another_table(self):
        extra = '<p>in millions</p><table><tr><td>Three Months Ended September 27,</td></tr><tr><td>2026</td><td>2025</td></tr><tr><td>Total revenue</td><td>326</td><td>325</td></tr></table>'
        self.assertEqual(release.parse_release(statement()+extra, {}, 'https://example.org', '2026-11-02')['2026Q3']['revenueBn'], 1.2)

    def test_quarter_axis_labels_are_not_money_rows(self):
        html = statement().replace('<tr><td>Product revenue', '<tr><td>Revenue</td><td>3Q26</td><td>3Q25</td></tr><tr><td>Product revenue')
        self.assertEqual(release.parse_release(html, {}, 'https://example.org', '2026-11-02')['2026Q3']['revenueBn'], 1.2)

    def test_year_axis_labels_are_not_money_rows(self):
        html = statement().replace('<tr><td>Product revenue', '<tr><td>REVENUES AND OTHER INCOME</td><td>2026</td><td>2025</td></tr><tr><td>Product revenue')
        self.assertEqual(release.parse_release(html, {}, 'https://example.org', '2026-11-02')['2026Q3']['revenueBn'], 1.2)

    def test_reported_parent_earnings_take_priority_over_noncontrolling_interests(self):
        html = statement().replace('Net income attributable to common stockholders', 'Net income (loss) attributable to Parent Corporation')
        self.assertEqual(release.parse_release(html, {}, 'https://example.org', '2026-11-02')['2026Q3']['netIncomeBn'], .25)

    def test_share_units_do_not_override_monetary_units(self):
        html = statement().replace("in millions, except per share amounts", "In millions, except shares which are reflected in thousands")
        entries = release.parse_release(html, {}, "https://example.org", "2026-11-02")
        self.assertEqual(entries["2026Q3"]["revenueBn"], 1.2)

    def test_missing_units_are_not_guessed(self):
        self.assertEqual(release.parse_release(statement(units=False), {}, "https://example.org", "2026-11-02"), {})

    def test_named_quarter_alternating_margins_and_adjusted_section(self):
        html = '''<table><tr><td>in millions</td><td>THIRD QUARTER</td></tr>
        <tr><td>2026</td><td>2025</td></tr>
        <tr><td>Amount</td><td>Percent to Sales</td><td>Amount</td><td>Percent to Sales</td></tr>
        <tr><td>Sales to customers</td><td>25399</td><td>100.0</td><td>23993</td><td>100.0</td></tr>
        <tr><td>Net earnings</td><td>210</td><td>0.8</td><td>5152</td><td>21.5</td></tr>
        <tr><td>Adjusted earnings before taxes</td></tr>
        <tr><td>Net earnings</td><td>6339</td><td>25</td><td>6801</td><td>28</td></tr></table>'''
        entries = release.parse_release(html, {}, 'https://example.org', '2026-10-13')
        self.assertEqual(entries['2026Q3']['netIncomeBn'], .21)
        self.assertEqual(entries['2025Q3']['revenueBn'], 23.993)

    def test_missing_english_row_cannot_match_an_empty_chinese_alias(self):
        entry = release.parse_release(statement(), {}, 'https://example.org', '2026-11-02')['2026Q3']
        self.assertIsNone(entry['rndBn'])

    def test_later_margin_comparisons_and_eps_do_not_replace_earnings(self):
        html = statement().replace('</table>', '<tr><td>Net income attributable to common stockholders</td><td>20.3%</td><td>21.2%</td></tr><tr><td>Earnings</td><td>1.20</td><td>1.10</td></tr></table>')
        self.assertEqual(release.parse_release(html, {}, 'https://example.org', '2026-11-02')['2026Q3']['netIncomeBn'], .25)

    def test_samsung_pdf_amounts_ignore_percentage_columns(self):
        page = 'KRW trillion 3Q 25 % of sales 2Q 26 % of sales 3Q 26 % of sales\nSales 86.1 100.0% 171.5 100.0% 195.3 100.0%\nCost of sales 52.6 61.1% 52.2 30.4% 60.0 30.7%\nOperating profit 12.2 14.1% 89.5 52.2% 107.4 55.0%\nNet profit 12.2 14.2% 71.6 41.8% 75.1 38.5%'
        entry = release.samsung_statement([page], '2026Q3')
        self.assertEqual(entry['revenueBn'], 195300)
        self.assertEqual(entry['netIncomeBn'], 75100)
        self.assertEqual(entry['statementCurrency'], 'KRW')
        self.assertAlmostEqual(entry['profitMarginYoyDeltaPp'],24.284,places=3)

    def test_unrelated_euro_debt_discussion_does_not_change_usd_statement_currency(self):
        entries = release.parse_release(statement()+"<p>Debt issued in euros</p>", {"reportingCurrency":"USD"}, "https://example.org", "2026-11-02")
        self.assertEqual(entries["2026Q3"]["statementCurrency"], "USD")

    def test_unrelated_8k_is_skipped_and_announcement_date_is_not_reporting_quarter(self):
        recent = dict(form=["8-K", "8-K"], items=["5.02", "2.02,9.01"], filingDate=["2026-11-03", "2026-11-02"], accessionNumber=["unrelated", "earnings"])
        def request(url):
            self.assertNotIn("unrelated", url)
            return {"filings": {"recent": recent}} if "submissions" in url else {"directory": {"item": [{"name": "ex99.htm"}]}}
        with tempfile.TemporaryDirectory() as temp, patch.object(release, "CACHE", Path(temp)), patch.object(release, "_request_json", side_effect=request), patch.object(release, "_request", return_value=statement().encode()):
            item = release.discover_release({"id": "sample", "cik": 1, "ticker": "TEST"})
        self.assertEqual(item["quarter"], "2026Q3")
        self.assertEqual(item["reportDate"], "2026-09-27")

    def test_fiscal_year_is_advanced_from_the_issuer_calendar(self):
        payload = dict(id="nvidia", financials={"2026Q2": dict(fiscalYear="2027", fiscalQuarter="Q1")})
        entry = dict(revenueBn=1.2, operatingIncomeBn=.3, netIncomeBn=.25, statementFilingDate="2026-11-02")
        with tempfile.TemporaryDirectory() as temp, patch.object(release, "CACHE", Path(temp)):
            Path(temp, "nvidia.json").write_text(json.dumps(dict(quarter="2026Q3", filingDate="2026-11-02", entry=entry, _cacheVersion=release.VERSION)))
            result = release.supplement_cached_release(payload)
        self.assertEqual(result["financials"]["2026Q3"]["fiscalLabel"], "FY2027 Q2")


class WatchValidationTests(unittest.TestCase):
    def test_a_successful_builder_exit_does_not_hide_a_stale_source(self):
        with self.assertRaisesRegex(ValueError, "expected 2026Q3"):
            watch.validate_refresh(dict(companyId="a", remoteQuarter="2026Q3"), {"quarters": ["2026Q2"], "financials": {"2026Q2": dict(revenueBn=1, operatingIncomeBn=.2, netIncomeBn=.1)}})

    def test_failed_refresh_rolls_back_both_public_files_and_company_cache(self):
        with tempfile.TemporaryDirectory() as temp, patch.object(watch, "ROOT", Path(temp)):
            paths = [Path(temp, p) for p in ["data/earnings-dataset.json", "data/dataset-index.json", "data/cache/a.json"]]
            for path in paths:
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text("original")
            def mutate(*args, **kwargs):
                for path in paths: path.write_text("partial invalid output")
                return type("Result", (), {"returncode": 1})()
            with patch.object(watch.subprocess, "run", side_effect=mutate), self.assertRaises(Exception):
                watch.refresh_one({"companyId": "a"})
            self.assertTrue(all(p.read_text() == "original" for p in paths))


if __name__ == "__main__":
    unittest.main()
