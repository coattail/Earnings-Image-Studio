import json
import subprocess
import tempfile
import unittest
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
NODE_RENDERER = ROOT_DIR / "scripts" / "direct_chart_render.cjs"
CACHE_PATH = ROOT_DIR / "data" / "cache" / "tsmc.json"


def render_latest_tsmc_sankey_svg() -> str:
    payload = json.loads(CACHE_PATH.read_text(encoding="utf-8"))
    with tempfile.TemporaryDirectory(prefix="tsmc-fx-growth-") as temp_dir:
        output_dir = Path(temp_dir)
        payload_path = output_dir / "tsmc.json"
        payload_path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
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
                "sankey",
                "--output-dir",
                str(output_dir),
                "--basename",
                "tsmc-fx-growth",
            ],
            cwd=ROOT_DIR,
            check=True,
            capture_output=True,
            text=True,
        )
        summary = json.loads(result.stdout)
        return Path(summary["outputs"]["sankey"]["svg"]).read_text(encoding="utf-8")


class FxAdjustedRevenueGrowthLabelTests(unittest.TestCase):
    def test_tsmc_latest_sankey_uses_display_currency_growth_labels(self) -> None:
        svg = render_latest_tsmc_sankey_svg()

        self.assertIn("同比+40.6%", svg)
        self.assertIn("环比+6.4%", svg)
        self.assertNotIn("同比+35.1%", svg)
        self.assertNotIn("环比+8.4%", svg)


if __name__ == "__main__":
    unittest.main()
