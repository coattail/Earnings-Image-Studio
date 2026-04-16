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


def render_bar_summary(company_payload: dict[str, object], basename: str) -> dict[str, object]:
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
                "latest",
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


class BarHistoryWindowCountTests(unittest.TestCase):
    def test_tsm_latest_bar_window_keeps_thirty_quarters(self) -> None:
        summary = render_bar_summary(load_dataset_company("tsmc"), "tsmc-window")

        self.assertEqual(summary["outputs"]["bars"]["quarterCount"], 30)

    def test_byd_latest_bar_window_uses_all_available_quarters(self) -> None:
        company = load_dataset_company("byd")
        expected_quarter_count = min(30, len(company.get("quarters") or []))
        summary = render_bar_summary(company, "byd-window")

        self.assertEqual(summary["outputs"]["bars"]["quarterCount"], expected_quarter_count)


if __name__ == "__main__":
    unittest.main()
