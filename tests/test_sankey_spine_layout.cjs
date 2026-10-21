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

test('fan envelope preference is bounded and scales with its geometry', () => {
  const options = { ...base, netBalanceTarget: 400, balanceWeight: 3 };
  const a = solve(options), unconstrained = solve(base);
  assert.ok(Math.abs(a.netTop - options.netBalanceTarget) < Math.abs(unconstrained.netTop - options.netBalanceTarget));
  const scaled = Object.fromEntries(Object.entries(options).map(([key, value]) => [key, key === 'balanceWeight' ? value : value * 2]));
  const b = solve(scaled);
  assert.ok(Math.abs(a.operatingTop * 2 - b.operatingTop) < 1e-6);
  assert.ok(Math.abs(a.netTop * 2 - b.netTop) < 1e-6);
  assert.equal(solve({ ...options, pinNet: true }).netTop, options.netTop);
});

function fanCenterError(frames) {
  const left = Object.entries(frames).filter(([id]) => /^(source|left-detail)-/.test(id)).map(([, frame]) => frame);
  const right = Object.entries(frames).filter(([id]) => /^(positive|deduction|opex)-/.test(id) || ['net', 'cost'].includes(id)).map(([, frame]) => frame);
  const center = nodes => (Math.min(...nodes.map(n => n.y)) + Math.max(...nodes.map(n => n.y + n.height))) / 2;
  return Math.abs(center(left) - center(right));
}

test('fan balancing improves the company universe while conserving every node and manual draft', () => {
  const ctx = runtime();
  ctx.payload = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/earnings-dataset.json'), 'utf8'));
  ctx.supplemental = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/supplemental-components.json'), 'utf8'));
  ctx.learned = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/learned-sankey-layouts.json'), 'utf8'));
  const pairs = vm.runInContext(`(() => {
    applyLoadedCompaniesToState(payload.companies, 'full'); state.logoCatalog = {};
    state.supplementalComponents = supplemental; state.learnedSankeyLayouts = learned;
    return companies().map(company => {
      state.selectedCompanyId = company.id; state.selectedQuarter = Object.keys(company.financials).sort().at(-1);
      const snapshot = buildSnapshot(company, state.selectedQuarter);
      const overrides = currentResolvedEditorOverrides();
      snapshot.learnedEditorNodeOverrides = overrides; snapshot.editorNodeOverrides = overrides;
      snapshot.interactiveEditorNodeOverrides = {};
      const render = value => EarningsVizRuntime.render.renderIncomeStatementSvg(value, company);
      const before = JSON.parse(JSON.stringify(snapshot));
      before.layout = { ...before.layout, disableProfitFanBalance: true };
      const draft = JSON.parse(JSON.stringify(snapshot));
      draft.interactiveEditorNodeOverrides = { 'operating': { dx: 0, dy: 36 } };
      draft.editorNodeOverrides = { ...overrides, ...draft.interactiveEditorNodeOverrides };
      return { id: company.id, before: render(before), after: render(snapshot), draft: render(draft),
        learnedOpY: overrides.operating?.dy || 0, requestedDraft: draft.interactiveEditorNodeOverrides };
    });
  })()`, ctx);
  let beforeError = 0, afterError = 0, improved = 0;
  for (const pair of pairs) {
    const before = nodeFrames(pair.before), after = nodeFrames(pair.after), draft = nodeFrames(pair.draft);
    for (const [id, frame] of Object.entries(before)) {
      assert.equal(after[id]?.height, frame.height, `${pair.id}/${id}: monetary thickness`);
      assert.equal(after[id]?.width, frame.width, `${pair.id}/${id}: node width`);
      if (/^(source|left-detail)-/.test(id)) assert.deepEqual(after[id], frame, `${pair.id}: revenue fan stays intact`);
    }
    const oldError = fanCenterError(before), newError = fanCenterError(after);
    beforeError += oldError; afterError += newError;
    if (oldError - newError > 1) improved++;
    assert.equal(pair.requestedDraft.operating.dy, 36, `${pair.id}: keep the saved draft intact`);
    assert.ok(draft.operating.y > after.operating.y - pair.learnedOpY,
      `${pair.id}: a downward manual edit remains effective while nearby ribbons can reflow`);
  }
  assert.ok(improved >= 8, `independent companies improved: ${improved}`);
  assert.ok(afterError < beforeError * 0.95, `aggregate fan center error: ${beforeError} -> ${afterError}`);
});

test('joint ascent constraints find a feasible pair instead of rejecting a boundary move', () => {
  const options = { ...base, operatingMin: 550, operatingMax: 650, netMin: 350, netMax: 380,
    minOperatingRise: 45, maxOperatingRise: 150, minNetRise: 60, maxNetRise: 160,
    maxSlopeChange: 0.14, netBalanceTarget: 220, balanceWeight: 10 };
  const result = solve(options);
  const first = (options.grossTop - result.operatingTop) / options.operatingRunway;
  const second = (result.operatingTop - result.netTop - options.positiveMergeHeight) / options.netRunway;
  assert.ok(result.operatingTop >= 550 && result.operatingTop <= 650);
  assert.ok(result.netTop >= 350 && result.netTop <= 380);
  assert.ok(second >= 60 / 340 - 1e-8 && second <= 160 / 340 + 1e-8);
  assert.ok(Math.abs(first - second) <= 0.14 + 1e-8);
  const scaled = Object.fromEntries(Object.entries(options).map(([key, value]) =>
    [key, ['balanceWeight', 'maxSlopeChange'].includes(key) ? value : value * 3]));
  const large = solve(scaled);
  assert.ok(Math.abs(result.operatingTop * 3 - large.operatingTop) < 1e-6);
  assert.ok(Math.abs(result.netTop * 3 - large.netTop) < 1e-6);
});

test('learned offsets cannot reverse the visible profit spine across companies and older quarters', () => {
  const ctx = runtime();
  ctx.payload = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/earnings-dataset.json'), 'utf8'));
  ctx.supplemental = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/supplemental-components.json'), 'utf8'));
  ctx.learned = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/learned-sankey-layouts.json'), 'utf8'));
  const samples = vm.runInContext(`(() => {
    applyLoadedCompaniesToState(payload.companies, 'full'); state.logoCatalog = {};
    state.supplementalComponents = supplemental; state.learnedSankeyLayouts = learned;
    return [['meta','2026Q1'], ['meta','2026Q2'], ['nvidia','2026Q3'], ['tsmc','2026Q3'],
      ['spacex','2026Q3'], ['tencent','2026Q2'], ['apple','2026Q2'],
      ['berkshire','2021Q1'], ['alibaba','2020Q2'], ['alibaba','2020Q4']].map(([id,quarter]) => {
      const company = getCompany(id); state.selectedCompanyId = id; state.selectedQuarter = quarter;
      const snapshot = buildSnapshot(company, quarter), overrides = currentResolvedEditorOverrides();
      snapshot.learnedEditorNodeOverrides = overrides; snapshot.editorNodeOverrides = overrides;
      snapshot.interactiveEditorNodeOverrides = {};
      const saved = JSON.stringify(snapshot);
      const render = value => EarningsVizRuntime.render.renderIncomeStatementSvg(value, company);
      const reference = JSON.parse(saved);
      reference.layout = { ...reference.layout, disableAutomaticProfitSpine: true };
      const svg = render(snapshot), before = render(reference);
      return { id, quarter, svg, before, untouched: saved === JSON.stringify(snapshot) };
    });
  })()`, ctx);
  for (const { id, quarter, svg, before, untouched } of samples) {
    const label = `${id}/${quarter}`, f = nodeFrames(svg), original = nodeFrames(before);
    const gainHeight = Object.entries(f).filter(([key]) => key.startsWith('positive-')).reduce((sum, [, n]) => sum + n.height, 0);
    const first = (f.gross.y - f.operating.y) / (f.operating.x - f.gross.x - f.gross.width);
    const second = (f.operating.y - f.net.y - gainHeight) / (f.net.x - f.operating.x - f.operating.width);
    assert.ok(first > 0.08 && first < 0.35, `${label}: first ribbon rises gently (${first})`);
    assert.ok(second > 0.1 && second < 0.381, `${label}: connected net port rises (${second})`);
    assert.ok(Math.abs(first - second) < 0.141, `${label}: gradual change in slope`);
    assert.ok(f['operating-expenses'].y > f.operating.y + f.operating.height, `${label}: expenses remain separate`);
    for (const [node, frame] of Object.entries(original)) {
      assert.equal(f[node].height, frame.height, `${label}/${node}: conserve monetary thickness`);
      assert.equal(f[node].width, frame.width, `${label}/${node}: conserve node width`);
    }
    assert.ok(untouched, `${label}: input and saved learned offsets stay intact`);
  }
});

test('presentation bounds stale additive lifts while keeping editing free and saved drafts intact', () => {
  const ctx = runtime();
  ctx.payload = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/earnings-dataset.json'), 'utf8'));
  ctx.supplemental = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/supplemental-components.json'), 'utf8'));
  ctx.learned = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/learned-sankey-layouts.json'), 'utf8'));
  const samples = vm.runInContext(`(() => {
    applyLoadedCompaniesToState(payload.companies, 'full'); state.logoCatalog = {};
    state.supplementalComponents = supplemental; state.learnedSankeyLayouts = learned;
    return [['meta','2026Q1'], ['nvidia','2026Q3'], ['spacex','2026Q3'], ['tsmc','2026Q3']].map(([id,quarter]) => {
      const company = getCompany(id); state.selectedCompanyId = id; state.selectedQuarter = quarter;
      const snapshot = buildSnapshot(company, quarter), learned = learnedSankeyLayoutOverridesForSession();
      const draft = { operating: {dx:0,dy:-120}, net: {dx:0,dy:-156}, 'positive-0': {dx:0,dy:-212} };
      snapshot.learnedEditorNodeOverrides = learned; snapshot.interactiveEditorNodeOverrides = draft;
      snapshot.editorNodeOverrides = mergeEditorNodeOffsets(learned, draft);
      const saved = JSON.stringify(snapshot);
      const render = value => EarningsVizRuntime.render.renderIncomeStatementSvg(value, company);
      const zh = render(snapshot); state.uiLanguage = 'en'; const en = render(snapshot); state.uiLanguage = 'zh';
      const editing = { ...snapshot, editModeEnabled: true };
      const reference = { ...snapshot, editorNodeOverrides: learned, interactiveEditorNodeOverrides: {} };
      return { id, zh, en, editing: render(editing), reference: render(reference), untouched: saved === JSON.stringify(snapshot) };
    });
  })()`, ctx);
  for (const { id, zh, en, editing, reference, untouched } of samples) {
    const f = nodeFrames(zh), english = nodeFrames(en), edited = nodeFrames(editing), original = nodeFrames(reference);
    const gains = Object.entries(f).filter(([key]) => key.startsWith('positive-')).map(([, cap]) => cap);
    const gainHeight = gains.reduce((sum, cap) => sum + cap.height, 0);
    const first = (f.gross.y - f.operating.y) / (f.operating.x - f.gross.x - f.gross.width);
    const last = (f.operating.y - f.net.y - gainHeight) / (f.net.x - f.operating.x - f.operating.width);
    assert.ok(first > 0 && first < 0.35, `${id}: final visible first port stays bounded`);
    assert.ok(last > 0 && last < 0.381, `${id}: final visible net port stays bounded`);
    assert.ok(Math.abs(first - last) < 0.141, `${id}: no sudden turn after old offsets`);
    for (const cap of gains) {
      assert.ok(cap.y > 180, `${id}: gain caps stay below the header`);
      assert.ok(cap.y + cap.height < f.net.y, `${id}: gain caps keep a downward merge lead`);
    }
    for (const [node, frame] of Object.entries(original)) {
      assert.equal(f[node].height, frame.height, `${id}/${node}: monetary thickness stays intact`);
    }
    for (const node of ['revenue', 'gross', 'cost', 'operating', 'operating-expenses', 'net'])
      assert.deepEqual(english[node], f[node], `${id}/${node}: shared final bilingual geometry`);
    assert.ok(edited.operating.y < f.operating.y, `${id}: an active editor retains the requested free position`);
    assert.ok(untouched, `${id}: no destructive migration of the saved draft`);
  }
});
