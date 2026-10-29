const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),noop=()=>{};
const document={addEventListener:noop,querySelector:()=>null,querySelectorAll:()=>[],getElementById:()=>null,createElement:()=>({style:{},setAttribute:noop}),documentElement:null};
const ctx=vm.createContext({console,setTimeout,clearTimeout,requestAnimationFrame:()=>1,cancelAnimationFrame:noop,Math,Number,String,Boolean,Array,Object,JSON,Date,RegExp,Map,Set,Intl,Promise,URL,URLSearchParams,Blob,document,window:{addEventListener:noop,document},navigator:{userAgent:'node'}});ctx.globalThis=ctx;
for(const file of ['app-00-foundation.js','app-01-layout.js','app-02-sankey.js','app-03-data.js','app-04-bootstrap.js'])vm.runInContext(fs.readFileSync(path.join(root,'js',file),'utf8'),ctx,{filename:file});
ctx.payload=JSON.parse(fs.readFileSync(path.join(root,'data/cache/alphabet.json')));
ctx.learned=JSON.parse(fs.readFileSync(path.join(root,'data/learned-sankey-layouts.json')));
vm.runInContext(`applyLoadedCompaniesToState([payload],'full');state.logoCatalog={};state.learnedSankeyLayouts=learned;state.selectedCompanyId='alphabet';`,ctx);
function render(q,language='zh',overrides={}) {
 ctx.q=q;ctx.language=language;ctx.overrides=overrides;
 return JSON.parse(vm.runInContext(`(()=>{state.selectedQuarter=q;state.uiLanguage=language;const c=getCompany('alphabet'),s=buildSnapshot(c,q);s.learnedEditorNodeOverrides=currentResolvedEditorOverrides();s.interactiveEditorNodeOverrides=overrides;s.editorNodeOverrides={...s.learnedEditorNodeOverrides,...overrides};const before=JSON.stringify(s);const svg=EarningsVizRuntime.render.renderIncomeStatementSvg(s,c);return JSON.stringify({svg,groups:s.businessGroups,unchanged:before===JSON.stringify(s)});})()`,ctx));
}
function frames(svg) {
 return Object.fromEntries([...svg.matchAll(/<rect\b[^>]*data-edit-node-visible-id="(source-\d+)"[^>]*>/g)].map(m=>{
  const a=Object.fromEntries([...m[0].matchAll(/([\w-]+)="([^"]*)"/g)].map(p=>[p[1],p[2]]));
  return [m[1],{x:+a.x,y:+a.y,width:+a.width,height:+a.height}];
 }));
}
function textBounds(svg,id) {
 const group=svg.match(new RegExp(`<g data-layout-source-label-id="${id}">([\\s\\S]*?)</g>`));assert.ok(group,id);
 return [...group[1].matchAll(/<text ([^>]+)>([^<]+)<\/text>/g)].map(m=>{
  const a=Object.fromEntries([...m[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(p=>[p[1],p[2]]));
  const size=+a['font-size'],width=[...m[2]].reduce((sum,c)=>sum+size*(c.charCodeAt(0)>255?1:.65),0),left=+a.x-(a['text-anchor']==='middle'?width/2:a['text-anchor']==='end'?width:0);
  return {left,right:left+width,top:+a.y-size*.96,bottom:+a.y+size*.28};
 });
}
test('historical Google peer sources share a column and residual metrics clear the preceding node',()=>{
 for(const q of ['2024Q1','2025Q1','2025Q4','2026Q1','2026Q2','2026Q3'])for(const language of ['zh','en']) {
  const result=render(q,language),nodes=frames(result.svg),other=result.groups.findIndex(r=>r.id==='otherrevenue');
  assert.ok(other>1);
  const peers=[nodes['source-1'],nodes['source-2'],nodes[`source-${other}`]];
  assert.ok(Math.max(...peers.map(r=>r.x))-Math.min(...peers.map(r=>r.x))<.2,`${q}/${language}: aligned peers`);
  const previous=nodes[`source-${other-1}`];
  for(const text of textBounds(result.svg,`source-${other}`)) {
   assert.ok(text.right<previous.x-2||text.left>previous.x+previous.width+2||text.top>previous.y+previous.height+6||text.bottom<previous.y-6,`${q}/${language}: residual label must clear the preceding rectangle`);
  }
  const scale=nodes['source-1'].height/result.groups[1].valueBn;
  assert.ok(Math.abs(nodes[`source-${other}`].height-result.groups[other].valueBn*scale)<.15,`${q}: true ribbon thickness`);
  assert.ok(result.unchanged);assert.ok(!/NaN|Infinity|undefined/.test(result.svg));
 }
});
test('explicit horizontal source drags remain additive after automatic column alignment',()=>{
 const baseline=frames(render('2026Q2').svg),moved=frames(render('2026Q2','zh',{'source-3':{dx:30,dy:0}}).svg);
 assert.ok(Math.abs(moved['source-3'].x-baseline['source-3'].x-30)<.2);
 for(const id of ['source-0','source-1','source-2'])assert.deepEqual(moved[id],baseline[id]);
});
