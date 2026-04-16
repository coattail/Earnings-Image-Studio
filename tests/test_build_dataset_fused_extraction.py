import sys
import unittest
from pathlib import Path
from unittest.mock import patch


ROOT_DIR = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = ROOT_DIR / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

import build_dataset  # noqa: E402


class BuildDatasetFusedExtractionTests(unittest.TestCase):
    def test_apply_fused_extraction_raises_when_unified_extraction_fails(self) -> None:
        payload = {
            "financials": {"2025Q4": {"calendarQuarter": "2025Q4"}},
            "parserDiagnostics": {"version": "universal-parser-v4"},
        }
        company = {"id": "fedex", "ticker": "FDX"}

        with patch.object(build_dataset, "build_unified_extraction", side_effect=RuntimeError("boom")):
            with self.assertRaisesRegex(RuntimeError, "FDX"):
                build_dataset.apply_fused_extraction(payload, company, refresh=False)


if __name__ == "__main__":
    unittest.main()
