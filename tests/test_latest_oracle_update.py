import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PERIOD = '2026Q3'


class LatestOracleUpdateTests(unittest.TestCase):
    def test_release_is_consistent_across_latest_index_history_and_rebuild_source(self):
        dataset = json.loads((ROOT / 'data/earnings-dataset.json').read_text())
        company = next(c for c in dataset['companies'] if c['id'] == 'oracle')
        index = json.loads((ROOT / 'data/dataset-index.json').read_text())
        latest = next(c for c in index['companies'] if c['id'] == 'oracle')
        cache = json.loads((ROOT / 'data/cache/oracle.json').read_text())
        override = json.loads((ROOT / 'data/manual-company-overrides.json').read_text())['oracle']
        self.assertEqual(company['quarters'][-1], PERIOD)
        self.assertEqual(latest['latestQuarter'], PERIOD)
        q = company['financials'][PERIOD]
        self.assertEqual(q, latest['financials'][PERIOD])
        self.assertEqual(q, cache['financials'][PERIOD])
        for field, value in override['financials'][PERIOD].items():
            if not isinstance(value, list):
                self.assertEqual(q[field], value, field)
        self.assertEqual(q['fiscalLabel'], 'FY2027 Q1')
        self.assertEqual(q['periodEnd'], '2026-08-31')
        self.assertEqual(q['statementFilingDate'], '2026-09-10')
        self.assertEqual(q['revenueBn'], 19.345)
        self.assertEqual(q['operatingIncomeBn'], 6.728)
        self.assertEqual(q['netIncomeBn'], 4.760)  # GAAP, before preferred dividends.
        self.assertAlmostEqual(q['revenueYoyPct'], (19.345 / 14.926 - 1) * 100, places=3)
        self.assertAlmostEqual(q['netIncomeYoyPct'], (4.760 / 2.927 - 1) * 100, places=3)
        self.assertEqual(company['coverage']['classification']['blockers'], [])

    def test_revenue_and_profit_bridges_reconcile_without_double_counting_costs(self):
        q = json.loads((ROOT / 'data/cache/oracle.json').read_text())['financials'][PERIOD]
        for rows, total in [('officialRevenueSegments', 'revenueBn'), ('officialCostBreakdown', 'costOfRevenueBn'), ('officialOpexBreakdown', 'operatingExpensesBn')]:
            self.assertAlmostEqual(sum(r['valueBn'] for r in q[rows]), q[total], places=3)
        self.assertAlmostEqual(q['costOfRevenueBn'] + q['grossProfitBn'], q['revenueBn'], places=3)
        self.assertAlmostEqual(q['operatingExpensesBn'] + q['operatingIncomeBn'], q['grossProfitBn'], places=3)
        self.assertAlmostEqual(q['operatingExpensesBn'] + q['costOfRevenueBn'], 12.617, places=3)
        self.assertAlmostEqual(q['operatingIncomeBn'] + q['nonOperatingBn'] - q['taxBn'], q['netIncomeBn'], places=3)
        details = {r['memberKey']: r for r in q['officialRevenueDetailGroups']}
        self.assertAlmostEqual(details['softwarelicense']['valueBn'] + details['softwaresupport']['valueBn'], 5.550, places=3)
        for key, value, growth in [('cloudinfrastructure', 7.4, 121), ('cloudapplications', 4.2, 10)]:
            self.assertEqual(details[key]['valueBn'], value)
            self.assertEqual(details[key]['yoyPct'], growth)
            self.assertIn('round', details[key]['validationNotes'])


if __name__ == '__main__':
    unittest.main()
