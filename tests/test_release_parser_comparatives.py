import copy
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from earnings_release import parse_release
from official_revenue_structures import XIAOMI_QUARTERLY_PDF_URLS, _parse_xiaomi_quarter_item
from release_chart_completion import complete_current_chart, enrich_pdf_partition
from release_chart_quality import chart_issues, chart_fingerprint
from verify_earnings_deployment import fingerprint
from sankey_statement_backfill import parse_inline_statements


class ReleaseComparativeTests(unittest.TestCase):
    def test_xiaomi_q3_2026_uses_renamed_segment_and_current_table_columns(self):
        url = XIAOMI_QUARTERLY_PDF_URLS['2026Q3']
        header = "in the third quarter of 2026 and the third quarter of 2025:\n(RMB in millions)"
        text = f"""
        Revenue by segment {header}
        Smartphone × AIoT 83,355.9 77.7% 84,110.6 74.4%
        NEV, AI and other new initiatives 23,883.6 22.3% 29,010.1 25.6%
        Revenue by line of our smartphone × AIoT segment {header}
        Smartphones 45,578.6 42.5% 45,969.0 40.6%
        IoT and lifestyle products 27,153.3 25.3% 27,552.1 24.4%
        Internet services 9,450.2 8.8% 9,380.5 8.3%
        Other related businesses 1,173.8 1.1% 1,209.0 1.1%
        Total revenue of smartphone × AIoT segment 83,355.9 77.7% 84,110.6 74.4%
        Cost of sales by segment {header}
        Smartphone × AIoT 66,326.5 61.8% 65,558.4 58.0%
        NEV, AI and other new initiatives 19,298.5 18.0% 21,626.1 19.1%
        Cost of sales by line of our smartphone × AIoT segment {header}
        Smartphones 41,396.7 38.6% 40,873.5 36.1%
        IoT and lifestyle products 21,263.2 19.8% 20,957.0 18.5%
        Internet services 2,477.8 2.3% 2,169.8 1.9%
        Other related businesses 1,188.8 1.1% 1,558.1 1.5%
        Total cost of sales of smartphone × AIoT segment 66,326.5 61.8% 65,558.4 58.0%
        """
        with patch('official_revenue_structures._extract_pdf_text_fast', return_value=text) as fetch:
            _, data, filing = _parse_xiaomi_quarter_item('2026Q3', url)
        fetch.assert_called_once_with(url)
        self.assertEqual(filing['filingDate'], '2026-11-24')
        self.assertEqual([(row['memberKey'], row['valueBn']) for row in data['segments']], [
            ('smartphonexaiot', 83.356), ('smartevaiandothernewinitiatives', 23.884),
        ])
        self.assertTrue(data['segments'][1]['name'].startswith('NEV'))
        self.assertEqual([row['valueBn'] for row in data['detailGroups']], [45.579, 27.153, 9.45, 1.174])
        self.assertEqual([row['valueBn'] for row in data['costBreakdown']], [41.397, 21.263, 2.478, 1.189, 19.299])
        entry = {'revenueBn': 107.239525}
        enrich_pdf_partition({'id': 'xiaomi', 'financials': {'2026Q3': entry}}, None, url, pages=[text])
        self.assertEqual(entry['officialRevenueSegments'], data['segments'])
        self.assertEqual(entry['officialRevenueDetailGroups'], data['detailGroups'])
        self.assertEqual(entry['officialCostBreakdown'], data['costBreakdown'])

    def test_native_columns_exclude_dollar_translations_and_preserve_actual_quarter_dates(self):
        html = (ROOT / 'tests/fixtures/netease-q2-2026-release.html').read_text()
        result = parse_release(html, {'id':'netease','reportingCurrency':'CNY'}, 'https://www.sec.gov/current', '2026-08-20')
        self.assertEqual(result['2026Q2']['revenueBn'], 30.106546)
        self.assertEqual(result['2026Q2']['netIncomeBn'], 6.980656)
        self.assertEqual(result['2026Q1']['revenueBn'], 30.591281)
        self.assertEqual(result['2025Q2']['revenueBn'], 27.891664)
        self.assertAlmostEqual(result['2026Q2']['grossMarginYoyDeltaPp'], 5.75)
        wrapped = html.replace('Three Months Ended', 'Three\nMonths Ended')
        self.assertEqual(parse_release(wrapped, {'id':'netease','reportingCurrency':'CNY'},
                                      'https://www.sec.gov/current', '2026-08-20')['2026Q2']['revenueBn'], 30.106546)

    def test_explicit_total_revenue_wins_over_a_net_sales_inline_tag(self):
        html = '''<xbrli:context id="q"><xbrli:period><xbrli:startdate>2026-05-01</xbrli:startdate><xbrli:enddate>2026-07-31</xbrli:enddate></xbrli:period></xbrli:context>
        <xbrli:unit id="usd"><xbrli:measure>iso4217:USD</xbrli:measure></xbrli:unit><table>
        <tr><td>Net sales</td><td><ix:nonfraction name="us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax" contextref="q" unitref="usd" scale="9">100</ix:nonfraction></td></tr>
        <tr><td>Total revenues</td><td><ix:nonfraction name="us-gaap:Revenues" contextref="q" unitref="usd" scale="9">102</ix:nonfraction></td></tr>
        <tr><td>Net income</td><td><ix:nonfraction name="us-gaap:NetIncomeLoss" contextref="q" unitref="usd" scale="9">10</ix:nonfraction></td></tr></table>'''
        result = parse_inline_statements(html, 'sample', 'https://www.sec.gov/current')
        self.assertEqual(result['2026Q3']['revenueBn'], 102)

    def test_three_quarter_columns_and_two_ytd_columns_keep_current_actuals_and_yoy(self):
        html = (ROOT / 'tests/fixtures/amd-q3-2026-release.html').read_text()
        url = 'https://www.sec.gov/Archives/edgar/data/2488/000000248826000188/q32026991.htm'
        result = parse_release(html, {'id': 'amd', 'reportingCurrency': 'USD'}, url, '2026-11-03')
        current = result['2026Q3']
        self.assertEqual(result['2025Q3']['statementSpanQuarters'], 1)
        for field, expected in {'revenueBn':13.377,'costOfRevenueBn':6.167,'grossProfitBn':7.210,
                                'sgnaBn':1.298,'rndBn':2.803,'otherOpexBn':.277,'taxBn':-.555,
                                'operatingMarginYoyDeltaPp':7.435,'profitMarginYoyDeltaPp':4.707}.items():
            self.assertAlmostEqual(current[field], expected, places=6, msg=field)
        self.assertEqual({r['name'] for r in current['officialOpexBreakdown']},
                         {'Selling, general and administrative','R&D'})
        company = json.loads((ROOT / 'data/cache/amd.json').read_text())
        company['financials'] = {q:e for q,e in company['financials'].items() if q < '2026Q3'}
        company['financials']['2026Q3'] = current
        complete_current_chart(company, {}, documents=[(url, html, '2026-11-03')])
        self.assertEqual(chart_issues(company), [])
        self.assertEqual({r['memberKey']:r['valueBn'] for r in current['officialRevenueSegments']},
                         {'datacenter':8.546,'client':2.949,'gaming':.773,'embedded':1.109})

    def test_deployment_checks_share_margin_and_cost_validation_with_published_caches(self):
        company = {'id':'sample','financials':{'2026Q3':{'grossMarginYoyDeltaPp':1.2,'costOfRevenueBn':3}}}
        baseline = fingerprint({'companies':[company]})
        self.assertEqual(baseline['sample'], chart_fingerprint(company))
        for field in ['grossMarginYoyDeltaPp','operatingMarginYoyDeltaPp','profitMarginYoyDeltaPp','costOfRevenueBn']:
            changed = copy.deepcopy(company)
            changed['financials']['2026Q3'][field] = 99
            self.assertNotEqual(baseline, fingerprint({'companies':[changed]}), field)
