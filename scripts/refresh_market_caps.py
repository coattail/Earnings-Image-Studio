"""Refresh comparable USD market caps without rebuilding financial histories."""
from __future__ import annotations

from datetime import datetime, timezone
from html import unescape
import json
from pathlib import Path
import re
import time
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
SOURCE_URL = "https://companiesmarketcap.com/"
TICKER_ALIASES = {
    "alphabet": "GOOG", "berkshire": "BRK-B", "samsung": "005930.KS",
    "sk-hynix": "000660.KS", "byd": "002594.SZ", "xiaomi": "XIACF",
    "meituan": "3690.HK",
}


def parse_rows(html: str) -> dict[str, dict]:
    entries = {}
    for row in re.findall(r"<tr\b[^>]*>(.*?)</tr>", html, re.S | re.I):
        cells = re.findall(r"<td\b([^>]*)>(.*?)</td>", row, re.S | re.I)
        if len(cells) < 4:
            continue
        code = re.search(r'<div\b[^>]*class="company-code"[^>]*>(.*?)</div>', row, re.S)
        link = re.search(r'href="(/[^"/]+/marketcap/)"', row)
        rank = re.search(r'data-sort="(\d+)"', cells[1][0])
        cap = re.search(r'data-sort="(\d+)"', cells[3][0])
        if not (code and link and rank and cap) or int(cap[1]) <= 0:
            continue
        ticker = unescape(re.sub(r"<[^>]+>", "", code[1])).strip()
        if ticker:
            entries[ticker] = {
                "marketCapUsd": int(cap[1]),
                "sourceRank": int(rank[1]),
                "sourceUrl": SOURCE_URL.rstrip("/") + link[1],
            }
    return entries


def fetch_page(page: int) -> str:
    url = SOURCE_URL + (f"?page={page}" if page > 1 else "")
    request = Request(url, headers={"User-Agent": "Mozilla/5.0 (Earnings-Image-Studio)"})
    for attempt in range(3):
        try:
            with urlopen(request, timeout=25) as response:
                return response.read().decode("utf-8")
        except OSError:
            if attempt == 2:
                raise
            time.sleep(attempt + 1)
    raise RuntimeError("Market-cap source did not respond")


def collect_snapshot(companies: list[dict]) -> dict:
    pending = {company["id"]: TICKER_ALIASES.get(company["id"], company["ticker"]) for company in companies}
    entries = {}
    for page in range(1, 11):
        rows = parse_rows(fetch_page(page))
        if not rows:
            raise ValueError(f"No market-cap rows found on source page {page}; keeping existing data")
        for company_id, ticker in list(pending.items()):
            if ticker in rows:
                entries[company_id] = rows[ticker]
                del pending[company_id]
        if not pending:
            break
    if pending:
        raise ValueError(f"Missing market caps for {', '.join(sorted(pending))}; keeping existing data")
    now = datetime.now(timezone.utc)
    return {
        "source": {
            "label": "CompaniesMarketCap", "url": SOURCE_URL, "currency": "USD",
            "asOf": now.date().isoformat(), "retrievedAt": now.isoformat(timespec="seconds"),
            "note": "Company-level USD market caps retrieved together; source quotes may be delayed.",
        },
        "companies": entries,
    }


def apply_snapshot(dataset: dict, snapshot: dict) -> None:
    source = snapshot["source"]
    for company in dataset["companies"]:
        entry = snapshot["companies"].get(company["id"])
        if entry is None:
            raise ValueError(f"Missing market cap for {company['id']}")
        company.update({
            "marketCapUsd": entry["marketCapUsd"], "marketCapAsOf": source["asOf"],
            "marketCapSource": source["label"], "marketCapSourceRank": entry["sourceRank"],
            "marketCapSourceUrl": entry["sourceUrl"],
        })
    ranked_companies = sorted(dataset["companies"], key=lambda company: (-company["marketCapUsd"], company["id"]))
    for rank, company in enumerate(ranked_companies, 1):
        company["rank"] = rank
    dataset["marketCapUpdatedAt"] = source["retrievedAt"]
    if isinstance(dataset.get("universeSource"), dict):
        dataset["universeSource"]["as_of"] = source["asOf"]


def main() -> None:
    paths = [DATA_DIR / name for name in ("earnings-dataset.json", "dataset-index.json")]
    datasets = [json.loads(path.read_text(encoding="utf-8")) for path in paths]
    snapshot = collect_snapshot(datasets[0]["companies"])
    # Validate all payloads before writing anything. Financial values remain intact.
    for dataset in datasets:
        apply_snapshot(dataset, snapshot)
    payloads = [(DATA_DIR / "company-market-caps.json", snapshot), *zip(paths, datasets)]
    for path, payload in payloads:
        temp = path.with_suffix(".json.tmp")
        temp.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        temp.replace(path)
    print(f"Refreshed {len(snapshot['companies'])} USD market caps as of {snapshot['source']['asOf']}")


if __name__ == "__main__":
    main()
