const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..');
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
const pure = vm.createContext({ clamp, Number, Math });
const code = fs.readFileSync(path.join(ROOT, 'js/app-01-layout.js'), 'utf8');
vm.runInContext(code.slice(0, code.indexOf('function sanitizeOfficialStructureRows')), pure);
const solve = pure.resolveDirectedBranchColumn;

test('directed columns reserve each source port, node and label footprint', () => {
  const entries = [
    {center: 350, height: 40, sourceCenter: 420, drop: 60},
    {center: 490, height: 140, sourceCenter: 460, drop: 60},
    {center: 680, height: 70, sourceCenter: 530, drop: 60},
  ];
  const options = {minY: 300, maxY: 900, gap: 20};
  const result = solve(entries, options);
  assert.ok(result.feasible); assert.equal(result.dropScale, 1);
  result.centers.forEach((y, i) => {
    assert.ok(y >= entries[i].sourceCenter + entries[i].drop - 1e-6);
    assert.ok(y - entries[i].height / 2 >= options.minY);
    assert.ok(y + entries[i].height / 2 <= options.maxY);
    if (i) assert.ok(y - result.centers[i-1] >= (entries[i].height + entries[i-1].height)/2 + options.gap - 1e-6);
  });
  const scale = 2.5;
  const large = solve(entries.map(e => Object.fromEntries(Object.entries(e).map(([k,v])=>[k,v*scale]))),
    Object.fromEntries(Object.entries(options).map(([k,v])=>[k,v*scale])));
  result.centers.forEach((y,i)=>assert.ok(Math.abs(large.centers[i]-y*scale)<1e-6));
});

test('crowding compresses whitespace and drop without reversing or clipping', () => {
  const entries = [
    {center: 190, height: 100, sourceCenter: 180, drop: 80},
    {center: 390, height: 100, sourceCenter: 240, drop: 80},
    {center: 550, height: 100, sourceCenter: 300, drop: 80},
  ];
  const result = solve(entries, {minY: 100, maxY: 500, gap: 40});
  assert.ok(result.feasible); assert.ok(result.dropScale > 0 && result.dropScale < 1);
  result.centers.forEach((y,i) => {
    assert.ok(y >= entries[i].sourceCenter);
    assert.ok(y+50 <= 500+1e-6);
    if(i) assert.ok(y-result.centers[i-1] >= 100-1e-6);
  });
  const pinned = solve([{...entries[0], center: 280, pinned: true}, entries[1]], {minY:100,maxY:600,gap:20});
  assert.equal(pinned.centers[0], 280);
  const impossible = solve(entries, {minY: 100, maxY: 250, gap: 20});
  assert.equal(impossible.feasible, false);
  assert.deepEqual(Array.from(impossible.centers), entries.map(e=>e.center));
  const crowded = [{center:200,height:50,sourceCenter:250,drop:40},
    {center:450,height:180,sourceCenter:400,drop:40}, {center:510,height:180,sourceCenter:480,drop:20}];
  const repaired = solve(crowded, {minY:100,maxY:600,gap:16,repairLegacyCrowding:true});
  assert.ok(repaired.repaired);
  assert.equal(repaired.centers[0],290);
  assert.equal(repaired.centers[1],450);assert.equal(repaired.centers[2],510);

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


function terminalPorts(svg) {
  return [...svg.matchAll(/<path d="([^"]+)" fill="#E58A92" opacity="0\.97"><\/path>(?:\s*<rect\b[^>]*><\/rect>)*\s*<rect[^>]*data-edit-node-visible-id="((?:deduction|opex|cost-breakdown)-\d+)"[^>]*>/g)].map(m => {
    const n = m[1].match(/-?\d+(?:\.\d+)?/g).map(Number);
    return {id:m[2], sourceTop:n[1], sourceBottom:n.at(-1)};
  });
}

test('universe and historical negative flows descend after the final spine and learned positions', () => {
  const ctx = runtime();
  ctx.payload = JSON.parse(fs.readFileSync(path.join(ROOT,'data/earnings-dataset.json')));
  ctx.supplemental = JSON.parse(fs.readFileSync(path.join(ROOT,'data/supplemental-components.json')));
  ctx.learned = JSON.parse(fs.readFileSync(path.join(ROOT,'data/learned-sankey-layouts.json')));
  const samples = vm.runInContext(`(() => {
    applyLoadedCompaniesToState(payload.companies,'full');state.logoCatalog={};state.supplementalComponents=supplemental;state.learnedSankeyLayouts=learned;
    const periods = companies().map(c=>[c.id,Object.keys(c.financials).sort().at(-1)]);
    periods.push(['visa','2018Q3'],['visa','2021Q2'],['visa','2026Q2'],['microsoft','2024Q3'],
      ['berkshire','2021Q1'],['berkshire','2025Q4'],['eli-lilly','2024Q2'],['sk-hynix','2026Q1'],
      ['amazon','2020Q1'],['alibaba','2022Q1']);
    return periods.map(([id,q]) => {
      const company=getCompany(id);state.selectedCompanyId=id;state.selectedQuarter=q;state.uiLanguage='zh';
      const snapshot=buildSnapshot(company,q), offsets=currentResolvedEditorOverrides();
      snapshot.learnedEditorNodeOverrides=offsets;snapshot.editorNodeOverrides=offsets;snapshot.interactiveEditorNodeOverrides={};
      const saved=JSON.stringify(snapshot), render=s=>EarningsVizRuntime.render.renderIncomeStatementSvg(s,company);
      const before=render({...snapshot,layout:{...snapshot.layout,disableDirectedTerminalLayout:true}}), after=render(snapshot);
      state.uiLanguage='en';const english=render(snapshot);state.uiLanguage='zh';
      return {id,q,before,after,english,untouched:saved===JSON.stringify(snapshot)};
    });
  })()`,ctx);
  let checked=0, corrections=0;
  for(const {id,q,before,after,english,untouched} of samples) {
    const a=nodeFrames(after), b=nodeFrames(before), en=nodeFrames(english), label=`${id}/${q}`;
    assert.ok(!/NaN|undefined/.test(after),label);
    assert.ok(untouched,`${label}: saved offsets stay intact`);
    for(const [node,f] of Object.entries(b)) {
      assert.equal(a[node]?.width,f.width,`${label}/${node}: width`);
      assert.equal(a[node]?.height,f.height,`${label}/${node}: monetary thickness`);
      if(!/^(deduction|opex|cost-breakdown)-/.test(node)) assert.deepEqual(a[node],f,`${label}/${node}: core stays intact`);
      if(en[node]) assert.equal(en[node].height,a[node].height,`${label}/${node}: bilingual monetary thickness`);
    }
    for(const port of terminalPorts(english)) {
      const f=en[port.id];
      assert.ok(f.y >= port.sourceTop-0.2,`${label}/${port.id}: English upper boundary must not rise`);
      assert.ok(f.y+f.height >= port.sourceBottom-0.2,`${label}/${port.id}: English lower boundary must not rise`);
    }
    for(const port of terminalPorts(after)) {
      const f=a[port.id];checked++;
      assert.ok(f.y >= port.sourceTop-0.2,`${label}/${port.id}: upper boundary must not rise`);
      assert.ok(f.y+f.height >= port.sourceBottom-0.2,`${label}/${port.id}: lower boundary must not rise`);
      if(b[port.id].y < f.y-1)corrections++;
    }
  }
  assert.ok(checked>150);assert.ok(corrections>=6);
});

test('Visa small gains keep a downward tax lead and active editors keep free positioning', () => {
  const ctx=runtime();ctx.payload=JSON.parse(fs.readFileSync(path.join(ROOT,'data/earnings-dataset.json')));
  const result=vm.runInContext(`(() => {
    applyLoadedCompaniesToState(payload.companies,'full');state.logoCatalog={};state.selectedCompanyId='visa';state.selectedQuarter='2026Q3';
    const company=getCompany('visa'),s=buildSnapshot(company,'2026Q3'),render=v=>EarningsVizRuntime.render.renderIncomeStatementSvg(v,company);
    const normal=render(s),draft={...s,editorNodeOverrides:{'deduction-0':{dx:0,dy:-140}},interactiveEditorNodeOverrides:{'deduction-0':{dx:0,dy:-140}}};
    return {normal,editing:render({...draft,editModeEnabled:true}),final:render(draft)};
  })()`,ctx);
  const normal=nodeFrames(result.normal), edited=nodeFrames(result.editing), final=nodeFrames(result.final);
  const port=terminalPorts(result.normal).find(p=>p.id==='deduction-0');
  const drop=normal['deduction-0'].y-port.sourceTop;
  assert.ok(drop>24 && drop<80,`gentle tax lead: ${drop}`);
  assert.ok(edited['deduction-0'].y<normal['deduction-0'].y-80);
  assert.ok(final['deduction-0'].y>=port.sourceTop);
});
