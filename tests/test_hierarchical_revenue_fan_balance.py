from __future__ import annotations

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
    "tencent": "2026Q2",
    "asml": "2026Q2",
    "alibaba": "2025Q4",
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
        "x": float(rect.attrib["x"]),
        "y": float(rect.attrib["y"]),
        "width": float(rect.attrib["width"]),
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
        details.append(
            {
                "x": float(rect.attrib["x"]),
                "y": float(rect.attrib["y"]),
                "width": float(rect.attrib["width"]),
                "height": float(rect.attrib["height"]),
            }
        )
        index += 1


def source_rects(svg_root: ET.Element) -> list[dict[str, float]]:
    sources = []
    index = 0
    while True:
        rect = svg_root.find(
            f".//svg:rect[@data-edit-node-visible-id='source-{index}']",
            SVG_NS,
        )
        if rect is None:
            return sources
        sources.append(
            {
                "x": float(rect.attrib["x"]),
                "y": float(rect.attrib["y"]),
                "width": float(rect.attrib["width"]),
                "height": float(rect.attrib["height"]),
            }
        )
        index += 1


class HierarchicalRevenueFanBalanceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.svg_roots = {
            company: render_company_svg(company, quarter)
            for company, quarter in COMPANY_QUARTERS.items()
        }
        cls.alibaba_dense_source_roots = {
            quarter: render_company_svg("alibaba", quarter)
            for quarter in ("2021Q4", "2022Q4", "2024Q4", "2025Q1")
        }

    def test_sparse_detail_fan_continues_parent_outflow_direction(self) -> None:
        svg_root = self.svg_roots["tencent"]
        details = detail_rects(svg_root)
        parent = visible_rect(svg_root, "source-0")
        revenue = visible_rect(svg_root, "revenue")
        self.assertEqual(len(details), 3)

        detail_flow_center = sum(
            (detail["y"] + detail["height"] / 2) * detail["height"]
            for detail in details
        ) / sum(detail["height"] for detail in details)
        parent_center = parent["y"] + parent["height"] / 2
        parent_revenue_band_center = revenue["y"] + parent["height"] / 2
        incoming_run = parent["x"] - (details[0]["x"] + details[0]["width"])
        outgoing_run = revenue["x"] - (parent["x"] + parent["width"])
        incoming_slope = (parent_center - detail_flow_center) / incoming_run
        outgoing_slope = (parent_revenue_band_center - parent_center) / outgoing_run

        self.assertGreater(incoming_slope, 0)
        self.assertGreater(outgoing_slope, 0)
        self.assertAlmostEqual(
            incoming_slope / outgoing_slope,
            0.46,
            delta=0.08,
            msg="The incoming detail fan should inherit the parent's downstream direction instead of forming a centered elbow.",
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

    def test_every_revenue_source_keeps_the_same_vertical_order_as_its_target_band(self) -> None:
        for company, svg_root in self.svg_roots.items():
            with self.subTest(company=company):
                sources = source_rects(svg_root)
                for current, following in zip(sources, sources[1:]):
                    self.assertGreaterEqual(
                        following["y"],
                        current["y"] + current["height"],
                        "Revenue source nodes must not reverse order before entering the revenue stack.",
                    )

    def test_alibaba_q3_fy26_detail_groups_cannot_cross_between_parent_segments(self) -> None:
        details = detail_rects(self.svg_roots["alibaba"])
        self.assertEqual(len(details), 6)
        self.assertGreaterEqual(
            details[4]["y"],
            details[3]["y"] + details[3]["height"],
            "International commerce must stay below the final China-commerce detail so the two ribbons cannot cross.",
        )

    def test_alibaba_q3_fy26_dense_detail_fan_uses_the_full_left_canvas(self) -> None:
        svg_root = self.svg_roots["alibaba"]
        details = detail_rects(svg_root)
        sources = source_rects(svg_root)
        gaps = [
            following["y"] - (current["y"] + current["height"])
            for current, following in zip(details, details[1:])
        ]

        self.assertLess(
            details[0]["y"],
            sources[0]["y"] - sources[0]["height"] * 0.6,
            "The first detail should launch high enough to create a broad, readable fan.",
        )
        self.assertGreater(
            details[-1]["y"],
            sources[1]["y"] + sources[1]["height"],
            "The final detail should finish below International Commerce instead of collapsing into the China cluster.",
        )
        self.assertGreater(min(gaps), 60)
        self.assertLess(
            max(gaps) / min(gaps),
            2,
            "Dense hierarchical detail rows should have a deliberate visual rhythm instead of one oversized dead zone.",
        )

        net = visible_rect(svg_root, "net")
        operating = visible_rect(svg_root, "operating")
        gross = visible_rect(svg_root, "gross")
        self.assertLess(net["y"] + net["height"], operating["y"])
        self.assertLess(operating["y"] + operating["height"], gross["y"])

    def test_alibaba_legacy_seven_business_ribbons_keep_readable_source_gaps(self) -> None:
        for quarter, svg_root in self.alibaba_dense_source_roots.items():
            with self.subTest(quarter=quarter):
                sources = source_rects(svg_root)
                self.assertEqual(len(sources), 7)
                gaps = [
                    following["y"] - (current["y"] + current["height"])
                    for current, following in zip(sources, sources[1:])
                ]
                self.assertGreaterEqual(
                    min(gaps),
                    70,
                    "Small historical business ribbons need enough whitespace to remain visually distinct.",
                )

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
