import sys
import unittest
from pathlib import Path
from unittest.mock import patch


ROOT_DIR = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = ROOT_DIR / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

import universal_parser  # noqa: E402


def _company() -> dict[str, object]:
    return {
        "id": "demo",
        "ticker": "DEMO",
        "slug": "demo",
        "nameEn": "Demo",
        "nameZh": "Demo",
        "rank": 1,
        "isAdr": False,
        "brand": {},
    }


def _financial_payload() -> dict[str, object]:
    return {
        "quarters": ["2025Q4"],
        "financials": {
            "2025Q4": {
                "calendarQuarter": "2025Q4",
                "periodEnd": "2025-12-31",
                "revenueBn": 10.0,
                "costOfRevenueBn": 6.0,
                "grossProfitBn": 4.0,
                "operatingExpensesBn": 2.0,
                "operatingIncomeBn": 2.0,
                "pretaxIncomeBn": 1.8,
                "taxBn": 0.3,
                "netIncomeBn": 1.5,
            }
        },
        "errors": [],
    }


class UniversalParserErrorDetailsTests(unittest.TestCase):
    def test_run_records_structured_error_details_for_fetch_exceptions(self) -> None:
        with (
            patch.object(universal_parser, "fetch_official_financial_history", side_effect=TimeoutError("companyfacts timeout")),
            patch.object(universal_parser, "fetch_stockanalysis_financial_history", return_value=_financial_payload()),
            patch.object(universal_parser, "fetch_official_segment_history", return_value={"quarters": {}, "errors": []}),
            patch.object(universal_parser, "fetch_official_revenue_structure_history", return_value={"quarters": {}, "errors": []}),
        ):
            result = universal_parser.run_universal_company_parser(_company(), refresh=True)

        attempts = result["diagnostics"]["financials"]["attempts"]
        official_attempt = next(attempt for attempt in attempts if attempt["source_id"] == "official")

        self.assertEqual(official_attempt["status"], "error")
        self.assertEqual(official_attempt["error"], "companyfacts timeout")
        self.assertEqual(
            official_attempt["error_details"],
            [
                {
                    "message": "companyfacts timeout",
                    "layer": "financials",
                    "sourceId": "official",
                    "phase": "fetch",
                    "errorType": "TimeoutError",
                    "severity": "error",
                }
            ],
        )

    def test_run_records_structured_error_details_from_empty_payload_errors(self) -> None:
        with (
            patch.object(
                universal_parser,
                "fetch_official_financial_history",
                return_value={
                    "financials": {},
                    "errors": ["companyfacts timeout"],
                    "errorDetails": [
                        {
                            "message": "companyfacts timeout",
                            "phase": "companyfacts",
                            "url": "https://example.com/companyfacts",
                        }
                    ],
                },
            ),
            patch.object(universal_parser, "fetch_stockanalysis_financial_history", return_value=_financial_payload()),
            patch.object(universal_parser, "fetch_official_segment_history", return_value={"quarters": {}, "errors": []}),
            patch.object(universal_parser, "fetch_official_revenue_structure_history", return_value={"quarters": {}, "errors": []}),
        ):
            result = universal_parser.run_universal_company_parser(_company(), refresh=True)

        attempts = result["diagnostics"]["financials"]["attempts"]
        official_attempt = next(attempt for attempt in attempts if attempt["source_id"] == "official")

        self.assertEqual(official_attempt["status"], "empty")
        self.assertEqual(official_attempt["error"], "companyfacts timeout")
        self.assertEqual(
            official_attempt["error_details"],
            [
                {
                    "message": "companyfacts timeout",
                    "phase": "companyfacts",
                    "url": "https://example.com/companyfacts",
                    "layer": "financials",
                    "sourceId": "official",
                    "severity": "error",
                }
            ],
        )


if __name__ == "__main__":
    unittest.main()
