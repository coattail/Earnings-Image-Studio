"""Quarter-specific statement recovery, with explicit source and period checks.

This parser reads reported monetary facts; it never estimates missing amounts
from another quarter or uses dimensional segment totals as consolidated revenue.
"""
from __future__ import annotations

from collections import defaultdict
from copy import deepcopy
from datetime import date
import math
import re
import json
from pathlib import Path
from typing import Any

from bs4 import BeautifulSoup
from official_financials import FINANCIAL_CONCEPTS
from taxonomy_normalizer import STATEMENT_FIELDS


def inline_quarter_records(html: str) -> list[dict[str, Any]]:
    soup = BeautifulSoup(html, "html.parser")
    currencies = {}
    contexts = {}
    for unit in soup.find_all(lambda tag: tag.name and tag.name.split(":")[-1] == "unit"):
        measures = unit.find_all(lambda tag: tag.name and tag.name.split(":")[-1] == "measure")
        if len(measures) == 1:
            currencies[unit.get("id")] = measures[0].get_text(strip=True).split(":")[-1]
    for context in soup.find_all(lambda tag: tag.name and tag.name.split(":")[-1] == "context"):
        dates = {tag.name.split(":")[-1]: tag.get_text(strip=True) for tag in context.find_all(
            lambda tag: tag.name and tag.name.split(":")[-1] in {"startdate", "enddate"}
        )}
        try:
            span = (date.fromisoformat(dates["enddate"]) - date.fromisoformat(dates["startdate"])).days + 1
        except (ValueError, KeyError):
            continue
        if 60 <= span <= 120:
            contexts[context.get("id")] = {
                **dates,
                "dimensioned": bool(context.find(lambda tag: tag.name and "member" in tag.name.lower())),
            }
    records = []
    for node in soup.find_all("ix:nonfraction"):
        context = contexts.get(node.get("contextref"))
        currency = currencies.get(node.get("unitref"))
        if not context or not re.fullmatch(r"[A-Z]{3}", currency or ""):
            continue
        raw = node.get_text(strip=True).replace(",", "").replace("−", "-")
        if raw in {"—", "–", "-"}:
            raw = "0"
        try:
            value = float(raw) * 10 ** int(node.get("scale", "0")) / 1e9
        except (ValueError, OverflowError):
            continue
        if node.get("sign") == "-":
            value = -abs(value)
        if not math.isfinite(value):
            continue
        row = node.find_parent("tr")
        label = row.get_text(" ", strip=True) if row else ""
        records.append({**context, "currency": currency, "name": node.get("name", ""), "value": value, "label": label})
    return records


def parse_inline_statements(html: str, company_id: str, source_url: str) -> dict[str, dict[str, Any]]:
    periods = defaultdict(list)
    for record in inline_quarter_records(html):
        periods[(record["startdate"], record["enddate"], record["currency"])].append(record)
    financials = {}
    for (start, end, currency), records in periods.items():
        def fact(*names):
            for name in names:
                matches = [r for r in records if not r["dimensioned"] and r["name"].split(":")[-1] == name]
                if matches:
                    return matches[0]["value"]
            return None

        def row(prefix):
            # Some issuers dimension statement sections. Match their original
            # statement row explicitly instead of aggregating arbitrary facts.
            for record in records:
                if re.match(prefix, record["label"], re.I):
                    return record["value"]
            return None

        entry = {}
        for field, concepts in FINANCIAL_CONCEPTS.items():
            if field + "Bn" in STATEMENT_FIELDS:
                entry[field + "Bn"] = fact(*concepts)
        entry["rndBn"] = fact("ResearchAndDevelopmentExpense", "ResearchAndDevelopmentExpenseExcludingAcquiredInProcessCost")
        entry["nonOperatingBn"] = fact("NonoperatingIncomeExpense")
        if company_id == "jnj":
            components = [fact("InvestmentIncomeInterest"), fact("InterestExpenseNonoperating"), fact("OtherNonoperatingIncomeExpense")]
            if all(value is not None for value in components):
                entry["nonOperatingBn"] = components[0] - components[1] + components[2]
        if company_id in {"jpmorgan", "bank-of-america"}:
            provision = fact("ProvisionForLoanLeaseAndOtherLosses", "FinancingReceivableExcludingAccruedInterestAndOffBalanceSheetLiabilityCreditLossProvisionReversal")
            if provision is not None and entry.get("pretaxIncomeBn") is not None:
                entry.update(costOfRevenueBn=provision, operatingIncomeBn=entry["pretaxIncomeBn"], nonOperatingBn=0,
                    grossProfitLabel="Revenue after credit loss provision", grossProfitLabelZh="扣除信用损失准备后收入",
                    costLabel="Provision for credit losses", costLabelZh="信用损失准备",
                    operatingExpensesLabel="Noninterest expense", operatingExpensesLabelZh="非利息费用",
                    statementPresentationNote="银行中间收入节点为扣除信用损失准备后的净营收，不等同于一般企业的毛利。")
        if company_id == "berkshire":
            entry["revenueBn"] = row(r"Total revenues\s")
            entry["sgnaBn"] = row(r"Selling, general and administrative expenses\s")
            cost_prefixes = [r"Insurance losses and loss adjustment expenses\s", r"Life, annuity and health insurance benefits\s",
                r"Insurance underwriting expenses\s", r"Cost of sales and services\s", r"Cost of leasing\s",
                r"Railroad transportation expenses\s", r"Utilities and energy cost of sales and other expenses\s", r"Other expenses\s"]
            costs = [row(prefix) for prefix in cost_prefixes]
            total_expenses = row(r"Total costs and expenses\s")
            if all(value is not None for value in costs) and total_expenses is not None and entry["sgnaBn"] is not None:
                entry["costOfRevenueBn"] = sum(costs)
                entry["operatingExpensesBn"] = entry["sgnaBn"]
                entry["operatingIncomeBn"] = entry["revenueBn"] - sum(costs) - entry["sgnaBn"]
        if company_id == "exxon":
            entry["revenueBn"] = row(r"Sales and other operating revenue\s")
            costs = [fact("CrudeOilAndProductPurchases"), fact("ProductionAndManufacturingExpenses"), fact("DepreciationDepletionAndAmortization"), fact("ExplorationExpense"), fact("TaxesOther")]
            if all(value is not None for value in costs):
                entry["costOfRevenueBn"] = sum(costs)
                entry["operatingExpensesBn"] = entry["sgnaBn"]
                entry["operatingIncomeBn"] = entry["revenueBn"] - sum(costs) - entry["sgnaBn"]
        if company_id == "chevron":
            components = [fact("EquityMethodInvestmentIncome"), fact("NonoperatingIncomeLoss"), fact("InterestExpenseDebt"), fact("NetPeriodicDefinedBenefitsExpenseReversalOfExpenseExcludingServiceCostComponent")]
            if all(value is not None for value in components):
                entry["nonOperatingBn"] = components[0] + components[1] - components[2] - components[3]
        complete_statement(entry, company_id)
        if entry.get("revenueBn") is None or entry.get("netIncomeBn") is None:
            continue
        quarter = f"{end[:4]}Q{(int(end[5:7]) - 1) // 3 + 1}"
        entry.update(calendarQuarter=quarter, periodEnd=end, statementCurrency=currency,
            statementSource="official-inline-quarter-statement", statementSourceUrl=source_url,
            statementValueMode="direct", statementSpanQuarters=1, statementPeriodStart=start)
        financials[quarter] = entry
    return financials


def complete_statement(entry: dict[str, Any], company_id: str = "") -> None:
    def derive(field, a, b, operation):
        if entry.get(field) is None and entry.get(a) is not None and entry.get(b) is not None:
            entry[field] = round(operation(entry[a], entry[b]), 9)
            entry.setdefault("derivedStatementFields", []).append(field)
    derive("grossProfitBn", "revenueBn", "costOfRevenueBn", lambda a, b: a-b)
    derive("costOfRevenueBn", "revenueBn", "grossProfitBn", lambda a, b: a-b)
    derive("operatingIncomeBn", "pretaxIncomeBn", "nonOperatingBn", lambda a, b: a-b)
    derive("operatingIncomeBn", "grossProfitBn", "operatingExpensesBn", lambda a, b: a-b)
    # Payment networks report a single operating-expense statement, with no
    # separate COGS. Preserve that disclosure rather than losing the profit chain.
    if company_id in {"visa", "mastercard", "jpmorgan", "bank-of-america"} and (entry.get("operatingIncomeBn") is not None or entry.get("operatingExpensesBn") is not None) and entry.get("costOfRevenueBn") is None:
        entry["costOfRevenueBn"] = 0
        entry["grossProfitBn"] = entry.get("revenueBn")
        entry["grossProfitLabel"] = "Revenue before operating expenses"
        entry["grossProfitLabelZh"] = "营收（扣除营业费用前）"
        entry["costOfRevenuePresentationOnly"] = True
        entry["statementPresentationNote"] = "公司未单独列示营业成本；图中费用前收入节点承接营收，成本数值不作为已披露的零成本展示。"
    derive("operatingIncomeBn", "grossProfitBn", "operatingExpensesBn", lambda a, b: a-b)
    derive("operatingExpensesBn", "grossProfitBn", "operatingIncomeBn", lambda a, b: a-b)
    derive("nonOperatingBn", "pretaxIncomeBn", "operatingIncomeBn", lambda a, b: a-b)
    for field, numerator in [("grossMarginPct", "grossProfitBn"), ("operatingMarginPct", "operatingIncomeBn"), ("profitMarginPct", "netIncomeBn")]:
        if entry.get(field) is None and entry.get(numerator) is not None and entry.get("revenueBn"):
            entry[field] = round(entry[numerator] / entry["revenueBn"] * 100, 6)


def merge_missing_statement(entry: dict[str, Any], source: dict[str, Any], company_id: str) -> list[str]:
    """Merge only the same currency/period; reject mixed revenue bases."""
    if not isinstance(source, dict):
        return []
    structure_only = entry.get("statementSource") == "official-revenue-structure"
    if not structure_only and entry.get("periodEnd") and source.get("periodEnd") and entry["periodEnd"] != source["periodEnd"]:
        return []
    if entry.get("statementCurrency") and source.get("statementCurrency") and entry["statementCurrency"] != source["statementCurrency"]:
        return []
    if source.get("statementSpanQuarters", 1) != 1 or source.get("statementValueMode") == "cumulative":
        return []
    missing_chain = all(entry.get(key) is None for key in ("grossProfitBn", "operatingIncomeBn", "netIncomeBn"))
    revenue_differs = entry.get("revenueBn") is not None and source.get("revenueBn") is not None and abs(entry["revenueBn"]-source["revenueBn"]) > max(.01, abs(source["revenueBn"])*.005)
    missing_bank_stage = company_id in {"jpmorgan", "bank-of-america", "exxon"} and entry.get("grossProfitBn") is None and source.get("operatingIncomeBn") is not None
    if revenue_differs and not (missing_chain or missing_bank_stage):
        return []
    applied = []
    metadata = {"adapterId": "official-statement-backfill", "label": "Official quarterly income statement", "sourceUrl": source.get("statementSourceUrl")}
    source_fields = (*STATEMENT_FIELDS, "grossMarginPct", "operatingMarginPct", "profitMarginPct", "grossProfitLabel", "grossProfitLabelZh", "costLabel", "costLabelZh", "operatingExpensesLabel", "operatingExpensesLabelZh", "costOfRevenuePresentationOnly", "statementPresentationNote", "derivedStatementFields", "officialRevenueSegments")
    for field in source_fields:
        value = source.get(field)
        if value is not None and (entry.get(field) is None or (missing_chain and structure_only) or ((missing_chain or missing_bank_stage) and revenue_differs)):
            entry[field] = deepcopy(value)
            entry.setdefault("fieldSources", {})[field] = {**metadata, **({"adapterId": "official-statement-backfill-derived", "label": "Calculated from the same-quarter official statement"} if field in source.get("derivedStatementFields", []) else {})}
            applied.append(field)
    if applied:
        if source.get("statementSourceUrl"):
            entry["statementSourceUrl"] = source["statementSourceUrl"]
        for field in ("statementValueMode", "statementSpanQuarters", "statementPeriodStart"):
            if source.get(field) is not None:
                entry[field] = deepcopy(source[field])
        if structure_only and source.get("periodEnd"):
            entry["periodEnd"] = source["periodEnd"]
            entry["statementSource"] = source.get("statementSource", "official-quarter-statement-backfill")
        entry.setdefault("qualityFlags", []).append("official-quarter-statement-backfilled")
        complete_statement(entry, company_id)
    return applied


SUPPLEMENT_PATH = Path(__file__).resolve().parents[1] / "data" / "sankey-statement-supplements.json"


def apply_statement_supplements(payload: dict[str, Any], supplements: dict[str, Any] | None = None) -> dict[str, Any]:
    if supplements is None:
        supplements = json.loads(SUPPLEMENT_PATH.read_text()) if SUPPLEMENT_PATH.exists() else {}
    company_id = str(payload.get("id") or "")
    spec = supplements.get("companies", {}).get(company_id, {})
    financials = payload.setdefault("financials", {})
    for old_quarter, replacement in spec.get("supersededQuarters", {}).items():
        previous = financials.get(old_quarter, {})
        # A genuinely new filing for that period must never be removed.
        if previous.get("statementSourceUrl") == replacement.get("sourceUrl"):
            financials.pop(old_quarter, None)
    for quarter, statement in spec.get("quarters", {}).items():
        if not isinstance(statement, dict) or statement.get("statementSpanQuarters", 1) != 1:
            continue
        entry = financials.setdefault(quarter, {"calendarQuarter": quarter})
        source = statement.get("statementSourceUrl")
        if not source or not source.startswith(("https://", "http://")):
            continue
        for field, value in statement.items():
            if value is None:
                continue
            entry[field] = deepcopy(value)
            if field in STATEMENT_FIELDS:
                derived = field in statement.get("derivedStatementFields", [])
                entry.setdefault("fieldSources", {})[field] = {"adapterId": "official-statement-backfill-derived" if derived else "official-statement-backfill", "label": "Calculated from the same-quarter official statement" if derived else "Official quarterly income statement", "sourceUrl": source}
        entry["qualityFlags"] = list(dict.fromkeys([*entry.get("qualityFlags", []), "official-quarter-statement-backfilled"]))
    payload["quarters"] = sorted(financials)
    return payload


def parse_matching_pdf_statement(page_texts: list[str], entry: dict[str, Any], source_url: str) -> dict[str, Any]:
    """Recover a column only when its revenue matches the existing period.

    This avoids choosing an adjacent year, USD translation, segment column or
    cumulative statement. All recovered fields must use that same column.
    """
    revenue = entry.get("revenueBn")
    if not isinstance(revenue, (float, int)) or revenue <= 0:
        return {}
    aliases = {
        "costOfRevenueBn": (r"^costof(?:revenues?|sales|goodssold)$", r"^cops$"),
        "grossProfitBn": (r"^gross(?:profit|loss|profitloss)$",),
        "operatingIncomeBn": (r"^operating(?:profit|loss|profitloss|lossprofit)$", r"^(?:income|loss|profit|incomeloss)fromoperations$"),
        "pretaxIncomeBn": (r"^(?:profit|loss|profitloss|lossprofit)before(?:income)?tax(?:ation)?$", r"^incomebefore(?:income)?tax(?:es)?$"),
        "taxBn": (r"^incometax(?:expense|expenses|credit|credits|expensesbenefit|benefitexpense|creditsexpenses|incomeexpenses)?$", r"^taxation$"),
        "netIncomeBn": (r"^equityholdersofthecompany$", r"^(?:profit|loss|profitloss)attributableto(?:owners|equityholders)(?:ofthecompany)?$", r"^net(?:income|profit|loss|incomeloss)(?:attributableto.*)?$", r"^(?:profit|loss|profitloss|lossprofit)forthe(?:period|quarter|year)$"),
        "rndBn": (r"^researchanddevelopmentexpenses?$",),
        "sgnaBn": (r"^(?:sellinggeneralandadministrative|generalandadministrative)expenses?$",),
    }
    best = {}
    best_score = 0
    for text in page_texts:
        rows = []
        pending_revenue = False
        lines = text.splitlines()
        for line_index, line in enumerate(lines):
            if re.sub(r"[^a-z]", "", line.lower()) in {"revenues", "revenue"} and not re.search(r"\d", line):
                pending_revenue = True
                continue
            parts = re.split(r"\s{2,}", line.strip())
            if pending_revenue and re.search(r"\d", line) and not re.search(r"[A-Za-z]", line):
                parts = ["Revenues", line.strip()]
                pending_revenue = False
            attached_value = re.search(r"\s+(\(?[−-]?\d[\d,]*(?:\.\d+)?\)?)$", parts[0]) if parts else None
            if attached_value:
                parts = [parts[0][:attached_value.start()], attached_value[1], *parts[1:]]
            if len(parts) < 2:
                continue
            label = re.sub(r"[^a-z]", "", parts[0].lower())
            values = []
            for token in re.findall(r"\(?[−-]?\d[\d,]*(?:\.\d+)?\)?|[—–]", " ".join(parts[1:])):
                raw = token.replace(",", "").replace("−", "-")
                value = 0 if raw in {"—", "–"} else float(raw.strip("()"))
                values.append(-abs(value) if raw.startswith("(") else value)
            if values:
                rows.append((label, values, line_index))
        for row_index, (label, values, line_index) in enumerate(rows):
            if label not in {"revenue", "revenues", "totalrevenues", "netsales", "netrevenues"}:
                continue
            header = re.sub(r"\s+", "", "\n".join(lines[max(0, line_index-16):line_index])).lower()
            next_revenue = next((i for i in range(row_index+1, len(rows)) if rows[i][0] in {"revenue", "revenues", "totalrevenues", "netsales", "netrevenues"}), len(rows))
            block_rows = rows[row_index:next_revenue]
            expected = str(entry.get("calendarQuarter") or "")
            first_period = re.search(r"([1-4])q(20\d{2})|(?:[369]m|fy)(20\d{2})", header)
            verified_first_column = bool(first_period and first_period[1] and expected == f"{first_period[2]}Q{first_period[1]}")
            spans = list(re.finditer(r"threemonthsended|sixmonthsended|ninemonthsended|yearended|yearsended", header))
            if not verified_first_column and spans and spans[-1][0] == "threemonthsended":
                period_header = header[spans[-1].start():]
                month = re.search(r"(march31|june30|september30|december31)", period_header)
                year = re.search(r"20\d{2}", period_header)
                if month and year:
                    quarter_number = {"march31": 1, "june30": 2, "september30": 3, "december31": 4}[month[1]]
                    verified_first_column = expected == f"{year[0]}Q{quarter_number}"
            disclosed_scale = .001 if "million" in header else .000001 if "thousand" in header or re.search(r"rmb[‘’'„]?000|000rmb", header) else None
            for index, value in enumerate(values):
                for scale in (1, .001, .000001, .000000001):
                    matches_existing = abs(value*scale-revenue) <= max(.002, revenue*.0001)
                    matches_header = verified_first_column and index == 0 and scale == disclosed_scale
                    if not matches_existing and not matches_header:
                        continue
                    candidate = {"revenueBn": value*scale if matches_header else revenue}
                    for field, patterns in aliases.items():
                        for pattern in patterns:
                            matches = [numbers for name, numbers, _ in block_rows if re.fullmatch(pattern, name) and len(numbers) == len(values)]
                            if matches:
                                parsed = matches[0][index]*scale
                                candidate[field] = abs(parsed) if field in {"costOfRevenueBn", "rndBn", "sgnaBn"} else parsed
                                if field == "taxBn":
                                    credit_label = any(re.fullmatch(pattern, name) and re.search(r"credit|benefit|incomeexpenses", name) for name, _, _ in block_rows)
                                    candidate[field] = -parsed if parsed < 0 or credit_label else parsed
                                break
                    if all(candidate.get(key) is not None for key in ("grossProfitBn", "costOfRevenueBn")) and abs(candidate["grossProfitBn"]+candidate["costOfRevenueBn"]-candidate["revenueBn"]) > max(.005, candidate["revenueBn"]*.002):
                        continue
                    if "tencent.com" in source_url:
                        segment_labels = {
                            "internetvas": ("Internet VAS", "互联网增值服务"),
                            "mobiletelecomvas": ("Mobile & Telecom VAS", "移动及电信增值服务"),
                            "vas": ("Value-added Services", "增值服务"),
                            "onlineadvertising": ("Online Advertising", "网络广告"),
                            "ecommercetransactions": ("e-Commerce Transactions", "电子商务交易"),
                            "others": ("Others", "其他"),
                        }
                        segments = [{"name": segment_labels[name][0], "nameZh": segment_labels[name][1], "memberKey": name, "valueBn": numbers[index]*scale, "sourceUrl": source_url}
                            for name, numbers, _ in block_rows if name in segment_labels and len(numbers) == len(values)]
                        if len(segments) >= 2 and abs(sum(item["valueBn"] for item in segments)-candidate["revenueBn"]) < max(.003, candidate["revenueBn"]*.001):
                            candidate["officialRevenueSegments"] = segments
                    score = sum(candidate.get(field) is not None for field in STATEMENT_FIELDS)
                    if score > best_score:
                        best, best_score = candidate, score
    if best_score >= 4:
        best.update(statementSource="official-revenue-matched-statement-column", statementSourceUrl=source_url,
            statementCurrency=entry.get("statementCurrency"), periodEnd=entry.get("periodEnd"),
            statementValueMode="direct", statementSpanQuarters=1)
        return best
    return {}


def parse_html_release_statements(html: str, source_url: str) -> dict[str, dict[str, Any]]:
    from official_financials import _extract_html_tables
    from official_revenue_structures import _numeric_cells
    months = {name: i for i, name in enumerate(("january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"), 1)}
    financials = {}
    net_priorities = {}
    for rows in _extract_html_tables(html):
        header = " ".join(" ".join(row) for row in rows[:8]).lower()
        if not re.search(r"three months ended|quarter(?:s)? ended", header) or re.search(r"share.based compensation|reconciliation|amortization of intangible", header):
            continue
        dates = []
        for row_index, row in enumerate(rows[:8]):
            found = [re.search(r"([A-Za-z]+)\s*(\d{1,2}),?\s*(20\d{2})?", cell) for cell in row]
            if len(found) < 2 or not all(match and match[1].lower() in months for match in found):
                continue
            years = rows[row_index+1] if row_index+1 < len(rows) else []
            for index, match in enumerate(found):
                year = match[3] or (years[index] if index < len(years) and re.fullmatch(r"20\d{2}", years[index]) else None)
                dates.append(f"{year}-{months[match[1].lower()]:02d}-{int(match[2]):02d}" if year else None)
            break
        if not dates or any(value is None for value in dates):
            continue
        limit = len(dates) // 2 if "six months ended" in header or "nine months ended" in header else len(dates)
        seen = set()
        columns = []
        for index, end in enumerate(dates[:limit]):
            if end in seen:
                continue  # USD convenience translations repeat the RMB date.
            seen.add(end)
            quarter = f"{end[:4]}Q{(int(end[5:7])-1)//3+1}"
            columns.append((index, quarter, end))
        for row in rows:
            if not row:
                continue
            label = re.sub(r"[^a-z]", "", row[0].lower())
            values = _numeric_cells(row)
            if len(values) != len(dates):
                continue
            field = None
            priority = 0
            if label in {"netrevenues", "totalnetrevenues", "totalrevenues", "revenues"}:
                field = "revenueBn"
            elif label in {"costofrevenues", "costofsales"}:
                field = "costOfRevenueBn"
            elif label == "grossprofit":
                field = "grossProfitBn"
            elif label in {"incomefromoperations", "operatingincome", "operatingprofit", "operatingloss", "lossfromoperations"}:
                field = "operatingIncomeBn"
            elif label in {"netincomebeforetax", "incomebeforetax", "incomelossbeforetax", "incomebeforeincometax"}:
                field = "pretaxIncomeBn"
            elif label in {"incometaxexpense", "incometaxexpenses", "incometaxbenefitexpense", "incometaxexpensebenefit", "incometaxexpensesbenefits", "incometaxes"}:
                field = "taxBn"
            elif label in {"researchanddevelopmentexpenses", "technologyandcontent", "technologyandcontentexpenses"}:
                field = "rndBn"
            elif label in {"netincome", "netincomeloss", "netincomeaftertax"}:
                field, priority = "netIncomeBn", 1
            elif label.startswith(("netincomeattributableto", "netincomelossattributableto")) and "shareholders" in label and "noncontrolling" not in label:
                field, priority = "netIncomeBn", 2
            if not field:
                continue
            for index, quarter, end in columns:
                entry = financials.setdefault(quarter, {"calendarQuarter": quarter, "periodEnd": end, "statementCurrency": "CNY", "statementSpanQuarters": 1, "statementValueMode": "direct", "statementSource": "official-quarter-earnings-release", "statementSourceUrl": source_url})
                value = values[index]/1e6  # Issuer tables explicitly use RMB'000.
                if field in {"costOfRevenueBn", "rndBn"}:
                    value = abs(value)
                if field == "taxBn":
                    value = -value  # The issuer presents expenses as deductions.
                if field not in entry or (field == "netIncomeBn" and priority > net_priorities.get(quarter, 0)):
                    entry[field] = value
                    if field == "netIncomeBn":
                        net_priorities[quarter] = priority
    for entry in financials.values():
        complete_statement(entry)
    return {q: entry for q, entry in financials.items() if entry.get("revenueBn") is not None and entry.get("netIncomeBn") is not None}
