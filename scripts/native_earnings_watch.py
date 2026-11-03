"""Official release indexes for non-SEC issuers; never treat guidance as results."""
import re
from bs4 import BeautifulSoup
from urllib.parse import urljoin
from official_segments import _request, _request_json


def latest_native_release(company):
    company_id = company["id"]
    if company_id == "samsung":
        url = "https://www.samsung.com/global/ir/financial-information/earnings-release/"
        html = _request(url).decode("utf-8", errors="replace")
        matches = re.findall(r'([/][^"\s<>]*?/(20\d{2})_([1-4])Q_conference_eng\.pdf)', html)
        if not matches:
            raise ValueError("Samsung official earnings PDF index could not be parsed")
        href, year, quarter = max(matches, key=lambda row: (row[1], row[2]))
        if company.get('_localQuarter')==f'{year}Q{quarter}'and str(company.get('_localSourceUrl')or'').endswith(href.split('/')[-1])and company.get('_localFilingDate'):
            return dict(quarter=f'{year}Q{quarter}',sourceUrl=urljoin(url,href),filingDate=company['_localFilingDate'],form='official-ir-pdf')
        from datetime import datetime
        ordinal = {"1": "first", "2": "second", "3": "third", "4": "fourth"}[quarter]
        news_url = f"https://news.samsung.com/global/samsung-electronics-announces-{ordinal}-quarter-{year}-results"
        news = BeautifulSoup(_request(news_url), "html.parser").get_text(" ", strip=True)
        published = re.search(r"\bon\s+([A-Z][a-z]+ \d{1,2}, \d{4})", news)
        if not published:
            raise ValueError("Samsung release publication date could not be verified")
        filed = datetime.strptime(published[1], "%B %d, %Y").date().isoformat()
        return dict(quarter=f"{year}Q{quarter}", sourceUrl=urljoin(url, href), filingDate=filed, form="official-ir-pdf")
    if company_id in {"sk-hynix", "skhynix"}:
        url = "https://news.skhynix.com/en/category/ir/"
        html = _request(url).decode("utf-8", errors="replace")
        links = []
        for a in BeautifulSoup(html, "html.parser").find_all("a", href=True):
            match = re.search(r"/q([1-4])-(20\d{2})-business-results/?", a["href"])
            if match:
                links.append((match[2], match[1], urljoin(url, a["href"])))
        if not links:
            raise ValueError("SK hynix official results index could not be parsed")
        year, quarter, source = max(links)
        return dict(quarter=f"{year}Q{quarter}", sourceUrl=source, filingDate="", form="official-ir-release")
    if company_id == "tencent":
        from official_revenue_structures import _extract_tencent_result_links, _quarter_from_tencent_title, _extract_tencent_filing_date
        html = _request("https://www.tencent.com/investors/results/").decode("utf-8", errors="replace")
        items = []
        for link in _extract_tencent_result_links(html):
            quarter, _ = _quarter_from_tencent_title(link["title"])
            if quarter:
                items.append(dict(quarter=quarter, sourceUrl=link["pdfUrl"], filingDate=_extract_tencent_filing_date(link["dateText"], link["pdfUrl"]), form="official-ir-pdf"))
        if not items:
            raise ValueError("Tencent official results index could not be parsed")
        return max(items, key=lambda item: item["quarter"])
    if company_id == "alibaba":
        from datetime import date
        from official_revenue_structures import _quarter_from_alibaba_title, _timestamp_ms_to_iso_date
        items = []
        for year in [date.today().year, date.today().year + 1]:
            try:
                payload = _request_json(f"https://data.alibabagroup.com/data/index/ir/quarterly-results/q{year}/list.json")
            except Exception:
                if year > date.today().year:
                    continue  # Next fiscal year's index may not exist yet.
                raise
            for item in payload.get("content", []):
                title = item.get("documentTitle") or ""
                if isinstance(title, dict): title = title.get("en_US", "")
                quarter = _quarter_from_alibaba_title(title)
                if quarter:
                    items.append(dict(quarter=quarter, filingDate=_timestamp_ms_to_iso_date(item.get("eventDate") or item.get("documentPublishTime")), sourceUrl=f"https://www.alibabagroup.com/en-US/document-{item.get('documentId')}", form="official-ir-release"))
        if not items:
            raise ValueError("Alibaba official results index could not be parsed")
        return max(items, key=lambda item: item["quarter"])
    return None
