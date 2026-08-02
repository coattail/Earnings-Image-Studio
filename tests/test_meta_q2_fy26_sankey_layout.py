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

        self.assertLessEqual(
            operating["y"],
            529,
            "Meta's operating-profit node should share a small portion of the finishing lift.",
        )
        self.assertLessEqual(
            net["y"],
            354,
            "Meta's high-retention net-profit node should receive a stronger finishing lift.",
        )
        self.assertGreaterEqual(
            gross["y"] - operating["y"],
            45,
            "The green ribbon should begin rising clearly before the operating-profit stage.",
        )
        self.assertGreaterEqual(
            operating["y"] - net["y"],
            172,
            "The main green ribbon should continue opening upward into net profit.",
        )

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

        self.assertAlmostEqual(
            visible_rect(generic_svg_root, "gross")["y"],
            visible_rect(disabled_svg_root, "gross")["y"],
            places=1,
        )
        self.assertGreaterEqual(
            visible_rect(disabled_svg_root, "operating")["y"] - visible_rect(generic_svg_root, "operating")["y"],
            8,
            "An anonymous high-retention company should receive the global operating-profit finishing lift.",
        )
        self.assertGreaterEqual(
            visible_rect(disabled_svg_root, "net")["y"] - visible_rect(generic_svg_root, "net")["y"],
            28,
            "An anonymous high-retention company should receive the global net-profit finishing lift.",
        )


if __name__ == "__main__":
    unittest.main()
