"""Recover complete revenue partitions from the current official disclosure.

Each candidate is confined to one table, one column and one reporting period.
The consolidated revenue anchors the units/column; growth, YTD, domestic and
constant-currency columns cannot be combined to manufacture a reconciliation.
"""
from copy import deepcopy
from io import BytesIO
import re

from release_chart_quality import key, finite, previous_entry, chart_issues, preserve_statement_row_filing_dates

# Names describe disclosure schemas, not quarter-specific amounts.
ALIASES = {
    'cardiometabolichealth': ['total cardiometabolic health'],
    'oncology': ['total oncology'], 'immunology': ['total immunology'],
    'productserviceother': ['other'],
    'fabriccarehomecare': ['fabric & home care'],
    'machinerypowerenergy': ['sales of machinery, power & energy'],
    'financialproducts': ['revenues of financial products'],
    'products': ['net sales – products'], 'services': ['net sales – services'],
    'burlingtonnorthernsantafecorporation': ['BNSF'],
    'berkshirehathawayenergycompany': ['BHE'],
    'manufacturingbusinesses': ['Manufacturing'],
    'serviceretailbusinesses': ['Service and Retailing'],
    'pilottravelcentersllc': ['Pilot'], 'mclanecompany': ['McLane'],
    'insurancecorporateother': ['Insurance, Corporate and other'],
    'linzessconstella': ['Linzess'], 'imbruvica': ['Imbruvica b'],
    'epkinly': ['Epkinly c'], 'wearables': ['Wearables, Home and Accessories'],
    'noninterestincome': ['noninterest revenue','total noninterest income'],
    'globalwealthinvestmentmanagement': ['GWIM'],
    'pacific': ['Asia Pacific'],
    'cloudmusic': ['NetEase Cloud Music'],
}

def numbers(cells):
    """Keep explicit dashes as zero, omit currency tokens and percentages."""
    out = []
    for cell in cells:
        s = str(cell).strip().replace('\u2212', '-').replace(',', '')
        s = re.sub(r'\s+','',s)
        if '%' in s or s in {'$', '€', '£', '¥', 'NP', 'N/A', 'n/m'}:
            continue
        if s in {'—', '–', '-'}:
            out.append(0.0)
            continue
        s = re.sub(r'^[$€£¥]', '', s)
        if re.fullmatch(r'\(?-?\d+(?:\.\d+)?\)?', s):
            out.append(float(s.strip('()')) * (-1 if s.startswith('(') else 1))
    return out

def names(row):
    values = [row.get('name'), row.get('memberKey')]
    for value in list(values):
        values.extend(ALIASES.get(key(value), []))
    labels = {key(v) for v in values if v}
    # Issuers often append "Segment" to otherwise unchanged category names.
    return labels | {v.removesuffix('segment') if v.endswith('segment') else v+'segment' for v in labels}

def label_key(value):
    # Footnote references do not change the identity of a revenue category.
    return key(re.sub(r'\s*(?:\(\d+\)|\d+)\s*$', '', value))

def sourced(template, value, entry, url):
    row = {k:deepcopy(v) for k,v in template.items() if k in
           {'name','nameZh','memberKey','targetName','targetId','valueFormat'}}
    row.update(valueBn=round(value, 6), sourceUrl=url,
               filingDate=entry.get('_classificationFilingDate') or entry.get('statementFilingDate'), sourceForm='official current-period disclosure')
    return row

def matches_total(total, revenue):
    return finite(total) and finite(revenue) and abs(total-revenue) <= max(.00001, .0003*abs(revenue))

def enrich_pdf_partition(payload, content, url, *, pages=None):
    """Parse native monetary columns, including an explicit consolidation bridge."""
    if pages is None:
        from pypdf import PdfReader
        pages = [page.extract_text() for page in PdfReader(BytesIO(content)).pages]
    quarter=max(payload['financials']);entry=payload['financials'][quarter];cid=payload['id']
    if cid == 'xiaomi':
        from official_revenue_structures import XIAOMI_QUARTERLY_PDF_URLS, _parse_xiaomi_quarter_item
        if XIAOMI_QUARTERLY_PDF_URLS.get(quarter) == url:
            parsed = _parse_xiaomi_quarter_item(quarter, url, text='\n'.join(page or '' for page in pages))
            if parsed:
                _, structure, _ = parsed
                if matches_total(sum(row['valueBn'] for row in structure['segments']), entry.get('revenueBn')):
                    for source, target in (
                        ('segments', 'officialRevenueSegments'), ('detailGroups', 'officialRevenueDetailGroups'),
                        ('costBreakdown', 'officialCostBreakdown'), ('opexBreakdown', 'officialOpexBreakdown'),
                    ):
                        if structure.get(source):
                            entry[target] = structure[source]
                    entry['revenueClassificationSource'] = 'official-complete-table'
                    entry['revenueClassificationSourceUrl'] = url
                    return payload
    if cid=='samsung':
        from earnings_release import samsung_statement
        from sankey_statement_backfill import complete_statement
        recovered=samsung_statement(pages,quarter)
        if recovered:
            entry.update(recovered)
            complete_statement(entry,cid)
        for text in pages:
            if 'Results by Business Segment' not in text or 'Difference' not in text: continue
            sales=text.split('Operating ProfitSales')[-1].split('KRW trillion')
            text=next((s for s in sales if re.search(r'^Total\s+',s,re.M)),text)
            total=re.search(r'^Total\s+([^\n]+)',text,re.M)
            if not total: continue
            values=numbers(total[1].split())
            index=next((i for i,v in enumerate(values[:3])if matches_total(v*1000,entry.get('revenueBn'))),None)
            if index is None: continue
            rows=[]
            for name,zh in [('DS','半导体'),('DX','移动、电视及家电'),('SDC','显示面板'),('Harman','哈曼')]:
                match=re.search(r'^'+name+r'\s+([^\n]+)',text,re.M)
                vals=numbers(match[1].split())if match else []
                if len(vals)<=index: break
                rows.append(sourced({'name':name,'nameZh':zh,'memberKey':name.lower()},vals[index]*1000,entry,url))
            if len(rows)==4:
                entry.update(officialRevenueSegments=rows,officialRevenueStyle='samsung-business-unit-bridge',
                    officialRevenueTaxonomyChangedFromPreviousQuarter=True,officialRevenueTaxonomyChangeVerified=True,
                    officialRevenueTaxonomyChangeSourceUrl=url,officialRevenueDetailGroups=[])
                entry['officialRevenueReconciliation']=sourced({'name':'Intersegment eliminations and reconciliation',
                    'nameZh':'分部间交易抵销及调节'},entry['revenueBn']-sum(r['valueBn']for r in rows),entry,url)
                entry['officialRevenueReconciliation']['valueMethod']='reported-unit-sales-less-consolidated-revenue'
                entry['revenueClassificationBasisNote']='Business-unit sales include intersegment sales; the deduction is shown explicitly.'
                entry['revenueClassificationSource']='official-complete-table'
                return payload
    if cid=='alibaba':
        statement=next((p for p in pages if 'UNAUDITED CONSOLIDATED INCOME STATEMENTS'in p),'')
        expenses=[]
        for label,zh in [('Product development expenses','产品研发费用'),('Sales and marketing expenses','销售及营销费用'),
                         ('General and administrative expenses','一般及行政费用'),('Amortization of intangible assets','无形资产摊销'),
                         ('Impairment of goodwill','商誉减值')]:
            match=re.search(re.escape(label)+r'\s+([^\n]+)',statement)
            vals=numbers(match[1].split())if match else []
            if len(vals)>=2:expenses.append(sourced({'name':label,'nameZh':zh,'memberKey':key(label)},abs(vals[1])*.001,entry,url))
        if len(expenses)==5:entry['officialOpexBreakdown']=expenses
        for text in pages:
            if 'breakdown of our revenue by segment'not in text: continue
            text=text.split('(1) During')[0]
            defs=[('Total Alibaba E-commerce Group','Alibaba E-commerce Group','阿里电商集团','alibabaecommercegroup'),
                  ('AI Cloud and Compute Services','AI Cloud and Compute Services','AI 云与计算服务','aicloudandcomputeservices'),
                  ('AI Labs and Applications','AI Labs and Applications','AI 实验室与应用','ailabsandapplications'),
                  ('All others','All others','其他业务','allothers'),('Unallocated','Unallocated','未分配收入','unallocated')]
            def amount(label):
                m=re.search(re.escape(label)+r'\s+((?:\(?[\d,]+\)?\s+){2}\(?[\d,]+\)?)',text)
                vals=numbers(m[1].split())if m else []
                return vals[1]*.001 if len(vals)>=2 else None
            rows=[]
            for label,name,zh,member in defs:
                value=amount(label)
                if value is None: break
                rows.append(sourced({'name':name,'nameZh':zh,'memberKey':member},value,entry,url))
            adjustment=amount('Inter-segment elimination')
            if len(rows)!=5 or adjustment is None or not matches_total(sum(r['valueBn']for r in rows)+adjustment,entry.get('revenueBn')): continue
            from official_revenue_structures import _extract_alibaba_table_metrics
            def add_reported_growth(row, label):
                value, growth = _extract_alibaba_table_metrics(text, label)
                if value == row['valueBn'] and growth is not None:
                    row['yoyPct'] = growth

            unallocated=rows.pop()['valueBn']
            for row, (label, *_) in zip(rows, defs):
                add_reported_growth(row, label)
            entry.update(officialRevenueSegments=rows,officialRevenueStyle='alibaba-commerce-staged',
                officialRevenueTaxonomyChangedFromPreviousQuarter=True,
                officialRevenueReconciliation=sourced({'name':'Unallocated and intersegment reconciliation','nameZh':'未分配收入及分部间抵销净额'},adjustment+unallocated,entry,url))
            entry['officialRevenueReconciliation'].update(reportedEliminationsBn=adjustment,reportedUnallocatedBn=unallocated)
            # The same table discloses all five commerce components.
            children=[]
            for label,name,zh in [('Customer management','Customer management','客户管理'),
                ('Direct sales, logistics and others','Direct sales, logistics and others','自营、物流及其他'),
                ('China Quick Commerce','China Quick Commerce','中国即时零售'),
                ('International E-commerce','International E-commerce','国际电商'),('Global Wholesale','Global Wholesale','全球批发')]:
                # Optional footnote markers are not monetary columns.
                clean=re.sub(r'\(\d\)','',text);old=text;text=clean
                value=amount(label);text=old
                if value is None: break
                row = sourced({'name':name,'nameZh':zh,'memberKey':key(name),'targetName':'Alibaba E-commerce Group'},value,entry,url)
                add_reported_growth(row, label)
                children.append(row)
            if len(children)==5 and matches_total(sum(r['valueBn']for r in children),rows[0]['valueBn']):entry['officialRevenueDetailGroups']=children
            entry['revenueClassificationSource']='official-complete-table'
            entry['revenueClassificationSourceUrl'] = url
            return payload
    # A transposed segment table can disclose its complete partition on one
    # page. Read only the requested quarterly section and its declared units.
    from datetime import date
    from calendar import month_name
    end = date.fromisoformat(entry['periodEnd']) if entry.get('periodEnd') else None
    templates = previous_entry(payload, quarter).get('officialRevenueSegments') or []
    for page in pages if end and templates else []:
        text = re.sub(r'\s+', ' ', page)
        heading = re.search(r'Three Months Ended\s+'+month_name[end.month]+r'\s+'+str(end.day)+r',?\s*'+str(end.year), text, re.I)
        if not heading: continue
        section = re.split(r'Three Months Ended', text[heading.end():], maxsplit=1, flags=re.I)[0]
        unit = re.search(r'\b(thousands|millions|billions)\b', section[:1000], re.I)
        total = re.search(r'Total\s+(?:net\s+)?revenues?\s*:?\s*', section, re.I)
        if not unit or not total: continue
        header = key(section[:total.start()])
        positions = [min((header.find(n) for n in names(t) if n in header), default=-1) for t in templates]
        if -1 in positions or len(set(positions)) != len(positions): continue
        tokens = []
        for token in section[total.end():].split():
            if not re.fullmatch(r'[()$\d,\.\-—–]+', token): break
            tokens.append(token)
        values = numbers(tokens); scale = {'thousands':1e-6,'millions':.001,'billions':1}[unit[1].lower()]
        if len(values) < len(templates)+1 or not matches_total(values[-1]*scale, entry.get('revenueBn')): continue
        ordered = sorted(zip(positions, templates), key=lambda x:x[0])
        result = [sourced(t, values[i]*scale, entry, url) for i,(_,t) in enumerate(ordered)]
        if not matches_total(sum(r['valueBn'] for r in result), entry.get('revenueBn')): continue
        entry.update(officialRevenueSegments=result, revenueClassificationSource='official-complete-table', revenueClassificationSourceUrl=url)
        break
    return payload

def table_candidates(html, entry):
    from bs4 import BeautifulSoup
    from official_financials import _extract_html_tables
    year = str(entry.get('periodEnd') or '')[:4]
    soup=BeautifulSoup(html, 'html.parser')
    document_text = soup.get_text(' ', strip=True)
    fiscal_year, fiscal_quarter = str(entry.get('fiscalYear') or ''), entry.get('fiscalQuarter')
    fiscal_headers = [f'{fiscal_quarter} FY{fiscal_year}', f'{fiscal_quarter} FY{fiscal_year[-2:]}'] if fiscal_year and fiscal_quarter else []
    if year and year not in document_text and not any(h in document_text for h in fiscal_headers): return
    for table in soup.find_all('table'):
        text = table.get_text(' ', strip=True)
        heading = text[:200].lower()
        if re.search(r'non[- ]gaap|reconciliation of.*(?:income|profit)|adjusted earnings', heading):
            continue
        for rows in _extract_html_tables(str(table)):
            fiscal_headers = [cell for row in rows[:6] for cell in row
                              if re.fullmatch(r'Q[1-4] FY\d{2,4}', cell)]
            if fiscal_headers and not any(h in fiscal_headers for h in
                [f'{fiscal_quarter} FY{fiscal_year}', f'{fiscal_quarter} FY{fiscal_year[-2:]}']):
                continue
            yield rows


def fiscal_partition(rows, templates, prior, entry, url):
    """Read any issuer's explicit fiscal columns at their published precision."""
    year = str(entry.get('fiscalYear') or '')
    quarter = entry.get('fiscalQuarter')
    labels = {f'{quarter} FY{year}', f'{quarter} FY{year[-2:]}'}
    header = next((r for r in rows[:6] if any(c in labels for c in r[1:])), None)
    if not header or not templates:
        return None
    unit = re.search(r'\bin (thousands|millions|billions)\b', ' '.join(header), re.I)
    if not unit:
        return None
    scale = {'thousands':1e-6, 'millions':.001, 'billions':1}[unit[1].lower()]
    column = next(i for i, cell in enumerate(header) if i and cell in labels)
    mapped = {label_key(r[0]):r for r in rows if r}
    def read(template):
        source = next((r for name, r in mapped.items() if name in names(template)), None)
        if not source or len(source) <= column:
            return None
        cell = source[column].strip().replace(',', '').lstrip('$€£¥')
        if not re.fullmatch(r'\d+(?:\.\d+)?', cell):
            return None
        value = float(cell) * scale
        precision = scale * 10 ** -(len(cell.split('.')[1]) if '.' in cell else 0)
        row = sourced(template, value, entry, url)
        row['reportedPrecisionBn'] = precision
        for i, heading in enumerate(header):
            if i >= len(source): continue
            field = 'qoqPct' if heading.rstrip('*').upper() == 'Q/Q' else 'yoyPct' if heading.rstrip('*').upper() == 'Y/Y' else None
            growth = re.fullmatch(r'(-?\d+(?:\.\d+)?)%', source[i])
            if field and growth: row[field] = float(growth[1])
        return row
    total = read({'name':'Total','memberKey':'totalrevenues'})
    if not total or not finite(entry.get('revenueBn')) or abs(total['valueBn'] - entry['revenueBn']) > total['reportedPrecisionBn'] / 2 + 1e-8:
        return None
    def partition(definitions, parent):
        values = [read(t) for t in definitions]
        if any(v is None for v in values): return None
        rounding = (sum(v['reportedPrecisionBn'] for v in values) + parent['reportedPrecisionBn']) / 2
        return values if abs(sum(v['valueBn'] for v in values) - parent['valueBn']) <= rounding + 1e-8 else None
    segments = partition(templates, total)
    if not segments: return None
    details = []
    for parent in segments:
        children = [r for r in prior.get('officialRevenueDetailGroups') or []
                    if key(r.get('targetName') or r.get('targetId')) in names(parent)]
        if children:
            parsed = partition(children, parent)
            if not parsed: return None
            details.extend(parsed)
    return segments, details

def extract_partition(rows, templates, entry, url, *, allow_corporate=False, residual=None, allow_reconciliation=False):
    """Evaluate a whole partition. Amounts from separate tables never mix."""
    revenue = entry.get('revenueBn')
    if not finite(revenue) or not templates:
        return None
    mapped = [(label_key(r[0]), numbers(r[1:])) for r in rows if r]
    total_labels = {'revenue','revenues','totalrevenues','netsales','totalcompany',
                    'netsalesrevenue','totalsalesrevenues','netrevenues','consolidatedrevenue',
                    'totalnetrevenue','totalnetrevenues','totalrevenuenetofinterestexpense','total','consolidated'}
    anchors = []
    for label, values in mapped:
        if label not in total_labels:
            continue
        for col,value in enumerate(values):
            for scale in (1e-9, 1e-6, .001, 1, 1000):
                if matches_total(value*scale, revenue): anchors.append((col,scale))
    for col,scale in anchors:
        parsed = []
        for template in templates:
            aliases = names(template)
            values = next((v for label,v in mapped if label in aliases and len(v)>col), None)
            if values is None:
                if residual and key(template.get('memberKey') or template.get('name')) == residual:
                    continue
                break
            value = values[col]*scale
            if value < 0: break
            parsed.append(sourced(template, value, entry, url))
        else:
            if allow_corporate and not matches_total(sum(r['valueBn'] for r in parsed), revenue):
                values = next((v for label,v in mapped if label=='corporate' and len(v)>col), None)
                if values is not None and values[col]>=0:
                    parsed.append(sourced({'name':'Corporate','nameZh':'公司其他收入','memberKey':'corporate'},values[col]*scale,entry,url))
            if residual and len(parsed)==len(templates)-1:
                remaining = revenue-sum(r['valueBn'] for r in parsed)
                if 0 <= remaining <= .15*revenue:
                    row = sourced({'name':'Other revenue (total less disclosed products)',
                        'nameZh':'其他收入（总额减已披露产品）','memberKey':residual},remaining,entry,url)
                    row.update(valueMethod='current-period-reported-total-less-disclosed-components',
                               derivation={'totalRevenueBn':revenue,'disclosedComponentsBn':sum(r['valueBn'] for r in parsed)})
                    parsed.append(row)
            if matches_total(sum(r['valueBn'] for r in parsed),revenue): return parsed
            if allow_reconciliation:
                components=[]
                for label,zh in [('corporate','公司总部'),('eliminations','内部交易抵销')]:
                    values=next((v for name,v in mapped if name==label and len(v)>col),None)
                    if values is not None:components.append(sourced({'name':label.title(),'nameZh':zh},values[col]*scale,entry,url))
                business=sum(r['valueBn']for r in parsed);adjustment=sum(r['valueBn']for r in components)
                if len(components)==2 and adjustment<=0 and matches_total(business+adjustment,revenue):
                    bridge=sourced({'name':'Corporate and intersegment reconciliation','nameZh':'总部及内部交易抵销净额'},adjustment,entry,url)
                    bridge.update(kind='reported-basis-reconciliation',reportedBusinessTotalBn=business,reportedConsolidatedRevenueBn=revenue,components=components)
                    entry['officialRevenueReconciliation']=bridge
                    return parsed
    return None

def transposed_partition(rows, templates, entry, url):
    headers = next((r for r in rows if all(any(key(cell) in names(t) for cell in r) for t in templates)), None)
    if not headers: return None
    # Final total rows may have a currency symbol instead of a label. Require
    # the explicit consolidated total and the quarterly section heading.
    quarterly = False
    for row in rows:
        text=' '.join(row)
        if re.search(r'(?:three|six|nine|twelve) months ended',text,re.I):
            quarterly=bool(re.search(r'three months ended',text,re.I)) and str(entry.get('periodEnd',''))[:4] in text
        if not quarterly: continue
        values=numbers(row[1:] if row[0]!='$' else row)
        for scale in (1e-6,.001,1,1000):
            if len(values)!=len(headers) or not matches_total(values[-1]*scale,entry.get('revenueBn')): continue
            result=[sourced(t,values[next(i for i,h in enumerate(headers) if key(h) in names(t))]*scale,entry,url)for t in templates]
            if matches_total(sum(r['valueBn']for r in result),entry['revenueBn']): return result
    return None

def enrich_complete_partition(payload, html, url):
    quarter=max(payload['financials']);entry=payload['financials'][quarter]
    prior=previous_entry(payload,quarter)
    templates=prior.get('officialRevenueSegments') or entry.get('officialRevenueSegments') or []
    cid=payload.get('id')
    if cid=='netflix':
        templates=[{'name':n,'memberKey':n.lower(),'nameZh':z}for n,z in
                   [('UCAN','美国和加拿大'),('EMEA','欧洲、中东及非洲'),('LATAM','拉丁美洲'),('APAC','亚太地区')]]
    elif cid=='home-depot':
        templates=[{'name':n,'nameZh':z,'memberKey':n.lower()}for n,z in [('Products','产品'),('Services','服务')]]
    tables=list(table_candidates(html,entry))
    for rows in tables:
        recovered = fiscal_partition(rows, prior.get('officialRevenueSegments') or templates, prior, entry, url)
        if recovered:
            segments, details = recovered
            entry.update(officialRevenueSegments=segments, officialRevenueDetailGroups=details,
                         officialRevenueStyle=prior.get('officialRevenueStyle') or entry.get('officialRevenueStyle'),
                         revenueClassificationSource='official-complete-table', revenueClassificationSourceUrl=url,
                         revenueClassificationBasisNote='Classification amounts retain their disclosed precision; consolidated statements retain exact amounts.')
            return payload
    if cid == 'chevron':
        from datetime import date
        from calendar import month_name
        end = date.fromisoformat(entry['periodEnd']) if entry.get('periodEnd') else None
        heading = (rf'Three months ended {month_name[end.month]} {end.day},? {end.year}' if end else r'(?!)')
        for rows in tables:
            # Chevron's current segment note has two geographical columns per
            # operating segment, followed by segment, corporate and group totals.
            if len(rows) < 2 or rows[0] != ['Upstream', 'Downstream', 'Segment Total', 'All Other', 'Total']:
                continue
            if not re.fullmatch(heading, rows[1][0], re.I):
                continue
            if rows[1][1:] not in (['U.S.', 'Int’l.', 'U.S.', 'Int’l.'], ['U.S.', "Int'l.", 'U.S.', "Int'l."]):
                continue
            text = ' '.join(' '.join(r) for r in rows)
            if not re.search(r'in millions of dollars', text, re.I):
                continue
            for row in rows:
                if label_key(row[0]) not in {'totalrevenuesotherincome', 'salesotheroperatingrevenues'}:
                    continue
                values = numbers(row[1:])
                if len(values) != 7 or not matches_total(values[-1] * .001, entry.get('revenueBn')):
                    continue
                if not matches_total(sum(values[:4]), values[4]) or not matches_total(values[4] + values[5], values[6]):
                    continue
                amounts = {'upstream': sum(values[:2]), 'downstream': sum(values[2:4]), 'allothersegments': values[5]}
                if {key(t.get('memberKey') or t.get('name')) for t in templates} != set(amounts):
                    continue
                partition = [sourced(t, amounts[key(t.get('memberKey') or t.get('name'))] * .001, entry, url) for t in templates]
                if any(r['valueBn'] < 0 for r in partition):
                    continue
                entry.update(officialRevenueSegments=partition, revenueClassificationSource='official-complete-table',
                             revenueClassificationSourceUrl=url)
                return payload
    if cid in {'jpmorgan','bank-of-america'}:
        for rows in tables:
            partition=[];reported_total=None
            if cid=='jpmorgan':
                start=next((i for i,r in enumerate(rows)if r and 'LINE OF BUSINESS'in r[0]),None)
                if start is None:continue
                business=rows[start:]
                for template in templates:
                    vals=next((numbers(r[1:])for r in business if r and label_key(r[0])in names(template)),[])
                    if not vals:break
                    partition.append(sourced(template,vals[0]*.001,entry,url))
                vals=next((numbers(r[1:])for r in business if r and label_key(r[0])=='totalnetrevenue'),[])
                if vals:reported_total=vals[0]*.001
            else:
                header=next((r for r in rows if 'Total Corporation'in r and 'Consumer Banking'in r),None)
                values=next((numbers(r[1:])for r in rows if r and label_key(r[0])=='totalrevenuenetofinterestexpense'),[])
                if not header or len(values)!=len(header):continue
                for template in templates:
                    index=next((i for i,h in enumerate(header)if key(h)in names(template)),None)
                    if index is None:break
                    partition.append(sourced(template,values[index]*.001,entry,url))
                reported_total=values[0]*.001
            total=sum(r['valueBn']for r in partition)
            if len(partition)!=len(templates)or not reported_total or abs(reported_total-entry['revenueBn'])>entry['revenueBn']*.04:continue
            adjustment=entry['revenueBn']-total
            if adjustment>0 or abs(adjustment)>entry['revenueBn']*.08:continue
            entry['officialRevenueSegments']=partition
            entry['officialRevenueStyle']=prior.get('officialRevenueStyle')
            entry['officialRevenueReconciliation']=sourced({'name':'Corporate and tax-equivalent reconciliation',
                'nameZh':'总部及税额等值调整净额'},adjustment,entry,url)
            entry['officialRevenueReconciliation'].update(kind='reported-basis-reconciliation',
                reportedBusinessTotalBn=total,reportedManagedTotalBn=reported_total,reportedConsolidatedRevenueBn=entry['revenueBn'])
            return payload
    if cid=='walmart':
        for rows in tables:
            active=None; parts={}; children=[]
            definitions=[('Walmart U.S.','沃尔玛美国','walmartus'),('Walmart International','沃尔玛国际','walmartinternational'),
                         ('Sam’s Club U.S.','山姆会员店美国','samsclubus'),('Corporate and support','公司及支持部门','corporate')]
            for row in rows:
                label=label_key(row[0]); definition=next((d for d in definitions if label_key(d[0])==label),None)
                if definition: active=definition; continue
                if label=='consolidated': active=None
                if not active: continue
                if label not in {'netsales','membershipotherincome'}: continue
                values=numbers(row[1:])
                if not values: continue
                name,zh,member=active;value=values[0]*.001
                parts.setdefault(member,sourced({'name':name,'nameZh':zh,'memberKey':member},0,entry,url))['valueBn']+=value
                children.append(sourced({'name':'Net sales'if label=='netsales'else'Membership and other income',
                    'nameZh':'商品净销售额'if label=='netsales'else'会员及其他收入','memberKey':member+label,'targetName':name},value,entry,url))
            if len(parts)==4 and matches_total(sum(r['valueBn']for r in parts.values()),entry.get('revenueBn')):
                entry.update(officialRevenueSegments=list(parts.values()),officialRevenueComponents=children,
                    officialRevenueTaxonomyChangedFromPreviousQuarter=True,officialRevenueStyle=prior.get('officialRevenueStyle'),
                    revenueClassificationBasisNote='Segment revenue includes net sales and membership/other income; totals reconcile to consolidated revenue.')
                return payload
    for rows in tables:
        # Fiscal tables are validated above. Never reinterpret a rejected
        # fiscal/rounding check as an unlabeled generic monetary column.
        if any(re.fullmatch(r'Q[1-4] FY\d{2,4}', cell) for row in rows[:6] for cell in row): continue
        partition=extract_partition(rows,templates,entry,url,allow_corporate=cid=='procter-gamble',
                                    residual='otherproducts' if cid=='abbvie' else None,allow_reconciliation=cid=='coca-cola')
        if not partition and cid=='berkshire': partition=transposed_partition(rows,templates,entry,url)
        if not partition: continue
        oldkeys={key(r.get('memberKey')or r.get('name'))for r in prior.get('officialRevenueSegments')or[]}
        newkeys={key(r.get('memberKey')or r.get('name'))for r in partition}
        entry['officialRevenueSegments']=partition
        entry['revenueClassificationSourceUrl']=url
        entry['revenueClassificationSource']='official-complete-table'
        if oldkeys!=newkeys:
            entry['officialRevenueTaxonomyChangedFromPreviousQuarter']=True
            entry['revenueClassificationBasisNote']='Current official revenue partition; prior-period category amounts are not allocated.'
        # Recover children from the SAME current table/column, checked against
        # each current parent rather than the consolidated revenue anchor.
        details=[]
        for parent in partition:
            old=[r for r in prior.get('officialRevenueDetailGroups')or[] if key(r.get('targetName')or r.get('targetId')) in names(parent)]
            if not old: continue
            child_entry={**entry,'revenueBn':parent['valueBn']}
            parent_rows=[list(r)for r in rows]
            for r in parent_rows:
                if r and label_key(r[0]) in names(parent): r[0]='Revenue'
            children=extract_partition(parent_rows,old,child_entry,url)
            if children: details.extend(children)
        if details: entry['officialRevenueDetailGroups']=details
        return payload
    return payload

def complete_current_chart(payload, company, *, documents=None, require_filing_date=None):
    """Try release, then matching statutory filing; keep successful extraction.

    `documents` injects saved official responses for deterministic replay tests.
    Network recovery is bounded to the current period, never a history rebuild.
    """
    from release_chart_quality import enrich_from_release
    from official_segments import _request, _request_json, _resolve_cik
    quarter=max(payload.get('financials',{}),default='')
    if not quarter: return payload
    entry=payload['financials'][quarter]
    # Legacy cached releases omit row dates when the row and statement share a document.
    preserve_statement_row_filing_dates(entry)
    entry.pop('chartCompletionAwaitingStatutoryFiling', None)
    attempts=[]
    def apply_document(html,url,filed=None):
        from earnings_release import parse_release
        from bs4 import BeautifulSoup
        filed=filed or entry.get('statementFilingDate')or''
        native=company.get('reportingCurrency')or entry.get('statementCurrency')or'USD'
        if payload['id'] in {'coca-cola','walmart','home-depot','chevron'}: native='USD'
        # Re-read consolidated actuals too: otherwise an old "net sales"
        # figure could make an entirely correct total-revenue partition fail.
        parsed=parse_release(html,{**company,'id':payload['id'],'reportingCurrency':native},url,filed,allow_partial=True).get(quarter)
        if parsed and entry.get('periodEnd') and parsed.get('periodEnd') != entry['periodEnd']:
            attempts.append({'sourceUrl':url,'error':'Statement period differs from the requested reporting period'})
            return
        if parsed and parsed.get('periodEnd','')<=filed:
            for field,value in parsed.items():
                if value is not None and (field.endswith(('Bn','MarginPct','MarginYoyDeltaPp')) or field in {'periodEnd','statementCurrency'}
                    or field in {'fiscalYear','fiscalQuarter','fiscalLabel','statementFiscalPeriodSource'} and parsed.get('statementFiscalPeriodSource')): entry[field]=value
        if (parsed and parsed.get('periodEnd') == entry.get('periodEnd')
            and all(finite(parsed.get(k)) for k in ('revenueBn','netIncomeBn'))
            and url.startswith('https://www.sec.gov/Archives/edgar/data/')):
            entry.update(statementSourceUrl=url, statementFilingDate=filed)
            accession = re.search(r'/edgar/data/\d+/(\d{18})/', url)
            if accession:
                digits = accession[1]
                entry['statementAccession'] = f'{digits[:10]}-{digits[10:12]}-{digits[12:]}'
        soup=BeautifulSoup(html,'html.parser')
        fiscal={n.get('name','').split(':')[-1]:n.get_text(strip=True)for n in soup.find_all('ix:nonnumeric')
                if n.get('name','').split(':')[-1]in {'DocumentFiscalYearFocus','DocumentFiscalPeriodFocus'}}
        if fiscal.get('DocumentFiscalPeriodFocus')in {'Q1','Q2','Q3','Q4'}and fiscal.get('DocumentFiscalYearFocus'):
            entry.update(fiscalYear=fiscal['DocumentFiscalYearFocus'],fiscalQuarter=fiscal['DocumentFiscalPeriodFocus'],
                fiscalLabel=f"FY{fiscal['DocumentFiscalYearFocus']} {fiscal['DocumentFiscalPeriodFocus']}")
        entry['_classificationFilingDate']=filed
        enrich_from_release(payload,html,url)
        enrich_complete_partition(payload,html,url)
        entry.pop('_classificationFilingDate',None)
        attempts.append({'sourceUrl':url,'remainingIssues':chart_issues(payload)})
    def apply(html, url, filed=None):
        before = deepcopy(entry)
        try:
            apply_document(html, url, filed)
        except Exception:
            entry.clear()
            entry.update(before)
            raise
    if documents is not None:
        for document in documents:
            url,html,*metadata=document
            apply(html,url,*metadata)
            if not chart_issues(payload): break
    else:
        url=entry.get('statementSourceUrl')or''
        if url:
            try:
                content=_request(url)
                if content.startswith(b'%PDF'):
                    enrich_pdf_partition(payload,content,url)
                    attempts.append({'sourceUrl':url,'remainingIssues':chart_issues(payload)})
                else: apply(content.decode('utf-8',errors='replace'),url)
            except Exception as exc: attempts.append({'sourceUrl':url,'error':str(exc)})
        if chart_issues(payload):
            # The statement and revenue classifications may be separate
            # exhibits of the SAME earnings 8-K, ahead of the statutory 10-Q.
            from earnings_release import discover_filing_exhibits
            match = re.match(r'(https://www\.sec\.gov/Archives/edgar/data/\d+/\d{18}/)', url)
            if match and (entry.get('automaticEarnings') or {}).get('form') in {'8-K', '6-K'}:
                base = match[1]
                try:
                    for name in discover_filing_exhibits(base, diagnostics=attempts):
                        companion = base + name
                        if companion == url: continue
                        try:
                            content = _request(companion)
                            if content.startswith(b'%PDF'):
                                enrich_pdf_partition(payload, content, companion)
                                attempts.append({'sourceUrl':companion,'remainingIssues':chart_issues(payload)})
                            else: apply(content.decode('utf-8', errors='replace'), companion)
                        except Exception as exc: attempts.append({'sourceUrl':companion,'error':str(exc)})
                        if not chart_issues(payload): break
                except Exception as exc: attempts.append({'sourceUrl':base + 'index.json','error':str(exc)})
        if chart_issues(payload) or (require_filing_date and (entry.get('statementFilingDate') or '') < require_filing_date):
            cik=company.get('cik')or _resolve_cik(company.get('ticker',''),False)
            if cik:
                recent=_request_json(f'https://data.sec.gov/submissions/CIK{int(cik):010d}.json')['filings']['recent']
                for i,form in enumerate(recent['form']):
                    if form not in {'10-Q','10-K','20-F'}: continue
                    end=recent['reportDate'][i]or''
                    if not end or end != entry.get('periodEnd'): continue
                    url=f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{recent['accessionNumber'][i].replace('-','')}/{recent['primaryDocument'][i]}"
                    try: apply(_request(url).decode('utf-8',errors='replace'),url,recent['filingDate'][i])
                    except Exception as exc: attempts.append({'sourceUrl':url,'error':str(exc)})
                    break
                else:
                    if (entry.get('automaticEarnings') or {}).get('form') == '8-K':
                        entry['chartCompletionAwaitingStatutoryFiling'] = True
    entry['chartCompletionAttempts']=attempts
    return payload
