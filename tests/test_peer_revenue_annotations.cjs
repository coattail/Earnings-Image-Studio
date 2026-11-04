const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),noop=()=>{};
const document={addEventListener:noop,querySelector:()=>null,querySelectorAll:()=>[],getElementById:()=>null,createElement:()=>({style:{},setAttribute:noop}),documentElement:null};
const ctx=vm.createContext({console,setTimeout,clearTimeout,requestAnimationFrame:()=>1,cancelAnimationFrame:noop,Math,Number,String,Boolean,Array,Object,JSON,Date,RegExp,Map,Set,Intl,Promise,URL,URLSearchParams,Blob,document,window:{addEventListener:noop,document},navigator:{userAgent:'node'}});ctx.globalThis=ctx;
for(const file of require(path.join(root, 'js', 'runtime-files.json')).shared)vm.runInContext(fs.readFileSync(path.join(root,'js',file),'utf8'),ctx,{filename:file});
ctx.payload=JSON.parse(fs.readFileSync(path.join(root,'data/cache/alphabet.json')));
ctx.learned=JSON.parse(fs.readFileSync(path.join(root,'data/learned-sankey-layouts.json')));
vm.runInContext(`applyLoadedCompaniesToState([payload],'full');state.logoCatalog={};state.learnedSankeyLayouts=learned;state.selectedCompanyId='alphabet';`,ctx);
function render(q,language='zh',overrides={},editing=false,companyId='alphabet') {
 ctx.q=q;ctx.language=language;ctx.overrides=overrides;ctx.editing=editing;ctx.companyId=companyId;
 return JSON.parse(vm.runInContext(`(()=>{state.selectedCompanyId=companyId;state.selectedQuarter=q;state.uiLanguage=language;const c=getCompany(companyId),s=buildSnapshot(c,q);s.learnedEditorNodeOverrides=learnedSankeyLayoutOverridesForSession();s.interactiveEditorNodeOverrides=overrides;s.editorNodeOverrides=mergeEditorNodeOffsets(s.learnedEditorNodeOverrides,overrides);s.editModeEnabled=editing;const before=JSON.stringify(s);const svg=EarningsVizRuntime.render.renderIncomeStatementSvg(s,c);return JSON.stringify({svg,groups:s.businessGroups,unchanged:before===JSON.stringify(s)});})()`,ctx));
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
function assertSourceClearance(result, label) {
 const nodes=frames(result.svg),ids=Object.keys(nodes);
 const footprints=ids.map(id=>{
  const r=nodes[id];return [{left:r.x,right:r.x+r.width,top:r.y,bottom:r.y+r.height},...textBounds(result.svg,id)];
 });
 const [, , ,canvasHeight]=result.svg.match(/viewBox="([^"]+)"/)[1].split(' ').map(Number);
 for(let i=0;i<footprints.length;i++)for(const a of footprints[i]) {
  assert.ok(a.top>=0&&a.bottom<=canvasHeight,`${label}: ${ids[i]} stays in canvas`);
  for(let j=i+1;j<footprints.length;j++)for(const b of footprints[j])
   assert.ok(a.right<=b.left||a.left>=b.right||a.bottom+5<=b.top||b.bottom+5<=a.top,
    `${label}: ${ids[i]} and ${ids[j]} information must clear each other`);
 }
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
  assertSourceClearance(result,`${q}/${language}`);
 }
});
test('restored source offsets cannot collide information or detach a thin residual from its column',()=>{
 const offsets={'source-2':{dx:0,dy:-80},'source-3':{dx:52,dy:0}},before=JSON.stringify(offsets);
 for(const language of ['zh','en']) {
  const baseline=render('2026Q3',language),result=render('2026Q3',language,offsets),nodes=frames(result.svg),original=frames(baseline.svg);
  assertSourceClearance(result,`restored/${language}`);
  for(const id of ['source-1','source-2','source-3']) {
   assert.ok(Math.abs(nodes[id].x-nodes['source-1'].x)<.2,`${id}: shared column`);
   assert.equal(nodes[id].height,original[id].height,`${id}: monetary thickness`);
  }
  assert.ok(result.unchanged);
 }
 assert.equal(JSON.stringify(offsets),before);
});
test('a common horizontal column translation is retained and editor opening preserves the automatic baseline',()=>{
 const offsets=Object.fromEntries([0,1,2,3].map(i=>[`source-${i}`,{dx:24,dy:0}]));
 const baseline=frames(render('2026Q3').svg),moved=frames(render('2026Q3','zh',offsets).svg),editing=frames(render('2026Q3','zh',{},true).svg);
 for(const id of Object.keys(baseline)) {
  assert.ok(Math.abs(moved[id].x-baseline[id].x-24)<.2);
  assert.deepEqual(editing[id],baseline[id]);
 }
});
test('active horizontal source drags remain additive after automatic column alignment',()=>{
 const baseline=frames(render('2026Q2','zh',{},true).svg),moved=frames(render('2026Q2','zh',{'source-3':{dx:30,dy:0}},true).svg);
 assert.ok(Math.abs(moved['source-3'].x-baseline['source-3'].x-30)<.2);
 for(const id of ['source-0','source-1','source-2'])assert.deepEqual(moved[id],baseline[id]);
});
test('latest-only and full Google payloads apply the same final information constraints',()=>{
 const offsets={'source-2':{dx:0,dy:-80},'source-3':{dx:52,dy:0}};
 const full=Object.fromEntries(['zh','en'].map(language=>[language,frames(render('2026Q3',language,offsets).svg)]));
 ctx.indexPayload=JSON.parse(fs.readFileSync(path.join(root,'data/dataset-index.json'))).companies.filter(c=>c.id==='alphabet');
 vm.runInContext("applyLoadedCompaniesToState(indexPayload,'latest-only')",ctx);
 for(const language of ['zh','en']) {
  const latest=render('2026Q3',language,offsets);
  assertSourceClearance(latest,`latest-only/${language}`);
  assert.deepEqual(frames(latest.svg),full[language]);assert.ok(latest.unchanged);
 }
});
test('complete source information clears across different revenue topologies and both languages',()=>{
 ctx.fullPayload=JSON.parse(fs.readFileSync(path.join(root,'data/earnings-dataset.json'))).companies;
 vm.runInContext("applyLoadedCompaniesToState(fullPayload,'full')",ctx);
 for(const id of ['amazon','microsoft','apple','nvidia','tencent','asml','alibaba','tsmc','jd']) {
  const quarter=ctx.fullPayload.find(c=>c.id===id).quarters.at(-1);
  for(const language of ['zh','en']) {
   const result=render(quarter,language,{},false,id);
   assertSourceClearance(result,`${id}/${quarter}/${language}`);assert.ok(result.unchanged);
  }
 }
});
