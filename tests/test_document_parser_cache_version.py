import json
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch


ROOT_DIR = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = ROOT_DIR / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

import document_parser  # noqa: E402


def _cached_payload(*, version: str, text: str) -> dict[str, object]:
    return {
        "version": version,
        "url": "https://example.com/report.txt",
        "final_url": "https://example.com/report.txt",
        "content_type": "text/plain",
        "kind": "text",
        "extraction_method": "plain-text",
        "language_profile": "en",
        "text": text,
        "page_texts": [],
        "html_tables": [],
        "metadata": {},
    }


class DocumentParserCacheVersionTests(unittest.TestCase):
    def test_current_version_cache_is_reused(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            cache_path = Path(tmp_dir) / "report.json"
            cache_path.write_text(
                json.dumps(_cached_payload(version="test-current", text="cached body")),
                encoding="utf-8",
            )

            with (
                patch.object(document_parser, "_parsed_cache_path", return_value=cache_path),
                patch.object(document_parser, "PARSER_VERSION", "test-current"),
                patch.object(document_parser, "_request_url", side_effect=AssertionError("should not rebuild")),
            ):
                parsed = document_parser.parse_document_url("https://example.com/report.txt", refresh=False)

        self.assertEqual(parsed.version, "test-current")
        self.assertEqual(parsed.text, "cached body")

    def test_stale_cache_is_rebuilt_instead_of_trusted(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            cache_path = Path(tmp_dir) / "report.json"
            cache_path.write_text(
                json.dumps(_cached_payload(version="legacy", text="stale body")),
                encoding="utf-8",
            )
            response = SimpleNamespace(
                headers={"content-type": "text/plain"},
                url="https://example.com/report.txt",
                content=b"fresh body",
            )

            with (
                patch.object(document_parser, "_parsed_cache_path", return_value=cache_path),
                patch.object(document_parser, "PARSER_VERSION", "test-current"),
                patch.object(document_parser, "_request_url", return_value=response) as request_mock,
            ):
                parsed = document_parser.parse_document_url("https://example.com/report.txt", refresh=False)
                cached = json.loads(cache_path.read_text(encoding="utf-8"))

        self.assertEqual(request_mock.call_count, 1)
        self.assertEqual(parsed.version, "test-current")
        self.assertEqual(parsed.text, "fresh body")
        self.assertEqual(cached["version"], "test-current")
        self.assertEqual(cached["text"], "fresh body")


if __name__ == "__main__":
    unittest.main()
