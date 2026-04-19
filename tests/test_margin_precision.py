import sys
import unittest
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = ROOT_DIR / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

import official_financials  # noqa: E402
import statement_periods  # noqa: E402


class MarginPrecisionTests(unittest.TestCase):
    def test_official_financials_safe_pct_keeps_extra_precision_for_display_rounding(self) -> None:
        gross_margin_pct = official_financials._safe_pct(751.295, 1134.103)

        self.assertEqual(gross_margin_pct, 66.246)
        self.assertEqual(f"{gross_margin_pct:.1f}", "66.2")

    def test_statement_periods_safe_pct_matches_high_precision_rounding(self) -> None:
        gross_margin_pct = statement_periods._safe_pct(751.295, 1134.103)

        self.assertEqual(gross_margin_pct, 66.246)
        self.assertEqual(f"{gross_margin_pct:.1f}", "66.2")


if __name__ == "__main__":
    unittest.main()
