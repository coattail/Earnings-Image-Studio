import copy
import json
from pathlib import Path
import sys
import unittest

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from release_chart_completion import complete_current_chart,extract_partition
from release_chart_quality import chart_issues
from build_dataset import finalize_company_payload,TOP30_COMPANIES

class OfficialDisclosureCompletionTests(unittest.TestCase):
    def test_replay_current_official_tables_recovers_complete_classifications(self):
        fixtures=json.loads((ROOT/'tests/fixtures/automatic-release-classifications.json').read_text())
        self.assertEqual(len(fixtures),12)
        for fixture in fixtures:
            with self.subTest(company=fixture['company']):
                payload=copy.deepcopy(fixture['payload'])
                complete_current_chart(payload,{},documents=fixture['documents'])
                self.assertEqual(chart_issues(payload),[])
                entry=payload['financials'][max(payload['financials'])]
                actual={r['memberKey']:r['valueBn']for r in entry['officialRevenueSegments']}
                self.assertEqual(set(actual),{k for k,v in fixture['expected']})
                for member,value in fixture['expected']:self.assertAlmostEqual(actual[member],value,places=5)

    def test_does_not_assemble_a_partition_from_different_units_or_columns(self):
        entry={'revenueBn':120,'statementFilingDate':'2027-02-01'}
        templates=[{'name':'Products'},{'name':'Services'}]
        rows=[['Revenue','120000','100000'],['Products','80000','70000'],['Services','35000','40000']]
        self.assertIsNone(extract_partition(rows,templates,entry,'https://issuer.example/current'))
        rows[-1]=['Services','40000','35000']
        self.assertEqual([r['valueBn']for r in extract_partition(rows,templates,entry,'https://issuer.example/current')],[80,40])

    def test_finalization_does_not_restore_an_obsolete_static_classification(self):
        companies=json.loads((ROOT/'data/earnings-dataset.json').read_text())['companies']
        for cid in ['berkshire','samsung','alibaba']:
            with self.subTest(company=cid):
                c=copy.deepcopy(next(c for c in companies if c['id']==cid));q=max(c['financials'])
                before=[(r['memberKey'],r['valueBn'])for r in c['financials'][q]['officialRevenueSegments']]
                finalize_company_payload(next(c for c in TOP30_COMPANIES if c['id']==cid),c,{})
                self.assertEqual(chart_issues(c),[])
                self.assertEqual(before,[(r['memberKey'],r['valueBn'])for r in c['financials'][q]['officialRevenueSegments']])

if __name__=='__main__':unittest.main()
