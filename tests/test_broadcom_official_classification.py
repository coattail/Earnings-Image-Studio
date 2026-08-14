import json
import subprocess
import tempfile
import unittest
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
BROADCOM_PAYLOAD = ROOT_DIR / "data" / "cache" / "broadcom.json"
NODE_RENDERER = ROOT_DIR / "scripts" / "direct_chart_render.cjs"

EXPECTED_COST_KEYS = [
    "costofrevenue",
    "acquisitionrelatedintangibleamortization",
    "restructuringcharges",
]
EXPECTED_OPEX_KEYS = [
    "researchanddevelopment",
    "sellinggeneralandadministrative",
    "acquisitionrelatedintangibleamortization",
    "restructuringandothercharges",
]
RECENT_QUARTERS = (
    "2024Q1",
    "2024Q2",
    "2024Q3",
    "2024Q4",
    "2025Q1",
    "2025Q2",
    "2025Q3",
    "2025Q4",
    "2026Q1",
    "2026Q2",
)


def load_broadcom_payload() -> dict[str, object]:
    return json.loads(BROADCOM_PAYLOAD.read_text(encoding="utf-8"))


def render_broadcom_svg(quarter: str) -> str:
    with tempfile.TemporaryDirectory(prefix="broadcom-classification-") as temp_dir:
        result = subprocess.run(
            [
                "node",
                str(NODE_RENDERER),
                "--payload",
                str(BROADCOM_PAYLOAD),
                "--quarter",
                quarter,
                "--language",
                "zh",
                "--modes",
                "sankey",
                "--output-dir",
                temp_dir,
                "--basename",
                f"broadcom-{quarter.lower()}-classification",
            ],
            cwd=ROOT_DIR,
            check=True,
            capture_output=True,
            text=True,
        )
        summary = json.loads(result.stdout)
        return Path(summary["outputs"]["sankey"]["svg"]).read_text(encoding="utf-8")


class BroadcomOfficialClassificationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.payload = load_broadcom_payload()

    def test_recent_quarters_use_consistent_official_statement_categories(self) -> None:
        financials = self.payload["financials"]

        for quarter in RECENT_QUARTERS:
            with self.subTest(quarter=quarter):
                entry = financials[quarter]
                costs = entry["officialCostBreakdown"]
                opex = entry["officialOpexBreakdown"]

                self.assertEqual([item["memberKey"] for item in costs], EXPECTED_COST_KEYS)
                self.assertEqual([item["memberKey"] for item in opex], EXPECTED_OPEX_KEYS)
                self.assertAlmostEqual(
                    sum(item["valueBn"] for item in costs),
                    entry["costOfRevenueBn"],
                    places=3,
                )
                self.assertAlmostEqual(
                    sum(item["valueBn"] for item in opex),
                    entry["operatingExpensesBn"],
                    places=3,
                )
                self.assertIn("broadcom", str(entry.get("statementSource") or ""))
                self.assertTrue(
                    any(
                        domain in str(entry.get("statementSourceUrl") or "")
                        for domain in ("broadcom.com", "prnewswire.com")
                    )
                )

    def test_q4_fy24_svg_keeps_official_data_but_uses_compact_presentation(self) -> None:
        svg = render_broadcom_svg("2024Q4")

        for node_id in ("opex-0", "opex-1"):
            self.assertIn(f'data-edit-node-visible-id="{node_id}"', svg)
        for node_id in ("cost-breakdown-0", "opex-2", "opex-3"):
            self.assertNotIn(f'data-edit-node-visible-id="{node_id}"', svg)

        for label_fragment in ("研发费用", "销售、管理及", "其他费用"):
            self.assertIn(label_fragment, svg)
        for detailed_label in ("形资产摊销", "重组及其他费用"):
            self.assertNotIn(detailed_label, svg)

        for placeholder_label in ("财务费用", "履约", "销售与营销", "税金及附加"):
            self.assertNotIn(placeholder_label, svg)


if __name__ == "__main__":
    unittest.main()
