import sys
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import palantir_ir
import check_for_updates

URL = "https://www.sec.gov/Archives/edgar/data/1321655/000132165526000045/a2026q3ex991pressrelease.htm"


class PalantirReleaseTests(unittest.TestCase):
    def setUp(self):
        self.html = (ROOT / "tests/fixtures/palantir-q3-2026-earnings.html").read_text()
        palantir_ir.latest_release.cache_clear()

    def test_reads_quarter_not_ytd_and_preserves_reported_precision(self):
        entry = palantir_ir.parse_release(self.html, URL, "2026-11-02")
        self.assertEqual(entry["revenueBn"], 2.313411)
        self.assertEqual(entry["operatingIncomeBn"], 1.084845)
        self.assertEqual(entry["netIncomeBn"], 1.128012)
        self.assertEqual(entry["operatingCashFlowBn"], 1.20457)
        self.assertEqual(entry["capexBn"], .008014)
        self.assertEqual(entry["netAssetsBn"], 11.3451)
        self.assertEqual(entry["periodEnd"], "2026-09-30")
        self.assertAlmostEqual(entry["pretaxIncomeBn"] - entry["taxBn"] - entry["noncontrollingInterestBn"], entry["netIncomeBn"])

    def test_rejects_non_reconciling_statement(self):
        with self.assertRaisesRegex(ValueError, "does not reconcile"):
            palantir_ir.parse_release(self.html.replace("1,930,125", "1,930,999"), URL, "2026-11-02")

    def test_earnings_8k_is_detected_before_10q_and_uses_statement_end_date(self):
        recent = {"form": ["8-K", "8-K", "10-Q"], "items": ["5.02", "2.02,9.01", ""],
                  "accessionNumber": ["unrelated", "0001321655-26-000045", "old"],
                  "filingDate": ["2026-11-03", "2026-11-02", "2026-08-04"]}
        def request_json(url):
            if "submissions" in url:
                return {"filings": {"recent": recent}}
            self.assertNotIn("unrelated", url)
            return {"directory": {"item": [{"name": "a2026q3ex991pressrelease.htm"}]}}
        with patch.object(palantir_ir, "_request_json", side_effect=request_json), patch.object(palantir_ir, "_request", return_value=self.html.encode()):
            release = palantir_ir.latest_release()
        with patch.object(check_for_updates, "load_local_company_payload", return_value={
            "quarters": ["2026Q2"], "financials": {"2026Q2": {"statementFilingDate": "2026-08-03"}}
        }), patch.object(palantir_ir, "latest_release", return_value=release), patch.object(check_for_updates, "latest_remote_sec_filing") as old_detector:
            result = check_for_updates.detect_company_update({"id": "palantir", "ticker": "PLTR"})
        self.assertTrue(result["needsUpdate"])
        self.assertEqual(result["remoteQuarter"], "2026Q3")
        self.assertEqual(result["remoteReportDate"], "2026-09-30")
        old_detector.assert_not_called()

    def test_current_earnings_does_not_trigger_an_endless_rebuild(self):
        entry = palantir_ir.parse_release(self.html, URL, "2026-11-02")
        release = dict(quarter="2026Q3", reportDate="2026-09-30", filingDate="2026-11-02", accession="new", form="8-K")
        with patch.object(check_for_updates, "load_local_company_payload", return_value={"quarters": ["2026Q3"], "financials": {"2026Q3": entry}}), patch.object(palantir_ir, "latest_release", return_value=release):
            self.assertFalse(check_for_updates.detect_company_update({"id": "palantir", "ticker": "PLTR"})["needsUpdate"])


if __name__ == "__main__":
    unittest.main()
