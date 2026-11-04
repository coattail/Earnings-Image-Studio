"""Verify actual public quarterly data after a successful Pages deployment."""
import argparse
import json
from pathlib import Path
import time
from urllib.request import Request, urlopen
try:
    from scripts.release_chart_quality import chart_fingerprint
except ModuleNotFoundError:
    from release_chart_quality import chart_fingerprint


def fingerprint(data):
    return {c['id']: chart_fingerprint(c) for c in data['companies'] if c.get('financials')}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", required=True)
    parser.add_argument("--expected", type=Path, default=Path("data/earnings-dataset.json"))
    args = parser.parse_args()
    expected = fingerprint(json.loads(args.expected.read_text()))
    last = None
    for attempt in range(6):
        try:
            request = Request(args.url + "?verify=" + str(time.time_ns()), headers={"Cache-Control": "no-cache"})
            with urlopen(request, timeout=20) as response:
                actual = fingerprint(json.load(response))
            missing = [key for key, value in expected.items() if actual.get(key) != value]
            if not missing:
                print(f"Verified public latest-quarter values for {len(expected)} companies")
                return
            last = ValueError(f"Public earnings data differs for {', '.join(missing)}")
        except Exception as error:
            last = error
        if attempt < 5:
            time.sleep(10)
    raise RuntimeError(f"Deployment verification failed: {last}")


if __name__ == "__main__":
    main()
