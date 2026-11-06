"""Source drift, retry persistence and failure isolation contracts."""
from argparse import Namespace
import copy
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
from earnings_diagnostics import SourceContractError, record_failure, clear_failure
import stockanalysis_financials as stock
import watch_earnings as watch

TABLE = '''<table>
<tr><th>Fiscal Quarter</th><td>Q3 2026</td><td>Q2 2026</td></tr>
<tr><th>Period Ending</th><td>Sep 30, 2026</td><td>Jun 30, 2026</td></tr>
<tr><th>Revenue</th><td>2000</td><td>1000</td></tr>
<tr><th>Net Income</th><td>100</td><td>50</td></tr>
</table>'''


class SourceDriftTests(unittest.TestCase):
    def test_invalid_source_never_overwrites_last_good_cache(self):
        cases = [
            ('units', 'Financials in billions USD', TABLE),
            ('dates', 'Financials in millions USD', TABLE.replace('<td>Jun 30, 2026</td>', '')),
            ('columns', 'Financials in millions USD', TABLE.replace('<td>1000</td>', '')),
            ('duplicate', 'Financials in millions USD', TABLE.replace('</table>', '<tr><td>Revenue</td><td>9</td><td>8</td></tr></table>')),
            ('empty', 'Financials in millions USD', TABLE.replace('2000', '—').replace('1000', '—')),
            ('nonfinite', 'Financials in millions USD', TABLE.replace('2000', 'NaN')),
            ('format', 'Financials in millions USD', TABLE.replace('2000', '2.0B')),
            ('percent', 'Financials in millions USD', TABLE.replace('2000', '20%')),
            ('dates-unparseable', 'Financials in millions USD', TABLE.replace('Sep 30, 2026', 'unknown').replace('Jun 30, 2026', 'unknown')),
        ]
        for name, heading, html in cases:
            with self.subTest(case=name), tempfile.TemporaryDirectory() as temp:
                cache = Path(temp) / 'sample.json'
                cache.write_text('last validated cache')
                table = BeautifulSoup(html, 'html.parser').table
                with patch.object(stock, 'CACHE_DIR', Path(temp)), patch.object(stock, '_load_table', return_value=(heading, table)):
                    with self.assertRaises(SourceContractError) as failure:
                        stock.fetch_stockanalysis_financial_history({'id': 'sample', 'ticker': 'SAMPLE'}, refresh=True)
                self.assertIn('stockanalysis.com', failure.exception.source_url)
                self.assertEqual(cache.read_text(), 'last validated cache')

    def test_empty_future_column_does_not_invalidate_valid_previous_period(self):
        html = TABLE.replace('2000', '—').replace('<td>100</td>', '<td>—</td>')
        with tempfile.TemporaryDirectory() as temp, patch.object(stock, 'CACHE_DIR', Path(temp)), \
             patch.object(stock, '_load_table', return_value=('Financials in millions USD', BeautifulSoup(html, 'html.parser').table)):
            payload = stock.fetch_stockanalysis_financial_history({'id': 'sample', 'ticker': 'SAMPLE'}, refresh=True)
        self.assertIsNone(payload['financials']['2026Q3']['revenueBn'])
        self.assertEqual(payload['financials']['2026Q2']['revenueBn'], 1)


class FailureStateTests(unittest.TestCase):
    def test_changed_release_resets_same_error_count_and_recovery_preserves_scheduler_state(self):
        state = {'sample': {'lastCalendarCheck': '2026-11-06', 'lastAttempt': 'attempt'}}
        item = dict(companyId='sample', remoteQuarter='2026Q3', remoteAccession='one')
        error = SourceContractError('missing row', 'https://issuer.example/report')
        for _ in range(3):
            record_failure(state, item, error, 'refresh', 'now')
        self.assertEqual(item['failure']['sameFailureCount'], 3)
        item['remoteAccession'] = 'two'
        record_failure(state, item, error, 'refresh', 'later')
        self.assertEqual(item['failure']['sameFailureCount'], 1)
        self.assertEqual(item['failure']['consecutiveFailures'], 4)
        clear_failure(state, 'sample')
        self.assertEqual(state['sample'], {'lastCalendarCheck': '2026-11-06', 'lastAttempt': 'attempt'})

    def test_discovery_failures_persist_across_runs_without_blocking_healthy_siblings(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            dataset = root / 'dataset.json'
            dataset.write_text(json.dumps({'companies': [{'id': 'a'}, {'id': 'b'}]}))
            args = Namespace(universe=None, companies='', dry_run=False, report_path=root / 'report.json',
                             state_path=root / 'state.json', budget_seconds=100)
            companies = [dict(id='a', ticker='A'), dict(id='b', ticker='B')]
            def detect(company, local, external):
                if company['id'] == 'a':
                    raise SourceContractError('missing row', 'https://issuer.example/a')
                return dict(companyId='b', ticker='B', needsUpdate=True, reason='new-quarter-detected')
            with patch.object(watch, 'TOP30_COMPANIES', companies), patch.object(watch.checker, 'DATASET_PATH', dataset), \
                 patch('earnings_windows.release_window', return_value=(True, 'active')), \
                 patch.object(watch, 'bounded_detect', side_effect=detect), patch.object(watch, 'refresh_one', return_value=[]) as refresh:
                for count in range(1, 4):
                    self.assertEqual(watch.run(args), 1)
                    report = json.loads(args.report_path.read_text())
                    self.assertEqual(report['failedCompanies'], ['a'])
                    self.assertEqual(report['updatedCompanies'], ['b'])
                    state = json.loads(args.state_path.read_text())
                    self.assertEqual(state['a']['failure']['sameFailureCount'], count)
                    self.assertEqual(state['a']['failure']['phase'], 'discovery')
                self.assertEqual([c.args[0]['companyId'] for c in refresh.call_args_list], ['b'] * 3)
            def healthy(company, *_args):
                return dict(companyId=company['id'], ticker=company['ticker'], needsUpdate=False, reason='up-to-date')
            with patch.object(watch, 'TOP30_COMPANIES', companies), patch.object(watch.checker, 'DATASET_PATH', dataset), \
                 patch('earnings_windows.release_window', return_value=(True, 'active')), patch.object(watch, 'bounded_detect', side_effect=healthy):
                self.assertEqual(watch.run(args), 0)
                self.assertNotIn('failure', json.loads(args.state_path.read_text())['a'])

    def test_refresh_failures_accumulate_while_attempt_order_is_preserved(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            dataset = root / 'dataset.json'
            dataset.write_text(json.dumps({'companies': [{'id': 'a'}]}))
            args = Namespace(universe=None, companies='', dry_run=False, report_path=root / 'report.json',
                             state_path=root / 'state.json', budget_seconds=100)
            args.state_path.write_text(json.dumps({'a': {'lastCalendarCheck': 'today'}}))
            detected = dict(companyId='a', ticker='A', needsUpdate=True, reason='new-quarter-detected', remoteQuarter='2026Q3')
            with patch.object(watch, 'TOP30_COMPANIES', [dict(id='a', ticker='A')]), patch.object(watch.checker, 'DATASET_PATH', dataset), \
                 patch('earnings_windows.release_window', return_value=(True, 'active')), \
                 patch.object(watch, 'bounded_detect', side_effect=lambda *_: copy.deepcopy(detected)), \
                 patch.object(watch, 'refresh_one', side_effect=ValueError('incomplete Sankey')):
                for count in range(1, 3):
                    self.assertEqual(watch.run(args), 1)
                    state = json.loads(args.state_path.read_text())['a']
                    self.assertEqual(state['failure']['sameFailureCount'], count)
                    self.assertEqual(state['failure']['phase'], 'refresh')
                    self.assertEqual(state['lastCalendarCheck'], 'today')
                    self.assertTrue(state['lastAttempt'])

    def test_summary_surfaces_repeated_failure_and_escapes_multiline_source_errors(self):
        item = dict(companyId='a', reason='check-failed')
        state = {}
        for _ in range(3):
            record_failure(state, item, SourceContractError('row|missing\n::notice::untrusted', 'https://issuer.example/a'), 'discovery', 'now')
        report = dict(checked=1, updatedCompanies=[], failedCompanies=['a'], deferredCompanies=[], report=[item])
        with tempfile.TemporaryDirectory() as temp:
            path, summary = Path(temp) / 'report.json', Path(temp) / 'summary.md'
            path.write_text(json.dumps(report))
            result = subprocess.run([sys.executable, str(ROOT / 'scripts/report_earnings_watch.py'), str(path)],
                                    capture_output=True, text=True, env={**os.environ, 'GITHUB_STEP_SUMMARY': str(summary)})
            self.assertEqual(result.returncode, 1)
            self.assertIn('same failure repeated 3 times', result.stdout)
            self.assertIn('%0A::notice::untrusted', result.stdout)
            self.assertIn('row\\|missing', summary.read_text())
            self.assertIn('https://issuer.example/a', summary.read_text())


if __name__ == '__main__':
    unittest.main()
