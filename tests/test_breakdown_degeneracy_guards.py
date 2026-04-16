import sys
import unittest
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = ROOT_DIR / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

import extraction_engine  # noqa: E402
import generic_filing_table_parser  # noqa: E402


class BreakdownDegeneracyGuardTests(unittest.TestCase):
    def test_generic_filing_parser_rejects_near_zero_repeated_breakdown(self) -> None:
        items = [{"valueBn": 0.001} for _ in range(6)]

        self.assertTrue(generic_filing_table_parser._breakdown_looks_degenerate(items, 0.001))

    def test_extraction_engine_rejects_zero_only_breakdown_collection(self) -> None:
        items = [{"valueBn": 0.0} for _ in range(6)]

        self.assertTrue(extraction_engine._breakdown_collection_looks_suspicious(items, 35.149))

    def test_extraction_engine_rejects_placeholder_echo_expense_cluster(self) -> None:
        items = [
            {"taxonomyId": "sga", "memberKey": "sga", "valueBn": 26.295},
            {"taxonomyId": "finance_expense", "memberKey": "financeexpense", "valueBn": 2.024},
            {"taxonomyId": "fulfillment", "memberKey": "fulfillment", "valueBn": 2.024},
            {"taxonomyId": "general_administrative", "memberKey": "ga", "valueBn": 2.024},
            {"taxonomyId": "rnd", "memberKey": "rd", "valueBn": 2.024},
            {"taxonomyId": "sales_marketing", "memberKey": "salesmarketing", "valueBn": 2.024},
            {"taxonomyId": "taxes_surcharges", "memberKey": "taxessurcharges", "valueBn": 2.024},
            {"taxonomyId": "other_opex", "memberKey": "otheropex", "valueBn": 40.14},
        ]

        self.assertTrue(extraction_engine._breakdown_collection_looks_suspicious(items, 78.579))


if __name__ == "__main__":
    unittest.main()
