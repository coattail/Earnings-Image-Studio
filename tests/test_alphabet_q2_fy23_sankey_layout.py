import json
import re
import subprocess
import tempfile
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
NODE_RENDERER = ROOT_DIR / "scripts" / "direct_chart_render.cjs"
ALPHABET_PAYLOAD = ROOT_DIR / "data" / "cache" / "alphabet.json"
SVG_NS = {"svg": "http://www.w3.org/2000/svg"}
GREEN_FLOW = "#ACDBA3"


def render_alphabet_q2_fy23_svg() -> ET.Element:
    with tempfile.TemporaryDirectory(prefix="alphabet-q2-fy23-layout-") as temp_dir:
        output_dir = Path(temp_dir)
        result = subprocess.run(
            [
                "node",
                str(NODE_RENDERER),
                "--payload",
                str(ALPHABET_PAYLOAD),
                "--quarter",
                "2023Q2",
                "--language",
                "zh",
                "--modes",
                "sankey",
                "--output-dir",
                str(output_dir),
                "--basename",
                "alphabet-q2-fy23",
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


def path_points(path_d: str) -> list[tuple[float, float]]:
    numbers = [float(match.group(0)) for match in re.finditer(r"-?\d+(?:\.\d+)?", path_d)]
    return list(zip(numbers[0::2], numbers[1::2]))


def green_path_between(
    svg_root: ET.Element,
    source: dict[str, float],
    target: dict[str, float],
) -> list[tuple[float, float]]:
    source_right = source["x"] + source["width"]
    target_left = target["x"]
    for path in svg_root.findall(".//svg:path", SVG_NS):
        if path.attrib.get("fill", "").upper() != GREEN_FLOW:
            continue
        points = path_points(path.attrib.get("d", ""))
        if not points or abs(points[0][0] - source_right) > 1.0:
            continue
        if any(target_left - 1.0 <= x <= target_left + 24 for x, _y in points):
            return points
    raise AssertionError("Missing green path between the requested profit nodes")


def boundary_y_at_x(points: list[tuple[float, float]], x_target: float) -> float:
    candidates = [y for x, y in points if abs(x - x_target) <= 1.0]
    if not candidates:
        raise AssertionError(f"Path does not reach x={x_target}")
    return min(candidates)


def target_boundary_y(points: list[tuple[float, float]], target_left: float) -> float:
    candidates = [y for x, y in points if target_left - 1.0 <= x <= target_left + 24]
    if not candidates:
        raise AssertionError(f"Path does not reach target x={target_left}")
    return min(candidates)


class AlphabetQ2FY23SankeyLayoutTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.svg_root = render_alphabet_q2_fy23_svg()

    def test_operating_profit_softens_the_main_green_chain_turn(self) -> None:
        gross = visible_rect(self.svg_root, "gross")
        operating = visible_rect(self.svg_root, "operating")
        net = visible_rect(self.svg_root, "net")
        gross_to_operating = green_path_between(self.svg_root, gross, operating)
        operating_to_net = green_path_between(self.svg_root, operating, net)

        gross_top = boundary_y_at_x(gross_to_operating, gross["x"] + gross["width"])
        operating_top = target_boundary_y(gross_to_operating, operating["x"])
        net_core_top = target_boundary_y(operating_to_net, net["x"])
        incoming_run = operating["x"] - (gross["x"] + gross["width"])
        outgoing_run = net["x"] - (operating["x"] + operating["width"])
        straight_chain_top = (
            gross_top * outgoing_run + net_core_top * incoming_run
        ) / (incoming_run + outgoing_run)

        self.assertLessEqual(
            operating_top - straight_chain_top,
            36,
            "Operating profit should stay near the smooth gross-to-net trajectory instead of creating a sharp late elbow.",
        )
        self.assertGreaterEqual(
            gross["y"] - operating["y"],
            70,
            "Alphabet Q2 FY23 needs a visible lift at operating profit so the main green band rises progressively.",
        )


if __name__ == "__main__":
    unittest.main()
