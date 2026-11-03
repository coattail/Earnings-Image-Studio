import copy
import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from release_chart_quality import chart_issues, enrich_from_release
import watch_earnings

def fixture():
    prior = {'revenueBn':100, 'officialRevenueSegments':[{'name':'Products','valueBn':70},{'name':'Services','valueBn':30}],
             'officialRevenueDetailGroups':[{'name':'Phone','targetName':'Products','valueBn':50},{'name':'Mac','targetName':'Products','valueBn':20}]}
    return {'id':'sample','financials':{'2026Q2':prior, '2026Q3':{'revenueBn':120,'netIncomeBn':20,'statementFilingDate':'2026-10-30'}}}

def html():
    return '''<p>Amounts in millions</p><table><tr><td>Three Months Ended September 30,</td></tr><tr><td>2026</td><td>2025</td></tr>
    <tr><td>Products</td><td>80000</td><td>65000</td></tr><tr><td>Services</td><td>40000</td><td>30000</td></tr>
    <tr><td>Phone</td><td>55000</td><td>45000</td></tr><tr><td>Mac</td><td>25000</td><td>20000</td></tr></table>'''

class ReleaseChartTests(unittest.TestCase):
    def test_complete_trunk_does_not_mean_complete_chart(self):
        p=fixture()
        self.assertTrue(chart_issues(p))
        with self.assertRaisesRegex(ValueError,'incomplete Sankey'):
            watch_earnings.validate_refresh({'companyId':'sample'},p)

    def test_official_rows_reconcile_without_copying_previous_amounts(self):
        p=fixture(); original=copy.deepcopy(p['financials']['2026Q2'])
        enrich_from_release(p,html(),'https://example.com/release')
        self.assertEqual(chart_issues(p),[])
        self.assertEqual(p['financials']['2026Q3']['officialRevenueDetailGroups'][0]['valueBn'],55)
        self.assertEqual(p['financials']['2026Q2'],original)

    def test_lost_child_level_is_detected_even_when_parent_totals_match(self):
        p=fixture();enrich_from_release(p,html(),'url')
        del p['financials']['2026Q3']['officialRevenueDetailGroups']
        self.assertIn('missing current-quarter revenue detail for products',chart_issues(p))

    def test_non_reconciling_children_cannot_publish(self):
        p=fixture();enrich_from_release(p,html().replace('55000','50000'),'url')
        self.assertTrue(any('does not reconcile' in s for s in chart_issues(p)))

    def test_unknown_units_wrong_period_and_missing_rows_stay_pending(self):
        for content in [html().replace('Amounts in millions',''),html().replace('2026','2025'),html().replace('Mac','Unrelated')]:
            p=fixture();enrich_from_release(p,content,'url')
            self.assertTrue(chart_issues(p))

    def test_existing_incomplete_quarter_is_retried_without_a_new_filing(self):
        result=watch_earnings.detect({'id':'sample','ticker':'TEST'},fixture())
        self.assertTrue(result['needsUpdate'])
        self.assertEqual(result['reason'],'incomplete-chart-classification')

if __name__=='__main__':unittest.main()
