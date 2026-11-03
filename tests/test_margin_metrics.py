import unittest
from scripts.margin_metrics import complete_margin_metrics, missing_margin_comparisons
from scripts.release_chart_quality import stamp_chart_quality


class MarginMetricsTests(unittest.TestCase):
    def test_early_release_is_completed_at_shared_publication_boundary(self):
        financials = {
            "2025Q3": {"fiscalYear": "2025", "fiscalQuarter": "Q4", "revenueBn": 100,
                       "grossProfitBn": 40, "operatingIncomeBn": 20, "netIncomeBn": 0},
            "2026Q3": {"fiscalYear": "2026", "fiscalQuarter": "Q4", "revenueBn": 120,
                       "grossProfitBn": 60, "operatingIncomeBn": 18, "netIncomeBn": -6},
        }
        payload = {"financials": financials}
        stamp_chart_quality(payload)
        entry = financials["2026Q3"]
        self.assertEqual([entry[k] for k in ("grossMarginYoyDeltaPp", "operatingMarginYoyDeltaPp", "profitMarginYoyDeltaPp")], [10, -5, -5])
        self.assertEqual(len(entry["chartQuality"]["requiredMarginComparisons"]), 3)
        self.assertNotIn("grossMarginPct", financials["2025Q3"], "publication preserves historical data")
        self.assertEqual(missing_margin_comparisons(financials, "2026Q3"), [])

    def test_missing_quarters_do_not_shift_yoy_and_zero_is_valid(self):
        financials = {"2024Q3": {"revenueBn": 100, "netIncomeBn": 90},
                      "2025Q1": {}, "2025Q2": {}, "2025Q4": {},
                      "2026Q3": {"revenueBn": 100, "netIncomeBn": 5}}
        complete_margin_metrics(financials)
        self.assertNotIn("profitMarginYoyDeltaPp", financials["2026Q3"])
        financials["2025Q3"] = {"revenueBn": 100, "netIncomeBn": 5}
        complete_margin_metrics(financials)
        self.assertEqual(financials["2026Q3"]["profitMarginYoyDeltaPp"], 0)

    def test_reported_comparison_is_retained_and_incomparable_spans_are_excluded(self):
        financials = {"2025Q3": {"revenueBn": 100, "netIncomeBn": 10, "periodEnd": "2025-09-30", "statementPeriodStart": "2025-01-01"},
                      "2026Q3": {"revenueBn": 100, "netIncomeBn": 20, "periodEnd": "2026-09-30", "statementPeriodStart": "2026-07-01"}}
        complete_margin_metrics(financials)
        self.assertNotIn("profitMarginYoyDeltaPp", financials["2026Q3"])
        financials["2026Q3"]["profitMarginYoyDeltaPp"] = 9.5
        complete_margin_metrics(financials)
        self.assertEqual(financials["2026Q3"]["profitMarginYoyDeltaPp"], 9.5)

    def test_fiscal_quarter_mismatch_is_not_compared(self):
        financials = {"2025Q3": {"fiscalYear": "2025", "fiscalQuarter": "Q3", "profitMarginPct": 10},
                      "2026Q3": {"fiscalYear": "2026", "fiscalQuarter": "Q4", "profitMarginPct": 20}}
        complete_margin_metrics(financials)
        self.assertNotIn("profitMarginYoyDeltaPp", financials["2026Q3"])
