import sys
import unittest
from pathlib import Path
from unittest.mock import patch


ROOT_DIR = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = ROOT_DIR / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

import official_revenue_structures  # noqa: E402


def _company() -> dict[str, object]:
    return {
        "id": "netease",
        "ticker": "NTES",
    }


class OfficialRevenueStructuresErrorDetailsTests(unittest.TestCase):
    def test_supplement_cached_custom_history_emits_structured_error_details(self) -> None:
        cached_payload = {
            "source": "official-ir-release",
            "quarters": {},
            "filingsUsed": [],
            "errors": [],
        }

        with (
            patch.object(
                official_revenue_structures,
                "_available_custom_history_items",
                return_value={"2025Q4": {"quarter": "2025Q4", "sourceUrl": "https://example.com/q4.pdf"}},
            ),
            patch.object(
                official_revenue_structures,
                "_parse_custom_history_item",
                side_effect=RuntimeError("pdf parse failed"),
            ),
        ):
            result = official_revenue_structures._supplement_cached_custom_history(_company(), cached_payload)

        self.assertEqual(result["errors"], ["2025Q4: pdf parse failed"])
        self.assertEqual(
            result["errorDetails"],
            [
                {
                    "message": "pdf parse failed",
                    "layer": "revenue-structures",
                    "sourceId": "official_revenue_structures",
                    "phase": "custom-history-supplement",
                    "severity": "error",
                    "errorType": "RuntimeError",
                    "quarter": "2025Q4",
                }
            ],
        )

    def test_parse_alibaba_records_emits_structured_error_details(self) -> None:
        company = {"id": "alibaba", "ticker": "BABA"}
        item = {
            "documentTitle": {"en_US": "Alibaba Group Announces December Quarter 2025 Results"},
            "eventDate": 1767225600000,
            "pressRelease": "doc-1",
        }

        with (
            patch.object(official_revenue_structures, "_load_alibaba_quarterly_items", return_value=[item]),
            patch.object(
                official_revenue_structures,
                "_load_alibaba_press_release_pdf",
                return_value=("https://example.com/alibaba-q4.pdf", "https://example.com/page"),
            ),
            patch.object(
                official_revenue_structures,
                "_extract_pdf_text",
                side_effect=RuntimeError("pdf unavailable"),
            ),
        ):
            result = official_revenue_structures._parse_alibaba_records(company)

        self.assertEqual(result["errors"], ["2025Q4: pdf unavailable"])
        self.assertEqual(
            result["errorDetails"],
            [
                {
                    "message": "pdf unavailable",
                    "layer": "revenue-structures",
                    "sourceId": "official_revenue_structures",
                    "phase": "alibaba-quarter-parse",
                    "severity": "error",
                    "errorType": "RuntimeError",
                    "quarter": "2025Q4",
                }
            ],
        )

    def test_parse_generic_segment_cache_preserves_upstream_error_details_when_quarters_missing(self) -> None:
        company = {"id": "alphabet", "ticker": "GOOGL"}
        upstream_payload = {
            "source": "official-filings",
            "quarters": {},
            "filingsUsed": [],
            "errors": ["submissions: sec unavailable"],
            "errorDetails": [
                {
                    "message": "sec unavailable",
                    "layer": "segments",
                    "sourceId": "official_segments",
                    "phase": "submissions",
                    "severity": "error",
                    "errorType": "RuntimeError",
                    "url": "https://data.sec.gov/submissions/CIK0000000000.json",
                }
            ],
        }

        with patch.object(official_revenue_structures, "fetch_official_segment_history", return_value=upstream_payload):
            result = official_revenue_structures._parse_generic_segment_cache_records(company, refresh=False)

        self.assertEqual(
            result["errors"],
            ["submissions: sec unavailable", "segment-cache-missing"],
        )
        self.assertEqual(
            result["errorDetails"],
            [
                {
                    "message": "sec unavailable",
                    "layer": "segments",
                    "sourceId": "official_segments",
                    "phase": "submissions",
                    "severity": "error",
                    "errorType": "RuntimeError",
                    "url": "https://data.sec.gov/submissions/CIK0000000000.json",
                },
                {
                    "message": "segment-cache-missing",
                    "layer": "revenue-structures",
                    "sourceId": "official_revenue_structures",
                    "phase": "segment-cache-load",
                    "severity": "error",
                },
            ],
        )


if __name__ == "__main__":
    unittest.main()
