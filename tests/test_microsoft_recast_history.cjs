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
