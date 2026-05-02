import json
import re
import subprocess
import tempfile
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
NODE_RENDERER = ROOT_DIR / "scripts" / "direct_chart_render.cjs"
APPLE_PAYLOAD = ROOT_DIR / "data" / "cache" / "apple.json"
SVG_NS = {"svg": "http://www.w3.org/2000/svg"}


def load_apple() -> dict:
    return json.loads(APPLE_PAYLOAD.read_text(encoding="utf-8"))


def render_apple_q2_svg() -> tuple[str, ET.Element]:
    with tempfile.TemporaryDirectory(prefix="apple-q2-fy26-sankey-") as temp_dir:
        output_dir = Path(temp_dir)
        result = subprocess.run(
            [
                "node",
                str(NODE_RENDERER),
                "--payload",
                str(APPLE_PAYLOAD),
                "--quarter",
                "2026Q1",
                "--language",
                "zh",
                "--modes",
                "sankey",
                "--output-dir",
                str(output_dir),
                "--basename",
                "apple-q2-fy26",
            ],
            cwd=ROOT_DIR,
            check=True,
            capture_output=True,
            text=True,
        )
        summary = json.loads(result.stdout)
        svg_path = Path(summary["outputs"]["sankey"]["svg"])
        svg_text = svg_path.read_text(encoding="utf-8")
        return svg_text, ET.fromstring(svg_text)


def visible_rect(svg_root: ET.Element, node_id: str) -> dict[str, float]:
    rect = svg_root.find(f".//svg:rect[@data-edit-node-visible-id='{node_id}']", SVG_NS)
    if rect is None:
        raise AssertionError(f"Missing visible rect for {node_id}")
    return {
        "x": float(rect.attrib["x"]),
        "y": float(rect.attrib["y"]),
        "width": float(rect.attrib["width"]),
        "height": float(rect.attrib["height"]),
    }


def text_y(svg_root: ET.Element, label: str, *, min_x: float | None = None, min_y: float | None = None) -> float:
    candidates = []
    for text in svg_root.findall(".//svg:text", SVG_NS):
        if "".join(text.itertext()) != label:
            continue
        x = float(text.attrib.get("x", 0))
        y = float(text.attrib.get("y", 0))
        if min_x is not None and x < min_x:
            continue
        if min_y is not None and y < min_y:
            continue
        candidates.append(y)
    if not candidates:
        raise AssertionError(f"Missing label {label}")
    return min(candidates)


class AppleQ2FY26SankeyRegressionTests(unittest.TestCase):
    def test_release_supplement_has_growth_for_all_rendered_left_detail_rows(self) -> None:
        apple = load_apple()
        entry = apple["financials"]["2026Q1"]
        detail_rows = entry["officialRevenueDetailGroups"]

        self.assertNotIn("services", {row["memberKey"] for row in detail_rows})
        wearables = next(row for row in detail_rows if row["memberKey"] == "wearables")
        self.assertIsNotNone(wearables.get("qoqPct"))
        self.assertIsNotNone(wearables.get("yoyPct"))

    def test_q2_sankey_does_not_render_a_service_to_service_left_detail_extension(self) -> None:
        _svg_text, svg_root = render_apple_q2_svg()

        service_source = visible_rect(svg_root, "source-1")
        left_detail_rects = [
            rect
            for rect in svg_root.findall(".//svg:rect", SVG_NS)
            if str(rect.attrib.get("data-edit-node-visible-id", "")).startswith("left-detail-")
        ]
        below_service_details = [
            rect
            for rect in left_detail_rects
            if float(rect.attrib["y"]) >= service_source["y"] - 12
        ]

        self.assertEqual(below_service_details, [])

    def test_cost_product_label_stays_below_operating_expense_summary(self) -> None:
        _svg_text, svg_root = render_apple_q2_svg()

        opex_summary_y = text_y(svg_root, "营业费用")
        cost_product = visible_rect(svg_root, "cost-breakdown-0")
        product_label_y = text_y(svg_root, "产品", min_x=cost_product["x"] + cost_product["width"], min_y=cost_product["y"] - 20)
        self.assertGreater(product_label_y, opex_summary_y + 210)

    def test_cost_product_node_keeps_value_scaled_thickness(self) -> None:
        _svg_text, svg_root = render_apple_q2_svg()

        cost_product = visible_rect(svg_root, "cost-breakdown-0")
        cost_services = visible_rect(svg_root, "cost-breakdown-1")

        self.assertGreater(cost_product["height"], 200)
        self.assertGreater(cost_product["height"], cost_services["height"] * 4)


if __name__ == "__main__":
    unittest.main()
