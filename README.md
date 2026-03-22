# Earnings Image Studio

独立的财报可视化图片生成工具，界面风格参考现有房价可视化平台，但输出目标是类似微软案例的营收与开支桥图。

## 特点

- 独立目录运行，不依赖旧财报项目的模板、路由或数据库
- 静态 HTML/CSS/JavaScript 控制台，便于本地直接预览
- 内置季度财报数据编译脚本，覆盖美股市值前 30 公司池，并直接从 SEC EDGAR 官方 XBRL 抽取 2020 年以来季度财务主干
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

- 仓库内置了 `.github/workflows/update-data.yml`，会每小时自动检查样本公司是否有新财报；一旦检测到新 filing，只增量刷新相关公司并自动提交到 `main`
- 仓库内置了 `.github/workflows/deploy-pages.yml`，每次 `main` 有新提交时都会重新部署线上静态预览站
- GitHub Pages 发布工件由 `scripts/prepare_pages_artifact.py` 生成，只会带上前端运行所需的静态文件和前端实际会读取的数据 JSON
- Python 依赖统一写在 `requirements.txt`

如果你的仓库第一次启用 Pages，自定义工作流通常需要在仓库 `Settings -> Pages` 中将发布源设为 `GitHub Actions`。

部署完成后，预览地址通常会是：

```text
https://coattail.github.io/Earnings-Image-Studio/
```

## 数据说明

- 公司池基于 2026-03-14 的美股市值排名去重后取前 30 家，保留 ADR 样本
- 季度财务主干来自 SEC EDGAR `companyfacts` 与官方 XBRL 口径，按公司申报币种保留原始单位
- 营收结构数据直接来自 SEC EDGAR 官方 filings 的分部披露 XBRL
- 补充拆分指标可放在 `data/supplemental-components.json`，由原型数据适配层读取，不耦合渲染器
- 手工精修快照保存在 `data/manual-presets.json`
- 输出主数据保存在 `data/earnings-dataset.json`

## 文件结构

- `index.html`: 页面结构
- `style.css`: 控制台布局与视觉样式
- `app.js`: 数据加载、控件交互、SVG 生成与导出
- `docs/renderer-architecture.md`: 当前渲染器的布局/渲染拆层方向，以及 D3 采用建议
- `data/manual-presets.json`: 手工精修的像素复刻快照
- `data/earnings-dataset.json`: 编译后的前端数据
- `scripts/build_dataset.py`: 公司池与季度财报数据编译脚本
