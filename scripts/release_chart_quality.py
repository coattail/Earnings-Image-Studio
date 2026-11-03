"""Enrich early releases using disclosed rows; reject loss of chart granularity."""
from copy import deepcopy
import math
import re

FIELDS = ('officialRevenueSegments', 'officialRevenueDetailGroups', 'officialCostBreakdown', 'officialOpexBreakdown')
CONTRACT_VERSION = 3
FINGERPRINT_FIELDS = ('periodEnd', 'statementFilingDate', 'revenueBn', 'operatingIncomeBn', 'netIncomeBn',
                      'costOfRevenueBn','grossProfitBn','operatingExpensesBn','nonOperatingBn','pretaxIncomeBn','taxBn',
                      'sgnaBn','rndBn','otherOpexBn','statementCurrency','displayCurrency','displayScaleFactor',
                      *FIELDS, 'officialRevenueStyle', 'officialRevenueReconciliation', 'clientIncentivesBn', 'revenueYoyPct', 'revenueQoqPct', 'chartQuality')

def chart_fingerprint(payload):
    financials = payload.get('financials') or {}
    quarter = max(financials, default='')
    return (quarter, {field: financials.get(quarter, {}).get(field) for field in FINGERPRINT_FIELDS})

def finite(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)

def key(value):
    return re.sub(r'[^a-z0-9\u4e00-\u9fff]', '', str(value or '').lower()).replace('and', '')

def identity(row):
    return key(row.get('memberKey') or row.get('name'))

def previous_entry(payload, quarter):
    financials = payload.get('financials', {})
    previous = [q for q in financials if q < quarter and financials[q].get('revenueBn')]
    complete = [q for q in previous if financials[q].get('officialRevenueSegments')
                and financials[q].get('chartQuality', {}).get('status') != 'pending']
    previous = complete or previous
    return financials[max(previous)] if previous else {}

def chart_issues(payload, quarter=None):
    financials = payload.get('financials', {})
    if not financials:
        return []
    quarter = quarter or max(financials)
    if quarter not in financials:
        return ['missing requested reporting quarter']
    entry, prior = financials[quarter], previous_entry(payload, quarter)
    issues = []
    for field in (field for field in FINGERPRINT_FIELDS if field.endswith('Bn')):
        if entry.get(field) is not None and not finite(entry[field]):
            issues.append(f'invalid financial value in {field}')
    if entry.get('calendarQuarter') and entry['calendarQuarter'] != quarter:
        issues.append('statement belongs to a different reporting quarter')
    if entry.get('periodEnd') and entry.get('statementFilingDate') and entry['periodEnd'] > entry['statementFilingDate']:
        issues.append('reporting period ends after publication date')
    segments = entry.get('officialRevenueSegments') or []
    statement_available = finite(entry.get('revenueBn')) and finite(entry.get('netIncomeBn'))
    if (statement_available or prior.get('officialRevenueSegments')) and not segments:
        issues.append('missing current-quarter revenue classification')
    for field in FIELDS:
        rows = entry.get(field)
        rows = [] if rows is None else rows
        if not isinstance(rows, list) or any(not isinstance(r, dict) or not finite(r.get('valueBn')) for r in rows):
            issues.append(f'invalid monetary values in {field}')
            continue
        if any(not identity(r) for r in rows):
            issues.append(f'missing category identity in {field}')
        if any(r.get('syntheticInterpolated') or r.get('inferredFromQuarter') for r in rows):
            issues.append(f'previous-quarter estimates in {field}')
        if entry.get('automaticEarnings'):
            period_end = entry.get('periodEnd') or ''
            if any(not r.get('sourceUrl') or (period_end and (r.get('filingDate') or '') < period_end
                   and not (not r.get('filingDate') and r.get('sourceUrl') == entry.get('statementSourceUrl'))) for r in rows):
                issues.append(f'unverified current-quarter source in {field}')
    if any(issue.startswith('invalid monetary') for issue in issues):
        return issues
    def total(rows):
        return sum(r.get('valueBn', 0) for r in rows if isinstance(r, dict) and finite(r.get('valueBn')))
    def balances(rows, value):
        return finite(value) and abs(total(rows)-value) <= max(.005*abs(value), min(.02, abs(value)*.01))
    current_keys = {identity(r) for r in segments}
    if len(current_keys) != len(segments):
        issues.append('duplicate revenue categories')
    if not entry.get('officialRevenueTaxonomyChangedFromPreviousQuarter'):
        missing = {identity(r) for r in prior.get('officialRevenueSegments') or []} - current_keys
        if missing:
            issues.append('missing previously disclosed revenue categories: ' + ','.join(sorted(missing)))
    # Visa discloses gross components and an explicit contra-revenue subtotal.
    adjustment = entry.get('clientIncentivesBn', 0) if entry.get('officialRevenueStyle') == 'visa-revenue-components' else 0
    reconciliation = entry.get('officialRevenueReconciliation') or {}
    if (entry.get('officialRevenueStyle') in {'alibaba-commerce-staged', 'samsung-business-unit-bridge'} or reconciliation.get('kind')=='reported-basis-reconciliation') and reconciliation:
        reconciliation = entry.get('officialRevenueReconciliation') or {}
        value = reconciliation.get('valueBn')
        if not finite(value) or value > 0 or not reconciliation.get('sourceUrl'):
            issues.append('invalid explicit revenue consolidation bridge')
        else:
            adjustment = -value
            if reconciliation.get('kind')=='reported-basis-reconciliation':
                business=reconciliation.get('reportedBusinessTotalBn')
                consolidated=reconciliation.get('reportedConsolidatedRevenueBn')
                if not finite(business) or not finite(consolidated) or abs(consolidated-entry.get('revenueBn',0))>.001 or abs(business+value-consolidated)>.001:
                    issues.append('bank revenue basis reconciliation is inconsistent')
    expected = entry.get('revenueBn')
    if finite(expected) and finite(adjustment): expected += adjustment
    if segments and not balances(segments, expected):
        issues.append('revenue classifications do not reconcile to total revenue')
    targets = {key(r.get('name')): r for r in segments if isinstance(r, dict)}
    targets.update({key(r.get('memberKey')): r for r in segments if isinstance(r, dict) and r.get('memberKey')})
    current_groups = {}
    for row in entry.get('officialRevenueDetailGroups') or []:
        if not isinstance(row, dict): continue
        parent = key(row.get('targetName') or row.get('targetId'))
        if not parent or parent not in targets:
            issues.append('revenue detail has no current-quarter parent')
        else:
            current_groups.setdefault(parent, []).append(row)
    for parent, rows in current_groups.items():
        if not balances(rows, targets[parent].get('valueBn')):
            issues.append(f'revenue detail does not reconcile for {parent}')
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
            if not entry.get('officialRevenueTaxonomyChangedFromPreviousQuarter'):
                issues.append(f'unverified revenue taxonomy change for {parent}')
            continue
        if len(rows) < 2:
            issues.append(f'missing current-quarter revenue detail for {parent}')
        elif target and not balances(rows, target.get('valueBn')):
            issues.append(f'revenue detail does not reconcile for {parent}')
        if not (entry.get('officialRevenueDetailTaxonomyChangedFromPreviousQuarter') or entry.get('officialRevenueTaxonomyChangedFromPreviousQuarter')):
            missing = {identity(r) for r in old_rows} - {identity(r) for r in rows}
            if missing:
                issues.append(f'missing previously disclosed revenue detail for {parent}: ' + ','.join(sorted(missing)))
    return issues

def stamp_chart_quality(payload):
    if payload.get('financials'):
        quarter = max(payload['financials'])
        issues = chart_issues(payload, quarter)
        entry = payload['financials'][quarter]
        prior = previous_entry(payload, quarter)
        required = set()
        targets = {key(r.get('name')) for r in entry.get('officialRevenueSegments') or [] if isinstance(r, dict)}
        targets.update(key(r.get('memberKey')) for r in entry.get('officialRevenueSegments') or [] if isinstance(r, dict))
        for basis in (prior, entry):
            groups = {}
            for row in basis.get('officialRevenueDetailGroups') or []:
                if not isinstance(row, dict): continue
                parent = key(row.get('targetName') or row.get('targetId'))
                if parent: groups[parent] = groups.get(parent, 0) + 1
            for parent, count in groups.items():
                if count >= 2 and (parent in targets or not entry.get('officialRevenueTaxonomyChangedFromPreviousQuarter')):
                    required.add(parent)
        required_segments = {identity(r) for r in entry.get('officialRevenueSegments') or [] if isinstance(r, dict)}
        if not entry.get('officialRevenueTaxonomyChangedFromPreviousQuarter'):
            required_segments.update(identity(r) for r in prior.get('officialRevenueSegments') or [])
        member_bases = [entry] if (entry.get('officialRevenueDetailTaxonomyChangedFromPreviousQuarter') or entry.get('officialRevenueTaxonomyChangedFromPreviousQuarter')) else [prior, entry]
        payload['financials'][quarter]['chartQuality'] = {
            'version': CONTRACT_VERSION, 'quarter': quarter,
            'status': 'pending' if issues else 'ready', 'issues': issues,
            'requiredDetailParents': sorted(required),
            'requiredSegmentKeys': sorted(required_segments),
            'requiredDetailMembers': {
                parent: sorted({identity(r) for basis in member_bases for r in basis.get('officialRevenueDetailGroups') or []
                                if isinstance(r, dict) and key(r.get('targetName') or r.get('targetId')) == parent})
                for parent in required}}
    return payload

def assert_chart_publication(payload):
    def valid_json(value):
        if isinstance(value, float) and not math.isfinite(value):
            raise ValueError(f"{payload.get('id')}: non-finite value cannot be published")
        if isinstance(value, dict):
            for item in value.values(): valid_json(item)
        elif isinstance(value, list):
            for item in value: valid_json(item)
    valid_json(payload)
    financials = payload.get('financials') or {}
    quarter = max(financials, default='')
    entry = financials.get(quarter, {})
    contract = entry.get('chartQuality') or {}
    if finite(entry.get('revenueBn')) and finite(entry.get('netIncomeBn')):
        if contract.get('version') != CONTRACT_VERSION or contract.get('quarter') != quarter:
            raise ValueError(f"{payload.get('id')}: missing current-quarter chart validation contract")
    issues = chart_issues(payload)
    if issues:
        latest = payload['financials'][max(payload['financials'])]
        if latest.get('chartQuality', {}).get('status') != 'pending':
            raise ValueError(f"{payload.get('id')}: incomplete revenue chart must be explicitly marked pending: {'; '.join(issues)}")

def enrich_from_release(payload, html, url):
    """Use previous row identities only, never previous values or percentages."""
    from bs4 import BeautifulSoup
    from generic_filing_table_parser import _extract_quarter_columns, _row_numeric_series, _table_scale, _parse_number
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
                first_amount = next((str(cell) for cell in row[1:] if _parse_number(cell) is not None), '')
                if len(values) != len(columns) or '%' in first_amount: continue
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
            row.update(valueBn=round(abs(amount), 3), sourceUrl=url, filingDate=entry.get('_classificationFilingDate') or entry.get('statementFilingDate'),
                       sourceForm='earnings release', yoyPct=None, qoqPct=None)
            parsed.append(row)
        if templates and len(parsed) == len(templates): entry[field] = parsed
    return payload
