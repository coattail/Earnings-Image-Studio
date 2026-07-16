import sys
import unittest
from pathlib import Path
from unittest.mock import patch


ROOT_DIR = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = ROOT_DIR / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

import official_revenue_structures  # noqa: E402


class AsmlWebsiteRevenueStructureTests(unittest.TestCase):
    def test_builds_segment_history_from_financial_statement_breakdown(self) -> None:
        entry = {
            "statementSourceUrl": "https://edge.sitecorecloud.io/asml/q1-2019-us-gaap.pdf",
            "statementFilingDate": "2019-04-17",
            "netSystemSalesBn": 1.596,
            "installedBaseManagementBn": 0.633,
        }

        with patch.object(
            official_revenue_structures,
            "_load_cached_financial_entries",
            return_value=[("2019Q1", entry)],
        ):
            result = official_revenue_structures._parse_asml_records({"id": "asml"}, 937966)

        quarter = result["quarters"]["2019Q1"]
        self.assertEqual([row["memberKey"] for row in quarter["segments"]], ["netsystemsales", "installedbasemanagement"])
        self.assertEqual([row["valueBn"] for row in quarter["segments"]], [1.596, 0.633])
        self.assertEqual(quarter["sourceUrl"], entry["statementSourceUrl"])

    def test_supplements_only_missing_cached_quarters(self) -> None:
        cached_payload = {
            "source": "existing",
            "quarters": {"2019Q2": {"segments": [{"memberKey": "existing", "valueBn": 1.0}]}},
            "filingsUsed": [],
            "errors": [],
            "errorDetails": [],
        }
        entries = [
            (
                "2019Q1",
                {
                    "statementSourceUrl": "https://edge.sitecorecloud.io/asml/q1-2019-us-gaap.pdf",
                    "statementFilingDate": "2019-04-17",
                    "netSystemSalesBn": 1.596,
                    "installedBaseManagementBn": 0.633,
                },
            ),
            ("2019Q2", {}),
        ]

        with patch.object(official_revenue_structures, "_load_cached_financial_entries", return_value=entries):
            result = official_revenue_structures._supplement_asml_cached_history(cached_payload)

        self.assertEqual(set(result["quarters"]), {"2019Q1", "2019Q2"})
        self.assertEqual(result["quarters"]["2019Q2"], cached_payload["quarters"]["2019Q2"])


if __name__ == "__main__":
    unittest.main()
