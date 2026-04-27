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


def render_bar_summary(company_payload: dict[str, object], basename: str, quarter: str = "latest") -> dict[str, object]:
    with tempfile.TemporaryDirectory(prefix=f"bars-{basename}-") as temp_dir:
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
                "bars",
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
        return json.loads(result.stdout)


def render_bar_svg(company_payload: dict[str, object], basename: str, quarter: str = "latest") -> str:
    with tempfile.TemporaryDirectory(prefix=f"bars-{basename}-") as temp_dir:
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
                "bars",
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
        svg_path = Path(summary["outputs"]["bars"]["svg"])
        return svg_path.read_text(encoding="utf-8")


def legend_color_by_label(svg_markup: str) -> dict[str, str]:
    import re

    matches = re.findall(
        r'<rect x="[^"]+" y="[^"]+" width="(?:24|28)" height="(?:24|28)"[^>]* fill="([^"]+)"></rect><text[^>]*>([^<]+)</text>',
        svg_markup,
    )
    return {label: color for color, label in matches}


class BarHistoryWindowCountTests(unittest.TestCase):
    def test_tsm_latest_bar_window_keeps_thirty_quarters(self) -> None:
        summary = render_bar_summary(load_dataset_company("tsmc"), "tsmc-window")

        self.assertEqual(summary["outputs"]["bars"]["quarterCount"], 30)

    def test_byd_latest_bar_window_uses_all_available_quarters(self) -> None:
        company = load_dataset_company("byd")
        expected_quarter_count = min(30, len(company.get("quarters") or []))
        summary = render_bar_summary(company, "byd-window")

        self.assertEqual(summary["outputs"]["bars"]["quarterCount"], expected_quarter_count)

    def test_segment_colors_stay_stable_when_anchor_quarter_changes(self) -> None:
        company = load_dataset_company("amd")
        early_colors = legend_color_by_label(render_bar_svg(company, "amd-early-window", "2022Q3"))
        latest_colors = legend_color_by_label(render_bar_svg(company, "amd-latest-window", "2025Q4"))

        for label in ["数据中心", "客户端", "游戏", "嵌入式"]:
            self.assertIn(label, early_colors)
            self.assertIn(label, latest_colors)
            self.assertEqual(
                early_colors[label],
                latest_colors[label],
                f"{label} should keep the same bar color regardless of the selected quarter.",
            )


if __name__ == "__main__":
    unittest.main()
