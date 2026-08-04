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

function renderPltr(context, overrides = {}, quarter = "2026Q1", snapshotPatch = {}) {
  context.__overrides = overrides;
  context.__quarter = quarter;
  context.__snapshotPatch = snapshotPatch;
  return vm.runInContext(
    `(() => {
      const company = normalizeLoadedCompany(__pltrPayload, 0);
      state.uiLanguage = "zh";
      state.logoCatalog = {};
      state.supplementalComponents = {};
      const snapshot = buildSnapshot(company, __quarter);
      Object.assign(snapshot, __snapshotPatch);
      snapshot.editorNodeOverrides = __overrides;
      const history = buildRevenueSegmentBarHistory(company, __quarter, 30);
      const svg = EarningsVizRuntime.render.renderIncomeStatementSvg(snapshot, company);
      return { history, snapshot, svg };
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

test("PLTR bar chart keeps government and commercial in stable comparable buckets", () => {
  const { history } = renderPltr(loadRuntime());

  assert.deepEqual(Array.from(history.segmentStats, (item) => item.key), ["governmentoperating", "commercial"]);
  assert.deepEqual(Array.from(history.quarters.at(-1).segmentRows, (item) => item.key), ["governmentoperating", "commercial"]);
});

test("PLTR uses the three official operating-expense categories across history and latest", () => {
  const context = loadRuntime();
  for (const quarter of ["2023Q4", "2026Q1", "2026Q2"]) {
    const { snapshot } = renderPltr(context, {}, quarter);
    assert.deepEqual(
      Array.from(snapshot.opexBreakdown, (item) => item.memberKey),
      ["salesandmarketing", "researchanddevelopment", "generalandadministrative"],
      `${quarter} should preserve the official three-line expense taxonomy`
    );
    const detailTotal = Array.from(snapshot.opexBreakdown).reduce((sum, item) => sum + Number(item.valueBn || 0), 0);
    assert.ok(
      Math.abs(detailTotal - snapshot.operatingExpensesBn) <= 0.002,
      `${quarter} opex detail should reconcile: ${detailTotal} vs ${snapshot.operatingExpensesBn}`
    );
  }
});

test("PLTR historical profit chain follows a smooth upward line with a small downward bias", () => {
  const { svg } = renderPltr(loadRuntime(), {}, "2023Q4");
  const gross = nodeRect(svg, "gross");
  const operating = nodeRect(svg, "operating");
  const net = nodeRect(svg, "net");
  const incomingRun = operating.left - gross.right;
  const outgoingRun = net.left - operating.right;
  const straightOperatingTop =
    (gross.top * outgoingRun + net.top * incomingRun) / (incomingRun + outgoingRun);

  assert.ok(gross.top > operating.top && operating.top > net.top, "profit chain should rise at every stage");
  assert.ok(
    operating.top - straightOperatingTop >= 6 && operating.top - straightOperatingTop <= 18,
    `operating node should sit just below the straight interpolation: ${operating.top - straightOperatingTop}`
  );
});

test("dragging PLTR operating profit does not move any sibling or downstream node", () => {
  const context = loadRuntime();
  const noPositiveBridge = {
    positiveAdjustments: [],
    belowOperatingItems: [],
    netProfitBn: 0.066,
  };
  const base = renderPltr(context, {}, "2023Q4", noPositiveBridge).svg;
  const dragged = renderPltr(
    context,
    { operating: { dy: 120 } },
    "2023Q4",
    noPositiveBridge
  ).svg;

  assert.ok(
    Math.abs(nodeRect(dragged, "operating").top - nodeRect(base, "operating").top - 120) <= 0.001,
    "the dragged node should move by exactly the requested offset"
  );
  for (const nodeId of [
    "gross",
    "operating-expenses",
    "net",
    "opex-0",
    "opex-1",
    "opex-2",
  ]) {
    assert.equal(
      nodeRect(dragged, nodeId).top,
      nodeRect(base, nodeId).top,
      `${nodeId} should remain fixed when operating profit is dragged`
    );
  }
});

test("PLTR historical net-profit thickness is explained by explicit bridge flows", () => {
  const { snapshot, svg } = renderPltr(loadRuntime(), {}, "2023Q4");
  const operating = nodeRect(svg, "operating");
  const net = nodeRect(svg, "net");
  const positive = nodeRect(svg, "positive-0");

  assert.ok(net.height > operating.height, "the historical net node is expected to be thicker");
  assert.ok(positive.height > 0, "the positive bridge inflow must be visible");
  assert.equal(Number(snapshot.positiveAdjustments[0].valueBn.toFixed(3)), 0.04);
});

test("PLTR 2020Q4 loss contraction is exactly offset by a visible small gain", () => {
  const { snapshot, svg } = renderPltr(loadRuntime(), {}, "2020Q4");
  const lossDriver = nodeRect(svg, "net-loss-driver-0");
  const positive = nodeRect(svg, "positive-0");
  const net = nodeRect(svg, "net");
  const positiveTotal = Array.from(snapshot.positiveAdjustments).reduce(
    (sum, item) => sum + Number(item.valueBn || 0),
    0
  );
  const negativeTotal = Array.from(snapshot.belowOperatingItems).reduce(
    (sum, item) => sum + Number(item.valueBn || 0),
    0
  );

  assert.ok(Math.abs(positiveTotal - 0.009) <= 0.001);
  assert.ok(Math.abs(positive.height - (lossDriver.height - net.height)) <= 0.2);
  assert.ok(Math.abs(positiveTotal - negativeTotal - snapshot.netProfitBn) <= 0.001);
  assert.match(svg, /\+\$0\.009B/);
});

test("PLTR 2021Q4 aggregates every loss source before the net-loss node", () => {
  const { snapshot, svg } = renderPltr(loadRuntime(), {}, "2021Q4");
  const lossDriver = nodeRect(svg, "net-loss-driver-1");
  const net = nodeRect(svg, "net");
  const negativeTotal = Array.from(snapshot.belowOperatingItems).reduce(
    (sum, item) => sum + Number(item.valueBn || 0),
    0
  );

  assert.ok(Math.abs(negativeTotal - Math.abs(snapshot.netProfitBn)) <= 0.001);
  assert.ok(Math.abs(lossDriver.height - net.height) <= 0.1);
  assert.match(svg, /另含其他净费用/);
  assert.doesNotMatch(svg, /data-edit-node-visible-id="deduction-[0-9]+"/);
});

test("PLTR early quarters render complete conserved Sankey trunks", () => {
  const context = loadRuntime();
  for (const quarter of ["2019Q1", "2019Q2", "2019Q4"]) {
    const { snapshot, svg } = renderPltr(context, {}, quarter);
    const lossDriver = nodeRect(svg, "net-loss-driver-0");
    const net = nodeRect(svg, "net");
    const negativeTotal = Array.from(snapshot.belowOperatingItems).reduce(
      (sum, item) => sum + Number(item.valueBn || 0),
      0
    );
    const positiveTotal = Array.from(snapshot.positiveAdjustments).reduce(
      (sum, item) => sum + Number(item.valueBn || 0),
      0
    );

    nodeRect(svg, "gross");
    nodeRect(svg, "operating-expenses");
    nodeRect(svg, "opex-0");
    nodeRect(svg, "opex-1");
    nodeRect(svg, "opex-2");
    assert.ok(
      Math.abs(negativeTotal - positiveTotal - Math.abs(snapshot.netProfitBn)) <= 0.001,
      `${quarter} below-operating flows should reconcile to net loss`
    );
    assert.ok(lossDriver.height >= net.height - 0.1, `${quarter} loss bridge must not expand without an inflow`);
  }
});
