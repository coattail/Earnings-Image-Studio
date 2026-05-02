import json
import unittest
from copy import deepcopy
from pathlib import Path

import sys


ROOT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT_DIR / "scripts"))

from build_dataset import supplement_berkshire_earnings_release_financials  # noqa: E402


class BerkshireEarningsReleaseSupplementTests(unittest.TestCase):
    def test_supplement_adds_fy2026_q1_official_report_before_sec_cache_arrives(self) -> None:
        payload = json.loads((ROOT_DIR / "data" / "cache" / "berkshire.json").read_text(encoding="utf-8"))
        payload.get("financials", {}).pop("2026Q1", None)

        supplemented = supplement_berkshire_earnings_release_financials(deepcopy(payload))
        entry = supplemented["financials"]["2026Q1"]
        segments = entry["officialRevenueSegments"]

        self.assertEqual(entry["periodEnd"], "2026-03-31")
        self.assertEqual(entry["statementFilingDate"], "2026-05-02")
        self.assertEqual(entry["statementSourceUrl"], "https://www.berkshirehathaway.com/news/may0226.pdf")
        self.assertAlmostEqual(entry["revenueBn"], 93.675)
        self.assertAlmostEqual(entry["netIncomeBn"], 10.106)
        self.assertAlmostEqual(sum(row["valueBn"] for row in segments), entry["revenueBn"], places=3)
        self.assertEqual(
            {row["memberKey"] for row in segments},
            {
                "insurancecorporateother",
                "pilottravelcentersllc",
                "mclanecompany",
                "manufacturingbusinesses",
                "burlingtonnorthernsantafecorporation",
                "berkshirehathawayenergycompany",
                "serviceretailbusinesses",
            },
        )


if __name__ == "__main__":
    unittest.main()
