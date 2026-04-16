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


if __name__ == "__main__":
    unittest.main()
