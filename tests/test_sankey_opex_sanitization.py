import json
import subprocess
import tempfile
import unittest
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
NODE_RENDERER = ROOT_DIR / "scripts" / "direct_chart_render.cjs"
DATASET_PATH = ROOT_DIR / "data" / "earnings-dataset.json"


def load_dataset_company(company_id: str) -> dict[str, object]:
    dataset = json.loads(DATASET_PATH.read_text(encoding="utf-8"))
    for company in dataset.get("companies", []):
        if str(company.get("id") or "").strip().lower() == company_id.lower():
            return company
    raise AssertionError(f"Company '{company_id}' was not found in the dataset.")


def render_sankey_svg(company_payload: dict[str, object], quarter: str, basename: str) -> str:
    with tempfile.TemporaryDirectory(prefix=f"sankey-{basename}-") as temp_dir:
        output_dir = Path(temp_dir)
        payload_path = output_dir / f"{basename}.json"
        payload_path.write_text(json.dumps(company_payload, ensure_ascii=False), encoding="utf-8")
        result = subprocess.run(
            [
                "node",
                str(NODE_RENDERER),
                "--payload",
                str(payload_path),
                "--quarter",
                quarter,
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
        return svg_path.read_text(encoding="utf-8")


class SankeyExpenseSanitizationTests(unittest.TestCase):
    def test_tsmc_q3_2024_drops_placeholder_echo_expenses(self) -> None:
        svg = render_sankey_svg(load_dataset_company("tsmc"), "2024Q3", "tsmc-q3-opex")

        self.assertIn("研发", svg)
        self.assertTrue(any(label in svg for label in ("销售及管理费用", "销售、一般")))
        self.assertNotIn("财务费用", svg)
        self.assertNotIn("履约", svg)
        self.assertNotIn("销售与营销", svg)
        self.assertNotIn("税金及附加", svg)

    def test_alphabet_q3_2025_drops_placeholder_echo_expenses(self) -> None:
        svg = render_sankey_svg(load_dataset_company("alphabet"), "2025Q3", "alphabet-q3-opex")

        self.assertIn("研发", svg)
        self.assertTrue(any(label in svg for label in ("销售与营销", "销售及管理费用", "销售、一般")))
        self.assertNotIn("财务费用", svg)
        self.assertNotIn("履约", svg)
        self.assertNotIn("税金及附加", svg)


if __name__ == "__main__":
    unittest.main()
