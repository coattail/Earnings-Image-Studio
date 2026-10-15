import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class LatestTsmcUpdateTests(unittest.TestCase):
    def test_q3_is_published_consistently_with_official_sources(self):
        dataset = json.loads((ROOT / 'data/earnings-dataset.json').read_text())
        company = next(c for c in dataset['companies'] if c['id'] == 'tsmc')
        latest = next(c for c in json.loads((ROOT / 'data/dataset-index.json').read_text())['companies'] if c['id'] == 'tsmc')
        cache = json.loads((ROOT / 'data/cache/tsmc.json').read_text())
        override = json.loads((ROOT / 'data/manual-company-overrides.json').read_text())['tsmc']
        q = company['financials']['2026Q3']
        self.assertEqual(company['quarters'][-1], '2026Q3')
        self.assertEqual(latest['latestQuarter'], '2026Q3')
        self.assertEqual(q, latest['financials']['2026Q3'])
        self.assertEqual(q, cache['financials']['2026Q3'])
        self.assertEqual(q['statementFilingDate'], '2026-10-15')
        self.assertEqual(q['periodEnd'], '2026-09-30')
        self.assertEqual(q['revenueBn'], 1494.243)
        self.assertEqual(q['operatingIncomeBn'], 876.445)
        self.assertEqual(q['netIncomeBn'], 763.064)
        self.assertAlmostEqual(q['revenueBn'] * q['displayScaleFactor'], 46.720)
        for field in ('revenueBn', 'costOfRevenueBn', 'operatingIncomeBn', 'taxBn', 'netIncomeBn'):
            self.assertEqual(q[field], override['financials']['2026Q3'][field])
            self.assertIn('manual', q['fieldSources'][field]['adapterId'])
        self.assertEqual(company['coverage']['classification']['latestQuarter'], '2026Q3')
        self.assertEqual(company['coverage']['classification']['blockers'], [])

    def test_reported_costs_and_platform_shares_reconcile(self):
        q = json.loads((ROOT / 'data/cache/tsmc.json').read_text())['financials']['2026Q3']
        self.assertAlmostEqual(q['costOfRevenueBn'] + q['grossProfitBn'], q['revenueBn'])
        self.assertAlmostEqual(q['operatingExpensesBn'] + q['operatingIncomeBn'], q['grossProfitBn'])
        self.assertAlmostEqual(q['rndBn'] + q['sgnaBn'] - .502, q['operatingExpensesBn'])
        # The source separately reports NT$277m attributable to noncontrolling interests.
        self.assertAlmostEqual(q['pretaxIncomeBn'] - q['taxBn'] - .277, q['netIncomeBn'])
        segments = q['officialRevenueSegments']
        self.assertEqual([r['mixPct'] for r in segments], [68, 21, 4, 4, 1, 2])
        self.assertEqual([r['qoqPct'] for r in segments], [22, 10, 5, 23, -12, -10])
        self.assertAlmostEqual(sum(r['valueBn'] for r in segments), q['revenueBn'])
        self.assertTrue(all(r['filingDate'] == '2026-10-15' for r in segments))


if __name__ == '__main__':
    unittest.main()
