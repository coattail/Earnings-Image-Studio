const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..');
const pure = vm.createContext({ Math, Number, clamp: (v, lo, hi) => Math.min(Math.max(v, lo), hi) });
const code = fs.readFileSync(path.join(ROOT, 'js/app-01-layout.js'), 'utf8');
vm.runInContext(code.slice(0, code.indexOf('function sanitizeOfficialStructureRows')), pure);
const solve = pure.resolveExpenseStageTop;
const base = { top: 825, sourceTop: 765, targetTop: 1016, incomingRunway: 428, outgoingRunway: 428, minTop: 825, maxTop: 956 };
const bend = (top, p) => Math.abs((top - p.sourceTop) / p.incomingRunway - (p.targetTop - top) / p.outgoingRunway);

test('expense parent balances actual incoming and outgoing ports with unequal stage widths', () => {
  assert.ok(Math.abs(solve(base) - 890.5) < 1e-8);
  const wide = { ...base, incomingRunway: 600, outgoingRunway: 300 };
  assert.ok(bend(solve(wide), wide) < 1e-8);
  for (const factor of [0.5, 2.5, 4]) {
    const scaled = Object.fromEntries(Object.entries(base).map(([k, v]) => [k, v * factor]));
    assert.ok(Math.abs(solve(scaled) - solve(base) * factor) < 1e-8);
  }
  const translated = { ...base };
  for (const key of ['top', 'sourceTop', 'targetTop', 'minTop', 'maxTop']) translated[key] += 400;
  assert.ok(Math.abs(solve(translated) - solve(base) - 400) < 1e-8);
});

test('pins, label bounds and gentle existing routes override aesthetic preference', () => {
  assert.equal(solve({ ...base, pinned: true }), base.top);
  assert.equal(solve({ ...base, top: 885 }), 885);
  assert.equal(solve({ ...base, maxTop: 850 }), 850);
  assert.equal(solve({ ...base, minTop: 960 }), base.top);
  assert.equal(solve({ ...base, incomingRunway: 0 }), base.top);
  assert.equal(solve({ ...base, targetTop: NaN }), base.top);
  // A low parent can be corrected too, while preserving both flow directions.
  const low = { ...base, top: 930, targetTop: 990, minTop: 800, maxTop: 960 };
  assert.ok(solve(low) < low.top);
  assert.ok(bend(solve(low), low) < bend(low.top, low));
});

function runtime() {
  const noop = () => {};
  const document = { addEventListener: noop, querySelector: () => null, querySelectorAll: () => [], getElementById: () => null,
    createElement: () => ({ style: {}, setAttribute: noop }), documentElement: null };
  const ctx = vm.createContext({ console, setTimeout, clearTimeout, requestAnimationFrame: () => 1, cancelAnimationFrame: noop,
    Math, Number, String, Boolean, Array, Object, JSON, Date, RegExp, Map, Set, Intl, Promise, URL, URLSearchParams, Blob,
    document, window: { addEventListener: noop, document }, navigator: { userAgent: 'node' } });
  ctx.globalThis = ctx;
  for (const file of ['app-00-foundation.js', 'app-01-layout.js', 'app-02-sankey.js', 'app-03-data.js', 'app-04-bootstrap.js'])
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', file), 'utf8'), ctx, { filename: file });
  ctx.payload = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/earnings-dataset.json')));
  ctx.supplemental = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/supplemental-components.json')));
  ctx.learned = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/learned-sankey-layouts.json')));
  vm.runInContext(`applyLoadedCompaniesToState(payload.companies,'full');state.logoCatalog={};state.supplementalComponents=supplemental;state.learnedSankeyLayouts=learned;`, ctx);
  return ctx;
}
function frames(svg) {
  return Object.fromEntries([...svg.matchAll(/<rect\b[^>]*data-edit-node-visible-id="([^"]+)"[^>]*>/g)].map(m => {
    const attrs = Object.fromEntries([...m[0].matchAll(/([\w-]+)="([^"]*)"/g)].map(a => [a[1], a[2]]));
    return [m[1], Object.fromEntries(['x', 'y', 'width', 'height'].map(k => [k, +attrs[k]]))];
  }));
}
function firstOutlet(svg) {
  const match = svg.match(/<path d="([^"]+)" fill="#E58A92" opacity="0\.97"><\/path>(?:\s*<rect\b[^>]*><\/rect>)*\s*<rect[^>]*data-edit-node-visible-id="opex-0"[^>]*>/);
  if (!match) return null;
  const points = match[1].match(/-?\d+(?:\.\d+)?/g).map(Number);
  return { top: points[1], bottom: points.at(-1) };
}
function render(ctx, id, quarter, options = {}) {
  Object.assign(ctx, { id, quarter, options });
  return vm.runInContext(`(() => {
    state.selectedCompanyId=id;state.selectedQuarter=quarter;state.uiLanguage=options.language||'zh';
    const company=getCompany(id),snapshot=buildSnapshot(company,quarter),learned=currentResolvedEditorOverrides();
    snapshot.learnedEditorNodeOverrides=learned;snapshot.interactiveEditorNodeOverrides=options.offsets||{};
    snapshot.editorNodeOverrides={...learned,...snapshot.interactiveEditorNodeOverrides};snapshot.editModeEnabled=!!options.editing;
    snapshot.layout={...snapshot.layout,...options.layout};
    const before=JSON.stringify(snapshot),svg=EarningsVizRuntime.render.renderIncomeStatementSvg(snapshot,company);
    return {svg,unchanged:before===JSON.stringify(snapshot)};
  })()`, ctx);
}
function kink(svg) {
  const f = frames(svg), p = f['operating-expenses'], port = firstOutlet(svg);
  if (!p || !port || !f.gross || !f.operating) return null;
  const incoming = (p.y - f.gross.y - f.operating.height) / (p.x - f.gross.x - f.gross.width);
  const outgoing = (f['opex-0'].y - port.top) / (f['opex-0'].x - p.x - p.width);
  return Math.abs(incoming - outgoing);
}

test('Amazon latest stage joins smoothly while already balanced prior quarters retain their placement', () => {
  const ctx = runtime();
  for (const language of ['zh', 'en']) {
    const before = render(ctx, 'amazon', '2026Q3', { language, layout: { disableExpenseStagePortBalance: true } });
    const after = render(ctx, 'amazon', '2026Q3', { language });
    const a = frames(after.svg), b = frames(before.svg);
    assert.ok(a['operating-expenses'].y - b['operating-expenses'].y > 50);
    assert.ok(kink(after.svg) < 0.05, `${language}: final connected ribbon slopes`);
    assert.ok(kink(after.svg) < kink(before.svg) * 0.2);
    for (const id of Object.keys(b)) {
      assert.equal(a[id].height, b[id].height, `${language}/${id}: monetary thickness`);
      if (id !== 'operating-expenses') assert.deepEqual(a[id], b[id], `${language}/${id}: independent stages`);
    }
    assert.ok(after.unchanged);
  }
  for (const quarter of ['2026Q1', '2026Q2']) {
    const after = frames(render(ctx, 'amazon', quarter).svg);
    const before = frames(render(ctx, 'amazon', quarter, { layout: { disableExpenseStagePortBalance: true } }).svg);
    assert.deepEqual(after, before, `${quarter}: already gentle layout remains stable`);
  }
});

test('company universe and older quarters keep amounts, downstream direction and bilingual core positions', () => {
  const ctx = runtime();
  const periods = ctx.payload.companies.map(c => [c.id, c.quarters.at(-1)]);
  for (const id of ['amazon', 'microsoft', 'alphabet', 'meta', 'nvidia', 'apple', 'broadcom', 'tesla'])
    for (const q of ctx.payload.companies.find(c => c.id === id).quarters.slice(-9, -1)) periods.push([id, q]);
  let moved = 0;
  for (const [id, quarter] of periods) {
    const before = render(ctx, id, quarter, { layout: { disableExpenseStagePortBalance: true } });
    const after = render(ctx, id, quarter), english = render(ctx, id, quarter, { language: 'en' });
    const a = frames(after.svg), b = frames(before.svg), en = frames(english.svg);
    assert.ok(!/\b(?:NaN|Infinity)\b/.test(after.svg), `${id}/${quarter}: valid geometry`);
    assert.ok(after.unchanged, `${id}/${quarter}: no snapshot mutation`);
    for (const key of Object.keys(b)) {
      assert.equal(a[key].height, b[key].height, `${id}/${quarter}/${key}: monetary thickness`);
      assert.equal(a[key].width, b[key].width);
      if (['revenue', 'gross', 'operating', 'net', 'cost'].includes(key)) assert.deepEqual(a[key], b[key]);
    }
    if (!a['operating-expenses']) continue;
    assert.deepEqual(a['operating-expenses'], en['operating-expenses'], `${id}/${quarter}: shared bilingual stage`);
    if (a['operating-expenses'].y !== b['operating-expenses'].y) {
      moved++;
      const oldBend = kink(before.svg), newBend = kink(after.svg);
      if (oldBend !== null) assert.ok(newBend <= oldBend + 0.002, `${id}/${quarter}: bend improves`);
      const port = firstOutlet(after.svg);
      if (port) {
        assert.ok(a['opex-0'].y >= port.top - 0.2);
        assert.ok(a['opex-0'].y + a['opex-0'].height >= port.bottom - 0.2);
      }
    }
  }
  assert.ok(moved >= 8, `global port balance improved ${moved} charts`);
});

test('opening the editor is stable and manual expense positioning remains additive', () => {
  const ctx = runtime();
  for (const language of ['zh', 'en']) {
    const baseline = frames(render(ctx, 'amazon', '2026Q3', { language }).svg);
    const opened = frames(render(ctx, 'amazon', '2026Q3', { language, editing: true }).svg);
    assert.deepEqual(opened, baseline);
    for (const dy of [-80, 80]) {
      const offsets = { 'operating-expenses': { dx: 0, dy } };
      const result = render(ctx, 'amazon', '2026Q3', { language, editing: true, offsets });
      assert.ok(Math.abs(frames(result.svg)['operating-expenses'].y - baseline['operating-expenses'].y - dy) < 0.2);
      assert.ok(result.unchanged);
      assert.equal(offsets['operating-expenses'].dy, dy);
    }
    const result = render(ctx, 'amazon', '2026Q3', { language, editing: true, offsets: { 'opex-0': { dx: 0, dy: 80 } } });
    assert.equal(frames(result.svg)['operating-expenses'].y, baseline['operating-expenses'].y, 'a child edit cannot move the automatic parent');
    const pinned = { opexNodeTop: 820 };
    assert.deepEqual(frames(render(ctx, 'amazon', '2026Q3', { language, layout: pinned }).svg),
      frames(render(ctx, 'amazon', '2026Q3', { language, layout: { ...pinned, disableExpenseStagePortBalance: true } }).svg));
  }
});
