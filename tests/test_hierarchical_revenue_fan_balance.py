import json
import subprocess
import tempfile
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
NODE_RENDERER = ROOT_DIR / "scripts" / "direct_chart_render.cjs"
SVG_NS = {"svg": "http://www.w3.org/2000/svg"}
COMPANY_QUARTERS = {
    "nvidia": "2026Q2",
    "apple": "2026Q1",
    "tesla": "2026Q2",
    "tencent": "2026Q1",
    "asml": "2026Q2",
}


def render_company_svg(
    company: str,
    quarter: str,
    node_overrides: dict[str, dict[str, float]] | None = None,
) -> ET.Element:
    with tempfile.TemporaryDirectory(prefix=f"{company}-hierarchical-revenue-") as temp_dir:
        command = [
            "node",
            str(NODE_RENDERER),
            "--payload",
            str(ROOT_DIR / "data" / "cache" / f"{company}.json"),
            "--quarter",
            quarter,
            "--language",
            "en",
            "--modes",
            "sankey",
            "--output-dir",
            temp_dir,
            "--basename",
            company,
        ]
        if node_overrides:
            command.extend(["--node-overrides", json.dumps(node_overrides)])
        result = subprocess.run(
            command,
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
        "y": float(rect.attrib["y"]),
        "height": float(rect.attrib["height"]),
    }


def detail_rects(svg_root: ET.Element) -> list[dict[str, float]]:
    details = []
    index = 0
    while True:
        rect = svg_root.find(
            f".//svg:rect[@data-edit-node-visible-id='left-detail-{index}']",
            SVG_NS,
        )
        if rect is None:
            return details
        details.append({"y": float(rect.attrib["y"]), "height": float(rect.attrib["height"])})
        index += 1


class HierarchicalRevenueFanBalanceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.svg_roots = {
            company: render_company_svg(company, quarter)
            for company, quarter in COMPANY_QUARTERS.items()
        }

    def test_detail_flow_centers_align_with_their_parent_revenue_nodes(self) -> None:
        for company in ("nvidia", "tencent"):
            svg_root = self.svg_roots[company]
            with self.subTest(company=company):
                details = detail_rects(svg_root)
                parent = visible_rect(svg_root, "source-0")
                self.assertGreaterEqual(len(details), 2)

                detail_flow_center = sum(
                    (detail["y"] + detail["height"] / 2) * detail["height"]
                    for detail in details
                ) / sum(detail["height"] for detail in details)
                parent_center = parent["y"] + parent["height"] / 2

                self.assertAlmostEqual(
                    detail_flow_center,
                    parent_center,
                    delta=1,
                    msg=f"{company} detail revenue should enter its parent without an upward or downward bias",
                )

    def test_extreme_outer_dominant_fan_enters_tesla_auto_business_symmetrically(self) -> None:
        svg_root = self.svg_roots["tesla"]
        details = detail_rects(svg_root)
        parent = visible_rect(svg_root, "source-0")
        revenue = visible_rect(svg_root, "revenue")

        self.assertEqual(len(details), 3)
        self.assertGreater(
            details[0]["height"] / sum(detail["height"] for detail in details),
            0.95,
        )

        target_cursor = parent["y"]
        merge_deltas = []
        for detail in details:
            target_center = target_cursor + detail["height"] / 2
            source_center = detail["y"] + detail["height"] / 2
            merge_deltas.append(target_center - source_center)
            target_cursor += detail["height"]

        self.assertGreaterEqual(
            merge_deltas[0],
            parent["height"] * 0.18,
            "Automotive sales should descend visibly into the Auto business node.",
        )
        self.assertLessEqual(
            merge_deltas[1],
            -parent["height"] * 0.18,
            "Automotive leasing should rise visibly into the Auto business node.",
        )
        self.assertAlmostEqual(
            merge_deltas[0],
            -merge_deltas[1],
            delta=parent["height"] * 0.06,
            msg="The two principal Auto detail ribbons should enter from balanced upper and lower angles.",
        )

        parent_center = parent["y"] + parent["height"] / 2
        automotive_revenue_target_center = revenue["y"] + parent["height"] / 2
        self.assertGreater(
            automotive_revenue_target_center - parent_center,
            0,
            "The Auto business outflow should continue descending after the balanced detail merge.",
        )

    def test_outer_dominant_sparse_fan_uses_a_progressive_merge_angle(self) -> None:
        svg_root = self.svg_roots["apple"]
        details = detail_rects(svg_root)
        parent = visible_rect(svg_root, "source-0")

        self.assertEqual(len(details), 4)
        self.assertGreater(details[0]["height"] / sum(detail["height"] for detail in details), 0.62)

        target_cursor = parent["y"]
        merge_direction_deltas = []
        for detail in details:
            target_center = target_cursor + detail["height"] / 2
            source_center = detail["y"] + detail["height"] / 2
            merge_direction_deltas.append(target_center - source_center)
            target_cursor += detail["height"]

        self.assertGreaterEqual(
            merge_direction_deltas[0],
            parent["height"] * 0.35,
            "A dominant first detail should launch high enough to enter the parent through a smooth descending curve.",
        )
        for current_delta, following_delta in zip(merge_direction_deltas, merge_direction_deltas[1:]):
            self.assertGreaterEqual(
                current_delta - following_delta,
                parent["height"] * 0.32,
                "Sparse detail merge directions should progress evenly instead of forming a hard local corner.",
            )

    def test_detail_nodes_keep_their_published_order_without_overlap(self) -> None:
        for company, svg_root in self.svg_roots.items():
            with self.subTest(company=company):
                details = detail_rects(svg_root)
                for current, following in zip(details, details[1:]):
                    self.assertGreaterEqual(following["y"], current["y"] + current["height"])

    def test_dragging_parent_and_detail_nodes_keeps_every_other_node_fixed(self) -> None:
        base_root = self.svg_roots["asml"]
        parent_drag_root = render_company_svg(
            "asml",
            COMPANY_QUARTERS["asml"],
            {"source-0": {"dx": 0, "dy": 100}},
        )
        detail_drag_root = render_company_svg(
            "asml",
            COMPANY_QUARTERS["asml"],
            {"left-detail-0": {"dx": 0, "dy": 100}},
        )

        self.assertAlmostEqual(
            visible_rect(parent_drag_root, "source-0")["y"] - visible_rect(base_root, "source-0")["y"],
            100,
            delta=0.1,
        )
        for index in range(6):
            node_id = f"left-detail-{index}"
            self.assertAlmostEqual(
                visible_rect(parent_drag_root, node_id)["y"],
                visible_rect(base_root, node_id)["y"],
                delta=0.1,
            )

        self.assertAlmostEqual(
            visible_rect(detail_drag_root, "left-detail-0")["y"]
            - visible_rect(base_root, "left-detail-0")["y"],
            100,
            delta=0.1,
        )
        self.assertAlmostEqual(
            visible_rect(detail_drag_root, "source-0")["y"],
            visible_rect(base_root, "source-0")["y"],
            delta=0.1,
        )
        for index in range(1, 6):
            node_id = f"left-detail-{index}"
            self.assertAlmostEqual(
                visible_rect(detail_drag_root, node_id)["y"],
                visible_rect(base_root, node_id)["y"],
                delta=0.1,
            )


if __name__ == "__main__":
    unittest.main()
