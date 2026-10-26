from __future__ import annotations

import unittest
import sys
import json
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = ROOT_DIR / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

import build_dataset  # noqa: E402


class CompanyMarketCapRankingTests(unittest.TestCase):
    def test_company_universe_is_sorted_by_latest_market_cap_snapshot(self) -> None:
        companies = build_dataset.TOP30_COMPANIES
        self.assertEqual(len(companies), 41)
        self.assertEqual([item["rank"] for item in companies], list(range(1, 42)))
        market_caps = [item["marketCapUsd"] for item in companies if item.get("marketCapUsd")]
        snapshot = json.loads(build_dataset.COMPANY_MARKET_CAPS_PATH.read_text())
        self.assertEqual({company["id"] for company in companies}, set(snapshot["companies"]))
        self.assertEqual(market_caps, sorted(market_caps, reverse=True))
        for company in companies:
            self.assertEqual(company["marketCapUsd"], snapshot["companies"][company["id"]]["marketCapUsd"])

    def test_snapshot_metadata_is_propagated_to_cached_payloads(self) -> None:
        company = next(item for item in build_dataset.TOP30_COMPANIES if item["id"] == "samsung")
        payload = build_dataset.sync_company_metadata({"id": "samsung"}, company)
        snapshot = json.loads(build_dataset.COMPANY_MARKET_CAPS_PATH.read_text())
        self.assertEqual(payload["marketCapAsOf"], snapshot["source"]["asOf"])
        self.assertEqual(payload["marketCapSource"], "CompaniesMarketCap")
        self.assertEqual(payload["marketCapUsd"], snapshot["companies"]["samsung"]["marketCapUsd"])


if __name__ == "__main__":
    unittest.main()
