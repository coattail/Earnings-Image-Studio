import sys
import unittest
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = ROOT_DIR / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from generic_ir_pdf_parser import _structured_ocr_grid_lines, _structured_ocr_lines  # noqa: E402


class StructuredOcrOrderingTests(unittest.TestCase):
    def test_structured_ocr_lines_keep_top_rows_first(self) -> None:
        observations = [
            {"text": "Revenue", "x": 0.10, "y": 0.90, "width": 0.10, "height": 0.03},
            {"text": "100", "x": 0.70, "y": 0.90, "width": 0.08, "height": 0.03},
            {"text": "Net income", "x": 0.10, "y": 0.40, "width": 0.14, "height": 0.03},
            {"text": "20", "x": 0.70, "y": 0.40, "width": 0.05, "height": 0.03},
        ]

        lines = _structured_ocr_lines(observations)

        self.assertEqual(lines[:2], ["Revenue | 100", "Net income | 20"])

    def test_structured_ocr_grid_lines_keep_top_rows_first(self) -> None:
        observations = [
            {"text": "Revenue", "x": 0.10, "y": 0.88, "width": 0.10, "height": 0.03},
            {"text": "100", "x": 0.70, "y": 0.88, "width": 0.08, "height": 0.03},
            {"text": "Net income", "x": 0.10, "y": 0.36, "width": 0.14, "height": 0.03},
            {"text": "20", "x": 0.70, "y": 0.36, "width": 0.05, "height": 0.03},
        ]

        lines = _structured_ocr_grid_lines(observations)

        self.assertEqual(lines[:2], ["Revenue | 100", "Net income | 20"])


if __name__ == "__main__":
    unittest.main()
