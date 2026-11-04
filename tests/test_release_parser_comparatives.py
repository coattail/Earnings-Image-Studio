import copy
import json
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from earnings_release import parse_release
from release_chart_completion import complete_current_chart
from release_chart_quality import chart_issues, chart_fingerprint
from verify_earnings_deployment import fingerprint
from sankey_statement_backfill import parse_inline_statements


class ReleaseComparativeTests(unittest.TestCase):
    def test_native_columns_exclude_dollar_translations_and_preserve_actual_quarter_dates(self):
        html = (ROOT / 'tests/fixtures/netease-q2-2026-release.html').read_text()
        result = parse_release(html, {'id':'netease','reportingCurrency':'CNY'}, 'https://www.sec.gov/current', '2026-08-20')
        self.assertEqual(result['2026Q2']['revenueBn'], 30.107)
        self.assertEqual(result['2026Q2']['netIncomeBn'], 6.981)
        self.assertEqual(result['2026Q1']['revenueBn'], 30.591)
        self.assertEqual(result['2025Q2']['revenueBn'], 27.892)
        self.assertAlmostEqual(result['2026Q2']['grossMarginYoyDeltaPp'], 5.75)
        wrapped = html.replace('Three Months Ended', 'Three\nMonths Ended')
        self.assertEqual(parse_release(wrapped, {'id':'netease','reportingCurrency':'CNY'},
                                      'https://www.sec.gov/current', '2026-08-20')['2026Q2']['revenueBn'], 30.107)

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
