import sys
import unittest
from argparse import Namespace
from pathlib import Path
from unittest.mock import patch


ROOT_DIR = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = ROOT_DIR / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

import check_for_updates  # noqa: E402


def _stockanalysis_company() -> dict[str, object]:
    return {
        "id": "jd",
        "ticker": "JD",
        "slug": "jd",
        "nameEn": "JD.com",
        "nameZh": "京东集团",
        "financialSource": "stockanalysis",
    }


def _local_payload() -> dict[str, object]:
    return {
        "id": "jd",
        "quarters": ["2025Q4"],
        "financials": {
            "2025Q4": {
                "calendarQuarter": "2025Q4",
                "statementFilingDate": "2026-03-05",
            }
        },
        "officialRevenueStructureHistory": {
            "quarters": {
                "2025Q4": {"segments": [{"memberKey": "netproductrevenues", "valueBn": 272.987}]}
            },
            "filingsUsed": [
                {
                    "quarter": "2025Q4",
                    "filingDate": "2026-03-05",
                    "pdf": "https://example.com/jd-q4.pdf",
                }
            ],
        },
    }


class CheckForUpdatesOfficialIrTests(unittest.TestCase):
    def test_stockanalysis_company_is_stale_when_official_ir_has_newer_quarter(self) -> None:
        with (
            patch.object(check_for_updates, "load_local_company_payload", return_value=_local_payload()),
            patch.object(
                check_for_updates,
                "latest_remote_stockanalysis",
                return_value={
                    "quarter": "2025Q4",
                    "filingDate": "2026-03-31",
                    "accession": "",
                    "form": "stockanalysis",
                },
            ),
            patch.object(
                check_for_updates,
                "latest_remote_official_revenue_structure",
                return_value={
                    "quarter": "2026Q1",
                    "filingDate": "2026-05-12",
                    "sourceUrl": "https://example.com/jd-q1.pdf",
                },
            ),
        ):
            result = check_for_updates.detect_company_update(_stockanalysis_company())

        self.assertTrue(result["needsUpdate"])
        self.assertEqual(result["reason"], "new-official-ir-quarter-detected")
        self.assertEqual(result["localRevenueStructureQuarter"], "2025Q4")
        self.assertEqual(result["remoteOfficialRevenueQuarter"], "2026Q1")
        self.assertEqual(result["buildRefreshMode"], "cache-supplement")

    def test_cache_supplement_refresh_command_omits_force_refresh_flag(self) -> None:
        command = check_for_updates.build_refresh_command(["jd", "netease"], refresh=False)

        self.assertNotIn("--refresh", command)
        self.assertEqual(command[-2:], ["--companies", "jd,netease"])

    def test_main_uses_cache_supplement_command_for_official_ir_updates(self) -> None:
        detected = {
            "companyId": "jd",
            "ticker": "JD",
            "needsUpdate": True,
            "reason": "new-official-ir-quarter-detected",
            "buildRefreshMode": "cache-supplement",
        }
        completed = Namespace(returncode=0)
        captured_commands: list[list[str]] = []

        def fake_run(command: list[str], cwd: str) -> Namespace:
            captured_commands.append(command)
            return completed

        with (
            patch.object(check_for_updates, "TOP30_COMPANIES", [_stockanalysis_company()]),
            patch.object(check_for_updates, "parse_args", return_value=Namespace(companies="jd", dry_run=False, json=True)),
            patch.object(check_for_updates, "detect_company_update", return_value=detected),
            patch.object(check_for_updates.subprocess, "run", side_effect=fake_run),
            patch("builtins.print"),
        ):
            exit_code = check_for_updates.main()

        self.assertEqual(exit_code, 0)
        self.assertEqual(len(captured_commands), 1)
        self.assertNotIn("--refresh", captured_commands[0])
        self.assertEqual(captured_commands[0][-2:], ["--companies", "jd"])


if __name__ == "__main__":
    unittest.main()
