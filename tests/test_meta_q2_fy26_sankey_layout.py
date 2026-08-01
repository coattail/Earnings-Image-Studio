import json
import subprocess
import tempfile
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
NODE_RENDERER = ROOT_DIR / "scripts" / "direct_chart_render.cjs"
META_PAYLOAD = ROOT_DIR / "data" / "cache" / "meta.json"
SVG_NS = {"svg": "http://www.w3.org/2000/svg"}


def render_meta_q2_fy26_svg() -> ET.Element:
    with tempfile.TemporaryDirectory(prefix="meta-q2-fy26-layout-") as temp_dir:
        output_dir = Path(temp_dir)
        result = subprocess.run(
            [
                "node",
                str(NODE_RENDERER),
                "--payload",
                str(META_PAYLOAD),
                "--quarter",
                "2026Q2",
                "--language",
                "zh",
                "--modes",
                "sankey",
                "--output-dir",
                str(output_dir),
                "--basename",
                "meta-q2-fy26",
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


class MetaQ2FY26SankeyLayoutTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.svg_root = render_meta_q2_fy26_svg()

    def test_high_retention_net_profit_finishes_in_a_gently_lifted_lane(self) -> None:
        operating = visible_rect(self.svg_root, "operating")
        net = visible_rect(self.svg_root, "net")

        self.assertLessEqual(
            net["y"],
            372,
            "Meta's high-retention net-profit node should receive a modest finishing lift.",
        )
        self.assertGreaterEqual(
            operating["y"] - net["y"],
            165,
            "The main green ribbon should continue opening upward into net profit.",
        )


if __name__ == "__main__":
    unittest.main()
