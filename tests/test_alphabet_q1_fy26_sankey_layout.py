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


def render_alphabet_svg() -> ET.Element:
    with tempfile.TemporaryDirectory(prefix="alphabet-q1-fy26-layout-") as temp_dir:
        output_dir = Path(temp_dir)
        result = subprocess.run(
            [
                "node",
                str(NODE_RENDERER),
                "--payload",
                str(ALPHABET_PAYLOAD),
                "--quarter",
                "2026Q1",
                "--language",
                "en",
                "--modes",
                "sankey",
                "--output-dir",
                str(output_dir),
                "--basename",
                "alphabet-q1-fy26",
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


def source_revenue_path_by_fill(svg_root: ET.Element, fill: str) -> list[float]:
    for path in svg_root.findall(".//svg:path", SVG_NS):
        if path.attrib.get("fill") != fill:
            continue
        numbers = path_numbers(path.attrib.get("d", ""))
        if len(numbers) >= 14:
            return numbers
    raise AssertionError(f"Missing source-to-revenue path with fill {fill}")


def path_start_center(numbers: list[float]) -> float:
    return (numbers[1] + numbers[-1]) / 2


def path_target_center(numbers: list[float]) -> float:
    return (numbers[11] + numbers[13]) / 2


class AlphabetQ1FY26SankeyLayoutTests(unittest.TestCase):
    def test_regular_revenue_sources_share_a_stable_left_column(self) -> None:
        svg_root = render_alphabet_svg()

        peer_source_xs = [
            visible_rect(svg_root, "source-1")["x"],  # Google Cloud
            visible_rect(svg_root, "source-2")["x"],  # Google Play
            visible_rect(svg_root, "source-3")["x"],  # Other revenue
        ]

        self.assertLessEqual(
            max(peer_source_xs) - min(peer_source_xs),
            1.0,
            "Peer regular revenue sources after an expanded detail group should align to one clean column.",
        )

    def test_profit_chain_uses_smooth_rising_staircase(self) -> None:
        svg_root = render_alphabet_svg()

        revenue = visible_rect(svg_root, "revenue")
        gross = visible_rect(svg_root, "gross")
        operating = visible_rect(svg_root, "operating")
        net = visible_rect(svg_root, "net")

        self.assertLessEqual(
            revenue["y"],
            596,
            "Alphabet's learned manual revenue placement should remain high enough for a smoother revenue-to-gross bridge.",
        )
        self.assertLessEqual(
            gross["y"],
            642,
            "Gross profit should follow the learned manual placement without forcing a late sharp upward bend.",
        )
        self.assertLessEqual(
            net["y"],
            252,
            "Net profit should lift with the main green chain so the operating-to-net bridge stays smooth.",
        )
        self.assertLessEqual(
            gross["y"] - operating["y"],
            190,
            "Gross-to-operating should be a smooth rise, not a sharp elbow caused by an over-lifted operating node.",
        )

    def test_lower_revenue_sources_enter_revenue_without_top_heavy_cloud_slope(self) -> None:
        svg_root = render_alphabet_svg()

        cloud_path = source_revenue_path_by_fill(svg_root, "rgba(246, 194, 68, 0.58)")
        play_path = source_revenue_path_by_fill(svg_root, "rgba(168, 171, 180, 0.58)")
        other_path = source_revenue_path_by_fill(svg_root, "rgba(139, 203, 155, 0.58)")

        self.assertGreaterEqual(
            path_start_center(cloud_path),
            path_target_center(cloud_path) - 8,
            "Google Cloud should enter Revenue nearly flat or slightly from below, not from a visibly higher source lane.",
        )
        self.assertGreaterEqual(
            path_start_center(play_path),
            path_target_center(play_path) + 45,
            "Lower non-ad revenue sources should still clearly flow upward into Revenue.",
        )
        self.assertGreaterEqual(
            path_start_center(other_path),
            path_target_center(other_path) + 120,
            "Tiny lower non-ad revenue sources should keep an upward entry, preserving the lower fan.",
        )

    def test_right_expense_terminals_form_a_compact_fan(self) -> None:
        svg_root = render_alphabet_svg()

        tax = visible_rect(svg_root, "deduction-0")
        rnd = visible_rect(svg_root, "opex-0")
        sgna = visible_rect(svg_root, "opex-1")

        self.assertGreaterEqual(
            rnd["y"] - (tax["y"] + tax["height"]),
            80,
            "Tax and R&D should remain visibly separated in the right-side fan.",
        )
        self.assertLessEqual(
            sgna["y"] - (rnd["y"] + rnd["height"]),
            160,
            "R&D and SG&A should fan out compactly instead of leaving an overly large empty gap.",
        )


if __name__ == "__main__":
    unittest.main()
