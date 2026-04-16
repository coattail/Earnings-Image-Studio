import sys
import unittest
from pathlib import Path
from unittest.mock import patch


ROOT_DIR = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = ROOT_DIR / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

import official_revenue_structures  # noqa: E402


class OfficialRevenueStructuresTsmcTests(unittest.TestCase):
    def test_find_tsmc_mix_ocr_prefers_slide_text_before_ocr(self) -> None:
        slide_text = (
            "TSMC Property 1Q26 Revenue by Platform "
            "Automotive 4% DCE 1% Others 2% IoT 6% HPC 61% Smartphone 26%"
        )

        with (
            patch.object(
                official_revenue_structures,
                "_find_slide_blocks",
                return_value=[{"text": slide_text, "image": "a1q26presentatione006.jpg"}],
            ),
            patch.object(
                official_revenue_structures,
                "_ocr_image",
                side_effect=AssertionError("slide text should bypass OCR"),
            ),
        ):
            ocr_text, source_url = official_revenue_structures._find_tsmc_mix_ocr(
                1046179,
                "000104617926000199",
                "2026Q1",
                {"directory": {"item": []}},
                presentation_html="<html></html>",
            )

        self.assertEqual(ocr_text, slide_text)
        self.assertEqual(
            source_url,
            "https://www.sec.gov/Archives/edgar/data/1046179/000104617926000199/a1q26presentatione006.jpg",
        )


if __name__ == "__main__":
    unittest.main()
