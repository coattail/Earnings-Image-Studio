import copy
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from scripts import refresh_market_caps as refresh


ROW = '''<table><tr><th>Rank</th></tr><tr>
<td class="fav"></td><td class="rank-td td-right" data-sort="3">3</td>
<td class="name-td"><a href="/microsoft/marketcap/">
<div class="company-code"><span class="rank d-none"></span>MSFT</div></a></td>
<td class="td-right" data-sort="3937246904320">$3.937 T</td>
</tr></table>'''


class RefreshMarketCapsTests(unittest.TestCase):
    def test_parser_uses_exact_usd_values_and_source_links(self):
        self.assertEqual(refresh.parse_rows(ROW), {"MSFT": {
            "marketCapUsd": 3937246904320, "sourceRank": 3,
            "sourceUrl": "https://companiesmarketcap.com/microsoft/marketcap/",
        }})
        self.assertEqual(refresh.parse_rows(ROW.replace('data-sort="3937246904320"', 'data-sort="0"')), {})

    def test_collection_resolves_company_aliases_and_requires_complete_coverage(self):
        google_row = ROW.replace("MSFT", "GOOG").replace("microsoft", "alphabet")
        with patch.object(refresh, "fetch_page", return_value=google_row):
            snapshot = refresh.collect_snapshot([{"id": "alphabet", "ticker": "GOOGL"}])
            self.assertIn("alphabet", snapshot["companies"])
            with self.assertRaisesRegex(ValueError, "Missing market caps"):
                refresh.collect_snapshot([{"id": "missing", "ticker": "MISSING"}])

    def test_apply_snapshot_recalculates_ranks_without_changing_financial_history(self):
        dataset = {"companies": [
            {"id": "small", "financials": {"2026Q2": {"revenueBn": 1}}},
            {"id": "large", "financials": {"2026Q2": {"revenueBn": 2}}},
        ]}
        original = copy.deepcopy(dataset)
        snapshot = {"source": {"asOf": "2026-10-26", "label": "CompaniesMarketCap", "retrievedAt": "2026-10-26T16:00:00Z"}, "companies": {
            "small": {"marketCapUsd": 100, "sourceRank": 2, "sourceUrl": refresh.SOURCE_URL},
            "large": {"marketCapUsd": 500, "sourceRank": 1, "sourceUrl": refresh.SOURCE_URL},
        }}
        refresh.apply_snapshot(dataset, snapshot)
        self.assertEqual([company["rank"] for company in dataset["companies"]], [2, 1])
        for before, after in zip(original["companies"], dataset["companies"]):
            self.assertEqual(before["id"], after["id"])
            self.assertEqual(before["financials"], after["financials"])

    def test_source_failure_leaves_all_existing_files_untouched(self):
        with tempfile.TemporaryDirectory() as directory:
            data_dir = Path(directory)
            payload = json.dumps({"companies": [{"id": "missing", "ticker": "MISSING"}]})
            for name in ("earnings-dataset.json", "dataset-index.json", "company-market-caps.json"):
                (data_dir / name).write_text(payload)
            with patch.object(refresh, "DATA_DIR", data_dir), patch.object(refresh, "fetch_page", return_value="<html>Unavailable</html>"):
                with self.assertRaisesRegex(ValueError, "No market-cap rows"):
                    refresh.main()
            self.assertTrue(all(path.read_text() == payload for path in data_dir.iterdir()))


if __name__ == "__main__":
    unittest.main()
