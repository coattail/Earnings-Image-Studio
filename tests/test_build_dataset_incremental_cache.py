import json
import sys
import tempfile
import unittest
from argparse import Namespace
from pathlib import Path
from unittest.mock import patch
import builtins


ROOT_DIR = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = ROOT_DIR / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

import build_dataset  # noqa: E402
import extraction_engine  # noqa: E402


def _company(company_id: str, ticker: str) -> dict[str, object]:
    return {
        "id": company_id,
        "ticker": ticker,
        "slug": ticker.lower(),
        "nameEn": ticker,
        "nameZh": ticker,
        "rank": 1,
        "isAdr": False,
        "brand": {},
    }


def _payload(company_id: str, version: str, *, with_unified: bool) -> dict[str, object]:
    payload: dict[str, object] = {
        "id": company_id,
        "ticker": company_id.upper(),
        "slug": company_id,
        "nameEn": company_id,
        "nameZh": company_id,
        "rank": 1,
        "isAdr": False,
        "brand": {},
        "quarters": ["2025Q4"],
        "financials": {"2025Q4": {}},
        "officialSegmentHistory": {"quarters": {}},
        "officialRevenueStructureHistory": {"quarters": {}},
        "errors": [],
        "parserDiagnostics": {
            "version": version,
            "financials": {},
            "segments": {},
            "revenueStructures": {},
            "summary": {},
            "validation": {},
        },
    }
    if with_unified:
        payload["unifiedExtraction"] = {
            "engineVersion": extraction_engine.ENGINE_VERSION,
            "sources": [],
            "provenance": {},
            "diagnostics": {},
        }
    return payload


class BuildDatasetIncrementalCacheTests(unittest.TestCase):
    def test_cache_compatibility_requires_current_version_and_unified_extraction(self) -> None:
        compatible_payload = _payload("compatible", "universal-parser-v4", with_unified=True)
        current_version_without_unified = _payload("current-no-unified", "universal-parser-v4", with_unified=False)
        legacy_payload = _payload("legacy", "universal-parser-v3", with_unified=False)
        stale_unified_payload = _payload("stale-unified", "universal-parser-v4", with_unified=True)
        stale_unified_payload["unifiedExtraction"]["engineVersion"] = "old-engine"

        self.assertTrue(build_dataset.is_company_payload_cache_compatible(compatible_payload))
        self.assertFalse(build_dataset.is_company_payload_cache_compatible(current_version_without_unified))
        self.assertFalse(build_dataset.is_company_payload_cache_compatible(legacy_payload))
        self.assertFalse(build_dataset.is_company_payload_cache_compatible(stale_unified_payload))

    def test_incremental_build_rebuilds_unselected_incompatible_cache(self) -> None:
        selected_company = _company("selected", "SEL")
        stale_company = _company("stale", "STL")
        selected_payload = _payload("selected", "universal-parser-v4", with_unified=True)
        rebuilt_payload = _payload("stale", "universal-parser-v4", with_unified=True)
        stale_cached_payload = _payload("stale", "universal-parser-v3", with_unified=False)

        def fake_build_company_payload(company: dict[str, object], refresh: bool) -> dict[str, object]:
            if company["id"] == "selected":
                return json.loads(json.dumps(selected_payload))
            if company["id"] == "stale":
                return json.loads(json.dumps(rebuilt_payload))
            raise AssertionError(f"unexpected company build: {company['id']}")

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir)
            cache_dir = tmp_path / "cache"
            output_path = tmp_path / "earnings-dataset.json"
            dataset_index_path = tmp_path / "dataset-index.json"

            with (
                patch.object(build_dataset, "TOP30_COMPANIES", [selected_company, stale_company]),
                patch.object(build_dataset, "COMPANY_CACHE_DIR", cache_dir),
                patch.object(build_dataset, "OUTPUT_PATH", output_path),
                patch.object(build_dataset, "DATASET_INDEX_PATH", dataset_index_path),
                patch.object(build_dataset, "parse_args", return_value=Namespace(refresh=False, companies="selected")),
                patch.object(build_dataset, "load_manual_presets", return_value={}),
                patch.object(build_dataset, "load_manual_company_overrides", return_value={}),
                patch.object(build_dataset, "load_fx_cache", return_value={}),
                patch.object(build_dataset, "save_fx_cache"),
                patch.object(build_dataset, "time") as mock_time,
                patch.object(build_dataset, "load_cached_company_payload", side_effect=lambda company_id: json.loads(json.dumps(stale_cached_payload)) if company_id == "stale" else None),
                patch.object(build_dataset, "build_company_payload_with_universal_parser", side_effect=fake_build_company_payload),
                patch.object(build_dataset, "supplement_tencent_official_financials", side_effect=lambda payload: payload),
                patch.object(build_dataset, "sanitize_implausible_q4_revenue_aligned_statements", side_effect=lambda payload: payload),
                patch.object(build_dataset, "apply_manual_company_override", side_effect=lambda payload, company, overrides: payload),
                patch.object(build_dataset, "apply_usd_display_fields", side_effect=lambda payload, cache: payload),
                patch.object(build_dataset, "apply_fused_extraction", side_effect=lambda payload, company, refresh: payload),
                patch.object(build_dataset, "finalize_company_payload", side_effect=lambda company, payload, presets: payload),
                patch.object(build_dataset, "build_dataset_classification_audit", return_value={"blockingIssues": []}),
            ):
                mock_time.sleep.return_value = None
                mock_time.strftime.return_value = "2026-03-29T00:00:00Z"
                mock_time.gmtime.return_value = object()

                exit_code = build_dataset.main()
                dataset = json.loads(output_path.read_text(encoding="utf-8"))

        self.assertEqual(exit_code, 0)
        stale_entry = next(company for company in dataset["companies"] if company["id"] == "stale")

        self.assertEqual(stale_entry["parserDiagnostics"]["version"], "universal-parser-v4")
        self.assertIn("unifiedExtraction", stale_entry)

    def test_incremental_build_logs_stale_unified_engine_version_on_rebuild(self) -> None:
        selected_company = _company("selected", "SEL")
        stale_company = _company("stale", "STL")
        selected_payload = _payload("selected", "universal-parser-v4", with_unified=True)
        rebuilt_payload = _payload("stale", "universal-parser-v4", with_unified=True)
        stale_cached_payload = _payload("stale", "universal-parser-v4", with_unified=True)
        stale_cached_payload["unifiedExtraction"]["engineVersion"] = "old-engine"

        def fake_build_company_payload(company: dict[str, object], refresh: bool) -> dict[str, object]:
            if company["id"] == "selected":
                return json.loads(json.dumps(selected_payload))
            if company["id"] == "stale":
                return json.loads(json.dumps(rebuilt_payload))
            raise AssertionError(f"unexpected company build: {company['id']}")

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir)
            cache_dir = tmp_path / "cache"
            output_path = tmp_path / "earnings-dataset.json"
            dataset_index_path = tmp_path / "dataset-index.json"

            with (
                patch.object(build_dataset, "TOP30_COMPANIES", [selected_company, stale_company]),
                patch.object(build_dataset, "COMPANY_CACHE_DIR", cache_dir),
                patch.object(build_dataset, "OUTPUT_PATH", output_path),
                patch.object(build_dataset, "DATASET_INDEX_PATH", dataset_index_path),
                patch.object(build_dataset, "parse_args", return_value=Namespace(refresh=False, companies="selected")),
                patch.object(build_dataset, "load_manual_presets", return_value={}),
                patch.object(build_dataset, "load_manual_company_overrides", return_value={}),
                patch.object(build_dataset, "load_fx_cache", return_value={}),
                patch.object(build_dataset, "save_fx_cache"),
                patch.object(build_dataset, "time") as mock_time,
                patch.object(build_dataset, "load_cached_company_payload", side_effect=lambda company_id: json.loads(json.dumps(stale_cached_payload)) if company_id == "stale" else None),
                patch.object(build_dataset, "build_company_payload_with_universal_parser", side_effect=fake_build_company_payload),
                patch.object(build_dataset, "supplement_tencent_official_financials", side_effect=lambda payload: payload),
                patch.object(build_dataset, "sanitize_implausible_q4_revenue_aligned_statements", side_effect=lambda payload: payload),
                patch.object(build_dataset, "apply_manual_company_override", side_effect=lambda payload, company, overrides: payload),
                patch.object(build_dataset, "apply_usd_display_fields", side_effect=lambda payload, cache: payload),
                patch.object(build_dataset, "apply_fused_extraction", side_effect=lambda payload, company, refresh: payload),
                patch.object(build_dataset, "finalize_company_payload", side_effect=lambda company, payload, presets: payload),
                patch.object(build_dataset, "build_dataset_classification_audit", return_value={"blockingIssues": []}),
                patch.object(builtins, "print") as mock_print,
            ):
                mock_time.sleep.return_value = None
                mock_time.strftime.return_value = "2026-03-29T00:00:00Z"
                mock_time.gmtime.return_value = object()

                exit_code = build_dataset.main()

        self.assertEqual(exit_code, 0)
        rebuild_logs = [
            " ".join(str(arg) for arg in call.args)
            for call in mock_print.call_args_list
            if call.args and "[rebuild]" in str(call.args[0])
        ]
        self.assertEqual(len(rebuild_logs), 1)
        self.assertIn("unifiedEngineVersion=old-engine", rebuild_logs[0])

    def test_incremental_build_preserves_existing_selected_company_history(self) -> None:
        selected_company = _company("selected", "SEL")
        existing_payload = _payload("selected", "universal-parser-v4", with_unified=True)
        existing_payload["quarters"] = ["2024Q4"]
        existing_payload["financials"] = {
            "2024Q4": {
                "calendarQuarter": "2024Q4",
                "revenueBn": 10,
                "officialRevenueSegments": [
                    {"name": "Legacy Segment", "memberKey": "legacy", "valueBn": 4},
                ],
            }
        }
        new_payload = _payload("selected", "universal-parser-v4", with_unified=True)
        new_payload["quarters"] = ["2025Q1"]
        new_payload["financials"] = {
            "2025Q1": {
                "calendarQuarter": "2025Q1",
                "revenueBn": 12,
            }
        }

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir)
            cache_dir = tmp_path / "cache"
            output_path = tmp_path / "earnings-dataset.json"
            dataset_index_path = tmp_path / "dataset-index.json"
            output_path.write_text(
                json.dumps({"companies": [existing_payload]}),
                encoding="utf-8",
            )

            with (
                patch.object(build_dataset, "TOP30_COMPANIES", [selected_company]),
                patch.object(build_dataset, "COMPANY_CACHE_DIR", cache_dir),
                patch.object(build_dataset, "OUTPUT_PATH", output_path),
                patch.object(build_dataset, "DATASET_INDEX_PATH", dataset_index_path),
                patch.object(build_dataset, "parse_args", return_value=Namespace(refresh=True, companies="selected")),
                patch.object(build_dataset, "load_manual_presets", return_value={}),
                patch.object(build_dataset, "load_manual_company_overrides", return_value={}),
                patch.object(build_dataset, "load_fx_cache", return_value={}),
                patch.object(build_dataset, "save_fx_cache"),
                patch.object(build_dataset, "time") as mock_time,
                patch.object(build_dataset, "build_company_payload_with_universal_parser", return_value=json.loads(json.dumps(new_payload))),
                patch.object(build_dataset, "supplement_tencent_official_financials", side_effect=lambda payload: payload),
                patch.object(build_dataset, "sanitize_implausible_q4_revenue_aligned_statements", side_effect=lambda payload: payload),
                patch.object(build_dataset, "apply_manual_company_override", side_effect=lambda payload, company, overrides: payload),
                patch.object(build_dataset, "apply_usd_display_fields", side_effect=lambda payload, cache: payload),
                patch.object(build_dataset, "apply_fused_extraction", side_effect=lambda payload, company, refresh: payload),
                patch.object(build_dataset, "build_dataset_classification_audit", return_value={"blockingIssues": []}),
            ):
                mock_time.sleep.return_value = None
                mock_time.strftime.return_value = "2026-03-29T00:00:00Z"
                mock_time.gmtime.return_value = object()

                exit_code = build_dataset.main()
                dataset = json.loads(output_path.read_text(encoding="utf-8"))

        selected_entry = dataset["companies"][0]
        self.assertEqual(exit_code, 0)
        self.assertEqual(selected_entry["quarters"], ["2024Q4", "2025Q1"])
        self.assertEqual(selected_entry["financials"]["2024Q4"]["officialRevenueSegments"][0]["name"], "Legacy Segment")

    def test_full_build_preserves_existing_company_history(self) -> None:
        selected_company = _company("selected", "SEL")
        existing_payload = _payload("selected", "universal-parser-v4", with_unified=True)
        existing_payload["quarters"] = ["2024Q4"]
        existing_payload["financials"] = {
            "2024Q4": {
                "calendarQuarter": "2024Q4",
                "revenueBn": 10,
                "officialRevenueSegments": [
                    {"name": "Legacy Segment", "memberKey": "legacy", "valueBn": 4},
                ],
            }
        }
        existing_payload["officialRevenueStructureHistory"] = {
            "quarters": {
                "2024Q4": {
                    "segments": [
                        {"name": "Legacy Segment", "memberKey": "legacy", "valueBn": 4},
                    ],
                },
            },
        }
        new_payload = _payload("selected", "universal-parser-v4", with_unified=True)
        new_payload["quarters"] = ["2025Q1"]
        new_payload["financials"] = {
            "2025Q1": {
                "calendarQuarter": "2025Q1",
                "revenueBn": 12,
            }
        }

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir)
            cache_dir = tmp_path / "cache"
            output_path = tmp_path / "earnings-dataset.json"
            dataset_index_path = tmp_path / "dataset-index.json"
            output_path.write_text(
                json.dumps({"companies": [existing_payload]}),
                encoding="utf-8",
            )

            with (
                patch.object(build_dataset, "TOP30_COMPANIES", [selected_company]),
                patch.object(build_dataset, "COMPANY_CACHE_DIR", cache_dir),
                patch.object(build_dataset, "OUTPUT_PATH", output_path),
                patch.object(build_dataset, "DATASET_INDEX_PATH", dataset_index_path),
                patch.object(build_dataset, "parse_args", return_value=Namespace(refresh=True, companies="")),
                patch.object(build_dataset, "load_manual_presets", return_value={}),
                patch.object(build_dataset, "load_manual_company_overrides", return_value={}),
                patch.object(build_dataset, "load_fx_cache", return_value={}),
                patch.object(build_dataset, "save_fx_cache"),
                patch.object(build_dataset, "time") as mock_time,
                patch.object(build_dataset, "build_company_payload_with_universal_parser", return_value=json.loads(json.dumps(new_payload))),
                patch.object(build_dataset, "supplement_tencent_official_financials", side_effect=lambda payload: payload),
                patch.object(build_dataset, "sanitize_implausible_q4_revenue_aligned_statements", side_effect=lambda payload: payload),
                patch.object(build_dataset, "apply_manual_company_override", side_effect=lambda payload, company, overrides: payload),
                patch.object(build_dataset, "apply_usd_display_fields", side_effect=lambda payload, cache: payload),
                patch.object(build_dataset, "apply_fused_extraction", side_effect=lambda payload, company, refresh: payload),
                patch.object(build_dataset, "build_dataset_classification_audit", return_value={"blockingIssues": []}),
            ):
                mock_time.sleep.return_value = None
                mock_time.strftime.return_value = "2026-03-29T00:00:00Z"
                mock_time.gmtime.return_value = object()

                exit_code = build_dataset.main()
                dataset = json.loads(output_path.read_text(encoding="utf-8"))

        selected_entry = dataset["companies"][0]
        self.assertEqual(exit_code, 0)
        self.assertEqual(selected_entry["quarters"], ["2024Q4", "2025Q1"])
        self.assertEqual(selected_entry["financials"]["2024Q4"]["officialRevenueSegments"][0]["memberKey"], "legacy")
        self.assertEqual(
            selected_entry["officialRevenueStructureHistory"]["quarters"]["2024Q4"]["segments"][0]["memberKey"],
            "legacy",
        )


if __name__ == "__main__":
    unittest.main()
