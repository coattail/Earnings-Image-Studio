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
  context.__nvdaPayload = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "cache", "nvidia.json"), "utf8"));
  context.__tsmcPayload = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "cache", "tsmc.json"), "utf8"));
  context.__jdPayload = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "cache", "jd.json"), "utf8"));
  return context;
}

function renderNvda(context, language) {
  context.__language = language;
  return vm.runInContext(
    `(() => {
      const company = normalizeLoadedCompany(__nvdaPayload, 0);
      state.uiLanguage = __language;
      state.logoCatalog = {};
      state.supplementalComponents = {};
      const snapshot = buildSnapshot(company, "2026Q2");
      snapshot.companyNameZh = company.nameZh;
      snapshot.companyNameEn = company.nameEn;
      const svg = EarningsVizRuntime.render.renderIncomeStatementSvg(snapshot, company);
      return { svg, snapshot, localizedDetailNames: snapshot.leftDetailGroups.map((item) => localizeChartItemName(item)) };
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

function viewBox(svg) {
  const tag = svg.match(/<svg\b[^>]*>/)?.[0];
  assert.ok(tag, "missing svg root");
  const attrs = parseAttrs(tag);
  return attrs.viewBox.split(/\s+/).map(Number);
}

function nodeX(svg, nodeId) {
  const pattern = new RegExp(`<rect\\b[^>]*data-edit-node-visible-id="${nodeId}"[^>]*>`);
  const tag = svg.match(pattern)?.[0];
  assert.ok(tag, `missing node ${nodeId}`);
  return Number(parseAttrs(tag).x);
}

function nodeRect(svg, nodeId) {
  const pattern = new RegExp(`<rect\\b[^>]*data-edit-node-visible-id="${nodeId}"[^>]*>`);
  const tag = svg.match(pattern)?.[0];
  assert.ok(tag, `missing node ${nodeId}`);
  const attrs = parseAttrs(tag);
  return {
    x: Number(attrs.x),
    y: Number(attrs.y),
    width: Number(attrs.width),
    height: Number(attrs.height),
  };
}

function assertClose(actual, expected, tolerance, message) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: expected ${expected}, got ${actual}`);
}

function nvdaBarHistory(context) {
  return vm.runInContext(
    `(() => {
      const company = normalizeLoadedCompany(__nvdaPayload, 0);
      state.companyById = { [company.id]: company };
      return buildRevenueSegmentBarHistory(company, "2026Q2", 30, { includeAllQuarters: true });
    })()`,
    context
  );
}

function tsmcSnapshot(context, quarterKey) {
  context.__quarterKey = quarterKey;
  return vm.runInContext(
    `(() => {
      const company = normalizeLoadedCompany(__tsmcPayload, 0);
      state.uiLanguage = "zh";
      state.logoCatalog = {};
      state.supplementalComponents = {};
      return buildSnapshot(company, __quarterKey);
    })()`,
    context
  );
}

function renderJd(context, quarterKey) {
  context.__quarterKey = quarterKey;
  return vm.runInContext(
    `(() => {
      const company = normalizeLoadedCompany(__jdPayload, 0);
      state.uiLanguage = "zh";
      state.logoCatalog = {};
      state.supplementalComponents = {};
      state.companyById = { [company.id]: company };
      state.selectedCompanyId = company.id;
      const snapshot = buildSnapshot(company, __quarterKey);
      return {
        svg: EarningsVizRuntime.render.renderIncomeStatementSvg(snapshot, company),
        detailCount: snapshot.leftDetailGroups.length,
      };
    })()`,
    context
  );
}

test("Sankey geometry keeps the same horizontal proportions in Chinese and English", () => {
  const context = loadRuntime();
  const zh = renderNvda(context, "zh");
  const en = renderNvda(context, "en");

  assert.deepEqual(viewBox(zh.svg), viewBox(en.svg));
  for (const nodeId of ["left-detail-0", "left-detail-1", "source-0", "source-1", "revenue", "gross", "operating", "net"]) {
    assert.equal(nodeX(zh.svg, nodeId), nodeX(en.svg, nodeId), `${nodeId} x should not depend on language`);
  }
});

test("NVDA FY2027 Q1 Chinese revenue detail labels are localized", () => {
  const { localizedDetailNames } = renderNvda(loadRuntime(), "zh");

  assert.deepEqual(Array.from(localizedDetailNames), ["超大规模", "AI云、工业与企业"]);
});

test("NVDA FY2027 Q1 revenue detail rows include official latest-quarter Q/Q growth", () => {
  const { snapshot } = renderNvda(loadRuntime(), "zh");
  const details = Object.fromEntries(snapshot.leftDetailGroups.map((item) => [item.name, item]));

  assert.equal(details.Hyperscale.qoqPct, 12);
  assert.equal(details["AI Clouds, Industrial, & Enterprise"].qoqPct, 31);
});

test("TSMC platform growth is converted into each quarter's displayed USD basis", () => {
  const q1 = tsmcSnapshot(loadRuntime(), "2026Q1");
  const q1Dce = q1.businessGroups.find((item) => item.name === "Digital Consumer Electronics");
  const q1Others = q1.businessGroups.find((item) => item.name === "Others");

  assert.ok(q1Dce && q1Others, JSON.stringify(q1.businessGroups));
  assertClose(q1Dce.qoqPct, 25.662, 0.001, "Q1 DCE USD QoQ growth");
  assertClose(q1Others.qoqPct, 14.863, 0.001, "Q1 Others USD QoQ growth");

  const q2 = tsmcSnapshot(loadRuntime(), "2026Q2");
  const q2Dce = q2.businessGroups.find((item) => item.name === "Digital Consumer Electronics");
  const q2Others = q2.businessGroups.find((item) => item.name === "Others");

  assert.ok(q2Dce && q2Others, JSON.stringify(q2.businessGroups));
  assertClose(q2Dce.qoqPct, 4.966, 0.001, "Q2 DCE USD QoQ growth");
  assertClose(q2Others.qoqPct, 4.966, 0.001, "Q2 Others USD QoQ growth");
  assert.notEqual(q2Dce.yoyPct, q2Others.yoyPct);
});

test("JD historical revenue-only Sankey renders the official four-category hierarchy", () => {
  const { svg, detailCount } = renderJd(loadRuntime(), "2019Q2");

  assert.equal(detailCount, 4);
  for (const label of ["电子产品及家电收入", "日用百货收入", "平台及营销收入", "物流及其他服务收入"]) {
    assert.match(svg, new RegExp(label));
  }
  assert.match(svg, />商品收入<\/text>/);
  assert.match(svg, />服务收入<\/text>/);
});

test("NVDA bar history normalizes legacy non-Data Center segments into Edge Computing", () => {
  const history = nvdaBarHistory(loadRuntime());
  const byQuarter = Object.fromEntries(history.quarters.map((quarter) => [quarter.quarterKey, quarter]));

  for (const quarterKey of ["2025Q2", "2026Q1", "2026Q2"]) {
    assert.deepEqual(
      Array.from(byQuarter[quarterKey].segmentRows.map((item) => item.key).sort()),
      ["datacenter", "edgecomputing"],
      `${quarterKey} should use the current NVIDIA market-platform taxonomy`
    );
  }

  assertClose(byQuarter["2025Q2"].segmentMap.edgecomputing, 4.95, 0.001, "FY2026 Q1 recast Edge Computing");
  assertClose(byQuarter["2026Q1"].segmentMap.edgecomputing, 5.813, 0.001, "FY2026 Q4 recast Edge Computing");
  assertClose(byQuarter["2026Q2"].segmentMap.edgecomputing, 6.369, 0.001, "FY2027 Q1 Edge Computing");
  assert.equal(history.colorBySegment.datacenter.toLowerCase(), "#73ae0b");
  assert.equal(history.colorBySegment.edgecomputing.toLowerCase(), "#2d9cdb");
  assert.notEqual(history.colorBySegment.edgecomputing, history.colorBySegment.datacenter);
});

test("positive-heavy NVDA Sankey layout lifts operating and net nodes and keeps the gain bridge attached", () => {
  const { svg } = renderNvda(loadRuntime(), "zh");
  const operating = nodeRect(svg, "operating");
  const positive = nodeRect(svg, "positive-0");
  const net = nodeRect(svg, "net");
  const tax = nodeRect(svg, "deduction-0");
  const rAndD = nodeRect(svg, "opex-0");
  const sgAndA = nodeRect(svg, "opex-1");

  assert.ok(operating.y <= 560, `operating node should move upward in positive-heavy layouts, got y=${operating.y}`);
  assert.ok(net.y <= 350, `net node should move upward with operating profit, got y=${net.y}`);
  assert.ok(net.x - (positive.x + positive.width) <= 120, "positive adjustment node should stay close to the net-income merge");
  assert.ok(
    net.y - positive.y <= 105,
    `positive adjustment node should stay visually attached above net income, got vertical gap=${net.y - positive.y}`
  );
  assert.ok(rAndD.y - (tax.y + tax.height) >= 55, "tax and R&D branches should stay visually separated");
  assert.ok(sgAndA.y - (rAndD.y + rAndD.height) >= 120, "R&D and SG&A branches should remain fanned out");
});
