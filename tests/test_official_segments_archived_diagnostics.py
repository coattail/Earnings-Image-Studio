import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


ROOT_DIR = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = ROOT_DIR / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

import official_segments  # noqa: E402


def _company() -> dict[str, object]:
    return {
        "id": "ibm",
        "ticker": "IBM",
    }


class OfficialSegmentsArchivedDiagnosticsTests(unittest.TestCase):
    def test_fetch_official_segment_history_records_archived_submission_fetch_errors(self) -> None:
        submissions_payload = {
            "filings": {
                "recent": {
                    "form": [],
                    "accessionNumber": [],
                    "filingDate": [],
                    "primaryDocument": [],
                },
                "files": [{"name": "old-submissions.json"}],
            }
        }

        def fake_request_json(url: str):
            if url.endswith("/CIK0000000123.json"):
                return submissions_payload
            if url.endswith("/old-submissions.json"):
                raise RuntimeError("archive down")
            raise AssertionError(f"unexpected url: {url}")

        with tempfile.TemporaryDirectory() as tmp_dir:
            with (
                patch.object(official_segments, "CACHE_DIR", Path(tmp_dir)),
                patch.object(official_segments, "_resolve_cik", return_value=123),
                patch.object(official_segments, "_request_json", side_effect=fake_request_json),
            ):
                result = official_segments.fetch_official_segment_history(_company(), refresh=True)

        self.assertTrue(
            any("old-submissions.json" in error and "archive down" in error for error in result["errors"]),
            result["errors"],
        )
        self.assertTrue(
            any(
                detail == {
                    "message": "archive down",
                    "layer": "segments",
                    "sourceId": "official_segments",
                    "phase": "archived-submissions",
                    "severity": "error",
                    "errorType": "RuntimeError",
                    "file": "old-submissions.json",
                    "url": "https://data.sec.gov/submissions/old-submissions.json",
                }
                for detail in result["errorDetails"]
            ),
            result.get("errorDetails"),
        )

    def test_fetch_official_segment_history_emits_structured_submission_error_details(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            with (
                patch.object(official_segments, "CACHE_DIR", Path(tmp_dir)),
                patch.object(official_segments, "_resolve_cik", return_value=123),
                patch.object(official_segments, "_request_json", side_effect=RuntimeError("submissions down")),
            ):
                result = official_segments.fetch_official_segment_history(_company(), refresh=True)

        self.assertEqual(result["errors"], ["submissions: submissions down"])
        self.assertEqual(
            result["errorDetails"],
            [
                {
                    "message": "submissions down",
                    "layer": "segments",
                    "sourceId": "official_segments",
                    "phase": "submissions",
                    "severity": "error",
                    "errorType": "RuntimeError",
                    "url": "https://data.sec.gov/submissions/CIK0000000123.json",
                }
            ],
        )


if __name__ == "__main__":
    unittest.main()
