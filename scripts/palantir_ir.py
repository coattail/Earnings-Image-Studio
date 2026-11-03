"""Read earnings furnished on Item 2.02 8-Ks before the 10-Q is available."""
from __future__ import annotations

import io
import re
from functools import lru_cache
from bs4 import BeautifulSoup
from pypdf import PdfReader
from official_segments import _request, _request_json

CIK = 1321655


def parse_release(html: str, source_url: str, filing_date: str) -> dict:
    from official_financials import _build_financial_entry

    soup = BeautifulSoup(html, "html.parser")
    text = soup.get_text(" ", strip=True)
    match = re.search(r"(?:quarter(?: and (?:fiscal )?year)?|year) ended (\w+ \d{1,2}, \d{4})", text)
    if not match:
        raise ValueError("Palantir earnings release has no reporting period")
    from datetime import datetime
    end = datetime.strptime(match[1], "%B %d, %Y").date()
    quarter = f"{end.year}Q{(end.month - 1) // 3 + 1}"
    rows = [re.sub(r"\s+", " ", row.get_text(" ", strip=True)) for row in soup.find_all("tr")]

    def value(label: str, minimum: int = 4, column: int = 0) -> float:
        for row in rows:
            if not row.lower().replace("’", "'").startswith(label.lower().replace("’", "'")):
                continue
            tail = re.sub(r"^\s*\(\d\)", "", row[len(label):])
            numbers = re.findall(r"\(?-?\d[\d,]*(?:\.\d+)?\)?", tail)
            if len(numbers) >= minimum:
                token = numbers[column].replace(",", "")
                return float(token.strip("()")) * (-1 if token.startswith("(") else 1) * 1000
        raise ValueError(f"Missing Palantir reported row: {label}")

    revenue = value("Revenue")
    cost = value("Cost of revenue")
    gross = value("Gross profit")
    opex = value("Total operating expenses")
    operating = value("Income from operations")
    pretax = value("Income before provision for income taxes")
    tax = value("Provision for income taxes")
    consolidated = value("Net income")
    common = value("Net income attributable to common stockholders")
    if abs(revenue - cost - gross) > 1 or abs(gross - opex - operating) > 1 or abs(pretax - tax - consolidated) > 1:
        raise ValueError("Palantir GAAP statement does not reconcile")
    entry = _build_financial_entry(
        quarter, "USD", end.isoformat(), str(end.year), quarter[-2:],
        revenue_value=revenue, cost_value=cost, gross_value=gross,
        sales_and_marketing_value=value("Sales and marketing"),
        general_and_administrative_value=value("General and administrative"),
        sgna_value=value("Sales and marketing") + value("General and administrative"),
        rnd_value=value("Research and development"), operating_expenses_value=opex,
        operating_income_value=operating, pretax_value=pretax,
        non_operating_value=pretax-operating, tax_value=tax, net_income_value=common,
    )
    entry.update(statementSource="palantir-sec-earnings-release", statementSourceUrl=source_url,
                 statementFilingDate=filing_date, statementValueMode="reported", statementSpanQuarters=1,
                 consolidatedNetIncomeBn=consolidated / 1e9,
                 noncontrollingInterestBn=(consolidated-common) / 1e9,
                 netAssetsBn=value("Total equity", 2) / 1e9,
                 parentEquityBn=value("Total Palantir's stockholders’ equity", 2) / 1e9)
    # Keep the release's thousand-dollar precision; the shared builder rounds
    # generic companyfacts to millions for display.
    exact = dict(revenueBn=revenue, costOfRevenueBn=cost, grossProfitBn=gross,
                 sgnaBn=value("Sales and marketing") + value("General and administrative"),
                 rndBn=value("Research and development"), operatingExpensesBn=opex,
                 operatingIncomeBn=operating, nonOperatingBn=pretax-operating,
                 pretaxIncomeBn=pretax, taxBn=tax, netIncomeBn=common)
    entry.update({key: amount / 1e9 for key, amount in exact.items()})
    for row, label in zip(entry["officialOpexBreakdown"], ["Sales and marketing", "Research and development", "General and administrative"]):
        row["valueBn"] = value(label) / 1e9
    entry["grossMarginPct"] = gross / revenue * 100
    entry["operatingMarginPct"] = operating / revenue * 100
    entry["profitMarginPct"] = common / revenue * 100
    entry["effectiveTaxRatePct"] = tax / pretax * 100
    entry["revenueYoyPct"] = (revenue / value("Revenue", column=1) - 1) * 100
    entry["netIncomeYoyPct"] = (common / value("Net income attributable to common stockholders", column=1) - 1) * 100
    entry["parserFinancialFieldSources"] = {key: "official" for key in exact}
    entry["parserFinancialValidation"] = {"status": "high", "sourceUrl": source_url}
    entry["operatingCashFlowBn"] = value("Net cash provided by operating activities", 2) / 1e9
    # The first matching row above is nine-month cumulative; use the quarterly
    # reconciliation table for cash flow instead.
    for row in rows:
        if row.lower().startswith("net cash provided by operating activities $"):
            entry["operatingCashFlowBn"] = float(re.search(r"\$\s*([\d,]+)", row)[1].replace(",", "")) / 1e6
        if row.lower().startswith("less: purchases of property and equipment"):
            entry["capexBn"] = abs(float(re.search(r"\(?([\d,]+)\)?", row)[1].replace(",", ""))) / 1e6
    if "capexBn" not in entry:
        raise ValueError("Missing quarterly Palantir cash capital expenditures")
    return entry


@lru_cache(maxsize=1)
def latest_release() -> dict:
    recent = _request_json(f"https://data.sec.gov/submissions/CIK{CIK:010d}.json")["filings"]["recent"]
    for i, form in enumerate(recent["form"]):
        if form != "8-K" or "2.02" not in recent.get("items", [""] * len(recent["form"]))[i]:
            continue
        accession = recent["accessionNumber"][i]
        base = f"https://www.sec.gov/Archives/edgar/data/{CIK}/{accession.replace('-', '')}/"
        index = _request_json(base + "index.json")
        for item in index["directory"]["item"]:
            name = item["name"]
            if not re.search(r"ex99.*pressrelease.*\.htm$", name, re.I):
                continue
            entry = parse_release(_request(base + name).decode("utf-8"), base + name, recent["filingDate"][i])
            return {"quarter": entry["calendarQuarter"], "reportDate": entry["periodEnd"],
                    "filingDate": recent["filingDate"][i], "accession": accession, "form": "8-K", "entry": entry}
    raise ValueError("No Palantir Item 2.02 earnings release found")


def add_segments(entry: dict) -> dict:
    quarter = entry["calendarQuarter"]
    year, q = quarter[:4], quarter[-1]
    url = f"https://investors.palantir.com/files/Palantir%20-%20Q{q}%20{year}%20Business%20Update.pdf"
    segments = []
    for page in PdfReader(io.BytesIO(_request(url))).pages:
        text = page.extract_text()
        # Use the worldwide revenue page, not the US-only revenue page.
        if "Commercial Revenue Growth" not in text or "Government Revenue Growth" not in text or "US Commercial" in text:
            continue
        for label, key, zh in [("Government", "governmentoperating", "政府业务"), ("Commercial", "commercial", "商业业务")]:
            section = text.split(label + " Revenue Growth", 1)[1].split("©", 1)[0]
            match = re.search(r"\$([\d,.]+)([BM])\s+Q" + q + r"\s+" + year + r"\s+\+([\d.]+)%", section)
            if not match:
                raise ValueError(f"Missing current worldwide {label} revenue")
            amount = float(match[1].replace(",", "")) / (1000 if match[2] == "M" else 1)
            segments.append(dict(name=label, nameZh=zh, memberKey=key, valueBn=amount, yoyPct=float(match[3]),
                                 sourceUrl=url, sourceForm=f"Q{q} {year} business update", filingDate=entry["statementFilingDate"],
                                 periodEnd=entry["periodEnd"]))
        break
    # Presentation labels are rounded to millions / hundredths of a billion.
    if len(segments) != 2 or abs(sum(row["valueBn"] for row in segments) - entry["revenueBn"]) > .015:
        raise ValueError("Palantir worldwide segment revenue does not reconcile")
    entry["officialRevenueSegments"] = segments
    return entry


def supplement(payload: dict) -> dict:
    release = latest_release()
    entry = add_segments(dict(release["entry"]))
    financials = payload.setdefault("financials", {})
    year, q = int(release["quarter"][:4]), int(release["quarter"][-1])
    previous = financials.get(f"{year if q > 1 else year-1}Q{q-1 if q > 1 else 4}", {})
    prior_year = financials.get(f"{year-1}Q{q}", {})
    for field, reference, metric in [("revenueQoqPct", previous, "revenueBn"), ("revenueYoyPct", prior_year, "revenueBn"), ("netIncomeYoyPct", prior_year, "netIncomeBn")]:
        if entry.get(field) is None and reference.get(metric):
            entry[field] = (entry[metric] / reference[metric] - 1) * 100
    payload.setdefault("financials", {})[release["quarter"]] = entry
    payload["quarters"] = sorted(payload["financials"])
    return payload
