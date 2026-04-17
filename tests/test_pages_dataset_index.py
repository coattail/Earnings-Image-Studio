import json
import tempfile
import unittest
from pathlib import Path

from scripts import prepare_pages_artifact


class PagesDatasetIndexTests(unittest.TestCase):
    def test_build_dataset_index_payload_keeps_only_latest_quarter_financials(self) -> None:
        dataset = {
            "generatedAt": "2026-04-17T00:00:00Z",
            "companyCount": 1,
            "companies": [
                {
                    "id": "tsmc",
                    "ticker": "TSM",
                    "nameZh": "台积电",
                    "nameEn": "TSMC",
                    "slug": "tsm",
                    "rank": 1,
                    "isAdr": True,
                    "brand": {"primary": "#B91C1C"},
                    "quarters": ["2025Q4", "2026Q1"],
                    "coverage": {"quarterCount": 2},
                    "financials": {
                        "2025Q4": {"revenueBn": 10, "periodEnd": "2025-12-31"},
                        "2026Q1": {"revenueBn": 12, "periodEnd": "2026-03-31"},
                    },
                    "statementPresets": {
                        "2025Q4": {"mode": "old"},
                        "2026Q1": {"mode": "latest"},
                    },
                    "officialRevenueStructureHistory": {
                        "quarters": {
                            "2025Q4": {"segments": [{"name": "old"}]},
                            "2026Q1": {"segments": [{"name": "latest"}]},
                        }
                    },
                    "officialSegmentHistory": {
                        "quarters": {
                            "2025Q4": {"segments": [{"name": "old"}]},
                            "2026Q1": {"segments": [{"name": "latest"}]},
                        }
                    },
                    "parserDiagnostics": {"version": "heavy"},
                    "unifiedExtraction": {"engineVersion": "heavy"},
                }
            ],
        }

        index_payload = prepare_pages_artifact.build_dataset_index_payload(dataset)
        companies = index_payload["companies"]

        self.assertEqual(len(companies), 1)
        company = companies[0]
        self.assertEqual(company["latestQuarter"], "2026Q1")
        self.assertEqual(set(company["financials"].keys()), {"2026Q1"})
        self.assertEqual(set(company["statementPresets"].keys()), {"2026Q1"})
        self.assertEqual(set(company["officialRevenueStructureHistory"]["quarters"].keys()), {"2026Q1"})
        self.assertEqual(set(company["officialSegmentHistory"]["quarters"].keys()), {"2026Q1"})
        self.assertNotIn("parserDiagnostics", company)
        self.assertNotIn("unifiedExtraction", company)

    def test_write_dataset_index_file_writes_latest_only_sidecar(self) -> None:
        dataset = {
            "generatedAt": "2026-04-17T00:00:00Z",
            "companyCount": 1,
            "companies": [
                {
                    "id": "nvda",
                    "ticker": "NVDA",
                    "quarters": ["2025Q4", "2026Q1"],
                    "financials": {
                        "2025Q4": {"revenueBn": 44.1},
                        "2026Q1": {"revenueBn": 48.3},
                    },
                }
            ],
        }
        expected_payload = prepare_pages_artifact.build_dataset_index_payload(dataset)

        with tempfile.TemporaryDirectory() as tmp_dir:
            output_path = Path(tmp_dir) / "dataset-index.json"

            prepare_pages_artifact.write_dataset_index_file(dataset, output_path)

            written_payload = json.loads(output_path.read_text(encoding="utf-8"))

        self.assertEqual(written_payload, expected_payload)


if __name__ == "__main__":
    unittest.main()
