import json
import re
import subprocess
import tempfile
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
NODE_RENDERER = ROOT_DIR / "scripts" / "direct_chart_render.cjs"
DATASET_PATH = ROOT_DIR / "data" / "earnings-dataset.json"
SVG_NS = {"svg": "http://www.w3.org/2000/svg"}


def load_amd_company_payload() -> dict:
    dataset = json.loads(DATASET_PATH.read_text(encoding="utf-8"))
    return next(company for company in dataset["companies"] if company["id"] == "amd")


def render_amd_sankey_svg(quarter: str) -> ET.Element:
    return ET.fromstring(render_amd_sankey_markup(quarter))


def render_amd_sankey_markup(quarter: str) -> str:
    with tempfile.TemporaryDirectory(prefix=f"amd-sankey-{quarter}-") as temp_dir:
        output_dir = Path(temp_dir)
        payload_path = output_dir / "amd.json"
        payload_path.write_text(json.dumps(load_amd_company_payload(), ensure_ascii=False), encoding="utf-8")
        result = subprocess.run(
            [
                "node",
                str(NODE_RENDERER),
                "--payload",
                str(payload_path),
                "--quarter",
                quarter,
                "--language",
                "zh",
                "--modes",
                "sankey",
                "--output-dir",
                str(output_dir),
                "--basename",
                f"amd-{quarter}",
            ],
            cwd=ROOT_DIR,
            check=True,
            capture_output=True,
            text=True,
        )
        summary = json.loads(result.stdout)
        svg_path = Path(summary["outputs"]["sankey"]["svg"])
        return svg_path.read_text(encoding="utf-8")


def rect_height(svg_root: ET.Element, node_id: str) -> float:
    rect = svg_root.find(f".//svg:rect[@data-edit-node-visible-id='{node_id}']", SVG_NS)
    if rect is None:
        raise AssertionError(f"Expected SVG rect for node '{node_id}'.")
    return float(rect.attrib["height"])


def rect_top(svg_root: ET.Element, node_id: str) -> float:
    rect = svg_root.find(f".//svg:rect[@data-edit-node-visible-id='{node_id}']", SVG_NS)
    if rect is None:
        raise AssertionError(f"Expected SVG rect for node '{node_id}'.")
    return float(rect.attrib["y"])


def rect_left(svg_root: ET.Element, node_id: str) -> float:
    rect = svg_root.find(f".//svg:rect[@data-edit-node-visible-id='{node_id}']", SVG_NS)
    if rect is None:
        raise AssertionError(f"Expected SVG rect for node '{node_id}'.")
    return float(rect.attrib["x"])


def rect_fill(svg_root: ET.Element, node_id: str) -> str:
    rect = svg_root.find(f".//svg:rect[@data-edit-node-visible-id='{node_id}']", SVG_NS)
    if rect is None:
        raise AssertionError(f"Expected SVG rect for node '{node_id}'.")
    return rect.attrib.get("fill", "")


def rect_center_x(svg_root: ET.Element, node_id: str) -> float:
    rect = svg_root.find(f".//svg:rect[@data-edit-node-visible-id='{node_id}']", SVG_NS)
    if rect is None:
        raise AssertionError(f"Expected SVG rect for node '{node_id}'.")
    return float(rect.attrib["x"]) + float(rect.attrib["width"]) / 2


def net_main_ribbon_terminal_height(svg_markup: str, svg_root: ET.Element) -> float:
    net_x = rect_left(svg_root, "net")
    net_rect_index = svg_markup.find('data-edit-node-visible-id="net"')
    if net_rect_index < 0:
        raise AssertionError("Expected net node rect to render.")
    path_pattern = re.compile(r"<path\b([^>]*)>")
    candidates: list[tuple[int, float]] = []
    for match in path_pattern.finditer(svg_markup, 0, net_rect_index):
        tag = match.group(1)
        fill_match = re.search(r'fill="([^"]+)"', tag)
        if fill_match is None or fill_match.group(1).lower() != "#acdba3":
            continue
        path_match = re.search(r'd="([^"]+)"', tag)
        if path_match is None:
            continue
        terminal_matches = re.findall(rf"L {net_x:g} ([-\d.]+)", path_match.group(1))
        if len(terminal_matches) >= 2:
            top, bottom = sorted(float(value) for value in terminal_matches[:2])
            candidates.append((match.start(), bottom - top))
    if not candidates:
        raise AssertionError("Expected main green ribbon into net node.")
    return candidates[-1][1]


def amd_logo_metrics(svg_markup: str) -> dict[str, float]:
    vector_logo_match = re.search(
        r"<g transform=\"translate\(([-\d.]+), ([-\d.]+)\) scale\(([-\d.]+)\)\"[^>]*data-corporate-logo=\"amd\"[^>]*data-logo-width=\"([-\d.]+)\"[^>]*data-logo-height=\"([-\d.]+)\"",
        svg_markup,
    )
    if vector_logo_match is not None:
        group_x, group_y, scale, logo_width, _logo_height = map(float, vector_logo_match.groups())
        return {
            "x": group_x,
            "y": group_y,
            "scale": scale,
            "centerX": group_x + (logo_width / 2) * scale,
        }
    logo_match = re.search(
        r"<g transform=\"translate\(([-\d.]+), ([-\d.]+)\) scale\(([-\d.]+)\)\">\s*<image x=\"([-\d.]+)\" y=\"([-\d.]+)\" width=\"([-\d.]+)\"",
        svg_markup,
    )
    if logo_match is None:
        raise AssertionError("Expected the AMD image logo to render.")
    group_x, group_y, scale, image_x, _image_y, image_width = map(float, logo_match.groups())
    return {
        "x": group_x,
        "y": group_y,
        "scale": scale,
        "centerX": group_x + (image_x + image_width / 2) * scale,
    }


def svg_text_content(svg_root: ET.Element) -> str:
    return " ".join(part.strip() for part in svg_root.itertext() if part and part.strip())


def first_logo_markup_index(svg_markup: str) -> int:
    data_index = svg_markup.find('data-corporate-logo="amd"')
    index = svg_markup.rfind("<g", 0, data_index) if data_index >= 0 else -1
    if index < 0:
        image_index = svg_markup.find("<image")
        index = svg_markup.rfind("<g", 0, image_index) if image_index >= 0 else -1
    if index < 0:
        raise AssertionError("Expected the AMD image logo to render.")
    return index


def logo_group_end_index(svg_markup: str) -> int:
    logo_index = first_logo_markup_index(svg_markup)
    end_index = svg_markup.find("</g>", logo_index)
    if end_index < 0:
        raise AssertionError("Expected the AMD logo group to close.")
    return end_index


class AmdSankeyFlowConservationTests(unittest.TestCase):
    def test_q4_fy25_operating_stage_does_not_exceed_gross_profit_node(self) -> None:
        svg_root = render_amd_sankey_svg("2025Q4")

        gross_height = rect_height(svg_root, "gross")
        operating_height = rect_height(svg_root, "operating")
        opex_height = rect_height(svg_root, "operating-expenses")

        self.assertLessEqual(
            operating_height + opex_height,
            gross_height + 1.0,
            "Operating profit plus operating-expense deductions should not exceed the gross-profit stage height.",
        )
        self.assertIn("($3.8B)", svg_text_content(svg_root))

    def test_q3_fy22_keeps_disclosed_operating_loss_instead_of_inflating_profit(self) -> None:
        svg_markup = render_amd_sankey_markup("2022Q3")
        svg_root = ET.fromstring(svg_markup)
        text = svg_text_content(svg_root)

        self.assertEqual(
            rect_fill(svg_root, "operating"),
            "transparent",
            "A disclosed operating loss should render as a tiny transparent operating node, not a green profit node.",
        )
        self.assertLessEqual(rect_height(svg_root, "operating"), 6.5)
        self.assertLessEqual(
            rect_height(svg_root, "operating") + rect_height(svg_root, "operating-expenses"),
            rect_height(svg_root, "gross") + 1.0,
            "Operating stage ribbons should remain conserved when gross profit only barely covers expenses.",
        )
        self.assertNotIn("营业利润 $2.7B", text)
        self.assertNotIn("其他税前费用 ($2.8B)", text)

    def test_early_amd_revenue_segment_names_are_fully_localized(self) -> None:
        svg_root = render_amd_sankey_svg("2019Q1")
        text = svg_text_content(svg_root)

        self.assertIn("计算与图形", text)
        self.assertIn("企业、嵌入式", text)
        self.assertIn("与半定制", text)
        self.assertNotIn("Graphics", text)
        self.assertNotIn("Enterprise", text)
        self.assertNotIn("Semi-Custom", text)

    def test_q2_fy25_loss_bridge_keeps_revenue_logo_visible_and_avoids_duplicate_loss_label(self) -> None:
        svg_markup = render_amd_sankey_markup("2025Q2")
        svg_root = ET.fromstring(svg_markup)

        logo = amd_logo_metrics(svg_markup)
        self.assertLess(logo["y"], rect_top(svg_root, "revenue"), "AMD logo should sit above the revenue node.")
        self.assertLess(abs(logo["centerX"] - rect_center_x(svg_root, "revenue")), 90)
        self.assertNotIn("营业亏损", svg_text_content(svg_root))
        self.assertNotIn("超出毛利的营业费用", svg_text_content(svg_root))
        self.assertIn("税项及其他净收益", svg_text_content(svg_root))
        self.assertEqual(rect_fill(svg_root, "operating"), "transparent")
        self.assertLess(
            rect_left(svg_root, "positive-0"),
            rect_left(svg_root, "net") - 220,
            "AMD Q2 positive adjustment node should stay left of net income to avoid a near-vertical ribbon.",
        )
        self.assertGreaterEqual(
            rect_top(svg_root, "positive-0"),
            225,
            "AMD Q2 positive adjustment node should sit low enough to leave breathing room under the title/date text.",
        )
        self.assertGreaterEqual(
            rect_top(svg_root, "operating"),
            rect_top(svg_root, "gross") - 120,
            "A tiny operating-loss node should not float far above the gross-profit stage.",
        )

    def test_q4_fy25_semiconductor_layout_uses_normal_left_margin_and_revenue_logo_position(self) -> None:
        svg_markup = render_amd_sankey_markup("2025Q4")
        svg_root = ET.fromstring(svg_markup)
        logo = amd_logo_metrics(svg_markup)

        self.assertLess(rect_left(svg_root, "source-0"), 460, "AMD source nodes should not leave excessive blank space on the left.")
        self.assertLess(logo["y"], rect_top(svg_root, "revenue"), "AMD logo should sit above the revenue node.")
        self.assertLess(abs(logo["centerX"] - rect_center_x(svg_root, "revenue")), 90)
        self.assertGreater(
            first_logo_markup_index(svg_markup),
            svg_markup.rfind("<path", 0, first_logo_markup_index(svg_markup)),
            "AMD logo should render after the flow paths so ribbons cannot cover it.",
        )
        self.assertNotIn("<path", svg_markup[logo_group_end_index(svg_markup) :], "No flow path should render after the AMD logo group.")

    def test_q3_fy23_material_positive_residual_renders_as_explicit_bridge(self) -> None:
        svg_markup = render_amd_sankey_markup("2023Q3")
        svg_root = ET.fromstring(svg_markup)

        self.assertIn('data-edit-node-visible-id="positive-0"', svg_markup)
        self.assertIn("其他净收益", svg_text_content(svg_root))
        self.assertLess(
            net_main_ribbon_terminal_height(svg_markup, svg_root),
            rect_height(svg_root, "net") - 3,
            "Operating-profit ribbon should not be silently widened when a material positive residual explains net income.",
        )
        self.assertLessEqual(
            rect_top(svg_root, "positive-0") + rect_height(svg_root, "positive-0"),
            rect_top(svg_root, "net"),
            "Material positive residual bridge should enter net income from above instead of falling to the bottom of the chart.",
        )

    def test_q4_fy24_rounding_positive_residual_can_remain_implicit(self) -> None:
        svg_markup = render_amd_sankey_markup("2024Q4")
        svg_root = ET.fromstring(svg_markup)

        self.assertNotIn('data-edit-node-visible-id="positive-0"', svg_markup)
        self.assertAlmostEqual(
            net_main_ribbon_terminal_height(svg_markup, svg_root),
            rect_height(svg_root, "net"),
            delta=0.8,
            msg="Sub-display residuals can be absorbed as rounding reconciliation.",
        )


if __name__ == "__main__":
    unittest.main()
