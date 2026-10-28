import json
import re
import subprocess
import tempfile
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
NODE_RENDERER = ROOT_DIR / "scripts" / "direct_chart_render.cjs"
VISA_PAYLOAD = ROOT_DIR / "data" / "cache" / "visa.json"
SVG_NS = {"svg": "http://www.w3.org/2000/svg"}


def render_visa_sankey(quarter: str) -> str:
    with tempfile.TemporaryDirectory(prefix="visa-latest-sankey-") as temp_dir:
        output_dir = Path(temp_dir)
        result = subprocess.run(
            [
                "node", str(NODE_RENDERER), "--payload", str(VISA_PAYLOAD),
                "--quarter", quarter, "--language", "zh", "--modes", "sankey",
                "--output-dir", str(output_dir), "--basename", "visa-latest",
            ],
            cwd=ROOT_DIR,
            check=True,
            capture_output=True,
            text=True,
        )
        summary = json.loads(result.stdout)
        return Path(summary["outputs"]["sankey"]["svg"]).read_text(encoding="utf-8")


class LatestVisaUpdateTests(unittest.TestCase):
    def test_visa_fy2026_q4_official_release_is_complete(self) -> None:
        dataset = json.loads((ROOT_DIR / "data" / "earnings-dataset.json").read_text(encoding="utf-8"))
        visa = next(company for company in dataset["companies"] if company["id"] == "visa")

        self.assertEqual(visa["quarters"][-1], "2026Q3")
        latest = visa["financials"]["2026Q3"]
        self.assertEqual(latest["fiscalLabel"], "FY2026 Q4")
        self.assertEqual(latest["statementFilingDate"], "2026-10-27")
        self.assertEqual(latest["statementSource"], "manual-visa-earnings-release")
        self.assertAlmostEqual(latest["revenueBn"], 12.139, delta=0.001)
        self.assertAlmostEqual(latest["operatingIncomeBn"], 7.262, delta=0.001)
        self.assertAlmostEqual(latest["netIncomeBn"], 6.002, delta=0.001)

        segments = {row["memberKey"]: row for row in latest["officialRevenueSegments"]}
        self.assertEqual(
            set(segments),
            {
                "servicerevenues",
                "dataprocessingrevenues",
                "internationaltransactionrevenues",
                "otherrevenues",
            },
        )
        self.assertAlmostEqual(segments["servicerevenues"]["valueBn"], 5.255, delta=0.001)
        self.assertAlmostEqual(segments["dataprocessingrevenues"]["valueBn"], 6.245, delta=0.001)
        self.assertAlmostEqual(segments["internationaltransactionrevenues"]["valueBn"], 4.115, delta=0.001)
        self.assertAlmostEqual(segments["otherrevenues"]["valueBn"], 1.647, delta=0.001)

    def test_previous_fy2026_q3_tax_ribbon_descends_gently_from_the_operating_profit_fork(self) -> None:
        svg_markup = render_visa_sankey("2026Q2")
        svg_root = ET.fromstring(svg_markup)
        deduction = svg_root.find(".//svg:rect[@data-edit-node-visible-id='deduction-0']", SVG_NS)
        self.assertIsNotNone(deduction)

        tax_path_match = re.search(
            r'<path d="([^"]+)" fill="#E58A92" opacity="0\.97"></path>'
            r'<rect [^>]+fill="#E50000"></rect>\s*'
            r'<rect [^>]+data-edit-node-visible-id="deduction-0"></rect>',
            svg_markup,
        )
        self.assertIsNotNone(tax_path_match)
        path_numbers = [float(value) for value in re.findall(r"[-\d.]+", tax_path_match.group(1))]
        source_center_y = (path_numbers[1] + path_numbers[-1]) / 2
        target_center_y = float(deduction.attrib["y"]) + float(deduction.attrib["height"]) / 2

        self.assertGreater(target_center_y, source_center_y + 12)
        self.assertLess(target_center_y, source_center_y + 80)


if __name__ == "__main__":
    unittest.main()
