import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATASET_PATH = ROOT / "data" / "earnings-dataset.json"
SOURCE_URL = (
    "https://ir.amd.com/news-events/press-releases/detail/1295/"
    "amd-reports-second-quarter-2026-financial-results"
)


class LatestAmdUpdateTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        dataset = json.loads(DATASET_PATH.read_text(encoding="utf-8"))
        cls.company = next(company for company in dataset["companies"] if company["id"] == "amd")

    def test_amd_q2_2026_official_results(self) -> None:
        self.assertEqual(self.company["quarters"][-1], "2026Q2")
        entry = self.company["financials"]["2026Q2"]

        self.assertEqual(entry["fiscalLabel"], "FY2026 Q2")
        self.assertEqual(entry["periodEnd"], "2026-06-27")
        self.assertEqual(entry["revenueBn"], 11.536)
        self.assertEqual(entry["grossProfitBn"], 6.203)
        self.assertEqual(entry["operatingIncomeBn"], 1.990)
        self.assertEqual(entry["netIncomeBn"], 2.297)
        self.assertEqual(entry["statementFilingDate"], "2026-08-04")
        self.assertEqual(entry["statementSourceUrl"], SOURCE_URL)

    def test_amd_q2_2026_segments_reconcile_to_revenue(self) -> None:
        entry = self.company["financials"]["2026Q2"]
        segments = {row["memberKey"]: row["valueBn"] for row in entry["officialRevenueSegments"]}

        self.assertEqual(
            segments,
            {"datacenter": 6.718, "client": 3.062, "gaming": 0.779, "embedded": 0.977},
        )
        self.assertAlmostEqual(sum(segments.values()), entry["revenueBn"], places=9)
        self.assertEqual(
            {row["memberKey"]: row["yoyPct"] for row in entry["officialRevenueSegments"]},
            {"datacenter": 107.35, "client": 22.53, "gaming": -30.57, "embedded": 18.57},
        )

        history = self.company["officialRevenueStructureHistory"]["quarters"]["2026Q2"]
        self.assertEqual(
            {row["memberKey"]: row["valueBn"] for row in history["segments"]},
            segments,
        )

    def test_amd_q2_2026_sankey_flows_are_conserved(self) -> None:
        entry = self.company["financials"]["2026Q2"]
        opex = sum(row["valueBn"] for row in entry["officialOpexBreakdown"])

        self.assertAlmostEqual(entry["revenueBn"] - entry["costOfRevenueBn"], entry["grossProfitBn"], places=9)
        self.assertAlmostEqual(opex, entry["operatingExpensesBn"], places=9)
        self.assertAlmostEqual(entry["grossProfitBn"] - opex, entry["operatingIncomeBn"], places=9)
        self.assertAlmostEqual(entry["operatingIncomeBn"] + entry["nonOperatingBn"], entry["pretaxIncomeBn"], places=9)
        self.assertAlmostEqual(
            entry["pretaxIncomeBn"]
            - entry["taxBn"]
            + entry["equityIncomeBn"]
            + entry["discontinuedOperationsBn"],
            entry["netIncomeBn"],
            places=9,
        )

    def test_amd_q2_2026_sankey_renders_latest_business_mix(self) -> None:
        from tests.test_amd_sankey_flow_conservation import render_amd_sankey_markup

        markup = render_amd_sankey_markup("2026Q2")

        self.assertIn("Q2 FY26", markup)
        self.assertIn("数据中心", markup)
        self.assertIn("客户端", markup)
        self.assertIn("游戏", markup)
        self.assertIn("嵌入式", markup)


if __name__ == "__main__":
    unittest.main()
