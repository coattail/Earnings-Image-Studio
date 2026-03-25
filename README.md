# Earnings Image Studio

独立的财报可视化图片生成工具，界面风格参考现有房价可视化平台，但输出目标是类似微软案例的营收与开支桥图。

## 特点

- 独立目录运行，不依赖旧财报项目的模板、路由或数据库
- 静态 HTML/CSS/JavaScript 控制台，便于本地直接预览
- 内置季度财报数据编译脚本，覆盖美股市值前 30 公司池，并额外纳入腾讯、阿里巴巴、京东、网易、小米、比亚迪、美团等国际样本
- 支持 SVG 预览与 SVG/PNG 导出
- 所有公司统一使用新版复刻模板引擎；命中手工精修快照时会自动套用更细的专属布局参数

## 运行

```bash
cd "/Users/yuwan/Documents/New project/earnings-image-studio"
python3 -m http.server 9036
```

打开 `http://127.0.0.1:9036`。

## 刷新数据

```bash
cd "/Users/yuwan/Documents/New project/earnings-image-studio"
python3 scripts/build_dataset.py
```

如需在现有数据集上继续从官方 filings 回填营收结构数据：

```bash
cd "/Users/yuwan/Documents/New project/earnings-image-studio"
python3 scripts/backfill_official_segments.py
```

如需全局巡检柱状图分类异常（例如孤立季度 schema 突变、synthetic residual 桶）：

```bash
cd "/Users/yuwan/Documents/New project/earnings-image-studio"
node scripts/audit_bar_taxonomy.js
```

如需强制重新抓取远程数据：

```bash
cd "/Users/yuwan/Documents/New project/earnings-image-studio"
python3 scripts/build_dataset.py --refresh
```

如需只刷新个别公司：

```bash
cd "/Users/yuwan/Documents/New project/earnings-image-studio"
python3 scripts/build_dataset.py --refresh --companies nvda,aapl,googl
```

如需自动检测样本公司是否发布了新财报，并在发现新 filing 后只增量刷新相关公司：

```bash
cd "/Users/yuwan/Documents/New project/earnings-image-studio"
python3 scripts/check_for_updates.py
```

如需只做检测、不实际更新：

```bash
cd "/Users/yuwan/Documents/New project/earnings-image-studio"
python3 scripts/check_for_updates.py --dry-run
```

## 自动化

- 仓库内置了 `.github/workflows/update-data.yml`，会在每周一北京时间 09:17（UTC 周一 01:17）自动检查样本公司是否有新财报；一旦检测到新 filing，只增量刷新相关公司并自动提交到 `main`
- `Update Earnings Data` 同时保留 `workflow_dispatch` 手动触发，可以在 GitHub Actions 页面随时执行；手动运行时既可以选择“检测后增量刷新”，也可以选择“强制刷新”，并可选只刷新个别公司
- 仓库内置了 `.github/workflows/deploy-pages.yml`，每次 `main` 有新提交时都会重新部署线上静态预览站
- GitHub Pages 发布工件由 `scripts/prepare_pages_artifact.py` 生成，只会带上前端运行所需的静态文件和前端实际会读取的数据 JSON
- Python 依赖统一写在 `requirements.txt`

如果你的仓库第一次启用 Pages，建议在仓库 `Settings -> Pages` 中将发布源设为 `GitHub Actions`；当前工作流也会尝试在首次部署时自动完成 Pages enablement。

部署完成后，预览地址通常会是：

```text
https://coattail.github.io/Earnings-Image-Studio/
```

## 数据说明

- 公司池基于 2026-03-14 的美股市值排名去重后取前 30 家，并补充腾讯、阿里巴巴、京东、网易、小米、比亚迪、美团等国际扩展样本
- 季度财务主干来自 SEC EDGAR `companyfacts` 与官方 XBRL 口径，按公司申报币种保留原始单位
- 营收结构数据直接来自 SEC EDGAR 官方 filings 的分部披露 XBRL
- 数据编译阶段现在通过统一解析编排层协调多种抓取器，并为每家公司保留来源选择、回退链路与覆盖度元数据
- 统一解析层已支持“上下文 financial adapters”：例如腾讯会自动结合官方营收结构披露里的 IR PDF 链接，补齐并优先采用 PDF 解析出的利润表历史，再与 stockanalysis / official 字段级对账
- 官方营收/费用分类抓取已逐步迁出手工 override：例如京东、网易、小米、美团会直接从 IR results / report PDF 自动提取 revenue structure 与 opex breakdown
- 补充拆分指标可放在 `data/supplemental-components.json`，由原型数据适配层读取，不耦合渲染器
- 手工精修快照保存在 `data/manual-presets.json`
- 输出主数据保存在 `data/earnings-dataset.json`

## 文件结构

- `index.html`: 页面结构
- `style.css`: 控制台布局与视觉样式
- `js/app-00-foundation.js` ~ `js/app-04-bootstrap.js`: 按执行顺序拆分的前端主逻辑，分别承载基础状态/工具、布局、桑基图渲染、数据与快照构建、页面启动与导出
- `docs/renderer-architecture.md`: 当前渲染器的布局/渲染拆层方向，以及 D3 采用建议
- `data/manual-presets.json`: 手工精修的像素复刻快照
- `data/earnings-dataset.json`: 编译后的前端数据
- `scripts/build_dataset.py`: 公司池与季度财报数据编译脚本
- `scripts/universal_parser.py`: 统一解析编排层，负责多源抓取的优先级、回退与来源诊断
