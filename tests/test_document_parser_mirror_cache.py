import json
import sys
import tempfile
import types
import unittest
from pathlib import Path
from unittest.mock import patch


ROOT_DIR = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = ROOT_DIR / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

import document_parser  # noqa: E402


def _mirror_payload(*, version: str, fetched_at: int, text: str) -> dict[str, object]:
    return {
        "_cacheVersion": version,
        "fetchedAt": fetched_at,
        "text": text,
    }


class DocumentParserMirrorCacheTests(unittest.TestCase):
    def test_extract_text_via_jina_reuses_current_fresh_cache(self) -> None:
        now_ts = 1_800_000_000
        payload = _mirror_payload(
            version="test-mirror-cache",
            fetched_at=now_ts - 60,
            text="cached body",
        )

        with tempfile.TemporaryDirectory() as tmp_dir:
            cache_path = Path(tmp_dir) / "mirror.json"
            cache_path.write_text(json.dumps(payload), encoding="utf-8")

            with (
                patch.object(document_parser, "TEXT_MIRROR_CACHE_VERSION", "test-mirror-cache"),
                patch.object(document_parser, "_mirror_cache_path", return_value=cache_path),
                patch.object(document_parser, "TEXT_MIRROR_CACHE_TTL_SECONDS", 3600),
                patch.object(document_parser, "time") as time_module,
                patch.dict(document_parser.TEXT_MIRROR_CACHE, {}, clear=True),
                patch.object(document_parser, "_request_url", side_effect=AssertionError("fresh cache should be reused")),
            ):
                time_module.time.return_value = now_ts
                text = document_parser.extract_text_via_jina("https://example.com/report")

        self.assertEqual(text, "cached body")

    def test_extract_text_via_jina_rebuilds_stale_cache(self) -> None:
        now_ts = 1_800_000_000
        payload = _mirror_payload(
            version="test-mirror-cache",
            fetched_at=now_ts - 7200,
            text="stale body",
        )

        with tempfile.TemporaryDirectory() as tmp_dir:
            cache_path = Path(tmp_dir) / "mirror.json"
            cache_path.write_text(json.dumps(payload), encoding="utf-8")

            with (
                patch.object(document_parser, "TEXT_MIRROR_CACHE_VERSION", "test-mirror-cache"),
                patch.object(document_parser, "_mirror_cache_path", return_value=cache_path),
                patch.object(document_parser, "TEXT_MIRROR_CACHE_TTL_SECONDS", 3600),
                patch.object(document_parser, "time") as time_module,
                patch.dict(document_parser.TEXT_MIRROR_CACHE, {}, clear=True),
                patch.object(document_parser, "_request_url", return_value=types.SimpleNamespace(text="fresh body")),
            ):
                time_module.time.return_value = now_ts
                text = document_parser.extract_text_via_jina("https://example.com/report")
                cached = json.loads(cache_path.read_text(encoding="utf-8"))

        self.assertEqual(text, "fresh body")
        self.assertEqual(cached["_cacheVersion"], "test-mirror-cache")
        self.assertEqual(cached["text"], "fresh body")
        self.assertEqual(cached["fetchedAt"], now_ts)


if __name__ == "__main__":
    unittest.main()
