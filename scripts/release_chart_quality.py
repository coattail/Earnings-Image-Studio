"""Enrich early releases using disclosed rows; reject loss of chart granularity."""
from copy import deepcopy
import math
import re

FIELDS = ('officialRevenueSegments', 'officialRevenueDetailGroups', 'officialCostBreakdown', 'officialOpexBreakdown')

def key(value):
    return re.sub(r'[^a-z0-9\u4e00-\u9fff]', '', str(value).lower()).replace('and', '')

def previous_entry(payload, quarter):
    financials = payload.get('financials', {})
    previous = [q for q in financials if q < quarter and financials[q].get('revenueBn')]
    return financials[max(previous)] if previous else {}

def chart_issues(payload):
    financials = payload.get('financials', {})
    if not financials:
        return []
    quarter = max(financials)
    entry, prior = financials[quarter], previous_entry(payload, quarter)
    issues = []
    segments = entry.get('officialRevenueSegments') or []
    if prior.get('officialRevenueSegments') and not segments:
        issues.append('missing current-quarter revenue classification')
    def total(rows):
        return sum(r.get('valueBn', 0) for r in rows if isinstance(r.get('valueBn'), (int, float)))
    def balances(rows, value):
        return isinstance(value, (int, float)) and math.isclose(total(rows), value, rel_tol=.005, abs_tol=.02)
    old_segments = prior.get('officialRevenueSegments') or []
    if old_segments and balances(old_segments, prior.get('revenueBn')) and segments and not balances(segments, entry.get('revenueBn')):
        issues.append('revenue classifications do not reconcile to total revenue')
    groups = {}
    for row in prior.get('officialRevenueDetailGroups') or []:
        parent = row.get('targetName') or row.get('targetId')
        if parent:
            groups.setdefault(key(parent), []).append(row)
    for parent, old_rows in groups.items():
        if len(old_rows) < 2:
            continue
        rows = [r for r in entry.get('officialRevenueDetailGroups') or [] if key(r.get('targetName') or r.get('targetId')) == parent]
        target = next((r for r in segments if parent in {key(r.get('name')), key(r.get('memberKey'))}), None)
        if segments and target is None:
            continue  # A newly disclosed taxonomy can replace an old parent.
        if len(rows) < 2:
            issues.append(f'missing current-quarter revenue detail for {parent}')
        elif target and not balances(rows, target.get('valueBn')):
            issues.append(f'revenue detail does not reconcile for {parent}')
    return issues

def assert_chart_publication(payload):
    issues = chart_issues(payload)
    if issues:
        latest = payload['financials'][max(payload['financials'])]
        if latest.get('chartQuality', {}).get('status') != 'pending':
            raise ValueError(f"{payload.get('id')}: incomplete revenue chart must be explicitly marked pending: {'; '.join(issues)}")

def enrich_from_release(payload, html, url):
    """Use previous row identities only, never previous values or percentages."""
    from bs4 import BeautifulSoup
    from generic_filing_table_parser import _extract_quarter_columns, _row_numeric_series, _table_scale
    from official_financials import _extract_html_tables
    quarter = max(payload['financials'])
    entry = payload['financials'][quarter]
    prior = previous_entry(payload, quarter)
    pools = {field: {} for field in FIELDS}
    soup = BeautifulSoup(html, 'html.parser')
    for table in soup.find_all('table'):
        text = table.get_text(' ', strip=True)
        if re.search(r'reconciliation|non[- ]gaap', text[:150], re.I):
            continue
        for rows in _extract_html_tables(str(table)):
            columns = _extract_quarter_columns(rows)
            indexes = [i for i,c in enumerate(columns) if c['quarter'] == quarter and c.get('statementSpanQuarters', 1) == 1]
            if not indexes:
                continue
            before = []
            for node in table.previous_elements:
                if isinstance(node, str): before.append(str(node))
                if sum(map(len, before)) > 1500: break
            units = ' '.join(' '.join(r) for r in rows[:6]) + ' ' + ' '.join(reversed(before))
            units = re.sub(r'except[^)]*(?:\)|$)', ')', units, flags=re.I)
            match = re.search(r'\b(thousands|millions|billions)\b', units, re.I)
            if not match: continue
            scale = _table_scale([['in ' + match[1]]]) / 1e9
            section = 'revenue'
            for row in rows:
                if not row: continue
                label = row[0]
                if 'cost of sales' in label.lower() or 'cost of revenue' in label.lower(): section = 'cost'
                if 'operating expenses' in label.lower(): section = 'expense'
                if 'net sales by' in label.lower() or 'revenue by' in label.lower(): section = 'revenue'
                values = _row_numeric_series(row, len(columns))
                if len(values) != len(columns) or '%' in ' '.join(row[1:]): continue
                for field in FIELDS:
                    if field == 'officialCostBreakdown' and section != 'cost': continue
                    if field in FIELDS[:2] and section != 'revenue': continue
                    pools[field].setdefault(key(label), values[indexes[0]] * scale)
    for field in FIELDS:
        templates = prior.get(field) or []
        parsed = []
        for template in templates:
            aliases = {key(template.get('name')), key(template.get('memberKey'))}
            if 'wearables' in aliases: aliases.add('wearableshomeaccessories')
            amount = next((v for name,v in pools[field].items() if name in aliases), None)
            if amount is None: continue
            row = {k:deepcopy(v) for k,v in template.items() if k in {'name','nameZh','memberKey','targetName','targetId','valueFormat'}}
            row.update(valueBn=round(abs(amount), 3), sourceUrl=url, filingDate=entry.get('statementFilingDate'),
                       sourceForm='earnings release', yoyPct=None, qoqPct=None)
            parsed.append(row)
        if templates and len(parsed) == len(templates): entry[field] = parsed
    return payload
