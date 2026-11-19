const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const { loadRuntime } = require('../scripts/direct_chart_render.cjs');
const runtime = loadRuntime(root), ctx = runtime.context;
ctx.dataset = JSON.parse(fs.readFileSync(path.join(root, 'data/earnings-dataset.json')));
ctx.supplemental = JSON.parse(fs.readFileSync(path.join(root, 'data/supplemental-components.json')));
ctx.learned = JSON.parse(fs.readFileSync(path.join(root, 'data/learned-sankey-layouts.json')));
vm.runInContext(`state.logoCatalog={};state.supplementalComponents=supplemental;state.learnedSankeyLayouts=learned;`,ctx);
function render(company, q, language, overrides={}, editing=false, size=null) {
  Object.assign(ctx,{company,q,language,overrides,editing,size});
  return vm.runInContext(`(()=>{
    applyLoadedCompaniesToState([company],'full');state.selectedCompanyId=company.id;state.selectedQuarter=q;state.uiLanguage=language;
    const c=getCompany(company.id),s=buildSnapshot(c,q);
    s.learnedEditorNodeOverrides=currentResolvedEditorOverrides();s.interactiveEditorNodeOverrides=overrides;
    s.editorNodeOverrides=mergeEditorNodeOffsets(s.learnedEditorNodeOverrides,overrides);s.editModeEnabled=editing;
    if(size)Object.assign(s,size);
    const saved=JSON.stringify(s),svg=EarningsVizRuntime.render.renderIncomeStatementSvg(s,c);
    return {svg,unchanged:JSON.stringify(s)===saved};
  })()`,ctx);
}
function bounds(svg,id) {
  const group=svg.match(new RegExp('<g data-layout-label-id="'+id+'">([\\s\\S]*?)</g>'));
  if(!group)return null;
  const texts=[...group[1].matchAll(/<text ([^>]+)>([^<]+)<\/text>/g)].map(m=>{
    const a=Object.fromEntries([...m[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(p=>[p[1],p[2]]));
    ctx.text=m[2];ctx.font=+a['font-size'];
    const width=vm.runInContext('approximateTextWidth(text,font)',ctx),halo=+(a['stroke-width']||0)/2;
    const left=+a.x-(a['text-anchor']==='middle'?width/2:a['text-anchor']==='end'?width:0);
    return {left:left-halo,right:left+width+halo,top:+a.y-ctx.font*.96-halo,bottom:+a.y+ctx.font*.32+halo};
  });
  return {left:Math.min(...texts.map(t=>t.left)),right:Math.max(...texts.map(t=>t.right)),
    top:Math.min(...texts.map(t=>t.top)),bottom:Math.max(...texts.map(t=>t.bottom))};
}
function overlaps(a,b,gap=0) {return a.left<b.right+gap&&a.right>b.left-gap&&a.top<b.bottom+gap&&a.bottom>b.top-gap;}
function nodes(svg) {
  return Object.fromEntries([...svg.matchAll(/<rect\b[^>]*data-edit-node-visible-id="([^"]+)"[^>]*>/g)].map(m=>{
    const a=Object.fromEntries([...m[0].matchAll(/([\w-]+)="([^"]*)"/g)].map(p=>[p[1],p[2]]));
    return [m[1],{x:+a.x,y:+a.y,width:+a.width,height:+a.height}];
  }));
}
test('attached branch solver separates text and cap, scales proportionally and reports impossible bounds',()=>{
  const rects=[{left:100,right:210,top:280,bottom:330},{left:224,right:280,top:302,bottom:314}];
  const obstacles=[{left:130,right:230,top:320,bottom:440}];
  const options={minDx:0,maxDx:60,minDy:-100,maxDy:0,gap:12};
  const result=ctx.resolveAttachedBranchPlacement(rects,obstacles,options);
  assert.ok(result.feasible);assert.ok(result.dy<0);
  const scale=r=>Object.fromEntries(Object.entries(r).map(([k,v])=>[k,v*2.5]));
  const scaled=ctx.resolveAttachedBranchPlacement(rects.map(scale),obstacles.map(scale),scale(options));
  assert.ok(Math.abs(scaled.dx-result.dx*2.5)<1e-6&&Math.abs(scaled.dy-result.dy*2.5)<1e-6);
  assert.equal(ctx.resolveAttachedBranchPlacement(rects,obstacles,{...options,minDy:0,maxDy:0,maxDx:0}).feasible,false);
});
test('every ready issuer keeps gain labels clear of final profit titles in both languages',()=>{
  const failures=[];let charts=0,branches=0;
  for(const company of ctx.dataset.companies) {
    const q=company.quarters.at(-1);if(company.financials[q].chartQuality?.status!=='ready')continue;
    for(const language of ['zh','en']) {
      const result=render(company,q,language);assert.ok(result.unchanged,company.id);charts++;
      const visible=nodes(result.svg),ids=Object.keys(visible).filter(id=>/^positive-\d+$/.test(id));
      for(const [index,id] of ids.entries()) {
        const label=bounds(result.svg,id);assert.ok(label);branches++;
        for(const metric of ['gross-summary','operating-summary']) {
          const obstacle=bounds(result.svg,metric);
          if(obstacle&&overlaps(label,obstacle,4))failures.push(`${company.id}/${q}/${language}/${id}/${metric}`);
        }
        for(const other of ids.slice(index+1)) {
          if(overlaps(label,bounds(result.svg,other),4))failures.push(`${company.id}/${language}: ${id}/${other} labels`);
          const a=visible[id],b=visible[other];
          if(overlaps({left:a.x,right:a.x+a.width,top:a.y,bottom:a.y+a.height},
            {left:b.x,right:b.x+b.width,top:b.y,bottom:b.y+b.height},2))failures.push(`${company.id}/${language}: ${id}/${other} caps`);
        }
      }
    }
  }
  assert.ok(charts>=60&&branches>=20);
  assert.deepEqual(failures,[]);
});
test('NVIDIA quarter history and restored gain drags preserve money and editable offsets',()=>{
  const company=ctx.dataset.companies.find(c=>c.id==='nvidia');
  for(const q of ['2026Q2','2026Q3','2026Q4'])for(const language of ['zh','en']) {
    const normal=render(company,q,language),base=nodes(normal.svg);
    for(const overrides of [{},{'positive-0':{dx:-30,dy:50}}]) {
      const result=render(company,q,language,overrides);assert.ok(result.unchanged);
      const frame=nodes(result.svg);
      for(const id of Object.keys(base))assert.equal(frame[id].height,base[id].height,`${q}/${id}: money unchanged`);
      const label=bounds(result.svg,'positive-0'),profit=bounds(result.svg,'operating-summary');
      if(label&&profit)assert.ok(!overlaps(label,profit,6),`${q}/${language}: restored label collision`);
    }
    const baseline=nodes(render(company,q,language,{},true).svg);
    const dragged=nodes(render(company,q,language,{'positive-0':{dx:15,dy:24}},true).svg);
    if(baseline['positive-0']) {
      assert.ok(Math.abs(dragged['positive-0'].x-baseline['positive-0'].x-15)<.2);
      assert.ok(Math.abs(dragged['positive-0'].y-baseline['positive-0'].y-24)<.2);
    }
  }
});

test('Alibaba September profit and gain ribbons use separate, readable lanes', () => {
  const company = ctx.dataset.companies.find(item => item.id === 'alibaba');
  for (const language of ['zh', 'en']) {
    const {svg, unchanged} = render(company, '2026Q3', language);
    const frames = nodes(svg);
    const {gross, operating, net} = frames;
    const major = frames['positive-0'];
    const minor = frames['positive-1'];
    const rise = gross.y - operating.y;
    const runway = operating.x - gross.x - gross.width;
    assert.ok(unchanged);
    assert.ok(rise > 0 && rise / runway < 0.27, language);
    assert.ok(net.y + net.height < operating.y, language);
    assert.ok(major.y + major.height < minor.y, language);
    assert.ok(!overlaps(bounds(svg, 'operating-summary'), {
      left: major.x, right: major.x + major.width, top: major.y, bottom: major.y + major.height,
    }, 4), language);

    function mergePort(id) {
      const path = svg.match(new RegExp(`data-layout-branch-id="${id}" d="([^"]+)"`))[1];
      const netPoints = [...path.matchAll(/[ML] (-?[\d.]+) (-?[\d.]+)/g)]
        .filter(point => +point[1] === net.x).map(point => +point[2]);
      return {top: Math.min(...netPoints), bottom: Math.max(...netPoints)};
    }
    const majorPort = mergePort('positive-0');
    const minorPort = mergePort('positive-1');
    assert.ok(Math.abs(majorPort.top - net.y) < 0.1, language);
    assert.ok(Math.abs(majorPort.bottom - minorPort.top) < 0.1, language);
    assert.ok(minorPort.bottom - minorPort.top > 1, language);
    assert.ok(Math.abs(minorPort.bottom - net.y - net.height) < 0.1, language);
    const lead = minorPort.top - minor.y;
    assert.ok(lead > 0 && lead / (net.x - minor.x - minor.width) < 0.5, language);

    const label = bounds(svg, 'positive-1');
    assert.ok(label.left > net.x + net.width && label.top > net.y + net.height, language);
    assert.ok(label.bottom < frames['deduction-0'].y, language);
    const leader = svg.match(/data-branch-label-leader="positive-1" d="([^"]+)"/)[1];
    const [, bend] = [...leader.matchAll(/[ML] ([\d.]+) ([\d.]+)/g)];
    assert.ok(+bend[1] < net.x && +bend[2] > net.y + net.height, language);
  }
});
