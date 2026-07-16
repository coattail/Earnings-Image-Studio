import json
import subprocess
import tempfile
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
NODE_RENDERER = ROOT_DIR / "scripts" / "direct_chart_render.cjs"
BROADCOM_PAYLOAD = ROOT_DIR / "data" / "cache" / "broadcom.json"
SVG_NS = {"svg": "http://www.w3.org/2000/svg"}


def render_broadcom_q3_svg() -> ET.Element:
    with tempfile.TemporaryDirectory(prefix="broadcom-q3-fy25-layout-") as temp_dir:
        result = subprocess.run(
            [
                "node",
                str(NODE_RENDERER),
                "--payload",
                str(BROADCOM_PAYLOAD),
                "--quarter",
                "2025Q3",
                "--language",
                "en",
                "--modes",
                "sankey",
                "--output-dir",
                temp_dir,
                "--basename",
                "broadcom-q3-fy25",
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


class BroadcomQ3FY25SankeyLayoutTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.svg_root = render_broadcom_q3_svg()

    def test_operating_stage_balances_the_gross_profit_split(self) -> None:
        gross = visible_rect(self.svg_root, "gross")
        operating = visible_rect(self.svg_root, "operating")
        operating_expenses = visible_rect(self.svg_root, "operating-expenses")

        upper_opening = gross["y"] - operating["y"]
        lower_opening = operating_expenses["y"] - (gross["y"] + operating["height"])

        self.assertGreaterEqual(upper_opening, 75)
        self.assertLessEqual(upper_opening, 100)
        self.assertGreaterEqual(lower_opening, upper_opening)
        self.assertLessEqual(lower_opening - upper_opening, 30)

    def test_profit_nodes_form_a_smooth_upward_staircase(self) -> None:
        gross = visible_rect(self.svg_root, "gross")
        operating = visible_rect(self.svg_root, "operating")
        net = visible_rect(self.svg_root, "net")

        self.assertGreaterEqual(gross["y"] - operating["y"], 75)
        self.assertLessEqual(gross["y"] - operating["y"], 100)
        self.assertGreaterEqual(operating["y"] - net["y"], 90)
        self.assertLessEqual(operating["y"] - net["y"], 120)

    def test_opex_terminal_branches_never_rise_to_the_right(self) -> None:
        operating_expenses = visible_rect(self.svg_root, "operating-expenses")
        terminals = [visible_rect(self.svg_root, f"opex-{index}") for index in range(3)]
        source_top = operating_expenses["y"]

        for index, terminal in enumerate(terminals):
            with self.subTest(index=index):
                self.assertGreaterEqual(
                    terminal["y"],
                    source_top + 20,
                    "Each red expense ribbon must finish below the top of its source slice.",
                )
            source_top += terminal["height"]

        self.assertGreaterEqual(terminals[1]["y"] - terminals[0]["y"], 180)
        self.assertGreaterEqual(terminals[2]["y"] - terminals[1]["y"], 165)


if __name__ == "__main__":
    unittest.main()
