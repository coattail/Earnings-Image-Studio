from __future__ import annotations

import re
import urllib.request
from copy import deepcopy
from datetime import date
from html import unescape
from http.client import IncompleteRead
from typing import Any
from urllib.parse import urljoin

from bs4 import BeautifulSoup


MICRON_INVESTOR_BASE_URL = "https://investors.micron.com"
MICRON_QUARTERLY_RESULTS_URL = f"{MICRON_INVESTOR_BASE_URL}/quarterly-results"
MICRON_IR_CACHE_VERSION = "micron-ir-v1"
MICRON_IR_SOURCE = "micron-official-ir-release"
MICRON_BU_LABELS: dict[str, tuple[str, str, str]] = {
    "Cloud Memory Business Unit": ("cmbu", "CMBU", "云内存业务单元"),
    "Core Data Center Business Unit": ("cdbu", "CDBU", "核心数据中心业务单元"),
    "Mobile and Client Business Unit": ("mcbu", "MCBU", "移动与客户端业务单元"),
    "Automotive and Embedded Business Unit": ("aebu", "AEBU", "汽车与嵌入式业务单元"),
}
MONTHS = {
    "January": 1,
    "February": 2,
    "March": 3,
    "April": 4,
    "May": 5,
    "June": 6,
    "July": 7,
    "August": 8,
    "September": 9,
    "October": 10,
    "November": 11,
    "December": 12,
}
FISCAL_QUARTER_WORDS = {
    "first": 1,
    "second": 2,
    "third": 3,
    "fourth": 4,
}


def fetch_text(url: str, timeout: int = 30) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": "Codex/earnings-image-studio micron-ir"})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        try:
            content = response.read()
        except IncompleteRead as exc:
            content = exc.partial
        return content.decode("utf-8", errors="ignore")


def discover_latest_release_url(quarterly_results_html: str) -> str | None:
    soup = BeautifulSoup(quarterly_results_html, "html.parser")
    for anchor in soup.find_all("a", href=True):
        href = str(anchor.get("href") or "")
        if "/news-releases/news-release-details/" not in href:
            continue
        return urljoin(MICRON_INVESTOR_BASE_URL, unescape(href))
    return None


def fetch_latest_release_html() -> tuple[str, str]:
    quarterly_html = fetch_text(MICRON_QUARTERLY_RESULTS_URL)
    release_url = discover_latest_release_url(quarterly_html)
    if not release_url:
        raise RuntimeError("Unable to find Micron latest press release link on quarterly results page.")
    return release_url, fetch_text(release_url)


def _cell_rows(table: Any) -> list[list[str]]:
    rows: list[list[str]] = []
    for row in table.find_all("tr"):
        cells = [cell.get_text(" ", strip=True) for cell in row.find_all(["td", "th"])]
        if any(cell for cell in cells):
            rows.append(cells)
    return rows


def _table_text(table: Any) -> str:
    return " ".join(table.get_text(" ", strip=True).split())


def _find_table(soup: BeautifulSoup, required_text: str) -> Any | None:
    required = required_text.lower()
    for table in soup.find_all("table"):
        if required in _table_text(table).lower():
            return table
    return None


def _numeric_values(cells: list[str]) -> list[float]:
    values: list[float] = []
    for cell in cells:
        token = str(cell or "").strip()
        if not token or token in {"$", "%", ")"}:
            continue
        if token in {"—", "-", "–"}:
            values.append(0.0)
            continue
        negative = token.startswith("(")
        token = token.replace("$", "").replace(",", "").replace("%", "").replace("(", "").replace(")", "").strip()
        if not re.fullmatch(r"-?\d+(?:\.\d+)?", token):
            continue
        value = float(token)
        values.append(-value if negative else value)
    return values


def _first_row_value(rows: list[list[str]], label: str) -> float | None:
    normalized_label = label.lower()
    for row in rows:
        first_cell = str(row[0] if row else "").strip().lower()
        if first_cell != normalized_label:
            continue
        values = _numeric_values(row[1:])
        return values[0] if values else None
    return None


def _money_bn(value_millions: float | None) -> float | None:
    if value_millions is None:
        return None
    return round(float(value_millions) / 1000, 3)


def _extract_fiscal_period(soup: BeautifulSoup) -> tuple[int, int]:
    title = ""
    meta_title = soup.find("meta", attrs={"property": "og:title"})
    if meta_title is not None:
        title = str(meta_title.get("content") or "")
    if not title:
        title_node = soup.find("title")
        title = title_node.get_text(" ", strip=True) if title_node else ""
    match = re.search(r"\b(first|second|third|fourth)\s+quarter\s+of\s+fiscal\s+(20\d{2})\b", title, re.IGNORECASE)
    if not match:
        raise RuntimeError("Unable to parse Micron fiscal quarter from release title.")
    return int(match.group(2)), FISCAL_QUARTER_WORDS[match.group(1).lower()]


def _extract_period_end(soup: BeautifulSoup) -> str:
    table = _find_table(soup, "CONSOLIDATED STATEMENTS OF OPERATIONS")
    if table is None:
        table = _find_table(soup, "Quarterly Financial Results")
    if table is None:
        raise RuntimeError("Unable to find Micron operations table.")
    text = _table_text(table)
    match = re.search(r"\b(" + "|".join(MONTHS) + r")\s+(\d{1,2}),\s+(20\d{2})\b", text)
    if not match:
        raise RuntimeError("Unable to parse Micron period end date.")
    return date(int(match.group(3)), MONTHS[match.group(1)], int(match.group(2))).isoformat()


def _calendar_quarter(period_end: str) -> str:
    parsed = date.fromisoformat(period_end)
    return f"{parsed.year}Q{(parsed.month - 1) // 3 + 1}"


def _financial_entry(soup: BeautifulSoup, source_url: str, filing_date: str) -> dict[str, Any]:
    fiscal_year, fiscal_quarter = _extract_fiscal_period(soup)
    period_end = _extract_period_end(soup)
    summary_table = _find_table(soup, "Quarterly Financial Results")
    operations_table = _find_table(soup, "CONSOLIDATED STATEMENTS OF OPERATIONS")
    cash_table = _find_table(soup, "GAAP net cash provided by operating activities")
    if summary_table is None:
        raise RuntimeError("Unable to find Micron quarterly financial table.")
    summary_rows = _cell_rows(summary_table)
    operations_rows = _cell_rows(operations_table) if operations_table is not None else []
    cash_rows = _cell_rows(cash_table) if cash_table is not None else []

    revenue = _money_bn(_first_row_value(summary_rows, "Revenue"))
    gross_profit = _money_bn(_first_row_value(summary_rows, "Gross margin"))
    operating_expenses = _money_bn(_first_row_value(summary_rows, "Operating expenses"))
    operating_income = _money_bn(_first_row_value(summary_rows, "Operating income"))
    net_income = _money_bn(_first_row_value(summary_rows, "Net income"))
    cost_of_revenue = _money_bn(_first_row_value(operations_rows, "Cost of goods sold"))
    rnd = _money_bn(_first_row_value(operations_rows, "Research and development"))
    sgna = _money_bn(_first_row_value(operations_rows, "Selling, general, and administrative"))
    other_opex = _money_bn(_first_row_value(operations_rows, "Other operating (income) expense, net"))
    tax = _money_bn(_first_row_value(operations_rows, "Income tax (provision) benefit"))
    equity_income = _money_bn(_first_row_value(operations_rows, "Equity in net income (loss) of equity method investees")) or 0
    operating_cash_flow = _money_bn(_first_row_value(cash_rows, "GAAP net cash provided by operating activities"))
    free_cash_flow = _money_bn(_first_row_value(cash_rows, "Adjusted free cash flow"))

    non_operating = None
    pretax = None
    if operating_income is not None and tax is not None and net_income is not None:
        pretax = round(net_income + abs(tax) - equity_income, 3)
        non_operating = round(pretax - operating_income, 3)
    diluted_eps = _first_row_value(summary_rows, "Diluted earnings per share (EPS)")

    entry: dict[str, Any] = {
        "calendarQuarter": _calendar_quarter(period_end),
        "periodEnd": period_end,
        "fiscalYear": str(fiscal_year),
        "fiscalQuarter": f"Q{fiscal_quarter}",
        "fiscalLabel": f"FY{fiscal_year} Q{fiscal_quarter}",
        "statementCurrency": "USD",
        "revenueBn": revenue,
        "costOfRevenueBn": cost_of_revenue,
        "grossProfitBn": gross_profit,
        "sgnaBn": sgna,
        "rndBn": rnd,
        "otherOpexBn": other_opex,
        "operatingExpensesBn": operating_expenses,
        "operatingIncomeBn": operating_income,
        "nonOperatingBn": non_operating,
        "pretaxIncomeBn": pretax,
        "taxBn": tax,
        "netIncomeBn": net_income,
        "dilutedEps": diluted_eps,
        "operatingCashFlowBn": operating_cash_flow,
        "freeCashFlowBn": free_cash_flow,
        "statementSource": MICRON_IR_SOURCE,
        "statementSourceUrl": source_url,
        "statementFilingDate": filing_date,
    }
    if revenue:
        for key, numerator_key in [
            ("grossMarginPct", "grossProfitBn"),
            ("operatingMarginPct", "operatingIncomeBn"),
            ("profitMarginPct", "netIncomeBn"),
        ]:
            numerator = entry.get(numerator_key)
            if numerator is not None:
                entry[key] = round(float(numerator) / float(revenue) * 100, 3)
    if pretax and tax is not None:
        entry["effectiveTaxRatePct"] = round(abs(float(tax)) / float(pretax) * 100, 3)
    return {key: value for key, value in entry.items() if value is not None}


def _business_unit_segments(soup: BeautifulSoup, source_url: str, filing_date: str) -> list[dict[str, Any]]:
    table = _find_table(soup, "Quarterly Business Unit Financial Results")
    if table is None:
        return []
    rows = _cell_rows(table)
    segments: list[dict[str, Any]] = []
    current_unit: tuple[str, str, str] | None = None
    for row in rows:
        label = str(row[0] if row else "").strip()
        if label in MICRON_BU_LABELS:
            current_unit = MICRON_BU_LABELS[label]
            continue
        if label != "Revenue" or current_unit is None:
            continue
        values = _numeric_values(row[1:])
        if not values:
            continue
        member_key, name, name_zh = current_unit
        segments.append(
            {
                "name": name,
                "nameZh": name_zh,
                "memberKey": member_key,
                "valueBn": round(float(values[0]) / 1000, 3),
                "sourceUrl": source_url,
                "sourceForm": "Micron quarterly earnings release",
                "filingDate": filing_date,
            }
        )
    return segments


def _extract_release_date(soup: BeautifulSoup) -> str:
    text = _table_text(soup)
    match = re.search(r"\b(" + "|".join(MONTHS) + r")\s+(\d{1,2}),\s+(20\d{2})\s+at\b", text)
    if not match:
        match = re.search(r"\b(" + "|".join(MONTHS) + r")\s+(\d{1,2}),\s+(20\d{2})\b", text)
    if match:
        return date(int(match.group(3)), MONTHS[match.group(1)], int(match.group(2))).isoformat()
    return date.today().isoformat()


def parse_release_html(release_html: str, source_url: str, filing_date: str | None = None) -> dict[str, Any]:
    soup = BeautifulSoup(release_html, "html.parser")
    effective_filing_date = filing_date or _extract_release_date(soup)
    financial = _financial_entry(soup, source_url, effective_filing_date)
    segments = _business_unit_segments(soup, source_url, effective_filing_date)
    quarter = str(financial.get("calendarQuarter") or "")
    return {
        "source": MICRON_IR_SOURCE,
        "sourceUrl": source_url,
        "filingDate": effective_filing_date,
        "quarter": quarter,
        "financial": financial,
        "segments": segments,
    }


def fetch_latest_release() -> dict[str, Any]:
    source_url, release_html = fetch_latest_release_html()
    return parse_release_html(release_html, source_url)


def build_financial_payload(parsed: dict[str, Any], company: dict[str, Any]) -> dict[str, Any]:
    quarter = str(parsed.get("quarter") or "")
    financial = deepcopy(parsed.get("financial") or {})
    return {
        "id": company.get("id") or "micron",
        "ticker": company.get("ticker") or "MU",
        "nameZh": company.get("nameZh") or "美光科技",
        "nameEn": company.get("nameEn") or "Micron Technology",
        "slug": company.get("slug") or "mu",
        "rank": company.get("rank"),
        "isAdr": bool(company.get("isAdr")),
        "brand": deepcopy(company.get("brand") or {}),
        "statementSource": MICRON_IR_SOURCE,
        "statementSourceUrl": parsed.get("sourceUrl"),
        "reportingCurrency": "USD",
        "quarters": [quarter] if quarter else [],
        "financials": {quarter: financial} if quarter else {},
        "errors": [],
        "_cacheVersion": MICRON_IR_CACHE_VERSION,
    }


def build_revenue_structure_payload(parsed: dict[str, Any]) -> dict[str, Any]:
    quarter = str(parsed.get("quarter") or "")
    source_url = str(parsed.get("sourceUrl") or "")
    filing_date = str(parsed.get("filingDate") or "")
    segments = deepcopy(parsed.get("segments") or [])
    return {
        "source": MICRON_IR_SOURCE,
        "quarters": {
            quarter: {
                "segments": segments,
                "style": "micron-business-unit-bridge",
                "sourceUrl": source_url,
                "sourceForm": "Micron quarterly earnings release",
                "filingDate": filing_date,
            }
        } if quarter and segments else {},
        "filingsUsed": [
            {
                "form": "MicronQuarterlyResultsRelease",
                "filingDate": filing_date,
                "sourceUrl": source_url,
            }
        ] if source_url else [],
        "errors": [],
        "_cacheVersion": MICRON_IR_CACHE_VERSION,
    }
