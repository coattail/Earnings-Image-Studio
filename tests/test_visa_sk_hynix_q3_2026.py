import json
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PERIOD = '2026Q3'

class VisaSkHynixQuarterTests(unittest.TestCase):
    def test_latest_dataset_index_cache_and_persistent_overrides_agree(self):
        dataset = json.loads((ROOT/'data/earnings-dataset.json').read_text())
        index = json.loads((ROOT/'data/dataset-index.json').read_text())
        overrides = json.loads((ROOT/'data/manual-company-overrides.json').read_text())
        for cid, label, revenue, operating, net in [('visa','FY2026 Q4',12.139,7.262,6.002),('sk-hynix','FY2026 Q3',104615.5,83333.8,39775.6)]:
            with self.subTest(company=cid):
                company = next(c for c in dataset['companies'] if c['id']==cid)
                latest = next(c for c in index['companies'] if c['id']==cid)
                cache = json.loads((ROOT/f'data/cache/{cid}.json').read_text())
                q = company['financials'][PERIOD]
                self.assertEqual(company['quarters'][-1],PERIOD)
                self.assertEqual(latest['latestQuarter'],PERIOD)
                self.assertEqual(q,latest['financials'][PERIOD])
                self.assertEqual(q,cache['financials'][PERIOD])
                self.assertEqual(q['fiscalLabel'],label)
                self.assertEqual(q['periodEnd'],'2026-09-30')
                self.assertEqual(q['revenueBn'],revenue)
                self.assertEqual(q['operatingIncomeBn'],operating)
                self.assertEqual(q['netIncomeBn'],net)
                for field in ['revenueBn','operatingIncomeBn','netIncomeBn','taxBn']:
                    self.assertEqual(q[field],overrides[cid]['financials'][PERIOD][field])
                self.assertEqual(company['coverage']['classification']['blockers'],[])

    def test_source_currency_bridges_and_product_mix_are_auditable(self):
        v=json.loads((ROOT/'data/cache/visa.json').read_text())['financials'][PERIOD]
        self.assertAlmostEqual(v['grossProfitBn']-v['operatingExpensesBn'],v['operatingIncomeBn'],places=6)
        self.assertAlmostEqual(v['operatingIncomeBn']+v['nonOperatingBn']-v['taxBn'],v['netIncomeBn'],places=6)
        self.assertAlmostEqual(sum(x['valueBn'] for x in v['officialRevenueSegments'])-v['clientIncentivesBn'],v['revenueBn'],places=6)
        self.assertEqual(v['dilutedEps'],3.19)
        sk=json.loads((ROOT/'data/cache/sk-hynix.json').read_text())['financials'][PERIOD]
        self.assertLessEqual(abs(sk['revenueBn']-sk['costOfRevenueBn']-sk['grossProfitBn']),1)
        self.assertLessEqual(abs(sk['pretaxIncomeBn']-sk['taxBn']-sk['netIncomeBn']),1)
        self.assertAlmostEqual(sk['grossProfitBn']-sk['operatingExpensesBn'],sk['operatingIncomeBn'],places=5)
        self.assertLess(sk['nonOperatingBn'],0)
        self.assertFalse(sk.get('positiveAdjustments'))
        self.assertEqual([r['mixPct'] for r in sk['officialRevenueSegments']],[75,24,1])
        self.assertAlmostEqual(sum(r['valueBn'] for r in sk['officialRevenueSegments']),sk['revenueBn'],places=3)
        self.assertIn('round',sk['statementPrecisionNote'].lower())
        self.assertEqual(sk['statementCurrency'],'KRW')
        self.assertEqual(sk['displayCurrency'],'USD')

    def test_latest_quarters_render_both_chart_modes(self):
        for cid in ['visa','sk-hynix']:
            with self.subTest(company=cid), tempfile.TemporaryDirectory() as directory:
                result=subprocess.run(['node',str(ROOT/'scripts/direct_chart_render.cjs'),'--payload',str(ROOT/f'data/cache/{cid}.json'),'--quarter',PERIOD,'--language','zh','--modes','sankey,bars','--output-dir',directory],cwd=ROOT,check=True,capture_output=True,text=True)
                outputs=json.loads(result.stdout)['outputs']
                self.assertEqual(set(outputs),{'sankey','bars'})
                for value in outputs.values():
                    svg=Path(value['svg']).read_text()
                    self.assertNotIn('NaN',svg)
                    self.assertNotIn('undefined',svg)
                    self.assertIn('<svg',svg)
                self.assertGreaterEqual(outputs['bars']['quarterCount'],30)

if __name__=='__main__':unittest.main()
