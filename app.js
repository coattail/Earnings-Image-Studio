const state = {
  dataset: null,
  supplementalComponents: {},
  logoCatalog: {},
  normalizedLogoKeys: {},
  logoNormalizationJobs: {},
  sortedCompanies: [],
  companyById: {},
  selectedCompanyId: null,
  selectedQuarter: null,
  chartViewMode: "sankey",
  uiLanguage: "zh",
  filteredCompanyIds: [],
  currentSnapshot: null,
  pendingRenderFrame: 0,
  editor: {
    enabled: false,
    selectedNodeId: null,
    dragging: null,
    rerenderFrame: 0,
    overridesBySession: {},
  },
  calibration: {
    overlayEnabled: false,
    overlayOpacity: 35,
    overlayImageDataUrl: null,
    tokenOverridesByPreset: {},
    tokenDraftByPreset: {},
  },
};

const BUILD_ASSET_VERSION = "20260323-exact-growth-and-logo-trim-v119";
const CORPORATE_LOGO_AREA_MULTIPLIER = 1.728;
const CORPORATE_LOGO_LINEAR_SCALE_MULTIPLIER = Math.sqrt(CORPORATE_LOGO_AREA_MULTIPLIER);
const CORPORATE_LOGO_REVENUE_GAP_MULTIPLIER = 1.2;

const CORPORATE_LOGO_SCALE_OVERRIDES = {
  abbvie: 1.14,
  amazon: 1.18,
  asml: 1.12,
  "bank-of-america": 1.38,
  broadcom: 1.08,
  "coca-cola": 1.18,
  costco: 1.14,
  exxon: 1.12,
  jnj: 1.42,
  jpmorgan: 1.28,
  micron: 1.1,
  netflix: 1.12,
  oracle: 1.12,
  palantir: 1.1,
  "procter-gamble": 1.16,
  tsmc: 1.18,
  visa: 1.16,
  walmart: 1.16,
};

const CORPORATE_LOGO_BASE_SCALE_OVERRIDES = {
  berkshire: 1.12,
  "meta-corporate": 0.52,
  "amazon-corporate": 0.9,
  "tesla-corporate": 0.84,
  "nvidia-corporate": 1.02,
};

const DEFAULT_COMPANY_BRAND = Object.freeze({
  primary: "#2563EB",
  secondary: "#111827",
  accent: "#DBEAFE",
});

const COMPANY_METADATA_FALLBACKS = Object.freeze({
  tencent: Object.freeze({
    nameZh: "腾讯控股",
    nameEn: "Tencent",
    slug: "tcehy",
    rank: 14.5,
    isAdr: true,
    brand: {
      primary: "#1D9BF0",
      secondary: "#111827",
      accent: "#DBEEFF",
    },
  }),
  alibaba: Object.freeze({
    nameZh: "阿里巴巴",
    nameEn: "Alibaba",
    slug: "baba",
    rank: 30.5,
    isAdr: true,
    brand: {
      primary: "#FF6A00",
      secondary: "#111827",
      accent: "#FFE7D1",
    },
  }),
});

const BASE_CORPORATE_LOGO_TOKENS = {
  heroScale: 1.04,
  fallbackScale: 0.92,
  baseScales: CORPORATE_LOGO_BASE_SCALE_OVERRIDES,
  ratioScaleBands: [
    { min: 5.2, scale: 1 },
    { min: 3.2, scale: 0.98 },
    { min: 1.7, scale: 1 },
    { min: 0, scale: 1.04 },
  ],
};

const BASE_RIGHT_BAND_TOKENS = {
  deductions: {
    minOffsetFromNet: 28,
    maxOffsetAboveOpex: 44,
    minClamp: 420,
    maxClamp: 680,
    gap: 24,
    minGap: 10,
    centerStep: 18,
    heightOffset: -8,
  },
  costBreakdown: {
    minY: 744,
    maxY: 1002,
    gap: 24,
    minGap: 10,
    centerStart: 816,
    centerStep: 118,
    heightOffset: 0,
  },
  opex: {
    denseThreshold: 5,
    regular: {
      minY: 700,
      maxY: 1028,
      gap: 28,
      minGap: 10,
      centerStart: 736,
      centerStep: 126,
      heightOffset: 0,
    },
    dense: {
      minY: 670,
      maxY: 1042,
      gap: 12,
      minGap: 4,
      centerStart: 702,
      centerStep: 92,
      heightOffset: 0,
    },
  },
};

const BASE_TEMPLATE_TOKENS = {
  layout: {
    canvasWidth: 2048,
    canvasHeight: 1325,
    canvasDesignHeight: 1160,
    leftX: 368,
    revenueX: 742,
    sourceNodeWidth: 52,
    sourceLabelX: 68,
    sourceMetricOffsetX: 0,
    grossX: 1122,
    opX: 1480,
    rightX: 1688,
    opexTargetX: 1664,
    costBreakdownX: 1294,
    costBreakdownLabelX: 1362,
    rightLabelX: 1750,
    opexLabelX: 1726,
    belowLabelX: 1750,
    revenueTop: 330,
    revenueHeight: 452,
    chartBottomLimit: 1004,
    sourceNodeGap: 28,
    sourceNodeMinY: 284,
    sourceNodeMaxY: 1088,
    sourceFan: {
      spread: 1.12,
      exponent: 1.22,
      edgeBoost: 24,
      edgeExponent: 1.15,
      bandBias: 0.08,
      sideBoost: 18,
      sideExponent: 1.08,
    },
    grossNodeTop: 376,
    opNodeTop: 370,
    netNodeTop: 332,
    opexNodeTop: 612,
    costNodeTop: 804,
    opexSummaryX: 1604,
    opexSummaryY: 874,
    logoScale: 1,
    logoY: 166,
    titleFontSize: 82,
    titleMaxWidth: 1540,
    titleY: 112,
    quarterSummaryY: 136,
    quarterSummaryX: 1932,
    periodEndY: 188,
    periodEndX: 1932,
  },
  ribbon: {
    curveFactor: 0.42,
    topStartBias: 0.18,
    topEndBias: 0.82,
    bottomStartBias: 0.18,
    bottomEndBias: 0.82,
    startCurveFactor: 0.24,
    endCurveFactor: 0.2,
    minStartCurveFactor: 0.1,
    maxStartCurveFactor: 0.28,
    minEndCurveFactor: 0.08,
    maxEndCurveFactor: 0.24,
    deltaScale: 0.58,
    deltaInfluence: 0.11,
    thicknessInfluence: 0.035,
    sourceHorn: {
      startCurveFactor: 0.24,
      endCurveFactor: 0.18,
      minStartCurveFactor: 0.07,
      maxStartCurveFactor: 0.28,
      minEndCurveFactor: 0.06,
      maxEndCurveFactor: 0.22,
      deltaScale: 0.52,
      deltaInfluence: 0.16,
    },
  },
  logo: {
    corporate: BASE_CORPORATE_LOGO_TOKENS,
  },
  bands: BASE_RIGHT_BAND_TOKENS,
};

const TEMPLATE_STYLE_PRESETS = {
  "default-replica": BASE_TEMPLATE_TOKENS,
  "asml-technology-bridge": {
    layout: {
      leftX: 372,
      revenueX: 772,
      grossX: 1144,
      opX: 1492,
      rightX: 1702,
      revenueTop: 322,
      revenueHeight: 470,
      sourceNodeGap: 18,
      sourceNodeMaxY: 1024,
      logoScale: 1.06,
      titleFontSize: 80,
    },
    ribbon: {
      curveFactor: 0.44,
      topStartBias: 0.16,
      topEndBias: 0.84,
      bottomStartBias: 0.16,
      bottomEndBias: 0.84,
    },
  },
  "oracle-revenue-bridge": {
    layout: {
      revenueTop: 326,
      revenueHeight: 462,
      grossNodeTop: 366,
      opNodeTop: 364,
      netNodeTop: 324,
      logoScale: 1.04,
    },
  },
  "mastercard-revenue-bridge": {
    layout: {
      leftX: 360,
      revenueTop: 320,
      revenueHeight: 472,
      grossNodeTop: 372,
      opNodeTop: 366,
      netNodeTop: 328,
      logoScale: 1.08,
    },
    ribbon: {
      curveFactor: 0.45,
      topStartBias: 0.15,
      topEndBias: 0.85,
      bottomStartBias: 0.16,
      bottomEndBias: 0.84,
    },
  },
  "netflix-regional-revenue": {
    layout: {
      leftX: 356,
      revenueTop: 318,
      revenueHeight: 480,
      sourceNodeGap: 12,
      sourceNodeMaxY: 1008,
      grossNodeTop: 372,
      opNodeTop: 364,
      netNodeTop: 326,
      titleFontSize: 80,
    },
    ribbon: {
      curveFactor: 0.44,
      topStartBias: 0.17,
      topEndBias: 0.83,
      bottomStartBias: 0.17,
      bottomEndBias: 0.83,
    },
  },
  "tsmc-platform-mix": {
    layout: {
      leftX: 350,
      revenueTop: 314,
      revenueHeight: 488,
      sourceNodeGap: 10,
      sourceNodeMinY: 300,
      sourceNodeMaxY: 1126,
      grossNodeTop: 378,
      opNodeTop: 372,
      netNodeTop: 334,
      opexNodeTop: 626,
      titleFontSize: 79,
      logoScale: 1.08,
    },
    ribbon: {
      curveFactor: 0.4,
      topStartBias: 0.15,
      topEndBias: 0.85,
      bottomStartBias: 0.16,
      bottomEndBias: 0.84,
    },
  },
};

const STRUCTURAL_PROTOTYPES = {
  "default-replica": {
    label: "Universal revenue bridge",
    tokens: {},
    flags: {},
    defaults: {},
  },
  "triad-lockup-bridge": {
    label: "Triad lockup bridge",
    tokens: {
      layout: {
        revenueX: 734,
        grossX: 1124,
        opX: 1492,
        rightX: 1802,
        sourceNodeGap: 50,
        grossNodeTop: 404,
        opNodeTop: 398,
        netNodeTop: 274,
        opexNodeTop: 708,
        costNodeTop: 838,
        titleFontSize: 88,
        logoX: 680,
        logoY: 178,
        logoScale: 1.1,
      },
    },
    flags: {
      heroLockups: true,
      leftAnchoredRevenueLabel: true,
      compactQuarterLabel: true,
      largeTitle: true,
    },
    defaults: {
      revenueLabelMode: "left",
    },
  },
  "hierarchical-detail-bridge": {
    label: "Hierarchical detail bridge",
    tokenPresetKey: "asml-technology-bridge",
    flags: {
      hierarchicalDetails: true,
    },
    defaults: {},
  },
  "share-platform-mix": {
    label: "Share platform mix",
    tokenPresetKey: "tsmc-platform-mix",
    flags: {
      preferCompactSources: true,
    },
    defaults: {},
  },
  "membership-fee-bridge": {
    label: "Membership fee bridge",
    tokens: {
      layout: {
        leftX: 384,
        revenueX: 790,
        grossX: 1168,
        opX: 1514,
        rightX: 1774,
        opexTargetX: 1748,
        rightLabelX: 1838,
        opexLabelX: 1808,
        belowLabelX: 1838,
        revenueTop: 344,
        revenueHeight: 424,
        chartBottomLimit: 972,
        sourceNodeGap: 32,
        sourceNodeMinY: 352,
        sourceNodeMaxY: 928,
        grossNodeTop: 394,
        opNodeTop: 308,
        netNodeTop: 270,
        opexNodeTop: 622,
        costNodeTop: 762,
        opexSummaryX: 1608,
        opexSummaryY: 820,
        titleFontSize: 78,
        logoScale: 1.1,
      },
      ribbon: {
        curveFactor: 0.44,
      },
    },
    flags: {},
    defaults: {
      costLabel: "Merchandise costs",
      operatingExpensesLabel: "SG&A expenses",
    },
  },
  "apps-labs-bridge": {
    label: "Apps and labs bridge",
    tokens: {
      layout: {
        leftX: 362,
        revenueX: 742,
        grossX: 1120,
        opX: 1482,
        rightX: 1704,
        opexTargetX: 1678,
        rightLabelX: 1768,
        opexLabelX: 1742,
        belowLabelX: 1768,
        revenueTop: 330,
        revenueHeight: 456,
        chartBottomLimit: 986,
        sourceNodeGap: 16,
        sourceNodeMinY: 320,
        sourceNodeMaxY: 980,
        grossNodeTop: 382,
        opNodeTop: 378,
        netNodeTop: 338,
        opexNodeTop: 624,
        costNodeTop: 790,
        opexSummaryX: 1602,
        opexSummaryY: 858,
        titleFontSize: 80,
        logoScale: 0.62,
      },
      ribbon: {
        curveFactor: 0.43,
      },
    },
    flags: {},
    defaults: {
      revenueNodeColor: "#365DD9",
      revenueTextColor: "#29508F",
    },
  },
  "ad-funnel-bridge": {
    label: "Ad funnel bridge",
    tokens: {
      layout: {
        leftDetailX: 196,
        leftX: 432,
        revenueX: 828,
        grossX: 1184,
        opX: 1480,
        rightX: 1710,
        opexTargetX: 1686,
        costBreakdownX: 1298,
        costBreakdownLabelX: 1338,
        rightLabelX: 1774,
        opexLabelX: 1750,
        belowLabelX: 1774,
        sourceSummaryX: 620,
        leftDetailGap: 36,
        revenueLabelX: 946,
        revenueLabelY: 546,
        revenueLabelTitleSize: 34,
        revenueLabelValueSize: 52,
        revenueLabelNoteSize: 21,
        revenueTop: 318,
        revenueHeight: 468,
        chartBottomLimit: 976,
        sourceNodeGap: 28,
        sourceNodeMinY: 310,
        sourceNodeMaxY: 1128,
        summarySourceMaxOffsetFromDetails: 74,
        regularSourceStartAfterDetails: 0,
        regularSourceFloorY: 568,
        microSourceY: 984,
        microSourceLabelX: 610,
        microSourceValueX: 832,
        grossNodeTop: 378,
        opNodeTop: 370,
        netNodeTop: 324,
        opexNodeTop: 602,
        costNodeTop: 776,
        opexSummaryX: 1538,
        opexSummaryY: 820,
        positiveNodeX: 1658,
        positiveLabelX: 1648,
        positiveFloatPadding: 20,
        titleFontSize: 108,
        titleMaxWidth: 1840,
        logoX: 844,
        logoY: 172,
        logoScale: 1.84,
      },
      bands: {
        deductions: {
          minOffsetFromNet: 26,
          maxOffsetAboveOpex: 52,
          minClamp: 432,
          maxClamp: 702,
          gap: 30,
          centerStep: 22,
        },
        costBreakdown: {
          minY: 744,
          maxY: 1004,
          gap: 32,
          centerStart: 804,
          centerStep: 138,
        },
        opex: {
          regular: {
            minY: 700,
            maxY: 1026,
            gap: 38,
            centerStart: 744,
            centerStep: 148,
          },
          dense: {
            minY: 680,
            maxY: 980,
            gap: 22,
            centerStart: 704,
            centerStep: 110,
          },
        },
      },
      ribbon: {
        curveFactor: 0.45,
        topStartBias: 0.15,
        topEndBias: 0.85,
        bottomStartBias: 0.15,
        bottomEndBias: 0.85,
      },
    },
    flags: {
      floatingPositiveAdjustments: true,
      stackRegularSourcesBelowDetails: true,
    },
    defaults: {
      revenueNodeColor: "#4F76E8",
      revenueTextColor: "#4F76E8",
    },
  },
  "commerce-service-bridge": {
    label: "Commerce service bridge",
    tokens: {
      layout: {
        leftX: 332,
        revenueX: 776,
        sourceLabelX: 48,
        sourceTemplateInsetX: 80,
        grossX: 1152,
        opX: 1492,
        rightX: 1724,
        opexTargetX: 1692,
        rightLabelX: 1786,
        opexLabelX: 1756,
        belowLabelX: 1786,
        revenueTop: 320,
        revenueHeight: 466,
        chartBottomLimit: 980,
        sourceNodeGap: 22,
        sourceNodeMinY: 274,
        sourceNodeMaxY: 1020,
        sourceFan: {
          spread: 1.17,
          exponent: 1.18,
          edgeBoost: 32,
          edgeExponent: 1.12,
          bandBias: 0.1,
          sideBoost: 28,
          sideExponent: 1.04,
        },
        microSourceY: 1072,
        microSourceLabelX: 30,
        microSourceValueX: 308,
        grossNodeTop: 376,
        opNodeTop: 332,
        netNodeTop: 288,
        opexNodeTop: 596,
        costNodeTop: 778,
        opexSummaryX: 1528,
        opexSummaryY: 810,
        positiveNodeX: 1658,
        positiveLabelX: 1650,
        positiveFloatPadding: 18,
        operatingProfitBreakdownX: 1506,
        operatingProfitBreakdownY: 528,
        operatingProfitBreakdownWidth: 232,
        operatingProfitBreakdownPointerX: 1618,
        titleFontSize: 104,
        titleMaxWidth: 1820,
        logoX: 720,
        logoY: 166,
        logoScale: 1.58,
      },
      bands: {
        opex: {
          denseThreshold: 4,
          dense: {
            minY: 672,
            maxY: 1042,
            gap: 14,
            minGap: 4,
            centerStart: 694,
            centerStep: 92,
          },
        },
      },
      ribbon: {
        curveFactor: 0.46,
        topStartBias: 0.16,
        topEndBias: 0.84,
        bottomStartBias: 0.16,
        bottomEndBias: 0.84,
        sourceHorn: {
          startCurveFactor: 0.2,
          endCurveFactor: 0.16,
          minStartCurveFactor: 0.06,
          maxStartCurveFactor: 0.24,
          minEndCurveFactor: 0.05,
          maxEndCurveFactor: 0.2,
          deltaScale: 0.48,
          deltaInfluence: 0.18,
        },
      },
    },
    flags: {
      preferCompactSources: true,
      floatingPositiveAdjustments: true,
      leftAnchoredRevenueLabel: true,
    },
    defaults: {
      revenueNodeColor: "#F89E1B",
      revenueTextColor: "#111111",
      costLabel: "Cost of sales",
    },
  },
};

const OFFICIAL_STYLE_TO_PROTOTYPE = {
  "ad-funnel-bridge": "ad-funnel-bridge",
  "alibaba-commerce-staged": "hierarchical-detail-bridge",
  "asml-technology-bridge": "hierarchical-detail-bridge",
  "commerce-service-bridge": "commerce-service-bridge",
  "tsmc-platform-mix": "share-platform-mix",
};

const refs = {};

function queryRefs() {
  refs.heroCoverageText = document.querySelector("#heroCoverageText");
  refs.companyCountPill = document.querySelector("#companyCountPill");
  refs.companySearch = document.querySelector("#companySearch");
  refs.companyList = document.querySelector("#companyList");
  refs.quarterSelect = document.querySelector("#quarterSelect");
  refs.quarterHint = document.querySelector("#quarterHint");
  refs.renderBtn = document.querySelector("#renderBtn");
  refs.downloadSvgBtn = document.querySelector("#downloadSvgBtn");
  refs.downloadPngBtn = document.querySelector("#downloadPngBtn");
  refs.downloadHdBtn = document.querySelector("#downloadHdBtn");
  refs.chartModeToggleBtn = document.querySelector("#chartModeToggleBtn");
  refs.chartEditGroup = document.querySelector("#chartEditGroup");
  refs.editImageBtn = document.querySelector("#editImageBtn");
  refs.resetImageBtn = document.querySelector("#resetImageBtn");
  refs.languageSelect = document.querySelector("#languageSelect");
  refs.overlayToggle = document.querySelector("#overlayToggle");
  refs.overlayFileInput = document.querySelector("#overlayFileInput");
  refs.overlayOpacity = document.querySelector("#overlayOpacity");
  refs.overlayOpacityValue = document.querySelector("#overlayOpacityValue");
  refs.referenceOverlay = document.querySelector("#referenceOverlay");
  refs.templateTokenEditor = document.querySelector("#templateTokenEditor");
  refs.applyTokenBtn = document.querySelector("#applyTokenBtn");
  refs.resetTokenBtn = document.querySelector("#resetTokenBtn");
  refs.downloadTokenBtn = document.querySelector("#downloadTokenBtn");
  refs.calibrationPresetPill = document.querySelector("#calibrationPresetPill");
  refs.tokenStatus = document.querySelector("#tokenStatus");
  refs.statusText = document.querySelector("#statusText");
  refs.chartTitle = document.querySelector("#chartTitle");
  refs.chartMeta = document.querySelector("#chartMeta");
  refs.toolbarCompany = document.querySelector("#toolbarCompany");
  refs.toolbarQuarter = document.querySelector("#toolbarQuarter");
  refs.toolbarUpdatedLabel = document.querySelector("#toolbarUpdatedLabel");
  refs.toolbarUpdatedAt = document.querySelector("#toolbarUpdatedAt");
  refs.chartOutput = document.querySelector("#chartOutput");
  refs.detailSegmentCount = document.querySelector("#detailSegmentCount");
  refs.detailSegmentNote = document.querySelector("#detailSegmentNote");
  refs.detailStatementSummary = document.querySelector("#detailStatementSummary");
  refs.detailStatementNote = document.querySelector("#detailStatementNote");
  refs.detailSourceTitle = document.querySelector("#detailSourceTitle");
  refs.detailSourceNote = document.querySelector("#detailSourceNote");
  refs.footnoteText = document.querySelector("#footnoteText");
  refs.openMicrosoftPreset = document.querySelector("#openMicrosoftPreset");
}

function setStatus(message) {
  if (refs.statusText) refs.statusText.textContent = message;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function deepClone(value) {
  if (Array.isArray(value)) return value.map((item) => deepClone(item));
  if (isPlainObject(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, deepClone(item)]));
  }
  return value;
}

function deepMerge(base, override) {
  if (!isPlainObject(base)) return deepClone(override);
  const result = deepClone(base);
  if (!isPlainObject(override)) return result;
  Object.entries(override).forEach(([key, value]) => {
    if (isPlainObject(value) && isPlainObject(result[key])) {
      result[key] = deepMerge(result[key], value);
      return;
    }
    result[key] = deepClone(value);
  });
  return result;
}

const CURRENCY_SYMBOLS = {
  USD: "$",
  EUR: "€",
  TWD: "NT$",
  CNY: "¥",
  HKD: "HK$",
  JPY: "¥",
  KRW: "₩",
  GBP: "£",
  CAD: "C$",
};

function activeDisplayCurrency() {
  return state.currentSnapshot?.displayCurrency || "USD";
}

function activeDisplayScaleFactor() {
  const raw = Number(state.currentSnapshot?.displayScaleFactor);
  return Number.isFinite(raw) && raw > 0 ? raw : 1;
}

function formatBillions(value, wrapNegative = false) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
  const absolute = Math.abs(Number(value) * activeDisplayScaleFactor()).toFixed(1);
  const currencySymbol = CURRENCY_SYMBOLS[activeDisplayCurrency()] || `${activeDisplayCurrency()} `;
  const label = `${currencySymbol}${absolute}B`;
  if (!wrapNegative || Number(value) >= 0) return label;
  return `(${label})`;
}

function formatBillionsInCurrency(value, currency = "USD", wrapNegative = false) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
  const absolute = Math.abs(Number(value)).toFixed(1);
  const normalizedCurrency = String(currency || "USD").toUpperCase();
  const currencySymbol = CURRENCY_SYMBOLS[normalizedCurrency] || `${normalizedCurrency} `;
  const label = `${currencySymbol}${absolute}B`;
  if (!wrapNegative || Number(value) >= 0) return label;
  return `(${label})`;
}

function formatPct(value, signed = false) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
  const prefix = signed && Number(value) >= 0 ? "+" : "";
  return `${prefix}${Number(value).toFixed(1)}%`;
}

function formatCompactPct(value, signed = false) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
  const numeric = Number(value);
  const prefix = signed && numeric >= 0 ? "+" : "";
  const rounded = Math.round(numeric * 10) / 10;
  const label = Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1);
  return `${prefix}${label}%`;
}

function formatGrowthMetric(value, period = "yoy") {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "";
  const metricLabel = period === "qoq" ? qoqLabel() : yoyLabel();
  const valueLabel = formatPct(value, true);
  if (currentChartLanguage() === "en") {
    return `${metricLabel} ${valueLabel}`;
  }
  return `${metricLabel}${valueLabel}`;
}

function formatPp(value, period = "yoy") {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "";
  const numeric = Math.round(Number(value) * 10) / 10;
  const prefix = numeric >= 0 ? "+" : "";
  const rounded = Number.isInteger(numeric) ? numeric.toFixed(0) : numeric.toFixed(1);
  const metricLabel = period === "qoq" ? qoqLabel() : yoyLabel();
  if (currentChartLanguage() === "en") return `${metricLabel} ${prefix}${rounded}pp`;
  return `${metricLabel}${prefix}${rounded}个百分点`;
}

function parseLegacyPpDelta(raw) {
  const normalized = String(raw || "").trim();
  if (!normalized) return null;
  const parenthesesMatch = normalized.match(/^\(([-+]?\d+(?:\.\d+)?)pp\)$/i);
  if (parenthesesMatch) {
    return -Math.abs(Number(parenthesesMatch[1]));
  }
  const simpleMatch = normalized.match(/^([+-]?\d+(?:\.\d+)?)pp$/i);
  if (simpleMatch) {
    return Number(simpleMatch[1]);
  }
  return null;
}

function parseShareMetricNote(rawNote) {
  const normalized = String(rawNote || "").trim().replace(/\s+/g, " ");
  if (!normalized) return null;
  const match = normalized.match(
    /^([-+]?\d+(?:\.\d+)?)%\s+(of revenue|of sales)(?:\s+(\([^)]+pp\)|[+-]?\d+(?:\.\d+)?pp)\s+(Y\/Y|Q\/Q))?$/i
  );
  if (!match) return null;
  return {
    sharePct: Number(match[1]),
    basis: match[2].toLowerCase(),
    deltaPp: match[3] ? parseLegacyPpDelta(match[3]) : null,
    period: match[4] ? match[4].toLowerCase() : null,
  };
}

function shareMetricBasisLabel(basis = "of revenue") {
  if (currentChartLanguage() === "en") {
    return basis === "of sales" ? "of sales" : "of revenue";
  }
  return basis === "of sales" ? "占销售额比重" : "占营收比重";
}

function formatShareMetricNote(sharePct, options = {}) {
  if (sharePct === null || sharePct === undefined || Number.isNaN(Number(sharePct))) return "";
  const basis = options.basis || "of revenue";
  const shareLabel = `${formatCompactPct(sharePct)} ${shareMetricBasisLabel(basis)}`;
  const period = options.period === "qoq" ? "qoq" : "yoy";
  if (options.deltaPp === null || options.deltaPp === undefined || Number.isNaN(Number(options.deltaPp))) {
    return shareLabel;
  }
  const deltaLabel = formatPp(options.deltaPp, period);
  if (!deltaLabel) return shareLabel;
  return `${shareLabel} ${deltaLabel}`;
}

function structuredChartNote(rawNote) {
  const parsedShareMetric = parseShareMetricNote(rawNote);
  if (parsedShareMetric) {
    return formatShareMetricNote(parsedShareMetric.sharePct, {
      basis: parsedShareMetric.basis,
      deltaPp: parsedShareMetric.deltaPp,
      period: parsedShareMetric.period,
    });
  }
  return null;
}

function structuredChartNoteLines(rawNote) {
  const parsedShareMetric = parseShareMetricNote(rawNote);
  if (!parsedShareMetric) return null;
  const shareLine = `${formatCompactPct(parsedShareMetric.sharePct)} ${shareMetricBasisLabel(parsedShareMetric.basis)}`;
  const deltaLine =
    parsedShareMetric.deltaPp !== null && parsedShareMetric.deltaPp !== undefined
      ? formatPp(parsedShareMetric.deltaPp, parsedShareMetric.period === "qoq" ? "qoq" : "yoy")
      : "";
  return deltaLine ? [shareLine, deltaLine] : [shareLine];
}

function displayChartNote(rawNote) {
  const structured = structuredChartNote(rawNote);
  if (structured) return structured;
  return localizeChartPhrase(rawNote || "");
}

function formatSourceMetric(item) {
  return formatBillions(item?.valueBn);
}

function displayChartTitle(title) {
  return String(title || "")
    .replace(/\s+income statement\s*$/i, "")
    .trim();
}

function currentChartLanguage() {
  return state.uiLanguage === "en" ? "en" : "zh";
}

function currentChartViewMode() {
  return state.chartViewMode === "bars" ? "bars" : "sankey";
}

function chartModeToggleLabel() {
  if (currentChartLanguage() === "en") {
    return currentChartViewMode() === "bars" ? "Switch to Sankey" : "Switch to Bars";
  }
  return currentChartViewMode() === "bars" ? "切换到桑基图" : "切换到柱状图";
}

function syncChartModeToggleUi() {
  if (!refs.chartModeToggleBtn) return;
  refs.chartModeToggleBtn.textContent = chartModeToggleLabel();
  refs.chartModeToggleBtn.classList.toggle("is-bars", currentChartViewMode() === "bars");
  if (refs.chartEditGroup) {
    refs.chartEditGroup.hidden = currentChartViewMode() === "bars";
  }
}

const CHART_TEXT_TRANSLATIONS_ZH = {
  revenue: "营收",
  "reported revenue": "报告营收",
  "gross profit": "毛利润",
  "gross margin": "毛利率",
  "cost of revenue": "营收成本",
  "cost of revenues": "营收成本",
  "cost of sales": "销售成本",
  "operating profit": "营业利润",
  "operating expenses": "营业费用",
  "residual opex": "其余营业费用",
  "net profit": "净利润",
  "net loss": "净亏损",
  tax: "税项",
  other: "其他",
  "r&d": "研发",
  "r&d expenses": "研发费用",
  "s&m": "销售与营销",
  "s&m expenses": "销售与营销费用",
  "g&a": "一般及行政",
  "g&a expenses": "一般及行政费用",
  "sg&a": "销售、一般及行政",
  "sg&a expenses": "销售、一般及行政费用",
  "research & development": "研发",
  "sales, general & admin": "销售、一般及行政",
  "technology & content": "技术与内容",
  fulfillment: "履约",
  "other opex": "其他营业费用",
  "non-operating gain": "营业外收益",
  "non-operating": "营业外项目",
  "tax benefit": "税收收益",
  "ad revenue": "广告营收",
  "all other segments": "其他业务",
  "data center": "数据中心",
  gaming: "游戏",
  "professional visualization": "专业可视化",
  automotive: "汽车",
  "oem & other": "OEM 与其他",
  products: "产品",
  services: "服务",
  "productivity & business processes": "生产力与业务流程",
  "productivity &": "生产力与",
  business: "业务",
  processes: "流程",
  intelligent: "智能",
  cloud: "云",
  "intelligent cloud": "智能云",
  "more personal": "更多个人",
  computing: "计算",
  "more personal computing": "更多个人计算",
  "google services": "谷歌服务",
  "google search": "谷歌搜索",
  youtube: "YouTube 广告",
  "google admob": "移动广告联盟",
  "google network": "谷歌广告网络",
  "google cloud": "谷歌云",
  "google play": "应用商店",
  "amazon web services": "亚马逊云服务",
  aws: "AWS",
  "online stores": "在线商店",
  advertising: "广告",
  "advertising services": "广告服务",
  subscription: "订阅",
  "subscription services": "订阅服务",
  "physical stores": "实体门店",
  "physical store": "实体门店",
  "third party seller services": "第三方卖家服务",
  "3rd party sellers services": "第三方卖家服务",
  "other services": "其他服务",
  "high performance computing": "高性能计算",
  smartphones: "智能手机",
  "internet of things": "物联网",
  "digital consumer electronics": "数字消费电子",
  others: "其他",
  "family of apps": "应用家族",
  "family of apps (foa)": "应用家族（FoA）",
  "family of apps (foa": "应用家族（FoA",
  "reality labs": "现实实验室",
  auto: "汽车业务",
  "energy generation & storage": "能源发电与储能",
  leasing: "租赁",
  "regulatory credits": "监管积分",
  software: "软件",
  hardware: "硬件",
  membership: "会员费",
  "sams club": "山姆会员店",
  "sams club us": "山姆美国",
  "walmart us": "沃尔玛美国",
  "walmart international": "沃尔玛国际",
  "asset & wealth management": "资产与财富管理",
  "commercial & investment bank": "商业与投资银行",
  "commercial banking": "商业银行",
  "consumer community banking": "消费者与社区银行",
  "global banking": "全球银行",
  "global markets": "全球市场",
  "global wealth & investment management": "全球财富与投资管理",
  "data processing revenues": "数据处理营收",
  "international transaction revenues": "国际交易营收",
  "value added services": "增值服务",
  "value-added services and solutions": "增值服务与解决方案",
  "installed base management": "存量设备管理",
  "net system sales": "系统销售净额",
  "official: search & other": "官方口径：搜索及其他",
  "official: google network": "官方口径：谷歌广告网络",
  "official: subscriptions, platforms, and devices": "官方口径：订阅、平台与设备",
  "other bets + hedging": "其他创新业务与套保",
  tac: "流量获取成本",
  "pilot travel centers": "Pilot 旅行中心",
  "auto sales": "汽车销售",
  "consulting + support": "咨询与支持",
  "license + on-prem": "许可证与本地部署",
  "cloud applications": "云应用",
  "cloud infrastructure": "云基础设施",
  "cloud services + support": "云服务与支持",
  "hardware systems": "硬件系统",
  "software license": "软件许可证",
  "software support": "软件支持",
  "merchandise net sales": "商品净销售额",
  "merchandise costs": "商品成本",
  merchandise: "商品",
  "net sales": "净销售额",
  costs: "成本",
  expenses: "费用",
  "cyber + data + loyalty": "网络安全、数据与忠诚度",
  "asia-pacific": "亚太",
  "europe + mea": "欧洲、中东和非洲",
  "latin america": "拉丁美洲",
  "us + canada": "美国和加拿大",
  "mobile soc": "移动 SoC",
  "other platforms": "其他平台",
  iot: "物联网",
  dce: "数字消费电子",
  inspection: "检测",
  metrology: "计量",
  "extreme ultraviolet": "极紫外光刻",
  "argon fluoride dry": "氩氟干式光刻",
  "argon fluoride immersion": "氩氟浸润式光刻",
  "krypton fluoride": "氪氟光刻",
  "mercury i-line": "汞灯 I-line 光刻",
  "yieldstar · e-beam": "YieldStar · 电子束",
  "ai · cloud · dgx": "AI · 云 · DGX",
  "geforce · gaming gpus": "GeForce · 游戏 GPU",
  "drive platform": "自动驾驶平台",
  "oem · legacy": "OEM · 旧平台",
  "rtx workstation": "RTX 工作站",
  "ai · accelerator · server": "AI · 加速器 · 服务器",
  apac: "亚太",
  emea: "欧洲、中东和非洲",
  latam: "拉丁美洲",
  ucan: "美国和加拿大",
  "non-operating gain ": "营业外收益",
};

const CHART_LABEL_TRANSLATIONS_ZH_EXACT = {
  "3rd party sellers services": "第三方卖家服务",
  aebu: "汽车与嵌入式业务单元",
  apac: "亚太",
  aws: "AWS",
  "ad revenue": "广告营收",
  advertising: "广告",
  "advertising services": "广告服务",
  "all other segments": "其他业务",
  "amazon web services": "亚马逊云服务",
  "asset & wealth management": "资产与财富管理",
  auto: "汽车业务",
  automotive: "汽车",
  "baby feminine & family care": "婴儿、女性及家庭护理",
  "baby feminine family care": "婴儿、女性及家庭护理",
  beauty: "美容",
  "berkshire hathaway energy company": "伯克希尔哈撒韦能源",
  "berkshire hathaway insurance group": "伯克希尔哈撒韦保险集团",
  "burlington northern santa fe corporation": "伯灵顿北方圣太菲铁路",
  cmbu: "云内存业务单元",
  cnbu: "计算与网络业务单元",
  "consumerhealth & pharmaceutical": "消费健康与制药",
  "covid19 antibodies": "新冠抗体",
  "cardiometabolic health": "心血管代谢健康",
  cloud: "云",
  "collaboration & other revenue": "合作及其他营收",
  commercial: "商业",
  "commercial & investment bank": "商业与投资银行",
  "commercial banking": "商业银行",
  "commercial operating": "商业业务",
  "concentrate operations": "浓缩液业务",
  consumer: "消费者业务",
  "consumer banking": "消费者银行",
  "consumer community banking": "消费者与社区银行",
  corporate: "企业及其他",
  "corporate & investment bank": "企业与投资银行",
  "corporate investment bank": "企业投资银行",
  "cross-border volume fees": "跨境交易量费用",
  "data center": "数据中心",
  "data processing revenues": "数据处理营收",
  diabetes: "糖尿病",
  "diabetes & obesity": "糖尿病与肥胖",
  "digital consumer electronics": "数字消费电子",
  "domestic assessments": "国内评估费",
  downstream: "下游",
  "downstream equipment": "下游设备",
  ebu: "嵌入式业务单元",
  emea: "欧洲、中东和非洲",
  "energy generation & storage": "能源发电与储能",
  "fabric & home care": "织物与家居护理",
  "fabric home care": "织物与家居护理",
  "family of apps": "应用家族",
  "family of apps (foa)": "应用家族（FoA）",
  "family of apps (foa": "应用家族（FoA",
  "financial products": "金融产品",
  "finished product operations": "成品业务",
  "food & sundries": "食品与杂货",
  "foods & sundries": "食品与杂货",
  "fresh food": "生鲜食品",
  "fresh foods": "生鲜食品",
  gaming: "游戏",
  "global banking": "全球银行",
  "global markets": "全球市场",
  "global wealth & investment management": "全球财富与投资管理",
  "google cloud": "谷歌云",
  "google play": "应用商店",
  "google search": "谷歌搜索",
  "google services": "谷歌服务",
  "google admob": "移动广告联盟",
  youtube: "YouTube 广告",
  "government operating": "政府业务",
  grooming: "个护美容",
  hardlines: "硬装及耐用品",
  hardware: "硬件",
  "health care": "医疗健康",
  "high performance computing": "高性能计算",
  "income from equity affiliates": "权益法投资收益",
  "infrastructure software": "基础设施软件",
  "innovative medicine": "创新药",
  "installed base management": "存量设备管理",
  "insurance corporate & other": "保险、企业及其他",
  "intelligent cloud": "智能云",
  "international transaction revenues": "国际交易营收",
  "internet of things": "物联网",
  latam: "拉丁美洲",
  leasing: "租赁",
  mbu: "移动业务单元",
  mcbu: "移动与客户端业务单元",
  "machinery energy transportation": "机械、能源与运输",
  "major product line building materials": "主要产品线：建筑材料",
  "major product line dcor": "主要产品线：家居装饰",
  "major product line hardlines": "主要产品线：硬装及耐用品",
  "manufacturing businesses": "制造业务",
  "mc lane company": "麦克莱恩公司",
  "med tech": "医疗科技",
  "medical devices": "医疗器械",
  membership: "会员费",
  "more personal computing": "更多个人计算",
  "net system sales": "系统销售净额",
  neuroscience: "神经科学",
  "non foods": "非食品",
  "oem & other": "OEM 与其他",
  oncology: "肿瘤",
  "online stores": "在线商店",
  other: "其他",
  "other aesthetics": "其他美学",
  "other cardiometabolic health": "其他心血管代谢健康",
  "other diabetes": "其他糖尿病",
  "other diabetes & obesity": "其他糖尿病与肥胖",
  "other eye care": "其他眼科",
  "other immunology": "其他免疫",
  "other neuroscience": "其他神经科学",
  "other oncology": "其他肿瘤",
  "other product": "其他产品",
  "other product total": "其他产品合计",
  "other products": "其他产品",
  "other revenue": "其他营收",
  "other revenue interest": "其他营收及利息",
  "other services": "其他服务",
  "other womens health": "其他女性健康",
  "other revenues": "其他营收",
  others: "其他",
  "payment network": "支付网络",
  "pilot travel centers": "Pilot 旅行中心",
  pharmaceutical: "制药",
  "physical store": "实体门店",
  "physical stores": "实体门店",
  "pilot travel centers llc": "Pilot 旅行中心",
  "pilot travel centers limited liability company": "Pilot 旅行中心",
  "productivity & business processes": "生产力与业务流程",
  products: "产品",
  "professional visualization": "专业可视化",
  "reality labs": "现实实验室",
  "regulatory credits": "监管积分",
  royalty: "特许权使用费",
  sbu: "存储业务单元",
  "sales & other operating revenue": "销售及其他营业收入",
  "sams club": "山姆会员店",
  "sams club us": "山姆会员店美国",
  "semiconductor solutions": "半导体解决方案",
  "service & retailing businesses": "服务与零售业务",
  services: "服务",
  smartphones: "智能手机",
  softlines: "软装及服饰",
  software: "软件",
  subscription: "订阅",
  "subscription services": "订阅服务",
  "third party seller services": "第三方卖家服务",
  "transaction processing": "交易处理",
  "tax": "税项",
  "r&d": "研发",
  "r&d expenses": "研发费用",
  "s&m": "销售与营销",
  "s&m expenses": "销售与营销费用",
  "g&a": "一般及行政",
  "g&a expenses": "一般及行政费用",
  "sg&a": "销售、一般及行政",
  "sg&a expenses": "销售、一般及行政费用",
  "residual opex": "其余营业费用",
  "other opex": "其他营业费用",
  "non-operating": "营业外项目",
  "cost of sales": "销售成本",
  "reported revenue": "报告营收",
  "other bets + hedging": "其他创新业务与套保",
  tac: "流量获取成本",
  "auto sales": "汽车销售",
  iphone: "iPhone 手机",
  ipad: "iPad 平板",
  mac: "Mac 电脑",
  wearables: "可穿戴设备",
  euv: "EUV 光刻",
  arfi: "ArF 浸润式光刻",
  "arf dry": "ArF 干式光刻",
  krf: "KrF 光刻",
  "i-line": "I-line 光刻",
  "inspection": "检测",
  "metrology": "计量",
  "yieldstar · e-beam": "YieldStar · 电子束",
  "official: search & other": "官方口径：搜索及其他",
  "official: google network": "官方口径：谷歌广告网络",
  "official: subscriptions, platforms, and devices": "官方口径：订阅、平台与设备",
  "consulting + support": "咨询与支持",
  "license + on-prem": "许可证与本地部署",
  "cloud applications": "云应用",
  "cloud infrastructure": "云基础设施",
  "cloud services + support": "云服务与支持",
  "hardware systems": "硬件系统",
  "software license": "软件许可证",
  "software support": "软件支持",
  "cyber + data + loyalty": "网络安全、数据与忠诚度",
  "asia-pacific": "亚太",
  "europe + mea": "欧洲、中东和非洲",
  "latin america": "拉丁美洲",
  "us + canada": "美国和加拿大",
  "mobile soc": "移动 SoC",
  "other platforms": "其他平台",
  iot: "物联网",
  dce: "数字消费电子",
  cdbu: "云与数据中心业务单元",
  "extreme ultraviolet": "极紫外光刻",
  "argon fluoride dry": "氩氟干式光刻",
  "argon fluoride immersion": "氩氟浸润式光刻",
  "krypton fluoride": "氪氟光刻",
  "mercury i-line": "汞灯 I-line 光刻",
  "merchandise net sales": "商品净销售额",
  "merchandise costs": "商品成本",
  merchandise: "商品",
  "net sales": "净销售额",
  costs: "成本",
  expenses: "费用",
  "ai · cloud · dgx": "AI · 云 · DGX",
  "geforce · gaming gpus": "GeForce · 游戏 GPU",
  "drive platform": "自动驾驶平台",
  "oem · legacy": "OEM · 旧平台",
  "rtx workstation": "RTX 工作站",
  "ai · accelerator · server": "AI · 加速器 · 服务器",
  humira: "修美乐",
  imbruvica: "亿珂",
  skyrizi: "利生奇珠单抗",
  creon: "得每通",
  mavyret: "MAVYRET（格卡瑞韦/哌仑他韦）",
  venclexta: "维奈克拉",
  vraylar: "卡立普拉嗪",
  rinvoq: "乌帕替尼",
  lupron: "Lupron（亮丙瑞林）",
  synthroid: "Synthroid（左甲状腺素）",
  duodopa: "Duodopa（左旋多巴肠凝胶）",
  "botox therapeutic": "保妥适治疗",
  "botox cosmetic": "保妥适美容",
  "juvederm collection": "乔雅登系列",
  "linzess constella": "Linzess / Constella",
  "lumigan ganfort": "Lumigan / Ganfort",
  "alphagan combigan": "Alphagan / Combigan",
  restasis: "丽爱思",
  ubrelvy: "乌布罗吉泮",
  ozurdex: "地塞米松植入剂",
  qulipta: "阿托吉泮",
  epkinly: "艾可瑞妥单抗",
  elahere: "米妥索单抗",
  vyalev: "左旋多巴/卡比多巴",
  "orilissa oriahnn": "Orilissa / Oriahnn",
  "lo loestrin": "Lo Loestrin（避孕药）",
  jardiance: "恩格列净",
  taltz: "依奇珠单抗",
  verzenio: "阿贝西利",
  basaglar: "甘精胰岛素",
  cyramza: "雷莫西尤单抗",
  emgality: "加卡奈珠单抗",
  erbitux: "西妥昔单抗",
  humalog: "赖脯胰岛素",
  humulin: "人胰岛素",
  forteo: "特立帕肽",
  "trajenta bi": "利格列汀",
  olumiant: "巴瑞替尼",
  alimta: "培美曲塞",
  cialis: "他达拉非",
  cymbalta: "度洛西汀",
  zyprexa: "奥氮平",
  mounjaro: "替尔泊肽",
  trulicity: "度拉糖肽",
  "trulicity member": "度拉糖肽",
  zepbound: "替尔泊肽减重",
  tyvyt: "达伯舒",
  baqsimi: "Baqsimi（胰高血糖素鼻喷）",
  ucan: "美国和加拿大",
  upstream: "上游",
  "upstream equipment": "上游设备",
  "value-added services": "增值服务",
  "value added services": "增值服务",
  "value-added services and solutions": "增值服务与解决方案",
  "marketing services": "营销服务",
  "fintech and business services": "金融科技与企业服务",
  "domestic games": "本土游戏",
  "international games": "国际游戏",
  "social networks": "社交网络",
  "alibaba china e-commerce group": "阿里巴巴中国电商集团",
  "alibaba international digital commerce group": "阿里国际数字商业集团",
  commerce: "商业",
  "cloud computing": "云计算",
  cloud: "云业务",
  "china commerce": "中国商业",
  "international commerce": "国际商业",
  "cloud intelligence": "云智能",
  "other businesses": "其他业务",
  "cloud intelligence group": "云智能集团",
  "all others": "其他业务",
  "quick commerce": "即时零售",
  "china commerce wholesale": "中国批发商业",
  "local consumer services": "本地消费者服务",
  "local consumer services and others": "本地消费者服务及其他",
  "cloud business": "云业务",
  "digital media and entertainment": "数字媒体及娱乐",
  "innovation initiatives and others": "创新业务及其他",
  "international commerce retail": "国际零售商业",
  "international commerce wholesale": "国际批发商业",
  "direct sales and others": "直销及其他",
  "direct sales, logistics and others": "直销、物流及其他",
  "taobao and tmall group": "淘天集团",
  "cainiao smart logistics network limited": "菜鸟",
  "local services group": "本地生活集团",
  "digital media and entertainment group": "大文娱集团",
  "walmart international": "沃尔玛国际",
  "walmart us": "沃尔玛美国",
};

const CHART_LABEL_TRANSLATIONS_ZH_PHRASES = {
  "other womens health": "其他女性健康",
  "other eye care": "其他眼科",
  "other neuroscience": "其他神经科学",
  "other oncology": "其他肿瘤",
  "other immunology": "其他免疫",
  "other diabetes & obesity": "其他糖尿病与肥胖",
  "other diabetes": "其他糖尿病",
  "other cardiometabolic health": "其他心血管代谢健康",
  "high performance computing": "高性能计算",
  "internet of things": "物联网",
  "digital consumer electronics": "数字消费电子",
  "energy generation & storage": "能源发电与储能",
  "asset & wealth management": "资产与财富管理",
  "commercial & investment bank": "商业与投资银行",
  "corporate & investment bank": "企业与投资银行",
  "consumer community banking": "消费者与社区银行",
  "global wealth & investment management": "全球财富与投资管理",
  "value-added services and solutions": "增值服务与解决方案",
  "sales & other operating revenue": "销售及其他营业收入",
  "service & retailing businesses": "服务与零售业务",
  "manufacturing businesses": "制造业务",
  "concentrate operations": "浓缩液业务",
  "finished product operations": "成品业务",
  "installed base management": "存量设备管理",
  "net system sales": "系统销售净额",
  "major product line building materials": "主要产品线：建筑材料",
  "major product line dcor": "主要产品线：家居装饰",
  "major product line hardlines": "主要产品线：硬装及耐用品",
};

const CHART_LABEL_TRANSLATIONS_ZH_TOKENS = {
  asset: "资产",
  wealth: "财富",
  management: "管理",
  commercial: "商业",
  investment: "投资",
  bank: "银行",
  banking: "银行",
  corporate: "企业",
  consumer: "消费者",
  community: "社区",
  costs: "成本",
  global: "全球",
  market: "市场",
  markets: "市场",
  data: "数据",
  processing: "处理",
  international: "国际",
  transaction: "交易",
  transactions: "交易",
  revenues: "营收",
  revenue: "营收",
  value: "增值",
  added: "增值",
  solutions: "解决方案",
  solution: "解决方案",
  payment: "支付",
  network: "网络",
  service: "服务",
  services: "服务",
  retailing: "零售",
  retail: "零售",
  business: "业务",
  businesses: "业务",
  subscriptions: "订阅",
  manufacturing: "制造",
  insurance: "保险",
  company: "公司",
  group: "集团",
  energy: "能源",
  cloud: "云",
  memory: "内存",
  core: "核心",
  center: "中心",
  centres: "中心",
  centre: "中心",
  mobile: "移动",
  client: "客户端",
  clients: "客户端",
  automotive: "汽车",
  embedded: "嵌入式",
  compute: "计算",
  computing: "计算",
  networking: "网络",
  storage: "存储",
  downstream: "下游",
  upstream: "上游",
  equipment: "设备",
  concentrate: "浓缩液",
  operations: "业务",
  finished: "成品",
  food: "食品",
  foods: "食品",
  sundries: "杂货",
  fresh: "生鲜",
  hardlines: "硬装及耐用品",
  softlines: "软装及服饰",
  non: "非",
  beauty: "美容",
  fabric: "织物",
  home: "家居",
  care: "护理",
  baby: "婴儿",
  feminine: "女性",
  family: "家庭",
  health: "健康",
  collaboration: "合作",
  antibodies: "抗体",
  cardiometabolic: "心血管代谢",
  diabetes: "糖尿病",
  obesity: "肥胖",
  immunology: "免疫",
  neuroscience: "神经科学",
  oncology: "肿瘤",
  royalty: "特许权使用费",
  medical: "医疗",
  devices: "器械",
  device: "设备",
  innovative: "创新",
  medicine: "药",
  products: "产品",
  product: "产品",
  other: "其他",
  womens: "女性",
  "women's": "女性",
  online: "在线",
  official: "官方口径",
  store: "门店",
  stores: "门店",
  search: "搜索",
  physical: "实体",
  advertising: "广告",
  platform: "平台",
  platforms: "平台",
  device: "设备",
  devices: "设备",
  subscription: "订阅",
  subscriptions: "订阅",
  software: "软件",
  license: "许可证",
  licenses: "许可证",
  hardware: "硬件",
  semiconductor: "半导体",
  financial: "金融",
  machinery: "机械",
  transportation: "运输",
  operating: "运营",
  residual: "剩余",
  opex: "营业费用",
  tax: "税项",
  gross: "毛",
  margin: "利润率",
  reported: "报告",
  sales: "销售",
  consulting: "咨询",
  support: "支持",
  inspection: "检测",
  metrology: "计量",
  server: "服务器",
  servers: "服务器",
  accelerator: "加速器",
  workstation: "工作站",
  drive: "自动驾驶",
  gpu: "GPU",
  gpus: "GPU",
  legacy: "旧平台",
  dry: "干式",
  immersion: "浸润式",
  argon: "氩氟",
  krypton: "氪氟",
  mercury: "汞灯",
  beam: "电子束",
  applications: "应用",
  application: "应用",
  infrastructure: "基础设施",
  systems: "系统",
  net: "净",
  government: "政府",
  intelligent: "智能",
  productivity: "生产力",
  processes: "流程",
  more: "更多",
  personal: "个人",
  high: "高",
  performance: "性能",
  internet: "互联网",
  things: "物联网",
  digital: "数字",
  iot: "物联网",
  dce: "数字消费电子",
  consumerhealth: "消费健康",
  pharmaceutical: "制药",
  med: "医疗",
  tech: "科技",
};

function normalizeTranslationKey(text) {
  return String(text || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function translateBusinessLabelToZh(text) {
  const raw = String(text || "").trim();
  if (!raw) return raw;
  const normalized = normalizeTranslationKey(raw);
  const exact = CHART_LABEL_TRANSLATIONS_ZH_EXACT[normalized];
  if (exact) return exact;

  const tokenSource = raw
    .replace(/&/g, " & ")
    .replace(/\//g, " / ")
    .replace(/\(/g, " ( ")
    .replace(/\)/g, " ) ")
    .replace(/,/g, " , ")
    .replace(/:/g, " : ")
    .replace(/\+/g, " + ")
    .replace(/·/g, " · ")
    .replace(/-/g, " - ")
    .replace(/\s+/g, " ")
    .trim();
  const tokens = tokenSource ? tokenSource.split(" ") : [];
  if (!tokens.length) return raw;

  const phraseEntries = Object.entries(CHART_LABEL_TRANSLATIONS_ZH_PHRASES)
    .map(([source, target]) => ({
      sourceTokens: source.split(" "),
      target,
    }))
    .sort((left, right) => right.sourceTokens.length - left.sourceTokens.length);

  const pieces = [];
  let translatedCount = 0;
  let unknownCount = 0;
  for (let index = 0; index < tokens.length; ) {
    const token = tokens[index];
    if (token === "&") {
      pieces.push("与");
      translatedCount += 1;
      index += 1;
      continue;
    }
    if (token === "/") {
      pieces.push("/");
      index += 1;
      continue;
    }
    if (token === "," || token === "(" || token === ")" || token === "-" || token === ":" || token === "+" || token === "·") {
      pieces.push(token);
      index += 1;
      continue;
    }

    let matched = null;
    for (const entry of phraseEntries) {
      const slice = tokens.slice(index, index + entry.sourceTokens.length).map((value) => normalizeTranslationKey(value));
      if (slice.length !== entry.sourceTokens.length) continue;
      if (entry.sourceTokens.every((value, phraseIndex) => value === slice[phraseIndex])) {
        matched = entry;
        break;
      }
    }
    if (matched) {
      pieces.push(matched.target);
      translatedCount += matched.sourceTokens.length;
      index += matched.sourceTokens.length;
      continue;
    }

    const normalizedToken = normalizeTranslationKey(token);
    const translatedToken = CHART_LABEL_TRANSLATIONS_ZH_TOKENS[normalizedToken];
    if (translatedToken) {
      pieces.push(translatedToken);
      translatedCount += 1;
      index += 1;
      continue;
    }

    if (/^[A-Z0-9.+]+$/.test(token) || /^[A-Z][a-z]+$/.test(token)) {
      pieces.push(token);
      index += 1;
      continue;
    }

    unknownCount += 1;
    pieces.push(token);
    index += 1;
  }

  if (!translatedCount || unknownCount > Math.max(1, Math.floor(tokens.length * 0.34))) {
    return raw;
  }

  return pieces
    .join(" ")
    .replace(/\s+\)/g, ")")
    .replace(/\(\s+/g, "(")
    .replace(/\s+,/g, ",")
    .replace(/\s+:\s+/g, "：")
    .replace(/\s+\/\s+/g, "/")
    .replace(/\s+\+\s+/g, " + ")
    .replace(/\s+·\s+/g, " · ")
    .replace(/\s+-\s+/g, "-")
    .replace(/\s+/g, " ")
    .replace(/([\u3400-\u9FFF])\s+([\u3400-\u9FFF])/gu, "$1$2")
    .replace(/([\u3400-\u9FFF])\s+([A-Za-z0-9])/gu, "$1$2")
    .replace(/([A-Za-z0-9])\s+([\u3400-\u9FFF])/gu, "$1$2")
    .trim();
}

function localizeChartItemName(item) {
  if (currentChartLanguage() === "en") return String(item?.name || "");
  if (item?.nameZh) return String(item.nameZh);
  return translateBusinessLabelToZh(item?.name || "");
}

function localizeChartPhrase(text) {
  const raw = String(text || "");
  if (!raw || currentChartLanguage() === "en") return raw;
  const structuredNote = structuredChartNote(raw);
  if (structuredNote) return structuredNote;
  const trimmed = raw.trim();
  const exact = CHART_TEXT_TRANSLATIONS_ZH[trimmed] || CHART_TEXT_TRANSLATIONS_ZH[normalizeTranslationKey(trimmed)];
  let translated = exact || trimmed;
  if (!exact) {
    const escaped = Object.entries(CHART_TEXT_TRANSLATIONS_ZH)
      .filter(([source]) => /[\s&()/.-]/.test(source))
      .sort((left, right) => right[0].length - left[0].length)
      .map(([source, target]) => ({
        pattern: new RegExp(source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"),
        target,
      }));
    escaped.forEach(({ pattern, target }) => {
      translated = translated.replace(pattern, target);
    });
  }
  if (translated === trimmed) {
    const autoTranslated = translateBusinessLabelToZh(trimmed);
    if (autoTranslated && autoTranslated !== trimmed) {
      translated = autoTranslated;
    }
  }
  return translated
    .replace(/\bY\/Y\b/g, "同比")
    .replace(/\bQ\/Q\b/g, "环比")
    .replace(/\(([-+]?\d+(?:\.\d+)?)pp\)/gi, "($1个百分点)")
    .replace(/([+-]?\d+(?:\.\d+)?)pp/gi, "$1个百分点")
    .replace(/\bmargin\b/gi, "利润率")
    .replace(/gross\s*利润率/gi, "毛利率")
    .replace(/\bof revenue\b/gi, "占营收比重")
    .replace(/of营收/gi, "占营收比重")
    .replace(/of 营收/gi, "占营收比重");
}

function localizeChartLines(lines = []) {
  return (lines || []).map((line) => localizeChartPhrase(line));
}

function resolveLocalizedSupportLines(item, explicitLines = null, explicitZhLines = null) {
  if (currentChartLanguage() === "zh") {
    const preferredZhLines = Array.isArray(explicitZhLines) ? explicitZhLines : item?.supportLinesZh;
    if (preferredZhLines?.length) {
      return preferredZhLines.map((line) => String(line || "").trim()).filter(Boolean);
    }
    if (Array.isArray(explicitZhLines) && !explicitZhLines.length) return [];
  }
  if (Array.isArray(explicitLines)) {
    return explicitLines.map((line) => String(line || "").trim()).filter(Boolean);
  }
  const sourceLines = item?.supportLines || [];
  return localizeChartLines(sourceLines);
}

function isCjkLabelText(text) {
  return /[\u3400-\u9FFF\uF900-\uFAFF]/u.test(String(text || ""));
}

function splitBalancedCjkLabel(text, lineCount = 2) {
  const chars = [...String(text || "").trim()];
  if (!chars.length || lineCount <= 1) return chars.length ? [chars.join("")] : [];
  if (lineCount === 2 && chars.length >= 7 && String(text || "").includes("、")) {
    const preferredSplit = clamp(Math.round(chars.length * 0.62), 2, chars.length - 2);
    return [chars.slice(0, preferredSplit).join(""), chars.slice(preferredSplit).join("")].filter(Boolean);
  }
  const lines = [];
  let cursor = 0;
  for (let index = 0; index < lineCount; index += 1) {
    const remainingChars = chars.length - cursor;
    const remainingLines = lineCount - index;
    const take = Math.ceil(remainingChars / remainingLines);
    lines.push(chars.slice(cursor, cursor + take).join(""));
    cursor += take;
  }
  return lines.filter(Boolean);
}

function wrapLabelWithMaxWidth(text, fontSize, maxWidth, options = {}) {
  const raw = String(text || "").trim();
  if (!raw) return [];
  const maxLines = Math.max(safeNumber(options.maxLines, 2), 1);
  const widthLimit = Math.max(safeNumber(maxWidth, 140), 60);
  if (approximateTextWidth(raw, fontSize) <= widthLimit) return [raw];
  if (isCjkLabelText(raw) && !/\s/.test(raw)) {
    const neededLines = clamp(Math.ceil(approximateTextWidth(raw, fontSize) / widthLimit), 2, maxLines);
    return splitBalancedCjkLabel(raw, neededLines);
  }
  const averageCharWidth = Math.max(fontSize * 0.58, 1);
  const roughChars = Math.max(Math.floor(widthLimit / averageCharWidth), 4);
  const wrapped = wrapLines(raw, roughChars);
  if (wrapped.length <= maxLines) return wrapped;
  const valueSplitMatch = raw.match(/^(.*?)(\s*(?:\([^()]+\)|[+\-]?\$[\d.,]+B))$/);
  if (valueSplitMatch) {
    return [valueSplitMatch[1].trim(), valueSplitMatch[2].trim()].filter(Boolean);
  }
  const compact = [];
  let cursor = "";
  wrapped.forEach((line) => {
    const next = cursor ? `${cursor} ${line}` : line;
    if (compact.length + 1 >= maxLines) {
      cursor = next;
      return;
    }
    if (approximateTextWidth(next, fontSize) <= widthLimit * 1.18) {
      cursor = next;
    } else {
      if (cursor) compact.push(cursor);
      cursor = line;
    }
  });
  if (cursor) compact.push(cursor);
  if (compact.length > maxLines) {
    const head = compact.slice(0, maxLines - 1);
    const tail = compact.slice(maxLines - 1).join(" ");
    return [...head, tail];
  }
  return compact;
}

function resolveSourceLabelLines(item, options = {}) {
  const compactMode = !!options.compactMode;
  const fontSize = safeNumber(options.fontSize, compactMode ? 24 : 26);
  const maxWidth = safeNumber(options.maxWidth, currentChartLanguage() === "zh" ? 166 : 198);
  const maxLines = safeNumber(options.maxLines, currentChartLanguage() === "zh" ? 2 : 3);
  if (currentChartLanguage() === "zh") {
    return wrapLabelWithMaxWidth(localizeChartItemName(item), fontSize, maxWidth, { maxLines });
  }
  const preferred = item?.displayLines?.length ? item.displayLines.join(" ") : item?.name || "";
  return wrapLabelWithMaxWidth(preferred, fontSize, maxWidth, { maxLines });
}

function resolveBranchTitleLines(item, defaultMode, fontSize, maxWidth) {
  const localizedName = currentChartLanguage() === "zh" ? localizeChartItemName(item) : String(item?.name || "");
  const valueLabel = formatItemBillions(item, defaultMode);
  const singleLine = `${localizedName} ${valueLabel}`.trim();
  if (approximateTextWidth(singleLine, fontSize) <= maxWidth) return [singleLine];
  const nameLines = wrapLabelWithMaxWidth(localizedName, fontSize, maxWidth, {
    maxLines: currentChartLanguage() === "zh" ? 2 : 2,
  });
  return [...nameLines, valueLabel];
}

function resolveTreeNoteLines(item, density, fontSize, maxWidth) {
  const preferredLines = item?.noteLines?.length ? localizeChartLines(item.noteLines) : [];
  const structuredLines = !preferredLines.length ? structuredChartNoteLines(item?.note || "") : null;
  if (structuredLines?.length) return structuredLines;
  const rawNote = preferredLines.length ? preferredLines.join(" ") : displayChartNote(item?.note || "");
  if (!rawNote.trim()) return [];
  if (!(safeNumber(maxWidth, 0) > 0)) {
    return preferredLines.length ? preferredLines : splitReplicaTreeNoteLines(rawNote, density);
  }
  return wrapLabelWithMaxWidth(rawNote, fontSize, maxWidth, {
    maxLines: density === "dense" || density === "ultra" ? 3 : 2,
  });
}

function localizeChartTitle(snapshot) {
  if (currentChartLanguage() === "en") return displayChartTitle(snapshot?.title || "");
  const companyName = snapshot?.companyNameZh || snapshot?.companyName || "";
  const fiscal = compactFiscalLabel(snapshot?.fiscalLabel || snapshot?.quarterKey || "");
  return [companyName, fiscal].filter(Boolean).join(" ").trim();
}

function localizePeriodEndLabel(label) {
  const raw = String(label || "").trim();
  if (!raw || currentChartLanguage() === "en") return raw;
  const match = /^Ending\s+([A-Za-z.]+)\s*(\d{1,2})?,?\s*(\d{4})$/i.exec(raw);
  if (!match) return raw;
  const monthMap = {
    "jan.": "1",
    "feb.": "2",
    "mar.": "3",
    "apr.": "4",
    may: "5",
    "jun.": "6",
    "jul.": "7",
    "aug.": "8",
    "sept.": "9",
    "oct.": "10",
    "nov.": "11",
    "dec.": "12",
  };
  const month = monthMap[String(match[1]).toLowerCase()] || match[1];
  const day = match[2] ? `${Number(match[2])}日` : "";
  return `截至 ${match[3]}年${month}月${day}`;
}

function inlinePeriodEndLayout({
  titleText,
  titleFontSize,
  titleX,
  titleY,
  periodEndFontSize,
  width,
  titleMaxWidth = null,
  rightPadding = 84,
}) {
  const titleVisualWidth = titleMaxWidth !== null && titleMaxWidth !== undefined
    ? Math.min(safeNumber(titleMaxWidth), Math.max(approximateTextWidth(titleText, titleFontSize), titleFontSize * 3.2))
    : Math.max(approximateTextWidth(titleText, titleFontSize), titleFontSize * 3.2);
  const smallCharWidth = approximateTextWidth(currentChartLanguage() === "zh" ? "字" : "a", periodEndFontSize);
  const gapX = smallCharWidth * 1.5;
  const titleVisualCenterY = titleY - titleFontSize * 0.32;
  const periodEndY = titleVisualCenterY + periodEndFontSize * 0.32;
  const periodEndX = Math.min(titleX + titleVisualWidth / 2 + gapX, width - rightPadding);
  return {
    titleVisualWidth,
    periodEndX,
    periodEndY,
  };
}

function yoyLabel() {
  return currentChartLanguage() === "en" ? "Y/Y" : "同比";
}

function qoqLabel() {
  return currentChartLanguage() === "en" ? "Q/Q" : "环比";
}

function marginLabel() {
  return currentChartLanguage() === "en" ? "margin" : "利润率";
}

function ofRevenueLabel() {
  return currentChartLanguage() === "en" ? "of revenue" : "占营收比重";
}

function hasSnapshotQoqMetrics(snapshot) {
  if (snapshot?.revenueQoqPct !== null && snapshot?.revenueQoqPct !== undefined) return true;
  const collections = [
    snapshot?.businessGroups,
    snapshot?.leftDetailGroups,
    snapshot?.opexBreakdown,
    snapshot?.costBreakdown,
    snapshot?.belowOperatingItems,
    snapshot?.positiveAdjustments,
  ];
  return collections.some(
    (items) =>
      Array.isArray(items) &&
      items.some((item) => item?.qoqPct !== null && item?.qoqPct !== undefined)
  );
}

function quarterSortValue(period) {
  const match = /^(\d{4})Q([1-4])$/.exec(period || "");
  if (!match) return 0;
  return Number(match[1]) * 10 + Number(match[2]);
}

function parseQuarterKey(quarterKey) {
  const match = /^(\d{4})Q([1-4])$/.exec(String(quarterKey || ""));
  if (!match) return null;
  return {
    year: Number(match[1]),
    quarter: Number(match[2]),
  };
}

function shiftQuarterKey(quarterKey, delta = 0) {
  const parsed = parseQuarterKey(quarterKey);
  if (!parsed) return null;
  const baseIndex = parsed.year * 4 + (parsed.quarter - 1);
  const shiftedIndex = baseIndex + Math.trunc(safeNumber(delta, 0));
  if (!Number.isFinite(shiftedIndex) || shiftedIndex < 0) return null;
  const nextYear = Math.floor(shiftedIndex / 4);
  const nextQuarter = (shiftedIndex % 4) + 1;
  return `${nextYear}Q${nextQuarter}`;
}

function continuousQuarterWindow(anchorQuarterKey, size = 30) {
  const count = Math.max(1, Math.floor(safeNumber(size, 30)));
  const parsedAnchor = parseQuarterKey(anchorQuarterKey);
  if (!parsedAnchor) return [];
  const result = [];
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const quarterKey = shiftQuarterKey(anchorQuarterKey, -offset);
    if (quarterKey) result.push(quarterKey);
  }
  return result;
}

function companies() {
  return state.sortedCompanies || [];
}

function getCompany(companyId) {
  return state.companyById?.[companyId] || null;
}

function resolvedCompanyBrand(company) {
  return normalizeCompanyBrand(company?.brand);
}

function normalizeLogoKey(logoKey) {
  return String(logoKey || "").replace(/-corporate$/i, "");
}

function getLogoAsset(logoKey) {
  return state.logoCatalog?.[normalizeLogoKey(logoKey)] || null;
}

function isNeutralBackgroundPixel(red, green, blue) {
  return Math.max(red, green, blue) - Math.min(red, green, blue) <= 22;
}

function detectLogoBackground(imageData, width, height) {
  const samples = [];
  const pushSample = (x, y) => {
    const offset = (y * width + x) * 4;
    if (imageData[offset + 3] < 245) return;
    samples.push({
      x,
      y,
      red: imageData[offset],
      green: imageData[offset + 1],
      blue: imageData[offset + 2],
    });
  };
  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y < height; y += 1) {
      const offset = (y * width + x) * 4;
      if (imageData[offset + 3] >= 245) {
        pushSample(x, y);
        break;
      }
    }
    for (let y = height - 1; y >= 0; y -= 1) {
      const offset = (y * width + x) * 4;
      if (imageData[offset + 3] >= 245) {
        pushSample(x, y);
        break;
      }
    }
  }
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      if (imageData[offset + 3] >= 245) {
        pushSample(x, y);
        break;
      }
    }
    for (let x = width - 1; x >= 0; x -= 1) {
      const offset = (y * width + x) * 4;
      if (imageData[offset + 3] >= 245) {
        pushSample(x, y);
        break;
      }
    }
  }
  const neutralSamples = samples.filter((pixel) => {
    if (!isNeutralBackgroundPixel(pixel.red, pixel.green, pixel.blue)) return false;
    const luminance = (pixel.red + pixel.green + pixel.blue) / 3;
    return luminance < 18 || luminance > 236;
  });
  if (neutralSamples.length < 12) return null;
  const average = neutralSamples.reduce(
    (accumulator, pixel) => ({
      red: accumulator.red + pixel.red,
      green: accumulator.green + pixel.green,
      blue: accumulator.blue + pixel.blue,
    }),
    { red: 0, green: 0, blue: 0 }
  );
  const red = Math.round(average.red / neutralSamples.length);
  const green = Math.round(average.green / neutralSamples.length);
  const blue = Math.round(average.blue / neutralSamples.length);
  if (!isNeutralBackgroundPixel(red, green, blue)) return null;
  const stableSamples = neutralSamples.filter(
    (pixel) =>
      Math.abs(pixel.red - red) <= 18 &&
      Math.abs(pixel.green - green) <= 18 &&
      Math.abs(pixel.blue - blue) <= 18
  );
  if (stableSamples.length < 8) return null;
  return { red, green, blue, seeds: stableSamples.map((pixel) => ({ x: pixel.x, y: pixel.y })) };
}

function removeEdgeBackground(imageData, width, height, background) {
  const data = new Uint8ClampedArray(imageData.data);
  const visited = new Uint8Array(width * height);
  const queue = [];
  const tolerance = 26;
  const matchBackground = (index) => {
    if (data[index + 3] < 20) return false;
    return (
      Math.abs(data[index] - background.red) <= tolerance &&
      Math.abs(data[index + 1] - background.green) <= tolerance &&
      Math.abs(data[index + 2] - background.blue) <= tolerance
    );
  };
  const enqueue = (x, y) => {
    const pointIndex = y * width + x;
    if (visited[pointIndex]) return;
    visited[pointIndex] = 1;
    queue.push(pointIndex);
  };
  (background.seeds || []).forEach((seed) => enqueue(seed.x, seed.y));
  let removed = 0;
  while (queue.length) {
    const pointIndex = queue.shift();
    const x = pointIndex % width;
    const y = Math.floor(pointIndex / width);
    const pixelIndex = pointIndex * 4;
    if (!matchBackground(pixelIndex)) continue;
    data[pixelIndex + 3] = 0;
    removed += 1;
    if (x > 0) enqueue(x - 1, y);
    if (x + 1 < width) enqueue(x + 1, y);
    if (y > 0) enqueue(x, y - 1);
    if (y + 1 < height) enqueue(x, y + 1);
  }
  if (removed < width * height * 0.04) return null;
  return new ImageData(data, width, height);
}

function opaqueBoundsFromImageData(imageData, width, height, alphaThreshold = 10) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      if (imageData.data[offset + 3] < alphaThreshold) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < minX || maxY < minY) return null;
  return {
    left: minX,
    top: minY,
    right: maxX,
    bottom: maxY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

async function normalizeBitmapLogoAsset(asset) {
  const mime = String(asset?.mime || "").trim().toLowerCase();
  if (!asset?.dataUrl || !/^image\/(png|jpeg|jpg|webp|svg\+xml|svg)$/i.test(mime)) return asset;
  try {
    const image = new Image();
    image.decoding = "async";
    const loaded = new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
    });
    image.src = asset.dataUrl;
    await loaded;
    const naturalWidth = image.naturalWidth || safeNumber(asset.width, 0);
    const naturalHeight = image.naturalHeight || safeNumber(asset.height, 0);
    if (!naturalWidth || !naturalHeight) return asset;
    const maxRasterSide = 900;
    const rasterScale = Math.min(1, maxRasterSide / Math.max(naturalWidth, naturalHeight, 1));
    const width = Math.max(1, Math.round(naturalWidth * rasterScale));
    const height = Math.max(1, Math.round(naturalHeight * rasterScale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return asset;
    context.drawImage(image, 0, 0, width, height);
    const imageData = context.getImageData(0, 0, width, height);
    const background = detectLogoBackground(imageData.data, width, height);
    const transparentImageData = background ? removeEdgeBackground(imageData, width, height, background) : null;
    const normalizedImageData = transparentImageData || imageData;
    context.clearRect(0, 0, width, height);
    context.putImageData(normalizedImageData, 0, 0);
    const visibleBounds = opaqueBoundsFromImageData(normalizedImageData, width, height);
    if (!visibleBounds) {
      if (!transparentImageData) return asset;
      return {
        ...asset,
        mime: "image/png",
        dataUrl: canvas.toDataURL("image/png"),
        width,
        height,
      };
    }
    const trimPadding = Math.max(1, Math.round(Math.min(width, height) * 0.012));
    const cropLeft = Math.max(visibleBounds.left - trimPadding, 0);
    const cropTop = Math.max(visibleBounds.top - trimPadding, 0);
    const cropRight = Math.min(visibleBounds.right + trimPadding, width - 1);
    const cropBottom = Math.min(visibleBounds.bottom + trimPadding, height - 1);
    const cropWidth = cropRight - cropLeft + 1;
    const cropHeight = cropBottom - cropTop + 1;
    if (!transparentImageData && cropWidth >= width - 2 && cropHeight >= height - 2) return asset;
    const croppedCanvas = document.createElement("canvas");
    croppedCanvas.width = cropWidth;
    croppedCanvas.height = cropHeight;
    const croppedContext = croppedCanvas.getContext("2d");
    if (!croppedContext) return asset;
    croppedContext.drawImage(canvas, cropLeft, cropTop, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
    return {
      ...asset,
      mime: "image/png",
      dataUrl: croppedCanvas.toDataURL("image/png"),
      width: cropWidth,
      height: cropHeight,
    };
  } catch (_error) {
    return asset;
  }
}

async function normalizeLogoCatalogAssets(catalog) {
  const entries = Object.entries(catalog || {});
  const normalizedEntries = await Promise.all(
    entries.map(async ([companyId, asset]) => [companyId, await normalizeBitmapLogoAsset(asset)])
  );
  return Object.fromEntries(normalizedEntries);
}

function normalizeLabelKey(value) {
  return String(value || "")
    .toLowerCase()
    .replaceAll("&", "and")
    .replaceAll("+", "plus")
    .replace(/[^a-z0-9]+/g, "");
}

function mergeSupplementalComponentPayload(basePayload, quarterPayload) {
  const base = basePayload && typeof basePayload === "object" ? basePayload : {};
  const quarter = quarterPayload && typeof quarterPayload === "object" ? quarterPayload : {};
  if (!Object.keys(base).length) return Object.keys(quarter).length ? { ...quarter } : null;
  if (!Object.keys(quarter).length) return { ...base };
  const merged = {
    ...base,
    ...quarter,
  };
  ["costBreakdownProfile"].forEach((fieldName) => {
    const baseField = base[fieldName];
    const quarterField = quarter[fieldName];
    if (
      baseField &&
      typeof baseField === "object" &&
      !Array.isArray(baseField) &&
      quarterField &&
      typeof quarterField === "object" &&
      !Array.isArray(quarterField)
    ) {
      merged[fieldName] = {
        ...baseField,
        ...quarterField,
        fixedGrossMarginPctBySegment: {
          ...(baseField.fixedGrossMarginPctBySegment || {}),
          ...(quarterField.fixedGrossMarginPctBySegment || {}),
        },
      };
    }
  });
  return merged;
}

function supplementalComponentsFor(company, quarterKey) {
  if (!company?.id || !quarterKey) return null;
  const companySupplemental = state.supplementalComponents?.[company.id];
  if (!companySupplemental || typeof companySupplemental !== "object") return null;
  const defaultPayload =
    companySupplemental._default ||
    companySupplemental.default ||
    companySupplemental.__default__ ||
    null;
  const quarterPayload = companySupplemental[quarterKey] || null;
  return mergeSupplementalComponentPayload(defaultPayload, quarterPayload);
}

function inferredOfficialRevenueStyle(company, entry, rows = []) {
  const explicitStyle = entry?.officialRevenueStyle || "";
  if (explicitStyle) return explicitStyle;
  const memberKeys = new Set(
    [...(rows || [])].map((item) => normalizeLabelKey(item?.memberKey || item?.id || item?.key || item?.name))
  );
  if (
    company?.id === "alibaba" &&
    (memberKeys.has("taobaoandtmallgroup") ||
      memberKeys.has("alibabachinaecommercegroup") ||
      memberKeys.has("alidcg") ||
      memberKeys.has("cloudintelligencegroup"))
  ) {
    return "alibaba-commerce-staged";
  }
  if (
    company?.id === "alphabet" &&
    (memberKeys.has("adrevenue") || memberKeys.has("googleservices")) &&
    memberKeys.has("googlecloud")
  ) {
    return "ad-funnel-bridge";
  }
  if (
    company?.id === "amazon" &&
    memberKeys.has("onlinestores") &&
    (memberKeys.has("amazonwebservices") || memberKeys.has("aws") || memberKeys.has("thirdpartysellerservices"))
  ) {
    return "commerce-service-bridge";
  }
  if (
    company?.id === "tesla" &&
    [memberKeys.has("auto"), memberKeys.has("services"), memberKeys.has("energygenerationstorage")].filter(Boolean).length >= 2
  ) {
    return "tesla-revenue-bridge";
  }
  if (
    company?.id === "visa" &&
    memberKeys.has("dataprocessingrevenues") &&
    memberKeys.has("internationaltransactionrevenues")
  ) {
    return "visa-revenue-bridge";
  }
  if (
    company?.id === "micron" &&
    (memberKeys.has("cnbu") ||
      memberKeys.has("mbu") ||
      memberKeys.has("sbu") ||
      memberKeys.has("ebu") ||
      memberKeys.has("cmbu") ||
      memberKeys.has("mcbu") ||
      memberKeys.has("cdbu") ||
      memberKeys.has("aebu") ||
      memberKeys.has("microncomputedatacenter") ||
      memberKeys.has("micronmobileclient") ||
      memberKeys.has("micronstoragecloudmemory") ||
      memberKeys.has("micronautoembedded"))
  ) {
    return "micron-business-unit-bridge";
  }
  return "";
}

const ALIBABA_SEGMENT_PHASE_KEYS = {
  stagedCurrent: new Set(["taobaoandtmallgroup", "alidcg", "cloudintelligencegroup", "cainiao", "localservicesgroup", "dmeg", "allothers"]),
  condensedCurrent: new Set(["alibabachinaecommercegroup", "alidcg", "cloudintelligencegroup", "allothers"]),
  legacy: new Set([
    "chinacommerce",
    "internationalcommerce",
    "localconsumerservices",
    "localconsumerservicesandothers",
    "cainiao",
    "cloudbusiness",
    "cloud",
    "digitalmediaandentertainment",
    "innovationinitiativesandothers",
  ]),
};

// For bars we bridge Alibaba to the coarsest fully disclosed quarterly taxonomy,
// so the full history stays comparable without inventing pre-split subsegments.
const ALIBABA_BAR_COMPARABLE_SEGMENTS = Object.freeze([
  Object.freeze({ key: "alibabacommerce", name: "Commerce", nameZh: "商业" }),
  Object.freeze({ key: "alibabacloud", name: "Cloud", nameZh: "云业务" }),
  Object.freeze({ key: "alibabaothers", name: "All others", nameZh: "其他业务" }),
]);

const ALIBABA_BAR_PHASE_KEYS = {
  comparable: new Set(["alibabacommerce", "alibabacloud", "alibabaothers"]),
  condensedCurrent: new Set(["alibabachinaecommercegroup", "alidcg", "cloudintelligencegroup", "allothers"]),
  stagedCurrent: new Set(["taobaoandtmallgroup", "alidcg", "cloudintelligencegroup", "cainiao", "localservicesgroup", "dmeg", "allothers"]),
  legacyDetailed: new Set([
    "chinacommerce",
    "internationalcommerce",
    "localconsumerservices",
    "localconsumerservicesandothers",
    "cainiao",
    "cloudbusiness",
    "cloud",
    "digitalmediaandentertainment",
    "innovationinitiativesandothers",
  ]),
  legacyCoarse: new Set(["corecommerce", "commerce", "cloudcomputing", "digitalmediaandentertainment", "innovationinitiativesandothers"]),
};

const ALIBABA_BAR_COMPARABLE_KEYS_BY_PHASE = {
  comparable: {
    alibabacommerce: ["alibabacommerce"],
    alibabacloud: ["alibabacloud"],
    alibabaothers: ["alibabaothers"],
  },
  condensedCurrent: {
    alibabacommerce: ["alibabachinaecommercegroup", "alidcg"],
    alibabacloud: ["cloudintelligencegroup"],
    alibabaothers: ["allothers"],
  },
  stagedCurrent: {
    alibabacommerce: ["taobaoandtmallgroup", "alidcg", "cainiao", "localservicesgroup"],
    alibabacloud: ["cloudintelligencegroup"],
    alibabaothers: ["allothers", "dmeg"],
  },
  legacyDetailed: {
    alibabacommerce: ["chinacommerce", "internationalcommerce", "localconsumerservices", "localconsumerservicesandothers", "cainiao"],
    alibabacloud: ["cloudbusiness", "cloud"],
    alibabaothers: ["digitalmediaandentertainment", "innovationinitiativesandothers"],
  },
  legacyCoarse: {
    alibabacommerce: ["corecommerce", "commerce"],
    alibabacloud: ["cloudcomputing"],
    alibabaothers: ["digitalmediaandentertainment", "innovationinitiativesandothers"],
  },
};

const ALIBABA_COMPARABLE_KEYS_BY_PHASE = {
  condensedCurrent: {
    alibabachinaecommercegroup: ["alibabachinaecommercegroup"],
    alidcg: ["alidcg"],
    cloudintelligencegroup: ["cloudintelligencegroup"],
    allothers: ["allothers"],
  },
  stagedCurrent: {
    alibabachinaecommercegroup: ["taobaoandtmallgroup", "cainiao", "localservicesgroup"],
    taobaoandtmallgroup: ["taobaoandtmallgroup"],
    alidcg: ["alidcg"],
    cloudintelligencegroup: ["cloudintelligencegroup"],
    cainiao: ["cainiao"],
    localservicesgroup: ["localservicesgroup"],
    dmeg: ["dmeg"],
    allothers: ["allothers", "dmeg"],
  },
  legacy: {
    alibabachinaecommercegroup: ["chinacommerce", "localconsumerservices", "localconsumerservicesandothers", "cainiao"],
    taobaoandtmallgroup: ["chinacommerce"],
    alidcg: ["internationalcommerce"],
    cloudintelligencegroup: ["cloudbusiness", "cloud"],
    cainiao: ["cainiao"],
    localservicesgroup: ["localconsumerservices", "localconsumerservicesandothers"],
    dmeg: ["digitalmediaandentertainment"],
    allothers: ["innovationinitiativesandothers", "digitalmediaandentertainment"],
  },
};

const ALIBABA_DETAIL_ORDER = {
  customermanagement: 0,
  directsalesandothers: 1,
  directsaleslogisticsandothers: 1,
  quickcommerce: 2,
  chinacommercewholesale: 3,
  internationalcommerceretail: 0,
  internationalcommercewholesale: 1,
};

function detectQuarterKeyForEntry(company, entry) {
  if (!company?.financials || !entry) return entry?.quarterKey || null;
  if (entry?.quarterKey && company.financials[entry.quarterKey] === entry) return entry.quarterKey;
  return Object.entries(company.financials).find(([, value]) => value === entry)?.[0] || entry?.quarterKey || null;
}

function previousQuarterKey(quarterKey) {
  if (!quarterKey || !/^\d{4}Q[1-4]$/.test(quarterKey)) return null;
  const year = Number(quarterKey.slice(0, 4));
  const quarter = Number(quarterKey.slice(-1));
  if (quarter === 1) {
    return `${year - 1}Q4`;
  }
  return `${year}Q${quarter - 1}`;
}

function priorYearQuarterKey(quarterKey) {
  if (!quarterKey || !/^\d{4}Q[1-4]$/.test(quarterKey)) return null;
  return `${Number(quarterKey.slice(0, 4)) - 1}${quarterKey.slice(4)}`;
}

function alibabaSegmentPhase(rows = []) {
  const memberKeys = new Set([...(rows || [])].map((item) => normalizeLabelKey(item?.memberKey || item?.id || item?.name)));
  if ([...ALIBABA_SEGMENT_PHASE_KEYS.condensedCurrent].some((key) => memberKeys.has(key)) && memberKeys.has("alibabachinaecommercegroup")) {
    return "condensedCurrent";
  }
  if ([...ALIBABA_SEGMENT_PHASE_KEYS.stagedCurrent].some((key) => memberKeys.has(key)) && memberKeys.has("taobaoandtmallgroup")) {
    return "stagedCurrent";
  }
  if ([...ALIBABA_SEGMENT_PHASE_KEYS.legacy].some((key) => memberKeys.has(key))) {
    return "legacy";
  }
  return "";
}

function alibabaComparableKeys(memberKey, comparisonRows = []) {
  const normalizedKey = normalizeLabelKey(memberKey);
  const phase = alibabaSegmentPhase(comparisonRows);
  return ALIBABA_COMPARABLE_KEYS_BY_PHASE[phase]?.[normalizedKey] || [normalizedKey];
}

function alibabaBarComparablePhase(rows = []) {
  const memberKeys = new Set([...(rows || [])].map((item) => normalizeLabelKey(item?.memberKey || item?.id || item?.name)));
  if ([...ALIBABA_BAR_PHASE_KEYS.comparable].some((key) => memberKeys.has(key))) {
    return "comparable";
  }
  if ([...ALIBABA_BAR_PHASE_KEYS.condensedCurrent].some((key) => memberKeys.has(key)) && memberKeys.has("alibabachinaecommercegroup")) {
    return "condensedCurrent";
  }
  if ([...ALIBABA_BAR_PHASE_KEYS.stagedCurrent].some((key) => memberKeys.has(key)) && memberKeys.has("taobaoandtmallgroup")) {
    return "stagedCurrent";
  }
  if ([...ALIBABA_BAR_PHASE_KEYS.legacyDetailed].some((key) => memberKeys.has(key)) && memberKeys.has("chinacommerce")) {
    return "legacyDetailed";
  }
  if ([...ALIBABA_BAR_PHASE_KEYS.legacyCoarse].some((key) => memberKeys.has(key)) && (memberKeys.has("corecommerce") || memberKeys.has("commerce"))) {
    return "legacyCoarse";
  }
  return "";
}

function buildAlibabaComparableBarRows(entry, rows = []) {
  const normalizedRows = [...(rows || [])]
    .map((item) => ({
      ...item,
      valueBn: Number(safeNumber(item?.valueBn).toFixed(3)),
    }))
    .filter((item) => safeNumber(item?.valueBn) > 0.02);
  if (!normalizedRows.length) return [];
  const phase = alibabaBarComparablePhase(normalizedRows);
  const comparableKeysByPhase = ALIBABA_BAR_COMPARABLE_KEYS_BY_PHASE[phase] || null;
  if (!comparableKeysByPhase) return [];
  return ALIBABA_BAR_COMPARABLE_SEGMENTS
    .map((segment) => {
      const memberKeys = new Set(comparableKeysByPhase[segment.key] || []);
      if (!memberKeys.size) return null;
      const matchedRows = normalizedRows.filter((item) => {
        const itemKey = normalizeLabelKey(item?.memberKey || item?.id || item?.name);
        return memberKeys.has(itemKey);
      });
      const valueBn = matchedRows.reduce((sum, item) => sum + safeNumber(item?.valueBn), 0);
      if (!(valueBn > 0.02)) return null;
      const filingDate =
        matchedRows
          .map((item) => item?.filingDate)
          .filter(Boolean)
          .sort(compareIsoDateStrings)
          .pop() || entry?.statementFilingDate || null;
      const periodEnd = matchedRows.map((item) => item?.periodEnd).find(Boolean) || entry?.periodEnd || null;
      return {
        id: segment.key,
        name: segment.name,
        nameZh: segment.nameZh,
        valueBn: Number(valueBn.toFixed(3)),
        filingDate,
        periodEnd,
      };
    })
    .filter(Boolean);
}

// Micron switched from legacy end-market BUs to a new BU taxonomy in FY26.
// For bars we stabilize both schemas into comparable buckets and discard mixed future-filing contamination.
const MICRON_LEGACY_SEGMENT_KEYS = new Set(["cnbu", "mbu", "sbu", "ebu", "allothersegments"]);
const MICRON_CURRENT_SEGMENT_KEYS = new Set(["cmbu", "mcbu", "cdbu", "aebu"]);
const MICRON_SCHEMA_CHANGE_QUARTER = "2025Q4";

function micronSegmentPhase(rows = []) {
  const memberKeys = new Set([...(rows || [])].map((item) => normalizeLabelKey(item?.memberKey || item?.id || item?.name)));
  const hasLegacy = [...MICRON_LEGACY_SEGMENT_KEYS].some((key) => key !== "allothersegments" && memberKeys.has(key));
  const hasCurrent = [...MICRON_CURRENT_SEGMENT_KEYS].some((key) => memberKeys.has(key));
  if (hasLegacy && hasCurrent) return "mixed";
  if (hasCurrent) return "current";
  if (hasLegacy || memberKeys.has("allothersegments")) return "legacy";
  return "";
}

function micronRowsForPhase(rows = [], phase = "") {
  const allowedKeys = phase === "current" ? MICRON_CURRENT_SEGMENT_KEYS : phase === "legacy" ? MICRON_LEGACY_SEGMENT_KEYS : null;
  if (!allowedKeys) return [];
  return [...(rows || [])].filter((item) => allowedKeys.has(normalizeLabelKey(item?.memberKey || item?.id || item?.name)));
}

function normalizeMicronBarRows(entry, rows = []) {
  const phase = micronSegmentPhase(rows);
  if (phase !== "mixed") return rows;
  const revenueBn = safeNumber(entry?.revenueBn, null);
  const quarterKey = String(entry?.quarterKey || "").trim();
  const preferredPhase =
    quarterKey && quarterSortValue(quarterKey) >= quarterSortValue(MICRON_SCHEMA_CHANGE_QUARTER) ? "current" : "legacy";
  const preferredRows = micronRowsForPhase(rows, preferredPhase);
  const preferredSum = preferredRows.reduce((sum, item) => sum + safeNumber(item?.valueBn), 0);
  const preferredCoverage = revenueBn > 0.02 ? preferredSum / revenueBn : 0;
  if (preferredRows.length >= 3 && (revenueBn <= 0.02 || (preferredCoverage >= 0.72 && preferredCoverage <= 1.18))) {
    return preferredRows;
  }
  const alternatePhase = preferredPhase === "current" ? "legacy" : "current";
  const alternateRows = micronRowsForPhase(rows, alternatePhase);
  const alternateSum = alternateRows.reduce((sum, item) => sum + safeNumber(item?.valueBn), 0);
  const alternateCoverage = revenueBn > 0.02 ? alternateSum / revenueBn : 0;
  if (alternateRows.length >= 3 && (revenueBn <= 0.02 || (alternateCoverage >= 0.72 && alternateCoverage <= 1.18))) {
    return alternateRows;
  }
  return preferredRows.length ? preferredRows : alternateRows.length ? alternateRows : rows;
}

function buildAlibabaStagedBusinessGroups(company, entry) {
  const official = sanitizeOfficialStructureRows(entry, entry.officialRevenueSegments || []).filter(
    (item) => safeNumber(item.valueBn) > 0.02
  );
  if (!official.length) return null;
  const revenueBn = safeNumber(entry?.revenueBn);
  if (revenueBn <= 0) return null;
  const rows = official.slice().sort((left, right) => safeNumber(right.valueBn) - safeNumber(left.valueBn));
  const palette = revenuePaletteForStyle(company, "alibaba-commerce-staged", rows.length);
  const compactMode = rows.length >= 5;
  const groups = rows.map((item, index) => {
    const memberKey = item.memberKey || item.name;
    const currentValue = safeNumber(item.valueBn);
    const mixPct = revenueBn ? Number(((currentValue / revenueBn) * 100).toFixed(1)) : item.mixPct ?? null;
    const color = palette[index % palette.length];
    return {
      id: memberKey,
      name: item.name,
      nameZh: item.nameZh || translateBusinessLabelToZh(item.name),
      displayLines: wrapLines(item.name, compactMode ? 14 : 16),
      valueBn: Number(currentValue.toFixed(3)),
      flowValueBn: Number(safeNumber(item.flowValueBn ?? currentValue).toFixed(3)),
      yoyPct: item.yoyPct ?? null,
      qoqPct: item.qoqPct ?? null,
      mixPct,
      mixYoyDeltaPp: item.mixYoyDeltaPp ?? null,
      metricMode: item.metricMode || null,
      operatingMarginPct: null,
      nodeColor: color,
      flowColor: rgba(color, compactMode ? 0.5 : 0.58),
      labelColor: "#55595F",
      valueColor: "#676C75",
      supportLines: item.supportLines || null,
      supportLinesZh: item.supportLinesZh || null,
      compactLabel: compactMode,
      sourceUrl: item.sourceUrl || null,
      memberKey,
    };
  });
  return normalizeGroupFlowTotalsToRevenue(groups, revenueBn);
}

function sanitizeOfficialStructureRows(entry, rows = []) {
  const normalizedRows = [...(rows || [])].map((item) => ({ ...item }));
  if (!normalizedRows.length) return normalizedRows;
  const revenueBn = Math.max(safeNumber(entry?.revenueBn), 0);
  const maxValue = Math.max(...normalizedRows.map((item) => safeNumber(item?.valueBn)));
  const totalValue = normalizedRows.reduce((sum, item) => sum + safeNumber(item?.valueBn), 0);
  const appearsRawMillions =
    revenueBn > 0 &&
    maxValue > revenueBn * 8 &&
    totalValue > revenueBn * 8 &&
    maxValue > 500;
  if (!appearsRawMillions) return normalizedRows;
  return normalizedRows.map((item) => ({
    ...item,
    valueBn: Number((safeNumber(item.valueBn) / 1000).toFixed(3)),
    flowValueBn:
      item.flowValueBn !== null && item.flowValueBn !== undefined
        ? Number((safeNumber(item.flowValueBn) / 1000).toFixed(3))
        : item.flowValueBn,
  }));
}

function normalizeBreakdownItems(items = [], fallbackSourceUrl = null, defaultMode = "negative-parentheses") {
  if (!Array.isArray(items) || !items.length) return [];
  return items
    .map((item) => ({
      ...item,
      nameZh: item?.nameZh || translateBusinessLabelToZh(item?.name || ""),
      valueBn: Number(safeNumber(item?.valueBn).toFixed(3)),
      valueFormat: item?.valueFormat || defaultMode,
      sourceUrl: item?.sourceUrl || fallbackSourceUrl || null,
    }))
    .filter((item) => safeNumber(item.valueBn) > 0.02);
}

function resolveDirectCostBreakdown(snapshot, company, entry) {
  if (snapshot?.costBreakdown?.length) {
    return normalizeBreakdownItems(snapshot.costBreakdown);
  }
  const supplemental = supplementalComponentsFor(company, snapshot?.quarterKey || entry?.quarterKey);
  const entrySupplemental = entry?.supplementalComponents || {};
  const breakdown =
    entry?.officialCostBreakdown ||
    entry?.costBreakdown ||
    entrySupplemental?.officialCostBreakdown ||
    entrySupplemental?.costBreakdown ||
    supplemental?.officialCostBreakdown ||
    supplemental?.costBreakdown;
  return normalizeBreakdownItems(breakdown, supplemental?.sourceUrl || null);
}

function resolveProfileCostBreakdown(snapshot, company, entry) {
  const supplemental = supplementalComponentsFor(company, snapshot?.quarterKey || entry?.quarterKey);
  const entrySupplemental = entry?.supplementalComponents || {};
  const profile =
    entry?.costBreakdownProfile ||
    entrySupplemental?.costBreakdownProfile ||
    supplemental?.costBreakdownProfile;
  if (!profile || typeof profile !== "object") return [];
  const totalCostBn = safeNumber(snapshot?.costOfRevenueBn ?? entry?.costOfRevenueBn);
  if (totalCostBn <= 0.02) return [];
  const segmentRows = [...(snapshot?.businessGroups || entry?.officialRevenueSegments || [])].filter((item) => safeNumber(item?.valueBn) > 0.02);
  if (!segmentRows.length) return [];
  const segmentMap = new Map();
  segmentRows.forEach((item) => {
    const normalizedKeys = [
      normalizeLabelKey(item?.memberKey || item?.id || item?.name),
      normalizeLabelKey(item?.name),
    ].filter(Boolean);
    normalizedKeys.forEach((key) => {
      if (!segmentMap.has(key)) {
        segmentMap.set(key, item);
      }
    });
  });
  const orderedSegmentNames =
    Array.isArray(profile.segmentOrder) && profile.segmentOrder.length
      ? profile.segmentOrder
      : segmentRows.map((item) => item.name);
  const fixedGrossMarginPctBySegment = profile.fixedGrossMarginPctBySegment || {};
  const sourceUrl = profile.sourceUrl || supplemental?.sourceUrl || null;
  const defaultMode = profile.valueFormat || "negative-parentheses";
  const resolvedSegments = orderedSegmentNames
    .map((segmentName) => segmentMap.get(normalizeLabelKey(segmentName)))
    .filter(Boolean);
  if (!resolvedSegments.length) return [];

  const itemMap = new Map();
  let assignedCostBn = 0;
  const unresolvedSegments = [];
  resolvedSegments.forEach((segment) => {
    const normalizedName = normalizeLabelKey(segment?.name);
    const fixedMarginPct = fixedGrossMarginPctBySegment[segment?.name] ?? fixedGrossMarginPctBySegment[normalizedName];
    if (fixedMarginPct === null || fixedMarginPct === undefined || Number.isNaN(Number(fixedMarginPct))) {
      unresolvedSegments.push(segment);
      return;
    }
    const marginPct = clamp(Number(fixedMarginPct), -20, 99.5);
    const costBn = safeNumber(segment.valueBn) * (1 - marginPct / 100);
    assignedCostBn += costBn;
    itemMap.set(normalizeLabelKey(segment.name), {
      name: segment.name,
      nameZh: segment.nameZh || translateBusinessLabelToZh(segment.name),
      valueBn: Number(costBn.toFixed(3)),
      note: `${formatCompactPct(marginPct)} gross margin`,
      valueFormat: defaultMode,
      sourceUrl,
    });
  });
  if (unresolvedSegments.length === 1) {
    const segment = unresolvedSegments[0];
    const residualCostBn = Math.max(totalCostBn - assignedCostBn, 0);
    const revenueBn = safeNumber(segment.valueBn);
    const grossMarginPct = revenueBn > 0 ? clamp(((revenueBn - residualCostBn) / revenueBn) * 100, -20, 99.5) : null;
    itemMap.set(normalizeLabelKey(segment.name), {
      name: segment.name,
      nameZh: segment.nameZh || translateBusinessLabelToZh(segment.name),
      valueBn: Number(residualCostBn.toFixed(3)),
      note: grossMarginPct === null ? "" : `${formatCompactPct(grossMarginPct)} gross margin`,
      valueFormat: defaultMode,
      sourceUrl,
    });
  }
  const items = resolvedSegments
    .map((segment) => itemMap.get(normalizeLabelKey(segment.name)))
    .filter(Boolean);
  if (!unresolvedSegments.length && items.length) {
    const computedTotalBn = items.reduce((total, item) => total + safeNumber(item.valueBn), 0);
    const scaleFactor = computedTotalBn > 0 ? totalCostBn / computedTotalBn : 1;
    if (Math.abs(scaleFactor - 1) > 0.015) {
      items.forEach((item) => {
        item.valueBn = Number((safeNumber(item.valueBn) * scaleFactor).toFixed(3));
      });
    }
  }
  return normalizeBreakdownItems(items, sourceUrl, defaultMode);
}

function resolveAdFunnelCostBreakdown(snapshot, company, entry) {
  const explicitBreakdown = resolveDirectCostBreakdown(snapshot, company, entry);
  if (explicitBreakdown.length) {
    return explicitBreakdown;
  }
  const supplemental = supplementalComponentsFor(company, snapshot?.quarterKey || entry?.quarterKey);
  const entrySupplemental = entry?.supplementalComponents || {};
  const tacBn = safeNumber(entry?.trafficAcquisitionCostBn ?? entrySupplemental?.trafficAcquisitionCostBn ?? supplemental?.trafficAcquisitionCostBn);
  if (tacBn <= 0.02) return [];
  const totalCostBn = safeNumber(snapshot?.costOfRevenueBn ?? entry?.costOfRevenueBn);
  const otherCostBn = safeNumber(
    entry?.otherCostOfRevenueBn ?? entrySupplemental?.otherCostOfRevenueBn ?? supplemental?.otherCostOfRevenueBn,
    Math.max(totalCostBn - tacBn, 0)
  );
  const items = [];
  if (otherCostBn > 0.02) {
    items.push({
      name: "Other",
      valueBn: Number(otherCostBn.toFixed(3)),
      valueFormat: "negative-parentheses",
      sourceUrl: supplemental?.sourceUrl || null,
    });
  }
  items.push({
    name: "TAC",
    valueBn: Number(tacBn.toFixed(3)),
    valueFormat: "negative-parentheses",
    sourceUrl: supplemental?.sourceUrl || null,
  });
  return normalizeBreakdownItems(items, supplemental?.sourceUrl || null);
}

function resolveOperatingProfitBreakdown(snapshot, company, entry) {
  if (snapshot?.operatingProfitBreakdown?.length) {
    return [...snapshot.operatingProfitBreakdown];
  }
  const supplemental = supplementalComponentsFor(company, snapshot?.quarterKey || entry?.quarterKey);
  const entrySupplemental = entry?.supplementalComponents || {};
  const breakdown = entry?.operatingProfitBreakdown || entrySupplemental?.operatingProfitBreakdown || supplemental?.operatingProfitBreakdown;
  if (!Array.isArray(breakdown) || !breakdown.length) {
    return snapshot?.operatingProfitBreakdown || [];
  }
  return breakdown.map((item) => ({
    ...item,
    valueBn: Number(safeNumber(item.valueBn).toFixed(3)),
    valueFormat: item.valueFormat || "plain",
    sourceUrl: item.sourceUrl || supplemental?.sourceUrl || null,
  }));
}

const PROTOTYPE_DATA_ADAPTERS = {
  "ad-funnel-bridge": {
    deriveCostBreakdown: resolveAdFunnelCostBreakdown,
  },
  "commerce-service-bridge": {
    deriveOperatingProfitBreakdown: resolveOperatingProfitBreakdown,
  },
};

function adaptPrototypeDerivedFields(snapshot, company, entry, prototypeKey) {
  const adapter = PROTOTYPE_DATA_ADAPTERS[prototypeKey];
  const nextFields = {};
  const directCostBreakdown = resolveDirectCostBreakdown(snapshot, company, entry);
  if (directCostBreakdown.length) {
    nextFields.costBreakdown = directCostBreakdown;
  } else {
    const profileCostBreakdown = resolveProfileCostBreakdown(snapshot, company, entry);
    if (profileCostBreakdown.length) {
      nextFields.costBreakdown = profileCostBreakdown;
    } else if (adapter?.deriveCostBreakdown) {
      nextFields.costBreakdown = adapter.deriveCostBreakdown(snapshot, company, entry);
    }
  }
  if (adapter?.deriveOperatingProfitBreakdown) {
    nextFields.operatingProfitBreakdown = adapter.deriveOperatingProfitBreakdown(snapshot, company, entry);
  }
  return nextFields;
}

function formatBillionsByMode(value, mode = "plain") {
  if (mode === "negative-parentheses" || mode === "cost") {
    return formatBillions(-Math.abs(safeNumber(value)), true);
  }
  if (mode === "positive-plus") {
    return `+${formatBillions(Math.abs(safeNumber(value)))}`;
  }
  return formatBillions(value);
}

function formatItemBillions(item, defaultMode = "plain") {
  return formatBillionsByMode(item?.valueBn, item?.valueFormat || defaultMode);
}

function resolvedNetOutcomeValue(snapshot) {
  return safeNumber(snapshot?.netProfitBn, 0);
}

function isLossMakingNetOutcome(snapshot) {
  return resolvedNetOutcomeValue(snapshot) < -0.05;
}

function isNearZeroNetOutcome(snapshot) {
  return Math.abs(resolvedNetOutcomeValue(snapshot)) < 0.05;
}

function resolvedNetOutcomeLabel(snapshot) {
  if (snapshot?.netProfitLabel) return snapshot.netProfitLabel;
  return isLossMakingNetOutcome(snapshot) ? "Net loss" : "Net profit";
}

function formatNetOutcomeBillions(snapshot) {
  const value = resolvedNetOutcomeValue(snapshot);
  return isLossMakingNetOutcome(snapshot) ? formatBillions(value, true) : formatBillions(value);
}

function weightedMetricForGroups(groups, key, valueKey = "valueBn") {
  const total = groups.reduce((sum, item) => sum + safeNumber(item?.[valueKey]), 0);
  if (!total) return null;
  const weighted = groups.reduce((sum, item) => {
    const metric = item?.[key];
    if (metric === null || metric === undefined || Number.isNaN(Number(metric))) return sum;
    return sum + safeNumber(item?.[valueKey]) * Number(metric);
  }, 0);
  return Number((weighted / total).toFixed(1));
}

function normalizeGroupFlowTotalsToRevenue(groups = [], revenueBn = null) {
  const normalized = [...(groups || [])].map((item) => ({
    ...item,
    flowValueBn: safeNumber(item?.flowValueBn ?? item?.valueBn),
  }));
  const revenueValue = safeNumber(revenueBn);
  if (!normalized.length || revenueValue <= 0) return normalized;
  const totalFlowValue = normalized.reduce((sum, item) => sum + safeNumber(item.flowValueBn), 0);
  if (totalFlowValue <= 0) return normalized;
  const overflowTolerance = Math.max(0.02, revenueValue * 0.002);
  if (totalFlowValue <= revenueValue + overflowTolerance) return normalized;
  const scale = revenueValue / totalFlowValue;
  let runningTotal = 0;
  return normalized.map((item, index) => {
    const baseFlowValue = safeNumber(item.flowValueBn);
    const scaledFlowValue =
      index === normalized.length - 1
        ? Number(Math.max(revenueValue - runningTotal, 0).toFixed(3))
        : Number(Math.max(baseFlowValue * scale, 0).toFixed(3));
    runningTotal += scaledFlowValue;
    return {
      ...item,
      flowValueBn: scaledFlowValue,
      flowNormalizedToRevenue: true,
    };
  });
}

function sortBusinessGroupsByValue(groups) {
  return [...(groups || [])].sort((left, right) => {
    const rightValue = safeNumber(right?.valueBn, safeNumber(right?.flowValueBn));
    const leftValue = safeNumber(left?.valueBn, safeNumber(left?.flowValueBn));
    return rightValue - leftValue;
  });
}

function normalizePrototypeBusinessGroups(groups, prototypeKey) {
  const items = [...(groups || [])].map((item) => ({
    ...item,
    flowValueBn: item?.flowValueBn ?? item?.valueBn,
  }));
  if (!items.length) return items;
  const refreshMonochromePalette = (rows, styleKey) => {
    const distinctColors = new Set(rows.map((item) => String(item.nodeColor || item.labelColor || "").toLowerCase()).filter(Boolean));
    if (distinctColors.size > 2) return rows;
    const palette = revenuePaletteForStyle(null, styleKey, rows.length);
    return rows.map((item, index) => {
      const color = palette[index % palette.length];
      return {
        ...item,
        nodeColor: color,
        flowColor: rgba(color, 0.58),
        labelColor: color,
        valueColor: color,
      };
    });
  };

  if (prototypeKey === "membership-fee-bridge") {
    const membershipGroup =
      items.find((item) => normalizeLabelKey(item.id || item.memberKey || item.name) === "membership") ||
      items.find((item) => normalizeLabelKey(item.name).includes("membership"));
    if (membershipGroup && items.length >= 2) {
      const netSalesMembers = items.filter((item) => item !== membershipGroup);
      const valueBn = netSalesMembers.reduce((sum, item) => sum + safeNumber(item.valueBn), 0);
      const flowValueBn = netSalesMembers.reduce((sum, item) => sum + safeNumber(item.flowValueBn ?? item.valueBn), 0);
      const netSalesGroup = {
        id: "netsales",
        memberKey: "netsales",
        name: "Net Sales",
        displayLines: ["Net Sales"],
        valueBn,
        flowValueBn,
        yoyPct: weightedMetricForGroups(netSalesMembers, "yoyPct"),
        qoqPct: weightedMetricForGroups(netSalesMembers, "qoqPct", "flowValueBn"),
        nodeColor: UNIVERSAL_REVENUE_SEGMENT_PALETTE[0],
        flowColor: rgba(UNIVERSAL_REVENUE_SEGMENT_PALETTE[0], 0.58),
        labelColor: UNIVERSAL_REVENUE_SEGMENT_PALETTE[0],
        valueColor: UNIVERSAL_REVENUE_SEGMENT_PALETTE[0],
      };
      return [
        netSalesGroup,
        {
          ...membershipGroup,
          id: "membershipfee",
          memberKey: "membershipfee",
          name: "Membership Fee",
          displayLines: ["Membership Fee"],
          nodeColor: membershipGroup.nodeColor || UNIVERSAL_REVENUE_SEGMENT_PALETTE[1],
          flowColor: membershipGroup.flowColor || rgba(UNIVERSAL_REVENUE_SEGMENT_PALETTE[1], 0.58),
          labelColor: membershipGroup.nodeColor || UNIVERSAL_REVENUE_SEGMENT_PALETTE[1],
          valueColor: membershipGroup.nodeColor || UNIVERSAL_REVENUE_SEGMENT_PALETTE[1],
        },
      ];
    }
  }

  if (prototypeKey === "commerce-service-bridge") {
    const normalizedItems = items.map((item) => {
      const key = normalizeLabelKey(item.id || item.memberKey || item.name);
      if (key === "amazonwebservices") {
        return {
          ...item,
          name: "AWS",
          displayLines: ["AWS"],
          supportLines: item.supportLines?.length ? item.supportLines : null,
        };
      }
      if (key === "advertisingservices") {
        return {
          ...item,
          name: "Advertising",
          displayLines: ["Advertising"],
          supportLines: item.supportLines?.length ? item.supportLines : ["Amazon Ads"],
        };
      }
      if (key === "subscriptionservices") {
        return {
          ...item,
          name: "Subscription",
          displayLines: ["Subscription"],
        };
      }
      if (key === "physicalstores") {
        return {
          ...item,
          name: "Physical Store",
          displayLines: ["Physical Store"],
        };
      }
      if (key === "thirdpartysellerservices") {
        return {
          ...item,
          name: "3rd party sellers services",
          displayLines: ["3rd party sellers", "services"],
        };
      }
      if (key === "otherservices") {
        return {
          ...item,
          name: "Other",
          displayLines: ["Other"],
          microSource: safeNumber(item.valueBn) < 2,
          compactLabel: safeNumber(item.valueBn) < 2 ? true : item.compactLabel,
        };
      }
      if (safeNumber(item.valueBn) < 2) {
        return {
          ...item,
          microSource: true,
          compactLabel: true,
          layoutDensity: item.layoutDensity || "dense",
        };
      }
      return item;
    });
    return refreshMonochromePalette(normalizedItems, "commerce-service-bridge");
  }

  if (prototypeKey === "ad-funnel-bridge") {
    return items.map((item) => {
      const key = normalizeLabelKey(item.id || item.memberKey || item.name);
      if (key === "googleservices") {
        return {
          ...item,
          id: "adrevenue",
          memberKey: "adrevenue",
          name: "Ad Revenue",
          displayLines: ["Ad Revenue"],
        };
      }
      if (key === "other") {
        return {
          ...item,
          microSource: true,
          compactLabel: true,
          layoutDensity: item.layoutDensity || "dense",
        };
      }
      if (safeNumber(item.valueBn) < 2) {
        return {
          ...item,
          compactLabel: true,
          layoutDensity: item.layoutDensity || "dense",
        };
      }
      return item;
    });
  }

  if (prototypeKey === "apps-labs-bridge") {
    return items.map((item) => {
      const key = normalizeLabelKey(item.id || item.memberKey || item.name);
      if (key === "familyofapps") {
        return {
          ...item,
          name: "Family of Apps",
          displayLines: ["Family of Apps", "(FoA)"],
        };
      }
      if (key === "realitylabs") {
        return {
          ...item,
          name: "Reality Labs",
          displayLines: ["Reality Labs", "(RL)"],
        };
      }
      return item;
    });
  }

  return items;
}

function prototypeLockupKeyForItem(prototypeKey, item, tier = "group") {
  const key = normalizeLabelKey(item?.id || item?.memberKey || item?.name);
  if (prototypeKey === "ad-funnel-bridge") {
    if (tier === "detail") {
      if (key === "searchadvertising") return "google-search-business";
      if (key === "youtube") return "youtube-business";
      if (key === "admob") return "admob-business";
      return null;
    }
    if (key === "googleplay") return "google-play-business";
    if (key === "googlecloud") return "google-cloud-business";
    if (key === "adrevenue") return "google-ad-stack-business";
    return null;
  }
  if (prototypeKey === "commerce-service-bridge") {
    if (key === "onlinestores") return "amazon-online-business";
    if (key === "physicalstore" || key === "physicalstores") return "wholefoods-business";
    if (key === "advertising") return "amazon-ads-business";
    if (key === "subscription") return "prime-audible-business";
    if (key === "aws" || key === "amazonwebservices") return "aws-business";
    return null;
  }
  if (prototypeKey === "apps-labs-bridge") {
    if (key === "familyofapps") return "meta-apps-business";
    if (key === "realitylabs") return "meta-quest-business";
    return null;
  }
  return null;
}

function normalizePrototypeDetailGroups(groups, prototypeKey) {
  return [...(groups || [])].map((item) => {
    const lockupKey = prototypeLockupKeyForItem(prototypeKey, item, "detail");
    const normalizedItem = lockupKey ? { ...item, lockupKey } : { ...item };
    if (prototypeKey === "apps-labs-bridge") {
      const targetKey = normalizeLabelKey(normalizedItem.targetId || normalizedItem.targetName || "");
      if (targetKey === "familyofapps") {
        normalizedItem.targetName = "Family of Apps";
      } else if (targetKey === "realitylabs") {
        normalizedItem.targetName = "Reality Labs";
      }
    }
    return normalizedItem;
  });
}

function prototypeDefinitionForKey(prototypeKey) {
  return STRUCTURAL_PROTOTYPES[prototypeKey] || STRUCTURAL_PROTOTYPES["default-replica"];
}

function inferSnapshotPrototype(snapshot, company, entry = null) {
  const styleKey = snapshot?.officialRevenueStyle || entry?.officialRevenueStyle || null;
  if (styleKey && OFFICIAL_STYLE_TO_PROTOTYPE[styleKey]) {
    return OFFICIAL_STYLE_TO_PROTOTYPE[styleKey];
  }
  const normalizedNames = new Set(
    [...(snapshot?.businessGroups || [])].map((item) => normalizeLabelKey(item.id || item.memberKey || item.name))
  );
  if (
    (normalizedNames.has("productivitybusinessprocesses") || normalizedNames.has("productivityandbusinessprocesses")) &&
    normalizedNames.has("intelligentcloud") &&
    normalizedNames.has("morepersonalcomputing")
  ) {
    return "triad-lockup-bridge";
  }
  if (normalizedNames.has("membership") || normalizedNames.has("membershipfee")) {
    return "membership-fee-bridge";
  }
  if (normalizedNames.has("adrevenue") && (normalizedNames.has("googleplay") || normalizedNames.has("googlecloud"))) {
    return "ad-funnel-bridge";
  }
  if (
    normalizedNames.has("onlinestores") &&
    (normalizedNames.has("amazonwebservices") || normalizedNames.has("aws") || normalizedNames.has("thirdpartysellerservices"))
  ) {
    return "commerce-service-bridge";
  }
  if (normalizedNames.has("familyofapps") && normalizedNames.has("realitylabs")) {
    return "apps-labs-bridge";
  }
  if ((snapshot?.leftDetailGroups || []).length) {
    return "hierarchical-detail-bridge";
  }
  return "default-replica";
}

function attachLocalizedNameHints(items = []) {
  return [...items].map((item) => ({
    ...item,
    nameZh: item?.nameZh || translateBusinessLabelToZh(item?.name || ""),
  }));
}

function applyPrototypeLanguage(snapshot, company, entry = null) {
  const prototypeKey = snapshot.prototypeKey || inferSnapshotPrototype(snapshot, company, entry);
  const prototype = prototypeDefinitionForKey(prototypeKey);
  const normalizedBelowOperatingItems = attachLocalizedNameHints(snapshot.belowOperatingItems || []).map((item) => ({
    ...item,
    valueFormat: item.valueFormat || "negative-parentheses",
  }));
  const derivedFields = adaptPrototypeDerivedFields(snapshot, company, entry, prototypeKey);
  const nextSnapshot = {
    ...snapshot,
    prototypeKey,
    prototypeLabel: prototype.label,
    prototypeFlags: {
      ...(prototype.flags || {}),
      ...(snapshot.prototypeFlags || {}),
    },
    businessGroups: sortBusinessGroupsByValue(
      normalizePrototypeBusinessGroups(attachLocalizedNameHints(snapshot.businessGroups || []), prototypeKey).map((item) => {
        const lockupKey = item.lockupKey || prototypeLockupKeyForItem(prototypeKey, item, "group");
        return lockupKey ? { ...item, lockupKey } : item;
      })
    ),
    leftDetailGroups: normalizePrototypeDetailGroups(attachLocalizedNameHints(snapshot.leftDetailGroups || []), prototypeKey),
    opexBreakdown: attachLocalizedNameHints(snapshot.opexBreakdown || []),
    costBreakdown: attachLocalizedNameHints(snapshot.costBreakdown || []),
    belowOperatingItems: normalizedBelowOperatingItems,
    positiveAdjustments: attachLocalizedNameHints(snapshot.positiveAdjustments || []).map((item) => ({
      ...item,
      valueFormat: item.valueFormat || "plain",
    })),
    ...derivedFields,
  };
  Object.entries(prototype.defaults || {}).forEach(([key, value]) => {
    if (nextSnapshot[key] === null || nextSnapshot[key] === undefined || nextSnapshot[key] === "") {
      nextSnapshot[key] = deepClone(value);
    }
  });
  if (nextSnapshot.prototypeFlags?.leftAnchoredRevenueLabel && !nextSnapshot.revenueLabelMode) {
    nextSnapshot.revenueLabelMode = "left";
  }
  if (nextSnapshot.prototypeFlags?.preferCompactSources && nextSnapshot.compactSourceLabels === undefined) {
    nextSnapshot.compactSourceLabels = true;
  }
  return nextSnapshot;
}

function templatePresetKey(snapshot, company) {
  return snapshot?.prototypeKey || inferSnapshotPrototype(snapshot, company);
}

function templatePresetLabel(snapshot, company) {
  const key = templatePresetKey(snapshot, company);
  return prototypeDefinitionForKey(key).label;
}

function baseTemplateTokensForSnapshot(snapshot, company) {
  if (!snapshot) return deepClone(BASE_TEMPLATE_TOKENS);
  const prototype = prototypeDefinitionForKey(templatePresetKey(snapshot, company));
  const styleTokens = prototype.tokenPresetKey ? TEMPLATE_STYLE_PRESETS[prototype.tokenPresetKey] || {} : {};
  const prototypeTokens = deepMerge(styleTokens, prototype.tokens || {});
  return deepMerge(
    deepMerge(BASE_TEMPLATE_TOKENS, prototypeTokens),
    {
      layout: deepClone(snapshot.layout || {}),
      ribbon: deepClone(snapshot.ribbon || BASE_TEMPLATE_TOKENS.ribbon),
      typography: deepClone(snapshot.typography || {}),
    }
  );
}

function effectiveTemplateTokens(snapshot, company) {
  const presetKey = templatePresetKey(snapshot, company);
  const base = baseTemplateTokensForSnapshot(snapshot, company);
  const override = state.calibration.tokenOverridesByPreset[presetKey] || {};
  return deepMerge(base, override);
}

function applyTemplateTokensToSnapshot(snapshot, company) {
  const tokens = effectiveTemplateTokens(snapshot, company);
  const snapshotLayout = deepClone(snapshot.layout || {});
  const layoutFromTokens = deepClone(tokens.layout || {});
  ["costNodeTop", "opNodeTop", "opexNodeTop", "netNodeTop", "costBreakdownX"].forEach((key) => {
    if (snapshotLayout[key] === null || snapshotLayout[key] === undefined) {
      delete layoutFromTokens[key];
    }
  });
  return {
    ...snapshot,
    layout: {
      ...layoutFromTokens,
      ...snapshotLayout,
    },
    ribbon: {
      ...(snapshot.ribbon || {}),
      ...(tokens.ribbon || {}),
    },
    typography: {
      ...(snapshot.typography || {}),
      ...(tokens.typography || {}),
    },
    templatePresetKey: templatePresetKey(snapshot, company),
    templatePresetLabel: templatePresetLabel(snapshot, company),
    templateTokens: tokens,
  };
}

function snapshotCanvasSize(snapshot) {
  const baseWidth = safeNumber(snapshot?.layout?.canvasWidth, 2048);
  const baseHeight = safeNumber(snapshot?.layout?.canvasHeight, 1325);
  const baseDesignHeight = safeNumber(snapshot?.layout?.canvasDesignHeight, 1160);
  const nodeWidth = 58;
  const sourceNodeWidth = safeNumber(snapshot?.layout?.sourceNodeWidth, Math.max(nodeWidth - 6, 48));
  const stageLayout = resolveUniformStageLayout(snapshot, {
    nodeWidth,
    sourceNodeWidth,
  });
  const showQoq = hasSnapshotQoqMetrics(snapshot);
  const sources = Array.isArray(snapshot?.businessGroups) ? snapshot.businessGroups.filter((item) => safeNumber(item?.valueBn) > 0.02) : [];
  const detailGroups = Array.isArray(snapshot?.leftDetailGroups) ? snapshot.leftDetailGroups.filter((item) => safeNumber(item?.valueBn) > 0.02) : [];
  const opexItems = Array.isArray(snapshot?.opexBreakdown) ? snapshot.opexBreakdown.filter((item) => safeNumber(item?.valueBn) > 0.02) : [];
  const deductionItems = Array.isArray(snapshot?.belowOperatingItems)
    ? snapshot.belowOperatingItems.filter((item) => safeNumber(item?.valueBn) > 0.02)
    : [];
  const costBreakdownItems = Array.isArray(snapshot?.costBreakdown) ? snapshot.costBreakdown.filter((item) => safeNumber(item?.valueBn) > 0.02) : [];
  const positiveItems = Array.isArray(snapshot?.positiveAdjustments) ? snapshot.positiveAdjustments.filter((item) => safeNumber(item?.valueBn) > 0.02) : [];
  const detailTargetKeys = new Set(
    detailGroups
      .map((item) => normalizeLabelKey(item.targetId || item.targetName || item.target || item.groupName))
      .filter(Boolean)
  );
  const autoStackRegularSourcesBelowDetails = shouldStackRegularSourcesBelowDetails(snapshot, detailTargetKeys, sources);
  const sourceCount = sources.length;
  const detailCount = detailGroups.length;
  const opexCount = opexItems.length;
  const deductionCount = deductionItems.length;
  const costBreakdownCount = costBreakdownItems.length;
  const positiveCount = positiveItems.length;
  const bottomCanvasPadding =
    safeNumber(snapshot?.layout?.bottomCanvasPadding, 88) +
    Math.max(sourceCount + detailCount + opexCount + deductionCount + costBreakdownCount - 12, 0) * 4;
  const usesPreDetailRevenueLayout = detailCount > 0;
  const sourceDensity = sourceCount >= 11 ? "ultra" : sourceCount >= 8 ? "dense" : sourceCount >= 6 ? "compact" : "regular";
  const compactSources = !!snapshot?.compactSourceLabels || sourceDensity !== "regular";
  const sourceExtra =
    Math.max(sourceCount - 5, 0) * 54 +
    Math.max(sourceCount - 9, 0) * 30 +
    Math.max(sourceCount - 13, 0) * 42;
  const detailExtra = Math.max(detailCount - 3, 0) * 18 + Math.max(detailCount - 6, 0) * 10;
  const rightExtra =
    Math.max(opexCount - 2, 0) * 44 +
    Math.max(deductionCount - 1, 0) * 58 +
    Math.max(costBreakdownCount - 1, 0) * 36 +
    positiveCount * 46;
  const densityExtra =
    (sourceCount + detailCount >= 8 ? 56 : 0) +
    (sourceCount + detailCount >= 11 ? 86 : 0) +
    (sourceCount + detailCount >= 14 ? 108 : 0) +
    (sourceCount >= 8 ? 44 : 0) +
    (sourceCount >= 12 ? 72 : 0) +
    (sourceCount >= 16 ? 84 : 0) +
    (opexCount + deductionCount + costBreakdownCount >= 6 ? 40 : 0);
  const hierarchyExtra =
    (detailCount ? 72 : 0) +
    Math.max(sourceCount - 6, 0) * 22 +
    Math.max(sourceCount - 8, 0) * 26;
  const sourceLabelTitleSize = safeNumber(snapshot?.layout?.sourceTemplateTitleSize, 28);
  const detailLabelTitleSize = safeNumber(snapshot?.layout?.detailSourceTitleSize, sourceLabelTitleSize);
  const baseLeftX = stageLayout.leftX;
  const baseLeftDetailX = stageLayout.leftDetailX;
  const sourceTemplateLabelGapX = safeNumber(
    snapshot?.layout?.sourceTemplateLabelGapX,
    safeNumber(snapshot?.layout?.sourceLabelGapX, 18)
  );
  const detailSourceLabelGapX = safeNumber(snapshot?.layout?.detailSourceLabelGapX, sourceTemplateLabelGapX);
  const leftDetailWidth = safeNumber(snapshot?.layout?.leftDetailWidth, sourceNodeWidth);
  const baseSourceLabelX = safeNumber(
    snapshot?.layout?.sourceTemplateLabelX,
    usesPreDetailRevenueLayout
      ? safeNumber(snapshot?.layout?.sourceLabelX, baseLeftX - sourceTemplateLabelGapX)
      : baseLeftX - sourceTemplateLabelGapX
  );
  const baseDetailLabelX = safeNumber(snapshot?.layout?.detailSourceLabelX, baseLeftDetailX - detailSourceLabelGapX);
  const preDetailLeadEnabled = autoStackRegularSourcesBelowDetails;
  const leadEligibleSourceIndexes = collectPreDetailLeadEligibleSourceIndexes(detailTargetKeys, sources);
  const regularSourceRankMap = new Map(leadEligibleSourceIndexes.map((sourceIndex, orderIndex) => [sourceIndex, orderIndex]));
  const sourceLabelLeftEdges = sources.map((item, sourceIndex) => {
    const compactMode = compactSources || item.compactLabel;
    const labelLines = resolveSourceLabelLines(item, {
      compactMode,
      fontSize: sourceLabelTitleSize,
      maxWidth: currentChartLanguage() === "zh" ? 166 : 198,
    });
    const leadOffsetX =
      preDetailLeadEnabled && regularSourceRankMap.has(sourceIndex)
        ? resolvePreDetailRegularSourceLeadDistance(snapshot, {
            regularCount: leadEligibleSourceIndexes.length,
            orderIndex: regularSourceRankMap.get(sourceIndex),
            leftX: baseLeftX,
            detailRightX: baseLeftDetailX + leftDetailWidth,
          })
        : 0;
    return baseSourceLabelX - leadOffsetX - approximateTextBlockWidth(labelLines, sourceLabelTitleSize) - 12;
  });
  const detailLabelLeftEdges = detailGroups.map((item) => {
    const compactMode = compactSources || item.compactLabel;
    const labelLines = resolveSourceLabelLines(item, {
      compactMode,
      fontSize: detailLabelTitleSize,
      maxWidth: currentChartLanguage() === "zh" ? 166 : 198,
    });
    return baseDetailLabelX - approximateTextBlockWidth(labelLines, detailLabelTitleSize) - 12;
  });
  const leftCanvasPadding = safeNumber(snapshot?.layout?.leftCanvasPadding, 44);
  const minLabelLeftEdge = Math.min(...sourceLabelLeftEdges, ...detailLabelLeftEdges, leftCanvasPadding);
  const leftShiftX = usesPreDetailRevenueLayout ? Math.max(Math.ceil(leftCanvasPadding - minLabelLeftEdge), 0) : 0;

  const sourceNodeMinY = safeNumber(snapshot?.layout?.sourceNodeMinY, safeNumber(snapshot?.layout?.revenueTop, 330) - 8);
  const sourceNodeMaxY = safeNumber(
    snapshot?.layout?.sourceNodeMaxY,
    sourceDensity === "ultra" ? 1136 : sourceDensity === "dense" ? 1108 : 1058
  );
  const isAdFunnelDetailLayout = snapshot?.prototypeKey === "ad-funnel-bridge";
  const leftDetailMinY = safeNumber(snapshot?.layout?.leftDetailMinY, isAdFunnelDetailLayout ? 224 : 246);
  const leftDetailMaxY = safeNumber(snapshot?.layout?.leftDetailMaxY, isAdFunnelDetailLayout ? 1042 : 1026);
  const microSourceHeight = safeNumber(snapshot?.layout?.microSourceHeight, 48);
  const sourceBoxGap = safeNumber(
    snapshot?.layout?.sourceLabelGap,
    sourceDensity === "ultra" ? 4 : sourceDensity === "dense" ? 8 : compactSources ? 12 : 24
  ) + (showQoq ? (compactSources ? 8 : 14) : compactSources ? 4 : 0);
  const detailBoxGap = safeNumber(snapshot?.layout?.leftDetailGap, safeNumber(snapshot?.layout?.leftDetailNodeGap, sourceBoxGap));
  const sourceBoxHeights = sources.map((item) =>
    item.microSource
      ? microSourceHeight
      : estimateReplicaSourceBoxHeight(item, showQoq, compactSources || item.compactLabel)
  );
  const detailBoxHeights = detailGroups.map((item) => estimateReplicaSourceBoxHeight(item, showQoq, compactSources || item.compactLabel));
  const sourceSpanRequired = estimatedStackSpan(sourceBoxHeights, sourceBoxGap);
  const detailSpanRequired = estimatedStackSpan(detailBoxHeights, detailBoxGap);
  const sourceSpanAvailable = Math.max(sourceNodeMaxY - sourceNodeMinY, 1);
  const detailSpanAvailable = Math.max(leftDetailMaxY - leftDetailMinY, 1);
  const sourceSpanOverflow = Math.max(sourceSpanRequired - sourceSpanAvailable, 0);
  const detailSpanOverflow = Math.max(detailSpanRequired - detailSpanAvailable, 0);
  let sequentialLeftOverflow = 0;
  if (autoStackRegularSourcesBelowDetails) {
    const summarySourceHeights = [];
    const regularSourceHeights = [];
    sources.forEach((item, index) => {
      const sourceKey = normalizeLabelKey(item.id || item.memberKey || item.name);
      if (detailTargetKeys.has(sourceKey)) {
        summarySourceHeights.push(sourceBoxHeights[index]);
      } else {
        regularSourceHeights.push(sourceBoxHeights[index]);
      }
    });
    const sequentialSpanRequired =
      estimatedStackSpan(summarySourceHeights, sourceBoxGap) +
      estimatedStackSpan(detailBoxHeights, detailBoxGap) +
      estimatedStackSpan(regularSourceHeights, sourceBoxGap) +
      (summarySourceHeights.length && detailBoxHeights.length ? sourceBoxGap : 0) +
      (regularSourceHeights.length && detailBoxHeights.length ? sourceBoxGap : 0);
    const sequentialSpanAvailable = Math.max(Math.max(sourceNodeMaxY, leftDetailMaxY) - Math.min(sourceNodeMinY, leftDetailMinY), 1);
    sequentialLeftOverflow = Math.max(sequentialSpanRequired - sequentialSpanAvailable, 0);
  }
  const boundedSequentialLeftOverflow = usesPreDetailRevenueLayout
    ? Math.min(sequentialLeftOverflow, safeNumber(snapshot?.layout?.maxSequentialLeftOverflow, 136))
    : sequentialLeftOverflow;

  const templateTokens = snapshot?.templateTokens || {};
  const opexBand = prototypeBandConfig(templateTokens, "opex", opexCount);
  const opexDensity = opexBand.densityKey === "dense" ? "dense" : "regular";
  const opexSpanRequired = estimatedStackSpan(
    opexItems.map((item) => Math.max(estimateReplicaTreeBoxHeight(item, { density: opexDensity }) + safeNumber(opexBand.heightOffset, 0), 24)),
    safeNumber(opexBand.gap, opexCount >= 5 ? 18 : 28)
  );
  const opexSpanAvailable = Math.max(
    safeNumber(opexBand.maxY, opexCount >= 5 ? 982 : 1028) - safeNumber(opexBand.minY, opexCount >= 5 ? 680 : 700),
    1
  );
  const deductionBand = prototypeBandConfig(templateTokens, "deductions");
  const deductionDensity = deductionCount >= 3 ? "dense" : "regular";
  const deductionSpanRequired = estimatedStackSpan(
    deductionItems.map((item) => Math.max(estimateReplicaTreeBoxHeight(item, { density: deductionDensity }) + safeNumber(deductionBand.heightOffset, -8), 24)),
    safeNumber(deductionBand.gap, 24)
  );
  const deductionSpanAvailable = Math.max(
    safeNumber(deductionBand.maxClamp, 680) - safeNumber(deductionBand.minClamp, 420),
    1
  );
  const costBreakdownBand = prototypeBandConfig(templateTokens, "costBreakdown");
  const costBreakdownDensity = costBreakdownCount >= 3 ? "dense" : "regular";
  const costBreakdownSpanRequired = estimatedStackSpan(
    costBreakdownItems.map((item) => Math.max(estimateReplicaTreeBoxHeight(item, { density: costBreakdownDensity }) + safeNumber(costBreakdownBand.heightOffset, 0), 24)),
    safeNumber(costBreakdownBand.gap, 24)
  );
  const costBreakdownSpanAvailable = Math.max(
    safeNumber(costBreakdownBand.maxY, 1002) - safeNumber(costBreakdownBand.minY, 744),
    1
  );
  const structuralOverflow =
    sourceSpanOverflow +
    detailSpanOverflow * 0.7 +
    boundedSequentialLeftOverflow +
    Math.max(opexSpanRequired - opexSpanAvailable, 0) +
    Math.max(deductionSpanRequired - deductionSpanAvailable, 0) * 0.7 +
    Math.max(costBreakdownSpanRequired - costBreakdownSpanAvailable, 0) * 0.85 +
    (positiveCount ? 26 + Math.max(positiveCount - 1, 0) * 18 : 0);
  const detailLayoutExtraScale = usesPreDetailRevenueLayout ? 0.68 : 1;
  const extraHeight =
    sourceExtra +
    detailExtra +
    Math.max(rightExtra, 0) +
    densityExtra * detailLayoutExtraScale +
    hierarchyExtra * detailLayoutExtraScale +
    structuralOverflow * (usesPreDetailRevenueLayout ? 0.58 : 0.78);
  const height = baseHeight + extraHeight;
  const revenueBn = Math.max(safeNumber(snapshot?.revenueBn), safeNumber(snapshot?.layout?.ratioRevenueFloorBn, 0.25));
  const opexRatio = Math.max(safeNumber(snapshot?.operatingExpensesBn) / revenueBn, 0);
  const costRatio = Math.max(safeNumber(snapshot?.costOfRevenueBn) / revenueBn, 0);
  const designHeight =
    baseDesignHeight +
    Math.max(opexRatio - 1.45, 0) * 320 +
    Math.max(costRatio - 1.15, 0) * 120 +
    structuralOverflow * (usesPreDetailRevenueLayout ? 0.48 : 1.05) +
    Math.max(detailCount - 2, 0) * 22;
  return {
    width: Math.max(Math.round(baseWidth + leftShiftX + safeNumber(stageLayout.rightExpansion, 0)), 1),
    height: Math.max(Math.round(height + bottomCanvasPadding), 1),
    designHeight: Math.max(Math.round(designHeight + bottomCanvasPadding), 1),
    leftShiftX: Math.max(Math.round(leftShiftX), 0),
  };
}

function currentSnapshotLogoKeys() {
  const snapshot = state.currentSnapshot;
  if (!snapshot) return [];
  const keys = new Set();
  if (snapshot.companyLogoKey) keys.add(normalizeLogoKey(snapshot.companyLogoKey));
  (snapshot.businessGroups || []).forEach((item) => {
    if (item.lockupKey && !String(item.lockupKey).startsWith("region-")) {
      keys.add(normalizeLogoKey(item.lockupKey));
    }
  });
  return [...keys].filter(Boolean);
}

function queueLogoNormalization(logoKey) {
  const normalizedKey = normalizeLogoKey(logoKey);
  const asset = state.logoCatalog?.[normalizedKey];
  if (!normalizedKey || !asset || state.normalizedLogoKeys[normalizedKey] || state.logoNormalizationJobs[normalizedKey]) return;
  state.logoNormalizationJobs[normalizedKey] = normalizeBitmapLogoAsset(asset)
    .then((normalizedAsset) => {
      state.logoCatalog[normalizedKey] = normalizedAsset || asset;
      state.normalizedLogoKeys[normalizedKey] = true;
    })
    .catch(() => {
      state.normalizedLogoKeys[normalizedKey] = true;
    })
    .finally(() => {
      delete state.logoNormalizationJobs[normalizedKey];
      if (currentSnapshotLogoKeys().includes(normalizedKey)) {
        requestAnimationFrame(() => {
          if (state.currentSnapshot) renderCurrent();
        });
      }
    });
}

function warmVisibleLogoAssets() {
  currentSnapshotLogoKeys().forEach((logoKey) => queueLogoNormalization(logoKey));
}

function normalizeCompanyBrand(brand = null) {
  const candidate = isPlainObject(brand) ? brand : {};
  return {
    primary: candidate.primary || DEFAULT_COMPANY_BRAND.primary,
    secondary: candidate.secondary || DEFAULT_COMPANY_BRAND.secondary,
    accent: candidate.accent || DEFAULT_COMPANY_BRAND.accent,
  };
}

function normalizeLoadedCompany(company, index = 0) {
  const fallback = COMPANY_METADATA_FALLBACKS[String(company?.id || "").trim().toLowerCase()] || {};
  const ticker = String(company?.ticker || fallback.ticker || "N/A");
  const nameEn = String(company?.nameEn || fallback.nameEn || ticker);
  const nameZh = String(company?.nameZh || fallback.nameZh || nameEn);
  const quarterCount = Array.isArray(company?.quarters) ? company.quarters.length : 0;
  const coverage = {
    ...(isPlainObject(company?.coverage) ? company.coverage : {}),
    quarterCount: Math.max(safeNumber(company?.coverage?.quarterCount, quarterCount), quarterCount),
  };
  return {
    ...fallback,
    ...company,
    ticker,
    nameEn,
    nameZh,
    slug: company?.slug || fallback.slug || normalizeLabelKey(nameEn || ticker),
    rank: safeNumber(company?.rank, safeNumber(fallback.rank, index + 1)),
    isAdr: company?.isAdr !== undefined ? !!company.isAdr : !!fallback.isAdr,
    brand: normalizeCompanyBrand({
      ...(isPlainObject(fallback.brand) ? fallback.brand : {}),
      ...(isPlainObject(company?.brand) ? company.brand : {}),
    }),
    coverage,
  };
}

function companySearchValue(company) {
  return `${company?.nameZh || ""} ${company?.nameEn || ""} ${company?.ticker || ""}`.toLowerCase();
}

function rgba(hex, alpha) {
  const normalized = hex.replace("#", "");
  const safe = normalized.length === 3
    ? normalized.split("").map((part) => `${part}${part}`).join("")
    : normalized;
  const red = Number.parseInt(safe.slice(0, 2), 16);
  const green = Number.parseInt(safe.slice(2, 4), 16);
  const blue = Number.parseInt(safe.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function mixHex(hexA, hexB, ratio = 0.5) {
  const normalizeHex = (value) => {
    const normalized = String(value || "").replace("#", "");
    return normalized.length === 3
      ? normalized.split("").map((part) => `${part}${part}`).join("")
      : normalized.padEnd(6, "0").slice(0, 6);
  };
  const left = normalizeHex(hexA);
  const right = normalizeHex(hexB);
  const mix = clamp(Number(ratio), 0, 1);
  const channelAt = (hex, offset) => Number.parseInt(hex.slice(offset, offset + 2), 16);
  const channel = (offset) => Math.round(channelAt(left, offset) * (1 - mix) + channelAt(right, offset) * mix);
  return `#${[0, 2, 4].map((offset) => channel(offset).toString(16).padStart(2, "0")).join("")}`;
}

function wrapLines(text, maxChars) {
  const raw = String(text || "").trim();
  if (!raw) return [];
  const words = raw.split(/\s+/);
  const lines = [];
  let line = "";
  words.forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (next.length <= maxChars) {
      line = next;
      return;
    }
    if (line) lines.push(line);
    line = word;
  });
  if (line) lines.push(line);
  return lines;
}

function approximateTextWidth(text, fontSize = 16) {
  const raw = String(text || "");
  if (!raw) return 0;
  let emWidth = 0;
  for (const char of raw) {
    if (/\s/.test(char)) {
      emWidth += 0.34;
    } else if (/[\u3400-\u9FFF\uF900-\uFAFF\u3040-\u30FF\uAC00-\uD7AF]/u.test(char)) {
      emWidth += 1;
    } else if (/[MW@#%&]/.test(char)) {
      emWidth += 0.84;
    } else if (/[A-Z0-9$]/.test(char)) {
      emWidth += 0.66;
    } else if (/[ilI1.,:;|!']/u.test(char)) {
      emWidth += 0.32;
    } else if (/[\(\)\[\]\/\\_\-]/.test(char)) {
      emWidth += 0.42;
    } else {
      emWidth += 0.56;
    }
  }
  return emWidth * fontSize;
}

function approximateTextBlockWidth(lines, fontSize = 16) {
  return (lines || []).reduce((maxWidth, line) => Math.max(maxWidth, approximateTextWidth(line, fontSize)), 0);
}

function estimatedStackSpan(heights, gap = 0) {
  const filteredHeights = (heights || []).map((value) => Math.max(safeNumber(value), 0)).filter((value) => value > 0);
  if (!filteredHeights.length) return 0;
  return filteredHeights.reduce((sum, value) => sum + value, 0) + Math.max(filteredHeights.length - 1, 0) * Math.max(safeNumber(gap), 0);
}

function resolvePreDetailRegularSourceLeadCompression(snapshot, regularCount = 0) {
  const detailGroups = Array.isArray(snapshot?.leftDetailGroups)
    ? snapshot.leftDetailGroups.filter((item) => Math.max(safeNumber(item?.valueBn), 0) > 0.02)
    : [];
  if (!detailGroups.length || regularCount <= 0) return 0;
  const totalDetailValue = Math.max(detailGroups.reduce((sum, item) => sum + Math.max(safeNumber(item?.valueBn), 0), 0), 0.01);
  const dominantDetailShare = detailGroups.reduce(
    (largest, item) => Math.max(largest, Math.max(safeNumber(item?.valueBn), 0) / totalDetailValue),
    0
  );
  const smallDetailCount = detailGroups.filter((item) => {
    const valueBn = Math.max(safeNumber(item?.valueBn), 0);
    const share = valueBn / totalDetailValue;
    return valueBn <= 0.42 || share <= 0.055;
  }).length;
  const tinyDetailCount = detailGroups.filter((item) => {
    const valueBn = Math.max(safeNumber(item?.valueBn), 0);
    const share = valueBn / totalDetailValue;
    return valueBn <= 0.2 || share <= 0.028;
  }).length;
  const crowdedLayoutPenalty =
    Math.max(detailGroups.length - 4, 0) * 18 +
    smallDetailCount * 14 +
    tinyDetailCount * 10 +
    Math.max(dominantDetailShare - 0.52, 0) * 120;
  const regularCountWeight = regularCount <= 1 ? 1 : regularCount === 2 ? 0.72 : 0.46;
  const maxCompression = regularCount <= 1 ? 110 : regularCount === 2 ? 86 : 58;
  return clamp(crowdedLayoutPenalty * regularCountWeight, 0, maxCompression);
}

function resolvePreDetailRegularSourceLeadConfig(snapshot, regularCount = 0) {
  const count = Math.max(safeNumber(regularCount), 0);
  const detailCount = Array.isArray(snapshot?.leftDetailGroups)
    ? snapshot.leftDetailGroups.filter((item) => safeNumber(item?.valueBn) > 0.02).length
    : 0;
  const densityBoostX = clamp(Math.max(detailCount - 2, 0) * 10 + Math.max(count - 2, 0) * 8, 0, 42);
  const leadCompressionX = resolvePreDetailRegularSourceLeadCompression(snapshot, count);
  const baseMaxLeadBudgetX = (count >= 4 ? 184 : count >= 3 ? 170 : 154) + densityBoostX;
  return {
    leadGapX: safeNumber(snapshot?.layout?.regularSourceLeadGapX, 22),
    maxLeadBudgetX: safeNumber(
      snapshot?.layout?.regularSourceMaxLeadX,
      Math.max(baseMaxLeadBudgetX - leadCompressionX, count <= 1 ? 86 : count === 2 ? 96 : 112)
    ),
    minLeadFactor: safeNumber(snapshot?.layout?.regularSourceMinLeadFactor, count >= 4 ? 0.52 : count >= 3 ? 0.48 : 0.56),
    leadExponent: safeNumber(snapshot?.layout?.regularSourceLeadExponent, 1.0),
  };
}

function resolvePreDetailRegularSourceLeadDistance(snapshot, options = {}) {
  const regularCount = Math.max(safeNumber(options.regularCount), 0);
  if (!regularCount) return 0;
  const leftX = safeNumber(options.leftX);
  const detailRightX = safeNumber(options.detailRightX);
  const orderIndex = clamp(Math.round(safeNumber(options.orderIndex, regularCount - 1)), 0, Math.max(regularCount - 1, 0));
  const { leadGapX, maxLeadBudgetX, minLeadFactor, leadExponent } = resolvePreDetailRegularSourceLeadConfig(snapshot, regularCount);
  const availableLeadX = Math.max(leftX - (detailRightX + leadGapX), 0);
  const maxLeadX = Math.min(availableLeadX, Math.max(maxLeadBudgetX, 0));
  if (maxLeadX <= 0) return 0;
  const positionNorm = regularCount <= 1 ? 1 : orderIndex / Math.max(regularCount - 1, 1);
  const leadFactor = minLeadFactor + (1 - minLeadFactor) * Math.pow(positionNorm, leadExponent);
  return maxLeadX * clamp(leadFactor, 0, 1);
}

function collectPreDetailLeadEligibleSourceIndexes(detailTargetKeys = new Set(), sourceItems = []) {
  if (!detailTargetKeys?.size || !Array.isArray(sourceItems) || !sourceItems.length) {
    return [];
  }
  let lastDetailTargetIndex = -1;
  sourceItems.forEach((item, index) => {
    const sourceKey = normalizeLabelKey(item?.id || item?.memberKey || item?.name);
    if (sourceKey && detailTargetKeys.has(sourceKey)) {
      lastDetailTargetIndex = index;
    }
  });
  if (lastDetailTargetIndex < 0) return [];
  return sourceItems.reduce((indexes, item, index) => {
    const sourceKey = normalizeLabelKey(item?.id || item?.memberKey || item?.name);
    if (index > lastDetailTargetIndex && sourceKey && !detailTargetKeys.has(sourceKey)) {
      indexes.push(index);
    }
    return indexes;
  }, []);
}

function shouldStackRegularSourcesBelowDetails(snapshot, detailTargetKeys = new Set(), sourceItems = []) {
  const hasDetailGroups = Array.isArray(snapshot?.leftDetailGroups)
    ? snapshot.leftDetailGroups.some((item) => safeNumber(item?.valueBn) > 0.02)
    : false;
  if (!hasDetailGroups || !detailTargetKeys?.size || !Array.isArray(sourceItems) || !sourceItems.length) {
    return false;
  }
  if (snapshot?.prototypeFlags?.stackRegularSourcesBelowDetails === false) {
    return false;
  }
  return collectPreDetailLeadEligibleSourceIndexes(detailTargetKeys, sourceItems).length > 0;
}

function medianNumber(values = []) {
  const filtered = [...values].map((value) => safeNumber(value, null)).filter((value) => value !== null).sort((left, right) => left - right);
  if (!filtered.length) return 0;
  const middle = Math.floor(filtered.length / 2);
  return filtered.length % 2 ? filtered[middle] : (filtered[middle - 1] + filtered[middle]) / 2;
}

function resolveUniformStageGap(layout, stageGaps, options = {}) {
  const filtered = (stageGaps || []).map((value) => safeNumber(value, null)).filter((value) => value !== null && value > 0);
  const minGap = safeNumber(layout?.minUniformStageGapX, safeNumber(options.min, 220));
  const maxGap = safeNumber(layout?.maxUniformStageGapX, safeNumber(options.max, 360));
  const explicitGap = safeNumber(layout?.uniformStageGapX, null);
  const standardGap = safeNumber(layout?.standardStageGapX, safeNumber(options.standard, 332));
  if (explicitGap !== null) return clamp(explicitGap, minGap, maxGap);
  if (!filtered.length) return clamp(standardGap, minGap, maxGap);
  const strategy = String(layout?.uniformStageGapStrategy || options.strategy || "max").toLowerCase();
  let preferredGap;
  if (strategy === "standard" || strategy === "fixed") {
    preferredGap = standardGap;
  } else if (strategy === "median") {
    preferredGap = medianNumber(filtered);
  } else if (strategy === "mean" || strategy === "average") {
    preferredGap = filtered.reduce((sum, value) => sum + value, 0) / filtered.length;
  } else {
    preferredGap = Math.max(...filtered);
  }
  return clamp(preferredGap, minGap, maxGap);
}

function resolvePreferredGraphicWidth(layout, options = {}) {
  return Math.max(safeNumber(layout?.preferredGraphicWidth, safeNumber(options.preferredGraphicWidth, 1996)), 1200);
}

function resolveGapFromGraphicWidth(preferredGraphicWidth, stageCount, fixedNodeSpan) {
  if (!stageCount) return 0;
  return Math.max((Math.max(safeNumber(preferredGraphicWidth, 0), fixedNodeSpan + stageCount * 220) - fixedNodeSpan) / stageCount, 0);
}

function resolveUniformStageLayout(snapshot, options = {}) {
  const layout = snapshot?.layout || {};
  const nodeWidth = safeNumber(options.nodeWidth, 58);
  const sourceNodeWidth = safeNumber(options.sourceNodeWidth, Math.max(nodeWidth - 6, 48));
  const usesHeroLockups = !!options.usesHeroLockups;
  const hasDetailGroups = Array.isArray(snapshot?.leftDetailGroups)
    ? snapshot.leftDetailGroups.some((item) => safeNumber(item?.valueBn) > 0.02)
    : false;
  const leftDetailWidth = safeNumber(layout.leftDetailWidth, sourceNodeWidth);
  const baseLeftDetailX = safeNumber(layout.leftDetailX, 156);
  const baseLeftX = safeNumber(layout.leftX, 368);
  const baseRevenueX = safeNumber(layout.revenueX, 742);
  const baseGrossX = safeNumber(layout.grossX, 1122);
  const baseOpX = safeNumber(layout.opX, 1480);
  const baseRightX = safeNumber(layout.rightX, usesHeroLockups ? 1790 : 1688);
  const preferredGraphicWidth = resolvePreferredGraphicWidth(layout, options);
  const clearGap = (fromX, fromWidth, toX) => Math.max(toX - (fromX + fromWidth), 1);

  if (hasDetailGroups) {
    const stageGaps = [
      clearGap(baseLeftDetailX, leftDetailWidth, baseLeftX),
      clearGap(baseLeftX, sourceNodeWidth, baseRevenueX),
      clearGap(baseRevenueX, nodeWidth, baseGrossX),
      clearGap(baseGrossX, nodeWidth, baseOpX),
      clearGap(baseOpX, nodeWidth, baseRightX),
    ];
    const preferredGap = resolveGapFromGraphicWidth(preferredGraphicWidth, 5, leftDetailWidth + sourceNodeWidth + nodeWidth * 4);
    const targetGap = resolveUniformStageGap(layout, stageGaps, {
      min: Math.max(Math.floor(preferredGap - 20), 300),
      max: Math.max(Math.ceil(preferredGap + 20), Math.floor(preferredGap - 20) + 1),
      standard: preferredGap,
      strategy: "standard",
    });
    const leftX = baseLeftDetailX + leftDetailWidth + targetGap;
    const revenueX = leftX + sourceNodeWidth + targetGap;
    const grossX = revenueX + nodeWidth + targetGap;
    const opX = grossX + nodeWidth + targetGap;
    const rightX = opX + nodeWidth + targetGap;
    return {
      hasDetailGroups,
      targetGap,
      leftDetailX: baseLeftDetailX,
      leftX,
      revenueX,
      grossX,
      opX,
      rightX,
      rightExpansion: Math.max(rightX - baseRightX, 0),
    };
  }

  const stageGaps = [
    clearGap(baseLeftX, sourceNodeWidth, baseRevenueX),
    clearGap(baseRevenueX, nodeWidth, baseGrossX),
    clearGap(baseGrossX, nodeWidth, baseOpX),
    clearGap(baseOpX, nodeWidth, baseRightX),
  ];
  const preferredGap = resolveGapFromGraphicWidth(preferredGraphicWidth, 4, sourceNodeWidth + nodeWidth * 4);
  const targetGap = resolveUniformStageGap(layout, stageGaps, {
    min: Math.max(Math.floor(preferredGap - 28), 320),
    max: Math.max(Math.ceil(preferredGap + 28), Math.floor(preferredGap - 28) + 1),
    standard: preferredGap,
    strategy: "standard",
  });
  const revenueX = baseLeftX + sourceNodeWidth + targetGap;
  const grossX = revenueX + nodeWidth + targetGap;
  const opX = grossX + nodeWidth + targetGap;
  const rightX = opX + nodeWidth + targetGap;
  return {
    hasDetailGroups,
    targetGap,
    leftDetailX: baseLeftDetailX,
    leftX: baseLeftX,
    revenueX,
    grossX,
    opX,
    rightX,
    rightExpansion: Math.max(rightX - baseRightX, 0),
  };
}

function svgTextBlock(x, y, lines, options = {}) {
  const {
    fill = "#111827",
    fontSize = 16,
    weight = 700,
    anchor = "start",
    lineHeight = fontSize + 4,
    opacity = 1,
    haloColor = null,
    haloWidth = 0,
  } = options;
  return lines
    .map(
      (line, index) =>
        `<text x="${x}" y="${y + index * lineHeight}" text-anchor="${anchor}" font-size="${fontSize}" font-weight="${weight}" fill="${fill}" opacity="${opacity}" ${
          haloColor ? `paint-order="stroke fill" stroke="${haloColor}" stroke-width="${haloWidth || 6}" stroke-linejoin="round"` : ""
        }>${escapeHtml(line)}</text>`
    )
    .join("");
}

function smoothBoundaryCurve(x0, x1, y0, y1, geometry = {}) {
  const direction = x1 >= x0 ? 1 : -1;
  const dx = Math.max(Math.abs(x1 - x0), 1);
  const startCurve = clamp(safeNumber(geometry.startCurve, 0.3), 0.08, 0.42);
  const endCurve = clamp(safeNumber(geometry.endCurve, 0.3), 0.08, 0.42);
  const cp1x = x0 + direction * dx * startCurve;
  const cp2x = x1 - direction * dx * endCurve;
  return `C ${cp1x} ${y0}, ${cp2x} ${y1}, ${x1} ${y1}`;
}

function cubicBezierValue(p0, p1, p2, p3, t) {
  const oneMinusT = 1 - t;
  return (
    oneMinusT * oneMinusT * oneMinusT * p0 +
    3 * oneMinusT * oneMinusT * t * p1 +
    3 * oneMinusT * t * t * p2 +
    t * t * t * p3
  );
}

function cubicBezierYForX(targetX, p0x, p1x, p2x, p3x, p0y, p1y, p2y, p3y) {
  const increasing = p3x >= p0x;
  let low = 0;
  let high = 1;
  for (let index = 0; index < 24; index += 1) {
    const mid = (low + high) / 2;
    const x = cubicBezierValue(p0x, p1x, p2x, p3x, mid);
    if ((increasing && x < targetX) || (!increasing && x > targetX)) {
      low = mid;
    } else {
      high = mid;
    }
  }
  const t = (low + high) / 2;
  return cubicBezierValue(p0y, p1y, p2y, p3y, t);
}

function resolveFlowCurveGeometry(x0, y0Top, y0Bottom, x1, y1Top, y1Bottom, options = {}, config = {}) {
  const directionAware = config.directionAware !== false;
  const direction = directionAware ? (x1 >= x0 ? 1 : -1) : 1;
  const dx = Math.max(directionAware ? Math.abs(x1 - x0) : x1 - x0, 1);
  const startBase = safeNumber(options.startCurveFactor, safeNumber(options.curveFactor, 0.5) * 0.76);
  const endBase = safeNumber(options.endCurveFactor, safeNumber(options.curveFactor, 0.5) * 0.74);
  const minStart = safeNumber(options.minStartCurveFactor, 0.17);
  const maxStart = safeNumber(options.maxStartCurveFactor, 0.4);
  const minEnd = safeNumber(options.minEndCurveFactor, 0.16);
  const maxEnd = safeNumber(options.maxEndCurveFactor, 0.38);
  const deltaScale = Math.max(safeNumber(options.deltaScale, 0.98), 0.12);
  const deltaInfluence = safeNumber(options.deltaInfluence, 0.048);
  const deltaCurveBoost = safeNumber(options.deltaCurveBoost, 0.02);
  const thicknessInfluence = safeNumber(options.thicknessInfluence, 0.07);
  const averageThickness = Math.max(((y0Bottom - y0Top) + (y1Bottom - y1Top)) / 2, 1);
  const topDelta = Math.abs(y1Top - y0Top);
  const bottomDelta = Math.abs(y1Bottom - y0Bottom);
  const adaptCurve = (delta, base, minFactor, maxFactor) => {
    const normalizedDelta = clamp(delta / (dx * deltaScale), 0, 1);
    const thicknessBoost = clamp(averageThickness / (dx * 0.96), 0, 1) * thicknessInfluence;
    return clamp(base - normalizedDelta * deltaInfluence * 0.42 + normalizedDelta * deltaCurveBoost + thicknessBoost, minFactor, maxFactor);
  };
  const topStartCurve = adaptCurve(topDelta, startBase, minStart, maxStart);
  const topEndCurve = adaptCurve(topDelta, endBase, minEnd, maxEnd);
  const bottomStartCurve = adaptCurve(bottomDelta, startBase, minStart, maxStart);
  const bottomEndCurve = adaptCurve(bottomDelta, endBase, minEnd, maxEnd);
  let sourceHoldLength = clamp(
    safeNumber(options.sourceHoldLength, dx * safeNumber(options.sourceHoldFactor, 0.095)),
    safeNumber(options.minSourceHoldLength, 10),
    safeNumber(options.maxSourceHoldLength, 34)
  );
  let targetHoldLength = clamp(
    safeNumber(options.targetHoldLength, dx * safeNumber(options.targetHoldFactor, 0.075)),
    safeNumber(options.minTargetHoldLength, 8),
    safeNumber(options.maxTargetHoldLength, 28)
  );
  if (options.adaptiveHold !== false) {
    const centerDelta = Math.abs((y1Top + y1Bottom) / 2 - (y0Top + y0Bottom) / 2);
    const edgeDelta = Math.max(topDelta, bottomDelta, centerDelta);
    const holdDeltaNorm = clamp(edgeDelta / Math.max(dx * safeNumber(options.holdDeltaScale, 0.56), 1), 0, 1);
    const sourceHoldReduction = clamp(safeNumber(options.sourceHoldDeltaReduction, 0.5), 0, 0.88);
    const targetHoldReduction = clamp(safeNumber(options.targetHoldDeltaReduction, 0.58), 0, 0.9);
    sourceHoldLength = Math.max(
      sourceHoldLength * (1 - holdDeltaNorm * sourceHoldReduction),
      safeNumber(options.minAdaptiveSourceHoldLength, 4)
    );
    targetHoldLength = Math.max(
      targetHoldLength * (1 - holdDeltaNorm * targetHoldReduction),
      safeNumber(options.minAdaptiveTargetHoldLength, 4)
    );
  }
  const availableCurveDx = Math.max(dx - 1, 1);
  if (sourceHoldLength + targetHoldLength > availableCurveDx) {
    const scale = availableCurveDx / Math.max(sourceHoldLength + targetHoldLength, 1);
    sourceHoldLength *= scale;
    targetHoldLength *= scale;
  }
  const sourceJoinX = x0 + direction * sourceHoldLength;
  const targetJoinX = x1 - direction * targetHoldLength;
  return {
    direction,
    sourceJoinX,
    targetJoinX,
    topStartCurve,
    topEndCurve,
    bottomStartCurve,
    bottomEndCurve,
  };
}

function flowEnvelopeAtX(targetX, x0, y0Top, y0Bottom, x1, y1Top, y1Bottom, options = {}) {
  const minX = Math.min(x0, x1);
  const maxX = Math.max(x0, x1);
  if (targetX < minX || targetX > maxX) return null;
  const {
    direction,
    sourceJoinX,
    targetJoinX,
    topStartCurve,
    topEndCurve,
    bottomStartCurve,
    bottomEndCurve,
  } = resolveFlowCurveGeometry(x0, y0Top, y0Bottom, x1, y1Top, y1Bottom, options);
  const resolveBoundaryY = (startY, endY, startCurve, endCurve) => {
    if ((direction > 0 && targetX <= sourceJoinX) || (direction < 0 && targetX >= sourceJoinX)) return startY;
    if ((direction > 0 && targetX >= targetJoinX) || (direction < 0 && targetX <= targetJoinX)) return endY;
    const cp1x = sourceJoinX + direction * Math.abs(targetJoinX - sourceJoinX) * startCurve;
    const cp2x = targetJoinX - direction * Math.abs(targetJoinX - sourceJoinX) * endCurve;
    return cubicBezierYForX(targetX, sourceJoinX, cp1x, cp2x, targetJoinX, startY, startY, endY, endY);
  };
  return {
    top: resolveBoundaryY(y0Top, y1Top, topStartCurve, topEndCurve),
    bottom: resolveBoundaryY(y0Bottom, y1Bottom, bottomStartCurve, bottomEndCurve),
  };
}

function flowPath(x0, y0Top, y0Bottom, x1, y1Top, y1Bottom, options = {}) {
  const {
    sourceJoinX,
    targetJoinX,
    topStartCurve,
    topEndCurve,
    bottomStartCurve,
    bottomEndCurve,
  } = resolveFlowCurveGeometry(x0, y0Top, y0Bottom, x1, y1Top, y1Bottom, options, {
    directionAware: false,
  });
  return [
    `M ${x0} ${y0Top}`,
    `L ${sourceJoinX} ${y0Top}`,
    smoothBoundaryCurve(sourceJoinX, targetJoinX, y0Top, y1Top, {
      startCurve: topStartCurve,
      endCurve: topEndCurve,
    }),
    `L ${x1} ${y1Top}`,
    `L ${x1} ${y1Bottom}`,
    `L ${targetJoinX} ${y1Bottom}`,
    smoothBoundaryCurve(targetJoinX, sourceJoinX, y1Bottom, y0Bottom, {
      startCurve: bottomEndCurve,
      endCurve: bottomStartCurve,
    }),
    `L ${x0} ${y0Bottom}`,
    "Z",
  ].join(" ");
}

function outboundFlowPath(x0, y0Top, y0Bottom, x1, y1Top, y1Bottom, options = {}) {
  const targetCoverInsetX = Math.max(safeNumber(options.targetCoverInsetX, 0), 0);
  return flowPath(x0, y0Top, y0Bottom, x1 + targetCoverInsetX, y1Top, y1Bottom, options);
}

function resolveReplicaMetricClusterLayout(nodeTop, hasDeltaLine, options = {}) {
  const compactThreshold = safeNumber(options.compactThreshold, 352);
  const noteLineHeight = safeNumber(options.noteLineHeight, 22);
  const compact = nodeTop <= compactThreshold;
  const placement = compact
    ? {
        blockHeight: hasDeltaLine ? 66 + noteLineHeight : 66,
        preferredClearance: hasDeltaLine ? 102 : 88,
        minTop: 170,
        bottomClearance: hasDeltaLine ? 90 : 76,
      }
    : {
        blockHeight: hasDeltaLine ? 76 + noteLineHeight : 76,
        preferredClearance: hasDeltaLine ? 114 : 96,
        minTop: 152,
        bottomClearance: hasDeltaLine ? 98 : 84,
      };
  if (options.includeTypography === false) {
    return placement;
  }
  const noteSize = safeNumber(options.noteSize, 18);
  return compact
    ? {
        titleSize: 36,
        valueSize: 29,
        subSize: noteSize,
        titleStroke: 9,
        valueStroke: 8,
        subStroke: 6,
        valueOffset: 40,
        subOffset: 66,
        deltaOffset: hasDeltaLine ? 66 + noteLineHeight : 66,
        ...placement,
      }
    : {
        titleSize: 41,
        valueSize: 33,
        subSize: noteSize,
        titleStroke: 10,
        valueStroke: 9,
        subStroke: 6,
        valueOffset: 46,
        subOffset: 76,
        deltaOffset: hasDeltaLine ? 76 + noteLineHeight : 76,
        ...placement,
      };
}

function resolveAdaptiveSourceFan(sourceSlices, options = {}) {
  if (!sourceSlices.length) {
    return {
      spread: Math.max(safeNumber(options.spread, 1.12), 1),
      exponent: Math.max(safeNumber(options.exponent, 1.2), 0.6),
      edgeBoost: safeNumber(options.edgeBoost, 24),
      edgeExponent: Math.max(safeNumber(options.edgeExponent, 1.15), 0.6),
      bandBias: safeNumber(options.bandBias, 0.08),
      sideBoost: safeNumber(options.sideBoost, 18),
      sideExponent: Math.max(safeNumber(options.sideExponent, 1.08), 0.6),
      rangeBoost: safeNumber(options.rangeBoost, 0),
      anchorOffset: safeNumber(options.anchorOffset, 0),
    };
  }
  const count = sourceSlices.length;
  const totalHeight = Math.max(sourceSlices.reduce((sum, slice) => sum + Math.max(slice.height, 0), 0), 1);
  const dominantShare = sourceSlices.reduce((largest, slice) => Math.max(largest, slice.height / totalHeight), 0);
  const medianIndex = Math.floor(count / 2);
  const medianCenter = sourceSlices[medianIndex]?.center || sourceSlices[0].center;
  const stackCenter = (sourceSlices[0].top + sourceSlices[sourceSlices.length - 1].bottom) / 2;
  const countBoost = clamp((count - 3) * 0.042, 0, 0.24);
  const dominanceBoost = dominantShare >= 0.44 ? (dominantShare - 0.44) * 0.46 : 0;
  const denseDamping = count >= 8 ? 0.04 : 0;
  return {
    spread: clamp(Math.max(safeNumber(options.spread, 1.12), 1) + countBoost + dominanceBoost - denseDamping, 1.1, 1.38),
    exponent: clamp(safeNumber(options.exponent, 1.2) - Math.min(count, 8) * 0.01, 0.96, 1.28),
    edgeBoost: safeNumber(options.edgeBoost, 24) + Math.max(count - 4, 0) * 5 + dominanceBoost * 104,
    edgeExponent: clamp(safeNumber(options.edgeExponent, 1.15) - Math.min(count, 7) * 0.012, 0.92, 1.18),
    bandBias: clamp(safeNumber(options.bandBias, 0.08) + dominanceBoost * 0.08 - (count >= 7 ? 0.012 : 0), 0.04, 0.14),
    sideBoost: safeNumber(options.sideBoost, 18) + Math.max(count - 4, 0) * 4 + dominanceBoost * 84,
    sideExponent: clamp(safeNumber(options.sideExponent, 1.08) - Math.min(count, 7) * 0.012, 0.88, 1.08),
    rangeBoost: safeNumber(options.rangeBoost, 12) + Math.max(count - 4, 0) * 5 + dominanceBoost * 64,
    anchorOffset: safeNumber(options.anchorOffset, 0) + (medianCenter - stackCenter) * 0.08,
  };
}

function spreadSourceCenters(entries, anchor, options = {}) {
  if (!entries.length) return [];
  const spread = Math.max(safeNumber(options.spread, 1.12), 1);
  const exponent = Math.max(safeNumber(options.exponent, 1.2), 0.6);
  const edgeBoost = safeNumber(options.edgeBoost, 24);
  const edgeExponent = Math.max(safeNumber(options.edgeExponent, 1.15), 0.6);
  const bandBias = safeNumber(options.bandBias, 0.08);
  const sideBoost = safeNumber(options.sideBoost, 18);
  const sideExponent = Math.max(safeNumber(options.sideExponent, 1.08), 0.6);
  const maxDelta = entries.reduce((largest, entry) => Math.max(largest, Math.abs(safeNumber(entry.center, anchor) - anchor)), 0);
  if (maxDelta <= 0) {
    return entries.map((entry) => safeNumber(entry.center, anchor));
  }
  const sideRanks = new Map();
  const topSide = [];
  const bottomSide = [];
  entries.forEach((entry, index) => {
    const center = safeNumber(entry.center, anchor);
    if (center < anchor) topSide.push(index);
    if (center > anchor) bottomSide.push(index);
  });
  topSide.forEach((index, position) => {
    const norm = topSide.length <= 1 ? 1 : position / (topSide.length - 1);
    sideRanks.set(index, { direction: -1, norm });
  });
  bottomSide.forEach((index, position) => {
    const norm = bottomSide.length <= 1 ? 1 : position / (bottomSide.length - 1);
    sideRanks.set(index, { direction: 1, norm });
  });
  return entries.map((entry, index) => {
    const center = safeNumber(entry.center, anchor);
    const delta = center - anchor;
    const direction = delta === 0 ? 0 : Math.sign(delta);
    const norm = clamp(Math.abs(delta) / maxDelta, 0, 1);
    const spreadFactor = 1 + (spread - 1) * Math.pow(norm, exponent);
    const edgeOffset = direction * edgeBoost * Math.pow(norm, edgeExponent);
    const bandOffset = direction * safeNumber(entry.height, 0) * bandBias * norm;
    const sideRank = sideRanks.get(index);
    const sideOffset = sideRank ? sideRank.direction * sideBoost * Math.pow(sideRank.norm, sideExponent) : 0;
    return anchor + delta * spreadFactor + edgeOffset + bandOffset + sideOffset;
  });
}

function hornFlowPath(x0, y0Top, y0Bottom, x1, y1Top, y1Bottom, options = {}) {
  const dx = Math.max(x1 - x0, 1);
  const startBase = safeNumber(options.startCurveFactor, safeNumber(options.curveFactor, 0.36));
  const endBase = safeNumber(options.endCurveFactor, safeNumber(options.curveFactor, 0.38));
  const minStart = safeNumber(options.minStartCurveFactor, 0.14);
  const maxStart = safeNumber(options.maxStartCurveFactor, 0.36);
  const minEnd = safeNumber(options.minEndCurveFactor, 0.16);
  const maxEnd = safeNumber(options.maxEndCurveFactor, 0.38);
  const deltaScale = Math.max(safeNumber(options.deltaScale, 0.92), 0.1);
  const deltaInfluence = safeNumber(options.deltaInfluence, 0.065);
  const thicknessInfluence = safeNumber(options.thicknessInfluence, 0.055);
  const averageThickness = Math.max(((y0Bottom - y0Top) + (y1Bottom - y1Top)) / 2, 1);
  const adaptCurve = (delta, base, minFactor, maxFactor) => {
    const norm = clamp(Math.abs(delta) / (dx * deltaScale), 0, 1);
    const thicknessBoost = clamp(averageThickness / (dx * 0.92), 0, 1) * thicknessInfluence;
    return clamp(base - norm * deltaInfluence + thicknessBoost, minFactor, maxFactor);
  };
  const topStartCurve = adaptCurve(y1Top - y0Top, startBase, minStart, maxStart);
  const topEndCurve = adaptCurve(y1Top - y0Top, endBase, minEnd, maxEnd);
  const bottomStartCurve = adaptCurve(y1Bottom - y0Bottom, startBase, minStart, maxStart);
  const bottomEndCurve = adaptCurve(y1Bottom - y0Bottom, endBase, minEnd, maxEnd);
  let sourceHoldLength = clamp(
    safeNumber(options.sourceHoldLength, dx * safeNumber(options.sourceHoldFactor, 0.05)),
    safeNumber(options.minSourceHoldLength, 4),
    safeNumber(options.maxSourceHoldLength, 18)
  );
  let targetHoldLength = clamp(
    safeNumber(options.targetHoldLength, dx * safeNumber(options.targetHoldFactor, 0.04)),
    safeNumber(options.minTargetHoldLength, 3),
    safeNumber(options.maxTargetHoldLength, 14)
  );
  const adaptiveHoldEnabled = options.adaptiveHold !== false;
  if (adaptiveHoldEnabled) {
    const centerDelta = Math.abs((y1Top + y1Bottom) / 2 - (y0Top + y0Bottom) / 2);
    const edgeDelta = Math.max(Math.abs(y1Top - y0Top), Math.abs(y1Bottom - y0Bottom), centerDelta);
    const holdDeltaNorm = clamp(edgeDelta / Math.max(dx * safeNumber(options.holdDeltaScale, 0.52), 1), 0, 1);
    const sourceHoldReduction = clamp(safeNumber(options.sourceHoldDeltaReduction, 0.3), 0, 0.8);
    const targetHoldReduction = clamp(safeNumber(options.targetHoldDeltaReduction, 0.34), 0, 0.82);
    sourceHoldLength = Math.max(
      sourceHoldLength * (1 - holdDeltaNorm * sourceHoldReduction),
      safeNumber(options.minAdaptiveSourceHoldLength, 2)
    );
    targetHoldLength = Math.max(
      targetHoldLength * (1 - holdDeltaNorm * targetHoldReduction),
      safeNumber(options.minAdaptiveTargetHoldLength, 2)
    );
  }
  const availableCurveDx = Math.max(dx - 1, 1);
  if (sourceHoldLength + targetHoldLength > availableCurveDx) {
    const scale = availableCurveDx / Math.max(sourceHoldLength + targetHoldLength, 1);
    sourceHoldLength *= scale;
    targetHoldLength *= scale;
  }
  const sourceJoinX = x0 + sourceHoldLength;
  const targetJoinX = x1 - targetHoldLength;
  return [
    `M ${x0} ${y0Top}`,
    `L ${sourceJoinX} ${y0Top}`,
    smoothBoundaryCurve(sourceJoinX, targetJoinX, y0Top, y1Top, {
      startCurve: topStartCurve,
      endCurve: topEndCurve,
    }),
    `L ${x1} ${y1Top}`,
    `L ${x1} ${y1Bottom}`,
    `L ${targetJoinX} ${y1Bottom}`,
    smoothBoundaryCurve(targetJoinX, sourceJoinX, y1Bottom, y0Bottom, {
      startCurve: bottomEndCurve,
      endCurve: bottomStartCurve,
    }),
    `L ${x0} ${y0Bottom}`,
    "Z",
  ].join(" ");
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function safeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function rectsOverlap(a, b, padding = 0) {
  if (!a || !b) return false;
  return !(
    safeNumber(a.right) + padding <= safeNumber(b.left) ||
    safeNumber(b.right) + padding <= safeNumber(a.left) ||
    safeNumber(a.bottom) + padding <= safeNumber(b.top) ||
    safeNumber(b.bottom) + padding <= safeNumber(a.top)
  );
}

function compactFiscalLabel(label) {
  const raw = String(label || "").trim();
  if (!raw) return "";
  const match = /^FY(\d{4})\s+Q([1-4])$/i.exec(raw);
  if (!match) return raw;
  return `Q${match[2]} FY${match[1].slice(-2)}`;
}

function formatPeriodEndLabel(periodEnd) {
  const raw = String(periodEnd || "").trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) return raw;
  const months = ["Jan.", "Feb.", "Mar.", "Apr.", "May", "Jun.", "Jul.", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."];
  const month = months[Math.max(Number(match[2]) - 1, 0)] || raw;
  return `Ending ${month} ${Number(match[3])}, ${match[1]}`;
}

function stackValueSlices(items, startY, scale, options = {}) {
  const {
    minHeight = 0,
    targetBottom = null,
    valueKey = "valueBn",
    targetSnapTolerance = 4,
  } = options;
  let cursor = startY;
  const slices = items.map((item, index) => {
    const rawHeight = safeNumber(item?.[valueKey]) * scale;
    const height = Math.max(rawHeight, minHeight);
    const top = cursor;
    const bottom = top + height;
    cursor = bottom;
    return {
      item,
      index,
      rawHeight,
      height,
      top,
      bottom,
      center: top + height / 2,
    };
  });
  if (targetBottom !== null && slices.length) {
    const last = slices[slices.length - 1];
    if (Math.abs(targetBottom - last.bottom) <= Math.max(safeNumber(targetSnapTolerance, 4), 1)) {
      last.bottom = targetBottom;
      last.height = Math.max(targetBottom - last.top, 1);
      last.center = last.top + last.height / 2;
    }
  }
  return slices;
}

function fitSlicesToBand(slices, bandTop, bandBottom, options = {}) {
  if (!Array.isArray(slices) || !slices.length) return [];
  const totalBandHeight = Math.max(safeNumber(bandBottom) - safeNumber(bandTop), 1);
  const desiredGap = Math.max(safeNumber(options.gap, 0), 0);
  const maxGap = slices.length > 1 ? Math.max((totalBandHeight - 1) / Math.max(slices.length - 1, 1), 0) : 0;
  const gap = Math.min(desiredGap, maxGap);
  const availableHeight = Math.max(totalBandHeight - gap * Math.max(slices.length - 1, 0), 1);
  const preferredMinHeight = Math.max(safeNumber(options.minHeight, 0), 0);
  const minHeight = Math.min(preferredMinHeight, availableHeight / Math.max(slices.length, 1));
  const rawHeights = slices.map((slice) => Math.max(safeNumber(slice?.rawHeight, safeNumber(slice?.height, 0)), 0));
  const totalRawHeight = rawHeights.reduce((sum, height) => sum + height, 0);
  if (totalRawHeight <= 0) {
    const fallbackHeight = availableHeight / Math.max(slices.length, 1);
    let cursor = bandTop;
    return slices.map((slice, index) => {
      const top = cursor;
      const bottom = index === slices.length - 1 ? bandBottom : top + fallbackHeight;
      cursor = bottom + gap;
      return {
        ...slice,
        top,
        bottom,
        height: Math.max(bottom - top, 1),
        center: top + Math.max(bottom - top, 1) / 2,
      };
    });
  }
  const scaledHeights = rawHeights.map((height) => (height / totalRawHeight) * availableHeight);
  const locked = new Array(slices.length).fill(false);
  const resolvedHeights = new Array(slices.length).fill(0);
  let remainingHeight = availableHeight;
  let remainingRawHeight = totalRawHeight;
  let progress = true;
  while (progress) {
    progress = false;
    scaledHeights.forEach((height, index) => {
      if (locked[index]) return;
      const proportionalHeight = remainingRawHeight > 0 ? (rawHeights[index] / remainingRawHeight) * remainingHeight : 0;
      if (minHeight > 0 && proportionalHeight < minHeight) {
        locked[index] = true;
        resolvedHeights[index] = minHeight;
        remainingHeight -= minHeight;
        remainingRawHeight -= rawHeights[index];
        progress = true;
      }
    });
    if (remainingHeight <= 0 || remainingRawHeight <= 0) break;
  }
  slices.forEach((slice, index) => {
    if (!locked[index]) {
      resolvedHeights[index] = remainingRawHeight > 0 ? (rawHeights[index] / remainingRawHeight) * Math.max(remainingHeight, 0) : 0;
    }
  });
  const totalResolvedHeight = resolvedHeights.reduce((sum, height) => sum + height, 0);
  const heightAdjust = availableHeight - totalResolvedHeight;
  if (Math.abs(heightAdjust) > 0.01) {
    const lastIndex = resolvedHeights.length - 1;
    resolvedHeights[lastIndex] = Math.max(resolvedHeights[lastIndex] + heightAdjust, 1);
  }
  let cursor = bandTop;
  return slices.map((slice, index) => {
    const height = Math.max(resolvedHeights[index], 1);
    const top = cursor;
    const bottom = index === slices.length - 1 ? bandBottom : top + height;
    cursor = bottom + gap;
    return {
      ...slice,
      top,
      bottom,
      height: Math.max(bottom - top, 1),
      center: top + Math.max(bottom - top, 1) / 2,
    };
  });
}

function separateStackSlices(slices, gap = 0, minThickness = 2) {
  if (!Array.isArray(slices) || !slices.length || !(gap > 0)) {
    return (slices || []).map((slice) => ({
      ...slice,
      height: Math.max(safeNumber(slice.bottom) - safeNumber(slice.top), 1),
      center: (safeNumber(slice.top) + safeNumber(slice.bottom)) / 2,
    }));
  }
  const halfGap = gap / 2;
  return slices.map((slice, index) => {
    const top = safeNumber(slice.top);
    const bottom = safeNumber(slice.bottom);
    const insetTop = index === 0 ? 0 : halfGap;
    const insetBottom = index === slices.length - 1 ? 0 : halfGap;
    const requestedInset = insetTop + insetBottom;
    const availableInset = Math.max(bottom - top - minThickness, 0);
    const ratio = requestedInset > 0 ? Math.min(1, availableInset / requestedInset) : 1;
    const nextTop = top + insetTop * ratio;
    const nextBottom = bottom - insetBottom * ratio;
    return {
      ...slice,
      top: nextTop,
      bottom: Math.max(nextBottom, nextTop + minThickness),
      height: Math.max(nextBottom - nextTop, minThickness),
      center: nextTop + Math.max(nextBottom - nextTop, minThickness) / 2,
    };
  });
}

function resolveVerticalBoxes(entries, minY, maxY, gap = 24) {
  if (!entries.length) return [];
  const boxes = entries
    .map((entry, originalIndex) => {
      const height = Math.max(safeNumber(entry.height, 0), 1);
      const preferredTop =
        entry.top !== null && entry.top !== undefined ? safeNumber(entry.top, minY) : safeNumber(entry.center, minY + height / 2) - height / 2;
      return {
        ...entry,
        originalIndex,
        height,
        top: clamp(preferredTop, minY, maxY - height),
      };
    })
    .sort((left, right) => left.top - right.top);

  for (let index = 1; index < boxes.length; index += 1) {
    const previous = boxes[index - 1];
    const minimumTop = previous.top + previous.height + gap;
    if (boxes[index].top < minimumTop) {
      boxes[index].top = minimumTop;
    }
  }

  const overflow = boxes[boxes.length - 1].top + boxes[boxes.length - 1].height - maxY;
  if (overflow > 0) {
    boxes[boxes.length - 1].top -= overflow;
    for (let index = boxes.length - 2; index >= 0; index -= 1) {
      const next = boxes[index + 1];
      const maximumTop = next.top - gap - boxes[index].height;
      if (boxes[index].top > maximumTop) {
        boxes[index].top = maximumTop;
      }
    }
  }

  if (boxes[0].top < minY) {
    const shift = minY - boxes[0].top;
    boxes.forEach((box) => {
      box.top += shift;
    });
  }

  return boxes
    .sort((left, right) => left.originalIndex - right.originalIndex)
    .map((box) => ({
      ...box,
      bottom: box.top + box.height,
      center: box.top + box.height / 2,
    }));
}

function resolveVerticalBoxesVariableGap(entries, minY, maxY, gap = 24) {
  if (!entries.length) return [];
  const boxes = entries
    .map((entry, originalIndex) => {
      const height = Math.max(safeNumber(entry.height, 0), 1);
      const gapAbove = Math.max(safeNumber(entry.gapAbove, gap), gap);
      const preferredTop =
        entry.top !== null && entry.top !== undefined
          ? safeNumber(entry.top, minY + gapAbove)
          : safeNumber(entry.center, minY + gapAbove + height / 2) - height / 2;
      return {
        ...entry,
        originalIndex,
        height,
        gapAbove,
        top: clamp(preferredTop, minY + gapAbove, maxY - height),
      };
    })
    .sort((left, right) => left.top - right.top);

  for (let index = 1; index < boxes.length; index += 1) {
    const previous = boxes[index - 1];
    const current = boxes[index];
    const minimumTop = previous.top + previous.height + Math.max(gap, current.gapAbove);
    if (current.top < minimumTop) {
      current.top = minimumTop;
    }
  }

  const overflow = boxes[boxes.length - 1].top + boxes[boxes.length - 1].height - maxY;
  if (overflow > 0) {
    boxes[boxes.length - 1].top -= overflow;
    for (let index = boxes.length - 2; index >= 0; index -= 1) {
      const next = boxes[index + 1];
      const current = boxes[index];
      const maximumTop = next.top - Math.max(gap, next.gapAbove) - current.height;
      if (current.top > maximumTop) {
        current.top = maximumTop;
      }
    }
  }

  if (boxes[0].top < minY + boxes[0].gapAbove) {
    const shift = minY + boxes[0].gapAbove - boxes[0].top;
    boxes.forEach((box) => {
      box.top += shift;
    });
  }

  return boxes
    .sort((left, right) => left.originalIndex - right.originalIndex)
    .map((box) => ({
      ...box,
      bottom: box.top + box.height,
      center: box.top + box.height / 2,
    }));
}

const LOCKUP_LAYOUT_PROFILES = {
  "microsoft-productivity": {
    minHeight: 154,
    previewOffset: 42,
    labelCenterX: 204,
    lockupScale: 0.72,
    lockupX: 52,
    titleStartOffset: 96,
  },
  "microsoft-cloud": {
    minHeight: 150,
    previewOffset: 54,
    labelCenterX: 216,
    lockupScale: 0.64,
    lockupX: 110,
    titleStartOffset: 108,
  },
  "microsoft-personal": {
    minHeight: 162,
    previewOffset: 36,
    labelCenterX: 204,
    lockupScale: 0.72,
    lockupX: 96,
    titleStartOffset: 100,
  },
  "google-search-business": {
    detailLockupScale: 1.52,
    detailLockupX: 0,
    detailLockupYOffset: 26,
    detailHideTitle: true,
    detailHideSupport: true,
    detailValueX: 416,
    detailValueYOffset: 8,
    detailYoyYOffset: 36,
    detailMinHeight: 196,
  },
  "youtube-business": {
    detailLockupScale: 1.14,
    detailLockupX: 8,
    detailLockupYOffset: 22,
    detailHideTitle: true,
    detailHideSupport: true,
    detailValueX: 384,
    detailValueYOffset: 10,
    detailYoyYOffset: 36,
    detailMinHeight: 132,
  },
  "admob-business": {
    detailLockupScale: 1.1,
    detailLockupX: 8,
    detailLockupYOffset: 22,
    detailHideTitle: true,
    detailHideSupport: true,
    detailValueX: 384,
    detailValueYOffset: 10,
    detailYoyYOffset: 36,
    detailMinHeight: 138,
  },
  "google-play-business": {
    minHeight: 152,
    lockupScale: 1.22,
    lockupX: 52,
    lockupYOffset: 24,
    titleStartOffset: 94,
    hideTitle: true,
    noteX: 420,
    noteYOffset: 12,
    yoyYOffset: 44,
    supportX: 176,
    supportStartOffset: 96,
    supportAnchor: "start",
  },
  "google-cloud-business": {
    minHeight: 156,
    lockupScale: 1.2,
    lockupX: 44,
    lockupYOffset: 24,
    titleStartOffset: 98,
    hideTitle: true,
    noteX: 420,
    noteYOffset: 12,
    yoyYOffset: 44,
    supportX: 182,
    supportStartOffset: 94,
    supportAnchor: "start",
  },
  "amazon-online-business": {
    compactMinHeight: 168,
    compactClampMax: 182,
    compactLockupScale: 1.46,
    compactLockupX: 44,
    compactLockupYOffset: 18,
    compactLabelX: 26,
    compactLabelYOffset: 22,
    compactTitleFontSize: 24,
    compactTitleLineHeight: 27,
    compactSupportOffset: 10,
    compactSupportFontSize: 13,
    compactSupportLineHeight: 17,
    compactNoteX: 364,
    compactValueYOffset: 16,
    compactYoyYOffset: 34,
  },
  "wholefoods-business": {
    compactMinHeight: 128,
    compactClampMax: 138,
    compactLockupScale: 1.16,
    compactLockupX: 38,
    compactLockupYOffset: 16,
    compactLabelX: 24,
    compactLabelYOffset: 20,
    compactTitleFontSize: 20,
    compactTitleLineHeight: 24,
    compactSupportOffset: 10,
    compactSupportFontSize: 12,
    compactSupportLineHeight: 15,
    compactNoteX: 344,
    compactValueYOffset: 14,
    compactYoyYOffset: 32,
  },
  "amazon-ads-business": {
    compactMinHeight: 122,
    compactClampMax: 132,
    compactLockupScale: 1.06,
    compactLockupX: 18,
    compactLockupYOffset: 16,
    compactLabelX: 24,
    compactLabelYOffset: 20,
    compactTitleFontSize: 20,
    compactTitleLineHeight: 24,
    compactSupportOffset: 8,
    compactSupportFontSize: 12,
    compactSupportLineHeight: 15,
    compactNoteX: 344,
    compactValueYOffset: 14,
    compactYoyYOffset: 32,
  },
  "prime-audible-business": {
    compactMinHeight: 122,
    compactClampMax: 132,
    compactLockupScale: 1.06,
    compactLockupX: 18,
    compactLockupYOffset: 14,
    compactLabelX: 24,
    compactLabelYOffset: 18,
    compactTitleFontSize: 20,
    compactTitleLineHeight: 24,
    compactSupportOffset: 8,
    compactSupportFontSize: 12,
    compactSupportLineHeight: 15,
    compactNoteX: 344,
    compactValueYOffset: 14,
    compactYoyYOffset: 32,
  },
  "aws-business": {
    compactMinHeight: 144,
    compactClampMax: 156,
    compactLockupScale: 1.46,
    compactLockupX: 26,
    compactLockupYOffset: 14,
    compactLabelX: 24,
    compactLabelYOffset: 20,
    compactTitleFontSize: 21,
    compactTitleLineHeight: 24,
    compactSupportOffset: 8,
    compactSupportFontSize: 12,
    compactSupportLineHeight: 15,
    compactNoteX: 352,
    compactValueYOffset: 14,
    compactYoyYOffset: 32,
  },
};

function lockupLayoutProfile(lockupKey) {
  return LOCKUP_LAYOUT_PROFILES[lockupKey] || null;
}

function lockupHasWordmark(lockupKey) {
  if (!lockupKey) return false;
  return new Set([
    "amazon-online-business",
    "wholefoods-business",
    "amazon-ads-business",
    "prime-audible-business",
    "aws-business",
    "google-search-business",
    "youtube-business",
    "admob-business",
    "google-play-business",
    "google-cloud-business",
  ]).has(lockupKey);
}

function constantThicknessBridge(slice, targetCenter, minHeight, clampTop = -Infinity, clampBottom = Infinity) {
  const thickness = Math.max(safeNumber(slice?.height, 0), safeNumber(minHeight, 0));
  const sourceCenter = clamp(safeNumber(slice?.center, 0), clampTop + thickness / 2, clampBottom - thickness / 2);
  return {
    sourceTop: sourceCenter - thickness / 2,
    sourceBottom: sourceCenter + thickness / 2,
    targetTop: targetCenter - thickness / 2,
    targetHeight: thickness,
  };
}

function resolveConservedTargetBand(sourceBand, targetTop, targetBottom, options = {}) {
  const sourceHeight = Math.max(safeNumber(sourceBand?.bottom, 0) - safeNumber(sourceBand?.top, 0), 0);
  const resolvedTargetTop = safeNumber(targetTop, 0);
  const resolvedTargetBottom = Math.max(safeNumber(targetBottom, resolvedTargetTop), resolvedTargetTop);
  const targetHeight = Math.max(resolvedTargetBottom - resolvedTargetTop, 0);
  const bandHeight = sourceHeight > 0 ? Math.min(sourceHeight, targetHeight) : targetHeight;
  const align = options.align || "top";
  let bandTop = resolvedTargetTop;
  if (align === "bottom") {
    bandTop = resolvedTargetBottom - bandHeight;
  } else if (align === "center") {
    bandTop = resolvedTargetTop + (targetHeight - bandHeight) / 2;
  }
  return {
    top: bandTop,
    bottom: bandTop + bandHeight,
    height: bandHeight,
    center: bandTop + bandHeight / 2,
  };
}

function bridgeObstacleRect(sourceX, sourceTop, sourceBottom, targetX, targetTop, targetHeight, options = {}) {
  const padX = safeNumber(options.padX, 0);
  const padY = safeNumber(options.padY, 0);
  const targetWidth = safeNumber(options.targetWidth, 0);
  return {
    left: Math.min(sourceX, targetX) - padX,
    right: Math.max(sourceX, targetX + targetWidth) + padX,
    top: Math.min(sourceTop, targetTop) - padY,
    bottom: Math.max(sourceBottom, targetTop + targetHeight) + padY,
  };
}

function terminalNodeExtraX(sourceTop, sourceBottom, targetTop, targetHeight, options = {}) {
  const sourceCenter = (safeNumber(sourceTop, 0) + safeNumber(sourceBottom, 0)) / 2;
  const targetCenter = safeNumber(targetTop, 0) + safeNumber(targetHeight, 0) / 2;
  const factor = safeNumber(options.factor, 0.26);
  const sourceThickness = Math.max(safeNumber(sourceBottom, 0) - safeNumber(sourceTop, 0), 0);
  const branchThickness = Math.max(sourceThickness, safeNumber(targetHeight, 0));
  const baseRunway = safeNumber(options.base, Math.max(14, branchThickness * 0.2));
  const thicknessFactor = safeNumber(options.thicknessFactor, 0.14);
  const minValue = safeNumber(options.min, baseRunway);
  const maxValue = safeNumber(options.max, 64);
  return clamp(baseRunway + Math.abs(targetCenter - sourceCenter) * factor + branchThickness * thicknessFactor, minValue, maxValue);
}

function terminalCapPath(x, y, width, height, radius = 0, options = {}) {
  const rightOnly = options.rightOnly !== false;
  const maxRadius = Math.min(width / 2, height / 2);
  const rightRadius = clamp(safeNumber(options.rightRadius, radius), 0, maxRadius);
  const leftRadius = clamp(safeNumber(options.leftRadius, rightOnly ? 0 : rightRadius), 0, maxRadius);
  if (rightRadius <= 0 && leftRadius <= 0) {
    return [`M ${x} ${y}`, `H ${x + width}`, `V ${y + height}`, `H ${x}`, "Z"].join(" ");
  }
  if (!rightOnly) {
    return [
      `M ${x + leftRadius} ${y}`,
      `H ${x + width - rightRadius}`,
      `Q ${x + width} ${y} ${x + width} ${y + rightRadius}`,
      `V ${y + height - rightRadius}`,
      `Q ${x + width} ${y + height} ${x + width - rightRadius} ${y + height}`,
      `H ${x + leftRadius}`,
      `Q ${x} ${y + height} ${x} ${y + height - leftRadius}`,
      `V ${y + leftRadius}`,
      `Q ${x} ${y} ${x + leftRadius} ${y}`,
      "Z",
    ].join(" ");
  }
  return [
    `M ${x + leftRadius} ${y}`,
    `H ${x + width - rightRadius}`,
    `Q ${x + width} ${y} ${x + width} ${y + rightRadius}`,
    `V ${y + height - rightRadius}`,
    `Q ${x + width} ${y + height} ${x + width - rightRadius} ${y + height}`,
    `H ${x + leftRadius}`,
    leftRadius > 0 ? `Q ${x} ${y + height} ${x} ${y + height - leftRadius}` : `H ${x}`,
    leftRadius > 0 ? `V ${y + leftRadius}` : `V ${y}`,
    leftRadius > 0 ? `Q ${x} ${y} ${x + leftRadius} ${y}` : `H ${x + leftRadius}`,
    "Z",
  ].join(" ");
}

function sourceMetricLayout(item, options = {}) {
  const {
    density = item?.layoutDensity || "regular",
    compactMode = false,
    showQoq = false,
    profile = lockupLayoutProfile(item?.lockupKey),
  } = options;
  if (item?.microSource) {
    return {
      value: 14,
      yoy: 11,
      qoq: 11,
      topPadding: 5,
      bottomPadding: 9,
      gapValueToYoy: 3,
      gapYoyToQoq: 2,
    };
  }
  if (compactMode) {
    return {
      value: safeNumber(profile?.compactValueFontSize, density === "ultra" ? 14 : density === "dense" ? 15 : 17),
      yoy: safeNumber(profile?.compactYoyFontSize, density === "ultra" ? 11 : density === "dense" ? 12 : 13),
      qoq: safeNumber(profile?.compactQoqFontSize, density === "ultra" ? 11 : density === "dense" ? 12 : 13),
      topPadding: density === "ultra" ? 7 : 8,
      bottomPadding: density === "ultra" ? 11 : 13,
      gapValueToYoy: density === "ultra" ? 3 : 4,
      gapYoyToQoq: density === "ultra" ? 2 : 3,
    };
  }
  return {
    value: safeNumber(profile?.sourceValueFontSize, 18),
    yoy: safeNumber(profile?.sourceYoyFontSize, 13),
    qoq: safeNumber(profile?.sourceQoqFontSize, 13),
    topPadding: 10,
    bottomPadding: 16,
    gapValueToYoy: 5,
    gapYoyToQoq: 4,
  };
}

function sourceMetricBlockHeight(item, options = {}) {
  const layout = sourceMetricLayout(item, options);
  let height = layout.topPadding + layout.value + layout.bottomPadding;
  if (item?.yoyPct !== null && item?.yoyPct !== undefined) {
    height += layout.gapValueToYoy + layout.yoy;
  }
  if (options.showQoq && item?.qoqPct !== null && item?.qoqPct !== undefined) {
    height += (item?.yoyPct !== null && item?.yoyPct !== undefined ? layout.gapYoyToQoq : layout.gapValueToYoy) + layout.qoq;
  }
  const density = options.density || item?.layoutDensity || "regular";
  const compactMode = !!options.compactMode;
  const safetyPad = item?.microSource
    ? 6
    : compactMode
      ? density === "ultra"
        ? options.showQoq ? 18 : 14
        : options.showQoq ? 22 : 18
      : options.showQoq
        ? 28
        : 22;
  return height + safetyPad;
}

function estimateReplicaSourceBoxHeight(item, showQoq, compactMode = false) {
  const density = item.layoutDensity || (compactMode ? "compact" : "regular");
  const lineCount = item.displayLines?.length || wrapLines(item.name || "", 18).length || 1;
  const supportLineCount = item.supportLines?.length || 0;
  const profile = lockupLayoutProfile(item.lockupKey);
  const noteCount =
    1 +
    (item.yoyPct !== null && item.yoyPct !== undefined ? 1 : 0) +
    (showQoq && item.qoqPct !== null && item.qoqPct !== undefined ? 1 : 0) +
    (item.operatingMarginPct !== null && item.operatingMarginPct !== undefined ? 1 : 0);
  if (density === "ultra") {
    return clamp(34 + lineCount * 18 + supportLineCount * 15 + Math.max(noteCount - 1, 0) * 11, 54, 82);
  }
  if (density === "dense") {
    return clamp(40 + lineCount * 20 + supportLineCount * 15 + Math.max(noteCount - 1, 0) * 12, 64, 96);
  }
  let estimate = compactMode
    ? 48 + lineCount * 24 + supportLineCount * 19 + Math.max(noteCount - 1, 0) * 15
    : 92 + lineCount * 32 + supportLineCount * 20 + Math.max(noteCount - 1, 0) * 19;
  if (compactMode) {
    if (profile?.compactMinHeight) estimate = Math.max(estimate, profile.compactMinHeight);
    return clamp(estimate, safeNumber(profile?.compactClampMin, 88), safeNumber(profile?.compactClampMax, 138));
  }
  if (profile?.minHeight) estimate = Math.max(estimate, profile.minHeight);
  return clamp(estimate, 148, 208);
}

function sourceLabelScale(boxHeight, lineCount, supportLineCount, density = "regular") {
  const referenceHeight =
    density === "ultra" ? 64 : density === "dense" ? 84 : density === "compact" ? 114 : 164;
  const rawScale =
    boxHeight / referenceHeight - Math.max(0, lineCount - 2) * 0.05 - Math.max(0, supportLineCount - 1) * 0.03;
  return clamp(rawScale, density === "ultra" ? 0.84 : 0.88, 1.05);
}

function splitReplicaTreeNoteLines(note, density = "regular") {
  const raw = String(note || "").trim();
  if (!raw) return [];
  const structuredLines = structuredChartNoteLines(raw);
  if (structuredLines?.length) return structuredLines;
  const explicitLines = raw
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (explicitLines.length > 1) return explicitLines;
  const revenuePattern = /^(.*?(?:of revenue|of sales|margin))\s+((?:\([^)]+pp\)|[+-]?\d+(?:\.\d+)?pp)\s+(?:Y\/Y|Q\/Q))$/i;
  const revenueMatch = raw.match(revenuePattern);
  if (revenueMatch) {
    return [revenueMatch[1], revenueMatch[2]];
  }
  return wrapLines(raw, density === "dense" ? 18 : 22);
}

function replicaTreeBlockLayout(item, options = {}) {
  const density = options.density || "regular";
  const compact = density === "dense" || density === "ultra";
  const defaultMode = options.defaultMode || "negative-parentheses";
  const titleFontSize = safeNumber(options.titleFontSize, compact ? 18 : 20);
  const titleLineHeight = safeNumber(options.titleLineHeight, compact ? 20 : 22);
  const noteFontSize = safeNumber(options.noteFontSize, compact ? 12 : 13);
  const noteLineHeight = safeNumber(options.noteLineHeight, compact ? 15 : 16);
  const titleMaxChars = safeNumber(options.titleMaxChars, compact ? 18 : 20);
  const titleMaxWidth = safeNumber(options.titleMaxWidth, 0);
  const titleText = `${localizeChartPhrase(item?.name || "")} ${formatItemBillions(item, defaultMode)}`.trim();
  const titleLines = item?.titleLines?.length
    ? localizeChartLines(item.titleLines)
    : titleMaxWidth > 0
      ? resolveBranchTitleLines(item, defaultMode, titleFontSize, titleMaxWidth)
      : wrapLines(titleText, titleMaxChars);
  const noteMaxWidth = safeNumber(options.noteMaxWidth, titleMaxWidth);
  const noteLines = resolveTreeNoteLines(item, density, noteFontSize, noteMaxWidth);
  const topPadding = safeNumber(options.topPadding, compact ? 12 : 16);
  const noteGap = noteLines.length ? safeNumber(options.noteGap, compact ? 5 : 7) : 0;
  const fallbackMinHeight = safeNumber(options.fallbackMinHeight, compact ? 42 : 52);
  const totalHeight = Math.max(
    topPadding + titleLines.length * titleLineHeight + noteGap + noteLines.length * noteLineHeight,
    fallbackMinHeight
  );
  return {
    density,
    compact,
    titleLines,
    noteLines,
    titleFontSize,
    titleLineHeight,
    noteFontSize,
    noteLineHeight,
    topPadding,
    noteGap,
    totalHeight,
    minHeight: fallbackMinHeight,
  };
}

function estimateReplicaTreeBoxHeight(item, options = {}) {
  return replicaTreeBlockLayout(item, options).totalHeight;
}

function resolveReplicaBandBoxes(entries, minY, maxY, options = {}) {
  if (!entries.length) return [];
  const available = Math.max(maxY - minY, 1);
  let gap = safeNumber(options.gap, 24);
  const minGap = safeNumber(options.minGap, Math.min(gap, 6));
  const fallbackMinHeight = safeNumber(options.fallbackMinHeight, 30);
  let working = entries.map((entry) => ({
    ...entry,
    height: Math.max(safeNumber(entry.height, 0), 1),
    minHeight: Math.max(Math.min(safeNumber(entry.minHeight, fallbackMinHeight), safeNumber(entry.height, 0)), fallbackMinHeight),
  }));
  const compress = () => {
    if (!working.length) return;
    const totalHeight = working.reduce((sum, entry) => sum + entry.height, 0);
    if (working.length > 1 && totalHeight + gap * (working.length - 1) > available) {
      gap = Math.max(minGap, (available - totalHeight) / (working.length - 1));
    }
    const required = working.reduce((sum, entry) => sum + entry.height, 0) + gap * Math.max(working.length - 1, 0);
    const overflow = required - available;
    if (overflow <= 0) return;
    const shrinkable = working.reduce((sum, entry) => sum + Math.max(entry.height - entry.minHeight, 0), 0);
    if (shrinkable > 0) {
      const ratio = Math.min(1, overflow / shrinkable);
      working = working.map((entry) => ({
        ...entry,
        height: Math.max(entry.minHeight, entry.height - (entry.height - entry.minHeight) * ratio),
      }));
    }
    const remainingOverflow =
      working.reduce((sum, entry) => sum + entry.height, 0) + gap * Math.max(working.length - 1, 0) - available;
    if (remainingOverflow > 0) {
      const hardScale = Math.min(
        1,
        (available - gap * Math.max(working.length - 1, 0)) /
          Math.max(working.reduce((sum, entry) => sum + entry.height, 0), 1)
      );
      working = working.map((entry) => ({
        ...entry,
        height: Math.max(fallbackMinHeight, entry.height * hardScale),
      }));
    }
  };
  compress();
  compress();
  return resolveVerticalBoxes(working, minY, maxY, gap);
}

function resolveAnchoredBandBoxes(entries, minY, maxY, options = {}) {
  if (!entries.length) return [];
  const gap = safeNumber(options.gap, 24);
  const minGap = safeNumber(options.minGap, Math.min(gap, 8));
  const spreadExponent = Math.max(safeNumber(options.spreadExponent, 1.08), 0.7);
  const fallbackMinHeight = safeNumber(options.fallbackMinHeight, 24);
  const sortedEntries = entries
    .map((entry, originalIndex) => ({
      ...entry,
      originalIndex,
      height: Math.max(safeNumber(entry.height, 0), 1),
      center: safeNumber(entry.center, minY),
    }))
    .sort((left, right) => left.center - right.center || left.originalIndex - right.originalIndex);
  const totalHeight = sortedEntries.reduce((sum, entry) => sum + entry.height, 0);
  const minimumSpan = totalHeight + Math.max(sortedEntries.length - 1, 0) * minGap;
  const firstHeight = sortedEntries[0]?.height || 0;
  const lastHeight = sortedEntries[sortedEntries.length - 1]?.height || 0;
  const bottomAnchorCenter = clamp(
    safeNumber(options.bottomAnchorCenter, maxY - lastHeight / 2),
    minY + minimumSpan - lastHeight / 2,
    maxY - lastHeight / 2
  );
  const topAnchorCenterFloor = minY + firstHeight / 2;
  const topAnchorCenterCeiling = Math.max(bottomAnchorCenter - minimumSpan + firstHeight / 2, topAnchorCenterFloor);
  const preferredTopCenter = Math.max(
    safeNumber(options.topAnchorCenter, sortedEntries[0]?.center ?? topAnchorCenterFloor),
    topAnchorCenterFloor
  );
  const topAnchorCenter = clamp(preferredTopCenter, topAnchorCenterFloor, topAnchorCenterCeiling);
  const centerRange = Math.max(bottomAnchorCenter - topAnchorCenter, 0);
  const anchoredEntries = sortedEntries.map((entry, index) => {
    const ratio = sortedEntries.length <= 1 ? 1 : index / Math.max(sortedEntries.length - 1, 1);
    const easedRatio = Math.pow(ratio, spreadExponent);
    return {
      ...entry,
      center: topAnchorCenter + centerRange * easedRatio,
      minHeight: Math.max(Math.min(safeNumber(entry.minHeight, fallbackMinHeight), entry.height), fallbackMinHeight),
    };
  });
  const resolved = resolveReplicaBandBoxes(anchoredEntries, minY, maxY, {
    gap,
    minGap,
    fallbackMinHeight,
  });
  const resolvedLast = resolved[resolved.length - 1];
  if (resolvedLast) {
    const desiredBottom = bottomAnchorCenter + resolvedLast.height / 2;
    const actualBottom = resolvedLast.bottom;
    const shift = clamp(desiredBottom - actualBottom, minY - resolved[0].top, maxY - actualBottom);
    if (Math.abs(shift) > 0.01) {
      return resolved
        .map((entry) => ({
          ...entry,
          top: entry.top + shift,
          bottom: entry.bottom + shift,
          center: entry.center + shift,
        }))
        .sort((left, right) => left.originalIndex - right.originalIndex);
    }
  }
  return resolved.sort((left, right) => left.originalIndex - right.originalIndex);
}

function logoFrameMetrics(logoKey, context = "corporate") {
  const asset = getLogoAsset(logoKey);
  const normalizedKey = normalizeLogoKey(logoKey);
  if (!asset) {
    return context === "corporate"
      ? { width: 116, height: 116, padding: 14, radius: 30 }
      : { width: 84, height: 84, padding: 10, radius: 22 };
  }
  const ratio = safeNumber(asset.width, 64) / Math.max(safeNumber(asset.height, 64), 1);
  if (context === "corporate") {
    if (normalizedKey === "jpmorgan") return { width: 248, height: 44, paddingX: 0, paddingY: 0, radius: 0, showPlate: false };
    if (normalizedKey === "exxon") return { width: 208, height: 48, paddingX: 0, paddingY: 0, radius: 0, showPlate: false };
    if (normalizedKey === "berkshire") return { width: 324, height: 30, paddingX: 0, paddingY: 0, radius: 0, showPlate: false };
    if (ratio > 5.2) return { width: 244, height: 54, paddingX: 4, paddingY: 3, radius: 0, showPlate: false };
    if (ratio > 3.2) return { width: 212, height: 60, paddingX: 6, paddingY: 4, radius: 0, showPlate: false };
    if (ratio > 1.7) return { width: 172, height: 84, paddingX: 6, paddingY: 6, radius: 0, showPlate: false };
    if (ratio < 0.75) return { width: 112, height: 126, paddingX: 6, paddingY: 4, radius: 0, showPlate: false };
    return { width: 110, height: 110, paddingX: 6, paddingY: 6, radius: 0, showPlate: false };
  }
  if (normalizedKey === "berkshire") return { width: 182, height: 18, paddingX: 0, paddingY: 0, radius: 0, showPlate: false };
  if (ratio > 5.2) return { width: 162, height: 42, paddingX: 8, paddingY: 4, radius: 14 };
  if (ratio > 3.2) return { width: 144, height: 46, padding: 12, radius: 16 };
  if (ratio > 1.7) return { width: 118, height: 60, padding: 10, radius: 18 };
  if (ratio < 0.75) return { width: 72, height: 92, padding: 10, radius: 18 };
  return { width: 84, height: 84, padding: 10, radius: 22 };
}

function renderImageLogo(asset, x, y, options = {}) {
  const {
    scale = 1,
    boxWidth = 116,
    boxHeight = 116,
    padding = 12,
    paddingX = padding,
    paddingY = padding,
    radius = 28,
    showPlate = true,
    borderColor = "#E5E7EB",
    plateFill = "#FFFFFF",
  } = options;
  const imageWidth = Math.max(boxWidth - paddingX * 2, 24);
  const imageHeight = Math.max(boxHeight - paddingY * 2, 12);
  const plateMarkup = showPlate
    ? `<rect x="0" y="0" width="${boxWidth}" height="${boxHeight}" rx="${radius}" fill="${plateFill}" stroke="${borderColor}" stroke-width="2.5"></rect>`
    : "";
  return `
    <g transform="translate(${x}, ${y}) scale(${scale})">
      ${plateMarkup}
      <image x="${paddingX}" y="${paddingY}" width="${imageWidth}" height="${imageHeight}" href="${asset.dataUrl}" preserveAspectRatio="xMidYMid meet"></image>
    </g>
  `;
}

function renderCorporateLogo(logoKey, x, y, options = {}) {
  const { scale = 1 } = options;
  const effectiveScale = scale * CORPORATE_LOGO_LINEAR_SCALE_MULTIPLIER;
  if (normalizeLogoKey(logoKey) === "jpmorgan") {
    return `
      <g transform="translate(${x}, ${y}) scale(${effectiveScale})">
        <text x="0" y="34" font-family="Aptos, Segoe UI, Arial, Helvetica, sans-serif" font-size="34" font-weight="700" letter-spacing="-0.4" fill="#1F3C88">JPMorganChase</text>
      </g>
    `;
  }
  if (normalizeLogoKey(logoKey) === "exxon") {
    return `
      <g transform="translate(${x}, ${y}) scale(${effectiveScale})">
        <text x="0" y="36" font-family="Aptos, Segoe UI, Arial, Helvetica, sans-serif" font-size="36" font-weight="800" letter-spacing="-1.1" fill="#E51636">ExxonMobil</text>
      </g>
    `;
  }
  if (normalizeLogoKey(logoKey) === "eli-lilly") {
    return `
      <g transform="translate(${x}, ${y}) scale(${effectiveScale})">
        <text x="0" y="52" font-family="Times New Roman, Georgia, serif" font-style="italic" font-size="56" font-weight="700" fill="#111111">Lilly</text>
      </g>
    `;
  }
  if (logoKey === "microsoft-corporate") {
    return `
      <g transform="translate(${x}, ${y}) scale(${effectiveScale})">
        <rect x="0" y="0" width="54" height="54" fill="#F25022"></rect>
        <rect x="62" y="0" width="54" height="54" fill="#7FBA00"></rect>
        <rect x="0" y="62" width="54" height="54" fill="#00A4EF"></rect>
        <rect x="62" y="62" width="54" height="54" fill="#FFB900"></rect>
      </g>
    `;
  }
  const asset = getLogoAsset(logoKey);
  if (asset) {
    const company = getCompany(normalizeLogoKey(logoKey));
    const primary = company?.brand?.primary || "#CBD5E1";
    const metrics = logoFrameMetrics(logoKey, "corporate");
    return renderImageLogo(asset, x, y, {
      scale: effectiveScale,
      boxWidth: metrics.width,
      boxHeight: metrics.height,
      padding: metrics.padding,
      paddingX: metrics.paddingX,
      paddingY: metrics.paddingY,
      radius: metrics.radius,
      borderColor: rgba(primary, 0.18),
      plateFill: "#FFFFFF",
      showPlate: false,
    });
  }
  const company = getCompany(logoKey);
  const initial = escapeHtml((company?.ticker || logoKey || "?").slice(0, 1).toUpperCase());
  const primary = company?.brand?.primary || "#0F172A";
  const secondary = company?.brand?.secondary || company?.brand?.accent || primary;
  return `
    <g transform="translate(${x}, ${y}) scale(${effectiveScale})">
      <circle cx="58" cy="58" r="54" fill="#FFFFFF" opacity="0.98"></circle>
      <circle cx="58" cy="58" r="50" fill="${rgba(primary, 0.08)}" stroke="${rgba(primary, 0.18)}" stroke-width="4"></circle>
      <circle cx="58" cy="58" r="24" fill="${rgba(secondary, 0.16)}"></circle>
      <text x="58" y="74" text-anchor="middle" font-size="52" font-weight="800" fill="${primary}">${initial}</text>
    </g>
  `;
}

function currentEditorSessionKey() {
  const companyId = state.selectedCompanyId || "";
  const quarterKey = state.selectedQuarter || "";
  const mode = currentChartViewMode();
  return `${companyId}::${quarterKey}::${mode}`;
}

function currentEditorOverrides() {
  return state.editor.overridesBySession[currentEditorSessionKey()] || {};
}

function clearCurrentEditorOverrides() {
  const key = currentEditorSessionKey();
  delete state.editor.overridesBySession[key];
}

function setCurrentEditorNodeOverride(nodeId, override) {
  const key = currentEditorSessionKey();
  const current = { ...(state.editor.overridesBySession[key] || {}) };
  current[nodeId] = {
    dx: safeNumber(override?.dx, 0),
    dy: safeNumber(override?.dy, 0),
  };
  state.editor.overridesBySession[key] = current;
}

function requestEditorRerender() {
  if (state.editor.rerenderFrame && typeof cancelAnimationFrame === "function") {
    cancelAnimationFrame(state.editor.rerenderFrame);
  }
  const execute = () => {
    state.editor.rerenderFrame = 0;
    renderCurrent();
  };
  if (typeof requestAnimationFrame === "function") {
    state.editor.rerenderFrame = requestAnimationFrame(execute);
  } else {
    execute();
  }
}

function isInteractiveSankeyEditable(snapshot = state.currentSnapshot) {
  return currentChartViewMode() === "sankey" && (snapshot?.mode === "pixel-replica" || snapshot?.mode === "replica-template");
}

function syncEditModeUi(snapshot = state.currentSnapshot) {
  const editable = isInteractiveSankeyEditable(snapshot);
  const showEditorControls = currentChartViewMode() !== "bars";
  const hasOverrides = Object.keys(currentEditorOverrides()).length > 0;
  if (refs.chartEditGroup) {
    refs.chartEditGroup.hidden = !showEditorControls;
  }
  if (refs.editImageBtn) {
    refs.editImageBtn.disabled = !editable;
    refs.editImageBtn.textContent = state.editor.enabled && editable ? "完成编辑" : "编辑图片";
    refs.editImageBtn.classList.toggle("is-active", !!(state.editor.enabled && editable));
  }
  if (refs.resetImageBtn) {
    refs.resetImageBtn.disabled = !(editable && hasOverrides);
  }
  refs.chartOutput?.classList.toggle("is-editing", !!(editable && state.editor.enabled));
  const svg = refs.chartOutput?.querySelector("svg");
  if (svg) {
    svg.classList.toggle("is-dragging", !!state.editor.dragging);
  }
}

function svgPointFromClient(clientX, clientY) {
  const svg = refs.chartOutput?.querySelector("svg");
  if (!svg || typeof svg.createSVGPoint !== "function") return null;
  const point = svg.createSVGPoint();
  point.x = clientX;
  point.y = clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm || typeof ctm.inverse !== "function") return null;
  return point.matrixTransform(ctm.inverse());
}

function editorCanvasBounds(svg) {
  if (!svg) return null;
  const left = safeNumber(svg.dataset?.editorBoundsLeft, 0);
  const top = safeNumber(svg.dataset?.editorBoundsTop, 0);
  const right = safeNumber(svg.dataset?.editorBoundsRight, NaN);
  const bottom = safeNumber(svg.dataset?.editorBoundsBottom, NaN);
  if (Number.isFinite(right) && Number.isFinite(bottom)) {
    return { left, top, right, bottom };
  }
  const viewBoxParts = String(svg.getAttribute("viewBox") || "")
    .trim()
    .split(/\s+/)
    .map((value) => Number(value));
  if (viewBoxParts.length === 4 && viewBoxParts.every((value) => Number.isFinite(value))) {
    return {
      left: viewBoxParts[0],
      top: viewBoxParts[1],
      right: viewBoxParts[0] + viewBoxParts[2],
      bottom: viewBoxParts[1] + viewBoxParts[3],
    };
  }
  return null;
}

function bindInteractiveEditor(snapshot = state.currentSnapshot) {
  syncEditModeUi(snapshot);
  const svg = refs.chartOutput?.querySelector("svg");
  if (!svg || !isInteractiveSankeyEditable(snapshot) || !state.editor.enabled) return;
  svg.querySelectorAll("[data-edit-hit='true']").forEach((node) => {
    node.addEventListener("pointerdown", (event) => {
      const nodeId = node.getAttribute("data-edit-node-id");
      const origin = svgPointFromClient(event.clientX, event.clientY);
      const visibleNode = node.previousElementSibling;
      const frameX = safeNumber(visibleNode?.getAttribute?.("x"), NaN);
      const frameY = safeNumber(visibleNode?.getAttribute?.("y"), NaN);
      const frameWidth = safeNumber(visibleNode?.getAttribute?.("width"), NaN);
      const frameHeight = safeNumber(visibleNode?.getAttribute?.("height"), NaN);
      const bounds = editorCanvasBounds(svg);
      if (!nodeId || !origin) return;
      event.preventDefault();
      const existing = currentEditorOverrides()[nodeId] || { dx: 0, dy: 0 };
      const baseFrameX = Number.isFinite(frameX) ? frameX - safeNumber(existing.dx, 0) : NaN;
      const baseFrameY = Number.isFinite(frameY) ? frameY - safeNumber(existing.dy, 0) : NaN;
      state.editor.selectedNodeId = nodeId;
      state.editor.dragging = {
        nodeId,
        pointerId: event.pointerId,
        startX: origin.x,
        startY: origin.y,
        baseDx: safeNumber(existing.dx, 0),
        baseDy: safeNumber(existing.dy, 0),
        minDx:
          bounds && Number.isFinite(baseFrameX) && Number.isFinite(frameWidth)
            ? bounds.left - baseFrameX
            : -Infinity,
        maxDx:
          bounds && Number.isFinite(baseFrameX) && Number.isFinite(frameWidth)
            ? bounds.right - baseFrameX - frameWidth
            : Infinity,
        minDy:
          bounds && Number.isFinite(baseFrameY) && Number.isFinite(frameHeight)
            ? bounds.top - baseFrameY
            : -Infinity,
        maxDy:
          bounds && Number.isFinite(baseFrameY) && Number.isFinite(frameHeight)
            ? bounds.bottom - baseFrameY - frameHeight
            : Infinity,
      };
      requestEditorRerender();
    });
  });
}

function corporateLogoMetrics(logoKey) {
  if (logoKey === "microsoft-corporate") return { width: 116, height: 116 };
  if (getLogoAsset(logoKey)) {
    const metrics = logoFrameMetrics(logoKey, "corporate");
    return { width: metrics.width, height: metrics.height };
  }
  return { width: 116, height: 116 };
}

function corporateLogoVisibleMetrics(logoKey) {
  if (logoKey === "microsoft-corporate") return { width: 116, height: 116 };
  if (getLogoAsset(logoKey)) {
    const metrics = logoFrameMetrics(logoKey, "corporate");
    const paddingX = safeNumber(metrics.paddingX, safeNumber(metrics.padding, 0));
    const paddingY = safeNumber(metrics.paddingY, safeNumber(metrics.padding, 0));
    return {
      width: Math.max(safeNumber(metrics.width, 116) - paddingX * 2, 24),
      height: Math.max(safeNumber(metrics.height, 116) - paddingY * 2, 12),
    };
  }
  return { width: 116, height: 116 };
}

function corporateLogoBaseScale(logoKey, options = {}) {
  const normalizedKey = normalizeLogoKey(logoKey);
  const config = options.config || {};
  const visualScaleOverride = safeNumber(
    CORPORATE_LOGO_SCALE_OVERRIDES[logoKey] ?? CORPORATE_LOGO_SCALE_OVERRIDES[normalizedKey],
    1
  );
  const explicitScale =
    config.baseScales?.[logoKey] ??
    config.baseScales?.[normalizedKey] ??
    CORPORATE_LOGO_BASE_SCALE_OVERRIDES[logoKey] ??
    CORPORATE_LOGO_BASE_SCALE_OVERRIDES[normalizedKey];
  if (explicitScale !== null && explicitScale !== undefined) {
    return safeNumber(explicitScale, 1) * visualScaleOverride;
  }
  if (options.hero) {
    return safeNumber(config.heroScale, 1.04) * visualScaleOverride;
  }
  if (!getLogoAsset(logoKey)) {
    return safeNumber(config.fallbackScale, 0.92) * visualScaleOverride;
  }
  const metrics = logoFrameMetrics(logoKey, "corporate");
  const ratio = safeNumber(metrics.width, 116) / Math.max(safeNumber(metrics.height, 116), 1);
  const bands = [...(config.ratioScaleBands || BASE_CORPORATE_LOGO_TOKENS.ratioScaleBands)].sort(
    (left, right) => safeNumber(right.min, 0) - safeNumber(left.min, 0)
  );
  const matchedBand = bands.find((band) => ratio >= safeNumber(band.min, 0));
  return safeNumber(matchedBand?.scale, 1.04) * visualScaleOverride;
}

function prototypeBandConfig(templateTokens, bandKey, count = 0) {
  const config = templateTokens?.bands?.[bandKey] || {};
  if (bandKey !== "opex") return config;
  const denseThreshold = safeNumber(config.denseThreshold, BASE_RIGHT_BAND_TOKENS.opex.denseThreshold);
  const densityKey = count >= denseThreshold ? "dense" : "regular";
  return {
    ...(config.common || {}),
    ...(config[densityKey] || {}),
    densityKey,
  };
}

function renderReplicaFooter(snapshot) {
  return "";
}

function renderRegionMapLockup(lockupKey, x, y, scale = 1) {
  const outlines = {
    "region-ucan": `<path d="M17 18 L24 12 L33 10 L40 14 L39 19 L33 22 L30 28 L21 31 L15 28 L11 21 Z" fill="#6B7280"></path>`,
    "region-emea": `<path d="M24 10 L31 12 L35 17 L31 20 L27 18 L24 22 L27 30 L31 39 L27 45 L22 39 L20 29 L16 22 L18 15 Z" fill="#6B7280"></path>`,
    "region-latam": `<path d="M28 17 L33 23 L31 29 L27 35 L29 43 L25 50 L21 46 L22 37 L18 30 L21 22 Z" fill="#6B7280"></path>`,
    "region-apac": `<path d="M18 17 L25 12 L34 14 L40 19 L36 24 L31 24 L27 27 L23 24 L18 24 L15 20 Z M39 34 L43 39 L40 44 L35 41 Z" fill="#6B7280"></path>`,
  };
  const regionShape = outlines[lockupKey];
  if (!regionShape) return "";
  return `
    <g transform="translate(${x}, ${y}) scale(${scale})">
      <circle cx="30" cy="30" r="24" fill="none" stroke="#D1D5DB" stroke-width="2"></circle>
      <ellipse cx="30" cy="30" rx="18" ry="24" fill="none" stroke="#E5E7EB" stroke-width="1.4"></ellipse>
      <path d="M8 30 H52" fill="none" stroke="#E5E7EB" stroke-width="1.2"></path>
      <path d="M13 20 H47" fill="none" stroke="#ECEFF3" stroke-width="1"></path>
      <path d="M13 40 H47" fill="none" stroke="#ECEFF3" stroke-width="1"></path>
      ${regionShape}
    </g>
  `;
}

function renderBusinessLockup(lockupKey, x, y, options = {}) {
  const { scale = 1 } = options;
  if (lockupKey === "microsoft-productivity") {
    return `
      <g transform="translate(${x}, ${y}) scale(${scale})">
        <rect x="0" y="0" width="20" height="20" fill="#F25022"></rect>
        <rect x="23" y="0" width="20" height="20" fill="#7FBA00"></rect>
        <rect x="0" y="23" width="20" height="20" fill="#00A4EF"></rect>
        <rect x="23" y="23" width="20" height="20" fill="#FFB900"></rect>
        <text x="54" y="15" font-size="18" font-weight="700" fill="#73767E">Microsoft 365</text>
        <text x="54" y="38" font-size="20" font-weight="800" fill="#2563EB">LinkedIn</text>
      </g>
    `;
  }

  if (lockupKey === "microsoft-cloud") {
    return `
      <g transform="translate(${x}, ${y}) scale(${scale})">
        <path d="M30 0 L60 92 L45 92 L37 67 L16 67 L4 92 L0 92 L26 0 Z" fill="#2B63C6"></path>
        <path d="M42 0 L96 0 L54 92 L40 92 Z" fill="#2DB3F1" opacity="0.92"></path>
        <path d="M42 45 L49 67 L35 67 Z" fill="#FFFFFF" opacity="0.9"></path>
      </g>
    `;
  }

  if (lockupKey === "microsoft-personal") {
    return `
      <g transform="translate(${x}, ${y}) scale(${scale})">
        <rect x="0" y="12" width="32" height="32" fill="#1C9CDD" transform="skewY(-8)"></rect>
        <rect x="36" y="7" width="32" height="37" fill="#1C9CDD" transform="skewY(-8)"></rect>
        <circle cx="114" cy="20" r="14" fill="#111111"></circle>
        <path d="M102 10 L107 7 L114 14 L121 7 L126 10 L119 18 L126 25 L121 29 L114 21 L107 29 L102 25 L109 18 Z" fill="#FFFFFF"></path>
        <text x="78" y="60" font-size="22" font-weight="500" fill="#111111">XBOX</text>
      </g>
    `;
  }

  if (lockupKey === "google-search-business") {
    return `
      <g transform="translate(${x}, ${y}) scale(${scale})">
        <text x="0" y="44" font-size="46" font-weight="700" font-family="Aptos, Segoe UI, Arial, sans-serif">
          <tspan fill="#4285F4">G</tspan><tspan fill="#DB4437">o</tspan><tspan fill="#F4B400">o</tspan><tspan fill="#4285F4">g</tspan><tspan fill="#0F9D58">l</tspan><tspan fill="#DB4437">e</tspan>
        </text>
        <text x="0" y="78" font-size="22" font-weight="700" fill="#3974D9">Search advertising</text>
      </g>
    `;
  }

  if (lockupKey === "youtube-business") {
    return `
      <g transform="translate(${x}, ${y}) scale(${scale})">
        <rect x="0" y="8" width="62" height="42" rx="11" fill="#FF0033"></rect>
        <path d="M25 19 L43 29 L25 39 Z" fill="#FFFFFF"></path>
        <text x="76" y="41" font-size="32" font-weight="700" fill="#111111">YouTube</text>
      </g>
    `;
  }

  if (lockupKey === "admob-business") {
    return `
      <g transform="translate(${x}, ${y}) scale(${scale})">
        <path d="M8 35 C8 18, 18 8, 32 8 C44 8, 52 16, 52 28 C52 40, 45 50, 34 50 C22 50, 14 42, 14 30" fill="none" stroke="#EA4335" stroke-width="8" stroke-linecap="round"></path>
        <path d="M34 50 C48 50, 58 39, 58 26" fill="none" stroke="#4285F4" stroke-width="8" stroke-linecap="round"></path>
        <text x="76" y="34" font-size="28" font-weight="700" fill="#5F6368">Google AdMob</text>
        <text x="76" y="60" font-size="16" font-weight="500" fill="#6B7280">+ AdSense &amp; Google Ad Manager</text>
      </g>
    `;
  }

  if (lockupKey === "google-play-business") {
    return `
      <g transform="translate(${x}, ${y}) scale(${scale})">
        <path d="M0 0 L0 52 L30 26 Z" fill="#00C6FF"></path>
        <path d="M0 0 L34 20 L22 31 Z" fill="#32A853"></path>
        <path d="M22 31 L34 20 L54 26 L22 31 Z" fill="#FBBC04"></path>
        <path d="M0 52 L22 31 L54 26 L34 40 Z" fill="#EA4335"></path>
        <text x="72" y="34" font-size="27" font-weight="700" fill="#5F6368">Google Play</text>
      </g>
    `;
  }

  if (lockupKey === "google-cloud-business") {
    return `
      <g transform="translate(${x}, ${y}) scale(${scale})">
        <path d="M17 37 C17 25, 25 17, 36 17 C44 17, 50 21, 54 28 C57 27, 60 26, 64 26 C74 26, 82 34, 82 44 C82 54, 74 62, 64 62 L24 62 C13 62, 4 53, 4 42 C4 33, 10 25, 18 22" fill="none" stroke="#4285F4" stroke-width="8" stroke-linecap="round"></path>
        <path d="M18 22 C22 16, 29 12, 36 12" fill="none" stroke="#EA4335" stroke-width="8" stroke-linecap="round"></path>
        <path d="M54 28 C57 22, 62 18, 68 18" fill="none" stroke="#FBBC04" stroke-width="8" stroke-linecap="round"></path>
        <path d="M64 62 L24 62" fill="none" stroke="#34A853" stroke-width="8" stroke-linecap="round"></path>
        <text x="94" y="43" font-size="28" font-weight="700" fill="#5F6368">Google Cloud</text>
      </g>
    `;
  }

  if (lockupKey === "google-ad-stack-business") {
    return `
      <g transform="translate(${x}, ${y}) scale(${scale})">
        <text x="0" y="26" font-size="22" font-weight="700" fill="#4285F4">Google Ads</text>
        <text x="0" y="50" font-size="22" font-weight="700" fill="#FF0033">YouTube</text>
        <text x="102" y="50" font-size="22" font-weight="700" fill="#5F6368">AdMob</text>
      </g>
    `;
  }

  if (lockupKey === "amazon-online-business") {
    return `
      <g transform="translate(${x}, ${y}) scale(${scale})">
        <text x="0" y="34" font-size="29" font-weight="700" fill="#111111">amazon.com</text>
        <path d="M14 42 C28 52, 58 52, 82 40" fill="none" stroke="#FF9900" stroke-width="4" stroke-linecap="round"></path>
        <path d="M78 36 L86 39 L80 45" fill="none" stroke="#FF9900" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></path>
      </g>
    `;
  }

  if (lockupKey === "wholefoods-business") {
    return `
      <g transform="translate(${x}, ${y}) scale(${scale})">
        <text x="0" y="26" font-size="24" font-weight="800" fill="#59A23A">fresh</text>
        <text x="72" y="26" font-size="18" font-weight="700" fill="#1F4027">WHOLE</text>
        <text x="72" y="46" font-size="18" font-weight="700" fill="#1F4027">FOODS</text>
      </g>
    `;
  }

  if (lockupKey === "amazon-ads-business") {
    return `
      <g transform="translate(${x}, ${y}) scale(${scale})">
        <text x="0" y="26" font-size="22" font-weight="700" fill="#111111">amazon ads</text>
        <path d="M12 33 C26 42, 46 42, 60 32" fill="none" stroke="#FF9900" stroke-width="3.6" stroke-linecap="round"></path>
        <text x="78" y="30" font-size="23" font-weight="800" fill="#7C3AED">twitch</text>
      </g>
    `;
  }

  if (lockupKey === "prime-audible-business") {
    return `
      <g transform="translate(${x}, ${y}) scale(${scale})">
        <text x="0" y="24" font-size="24" font-weight="700" fill="#1F77D0">prime</text>
        <path d="M8 30 C18 38, 34 38, 46 28" fill="none" stroke="#1F77D0" stroke-width="3.5" stroke-linecap="round"></path>
        <text x="62" y="24" font-size="22" font-weight="700" fill="#111111">audible</text>
        <path d="M142 12 C148 16, 148 32, 142 36" fill="none" stroke="#F59E0B" stroke-width="3.5" stroke-linecap="round"></path>
        <path d="M150 8 C158 15, 158 33, 150 40" fill="none" stroke="#F59E0B" stroke-width="3.5" stroke-linecap="round"></path>
      </g>
    `;
  }

  if (lockupKey === "aws-business") {
    return `
      <g transform="translate(${x}, ${y}) scale(${scale})">
        <text x="0" y="28" font-size="34" font-weight="700" fill="#111111">aws</text>
        <path d="M10 36 C26 47, 50 47, 70 34" fill="none" stroke="#FF9900" stroke-width="4" stroke-linecap="round"></path>
        <path d="M66 30 L74 34 L68 40" fill="none" stroke="#FF9900" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></path>
      </g>
    `;
  }

  if (lockupKey === "meta-apps-business") {
    return `
      <g transform="translate(${x}, ${y}) scale(${scale})">
        <circle cx="16" cy="18" r="13" fill="#1877F2"></circle>
        <text x="16" y="24" text-anchor="middle" font-size="18" font-weight="800" fill="#FFFFFF">f</text>
        <circle cx="48" cy="18" r="13" fill="#E1306C"></circle>
        <circle cx="48" cy="18" r="6" fill="none" stroke="#FFFFFF" stroke-width="2"></circle>
        <circle cx="78" cy="18" r="13" fill="#25D366"></circle>
        <text x="78" y="24" text-anchor="middle" font-size="15" font-weight="800" fill="#FFFFFF">w</text>
        <circle cx="108" cy="18" r="13" fill="#00B2FF"></circle>
        <path d="M101 22 L108 14 L115 22" fill="none" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"></path>
      </g>
    `;
  }

  if (lockupKey === "meta-quest-business") {
    return `
      <g transform="translate(${x}, ${y}) scale(${scale})">
        <path d="M2 22 C8 8, 20 8, 28 22 C36 8, 48 8, 54 22" fill="none" stroke="#2563EB" stroke-width="6" stroke-linecap="round"></path>
        <text x="66" y="28" font-size="24" font-weight="700" fill="#111111">Quest</text>
      </g>
    `;
  }

  if (lockupKey.startsWith("region-")) {
    return renderRegionMapLockup(lockupKey, x, y, scale);
  }

  const asset = getLogoAsset(lockupKey);
  if (asset) {
    const company = getCompany(normalizeLogoKey(lockupKey));
    const primary = company?.brand?.primary || "#CBD5E1";
    const metrics = logoFrameMetrics(lockupKey, "lockup");
    return renderImageLogo(asset, x, y, {
      scale,
      boxWidth: metrics.width,
      boxHeight: metrics.height,
      padding: metrics.padding,
      paddingX: metrics.paddingX,
      paddingY: metrics.paddingY,
      radius: metrics.radius,
      borderColor: rgba(primary, 0.18),
      plateFill: "#FFFFFF",
      showPlate: metrics.showPlate !== false,
    });
  }

  const company = getCompany(lockupKey);
  const primary = company?.brand?.primary || "#0F172A";
  const initial = escapeHtml((company?.ticker || lockupKey || "?").slice(0, 1).toUpperCase());
  return `
    <g transform="translate(${x}, ${y}) scale(${scale})">
      <circle cx="42" cy="42" r="34" fill="#FFFFFF" stroke="${rgba(primary, 0.16)}" stroke-width="6"></circle>
      <circle cx="42" cy="42" r="22" fill="${rgba(primary, 0.08)}"></circle>
      <text x="42" y="54" text-anchor="middle" font-size="30" font-weight="800" fill="${primary}">${initial}</text>
    </g>
  `;
}

function renderPixelReplicaSvg(snapshot) {
  const canvas = snapshotCanvasSize(snapshot);
  const width = canvas.width;
  const height = canvas.height;
  const leftShiftX = safeNumber(canvas.leftShiftX, 0);
  const verticalScale = height / canvas.designHeight;
  const scaleY = (value) => value * verticalScale;
  const layoutY = (value, fallback) => scaleY(safeNumber(value, fallback));
  const shiftCanvasX = (value, fallback) => safeNumber(value, fallback) + leftShiftX;
  const ribbonCurve = Math.max(safeNumber(snapshot.ribbon?.curveFactor, 0.5), 0.48);
  const ribbonSource = snapshot.ribbon || {};
  const ribbonOptions = {
    curveFactor: ribbonCurve,
    topStartBias: safeNumber(ribbonSource.topStartBias, 0.18),
    topEndBias: safeNumber(ribbonSource.topEndBias, 0.82),
    bottomStartBias: safeNumber(ribbonSource.bottomStartBias, 0.18),
    bottomEndBias: safeNumber(ribbonSource.bottomEndBias, 0.82),
    startCurveFactor: Math.max(safeNumber(ribbonSource.startCurveFactor, ribbonCurve * 0.72), 0.3),
    endCurveFactor: Math.max(safeNumber(ribbonSource.endCurveFactor, ribbonCurve * 0.7), 0.28),
    minStartCurveFactor: Math.max(safeNumber(ribbonSource.minStartCurveFactor, 0.16), 0.16),
    maxStartCurveFactor: Math.max(safeNumber(ribbonSource.maxStartCurveFactor, 0.38), 0.38),
    minEndCurveFactor: Math.max(safeNumber(ribbonSource.minEndCurveFactor, 0.15), 0.15),
    maxEndCurveFactor: Math.max(safeNumber(ribbonSource.maxEndCurveFactor, 0.36), 0.36),
    deltaScale: Math.max(safeNumber(ribbonSource.deltaScale, 0.9), 0.9),
    deltaInfluence: Math.min(safeNumber(ribbonSource.deltaInfluence, 0.06), 0.06),
    thicknessInfluence: Math.max(safeNumber(ribbonSource.thicknessInfluence, 0.06), 0.06),
  };
  const sourceHornSource = ribbonSource.sourceHorn || {};
  const sourceHornOptions = {
    ...sourceHornSource,
    curveFactor: Math.max(safeNumber(sourceHornSource.curveFactor, 0.36), 0.34),
    startCurveFactor: Math.max(safeNumber(sourceHornSource.startCurveFactor, 0.32), 0.3),
    endCurveFactor: Math.max(safeNumber(sourceHornSource.endCurveFactor, 0.36), 0.34),
    minStartCurveFactor: Math.max(safeNumber(sourceHornSource.minStartCurveFactor, 0.14), 0.14),
    maxStartCurveFactor: Math.max(safeNumber(sourceHornSource.maxStartCurveFactor, 0.36), 0.36),
    minEndCurveFactor: Math.max(safeNumber(sourceHornSource.minEndCurveFactor, 0.16), 0.16),
    maxEndCurveFactor: Math.max(safeNumber(sourceHornSource.maxEndCurveFactor, 0.38), 0.38),
    deltaScale: Math.max(safeNumber(sourceHornSource.deltaScale, 0.92), 0.92),
    deltaInfluence: Math.min(safeNumber(sourceHornSource.deltaInfluence, 0.065), 0.065),
    thicknessInfluence: Math.max(safeNumber(sourceHornSource.thicknessInfluence, 0.055), 0.055),
  };
  const detailSourceHornOptions = {
    ...sourceHornOptions,
    curveFactor: Math.max(safeNumber(sourceHornSource.detailCurveFactor, sourceHornOptions.curveFactor + 0.05), 0.38),
    startCurveFactor: Math.max(safeNumber(sourceHornSource.detailStartCurveFactor, sourceHornOptions.startCurveFactor + 0.04), 0.34),
    endCurveFactor: Math.max(safeNumber(sourceHornSource.detailEndCurveFactor, sourceHornOptions.endCurveFactor + 0.05), 0.38),
    minStartCurveFactor: Math.max(safeNumber(sourceHornSource.detailMinStartCurveFactor, 0.16), sourceHornOptions.minStartCurveFactor),
    maxStartCurveFactor: Math.max(safeNumber(sourceHornSource.detailMaxStartCurveFactor, 0.42), sourceHornOptions.maxStartCurveFactor),
    minEndCurveFactor: Math.max(safeNumber(sourceHornSource.detailMinEndCurveFactor, 0.18), sourceHornOptions.minEndCurveFactor),
    maxEndCurveFactor: Math.max(safeNumber(sourceHornSource.detailMaxEndCurveFactor, 0.44), sourceHornOptions.maxEndCurveFactor),
    deltaScale: Math.max(safeNumber(sourceHornSource.detailDeltaScale, 0.96), sourceHornOptions.deltaScale),
    deltaInfluence: Math.min(safeNumber(sourceHornSource.detailDeltaInfluence, 0.058), sourceHornOptions.deltaInfluence),
    sourceHoldFactor: clamp(safeNumber(sourceHornSource.detailSourceHoldFactor, 0.03), 0.012, 0.05),
    minSourceHoldLength: Math.max(safeNumber(sourceHornSource.detailMinSourceHoldLength, 2), 1),
    maxSourceHoldLength: Math.max(safeNumber(sourceHornSource.detailMaxSourceHoldLength, 10), 6),
    targetHoldFactor: clamp(safeNumber(sourceHornSource.detailTargetHoldFactor, 0.024), 0.01, 0.045),
    minTargetHoldLength: Math.max(safeNumber(sourceHornSource.detailMinTargetHoldLength, 2), 1),
    maxTargetHoldLength: Math.max(safeNumber(sourceHornSource.detailMaxTargetHoldLength, 8), 4),
  };
  const replicaFlowPath = (x0, y0Top, y0Bottom, x1, y1Top, y1Bottom) =>
    flowPath(
      x0,
      y0Top,
      y0Bottom,
      x1 + safeNumber(snapshot.layout?.targetCoverInsetX, 20),
      y1Top,
      y1Bottom,
      ribbonOptions
    );
  const outflowRibbonOptions = {
    ...ribbonOptions,
    curveFactor: clamp(ribbonCurve + 0.03, 0.52, 0.58),
    startCurveFactor: clamp(Math.min(safeNumber(ribbonOptions.startCurveFactor, 0.34), 0.32) - 0.04, 0.18, 0.26),
    endCurveFactor: clamp(Math.min(safeNumber(ribbonOptions.endCurveFactor, 0.32), 0.34) - 0.01, 0.22, 0.32),
    minStartCurveFactor: clamp(Math.min(safeNumber(ribbonOptions.minStartCurveFactor, 0.17), 0.18) - 0.01, 0.14, 0.18),
    maxStartCurveFactor: clamp(Math.min(safeNumber(ribbonOptions.maxStartCurveFactor, 0.4), 0.36) - 0.02, 0.22, 0.32),
    minEndCurveFactor: clamp(Math.min(safeNumber(ribbonOptions.minEndCurveFactor, 0.16), 0.2) + 0.02, 0.18, 0.24),
    maxEndCurveFactor: clamp(Math.min(safeNumber(ribbonOptions.maxEndCurveFactor, 0.38), 0.36), 0.28, 0.36),
    deltaScale: Math.max(safeNumber(ribbonSource.outflowDeltaScale, 0.98), 0.92),
    deltaInfluence: Math.min(safeNumber(ribbonSource.outflowDeltaInfluence, 0.045), 0.05),
    thicknessInfluence: Math.max(safeNumber(ribbonSource.outflowThicknessInfluence, 0.075), 0.06),
    sourceHoldFactor: clamp(safeNumber(ribbonSource.outflowSourceHoldFactor, 0.05), 0.03, 0.08),
    minSourceHoldLength: Math.max(safeNumber(ribbonSource.outflowMinSourceHoldLength, 6), 4),
    maxSourceHoldLength: Math.max(safeNumber(ribbonSource.outflowMaxSourceHoldLength, 18), 10),
    targetHoldFactor: clamp(safeNumber(ribbonSource.outflowTargetHoldFactor, 0.066), 0.04, 0.1),
    minTargetHoldLength: Math.max(safeNumber(ribbonSource.outflowMinTargetHoldLength, 8), 4),
    maxTargetHoldLength: Math.max(safeNumber(ribbonSource.outflowMaxTargetHoldLength, 24), 12),
    sourceHoldDeltaReduction: clamp(safeNumber(ribbonSource.outflowSourceHoldDeltaReduction, 0.56), 0, 0.88),
    targetHoldDeltaReduction: clamp(safeNumber(ribbonSource.outflowTargetHoldDeltaReduction, 0.68), 0, 0.9),
    minAdaptiveSourceHoldLength: Math.max(safeNumber(ribbonSource.outflowMinAdaptiveSourceHoldLength, 2), 1),
    minAdaptiveTargetHoldLength: Math.max(safeNumber(ribbonSource.outflowMinAdaptiveTargetHoldLength, 3), 1),
    holdDeltaScale: clamp(safeNumber(ribbonSource.outflowHoldDeltaScale, 0.52), 0.24, 1.2),
  };
  const mergeOutflowRibbonOptions = (overrides = {}) => ({
    ...outflowRibbonOptions,
    ...overrides,
  });
  const replicaOutflowPath = (x0, y0Top, y0Bottom, x1, y1Top, y1Bottom, overrides = {}) =>
    flowPath(
      x0,
      y0Top,
      y0Bottom,
      x1 + safeNumber(snapshot.layout?.targetCoverInsetX, 20),
      y1Top,
      y1Bottom,
      mergeOutflowRibbonOptions(overrides)
    );
  const sourceFlowPath = (x0, y0Top, y0Bottom, x1, y1Top, y1Bottom) =>
    hornFlowPath(x0, y0Top, y0Bottom, x1, y1Top, y1Bottom, sourceHornOptions);
  const detailSourceFlowPath = (x0, y0Top, y0Bottom, x1, y1Top, y1Bottom) =>
    hornFlowPath(x0, y0Top, y0Bottom, x1, y1Top, y1Bottom, detailSourceHornOptions);
  const titleColor = "#175C8E";
  const muted = "#676C75";
  const dark = "#55595F";
  const greenText = "#009B5F";
  const greenNode = "#2BAB2B";
  const greenFlow = "#ACDBA3";
  const redText = "#9D1F07";
  const redNode = "#E50000";
  const redFlow = "#E58A92";
  const revenueNode = "#707070";
  const background = "#F6F5F2";
  const nodeWidth = 58;
  const sourceNodeWidth = safeNumber(snapshot.layout?.sourceNodeWidth, Math.max(nodeWidth - 6, 48));
  const prototypeFlags = snapshot.prototypeFlags || {};
  const templateTokens = snapshot.templateTokens || {};
  const usesHeroLockups = !!prototypeFlags.heroLockups;
  const usesLeftAnchoredRevenueLabel = !!prototypeFlags.leftAnchoredRevenueLabel;
  const usesCompactQuarterLabel = !!prototypeFlags.compactQuarterLabel;
  const usesLargeTitle = !!prototypeFlags.largeTitle;
  const showQoq = hasSnapshotQoqMetrics(snapshot);
  const usesPreDetailRevenueLayout = Array.isArray(snapshot.leftDetailGroups)
    ? snapshot.leftDetailGroups.some((item) => safeNumber(item?.valueBn) > 0.02)
    : false;
  const stageLayout = resolveUniformStageLayout(snapshot, {
    nodeWidth,
    sourceNodeWidth,
    usesHeroLockups,
  });
  const baseLeftX = stageLayout.leftX;
  const baseLeftDetailX = stageLayout.leftDetailX;
  const baseRightX = stageLayout.rightX;
  const sourceTemplateLabelGapX = safeNumber(
    snapshot.layout?.sourceTemplateLabelGapX,
    safeNumber(snapshot.layout?.sourceLabelGapX, 18)
  );
  const detailSourceLabelGapX = safeNumber(snapshot.layout?.detailSourceLabelGapX, sourceTemplateLabelGapX);
  const layoutBaseRightX = safeNumber(snapshot.layout?.rightX, usesHeroLockups ? 1790 : 1688);
  const leftX = shiftCanvasX(baseLeftX, 368);
  const sourceLabelX = shiftCanvasX(snapshot.layout?.sourceLabelX, Math.max(baseLeftX - 224, 112));
  const sourceTemplateLabelX = shiftCanvasX(
    snapshot.layout?.sourceTemplateLabelX,
    usesPreDetailRevenueLayout
      ? safeNumber(snapshot.layout?.sourceLabelX, baseLeftX - sourceTemplateLabelGapX)
      : baseLeftX - sourceTemplateLabelGapX
  );
  const sourceMetricX = shiftCanvasX(snapshot.layout?.sourceMetricX, baseLeftX + sourceNodeWidth / 2 + safeNumber(snapshot.layout?.sourceMetricOffsetX, 0));
  const sourceTemplateMetricX = shiftCanvasX(snapshot.layout?.sourceTemplateMetricX, safeNumber(snapshot.layout?.sourceMetricX, baseLeftX + 4));
  const detailSourceLabelX = shiftCanvasX(snapshot.layout?.detailSourceLabelX, baseLeftDetailX - detailSourceLabelGapX);
  const detailSourceMetricX = shiftCanvasX(snapshot.layout?.detailSourceMetricX, baseLeftDetailX + 4);
  const revenueX = shiftCanvasX(stageLayout.revenueX, 742);
  const grossX = shiftCanvasX(stageLayout.grossX, 1122);
  const opX = shiftCanvasX(stageLayout.opX, 1480);
  const rightBaseX = shiftCanvasX(baseRightX, usesHeroLockups ? 1790 : 1688);
  const opexTargetX = shiftCanvasX(
    snapshot.layout?.opexTargetX,
    baseRightX + (safeNumber(snapshot.layout?.opexTargetX, layoutBaseRightX - 24) - layoutBaseRightX)
  );
  const rawCostBreakdown = [...(snapshot.costBreakdown || [])].filter((item) => safeNumber(item.valueBn) > 0.02);
  const rawCostBreakdownX = shiftCanvasX(
    snapshot.layout?.costBreakdownX,
    stageLayout.grossX + (safeNumber(snapshot.layout?.costBreakdownX, 1294) - safeNumber(snapshot.layout?.grossX, 1122))
  );
  const templateCostBreakdownBaseX = shiftCanvasX(
    templateTokens.layout?.costBreakdownX,
    stageLayout.grossX + (safeNumber(templateTokens.layout?.costBreakdownX, 1294) - safeNumber(templateTokens.layout?.grossX, 1122))
  );
  const costBreakdownRunwayAvailable = Math.max(opX - (grossX + nodeWidth), 0);
  const costBreakdownRunwayMinX = safeNumber(
    snapshot.layout?.costBreakdownRunwayMinX,
    clamp(costBreakdownRunwayAvailable * 0.66, 188, 248)
  );
  const costBreakdownAutoPullbackX = safeNumber(
    snapshot.layout?.costBreakdownTargetPullbackX,
    rawCostBreakdown.length <= 2
      ? 0
      : rawCostBreakdown.length === 3
        ? 24
        : Math.min(84, (rawCostBreakdown.length - 2) * 24)
  );
  const costBreakdownAlignmentFactor = clamp(
    safeNumber(
      snapshot.layout?.costBreakdownAlignmentFactor,
      rawCostBreakdown.length <= 1
        ? 0.72
        : rawCostBreakdown.length === 2
          ? 1
          : rawCostBreakdown.length === 3
            ? 0.78
            : 0.7
    ),
    0,
    1
  );
  const costBreakdownAlignmentTargetX = opX - costBreakdownAutoPullbackX;
  const costBreakdownAutoX = Math.max(
    grossX + costBreakdownRunwayMinX,
    templateCostBreakdownBaseX + (costBreakdownAlignmentTargetX - templateCostBreakdownBaseX) * costBreakdownAlignmentFactor
  );
  const costBreakdownRunwayMaxX = Math.max(
    grossX +
      safeNumber(
        snapshot.layout?.costBreakdownRunwayMaxX,
        opX - grossX + safeNumber(snapshot.layout?.costBreakdownMaxOffsetFromOpX, 0)
      ),
    grossX + costBreakdownRunwayMinX
  );
  const costBreakdownX =
    snapshot.layout?.costBreakdownX !== null && snapshot.layout?.costBreakdownX !== undefined
      ? clamp(rawCostBreakdownX, grossX + costBreakdownRunwayMinX, costBreakdownRunwayMaxX)
      : clamp(costBreakdownAutoX, grossX + costBreakdownRunwayMinX, costBreakdownRunwayMaxX);
  const costBreakdownOpexCollisionTriggerX = safeNumber(snapshot.layout?.costBreakdownOpexCollisionTriggerX, 92);
  const costBreakdownNearOpexColumn = rawCostBreakdown.length > 0 && costBreakdownX >= opX - costBreakdownOpexCollisionTriggerX;
  const costBreakdownLabelX = shiftCanvasX(
    snapshot.layout?.costBreakdownLabelX,
    stageLayout.grossX + (safeNumber(snapshot.layout?.costBreakdownLabelX, 1362) - safeNumber(snapshot.layout?.grossX, 1122))
  );
  const rightBranchLabelGapX = safeNumber(snapshot.layout?.rightBranchLabelGapX, safeNumber(snapshot.layout?.sourceTemplateLabelGapX, 18));
  const rightLabelXBase = shiftCanvasX(
    snapshot.layout?.rightLabelX,
    baseRightX + (safeNumber(snapshot.layout?.rightLabelX, layoutBaseRightX + 62) - layoutBaseRightX)
  );
  const opexLabelX = shiftCanvasX(
    snapshot.layout?.opexLabelX,
    baseRightX + (safeNumber(snapshot.layout?.opexLabelX, safeNumber(snapshot.layout?.opexTargetX, layoutBaseRightX - 24) + 62) - layoutBaseRightX)
  );
  const belowLabelX = shiftCanvasX(
    snapshot.layout?.belowLabelX,
    baseRightX + (safeNumber(snapshot.layout?.belowLabelX, safeNumber(snapshot.layout?.rightLabelX, layoutBaseRightX + 62)) - layoutBaseRightX)
  );
  const rightLabelPaddingRight = safeNumber(snapshot.layout?.rightLabelPaddingRight, 44);
  const rightTerminalTitleMaxWidth = Math.max(width - (rightBaseX + nodeWidth + rightBranchLabelGapX) - rightLabelPaddingRight, 120);
  const costTerminalTitleMaxWidth = Math.max(
    width -
      (costBreakdownX +
        nodeWidth +
        rightBranchLabelGapX +
        safeNumber(snapshot.layout?.terminalNodeExtraMaxX, 68)) -
      rightLabelPaddingRight,
    120
  );
  const baseRevenueTop = safeNumber(snapshot.layout?.revenueTop, 330);
  const baseRevenueHeight = safeNumber(snapshot.layout?.revenueHeight, 452);
  const revenueHeight = scaleY(baseRevenueHeight);
  // Keep the stage scale anchored to actual revenue so sub-$1B charts do not leave
  // phantom slack inside the revenue node that later makes cost ribbons appear to taper.
  const revenueBn = Math.max(safeNumber(snapshot.revenueBn), safeNumber(snapshot.layout?.revenueScaleFloorBn, 0.05));
  const grossProfitBn = Math.max(safeNumber(snapshot.grossProfitBn), 0);
  const costOfRevenueBn =
    snapshot.costOfRevenueBn !== null && snapshot.costOfRevenueBn !== undefined
      ? Math.max(safeNumber(snapshot.costOfRevenueBn), 0)
      : Math.max(revenueBn - grossProfitBn, 0);
  const operatingProfitBn = Math.max(safeNumber(snapshot.operatingProfitBn), 0);
  const operatingExpensesBn =
    snapshot.operatingExpensesBn !== null && snapshot.operatingExpensesBn !== undefined
      ? Math.max(safeNumber(snapshot.operatingExpensesBn), 0)
      : Math.max(grossProfitBn - operatingProfitBn, 0);
  const netOutcomeBn = resolvedNetOutcomeValue(snapshot);
  const netLoss = isLossMakingNetOutcome(snapshot);
  const nearZeroNet = isNearZeroNetOutcome(snapshot);
  const netProfitBn = netLoss ? Math.abs(netOutcomeBn) : Math.max(netOutcomeBn, 0);
  const scale = revenueHeight / revenueBn;
  const grossHeight = Math.max(grossProfitBn * scale, 4);
  const costHeight = costOfRevenueBn > 0.05 ? Math.max(costOfRevenueBn * scale, 4) : 0;
  const opHeight = Math.max(operatingProfitBn * scale, 4);
  const opexHeight = Math.max(operatingExpensesBn * scale, 4);
  const netHeight = Math.max(netProfitBn * scale, nearZeroNet ? scaleY(4.5) : 4);
  const showCostBridge = costHeight > 0;
  const baseChartBottomLimit = layoutY(snapshot.layout?.chartBottomLimit, 1004);
  const rawSources = sortBusinessGroupsByValue(snapshot.businessGroups || []).filter((item) => safeNumber(item.valueBn) > 0.02);
  const rawLeftDetailGroups = [...(snapshot.leftDetailGroups || [])].filter((item) => safeNumber(item.valueBn) > 0.02);
  const rawOpexItemsSource = [...(snapshot.opexBreakdown || [])].filter((item) => safeNumber(item.valueBn) > 0.02);
  const collapsedOpexItem = resolveCollapsedSingleExpenseBreakdown(rawOpexItemsSource, snapshot.operatingExpensesBn, {
    baseTolerance: 0.08,
    relativeToleranceFactor: 0.01,
  });
  const rawOpexItems = collapsedOpexItem ? [] : rawOpexItemsSource;
  const rawBelowOperatingItems = [...(snapshot.belowOperatingItems || [])].filter((item) => safeNumber(item.valueBn) > 0.02);
  const rawPositiveAdjustments = [...(snapshot.positiveAdjustments || [])].filter((item) => safeNumber(item.valueBn) > 0.02);
  const leftBranchCount = rawSources.length + rawLeftDetailGroups.length * 0.92;
  const rightBranchCount =
    rawOpexItems.length +
    rawBelowOperatingItems.length +
    rawCostBreakdown.length * 0.85 +
    rawPositiveAdjustments.length * 0.7;
  const leftComplexity =
    Math.max(leftBranchCount - 4.5, 0) * 7.4 +
    Math.max(rawLeftDetailGroups.length - 1, 0) * 6.6;
  const rightComplexity =
    Math.max(rightBranchCount - 2.15, 0) * 10.8 +
    Math.max(rawCostBreakdown.length - 1, 0) * 6.2 +
    Math.max(rawPositiveAdjustments.length - 1, 0) * 4.2;
  const lowerRightPressureY = scaleY(
    clamp(
      safeNumber(
        snapshot.layout?.lowerRightPressureY,
        Math.max(rightComplexity - 9, 0) * 1.85 +
          (costBreakdownNearOpexColumn ? 18 : 0) +
          (rawCostBreakdown.length === 2 ? 16 : Math.max(rawCostBreakdown.length - 2, 0) * 10) +
          Math.max(rawOpexItems.length - 2, 0) * 8 +
          Math.max(rawBelowOperatingItems.length - 1, 0) * 10
      ),
      0,
      usesHeroLockups ? 88 : 74
    )
  );
  const rightStageCrowdingStrength = clamp(
    safeNumber(
      snapshot.layout?.rightStageCrowdingStrength,
      clamp(lowerRightPressureY / scaleY(88), 0, 1) * 0.54 +
        Math.max(rawCostBreakdown.length - 1, 0) * 0.18 +
        Math.max(rawOpexItems.length + rawBelowOperatingItems.length - 3, 0) * 0.08 +
        (costBreakdownNearOpexColumn ? 0.26 : 0)
    ),
    0,
    0.94
  );
  const hasDenseLeftStage = rawSources.length >= 6 || rawLeftDetailGroups.length >= 2;
  const hasDenseRightStage =
    rightBranchCount >= 3 ||
    rawOpexItems.length + rawBelowOperatingItems.length >= 3 ||
    rawCostBreakdown.length >= 2 ||
    rawPositiveAdjustments.length >= 2;
  const stageBottomClearanceY = scaleY(safeNumber(snapshot.layout?.stageBottomClearanceY, usesHeroLockups ? 118 : 108));
  const unilateralStageSlackY = Math.max(height - baseChartBottomLimit - stageBottomClearanceY, 0);
  const unilateralStageSlackEligible =
    (hasDenseLeftStage || hasDenseRightStage) &&
    unilateralStageSlackY >= scaleY(safeNumber(snapshot.layout?.minUnilateralStageSlackY, 42));
  const stageRecenteringEligibility = hasDenseLeftStage && hasDenseRightStage || unilateralStageSlackEligible;
  const chartBottomLimit = stageRecenteringEligibility
    ? Math.max(
        baseChartBottomLimit,
        height - stageBottomClearanceY
      )
    : baseChartBottomLimit;
  const bilateralDensity =
    Math.max(Math.min(leftComplexity, rightComplexity), 0) * 0.56 +
    Math.max(leftComplexity + rightComplexity - 32, 0) * 0.44;
  const bilateralStageComplexity =
    hasDenseLeftStage && hasDenseRightStage
      ? bilateralDensity
      : hasDenseLeftStage
        ? bilateralDensity * 0.38
        : bilateralDensity * 0.16;
  const stageCenteringShiftY = scaleY(
    clamp(
      safeNumber(
        snapshot.layout?.stageCenteringShiftY,
        bilateralStageComplexity +
          (hasDenseLeftStage && hasDenseRightStage ? 22 : 0) +
          (rawLeftDetailGroups.length && hasDenseRightStage ? 12 : 0) +
          (rawSources.length >= 7 && hasDenseRightStage ? 8 : 0) +
          (rightBranchCount >= 4 && hasDenseLeftStage ? 10 : 0)
      ),
      0,
      usesHeroLockups ? 124 : 108
    )
  );
  const hasExplicitGrossNodeTop = snapshot.layout?.grossNodeTop !== null && snapshot.layout?.grossNodeTop !== undefined;
  const hasExplicitCostNodeTop = snapshot.layout?.costNodeTop !== null && snapshot.layout?.costNodeTop !== undefined;
  const revenueTopBase = clamp(
    scaleY(baseRevenueTop) + stageCenteringShiftY * safeNumber(snapshot.layout?.revenueStageShiftFactor, 0.82),
    scaleY(244),
    chartBottomLimit - revenueHeight
  );
  const grossTopBase = clamp(
    layoutY(snapshot.layout?.grossNodeTop, baseRevenueTop + (usesHeroLockups ? 74 : 46)) +
      stageCenteringShiftY * safeNumber(snapshot.layout?.grossStageShiftFactor, 0.98),
    scaleY(236),
    chartBottomLimit - grossHeight
  );
  const hasExplicitOpNodeTop = snapshot.layout?.opNodeTop !== null && snapshot.layout?.opNodeTop !== undefined;
  const hasExplicitOpexNodeTop = snapshot.layout?.opexNodeTop !== null && snapshot.layout?.opexNodeTop !== undefined;
  const hasExplicitNetNodeTop = snapshot.layout?.netNodeTop !== null && snapshot.layout?.netNodeTop !== undefined;
  const positiveFlowRiseBoostY = rawPositiveAdjustments.length
    ? scaleY(
        clamp(
          safeNumber(
            snapshot.layout?.positiveFlowRiseBoostY,
            22 +
              Math.max(rawPositiveAdjustments.length - 1, 0) * 8 +
              Math.max(rawOpexItems.length + rawBelowOperatingItems.length - 2, 0) * 4
          ),
          usesHeroLockups ? 18 : 16,
          usesHeroLockups ? 62 : 54
        )
      )
    : 0;
  const profitRiseRatio = safeNumber(snapshot.layout?.profitRiseRatio, usesHeroLockups ? 0.62 : 0.64);
  const profitRiseBaseY = scaleY(safeNumber(snapshot.layout?.profitRiseBaseY, usesHeroLockups ? 16 : 12));
  const profitRiseMinY = scaleY(safeNumber(snapshot.layout?.profitRiseMinY, usesHeroLockups ? 40 : 34));
  const profitRiseMaxY = scaleY(safeNumber(snapshot.layout?.profitRiseMaxY, usesHeroLockups ? 106 : 92));
  const profitRiseY = clamp(
    Math.max(grossHeight - opHeight, 0) * profitRiseRatio +
      profitRiseBaseY +
      positiveFlowRiseBoostY * 0.7 +
      lowerRightPressureY *
        safeNumber(
          snapshot.layout?.profitRiseLowerRightPressureFactor,
          costBreakdownNearOpexColumn ? 0.82 : rawCostBreakdown.length >= 2 ? 0.7 : 0.54
        ),
    profitRiseMinY,
    profitRiseMaxY +
      positiveFlowRiseBoostY +
      lowerRightPressureY * safeNumber(snapshot.layout?.profitRiseLowerRightPressureMaxFactor, 0.94)
  );
  const costMinGapFromGross = scaleY(safeNumber(snapshot.layout?.costMinGapFromGross, usesHeroLockups ? 20 : 18));
  const costGapRatio = safeNumber(snapshot.layout?.costGapRatio, 0.018);
  const costGapBaseY = scaleY(safeNumber(snapshot.layout?.costGapBaseY, usesHeroLockups ? 14 : 12));
  const costGapMinY = scaleY(safeNumber(snapshot.layout?.costGapMinY, usesHeroLockups ? 22 : 20));
  const costGapMaxY = scaleY(safeNumber(snapshot.layout?.costGapMaxY, usesHeroLockups ? 36 : 30));
  const costGapY = clamp(
    costHeight * costGapRatio +
      costGapBaseY +
      lowerRightPressureY * safeNumber(snapshot.layout?.costGapLowerRightPressureFactor, rawCostBreakdown.length >= 2 ? 0.14 : 0.08),
    costGapMinY,
    costGapMaxY + lowerRightPressureY * safeNumber(snapshot.layout?.costGapLowerRightPressureMaxFactor, 0.24)
  );
  const templateCostTopBaseline = layoutY(
    templateTokens.layout?.costNodeTop,
    baseRevenueTop + baseRevenueHeight + (usesHeroLockups ? 56 : 36)
  );
  const costOutflowBiasYBase = scaleY(
    clamp(
      safeNumber(
        snapshot.layout?.costOutflowBiasY,
        14 +
          (rawCostBreakdown.length <= 1 ? 0 : rawCostBreakdown.length === 2 ? 18 : 24 + (rawCostBreakdown.length - 3) * 8)
      ),
      usesHeroLockups ? 18 : 14,
      usesHeroLockups ? 66 : 56
    )
  );
  const costOutflowBiasY =
    costOutflowBiasYBase +
    lowerRightPressureY *
      safeNumber(
        snapshot.layout?.costOutflowLowerRightPressureFactor,
        costBreakdownNearOpexColumn ? 0.58 : rawCostBreakdown.length >= 2 ? 0.46 : 0.24
      );
  const costTemplateAnchorWeight = clamp(
    safeNumber(
      snapshot.layout?.costTemplateAnchorWeight,
      rawCostBreakdown.length <= 1
        ? 0.64
        : rawCostBreakdown.length === 2
          ? 0.72
          : rawCostBreakdown.length === 3
            ? 0.68
            : 0.6
    ),
    0,
    1
  );
  const costAutoTopTarget =
    templateCostTopBaseline * costTemplateAnchorWeight +
    (grossTopBase + grossHeight + costGapY + costOutflowBiasY) * (1 - costTemplateAnchorWeight);
  const costBaseTopCandidate = showCostBridge
    ? clamp(
        hasExplicitCostNodeTop ? layoutY(snapshot.layout?.costNodeTop) : costAutoTopTarget,
        grossTopBase + grossHeight + costMinGapFromGross,
        chartBottomLimit - costHeight
      )
    : chartBottomLimit - scaleY(8);
  const opTopBase = clamp(
    (hasExplicitOpNodeTop ? layoutY(snapshot.layout?.opNodeTop) : grossTopBase - profitRiseY) +
      stageCenteringShiftY * safeNumber(snapshot.layout?.operatingStageShiftFactor, 1),
    scaleY(220),
    chartBottomLimit - opHeight
  );
  const opexMinGapFromOperating = scaleY(safeNumber(snapshot.layout?.opexMinGapFromOperating, usesHeroLockups ? 46 : 40));
  const grossExpenseGapRatio = safeNumber(snapshot.layout?.grossExpenseGapRatio, 0.44);
  const grossExpenseGapBaseY = scaleY(safeNumber(snapshot.layout?.grossExpenseGapBaseY, 0));
  const grossExpenseGapMinY = scaleY(safeNumber(snapshot.layout?.grossExpenseGapMinY, usesHeroLockups ? 34 : 28));
  const grossExpenseGapMaxY = scaleY(safeNumber(snapshot.layout?.grossExpenseGapMaxY, usesHeroLockups ? 72 : 60));
  const grossExpenseGapY = clamp(opexHeight * grossExpenseGapRatio + grossExpenseGapBaseY, grossExpenseGapMinY, grossExpenseGapMaxY);
  const opexMinTop = Math.min(
    Math.max(scaleY(360), opTopBase + opHeight + opexMinGapFromOperating),
    chartBottomLimit - opexHeight
  );
  const opexBaseCandidate =
    (hasExplicitOpexNodeTop ? layoutY(snapshot.layout?.opexNodeTop) : grossTopBase + opHeight + grossExpenseGapY) +
    stageCenteringShiftY * safeNumber(snapshot.layout?.opexStageShiftFactor, 1.12);
  const opexAdaptiveLiftHeadroom = Math.max(opexBaseCandidate - opexMinTop, 0);
  const opexAdaptiveLiftY =
    snapshot.layout?.disableAdaptiveRightStageLift === true
      ? 0
      : Math.min(
          scaleY(safeNumber(snapshot.layout?.opexAdaptiveLiftMaxY, 126)),
          opexAdaptiveLiftHeadroom * safeNumber(snapshot.layout?.opexAdaptiveLiftHeadroomFactor, 0.82),
          scaleY(safeNumber(snapshot.layout?.opexAdaptiveLiftBaseY, 34)) +
            lowerRightPressureY * safeNumber(snapshot.layout?.opexAdaptiveLiftPressureFactor, 1.42) +
            scaleY(safeNumber(snapshot.layout?.opexAdaptiveLiftCrowdingY, 46)) * rightStageCrowdingStrength
        );
  const revenueUpperSplitOpeningDeltaY = Math.max(grossTopBase - revenueTopBase, 0);
  const revenueLowerSplitOpeningDeltaYBase = showCostBridge
    ? Math.max(costBaseTopCandidate - (revenueTopBase + grossHeight), 0)
    : revenueUpperSplitOpeningDeltaY;
  const grossUpperSplitOpeningDeltaY = Math.max(grossTopBase - opTopBase, 0);
  const grossLowerSplitOpeningDeltaYBase = Math.max(opexBaseCandidate - opexAdaptiveLiftY - (grossTopBase + opHeight), 0);
  const costGapFromGrossBaseY = showCostBridge
    ? Math.max(costBaseTopCandidate - (grossTopBase + grossHeight), 0)
    : 0;
  const costSplitOpeningReferenceY = clamp(
    revenueUpperSplitOpeningDeltaY * safeNumber(snapshot.layout?.costStageRevenueUpperWeight, 0.28) +
      revenueLowerSplitOpeningDeltaYBase * safeNumber(snapshot.layout?.costStageRevenueLowerWeight, 0.18) +
      grossUpperSplitOpeningDeltaY * safeNumber(snapshot.layout?.costStageGrossUpperWeight, 0.34) +
      grossLowerSplitOpeningDeltaYBase * safeNumber(snapshot.layout?.costStageGrossLowerWeight, 0.2),
    scaleY(safeNumber(snapshot.layout?.costStageOpeningReferenceMinY, 30)),
    scaleY(safeNumber(snapshot.layout?.costStageOpeningReferenceMaxY, usesHeroLockups ? 128 : 114))
  );
  const desiredCostGapFromGrossY = clamp(
    Math.max(
      costGapFromGrossBaseY,
      costSplitOpeningReferenceY * safeNumber(snapshot.layout?.costStageReferenceMatchFactor, rawCostBreakdown.length >= 2 ? 0.42 : rawCostBreakdown.length === 1 ? 0.5 : 0.58),
      scaleY(safeNumber(snapshot.layout?.costStageGapBaseY, rawCostBreakdown.length ? 36 : 42))
    ),
    costMinGapFromGross,
    scaleY(safeNumber(snapshot.layout?.costStageGapTargetMaxY, usesHeroLockups ? 122 : 108)) +
      lowerRightPressureY * safeNumber(snapshot.layout?.costStageGapTargetPressureFactor, 0.24)
  );
  const costStageBalanceAvailableDropY = showCostBridge
    ? Math.max(chartBottomLimit - costHeight - costBaseTopCandidate, 0)
    : 0;
  const enableCostStageGapBalance =
    showCostBridge &&
    !hasExplicitCostNodeTop &&
    snapshot.layout?.disableCostStageGapBalance !== true;
  const costStageGapBalanceDropY =
    !enableCostStageGapBalance
      ? 0
      : Math.min(
          Math.max(desiredCostGapFromGrossY - costGapFromGrossBaseY, 0) *
            safeNumber(snapshot.layout?.costStageGapBalanceFactor, rawCostBreakdown.length >= 2 ? 0.46 : rawCostBreakdown.length === 1 ? 0.62 : 0.9),
          costStageBalanceAvailableDropY,
          scaleY(safeNumber(snapshot.layout?.costStageGapBalanceMaxY, rawCostBreakdown.length ? 56 : 82))
        );
  const costTopBase = showCostBridge
    ? clamp(
        costBaseTopCandidate + costStageGapBalanceDropY,
        grossTopBase + grossHeight + costMinGapFromGross,
        chartBottomLimit - costHeight
      )
    : chartBottomLimit - scaleY(8);
  const revenueLowerSplitOpeningDeltaY = showCostBridge ? Math.max(costTopBase - (revenueTopBase + grossHeight), 0) : revenueUpperSplitOpeningDeltaY;
  const grossSplitOpeningReferenceY = clamp(
    revenueUpperSplitOpeningDeltaY * safeNumber(snapshot.layout?.stageSplitRevenueUpperWeight, 0.34) +
      revenueLowerSplitOpeningDeltaY * safeNumber(snapshot.layout?.stageSplitRevenueLowerWeight, 0.32) +
      grossUpperSplitOpeningDeltaY * safeNumber(snapshot.layout?.stageSplitGrossUpperWeight, 0.34),
    scaleY(safeNumber(snapshot.layout?.stageSplitOpeningReferenceMinY, 24)),
    scaleY(safeNumber(snapshot.layout?.stageSplitOpeningReferenceMaxY, usesHeroLockups ? 118 : 102))
  );
  const desiredGrossLowerSplitOpeningDeltaY = clamp(
    Math.max(
      grossUpperSplitOpeningDeltaY * safeNumber(snapshot.layout?.stageSplitSiblingMatchFactor, 0.94),
      grossSplitOpeningReferenceY * safeNumber(snapshot.layout?.stageSplitReferenceMatchFactor, 0.98)
    ),
    grossExpenseGapMinY,
    scaleY(safeNumber(snapshot.layout?.stageSplitOpeningTargetMaxY, usesHeroLockups ? 112 : 96)) +
      lowerRightPressureY * safeNumber(snapshot.layout?.stageSplitOpeningTargetPressureFactor, 0.28)
  );
  const opexAngleBalancedBaseTop = clamp(
    opexBaseCandidate - opexAdaptiveLiftY,
    opexMinTop,
    chartBottomLimit - opexHeight
  );
  const opexAngleBalanceAvailableDropY = Math.max(chartBottomLimit - opexHeight - opexAngleBalancedBaseTop, 0);
  const stageSplitAngleBalanceCountFactor =
    rawOpexItems.length <= 2 ? 1 : rawOpexItems.length === 3 ? safeNumber(snapshot.layout?.stageSplitAngleBalanceThreeWayFactor, 0.92) : 0;
  const enableStageSplitAngleBalance =
    !hasExplicitOpexNodeTop &&
    snapshot.layout?.disableStageSplitAngleBalance !== true &&
    rawOpexItems.length <= 3 &&
    stageSplitAngleBalanceCountFactor > 0 &&
    rawCostBreakdown.length === 0;
  const opexAngleBalanceDropY =
    !enableStageSplitAngleBalance
      ? 0
      : Math.min(
          Math.max(desiredGrossLowerSplitOpeningDeltaY - grossLowerSplitOpeningDeltaYBase, 0) * stageSplitAngleBalanceCountFactor,
          opexAngleBalanceAvailableDropY,
          scaleY(safeNumber(snapshot.layout?.stageSplitAngleBalanceMaxY, 78)) * stageSplitAngleBalanceCountFactor
        );
  const opexTopBase = clamp(
    opexBaseCandidate - opexAdaptiveLiftY + opexAngleBalanceDropY,
    opexMinTop,
    chartBottomLimit - opexHeight
  );
  const netRiseBaseY = scaleY(safeNumber(snapshot.layout?.netRiseBaseY, usesHeroLockups ? 26 : 22));
  const netRiseRatio = safeNumber(snapshot.layout?.netRiseRatio, 1.12);
  const netRiseMinY = scaleY(safeNumber(snapshot.layout?.netRiseMinY, usesHeroLockups ? 46 : 40));
  const netRiseMaxY = scaleY(safeNumber(snapshot.layout?.netRiseMaxY, usesHeroLockups ? 86 : 74));
  const netRiseSeedHeight = Math.max(opHeight - Math.min(netHeight, opHeight), 0);
  const netRiseY = clamp(
    netRiseBaseY + netRiseSeedHeight * netRiseRatio + positiveFlowRiseBoostY * 1.18,
    netRiseMinY,
    netRiseMaxY + positiveFlowRiseBoostY * 1.2
  );
  const netBaseCandidate =
    (hasExplicitNetNodeTop ? layoutY(snapshot.layout?.netNodeTop) : opTopBase - netRiseY) +
    stageCenteringShiftY * safeNumber(snapshot.layout?.netStageShiftFactor, 0.36);
  const netAdaptiveLiftHeadroom = Math.max(netBaseCandidate - scaleY(220), 0);
  const netAdaptiveLiftY =
    snapshot.layout?.disableAdaptiveRightStageLift === true
      ? 0
      : Math.min(
          scaleY(safeNumber(snapshot.layout?.netAdaptiveLiftMaxY, 58)),
          netAdaptiveLiftHeadroom * safeNumber(snapshot.layout?.netAdaptiveLiftHeadroomFactor, 0.72),
          scaleY(safeNumber(snapshot.layout?.netAdaptiveLiftBaseY, 12)) +
            scaleY(safeNumber(snapshot.layout?.netAdaptiveLiftCrowdingY, 26)) * rightStageCrowdingStrength
        );
  const netTopBase = clamp(
    netBaseCandidate - netAdaptiveLiftY,
    scaleY(220),
    chartBottomLimit - netHeight
  );
  const preliminaryStageTop = Math.min(revenueTopBase, grossTopBase, costTopBase, opTopBase, opexTopBase);
  const preliminaryStageBottom = Math.max(
    revenueTopBase + revenueHeight,
    grossTopBase + grossHeight,
    costTopBase + costHeight,
    opTopBase + opHeight,
    opexTopBase + opexHeight
  );
  const stageCenterTargetY = layoutY(snapshot.layout?.stageCenterTargetY, usesHeroLockups ? 748 : 740);
  const stageRecenteringDownYDesired = stageRecenteringEligibility
    ? Math.max(stageCenterTargetY - (preliminaryStageTop + preliminaryStageBottom) / 2, 0)
    : 0;
  const netRecenteringFactor = safeNumber(snapshot.layout?.netRecenteringShiftFactor, 0.44);
  const stageRecenteringDownY = clamp(
    stageRecenteringDownYDesired,
    0,
    Math.max(
      0,
      Math.min(
        chartBottomLimit - revenueHeight - revenueTopBase,
        chartBottomLimit - grossHeight - grossTopBase,
        chartBottomLimit - costHeight - costTopBase,
        chartBottomLimit - opHeight - opTopBase,
        chartBottomLimit - opexHeight - opexTopBase,
        netRecenteringFactor > 0 ? (chartBottomLimit - netHeight - netTopBase) / netRecenteringFactor : chartBottomLimit
      )
    )
  );
  const revenueTop = revenueTopBase + stageRecenteringDownY;
  const revenueBottom = revenueTop + revenueHeight;
  const revenueGrossBottom = revenueTop + grossHeight;
  const revenueCostTop = revenueGrossBottom;
  const grossTop = grossTopBase + stageRecenteringDownY;
  const grossBottom = grossTop + grossHeight;
  const costTop = costTopBase + stageRecenteringDownY;
  const costBottom = costTop + costHeight;
  const opTop = opTopBase + stageRecenteringDownY;
  const opBottom = opTop + opHeight;
  const opexTop = opexTopBase + stageRecenteringDownY;
  const opexBottom = opexTop + opexHeight;
  const netTop = netTopBase + stageRecenteringDownY * netRecenteringFactor;
  const netBottom = netTop + netHeight;
  const sourceDensity = rawSources.length >= 11 ? "ultra" : rawSources.length >= 8 ? "dense" : rawSources.length >= 6 ? "compact" : "regular";
  const sources = rawSources.map((item) => ({
    ...item,
    layoutDensity: item.layoutDensity || sourceDensity,
  }));
  const compactSources = snapshot.compactSourceLabels || sourceDensity !== "regular";
  const denseSources = sourceDensity === "dense" || sourceDensity === "ultra";
  const ultraDenseSources = sourceDensity === "ultra";
  const sourceHasMetrics = sources.some(
    (item) => item.yoyPct !== null && item.yoyPct !== undefined || (showQoq && item.qoqPct !== null && item.qoqPct !== undefined)
  );
  const sourceMetricGapBoost = sourceHasMetrics
    ? scaleY(ultraDenseSources ? (showQoq ? 10 : 8) : denseSources ? (showQoq ? 18 : 14) : compactSources ? (showQoq ? 30 : 22) : showQoq ? 42 : 34)
    : 0;
  const leftDetailGroups = rawLeftDetailGroups;
  const costBreakdown = rawCostBreakdown;
  const opexItems = rawOpexItems
    .filter((item) => safeNumber(item.valueBn) > 0.02)
    .sort((left, right) => safeNumber(right.valueBn) - safeNumber(left.valueBn) || String(left.name || "").localeCompare(String(right.name || "")));
  const operatingProfitBreakdown = [...(snapshot.operatingProfitBreakdown || [])].filter((item) => safeNumber(item.valueBn) > 0.02);
  const belowOperatingItems = rawBelowOperatingItems;
  const positiveAdjustments = rawPositiveAdjustments;
  const positiveMinVisibleHeight = scaleY(safeNumber(snapshot.layout?.positiveMinVisibleHeight, 6.5));
  const positiveCollapsedMinHeight = scaleY(safeNumber(snapshot.layout?.positiveCollapsedMinHeight, 4.5));
  const positiveVisibilityLiftTarget = scaleY(safeNumber(snapshot.layout?.positiveVisibilityLiftTarget, 14));
  const positiveVisibilityLiftFactor = clamp(safeNumber(snapshot.layout?.positiveVisibilityLiftFactor, 0.55), 0, 1);
  const positiveRawHeights = positiveAdjustments.map((item) => {
    const proportionalHeight = safeNumber(item.valueBn) * scale;
    const liftedHeight =
      proportionalHeight < positiveVisibilityLiftTarget
        ? proportionalHeight + (positiveVisibilityLiftTarget - proportionalHeight) * positiveVisibilityLiftFactor
        : proportionalHeight;
    return Math.max(liftedHeight, positiveMinVisibleHeight);
  });
  const positiveMergeHeights = positiveAdjustments.map((item) => Math.max(safeNumber(item.valueBn) * scale, 0));
  const positiveHeightBudget = Math.max(netHeight - 4, 0);
  const positiveRawHeightTotal = positiveRawHeights.reduce((sum, height) => sum + height, 0);
  const positiveHeightScale =
    positiveRawHeights.length && positiveRawHeightTotal > positiveHeightBudget && positiveHeightBudget > 0
      ? positiveHeightBudget / positiveRawHeightTotal
      : 1;
  let positiveHeights = positiveRawHeights.map((height) =>
    Math.max(height * positiveHeightScale, positiveHeightScale < 0.999 ? positiveCollapsedMinHeight : positiveMinVisibleHeight)
  );
  const positiveDisplayHeightTotal = positiveHeights.reduce((sum, height) => sum + height, 0);
  if (positiveDisplayHeightTotal > positiveHeightBudget && positiveHeightBudget > 0) {
    const overflowScale = positiveHeightBudget / positiveDisplayHeightTotal;
    positiveHeights = positiveHeights.map((height) => height * overflowScale);
  }
  const totalPositiveHeight = positiveHeights.reduce((sum, height) => sum + height, 0);
  const totalPositiveMergeHeight = positiveMergeHeights.reduce((sum, height) => sum + height, 0);
  const explicitBelowOperatingBn = belowOperatingItems.reduce((sum, item) => sum + Math.max(safeNumber(item.valueBn), 0), 0);
  const explicitCoreNetHeight = Math.max((operatingProfitBn - explicitBelowOperatingBn) * scale, 0);
  const zeroNetRibbonHeight =
    nearZeroNet && !netLoss && operatingProfitBn > 0
      ? Math.min(scaleY(safeNumber(snapshot.layout?.zeroNetRibbonHeight, 4.5)), opHeight)
      : 0;
  const sourceCoreNetHeightBase = belowOperatingItems.length ? clamp(explicitCoreNetHeight, 0, opHeight) : opHeight;
  const sourceCoreNetHeight = nearZeroNet && !netLoss ? Math.max(sourceCoreNetHeightBase, zeroNetRibbonHeight) : sourceCoreNetHeightBase;
  const minCoreNetHeight = positiveAdjustments.length || belowOperatingItems.length ? 0 : Math.min(4, opHeight);
  const coreNetHeight = clamp(sourceCoreNetHeight, minCoreNetHeight, opHeight);
  const residualNetTargetHeight = positiveAdjustments.length ? Math.max(netHeight - totalPositiveMergeHeight, 0) : netHeight;
  const implicitPositiveNetBridgeBn =
    !positiveAdjustments.length && !belowOperatingItems.length
      ? Math.max(netProfitBn - operatingProfitBn, 0)
      : 0;
  const implicitPositiveNetBridgeMaxBn = Math.max(
    safeNumber(snapshot.layout?.implicitPositiveNetBridgeMaxBn, 0.06),
    0
  );
  const useImplicitPositiveNetExpansion =
    implicitPositiveNetBridgeBn > 0.002 && implicitPositiveNetBridgeBn <= implicitPositiveNetBridgeMaxBn;
  const coreNetTargetHeight = useImplicitPositiveNetExpansion
    ? netHeight
    : clamp(Math.min(coreNetHeight, residualNetTargetHeight), 0, netHeight);
  const deductionTop = opTop + coreNetHeight;
  const deductionBottom = opBottom;
  const revenueNodeFill = revenueNode;
  const revenueTextColor = "#111111";
  const revenueLabelCenterX = revenueX + nodeWidth / 2 + safeNumber(snapshot.layout?.revenueLabelOffsetX, 0);
  const revenueLabelCenterY = revenueTop + revenueHeight / 2 + layoutY(snapshot.layout?.revenueLabelOffsetY, -8);
  const revenueLabelTitleSize = safeNumber(snapshot.layout?.revenueLabelTitleSize, 32);
  const revenueLabelValueSize = safeNumber(snapshot.layout?.revenueLabelValueSize, 58);
  const revenueLabelNoteSize = safeNumber(snapshot.layout?.revenueLabelNoteSize, 22);
  const revenueLabelQoqSize = safeNumber(snapshot.layout?.revenueLabelQoqSize, 20);
  const expenseSummaryTitleSize = 41;
  const costLabelLines = snapshot.costLabelLines?.length
    ? localizeChartLines(snapshot.costLabelLines)
    : wrapLabelWithMaxWidth(localizeChartPhrase(snapshot.costLabel || "Cost of revenue"), expenseSummaryTitleSize, currentChartLanguage() === "zh" ? 280 : 360, {
        maxLines: 2,
      });
  const resolvedOperatingExpensesLabel =
    collapsedOpexItem
      ? currentChartLanguage() === "zh"
        ? collapsedOpexItem.nameZh || translateBusinessLabelToZh(collapsedOpexItem.name || "")
        : collapsedOpexItem.name || snapshot.operatingExpensesLabel || "Operating Expenses"
      : snapshot.operatingExpensesLabel || "Operating Expenses";
  const operatingExpenseLabelLines = !collapsedOpexItem && snapshot.operatingExpensesLabelLines?.length
    ? localizeChartLines(snapshot.operatingExpensesLabelLines)
    : wrapLabelWithMaxWidth(localizeChartPhrase(resolvedOperatingExpensesLabel), expenseSummaryTitleSize, currentChartLanguage() === "zh" ? 296 : 392, {
        maxLines: 2,
      });
  const revenueSourceSlices = stackValueSlices(sources, revenueTop, scale, { targetBottom: revenueBottom, valueKey: "flowValueBn" });
  const sourceMetricRequirementUnits = revenueSourceSlices.map((slice) =>
    sourceMetricBlockHeight(slice.item, {
      density: slice.item.layoutDensity || sourceDensity,
      compactMode: compactSources || slice.item.compactLabel,
      showQoq,
    })
  );
  const maxSourceMetricRequirementUnits = sourceMetricRequirementUnits.length ? Math.max(...sourceMetricRequirementUnits) : 0;
  const avgSourceMetricRequirementUnits = sourceMetricRequirementUnits.length
    ? sourceMetricRequirementUnits.reduce((sum, value) => sum + value, 0) / sourceMetricRequirementUnits.length
    : 0;
  const metricDrivenSpreadUnits = sourceHasMetrics
    ? clamp(
        Math.max(avgSourceMetricRequirementUnits - (compactSources ? 38 : 34), 0) * 0.8 +
          Math.max(maxSourceMetricRequirementUnits - (compactSources ? 52 : 48), 0) * 0.44 +
          Math.max(sources.length - 4, 0) * 3.4 +
          (showQoq ? 8 : 3),
        0,
        compactSources ? 48 : 68
      )
    : 0;
  const sourceNodeGap = layoutY(
    snapshot.layout?.sourceNodeGap,
    ultraDenseSources ? 4 : denseSources ? 8 : compactSources ? 14 : usesHeroLockups ? 50 : 28
  ) + sourceMetricGapBoost + scaleY(metricDrivenSpreadUnits * 0.2);
  const sourceFanEntries = revenueSourceSlices.map((slice, index) => ({
    center: slice.center + layoutY(snapshot.layout?.sourceNodeOffsets?.[index], 0),
    height: slice.height,
    top: slice.top,
    bottom: slice.bottom,
  }));
  const sourceFanBaseOptions = snapshot.layout?.sourceFan || {};
  const sourceFanOptions = resolveAdaptiveSourceFan(sourceFanEntries, {
    spread: safeNumber(sourceFanBaseOptions.spread, compactSources ? 1.1 : 1.12) + (sourceHasMetrics ? clamp(metricDrivenSpreadUnits / 260, 0, 0.18) : 0),
    exponent: safeNumber(sourceFanBaseOptions.exponent, 1.22),
    edgeBoost: safeNumber(sourceFanBaseOptions.edgeBoost, compactSources ? 18 : 24) + metricDrivenSpreadUnits * 0.62,
    edgeExponent: safeNumber(sourceFanBaseOptions.edgeExponent, 1.15),
    bandBias: safeNumber(sourceFanBaseOptions.bandBias, compactSources ? 0.06 : 0.08),
    sideBoost: safeNumber(sourceFanBaseOptions.sideBoost, compactSources ? 14 : 18) + metricDrivenSpreadUnits * 0.42,
    sideExponent: safeNumber(sourceFanBaseOptions.sideExponent, 1.08),
    rangeBoost: safeNumber(sourceFanBaseOptions.rangeBoost, compactSources ? 10 : 12) + metricDrivenSpreadUnits + (sourceHasMetrics ? (showQoq ? 24 : 14) : 0),
    anchorOffset: layoutY(sourceFanBaseOptions.anchorOffset, 0),
  });
  const sourceRangeBoost = scaleY(sourceFanOptions.rangeBoost);
  const sourceMetricHeadroomBoost = scaleY(
    sourceHasMetrics
      ? clamp(metricDrivenSpreadUnits * 0.82 + (showQoq ? 14 : 8), 0, compactSources ? 52 : 72)
      : 0
  );
  const sourceMetricFootroomBoost = scaleY(
    sourceHasMetrics
      ? clamp(metricDrivenSpreadUnits * 0.52 + (sources.length >= 6 ? 10 : 4), 0, compactSources ? 34 : 48)
      : 0
  );
  const sourceNodeMinY = clamp(
    layoutY(snapshot.layout?.sourceNodeMinY, baseRevenueTop - 8) - sourceRangeBoost - sourceMetricHeadroomBoost,
    scaleY(160),
    scaleY(520)
  );
  const sourceNodeMaxY = clamp(
    layoutY(snapshot.layout?.sourceNodeMaxY, ultraDenseSources ? 1136 : denseSources ? 1108 : 1058) + sourceRangeBoost + sourceMetricFootroomBoost,
    scaleY(820),
    scaleY(1128)
  );
  const sourceFanAnchor = (revenueTop + revenueBottom) / 2 + sourceFanOptions.anchorOffset;
  const sourcePreferredCenters = spreadSourceCenters(sourceFanEntries, sourceFanAnchor, {
    spread: sourceFanOptions.spread,
    exponent: sourceFanOptions.exponent,
    edgeBoost: scaleY(sourceFanOptions.edgeBoost),
    edgeExponent: sourceFanOptions.edgeExponent,
    bandBias: sourceFanOptions.bandBias,
    sideBoost: scaleY(sourceFanOptions.sideBoost),
    sideExponent: sourceFanOptions.sideExponent,
  });
  const sourceMetricRequirements = sourceMetricRequirementUnits.map((value) => scaleY(value));
  const sourceNodeBoxes = resolveVerticalBoxesVariableGap(
    revenueSourceSlices.map((slice, index) => ({
      center: sourcePreferredCenters[index],
      height: slice.height,
      gapAbove: sourceMetricRequirements[index],
    })),
    sourceNodeMinY,
    sourceNodeMaxY,
    sourceNodeGap
  );
  const sourceSlices = revenueSourceSlices.map((slice, index) => {
    const box = sourceNodeBoxes[index];
    return {
      ...slice,
      revenueTop: slice.top,
      revenueBottom: slice.bottom,
      top: box.top,
      bottom: box.top + slice.height,
      center: box.top + slice.height / 2,
    };
  });
  const sourceSliceMap = new Map(sourceSlices.map((slice) => [slice.item.id || slice.item.name, slice]));
  const leftDetailSlices = [];
  const isAdFunnelDetailLayout = snapshot.prototypeKey === "ad-funnel-bridge";
  const leftDetailTargetKeys = new Set(
    leftDetailGroups
      .map((item) => normalizeLabelKey(item.targetId || item.targetName || item.target || item.groupName))
      .filter(Boolean)
  );
  const autoStackRegularSourcesBelowDetails = shouldStackRegularSourcesBelowDetails(
    snapshot,
    leftDetailTargetKeys,
    sourceSlices.map((slice) => slice.item)
  );
  const leftDetailX = shiftCanvasX(snapshot.layout?.leftDetailX, 156);
  const leftDetailWidth = safeNumber(snapshot.layout?.leftDetailWidth, sourceNodeWidth);
  if (leftDetailGroups.length) {
    const targetGroups = new Map();
    leftDetailGroups.forEach((item) => {
      const key = item.targetId || item.targetName || item.target || item.groupName;
      if (!key) return;
      const list = targetGroups.get(key) || [];
      list.push(item);
      targetGroups.set(key, list);
    });
    targetGroups.forEach((items, key) => {
      const targetSlice = sourceSliceMap.get(key) || sourceSlices.find((slice) => slice.item.name === key);
      if (!targetSlice) return;
      const totalValue = items.reduce((sum, item) => sum + safeNumber(item.valueBn), 0);
      const detailScale = totalValue > 0 ? targetSlice.height / totalValue : 0;
      let cursor = targetSlice.top;
      const groupSlices = [];
      items.forEach((item, index) => {
        const top = cursor;
        const height = Math.max(safeNumber(item.valueBn) * detailScale, 3);
        const rawBottom = index === items.length - 1 ? targetSlice.bottom : top + height;
        const bottom = Math.max(rawBottom, top + 1);
        const groupCenterIndex = (items.length - 1) / 2;
        const groupPosition = index - groupCenterIndex;
        const groupNorm = items.length <= 1 ? 0 : Math.abs(groupPosition) / Math.max(groupCenterIndex, 1);
        groupSlices.push({
          item,
          targetSlice,
          top,
          bottom,
          height: bottom - top,
          center: top + (bottom - top) / 2,
          groupIndex: index,
          groupCount: items.length,
          groupPosition,
          groupNorm,
        });
        cursor = bottom;
      });
      const groupCenterIndex = (groupSlices.length - 1) / 2;
      const groupStackHeight = groupSlices.reduce((sum, slice) => sum + slice.height, 0);
      const groupLaunchGapY = scaleY(safeNumber(snapshot.layout?.leftDetailLaunchGapY, 14));
      const groupLaunchSpan = Math.max(
        targetSlice.height * safeNumber(snapshot.layout?.leftDetailLaunchTargetHeightRatio, 0.36),
        groupStackHeight * safeNumber(snapshot.layout?.leftDetailLaunchStackHeightRatio, 0.62),
        scaleY(safeNumber(snapshot.layout?.leftDetailLaunchMinSpanY, 54))
      );
      const launchStepY = groupSlices.length <= 1 ? 0 : groupLaunchSpan / Math.max(groupCenterIndex, 1);
      groupSlices.forEach((slice, index) => {
        const groupPosition = index - groupCenterIndex;
        const groupNorm = groupSlices.length <= 1 ? 0 : Math.abs(groupPosition) / Math.max(groupCenterIndex, 1);
        const launchOffsetY =
          groupPosition * launchStepY +
          Math.sign(groupPosition || 0) * groupNorm * groupLaunchGapY +
          Math.sign(groupPosition || 0) * slice.height * safeNumber(snapshot.layout?.leftDetailLaunchThicknessRatio, 0.14);
        slice.groupIndex = index;
        slice.groupCount = groupSlices.length;
        slice.groupPosition = groupPosition;
        slice.groupNorm = groupNorm;
        slice.launchCenter = targetSlice.center + launchOffsetY;
      });
      groupSlices.forEach((groupSlice) => leftDetailSlices.push(groupSlice));
    });
  }
  const leftDetailMetricRequirementUnits = leftDetailSlices.map((slice) =>
    sourceMetricBlockHeight(slice.item, {
      density: slice.item.layoutDensity || sourceDensity,
      compactMode: compactSources || slice.item.compactLabel,
      showQoq,
    })
  );
  const leftDetailHasMetrics = leftDetailSlices.some(
    (slice) => slice.item?.yoyPct !== null && slice.item?.yoyPct !== undefined || (showQoq && slice.item?.qoqPct !== null && slice.item?.qoqPct !== undefined)
  );
  const maxLeftDetailMetricRequirementUnits = leftDetailMetricRequirementUnits.length ? Math.max(...leftDetailMetricRequirementUnits) : 0;
  const avgLeftDetailMetricRequirementUnits = leftDetailMetricRequirementUnits.length
    ? leftDetailMetricRequirementUnits.reduce((sum, value) => sum + value, 0) / leftDetailMetricRequirementUnits.length
    : 0;
  const leftDetailMetricDrivenSpreadUnits = leftDetailHasMetrics
    ? clamp(
        Math.max(avgLeftDetailMetricRequirementUnits - (compactSources ? 38 : 34), 0) * 0.8 +
          Math.max(maxLeftDetailMetricRequirementUnits - (compactSources ? 52 : 48), 0) * 0.44 +
          Math.max(leftDetailSlices.length - 4, 0) * 3.4 +
          (showQoq ? 8 : 3),
        0,
        compactSources ? 48 : 68
      )
    : 0;
  const leftDetailFanBaseOptions = snapshot.layout?.leftDetailFan || snapshot.layout?.sourceFan || {};
  const leftDetailFanEntries = leftDetailSlices.map((slice, index) => ({
    center:
      safeNumber(slice.launchCenter, slice.center) +
      layoutY(snapshot.layout?.leftDetailNodeOffsets?.[index], 0) +
      (slice.groupCount > 1
        ? Math.sign(safeNumber(slice.groupPosition, 0)) *
          scaleY(
            clamp(
              safeNumber(snapshot.layout?.leftDetailConvergeBaseY, 12) +
                slice.groupNorm * safeNumber(snapshot.layout?.leftDetailConvergeSpreadY, 26) +
                clamp(slice.targetSlice.height * safeNumber(snapshot.layout?.leftDetailConvergeHeightRatio, 0.08), 0, 18),
              safeNumber(snapshot.layout?.leftDetailConvergeMinY, 8),
              safeNumber(snapshot.layout?.leftDetailConvergeMaxY, 42)
            )
          )
        : 0),
    height: slice.height,
    top: slice.top,
    bottom: slice.bottom,
  }));
  const leftDetailFanOptions = resolveAdaptiveSourceFan(leftDetailFanEntries, {
    spread: safeNumber(leftDetailFanBaseOptions.spread, compactSources ? 1.1 : 1.12) + (leftDetailHasMetrics ? clamp(leftDetailMetricDrivenSpreadUnits / 260, 0, 0.18) : 0),
    exponent: safeNumber(leftDetailFanBaseOptions.exponent, 1.22),
    edgeBoost: safeNumber(leftDetailFanBaseOptions.edgeBoost, compactSources ? 18 : 24) + leftDetailMetricDrivenSpreadUnits * 0.62,
    edgeExponent: safeNumber(leftDetailFanBaseOptions.edgeExponent, 1.15),
    bandBias: safeNumber(leftDetailFanBaseOptions.bandBias, compactSources ? 0.06 : 0.08),
    sideBoost: safeNumber(leftDetailFanBaseOptions.sideBoost, compactSources ? 14 : 18) + leftDetailMetricDrivenSpreadUnits * 0.42,
    sideExponent: safeNumber(leftDetailFanBaseOptions.sideExponent, 1.08),
    rangeBoost: safeNumber(leftDetailFanBaseOptions.rangeBoost, compactSources ? 10 : 12) + leftDetailMetricDrivenSpreadUnits + (leftDetailHasMetrics ? (showQoq ? 24 : 14) : 0),
    anchorOffset: layoutY(leftDetailFanBaseOptions.anchorOffset, 0),
  });
  const leftDetailRangeBoost = scaleY(leftDetailFanOptions.rangeBoost);
  const leftDetailMetricHeadroomBoost = scaleY(
    leftDetailHasMetrics
      ? clamp(leftDetailMetricDrivenSpreadUnits * 0.82 + (showQoq ? 14 : 8), 0, compactSources ? 52 : 72)
      : 0
  );
  const leftDetailMetricFootroomBoost = scaleY(
    leftDetailHasMetrics
      ? clamp(leftDetailMetricDrivenSpreadUnits * 0.52 + (leftDetailSlices.length >= 6 ? 10 : 4), 0, compactSources ? 34 : 48)
      : 0
  );
  const leftDetailDesiredTop = leftDetailFanEntries.length
    ? Math.min(...leftDetailFanEntries.map((entry) => entry.center - entry.height / 2))
    : layoutY(snapshot.layout?.leftDetailMinY, isAdFunnelDetailLayout ? 224 : 246);
  const leftDetailDesiredBottom = leftDetailFanEntries.length
    ? Math.max(...leftDetailFanEntries.map((entry) => entry.center + entry.height / 2))
    : layoutY(snapshot.layout?.leftDetailMaxY, isAdFunnelDetailLayout ? 1042 : 1026);
  const leftDetailNodeMinY = clamp(
    Math.min(
      layoutY(snapshot.layout?.leftDetailMinY, isAdFunnelDetailLayout ? 224 : 246) - leftDetailRangeBoost - leftDetailMetricHeadroomBoost,
      leftDetailDesiredTop - scaleY(safeNumber(snapshot.layout?.leftDetailLaunchTopPaddingY, 20))
    ),
    scaleY(safeNumber(snapshot.layout?.leftDetailAbsoluteMinY, 96)),
    scaleY(520)
  );
  const leftDetailNodeMaxY = clamp(
    Math.max(
      layoutY(snapshot.layout?.leftDetailMaxY, isAdFunnelDetailLayout ? 1042 : 1026) + leftDetailRangeBoost + leftDetailMetricFootroomBoost,
      leftDetailDesiredBottom + scaleY(safeNumber(snapshot.layout?.leftDetailLaunchBottomPaddingY, 24))
    ),
    scaleY(820),
    scaleY(1160)
  );
  const leftDetailAnchor = leftDetailSlices.length
    ? leftDetailSlices.reduce((sum, slice) => sum + safeNumber(slice.launchCenter, slice.targetSlice.center), 0) / leftDetailSlices.length +
      leftDetailFanOptions.anchorOffset
    : scaleY(520);
  const leftDetailPreferredCenters = leftDetailFanEntries.map((entry, index) => {
    const baseCenter = safeNumber(entry.center, leftDetailAnchor);
    const slice = leftDetailSlices[index];
    if (!slice || slice.groupCount <= 1) return baseCenter;
    const direction = Math.sign(safeNumber(slice.groupPosition, 0));
    const groupBiasY = scaleY(
      clamp(
        safeNumber(snapshot.layout?.leftDetailGroupBiasY, 10) +
          safeNumber(slice.groupNorm, 0) * safeNumber(snapshot.layout?.leftDetailGroupBiasSpreadY, 12),
        safeNumber(snapshot.layout?.leftDetailGroupBiasMinY, 6),
        safeNumber(snapshot.layout?.leftDetailGroupBiasMaxY, 22)
      )
    );
    return baseCenter + direction * groupBiasY;
  });
  const leftDetailMetricRequirements = leftDetailMetricRequirementUnits.map((value) => scaleY(value));
  const leftDetailNodeGap = layoutY(snapshot.layout?.leftDetailNodeGap, sourceNodeGap) + scaleY(leftDetailMetricDrivenSpreadUnits * 0.2);
  const leftDetailNodeBoxes = resolveVerticalBoxesVariableGap(
    leftDetailSlices.map((slice, index) => ({
      center: leftDetailPreferredCenters[index],
      height: slice.height,
      gapAbove: leftDetailMetricRequirements[index],
    })),
    leftDetailNodeMinY,
    leftDetailNodeMaxY,
    leftDetailNodeGap
  );
  const leftDetailRenderSlices = leftDetailSlices.map((slice, index) => {
    const nodeBox = leftDetailNodeBoxes[index];
    return {
      ...slice,
      targetTop: slice.top,
      targetBottom: slice.bottom,
      targetHeight: slice.height,
      targetCenter: slice.center,
      top: nodeBox.top,
      bottom: nodeBox.bottom,
      height: slice.height,
      center: nodeBox.center,
    };
  });
  const leftDetailLabelBoxes = resolveVerticalBoxes(
    leftDetailRenderSlices.map((slice) => ({
      center: slice.center,
      height: estimateReplicaSourceBoxHeight(slice.item, showQoq, compactSources || slice.item.compactLabel),
    })),
    leftDetailNodeMinY,
    leftDetailNodeMaxY,
    scaleY(safeNumber(snapshot.layout?.leftDetailGap, sourceNodeGap))
  );
  const leftBoxGap = scaleY(ultraDenseSources ? 4 : denseSources ? 8 : compactSources ? 12 : 24) + sourceMetricGapBoost * 0.45;
  const sourceLayoutIndexes = [];
  const microSourceIndexes = [];
  sourceSlices.forEach((slice, index) => {
    if (slice.item.microSource) {
      microSourceIndexes.push(index);
      return;
    }
    sourceLayoutIndexes.push(index);
  });
  const layoutSourceSlices = sourceLayoutIndexes.map((index) => sourceSlices[index]);
  const sourceBoxEntries = layoutSourceSlices.map((slice) => ({
    center: slice.center,
    height: estimateReplicaSourceBoxHeight(slice.item, showQoq, compactSources || slice.item.compactLabel),
  }));
  let layoutBoxes;
  if (autoStackRegularSourcesBelowDetails && leftDetailTargetKeys.size && layoutSourceSlices.length) {
    layoutBoxes = new Array(layoutSourceSlices.length);
    const summaryIndexes = [];
    const regularIndexes = [];
    layoutSourceSlices.forEach((slice, index) => {
      const sourceKey = normalizeLabelKey(slice.item.id || slice.item.memberKey || slice.item.name);
      if (leftDetailTargetKeys.has(sourceKey)) {
        summaryIndexes.push(index);
      } else {
        regularIndexes.push(index);
      }
    });
    if (summaryIndexes.length) {
      const detailRegionBottom = leftDetailLabelBoxes.length ? Math.max(...leftDetailLabelBoxes.map((box) => box.bottom)) : scaleY(520);
      const summaryMaxY = Math.min(
        sourceNodeMaxY,
        Math.max(
          sourceNodeMinY + scaleY(safeNumber(snapshot.layout?.summarySourceMinSpan, 160)),
          detailRegionBottom - scaleY(safeNumber(snapshot.layout?.summarySourceMaxOffsetFromDetails, 20))
        )
      );
      const summaryBoxes = resolveVerticalBoxes(
        summaryIndexes.map((index) => sourceBoxEntries[index]),
        sourceNodeMinY,
        summaryMaxY,
        leftBoxGap
      );
      summaryIndexes.forEach((index, position) => {
        layoutBoxes[index] = summaryBoxes[position];
      });
      if (regularIndexes.length) {
        const regularMinY = Math.max(
          detailRegionBottom + scaleY(safeNumber(snapshot.layout?.regularSourceStartAfterDetails, 28)),
          scaleY(safeNumber(snapshot.layout?.regularSourceFloorY, 620))
        );
        const regularBoxes = resolveVerticalBoxes(
          regularIndexes.map((index) => sourceBoxEntries[index]),
          regularMinY,
          sourceNodeMaxY,
          leftBoxGap
        );
        regularIndexes.forEach((index, position) => {
          layoutBoxes[index] = regularBoxes[position];
        });
      }
    }
    if (layoutBoxes.filter(Boolean).length !== layoutSourceSlices.length) {
      layoutBoxes = resolveVerticalBoxes(sourceBoxEntries, sourceNodeMinY, sourceNodeMaxY, leftBoxGap);
    }
  } else {
    layoutBoxes = resolveVerticalBoxes(sourceBoxEntries, sourceNodeMinY, sourceNodeMaxY, leftBoxGap);
  }
  const leftBoxes = new Array(sourceSlices.length);
  sourceLayoutIndexes.forEach((sourceIndex, position) => {
    leftBoxes[sourceIndex] = layoutBoxes[position];
  });
  const microSourceBaseY = layoutY(snapshot.layout?.microSourceY, 1014);
  const microSourceStepY = scaleY(safeNumber(snapshot.layout?.microSourceStepY, 44));
  const microSourceHeight = scaleY(safeNumber(snapshot.layout?.microSourceHeight, 48));
  microSourceIndexes.forEach((sourceIndex, position) => {
    const top = microSourceBaseY + position * microSourceStepY;
    leftBoxes[sourceIndex] = {
      top,
      bottom: top + microSourceHeight,
      height: microSourceHeight,
      center: top + microSourceHeight / 2,
    };
  });
  const sourceSummaryLabelGapX = safeNumber(snapshot.layout?.sourceSummaryLabelGapX, sourceTemplateLabelGapX);
  sourceSlices.forEach((slice) => {
    slice.nodeX = leftX;
    slice.labelX = usesPreDetailRevenueLayout ? leftX - sourceSummaryLabelGapX : sourceTemplateLabelX;
    slice.metricX = sourceTemplateMetricX;
  });
  if (autoStackRegularSourcesBelowDetails && leftDetailTargetKeys.size && layoutSourceSlices.length) {
    const leadEligibleSourceIndexes = new Set(
      collectPreDetailLeadEligibleSourceIndexes(
        leftDetailTargetKeys,
        sourceSlices.map((slice) => slice.item)
      )
    );
    const regularLeadIndexes = sourceLayoutIndexes
      .filter((sourceIndex) => leadEligibleSourceIndexes.has(sourceIndex))
      .sort((leftIndex, rightIndex) => {
        const leftCenter = safeNumber(leftBoxes[leftIndex]?.center, sourceSlices[leftIndex]?.center);
        const rightCenter = safeNumber(leftBoxes[rightIndex]?.center, sourceSlices[rightIndex]?.center);
        return leftCenter - rightCenter;
      });
    const detailRightX = leftDetailX + leftDetailWidth;
    regularLeadIndexes.forEach((sourceIndex, orderIndex) => {
      const slice = sourceSlices[sourceIndex];
      const leadDistanceX = resolvePreDetailRegularSourceLeadDistance(snapshot, {
        regularCount: regularLeadIndexes.length,
        orderIndex,
        leftX,
        detailRightX,
      });
      const nodeX = leftX - leadDistanceX;
      slice.nodeX = nodeX;
      slice.labelX = nodeX - sourceSummaryLabelGapX;
      slice.metricX = sourceTemplateMetricX + (nodeX - leftX);
    });
  }
  const deductionSlices = stackValueSlices(belowOperatingItems, deductionTop, scale, { minHeight: 4, targetBottom: deductionBottom });
  const deductionBand = prototypeBandConfig(templateTokens, "deductions");
  const deductionDensity = deductionSlices.length >= 3 ? "dense" : "regular";
  const deductionEntries = deductionSlices.map((slice, index) => {
    const layout = replicaTreeBlockLayout(slice.item, {
      density: deductionDensity,
      titleMaxWidth: rightTerminalTitleMaxWidth,
      noteMaxWidth: rightTerminalTitleMaxWidth,
    });
    return {
      center: slice.center + index * scaleY(safeNumber(deductionBand.centerStep, 18)),
      height: Math.max(layout.totalHeight + safeNumber(deductionBand.heightOffset, -8), 24),
      minHeight: layout.minHeight,
      layout,
    };
  });
  const deductionMinYBase = Math.max(
    netBottom + scaleY(safeNumber(deductionBand.minOffsetFromNet, 28)),
    scaleY(safeNumber(deductionBand.minClamp, 420))
  );
  const rawDeductionMaxYBase = Math.max(
    opexTop - scaleY(safeNumber(deductionBand.maxOffsetAboveOpex, 44)),
    scaleY(safeNumber(deductionBand.maxClamp, 680))
  );
  const deductionBoxOptions = {
    gap: scaleY(safeNumber(deductionBand.gap, 24)),
    minGap: scaleY(safeNumber(deductionBand.minGap, 10)),
    fallbackMinHeight: 34,
  };
  const opexSlices = stackValueSlices(opexItems, opexTop, scale, { minHeight: 12, targetBottom: opexBottom });
  const opexBand = prototypeBandConfig(templateTokens, "opex", opexItems.length);
  const opexDensity = opexBand.densityKey === "dense" ? "dense" : "regular";
  const opexMinY = scaleY(safeNumber(opexBand.minY, opexItems.length >= 5 ? 680 : 700));
  const rightBandBottomPaddingBase = scaleY(safeNumber(snapshot.layout?.rightBandBottomPadding, 122));
  const rightBandBottomReleaseY =
    lowerRightPressureY *
    safeNumber(
      snapshot.layout?.rightBandBottomReleaseFactor,
      costBreakdownNearOpexColumn ? 1.08 : rawCostBreakdown.length >= 2 ? 0.72 : 0.34
    );
  const rightBandBottomPadding = Math.max(
    rightBandBottomPaddingBase - rightBandBottomReleaseY,
    scaleY(safeNumber(snapshot.layout?.rightBandMinBottomPadding, 34))
  );
  const opexBoxOptions = {
    gap: scaleY(safeNumber(opexBand.gap, opexItems.length >= 5 ? 18 : 28)),
    minGap: scaleY(safeNumber(opexBand.minGap, opexItems.length >= 5 ? 4 : 10)),
    fallbackMinHeight: opexDensity === "dense" ? 30 : 36,
  };
  const opexEntries = opexSlices.map((slice, index) => {
    const layout = replicaTreeBlockLayout(slice.item, {
      density: opexDensity,
      titleMaxWidth: rightTerminalTitleMaxWidth,
      noteMaxWidth: rightTerminalTitleMaxWidth,
    });
    return {
      center:
        scaleY(safeNumber(opexBand.centerStart, opexItems.length >= 5 ? 710 : 736)) +
        index * scaleY(safeNumber(opexBand.centerStep, opexItems.length >= 5 ? 102 : 126)),
      height: Math.max(layout.totalHeight + safeNumber(opexBand.heightOffset, 0), 24),
      minHeight: layout.minHeight,
      layout,
    };
  });
  const opexRequiredSpanY = estimatedStackSpan(
    opexEntries.map((entry) => entry.height),
    opexBoxOptions.gap
  );
  const opexMaxY = clamp(
    Math.max(
      scaleY(safeNumber(opexBand.maxY, opexItems.length >= 5 ? 982 : 1028)),
      opexMinY + opexRequiredSpanY + scaleY(safeNumber(snapshot.layout?.opexSelfBottomBufferY, 68)),
      opexBottom + scaleY(safeNumber(snapshot.layout?.rightBandMinExtensionFromSourceY, 112))
    ),
    opexMinY + scaleY(120),
    height - rightBandBottomPadding
  );
  const opexBottomAnchorCenter = opexEntries.length
    ? clamp(
        scaleY(
          safeNumber(
            snapshot.layout?.opexBottomAnchorCenter,
            safeNumber(
              opexBand.bottomAnchorCenter,
              safeNumber(opexBand.centerStart, opexItems.length >= 5 ? 710 : 736) +
                Math.max(opexEntries.length - 1, 0) * safeNumber(opexBand.centerStep, opexItems.length >= 5 ? 102 : 126)
            )
          )
        ),
        opexMinY + opexEntries[opexEntries.length - 1].height / 2,
        opexMaxY - opexEntries[opexEntries.length - 1].height / 2
      )
    : opexMaxY;
  let opexBoxes =
    opexEntries.length >= 2
      ? resolveAnchoredBandBoxes(opexEntries, opexMinY, opexMaxY, {
          ...opexBoxOptions,
          spreadExponent: safeNumber(snapshot.layout?.opexSpreadExponent, opexEntries.length >= 4 ? 1.16 : 1.12),
          topAnchorCenter: opexEntries[0]?.center,
          bottomAnchorCenter: opexBottomAnchorCenter,
        })
      : resolveReplicaBandBoxes(opexEntries, opexMinY, opexMaxY, opexBoxOptions);
  let opexObstacleTop = opexBoxes.length ? Math.min(...opexBoxes.map((box) => box.top)) : Infinity;
  const deductionToOpexClearance = scaleY(safeNumber(snapshot.layout?.deductionToOpexClearance, 54));
  let deductionMaxYBase = Math.max(
    deductionMinYBase,
    Math.min(rawDeductionMaxYBase, opexObstacleTop - deductionToOpexClearance)
  );
  const costBreakdownSlices = stackValueSlices(costBreakdown, costTop, scale, { minHeight: 8, targetBottom: costBottom });
  const costBreakdownBand = prototypeBandConfig(templateTokens, "costBreakdown");
  const costBreakdownSourceAnchored = costBreakdownSlices.length > 0 && costBreakdownSlices.length <= 3;
  const costBreakdownCenterBaseShiftY = scaleY(
    safeNumber(snapshot.layout?.costBreakdownCenterBaseShiftY, costBreakdownSlices.length <= 1 ? 18 : 26)
  );
  const costBreakdownCenterStepY = scaleY(
    safeNumber(snapshot.layout?.costBreakdownCenterStepY, costBreakdownSlices.length === 2 ? 72 : 68)
  );
  const costBreakdownHeightBias = safeNumber(snapshot.layout?.costBreakdownHeightBias, 0.09);
  const costBreakdownBottomReleaseY =
    lowerRightPressureY *
    safeNumber(
      snapshot.layout?.costBreakdownLowerRightBottomReleaseFactor,
      costBreakdownNearOpexColumn ? 1.18 : rawCostBreakdown.length >= 2 ? 0.62 : 0.24
    );
  const costBreakdownBottomPadY = Math.max(
    rightBandBottomPadding - costBreakdownBottomReleaseY,
    scaleY(safeNumber(snapshot.layout?.costBreakdownMinBottomPadY, costBreakdownNearOpexColumn ? 26 : 34))
  );
  const costBreakdownEntries = costBreakdownSlices.map((slice, index) => {
    const layout = replicaTreeBlockLayout(slice.item, {
      density: costBreakdownSlices.length >= 3 ? "dense" : "regular",
      titleMaxWidth: costTerminalTitleMaxWidth,
      noteMaxWidth: costTerminalTitleMaxWidth,
    });
    const fixedCenter =
      scaleY(safeNumber(costBreakdownBand.centerStart, 816)) +
      index * scaleY(safeNumber(costBreakdownBand.centerStep, 118));
    const sourceAnchoredCenter =
      slice.center +
      costBreakdownCenterBaseShiftY +
      index * costBreakdownCenterStepY +
      Math.min(slice.height * costBreakdownHeightBias, scaleY(26));
    return {
      center: costBreakdownSourceAnchored ? sourceAnchoredCenter : fixedCenter,
      height: Math.max(layout.totalHeight + safeNumber(costBreakdownBand.heightOffset, 0), 24),
      minHeight: layout.minHeight,
      layout,
    };
  });
  const costBreakdownRequiredSpanY = estimatedStackSpan(
    costBreakdownEntries.map((entry) => entry.height),
    scaleY(safeNumber(costBreakdownBand.gap, 24))
  );
  let costBreakdownMaxY = clamp(
    Math.max(
      scaleY(safeNumber(costBreakdownBand.maxY, 1002)),
      scaleY(safeNumber(costBreakdownBand.minY, 744)) + costBreakdownRequiredSpanY + scaleY(safeNumber(snapshot.layout?.costBreakdownSelfBottomBufferY, 78))
    ),
    scaleY(safeNumber(costBreakdownBand.minY, 744)) + scaleY(90),
    height - costBreakdownBottomPadY
  );
  const costBreakdownBoxes = resolveReplicaBandBoxes(
    costBreakdownEntries,
    scaleY(safeNumber(costBreakdownBand.minY, 744)),
    costBreakdownMaxY,
    {
      gap: scaleY(safeNumber(costBreakdownBand.gap, 24)),
      minGap: scaleY(safeNumber(costBreakdownBand.minGap, 10)),
      fallbackMinHeight: 34,
    }
  );
  const positiveGap = scaleY(safeNumber(snapshot.layout?.positiveGapY, 18));
  const positiveLabelBlockHeight = scaleY(safeNumber(snapshot.layout?.positiveLabelBlockHeight, 82));
  const positiveNodeGap = scaleY(safeNumber(snapshot.layout?.positiveNodeGap, 26));
  const positiveFloatPadding = scaleY(safeNumber(snapshot.layout?.positiveFloatPadding, 18));
  const positiveDeductionClearance = scaleY(safeNumber(snapshot.layout?.positiveDeductionClearance, 20));
  const positiveTaxDropY = scaleY(safeNumber(snapshot.layout?.positiveTaxDropY, 38));
  const positiveTaxSourceDropY = scaleY(safeNumber(snapshot.layout?.positiveTaxSourceDropY, 24));
  const positiveTaxCorridorExtraY = scaleY(safeNumber(snapshot.layout?.positiveTaxCorridorExtraY, 24));
  const positivePlacementMetricNoteSize = safeNumber(snapshot.layout?.profitMetricNoteSize, 18);
  const positivePlacementMetricNoteLineHeight = Math.max(
    safeNumber(snapshot.layout?.profitMetricNoteLineHeight, currentChartLanguage() === "zh" ? 22 : 23),
    positivePlacementMetricNoteSize + (currentChartLanguage() === "zh" ? 4 : 5)
  );
  const metricClusterObstacleRectEstimate = (centerX, y, title, value, subline, deltaLine, layout, padding = scaleY(10)) => {
    const localizedTitle = localizeChartPhrase(title);
    const localizedSubline = subline ? localizeChartPhrase(subline) : "";
    const widths = [
      approximateTextWidth(localizedTitle, layout.titleSize),
      approximateTextWidth(value, layout.valueSize),
      localizedSubline ? approximateTextWidth(localizedSubline, layout.subSize) : 0,
      deltaLine ? approximateTextWidth(deltaLine, layout.subSize) : 0,
    ];
    const blockWidth = Math.max(...widths, 1);
    const blockBottomBaseline = y + (deltaLine ? layout.deltaOffset : subline ? layout.subOffset : layout.valueOffset);
    const blockBottomSize = deltaLine || subline ? layout.subSize : layout.valueSize;
    return {
      left: centerX - blockWidth / 2 - padding,
      right: centerX + blockWidth / 2 + padding,
      top: y - layout.titleSize - padding,
      bottom: blockBottomBaseline + blockBottomSize * 0.42 + padding,
    };
  };
  const grossMetricPlacementLayout = resolveReplicaMetricClusterLayout(
    grossTop,
    snapshot.grossMarginYoyDeltaPp !== null && snapshot.grossMarginYoyDeltaPp !== undefined,
    {
      compactThreshold: scaleY(352),
      noteLineHeight: positivePlacementMetricNoteLineHeight,
    }
  );
  const operatingMetricPlacementLayout = resolveReplicaMetricClusterLayout(
    opTop,
    snapshot.operatingMarginYoyDeltaPp !== null && snapshot.operatingMarginYoyDeltaPp !== undefined,
    {
      compactThreshold: scaleY(352),
      noteLineHeight: positivePlacementMetricNoteLineHeight,
    }
  );
  const grossMetricPlacementY = clamp(
    layoutY(
      snapshot.layout?.grossMetricY,
      (grossTop - scaleY(grossMetricPlacementLayout.preferredClearance)) / Math.max(verticalScale, 0.0001)
    ),
    scaleY(grossMetricPlacementLayout.minTop),
    grossTop - scaleY(grossMetricPlacementLayout.bottomClearance)
  );
  const operatingMetricPlacementY = clamp(
    layoutY(
      snapshot.layout?.operatingMetricY,
      (opTop - scaleY(operatingMetricPlacementLayout.preferredClearance)) / Math.max(verticalScale, 0.0001)
    ),
    scaleY(operatingMetricPlacementLayout.minTop),
    opTop - scaleY(operatingMetricPlacementLayout.bottomClearance)
  );
  const grossMetricPlacementObstacle = metricClusterObstacleRectEstimate(
    grossX + nodeWidth / 2,
    grossMetricPlacementY,
    snapshot.grossProfitLabel || "Gross profit",
    formatBillions(grossProfitBn),
    snapshot.grossMarginPct !== null && snapshot.grossMarginPct !== undefined ? `${formatPct(snapshot.grossMarginPct)} ${marginLabel()}` : "",
    snapshot.grossMarginYoyDeltaPp !== null && snapshot.grossMarginYoyDeltaPp !== undefined ? formatPp(snapshot.grossMarginYoyDeltaPp) : "",
    grossMetricPlacementLayout
  );
  const operatingMetricPlacementObstacle = metricClusterObstacleRectEstimate(
    opX + nodeWidth / 2,
    operatingMetricPlacementY,
    snapshot.operatingProfitLabel || "Operating profit",
    formatBillions(operatingProfitBn),
    snapshot.operatingMarginPct !== null && snapshot.operatingMarginPct !== undefined ? `${formatPct(snapshot.operatingMarginPct)} ${marginLabel()}` : "",
    snapshot.operatingMarginYoyDeltaPp !== null && snapshot.operatingMarginYoyDeltaPp !== undefined ? formatPp(snapshot.operatingMarginYoyDeltaPp) : "",
    operatingMetricPlacementLayout
  );
  const positiveDecisionCorridorMinX = positiveAdjustments.length
    ? clamp(
        rightBaseX -
          Math.max(
            safeNumber(snapshot.layout?.positiveDecisionCorridorReachX, 236),
            (rightBaseX - (opX + nodeWidth)) * safeNumber(snapshot.layout?.positiveDecisionCorridorReachFactor, 0.52)
          ),
        opX + nodeWidth + scaleY(safeNumber(snapshot.layout?.positiveDecisionCorridorMinOffsetFromOpX, 44)),
        rightBaseX - scaleY(safeNumber(snapshot.layout?.positiveDecisionCorridorMinOffsetFromNetX, 48))
      )
    : rightBaseX;
  const positiveDecisionCorridorMaxX = positiveAdjustments.length
    ? Math.max(
        positiveDecisionCorridorMinX + scaleY(safeNumber(snapshot.layout?.positiveDecisionCorridorMinWidthX, 36)),
        rightBaseX - scaleY(safeNumber(snapshot.layout?.positiveDecisionCorridorTargetInsetX, 18))
      )
    : rightBaseX;
  const positiveDecisionSampleXs = positiveAdjustments.length
    ? [0, 0.25, 0.5, 0.75, 1].map((t) =>
        clamp(
          positiveDecisionCorridorMinX + (positiveDecisionCorridorMaxX - positiveDecisionCorridorMinX) * t,
          positiveDecisionCorridorMinX,
          positiveDecisionCorridorMaxX
        )
      )
    : [];
  const positiveUpperObstacleFloorEstimateAtX = (sampleX) => {
    let floor = 0;
    [grossMetricPlacementObstacle, operatingMetricPlacementObstacle].forEach((obstacle) => {
      if (!obstacle) return;
      if (sampleX >= obstacle.left && sampleX <= obstacle.right) {
        floor = Math.max(floor, obstacle.bottom);
      }
    });
    return floor;
  };
  const positiveUpperObstacleFloorEstimate = positiveDecisionSampleXs.length
    ? Math.max(...positiveDecisionSampleXs.map((sampleX) => positiveUpperObstacleFloorEstimateAtX(sampleX)), 0)
    : Math.max(grossMetricPlacementObstacle.bottom, operatingMetricPlacementObstacle.bottom);
  const deductionEntriesForPositiveState = (placePositiveAbove) =>
    deductionEntries.map((entry, index) =>
      index === 0 && positiveAdjustments.length && !placePositiveAbove
        ? {
            ...entry,
            center: entry.center + positiveTaxDropY,
          }
        : entry
    );
  const totalPositiveStackHeight = totalPositiveHeight + Math.max(0, positiveAdjustments.length - 1) * positiveGap;
  const positiveBelowTopMin = Math.max(netBottom + positiveNodeGap, scaleY(308));
  const positiveBelowTopMax = chartBottomLimit - totalPositiveStackHeight - positiveLabelBlockHeight - scaleY(12);
  const positiveBelowReservedHeight =
    totalPositiveStackHeight + positiveLabelBlockHeight + positiveFloatPadding + positiveDeductionClearance + positiveTaxCorridorExtraY;
  if (positiveAdjustments.length && opexBoxes.length) {
    const desiredOpexTop = positiveBelowTopMin + positiveBelowReservedHeight;
    const currentOpexTop = Math.min(...opexBoxes.map((box) => box.top));
    const opexBottomEdge = Math.max(...opexBoxes.map((box) => box.bottom));
    const shiftRoom = Math.max(opexMaxY - opexBottomEdge, 0);
    const shift = clamp(desiredOpexTop - currentOpexTop, 0, shiftRoom);
    if (shift > 0.5) {
      opexBoxes = opexBoxes.map((box) => ({
        ...box,
        top: box.top + shift,
        bottom: box.bottom + shift,
        center: box.center + shift,
      }));
      opexObstacleTop = Math.min(...opexBoxes.map((box) => box.top));
      deductionMaxYBase = Math.max(
        deductionMinYBase,
        Math.min(rawDeductionMaxYBase, opexObstacleTop - deductionToOpexClearance)
      );
    }
  }
  const deductionBelowMinY = Math.max(deductionMinYBase, positiveBelowTopMin + positiveBelowReservedHeight);
  const deductionBoxesBelowCandidate =
    deductionEntries.length >= 2
      ? resolveAnchoredBandBoxes(
          deductionEntriesForPositiveState(false),
          Math.min(deductionBelowMinY, Math.max(deductionMaxYBase - 1, deductionMinYBase)),
          deductionMaxYBase,
          {
            ...deductionBoxOptions,
            spreadExponent: safeNumber(snapshot.layout?.deductionSpreadExponent, deductionEntries.length >= 3 ? 1.14 : 1.1),
            topAnchorCenter: deductionEntries[0]?.center,
            bottomAnchorCenter: Math.min(
              deductionMaxYBase - (deductionEntries[deductionEntries.length - 1]?.height || 0) / 2,
              opexObstacleTop - deductionToOpexClearance - (deductionEntries[deductionEntries.length - 1]?.height || 0) / 2
            ),
          }
        )
      : resolveReplicaBandBoxes(
          deductionEntriesForPositiveState(false),
          Math.min(deductionBelowMinY, Math.max(deductionMaxYBase - 1, deductionMinYBase)),
          deductionMaxYBase,
          deductionBoxOptions
        );
  const highestDeductionBoxTopBelow = deductionBoxesBelowCandidate.length
    ? Math.min(...deductionBoxesBelowCandidate.map((box) => box.top))
    : Infinity;
  const highestRightObstacleTopBelow = Math.min(highestDeductionBoxTopBelow, opexObstacleTop);
  const belowPositiveClearance = highestRightObstacleTopBelow - (positiveBelowTopMin + totalPositiveStackHeight + positiveLabelBlockHeight);
  const belowPositiveFeasible = positiveAdjustments.length
    ? positiveBelowTopMax >= positiveBelowTopMin &&
      belowPositiveClearance >= positiveFloatPadding * 0.8
    : false;
  const abovePositiveCorridorHeight =
    netTop +
    totalPositiveHeight -
    (positiveUpperObstacleFloorEstimate +
      scaleY(safeNumber(snapshot.layout?.positiveAboveCorridorTopGapY, 10)) +
      scaleY(safeNumber(snapshot.layout?.positiveAboveCorridorBottomGapY, 14)));
  const abovePositiveRequiredHeight = totalPositiveStackHeight;
  const abovePositiveFeasible = positiveAdjustments.length ? abovePositiveCorridorHeight >= abovePositiveRequiredHeight : false;
  const belowPositiveSlack = positiveAdjustments.length ? belowPositiveClearance - positiveFloatPadding * 0.8 : -Infinity;
  const abovePositiveSlack = positiveAdjustments.length ? abovePositiveCorridorHeight - abovePositiveRequiredHeight : -Infinity;
  const belowPositiveComfortable = positiveAdjustments.length
    ? belowPositiveClearance >= Math.max(scaleY(36), positiveFloatPadding * 1.35, totalPositiveStackHeight * 1.2)
    : false;
  const positivePreferredMergeDeltaY = positiveAdjustments.length
    ? Math.max(
        scaleY(safeNumber(snapshot.layout?.positivePreferredMergeDeltaY, 38)),
        positiveFloatPadding * safeNumber(snapshot.layout?.positivePreferredMergeDeltaPaddingFactor, 2.1),
        totalPositiveHeight * safeNumber(snapshot.layout?.positivePreferredMergeDeltaHeightFactor, 1.75)
      )
    : 0;
  const belowPositiveVisibleDelta = positiveAdjustments.length
    ? positiveBelowTopMax + totalPositiveStackHeight / 2 - (netBottom - totalPositiveHeight / 2)
    : -Infinity;
  const belowPositiveVisuallyClear = positiveAdjustments.length
    ? positiveBelowTopMax >= positiveBelowTopMin && belowPositiveVisibleDelta >= positivePreferredMergeDeltaY
    : false;
  const positiveAbove = positiveAdjustments.length
    ? abovePositiveFeasible &&
      (!belowPositiveFeasible ||
        !belowPositiveComfortable ||
        !belowPositiveVisuallyClear ||
        abovePositiveSlack + scaleY(8) >= belowPositiveSlack)
    : false;
  const positiveBelowLabelAbove =
    positiveAdjustments.length && !positiveAbove && belowPositiveClearance < positiveFloatPadding * 1.45;
  const resolveDeductionBoxes = (entries, minY, maxY) =>
    entries.length >= 2
      ? resolveAnchoredBandBoxes(entries, minY, maxY, {
          ...deductionBoxOptions,
          spreadExponent: safeNumber(snapshot.layout?.deductionSpreadExponent, entries.length >= 3 ? 1.14 : 1.1),
          topAnchorCenter: entries[0]?.center,
          bottomAnchorCenter: Math.min(
            maxY - (entries[entries.length - 1]?.height || 0) / 2,
            opexObstacleTop - deductionToOpexClearance - (entries[entries.length - 1]?.height || 0) / 2
          ),
        })
      : resolveReplicaBandBoxes(entries, minY, maxY, deductionBoxOptions);
  let deductionBoxes =
    positiveAdjustments.length && !positiveAbove
      ? deductionBoxesBelowCandidate
      : resolveDeductionBoxes(deductionEntriesForPositiveState(true), deductionMinYBase, deductionMaxYBase);
  const positiveNetTextAllowanceX = safeNumber(snapshot.layout?.positiveNetTextAllowanceX, 170);
  const positiveNetExtensionMaxX = Math.max(
    Math.min(safeNumber(snapshot.layout?.positiveNetExtensionMaxX, 56), width - rightLabelXBase - positiveNetTextAllowanceX),
    0
  );
  const positiveNetExtensionX = positiveAdjustments.length
    ? clamp(safeNumber(snapshot.layout?.positiveNetExtensionX, positiveAbove ? 28 : 34), 0, positiveNetExtensionMaxX)
    : 0;
  const netX = rightBaseX;
  const rightTerminalNodeX = netX;
  const rightLabelX = rightLabelXBase;
  const rightPrimaryLabelGapX = safeNumber(snapshot.layout?.rightPrimaryLabelGapX, rightBranchLabelGapX);
  const netSummaryLines = [
    {
      text: localizeChartPhrase(resolvedNetOutcomeLabel(snapshot)),
      size: 37,
      weight: 700,
      color: netLoss ? redText : greenText,
      strokeWidth: 8,
      gapAfter: 9,
    },
    {
      text: formatNetOutcomeBillions(snapshot),
      size: 31,
      weight: 700,
      color: netLoss ? redText : greenText,
      strokeWidth: 8,
      gapAfter: snapshot.netMarginPct !== null && snapshot.netMarginPct !== undefined ? 11 : 0,
    },
  ];
  if (snapshot.netMarginPct !== null && snapshot.netMarginPct !== undefined) {
    netSummaryLines.push({
      text: `${formatPct(snapshot.netMarginPct)} ${marginLabel()}`,
      size: 18,
      weight: 400,
      color: muted,
      strokeWidth: 6,
      gapAfter: snapshot.netMarginYoyDeltaPp !== null && snapshot.netMarginYoyDeltaPp !== undefined ? 8 : 0,
    });
  }
  if (snapshot.netMarginYoyDeltaPp !== null && snapshot.netMarginYoyDeltaPp !== undefined) {
    netSummaryLines.push({
      text: formatPp(snapshot.netMarginYoyDeltaPp),
      size: 18,
      weight: 400,
      color: muted,
      strokeWidth: 6,
      gapAfter: 0,
    });
  }
  const netSummaryBlockHeight = netSummaryLines.reduce(
    (sum, line, index) => sum + line.size + (index < netSummaryLines.length - 1 ? line.gapAfter : 0),
    0
  );
  const netSummaryCenterY = netTop + netHeight / 2;
  const netSummaryTop = netSummaryCenterY - netSummaryBlockHeight / 2;
  const netSummaryBottom = netSummaryCenterY + netSummaryBlockHeight / 2;
  const rightTerminalCompressionPressure = clamp(
    Math.max(rawCostBreakdown.length + opexItems.length + belowOperatingItems.length - 4, 0) * 0.15 +
      clamp(lowerRightPressureY / scaleY(92), 0, 1) * 0.32 +
      (costBreakdownNearOpexColumn ? 0.22 : 0),
    0,
    0.82
  );
  const rightTerminalSummaryClearance = scaleY(
    safeNumber(
      snapshot.layout?.rightTerminalSummaryClearanceResolvedY,
      Math.max(
        safeNumber(snapshot.layout?.rightTerminalSummaryClearanceMinY, 8),
        safeNumber(snapshot.layout?.rightTerminalSummaryClearanceY, 20) -
          safeNumber(snapshot.layout?.rightTerminalSummaryClearanceCompressionY, 14) * rightTerminalCompressionPressure
      )
    )
  );
  const rightTerminalSummaryObstacleBottom = netSummaryBottom + rightTerminalSummaryClearance;
  const branchSourceGapY = scaleY(safeNumber(snapshot.layout?.branchSourceGapY, 16));
  const branchSourceMinThickness = scaleY(safeNumber(snapshot.layout?.branchSourceMinThickness, 8));
  const netPositiveTop = positiveAdjustments.length ? (positiveAbove ? netTop : netTop + coreNetTargetHeight) : netBottom;
  const netCoreTop = positiveAdjustments.length && positiveAbove ? netTop + totalPositiveMergeHeight : netTop;
  const netCoreBottom = netCoreTop + coreNetTargetHeight;
  const revenueGrossSourceBand = {
    top: revenueTop,
    bottom: revenueGrossBottom,
    height: Math.max(revenueGrossBottom - revenueTop, 1),
    center: revenueTop + Math.max(revenueGrossBottom - revenueTop, 1) / 2,
  };
  const revenueCostSourceBand = showCostBridge
    ? {
        top: revenueCostTop,
        bottom: revenueBottom,
        height: Math.max(revenueBottom - revenueCostTop, 1),
        center: revenueCostTop + Math.max(revenueBottom - revenueCostTop, 1) / 2,
      }
    : null;
  const grossProfitSourceBand = {
    top: grossTop,
    bottom: grossTop + opHeight,
    height: Math.max(opHeight, 1),
    center: grossTop + Math.max(opHeight, 1) / 2,
  };
  const grossExpenseSourceBand = {
    top: grossTop + opHeight,
    bottom: grossBottom,
    height: Math.max(grossBottom - (grossTop + opHeight), 1),
    center: grossTop + opHeight + Math.max(grossBottom - (grossTop + opHeight), 1) / 2,
  };
  const opexInboundTargetBand = resolveConservedTargetBand(grossExpenseSourceBand, opexTop, opexBottom, {
    align: snapshot.layout?.opexInboundTargetBandAlign || "top",
  });
  const opNetSourceBand = {
    top: opTop,
    bottom: opTop + coreNetHeight,
    height: Math.max(coreNetHeight, 1),
    center: opTop + Math.max(coreNetHeight, 1) / 2,
  };
  const opDeductionSourceBand = {
    top: deductionTop,
    bottom: deductionBottom,
    height: Math.max(deductionBottom - deductionTop, 1),
    center: deductionTop + Math.max(deductionBottom - deductionTop, 1) / 2,
  };
  let deductionSourceSlices = fitSlicesToBand(
    deductionSlices.map((slice) => ({ ...slice })),
    opDeductionSourceBand.top,
    opDeductionSourceBand.bottom,
    {
      minHeight: scaleY(safeNumber(snapshot.layout?.deductionSourceMinHeight, 4)),
    }
  );
  const costBreakdownSourceMinHeight = scaleY(
    safeNumber(snapshot.layout?.costBreakdownSourceMinHeight, Math.max(branchSourceMinThickness, costBreakdownSlices.length === 2 ? 10 : 8))
  );
  let costBreakdownSourceSlices =
    costBreakdownSlices.length > 1
      ? fitSlicesToBand(
          costBreakdownSlices.map((slice) => ({ ...slice })),
          costTop,
          costBottom,
          {
            minHeight: costBreakdownSourceMinHeight,
          }
        )
      : costBreakdownSlices.map((slice) => ({ ...slice }));
  let opexSourceSlices = opexSlices.map((slice) => ({ ...slice }));
  const shiftBoxCenter = (box, nextCenter) => {
    const delta = nextCenter - safeNumber(box?.center, nextCenter);
    if (!(Math.abs(delta) > 0.01)) return box;
    return {
      ...box,
      top: box.top + delta,
      bottom: box.bottom + delta,
      center: nextCenter,
    };
  };
  const shiftBoxSetBy = (boxes, deltaY) => {
    if (!(Math.abs(deltaY) > 0.01) || !Array.isArray(boxes)) return 0;
    boxes.forEach((box, index) => {
      if (!box) return;
      boxes[index] = shiftBoxCenter(box, box.center + deltaY);
    });
    return deltaY;
  };
  const shiftSliceSetBy = (slices, deltaY) => {
    if (!(Math.abs(deltaY) > 0.01) || !Array.isArray(slices)) return 0;
    slices.forEach((slice, index) => {
      if (!slice) return;
      slices[index] = {
        ...slice,
        top: safeNumber(slice.top, 0) + deltaY,
        bottom: safeNumber(slice.bottom, 0) + deltaY,
        center: safeNumber(slice.center, 0) + deltaY,
      };
    });
    return deltaY;
  };
  if (deductionSourceSlices.length) {
    const leadNegativeSourceHeight = Math.max(safeNumber(deductionSourceSlices[0]?.height, 0), 0);
    const primaryNegativeSourceGapY = Math.max(
      scaleY(
        safeNumber(
          snapshot.layout?.primaryNegativeSourceGapY,
          clamp(
            Math.max(
              leadNegativeSourceHeight * 0.42,
              branchSourceGapY * (positiveAdjustments.length && positiveAbove ? 0.78 : 0.68)
            ),
            10,
            positiveAdjustments.length && positiveAbove ? 24 : 22
          )
        )
      ),
      0
    );
    const currentLeadSourceGapY = Math.max(
      safeNumber(deductionSourceSlices[0]?.top, opDeductionSourceBand.top) - opDeductionSourceBand.top,
      0
    );
    const availableLeadSourceShiftY = Math.max(
      opDeductionSourceBand.bottom - safeNumber(deductionSourceSlices[deductionSourceSlices.length - 1]?.bottom, opDeductionSourceBand.bottom),
      0
    );
    const desiredLeadSourceShiftY = Math.max(primaryNegativeSourceGapY - currentLeadSourceGapY, 0);
    const appliedLeadSourceShiftY = Math.min(desiredLeadSourceShiftY, availableLeadSourceShiftY);
    if (appliedLeadSourceShiftY > 0.5) {
      shiftSliceSetBy(deductionSourceSlices, appliedLeadSourceShiftY);
    }
  }
  const resolveTerminalPackingHeight = (nodeHeight, collisionHeight, options = {}) => {
    const baseHeight = Math.max(safeNumber(nodeHeight, 0), 1);
    const resolvedCollisionHeight = Math.max(safeNumber(collisionHeight, baseHeight), baseHeight);
    const maxExtraY = scaleY(safeNumber(options.maxExtraY, 52));
    return Math.max(baseHeight, Math.min(resolvedCollisionHeight, baseHeight + maxExtraY));
  };
  const enforceMinimumCenterGap = (boxes, slices, desiredGapY, minTop, maxBottom, collisionHeights = null) => {
    if (!Array.isArray(boxes) || boxes.length !== 2 || !Array.isArray(slices) || slices.length !== 2) return;
    const upperBox = boxes[0];
    const lowerBox = boxes[1];
    if (!upperBox || !lowerBox) return;
    const upperSlice = slices[0];
    const lowerSlice = slices[1];
    const upperEffectiveHeight = Math.max(
      safeNumber(upperSlice?.height, 0),
      safeNumber(upperBox?.height, 0),
      Array.isArray(collisionHeights) ? safeNumber(collisionHeights[0], 0) : 0,
      10
    );
    const lowerEffectiveHeight = Math.max(
      safeNumber(lowerSlice?.height, 0),
      safeNumber(lowerBox?.height, 0),
      Array.isArray(collisionHeights) ? safeNumber(collisionHeights[1], 0) : 0,
      10
    );
    const requiredCenterDelta =
      (upperEffectiveHeight + lowerEffectiveHeight) / 2 + Math.max(desiredGapY, 0);
    const currentCenterDelta = safeNumber(lowerBox?.center, 0) - safeNumber(upperBox?.center, 0);
    if (currentCenterDelta >= requiredCenterDelta) return;
    let remainingDelta = requiredCenterDelta - currentCenterDelta;
    const lowerMaxCenter = maxBottom - lowerEffectiveHeight / 2;
    const lowerShiftY = Math.min(Math.max(lowerMaxCenter - lowerBox.center, 0), remainingDelta);
    if (lowerShiftY > 0.01) {
      boxes[1] = shiftBoxCenter(lowerBox, lowerBox.center + lowerShiftY);
      remainingDelta -= lowerShiftY;
    }
    if (remainingDelta > 0.01) {
      const nextUpperBox = boxes[0];
      const upperMinCenter = minTop + upperEffectiveHeight / 2;
      const upperShiftY = Math.min(Math.max(nextUpperBox.center - upperMinCenter, 0), remainingDelta);
      if (upperShiftY > 0.01) {
        boxes[0] = shiftBoxCenter(nextUpperBox, nextUpperBox.center - upperShiftY);
      }
    }
  };
  const expenseDownwardBranchCenter = (slice, index, count, options = {}) => {
    const indexNorm = count <= 1 ? 0 : index / Math.max(count - 1, 1);
    const baseShiftY = scaleY(safeNumber(options.baseShiftY, 14));
    const stepY = scaleY(safeNumber(options.stepY, 28));
    const fanBoostY = scaleY(safeNumber(options.fanBoostY, 18));
    const sparseBranchBoostY = scaleY(safeNumber(options.sparseBranchBoostY, count <= 1 ? 28 : count === 2 ? 14 : 0));
    const heightBias = safeNumber(options.heightBias, 0.03);
    const maxHeightBiasY = scaleY(safeNumber(options.maxHeightBiasY, 14));
    const heightShiftY = Math.min(Math.max(safeNumber(slice?.height, 0) * heightBias, 0), maxHeightBiasY) * indexNorm;
    return safeNumber(slice?.center, 0) + baseShiftY + sparseBranchBoostY + index * stepY + indexNorm * fanBoostY + heightShiftY;
  };
  const costBreakdownOpexSummaryLayout = resolveReplicaMetricClusterLayout(opTop, false, {
    compactThreshold: scaleY(352),
    noteLineHeight: positivePlacementMetricNoteLineHeight,
    noteSize: positivePlacementMetricNoteSize,
  });
  const costBreakdownSharesOpexColumn = costBreakdownNearOpexColumn;
  const costBreakdownSharedLaneCrowdingStrength = costBreakdownSharesOpexColumn
    ? clamp(
        Math.max(costBreakdownSlices.length + opexItems.length + deductionSlices.length - 4, 0) * 0.16 +
          clamp(lowerRightPressureY / scaleY(92), 0, 1) * 0.36 +
          (costBreakdownSlices.length === 2 ? 0.14 : 0),
        0,
        0.84
      )
    : 0;
  const baseCostBreakdownOpexSummaryGapY = safeNumber(
    snapshot.layout?.opexSummaryGapY,
    36 + Math.max(operatingExpenseLabelLines.length - 1, 0) * 10 + (opexItems.length >= 3 ? 8 : 0)
  );
  const costBreakdownOpexSummaryGapY = safeNumber(
    snapshot.layout?.costBreakdownOpexSummaryGapResolvedY,
    Math.max(
      safeNumber(snapshot.layout?.costBreakdownOpexSummaryGapMinY, 12),
      baseCostBreakdownOpexSummaryGapY -
        safeNumber(snapshot.layout?.costBreakdownOpexSummaryGapCompressionY, 30) * costBreakdownSharedLaneCrowdingStrength
    )
  );
  const costBreakdownOpexSummaryTopY =
    opexBottom + scaleY(costBreakdownOpexSummaryGapY) + costBreakdownOpexSummaryLayout.titleSize * 0.82;
  const costBreakdownOpexSummaryTitleLineHeight = costBreakdownOpexSummaryLayout.titleSize + 1;
  const costBreakdownOpexSummaryValueText = formatBillionsByMode(operatingExpensesBn, "negative-parentheses");
  const costBreakdownOpexSummaryRatioText = revenueBn > 0 ? `${formatPct((operatingExpensesBn / revenueBn) * 100)} ${ofRevenueLabel()}` : "";
  const costBreakdownOpexSummaryMaxTextWidth = Math.max(
    approximateTextBlockWidth(operatingExpenseLabelLines, costBreakdownOpexSummaryLayout.titleSize),
    approximateTextWidth(costBreakdownOpexSummaryValueText, costBreakdownOpexSummaryLayout.valueSize),
    costBreakdownOpexSummaryRatioText
      ? approximateTextWidth(costBreakdownOpexSummaryRatioText, costBreakdownOpexSummaryLayout.subSize)
      : 0,
    1
  );
  const costBreakdownOpexSummaryBottom =
    costBreakdownOpexSummaryTopY +
    (operatingExpenseLabelLines.length - 1) * costBreakdownOpexSummaryTitleLineHeight +
    (costBreakdownOpexSummaryRatioText
      ? costBreakdownOpexSummaryLayout.subOffset + costBreakdownOpexSummaryLayout.subSize * 0.42
      : costBreakdownOpexSummaryLayout.valueOffset + costBreakdownOpexSummaryLayout.valueSize * 0.42);
  const costBreakdownOpexAvoidanceY = scaleY(
    safeNumber(
      snapshot.layout?.costBreakdownOpexAvoidanceResolvedY,
      Math.max(
        safeNumber(snapshot.layout?.costBreakdownOpexAvoidanceMinY, 8),
        safeNumber(snapshot.layout?.costBreakdownOpexAvoidanceY, 24) -
          safeNumber(snapshot.layout?.costBreakdownOpexAvoidanceCompressionY, 16) * costBreakdownSharedLaneCrowdingStrength
      )
    )
  );
  const costBreakdownLabelGapX = safeNumber(snapshot.layout?.costBreakdownLabelGapX, 12);
  const costBreakdownLabelSafeX = costBreakdownX + nodeWidth + costBreakdownLabelGapX;
  const costBreakdownLabelSpecs = costBreakdownSlices.map((slice) =>
    resolveRightBranchLabelSpec(slice.item, costBreakdownX, nodeWidth, {
      density: costBreakdownSlices.length >= 3 ? "dense" : "regular",
      defaultMode: "negative-parentheses",
      labelX: costBreakdownLabelSafeX,
    })
  );
  const costBreakdownNodeHeights = costBreakdownSlices.map((slice) => Math.max(safeNumber(slice?.height, 0), 12));
  const costBreakdownPackingHeights = costBreakdownSlices.map((slice, index) =>
    resolveTerminalPackingHeight(costBreakdownNodeHeights[index], costBreakdownLabelSpecs[index]?.collisionHeight, {
      maxExtraY: costBreakdownSlices.length === 2 ? (costBreakdownNearOpexColumn ? 44 : 52) : 40,
    })
  );
  const costBreakdownBarrierHeights = costBreakdownSlices.map((slice, index) =>
    resolveTerminalPackingHeight(costBreakdownNodeHeights[index], costBreakdownLabelSpecs[index]?.collisionHeight, {
      maxExtraY: costBreakdownSlices.length === 2 ? (costBreakdownNearOpexColumn ? 52 : 80) : 64,
    })
  );
  const costBreakdownGapHeights = costBreakdownSlices.map((slice, index) =>
    costBreakdownSlices.length === 2
      ? Math.max(
          costBreakdownNodeHeights[index],
          Math.min(
            safeNumber(costBreakdownPackingHeights[index], costBreakdownNodeHeights[index]),
            costBreakdownNodeHeights[index] +
              scaleY(
                safeNumber(
                  snapshot.layout?.costBreakdownGapHeightExtraCapY,
                  costBreakdownSharesOpexColumn ? 72 : 60
                )
              )
          )
        )
      : costBreakdownNodeHeights[index]
  );
  const costBreakdownTerminalTopBarrierY = costBreakdownSharesOpexColumn
    ? costBreakdownOpexSummaryBottom + costBreakdownOpexAvoidanceY
    : -Infinity;
  const desiredCostBreakdownNodeGapY = scaleY(
    safeNumber(
      snapshot.layout?.costBreakdownNodeGapY,
      costBreakdownSlices.length >= 3 ? 20 : costBreakdownSlices.length === 2 ? (costBreakdownSharesOpexColumn ? 52 : 54) : 38
    )
  );
  const costBreakdownTerminalGap = scaleY(
    safeNumber(
      snapshot.layout?.costBreakdownTerminalGapY,
      costBreakdownSlices.length >= 3 ? 14 : costBreakdownSlices.length === 2 ? (costBreakdownSharesOpexColumn ? 52 : 44) : 22
    )
  );
  const costBreakdownTerminalTopFloor = Math.max(
    Math.max(costTop - scaleY(safeNumber(snapshot.layout?.costBreakdownTerminalTopPadY, 10)), scaleY(620)),
    costBreakdownTerminalTopBarrierY
  );
  const rightTerminalBottomPadding = scaleY(safeNumber(snapshot.layout?.rightTerminalBottomPadding, 18));
  const terminalLayoutBottomLimit = chartBottomLimit - rightTerminalBottomPadding;
  const costBreakdownSharedLaneBottomPadY = scaleY(
    safeNumber(snapshot.layout?.costBreakdownSharedLaneBottomPadY, costBreakdownSlices.length === 2 ? 6 : 12)
  );
  const costBreakdownBottomLimit = Math.max(
    chartBottomLimit -
      (costBreakdownSharesOpexColumn
        ? costBreakdownSharedLaneBottomPadY
        : scaleY(safeNumber(snapshot.layout?.costBreakdownTerminalBottomPadY, 24))),
    costBreakdownSharesOpexColumn ? -Infinity : terminalLayoutBottomLimit
  );
  const costBreakdownRequiredResolvedSpan =
    costBreakdownGapHeights.reduce((sum, heightValue) => sum + Math.max(heightValue, 0), 0) +
    Math.max(costBreakdownGapHeights.length - 1, 0) * Math.max(costBreakdownTerminalGap, desiredCostBreakdownNodeGapY);
  const costBreakdownBarrierAwareBottomBufferY = scaleY(
    safeNumber(
      snapshot.layout?.costBreakdownBarrierAwareBottomBufferY,
      costBreakdownSlices.length === 2 ? (costBreakdownSharesOpexColumn ? 34 : 24) : 18
    )
  );
  costBreakdownMaxY = clamp(
    Math.max(
      costBreakdownMaxY,
      costBreakdownTerminalTopFloor + costBreakdownRequiredResolvedSpan + costBreakdownBarrierAwareBottomBufferY
    ),
    costBreakdownTerminalTopFloor + scaleY(90),
    costBreakdownBottomLimit
  );
  if (costBreakdownSharesOpexColumn) {
    costBreakdownMaxY = Math.min(
      costBreakdownBottomLimit,
      costBreakdownMaxY + scaleY(safeNumber(snapshot.layout?.costBreakdownSharedLaneReleaseY, costBreakdownSlices.length === 2 ? 54 : 34))
    );
  }
  const baseSharedCostBreakdownMaxY = costBreakdownMaxY;
  const anchoredTerminalBottomCenter = clamp(
    terminalLayoutBottomLimit - scaleY(safeNumber(snapshot.layout?.rightTerminalBottomAnchorInsetY, 34)),
    netBottom + scaleY(safeNumber(snapshot.layout?.rightTerminalMinOffsetFromNet, 22)),
    terminalLayoutBottomLimit - scaleY(10)
  );
  const maxCollisionBasedGroupShiftDown = (boxes, collisionHeights, maxBottom) => {
    if (!Array.isArray(boxes) || !boxes.length || !Array.isArray(collisionHeights) || !collisionHeights.length) return 0;
    return boxes.reduce((minRoom, box, index) => {
      if (!box) return minRoom;
      const heightValue = Math.max(safeNumber(collisionHeights[index], box.height), 1);
      return Math.min(minRoom, maxBottom - heightValue / 2 - box.center);
    }, Infinity);
  };
  const maxActualBoxGroupShiftDown = (boxes, maxBottom) => {
    if (!Array.isArray(boxes) || !boxes.length) return 0;
    return boxes.reduce((minRoom, box) => {
      if (!box) return minRoom;
      return Math.min(minRoom, maxBottom - safeNumber(box.bottom, maxBottom));
    }, Infinity);
  };
  const costBreakdownCollisionTop = () =>
    costBreakdownBoxes.reduce((minTop, box, index) => {
      if (!box) return minTop;
      return Math.min(minTop, box.center - Math.max(safeNumber(costBreakdownBarrierHeights[index], box.height), 1) / 2);
    }, Infinity);
  const expandSharedCostBreakdownBottomCapacity = (requestedExtraShiftY) => {
    if (!(costBreakdownSharesOpexColumn && requestedExtraShiftY > 0.01)) return 0;
    const adaptiveBottomLimit = Math.max(
      costBreakdownBottomLimit,
      Math.min(
        height - scaleY(safeNumber(snapshot.layout?.costBreakdownSharedLaneCanvasBottomPadY, 42)),
        baseSharedCostBreakdownMaxY +
          scaleY(
            safeNumber(snapshot.layout?.costBreakdownSharedLaneAdaptiveReleaseCapY, costBreakdownSlices.length === 2 ? 24 : 18)
          )
      )
    );
    const availableReleaseY = Math.max(adaptiveBottomLimit - costBreakdownMaxY, 0);
    if (!(availableReleaseY > 0.01)) return 0;
    const appliedReleaseY = Math.min(availableReleaseY, requestedExtraShiftY);
    if (!(appliedReleaseY > 0.01)) return 0;
    costBreakdownMaxY += appliedReleaseY;
    return appliedReleaseY;
  };
  const shiftCostBreakdownGroupDown = (requestedShiftY) => {
    if (!(requestedShiftY > 0.01) || !costBreakdownBoxes.length) return 0;
    let availableShiftY = Math.max(
      maxCollisionBasedGroupShiftDown(costBreakdownBoxes, costBreakdownPackingHeights, costBreakdownMaxY),
      maxActualBoxGroupShiftDown(costBreakdownBoxes, costBreakdownMaxY)
    );
    if (requestedShiftY > availableShiftY + 0.01 && costBreakdownSharesOpexColumn) {
      expandSharedCostBreakdownBottomCapacity(
        requestedShiftY - availableShiftY + scaleY(safeNumber(snapshot.layout?.costBreakdownAdaptiveReleaseBufferY, 6))
      );
      availableShiftY = Math.max(
        maxCollisionBasedGroupShiftDown(costBreakdownBoxes, costBreakdownPackingHeights, costBreakdownMaxY),
        maxActualBoxGroupShiftDown(costBreakdownBoxes, costBreakdownMaxY)
      );
    }
    const appliedShiftY = Math.min(Math.max(availableShiftY, 0), requestedShiftY);
    if (!(appliedShiftY > 0.01)) return 0;
    shiftBoxSetBy(costBreakdownBoxes, appliedShiftY);
    clampCostBreakdownBoxesToBounds();
    return appliedShiftY;
  };
  const clampCostBreakdownBoxesToBounds = () => {
    costBreakdownBoxes.forEach((box, index) => {
      if (!box) return;
      const packingHeight = Math.max(safeNumber(costBreakdownPackingHeights[index], box.height), safeNumber(box.height, 0), 1);
      const barrierHeight = Math.max(safeNumber(costBreakdownBarrierHeights[index], packingHeight), packingHeight, 1);
      const minCenter = Math.max(
        costBreakdownTerminalTopFloor + packingHeight / 2,
        costBreakdownSharesOpexColumn ? costBreakdownTerminalTopBarrierY + barrierHeight / 2 : -Infinity
      );
      const maxCenter = costBreakdownMaxY - packingHeight / 2;
      if (!(maxCenter >= minCenter)) return;
      costBreakdownBoxes[index] = shiftBoxCenter(box, clamp(box.center, minCenter, maxCenter));
    });
  };
  const maintainCostBreakdownNodeGap = () => {
    clampCostBreakdownBoxesToBounds();
    if (costBreakdownBoxes.length !== 2) return;
    enforceMinimumCenterGap(
      costBreakdownBoxes,
      [costBreakdownSourceSlices[0] || costBreakdownSlices[0], costBreakdownSourceSlices[1] || costBreakdownSlices[1]],
      desiredCostBreakdownNodeGapY,
      costBreakdownTerminalTopFloor,
      costBreakdownMaxY,
      costBreakdownGapHeights
    );
    clampCostBreakdownBoxesToBounds();
  };
  if (costBreakdownSlices.length > 1) {
    const costBreakdownCurrentMinCenter = Math.min(
      ...costBreakdownSlices.map((slice, index) =>
        expenseDownwardBranchCenter(slice, index, costBreakdownSlices.length, {
          baseShiftY: safeNumber(snapshot.layout?.costBreakdownDownwardBaseShiftY, costBreakdownSlices.length === 2 ? 56 : 38),
          stepY: safeNumber(snapshot.layout?.costBreakdownDownwardStepY, costBreakdownSlices.length === 2 ? 168 : 108),
          fanBoostY: safeNumber(snapshot.layout?.costBreakdownDownwardFanBoostY, costBreakdownSlices.length === 2 ? 92 : 40),
          sparseBranchBoostY: safeNumber(snapshot.layout?.costBreakdownSparseBranchBoostY, costBreakdownSlices.length === 2 ? 32 : 0),
          heightBias: safeNumber(snapshot.layout?.costBreakdownDownwardHeightBias, 0.034),
          maxHeightBiasY: safeNumber(snapshot.layout?.costBreakdownDownwardMaxHeightBiasY, costBreakdownSlices.length === 2 ? 24 : 18),
        })
      )
    );
    const costBreakdownCurrentCenters = costBreakdownSlices.map((slice, index) =>
        expenseDownwardBranchCenter(slice, index, costBreakdownSlices.length, {
          baseShiftY: safeNumber(snapshot.layout?.costBreakdownDownwardBaseShiftY, costBreakdownSlices.length === 2 ? 56 : 38),
          stepY: safeNumber(snapshot.layout?.costBreakdownDownwardStepY, costBreakdownSlices.length === 2 ? 168 : 108),
          fanBoostY: safeNumber(snapshot.layout?.costBreakdownDownwardFanBoostY, costBreakdownSlices.length === 2 ? 92 : 40),
          sparseBranchBoostY: safeNumber(snapshot.layout?.costBreakdownSparseBranchBoostY, costBreakdownSlices.length === 2 ? 32 : 0),
          heightBias: safeNumber(snapshot.layout?.costBreakdownDownwardHeightBias, 0.034),
          maxHeightBiasY: safeNumber(snapshot.layout?.costBreakdownDownwardMaxHeightBiasY, costBreakdownSlices.length === 2 ? 24 : 18),
        })
      );
    const costBreakdownCurrentTop = Math.min(
      ...costBreakdownCurrentCenters.map((center, index) => center - (costBreakdownPackingHeights[index] || 0) / 2)
    );
    const costBreakdownCurrentBottom = Math.max(
      ...costBreakdownCurrentCenters.map((center, index) => center + (costBreakdownPackingHeights[index] || 0) / 2)
    );
    const costBreakdownAvailableSpan = Math.max(
      costBreakdownBottomLimit - costBreakdownTerminalTopFloor,
      1
    );
    const costBreakdownRequiredSpan =
      costBreakdownPackingHeights.reduce((sum, heightValue) => sum + Math.max(heightValue, 0), 0) +
      Math.max(costBreakdownPackingHeights.length - 1, 0) * costBreakdownTerminalGap;
    const costBreakdownSpreadStrength = clamp(
      safeNumber(
        snapshot.layout?.costBreakdownSpreadStrength,
        Math.max(costBreakdownRequiredSpan / costBreakdownAvailableSpan - 0.42, 0) * 0.9 +
          Math.max(costBreakdownSlices.length - 1, 0) * 0.12 +
          clamp(lowerRightPressureY / scaleY(92), 0, 1) * 0.34 +
          (costBreakdownSharesOpexColumn ? 0.14 : 0)
      ),
      0,
      0.78
    );
    const costBreakdownTopSlack = Math.max(costBreakdownCurrentTop - costBreakdownTerminalTopFloor, 0);
    const costBreakdownBottomSlack = Math.max(costBreakdownBottomLimit - costBreakdownCurrentBottom, 0);
    const costBreakdownTerminalBands = resolveAnchoredBandBoxes(
      costBreakdownSlices.map((slice, index) => {
        return {
          center: expenseDownwardBranchCenter(slice, index, costBreakdownSlices.length, {
            baseShiftY: safeNumber(snapshot.layout?.costBreakdownDownwardBaseShiftY, costBreakdownSlices.length === 2 ? 56 : 38),
            stepY: safeNumber(snapshot.layout?.costBreakdownDownwardStepY, costBreakdownSlices.length === 2 ? 168 : 108),
            fanBoostY: safeNumber(snapshot.layout?.costBreakdownDownwardFanBoostY, costBreakdownSlices.length === 2 ? 92 : 40),
            sparseBranchBoostY: safeNumber(snapshot.layout?.costBreakdownSparseBranchBoostY, costBreakdownSlices.length === 2 ? 32 : 0),
            heightBias: safeNumber(snapshot.layout?.costBreakdownDownwardHeightBias, 0.034),
            maxHeightBiasY: safeNumber(snapshot.layout?.costBreakdownDownwardMaxHeightBiasY, costBreakdownSlices.length === 2 ? 24 : 18),
          }),
          height: costBreakdownPackingHeights[index],
        };
      }),
      costBreakdownTerminalTopFloor,
      costBreakdownBottomLimit,
      {
        gap: costBreakdownTerminalGap,
        minGap: scaleY(10),
        bottomAnchorCenter: clamp(
          anchoredTerminalBottomCenter + costBreakdownBottomSlack * Math.min(costBreakdownSpreadStrength * 0.36 + 0.08, 0.42),
          costBreakdownTerminalTopFloor + (costBreakdownPackingHeights[costBreakdownPackingHeights.length - 1] || 0) / 2,
          costBreakdownBottomLimit - (costBreakdownPackingHeights[costBreakdownPackingHeights.length - 1] || 0) / 2
        ),
        topAnchorCenter: clamp(
          Math.max(costTop + scaleY(34), costBreakdownSlices[0]?.center ?? costTop) - costBreakdownTopSlack * costBreakdownSpreadStrength,
          costBreakdownTerminalTopFloor + (costBreakdownPackingHeights[0] || 0) / 2,
          costBreakdownBottomLimit - (costBreakdownPackingHeights[0] || 0) / 2
        ),
        spreadExponent: clamp(
          safeNumber(snapshot.layout?.costBreakdownSpreadExponent, 1.16) - costBreakdownSpreadStrength * 0.18,
          1.02,
          1.16
        ),
        fallbackMinHeight: 24,
      }
    );
    costBreakdownTerminalBands.forEach((band, index) => {
      const slice = costBreakdownSourceSlices[index] || costBreakdownSlices[index];
      const minDownwardShiftY = scaleY(
        safeNumber(
          snapshot.layout?.costBreakdownMinDownwardShiftY,
          costBreakdownSlices.length === 2
            ? index === 0
              ? Math.max(12, 42 - 34 * costBreakdownSharedLaneCrowdingStrength)
              : Math.max(104, 138 - 24 * costBreakdownSharedLaneCrowdingStrength)
            : index === 0
              ? 24
              : 52 + (index - 1) * 18
        )
      );
      const enforcedCenter = Math.max(band.center, safeNumber(slice?.center, band.center) + minDownwardShiftY);
      costBreakdownBoxes[index] = shiftBoxCenter(costBreakdownBoxes[index], enforcedCenter);
    });
    maintainCostBreakdownNodeGap();
  } else if (costBreakdownBoxes.length === 1 && costBreakdownTerminalTopBarrierY > 0) {
    const box = costBreakdownBoxes[0];
    const packingHeight = Math.max(safeNumber(costBreakdownPackingHeights[0], box.height), safeNumber(box.height, 0), 1);
    const barrierHeight = Math.max(safeNumber(costBreakdownBarrierHeights[0], packingHeight), packingHeight, 1);
    const minCenter = Math.max(costBreakdownTerminalTopFloor + packingHeight / 2, costBreakdownTerminalTopBarrierY + barrierHeight / 2);
    const maxCenter = costBreakdownMaxY - packingHeight / 2;
    costBreakdownBoxes[0] = shiftBoxCenter(box, clamp(Math.max(box.center, minCenter), minCenter, maxCenter));
  }
  clampCostBreakdownBoxesToBounds();
  const rightTerminalSeparationGap = scaleY(
    safeNumber(snapshot.layout?.rightTerminalSeparationGapY, positiveAdjustments.length && !positiveAbove ? 18 : 14)
  );
  const rightTerminalCrowdedUpwardLiftY = scaleY(safeNumber(snapshot.layout?.rightTerminalCrowdedUpwardLiftY, 0));
  const rightTerminalTopPackingStrength = clamp(safeNumber(snapshot.layout?.rightTerminalTopPackingStrength, 0), 0, 0.24);
  const rightTerminalTopPackingLiftY = scaleY(
    safeNumber(
      snapshot.layout?.rightTerminalTopPackingLiftY,
      20
    )
  ) * rightTerminalTopPackingStrength;
  const rightTerminalEntries = [];
  deductionBoxes.forEach((box, index) => {
    const slice = deductionSourceSlices[index] || deductionSlices[index];
    const minTargetHeight = deductionSlices[index]?.item?.name === "Other" ? 6 : 12;
    const labelSpec = resolveRightBranchLabelSpec(slice.item, rightTerminalNodeX, nodeWidth, {
      density: deductionSlices.length >= 3 ? "dense" : "regular",
      defaultMode: "negative-parentheses",
    });
    const packingHeight = resolveTerminalPackingHeight(
      Math.max(safeNumber(slice?.height, 0), minTargetHeight),
      labelSpec.collisionHeight,
      { maxExtraY: deductionSlices.length >= 3 ? 38 : 46 }
    );
    const deductionBaseCenter = expenseDownwardBranchCenter(slice, index, deductionBoxes.length, {
      baseShiftY: safeNumber(snapshot.layout?.deductionDownwardBaseShiftY, 24),
      stepY: safeNumber(snapshot.layout?.deductionDownwardStepY, 46),
      fanBoostY: safeNumber(snapshot.layout?.deductionDownwardFanBoostY, 30),
      sparseBranchBoostY: safeNumber(snapshot.layout?.deductionSparseBranchBoostY, 20),
      heightBias: safeNumber(snapshot.layout?.deductionDownwardHeightBias, 0.024),
      maxHeightBiasY: safeNumber(snapshot.layout?.deductionDownwardMaxHeightBiasY, 14),
    });
    const deductionLiftFactor =
      deductionBoxes.length <= 1 ? 1 : 1 - (index / Math.max(deductionBoxes.length - 1, 1)) * 0.32;
    rightTerminalEntries.push({
      lane: "deduction",
      index,
      center: Math.max(
        Math.min(box.center, deductionBaseCenter) - rightTerminalCrowdedUpwardLiftY * 0.74 * deductionLiftFactor,
        0
      ),
      height: packingHeight,
    });
  });
  opexBoxes.forEach((box, index) => {
    const slice = opexSourceSlices[index] || opexSlices[index];
    const labelSpec = resolveRightBranchLabelSpec(slice.item, rightTerminalNodeX, nodeWidth, {
      density: opexDensity,
      defaultMode: "negative-parentheses",
    });
    const packingHeight = resolveTerminalPackingHeight(
      Math.max(safeNumber(slice?.height, 0), 14),
      labelSpec.collisionHeight,
      { maxExtraY: opexDensity === "dense" ? 42 : 52 }
    );
    const opexBaseCenter = expenseDownwardBranchCenter(slice, index, opexBoxes.length, {
      baseShiftY: safeNumber(snapshot.layout?.opexDownwardBaseShiftY, 28),
      stepY: safeNumber(snapshot.layout?.opexDownwardStepY, 52),
      fanBoostY: safeNumber(snapshot.layout?.opexDownwardFanBoostY, 36),
      sparseBranchBoostY: safeNumber(snapshot.layout?.opexSparseBranchBoostY, 26),
      heightBias: safeNumber(snapshot.layout?.opexDownwardHeightBias, 0.026),
      maxHeightBiasY: safeNumber(snapshot.layout?.opexDownwardMaxHeightBiasY, 16),
    });
    const opexLiftFactor = opexBoxes.length <= 1 ? 1 : 1 - (index / Math.max(opexBoxes.length - 1, 1)) * 0.26;
    rightTerminalEntries.push({
      lane: "opex",
      index,
      center: Math.max(
        Math.min(box.center, opexBaseCenter) - rightTerminalCrowdedUpwardLiftY * 0.56 * opexLiftFactor,
        0
      ),
      height: packingHeight,
    });
  });
  if (rightTerminalEntries.length > 1) {
    if (rightTerminalTopPackingLiftY > 0.5) {
      const orderedPreferredEntries = [...rightTerminalEntries].sort((left, right) => left.center - right.center || left.index - right.index);
      const topPackingExponent = Math.max(safeNumber(snapshot.layout?.rightTerminalTopPackingExponent, 1.12), 0.72);
      orderedPreferredEntries.forEach((entry, orderIndex) => {
        const orderNorm = orderedPreferredEntries.length <= 1 ? 0 : orderIndex / Math.max(orderedPreferredEntries.length - 1, 1);
        const topBias = Math.pow(1 - orderNorm, topPackingExponent);
        const laneWeight = entry.lane === "deduction" ? 1 : entry.lane === "opex" ? 0.84 : 0.9;
        entry.center = Math.max(entry.center - rightTerminalTopPackingLiftY * topBias * laneWeight, 0);
      });
    }
    const currentTerminalTop = Math.min(...rightTerminalEntries.map((entry) => entry.center - entry.height / 2));
    const currentTerminalBottom = Math.max(...rightTerminalEntries.map((entry) => entry.center + entry.height / 2));
    const rightTerminalMinOffsetFromNetY = scaleY(
      safeNumber(
        snapshot.layout?.rightTerminalMinOffsetFromNetResolvedY,
        Math.max(
          safeNumber(snapshot.layout?.rightTerminalMinOffsetFromNetMinY, 8),
          safeNumber(snapshot.layout?.rightTerminalMinOffsetFromNet, positiveAdjustments.length && positiveAbove ? 16 : 22) -
            safeNumber(snapshot.layout?.rightTerminalMinOffsetFromNetCompressionY, 12) * rightTerminalCompressionPressure
        )
      )
    );
    const terminalMinY = Math.max(
      netBottom + rightTerminalMinOffsetFromNetY,
      rightTerminalSummaryObstacleBottom
    );
    const terminalMaxY = terminalLayoutBottomLimit;
    const orderedRightTerminalEntries = [...rightTerminalEntries].sort((left, right) => left.center - right.center || left.index - right.index);
    const firstRightTerminalHeight = Math.max(safeNumber(orderedRightTerminalEntries[0]?.height, 0), 1);
    const lastRightTerminalHeight = Math.max(
      safeNumber(orderedRightTerminalEntries[orderedRightTerminalEntries.length - 1]?.height, 0),
      1
    );
    const rightTerminalAvailableSpan = Math.max(terminalMaxY - terminalMinY, 1);
    const rightTerminalRequiredSpan =
      rightTerminalEntries.reduce((sum, entry) => sum + Math.max(safeNumber(entry.height, 0), 0), 0) +
      Math.max(rightTerminalEntries.length - 1, 0) * rightTerminalSeparationGap;
    const rightTerminalUtilization = rightTerminalRequiredSpan / rightTerminalAvailableSpan;
    const rightTerminalSpreadStrength = clamp(
      safeNumber(
        snapshot.layout?.rightTerminalSpreadStrength,
        Math.max(rightTerminalUtilization - 0.4, 0) * 0.78 +
          Math.max(rightTerminalEntries.length - 2, 0) * 0.06 +
          (costBreakdownSharesOpexColumn ? 0.08 : 0)
      ),
      0.08,
      0.72
    );
    const rightTerminalUniformLiftStrength = clamp(
      safeNumber(
        snapshot.layout?.rightTerminalUniformLiftStrength,
        Math.max(rightTerminalUtilization - 0.48, 0) * 0.92 +
          Math.max(rightTerminalEntries.length - 4, 0) * 0.08
      ),
      0,
      0.56
    );
    const rightTerminalSparseCompactionStrength = clamp(
      safeNumber(
        snapshot.layout?.rightTerminalSparseCompactionStrength,
        Math.max(safeNumber(snapshot.layout?.rightTerminalSparseCompactionActivationUtilization, 0.74) - rightTerminalUtilization, 0) *
          safeNumber(snapshot.layout?.rightTerminalSparseCompactionFactor, 1.18) +
          Math.max(rightTerminalEntries.length - 3, 0) * safeNumber(snapshot.layout?.rightTerminalSparseCompactionCountBoost, 0.08)
      ),
      0,
      0.82
    );
    const rightTerminalAnchorCompressionStrength = clamp(
      rightTerminalUniformLiftStrength +
        rightTerminalSparseCompactionStrength *
          safeNumber(snapshot.layout?.rightTerminalSparseAnchorCompressionFactor, 0.46),
      0,
      0.76
    );
    const rightTerminalSymmetryReleaseStrength = 0;
    const rightTerminalPositiveAboveLiftY =
      scaleY(
        safeNumber(
          snapshot.layout?.rightTerminalPositiveAboveLiftY,
          positiveAdjustments.length && positiveAbove ? 28 : 0
        )
      ) * rightTerminalSymmetryReleaseStrength;
    const rightTerminalTopSlack = Math.max(currentTerminalTop - terminalMinY, 0);
    const rightTerminalBottomSlack = Math.max(terminalMaxY - currentTerminalBottom, 0);
    const compressedTopAnchorCenter = terminalMinY + firstRightTerminalHeight / 2;
    const compressedBottomAnchorCenter = clamp(
      terminalMinY + rightTerminalRequiredSpan - lastRightTerminalHeight / 2,
      compressedTopAnchorCenter + Math.max(lastRightTerminalHeight - firstRightTerminalHeight, 0),
      terminalMaxY - lastRightTerminalHeight / 2
    );
    const releasedBottomAnchorBase = clamp(
      anchoredTerminalBottomCenter,
      terminalMinY + lastRightTerminalHeight / 2,
      terminalMaxY - lastRightTerminalHeight / 2
    );
    const sparseBottomSlackAllowanceY = scaleY(
      safeNumber(
        snapshot.layout?.rightTerminalSparseBottomSlackAllowanceY,
        rightTerminalEntries.length >= 5 ? 84 : rightTerminalEntries.length === 4 ? 72 : 58
      )
    );
    const sparseBottomAnchorBase = clamp(
      terminalMinY + rightTerminalRequiredSpan - lastRightTerminalHeight / 2 + sparseBottomSlackAllowanceY,
      compressedTopAnchorCenter + Math.max(lastRightTerminalHeight - firstRightTerminalHeight, 0),
      terminalMaxY - lastRightTerminalHeight / 2
    );
    const releasedBottomAnchorBaseCompacted =
      sparseBottomAnchorBase +
      (releasedBottomAnchorBase - sparseBottomAnchorBase) * (1 - rightTerminalSparseCompactionStrength);
    const sparseTopLiftY = scaleY(
      safeNumber(
        snapshot.layout?.rightTerminalSparseTopLiftY,
        rightTerminalEntries.length >= 5 ? 42 : rightTerminalEntries.length === 4 ? 36 : 26
      )
    ) * rightTerminalSparseCompactionStrength;
    const topAnchorCenterRaw = clamp(
      orderedRightTerminalEntries[0].center -
        rightTerminalTopSlack * Math.min(0.12 + rightTerminalSpreadStrength * 0.16, 0.28) -
        rightTerminalTopPackingLiftY * 0.14 -
        sparseTopLiftY,
      terminalMinY + firstRightTerminalHeight / 2,
      terminalMaxY - firstRightTerminalHeight / 2
    );
    const bottomAnchorCenterRaw = clamp(
      releasedBottomAnchorBaseCompacted +
        rightTerminalBottomSlack * Math.min(0.12 + rightTerminalSpreadStrength * 0.18, 0.3) * (1 - rightTerminalSparseCompactionStrength * 0.9) -
        rightTerminalTopPackingLiftY * 0.14,
      terminalMinY + lastRightTerminalHeight / 2,
      terminalMaxY - lastRightTerminalHeight / 2
    );
    const topAnchorCenter = clamp(
      compressedTopAnchorCenter + (topAnchorCenterRaw - compressedTopAnchorCenter) * (1 - rightTerminalAnchorCompressionStrength),
      compressedTopAnchorCenter,
      terminalMaxY - firstRightTerminalHeight / 2
    );
    const bottomAnchorCenter = clamp(
      compressedBottomAnchorCenter + (bottomAnchorCenterRaw - compressedBottomAnchorCenter) * (1 - rightTerminalAnchorCompressionStrength),
      compressedBottomAnchorCenter,
      terminalMaxY - lastRightTerminalHeight / 2
    );
    const resolvedTerminalBands = resolveAnchoredBandBoxes(
      rightTerminalEntries.map((entry) => ({
        center: entry.center,
        height: entry.height,
      })),
      terminalMinY,
      terminalMaxY,
      {
        gap: rightTerminalSeparationGap,
        minGap: scaleY(10),
        bottomAnchorCenter,
        topAnchorCenter,
        spreadExponent: clamp(
          safeNumber(snapshot.layout?.rightTerminalSpreadExponent, 1.12) -
            rightTerminalSpreadStrength * 0.1 -
            rightTerminalAnchorCompressionStrength * 0.08,
          1.0,
          1.14
        ),
        fallbackMinHeight: 22,
      }
    );
    resolvedTerminalBands.forEach((band, entryIndex) => {
      const entry = rightTerminalEntries[entryIndex];
      if (entry.lane === "deduction") {
        deductionBoxes[entry.index] = shiftBoxCenter(deductionBoxes[entry.index], band.center);
      } else if (entry.lane === "opex") {
        opexBoxes[entry.index] = shiftBoxCenter(opexBoxes[entry.index], band.center);
      } else {
        const box = costBreakdownBoxes[entry.index];
        const packingHeight = Math.max(safeNumber(costBreakdownPackingHeights[entry.index], box?.height), safeNumber(box?.height, 0), 1);
        const barrierHeight = Math.max(safeNumber(costBreakdownBarrierHeights[entry.index], packingHeight), packingHeight, 1);
        const minCenter = Math.max(
          costBreakdownTerminalTopFloor + packingHeight / 2,
          costBreakdownSharesOpexColumn ? costBreakdownTerminalTopBarrierY + barrierHeight / 2 : -Infinity
        );
        const maxCenter = costBreakdownMaxY - packingHeight / 2;
        costBreakdownBoxes[entry.index] = shiftBoxCenter(box, clamp(band.center, minCenter, maxCenter));
      }
    });
    if (positiveAdjustments.length && positiveAbove) {
      const liftableTerminalBoxes = [...deductionBoxes, ...opexBoxes].filter(Boolean);
      if (liftableTerminalBoxes.length) {
        const currentGroupTop = Math.min(...liftableTerminalBoxes.map((box) => box.top));
        const availableLiftY = Math.max(currentGroupTop - terminalMinY, 0);
        const desiredLiftY =
          scaleY(safeNumber(snapshot.layout?.rightTerminalVisualLiftY, positiveAbove ? 28 : 22)) *
          clamp(rightTerminalTopPackingStrength + 0.18 + rightTerminalSymmetryReleaseStrength * 0.22, 0, 0.78);
        const appliedLiftY = Math.min(availableLiftY, desiredLiftY);
        if (appliedLiftY > 0.5) {
          deductionBoxes = deductionBoxes.map((box) => (box ? shiftBoxCenter(box, box.center - appliedLiftY) : box));
          opexBoxes = opexBoxes.map((box) => (box ? shiftBoxCenter(box, box.center - appliedLiftY) : box));
        }
      }
    }
    if (costBreakdownSharesOpexColumn && costBreakdownBoxes.length) {
      maintainCostBreakdownNodeGap();
      const topBarrierDeficit = costBreakdownTerminalTopBarrierY - costBreakdownCollisionTop();
      if (topBarrierDeficit > 0.5) {
        shiftCostBreakdownGroupDown(topBarrierDeficit + scaleY(2));
        maintainCostBreakdownNodeGap();
      }
    }
  }
  let netCoreTargetBand = {
    top: netCoreTop,
    bottom: netCoreBottom,
    height: Math.max(coreNetTargetHeight, 1),
    center: netCoreTop + Math.max(coreNetTargetHeight, 1) / 2,
  };
  let positiveTargetBands = [];
  if (positiveAdjustments.length) {
    if (positiveAbove) {
      let positiveCursor = netTop;
      positiveTargetBands = positiveMergeHeights.map((height) => {
        const top = positiveCursor;
        positiveCursor += height;
        return {
          top,
          bottom: top + height,
          height,
          center: top + height / 2,
        };
      });
      netCoreTargetBand = {
        top: positiveCursor,
        bottom: positiveCursor + coreNetTargetHeight,
        height: Math.max(coreNetTargetHeight, 1),
        center: positiveCursor + Math.max(coreNetTargetHeight, 1) / 2,
      };
    } else {
      let positiveCursor = netCoreTop + coreNetTargetHeight;
      positiveTargetBands = positiveMergeHeights.map((height) => {
        const top = positiveCursor;
        positiveCursor += height;
        return {
          top,
          bottom: top + height,
          height,
          center: top + height / 2,
        };
      });
      netCoreTargetBand = {
        top: netTop,
        bottom: netTop + coreNetTargetHeight,
        height: Math.max(coreNetTargetHeight, 1),
        center: netTop + Math.max(coreNetTargetHeight, 1) / 2,
      };
    }
  }
  const netDisplayTargetBand = {
    ...netCoreTargetBand,
  };
  const netRibbonOptions = positiveAdjustments.length
    ? {
        ...mergeOutflowRibbonOptions(),
        startCurveFactor: clamp(safeNumber(outflowRibbonOptions.startCurveFactor, 0.2) - (positiveAbove ? 0.03 : 0.01), 0.1, 0.22),
        endCurveFactor: clamp(safeNumber(outflowRibbonOptions.endCurveFactor, 0.22) + (positiveAbove ? 0.05 : 0.04), 0.18, 0.32),
        minStartCurveFactor: clamp(safeNumber(outflowRibbonOptions.minStartCurveFactor, 0.12) - 0.01, 0.08, 0.16),
        maxEndCurveFactor: clamp(safeNumber(outflowRibbonOptions.maxEndCurveFactor, 0.28) + (positiveAbove ? 0.06 : 0.04), 0.24, 0.34),
        deltaScale: Math.max(safeNumber(outflowRibbonOptions.deltaScale, 0.9) - 0.08, 0.42),
        deltaInfluence: Math.min(safeNumber(outflowRibbonOptions.deltaInfluence, 0.06) + 0.02, 0.12),
        sourceHoldFactor: clamp(
          safeNumber(
            snapshot.layout?.netSourceHoldFactor,
            belowOperatingItems.length ? (positiveAbove ? 0.22 : 0.19) : safeNumber(outflowRibbonOptions.sourceHoldFactor, 0.05)
          ),
          0.04,
          0.28
        ),
        minSourceHoldLength: Math.max(
          safeNumber(
            snapshot.layout?.netMinSourceHoldLength,
            belowOperatingItems.length ? (positiveAbove ? 54 : 42) : safeNumber(outflowRibbonOptions.minSourceHoldLength, 6)
          ),
          4
        ),
        maxSourceHoldLength: Math.max(
          safeNumber(
            snapshot.layout?.netMaxSourceHoldLength,
            belowOperatingItems.length ? (positiveAbove ? 156 : 132) : safeNumber(outflowRibbonOptions.maxSourceHoldLength, 18)
          ),
          10
        ),
        sourceHoldDeltaReduction: clamp(
          safeNumber(
            snapshot.layout?.netSourceHoldDeltaReduction,
            belowOperatingItems.length ? 0.22 : safeNumber(outflowRibbonOptions.sourceHoldDeltaReduction, 0.56)
          ),
          0,
          0.88
        ),
        minAdaptiveSourceHoldLength: Math.max(
          safeNumber(
            snapshot.layout?.netMinAdaptiveSourceHoldLength,
            belowOperatingItems.length ? (positiveAbove ? 38 : 28) : safeNumber(outflowRibbonOptions.minAdaptiveSourceHoldLength, 2)
          ),
          1
        ),
      }
    : mergeOutflowRibbonOptions();
  const netBridgePath = (x0, y0Top, y0Bottom, x1, y1Top, y1Bottom) =>
    flowPath(
      x0,
      y0Top,
      y0Bottom,
      x1 + safeNumber(snapshot.layout?.netTargetCoverInsetX, 0),
      y1Top,
      y1Bottom,
      netRibbonOptions
    );
  const mainNetRibbonEnvelopeAtX = (sampleX) => {
    return flowEnvelopeAtX(
      sampleX,
      opX + nodeWidth,
      opNetSourceBand.top,
      opNetSourceBand.bottom,
      netX + safeNumber(snapshot.layout?.netTargetCoverInsetX, 0),
      netDisplayTargetBand.top,
      netDisplayTargetBand.bottom,
      netRibbonOptions
    );
  };
  const sourceGrowthNoteSize = safeNumber(
    snapshot.layout?.sourceTemplateYoySize,
    safeNumber(snapshot.layout?.sourceTemplateQoqSize, 14)
  );
  const sourceGrowthNoteLineHeight = Math.max(
    safeNumber(snapshot.layout?.sourceTemplateSubtitleLineHeight, currentChartLanguage() === "zh" ? 17 : 18),
    sourceGrowthNoteSize + (currentChartLanguage() === "zh" ? 3 : 4)
  );
  const profitMetricNoteSize = safeNumber(snapshot.layout?.profitMetricNoteSize, 18);
  const profitMetricNoteLineHeight = Math.max(
    safeNumber(snapshot.layout?.profitMetricNoteLineHeight, currentChartLanguage() === "zh" ? 22 : 23),
    profitMetricNoteSize + (currentChartLanguage() === "zh" ? 4 : 5)
  );
  const renderMetricCluster = (centerX, y, title, value, subline, deltaLine, color, layout) => `
      <text x="${centerX}" y="${y}" text-anchor="middle" font-size="${layout.titleSize}" font-weight="700" fill="${color}" paint-order="stroke fill" stroke="${background}" stroke-width="${layout.titleStroke}" stroke-linejoin="round">${escapeHtml(localizeChartPhrase(title))}</text>
      <text x="${centerX}" y="${y + layout.valueOffset}" text-anchor="middle" font-size="${layout.valueSize}" font-weight="700" fill="${color}" paint-order="stroke fill" stroke="${background}" stroke-width="${layout.valueStroke}" stroke-linejoin="round">${escapeHtml(value)}</text>
      ${subline ? `<text x="${centerX}" y="${y + layout.subOffset}" text-anchor="middle" font-size="${layout.subSize}" fill="${muted}" paint-order="stroke fill" stroke="${background}" stroke-width="${layout.subStroke}" stroke-linejoin="round">${escapeHtml(localizeChartPhrase(subline))}</text>` : ""}
      ${deltaLine ? `<text x="${centerX}" y="${y + layout.deltaOffset}" text-anchor="middle" font-size="${layout.subSize}" fill="${muted}" paint-order="stroke fill" stroke="${background}" stroke-width="${layout.subStroke}" stroke-linejoin="round">${escapeHtml(deltaLine)}</text>` : ""}
    `;
  const metricClusterObstacleRect = (centerX, y, title, value, subline, deltaLine, layout, padding = scaleY(10)) => {
    const localizedTitle = localizeChartPhrase(title);
    const localizedSubline = subline ? localizeChartPhrase(subline) : "";
    const widths = [
      approximateTextWidth(localizedTitle, layout.titleSize),
      approximateTextWidth(value, layout.valueSize),
      localizedSubline ? approximateTextWidth(localizedSubline, layout.subSize) : 0,
      deltaLine ? approximateTextWidth(deltaLine, layout.subSize) : 0,
    ];
    const blockWidth = Math.max(...widths, 1);
    const blockBottomBaseline = y + (deltaLine ? layout.deltaOffset : subline ? layout.subOffset : layout.valueOffset);
    const blockBottomSize = deltaLine || subline ? layout.subSize : layout.valueSize;
    return {
      left: centerX - blockWidth / 2 - padding,
      right: centerX + blockWidth / 2 + padding,
      top: y - layout.titleSize - padding,
      bottom: blockBottomBaseline + blockBottomSize * 0.42 + padding,
    };
  };
  const grossMetricLayout = resolveReplicaMetricClusterLayout(grossTop, snapshot.grossMarginYoyDeltaPp !== null && snapshot.grossMarginYoyDeltaPp !== undefined, {
    compactThreshold: scaleY(352),
    noteLineHeight: profitMetricNoteLineHeight,
    noteSize: profitMetricNoteSize,
  });
  const operatingMetricLayout = resolveReplicaMetricClusterLayout(opTop, snapshot.operatingMarginYoyDeltaPp !== null && snapshot.operatingMarginYoyDeltaPp !== undefined, {
    compactThreshold: scaleY(352),
    noteLineHeight: profitMetricNoteLineHeight,
    noteSize: profitMetricNoteSize,
  });
  const expenseSummaryLayout = resolveReplicaMetricClusterLayout(opTop, false, {
    compactThreshold: scaleY(352),
    noteLineHeight: profitMetricNoteLineHeight,
    noteSize: profitMetricNoteSize,
  });
  const resolveExpenseSummaryBaselineY = (nodeBottom, options = {}) => {
    const visualGap = scaleY(safeNumber(options.visualGapY, 28));
    return nodeBottom + visualGap + expenseSummaryLayout.titleSize * 0.82;
  };
  const grossMetricY = clamp(
    layoutY(
      snapshot.layout?.grossMetricY,
      (grossTop - scaleY(grossMetricLayout.preferredClearance)) / Math.max(verticalScale, 0.0001)
    ),
    scaleY(grossMetricLayout.minTop),
    grossTop - scaleY(grossMetricLayout.bottomClearance)
  );
  const operatingMetricY = clamp(
    layoutY(
      snapshot.layout?.operatingMetricY,
      (opTop - scaleY(operatingMetricLayout.preferredClearance)) / Math.max(verticalScale, 0.0001)
    ),
    scaleY(operatingMetricLayout.minTop),
    opTop - scaleY(operatingMetricLayout.bottomClearance)
  );
  const logoMetrics = corporateLogoMetrics(snapshot.companyLogoKey);
  const logoVisibleMetrics = corporateLogoVisibleMetrics(snapshot.companyLogoKey);
  const normalizedCompanyLogoKey = normalizeLogoKey(snapshot.companyLogoKey);
  const titleText = localizeChartTitle(snapshot);
  const titleBaseSize = 82;
  const titleMaxWidth = safeNumber(snapshot.layout?.titleMaxWidth, 1540);
  const titleFontSize = titleBaseSize;
  const titleX = width / 2;
  const titleY = layoutY(snapshot.layout?.titleY, 112);
  const periodEndFontSize = 28;
  const inlinePeriodLayout = inlinePeriodEndLayout({
    titleText,
    titleFontSize,
    titleX,
    titleY,
    periodEndFontSize,
    width,
    titleMaxWidth,
    rightPadding: 84,
  });
  const titleVisualWidth = inlinePeriodLayout.titleVisualWidth;
  const periodEndY = layoutY(snapshot.layout?.periodEndInlineY, inlinePeriodLayout.periodEndY / verticalScale);
  const referenceLogoMetrics = corporateLogoVisibleMetrics("microsoft-corporate");
  const referenceLogoScale = corporateLogoBaseScale("microsoft-corporate", {
    hero: usesHeroLockups,
    config: templateTokens.logo?.corporate || BASE_CORPORATE_LOGO_TOKENS,
  });
  const logoTargetArea = safeNumber(
    snapshot.layout?.logoTargetArea,
    Math.max(referenceLogoMetrics.width * referenceLogoMetrics.height * referenceLogoScale * referenceLogoScale, 1)
  );
  const rawLogoScale = Math.sqrt(logoTargetArea / Math.max(logoVisibleMetrics.width * logoVisibleMetrics.height, 1));
  const logoScale = clamp(
    rawLogoScale * safeNumber(snapshot.layout?.logoAreaScaleFactor, 1),
    safeNumber(snapshot.layout?.logoMinScale, 0.74),
    safeNumber(snapshot.layout?.logoMaxScale, 1.32)
  );
  const titleAnchor = "middle";
  const periodEndPreferredX =
    snapshot.layout?.periodEndInlineX !== null && snapshot.layout?.periodEndInlineX !== undefined
      ? safeNumber(snapshot.layout?.periodEndInlineX) + leftShiftX
      : inlinePeriodLayout.periodEndX;
  const periodEndX = Math.min(periodEndPreferredX, width - 84);
  const logoX = revenueX + nodeWidth / 2 - (logoMetrics.width * logoScale) / 2;
  const logoHeight = logoMetrics.height * logoScale;
  const logoDefaultY =
    revenueTop -
    logoHeight -
    scaleY(safeNumber(snapshot.layout?.logoGapAboveRevenueY, 42) * CORPORATE_LOGO_REVENUE_GAP_MULTIPLIER);
  const logoMinY = layoutY(snapshot.layout?.logoMinY, 134);
  const logoY = clamp(
    logoDefaultY,
    logoMinY,
    revenueTop - logoHeight - scaleY(safeNumber(snapshot.layout?.logoBottomClearanceY, 16))
  );
  const opexSummaryX =
    snapshot.layout?.opexSummaryX !== null && snapshot.layout?.opexSummaryX !== undefined
      ? safeNumber(snapshot.layout?.opexSummaryX) + leftShiftX
      : opX + 124;
  const opexSummaryY = layoutY(snapshot.layout?.opexSummaryY, Math.min(opexBottom / verticalScale + 56, 904));
  const opexSummaryAnchor = snapshot.layout?.opexSummaryAnchor || "middle";
  const autoLayoutNodeOffsets = Object.create(null);
  const autoLayoutOffsetForNode = (nodeId) => {
    const offset = autoLayoutNodeOffsets?.[nodeId] || {};
    return {
      dx: safeNumber(offset?.dx, 0),
      dy: safeNumber(offset?.dy, 0),
    };
  };
  const manualNodeOffsetFor = (nodeId) => {
    const override = snapshot.editorNodeOverrides?.[nodeId] || {};
    return {
      dx: safeNumber(override?.dx, 0),
      dy: safeNumber(override?.dy, 0),
    };
  };
  const combinedNodeOffsetFor = (nodeId, options = {}) => {
    const manualOffset = options.includeManual === false ? { dx: 0, dy: 0 } : manualNodeOffsetFor(nodeId);
    const autoOffset = options.includeAuto === false ? { dx: 0, dy: 0 } : autoLayoutOffsetForNode(nodeId);
    return {
      dx: manualOffset.dx + autoOffset.dx,
      dy: manualOffset.dy + autoOffset.dy,
    };
  };
  const layoutReferenceOffsetFor = (nodeId) =>
    combinedNodeOffsetFor(nodeId, {
      includeManual: false,
    });
  const revenueShift = combinedNodeOffsetFor("revenue");
  const revenueLabelMarkup = (() => {
    const lines = [
      { text: localizeChartPhrase("Revenue"), size: revenueLabelTitleSize, weight: 700, color: revenueTextColor, strokeWidth: 10, gapAfter: 12 },
      {
        text: formatBillions(revenueBn),
        size: revenueLabelValueSize,
        weight: 700,
        color: revenueTextColor,
        strokeWidth: 10,
        gapAfter:
          (showQoq && snapshot.revenueQoqPct !== null && snapshot.revenueQoqPct !== undefined) ||
          (snapshot.revenueYoyPct !== null && snapshot.revenueYoyPct !== undefined)
            ? 12
            : 0,
      },
    ];
    if (showQoq && snapshot.revenueQoqPct !== null && snapshot.revenueQoqPct !== undefined) {
      lines.push({
        text: formatGrowthMetric(snapshot.revenueQoqPct, "qoq"),
        size: revenueLabelQoqSize,
        weight: 500,
        color: muted,
        strokeWidth: 7,
        gapAfter: snapshot.revenueYoyPct !== null && snapshot.revenueYoyPct !== undefined ? 6 : 0,
      });
    }
    if (snapshot.revenueYoyPct !== null && snapshot.revenueYoyPct !== undefined) {
      lines.push({
        text: formatGrowthMetric(snapshot.revenueYoyPct, "yoy"),
        size: revenueLabelNoteSize,
        weight: 500,
        color: muted,
        strokeWidth: 7,
        gapAfter: 0,
      });
    }
    const blockHeight = lines.reduce((sum, line, index) => sum + line.size + (index < lines.length - 1 ? line.gapAfter : 0), 0);
    let cursor = revenueLabelCenterY - blockHeight / 2;
    return lines
      .map((line, index) => {
        cursor += line.size;
        const markup = `<text x="${revenueLabelCenterX + revenueShift.dx}" y="${cursor + revenueShift.dy}" text-anchor="middle" font-size="${line.size}" font-weight="${line.weight}" fill="${line.color}" opacity="0.98" paint-order="stroke fill" stroke="${background}" stroke-width="${line.strokeWidth}" stroke-linejoin="round">${escapeHtml(line.text)}</text>`;
        if (index < lines.length - 1) cursor += line.gapAfter;
        return markup;
      })
      .join("");
  })();
  const opexSummaryCenterX = opX + nodeWidth / 2;
  const opexSummaryGapY = safeNumber(
    snapshot.layout?.opexSummaryGapY,
    36 + Math.max(operatingExpenseLabelLines.length - 1, 0) * 10 + (opexItems.length >= 3 ? 8 : 0)
  );
  const opexSummaryTopY = resolveExpenseSummaryBaselineY(opexBottom, {
    visualGapY: opexSummaryGapY,
  });
  const opexSummaryTitleLineHeight = expenseSummaryLayout.titleSize + 1;
  const opexSummaryTitleHeight = operatingExpenseLabelLines.length * opexSummaryTitleLineHeight;
  const opexSummaryValueY = opexSummaryTopY + (operatingExpenseLabelLines.length - 1) * opexSummaryTitleLineHeight + expenseSummaryLayout.valueOffset;
  const opexSummaryRatioY = opexSummaryTopY + (operatingExpenseLabelLines.length - 1) * opexSummaryTitleLineHeight + expenseSummaryLayout.subOffset;
  const opexSummaryValueOffsetY = opexSummaryValueY - opexSummaryTopY;
  const opexSummaryRatioOffsetY = opexSummaryRatioY - opexSummaryTopY;
  let opexSummaryAutoLiftY = 0;
  const opexSummaryVisibleTopOffsetY = -expenseSummaryLayout.titleSize * safeNumber(snapshot.layout?.opexSummaryVisibleTopFactor, 0.933);
  const opexSummaryVisibleBottomOffsetY =
    (revenueBn > 0
      ? opexSummaryRatioOffsetY + expenseSummaryLayout.subSize * 0.42
      : opexSummaryValueOffsetY + expenseSummaryLayout.valueSize * 0.42);
  const resolveCostSummaryVisibleTopGapY = () =>
    resolveExpenseSummaryBaselineY(costBottom, {
      visualGapY: safeNumber(snapshot.layout?.costSummaryGapY, 28),
    }) +
    opexSummaryVisibleTopOffsetY -
    costBottom;
  const resolveOpexSummaryTargetTopGapY = () =>
    snapshot.layout?.opexSummaryTargetTopGapY !== null && snapshot.layout?.opexSummaryTargetTopGapY !== undefined
      ? scaleY(safeNumber(snapshot.layout?.opexSummaryTargetTopGapY))
      : resolveCostSummaryVisibleTopGapY() + scaleY(safeNumber(snapshot.layout?.opexSummaryTargetTopGapAdjustY, 0));
  const resolveOpexSummaryTitleBaselineY = (
    shift = combinedNodeOffsetFor("operating-expenses"),
    summaryLiftY = opexSummaryAutoLiftY
  ) =>
    opexBottom + shift.dy + resolveOpexSummaryTargetTopGapY() - opexSummaryVisibleTopOffsetY - summaryLiftY;
  const resolveOpexSummaryMetrics = (shift = combinedNodeOffsetFor("operating-expenses"), summaryLiftY = opexSummaryAutoLiftY) => {
    const baselineTopY = resolveOpexSummaryTitleBaselineY(shift, summaryLiftY);
    return {
      centerX: opexSummaryCenterX + shift.dx,
      top: baselineTopY + opexSummaryVisibleTopOffsetY,
      bottom: baselineTopY + opexSummaryVisibleBottomOffsetY,
      titleY: baselineTopY,
      valueY: baselineTopY + opexSummaryValueOffsetY,
      ratioY: baselineTopY + opexSummaryRatioOffsetY,
    };
  };
  const resolveOpexSummaryObstacleRect = (
    shift = combinedNodeOffsetFor("operating-expenses"),
    summaryLiftY = opexSummaryAutoLiftY,
    options = {}
  ) => {
    const summaryMetrics = resolveOpexSummaryMetrics(shift, summaryLiftY);
    const obstaclePadX = scaleY(safeNumber(options.padX, 10));
    const obstaclePadY = scaleY(safeNumber(options.padY, 8));
    const obstacleWidth = Math.max(
      approximateTextBlockWidth(operatingExpenseLabelLines, expenseSummaryLayout.titleSize),
      approximateTextWidth(formatBillionsByMode(operatingExpensesBn, "negative-parentheses"), expenseSummaryLayout.valueSize),
      revenueBn > 0 ? approximateTextWidth(`${formatPct((operatingExpensesBn / revenueBn) * 100)} ${ofRevenueLabel()}`, expenseSummaryLayout.subSize) : 0,
      1
    );
    return {
      metrics: summaryMetrics,
      left: summaryMetrics.centerX - obstacleWidth / 2 - obstaclePadX,
      right: summaryMetrics.centerX + obstacleWidth / 2 + obstaclePadX,
      top: summaryMetrics.top - obstaclePadY,
      bottom: summaryMetrics.bottom + obstaclePadY,
    };
  };
  const alignOpexSummaryToNode = () => {
    opexSummaryAutoLiftY = 0;
  };
  const renderOpexSummaryMarkup = () => {
    const summaryMetrics = resolveOpexSummaryMetrics();
    return `
      ${svgTextBlock(summaryMetrics.centerX, summaryMetrics.titleY, operatingExpenseLabelLines, {
        fill: redText,
        fontSize: expenseSummaryLayout.titleSize,
        weight: 700,
        anchor: "middle",
        lineHeight: opexSummaryTitleLineHeight,
        haloColor: background,
        haloWidth: expenseSummaryLayout.titleStroke,
      })}
      <text x="${summaryMetrics.centerX}" y="${summaryMetrics.valueY}" text-anchor="middle" font-size="${expenseSummaryLayout.valueSize}" font-weight="700" fill="${redText}" paint-order="stroke fill" stroke="${background}" stroke-width="${expenseSummaryLayout.valueStroke}" stroke-linejoin="round">${escapeHtml(formatBillionsByMode(operatingExpensesBn, "negative-parentheses"))}</text>
      ${revenueBn > 0 ? `<text x="${summaryMetrics.centerX}" y="${summaryMetrics.ratioY}" text-anchor="middle" font-size="${expenseSummaryLayout.subSize}" fill="${muted}" paint-order="stroke fill" stroke="${background}" stroke-width="${expenseSummaryLayout.subStroke}" stroke-linejoin="round">${escapeHtml(formatPct((operatingExpensesBn / revenueBn) * 100))} ${ofRevenueLabel()}</text>` : ""}
    `;
  };
  const shiftOpexGroupDownForSummaryClearance = () => {
    if (!opexBoxes.length) return;
    const opexSummaryObstacle = resolveOpexSummaryObstacleRect(layoutReferenceOffsetFor("operating-expenses"), opexSummaryAutoLiftY, {
      padX: safeNumber(snapshot.layout?.opexSummaryOpexObstaclePadX, 10),
      padY: safeNumber(snapshot.layout?.opexSummaryOpexObstaclePadY, 8),
    });
    const sampleXsAcrossRange = (left, right, count = 7) => {
      if (!(right > left)) return [left];
      return Array.from({ length: count }, (_value, index) => left + ((right - left) * index) / Math.max(count - 1, 1));
    };
    const computeOpexEnvelopeDeficit = (index) => {
      const box = opexBoxes[index];
      const sourceSlice = opexSourceSlices[index] || opexSlices[index];
      if (!box || !sourceSlice) return 0;
      const sourceShift = layoutReferenceOffsetFor("operating-expenses");
      const targetShift = layoutReferenceOffsetFor(`opex-${index}`);
      const sourceCoverInset = Math.max(
        safeNumber(standardTerminalBranchOptions.sourceCoverInsetX, safeNumber(snapshot.layout?.branchSourceCoverInsetX, 1.5)),
        0
      );
      const mergedBranchOptions = {
        ...mergeOutflowRibbonOptions(standardTerminalBranchOptions),
        endCapWidth: 0,
        targetCoverInsetX: safeNumber(
          standardTerminalBranchOptions.targetCoverInsetX,
          safeNumber(snapshot.layout?.branchTargetCoverInsetX, 14)
        ),
      };
      const bridge = constantThicknessBridge(sourceSlice, box.center, 14, opexTop, opexBottom);
      const targetTop = bridge.targetTop + targetShift.dy;
      const targetHeight = bridge.targetHeight;
      const branchOptions = resolveAdaptiveNegativeTerminalBranchOptions(
        standardTerminalBranchOptions,
        bridge.sourceTop + sourceShift.dy,
        bridge.sourceBottom + sourceShift.dy,
        targetTop,
        targetHeight,
        {
          index,
          count: Math.max(opexBoxes.filter(Boolean).length, 1),
          laneBias: 0.04,
        }
      );
      const sourceX = opX + nodeWidth + sourceShift.dx - sourceCoverInset;
      const targetX = rightTerminalNodeX + mergedBranchOptions.targetCoverInsetX + targetShift.dx;
      const overlapLeft = Math.max(opexSummaryObstacle.left, sourceX + scaleY(4));
      const overlapRight = Math.min(opexSummaryObstacle.right, targetX - scaleY(4));
      if (!(overlapRight > overlapLeft)) return 0;
      const ribbonClearanceY = scaleY(safeNumber(snapshot.layout?.opexSummaryToRibbonGapY, 14));
      return sampleXsAcrossRange(overlapLeft, overlapRight).reduce((maxDeficit, sampleX) => {
        const envelope = flowEnvelopeAtX(
          sampleX,
          sourceX,
          bridge.sourceTop + sourceShift.dy,
          bridge.sourceBottom + sourceShift.dy,
          targetX,
          targetTop,
          targetTop + targetHeight,
          branchOptions
        );
        if (!envelope) return maxDeficit;
        return Math.max(maxDeficit, opexSummaryObstacle.bottom + ribbonClearanceY - envelope.top);
      }, 0);
    };
    const summaryClearanceY = scaleY(
      safeNumber(snapshot.layout?.opexSummaryToFirstOpexGapY, opexBoxes.length >= 2 ? 52 : 44)
    );
    const desiredFirstOpexTopY = opexSummaryObstacle.metrics.bottom + summaryClearanceY;
    const firstOpexTopY = Math.min(...opexBoxes.filter(Boolean).map((box) => safeNumber(box.top, Infinity)));
    const topDeficitY = desiredFirstOpexTopY - firstOpexTopY;
    const ribbonDeficitY = opexBoxes.reduce(
      (maxDeficit, _box, index) => Math.max(maxDeficit, computeOpexEnvelopeDeficit(index)),
      0
    );
    let requiredShiftY = Math.max(topDeficitY, ribbonDeficitY);
    if (!(requiredShiftY > 0.5)) return;
    const currentOpexBottomY = Math.max(...opexBoxes.filter(Boolean).map((box) => safeNumber(box.bottom, -Infinity)));
    if (costBreakdownSharesOpexColumn && costBreakdownBoxes.length) {
      const firstCostBreakdownTopY = Math.min(...costBreakdownBoxes.filter(Boolean).map((box) => safeNumber(box.top, Infinity)));
      const minOpexToCostGapY = scaleY(safeNumber(snapshot.layout?.opexToCostBreakdownMinGapY, 74));
      const availableOpexToCostGapY = firstCostBreakdownTopY - currentOpexBottomY;
      const nextGapAfterShiftY = availableOpexToCostGapY - requiredShiftY;
      if (nextGapAfterShiftY < minOpexToCostGapY) {
        const costBreakdownFollowShiftY = minOpexToCostGapY - nextGapAfterShiftY;
        if (costBreakdownFollowShiftY > 0.5) {
          shiftCostBreakdownGroupDown(costBreakdownFollowShiftY + scaleY(2));
          maintainCostBreakdownNodeGap();
        }
      }
    }
    const opexShiftHeadroomY = maxActualBoxGroupShiftDown(opexBoxes, opexMaxY);
    const appliedShiftY = Math.min(Math.max(requiredShiftY, 0), opexShiftHeadroomY);
    if (!(appliedShiftY > 0.5)) return;
    shiftBoxSetBy(opexBoxes, appliedShiftY);
  };
  const resolveSourceMetricBaselines = (slice, index, lineMetrics, options = {}) => {
    if (!lineMetrics.length) return [];
    const minTop = scaleY(safeNumber(options.minTop, 188));
    const topPadding = scaleY(safeNumber(options.topPadding, 8));
    const bottomPadding = scaleY(safeNumber(options.bottomPadding, 10));
    const ribbonClearance = scaleY(safeNumber(options.ribbonClearance, 8));
    const verticalBias = clamp(safeNumber(options.verticalBias, 0.18), 0, 1);
    const prevBottom = index > 0 ? sourceSlices[index - 1].bottom : minTop - topPadding;
    const regionTop = Math.max(prevBottom + topPadding, minTop);
    const regionBottom = slice.top - bottomPadding - ribbonClearance;
    const blockHeight = lineMetrics.reduce((sum, line, lineIndex) => sum + line.fontSize + (lineIndex < lineMetrics.length - 1 ? line.gapAfter : 0), 0);
    const slack = Math.max(regionBottom - regionTop - blockHeight, 0);
    const top = regionTop + slack * verticalBias;
    let cursor = top;
    return lineMetrics.map((line, lineIndex) => {
      cursor += line.fontSize;
      const baseline = cursor;
      if (lineIndex < lineMetrics.length - 1) cursor += line.gapAfter;
      return baseline;
    });
  };
  const renderSourceMetricBlock = (item, x, anchor, baselines, sizes) => {
    if (!baselines.length) return "";
    let block = `<text x="${x}" y="${baselines[0]}" text-anchor="${anchor}" font-size="${sizes.value}" font-weight="500" fill="${item.valueColor || muted}" paint-order="stroke fill" stroke="${background}" stroke-width="5" stroke-linejoin="round">${escapeHtml(formatSourceMetric(item))}</text>`;
    let lineIndex = 1;
    if (showQoq && item.qoqPct !== null && item.qoqPct !== undefined && baselines[lineIndex] !== undefined) {
      block += `<text x="${x}" y="${baselines[lineIndex]}" text-anchor="${anchor}" font-size="${sizes.qoq}" fill="${muted}" paint-order="stroke fill" stroke="${background}" stroke-width="4.5" stroke-linejoin="round">${escapeHtml(formatGrowthMetric(item.qoqPct, "qoq"))}</text>`;
      lineIndex += 1;
    }
    if (item.yoyPct !== null && item.yoyPct !== undefined && baselines[lineIndex] !== undefined) {
      block += `<text x="${x}" y="${baselines[lineIndex]}" text-anchor="${anchor}" font-size="${sizes.yoy}" fill="${muted}" paint-order="stroke fill" stroke="${background}" stroke-width="4.5" stroke-linejoin="round">${escapeHtml(formatGrowthMetric(item.yoyPct, "yoy"))}</text>`;
    }
    return block;
  };
  const sourceTemplatePreset = (density = "regular", options = {}) => {
    const detail = !!options.detail;
    if (density === "micro") {
      return {
        titleSize: detail ? 18 : 19,
        titleLineHeight: detail ? 21 : 22,
        subtitleSize: 12,
        subtitleLineHeight: 15,
        valueSize: 18,
        yoySize: 12,
        qoqSize: 12,
        metricGap: 3,
        metricBlockGap: 4,
      };
    }
    if (density === "compact" || density === "dense" || density === "ultra") {
      return {
        titleSize: detail ? 22 : 24,
        titleLineHeight: detail ? 25 : 27,
        subtitleSize: detail ? 13 : 14,
        subtitleLineHeight: detail ? 16 : 17,
        valueSize: detail ? 21 : 23,
        yoySize: detail ? 13 : 14,
        qoqSize: detail ? 13 : 14,
        metricGap: 4,
        metricBlockGap: 5,
      };
    }
    return {
      titleSize: detail ? 23 : 26,
      titleLineHeight: detail ? 26 : 29,
      subtitleSize: detail ? 13 : 14,
      subtitleLineHeight: detail ? 16 : 17,
      valueSize: detail ? 22 : 24,
      yoySize: detail ? 13 : 14,
      qoqSize: detail ? 13 : 14,
      metricGap: 4,
      metricBlockGap: 5,
    };
  };
  const renderTemplateSourceAnnotation = (item, slice, box, options = {}) => {
    const density = options.density || item.layoutDensity || "regular";
    const preset = sourceTemplatePreset(density, options);
    const titleSize = safeNumber(options.titleSize, preset.titleSize);
    const titleLineHeight = safeNumber(options.titleLineHeight, preset.titleLineHeight);
    const subtitleSize = safeNumber(options.subtitleSize, preset.subtitleSize);
    const subtitleLineHeight = safeNumber(options.subtitleLineHeight, preset.subtitleLineHeight);
    const valueSize = safeNumber(options.valueSize, preset.valueSize);
    const yoySize = safeNumber(options.yoySize, preset.yoySize);
    const qoqSize = safeNumber(options.qoqSize, preset.qoqSize);
    const metricGap = safeNumber(options.metricGap, preset.metricGap);
    const metricBlockGap = safeNumber(options.metricBlockGap, preset.metricBlockGap);
    const labelLines = options.labelLines?.length
      ? localizeChartLines(options.labelLines)
      : resolveSourceLabelLines(item, {
          compactMode: compactSources || item.compactLabel,
          fontSize: titleSize,
          maxWidth: safeNumber(options.labelMaxWidth, currentChartLanguage() === "zh" ? 154 : 194),
          maxLines: currentChartLanguage() === "zh" ? 2 : 3,
        });
    const supportLines = resolveLocalizedSupportLines(item, options.supportLines, options.supportLinesZh);
    const titleColor = options.titleColor || item.labelColor || item.nodeColor || dark;
    const subtitleColor = options.subtitleColor || item.supportColor || muted;
    const valueColor = options.valueColor || item.valueColor || item.nodeColor || item.labelColor || dark;
    const labelX = safeNumber(options.labelX, sourceLabelX);
    const labelAnchor = options.labelAnchor || "start";
    const metricX = safeNumber(options.metricX, leftX - 12);
    const metricAnchor = options.metricAnchor || "end";
    const titleBlockHeight = labelLines.length * titleLineHeight;
    const subtitleGap = supportLines.length ? metricBlockGap : 0;
    const subtitleBlockHeight = supportLines.length ? supportLines.length * subtitleLineHeight : 0;
    const totalLabelHeight = titleBlockHeight + subtitleGap + subtitleBlockHeight;
    const clampLabelToBox = options.clampLabelToBox !== false;
    const labelCenterY = clampLabelToBox
      ? clamp(
          safeNumber(options.labelCenterY, slice.center),
          box.top + totalLabelHeight / 2,
          box.bottom - totalLabelHeight / 2
        )
      : safeNumber(options.labelCenterY, slice.center);
    const titleStartY = labelCenterY - totalLabelHeight / 2 + titleLineHeight * 0.8;
    const centeredWrappedLabel = labelLines.length > 1;
    const labelBlockWidth = approximateTextBlockWidth(labelLines, titleSize);
    const effectiveLabelAnchor = centeredWrappedLabel ? "middle" : labelAnchor;
    const effectiveLabelX =
      effectiveLabelAnchor === "middle"
        ? labelAnchor === "end"
          ? labelX - labelBlockWidth / 2
          : labelAnchor === "start"
            ? labelX + labelBlockWidth / 2
            : labelX
        : labelX;
    const metricLines = [
      {
        text: formatSourceMetric(item),
        size: valueSize,
        weight: 700,
        color: valueColor,
        strokeWidth: 6,
      },
    ];
    if (showQoq && item.qoqPct !== null && item.qoqPct !== undefined) {
      metricLines.push({
        text: formatGrowthMetric(item.qoqPct, "qoq"),
        size: qoqSize,
        weight: 500,
        color: muted,
        strokeWidth: 4.5,
      });
    }
    if (item.yoyPct !== null && item.yoyPct !== undefined) {
      metricLines.push({
        text: formatGrowthMetric(item.yoyPct, "yoy"),
        size: yoySize,
        weight: 500,
        color: muted,
        strokeWidth: 4.5,
      });
    }
    const metricBlockHeight = metricLines.reduce(
      (sum, line, lineIndex) => sum + line.size + (lineIndex < metricLines.length - 1 ? metricGap : 0),
      0
    );
    const metricPlacement = options.metricPlacement || "center";
    let metricTop;
    if (metricPlacement === "above-ribbon") {
      const metricTopPadding = scaleY(safeNumber(options.metricTopPadding, 10));
      const metricMinTop = scaleY(safeNumber(options.metricMinTop, 146));
      const ribbonTop = safeNumber(options.ribbonTop, slice.top);
      const previousRibbonBottom = options.previousRibbonBottom !== undefined && options.previousRibbonBottom !== null
        ? safeNumber(options.previousRibbonBottom)
        : null;
      const previousClearance = scaleY(safeNumber(options.metricPreviousClearance, 10));
      metricTop = safeNumber(options.metricTop, ribbonTop - metricTopPadding - metricBlockHeight);
      if (previousRibbonBottom !== null && previousRibbonBottom !== undefined) {
        metricTop = Math.max(metricTop, previousRibbonBottom + previousClearance);
      }
      metricTop = Math.max(metricTop, metricMinTop);
      metricTop = Math.min(metricTop, ribbonTop - scaleY(safeNumber(options.metricBottomClearance, 6)) - metricBlockHeight);
    } else {
      const metricCenterY = clamp(
        safeNumber(options.metricCenterY, slice.center),
        box.top + metricBlockHeight / 2,
        box.bottom - metricBlockHeight / 2
      );
      metricTop = metricCenterY - metricBlockHeight / 2;
    }
    let metricCursor = metricTop;
    let html = "";
    metricLines.forEach((line, lineIndex) => {
      metricCursor += line.size;
      html += `<text x="${metricX}" y="${metricCursor}" text-anchor="${metricAnchor}" font-size="${line.size}" font-weight="${line.weight}" fill="${line.color}" paint-order="stroke fill" stroke="${background}" stroke-width="${line.strokeWidth}" stroke-linejoin="round">${escapeHtml(line.text)}</text>`;
      if (lineIndex < metricLines.length - 1) metricCursor += metricGap;
    });
    html += svgTextBlock(effectiveLabelX, titleStartY, labelLines, {
      fill: titleColor,
      fontSize: titleSize,
      weight: 800,
      anchor: effectiveLabelAnchor,
      lineHeight: titleLineHeight,
      haloColor: background,
      haloWidth: 5,
    });
    if (supportLines.length) {
      html += svgTextBlock(
        effectiveLabelX,
        titleStartY + labelLines.length * titleLineHeight + subtitleGap,
        supportLines,
        {
          fill: subtitleColor,
          fontSize: subtitleSize,
          weight: 500,
          anchor: effectiveLabelAnchor,
          lineHeight: subtitleLineHeight,
          haloColor: background,
          haloWidth: 4,
        }
      );
    }
    return html;
  };
  const renderLeftDetailLabel = (slice, box, index) => {
    const item = slice.item;
    const detailNodeId = `left-detail-${index}`;
    const detailFrame = editableNodeFrame(detailNodeId, leftDetailX, slice.top, leftDetailWidth, slice.height);
    const targetIndex = sourceSlices.indexOf(slice.targetSlice);
    const targetNodeId = targetIndex >= 0 ? `source-${targetIndex}` : null;
    const targetShift = targetNodeId ? editorOffsetForNode(targetNodeId) : { dx: 0, dy: 0 };
    const detailShift = editorOffsetForNode(detailNodeId);
    const compactMode = compactSources || item.compactLabel;
    const labelLines = resolveSourceLabelLines(item, {
      compactMode,
      fontSize: safeNumber(snapshot.layout?.detailSourceTitleSize, safeNumber(snapshot.layout?.sourceTemplateTitleSize, 28)),
      maxWidth: currentChartLanguage() === "zh" ? 166 : 198,
    });
    const labelX = detailSourceLabelX + detailShift.dx;
    const metricX = detailSourceMetricX + detailShift.dx;
    let block = `<path d="${detailSourceFlowPath(detailFrame.right, detailFrame.top, detailFrame.bottom, leftX + targetShift.dx, slice.targetTop + targetShift.dy, slice.targetBottom + targetShift.dy)}" fill="${item.flowColor || slice.targetSlice.item.flowColor}" opacity="0.98"></path>`;
    block += renderEditableNodeRect(detailFrame, item.nodeColor || slice.targetSlice.item.nodeColor);
    block += renderTemplateSourceAnnotation(item, slice, box, {
      density: "regular",
      labelLines,
      supportLines: [],
      labelX,
      labelAnchor: "end",
      metricX,
      metricAnchor: "start",
      metricPlacement: "above-ribbon",
      previousRibbonBottom: box?.previousRibbonBottom ?? null,
      ribbonTop: detailFrame.top,
      labelCenterY: detailFrame.centerY,
      clampLabelToBox: false,
      titleSize: safeNumber(snapshot.layout?.detailSourceTitleSize, safeNumber(snapshot.layout?.sourceTemplateTitleSize, 28)),
      titleLineHeight: safeNumber(snapshot.layout?.detailSourceTitleLineHeight, safeNumber(snapshot.layout?.sourceTemplateTitleLineHeight, 31)),
      subtitleSize: safeNumber(snapshot.layout?.detailSourceSubtitleSize, safeNumber(snapshot.layout?.sourceTemplateSubtitleSize, 14)),
      subtitleLineHeight: safeNumber(snapshot.layout?.detailSourceSubtitleLineHeight, safeNumber(snapshot.layout?.sourceTemplateSubtitleLineHeight, 17)),
      valueSize: safeNumber(snapshot.layout?.detailSourceValueSize, safeNumber(snapshot.layout?.sourceTemplateValueSize, 24)),
      yoySize: safeNumber(snapshot.layout?.detailSourceYoySize, safeNumber(snapshot.layout?.sourceTemplateYoySize, 14)),
      qoqSize: safeNumber(snapshot.layout?.detailSourceQoqSize, safeNumber(snapshot.layout?.sourceTemplateQoqSize, 14)),
      titleColor: item.nodeColor || item.labelColor || dark,
      valueColor: item.nodeColor || item.valueColor || item.labelColor || dark,
    });
    return block;
  };
  const renderLeftLabel = (slice, box, index) => {
    const item = slice.item;
    const sourceShift = editorOffsetForNode(`source-${index}`);
    const compactMode = compactSources || item.compactLabel;
    const labelLines = resolveSourceLabelLines(item, {
      compactMode,
      fontSize: safeNumber(snapshot.layout?.sourceTemplateTitleSize, 28),
      maxWidth: currentChartLanguage() === "zh" ? 166 : 198,
    });
    const labelX = safeNumber(slice.labelX, usesPreDetailRevenueLayout ? leftX - sourceSummaryLabelGapX : sourceTemplateLabelX) + sourceShift.dx;
    const metricX = safeNumber(slice.metricX, sourceTemplateMetricX) + sourceShift.dx;
    return renderTemplateSourceAnnotation(item, slice, box, {
      density: "regular",
      labelLines,
      supportLines: [],
      labelX,
      labelAnchor: "end",
      metricX,
      metricAnchor: "start",
      metricPlacement: "above-ribbon",
      previousRibbonBottom:
        index > 0
          ? safeNumber(sourceSlices[index - 1]?.bottom) + editorOffsetForNode(`source-${index - 1}`).dy
          : null,
      ribbonTop: slice.top + sourceShift.dy,
      labelCenterY: slice.center + sourceShift.dy,
      clampLabelToBox: false,
      titleSize: safeNumber(snapshot.layout?.sourceTemplateTitleSize, 28),
      titleLineHeight: safeNumber(snapshot.layout?.sourceTemplateTitleLineHeight, 31),
      subtitleSize: safeNumber(snapshot.layout?.sourceTemplateSubtitleSize, 14),
      subtitleLineHeight: safeNumber(snapshot.layout?.sourceTemplateSubtitleLineHeight, 17),
      valueSize: safeNumber(snapshot.layout?.sourceTemplateValueSize, 24),
      yoySize: safeNumber(snapshot.layout?.sourceTemplateYoySize, 14),
      qoqSize: safeNumber(snapshot.layout?.sourceTemplateQoqSize, 14),
      titleColor: item.nodeColor || item.labelColor || dark,
      valueColor: item.nodeColor || item.valueColor || item.labelColor || dark,
    });
  };
  const renderTreeLabelBlock = (item, box, labelX, color, options = {}) => {
    const baseLayout = box.layout || {};
    const resolvedDensity = options.density || baseLayout.density || (box.height <= 76 ? "dense" : "regular");
    const layout = replicaTreeBlockLayout(item, {
      density: resolvedDensity,
      defaultMode: options.defaultMode || "negative-parentheses",
      titleFontSize: safeNumber(options.titleFontSize, baseLayout.titleFontSize),
      titleLineHeight: safeNumber(options.titleLineHeight, baseLayout.titleLineHeight),
      noteFontSize: safeNumber(options.noteFontSize, baseLayout.noteFontSize),
      noteLineHeight: safeNumber(options.noteLineHeight, baseLayout.noteLineHeight),
      titleMaxWidth: options.maxWidth,
      noteMaxWidth: options.maxWidth,
      fallbackMinHeight: safeNumber(options.fallbackMinHeight, baseLayout.minHeight),
      topPadding: safeNumber(options.topPadding, baseLayout.topPadding),
      noteGap: safeNumber(options.noteGap, baseLayout.noteGap),
    });
    const titleLines =
      options.maxWidth && !item?.titleLines?.length
        ? resolveBranchTitleLines(item, options.defaultMode || "negative-parentheses", layout.titleFontSize, options.maxWidth)
        : localizeChartLines(layout.titleLines);
    const noteLines =
      options.maxWidth && !item?.noteLines?.length
        ? resolveTreeNoteLines(item, layout.density, layout.noteFontSize, options.maxWidth)
        : localizeChartLines(layout.noteLines);
    const titleBlockHeight = titleLines.length * layout.titleLineHeight;
    const noteOffsetY = clamp(
      safeNumber(options.noteOffsetY, 0),
      -Math.max(layout.titleLineHeight * 0.5, 0),
      Math.max(layout.noteLineHeight, 0)
    );
    const effectiveNoteGap = noteLines.length ? layout.noteGap + noteOffsetY : 0;
    const noteBlockHeight = noteLines.length ? noteLines.length * layout.noteLineHeight + effectiveNoteGap : 0;
    const totalBlockHeight = titleBlockHeight + noteBlockHeight;
    const labelCenterY = safeNumber(options.labelCenterY, box.center);
    const titleStartY = labelCenterY - totalBlockHeight / 2 + layout.titleLineHeight * 0.8;
    const defaultAnchor = options.anchor || "start";
    const shouldCenterWrapped = options.centerWrapped !== false && (titleLines.length > 1 || noteLines.length > 1);
    const effectiveAnchor = shouldCenterWrapped ? "middle" : defaultAnchor;
    const titleBlockWidth = approximateTextBlockWidth(titleLines, layout.titleFontSize);
    const noteBlockWidth = approximateTextBlockWidth(noteLines, layout.noteFontSize);
    const effectiveBlockWidth = Math.max(titleBlockWidth, noteBlockWidth, 0);
    const effectiveLabelX =
      effectiveAnchor === "middle" && defaultAnchor === "start"
        ? labelX + Math.min(effectiveBlockWidth, safeNumber(options.maxWidth, effectiveBlockWidth || 0)) / 2
        : labelX;
    let html = svgTextBlock(effectiveLabelX, titleStartY, titleLines, {
      fill: color,
      fontSize: layout.titleFontSize,
      weight: 700,
      anchor: effectiveAnchor,
      lineHeight: layout.titleLineHeight,
      haloColor: background,
      haloWidth: 7,
    });
    if (noteLines.length) {
      html += svgTextBlock(
        effectiveLabelX,
        titleStartY + titleBlockHeight + effectiveNoteGap,
        noteLines,
        {
          fill: muted,
          fontSize: layout.noteFontSize,
          weight: 400,
          anchor: effectiveAnchor,
          lineHeight: layout.noteLineHeight,
          haloColor: background,
          haloWidth: 5,
        }
      );
    }
    return html;
  };
  function resolveRightBranchLabelSpec(item, terminalNodeX, terminalNodeWidth, options = {}) {
    const labelX = safeNumber(options.labelX, terminalNodeX + terminalNodeWidth + rightBranchLabelGapX);
    const baseMaxWidth = Math.max(safeNumber(options.maxWidth, width - labelX - rightLabelPaddingRight), 120);
    const wrapMaxWidth = Math.min(
      baseMaxWidth,
      safeNumber(
        options.wrapMaxWidth,
        currentChartLanguage() === "zh"
          ? safeNumber(snapshot.layout?.rightBranchWrapMaxWidthZh, 136)
          : safeNumber(snapshot.layout?.rightBranchWrapMaxWidthEn, 196)
      )
    );
    const density = options.density || "regular";
    const titleFontSize = safeNumber(options.titleFontSize, safeNumber(snapshot.layout?.sourceTemplateTitleSize, 28));
    const titleLineHeight = safeNumber(
      options.titleLineHeight,
      safeNumber(snapshot.layout?.sourceTemplateTitleLineHeight, Math.max(Math.round(titleFontSize * 1.1), titleFontSize + 2))
    );
    const sharedGrowthNoteSize = safeNumber(
      snapshot.layout?.sourceTemplateYoySize,
      safeNumber(snapshot.layout?.sourceTemplateQoqSize, 14)
    );
    const sharedGrowthNoteLineHeight = Math.max(
      safeNumber(snapshot.layout?.sourceTemplateSubtitleLineHeight, currentChartLanguage() === "zh" ? 17 : 18),
      sharedGrowthNoteSize + (currentChartLanguage() === "zh" ? 3 : 4)
    );
    const noteFontSize = safeNumber(options.noteFontSize, sharedGrowthNoteSize);
    const noteLineHeight = safeNumber(options.noteLineHeight, sharedGrowthNoteLineHeight);
    const noteGap = safeNumber(
      options.noteGap,
      safeNumber(snapshot.layout?.rightBranchNoteGapY, currentChartLanguage() === "zh" ? 2 : 3)
    );
    const noteOffsetY = safeNumber(
      options.noteOffsetY,
      safeNumber(snapshot.layout?.rightBranchNoteOffsetY, currentChartLanguage() === "zh" ? -12 : -10)
    );
    const layout = replicaTreeBlockLayout(item, {
      density,
      defaultMode: options.defaultMode || "negative-parentheses",
      titleFontSize,
      titleLineHeight,
      noteFontSize,
      noteLineHeight,
      noteGap,
      titleMaxWidth: wrapMaxWidth,
      noteMaxWidth: wrapMaxWidth,
      fallbackMinHeight: safeNumber(options.fallbackMinHeight, density === "dense" ? 42 : 52),
    });
    return {
      labelX,
      maxWidth: wrapMaxWidth,
      titleFontSize,
      titleLineHeight,
      noteFontSize,
      noteLineHeight,
      noteGap,
      noteOffsetY,
      collisionHeight: Math.max(
        safeNumber(options.minCollisionHeight, 0),
        layout.totalHeight + noteOffsetY + safeNumber(options.collisionPaddingY, currentChartLanguage() === "zh" ? 18 : 14)
      ),
    };
  }
  const renderRightBranchLabel = (item, box, terminalNodeX, terminalNodeWidth, color, options = {}) =>
    {
      const labelSpec = resolveRightBranchLabelSpec(item, terminalNodeX, terminalNodeWidth, options);
      return renderTreeLabelBlock(item, box, labelSpec.labelX, color, {
        ...options,
        anchor: "start",
        centerWrapped: options.centerWrapped !== false,
        maxWidth: labelSpec.maxWidth,
        titleFontSize: labelSpec.titleFontSize,
        titleLineHeight: labelSpec.titleLineHeight,
        noteFontSize: labelSpec.noteFontSize,
        noteLineHeight: labelSpec.noteLineHeight,
        noteGap: labelSpec.noteGap,
        noteOffsetY: labelSpec.noteOffsetY,
        labelCenterY: safeNumber(options.labelCenterY, box.center),
      });
    };
  const renderRightSummaryLabel = (lines, labelX, labelCenterY) => {
    const blockHeight = lines.reduce((sum, line, index) => sum + line.size + (index < lines.length - 1 ? line.gapAfter : 0), 0);
    let cursor = labelCenterY - blockHeight / 2;
    return lines
      .map((line, index) => {
        cursor += line.size;
        const markup = `<text x="${labelX}" y="${cursor}" text-anchor="start" font-size="${line.size}" font-weight="${line.weight}" fill="${line.color}" paint-order="stroke fill" stroke="${background}" stroke-width="${line.strokeWidth}" stroke-linejoin="round">${escapeHtml(line.text)}</text>`;
        if (index < lines.length - 1) cursor += line.gapAfter;
        return markup;
      })
      .join("");
  };
  const rightSummaryObstacleRect = (lines, labelX, labelCenterY, padding = scaleY(10)) => {
    const blockHeight = lines.reduce((sum, line, index) => sum + line.size + (index < lines.length - 1 ? line.gapAfter : 0), 0);
    const blockWidth = Math.max(...lines.map((line) => approximateTextWidth(line.text, line.size)), 1);
    return {
      left: labelX - padding,
      right: labelX + blockWidth + padding,
      top: labelCenterY - blockHeight / 2 - padding,
      bottom: labelCenterY + blockHeight / 2 + padding,
    };
  };
  const renderTerminalCapRibbon = ({
    sourceX,
    sourceTop,
    sourceBottom,
    capX,
    capWidth,
    targetTop,
    targetHeight,
    flowColor,
    capColor,
      branchOptions = {},
      opacity = 0.97,
  }) => {
    const sourceCoverInset = Math.max(safeNumber(branchOptions.sourceCoverInsetX, safeNumber(snapshot.layout?.branchSourceCoverInsetX, 1.5)), 0);
    const mergedBranchOptions = {
      ...mergeOutflowRibbonOptions(branchOptions),
      endCapWidth: 0,
      targetCoverInsetX: safeNumber(branchOptions.targetCoverInsetX, safeNumber(snapshot.layout?.branchTargetCoverInsetX, 14)),
    };
    let html = `<path d="${outboundFlowPath(
      sourceX - sourceCoverInset,
      sourceTop,
      sourceBottom,
      capX,
      targetTop,
      targetTop + targetHeight,
      mergedBranchOptions
    )}" fill="${flowColor}" opacity="${opacity}"></path>`;
    if (capColor) {
      html += `<rect x="${capX.toFixed(1)}" y="${targetTop.toFixed(1)}" width="${capWidth.toFixed(1)}" height="${targetHeight.toFixed(1)}" fill="${capColor}"></rect>`;
    }
    return html;
  };
  const mirrorFlowBoundaryOptions = (options = {}) => ({
    ...options,
    sourceHoldFactor: safeNumber(options.targetHoldFactor, options.sourceHoldFactor),
    minSourceHoldLength: safeNumber(options.minTargetHoldLength, options.minSourceHoldLength),
    maxSourceHoldLength: safeNumber(options.maxTargetHoldLength, options.maxSourceHoldLength),
    sourceHoldLength:
      options.targetHoldLength !== null && options.targetHoldLength !== undefined
        ? safeNumber(options.targetHoldLength)
        : undefined,
    targetHoldFactor: safeNumber(options.sourceHoldFactor, options.targetHoldFactor),
    minTargetHoldLength: safeNumber(options.minSourceHoldLength, options.minTargetHoldLength),
    maxTargetHoldLength: safeNumber(options.maxSourceHoldLength, options.maxTargetHoldLength),
    targetHoldLength:
      options.sourceHoldLength !== null && options.sourceHoldLength !== undefined
        ? safeNumber(options.sourceHoldLength)
        : undefined,
    sourceHoldDeltaReduction: safeNumber(options.targetHoldDeltaReduction, options.sourceHoldDeltaReduction),
    targetHoldDeltaReduction: safeNumber(options.sourceHoldDeltaReduction, options.targetHoldDeltaReduction),
    minAdaptiveSourceHoldLength: safeNumber(options.minAdaptiveTargetHoldLength, options.minAdaptiveSourceHoldLength),
    minAdaptiveTargetHoldLength: safeNumber(options.minAdaptiveSourceHoldLength, options.minAdaptiveTargetHoldLength),
    startCurveFactor: safeNumber(options.endCurveFactor, options.startCurveFactor),
    endCurveFactor: safeNumber(options.startCurveFactor, options.endCurveFactor),
    minStartCurveFactor: safeNumber(options.minEndCurveFactor, options.minStartCurveFactor),
    maxStartCurveFactor: safeNumber(options.maxEndCurveFactor, options.maxStartCurveFactor),
    minEndCurveFactor: safeNumber(options.minStartCurveFactor, options.minEndCurveFactor),
    maxEndCurveFactor: safeNumber(options.maxStartCurveFactor, options.maxEndCurveFactor),
  });
  const buildFlowBoundarySegment = (startX, startY, endX, endY, options = {}) => {
    const geometry = resolveFlowCurveGeometry(startX, startY, startY, endX, endY, endY, options);
    if (Math.abs(geometry.targetJoinX - geometry.sourceJoinX) <= 0.5) {
      return `L ${endX} ${endY}`;
    }
    return [
      `L ${geometry.sourceJoinX} ${startY}`,
      smoothBoundaryCurve(geometry.sourceJoinX, geometry.targetJoinX, startY, endY, {
        startCurve: geometry.topStartCurve,
        endCurve: geometry.topEndCurve,
      }),
      `L ${endX} ${endY}`,
    ].join(" ");
  };
  const selectedEditorNodeId = String(snapshot.editorSelectedNodeId || "");
  const setAutoLayoutNodeOffset = (nodeId, nextOffset = {}) => {
    if (!nodeId) return;
    const previous = autoLayoutOffsetForNode(nodeId);
    const resolvedOffset = {
      dx: safeNumber(nextOffset.dx, previous.dx),
      dy: safeNumber(nextOffset.dy, previous.dy),
    };
    if (Math.abs(resolvedOffset.dx) <= 0.01 && Math.abs(resolvedOffset.dy) <= 0.01) {
      delete autoLayoutNodeOffsets[nodeId];
      return;
    }
    autoLayoutNodeOffsets[nodeId] = resolvedOffset;
  };
  const editorOffsetForNode = (nodeId, options = {}) => combinedNodeOffsetFor(nodeId, options);
  const editableNodeFrame = (nodeId, x, y, widthValue, heightValue) => {
    const offset = editorOffsetForNode(nodeId);
    return {
      id: nodeId,
      x: x + offset.dx,
      y: y + offset.dy,
      width: widthValue,
      height: heightValue,
      left: x + offset.dx,
      right: x + offset.dx + widthValue,
      top: y + offset.dy,
      bottom: y + offset.dy + heightValue,
      centerX: x + offset.dx + widthValue / 2,
      centerY: y + offset.dy + heightValue / 2,
      dx: offset.dx,
      dy: offset.dy,
    };
  };
  const resolveDeductionTerminalSourceSlice = (index, sourceSlice) =>
    index === 0 && positiveAdjustments.length && !positiveAbove
      ? {
          ...sourceSlice,
          center: clamp(
            sourceSlice.center + positiveTaxSourceDropY,
            opDeductionSourceBand.top + sourceSlice.height / 2,
            opDeductionSourceBand.bottom - sourceSlice.height / 2
          ),
        }
      : sourceSlice;
  const resolveDeductionTerminalBranchOptions = (index) =>
    index === 0 && positiveAdjustments.length && !positiveAbove
      ? {
          curveFactor: 0.52,
          startCurveFactor: 0.16,
          endCurveFactor: 0.24,
          minStartCurveFactor: 0.12,
          maxStartCurveFactor: 0.24,
          minEndCurveFactor: 0.18,
          maxEndCurveFactor: 0.3,
          deltaScale: 0.92,
          deltaInfluence: 0.046,
          sourceHoldFactor: 0.036,
          maxSourceHoldLength: 12,
        }
      : {
          curveFactor: 0.5,
          startCurveFactor: 0.16,
          endCurveFactor: 0.24,
          minStartCurveFactor: 0.12,
          maxStartCurveFactor: 0.24,
          minEndCurveFactor: 0.16,
          maxEndCurveFactor: 0.3,
          deltaScale: 0.9,
          deltaInfluence: 0.05,
          sourceHoldFactor: 0.034,
          maxSourceHoldLength: 10,
        };
  const resolveNegativeTerminalGeometry = (entry, options = {}) => {
    if (!entry?.box || !entry?.sourceSlice) return null;
    const sourceSlice =
      entry.lane === "deduction"
        ? resolveDeductionTerminalSourceSlice(entry.index, entry.sourceSlice)
        : entry.sourceSlice;
    const resolvedCenter = safeNumber(options.center, entry.box.center);
    const bridge = constantThicknessBridge(sourceSlice, resolvedCenter, entry.minHeight, entry.sourceTop, entry.sourceBottom);
    const includeManualOffsets = options.includeManualOffsets === true;
    const sourceShift = editorOffsetForNode(entry.sourceNodeId, { includeManual: includeManualOffsets });
    const targetShift = editorOffsetForNode(entry.targetNodeId, { includeManual: includeManualOffsets });
    const targetTop = bridge.targetTop + targetShift.dy;
    return {
      bridge,
      sourceTop: bridge.sourceTop + sourceShift.dy,
      sourceBottom: bridge.sourceBottom + sourceShift.dy,
      targetTop,
      targetHeight: bridge.targetHeight,
      targetBottom: targetTop + bridge.targetHeight,
      targetCenter: targetTop + bridge.targetHeight / 2,
    };
  };
  const shiftedInterval = (topValue, bottomValue, nodeId) => {
    const offset = editorOffsetForNode(nodeId);
    return {
      top: topValue + offset.dy,
      bottom: bottomValue + offset.dy,
      height: bottomValue - topValue,
      center: (topValue + bottomValue) / 2 + offset.dy,
    };
  };
  const renderEditableNodeRect = (frame, fill, options = {}) => {
    const hitPaddingX = safeNumber(options.hitPaddingX, Math.max(12, (28 - frame.width) / 2));
    const hitPaddingY = safeNumber(options.hitPaddingY, Math.max(10, (24 - frame.height) / 2));
    const isSelected = selectedEditorNodeId === frame.id;
    const visibleStroke = isSelected ? ` stroke="${rgba("#175C8E", 0.8)}" stroke-width="3"` : "";
    return `
      <rect x="${frame.x.toFixed(1)}" y="${frame.y.toFixed(1)}" width="${frame.width.toFixed(1)}" height="${frame.height.toFixed(1)}" fill="${fill}"${visibleStroke}></rect>
      <rect x="${(frame.x - hitPaddingX).toFixed(1)}" y="${(frame.y - hitPaddingY).toFixed(1)}" width="${(frame.width + hitPaddingX * 2).toFixed(1)}" height="${(frame.height + hitPaddingY * 2).toFixed(1)}" fill="transparent" opacity="0.001" data-edit-hit="true" data-edit-node-id="${escapeHtml(frame.id)}"></rect>
    `;
  };
  const standardTerminalBranchOptions = {
    curveFactor: 0.56,
    startCurveFactor: 0.18,
    endCurveFactor: 0.3,
    minStartCurveFactor: 0.14,
    maxStartCurveFactor: 0.28,
    minEndCurveFactor: 0.2,
    maxEndCurveFactor: 0.34,
    deltaScale: 0.96,
    deltaInfluence: 0.042,
    sourceHoldFactor: 0.03,
    minSourceHoldLength: 4,
    maxSourceHoldLength: 8,
    targetHoldFactor: 0.072,
    minTargetHoldLength: 8,
    maxTargetHoldLength: 22,
    sourceHoldDeltaReduction: 0.72,
    targetHoldDeltaReduction: 0.82,
    minAdaptiveSourceHoldLength: 1.5,
    minAdaptiveTargetHoldLength: 2.5,
    holdDeltaScale: 0.46,
  };
  const resolveAdaptiveNegativeTerminalBranchOptions = (baseOptions, sourceTop, sourceBottom, targetTop, targetHeight, options = {}) => {
    const sourceCenter = (safeNumber(sourceTop, 0) + safeNumber(sourceBottom, 0)) / 2;
    const targetCenter = safeNumber(targetTop, 0) + safeNumber(targetHeight, 0) / 2;
    const deltaY = Math.abs(targetCenter - sourceCenter);
    const count = Math.max(safeNumber(options.count, 1), 1);
    const index = clamp(safeNumber(options.index, 0), 0, Math.max(count - 1, 0));
    const laneBias = safeNumber(options.laneBias, 0);
    const orderNorm = count <= 1 ? 0 : index / Math.max(count - 1, 1);
    const countNorm = clamp((count - 1) / 3, 0, 1);
    const deltaNorm = clamp(deltaY / scaleY(safeNumber(options.referenceDeltaY, 196)), 0, 1.8);
    const divergenceStrength = clamp(
      deltaNorm * safeNumber(options.deltaStrengthFactor, 0.92) +
        orderNorm * safeNumber(options.orderStrengthFactor, 0.28) +
        laneBias +
        countNorm * safeNumber(options.countStrengthFactor, 0.14),
      0,
      1.32
    );
    const minSourceHoldLength = Math.max(
      0,
      safeNumber(baseOptions.minSourceHoldLength, 0) -
        safeNumber(options.minSourceHoldReduction, 7) * divergenceStrength
    );
    const maxSourceHoldLength = Math.max(
      minSourceHoldLength,
      safeNumber(baseOptions.maxSourceHoldLength, minSourceHoldLength) -
        safeNumber(options.maxSourceHoldReduction, 12) * divergenceStrength
    );
    return {
      ...baseOptions,
      curveFactor: clamp(
        safeNumber(baseOptions.curveFactor, 0.56) + safeNumber(options.curveFactorGain, 0.08) * divergenceStrength,
        0.5,
        0.9
      ),
      startCurveFactor: clamp(
        safeNumber(baseOptions.startCurveFactor, 0.18) + safeNumber(options.startCurveGain, 0.14) * divergenceStrength,
        safeNumber(baseOptions.minStartCurveFactor, 0.14),
        safeNumber(baseOptions.maxStartCurveFactor, 0.28) + safeNumber(options.maxStartCurveBoost, 0.08) * divergenceStrength
      ),
      endCurveFactor: clamp(
        safeNumber(baseOptions.endCurveFactor, 0.3) + safeNumber(options.endCurveGain, 0.1) * divergenceStrength,
        safeNumber(baseOptions.minEndCurveFactor, 0.2),
        safeNumber(baseOptions.maxEndCurveFactor, 0.34) + safeNumber(options.maxEndCurveBoost, 0.08) * divergenceStrength
      ),
      minStartCurveFactor: clamp(
        safeNumber(baseOptions.minStartCurveFactor, 0.14) + safeNumber(options.minStartCurveGain, 0.05) * divergenceStrength,
        0.08,
        0.42
      ),
      maxStartCurveFactor: clamp(
        safeNumber(baseOptions.maxStartCurveFactor, 0.28) + safeNumber(options.maxStartCurveGain, 0.08) * divergenceStrength,
        0.16,
        0.52
      ),
      minEndCurveFactor: clamp(
        safeNumber(baseOptions.minEndCurveFactor, 0.2) + safeNumber(options.minEndCurveGain, 0.04) * divergenceStrength,
        0.14,
        0.42
      ),
      maxEndCurveFactor: clamp(
        safeNumber(baseOptions.maxEndCurveFactor, 0.34) + safeNumber(options.maxEndCurveGain, 0.08) * divergenceStrength,
        0.24,
        0.58
      ),
      deltaScale: clamp(
        safeNumber(baseOptions.deltaScale, 0.96) - safeNumber(options.deltaScaleReduction, 0.1) * divergenceStrength,
        0.68,
        1.08
      ),
      deltaInfluence: clamp(
        safeNumber(baseOptions.deltaInfluence, 0.042) + safeNumber(options.deltaInfluenceGain, 0.022) * divergenceStrength,
        0.018,
        0.14
      ),
      sourceHoldFactor: clamp(
        safeNumber(baseOptions.sourceHoldFactor, 0.03) - safeNumber(options.sourceHoldReduction, 0.022) * divergenceStrength,
        0.004,
        0.08
      ),
      minSourceHoldLength,
      maxSourceHoldLength,
      sourceHoldDeltaReduction: clamp(
        safeNumber(baseOptions.sourceHoldDeltaReduction, 0.72) + safeNumber(options.sourceDeltaReductionGain, 0.12) * divergenceStrength,
        0,
        0.96
      ),
      holdDeltaScale: clamp(
        safeNumber(baseOptions.holdDeltaScale, 0.46) - safeNumber(options.holdDeltaScaleReduction, 0.08) * divergenceStrength,
        0.24,
        0.7
      ),
    };
  };
  const costBreakdownTerminalBranchOptions = {
    ...standardTerminalBranchOptions,
    curveFactor: 0.6,
    startCurveFactor: 0.13,
    endCurveFactor: 0.3,
    minStartCurveFactor: 0.1,
    maxStartCurveFactor: 0.2,
    minEndCurveFactor: 0.2,
    maxEndCurveFactor: 0.34,
    deltaScale: 0.9,
    deltaInfluence: 0.038,
    sourceHoldFactor: 0.062,
    minSourceHoldLength: 12,
    maxSourceHoldLength: 26,
    targetHoldFactor: 0.084,
    minTargetHoldLength: 10,
    maxTargetHoldLength: 24,
    sourceHoldDeltaReduction: 0.62,
    targetHoldDeltaReduction: 0.74,
    minAdaptiveSourceHoldLength: 3,
    minAdaptiveTargetHoldLength: 3,
    holdDeltaScale: 0.5,
  };
  const costBreakdownCrowdingNorm = clamp(lowerRightPressureY / scaleY(88), 0, 1);
  const costBreakdownEarlySplitMode = costBreakdownNearOpexColumn || costBreakdownCrowdingNorm >= 0.28;
  const resolvedCostBreakdownTerminalBranchOptions =
    costBreakdownSlices.length <= 2
      ? {
          ...costBreakdownTerminalBranchOptions,
          curveFactor: costBreakdownEarlySplitMode ? 0.74 : 0.68,
          startCurveFactor: costBreakdownEarlySplitMode ? 0.18 : 0.09,
          endCurveFactor: costBreakdownEarlySplitMode ? 0.38 : 0.34,
          minStartCurveFactor: costBreakdownEarlySplitMode ? 0.12 : 0.05,
          maxStartCurveFactor: costBreakdownEarlySplitMode ? 0.24 : 0.12,
          minEndCurveFactor: 0.22,
          maxEndCurveFactor: costBreakdownEarlySplitMode ? 0.4 : 0.36,
          deltaScale: costBreakdownEarlySplitMode ? 0.78 : 0.88,
          deltaInfluence: costBreakdownEarlySplitMode ? 0.032 : 0.05,
          sourceHoldFactor: costBreakdownEarlySplitMode ? 0.034 : 0.1,
          minSourceHoldLength: costBreakdownEarlySplitMode ? 4 : 28,
          maxSourceHoldLength: costBreakdownEarlySplitMode ? 16 : 44,
          targetHoldFactor: costBreakdownEarlySplitMode ? 0.038 : 0.052,
          minTargetHoldLength: costBreakdownEarlySplitMode ? 4 : 6,
          maxTargetHoldLength: costBreakdownEarlySplitMode ? 9 : 12,
          sourceHoldDeltaReduction: costBreakdownEarlySplitMode ? 0.76 : 0,
          targetHoldDeltaReduction: costBreakdownEarlySplitMode ? 0.68 : 0.52,
          minAdaptiveSourceHoldLength: costBreakdownEarlySplitMode ? 1 : 22,
          minAdaptiveTargetHoldLength: 2,
          holdDeltaScale: costBreakdownEarlySplitMode ? 0.42 : 0.56,
        }
      : costBreakdownSlices.length === 3
        ? {
            ...costBreakdownTerminalBranchOptions,
            curveFactor: 0.64,
            startCurveFactor: 0.15,
            endCurveFactor: 0.32,
            sourceHoldFactor: 0.04,
            minSourceHoldLength: 8,
            maxSourceHoldLength: 16,
            targetHoldFactor: 0.074,
            maxTargetHoldLength: 20,
          }
        : costBreakdownTerminalBranchOptions;
  const refineOpexSplitSmoothness = () => {
    if (!opexBoxes.length || !opexSourceSlices.length) return;
    const currentOpexNodeShift = layoutReferenceOffsetFor("operating-expenses");
    const currentNodeOffsetY = currentOpexNodeShift.dy;
    const denseOpexStageBalance = !costBreakdownBoxes.length && opexBoxes.filter(Boolean).length >= 3;
    const relevantOpexIndexes = opexBoxes
      .map((box, index) => ({ box, index }))
      .filter((entry) => entry.box)
      .slice(0, Math.min(opexBoxes.length, denseOpexStageBalance ? 3 : 2))
      .map((entry) => entry.index);
    if (!relevantOpexIndexes.length) return;
    const currentTopGapY =
      Math.min(...relevantOpexIndexes.map((index) => safeNumber(opexBoxes[index]?.top, Infinity))) - (opexBottom + currentNodeOffsetY);
    const currentOpeningGapY = opexTop + currentNodeOffsetY - grossBottom;
    const currentAverageBranchDropY =
      relevantOpexIndexes.reduce((sum, index) => {
        const box = opexBoxes[index];
        const sourceSlice = opexSourceSlices[index] || opexSlices[index];
        if (!box || !sourceSlice) return sum;
        return sum + (safeNumber(box.center, 0) - (safeNumber(sourceSlice.center, 0) + currentNodeOffsetY));
      }, 0) / Math.max(relevantOpexIndexes.length, 1);
    const sampleXsAcrossRange = (left, right, count = 7) => {
      if (!(right > left)) return [left];
      return Array.from({ length: count }, (_value, index) => left + ((right - left) * index) / Math.max(count - 1, 1));
    };
    const evaluateCostBreakdownSummaryClearance = (nodeDropY, costShiftY) => {
      if (!(costBreakdownSharesOpexColumn && costBreakdownBoxes.length)) {
        return {
          deficitY: 0,
          minGapY: Infinity,
        };
      }
      const summaryObstacle = resolveOpexSummaryObstacleRect(
        {
          dx: currentOpexNodeShift.dx,
          dy: currentNodeOffsetY + nodeDropY,
        },
        0,
        {
          padX: safeNumber(snapshot.layout?.costBreakdownOpexRibbonObstaclePadX, 10),
          padY: safeNumber(snapshot.layout?.costBreakdownOpexRibbonObstaclePadY, 8),
        }
      );
      const sourceShift = layoutReferenceOffsetFor("cost");
      const ribbonClearanceY = scaleY(safeNumber(snapshot.layout?.costBreakdownOpexRibbonClearanceY, 10));
      const summaryClearanceY = scaleY(
        safeNumber(
          snapshot.layout?.costBreakdownOpexSummaryClearanceY,
          costBreakdownSlices.length === 2 && costBreakdownSharesOpexColumn ? 18 : 14
        )
      );
      const nodeClearanceY = scaleY(safeNumber(snapshot.layout?.costBreakdownOpexNodeClearanceY, 8));
      let minGapY = Infinity;
      let deficitY = 0;
      costBreakdownBoxes.forEach((box, index) => {
        const sourceSlice = costBreakdownSourceSlices[index] || costBreakdownSlices[index];
        if (!box || !sourceSlice) return;
        const targetShift = layoutReferenceOffsetFor(`cost-breakdown-${index}`);
        const shiftedCenter = safeNumber(box.center, 0) + costShiftY;
        const collisionHeight = Math.max(
          safeNumber(costBreakdownGapHeights[index], box.height),
          safeNumber(costBreakdownPackingHeights[index], box.height),
          safeNumber(box.height, 0),
          1
        );
        const collisionTop = shiftedCenter + targetShift.dy - collisionHeight / 2;
        const nodeTop = safeNumber(box.top, 0) + targetShift.dy + costShiftY;
        minGapY = Math.min(minGapY, collisionTop - summaryObstacle.bottom, nodeTop - summaryObstacle.bottom);
        deficitY = Math.max(
          deficitY,
          summaryObstacle.bottom + summaryClearanceY - collisionTop,
          summaryObstacle.bottom + nodeClearanceY - nodeTop
        );
        const sourceCoverInset = Math.max(
          safeNumber(resolvedCostBreakdownTerminalBranchOptions.sourceCoverInsetX, safeNumber(snapshot.layout?.branchSourceCoverInsetX, 1.5)),
          0
        );
        const mergedBranchOptions = {
          ...mergeOutflowRibbonOptions(resolvedCostBreakdownTerminalBranchOptions),
          endCapWidth: 0,
          targetCoverInsetX: safeNumber(
            resolvedCostBreakdownTerminalBranchOptions.targetCoverInsetX,
            safeNumber(snapshot.layout?.branchTargetCoverInsetX, 14)
          ),
        };
        const bridge = constantThicknessBridge(sourceSlice, shiftedCenter, 10, costTop, costBottom);
        const sourceX = grossX + nodeWidth + sourceShift.dx - sourceCoverInset;
        const sourceTop = bridge.sourceTop + sourceShift.dy;
        const sourceBottom = bridge.sourceBottom + sourceShift.dy;
        const targetX = costBreakdownX + targetShift.dx + mergedBranchOptions.targetCoverInsetX;
        const targetTop = bridge.targetTop + targetShift.dy + costShiftY;
        const targetBottom = targetTop + bridge.targetHeight;
        const overlapLeft = Math.max(summaryObstacle.left, sourceX + scaleY(4));
        const overlapRight = Math.min(summaryObstacle.right, targetX - scaleY(4));
        if (!(overlapRight > overlapLeft) || targetBottom <= summaryObstacle.top) return;
        sampleXsAcrossRange(overlapLeft, overlapRight).forEach((sampleX) => {
          const envelope = flowEnvelopeAtX(
            sampleX,
            sourceX,
            sourceTop,
            sourceBottom,
            targetX,
            targetTop,
            targetBottom,
            mergedBranchOptions
          );
          if (!envelope) return;
          minGapY = Math.min(minGapY, envelope.top - summaryObstacle.bottom);
          deficitY = Math.max(deficitY, summaryObstacle.bottom + ribbonClearanceY - envelope.top);
        });
      });
      return {
        deficitY: Math.max(deficitY, 0),
        minGapY,
      };
    };
    const currentCostClusterGapY = costBreakdownBoxes.length
      ? Math.min(
          ...costBreakdownBoxes.filter(Boolean).map((box, index) => {
            const shift = layoutReferenceOffsetFor(`cost-breakdown-${index}`);
            return safeNumber(box.top, Infinity) + shift.dy;
          })
        ) - (opexBottom + currentNodeOffsetY)
      : 0;
    const currentSummaryCostClearance = evaluateCostBreakdownSummaryClearance(0, 0);
    const branchSeverityThresholdY = scaleY(
      safeNumber(snapshot.layout?.opexSmoothSeverityThresholdY, costBreakdownBoxes.length >= 2 ? 222 : 246)
    );
    const topGapThresholdY = scaleY(
      safeNumber(snapshot.layout?.opexSmoothTopGapThresholdY, costBreakdownBoxes.length >= 2 ? 176 : 188)
    );
    const costClusterGapSeverityY = scaleY(
      safeNumber(snapshot.layout?.opexSmoothCostClusterGapSeverityY, costBreakdownBoxes.length >= 2 ? 212 : 196)
    );
    const summaryGapSeverityY = scaleY(
      safeNumber(snapshot.layout?.opexSmoothSummaryGapSeverityY, costBreakdownBoxes.length >= 2 ? 24 : 20)
    );
    const minOpeningGapY = scaleY(safeNumber(snapshot.layout?.opexSmoothMinOpeningGapY, denseOpexStageBalance ? 24 : 18));
    const preferredOpeningGapY = clamp(
      safeNumber(
        snapshot.layout?.opexSmoothPreferredOpeningGapResolvedY,
        Math.max(
          scaleY(safeNumber(snapshot.layout?.opexSmoothPreferredOpeningGapY, denseOpexStageBalance ? 44 : 30)),
          desiredGrossLowerSplitOpeningDeltaY *
            safeNumber(snapshot.layout?.opexSmoothPreferredOpeningGapMatchFactor, denseOpexStageBalance ? 1.08 : 0.94)
        )
      ),
      minOpeningGapY,
      scaleY(safeNumber(snapshot.layout?.opexSmoothMaxOpeningGapY, denseOpexStageBalance ? 76 : 60))
    );
    const openingGapSeverityY = Math.max(
      minOpeningGapY,
      preferredOpeningGapY - scaleY(safeNumber(snapshot.layout?.opexSmoothOpeningGapSeverityToleranceY, denseOpexStageBalance ? 8 : 6))
    );
    const preferredTopGapY = scaleY(
      safeNumber(snapshot.layout?.opexSmoothPreferredNodeToTerminalGapY, costBreakdownBoxes.length >= 2 ? 104 : 100)
    );
    if (
      !(
        currentAverageBranchDropY > branchSeverityThresholdY ||
        currentTopGapY > topGapThresholdY ||
        currentOpeningGapY < openingGapSeverityY ||
        currentCostClusterGapY > costClusterGapSeverityY ||
        currentSummaryCostClearance.deficitY > 0.5 ||
        currentSummaryCostClearance.minGapY < summaryGapSeverityY
      )
    ) {
      return;
    }
    const costFollowFactor = costBreakdownBoxes.length
      ? clamp(
          safeNumber(snapshot.layout?.opexSmoothCostFollowFactor, costBreakdownBoxes.length >= 2 ? 1.04 : 0.94),
          0,
          1.34
        )
      : 0;
    const costShiftHeadroomY = costBreakdownBoxes.length
      ? Math.max(
          maxCollisionBasedGroupShiftDown(costBreakdownBoxes, costBreakdownPackingHeights, costBreakdownMaxY),
          maxActualBoxGroupShiftDown(costBreakdownBoxes, costBreakdownMaxY)
        )
      : 0;
    const nodeDropHeadroomFromCostY = costFollowFactor > 0.01 ? costShiftHeadroomY / costFollowFactor : Infinity;
    const denseNodeDropBoostY = denseOpexStageBalance
      ? Math.min(
          scaleY(safeNumber(snapshot.layout?.opexSmoothDenseNodeDropBoostMaxY, 34)),
          Math.max(preferredOpeningGapY - currentOpeningGapY, 0) * 0.82 +
            Math.max(currentTopGapY - preferredTopGapY, 0) * 0.18
        )
      : 0;
    const nodeDropMaxY = Math.max(
      0,
      Math.min(
        scaleY(safeNumber(snapshot.layout?.opexSmoothNodeDropMaxY, costBreakdownBoxes.length ? 92 : denseOpexStageBalance ? 86 : 34)) +
          denseNodeDropBoostY,
        nodeDropHeadroomFromCostY
      )
    );
    const costExtraShiftMaxY =
      costBreakdownSharesOpexColumn && costBreakdownBoxes.length
        ? Math.max(
            0,
            Math.min(
              scaleY(safeNumber(snapshot.layout?.opexSmoothCostExtraShiftMaxY, costBreakdownBoxes.length >= 2 ? 42 : 28)),
              costShiftHeadroomY
            )
          )
        : 0;
    const rightLaneEntries = [
      ...deductionBoxes.filter(Boolean).map((box) => ({ lane: "deduction", box })),
      ...opexBoxes.filter(Boolean).map((box) => ({ lane: "opex", box })),
      ...(costBreakdownSharesOpexColumn ? costBreakdownBoxes.filter(Boolean).map((box) => ({ lane: "costBreakdown", box })) : []),
    ].sort((left, right) => left.box.center - right.box.center);
    const firstOpexEntryIndex = rightLaneEntries.findIndex((entry) => entry.lane === "opex");
    const previousNonOpexEntry =
      firstOpexEntryIndex > 0
        ? [...rightLaneEntries.slice(0, firstOpexEntryIndex)].reverse().find((entry) => entry.lane !== "opex")
        : null;
    const opexLiftFloorTop = previousNonOpexEntry
      ? previousNonOpexEntry.box.bottom + rightTerminalSeparationGap
      : Math.max(
          rightTerminalSummaryObstacleBottom,
          netBottom + scaleY(safeNumber(snapshot.layout?.opexSmoothMinOffsetFromNetY, 18))
        );
    const currentOpexGroupTop = Math.min(...opexBoxes.filter(Boolean).map((box) => box.top));
    const opexLiftMaxY = Math.max(
      0,
      Math.min(
        scaleY(safeNumber(snapshot.layout?.opexSmoothTerminalLiftMaxY, 72)),
        Math.max(currentOpexGroupTop - opexLiftFloorTop, 0)
      )
    );
    if (!(nodeDropMaxY > 0.5 || opexLiftMaxY > 0.5 || costExtraShiftMaxY > 0.5)) return;
    const buildAxisCandidates = (maxY, segments = 6) =>
      Array.from(
        new Set(
          [0, maxY, ...Array.from({ length: segments + 1 }, (_unused, index) => (maxY * index) / Math.max(segments, 1))].map(
            (value) => Number(clamp(value, 0, maxY).toFixed(2))
          )
        )
      );
    const nodeDropCandidates = buildAxisCandidates(nodeDropMaxY, costBreakdownBoxes.length ? 6 : 4);
    const opexLiftCandidates = buildAxisCandidates(opexLiftMaxY, 6);
    const costExtraShiftCandidates = buildAxisCandidates(costExtraShiftMaxY, costBreakdownBoxes.length ? 4 : 1);
    const minTopGapY = scaleY(safeNumber(snapshot.layout?.opexSmoothMinNodeToTerminalGapY, 84));
    const maxTopGapY = scaleY(safeNumber(snapshot.layout?.opexSmoothMaxNodeToTerminalGapY, costBreakdownBoxes.length >= 2 ? 176 : 164));
    const preferredInboundDeltaY = scaleY(safeNumber(snapshot.layout?.opexSmoothPreferredInboundDeltaY, 22));
    const maxInboundDeltaY = scaleY(safeNumber(snapshot.layout?.opexSmoothMaxInboundDeltaY, 54));
    const preferredBranchDropBaseY = scaleY(
      safeNumber(snapshot.layout?.opexSmoothPreferredBranchDropBaseY, opexBoxes.length <= 2 ? 148 : 140)
    );
    const preferredBranchDropStepY = scaleY(
      safeNumber(snapshot.layout?.opexSmoothPreferredBranchDropStepY, opexBoxes.length <= 2 ? 134 : 88)
    );
    const minCostClusterGapY = scaleY(safeNumber(snapshot.layout?.opexSmoothMinCostClusterGapY, 116));
    const preferredCostClusterGapY = scaleY(
      safeNumber(snapshot.layout?.opexSmoothPreferredCostClusterGapY, costBreakdownBoxes.length >= 2 ? 160 : 138)
    );
    const minSummaryClearanceGapY = scaleY(
      safeNumber(snapshot.layout?.opexSmoothMinSummaryClearanceGapY, costBreakdownBoxes.length >= 2 ? 28 : 24)
    );
    const preferredSummaryClearanceGapY = scaleY(
      safeNumber(snapshot.layout?.opexSmoothPreferredSummaryClearanceGapY, costBreakdownBoxes.length >= 2 ? 46 : 38)
    );
    const evaluateCandidate = (nodeDropY, opexLiftY, costExtraShiftY) => {
      const costShiftY = Math.min(costShiftHeadroomY, nodeDropY * costFollowFactor + costExtraShiftY);
      const topGapY =
        Math.min(...relevantOpexIndexes.map((index) => safeNumber(opexBoxes[index]?.top, Infinity) - opexLiftY)) -
        (opexBottom + currentNodeOffsetY + nodeDropY);
      const openingGapY = opexTop + currentNodeOffsetY + nodeDropY - grossBottom;
      let score = 0;
      relevantOpexIndexes.forEach((index, orderIndex) => {
        const box = opexBoxes[index];
        const sourceSlice = opexSourceSlices[index] || opexSlices[index];
        if (!box || !sourceSlice) return;
        const branchDropY =
          safeNumber(box.center, 0) - opexLiftY - (safeNumber(sourceSlice.center, 0) + currentNodeOffsetY + nodeDropY);
        const preferredBranchDropY =
          preferredBranchDropBaseY +
          orderIndex * preferredBranchDropStepY +
          Math.min(Math.max(safeNumber(sourceSlice.height, 0) - 28, 0), scaleY(42)) * 0.18;
        const minBranchDropY = scaleY(
          safeNumber(snapshot.layout?.opexSmoothMinBranchDropBaseY, 112) +
            orderIndex * safeNumber(snapshot.layout?.opexSmoothMinBranchDropStepY, 42)
        );
        const branchWeight = orderIndex === 0 ? (denseOpexStageBalance ? 5.6 : 4.4) : denseOpexStageBalance ? 2.6 : 2.1;
        score += Math.abs(branchDropY - preferredBranchDropY) * branchWeight;
        score += Math.max(minBranchDropY - branchDropY, 0) * (orderIndex === 0 ? 58 : 34);
      });
      const inboundDeltaY = Math.abs(opexInboundTargetBand.center + currentNodeOffsetY + nodeDropY - grossExpenseSourceBand.center);
      score += Math.max(minOpeningGapY - openingGapY, 0) * (denseOpexStageBalance ? 320 : 210);
      score += Math.abs(openingGapY - preferredOpeningGapY) * (denseOpexStageBalance ? 9.6 : 4.4);
      score += Math.max(minTopGapY - topGapY, 0) * 210;
      score += Math.max(topGapY - maxTopGapY, 0) * 44;
      score += Math.abs(topGapY - preferredTopGapY) * 6.4;
      score += Math.abs(inboundDeltaY - preferredInboundDeltaY) * 1.2;
      score += Math.max(inboundDeltaY - maxInboundDeltaY, 0) * 12;
      if (costBreakdownBoxes.length) {
        const summaryClearance = evaluateCostBreakdownSummaryClearance(nodeDropY, costShiftY);
        const costClusterGapY =
          Math.min(
            ...costBreakdownBoxes.filter(Boolean).map((box, index) => {
              const shift = layoutReferenceOffsetFor(`cost-breakdown-${index}`);
              return box.top + shift.dy + costShiftY;
            })
          ) - (opexBottom + currentNodeOffsetY + nodeDropY);
        score += Math.max(minCostClusterGapY - costClusterGapY, 0) * 90;
        score += Math.abs(costClusterGapY - preferredCostClusterGapY) * 1.9;
        score += summaryClearance.deficitY * 320;
        if (Number.isFinite(summaryClearance.minGapY)) {
          score += Math.max(minSummaryClearanceGapY - summaryClearance.minGapY, 0) * 170;
          score += Math.abs(summaryClearance.minGapY - preferredSummaryClearanceGapY) * 4.8;
        }
      }
      score += nodeDropY * 0.08 + opexLiftY * 0.1 + costExtraShiftY * 0.22;
      return {
        score,
        costShiftY,
      };
    };
    const baselineCandidate = evaluateCandidate(0, 0, 0);
    let bestCandidate = {
      nodeDropY: 0,
      opexLiftY: 0,
      costShiftY: 0,
      score: baselineCandidate.score,
    };
    nodeDropCandidates.forEach((nodeDropY) => {
      opexLiftCandidates.forEach((opexLiftY) => {
        costExtraShiftCandidates.forEach((costExtraShiftY) => {
          const candidate = evaluateCandidate(nodeDropY, opexLiftY, costExtraShiftY);
          if (candidate.score < bestCandidate.score) {
            bestCandidate = {
              nodeDropY,
              opexLiftY,
              costShiftY: candidate.costShiftY,
              score: candidate.score,
            };
          }
        });
      });
    });
    if (bestCandidate.score >= baselineCandidate.score - 1.5) return;
    if (bestCandidate.nodeDropY > 0.5) {
      setAutoLayoutNodeOffset("operating-expenses", { dy: currentNodeOffsetY + bestCandidate.nodeDropY });
    }
    if (bestCandidate.costShiftY > 0.5 && costBreakdownBoxes.length) {
      shiftCostBreakdownGroupDown(bestCandidate.costShiftY);
      maintainCostBreakdownNodeGap();
    }
    if (bestCandidate.opexLiftY > 0.5) {
      opexBoxes = opexBoxes.map((box) => (box ? shiftBoxCenter(box, box.center - bestCandidate.opexLiftY) : box));
    }
  };
  const refineSharedNegativeLadder = () => {
    if (!(costBreakdownSharesOpexColumn && costBreakdownBoxes.length >= 2 && opexBoxes.length >= 2)) return;
    const firstOpexEntry = {
      lane: "opex",
      index: 0,
      box: opexBoxes[0],
      sourceSlice: opexSourceSlices[0] || opexSlices[0],
      minHeight: 14,
      sourceTop: opexTop,
      sourceBottom: opexBottom,
      sourceNodeId: "operating-expenses",
      targetNodeId: "opex-0",
    };
    const deductionEntry =
      deductionBoxes.length && deductionBoxes[0]
        ? {
            lane: "deduction",
            index: 0,
            box: deductionBoxes[0],
            sourceSlice: deductionSourceSlices[0] || deductionSlices[0],
            minHeight: deductionSlices[0]?.item?.name === "Other" ? 6 : 12,
            sourceTop: opDeductionSourceBand.top,
            sourceBottom: opDeductionSourceBand.bottom,
            sourceNodeId: "operating",
            targetNodeId: "deduction-0",
          }
        : null;
    const firstOpexBox = opexBoxes[0];
    const secondOpexBox = opexBoxes[1];
    const firstCostBox = costBreakdownBoxes[0];
    if (!firstOpexBox || !secondOpexBox || !firstCostBox || !firstOpexEntry.sourceSlice) return;
    const firstOpexGeometry = resolveNegativeTerminalGeometry(firstOpexEntry);
    const deductionGeometry = deductionEntry ? resolveNegativeTerminalGeometry(deductionEntry) : null;
    if (!firstOpexGeometry) return;
    const currentNodeOffsetY = autoLayoutOffsetForNode("operating-expenses").dy;
    const nodeBottomShifted = opexBottom + currentNodeOffsetY;
    const nodeToFirstGapY = firstOpexGeometry.targetTop - nodeBottomShifted;
    const firstBranchDropY =
      safeNumber(firstOpexGeometry.targetCenter, 0) -
      (safeNumber(opexSourceSlices[0]?.center, firstOpexGeometry.targetCenter) + currentNodeOffsetY);
    const costClusterGapY = firstCostBox.top - nodeBottomShifted;
    const severeSplit =
      firstBranchDropY > scaleY(safeNumber(snapshot.layout?.sharedNegativeLadderBranchSeverityY, 156)) ||
      nodeToFirstGapY > scaleY(safeNumber(snapshot.layout?.sharedNegativeLadderNodeGapSeverityY, 94)) ||
      costClusterGapY > scaleY(safeNumber(snapshot.layout?.sharedNegativeLadderCostGapSeverityY, 216));
    if (!severeSplit) return;
    const availableCostShiftY = Math.max(
      maxCollisionBasedGroupShiftDown(costBreakdownBoxes, costBreakdownPackingHeights, costBreakdownMaxY),
      maxActualBoxGroupShiftDown(costBreakdownBoxes, costBreakdownMaxY)
    );
    const costFollowFactor = clamp(safeNumber(snapshot.layout?.sharedNegativeLadderCostFollowFactor, 1.02), 0.84, 1.22);
    const nodeShiftMaxY = Math.max(
      0,
      Math.min(
        scaleY(safeNumber(snapshot.layout?.sharedNegativeLadderNodeShiftMaxY, 132)),
        availableCostShiftY / Math.max(costFollowFactor, 0.0001)
      )
    );
    const deductionShiftMaxY =
      deductionGeometry && deductionBoxes[0]
        ? Math.min(
            Math.max(
              safeNumber(firstOpexGeometry.targetTop, firstOpexBox.top) -
                safeNumber(deductionGeometry.targetBottom, deductionBoxes[0].bottom) -
                scaleY(safeNumber(snapshot.layout?.sharedNegativeLadderMinDeductionToOpexGapY, 54)),
              0
            ),
            scaleY(safeNumber(snapshot.layout?.sharedNegativeLadderDeductionShiftMaxY, 58))
          )
        : 0;
    const opexLiftFloorY = deductionGeometry
      ? safeNumber(deductionGeometry.targetBottom, deductionBoxes[0]?.bottom) +
        scaleY(safeNumber(snapshot.layout?.sharedNegativeLadderMinOpexAboveDeductionGapY, 88))
      : Math.max(
          rightTerminalSummaryObstacleBottom,
          netBottom + scaleY(safeNumber(snapshot.layout?.sharedNegativeLadderMinOffsetFromNetY, 42))
        );
    const opexLiftMaxY = Math.max(
      0,
      Math.min(
        safeNumber(firstOpexGeometry.targetTop, firstOpexBox.top) - opexLiftFloorY,
        scaleY(safeNumber(snapshot.layout?.sharedNegativeLadderOpexLiftMaxY, 44))
      )
    );
    if (!(nodeShiftMaxY > 0.5 || deductionShiftMaxY > 0.5 || opexLiftMaxY > 0.5)) return;
    const secondOpexEntry =
      opexBoxes.length > 1 && opexBoxes[1]
        ? {
            lane: "opex",
            index: 1,
            box: opexBoxes[1],
            sourceSlice: opexSourceSlices[1] || opexSlices[1],
            minHeight: 14,
            sourceTop: opexTop,
            sourceBottom: opexBottom,
            sourceNodeId: "operating-expenses",
            targetNodeId: "opex-1",
          }
        : null;
    const buildAxisCandidates = (maxY, segments = 6) =>
      Array.from(
        new Set(
          [0, maxY, ...Array.from({ length: segments + 1 }, (_unused, index) => (maxY * index) / Math.max(segments, 1))].map(
            (value) => Number(clamp(value, 0, maxY).toFixed(2))
          )
        )
      );
    const nodeShiftCandidates = buildAxisCandidates(nodeShiftMaxY, 7);
    const deductionShiftCandidates = buildAxisCandidates(deductionShiftMaxY, deductionGeometry ? 5 : 1);
    const opexLiftCandidates = buildAxisCandidates(opexLiftMaxY, 6);
    const netBottomShifted = netBottom + layoutReferenceOffsetFor("net").dy;
    const minNodeToFirstGapY = scaleY(safeNumber(snapshot.layout?.sharedNegativeLadderMinNodeGapY, 58));
    const preferredNodeToFirstGapY = scaleY(safeNumber(snapshot.layout?.sharedNegativeLadderPreferredNodeGapY, 72));
    const maxNodeToFirstGapY = scaleY(safeNumber(snapshot.layout?.sharedNegativeLadderMaxNodeGapY, 96));
    const preferredBranchDropY = scaleY(safeNumber(snapshot.layout?.sharedNegativeLadderPreferredBranchDropY, 118));
    const maxBranchDropY = scaleY(safeNumber(snapshot.layout?.sharedNegativeLadderMaxBranchDropY, 156));
    const minCostClusterGapY = scaleY(safeNumber(snapshot.layout?.sharedNegativeLadderMinCostClusterGapY, 152));
    const preferredCostClusterGapY = scaleY(safeNumber(snapshot.layout?.sharedNegativeLadderPreferredCostClusterGapY, 198));
    const minSummaryGapY = scaleY(safeNumber(snapshot.layout?.sharedNegativeLadderMinSummaryGapY, 24));
    const preferredSummaryGapY = scaleY(safeNumber(snapshot.layout?.sharedNegativeLadderPreferredSummaryGapY, 42));
    const minDeductionNetGapY = scaleY(safeNumber(snapshot.layout?.sharedNegativeLadderMinDeductionNetGapY, 74));
    const preferredDeductionNetGapY = scaleY(safeNumber(snapshot.layout?.sharedNegativeLadderPreferredDeductionNetGapY, 118));
    const minTerminalGapY = scaleY(safeNumber(snapshot.layout?.sharedNegativeLadderMinTerminalGapY, 72));
    const preferredTerminalGapY = scaleY(
      safeNumber(snapshot.layout?.sharedNegativeLadderPreferredTerminalGapY, secondOpexEntry ? 138 : 124)
    );
    const evaluateCandidate = (nodeShiftY, deductionShiftY, opexLiftY) => {
      const costShiftY = Math.min(availableCostShiftY, nodeShiftY * costFollowFactor);
      const firstOpexGeometryCandidate = resolveNegativeTerminalGeometry({
        ...firstOpexEntry,
        box: shiftBoxCenter(firstOpexBox, firstOpexBox.center - opexLiftY),
      });
      if (!firstOpexGeometryCandidate) {
        return {
          score: Infinity,
          costShiftY,
        };
      }
      const secondOpexGeometryCandidate = secondOpexEntry
        ? resolveNegativeTerminalGeometry({
            ...secondOpexEntry,
            box: shiftBoxCenter(secondOpexBox, secondOpexBox.center - opexLiftY),
          })
        : null;
      const deductionGeometryCandidate =
        deductionEntry && deductionBoxes[0]
          ? resolveNegativeTerminalGeometry({
              ...deductionEntry,
              box: shiftBoxCenter(deductionBoxes[0], deductionBoxes[0].center + deductionShiftY),
            })
          : null;
      const nodeBottomCandidate = opexBottom + currentNodeOffsetY + nodeShiftY;
      const nodeToFirstGapCandidateY = firstOpexGeometryCandidate.targetTop - nodeBottomCandidate;
      const firstBranchDropCandidateY =
        safeNumber(firstOpexGeometryCandidate.targetCenter, 0) -
        (safeNumber(opexSourceSlices[0]?.center, firstOpexGeometryCandidate.targetCenter) + currentNodeOffsetY + nodeShiftY);
      const costClusterGapCandidateY = firstCostBox.top + costShiftY - nodeBottomCandidate;
      const summaryLiftAllowanceY = Math.min(
        scaleY(safeNumber(snapshot.layout?.sharedNegativeLadderSummaryLiftAllowanceMaxY, 26)),
        Math.max(
          nodeShiftY * safeNumber(snapshot.layout?.sharedNegativeLadderSummaryLiftFollowFactor, 0.78),
          0
        )
      );
      const summaryBottomCandidateY = costBreakdownOpexSummaryBottom + currentNodeOffsetY + nodeShiftY - summaryLiftAllowanceY;
      const summaryGapCandidateY = firstOpexGeometryCandidate.targetTop - summaryBottomCandidateY;
      const deductionNetGapCandidateY = deductionGeometryCandidate
        ? deductionGeometryCandidate.targetTop - netBottomShifted
        : Infinity;
      const deductionToFirstGapCandidateY = deductionGeometryCandidate
        ? firstOpexGeometryCandidate.targetTop - deductionGeometryCandidate.targetBottom
        : preferredTerminalGapY;
      const firstToSecondGapCandidateY = secondOpexGeometryCandidate
        ? secondOpexGeometryCandidate.targetTop - firstOpexGeometryCandidate.targetBottom
        : deductionToFirstGapCandidateY;
      const terminalGapMeanY = secondOpexGeometryCandidate
        ? (deductionToFirstGapCandidateY + firstToSecondGapCandidateY) / 2
        : deductionToFirstGapCandidateY;
      let score =
        Math.max(minNodeToFirstGapY - nodeToFirstGapCandidateY, 0) * 230 +
        Math.max(nodeToFirstGapCandidateY - maxNodeToFirstGapY, 0) * 124 +
        Math.abs(nodeToFirstGapCandidateY - preferredNodeToFirstGapY) * 9.1 +
        Math.max(firstBranchDropCandidateY - maxBranchDropY, 0) * 164 +
        Math.abs(firstBranchDropCandidateY - preferredBranchDropY) * 8.6 +
        Math.max(minCostClusterGapY - costClusterGapCandidateY, 0) * 82 +
        Math.abs(costClusterGapCandidateY - preferredCostClusterGapY) * 1.8 +
        Math.max(minSummaryGapY - summaryGapCandidateY, 0) * 260 +
        Math.abs(summaryGapCandidateY - preferredSummaryGapY) * 4.9;
      if (deductionGeometryCandidate) {
        score +=
          Math.max(minDeductionNetGapY - deductionNetGapCandidateY, 0) * 92 +
          Math.abs(deductionNetGapCandidateY - preferredDeductionNetGapY) * 1.6 +
          Math.max(minTerminalGapY - deductionToFirstGapCandidateY, 0) * 128 +
          Math.abs(deductionToFirstGapCandidateY - preferredTerminalGapY) * 1.8;
      }
      if (secondOpexGeometryCandidate) {
        score +=
          Math.max(minTerminalGapY - firstToSecondGapCandidateY, 0) * 116 +
          Math.abs(firstToSecondGapCandidateY - preferredTerminalGapY * 1.04) * 1.5 +
          Math.abs(deductionToFirstGapCandidateY - terminalGapMeanY) * 2.3 +
          Math.abs(firstToSecondGapCandidateY - terminalGapMeanY) * 2.1;
      }
      score += nodeShiftY * 0.18 + deductionShiftY * 0.24 + opexLiftY * 0.22;
      return {
        score,
        costShiftY,
      };
    };
    const baselineCandidate = evaluateCandidate(0, 0, 0);
    let bestCandidate = {
      nodeShiftY: 0,
      deductionShiftY: 0,
      opexLiftY: 0,
      costShiftY: 0,
      score: baselineCandidate.score,
    };
    nodeShiftCandidates.forEach((nodeShiftY) => {
      deductionShiftCandidates.forEach((deductionShiftY) => {
        opexLiftCandidates.forEach((opexLiftY) => {
          const candidate = evaluateCandidate(nodeShiftY, deductionShiftY, opexLiftY);
          if (candidate.score < bestCandidate.score) {
            bestCandidate = {
              nodeShiftY,
              deductionShiftY,
              opexLiftY,
              costShiftY: candidate.costShiftY,
              score: candidate.score,
            };
          }
        });
      });
    });
    if (bestCandidate.score >= baselineCandidate.score - 1.5) return;
    if (bestCandidate.nodeShiftY > 0.5) {
      setAutoLayoutNodeOffset("operating-expenses", { dy: currentNodeOffsetY + bestCandidate.nodeShiftY });
    }
    if (bestCandidate.costShiftY > 0.5) {
      shiftCostBreakdownGroupDown(bestCandidate.costShiftY);
      maintainCostBreakdownNodeGap();
    }
    if (bestCandidate.deductionShiftY > 0.5 && deductionBoxes.length && deductionBoxes[0]) {
      deductionBoxes[0] = shiftBoxCenter(deductionBoxes[0], deductionBoxes[0].center + bestCandidate.deductionShiftY);
    }
    if (bestCandidate.opexLiftY > 0.5) {
      opexBoxes = opexBoxes.map((box) => (box ? shiftBoxCenter(box, box.center - bestCandidate.opexLiftY) : box));
    }
  };
  const refinePrimaryNegativeLead = () => {
    const leadNegativeEntry =
      deductionBoxes.length && deductionSlices.length
        ? {
            lane: "deduction",
            index: 0,
            box: deductionBoxes[0],
            sourceSlice: deductionSourceSlices[0] || deductionSlices[0],
            minHeight: deductionSlices[0]?.item?.name === "Other" ? 6 : 12,
            sourceTop: opDeductionSourceBand.top,
            sourceBottom: opDeductionSourceBand.bottom,
            sourceX: operatingFrame.right,
            targetX: rightTerminalNodeX,
            sourceNodeId: "operating",
            targetNodeId: "deduction-0",
            branchOptions: resolveDeductionTerminalBranchOptions(0),
          }
        : opexBoxes.length && opexSlices.length
          ? {
              lane: "opex",
              index: 0,
              box: opexBoxes[0],
              sourceSlice: opexSourceSlices[0] || opexSlices[0],
              minHeight: 14,
              sourceTop: opexTop,
              sourceBottom: opexBottom,
              sourceX: operatingExpenseFrame.right,
              targetX: opexTargetX,
              sourceNodeId: "operating-expenses",
              targetNodeId: "opex-0",
              branchOptions: standardTerminalBranchOptions,
            }
          : null;
    if (!leadNegativeEntry?.box || !leadNegativeEntry?.sourceSlice) return;
    const followingNegativeEntries = [
      ...(leadNegativeEntry.lane === "deduction"
        ? deductionBoxes.slice(1).map((box, relativeIndex) => {
            const index = relativeIndex + 1;
            const sourceSlice = deductionSourceSlices[index] || deductionSlices[index];
            if (!box || !sourceSlice) return null;
            return {
              lane: "deduction",
              index,
              box,
              sourceSlice,
              minHeight: deductionSlices[index]?.item?.name === "Other" ? 6 : 12,
              sourceTop: opDeductionSourceBand.top,
              sourceBottom: opDeductionSourceBand.bottom,
              sourceNodeId: "operating",
              targetNodeId: `deduction-${index}`,
            };
          })
        : []),
      ...opexBoxes.map((box, index) => {
        const sourceSlice = opexSourceSlices[index] || opexSlices[index];
        if (!box || !sourceSlice) return null;
        return {
          lane: "opex",
          index,
          box,
          sourceSlice,
          minHeight: 14,
          sourceTop: opexTop,
          sourceBottom: opexBottom,
          sourceNodeId: "operating-expenses",
          targetNodeId: `opex-${index}`,
        };
      }),
    ]
      .filter(Boolean)
      .sort((left, right) => left.box.center - right.box.center);
    const nextNegativeEntry = followingNegativeEntries.find(
      (entry) => safeNumber(entry.box.center, Infinity) > safeNumber(leadNegativeEntry.box.center, -Infinity)
    );
    const nextNegativeGeometry = nextNegativeEntry ? resolveNegativeTerminalGeometry(nextNegativeEntry) : null;
    const leadNegativeCount =
      leadNegativeEntry.lane === "deduction"
        ? Math.max(deductionBoxes.filter(Boolean).length + opexBoxes.filter(Boolean).length, 1)
        : Math.max(opexBoxes.filter(Boolean).length, 1);
    const leadingLaneDensityNorm = clamp(
      (leadNegativeCount - 1) * 0.22 + (leadNegativeEntry.lane === "deduction" && costBreakdownSharesOpexColumn ? 0.22 : 0),
      0,
      0.9
    );
    const leadCurrentTargetBottom =
      safeNumber(leadNegativeEntry.box.bottom, -Infinity) + layoutReferenceOffsetFor(leadNegativeEntry.targetNodeId).dy;
    const currentNextGapY = nextNegativeGeometry ? nextNegativeGeometry.targetTop - leadCurrentTargetBottom : Infinity;
    const leadSpacingPressureNorm = Math.max(
      leadingLaneDensityNorm,
      nextNegativeGeometry ? clamp((currentNextGapY - scaleY(92)) / scaleY(220), 0, 1) : 0
    );
    const netShift = layoutReferenceOffsetFor("net");
    const sourceShift = layoutReferenceOffsetFor(leadNegativeEntry.sourceNodeId);
    const targetShift = layoutReferenceOffsetFor(leadNegativeEntry.targetNodeId);
    const netBottomShifted = netBottom + netShift.dy;
    const sourceCoverInset = Math.max(
      safeNumber(
        leadNegativeEntry.branchOptions.sourceCoverInsetX,
        safeNumber(snapshot.layout?.branchSourceCoverInsetX, 1.5)
      ),
      0
    );
    const mergedBranchOptions = {
      ...mergeOutflowRibbonOptions(leadNegativeEntry.branchOptions),
      endCapWidth: 0,
      targetCoverInsetX: safeNumber(
        leadNegativeEntry.branchOptions.targetCoverInsetX,
        safeNumber(snapshot.layout?.branchTargetCoverInsetX, 14)
      ),
    };
    const sourceX = leadNegativeEntry.sourceX - sourceCoverInset + sourceShift.dx;
    const targetX = leadNegativeEntry.targetX + mergedBranchOptions.targetCoverInsetX + targetShift.dx;
    const minNodeGapY = scaleY(
      safeNumber(snapshot.layout?.primaryNegativeMinNodeGapY, positiveAdjustments.length && positiveAbove ? 22 : 18)
    );
    const preferredNodeGapBaseY = scaleY(
      safeNumber(
        snapshot.layout?.primaryNegativePreferredNodeGapY,
        clamp(
          netHeight * 0.18 +
            safeNumber(leadNegativeEntry.box.height, 0) * 0.24 +
            (positiveAdjustments.length && positiveAbove ? 12 : 6),
          30,
          positiveAdjustments.length && positiveAbove ? 84 : 72
        )
      )
    );
    const preferredNodeGapY =
      preferredNodeGapBaseY +
      scaleY(safeNumber(snapshot.layout?.primaryNegativePreferredNodeGapBoostY, 28)) * leadSpacingPressureNorm;
    const maxNodeGapBaseY = scaleY(
      safeNumber(
        snapshot.layout?.primaryNegativeMaxNodeGapY,
        Math.max(preferredNodeGapBaseY / Math.max(verticalScale, 0.0001) + (positiveAdjustments.length && positiveAbove ? 34 : 26), 56)
      )
    );
    const maxNodeGapY =
      maxNodeGapBaseY + scaleY(safeNumber(snapshot.layout?.primaryNegativeMaxNodeGapBoostY, 54)) * leadSpacingPressureNorm;
    const candidateSourceSlice =
      leadNegativeEntry.lane === "deduction"
        ? resolveDeductionTerminalSourceSlice(0, leadNegativeEntry.sourceSlice)
        : leadNegativeEntry.sourceSlice;
    const leadNegativeThickness = Math.max(
      safeNumber(leadNegativeEntry.box.height, 0),
      safeNumber(candidateSourceSlice?.height, 0),
      1
    );
    const minCorridorGapY = scaleY(
      safeNumber(
        snapshot.layout?.primaryNegativeMinCorridorGapY,
        clamp(
          leadNegativeThickness * 0.14 + (positiveAdjustments.length && positiveAbove ? 3 : 2),
          6,
          positiveAdjustments.length && positiveAbove ? 14 : 12
        )
      )
    );
    const earlyCorridorGapY = scaleY(
      safeNumber(
        snapshot.layout?.primaryNegativeEarlyCorridorGapY,
        clamp(
          leadNegativeThickness * 0.22 + (positiveAdjustments.length && positiveAbove ? 6 : 4),
          10,
          positiveAdjustments.length && positiveAbove ? 20 : 16
        )
      )
    );
    const preferredCorridorGapY = scaleY(
      safeNumber(
        snapshot.layout?.primaryNegativePreferredCorridorGapY,
        clamp(
          leadNegativeThickness * 0.34 + (positiveAdjustments.length && positiveAbove ? 9 : 7),
          14,
          positiveAdjustments.length && positiveAbove ? 30 : 24
        )
      )
    );
    const maxCorridorGapY = scaleY(
      safeNumber(
        snapshot.layout?.primaryNegativeMaxCorridorGapY,
        clamp(
          preferredCorridorGapY / Math.max(verticalScale, 0.0001) +
            leadNegativeThickness * 0.34 +
            (positiveAdjustments.length && positiveAbove ? 16 : 14),
          34,
          positiveAdjustments.length && positiveAbove ? 72 : 58
        )
      )
    );
    const spacingBalanceActivationRatio = safeNumber(snapshot.layout?.primaryNegativeSpacingBalanceActivationRatio, 2.12);
    const spacingBalanceActivationExtraY = scaleY(safeNumber(snapshot.layout?.primaryNegativeSpacingBalanceActivationExtraY, 26));
    const enableSpacingBalance =
      nextNegativeGeometry &&
      currentNextGapY >
        Math.max(
          safeNumber(leadNegativeEntry.box.height, 0) + safeNumber(nextNegativeGeometry.targetHeight, 0) + rightTerminalSeparationGap,
          (safeNumber(leadNegativeEntry.box.top, 0) - netBottomShifted) * spacingBalanceActivationRatio + spacingBalanceActivationExtraY
        );
    const preferredNextGapY = enableSpacingBalance
      ? scaleY(
          safeNumber(
            snapshot.layout?.primaryNegativePreferredNextGapY,
            clamp(
              preferredNodeGapBaseY / Math.max(verticalScale, 0.0001) * 1.06 + leadNegativeThickness * 0.28 + 12,
              72,
              148
            )
          )
        ) +
        scaleY(safeNumber(snapshot.layout?.primaryNegativePreferredNextGapBoostY, 24)) * leadSpacingPressureNorm
      : null;
    const minNextGapY = enableSpacingBalance
      ? scaleY(safeNumber(snapshot.layout?.primaryNegativeMinNextGapY, 26))
      : null;
    const maxNextGapY = enableSpacingBalance
      ? scaleY(safeNumber(snapshot.layout?.primaryNegativeMaxNextGapY, 184)) +
        scaleY(safeNumber(snapshot.layout?.primaryNegativeMaxNextGapBoostY, 44)) * leadSpacingPressureNorm
      : null;
    const candidateMinCenter = Math.max(
      leadNegativeEntry.box.height / 2,
      rightTerminalSummaryObstacleBottom + leadNegativeEntry.box.height / 2,
      netBottom + leadNegativeEntry.box.height / 2 + minNodeGapY
    );
    const candidateMaxCenterFromNext = nextNegativeGeometry
      ? nextNegativeGeometry.targetCenter - (leadNegativeEntry.box.height + nextNegativeGeometry.targetHeight) / 2 - rightTerminalSeparationGap
      : terminalLayoutBottomLimit - leadNegativeEntry.box.height / 2;
    const candidateMaxCenter = Math.max(candidateMinCenter, candidateMaxCenterFromNext);
    if (!(candidateMaxCenter >= candidateMinCenter)) return;
    const sampleXs = [0.12, 0.24, 0.42, 0.62, 0.8]
      .map((ratio) => sourceX + (targetX - sourceX) * ratio)
      .filter((value, index, values) => Number.isFinite(value) && (index === 0 || Math.abs(value - values[index - 1]) > 0.5));
    const candidateCenters = Array.from(
      new Set(
        [
          candidateMinCenter,
          candidateMaxCenter,
          leadNegativeEntry.box.center,
          ...Array.from({ length: 11 }, (_unused, index) =>
            candidateMinCenter + ((candidateMaxCenter - candidateMinCenter) * index) / 10
          ),
        ].map((value) => Number(clamp(value, candidateMinCenter, candidateMaxCenter).toFixed(2)))
      )
    );
    let bestCandidate = null;
    candidateCenters.forEach((candidateCenter) => {
      const bridge = constantThicknessBridge(
        candidateSourceSlice,
        candidateCenter,
        leadNegativeEntry.minHeight,
        leadNegativeEntry.sourceTop,
        leadNegativeEntry.sourceBottom
      );
      const targetTop = candidateCenter - bridge.targetHeight / 2 + targetShift.dy;
      const nodeGapY = targetTop - netBottomShifted;
      const adaptedBranchOptions = resolveAdaptiveNegativeTerminalBranchOptions(
        mergedBranchOptions,
        bridge.sourceTop + sourceShift.dy,
        bridge.sourceBottom + sourceShift.dy,
          targetTop,
          bridge.targetHeight,
          {
            index: leadNegativeEntry.index,
            count: leadNegativeCount,
            laneBias: leadNegativeEntry.lane === "deduction" ? 0.12 : 0.06,
          }
        );
      let minGap = Infinity;
      let earlyMinGap = Infinity;
      let averageGap = 0;
      let sampleCount = 0;
      sampleXs.forEach((sampleX, sampleIndex) => {
        const mainEnvelope = mainNetRibbonEnvelopeAtX(sampleX);
        const branchEnvelope = flowEnvelopeAtX(
          sampleX,
          sourceX,
          bridge.sourceTop + sourceShift.dy,
          bridge.sourceBottom + sourceShift.dy,
          targetX,
          targetTop,
          targetTop + bridge.targetHeight,
          adaptedBranchOptions
        );
        if (!mainEnvelope || !branchEnvelope) return;
        const gapY = branchEnvelope.top - mainEnvelope.bottom;
        minGap = Math.min(minGap, gapY);
        if (sampleIndex < 2) earlyMinGap = Math.min(earlyMinGap, gapY);
        averageGap += gapY;
        sampleCount += 1;
      });
      if (!sampleCount) return;
      averageGap /= sampleCount;
      const nextGapY = nextNegativeGeometry ? nextNegativeGeometry.targetTop - (targetTop + bridge.targetHeight) : Infinity;
      const corridorPenaltyBoost = 1 + leadSpacingPressureNorm * 0.72;
      const score =
        Math.max(minCorridorGapY - minGap, 0) * 220 * corridorPenaltyBoost +
        Math.max(earlyCorridorGapY - earlyMinGap, 0) * (enableSpacingBalance ? 320 : 250) * (1 + leadSpacingPressureNorm) +
        Math.max(preferredCorridorGapY - averageGap, 0) * 34 +
        Math.max(averageGap - maxCorridorGapY, 0) * 18 +
        Math.max(minNodeGapY - nodeGapY, 0) * 150 +
        Math.max(nodeGapY - maxNodeGapY, 0) * (leadNegativeEntry.lane === "deduction" ? 28 : 42) +
        Math.abs(nodeGapY - preferredNodeGapY) * (enableSpacingBalance ? 1.08 : 1.82) +
        (enableSpacingBalance
          ? Math.max(minNextGapY - nextGapY, 0) * 146 +
            Math.abs(nextGapY - preferredNextGapY) * 4.1 +
            Math.max(nextGapY - maxNextGapY, 0) * 42
          : 0) +
        Math.abs(candidateCenter - leadNegativeEntry.box.center) * 0.04;
      if (!bestCandidate || score < bestCandidate.score) {
        bestCandidate = {
          center: candidateCenter,
          score,
        };
      }
    });
    if (!bestCandidate || Math.abs(bestCandidate.center - leadNegativeEntry.box.center) <= 0.5) return;
    if (leadNegativeEntry.lane === "deduction") {
      deductionBoxes[0] = shiftBoxCenter(deductionBoxes[0], bestCandidate.center);
    } else {
      opexBoxes[0] = shiftBoxCenter(opexBoxes[0], bestCandidate.center);
    }
  };
  refineOpexSplitSmoothness();
  refineSharedNegativeLadder();
  if (costBreakdownSharesOpexColumn) {
    alignOpexSummaryToNode();
  }
  if (costBreakdownSharesOpexColumn && costBreakdownBoxes.length) {
    const opexSummaryShift = layoutReferenceOffsetFor("operating-expenses");
    const opexSummaryMetrics = resolveOpexSummaryMetrics(opexSummaryShift);
    const opexSummaryObstaclePadX = scaleY(safeNumber(snapshot.layout?.costBreakdownOpexRibbonObstaclePadX, 10));
    const opexSummaryObstaclePadY = scaleY(safeNumber(snapshot.layout?.costBreakdownOpexRibbonObstaclePadY, 8));
    const opexSummaryObstacleWidth = Math.max(
      approximateTextBlockWidth(operatingExpenseLabelLines, expenseSummaryLayout.titleSize),
      approximateTextWidth(formatBillionsByMode(operatingExpensesBn, "negative-parentheses"), expenseSummaryLayout.valueSize),
      revenueBn > 0 ? approximateTextWidth(formatPct((operatingExpensesBn / revenueBn) * 100) + ` ${ofRevenueLabel()}`, expenseSummaryLayout.subSize) : 0,
      1
    );
    const opexSummaryObstacle = {
      left: opexSummaryMetrics.centerX - opexSummaryObstacleWidth / 2 - opexSummaryObstaclePadX,
      right: opexSummaryMetrics.centerX + opexSummaryObstacleWidth / 2 + opexSummaryObstaclePadX,
      top: opexSummaryMetrics.top - opexSummaryObstaclePadY,
      bottom: opexSummaryMetrics.bottom + opexSummaryObstaclePadY,
    };
    const costBreakdownRibbonClearanceY = scaleY(safeNumber(snapshot.layout?.costBreakdownOpexRibbonClearanceY, 10));
    const costBreakdownSummaryClearanceY = scaleY(
      safeNumber(
        snapshot.layout?.costBreakdownOpexSummaryClearanceY,
        costBreakdownSlices.length === 2 && costBreakdownSharesOpexColumn ? 18 : 14
      )
    );
    const topBarrierDeficit = costBreakdownTerminalTopBarrierY - costBreakdownCollisionTop();
    if (topBarrierDeficit > 0.5) {
      shiftCostBreakdownGroupDown(topBarrierDeficit + scaleY(2));
      maintainCostBreakdownNodeGap();
    }
    const sampleXsAcrossRange = (left, right, count = 7) => {
      if (!(right > left)) return [left];
      return Array.from({ length: count }, (_value, index) => left + ((right - left) * index) / Math.max(count - 1, 1));
    };
    const computeCostBreakdownEnvelopeDeficit = (index) => {
      const box = costBreakdownBoxes[index];
      const sourceSlice = costBreakdownSourceSlices[index] || costBreakdownSlices[index];
      if (!box || !sourceSlice) return 0;
      const sourceShift = layoutReferenceOffsetFor("cost");
      const targetShift = layoutReferenceOffsetFor(`cost-breakdown-${index}`);
      const sourceCoverInset = Math.max(
        safeNumber(resolvedCostBreakdownTerminalBranchOptions.sourceCoverInsetX, safeNumber(snapshot.layout?.branchSourceCoverInsetX, 1.5)),
        0
      );
      const mergedBranchOptions = {
        ...mergeOutflowRibbonOptions(resolvedCostBreakdownTerminalBranchOptions),
        endCapWidth: 0,
        targetCoverInsetX: safeNumber(
          resolvedCostBreakdownTerminalBranchOptions.targetCoverInsetX,
          safeNumber(snapshot.layout?.branchTargetCoverInsetX, 14)
        ),
      };
      const bridge = constantThicknessBridge(sourceSlice, box.center, 10, costTop, costBottom);
      const sourceX = grossX + nodeWidth + sourceShift.dx - sourceCoverInset;
      const sourceTop = bridge.sourceTop + sourceShift.dy;
      const sourceBottom = bridge.sourceBottom + sourceShift.dy;
      const targetX = costBreakdownX + targetShift.dx + mergedBranchOptions.targetCoverInsetX;
      const targetTop = bridge.targetTop + targetShift.dy;
      const targetBottom = targetTop + bridge.targetHeight;
      const overlapLeft = Math.max(opexSummaryObstacle.left, sourceX + scaleY(4));
      const overlapRight = Math.min(opexSummaryObstacle.right, targetX - scaleY(4));
      if (!(overlapRight > overlapLeft) || targetBottom <= opexSummaryObstacle.top) return 0;
      return sampleXsAcrossRange(overlapLeft, overlapRight).reduce((maxDeficit, sampleX) => {
        const envelope = flowEnvelopeAtX(
          sampleX,
          sourceX,
          sourceTop,
          sourceBottom,
          targetX,
          targetTop,
          targetBottom,
          mergedBranchOptions
        );
        if (!envelope) return maxDeficit;
        return Math.max(maxDeficit, opexSummaryObstacle.bottom + costBreakdownRibbonClearanceY - envelope.top);
      }, 0);
    };
    const computeCostBreakdownSummaryDeficit = (index) => {
      const box = costBreakdownBoxes[index];
      if (!box) return 0;
      const targetShift = layoutReferenceOffsetFor(`cost-breakdown-${index}`);
      const collisionHeight = Math.max(
        safeNumber(costBreakdownGapHeights[index], box.height),
        safeNumber(costBreakdownPackingHeights[index], box.height),
        safeNumber(box.height, 0),
        1
      );
      const collisionTop = safeNumber(box.center, 0) + targetShift.dy - collisionHeight / 2;
      const nodeTop = safeNumber(box.top, 0) + targetShift.dy;
      return Math.max(
        opexSummaryObstacle.bottom + costBreakdownSummaryClearanceY - collisionTop,
        opexSummaryObstacle.bottom + scaleY(8) - nodeTop,
        computeCostBreakdownEnvelopeDeficit(index)
      );
    };
    for (let pass = 0; pass < 4; pass += 1) {
      let moved = false;
      const groupDeficit = costBreakdownBoxes.reduce(
        (maxDeficit, _box, index) => Math.max(maxDeficit, computeCostBreakdownSummaryDeficit(index)),
        0
      );
      if (groupDeficit > 0.5) {
        const groupShiftY = shiftCostBreakdownGroupDown(groupDeficit + scaleY(2));
        if (groupShiftY > 0.01) {
          maintainCostBreakdownNodeGap();
          moved = true;
          continue;
        }
      }
      for (let index = 0; index < costBreakdownBoxes.length; index += 1) {
        const deficit = computeCostBreakdownSummaryDeficit(index);
        if (deficit <= 0.5) continue;
        const box = costBreakdownBoxes[index];
        const maxCenter =
          costBreakdownMaxY -
          Math.max(
            safeNumber(costBreakdownGapHeights[index], box.height),
            safeNumber(costBreakdownPackingHeights[index], box.height),
            safeNumber(box.height, 0),
            1
          ) /
            2;
        const nextCenter = clamp(box.center + deficit + scaleY(2), box.center, maxCenter);
        if (nextCenter <= box.center + 0.1) continue;
        costBreakdownBoxes[index] = shiftBoxCenter(box, nextCenter);
        maintainCostBreakdownNodeGap();
        moved = true;
      }
      if (!moved) break;
    }
    maintainCostBreakdownNodeGap();
  }
  const renderStandardTerminalBranchBlock = ({
    sourceX,
    sourceNodeId = null,
    terminalNodeX,
    terminalNodeWidth,
    terminalNodeId,
    block,
    targetTop,
    targetHeight,
    flowColor,
    labelColor,
    density,
    labelX = undefined,
    centerWrapped = true,
    branchOptions = standardTerminalBranchOptions,
  }) => {
    const sourceShift = sourceNodeId ? editorOffsetForNode(sourceNodeId) : { dx: 0, dy: 0 };
    const sourceTop = safeNumber(block.bridge?.sourceTop, block.top) + sourceShift.dy;
    const sourceBottom = safeNumber(block.bridge?.sourceBottom, block.bottom) + sourceShift.dy;
    const targetFrame = editableNodeFrame(terminalNodeId, terminalNodeX, targetTop, terminalNodeWidth, targetHeight);
    let html = renderTerminalCapRibbon({
      sourceX: sourceX + sourceShift.dx,
      sourceTop,
      sourceBottom,
      capX: targetFrame.x,
      capWidth: terminalNodeWidth,
      targetTop: targetFrame.y,
      targetHeight,
      flowColor,
      capColor: redNode,
      branchOptions,
    });
    html += renderEditableNodeRect(targetFrame, redNode);
    html += renderRightBranchLabel(block.item, block.box, targetFrame.x, terminalNodeWidth, labelColor, {
      density,
      defaultMode: "negative-parentheses",
      labelX,
      centerWrapped,
      labelCenterY: targetFrame.centerY,
    });
    return html;
  };
  const renderRightExpenseBlock = (_nodeX, nodeWidthValue, block, targetTop, targetHeight, _labelX, fillColor, index) => {
    const terminalNodeX = rightTerminalNodeX + Math.max(nodeWidth - nodeWidthValue, 0);
    const branchOptions = resolveAdaptiveNegativeTerminalBranchOptions(
      standardTerminalBranchOptions,
      safeNumber(block.bridge?.sourceTop, block.top),
      safeNumber(block.bridge?.sourceBottom, block.bottom),
      targetTop,
      targetHeight,
      {
        index,
        count: Math.max(opexSlices.length, 1),
        laneBias: 0.04,
      }
    );
    return renderStandardTerminalBranchBlock({
      sourceX: opX + nodeWidth,
      sourceNodeId: "operating-expenses",
      terminalNodeX,
      terminalNodeWidth: nodeWidthValue,
      terminalNodeId: `opex-${index}`,
      block,
      targetTop,
      targetHeight,
      flowColor: fillColor,
      labelColor: redText,
      density: opexDensity,
      branchOptions,
    });
  };
  const renderCostBreakdownBlock = (block, targetTop, targetHeight, index) => {
    return renderStandardTerminalBranchBlock({
      sourceX: grossX + nodeWidth,
      sourceNodeId: "cost",
      terminalNodeX: costBreakdownX,
      terminalNodeWidth: nodeWidth,
      terminalNodeId: `cost-breakdown-${index}`,
      block,
      targetTop,
      targetHeight,
      flowColor: redFlow,
      labelColor: redText,
      density: costBreakdownSlices.length >= 3 ? "dense" : "regular",
      labelX: costBreakdownLabelSafeX,
      centerWrapped: false,
      branchOptions: resolvedCostBreakdownTerminalBranchOptions,
    });
  };
  const resolveSplitBranchBoundaryOptions = (baseOptions = {}, overrides = {}) => ({
    ...baseOptions,
    ...overrides,
    adaptiveHold: false,
    sourceHoldLength: 0,
    minSourceHoldLength: 0,
    maxSourceHoldLength: 0,
    sourceHoldDeltaReduction: 0,
    minAdaptiveSourceHoldLength: 0,
  });
  const renderSharedTrunkCostBreakdownPair = (upperBlock, lowerBlock) => {
    if (!upperBlock || !lowerBlock) return "";
    const density = costBreakdownSlices.length >= 3 ? "dense" : "regular";
    const sourceShift = editorOffsetForNode("cost");
    const shiftFrameY = (frame, deltaY) => ({
      ...frame,
      y: frame.y + deltaY,
      top: frame.top + deltaY,
      bottom: frame.bottom + deltaY,
      centerY: frame.centerY + deltaY,
    });
    let upperFrame = editableNodeFrame("cost-breakdown-0", costBreakdownX, upperBlock.bridge.targetTop, nodeWidth, upperBlock.bridge.targetHeight);
    let lowerFrame = editableNodeFrame("cost-breakdown-1", costBreakdownX, lowerBlock.bridge.targetTop, nodeWidth, lowerBlock.bridge.targetHeight);
    const desiredRenderGapY = scaleY(
      safeNumber(snapshot.layout?.costBreakdownRenderGapY, costBreakdownSharesOpexColumn ? 14 : 10)
    );
    const currentRenderGapY = lowerFrame.y - (upperFrame.y + upperFrame.height);
    if (currentRenderGapY < desiredRenderGapY) {
      let remainingGapY = desiredRenderGapY - currentRenderGapY;
      const lowerMaxY = costBreakdownMaxY - lowerFrame.height;
      const lowerShiftY = Math.min(Math.max(lowerMaxY - lowerFrame.y, 0), remainingGapY);
      if (lowerShiftY > 0.01) {
        lowerFrame = shiftFrameY(lowerFrame, lowerShiftY);
        remainingGapY -= lowerShiftY;
      }
      if (remainingGapY > 0.01) {
        const upperMinY = Math.max(
          costBreakdownTerminalTopFloor,
          costBreakdownSharesOpexColumn ? costBreakdownTerminalTopBarrierY + scaleY(8) : costBreakdownTerminalTopFloor
        );
        const upperShiftY = Math.min(Math.max(upperFrame.y - upperMinY, 0), remainingGapY);
        if (upperShiftY > 0.01) {
          upperFrame = shiftFrameY(upperFrame, -upperShiftY);
        }
      }
    }
    const sourceCoverInset = Math.max(
      safeNumber(resolvedCostBreakdownTerminalBranchOptions.sourceCoverInsetX, safeNumber(snapshot.layout?.branchSourceCoverInsetX, 1.5)),
      0
    );
    const resolvedBranchOptions = {
      ...mergeOutflowRibbonOptions(resolvedCostBreakdownTerminalBranchOptions),
      endCapWidth: 0,
      targetCoverInsetX: safeNumber(
        resolvedCostBreakdownTerminalBranchOptions.targetCoverInsetX,
        safeNumber(snapshot.layout?.branchTargetCoverInsetX, 14)
      ),
    };
    const mirroredResolvedBranchOptions = mirrorFlowBoundaryOptions(resolvedBranchOptions);
    const sourcePathX = grossX + nodeWidth + sourceShift.dx - sourceCoverInset;
    const upperSourceTop = safeNumber(upperBlock.bridge?.sourceTop, upperBlock.top) + sourceShift.dy;
    const upperSourceBottom = safeNumber(upperBlock.bridge?.sourceBottom, upperBlock.bottom) + sourceShift.dy;
    const lowerSourceTop = safeNumber(lowerBlock.bridge?.sourceTop, lowerBlock.top) + sourceShift.dy;
    const lowerSourceBottom = safeNumber(lowerBlock.bridge?.sourceBottom, lowerBlock.bottom) + sourceShift.dy;
    const sharedSeamY = (upperSourceBottom + lowerSourceTop) / 2;
    const targetCoverInsetX = resolvedBranchOptions.targetCoverInsetX;
    const upperTargetPathX = upperFrame.x + targetCoverInsetX;
    const lowerTargetPathX = lowerFrame.x + targetCoverInsetX;
    const sharedTrunkAvailableX = Math.max(
      Math.min(upperTargetPathX, lowerTargetPathX) - sourcePathX - safeNumber(snapshot.layout?.costBreakdownSharedTargetReserveX, 10),
      12
    );
    const sharedTrunkLength = clamp(
      safeNumber(
        snapshot.layout?.costBreakdownSharedTrunkLength,
        sharedTrunkAvailableX *
          safeNumber(
            snapshot.layout?.costBreakdownSharedTrunkFactor,
            costBreakdownEarlySplitMode ? 0.1 : 0.2
          )
      ),
      safeNumber(snapshot.layout?.costBreakdownMinSharedTrunkLength, costBreakdownEarlySplitMode ? 8 : 18),
      Math.max(Math.min(sharedTrunkAvailableX, safeNumber(snapshot.layout?.costBreakdownMaxSharedTrunkLength, costBreakdownEarlySplitMode ? 18 : 30)), 8)
    );
    const splitX = sourcePathX + sharedTrunkLength;
    const splitOuterBranchOptions = resolveSplitBranchBoundaryOptions(resolvedBranchOptions, {
      targetHoldFactor: safeNumber(snapshot.layout?.costBreakdownSplitOuterTargetHoldFactor, costBreakdownEarlySplitMode ? 0.03 : 0.05),
      minTargetHoldLength: safeNumber(snapshot.layout?.costBreakdownSplitOuterMinTargetHoldLength, costBreakdownEarlySplitMode ? 3 : 6),
      maxTargetHoldLength: safeNumber(snapshot.layout?.costBreakdownSplitOuterMaxTargetHoldLength, costBreakdownEarlySplitMode ? 8 : 12),
      startCurveFactor: safeNumber(snapshot.layout?.costBreakdownSplitOuterStartCurveFactor, costBreakdownEarlySplitMode ? 0.22 : 0.12),
      endCurveFactor: safeNumber(snapshot.layout?.costBreakdownSplitOuterEndCurveFactor, costBreakdownEarlySplitMode ? 0.38 : 0.3),
      minStartCurveFactor: safeNumber(snapshot.layout?.costBreakdownSplitOuterMinStartCurveFactor, costBreakdownEarlySplitMode ? 0.14 : 0.08),
      maxStartCurveFactor: safeNumber(snapshot.layout?.costBreakdownSplitOuterMaxStartCurveFactor, costBreakdownEarlySplitMode ? 0.28 : 0.18),
      minEndCurveFactor: safeNumber(snapshot.layout?.costBreakdownSplitOuterMinEndCurveFactor, 0.18),
      maxEndCurveFactor: safeNumber(snapshot.layout?.costBreakdownSplitOuterMaxEndCurveFactor, costBreakdownEarlySplitMode ? 0.42 : 0.36),
      deltaScale: safeNumber(snapshot.layout?.costBreakdownSplitOuterDeltaScale, 0.92),
      deltaInfluence: safeNumber(snapshot.layout?.costBreakdownSplitOuterDeltaInfluence, costBreakdownEarlySplitMode ? 0.024 : 0.036),
    });
    const splitInnerBranchOptions = resolveSplitBranchBoundaryOptions(resolvedBranchOptions, {
      targetHoldFactor: safeNumber(snapshot.layout?.costBreakdownSplitInnerTargetHoldFactor, costBreakdownEarlySplitMode ? 0.028 : 0.046),
      minTargetHoldLength: safeNumber(snapshot.layout?.costBreakdownSplitInnerMinTargetHoldLength, costBreakdownEarlySplitMode ? 2 : 4),
      maxTargetHoldLength: safeNumber(snapshot.layout?.costBreakdownSplitInnerMaxTargetHoldLength, costBreakdownEarlySplitMode ? 7 : 10),
      startCurveFactor: safeNumber(snapshot.layout?.costBreakdownSplitInnerStartCurveFactor, costBreakdownEarlySplitMode ? 0.24 : 0.14),
      endCurveFactor: safeNumber(snapshot.layout?.costBreakdownSplitInnerEndCurveFactor, costBreakdownEarlySplitMode ? 0.34 : 0.28),
      minStartCurveFactor: safeNumber(snapshot.layout?.costBreakdownSplitInnerMinStartCurveFactor, costBreakdownEarlySplitMode ? 0.16 : 0.1),
      maxStartCurveFactor: safeNumber(snapshot.layout?.costBreakdownSplitInnerMaxStartCurveFactor, costBreakdownEarlySplitMode ? 0.3 : 0.2),
      minEndCurveFactor: safeNumber(snapshot.layout?.costBreakdownSplitInnerMinEndCurveFactor, 0.18),
      maxEndCurveFactor: safeNumber(snapshot.layout?.costBreakdownSplitInnerMaxEndCurveFactor, costBreakdownEarlySplitMode ? 0.38 : 0.34),
      deltaScale: safeNumber(snapshot.layout?.costBreakdownSplitInnerDeltaScale, 0.9),
      deltaInfluence: safeNumber(snapshot.layout?.costBreakdownSplitInnerDeltaInfluence, costBreakdownEarlySplitMode ? 0.02 : 0.03),
    });
    const mirroredSplitOuterBranchOptions = mirrorFlowBoundaryOptions(splitOuterBranchOptions);
    const mirroredSplitInnerBranchOptions = mirrorFlowBoundaryOptions(splitInnerBranchOptions);
    const upperPath = [
      `M ${sourcePathX} ${upperSourceTop}`,
      `L ${splitX} ${upperSourceTop}`,
      buildFlowBoundarySegment(splitX, upperSourceTop, upperTargetPathX, upperFrame.y, splitOuterBranchOptions),
      `L ${upperTargetPathX} ${upperFrame.y + upperFrame.height}`,
      buildFlowBoundarySegment(
        upperTargetPathX,
        upperFrame.y + upperFrame.height,
        splitX,
        sharedSeamY,
        mirroredSplitInnerBranchOptions
      ),
      `L ${sourcePathX} ${sharedSeamY}`,
      "Z",
    ].join(" ");
    const lowerPath = [
      `M ${sourcePathX} ${sharedSeamY}`,
      `L ${splitX} ${sharedSeamY}`,
      buildFlowBoundarySegment(splitX, sharedSeamY, lowerTargetPathX, lowerFrame.y, splitInnerBranchOptions),
      `L ${lowerTargetPathX} ${lowerFrame.y + lowerFrame.height}`,
      buildFlowBoundarySegment(
        lowerTargetPathX,
        lowerFrame.y + lowerFrame.height,
        splitX,
        lowerSourceBottom,
        mirroredSplitOuterBranchOptions
      ),
      `L ${sourcePathX} ${lowerSourceBottom}`,
      "Z",
    ].join(" ");
    let html = `<path d="${upperPath}" fill="${redFlow}" opacity="0.97"></path>`;
    html += `<path d="${lowerPath}" fill="${redFlow}" opacity="0.97"></path>`;
    html += renderEditableNodeRect(upperFrame, redNode);
    html += renderEditableNodeRect(lowerFrame, redNode);
    html += renderRightBranchLabel(upperBlock.item, upperBlock.box, upperFrame.x, nodeWidth, redText, {
      density,
      defaultMode: "negative-parentheses",
      labelX: costBreakdownLabelSafeX,
      centerWrapped: false,
      labelCenterY: upperFrame.centerY,
    });
    html += renderRightBranchLabel(lowerBlock.item, lowerBlock.box, lowerFrame.x, nodeWidth, redText, {
      density,
      defaultMode: "negative-parentheses",
      labelX: costBreakdownLabelSafeX,
      centerWrapped: false,
      labelCenterY: lowerFrame.centerY,
    });
    return html;
  };
  const renderOperatingProfitBreakdownCallout = () => {
    if (!operatingProfitBreakdown.length) return "";
    const boxX =
      snapshot.layout?.operatingProfitBreakdownX !== null && snapshot.layout?.operatingProfitBreakdownX !== undefined
        ? safeNumber(snapshot.layout?.operatingProfitBreakdownX) + leftShiftX
        : opX + 140;
    const boxY = layoutY(snapshot.layout?.operatingProfitBreakdownY, 554);
    const boxWidth = safeNumber(snapshot.layout?.operatingProfitBreakdownWidth, 232);
    const rowHeight = scaleY(safeNumber(snapshot.layout?.operatingProfitBreakdownRowHeight, 42));
    const paddingX = safeNumber(snapshot.layout?.operatingProfitBreakdownPaddingX, 16);
    const paddingTop = scaleY(safeNumber(snapshot.layout?.operatingProfitBreakdownPaddingTop, 18));
    const pointerX =
      snapshot.layout?.operatingProfitBreakdownPointerX !== null && snapshot.layout?.operatingProfitBreakdownPointerX !== undefined
        ? safeNumber(snapshot.layout?.operatingProfitBreakdownPointerX) + leftShiftX
        : boxX + boxWidth / 2;
    const pointerWidth = safeNumber(snapshot.layout?.operatingProfitBreakdownPointerWidth, 30);
    const pointerHeight = scaleY(safeNumber(snapshot.layout?.operatingProfitBreakdownPointerHeight, 16));
    const boxHeight = paddingTop * 2 + operatingProfitBreakdown.length * rowHeight;
    let html = `
      <path d="M ${pointerX - pointerWidth / 2} ${boxY} L ${pointerX} ${boxY - pointerHeight} L ${pointerX + pointerWidth / 2} ${boxY}" fill="#FFFFFF" stroke="#111111" stroke-width="2.4" stroke-linejoin="round"></path>
      <rect x="${boxX}" y="${boxY}" width="${boxWidth}" height="${boxHeight}" rx="16" fill="#FFFFFF" stroke="#111111" stroke-width="2.4"></rect>
    `;
    operatingProfitBreakdown.forEach((item, index) => {
      const rowY = boxY + paddingTop + rowHeight * index;
      const valueX = boxX + boxWidth - paddingX;
      const labelX = boxX + paddingX + (item.lockupKey ? safeNumber(item.labelOffsetX, 88) : 0);
      if (item.lockupKey) {
        html += renderBusinessLockup(item.lockupKey, boxX + paddingX, rowY - scaleY(safeNumber(item.lockupYOffset, 18)), {
          scale: safeNumber(item.lockupScale, 0.34),
        });
      }
      if (!item.hideLabel) {
        html += `<text x="${labelX}" y="${rowY + scaleY(10)}" font-size="18" font-weight="700" fill="${dark}">${escapeHtml(item.name)}</text>`;
      }
      html += `<text x="${valueX}" y="${rowY + scaleY(10)}" text-anchor="end" font-size="18" font-weight="700" fill="${greenText}">${escapeHtml(formatItemBillions(item, "plain"))}</text>`;
    });
    return html;
  };
  let revenueFrame;
  let grossFrame;
  let costFrame;
  let operatingFrame;
  let operatingExpenseFrame;
  let netFrame;
  const refreshEditableNodeFrames = () => {
    revenueFrame = editableNodeFrame("revenue", revenueX, revenueTop, nodeWidth, revenueHeight);
    grossFrame = editableNodeFrame("gross", grossX, grossTop, nodeWidth, grossHeight);
    costFrame = editableNodeFrame("cost", grossX, costTop, nodeWidth, costHeight);
    operatingFrame = editableNodeFrame("operating", opX, opTop, nodeWidth, opHeight);
    operatingExpenseFrame = editableNodeFrame("operating-expenses", opX, opexTop, nodeWidth, opexHeight);
    netFrame = editableNodeFrame("net", netX, netTop, nodeWidth, netHeight);
  };
  refreshEditableNodeFrames();
  const refineLeadingNegativeExpansion = () => {
    const negativeEntries = [
      ...deductionBoxes
        .map((box, index) => {
          const sourceSlice = deductionSourceSlices[index] || deductionSlices[index];
          if (!box || !sourceSlice) return null;
          return {
            lane: "deduction",
            index,
            box,
            sourceSlice,
            minHeight: deductionSlices[index]?.item?.name === "Other" ? 6 : 12,
            sourceTop: opDeductionSourceBand.top,
            sourceBottom: opDeductionSourceBand.bottom,
            sourceX: operatingFrame.right,
            targetX: rightTerminalNodeX,
            sourceNodeId: "operating",
            targetNodeId: `deduction-${index}`,
            branchOptions: resolveDeductionTerminalBranchOptions(index),
          };
        })
        .filter(Boolean),
      ...opexBoxes
        .map((box, index) => {
          const sourceSlice = opexSourceSlices[index] || opexSlices[index];
          if (!box || !sourceSlice) return null;
          return {
            lane: "opex",
            index,
            box,
            sourceSlice,
            minHeight: 14,
            sourceTop: opexTop,
            sourceBottom: opexBottom,
            sourceX: operatingExpenseFrame.right,
            targetX: opexTargetX,
            sourceNodeId: "operating-expenses",
            targetNodeId: `opex-${index}`,
            branchOptions: standardTerminalBranchOptions,
          };
        })
        .filter(Boolean),
    ].sort((left, right) => left.box.center - right.box.center);
    if (negativeEntries.length < 2) return;
    const leadEntry = negativeEntries[0];
    const suffixEntries = negativeEntries.slice(1);
    const nextEntry = suffixEntries[0];
    if (!nextEntry) return;
    const sampleRatios = [0.18, 0.36, 0.56, 0.76, 0.92];
    const resolveEntryGeometry = (entry, centerShiftY = 0) => {
      const sourceSlice =
        entry.lane === "deduction"
          ? resolveDeductionTerminalSourceSlice(entry.index, entry.sourceSlice)
          : entry.sourceSlice;
      const sourceShift = layoutReferenceOffsetFor(entry.sourceNodeId);
      const targetShift = layoutReferenceOffsetFor(entry.targetNodeId);
      const sourceCoverInset = Math.max(
        safeNumber(entry.branchOptions.sourceCoverInsetX, safeNumber(snapshot.layout?.branchSourceCoverInsetX, 1.5)),
        0
      );
      const mergedBranchOptions = {
        ...mergeOutflowRibbonOptions(entry.branchOptions),
        endCapWidth: 0,
        targetCoverInsetX: safeNumber(
          entry.branchOptions.targetCoverInsetX,
          safeNumber(snapshot.layout?.branchTargetCoverInsetX, 14)
        ),
      };
      const bridge = constantThicknessBridge(
        sourceSlice,
        entry.box.center + centerShiftY,
        entry.minHeight,
        entry.sourceTop,
        entry.sourceBottom
      );
      const targetTop = bridge.targetTop + targetShift.dy;
      return {
        sourceX: entry.sourceX - sourceCoverInset + sourceShift.dx,
        sourceTop: bridge.sourceTop + sourceShift.dy,
        sourceBottom: bridge.sourceBottom + sourceShift.dy,
        targetX: entry.targetX + mergedBranchOptions.targetCoverInsetX + targetShift.dx,
        targetTop,
        targetBottom: targetTop + bridge.targetHeight,
        options: mergedBranchOptions,
      };
    };
    const leadGeometry = resolveEntryGeometry(leadEntry, 0);
    const suffixShiftHeadroomY = Math.max(
      terminalLayoutBottomLimit - Math.max(...suffixEntries.map((entry) => entry.box.bottom)),
      0
    );
    if (!(suffixShiftHeadroomY > 0.5)) return;
    const buildCandidates = (maxY, segments = 6) =>
      Array.from(
        new Set(
          [0, maxY, ...Array.from({ length: segments + 1 }, (_unused, index) => (maxY * index) / Math.max(segments, 1))].map(
            (value) => Number(clamp(value, 0, maxY).toFixed(2))
          )
        )
      );
    const candidateShiftYs = buildCandidates(
      Math.min(
        suffixShiftHeadroomY,
        scaleY(safeNumber(snapshot.layout?.leadingNegativeExpansionMaxShiftY, 88))
      ),
      7
    );
    const minExpansionY = scaleY(safeNumber(snapshot.layout?.leadingNegativeExpansionMinY, 18));
    const sourceGapY = scaleY(safeNumber(snapshot.layout?.leadingNegativeExpansionSourceGapY, 10));
    const preferredTargetGapBaseY = scaleY(
      safeNumber(snapshot.layout?.leadingNegativeExpansionPreferredTargetGapY, leadEntry.lane === "deduction" ? 96 : 82)
    );
    const minTargetGapY = scaleY(safeNumber(snapshot.layout?.leadingNegativeExpansionMinTargetGapY, 34));
    const maxTargetGapOvershootY = scaleY(safeNumber(snapshot.layout?.leadingNegativeExpansionMaxOvershootY, 30));
    const measureCorridor = (shiftY) => {
      const nextGeometry = resolveEntryGeometry(nextEntry, shiftY);
      const targetGapY = nextGeometry.targetTop - leadGeometry.targetBottom;
      let maxDeficitY = 0;
      let earlyMinGapY = Infinity;
      let lateMinGapY = Infinity;
      const sampleLeft = Math.max(leadGeometry.sourceX, nextGeometry.sourceX);
      const sampleRight = Math.min(leadGeometry.targetX, nextGeometry.targetX);
      if (sampleRight > sampleLeft + 4) {
        sampleRatios.forEach((ratio) => {
          const sampleX = sampleLeft + (sampleRight - sampleLeft) * ratio;
          const leadEnvelope = flowEnvelopeAtX(
            sampleX,
            leadGeometry.sourceX,
            leadGeometry.sourceTop,
            leadGeometry.sourceBottom,
            leadGeometry.targetX,
            leadGeometry.targetTop,
            leadGeometry.targetBottom,
            leadGeometry.options
          );
          const nextEnvelope = flowEnvelopeAtX(
            sampleX,
            nextGeometry.sourceX,
            nextGeometry.sourceTop,
            nextGeometry.sourceBottom,
            nextGeometry.targetX,
            nextGeometry.targetTop,
            nextGeometry.targetBottom,
            nextGeometry.options
          );
          if (!leadEnvelope || !nextEnvelope) return;
          const corridorGapY = nextEnvelope.top - leadEnvelope.bottom;
          const desiredGapY = sourceGapY + (preferredTargetGapBaseY - sourceGapY) * Math.pow(ratio, 1.34);
          maxDeficitY = Math.max(maxDeficitY, desiredGapY - corridorGapY);
          if (ratio <= 0.36) earlyMinGapY = Math.min(earlyMinGapY, corridorGapY);
          if (ratio >= 0.56) lateMinGapY = Math.min(lateMinGapY, corridorGapY);
        });
      }
      return {
        nextGeometry,
        targetGapY,
        maxDeficitY,
        earlyMinGapY,
        lateMinGapY,
      };
    };
    const currentGapProfile = measureCorridor(0);
    const currentTargetGapY = currentGapProfile.targetGapY;
    const activationGapY = scaleY(
      safeNumber(snapshot.layout?.leadingNegativeExpansionActivationGapY, leadEntry.lane === "deduction" ? 78 : 62)
    );
    const activationCorridorDeficitY = scaleY(
      safeNumber(snapshot.layout?.leadingNegativeExpansionActivationCorridorDeficitY, 16)
    );
    const insufficientCorridor =
      currentGapProfile.maxDeficitY > activationCorridorDeficitY ||
      currentGapProfile.lateMinGapY <
        preferredTargetGapBaseY * safeNumber(snapshot.layout?.leadingNegativeExpansionLateGapFloorFactor, 0.56);
    if (currentTargetGapY >= activationGapY && !insufficientCorridor) return;
    const preferredTargetGapY = Math.max(
      preferredTargetGapBaseY,
      currentTargetGapY +
        clamp(
          candidateShiftYs[candidateShiftYs.length - 1] * safeNumber(snapshot.layout?.leadingNegativeExpansionFactor, 0.68),
          minExpansionY,
          candidateShiftYs[candidateShiftYs.length - 1]
        )
    );
    const evaluateShift = (shiftY) => {
      const gapProfile = measureCorridor(shiftY);
      const nextGeometry = gapProfile.nextGeometry;
      const targetGapY = gapProfile.targetGapY;
      let score =
        Math.max(minTargetGapY - targetGapY, 0) * 180 +
        Math.abs(targetGapY - preferredTargetGapY) * 3.1 +
        shiftY * 0.12;
      const sampleLeft = Math.max(leadGeometry.sourceX, nextGeometry.sourceX);
      const sampleRight = Math.min(leadGeometry.targetX, nextGeometry.targetX);
      if (sampleRight > sampleLeft + 4) {
        sampleRatios.forEach((ratio) => {
          const sampleX = sampleLeft + (sampleRight - sampleLeft) * ratio;
          const leadEnvelope = flowEnvelopeAtX(
            sampleX,
            leadGeometry.sourceX,
            leadGeometry.sourceTop,
            leadGeometry.sourceBottom,
            leadGeometry.targetX,
            leadGeometry.targetTop,
            leadGeometry.targetBottom,
            leadGeometry.options
          );
          const nextEnvelope = flowEnvelopeAtX(
            sampleX,
            nextGeometry.sourceX,
            nextGeometry.sourceTop,
            nextGeometry.sourceBottom,
            nextGeometry.targetX,
            nextGeometry.targetTop,
            nextGeometry.targetBottom,
            nextGeometry.options
          );
          if (!leadEnvelope || !nextEnvelope) return;
          const corridorGapY = nextEnvelope.top - leadEnvelope.bottom;
          const desiredGapY = sourceGapY + (preferredTargetGapY - sourceGapY) * Math.pow(ratio, 1.34);
          const weight = 1.2 + ratio * 3.4;
          score += Math.max(desiredGapY - corridorGapY, 0) * 22 * weight;
          score += Math.max(corridorGapY - (desiredGapY + maxTargetGapOvershootY), 0) * 2.8 * weight;
        });
      }
      score += Math.max(sourceGapY - gapProfile.earlyMinGapY, 0) * 18;
      return score;
    };
    const baselineScore = evaluateShift(0);
    let bestShiftY = 0;
    let bestScore = baselineScore;
    candidateShiftYs.forEach((shiftY) => {
      const score = evaluateShift(shiftY);
      if (score < bestScore) {
        bestScore = score;
        bestShiftY = shiftY;
      }
    });
    if (!(bestShiftY > 0.5) || bestScore >= baselineScore - 1.5) return;
    suffixEntries.forEach((entry) => {
      if (entry.lane === "deduction") {
        deductionBoxes[entry.index] = shiftBoxCenter(deductionBoxes[entry.index], deductionBoxes[entry.index].center + bestShiftY);
      } else {
        opexBoxes[entry.index] = shiftBoxCenter(opexBoxes[entry.index], opexBoxes[entry.index].center + bestShiftY);
      }
    });
  };
  const refineSparseOpexLadderBalance = () => {
    if (deductionBoxes.length || costBreakdownSharesOpexColumn || opexBoxes.length !== 2) return;
    const firstBox = opexBoxes[0];
    const secondBox = opexBoxes[1];
    const firstSourceSlice = opexSourceSlices[0] || opexSlices[0];
    const secondSourceSlice = opexSourceSlices[1] || opexSlices[1];
    if (!firstBox || !secondBox || !firstSourceSlice || !secondSourceSlice) return;
    const currentNodeOffsetY = autoLayoutOffsetForNode("operating-expenses").dy;
    const currentTopGapY = safeNumber(firstBox.top, Infinity) - (opexBottom + currentNodeOffsetY);
    const currentInterGapY = safeNumber(secondBox.top, Infinity) - safeNumber(firstBox.bottom, -Infinity);
    const currentBranchSpreadY =
      (safeNumber(secondBox.center, 0) - (safeNumber(secondSourceSlice.center, 0) + currentNodeOffsetY)) -
      (safeNumber(firstBox.center, 0) - (safeNumber(firstSourceSlice.center, 0) + currentNodeOffsetY));
    const activationInterGapY = scaleY(safeNumber(snapshot.layout?.sparseOpexLadderActivationGapY, 244));
    const activationBranchSpreadY = scaleY(safeNumber(snapshot.layout?.sparseOpexLadderActivationBranchSpreadY, 316));
    if (currentTopGapY >= scaleY(safeNumber(snapshot.layout?.sparseOpexLadderTopGapActivationY, 10)) &&
        currentInterGapY < activationInterGapY &&
        currentBranchSpreadY < activationBranchSpreadY) {
      return;
    }
    const minInterGapY = scaleY(safeNumber(snapshot.layout?.sparseOpexLadderMinGapY, 92));
    const availableCompressionY = Math.max(currentInterGapY - minInterGapY, 0);
    const nodeDropMaxY = scaleY(safeNumber(snapshot.layout?.sparseOpexLadderNodeDropMaxY, 44));
    const topShiftMaxY = Math.max(
      0,
      Math.min(scaleY(safeNumber(snapshot.layout?.sparseOpexLadderTopShiftMaxY, 42)), availableCompressionY)
    );
    const bottomLiftMaxY = Math.max(
      0,
      Math.min(scaleY(safeNumber(snapshot.layout?.sparseOpexLadderBottomLiftMaxY, 520)), availableCompressionY)
    );
    if (!(nodeDropMaxY > 0.5 || topShiftMaxY > 0.5 || bottomLiftMaxY > 0.5)) return;
    const buildAxisCandidates = (maxY, segments = 6) =>
      Array.from(
        new Set(
          [0, maxY, ...Array.from({ length: segments + 1 }, (_unused, index) => (maxY * index) / Math.max(segments, 1))].map(
            (value) => Number(clamp(value, 0, maxY).toFixed(2))
          )
        )
      );
    const nodeDropCandidates = buildAxisCandidates(nodeDropMaxY, 5);
    const topShiftCandidates = buildAxisCandidates(topShiftMaxY, 5);
    const bottomLiftCandidates = buildAxisCandidates(bottomLiftMaxY, 8);
    const sparseAvailableSpanY = Math.max(
      terminalLayoutBottomLimit - Math.max(rightTerminalSummaryObstacleBottom, opexBottom + currentNodeOffsetY),
      1
    );
    const preferredTopGapY = scaleY(safeNumber(snapshot.layout?.sparseOpexLadderPreferredNodeGapY, 16));
    const minTopGapY = scaleY(safeNumber(snapshot.layout?.sparseOpexLadderMinNodeGapY, 4));
    const maxTopGapY = scaleY(safeNumber(snapshot.layout?.sparseOpexLadderMaxNodeGapY, 42));
    const preferredInterGapY = clamp(
      sparseAvailableSpanY * safeNumber(snapshot.layout?.sparseOpexLadderPreferredGapFactor, 0.2),
      scaleY(148),
      scaleY(228)
    );
    const maxInterGapY = Math.max(
      preferredInterGapY + scaleY(56),
      scaleY(safeNumber(snapshot.layout?.sparseOpexLadderMaxGapY, 296))
    );
    const preferredFirstBranchDropY = scaleY(safeNumber(snapshot.layout?.sparseOpexLadderPreferredFirstDropY, 54));
    const maxFirstBranchDropY = scaleY(safeNumber(snapshot.layout?.sparseOpexLadderMaxFirstDropY, 104));
    const preferredBranchSpreadY = preferredInterGapY + scaleY(safeNumber(snapshot.layout?.sparseOpexLadderBranchSpreadBufferY, 38));
    const maxBranchSpreadY = preferredBranchSpreadY + scaleY(safeNumber(snapshot.layout?.sparseOpexLadderMaxBranchSpreadOvershootY, 84));
    const preferredSecondBranchDropY = preferredFirstBranchDropY + preferredBranchSpreadY;
    const maxSecondBranchDropY = preferredSecondBranchDropY + scaleY(safeNumber(snapshot.layout?.sparseOpexLadderMaxSecondDropOvershootY, 110));
    const resolveCandidateGeometry = (sourceSlice, center, nodeDropY) => {
      const shiftedSourceSlice = {
        ...sourceSlice,
        center: safeNumber(sourceSlice.center, 0) + currentNodeOffsetY + nodeDropY,
      };
      const shiftedClampTop = opexTop + currentNodeOffsetY + nodeDropY;
      const shiftedClampBottom = opexBottom + currentNodeOffsetY + nodeDropY;
      const bridge = constantThicknessBridge(shiftedSourceSlice, center, 14, shiftedClampTop, shiftedClampBottom);
      return {
        targetTop: bridge.targetTop,
        targetHeight: bridge.targetHeight,
        targetBottom: bridge.targetTop + bridge.targetHeight,
        targetCenter: bridge.targetTop + bridge.targetHeight / 2,
      };
    };
    const evaluateCandidate = (nodeDropY, topShiftY, bottomLiftY) => {
      const firstGeometry = resolveCandidateGeometry(firstSourceSlice, firstBox.center + topShiftY, nodeDropY);
      const secondGeometry = resolveCandidateGeometry(secondSourceSlice, secondBox.center - bottomLiftY, nodeDropY);
      const nodeBottomY = opexBottom + currentNodeOffsetY + nodeDropY;
      const topGapY = firstGeometry.targetTop - nodeBottomY;
      const interGapY = secondGeometry.targetTop - firstGeometry.targetBottom;
      const firstBranchDropY = firstGeometry.targetCenter - (safeNumber(firstSourceSlice.center, 0) + currentNodeOffsetY + nodeDropY);
      const secondBranchDropY = secondGeometry.targetCenter - (safeNumber(secondSourceSlice.center, 0) + currentNodeOffsetY + nodeDropY);
      const branchSpreadY = secondBranchDropY - firstBranchDropY;
      let score =
        Math.max(minTopGapY - topGapY, 0) * 240 +
        Math.max(topGapY - maxTopGapY, 0) * 74 +
        Math.abs(topGapY - preferredTopGapY) * 8.2 +
        Math.max(minInterGapY - interGapY, 0) * 210 +
        Math.max(interGapY - maxInterGapY, 0) * 92 +
        Math.abs(interGapY - preferredInterGapY) * 2.4 +
        Math.max(firstBranchDropY - maxFirstBranchDropY, 0) * 128 +
        Math.abs(firstBranchDropY - preferredFirstBranchDropY) * 5.2 +
        Math.max(branchSpreadY - maxBranchSpreadY, 0) * 96 +
        Math.abs(branchSpreadY - preferredBranchSpreadY) * 2.8 +
        Math.max(secondBranchDropY - maxSecondBranchDropY, 0) * 84 +
        Math.abs(secondBranchDropY - preferredSecondBranchDropY) * 2.1;
      score += nodeDropY * 0.1 + topShiftY * 0.12 + bottomLiftY * 0.08;
      return score;
    };
    const baselineScore = evaluateCandidate(0, 0, 0);
    let bestCandidate = {
      nodeDropY: 0,
      topShiftY: 0,
      bottomLiftY: 0,
      score: baselineScore,
    };
    nodeDropCandidates.forEach((nodeDropY) => {
      topShiftCandidates.forEach((topShiftY) => {
        bottomLiftCandidates.forEach((bottomLiftY) => {
          if (topShiftY + bottomLiftY > availableCompressionY + 0.01) return;
          const score = evaluateCandidate(nodeDropY, topShiftY, bottomLiftY);
          if (score < bestCandidate.score) {
            bestCandidate = {
              nodeDropY,
              topShiftY,
              bottomLiftY,
              score,
            };
          }
        });
      });
    });
    if (bestCandidate.score >= baselineScore - 1.5) return;
    if (bestCandidate.nodeDropY > 0.5) {
      setAutoLayoutNodeOffset("operating-expenses", { dy: currentNodeOffsetY + bestCandidate.nodeDropY });
    }
    if (bestCandidate.topShiftY > 0.5 && opexBoxes[0]) {
      opexBoxes[0] = shiftBoxCenter(opexBoxes[0], opexBoxes[0].center + bestCandidate.topShiftY);
    }
    if (bestCandidate.bottomLiftY > 0.5 && opexBoxes[1]) {
      opexBoxes[1] = shiftBoxCenter(opexBoxes[1], opexBoxes[1].center - bestCandidate.bottomLiftY);
    }
  };
  refinePrimaryNegativeLead();
  refineLeadingNegativeExpansion();
  if (costBreakdownSharesOpexColumn) {
    alignOpexSummaryToNode();
    refineSharedNegativeLadder();
    refinePrimaryNegativeLead();
  }
  alignOpexSummaryToNode();
  shiftOpexGroupDownForSummaryClearance();
  refineSparseOpexLadderBalance();
  alignOpexSummaryToNode();
  shiftOpexGroupDownForSummaryClearance();
  if (costBreakdownSharesOpexColumn && costBreakdownBoxes.length) {
    const opexSummaryMetrics = resolveOpexSummaryMetrics(layoutReferenceOffsetFor("operating-expenses"));
    const firstCostBreakdownTopY = Math.min(
      ...costBreakdownBoxes.filter(Boolean).map((box, index) => {
        const shift = layoutReferenceOffsetFor(`cost-breakdown-${index}`);
        const clearanceHeight = Math.max(
          safeNumber(costBreakdownGapHeights[index], box.height),
          safeNumber(costBreakdownPackingHeights[index], box.height),
          safeNumber(box.height, 0),
          1
        );
        return safeNumber(box.center, Infinity) + shift.dy - clearanceHeight / 2;
      })
    );
    const desiredCostBreakdownTopY =
      opexSummaryMetrics.bottom +
      scaleY(
        safeNumber(
          snapshot.layout?.opexSummaryToCostBreakdownGapY,
          costBreakdownSlices.length === 2 && costBreakdownSharesOpexColumn ? 30 : 24
        )
      );
    const costBreakdownShiftY = desiredCostBreakdownTopY - firstCostBreakdownTopY;
    if (costBreakdownShiftY > 0.5) {
      shiftCostBreakdownGroupDown(costBreakdownShiftY + scaleY(2));
      maintainCostBreakdownNodeGap();
    }
    alignOpexSummaryToNode();
  }
  if (costBreakdownSharesOpexColumn && costBreakdownBoxes.length >= 2 && opexBoxes.length) {
    const relevantOpexIndexes = opexBoxes
      .map((box, index) => ({ box, index }))
      .filter((entry) => entry.box)
      .slice(0, Math.min(opexBoxes.length, 2))
      .map((entry) => entry.index);
    if (relevantOpexIndexes.length) {
      const computeFirstCostBreakdownTopY = () =>
        Math.min(
          ...costBreakdownBoxes.filter(Boolean).map((box, index) => {
            const shift = layoutReferenceOffsetFor(`cost-breakdown-${index}`);
            return safeNumber(box.top, Infinity) + shift.dy;
          })
        );
      const currentNodeShiftY = autoLayoutOffsetForNode("operating-expenses").dy;
      const summaryObstacle = resolveOpexSummaryObstacleRect(layoutReferenceOffsetFor("operating-expenses"), opexSummaryAutoLiftY, {
        padX: safeNumber(snapshot.layout?.costBreakdownOpexRibbonObstaclePadX, 10),
        padY: safeNumber(snapshot.layout?.costBreakdownOpexRibbonObstaclePadY, 8),
      });
      let summaryGapY = computeFirstCostBreakdownTopY() - summaryObstacle.bottom;
      const preferredSummaryGapY = scaleY(
        safeNumber(snapshot.layout?.sharedOpexClusterPreferredSummaryGapY, costBreakdownBoxes.length >= 2 ? 42 : 32)
      );
      const minSummaryGapY = scaleY(
        safeNumber(snapshot.layout?.sharedOpexClusterMinSummaryGapY, costBreakdownBoxes.length >= 2 ? 26 : 20)
      );
      if (summaryGapY < preferredSummaryGapY - 0.5) {
        const appliedCostShiftY = shiftCostBreakdownGroupDown(preferredSummaryGapY - summaryGapY + scaleY(2));
        if (appliedCostShiftY > 0.01) {
          maintainCostBreakdownNodeGap();
          summaryGapY += appliedCostShiftY;
        }
      }
      const currentTopGapY =
        Math.min(...relevantOpexIndexes.map((index) => safeNumber(opexBoxes[index]?.top, Infinity))) - (opexBottom + currentNodeShiftY);
      const currentAverageBranchDropY =
        relevantOpexIndexes.reduce((sum, index) => {
          const box = opexBoxes[index];
          const sourceSlice = opexSourceSlices[index] || opexSlices[index];
          if (!box || !sourceSlice) return sum;
          return sum + (safeNumber(box.center, 0) - (safeNumber(sourceSlice.center, 0) + currentNodeShiftY));
        }, 0) / Math.max(relevantOpexIndexes.length, 1);
      const preferredTopGapY = scaleY(
        safeNumber(snapshot.layout?.sharedOpexClusterPreferredTopGapY, costBreakdownBoxes.length >= 2 ? 100 : 92)
      );
      const preferredBranchDropY = scaleY(
        safeNumber(snapshot.layout?.sharedOpexClusterPreferredBranchDropY, opexBoxes.length <= 2 ? 146 : 138)
      );
      const requestedNodeDropY = Math.max(
        currentTopGapY - preferredTopGapY,
        currentAverageBranchDropY - preferredBranchDropY,
        0
      );
      const nodeDropMaxY = Math.max(
        0,
        Math.min(
          scaleY(safeNumber(snapshot.layout?.sharedOpexClusterNodeDropMaxY, 28)),
          summaryGapY - minSummaryGapY
        )
      );
      const appliedNodeDropY = clamp(requestedNodeDropY, 0, nodeDropMaxY);
      if (appliedNodeDropY > 0.5) {
        setAutoLayoutNodeOffset("operating-expenses", { dy: currentNodeShiftY + appliedNodeDropY });
        alignOpexSummaryToNode();
      }
    }
  }
  refreshEditableNodeFrames();
  const revenueGrossBand = shiftedInterval(revenueGrossSourceBand.top, revenueGrossSourceBand.bottom, "revenue");
  const revenueCostBand = revenueCostSourceBand ? shiftedInterval(revenueCostSourceBand.top, revenueCostSourceBand.bottom, "revenue") : null;
  const grossProfitBand = shiftedInterval(grossProfitSourceBand.top, grossProfitSourceBand.bottom, "gross");
  const grossExpenseBand = shiftedInterval(grossExpenseSourceBand.top, grossExpenseSourceBand.bottom, "gross");
  const opexInboundBand = shiftedInterval(opexInboundTargetBand.top, opexInboundTargetBand.bottom, "operating-expenses");
  const opNetBand = shiftedInterval(opNetSourceBand.top, opNetSourceBand.bottom, "operating");
  const netDisplayBand = shiftedInterval(netDisplayTargetBand.top, netDisplayTargetBand.bottom, "net");
  const grossMetricYShifted = grossMetricY + editorOffsetForNode("gross").dy;
  const operatingMetricYShifted = operatingMetricY + editorOffsetForNode("operating").dy;
  const revenueLabelCenterXShifted = revenueLabelCenterX + editorOffsetForNode("revenue").dx;
  const revenueLabelCenterYShifted = revenueLabelCenterY + editorOffsetForNode("revenue").dy;
  const opexSummaryCenterXShifted = operatingExpenseFrame.centerX;
  const opexSummaryTopYShifted = opexSummaryTopY + editorOffsetForNode("operating-expenses").dy;
  const opexSummaryValueYShifted = opexSummaryValueY + editorOffsetForNode("operating-expenses").dy;
  const opexSummaryRatioYShifted = opexSummaryRatioY + editorOffsetForNode("operating-expenses").dy;
  const costSummaryBaselineY = resolveExpenseSummaryBaselineY(costFrame.bottom, {
    visualGapY: safeNumber(snapshot.layout?.costSummaryGapY, 28),
  });
  const mainOutflowSmoothingBoost = clamp(lowerRightPressureY / scaleY(92), 0, 1);
  const grossToOperatingRibbonOptions = {
    curveFactor: 0.6 + mainOutflowSmoothingBoost * 0.04,
    startCurveFactor: 0.2 + mainOutflowSmoothingBoost * 0.03,
    endCurveFactor: 0.33 + mainOutflowSmoothingBoost * 0.03,
    minStartCurveFactor: 0.17,
    maxStartCurveFactor: 0.32,
    minEndCurveFactor: 0.24,
    maxEndCurveFactor: 0.38,
    deltaScale: 0.84,
    deltaInfluence: 0.028,
    deltaCurveBoost: 0.028,
    sourceHoldFactor: 0.024,
    minSourceHoldLength: 0,
    maxSourceHoldLength: 4,
    targetHoldFactor: 0.054,
    minTargetHoldLength: 4,
    maxTargetHoldLength: 16,
    sourceHoldDeltaReduction: 0.76,
    targetHoldDeltaReduction: 0.84,
    minAdaptiveSourceHoldLength: 0.5,
    minAdaptiveTargetHoldLength: 1.5,
    holdDeltaScale: 0.42,
  };
  const grossToExpenseRibbonOptions = {
    curveFactor: 0.62 + mainOutflowSmoothingBoost * 0.05,
    startCurveFactor: 0.22 + mainOutflowSmoothingBoost * 0.04,
    endCurveFactor: 0.34 + mainOutflowSmoothingBoost * 0.03,
    minStartCurveFactor: 0.18,
    maxStartCurveFactor: 0.34,
    minEndCurveFactor: 0.24,
    maxEndCurveFactor: 0.4,
    deltaScale: 0.78,
    deltaInfluence: 0.026,
    deltaCurveBoost: 0.03,
    sourceHoldFactor: 0.018,
    minSourceHoldLength: 0,
    maxSourceHoldLength: 3,
    targetHoldFactor: 0.048,
    minTargetHoldLength: 3,
    maxTargetHoldLength: 14,
    sourceHoldDeltaReduction: 0.82,
    targetHoldDeltaReduction: 0.88,
    minAdaptiveSourceHoldLength: 0.5,
    minAdaptiveTargetHoldLength: 1.5,
    holdDeltaScale: 0.4,
  };
  const shiftedMainNetRibbonEnvelopeAtX = (sampleX) =>
    flowEnvelopeAtX(
      sampleX,
      operatingFrame.right,
      opNetBand.top,
      opNetBand.bottom,
      netFrame.x + safeNumber(snapshot.layout?.netTargetCoverInsetX, 0),
      netDisplayBand.top,
      netDisplayBand.bottom,
      netRibbonOptions
    );

  let svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(titleText)}" font-family="Aptos, Segoe UI, Arial, Helvetica, sans-serif" data-editor-bounds-left="0" data-editor-bounds-top="0" data-editor-bounds-right="${width}" data-editor-bounds-bottom="${height}">
      <rect x="0" y="0" width="${width}" height="${height}" fill="${background}"></rect>
      <g id="chartContent">
      <text x="${titleX}" y="${titleY}" text-anchor="${titleAnchor}" font-size="${titleFontSize}" font-weight="800" fill="${titleColor}" letter-spacing="0.3">${escapeHtml(titleText)}</text>
      ${snapshot.periodEndLabel ? `<text x="${periodEndX}" y="${periodEndY}" text-anchor="start" font-size="${periodEndFontSize}" fill="${muted}">${escapeHtml(localizePeriodEndLabel(snapshot.periodEndLabel || ""))}</text>` : ""}
      ${renderCorporateLogo(snapshot.companyLogoKey, logoX, logoY, { scale: logoScale })}
    `;

  leftDetailRenderSlices.forEach((slice, index) => {
    svg += renderLeftDetailLabel(slice, {
      ...leftDetailLabelBoxes[index],
      previousRibbonBottom: index > 0 ? leftDetailRenderSlices[index - 1]?.bottom : null,
    }, index);
  });

  sourceSlices.forEach((slice, index) => {
    const sourceFrame = editableNodeFrame(`source-${index}`, safeNumber(slice.nodeX, leftX), slice.top, sourceNodeWidth, slice.height);
    const revenueBandTop = slice.revenueTop + editorOffsetForNode("revenue").dy;
    const revenueBandBottom = slice.revenueBottom + editorOffsetForNode("revenue").dy;
    svg += `<path d="${sourceFlowPath(sourceFrame.right, sourceFrame.top, sourceFrame.bottom, revenueFrame.left, revenueBandTop, revenueBandBottom)}" fill="${slice.item.flowColor}" opacity="0.98"></path>`;
    svg += renderEditableNodeRect(sourceFrame, slice.item.nodeColor);
    svg += renderLeftLabel(slice, leftBoxes[index], index);
  });

  svg += `
      ${renderEditableNodeRect(revenueFrame, revenueNodeFill)}

      <path d="${replicaFlowPath(revenueFrame.right, revenueGrossBand.top, revenueGrossBand.bottom, grossFrame.left, grossFrame.top, grossFrame.bottom)}" fill="${greenFlow}" opacity="0.97"></path>
      ${
        showCostBridge && revenueCostBand
          ? `<path d="${replicaFlowPath(revenueFrame.right, revenueCostBand.top, revenueCostBand.bottom, costFrame.left, costFrame.top, costFrame.bottom)}" fill="${redFlow}" opacity="0.97"></path>`
          : ""
      }

      ${renderEditableNodeRect(grossFrame, greenNode)}
      ${renderMetricCluster(
        grossFrame.centerX,
        grossMetricYShifted,
        localizeChartPhrase(snapshot.grossProfitLabel || "Gross profit"),
        formatBillions(grossProfitBn),
        snapshot.grossMarginPct !== null && snapshot.grossMarginPct !== undefined ? `${formatPct(snapshot.grossMarginPct)} ${marginLabel()}` : "",
        snapshot.grossMarginYoyDeltaPp !== null && snapshot.grossMarginYoyDeltaPp !== undefined ? formatPp(snapshot.grossMarginYoyDeltaPp) : "",
        greenText,
        grossMetricLayout
      )}

      ${
        showCostBridge
          ? `
      ${renderEditableNodeRect(costFrame, redNode)}
      ${svgTextBlock(costFrame.centerX, costSummaryBaselineY, costLabelLines, {
        fill: redText,
        fontSize: expenseSummaryLayout.titleSize,
        weight: 700,
        anchor: "middle",
        lineHeight: expenseSummaryLayout.titleSize + 1,
        haloColor: background,
        haloWidth: expenseSummaryLayout.titleStroke,
      })}
      <text x="${costFrame.centerX}" y="${costSummaryBaselineY + (costLabelLines.length - 1) * (expenseSummaryLayout.titleSize + 1) + expenseSummaryLayout.valueOffset}" text-anchor="middle" font-size="${expenseSummaryLayout.valueSize}" font-weight="700" fill="${redText}" paint-order="stroke fill" stroke="${background}" stroke-width="${expenseSummaryLayout.valueStroke}" stroke-linejoin="round">${escapeHtml(formatBillionsByMode(costOfRevenueBn, "negative-parentheses"))}</text>
      `
          : ""
      }

      <path d="${replicaOutflowPath(grossFrame.right, grossProfitBand.top, grossProfitBand.bottom, operatingFrame.left, operatingFrame.top, operatingFrame.bottom, grossToOperatingRibbonOptions)}" fill="${greenFlow}" opacity="0.97"></path>
      <path d="${replicaOutflowPath(grossFrame.right, grossExpenseBand.top, grossExpenseBand.bottom, operatingExpenseFrame.left, opexInboundBand.top, opexInboundBand.bottom, grossToExpenseRibbonOptions)}" fill="${redFlow}" opacity="0.97"></path>

      ${renderEditableNodeRect(operatingFrame, greenNode)}
      ${renderMetricCluster(
        operatingFrame.centerX,
        operatingMetricYShifted,
        localizeChartPhrase(snapshot.operatingProfitLabel || "Operating profit"),
        formatBillions(operatingProfitBn),
        snapshot.operatingMarginPct !== null && snapshot.operatingMarginPct !== undefined ? `${formatPct(snapshot.operatingMarginPct)} ${marginLabel()}` : "",
        snapshot.operatingMarginYoyDeltaPp !== null && snapshot.operatingMarginYoyDeltaPp !== undefined ? formatPp(snapshot.operatingMarginYoyDeltaPp) : "",
        greenText,
        operatingMetricLayout
      )}

      ${renderEditableNodeRect(operatingExpenseFrame, redNode)}

  `;

  let positiveMarkup = "";
  if (positiveAdjustments.length) {
    const positiveRunwayAvailable = Math.max(netX - (opX + nodeWidth), 1);
    const positiveReferenceHeight = positiveHeights.length ? Math.max(...positiveHeights) : scaleY(10);
    const positiveNodeWidth = clamp(
      safeNumber(
        snapshot.layout?.positiveNodeWidth,
        Math.max(
          positiveReferenceHeight * safeNumber(snapshot.layout?.positiveSourceCapWidthFactor, 3.4),
          positiveRunwayAvailable * safeNumber(snapshot.layout?.positiveSourceCapWidthRunwayFactor, 0.065) +
            safeNumber(snapshot.layout?.positiveSourceCapBaseWidth, 52)
        )
      ),
      safeNumber(snapshot.layout?.positiveNodeMinWidth, 56),
      Math.max(
        safeNumber(snapshot.layout?.positiveNodeMaxWidth, clamp(positiveRunwayAvailable * 0.22, 84, 112)),
        safeNumber(snapshot.layout?.positiveNodeMinWidth, 56)
      )
    );
    const positiveTargetInsetX = safeNumber(snapshot.layout?.positiveTargetInsetX, 0);
    const positiveMergeOverlapY = scaleY(safeNumber(snapshot.layout?.positiveMergeOverlapY, 0));
    const positiveNodeMinX = opX + nodeWidth + clamp(
      safeNumber(snapshot.layout?.positiveNodeMinOffsetFromOpX, positiveRunwayAvailable * (positiveAbove ? 0.08 : 0.1)),
      24,
      56
    );
    const positiveNodeMaxX = netX - positiveNodeWidth - clamp(
      safeNumber(snapshot.layout?.positiveNodeMinOffsetFromNetX, positiveRunwayAvailable * (positiveAbove ? 0.055 : 0.07)),
      18,
      56
    );
    const positiveNetAffinityStrength = clamp(
      safeNumber(
        snapshot.layout?.positiveNetAffinityStrength,
        positiveAbove
          ? (positiveAdjustments.length === 1 ? 0.2 : 0) +
            clamp(lowerRightPressureY / scaleY(92), 0, 1) * 0.18 +
            Math.max(rawCostBreakdown.length + rawOpexItems.length + rawBelowOperatingItems.length - 4, 0) * 0.04
          : 0
      ),
      0,
      0.48
    );
    const positiveBranchRunwayX = clamp(
      safeNumber(
        snapshot.layout?.positiveBranchRunwayX,
        Math.max(
          positiveReferenceHeight * safeNumber(snapshot.layout?.positiveBranchRunwayHeightFactor, positiveAbove ? 0.98 : 0.94),
          positiveRunwayAvailable * safeNumber(snapshot.layout?.positiveBranchRunwayFactor, positiveAbove ? 0.074 : 0.068),
          positiveAbove ? 42 : 38
        )
      ),
      positiveAbove ? 30 : 28,
      Math.max(positiveRunwayAvailable - positiveNodeWidth - 20, positiveAbove ? 30 : 28)
    );
    const defaultPositiveNodeX = clamp(
      netX - positiveNodeWidth - positiveBranchRunwayX,
      positiveNodeMinX,
      Math.max(positiveNodeMaxX, positiveNodeMinX)
    );
    const positiveCorridorSampleXsForNode = (candidateNodeX) => {
      const runwayDx = Math.max(netX - (candidateNodeX + positiveNodeWidth), 1);
      return [0.14, 0.32, 0.52, 0.74].map((t) =>
        clamp(
          candidateNodeX + positiveNodeWidth + runwayDx * t,
          candidateNodeX + positiveNodeWidth + 1,
          Math.max(netX - 2, candidateNodeX + positiveNodeWidth + 1)
        )
      );
    };
    let positiveNodeX = defaultPositiveNodeX;
    const positiveSourceDropY = 0;
    let positiveTop = positiveAbove
      ? clamp(
          netTop - totalPositiveStackHeight - positiveNodeGap,
          scaleY(212) + positiveLabelBlockHeight,
          netTop - scaleY(10) - totalPositiveStackHeight
        )
      : clamp(
          netBottom + positiveNodeGap,
          scaleY(308),
          chartBottomLimit - totalPositiveStackHeight - positiveLabelBlockHeight - scaleY(12)
        );
    let upperMetricFloor = Math.max(grossMetricY + grossMetricLayout.blockHeight, operatingMetricY + operatingMetricLayout.blockHeight);
    let positiveBranchClearanceY = Math.max(scaleY(16), positiveReferenceHeight * 0.72);
    let positiveCapClearanceY = Math.max(scaleY(12), positiveReferenceHeight * 0.52);
    const positiveProminenceRatio =
      totalPositiveMergeHeight > 0 && coreNetTargetHeight > 0 ? totalPositiveMergeHeight / Math.max(coreNetTargetHeight, 1) : 0;
    const positiveProminentAbove =
      positiveAbove &&
      positiveProminenceRatio >= safeNumber(snapshot.layout?.positiveProminentThresholdRatio, 0.6);
    const positiveBranchPathOptions = {
      curveFactor: positiveAbove ? 0.68 : 0.7,
      startCurveFactor: positiveAbove ? 0.28 : 0.26,
      endCurveFactor: positiveAbove ? 0.42 : 0.46,
      minStartCurveFactor: 0.22,
      maxStartCurveFactor: 0.36,
      minEndCurveFactor: 0.34,
      maxEndCurveFactor: 0.54,
      deltaScale: 0.78,
      deltaInfluence: 0.036,
      thicknessInfluence: 0.038,
      sourceHoldFactor: 0,
      minSourceHoldLength: 0,
      maxSourceHoldLength: 1,
      targetHoldFactor: 0,
      minTargetHoldLength: 0,
      maxTargetHoldLength: 2,
      sourceHoldDeltaReduction: 0.08,
      targetHoldDeltaReduction: 0.14,
      minAdaptiveSourceHoldLength: 0,
      minAdaptiveTargetHoldLength: 0,
    };
    const grossMetricObstacle = metricClusterObstacleRect(
      grossFrame.centerX,
      grossMetricYShifted,
      snapshot.grossProfitLabel || "Gross profit",
      formatBillions(grossProfitBn),
      snapshot.grossMarginPct !== null && snapshot.grossMarginPct !== undefined ? `${formatPct(snapshot.grossMarginPct)} ${marginLabel()}` : "",
      snapshot.grossMarginYoyDeltaPp !== null && snapshot.grossMarginYoyDeltaPp !== undefined ? formatPp(snapshot.grossMarginYoyDeltaPp) : "",
      grossMetricLayout,
      scaleY(10)
    );
    const operatingMetricObstacle = metricClusterObstacleRect(
      operatingFrame.centerX,
      operatingMetricYShifted,
      snapshot.operatingProfitLabel || "Operating profit",
      formatBillions(operatingProfitBn),
      snapshot.operatingMarginPct !== null && snapshot.operatingMarginPct !== undefined ? `${formatPct(snapshot.operatingMarginPct)} ${marginLabel()}` : "",
      snapshot.operatingMarginYoyDeltaPp !== null && snapshot.operatingMarginYoyDeltaPp !== undefined ? formatPp(snapshot.operatingMarginYoyDeltaPp) : "",
      operatingMetricLayout,
      scaleY(10)
    );
    const netSummaryObstacle = rightSummaryObstacleRect(
      netSummaryLines,
      netFrame.x + nodeWidth + rightPrimaryLabelGapX,
      netFrame.centerY,
      scaleY(10)
    );
    const positiveUpperObstacleBottomAtX = (sampleX) => {
      let bottom = 0;
      [grossMetricObstacle, operatingMetricObstacle].forEach((obstacle) => {
        if (!obstacle) return;
        if (sampleX >= obstacle.left && sampleX <= obstacle.right) {
          bottom = Math.max(bottom, obstacle.bottom);
        }
      });
      return bottom;
    };
    const positiveUpperObstacleBottomForXs = (sampleXs) =>
      sampleXs.reduce((maxBottom, sampleX) => Math.max(maxBottom, positiveUpperObstacleBottomAtX(sampleX)), 0);
    const rightSideObstacles = [
      { left: netFrame.left - 10, right: netFrame.right + 10, top: netFrame.top - 10, bottom: netFrame.bottom + 10 },
      netSummaryObstacle,
      grossMetricObstacle,
      operatingMetricObstacle,
      ...deductionBoxes.map((box) => ({ left: belowLabelX - 12, right: width - 56, top: box.top - 6, bottom: box.bottom + 6 })),
      ...opexBoxes.map((box) => ({ left: opexLabelX - 12, right: width - 56, top: box.top - 6, bottom: box.bottom + 6 })),
    ];
    const deductionFlowObstacles = deductionSlices
      .map((slice, index) => {
        const box = deductionBoxes[index];
        if (!box) return null;
        const sourceSlice = deductionSourceSlices[index] || slice;
        const adjustedSourceSlice = resolveDeductionTerminalSourceSlice(index, sourceSlice);
        const bridge = constantThicknessBridge(
          adjustedSourceSlice,
          box.center,
          slice.item.name === "Other" ? 6 : 12,
          opDeductionSourceBand.top,
          opDeductionSourceBand.bottom
        );
        const branchOptions = resolveAdaptiveNegativeTerminalBranchOptions(
          resolveDeductionTerminalBranchOptions(index),
          bridge.sourceTop + editorOffsetForNode("operating").dy,
          bridge.sourceBottom + editorOffsetForNode("operating").dy,
          bridge.targetTop + editorOffsetForNode(`deduction-${index}`).dy,
          bridge.targetHeight,
          {
            index,
            count: Math.max(deductionSlices.length + opexSlices.length, 1),
            laneBias: index === 0 ? 0.1 : 0.06,
          }
        );
        const targetFrame = editableNodeFrame(`deduction-${index}`, rightTerminalNodeX, bridge.targetTop, nodeWidth, bridge.targetHeight);
        return bridgeObstacleRect(
          operatingFrame.right,
          bridge.sourceTop + editorOffsetForNode("operating").dy,
          bridge.sourceBottom + editorOffsetForNode("operating").dy,
          targetFrame.x,
          targetFrame.y,
          targetFrame.height,
          {
            targetWidth: nodeWidth,
            padX: scaleY(18),
            padY: scaleY(12),
            branchOptions,
          }
        );
      })
      .filter(Boolean);
    const opexFlowObstacles = opexSlices
      .map((slice, index) => {
        const box = opexBoxes[index];
        const sourceSlice = opexSourceSlices[index] || slice;
        if (!box || !sourceSlice) return null;
        const bridge = constantThicknessBridge(sourceSlice, box.center, 12, opDeductionSourceBand.top, opDeductionSourceBand.bottom);
        const branchOptions = resolveAdaptiveNegativeTerminalBranchOptions(
          standardTerminalBranchOptions,
          bridge.sourceTop + editorOffsetForNode("operating-expenses").dy,
          bridge.sourceBottom + editorOffsetForNode("operating-expenses").dy,
          bridge.targetTop + editorOffsetForNode(`opex-${index}`).dy,
          bridge.targetHeight,
          {
            index,
            count: Math.max(opexSlices.length, 1),
            laneBias: 0.04,
          }
        );
        const targetFrame = editableNodeFrame(`opex-${index}`, rightTerminalNodeX, bridge.targetTop, nodeWidth, bridge.targetHeight);
        return bridgeObstacleRect(
          operatingExpenseFrame.right,
          bridge.sourceTop + editorOffsetForNode("operating-expenses").dy,
          bridge.sourceBottom + editorOffsetForNode("operating-expenses").dy,
          targetFrame.x,
          targetFrame.y,
          targetFrame.height,
          {
            targetWidth: nodeWidth,
            padX: scaleY(18),
            padY: scaleY(12),
            branchOptions,
          }
        );
      })
      .filter(Boolean);
    const positiveLabelObstacles = [...rightSideObstacles, ...deductionFlowObstacles, ...opexFlowObstacles];
    const branchSourceInsetX = Math.max(safeNumber(snapshot.layout?.branchSourceCoverInsetX, 1.5), 0);
    const branchTargetInsetX = safeNumber(snapshot.layout?.branchTargetCoverInsetX, 14);
    const deductionBranchModels = deductionSlices
      .map((slice, index) => {
        const box = deductionBoxes[index];
        if (!box) return null;
        const sourceSlice = deductionSourceSlices[index] || slice;
        const deductionSourceSlice = resolveDeductionTerminalSourceSlice(index, sourceSlice);
        const bridge = constantThicknessBridge(
          deductionSourceSlice,
          box.center,
          slice.item.name === "Other" ? 6 : 12,
          opDeductionSourceBand.top,
          opDeductionSourceBand.bottom
        );
        const sourceShift = editorOffsetForNode("operating");
        const targetFrame = editableNodeFrame(`deduction-${index}`, rightTerminalNodeX, bridge.targetTop, nodeWidth, bridge.targetHeight);
        const options = resolveAdaptiveNegativeTerminalBranchOptions(
          resolveDeductionTerminalBranchOptions(index),
          bridge.sourceTop + sourceShift.dy,
          bridge.sourceBottom + sourceShift.dy,
          targetFrame.y,
          targetFrame.height,
          {
            index,
            count: Math.max(deductionSlices.length + opexSlices.length, 1),
            laneBias: index === 0 ? 0.1 : 0.06,
          }
        );
        return {
          x0: operatingFrame.right - branchSourceInsetX,
          x1: targetFrame.x + safeNumber(options.targetCoverInsetX, branchTargetInsetX),
          sourceTop: bridge.sourceTop + sourceShift.dy,
          sourceBottom: bridge.sourceBottom + sourceShift.dy,
          targetTop: targetFrame.y,
          targetHeight: targetFrame.height,
          options,
        };
      })
      .filter(Boolean);
    const opexBranchModels = opexSlices
      .map((slice, index) => {
        const box = opexBoxes[index];
        const sourceSlice = opexSourceSlices[index] || slice;
        if (!box || !sourceSlice) return null;
        const bridge = constantThicknessBridge(sourceSlice, box.center, 14, opexTop, opexBottom);
        const targetFrame = editableNodeFrame(`opex-${index}`, rightTerminalNodeX, bridge.targetTop, nodeWidth, bridge.targetHeight);
        const options = resolveAdaptiveNegativeTerminalBranchOptions(
          standardTerminalBranchOptions,
          bridge.sourceTop + editorOffsetForNode("operating-expenses").dy,
          bridge.sourceBottom + editorOffsetForNode("operating-expenses").dy,
          targetFrame.y,
          targetFrame.height,
          {
            index,
            count: Math.max(opexSlices.length, 1),
            laneBias: 0.04,
          }
        );
        return {
          x0: operatingExpenseFrame.right - branchSourceInsetX,
          x1: targetFrame.x + safeNumber(options.targetCoverInsetX, branchTargetInsetX),
          sourceTop: bridge.sourceTop + editorOffsetForNode("operating-expenses").dy,
          sourceBottom: bridge.sourceBottom + editorOffsetForNode("operating-expenses").dy,
          targetTop: targetFrame.y,
          targetHeight: targetFrame.height,
          options,
        };
      })
      .filter(Boolean);
    const positiveRibbonTopAtX = (sampleX) => {
      let top = Infinity;
      [...deductionBranchModels, ...opexBranchModels].forEach((model) => {
        const envelope = flowEnvelopeAtX(
          sampleX,
          model.x0,
          model.sourceTop,
          model.sourceBottom,
          model.x1,
          model.targetTop,
          model.targetTop + model.targetHeight,
          model.options
        );
        if (envelope) {
          top = Math.min(top, envelope.top);
        }
      });
      return top;
    };
    const netMainRibbonBottomAtX = (sampleX) => {
      const envelope = shiftedMainNetRibbonEnvelopeAtX(sampleX);
      return envelope ? envelope.bottom : -Infinity;
    };
    const netMainRibbonTopAtX = (sampleX) => {
      const envelope = shiftedMainNetRibbonEnvelopeAtX(sampleX);
      return envelope ? envelope.top : Infinity;
    };
    const positiveTerminalObstacleReachX = Math.max(
      safeNumber(
        snapshot.layout?.positiveTerminalObstacleReachX,
        Math.max(
          positiveBranchRunwayX * safeNumber(snapshot.layout?.positiveTerminalObstacleReachFactor, 0.9),
          positiveAbove ? 68 : 56
        )
      ),
      24
    );
    let positiveTerminalNodeObstacles = [];
    let corridorSampleXs = [];
    let positiveTopMin = positiveTop;
    let positiveTopMax = positiveTop;
    if (positiveAdjustments.length) {
      const netShift = editorOffsetForNode("net");
      const positiveTargetStackCenter =
        positiveTargetBands.length
          ? (safeNumber(positiveTargetBands[0]?.top, netTop) + safeNumber(positiveTargetBands[positiveTargetBands.length - 1]?.bottom, netBottom)) / 2 + netShift.dy
          : (safeNumber(netPositiveTop, netTop) + safeNumber(netPositiveTop + totalPositiveHeight, netBottom)) / 2 + netShift.dy;
      const positiveTargetStackTop = positiveTargetBands.length
        ? safeNumber(positiveTargetBands[0]?.top, netTop) + netShift.dy
        : netPositiveTop + netShift.dy;
      const positiveTargetStackBottom = positiveTargetBands.length
        ? safeNumber(positiveTargetBands[positiveTargetBands.length - 1]?.bottom, netBottom) + netShift.dy
        : netPositiveTop + totalPositiveHeight + netShift.dy;
      positiveBranchClearanceY = Math.max(
        scaleY(safeNumber(snapshot.layout?.positiveBranchClearanceY, 16)),
        positiveReferenceHeight * safeNumber(snapshot.layout?.positiveBranchClearanceHeightFactor, 0.72)
      );
      positiveCapClearanceY = Math.max(
        scaleY(safeNumber(snapshot.layout?.positiveCapClearanceY, 12)),
        positiveReferenceHeight * safeNumber(snapshot.layout?.positiveCapClearanceHeightFactor, 0.52)
      );
      const positiveTerminalClearanceY = Math.max(
        scaleY(safeNumber(snapshot.layout?.positiveTerminalClearanceY, positiveAbove ? 24 : 20)),
        positiveCapClearanceY * safeNumber(snapshot.layout?.positiveTerminalClearanceCapFactor, positiveAbove ? 1.45 : 1.18)
      );
      const positiveTerminalCapClearanceY = Math.max(
        scaleY(safeNumber(snapshot.layout?.positiveTerminalCapObstacleClearanceY, positiveAbove ? 36 : 28)),
        positiveCapClearanceY * safeNumber(snapshot.layout?.positiveTerminalCapObstacleClearanceFactor, positiveAbove ? 2.25 : 1.65)
      );
      const positiveTerminalLabelObstacles = [...deductionBoxes, ...opexBoxes]
        .filter(Boolean)
        .map((box) => ({
          left: rightTerminalNodeX - positiveTerminalObstacleReachX,
          right: rightTerminalNodeX + nodeWidth,
          top: box.top - positiveTerminalClearanceY,
          bottom: box.bottom + positiveTerminalClearanceY,
        }));
      const positiveTerminalCapObstacles = [...deductionBranchModels, ...opexBranchModels]
        .map((model) => ({
          left: rightTerminalNodeX - positiveTerminalObstacleReachX,
          right: rightTerminalNodeX + nodeWidth,
          top: model.targetTop - positiveTerminalCapClearanceY,
          bottom: model.targetTop + model.targetHeight + positiveTerminalCapClearanceY,
        }));
      positiveTerminalNodeObstacles = [...positiveTerminalLabelObstacles, ...positiveTerminalCapObstacles];
      const positiveProminentMinRunwayX = positiveProminentAbove
        ? Math.max(
            safeNumber(snapshot.layout?.positiveProminentMinRunwayX, 96),
            totalPositiveStackHeight * safeNumber(snapshot.layout?.positiveProminentMinRunwayHeightFactor, 0.78)
          )
        : 0;
      const effectivePositiveNodeMaxX = positiveProminentAbove
        ? Math.min(positiveNodeMaxX, netX - positiveNodeWidth - positiveProminentMinRunwayX)
        : positiveNodeMaxX;
      const positiveNodeXCandidates = [
        effectivePositiveNodeMaxX,
        netX - positiveNodeWidth - Math.max(positiveBranchRunwayX * 0.36, positiveAbove ? 14 : 12),
        netX - positiveNodeWidth - Math.max(positiveBranchRunwayX * 0.58, positiveAbove ? 20 : 18),
        defaultPositiveNodeX,
        netX - positiveNodeWidth - Math.max(positiveBranchRunwayX * 0.82, positiveAbove ? 28 : 24),
        positiveNodeMinX,
        positiveNodeMinX + (effectivePositiveNodeMaxX - positiveNodeMinX) * 0.25,
        (positiveNodeMinX + effectivePositiveNodeMaxX) / 2,
        positiveNodeMinX + (effectivePositiveNodeMaxX - positiveNodeMinX) * 0.75,
      ]
        .map((value) => clamp(value, positiveNodeMinX, Math.max(effectivePositiveNodeMaxX, positiveNodeMinX)))
        .filter((value, index, values) => values.findIndex((candidate) => Math.abs(candidate - value) < 1) === index);
      let bestNodePlacement = null;
      positiveNodeXCandidates.forEach((candidateNodeX) => {
        const runwayDx = Math.max(netX - (candidateNodeX + positiveNodeWidth), 1);
        const corridorSampleXsCandidate = positiveCorridorSampleXsForNode(candidateNodeX);
        const preferredVisualGapY = Math.max(
          safeNumber(snapshot.layout?.positiveCorridorPreferredGapY, 22),
          positiveReferenceHeight * safeNumber(snapshot.layout?.positiveCorridorPreferredGapFactor, positiveAbove ? 0.78 : 0.92)
        );
        const preferredCorridorTop = positiveAbove
          ? positiveUpperObstacleBottomForXs(corridorSampleXsCandidate) + scaleY(safeNumber(snapshot.layout?.positiveAboveCorridorTopGapY, 12))
          : Math.max(upperMetricFloor, ...corridorSampleXsCandidate.map((sampleX) => netMainRibbonBottomAtX(sampleX))) +
            scaleY(safeNumber(snapshot.layout?.positiveCorridorTopGapY, 18));
        const preferredCorridorBottom = positiveAbove
          ? Math.min(...corridorSampleXsCandidate.map((sampleX) => netMainRibbonTopAtX(sampleX))) -
            scaleY(safeNumber(snapshot.layout?.positiveAboveCorridorBottomGapY, 14))
          : (() => {
              const lowerRibbonSamples = corridorSampleXsCandidate.map((sampleX) => positiveRibbonTopAtX(sampleX)).filter((value) => Number.isFinite(value));
              const lowerRibbonTop = lowerRibbonSamples.length ? Math.min(...lowerRibbonSamples) : chartBottomLimit;
              return lowerRibbonTop - scaleY(safeNumber(snapshot.layout?.positiveCorridorBottomGapY, 14));
            })();
        const hardCorridorTop = positiveAbove
          ? positiveUpperObstacleBottomForXs(corridorSampleXsCandidate) +
            scaleY(safeNumber(snapshot.layout?.positiveAboveHardCorridorTopGapY, 0))
          : Math.max(upperMetricFloor, ...corridorSampleXsCandidate.map((sampleX) => netMainRibbonBottomAtX(sampleX))) +
            scaleY(safeNumber(snapshot.layout?.positiveCorridorHardTopGapY, 0));
        const hardCorridorBottom = positiveAbove
          ? Math.min(...corridorSampleXsCandidate.map((sampleX) => netMainRibbonTopAtX(sampleX))) -
            scaleY(safeNumber(snapshot.layout?.positiveAboveHardCorridorBottomGapY, 6))
          : (() => {
              const lowerRibbonSamples = corridorSampleXsCandidate.map((sampleX) => positiveRibbonTopAtX(sampleX)).filter((value) => Number.isFinite(value));
              const lowerRibbonTop = lowerRibbonSamples.length ? Math.min(...lowerRibbonSamples) : chartBottomLimit;
              return lowerRibbonTop - scaleY(safeNumber(snapshot.layout?.positiveCorridorHardBottomGapY, 6));
            })();
        const desiredLiftY = Math.max(
          scaleY(safeNumber(snapshot.layout?.positiveBranchLiftY, 28)),
          preferredVisualGapY * safeNumber(snapshot.layout?.positiveBranchLiftGapFactor, positiveAbove ? 1.16 : 0.86),
          positiveReferenceHeight * safeNumber(snapshot.layout?.positiveBranchLiftHeightFactor, positiveAbove ? 1.08 : 0.92)
        );
        const netAffinityAdjustedLiftY = Math.max(
          scaleY(safeNumber(snapshot.layout?.positiveBranchLiftMinY, positiveAbove ? 18 : 16)),
          desiredLiftY * (positiveAbove ? 1 - positiveNetAffinityStrength * 0.44 : 1)
        );
        const desiredCenter = positiveAbove
          ? positiveTargetStackCenter - netAffinityAdjustedLiftY
          : positiveTargetStackCenter + netAffinityAdjustedLiftY;
        const positiveProminentMaxMergeDeltaY = positiveProminentAbove
          ? Math.max(
              scaleY(safeNumber(snapshot.layout?.positiveProminentMaxMergeDeltaY, 86)),
              totalPositiveStackHeight * safeNumber(snapshot.layout?.positiveProminentMaxMergeDeltaHeightFactor, 0.92),
              (positiveTargetStackBottom - positiveTargetStackTop) *
                safeNumber(snapshot.layout?.positiveProminentMaxMergeDeltaTargetFactor, 0.84)
            )
          : Infinity;
        const prominentTopFloor = positiveProminentAbove
          ? positiveTargetStackCenter - positiveProminentMaxMergeDeltaY - totalPositiveStackHeight / 2
          : -Infinity;
        const preferredTopMin = Math.max(preferredCorridorTop, prominentTopFloor);
        const preferredTopMax = Math.max(preferredCorridorBottom - totalPositiveStackHeight, preferredTopMin);
        const candidateTopMin = Math.max(hardCorridorTop, prominentTopFloor);
        const candidateTopMax = Math.max(hardCorridorBottom - totalPositiveStackHeight, candidateTopMin);
        const desiredTop = clamp(
          desiredCenter - totalPositiveStackHeight / 2,
          preferredTopMin <= preferredTopMax ? preferredTopMin : candidateTopMin,
          preferredTopMin <= preferredTopMax ? preferredTopMax : candidateTopMax
        );
        const positiveBandEnvelopeAtX = (sampleX, stackTop) => {
          const stackBottom = stackTop + totalPositiveStackHeight;
          if (sampleX <= candidateNodeX + positiveNodeWidth) {
            return {
              top: stackTop,
              bottom: stackBottom,
            };
          }
          return flowEnvelopeAtX(
            sampleX,
            candidateNodeX + positiveNodeWidth,
            stackTop,
            stackBottom,
            netX + positiveTargetInsetX,
            positiveTargetStackTop,
            positiveTargetStackBottom,
            positiveBranchPathOptions
          );
        };
        const positiveVerticalCandidateTops = [];
        const positiveSearchOffsets = positiveAbove
          ? [-1.8, -1.35, -1, -0.65, -0.3, 0, 0.3, 0.6, 0.9]
          : [-1.45, -1.05, -0.72, -0.4, -0.12, 0.12, 0.42, 0.78, 1.08, 1.36];
        positiveSearchOffsets.forEach((offsetNorm) => {
          const offsetY = offsetNorm * Math.max(
            scaleY(safeNumber(snapshot.layout?.positiveTopSearchSpanY, 26)),
            positiveReferenceHeight * safeNumber(snapshot.layout?.positiveTopSearchSpanHeightFactor, 0.9)
          );
          positiveVerticalCandidateTops.push(clamp(desiredTop + offsetY, candidateTopMin, candidateTopMax));
        });
        positiveVerticalCandidateTops.push(candidateTopMin, candidateTopMax, desiredTop);
        let bestVerticalPlacement = null;
        [...new Set(positiveVerticalCandidateTops.map((value) => Number(value.toFixed(2))))].forEach((candidateTop) => {
          const nodeRect = {
            left: candidateNodeX,
            right: candidateNodeX + positiveNodeWidth,
            top: candidateTop,
            bottom: candidateTop + totalPositiveStackHeight,
          };
          const evaluationXs = [
            candidateNodeX + positiveNodeWidth * 0.16,
            candidateNodeX + positiveNodeWidth * 0.5,
            candidateNodeX + positiveNodeWidth * 0.84,
            ...corridorSampleXsCandidate,
          ];
          let gapShortfall = 0;
          let minGap = Infinity;
          let capGapShortfall = 0;
          evaluationXs.forEach((sampleX, sampleIndex) => {
            const envelope = positiveBandEnvelopeAtX(sampleX, candidateTop);
            if (!envelope) return;
            const requiredGap = sampleIndex < 3 ? positiveCapClearanceY : positiveBranchClearanceY;
            const upperGap = positiveAbove
              ? envelope.top - positiveUpperObstacleBottomAtX(sampleX)
              : envelope.top - Math.max(upperMetricFloor, netMainRibbonBottomAtX(sampleX));
            const lowerObstacleTop = positiveAbove ? netMainRibbonTopAtX(sampleX) : positiveRibbonTopAtX(sampleX);
            const lowerGap = (Number.isFinite(lowerObstacleTop) ? lowerObstacleTop : chartBottomLimit) - envelope.bottom;
            const localMinGap = Math.min(upperGap, lowerGap);
            minGap = Math.min(minGap, localMinGap);
            gapShortfall += Math.max(requiredGap - upperGap, 0) * 1.2 + Math.max(requiredGap - lowerGap, 0) * 1.35;
            if (sampleIndex < 3) {
              const capRequiredGap = requiredGap * safeNumber(snapshot.layout?.positiveCapPreferredGapFactor, 1.18);
              capGapShortfall += Math.max(capRequiredGap - upperGap, 0) * 2.5 + Math.max(capRequiredGap - lowerGap, 0) * 2.3;
            }
          });
          const sourceCenter = candidateTop + totalPositiveStackHeight / 2;
          const branchDirectionDelta = positiveAbove
            ? positiveTargetStackCenter - sourceCenter
            : sourceCenter - positiveTargetStackCenter;
          const preferredDirectionDelta = Math.max(
            scaleY(safeNumber(snapshot.layout?.positiveBranchPreferredDeltaY, 30)),
            preferredVisualGapY * safeNumber(snapshot.layout?.positiveBranchPreferredDeltaGapFactor, positiveAbove ? 0.92 : 0.72),
            positiveReferenceHeight * safeNumber(snapshot.layout?.positiveBranchPreferredDeltaHeightFactor, positiveAbove ? 2.15 : 1.28)
          );
          const branchDirectionShortfall = Math.max(preferredDirectionDelta - branchDirectionDelta, 0);
          const excessiveBranchDirectionAllowance = preferredDirectionDelta * safeNumber(
            snapshot.layout?.positiveBranchExcessiveDeltaAllowanceFactor,
            positiveAbove ? 1.45 : 1.8
          );
          const branchDirectionExcess = Math.max(branchDirectionDelta - excessiveBranchDirectionAllowance, 0);
          const excessiveMergePenalty =
            positiveAbove && positiveNetAffinityStrength > 0
              ? branchDirectionExcess *
                safeNumber(
                  snapshot.layout?.positiveNetAffinityMergeDeltaPenaltyFactor,
                  4.6 + positiveNetAffinityStrength * 10
                )
              : 0;
          const targetDeviation = Math.abs(candidateTop - desiredTop);
          const preferredRunwayDxBase = clamp(
            Math.max(
              safeNumber(snapshot.layout?.positivePreferredRunwayX, positiveAbove ? 74 : 72),
              totalPositiveStackHeight * safeNumber(snapshot.layout?.positivePreferredRunwayHeightFactor, positiveAbove ? 2.25 : 2.1),
              preferredDirectionDelta * safeNumber(snapshot.layout?.positivePreferredRunwayDeltaFactor, positiveAbove ? 0.72 : 0.62)
            ),
            24,
            Math.max(netX - positiveNodeWidth - positiveNodeMinX, 24)
          );
          const preferredRunwayDx = clamp(
            preferredRunwayDxBase * (positiveAbove ? 1 - positiveNetAffinityStrength * 0.5 : 1),
            24,
            Math.max(netX - positiveNodeWidth - positiveNodeMinX, 24)
          );
          const preferredNodeX = clamp(
            netX - positiveNodeWidth - preferredRunwayDx,
            positiveNodeMinX,
            Math.max(positiveNodeMaxX, positiveNodeMinX)
          );
          const runwayShortfallPenalty =
            Math.max(preferredRunwayDx - runwayDx, 0) *
            safeNumber(snapshot.layout?.positiveRunwayShortfallPenaltyFactor, positiveAbove ? 7.4 : 4.2);
          const runwayExcessAllowanceFactor = safeNumber(
            snapshot.layout?.positiveRunwayExcessAllowanceFactor,
            positiveAbove ? Math.max(1.08, 1.22 - positiveNetAffinityStrength * 0.16) : 1.45
          );
          const runwayExcessPenaltyFactor = safeNumber(
            snapshot.layout?.positiveRunwayExcessPenaltyFactor,
            positiveAbove ? 0.8 + positiveNetAffinityStrength * 2.6 : 0.18
          );
          const runwayExcessPenalty =
            Math.max(runwayDx - preferredRunwayDx * runwayExcessAllowanceFactor, 0) * runwayExcessPenaltyFactor;
          const runwayDistancePenalty =
            positiveAbove && positiveNetAffinityStrength > 0
              ? runwayDx * safeNumber(snapshot.layout?.positiveNetAffinityRunwayPenaltyFactor, 0.04 + positiveNetAffinityStrength * 0.18)
              : 0;
          const nodeXDeviationPenalty =
            Math.abs(candidateNodeX - preferredNodeX) *
            safeNumber(snapshot.layout?.positiveNodeXDeviationPenaltyFactor, positiveAbove ? 0.42 : 0.24);
          let terminalObstacleHits = 0;
          let terminalObstacleOverlapDepth = 0;
          positiveTerminalNodeObstacles.forEach((obstacle) => {
            if (!rectsOverlap(nodeRect, obstacle)) return;
            terminalObstacleHits += 1;
            terminalObstacleOverlapDepth +=
              Math.max(Math.min(nodeRect.bottom, obstacle.bottom) - Math.max(nodeRect.top, obstacle.top), 0);
          });
          const score =
            gapShortfall * 100 +
            capGapShortfall * 126 +
            branchDirectionShortfall * 10.5 +
            branchDirectionExcess * safeNumber(snapshot.layout?.positiveBranchExcessPenaltyFactor, positiveAbove ? 3.1 : 1.6) +
            excessiveMergePenalty +
            targetDeviation * safeNumber(snapshot.layout?.positiveTargetDeviationPenaltyFactor, positiveAbove ? 0.72 : 0.26) +
            terminalObstacleHits * safeNumber(snapshot.layout?.positiveTerminalObstaclePenalty, 40000) +
            terminalObstacleOverlapDepth * safeNumber(snapshot.layout?.positiveTerminalObstacleDepthPenaltyFactor, 480) +
            runwayShortfallPenalty +
            runwayExcessPenalty +
            runwayDistancePenalty +
            nodeXDeviationPenalty -
            Math.max(minGap, 0) * 2.7;
          if (!bestVerticalPlacement || score < bestVerticalPlacement.score) {
            bestVerticalPlacement = {
              top: candidateTop,
              score,
              minGap,
            };
          }
        });
        if (!bestVerticalPlacement) return;
        if (!bestNodePlacement || bestVerticalPlacement.score < bestNodePlacement.score) {
          bestNodePlacement = {
            nodeX: candidateNodeX,
            top: bestVerticalPlacement.top,
            score: bestVerticalPlacement.score,
            minGap: bestVerticalPlacement.minGap,
            corridorSampleXs: corridorSampleXsCandidate,
            topMin: candidateTopMin,
            topMax: candidateTopMax,
          };
        }
      });
      if (bestNodePlacement) {
        const positiveAestheticNudgeStrength = clamp(
          safeNumber(
            snapshot.layout?.positiveAestheticNudgeStrength,
            positiveAbove ? positiveNetAffinityStrength + 0.12 : 0
          ),
          0,
          0.64
        );
        const positiveAestheticNudgeX =
          scaleY(safeNumber(snapshot.layout?.positiveAestheticNudgeX, positiveAbove ? 48 : 0)) * positiveAestheticNudgeStrength;
        const positiveAestheticNudgeY =
          scaleY(safeNumber(snapshot.layout?.positiveAestheticNudgeY, positiveAbove ? 40 : 0)) * positiveAestheticNudgeStrength;
        positiveNodeX = clamp(
          bestNodePlacement.nodeX + positiveAestheticNudgeX,
          positiveNodeMinX,
          Math.max(positiveNodeMaxX, positiveNodeMinX)
        );
        positiveTop = clamp(bestNodePlacement.top + positiveAestheticNudgeY, bestNodePlacement.topMin, bestNodePlacement.topMax);
        corridorSampleXs = positiveCorridorSampleXsForNode(positiveNodeX);
        positiveTopMin = bestNodePlacement.topMin;
        positiveTopMax = bestNodePlacement.topMax;
      }
    }
    const placedPositiveLabelRects = [];
    let netPositiveCursor = netPositiveTop;
    positiveAdjustments.forEach((item, index) => {
      const gainHeight = positiveHeights[index];
      const mergeHeight = positiveMergeHeights[index] ?? Math.max(safeNumber(item.valueBn) * scale, 0);
      const positiveNameSize = String(item.name || "").length > 14 ? 18 : 22;
      const positiveValueSize = String(item.name || "").length > 14 ? 18 : 20;
      const labelGapX = safeNumber(snapshot.layout?.positiveLabelGapX, 14);
      const twoLineGap = scaleY(safeNumber(snapshot.layout?.positiveLabelLineGapY, 8));
      const valueYOffset = scaleY(safeNumber(snapshot.layout?.positiveLabelValueOffsetY, 16));
      const labelTopGapY = positiveValueSize * 0.5;
      const positiveTargetBand = positiveTargetBands[index] || {
        top: clamp(netPositiveCursor, netTop, netBottom - gainHeight),
        bottom: clamp(netPositiveCursor + mergeHeight, netTop + mergeHeight, netBottom),
        height: mergeHeight,
      };
      const netShift = editorOffsetForNode("net");
      const adjustedTargetTop = Math.max(positiveTargetBand.top + netShift.dy - positiveMergeOverlapY, netFrame.top);
      const adjustedTargetHeight = Math.min(
        Math.max(safeNumber(positiveTargetBand.height, mergeHeight), 0) + positiveMergeOverlapY,
        netFrame.bottom - adjustedTargetTop
      );
      const labelValue = formatItemBillions(item, "positive-plus");
      const leftCorridor = positiveNodeX - (opX + nodeWidth);
      const labelNameWidth = approximateTextWidth(localizeChartPhrase(item.name), positiveNameSize);
      const labelValueWidth = approximateTextWidth(labelValue, positiveValueSize);
      const labelBlockWidth = Math.max(labelNameWidth, labelValueWidth, 1);
      const positiveLabelMinLeftPad = safeNumber(snapshot.layout?.positiveLabelMinLeftPadX, 10);
      const positiveLabelObstaclePadding = scaleY(safeNumber(snapshot.layout?.positiveLabelObstaclePadding, 6));
      const positiveLabelRibbonClearance = Math.max(
        positiveLabelObstaclePadding,
        scaleY(safeNumber(snapshot.layout?.positiveLabelRibbonClearanceY, 12))
      );
      const positiveLabelInterLabelPadding = Math.max(
        positiveLabelObstaclePadding,
        scaleY(safeNumber(snapshot.layout?.positiveLabelInterLabelPadding, 8))
      );
      const positiveLabelWidthPadding = Math.max(
        positiveLabelObstaclePadding,
        scaleY(safeNumber(snapshot.layout?.positiveLabelWidthPaddingX, 10))
      );
      const labelNameAscent = positiveNameSize * 0.9;
      const labelNameDescent = positiveNameSize * 0.34;
      const labelValueAscent = positiveValueSize * 0.9;
      const labelValueDescent = positiveValueSize * 0.36;
      const labelTopOffset = Math.min(-twoLineGap - labelNameAscent, valueYOffset - labelValueAscent) - positiveLabelObstaclePadding;
      const labelBottomOffset = Math.max(-twoLineGap + labelNameDescent, valueYOffset + labelValueDescent) + positiveLabelObstaclePadding;
      const labelBlockHeight = labelBottomOffset - labelTopOffset;
      const labelCenterBias = (labelTopOffset + labelBottomOffset) / 2;
      const positiveLabelOrderNorm = positiveAdjustments.length <= 1 ? 0.5 : index / Math.max(positiveAdjustments.length - 1, 1);
      const positiveLabelPreferredVerticalType =
        positiveAbove && positiveAdjustments.length > 1
          ? positiveLabelOrderNorm >= safeNumber(snapshot.layout?.positiveLabelPreferBelowFromOrderNorm, 0.5)
            ? "below"
            : "above"
          : null;
      const labelBoundsRect = (anchor, x, centerY) => {
        const left =
          anchor === "middle"
            ? x - labelBlockWidth / 2 - positiveLabelWidthPadding
            : anchor === "start"
              ? x - positiveLabelWidthPadding
              : x - labelBlockWidth - positiveLabelWidthPadding;
        const right =
          anchor === "middle"
            ? x + labelBlockWidth / 2 + positiveLabelWidthPadding
            : anchor === "start"
              ? x + labelBlockWidth + positiveLabelWidthPadding
              : x + positiveLabelWidthPadding;
        return {
          left,
          right,
          top: centerY + labelTopOffset,
          bottom: centerY + labelBottomOffset,
        };
      };
      const sourceTopSearchMin = clamp(
        positiveTopMin + positiveSourceDropY,
        scaleY(160),
        chartBottomLimit - gainHeight - scaleY(6)
      );
      const sourceTopSearchMax = clamp(
        positiveTopMax + positiveSourceDropY,
        sourceTopSearchMin,
        chartBottomLimit - gainHeight - scaleY(6)
      );
      const resolvePositivePlacement = (sourceTopCandidate) => {
        const positiveSourceTop = clamp(sourceTopCandidate, sourceTopSearchMin, sourceTopSearchMax);
        const positiveSourceBottom = positiveSourceTop + gainHeight;
        const positiveSourceCenter = positiveSourceTop + gainHeight / 2;
        const positiveTargetCenter = adjustedTargetTop + adjustedTargetHeight / 2;
        const positiveLocalUpperObstacleBottom = positiveAbove
          ? positiveUpperObstacleBottomAtX(positiveNodeX + positiveNodeWidth * 0.5)
          : Math.max(upperMetricFloor, netMainRibbonBottomAtX(positiveNodeX + positiveNodeWidth * 0.5));
        const availableAbove = positiveSourceTop - positiveLocalUpperObstacleBottom;
        const positiveLocalLowerObstacleTop = (() => {
          const sampleX = positiveNodeX + positiveNodeWidth * 0.5;
          if (positiveAbove) {
            const mainRibbonTop = netMainRibbonTopAtX(sampleX);
            return Number.isFinite(mainRibbonTop) ? mainRibbonTop : chartBottomLimit;
          }
          const lowerRibbonTop = positiveRibbonTopAtX(sampleX);
          return Number.isFinite(lowerRibbonTop) ? lowerRibbonTop : chartBottomLimit;
        })();
        const availableBelow = positiveLocalLowerObstacleTop - positiveSourceBottom;
        const abovePlacementBaseCenterY = positiveSourceTop - labelTopGapY - labelBottomOffset;
        const belowPlacementBaseCenterY = positiveSourceBottom + labelTopGapY - labelTopOffset;
        const sampleXsAcrossRect = (rect, count = 5) => {
          if (!rect) return [];
          const left = clamp(rect.left + 1, opX + nodeWidth + 1, netX + positiveTargetInsetX);
          const right = clamp(rect.right - 1, opX + nodeWidth + 1, netX + positiveTargetInsetX);
          if (right <= left) return [left];
          return Array.from({ length: count }, (_unused, index) =>
            clamp(left + ((right - left) * index) / Math.max(count - 1, 1), opX + nodeWidth + 1, netX + positiveTargetInsetX)
          ).filter((value, idx, arr) => Number.isFinite(value) && (idx === 0 || Math.abs(value - arr[idx - 1]) > 0.8));
        };
        const lowerObstacleTopForRect = (rect) => {
          const sampleXs = sampleXsAcrossRect(rect, 7);
          let top = Infinity;
          sampleXs.forEach((sampleX) => {
            const candidateTop = positiveAbove ? netMainRibbonTopAtX(sampleX) : positiveRibbonTopAtX(sampleX);
            if (Number.isFinite(candidateTop)) {
              top = Math.min(top, candidateTop);
            }
          });
          return top;
        };
        const upperObstacleBottomForRect = (rect) => {
          const sampleXs = sampleXsAcrossRect(rect, 7);
          let bottom = positiveAbove ? 0 : upperMetricFloor;
          sampleXs.forEach((sampleX) => {
            const mainBottom = positiveAbove ? positiveUpperObstacleBottomAtX(sampleX) : netMainRibbonBottomAtX(sampleX);
            if (Number.isFinite(mainBottom)) {
              bottom = Math.max(bottom, mainBottom);
            }
          });
          return bottom;
        };
        const labelRectIsValid = (rect) =>
          rect.left >= opX + nodeWidth + positiveLabelMinLeftPad &&
          rect.right <= width - 56 &&
          rect.top >= upperObstacleBottomForRect(rect) + scaleY(6) &&
          rect.bottom <= chartBottomLimit - scaleY(6);
        const positiveBranchEnvelopeAtX = (sampleX) =>
          flowEnvelopeAtX(
            sampleX,
            positiveNodeX + positiveNodeWidth,
            positiveSourceTop,
            positiveSourceBottom,
            netX + positiveTargetInsetX,
            adjustedTargetTop,
            adjustedTargetTop + adjustedTargetHeight,
            positiveBranchPathOptions
          );
        const branchClearanceScore = (() => {
          const sampleXs = [
            positiveNodeX + positiveNodeWidth * 0.12,
            positiveNodeX + positiveNodeWidth * 0.5,
            positiveNodeX + positiveNodeWidth * 0.88,
            ...corridorSampleXs,
          ];
          let penalty = 0;
          let minGap = Infinity;
          sampleXs.forEach((sampleX, sampleIndex) => {
            const envelope =
              sampleX <= positiveNodeX + positiveNodeWidth
                ? { top: positiveSourceTop, bottom: positiveSourceBottom }
                : positiveBranchEnvelopeAtX(sampleX);
            if (!envelope) return;
            const requiredGap =
              sampleIndex < 3
                ? positiveCapClearanceY * safeNumber(snapshot.layout?.positiveCapPreferredGapFactor, 1.18)
                : positiveBranchClearanceY;
            const upperGap = positiveAbove
              ? envelope.top - positiveUpperObstacleBottomAtX(sampleX)
              : envelope.top - Math.max(upperMetricFloor, netMainRibbonBottomAtX(sampleX));
            const lowerObstacleTop = positiveAbove ? netMainRibbonTopAtX(sampleX) : positiveRibbonTopAtX(sampleX);
            const lowerGap = (Number.isFinite(lowerObstacleTop) ? lowerObstacleTop : chartBottomLimit) - envelope.bottom;
            const localMinGap = Math.min(upperGap, lowerGap);
            minGap = Math.min(minGap, localMinGap);
            penalty += Math.max(requiredGap - upperGap, 0) * (sampleIndex < 3 ? 3.2 : 2.2);
            penalty += Math.max(requiredGap - lowerGap, 0) * (sampleIndex < 3 ? 3.4 : 2.4);
          });
          return {
            penalty,
            minGap,
          };
        })();
        const preferredMergeDeltaY = Math.max(
          scaleY(safeNumber(snapshot.layout?.positivePerItemPreferredMergeDeltaY, 26)),
          gainHeight * safeNumber(snapshot.layout?.positivePerItemPreferredMergeDeltaHeightFactor, 2),
          positiveReferenceHeight * safeNumber(snapshot.layout?.positivePerItemPreferredMergeDeltaReferenceFactor, 1.6)
        );
        const mergeDeltaY = positiveAbove
          ? positiveTargetCenter - positiveSourceCenter
          : positiveSourceCenter - positiveTargetCenter;
        const mergeDeltaShortfall = Math.max(preferredMergeDeltaY - mergeDeltaY, 0);
        const preferredMergeDeltaExcessAllowance = preferredMergeDeltaY * safeNumber(
          snapshot.layout?.positivePerItemMergeDeltaExcessAllowanceFactor,
          positiveAbove ? 1.08 : 1.36
        );
        const mergeDeltaExcess = Math.max(mergeDeltaY - preferredMergeDeltaExcessAllowance, 0);
        const mergeRunway = Math.max(netX - (positiveNodeX + positiveNodeWidth), 1);
        const evaluateLabelRibbonCollisions = (rect) => {
          const safeRectLeft = clamp(rect.left + 1, opX + nodeWidth + 1, netX + positiveTargetInsetX);
          const safeRectRight = clamp(rect.right - 1, opX + nodeWidth + 1, netX + positiveTargetInsetX);
          if (safeRectRight <= safeRectLeft) {
            return { hitCount: 0, overlapDepth: 0 };
          }
          const sampleCount = 11;
          const sampleXs = Array.from({ length: sampleCount }, (_unused, index) =>
            clamp(
              safeRectLeft + ((safeRectRight - safeRectLeft) * index) / Math.max(sampleCount - 1, 1),
              opX + nodeWidth + 1,
              netX + positiveTargetInsetX
            )
          ).filter((value, idx, arr) => Number.isFinite(value) && (idx === 0 || Math.abs(value - arr[idx - 1]) > 0.5));
          let hitCount = 0;
          let overlapDepth = 0;
          sampleXs.forEach((sampleX) => {
            const envelopes = [];
            const mainEnvelope = shiftedMainNetRibbonEnvelopeAtX(sampleX);
            if (mainEnvelope) envelopes.push(mainEnvelope);
            const positiveEnvelope = positiveBranchEnvelopeAtX(sampleX);
            if (positiveEnvelope) envelopes.push(positiveEnvelope);
            [...deductionBranchModels, ...opexBranchModels].forEach((model) => {
              const branchEnvelope = flowEnvelopeAtX(
                sampleX,
                model.x0,
                model.sourceTop,
                model.sourceBottom,
                model.x1,
                model.targetTop,
                model.targetTop + model.targetHeight,
                model.options
              );
              if (branchEnvelope) envelopes.push(branchEnvelope);
            });
            if (sampleX >= positiveNodeX && sampleX <= positiveNodeX + positiveNodeWidth) {
              envelopes.push({ top: positiveSourceTop, bottom: positiveSourceBottom });
            }
            let hasLocalHit = false;
            envelopes.forEach((envelope) => {
              const overlapTop = Math.max(rect.top, envelope.top - positiveLabelRibbonClearance);
              const overlapBottom = Math.min(rect.bottom, envelope.bottom + positiveLabelRibbonClearance);
              const overlap = overlapBottom - overlapTop;
              if (overlap > 0) {
                hasLocalHit = true;
                overlapDepth += overlap;
              }
            });
            if (hasLocalHit) hitCount += 1;
          });
          return { hitCount, overlapDepth };
        };
        const collisionPenalty = (rect) => {
          let penalty = 0;
          let obstacleHits = 0;
          let interLabelHits = 0;
          positiveLabelObstacles.forEach((obstacle) => {
            if (rectsOverlap(rect, obstacle, positiveLabelObstaclePadding)) {
              obstacleHits += 1;
              penalty += 12;
            }
          });
          placedPositiveLabelRects.forEach((placedRect) => {
            if (rectsOverlap(rect, placedRect, positiveLabelInterLabelPadding)) {
              interLabelHits += 1;
              penalty += safeNumber(snapshot.layout?.positiveLabelPlacedOverlapPenalty, 96);
            }
          });
          const ribbonCollision = evaluateLabelRibbonCollisions(rect);
          if (ribbonCollision.hitCount > 0) {
            penalty += ribbonCollision.hitCount * 24 + ribbonCollision.overlapDepth * 0.28;
          }
          return {
            penalty,
            obstacleHits,
            interLabelHits,
            ribbonHitCount: ribbonCollision.hitCount,
            ribbonOverlapDepth: ribbonCollision.overlapDepth,
            hardCollisionCount: obstacleHits + interLabelHits + ribbonCollision.hitCount,
          };
        };
        const associationAmbiguityPenalty = (candidate, rect) => {
          const verticalGapToBand = (box, bandTop, bandBottom) => {
            if (!Number.isFinite(bandTop) || !Number.isFinite(bandBottom)) return Infinity;
            if (box.bottom < bandTop) return bandTop - box.bottom;
            if (box.top > bandBottom) return box.top - bandBottom;
            return 0;
          };
          const ownGap = verticalGapToBand(rect, positiveSourceTop, positiveSourceBottom);
          const sampleXs = [
            rect.left + (rect.right - rect.left) * 0.2,
            rect.left + (rect.right - rect.left) * 0.5,
            rect.left + (rect.right - rect.left) * 0.8,
          ]
            .map((value) => clamp(value, opX + nodeWidth + 1, netX + positiveTargetInsetX))
            .filter((value, index, values) => Number.isFinite(value) && (index === 0 || Math.abs(value - values[index - 1]) > 0.8));
          let hardAmbiguityCount = 0;
          let proximityPenalty = 0;
          let minNearestCompetingGap = Infinity;
          sampleXs.forEach((sampleX) => {
            const competingGaps = [];
            const mainEnvelope = shiftedMainNetRibbonEnvelopeAtX(sampleX);
            if (mainEnvelope) {
              competingGaps.push(verticalGapToBand(rect, mainEnvelope.top, mainEnvelope.bottom));
            }
            [...deductionBranchModels, ...opexBranchModels].forEach((model) => {
              const envelope = flowEnvelopeAtX(
                sampleX,
                model.x0,
                model.sourceTop,
                model.sourceBottom,
                model.x1,
                model.targetTop,
                model.targetTop + model.targetHeight,
                model.options
              );
              if (envelope) {
                competingGaps.push(verticalGapToBand(rect, envelope.top, envelope.bottom));
              }
            });
            const nearestCompetingGap = competingGaps.length ? Math.min(...competingGaps) : Infinity;
            if (nearestCompetingGap < minNearestCompetingGap) minNearestCompetingGap = nearestCompetingGap;
            if (Number.isFinite(nearestCompetingGap)) {
              const associationSafeMargin = scaleY(safeNumber(snapshot.layout?.positiveLabelAssociationSafeMarginY, 8));
              if (ownGap > nearestCompetingGap + associationSafeMargin) {
                hardAmbiguityCount += 1;
                proximityPenalty += (ownGap - nearestCompetingGap) * 1.15;
              } else if (nearestCompetingGap < scaleY(16)) {
                proximityPenalty += (scaleY(16) - nearestCompetingGap) * 0.9;
              }
            }
          });
          if (Number.isFinite(minNearestCompetingGap)) {
            const associationSafeMargin = scaleY(safeNumber(snapshot.layout?.positiveLabelAssociationSafeMarginY, 8));
            const contrastShortfall = ownGap + associationSafeMargin - minNearestCompetingGap;
            if (contrastShortfall > 0) {
              proximityPenalty += contrastShortfall * safeNumber(snapshot.layout?.positiveLabelAssociationContrastPenaltyFactor, 7.2);
              if (contrastShortfall > scaleY(6)) {
                hardAmbiguityCount += 1;
              }
            }
          }
          const sourceAssociationCenterY = positiveSourceTop + gainHeight / 2 - labelCenterBias;
          const labelAssociationCenterY = (rect.top + rect.bottom) / 2;
          const associationDistance = Math.abs(labelAssociationCenterY - sourceAssociationCenterY);
          const hardAssociationDistanceThreshold = Math.max(
            scaleY(safeNumber(snapshot.layout?.positiveLabelHardAssociationDistanceY, 88)),
            labelBlockHeight + scaleY(16)
          );
          if (associationDistance > hardAssociationDistanceThreshold) {
            hardAmbiguityCount += 1;
            proximityPenalty += (associationDistance - hardAssociationDistanceThreshold) * 1.6;
          }
          const directionalPenalty =
            candidate.type === "below"
              ? safeNumber(snapshot.layout?.positiveLabelBelowDirectionalPenalty, 0.7)
              : candidate.type === "above"
                ? safeNumber(snapshot.layout?.positiveLabelAboveDirectionalPenalty, 0.7)
                : safeNumber(snapshot.layout?.positiveLabelLeftDirectionalPenalty, 2.4);
          const placementOrderPenalty = (() => {
            if (!(positiveAbove && positiveAdjustments.length > 1 && positiveLabelPreferredVerticalType)) return 0;
            if (candidate.type === "left") {
              return safeNumber(snapshot.layout?.positiveLabelMultiSplitLeftPenalty, 9);
            }
            return candidate.type === positiveLabelPreferredVerticalType
              ? 0
              : safeNumber(snapshot.layout?.positiveLabelWrongSplitSidePenalty, 18);
          })();
          const penalty =
            hardAmbiguityCount * safeNumber(snapshot.layout?.positiveLabelHardAmbiguityPenalty, 260) +
            proximityPenalty +
            associationDistance * safeNumber(snapshot.layout?.positiveLabelAssociationDistancePenaltyFactor, 0.1) +
            directionalPenalty +
            placementOrderPenalty;
          return {
            penalty,
            hardAmbiguityCount,
          };
        };
        const positiveNodeCenterX = positiveNodeX + positiveNodeWidth / 2;
        const positiveLabelFollowMinX = opX + nodeWidth + positiveLabelMinLeftPad + positiveLabelWidthPadding;
        const positiveLabelFollowMaxX = width - 56 - labelBlockWidth - positiveLabelWidthPadding;
        const positiveLabelBranchFollowForwardX = clamp(
          positiveNodeX +
            positiveNodeWidth +
            scaleY(safeNumber(snapshot.layout?.positiveLabelBranchFollowOffsetX, 18)),
          positiveLabelFollowMinX,
          Math.max(positiveLabelFollowMinX, positiveLabelFollowMaxX)
        );
        const positiveLabelBacktrackMinX =
          opX + nodeWidth + positiveLabelMinLeftPad + labelBlockWidth + positiveLabelWidthPadding;
        const positiveLabelBranchFollowBacktrackX = clamp(
          positiveNodeX - scaleY(safeNumber(snapshot.layout?.positiveLabelBranchBacktrackOffsetX, 18)),
          positiveLabelBacktrackMinX,
          width - 56 - positiveLabelWidthPadding
        );
        const positiveLabelCandidatePriority = (type, variant = null) => {
          if (type === "left") {
            return leftCorridor >= labelBlockWidth + safeNumber(snapshot.layout?.positiveLabelMinCorridorX, 72) ? 1.2 : 3.2;
          }
          let priority = type === "above" ? 0 : 0.1;
          if (positiveLabelPreferredVerticalType) {
            priority +=
              type === positiveLabelPreferredVerticalType
                ? safeNumber(snapshot.layout?.positiveLabelPreferredPlacementBonus, -0.18)
                : safeNumber(snapshot.layout?.positiveLabelAlternatePlacementPenalty, 0.32);
          }
          if (variant === "branch-follow") {
            priority += safeNumber(snapshot.layout?.positiveLabelBranchFollowPriorityOffset, 0.06);
          }
          return priority;
        };
        const candidatePlacements = [
          {
            priority: positiveLabelCandidatePriority("above"),
            type: "above",
            anchor: "middle",
            x: positiveNodeCenterX,
            centerY: abovePlacementBaseCenterY,
          },
          {
            priority: positiveLabelCandidatePriority("below"),
            type: "below",
            anchor: "middle",
            x: positiveNodeCenterX,
            centerY: belowPlacementBaseCenterY,
          },
          ...(positiveLabelPreferredVerticalType && positiveLabelFollowMaxX > positiveLabelFollowMinX + 2
            ? [
                {
                  priority: positiveLabelCandidatePriority(positiveLabelPreferredVerticalType, "branch-follow"),
                  type: positiveLabelPreferredVerticalType,
                  anchor: positiveLabelPreferredVerticalType === "below" ? "end" : "start",
                  x:
                    positiveLabelPreferredVerticalType === "below"
                      ? positiveLabelBranchFollowBacktrackX
                      : positiveLabelBranchFollowForwardX,
                  centerY: positiveLabelPreferredVerticalType === "above" ? abovePlacementBaseCenterY : belowPlacementBaseCenterY,
                  variant: "branch-follow",
                },
              ]
            : []),
          {
            priority: positiveLabelCandidatePriority("left"),
            type: "left",
            anchor: "end",
            x: positiveNodeX - labelGapX,
            centerY: positiveSourceTop + gainHeight / 2 - labelCenterBias,
          },
        ];
        const comparePlacement = (placement, baseline) => {
          if (!baseline) return true;
          if (placement.hardViolationCount !== baseline.hardViolationCount) {
            return placement.hardViolationCount < baseline.hardViolationCount;
          }
          if (placement.hardAmbiguityCount !== baseline.hardAmbiguityCount) {
            return placement.hardAmbiguityCount < baseline.hardAmbiguityCount;
          }
          const placementConflictPenalty = placement.collisionPenalty + placement.ambiguityPenalty;
          const baselineConflictPenalty = baseline.collisionPenalty + baseline.ambiguityPenalty;
          if (Math.abs(placementConflictPenalty - baselineConflictPenalty) > 0.001) {
            return placementConflictPenalty < baselineConflictPenalty;
          }
          return placement.score < baseline.score;
        };
        const evaluatePlacement = (candidate) => {
          const baseRect = labelBoundsRect(candidate.anchor, candidate.x, candidate.centerY);
          const effectiveRibbonClearance =
            candidate.variant === "branch-follow" &&
            candidate.type === "below" &&
            positiveAbove &&
            positiveAdjustments.length > 1
              ? positiveLabelRibbonClearance * safeNumber(snapshot.layout?.positiveLabelBelowSplitClearanceFactor, 0.45)
              : positiveLabelRibbonClearance;
          const hardUpperBoundary = upperObstacleBottomForRect(baseRect) + effectiveRibbonClearance;
          const hardLowerBoundaryTop = lowerObstacleTopForRect(baseRect);
          const minCenterY = hardUpperBoundary - labelTopOffset;
          const maxCenterY = Number.isFinite(hardLowerBoundaryTop)
            ? hardLowerBoundaryTop - effectiveRibbonClearance - labelBottomOffset
            : chartBottomLimit - scaleY(6) - labelBottomOffset;
          if (!(maxCenterY >= minCenterY)) return null;
          const resolvedCenterY = clamp(candidate.centerY, minCenterY, maxCenterY);
          const rect = labelBoundsRect(candidate.anchor, candidate.x, resolvedCenterY);
          if (!labelRectIsValid(rect)) return null;
          if (rect.top < hardUpperBoundary) return null;
          if (Number.isFinite(hardLowerBoundaryTop) && rect.bottom > hardLowerBoundaryTop - effectiveRibbonClearance) return null;
          const collision = collisionPenalty(rect);
          const ambiguity = associationAmbiguityPenalty(candidate, rect);
          const requiredVerticalSpace = labelBlockHeight + labelTopGapY + scaleY(4);
          const verticalAvailabilityPenalty =
            candidate.type === "above"
              ? Math.max(requiredVerticalSpace - availableAbove, 0) * 0.42
              : candidate.type === "below"
                ? Math.max(requiredVerticalSpace - availableBelow, 0) * 0.42
                : 0;
          const sourceMovePenalty = Math.abs(positiveSourceTop - (positiveTop + positiveSourceDropY)) * 0.06;
          const leftPlacementPenalty =
            candidate.type === "left"
              ? 0.9 +
                Math.max(
                  mergeRunway - scaleY(safeNumber(snapshot.layout?.positiveLabelPreferredLeftRunwayX, 46)),
                  0
                ) *
                  safeNumber(snapshot.layout?.positiveLabelLeftRunwayPenaltyFactor, 0.03)
              : 0;
          const score =
            candidate.priority +
            collision.penalty +
            ambiguity.penalty +
            branchClearanceScore.penalty * 0.32 +
            mergeDeltaShortfall * 0.42 +
            mergeRunway * 0.022 +
            verticalAvailabilityPenalty +
            leftPlacementPenalty +
            Math.abs(resolvedCenterY - candidate.centerY) * safeNumber(snapshot.layout?.positiveLabelCenterAdjustmentPenaltyFactor, 0.22) +
            sourceMovePenalty -
            Math.max(branchClearanceScore.minGap, 0) * 0.08;
          const hardViolationCount = collision.hardCollisionCount + ambiguity.hardAmbiguityCount;
          return {
            ...candidate,
            centerY: resolvedCenterY,
            rect,
            score,
            collisionPenalty: collision.penalty,
            ambiguityPenalty: ambiguity.penalty,
            hardAmbiguityCount: ambiguity.hardAmbiguityCount,
            hardViolationCount,
            hardCollisionCount: collision.hardCollisionCount,
            collisionFree: hardViolationCount === 0,
          };
        };
        let bestPlacement = null;
        candidatePlacements.forEach((candidate) => {
          const placement = evaluatePlacement(candidate);
          if (!placement) return;
          if (comparePlacement(placement, bestPlacement)) bestPlacement = placement;
        });
        if (positiveAbove && positiveAdjustments.length === 2) {
          const forcedNodeCenteredCandidate =
            index === 0
              ? {
                  priority: -0.6,
                  type: "above",
                  anchor: "middle",
                  x: positiveNodeCenterX,
                  centerY: abovePlacementBaseCenterY,
                  variant: "node-centered",
                }
              : {
                  priority: -0.6,
                  type: "below",
                  anchor: "middle",
                  x: positiveNodeCenterX,
                  centerY: belowPlacementBaseCenterY,
                  variant: "node-centered",
                };
          const forcedNodeCenteredPlacement = evaluatePlacement(forcedNodeCenteredCandidate);
          if (
            forcedNodeCenteredPlacement &&
            (!bestPlacement ||
              forcedNodeCenteredPlacement.hardViolationCount === 0 ||
              bestPlacement.hardViolationCount > 0 ||
              bestPlacement.type !== forcedNodeCenteredCandidate.type ||
              bestPlacement.anchor !== "middle")
          ) {
            bestPlacement = forcedNodeCenteredPlacement;
          } else if (!forcedNodeCenteredPlacement) {
            const fallbackCenterY =
              index === 0
                ? clamp(
                    positiveSourceTop -
                      Math.max(
                        labelBlockHeight * safeNumber(snapshot.layout?.positiveLabelSplitFallbackOffsetFactor, 0.58),
                        scaleY(34)
                      ),
                    upperMetricFloor + scaleY(12) - labelTopOffset,
                    positiveSourceTop - scaleY(8) - labelBottomOffset
                  )
                : clamp(
                    positiveSourceBottom +
                      Math.max(
                        labelBlockHeight * safeNumber(snapshot.layout?.positiveLabelSplitFallbackOffsetFactor, 0.58),
                        scaleY(34)
                      ),
                    positiveSourceBottom + scaleY(10) - labelTopOffset,
                    chartBottomLimit - scaleY(6) - labelBottomOffset
                  );
            bestPlacement = {
              ...(bestPlacement || {}),
              type: forcedNodeCenteredCandidate.type,
              anchor: "middle",
              x: positiveNodeCenterX,
              centerY: fallbackCenterY,
            };
          }
        }
        if (!bestPlacement) {
          const fallbackCandidates = [
            {
              type: "above",
              anchor: "middle",
              x: positiveNodeCenterX,
              centerY: abovePlacementBaseCenterY,
            },
            {
              type: "below",
              anchor: "middle",
              x: positiveNodeCenterX,
              centerY: belowPlacementBaseCenterY,
            },
            {
              type: "left",
              anchor: "end",
              x: positiveNodeX - labelGapX - 24,
              centerY: positiveSourceTop + gainHeight / 2 - labelCenterBias,
            },
          ];
          const resolvedFallback = fallbackCandidates
            .map((candidate) => {
              const rect = labelBoundsRect(candidate.anchor, candidate.x, candidate.centerY);
              if (!labelRectIsValid(rect)) return null;
              const hardUpperBoundary = upperObstacleBottomForRect(rect) + positiveLabelRibbonClearance;
              if (rect.top < hardUpperBoundary) return null;
              const hardLowerBoundaryTop = lowerObstacleTopForRect(rect);
              if (Number.isFinite(hardLowerBoundaryTop) && rect.bottom > hardLowerBoundaryTop - positiveLabelRibbonClearance) return null;
              return {
                ...candidate,
                rect,
              };
            })
            .find(Boolean);
          const fallbackPlacement = resolvedFallback || {
            type: "above",
            anchor: "middle",
            x: positiveNodeCenterX,
            centerY: abovePlacementBaseCenterY,
            rect: labelBoundsRect("middle", positiveNodeCenterX, abovePlacementBaseCenterY),
          };
          bestPlacement = {
            ...fallbackPlacement,
            score: 9_999_999,
            collisionPenalty: 0,
            ambiguityPenalty: 0,
            hardAmbiguityCount: 0,
            hardViolationCount: 0,
            hardCollisionCount: 0,
            collisionFree: true,
          };
        }
        return {
          sourceTop: positiveSourceTop,
          sourceBottom: positiveSourceBottom,
          branchPenalty: branchClearanceScore.penalty,
          branchMinGap: branchClearanceScore.minGap,
          mergeDeltaShortfall,
          mergeDeltaY,
          placement: bestPlacement,
        };
      };
      const lockedSourceTop = clamp(positiveTop + positiveSourceDropY, sourceTopSearchMin, sourceTopSearchMax);
      const chosenLayout = resolvePositivePlacement(lockedSourceTop);
      const finalSourceTop = chosenLayout?.sourceTop ?? lockedSourceTop;
      const finalSourceBottom = chosenLayout?.sourceBottom ?? finalSourceTop + gainHeight;
      const chosenPlacement = chosenLayout?.placement || {
        anchor: "middle",
        x: positiveNodeX + positiveNodeWidth / 2,
        centerY: finalSourceTop - labelTopGapY - labelBottomOffset,
      };
      const positiveNodeId = `positive-${index}`;
      const positiveFrame = editableNodeFrame(positiveNodeId, positiveNodeX, finalSourceTop, positiveNodeWidth, gainHeight);
      const positiveShift = editorOffsetForNode(positiveNodeId);
      positiveMarkup += `<path d="${flowPath(
        positiveFrame.right,
        positiveFrame.top,
        positiveFrame.bottom,
        netFrame.x + positiveTargetInsetX,
        adjustedTargetTop,
        adjustedTargetTop + adjustedTargetHeight,
        positiveBranchPathOptions
      )}" fill="${greenFlow}" opacity="0.97"></path>`;
      positiveMarkup += renderEditableNodeRect(positiveFrame, greenNode);
      const labelAnchor = chosenPlacement.anchor;
      const labelX = chosenPlacement.x + positiveShift.dx;
      const labelCenterY = chosenPlacement.centerY + positiveShift.dy;
      const chosenLabelRect = labelBoundsRect(labelAnchor, labelX, labelCenterY);
      placedPositiveLabelRects.push(chosenLabelRect);
      positiveMarkup += `<text x="${labelX}" y="${labelCenterY - twoLineGap}" text-anchor="${labelAnchor}" font-size="${positiveNameSize}" font-weight="700" fill="${greenText}" paint-order="stroke fill" stroke="${background}" stroke-width="7" stroke-linejoin="round">${escapeHtml(localizeChartPhrase(item.name))}</text>`;
      positiveMarkup += `<text x="${labelX}" y="${labelCenterY + valueYOffset}" text-anchor="${labelAnchor}" font-size="${positiveValueSize}" font-weight="700" fill="${greenText}" paint-order="stroke fill" stroke="${background}" stroke-width="6" stroke-linejoin="round">${escapeHtml(labelValue)}</text>`;
      positiveTop = finalSourceTop + gainHeight + positiveGap;
      netPositiveCursor += mergeHeight;
    });
  }

  if (coreNetHeight > 0 && coreNetTargetHeight > 0) {
    svg += `<path d="${netBridgePath(
      operatingFrame.right,
      opNetBand.top,
      opNetBand.bottom,
      netFrame.x,
      netDisplayBand.top,
      netDisplayBand.bottom
    )}" fill="${netLoss ? redFlow : greenFlow}" opacity="0.97"></path>`;
  }
  svg += positiveMarkup;
  svg += `
      ${renderEditableNodeRect(netFrame, netLoss ? redNode : greenNode)}
      ${renderRightSummaryLabel(netSummaryLines, netFrame.x + nodeWidth + rightPrimaryLabelGapX, netFrame.centerY)}
  `;

  deductionSlices.forEach((slice, index) => {
    const box = deductionBoxes[index];
    const sourceSlice = deductionSourceSlices[index] || slice;
    const deductionSourceSlice = resolveDeductionTerminalSourceSlice(index, sourceSlice);
    const bridge = constantThicknessBridge(
      deductionSourceSlice,
      box.center,
      slice.item.name === "Other" ? 6 : 12,
      opDeductionSourceBand.top,
      opDeductionSourceBand.bottom
    );
    const deductionFrame = editableNodeFrame(`deduction-${index}`, rightTerminalNodeX, bridge.targetTop, nodeWidth, bridge.targetHeight);
    const operatingShift = editorOffsetForNode("operating");
    const deductionBranchOptions = resolveAdaptiveNegativeTerminalBranchOptions(
      resolveDeductionTerminalBranchOptions(index),
      bridge.sourceTop + operatingShift.dy,
      bridge.sourceBottom + operatingShift.dy,
      deductionFrame.y,
      deductionFrame.height,
      {
        index,
        count: Math.max(deductionSlices.length + opexSlices.length, 1),
        laneBias: index === 0 ? 0.1 : 0.06,
      }
    );
    svg += renderTerminalCapRibbon({
      sourceX: operatingFrame.right,
      sourceTop: bridge.sourceTop + operatingShift.dy,
      sourceBottom: bridge.sourceBottom + operatingShift.dy,
      capX: deductionFrame.x,
      capWidth: nodeWidth,
      targetTop: deductionFrame.y,
      targetHeight: deductionFrame.height,
      flowColor: redFlow,
      capColor: redNode,
      branchOptions: deductionBranchOptions,
    });
    svg += renderEditableNodeRect(deductionFrame, redNode);
    svg += renderRightBranchLabel(slice.item, box, deductionFrame.x, nodeWidth, redText, {
      density: deductionSlices.length >= 3 ? "dense" : "regular",
      defaultMode: "negative-parentheses",
      labelCenterY: deductionFrame.centerY,
    });
  });
  const costBreakdownBlocks = costBreakdownSlices.map((slice, index) => {
    const box = costBreakdownBoxes[index];
    const sourceSlice = costBreakdownSourceSlices[index] || slice;
    const bridge = constantThicknessBridge(sourceSlice, box.center, 10, costTop, costBottom);
    return {
      ...sourceSlice,
      box,
      bridge,
    };
  });
  if (costBreakdownBlocks.length === 2 && costBreakdownBlocks.every(Boolean)) {
    svg += renderSharedTrunkCostBreakdownPair(costBreakdownBlocks[0], costBreakdownBlocks[1]);
  } else {
    costBreakdownBlocks.forEach((block, index) => {
      svg += renderCostBreakdownBlock(block, block.bridge.targetTop, block.bridge.targetHeight, index);
    });
  }
  opexSlices.forEach((slice, index) => {
    const box = opexBoxes[index];
    const sourceSlice = opexSourceSlices[index] || slice;
    const bridge = constantThicknessBridge(sourceSlice, box.center, 14, opexTop, opexBottom);
    svg += renderRightExpenseBlock(
      opexTargetX,
      nodeWidth,
      {
        ...sourceSlice,
        box,
        bridge,
      },
      bridge.targetTop,
      bridge.targetHeight,
      opexLabelX,
      redFlow,
      index
    );
  });

  svg += renderOperatingProfitBreakdownCallout();

  svg += `
    ${revenueLabelMarkup}
    ${renderOpexSummaryMarkup()}
    ${renderReplicaFooter(snapshot)}
  `;

  svg += `</g></svg>`;
  return svg;
}

function companyDisplay(company) {
  const nameZh = String(company?.nameZh || company?.nameEn || company?.ticker || "Unknown");
  const nameEn = String(company?.nameEn || company?.nameZh || company?.ticker || "Unknown");
  return `${nameZh} / ${nameEn}`;
}

function renderCompanyList() {
  if (!refs.companyList) return;
  const search = refs.companySearch?.value?.trim()?.toLowerCase() || "";
  const filtered = companies().filter((company) => !search || companySearchValue(company).includes(search));
  state.filteredCompanyIds = filtered.map((company) => company.id);
  refs.companyList.innerHTML = filtered
    .map((company) => {
      const active = company.id === state.selectedCompanyId;
      const adr = company.isAdr ? `<span class="mini-badge">ADR</span>` : "";
      return `
        <button class="company-card ${active ? "is-active" : ""}" type="button" data-company-id="${company.id}">
          <div class="company-topline">
            <span>#${company.rank} · ${escapeHtml(company.ticker)}</span>
          </div>
          <div class="company-title">${escapeHtml(companyDisplay(company))}</div>
          <div class="company-subtitle">${escapeHtml(company.nameEn || company.nameZh || company.ticker)}</div>
          <div class="company-badges">
            ${adr}
            <span class="mini-badge">${company.coverage?.quarterCount || 0} 个季度</span>
          </div>
        </button>
      `;
    })
    .join("");
  syncActiveCompanyCard();
}

function syncActiveCompanyCard() {
  if (!refs.companyList) return;
  refs.companyList.querySelectorAll("[data-company-id]").forEach((node) => {
    const isActive = node.getAttribute("data-company-id") === state.selectedCompanyId;
    node.classList.toggle("is-active", isActive);
  });
}

function requestRenderCurrent() {
  if (state.pendingRenderFrame && typeof cancelAnimationFrame === "function") {
    cancelAnimationFrame(state.pendingRenderFrame);
  }
  const execute = () => {
    state.pendingRenderFrame = 0;
    renderCurrent();
  };
  if (typeof requestAnimationFrame === "function") {
    state.pendingRenderFrame = requestAnimationFrame(execute);
  } else {
    execute();
  }
}

function selectCompany(companyId, { preferReplica = false, rerenderList = false } = {}) {
  const company = getCompany(companyId);
  if (!company) return;
  state.selectedCompanyId = companyId;
  syncQuarterOptions({ preferReplica });
  if (rerenderList) {
    renderCompanyList();
  } else {
    syncActiveCompanyCard();
  }
  renderCoverage();
  setStatus(`正在生成 ${company.nameEn} 图像...`);
  requestRenderCurrent();
}

function quarterOptionLabel(company, quarterKey) {
  const entry = company?.financials?.[quarterKey];
  if (!entry) return quarterKey;
  const end = entry.periodEnd || "-";
  const fiscal = entry.fiscalLabel || "";
  return `${quarterKey} · ${fiscal} · ${end}`;
}

function isRenderableBridgeEntry(entry) {
  if (!entry) return false;
  const revenueBn = safeNumber(entry.revenueBn, null);
  if (!(revenueBn > 0.05)) return false;
  return (
    (entry.grossProfitBn !== null && entry.grossProfitBn !== undefined) ||
    (entry.costOfRevenueBn !== null && entry.costOfRevenueBn !== undefined) ||
    (entry.operatingIncomeBn !== null && entry.operatingIncomeBn !== undefined) ||
    (entry.netIncomeBn !== null && entry.netIncomeBn !== undefined) ||
    (entry.taxBn !== null && entry.taxBn !== undefined)
  );
}

function renderableQuarterKeys(company) {
  if (!company) return [];
  const quarterKeys = Array.isArray(company.quarters) ? company.quarters : [];
  const presetKeys = new Set(Object.keys(company.statementPresets || {}));
  const validQuarterKeys = quarterKeys.filter((quarterKey) => {
    if (presetKeys.has(quarterKey)) return true;
    return isRenderableBridgeEntry(company.financials?.[quarterKey]);
  });
  return validQuarterKeys.length ? validQuarterKeys : quarterKeys;
}

function preferredQuarter(company, preferReplica) {
  const presetQuarters = Object.keys(company.statementPresets || {}).sort((left, right) => quarterSortValue(right) - quarterSortValue(left));
  if (preferReplica && presetQuarters.length) return presetQuarters[0];
  const availableQuarters = renderableQuarterKeys(company);
  if (state.selectedQuarter && availableQuarters.includes(state.selectedQuarter)) return state.selectedQuarter;
  return availableQuarters[availableQuarters.length - 1] || presetQuarters[0] || null;
}

function resolveDefaultLandingCompany() {
  const rankedCompanies = companies()
    .filter((company) => renderableQuarterKeys(company).length)
    .slice()
    .sort((left, right) => {
      const rankGap = safeNumber(left?.rank, Infinity) - safeNumber(right?.rank, Infinity);
      if (rankGap !== 0) return rankGap;
      return String(left?.ticker || "").localeCompare(String(right?.ticker || ""));
    });
  return rankedCompanies[0] || companies()[0] || null;
}

function initializeDefaultLandingSelection() {
  const company = resolveDefaultLandingCompany();
  if (!company) return;
  state.selectedCompanyId = company.id;
  state.selectedQuarter = null;
  state.chartViewMode = "sankey";
}

function syncQuarterOptions({ preferReplica } = { preferReplica: false }) {
  const company = getCompany(state.selectedCompanyId);
  if (!company || !refs.quarterSelect) return;
  const nextQuarter = preferredQuarter(company, preferReplica);
  state.selectedQuarter = nextQuarter;
  refs.quarterSelect.innerHTML = renderableQuarterKeys(company)
    .slice()
    .sort((left, right) => quarterSortValue(right) - quarterSortValue(left))
    .map((quarterKey) => `<option value="${quarterKey}" ${quarterKey === nextQuarter ? "selected" : ""}>${escapeHtml(quarterOptionLabel(company, quarterKey))}</option>`)
    .join("");
}

function summarizeCoverage(company, snapshot) {
  return "当前季度使用结构原型生成";
}

function resolveNormalizedOperatingStage(entry, grossProfitBn, costOfRevenueBn, operatingProfitBnBase) {
  const sourceOperatingExpensesBn =
    entry?.operatingExpensesBn !== null && entry?.operatingExpensesBn !== undefined ? Math.max(safeNumber(entry.operatingExpensesBn), 0) : null;
  const sourceOperatingProfitBn =
    entry?.operatingIncomeBn !== null && entry?.operatingIncomeBn !== undefined ? safeNumber(entry.operatingIncomeBn) : null;
  const revenueBn = entry?.revenueBn !== null && entry?.revenueBn !== undefined ? Math.max(safeNumber(entry.revenueBn), 0) : null;
  const disclosedOperatingExpensesBn = [entry?.sgnaBn, entry?.rndBn]
    .map((value) => (value !== null && value !== undefined ? Math.max(safeNumber(value), 0) : null))
    .filter((value) => value !== null)
    .reduce((sum, value) => sum + value, 0);
  const hasGrossStage =
    revenueBn !== null &&
    grossProfitBn !== null &&
    grossProfitBn !== undefined &&
    costOfRevenueBn !== null &&
    costOfRevenueBn !== undefined;
  const totalCostsAdjustedOperatingExpensesBn =
    hasGrossStage && sourceOperatingExpensesBn !== null
      ? Math.max(sourceOperatingExpensesBn - Math.max(safeNumber(costOfRevenueBn), 0), 0)
      : null;
  const totalCostsOperatingProfitBn =
    revenueBn !== null && sourceOperatingExpensesBn !== null ? safeNumber(revenueBn) - sourceOperatingExpensesBn : null;
  const sourceLooksDerivedFromGrossBridge =
    sourceOperatingExpensesBn !== null &&
    sourceOperatingProfitBn !== null &&
    grossProfitBn !== null &&
    grossProfitBn !== undefined &&
    Math.abs(sourceOperatingProfitBn - (safeNumber(grossProfitBn) - sourceOperatingExpensesBn)) <=
      Math.max(0.35, sourceOperatingExpensesBn * 0.015);
  const totalCostsProxyLikely =
    sourceOperatingExpensesBn !== null &&
    hasGrossStage &&
    sourceOperatingExpensesBn > safeNumber(grossProfitBn) + 0.25 &&
    sourceOperatingExpensesBn <= safeNumber(revenueBn) + Math.max(0.35, safeNumber(revenueBn) * 0.02) &&
    totalCostsAdjustedOperatingExpensesBn !== null &&
    totalCostsAdjustedOperatingExpensesBn <= safeNumber(grossProfitBn) + Math.max(0.35, safeNumber(grossProfitBn) * 0.04);
  const shouldNormalizeFromTotalCosts =
    totalCostsProxyLikely &&
    (
      sourceOperatingProfitBn === null ||
      sourceLooksDerivedFromGrossBridge ||
      (totalCostsOperatingProfitBn !== null &&
        sourceOperatingProfitBn < totalCostsOperatingProfitBn - Math.max(0.4, Math.abs(totalCostsOperatingProfitBn) * 0.08)) ||
      (disclosedOperatingExpensesBn > 0.05 && totalCostsAdjustedOperatingExpensesBn >= disclosedOperatingExpensesBn - 0.35)
    );
  if (shouldNormalizeFromTotalCosts) {
    return {
      operatingProfitBn: totalCostsOperatingProfitBn,
      operatingExpensesBn: totalCostsAdjustedOperatingExpensesBn,
      sourceReliable: false,
      reconciled: totalCostsAdjustedOperatingExpensesBn,
      source: sourceOperatingExpensesBn,
      includesCostOfRevenue: true,
    };
  }
  const operatingExpensesResolution = resolveNormalizedOperatingExpenses(entry, grossProfitBn, operatingProfitBnBase);
  return {
    operatingProfitBn: operatingProfitBnBase,
    operatingExpensesBn: operatingExpensesResolution.value,
    sourceReliable: operatingExpensesResolution.sourceReliable,
    reconciled: operatingExpensesResolution.reconciled,
    source: operatingExpensesResolution.source,
    includesCostOfRevenue: false,
  };
}

function resolveNormalizedOperatingExpenses(entry, grossProfitBn, operatingProfitBn) {
  const sourceOperatingExpensesBn =
    entry?.operatingExpensesBn !== null && entry?.operatingExpensesBn !== undefined ? Math.max(safeNumber(entry.operatingExpensesBn), 0) : null;
  const revenueBn = entry?.revenueBn !== null && entry?.revenueBn !== undefined ? Math.max(safeNumber(entry.revenueBn), 0) : null;
  const reconciledOperatingExpensesBn =
    grossProfitBn !== null && grossProfitBn !== undefined && operatingProfitBn !== null && operatingProfitBn !== undefined
      ? Math.max(safeNumber(grossProfitBn) - safeNumber(operatingProfitBn), 0)
      : null;
  if (sourceOperatingExpensesBn === null && reconciledOperatingExpensesBn === null) {
    return {
      value: null,
      sourceReliable: false,
      reconciled: null,
      source: null,
    };
  }
  if (sourceOperatingExpensesBn === null) {
    return {
      value: reconciledOperatingExpensesBn,
      sourceReliable: false,
      reconciled: reconciledOperatingExpensesBn,
      source: null,
    };
  }
  if (reconciledOperatingExpensesBn === null) {
    const exceedsRevenue = revenueBn !== null && sourceOperatingExpensesBn > revenueBn + 0.25;
    const exceedsGrossProfit =
      grossProfitBn !== null && grossProfitBn !== undefined && sourceOperatingExpensesBn > safeNumber(grossProfitBn) + 0.25;
    if (exceedsRevenue || exceedsGrossProfit) {
      return {
        value: 0,
        sourceReliable: false,
        reconciled: null,
        source: sourceOperatingExpensesBn,
      };
    }
    return {
      value: sourceOperatingExpensesBn,
      sourceReliable: true,
      reconciled: null,
      source: sourceOperatingExpensesBn,
    };
  }
  const delta = Math.abs(sourceOperatingExpensesBn - reconciledOperatingExpensesBn);
  const relativeDelta = reconciledOperatingExpensesBn > 0.05 ? delta / reconciledOperatingExpensesBn : delta;
  const exceedsGrossProfit =
    grossProfitBn !== null && grossProfitBn !== undefined && sourceOperatingExpensesBn > safeNumber(grossProfitBn) + 0.25;
  const sourceReliable = !exceedsGrossProfit && (delta <= 0.25 || relativeDelta <= 0.08);
  return {
    value: sourceReliable ? sourceOperatingExpensesBn : reconciledOperatingExpensesBn,
    sourceReliable,
    reconciled: reconciledOperatingExpensesBn,
    source: sourceOperatingExpensesBn,
  };
}

function resolveNormalizedNonOperating(entry, operatingProfitBn, pretaxIncomeBn) {
  const sourceNonOperatingBn =
    entry?.nonOperatingBn !== null && entry?.nonOperatingBn !== undefined ? safeNumber(entry.nonOperatingBn) : null;
  const reconciledNonOperatingBn =
    pretaxIncomeBn !== null &&
    pretaxIncomeBn !== undefined &&
    operatingProfitBn !== null &&
    operatingProfitBn !== undefined
      ? safeNumber(pretaxIncomeBn) - safeNumber(operatingProfitBn)
      : null;
  if (sourceNonOperatingBn === null && reconciledNonOperatingBn === null) {
    return {
      value: null,
      sourceReliable: false,
      reconciled: null,
      source: null,
      usePretaxResidualLabel: false,
    };
  }
  if (sourceNonOperatingBn === null) {
    return {
      value: reconciledNonOperatingBn,
      sourceReliable: false,
      reconciled: reconciledNonOperatingBn,
      source: null,
      usePretaxResidualLabel: true,
    };
  }
  if (reconciledNonOperatingBn === null) {
    return {
      value: sourceNonOperatingBn,
      sourceReliable: true,
      reconciled: null,
      source: sourceNonOperatingBn,
      usePretaxResidualLabel: false,
    };
  }
  const delta = Math.abs(sourceNonOperatingBn - reconciledNonOperatingBn);
  const relativeDelta = Math.abs(reconciledNonOperatingBn) > 0.05 ? delta / Math.abs(reconciledNonOperatingBn) : delta;
  const sourceReliable = delta <= 0.25 || relativeDelta <= 0.08;
  return {
    value: sourceReliable ? sourceNonOperatingBn : reconciledNonOperatingBn,
    sourceReliable,
    reconciled: reconciledNonOperatingBn,
    source: sourceNonOperatingBn,
    usePretaxResidualLabel: !sourceReliable,
  };
}

function buildGenericBreakdown(entry) {
  const rawItems = [];
  if (entry.rndBn && entry.rndBn > 0.05) {
    rawItems.push({
      key: "rndBn",
      name: "R&D",
      valueBn: entry.rndBn,
      color: "#E43B54",
    });
  }
  if (entry.sgnaBn && entry.sgnaBn > 0.05) {
    rawItems.push({
      key: "sgnaBn",
      name: "SG&A",
      valueBn: entry.sgnaBn,
      color: "#F15B6C",
    });
  }
  if (entry.otherOpexBn && entry.otherOpexBn > 0.05) {
    rawItems.push({
      key: "otherOpexBn",
      name: "Other OpEx",
      valueBn: entry.otherOpexBn,
      color: "#FB7185",
    });
  }
  const decorate = (item) => ({
    ...item,
    pctOfRevenue: entry.revenueBn ? (safeNumber(item.valueBn) / entry.revenueBn) * 100 : null,
    note: entry.revenueBn ? formatShareMetricNote((safeNumber(item.valueBn) / entry.revenueBn) * 100, { basis: "of revenue" }) : "",
  });
  const targetOperatingExpensesBn = Math.max(safeNumber(entry.operatingExpensesBn), 0);
  if (!rawItems.length) return [];
  if (targetOperatingExpensesBn <= 0.05) {
    return rawItems.map(decorate);
  }
  const tolerance = 0.08;
  const rawSum = rawItems.reduce((sum, item) => sum + safeNumber(item.valueBn), 0);
  const rawFitsTarget = rawItems.every((item) => safeNumber(item.valueBn) <= targetOperatingExpensesBn + tolerance);
  if (rawFitsTarget && rawSum <= targetOperatingExpensesBn + tolerance) {
    const items = rawItems.map(decorate);
    if (targetOperatingExpensesBn - rawSum > tolerance) {
      items.push(
        decorate({
          name: "Residual OpEx",
          valueBn: targetOperatingExpensesBn - rawSum,
          color: "#FB7185",
        })
      );
    }
    return items;
  }
  if (rawItems.length === 1) {
    return [
      decorate({
        ...rawItems[0],
        valueBn: Math.min(safeNumber(rawItems[0].valueBn), targetOperatingExpensesBn),
      }),
    ];
  }
  const anchoredItems = rawItems.filter(
    (item) => item.key !== "otherOpexBn" && safeNumber(item.valueBn) <= targetOperatingExpensesBn + tolerance
  );
  let anchoredSum = anchoredItems.reduce((sum, item) => sum + safeNumber(item.valueBn), 0);
  const items = [];
  if (anchoredSum > targetOperatingExpensesBn + tolerance && anchoredSum > 0) {
    const scaleFactor = targetOperatingExpensesBn / anchoredSum;
    anchoredItems.forEach((item) => {
      items.push(
        decorate({
          ...item,
          valueBn: safeNumber(item.valueBn) * scaleFactor,
        })
      );
    });
    return items;
  }
  anchoredItems.forEach((item) => items.push(decorate(item)));
  anchoredSum = items.reduce((sum, item) => sum + safeNumber(item.valueBn), 0);
  if (targetOperatingExpensesBn - anchoredSum > tolerance) {
    items.push(
      decorate({
        name: "Other OpEx",
        valueBn: targetOperatingExpensesBn - anchoredSum,
        color: "#FB7185",
      })
    );
  }
  return items;
}

function firstResolvedBreakdownNumber(...values) {
  for (const value of values) {
    if (value === null || value === undefined || value === "") continue;
    const normalized = Number(value);
    if (!Number.isNaN(normalized)) {
      return normalized;
    }
  }
  return null;
}

function resolveOperatingExpenseBreakdown(snapshot, company, entry) {
  if (snapshot?.opexBreakdown?.length) {
    return normalizeBreakdownItems(snapshot.opexBreakdown, snapshot?.sourceUrl || null);
  }
  const supplemental = supplementalComponentsFor(company, snapshot?.quarterKey || entry?.quarterKey);
  const entrySupplemental = entry?.supplementalComponents || {};
  const directBreakdown =
    entry?.officialOpexBreakdown ||
    entry?.opexBreakdown ||
    entrySupplemental?.officialOpexBreakdown ||
    entrySupplemental?.opexBreakdown ||
    supplemental?.officialOpexBreakdown ||
    supplemental?.opexBreakdown;
  const sourceUrl = supplemental?.sourceUrl || entrySupplemental?.sourceUrl || null;
  if (Array.isArray(directBreakdown) && directBreakdown.length) {
    return normalizeBreakdownItems(directBreakdown, sourceUrl);
  }
  const resolvedEntry = {
    ...entry,
    rndBn: firstResolvedBreakdownNumber(entry?.rndBn, entrySupplemental?.rndBn, supplemental?.rndBn),
    sgnaBn: firstResolvedBreakdownNumber(entry?.sgnaBn, entrySupplemental?.sgnaBn, supplemental?.sgnaBn),
    otherOpexBn: firstResolvedBreakdownNumber(entry?.otherOpexBn, entrySupplemental?.otherOpexBn, supplemental?.otherOpexBn),
    operatingExpensesBn: firstResolvedBreakdownNumber(
      entry?.operatingExpensesBn,
      entrySupplemental?.operatingExpensesBn,
      supplemental?.operatingExpensesBn
    ),
  };
  return buildGenericBreakdown(resolvedEntry).map((item) => ({
    ...item,
    sourceUrl: item?.sourceUrl || sourceUrl || null,
  }));
}

function resolveCollapsedSingleExpenseBreakdown(items, totalValueBn, options = {}) {
  const normalizedItems = Array.isArray(items) ? items.filter((item) => safeNumber(item?.valueBn) > 0.02) : [];
  if (normalizedItems.length !== 1) return null;
  const total = Math.max(safeNumber(totalValueBn), 0);
  const itemValue = Math.max(safeNumber(normalizedItems[0]?.valueBn), 0);
  const tolerance = Math.max(
    safeNumber(options.baseTolerance, 0.08),
    total * safeNumber(options.relativeToleranceFactor, 0.01)
  );
  if (Math.abs(itemValue - total) > tolerance) return null;
  return normalizedItems[0];
}

const UNIVERSAL_REVENUE_SEGMENT_PALETTE = [
  "#2499D5",
  "#F6C244",
  "#A8ABB4",
  "#8BCB9B",
  "#F28B52",
  "#8E6BBE",
  "#E58FA7",
  "#58B8C9",
  "#C9A66B",
  "#7A9CCF",
];

const REVENUE_STYLE_PALETTES = {
  "ad-funnel-bridge": UNIVERSAL_REVENUE_SEGMENT_PALETTE,
  "alibaba-commerce-staged": UNIVERSAL_REVENUE_SEGMENT_PALETTE,
  "asml-technology-bridge": UNIVERSAL_REVENUE_SEGMENT_PALETTE,
  "commerce-service-bridge": UNIVERSAL_REVENUE_SEGMENT_PALETTE,
  "micron-business-unit-bridge": UNIVERSAL_REVENUE_SEGMENT_PALETTE,
  "oracle-revenue-bridge": UNIVERSAL_REVENUE_SEGMENT_PALETTE,
  "mastercard-revenue-bridge": UNIVERSAL_REVENUE_SEGMENT_PALETTE,
  "netflix-regional-revenue": UNIVERSAL_REVENUE_SEGMENT_PALETTE,
  "tsmc-platform-mix": UNIVERSAL_REVENUE_SEGMENT_PALETTE,
};

const ORACLE_SUPPORT_LINES = {
  cloud: ["Cloud services + support"],
  software: ["License + on-prem"],
  hardware: ["Hardware systems"],
  services: ["Consulting + support"],
};

const MASTERCARD_SUPPORT_LINES = {
  paymentnetwork: ["Core payment network"],
  valueaddedservicessolutions: ["Cyber + data + loyalty"],
  valueaddedservicesandsolutions: ["Cyber + data + loyalty"],
  domesticassessments: ["Domestic assessments"],
  crossbordervolumefees: ["Cross-border fees"],
  transactionprocessing: ["Processing fees"],
  otherrevenues: ["Other revenues"],
};

const NETFLIX_REGION_SUPPORT_LINES = {
  ucan: ["US + Canada"],
  emea: ["Europe + MEA"],
  latam: ["Latin America"],
  apac: ["Asia-Pacific"],
};

const ASML_DETAIL_ORDER = {
  euv: 0,
  arfi: 1,
  arfdry: 2,
  krf: 3,
  iline: 4,
  metrologyinspection: 5,
};

const ASML_DETAIL_PALETTE = ["#1D9FD8", "#4CA8E8", "#79C3F5", "#A5D4E4", "#E9B955", "#8CB68C"];

function supportLinesForOfficialRow(style, row) {
  if (row?.supportLines?.length) return row.supportLines;
  if (style === "oracle-revenue-bridge") {
    return ORACLE_SUPPORT_LINES[row.memberKey] || null;
  }
  if (style === "mastercard-revenue-bridge") {
    return MASTERCARD_SUPPORT_LINES[row.memberKey] || null;
  }
  if (style === "netflix-regional-revenue") {
    return NETFLIX_REGION_SUPPORT_LINES[row.memberKey] || null;
  }
  return null;
}

function revenuePaletteForStyle(company, style, count) {
  const palette = REVENUE_STYLE_PALETTES[style];
  if (palette?.length) return palette.slice(0, Math.max(count, palette.length));
  return segmentPaletteForCompany(company, count);
}

function segmentPaletteForCompany(company, count) {
  const base = UNIVERSAL_REVENUE_SEGMENT_PALETTE;
  if (count <= 3) return base.slice(0, count);
  return base.slice(0, Math.min(base.length, count));
}

const SEGMENT_TOKEN_STOPWORDS = new Set([
  "and",
  "before",
  "business",
  "businesses",
  "centers",
  "company",
  "corporate",
  "corporation",
  "group",
  "groups",
  "holding",
  "holdings",
  "inc",
  "limited",
  "llc",
  "ltd",
  "operating",
  "other",
  "reportable",
  "retailing",
  "segment",
  "segments",
  "services",
  "the",
]);

function segmentTokenSet(label, company) {
  const companyTokens = new Set(
    String(company?.nameEn || "")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean)
  );
  return new Set(
    String(label || "")
      .toLowerCase()
      .replaceAll("&", " ")
      .split(/[^a-z0-9]+/)
      .filter((token) => token && !SEGMENT_TOKEN_STOPWORDS.has(token) && !companyTokens.has(token))
  );
}

function normalizeSegmentLabel(label) {
  return String(label || "")
    .toLowerCase()
    .replaceAll("&", " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isAggregateLikeSegmentLabel(label) {
  const normalized = normalizeSegmentLabel(label);
  if (!normalized) return false;
  if (["primary", "primary segment", "reportable", "reportable segment"].includes(normalized)) return true;
  return (
    normalized === "other segments" ||
    normalized === "all other segments" ||
    normalized === "corporate non" ||
    normalized.includes("aggregation before other operating") ||
    normalized.includes("reportable aggregation") ||
    normalized.includes("segment aggregation") ||
    normalized.includes("business segments") ||
    normalized.includes("operating segments") ||
    normalized.includes("consolidated") ||
    normalized.includes("total company") ||
    normalized.includes("total segment")
  );
}

function isCombinedSegmentLabel(label, labels = []) {
  const normalized = normalizeSegmentLabel(label);
  if (!normalized.includes(" and ")) return false;
  const tokens = new Set(
    normalized
      .split(" ")
      .filter((token) => token && !SEGMENT_TOKEN_STOPWORDS.has(token))
  );
  if (tokens.size < 2) return false;
  let overlaps = 0;
  labels.forEach((other) => {
    if (!other || other === label || isAggregateLikeSegmentLabel(other)) return;
    const otherTokens = new Set(
      normalizeSegmentLabel(other)
        .split(" ")
        .filter((token) => token && !SEGMENT_TOKEN_STOPWORDS.has(token))
    );
    if (!otherTokens.size || otherTokens.size === tokens.size) return;
    if ([...otherTokens].every((token) => tokens.has(token))) {
      overlaps += 1;
    }
  });
  return overlaps >= 2;
}

function hasOtherSiblingAggregateLabel(label, labels = []) {
  const normalized = normalizeSegmentLabel(label);
  if (!normalized || normalized.startsWith("other ")) return false;
  return labels.some((other) => normalizeSegmentLabel(other) === `other ${normalized}`);
}

function segmentLabelPenalty(label) {
  const normalized = normalizeSegmentLabel(label);
  let penalty = 0;
  if (/aggregation|reportable|consolidated/.test(normalized)) penalty += 220;
  if (/before other operating/.test(normalized)) penalty += 200;
  if (/all other segments/.test(normalized)) penalty += 32;
  if (/corporate .* other|other .* corporate/.test(normalized)) penalty += 18;
  if (isAggregateLikeSegmentLabel(normalized)) penalty += 110;
  return penalty;
}

function buildResidualRevenueSegment(valueBn, sourceRows = []) {
  const residualValueBn = Number(Math.max(safeNumber(valueBn), 0).toFixed(3));
  if (residualValueBn <= 0.02) return null;
  const sourceUrl = [...(sourceRows || [])].map((item) => item?.sourceUrl).find(Boolean) || null;
  return {
    name: "Other revenue",
    memberKey: "otherrevenue",
    valueBn: residualValueBn,
    flowValueBn: residualValueBn,
    yoyPct: null,
    qoqPct: null,
    sourceUrl,
    syntheticResidual: true,
  };
}

function revenueRowCanonicalKey(company, item) {
  return canonicalBarSegmentKey(
    company?.id,
    normalizeLabelKey(item?.memberKey || item?.id || item?.name),
    item?.name || ""
  );
}

function revenueTargetCanonicalKey(company, item) {
  return canonicalBarSegmentKey(
    company?.id,
    normalizeLabelKey(item?.targetId || item?.targetName || item?.target || item?.groupName || ""),
    item?.targetName || item?.target || item?.groupName || ""
  );
}

function entryQuarterKey(company, entry) {
  if (!entry || !company?.financials) return null;
  if (parseQuarterKey(entry?.quarterKey)) return entry.quarterKey;
  const directMatch = Object.entries(company.financials).find(([, candidate]) => candidate === entry);
  if (directMatch) return directMatch[0];
  const periodEnd = String(entry?.periodEnd || "");
  const revenueBn = safeNumber(entry?.revenueBn, null);
  if (!periodEnd) return null;
  const looseMatch = Object.entries(company.financials).find(([, candidate]) => {
    if (!candidate) return false;
    if (String(candidate.periodEnd || "") !== periodEnd) return false;
    const candidateRevenueBn = safeNumber(candidate.revenueBn, null);
    return revenueBn === null || candidateRevenueBn === null ? true : Math.abs(candidateRevenueBn - revenueBn) < 0.002;
  });
  return looseMatch?.[0] || null;
}

function quarterDistanceBetween(leftQuarterKey, rightQuarterKey) {
  const leftParsed = parseQuarterKey(leftQuarterKey);
  const rightParsed = parseQuarterKey(rightQuarterKey);
  if (!leftParsed || !rightParsed) return null;
  const leftIndex = leftParsed.year * 4 + (leftParsed.quarter - 1);
  const rightIndex = rightParsed.year * 4 + (rightParsed.quarter - 1);
  return Math.abs(leftIndex - rightIndex);
}

function resolvedBarBridgeStyle(company, entry = null, structurePayload = null, candidateRows = null) {
  const explicitStyle = String(structurePayload?.style || entry?.officialRevenueStyle || "").trim().toLowerCase();
  if (explicitStyle) return explicitStyle;
  const rowsToInspect = Array.isArray(candidateRows) && candidateRows.length ? candidateRows : entry?.officialRevenueSegments || [];
  if (String(company?.id || "").toLowerCase() === "alibaba" && alibabaBarComparablePhase(rowsToInspect)) {
    return "alibaba-commerce-staged";
  }
  if (!entry) return "";
  const inferredStyle = inferredOfficialRevenueStyle(
    company,
    entry,
    rowsToInspect
  );
  return String(inferredStyle || "").trim().toLowerCase();
}

function shouldUseOfficialGroupCandidate(company, entry, structurePayload = null) {
  if (!entry) return false;
  const hasEntryDetailGroups = Array.isArray(entry?.officialRevenueDetailGroups) && entry.officialRevenueDetailGroups.some((item) => safeNumber(item?.valueBn) > 0.02);
  const hasStructureDetailGroups =
    Array.isArray(structurePayload?.detailGroups) && structurePayload.detailGroups.some((item) => safeNumber(item?.valueBn) > 0.02);
  const officialSegmentCount =
    Array.isArray(entry?.officialRevenueSegments) ? entry.officialRevenueSegments.filter((item) => safeNumber(item?.valueBn) > 0.02).length : 0;
  return !!resolvedBarBridgeStyle(company, entry, structurePayload) || hasEntryDetailGroups || hasStructureDetailGroups || officialSegmentCount >= 8;
}

function inferResidualRevenueSegment(company, entry, rows = []) {
  const revenueBn = safeNumber(entry?.revenueBn, null);
  if (!(revenueBn > 0.2) || !Array.isArray(rows) || !rows.length) return null;
  const bridgeStyle = resolvedBarBridgeStyle(company, entry, null, rows);
  if (!bridgeStyle) return null;
  const currentQuarterKey = entryQuarterKey(company, entry);
  if (
    String(company?.id || "").toLowerCase() === "alphabet" &&
    currentQuarterKey &&
    quarterSortValue(currentQuarterKey) < quarterSortValue("2021Q1")
  ) {
    return null;
  }
  const coveredRevenueBn = rows.reduce((sum, item) => sum + safeNumber(item?.valueBn), 0);
  const residualRevenueBn = revenueBn - coveredRevenueBn;
  if (residualRevenueBn <= Math.max(0.08, revenueBn * 0.06)) return null;
  const presentKeys = new Set(rows.map((item) => revenueRowCanonicalKey(company, item)).filter(Boolean));
  const blockedCandidateKeys = new Set();
  const conflictMap = BAR_RESIDUAL_INFERENCE_CONFLICTS[String(company?.id || "").toLowerCase()] || null;
  if (conflictMap) {
    presentKeys.forEach((presentKey) => {
      (conflictMap[presentKey] || []).forEach((candidateKey) => blockedCandidateKeys.add(candidateKey));
    });
  }
  const candidateScores = new Map();
  Object.entries(company?.financials || {}).forEach(([quarterKey, candidateEntry]) => {
    if (!candidateEntry || candidateEntry === entry) return;
    const candidateRows = sanitizeOfficialStructureRows(candidateEntry, candidateEntry?.officialRevenueSegments || []).filter(
      (item) => safeNumber(item?.valueBn) > 0.02
    );
    if (!candidateRows.length) return;
    const distance = quarterDistanceBetween(currentQuarterKey, quarterKey);
    const distanceWeight = distance === null ? 0.08 : 1 / Math.max(distance, 1);
    const candidateRevenueBn = safeNumber(candidateEntry?.revenueBn, null);
    candidateRows.forEach((item) => {
      const key = revenueRowCanonicalKey(company, item);
      if (!key || presentKeys.has(key) || blockedCandidateKeys.has(key) || key === "otherrevenue" || isAggregateLikeSegmentLabel(item?.name || "")) return;
      const valueShare = candidateRevenueBn > 0.02 ? clamp(safeNumber(item?.valueBn) / candidateRevenueBn, 0.04, 1.2) : 0.18;
      const existing = candidateScores.get(key) || {
        key,
        name: item?.name || "Segment",
        nameZh: item?.nameZh || "",
        score: 0,
        nearestDistance: Number.POSITIVE_INFINITY,
      };
      existing.score += distanceWeight * (0.55 + valueShare);
      existing.nearestDistance = Math.min(existing.nearestDistance, distance ?? Number.POSITIVE_INFINITY);
      if (!existing.nameZh && item?.nameZh) existing.nameZh = item.nameZh;
      candidateScores.set(key, existing);
    });
  });
  const ranked = [...candidateScores.values()].sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    return left.nearestDistance - right.nearestDistance;
  });
  if (!ranked.length) return null;
  const topCandidate = ranked[0];
  const secondCandidate = ranked[1] || null;
  const minimumScore =
    !secondCandidate && topCandidate.nearestDistance <= 24 && bridgeStyle ? 0.28 : 0.55;
  if (topCandidate.score < minimumScore) return null;
  if (secondCandidate && topCandidate.score < secondCandidate.score * 1.18) return null;
  const meta = canonicalBarSegmentMeta(company?.id, topCandidate.key, topCandidate.name, topCandidate.nameZh || "");
  const sourceRowWithMeta = rows.find((item) => item?.filingDate || item?.periodEnd || item?.sourceUrl) || null;
  return {
    name: meta.name || topCandidate.name || "Segment",
    nameZh: meta.nameZh || topCandidate.nameZh || translateBusinessLabelToZh(topCandidate.name || "Segment"),
    memberKey: topCandidate.key,
    valueBn: Number(residualRevenueBn.toFixed(3)),
    flowValueBn: Number(residualRevenueBn.toFixed(3)),
    syntheticResidual: true,
    sourceUrl: sourceRowWithMeta?.sourceUrl || null,
    filingDate: sourceRowWithMeta?.filingDate || null,
    periodEnd: sourceRowWithMeta?.periodEnd || entry?.periodEnd || null,
  };
}

function resolveRenderableOfficialRevenueRows(company, entry, options = {}) {
  const allowNearbyInterpolation = options.allowNearbyInterpolation !== false;
  const revenueBn = safeNumber(entry?.revenueBn, null);
  const rawRows = sanitizeOfficialStructureRows(entry, entry?.officialRevenueSegments || [])
    .filter((item) => safeNumber(item?.valueBn) > 0.02)
    .sort((left, right) => safeNumber(right?.valueBn) - safeNumber(left?.valueBn));
  if (rawRows.length) {
    const nextRows = rawRows.map((item) => ({ ...item }));
    const inferredResidual = inferResidualRevenueSegment(company, entry, nextRows);
    if (inferredResidual) {
      nextRows.push(inferredResidual);
      nextRows.sort((left, right) => safeNumber(right?.valueBn) - safeNumber(left?.valueBn));
    }
    return nextRows;
  }
  if (!allowNearbyInterpolation || !(revenueBn > 0.2)) return [];
  const currentQuarterKey = entryQuarterKey(company, entry);
  if (!currentQuarterKey) return [];
  let bestCandidate = null;
  Object.entries(company?.financials || {}).forEach(([quarterKey, candidateEntry]) => {
    if (!candidateEntry || candidateEntry === entry) return;
    const distance = quarterDistanceBetween(currentQuarterKey, quarterKey);
    if (distance === null || distance > 2) return;
    const candidateRows = resolveRenderableOfficialRevenueRows(company, candidateEntry, { allowNearbyInterpolation: false });
    if (candidateRows.length < 2) return;
    const candidateSum = candidateRows.reduce((sum, item) => sum + safeNumber(item?.valueBn), 0);
    const candidateRevenueBn = safeNumber(candidateEntry?.revenueBn, null);
    const coverageRatio = candidateRevenueBn > 0.02 ? candidateSum / candidateRevenueBn : 0;
    if (coverageRatio < 0.62 || coverageRatio > 1.18) return;
    const score = distance * 100 - candidateRows.length * 4 + Math.abs(coverageRatio - 1) * 20;
    if (!bestCandidate || score < bestCandidate.score) {
      bestCandidate = {
        score,
        rows: candidateRows,
        sourceQuarterKey: quarterKey,
      };
    }
  });
  if (!bestCandidate) return [];
  const sourceTotalBn = bestCandidate.rows.reduce((sum, item) => sum + safeNumber(item?.valueBn), 0);
  if (!(sourceTotalBn > 0.02)) return [];
  const scale = revenueBn / sourceTotalBn;
  return bestCandidate.rows
    .map((item) => ({
      ...item,
      valueBn: Number((safeNumber(item?.valueBn) * scale).toFixed(3)),
      flowValueBn: Number((safeNumber(item?.flowValueBn ?? item?.valueBn) * scale).toFixed(3)),
      syntheticInterpolated: true,
      inferredFromQuarter: bestCandidate.sourceQuarterKey,
    }))
    .sort((left, right) => safeNumber(right?.valueBn) - safeNumber(left?.valueBn));
}

function finalizeCuratedOfficialSegments(selected, revenueBn, options = {}) {
  const preserveAllRows = options.preserveAllRows === true;
  const maxItems = 7;
  let curated = selected
    .slice()
    .sort((left, right) => safeNumber(right.valueBn) - safeNumber(left.valueBn))
    .map((item) => ({
      ...item,
      flowValueBn: safeNumber(item.valueBn),
    }));

  if (!curated.length || revenueBn <= 0.02) return curated;

  const ensureCoverage = (rows) => {
    const sortedRows = rows
      .slice()
      .sort((left, right) => safeNumber(right.valueBn) - safeNumber(left.valueBn))
      .map((item) => ({
        ...item,
        flowValueBn: safeNumber(item.flowValueBn ?? item.valueBn),
      }));
    if (preserveAllRows) {
      return sortedRows;
    }
    const rowsSum = sortedRows.reduce((total, item) => total + safeNumber(item.valueBn), 0);
    if (rowsSum < revenueBn - 0.08) {
      const residual = buildResidualRevenueSegment(revenueBn - rowsSum, sortedRows);
      return residual ? [...sortedRows, residual] : sortedRows;
    }
    return sortedRows;
  };

  if (curated.length > maxItems) {
    curated = ensureCoverage(curated.slice(0, maxItems - 1));
  } else {
    curated = ensureCoverage(curated);
  }

  const curatedSum = curated.reduce((total, item) => total + safeNumber(item.valueBn), 0);
  if (curatedSum > revenueBn + 0.08 && curated.length > 1) {
    if (preserveAllRows) {
      const scale = revenueBn > 0.02 && curatedSum > 0.02 ? revenueBn / curatedSum : 1;
      let runningTotal = 0;
      return curated.map((item, index) => {
        const nextFlowValue =
          index === curated.length - 1
            ? Number(Math.max(revenueBn - runningTotal, 0).toFixed(3))
            : Number((safeNumber(item.valueBn) * scale).toFixed(3));
        runningTotal += nextFlowValue;
        return {
          ...item,
          flowValueBn: nextFlowValue,
        };
      });
    }
    const kept = [];
    let runningTotal = 0;
    curated
      .filter((item) => !item.syntheticResidual)
      .forEach((item) => {
        if (kept.length >= maxItems - 1) return;
        const nextTotal = runningTotal + safeNumber(item.valueBn);
        if (nextTotal <= revenueBn + 0.04 || kept.length < 2) {
          kept.push({
            ...item,
            flowValueBn: safeNumber(item.valueBn),
          });
          runningTotal = nextTotal;
        }
      });
    const residual = buildResidualRevenueSegment(revenueBn - runningTotal, kept);
    curated = residual ? [...kept, residual] : kept;
  }
  if (preserveAllRows && curatedSum < revenueBn - 0.08 && curated.length > 1) {
    const scale = curatedSum > 0.02 ? revenueBn / curatedSum : 1;
    let runningTotal = 0;
    curated = curated.map((item, index) => {
      const nextFlowValue =
        index === curated.length - 1
          ? Number(Math.max(revenueBn - runningTotal, 0).toFixed(3))
          : Number((safeNumber(item.valueBn) * scale).toFixed(3));
      runningTotal += nextFlowValue;
      return {
        ...item,
        flowValueBn: nextFlowValue,
      };
    });
  }

  return curated;
}

function curatedOfficialSegments(company, entry, rows, detailGroups = []) {
  const revenueBn = safeNumber(entry?.revenueBn);
  const rawCandidates = [...rows].filter((item) => safeNumber(item.valueBn) > 0.02).slice(0, 12);
  const rawLabels = rawCandidates.map((item) => item.name);
  const candidates = rawCandidates.filter((item) => {
    if (rawCandidates.length < 3) return true;
    if (hasOtherSiblingAggregateLabel(item.name, rawLabels)) {
      return false;
    }
    if (isAggregateLikeSegmentLabel(item.name)) {
      return false;
    }
    if (isCombinedSegmentLabel(item.name, rawLabels)) {
      return false;
    }
    return true;
  });
  const workingCandidates = candidates.length ? candidates : rawCandidates;
  if (!workingCandidates.length || revenueBn <= 0) {
    return finalizeCuratedOfficialSegments(workingCandidates, revenueBn);
  }
  const requiredTargetKeys = new Set(
    [...(detailGroups || [])]
      .flatMap((item) => [
        normalizeLabelKey(item?.targetId || ""),
        normalizeLabelKey(item?.targetName || item?.target || item?.groupName || ""),
      ])
      .filter(Boolean)
  );
  const candidateKey = (item) => normalizeLabelKey(item?.memberKey || item?.id || item?.name);
  const requiredCandidates = workingCandidates.filter((item) => {
    const itemKeys = [candidateKey(item), normalizeLabelKey(item?.name)].filter(Boolean);
    return itemKeys.some((key) => requiredTargetKeys.has(key));
  });
  const candidateSum = workingCandidates.reduce((total, item) => total + safeNumber(item.valueBn), 0);
  const candidateRatio = candidateSum / revenueBn;
  const preserveDetailHierarchy =
    requiredCandidates.length > 0 &&
    requiredCandidates.length === requiredTargetKeys.size &&
    workingCandidates.length <= 7 &&
    candidateRatio >= 0.72 &&
    candidateRatio <= 1.18;
  const preserveFullBreakdown =
    preserveDetailHierarchy ||
    (entry?.officialRevenueStyle && candidateRatio >= 0.78 && candidateRatio <= 1.18) ||
    (workingCandidates.length >= 3 && workingCandidates.length <= 6 && candidateRatio >= 0.88 && candidateRatio <= 1.18);

  if (preserveFullBreakdown) {
    return finalizeCuratedOfficialSegments(workingCandidates, revenueBn, { preserveAllRows: true });
  }

  let best = null;
  const maxMask = 1 << workingCandidates.length;
  for (let mask = 1; mask < maxMask; mask += 1) {
    const selected = [];
    let sum = 0;
    let count = 0;
    for (let index = 0; index < workingCandidates.length; index += 1) {
      if (!(mask & (1 << index))) continue;
      selected.push(workingCandidates[index]);
      sum += safeNumber(workingCandidates[index].valueBn);
      count += 1;
    }
    if (count === 0 || count > 7 || (count === 1 && workingCandidates.length > 1)) continue;
    if (requiredCandidates.length) {
      const selectedKeys = new Set(selected.flatMap((item) => [candidateKey(item), normalizeLabelKey(item?.name)].filter(Boolean)));
      const missingRequired = [...requiredTargetKeys].some((key) => !selectedKeys.has(key));
      if (missingRequired) continue;
    }

    const ratio = sum / revenueBn;
    if (ratio < 0.45 || ratio > 1.35) continue;

    let overlapPenalty = 0;
    const tokenSets = selected.map((item) => segmentTokenSet(item.name, company));
    for (let leftIndex = 0; leftIndex < tokenSets.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < tokenSets.length; rightIndex += 1) {
        const sharedCount = [...tokenSets[leftIndex]].filter((token) => tokenSets[rightIndex].has(token)).length;
        overlapPenalty += sharedCount * 28;
      }
    }

    const genericPenalty = selected.reduce((total, item) => total + segmentLabelPenalty(item.name), 0);
    const distancePenalty = Math.abs(sum - revenueBn) * 110;
    const countPenalty = count > 5 ? (count - 5) * 18 : count < 3 && workingCandidates.length > 3 ? (3 - count) * 40 : 0;
    const coveragePenalty = ratio < 0.78 ? (0.78 - ratio) * 260 : ratio > 1.08 ? (ratio - 1.08) * 360 : 0;
    const reward = count >= 3 && count <= 6 ? 44 : 0;
    const score = reward - distancePenalty - countPenalty - coveragePenalty - genericPenalty - overlapPenalty;

    if (!best || score > best.score || (Math.abs(score - best.score) < 0.01 && count < best.selected.length)) {
      best = { score, selected, sum };
    }
  }

  if (!best) return finalizeCuratedOfficialSegments(workingCandidates.slice(0, Math.min(workingCandidates.length, 7)), revenueBn);

  return finalizeCuratedOfficialSegments(best.selected, revenueBn);
}

function buildOfficialBusinessGroups(company, entry) {
  const revenueBn = safeNumber(entry?.revenueBn);
  const official = resolveRenderableOfficialRevenueRows(company, entry);
  const detailGroups = sanitizeOfficialStructureRows(entry, entry.officialRevenueDetailGroups || [])
    .filter((item) => safeNumber(item.valueBn) > 0.02);
  if (!official.length) return null;
  const style = inferredOfficialRevenueStyle(company, entry, official);
  if (style === "alibaba-commerce-staged") {
    return buildAlibabaStagedBusinessGroups(company, entry);
  }
  const officialCoverageRatio = safeNumber(entry?.revenueBn) > 0 ? official.reduce((total, item) => total + safeNumber(item.valueBn), 0) / safeNumber(entry.revenueBn) : 0;
  if (!style && official.length <= 1 && officialCoverageRatio < 0.02) {
    return null;
  }
  const curated = curatedOfficialSegments(company, entry, official, detailGroups);
  if (!curated.length) {
    return null;
  }
  if ((!style && officialCoverageRatio < 0.18 && curated.length < 2) || curated.every((item) => isAggregateLikeSegmentLabel(item.name))) {
    return null;
  }
  const palette = revenuePaletteForStyle(company, style, curated.length);
  const compactMode = curated.length >= 5;
  const groups = curated.map((item, index) => {
    const memberKey = item.memberKey || item.name;
    const color = palette[index % palette.length];
    const group = {
      id: memberKey,
      name: item.name,
      nameZh: item.nameZh || translateBusinessLabelToZh(item.name),
      displayLines: wrapLines(item.name, compactMode ? 14 : 16),
      valueBn: item.valueBn,
      flowValueBn: item.flowValueBn ?? item.valueBn,
      yoyPct: item.yoyPct ?? null,
      qoqPct: item.qoqPct ?? null,
      mixPct: item.mixPct ?? null,
      mixYoyDeltaPp: item.mixYoyDeltaPp ?? null,
      metricMode: item.metricMode || null,
      operatingMarginPct: null,
      nodeColor: color,
      flowColor: rgba(color, compactMode ? 0.5 : 0.58),
      labelColor: "#55595F",
      valueColor: "#676C75",
      supportLines: supportLinesForOfficialRow(style, item),
      supportLinesZh: item.supportLinesZh || null,
      compactLabel: compactMode,
      sourceUrl: item.sourceUrl || null,
      filingDate: item.filingDate || null,
      periodEnd: item.periodEnd || entry?.periodEnd || null,
      memberKey,
    };
    if (style === "netflix-regional-revenue") {
      group.lockupKey = `region-${memberKey}`;
      group.compactLabel = true;
      group.layoutDensity = "compact";
      group.lockupScale = 0.58;
    }
    if (style === "tsmc-platform-mix") {
      group.compactLabel = true;
      group.layoutDensity = "compact";
    }
    return group;
  });
  return normalizeGroupFlowTotalsToRevenue(groups, revenueBn);
}

function buildOfficialDetailGroups(company, entry, businessGroups = null) {
  const style = inferredOfficialRevenueStyle(company, entry, entry.officialRevenueSegments || []);
  const rawDetailGroups = sanitizeOfficialStructureRows(entry, entry.officialRevenueDetailGroups || [])
    .filter((item) => safeNumber(item.valueBn) > 0.02);
  if (!rawDetailGroups.length) return null;
  const resolvedBusinessGroups = businessGroups || buildOfficialBusinessGroups(company, entry) || [];
  const businessGroupMap = new Map();
  resolvedBusinessGroups.forEach((group) => {
    [
      revenueRowCanonicalKey(company, group),
      revenueRowCanonicalKey(company, { memberKey: group?.memberKey, id: group?.id, name: group?.name }),
      normalizeLabelKey(group?.name || ""),
    ]
      .filter(Boolean)
      .forEach((key) => {
        if (!businessGroupMap.has(key)) {
          businessGroupMap.set(key, group);
        }
      });
  });
  const detailRowsByTarget = new Map();
  rawDetailGroups.forEach((item) => {
    const targetKey = revenueTargetCanonicalKey(company, item);
    if (!targetKey) return;
    if (!detailRowsByTarget.has(targetKey)) {
      detailRowsByTarget.set(targetKey, []);
    }
    detailRowsByTarget.get(targetKey).push(item);
  });
  const suppressedTargetKeys = new Set();
  detailRowsByTarget.forEach((rows, targetKey) => {
    const targetGroup = businessGroupMap.get(targetKey) || null;
    const targetValueBn = safeNumber(targetGroup?.valueBn, null);
    if (!(targetValueBn > 0.02)) return;
    const detailValueBn = rows.reduce((sum, item) => sum + safeNumber(item?.valueBn), 0);
    const coverageRatio = detailValueBn / targetValueBn;
    if (rows.length === 1 && coverageRatio < 0.55) {
      suppressedTargetKeys.add(targetKey);
    }
  });
  const detailGroups = rawDetailGroups.filter((item) => !suppressedTargetKeys.has(revenueTargetCanonicalKey(company, item)));
  if (!detailGroups.length) return null;
  if (style === "alibaba-commerce-staged") {
    const targetGroupMap = new Map();
    resolvedBusinessGroups.forEach((group, index) => {
      [
        normalizeLabelKey(group.id || group.memberKey || group.name),
        normalizeLabelKey(group.memberKey || ""),
        normalizeLabelKey(group.name || ""),
      ]
        .filter(Boolean)
        .forEach((key) => {
          if (!targetGroupMap.has(key)) {
            targetGroupMap.set(key, { group, index });
          }
        });
    });
    const detailGroupCounts = new Map();
    detailGroups.forEach((item) => {
      const targetKey = normalizeLabelKey(item.targetId || item.targetName || item.target || item.groupName);
      detailGroupCounts.set(targetKey, (detailGroupCounts.get(targetKey) || 0) + 1);
    });
    const detailGroupIndexes = new Map();
    return detailGroups
      .slice()
      .sort((left, right) => {
        const leftTargetKey = normalizeLabelKey(left.targetId || left.targetName || left.target || left.groupName);
        const rightTargetKey = normalizeLabelKey(right.targetId || right.targetName || right.target || right.groupName);
        const targetOrder = (targetGroupMap.get(leftTargetKey)?.index ?? 999) - (targetGroupMap.get(rightTargetKey)?.index ?? 999);
        if (targetOrder !== 0) return targetOrder;
        const leftOrder = ALIBABA_DETAIL_ORDER[normalizeLabelKey(left.memberKey || left.name)] ?? 99;
        const rightOrder = ALIBABA_DETAIL_ORDER[normalizeLabelKey(right.memberKey || right.name)] ?? 99;
        if (leftOrder !== rightOrder) return leftOrder - rightOrder;
        return safeNumber(right.valueBn) - safeNumber(left.valueBn);
      })
      .map((item) => {
        const targetKey = normalizeLabelKey(item.targetId || item.targetName || item.target || item.groupName);
        const targetInfo = targetGroupMap.get(targetKey);
        const targetGroup = targetInfo?.group || null;
        const targetId = targetGroup?.id || item.targetId || item.targetName || item.target || item.groupName;
        const groupIndex = detailGroupIndexes.get(targetId) || 0;
        const groupCount = detailGroupCounts.get(targetId) || 1;
        detailGroupIndexes.set(targetId, groupIndex + 1);
        const baseColor = targetGroup?.nodeColor || company?.brand?.primary || "#2499D5";
        const color = groupCount <= 1 ? baseColor : mixHex(baseColor, "#FFFFFF", clamp(groupIndex * 0.16, 0, 0.32));
        return {
          id: item.memberKey || item.name,
          name: item.name,
          nameZh: item.nameZh || translateBusinessLabelToZh(item.name),
          displayLines: wrapLines(item.name, 14),
          valueBn: item.valueBn,
          yoyPct: item.yoyPct ?? null,
          qoqPct: item.qoqPct ?? null,
          nodeColor: color,
          flowColor: rgba(color, 0.72),
          labelColor: color,
          valueColor: color,
          supportLines: item.supportLines || null,
          supportLinesZh: item.supportLinesZh || null,
          targetName: targetGroup?.name || item.targetName || item.target || item.groupName,
          targetId,
        };
      });
  }
  if (style === "asml-technology-bridge") {
    return detailGroups
      .slice()
      .sort((left, right) => (ASML_DETAIL_ORDER[left.memberKey] ?? 99) - (ASML_DETAIL_ORDER[right.memberKey] ?? 99))
      .map((item, index) => {
        const color = ASML_DETAIL_PALETTE[index % ASML_DETAIL_PALETTE.length];
        return {
          id: item.memberKey || item.name,
          name: item.name,
          nameZh: item.nameZh || translateBusinessLabelToZh(item.name),
          displayLines: wrapLines(item.name, 14),
          valueBn: item.valueBn,
          yoyPct: item.yoyPct ?? null,
          qoqPct: item.qoqPct ?? null,
          nodeColor: color,
          flowColor: rgba(color, 0.72),
          labelColor: "#55595F",
          valueColor: "#676C75",
          supportLines: item.supportLines || null,
          supportLinesZh: item.supportLinesZh || null,
          targetName: item.targetName || "Net system sales",
          targetId: item.targetId || item.targetName || "Net system sales",
        };
      });
  }

  const targetGroupMap = new Map();
  resolvedBusinessGroups.forEach((group, index) => {
    [
      normalizeLabelKey(group.id || group.memberKey || group.name),
      normalizeLabelKey(group.memberKey || ""),
      normalizeLabelKey(group.name || ""),
    ]
      .filter(Boolean)
      .forEach((key) => {
        if (!targetGroupMap.has(key)) {
          targetGroupMap.set(key, { group, index });
        }
      });
  });
  const detailGroupCounts = new Map();
  detailGroups.forEach((item) => {
    const targetKey = normalizeLabelKey(item.targetId || item.targetName || item.target || item.groupName);
    detailGroupCounts.set(targetKey, (detailGroupCounts.get(targetKey) || 0) + 1);
  });
  const detailGroupIndexes = new Map();
  const sortedDetailGroups = detailGroups.slice().sort((left, right) => {
    const leftTargetKey = normalizeLabelKey(left.targetId || left.targetName || left.target || left.groupName);
    const rightTargetKey = normalizeLabelKey(right.targetId || right.targetName || right.target || right.groupName);
    const targetOrder = (targetGroupMap.get(leftTargetKey)?.index ?? 999) - (targetGroupMap.get(rightTargetKey)?.index ?? 999);
    if (targetOrder !== 0) return targetOrder;
    return safeNumber(right.valueBn) - safeNumber(left.valueBn);
  });

  return sortedDetailGroups.map((item) => {
    const targetKey = normalizeLabelKey(item.targetId || item.targetName || item.target || item.groupName);
    const targetInfo = targetGroupMap.get(targetKey);
    const targetGroup = targetInfo?.group || null;
    const groupIndex = detailGroupIndexes.get(targetKey) || 0;
    const groupCount = detailGroupCounts.get(targetKey) || 1;
    detailGroupIndexes.set(targetKey, groupIndex + 1);
    const baseColor = targetGroup?.nodeColor || company?.brand?.primary || "#2499D5";
    const color = groupCount <= 1 ? baseColor : mixHex(baseColor, "#FFFFFF", clamp(groupIndex * 0.16, 0, 0.32));
    return {
      id: item.memberKey || item.name,
      name: item.name,
      nameZh: item.nameZh || translateBusinessLabelToZh(item.name),
      displayLines: wrapLines(item.name, 14),
      valueBn: item.valueBn,
      yoyPct: item.yoyPct ?? null,
      qoqPct: item.qoqPct ?? null,
      nodeColor: color,
      flowColor: rgba(color, 0.72),
      labelColor: color,
      valueColor: color,
      supportLines: item.supportLines || null,
      supportLinesZh: item.supportLinesZh || null,
      targetName: targetGroup?.name || item.targetName || item.target || item.groupName,
      targetId: item.targetId || targetGroup?.id || targetGroup?.memberKey || item.targetName || item.target || item.groupName,
    };
  });
}

function buildGenericSnapshot(company, entry, quarterKey) {
  const companyBrand = resolvedCompanyBrand(company);
  const grossProfitBnRaw =
    entry.grossProfitBn !== null && entry.grossProfitBn !== undefined
      ? entry.grossProfitBn
      : entry.revenueBn !== null && entry.costOfRevenueBn !== null
        ? entry.revenueBn - entry.costOfRevenueBn
        : entry.operatingIncomeBn !== null && entry.operatingExpensesBn !== null
          ? entry.operatingIncomeBn + entry.operatingExpensesBn
          : null;
  const grossProfitBn =
    grossProfitBnRaw !== null && grossProfitBnRaw !== undefined
      ? grossProfitBnRaw
      : entry.revenueBn !== null && entry.revenueBn !== undefined
        ? entry.revenueBn
        : null;
  const costOfRevenueBnRaw =
    entry.costOfRevenueBn !== null && entry.costOfRevenueBn !== undefined
      ? entry.costOfRevenueBn
      : entry.revenueBn !== null && grossProfitBn !== null
        ? Math.max(entry.revenueBn - grossProfitBn, 0)
        : null;
  const costOfRevenueBn = costOfRevenueBnRaw !== null && costOfRevenueBnRaw !== undefined ? costOfRevenueBnRaw : 0;
  const normalizedPretaxIncomeBn =
    entry.pretaxIncomeBn !== null && entry.pretaxIncomeBn !== undefined
      ? safeNumber(entry.pretaxIncomeBn)
      : entry.netIncomeBn !== null && entry.netIncomeBn !== undefined && entry.taxBn !== null && entry.taxBn !== undefined
        ? safeNumber(entry.netIncomeBn) + safeNumber(entry.taxBn)
        : null;
  const inferredPretaxOperatingBn =
    normalizedPretaxIncomeBn !== null && entry.nonOperatingBn !== null && entry.nonOperatingBn !== undefined
      ? normalizedPretaxIncomeBn - safeNumber(entry.nonOperatingBn, 0)
      : entry.netIncomeBn !== null && entry.netIncomeBn !== undefined
        ? safeNumber(entry.netIncomeBn) + safeNumber(entry.taxBn, 0) - safeNumber(entry.nonOperatingBn, 0)
        : null;
  const operatingProfitBnBase =
    entry.operatingIncomeBn !== null && entry.operatingIncomeBn !== undefined
      ? entry.operatingIncomeBn
      : inferredPretaxOperatingBn;
  const operatingStageResolution = resolveNormalizedOperatingStage(entry, grossProfitBn, costOfRevenueBn, operatingProfitBnBase);
  const operatingProfitBn = operatingStageResolution.operatingProfitBn;
  const operatingExpensesBn = operatingStageResolution.operatingExpensesBn;
  const nonOperatingResolution = resolveNormalizedNonOperating(entry, operatingProfitBn, normalizedPretaxIncomeBn);
  const inferredNonOperatingBnRaw = nonOperatingResolution.value;
  const inferredNonOperatingBn =
    inferredNonOperatingBnRaw !== null && inferredNonOperatingBnRaw !== undefined && Math.abs(safeNumber(inferredNonOperatingBnRaw)) > 0.05
      ? Number(safeNumber(inferredNonOperatingBnRaw).toFixed(3))
      : null;
  const grossMarginPct =
    entry.grossMarginPct !== null && entry.grossMarginPct !== undefined
      ? entry.grossMarginPct
      : entry.revenueBn
        ? (safeNumber(grossProfitBn) / entry.revenueBn) * 100
        : null;
  const operatingMarginPct =
    entry.operatingMarginPct !== null && entry.operatingMarginPct !== undefined
      ? entry.operatingMarginPct
      : entry.revenueBn && operatingProfitBn !== null && operatingProfitBn !== undefined
        ? (operatingProfitBn / entry.revenueBn) * 100
        : null;
  const normalizedEntry = {
    ...entry,
    quarterKey: entry.quarterKey || quarterKey,
    grossProfitBn,
    costOfRevenueBn,
    operatingIncomeBn: operatingProfitBn,
    operatingExpensesBn,
    operatingExpensesSourceReliable: operatingStageResolution.sourceReliable,
    reconciledOperatingExpensesBn: operatingStageResolution.reconciled,
    operatingExpensesIncludesCostOfRevenue: operatingStageResolution.includesCostOfRevenue,
    nonOperatingBn: inferredNonOperatingBn,
    nonOperatingSourceReliable: nonOperatingResolution.sourceReliable,
    reconciledNonOperatingBn: nonOperatingResolution.reconciled,
    usePretaxResidualLabel: nonOperatingResolution.usePretaxResidualLabel,
    grossMarginPct,
    operatingMarginPct,
  };
  const usesFinancialFallback = String(entry.statementSource || "").includes("financial-fallback");
  const financialSourceLabel =
    entry.statementSource === "stockanalysis-financials"
      ? "Stock Analysis financials fallback"
      : usesFinancialFallback
        ? "Official-first financial pipeline"
        : "Official SEC filing financials";
  const financialSubtitle =
    entry.statementSource === "stockanalysis-financials"
      ? "Replica template data scaffold based on Stock Analysis financial statement tables."
      : usesFinancialFallback
        ? "Replica template data scaffold based on official filings with a normalized financial-table fallback for incomplete statement bridges."
      : "Replica template data scaffold based on quarterly financial statement fields.";
  const financialFootnote =
    entry.statementSource === "stockanalysis-financials"
      ? "当前桥图主干来自 Stock Analysis 财务表后备数据源，适用于验证非 SEC 公司扩展接入能力。"
      : usesFinancialFallback
        ? "当前桥图主干采用官方优先的数据流程；若官方主干字段不完整，会安全回退到标准化财务表数据，而不是凭空推断错误桥段。"
      : "模板底稿基于公开季度财务主干字段生成；若部分利润层级未直接披露，会按财报主干关系自动补齐桥图节点。";
  const positiveAdjustments = [];
  const belowOperatingItems = [];
  if (inferredNonOperatingBn) {
    const residualPositiveLabel = {
      name: "Other pretax gain",
      nameZh: "其他税前收益",
    };
    const residualNegativeLabel = {
      name: "Other pretax expense",
      nameZh: "其他税前费用",
    };
    const standardPositiveLabel = {
      name: "Non-operating gain",
      nameZh: "营业外收益",
    };
    const standardNegativeLabel = {
      name: "Non-operating",
      nameZh: "营业外费用",
    };
    const positiveLabel = normalizedEntry.usePretaxResidualLabel ? residualPositiveLabel : standardPositiveLabel;
    const negativeLabel = normalizedEntry.usePretaxResidualLabel ? residualNegativeLabel : standardNegativeLabel;
    if (inferredNonOperatingBn > 0.05) {
      positiveAdjustments.push({
        name: positiveLabel.name,
        nameZh: positiveLabel.nameZh,
        valueBn: Math.abs(inferredNonOperatingBn),
        color: "#16A34A",
      });
    } else if (inferredNonOperatingBn < -0.05) {
      belowOperatingItems.push({
        name: negativeLabel.name,
        nameZh: negativeLabel.nameZh,
        valueBn: Math.abs(inferredNonOperatingBn),
        color: "#D92D20",
      });
    }
  }
  if (entry.taxBn && entry.taxBn > 0.05) {
    belowOperatingItems.push({
      name: "Tax",
      valueBn: Math.abs(entry.taxBn),
      color: "#D92D20",
    });
  } else if (entry.taxBn && entry.taxBn < -0.05) {
    positiveAdjustments.push({
      name: "Tax benefit",
      valueBn: Math.abs(entry.taxBn),
      color: "#16A34A",
    });
  }
  return {
    mode: "template-base",
    modeLabel: "高精复刻版",
    sourceLabel: financialSourceLabel,
    coverageLabel: "结构原型 + 高精模板",
    title: `${company.nameEn} ${compactFiscalLabel(entry.fiscalLabel) || entry.fiscalLabel || quarterKey} Income Statement`,
    subtitle: financialSubtitle,
    quarterSummary: compactFiscalLabel(entry.fiscalLabel) || quarterKey,
    periodEndLabel: formatPeriodEndLabel(entry.periodEnd) || entry.periodEnd || "",
    companyLogoKey: company.id,
    companyName: company.nameEn,
    companyDisplayName: companyDisplay(company),
    ticker: company.ticker,
    quarterKey,
    fiscalLabel: entry.fiscalLabel || quarterKey,
    displayCurrency: entry.displayCurrency || "USD",
    displayScaleFactor: entry.displayScaleFactor || 1,
    businessGroups: [
      {
        name: "Reported revenue",
        displayLines: [company.nameEn],
        lockupKey: company.id,
        valueBn: entry.revenueBn,
        yoyPct: entry.revenueYoyPct,
        qoqPct: entry.revenueQoqPct,
        operatingMarginPct,
        nodeColor: companyBrand.primary,
        flowColor: rgba(companyBrand.primary, 0.55),
      },
    ],
    revenueBn: entry.revenueBn,
    revenueYoyPct: entry.revenueYoyPct,
    revenueQoqPct: entry.revenueQoqPct,
    grossProfitBn,
    grossMarginPct,
    grossMarginYoyDeltaPp: entry.grossMarginYoyDeltaPp,
    costOfRevenueBn,
    operatingProfitBn,
    nonOperatingBn: inferredNonOperatingBn,
    operatingMarginPct,
    operatingMarginYoyDeltaPp: entry.operatingMarginYoyDeltaPp,
    operatingExpensesBn,
    netProfitBn: entry.netIncomeBn,
    netMarginPct: entry.profitMarginPct,
    netMarginYoyDeltaPp: entry.profitMarginYoyDeltaPp,
    opexBreakdown: resolveOperatingExpenseBreakdown(null, company, normalizedEntry),
    positiveAdjustments,
    belowOperatingItems,
    footnote: financialFootnote,
  };
}

function buildReplicaTemplateSnapshot(company, entry, quarterKey) {
  const companyBrand = resolvedCompanyBrand(company);
  const snapshot = buildGenericSnapshot(company, entry, quarterKey);
  const officialBusinessGroups = buildOfficialBusinessGroups(company, entry);
  const officialDetailGroups = buildOfficialDetailGroups(company, entry, officialBusinessGroups);
  const fallbackSourceLabel = entry.statementSource === "stockanalysis-financials" ? "Stock Analysis financials fallback" : "Replica-style auto template";
  const fallbackSubtitle =
    entry.statementSource === "stockanalysis-financials"
      ? "Replica-style layout auto-generated from Stock Analysis financial statement tables."
      : "Replica-style layout auto-generated from quarterly statement data.";
  const fallbackFootnote =
    entry.statementSource === "stockanalysis-financials"
      ? "统一模板会复用模板集的版式语言，并以 Stock Analysis 财务表后备数据生成非 SEC 公司的利润桥。"
      : "统一模板会复用模板集的版式语言，并按当前公司的真实季度财务数据自动排版。";
  return {
    ...snapshot,
    businessGroups: officialBusinessGroups || snapshot.businessGroups.map((item) => ({
      ...item,
      displayLines: item.displayLines?.length ? item.displayLines : wrapLines(company.nameEn, 14),
      flowColor: item.flowColor || rgba(companyBrand.primary, 0.28),
    })),
    leftDetailGroups: officialDetailGroups || null,
    officialRevenueStyle: inferredOfficialRevenueStyle(company, entry, officialBusinessGroups || entry.officialRevenueSegments || []) || null,
    displayCurrency: entry.displayCurrency || snapshot.displayCurrency,
    displayScaleFactor: entry.displayScaleFactor || snapshot.displayScaleFactor || 1,
    compactSourceLabels: entry.officialRevenueStyle === "netflix-regional-revenue" ? true : snapshot.compactSourceLabels,
    mode: "replica-template",
    modeLabel: "高精复刻版",
    sourceLabel: officialBusinessGroups ? "Official filings segment data" : fallbackSourceLabel,
    coverageLabel: "结构原型 + 高精模板",
    subtitle: officialBusinessGroups
      ? "Replica-style layout auto-generated from quarterly statement data and official filing segment disclosures."
      : fallbackSubtitle,
    footnote: officialBusinessGroups
      ? "统一模板会复用模板集的版式语言，并优先使用官方财报披露的营收结构数据自动排版。"
      : fallbackFootnote,
  };
}

function mergeOfficialRevenueStructureIntoSnapshot(snapshot, company, entry) {
  if (!entry) return snapshot;
  const officialBusinessGroups = buildOfficialBusinessGroups(company, entry);
  const officialDetailGroups = buildOfficialDetailGroups(company, entry, officialBusinessGroups);
  if (!officialBusinessGroups && !officialDetailGroups) return snapshot;
  return {
    ...snapshot,
    businessGroups: officialBusinessGroups || snapshot.businessGroups,
    leftDetailGroups: officialDetailGroups || snapshot.leftDetailGroups || null,
    officialRevenueStyle: inferredOfficialRevenueStyle(company, entry, officialBusinessGroups || entry.officialRevenueSegments || []) || snapshot.officialRevenueStyle || null,
    displayCurrency: entry.displayCurrency || snapshot.displayCurrency,
    displayScaleFactor: entry.displayScaleFactor || snapshot.displayScaleFactor || 1,
    sourceLabel: "Official filings segment data",
    coverageLabel: "结构原型 + 高精模板",
  };
}

function buildSnapshot(company, quarterKey) {
  const entry = company.financials?.[quarterKey];
  const preset = company.statementPresets?.[quarterKey];
  if (!entry && !preset) return null;
  if (preset) {
    return applyTemplateTokensToSnapshot(
      applyPrototypeLanguage(
        mergeOfficialRevenueStructureIntoSnapshot(
          {
            ...preset,
            mode: "pixel-replica",
            modeLabel: "高精复刻版",
            sourceLabel: "Calibrated prototype + quarterly statement",
            coverageLabel: "结构原型 + 高精模板",
            companyName: company.nameEn,
            companyDisplayName: companyDisplay(company),
            ticker: company.ticker,
            quarterKey,
            fiscalLabel: entry?.fiscalLabel || preset.quarterSummary || quarterKey,
            revenueQoqPct: preset.revenueQoqPct ?? entry?.revenueQoqPct ?? null,
          },
          company,
          entry
        ),
        company,
        entry
      ),
      company
    );
  }
  if (entry) {
    return applyTemplateTokensToSnapshot(applyPrototypeLanguage(buildReplicaTemplateSnapshot(company, entry, quarterKey), company, entry), company);
  }
  return null;
}

function entryHasSuspiciousOperatingStageMismatch(primaryEntry, fallbackEntry = null) {
  if (!fallbackEntry) return false;
  const compareWithinTolerance = (leftValue, rightValue, baseTolerance = 0.12, relativeFactor = 0.012) => {
    if (leftValue === null || leftValue === undefined || rightValue === null || rightValue === undefined) return true;
    const left = safeNumber(leftValue);
    const right = safeNumber(rightValue);
    return Math.abs(left - right) <= Math.max(baseTolerance, Math.max(Math.abs(left), Math.abs(right)) * relativeFactor);
  };
  const revenueAligned = compareWithinTolerance(primaryEntry?.revenueBn, fallbackEntry?.revenueBn, 0.12, 0.006);
  const grossAligned = compareWithinTolerance(primaryEntry?.grossProfitBn, fallbackEntry?.grossProfitBn, 0.12, 0.008);
  const pretaxAligned = compareWithinTolerance(primaryEntry?.pretaxIncomeBn, fallbackEntry?.pretaxIncomeBn, 0.18, 0.012);
  const taxAligned = compareWithinTolerance(primaryEntry?.taxBn, fallbackEntry?.taxBn, 0.18, 0.02);
  const netAligned = compareWithinTolerance(primaryEntry?.netIncomeBn, fallbackEntry?.netIncomeBn, 0.18, 0.012);
  if (!(revenueAligned && grossAligned && pretaxAligned && taxAligned && netAligned)) {
    return false;
  }
  const fallbackGrossProfitBn = safeNumber(fallbackEntry?.grossProfitBn, null);
  const fallbackOperatingExpensesBn = safeNumber(fallbackEntry?.operatingExpensesBn, null);
  const fallbackOperatingIncomeBn = safeNumber(fallbackEntry?.operatingIncomeBn, null);
  if (
    fallbackGrossProfitBn === null ||
    fallbackOperatingExpensesBn === null ||
    fallbackOperatingIncomeBn === null
  ) {
    return false;
  }
  const fallbackExpectedOperatingExpensesBn = Math.max(fallbackGrossProfitBn - fallbackOperatingIncomeBn, 0);
  const fallbackBridgeSane =
    Math.abs(fallbackOperatingExpensesBn - fallbackExpectedOperatingExpensesBn) <=
    Math.max(0.35, fallbackGrossProfitBn * 0.03);
  if (!fallbackBridgeSane) {
    return false;
  }
  const primaryOperatingExpensesBn = safeNumber(primaryEntry?.operatingExpensesBn, null);
  const primaryOperatingIncomeBn = safeNumber(primaryEntry?.operatingIncomeBn, null);
  const primaryNonOperatingBn = safeNumber(primaryEntry?.nonOperatingBn, null);
  const fallbackNonOperatingBn = safeNumber(fallbackEntry?.nonOperatingBn, null);
  const operatingExpensesGap =
    primaryOperatingExpensesBn === null
      ? 0
      : Math.abs(primaryOperatingExpensesBn - fallbackOperatingExpensesBn);
  const operatingIncomeGap =
    primaryOperatingIncomeBn === null
      ? 0
      : Math.abs(primaryOperatingIncomeBn - fallbackOperatingIncomeBn);
  const nonOperatingGap =
    primaryNonOperatingBn === null || fallbackNonOperatingBn === null
      ? 0
      : Math.abs(primaryNonOperatingBn - fallbackNonOperatingBn);
  const operatingExpensesMismatch =
    primaryOperatingExpensesBn !== null &&
    operatingExpensesGap > Math.max(1.2, Math.abs(fallbackOperatingExpensesBn) * 0.24);
  const operatingIncomeMismatch =
    primaryOperatingIncomeBn !== null &&
    operatingIncomeGap > Math.max(1.2, Math.abs(fallbackOperatingIncomeBn) * 0.24 + 0.4);
  const nonOperatingMismatch =
    primaryNonOperatingBn !== null &&
    fallbackNonOperatingBn !== null &&
    nonOperatingGap > Math.max(1.2, Math.abs(fallbackNonOperatingBn) * 0.4 + 0.4);
  return operatingExpensesMismatch || operatingIncomeMismatch || nonOperatingMismatch;
}

function mergeFinancialEntryFallback(primaryEntry, fallbackEntry) {
  if (!primaryEntry) return fallbackEntry ? { ...fallbackEntry } : primaryEntry;
  if (!fallbackEntry) return primaryEntry;
  const mergedEntry = { ...fallbackEntry, ...primaryEntry };
  Object.entries(fallbackEntry).forEach(([key, value]) => {
    const primaryValue = primaryEntry[key];
    if ((primaryValue === null || primaryValue === undefined || Number.isNaN(primaryValue)) && value !== null && value !== undefined) {
      mergedEntry[key] = value;
    }
  });
  const primaryMissingGrossStage =
    (primaryEntry.costOfRevenueBn === null || primaryEntry.costOfRevenueBn === undefined) &&
    (primaryEntry.grossProfitBn === null || primaryEntry.grossProfitBn === undefined);
  const fallbackHasCompleteBridge =
    fallbackEntry.revenueBn !== null &&
    fallbackEntry.revenueBn !== undefined &&
    fallbackEntry.costOfRevenueBn !== null &&
    fallbackEntry.costOfRevenueBn !== undefined &&
    fallbackEntry.grossProfitBn !== null &&
    fallbackEntry.grossProfitBn !== undefined;
  const primaryRevenueBn = safeNumber(primaryEntry.revenueBn, null);
  const primaryOpexBn = safeNumber(primaryEntry.operatingExpensesBn, null);
  const officialSegmentTotalBn = Array.isArray(primaryEntry.officialRevenueSegments)
    ? primaryEntry.officialRevenueSegments.reduce((sum, item) => sum + Math.max(safeNumber(item?.valueBn), 0), 0)
    : 0;
  const primaryBridgeLooksBroken =
    (primaryRevenueBn !== null && primaryOpexBn !== null && primaryOpexBn > primaryRevenueBn + 0.25) ||
    (primaryRevenueBn !== null && officialSegmentTotalBn > primaryRevenueBn + Math.max(0.25, primaryRevenueBn * 0.08));
  const primaryOperatingStageMismatch = entryHasSuspiciousOperatingStageMismatch(primaryEntry, fallbackEntry);
  if (primaryMissingGrossStage && fallbackHasCompleteBridge && primaryBridgeLooksBroken) {
    [
      "revenueBn",
      "revenueYoyPct",
      "revenueQoqPct",
      "costOfRevenueBn",
      "grossProfitBn",
      "grossMarginPct",
      "grossMarginYoyDeltaPp",
      "sgnaBn",
      "rndBn",
      "otherOpexBn",
      "operatingExpensesBn",
      "operatingIncomeBn",
      "operatingMarginPct",
      "operatingMarginYoyDeltaPp",
      "nonOperatingBn",
      "pretaxIncomeBn",
      "taxBn",
      "netIncomeBn",
      "netIncomeYoyPct",
      "profitMarginPct",
      "profitMarginYoyDeltaPp",
      "effectiveTaxRatePct",
    ].forEach((key) => {
      const fallbackValue = fallbackEntry[key];
      if (fallbackValue !== null && fallbackValue !== undefined && !Number.isNaN(Number(fallbackValue))) {
        mergedEntry[key] = fallbackValue;
      }
    });
    mergedEntry.statementSource = `${primaryEntry.statementSource || "official"}+financial-fallback`;
  }
  if (primaryOperatingStageMismatch) {
    [
      "sgnaBn",
      "rndBn",
      "otherOpexBn",
      "operatingExpensesBn",
      "operatingIncomeBn",
      "operatingMarginPct",
      "operatingMarginYoyDeltaPp",
      "nonOperatingBn",
      "pretaxIncomeBn",
      "taxBn",
      "netIncomeBn",
      "netIncomeYoyPct",
      "profitMarginPct",
      "profitMarginYoyDeltaPp",
      "effectiveTaxRatePct",
    ].forEach((key) => {
      const fallbackValue = fallbackEntry[key];
      if (fallbackValue !== null && fallbackValue !== undefined && !Number.isNaN(Number(fallbackValue))) {
        mergedEntry[key] = fallbackValue;
      }
    });
    mergedEntry.statementSource = `${primaryEntry.statementSource || "official"}+operating-stage-fallback`;
  }
  return mergedEntry;
}

function mergeCompanyFinancialFallback(company, fallbackCompany) {
  if (!fallbackCompany?.financials) return company;
  const quarterKeys = [...new Set([...(company.quarters || []), ...(fallbackCompany.quarters || [])])].sort();
  const mergedFinancials = {};
  quarterKeys.forEach((quarterKey) => {
    const primaryEntry = company.financials?.[quarterKey];
    const fallbackEntry = fallbackCompany.financials?.[quarterKey];
    const mergedEntry = mergeFinancialEntryFallback(primaryEntry, fallbackEntry);
    if (mergedEntry) {
      mergedFinancials[quarterKey] = mergedEntry;
    }
  });
  return {
    ...company,
    quarters: quarterKeys,
    financials: mergedFinancials,
  };
}

async function enrichDatasetWithFinancialFallbacks() {
  if (!state.sortedCompanies.length) return;
  const enrichedCompanies = await Promise.all(
    state.sortedCompanies.map(async (company) => {
      try {
        const response = await fetchJson(`./data/cache/${company.id}.json?v=${BUILD_ASSET_VERSION}`);
        if (!response.ok) return company;
        const fallbackCompany = await response.json();
        return mergeCompanyFinancialFallback(company, fallbackCompany);
      } catch (_error) {
        return company;
      }
    })
  );
  state.sortedCompanies = enrichedCompanies.map((company, index) => normalizeLoadedCompany(company, index)).sort((left, right) => left.rank - right.rank);
  state.companyById = Object.fromEntries(state.sortedCompanies.map((company) => [company.id, company]));
  if (state.dataset) {
    state.dataset.companies = state.sortedCompanies;
  }
}

function renderCoverage() {
  return;
}

const BAR_SEGMENT_COLOR_POOL = [
  "#2B8AE8",
  "#F6B400",
  "#17B890",
  "#F05D5E",
  "#8A63D2",
  "#2D9CDB",
  "#F2994A",
  "#27AE60",
  "#6D5BD0",
  "#5B6472",
];

const BAR_COMPANY_PALETTE_OVERRIDES = Object.freeze({
  microsoft: Object.freeze([
    "#00A4EF",
    "#7FBA00",
    "#FFB900",
    "#F25022",
    "#6B7280",
    "#2F6E5A",
    "#2E5CB8",
    "#B15B3E",
  ]),
  apple: Object.freeze([
    "#616975",
    "#2F6BD8",
    "#E5A52C",
    "#5A9D7D",
    "#7A69B2",
    "#A3ADBA",
    "#3A4E7A",
    "#9C6F3C",
  ]),
  amazon: Object.freeze([
    "#146EB4",
    "#FF9900",
    "#1FA8A2",
    "#5B6472",
    "#7B57D1",
    "#2E7D32",
    "#F6A23B",
    "#2B8AE8",
  ]),
  broadcom: Object.freeze([
    "#D62828",
    "#1F4DBD",
    "#20A39E",
    "#F4A259",
    "#7358D8",
    "#5B6472",
    "#2E8F63",
    "#F05D5E",
  ]),
  tencent: Object.freeze([
    "#1D9BF0",
    "#13A9B8",
    "#F4B400",
    "#6B7280",
    "#34A853",
    "#7A5AF5",
    "#FF7A59",
    "#2F6BD8",
  ]),
  visa: Object.freeze([
    "#1434CB",
    "#F7B600",
    "#2D9CDB",
    "#5B6472",
    "#3E63DD",
    "#F2994A",
    "#17B890",
    "#6D5BD0",
  ]),
});

const BAR_SEGMENT_CANONICAL_BY_COMPANY = Object.freeze({
  alphabet: Object.freeze({
    googleinc: "googleservices",
    googleservices: "googleservices",
    allothersegments: "othersegments",
    othersegments: "othersegments",
    otherrevenue: "otherrevenue",
    other: "otherrevenue",
  }),
  jnj: Object.freeze({
    pharmaceutical: "innovativemedicine",
    medicaldevices: "medtech",
    medicaldevicesdiagnostics: "medtech",
  }),
  berkshire: Object.freeze({
    serviceandretailingbusinesses: "serviceretailbusinesses",
    serviceandretailbusinesses: "serviceretailbusinesses",
  }),
  tesla: Object.freeze({
    automotive: "auto",
    automotivebusiness: "auto",
    automobile: "auto",
  }),
  costco: Object.freeze({
    foodsundries: "foodssundries",
    freshfood: "freshfoods",
  }),
  micron: Object.freeze({
    cnbu: "microncomputedatacenter",
    cdbu: "microncomputedatacenter",
    mbu: "micronmobileclient",
    mcbu: "micronmobileclient",
    sbu: "micronstoragecloudmemory",
    cmbu: "micronstoragecloudmemory",
    ebu: "micronautoembedded",
    aebu: "micronautoembedded",
    allothersegments: "othersegments",
  }),
});

const BAR_SEGMENT_LABEL_OVERRIDES = Object.freeze({
  googleservices: Object.freeze({ name: "Google Services", nameZh: "Google 服务" }),
  othersegments: Object.freeze({ name: "Other segments", nameZh: "其他分部" }),
  otherrevenue: Object.freeze({ name: "Other revenue", nameZh: "其他营收" }),
  microncomputedatacenter: Object.freeze({ name: "Compute & Data Center", nameZh: "计算与数据中心" }),
  micronmobileclient: Object.freeze({ name: "Mobile & Client", nameZh: "移动与客户端" }),
  micronstoragecloudmemory: Object.freeze({ name: "Storage & Cloud Memory", nameZh: "存储与云内存" }),
  micronautoembedded: Object.freeze({ name: "Auto & Embedded", nameZh: "汽车与嵌入式" }),
  alibabacommerce: Object.freeze({ name: "Commerce", nameZh: "商业" }),
  alibabacloud: Object.freeze({ name: "Cloud", nameZh: "云业务" }),
  alibabaothers: Object.freeze({ name: "All others", nameZh: "其他业务" }),
  innovativemedicine: Object.freeze({ name: "Innovative Medicine", nameZh: "创新药" }),
  medtech: Object.freeze({ name: "Med Tech", nameZh: "医疗科技" }),
  serviceretailbusinesses: Object.freeze({ name: "Service & Retail businesses", nameZh: "服务与零售业务" }),
  iphone: Object.freeze({ name: "iPhone", nameZh: "iPhone" }),
  mac: Object.freeze({ name: "Mac", nameZh: "Mac" }),
  ipad: Object.freeze({ name: "iPad", nameZh: "iPad" }),
  wearables: Object.freeze({ name: "Wearables", nameZh: "可穿戴设备" }),
  auto: Object.freeze({ name: "Automotive", nameZh: "汽车业务" }),
  energygenerationstorage: Object.freeze({ name: "Energy generation & storage", nameZh: "能源发电与储能" }),
});

const BAR_SEGMENT_COLOR_SLOT_OVERRIDES = Object.freeze({
  microncomputedatacenter: 0,
  micronmobileclient: 1,
  micronstoragecloudmemory: 2,
  micronautoembedded: 3,
  alibabacommerce: 0,
  alibabacloud: 1,
  alibabaothers: 2,
  intelligentcloud: 0,
  productivitybusinessprocesses: 1,
  productivityandbusinessprocesses: 1,
  morepersonalcomputing: 2,
  products: 0,
  services: 1,
  googleservices: 1,
  adrevenue: 0,
  googlecloud: 3,
  googleplay: 2,
  othersegments: 3,
  __other_segments__: 3,
  otherrevenue: 6,
  reportedrevenue: 2,
  iphone: 0,
  mac: 2,
  ipad: 3,
  wearables: 4,
  familyofapps: 0,
  realitylabs: 5,
  onlineadvertisingservices: 0,
  cloudservices: 3,
  networkservices: 2,
  energyproducts: 1,
  onlinestores: 0,
  thirdpartysellerservices: 2,
  amazonwebservices: 1,
  subscriptionservices: 4,
  advertisingservices: 5,
  physicalstores: 6,
  otherservices: 7,
  semiconductorsolutions: 0,
  infrastructuresoftware: 1,
  iplicensing: 2,
  valueaddedservices: 0,
  fintechandbusinessservices: 1,
  marketingservices: 2,
  others: 3,
});

const BAR_SEGMENT_COLOR_SLOT_OVERRIDES_BY_COMPANY = Object.freeze({
  visa: Object.freeze({
    dataprocessingrevenues: 0,
    internationaltransactionrevenues: 1,
    valueaddedservices: 2,
  }),
});

const BAR_RESIDUAL_INFERENCE_CONFLICTS = Object.freeze({
  alphabet: Object.freeze({
    googleinc: Object.freeze(["adrevenue", "googleplay"]),
    googleservices: Object.freeze(["adrevenue", "googleplay"]),
  }),
});

function canonicalBarSegmentKey(companyId, rawKey, rawName = "") {
  const normalizedCompanyId = String(companyId || "").trim().toLowerCase();
  const normalizedKey = normalizeLabelKey(rawKey || rawName);
  if (!normalizedKey) return normalizedKey;
  const companyAliases = BAR_SEGMENT_CANONICAL_BY_COMPANY[normalizedCompanyId] || null;
  if (companyAliases && companyAliases[normalizedKey]) {
    return companyAliases[normalizedKey];
  }
  return normalizedKey;
}

function canonicalBarSegmentMeta(companyId, canonicalKey, fallbackName, fallbackNameZh = "") {
  const normalizedCompanyId = String(companyId || "").trim().toLowerCase();
  const key = canonicalBarSegmentKey(normalizedCompanyId, canonicalKey, fallbackName);
  const override = BAR_SEGMENT_LABEL_OVERRIDES[key];
  if (override) return override;
  return {
    name: fallbackName || "Segment",
    nameZh: fallbackNameZh || translateBusinessLabelToZh(fallbackName || "Segment"),
  };
}

function hashStringDeterministic(text) {
  const value = String(text || "");
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash >>> 0;
}

function normalizeBarPaletteColor(hexColor) {
  const raw = String(hexColor || "").trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(raw)) return null;
  const rgb = parseHexColor(raw);
  if (!rgb) return null;
  const channelSpread = Math.max(rgb.r, rgb.g, rgb.b) - Math.min(rgb.r, rgb.g, rgb.b);
  const isNearNeutral = channelSpread < 14;
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  let toned = raw;
  if (hsl) {
    if (isNearNeutral) {
      toned = hslToHex(hsl.h, clamp(hsl.s, 0, 0.12), clamp(hsl.l, 0.24, 0.64));
    } else {
      toned = hslToHex(hsl.h, clamp(Math.max(hsl.s, 0.42), 0.42, 0.88), clamp(hsl.l, 0.28, 0.72));
    }
  }
  const lum = relativeLuminance(toned);
  if (lum > 0.74) return mixHex(toned, "#1F2937", 0.2);
  if (lum < 0.09) return mixHex(toned, "#FFFFFF", 0.22);
  return toned;
}

function uniqueBarPalette(colors = []) {
  const unique = [];
  const used = new Set();
  (colors || []).forEach((color) => {
    const normalized = normalizeBarPaletteColor(color);
    if (!normalized || used.has(normalized)) return;
    used.add(normalized);
    unique.push(normalized);
  });
  return unique;
}

function rgbToHsl(r, g, b) {
  const rn = clamp(r / 255, 0, 1);
  const gn = clamp(g / 255, 0, 1);
  const bn = clamp(b / 255, 0, 1);
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (delta > 0.000001) {
    s = delta / (1 - Math.abs(2 * l - 1));
    if (max === rn) h = 60 * (((gn - bn) / delta) % 6);
    else if (max === gn) h = 60 * ((bn - rn) / delta + 2);
    else h = 60 * ((rn - gn) / delta + 4);
  }
  if (h < 0) h += 360;
  return { h, s, l };
}

function hslToHex(h, s, l) {
  const hue = ((safeNumber(h) % 360) + 360) % 360;
  const sat = clamp(safeNumber(s), 0, 1);
  const lig = clamp(safeNumber(l), 0, 1);
  const c = (1 - Math.abs(2 * lig - 1)) * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = lig - c / 2;
  let rp = 0;
  let gp = 0;
  let bp = 0;
  if (hue < 60) [rp, gp, bp] = [c, x, 0];
  else if (hue < 120) [rp, gp, bp] = [x, c, 0];
  else if (hue < 180) [rp, gp, bp] = [0, c, x];
  else if (hue < 240) [rp, gp, bp] = [0, x, c];
  else if (hue < 300) [rp, gp, bp] = [x, 0, c];
  else [rp, gp, bp] = [c, 0, x];
  const toHex = (unit) => Math.round((unit + m) * 255).toString(16).padStart(2, "0");
  return `#${toHex(rp)}${toHex(gp)}${toHex(bp)}`;
}

function colorToHsl(hexColor) {
  const rgb = parseHexColor(hexColor);
  if (!rgb) return null;
  return rgbToHsl(rgb.r, rgb.g, rgb.b);
}

function rotateColorHue(hexColor, deltaHue = 180) {
  const hsl = colorToHsl(hexColor);
  if (!hsl) return hexColor;
  return hslToHex(hsl.h + deltaHue, hsl.s, hsl.l);
}

function hueDistanceDegrees(leftHue, rightHue) {
  const raw = Math.abs(safeNumber(leftHue) - safeNumber(rightHue));
  return Math.min(raw, 360 - raw);
}

function barColorsAreTooSimilar(leftColor, rightColor, options = {}) {
  const leftHsl = colorToHsl(leftColor);
  const rightHsl = colorToHsl(rightColor);
  if (!leftHsl || !rightHsl) return false;
  const hueGap = hueDistanceDegrees(leftHsl.h, rightHsl.h);
  const satGap = Math.abs(leftHsl.s - rightHsl.s);
  const lumGap = Math.abs(leftHsl.l - rightHsl.l);
  const minHueDistance = safeNumber(options.minHueDistance, 20);
  const minSatDistance = safeNumber(options.minSatDistance, 0.16);
  const minLightnessDistance = safeNumber(options.minLightnessDistance, 0.16);
  if (hueGap < Math.max(10, minHueDistance * 0.65) && satGap < Math.max(0.1, minSatDistance * 0.9) && lumGap < Math.max(0.22, minLightnessDistance * 1.5)) {
    return true;
  }
  return hueGap < minHueDistance && satGap < minSatDistance && lumGap < minLightnessDistance;
}

function pushPaletteColorWithContrast(palette, color, minHueDistance = 16, minLumaDistance = 0.05) {
  const normalized = normalizeBarPaletteColor(color);
  if (!normalized || palette.includes(normalized)) return;
  const candidateHsl = colorToHsl(normalized);
  const candidateLum = relativeLuminance(normalized);
  if (!candidateHsl) {
    palette.push(normalized);
    return;
  }
  const tooClose = palette.some((existing) => {
    const existingHsl = colorToHsl(existing);
    if (!existingHsl) return false;
    const hueGap = hueDistanceDegrees(candidateHsl.h, existingHsl.h);
    const satGap = Math.abs(candidateHsl.s - existingHsl.s);
    const lumGap = Math.abs(candidateLum - relativeLuminance(existing));
    return (
      (hueGap < minHueDistance && satGap < 0.12 && lumGap < minLumaDistance) ||
      barColorsAreTooSimilar(normalized, existing, {
        minHueDistance: Math.max(minHueDistance, 18),
        minSatDistance: 0.16,
        minLightnessDistance: Math.max(minLumaDistance * 2.2, 0.14),
      })
    );
  });
  if (!tooClose) {
    palette.push(normalized);
  }
}

function companyBrandBarPalette(companyId, minCount = 8) {
  const companyKey = String(companyId || "").trim().toLowerCase();
  const overridePalette = BAR_COMPANY_PALETTE_OVERRIDES[companyKey];
  if (Array.isArray(overridePalette) && overridePalette.length) {
    const mergedOverride = uniqueBarPalette([...overridePalette, ...BAR_SEGMENT_COLOR_POOL]);
    while (mergedOverride.length < minCount) {
      const idx = mergedOverride.length % BAR_SEGMENT_COLOR_POOL.length;
      pushPaletteColorWithContrast(mergedOverride, BAR_SEGMENT_COLOR_POOL[idx], 10, 0.03);
    }
    return mergedOverride;
  }

  const company = getCompany(companyId) || null;
  const primary = normalizeBarPaletteColor(company?.brand?.primary || "#1CA1E2") || "#1CA1E2";
  const secondary = normalizeBarPaletteColor(company?.brand?.secondary || mixHex(primary, "#F6B800", 0.38)) || "#F6B800";
  const accentBase = normalizeBarPaletteColor(company?.brand?.accent || mixHex(primary, "#FFFFFF", 0.55)) || "#7D7D80";
  const accent = relativeLuminance(accentBase) > 0.72 ? mixHex(accentBase, "#374151", 0.34) : accentBase;
  const seed = hashStringDeterministic(String(companyId || "global"));
  const complementary = rotateColorHue(primary, 180);
  const splitA = rotateColorHue(primary, 145);
  const splitB = rotateColorHue(primary, -145);
  const warmCompanion = mixHex(complementary, "#F59E0B", 0.55);
  const coolCompanion = mixHex(primary, "#14B8A6", 0.5);
  const neutralCompanion = mixHex(secondary, "#94A3B8", 0.35);
  const punchCompanion = mixHex(primary, "#EF4444", 0.36);
  const bridgeCompanion = mixHex(primary, secondary, 0.52);
  const rotatingPool = BAR_SEGMENT_COLOR_POOL.map((_, index) => BAR_SEGMENT_COLOR_POOL[(seed + index * 3) % BAR_SEGMENT_COLOR_POOL.length]);
  const palette = [];
  [primary, secondary, accent, complementary, splitA, splitB, warmCompanion, coolCompanion, neutralCompanion, punchCompanion, bridgeCompanion, ...rotatingPool].forEach(
    (color) => pushPaletteColorWithContrast(palette, color, 18, 0.06)
  );
  while (palette.length < minCount) {
    const idx = palette.length % BAR_SEGMENT_COLOR_POOL.length;
    pushPaletteColorWithContrast(palette, BAR_SEGMENT_COLOR_POOL[idx], 10, 0.03);
    if (palette.length < minCount) {
      pushPaletteColorWithContrast(palette, mixHex(BAR_SEGMENT_COLOR_POOL[idx], "#FFFFFF", 0.12), 10, 0.03);
    }
  }
  return palette;
}

function stableBarColorMap(companyId, segmentKeys = []) {
  const normalizedCompanyId = String(companyId || "").trim().toLowerCase();
  const usedColors = [];
  const colorMap = {};
  const orderedKeys = [...new Set(segmentKeys.filter(Boolean))];
  const brandPalette = companyBrandBarPalette(normalizedCompanyId, Math.max(orderedKeys.length + 2, 8));
  const companySlotOverrides = BAR_SEGMENT_COLOR_SLOT_OVERRIDES_BY_COMPANY[normalizedCompanyId] || null;
  const canUseCandidateColor = (candidateColor) =>
    !!candidateColor &&
    !usedColors.includes(candidateColor) &&
    !usedColors.some((existingColor) => barColorsAreTooSimilar(candidateColor, existingColor));
  orderedKeys.forEach((segmentKey) => {
    const preferredSlot = companySlotOverrides?.[segmentKey] ?? BAR_SEGMENT_COLOR_SLOT_OVERRIDES[segmentKey];
    if (preferredSlot === null || preferredSlot === undefined) return;
    const candidate = brandPalette[preferredSlot % brandPalette.length];
    if (!canUseCandidateColor(candidate)) return;
    colorMap[segmentKey] = candidate;
    usedColors.push(candidate);
  });
  const primaryKey = orderedKeys[0];
  if (primaryKey && !colorMap[primaryKey]) {
    for (let index = 0; index < brandPalette.length; index += 1) {
      const candidate = brandPalette[index];
      if (!canUseCandidateColor(candidate)) continue;
      colorMap[primaryKey] = candidate;
      usedColors.push(candidate);
      break;
    }
    if (!colorMap[primaryKey]) {
      for (let index = 0; index < brandPalette.length; index += 1) {
        const candidate = brandPalette[index];
        if (!candidate || usedColors.includes(candidate)) continue;
        colorMap[primaryKey] = candidate;
        usedColors.push(candidate);
        break;
      }
    }
    if (!colorMap[primaryKey]) {
      colorMap[primaryKey] = brandPalette[0];
      usedColors.push(brandPalette[0]);
    }
  }
  orderedKeys.forEach((segmentKey) => {
    if (colorMap[segmentKey]) return;
    const seed = hashStringDeterministic(`${normalizedCompanyId || "global"}:${segmentKey}`);
    for (let offset = 0; offset < brandPalette.length; offset += 1) {
      const color = brandPalette[(seed + offset) % brandPalette.length];
      if (canUseCandidateColor(color)) {
        colorMap[segmentKey] = color;
        usedColors.push(color);
        return;
      }
    }
    for (let offset = 0; offset < brandPalette.length; offset += 1) {
      const color = brandPalette[(seed + offset) % brandPalette.length];
      if (!usedColors.includes(color)) {
        colorMap[segmentKey] = color;
        usedColors.push(color);
        return;
      }
    }
    colorMap[segmentKey] = brandPalette[seed % brandPalette.length];
  });
  return colorMap;
}

function parseHexColor(value) {
  const normalized = String(value || "").trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null;
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function srgbToLinear(value) {
  const unit = value / 255;
  return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hexColor) {
  const rgb = parseHexColor(hexColor);
  if (!rgb) return 0;
  return 0.2126 * srgbToLinear(rgb.r) + 0.7152 * srgbToLinear(rgb.g) + 0.0722 * srgbToLinear(rgb.b);
}

function barSegmentTextColor(fillColor) {
  return relativeLuminance(fillColor) > 0.52 ? "#0F3552" : "#FFFFFF";
}

function formatBarQuarterLabel(entry, quarterKey) {
  const compactLabel = compactFiscalLabel(entry?.fiscalLabel || "");
  if (compactLabel) return compactLabel;
  const match = /^(\d{4})Q([1-4])$/.exec(quarterKey || "");
  if (!match) return quarterKey || "";
  return `Q${match[2]} FY${match[1].slice(-2)}`;
}

function localizedBarSegmentName(item) {
  if (!item) return "";
  if (currentChartLanguage() === "zh") {
    return item.nameZh || translateBusinessLabelToZh(item.name || "");
  }
  return String(item.name || "");
}

function roundedTopRectPath(x, y, width, height, radius) {
  const r = clamp(radius, 0, Math.min(width / 2, height));
  return [
    `M ${x} ${y + height}`,
    `L ${x} ${y + r}`,
    `Q ${x} ${y} ${x + r} ${y}`,
    `L ${x + width - r} ${y}`,
    `Q ${x + width} ${y} ${x + width} ${y + r}`,
    `L ${x + width} ${y + height}`,
    "Z",
  ].join(" ");
}

function roundedBottomRectPath(x, y, width, height, radius) {
  const r = clamp(radius, 0, Math.min(width / 2, height));
  return [
    `M ${x} ${y}`,
    `L ${x} ${y + height - r}`,
    `Q ${x} ${y + height} ${x + r} ${y + height}`,
    `L ${x + width - r} ${y + height}`,
    `Q ${x + width} ${y + height} ${x + width} ${y + height - r}`,
    `L ${x + width} ${y}`,
    "Z",
  ].join(" ");
}

function stackedBarSegmentElement(x, y, width, height, radius, isTop, isBottom, fillColor) {
  if (isTop && isBottom) {
    const r = clamp(radius, 0, Math.min(width / 2, height / 2));
    return `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${width.toFixed(2)}" height="${height.toFixed(2)}" rx="${r.toFixed(2)}" fill="${fillColor}"></rect>`;
  }
  if (isTop) {
    return `<path d="${roundedTopRectPath(x, y, width, height, radius)}" fill="${fillColor}"></path>`;
  }
  if (isBottom) {
    return `<path d="${roundedBottomRectPath(x, y, width, height, radius)}" fill="${fillColor}"></path>`;
  }
  return `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${width.toFixed(2)}" height="${height.toFixed(2)}" fill="${fillColor}"></rect>`;
}

function resolveBarQuarterDisplayConfig(company, entry = null, structurePayload = null) {
  const fromEntryScale = safeNumber(entry?.displayScaleFactor, null);
  const fromStructureScale = safeNumber(structurePayload?.displayScaleFactor, null);
  const scaleFactor = fromEntryScale > 0 ? fromEntryScale : fromStructureScale > 0 ? fromStructureScale : 1;
  const displayCurrency =
    String(entry?.displayCurrency || structurePayload?.displayCurrency || entry?.statementCurrency || company?.reportingCurrency || "USD").toUpperCase() || "USD";
  const sourceCurrency = String(entry?.statementCurrency || company?.reportingCurrency || displayCurrency || "USD").toUpperCase() || displayCurrency || "USD";
  return {
    displayScaleFactor: scaleFactor,
    displayCurrency,
    sourceCurrency,
  };
}

function scaleBarSegmentRows(rows = [], scaleFactor = 1) {
  const scale = safeNumber(scaleFactor, 1);
  return (rows || []).map((item) => ({
    ...item,
    valueBn: Number((safeNumber(item.valueBn) * scale).toFixed(3)),
  }));
}

function parseIsoDateToUtcMs(value) {
  const text = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const utcMs = Date.parse(`${text}T00:00:00Z`);
  return Number.isFinite(utcMs) ? utcMs : null;
}

function medianNumber(values = []) {
  const numeric = [...(values || [])].map((item) => safeNumber(item, null)).filter((item) => item !== null).sort((left, right) => left - right);
  if (!numeric.length) return null;
  const middle = Math.floor(numeric.length / 2);
  if (numeric.length % 2) return numeric[middle];
  return (numeric[middle - 1] + numeric[middle]) / 2;
}

function compareIsoDateStrings(leftValue, rightValue) {
  const leftMs = parseIsoDateToUtcMs(leftValue);
  const rightMs = parseIsoDateToUtcMs(rightValue);
  if (leftMs !== null && rightMs !== null) return leftMs - rightMs;
  if (leftMs !== null) return 1;
  if (rightMs !== null) return -1;
  const leftText = String(leftValue || "");
  const rightText = String(rightValue || "");
  if (leftText === rightText) return 0;
  return leftText > rightText ? 1 : -1;
}

function preferCanonicalBarSegmentRow(currentRow, candidateRow) {
  const filingComparison = compareIsoDateStrings(currentRow?.filingDate, candidateRow?.filingDate);
  if (filingComparison !== 0) return filingComparison < 0;
  const candidateValue = safeNumber(candidateRow?.valueBn);
  const currentValue = safeNumber(currentRow?.valueBn);
  if (Math.abs(candidateValue - currentValue) > 0.002) return candidateValue > currentValue;
  const currentNameLength = String(currentRow?.name || "").trim().length;
  const candidateNameLength = String(candidateRow?.name || "").trim().length;
  return candidateNameLength > currentNameLength;
}

function normalizeBarSourceRows(entry, rows = []) {
  const sourceRows = sanitizeOfficialStructureRows(entry, rows || []);
  if (!sourceRows.length) return [];
  const revenueBn = safeNumber(entry?.revenueBn, null);
  const positiveRows = sourceRows.filter((item) => safeNumber(item?.valueBn) > 0.001);
  if (!positiveRows.length) return [];
  const rawSum = positiveRows.reduce((sum, item) => sum + safeNumber(item?.valueBn), 0);
  const shareLikeByShape =
    revenueBn > 0.02 &&
    positiveRows.length >= 2 &&
    positiveRows.every((item) => safeNumber(item?.valueBn) >= 0 && safeNumber(item?.valueBn) <= 100.5) &&
    Math.abs(rawSum - 100) <= 4.5;
  const normalizedRows = positiveRows
    .map((item) => {
      const metricMode = normalizeLabelKey(item?.metricMode || "");
      const mixPct = safeNumber(item?.mixPct, null);
      const rawValue = safeNumber(item?.valueBn);
      const flowValue = safeNumber(item?.flowValueBn, rawValue);
      const shareLikeRow =
        revenueBn > 0.02 &&
        (metricMode === "share" || metricMode === "mix" || metricMode === "percentage" || (shareLikeByShape && rawValue <= 100.5));
      const resolvedSharePct = mixPct !== null && mixPct >= 0 && mixPct <= 100.5 ? mixPct : rawValue;
      const resolvedValueBn = shareLikeRow ? (revenueBn * resolvedSharePct) / 100 : flowValue;
      return {
        id: item.memberKey || item.id || item.name,
        name: item.name,
        nameZh: item.nameZh || translateBusinessLabelToZh(item.name || ""),
        valueBn: Number(safeNumber(resolvedValueBn).toFixed(3)),
        filingDate: item.filingDate || null,
        periodEnd: item.periodEnd || entry?.periodEnd || null,
      };
    })
    .filter((item) => safeNumber(item.valueBn) > 0.02);
  if (String(entry?.companyId || "").toLowerCase() === "micron") {
    return normalizeMicronBarRows(entry, normalizedRows);
  }
  if (String(entry?.companyId || "").toLowerCase() === "alibaba") {
    const comparableRows = buildAlibabaComparableBarRows(entry, normalizedRows);
    if (comparableRows.length >= 2) return comparableRows;
  }
  return normalizedRows;
}

function barSourceLagDaysMedian(entry, rows = []) {
  const fallbackPeriodEndMs = parseIsoDateToUtcMs(entry?.periodEnd);
  const lagDays = [...(rows || [])]
    .map((item) => {
      const filingMs = parseIsoDateToUtcMs(item?.filingDate);
      const periodEndMs = parseIsoDateToUtcMs(item?.periodEnd) || fallbackPeriodEndMs;
      if (!(filingMs && periodEndMs)) return null;
      return (filingMs - periodEndMs) / 86400000;
    })
    .filter((value) => value !== null && Number.isFinite(value));
  return medianNumber(lagDays);
}

function scoreBarSourceCandidate(entry, rows = []) {
  if (!rows.length) {
    return {
      score: -999,
      coverageRatio: null,
      topShare: null,
      lagMedianDays: null,
    };
  }
  const revenueBn = safeNumber(entry?.revenueBn, null);
  const segmentSum = rows.reduce((sum, item) => sum + safeNumber(item?.valueBn), 0);
  const count = rows.length;
  const aggregateLikeCount = rows.filter((item) => isAggregateLikeSegmentLabel(item?.name || "")).length;
  const topShare = segmentSum > 0.02 ? safeNumber(rows[0]?.valueBn) / segmentSum : 1;
  const coverageRatio = revenueBn > 0.02 ? segmentSum / revenueBn : null;
  const lagMedianDays = barSourceLagDaysMedian(entry, rows);
  let score = 0;
  score += count >= 2 ? 22 : -14;
  if (count >= 3) score += 5;
  if (count > 7) score -= (count - 7) * 4;
  if (count > 10) score -= (count - 10) * 5;
  if (coverageRatio !== null) {
    const coverageDelta = Math.abs(coverageRatio - 1);
    if (coverageDelta <= 0.08) score += 18;
    else if (coverageDelta <= 0.25) score += 10;
    else if (coverageRatio < 0.36 || coverageRatio > 1.4) score -= 18;
    else score += 2;
  }
  if (topShare > 0.84 && count >= 3) score -= 8;
  if (aggregateLikeCount >= 2 && count >= 4) score -= aggregateLikeCount * 4;
  if (lagMedianDays !== null) {
    if (lagMedianDays > 900) score -= 16;
    else if (lagMedianDays > 540) score -= 10;
    else if (lagMedianDays < -2) score -= 6;
    else if (lagMedianDays <= 260) score += 3;
  }
  return {
    score,
    coverageRatio,
    topShare,
    lagMedianDays,
  };
}

function expandBarDetailRows(company, entry, baseRows = []) {
  const detailRows = sanitizeOfficialStructureRows(entry, entry?.officialRevenueDetailGroups || [])
    .filter((item) => safeNumber(item?.valueBn) > 0.02);
  if (detailRows.length < 2 || !baseRows.length) return baseRows;
  const totalBaseValue = baseRows.reduce((sum, item) => sum + safeNumber(item?.valueBn), 0);
  const detailRowsByTarget = new Map();
  detailRows.forEach((item) => {
    const targetLabel = item.targetId || item.targetName || item.target || item.groupName || "";
    const targetRawKey = normalizeLabelKey(targetLabel);
    const targetKey = canonicalBarSegmentKey(company?.id, targetRawKey, targetLabel);
    if (!targetKey) return;
    if (!detailRowsByTarget.has(targetKey)) {
      detailRowsByTarget.set(targetKey, []);
    }
    detailRowsByTarget.get(targetKey).push(item);
  });

  let nextRows = [...baseRows];
  detailRowsByTarget.forEach((rows, targetKey) => {
    const targetIndex = nextRows.findIndex((item) => {
      const itemKey = item.key || canonicalBarSegmentKey(company?.id, normalizeLabelKey(item.id || item.name || ""), item.name || "");
      return itemKey === targetKey;
    });
    if (targetIndex < 0) return;
    const targetRow = nextRows[targetIndex];
    const targetValueBn = safeNumber(targetRow?.valueBn);
    if (!(targetValueBn > 0.02)) return;
    const cleanedRows = rows
      .filter((item) => !isAggregateLikeSegmentLabel(item?.name || ""))
      .map((item) => ({
        id: item.memberKey || item.id || item.name,
        name: item.name,
        nameZh: item.nameZh || translateBusinessLabelToZh(item.name || ""),
        valueBn: safeNumber(item.valueBn),
        filingDate: item.filingDate || null,
        periodEnd: item.periodEnd || entry?.periodEnd || null,
      }))
      .filter((item) => safeNumber(item?.valueBn) > 0.02)
      .sort((left, right) => safeNumber(right?.valueBn) - safeNumber(left?.valueBn));
    if (cleanedRows.length < 2) return;
    const detailValueBn = cleanedRows.reduce((sum, item) => sum + safeNumber(item?.valueBn), 0);
    const coverageRatio = detailValueBn / Math.max(targetValueBn, 0.001);
    const projectedRowCount = nextRows.length - 1 + cleanedRows.length;
    const targetShare = targetValueBn / Math.max(totalBaseValue, 0.001);
    const priorityTargetKeys = new Set(["products", "product", "adrevenue"]);
    const targetIsAggregateLike = isAggregateLikeSegmentLabel(targetRow?.name || "");
    const shouldExpand =
      projectedRowCount <= 7 &&
      coverageRatio >= 0.72 &&
      coverageRatio <= 1.08 &&
      (priorityTargetKeys.has(normalizeLabelKey(targetKey)) ||
        (targetIsAggregateLike && cleanedRows.length >= 3 && targetShare >= 0.28));
    if (!shouldExpand) return;
    nextRows.splice(targetIndex, 1, ...cleanedRows);
  });

  return nextRows.sort((left, right) => safeNumber(right?.valueBn) - safeNumber(left?.valueBn));
}

function reconcileBarSegmentRowsToRevenue(company, rows = [], totalRevenueBn = null, options = {}) {
  const revenueBn = safeNumber(totalRevenueBn, null);
  const inputRows = Array.isArray(rows) ? rows : [];
  const segmentSum = inputRows.reduce((sum, item) => sum + safeNumber(item?.valueBn), 0);
  const minCoverageForResidualAddition = clamp(safeNumber(options.minCoverageForResidualAddition, 0.36), 0.2, 0.94);
  if (!(revenueBn > 0.02) || !inputRows.length) {
    return {
      rows: inputRows,
      coverageRatio: revenueBn > 0.02 ? segmentSum / revenueBn : null,
      insufficientCoverage: false,
      reconciliationMode: "none",
    };
  }
  const coverageRatio = segmentSum / revenueBn;
  if (coverageRatio < minCoverageForResidualAddition) {
    return {
      rows: [],
      coverageRatio,
      insufficientCoverage: true,
      reconciliationMode: "coverage-too-low",
    };
  }
  let nextRows = inputRows.map((item) => ({ ...item, valueBn: safeNumber(item.valueBn) }));
  let reconciliationMode = "none";
  if (coverageRatio > 1.12 && segmentSum > 0.02) {
    const scale = revenueBn / segmentSum;
    nextRows = nextRows.map((item) => ({
      ...item,
      valueBn: Number((safeNumber(item.valueBn) * scale).toFixed(3)),
    }));
    reconciliationMode = "scaled-down";
  } else if (coverageRatio < 0.94) {
    const residualValue = revenueBn - segmentSum;
    if (residualValue > 0.03) {
      const residualKey = canonicalBarSegmentKey(company?.id, "otherrevenue", "Other revenue");
      const residualMeta = canonicalBarSegmentMeta(company?.id, residualKey, "Other revenue", "其他营收");
      const existingIndex = nextRows.findIndex((item) => item.key === residualKey);
      if (existingIndex >= 0) {
        nextRows[existingIndex].valueBn = Number((safeNumber(nextRows[existingIndex].valueBn) + residualValue).toFixed(3));
      } else {
        nextRows.push({
          key: residualKey,
          name: residualMeta.name,
          nameZh: residualMeta.nameZh,
          valueBn: Number(residualValue.toFixed(3)),
        });
      }
      reconciliationMode = "residual-added";
    }
  }
  return {
    rows: nextRows.sort((left, right) => safeNumber(right.valueBn) - safeNumber(left.valueBn)),
    coverageRatio,
    insufficientCoverage: false,
    reconciliationMode,
  };
}

function selectQuarterBarSource(company, entry, structurePayload = null) {
  let rows = [];
  const candidates = [];
  const entryForNormalization =
    entry ||
    {
      revenueBn: safeNumber(structurePayload?.displayRevenueBn, null),
      periodEnd: null,
    };
  const addCandidate = (source, sourceRows = []) => {
    if (!Array.isArray(sourceRows) || !sourceRows.length) return;
    const entryWithCompanyId = entryForNormalization
      ? {
          ...entryForNormalization,
          companyId: company?.id || entryForNormalization.companyId,
          quarterKey: entryQuarterKey(company, entry) || structurePayload?.quarterKey || entryForNormalization.quarterKey || null,
        }
      : entryForNormalization;
    let normalizedRows = normalizeBarSourceRows(entryWithCompanyId, sourceRows);
    if (!normalizedRows.length) return;
    if (entry) {
      normalizedRows = expandBarDetailRows(company, entry, normalizedRows);
    }
    if (!normalizedRows.length) return;
    normalizedRows = normalizedRows.sort((left, right) => safeNumber(right.valueBn) - safeNumber(left.valueBn));
    const quality = scoreBarSourceCandidate(entryForNormalization, normalizedRows);
    candidates.push({
      source,
      rows: normalizedRows,
      ...quality,
    });
  };

  addCandidate("structure-history", Array.isArray(structurePayload?.segments) ? structurePayload.segments : []);
  addCandidate("official-segments", Array.isArray(entry?.officialRevenueSegments) ? entry.officialRevenueSegments : []);
  if (shouldUseOfficialGroupCandidate(company, entry, structurePayload)) {
    let groups = null;
    try {
      groups = buildOfficialBusinessGroups(company, entry);
    } catch (_error) {
      groups = null;
    }
    const quarterKey = entryQuarterKey(company, entry);
    const shouldSkipOfficialGroups =
      String(company?.id || "").toLowerCase() === "alphabet" &&
      quarterKey &&
      quarterSortValue(quarterKey) < quarterSortValue("2021Q1");
    if (!shouldSkipOfficialGroups && Array.isArray(groups) && groups.length) {
      addCandidate(
        "official-groups",
        groups.map((item) => ({
          memberKey: item.memberKey || item.id || item.name,
          name: item.name,
          nameZh: item.nameZh,
          valueBn: item.valueBn,
          sourceUrl: item.sourceUrl || null,
          filingDate: item.filingDate || null,
          periodEnd: item.periodEnd || entry?.periodEnd || null,
          metricMode: item.metricMode || null,
        }))
      );
    }
  }

  let selectedCandidate = null;
  if (candidates.length) {
    candidates.sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      const leftCoverageDelta = left.coverageRatio === null ? Number.POSITIVE_INFINITY : Math.abs(left.coverageRatio - 1);
      const rightCoverageDelta = right.coverageRatio === null ? Number.POSITIVE_INFINITY : Math.abs(right.coverageRatio - 1);
      if (leftCoverageDelta !== rightCoverageDelta) return leftCoverageDelta - rightCoverageDelta;
      if (right.rows.length !== left.rows.length) return right.rows.length - left.rows.length;
      const sourcePriority = {
        "official-segments": 3,
        "official-groups": 2,
        "structure-history": 1,
      };
      return (sourcePriority[right.source] || 0) - (sourcePriority[left.source] || 0);
    });
    selectedCandidate = candidates[0];
    rows = selectedCandidate.rows;
  }

  if (!rows.length) {
    const fallbackRevenue = safeNumber(entry?.revenueBn, safeNumber(structurePayload?.displayRevenueBn, null));
    if (fallbackRevenue > 0.02) {
      rows = [
        {
          id: "reportedrevenue",
          name: "Reported revenue",
          nameZh: "报告营收",
          valueBn: fallbackRevenue,
        },
      ];
    }
  }

  const mergedByKey = new Map();
  rows.forEach((item) => {
    const rawKey = normalizeLabelKey(item.id || item.name);
    const key = canonicalBarSegmentKey(company?.id, rawKey, item.name || "");
    const valueBn = safeNumber(item.valueBn);
    if (!key || valueBn <= 0.02) return;
    const canonicalMeta = canonicalBarSegmentMeta(company?.id, key, item.name || "Segment", item.nameZh || "");
    const candidateRow = {
      key,
      name: canonicalMeta.name || item.name || "Segment",
      nameZh: canonicalMeta.nameZh || item.nameZh || translateBusinessLabelToZh(item.name || "Segment"),
      valueBn,
      filingDate: item.filingDate || null,
      periodEnd: item.periodEnd || null,
    };
    if (!mergedByKey.has(key)) {
      mergedByKey.set(key, candidateRow);
      return;
    }
    const existingRow = mergedByKey.get(key);
    const preferredRow = preferCanonicalBarSegmentRow(existingRow, candidateRow) ? candidateRow : existingRow;
    mergedByKey.set(key, {
      ...preferredRow,
      key,
      valueBn: Number(Math.max(safeNumber(existingRow?.valueBn), valueBn).toFixed(3)),
    });
  });

  const normalizedMergedRows = [...mergedByKey.values()]
    .map((item) => ({
      ...item,
      valueBn: Number(item.valueBn.toFixed(3)),
    }))
    .sort((left, right) => safeNumber(right.valueBn) - safeNumber(left.valueBn));
  return {
    rows: normalizedMergedRows,
    source: selectedCandidate?.source || (normalizedMergedRows.length === 1 && normalizedMergedRows[0]?.key === "reportedrevenue" ? "fallback-reported" : "none"),
    score: selectedCandidate?.score ?? null,
    coverageRatio: selectedCandidate?.coverageRatio ?? null,
    topShare: selectedCandidate?.topShare ?? null,
    lagMedianDays: selectedCandidate?.lagMedianDays ?? null,
  };
}

function normalizeQuarterSegmentsForBar(company, entry, structurePayload = null) {
  return selectQuarterBarSource(company, entry, structurePayload).rows;
}

function isBarTaxonomyOptionalRow(row) {
  const key = normalizeLabelKey(row?.key || row?.memberKey || row?.id || row?.name);
  if (!key || key === "reportedrevenue" || key === "otherrevenue") return true;
  return isAggregateLikeSegmentLabel(row?.name || "");
}

function comparableTaxonomyRows(rows = []) {
  const cleaned = [...(rows || [])].filter((item) => item?.key && item.key !== "reportedrevenue" && safeNumber(item?.valueBn) > 0.02);
  const nonOptional = cleaned.filter((item) => !isBarTaxonomyOptionalRow(item));
  return nonOptional.length >= 2 ? nonOptional : cleaned;
}

function quarterComparableTaxonomyProfile(quarter) {
  const rows = comparableTaxonomyRows(quarter?.rawSegmentRows || []);
  const map = new Map(rows.map((item) => [item.key, item]));
  const total = rows.reduce((sum, item) => sum + safeNumber(item?.valueBn), 0);
  return {
    rows,
    map,
    keys: rows.map((item) => item.key),
    total,
  };
}

function quarterComparableTaxonomySignature(quarter) {
  return quarterComparableTaxonomyProfile(quarter).keys.join("|");
}

function pickAnchorTaxonomyQuarter(quarters = []) {
  for (let index = quarters.length - 1; index >= 0; index -= 1) {
    const quarter = quarters[index];
    if (!quarter?.hasRevenueValue || !Array.isArray(quarter?.rawSegmentRows) || quarter.rawSegmentRows.length < 2) continue;
    if (quarter.wasReportedOnlyRaw || quarter.insufficientSegments) continue;
    const profile = quarterComparableTaxonomyProfile(quarter);
    if (profile.rows.length >= 2) {
      return quarter;
    }
  }
  return null;
}

function phaseAnchorQuarterScore(quarter) {
  if (!quarter) return -1;
  const profile = quarterComparableTaxonomyProfile(quarter);
  return (
    profile.rows.length * 20 +
    safeNumber(quarter?.rawSegmentSourceScore, 0) +
    safeNumber(quarter?.rawCoverageRatio, 0) * 12 +
    safeNumber(quarter?.totalRevenueBn, 0) * 0.01
  );
}

function shouldStartNewBarTaxonomyPhase(company, anchorQuarter, candidateQuarter) {
  if (!anchorQuarter || !candidateQuarter) return false;
  const anchorProfile = quarterComparableTaxonomyProfile(anchorQuarter);
  const candidateProfile = quarterComparableTaxonomyProfile(candidateQuarter);
  if (anchorProfile.rows.length < 2 || candidateProfile.rows.length < 2) return false;
  const anchorSignature = quarterComparableTaxonomySignature(anchorQuarter);
  const candidateSignature = quarterComparableTaxonomySignature(candidateQuarter);
  if (anchorSignature && anchorSignature === candidateSignature) return false;

  const forward = alignQuarterRowsToAnchorRegime(company, candidateQuarter, anchorQuarter);
  const reverse = alignQuarterRowsToAnchorRegime(company, anchorQuarter, candidateQuarter);
  const commonCount = anchorProfile.keys.filter((key) => candidateProfile.map.has(key)).length;
  const unionSize = new Set([...anchorProfile.keys, ...candidateProfile.keys]).size || 1;
  const jaccard = commonCount / unionSize;
  const bundledPhaseShift =
    (forward.comparable && forward.reason === "schema-bundled") || (reverse.comparable && reverse.reason === "schema-bundled");
  if (bundledPhaseShift && anchorProfile.rows.length >= 3 && candidateProfile.rows.length >= 3) {
    return true;
  }
  if (!forward.comparable && !reverse.comparable) {
    return true;
  }
  return anchorProfile.rows.length >= 3 && candidateProfile.rows.length >= 3 && jaccard < 0.75;
}

function buildBarTaxonomyPhases(company, quarters = []) {
  const phases = [];
  quarters.forEach((quarter) => {
    quarter.taxonomyPhaseId = null;
  });
  quarters.forEach((quarter, index) => {
    const profile = quarterComparableTaxonomyProfile(quarter);
    const isReliableQuarter =
      quarter?.hasRevenueValue &&
      !quarter?.wasReportedOnlyRaw &&
      !quarter?.insufficientSegments &&
      profile.rows.length >= 2;
    if (!isReliableQuarter) return;
    const currentPhase = phases[phases.length - 1] || null;
    if (!currentPhase) {
      phases.push({
        id: phases.length,
        indexes: [index],
        anchorIndex: index,
      });
      quarter.taxonomyPhaseId = phases[phases.length - 1].id;
      return;
    }
    const anchorQuarter = quarters[currentPhase.anchorIndex];
    if (shouldStartNewBarTaxonomyPhase(company, anchorQuarter, quarter)) {
      phases.push({
        id: phases.length,
        indexes: [index],
        anchorIndex: index,
      });
      quarter.taxonomyPhaseId = phases[phases.length - 1].id;
      return;
    }
    currentPhase.indexes.push(index);
    quarter.taxonomyPhaseId = currentPhase.id;
    const currentAnchorQuarter = quarters[currentPhase.anchorIndex];
    if (phaseAnchorQuarterScore(quarter) >= phaseAnchorQuarterScore(currentAnchorQuarter)) {
      currentPhase.anchorIndex = index;
    }
  });

  for (let index = 0; index < quarters.length; index += 1) {
    if (quarters[index].taxonomyPhaseId !== null && quarters[index].taxonomyPhaseId !== undefined) continue;
    const previousPhaseId = index > 0 ? quarters[index - 1]?.taxonomyPhaseId : null;
    const nextPhaseId = index + 1 < quarters.length ? quarters[index + 1]?.taxonomyPhaseId : null;
    if (previousPhaseId !== null && previousPhaseId !== undefined && previousPhaseId === nextPhaseId) {
      quarters[index].taxonomyPhaseId = previousPhaseId;
    }
  }

  return phases;
}

function applyBarTaxonomyPhaseAlignment(company, quarters = [], phases = []) {
  phases.forEach((phase) => {
    const anchorQuarter = quarters[phase?.anchorIndex];
    if (!anchorQuarter) return;
    phase.indexes.forEach((quarterIndex) => {
      const quarter = quarters[quarterIndex];
      if (!quarter?.hasRevenueValue || !Array.isArray(quarter.rawSegmentRows) || !quarter.rawSegmentRows.length) return;
      const alignment = alignQuarterRowsToAnchorRegime(company, quarter, anchorQuarter);
      quarter.taxonomyComparableToAnchor = alignment.comparable;
      quarter.taxonomyComparisonMode = alignment.reason || null;
      if (!alignment.comparable) return;
      quarter.rawSegmentRows = alignment.rows.map((item) => ({ ...item }));
      const reconciled = reconcileBarSegmentRowsToRevenue(company, quarter.rawSegmentRows, quarter.totalRevenueBn, {
        minCoverageForResidualAddition: quarter.bridgeStyle ? 0.36 : 0.62,
      });
      quarter.segmentRows = reconciled.rows;
      quarter.segmentMap = Object.fromEntries(quarter.segmentRows.map((item) => [item.key, safeNumber(item.valueBn)]));
      quarter.rawCoverageRatio = reconciled.coverageRatio;
      quarter.insufficientSegments = !!reconciled.insufficientCoverage;
      if (alignment.reason && alignment.reason !== "anchor-quarter") {
        quarter.reconciliationMode =
          quarter.reconciliationMode === "none"
            ? alignment.reason
            : String(quarter.reconciliationMode || "").includes(alignment.reason)
              ? quarter.reconciliationMode
              : `${quarter.reconciliationMode}+${alignment.reason}`;
      } else {
        quarter.reconciliationMode = reconciled.reconciliationMode;
      }
    });
  });
}

function alignQuarterRowsToAnchorRegime(company, quarter, anchorQuarter) {
  if (!quarter || !anchorQuarter) return { comparable: false, rows: [] };
  if (quarter === anchorQuarter) {
    return { comparable: true, rows: quarter.rawSegmentRows || [], reason: "anchor-quarter" };
  }
  const anchorStyle = String(anchorQuarter?.bridgeStyle || "").trim().toLowerCase();
  const quarterStyle = String(quarter?.bridgeStyle || "").trim().toLowerCase();
  if (anchorStyle && quarterStyle && anchorStyle !== quarterStyle) {
    return { comparable: false, rows: [], reason: "style-mismatch" };
  }

  const anchorProfile = quarterComparableTaxonomyProfile(anchorQuarter);
  const quarterProfile = quarterComparableTaxonomyProfile(quarter);
  if (anchorProfile.rows.length < 2 || quarterProfile.rows.length < 1) {
    return { comparable: false, rows: [], reason: "insufficient-profile" };
  }

  let alignedRows = [...(quarter.rawSegmentRows || [])].map((item) => ({ ...item }));
  let alignedProfile = quarterProfile;
  let bundledReplacement = false;

  const recomputeProfile = () => {
    const nextQuarter = { rawSegmentRows: alignedRows };
    alignedProfile = quarterComparableTaxonomyProfile(nextQuarter);
  };

  const commonKeys = anchorProfile.keys.filter((key) => alignedProfile.map.has(key));
  let missingKeys = anchorProfile.keys.filter((key) => !alignedProfile.map.has(key));
  let extraKeys = alignedProfile.keys.filter((key) => !anchorProfile.map.has(key));

  if (missingKeys.length === 1 && extraKeys.length >= 1 && extraKeys.length <= 3 && commonKeys.length >= 2) {
    const missingAnchorRow = anchorProfile.map.get(missingKeys[0]);
    const extraRows = alignedRows.filter((item) => extraKeys.includes(item.key));
    const extraValue = extraRows.reduce((sum, item) => sum + safeNumber(item?.valueBn), 0);
    const anchorMissingShare = safeNumber(missingAnchorRow?.valueBn) / Math.max(safeNumber(anchorQuarter?.totalRevenueBn), 0.001);
    const quarterExtraShare = extraValue / Math.max(safeNumber(quarter?.totalRevenueBn), 0.001);
    const comparableBundleShare =
      (anchorMissingShare > 0.1 && quarterExtraShare > 0.1 && quarterExtraShare / Math.max(anchorMissingShare, 0.001) >= 0.55 && quarterExtraShare / Math.max(anchorMissingShare, 0.001) <= 1.8) ||
      Math.abs(anchorMissingShare - quarterExtraShare) <= 0.18;
    if (comparableBundleShare) {
      const canonicalMeta = canonicalBarSegmentMeta(company?.id, missingAnchorRow?.key, missingAnchorRow?.name || "Segment", missingAnchorRow?.nameZh || "");
      alignedRows = alignedRows.filter((item) => !extraKeys.includes(item.key));
      alignedRows.push({
        key: missingAnchorRow.key,
        name: canonicalMeta.name || missingAnchorRow.name || "Segment",
        nameZh: canonicalMeta.nameZh || missingAnchorRow.nameZh || translateBusinessLabelToZh(missingAnchorRow.name || "Segment"),
        valueBn: Number(extraValue.toFixed(3)),
      });
      bundledReplacement = true;
      recomputeProfile();
      missingKeys = anchorProfile.keys.filter((key) => !alignedProfile.map.has(key));
      extraKeys = alignedProfile.keys.filter((key) => !anchorProfile.map.has(key));
    }
  }

  const recomputedCommonKeys = anchorProfile.keys.filter((key) => alignedProfile.map.has(key));
  const unionSize = new Set([...anchorProfile.keys, ...alignedProfile.keys]).size || 1;
  const jaccard = recomputedCommonKeys.length / unionSize;
  const missingAnchorShare = missingKeys.reduce((sum, key) => sum + safeNumber(anchorProfile.map.get(key)?.valueBn), 0) / Math.max(safeNumber(anchorQuarter?.totalRevenueBn), 0.001);
  const extraQuarterShare = extraKeys.reduce((sum, key) => sum + safeNumber(alignedProfile.map.get(key)?.valueBn), 0) / Math.max(safeNumber(quarter?.totalRevenueBn), 0.001);
  const commonAnchorShare =
    recomputedCommonKeys.reduce((sum, key) => sum + safeNumber(anchorProfile.map.get(key)?.valueBn), 0) / Math.max(safeNumber(anchorQuarter?.totalRevenueBn), 0.001);
  const commonQuarterShare =
    recomputedCommonKeys.reduce((sum, key) => sum + safeNumber(alignedProfile.map.get(key)?.valueBn), 0) / Math.max(safeNumber(quarter?.totalRevenueBn), 0.001);
  const styleComparable = !!anchorStyle && anchorStyle === quarterStyle && recomputedCommonKeys.length >= 2 && commonAnchorShare >= 0.45;
  const schemaComparable =
    recomputedCommonKeys.length >= 2 &&
    (jaccard >= 0.58 || (commonAnchorShare >= 0.55 && commonQuarterShare >= 0.55 && missingAnchorShare <= 0.26 && extraQuarterShare <= 0.26));
  if (!styleComparable && !schemaComparable) {
    return { comparable: false, rows: [], reason: "schema-mismatch" };
  }

  if (extraKeys.length) {
    const optionalExtraKeys = new Set(
      extraKeys.filter((key) => {
        const row = alignedProfile.map.get(key);
        const share = safeNumber(row?.valueBn) / Math.max(safeNumber(quarter?.totalRevenueBn), 0.001);
        return isBarTaxonomyOptionalRow(row) || share <= 0.08;
      })
    );
    if (optionalExtraKeys.size) {
      alignedRows = alignedRows.filter((item) => !optionalExtraKeys.has(item.key));
    }
  }

  return {
    comparable: true,
    rows: alignedRows
      .filter((item) => safeNumber(item?.valueBn) > 0.02)
      .map((item) => ({ ...item, valueBn: Number(safeNumber(item.valueBn).toFixed(3)) }))
      .sort((left, right) => safeNumber(right?.valueBn) - safeNumber(left?.valueBn)),
    reason: bundledReplacement ? "schema-bundled" : "schema-compatible",
  };
}

function buildRevenueSegmentBarHistory(company, anchorQuarterKey, maxQuarters = 30) {
  const structureQuarterMap =
    company?.officialRevenueStructureHistory?.quarters && typeof company.officialRevenueStructureHistory.quarters === "object"
      ? company.officialRevenueStructureHistory.quarters
      : {};
  const financialQuarterKeys = Array.isArray(company?.quarters) ? company.quarters : [];
  const structureQuarterKeys = Object.keys(structureQuarterMap || {});
  const quarterKeys = [...new Set([...financialQuarterKeys, ...structureQuarterKeys])]
    .filter((quarterKey) => /^\d{4}Q[1-4]$/.test(quarterKey))
    .sort((left, right) => quarterSortValue(left) - quarterSortValue(right));
  if (!quarterKeys.length) return null;
  const allValidQuarterKeys = quarterKeys.filter((quarterKey) => {
    const entry = company?.financials?.[quarterKey];
    const structurePayload = structureQuarterMap?.[quarterKey];
    const structureSegments = Array.isArray(structurePayload?.segments) ? structurePayload.segments : [];
    const structureSum = structureSegments.reduce((sum, item) => sum + safeNumber(item?.valueBn), 0);
    const hasRevenue = safeNumber(entry?.revenueBn, null) > 0.02 || safeNumber(structurePayload?.displayRevenueBn, null) > 0.02 || structureSum > 0.02;
    const hasSegments =
      (Array.isArray(entry?.officialRevenueSegments) && entry.officialRevenueSegments.some((item) => safeNumber(item?.valueBn) > 0.02)) ||
      structureSegments.some((item) => safeNumber(item?.valueBn) > 0.02);
    return hasRevenue || hasSegments;
  });
  if (!allValidQuarterKeys.length) return null;

  const companyFxSamplesByCurrency = new Map();
  Object.values(company?.financials || {}).forEach((entry) => {
    const sourceCurrency = String(entry?.statementCurrency || "").toUpperCase();
    const displayCurrency = String(entry?.displayCurrency || "").toUpperCase();
    const scale = safeNumber(entry?.displayScaleFactor, null);
    if (!sourceCurrency || sourceCurrency === "USD" || displayCurrency !== "USD" || !(scale > 0.000001) || Math.abs(scale - 1) < 0.000001) return;
    if (!companyFxSamplesByCurrency.has(sourceCurrency)) {
      companyFxSamplesByCurrency.set(sourceCurrency, []);
    }
    companyFxSamplesByCurrency.get(sourceCurrency).push(scale);
  });
  const companyFxFallbackByCurrency = {};
  companyFxSamplesByCurrency.forEach((samples, currency) => {
    const sorted = [...samples].sort((left, right) => left - right);
    if (!sorted.length) return;
    const middleIndex = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 ? sorted[middleIndex] : (sorted[middleIndex - 1] + sorted[middleIndex]) / 2;
    if (median > 0.000001) {
      companyFxFallbackByCurrency[currency] = Number(median.toFixed(6));
    }
  });

  const windowSize = Math.max(1, Math.floor(safeNumber(maxQuarters, 30)));
  const resolvedAnchorQuarterKey =
    (anchorQuarterKey && parseQuarterKey(anchorQuarterKey) && anchorQuarterKey) || allValidQuarterKeys[allValidQuarterKeys.length - 1] || null;
  if (!resolvedAnchorQuarterKey) return null;
  const anchorSort = quarterSortValue(resolvedAnchorQuarterKey);
  const anchorBoundKeys = allValidQuarterKeys.filter((quarterKey) => quarterSortValue(quarterKey) <= anchorSort);
  const selectedQuarterKeys = (anchorBoundKeys.length ? anchorBoundKeys : allValidQuarterKeys).slice(-windowSize);
  if (!selectedQuarterKeys.length) return null;

  let quarters = selectedQuarterKeys.map((quarterKey) => {
    const entry = company.financials?.[quarterKey] || null;
    const structurePayload = structureQuarterMap?.[quarterKey] || null;
    const sourceSelection = selectQuarterBarSource(company, entry, structurePayload);
    const rawSegments = sourceSelection.rows;
    const displayConfig = resolveBarQuarterDisplayConfig(company, entry, structurePayload);
    const fallbackFxScale = companyFxFallbackByCurrency[displayConfig.sourceCurrency];
    if (
      displayConfig.sourceCurrency !== "USD" &&
      fallbackFxScale > 0.000001 &&
      (displayConfig.displayCurrency !== "USD" || Math.abs(displayConfig.displayScaleFactor - 1) < 0.000001)
    ) {
      displayConfig.displayCurrency = "USD";
      displayConfig.displayScaleFactor = fallbackFxScale;
    }
    const scaledSegments = scaleBarSegmentRows(rawSegments, displayConfig.displayScaleFactor);
    const scaledSegmentSum = scaledSegments.reduce((sum, item) => sum + safeNumber(item.valueBn), 0);
    const revenueBnRaw = safeNumber(entry?.revenueBn, null);
    const revenueBnDisplay = revenueBnRaw > 0.02 ? revenueBnRaw * safeNumber(displayConfig.displayScaleFactor, 1) : null;
    const structureDisplayRevenueBn = safeNumber(structurePayload?.displayRevenueBn, null);
    const resolvedRevenueBn =
      revenueBnDisplay > 0.02
        ? revenueBnDisplay
        : structureDisplayRevenueBn > 0.02
          ? structureDisplayRevenueBn
          : scaledSegmentSum;
    const wasReportedOnlyRaw = scaledSegments.length === 1 && scaledSegments[0].key === "reportedrevenue";
    const rawSegmentKeys = [...new Set(scaledSegments.map((item) => item.key).filter(Boolean))].sort();
    const methodTag = resolvedBarBridgeStyle(company, entry, structurePayload, scaledSegments);
    const segmentSchemaTag = methodTag ? `style:${methodTag}` : rawSegmentKeys.length ? `keys:${rawSegmentKeys.join("|")}` : "schema:unknown";
    const segmentSchemaFamily =
      methodTag ||
      (rawSegmentKeys.length >= 2 ? `legacy:${rawSegmentKeys.slice(0, 3).join("|")}` : rawSegmentKeys.length === 1 ? `single:${rawSegmentKeys[0]}` : "unknown");
    const reconciled = reconcileBarSegmentRowsToRevenue(company, scaledSegments, resolvedRevenueBn, {
      minCoverageForResidualAddition: methodTag ? 0.36 : 0.62,
    });
    const segmentRows = reconciled.rows;
    const segmentMap = Object.fromEntries(segmentRows.map((item) => [item.key, safeNumber(item.valueBn)]));
    return {
      quarterKey,
      entry,
      structurePayload,
      label: formatBarQuarterLabel(entry, quarterKey),
      segmentMap,
      segmentRows,
      totalRevenueBn: Number(safeNumber(resolvedRevenueBn).toFixed(3)),
      displayCurrency: displayConfig.displayCurrency,
      sourceCurrency: displayConfig.sourceCurrency,
      displayScaleFactor: Number(safeNumber(displayConfig.displayScaleFactor, 1).toFixed(6)),
      hasRevenueValue: safeNumber(resolvedRevenueBn, null) > 0.02,
      hasRawSegments: scaledSegments.length > 0,
      wasReportedOnlyRaw,
      rawCoverageRatio: reconciled.coverageRatio,
      insufficientSegments: !!reconciled.insufficientCoverage,
      reconciliationMode: reconciled.reconciliationMode,
      segmentSchemaTag,
      segmentSchemaFamily,
      isImputedSegments: false,
      isBackfilledSegments: false,
      isSmoothedSegments: false,
      isMissingQuarterData: false,
      bridgeStyle: methodTag || null,
      allowsSyntheticHarmonization: !!methodTag,
      rawSegmentRows: scaledSegments.map((item) => ({ ...item })),
      rawSegmentSource: sourceSelection.source,
      rawSegmentSourceScore: sourceSelection.score,
    };
  });

  const taxonomyPhases = buildBarTaxonomyPhases(company, quarters);
  applyBarTaxonomyPhaseAlignment(company, quarters, taxonomyPhases);

  const multiSegmentQuarterCount = quarters.filter((quarter) => quarter.segmentRows.length >= 2).length;
  if (multiSegmentQuarterCount > 0) {
    quarters.forEach((quarter) => {
      const looksLikeSingleSegmentGap =
        quarter.segmentRows.length === 1 &&
        quarter.hasRevenueValue &&
        quarter.hasRawSegments &&
        !quarter.wasReportedOnlyRaw;
      if (!looksLikeSingleSegmentGap) return;
      quarter.insufficientSegments = true;
      if (quarter.reconciliationMode === "none") {
        quarter.reconciliationMode = "single-segment-gap";
      }
    });
  }
  const rowShareMap = (rows = []) => {
    const total = rows.reduce((sum, item) => sum + safeNumber(item?.valueBn), 0);
    if (!(total > 0.02)) return {};
    return Object.fromEntries(rows.map((item) => [item.key, safeNumber(item.valueBn) / total]));
  };
  const normalizeShareMap = (shareMap = {}) => {
    const rows = Object.entries(shareMap).filter(([, value]) => safeNumber(value) > 0);
    const total = rows.reduce((sum, [, value]) => sum + safeNumber(value), 0);
    if (!(total > 0.000001)) return {};
    return Object.fromEntries(rows.map(([key, value]) => [key, safeNumber(value) / total]));
  };
  const synthesizeRowsFromShares = (quarter, templateRows = [], shareMap = {}) => {
    const normalizedShareMap = normalizeShareMap(shareMap);
    const totalRevenueBn = safeNumber(quarter?.totalRevenueBn, 0);
    if (!(totalRevenueBn > 0.02)) return [];
    const templateMeta = new Map((templateRows || []).map((row) => [row.key, row]));
    const keys = Object.keys(normalizedShareMap);
    if (!keys.length) return [];
    const syntheticRows = keys.map((key) => {
      const template = templateMeta.get(key);
      const canonicalMeta = canonicalBarSegmentMeta(company?.id, key, template?.name || "Segment", template?.nameZh || "");
      return {
        key,
        name: canonicalMeta.name || template?.name || "Segment",
        nameZh: canonicalMeta.nameZh || template?.nameZh || translateBusinessLabelToZh(template?.name || "Segment"),
        valueBn: Number((totalRevenueBn * safeNumber(normalizedShareMap[key])).toFixed(3)),
      };
    });
    const syntheticTotal = syntheticRows.reduce((sum, item) => sum + safeNumber(item.valueBn), 0);
    const residual = Number((totalRevenueBn - syntheticTotal).toFixed(3));
    if (Math.abs(residual) > 0.004 && syntheticRows.length) {
      syntheticRows[0].valueBn = Number((safeNumber(syntheticRows[0].valueBn) + residual).toFixed(3));
    }
    return syntheticRows.sort((left, right) => safeNumber(right.valueBn) - safeNumber(left.valueBn));
  };
  const stableQuarterKeys = (quarter) =>
    [...new Set((quarter?.segmentRows || []).map((item) => item.key).filter((key) => key && key !== "otherrevenue" && key !== "reportedrevenue"))].sort();
  const rebuildQuarterRows = (quarter, nextRows = []) => {
    const sortedRows = [...(nextRows || [])]
      .filter((item) => safeNumber(item?.valueBn) > 0.02)
      .map((item) => ({
        ...item,
        valueBn: Number(safeNumber(item.valueBn).toFixed(3)),
      }))
      .sort((left, right) => safeNumber(right.valueBn) - safeNumber(left.valueBn));
    quarter.segmentRows = sortedRows;
    quarter.segmentMap = Object.fromEntries(sortedRows.map((item) => [item.key, safeNumber(item.valueBn)]));
  };
  const appendReconciliationMode = (quarter, mode) => {
    if (!quarter || !mode) return;
    if (quarter.reconciliationMode === "none") {
      quarter.reconciliationMode = mode;
      return;
    }
    if (String(quarter.reconciliationMode || "").includes(mode)) return;
    quarter.reconciliationMode = `${quarter.reconciliationMode}+${mode}`;
  };
  if (String(company?.id || "").toLowerCase() === "alphabet") {
    quarters.forEach((quarter) => {
      const quarterKeys = stableQuarterKeys(quarter);
      const hasLegacyGoogleSchema = quarterKeys.includes("googleservices") && !quarterKeys.includes("adrevenue");
      if (!hasLegacyGoogleSchema || safeNumber(quarter.rawCoverageRatio, 1) >= 0.78) return;
      quarter.insufficientSegments = true;
      quarter.reconciliationMode =
        quarter.reconciliationMode === "none" ? "legacy-schema-partial" : `${quarter.reconciliationMode}+legacy-schema-partial`;
    });
  }
  const quarterHasLegacyNvidiaSchema = (quarter) => {
    if (String(company?.id || "").toLowerCase() !== "nvidia") return false;
    const quarterKeys = stableQuarterKeys(quarter);
    return quarterKeys.length === 2 && quarterKeys.includes("gpu") && quarterKeys.includes("tegraprocessor");
  };
  if (String(company?.id || "").toLowerCase() === "nvidia") {
    quarters.forEach((quarter) => {
      if (!quarterHasLegacyNvidiaSchema(quarter)) return;
      quarter.insufficientSegments = true;
      quarter.reconciliationMode =
        quarter.reconciliationMode === "none" ? "legacy-coarse-taxonomy" : `${quarter.reconciliationMode}+legacy-coarse-taxonomy`;
    });
  }
  const conceptualRevenueComponentHints = [
    "sales and other operating revenue",
    "income from equity affiliates",
    "other revenue interest",
    "fees and commissions",
    "service charges",
    "noninterest income",
    "interest income expense net",
  ];
  const isConceptualRevenueComponentRow = (row) => {
    const normalized = normalizeSegmentLabel(row?.name || row?.key || "");
    if (!normalized) return false;
    return conceptualRevenueComponentHints.some((hint) => normalized.includes(hint));
  };
  const quarterHasConceptualTaxonomy = (quarter) => {
    const substantiveRows = (quarter?.rawSegmentRows || []).filter((item) => {
      if (!item?.key || item.key === "reportedrevenue" || safeNumber(item?.valueBn) <= 0.02) return false;
      return !isBarTaxonomyOptionalRow(item);
    });
    return substantiveRows.length >= 2 && substantiveRows.every((item) => isConceptualRevenueComponentRow(item));
  };
  const reliableTemplateIndexes = [];
  const reliableTemplateIndexesBySchema = new Map();
  const reliableTemplateIndexesByPhase = new Map();
  quarters.forEach((quarter, index) => {
    const reliableRawSegments =
      quarter.hasRawSegments &&
      !quarter.wasReportedOnlyRaw &&
      !quarter.insufficientSegments &&
      !quarterHasConceptualTaxonomy(quarter) &&
      (multiSegmentQuarterCount === 0 || quarter.segmentRows.length >= 2) &&
      (quarter.allowsSyntheticHarmonization ||
        (quarter.rawSegmentSource !== "fallback-reported" &&
          safeNumber(quarter.rawCoverageRatio, 0) >= 0.78 &&
          safeNumber(quarter.rawCoverageRatio, 0) <= 1.22));
    if (!(quarter.segmentRows.length && reliableRawSegments)) return;
    reliableTemplateIndexes.push(index);
    if (!reliableTemplateIndexesBySchema.has(quarter.segmentSchemaTag)) {
      reliableTemplateIndexesBySchema.set(quarter.segmentSchemaTag, []);
    }
    reliableTemplateIndexesBySchema.get(quarter.segmentSchemaTag).push(index);
    if (quarter.taxonomyPhaseId !== null && quarter.taxonomyPhaseId !== undefined) {
      if (!reliableTemplateIndexesByPhase.has(quarter.taxonomyPhaseId)) {
        reliableTemplateIndexesByPhase.set(quarter.taxonomyPhaseId, []);
      }
      reliableTemplateIndexesByPhase.get(quarter.taxonomyPhaseId).push(index);
    }
  });
  const dominantReliablePhaseEntry = [...reliableTemplateIndexesByPhase.entries()]
    .sort((left, right) => right[1].length - left[1].length)[0] || null;
  const dominantReliablePhaseId = dominantReliablePhaseEntry?.[0] ?? null;
  const dominantReliablePhaseIndexes = dominantReliablePhaseEntry?.[1] || [];
  const pickNearestIndex = (indexes = [], currentIndex) => {
    if (!indexes.length) return null;
    let nearest = indexes[0];
    let nearestDistance = Math.abs(currentIndex - nearest);
    indexes.forEach((candidateIndex) => {
      const distance = Math.abs(currentIndex - candidateIndex);
      if (distance < nearestDistance) {
        nearest = candidateIndex;
        nearestDistance = distance;
        return;
      }
      if (distance === nearestDistance && candidateIndex < currentIndex && nearest > currentIndex) {
        nearest = candidateIndex;
      }
    });
    return nearest;
  };
  const pickTemplateIndex = (quarter, index) => {
    const sameSchemaCandidates = reliableTemplateIndexesBySchema.get(quarter.segmentSchemaTag) || [];
    const sameSchemaNearest = pickNearestIndex(sameSchemaCandidates, index);
    if (sameSchemaNearest !== null && sameSchemaNearest !== undefined) return sameSchemaNearest;
    const samePhaseCandidates =
      quarter.taxonomyPhaseId !== null && quarter.taxonomyPhaseId !== undefined
        ? reliableTemplateIndexesByPhase.get(quarter.taxonomyPhaseId) || []
        : [];
    const samePhaseNearest = pickNearestIndex(samePhaseCandidates, index);
    if (samePhaseNearest !== null && samePhaseNearest !== undefined) return samePhaseNearest;
    const sameFamilyCandidates = reliableTemplateIndexes.filter(
      (candidateIndex) =>
        quarters[candidateIndex]?.segmentSchemaFamily === quarter.segmentSchemaFamily &&
        (quarter.taxonomyPhaseId === null ||
          quarter.taxonomyPhaseId === undefined ||
          quarters[candidateIndex]?.taxonomyPhaseId === quarter.taxonomyPhaseId)
    );
    const sameFamilyNearest = pickNearestIndex(sameFamilyCandidates, index);
    if (sameFamilyNearest !== null && sameFamilyNearest !== undefined) return sameFamilyNearest;
    const futureCandidates = reliableTemplateIndexes.filter((candidateIndex) => candidateIndex > index);
    if (String(quarter?.reconciliationMode || "").includes("legacy-schema-partial") && futureCandidates.length) {
      return futureCandidates[0];
    }
    const pastCandidates = reliableTemplateIndexes.filter((candidateIndex) => candidateIndex < index);
    if (pastCandidates.length) return pastCandidates[pastCandidates.length - 1];
    if (futureCandidates.length) return futureCandidates[0];
    return null;
  };
  const averagedShareMapForIndexes = (indexes = []) => {
    const normalizedIndexes = indexes.filter((value) => Number.isInteger(value) && quarters[value]?.segmentRows?.length >= 2);
    if (!normalizedIndexes.length) return {};
    const aggregate = {};
    normalizedIndexes.forEach((quarterIndex) => {
      const shareMap = rowShareMap(quarters[quarterIndex].segmentRows);
      Object.entries(shareMap).forEach(([key, value]) => {
        aggregate[key] = (aggregate[key] || 0) + safeNumber(value);
      });
    });
    return normalizeShareMap(
      Object.fromEntries(Object.entries(aggregate).map(([key, value]) => [key, safeNumber(value) / normalizedIndexes.length]))
    );
  };
  const quarterNeedsAutoTemplateFill = (quarter) =>
    quarter.hasRevenueValue &&
    (quarter.segmentRows.length < 2 || quarter.wasReportedOnlyRaw || quarter.insufficientSegments || quarterHasConceptualTaxonomy(quarter));
  const quarterHasOnlyCoarseTaxonomy = (quarter) => {
    const substantiveRows = (quarter?.rawSegmentRows || []).filter((item) => {
      if (!item?.key || item.key === "reportedrevenue" || safeNumber(item?.valueBn) <= 0.02) return false;
      return !isBarTaxonomyOptionalRow(item);
    });
    return (
      !quarter?.hasRawSegments ||
      quarter?.wasReportedOnlyRaw ||
      substantiveRows.length <= 1 ||
      quarterHasConceptualTaxonomy(quarter) ||
      quarterHasLegacyNvidiaSchema(quarter)
    );
  };
  const canUseExtendedTemplateFill = (quarter, templateIndex) => {
    if (quarter.allowsSyntheticHarmonization) return true;
    if (!Number.isInteger(templateIndex)) return false;
    if (dominantReliablePhaseId === null || dominantReliablePhaseId === undefined) return false;
    if ((quarters[templateIndex]?.taxonomyPhaseId ?? null) !== dominantReliablePhaseId) return false;
    if (dominantReliablePhaseIndexes.length < 6) return false;
    if (quarterHasOnlyCoarseTaxonomy(quarter)) return true;
    return String(quarter?.reconciliationMode || "").includes("legacy-schema-partial");
  };
  const phaseEdgeTemplateSharePayload = (quarter, templateIndex) => {
    if (!Number.isInteger(templateIndex)) return null;
    const templateQuarter = quarters[templateIndex];
    if (!templateQuarter?.segmentRows?.length) return null;
    const templatePhaseIndexes =
      templateQuarter.taxonomyPhaseId !== null && templateQuarter.taxonomyPhaseId !== undefined
        ? reliableTemplateIndexesByPhase.get(templateQuarter.taxonomyPhaseId) || [templateIndex]
        : [templateIndex];
    const isBeforePhase = templatePhaseIndexes.length && quarterSortValue(quarter.quarterKey) < quarterSortValue(quarters[templatePhaseIndexes[0]].quarterKey);
    const isAfterPhase =
      templatePhaseIndexes.length &&
      quarterSortValue(quarter.quarterKey) > quarterSortValue(quarters[templatePhaseIndexes[templatePhaseIndexes.length - 1]].quarterKey);
    if (!isBeforePhase && !isAfterPhase) return null;
    const sampleIndexes = isBeforePhase ? templatePhaseIndexes.slice(0, 3) : templatePhaseIndexes.slice(-3);
    const shareMap = averagedShareMapForIndexes(sampleIndexes);
    if (!Object.keys(shareMap).length) return null;
    const referenceQuarter = quarters[sampleIndexes[0]] || templateQuarter;
    return {
      templateRows: referenceQuarter.segmentRows || templateQuarter.segmentRows || [],
      shareMap,
    };
  };

  for (let index = 1; index < quarters.length - 1; index += 1) {
    const quarter = quarters[index];
    const previousQuarter = quarters[index - 1];
    const nextQuarter = quarters[index + 1];
    if (!quarter?.hasRevenueValue) continue;
    if (!quarter?.allowsSyntheticHarmonization || !previousQuarter?.allowsSyntheticHarmonization || !nextQuarter?.allowsSyntheticHarmonization) continue;
    const previousKeys = stableQuarterKeys(previousQuarter);
    const nextKeys = stableQuarterKeys(nextQuarter);
    if (!previousKeys.length || previousKeys.join("|") !== nextKeys.join("|")) continue;
    const currentKeys = stableQuarterKeys(quarter);
    if (!currentKeys.length || currentKeys.some((key) => !previousKeys.includes(key))) continue;
    const missingKeys = previousKeys.filter((key) => !currentKeys.includes(key));
    if (!missingKeys.length || missingKeys.length > 2) continue;
    const rawResidualValue = safeNumber(quarter.segmentMap?.otherrevenue, 0);
    const currentStableTotal = (quarter.segmentRows || []).reduce((sum, item) => {
      if (!item?.key || item.key === "otherrevenue" || item.key === "reportedrevenue") return sum;
      return sum + safeNumber(item.valueBn);
    }, 0);
    const availableGapValue = rawResidualValue > 0.02 ? rawResidualValue : Math.max(safeNumber(quarter.totalRevenueBn) - currentStableTotal, 0);
    if (!(availableGapValue > 0.12)) continue;
    const previousShares = rowShareMap(previousQuarter.segmentRows);
    const nextShares = rowShareMap(nextQuarter.segmentRows);
    const weightByMissingKey = Object.fromEntries(
      missingKeys.map((key) => [key, Math.max((safeNumber(previousShares[key]) + safeNumber(nextShares[key])) / 2, 0)])
    );
    const totalMissingWeight = Object.values(weightByMissingKey).reduce((sum, value) => sum + safeNumber(value), 0);
    if (!(totalMissingWeight > 0.000001)) continue;
    const missingRows = missingKeys
      .map((key) => {
        const estimatedValueBn = Number((availableGapValue * safeNumber(weightByMissingKey[key]) / totalMissingWeight).toFixed(3));
        if (!(estimatedValueBn > 0.02)) return null;
        const templateRow =
          previousQuarter.segmentRows.find((item) => item.key === key) ||
          nextQuarter.segmentRows.find((item) => item.key === key) ||
          null;
        const canonicalMeta = canonicalBarSegmentMeta(company?.id, key, templateRow?.name || "Segment", templateRow?.nameZh || "");
        return {
          key,
          name: canonicalMeta.name || templateRow?.name || "Segment",
          nameZh: canonicalMeta.nameZh || templateRow?.nameZh || translateBusinessLabelToZh(templateRow?.name || "Segment"),
          valueBn: estimatedValueBn,
        };
      })
      .filter(Boolean);
    const missingValueTotal = missingRows.reduce((sum, item) => sum + safeNumber(item?.valueBn), 0);
    if (!(missingValueTotal > 0.02)) continue;
    const nextRows = (quarter.segmentRows || []).filter((item) => item.key !== "otherrevenue");
    nextRows.push(...missingRows);
    const residualAfterFill = Number((availableGapValue - missingValueTotal).toFixed(3));
    if (residualAfterFill > 0.03) {
      const residualMeta = canonicalBarSegmentMeta(company?.id, "otherrevenue", "Other revenue", "其他营收");
      nextRows.push({
        key: canonicalBarSegmentKey(company?.id, "otherrevenue", "Other revenue"),
        name: residualMeta.name,
        nameZh: residualMeta.nameZh,
        valueBn: residualAfterFill,
      });
    }
    rebuildQuarterRows(quarter, nextRows);
    quarter.isBackfilledSegments = true;
    quarter.reconciliationMode =
      quarter.reconciliationMode === "none" ? "stable-key-gap-filled" : `${quarter.reconciliationMode}+stable-key-gap-filled`;
  }

  for (let index = 1; index < quarters.length - 1; index += 1) {
    const quarter = quarters[index];
    const previousQuarter = quarters[index - 1];
    const nextQuarter = quarters[index + 1];
    if (!quarter?.hasRevenueValue) continue;
    if (!quarter?.allowsSyntheticHarmonization || !previousQuarter?.allowsSyntheticHarmonization || !nextQuarter?.allowsSyntheticHarmonization) continue;
    if (!(previousQuarter?.segmentRows?.length >= 2 && nextQuarter?.segmentRows?.length >= 2)) continue;
    const previousKeys = [...new Set(previousQuarter.segmentRows.map((item) => item.key))].sort();
    const nextKeys = [...new Set(nextQuarter.segmentRows.map((item) => item.key))].sort();
    if (!previousKeys.length || previousKeys.join("|") !== nextKeys.join("|")) continue;
    const quarterKeys = [...new Set((quarter.segmentRows || []).map((item) => item.key))].sort();
    const needsGapFill =
      !quarter.segmentRows.length ||
      quarter.segmentRows.length < 2 ||
      quarter.wasReportedOnlyRaw ||
      quarter.insufficientSegments ||
      quarter.reconciliationMode === "coverage-too-low";
    const isolatedSchema = quarterKeys.join("|") !== previousKeys.join("|");
    if (!needsGapFill && !isolatedSchema) continue;
    if (isolatedSchema && quarter.segmentRows.length >= 2) {
      const shareMap = rowShareMap(quarter.segmentRows);
      const topShare = Math.max(0, ...Object.values(shareMap).map((value) => safeNumber(value)));
      const coverage = safeNumber(quarter.rawCoverageRatio, 1);
      if (topShare < 0.82 && coverage >= 0.7 && coverage <= 1.28) continue;
    }
    const previousShares = rowShareMap(previousQuarter.segmentRows);
    const nextShares = rowShareMap(nextQuarter.segmentRows);
    const blendedShares = {};
    previousKeys.forEach((key) => {
      blendedShares[key] = (safeNumber(previousShares[key]) + safeNumber(nextShares[key])) / 2;
    });
    const syntheticRows = synthesizeRowsFromShares(quarter, previousQuarter.segmentRows, blendedShares);
    if (!syntheticRows.length) continue;
    quarter.segmentRows = syntheticRows;
    quarter.segmentMap = Object.fromEntries(syntheticRows.map((item) => [item.key, safeNumber(item.valueBn)]));
    quarter.segmentSchemaTag = previousQuarter.segmentSchemaTag;
    quarter.segmentSchemaFamily = previousQuarter.segmentSchemaFamily;
    quarter.isBackfilledSegments = true;
    quarter.isSmoothedSegments = true;
    quarter.reconciliationMode =
      quarter.reconciliationMode === "none"
        ? "neighbor-schema-harmonized"
        : `${quarter.reconciliationMode}+neighbor-schema-harmonized`;
  }

  if (reliableTemplateIndexes.length) {
    quarters.forEach((quarter, index) => {
      if (!quarterNeedsAutoTemplateFill(quarter)) return;
      let templateIndex = pickTemplateIndex(quarter, index);
      const shouldPreferDominantPhaseTemplate =
        !quarter.allowsSyntheticHarmonization &&
        dominantReliablePhaseIndexes.length >= 6 &&
        (quarterHasOnlyCoarseTaxonomy(quarter) || String(quarter?.reconciliationMode || "").includes("legacy-schema-partial"));
      if (shouldPreferDominantPhaseTemplate) {
        const dominantTemplateIndex = pickNearestIndex(dominantReliablePhaseIndexes, index);
        if (dominantTemplateIndex !== null && dominantTemplateIndex !== undefined) {
          templateIndex = dominantTemplateIndex;
        }
      }
      if (templateIndex === null || templateIndex === undefined) return;
      const extendedTemplateFill = canUseExtendedTemplateFill(quarter, templateIndex);
      if (!extendedTemplateFill) return;
      const maxTemplateDistance =
        !quarter.allowsSyntheticHarmonization || String(quarter.reconciliationMode || "").includes("legacy-schema-partial") ? 16 : 4;
      if (Math.abs(templateIndex - index) > maxTemplateDistance) return;
      const edgePayload = phaseEdgeTemplateSharePayload(quarter, templateIndex);
      const templateRows = edgePayload?.templateRows || quarters[templateIndex].segmentRows || [];
      const templateShares = edgePayload?.shareMap || rowShareMap(templateRows);
      const syntheticRows = synthesizeRowsFromShares(quarter, templateRows, templateShares);
      if (!syntheticRows.length) return;
      quarter.segmentRows = syntheticRows;
      quarter.segmentMap = Object.fromEntries(syntheticRows.map((item) => [item.key, safeNumber(item.valueBn)]));
      quarter.segmentSchemaTag = quarters[templateIndex].segmentSchemaTag;
      quarter.segmentSchemaFamily = quarters[templateIndex].segmentSchemaFamily;
      quarter.isBackfilledSegments = true;
      quarter.isImputedSegments = !quarter.allowsSyntheticHarmonization;
      if (quarter.taxonomyPhaseId === null || quarter.taxonomyPhaseId === undefined) {
        quarter.taxonomyPhaseId = quarters[templateIndex]?.taxonomyPhaseId ?? quarter.taxonomyPhaseId;
      }
      quarter.reconciliationMode =
        quarter.reconciliationMode === "none"
          ? "template-harmonized"
          : String(quarter.reconciliationMode || "").includes("template-harmonized")
            ? quarter.reconciliationMode
            : `${quarter.reconciliationMode}+template-harmonized`;
    });
  }

  quarters.forEach((quarter) => {
    if (!quarter?.isBackfilledSegments || !quarter?.segmentRows?.length) return;
    const shouldPromoteSyntheticRows =
      quarter.wasReportedOnlyRaw || quarter.insufficientSegments || quarterHasConceptualTaxonomy(quarter);
    if (!shouldPromoteSyntheticRows) return;
    quarter.rawSegmentRows = quarter.segmentRows.map((item) => ({ ...item }));
    quarter.rawCoverageRatio = 1;
    quarter.insufficientSegments = false;
    quarter.wasReportedOnlyRaw = false;
    quarter.hasRawSegments = true;
  });

  const finalTaxonomyPhases = buildBarTaxonomyPhases(company, quarters);
  applyBarTaxonomyPhaseAlignment(company, quarters, finalTaxonomyPhases);

  quarters.forEach((quarter) => {
    if (!quarter?.hasRevenueValue || !Array.isArray(quarter.segmentRows) || !quarter.segmentRows.length) return;
    const totalRevenueBn = Math.max(safeNumber(quarter.totalRevenueBn), 0.001);
    const residualRow = quarter.segmentRows.find((item) => item?.key === "otherrevenue") || null;
    const residualShare = safeNumber(residualRow?.valueBn) / totalRevenueBn;
    const isSparseOfficialSegmentResidual =
      !quarter.bridgeStyle &&
      quarter.rawSegmentSource === "official-segments" &&
      safeNumber(quarter.rawCoverageRatio, 0) < 0.72 &&
      residualShare > 0.28;
    if (isSparseOfficialSegmentResidual) {
      quarter.segmentRows = [];
      quarter.segmentMap = {};
      quarter.hasRawSegments = false;
      quarter.insufficientSegments = true;
      quarter.allowsSyntheticHarmonization = false;
      quarter.reconciliationMode =
        quarter.reconciliationMode === "none" ? "residual-dominant" : `${quarter.reconciliationMode}+residual-dominant`;
      return;
    }
    const tinyOptionalRows = quarter.segmentRows.filter((item) => {
      const share = safeNumber(item?.valueBn) / totalRevenueBn;
      return isBarTaxonomyOptionalRow(item) && share < 0.015;
    });
    if (!tinyOptionalRows.length) return;
    quarter.segmentRows = quarter.segmentRows.filter((item) => !tinyOptionalRows.includes(item));
    quarter.segmentMap = Object.fromEntries(quarter.segmentRows.map((item) => [item.key, safeNumber(item.valueBn)]));
  });

  for (let index = 1; index < quarters.length - 1; index += 1) {
    const quarter = quarters[index];
    const residualRow = quarter.segmentRows.find((item) => item?.key === "otherrevenue") || null;
    if (!quarter?.hasRevenueValue || !residualRow || quarter.rawSegmentSource === "official-groups") continue;
    const previousQuarter = quarters[index - 1];
    const nextQuarter = quarters[index + 1];
    const previousKeys = stableQuarterKeys(previousQuarter);
    const currentKeys = stableQuarterKeys(quarter);
    const nextKeys = stableQuarterKeys(nextQuarter);
    if (!previousKeys.length || previousKeys.join("|") !== currentKeys.join("|") || currentKeys.join("|") !== nextKeys.join("|")) continue;
    const residualShare = safeNumber(residualRow?.valueBn) / Math.max(safeNumber(quarter.totalRevenueBn), 0.001);
    if (!(residualShare > 0.01 && residualShare <= 0.1)) continue;
    const previousShares = rowShareMap(previousQuarter.segmentRows);
    const nextShares = rowShareMap(nextQuarter.segmentRows);
    const averagedShares = {};
    currentKeys.forEach((key) => {
      averagedShares[key] = Math.max((safeNumber(previousShares[key]) + safeNumber(nextShares[key])) / 2, 0);
    });
    const totalShareWeight = Object.values(averagedShares).reduce((sum, value) => sum + safeNumber(value), 0);
    if (!(totalShareWeight > 0.000001)) continue;
    const redistributedRows = (quarter.segmentRows || [])
      .filter((item) => item.key !== "otherrevenue")
      .map((item) => ({
        ...item,
        valueBn: Number(
          (
            safeNumber(item.valueBn) +
            (safeNumber(residualRow.valueBn) * safeNumber(averagedShares[item.key])) / totalShareWeight
          ).toFixed(3)
        ),
      }));
    rebuildQuarterRows(quarter, redistributedRows);
    quarter.isSmoothedSegments = true;
    appendReconciliationMode(quarter, "residual-absorbed");
  }

  quarters.forEach((quarter) => {
    if (quarter.segmentRows.length || !quarter.hasRevenueValue) return;
    const fallbackValue = safeNumber(quarter.totalRevenueBn, 0);
    if (!(fallbackValue > 0.02)) return;
    const fallbackMeta = canonicalBarSegmentMeta(company?.id, "reportedrevenue", "Reported revenue", "报告营收");
    const fallbackRow = {
      key: canonicalBarSegmentKey(company?.id, "reportedrevenue", "Reported revenue"),
      name: fallbackMeta.name,
      nameZh: fallbackMeta.nameZh,
      valueBn: Number(fallbackValue.toFixed(3)),
    };
    quarter.segmentRows = [fallbackRow];
    quarter.segmentMap = { [fallbackRow.key]: fallbackRow.valueBn };
    quarter.reconciliationMode = quarter.reconciliationMode === "none" ? "fallback-single-segment" : quarter.reconciliationMode;
  });

  const dominantPhaseTemplateCoverage =
    reliableTemplateIndexes.length > 0 ? dominantReliablePhaseIndexes.length / reliableTemplateIndexes.length : 0;
  if (dominantReliablePhaseIndexes.length >= 6 && dominantPhaseTemplateCoverage >= 0.75) {
    quarters.forEach((quarter, index) => {
      const isReportedOnlyFallback =
        quarter.hasRevenueValue &&
        quarter.segmentRows.length === 1 &&
        quarter.segmentRows[0]?.key === "reportedrevenue";
      if (!isReportedOnlyFallback) return;
      const templateIndex = pickNearestIndex(dominantReliablePhaseIndexes, index);
      if (templateIndex === null || templateIndex === undefined) return;
      const edgePayload = phaseEdgeTemplateSharePayload(quarter, templateIndex);
      const templateRows = edgePayload?.templateRows || quarters[templateIndex]?.segmentRows || [];
      const templateShares = edgePayload?.shareMap || rowShareMap(templateRows);
      const syntheticRows = synthesizeRowsFromShares(quarter, templateRows, templateShares);
      if (!syntheticRows.length) return;
      quarter.segmentRows = syntheticRows;
      quarter.segmentMap = Object.fromEntries(syntheticRows.map((item) => [item.key, safeNumber(item.valueBn)]));
      quarter.isBackfilledSegments = true;
      quarter.isImputedSegments = true;
      if (quarter.taxonomyPhaseId === null || quarter.taxonomyPhaseId === undefined) {
        quarter.taxonomyPhaseId = dominantReliablePhaseId;
      }
      quarter.reconciliationMode =
        quarter.reconciliationMode === "none"
          ? "template-harmonized"
          : String(quarter.reconciliationMode || "").includes("template-harmonized")
            ? quarter.reconciliationMode
            : `${quarter.reconciliationMode}+template-harmonized`;
    });
  }

  const isStrictOfficialSegmentsSandwichQuarter = (quarter, previousQuarter, nextQuarter) => {
    if (
      !quarter?.hasRevenueValue ||
      !previousQuarter?.hasRevenueValue ||
      !nextQuarter?.hasRevenueValue ||
      !(previousQuarter?.segmentRows?.length >= 2 && nextQuarter?.segmentRows?.length >= 2)
    ) {
      return false;
    }
    if (String(quarter?.rawSegmentSource || "") !== "official-segments") return false;
    if (String(previousQuarter?.rawSegmentSource || "") === "fallback-reported") return false;
    if (String(nextQuarter?.rawSegmentSource || "") === "fallback-reported") return false;
    const previousKeys = stableQuarterKeys(previousQuarter);
    const nextKeys = stableQuarterKeys(nextQuarter);
    const currentKeys = stableQuarterKeys(quarter);
    if (!previousKeys.length || previousKeys.join("|") !== nextKeys.join("|")) return false;
    if (currentKeys.join("|") === previousKeys.join("|")) return false;
    const coverage = safeNumber(quarter.rawCoverageRatio, null);
    if (coverage !== null && (coverage < 0.72 || coverage > 1.6)) return false;
    const neighborAverageRevenueBn = (safeNumber(previousQuarter.totalRevenueBn) + safeNumber(nextQuarter.totalRevenueBn)) / 2;
    if (neighborAverageRevenueBn > 0.02) {
      const revenueJumpRatio = safeNumber(quarter.totalRevenueBn) / neighborAverageRevenueBn;
      if (revenueJumpRatio < 0.45 || revenueJumpRatio > 1.85) return false;
    }
    return true;
  };

  for (let index = 1; index < quarters.length - 1; index += 1) {
    const quarter = quarters[index];
    const previousQuarter = quarters[index - 1];
    const nextQuarter = quarters[index + 1];
    if (!isStrictOfficialSegmentsSandwichQuarter(quarter, previousQuarter, nextQuarter)) continue;

    const previousKeys = stableQuarterKeys(previousQuarter);
    const currentKeys = stableQuarterKeys(quarter);
    const missingKeys = previousKeys.filter((key) => !currentKeys.includes(key));
    const extraKeys = currentKeys.filter((key) => !previousKeys.includes(key));

    if (missingKeys.length && !extraKeys.length) {
      const rawResidualValue = safeNumber(quarter.segmentMap?.otherrevenue, 0);
      const currentStableTotal = (quarter.segmentRows || []).reduce((sum, item) => {
        if (!item?.key || item.key === "otherrevenue" || item.key === "reportedrevenue") return sum;
        return sum + safeNumber(item.valueBn);
      }, 0);
      const availableGapValue = rawResidualValue > 0.02 ? rawResidualValue : Math.max(safeNumber(quarter.totalRevenueBn) - currentStableTotal, 0);
      const previousShares = rowShareMap(previousQuarter.segmentRows);
      const nextShares = rowShareMap(nextQuarter.segmentRows);
      const weightByMissingKey = Object.fromEntries(
        missingKeys.map((key) => [key, Math.max((safeNumber(previousShares[key]) + safeNumber(nextShares[key])) / 2, 0)])
      );
      const totalMissingWeight = Object.values(weightByMissingKey).reduce((sum, value) => sum + safeNumber(value), 0);
      if (availableGapValue > 0.12 && totalMissingWeight > 0.000001) {
        const missingRows = missingKeys
          .map((key) => {
            const estimatedValueBn = Number((availableGapValue * safeNumber(weightByMissingKey[key]) / totalMissingWeight).toFixed(3));
            if (!(estimatedValueBn > 0.02)) return null;
            const templateRow =
              previousQuarter.segmentRows.find((item) => item.key === key) ||
              nextQuarter.segmentRows.find((item) => item.key === key) ||
              null;
            const canonicalMeta = canonicalBarSegmentMeta(company?.id, key, templateRow?.name || "Segment", templateRow?.nameZh || "");
            return {
              key,
              name: canonicalMeta.name || templateRow?.name || "Segment",
              nameZh: canonicalMeta.nameZh || templateRow?.nameZh || translateBusinessLabelToZh(templateRow?.name || "Segment"),
              valueBn: estimatedValueBn,
            };
          })
          .filter(Boolean);
        const missingValueTotal = missingRows.reduce((sum, item) => sum + safeNumber(item?.valueBn), 0);
        if (missingValueTotal > 0.02) {
          const nextRows = (quarter.segmentRows || []).filter((item) => item.key !== "otherrevenue");
          nextRows.push(...missingRows);
          const residualAfterFill = Number((availableGapValue - missingValueTotal).toFixed(3));
          if (residualAfterFill > 0.03) {
            const residualMeta = canonicalBarSegmentMeta(company?.id, "otherrevenue", "Other revenue", "其他营收");
            nextRows.push({
              key: canonicalBarSegmentKey(company?.id, "otherrevenue", "Other revenue"),
              name: residualMeta.name,
              nameZh: residualMeta.nameZh,
              valueBn: residualAfterFill,
            });
          }
          rebuildQuarterRows(quarter, nextRows);
          quarter.isBackfilledSegments = true;
          appendReconciliationMode(quarter, "strict-sandwich-gap-filled");
          continue;
        }
      }
    }

    const previousShares = rowShareMap(previousQuarter.segmentRows);
    const nextShares = rowShareMap(nextQuarter.segmentRows);
    const blendedShares = {};
    previousKeys.forEach((key) => {
      blendedShares[key] = (safeNumber(previousShares[key]) + safeNumber(nextShares[key])) / 2;
    });
    const syntheticRows = synthesizeRowsFromShares(quarter, previousQuarter.segmentRows, blendedShares);
    if (!syntheticRows.length) continue;
    quarter.segmentRows = syntheticRows;
    quarter.segmentMap = Object.fromEntries(syntheticRows.map((item) => [item.key, safeNumber(item.valueBn)]));
    quarter.segmentSchemaTag = previousQuarter.segmentSchemaTag;
    quarter.segmentSchemaFamily = previousQuarter.segmentSchemaFamily;
    quarter.isBackfilledSegments = true;
    quarter.isSmoothedSegments = true;
    appendReconciliationMode(quarter, "strict-sandwich-harmonized");
  }

  const isStrictOfficialGroupsSandwichQuarter = (quarter, previousQuarter, nextQuarter) => {
    if (
      !quarter?.hasRevenueValue ||
      !previousQuarter?.hasRevenueValue ||
      !nextQuarter?.hasRevenueValue ||
      !(previousQuarter?.segmentRows?.length >= 2 && nextQuarter?.segmentRows?.length >= 2)
    ) {
      return false;
    }
    if (String(quarter?.rawSegmentSource || "") !== "official-groups") return false;
    const previousKeys = stableQuarterKeys(previousQuarter);
    const nextKeys = stableQuarterKeys(nextQuarter);
    const currentKeys = stableQuarterKeys(quarter);
    if (!previousKeys.length || previousKeys.join("|") !== nextKeys.join("|")) return false;
    if (currentKeys.join("|") === previousKeys.join("|")) return false;
    const coverage = safeNumber(quarter.rawCoverageRatio, null);
    return coverage === null || (coverage >= 0.95 && coverage <= 1.05);
  };

  for (let index = 1; index < quarters.length - 1; index += 1) {
    const quarter = quarters[index];
    const previousQuarter = quarters[index - 1];
    const nextQuarter = quarters[index + 1];
    if (!isStrictOfficialGroupsSandwichQuarter(quarter, previousQuarter, nextQuarter)) continue;

    const targetSignature = stableQuarterKeys(previousQuarter).join("|");
    const alignment = alignQuarterRowsToAnchorRegime(company, quarter, previousQuarter);
    const alignedKeys = [...new Set((alignment.rows || []).map((item) => item?.key).filter((key) => key && key !== "otherrevenue" && key !== "reportedrevenue"))].sort();
    if (alignment.comparable && alignedKeys.join("|") === targetSignature) {
      const reconciled = reconcileBarSegmentRowsToRevenue(company, alignment.rows, quarter.totalRevenueBn, {
        minCoverageForResidualAddition: 0.62,
      });
      quarter.segmentRows = reconciled.rows;
      quarter.segmentMap = Object.fromEntries(reconciled.rows.map((item) => [item.key, safeNumber(item.valueBn)]));
      quarter.segmentSchemaTag = previousQuarter.segmentSchemaTag;
      quarter.segmentSchemaFamily = previousQuarter.segmentSchemaFamily;
      quarter.isBackfilledSegments = true;
      appendReconciliationMode(quarter, "strict-official-groups-aligned");
      continue;
    }
  }

  const shareMapForQuarter = (quarter) => {
    const total = quarter.segmentRows.reduce((sum, item) => sum + safeNumber(item.valueBn), 0);
    if (!(total > 0.02)) return {};
    return Object.fromEntries(
      quarter.segmentRows.map((item) => [item.key, safeNumber(item.valueBn) / total])
    );
  };

  for (let index = 1; index < quarters.length - 1; index += 1) {
    const quarter = quarters[index];
    const previousQuarter = quarters[index - 1];
    const nextQuarter = quarters[index + 1];
    if (
      quarter.segmentRows.length < 2 ||
      previousQuarter.segmentRows.length < 2 ||
      nextQuarter.segmentRows.length < 2 ||
      !quarter.hasRevenueValue
    ) {
      continue;
    }
    const quarterKeys = [...new Set(quarter.segmentRows.map((item) => item.key))].sort();
    const previousKeys = [...new Set(previousQuarter.segmentRows.map((item) => item.key))].sort();
    const nextKeys = [...new Set(nextQuarter.segmentRows.map((item) => item.key))].sort();
    if (
      quarterKeys.length !== previousKeys.length ||
      quarterKeys.length !== nextKeys.length ||
      quarterKeys.join("|") !== previousKeys.join("|") ||
      quarterKeys.join("|") !== nextKeys.join("|")
    ) {
      continue;
    }

    const currentShares = shareMapForQuarter(quarter);
    const previousShares = shareMapForQuarter(previousQuarter);
    const nextShares = shareMapForQuarter(nextQuarter);
    const neighborAverageRevenueBn = (safeNumber(previousQuarter.totalRevenueBn) + safeNumber(nextQuarter.totalRevenueBn)) / 2;
    const revenueJumpRatio =
      neighborAverageRevenueBn > 0.02 ? safeNumber(quarter.totalRevenueBn) / neighborAverageRevenueBn : 1;

    let maxShareDeviation = 0;
    let topShare = 0;
    quarterKeys.forEach((key) => {
      const currentShare = safeNumber(currentShares[key]);
      const neighborShare = (safeNumber(previousShares[key]) + safeNumber(nextShares[key])) / 2;
      maxShareDeviation = Math.max(maxShareDeviation, Math.abs(currentShare - neighborShare));
      topShare = Math.max(topShare, currentShare);
    });

    const shouldRebalance =
      maxShareDeviation > 0.3 &&
      topShare > 0.68 &&
      revenueJumpRatio < 1.3 &&
      !quarter.isSmoothedSegments;
    if (!shouldRebalance) continue;

    const rebalancedRows = quarter.segmentRows.map((item) => {
      const neighborShare = (safeNumber(previousShares[item.key]) + safeNumber(nextShares[item.key])) / 2;
      const valueBn = Number((safeNumber(quarter.totalRevenueBn) * clamp(neighborShare, 0, 1)).toFixed(3));
      return {
        ...item,
        valueBn,
      };
    });
    const rebalancedTotal = rebalancedRows.reduce((sum, item) => sum + safeNumber(item.valueBn), 0);
    const residual = Number((safeNumber(quarter.totalRevenueBn) - rebalancedTotal).toFixed(3));
    if (Math.abs(residual) > 0.004 && rebalancedRows.length) {
      rebalancedRows[0].valueBn = Number((safeNumber(rebalancedRows[0].valueBn) + residual).toFixed(3));
    }
    rebalancedRows.sort((left, right) => safeNumber(right.valueBn) - safeNumber(left.valueBn));
    quarter.segmentRows = rebalancedRows;
    quarter.segmentMap = Object.fromEntries(rebalancedRows.map((item) => [item.key, safeNumber(item.valueBn)]));
    quarter.isSmoothedSegments = true;
    quarter.reconciliationMode =
      quarter.reconciliationMode === "none"
        ? "neighbor-share-rebalanced"
        : `${quarter.reconciliationMode}+neighbor-share-rebalanced`;
  }

  const totals = new Map();
  const nameRegistry = new Map();
  quarters.forEach((quarter) => {
    quarter.segmentRows.forEach((item) => {
      totals.set(item.key, (totals.get(item.key) || 0) + safeNumber(item.valueBn));
      if (!nameRegistry.has(item.key)) {
        const canonicalMeta = canonicalBarSegmentMeta(company?.id, item.key, item.name, item.nameZh || "");
        nameRegistry.set(item.key, {
          name: canonicalMeta.name || item.name,
          nameZh: canonicalMeta.nameZh || item.nameZh || translateBusinessLabelToZh(item.name || ""),
        });
      }
    });
  });

  let sortedSegmentKeys = [...totals.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([key]) => key);

  if (!sortedSegmentKeys.length) return null;

  const maxSegments = 9;
  if (sortedSegmentKeys.length > maxSegments) {
    const keepKeys = new Set(sortedSegmentKeys.slice(0, maxSegments - 1));
    const otherKey = "__other_segments__";
    nameRegistry.set(otherKey, {
      name: "Other segments",
      nameZh: "其他分部",
    });
    quarters.forEach((quarter) => {
      let otherValue = 0;
      const nextMap = {};
      Object.entries(quarter.segmentMap).forEach(([key, value]) => {
        if (keepKeys.has(key)) {
          nextMap[key] = safeNumber(value);
        } else {
          otherValue += safeNumber(value);
        }
      });
      if (otherValue > 0.02) {
        nextMap[otherKey] = Number(otherValue.toFixed(3));
      }
      quarter.segmentMap = nextMap;
      quarter.totalRevenueBn =
        safeNumber(quarter.totalRevenueBn, null) > 0.02
          ? safeNumber(quarter.totalRevenueBn)
          : Object.values(nextMap).reduce((sum, value) => sum + safeNumber(value), 0);
    });
    totals.clear();
    quarters.forEach((quarter) => {
      Object.entries(quarter.segmentMap).forEach(([key, value]) => {
        totals.set(key, (totals.get(key) || 0) + safeNumber(value));
      });
    });
    sortedSegmentKeys = [...totals.entries()]
      .sort((left, right) => right[1] - left[1])
      .map(([key]) => key);
  }

  const colorBySegment = stableBarColorMap(company?.id, sortedSegmentKeys);

  const segmentStats = sortedSegmentKeys.map((segmentKey) => ({
    key: segmentKey,
    totalValueBn: Number(safeNumber(totals.get(segmentKey)).toFixed(3)),
    name: nameRegistry.get(segmentKey)?.name || "Segment",
    nameZh: nameRegistry.get(segmentKey)?.nameZh || translateBusinessLabelToZh(nameRegistry.get(segmentKey)?.name || "Segment"),
    color: colorBySegment[segmentKey],
  }));

  const displayCurrencySet = [...new Set(quarters.map((item) => item.displayCurrency).filter(Boolean))];
  const sourceCurrencySet = [...new Set(quarters.map((item) => item.sourceCurrency).filter(Boolean))];
  const convertedQuarterCount = quarters.filter((item) => Math.abs(safeNumber(item.displayScaleFactor, 1) - 1) > 0.000001).length;
  const availableQuarterCount = quarters.filter((item) => item.hasRevenueValue).length;
  const missingQuarterCount = Math.max(0, quarters.length - availableQuarterCount);
  const imputedQuarterCount = quarters.filter((item) => item.isImputedSegments).length;
  const smoothedQuarterCount = quarters.filter((item) => item.isSmoothedSegments).length;
  const reportedSegmentQuarterCount = quarters.filter((item) => item.hasRawSegments && !item.wasReportedOnlyRaw && !item.insufficientSegments).length;
  const primaryDisplayCurrency = displayCurrencySet.length === 1 ? displayCurrencySet[0] : "MIXED";

  return {
    quarters,
    segmentStats,
    colorBySegment,
    stackOrder: segmentStats.slice().sort((left, right) => left.totalValueBn - right.totalValueBn).map((item) => item.key),
    maxRevenueBn: Math.max(...quarters.map((item) => safeNumber(item.totalRevenueBn)), 1),
    anchorQuarterKey: selectedQuarterKeys[selectedQuarterKeys.length - 1] || null,
    requestedQuarterCount: windowSize,
    availableQuarterCount,
    missingQuarterCount,
    reportedSegmentQuarterCount,
    imputedQuarterCount,
    smoothedQuarterCount,
    convertedQuarterCount,
    displayCurrencySet,
    sourceCurrencySet,
    primaryDisplayCurrency,
  };
}

function formatBarSegmentValue(valueBn) {
  const numeric = safeNumber(valueBn);
  if (numeric >= 10) return `${Math.round(numeric)}`;
  if (numeric >= 1) return `${Math.round(numeric)}`;
  return numeric.toFixed(1);
}

function barAxisUnitLines(history) {
  const currency = String(history?.primaryDisplayCurrency || "USD").toUpperCase();
  if (currentChartLanguage() === "en") {
    if (currency === "USD") return { line1: "In $", line2: "billion" };
    if (currency === "MIXED") return { line1: "Mixed", line2: "currencies" };
    return { line1: `In ${currency}`, line2: "billion" };
  }
  if (currency === "USD") return { line1: "单位", line2: "十亿美元" };
  if (currency === "MIXED") return { line1: "单位", line2: "混合币种" };
  return { line1: "单位", line2: `${currency} 十亿` };
}

function renderRevenueSegmentBarsSvg(snapshot, company, options = {}) {
  const width = 2048;
  const height = 1325;
  const history = buildRevenueSegmentBarHistory(company, snapshot?.quarterKey, safeNumber(options.maxQuarters, 30));
  const chartTitle =
    currentChartLanguage() === "en"
      ? `${displayChartTitle(company?.nameEn || "")} Revenue by Segment`
      : `${company?.nameZh || company?.nameEn || ""} 分部营收趋势`;
  if (!history || !history.quarters.length) {
    return {
      svg: `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(chartTitle)}">
          <rect x="0" y="0" width="${width}" height="${height}" fill="#F3F3F3"></rect>
          <g id="chartContent">
            <text x="${width / 2}" y="150" text-anchor="middle" font-size="96" font-weight="800" fill="#155C8F">${escapeHtml(chartTitle)}</text>
            <text x="${width / 2}" y="${height / 2}" text-anchor="middle" font-size="44" fill="#6B7280">${
              currentChartLanguage() === "en" ? "No segment history available." : "缺少可用的分部历史数据。"
            }</text>
          </g>
        </svg>
      `,
      history: null,
      width,
      height,
    };
  }

  const background = "#F3F3F3";
  const titleColor = "#155C8F";
  const mutedText = "#6B7280";
  const axisText = "#145B8E";
  const unitLines = barAxisUnitLines(history);
  const hasConvertedCurrency = history.convertedQuarterCount > 0;
  const barCount = history.quarters.length;
  const plotLeft = 94;
  const plotRight = width - 38;
  const titleX = width / 2;
  const titleY = 146;
  const titleLength = String(chartTitle || "").length;
  const titleFontSize =
    currentChartLanguage() === "en"
      ? clamp(88 - Math.max(titleLength - 30, 0) * 1.25, 56, 88)
      : clamp(80 - Math.max(titleLength - 16, 0) * 1.75, 52, 80);

  const latestQuarter = history.quarters[history.quarters.length - 1] || null;
  const latestPeriodEndRaw =
    formatPeriodEndLabel(latestQuarter?.entry?.periodEnd || "") ||
    latestQuarter?.entry?.periodEnd ||
    snapshot?.periodEndLabel ||
    "";
  const latestFiscalLabel = latestQuarter?.label || compactFiscalLabel(snapshot?.fiscalLabel || "") || "";
  const latestPeriodEnd = localizePeriodEndLabel(latestPeriodEndRaw);
  const legendItems = history.segmentStats;
  const legendTop = 218;
  const legendAreaLeft = plotLeft + 120;
  const legendAreaRight = plotRight - 120;
  const legendAvailableWidth = Math.max(320, legendAreaRight - legendAreaLeft);
  const legendRowGap = 20;
  const swatchSize = legendItems.length <= 3 ? 28 : 24;
  const swatchGap = 10;
  const legendItemGap = currentChartLanguage() === "en" ? 46 : 40;
  const maxLegendRows = legendItems.length <= 3 ? 1 : 2;

  const fitLegendLabel = (label, fontSize, maxTextWidth, options = {}) => {
    const raw = String(label || "").trim();
    if (!raw) return "";
    const truncate = options.truncate !== false;
    if (approximateTextWidth(raw, fontSize) <= maxTextWidth || !truncate) return raw;
    if (raw.length <= 4) return raw;
    let cut = raw.length;
    while (cut > 2) {
      const trial = `${raw.slice(0, cut)}...`;
      if (approximateTextWidth(trial, fontSize) <= maxTextWidth) return trial;
      cut -= 1;
    }
    return `${raw.slice(0, 2)}...`;
  };
  const buildLegendRows = (fontSize, options = {}) => {
    const truncateLabels = options.truncate !== false;
    const rows = [[]];
    const rowWidths = [0];
    legendItems.forEach((item) => {
      const rawLabel = localizedBarSegmentName(item);
      const maxLabelWidth = Math.max(
        truncateLabels ? 150 : 240,
        truncateLabels
          ? Math.min(
              legendAvailableWidth * (maxLegendRows === 1 ? 0.34 : 0.5),
              legendAvailableWidth - swatchSize - swatchGap - 20
            )
          : legendAvailableWidth - swatchSize - swatchGap - 20
      );
      const label = fitLegendLabel(rawLabel, fontSize, maxLabelWidth, { truncate: truncateLabels });
      const itemWidth = swatchSize + swatchGap + approximateTextWidth(label, fontSize);
      let rowIndex = rows.length - 1;
      let row = rows[rowIndex];
      let currentWidth = rowWidths[rowIndex];
      const neededGap = row.length ? legendItemGap : 0;
      if (row.length && currentWidth + neededGap + itemWidth > legendAvailableWidth) {
        rows.push([]);
        rowWidths.push(0);
        rowIndex += 1;
        row = rows[rowIndex];
        currentWidth = rowWidths[rowIndex];
      }
      const offsetX = currentWidth + (row.length ? legendItemGap : 0);
      row.push({
        item,
        label,
        itemWidth,
        offsetX,
      });
      rowWidths[rowIndex] = offsetX + itemWidth;
    });
    return {
      rows,
      rowWidths,
      hasOverflow: rowWidths.some((width) => width > legendAvailableWidth + 0.5),
    };
  };
  const isEnglishLegend = currentChartLanguage() === "en";
  let legendFontSize =
    isEnglishLegend
      ? 26
      : legendItems.length <= 3
        ? 32
        : 25;
  const legendMinFontSize = isEnglishLegend ? 18 : 18;
  let legendLayout = buildLegendRows(legendFontSize, { truncate: !isEnglishLegend });
  while ((legendLayout.rows.length > maxLegendRows || legendLayout.hasOverflow) && legendFontSize > legendMinFontSize) {
    legendFontSize -= 1;
    legendLayout = buildLegendRows(legendFontSize, { truncate: !isEnglishLegend });
  }
  if (isEnglishLegend && (legendLayout.rows.length > maxLegendRows || legendLayout.hasOverflow)) {
    while ((legendLayout.rows.length > maxLegendRows || legendLayout.hasOverflow) && legendFontSize > 18) {
      legendFontSize -= 1;
      legendLayout = buildLegendRows(legendFontSize, { truncate: true });
    }
  }
  const legendRows = legendLayout.rows;
  const legendRowWidths = legendLayout.rowWidths;
  const legendLineHeight = Math.round(legendFontSize * 1.12);
  const legendTotalHeight = legendRows.length * legendLineHeight + Math.max(0, legendRows.length - 1) * legendRowGap;

  const baselineY = 1166;
  const chartTop = legendTop + legendTotalHeight + 18;
  const barGap = barCount >= 28 ? 7 : barCount >= 22 ? 9 : 11;
  let barWidth = Math.floor((plotRight - plotLeft - barGap * Math.max(barCount - 1, 0)) / Math.max(barCount, 1));
  barWidth = clamp(barWidth, 16, 56);
  const barsTotalWidth = barWidth * barCount + barGap * Math.max(barCount - 1, 0);
  const barStartX = plotLeft + Math.max((plotRight - plotLeft - barsTotalWidth) / 2, 0);
  const chartHeight = Math.max(baselineY - chartTop, 120);
  const valueScale = chartHeight / Math.max(history.maxRevenueBn, 1);
  const barCornerRadius = Math.min(14, Math.max(6, barWidth * 0.24));
  const topQuarterFontSize = currentChartLanguage() === "en" ? 58 : 56;
  const periodEndFontSize = currentChartLanguage() === "en" ? 28 : 26;
  const topInfoX = width - 76;
  const topQuarterY = titleY - 6;
  const estimatedQuarterLeft = topInfoX - approximateTextWidth(latestFiscalLabel, topQuarterFontSize);
  const estimatedTitleRight = titleX + approximateTextWidth(chartTitle, titleFontSize) / 2;
  const estimatedPeriodLeft = topInfoX - approximateTextWidth(latestPeriodEnd, periodEndFontSize);
  const topInfoNeedsShift = estimatedQuarterLeft < estimatedTitleRight + 26 || estimatedPeriodLeft < estimatedTitleRight + 26;
  const topQuarterDisplayY = topInfoNeedsShift ? titleY + 30 : topQuarterY;
  const topPeriodY = topInfoNeedsShift ? titleY + 64 : titleY + 30;
  const yLabelFontSize = currentChartLanguage() === "en" ? 22 : 20;
  const xLabelBaseFontSize = barCount >= 28 ? 14 : barCount >= 24 ? 15 : 17;
  const xLabelFontSize = Math.round(xLabelBaseFontSize * 1.15);
  const xLabelAngle = 38;
  const approxXLabelWidth = approximateTextWidth("Q4 FY25", xLabelFontSize);
  const minSlotForLabel = approxXLabelWidth * Math.cos((xLabelAngle * Math.PI) / 180) * 0.95;
  const strideByWidth = Math.ceil(minSlotForLabel / Math.max(barWidth + barGap, 1));
  const strideByCount = Math.ceil(barCount / 16);
  const labelStride = Math.max(1, strideByWidth, strideByCount);
  const maxGridLines = 6;
  const gridStep = Math.max(5, Math.ceil(history.maxRevenueBn / maxGridLines / 5) * 5);
  const gridValues = [];
  for (let value = gridStep; value < history.maxRevenueBn; value += gridStep) {
    gridValues.push(value);
  }
  const chartLogoKey = snapshot?.companyLogoKey || company?.id || "";
  const chartLogoVisibleMetrics = corporateLogoVisibleMetrics(chartLogoKey);
  const chartLogoArea = {
    width: 250,
    height: 156,
    x: plotLeft + 12,
    y: chartTop + 8,
  };
  const chartLogoScale = Math.min(
    chartLogoArea.width / Math.max(chartLogoVisibleMetrics.width, 1),
    chartLogoArea.height / Math.max(chartLogoVisibleMetrics.height, 1)
  );
  const chartLogoRenderWidth = chartLogoVisibleMetrics.width * chartLogoScale;
  const chartLogoRenderHeight = chartLogoVisibleMetrics.height * chartLogoScale;
  const chartLogoX = chartLogoArea.x + (chartLogoArea.width - chartLogoRenderWidth) / 2;
  const chartLogoY = chartLogoArea.y + (chartLogoArea.height - chartLogoRenderHeight) / 2;
  const isNonUsCompany = !!company?.isAdr;
  const fxNoteY = isNonUsCompany ? height - 34 : chartTop - 10;
  const fxNoteX = isNonUsCompany ? 38 : plotLeft;
  const fxNoteFontSize = isNonUsCompany ? 20 : 18;

  let svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(chartTitle)}">
      <rect x="0" y="0" width="${width}" height="${height}" fill="${background}"></rect>
      <g id="chartContent">
        <text x="${titleX}" y="${titleY}" text-anchor="middle" font-size="${titleFontSize}" font-weight="800" fill="${titleColor}">${escapeHtml(chartTitle)}</text>
        ${
          latestFiscalLabel
            ? `<text x="${topInfoX}" y="${topQuarterDisplayY}" text-anchor="end" font-size="${topQuarterFontSize}" font-weight="700" fill="#575C63">${escapeHtml(
                latestFiscalLabel
              )}</text>`
            : ""
        }
        ${
          latestPeriodEnd
            ? `<text x="${topInfoX}" y="${topPeriodY}" text-anchor="end" font-size="${periodEndFontSize}" font-weight="600" fill="${mutedText}">${escapeHtml(
                latestPeriodEnd
              )}</text>`
            : ""
        }
        <text x="${Math.max(18, plotLeft - 72).toFixed(2)}" y="${(legendTop + 18).toFixed(2)}" text-anchor="start" font-size="${yLabelFontSize}" font-weight="700" fill="${axisText}">${escapeHtml(
    unitLines.line1
  )}</text>
        <text x="${Math.max(18, plotLeft - 72).toFixed(2)}" y="${(legendTop + 48).toFixed(2)}" text-anchor="start" font-size="${yLabelFontSize}" font-weight="700" fill="${axisText}">${escapeHtml(
    unitLines.line2
  )}</text>
        ${
          hasConvertedCurrency
            ? `<text x="${fxNoteX}" y="${fxNoteY.toFixed(2)}" text-anchor="start" font-size="${fxNoteFontSize}" fill="#7B8490">${
                currentChartLanguage() === "en" ? "Converted to USD by filing-date FX rates." : "已按申报日汇率折算为美元。"
              }</text>`
            : ""
        }
  `;

  legendRows.forEach((row, rowIndex) => {
    const rowWidth = legendRowWidths[rowIndex] || 0;
    const centeredFromTitle = titleX - rowWidth / 2;
    const rowStartX = clamp(centeredFromTitle, legendAreaLeft, Math.max(legendAreaLeft, legendAreaRight - rowWidth));
    const rowY = legendTop + rowIndex * (legendLineHeight + legendRowGap);
    row.forEach((entry) => {
      const swatchX = rowStartX + entry.offsetX;
      const swatchY = rowY + (legendLineHeight - swatchSize) / 2;
      const textX = swatchX + swatchSize + swatchGap;
      const textY = rowY + legendFontSize * 0.82;
      svg += `<rect x="${swatchX.toFixed(2)}" y="${swatchY.toFixed(2)}" width="${swatchSize}" height="${swatchSize}" rx="${
        swatchSize * 0.24
      }" fill="${entry.item.color}"></rect>`;
      svg += `<text x="${textX.toFixed(2)}" y="${textY.toFixed(2)}" text-anchor="start" font-size="${legendFontSize}" font-weight="700" fill="${axisText}">${escapeHtml(
        entry.label
      )}</text>`;
    });
  });

  gridValues.forEach((gridValue) => {
    const y = baselineY - gridValue * valueScale;
    if (y <= chartTop + 8 || y >= baselineY - 8) return;
    svg += `<line x1="${plotLeft}" y1="${y.toFixed(2)}" x2="${plotRight}" y2="${y.toFixed(2)}" stroke="#DDE2E8" stroke-width="1.4"></line>`;
    svg += `<text x="${plotLeft - 14}" y="${(y + 6).toFixed(2)}" text-anchor="end" font-size="18" fill="#8A9098">${escapeHtml(
      `${Math.round(gridValue)}`
    )}</text>`;
  });
  svg += `<line x1="${plotLeft}" y1="${baselineY}" x2="${plotRight}" y2="${baselineY}" stroke="#C9CED6" stroke-width="2.2"></line>`;
  svg += `
    <g opacity="0.98">
      ${renderCorporateLogo(chartLogoKey, chartLogoX.toFixed(2), chartLogoY.toFixed(2), { scale: Number(chartLogoScale.toFixed(4)) })}
    </g>
  `;

  history.quarters.forEach((quarter, quarterIndex) => {
    const x = barStartX + quarterIndex * (barWidth + barGap);
    const activeKeys = history.stackOrder.filter((segmentKey) => safeNumber(quarter.segmentMap?.[segmentKey]) > 0.005);
    let cursorBottom = baselineY;
    activeKeys.forEach((segmentKey, segmentIndex) => {
      const valueBn = safeNumber(quarter.segmentMap?.[segmentKey]);
      const heightValue = Math.max(valueBn * valueScale, 1.2);
      const y = cursorBottom - heightValue;
      const isBottom = segmentIndex === 0;
      const isTop = segmentIndex === activeKeys.length - 1;
      const fillColor = history.colorBySegment[segmentKey] || "#1CA1E2";
      svg += stackedBarSegmentElement(
        x,
        y,
        barWidth,
        heightValue,
        barCornerRadius,
        isTop,
        isBottom,
        fillColor
      );
      const valueLabel = formatBarSegmentValue(valueBn);
      const valueFontSize = clamp(Math.round(barWidth * 0.42), 11, 24);
      if (heightValue >= valueFontSize + 7) {
        svg += `<text x="${x + barWidth / 2}" y="${y + heightValue / 2 + valueFontSize * 0.34}" text-anchor="middle" font-size="${valueFontSize}" font-weight="700" fill="${barSegmentTextColor(
          fillColor
        )}">${escapeHtml(
          valueLabel
        )}</text>`;
      }
      cursorBottom = y;
    });
    if (!activeKeys.length) {
      const placeholderHeight = 8;
      const placeholderY = baselineY - placeholderHeight;
      svg += `<rect x="${x.toFixed(2)}" y="${placeholderY.toFixed(2)}" width="${barWidth.toFixed(2)}" height="${placeholderHeight.toFixed(
        2
      )}" rx="${Math.min(4, barCornerRadius)}" fill="#C8D0DA" stroke="#AEB5BE" stroke-width="1"></rect>`;
    }
    const tickX = x + barWidth / 2;
    const tickY = baselineY + 30;
    const shouldRenderTick =
      quarterIndex % labelStride === 0 || quarterIndex === 0 || quarterIndex === barCount - 1;
    if (shouldRenderTick) {
      svg += `<text x="${tickX}" y="${tickY}" text-anchor="middle" font-size="${xLabelFontSize}" font-weight="700" fill="#111111" transform="rotate(${xLabelAngle} ${tickX} ${tickY})">${escapeHtml(
        quarter.label
      )}</text>`;
    }
  });

  svg += "</g></svg>";
  return {
    svg,
    history,
    width,
    height,
  };
}

function renderIncomeStatementSvg(snapshot, company) {
  if (snapshot.mode === "pixel-replica" || snapshot.mode === "replica-template") {
    return renderPixelReplicaSvg(snapshot);
  }
  const width = 1600;
  const height = 900;
  const titleText = localizeChartTitle(snapshot);
  const titleFontSize = 82;
  const titleX = width / 2;
  const titleY = 104;
  const inlinePeriodLayout = inlinePeriodEndLayout({
    titleText,
    titleFontSize,
    titleX,
    titleY,
    periodEndFontSize: 28,
    width,
    rightPadding: 70,
  });
  const periodEndX = inlinePeriodLayout.periodEndX;
  const periodEndY = inlinePeriodLayout.periodEndY;
  const revenue = Number(snapshot.revenueBn || 0);
  const companyBrand = resolvedCompanyBrand(company);
  const grossProfit = Number(snapshot.grossProfitBn || 0);
  const costOfRevenue =
    snapshot.costOfRevenueBn !== null && snapshot.costOfRevenueBn !== undefined
      ? Number(snapshot.costOfRevenueBn || 0)
      : Math.max(revenue - grossProfit, 0);
  const operatingProfit = Number(snapshot.operatingProfitBn || 0);
  const operatingExpenses =
    snapshot.operatingExpensesBn !== null && snapshot.operatingExpensesBn !== undefined
      ? Number(snapshot.operatingExpensesBn || 0)
      : Math.max(grossProfit - operatingProfit, 0);
  const netOutcome = resolvedNetOutcomeValue(snapshot);
  const netLoss = isLossMakingNetOutcome(snapshot);
  const nearZeroNet = isNearZeroNetOutcome(snapshot);
  const netProfit = netLoss ? Math.abs(netOutcome) : Math.max(netOutcome, 0);
  const sources = [...(snapshot.businessGroups || [])].filter((item) => Number(item.valueBn || 0) > 0.02);
  const opexItems = [...(snapshot.opexBreakdown || [])].filter((item) => Number(item.valueBn || 0) > 0.02);
  const positiveAdjustments = [...(snapshot.positiveAdjustments || [])].filter((item) => Number(item.valueBn || 0) > 0.02);
  const belowOperatingItems = [...(snapshot.belowOperatingItems || [])].filter((item) => Number(item.valueBn || 0) > 0.02);

  const titleColor = snapshot.mode === "pixel-replica" ? "#145B8E" : "#17496D";
  const background = snapshot.mode === "pixel-replica" ? "#F6F5F2" : "#F7FBFF";
  const profitFill = "#9BD199";
  const profitNode = "#2CA52C";
  const expenseFill = "#EA9294";
  const expenseNode = "#E10600";
  const neutralNode = "#6A6A6A";

  const leftNodeX = 340;
  const revenueX = 556;
  const grossX = 812;
  const opX = 1078;
  const rightX = 1328;
  const nodeWidth = snapshot.mode === "pixel-replica" ? 56 : 42;
  const centerY = 468;
  const scale = 410 / Math.max(revenue, 1);

  const revenueHeight = Math.max(revenue * scale, 4);
  const grossHeight = Math.max(grossProfit * scale, 2);
  const costHeight = Math.max(costOfRevenue * scale, 2);
  const opHeight = Math.max(operatingProfit * scale, 2);
  const opexHeight = Math.max(operatingExpenses * scale, 2);
  const netHeight = Math.max(netProfit * scale, nearZeroNet ? 4 : 2);

  const revenueTop = centerY - revenueHeight / 2;
  const revenueBottom = centerY + revenueHeight / 2;
  const grossTop = centerY - grossHeight / 2;
  const grossBottom = grossTop + grossHeight;
  const costTop = grossBottom;
  const costBottom = revenueBottom;
  const opTop = grossTop;
  const opBottom = opTop + opHeight;
  const opexTop = opBottom;
  const opexBottom = grossBottom;
  const netTop = opTop;
  const netBottom = netTop + netHeight;
  const fallbackExpenseTitleSize = 26;
  const fallbackExpenseValueSize = 26;
  const fallbackExpenseVisualGap = 18;
  const fallbackExpenseBaselineY = (nodeBottom) => nodeBottom + fallbackExpenseVisualGap + fallbackExpenseTitleSize * 0.82;

  const bridgeHeight = Math.min(opHeight, netHeight);
  const bridgeSourceBottom = opTop + bridgeHeight;
  const bridgeTargetBottom = netTop + bridgeHeight;

  let svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(titleText)}">
      <rect x="0" y="0" width="${width}" height="${height}" fill="${background}"></rect>
      <g id="chartContent">
      <text x="${titleX}" y="${titleY}" text-anchor="middle" font-size="${titleFontSize}" font-weight="800" fill="${titleColor}" letter-spacing="0.5">${escapeHtml(titleText)}</text>
      ${snapshot.periodEndLabel ? `<text x="${periodEndX}" y="${periodEndY}" text-anchor="start" font-size="28" fill="#5E6269">${escapeHtml(localizePeriodEndLabel(snapshot.periodEndLabel || ""))}</text>` : ""}
      ${renderCorporateLogo(snapshot.companyLogoKey, 650, 172)}
    `;

  let sourceCursor = revenueTop;
  sources.forEach((item) => {
    const value = Number(item.valueBn || 0);
    const heightValue = Math.max(value * scale, 2);
    const top = sourceCursor;
    const bottom = top + heightValue;
    const lockupProfile = lockupLayoutProfile(item.lockupKey);
    const lockupY = top + heightValue / 2 - (lockupProfile?.previewOffset || 30);
    svg += `<path d="${flowPath(leftNodeX + nodeWidth, top, bottom, revenueX, top, bottom)}" fill="${item.flowColor || rgba(companyBrand.primary, 0.48)}" opacity="0.94"></path>`;
    svg += `<rect x="${leftNodeX}" y="${top.toFixed(1)}" width="${nodeWidth}" height="${heightValue.toFixed(1)}" fill="${item.nodeColor || companyBrand.primary}"></rect>`;
    svg += renderBusinessLockup(item.lockupKey, 64, lockupY);
    const valueX = 324;
    const labelCenterY = top + heightValue / 2;
    svg += `<text x="${valueX}" y="${labelCenterY - 4}" text-anchor="end" font-size="22" font-weight="500" fill="#666666">${escapeHtml(formatBillions(value))}</text>`;
    if (item.qoqPct !== null && item.qoqPct !== undefined) {
      svg += `<text x="${valueX}" y="${labelCenterY + 18}" text-anchor="end" font-size="13" fill="#8A9098">${escapeHtml(formatGrowthMetric(item.qoqPct, "qoq"))}</text>`;
    }
    if (item.yoyPct !== null && item.yoyPct !== undefined) {
      svg += `<text x="${valueX}" y="${labelCenterY + (item.qoqPct !== null && item.qoqPct !== undefined ? 38 : 18)}" text-anchor="end" font-size="16" fill="#666666">${escapeHtml(formatGrowthMetric(item.yoyPct, "yoy"))}</text>`;
    }
    const fallbackLabelLines =
      currentChartLanguage() === "zh"
        ? wrapLabelWithMaxWidth(localizeChartItemName(item), snapshot.mode === "pixel-replica" ? 22 : 20, currentChartLanguage() === "zh" ? 150 : 180, {
            maxLines: 3,
          })
        : item.displayLines?.length
          ? item.displayLines
          : wrapLines(item.name || "", 14);
    if (fallbackLabelLines.length) {
      svg += svgTextBlock(
        252,
        labelCenterY + (fallbackLabelLines.length > 1 ? 40 : 34),
        fallbackLabelLines,
        {
          fill: "#555555",
          fontSize: snapshot.mode === "pixel-replica" ? 22 : 20,
          weight: 800,
          anchor: "middle",
          lineHeight: snapshot.mode === "pixel-replica" ? 26 : 24,
        }
      );
    }
    if (item.operatingMarginPct !== null && item.operatingMarginPct !== undefined) {
      const offset = fallbackLabelLines.length > 1 ? 76 : 58;
      svg += `<text x="252" y="${labelCenterY + offset}" text-anchor="middle" font-size="15" fill="#666666">${escapeHtml(formatPct(item.operatingMarginPct))} ${marginLabel()}</text>`;
    }
    sourceCursor = bottom;
  });

  svg += `
      <rect x="${revenueX}" y="${revenueTop.toFixed(1)}" width="${nodeWidth}" height="${revenueHeight.toFixed(1)}" fill="${neutralNode}"></rect>
      <text x="${revenueX + nodeWidth / 2}" y="${revenueTop - 28}" text-anchor="middle" font-size="30" font-weight="800" fill="#555A63">${escapeHtml(localizeChartPhrase("Revenue"))}</text>
      <text x="${revenueX + nodeWidth / 2}" y="${revenueTop + 2}" text-anchor="middle" font-size="34" font-weight="800" fill="#555A63">${escapeHtml(formatBillions(revenue))}</text>
      ${snapshot.revenueQoqPct !== null && snapshot.revenueQoqPct !== undefined ? `<text x="${revenueX + nodeWidth / 2}" y="${revenueTop + 28}" text-anchor="middle" font-size="14" fill="#8A9098">${escapeHtml(formatGrowthMetric(snapshot.revenueQoqPct, "qoq"))}</text>` : ""}
      ${snapshot.revenueYoyPct !== null && snapshot.revenueYoyPct !== undefined ? `<text x="${revenueX + nodeWidth / 2}" y="${revenueTop + (snapshot.revenueQoqPct !== null && snapshot.revenueQoqPct !== undefined ? 48 : 28)}" text-anchor="middle" font-size="16" fill="#666666">${escapeHtml(formatGrowthMetric(snapshot.revenueYoyPct, "yoy"))}</text>` : ""}

      <path d="${flowPath(revenueX + nodeWidth, revenueTop, grossBottom, grossX, grossTop, grossBottom)}" fill="${profitFill}" opacity="0.96"></path>
      <path d="${flowPath(revenueX + nodeWidth, grossBottom, revenueBottom, grossX, costTop, costBottom)}" fill="${expenseFill}" opacity="0.96"></path>

      <rect x="${grossX}" y="${grossTop.toFixed(1)}" width="${nodeWidth}" height="${grossHeight.toFixed(1)}" fill="${profitNode}"></rect>
      <text x="${grossX + nodeWidth / 2}" y="${grossTop - 28}" text-anchor="middle" font-size="26" font-weight="800" fill="#089256">${escapeHtml(localizeChartPhrase("Gross profit"))}</text>
      <text x="${grossX + nodeWidth / 2}" y="${grossTop + 2}" text-anchor="middle" font-size="26" font-weight="800" fill="#089256">${escapeHtml(formatBillions(grossProfit))}</text>
      <text x="${grossX + nodeWidth / 2}" y="${grossTop + 28}" text-anchor="middle" font-size="16" fill="#666666">${escapeHtml(formatPct(snapshot.grossMarginPct))} ${marginLabel()}</text>
      ${snapshot.grossMarginYoyDeltaPp !== null && snapshot.grossMarginYoyDeltaPp !== undefined ? `<text x="${grossX + nodeWidth / 2}" y="${grossTop + 52}" text-anchor="middle" font-size="15" fill="#666666">${escapeHtml(formatPp(snapshot.grossMarginYoyDeltaPp))}</text>` : ""}

      <rect x="${grossX}" y="${costTop.toFixed(1)}" width="${nodeWidth}" height="${costHeight.toFixed(1)}" fill="${expenseNode}"></rect>
      <text x="${grossX + nodeWidth / 2}" y="${fallbackExpenseBaselineY(costBottom)}" text-anchor="middle" font-size="${fallbackExpenseTitleSize}" font-weight="800" fill="#8C1F0A">${escapeHtml(localizeChartPhrase("Cost of revenue"))}</text>
      <text x="${grossX + nodeWidth / 2}" y="${fallbackExpenseBaselineY(costBottom) + 30}" text-anchor="middle" font-size="${fallbackExpenseValueSize}" font-weight="800" fill="#8C1F0A">${escapeHtml(formatBillions(costOfRevenue, true))}</text>

      <path d="${flowPath(grossX + nodeWidth, grossTop, opBottom, opX, opTop, opBottom)}" fill="${profitFill}" opacity="0.96"></path>
      <path d="${flowPath(grossX + nodeWidth, opBottom, grossBottom, opX, opexTop, opexBottom)}" fill="${expenseFill}" opacity="0.96"></path>

      <rect x="${opX}" y="${opTop.toFixed(1)}" width="${nodeWidth}" height="${opHeight.toFixed(1)}" fill="${profitNode}"></rect>
      <text x="${opX + nodeWidth / 2}" y="${opTop - 28}" text-anchor="middle" font-size="26" font-weight="800" fill="#089256">${escapeHtml(localizeChartPhrase("Operating profit"))}</text>
      <text x="${opX + nodeWidth / 2}" y="${opTop + 2}" text-anchor="middle" font-size="26" font-weight="800" fill="#089256">${escapeHtml(formatBillions(operatingProfit))}</text>
      <text x="${opX + nodeWidth / 2}" y="${opTop + 28}" text-anchor="middle" font-size="16" fill="#666666">${escapeHtml(formatPct(snapshot.operatingMarginPct))} ${marginLabel()}</text>
      ${snapshot.operatingMarginYoyDeltaPp !== null && snapshot.operatingMarginYoyDeltaPp !== undefined ? `<text x="${opX + nodeWidth / 2}" y="${opTop + 52}" text-anchor="middle" font-size="15" fill="#666666">${escapeHtml(formatPp(snapshot.operatingMarginYoyDeltaPp))}</text>` : ""}

      <rect x="${opX}" y="${opexTop.toFixed(1)}" width="${nodeWidth}" height="${opexHeight.toFixed(1)}" fill="${expenseNode}"></rect>
      <text x="${opX + nodeWidth / 2}" y="${fallbackExpenseBaselineY(opexBottom)}" text-anchor="middle" font-size="${fallbackExpenseTitleSize}" font-weight="800" fill="#8C1F0A">${escapeHtml(localizeChartPhrase("Operating expenses"))}</text>
      <text x="${opX + nodeWidth / 2}" y="${fallbackExpenseBaselineY(opexBottom) + 30}" text-anchor="middle" font-size="${fallbackExpenseValueSize}" font-weight="800" fill="#8C1F0A">${escapeHtml(formatBillions(operatingExpenses, true))}</text>
    `;

  if (revenue > 0) {
    svg += `<text x="${opX + nodeWidth / 2}" y="${fallbackExpenseBaselineY(opexBottom) + 56}" text-anchor="middle" font-size="16" fill="#666666">${escapeHtml(formatPct((operatingExpenses / revenue) * 100))} ${ofRevenueLabel()}</text>`;
  }

  svg += `
      <path d="${flowPath(opX + nodeWidth, opTop, bridgeSourceBottom, rightX, netTop, bridgeTargetBottom)}" fill="${netLoss ? expenseFill : profitFill}" opacity="0.96"></path>
      <rect x="${rightX}" y="${netTop.toFixed(1)}" width="${nodeWidth}" height="${bridgeHeight.toFixed(1)}" fill="${netLoss ? expenseNode : profitNode}"></rect>
      ${svgTextBlock(rightX + 62, netTop + 12, [localizeChartPhrase(resolvedNetOutcomeLabel(snapshot)), formatNetOutcomeBillions(snapshot)], { fill: netLoss ? "#8C1F0A" : "#089256", fontSize: 24, weight: 800, lineHeight: 30 })}
      <text x="${rightX + 62}" y="${netTop + 68}" font-size="16" fill="#666666">${escapeHtml(formatPct(snapshot.netMarginPct))} ${marginLabel()}</text>
      ${snapshot.netMarginYoyDeltaPp !== null && snapshot.netMarginYoyDeltaPp !== undefined ? `<text x="${rightX + 62}" y="${netTop + 92}" font-size="15" fill="#666666">${escapeHtml(formatPp(snapshot.netMarginYoyDeltaPp))}</text>` : ""}
    `;

  let positiveCursor = bridgeTargetBottom;
  positiveAdjustments.forEach((item) => {
    const itemHeight = Math.max(Number(item.valueBn || 0) * scale, 4);
    svg += `<rect x="${rightX}" y="${positiveCursor.toFixed(1)}" width="${nodeWidth}" height="${itemHeight.toFixed(1)}" fill="${item.color || "#16A34A"}"></rect>`;
      svg += svgTextBlock(rightX + 62, positiveCursor + 14, [item.name, `+${formatBillions(item.valueBn)}`], {
        fill: "#089256",
        fontSize: 16,
        weight: 800,
        lineHeight: 20,
      });
    positiveCursor += itemHeight + 10;
  });

  let belowCursor = netBottom;
  belowOperatingItems.forEach((item, index) => {
    const itemHeight = Math.max(Number(item.valueBn || 0) * scale, index === 0 ? 10 : 4);
    const itemTop = belowCursor + (index === 0 ? 0 : 26);
    const itemBottom = itemTop + itemHeight;
    svg += `<path d="${outboundFlowPath(opX + nodeWidth, itemTop, itemBottom, rightX, itemTop, itemBottom, { targetCoverInsetX: 12 })}" fill="${expenseFill}" opacity="0.96"></path>`;
    svg += `<rect x="${rightX}" y="${itemTop.toFixed(1)}" width="${nodeWidth}" height="${itemHeight.toFixed(1)}" fill="${item.color || expenseNode}"></rect>`;
    svg += svgTextBlock(rightX + 62, itemTop + 6, [item.name, formatBillions(item.valueBn, true)], {
      fill: "#8C1F0A",
      fontSize: 16,
      weight: 800,
      lineHeight: 20,
    });
    belowCursor = itemBottom;
  });

  const opexTotal = opexItems.reduce((sum, item) => sum + Number(item.valueBn || 0), 0);
  let opexTargetY = 566;
  const opexTargetX = rightX;
  opexItems.forEach((item) => {
    const itemHeight = Math.max(Number(item.valueBn || 0) * scale, 5);
    const itemTop = opexTargetY;
    const itemBottom = itemTop + itemHeight;
    const sourceShare = opexTotal > 0 ? Number(item.valueBn || 0) / opexTotal : 0;
    const sourceCenter = opexTop + opexHeight * sourceShare * 0.5 + opexHeight * Math.max(0, opexItems.indexOf(item) / Math.max(opexItems.length, 1)) * 0.34;
    svg += `<path d="${outboundFlowPath(opX + nodeWidth, sourceCenter - itemHeight / 2, sourceCenter + itemHeight / 2, opexTargetX, itemTop, itemBottom, { targetCoverInsetX: 12 })}" fill="${expenseFill}" opacity="0.96"></path>`;
    svg += `<rect x="${opexTargetX}" y="${itemTop.toFixed(1)}" width="${nodeWidth}" height="${itemHeight.toFixed(1)}" fill="${item.color || expenseNode}"></rect>`;
    svg += svgTextBlock(opexTargetX + 62, itemTop + 6, [item.name, formatBillions(item.valueBn, true)], {
      fill: "#8C1F0A",
      fontSize: 16,
      weight: 800,
      lineHeight: 20,
    });
    if (item.note) {
      svg += `<text x="${opexTargetX + 62}" y="${itemTop + 44}" font-size="13" fill="#666666">${escapeHtml(displayChartNote(item.note))}</text>`;
    }
    opexTargetY = itemBottom + 48;
  });

  svg += `</g></svg>`;
  return svg;
}

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

function updateMeta(snapshot, company, viewPayload = null) {
  const isBarMode = currentChartViewMode() === "bars";
  refs.toolbarCompany.textContent = companyDisplay(company);
  refs.toolbarQuarter.textContent = `${snapshot.quarterKey} · ${snapshot.fiscalLabel || "-"}`;
  updateDatasetTimestampUi();

  if (isBarMode) {
    const history = viewPayload?.history || null;
    const quarterCount = history?.quarters?.length || 0;
    const requestedQuarterCount = history?.requestedQuarterCount || quarterCount || 30;
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
        ? `${companyDisplay(company)} · ${quarterCount}/${requestedQuarterCount} quarters · Stacked segment bars`
        : `${companyDisplay(company)} · ${quarterCount}/${requestedQuarterCount} 个季度 · 分部堆叠柱状图`;
    refs.detailSegmentCount.textContent = currentChartLanguage() === "en" ? `${segmentCount} segments` : `${segmentCount} 个`;
    refs.detailSegmentNote.textContent =
      currentChartLanguage() === "en"
        ? `Each bar shows quarterly revenue split by segment; categories follow each filing period's official taxonomy.`
        : `每个柱子代表一个季度，并按分部营收堆叠；分类严格遵循各期官方披露口径。`;
    refs.detailStatementSummary.textContent = `${formatBillionsInCurrency(earliestRevenue, primaryDisplayCurrency)} → ${formatBillionsInCurrency(
      latestRevenue,
      primaryDisplayCurrency
    )}`;
    refs.detailStatementNote.textContent =
      growthPct !== null && Number.isFinite(growthPct)
        ? currentChartLanguage() === "en"
          ? `Window growth: ${formatPct(growthPct, true)} · 30-quarter continuity verified`
          : `窗口营收增长：${formatPct(growthPct, true)} · 30 季连续性已校验`
        : currentChartLanguage() === "en"
          ? `30-quarter continuity verified`
          : `30 季连续性已校验`;
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
    refs.chartMeta.textContent = [companyDisplay(company), snapshot.quarterKey].filter(Boolean).join(" · ");
    refs.detailSegmentCount.textContent = `${snapshot.businessGroups?.length || 0} 个`;
    refs.detailSegmentNote.textContent =
      snapshot.mode === "pixel-replica"
        ? "当前季度使用统一高精复刻模板生成，并按参考样板参数校准业务板块布局。"
        : "当前季度使用统一高精复刻模板自动生成；如果缺少分部数据，会保留同一套汇聚/分散主桥并自动收敛为单收入块。";
    refs.detailStatementSummary.textContent = `${formatBillions(snapshot.revenueBn)} → ${formatNetOutcomeBillions(snapshot)}`;
    refs.detailStatementNote.textContent = `毛利 ${formatBillions(snapshot.grossProfitBn)} / 营业利润 ${formatBillions(snapshot.operatingProfitBn)}`;
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
    const bbox = content.getBBox();
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
    return { x, y, width, height };
  } catch (_error) {
    return null;
  }
}

function renderCurrent() {
  const company = getCompany(state.selectedCompanyId);
  if (!company) return;
  const quarterKey = refs.quarterSelect?.value || state.selectedQuarter;
  state.selectedQuarter = quarterKey;
  try {
    const snapshot = buildSnapshot(company, quarterKey);
    if (!snapshot) {
      refs.chartOutput.innerHTML = "";
      setStatus("当前公司或季度缺少可用数据。");
      return;
    }
    snapshot.companyNameZh = company.nameZh;
    snapshot.companyNameEn = company.nameEn;
    snapshot.editorNodeOverrides = currentEditorOverrides();
    snapshot.editorSelectedNodeId = state.editor.selectedNodeId;
    snapshot.editModeEnabled = state.editor.enabled;
    state.currentSnapshot = snapshot;
    let barHistory = null;
    const isBarsMode = currentChartViewMode() === "bars";
    if (isBarsMode) {
      const barRenderResult = EarningsVizRuntime.render.renderRevenueSegmentBarsSvg(snapshot, company, { maxQuarters: 30 });
      refs.chartOutput.innerHTML = barRenderResult.svg;
      refs.chartOutput.style.aspectRatio = `${barRenderResult.width} / ${barRenderResult.height}`;
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
    setStatus(
      currentChartViewMode() === "bars"
        ? `已生成 ${company.nameEn} ${quarterKey} 分部柱状图。`
        : `已生成 ${company.nameEn} ${quarterKey} 图像。`
    );
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(() => warmVisibleLogoAssets(), { timeout: 180 });
    } else {
      setTimeout(() => warmVisibleLogoAssets(), 0);
    }
  } catch (error) {
    refs.chartOutput.innerHTML = "";
    syncEditModeUi();
    const message = error?.message || String(error || "图像渲染失败。");
    setStatus(`图像渲染失败：${message}`);
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
}

function exportPng(scaleFactor = 1, suffix = "") {
  const svgText = currentSvgText();
  if (!svgText) {
    setStatus("当前没有可导出的 PNG。");
    return;
  }
  const viewBoxMatch = /viewBox="([0-9.\-]+)\s+([0-9.\-]+)\s+([0-9.]+)\s+([0-9.]+)"/.exec(svgText);
  const exportWidth = Math.max(Math.round((viewBoxMatch ? Number(viewBoxMatch[3]) : 1600) * Math.max(scaleFactor, 1)), 1);
  const exportHeight = Math.max(Math.round((viewBoxMatch ? Number(viewBoxMatch[4]) : 900) * Math.max(scaleFactor, 1)), 1);
  const blob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const image = new Image();
  image.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = exportWidth;
    canvas.height = exportHeight;
    const context = canvas.getContext("2d");
    context.fillStyle = "#f7f7f5";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((pngBlob) => {
      if (!pngBlob) {
        setStatus("PNG 导出失败。");
        URL.revokeObjectURL(url);
        return;
      }
      downloadBlob(pngBlob, `${currentFilenameStem()}${suffix}.png`);
      setStatus(scaleFactor > 1 ? "超清 PNG 已导出。" : "PNG 已导出。");
      URL.revokeObjectURL(url);
    }, "image/png");
  };
  image.onerror = () => {
    URL.revokeObjectURL(url);
    setStatus("PNG 导出失败。");
  };
  image.src = url;
}

async function loadDataset() {
  setStatus("正在加载数据集...");
  const response = await fetchJson(`./data/earnings-dataset.json?v=${BUILD_ASSET_VERSION}`);
  if (!response.ok) throw new Error("数据文件读取失败。");
  state.dataset = await response.json();
  state.sortedCompanies = [...(state.dataset?.companies || [])].map((company, index) => normalizeLoadedCompany(company, index)).sort((left, right) => left.rank - right.rank);
  state.companyById = Object.fromEntries(state.sortedCompanies.map((company) => [company.id, company]));
  state.dataset.companies = state.sortedCompanies;
  await enrichDatasetWithFinancialFallbacks();
}

async function loadLogoCatalog() {
  try {
    const response = await fetchJson(`./data/logo-catalog.json?v=${BUILD_ASSET_VERSION}`);
    if (!response.ok) return;
    const payload = await response.json();
    state.logoCatalog = payload?.logos || {};
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
    const response = await fetchJson(`./data/supplemental-components.json?v=${BUILD_ASSET_VERSION}`);
    if (!response.ok) {
      state.supplementalComponents = {};
      return;
    }
    state.supplementalComponents = await response.json();
  } catch (_error) {
    state.supplementalComponents = {};
  }
}

function fetchJson(url) {
  return fetch(url, {
    cache: "no-store",
  });
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
  refs.quarterSelect?.addEventListener("change", requestRenderCurrent);
  refs.renderBtn?.addEventListener("click", renderCurrent);
  refs.downloadSvgBtn?.addEventListener("click", exportSvg);
  refs.downloadPngBtn?.addEventListener("click", exportPng);
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
    clearCurrentEditorOverrides();
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
      requestEditorRerender();
    });
  }
}

async function boot() {
  queryRefs();
  bindEvents();
  syncChartModeToggleUi();
  try {
    await Promise.all([loadDataset(), loadLogoCatalog(), loadSupplementalComponents()]);
  } catch (error) {
    setStatus(error.message || "数据加载失败。");
    return;
  }
  updateHero();
  initializeDefaultLandingSelection();
  syncQuarterOptions({ preferReplica: false });
  renderCompanyList();
  renderCoverage();
  renderCurrent();
}

document.addEventListener("DOMContentLoaded", boot);
