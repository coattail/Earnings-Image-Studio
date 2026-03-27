---
name: earnings-image-studio
description: 使用 Earnings-Image-Studio 刷新财报可视化数据集，并基于本地前端渲染器生成或预览营收与开支桥图。适用于需要官方财报解析、来源诊断和稳定布局输出的场景。
---

# Earnings Image Studio

使用本项目作为财报可视化 skill 入口。渲染与布局沿用 `Earnings-Image-Studio`，解析层采用融合方案（`universal_parser` + `extraction_engine` + 多适配器）。

## 项目路径

- `/Users/coattail/Documents/New project/Earnings-Image-Studio`

## 推荐流程

### 1. 刷新数据集

全量刷新：

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

### 2. 本地预览渲染结果

```bash
python3 -m http.server 9036 --directory "/Users/coattail/Documents/New project/Earnings-Image-Studio"
```

打开：

- `http://127.0.0.1:9036`

### 3. 增量检测新财报（可选）

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
