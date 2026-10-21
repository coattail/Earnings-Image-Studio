import json
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import build_dataset  # noqa: E402


class SpaceXCompanyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.dataset = json.loads((ROOT / "data/earnings-dataset.json").read_text())
        cls.company = next(c for c in cls.dataset["companies"] if c["id"] == "spacex")

    def test_company_is_selectable_by_name_and_real_ticker(self):
        company = next(c for c in build_dataset.TOP30_COMPANIES if c["id"] == "spacex")
        self.assertEqual(company["ticker"], "SPCX")
        self.assertEqual(company["cik"], 1181412)
        for query in ["spacex", "spcx"]:
            self.assertTrue(build_dataset.company_matches_selection(company, {query}))

    def test_quarterly_trunks_and_segment_totals_reconcile(self):
        self.assertEqual(self.company["quarters"], ["2025Q1", "2025Q2", "2025Q3", "2025Q4", "2026Q1", "2026Q2", "2026Q3"])
        for quarter, entry in self.company["financials"].items():
            with self.subTest(quarter=quarter):
                self.assertAlmostEqual(entry["revenueBn"] - entry["costOfRevenueBn"], entry["grossProfitBn"], places=6)
                self.assertAlmostEqual(entry["grossProfitBn"] - entry["operatingExpensesBn"], entry["operatingIncomeBn"], places=6)
                self.assertAlmostEqual(entry["pretaxIncomeBn"] - entry["taxBn"], entry["netIncomeBn"], places=6)
                self.assertAlmostEqual(sum(r["valueBn"] for r in entry["officialRevenueSegments"]), entry["revenueBn"], places=3)
                self.assertAlmostEqual(sum(r["valueBn"] for r in entry["officialCostBreakdown"]), entry["costOfRevenueBn"], places=3)
                self.assertEqual(entry["accountingStandard"], "US GAAP")
                self.assertTrue(entry["statementSourceUrl"].startswith("https://www.sec.gov/Archives/"))

    def test_latest_results_keep_tax_benefit_and_full_detail_hierarchy(self):
        entry = self.company["financials"]["2026Q3"]
        self.assertEqual(entry["revenueBn"], 14.575)
        self.assertEqual(entry["operatingIncomeBn"], 2.791)
        self.assertEqual(entry["taxBn"], -0.390)
        self.assertEqual(entry["netIncomeBn"], 4.404)
        self.assertEqual(len(entry["officialRevenueDetailGroups"]), 6)
        for segment in entry["officialRevenueSegments"]:
            details = [r for r in entry["officialRevenueDetailGroups"] if r["targetName"] == segment["name"]]
            self.assertAlmostEqual(sum(r["valueBn"] for r in details), segment["valueBn"], places=6)

    def test_q4_is_derived_from_annual_minus_ytd_and_survives_rebuild(self):
        overrides = json.loads((ROOT / "data/manual-company-overrides.json").read_text())
        rebuilt = build_dataset.apply_manual_company_override({"financials": {}}, {"id": "spacex"}, overrides)
        quarter = rebuilt["financials"]["2025Q4"]
        self.assertEqual(quarter["statementValueMode"], "derived-quarter")
        self.assertAlmostEqual(quarter["revenueBn"], 18.674 - 13.714, places=6)
        self.assertAlmostEqual(quarter["netIncomeBn"], -4.937 - (-2.590), places=6)
        self.assertEqual(len(quarter["statementSourceUrls"]), 2)

    def test_latest_index_lazy_cache_and_logo_are_available(self):
        cached = json.loads((ROOT / "data/cache/spacex.json").read_text())
        index = json.loads((ROOT / "data/dataset-index.json").read_text())
        compact = next(c for c in index["companies"] if c["id"] == "spacex")
        self.assertEqual(self.dataset["companyCount"], 41)
        self.assertEqual(cached["financials"], self.company["financials"])
        self.assertEqual(compact["latestQuarter"], "2026Q3")
        self.assertEqual(compact["financials"]["2026Q3"], self.company["financials"]["2026Q3"])
        logos = json.loads((ROOT / "data/logo-catalog.json").read_text())["logos"]
        self.assertIn("spacex", logos)
        self.assertEqual(logos["spacex"]["mime"], "image/svg+xml")


if __name__ == "__main__":
    unittest.main()
