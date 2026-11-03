"""Bounded, issuer-independent SEC earnings exhibit discovery.

8-K reportDate is the announcement date, not the earnings quarter. Only a
reported quarterly statement can establish the period of an earnings exhibit.
"""
from __future__ import annotations

import json
import io
import math
import re
from datetime import date, timedelta
from pathlib import Path
from urllib.parse import urljoin
from bs4 import BeautifulSoup
from pypdf import PdfReader
from official_segments import _request, _request_json, _resolve_cik
from official_financials import _extract_html_tables
from generic_filing_table_parser import _period_entries_from_table
from sankey_statement_backfill import parse_inline_statements, complete_statement

CACHE = Path(__file__).resolve().parents[1] / "data/cache/earnings-releases"
VERSION = "earnings-release-v8"
CORE = ("revenueBn", "operatingIncomeBn", "netIncomeBn")


def complete_quarter(entry: dict, company_id: str = "") -> bool:
    # Not every issuer discloses a GAAP operating-income subtotal. Publish
    # reported revenue/earnings first; leave undisclosed intermediate nodes null.
    required = ("revenueBn", "netIncomeBn")
    return (all(isinstance(entry.get(k), (int, float)) and math.isfinite(entry[k]) for k in required)
            and entry["revenueBn"] > 0 and entry.get("statementSpanQuarters", 1) == 1
            and entry.get("statementValueMode") != "cumulative")


def plausible(entry: dict, previous: dict) -> bool:
    if not complete_quarter(entry) or abs(entry["netIncomeBn"]) > entry["revenueBn"] * 20:
        return False
    if previous.get("revenueBn") and previous.get("statementCurrency") == entry.get("statementCurrency"):
        return .02 <= entry["revenueBn"] / previous["revenueBn"] <= 50
    return True


def parse_release(html: str, company: dict, url: str, filed: str, *, allow_partial=False) -> dict:
    """Parse GAAP/IFRS statement tables; adjusted reconciliations are excluded."""
    text = BeautifulSoup(html, "html.parser").get_text(" ", strip=True)
    currency = company.get("reportingCurrency") or "USD"
    # A USD convenience translation must never be mistaken for native numbers.
    if not company.get("reportingCurrency") and re.search(r"RMB|Renminbi", text, re.I):
        currency = "CNY"
    elif not company.get("reportingCurrency") and re.search(r"(?:in |amounts in )(?:EUR|euros)", text, re.I):
        currency = "EUR"
    entries = []
    for table in BeautifulSoup(html, "html.parser").find_all("table"):
        table_text = table.get_text(" ", strip=True)
        quarter_heading = r"(?:three months|quarter|13 weeks|thirteen weeks).{0,30}ended|\b(?:first|second|third|fourth) quarter\b|\bQ[1-4]\b"
        heading = re.split(quarter_heading, table_text, maxsplit=1, flags=re.I)[0][:400]
        if re.search(r"reconciliation|non[-\s]?gaap|adjusted (?:net|operating|income|earnings)", heading, re.I):
            continue
        if re.search(r"\bsegments?\b|business unit", heading, re.I):
            continue
        if not re.search(quarter_heading, table_text, re.I):
            continue
        # Read preceding text nodes, never a parent div containing future tables.
        before = []
        for node in table.previous_elements:
            if isinstance(node, str) and node.strip():
                before.append(str(node).strip())
            if sum(map(len, before)) > 3000:
                break
        prefix = " ".join(reversed(before))
        for rows in _extract_html_tables(str(table)):
            if re.search(r"non[-\s]?ifrs", " ".join(" ".join(row) for row in rows[:6]), re.I):
                continue
            reported = False
            for index, row in enumerate(rows):
                label = " ".join(row).lower()
                if index > 2 and re.match(r"(?:q[1-4] )?(?:non-gaap|adjusted (?:earnings|net|operating))", label):
                    rows = rows[:index]
                    break
                if "reported basis" in label:
                    reported = True
                if reported and "managed basis" in label:
                    rows = rows[:index]
                    break
            if not re.search(r"\b(?:thousands|millions|billions)\b", " ".join(map(str, rows[:6])), re.I):
                # "In millions, except shares which are in thousands" still
                # means that monetary statement rows are in millions.
                monetary_prefix = re.sub(r"except[^)]*(?:\)|$)", ")", prefix, flags=re.I)
                scales = list(re.finditer(r"(?:in\s+|\$\s+|\(\s*)(thousands|millions|billions)|(thousands|millions|billions)\s+of\s+dollars", monetary_prefix, re.I))
                if not scales:
                    continue  # Unknown units must be retried, never guessed.
                rows.insert(0, ["in " + (scales[-1][1] or scales[-1][2])])
            # Never borrow earnings from one table to complete a revenue-only
            # header/segment table. Each candidate must be a complete statement.
            for candidate in _period_entries_from_table(rows, currency, url, filed):
                if complete_quarter(candidate):
                    title = heading + prefix[-500:]
                    candidate["_consolidated"] = (2 if re.search(r"consolidated statements? of (?:income|operations|earnings)|consolidated income statements?", title, re.I)
                                                     else int(bool(re.search(r"consolidated", title, re.I))))
                    entries.append(candidate)
    financials = {}
    for candidate in entries:
        quarter = candidate["calendarQuarter"]
        rank = lambda entry: (entry.get("_consolidated", False), sum(entry.get(k) is not None for k in CORE), entry["revenueBn"])
        if quarter not in financials or rank(candidate) > rank(financials[quarter]):
            financials[quarter] = candidate
    for quarter, entry in parse_inline_statements(html, company.get("id", ""), url).items():
        financials[quarter] = entry
    result = {}
    for quarter, entry in financials.items():
        entry.pop("_consolidated", None)
        complete_statement(entry, company.get("id", ""))
        partial = all(isinstance(entry.get(k), (int, float)) and math.isfinite(entry[k]) for k in ("revenueBn", "netIncomeBn")) and entry.get("statementSpanQuarters", 1) == 1
        if not complete_quarter(entry, company.get("id", "")) and not (allow_partial and partial):
            continue
        if entry.get("grossProfitBn") is not None and entry["grossProfitBn"] > entry["revenueBn"] * 1.01:
            continue
        entry.update(statementSource="official-earnings-release", statementSourceUrl=url,
                     statementFilingDate=filed, statementValueMode="reported", statementSpanQuarters=1)
        entry["parserFinancialFieldSources"] = {k: "official" for k in CORE if isinstance(entry.get(k), (float, int))}
        entry["parserFinancialValidation"] = {"status": "high" if complete_quarter(entry) else "partial", "sourceUrl": url}
        result[quarter] = entry
    return result


def discover_release(company: dict, local: dict | None = None) -> dict | None:
    cik = company.get("cik") or _resolve_cik(company["ticker"], refresh=False)
    if not cik:
        return None
    recent = _request_json(f"https://data.sec.gov/submissions/CIK{int(cik):010d}.json")["filings"]["recent"]
    latest = max((local or {}).get("financials", {}), default="")
    existing = (local or {}).get("financials", {}).get(latest, {})
    cutoff = max(existing.get("statementFilingDate") or "", (date.today() - timedelta(days=120)).isoformat())
    examined = 0
    for i, form in enumerate(recent["form"]):
        filed = recent["filingDate"][i]
        if filed <= cutoff or form not in {"8-K", "6-K"}:
            continue
        if form == "8-K" and "2.02" not in (recent.get("items", [""] * len(recent["form"]))[i] or ""):
            continue
        if examined >= 3:
            break
        examined += 1
        accession = recent["accessionNumber"][i]
        marker = dict(filingDate=filed, accession=accession, form=form)
        # A later 10-Q/10-K for the same period proves the local quarter already
        # covers this release, even when an older provider omitted report dates.
        earliest_regular = (date.fromisoformat(filed) - timedelta(days=7)).isoformat()
        regular = [(recent["filingDate"][j], recent.get("reportDate", [""] * len(recent["form"]))[j])
                   for j, f in enumerate(recent["form"]) if f in {"10-Q", "10-K", "20-F"}
                   and recent["filingDate"][j] >= earliest_regular]
        if regular:
            report_end = max(regular)[1] or ""
            if report_end and f"{report_end[:4]}Q{(int(report_end[5:7])-1)//3+1}" == latest and complete_quarter(existing, company["id"]):
                return None
        if existing.get("automaticEarnings", {}).get("accession") == accession:
            return None
        cache = CACHE / f"{company['id']}.json"
        if cache.exists():
            saved = json.loads(cache.read_text())
            if saved.get("accession") == accession and saved.get("_cacheVersion") == VERSION and plausible(saved.get("entry", {}), existing):
                return saved
        base = f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{accession.replace('-', '')}/"
        index = _request_json(base + "index.json")
        names = [x["name"] for x in index.get("directory", {}).get("item", [])
                 if re.search(r"\.(?:htm|html|pdf)$", x.get("name", ""), re.I)
                 and re.search(r"ex(?:hibit)?[._-]?99|earn|result|press|financial", x["name"], re.I)]
        partials = []
        for name in sorted(names, key=lambda s: ("99" not in s, s))[:4]:
            url = base + name
            content = _request(url)
            if name.lower().endswith(".pdf"):
                from generic_ir_pdf_parser import _entries_from_pdf_pages
                pages = [page.extract_text() for page in PdfReader(io.BytesIO(content)).pages[:30]]
                entries = _entries_from_pdf_pages(pages, url, filed)
                entries = {q: e for q, e in entries.items() if complete_quarter(e, company["id"])}
            else:
                entries = parse_release(content.decode("utf-8", errors="replace"), company, url, filed)
                if not entries:
                    incomplete = parse_release(content.decode("utf-8", errors="replace"), company, url, filed, allow_partial=True)
                    partials.extend(incomplete.values())
            if not entries:
                continue
            quarter = max(entries)
            entry = entries[quarter]
            if entry["periodEnd"] > filed:
                continue
            if not plausible(entry, existing):
                return dict(**marker, quarter=quarter, reportDate=entry["periodEnd"], parseError="Statement units or revenue scale require verification")
            entry["automaticEarnings"] = marker
            payload = dict(**marker, quarter=quarter, reportDate=entry["periodEnd"], entry=entry, _cacheVersion=VERSION)
            CACHE.mkdir(parents=True, exist_ok=True)
            cache.write_text(json.dumps(payload, ensure_ascii=False, indent=2))
            return payload
        if form == "8-K":
            if partials:
                entry = max(partials, key=lambda e: e["calendarQuarter"])
                entry["automaticEarnings"] = marker
                payload = dict(**marker, quarter=entry["calendarQuarter"], reportDate=entry["periodEnd"], entry=entry, _cacheVersion=VERSION)
                CACHE.mkdir(parents=True, exist_ok=True)
                cache.write_text(json.dumps(payload, ensure_ascii=False, indent=2))
                return payload
            return dict(**marker, quarter="", reportDate="", parseError="Earnings 8-K found; no validated quarterly statement parsed")
    return None


def supplement_cached_release(payload: dict) -> dict:
    path = CACHE / f"{payload['id']}.json"
    if not path.exists():
        return payload
    release = json.loads(path.read_text())
    if release.get("_cacheVersion") != VERSION:
        return payload
    entry = release.get("entry")
    if not isinstance(entry, dict) or not complete_quarter(entry, payload["id"]):
        return payload
    financials = payload.setdefault("financials", {})
    quarter = release["quarter"]
    current = financials.get(quarter, {})
    reference = current or financials.get(max(financials, default=""), {})
    if not plausible(entry, reference):
        return payload
    if (current.get("statementFilingDate") or "") > release["filingDate"]:
        return payload
    # Fiscal labels differ from calendar quarters for Nvidia, Microsoft, etc.
    previous_quarters = [q for q in financials if q < quarter]
    if previous_quarters:
        previous_quarter = max(previous_quarters)
        previous = financials[previous_quarter]
        if str(previous.get("fiscalYear", "")).isdigit() and re.fullmatch(r"Q[1-4]", str(previous.get("fiscalQuarter", ""))):
            distance = (int(quarter[:4]) - int(previous_quarter[:4])) * 4 + int(quarter[-1]) - int(previous_quarter[-1])
            fiscal_index = int(previous["fiscalYear"]) * 4 + int(previous["fiscalQuarter"][-1]) - 1 + distance
            entry["fiscalYear"] = str(fiscal_index // 4)
            entry["fiscalQuarter"] = f"Q{fiscal_index % 4 + 1}"
            entry["fiscalLabel"] = f"FY{entry['fiscalYear']} {entry['fiscalQuarter']}"
    financials[quarter] = {**current, **{key: value for key, value in entry.items() if value is not None or key not in current}}
    payload["quarters"] = sorted(financials)
    return payload


def discover_ir_statement(company: dict, item: dict) -> dict | None:
    """Read one newly published IR document instead of rebuilding its archive."""
    url = item.get("sourceUrl") or item.get("pdfUrl")
    filed = item.get("filingDate") or ""
    quarter = item.get("quarter") or ""
    if not url or not filed or not quarter:
        return None
    content = _request(url)
    if not content.startswith(b"%PDF"):
        soup = BeautifulSoup(content, "html.parser")
        links = [urljoin(url, a["href"]) for a in soup.find_all("a", href=True) if re.search(r"\.pdf(?:\?|$)", a["href"], re.I)]
        if not links:
            return None
        url = links[0]
        content = _request(url)
    from generic_ir_pdf_parser import _entries_from_pdf_pages
    pages = [page.extract_text() for page in PdfReader(io.BytesIO(content)).pages[:100]]
    entries = _entries_from_pdf_pages(pages, url, filed)
    if company["id"] == "samsung":
        entry = samsung_statement(pages, quarter)
        if entry:
            entries[quarter] = entry
    entry = entries.get(quarter)
    if not entry or not complete_quarter(entry, company["id"]):
        return None
    entry.update(statementFilingDate=filed, statementSource="official-ir-earnings-release", statementSourceUrl=url,
                 statementSpanQuarters=1, statementValueMode="reported")
    entry["parserFinancialFieldSources"] = {k: "official" for k in CORE if isinstance(entry.get(k), (int, float))}
    entry["parserFinancialValidation"] = {"status": "high", "sourceUrl": url}
    marker = dict(filingDate=filed, accession=url, form="official-ir-release")
    entry["automaticEarnings"] = marker
    payload = dict(**marker, quarter=quarter, reportDate=entry["periodEnd"], entry=entry, _cacheVersion=VERSION)
    CACHE.mkdir(parents=True, exist_ok=True)
    (CACHE / f"{company['id']}.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2))
    return payload


def samsung_statement(pages: list[str], quarter: str) -> dict | None:
    """The official deck alternates native amounts and percent-of-sales columns."""
    import calendar
    for page in pages:
        if "KRW trillion" not in page or "Cost of sales" not in page or "Net profit" not in page:
            continue
        columns = re.findall(r"([1-4])Q\s+(\d{2})\s+% of sales", page)
        quarters = [f"20{year}Q{q}" for q, year in columns]
        if quarter not in quarters:
            continue
        index = quarters.index(quarter)
        amounts = {}
        for label, field in [("Sales", "revenueBn"), ("Cost of sales", "costOfRevenueBn"),
                              ("Gross profit", "grossProfitBn"), ("SG&A expenses", "sgnaBn"),
                              ("R&D expenses", "rndBn"), ("Operating profit", "operatingIncomeBn"), ("Net profit", "netIncomeBn")]:
            match = re.search(r"^" + re.escape(label) + r"[ \t]+(?=\(?-?\d)([^\n]+)", page, re.M)
            if not match:
                continue
            values = re.findall(r"(?<![\w.])(-?\d+(?:\.\d+)?)\s+(?:\d+(?:\.\d+)?%|-)", match[1])
            if len(values) == len(quarters):
                amounts[field] = float(values[index]) * 1000  # trillion KRW -> billion KRW
        if not complete_quarter(amounts):
            continue
        year, month = int(quarter[:4]), int(quarter[-1]) * 3
        return dict(**amounts, calendarQuarter=quarter, periodEnd=f"{year}-{month:02d}-{calendar.monthrange(year, month)[1]}",
                    fiscalYear=str(year), fiscalQuarter=f"Q{quarter[-1]}", fiscalLabel=f"FY{year} Q{quarter[-1]}", statementCurrency="KRW")
    return None
