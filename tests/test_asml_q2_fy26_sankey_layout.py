import json
import subprocess
import tempfile
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
NODE_RENDERER = ROOT_DIR / "scripts" / "direct_chart_render.cjs"
ASML_PAYLOAD = ROOT_DIR / "data" / "cache" / "asml.json"
SVG_NS = {"svg": "http://www.w3.org/2000/svg"}


def render_asml_q2_svg() -> ET.Element:
    with tempfile.TemporaryDirectory(prefix="asml-q2-fy26-layout-") as temp_dir:
        output_dir = Path(temp_dir)
        result = subprocess.run(
            [
                "node",
                str(NODE_RENDERER),
                "--payload",
                str(ASML_PAYLOAD),
                "--quarter",
                "2026Q2",
                "--language",
                "en",
                "--modes",
                "sankey",
                "--output-dir",
                str(output_dir),
                "--basename",
                "asml-q2-fy26",
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


class AsmlQ2FY26SankeyLayoutTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.svg_root = render_asml_q2_svg()

    def test_profit_nodes_form_the_reference_upward_staircase(self) -> None:
        gross = visible_rect(self.svg_root, "gross")
        operating = visible_rect(self.svg_root, "operating")
        net = visible_rect(self.svg_root, "net")

        self.assertGreaterEqual(gross["y"] - operating["y"], 50)
        self.assertLessEqual(gross["y"] - operating["y"], 70)
        self.assertGreaterEqual(operating["y"] - net["y"], 175)
        self.assertLessEqual(operating["y"] - net["y"], 195)

    def test_system_sales_detail_nodes_are_lifted_and_compacted(self) -> None:
        details = [visible_rect(self.svg_root, f"left-detail-{index}") for index in range(6)]

        self.assertLessEqual(details[0]["y"], 175)
        self.assertLessEqual(details[-1]["y"], 1050)
        self.assertLessEqual(details[-1]["y"] - details[0]["y"], 880)

        for current, following in zip(details, details[1:]):
            self.assertGreaterEqual(
                following["y"] - (current["y"] + current["height"]),
                70,
                "Compacting the ASML detail fan must still leave room for its metric labels.",
            )

    def test_horizontal_stage_spacing_is_unchanged(self) -> None:
        revenue = visible_rect(self.svg_root, "revenue")
        gross = visible_rect(self.svg_root, "gross")
        operating = visible_rect(self.svg_root, "operating")
        net = visible_rect(self.svg_root, "net")
        stage_gaps = [
            gross["x"] - revenue["x"],
            operating["x"] - gross["x"],
            net["x"] - operating["x"],
        ]

        self.assertLessEqual(max(stage_gaps) - min(stage_gaps), 0.1)


if __name__ == "__main__":
    unittest.main()
