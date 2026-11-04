const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const context = vm.createContext({clamp:(v,a,b)=>Math.min(Math.max(v,a),b), Number, Math});
const code = fs.readFileSync(path.join(root, 'js/app-01-layout.js'), 'utf8');
vm.runInContext(code.slice(0, code.indexOf('function sanitizeOfficialStructureRows')), context);
const solve = context.resolveCostStageTop;
test('cost split gets proportional breathing room while preserving existing generous openings', () => {
  const options = {grossBottom:900,grossTop:600,revenueTop:550,runway:340,unit:1,costTop:950,costHeight:300,maxY:1500};
  const top = solve(options);
  assert.ok(top >= 980 && top <= 1020);
  assert.equal(solve({...options,costTop:1050}),1050);
  assert.equal(solve({...options,maxY:1260}),960,'available canvas limits the move');
  const scaled = Object.fromEntries(Object.entries(options).map(([k,v])=>[k,v*2.5]));
  assert.ok(Math.abs(solve(scaled)-top*2.5)<1e-6);
});

test('current Apple has a wider cost split, stable monetary caps and additive editor drags', () => {
  const noop=()=>{},document={addEventListener:noop,querySelector:()=>null,querySelectorAll:()=>[],getElementById:()=>null,documentElement:null};
  const ctx=vm.createContext({console,setTimeout,clearTimeout,Math,Number,String,Boolean,Array,Object,JSON,Date,RegExp,Map,Set,Intl,Promise,URL,URLSearchParams,Blob,document,window:{document,addEventListener:noop},navigator:{userAgent:'node'}});ctx.globalThis=ctx;
  for(const file of ['app-00-foundation.js','app-01-layout.js','app-02-sankey.js','app-03-data.js','app-04-bootstrap.js']) vm.runInContext(fs.readFileSync(path.join(root,'js',file),'utf8'),ctx);
  ctx.payload=JSON.parse(fs.readFileSync(path.join(root,'data/cache/apple.json')));
  ctx.supplemental=JSON.parse(fs.readFileSync(path.join(root,'data/supplemental-components.json')));
  ctx.learned=JSON.parse(fs.readFileSync(path.join(root,'data/learned-sankey-layouts.json')));
  const svgs=vm.runInContext(`(()=>{applyLoadedCompaniesToState([payload],'full');state.selectedCompanyId='apple';state.selectedQuarter='2026Q3';state.uiLanguage='zh';
    state.supplementalComponents=supplemental;state.learnedSankeyLayouts=learned;
    const c=getCompany('apple'),s=buildSnapshot(c,'2026Q3');
    s.editorNodeOverrides=currentResolvedEditorOverrides();s.learnedEditorNodeOverrides=s.editorNodeOverrides;
    const normal=renderIncomeStatementSvg(s,c);
    const draft={cost:{dx:0,dy:38}};
    return [normal,renderIncomeStatementSvg({...s,editorNodeOverrides:mergeEditorNodeOffsets(s.learnedEditorNodeOverrides,draft),interactiveEditorNodeOverrides:draft,editModeEnabled:true},c)];})()`,ctx);
  const frames=svg=>Object.fromEntries([...svg.matchAll(/<rect[^>]*data-edit-node-visible-id="([^"]+)"[^>]*>/g)].map(m=>[m[1],Object.fromEntries([...m[0].matchAll(/(x|y|width|height)="([\d.-]+)"/g)].map(a=>[a[1],Number(a[2])]))]));
  const a=frames(svgs[0]),b=frames(svgs[1]),gap=a.cost.y-a.gross.y-a.gross.height;
  assert.ok(gap>75&&gap<110,`cost/gross gap ${gap}`);
  // The official expense taxonomy can change the available vertical scale;
  // monetary thickness must remain proportional and unchanged by editor drags.
  const financials=ctx.payload.financials['2026Q3'];
  assert.ok(Math.abs(a.cost.height/a.gross.height-financials.costOfRevenueBn/financials.grossProfitBn)<0.002);
  for(const id of ['cost','gross'])assert.equal(a[id].height,b[id].height);
  assert.ok(Math.abs(b.cost.y-a.cost.y-38)<0.2,`manual drag remains additive: ${a.cost.y} -> ${b.cost.y}`);
  for(const text of ['同比+0.7个百分点','同比-0.5个百分点','同比+0.02个百分点'])assert.ok(svgs[0].includes(text),text);
});
