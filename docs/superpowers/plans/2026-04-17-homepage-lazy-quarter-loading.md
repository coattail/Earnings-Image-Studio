# Homepage Lazy Quarter Loading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让首页首屏只加载公司索引与最新季度图表数据，非最新季度按公司懒加载完整历史，显著降低主站首屏等待时间。

**Architecture:** 构建阶段新增一个轻量索引公开文件，前端启动只读取这个索引。公司完整历史继续保存在现有 `data/cache/<company>.json` 中，并在用户查看历史季度时按需拉取、合并、缓存。

**Tech Stack:** Python 构建脚本、静态 JSON 数据、原生浏览器 `fetch`、现有前端状态管理

---

### Task 1: 生成首页轻量索引文件

**Files:**
- Modify: `scripts/prepare_pages_artifact.py`
- Modify: `scripts/build_dataset.py` 或相关数据导出脚本（若更适合在构建阶段直接生成）
- Test: `tests/test_pages_dataset_index.py`

- [ ] Step 1: 写一个失败测试，验证轻量索引只保留最新季度最小数据
- [ ] Step 2: 运行测试确认失败
- [ ] Step 3: 实现 `dataset-index.json` 生成逻辑
- [ ] Step 4: 运行测试确认通过

### Task 2: 首屏启动改用轻量索引

**Files:**
- Modify: `js/app-04-bootstrap.js`
- Modify: `js/app-03-data.js`
- Test: `tests/test_frontend_bootstrap_dataset_index.py`

- [ ] Step 1: 写失败测试，验证启动时请求 `dataset-index.json` 而不是全量 `earnings-dataset.json`
- [ ] Step 2: 运行测试确认失败
- [ ] Step 3: 改造 `loadDataset()` 与初始化流程，使用轻量索引建立公司列表和默认选择
- [ ] Step 4: 运行测试确认通过

### Task 3: 为历史季度引入按公司懒加载

**Files:**
- Modify: `js/app-03-data.js`
- Modify: `js/app-04-bootstrap.js`
- Test: `tests/test_lazy_company_history_loading.py`

- [ ] Step 1: 写失败测试，验证查看最新季度不会触发完整公司请求，切换到历史季度才会触发
- [ ] Step 2: 运行测试确认失败
- [ ] Step 3: 实现 `ensureCompanyHistoricalDataLoaded()` 一类的按需加载与内存缓存逻辑
- [ ] Step 4: 运行测试确认通过

### Task 4: 回归验证特殊公司与页面构建

**Files:**
- Modify: `tests/test_supplemental_components_tsmc.py`（如需补断言）
- Modify: `tests/test_bar_history_window_counts.py`（如需补断言）

- [ ] Step 1: 运行与台积电、30 季历史窗口、首页构建相关的回归测试
- [ ] Step 2: 构建 Pages 产物，确认 `dist/data/dataset-index.json` 存在
- [ ] Step 3: 手工核对台积电最新季度仍为 `2026Q1` 且含 `研发 / 销售及管理费用`
- [ ] Step 4: 提交改动
