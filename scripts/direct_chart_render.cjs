#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const DEBUG = process.env.EARNINGS_DIRECT_RENDER_DEBUG === "1";

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = "true";
      continue;
    }
    parsed[key] = next;
    index += 1;
  }
  return parsed;
}

function fail(message, code = 1) {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}

function debug(message) {
  if (!DEBUG) return;
  process.stderr.write(`[direct-render] ${message}\n`);
}

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function quarterSortValue(period) {
  const match = /^(\d{4})Q([1-4])$/.exec(String(period || ""));
  if (!match) return 0;
  return Number(match[1]) * 4 + Number(match[2]);
}

function ensureTrailingNewline(value) {
  return String(value || "").endsWith("\n") ? String(value || "") : `${String(value || "")}\n`;
}

function createVmContext() {
  const noop = () => {};
  const documentStub = {
    addEventListener: noop,
    removeEventListener: noop,
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementById: () => null,
    createElement: () => ({ style: {}, setAttribute: noop, appendChild: noop }),
    createElementNS: () => ({ style: {}, setAttribute: noop, appendChild: noop }),
    body: null,
    documentElement: null,
  };
  const windowStub = {
    addEventListener: noop,
    removeEventListener: noop,
    document: documentStub,
    devicePixelRatio: 1,
  };
  const context = {
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    requestAnimationFrame: (callback) => setTimeout(() => callback(Date.now()), 0),
    cancelAnimationFrame: (handle) => clearTimeout(handle),
    performance: {
      now: () => Date.now(),
    },
    Math,
    Number,
    String,
    Boolean,
    Array,
    Object,
    JSON,
    Date,
    RegExp,
    Map,
    Set,
    WeakMap,
    WeakSet,
    Intl,
    Promise,
    URL,
    URLSearchParams,
    TextEncoder,
    TextDecoder,
    window: windowStub,
    document: documentStub,
    navigator: { userAgent: "node" },
    globalThis: null,
    self: null,
    fetch: undefined,
  };
  context.globalThis = context;
  context.self = context;
  windowStub.window = windowStub;
  windowStub.self = windowStub;
  windowStub.globalThis = context;
  return vm.createContext(context);
}

function loadRuntime(rootDir) {
  const context = createVmContext();
  const scriptPaths = [
    path.join(rootDir, "js", "app-00-foundation.js"),
    path.join(rootDir, "js", "app-01-layout.js"),
    path.join(rootDir, "js", "app-02-sankey.js"),
    path.join(rootDir, "js", "app-03-data.js"),
    path.join(rootDir, "js", "app-04-bootstrap.js"),
  ];
  scriptPaths.forEach((scriptPath) => {
    const source = fs.readFileSync(scriptPath, "utf8");
    vm.runInContext(source, context, { filename: scriptPath });
  });
  const bindings = vm.runInContext(
    "({ state, EarningsVizRuntime, buildSnapshot, normalizeLoadedCompany })",
    context
  );
  return {
    context,
    ...bindings,
  };
}

function writeSvg(filePath, svg) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, ensureTrailingNewline(svg), "utf8");
}

function initializeRuntimeForQuarter(rootDir, companyPayload, quarterKey, language) {
  debug(`initialize runtime for ${companyPayload.ticker || companyPayload.id} ${quarterKey} (${language})`);
  const runtime = loadRuntime(rootDir);
  const normalizeLoadedCompany = runtime.normalizeLoadedCompany;
  const buildSnapshot = runtime.buildSnapshot;
  const state = runtime.state;
  const EarningsVizRuntime = runtime.EarningsVizRuntime;

  if (typeof normalizeLoadedCompany !== "function" || typeof buildSnapshot !== "function" || !state || !EarningsVizRuntime?.render) {
    fail("Earnings runtime did not initialize correctly.");
  }

  const normalizedCompany = normalizeLoadedCompany(companyPayload, 0);
  state.uiLanguage = language;
  state.logoCatalog = loadJson(path.join(rootDir, "data", "logo-catalog.json")).logos || {};
  state.supplementalComponents = loadJson(path.join(rootDir, "data", "supplemental-components.json")) || {};
  state.normalizedLogoKeys = {};
  state.logoNormalizationJobs = {};

  const snapshot = buildSnapshot(normalizedCompany, quarterKey);
  if (!snapshot) {
    fail(`Unable to build snapshot for ${normalizedCompany.ticker || normalizedCompany.id} ${quarterKey}.`);
  }
  snapshot.companyNameZh = normalizedCompany.nameZh;
  snapshot.companyNameEn = normalizedCompany.nameEn;
  snapshot.editorNodeOverrides = {};
  snapshot.editorSelectedNodeId = null;
  snapshot.editModeEnabled = false;
  state.currentSnapshot = snapshot;

  return {
    normalizedCompany,
    snapshot,
    EarningsVizRuntime,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const payloadPath = args.payload ? path.resolve(args.payload) : "";
  const outputDir = args["output-dir"] ? path.resolve(args["output-dir"]) : "";
  const requestedQuarter = String(args.quarter || "latest").trim();
  const requestedLanguage = String(args.language || "zh").trim().toLowerCase() === "en" ? "en" : "zh";
  const modes = String(args.modes || "sankey,bars")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const basename = String(args.basename || "").trim();

  if (!payloadPath || !fs.existsSync(payloadPath)) {
    fail("Missing --payload JSON path.");
  }
  if (!outputDir) {
    fail("Missing --output-dir.");
  }

  const rootDir = path.resolve(__dirname, "..");
  const companyPayload = loadJson(payloadPath);
  if (!companyPayload || typeof companyPayload !== "object") {
    fail("Payload JSON is not an object.");
  }

  const availableQuarters = Array.isArray(companyPayload.quarters)
    ? [...companyPayload.quarters].filter((item) => /^\d{4}Q[1-4]$/.test(String(item || ""))).sort((left, right) => quarterSortValue(left) - quarterSortValue(right))
    : Object.keys(companyPayload.financials || {}).filter((item) => /^\d{4}Q[1-4]$/.test(String(item || ""))).sort((left, right) => quarterSortValue(left) - quarterSortValue(right));
  if (!availableQuarters.length) {
    fail(`No usable quarters found for ${companyPayload.ticker || companyPayload.id || "company"}.`);
  }

  const quarterKey = requestedQuarter === "latest" ? availableQuarters[availableQuarters.length - 1] : requestedQuarter.toUpperCase();
  if (!availableQuarters.includes(quarterKey)) {
    fail(`Quarter ${quarterKey} is not available. Found: ${availableQuarters.join(", ")}`);
  }

  const baseCompanyId = String(companyPayload.id || companyPayload.slug || companyPayload.ticker || "company").trim() || "company";
  const safeBaseName = basename || `${baseCompanyId}-${quarterKey}`;
  const outputs = {};

  if (modes.includes("sankey")) {
    debug("rendering sankey");
    const { normalizedCompany: sankeyCompany, snapshot, EarningsVizRuntime } = initializeRuntimeForQuarter(rootDir, companyPayload, quarterKey, requestedLanguage);
    const sankeySvg = EarningsVizRuntime.render.renderIncomeStatementSvg(snapshot, sankeyCompany);
    const sankeyPath = path.join(outputDir, `${safeBaseName}-sankey.svg`);
    writeSvg(sankeyPath, sankeySvg);
    debug(`wrote sankey svg ${sankeyPath}`);
    outputs.sankey = {
      svg: sankeyPath,
      width: snapshot.mode === "pixel-replica" || snapshot.mode === "replica-template" ? EarningsVizRuntime.layout.snapshotCanvasSize(snapshot).width : 1600,
      height: snapshot.mode === "pixel-replica" || snapshot.mode === "replica-template" ? EarningsVizRuntime.layout.snapshotCanvasSize(snapshot).height : 900,
    };
  }

  if (modes.includes("bars")) {
    debug("rendering bars");
    const { normalizedCompany: barCompany, snapshot, EarningsVizRuntime } = initializeRuntimeForQuarter(rootDir, companyPayload, quarterKey, requestedLanguage);
    const barRender = EarningsVizRuntime.render.renderRevenueSegmentBarsSvg(snapshot, barCompany, { maxQuarters: 30 });
    const barsPath = path.join(outputDir, `${safeBaseName}-bars.svg`);
    writeSvg(barsPath, barRender.svg);
    debug(`wrote bars svg ${barsPath}`);
    outputs.bars = {
      svg: barsPath,
      width: barRender.width,
      height: barRender.height,
      quarterCount: Array.isArray(barRender.history?.quarters) ? barRender.history.quarters.length : 0,
    };
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        companyId: baseCompanyId,
        ticker: companyPayload.ticker || null,
        quarter: quarterKey,
        language: requestedLanguage,
        outputs,
      },
      null,
      2
    )}\n`
  );
  debug("completed");
}

main();
