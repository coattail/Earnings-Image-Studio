import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATASET_PATH = ROOT / "data" / "earnings-dataset.json"
SOURCE_URL = (
    "https://www.sec.gov/Archives/edgar/data/1018724/"
    "000101872426000024/amzn-20260630xex991.htm"
)


class LatestAmazonUpdateTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        dataset = json.loads(DATASET_PATH.read_text(encoding="utf-8"))
        cls.company = next(
            company for company in dataset["companies"] if company["id"] == "amazon"
        )

    def test_amazon_q2_2026_official_results(self) -> None:
        self.assertIn("2026Q2", self.company["quarters"])
        entry = self.company["financials"]["2026Q2"]

        self.assertEqual(entry["fiscalLabel"], "FY2026 Q2")
        self.assertEqual(entry["revenueBn"], 200.606)
        self.assertEqual(entry["grossProfitBn"], 104.828)
        self.assertEqual(entry["operatingIncomeBn"], 27.461)
        self.assertEqual(entry["netIncomeBn"], 62.647)
        self.assertEqual(entry["statementFilingDate"], "2026-07-30")
        self.assertEqual(entry["statementSourceUrl"], SOURCE_URL)

    def test_product_and_service_sales_reconcile_to_revenue(self) -> None:
        entry = self.company["financials"]["2026Q2"]
        segments = {
            row["memberKey"]: row["valueBn"]
            for row in entry["officialRevenueSegments"]
        }

        self.assertEqual(
            segments,
            {
                "onlinestores": 70.432,
                "thirdpartysellerservices": 46.78,
                "amazonwebservices": 42.232,
                "advertisingservices": 19.809,
                "subscriptionservices": 13.73,
                "physicalstores": 5.794,
                "otherservices": 1.829,
            },
        )
        self.assertAlmostEqual(sum(segments.values()), entry["revenueBn"], places=9)

    def test_operating_expenses_reconcile_to_operating_income(self) -> None:
        entry = self.company["financials"]["2026Q2"]
        opex = sum(row["valueBn"] for row in entry["officialOpexBreakdown"])

        self.assertAlmostEqual(opex, entry["operatingExpensesBn"], places=9)
        self.assertAlmostEqual(
            entry["grossProfitBn"] - opex,
            entry["operatingIncomeBn"],
            places=9,
        )

    def test_q3_2026_official_statement_and_cash_flows(self) -> None:
        self.assertEqual(self.company["quarters"][-1], "2026Q3")
        q = self.company["financials"]["2026Q3"]
        self.assertEqual(q["fiscalLabel"], "FY2026 Q3")
        self.assertEqual(q["periodEnd"], "2026-09-30")
        self.assertEqual(q["statementFilingDate"], "2026-10-29")
        for field, value in {
            "revenueBn": 201.944, "costOfRevenueBn": 94.573,
            "grossProfitBn": 107.371, "operatingExpensesBn": 79.295,
            "operatingIncomeBn": 28.076, "nonOperatingBn": -1.207,
            "pretaxIncomeBn": 26.869, "taxBn": 6.180,
            "equityMethodInvestmentActivityNetOfTaxBn": -0.004,
            "netIncomeBn": 20.685, "dilutedEps": 1.89, "netAssetsBn": 613.601,
            "operatingCashFlowBn": 42.422, "capitalExpenditureBn": 75.878,
            "freeCashFlowBn": -33.456,
        }.items():
            self.assertEqual(q[field], value, field)
        self.assertAlmostEqual(q["revenueBn"] - q["costOfRevenueBn"], q["grossProfitBn"])
        self.assertAlmostEqual(q["grossProfitBn"] - q["operatingExpensesBn"], q["operatingIncomeBn"])
        self.assertAlmostEqual(q["operatingIncomeBn"] + q["nonOperatingBn"], q["pretaxIncomeBn"])
        self.assertAlmostEqual(q["pretaxIncomeBn"] - q["taxBn"] + q["equityMethodInvestmentActivityNetOfTaxBn"], q["netIncomeBn"])
        self.assertAlmostEqual(q["purchasesOfPropertyAndEquipmentBn"] - q["propertyAndEquipmentSalesAndIncentivesBn"], q["capitalExpenditureBn"])
        self.assertAlmostEqual(q["operatingCashFlowBn"] - q["capitalExpenditureBn"], q["freeCashFlowBn"])
        self.assertEqual(q["parserFinancialValidation"]["issues"], [])

    def test_q3_revenue_and_expense_classifications_reconcile(self) -> None:
        q = self.company["financials"]["2026Q3"]
        self.assertEqual({r["memberKey"]: r["valueBn"] for r in q["officialRevenueSegments"]}, {
            "onlinestores": 68.470, "thirdpartysellerservices": 46.492,
            "amazonwebservices": 45.984, "advertisingservices": 19.637,
            "subscriptionservices": 14.006, "physicalstores": 5.710, "otherservices": 1.645,
        })
        for field, total in [("officialRevenueSegments", "revenueBn"), ("officialOpexBreakdown", "operatingExpensesBn")]:
            self.assertAlmostEqual(sum(r["valueBn"] for r in q[field]), q[total])
            for row in q[field]:
                self.assertEqual(row["sourceUrl"], q["statementSourceUrl"])
        for row in q["officialRevenueSegments"]:
            self.assertEqual(row["yoyPct"], round((row["valueBn"] / row["yoyComparisonValueBn"] - 1) * 100, 2))
            self.assertEqual(row["qoqPct"], round((row["valueBn"] / row["qoqComparisonValueBn"] - 1) * 100, 2))

    def test_q3_is_available_in_published_index_and_rebuild_sources(self) -> None:
        import sys
        sys.path.insert(0, str(ROOT / "scripts"))
        import build_dataset
        q = self.company["financials"]["2026Q3"]
        index = json.loads((ROOT / "data/dataset-index.json").read_text())
        indexed = next(c for c in index["companies"] if c["id"] == "amazon")
        self.assertEqual(indexed["latestQuarter"], "2026Q3")
        self.assertEqual(indexed["financials"]["2026Q3"], q)
        cache = json.loads((ROOT / "data/cache/amazon.json").read_text())
        self.assertEqual(cache["financials"]["2026Q3"], q)
        for folder, field in [("official-financials", "financials"), ("official-segments", "quarters"), ("official-revenue-structures", "quarters")]:
            cached = json.loads((ROOT / f"data/cache/{folder}/amazon.json").read_text())
            self.assertIn("2026Q3", cached[field])
        manual = json.loads((ROOT / "data/manual-company-overrides.json").read_text())
        rebuilt = build_dataset.apply_manual_company_override({"id": "amazon", "financials": {}, "quarters": []}, {"id": "amazon"}, manual)
        rebuilt = build_dataset.finalize_company_payload({"id": "amazon"}, rebuilt, {})
        for key in ["revenueBn", "operatingIncomeBn", "netIncomeBn", "taxBn"]:
            self.assertEqual(rebuilt["financials"]["2026Q3"][key], q[key])
        rows = {r["memberKey"]: r for r in rebuilt["financials"]["2026Q3"]["officialRevenueSegments"]}
        for row in q["officialRevenueSegments"]:
            for field in ["memberKey", "valueBn", "yoyPct", "qoqPct", "sourceUrl"]:
                self.assertEqual(rows[row["memberKey"]][field], row[field])


if __name__ == "__main__":
    unittest.main()
