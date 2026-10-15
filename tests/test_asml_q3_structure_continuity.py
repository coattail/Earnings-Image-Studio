import json
import subprocess
import tempfile
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NS = {'s': 'http://www.w3.org/2000/svg'}


class AsmlQ3StructureContinuityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.company = json.loads((ROOT / 'data/cache/asml.json').read_text())
        cls.svgs = {}
        with tempfile.TemporaryDirectory() as output:
            for quarter in ['2026Q2', '2026Q3']:
                subprocess.run(['node', str(ROOT / 'scripts/direct_chart_render.cjs'), '--payload', str(ROOT / 'data/cache/asml.json'), '--quarter', quarter, '--language', 'en', '--modes', 'sankey', '--output-dir', output, '--basename', quarter], check=True, capture_output=True)
                cls.svgs[quarter] = ET.fromstring((Path(output) / (quarter + '-sankey.svg')).read_text())

    def test_current_quarter_uses_same_category_names_order_and_parent_as_history(self):
        previous = self.company['financials']['2026Q2']
        current = self.company['financials']['2026Q3']
        self.assertEqual(previous['officialRevenueStyle'], current['officialRevenueStyle'])
        for field in ['officialRevenueSegments', 'officialRevenueDetailGroups']:
            for attr in ['memberKey', 'name', 'nameZh', 'targetName']:
                self.assertEqual([r.get(attr) for r in previous[field]], [r.get(attr) for r in current[field]])
        self.assertEqual(len(current['officialRevenueDetailGroups']), 6)
        self.assertIn('officialRevenueDetailGroups', current['sankeyStructureContinuity']['fields'])
        self.assertIsNone(current.get('positiveAdjustments'))
        self.assertIsNone(current.get('belowOperatingItems'))

    def test_current_values_follow_q3_official_mix_rather_than_prior_quarter_amounts(self):
        fixture = json.loads((ROOT / 'tests/fixtures/asml-q3-2026-technology-mix.json').read_text())
        current = self.company['financials']['2026Q3']
        rows = current['officialRevenueDetailGroups']
        self.assertAlmostEqual(sum(r['valueBn'] for r in rows), fixture['netSystemSalesBn'])
        for row in rows:
            self.assertEqual(row['mixPct'], fixture['technologySharePct'][row['memberKey']])
            self.assertEqual(row['sourceUrl'], fixture['sourceUrl'])
            self.assertEqual(row['filingDate'], fixture['filingDate'])
            self.assertLessEqual(abs(row['valueBn'] - fixture['netSystemSalesBn'] * row['mixPct'] / 100), .001)

    def test_rendered_details_and_trunk_keep_historical_colors_and_stage_order(self):
        for node in [*[f'left-detail-{i}' for i in range(6)], 'revenue', 'gross', 'operating', 'net']:
            nodes = [svg.find(f".//s:rect[@data-edit-node-visible-id='{node}']", NS) for svg in self.svgs.values()]
            self.assertTrue(all(n is not None for n in nodes), node)
            self.assertEqual(nodes[0].get('fill'), nodes[1].get('fill'), node)
        for svg in self.svgs.values():
            stages = [svg.find(f".//s:rect[@data-edit-node-visible-id='{node}']", NS) for node in ['revenue', 'gross', 'operating', 'net']]
            self.assertEqual(sorted(float(n.get('x')) for n in stages), [float(n.get('x')) for n in stages])
