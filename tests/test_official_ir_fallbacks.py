from datetime import date, datetime, timezone
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
import earnings_release as release
import native_earnings_watch as native
from generic_ir_pdf_parser import _entries_from_pdf_pages, _match_field
from release_chart_completion import enrich_pdf_partition


class FixedDate(date):
    @classmethod
    def today(cls): return cls(2026, 11, 4)


class OfficialIrFallbackTests(unittest.TestCase):
    def test_live_official_index_matches_its_already_parsed_pdf_without_archive_crawling(self):
        import watch_earnings as watch
        company = {'id':'alibaba','ticker':'BABA'}
        item = {'quarter':'2026Q2','filingDate':'2026-08-20','sourceUrl':'https://www.alibabagroup.com/en-US/document-current'}
        entry = {'revenueBn':100,'grossProfitBn':60,'operatingIncomeBn':30,'netIncomeBn':20,
                 'statementFilingDate':item['filingDate'],'statementSourceUrl':'https://data.alibabagroup.com/current.pdf',
                 'officialRevenueSegments':[{'name':'Business','valueBn':100}]}
        payload = {'financials':{'2026Q2':entry},'officialRevenueStructureHistory':{'filingsUsed':[
            {'quarter':'2026Q2','filingDate':item['filingDate'],'page':item['sourceUrl'],'pdf':entry['statementSourceUrl']}]}}
        with patch.object(watch,'latest_native_release',return_value=item), \
             patch.object(watch,'discover_release',return_value=None) as sec, \
             patch.object(watch.checker,'detect_company_update',return_value={'needsUpdate':False}) as archive:
            self.assertEqual(watch.detect(company,payload)['reason'],'up-to-date')
            sec.assert_not_called(); archive.assert_not_called()
            # A different official document must still be checked, even if its
            # quarter and publication date have not changed.
            item['sourceUrl'] += '-amended'
            watch.detect(company,payload)
            sec.assert_called_once(); archive.assert_called_once()

    def test_validated_release_partition_counts_without_a_legacy_history_rebuild(self):
        from check_for_updates import latest_local_revenue_structure_quarter
        entry = {'revenueBn':10,'netIncomeBn':1,'officialRevenueSegments':[{'name':'A','valueBn':10}],
                 'revenueClassificationSource':'official-complete-table','revenueClassificationSourceUrl':'https://issuer.example/current'}
        payload = {'officialRevenueStructureHistory':{'quarters':{'2026Q1':{}}},'financials':{'2026Q2':entry}}
        self.assertEqual(latest_local_revenue_structure_quarter(payload),'2026Q2')
        entry['officialRevenueSegments'][0]['valueBn'] = 5
        self.assertEqual(latest_local_revenue_structure_quarter(payload),'2026Q1')

    def test_blocked_ir_uses_only_same_date_sec_exhibit_for_the_requested_quarter(self):
        recent = dict(form=['6-K','6-K'], filingDate=['2026-11-03','2026-08-20'],
                      accessionNumber=['0000000001-26-000099','0000000001-26-000001'])
        html = (ROOT / 'tests/fixtures/netease-q2-2026-release.html').read_bytes()
        def request(url):
            if url.startswith('https://ir.example/'): raise RuntimeError('403 Forbidden')
            self.assertIn('/000000000126000001/', url)
            return html
        def metadata(url):
            if 'submissions' in url: return {'filings':{'recent':recent}}
            self.assertIn('/000000000126000001/', url)
            return {'directory':{'item':[{'name':'results-ex99-1.htm'}]}}
        with tempfile.TemporaryDirectory() as directory, patch.object(release,'CACHE',Path(directory)), \
             patch.object(release,'_request',side_effect=request), patch.object(release,'_request_json',side_effect=metadata):
            result = release.discover_ir_statement({'id':'netease','cik':1,'reportingCurrency':'CNY'},
                {'sourceUrl':'https://ir.example/blocked.pdf','quarter':'2026Q2','filingDate':'2026-08-20'})
        self.assertEqual(result['quarter'],'2026Q2')
        self.assertEqual(result['entry']['revenueBn'],30.106546)
        self.assertEqual(result['form'],'6-K')

    def test_ir_fallback_never_accepts_a_different_reporting_quarter(self):
        with patch.object(release,'_request',side_effect=RuntimeError('403')), \
             patch.object(release,'discover_release',return_value={'quarter':'2026Q1','entry':{'revenueBn':10,'netIncomeBn':1}}) as fallback:
            with self.assertRaisesRegex(RuntimeError,'403'):
                release.discover_ir_statement({'id':'sample'}, {'sourceUrl':'https://issuer.example/report.pdf','quarter':'2026Q2','filingDate':'2026-08-20'})
            fallback.assert_called_once_with({'id':'sample'}, expected_filing_date='2026-08-20', expected_quarter='2026Q2')

    def test_exchange_index_ignores_debt_notices_and_future_documents(self):
        html = b'''<a href="/listedco/listconews/sehk/2026/1103/202611030001.pdf">NOTICE OF LISTING</a>
        <a href="/listedco/listconews/sehk/2026/0828/2026082800435.pdf">ANNOUNCEMENT OF THE RESULTS FOR THE THREE AND SIX MONTHS ENDED JUNE 30, 2026</a>
        <a href="/listedco/listconews/sehk/2027/0301/2027030100435.pdf">ANNOUNCEMENT OF RESULTS FOR THE YEAR ENDED DECEMBER 31, 2026</a>'''
        with patch.object(native,'date',FixedDate), patch.object(native,'_exchange_day',return_value=FixedDate.today()), patch.object(native,'_request',return_value=html):
            result = native.latest_native_release({'id':'meituan','hkexStockId':198419})
        self.assertEqual(result['quarter'],'2026Q2')
        self.assertEqual(result['filingDate'],'2026-08-28')

    def test_current_calendar_index_avoids_missing_future_and_unneeded_old_archives(self):
        stamp = int(datetime(2026,8,20,tzinfo=timezone.utc).timestamp()*1000)
        payload = {'content':[{'documentTitle':'Alibaba Group Announces June Quarter 2026 Results','documentId':'current','eventDate':stamp}]}
        with patch.object(native,'date',FixedDate), patch.object(native,'_request_json',return_value=payload) as request:
            result = native.latest_native_release({'id':'alibaba','_localQuarter':'2026Q2'})
        self.assertEqual(result['quarter'],'2026Q2')
        request.assert_called_once_with('https://data.alibabagroup.com/data/index/ir/quarterly-results/q2026/list.json')

    def test_vendor_quarter_numbers_do_not_suppress_a_new_official_release(self):
        recent = dict(form=['10-Q','8-K'],filingDate=['2026-11-04','2026-11-03'],
            reportDate=['2026-09-26','2026-11-03'],items=['','2.02'],accessionNumber=['regular','release'])
        html = (ROOT/'tests/fixtures/amd-q3-2026-release.html').read_bytes()
        local = {'financials':{'2026Q3':{'revenueBn':13,'netIncomeBn':2,'statementFilingDate':'2026-09-26',
                                      'statementSourceUrl':'https://stockanalysis.com/stocks/sample/financials/'}}}
        def metadata(url):
            return {'filings':{'recent':recent}} if 'submissions' in url else {'directory':{'item':[{'name':'ex99.htm'}]}}
        with tempfile.TemporaryDirectory() as directory, patch.object(release,'CACHE',Path(directory)), \
             patch.object(release,'_request_json',side_effect=metadata), patch.object(release,'_request',return_value=html):
            result = release.discover_release({'id':'sample','cik':1},local)
        self.assertEqual(result['quarter'],'2026Q3')
        self.assertEqual(result['entry']['revenueBn'],13.377)

    def test_pdf_net_profit_does_not_reuse_a_pretax_profit_row(self):
        for label in ['Profit before income tax','Profit/(loss) before income tax']:
            self.assertEqual(_match_field(label),'pretaxIncome')
        self.assertEqual(_match_field('Profit for the period'),'netIncome')
        pages = json.loads((ROOT / 'tests/fixtures/meituan-q2-2026-pages.json').read_text())
        entries = _entries_from_pdf_pages(pages,'https://www1.hkexnews.hk/current.pdf','2026-08-28')
        self.assertEqual(entries['2026Q2']['netIncomeBn'],2.155)
        self.assertEqual(entries['2026Q2']['pretaxIncomeBn'],2.304)

    def test_pdf_segment_partition_uses_only_the_current_quarter_table(self):
        # Pass the same reported page text through the PDF reader interface.
        pages = json.loads((ROOT / 'tests/fixtures/meituan-q2-2026-pages.json').read_text())
        payload = {'id':'sample','financials':{'2026Q1':{'revenueBn':90,'officialRevenueSegments':[
            {'name':'Core Local Commerce','memberKey':'corelocalcommerce','valueBn':60},
            {'name':'New Initiatives','memberKey':'newinitiatives','valueBn':30}]},
            '2026Q2':{'periodEnd':'2026-06-30','revenueBn':104.643,'netIncomeBn':2.155,'statementFilingDate':'2026-08-28'}}}
        class Page:
            def __init__(self,text): self.text=text
            def extract_text(self): return self.text
        class Reader:
            def __init__(self,_): self.pages=[Page(p) for p in pages]
        with patch('pypdf.PdfReader',Reader):
            enrich_pdf_partition(payload,b'pdf','https://www1.hkexnews.hk/current.pdf')
        self.assertEqual([r['valueBn'] for r in payload['financials']['2026Q2']['officialRevenueSegments']], [71.530555,33.112489])
        self.assertNotIn('officialRevenueSegments',payload['financials'].get('2026Q3',{}))
