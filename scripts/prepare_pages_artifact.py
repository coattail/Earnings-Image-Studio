from __future__ import annotations

import shutil
from pathlib import Path
import json


ROOT_DIR = Path(__file__).resolve().parents[1]
DIST_DIR = ROOT_DIR / "dist"
DATA_DIR = ROOT_DIR / "data"
JS_DIR = ROOT_DIR / "js"
PUBLIC_FILES = ("index.html", "style.css", "favicon.svg")
PUBLIC_DATA_FILES = ("earnings-dataset.json", "logo-catalog.json", "supplemental-components.json")
DATASET_INDEX_FILENAME = "dataset-index.json"


def latest_quarter_key(company_payload: dict) -> str | None:
    quarters = company_payload.get("quarters")
    if isinstance(quarters, list) and quarters:
        return str(quarters[-1] or "").strip() or None
    financials = company_payload.get("financials")
    if isinstance(financials, dict) and financials:
        return sorted([str(key or "").strip() for key in financials.keys() if str(key or "").strip()])[-1]
    return None


def latest_quarter_only(history_payload: dict | None, quarter_key: str | None) -> dict:
    if not isinstance(history_payload, dict) or not quarter_key:
        return {}
    quarters = history_payload.get("quarters")
    if not isinstance(quarters, dict):
        return {}
    latest_payload = quarters.get(quarter_key)
    if latest_payload is None:
        return {}
    return {
        **history_payload,
        "quarters": {
            quarter_key: latest_payload,
        },
    }


def build_dataset_index_company(company_payload: dict) -> dict:
    latest_quarter = latest_quarter_key(company_payload)
    company_index = {
        key: value
        for key, value in company_payload.items()
        if key not in {
            "financials",
            "statementPresets",
            "officialRevenueStructureHistory",
            "officialSegmentHistory",
            "parserDiagnostics",
            "unifiedExtraction",
        }
    }
    company_index["dataLoadMode"] = "latest-only"
    company_index["latestQuarter"] = latest_quarter
    company_index["financials"] = {}
    company_index["statementPresets"] = {}
    if latest_quarter and isinstance(company_payload.get("financials"), dict) and latest_quarter in company_payload["financials"]:
        company_index["financials"] = {
            latest_quarter: company_payload["financials"][latest_quarter],
        }
    if latest_quarter and isinstance(company_payload.get("statementPresets"), dict) and latest_quarter in company_payload["statementPresets"]:
        company_index["statementPresets"] = {
            latest_quarter: company_payload["statementPresets"][latest_quarter],
        }
    company_index["officialRevenueStructureHistory"] = latest_quarter_only(
        company_payload.get("officialRevenueStructureHistory"),
        latest_quarter,
    )
    company_index["officialSegmentHistory"] = latest_quarter_only(
        company_payload.get("officialSegmentHistory"),
        latest_quarter,
    )
    return company_index


def build_dataset_index_payload(dataset_payload: dict) -> dict:
    companies = dataset_payload.get("companies")
    if not isinstance(companies, list):
        companies = []
    return {
        "generatedAt": dataset_payload.get("generatedAt"),
        "companyCount": dataset_payload.get("companyCount", len(companies)),
        "companies": [build_dataset_index_company(company) for company in companies if isinstance(company, dict)],
    }


def write_dataset_index_file(dataset_payload: dict, output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(build_dataset_index_payload(dataset_payload), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def reset_dist_dir() -> None:
    if DIST_DIR.exists():
        shutil.rmtree(DIST_DIR)
    DIST_DIR.mkdir(parents=True, exist_ok=True)


def copy_public_root_files() -> None:
    for filename in PUBLIC_FILES:
        shutil.copy2(ROOT_DIR / filename, DIST_DIR / filename)

    dist_js_dir = DIST_DIR / "js"
    if dist_js_dir.exists():
        shutil.rmtree(dist_js_dir)
    shutil.copytree(JS_DIR, dist_js_dir)


def copy_public_data_files() -> None:
    dist_data_dir = DIST_DIR / "data"
    dist_cache_dir = dist_data_dir / "cache"
    dist_data_dir.mkdir(parents=True, exist_ok=True)
    dist_cache_dir.mkdir(parents=True, exist_ok=True)

    for filename in PUBLIC_DATA_FILES:
        shutil.copy2(DATA_DIR / filename, dist_data_dir / filename)

    dataset_payload = json.loads((DATA_DIR / "earnings-dataset.json").read_text(encoding="utf-8"))
    write_dataset_index_file(dataset_payload, dist_data_dir / DATASET_INDEX_FILENAME)

    for company_cache_path in sorted((DATA_DIR / "cache").glob("*.json")):
        shutil.copy2(company_cache_path, dist_cache_dir / company_cache_path.name)


def write_nojekyll_marker() -> None:
    (DIST_DIR / ".nojekyll").write_text("", encoding="utf-8")


def main() -> int:
    reset_dist_dir()
    copy_public_root_files()
    copy_public_data_files()
    write_nojekyll_marker()
    print(f"[pages] prepared static artifact at {DIST_DIR}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
