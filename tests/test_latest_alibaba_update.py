import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = ROOT / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from official_revenue_structures import _parse_alibaba_quarter_rows  # noqa: E402
from stockanalysis_financials import _parse_alibaba_pdf_financial_entry  # noqa: E402


SOURCE_URL = (
    "https://data.alibabagroup.com/ecms-files/1532295521/"
    "fa5d65fc-9b3e-4e82-a8fc-4ce1c3e2c407/"
    "Alibaba%20Group%20Announces%20June%20Quarter%202026%20Results.pdf"
)


def test_alibaba_q2_2026_parser_supports_the_new_segment_taxonomy():
    text = """
    Three months ended June 30, 2025 2026 RMB RMB US$ YoY % Change
    Customer management 89,199 82,547 12,166 (7)%
    Direct sales, logistics and others 31,675 28,353 4,179 (10)%
    China Quick Commerce 36,725 53,295 7,855 45%
    International E-commerce 28,177 27,761 4,091 (1)%
    Global Wholesale 13,036 13,906 2,049 7%
    Total Alibaba E-commerce Group 198,812 205,862 30,340 4%
    AI Cloud and Compute Services 33,418 48,437 7,139 45%
    AI Labs and Applications 2,882 3,338 492 16%
    All others 28,629 28,803 4,245 1%
    """

    segments, details = _parse_alibaba_quarter_rows(text, "2026Q2", "2026-08-20", SOURCE_URL)

    assert [(row["memberKey"], row["valueBn"]) for row in segments] == [
        ("alibabaecommercegroup", 205.862),
        ("aicloudandcomputeservices", 48.437),
        ("ailabsandapplications", 3.338),
        ("allothers", 28.803),
    ]
    assert [(row["memberKey"], row["valueBn"]) for row in details] == [
        ("customermanagement", 82.547),
        ("directsaleslogisticsandothers", 28.353),
        ("chinaquickcommerce", 53.295),
        ("internationalecommerce", 27.761),
        ("globalwholesale", 13.906),
    ]
    assert all(row["sourceUrl"] == SOURCE_URL for row in segments + details)


def test_alibaba_q2_2026_official_statement_overrides_an_empty_structured_record():
    text = """
    Revenue was RMB268,953 million.
    Cost of revenue - Cost of revenue in the quarter ended June 30, 2026 was RMB166,096 million.
    Income from operations was RMB15,161 million.
    Income before income tax and share of results of equity method investees 22,308
    Income tax expenses Income tax expenses in the quarter ended June 30, 2026 were RMB12,798 million.
    Net income was RMB10,444 million.
    """

    entry = _parse_alibaba_pdf_financial_entry(
        text,
        "2026Q2",
        "FY2027 Q1",
        SOURCE_URL,
        "2026-06-30",
        "2026-08-20",
    )

    assert entry is not None
    assert entry["fiscalYear"] == "2027"
    assert entry["fiscalQuarter"] == "Q1"
    assert entry["revenueBn"] == 268.953
    assert entry["costOfRevenueBn"] == 166.096
    assert entry["grossProfitBn"] == 102.857
    assert entry["operatingIncomeBn"] == 15.161
    assert entry["nonOperatingBn"] == 7.147
    assert entry["pretaxIncomeBn"] == 22.308
    assert entry["taxBn"] == 12.798
    assert entry["netIncomeBn"] == 10.444
    assert entry["statementFilingDate"] == "2026-08-20"


def test_alibaba_q2_2026_official_update_is_complete():
    dataset = json.loads((ROOT / "data" / "earnings-dataset.json").read_text())
    alibaba = next(company for company in dataset["companies"] if company["id"] == "alibaba")
    quarter = alibaba["financials"]["2026Q2"]

    assert quarter["statementSourceUrl"] == SOURCE_URL
    assert quarter["statementFilingDate"] == "2026-08-20"
    assert quarter["revenueBn"] == 268.953
    assert quarter["costOfRevenueBn"] == 166.096
    assert quarter["operatingIncomeBn"] == 15.161
    assert quarter["netIncomeBn"] == 10.444

    assert [row["memberKey"] for row in quarter["officialRevenueSegments"]] == [
        "alibabaecommercegroup",
        "aicloudandcomputeservices",
        "ailabsandapplications",
        "allothers",
    ]
    assert round(sum(row["valueBn"] for row in quarter["officialRevenueDetailGroups"]), 3) == 205.862

    index = json.loads((ROOT / "data" / "dataset-index.json").read_text())
    indexed = next(company for company in index["companies"] if company["id"] == "alibaba")
    assert indexed["latestQuarter"] == "2026Q2"
