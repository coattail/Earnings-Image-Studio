# Earnings Image Studio

[English](./README.md)

一个独立的财报可视化工作台，用于生成营收/成本桥图（Sankey）与营收结构柱图。

项目合并后，保留了 `earnings-image-studio` 原有绘图与布局算法，同时将解析层升级为多适配器融合引擎。

## 核心能力

### 网页端功能

- 基于静态 HTML/CSS/JS 的交互式控制台
- 公司/季度切换与预览
- 营收-成本桥图（Sankey）渲染
- 营收分部/明细分组柱图渲染
- 支持 SVG、PNG 导出（与页面渲染同一套引擎）
- 支持手工像素复刻预设（特定公司可启用更精细布局）

### Skill 功能

- 可通过 `SKILL.md` 安装为 Codex skill
- 支持官方披露 + 结构化回退的数据构建
- 多解析器/多适配器融合为季度级统一 payload
- 输出字段级来源追踪 `fieldSources`
- 输出质量诊断 `extractionDiagnostics`

## 合并后架构

- 渲染与布局：沿用 `earnings-image-studio` 既有实现
- 主解析编排：`scripts/universal_parser.py`
- 融合抽取层：`scripts/extraction_engine.py`
- 适配器目录：`scripts/source_adapters/`
- 通用解析器：
  - `scripts/generic_filing_table_parser.py`
  - `scripts/generic_ir_pdf_parser.py`
- 标准化与期间推导：
  - `scripts/taxonomy_normalizer.py`
  - `scripts/statement_periods.py`

## 快速开始

### 1. 安装依赖

```bash
python3 -m pip install -r requirements.txt
```

如果你会使用 JS 审计/导出脚本：

```bash
npm install
```

### 2. 构建/刷新数据

使用本地缓存构建：

```bash
python3 scripts/build_dataset.py
```

强制刷新远程数据：

```bash
python3 scripts/build_dataset.py --refresh
```

仅刷新部分公司：

```bash
python3 scripts/build_dataset.py --refresh --companies nvda,aapl,googl
```

### 3. 启动网页版

```bash
python3 -m http.server 9036
```

打开：`http://127.0.0.1:9036`

## 数据与自动化

- 输出数据：`data/earnings-dataset.json`
- 解析缓存：`data/cache/`
- 可选增量检测：

```bash
python3 scripts/check_for_updates.py
```

仅检测不更新：

```bash
python3 scripts/check_for_updates.py --dry-run
```

## 安装为 Codex Skill

`SKILL.md` 是 skill 入口文件。

推荐软链接安装：

```bash
CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
mkdir -p "$CODEX_HOME/skills/earnings-image-studio"
ln -sfn "$(pwd)/SKILL.md" \
  "$CODEX_HOME/skills/earnings-image-studio/SKILL.md"
```

复制安装：

```bash
CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
mkdir -p "$CODEX_HOME/skills/earnings-image-studio"
cp "SKILL.md" "$CODEX_HOME/skills/earnings-image-studio/SKILL.md"
```

## 目录说明

- `index.html`、`style.css`、`js/`：网页端壳与渲染逻辑
- `data/`：数据集、预设与缓存
- `scripts/build_dataset.py`：数据构建主流程
- `scripts/universal_parser.py`：多源抓取与回退编排
- `scripts/extraction_engine.py`：字段级融合引擎
- `scripts/source_adapters/`：各类数据源适配器
- `SKILL.md`：skill 元信息与工作流入口

## 说明

- 仓库文档已改为通用写法，不依赖本机绝对路径。
- 部署到 Pages/CI 时，请按你自己的仓库配置填写地址与流程。
