"""Replay the FY2027 Q3 earnings 8-K before its 10-Q is available."""
import copy
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from earnings_release import earnings_exhibit_names, parse_release
from release_chart_completion import complete_current_chart, enrich_complete_partition
from release_chart_quality import chart_issues

BASE = 'https://www.sec.gov/Archives/edgar/data/1045810/000104581026000088/'
STATEMENT = BASE + 'supplementalfinancialinfor.htm'
CFO = BASE + 'q3fy27cfocommentary.htm'
FILED = '2026-11-17'


def fixture():
    prior = json.loads((ROOT / 'data/cache/nvidia.json').read_text())['financials']['2026Q3']
    html = (ROOT / 'tests/fixtures/nvidia-fy2027-q3-supplement.html').read_text()
    entry = parse_release(html, {'id':'nvidia'}, STATEMENT, FILED)['2026Q4']
    entry.update(fiscalYear='2027', fiscalQuarter='Q3', fiscalLabel='FY2027 Q3',
                 automaticEarnings={'form':'8-K','accession':'0001045810-26-000088','filingDate':FILED})
    return {'id':'nvidia','financials':{'2026Q3':prior,'2026Q4':entry}}


class NvidiaReleaseCompletionTests(unittest.TestCase):
    def test_same_filing_cfo_exhibit_completes_the_real_statement_without_a_10q(self):
        payload = fixture()
        before = copy.deepcopy(payload['financials']['2026Q3'])
        index = {'directory':{'item':[{'name':name} for name in
                 ['nvda-20261117.htm','q3fy27cfocommentary.htm','supplementalfinancialinfor.htm']]}}
        responses = {STATEMENT:(ROOT / 'tests/fixtures/nvidia-fy2027-q3-supplement.html').read_bytes(),
                     CFO:(ROOT / 'tests/fixtures/nvidia-fy2027-q3-cfo.html').read_bytes()}
        with patch('official_segments._request', side_effect=lambda url:responses[url]) as request, \
             patch('earnings_release._request_json', return_value=index) as request_json:
            complete_current_chart(payload, {'id':'nvidia','cik':1045810})
        request_json.assert_called_once_with(BASE + 'index.json')
        self.assertEqual([call.args[0] for call in request.call_args_list], [STATEMENT, CFO])
        self.assertEqual(chart_issues(payload), [])
        self.assertEqual(payload['financials']['2026Q3'], before)
        current = payload['financials']['2026Q4']
        self.assertEqual(current['fiscalLabel'], 'FY2027 Q3')
        for field, value in dict(revenueBn=115.844, costOfRevenueBn=29.168, grossProfitBn=86.676,
                                 operatingExpensesBn=9.156, operatingIncomeBn=77.520,
                                 pretaxIncomeBn=79.017, nonOperatingBn=1.497, taxBn=13.730,
                                 netIncomeBn=65.287).items():
            self.assertAlmostEqual(current[field], value, places=6, msg=field)
        self.assertEqual({r['memberKey']:r['valueBn'] for r in current['officialRevenueSegments']},
                         {'datacenter':107.6,'edgecomputing':8.2})
        self.assertEqual({r['memberKey']:r['valueBn'] for r in current['officialRevenueDetailGroups']},
                         {'hyperscale':60.1,'aicloudsindustrialenterprise':47.5})
        hyperscale = current['officialRevenueDetailGroups'][0]
        self.assertEqual((hyperscale['qoqPct'], hyperscale['yoyPct']), (23, 71))
        for row in current['officialRevenueSegments'] + current['officialRevenueDetailGroups']:
            self.assertEqual(row['sourceUrl'], CFO)
            self.assertEqual(row['filingDate'], FILED)
            self.assertEqual(row['reportedPrecisionBn'], .1)
        self.assertAlmostEqual(sum(r['valueBn'] for r in current['officialRevenueSegments']), 115.8)
        self.assertEqual(current['statementSourceUrl'], STATEMENT)

    def test_wrong_fiscal_period_unknown_units_and_incomplete_partitions_remain_pending(self):
        html = (ROOT / 'tests/fixtures/nvidia-fy2027-q3-cfo.html').read_text()
        for invalid in [html.replace('Q3 FY27','Q2 FY27'), html.replace('in billions','in millions'),
                        html.replace('Hyperscale','Unrelated'), html.replace('47.5','40.0'),
                        html.replace('$115.8','$115.7'), html.replace('$107.6','$97.6')]:
            with self.subTest(content=invalid[-80:]):
                payload = fixture()
                enrich_complete_partition(payload, invalid, CFO)
                self.assertTrue(chart_issues(payload))
        # Even a matching rounded revenue cannot legalize a wrong fiscal column.
        payload = fixture()
        payload['financials']['2026Q4']['revenueBn'] = 115.8
        enrich_complete_partition(payload, html.replace('Q3 FY27','Q2 FY27'), CFO)
        self.assertTrue(chart_issues(payload))

    def test_named_cfo_and_press_exhibits_are_discovered_with_the_statement(self):
        names = ['nvda-20261117.htm','q3fy27cfocommentary.htm','q3fy27pr.htm',
                 'supplementalfinancialinfor.htm','nvdalogo.jpg','FilingSummary.xml']
        index = {'directory':{'item':[{'name':name} for name in names]}}
        self.assertEqual(earnings_exhibit_names(index, primary_document=names[0]), names[1:4])


if __name__ == '__main__':
    unittest.main()
