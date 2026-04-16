import sys
import unittest
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = ROOT_DIR / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from source_adapters import supplemental_components_adapter  # noqa: E402


class SupplementalComponentsTsmcTests(unittest.TestCase):
    def test_tsmc_2026q1_includes_rnd_and_sgna_breakdown(self) -> None:
        company = {
            "id": "tsmc",
            "ticker": "TSM",
            "nameZh": "台积电",
            "nameEn": "TSMC",
            "slug": "tsm",
        }

        result = supplemental_components_adapter.run(
            company,
            base_payload={"quarters": ["2026Q1"]},
        )

        self.assertTrue(result.enabled)
        quarter = result.payload["financials"]["2026Q1"]
        self.assertEqual(quarter["sgnaBn"], 26.249)
        self.assertEqual(quarter["rndBn"], 67.757)
        self.assertEqual(
            quarter["statementSourceUrl"],
            "https://investor.tsmc.com/chinese/encrypt/files/encrypt_file/reports/2026-04/541d1d3dc007a3bbb1dc0e118019964aee9ef0b0/FS.pdf",
        )
        self.assertEqual(
            [item["name"] for item in quarter["opexBreakdown"]],
            ["SG&A", "R&D"],
        )


if __name__ == "__main__":
    unittest.main()
