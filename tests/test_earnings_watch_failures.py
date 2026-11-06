"""Regression cases from scheduled earnings update #351."""
import copy
from datetime import date
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
import check_for_updates as checker
import earnings_release as release
import stockanalysis_financials as stock
import watch_earnings as watch
from release_chart_completion import enrich_complete_partition
from release_chart_quality import chart_issues


class DelayedAnnouncementTests(unittest.TestCase):
    def discover(self, event='2026-08-08', *, local_source=True, complete=True, filing_period='2026-06-30'):
        accession = '0001193125-26-341032'
        recent = dict(form=['8-K', '10-Q'], items=['2.02,9.01', ''],
                      filingDate=['2026-08-11', '2026-08-10'],
                      reportDate=[event, filing_period],
                      accessionNumber=['0001193125-26-344495', accession])
        entry = dict(periodEnd='2026-06-30', revenueBn=101.808, netIncomeBn=25.667 if complete else None,
                     statementFilingDate='2026-08-10',
                     statementSourceUrl=f'https://www.sec.gov/Archives/edgar/data/1067983/{accession.replace("-", "")}/brka-20260630.htm' if local_source else 'https://vendor.example/financials')
        def request(url):
            return {'filings': {'recent': recent}} if 'submissions' in url else {'directory': {'item': []}}
        with tempfile.TemporaryDirectory() as temp, patch.object(release, 'CACHE', Path(temp)), \
             patch.object(release, '_request_json', side_effect=request) as requested, patch.object(release, 'date') as clock:
            clock.today.return_value = date(2026, 11, 6)
            item = release.discover_release({'id': 'berkshire', 'ticker': 'BRK.B', 'cik': 1067983},
                                            {'financials': {'2026Q2': entry}})
        return item, requested.call_count

    def test_delayed_8k_for_event_already_covered_by_exact_10q_is_skipped(self):
        item, requests = self.discover()
        self.assertIsNone(item)
        self.assertEqual(requests, 1)

    def test_newer_event_still_requires_parsing(self):
        item, _ = self.discover(event='2026-08-11')
        self.assertIn('parseError', item)

    def test_vendor_date_incomplete_statement_or_different_period_cannot_suppress_release(self):
        for kwargs in ({'local_source': False}, {'complete': False}, {'filing_period': '2026-03-31'}, {'event': ''}):
            with self.subTest(**kwargs):
                item, _ = self.discover(**kwargs)
                self.assertIn('parseError', item)


class VendorTableTests(unittest.TestCase):
    def test_hidden_growth_labels_do_not_replace_statement_rows_or_real_growth(self):
        table = BeautifulSoup('''<table>
          <tr><th>Fiscal Quarter</th><td>Q3 2026</td></tr>
          <tr><th>Period Ending</th><td>Sep 30, 2026</td></tr>
          <tr><th><div>Revenue</div><div aria-hidden="true">Revenue Growth</div></th><td>221,488</td></tr>
          <tr><th>Revenue Growth</th><td>13.59%</td></tr>
          <tr><th><div>Net Income</div><div aria-hidden="true">Net Income Growth</div></th><td>10,050</td></tr>
        </table>''', 'html.parser').table
        original = str(table)
        with tempfile.TemporaryDirectory() as temp, patch.object(stock, 'CACHE_DIR', Path(temp)), \
             patch.object(stock, '_load_table', return_value=('Financials in millions CNY', table)):
            payload = stock.fetch_stockanalysis_financial_history({'id': 'byd', 'ticker': 'BYDDY'}, refresh=True)
        entry = payload['financials']['2026Q3']
        self.assertEqual(entry['revenueBn'], 221.488)
        self.assertEqual(entry['netIncomeBn'], 10.05)
        self.assertEqual(entry['revenueYoyPct'], 13.59)
        self.assertEqual(str(table), original)

    def test_missing_statement_rows_raise_source_error(self):
        table = BeautifulSoup('<table><tr><th>Fiscal Quarter</th><td>Q3 2026</td></tr><tr><th>Period Ending</th><td>Sep 30, 2026</td></tr></table>', 'html.parser').table
        with tempfile.TemporaryDirectory() as temp, patch.object(stock, 'CACHE_DIR', Path(temp)), \
             patch.object(stock, '_load_table', return_value=('Financials in millions CNY', table)):
            with self.assertRaisesRegex(RuntimeError, 'Missing revenue / net income'):
                stock.fetch_stockanalysis_financial_history({'id': 'byd', 'ticker': 'BYDDY'}, refresh=True)

    def test_empty_newest_column_does_not_count_as_released_results(self):
        payload = {'quarters': ['2026Q2', '2026Q3'], 'financials': {
            '2026Q2': {'revenueBn': 20, 'netIncomeBn': 1, 'periodEnd': '2026-06-30'},
            '2026Q3': {'revenueBn': None, 'netIncomeBn': None}}}
        with patch.object(checker, 'fetch_stockanalysis_financial_history', return_value=payload):
            self.assertEqual(checker.latest_remote_stockanalysis({})['quarter'], '2026Q2')


class ClassificationPolicyTests(unittest.TestCase):
    def detect(self, quarter='2026Q3', policy=True, official=''):
        local = {'id': 'byd', 'financials': {'2025Q4': {
            'revenueBn': 100, 'netIncomeBn': 10, 'officialRevenueSegments': [{'name': 'Products', 'valueBn': 100}]}}}
        if policy:
            local['classificationPolicy'] = {'displayOfficiallyClassifiedPeriodsOnly': True,
                                             'displayPeriodTypes': ['half-year', 'annual']}
        result = dict(needsUpdate=True, reason='new-quarter-detected', remoteQuarter=quarter,
                      remoteOfficialRevenueQuarter=official)
        with patch.object(watch, 'latest_native_release', return_value=None), \
             patch.object(watch, 'discover_release', return_value=None), \
             patch.object(checker, 'detect_company_update', return_value=result):
            return watch.detect({'id': 'byd', 'ticker': 'BYDDY'}, local)

    def test_quarterly_vendor_data_does_not_override_explicit_classified_period_policy(self):
        result = self.detect()
        self.assertFalse(result['needsUpdate'])
        self.assertEqual(result['reason'], 'outside-classified-reporting-period')

    def test_supported_periods_and_new_official_classifications_still_refresh(self):
        for args in ({'quarter': '2026Q2'}, {'quarter': '2026Q4'}, {'policy': False}, {'official': '2026Q2'}):
            with self.subTest(**args):
                self.assertTrue(self.detect(**args)['needsUpdate'])


class ChevronSegmentTests(unittest.TestCase):
    def setUp(self):
        self.html = (ROOT / 'tests/fixtures/chevron-2026q3-segment-table.html').read_text()
        templates = [{'name': name, 'memberKey': member, 'valueBn': 1} for name, member in
                     [('Upstream', 'upstream'), ('Downstream', 'downstream'), ('All Other Segments', 'allothersegments')]]
        self.payload = {'id': 'chevron', 'financials': {
            '2026Q2': {'revenueBn': 3, 'officialRevenueSegments': templates},
            '2026Q3': {'revenueBn': 67.798, 'netIncomeBn': 9.924, 'periodEnd': '2026-09-30',
                       'statementFilingDate': '2026-11-05', 'automaticEarnings': {'form': '10-Q'}}}}

    def test_current_segment_geography_columns_reconcile_to_reported_revenue(self):
        before = copy.deepcopy(self.payload['financials']['2026Q2'])
        enrich_complete_partition(self.payload, self.html, 'https://www.sec.gov/current-10q')
        self.assertEqual(chart_issues(self.payload), [])
        rows = self.payload['financials']['2026Q3']['officialRevenueSegments']
        self.assertEqual({r['memberKey']: r['valueBn'] for r in rows},
                         {'upstream': 19.805, 'downstream': 47.826, 'allothersegments': .167})
        self.assertTrue(all(r['filingDate'] == '2026-11-05' for r in rows))
        self.assertEqual(self.payload['financials']['2026Q2'], before)

    def test_wrong_period_units_and_inconsistent_subtotals_are_rejected(self):
        for html in (self.html.replace('September 30, 2026', 'June 30, 2026'),
                     self.html.replace('Three months', 'Nine months'),
                     self.html.replace('millions of dollars', 'unknown units'),
                     self.html.replace('13,660', '13,000')):
            with self.subTest(html=html[:150]):
                payload = copy.deepcopy(self.payload)
                enrich_complete_partition(payload, html, 'https://www.sec.gov/current-10q')
                self.assertNotIn('officialRevenueSegments', payload['financials']['2026Q3'])


class WatchSummaryTests(unittest.TestCase):
    def test_expected_period_policy_is_visible_without_hiding_real_failures(self):
        report = dict(checked=1, updatedCompanies=[], failedCompanies=[], deferredCompanies=[],
                      report=[dict(companyId='byd', remoteQuarter='2026Q3', reason='outside-classified-reporting-period')])
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / 'report.json'
            summary = Path(temp) / 'summary.md'
            for failed, expected in (([], 0), (['chevron'], 1)):
                report['failedCompanies'] = failed
                path.write_text(json.dumps(report))
                result = subprocess.run([sys.executable, str(ROOT / 'scripts/report_earnings_watch.py'), str(path)],
                                        capture_output=True, text=True, env={**os.environ, 'GITHUB_STEP_SUMMARY': str(summary)})
                self.assertEqual(result.returncode, expected)
                self.assertIn('::notice::byd', result.stdout)
                self.assertIn('half-year / annual', summary.read_text())


if __name__ == '__main__':
    unittest.main()
