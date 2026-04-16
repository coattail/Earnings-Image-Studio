import sys
import unittest
from pathlib import Path
from unittest.mock import patch


ROOT_DIR = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = ROOT_DIR / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from source_adapters import stockanalysis_financials_adapter  # noqa: E402


def _company() -> dict[str, object]:
    return {
        "id": "ibm",
        "ticker": "IBM",
        "financialSource": "stockanalysis",
    }


class StockAnalysisFinancialsAdapterTests(unittest.TestCase):
    def test_run_converts_fetch_exception_into_adapter_errors(self) -> None:
        with patch.object(
            stockanalysis_financials_adapter,
            "fetch_stockanalysis_financial_history",
            side_effect=RuntimeError("upstream timeout"),
        ):
            result = stockanalysis_financials_adapter.run(_company(), refresh=True)

        self.assertTrue(result.enabled)
        self.assertEqual(result.payload, {})
        self.assertEqual(result.errors, ["stockanalysis fetch failed for IBM: upstream timeout"])
        self.assertEqual(
            result.error_details,
            [
                {
                    "message": "upstream timeout",
                    "layer": "financials",
                    "sourceId": "stockanalysis_financials",
                    "phase": "fetch",
                    "errorType": "RuntimeError",
                    "severity": "error",
                }
            ],
        )


if __name__ == "__main__":
    unittest.main()
