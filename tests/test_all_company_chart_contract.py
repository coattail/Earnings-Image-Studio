"""Run the publication gate against every configured company, never a whitelist."""
import copy
import json
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from build_dataset import TOP30_COMPANIES
from release_chart_quality import chart_issues, stamp_chart_quality, assert_chart_publication
from prepare_pages_artifact import validate_public_revenue_growth

def valid_future(company):
    previous = dict(revenueBn=100, netIncomeBn=20,
                    officialRevenueSegments=[dict(name='Products', valueBn=70), dict(name='Services', valueBn=30)],
                    officialRevenueDetailGroups=[dict(name='Phone', targetName='Products', valueBn=50),
                                                 dict(name='Mac', targetName='Products', valueBn=20)])
    current = copy.deepcopy(previous)
    current.update(revenueBn=120, calendarQuarter='2026Q3', periodEnd='2026-09-30',
                   statementFilingDate='2026-10-30', statementSourceUrl='https://issuer.example/current',
                   automaticEarnings={'form':'8-K'})
    for row, amount in zip(current['officialRevenueSegments'], [80,40]): row['valueBn']=amount
    for row, amount in zip(current['officialRevenueDetailGroups'], [55,25]): row['valueBn']=amount
    for field in ('officialRevenueSegments','officialRevenueDetailGroups'):
        for row in current[field]: row.update(sourceUrl=current['statementSourceUrl'], filingDate='2026-10-30')
    return stamp_chart_quality(dict(id=company['id'], financials={'2026Q2':previous, '2026Q3':current}))

class EveryCompanyContractTests(unittest.TestCase):
    def test_published_universe_and_ready_pending_statuses_are_consistent(self):
        companies = json.loads((ROOT/'data/earnings-dataset.json').read_text())['companies']
        self.assertEqual({c['id'] for c in companies}, {c['id'] for c in TOP30_COMPANIES})
        for company in companies:
            with self.subTest(company=company['id']):
                issues=chart_issues(company)
                quality=company['financials'][max(company['financials'])]['chartQuality']
                self.assertEqual(quality['status'], 'pending' if issues else 'ready')
                self.assertEqual(quality['quarter'],max(company['financials']))
                assert_chart_publication(company)
        validate_public_revenue_growth()

    def test_future_failures_are_rejected_for_every_company_despite_cached_ready_flag(self):
        def missing_parent(e):e.pop('officialRevenueSegments')
        def missing_children(e):e.pop('officialRevenueDetailGroups')
        def bad_total(e):e['officialRevenueSegments'][0]['valueBn']=75
        def orphan(e):e['officialRevenueDetailGroups'][0]['targetName']='Missing Parent'
        def nonfinite(e):e['officialRevenueSegments'][0]['valueBn']=float('inf')
        def estimated(e):e['officialRevenueSegments'][0]['inferredFromQuarter']='2026Q2'
        def stale(e):e['officialRevenueSegments'][0]['filingDate']='2026-06-30'
        def wrong_period(e):e['calendarQuarter']='2026Q2'
        failures=(missing_parent,missing_children,bad_total,orphan,nonfinite,estimated,stale,wrong_period)
        for company in TOP30_COMPANIES:
            good=valid_future(company)
            self.assertEqual(chart_issues(good),[],company['id'])
            for mutate in failures:
                with self.subTest(company=company['id'],failure=mutate.__name__):
                    broken=copy.deepcopy(good);mutate(broken['financials']['2026Q3'])
                    self.assertTrue(chart_issues(broken))
                    with self.assertRaises(ValueError):assert_chart_publication(broken)

if __name__=='__main__':unittest.main()
