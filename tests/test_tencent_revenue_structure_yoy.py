import sys
import unittest
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = ROOT_DIR / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from official_revenue_structures import _extract_tencent_growth_metrics  # noqa: E402


class TencentRevenueStructureYoyTests(unittest.TestCase):
    def test_extracts_yoy_abbreviation_and_declines_from_q1_narrative(self) -> None:
        text = (
            "Domestic Games revenues were RMB45.4 billion, up 6% YoY. "
            "International Games revenues were RMB18.8 billion, up 13% YoY. "
            "Social Networks revenues decreased by 2% YoY to RMB31.9 billion."
        )

        self.assertEqual(_extract_tencent_growth_metrics(text, "Domestic Games"), (45.4, 6.0))
        self.assertEqual(_extract_tencent_growth_metrics(text, "International Games"), (18.8, 13.0))
        self.assertEqual(_extract_tencent_growth_metrics(text, "Social Networks"), (31.9, -2.0))


if __name__ == "__main__":
    unittest.main()
