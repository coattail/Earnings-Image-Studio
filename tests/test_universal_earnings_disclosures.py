"""Issuer-independent regressions for unknown filenames and repeated failures."""
from argparse import Namespace
import copy
from datetime import datetime, timezone
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
import earnings_release as release
import watch_earnings as watch
from build_dataset import TOP30_COMPANIES
from release_chart_completion import enrich_complete_partition, complete_current_chart
from release_chart_quality import chart_issues
from tests.test_earnings_watch import statement


class UniversalDisclosureTests(unittest.TestCase):
    def test_sec_document_types_find_arbitrary_filenames_before_irrelevant_files(self):
        names = ['main.htm','R1.htm','0000000001-26-000001-index.html',
                 *[f'a{i}.htm' for i in range(20)],'z-opaque.pdf','../outside.htm','logo.png']
        index = {'directory':{'item':[{'name':name} for name in names]}}
        manifest = '<table><tr><td>Quarterly financial results</td><td><a href="z-opaque.pdf">Document</a></td><td>EX-99.2</td></tr></table>'
        found = release.earnings_exhibit_names(index, manifest, 'main.htm')
        self.assertEqual(found[0], 'z-opaque.pdf')
        self.assertLessEqual(len(found), release.MAX_EARNINGS_EXHIBITS)
        self.assertFalse(set(found) & {'main.htm','R1.htm','0000000001-26-000001-index.html','../outside.htm','logo.png'})
        self.assertIn('opaque.htm', release.earnings_exhibit_names({'directory':{'item':[{'name':'opaque.htm'}]}}))

    def test_every_tracked_issuer_can_recover_after_a_broken_opaque_exhibit(self):
        recent = dict(form=['8-K'],items=['2.02'],filingDate=['2026-11-02'],
                      accessionNumber=['0000000001-26-000001'],primaryDocument=['main.htm'])
        index = {'directory':{'item':[{'name':n} for n in ['main.htm','a.pdf','z-opaque.htm']]}}
        def request(url):
            return {'filings':{'recent':recent}} if 'submissions' in url else index
        def content(url):
            if url.endswith('a.pdf'): raise TimeoutError('Temporary attachment outage')
            return statement().encode()
        for company in TOP30_COMPANIES:
            with self.subTest(company=company['id']), tempfile.TemporaryDirectory() as directory, \
                 patch.object(release,'CACHE',Path(directory)),patch.object(release,'_request_json',side_effect=request), \
                 patch.object(release,'_request',side_effect=content):
                result=release.discover_release({**company,'cik':1},expected_filing_date='2026-11-02')
                self.assertEqual(result['quarter'],'2026Q3')
                self.assertTrue(result['entry']['statementSourceUrl'].endswith('z-opaque.htm'))
                self.assertIn('outage', result['documentWarnings'][0]['error'])

    def test_corrupt_pdf_and_broken_inventory_fall_back_to_healthy_statement(self):
        recent=dict(form=['8-K'],items=['2.02'],filingDate=['2026-11-02'],
                    accessionNumber=['0000000001-26-000001'],primaryDocument=['main.htm'])
        names=['0000000001-26-000001-index.html','a.pdf','z-opaque.htm']
        index={'directory':{'item':[{'name':n} for n in names]}}
        def content(url):
            if url.endswith('-index.html'): raise TimeoutError('Index unavailable')
            return b'not a PDF' if url.endswith('a.pdf') else statement().encode()
        with tempfile.TemporaryDirectory() as directory,patch.object(release,'CACHE',Path(directory)), \
             patch.object(release,'_request_json',side_effect=lambda url:{'filings':{'recent':recent}} if 'submissions' in url else index), \
             patch.object(release,'_request',side_effect=content):
            result=release.discover_release({'id':'unknown','ticker':'UNKNOWN','cik':1},expected_filing_date='2026-11-02')
        self.assertEqual(result['entry']['revenueBn'],1.2)
        self.assertEqual(len(result['documentWarnings']),2)

    def test_foreign_issuer_primary_6k_statement_is_not_excluded(self):
        recent=dict(form=['6-K'],filingDate=['2026-11-02'],accessionNumber=['0000000001-26-000001'],primaryDocument=['opaque.htm'])
        index={'directory':{'item':[{'name':'opaque.htm'}]}}
        with tempfile.TemporaryDirectory() as directory,patch.object(release,'CACHE',Path(directory)), \
             patch.object(release,'_request_json',side_effect=lambda url:{'filings':{'recent':recent}} if 'submissions' in url else index), \
             patch.object(release,'_request',return_value=statement().encode()):
            result=release.discover_release({'id':'foreign','ticker':'FOREIGN','cik':1},expected_filing_date='2026-11-02')
        self.assertEqual(result['quarter'],'2026Q3')
        self.assertEqual(result['form'],'6-K')

    def test_generic_fiscal_precision_and_column_order_are_independent_of_issuer(self):
        html='''<table><tr><td>Revenue by category</td></tr>
        <tr><td>($ in billions)</td><td>Q2 FY28</td><td>Q3 FY28</td><td>Q3 FY27</td><td>Q/Q</td><td>Y/Y</td></tr>
        <tr><td>Devices</td><td>60.0</td><td>70.1</td><td>50.0</td><td>17%</td><td>40%</td></tr>
        <tr><td>Services</td><td>30.0</td><td>45.7</td><td>40.0</td><td>52%</td><td>14%</td></tr>
        <tr><td>Total</td><td>90.0</td><td>115.8</td><td>90.0</td></tr></table>'''
        for company in TOP30_COMPANIES:
            payload={'id':company['id'],'financials':{'2027Q2':dict(revenueBn=90,officialRevenueSegments=[
                dict(name='Devices',memberKey='devices',valueBn=60),dict(name='Services',memberKey='services',valueBn=30)]),
                '2027Q3':dict(revenueBn=115.844,netIncomeBn=20,periodEnd='2027-09-30',fiscalYear='2028',fiscalQuarter='Q3',fiscalLabel='FY2028 Q3')}}
            with self.subTest(company=company['id']):
                enrich_complete_partition(payload,html,'https://issuer.example/disclosure')
                self.assertEqual([r['valueBn'] for r in payload['financials']['2027Q3']['officialRevenueSegments']],[70.1,45.7])
                self.assertEqual(payload['financials']['2027Q3']['revenueBn'],115.844)

    def test_conflicting_same_calendar_quarter_statement_cannot_replace_the_period(self):
        payload={'id':'sample','financials':{'2026Q3':dict(periodEnd='2026-09-30',revenueBn=4,netIncomeBn=1)}}
        before=copy.deepcopy(payload['financials'])
        complete_current_chart(payload,{},documents=[('https://issuer.example/wrong-period',statement(),'2026-11-02')])
        entry=payload['financials']['2026Q3']
        self.assertEqual(entry['periodEnd'],before['2026Q3']['periodEnd'])
        self.assertEqual(entry['revenueBn'],4)
        self.assertIn('period differs',entry['chartCompletionAttempts'][0]['error'])

    def test_failed_and_pending_issuers_retry_after_daily_probe_and_outside_window(self):
        for failure in ({'failure':{'sameFailureCount':3}}, {'pendingDetails':True}):
            with self.subTest(state=failure),tempfile.TemporaryDirectory() as directory:
                root=Path(directory);dataset=root/'dataset.json'
                dataset.write_text(json.dumps({'companies':[{'id':'sample'}]}))
                args=Namespace(universe=None,companies='',dry_run=False,report_path=root/'report.json',
                               state_path=root/'state.json',budget_seconds=100)
                args.state_path.write_text(json.dumps({'sample':{'lastCalendarCheck':datetime.now(timezone.utc).date().isoformat(),**failure}}))
                with patch.object(watch,'TOP30_COMPANIES',[{'id':'sample','ticker':'TEST'}]), \
                     patch.object(watch.checker,'DATASET_PATH',dataset),patch('earnings_windows.release_window',return_value=(False,'outside')), \
                     patch.object(watch,'bounded_detect',return_value={'companyId':'sample','needsUpdate':True,'reason':'earnings-release-detected'}) as detect, \
                     patch.object(watch,'refresh_one',return_value=[]) as refresh:
                    self.assertEqual(watch.run(args),0)
                    detect.assert_called_once();refresh.assert_called_once()


if __name__=='__main__': unittest.main()
