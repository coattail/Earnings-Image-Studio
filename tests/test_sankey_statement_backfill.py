import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from sankey_statement_backfill import (  # noqa: E402
    apply_statement_supplements, merge_missing_statement,
    parse_inline_statements, parse_matching_pdf_statement, parse_html_release_statements,
)


class StatementBackfillTests(unittest.TestCase):
    def test_inline_uses_unsegmented_quarter_context_and_reported_sign(self):
        def number(name, value, context="quarter", sign=""):
            return f'<ix:nonFraction name="us-gaap:{name}" contextRef="{context}" unitRef="USD" scale="6" sign="{sign}">{value}</ix:nonFraction>'
        html = '''<html><xbrli:unit id="USD"><xbrli:measure>iso4217:USD</xbrli:measure></xbrli:unit>
        <xbrli:context id="quarter"><xbrli:period><xbrli:startDate>2026-04-01</xbrli:startDate><xbrli:endDate>2026-06-30</xbrli:endDate></xbrli:period></xbrli:context>
        <xbrli:context id="segment"><xbrli:entity><xbrldi:explicitMember dimension="Company:Segment">Company:Cloud</xbrldi:explicitMember></xbrli:entity><xbrli:period><xbrli:startDate>2026-04-01</xbrli:startDate><xbrli:endDate>2026-06-30</xbrli:endDate></xbrli:period></xbrli:context>
        <xbrli:context id="half"><xbrli:period><xbrli:startDate>2026-01-01</xbrli:startDate><xbrli:endDate>2026-06-30</xbrli:endDate></xbrli:period></xbrli:context>'''
        html += number("Revenues", "999,000", "segment") + number("Revenues", "200,000", "half")
        html += number("Revenues", "100,000") + number("CostOfRevenue", "60,000")
        html += number("OperatingIncomeLoss", "2,000", sign="-") + number("NetIncomeLoss", "3,000", sign="-") + "</html>"
        entry = parse_inline_statements(html, "example", "https://www.sec.gov/example.htm")["2026Q2"]
        self.assertEqual(entry["revenueBn"], 100)
        self.assertEqual(entry["grossProfitBn"], 40)
        self.assertEqual(entry["operatingIncomeBn"], -2)
        self.assertEqual(entry["netIncomeBn"], -3)

    def test_pdf_does_not_mix_annual_and_quarterly_tables(self):
        text = '''CONSOLIDATED INCOME STATEMENT
Year ended December 31, 2026  2025
RMB in millions
Revenues   1,000,000   800,000
Cost of revenues   (600,000)   (500,000)
Gross profit   400,000   300,000
Operating profit   200,000   150,000
Profit for the period   100,000   80,000
Three months ended December 31, 2026  2025
RMB in millions
Revenues   100,000   80,000
Cost of revenues   (60,000)   (50,000)
Gross profit   40,000   30,000
Operating profit   20,000   15,000
Profit before income tax   18,000   12,000
Profit for the period   10,000   8,000'''
        entry = parse_matching_pdf_statement([text], {"calendarQuarter": "2026Q4", "revenueBn": 99, "statementCurrency": "CNY"}, "https://company.example/release.pdf")
        self.assertEqual(entry["revenueBn"], 100)
        self.assertEqual(entry["grossProfitBn"], 40)
        self.assertEqual(entry["netIncomeBn"], 10)

    def test_pdf_unlabelled_revenue_total_and_tax_credit(self):
        text = '''Three months ended September 30, 2026  2025
RMB in millions
Revenues
Commission   60,000   50,000
Other services   40,000   30,000
   100,000   80,000
Cost of revenues   (60,000)   (50,000)
Gross profit   40,000   30,000
Operating profit   20,000   15,000
Profit before income tax   10,000   8,000
Income tax credits/(expenses)   2,000   (1,000)
Profit for the period   12,000   7,000'''
        entry = parse_matching_pdf_statement([text], {"calendarQuarter": "2026Q3", "revenueBn": 100}, "https://company.example/release.pdf")
        self.assertEqual(entry["revenueBn"], 100)
        self.assertEqual(entry["taxBn"], -2)
        self.assertEqual(entry["netIncomeBn"], 12)

    def test_merge_rejects_currency_period_and_cumulative_mismatches(self):
        entry = {"revenueBn": 100, "statementCurrency": "CNY", "periodEnd": "2026-06-30"}
        for values in ({"statementCurrency": "USD"}, {"periodEnd": "2026-03-31"}, {"statementSpanQuarters": 2}):
            self.assertEqual(merge_missing_statement(dict(entry), {"revenueBn": 100, "netIncomeBn": 20, **values}, "example"), [])

    def test_structure_only_revenue_is_replaced_as_one_statement_basis(self):
        entry = {"statementSource": "official-revenue-structure", "revenueBn": 200, "periodEnd": "2026-06-30", "grossProfitBn": None, "operatingIncomeBn": None, "netIncomeBn": None}
        source = {"revenueBn": 100, "grossProfitBn": 40, "operatingIncomeBn": 20, "netIncomeBn": 15, "periodEnd": "2026-06-28", "statementSourceUrl": "https://www.sec.gov/quarter.htm"}
        merge_missing_statement(entry, source, "example")
        self.assertEqual(entry["revenueBn"], 100)
        self.assertEqual(entry["periodEnd"], "2026-06-28")
        self.assertEqual(entry["fieldSources"]["netIncomeBn"]["sourceUrl"], source["statementSourceUrl"])
        self.assertEqual(merge_missing_statement(entry, source, "example"), [])

    def test_cached_build_recovers_statement_scalars_for_new_revenue_only_quarter(self):
        from build_dataset import merge_official_financial_breakdowns
        quarter = "2026Q2"
        payload = {"id": "example", "financials": {quarter: {
            "statementSource": "official-revenue-structure", "revenueBn": 100,
            "periodEnd": "2026-06-30", "statementCurrency": "USD",
        }}}
        official = {"financials": {quarter: {
            "revenueBn": 100, "costOfRevenueBn": 60, "operatingIncomeBn": 20,
            "netIncomeBn": 15, "periodEnd": "2026-06-30", "statementCurrency": "USD",
            "statementSourceUrl": "https://www.sec.gov/quarter.htm",
            "statementValueMode": "direct", "statementSpanQuarters": 1,
            "statementPeriodStart": "2026-04-01",
        }}}
        with patch("build_dataset.fetch_official_financial_history", return_value=official):
            entry = merge_official_financial_breakdowns(payload, {"id": "example"})["financials"][quarter]
        self.assertEqual(entry["grossProfitBn"], 40)
        self.assertEqual(entry["operatingIncomeBn"], 20)
        self.assertEqual(entry["netIncomeBn"], 15)
        self.assertEqual(entry["operatingExpensesBn"], 20)
        self.assertEqual(entry["statementSpanQuarters"], 1)
        self.assertEqual(entry["statementPeriodStart"], "2026-04-01")

    def test_superseded_placeholder_does_not_remove_a_real_new_filing(self):
        spec = {"companies": {"example": {"supersededQuarters": {"2026Q3": {"sourceUrl": "https://www.sec.gov/q2.htm"}}, "quarters": {}}}}
        actual = {"id": "example", "financials": {"2026Q3": {"statementSourceUrl": "https://www.sec.gov/q3.htm"}}}
        self.assertIn("2026Q3", apply_statement_supplements(actual, spec)["financials"])
        actual["financials"]["2026Q3"]["statementSourceUrl"] = "https://www.sec.gov/q2.htm"
        self.assertNotIn("2026Q3", apply_statement_supplements(actual, spec)["financials"])

    def test_coca_cola_week_based_q2_is_not_q3_or_half_year(self):
        from official_revenue_structures import _coca_cola_quarter_from_period_end
        self.assertEqual(_coca_cola_quarter_from_period_end("2026-07-03"), "2026Q2")
        self.assertEqual(_coca_cola_quarter_from_period_end("2026-10-02"), "2026Q3")

    def test_split_html_dates_preserve_rmb_column_and_tax_benefit(self):
        html = '''<table><tr><td>Quarter Ended</td></tr>
        <tr><td>March 31,</td><td>December 31,</td><td>March 31,</td><td>March 31,</td></tr>
        <tr><td>2025</td><td>2025</td><td>2026</td><td>2026</td></tr>
        <tr><td>RMB</td><td>RMB</td><td>RMB</td><td>USD</td></tr>
        <tr><td>Net revenues</td><td>900,000</td><td>950,000</td><td>1,000,000</td><td>140,000</td></tr>
        <tr><td>Cost of revenues</td><td>(600,000)</td><td>(600,000)</td><td>(600,000)</td><td>(84,000)</td></tr>
        <tr><td>Operating profit</td><td>100,000</td><td>110,000</td><td>200,000</td><td>28,000</td></tr>
        <tr><td>Net income before tax</td><td>90,000</td><td>100,000</td><td>180,000</td><td>25,200</td></tr>
        <tr><td>Income tax (expense)/benefit</td><td>(10,000)</td><td>(10,000)</td><td>20,000</td><td>2,800</td></tr>
        <tr><td>Net income attributable to the Company's shareholders</td><td>80,000</td><td>90,000</td><td>200,000</td><td>28,000</td></tr></table>'''
        entry = parse_html_release_statements(html, "https://www.sec.gov/quarter.htm")["2026Q1"]
        self.assertEqual(entry["revenueBn"], 1)
        self.assertEqual(entry["netIncomeBn"], .2)
        self.assertEqual(entry["taxBn"], -.02)

    def test_local_latest_index_and_lazy_caches_match_the_backfilled_dataset(self):
        dataset = json.loads((ROOT / "data/earnings-dataset.json").read_text())
        index = json.loads((ROOT / "data/dataset-index.json").read_text())
        index_by_id = {company["id"]: company for company in index["companies"]}
        supplements = json.loads((ROOT / "data/sankey-statement-supplements.json").read_text())
        for company in dataset["companies"]:
            latest = company["quarters"][-1]
            self.assertEqual(index_by_id[company["id"]]["financials"][latest], company["financials"][latest])
            if company["id"] in supplements["companies"]:
                cached = json.loads((ROOT / "data/cache" / (company["id"] + ".json")).read_text())
                self.assertEqual(cached["financials"], company["financials"])
        coca = index_by_id["coca-cola"]
        self.assertEqual(coca["latestQuarter"], "2026Q2")
        self.assertEqual(coca["financials"]["2026Q2"]["revenueBn"], 13.38)


if __name__ == "__main__":
    unittest.main()
