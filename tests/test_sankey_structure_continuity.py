import unittest

from scripts import build_dataset


class SankeyStructureContinuityTests(unittest.TestCase):
    def test_same_taxonomy_keeps_previous_order_and_labels_with_current_values(self) -> None:
        previous = [
            {"memberKey": "alpha", "name": "Alpha", "nameZh": "甲", "valueBn": 10},
            {"memberKey": "beta", "name": "Beta", "nameZh": "乙", "valueBn": 20},
        ]
        current = [
            {"memberKey": "beta", "name": "Beta renamed", "nameZh": "乙（新）", "valueBn": 23},
            {"memberKey": "alpha", "name": "Alpha renamed", "nameZh": "甲（新）", "valueBn": 12},
        ]

        harmonized, matched = build_dataset.harmonize_unchanged_sankey_rows(current, previous)

        self.assertTrue(matched)
        self.assertEqual([row["memberKey"] for row in harmonized], ["alpha", "beta"])
        self.assertEqual([row["nameZh"] for row in harmonized], ["甲", "乙"])
        self.assertEqual([row["valueBn"] for row in harmonized], [12, 23])

    def test_changed_taxonomy_is_treated_as_an_official_structure_change(self) -> None:
        previous = [
            {"memberKey": "alpha", "name": "Alpha", "valueBn": 10},
            {"memberKey": "beta", "name": "Beta", "valueBn": 20},
        ]
        current = [
            {"memberKey": "alpha", "name": "Alpha", "valueBn": 12},
            {"memberKey": "gamma", "name": "Gamma", "valueBn": 23},
        ]

        harmonized, matched = build_dataset.harmonize_unchanged_sankey_rows(current, previous)

        self.assertFalse(matched)
        self.assertEqual(harmonized, current)

    def test_official_and_fallback_expense_fields_share_one_structure_family(self) -> None:
        payload = {
            "financials": {
                "2026Q1": {
                    "opexBreakdown": [
                        {"memberKey": "rnd", "name": "Research and development", "valueBn": 5},
                        {"memberKey": "sga", "name": "Selling and administrative", "valueBn": 3},
                    ]
                },
                "2026Q2": {
                    "officialOpexBreakdown": [
                        {"memberKey": "sga", "name": "SG&A", "valueBn": 4},
                        {"memberKey": "rnd", "name": "R&D", "valueBn": 6},
                    ]
                },
            }
        }

        result = build_dataset.preserve_previous_quarter_sankey_structure(payload)

        self.assertEqual(
            [row["memberKey"] for row in result["financials"]["2026Q2"]["officialOpexBreakdown"]],
            ["rnd", "sga"],
        )

    def test_company_payload_inherits_entry_presentation_only_for_the_next_quarter(self) -> None:
        payload = {
            "financials": {
                "2026Q1": {
                    "officialOpexBreakdown": [
                        {"memberKey": "rnd", "name": "Research and development", "valueBn": 5},
                        {"memberKey": "sga", "name": "Selling and administrative", "valueBn": 3},
                    ],
                    "sankeyPresentation": {"opexBreakdownMode": "largest-plus-other"},
                },
                "2026Q2": {
                    "officialOpexBreakdown": [
                        {"memberKey": "sga", "name": "SG&A", "valueBn": 4},
                        {"memberKey": "rnd", "name": "R&D", "valueBn": 6},
                    ],
                },
            }
        }

        result = build_dataset.preserve_previous_quarter_sankey_structure(payload)
        latest = result["financials"]["2026Q2"]

        self.assertEqual(
            [row["memberKey"] for row in latest["officialOpexBreakdown"]],
            ["rnd", "sga"],
        )
        self.assertEqual(
            latest["sankeyPresentation"],
            {"opexBreakdownMode": "largest-plus-other"},
        )
        self.assertEqual(latest["sankeyStructureContinuity"]["sourceQuarter"], "2026Q1")


if __name__ == "__main__":
    unittest.main()
