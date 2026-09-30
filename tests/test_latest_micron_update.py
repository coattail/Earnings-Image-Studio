import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PERIOD = '2026Q3'


class LatestMicronUpdateTests(unittest.TestCase):
    def test_latest_index_and_all_rebuild_caches_agree_on_official_release(self):
        dataset = json.loads((ROOT / 'data/earnings-dataset.json').read_text())
        company = next(c for c in dataset['companies'] if c['id'] == 'micron')
        index = json.loads((ROOT / 'data/dataset-index.json').read_text())
        latest = next(c for c in index['companies'] if c['id'] == 'micron')
        cache = json.loads((ROOT / 'data/cache/micron.json').read_text())
        self.assertEqual(company['quarters'][-1], PERIOD)
        self.assertEqual(latest['latestQuarter'], PERIOD)
        q = company['financials'][PERIOD]
        self.assertEqual(q, latest['financials'][PERIOD])
        self.assertEqual(q, cache['financials'][PERIOD])
        official = json.loads((ROOT / 'data/cache/official-financials/micron.json').read_text())
        for field in ['revenueBn', 'operatingIncomeBn', 'netIncomeBn', 'taxBn', 'dilutedEps', 'operatingCashFlowBn', 'freeCashFlowBn']:
            self.assertEqual(q[field], official['financials'][PERIOD][field], field)
        self.assertEqual(q['fiscalLabel'], 'FY2026 Q4')
        self.assertEqual(q['periodEnd'], '2026-09-03')
        self.assertEqual(q['statementFilingDate'], '2026-09-30')
        self.assertEqual(q['parserFinancialValidation']['issues'], [])
        self.assertEqual(company['coverage']['classification']['blockers'], [])
        for path in ['official-segments', 'official-revenue-structures']:
            payload = json.loads((ROOT / f'data/cache/{path}/micron.json').read_text())['quarters'][PERIOD]
            rows = payload['segments'] if isinstance(payload, dict) else payload
            self.assertEqual([r['valueBn'] for r in rows], [16.283, 18.002, 13.114, 6.824])

    def test_quarterly_flows_reconcile_to_reported_annual_totals_and_gaap_bridge(self):
        c = json.loads((ROOT / 'data/cache/micron.json').read_text())
        periods = ['2025Q4', '2026Q1', '2026Q2', PERIOD]
        for field, total in {'revenueBn': 133.188, 'operatingIncomeBn': 99.340, 'netIncomeBn': 84.969}.items():
            self.assertAlmostEqual(sum(c['financials'][p][field] for p in periods), total, places=3)
        q = c['financials'][PERIOD]
        self.assertAlmostEqual(q['costOfRevenueBn'] + q['grossProfitBn'], q['revenueBn'], places=3)
        self.assertAlmostEqual(sum(r['valueBn'] for r in q['officialOpexBreakdown']) + q['operatingIncomeBn'], q['grossProfitBn'], places=3)
        self.assertAlmostEqual(q['pretaxIncomeBn'] - q['taxBn'] + q['equityMethodIncomeBn'], q['netIncomeBn'], places=3)
        self.assertAlmostEqual(q['revenueYoyPct'], (54.229 / 11.315 - 1) * 100, places=3)


if __name__ == '__main__':
    unittest.main()
