import json
import subprocess
import tempfile
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
NODE_RENDERER = ROOT_DIR / "scripts" / "direct_chart_render.cjs"
DATASET_PATH = ROOT_DIR / "data" / "earnings-dataset.json"
SVG_NS = {"svg": "http://www.w3.org/2000/svg"}


def render_sk_hynix_svg() -> ET.Element:
    dataset = json.loads(DATASET_PATH.read_text(encoding="utf-8"))
    company = next(item for item in dataset["companies"] if item["id"] == "sk-hynix")
    with tempfile.TemporaryDirectory(prefix="sk-hynix-layout-") as temp_dir:
        output_dir = Path(temp_dir)
        payload_path = output_dir / "sk-hynix.json"
        payload_path.write_text(json.dumps(company, ensure_ascii=False), encoding="utf-8")
        result = subprocess.run(
            [
                "node", str(NODE_RENDERER), "--payload", str(payload_path),
                "--quarter", "2026Q1", "--language", "zh", "--modes", "sankey",
                "--output-dir", str(output_dir), "--basename", "sk-hynix-layout",
            ],
            cwd=ROOT_DIR,
            check=True,
            capture_output=True,
            text=True,
        )
        summary = json.loads(result.stdout)
        return ET.fromstring(Path(summary["outputs"]["sankey"]["svg"]).read_text(encoding="utf-8"))


def rect(svg_root: ET.Element, node_id: str) -> dict[str, float]:
    node = svg_root.find(f".//svg:rect[@data-edit-node-visible-id='{node_id}']", SVG_NS)
    if node is None:
        raise AssertionError(f"Missing Sankey node: {node_id}")
    return {key: float(node.attrib[key]) for key in ("x", "y", "width", "height")}


class SkHynixSankeyLayoutTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.svg = render_sk_hynix_svg()

    def test_product_sources_and_revenue_are_lifted_into_an_open_left_fan(self) -> None:
        revenue = rect(self.svg, "revenue")
        dram = rect(self.svg, "source-0")
        nand = rect(self.svg, "source-1")

        self.assertLess(revenue["y"], 540)
        self.assertLess(dram["y"], 440)
        self.assertLess(nand["y"], 1080)

    def test_expense_fan_flows_down_without_crossing_tax_lane(self) -> None:
        gross = rect(self.svg, "gross")
        operating_expenses = rect(self.svg, "operating-expenses")
        tax = rect(self.svg, "deduction-0")
        expense_nodes = [rect(self.svg, f"opex-{index}") for index in range(4)]

        gross_expense_source_y = gross["y"] + rect(self.svg, "operating")["height"]
        self.assertGreater(operating_expenses["y"], gross_expense_source_y)
        self.assertGreater(expense_nodes[0]["y"], tax["y"] + tax["height"] + 100)
        self.assertEqual(
            [item["y"] for item in expense_nodes],
            sorted(item["y"] for item in expense_nodes),
        )

    def test_net_profit_is_lifted_above_operating_profit(self) -> None:
        self.assertLess(rect(self.svg, "net")["y"], 300)


if __name__ == "__main__":
    unittest.main()
