# Earnings Image Studio

[中文文档](./README.zh-CN.md)

A standalone earnings visualization studio for building revenue/cost bridge charts and revenue-structure bar charts.

After the merge, the project keeps the original `earnings-image-studio` rendering and layout behavior, while upgrading the parsing layer with a fused multi-adapter extraction engine.

## Highlights

### Web App

- Interactive browser UI (static HTML/CSS/JS) for company and quarter selection
- Sankey-style earnings bridge rendering with stable layout templates
- Revenue segment / detail-group bar visualization
- SVG and PNG export directly from the same in-browser renderer
- Manual pixel-replica presets for high-fidelity company-specific layouts

### Skill Capability

- Can be installed as a Codex skill via `SKILL.md`
- Builds and refreshes dataset payloads from official filings and structured fallbacks
- Fuses multiple parsers/adapters into one quarter-level payload
- Emits field-level provenance (`fieldSources`) and quality diagnostics (`extractionDiagnostics`)

## Architecture (Post-Merge)

- Renderer/layout: preserved from `earnings-image-studio`
- Primary parser orchestration: `scripts/universal_parser.py`
- Fused extraction layer: `scripts/extraction_engine.py`
- Adapter registry: `scripts/source_adapters/`
- Generic parsers:
  - `scripts/generic_filing_table_parser.py`
  - `scripts/generic_ir_pdf_parser.py`
- Shared normalization/period logic:
  - `scripts/taxonomy_normalizer.py`
  - `scripts/statement_periods.py`

## Quick Start

### 1. Install dependencies

```bash
python3 -m pip install -r requirements.txt
```

If you run JavaScript audit/export helpers:

```bash
npm install
```

### 2. Build/refresh dataset

Build with local caches:

```bash
python3 scripts/build_dataset.py
```

Force refresh from remote sources:

```bash
python3 scripts/build_dataset.py --refresh
```

Refresh selected companies only:

```bash
python3 scripts/build_dataset.py --refresh --companies nvda,aapl,googl
```

### 3. Run the web app locally

```bash
python3 -m http.server 9036
```

Open: `http://127.0.0.1:9036`

## Data & Automation

- Output dataset: `data/earnings-dataset.json`
- Cached parser artifacts: `data/cache/`
- Optional incremental release check:

```bash
python3 scripts/check_for_updates.py
```

Dry-run only:

```bash
python3 scripts/check_for_updates.py --dry-run
```

## Install as a Codex Skill

`SKILL.md` is the skill entrypoint.

Symlink install (recommended):

```bash
CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
mkdir -p "$CODEX_HOME/skills/earnings-image-studio"
ln -sfn "$(pwd)/SKILL.md" \
  "$CODEX_HOME/skills/earnings-image-studio/SKILL.md"
```

Copy install:

```bash
CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
mkdir -p "$CODEX_HOME/skills/earnings-image-studio"
cp "SKILL.md" "$CODEX_HOME/skills/earnings-image-studio/SKILL.md"
```

## Project Structure

- `index.html`, `style.css`, `js/`: web app shell and renderer
- `data/`: generated dataset, presets, and caches
- `scripts/build_dataset.py`: end-to-end dataset build pipeline
- `scripts/universal_parser.py`: source orchestration and fallback selection
- `scripts/extraction_engine.py`: field-level multi-adapter fusion
- `scripts/source_adapters/`: adapter implementations
- `SKILL.md`: skill entry metadata and workflow

## Notes

- This repository is path-agnostic: all commands use relative paths.
- For CI/CD deployment, use your own repository settings and pages URL.
