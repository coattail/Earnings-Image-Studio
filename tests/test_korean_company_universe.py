import json
import sys
import unittest
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = ROOT_DIR / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

import build_dataset  # noqa: E402


class KoreanCompanyUniverseTests(unittest.TestCase):
    def test_korean_companies_are_configured_with_krx_financial_paths(self) -> None:
        expected = {
            "samsung": {
                "ticker": "005930",
                "slug": "005930",
                "nameZh": "三星电子",
                "nameEn": "Samsung Electronics",
                "financialPath": "quote/krx/005930",
            },
            "sk-hynix": {
                "ticker": "000660",
                "slug": "000660",
                "nameZh": "SK海力士",
                "nameEn": "SK hynix",
                "financialPath": "quote/krx/000660",
            },
        }

        for company_id, fields in expected.items():
            with self.subTest(company_id=company_id):
                company = next(item for item in build_dataset.TOP30_COMPANIES if item["id"] == company_id)
                for field, value in fields.items():
                    self.assertEqual(company[field], value)
                self.assertEqual(company["financialSource"], "stockanalysis")
                self.assertFalse(company["isAdr"])
                self.assertTrue(build_dataset.company_matches_selection(company, {company_id}))
                self.assertTrue(build_dataset.company_matches_selection(company, {company["ticker"]}))

    def test_korean_company_dataset_has_latest_quarter_data_and_provenance(self) -> None:
        dataset = json.loads((ROOT_DIR / "data" / "earnings-dataset.json").read_text(encoding="utf-8"))
        companies = {company["id"]: company for company in dataset["companies"]}

        samsung = companies["samsung"]
        sk_hynix = companies["sk-hynix"]
        for company in (samsung, sk_hynix):
            self.assertEqual(company["reportingCurrency"], "KRW")
            self.assertEqual(company["quarters"][-1], "2026Q1")
            self.assertEqual(company["quarters"][0], "2018Q1")
            self.assertGreaterEqual(len(company["quarters"]), 33)
            self.assertGreater(company["financials"]["2026Q1"]["revenueBn"], 0)
            self.assertGreater(company["financials"]["2026Q1"]["operatingIncomeBn"], 0)

        samsung_latest = samsung["financials"]["2026Q1"]
        self.assertEqual(samsung_latest["statementSource"], "manual-samsung-official")
        self.assertAlmostEqual(samsung_latest["revenueBn"], 133873.444, delta=0.1)
        self.assertEqual(
            {row["memberKey"] for row in samsung_latest["officialRevenueSegments"]},
            {"dx", "ds", "sdc", "harman"},
        )
        self.assertAlmostEqual(samsung_latest["officialRevenueReconciliation"]["valueBn"], -11016.7, delta=0.1)
        samsung_segment_total = sum(float(row["valueBn"]) for row in samsung_latest["officialRevenueSegments"])
        self.assertAlmostEqual(
            samsung_segment_total + samsung_latest["officialRevenueReconciliation"]["valueBn"],
            samsung_latest["revenueBn"],
            delta=0.1,
        )

        sk_hynix_latest = sk_hynix["financials"]["2026Q1"]
        self.assertEqual(sk_hynix_latest["statementSource"], "manual-sk-hynix-official")
        self.assertAlmostEqual(sk_hynix_latest["revenueBn"], 52576.287, delta=0.1)
        self.assertAlmostEqual(sk_hynix_latest["operatingIncomeBn"], 37610.283, delta=0.1)
        sk_hynix_segments = {row["memberKey"]: row for row in sk_hynix_latest["officialRevenueSegments"]}
        self.assertEqual(set(sk_hynix_segments), {"dram", "nand", "otherproductsservices"})
        self.assertAlmostEqual(sk_hynix_segments["dram"]["valueBn"], 40660.0, delta=0.1)
        self.assertAlmostEqual(sk_hynix_segments["nand"]["valueBn"], 11570.0, delta=0.1)
        self.assertEqual(sk_hynix_latest["revenueClassificationSource"], "stockanalysis-business-metrics")
        self.assertEqual(sk_hynix["coverage"]["classification"]["status"], "ok")
        self.assertFalse(sk_hynix["coverage"]["classification"]["blockers"])

    def test_korean_company_revenue_classification_covers_full_history(self) -> None:
        dataset = json.loads((ROOT_DIR / "data" / "earnings-dataset.json").read_text(encoding="utf-8"))
        companies = {company["id"]: company for company in dataset["companies"]}
        samsung = companies["samsung"]
        sk_hynix = companies["sk-hynix"]

        for quarter in samsung["quarters"]:
            with self.subTest(company="samsung", quarter=quarter):
                rows = samsung["financials"][quarter].get("officialRevenueSegments") or []
                expected = (
                    {"ce", "im", "ds", "dp", "harman"}
                    if quarter < "2022Q1"
                    else {"dx", "ds", "sdc", "harman"}
                )
                self.assertEqual({row["memberKey"] for row in rows}, expected)
                reconciliation = samsung["financials"][quarter].get("officialRevenueReconciliation")
                self.assertIsInstance(reconciliation, dict)
                self.assertAlmostEqual(
                    sum(float(row["valueBn"]) for row in rows) + float(reconciliation["valueBn"]),
                    float(samsung["financials"][quarter]["revenueBn"]),
                    delta=0.1,
                )

        for quarter in sk_hynix["quarters"]:
            with self.subTest(company="sk-hynix", quarter=quarter):
                entry = sk_hynix["financials"][quarter]
                rows = entry.get("officialRevenueSegments") or []
                self.assertEqual(
                    {row["memberKey"] for row in rows},
                    {"dram", "nand", "otherproductsservices"},
                )
                self.assertAlmostEqual(
                    sum(float(row["valueBn"]) for row in rows)
                    + float((entry.get("officialRevenueReconciliation") or {}).get("valueBn") or 0),
                    float(entry["revenueBn"]),
                    delta=0.1,
                )

        self.assertEqual(samsung["coverage"]["officialSegmentQuarterCount"], len(samsung["quarters"]))
        self.assertEqual(sk_hynix["coverage"]["officialSegmentQuarterCount"], len(sk_hynix["quarters"]))
        self.assertEqual(
            sk_hynix["financials"]["2021Q2"]["revenueClassificationMetricMode"],
            "annual-mix-proxy",
        )
        self.assertEqual(samsung["financials"]["2018Q1"]["statementSource"], "samsung-official-earnings-presentation")
        self.assertEqual(sk_hynix["financials"]["2018Q1"]["statementSource"], "sk-hynix-official-earnings-presentation")
        self.assertAlmostEqual(samsung["financials"]["2018Q1"]["revenueBn"], 60560, delta=0.1)
        self.assertAlmostEqual(sk_hynix["financials"]["2018Q1"]["revenueBn"], 8720, delta=0.1)


if __name__ == "__main__":
    unittest.main()
