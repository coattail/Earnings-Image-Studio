import copy
import json
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from scripts.revenue_growth import complete_company_revenue_growth, assert_revenue_growth_complete
from scripts import prepare_pages_artifact as pages

ROOT = Path(__file__).resolve().parents[1]

def fixture():
    def entry(value):
        return {'revenueBn':value,'officialRevenueSegments':[{'name':'Service','memberKey':'service','valueBn':value,'yoyPct':None,'qoqPct':None}]}
    return {'id':'sample','quarters':['2025Q3','2026Q2','2026Q3'],
            'financials':{'2025Q3':entry(80),'2026Q2':entry(100),'2026Q3':entry(120)}}

class GrowthPublicationTests(unittest.TestCase):
    def test_completion_preserves_amounts_and_reported_rates_and_is_idempotent(self):
        p=fixture();p['financials']['2026Q3']['officialRevenueSegments'][0]['yoyPct']=0
        before=copy.deepcopy(p)
        complete_company_revenue_growth(p)
        row=p['financials']['2026Q3']['officialRevenueSegments'][0]
        self.assertEqual(row['yoyPct'],0);self.assertEqual(row['qoqPct'],20)
        self.assertEqual(row['valueBn'],before['financials']['2026Q3']['officialRevenueSegments'][0]['valueBn'])
        self.assertEqual(complete_company_revenue_growth(p),[])
        assert_revenue_growth_complete(p)

    def test_unreliable_comparisons_stay_missing(self):
        for scenario in ['taxonomy','zero','suppressed','currency','inferred','mode','parent']:
            with self.subTest(scenario=scenario):
                p=fixture();f=p['financials'];r=f['2026Q3']['officialRevenueSegments'][0]
                if scenario=='taxonomy':f['2026Q2']['officialRevenueSegments'].append({'name':'New','valueBn':10})
                if scenario=='zero':f['2026Q2']['officialRevenueSegments'][0]['valueBn']=0
                if scenario=='suppressed':r['suppressQoQGrowth']=True
                if scenario=='currency':f['2026Q3']['statementCurrency']='USD';f['2026Q2']['statementCurrency']='KRW'
                if scenario=='inferred':r['inferredFromQuarter']='2026Q2'
                if scenario=='mode':r['metricMode']='gross-revenue-component'
                if scenario=='parent':
                    for e in f.values():e['officialRevenueDetailGroups']=e.pop('officialRevenueSegments')
                    f['2026Q3']['officialRevenueDetailGroups'][0]['targetId']='different'
                complete_company_revenue_growth(p)
                self.assertIsNone(r['qoqPct'])

    def test_index_and_release_reject_derivable_missing_rates(self):
        p=fixture()
        with self.assertRaisesRegex(ValueError,'sample.*missing comparable revenue growth'):
            pages.build_dataset_index_company(p)
        complete_company_revenue_growth(p)
        index=pages.build_dataset_index_company(p)
        self.assertEqual(set(index['financials']),{'2026Q3'})
        self.assertEqual(index['financials']['2026Q3']['officialRevenueSegments'][0]['yoyPct'],50)
        with tempfile.TemporaryDirectory() as directory:
            data=Path(directory);(data/'cache').mkdir()
            (data/'earnings-dataset.json').write_text(json.dumps({'companies':[p]}))
            (data/'cache/sample.json').write_text(json.dumps(fixture()))
            with patch.object(pages,'DATA_DIR',data):
                with self.assertRaisesRegex(ValueError,'sample'):pages.validate_public_revenue_growth()

    def test_finalizer_runs_after_manual_rows_without_structure_history(self):
        import sys
        sys.path.insert(0, str(ROOT/'scripts'))
        import build_dataset as builder
        p=fixture();p['errors']=[]
        result=builder.finalize_company_payload({'id':'sample','ticker':'SAMPLE'},p,{})
        row=result['financials']['2026Q3']['officialRevenueSegments'][0]
        self.assertEqual(row['qoqPct'],20)
        self.assertEqual(row['yoyPct'],50)

    def test_universe_and_cache_publication_are_complete(self):
        pages.validate_public_revenue_growth()

    def test_visa_latest_only_and_full_history_show_all_eight_growth_labels(self):
        index=json.loads((ROOT/'data/dataset-index.json').read_text())
        company=next(c for c in index['companies'] if c['id']=='visa')
        expected={'servicerevenues':(6.77,14.19),'dataprocessingrevenues':(3.36,15.78),
                  'internationaltransactionrevenues':(6.8,8.29),'otherrevenues':(10.09,40.05)}
        for row in company['financials']['2026Q3']['officialRevenueSegments']:
            self.assertEqual((row['qoqPct'],row['yoyPct']),expected[row['memberKey']])
        with tempfile.TemporaryDirectory() as directory:
            output=Path(directory);latest=output/'latest.json';latest.write_text(json.dumps(company))
            for payload in [latest,ROOT/'data/cache/visa.json']:
                for lang in ['zh','en']:
                    result=subprocess.run(['node',str(ROOT/'scripts/direct_chart_render.cjs'),'--payload',str(payload),'--quarter','2026Q3','--language',lang,'--modes','sankey','--output-dir',str(output)],cwd=ROOT,capture_output=True,text=True,check=True)
                    svg=Path(json.loads(result.stdout)['outputs']['sankey']['svg']).read_text()
                    for number in ['6.8','14.2','3.4','15.8','8.3','10.1','40.0']:
                        self.assertIn('+'+number+'%',svg)
                    self.assertIn('环比' if lang=='zh' else 'Q/Q',svg)
                    self.assertIn('同比' if lang=='zh' else 'Y/Y',svg)

if __name__=='__main__':unittest.main()
