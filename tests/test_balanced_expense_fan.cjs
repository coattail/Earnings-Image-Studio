const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
const pure = vm.createContext({ clamp, Math, Number });
const layout = fs.readFileSync(path.join(root, 'js/app-01-layout.js'), 'utf8');
vm.runInContext(layout.slice(0, layout.indexOf('function sanitizeOfficialStructureRows')), pure);

test('cost fan packing reserves labels, keeps direction and scales with the canvas', () => {
  const rows = [{ sourceCenter: 1100, center: 1500, height: 68 }, { sourceCenter: 1200, center: 1800, height: 170 }];
  const options = { grossBottom: 1040, revenueTop: 560, grossTop: 648, costTop: 1080, runway: 332, unit: 1.25, minY: 1270, maxY: 1900 };
  const result = pure.resolveCompactCostFan(rows, options);
  assert.ok(result.feasible);
  assert.ok(result.centers[1] - result.centers[0] >= (68 + 170) / 2 + 28 * options.unit - 1e-6);
  assert.ok(result.centers[1] < rows[1].center - 300, 'remove decorative tail whitespace');
  result.centers.forEach((y, i) => assert.ok(y > rows[i].sourceCenter + result.costTop - options.costTop));
  const factor = 2.5;
  const scaled = pure.resolveCompactCostFan(rows.map(row => Object.fromEntries(Object.entries(row).map(([k,v]) => [k,v*factor]))),
    Object.fromEntries(Object.entries(options).map(([k,v]) => [k,v*factor])));
  assert.ok(Math.abs(scaled.costTop - result.costTop * factor) < 1e-6);
  result.centers.forEach((y,i) => assert.ok(Math.abs(scaled.centers[i] - y*factor) < 1e-6));
  assert.equal(pure.resolveCompactCostFan(rows, {...options,maxY:1280}).feasible, false);
});

function runtime() {
  const noop = () => {};
  const document = { addEventListener:noop, querySelector:()=>null, querySelectorAll:()=>[], getElementById:()=>null,
    createElement:()=>({style:{},setAttribute:noop}), documentElement:null };
  const ctx = vm.createContext({console,setTimeout,clearTimeout,requestAnimationFrame:()=>1,cancelAnimationFrame:noop,
    Math,Number,String,Boolean,Array,Object,JSON,Date,RegExp,Map,Set,Intl,Promise,URL,URLSearchParams,Blob,
    document,window:{addEventListener:noop,document},navigator:{userAgent:'node'}});
  ctx.globalThis=ctx;
  for(const file of ['app-00-foundation.js','app-01-layout.js','app-02-sankey.js','app-03-data.js','app-04-bootstrap.js'])
    vm.runInContext(fs.readFileSync(path.join(root,'js',file),'utf8'),ctx,{filename:file});
  ctx.payload=JSON.parse(fs.readFileSync(path.join(root,'data/cache/microsoft.json')));
  ctx.supplemental=JSON.parse(fs.readFileSync(path.join(root,'data/supplemental-components.json')));
  ctx.learned=JSON.parse(fs.readFileSync(path.join(root,'data/learned-sankey-layouts.json')));
  vm.runInContext(`applyLoadedCompaniesToState([payload],'full');state.logoCatalog={};state.supplementalComponents=supplemental;state.learnedSankeyLayouts=learned;state.selectedCompanyId='microsoft';`,ctx);
  return ctx;
}
function frames(svg) {
  return Object.fromEntries([...svg.matchAll(/<rect\b[^>]*data-edit-node-visible-id="([^"]+)"[^>]*>/g)].map(m=>{
    const attrs=Object.fromEntries([...m[0].matchAll(/([\w-]+)="([^"]*)"/g)].map(a=>[a[1],a[2]]));
    return [m[1],Object.fromEntries(['x','y','width','height'].map(k=>[k,+attrs[k]]))];
  }));
}
const ctx=runtime();
function render(q,language='zh',options={}) {
  ctx.q=q;ctx.language=language;ctx.options=options;
  return vm.runInContext(`(() => {
    state.selectedQuarter=q;state.uiLanguage=language;const c=getCompany('microsoft'),s=buildSnapshot(c,q);
    s.learnedEditorNodeOverrides={...currentResolvedEditorOverrides(),...options.learned};s.interactiveEditorNodeOverrides=options.offsets||{};
    s.editorNodeOverrides={...s.learnedEditorNodeOverrides,...s.interactiveEditorNodeOverrides};s.editModeEnabled=!!options.editing;
    if(options.legacy)s.layout={...s.layout,disableBalancedExpenseFan:true};
    if(options.expanded)s.layout={...s.layout,disableCompactOuterBranches:true,disableDirectedRevenueInflows:true};
    s.layout={...s.layout,...options.layout};
    const before=JSON.stringify(s);const svg=EarningsVizRuntime.render.renderIncomeStatementSvg(s,c);
    return {svg,unchanged:before===JSON.stringify(s)};
  })()`,ctx);
}

function revenuePorts(svg) {
  const revenue=frames(svg).revenue;
  return [...svg.matchAll(/<path d="([^"]+)" fill="rgba[^\"]+" opacity="0\.98"><\/path>\s*<rect[^>]*data-edit-node-visible-id="(source-\d+)"/g)].map(m=>{
    const targets=[...m[1].matchAll(/L (-?[\d.]+) (-?[\d.]+)/g)].filter(p=>Math.abs(+p[1]-revenue.x)<.2);
    return {id:m[2],targetTop:+targets[0][2],targetBottom:+targets[1][2]};
  });
}

function labelBounds(svg,id) {
  const group=svg.match(new RegExp(`<g data-layout-label-id="${id}">([\\s\\S]*?)</g>`));
  assert.ok(group,`${id}: measurable rendered label`);
  const texts=[...group[1].matchAll(/<text ([^>]+)>([^<]+)<\/text>/g)].map(m=>{
    const a=Object.fromEntries([...m[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(p=>[p[1],p[2]]));
    const size=+a['font-size'],width=[...m[2]].reduce((sum,c)=>sum+size*(c.charCodeAt(0)>255?1:.65),0);
    const left=+a.x-(a['text-anchor']==='middle'?width/2:a['text-anchor']==='end'?width:0);
    return {left,right:left+width,top:+a.y-size*.96,bottom:+a.y+size*.28};
  });
  return {left:Math.min(...texts.map(t=>t.left)),right:Math.max(...texts.map(t=>t.right)),
    top:Math.min(...texts.map(t=>t.top)),bottom:Math.max(...texts.map(t=>t.bottom))};
}

test('revenue port constraints keep both outer directions and scale without forcing crowded neighbors', () => {
  for(const side of [-1,1]) {
    const entry={center:600,targetCenter:600,runway:332,side};
    const options={minCenter:300,maxCenter:900,unit:1.25};
    const center=pure.resolveRevenueInflowCenter(entry,options);
    assert.ok((center-600)*side>=332*.22-1e-6);
    const scaled=pure.resolveRevenueInflowCenter({...entry,center:1200,targetCenter:1200,runway:664},
      {minCenter:600,maxCenter:1800,unit:2.5});
    assert.ok(Math.abs(scaled-center*2)<1e-6);
    assert.equal(pure.resolveRevenueInflowCenter(entry,{...options,minCenter:750,maxCenter:700}),entry.center);
  }
});

test('expense packing reserves label-only horizontal overlaps and has a bounded infeasible fallback', () => {
  const rows=[{center:600,height:80,sourceCenter:500,drop:30,left:100,right:240},
    {center:800,height:160,sourceCenter:660,drop:20,left:100,right:240}];
  const obstacles=[{left:220,right:400,top:570,bottom:700}];
  const options={minY:200,maxY:1100,gap:24,clearance:30};
  const result=pure.resolveBranchColumnBelowObstacles(rows,obstacles,options);
  assert.ok(result.feasible);
  assert.ok(result.centers[0]-40>=730);
  assert.ok(result.centers[1]-result.centers[0]>=40+80+24-1e-6);
  const scaled=pure.resolveBranchColumnBelowObstacles(rows.map(r=>Object.fromEntries(Object.entries(r).map(([k,v])=>[k,v*2]))),
    obstacles.map(r=>Object.fromEntries(Object.entries(r).map(([k,v])=>[k,v*2]))),
    Object.fromEntries(Object.entries(options).map(([k,v])=>[k,v*2])));
  result.centers.forEach((c,i)=>assert.ok(Math.abs(scaled.centers[i]-c*2)<1e-6));
  assert.equal(pure.resolveBranchColumnBelowObstacles(rows,obstacles,{...options,maxY:750}).feasible,false);
  assert.equal(pure.resolveBranchColumnBelowObstacles(rows,[{left:300,right:400,bottom:700}],options).centers[0],600);
});

test('final labels clear expense summaries and outer revenue ribbons converge across languages and restored layouts', () => {
  const scenarios=[{}, {learned:{'source-1':{dx:0,dy:-220},'operating-expenses':{dx:0,dy:100}}},
    {offsets:{'operating-expenses':{dx:0,dy:100},
      'cost-breakdown-0':{dx:0,dy:-180},'cost-breakdown-1':{dx:0,dy:-100}}}];
  for(const language of ['zh','en']) for(const options of scenarios) {
    const result=render('2026Q3',language,options), nodes=frames(result.svg), ports=revenuePorts(result.svg);
    assert.equal(ports.length,2);
    assert.ok(nodes[ports[0].id].y<ports[0].targetTop-30,'upper stream descends');
    assert.ok(nodes[ports.at(-1).id].y>ports.at(-1).targetTop+30,'lower stream rises');
    const summary=labelBounds(result.svg,'operating-expenses-summary');
    for(const id of ['cost-breakdown-0','cost-breakdown-1']) {
      const label=labelBounds(result.svg,id);
      assert.ok(label.top>summary.bottom+12,`${language}/${id}: real title, value and ratio extents`);
    }
    assert.ok(result.unchanged,'saved placements remain unchanged');
  }
});

test('Microsoft three quarters share a downward expense split without changing money or profit stages', () => {
  for(const q of ['2026Q1','2026Q2','2026Q3']){
    const before=frames(render(q,'zh',{legacy:true}).svg),after=frames(render(q).svg),english=frames(render(q,'en').svg);
    for(const [id,node] of Object.entries(before)){
      assert.equal(after[id].height,node.height,`${q}/${id}: value thickness`);
      if(!['cost','operating-expenses'].includes(id)&&!/^(cost-breakdown|opex|deduction)-/.test(id)) assert.deepEqual(after[id],node,`${q}/${id}: keep main spine`);
      if(!/^(cost-breakdown|opex|deduction)-/.test(id)) assert.equal(english[id].y,after[id].y,`${q}/${id}: bilingual core positions`);
    }
    assert.ok(after['operating-expenses'].y >= after.gross.y+after.operating.height+20,`${q}: lower ribbon descends`);
    const gains=Object.entries(after).filter(([id])=>id.startsWith('positive-')).reduce((sum,[,n])=>sum+n.height,0);
    const first=(after.gross.y-after.operating.y)/(after.operating.x-after.gross.x-after.gross.width);
    const second=(after.operating.y-after.net.y-gains)/(after.net.x-after.operating.x-after.operating.width);
    assert.ok(Math.abs(first-second)<.075,`${q}: consistent profit spine slopes`);
    assert.ok(render(q).unchanged);
  }
});

test('outer branch compaction is proportional, bounded and leaves close branches alone', () => {
  assert.ok(Math.abs(pure.resolveOuterBranchLift(377,332)-46.48)<1e-6);
  assert.equal(pure.resolveOuterBranchLift(170,428),0);
  assert.equal(pure.resolveOuterBranchLift(120,0),0);
  for(const ratio of [.34,.9]) {
    const lift=pure.resolveOuterBranchLift(200,332,ratio);
    assert.ok(lift>=0&&lift<=332*.14);
    assert.ok(Math.abs(pure.resolveOuterBranchLift(200*2.5,332*2.5,ratio)-lift*2.5)<1e-6);
  }
});

test('small sources and tax caps move inward gently while keeping money, order and editing stable', () => {
  const expanded=frames(render('2026Q3','zh',{expanded:true}).svg), normal=frames(render('2026Q3').svg);
  for(const id of ['source-1','deduction-0']) {
    const lift=expanded[id].y-normal[id].y;
    assert.ok(id==='source-1' ? lift>60&&lift<150 : lift>25&&lift<60,`${id}: bounded inward lift`);
    assert.equal(normal[id].height,expanded[id].height);
    for(const language of ['zh','en']) {
      const baseline=frames(render('2026Q3',language).svg);
      const opened=frames(render('2026Q3',language,{editing:true}).svg);
      assert.deepEqual(opened[id],baseline[id],`${id}: no editor jump`);
      const offsets={[id]:{dx:0,dy:90}};
      const edited=render('2026Q3',language,{editing:true,offsets});
      assert.ok(Math.abs(frames(edited.svg)[id].y-baseline[id].y-90)<.2,`${id}: additive manual drag`);
      assert.ok(edited.unchanged);
    }
  }
  assert.ok(normal['source-1'].y>normal['source-0'].y+normal['source-0'].height+100);
  assert.ok(normal['deduction-0'].y>normal.operating.y+normal.operating.height);
  assert.ok(normal['deduction-0'].y+normal['deduction-0'].height<normal['opex-0'].y-100);
  for(const id of ['revenue','gross','cost','operating','operating-expenses','net','source-0'])
    assert.deepEqual(normal[id],expanded[id],`${id}: preserve main spine`);
});

test('latest automatic Microsoft cost fan approaches the compact hand-tuned reference', () => {
  const before=frames(render('2026Q3','zh',{legacy:true}).svg),after=frames(render('2026Q3').svg);
  const last=after['cost-breakdown-1'];
  const leftBottom=Math.max(...Object.entries(after).filter(([id])=>/^(source|left-detail)-/.test(id)).map(([,n])=>n.y+n.height));
  assert.ok(last.y < before['cost-breakdown-1'].y-300);
  assert.ok(last.y+last.height-leftBottom < 170,'balanced left and right fan envelopes');
  const costGap=after.cost.y-after.gross.y-after.gross.height;
  const upperDrop=after.gross.y-after.revenue.y;
  assert.ok(costGap/upperDrop > .9 && costGap/upperDrop < 1.3,'balanced revenue fork');
  const childGap=last.y-after['cost-breakdown-0'].y-after['cost-breakdown-0'].height;
  assert.ok(childGap > 24 && childGap < after.cost.height*.5,'avoid the former long empty tail');
});

test('interactive cost positioning remains free and the saved draft is untouched', () => {
  const saved={'cost-breakdown-1':{dx:0,dy:240}};
  const normal=frames(render('2026Q3').svg);
  const editing=render('2026Q3','zh',{offsets:saved,editing:true});
  assert.ok(Math.abs(frames(editing.svg)['cost-breakdown-1'].y-normal['cost-breakdown-1'].y-240)<1,'drag remains additive to the compact layout');
  const opened=frames(render('2026Q3','zh',{editing:true}).svg);
  for(const id of ['cost','cost-breakdown-0','cost-breakdown-1']) assert.deepEqual(opened[id],normal[id],`${id}: opening editor keeps the automatic layout`);
  assert.ok(editing.unchanged);
  assert.equal(saved['cost-breakdown-1'].dy,240);
});

test('Microsoft old and new segment palettes are fixed across ordering and visible ranges', () => {
  ctx.keys=['intelligentcloud','productivitybusinessprocesses','morepersonalcomputing','agentsandinfra','devicesandconsumer'];
  const all=vm.runInContext('stableBarColorMap("microsoft",keys)',ctx);
  const reversed=vm.runInContext('stableBarColorMap("microsoft",keys.slice().reverse())',ctx);
  const current=vm.runInContext('stableBarColorMap("microsoft",["agentsandinfra","devicesandconsumer"])',ctx);
  assert.equal(new Set(Object.values(all)).size,4);
  assert.equal(all.agentsandinfra,all.intelligentcloud,'reuse Microsoft logo blue across reporting structures');
  for(const key of ctx.keys) assert.equal(reversed[key],all[key]);
  assert.equal(current.agentsandinfra,all.agentsandinfra);
  assert.equal(current.devicesandconsumer,all.devicesandconsumer);
  assert.equal(all.intelligentcloud,'#0e9fe1','retain the original cloud blue');
  assert.equal(all.productivitybusinessprocesses,'#7baf0b','retain the original productivity green');
  assert.equal(all.morepersonalcomputing,'#f0b20f','retain the original computing gold');
  ctx.palette=all;
  const hues=vm.runInContext('Object.fromEntries(Object.entries(palette).map(([k,v])=>[k,colorToHsl(v).h]))',ctx);
  assert.ok(hues.agentsandinfra>190&&hues.agentsandinfra<220,'Microsoft logo blue infrastructure');
  assert.ok(hues.devicesandconsumer>20&&hues.devicesandconsumer<40,'warm orange consumer');
});

test('all eight restated Microsoft quarters keep directed revenue inflows and clear expense labels',()=>{
 for(const q of ['2024Q3','2024Q4','2025Q1','2025Q2','2025Q3','2025Q4','2026Q1','2026Q2'])for(const language of ['zh','en']) {
  const {svg,unchanged}=render(q,language),nodes=frames(svg),ports=revenuePorts(svg);
  assert.equal(ports.length,2,`${q}/${language}: restated segment count`);
  assert.ok(nodes[ports[0].id].y<ports[0].targetTop-30,`${q}/${language}: upper inflow descends`);
  assert.ok(nodes[ports[1].id].y>ports[1].targetTop+30,`${q}/${language}: consumer inflow rises`);
  const summary=labelBounds(svg,'operating-expenses-summary');
  for(const id of Object.keys(nodes).filter(id=>id.startsWith('cost-breakdown-'))) {
   const label=labelBounds(svg,id);
   assert.ok(label.right<summary.left||label.left>summary.right||label.top>summary.bottom+12||label.bottom<summary.top-12,`${q}/${language}/${id}: label clearance`);
  }
  assert.ok(unchanged);
 }
});
