import sys
import unittest
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = ROOT_DIR / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

import build_dataset  # noqa: E402


class RevenueStructureCostBreakdownMergeTests(unittest.TestCase):
    def test_finalize_stabilizes_berkshire_revenue_taxonomy(self) -> None:
        company = {"id": "berkshire", "ticker": "BRK.B"}
        company_payload = {
            "id": "berkshire",
            "ticker": "BRK.B",
            "quarters": ["2023Q1", "2024Q3", "2024Q4", "2025Q4"],
            "financials": {
                "2023Q1": {
                    "calendarQuarter": "2023Q1",
                    "revenueBn": 59.745,
                    "officialRevenueSegments": [
                        {"name": "Insurance Corporate & Other", "memberKey": "insurancecorporateother", "valueBn": 22.409},
                        {"name": "Berkshire Hathaway Insurance Group", "memberKey": "berkshirehathawayinsurancegroup", "valueBn": 22.188},
                        {"name": "Mc Lane Company", "memberKey": "mclanecompany", "valueBn": 7.793},
                        {"name": "Manufacturing Businesses", "memberKey": "manufacturingbusinesses", "valueBn": 7.229},
                        {"name": "Burlington Northern Santa Fe Corporation", "memberKey": "burlingtonnorthernsantafecorporation", "valueBn": 5.985},
                        {"name": "Berkshire Hathaway Energy Company", "memberKey": "berkshirehathawayenergycompany", "valueBn": 0.811},
                        {"name": "Pilot Travel Centers LLC", "memberKey": "pilottravelcentersllc", "valueBn": 0.422},
                        {
                            "name": "Pilot Travel Centers Limited Liability Company",
                            "memberKey": "pilottravelcenterslimitedliabilitycompany",
                            "valueBn": 0.422,
                        },
                        {"name": "Service & Retailing Businesses", "memberKey": "serviceretailingbusinesses", "valueBn": 0.065},
                    ],
                },
                "2024Q3": {
                    "calendarQuarter": "2024Q3",
                    "revenueBn": 60.238,
                    "officialRevenueSegments": [
                        {"name": "Insurance Corporate & Other", "memberKey": "insurancecorporateother", "valueBn": 27.104},
                        {"name": "Berkshire Hathaway Insurance Group", "memberKey": "berkshirehathawayinsurancegroup", "valueBn": 26.664},
                        {"name": "Mc Lane Company", "memberKey": "mclanecompany", "valueBn": 7.911},
                        {"name": "Manufacturing Businesses", "memberKey": "manufacturingbusinesses", "valueBn": 7.492},
                        {"name": "Burlington Northern Santa Fe Corporation", "memberKey": "burlingtonnorthernsantafecorporation", "valueBn": 5.925},
                        {"name": "Berkshire Hathaway Energy Company", "memberKey": "berkshirehathawayenergycompany", "valueBn": 1.179},
                        {"name": "Pilot Travel Centers LLC", "memberKey": "pilottravelcentersllc", "valueBn": 0.733},
                        {"name": "Service & Retailing Businesses", "memberKey": "serviceretailingbusinesses", "valueBn": 0.046},
                    ],
                },
                "2024Q4": {
                    "calendarQuarter": "2024Q4",
                    "revenueBn": 62.856,
                    "officialRevenueSegments": [
                        {"name": "Pilot Travel Centers LLC", "memberKey": "pilottravelcentersllc", "valueBn": 44.37, "sourceForm": "10-K"},
                        {"name": "Insurance Corporate & Other", "memberKey": "insurancecorporateother", "valueBn": 28.274},
                        {"name": "Mc Lane Company", "memberKey": "mclanecompany", "valueBn": 8.857},
                        {"name": "Manufacturing Businesses", "memberKey": "manufacturingbusinesses", "valueBn": 7.053},
                        {"name": "Burlington Northern Santa Fe Corporation", "memberKey": "burlingtonnorthernsantafecorporation", "valueBn": 6.096},
                        {"name": "Berkshire Hathaway Energy Company", "memberKey": "berkshirehathawayenergycompany", "valueBn": 0.951},
                        {"name": "Service & Retailing Businesses", "memberKey": "serviceretailingbusinesses", "valueBn": 0.054},
                    ],
                },
                "2025Q4": {
                    "calendarQuarter": "2025Q4",
                    "revenueBn": 62.734,
                    "officialRevenueSegments": [
                        {"name": "Insurance Corporate & Other", "memberKey": "insurancecorporateother", "valueBn": 27.507},
                        {"name": "Berkshire Hathaway Insurance Group", "memberKey": "berkshirehathawayinsurancegroup", "valueBn": 11.401},
                        {"name": "Pilot Travel Centers LLC", "memberKey": "pilottravelcentersllc", "valueBn": 10.693},
                        {"name": "Mc Lane Company", "memberKey": "mclanecompany", "valueBn": 7.855},
                        {"name": "Manufacturing Businesses", "memberKey": "manufacturingbusinesses", "valueBn": 7.46},
                        {"name": "Burlington Northern Santa Fe Corporation", "memberKey": "burlingtonnorthernsantafecorporation", "valueBn": 5.937},
                        {"name": "Berkshire Hathaway Energy Company", "memberKey": "berkshirehathawayenergycompany", "valueBn": 0.943},
                        {"name": "Service & Retailing Businesses", "memberKey": "serviceretailingbusinesses", "valueBn": 0.039},
                    ],
                },
            },
            "officialRevenueStructureHistory": {
                "source": "official-segment-cache",
                "quarters": {},
                "filingsUsed": [],
                "errors": [],
            },
            "parserDiagnostics": {
                "version": "universal-parser-v4",
                "financials": {},
                "segments": {},
                "revenueStructures": {},
                "summary": {},
            },
        }

        result = build_dataset.finalize_company_payload(company, company_payload, {})
        q1_keys = [row["memberKey"] for row in result["financials"]["2023Q1"]["officialRevenueSegments"]]
        q4_2024 = {row["memberKey"]: row for row in result["financials"]["2024Q4"]["officialRevenueSegments"]}
        q4_2025_keys = [row["memberKey"] for row in result["financials"]["2025Q4"]["officialRevenueSegments"]]

        self.assertEqual(q1_keys.count("pilottravelcentersllc"), 1)
        self.assertNotIn("pilottravelcenterslimitedliabilitycompany", q1_keys)
        self.assertNotIn("berkshirehathawayinsurancegroup", q1_keys)
        self.assertIn("serviceretailbusinesses", q1_keys)
        self.assertLess(q4_2024["pilottravelcentersllc"]["valueBn"], 15)
        self.assertEqual(q4_2025_keys, [
            "insurancecorporateother",
            "pilottravelcentersllc",
            "mclanecompany",
            "manufacturingbusinesses",
            "burlingtonnorthernsantafecorporation",
            "berkshirehathawayenergycompany",
            "serviceretailbusinesses",
        ])

    def test_finalize_syncs_revenue_structure_history_into_financial_entries(self) -> None:
        company = {"id": "visa", "ticker": "V"}
        company_payload = {
            "id": "visa",
            "ticker": "V",
            "quarters": ["2025Q4"],
            "financials": {
                "2025Q4": {
                    "calendarQuarter": "2025Q4",
                    "revenueBn": 10.901,
                    "operatingIncomeBn": 6.737,
                    "netIncomeBn": 5.853,
                }
            },
            "officialRevenueStructureHistory": {
                "source": "official-segment-cache",
                "quarters": {
                    "2025Q4": {
                        "segments": [
                            {
                                "name": "Data Processing Revenue",
                                "memberKey": "data-processing",
                                "valueBn": 5.544,
                            },
                        ],
                    }
                },
                "filingsUsed": [],
                "errors": [],
            },
            "parserDiagnostics": {
                "version": "universal-parser-v4",
                "financials": {},
                "segments": {},
                "revenueStructures": {},
                "summary": {},
            },
        }

        result = build_dataset.finalize_company_payload(company, company_payload, {})

        self.assertEqual(
            result["financials"]["2025Q4"]["officialRevenueSegments"][0]["name"],
            "Data Processing Revenue",
        )

    def test_finalize_keeps_visa_sankey_expense_bridge_simple(self) -> None:
        company = {"id": "visa", "ticker": "V"}
        company_payload = {
            "id": "visa",
            "ticker": "V",
            "quarters": ["2026Q1"],
            "financials": {
                "2026Q1": {
                    "calendarQuarter": "2026Q1",
                    "revenueBn": 11.23,
                    "costOfRevenueBn": 0.26,
                    "operatingExpensesBn": 3.736,
                    "operatingIncomeBn": 7.234,
                    "netIncomeBn": 6.021,
                    "officialRevenueDetailGroups": [
                        {"name": "Client Incentives", "memberKey": "client-incentives", "valueBn": -4.245},
                    ],
                    "costBreakdown": [
                        {"name": "Network and processing", "memberKey": "network-processing", "valueBn": 0.26},
                    ],
                    "opexBreakdown": [
                        {"name": "Personnel", "memberKey": "personnel", "valueBn": 1.841},
                        {"name": "Marketing", "memberKey": "marketing", "valueBn": 0.545},
                    ],
                }
            },
            "parserDiagnostics": {
                "version": "universal-parser-v4",
                "financials": {},
                "segments": {},
                "revenueStructures": {},
                "summary": {},
            },
        }

        result = build_dataset.finalize_company_payload(company, company_payload, {})
        entry = result["financials"]["2026Q1"]

        self.assertNotIn("officialRevenueDetailGroups", entry)
        self.assertNotIn("costBreakdown", entry)
        self.assertNotIn("opexBreakdown", entry)

    def test_finalize_keeps_visa_bars_on_addable_revenue_category_taxonomy(self) -> None:
        company = {"id": "visa", "ticker": "V"}
        company_payload = {
            "id": "visa",
            "ticker": "V",
            "quarters": ["2025Q4", "2026Q1"],
            "financials": {
                "2025Q4": {
                    "calendarQuarter": "2025Q4",
                    "revenueBn": 10.901,
                    "officialRevenueSegments": [
                        {"name": "Service Revenue", "memberKey": "servicerevenue", "valueBn": 4.76, "sourceForm": "8-K Exhibit 99.1"},
                        {"name": "Data Processing Revenue", "memberKey": "dataprocessingrevenue", "valueBn": 5.544, "sourceForm": "8-K Exhibit 99.1"},
                        {"name": "International Transaction Revenue", "memberKey": "internationaltransactionrevenue", "valueBn": 3.652, "sourceForm": "8-K Exhibit 99.1"},
                        {"name": "Other Revenue", "memberKey": "otherrevenue", "valueBn": 1.214, "sourceForm": "8-K Exhibit 99.1"},
                    ],
                },
                "2026Q1": {
                    "calendarQuarter": "2026Q1",
                    "revenueBn": 11.23,
                    "officialRevenueSegments": [
                        {"name": "Service Revenue", "memberKey": "servicerevenue", "valueBn": 4.981, "sourceForm": "8-K Exhibit 99.1"},
                        {"name": "Data Processing Revenue", "memberKey": "dataprocessingrevenue", "valueBn": 5.543, "sourceForm": "8-K Exhibit 99.1"},
                        {"name": "International Transaction Revenue", "memberKey": "internationaltransactionrevenue", "valueBn": 3.631, "sourceForm": "8-K Exhibit 99.1"},
                        {"name": "Other Revenue", "memberKey": "otherrevenue", "valueBn": 1.32, "sourceForm": "8-K Exhibit 99.1"},
                    ],
                },
            },
            "officialRevenueStructureHistory": {
                "source": "official-segment-cache",
                "quarters": {
                    "2025Q4": {
                        "segments": [
                            {"name": "Data Processing Revenues", "memberKey": "dataprocessingrevenues", "valueBn": 5.544, "sourceForm": "10-Q"},
                            {"name": "International Transaction Revenues", "memberKey": "internationaltransactionrevenues", "valueBn": 3.652, "sourceForm": "10-Q"},
                            {"name": "Value Added Services", "memberKey": "valueaddedservices", "valueBn": 3.2, "sourceForm": "10-Q"},
                        ],
                    },
                    "2026Q1": {
                        "segments": [
                            {"name": "Service Revenue", "memberKey": "servicerevenue", "valueBn": 4.981, "sourceForm": "8-K Exhibit 99.1"},
                            {"name": "Data Processing Revenue", "memberKey": "dataprocessingrevenue", "valueBn": 5.543, "sourceForm": "8-K Exhibit 99.1"},
                            {"name": "International Transaction Revenue", "memberKey": "internationaltransactionrevenue", "valueBn": 3.631, "sourceForm": "8-K Exhibit 99.1"},
                        ],
                    },
                },
                "filingsUsed": [],
                "errors": [],
            },
            "parserDiagnostics": {
                "version": "universal-parser-v4",
                "financials": {},
                "segments": {},
                "revenueStructures": {},
                "summary": {},
            },
        }

        result = build_dataset.finalize_company_payload(company, company_payload, {})

        prior_keys = [row["memberKey"] for row in result["financials"]["2025Q4"]["officialRevenueSegments"]]
        latest_keys = [row["memberKey"] for row in result["financials"]["2026Q1"]["officialRevenueSegments"]]
        prior_history_keys = [
            row["memberKey"]
            for row in result["officialRevenueStructureHistory"]["quarters"]["2025Q4"]["segments"]
        ]

        self.assertEqual(
            prior_keys,
            ["servicerevenues", "dataprocessingrevenues", "internationaltransactionrevenues", "otherrevenues"],
        )
        self.assertEqual(
            latest_keys,
            ["servicerevenues", "dataprocessingrevenues", "internationaltransactionrevenues", "otherrevenues"],
        )
        self.assertEqual(prior_history_keys, prior_keys)
        self.assertNotIn("valueaddedservices", prior_keys)
        self.assertNotIn("valueaddedservices", latest_keys)
        self.assertAlmostEqual(result["financials"]["2026Q1"]["officialRevenueSegments"][3]["valueBn"], 1.32)

    def test_finalize_suppresses_visa_stockanalysis_cost_basis_outlier(self) -> None:
        company = {"id": "visa", "ticker": "V"}
        company_payload = {
            "id": "visa",
            "ticker": "V",
            "quarters": ["2021Q1"],
            "financials": {
                "2021Q1": {
                    "calendarQuarter": "2021Q1",
                    "revenueBn": 5.729,
                    "costOfRevenueBn": 1.293,
                    "grossProfitBn": 4.436,
                    "grossMarginPct": 77.43,
                    "parserFinancialFieldSources": {"costOfRevenueBn": "stockanalysis"},
                    "extractionDiagnostics": {"issues": []},
                }
            },
            "parserDiagnostics": {
                "version": "universal-parser-v4",
                "financials": {},
                "segments": {},
                "revenueStructures": {},
                "summary": {},
            },
        }

        result = build_dataset.finalize_company_payload(company, company_payload, {})
        entry = result["financials"]["2021Q1"]

        self.assertIsNone(entry["costOfRevenueBn"])
        self.assertIsNone(entry["grossProfitBn"])
        self.assertIsNone(entry["grossMarginPct"])
        self.assertIn("visa-cost-of-revenue-basis-suppressed", entry["extractionDiagnostics"]["issues"])

    def test_revenue_structure_history_merges_cost_breakdown_into_entry(self) -> None:
        company = {"id": "tesla", "ticker": "TSLA"}
        company_payload = {
            "id": "tesla",
            "quarters": ["2025Q4"],
            "financials": {
                "2025Q4": {
                    "calendarQuarter": "2025Q4",
                    "revenueBn": 24.901,
                    "costOfRevenueBn": 19.892,
                }
            },
        }
        history = {
            "source": "official-filings-xbrl-hierarchy",
            "quarters": {
                "2025Q4": {
                    "segments": [
                        {"name": "Auto", "memberKey": "auto", "valueBn": 17.693},
                    ],
                    "costBreakdown": [
                        {
                            "name": "Auto",
                            "nameZh": "汽车业务",
                            "memberKey": "auto",
                            "valueBn": 14.08,
                            "sourceUrl": "https://example.com/tsla.xml",
                            "sourceForm": "10-K",
                            "filingDate": "2026-01-29",
                        }
                    ],
                }
            },
            "filingsUsed": [],
            "errors": [],
        }

        result = build_dataset.apply_revenue_structure_history(company_payload, company, history)
        entry = result["financials"]["2025Q4"]

        self.assertEqual(entry["officialCostBreakdown"][0]["name"], "Auto")
        self.assertEqual(entry["officialCostBreakdown"][0]["memberKey"], "auto")
        self.assertEqual(entry["officialCostBreakdown"][0]["valueBn"], 14.08)


if __name__ == "__main__":
    unittest.main()
