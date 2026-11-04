const automationBootState = {
  isReady: false,
  error: null,
};

let resolveAutomationReady = null;
let rejectAutomationReady = null;

const automationReadyPromise = new Promise((resolve, reject) => {
  resolveAutomationReady = resolve;
  rejectAutomationReady = reject;
});

function markAutomationReady() {
  if (automationBootState.isReady) return;
  automationBootState.isReady = true;
  automationBootState.error = null;
  globalThis.performance?.mark?.("earnings-chart-ready");
  if (typeof resolveAutomationReady === "function") {
    resolveAutomationReady(true);
    resolveAutomationReady = null;
    rejectAutomationReady = null;
  }
}

function markAutomationBootFailure(error) {
  automationBootState.error = error instanceof Error ? error : new Error(String(error || "Automation boot failed."));
  if (typeof rejectAutomationReady === "function") {
    rejectAutomationReady(automationBootState.error);
    resolveAutomationReady = null;
    rejectAutomationReady = null;
  }
}

function currentTemplatePresetState(company = getCompany(state.selectedCompanyId), snapshot = state.currentSnapshot) {
  if (!company || !snapshot) return null;
  const presetKey = snapshot.templatePresetKey || templatePresetKey(snapshot, company);
  return {
    company,
    snapshot,
    presetKey,
    presetLabel: snapshot.templatePresetLabel || templatePresetLabel(snapshot, company),
    tokens: deepClone(snapshot.templateTokens || effectiveTemplateTokens(snapshot, company)),
  };
}

function setTokenStatus(message) {
  if (refs.tokenStatus) refs.tokenStatus.textContent = message;
}

function syncReferenceOverlay() {
  if (!refs.referenceOverlay) return;
  const { overlayEnabled, overlayOpacity, overlayImageDataUrl } = state.calibration;
  if (!overlayEnabled || !overlayImageDataUrl) {
    refs.referenceOverlay.classList.remove("is-visible");
    refs.referenceOverlay.removeAttribute("src");
    return;
  }
  refs.referenceOverlay.src = overlayImageDataUrl;
  refs.referenceOverlay.style.opacity = `${overlayOpacity / 100}`;
  refs.referenceOverlay.classList.add("is-visible");
}

function refreshTokenEditor(snapshot, company) {
  const presetState = currentTemplatePresetState(company, snapshot);
  if (!presetState) return;
  const draft = state.calibration.tokenDraftByPreset[presetState.presetKey];
  if (refs.templateTokenEditor) {
    refs.templateTokenEditor.value = draft || JSON.stringify(presetState.tokens, null, 2);
  }
  if (refs.calibrationPresetPill) {
    refs.calibrationPresetPill.textContent = presetState.presetLabel;
  }
}

function updateCalibrationUi(snapshot = state.currentSnapshot, company = getCompany(state.selectedCompanyId)) {
  if (refs.overlayToggle) refs.overlayToggle.checked = state.calibration.overlayEnabled;
  if (refs.overlayOpacity) refs.overlayOpacity.value = String(state.calibration.overlayOpacity);
  if (refs.overlayOpacityValue) refs.overlayOpacityValue.textContent = `${state.calibration.overlayOpacity}%`;
  refreshTokenEditor(snapshot, company);
  syncReferenceOverlay();
}

function storeCurrentTokenDraft() {
  const presetState = currentTemplatePresetState();
  if (!presetState || !refs.templateTokenEditor) return;
  state.calibration.tokenDraftByPreset[presetState.presetKey] = refs.templateTokenEditor.value;
}

function applyCurrentTokenDraft() {
  const presetState = currentTemplatePresetState();
  if (!presetState || !refs.templateTokenEditor) return;
  try {
    const parsed = JSON.parse(refs.templateTokenEditor.value || "{}");
    if (!isPlainObject(parsed)) {
      setTokenStatus("Token JSON 必须是对象，至少包含 layout / ribbon / typography 之一。");
      return;
    }
    state.calibration.tokenOverridesByPreset[presetState.presetKey] = parsed;
    state.calibration.tokenDraftByPreset[presetState.presetKey] = JSON.stringify(parsed, null, 2);
    setTokenStatus(`已应用 ${presetState.presetLabel} 的模板 token。`);
    renderCurrent();
  } catch (error) {
    setTokenStatus(`Token JSON 解析失败：${error.message || "未知错误"}`);
  }
}

function resetCurrentTokenDraft() {
  const presetState = currentTemplatePresetState();
  if (!presetState) return;
  delete state.calibration.tokenOverridesByPreset[presetState.presetKey];
  delete state.calibration.tokenDraftByPreset[presetState.presetKey];
  setTokenStatus(`已恢复 ${presetState.presetLabel} 的默认模板参数。`);
  renderCurrent();
}

function downloadCurrentTokenJson() {
  const presetState = currentTemplatePresetState();
  if (!presetState) return;
  const payload = refs.templateTokenEditor?.value || JSON.stringify(presetState.tokens, null, 2);
  downloadBlob(
    new Blob([payload], { type: "application/json;charset=utf-8" }),
    `${currentFilenameStem()}-${presetState.presetKey.replace(/[^a-z0-9-]+/gi, "-")}-tokens.json`
  );
  setTokenStatus("模板 token JSON 已导出。");
}

function loadReferenceOverlayFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    state.calibration.overlayImageDataUrl = String(reader.result || "");
    state.calibration.overlayEnabled = true;
    updateCalibrationUi();
    setTokenStatus(`已载入参考图：${file.name}`);
  };
  reader.onerror = () => {
    setTokenStatus("参考图读取失败。");
  };
  reader.readAsDataURL(file);
}

function setKpiDelta(node, text, deltaValue = null) {
  if (!node) return;
  node.classList.remove("is-positive", "is-negative", "is-neutral");
  const normalizedText = String(text || "").trim();
  if (!normalizedText || normalizedText === "-") {
    node.textContent = currentChartLanguage() === "en" ? "No signal" : "暂无信号";
    node.classList.add("is-neutral");
    return;
  }
  node.textContent = normalizedText;
  if (deltaValue === null || deltaValue === undefined || Number.isNaN(Number(deltaValue))) {
    node.classList.add("is-neutral");
    return;
  }
  const numeric = Number(deltaValue);
  if (numeric > 0.05) {
    node.classList.add("is-positive");
  } else if (numeric < -0.05) {
    node.classList.add("is-negative");
  } else {
    node.classList.add("is-neutral");
  }
}

function updateKpiStrip(snapshot) {
  if (refs.kpiRevenueValue) refs.kpiRevenueValue.textContent = formatBillions(snapshot?.revenueBn);
  const revenueYoyLabel = formatGrowthMetric(snapshot?.revenueYoyPct, "yoy");
  const revenueQoqLabel = formatGrowthMetric(snapshot?.revenueQoqPct, "qoq");
  const revenueDelta = [revenueYoyLabel, revenueQoqLabel].filter(Boolean).join(" · ");
  const revenueToneValue =
    snapshot?.revenueYoyPct !== null && snapshot?.revenueYoyPct !== undefined
      ? safeNumber(snapshot.revenueYoyPct, null)
      : safeNumber(snapshot?.revenueQoqPct, null);
  setKpiDelta(refs.kpiRevenueDelta, revenueDelta, revenueToneValue);

  if (refs.kpiGrossMarginValue) refs.kpiGrossMarginValue.textContent = formatPct(snapshot?.grossMarginPct);
  const grossDeltaValue = safeNumber(snapshot?.grossMarginYoyDeltaPp, null);
  setKpiDelta(refs.kpiGrossMarginDelta, formatPp(grossDeltaValue, "yoy"), grossDeltaValue);

  if (refs.kpiOperatingMarginValue) refs.kpiOperatingMarginValue.textContent = formatPct(snapshot?.operatingMarginPct);
  const operatingDeltaValue = safeNumber(snapshot?.operatingMarginYoyDeltaPp, null);
  setKpiDelta(refs.kpiOperatingMarginDelta, formatPp(operatingDeltaValue, "yoy"), operatingDeltaValue);

  if (refs.kpiNetMarginValue) refs.kpiNetMarginValue.textContent = formatPct(snapshot?.netMarginPct);
  const netDeltaValue = safeNumber(snapshot?.netMarginYoyDeltaPp, null);
  setKpiDelta(refs.kpiNetMarginDelta, formatPp(netDeltaValue, "yoy"), netDeltaValue);
}

function updateAnalysisSignalStrip(snapshot, company, isBarMode, viewPayload = null) {
  if (!refs.analysisQualityPill && !refs.analysisSourcePill && !refs.analysisCurrencyPill) return;
  const quarterEntry = company?.financials?.[snapshot?.quarterKey] || null;
  const diagnostics = quarterEntry?.extractionDiagnostics || null;
  const qualityScore = safeNumber(diagnostics?.qualityScore, null);
  const issueCount = Array.isArray(diagnostics?.issues) ? diagnostics.issues.length : 0;
  if (refs.analysisQualityPill) {
    refs.analysisQualityPill.classList.remove("is-good", "is-medium", "is-low");
    if (qualityScore === null) {
      refs.analysisQualityPill.textContent = currentChartLanguage() === "en" ? "Unknown" : "未知";
    } else if (qualityScore >= 85) {
      refs.analysisQualityPill.classList.add("is-good");
      refs.analysisQualityPill.textContent =
        currentChartLanguage() === "en" ? `High ${Math.round(qualityScore)}${issueCount ? ` · ${issueCount} issues` : ""}` : `高 ${Math.round(qualityScore)}分${issueCount ? ` · ${issueCount}项` : ""}`;
    } else if (qualityScore >= 70) {
      refs.analysisQualityPill.classList.add("is-medium");
      refs.analysisQualityPill.textContent =
        currentChartLanguage() === "en" ? `Medium ${Math.round(qualityScore)}${issueCount ? ` · ${issueCount} issues` : ""}` : `中 ${Math.round(qualityScore)}分${issueCount ? ` · ${issueCount}项` : ""}`;
    } else {
      refs.analysisQualityPill.classList.add("is-low");
      refs.analysisQualityPill.textContent =
        currentChartLanguage() === "en" ? `Low ${Math.round(qualityScore)}${issueCount ? ` · ${issueCount} issues` : ""}` : `低 ${Math.round(qualityScore)}分${issueCount ? ` · ${issueCount}项` : ""}`;
    }
  }
  if (refs.analysisSourcePill) {
    const sourceLabel = snapshot?.sourceLabel || quarterEntry?.statementSource || (currentChartLanguage() === "en" ? "Mixed sources" : "多源融合");
    refs.analysisSourcePill.textContent = sourceLabel;
  }
  if (refs.analysisCurrencyPill) {
    if (isBarMode) {
      const history = viewPayload?.history || null;
      const primaryDisplayCurrency = history?.primaryDisplayCurrency || snapshot?.displayCurrency || "USD";
      const convertedQuarterCount = history?.convertedQuarterCount || 0;
      const quarterCount = history?.quarters?.length || 0;
      refs.analysisCurrencyPill.textContent =
        convertedQuarterCount > 0
          ? `${primaryDisplayCurrency} (FX ${convertedQuarterCount}/${quarterCount})`
          : primaryDisplayCurrency;
    } else {
      const displayCurrency = snapshot?.displayCurrency || "USD";
      refs.analysisCurrencyPill.textContent = snapshot?.usesFxConversion ? `${displayCurrency} (FX)` : displayCurrency;
    }
  }
}

function updateMeta(snapshot, company, viewPayload = null) {
  const isBarMode = currentChartViewMode() === "bars";
  refs.toolbarCompany.textContent = companyDisplay(company);
  refs.toolbarQuarter.textContent = `${snapshot.quarterKey} · ${snapshot.fiscalLabel || "-"}`;
  updateDatasetTimestampUi();
  updateAnalysisSignalStrip(snapshot, company, isBarMode, viewPayload);
  updateKpiStrip(snapshot);

  if (isBarMode) {
    const history = viewPayload?.history || null;
    const quarterCount = history?.quarters?.length || 0;
    const requestedQuarterCount = history?.requestedQuarterCount || quarterCount || 30;
    const windowUnitLabel = history?.windowUnitLabel || "quarters";
    const windowUnitLabelZh = history?.windowUnitLabelZh || "个季度";
    const convertedQuarterCount = history?.convertedQuarterCount || 0;
    const primaryDisplayCurrency = history?.primaryDisplayCurrency || "USD";
    const sourceCurrencySet = Array.isArray(history?.sourceCurrencySet) ? history.sourceCurrencySet : [];
    const currencySummary =
      primaryDisplayCurrency === "MIXED"
        ? (history?.displayCurrencySet || []).join("/")
        : primaryDisplayCurrency;
    const segmentCount = history?.segmentStats?.length || 0;
    const availableRevenues = (history?.quarters || [])
      .map((item) => safeNumber(item?.totalRevenueBn, null))
      .filter((value) => value !== null && value > 0.02);
    const earliestRevenue = availableRevenues.length ? availableRevenues[0] : safeNumber(snapshot?.revenueBn);
    const latestRevenue = availableRevenues.length ? availableRevenues[availableRevenues.length - 1] : safeNumber(snapshot?.revenueBn);
    const growthPct = earliestRevenue > 0.02 ? ((latestRevenue / earliestRevenue - 1) * 100) : null;
    refs.chartTitle.textContent =
      currentChartLanguage() === "en"
        ? `${displayChartTitle(company.nameEn)} Revenue by Segment`
        : `${company.nameZh || company.nameEn} 分部营收趋势`;
    refs.chartMeta.textContent =
      currentChartLanguage() === "en"
        ? `${companyDisplay(company)} · ${quarterCount}/${requestedQuarterCount} ${windowUnitLabel} · Segment trend view`
        : `${companyDisplay(company)} · ${quarterCount}/${requestedQuarterCount} ${windowUnitLabelZh} · 分部趋势视图`;
    refs.detailSegmentCount.textContent = currentChartLanguage() === "en" ? `${segmentCount} segments` : `${segmentCount} 个`;
    refs.detailSegmentNote.textContent =
      currentChartLanguage() === "en"
        ? `Each bar shows quarterly revenue based on official segment disclosures; taxonomy changes are harmonized into comparable high-level groups.`
        : `每个柱子均基于当期官方分部披露；遇到口径变化时，历史分类会归并为可比较的高层业务组。`;
    refs.detailStatementSummary.textContent = `${formatBillionsInCurrency(earliestRevenue, primaryDisplayCurrency)} → ${formatBillionsInCurrency(
      latestRevenue,
      primaryDisplayCurrency
    )}`;
    refs.detailStatementNote.textContent =
      growthPct !== null && Number.isFinite(growthPct)
        ? currentChartLanguage() === "en"
          ? `Window growth: ${formatPct(growthPct, true)} · ${requestedQuarterCount}-${windowUnitLabel === "quarters" ? "quarter" : "period"} continuity verified`
          : `窗口营收增长：${formatPct(growthPct, true)} · ${requestedQuarterCount}${windowUnitLabelZh}连续性已校验`
        : currentChartLanguage() === "en"
          ? `${requestedQuarterCount}-${windowUnitLabel === "quarters" ? "quarter" : "period"} continuity verified`
          : `${requestedQuarterCount}${windowUnitLabelZh}连续性已校验`;
    refs.detailSourceTitle.textContent =
      currentChartLanguage() === "en" ? "Official segments + currency normalization" : "官方分部 + 币种归一";
    refs.detailSourceNote.textContent =
      currentChartLanguage() === "en"
        ? `Currency: ${currencySummary}${convertedQuarterCount ? ` (converted ${convertedQuarterCount}/${quarterCount} quarters from ${sourceCurrencySet.join("/") || "local currencies"})` : ""}. Historical bars are taxonomy-harmonized by period.`
        : `币种：${currencySummary}${convertedQuarterCount ? `（${convertedQuarterCount}/${quarterCount} 个季度由 ${sourceCurrencySet.join("/") || "本币"} 折算）` : ""}。历史季度按分期口径进行分类对齐。`;
    refs.footnoteText.textContent =
      currentChartLanguage() === "en"
        ? `Color mappings are brand-driven and remain stable by segment key within the selected window.`
        : `颜色映射由公司品牌自动驱动，并在当前窗口内按分部键保持稳定。`;
  } else {
    refs.chartTitle.textContent = localizeChartTitle(snapshot);
    refs.chartMeta.textContent = [companyDisplay(company), snapshot.quarterKey, currentChartLanguage() === "en" ? "Earnings bridge view" : "利润桥视图"]
      .filter(Boolean)
      .join(" · ");
    refs.detailSegmentCount.textContent =
      currentChartLanguage() === "en" ? `${snapshot.businessGroups?.length || 0} segments` : `${snapshot.businessGroups?.length || 0} 个`;
    refs.detailSegmentNote.textContent =
      snapshot.mode === "pixel-replica"
        ? currentChartLanguage() === "en"
          ? "This quarter uses a calibrated high-fidelity template with company-specific layout tuning."
          : "当前季度使用统一高精复刻模板生成，并按参考样板参数校准业务板块布局。"
        : currentChartLanguage() === "en"
          ? "This quarter uses the unified replica template; if segment data is missing, the bridge safely collapses to revenue-only."
          : "当前季度使用统一高精复刻模板自动生成；如果缺少分部数据，会保留同一套汇聚/分散主桥并自动收敛为单收入块。";
    refs.detailStatementSummary.textContent = `${formatBillions(snapshot.revenueBn)} → ${formatNetOutcomeBillions(snapshot)}`;
    refs.detailStatementNote.textContent =
      currentChartLanguage() === "en"
        ? `Gross profit ${formatBillions(snapshot.grossProfitBn)} / ${resolvedOperatingOutcomeLabel(snapshot)} ${formatOperatingOutcomeBillions(snapshot)}`
        : `毛利 ${formatBillions(snapshot.grossProfitBn)} / ${localizeChartPhrase(resolvedOperatingOutcomeLabel(snapshot))} ${formatOperatingOutcomeBillions(snapshot)}`;
    refs.detailSourceTitle.textContent = snapshot.sourceLabel;
    refs.detailSourceNote.textContent = snapshot.footnote;
    refs.footnoteText.textContent = snapshot.footnote;
  }

  refs.quarterHint.textContent = `${snapshot.periodEndLabel || ""} · ${snapshot.fiscalLabel || ""}`;
  if (refs.calibrationPresetPill) refs.calibrationPresetPill.textContent = snapshot.templatePresetLabel || "-";
  if (refs.languageSelect) refs.languageSelect.value = currentChartLanguage();
  syncChartModeToggleUi();
}

function tightenRenderedSvgViewport() {
  const svg = refs.chartOutput?.querySelector("svg");
  const content = svg?.querySelector("#chartContent");
  if (!svg || !content || typeof content.getBBox !== "function") return null;
  try {
    const editHitNodes = Array.from(content.querySelectorAll("[data-edit-hit='true']"));
    const previousDisplays = editHitNodes.map((node) => node.style.display);
    editHitNodes.forEach((node) => {
      node.style.display = "none";
    });
    let bbox;
    try {
      bbox = content.getBBox();
    } finally {
      editHitNodes.forEach((node, index) => {
        node.style.display = previousDisplays[index] || "";
      });
    }
    if (!Number.isFinite(bbox.width) || !Number.isFinite(bbox.height) || bbox.width <= 0 || bbox.height <= 0) return null;
    const currentViewBox = String(svg.getAttribute("viewBox") || "0 0 1600 900")
      .trim()
      .split(/\s+/)
      .map((value) => Number(value));
    const [, , currentWidth = 1600, currentHeight = 900] = currentViewBox;
    const padLeft = 56;
    const padRight = 56;
    const padTop = 40;
    const padBottom = 156;
    const x = Math.max(Math.floor(bbox.x - padLeft), 0);
    const y = Math.max(Math.floor(bbox.y - padTop), 0);
    const width = Math.min(Math.ceil(bbox.width + padLeft + padRight), Math.max(currentWidth - x, 1));
    const height = Math.min(Math.ceil(bbox.height + padTop + padBottom), Math.max(currentHeight - y, 1));
    svg.setAttribute("viewBox", `${x} ${y} ${width} ${height}`);
    refs.chartOutput.style.aspectRatio = `${width} / ${height}`;
    const fxNote = svg.querySelector("[data-fx-note='true']");
    if (fxNote) {
      const fixedLeftPadding = 34;
      const fixedBottomPadding = 18;
      const noteX = x + fixedLeftPadding;
      const noteY = y + height - fixedBottomPadding;
      fxNote.setAttribute("x", noteX.toFixed(1));
      fxNote.setAttribute("y", noteY.toFixed(1));
      fxNote.setAttribute("text-anchor", "start");
      fxNote.setAttribute("dominant-baseline", "ideographic");
    }
    return { x, y, width, height };
  } catch (_error) {
    return null;
  }
}

async function renderCurrent() {
  const renderToken = state.renderToken = (state.renderToken || 0) + 1;
  globalThis.EarningsDesk?.setBusy(true);
  let company = getCompany(state.selectedCompanyId);
  if (!company) { globalThis.EarningsDesk?.fail("没有可用的公司数据。"); return; }
  const quarterKey = refs.quarterSelect?.value || state.selectedQuarter;
  state.selectedQuarter = quarterKey;
  syncQuarterNavigation();
  try {
    if (companyNeedsHistoricalData(company, quarterKey, currentChartViewMode())) {
      setStatus(`正在加载 ${company.nameEn} 历史数据...`);
      company = await ensureCompanyHistoricalDataLoaded(company.id, { preferReplica: false });
      if (!company || state.selectedCompanyId !== company.id || renderToken !== state.renderToken) return;
      // Historical enrichment can narrow the available reporting periods.
      // Render the newly selected valid period instead of leaving an old chart loading.
      if (state.selectedQuarter !== quarterKey) {
        requestRenderCurrent();
        return;
      }
    }
    if (currentChartViewMode() !== "bars" && company.financials?.[quarterKey]?.chartQuality?.status === "pending") {
      state.currentSnapshot = null;
      throw new Error("本期营收分类尚未齐全，正在补充。请先查看其他报告期或营收趋势。");
    }
    let snapshot = buildSnapshot(company, quarterKey);
    if (!snapshot) {
      refs.chartOutput.innerHTML = "";
      setStatus("当前公司或季度缺少可用数据。");
      globalThis.EarningsDesk?.fail("当前报告期缺少可用数据，请选择其他报告期。");
      return;
    }
    await prepareChartLogoAssets(snapshot);
    if (renderToken !== state.renderToken) return;
    // Normalization can change a logo's visible aspect ratio. Resolve the
    // existing template again with those exact metrics before displaying it.
    snapshot = buildSnapshot(company, quarterKey);
    snapshot.companyNameZh = company.nameZh;
    snapshot.companyNameEn = company.nameEn;
    snapshot.learnedEditorNodeOverrides = learnedSankeyLayoutOverridesForSession();
    snapshot.interactiveEditorNodeOverrides = sanitizeEditorNodeOverrides(currentEditorOverrides());
    snapshot.editorNodeOverrides = mergeEditorNodeOffsets(
      snapshot.learnedEditorNodeOverrides,
      snapshot.interactiveEditorNodeOverrides
    );
    snapshot.editorSelectedNodeId = state.editor.selectedNodeId;
    snapshot.editModeEnabled = state.editor.enabled;
    state.currentSnapshot = snapshot;
    let barHistory = null;
    const isBarsMode = currentChartViewMode() === "bars";
    if (isBarsMode) {
      const barRenderResult = EarningsVizRuntime.render.renderRevenueSegmentBarsSvg(snapshot, company, {
        maxQuarters: state.historyRange || 30,
        basis: canUseRecastBarHistory(company, snapshot.quarterKey) ? state.barHistoryBasis : "reported",
      });
      refs.chartOutput.innerHTML = barRenderResult.svg;
      refs.chartOutput.style.aspectRatio = `${barRenderResult.width} / ${barRenderResult.height}`;
      refineRenderedBarChartLogoPlacement(refs.chartOutput?.querySelector("svg"));
      barHistory = barRenderResult.history;
    } else {
      refs.chartOutput.innerHTML = EarningsVizRuntime.render.renderIncomeStatementSvg(snapshot, company);
      if (snapshot.mode === "pixel-replica" || snapshot.mode === "replica-template") {
        const canvas = EarningsVizRuntime.layout.snapshotCanvasSize(snapshot);
        refs.chartOutput.style.aspectRatio = `${canvas.width} / ${canvas.height}`;
      } else {
        refs.chartOutput.style.aspectRatio = "1600 / 900";
      }
    }
    if (!isBarsMode) {
      tightenRenderedSvgViewport();
    }
    updateMeta(snapshot, company, { history: barHistory });
    updateCalibrationUi(snapshot, company);
    bindInteractiveEditor(snapshot);
    globalThis.EarningsDesk?.refresh(snapshot, company, barHistory);
    setStatus(
      currentChartViewMode() === "bars"
        ? `已更新 ${company.nameEn} ${quarterKey} 分部趋势图。`
        : `已更新 ${company.nameEn} ${quarterKey} 利润桥图。`
    );
  } catch (error) {
    if (renderToken !== state.renderToken) return;
    state.currentSnapshot = null;
    refs.chartOutput.innerHTML = "";
    globalThis.EarningsDesk?.fail(error?.message || "图表渲染失败，请重试。");
    syncEditModeUi();
    const message = error?.message || String(error || "图表渲染失败。");
    setStatus(`图表渲染失败：${message}`);
    if (typeof window !== "undefined") {
      window.__codexDebugError = message;
    }
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 400);
}

function currentFilenameStem() {
  const snapshot = state.currentSnapshot;
  const company = getCompany(state.selectedCompanyId);
  if (!snapshot || !company) return "earnings-image";
  const modeSuffix =
    currentChartViewMode() === "bars"
      ? "segment-bars"
      : snapshot.mode === "pixel-replica"
        ? "replica"
        : "template";
  return `${company.ticker.toLowerCase()}-${snapshot.quarterKey}-${modeSuffix}-chart`;
}

function currentSvgText() {
  const svg = refs.chartOutput?.querySelector("svg");
  if (!svg) return null;
  return new XMLSerializer().serializeToString(svg);
}

function exportSvg() {
  const svgText = currentSvgText();
  if (!svgText) {
    setStatus("当前没有可导出的 SVG。");
    return;
  }
  downloadBlob(new Blob([svgText], { type: "image/svg+xml;charset=utf-8" }), `${currentFilenameStem()}.svg`);
  setStatus("SVG 已导出。");
  globalThis.EarningsDesk?.toast("SVG 已导出");
  globalThis.EarningsDesk?.exporting(false);
}

async function exportPng(scaleFactor = 1, suffix = "") {
  const filename = `${currentFilenameStem()}${suffix}.png`;
  globalThis.EarningsDesk?.exporting(true);
  setStatus("正在生成 PNG 图片…");
  try {
    const { dataUrl } = await currentPngDataUrl(scaleFactor);
    if (!dataUrl.startsWith("data:image/png;base64,")) throw new Error("导出尺寸无效");
    downloadBlob(dataUrlToBlob(dataUrl), filename);
    setStatus(scaleFactor > 1 ? "超清 PNG 已导出。" : "PNG 已导出。");
    globalThis.EarningsDesk?.toast(scaleFactor > 1 ? "超清 PNG 已导出" : "PNG 已导出");
  } catch (error) {
    setStatus(`PNG 导出失败：${error?.message || "请重试"}`);
    globalThis.EarningsDesk?.toast("PNG 导出失败，请重试或下载 SVG");
  } finally {
    globalThis.EarningsDesk?.exporting(false);
  }
}

function dataUrlToBlob(dataUrl) {
  const parts = String(dataUrl || "").split(",");
  const header = parts[0] || "";
  const body = parts[1] || "";
  const mimeMatch = /^data:([^;]+);base64$/i.exec(header);
  const mimeType = mimeMatch?.[1] || "application/octet-stream";
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mimeType });
}

function currentPngDataUrl(scaleFactor = 1) {
  const requestedScale = Number(scaleFactor);
  scaleFactor = Number.isFinite(requestedScale) && requestedScale > 0 ? Math.min(requestedScale, 3) : 1;
  const svgText = currentSvgText();
  if (!svgText) return Promise.reject(new Error("当前没有可导出的 PNG。"));
  return new Promise((resolve, reject) => {
    const viewBoxMatch = /viewBox="([0-9.\-]+)\s+([0-9.\-]+)\s+([0-9.]+)\s+([0-9.]+)"/.exec(svgText);
    const exportWidth = Math.max(Math.round((viewBoxMatch ? Number(viewBoxMatch[3]) : 1600) * Math.max(scaleFactor, 1)), 1);
    const exportHeight = Math.max(Math.round((viewBoxMatch ? Number(viewBoxMatch[4]) : 900) * Math.max(scaleFactor, 1)), 1);
    const blob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = exportWidth;
        canvas.height = exportHeight;
        const context = canvas.getContext("2d");
        context.fillStyle = "#f7f7f5";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/png");
        URL.revokeObjectURL(url);
        resolve({
          dataUrl,
          width: exportWidth,
          height: exportHeight,
          filenameStem: currentFilenameStem(),
        });
      } catch (error) {
        URL.revokeObjectURL(url);
        reject(error);
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("PNG 导出失败。"));
    };
    image.src = url;
  });
}

function waitForAnimationFrames(count = 1) {
  const frameCount = Math.max(1, Math.floor(safeNumber(count, 1)));
  let remaining = frameCount;
  return new Promise((resolve) => {
    const advance = () => {
      remaining -= 1;
      if (remaining <= 0) {
        resolve();
        return;
      }
      if (typeof requestAnimationFrame === "function") {
        requestAnimationFrame(advance);
        return;
      }
      setTimeout(advance, 16);
    };
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(advance);
      return;
    }
    setTimeout(advance, 0);
  });
}

function resolveAutomationCompanyId(target) {
  const requested = String(target || "").trim();
  if (!requested) return state.selectedCompanyId || null;
  if (state.companyById?.[requested]) return requested;
  const normalized = requested.toLowerCase();
  const exactMatch = companies().find((company) => {
    const fields = [
      company.id,
      company.ticker,
      company.slug,
      company.nameEn,
      company.nameZh,
    ];
    return fields.some((value) => String(value || "").trim().toLowerCase() === normalized);
  });
  if (exactMatch) return exactMatch.id;
  const fuzzyMatch = companies().find((company) => {
    const fields = [
      company.id,
      company.ticker,
      company.slug,
      company.nameEn,
      company.nameZh,
    ];
    return fields.some((value) => String(value || "").trim().toLowerCase().includes(normalized));
  });
  return fuzzyMatch?.id || null;
}

async function automationRenderSelection(options = {}) {
  await automationReadyPromise;
  const requestedCompanyId = resolveAutomationCompanyId(
    options.companyId || options.company || options.ticker || options.name || ""
  );
  if (!requestedCompanyId) {
    throw new Error(`无法匹配公司：${options.companyId || options.company || options.ticker || options.name || ""}`);
  }
  const requestedLanguage = options.language === "en" ? "en" : "zh";
  state.uiLanguage = requestedLanguage;
  if (refs.languageSelect) refs.languageSelect.value = requestedLanguage;

  state.selectedCompanyId = requestedCompanyId;
  state.selectedQuarter = options.quarterKey ? String(options.quarterKey).trim() : null;
  state.chartViewMode = options.viewMode === "bars" ? "bars" : "sankey";
  state.editor.selectedNodeId = null;
  state.editor.dragging = null;
  syncChartModeToggleUi();
  syncQuarterOptions({ preferReplica: !!options.preferReplica });

  const company = getCompany(requestedCompanyId);
  if (!company) {
    throw new Error(`公司不存在：${requestedCompanyId}`);
  }
  if (options.quarterKey) {
    const requestedQuarter = String(options.quarterKey).trim();
    const availableQuarters = renderableQuarterKeys(company);
    if (!availableQuarters.includes(requestedQuarter)) {
      throw new Error(`季度 ${requestedQuarter} 不可用，可选季度：${availableQuarters.join(", ")}`);
    }
    state.selectedQuarter = requestedQuarter;
    if (refs.quarterSelect) refs.quarterSelect.value = requestedQuarter;
  }

  renderCoverage();
  await renderCurrent();
  renderCompanyList();
  await waitForAnimationFrames(2);
  return {
    companyId: state.selectedCompanyId,
    quarterKey: state.selectedQuarter,
    viewMode: currentChartViewMode(),
    language: currentChartLanguage(),
    filenameStem: currentFilenameStem(),
    status: refs.statusText?.textContent || "",
  };
}

async function automationCaptureCurrentChart(options = {}) {
  const renderSummary = await automationRenderSelection(options);
  const svgText = currentSvgText();
  if (!svgText) {
    throw new Error("当前图表没有可导出的 SVG。");
  }
  const pngPayload = await currentPngDataUrl(Math.max(safeNumber(options.scaleFactor, 1), 1));
  return {
    ...renderSummary,
    svgText,
    pngDataUrl: pngPayload.dataUrl,
    width: pngPayload.width,
    height: pngPayload.height,
  };
}

async function automationExportChartSet(options = {}) {
  const requestedModes = Array.isArray(options.modes) && options.modes.length ? options.modes : ["sankey", "bars"];
  const exports = [];
  for (const mode of requestedModes) {
    exports.push(
      await automationCaptureCurrentChart({
        ...options,
        viewMode: mode === "bars" ? "bars" : "sankey",
      })
    );
  }
  return {
    companyId: exports[0]?.companyId || null,
    quarterKey: exports[0]?.quarterKey || null,
    language: exports[0]?.language || currentChartLanguage(),
    exports,
  };
}

if (typeof window !== "undefined") {
  window.earningsImageStudioAutomation = Object.freeze({
    waitUntilReady: () => automationReadyPromise,
    renderSelection: automationRenderSelection,
    captureCurrentChart: automationCaptureCurrentChart,
    exportChartSet: automationExportChartSet,
    getBootState: () => ({
      isReady: automationBootState.isReady,
      error: automationBootState.error ? String(automationBootState.error.message || automationBootState.error) : null,
    }),
  });
}

async function loadDataset() {
  setStatus("正在加载数据集...");
  let defaultDataLoadMode = "latest-only";
  state.dataset = await loadJsonAsset(`./data/dataset-index.json?v=${BUILD_ASSET_VERSION}`);
  if (!state.dataset) {
    state.dataset = await loadJsonAsset(`./data/earnings-dataset.json?v=${BUILD_ASSET_VERSION}`);
    defaultDataLoadMode = "full";
  }
  if (!state.dataset) throw new Error("数据文件读取失败。");
  applyLoadedCompaniesToState(state.dataset?.companies || [], defaultDataLoadMode);
}

async function loadLogoCatalog() {
  try {
    const payload = await loadJsonAsset(`./data/logo-index.json?v=${BUILD_ASSET_VERSION}`) ||
      await loadJsonAsset(`./data/logo-catalog.json?v=${BUILD_ASSET_VERSION}`);
    if (!payload) return;
    const rawCatalog = payload?.logos || {};
    state.logoCatalog = rawCatalog;
    state.normalizedLogoKeys = {};
    state.logoNormalizationJobs = {};
  } catch (_error) {
    state.logoCatalog = {};
    state.normalizedLogoKeys = {};
    state.logoNormalizationJobs = {};
  }
}

async function loadSupplementalComponents() {
  try {
    const payload = await loadJsonAsset(`./data/supplemental-components.json?v=${BUILD_ASSET_VERSION}`);
    if (!payload) {
      state.supplementalComponents = {};
      return;
    }
    state.supplementalComponents = payload;
  } catch (_error) {
    state.supplementalComponents = {};
  }
}

async function loadLearnedSankeyLayouts() {
  state.learnedSankeyLayouts = {};
  try {
    const payload = await loadJsonAsset(`./data/learned-sankey-layouts.json?v=${BUILD_ASSET_VERSION}`);
    if (!isPlainObject(payload)) return;
    state.learnedSankeyLayouts = payload;
  } catch (_error) {
    state.learnedSankeyLayouts = {};
  }
}

async function loadJsonAsset(url) {
  const response = await fetchJson(url);
  return safeParseJsonAssetResponse(response);
}

async function safeParseJsonAssetResponse(response) {
  const parser = globalThis?.EarningsVizHttp?.safeParseJsonResponse;
  if (typeof parser === "function") return parser(response);
  if (!response?.ok) return null;
  try {
    return await response.json();
  } catch (_error) {
    return null;
  }
}

function fetchJson(url) {
  // Data responses revalidate through HTTP headers; hashed assets are reusable.
  return fetch(url);
}

function formatDatasetGeneratedAt(value) {
  if (!value) return "-";
  const dateValue = new Date(value);
  if (!Number.isFinite(dateValue.getTime())) return "-";
  try {
    return new Intl.DateTimeFormat(currentChartLanguage() === "en" ? "en-US" : "zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(dateValue);
  } catch (_error) {
    return dateValue.toLocaleString();
  }
}

function updateDatasetTimestampUi() {
  if (!refs.toolbarUpdatedLabel || !refs.toolbarUpdatedAt) return;
  refs.toolbarUpdatedLabel.textContent = currentChartLanguage() === "en" ? "Data updated" : "数据更新";
  refs.toolbarUpdatedAt.textContent = formatDatasetGeneratedAt(state.dataset?.generatedAt);
}

function updateHero() {
  const count = state.dataset?.companyCount || 0;
  if (refs.heroCoverageText) {
    refs.heroCoverageText.textContent = `当前已载入 ${count} 家公司；核心样本优先补齐近 30 季（约自 2018Q1 起），其余公司按公开源可得范围扩展。`;
  }
  if (refs.companyCountPill) {
    refs.companyCountPill.textContent = `${count} 家`;
  }
}

function bindEvents() {
  refs.companySearch?.addEventListener("input", renderCompanyList);
  refs.companyList?.addEventListener("click", (event) => {
    const button = event.target?.closest?.("[data-company-id]");
    const companyId = button?.getAttribute?.("data-company-id");
    if (!companyId || companyId === state.selectedCompanyId) return;
    selectCompany(companyId, { preferReplica: false, rerenderList: false });
  });
  refs.quarterSelect?.addEventListener("change", () => selectQuarter(refs.quarterSelect.value));
  refs.previousQuarterBtn?.addEventListener("click", () => selectAdjacentQuarter("previous"));
  refs.nextQuarterBtn?.addEventListener("click", () => selectAdjacentQuarter("next"));
  refs.renderBtn?.addEventListener("click", renderCurrent);
  refs.downloadSvgBtn?.addEventListener("click", exportSvg);
  refs.downloadPngBtn?.addEventListener("click", () => exportPng(1));
  refs.downloadHdBtn?.addEventListener("click", () => exportPng(3, "-uhd"));
  refs.chartModeToggleBtn?.addEventListener("click", () => {
    state.chartViewMode = currentChartViewMode() === "bars" ? "sankey" : "bars";
    state.editor.selectedNodeId = null;
    state.editor.dragging = null;
    requestRenderCurrent();
  });
  refs.editImageBtn?.addEventListener("click", () => {
    if (!isInteractiveSankeyEditable()) return;
    state.editor.enabled = !state.editor.enabled;
    if (!state.editor.enabled) {
      state.editor.selectedNodeId = null;
      state.editor.dragging = null;
    }
    requestRenderCurrent();
  });
  refs.resetImageBtn?.addEventListener("click", () => {
    if (!isInteractiveSankeyEditable()) return;
    globalThis.EarningsDesk?.rememberEdit();
    clearCurrentEditorOverrides();
    globalThis.EarningsDesk?.saveDrafts();
    state.editor.selectedNodeId = null;
    state.editor.dragging = null;
    requestRenderCurrent();
  });
  refs.languageSelect?.addEventListener("change", () => {
    state.uiLanguage = refs.languageSelect?.value === "en" ? "en" : "zh";
    requestRenderCurrent();
  });
  refs.overlayToggle?.addEventListener("change", () => {
    state.calibration.overlayEnabled = !!refs.overlayToggle?.checked;
    syncReferenceOverlay();
  });
  refs.overlayFileInput?.addEventListener("change", (event) => {
    const file = event.target?.files?.[0];
    loadReferenceOverlayFile(file);
  });
  refs.overlayOpacity?.addEventListener("input", () => {
    state.calibration.overlayOpacity = safeNumber(refs.overlayOpacity?.value, 35);
    updateCalibrationUi();
  });
  refs.templateTokenEditor?.addEventListener("input", storeCurrentTokenDraft);
  refs.applyTokenBtn?.addEventListener("click", applyCurrentTokenDraft);
  refs.resetTokenBtn?.addEventListener("click", resetCurrentTokenDraft);
  refs.downloadTokenBtn?.addEventListener("click", downloadCurrentTokenJson);
  refs.openMicrosoftPreset?.addEventListener("click", () => {
    selectCompany("microsoft", { preferReplica: true, rerenderList: true });
  });
  if (typeof window !== "undefined") {
    window.addEventListener("pointermove", (event) => {
      const drag = state.editor.dragging;
      if (!drag) return;
      const point = svgPointFromClient(event.clientX, event.clientY);
      if (!point) return;
      const desiredDx = drag.baseDx + (point.x - drag.startX);
      const desiredDy = drag.baseDy + (point.y - drag.startY);
      setCurrentEditorNodeOverride(drag.nodeId, {
        dx: clamp(desiredDx, drag.minDx, drag.maxDx),
        dy: clamp(desiredDy, drag.minDy, drag.maxDy),
      });
      requestEditorRerender();
    });
    window.addEventListener("pointerup", () => {
      if (!state.editor.dragging) return;
      state.editor.dragging = null;
      globalThis.EarningsDesk?.saveDrafts();
      requestEditorRerender();
    });
    window.addEventListener("pointercancel", () => {
      if (!state.editor.dragging) return;
      state.editor.dragging = null;
      globalThis.EarningsDesk?.saveDrafts();
      requestEditorRerender();
    });
  }
}

async function boot() {
  queryRefs();
  globalThis.EarningsDesk?.init();
  bindEvents();
  syncChartModeToggleUi();
  try {
    await Promise.all([loadDataset(), loadLogoCatalog(), loadSupplementalComponents(), loadLearnedSankeyLayouts()]);
  } catch (error) {
    setStatus(error.message || "数据加载失败。");
    globalThis.EarningsDesk?.fail(error.message || "数据加载失败，请检查网络后重试。");
    markAutomationBootFailure(error);
    return;
  }
  updateHero();
  initializeDefaultLandingSelection();
  globalThis.EarningsDesk?.restore();
  syncQuarterOptions({ preferReplica: false });
  renderCoverage();
  await renderCurrent();
  markAutomationReady();
  // Give the first chart a paint before populating the full company sidebar.
  requestAnimationFrame(() => renderCompanyList());
}

document.addEventListener("DOMContentLoaded", boot);
