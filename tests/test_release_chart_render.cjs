const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),noop=()=>{};
const document={addEventListener:noop,querySelector:()=>null,querySelectorAll:()=>[],getElementById:()=>null,createElement:()=>({style:{},setAttribute:noop}),documentElement:null};
const ctx=vm.createContext({console,setTimeout,clearTimeout,requestAnimationFrame:()=>1,cancelAnimationFrame:noop,Math,Number,String,Boolean,Array,Object,JSON,Date,RegExp,Map,Set,Intl,Promise,URL,URLSearchParams,Blob,document,window:{addEventListener:noop,document},navigator:{userAgent:'node'}});ctx.globalThis=ctx;
for(const file of ['app-00-foundation.js','app-01-layout.js','app-02-sankey.js','app-03-data.js','app-04-bootstrap.js'])vm.runInContext(fs.readFileSync(path.join(root,'js',file),'utf8'),ctx,{filename:file});

ctx.payload=JSON.parse(fs.readFileSync(path.join(root,'data/cache/apple.json')));
vm.runInContext("applyLoadedCompaniesToState([payload],'full');state.logoCatalog={};state.selectedCompanyId='apple';state.selectedQuarter='2026Q3';state.uiLanguage='zh';",ctx);
test('latest Apple SVG renders disclosed categories and real total growth',()=>{
 const svg=vm.runInContext("(()=>{const c=getCompany('apple'),s=buildSnapshot(c,'2026Q3');return EarningsVizRuntime.render.renderIncomeStatementSvg(s,c)})()",ctx);
 for(const label of ['iPhone','Mac','iPad','57.6','10.8','8.3','6.2','11.7%','4.6%'])assert.ok(svg.includes(label),label);
});
test('missing numeric values do not become real zero growth',()=>{
 assert.equal(vm.runInContext('safeNumber(null,null)',ctx),null);
 assert.equal(vm.runInContext('safeNumber(0,null)',ctx),0);
});
test('automatic releases never scale previous-quarter revenue splits',()=>{
 assert.equal(vm.runInContext("(()=>{const c=structuredClone(payload),e=c.financials['2026Q3'];delete e.officialRevenueSegments;return resolveRenderableOfficialRevenueRows(c,e).length})()",vm.createContext({...ctx,structuredClone})),0);
});

ctx.structuredClone=structuredClone;
ctx.dataset=JSON.parse(fs.readFileSync(path.join(root,'data/earnings-dataset.json')));
test('every published company is checked by the final renderer, including stale ready flags',()=>{
 const result=JSON.parse(vm.runInContext(`JSON.stringify((()=>{
   const baseline=getCompany('apple'), snapshot=buildSnapshot(baseline,'2026Q3');
   return dataset.companies.map(original=>{
     const company=structuredClone(original),q=company.quarters.at(-1),entry=company.financials[q];
     entry.chartQuality={...entry.chartQuality,status:'ready'};
     delete entry.officialRevenueSegments;
     try { EarningsVizRuntime.render.renderIncomeStatementSvg({...snapshot,quarterKey:q},company); return {id:company.id,blocked:false}; }
     catch(error) { return {id:company.id,blocked:/classification|营收分类/i.test(error.message)}; }
   });
 })())`,ctx));
 assert.equal(result.length,ctx.dataset.companies.length);
 for(const item of result)assert.equal(item.blocked,true,item.id);
});
test('latest-only data retains required child groups and rejects modified or orphan details',()=>{
 for(const mutation of ['delete entry.officialRevenueDetailGroups',"entry.officialRevenueDetailGroups[0].targetName='missing'",'entry.officialRevenueDetailGroups[0].valueBn=NaN',"entry.chartQuality.quarter='2026Q2'"]) {
   ctx.mutation=mutation;
   const blocked=vm.runInContext(`(()=>{const c=structuredClone(payload),entry=c.financials['2026Q3'];c.financials={'2026Q3':entry};eval(mutation);return chartPublicationIssue(c,'2026Q3')!==null;})()`,ctx);
   assert.equal(blocked,true,mutation);
 }
});
