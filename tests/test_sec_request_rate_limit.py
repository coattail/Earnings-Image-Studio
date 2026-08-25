import io
import sys
import unittest
import urllib.error
from pathlib import Path
from unittest.mock import patch


ROOT_DIR = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = ROOT_DIR / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

import official_segments  # noqa: E402


class _Response:
    def __init__(self, payload: bytes) -> None:
        self.payload = payload

    def __enter__(self) -> "_Response":
        return self

    def __exit__(self, *args: object) -> None:
        return None

    def read(self) -> bytes:
        return self.payload


class SecRequestRateLimitTests(unittest.TestCase):
    def test_sec_request_waits_for_shared_request_slot(self) -> None:
        with (
            patch.object(official_segments, "_wait_for_sec_request_slot") as wait_mock,
            patch.object(official_segments.urllib.request, "urlopen", return_value=_Response(b"{}")),
        ):
            result = official_segments._request("https://data.sec.gov/submissions/CIK0000320193.json")

        self.assertEqual(result, b"{}")
        wait_mock.assert_called_once_with()

    def test_sec_429_applies_cooldown_before_retry(self) -> None:
        rate_limit_error = urllib.error.HTTPError(
            "https://data.sec.gov/submissions/CIK0000320193.json",
            429,
            "Too Many Requests",
            {"Retry-After": "45"},
            io.BytesIO(),
        )
        with (
            patch.object(official_segments, "_wait_for_sec_request_slot") as wait_mock,
            patch.object(official_segments, "_apply_sec_rate_limit_cooldown") as cooldown_mock,
            patch.object(
                official_segments.urllib.request,
                "urlopen",
                side_effect=[rate_limit_error, _Response(b'{"ok": true}')],
            ),
        ):
            result = official_segments._request("https://data.sec.gov/submissions/CIK0000320193.json")

        self.assertEqual(result, b'{"ok": true}')
        self.assertEqual(wait_mock.call_count, 2)
        cooldown_mock.assert_called_once_with(rate_limit_error)

    def test_persistent_sec_429_stops_without_unpaced_requests_fallback(self) -> None:
        rate_limit_error = urllib.error.HTTPError(
            "https://data.sec.gov/submissions/CIK0000320193.json",
            429,
            "Too Many Requests",
            {},
            io.BytesIO(),
        )
        with (
            patch.object(official_segments, "_wait_for_sec_request_slot"),
            patch.object(official_segments, "_apply_sec_rate_limit_cooldown") as cooldown_mock,
            patch.object(official_segments.urllib.request, "urlopen", side_effect=rate_limit_error) as urlopen_mock,
            patch.object(official_segments.requests, "get") as requests_get_mock,
        ):
            with self.assertRaises(urllib.error.HTTPError) as context:
                official_segments._request("https://data.sec.gov/submissions/CIK0000320193.json")

        self.assertEqual(context.exception.code, 429)
        self.assertEqual(urlopen_mock.call_count, official_segments.SEC_RATE_LIMIT_MAX_ATTEMPTS)
        self.assertEqual(cooldown_mock.call_count, official_segments.SEC_RATE_LIMIT_MAX_ATTEMPTS)
        requests_get_mock.assert_not_called()


if __name__ == "__main__":
    unittest.main()
