from __future__ import annotations

import sys
import unittest
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = ROOT_DIR / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

import official_financials  # noqa: E402


class OfficialFinancialsOpexBreakdownTests(unittest.TestCase):
    def build_entry(self, general_and_administrative_value: float) -> dict:
        return official_financials._build_financial_entry(
            "2023Q4",
            "USD",
            "2023-12-31",
            "2023",
            "Q4",
            revenue_value=608_000_000,
            gross_value=500_000_000,
            sgna_value=324_000_000,
            sales_and_marketing_value=197_000_000,
            rnd_value=109_000_000,
            general_and_administrative_value=general_and_administrative_value,
            operating_expenses_value=434_000_000,
            operating_income_value=66_000_000,
            net_income_value=93_000_000,
        )

    def test_preserves_three_official_categories_when_they_reconcile(self) -> None:
        entry = self.build_entry(127_000_000)

        self.assertEqual(
            [row["memberKey"] for row in entry["officialOpexBreakdown"]],
            ["salesandmarketing", "researchanddevelopment", "generalandadministrative"],
        )
        self.assertAlmostEqual(
            sum(row["valueBn"] for row in entry["officialOpexBreakdown"]),
            entry["operatingExpensesBn"],
            delta=0.002,
        )

    def test_rejects_three_category_breakdown_when_it_does_not_reconcile(self) -> None:
        entry = self.build_entry(200_000_000)

        self.assertNotIn("officialOpexBreakdown", entry)


if __name__ == "__main__":
    unittest.main()
