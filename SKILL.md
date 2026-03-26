---
name: earnings-image-studio
description: 使用 earnings-image-studio 刷新财报可视化数据集，并基于本地前端渲染器生成/预览营收与开支桥图。适用于需要官方财报解析、来源诊断和布局稳定输出的场景。
---

# Earnings Image Studio

使用本项目作为财报可视化 skill 入口。渲染与布局完全沿用 `earnings-image-studio`，解析层采用融合方案（`universal_parser` + `extraction_engine` + 多适配器）。

## 项目路径

- `/Users/yuwan/Documents/New project/earnings-image-studio`

## 推荐流程

### 1. 刷新数据集

全量刷新：

```bash
python3 "/Users/yuwan/Documents/New project/earnings-image-studio/scripts/build_dataset.py"
```

强制刷新远程缓存：

```bash
python3 "/Users/yuwan/Documents/New project/earnings-image-studio/scripts/build_dataset.py" --refresh
```

只刷新指定公司：

```bash
python3 "/Users/yuwan/Documents/New project/earnings-image-studio/scripts/build_dataset.py" --refresh --companies nvda,aapl,googl
```

### 2. 本地预览渲染结果

```bash
python3 -m http.server 9036 --directory "/Users/yuwan/Documents/New project/earnings-image-studio"
```

打开：

- `http://127.0.0.1:9036`

### 3. 增量检测新财报（可选）

```bash
python3 "/Users/yuwan/Documents/New project/earnings-image-studio/scripts/check_for_updates.py"
```

## 质量检查建议

- 优先查看 `data/earnings-dataset.json` 中公司季度是否完整
- 抽查目标季度是否包含：
  - `officialRevenueSegments` 或 `officialRevenueDetailGroups`
  - `officialCostBreakdown` / `officialOpexBreakdown` 或融合后的 `costBreakdown` / `opexBreakdown`
  - `fieldSources` 与 `extractionDiagnostics`
- 若用户请求“最新季度”或“最新发布”，先确认最新官方披露后再构建
