"""Official revenue restatements survive rebuilds without replacing reported history."""
import json
from copy import deepcopy
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from build_dataset import apply_manual_company_override

QUARTERS = ['2024Q3', '2024Q4', '2025Q1', '2025Q2', '2025Q3', '2025Q4', '2026Q1', '2026Q2']


class MicrosoftSankeyRestatementTests(unittest.TestCase):
    def test_published_copies_and_manual_rebuild_keep_both_official_bases(self):
        manual = json.loads((ROOT / 'data/manual-company-overrides.json').read_text())
        cached = json.loads((ROOT / 'data/cache/microsoft.json').read_text())
        dataset = json.loads((ROOT / 'data/earnings-dataset.json').read_text())
        public = next(c for c in dataset['companies'] if c['id'] == 'microsoft')
        original = deepcopy(cached)
        for q in QUARTERS:
            del original['financials'][q]['officialRevenueRestatement']
        before = deepcopy(original)
        rebuilt = apply_manual_company_override(original, {'id': 'microsoft'}, manual)
        self.assertEqual(original, before)
        self.assertEqual(cached['quarters'], rebuilt['quarters'])
        for q in QUARTERS:
            expected = manual['microsoft']['financials'][q]['officialRevenueRestatement']
            for c in [cached, public, rebuilt]:
                with self.subTest(quarter=q, copy=c['id']):
                    entry = c['financials'][q]
                    self.assertEqual(entry['officialRevenueRestatement'], expected)
                    self.assertEqual({r['memberKey']: r['valueBn'] for r in entry['officialRevenueSegments']}, {r['memberKey']: r['valueBn'] for r in before['financials'][q]['officialRevenueSegments']})
                    self.assertEqual(len(entry['officialRevenueSegments']), 3)
                    for key in ['revenueBn', 'costOfRevenueBn', 'grossProfitBn', 'operatingExpensesBn', 'operatingIncomeBn', 'nonOperatingBn', 'taxBn', 'netIncomeBn']:
                        self.assertEqual(entry.get(key), before['financials'][q].get(key), key)
            for period, lag in [('qoq', 1), ('yoy', 4)]:
                i = QUARTERS.index(q)
                for row in expected['officialRevenueSegments'] + expected['officialRevenueDetailGroups']:
                    if i < lag:
                        self.assertIsNone(row[period + 'Pct'])
                    else:
                        self.assertEqual(row[period + 'ComparisonQuarter'], QUARTERS[i - lag])
                        self.assertEqual(row[period + 'Pct'], round((row['valueBn'] / row[period + 'ComparisonValueBn'] - 1) * 100, 2))
        self.assertEqual(cached['officialRevenueStructureHistory'], before['officialRevenueStructureHistory'])
        for q in [k for k in cached['financials'] if k not in QUARTERS]:
            self.assertNotIn('officialRevenueRestatement', cached['financials'][q])


if __name__ == '__main__':
    unittest.main()
