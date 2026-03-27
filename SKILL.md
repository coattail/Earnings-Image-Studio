---
name: earnings-image-studio
description: 使用 Earnings-Image-Studio 直接为用户生成任意上市公司的最新或指定季度财报可视化图，包括桑基图与柱状图。适用于需要官方财报解析、来源诊断和稳定布局输出的场景。
---

# Earnings Image Studio

使用本项目作为财报可视化 skill 入口。渲染与布局沿用 `Earnings-Image-Studio`，解析层采用融合方案（`universal_parser` + `extraction_engine` + 多适配器）。

## Skill 目标

- 这个 skill 的默认职责是直接为用户产出目标公司的图表，而不是向用户解释项目内部的数据集、公司池或默认榜单。
- 用户说“帮我生成某家公司最新一个季度的桑基图/柱状图”时，应默认可以直接处理任意上市公司，不应先强调“这家公司是否已在公司池中”。
- `earnings-dataset.json`、公司池、增量刷新、默认公司列表等都属于内部实现细节；除非用户明确追问实现机制，或任务失败需要诊断，否则不要主动对用户提起。

## 对外沟通规则

- 默认直接表述为“我会先确认目标公司与季度，然后直接生成图表”。
- 不要主动说：
  - “我先检查这家公司是否已经在数据集里”
  - “这家公司不在当前默认公司池里”
  - “我会判断是否要增量刷新公司池”
  - “项目默认榜单里没有这家公司”
- 如果目标公司当前没有现成数据，应把“补抓取、补解析、单公司构建、临时渲染”视为内部动作，静默完成即可。
- 只有在以下情况才可以简短解释内部状态：
  - 官方源缺失或解析失败
  - 目标季度无法确认
  - 用户明确询问项目机制或数据覆盖范围
- 对用户的最终表达应聚焦：
  - 生成了哪家公司、哪个季度
  - 产出了哪些图
  - 如有必要，说明是否使用了官方最新披露

## 项目路径

- `/Users/coattail/Documents/New project/Earnings-Image-Studio`

## 推荐流程

### 1. 先面向结果理解任务

- 把用户请求理解为“直接生成目标公司图表”。
- 如果用户要求“最新季度”，先确认最新官方披露季度；确认后直接生成，不要先汇报公司是否存在于本地默认池。
- 如果本地没有该公司现成数据，优先走单公司解析/补构建路径；这是内部动作，不需要在进度里反复向用户解释。

### 2. 默认走单公司直出快路径

默认不要先启动浏览器、`http.server`、CDP 或 Playwright。优先直接调用单公司脚本，一次完成：

- 公司解析
- 单公司 payload 构建
- JS runtime 直渲染 SVG
- SVG 转 PNG

最新季度默认示例：

```bash
"/Users/coattail/Documents/New project/Earnings-Image-Studio/.venv/bin/python" \
  "/Users/coattail/Documents/New project/Earnings-Image-Studio/scripts/render_company_charts.py" \
  --company "IBM" \
  --quarter latest \
  --language zh \
  --modes sankey,bars
```

指定季度示例：

```bash
"/Users/coattail/Documents/New project/Earnings-Image-Studio/.venv/bin/python" \
  "/Users/coattail/Documents/New project/Earnings-Image-Studio/scripts/render_company_charts.py" \
  --company "Amazon" \
  --quarter 2025Q4 \
  --language zh \
  --modes sankey,bars \
  --output-dir "/Users/coattail/Documents/New project/Earnings-Image-Studio/output/direct-renders"
```

仅在以下情况才退回浏览器路径：

- 需要人工校准或对照网页 UI 调样式
- 直渲染脚本失败，且需要诊断 JS 页面态问题
- 用户明确要求打开网页预览

### 3. 内部构建或刷新数据

如果用户明确要求全量更新数据集，再运行：

```bash
"/Users/coattail/Documents/New project/Earnings-Image-Studio/.venv/bin/python" \
  "/Users/coattail/Documents/New project/Earnings-Image-Studio/scripts/build_dataset.py"
```

强制刷新远程缓存：

```bash
"/Users/coattail/Documents/New project/Earnings-Image-Studio/.venv/bin/python" \
  "/Users/coattail/Documents/New project/Earnings-Image-Studio/scripts/build_dataset.py" --refresh
```

只刷新指定公司：

```bash
"/Users/coattail/Documents/New project/Earnings-Image-Studio/.venv/bin/python" \
  "/Users/coattail/Documents/New project/Earnings-Image-Studio/scripts/build_dataset.py" --refresh --companies nvda,aapl,googl
```

### 4. 浏览器预览（仅兜底）

```bash
python3 -m http.server 9036 --directory "/Users/coattail/Documents/New project/Earnings-Image-Studio"
```

打开：

- `http://127.0.0.1:9036`

### 5. 增量检测新财报（可选）

```bash
"/Users/coattail/Documents/New project/Earnings-Image-Studio/.venv/bin/python" \
  "/Users/coattail/Documents/New project/Earnings-Image-Studio/scripts/check_for_updates.py"
```

## 质量检查建议

- 优先查看 `data/earnings-dataset.json` 中公司季度是否完整
- 抽查目标季度是否包含：
  - `officialRevenueSegments` 或 `officialRevenueDetailGroups`
  - `officialCostBreakdown` / `officialOpexBreakdown` 或融合后的 `costBreakdown` / `opexBreakdown`
  - `fieldSources`、`parserDiagnostics` 与 `extractionDiagnostics`
- 若用户请求“最新季度”或“最新发布”，先确认最新官方披露后再构建

## 执行偏好

- 默认优先 `scripts/render_company_charts.py`，不要先走浏览器导出链路。
- 优先单公司完成用户请求，不要默认把任务扩展为“维护整个公司池”。
- 优先给用户成品图或明确的生成结果，不要把内部检查过程当成主要输出。
- 若必须做内部诊断，进度更新也应简短表述为“正在补齐目标公司数据并生成图表”，避免出现“默认公司池 / 已有数据集 / 当前榜单”之类措辞。
