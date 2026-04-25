import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


ROOT_DIR = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = ROOT_DIR / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

import official_revenue_structures  # noqa: E402


def _company() -> dict[str, object]:
    return {
        "id": "alphabet",
        "ticker": "GOOGL",
        "slug": "googl",
        "nameEn": "Alphabet",
        "nameZh": "谷歌",
        "rank": 1,
        "isAdr": False,
        "brand": {},
    }


def _quarter_payload(quarter: str, member_key: str) -> dict[str, object]:
    return {
        "calendarQuarter": quarter,
        "officialRevenueSegments": [
            {
                "memberKey": member_key,
                "name": member_key,
                "nameZh": member_key,
                "valueBn": 1.0,
            }
        ],
    }


class OfficialRevenueStructuresRefreshTests(unittest.TestCase):
    def test_merged_filing_entries_prefers_fresh_submission_fields(self) -> None:
        fresh_filing = {
            "form": "10-Q",
            "accession": "0001-0001",
            "filingDate": "2026-04-21",
            "primaryDocument": "fresh.htm",
            "instance": "fresh.xml",
        }
        cached_filing = {
            "form": "10-K",
            "accession": "0001-0001",
            "filingDate": "2026-04-20",
            "primaryDocument": "stale.htm",
            "instance": "stale.xml",
            "presentation": "deck.pdf",
        }

        with (
            patch.object(official_revenue_structures, "_submission_filing_entries", return_value=[fresh_filing]),
            patch.object(official_revenue_structures, "_load_cached_filing_entries", return_value=[cached_filing]),
        ):
            merged = official_revenue_structures._merged_filing_entries("alphabet", 123456)

        self.assertEqual(len(merged), 1)
        self.assertEqual(merged[0]["form"], "10-Q")
        self.assertEqual(merged[0]["filingDate"], "2026-04-21")
        self.assertEqual(merged[0]["primaryDocument"], "fresh.htm")
        self.assertEqual(merged[0]["instance"], "fresh.xml")
        self.assertEqual(merged[0]["presentation"], "deck.pdf")

    def test_refresh_bypasses_dependency_cache_reads(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            cache_dir = Path(tmp_dir)
            for filename in ("alphabet.json", "asml.json", "tsmc.json"):
                (cache_dir / filename).write_text("{}", encoding="utf-8")

            with (
                patch.object(official_revenue_structures, "OFFICIAL_SEGMENT_CACHE_DIR", cache_dir),
                patch.object(official_revenue_structures, "OFFICIAL_FINANCIAL_CACHE_DIR", cache_dir),
                patch.object(official_revenue_structures, "STOCKANALYSIS_FINANCIAL_CACHE_DIR", cache_dir),
                patch.object(
                    official_revenue_structures,
                    "_load_cached_json",
                    side_effect=AssertionError("refresh=True should bypass dependency cache reads"),
                ),
                patch.dict(official_revenue_structures.STOCKANALYSIS_FINANCIAL_CACHE, {}, clear=True),
            ):
                self.assertEqual(official_revenue_structures._load_cached_filing_entries("alphabet", refresh=True), [])
                self.assertEqual(official_revenue_structures._load_cached_financial_entries("asml", refresh=True), [])
                self.assertEqual(official_revenue_structures._load_stockanalysis_financial_payload("tsmc", refresh=True), {})

    def test_refresh_does_not_preserve_cached_quarters_when_fresh_parse_is_partial(self) -> None:
        cached_payload = {
            "_cacheVersion": official_revenue_structures.CACHE_VERSION,
            "source": "official-revenue-structures",
            "quarters": {
                "2025Q4": _quarter_payload("2025Q4", "legacy-quarter"),
            },
            "filingsUsed": [],
            "errors": [],
        }

        fresh_result = {
            "source": "official-revenue-structures",
            "quarters": {
                "2026Q1": _quarter_payload("2026Q1", "fresh-quarter"),
            },
            "filingsUsed": [],
            "errors": [],
        }

        with tempfile.TemporaryDirectory() as tmp_dir:
            cache_path = Path(tmp_dir) / "alphabet.json"
            cache_path.write_text(json.dumps(cached_payload), encoding="utf-8")

            with (
                patch.object(official_revenue_structures, "_cache_path", return_value=cache_path),
                patch.object(official_revenue_structures, "_resolve_cik", return_value=123456),
                patch.object(official_revenue_structures, "_parse_alphabet_records", return_value=fresh_result),
                patch.object(official_revenue_structures, "_parse_generic_segment_cache_records", return_value={"quarters": {}, "errors": []}),
            ):
                result = official_revenue_structures.fetch_official_revenue_structure_history(_company(), refresh=True)

        self.assertEqual(set(result["quarters"].keys()), {"2026Q1"})
        self.assertNotIn("2025Q4", result["quarters"])

    def test_rebuild_from_stale_cache_does_not_preserve_legacy_quarters(self) -> None:
        stale_cached_payload = {
            "_cacheVersion": "legacy",
            "source": "official-revenue-structures",
            "quarters": {
                "2025Q4": _quarter_payload("2025Q4", "legacy-quarter"),
            },
            "filingsUsed": [],
            "errors": [],
        }

        fresh_result = {
            "source": "official-revenue-structures",
            "quarters": {
                "2026Q1": _quarter_payload("2026Q1", "fresh-quarter"),
            },
            "filingsUsed": [],
            "errors": [],
        }

        with tempfile.TemporaryDirectory() as tmp_dir:
            cache_path = Path(tmp_dir) / "alphabet.json"
            cache_path.write_text(json.dumps(stale_cached_payload), encoding="utf-8")

            with (
                patch.object(official_revenue_structures, "_cache_path", return_value=cache_path),
                patch.object(official_revenue_structures, "_resolve_cik", return_value=123456),
                patch.object(official_revenue_structures, "_parse_alphabet_records", return_value=fresh_result),
                patch.object(official_revenue_structures, "_parse_generic_segment_cache_records", return_value={"quarters": {}, "errors": []}),
            ):
                result = official_revenue_structures.fetch_official_revenue_structure_history(_company(), refresh=False)

        self.assertEqual(set(result["quarters"].keys()), {"2026Q1"})
        self.assertNotIn("2025Q4", result["quarters"])

    def test_fallback_keeps_primary_parse_errors_when_generic_cache_supplies_quarters(self) -> None:
        primary_result = {
            "source": "official-revenue-structures",
            "quarters": {},
            "filingsUsed": [],
            "errors": ["primary parse failed"],
        }
        fallback_result = {
            "source": "generic-segment-cache",
            "quarters": {
                "2026Q1": _quarter_payload("2026Q1", "fallback-quarter"),
            },
            "filingsUsed": [],
            "errors": ["fallback cache used"],
        }

        with tempfile.TemporaryDirectory() as tmp_dir:
            cache_path = Path(tmp_dir) / "alphabet.json"

            with (
                patch.object(official_revenue_structures, "_cache_path", return_value=cache_path),
                patch.object(official_revenue_structures, "_resolve_cik", return_value=123456),
                patch.object(official_revenue_structures, "_parse_alphabet_records", return_value=primary_result),
                patch.object(official_revenue_structures, "_parse_generic_segment_cache_records", return_value=fallback_result),
            ):
                result = official_revenue_structures.fetch_official_revenue_structure_history(_company(), refresh=False)

        self.assertEqual(set(result["quarters"].keys()), {"2026Q1"})
        self.assertIn("primary parse failed", result["errors"])
        self.assertIn("fallback cache used", result["errors"])

    def test_refresh_skips_generic_segment_cache_fallback(self) -> None:
        primary_result = {
            "source": "official-revenue-structures",
            "quarters": {},
            "filingsUsed": [],
            "errors": ["primary parse failed"],
        }
        fallback_result = {
            "source": "official-segment-cache",
            "quarters": {
                "2025Q4": _quarter_payload("2025Q4", "stale-fallback-quarter"),
            },
            "filingsUsed": [],
            "errors": ["fallback cache used"],
        }

        with tempfile.TemporaryDirectory() as tmp_dir:
            cache_path = Path(tmp_dir) / "alphabet.json"

            with (
                patch.object(official_revenue_structures, "_cache_path", return_value=cache_path),
                patch.object(official_revenue_structures, "_resolve_cik", return_value=123456),
                patch.object(official_revenue_structures, "_parse_alphabet_records", return_value=primary_result),
                patch.object(official_revenue_structures, "_parse_generic_segment_cache_records", return_value=fallback_result),
            ):
                result = official_revenue_structures.fetch_official_revenue_structure_history(_company(), refresh=True)

        self.assertEqual(result["quarters"], {})
        self.assertIn("primary parse failed", result["errors"])
        self.assertNotIn("fallback cache used", result["errors"])

    def test_custom_xbrl_hierarchy_extracts_cost_breakdown_rows(self) -> None:
        xml = """<?xml version="1.0" encoding="UTF-8"?>
        <xbrli:xbrl xmlns:xbrli="http://www.xbrl.org/2003/instance"
          xmlns:xbrldi="http://xbrl.org/2006/xbrldi"
          xmlns:us-gaap="http://fasb.org/us-gaap/2025"
          xmlns:tsla="http://www.tesla.com/2025">
          <xbrli:context id="auto-cost">
            <xbrli:entity>
              <xbrli:identifier scheme="http://www.sec.gov/CIK">0001318605</xbrli:identifier>
              <xbrli:segment>
                <xbrldi:explicitMember dimension="srt:ProductOrServiceAxis">tsla:AutomotiveRevenuesMember</xbrldi:explicitMember>
              </xbrli:segment>
            </xbrli:entity>
            <xbrli:period><xbrli:startDate>2025-10-01</xbrli:startDate><xbrli:endDate>2025-12-31</xbrli:endDate></xbrli:period>
          </xbrli:context>
          <xbrli:context id="energy-cost">
            <xbrli:entity>
              <xbrli:identifier scheme="http://www.sec.gov/CIK">0001318605</xbrli:identifier>
              <xbrli:segment>
                <xbrldi:explicitMember dimension="srt:ProductOrServiceAxis">tsla:EnergyGenerationAndStorageMember</xbrldi:explicitMember>
              </xbrli:segment>
            </xbrli:entity>
            <xbrli:period><xbrli:startDate>2025-10-01</xbrli:startDate><xbrli:endDate>2025-12-31</xbrli:endDate></xbrli:period>
          </xbrli:context>
          <us-gaap:CostOfRevenue contextRef="auto-cost" decimals="-6" unitRef="usd">12812000000</us-gaap:CostOfRevenue>
          <us-gaap:CostOfRevenue contextRef="energy-cost" decimals="-6" unitRef="usd">1456000000</us-gaap:CostOfRevenue>
        </xbrli:xbrl>
        """
        rows = [
            {
                "name": "Auto",
                "memberKey": "auto",
                "filters": {"ProductOrServiceAxis": ["AutomotiveRevenuesMember"]},
                "exactDimensions": ["ProductOrServiceAxis"],
            },
            {
                "name": "Energy generation & storage",
                "memberKey": "energygenerationstorage",
                "filters": {"ProductOrServiceAxis": ["EnergyGenerationAndStorageMember"]},
                "exactDimensions": ["ProductOrServiceAxis"],
            },
        ]

        with patch.object(official_revenue_structures, "_request", return_value=xml.encode("utf-8")):
            facts = official_revenue_structures._collect_custom_hierarchy_facts(
                1318605,
                "000000000000000000",
                "2026-01-29",
                "10-K",
                "tsla-20251231_htm.xml",
                rows,
                concept_priority_fn=official_revenue_structures._cost_priority,
            )

        quarter_rows = official_revenue_structures._build_quarterly_series(facts)
        self.assertEqual(
            {row["memberKey"]: row["valueBn"] for row in quarter_rows["2025Q4"]},
            {"auto": 12.812, "energygenerationstorage": 1.456},
        )


if __name__ == "__main__":
    unittest.main()
