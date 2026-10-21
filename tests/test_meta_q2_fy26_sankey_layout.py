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


def render_sankey_svg(payload_path: Path, basename: str) -> ET.Element:
    with tempfile.TemporaryDirectory(prefix="meta-q2-fy26-layout-") as temp_dir:
        output_dir = Path(temp_dir)
        result = subprocess.run(
            [
                "node",
                str(NODE_RENDERER),
                "--payload",
                str(payload_path),
                "--quarter",
                "2026Q2",
                "--language",
                "zh",
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
        summary = json.loads(result.stdout)
        svg_path = Path(summary["outputs"]["sankey"]["svg"])
        return ET.fromstring(svg_path.read_text(encoding="utf-8"))


def render_meta_q2_fy26_svg() -> ET.Element:
    return render_sankey_svg(META_PAYLOAD, "meta-q2-fy26")


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
        gross = visible_rect(self.svg_root, "gross")
        operating = visible_rect(self.svg_root, "operating")
        net = visible_rect(self.svg_root, "net")

        for source, target in ((gross, operating), (operating, net)):
            rise = source["y"] - target["y"]
            runway = target["x"] - source["x"] - source["width"]
            self.assertGreater(rise, 0)
            self.assertLess(rise / runway, 0.4)

    def test_high_retention_finish_is_company_agnostic(self) -> None:
        cloned_payload = json.loads(META_PAYLOAD.read_text(encoding="utf-8"))
        cloned_payload.update(
            {
                "id": "generic-high-retention",
                "ticker": "GHR",
                "nameEn": "Generic High Retention",
                "nameZh": "高利润保留率样本",
                "slug": "generic-high-retention",
            }
        )
        disabled_payload = json.loads(json.dumps(cloned_payload))
        disabled_payload["financials"]["2026Q2"]["sankeyLayout"] = {
            "highRetentionNetFinishLiftY": 0,
        }
        with tempfile.TemporaryDirectory(prefix="generic-high-retention-") as temp_dir:
            payload_path = Path(temp_dir) / "generic-high-retention.json"
            disabled_payload_path = Path(temp_dir) / "generic-high-retention-disabled.json"
            payload_path.write_text(json.dumps(cloned_payload), encoding="utf-8")
            disabled_payload_path.write_text(json.dumps(disabled_payload), encoding="utf-8")
            generic_svg_root = render_sankey_svg(payload_path, "generic-high-retention")
            disabled_svg_root = render_sankey_svg(disabled_payload_path, "generic-high-retention-disabled")

        # Company identity and the legacy finishing lift must not stack offsets
        # onto the globally solved port trajectory.
        for node_id in ("gross", "operating", "net"):
            with self.subTest(node_id=node_id):
                actual = visible_rect(generic_svg_root, node_id)
                self.assertEqual(actual, visible_rect(disabled_svg_root, node_id))
        generic_gross = visible_rect(generic_svg_root, "gross")
        generic_op = visible_rect(generic_svg_root, "operating")
        self.assertGreater(generic_gross["y"], generic_op["y"])
        self.assertLess(
            (generic_gross["y"] - generic_op["y"]) /
            (generic_op["x"] - generic_gross["x"] - generic_gross["width"]),
            0.35,
        )


if __name__ == "__main__":
    unittest.main()
