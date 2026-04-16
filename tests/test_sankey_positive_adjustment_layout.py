import json
import subprocess
import tempfile
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
NODE_RENDERER = ROOT_DIR / "scripts" / "direct_chart_render.cjs"
APPLE_PAYLOAD = ROOT_DIR / "data" / "cache" / "apple.json"
AMAZON_PAYLOAD = ROOT_DIR / "data" / "cache" / "amazon.json"
WALMART_PAYLOAD = ROOT_DIR / "data" / "cache" / "walmart.json"
ASML_PAYLOAD = ROOT_DIR / "data" / "cache" / "asml.json"
SVG_NS = {"svg": "http://www.w3.org/2000/svg"}


def render_sankey_svg(payload_path: Path, language: str, basename: str, quarter: str = "2025Q4") -> ET.Element:
    with tempfile.TemporaryDirectory(prefix=f"sankey-layout-{language}-") as temp_dir:
        output_dir = Path(temp_dir)
        result = subprocess.run(
            [
                "node",
                str(NODE_RENDERER),
                "--payload",
                str(payload_path),
                "--quarter",
                quarter,
                "--language",
                language,
                "--modes",
                "sankey",
                "--output-dir",
                str(output_dir),
                "--basename",
                basename,
            ],
            cwd=ROOT_DIR,
            check=True,
            capture_output=True,
            text=True,
        )
        render_summary = json.loads(result.stdout)
        svg_path = Path(render_summary["outputs"]["sankey"]["svg"])
        return ET.fromstring(svg_path.read_text(encoding="utf-8"))


def find_rect(svg_root: ET.Element, node_id: str) -> ET.Element:
    rect = svg_root.find(f".//svg:rect[@data-edit-node-id='{node_id}']", SVG_NS)
    if rect is None:
        raise AssertionError(f"Expected SVG rect for node '{node_id}'.")
    return rect


def rect_top(rect: ET.Element) -> float:
    return float(rect.attrib["y"])


def rect_bottom(rect: ET.Element) -> float:
    return rect_top(rect) + float(rect.attrib["height"])


def svg_text_content(svg_root: ET.Element) -> str:
    return " ".join(part.strip() for part in svg_root.itertext() if part and part.strip())


class SankeyPositiveAdjustmentLayoutTests(unittest.TestCase):
    def test_apple_english_positive_adjustment_stays_above_net_profit(self) -> None:
        svg_root = render_sankey_svg(APPLE_PAYLOAD, "en", "apple-en")

        positive_rect = find_rect(svg_root, "positive-0")
        net_rect = find_rect(svg_root, "net")

        self.assertLessEqual(
            rect_bottom(positive_rect),
            rect_top(net_rect),
            "English positive adjustment branch should remain above the net-profit main ribbon.",
        )

    def test_amazon_english_positive_adjustment_stays_above_net_profit(self) -> None:
        svg_root = render_sankey_svg(AMAZON_PAYLOAD, "en", "amazon-en")

        positive_rect = find_rect(svg_root, "positive-0")
        net_rect = find_rect(svg_root, "net")

        self.assertLessEqual(
            rect_bottom(positive_rect),
            rect_top(net_rect),
            "Amazon English positive adjustment branch should remain above the net-profit main ribbon.",
        )

    def test_walmart_english_positive_adjustment_stays_above_net_profit(self) -> None:
        svg_root = render_sankey_svg(WALMART_PAYLOAD, "en", "walmart-en")

        positive_rect = find_rect(svg_root, "positive-0")
        net_rect = find_rect(svg_root, "net")

        self.assertLessEqual(
            rect_bottom(positive_rect),
            rect_top(net_rect),
            "Walmart English positive adjustment branch should remain above the net-profit main ribbon.",
        )

    def test_asml_english_positive_adjustment_uses_short_non_bridge_label(self) -> None:
        svg_root = render_sankey_svg(ASML_PAYLOAD, "en", "asml-en", quarter="2026Q1")
        text_content = svg_text_content(svg_root)

        self.assertIn("Other net gain", text_content)
        self.assertNotIn("Other net bridge gain", text_content)

    def test_asml_chinese_positive_adjustment_uses_short_localized_label(self) -> None:
        svg_root = render_sankey_svg(ASML_PAYLOAD, "zh", "asml-zh", quarter="2026Q1")
        text_content = svg_text_content(svg_root)

        self.assertIn("其他净收益", text_content)
        self.assertNotIn("bridge", text_content)
        self.assertNotIn("其他净bridge收益", text_content)

if __name__ == "__main__":
    unittest.main()
