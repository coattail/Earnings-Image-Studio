import json
import sys
import tempfile
import unittest
import urllib.error
from http.client import IncompleteRead
from pathlib import Path
from unittest.mock import MagicMock, patch

ROOT_DIR = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = ROOT_DIR / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

import official_segments  # noqa: E402


class OfficialSegmentsTests(unittest.TestCase):
    def setUp(self):
        self.module = official_segments
        self._original_cache = self.module.SEC_TICKER_CACHE
        self.module.SEC_TICKER_CACHE = None

    def tearDown(self):
        self.module.SEC_TICKER_CACHE = self._original_cache

    def test_submission_records_appends_diagnostic_when_archived_fetch_fails(self):
        submissions = {
            "filings": {
                "recent": {
                    "form": ["10-Q"],
                    "accessionNumber": ["0000001-23-000001"],
                    "filingDate": ["2023-01-01"],
                    "primaryDocument": ["doc1.htm"],
                },
                "files": [{"name": "CIK12345"}],
            }
        }
        diagnostics: list[str] = []

        def fail_request(_: str):
            raise urllib.error.HTTPError("https://data.sec.gov/submissions/CIK12345", 503, "Service Unavailable", hdrs=None, fp=None)

        with patch.object(self.module, "_request_json", side_effect=fail_request):
            records = self.module._submission_records(submissions, diagnostics)

        self.assertEqual(records, [("10-Q", "0000001-23-000001", "2023-01-01", "doc1.htm")])
        self.assertEqual(
            diagnostics,
            ["archived submissions CIK12345: HTTP Error 503: Service Unavailable"],
        )

    def test_resolve_cik_refresh_reloads_remote_data_even_with_cache(self):
        self.module.SEC_TICKER_CACHE = {"OLD": 111}
        fresh_payload = {"1": {"ticker": "FRESH", "cik_str": "123456"}}
        with tempfile.TemporaryDirectory() as temp_dir:
            cache_path = Path(temp_dir) / "sec-company-tickers.json"
            cache_path.write_text(
                json.dumps({"placeholder": {"ticker": "OLD", "cik_str": "111"}}), encoding="utf-8"
            )
            with patch.object(self.module, "_cache_path", return_value=cache_path), patch.object(
                self.module, "_request_json", return_value=fresh_payload
            ) as request_json:
                cik = self.module._resolve_cik("FRESH", refresh=True)

        self.assertEqual(cik, 123456)
        request_json.assert_called_once()
        self.assertEqual(self.module.SEC_TICKER_CACHE.get("FRESH"), 123456)

    def test_resolve_cik_uses_disk_cache_when_refresh_false(self):
        payload = {"1": {"ticker": "CACHE", "cik_str": "444"}}
        with tempfile.TemporaryDirectory() as temp_dir:
            cache_path = Path(temp_dir) / "sec-company-tickers.json"
            cache_path.write_text(json.dumps(payload), encoding="utf-8")
            with patch.object(self.module, "_cache_path", return_value=cache_path), patch.object(
                self.module, "_request_json"
            ) as request_json:
                cik = self.module._resolve_cik("CACHE", refresh=False)

        self.assertEqual(cik, 444)
        request_json.assert_not_called()

    def test_resolve_cik_refresh_falls_back_to_disk_cache_when_remote_fetch_fails(self):
        payload = {"1": {"ticker": "TSM", "cik_str": "1046179"}}
        with tempfile.TemporaryDirectory() as temp_dir:
            cache_path = Path(temp_dir) / "sec-company-tickers.json"
            cache_path.write_text(json.dumps(payload), encoding="utf-8")
            with patch.object(self.module, "_cache_path", return_value=cache_path), patch.object(
                self.module, "_request_json", side_effect=urllib.error.URLError("upstream reset")
            ) as request_json:
                cik = self.module._resolve_cik("TSM", refresh=True)

        self.assertEqual(cik, 1046179)
        request_json.assert_called_once()
        self.assertEqual(self.module.SEC_TICKER_CACHE.get("TSM"), 1046179)

    def test_request_falls_back_to_requests_after_repeated_incomplete_reads(self):
        response = MagicMock()
        response.content = b"ok"
        response.raise_for_status.return_value = None

        with (
            patch.object(self.module.urllib.request, "urlopen", side_effect=IncompleteRead(b"partial", 10)),
            patch.object(self.module.requests, "get", return_value=response) as requests_get,
        ):
            payload = self.module._request("https://example.com/test")

        self.assertEqual(payload, b"ok")
        requests_get.assert_called_once_with(
            "https://example.com/test",
            timeout=60,
            headers=self.module.SEC_HEADERS,
        )

    def test_refresh_parses_only_accessions_missing_from_current_cache(self):
        old_accession = "0000000001-26-000001"
        new_accession = "0000000001-26-000002"
        cached_payload = {
            "_cacheVersion": self.module.CACHE_VERSION,
            "source": "official-filings",
            "ticker": "DMO",
            "cik": 1,
            "axis": "StatementBusinessSegmentsAxis",
            "quarters": {"2026Q1": [{"memberKey": "demo", "valueBn": 1.0}]},
            "filingsUsed": [
                {
                    "form": "10-Q",
                    "filingDate": "2026-05-01",
                    "accession": old_accession,
                    "primaryDocument": "old.htm",
                    "instance": "old.xml",
                }
            ],
            "errors": [],
            "errorDetails": [],
        }
        submissions = {
            "filings": {
                "recent": {
                    "form": ["10-Q", "10-Q"],
                    "accessionNumber": [new_accession, old_accession],
                    "filingDate": ["2026-08-01", "2026-05-01"],
                    "primaryDocument": ["new.htm", "old.htm"],
                },
                "files": [{"name": "should-not-be-read.json"}],
            }
        }
        new_fact = self.module.SegmentFact(
            accession=new_accession,
            filing_date="2026-08-01",
            form="10-Q",
            concept="RevenueFromContractWithCustomerExcludingAssessedTax",
            concept_priority=120,
            axis_key="StatementBusinessSegmentsAxis",
            axis_priority=100,
            member_key="DemoMember",
            label="Demo",
            context_scope_priority=3,
            start_date="2026-04-01",
            end_date="2026-06-30",
            value=2_000_000_000,
            source_url="https://example.com/new.xml",
        )

        with tempfile.TemporaryDirectory() as temp_dir:
            cache_path = Path(temp_dir) / "demo.json"
            cache_path.write_text(json.dumps(cached_payload), encoding="utf-8")

            def fake_request_json(url: str):
                if url.endswith("CIK0000000001.json"):
                    return submissions
                if new_accession.replace("-", "") in url:
                    return {"directory": {"item": []}}
                raise AssertionError(f"unexpected request: {url}")

            with (
                patch.object(self.module, "CACHE_DIR", Path(temp_dir)),
                patch.object(self.module, "_resolve_cik", return_value=1) as resolve_cik,
                patch.object(self.module, "_request_json", side_effect=fake_request_json),
                patch.object(self.module, "_choose_instance_name", return_value="new.xml"),
                patch.object(self.module, "_parse_instance_facts", return_value=[new_fact]) as parse_facts,
                patch.object(self.module.time, "sleep"),
            ):
                result = self.module.fetch_official_segment_history(
                    {"id": "demo", "ticker": "DMO"},
                    refresh=True,
                )

        resolve_cik.assert_called_once_with("DMO", refresh=False)
        parse_facts.assert_called_once()
        self.assertIn("2026Q1", result["quarters"])
        self.assertIn("2026Q2", result["quarters"])
        self.assertEqual(result["quarters"]["2026Q2"][0]["valueBn"], 2.0)
        self.assertEqual(
            [item["accession"] for item in result["filingsUsed"]],
            [old_accession, new_accession],
        )

    def test_segment_total_context_beats_higher_priority_product_detail(self):
        def fact(*, concept: str, concept_priority: int, scope_priority: int, value: float):
            return self.module.SegmentFact(
                accession="test",
                filing_date="2018-06-04",
                form="10-Q",
                concept=concept,
                concept_priority=concept_priority,
                axis_key="StatementBusinessSegmentsAxis",
                axis_priority=100,
                member_key="WalmartUSMember",
                label="Walmart US",
                context_scope_priority=scope_priority,
                start_date="2018-02-01",
                end_date="2018-04-30",
                value=value,
                source_url="https://example.com/filing.xml",
            )

        rows = self.module._build_quarterly_series(
            [
                fact(
                    concept="RevenueFromContractWithCustomerExcludingAssessedTax",
                    concept_priority=120,
                    scope_priority=0,
                    value=3_200_000_000,
                ),
                fact(
                    concept="SalesRevenueNet",
                    concept_priority=112,
                    scope_priority=3,
                    value=77_748_000_000,
                ),
            ]
        )

        self.assertEqual(rows["2018Q2"][0]["valueBn"], 77.748)

    def test_context_scope_prefers_segment_only_then_aggregate_extra_dimension(self):
        segment_axis = ("us-gaap:StatementBusinessSegmentsAxis", "wmt:WalmartUSMember")

        self.assertEqual(self.module._context_scope_priority([segment_axis], "StatementBusinessSegmentsAxis"), 3)
        self.assertEqual(
            self.module._context_scope_priority(
                [
                    ("us-gaap:ProductOrServiceAxis", "wmt:ProductandservicesTotalMember"),
                    segment_axis,
                ],
                "StatementBusinessSegmentsAxis",
            ),
            2,
        )
        self.assertEqual(
            self.module._context_scope_priority(
                [
                    ("us-gaap:MajorCustomersAxis", "wmt:ECommerceMember"),
                    segment_axis,
                ],
                "StatementBusinessSegmentsAxis",
            ),
            0,
        )


if __name__ == "__main__":
    unittest.main()
