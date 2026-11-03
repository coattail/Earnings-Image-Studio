import copy
import sys
import unittest
from unittest.mock import patch
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from release_chart_quality import chart_issues, enrich_from_release, assert_chart_publication, stamp_chart_quality
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
    def test_first_company_cannot_pass_with_only_financial_totals(self):
        p=fixture();del p['financials']['2026Q2']
        self.assertIn('missing current-quarter revenue classification',chart_issues(p))

    def test_wrong_ready_flag_and_pending_flag_do_not_legalize_nonfinite_json(self):
        p=fixture();enrich_from_release(p,html(),'url');stamp_chart_quality(p)
        p['financials']['2026Q3']['officialRevenueSegments'][0]['valueBn']=float('nan')
        with self.assertRaisesRegex(ValueError,'non-finite'):assert_chart_publication(p)
        p['financials']['2026Q3']['chartQuality']['status']='pending'
        with self.assertRaisesRegex(ValueError,'non-finite'):assert_chart_publication(p)

    def test_category_rename_requires_explicit_taxonomy_change_and_new_children_must_reconcile(self):
        p=fixture();enrich_from_release(p,html(),'url');e=p['financials']['2026Q3']
        e['officialRevenueSegments'][0]['name']='Devices'
        e['officialRevenueDetailGroups']=[]
        self.assertTrue(any('taxonomy' in x for x in chart_issues(p)))
        e['officialRevenueTaxonomyChangedFromPreviousQuarter']=True
        self.assertEqual(chart_issues(p),[])
        e['officialRevenueDetailGroups']=[{'name':'Phone','targetName':'Devices','valueBn':55}]
        self.assertTrue(any('reconcile' in x for x in chart_issues(p)))

    def test_additive_totals_are_checked_without_a_matching_historical_basis(self):
        p=fixture();enrich_from_release(p,html(),'url');del p['financials']['2026Q2']
        p['financials']['2026Q3']['officialRevenueSegments'][0]['valueBn']=70
        self.assertIn('revenue classifications do not reconcile to total revenue',chart_issues(p))

    def test_inferred_or_stale_classifications_are_rejected_even_if_they_balance(self):
        for mutation in ({'inferredFromQuarter':'2026Q2'}, {'syntheticInterpolated':True}):
            p=fixture();enrich_from_release(p,html(),'url')
            p['financials']['2026Q3']['officialRevenueSegments'][0].update(mutation)
            self.assertTrue(any('estimates' in x for x in chart_issues(p)))

    def test_explicit_gross_to_net_adjustment_is_required_for_visa_style(self):
        p=fixture();enrich_from_release(p,html(),'url');e=p['financials']['2026Q3']
        e['officialRevenueStyle']='visa-revenue-components';e['revenueBn']=115
        self.assertTrue(chart_issues(p));e['clientIncentivesBn']=5
        self.assertEqual(chart_issues(p),[])

    def test_small_category_loss_is_not_hidden_by_rounding_tolerance(self):
        p=fixture();enrich_from_release(p,html(),'url')
        p['financials']['2026Q2']['officialRevenueDetailGroups'].append({'name':'Small category','targetName':'Products','valueBn':.001})
        self.assertTrue(any('smallcategory' in issue for issue in chart_issues(p)))
        stamp_chart_quality(p)
        self.assertIn('smallcategory',p['financials']['2026Q3']['chartQuality']['requiredDetailMembers']['products'])

    def test_small_company_cannot_hide_a_large_relative_revenue_gap(self):
        p=fixture();del p['financials']['2026Q2'];e=p['financials']['2026Q3']
        e.update(revenueBn=.02,officialRevenueSegments=[{'name':'Only parsed category','valueBn':.01}])
        self.assertIn('revenue classifications do not reconcile to total revenue',chart_issues(p))

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
        with patch.object(watch_earnings,'latest_native_release',return_value=None), patch.object(watch_earnings,'discover_release',return_value=None), patch.object(watch_earnings.checker,'detect_company_update',return_value={'needsUpdate':False}):
            result=watch_earnings.detect({'id':'sample','ticker':'TEST'},fixture())
        self.assertTrue(result['needsUpdate'])
        self.assertEqual(result['reason'],'incomplete-chart-classification')

    def test_pending_old_chart_does_not_hide_the_next_new_earnings_release(self):
        release={'quarter':'2026Q4','filingDate':'2027-01-15'}
        with patch.object(watch_earnings,'latest_native_release',return_value=None), patch.object(watch_earnings,'discover_release',return_value=release):
            result=watch_earnings.detect({'id':'sample','ticker':'TEST'},fixture())
        self.assertEqual(result['remoteQuarter'],'2026Q4')
        self.assertEqual(result['reason'],'earnings-release-detected')

    def test_pending_quarter_does_not_erase_the_next_quarters_required_hierarchy(self):
        p=fixture();p['financials']['2026Q3']['chartQuality']={'status':'pending'}
        p['financials']['2026Q4']={'revenueBn':130,'netIncomeBn':20}
        self.assertTrue(chart_issues(p))

    def test_trailing_growth_column_does_not_hide_monetary_classifications(self):
        p=fixture()
        content=html().replace('</tr>', '<td>20%</td></tr>')
        enrich_from_release(p, content, 'url')
        self.assertEqual(chart_issues(p), [])
        self.assertEqual(p['financials']['2026Q3']['officialRevenueSegments'][0]['valueBn'], 80)

if __name__=='__main__':unittest.main()
