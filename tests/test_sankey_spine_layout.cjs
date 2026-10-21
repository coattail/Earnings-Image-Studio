const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..');
const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
const pure = vm.createContext({ clamp, Number, Math });
const layoutCode = fs.readFileSync(path.join(ROOT, 'js/app-01-layout.js'), 'utf8');
vm.runInContext(layoutCode.slice(0, layoutCode.indexOf('function sanitizeOfficialStructureRows')), pure);
const solve = pure.resolveProfitSpinePositions;
const base = { grossTop: 700, operatingTop: 450, netTop: 180, operatingMin: 220, operatingMax: 900,
  netMin: 220, netMax: 1200, operatingRunway: 340, netRunway: 340, positiveMergeHeight: 67, unit: 1 };

test('connected ports produce a gentle profit spine despite accumulated legacy lifts', () => {
  const p = solve(base);
  const firstRise = (base.grossTop - p.operatingTop) / base.operatingRunway;
  const secondRise = (p.operatingTop - p.netTop - base.positiveMergeHeight) / base.netRunway;
  assert.ok(firstRise > 0 && firstRise < 0.25);
  assert.ok(secondRise > 0 && secondRise < 0.3);
  assert.ok(Math.abs(firstRise - secondRise) < 0.1);
});

test('adding gains changes the merge port without lifting the entire operating stage', () => {
  const noGains = solve({ ...base, positiveMergeHeight: 0 });
  const gains = solve(base);
  assert.ok(Math.abs(noGains.operatingTop - gains.operatingTop) < 8);
  assert.ok(Math.abs(noGains.netTop - gains.netTop - base.positiveMergeHeight) < 8);
});

test('layout scales uniformly with the canvas and horizontal stage distances', () => {
  const scale = 2.5;
  const scaled = Object.fromEntries(Object.entries(base).map(([key, value]) => [key, value * scale]));
  const a = solve(base), b = solve(scaled);
  assert.ok(Math.abs(a.operatingTop * scale - b.operatingTop) < 1e-6);
  assert.ok(Math.abs(a.netTop * scale - b.netTop) < 1e-6);
});

test('canvas bounds and explicit node pins constrain the joint solution', () => {
  const pinned = solve({ ...base, pinOperating: true, pinNet: true });
  assert.equal(pinned.operatingTop, base.operatingTop);
  assert.equal(pinned.netTop, base.netTop);
  const constrained = solve({ ...base, operatingMax: 530, netMin: 420 });
  assert.ok(constrained.operatingTop <= 530 && constrained.operatingTop >= base.operatingMin);
  assert.ok(constrained.netTop >= 420 && constrained.netTop <= base.netMax);
});

function runtime() {
  const noop = () => {};
  const document = { addEventListener: noop, querySelector: () => null, querySelectorAll: () => [], getElementById: () => null,
    createElement: () => ({ style: {}, setAttribute: noop }), documentElement: null };
  const ctx = vm.createContext({ console, setTimeout, clearTimeout, requestAnimationFrame: () => 1, cancelAnimationFrame: noop,
    Math, Number, String, Boolean, Array, Object, JSON, Date, RegExp, Map, Set, Intl, Promise, URL, URLSearchParams, Blob,
    document, window: { addEventListener: noop, document }, navigator: { userAgent: 'node' } });
  ctx.globalThis = ctx;
  for (const file of ['app-00-foundation.js', 'app-01-layout.js', 'app-02-sankey.js', 'app-03-data.js', 'app-04-bootstrap.js']) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', file), 'utf8'), ctx, { filename: file });
  }
  return ctx;
}
function nodeFrames(svg) {
  return Object.fromEntries([...svg.matchAll(/<rect\b[^>]*data-edit-node-visible-id="([^"]+)"[^>]*>/g)].map(match => {
    const attrs = Object.fromEntries([...match[0].matchAll(/([\w-]+)="([^"]*)"/g)].map(m => [m[1], m[2]]));
    return [match[1], Object.fromEntries(['x', 'y', 'width', 'height'].map(key => [key, Number(attrs[key])]))];
  }));
}

test('real multi-branch charts keep the profit ports shallow across companies', () => {
  const ctx = runtime();
  ctx.payload = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/earnings-dataset.json'), 'utf8'));
  ctx.supplemental = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/supplemental-components.json'), 'utf8'));
  const samples = vm.runInContext(`(() => {
    applyLoadedCompaniesToState(payload.companies, 'full'); state.logoCatalog = {}; state.supplementalComponents = supplemental;
    return ['spacex','nvidia','apple','tencent','netflix','jpmorgan'].map(id => {
      const company = getCompany(id); state.selectedCompanyId = id; state.selectedQuarter = Object.keys(company.financials).sort().at(-1);
      const snapshot = buildSnapshot(company, state.selectedQuarter);
      return { id, svg: EarningsVizRuntime.render.renderIncomeStatementSvg(snapshot, company) };
    });
  })()`, ctx);
  for (const { id, svg } of samples) {
    const f = nodeFrames(svg), g = f.gross, op = f.operating, net = f.net;
    const gains = Object.entries(f).filter(([key]) => key.startsWith('positive-')).map(([, value]) => value);
    const gainHeight = gains.reduce((sum, gain) => sum + gain.height, 0);
    const firstRun = op.x - g.x - g.width, secondRun = net.x - op.x - op.width;
    assert.ok(Math.abs(g.y - op.y) / firstRun < 0.35, `${id}: gross-to-operating rise`);
    assert.ok(Math.abs(op.y - net.y - gainHeight) / secondRun < 0.4, `${id}: operating-to-net rise`);
    if (gains.length > 1) {
      assert.ok(Math.max(...gains.map(gain => gain.y + gain.height)) < net.y, `${id}: gains share an upper lane`);
    }
  }
});
