const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");

function loadRuntime() {
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
  const context = vm.createContext({
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
    fetch: undefined,
  });
  context.globalThis = context;
  context.self = context;
  windowStub.window = windowStub;
  windowStub.self = windowStub;
  windowStub.globalThis = context;
  ["app-00-foundation.js", "app-01-layout.js", "app-02-sankey.js", "app-03-data.js", "app-04-bootstrap.js"].forEach(
    (filename) => vm.runInContext(fs.readFileSync(path.join(ROOT, "js", filename), "utf8"), context, { filename })
  );
  return context;
}

test("ordinary bridge values that format to 0.0B are not renderable", () => {
  const context = loadRuntime();
  context.__entry = {
    revenueBn: 6.051,
    operatingIncomeBn: 1.256,
    netIncomeBn: 1.414,
    displayScaleFactor: 1,
  };

  assert.equal(vm.runInContext("isRenderableFinancialBridgeItem({ valueBn: 0.032 }, __entry)", context), false);
  assert.equal(vm.runInContext("isRenderableFinancialBridgeItem({ valueBn: 0.05 }, __entry)", context), true);
});

test("bridge visibility uses the display-currency scale", () => {
  const context = loadRuntime();
  context.__entry = {
    revenueBn: 10000,
    operatingIncomeBn: 1000,
    netIncomeBn: 900,
    displayScaleFactor: 0.00089,
  };

  assert.equal(vm.runInContext("isRenderableFinancialBridgeItem({ valueBn: 50 }, __entry)", context), false);
  assert.equal(vm.runInContext("isRenderableFinancialBridgeItem({ valueBn: 60 }, __entry)", context), true);
});

test("precise conservation bridges remain renderable below standard display precision", () => {
  const context = loadRuntime();
  context.__entry = {
    revenueBn: 0.4,
    operatingIncomeBn: -0.1,
    netIncomeBn: -0.09,
    displayScaleFactor: 1,
  };

  assert.equal(
    vm.runInContext(
      "isRenderableFinancialBridgeItem({ valueBn: 0.009, preserveForFlowConservation: true, valueFormat: 'positive-plus-precise' }, __entry)",
      context
    ),
    true
  );
  assert.equal(
    vm.runInContext("isRenderableFinancialBridgeItem({ valueBn: 0.009, preserveForFlowConservation: true }, __entry)", context),
    false
  );
});
