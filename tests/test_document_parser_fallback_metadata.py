import sys
import unittest
from pathlib import Path
from unittest.mock import patch


ROOT_DIR = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = ROOT_DIR / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

import document_parser  # noqa: E402


class DocumentParserFallbackMetadataTests(unittest.TestCase):
    def test_income_statement_fallback_marks_metadata(self) -> None:
        fallback_statement = document_parser.ParsedFinancialStatement(
            version=document_parser.PARSER_VERSION,
            statement_kind="income_statement",
            section_found=True,
            section_label="Income Statement",
            language_profile="en",
            lines=["Revenue 100"],
            rows={"revenue": [100.0]},
            metadata={"bnScale": 1.0},
        )

        with (
            patch.object(document_parser, "parse_document_url", side_effect=RuntimeError("primary parse failed")),
            patch.object(document_parser, "extract_text_via_jina", return_value="Revenue 100"),
            patch.object(document_parser, "parse_income_statement", return_value=fallback_statement),
        ):
            parsed = document_parser.parse_income_statement_from_url("https://example.com/report.pdf")

        self.assertTrue(parsed.metadata["fallbackUsed"])
        self.assertEqual(parsed.metadata["fallbackSource"], "jina")
        self.assertEqual(parsed.metadata["fallbackReason"], "primary parse failed")
        self.assertEqual(parsed.rows["revenue"][0], 100.0)


if __name__ == "__main__":
    unittest.main()
