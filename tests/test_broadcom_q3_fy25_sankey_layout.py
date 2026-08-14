import json
import re
import subprocess
import tempfile
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
NODE_RENDERER = ROOT_DIR / "scripts" / "direct_chart_render.cjs"
BROADCOM_PAYLOAD = ROOT_DIR / "data" / "cache" / "broadcom.json"
SVG_NS = {"svg": "http://www.w3.org/2000/svg"}


def render_broadcom_svg(quarter: str = "2025Q3") -> ET.Element:
    with tempfile.TemporaryDirectory(prefix="broadcom-q3-fy25-layout-") as temp_dir:
        result = subprocess.run(
            [
                "node",
                str(NODE_RENDERER),
                "--payload",
                str(BROADCOM_PAYLOAD),
                "--quarter",
                quarter,
                "--language",
                "en",
                "--modes",
                "sankey",
                "--output-dir",
                temp_dir,
                "--basename",
                f"broadcom-{quarter.lower()}",
            ],
            cwd=ROOT_DIR,
            check=True,
            capture_output=True,
            text=True,
        )
        summary = json.loads(result.stdout)
        svg_path = Path(summary["outputs"]["sankey"]["svg"])
        return ET.fromstring(svg_path.read_text(encoding="utf-8"))


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


def path_numbers(path_d: str) -> list[float]:
    return [float(match.group(0)) for match in re.finditer(r"-?\d+(?:\.\d+)?", path_d)]


def red_paths_between(
    svg_root: ET.Element,
    source: dict[str, float],
    target: dict[str, float],
) -> list[list[float]]:
    source_right = source["x"] + source["width"]
    target_left = target["x"]
    matches: list[list[float]] = []
    for path in svg_root.findall(".//svg:path", SVG_NS):
        if path.attrib.get("fill", "").upper() != "#E58A92":
            continue
        numbers = path_numbers(path.attrib.get("d", ""))
        if len(numbers) < 18:
            continue
        reaches_target = any(
            abs(value - (target_left + 12)) <= 18
            for index, value in enumerate(numbers)
            if index % 2 == 0
        )
        if abs(numbers[0] - (source_right - 12)) <= 24 and reaches_target:
            matches.append(numbers)
    return matches


def path_start_center(numbers: list[float]) -> float:
    return (numbers[1] + numbers[-1]) / 2


def path_target_center(numbers: list[float]) -> float:
    return (numbers[11] + numbers[13]) / 2


class BroadcomQ3FY25SankeyLayoutTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.svg_root = render_broadcom_svg()

    def test_operating_stage_balances_the_gross_profit_split(self) -> None:
        gross = visible_rect(self.svg_root, "gross")
        operating = visible_rect(self.svg_root, "operating")
        operating_expenses = visible_rect(self.svg_root, "operating-expenses")

        upper_opening = gross["y"] - operating["y"]
        lower_opening = operating_expenses["y"] - (gross["y"] + operating["height"])

        self.assertGreaterEqual(upper_opening, 75)
        self.assertLessEqual(upper_opening, 100)
        self.assertGreaterEqual(lower_opening, 70)
        self.assertLessEqual(abs(lower_opening - upper_opening), 30)

    def test_profit_nodes_form_a_smooth_upward_staircase(self) -> None:
        gross = visible_rect(self.svg_root, "gross")
        operating = visible_rect(self.svg_root, "operating")
        net = visible_rect(self.svg_root, "net")

        self.assertGreaterEqual(gross["y"] - operating["y"], 75)
        self.assertLessEqual(gross["y"] - operating["y"], 100)
        self.assertGreaterEqual(operating["y"] - net["y"], 90)
        self.assertLessEqual(operating["y"] - net["y"], 135)

    def test_opex_terminal_branches_never_rise_to_the_right(self) -> None:
        operating_expenses = visible_rect(self.svg_root, "operating-expenses")
        terminals = [visible_rect(self.svg_root, f"opex-{index}") for index in range(2)]
        source_top = operating_expenses["y"]

        for index, terminal in enumerate(terminals):
            with self.subTest(index=index):
                self.assertGreaterEqual(
                    terminal["y"],
                    source_top + 20,
                    "Each red expense ribbon must finish below the top of its source slice.",
                )
            source_top += terminal["height"]

        for index in range(1, len(terminals)):
            with self.subTest(gap=index):
                self.assertGreaterEqual(terminals[index]["y"] - terminals[index - 1]["y"], 140)

    def test_q4_fy24_sparse_opex_ribbons_keep_flowing_downward(self) -> None:
        svg_root = render_broadcom_svg("2024Q4")
        operating_expenses = visible_rect(svg_root, "operating-expenses")
        terminals = [visible_rect(svg_root, f"opex-{index}") for index in range(2)]
        drops: list[float] = []

        for index, terminal in enumerate(terminals):
            paths = red_paths_between(svg_root, operating_expenses, terminal)
            target_center = terminal["y"] + terminal["height"] / 2
            paths = [path for path in paths if abs(path_target_center(path) - target_center) <= 1]
            self.assertEqual(len(paths), 1)
            drops.append(path_target_center(paths[0]) - path_start_center(paths[0]))

        self.assertGreaterEqual(
            drops[0],
            20,
            "The first operating-expense ribbon must not turn upward even when positive adjustments use the top lane.",
        )
        for index in range(1, len(drops)):
            with self.subTest(index=index):
                self.assertGreaterEqual(
                    drops[index],
                    drops[index - 1] + 50,
                    "Official operating-expense branches should form an increasingly downward fan.",
                )


if __name__ == "__main__":
    unittest.main()
