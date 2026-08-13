from __future__ import annotations

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
META_PAYLOAD = ROOT_DIR / "data" / "cache" / "meta.json"
MICROSOFT_PAYLOAD = ROOT_DIR / "data" / "cache" / "microsoft.json"
SAMSUNG_PAYLOAD = ROOT_DIR / "data" / "cache" / "samsung.json"
WALMART_PAYLOAD = ROOT_DIR / "data" / "cache" / "walmart.json"
ASML_PAYLOAD = ROOT_DIR / "data" / "cache" / "asml.json"
ALPHABET_PAYLOAD = ROOT_DIR / "data" / "cache" / "alphabet.json"
TESLA_PAYLOAD = ROOT_DIR / "data" / "cache" / "tesla.json"
BERKSHIRE_PAYLOAD = ROOT_DIR / "data" / "cache" / "berkshire.json"
ORACLE_PAYLOAD = ROOT_DIR / "data" / "cache" / "oracle.json"
JD_PAYLOAD = ROOT_DIR / "data" / "cache" / "jd.json"
NVIDIA_PAYLOAD = ROOT_DIR / "data" / "cache" / "nvidia.json"
TENCENT_PAYLOAD = ROOT_DIR / "data" / "cache" / "tencent.json"
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


def find_visible_rect(svg_root: ET.Element, node_id: str) -> ET.Element:
    rect = svg_root.find(f".//svg:rect[@data-edit-node-visible-id='{node_id}']", SVG_NS)
    if rect is None:
        raise AssertionError(f"Expected visible SVG rect for node '{node_id}'.")
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


def visible_rect_attrs(svg_root: ET.Element, node_id: str) -> dict[str, float]:
    rect = find_visible_rect(svg_root, node_id)
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
    return colored_paths_between(svg_root, source, target, "#ACDBA3")


def red_paths_between(svg_root: ET.Element, source: dict[str, float], target: dict[str, float]) -> list[list[float]]:
    return colored_paths_between(svg_root, source, target, "#E58A92")


def red_path_numbers(svg_root: ET.Element) -> list[list[float]]:
    paths: list[list[float]] = []
    for path in svg_root.findall(".//svg:path", SVG_NS):
        fill = path.attrib.get("fill", "")
        if fill.upper() != "#E58A92":
            continue
        numbers = path_numbers(path.attrib.get("d", ""))
        if len(numbers) >= 18:
            paths.append(numbers)
    return paths


def colored_paths_between(svg_root: ET.Element, source: dict[str, float], target: dict[str, float], color: str) -> list[list[float]]:
    return [path_numbers(path.attrib.get("d", "")) for path in colored_path_elements_between(svg_root, source, target, color)]


def colored_path_elements_between(
    svg_root: ET.Element,
    source: dict[str, float],
    target: dict[str, float],
    color: str,
) -> list[ET.Element]:
    paths: list[ET.Element] = []
    source_right = source["x"] + source["width"]
    target_left = target["x"]
    for path in svg_root.findall(".//svg:path", SVG_NS):
        fill = path.attrib.get("fill", "")
        if fill.upper() != color.upper():
            continue
        numbers = path_numbers(path.attrib.get("d", ""))
        if len(numbers) < 18:
            continue
        start_x = numbers[0]
        reaches_target = any(abs(value - (target_left + 12)) <= 18 for index, value in enumerate(numbers) if index % 2 == 0)
        if abs(start_x - (source_right - 12)) <= 24 and reaches_target:
            paths.append(path)
    return paths


def path_start_center(numbers: list[float]) -> float:
    return (numbers[1] + numbers[-1]) / 2


def path_start_top(numbers: list[float]) -> float:
    return numbers[1]


def path_start_bottom(numbers: list[float]) -> float:
    return numbers[-1]


def path_start_height(numbers: list[float]) -> float:
    return abs(path_start_bottom(numbers) - path_start_top(numbers))


def path_target_center(numbers: list[float]) -> float:
    return (numbers[11] + numbers[13]) / 2


def path_target_height(numbers: list[float]) -> float:
    return abs(numbers[13] - numbers[11])


def svg_text_content(svg_root: ET.Element) -> str:
    return " ".join(part.strip() for part in svg_root.itertext() if part and part.strip())


def find_text(svg_root: ET.Element, text: str) -> ET.Element:
    for element in svg_root.findall(".//svg:text", SVG_NS):
        if "".join(element.itertext()).strip() == text:
            return element
    raise AssertionError(f"Expected SVG text '{text}'.")


def text_y(svg_root: ET.Element, text: str) -> float:
    return float(find_text(svg_root, text).attrib["y"])


def text_x(svg_root: ET.Element, text: str) -> float:
    return float(find_text(svg_root, text).attrib["x"])


def text_anchor(svg_root: ET.Element, text: str) -> str:
    return find_text(svg_root, text).attrib.get("text-anchor", "")


def text_count(svg_root: ET.Element, text: str) -> int:
    return sum(1 for element in svg_root.findall(".//svg:text", SVG_NS) if "".join(element.itertext()).strip() == text)


def approximate_text_width(text: str, font_size: float) -> float:
    em_width = 0.0
    for char in text:
        if char.isspace():
            em_width += 0.34
        elif "\u3400" <= char <= "\u9fff":
            em_width += 1.0
        elif char in "MW@#%&":
            em_width += 0.84
        elif char.isascii() and (char.isupper() or char.isdigit() or char == "$"):
            em_width += 0.66
        elif char in "ilI1.,:;|!'":
            em_width += 0.32
        elif char in "()[]/\\_-":
            em_width += 0.42
        else:
            em_width += 0.56
    return em_width * font_size


def viewbox_height(svg_root: ET.Element) -> float:
    viewbox = svg_root.attrib.get("viewBox", "")
    parts = viewbox.split()
    if len(parts) != 4:
        raise AssertionError("Expected SVG viewBox with four values.")
    return float(parts[3])


class SankeyPositiveAdjustmentLayoutTests(unittest.TestCase):
    def test_tencent_small_positive_adjustment_uses_lifted_label_lane(self) -> None:
        svg_root = render_sankey_svg(
            TENCENT_PAYLOAD,
            "zh",
            "tencent-q2-small-positive-lane",
            quarter="2026Q2",
        )
        positive = visible_rect_attrs(svg_root, "positive-0")
        net = visible_rect_attrs(svg_root, "net")
        positive_label = find_text(svg_root, "营业外收益")
        positive_label_y = float(positive_label.attrib["y"])
        period_label = find_text(svg_root, "截至 2026年6月30日")
        positive_value_candidates = [
            element
            for element in svg_root.findall(".//svg:text", SVG_NS)
            if "".join(element.itertext()).strip() == "$0.4B" and float(element.attrib.get("x", 0)) > 1500
        ]
        self.assertEqual(len(positive_value_candidates), 1)
        positive_value_y = float(positive_value_candidates[0].attrib["y"])

        self.assertGreaterEqual(
            net["y"] - (positive["y"] + positive["height"]),
            48,
            "A small gain node should keep a distinct upper lane instead of sitting flat against net profit.",
        )
        self.assertAlmostEqual(
            positive_label_y,
            positive["y"],
            delta=14,
            msg="The small gain label should follow the lifted node rather than remain in the crowded merge corridor.",
        )
        self.assertGreater(positive_value_y, positive_label_y)
        period_label_right = float(period_label.attrib["x"]) + approximate_text_width(
            "截至 2026年6月30日",
            float(period_label.attrib["font-size"]),
        )
        positive_label_left = float(positive_label.attrib["x"]) - approximate_text_width(
            "营业外收益",
            float(positive_label.attrib["font-size"]),
        )
        self.assertGreaterEqual(
            positive_label_left - period_label_right,
            28,
            "The small gain node should shift right until its label has visible horizontal clearance from the period date.",
        )
        self.assertGreaterEqual(
            net["x"] - (positive["x"] + positive["width"]),
            72,
            "The date-avoidance shift should remain small enough to preserve a smooth merge runway into net profit.",
        )

    def test_nvidia_q4_fy23_omits_non_operating_bridge_that_displays_as_zero(self) -> None:
        svg_root = render_sankey_svg(NVIDIA_PAYLOAD, "zh", "nvidia-q4-fy23-zero-bridge", quarter="2023Q1")
        svg_text = svg_text_content(svg_root)

        self.assertNotIn("营业外收益", svg_text)
        self.assertNotIn("$0.0B", svg_text)
        self.assertIn("税项收益", svg_text)

    def test_alphabet_q2_extreme_gain_preserves_main_inflection_and_direct_tax_fork(self) -> None:
        svg_root = render_sankey_svg(ALPHABET_PAYLOAD, "zh", "alphabet-q2-extreme-positive", quarter="2026Q2")

        operating = visible_rect_attrs(svg_root, "operating")
        operating_expenses = visible_rect_attrs(svg_root, "operating-expenses")
        revenue = visible_rect_attrs(svg_root, "revenue")
        gross = visible_rect_attrs(svg_root, "gross")
        cost = visible_rect_attrs(svg_root, "cost")
        cost_breakdown_first = visible_rect_attrs(svg_root, "cost-breakdown-0")
        cost_breakdown_second = visible_rect_attrs(svg_root, "cost-breakdown-1")
        positive = visible_rect_attrs(svg_root, "positive-0")
        net = visible_rect_attrs(svg_root, "net")
        tax = visible_rect_attrs(svg_root, "deduction-0")

        self.assertAlmostEqual(
            operating["height"] + positive["height"],
            net["height"] + tax["height"],
            delta=0.2,
            msg="Operating profit plus the positive adjustment must conserve into net income plus tax.",
        )
        self.assertIsNone(
            svg_root.find(".//svg:rect[@data-edit-node-visible-id='pretax']", SVG_NS),
            "The chart should not insert an unexplained pretax node between operating profit and tax.",
        )
        self.assertAlmostEqual(
            viewbox_height(svg_root),
            1937,
            delta=2,
            msg="The quarter-specific layout should remove the unused lower canvas while preserving ribbon scale.",
        )
        self.assertGreaterEqual(
            operating_expenses["y"] - (operating["y"] + operating["height"]),
            130,
            "Gross profit's operating-profit and operating-expense branches must end in visibly separated lanes.",
        )
        self.assertGreaterEqual(
            gross["y"] - revenue["y"],
            90,
            "The main profit ribbon should descend from revenue into gross profit.",
        )
        self.assertGreaterEqual(
            gross["y"] - operating["y"],
            60,
            "Gross profit must remain the low inflection point before the main green ribbon rises into operating profit.",
        )
        expected_manual_layout_y = {
            "revenue": 680.6,
            "gross": 780.3,
            "operating": 712.2,
            "operating-expenses": 1066.3,
            "deduction-0": 852.4,
            "cost-breakdown-0": 1437.8,
            "cost-breakdown-1": 1607.3,
        }
        for node_id, expected_y in expected_manual_layout_y.items():
            self.assertAlmostEqual(
                visible_rect_attrs(svg_root, node_id)["y"],
                expected_y,
                delta=1.5,
                msg=f"Node '{node_id}' should retain the approved hand-tuned Q2 layout.",
            )
        positive_label_name = "营业外收益"
        positive_label_value = "$98.0B"
        positive_label_baseline_center = (
            text_y(svg_root, positive_label_name) + text_y(svg_root, positive_label_value)
        ) / 2
        self.assertEqual("end", text_anchor(svg_root, positive_label_name))
        self.assertLess(text_x(svg_root, positive_label_name), positive["x"])
        self.assertAlmostEqual(
            positive_label_baseline_center,
            positive["y"] + positive["height"] / 2,
            delta=8,
            msg="The non-operating-income label should sit to the left and remain vertically centered on its node.",
        )
        self.assertGreaterEqual(cost_breakdown_first["y"], cost["y"])
        self.assertGreaterEqual(
            cost_breakdown_second["y"] - (cost_breakdown_first["y"] + cost_breakdown_first["height"]),
            80,
            "The two cost-of-revenue terminals should form a compact, readable downward fan.",
        )
        self.assertLessEqual(
            cost_breakdown_second["y"] + cost_breakdown_second["height"],
            viewbox_height(svg_root) * 0.92,
            "The cost-of-revenue terminals should retain a deliberate lower margin on the compact canvas.",
        )
        self.assertGreaterEqual(
            net["x"] - (positive["x"] + positive["width"]),
            160,
            "The large positive ribbon needs enough runway to merge smoothly into net income.",
        )

        gross_profit_paths = green_paths_between(svg_root, gross, operating)
        gross_expense_paths = red_paths_between(svg_root, gross, operating_expenses)
        self.assertEqual(1, len(gross_profit_paths))
        self.assertGreaterEqual(len(gross_expense_paths), 1)
        tax_paths = [
            path
            for path in red_paths_between(svg_root, operating, tax)
            if path_start_top(path) >= operating["y"] - 1
            and path_start_bottom(path) <= operating["y"] + operating["height"] + 1
            and abs(path_start_height(path) - tax["height"]) <= 0.2
        ]
        self.assertEqual(1, len(tax_paths), "Tax must branch directly from the operating-profit node.")
        self.assertEqual(1, len(green_paths_between(svg_root, positive, net)))

    def test_tesla_q2_tax_branch_never_exceeds_its_operating_profit_source(self) -> None:
        svg_root = render_sankey_svg(TESLA_PAYLOAD, "zh", "tesla-q2-conserved-tax", quarter="2026Q2")
        operating = visible_rect_attrs(svg_root, "operating")
        tax = visible_rect_attrs(svg_root, "deduction-0")
        positive = visible_rect_attrs(svg_root, "positive-0")
        net = visible_rect_attrs(svg_root, "net")
        tesla_payload = json.loads(TESLA_PAYLOAD.read_text(encoding="utf-8"))
        quarter = tesla_payload["financials"]["2026Q2"]
        expected_tax_height = operating["height"] * quarter["taxBn"] / quarter["operatingIncomeBn"]

        self.assertLess(
            tax["height"],
            operating["height"],
            "A tax deduction smaller than operating profit must not render thicker than its source node.",
        )
        self.assertAlmostEqual(
            tax["height"],
            expected_tax_height,
            delta=0.2,
            msg="Tax node thickness should remain proportional to the reported tax amount.",
        )
        tax_paths = [
            path
            for path in red_paths_between(svg_root, operating, tax)
            if path_start_top(path) >= operating["y"] - 1
            and path_start_bottom(path) <= operating["y"] + operating["height"] + 1
        ]
        self.assertEqual(1, len(tax_paths))
        self.assertAlmostEqual(path_start_height(tax_paths[0]), tax["height"], delta=0.2)
        self.assertAlmostEqual(path_target_height(tax_paths[0]), tax["height"], delta=0.2)
        self.assertGreaterEqual(
            net["y"] - positive["y"],
            44,
            "A single material non-operating gain should enter net income at a visible angle.",
        )
        positive_label_baseline_center = (
            text_y(svg_root, "营业外收益") + text_y(svg_root, "$0.9B")
        ) / 2
        self.assertEqual("end", text_anchor(svg_root, "营业外收益"))
        self.assertLess(text_x(svg_root, "营业外收益"), positive["x"])
        self.assertAlmostEqual(
            positive_label_baseline_center,
            positive["y"] + positive["height"] / 2,
            delta=8,
            msg="The non-operating-income annotation should stay centered beside its source node.",
        )

        cost = visible_rect_attrs(svg_root, "cost")
        cost_terminals = [
            visible_rect_attrs(svg_root, f"cost-breakdown-{index}")
            for index in range(3)
        ]
        cost_drops = []
        for target in cost_terminals:
            target_center = target["y"] + target["height"] / 2
            paths = [
                path
                for path in red_paths_between(svg_root, cost, target)
                if abs(path_target_center(path) - target_center) <= 1
            ]
            self.assertEqual(1, len(paths))
            cost_drops.append(path_target_center(paths[0]) - path_start_center(paths[0]))
        self.assertLessEqual(
            cost_drops[0],
            150,
            "The first cost terminal should begin the fan with a gentle downward turn.",
        )
        self.assertTrue(
            all(lower > upper for upper, lower in zip(cost_drops, cost_drops[1:])),
            "Cost terminals should form an orderly progressively descending fan.",
        )
        self.assertLessEqual(
            max(lower - upper for upper, lower in zip(cost_drops, cost_drops[1:])),
            150,
            "Adjacent cost branches should not introduce an abrupt extra elbow.",
        )

        operating_expenses = visible_rect_attrs(svg_root, "operating-expenses")
        opex_terminals = [
            visible_rect_attrs(svg_root, f"opex-{index}")
            for index in range(2)
        ]
        opex_drops = []
        for target in opex_terminals:
            target_center = target["y"] + target["height"] / 2
            paths = [
                path
                for path in red_paths_between(svg_root, operating_expenses, target)
                if abs(path_target_center(path) - target_center) <= 1
            ]
            self.assertEqual(1, len(paths))
            opex_drops.append(path_target_center(paths[0]) - path_start_center(paths[0]))
        self.assertLessEqual(
            opex_drops[0],
            130,
            "The first operating-expense terminal should leave its source with a shallow curve.",
        )
        self.assertGreaterEqual(
            opex_drops[1] - opex_drops[0],
            80,
            "The second operating-expense terminal should descend clearly instead of crowding the first.",
        )
        self.assertLessEqual(
            opex_drops[1],
            300,
            "The lower operating-expense terminal should remain part of one smooth fan.",
        )

    def test_nvidia_prominent_non_operating_gain_merges_from_a_clear_upper_runway(self) -> None:
        svg_root = render_sankey_svg(NVIDIA_PAYLOAD, "zh", "nvidia-prominent-positive", quarter="2026Q2")

        positive = visible_rect_attrs(svg_root, "positive-0")
        net = visible_rect_attrs(svg_root, "net")
        vertical_lead = net["y"] - positive["y"]
        horizontal_runway = net["x"] - (positive["x"] + positive["width"])

        self.assertGreaterEqual(
            vertical_lead,
            max(36, positive["height"] * 0.4),
            "A prominent positive adjustment should descend into the net-profit node instead of entering flat or upward.",
        )
        self.assertLessEqual(
            vertical_lead,
            positive["height"] * 0.75,
            "The lifted positive adjustment should remain visually attached to its net-profit merge.",
        )
        self.assertGreaterEqual(
            horizontal_runway,
            max(96, positive["height"]),
            "A prominent positive adjustment should retain enough horizontal runway for a smooth merge.",
        )

    def test_operating_profit_fork_starts_curving_without_a_long_shared_runway(self) -> None:
        for company, payload in (
            ("amazon", AMAZON_PAYLOAD),
            ("meta", META_PAYLOAD),
            ("microsoft", MICROSOFT_PAYLOAD),
            ("samsung", SAMSUNG_PAYLOAD),
        ):
            with self.subTest(company=company):
                svg_root = render_sankey_svg(payload, "zh", f"{company}-smooth-operating-fork", quarter="2026Q1")
                operating = rect_attrs(svg_root, "operating")
                net = rect_attrs(svg_root, "net")
                main_profit_paths = green_paths_between(svg_root, operating, net)

                self.assertEqual(1, len(main_profit_paths), "Expected one green operating-profit to net-profit ribbon.")
                path = main_profit_paths[0]
                self.assertLessEqual(
                    path[2] - path[0],
                    10,
                    "The main profit ribbon should open away from the red deduction branch immediately after the operating-profit node.",
                )
                path_elements = colored_path_elements_between(svg_root, operating, net, "#ACDBA3")
                self.assertEqual(1, len(path_elements))
                self.assertGreaterEqual(
                    path_elements[0].attrib.get("d", "").count("C "),
                    8,
                    "The operating-profit ribbon should use a multi-segment smootherstep profile on both boundaries.",
                )

    def test_jd_non_operating_gain_and_tax_are_not_drawn_as_operating_deduction(self) -> None:
        svg_root = render_sankey_svg(JD_PAYLOAD, "en", "jd-q1-fy26-tax-source", quarter="2026Q1")
        text = svg_text_content(svg_root)

        self.assertIn(
            "Net non-operating gain",
            text,
            "JD Q1 FY26 should net tax against the non-operating gain when the chart has no pretax node.",
        )
        self.assertNotIn(
            "Tax ($0.2B)",
            text,
            "Tax should not be drawn as a direct deduction from operating profit when non-operating gain bridges to pretax income.",
        )

    def test_oracle_small_regular_sources_share_column(self) -> None:
        svg_root = render_sankey_svg(ORACLE_PAYLOAD, "zh", "oracle-latest-zh", quarter="latest")

        services_rect = visible_rect_attrs(svg_root, "source-2")
        hardware_rect = visible_rect_attrs(svg_root, "source-3")

        self.assertAlmostEqual(
            services_rect["x"],
            hardware_rect["x"],
            delta=0.1,
            msg="Oracle 服务 and 硬件 source nodes should start from the same x column.",
        )

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

    def test_amazon_dominant_positive_bridge_uses_separate_profit_and_expense_lanes(self) -> None:
        svg_root = render_sankey_svg(
            AMAZON_PAYLOAD,
            "zh",
            "amazon-q2-dominant-positive-lanes",
            quarter="2026Q2",
        )

        gross = visible_rect_attrs(svg_root, "gross")
        operating = visible_rect_attrs(svg_root, "operating")
        operating_expenses = visible_rect_attrs(svg_root, "operating-expenses")
        cost = visible_rect_attrs(svg_root, "cost")
        tax = visible_rect_attrs(svg_root, "deduction-0")
        positive = visible_rect_attrs(svg_root, "positive-0")
        net = visible_rect_attrs(svg_root, "net")
        opex_terminals = [
            visible_rect_attrs(svg_root, f"opex-{index}")
            for index in range(5)
        ]

        operating_center = operating["y"] + operating["height"] / 2
        self.assertLessEqual(
            gross["y"] - operating_center,
            150,
            "A dominant positive bridge should not pull operating profit too far above gross profit.",
        )
        self.assertGreaterEqual(
            cost["y"] - (gross["y"] + gross["height"]),
            150,
            "The lower cost lane should open clearly below the gross-profit node.",
        )
        self.assertGreaterEqual(
            operating_expenses["y"] - (gross["y"] + gross["height"]),
            -150,
            "Operating expenses should occupy the lower lane instead of overlapping most of gross profit.",
        )
        self.assertLessEqual(
            positive["y"] + positive["height"],
            net["y"] + net["height"] * 0.55,
            "The positive adjustment must remain in the upper profit lane.",
        )
        tax_center = tax["y"] + tax["height"] / 2
        tax_paths = [
            path
            for path in red_paths_between(svg_root, operating, tax)
            if abs(path_target_center(path) - tax_center) <= 1
        ]
        self.assertEqual(1, len(tax_paths))
        self.assertGreaterEqual(
            path_target_center(tax_paths[0]),
            path_start_center(tax_paths[0]) + 8,
            "Tax should flow downward from operating profit instead of turning upward.",
        )

        terminal_centers = [
            terminal["y"] + terminal["height"] / 2
            for terminal in opex_terminals
        ]
        self.assertGreaterEqual(
            terminal_centers[0],
            operating_expenses["y"] - 48,
            "The first expense terminal should leave the source almost level instead of rising sharply.",
        )
        self.assertTrue(
            all(lower > upper for upper, lower in zip(terminal_centers, terminal_centers[1:])),
            "Dense operating-expense terminals should form one orderly descending fan.",
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

    def test_berkshire_extreme_positive_bridge_avoids_top_right_label_collision(self) -> None:
        svg_root = render_sankey_svg(BERKSHIRE_PAYLOAD, "zh", "berkshire-zh", quarter="2023Q1")

        net = rect_attrs(svg_root, "net")
        positive = rect_attrs(svg_root, "positive-0")
        title_y = text_y(svg_root, "伯克希尔哈撒韦 Q1 FY23")
        period_end_y = text_y(svg_root, "截至 2023年3月31日")
        positive_label_y = text_y(svg_root, "营业外收益")
        positive_value_y = text_y(svg_root, "$34.2B")

        self.assertLessEqual(
            net["y"],
            208,
            "Extreme positive bridges should lift the net-profit node away from tax and expense branches.",
        )
        operating = rect_attrs(svg_root, "operating")
        self.assertLessEqual(
            positive["y"] + positive["height"],
            operating["y"] - 18,
            "Extreme positive bridges should keep the positive-adjustment node in an isolated top-right lane above operating profit.",
        )
        self.assertLessEqual(
            title_y,
            118,
            "Extra canvas height should let the header move up instead of scaling the whole chart downward.",
        )
        self.assertGreaterEqual(
            viewbox_height(svg_root),
            1800,
            "Extreme positive bridges should receive extra canvas height for a taller composition.",
        )
        self.assertGreaterEqual(
            positive_label_y - period_end_y,
            32,
            "Positive-adjustment labels should clear the inline period-end label without being pushed into the middle of the graph.",
        )
        self.assertLessEqual(
            positive_label_y,
            positive["y"] + positive["height"] * 0.7,
            "The positive-adjustment label should stay visually attached to the lifted positive node.",
        )

    def test_berkshire_extreme_positive_bridge_keeps_header_and_top_lane_separated(self) -> None:
        for quarter, title, period_end, value in (
            ("2023Q1", "伯克希尔哈撒韦 Q1 FY23", "截至 2023年3月31日", "$34.2B"),
            ("2023Q4", "伯克希尔哈撒韦 Q4 FY23", "截至 2023年12月31日", "$36.0B"),
        ):
            with self.subTest(quarter=quarter):
                svg_root = render_sankey_svg(BERKSHIRE_PAYLOAD, "zh", f"berkshire-{quarter.lower()}-zh", quarter=quarter)

                positive = rect_attrs(svg_root, "positive-0")
                title_y = text_y(svg_root, title)
                period_end_y = text_y(svg_root, period_end)
                positive_label_y = text_y(svg_root, "营业外收益")
                positive_value_y = text_y(svg_root, value)

                self.assertLessEqual(
                    title_y,
                    96,
                    "Extreme Berkshire bridges should reserve a high header lane instead of crowding the lifted gain node.",
                )
                self.assertLessEqual(
                    period_end_y,
                    80,
                    "The inline period-end label should move above the extreme positive-bridge lane.",
                )
                self.assertGreaterEqual(
                    positive["y"] - period_end_y,
                    30,
                    "The lifted positive node should not visually touch the period-end label.",
                )
                self.assertGreaterEqual(
                    positive_label_y - period_end_y,
                    88,
                    "The positive-adjustment label should clear the header/date area by a stable margin.",
                )
                self.assertGreaterEqual(
                    positive_value_y - period_end_y,
                    116,
                    "The positive-adjustment value should remain well below the header/date area.",
                )

    def test_berkshire_extreme_positive_bridge_uses_independent_top_lane(self) -> None:
        for quarter in ("2023Q1", "2023Q4"):
            with self.subTest(quarter=quarter):
                svg_root = render_sankey_svg(BERKSHIRE_PAYLOAD, "zh", f"berkshire-{quarter.lower()}-lane-zh", quarter=quarter)

                operating = rect_attrs(svg_root, "operating")
                positive = rect_attrs(svg_root, "positive-0")
                net = rect_attrs(svg_root, "net")

                self.assertGreaterEqual(
                    positive["x"] - (operating["x"] + operating["width"]),
                    150,
                    "Extreme positive bridge should move into a separate upper-right input lane instead of sitting on the operating-profit node.",
                )
                self.assertGreaterEqual(
                    positive["height"],
                    net["height"] * 0.88,
                    "Extreme positive bridge should keep its source thickness; the layout should move lanes instead of compressing the gain node.",
                )
                self.assertLessEqual(
                    positive["y"] + positive["height"],
                    operating["y"] - 18,
                    "Extreme positive bridge should not overlap the operating-profit node vertically.",
                )
                self.assertLessEqual(
                    operating["y"] - (positive["y"] + positive["height"]),
                    78,
                    "Extreme positive bridge should lift the gain node into the top lane instead of pushing operating profit far downward.",
                )
                self.assertLessEqual(
                    positive["y"],
                    105,
                    "Extreme positive bridge should sit high in the top-right lane, matching the manual layout direction.",
                )

    def test_berkshire_extreme_positive_bridge_labels_sit_left_of_gain_node(self) -> None:
        svg_root = render_sankey_svg(BERKSHIRE_PAYLOAD, "zh", "berkshire-2023q1-left-label-zh", quarter="2023Q1")

        positive = rect_attrs(svg_root, "positive-0")
        label_x = text_x(svg_root, "营业外收益")
        value_x = text_x(svg_root, "$34.2B")

        self.assertLessEqual(
            label_x,
            positive["x"] - 10,
            "Extreme positive bridge label should sit to the left of the green source node, not inside it.",
        )
        self.assertLessEqual(
            value_x,
            positive["x"] - 10,
            "Extreme positive bridge value should sit to the left of the green source node, not inside it.",
        )
        self.assertEqual("end", text_anchor(svg_root, "营业外收益"))
        self.assertEqual("end", text_anchor(svg_root, "$34.2B"))

    def test_berkshire_q4_gross_to_operating_ribbon_stays_attached_to_gross_node(self) -> None:
        svg_root = render_sankey_svg(BERKSHIRE_PAYLOAD, "zh", "berkshire-2025q4-continuity-zh", quarter="2025Q4")

        gross = rect_attrs(svg_root, "gross")
        operating = rect_attrs(svg_root, "operating")
        gross_to_operating_paths = green_paths_between(svg_root, gross, operating)

        self.assertEqual(1, len(gross_to_operating_paths), "Expected one green gross-profit to operating-profit ribbon.")
        path = gross_to_operating_paths[0]
        self.assertGreaterEqual(
            path_start_top(path),
            gross["y"] - 2,
            "The gross-profit ribbon should leave from inside the gross-profit node, not float above it.",
        )
        self.assertLessEqual(
            path_start_bottom(path),
            gross["y"] + gross["height"] + 2,
            "The gross-profit ribbon should remain attached to the gross-profit node.",
        )

    def test_berkshire_2020_q4_renders_full_profit_bridge(self) -> None:
        svg_root = render_sankey_svg(BERKSHIRE_PAYLOAD, "zh", "berkshire-2020q4-full-bridge-zh", quarter="2020Q4")
        text_content = svg_text_content(svg_root)

        self.assertNotIn("仅展示营收结构", text_content)
        self.assertIn("毛利润", text_content)
        self.assertIn("净利润", text_content)
        self.assertIsNotNone(find_rect(svg_root, "gross"))
        self.assertIsNotNone(find_rect(svg_root, "operating"))
        self.assertIsNotNone(find_rect(svg_root, "net"))

    def test_berkshire_net_loss_result_sits_below_tax_benefit_lane(self) -> None:
        svg_root = render_sankey_svg(BERKSHIRE_PAYLOAD, "zh", "berkshire-2022q2-net-loss-zh", quarter="2022Q2")
        text_content = svg_text_content(svg_root)

        net = rect_attrs(svg_root, "net")
        tax_benefit = rect_attrs(svg_root, "positive-0")
        loss_driver = rect_attrs(svg_root, "net-loss-driver-0")
        visible_loss_driver = visible_rect_attrs(svg_root, "net-loss-driver-0")

        self.assertIn("税项收益", text_content)
        self.assertNotIn("税项benefit", text_content)
        self.assertEqual(
            1,
            text_count(svg_root, "营业外费用"),
            "The primary loss driver should be promoted into the net-loss bridge instead of being duplicated as a separate terminal.",
        )
        self.assertGreaterEqual(
            net["y"],
            tax_benefit["y"] + tax_benefit["height"] + 28,
            "Net-loss result should sit below the tax-benefit lane so the benefit reads as an offset, not as an inflow that enlarges the loss.",
        )
        self.assertLess(
            loss_driver["x"] + loss_driver["width"],
            net["x"],
            "The primary loss driver should be a visible source node feeding into the net-loss result.",
        )
        self.assertGreaterEqual(
            min(loss_driver["y"] + loss_driver["height"], net["y"] + net["height"]) - max(loss_driver["y"], net["y"]),
            net["height"] * 0.6,
            "The primary loss-driver node should overlap the net-loss result vertically enough to make the large loss source visually obvious.",
        )
        driver_paths = red_paths_between(svg_root, loss_driver, net)
        self.assertEqual(
            1,
            len(driver_paths),
            "The large non-operating expense must render as one direct red ribbon into net loss.",
        )
        self.assertGreaterEqual(
            path_target_center(driver_paths[0]),
            net["y"] + net["height"] * 0.35,
            "The large loss-driver ribbon should enter the body of the net-loss node, not clip into its top edge.",
        )
        self.assertLessEqual(
            path_target_center(driver_paths[0]),
            net["y"] + net["height"] * 0.65,
            "The large loss-driver ribbon should enter the body of the net-loss node, not clip into its bottom edge.",
        )
        self.assertLessEqual(
            abs(path_start_height(driver_paths[0]) - path_target_height(driver_paths[0])),
            4,
            "The visible net-loss driver ribbon should keep a constant thickness instead of tapering from the full loss-driver node.",
        )
        expected_source_top = visible_loss_driver["y"] + visible_loss_driver["height"] - path_start_height(driver_paths[0])
        self.assertAlmostEqual(
            expected_source_top,
            path_start_top(driver_paths[0]),
            delta=4,
            msg="The net-loss ribbon should leave from the lower residual-loss segment, not from the middle of the full loss-driver node.",
        )
        self.assertIn(
            "营业利润及税项收益",
            text_content,
            "The excess non-operating-expense segment should be explicitly labeled as offset by operating profit and tax benefit.",
        )
        self.assertIn("另含其他净费用", text_content)
        downstream_opex_tops = [
            path_start_top(numbers)
            for numbers in red_path_numbers(svg_root)
            if numbers[0] < loss_driver["x"] and max(numbers[0::2]) > loss_driver["x"]
        ]
        self.assertTrue(downstream_opex_tops, "Expected downstream operating-expense ribbons near the net-loss bridge.")
        self.assertLessEqual(
            text_y(svg_root, "另含其他净费用 ($0.6B)"),
            max(downstream_opex_tops) - 12,
            "The other-loss detail label should sit above the lower red expense ribbon instead of being overdrawn by it.",
        )

    def test_berkshire_q3_net_loss_bridge_labels_do_not_collide(self) -> None:
        svg_root = render_sankey_svg(BERKSHIRE_PAYLOAD, "zh", "berkshire-2022q3-net-loss-zh", quarter="2022Q3")
        text_content = svg_text_content(svg_root)

        self.assertIn("营业利润及税项收益", text_content)
        self.assertIn("抵减 +$11.5B", text_content)
        self.assertIn("营业外费用", text_content)
        self.assertGreaterEqual(
            text_y(svg_root, "营业利润及税项收益") - text_y(svg_root, "$1.5B"),
            42,
            "The tax-benefit value should not collide with the net-loss offset label.",
        )
        self.assertGreaterEqual(
            text_y(svg_root, "营业外费用") - text_y(svg_root, "抵减 +$11.5B"),
            36,
            "The non-operating expense label should sit below the offset label with readable spacing.",
        )

if __name__ == "__main__":
    unittest.main()
