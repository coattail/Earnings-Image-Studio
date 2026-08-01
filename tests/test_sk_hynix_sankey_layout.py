import json
import re
import subprocess
import tempfile
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
NODE_RENDERER = ROOT_DIR / "scripts" / "direct_chart_render.cjs"
DATASET_PATH = ROOT_DIR / "data" / "earnings-dataset.json"
SVG_NS = {"svg": "http://www.w3.org/2000/svg"}


def render_sk_hynix_markup(quarter: str = "2026Q1") -> str:
    dataset = json.loads(DATASET_PATH.read_text(encoding="utf-8"))
    company = next(item for item in dataset["companies"] if item["id"] == "sk-hynix")
    with tempfile.TemporaryDirectory(prefix="sk-hynix-layout-") as temp_dir:
        output_dir = Path(temp_dir)
        payload_path = output_dir / "sk-hynix.json"
        payload_path.write_text(json.dumps(company, ensure_ascii=False), encoding="utf-8")
        result = subprocess.run(
            [
                "node", str(NODE_RENDERER), "--payload", str(payload_path),
                "--quarter", quarter, "--language", "zh", "--modes", "sankey",
                "--output-dir", str(output_dir), "--basename", "sk-hynix-layout",
            ],
            cwd=ROOT_DIR,
            check=True,
            capture_output=True,
            text=True,
        )
        summary = json.loads(result.stdout)
        return Path(summary["outputs"]["sankey"]["svg"]).read_text(encoding="utf-8")


def render_sk_hynix_svg() -> ET.Element:
    return ET.fromstring(render_sk_hynix_markup())


def rect(svg_root: ET.Element, node_id: str) -> dict[str, float]:
    node = svg_root.find(f".//svg:rect[@data-edit-node-visible-id='{node_id}']", SVG_NS)
    if node is None:
        raise AssertionError(f"Missing Sankey node: {node_id}")
    return {key: float(node.attrib[key]) for key in ("x", "y", "width", "height")}


def corporate_logo_metrics(svg_markup: str, company_id: str) -> dict[str, float]:
    logo_match = re.search(
        rf"<g transform=\"translate\(([-\d.]+), ([-\d.]+)\) scale\(([-\d.]+)\)\"[^>]*data-corporate-logo=\"{re.escape(company_id)}\"[^>]*data-logo-width=\"([-\d.]+)\"[^>]*data-logo-height=\"([-\d.]+)\"",
        svg_markup,
    )
    if logo_match is None:
        raise AssertionError(f"Missing corporate logo: {company_id}")
    x, y, scale, width, height = map(float, logo_match.groups())
    return {
        "x": x,
        "y": y,
        "scale": scale,
        "width": width,
        "height": height,
        "center_x": x + width * scale / 2,
        "bottom": y + height * scale,
    }


class SkHynixSankeyLayoutTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.svg_markup = render_sk_hynix_markup()
        cls.svg = ET.fromstring(cls.svg_markup)

    def test_product_sources_and_revenue_are_lifted_into_an_open_left_fan(self) -> None:
        revenue = rect(self.svg, "revenue")
        dram = rect(self.svg, "source-0")
        nand = rect(self.svg, "source-1")
        other = rect(self.svg, "source-2")

        self.assertLess(revenue["y"], 540)
        self.assertLess(dram["y"], revenue["y"] - 180)
        self.assertLess(nand["y"], 980)
        self.assertLess(other["y"], 1320)

    def test_logo_tracks_shifted_revenue_node_without_colliding_with_the_bridge(self) -> None:
        revenue = rect(self.svg, "revenue")
        logo = corporate_logo_metrics(self.svg_markup, "sk-hynix")

        self.assertAlmostEqual(
            logo["center_x"],
            revenue["x"] + revenue["width"] / 2,
            delta=1.0,
        )
        self.assertLess(logo["bottom"], revenue["y"] - 36)

    def test_gross_profit_node_is_lifted_for_a_smoother_main_ribbon(self) -> None:
        revenue = rect(self.svg, "revenue")
        gross = rect(self.svg, "gross")

        self.assertLess(gross["y"], 650)
        self.assertGreater(gross["y"], revenue["y"] + 90)

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

    def test_historical_product_sources_omit_support_notes(self) -> None:
        historical_svg = render_sk_hynix_markup("2025Q2")

        for note in (
            "HBM · 服务器 DRAM · 移动 DRAM",
            "NAND · SSD · 企业级 SSD",
            "CIS · 晶圆代工及其他",
        ):
            self.assertNotIn(note, historical_svg)

    def test_latest_quarter_preserves_the_official_expense_total_with_an_explicit_q1_mix_proxy(self) -> None:
        dataset = json.loads(DATASET_PATH.read_text(encoding="utf-8"))
        company = next(item for item in dataset["companies"] if item["id"] == "sk-hynix")
        latest = company["financials"]["2026Q2"]

        self.assertEqual(
            [(item["name"], item["mixPct"]) for item in latest["officialRevenueSegments"]],
            [
                ("DRAM", 73.0),
                ("NAND Flash / Storage", 27.0),
                ("Other Products & Services", 0.0),
            ],
        )
        self.assertIsNone(latest["sgnaBn"])
        self.assertIsNone(latest["rndBn"])
        self.assertEqual(latest["operatingExpensesLabelZh"], "营业费用")
        self.assertIsNone(latest["officialOpexBreakdown"])
        self.assertEqual(latest["opexBreakdownMethod"], "prior-quarter-mix-proxy")
        self.assertEqual(latest["opexBreakdownSourceQuarter"], "2026Q1")
        self.assertEqual(
            [(item["nameZh"], item["valueBn"]) for item in latest["opexBreakdown"]],
            [
                ("研发费用", 3282.405),
                ("销售、一般及行政费用", 1855.218),
                ("其他营业费用", 57.694),
                ("其余营业费用", 253.083),
            ],
        )
        self.assertAlmostEqual(
            sum(item["valueBn"] for item in latest["opexBreakdown"]),
            latest["operatingExpensesBn"],
            places=3,
        )
        self.assertTrue(all(item["metricMode"] == "prior-quarter-mix-proxy" for item in latest["opexBreakdown"]))
        self.assertTrue(all(item["validationEligible"] is False for item in latest["opexBreakdown"]))

    def test_latest_quarter_aggregates_the_non_operating_bridge(self) -> None:
        dataset = json.loads(DATASET_PATH.read_text(encoding="utf-8"))
        company = next(item for item in dataset["companies"] if item["id"] == "sk-hynix")
        latest = company["financials"]["2026Q2"]

        self.assertEqual(
            [(item["nameZh"], item["valueBn"]) for item in latest["positiveAdjustments"]],
            [
                ("营业外收益", 62166),
            ],
        )
        self.assertEqual(
            [(item["nameZh"], item["valueBn"]) for item in latest["belowOperatingItems"]],
            [
                ("所得税费用", 28786),
            ],
        )
        bridged_net_profit = (
            latest["operatingIncomeBn"]
            + sum(item["valueBn"] for item in latest["positiveAdjustments"])
            - sum(item["valueBn"] for item in latest["belowOperatingItems"])
        )
        self.assertAlmostEqual(bridged_net_profit, latest["netIncomeBn"], places=3)

    def test_latest_sankey_restores_the_historical_expense_fan_and_keeps_official_bridge_labels(self) -> None:
        latest_svg = render_sk_hynix_markup("2026Q2")

        for label in (
            "营业费用",
            "研发费用",
            "销售、一般及",
            "行政费用",
            "其余营业费用",
            "其他营业费用",
            "营业外收益",
            "所得税费用",
        ):
            self.assertIn(label, latest_svg)
        self.assertNotIn("构成比例拆分", latest_svg)
        self.assertNotIn("其他净收益", latest_svg)
        self.assertNotIn("财务净收益", latest_svg)
        self.assertNotIn("汇兑净收益", latest_svg)
        self.assertNotIn("其他营业外收益", latest_svg)

        latest_root = ET.fromstring(latest_svg)
        positive = rect(latest_root, "positive-0")
        operating = rect(latest_root, "operating")
        self.assertLessEqual(
            positive["y"] + positive["height"] + 30,
            operating["y"],
        )
        self.assertIsNone(latest_root.find(".//svg:rect[@data-edit-node-visible-id='positive-1']", SVG_NS))
        self.assertIsNotNone(latest_root.find(".//svg:rect[@data-edit-node-visible-id='deduction-0']", SVG_NS))
        self.assertIsNone(latest_root.find(".//svg:rect[@data-edit-node-visible-id='deduction-1']", SVG_NS))

        chart_content = latest_root.find(".//svg:g[@id='chartContent']", SVG_NS)
        self.assertIsNotNone(chart_content)
        self.assertEqual(chart_content.attrib.get("transform"), "translate(0 80)")
        self.assertGreaterEqual(positive["y"] + 80, 120)

        source = rect(latest_root, "source-0")
        nand_source = rect(latest_root, "source-1")
        revenue = rect(latest_root, "revenue")
        deduction = rect(latest_root, "deduction-0")
        self.assertAlmostEqual(source["x"], 304, delta=1)
        self.assertAlmostEqual(source["y"] + 80, 426, delta=5)
        self.assertAlmostEqual(nand_source["x"], 304, delta=1)
        self.assertGreater(nand_source["y"], source["y"] + source["height"] + 300)
        self.assertIsNone(latest_root.find(".//svg:rect[@data-edit-node-visible-id='source-2']", SVG_NS))
        self.assertNotIn("其他产品与服务", latest_svg)
        self.assertNotIn("官方披露占比 0%", latest_svg)
        self.assertAlmostEqual(revenue["x"], 813, delta=1)
        self.assertAlmostEqual(operating["x"], 1860, delta=1)
        self.assertAlmostEqual(positive["x"], 2097, delta=2)
        self.assertAlmostEqual(positive["y"] + 80, 135, delta=3)
        self.assertAlmostEqual(rect(latest_root, "net")["x"], 2377, delta=1)

        expense_nodes = [rect(latest_root, f"opex-{index}") for index in range(4)]
        self.assertIsNone(latest_root.find(".//svg:rect[@data-edit-node-visible-id='opex-4']", SVG_NS))
        deduction_center_y = deduction["y"] + deduction["height"] / 2
        operating_bottom_y = operating["y"] + operating["height"]
        self.assertGreater(deduction_center_y, operating_bottom_y + 40)
        self.assertLess(deduction_center_y, operating_bottom_y + 140)
        self.assertGreater(expense_nodes[0]["y"], deduction["y"] + deduction["height"] + 70)
        self.assertLess(expense_nodes[0]["y"], 1400)
        self.assertLess(expense_nodes[-1]["y"], 1825)
        self.assertEqual(
            [item["y"] for item in expense_nodes],
            sorted(item["y"] for item in expense_nodes),
        )
        self.assertTrue(all(item["x"] < deduction["x"] for item in expense_nodes))

        tax_label = re.search(
            r'<text x="([-\d.]+)" y="[-\d.]+"[^>]*>所得税费用</text>',
            latest_svg,
        )
        self.assertIsNotNone(tax_label)
        self.assertGreater(float(tax_label.group(1)), deduction["x"] + deduction["width"] + 70)

        view_box = [float(value) for value in latest_root.attrib["viewBox"].split()]
        self.assertGreaterEqual(view_box[3], 2050)


if __name__ == "__main__":
    unittest.main()
