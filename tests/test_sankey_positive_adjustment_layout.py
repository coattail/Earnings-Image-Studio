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
ALPHABET_PAYLOAD = ROOT_DIR / "data" / "cache" / "alphabet.json"
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


def rect_attrs(svg_root: ET.Element, node_id: str) -> dict[str, float]:
    rect = find_rect(svg_root, node_id)
    return {
        "x": float(rect.attrib["x"]),
        "y": float(rect.attrib["y"]),
        "width": float(rect.attrib["width"]),
        "height": float(rect.attrib["height"]),
    }


def path_numbers(path_d: str) -> list[float]:
    import re

    return [float(match.group(0)) for match in re.finditer(r"-?\d+(?:\.\d+)?", path_d)]


def green_paths_between(svg_root: ET.Element, source: dict[str, float], target: dict[str, float]) -> list[list[float]]:
    paths: list[list[float]] = []
    source_right = source["x"] + source["width"]
    target_left = target["x"]
    for path in svg_root.findall(".//svg:path", SVG_NS):
        fill = path.attrib.get("fill", "")
        if fill.upper() != "#ACDBA3":
            continue
        numbers = path_numbers(path.attrib.get("d", ""))
        if len(numbers) < 18:
            continue
        start_x = numbers[0]
        reaches_target = any(abs(value - (target_left + 12)) <= 18 for index, value in enumerate(numbers) if index % 2 == 0)
        if abs(start_x - (source_right - 12)) <= 24 and reaches_target:
            paths.append(numbers)
    return paths


def path_start_center(numbers: list[float]) -> float:
    return (numbers[1] + numbers[-1]) / 2


def path_target_center(numbers: list[float]) -> float:
    return (numbers[11] + numbers[13]) / 2


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

    def test_alphabet_large_positive_bridge_keeps_core_profit_ribbon_rising(self) -> None:
        svg_root = render_sankey_svg(ALPHABET_PAYLOAD, "zh", "alphabet-zh", quarter="2026Q1")

        operating = rect_attrs(svg_root, "operating")
        net = rect_attrs(svg_root, "net")
        positive = rect_attrs(svg_root, "positive-0")
        main_profit_paths = green_paths_between(svg_root, operating, net)

        self.assertEqual(1, len(main_profit_paths), "Expected one green operating-profit to net-profit ribbon.")
        path = main_profit_paths[0]

        self.assertLessEqual(
            path_target_center(path),
            path_start_center(path) - 8,
            "Large positive bridges should leave the operating-profit ribbon rising into net profit.",
        )
        self.assertLessEqual(
            positive["y"] + positive["height"],
            net["y"] + net["height"] * 0.5,
            "Large positive bridge should merge into the upper half of the net-profit node.",
        )

if __name__ == "__main__":
    unittest.main()
