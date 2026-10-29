const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root=path.resolve(__dirname,'..');
function runtime(mode='full') {
 const noop=()=>{};
 const document={addEventListener:noop,querySelector:()=>null,querySelectorAll:()=>[],getElementById:()=>null,createElement:()=>({style:{},setAttribute:noop}),documentElement:null};
 const ctx=vm.createContext({console,setTimeout,clearTimeout,requestAnimationFrame:()=>1,cancelAnimationFrame:noop,Math,Number,String,Boolean,Array,Object,JSON,Date,RegExp,Map,Set,Intl,Promise,URL,URLSearchParams,Blob,document,window:{addEventListener:noop,document},navigator:{userAgent:'node'}});
 ctx.globalThis=ctx;
 for(const name of ['app-00-foundation.js','app-01-layout.js','app-02-sankey.js','app-03-data.js','app-04-bootstrap.js','app-05-desk.js'])vm.runInContext(fs.readFileSync(path.join(root,'js',name),'utf8'),ctx,{filename:name});
 ctx.payload=mode==='full'?JSON.parse(fs.readFileSync(path.join(root,'data/cache/microsoft.json'))):JSON.parse(fs.readFileSync(path.join(root,'data/dataset-index.json'))).companies.find(c=>c.id==='microsoft');
 ctx.mode=mode;
 vm.runInContext(`applyLoadedCompaniesToState([payload],mode);state.selectedCompanyId='microsoft';state.selectedQuarter='2026Q3';state.uiLanguage='zh';state.logoCatalog={};`,ctx);
 return ctx;
}
const official=[['2024Q3',50.476,15.109],['2024Q4',52.766,16.866],['2025Q1',54.763,15.303],['2025Q2',60.778,15.663],['2025Q3',61.672,16.001],['2025Q4',64.441,16.832],['2026Q1',67.438,15.448],['2026Q2',74.576,15.431],['2026Q3',76.795,15.484]];
function history(ctx,basis='recast',quarter='2026Q3',count=30) {
 ctx.basis=basis;ctx.q=quarter;ctx.count=count;
 return JSON.parse(vm.runInContext('JSON.stringify(buildRevenueSegmentBarHistory(getCompany("microsoft"),q,count,{basis}))',ctx));
}
test('official restatement overlays history without removing earlier quarters',()=>{
 for(const mode of ['full','latest-only']) {
  const ctx=runtime(mode),before=JSON.stringify(ctx.payload),h=history(ctx);
  assert.equal(h.quarters.length,mode==='full'?30:9);assert.equal(h.basis,'recast');assert.equal(h.taxonomyBreaks.length,mode==='full'?1:0);
  assert.equal(h.imputedQuarterCount,0);assert.equal(h.smoothedQuarterCount,0);
  assert.equal(h.segmentStats.length,mode==='full'?5:2);
  assert.ok(h.recastSourceUrl.endsWith('d291965dex991.htm'));
  for(let i=0;i<official.length;i++) {
   const [q,infra,consumer]=official[i],row=h.quarters.find(row=>row.quarterKey===q);
   assert.equal(row.quarterKey,q);assert.equal(row.segmentMap.agentsandinfra,infra);assert.equal(row.segmentMap.devicesandconsumer,consumer);
   assert.ok(Math.abs(row.totalRevenueBn-infra-consumer)<1e-9);
  }
  assert.equal(h.quarters.find(q=>q.quarterKey==='2024Q3').entry.fiscalLabel,'FY2025 Q1');assert.equal(h.quarters.find(q=>q.quarterKey==='2026Q2').entry.fiscalLabel,'FY2026 Q4');
  assert.equal(h.quarters.find(q=>q.quarterKey==='2024Q3').entry.periodEnd,'2024-09-30');
  assert.equal(JSON.stringify(ctx.payload),before);
 }
});
test('reported view and colors survive round trips; limited history does not fabricate earlier quarters',()=>{
 const ctx=runtime(),before=history(ctx,'reported');history(ctx);const after=history(ctx,'reported');
 assert.deepEqual(after,before);assert.equal(before.quarters.length,30);
 assert.equal(before.colorBySegment.intelligentcloud,'#0e9fe1');assert.equal(before.colorBySegment.productivitybusinessprocesses,'#7baf0b');assert.equal(before.colorBySegment.morepersonalcomputing,'#f0b20f');
 assert.deepEqual(history(ctx,'recast','2026Q3',8).quarters.map(q=>q.quarterKey),official.slice(-8).map(q=>q[0]));
 assert.equal(history(ctx,'recast','2024Q2'),null);
 assert.equal(history(ctx,'recast','2024Q3').quarters.length,history(ctx,'reported','2024Q3').quarters.length);
 assert.equal(history(ctx,'recast','2025Q2').quarters.length,history(ctx,'reported','2025Q2').quarters.length);
 const mixed=history(ctx);
 assert.deepEqual(mixed.quarters.map(q=>q.quarterKey),before.quarters.map(q=>q.quarterKey));
 for(const q of mixed.quarters.filter(q=>q.quarterKey<'2024Q3'))assert.deepEqual(q.segmentMap,before.quarters.find(b=>b.quarterKey===q.quarterKey).segmentMap);
 for(const key of ['intelligentcloud','productivitybusinessprocesses','morepersonalcomputing'])assert.equal(mixed.colorBySegment[key],before.colorBySegment[key]);
 assert.equal(mixed.taxonomyBreaks[0].quarterKey,'2024Q3');
});
test('SVG exports and CSV tables retain the full window and all restated values',()=>{
 const ctx=runtime();
 for(const language of ['zh','en']) {
  ctx.language=language;
  const result=JSON.parse(vm.runInContext(`(()=>{state.uiLanguage=language;state.chartViewMode='bars';const c=getCompany('microsoft'),s=buildSnapshot(c,'2026Q3'),r=renderRevenueSegmentBarsSvg(s,c,{basis:'recast'});return JSON.stringify({svg:r.svg,table:EarningsDesk.buildTable(s,c,r.history),csv:EarningsDesk.csvText(EarningsDesk.buildTable(s,c,r.history).headers,EarningsDesk.buildTable(s,c,r.history).rows)});})()`,ctx));
  assert.ok(result.svg.includes('data-bar-basis-note="recast"'));
  assert.ok(result.svg.includes(language==='zh'?'更早季度保留原分类':'Earlier quarters retain their original categories'));
  assert.equal(result.table.rows.length,30);assert.equal(result.table.rows[0].at(-1),'原始披露（原分类）');assert.equal(result.table.rows.find(r=>r[0]==='2024Q3').at(-1),'官方历史重列');assert.equal(result.table.rows.at(-1).at(-1),'当期披露（新口径）');
  assert.ok(result.csv.includes('50.476'));assert.ok(result.csv.includes('15.109'));assert.ok(result.csv.includes('76.795'));
  assert.ok(!/NaN|undefined/.test(result.svg));
 }
 const selection=ctx.EarningsDesk.selectionFrom({basis:'reported'},new URLSearchParams('company=microsoft&view=bars&basis=recast&range=12'));
 assert.equal(selection.basis,'recast');assert.equal(selection.range,12);
 assert.equal(ctx.EarningsDesk.selectionFrom({basis:'reported'},new URLSearchParams()).basis,'reported');
 assert.equal(ctx.EarningsDesk.selectionFrom({},new URLSearchParams()).basis,'recast');
});

// Published USD millions, FY25 Q1 through FY26 Q4, slides 15 and 17.
const restatedProducts={
 azure:[16021,17337,18540,20712,22384,24129,26008,29417],
 microsoft365cloud:[20017,20686,20967,22935,23694,24466,25418,26721],
 productivityandserverlicensing:[8051,8307,8731,10302,8678,8814,8760,11033],
 industrysolutions:[4459,4544,4579,4835,4894,4994,5165,5292],
 frontierandsupportservices:[1928,1892,1946,1994,2022,2038,2087,2113],
 searchandadvertising:[5159,5773,5437,5802,5942,6393,6065,6435],
 xbox:[5621,6581,5721,5532,5508,5958,5341,4983],
 windowsoemanddevices:[4329,4512,4145,4329,4551,4481,4042,4013],
};
test('eight historical Sankeys use official product and segment values without changing profit statements or bars',()=>{
 const ctx=runtime();
 for(const [i,[q,infra,consumer]] of official.slice(0,8).entries()) {
  ctx.q=q;
  const result=JSON.parse(vm.runInContext(`(()=>{
   state.selectedQuarter=q; const c=getCompany('microsoft'),before=JSON.stringify(c),s=buildSnapshot(c,q);
   const original={...c,financials:{...c.financials,[q]:{...c.financials[q],officialRevenueRestatement:null}}};
   const prior=buildSnapshot(original,q);
   const table=EarningsDesk.buildTable(s,c,null);
   const statements=['revenueBn','costOfRevenueBn','grossProfitBn','operatingProfitBn','operatingExpensesBn','nonOperatingBn','taxBn','netProfitBn'];
   return JSON.stringify({s,prior: Object.fromEntries(statements.map(k=>[k,prior[k]])),current:Object.fromEntries(statements.map(k=>[k,s[k]])),
    table, unchanged:before===JSON.stringify(c),warnings:EarningsDesk.evidenceWarnings(s,c,null)});
  })()`,ctx));
  assert.deepEqual(result.current,result.prior,`${q}: original profit statement`);
  assert.equal(result.unchanged,true,`${q}: source payload is immutable`);
  const details=result.table.rows.filter(r=>r[0].startsWith('业务明细 · '));
  assert.equal(details.length,8);
  for(const row of details){assert.equal(row[1],row[2]);assert.match(row[3],/第 17 页/);}
  const groups=Object.fromEntries(result.s.businessGroups.map(r=>[r.id,r.valueBn]));
  assert.deepEqual(groups,{agentsandinfra:infra,devicesandconsumer:consumer});
  assert.equal(result.s.leftDetailGroups.length,8);
  for(const row of result.s.leftDetailGroups)assert.equal(row.valueBn,restatedProducts[row.id][i]/1000,`${q}/${row.id}`);
  for(const group of result.s.businessGroups)assert.ok(Math.abs(group.valueBn-result.s.leftDetailGroups.filter(r=>r.targetId===group.id).reduce((sum,r)=>sum+r.valueBn,0))<1e-9);
  assert.equal(result.s.revenueBasis,'official-recast');
  assert.match(result.s.revenueRestatementSourceUrl,/d291965dex991.htm$/);
  assert.ok(result.warnings.some(w=>w.includes('官方历史重列')));
  for(const row of result.table.rows.filter(r=>r[0].startsWith('业务 · '))) {
   assert.equal(row[1],row[2]);assert.match(row[3],/官方历史重列/);
  }
 }
 const originalReported=history(ctx,'reported'),originalRecast=history(ctx);
 vm.runInContext(`Object.values(getCompany('microsoft').financials).forEach(e=>delete e.officialRevenueRestatement)`,ctx);
 assert.deepEqual(history(ctx,'reported').quarters.map(q=>q.segmentMap),originalReported.quarters.map(q=>q.segmentMap));
 assert.deepEqual(history(ctx).quarters.map(q=>q.segmentMap),originalRecast.quarters.map(q=>q.segmentMap));
});
test('historical growth labels compare only officially restated periods in both languages',()=>{
 const ctx=runtime();
 for(const language of ['zh','en'])for(const [i,[q]] of official.slice(0,8).entries()) {
  ctx.q=q;ctx.language=language;
  const result=JSON.parse(vm.runInContext(`(()=>{state.selectedQuarter=q;state.uiLanguage=language;const c=getCompany('microsoft'),s=buildSnapshot(c,q);return JSON.stringify({s,svg:EarningsVizRuntime.render.renderIncomeStatementSvg(s,c)});})()`,ctx));
  const raw=ctx.payload.financials[q].officialRevenueRestatement;
  const rawById=Object.fromEntries([...raw.officialRevenueSegments,...raw.officialRevenueDetailGroups].map(r=>[r.memberKey,r]));
  for(const row of [...result.s.businessGroups,...result.s.leftDetailGroups]) {
   const expected=rawById[row.id];
   assert.equal(row.yoyPct,expected.yoyPct);
   if(!i)assert.equal(row.qoqPct,null);
   else assert.ok(Math.abs(row.qoqPct-(expected.valueBn/expected.qoqComparisonValueBn-1)*100)<1e-9);
   if(i<4)assert.equal(row.yoyPct,null,`${q}/${row.id}: no old-basis YoY`);
  }
  assert.equal((result.svg.match(/data-edit-node-visible-id="source-\d+"/g)||[]).length,2);
  assert.ok(!/NaN|undefined|Infinity/.test(result.svg));
  assert.ok(result.s.revenueRestatementNote.includes(language==='zh'?'官方历史重列':'official restatements'));
 }
 for(const q of ['2024Q2','2026Q3']) {
  ctx.q=q;
  assert.equal(vm.runInContext('buildSnapshot(getCompany("microsoft"),q).revenueBasis',ctx),undefined,`${q}: outside the eight historical quarters`);
 }
});

test('restated topology invalidates obsolete preset geometry while preserving its financial content',()=>{
 const ctx=runtime();
 const result=JSON.parse(vm.runInContext(`(()=>{
  const c=getCompany('microsoft'),q='2024Q3',entry=c.financials[q],preset=c.statementPresets[q],before=JSON.stringify(c);
  const current=buildSnapshot(c,q);
  const reported={...c,financials:{...c.financials,[q]:{...entry,officialRevenueRestatement:null}}};
  const original=buildSnapshot(reported,q);
  const sameTopology={...c,statementPresets:{...c.statementPresets,[q]:{...preset,businessGroups:entry.officialRevenueRestatement.officialRevenueSegments}}};
  const pinned=buildSnapshot(sameTopology,q);
  const explicit={...c,financials:{...c.financials,[q]:{...entry,sankeyLayout:{grossNodeTop:390}}}};
  const requested=buildSnapshot(explicit,q);
  const fields=['revenueBn','grossProfitBn','costOfRevenueBn','operatingProfitBn','operatingExpensesBn','netProfitBn','grossMarginPct','netMarginPct','opexBreakdown','belowOperatingItems'];
  return JSON.stringify({rebuilt:current.layoutRebuiltForRevenueRestatement,layout:current.layout,
   current:Object.fromEntries(fields.map(k=>[k,current[k]])),original:Object.fromEntries(fields.map(k=>[k,original[k]])),
   pinnedLayout:pinned.layout,pinnedRebuilt:pinned.layoutRebuiltForRevenueRestatement,
   explicitTop:requested.layout.grossNodeTop,unchanged:before===JSON.stringify(c)});
 })()`,ctx));
 assert.equal(result.rebuilt,true);
 for(const key of ['costNodeTop','opNodeTop','opexNodeTop','netNodeTop','sourceNodeOffsets'])assert.equal(result.layout[key],undefined,key);
 assert.deepEqual(result.current,result.original);
 assert.equal(result.pinnedRebuilt,false);assert.equal(result.pinnedLayout.costNodeTop,824);assert.equal(result.pinnedLayout.grossNodeTop,420);
 assert.equal(result.explicitTop,390);assert.equal(result.unchanged,true);
});
