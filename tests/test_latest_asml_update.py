import json
import subprocess
from argparse import Namespace
from copy import deepcopy
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
import official_financials as official
import build_dataset as build
import check_for_updates as check

SOURCE = 'https://investor.asml.com/static-files/d310262b-d037-485d-83b5-92c93cc462f0'
TEXT = (ROOT / 'tests/fixtures/asml-q3-2026-operations.txt').read_text()


class LatestAsmlUpdateTests(unittest.TestCase):
    def test_parser_uses_current_quarter_not_nine_month_total(self):
        quarter, q = official._parse_asml_pdf_financial_page(TEXT, '2026-10-14', SOURCE, 'EUR', '2026Q3')
        self.assertEqual(quarter, '2026Q3')
        self.assertEqual(q['periodEnd'], '2026-09-27')
        self.assertEqual(q['revenueBn'], 11.662)
        self.assertEqual(q['operatingIncomeBn'], 5.173)
        self.assertEqual(q['netIncomeBn'], 4.96)
        self.assertEqual(q['nonOperatingBn'], .578)
        self.assertEqual(q['equityMethodIncomeBn'], .135)

    def test_full_sec_statement_accepts_modern_tax_label(self):
        html = '<table>' + ''.join('<tr><td>' + line + '</td></tr>' for line in TEXT.splitlines()) + '</table>'
        # Use real table columns rather than a single text cell for financial rows.
        import re
        html = '<table>' + ''.join('<tr>' + ''.join('<td>' + cell + '</td>' for cell in re.split(r' (?=[(]?[0-9][0-9,]*[.][0-9])', line)) + '</tr>' for line in TEXT.splitlines()) + '</table>'
        parsed = official._parse_asml_release(html, '2026-10-14', SOURCE, 'EUR')
        self.assertIsNotNone(parsed)
        self.assertEqual(parsed[1]['operatingIncomeBn'], 5.173)
        self.assertEqual(parsed[1]['taxBn'], .925)
        self.assertEqual(parsed[1]['periodEnd'], '2026-09-27')

    def test_ir_page_supports_extensionless_download_and_skips_archive(self):
        html = '''<h2>Q3 2026 financial results</h2><p>ASML announced results on October 14, 2026.</p>
        <a href="/static-files/current">Financial statements US GAAP PDF</a>
        <h2>Quarterly results archive</h2><a href="/static-files/old">Financial statements US GAAP PDF</a>'''
        page = type('Page', (), {'extract_text': lambda self: TEXT})()
        reader = type('Reader', (), {'pages': [page]})()
        with patch.object(official, '_request_bytes_resilient', side_effect=[html.encode(), b'pdf']) as request, patch.object(official, 'PdfReader', return_value=reader):
            result = official._load_asml_ir_financials('EUR')
        self.assertEqual(result['2026Q3']['netIncomeBn'], 4.96)
        self.assertEqual(request.call_args_list[-1].args[0], 'https://investor.asml.com/static-files/current')

    def test_incomplete_existing_quarter_retries_without_waiting_for_new_filing(self):
        payload = {'quarters': ['2026Q3'], 'financials': {'2026Q3': {'revenueBn': 11.662}}}
        with patch.object(check, 'load_local_company_payload', return_value=payload), patch.object(check, 'latest_remote_sec_filing') as remote:
            result = check.detect_company_update({'id': 'asml', 'ticker': 'ASML'})
        self.assertTrue(result['needsUpdate'])
        self.assertEqual(result['reason'], 'incomplete-financials')
        remote.assert_not_called()

    def test_official_ir_detects_next_quarter_before_sec_is_available(self):
        payload = {'quarters': ['2026Q2'], 'financials': {'2026Q2': {
            'revenueBn': 9.326, 'grossProfitBn': 5.035, 'operatingIncomeBn': 3.456, 'netIncomeBn': 2.918}}}
        with patch.object(check, 'load_local_company_payload', return_value=payload), patch.object(check, 'discover_asml_ir_release', return_value={'quarter': '2026Q3', 'filingDate': '2026-10-14'}), patch.object(check, 'latest_remote_sec_filing') as sec:
            result = check.detect_company_update({'id': 'asml', 'ticker': 'ASML'})
        self.assertTrue(result['needsUpdate'])
        sec.assert_not_called()

    def test_incremental_refresh_reads_official_asml_financials(self):
        company = {'id': 'asml', 'ticker': 'ASML'}
        with patch.object(build, 'fetch_official_financial_history') as official_fetch, patch.object(build, 'fetch_stockanalysis_financial_history') as third_party, patch.object(build, 'build_company_payload_for_dataset', return_value={}):
            build.build_incremental_company_payload_for_dataset(company, manual_company_overrides={}, fx_cache={})
        official_fetch.assert_called_once_with(company, refresh=True)
        third_party.assert_not_called()

    def test_incremental_cli_bypasses_stale_company_cache(self):
        company = next(c for c in build.TOP30_COMPANIES if c['id'] == 'asml')
        payload = json.loads((ROOT / 'data/cache/asml.json').read_text())
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            with patch.object(build, 'TOP30_COMPANIES', [company]), patch.object(build, 'parse_args', return_value=Namespace(refresh=False, incremental_refresh=True, cache_supplement_only=False, companies='asml')), patch.object(build, 'load_existing_dataset_companies_by_id', return_value={'asml': deepcopy(payload)}), patch.object(build, 'load_cached_company_payload') as stale, patch.object(build, 'build_incremental_company_payload_for_dataset', return_value=deepcopy(payload)) as fetch, patch.object(build, 'load_fx_cache', return_value={}), patch.object(build, 'save_fx_cache'), patch.object(build, 'COMPANY_CACHE_DIR', base / 'cache'), patch.object(build, 'OUTPUT_PATH', base / 'dataset.json'), patch.object(build, 'DATASET_INDEX_PATH', base / 'index.json'):
                self.assertEqual(build.main(), 0)
                fetch.assert_called_once()
                stale.assert_not_called()

    def test_exported_sankey_contains_the_complete_profit_trunk(self):
        with tempfile.TemporaryDirectory() as directory:
            subprocess.run(['node', str(ROOT / 'scripts/direct_chart_render.cjs'), '--payload', str(ROOT / 'data/cache/asml.json'), '--quarter', '2026Q3', '--language', 'en', '--modes', 'sankey', '--output-dir', directory, '--basename', 'asml'], check=True, capture_output=True)
            svg = (Path(directory) / 'asml-sankey.svg').read_text()
        for node in ('revenue', 'gross', 'operating', 'net'):
            self.assertIn('data-edit-node-visible-id="' + node + '"', svg)
        self.assertNotIn('Revenue structure only', svg)

    def test_published_payloads_have_complete_reconciled_profit_bridge(self):
        dataset = json.loads((ROOT / 'data/earnings-dataset.json').read_text())
        c = next(c for c in dataset['companies'] if c['id'] == 'asml')
        q = c['financials']['2026Q3']
        index = json.loads((ROOT / 'data/dataset-index.json').read_text())
        latest = next(c for c in index['companies'] if c['id'] == 'asml')
        cache = json.loads((ROOT / 'data/cache/asml.json').read_text())
        self.assertEqual(q, latest['financials']['2026Q3'])
        self.assertEqual(q, cache['financials']['2026Q3'])
        self.assertEqual(q['statementSourceUrl'], SOURCE)
        self.assertAlmostEqual(q['costOfRevenueBn'] + q['grossProfitBn'], q['revenueBn'])
        self.assertAlmostEqual(q['rndBn'] + q['sgnaBn'] + q['operatingIncomeBn'], q['grossProfitBn'])
        net_bridge = q['operatingIncomeBn'] + q['nonOperatingBn'] + q['equityMethodIncomeBn'] - q['taxBn']
        self.assertLess(abs(net_bridge - q['netIncomeBn']), .002)
        self.assertEqual(c['coverage']['classification']['blockers'], [])
