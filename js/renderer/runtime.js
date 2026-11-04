function createLayoutEngine() {
  return Object.freeze({
    snapshotCanvasSize,
    stackValueSlices,
    separateStackSlices,
    resolveVerticalBoxes,
    resolveVerticalBoxesVariableGap,
    prototypeBandConfig,
    approximateTextWidth,
    approximateTextBlockWidth,
    estimatedStackSpan,
  });
}

function createRenderEngine() {
  return Object.freeze({
    renderPixelReplicaSvg,
    renderIncomeStatementSvg,
    renderRevenueSegmentBarsSvg,
  });
}

const EarningsVizRuntime = Object.freeze({
  version: BUILD_ASSET_VERSION,
  layout: createLayoutEngine(),
  render: createRenderEngine(),
  i18n: Object.freeze({
    translateBusinessLabelToZh,
    localizeChartPhrase,
  }),
});

if (typeof window !== "undefined") {
  window.earningsImageStudio = EarningsVizRuntime;
}

