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
  context.__alibabaPayload = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "dataset-index.json"), "utf8")).companies.find(
    (company) => company.id === "alibaba"
  );
  context.__alibabaHistoryPayload = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "cache", "alibaba.json"), "utf8"));
  return context;
}

function renderNvda(context, language, quarterKey = "2026Q2") {
  context.__language = language;
  context.__quarterKey = quarterKey;
  return vm.runInContext(
    `(() => {
      const company = normalizeLoadedCompany(__nvdaPayload, 0);
      state.uiLanguage = __language;
      state.logoCatalog = {};
      state.supplementalComponents = {};
      const snapshot = buildSnapshot(company, __quarterKey);
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

test("NVDA FY2027 Q2 keeps the prior quarter label wrapping and Sankey width", () => {
  const context = loadRuntime();
  const prior = renderNvda(context, "zh", "2026Q2");
  const latest = renderNvda(context, "zh", "2026Q3");

  assert.deepEqual(Array.from(latest.localizedDetailNames), ["超大规模", "AI云、工业与企业"]);
  assert.match(latest.svg, />超大规模<\/text>/);
  assert.match(latest.svg, />AI云、工业<\/text>/);
  assert.match(latest.svg, />与企业<\/text>/);
  assert.doesNotMatch(latest.svg, />AI 云、工业与企业<\/text>/);
  assert.ok(
    Math.abs(viewBox(latest.svg)[2] - viewBox(prior.svg)[2]) <= 4,
    `latest width ${viewBox(latest.svg)[2]} should stay within 4px of prior width ${viewBox(prior.svg)[2]}`
  );
  for (const nodeId of ["left-detail-0", "left-detail-1", "source-0", "revenue", "gross", "operating", "net"]) {
    assert.ok(
      Math.abs(nodeX(latest.svg, nodeId) - nodeX(prior.svg, nodeId)) <= 4,
      `${nodeId} x should remain quarter-stable`
    );
  }
});

test("NVDA FY2027 Q1 recast detail rows retain comparable Y/Y growth", () => {
  const { snapshot } = renderNvda(loadRuntime(), "zh");
  const details = Object.fromEntries(snapshot.leftDetailGroups.map((item) => [item.name, item]));

  assert.equal(details.Hyperscale.valueBn, 43.05);
  assert.equal(details["AI Clouds, Industrial, & Enterprise"].valueBn, 32.196);
  assert.equal(details.Hyperscale.yoyPct, 144.62);
  assert.equal(details["AI Clouds, Industrial, & Enterprise"].yoyPct, 49.66);
  assert.equal(details.Hyperscale.qoqPct, null);
  assert.equal(details["AI Clouds, Industrial, & Enterprise"].qoqPct, null);
});

test("NVDA FY2027 Q1 market-platform rows include official Y/Y and Q/Q growth", () => {
  const { snapshot } = renderNvda(loadRuntime(), "zh");
  const segments = Object.fromEntries(snapshot.businessGroups.map((item) => [item.name, item]));

  assert.equal(segments["Data Center"].yoyPct, 92.39);
  assert.equal(segments["Data Center"].qoqPct, 20.75);
  assert.equal(segments["Edge Computing"].yoyPct, 28.67);
  assert.equal(segments["Edge Computing"].qoqPct, 9.56);
});

test("NVDA FY2027 Q2 detail growth reconciles to the recast prior-quarter values", () => {
  const context = loadRuntime();
  const prior = renderNvda(context, "zh", "2026Q2").snapshot;
  const latest = renderNvda(context, "zh", "2026Q3").snapshot;
  const priorDetails = Object.fromEntries(prior.leftDetailGroups.map((item) => [item.name, item]));
  const latestDetails = Object.fromEntries(latest.leftDetailGroups.map((item) => [item.name, item]));

  for (const name of ["Hyperscale", "AI Clouds, Industrial, & Enterprise"]) {
    const impliedQoq = Number((((latestDetails[name].valueBn / priorDetails[name].valueBn) - 1) * 100).toFixed(2));
    assert.equal(Number(latestDetails[name].qoqPct.toFixed(2)), impliedQoq);
  }
  assert.ok(
    latestDetails.Hyperscale.valueBn - latestDetails["AI Clouds, Industrial, & Enterprise"].valueBn <
      priorDetails.Hyperscale.valueBn - priorDetails["AI Clouds, Industrial, & Enterprise"].valueBn
  );
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

test("Alibaba latest-only payload suppresses cross-taxonomy QoQ metrics and explains the reporting break", () => {
  const context = loadRuntime();
  const result = vm.runInContext(
    `(() => {
      const company = normalizeLoadedCompany(__alibabaPayload, 0);
      state.uiLanguage = "zh";
      state.logoCatalog = {};
      state.supplementalComponents = {};
      const snapshot = buildSnapshot(company, "2026Q2");
      snapshot.companyNameZh = company.nameZh;
      snapshot.companyNameEn = company.nameEn;
      const svg = EarningsVizRuntime.render.renderIncomeStatementSvg(snapshot, company);
      return {
        businessQoq: snapshot.businessGroups.map((item) => item.qoqPct),
        detailQoq: snapshot.leftDetailGroups.map((item) => item.qoqPct),
        footnote: snapshot.footnote,
        svg,
      };
    })()`,
    context
  );

  assert.ok(result.businessQoq.every((value) => value === null));
  assert.ok(result.detailQoq.every((value) => value === null));
  assert.match(result.footnote, /本季度官方调整了分部报告口径/);
  assert.doesNotMatch(result.svg, /环比[+-]0\.0%|环比-56\.0%/);
});

test("Alibaba Sankey taxonomy changes exactly when the official segment structure changes", () => {
  const context = loadRuntime();
  const result = vm.runInContext(
    `(() => {
      const company = normalizeLoadedCompany(__alibabaHistoryPayload, 0);
      state.uiLanguage = "zh";
      state.logoCatalog = {};
      state.supplementalComponents = {};
      const expectedTransitionQuarters = [];
      const renderedTransitionQuarters = [];
      const mismatches = [];
      let previousOfficialSignature = "";
      let previousRenderedSignature = "";
      for (const quarterKey of company.quarters) {
        const entry = company.financials[quarterKey];
        const snapshot = buildSnapshot(company, quarterKey);
        const officialSegments = (entry.officialRevenueSegments || []).map((item) => item.memberKey);
        const renderedSegments = (snapshot.businessGroups || []).map((item) => item.memberKey || item.id);
        const officialDetails = (entry.officialRevenueDetailGroups || []).map(
          (item) => item.memberKey + ">" + normalizeLabelKey(item.targetName || item.targetId || "")
        );
        const renderedDetails = (snapshot.leftDetailGroups || []).map(
          (item) => (item.id || item.memberKey) + ">" + normalizeLabelKey(item.targetName || item.targetId || "")
        );
        const officialSignature = officialSegments.join("|") + "//" + officialDetails.join("|");
        const renderedSignature = renderedSegments.join("|") + "//" + renderedDetails.join("|");
        if (officialSignature !== previousOfficialSignature) expectedTransitionQuarters.push(quarterKey);
        if (renderedSignature !== previousRenderedSignature) renderedTransitionQuarters.push(quarterKey);
        if (officialSignature !== renderedSignature) mismatches.push(quarterKey);
        previousOfficialSignature = officialSignature;
        previousRenderedSignature = renderedSignature;
      }
      return { expectedTransitionQuarters, renderedTransitionQuarters, mismatches };
    })()`,
    context
  );

  const expected = ["2016Q2", "2021Q2", "2021Q4", "2023Q2", "2025Q2", "2026Q2"];
  assert.deepEqual([...result.expectedTransitionQuarters], expected);
  assert.deepEqual([...result.renderedTransitionQuarters], expected);
  assert.deepEqual([...result.mismatches], []);
});
