from __future__ import annotations

import json
import unittest
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]


class LatestNvidiaUpdateTests(unittest.TestCase):
    def test_latest_nvidia_quarter_matches_official_filing(self) -> None:
        dataset = json.loads((ROOT_DIR / "data" / "earnings-dataset.json").read_text(encoding="utf-8"))
        nvidia = next(company for company in dataset["companies"] if company["id"] == "nvidia")
        quarter = nvidia["financials"]["2026Q3"]

        self.assertEqual(quarter["periodEnd"], "2026-07-26")
        self.assertEqual(quarter["fiscalLabel"], "FY2027 Q2")
        self.assertEqual(quarter["revenueBn"], 96.221)
        self.assertEqual(quarter["costOfRevenueBn"], 24.079)
        self.assertEqual(quarter["grossProfitBn"], 72.142)
        self.assertEqual(quarter["operatingExpensesBn"], 8.408)
        self.assertEqual(quarter["operatingIncomeBn"], 63.734)
        self.assertEqual(quarter["netIncomeBn"], 59.688)
        self.assertEqual(quarter["officialRevenueStyle"], "nvidia-fy2027-market-platform")

        segments = {row["memberKey"]: row for row in quarter["officialRevenueSegments"]}
        self.assertEqual(segments["datacenter"]["valueBn"], 89.023)
        self.assertEqual(segments["datacenter"]["yoyPct"], 116.62)
        self.assertEqual(segments["datacenter"]["qoqPct"], 18.31)
        self.assertEqual(segments["edgecomputing"]["valueBn"], 7.198)
        self.assertEqual(segments["edgecomputing"]["yoyPct"], 27.47)
        self.assertEqual(segments["edgecomputing"]["qoqPct"], 13.0)
        self.assertEqual(round(sum(row["valueBn"] for row in segments.values()), 3), quarter["revenueBn"])

        details = {row["memberKey"]: row for row in quarter["officialRevenueDetailGroups"]}
        previous_details = {
            row["memberKey"]: row
            for row in nvidia["financials"]["2026Q2"]["officialRevenueDetailGroups"]
        }
        self.assertEqual(previous_details["hyperscale"]["valueBn"], 43.05)
        self.assertEqual(previous_details["aicloudsindustrialenterprise"]["valueBn"], 32.196)
        self.assertIsNone(previous_details["hyperscale"]["qoqPct"])
        self.assertIsNone(previous_details["aicloudsindustrialenterprise"]["qoqPct"])
        self.assertEqual(details["hyperscale"]["valueBn"], 48.71)
        self.assertEqual(details["hyperscale"]["yoyPct"], 101.55)
        self.assertAlmostEqual(details["hyperscale"]["qoqPct"], 13.1475, places=4)
        self.assertEqual(details["aicloudsindustrialenterprise"]["valueBn"], 40.313)
        self.assertEqual(details["aicloudsindustrialenterprise"]["yoyPct"], 138.14)
        self.assertAlmostEqual(details["aicloudsindustrialenterprise"]["qoqPct"], 25.2112, places=4)
        for member_key in ("hyperscale", "aicloudsindustrialenterprise"):
            implied_qoq = round(
                (details[member_key]["valueBn"] / previous_details[member_key]["valueBn"] - 1) * 100,
                2,
            )
            self.assertEqual(round(details[member_key]["qoqPct"], 2), implied_qoq)
        previous_gap = previous_details["hyperscale"]["valueBn"] - previous_details["aicloudsindustrialenterprise"]["valueBn"]
        current_gap = details["hyperscale"]["valueBn"] - details["aicloudsindustrialenterprise"]["valueBn"]
        self.assertLess(current_gap, previous_gap)
        self.assertEqual(
            round(sum(row["valueBn"] for row in details.values()), 3),
            segments["datacenter"]["valueBn"],
        )

        opex = {row["memberKey"]: row for row in quarter["officialOpexBreakdown"]}
        self.assertEqual(opex["researchanddevelopment"]["valueBn"], 7.054)
        self.assertEqual(opex["salesgeneralandadministrative"]["valueBn"], 1.354)
        self.assertEqual(round(sum(row["valueBn"] for row in opex.values()), 3), quarter["operatingExpensesBn"])


if __name__ == "__main__":
    unittest.main()
