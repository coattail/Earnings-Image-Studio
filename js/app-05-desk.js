/* Product UI around the existing financial normalization and SVG renderers. */
(function initializeDesk(globalScope) {
  "use strict";
  const STORAGE_KEY = "earnings-desk.preferences.v1";
  const DRAFT_KEY = "earnings-desk.layouts.v1";
  const $ = (id) => document.getElementById(id);
  const esc = (value) => escapeHtml(value);
  const financialFields = [
    ["营收", "revenueBn", "revenueBn"],
    ["营收成本", "costOfRevenueBn", "costOfRevenueBn"],
    ["毛利润", "grossProfitBn", "grossProfitBn"],
    ["营业费用", "operatingExpensesBn", "operatingExpensesBn"],
    ["营业利润", "operatingIncomeBn", "operatingProfitBn"],
    ["营业外净额", "nonOperatingBn", "nonOperatingBn"],
    ["税前利润", "pretaxIncomeBn", "pretaxIncomeBn"],
    ["所得税", "taxBn", "taxBn"],
    ["净利润", "netIncomeBn", "netProfitBn"],
  ];
  const issueLabels = {
    "revenue-segment-coverage-low": "营收分部覆盖不足",
    "cost-breakdown-coverage-low": "成本分类覆盖不足",
    "opex-breakdown-coverage-low": "营业费用分类覆盖不足",
    "missing-revenue": "缺少营收",
    "missing-net-income": "缺少净利润",
  };
  const ui = {
    favorites: new Set(), onlyFavorites: false, table: false, busy: true,
    history: null, rows: [], headers: [], snapshot: null, company: null,
    undo: {}, redo: {}, toastTimer: null, initialized: false, exportBusy: false,
  };
  function number(value) {
    if (value === null || value === undefined || value === "" || typeof value === "boolean") return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  function decimal(value, digits = 2) {
    const n = number(value);
    return n === null ? "—" : n.toLocaleString("zh-CN", { maximumFractionDigits: digits });
  }
  function percent(value) { return number(value) === null ? "—" : `${decimal(value, 1)}%`; }
  function safeUrl(value) {
    try {
      const url = new URL(String(value));
      return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.href : null;
    } catch (_) { return null; }
  }
  function readStorage(key) {
    try { const value = JSON.parse(globalScope.localStorage?.getItem(key) || "null"); return isPlainObject(value) ? value : {}; }
    catch (_) { return {}; }
  }
  function writeStorage(key, payload) {
    try { globalScope.localStorage?.setItem(key, JSON.stringify(payload)); } catch (_) { /* Storage may be disabled. */ }
  }
  function toast(message) {
    const node = $("toast");
    if (!node) return;
    node.textContent = message;
    node.hidden = false;
    clearTimeout(ui.toastTimer);
    ui.toastTimer = setTimeout(() => { node.hidden = true; }, 3500);
  }
  function persist() {
    if (!state.selectedCompanyId || !state.selectedQuarter) return;
    const selection = {
      company: state.selectedCompanyId, quarter: state.selectedQuarter,
      view: currentChartViewMode(), lang: currentChartLanguage(),
      range: state.historyRange || 30, basis: state.barHistoryBasis || "recast", table: ui.table,
    };
    writeStorage(STORAGE_KEY, { ...selection, favorites: [...ui.favorites], keepQuarter: !!state.keepQuarterOnCompanySwitch });
    try {
      const url = new URL(globalScope.location.href);
      url.searchParams.set("company", selection.company);
      url.searchParams.set("quarter", selection.quarter);
      url.searchParams.set("view", selection.view);
      url.searchParams.set("lang", selection.lang);
      if (selection.view === "bars") url.searchParams.set("range", selection.range); else url.searchParams.delete("range");
      if (selection.view === "bars" && canUseRecastBarHistory(ui.company, state.selectedQuarter)) url.searchParams.set("basis", selection.basis); else url.searchParams.delete("basis");
      if (ui.table) url.searchParams.set("table", "1"); else url.searchParams.delete("table");
      globalScope.history.replaceState(null, "", url);
    } catch (_) { /* Rendering also works without URL/history access. */ }
  }
  function selectionFrom(saved, params) {
    // A shared selection takes precedence over every saved selection field.
    const hasSharedSelection = ["company", "quarter", "view", "lang", "range", "basis", "table"].some((key) => params.has(key));
    const input = hasSharedSelection ? Object.fromEntries(params) : saved;
    return {
      company: String(input.company || ""), quarter: String(input.quarter || ""),
      view: input.view === "bars" ? "bars" : "sankey", lang: input.lang === "en" ? "en" : "zh",
      range: [8, 12, 30].includes(Number(input.range)) ? Number(input.range) : 30,
      basis: input.basis === "reported" ? "reported" : "recast",
      table: input.table === true || input.table === "1",
    };
  }
  function restore() {
    const saved = readStorage(STORAGE_KEY);
    let params = new URLSearchParams();
    try { params = new URL(globalScope.location.href).searchParams; } catch (_) {}
    const selection = selectionFrom(saved, params);
    const company = getCompany(selection.company) || getCompany(state.selectedCompanyId);
    if (!company) return;
    state.selectedCompanyId = company.id;
    state.selectedQuarter = renderableQuarterKeys(company).includes(selection.quarter) ? selection.quarter : null;
    state.chartViewMode = selection.view;
    state.uiLanguage = selection.lang;
    state.historyRange = selection.range;
    state.barHistoryBasis = selection.basis;
    state.keepQuarterOnCompanySwitch = saved.keepQuarter === true;
    ui.table = selection.table;
    ui.favorites = new Set((Array.isArray(saved.favorites) ? saved.favorites : []).filter((id) => typeof id === "string" && getCompany(id)));
    if ($("historyRangeSelect")) $("historyRangeSelect").value = String(state.historyRange);
    if ($("barBasisSelect")) $("barBasisSelect").value = state.barHistoryBasis;
    if ($("keepQuarterCheckbox")) $("keepQuarterCheckbox").checked = state.keepQuarterOnCompanySwitch;
    const drafts = readStorage(DRAFT_KEY);
    state.editor.overridesBySession = Object.fromEntries(Object.entries(drafts).slice(-120).filter(([key]) => /^[-a-z0-9]+::\d{4}Q[1-4]::sankey$/.test(key)).map(([key, values]) => [key, sanitizeEditorNodeOverrides(values)]));
  }
  function marketCapLabel(company) {
    const cap = number(company.marketCapUsd);
    if (!(cap > 0)) return "市值暂无";
    return `市值 $${decimal(cap / (cap >= 1e12 ? 1e12 : 1e9), 2)}${cap >= 1e12 ? "T" : "B"}`;
  }
  function renderCompanyList() {
    if (!refs.companyList) return;
    const search = String(refs.companySearch?.value || "").trim().toLowerCase();
    const matches = companies().filter((company) => (!ui.onlyFavorites || ui.favorites.has(company.id)) && (!search || companySearchValue(company).includes(search)));
    state.filteredCompanyIds = matches.map((company) => company.id);
    refs.companyList.innerHTML = matches.length ? matches.map((company) => {
      const active = company.id === state.selectedCompanyId;
      const favorite = ui.favorites.has(company.id);
      const color = /^#[0-9a-f]{6}$/i.test(company.brand?.primary || "") ? company.brand.primary : "#376e67";
      const name = company.nameZh || company.nameEn || company.ticker;
      const asset = getLogoAsset(company.id);
      const logoUrl = /^data:image\/(?:png|jpeg|webp|svg\+xml);base64,/i.test(asset?.dataUrl || "") ? asset.dataUrl : null;
      const wordmark = number(asset?.width) > number(asset?.height) * 2;
      const avatar = `<span class="company-avatar${logoUrl ? " has-logo" : ""}" style="--avatar-color:${color};--avatar-bg:${color}12" aria-hidden="true">${logoUrl ? `<img class="company-logo${wordmark ? " is-wordmark" : ""}" src="${esc(logoUrl)}" alt="" decoding="async" />` : ""}<span class="company-logo-fallback">${esc(String(company.ticker).slice(0, 3))}</span></span>`;
      return `<div class="company-row${active ? " is-active" : ""}"><button class="company-card" type="button" data-company-id="${esc(company.id)}" aria-pressed="${active}">${avatar}<span class="company-info"><span class="company-title">${esc(name)}</span><span class="company-subtitle">#${company.rank}<span class="dot">·</span>${esc(company.ticker)}<span class="dot">·</span>${company.coverage?.quarterCount || company.quarters?.length || 0} 期财报</span><span class="company-subtitle company-market-cap" title="${esc(company.marketCapAsOf ? `美元市值 · ${company.marketCapAsOf} · ${company.marketCapSource || ""}` : "暂无可用美元市值")}">${marketCapLabel(company)}</span></span></button><button class="favorite-btn${favorite ? " is-favorite" : ""}" type="button" data-favorite-id="${esc(company.id)}" aria-label="${favorite ? "取消收藏" : "收藏"}${esc(name)}" aria-pressed="${favorite}">${favorite ? "★" : "☆"}</button></div>`;
    }).join("") : `<div class="empty-companies"><strong>${search ? "没有找到匹配公司" : "还没有收藏公司"}</strong><p>${search ? "试试中文名、英文名或股票代码" : "点击公司旁的 ☆，建立常看列表"}</p><button type="button" data-clear-filters>查看全部公司</button></div>`;
    const dates = [...new Set(companies().map(company => company.marketCapAsOf).filter(Boolean))].sort();
    if ($("companySortStatus")) $("companySortStatus").textContent = `市值降序${dates.length ? ` · 更新 ${dates[0]}${dates.length > 1 ? `—${dates.at(-1)}` : ""}` : " · 暂无市值数据"}`;
    if ($("companyResults")) $("companyResults").textContent = `找到 ${matches.length} 家公司`;
    if ($("favoriteCount")) $("favoriteCount").textContent = ui.favorites.size;
    ["allCompaniesBtn", "favoriteCompaniesBtn"].forEach((id, index) => {
      $(id)?.classList.toggle("is-active", index === Number(ui.onlyFavorites));
      $(id)?.setAttribute("aria-pressed", String(index === Number(ui.onlyFavorites)));
    });
  }
  function syncCompany() {
    refs.companyList?.querySelectorAll("[data-company-id]").forEach((node) => {
      const active = node.getAttribute("data-company-id") === state.selectedCompanyId;
      node.classList.toggle("is-active", active);
      node.setAttribute("aria-pressed", String(active));
      node.closest(".company-row")?.classList.toggle("is-active", active);
    });
    if ($("mobileCompanyName")) $("mobileCompanyName").textContent = getCompany(state.selectedCompanyId)?.nameZh || "选择公司";
    if (globalScope.matchMedia?.("(max-width: 760px)").matches) {
      document.querySelector(".controls")?.classList.remove("is-open");
      $("mobileCompanyToggle")?.setAttribute("aria-expanded", "false");
    }
  }
  function setBusy(busy) {
    ui.busy = busy;
    $("chartPanel")?.setAttribute("aria-busy", String(busy));
    document.querySelector(".chart-zone")?.classList.toggle("is-loading", busy);
    syncExportButtons();
  }
  function syncExportButtons() {
    ["downloadSvgBtn", "downloadPngBtn", "downloadHdBtn", "downloadCsvBtn", "editImageBtn", "dataViewBtn", "shareViewBtn", "openSourcesBtn"].forEach((id) => {
      if ($(id)) $(id).disabled = ui.busy || ui.exportBusy || !ui.snapshot || (id === "editImageBtn" && !isInteractiveSankeyEditable());
    });
  }
  function fail(message) {
    ui.snapshot = null; ui.rows = []; ui.headers = [];
    state.currentSnapshot = null;
    const selected = getCompany(state.selectedCompanyId);
    if (selected && refs.chartTitle) refs.chartTitle.textContent = `${selected.nameZh || selected.nameEn} · ${state.selectedQuarter || "报告期"}`;
    if (refs.chartMeta) refs.chartMeta.textContent = "数据暂不可用";
    setBusy(false);
    if ($("chartError")) $("chartError").hidden = false;
    if ($("chartErrorText")) $("chartErrorText").textContent = message || "请检查网络连接后重试，或选择其他报告期。";
    document.querySelector(".preview-stage")?.setAttribute("hidden", "");
    for (const id of ["dataTablePanel", "mobileProfitChain", "sourceDetails"]) if ($(id)) $(id).hidden = true;
    if ($("insightStrip")) $("insightStrip").innerHTML = "";
    if ($("dataTableOutput")) $("dataTableOutput").innerHTML = "";
    ["kpiRevenueValue", "kpiGrossMarginValue", "kpiOperatingMarginValue", "kpiNetMarginValue", "kpiRevenueDelta", "kpiGrossMarginDelta", "kpiOperatingMarginDelta", "kpiNetMarginDelta"].forEach((id) => { if ($(id)) $(id).textContent = "—"; });
  }
  function chartTitle(snapshot, company) {
    return `${company.nameZh || company.nameEn} · ${snapshot.fiscalLabel || snapshot.quarterKey}`;
  }
  function insights(snapshot) {
    const result = [];
    const yoy = number(snapshot.revenueYoyPct);
    if (yoy !== null) result.push(`营收同比<strong>${yoy >= 0 ? "增长" : "下降"} ${decimal(Math.abs(yoy), 1)}%</strong>`);
    const groups = (snapshot.businessGroups || []).filter((row) => number(row.valueBn) !== null).slice().sort((a, b) => Number(b.valueBn) - Number(a.valueBn));
    const top = groups[0];
    if (groups.length > 1 && number(snapshot.revenueBn) > 0 && top && top.valueBn <= snapshot.revenueBn * 1.01) {
      const label = top.nameZh || translateBusinessLabelToZh(top.name || "") || top.name;
      result.push(`${esc(label)}占营收 <strong>${percent(top.valueBn / snapshot.revenueBn * 100)}</strong>`);
    }
    const delta = number(snapshot.operatingMarginYoyDeltaPp);
    if (delta !== null) result.push(`经营利润率同比<strong>${delta >= 0 ? "提高" : "下降"} ${decimal(Math.abs(delta), 1)} 个百分点</strong>`);
    return result.slice(0, 3);
  }
  function evidenceWarnings(snapshot, company, history) {
    const entry = company.financials?.[snapshot.quarterKey] || {};
    const warnings = [];
    const groups = [...(snapshot.businessGroups || []), ...(snapshot.leftDetailGroups || []).flatMap((group) => group.items || [])];
    if (groups.some((row) => row.inferredFromQuarter)) warnings.push("部分业务金额按邻近报告期的结构推算，不属于当期直接披露。请结合原始财报核验。");
    if (groups.some((row) => row.syntheticResidual)) warnings.push("部分业务金额由营收合计减去已披露分部计算得到，属于差额补齐。");
    if (/history-harmonized/i.test(snapshot.sourceLabel || "")) warnings.push("当前业务结构使用历史分类对齐或回填；图中分类不一定等同于当期原始披露名称。");
    if (snapshot.operatingExpensesSourceReliable === false || snapshot.nonOperatingSourceReliable === false) warnings.push("部分利润桥项目由财务恒等式对账计算，未直接采用原始字段。数据表可对照原始值与图中金额。");
    if (snapshot.bridgeCoverageMode === "revenue-only") warnings.push("本期利润项目不完整，图表仅展示可用的营收数据。");
    if (entry.statementPresentationNote) warnings.push(entry.statementPresentationNote);
    if (snapshot.usesFxConversion) warnings.push(`金额已由 ${snapshot.sourceCurrency} 折算为 ${snapshot.displayCurrency}，比例系数 ${decimal(snapshot.displayScaleFactor, 6)}。数据中未明确提供汇率的日期及类型。`);
    if (history?.convertedQuarterCount > 0) warnings.push(`历史图有 ${history.convertedQuarterCount} 个报告期经过币种换算；不同期间的折算会影响增长比较。`);
    if (history?.imputedQuarterCount > 0 || history?.smoothedQuarterCount > 0 || history?.quarters?.some((quarter) => quarter.isBackfilledSegments)) warnings.push("历史图部分报告期包含结构推算、平滑或历史回填，不能视作全部来自当期直接披露。相关变化仅供对照原文。\n");
    if (history?.missingQuarterCount > 0) warnings.push(`历史窗口内 ${history.missingQuarterCount} 个报告期缺少可用数据，图表连续不代表原始披露完整。`);
    if (history?.basis === "recast") warnings.push(history.basisNoteZh);
    else if (!history && snapshot.revenueRestatementNote) warnings.push(snapshot.revenueRestatementNote);
    else if (history?.taxonomyBreaks?.length || entry.officialRevenueTaxonomyChangedFromPreviousQuarter || entry.officialRevenueTaxonomyChangedFromPriorYear) warnings.push("业务分类在历史期间发生变化，趋势图按可比较分类归并；比较时请留意口径变化。");
    const meta = entry.statementMeta || {};
    if (number(entry.statementSpanQuarters || meta.statementSpanQuarters || meta.spanQuarters) > 1) warnings.push(`本期原始期间覆盖 ${entry.statementSpanQuarters || meta.statementSpanQuarters || meta.spanQuarters} 个季度，请勿将累计值与单季值直接比较。`);
    return warnings;
  }
  function fieldSourceRows(entry) {
    return Object.entries(entry.fieldSources || {}).flatMap(([field, value]) => (Array.isArray(value) ? value : [value]).map((info) => ({ field, info: isPlainObject(info) ? info : { label: String(info || "未标明") } })));
  }
  function collectSources(entry, company, snapshot) {
    const output = new Map();
    const add = (url, label, exact = false) => {
      const href = safeUrl(url);
      if (href && !output.has(href)) output.set(href, { href, label, exact });
    };
    add(entry.statementSourceUrl, "本期财务数据来源", true);
    add(snapshot.revenueRestatementSourceUrl, "官方业务收入历史重列（第 15、17 页）", true);
    (Array.isArray(entry.statementSourceUrls) ? entry.statementSourceUrls : []).forEach((url) => add(url, "单季计算依据", true));
    fieldSourceRows(entry).forEach(({field, info}) => add(info?.sourceUrl, info?.label || field, true));
    [...(entry.officialRevenueSegments || []), ...(entry.officialRevenueDetailGroups || []).flatMap((group) => group.items || [])].forEach((row) => add(row.sourceUrl, row.periodEnd && row.periodEnd !== entry.periodEnd ? `业务分部披露（截至 ${row.periodEnd}）` : "业务分部披露", !row.periodEnd || row.periodEnd === entry.periodEnd));
    if (!output.size) add(company.statementSourceUrl, "公司财务数据入口（非本期原文）", false);
    return [...output.values()].slice(0, 8);
  }
  function sourcePanel(snapshot, company, history) {
    const entry = company.financials?.[snapshot.quarterKey] || {};
    const meta = entry.statementMeta || {};
    const sources = collectSources(entry, company, snapshot);
    if (history?.recastSourceUrl) sources.unshift({ href: history.recastSourceUrl, label: "官方历史分部重列（第 15 页）", exact: true });
    const warnings = evidenceWarnings(snapshot, company, history);
    const sourceCurrency = entry.statementCurrency || snapshot.sourceCurrency || company.reportingCurrency || "未标明";
    const mode = entry.statementValueMode || meta.statementValueMode || meta.valueMode || "";
    const span = number(entry.statementSpanQuarters || meta.statementSpanQuarters || meta.spanQuarters);
    const periodMode = span > 1 ? `累计 ${span} 季` : /derived/i.test(mode) ? "单季（由累计值计算）" : /quarter|discrete|single/i.test(mode) || span === 1 ? "单季" : "未明确标注单季 / 累计";
    const standard = entry.accountingStandard || meta.accountingStandard || "原始数据未标明，见披露原文";
    $("sourceSummary").textContent = `${sources.some((item) => item.exact) ? "已关联本期数据来源" : "本期原文待补充"} · ${warnings.length ? `${warnings.length} 项口径提示` : "可展开核验"}`;
    const facts = [["报告期间", `${entry.fiscalLabel || snapshot.quarterKey} · 截至 ${entry.periodEnd || "未标明"}`], ["期间口径", periodMode], ["披露币种 / 显示币种", `${sourceCurrency} / ${snapshot.displayCurrency || "USD"}`], ["会计准则", standard], ["披露日期", entry.statementFilingDate || meta.filingDate || "未提供"], ["数据集生成时间", `${formatDatasetGeneratedAt(state.dataset?.generatedAt)}（本机时区）`]];
    $("sourceOverview").innerHTML = facts.map(([label, value]) => `<div class="source-fact"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join("");
    $("sourceLinks").innerHTML = sources.length ? sources.map((source) => `<a class="source-link" href="${esc(source.href)}" target="_blank" rel="noopener noreferrer">${esc(source.label)} ↗</a>`).join("") : '<p class="analysis-hint">本期没有可用的原文链接，建议在公司投资者关系页面核验。</p>';
    $("sourceWarnings").innerHTML = warnings.map((warning) => `<p>${esc(warning)}</p>`).join("");
    const fieldNames = Object.fromEntries(financialFields.map(([label, raw]) => [raw, label]));
    const fields = fieldSourceRows(entry);
    $("fieldSourceTable").innerHTML = fields.length ? `<table><caption>数据构建时记录的字段来源</caption><thead><tr><th scope="col">字段</th><th scope="col">来源记录</th><th scope="col">原文</th></tr></thead><tbody>${fields.map(({field, info}) => `<tr><th scope="row">${esc(fieldNames[field] || field)}</th><td>${esc(info?.label || info?.adapterId || "未标明")}</td><td>${safeUrl(info?.sourceUrl) ? `<a href="${esc(safeUrl(info.sourceUrl))}" target="_blank" rel="noopener noreferrer">查看 ↗</a>` : "未提供链接"}</td></tr>`).join("")}</tbody></table>` : '<p class="analysis-hint">本期没有逐字段来源记录。</p>';
    const diagnostic = entry.extractionDiagnostics;
    const issues = Array.isArray(diagnostic?.issues) ? diagnostic.issues : [];
    $("diagnosticsNote").textContent = diagnostic ? `构建时解析检查${issues.length ? `记录：${issues.map((issue) => issueLabels[issue] || issue).join("；")}` : "未记录问题"}。该记录可能早于后续补充数据，不代表财报审计意见或数据准确率。` : "本期没有解析检查记录。未记录问题不代表数据已通过人工核验。";
  }
  function buildTable(snapshot, company, history) {
    if (history) {
      const segments = history.segmentStats || [];
      const headers = ["报告期", "财季", "显示币种", "营收合计（十亿）", ...segments.map((item) => item.nameZh || item.name || item.key), "数据状态"];
      const rows = history.quarters.map((quarter) => {
        const missing = quarter.hasRevenueValue === false || quarter.isMissingQuarterData;
        const status = missing ? "本期数据缺失" : history.basis === "recast" ? (quarter.quarterKey < history.recastFirstQuarter ? "原始披露（原分类）" : quarter.quarterKey <= "2026Q2" ? "官方历史重列" : "当期披露（新口径）") : quarter.isImputedSegments ? "包含推算分类" : quarter.isBackfilledSegments ? "包含历史回填" : quarter.isSmoothedSegments ? "包含平滑处理" : "按图表可比口径整理";
        return [quarter.quarterKey, quarter.entry?.fiscalLabel || quarter.label || "", quarter.displayCurrency || history.primaryDisplayCurrency || "USD", missing ? null : number(quarter.totalRevenueBn), ...segments.map((segment) => missing ? null : number(quarter.segmentMap?.[segment.key])), status];
      });
      return { headers, rows, caption: `${company.nameZh || company.nameEn} · 当前窗口分部营收`, note: history.basis === "recast" ? `金额单位为十亿美元。${history.basisNoteZh}；历史季度不作删除或推算。` : "金额单位为十亿；币种见各行。业务分类与图表一致，可能经过历史分类归并、差额补齐或换算；空白表示该分部本期无可用金额。" };
    }
    const entry = resolveSankeyFinancialEntry(company.financials?.[snapshot.quarterKey]) || {};
    const scale = number(snapshot.displayScaleFactor) || 1;
    const headers = ["财务项目", `原始数据（${entry.statementCurrency || snapshot.sourceCurrency || "USD"} 十亿）`, `图中金额（${snapshot.displayCurrency || "USD"} 十亿）`, "处理说明"];
    const rows = financialFields.map(([label, rawKey, displayKey]) => {
      if (entry.costOfRevenuePresentationOnly && rawKey === "costOfRevenueBn") return [label, null, null, "未单独披露，合并列入营业费用"];
      if (entry.costOfRevenuePresentationOnly && rawKey === "grossProfitBn") return ["营业费用扣除前收入", null, number(snapshot[displayKey]) * scale, "绘图承接营收，非已披露毛利"];
      const raw = number(entry[rawKey]);
      const snapshotRaw = number(snapshot[displayKey]);
      const shown = snapshotRaw === null ? null : snapshotRaw * scale;
      const differs = raw !== null && shown !== null && Math.abs(raw * scale - shown) > Math.max(.001, Math.abs(shown) * .0001);
      const provenance = entry.fieldSources?.[rawKey];
      const sourceDerived = /derived|inferred|residual|reconcil/i.test(`${provenance?.adapterId || ""} ${provenance?.label || ""} ${entry.statementValueMode || ""}`);
      const treatment = raw === null ? (shown === null ? "未提供" : "计算 / 对账补齐") : differs ? "已对账调整，见原始数据" : sourceDerived ? "数据处理后字段，见来源" : "取自数据集字段";
      return [label, raw, shown, treatment];
    });
    for (const group of snapshot.businessGroups || []) {
      const raw = (entry.officialRevenueSegments || []).find((item) => (item.memberKey && item.memberKey === group.memberKey) || item.name === group.name);
      const value = number(group.valueBn);
      const treatment = group.inferredFromQuarter ? `按 ${group.inferredFromQuarter} 结构推算` : group.syntheticResidual ? "由营收差额计算" : snapshot.revenueBasis === "official-recast" ? "官方历史重列（第 15 页）" : /history-harmonized/i.test(snapshot.sourceLabel || "") ? "历史分类归并 / 回填" : raw ? "业务分类，见原文核验" : "图中业务分类，见来源";
      rows.push([`业务 · ${group.nameZh || group.name}`, number(raw?.valueBn), value === null ? null : value * scale, treatment]);
    }
    if (snapshot.revenueBasis === "official-recast") {
      for (const detail of snapshot.leftDetailGroups || []) {
        const raw = entry.officialRevenueDetailGroups.find((row) => row.memberKey === detail.id);
        rows.push([`业务明细 · ${detail.nameZh || detail.name}`, number(raw?.valueBn), number(detail.valueBn) * scale, "官方历史重列（第 17 页）"]);
      }
    }
    return { headers, rows, caption: `${company.nameZh || company.nameEn} · ${snapshot.fiscalLabel} 财务数据对照`, note: "单位为十亿（B）。原始数据指本项目数据集中的字段，不保证等同于财报直接披露值；图中金额可能经过币种折算或对账计算。具体依据请查看下方来源记录。" };
  }
  function renderTable(snapshot, company, history) {
    const payload = buildTable(snapshot, company, history);
    ui.rows = payload.rows; ui.headers = payload.headers;
    $("dataTableOutput").innerHTML = `<table><caption>${esc(payload.caption)}</caption><thead><tr>${payload.headers.map((label, index) => `<th scope="col"${index > 0 ? ' class="numeric"' : ""}>${esc(label)}</th>`).join("")}</tr></thead><tbody>${payload.rows.map((row) => `<tr>${row.map((value, index) => index === 0 ? `<th scope="row">${esc(value)}</th>` : `<td${typeof value === "number" ? ' class="numeric"' : ""}>${esc(typeof value === "number" ? decimal(value, 3) : value ?? "—")}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
    $("dataTableNote").textContent = payload.note;
  }
  function csvText(headers, rows) {
    const cell = (value) => {
      const raw = value === null || value === undefined ? "" : String(value);
      // Keep numeric negatives numeric; escape formula-like external strings.
      const text = typeof value === "string" && /^[\s]*[=+\-@]/.test(raw) ? `'${raw}` : raw;
      return `"${text.replaceAll('"', '""')}"`;
    };
    return "\uFEFF" + [headers, ...rows].map((row) => row.map(cell).join(",")).join("\r\n");
  }
  function exportCsv() {
    if (ui.busy || !ui.rows.length) return;
    downloadBlob(new Blob([csvText(ui.headers, ui.rows)], { type: "text/csv;charset=utf-8" }), `${currentFilenameStem()}-data.csv`);
    toast("当前视图数据已导出为 CSV");
    $("exportMenu").open = false;
  }
  let fitFrame = 0;
  function fitChartToWidth() {
    const canvas = $("previewCanvas");
    const panel = $("chartPanel");
    const svg = refs.chartOutput?.querySelector("svg");
    if (!canvas || !panel || !svg) return;
    if (globalScope.matchMedia?.("(max-width: 760px)").matches) {
      delete canvas.dataset.viewportFit;
      canvas.style.removeProperty("--preview-fit-height");
      return;
    }
    if (ui.table || panel.matches(":fullscreen") || panel.classList.contains("is-expanded")) return;
    const bounds = canvas.getBoundingClientRect();
    const viewBox = String(svg.getAttribute("viewBox") || "").trim().split(/\s+/).map(Number);
    if (viewBox.length !== 4 || !(viewBox[2] > 0) || !(viewBox[3] > 0) || !(bounds.width > 0)) return;
    const naturalHeight = bounds.width * viewBox[3] / viewBox[2];
    // Scale the complete original chart to the available width. Capping its
    // height to the screen creates side gutters and shrinks every chart mark.
    canvas.style.setProperty("--preview-fit-height", `${naturalHeight}px`);
    canvas.dataset.viewportFit = "true";
  }
  function queueChartFit() {
    if (fitFrame) return;
    const schedule = globalScope.requestAnimationFrame || ((fn) => setTimeout(fn, 0));
    fitFrame = schedule(() => { fitFrame = 0; fitChartToWidth(); });
  }
  function revealChartIfNeeded() {
    if (globalScope.matchMedia?.("(max-width: 760px)").matches) return;
    const panel = $("chartPanel");
    if (!panel || panel.matches(":fullscreen") || panel.classList.contains("is-expanded")) return;
    const bounds = panel.getBoundingClientRect();
    if (bounds.top < 0 || bounds.bottom > globalScope.innerHeight + 2) $("analysis")?.scrollIntoView({ block: "start", behavior: "auto" });
  }
  function syncViews() {
    const bars = currentChartViewMode() === "bars";
    if ($("chartPanel")) $("chartPanel").dataset.view = bars ? "bars" : "sankey";
    for (const [id, active] of [["sankeyTab", !bars], ["barsTab", bars]]) {
      $(id)?.classList.toggle("is-active", active);
      $(id)?.setAttribute("aria-pressed", String(active));
    }
    if ($("historyRangeLabel")) $("historyRangeLabel").hidden = !bars;
    const recastCompany = !!BAR_RECAST_HISTORIES[ui.company?.id];
    if ($("barBasisLabel")) $("barBasisLabel").hidden = !bars || !recastCompany;
    if ($("barBasisSelect")) {
      $("barBasisSelect").value = ui.history?.basis === "recast" ? "recast" : "reported";
      $("barBasisSelect").querySelector('[value="recast"]').disabled = !canUseRecastBarHistory(ui.company, state.selectedQuarter);
    }
    if ($("dataViewBtn")) { $("dataViewBtn").textContent = ui.table ? "返回图表" : "数据表"; $("dataViewBtn").setAttribute("aria-pressed", String(ui.table)); }
    if ($("dataTablePanel")) $("dataTablePanel").hidden = !ui.table;
    const preview = document.querySelector(".preview-stage");
    if (preview) preview.hidden = ui.table;
    if ($("mobileProfitChain")) $("mobileProfitChain").hidden = bars || ui.table;
    if ($("chartEditGroup")) $("chartEditGroup").hidden = bars || ui.table;
    if ($("editingActions")) $("editingActions").hidden = !state.editor.enabled || bars || ui.table;
    if (refs.editImageBtn) refs.editImageBtn.textContent = state.editor.enabled ? "完成编辑" : "编辑排版";
    if (refs.resetImageBtn) refs.resetImageBtn.textContent = "重置排版";
    if ($("chartCaption")) $("chartCaption").textContent = bars ? `当前显示 ${ui.history?.quarters?.length || 0} 期 · ${ui.history?.basis === "recast" ? ui.history.basisNoteZh : "历史分类按可比口径归并"}` : "从业务营收，看到成本与利润的流向";
    syncUndoButtons();
    queueChartFit();
  }
  function setMode(mode) {
    if (mode === currentChartViewMode()) return;
    state.chartViewMode = mode;
    state.editor.enabled = false; state.editor.selectedNodeId = null; state.editor.dragging = null;
    requestRenderCurrent();
  }
  function refresh(snapshot, company, history) {
    if (!$("chartPanel")) return;
    ui.snapshot = snapshot; ui.company = company; ui.history = history;
    $("chartError").hidden = true; $("sourceDetails").hidden = false;
    refs.chartTitle.textContent = chartTitle(snapshot, company);
    $("companyTicker").textContent = `${company.ticker} / ${company.nameEn || company.nameZh}`;
    refs.chartMeta.textContent = currentChartViewMode() === "bars" ? "营收结构的长期变化" : "营收如何转化为利润";
    const entry = company.financials?.[snapshot.quarterKey] || {};
    refs.quarterHint.textContent = `报告期截至 ${entry.periodEnd || "未标明"} · 自然季度归类 ${snapshot.quarterKey}`;
    $("heroCoverageText").textContent = `${state.dataset?.companyCount || companies().length} 家公司 · 持续跟踪财报`;
    if (refs.companyCountPill) refs.companyCountPill.textContent = `${companies().length} 家`;
    $("toolbarUpdatedLabel").textContent = "数据集更新";
    $("toolbarUpdatedAt").setAttribute("datetime", state.dataset?.generatedAt || "");
    $("toolbarUpdatedAt").title = "数据集生成时间，不代表当前公司财报的发布日期；按本机时区显示";
    $("insightStrip").innerHTML = `<span class="insight-label">本期速览</span><div class="insight-items">${insights(snapshot).map((value) => `<span>${value}</span>`).join("") || "可用同比数据不足，查看下方本期数据"}</div>`;
    $("mobileProfitChain").innerHTML = [["营收", snapshot.revenueBn], ["毛利润", snapshot.grossProfitBn], ["营业利润", snapshot.operatingProfitBn], ["净利润", snapshot.netProfitBn]].map(([label, value]) => `<div class="profit-step"><span>${label}</span><strong>${number(value) === null ? "—" : esc(formatBillionsInCurrency(value * (number(snapshot.displayScaleFactor) || 1), snapshot.displayCurrency || "USD"))}</strong></div>`).join("");
    sourcePanel(snapshot, company, history);
    renderTable(snapshot, company, history);
    const svg = refs.chartOutput?.querySelector("svg");
    const viewBox = String(svg?.getAttribute("viewBox") || "").split(/\s+/).map(Number);
    $("exportDimensions").textContent = viewBox.length === 4 ? `原始画布 ${Math.round(viewBox[2])} × ${Math.round(viewBox[3])} px · 超清 3×` : "选择导出格式";
    const latest = renderableQuarterKeys(company).slice().sort((a, b) => quarterSortValue(b) - quarterSortValue(a))[0];
    $("latestQuarterBtn").disabled = state.selectedQuarter === latest;
    if (currentChartLanguage() === "zh") [refs.kpiRevenueDelta, refs.kpiGrossMarginDelta, refs.kpiOperatingMarginDelta, refs.kpiNetMarginDelta].forEach((node) => { if (node?.textContent === "暂无信号") node.textContent = "暂无可比数据"; });
    const metricMoney = (value) => number(value) === null ? "—" : formatBillionsInCurrency(value * (number(snapshot.displayScaleFactor) || 1), snapshot.displayCurrency || "USD");
    const grossMetricLabel = snapshot.grossProfitLabel ? (/信用/.test(snapshot.grossProfitLabel) ? "信用准备后收入占比" : "费用前收入占比") : "毛利率";
    if ($("kpiGrossMarginLabel")) $("kpiGrossMarginLabel").textContent = grossMetricLabel;
    if ($("metricsSummary")) $("metricsSummary").textContent = `营收 ${refs.kpiRevenueValue?.textContent || "—"} · ${grossMetricLabel} ${refs.kpiGrossMarginValue?.textContent || "—"} · 营业利润 ${metricMoney(snapshot.operatingProfitBn)} · 净利润 ${metricMoney(snapshot.netProfitBn)}`;
    syncCompany(); syncViews(); setBusy(false); persist();
  }
  function rememberEdit() {
    const key = currentEditorSessionKey();
    const stack = ui.undo[key] || (ui.undo[key] = []);
    const before = deepClone(currentEditorOverrides());
    if (JSON.stringify(stack[stack.length - 1]) !== JSON.stringify(before)) stack.push(before);
    if (stack.length > 40) stack.shift();
    ui.redo[key] = [];
    syncUndoButtons();
  }
  function saveDrafts() { writeStorage(DRAFT_KEY, Object.fromEntries(Object.entries(state.editor.overridesBySession).slice(-120))); syncUndoButtons(); }
  function editHistory(direction) {
    const key = currentEditorSessionKey();
    const from = (direction === "undo" ? ui.undo : ui.redo)[key] || [];
    if (!from.length || ui.busy) return;
    const to = direction === "undo" ? ui.redo : ui.undo;
    (to[key] || (to[key] = [])).push(deepClone(currentEditorOverrides()));
    state.editor.overridesBySession[key] = from.pop();
    saveDrafts(); requestRenderCurrent();
  }
  function syncUndoButtons() {
    const key = currentEditorSessionKey();
    if ($("undoEditBtn")) $("undoEditBtn").disabled = !(ui.undo[key]?.length);
    if ($("redoEditBtn")) $("redoEditBtn").disabled = !(ui.redo[key]?.length);
  }
  async function copyShare() {
    try {
      if (!globalScope.navigator?.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await globalScope.navigator.clipboard.writeText($("shareUrl").value);
      toast("视图链接已复制"); $("shareDialog").close();
    } catch (_) {
      $("shareUrl").focus(); $("shareUrl").select();
      toast("请按 Ctrl+C 或 ⌘C 复制已选中的链接");
    }
  }
  function share() {
    persist();
    $("shareUrl").value = globalScope.location.href;
    const local = ["localhost", "127.0.0.1", "::1"].includes(globalScope.location.hostname);
    $("shareHelp").textContent = local ? "这是本地预览地址，可在这台电脑上恢复当前公司、报告期和视图。" : "复制链接后，可恢复当前公司、报告期和图表设置。";
    $("shareDialog").showModal();
  }
  async function fullscreen() {
    const panel = $("chartPanel");
    if (document.fullscreenElement) { await document.exitFullscreen?.(); return; }
    if (panel.classList.contains("is-expanded")) { panel.classList.remove("is-expanded"); $("fullscreenBtn").textContent = "全屏查看"; queueChartFit(); return; }
    try { if (panel.requestFullscreen) { await panel.requestFullscreen(); return; } } catch (_) {}
    panel.classList.add("is-expanded"); $("fullscreenBtn").textContent = "退出全屏";
  }
  function init() {
    if (ui.initialized || !$("chartPanel")) return;
    ui.initialized = true;
    const on = (id, event, fn) => $(id)?.addEventListener(event, fn);
    on("mobileCompanyToggle", "click", () => {
      const open = document.querySelector(".controls").classList.toggle("is-open");
      $("mobileCompanyToggle").setAttribute("aria-expanded", String(open));
      if (open) refs.companySearch?.focus();
    });
    refs.companyList?.addEventListener("error", (event) => {
      const logo = event.target;
      if (!logo.matches?.("img.company-logo")) return;
      logo.closest(".company-avatar")?.classList.remove("has-logo");
      logo.remove();
    }, true);
    on("allCompaniesBtn", "click", () => { ui.onlyFavorites = false; renderCompanyList(); });
    on("favoriteCompaniesBtn", "click", () => { ui.onlyFavorites = true; renderCompanyList(); });
    on("companyList", "click", (event) => {
      const favorite = event.target.closest("[data-favorite-id]");
      if (favorite) {
        const id = favorite.dataset.favoriteId;
        if (ui.favorites.has(id)) ui.favorites.delete(id); else ui.favorites.add(id);
        const saved = readStorage(STORAGE_KEY);
        writeStorage(STORAGE_KEY, { ...saved, favorites: [...ui.favorites] });
        renderCompanyList();
      }
      if (event.target.closest("[data-clear-filters]")) { ui.onlyFavorites = false; refs.companySearch.value = ""; renderCompanyList(); }
    });
    on("keepQuarterCheckbox", "change", (event) => { state.keepQuarterOnCompanySwitch = event.target.checked; persist(); });
    on("latestQuarterBtn", "click", () => {
      const keys = renderableQuarterKeys(getCompany(state.selectedCompanyId)).slice().sort((a, b) => quarterSortValue(b) - quarterSortValue(a));
      if (keys[0]) selectQuarter(keys[0]);
    });
    on("sankeyTab", "click", () => setMode("sankey"));
    on("barsTab", "click", () => setMode("bars"));
    on("historyRangeSelect", "change", (event) => { state.historyRange = Number(event.target.value); requestRenderCurrent(); });
    on("barBasisSelect", "change", (event) => { state.barHistoryBasis = event.target.value === "reported" ? "reported" : "recast"; requestRenderCurrent(); });
    on("dataViewBtn", "click", () => { ui.table = !ui.table; syncViews(); persist(); });
    on("fullscreenBtn", "click", fullscreen);
    on("zoomChartBtn", "click", () => {
      const zoomed = document.querySelector(".preview-stage").classList.toggle("is-zoomed");
      $("zoomChartBtn").setAttribute("aria-pressed", String(zoomed));
      $("zoomChartBtn").textContent = zoomed ? "适应屏幕宽度" : "放大图表 · 可左右滑动";
    });
    on("openSourcesBtn", "click", () => { $("sourceDetails").open = true; $("sourceDetails").scrollIntoView({ block: "nearest" }); });
    on("metricsDetails", "toggle", () => {
      const label = $("metricsDetails").querySelector(".metrics-toggle-label");
      if (label) label.textContent = $("metricsDetails").open ? "收起" : "展开";
    });
    ["quarterSelect", "previousQuarterBtn", "nextQuarterBtn", "latestQuarterBtn"].forEach((id) => on(id, id === "quarterSelect" ? "change" : "click", revealChartIfNeeded));
    on("exportMenu", "toggle", () => { if ($("exportMenu").open) revealChartIfNeeded(); });
    on("downloadCsvBtn", "click", exportCsv);
    on("shareViewBtn", "click", share);
    on("copyShareBtn", "click", copyShare);
    on("undoEditBtn", "click", () => editHistory("undo"));
    on("redoEditBtn", "click", () => editHistory("redo"));
    on("retryRenderBtn", "click", async () => {
      if (!state.dataset) { globalScope.location.reload(); return; }
      await renderCurrent();
    });
    document.addEventListener("fullscreenchange", () => { $("fullscreenBtn").textContent = document.fullscreenElement ? "退出全屏" : "全屏查看"; queueChartFit(); });
    document.addEventListener("click", (event) => { if (!event.target.closest("#exportMenu")) $("exportMenu").open = false; });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") { $("exportMenu").open = false; $("chartPanel").classList.remove("is-expanded"); $("fullscreenBtn").textContent = "全屏查看"; queueChartFit(); }
      if (event.target.closest("input, select, textarea, [contenteditable='true']")) return;
      if (state.editor.enabled && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") { event.preventDefault(); editHistory(event.shiftKey ? "redo" : "undo"); }
    });
    globalScope.addEventListener?.("popstate", () => { restore(); syncQuarterOptions({ preferReplica: false }); renderCompanyList(); requestRenderCurrent(); });
    globalScope.addEventListener?.("resize", queueChartFit);
    if (typeof globalScope.ResizeObserver === "function") {
      const observer = new globalScope.ResizeObserver(queueChartFit);
      for (const node of [$("analysisDock"), $("chartPanel")]) if (node) observer.observe(node);
    }
    document.fonts?.ready?.then(queueChartFit);
    setBusy(true);
  }
  function exporting(busy) { ui.exportBusy = busy; syncExportButtons(); if (!busy && $("exportMenu")) $("exportMenu").open = false; }
  globalScope.EarningsDesk = Object.freeze({ init, restore, refresh, renderCompanyList, syncCompany, setBusy, fail, rememberEdit, saveDrafts, exporting, toast, selectionFrom, safeUrl, csvText, buildTable, evidenceWarnings, collectSources, insights });
})(globalThis);
