"""Offline replays of November 2026 scheduled failures using official SEC tables."""
import copy
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
import build_dataset as build
import watch_earnings as watch
from earnings_release import parse_release
from release_chart_completion import enrich_complete_partition
from release_chart_quality import chart_issues

CHRN_URL = 'https://www.sec.gov/Archives/edgar/data/1549084/000149315226047278/ex99-1.htm'
BRK_URL = 'https://www.sec.gov/Archives/edgar/data/1067983/000119312526452412/brka-20260930.htm'


class ScheduledFailureReplays(unittest.TestCase):
    def test_chrn_total_net_loss_keeps_dollar_precision_and_excludes_discontinued_subtotal(self):
        html = (ROOT / 'tests/fixtures/chronoscale-q1-fy2027.html').read_text()
        entries = parse_release(html, {'id': 'chronoscale'}, CHRN_URL, '2026-10-15')
        current = entries['2026Q3']
        self.assertEqual(current['periodEnd'], '2026-08-31')
        self.assertEqual(current['revenueBn'], .041482)
        self.assertEqual(current['netIncomeBn'], -.042484)
        self.assertEqual(current['operatingIncomeBn'], -.024887)
        self.assertEqual(current['operatingExpensesBn'], .020741)
        self.assertEqual(current['officialOpexBreakdown'][0]['valueBn'], .020741)
        self.assertAlmostEqual(current['revenueBn'] - current['costOfRevenueBn'] - current['operatingExpensesBn'], current['operatingIncomeBn'])
        # A discontinued/continuing-operations subtotal cannot stand in for total net loss.
        self.assertEqual(parse_release(html.replace('<td>Net loss</td>', '<td>Unrelated total</td>'), {'id': 'chronoscale'}, CHRN_URL, '2026-10-15'), {})

    def test_cash_flow_net_loss_and_deferred_revenue_are_not_a_quarterly_statement(self):
        html = """<p>Condensed Consolidated Statements of Cash Flows (Dollars in thousands)</p><table>
        <tr><td>Three Months Ended</td></tr><tr><td>August 31, 2026</td><td>August 31, 2025</td></tr>
        <tr><td>CASH FLOW FROM OPERATING ACTIVITIES</td></tr>
        <tr><td>Net loss</td><td>(42,484)</td><td>(11,243)</td></tr>
        <tr><td>Deferred revenue</td><td>93</td><td>80</td></tr></table>"""
        self.assertEqual(parse_release(html, {'id':'sample'}, CHRN_URL, '2026-10-15'), {})

    def test_vendor_fast_path_recovers_official_q3_categories_before_returning(self):
        cached = json.loads((ROOT / 'data/cache/berkshire.json').read_text())
        # Keep the stable previous-quarter structure regardless of future data refreshes.
        cached['financials'] = {q:e for q,e in cached['financials'].items() if q <= '2026Q2'}
        cached['quarters'] = sorted(cached['financials'])
        before = copy.deepcopy(cached)
        entry = dict(calendarQuarter='2026Q3', periodEnd='2026-09-30', statementCurrency='USD',
                     revenueBn=105.647, netIncomeBn=22.112, statementFilingDate='2026-11-09', statementSourceUrl=BRK_URL)
        html = (ROOT / 'tests/fixtures/berkshire-q3-2026-revenue.html').read_text()
        def complete(payload, company):
            return enrich_complete_partition(payload, html, BRK_URL)
        with patch.object(build, 'load_existing_dataset_companies_by_id', return_value={'berkshire': cached}), \
             patch('earnings_release.supplement_cached_release', side_effect=copy.deepcopy), \
             patch.object(build, 'fetch_stockanalysis_financial_history', return_value={'financials': {'2026Q3': entry}}), \
             patch('release_chart_completion.complete_current_chart', side_effect=complete) as completion:
            result = build.build_incremental_company_payload_for_dataset({'id':'berkshire'}, manual_company_overrides={}, fx_cache={})
        completion.assert_called_once()
        self.assertEqual(chart_issues(result), [])
        actual = {r['memberKey']:r['valueBn'] for r in result['financials']['2026Q3']['officialRevenueSegments']}
        self.assertEqual(actual, dict(insurancecorporateother=26.862, pilottravelcentersllc=16.116, mclanecompany=12.130,
            manufacturingbusinesses=23.961, burlingtonnorthernsantafecorporation=6.868, berkshirehathawayenergycompany=7.766, serviceretailbusinesses=11.944))
        self.assertAlmostEqual(sum(actual.values()), 105.647)
        for q,e in before['financials'].items():
            self.assertEqual(result['financials'][q], e)
        self.assertEqual(cached, before)

    def test_transient_discovery_timeout_retries_once_but_contract_failures_do_not(self):
        from official_segments import REQUEST_DEADLINE
        from earnings_diagnostics import SourceContractError
        original = REQUEST_DEADLINE.get()
        with patch.object(watch, 'detect', side_effect=[TimeoutError('stalled index'), {'reason':'up-to-date'}]) as detect:
            self.assertEqual(watch.bounded_detect({}, {}, False)['discoveryAttempts'], 2)
            self.assertEqual(detect.call_count, 2)
        for error in [TimeoutError('still unavailable'), SourceContractError('missing row', 'https://issuer.example')]:
            with patch.object(watch, 'detect', side_effect=error) as detect:
                with self.assertRaises(type(error)):
                    watch.bounded_detect({}, {}, False)
                self.assertEqual(detect.call_count, 2 if isinstance(error, TimeoutError) else 1)
        self.assertEqual(REQUEST_DEADLINE.get(), original)

    def test_failed_daily_probe_remains_eligible_next_poll(self):
        from argparse import Namespace
        import tempfile
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            dataset = root / 'dataset.json'
            dataset.write_text(json.dumps({'companies': [{'id':'alibaba'}]}))
            args = Namespace(universe=None, companies='', dry_run=False, report_path=root/'report.json',
                             state_path=root/'state.json', budget_seconds=660)
            with patch.object(watch, 'TOP30_COMPANIES', [{'id':'alibaba','ticker':'BABA'}]), \
                 patch.object(watch.checker, 'DATASET_PATH', dataset), \
                 patch('earnings_windows.release_window', return_value=(False,'outside-company-earnings-window')), \
                 patch.object(watch, 'bounded_detect', side_effect=TimeoutError('still unavailable')) as detect:
                self.assertEqual(watch.run(args), 1)
                self.assertNotIn('lastCalendarCheck', json.loads(args.state_path.read_text())['alibaba'])
                self.assertEqual(watch.run(args), 1)
                self.assertEqual(detect.call_count, 2)


if __name__ == '__main__': unittest.main()
