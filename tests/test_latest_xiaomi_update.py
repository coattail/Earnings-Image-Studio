import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_xiaomi_q2_2026_official_update_is_complete():
    overrides = json.loads((ROOT / "data" / "manual-company-overrides.json").read_text())
    xiaomi = overrides["xiaomi"]
    quarter = xiaomi["financials"]["2026Q2"]

    assert quarter["statementSourceUrl"].endswith("4a85fc36-8a6d-4c24-b45b-b18d5d162e6c")
    assert quarter["statementFilingDate"] == "2026-08-18"
    assert quarter["revenueBn"] == 108.922
    assert quarter["costOfRevenueBn"] == 87.313
    assert quarter["operatingIncomeBn"] == 10.87
    assert quarter["netIncomeBn"] == 9.463

    assert round(sum(item["valueBn"] for item in quarter["officialRevenueSegments"]), 3) == 108.922
    assert round(sum(item["valueBn"] for item in quarter["officialRevenueDetailGroups"]), 3) == 84.026
    assert round(sum(item["valueBn"] for item in quarter["officialCostBreakdown"]), 3) == 87.312

    history = xiaomi["officialRevenueStructureHistory"]
    assert "2026Q2" in history["quarters"]
    assert history["filingsUsed"][-1]["quarter"] == "2026Q2"

    dataset = json.loads((ROOT / "data" / "earnings-dataset.json").read_text())
    generated_xiaomi = next(company for company in dataset["companies"] if company["id"] == "xiaomi")
    assert generated_xiaomi["financials"]["2026Q2"]["revenueBn"] == 108.922

    index = json.loads((ROOT / "data" / "dataset-index.json").read_text())
    indexed_xiaomi = next(company for company in index["companies"] if company["id"] == "xiaomi")
    assert indexed_xiaomi["latestQuarter"] == "2026Q2"


def test_xiaomi_official_parser_knows_q2_2026_url():
    parser_source = (ROOT / "scripts" / "official_revenue_structures.py").read_text()
    assert '"2026Q2": "https://ir.mi.com/static-files/4a85fc36-8a6d-4c24-b45b-b18d5d162e6c"' in parser_source
