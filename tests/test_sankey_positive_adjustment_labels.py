import json
import subprocess
import tempfile
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
NODE_RENDERER = ROOT_DIR / "scripts" / "direct_chart_render.cjs"
ASML_PAYLOAD = ROOT_DIR / "data" / "cache" / "asml.json"


def render_sankey_svg(language: str) -> ET.Element:
    with tempfile.TemporaryDirectory(prefix=f"asml-positive-label-{language}-") as temp_dir:
        output_dir = Path(temp_dir)
        result = subprocess.run(
            [
                "node",
                str(NODE_RENDERER),
                "--payload",
                str(ASML_PAYLOAD),
                "--quarter",
                "2026Q1",
                "--language",
                language,
                "--modes",
                "sankey",
                "--output-dir",
                str(output_dir),
                "--basename",
                f"asml-{language}",
            ],
            cwd=ROOT_DIR,
            check=True,
            capture_output=True,
            text=True,
        )
        render_summary = json.loads(result.stdout)
        svg_path = Path(render_summary["outputs"]["sankey"]["svg"])
        return ET.fromstring(svg_path.read_text(encoding="utf-8"))


def svg_text_content(svg_root: ET.Element) -> str:
    return " ".join(part.strip() for part in svg_root.itertext() if part and part.strip())


class SankeyPositiveAdjustmentLabelTests(unittest.TestCase):
    def test_asml_english_positive_adjustment_uses_short_non_bridge_label(self) -> None:
        svg_root = render_sankey_svg("en")
        text_content = svg_text_content(svg_root)

        self.assertIn("Other net gain", text_content)
        self.assertNotIn("Other net bridge gain", text_content)

    def test_asml_chinese_positive_adjustment_uses_short_localized_label(self) -> None:
        svg_root = render_sankey_svg("zh")
        text_content = svg_text_content(svg_root)

        self.assertIn("其他净收益", text_content)
        self.assertNotIn("bridge", text_content)
        self.assertNotIn("其他净bridge收益", text_content)


if __name__ == "__main__":
    unittest.main()
