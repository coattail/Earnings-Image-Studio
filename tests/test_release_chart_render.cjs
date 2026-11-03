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
 assert.equal(vm.runInContext("(()=>{const c=structuredClone(payload),e=c.financials['2026Q3'];delete e.officialRevenueSegments;delete e.automaticEarnings;return resolveRenderableOfficialRevenueRows(c,e).length})()",vm.createContext({...ctx,structuredClone})),0);
});

ctx.structuredClone=structuredClone;
ctx.dataset=JSON.parse(fs.readFileSync(path.join(root,'data/earnings-dataset.json')));
ctx.supplementalJson=fs.readFileSync(path.join(root,'data/supplemental-components.json'),'utf8');
ctx.learnedJson=fs.readFileSync(path.join(root,'data/learned-sankey-layouts.json'),'utf8');
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

test('automatic and manual updates produce identical Sankey and bar SVGs with the company templates',()=>{
 const results=JSON.parse(vm.runInContext(`JSON.stringify((()=>{
   state.logoCatalog={};
   state.supplementalComponents=JSON.parse(supplementalJson);
   state.learnedSankeyLayouts=JSON.parse(learnedJson);
   return dataset.companies.filter(c=>c.financials[c.quarters.at(-1)].chartQuality?.status==='ready').map(original=>{
     const outputs=[];
     for(const automatic of [false,true]) {
       const company=normalizeLoadedCompany(structuredClone(original),0),quarter=company.quarters.at(-1),entry=company.financials[quarter];
       if(automatic) {
         entry.automaticEarnings={form:'8-K',filingDate:entry.statementFilingDate};
         for(const field of ['officialRevenueSegments','officialRevenueDetailGroups','officialCostBreakdown','officialOpexBreakdown']) {
           for(const row of entry[field] ?? []) { row.sourceUrl=entry.statementSourceUrl || 'https://issuer.example/current';row.filingDate=entry.statementFilingDate || '2026-11-03'; }
         }
       } else delete entry.automaticEarnings;
       state.selectedCompanyId=company.id;state.selectedQuarter=quarter;state.uiLanguage='zh';
       const s=buildSnapshot(company,quarter);
       outputs.push({template:s.templatePresetKey,typography:s.typography,ribbon:s.ribbon,
         sankey:EarningsVizRuntime.render.renderIncomeStatementSvg(s,company),
         bars:EarningsVizRuntime.render.renderRevenueSegmentBarsSvg(s,company).svg});
     }
     return {id:original.id,equal:JSON.stringify(outputs[0])===JSON.stringify(outputs[1])};
   });
 })())`,ctx));
 assert.ok(results.length>=25,'exercise the published company templates');
 for(const r of results)assert.equal(r.equal,true,r.id);
});

test('a newly released quarter keeps the previous company template, fonts, ribbons and category colors',()=>{
 const results=JSON.parse(vm.runInContext(`JSON.stringify((()=>{
   return dataset.companies.filter(c=>c.financials[c.quarters.at(-1)].chartQuality?.status==='ready').map(original=>{
     const company=normalizeLoadedCompany(structuredClone(original),0),old=company.quarters.at(-1);
     state.selectedCompanyId=company.id;state.selectedQuarter=old;state.uiLanguage='zh';
     const before=buildSnapshot(company,old),year=Number(old.slice(0,4)),number=Number(old.at(-1));
     const next=number===4?(year+1)+'Q1':year+'Q'+(number+1);
     company.financials[next]={...structuredClone(company.financials[old]),calendarQuarter:next,automaticEarnings:{form:'8-K'}};
     company.quarters.push(next);state.selectedQuarter=next;
     const after=buildSnapshot(company,next);
     const style=s=>({template:s.templatePresetKey,typography:s.typography,ribbon:s.ribbon,
       colors:s.businessGroups.map(r=>[r.memberKey || r.id,r.nodeColor,r.flowColor])});
     return {id:company.id,equal:JSON.stringify(style(before))===JSON.stringify(style(after))};
   });
 })())`,ctx));
 for(const r of results)assert.equal(r.equal,true,r.id);
});

test('a complete official product partition is not silently truncated at seven or twelve categories',()=>{
 const result=vm.runInContext(`(()=>{
   const c=normalizeLoadedCompany(structuredClone(dataset.companies.find(c=>c.id==='abbvie')),0),q='2026Q3';
   const e=c.financials[q],groups=buildOfficialBusinessGroups(c,e);
   return {official:e.officialRevenueSegments.length,visible:groups.length};
 })()`,ctx);
 assert.ok(result.official>12);
 assert.equal(result.visible,result.official);
});
