import json
import unittest
import sys
import subprocess
import tempfile
import xml.etree.ElementTree as ET
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from scripts import build_dataset
P = "2026Q3"

class GoogleMicrosoftQ3UpdateTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.dataset = json.loads((ROOT / "data/earnings-dataset.json").read_text())
        cls.companies = {c["id"]: c for c in cls.dataset["companies"]}
        cls.index = {c["id"]: c for c in json.loads((ROOT / "data/dataset-index.json").read_text())["companies"]}
        cls.manual = json.loads((ROOT / "data/manual-company-overrides.json").read_text())

    def test_income_expenses_cashflows_and_sources_reconcile(self):
        for cid, revenue, operating, net, fiscal in [("alphabet", 127.577, 40.576, 26.468, "FY2026 Q3"), ("microsoft", 92.279, 45.915, 36.629, "FY2027 Q1")]:
            with self.subTest(company=cid):
                c = self.companies[cid]; q = c["financials"][P]
                self.assertEqual(c["quarters"][-1], P)
                self.assertEqual((q["revenueBn"], q["operatingIncomeBn"], q["netIncomeBn"]), (revenue, operating, net))
                self.assertEqual(q["fiscalLabel"], fiscal)
                self.assertEqual(q["periodEnd"], "2026-09-30")
                self.assertEqual(q["statementFilingDate"], "2026-10-28")
                self.assertAlmostEqual(revenue - q["costOfRevenueBn"], q["grossProfitBn"])
                self.assertAlmostEqual(q["grossProfitBn"] - q["operatingExpensesBn"], operating)
                self.assertAlmostEqual(operating + q["nonOperatingBn"] - q["taxBn"], net)
                self.assertAlmostEqual(q["operatingCashFlowBn"] - q["capitalExpenditureBn"], q["freeCashFlowBn"])
                for field, total in [("officialRevenueSegments", "revenueBn"), ("officialCostBreakdown", "costOfRevenueBn"), ("officialOpexBreakdown", "operatingExpensesBn")]:
                    self.assertAlmostEqual(sum(r["valueBn"] for r in q[field]), q[total])
                    for row in q[field]: self.assertEqual(row["sourceUrl"], q["statementSourceUrl"])
                for parent in {r["targetName"] for r in q["officialRevenueDetailGroups"]}:
                    self.assertAlmostEqual(sum(r["valueBn"] for r in q["officialRevenueDetailGroups"] if r["targetName"] == parent), next(r["valueBn"] for r in q["officialRevenueSegments"] if r["name"] == parent))
                self.assertEqual(q["parserFinancialValidation"]["issues"], [])

    def test_google_gaap_profit_is_distinct_from_common_stockholder_profit(self):
        q = self.companies["alphabet"]["financials"][P]
        self.assertAlmostEqual(q["netIncomeBn"] - q["preferredStockDividendsBn"], q["netIncomeAvailableToCommonStockholdersBn"])
        self.assertEqual(q["netIncomeAvailableToCommonStockholdersBn"], 26.170)
        self.assertEqual(q["dilutedEps"], 2.12)
        self.assertEqual(q["freeCashFlowBn"], -9.065)
        rows = {r["memberKey"]: r for r in q["officialRevenueSegments"]}
        self.assertEqual(rows["googleplay"]["name"], "Subscriptions, Platforms & Devices")
        self.assertEqual(rows["otherrevenue"]["valueBn"], .566)  # Other Bets + hedging

    def test_google_sankey_renders_the_official_subscription_label(self):
        with tempfile.TemporaryDirectory() as directory:
            result = subprocess.run(["node", str(ROOT / "scripts/direct_chart_render.cjs"), "--payload", str(ROOT / "data/cache/alphabet.json"), "--quarter", P, "--language", "zh", "--modes", "sankey", "--output-dir", directory], cwd=ROOT, capture_output=True, text=True, check=True)
            svg = Path(json.loads(result.stdout)["outputs"]["sankey"]["svg"])
            labels = "".join(ET.fromstring(svg.read_text()).itertext())
            self.assertIn("订阅、平台及设备", labels)
            self.assertNotIn("应用商店", labels)

    def test_microsoft_recast_yoy_is_used_without_fabricated_qoq(self):
        q = self.companies["microsoft"]["financials"][P]
        self.assertEqual({r["memberKey"]: r["valueBn"] for r in q["officialRevenueSegments"]}, {"agentsandinfra": 76.795, "devicesandconsumer": 15.484})
        self.assertTrue(q["officialRevenueTaxonomyChangedFromPreviousQuarter"])
        for r in q["officialRevenueSegments"] + q["officialRevenueDetailGroups"]:
            self.assertEqual(r["yoyPct"], round((r["valueBn"] / r["yoyComparisonValueBn"] - 1) * 100, 2))
            self.assertIsNone(r["qoqPct"])
            self.assertTrue(r["suppressQoQGrowth"])
        self.assertEqual(q["dilutedEps"], 4.92)

    def test_latest_index_caches_and_rebuild_overrides_are_consistent(self):
        for cid in ["alphabet", "microsoft"]:
            with self.subTest(company=cid):
                c = self.companies[cid]; q = c["financials"][P]
                cache = json.loads((ROOT / f"data/cache/{cid}.json").read_text())
                self.assertEqual(cache["financials"][P], q)
                self.assertEqual(self.index[cid]["financials"][P], q)
                self.assertEqual(self.index[cid]["latestQuarter"], P)
                self.assertEqual(c["coverage"]["classification"]["latestQuarter"], P)
                for folder in ["official-financials", "official-segments", "official-revenue-structures"]:
                    d = json.loads((ROOT / f"data/cache/{folder}/{cid}.json").read_text())
                    self.assertIn(P, d.get("financials", d.get("quarters", {})))
                rebuilt = build_dataset.apply_manual_company_override({"id": cid, "financials": {k: v for k, v in c["financials"].items() if k != P}, "quarters": [k for k in c["quarters"] if k != P]}, {"id": cid}, self.manual)
                rebuilt = build_dataset.finalize_company_payload({"id": cid}, rebuilt, {})
                for key in ["revenueBn", "netIncomeBn", "operatingIncomeBn", "taxBn"]:
                    self.assertEqual(rebuilt["financials"][P][key], q[key])
                for key in ["officialRevenueSegments", "officialRevenueDetailGroups"]:
                    restored_rows = {r["memberKey"]: r for r in rebuilt["financials"][P][key]}
                    self.assertEqual(set(restored_rows), {r["memberKey"] for r in q[key]})
                    for current in q[key]:
                        restored = restored_rows[current["memberKey"]]
                        for field in ["memberKey", "name", "valueBn", "yoyPct", "qoqPct", "sourceUrl"]:
                            self.assertEqual(restored.get(field), current.get(field))
                self.assertEqual(next(r for r in self.dataset["classificationAudit"]["companies"] if r["id"] == cid)["latestQuarter"], P)

if __name__ == "__main__": unittest.main()
