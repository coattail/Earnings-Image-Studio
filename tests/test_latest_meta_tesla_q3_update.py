import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
QUARTER = "2026Q3"


class MetaTeslaQ3UpdateTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.companies = {c["id"]: c for c in json.loads((ROOT / "data/earnings-dataset.json").read_text())["companies"]}
        cls.index = {c["id"]: c for c in json.loads((ROOT / "data/dataset-index.json").read_text())["companies"]}
        cls.manual = json.loads((ROOT / "data/manual-company-overrides.json").read_text())

    def test_official_gaap_income_and_cash_flows_reconcile(self):
        for cid, revenue, operating, net in [("meta", 64.601, 12.988, 9.860), ("tesla", 28.046, .718, .787)]:
            with self.subTest(company=cid):
                c = self.companies[cid]
                q = c["financials"][QUARTER]
                self.assertEqual(c["quarters"][-1], QUARTER)
                self.assertEqual(q["periodEnd"], "2026-09-30")
                self.assertEqual(q["statementFilingDate"], "2026-10-21")
                self.assertEqual((q["revenueBn"], q["operatingIncomeBn"], q["netIncomeBn"]), (revenue, operating, net))
                self.assertAlmostEqual(q["revenueBn"] - q["costOfRevenueBn"], q["grossProfitBn"])
                self.assertAlmostEqual(q["grossProfitBn"] - q["operatingExpensesBn"], operating)
                self.assertAlmostEqual(operating + q["nonOperatingBn"], q["pretaxIncomeBn"])
                self.assertAlmostEqual(q["pretaxIncomeBn"] - q["taxBn"] - q.get("noncontrollingInterestBn", 0), net)
                self.assertAlmostEqual(q["operatingCashFlowBn"] - q["capitalExpenditureBn"], q["freeCashFlowBn"])
                self.assertAlmostEqual(sum(r["valueBn"] for r in q["officialRevenueSegments"]), revenue)
                parent = next(r for r in q["officialRevenueSegments"] if r["memberKey"] == ("familyofapps" if cid == "meta" else "auto"))
                self.assertAlmostEqual(sum(r["valueBn"] for r in q["officialRevenueDetailGroups"]), parent["valueBn"])
                for row in q["officialRevenueSegments"] + q["officialRevenueDetailGroups"]:
                    self.assertIsNotNone(row["yoyPct"])
                    self.assertIsNotNone(row["qoqPct"])
                    self.assertEqual(row["sourceUrl"], q["statementSourceUrl"])

    def test_tesla_expenses_and_minority_interest_use_reported_values(self):
        q = self.companies["tesla"]["financials"][QUARTER]
        for field, total in [("officialCostBreakdown", "costOfRevenueBn"), ("officialOpexBreakdown", "operatingExpensesBn")]:
            self.assertAlmostEqual(sum(r["valueBn"] for r in q[field]), q[total])
        self.assertAlmostEqual(q["consolidatedNetIncomeBn"] - q["noncontrollingInterestBn"], q["netIncomeBn"])
        self.assertEqual(q["taxBn"], .152)
        # Meta's reported G&A includes the $9.89bn settlement; keep GAAP profit.
        meta = self.companies["meta"]["financials"][QUARTER]
        self.assertAlmostEqual(meta["sgnaBn"], 3.333 + 14.857)
        self.assertEqual(meta["netIncomeBn"], 9.860)
        self.assertEqual(meta["freeCashFlowBn"], -2.120)

    def test_index_cache_and_refresh_overrides_include_new_quarter(self):
        for cid in ["meta", "tesla"]:
            with self.subTest(company=cid):
                entry = self.companies[cid]["financials"][QUARTER]
                cached = json.loads((ROOT / f"data/cache/{cid}.json").read_text())
                self.assertEqual(cached["financials"][QUARTER], entry)
                self.assertEqual(self.index[cid]["latestQuarter"], QUARTER)
                self.assertEqual(self.index[cid]["financials"][QUARTER], entry)
                self.assertEqual(self.companies[cid]["coverage"]["classification"]["latestQuarter"], QUARTER)
                audit = json.loads((ROOT / "data/earnings-dataset.json").read_text())["classificationAudit"]
                self.assertEqual(next(r for r in audit["companies"] if r["id"] == cid)["latestQuarter"], QUARTER)
                for field in ["revenueBn", "operatingIncomeBn", "netIncomeBn", "taxBn"]:
                    self.assertEqual(self.manual[cid]["financials"][QUARTER][field], entry[field])


if __name__ == "__main__":
    unittest.main()
