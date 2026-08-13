import sys
import unittest
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = ROOT_DIR / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from official_revenue_structures import (  # noqa: E402
    _extract_tencent_filing_date,
    _extract_tencent_growth_metrics,
    _extract_tencent_result_links,
)


class TencentRevenueStructureYoyTests(unittest.TestCase):
    def test_extracts_yoy_abbreviation_and_declines_from_q1_narrative(self) -> None:
        text = (
            "Domestic Games revenues were RMB45.4 billion, up 6% YoY. "
            "International Games revenues were RMB18.8 billion, up 13% YoY. "
            "Social Networks revenues decreased by 2% YoY to RMB31.9 billion."
        )

        self.assertEqual(_extract_tencent_growth_metrics(text, "Domestic Games"), (45.4, 6.0))
        self.assertEqual(_extract_tencent_growth_metrics(text, "International Games"), (18.8, 13.0))
        self.assertEqual(_extract_tencent_growth_metrics(text, "Social Networks"), (31.9, -2.0))

    def test_extracts_release_links_from_redesigned_results_page(self) -> None:
        html = """
        <section class="section-results-highlight">
          <h2>Tencent Announces 2026 Second Quarter Results</h2>
          <a href="https://www.tencent.com/wp-content/uploads/2026/08/q2-release.pdf">
            <span>Earnings Releases</span>
          </a>
          <a href="https://example.com/q2-presentation.pdf"><span>Earnings Presentation</span></a>
        </section>
        <div class="results-container">
          <h3>Tencent Announces 2026 First Quarter Results</h3>
          <a href="https://static.www.tencent.com/uploads/2026/05/13/q1-release.pdf">
            <span>Earnings Releases</span>
          </a>
        </div>
        """

        records = _extract_tencent_result_links(html)

        self.assertEqual(
            [(record["title"], record["pdfUrl"]) for record in records],
            [
                (
                    "Tencent Announces 2026 Second Quarter Results",
                    "https://www.tencent.com/wp-content/uploads/2026/08/q2-release.pdf",
                ),
                (
                    "Tencent Announces 2026 First Quarter Results",
                    "https://static.www.tencent.com/uploads/2026/05/13/q1-release.pdf",
                ),
            ],
        )

    def test_extracts_wordpress_release_date_from_pdf_text(self) -> None:
        self.assertEqual(
            _extract_tencent_filing_date(
                "",
                "https://www.tencent.com/wp-content/uploads/2026/08/q2-release.pdf",
                "Hong Kong, August 12, 2026 - Tencent Holdings Limited announced results.",
            ),
            "2026-08-12",
        )
        self.assertEqual(
            _extract_tencent_filing_date(
                "",
                "https://www.tencent.com/wp-content/uploads/2026/08/q2-release.pdf",
                "Hong Kong, 12 August 2026 - Tencent Holdings Limited announced results.",
            ),
            "2026-08-12",
        )


if __name__ == "__main__":
    unittest.main()
