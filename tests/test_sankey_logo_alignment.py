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


def load_company_payload(company_id: str) -> dict:
    dataset = json.loads(DATASET_PATH.read_text(encoding="utf-8"))
    return next(company for company in dataset["companies"] if company["id"] == company_id)


def latest_quarter(company: dict) -> str:
    quarters = company.get("quarters") or list((company.get("financials") or {}).keys())
    quarter_keys = [str(quarter) for quarter in quarters if re.match(r"^\d{4}Q[1-4]$", str(quarter))]
    return sorted(quarter_keys, key=lambda value: (int(value[:4]), int(value[-1])))[-1]


def render_company_sankey_markup(company_id: str, quarter: str = "latest") -> str:
    company = load_company_payload(company_id)
    resolved_quarter = latest_quarter(company) if quarter == "latest" else quarter
    with tempfile.TemporaryDirectory(prefix=f"{company_id}-sankey-logo-") as temp_dir:
        output_dir = Path(temp_dir)
        payload_path = output_dir / f"{company_id}.json"
        payload_path.write_text(json.dumps(company, ensure_ascii=False), encoding="utf-8")
        result = subprocess.run(
            [
                "node",
                str(NODE_RENDERER),
                "--payload",
                str(payload_path),
                "--quarter",
                resolved_quarter,
                "--language",
                "zh",
                "--modes",
                "sankey",
                "--output-dir",
                str(output_dir),
                "--basename",
                f"{company_id}-{resolved_quarter}",
            ],
            cwd=ROOT_DIR,
            check=True,
            capture_output=True,
            text=True,
        )
        summary = json.loads(result.stdout)
        return Path(summary["outputs"]["sankey"]["svg"]).read_text(encoding="utf-8")


def rect_metrics(svg_root: ET.Element, node_id: str) -> dict[str, float]:
    rect = svg_root.find(f".//svg:rect[@data-edit-node-visible-id='{node_id}']", SVG_NS)
    if rect is None:
        raise AssertionError(f"Expected SVG rect for node '{node_id}'.")
    return {
        "x": float(rect.attrib["x"]),
        "y": float(rect.attrib["y"]),
        "width": float(rect.attrib["width"]),
        "height": float(rect.attrib["height"]),
    }


def corporate_logo_metrics(svg_markup: str, company_id: str) -> dict[str, float]:
    logo_match = re.search(
        rf"<g transform=\"translate\(([-\d.]+), ([-\d.]+)\) scale\(([-\d.]+)\)\"[^>]*data-corporate-logo=\"{re.escape(company_id)}\"[^>]*data-logo-width=\"([-\d.]+)\"[^>]*data-logo-height=\"([-\d.]+)\"",
        svg_markup,
    )
    if logo_match is None:
        raise AssertionError(f"Expected the {company_id} corporate logo to render.")
    x, y, scale, width, height = map(float, logo_match.groups())
    return {
        "x": x,
        "y": y,
        "scale": scale,
        "width": width,
        "height": height,
        "center_x": x + (width * scale) / 2,
        "bottom": y + height * scale,
    }


class SankeyLogoAlignmentTests(unittest.TestCase):
    def test_company_logos_are_centered_above_revenue_nodes_across_templates(self) -> None:
        for company_id in ("microsoft", "amazon", "alphabet", "amd"):
            with self.subTest(company_id=company_id):
                svg_markup = render_company_sankey_markup(company_id)
                svg_root = ET.fromstring(svg_markup)
                revenue = rect_metrics(svg_root, "revenue")
                logo = corporate_logo_metrics(svg_markup, company_id)
                revenue_center_x = revenue["x"] + revenue["width"] / 2

                self.assertAlmostEqual(
                    logo["center_x"],
                    revenue_center_x,
                    delta=1.0,
                    msg=f"{company_id} logo should be horizontally centered above the revenue node.",
                )
                self.assertLess(logo["bottom"], revenue["y"], f"{company_id} logo should sit above the revenue node.")

    def test_jpmorgan_and_byd_use_inline_vector_corporate_logos(self) -> None:
        for company_id in ("jpmorgan", "byd"):
            with self.subTest(company_id=company_id):
                svg_markup = render_company_sankey_markup(company_id)
                logo_start = svg_markup.find(f'data-corporate-logo="{company_id}"')
                self.assertGreaterEqual(logo_start, 0, f"Expected {company_id} logo group to render.")
                logo_group_start = svg_markup.rfind("<g", 0, logo_start)
                logo_group_end = svg_markup.find("</g>", logo_start)
                logo_markup = svg_markup[logo_group_start:logo_group_end]

                self.assertNotIn("<image", logo_markup, f"{company_id} logo should not depend on an embedded image.")
                self.assertRegex(logo_markup, r"<(path|text|ellipse|rect)\b")

    def test_jpmorgan_inline_logo_uses_single_non_overlapping_wordmark(self) -> None:
        svg_markup = render_company_sankey_markup("jpmorgan")
        logo_start = svg_markup.find('data-corporate-logo="jpmorgan"')
        self.assertGreaterEqual(logo_start, 0, "Expected JPMorgan logo group to render.")
        logo_group_start = svg_markup.rfind("<g", 0, logo_start)
        logo_group_end = svg_markup.find("</g>", logo_start)
        logo_markup = svg_markup[logo_group_start:logo_group_end]

        self.assertEqual(logo_markup.count("<text"), 1)
        self.assertIn("JPMorgan Chase", logo_markup)


if __name__ == "__main__":
    unittest.main()
