from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parents[1]


class CompanySearchLayoutTest(unittest.TestCase):
    def test_filtered_company_cards_keep_content_height(self) -> None:
        stylesheet = (ROOT / "style.css").read_text(encoding="utf-8")
        match = re.search(r"\.company-list\s*\{(?P<body>[^}]*)\}", stylesheet)

        self.assertIsNotNone(match)
        declarations = match.group("body")
        self.assertRegex(declarations, r"align-content\s*:\s*start\s*;")
        self.assertRegex(declarations, r"grid-auto-rows\s*:\s*max-content\s*;")

    def test_index_references_company_search_layout_stylesheet(self) -> None:
        index_html = (ROOT / "index.html").read_text(encoding="utf-8")

        self.assertIn("style.css?v=20260903-company-search-layout-v164", index_html)


if __name__ == "__main__":
    unittest.main()
