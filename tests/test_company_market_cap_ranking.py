from __future__ import annotations

import unittest
import sys
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = ROOT_DIR / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

import build_dataset  # noqa: E402


class CompanyMarketCapRankingTests(unittest.TestCase):
    def test_company_universe_is_sorted_by_latest_market_cap_snapshot(self) -> None:
        companies = build_dataset.TOP30_COMPANIES
        self.assertEqual(len(companies), 40)
        self.assertEqual([item["rank"] for item in companies], list(range(1, 41)))
        market_caps = [item["marketCapUsd"] for item in companies]
        self.assertEqual(market_caps, sorted(market_caps, reverse=True))
        self.assertEqual(companies[0]["id"], "nvidia")
        self.assertLess(next(item["rank"] for item in companies if item["id"] == "samsung"), 15)
        self.assertLess(
            next(item["rank"] for item in companies if item["id"] == "sk-hynix"),
            next(item["rank"] for item in companies if item["id"] == "eli-lilly"),
        )

    def test_snapshot_metadata_is_propagated_to_cached_payloads(self) -> None:
        company = next(item for item in build_dataset.TOP30_COMPANIES if item["id"] == "samsung")
        payload = build_dataset.sync_company_metadata({"id": "samsung"}, company)
        self.assertEqual(payload["marketCapAsOf"], "2026-07-06")
        self.assertEqual(payload["marketCapSource"], "CompaniesMarketCap")
        self.assertGreater(payload["marketCapUsd"], 1_000_000_000_000)


if __name__ == "__main__":
    unittest.main()
