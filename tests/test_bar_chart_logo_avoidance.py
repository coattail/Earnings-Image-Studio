import json
import re
import subprocess
import tempfile
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
NODE_RENDERER = ROOT_DIR / "scripts" / "direct_chart_render.cjs"
TENCENT_PAYLOAD = ROOT_DIR / "data" / "cache" / "tencent.json"
SVG_NS = {"svg": "http://www.w3.org/2000/svg"}


def render_tencent_bar_svg() -> tuple[str, ET.Element]:
    with tempfile.TemporaryDirectory(prefix="tencent-bar-logo-") as temp_dir:
        output_dir = Path(temp_dir)
        result = subprocess.run(
            [
                "node",
                str(NODE_RENDERER),
                "--payload",
                str(TENCENT_PAYLOAD),
                "--quarter",
                "2026Q1",
                "--language",
                "en",
                "--modes",
                "bars",
                "--output-dir",
                str(output_dir),
                "--basename",
                "tencent-q1-fy26",
            ],
            cwd=ROOT_DIR,
            check=True,
            capture_output=True,
            text=True,
        )
        summary = json.loads(result.stdout)
        svg_path = Path(summary["outputs"]["bars"]["svg"])
        svg_text = svg_path.read_text(encoding="utf-8")
        return svg_text, ET.fromstring(svg_text)


def corporate_logo_top(svg_text: str, company_id: str) -> float:
    logo_match = re.search(
        rf"<g transform=\"translate\(([-\d.]+),\s*([-\d.]+)\) scale\(([-\d.]+)\)\"[^>]*data-corporate-logo=\"{re.escape(company_id)}\"",
        svg_text,
    )
    if logo_match is None:
        raise AssertionError(f"Expected {company_id} logo to render.")
    return float(logo_match.group(2))


def text_box_bottom(svg_root: ET.Element, text: str) -> float:
    for element in svg_root.findall(".//svg:text", SVG_NS):
        if "".join(element.itertext()).strip() != text:
            continue
        y = float(element.attrib["y"])
        font_size = float(element.attrib["font-size"])
        return y + font_size
    raise AssertionError(f"Expected text {text!r}.")


class BarChartLogoAvoidanceTests(unittest.TestCase):
    def test_wide_tencent_logo_clears_top_legend_text(self) -> None:
        svg_text, svg_root = render_tencent_bar_svg()

        logo_top = corporate_logo_top(svg_text, "tencent")
        legend_bottom = text_box_bottom(svg_root, "Value Added Services")

        self.assertGreaterEqual(
            logo_top - legend_bottom,
            14,
            "Wide bar-chart logos should move down when they get too close to the top legend text.",
        )


if __name__ == "__main__":
    unittest.main()
