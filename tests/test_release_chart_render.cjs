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
