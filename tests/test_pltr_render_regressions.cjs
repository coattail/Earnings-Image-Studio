const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");

function createContext() {
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
    performance: { now: () => Date.now() },
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

function loadRuntime() {
  const context = createContext();
  ["app-00-foundation.js", "app-01-layout.js", "app-02-sankey.js", "app-03-data.js", "app-04-bootstrap.js"].forEach((filename) => {
    vm.runInContext(fs.readFileSync(path.join(ROOT, "js", filename), "utf8"), context, { filename });
  });
  const dataset = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "earnings-dataset.json"), "utf8"));
  context.__pltrPayload = dataset.companies.find((company) => company.id === "palantir");
  return context;
}

function renderPltr(context, overrides = {}) {
  context.__overrides = overrides;
  return vm.runInContext(
    `(() => {
      const company = normalizeLoadedCompany(__pltrPayload, 0);
      state.uiLanguage = "zh";
      state.logoCatalog = {};
      state.supplementalComponents = {};
      const snapshot = buildSnapshot(company, "2026Q1");
      snapshot.editorNodeOverrides = __overrides;
      const history = buildRevenueSegmentBarHistory(company, "2026Q1", 30);
      const svg = EarningsVizRuntime.render.renderIncomeStatementSvg(snapshot, company);
      return { history, svg };
    })()`,
    context
  );
}

function parseAttrs(tag) {
  const attrs = {};
  for (const match of tag.matchAll(/([a-zA-Z0-9:-]+)="([^"]*)"/g)) {
    attrs[match[1]] = match[2];
  }
  return attrs;
}

function nodeRect(svg, nodeId) {
  const pattern = new RegExp(`<rect\\b[^>]*data-edit-node-visible-id="${nodeId}"[^>]*>`);
  const tag = svg.match(pattern)?.[0];
  assert.ok(tag, `missing node rect ${nodeId}`);
  const attrs = parseAttrs(tag);
  return {
    x: Number(attrs.x),
    y: Number(attrs.y),
    width: Number(attrs.width),
    height: Number(attrs.height),
    left: Number(attrs.x),
    right: Number(attrs.x) + Number(attrs.width),
    top: Number(attrs.y),
    bottom: Number(attrs.y) + Number(attrs.height),
  };
}

function positiveLabel(svg) {
  const titleTag = [...svg.matchAll(/<text\b[^>]*>(营业外收益)<\/text>/g)].at(-1)?.[0];
  assert.ok(titleTag, "missing positive adjustment title label");
  const attrs = parseAttrs(titleTag);
  return {
    x: Number(attrs.x),
    y: Number(attrs.y),
    anchor: attrs["text-anchor"],
  };
}

test("PLTR bar chart keeps government and commercial in stable comparable buckets", () => {
  const { history } = renderPltr(loadRuntime());

  assert.deepEqual(Array.from(history.segmentStats, (item) => item.key), ["governmentoperating", "commercial"]);
  assert.deepEqual(Array.from(history.quarters.at(-1).segmentRows, (item) => item.key), ["governmentoperating", "commercial"]);
});

test("PLTR Sankey keeps operating profit close enough to gross profit for a smoother upward bridge", () => {
  const { svg } = renderPltr(loadRuntime());
  const gross = nodeRect(svg, "gross");
  const operating = nodeRect(svg, "operating");

  assert.ok(gross.top - operating.top <= 118, `operating node is lifted too far: ${gross.top - operating.top}`);
});

test("PLTR positive adjustment label remains left-attached when operating profit is dragged down", () => {
  const { svg } = renderPltr(loadRuntime(), { operating: { dy: 120 } });
  const positiveNode = nodeRect(svg, "positive-0");
  const label = positiveLabel(svg);

  assert.equal(label.anchor, "end");
  assert.ok(label.x < positiveNode.left - 8, `label should stay left of positive node: ${label.x} >= ${positiveNode.left - 8}`);
});
