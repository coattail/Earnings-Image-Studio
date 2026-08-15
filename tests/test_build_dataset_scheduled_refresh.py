import sys
import unittest
from pathlib import Path
from unittest.mock import patch


ROOT_DIR = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = ROOT_DIR / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

import build_dataset  # noqa: E402


class BuildDatasetScheduledRefreshTests(unittest.TestCase):
    def test_incremental_refresh_updates_primary_source_then_reuses_enrichment_cache(self) -> None:
        company = {"id": "demo", "ticker": "DMO"}
        expected = {"id": "demo", "financials": {"2026Q2": {"revenueBn": 10}}}

        with (
            patch.object(build_dataset, "fetch_stockanalysis_financial_history", return_value={}) as fetch_primary,
            patch.object(build_dataset, "build_company_payload_for_dataset", return_value=expected) as build_payload,
        ):
            result = build_dataset.build_incremental_company_payload_for_dataset(
                company,
                manual_company_overrides={},
                fx_cache={},
            )

        self.assertEqual(result, expected)
        fetch_primary.assert_called_once_with(company, refresh=True)
        build_payload.assert_called_once_with(
            company,
            refresh=False,
            manual_company_overrides={},
            fx_cache={},
        )


if __name__ == "__main__":
    unittest.main()
