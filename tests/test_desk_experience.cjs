const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..');
function runtime() {
  const noop = () => {};
  const document = { addEventListener: noop, querySelector: () => null, querySelectorAll: () => [], getElementById: () => null, createElement: () => ({style:{},setAttribute:noop}), documentElement: null };
  const context = vm.createContext({console, setTimeout, clearTimeout, requestAnimationFrame: () => 1, cancelAnimationFrame: noop, Math, Number, String, Boolean, Array, Object, JSON, Date, RegExp, Map, Set, Intl, Promise, URL, URLSearchParams, Blob, document, window: { addEventListener: noop, document }, navigator: {userAgent:'node'} });
  context.globalThis = context;
  for (const file of ['app-00-foundation.js','app-01-layout.js','app-02-sankey.js','app-03-data.js','app-04-bootstrap.js','app-05-desk.js']) vm.runInContext(fs.readFileSync(path.join(ROOT,'js',file),'utf8'),context,{filename:file});
  return context;
}
test('company lists sort by USD market cap in both loading modes despite stale ranks', () => {
  for (const mode of ['latest-only', 'full']) {
    const ctx = runtime();
    ctx.payload = [
      {id:'private',rank:1},
      {id:'small',rank:2,marketCapUsd:100},
      {id:'invalid',rank:3,marketCapUsd:'unknown'},
      {id:'large',rank:9,marketCapUsd:'500'},
      {id:'equal',rank:10,marketCapUsd:100},
      {id:'zero',rank:4,marketCapUsd:0},
      {id:'negative',rank:5,marketCapUsd:-20},
      {id:'infinite',rank:6,marketCapUsd:Infinity},
      {id:'null',rank:7,marketCapUsd:null},
      {id:'nan',rank:8,marketCapUsd:NaN},
    ];
    ctx.mode = mode;
    const result = vm.runInContext(`(() => {
      state.dataset = {};
      applyLoadedCompaniesToState(payload, mode);
      refs.companyList = {innerHTML:''};
      refs.companySearch = {value:''};
      EarningsDesk.renderCompanyList();
      return JSON.stringify({ids:state.filteredCompanyIds, ranks:companies().map(c=>c.rank),
        count:state.dataset.companyCount, mode:getCompany('large').dataLoadMode});
    })()`, ctx);
    const actual = JSON.parse(result);
    assert.deepEqual(actual.ids,['large','small','equal','private','invalid','zero','negative','infinite','null','nan']);
    assert.deepEqual(actual.ranks,[1,2,3,4,5,6,7,8,9,10]);
    assert.equal(actual.count,10);
    assert.equal(actual.mode,mode);
    assert.equal(ctx.payload[0].rank,1,'loading must not mutate the source payload');
  }
});
test('market-cap updates reorder state and search results without changing the selection', async () => {
  const ctx = runtime();
  vm.runInContext(`
    applyLoadedCompaniesToState([
      {id:'small',ticker:'S',nameEn:'Example Small',rank:1,marketCapUsd:100},
      {id:'large',ticker:'L',nameEn:'Example Large',rank:2,marketCapUsd:500}
    ]);
    state.selectedCompanyId='small';
    state.selectedQuarter='2026Q2';
    replaceCompanyInState({...getCompany('small'),marketCapUsd:1000,rank:99});
    refs.companyList={innerHTML:''}; refs.companySearch={value:'example'};
    EarningsDesk.renderCompanyList();
  `,ctx);
  assert.equal(vm.runInContext('state.filteredCompanyIds.join(",")',ctx),'small,large');
  assert.match(vm.runInContext('refs.companyList.innerHTML',ctx),/Example Small.*Example Large/s);
  // Background enrichment must preserve the same order even if old ranks arrive.
  vm.runInContext(`
    fetchJson=async()=>({ok:false});
    state.sortedCompanies[0].rank=99; state.sortedCompanies[1].rank=1;
  `,ctx);
  await vm.runInContext('enrichDatasetWithFinancialFallbacks()',ctx);
  assert.equal(vm.runInContext('companies().map(c=>c.id).join(",")',ctx),'small,large');
  assert.equal(vm.runInContext('getCompany("small").rank',ctx),1);
  assert.equal(vm.runInContext('state.selectedCompanyId',ctx),'small');
  assert.equal(vm.runInContext('state.selectedQuarter',ctx),'2026Q2');
});
test('short history windows span the plot while preserving chart ratio, column proportions and values', () => {
  const ctx = runtime();
  ctx.payload = JSON.parse(fs.readFileSync(path.join(ROOT,'data/earnings-dataset.json'),'utf8'));
  const windows = vm.runInContext(`(() => {
    applyLoadedCompaniesToState(payload.companies, 'full');
    state.logoCatalog = {}; state.supplementalComponents = {};
    const company = getCompany('nvidia');
    const snapshot = buildSnapshot(company, company.latestQuarter);
    const original = stackedBarSegmentElement;
    let segments = [];
    stackedBarSegmentElement = (...args) => { segments.push(args); return original(...args); };
    return [8, 12, 30].map(count => {
      segments = [];
      const result = renderRevenueSegmentBarsSvg(snapshot, company, {maxQuarters:count});
      return {count:result.history.quarters.length, segments, svg:result.svg, width:result.width, height:result.height,
        values:result.history.quarters.map(quarter=>quarter.segmentRows.map(row=>row.valueBn))};
    });
  })()`,ctx);
  for (const result of windows) {
    const positions = [...new Set(result.segments.map(segment=>segment[0]))];
    assert.equal(positions.length,result.count);
    const width = result.segments[0][2];
    assert.equal(result.width,2048);
    assert.equal(result.height,1325);
    assert.equal(width,56,'retain the original column width instead of stretching data marks');
    if (result.count<=12) {
      assert.ok(Math.abs(positions[0]-94)<.001,'short windows must start at the plot edge');
      assert.ok(Math.abs(positions.at(-1)+width-2010)<.001,'short windows must reach the opposite plot edge');
    }
    assert.ok(positions.every((x,index)=>!index || x>positions[index-1]+width),'bars must remain separated');
    assert.ok(positions[0]>=94 && positions.at(-1)+width<=2010,'bars must stay inside axes');
    assert.equal(result.svg.includes('NaN'),false);
    assert.equal(result.svg.includes('rotate(38 '),true);
  }
  const gap = result => {
    const positions = [...new Set(result.segments.map(segment=>segment[0]))];
    return positions[1]-positions[0]-result.segments[0][2];
  };
  assert.ok(gap(windows[0])>gap(windows[1]));
  assert.ok(gap(windows[1])>gap(windows[2]));
  assert.equal(gap(windows[2]),7);
  assert.deepEqual(windows[0].values,windows[2].values.slice(-8),'changing the window must preserve segment values');
});
test('shared URLs do not inherit another saved company or quarter', () => {
  const ctx = runtime();
  const result = ctx.EarningsDesk.selectionFrom({company:'apple',quarter:'2020Q1',view:'bars',table:true}, new URLSearchParams('company=nvidia&view=sankey'));
  assert.equal(result.company,'nvidia'); assert.equal(result.quarter,''); assert.equal(result.view,'sankey'); assert.equal(result.table,false);
  assert.equal(ctx.EarningsDesk.selectionFrom({},new URLSearchParams('range=900')).range,30);
});
test('unsafe provenance links are rejected and CSV preserves numbers without executable formulas', () => {
  const { EarningsDesk: desk } = runtime();
  assert.equal(desk.safeUrl('javascript:alert(1)'), null);
  assert.equal(desk.safeUrl('https://user:secret@example.com'), null);
  assert.equal(desk.safeUrl('https://www.sec.gov/Archives/example.htm'),'https://www.sec.gov/Archives/example.htm');
  const csv = desk.csvText(['项目','值'],[['=HYPERLINK("x")',-1.25],['业务,甲','line\n2'],[' -cmd',null]]);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('"\'=HYPERLINK(""x"")","-1.25"'));
  assert.ok(csv.includes('"业务,甲","line\n2"'));
  assert.ok(csv.includes('"\' -cmd",""'));
});
test('financial data tables apply the same FX factor while preserving missing values and computed provenance', () => {
  const desk = runtime().EarningsDesk;
  const snapshot = {quarterKey:'2026Q2',fiscalLabel:'FY2026 Q2',displayScaleFactor:.125,sourceCurrency:'CNY',displayCurrency:'USD',revenueBn:80,grossProfitBn:30,operatingProfitBn:10,netProfitBn:8,taxBn:2,businessGroups:[{name:'Cloud',nameZh:'云',valueBn:50,inferredFromQuarter:'2026Q1'}]};
  const company = {nameZh:'示例公司',financials:{'2026Q2':{statementCurrency:'CNY',revenueBn:80,netIncomeBn:8,taxBn:2}}};
  const table = desk.buildTable(snapshot,company,null);
  assert.equal(table.rows[0][1],80); assert.equal(table.rows[0][2],10);
  assert.equal(table.rows.find(row=>row[0]==='毛利润')[1],null);
  assert.equal(table.rows.find(row=>row[0]==='毛利润')[3],'计算 / 对账补齐');
  assert.equal(table.rows.find(row=>row[0]==='所得税')[2],.25);
  assert.match(table.rows.at(-1)[3],/2026Q1.*推算/);
  assert.equal(table.rows.at(-1)[2],6.25);
});
test('source warnings disclose inferred segments, residuals, FX and incomplete historical windows', () => {
  const desk = runtime().EarningsDesk;
  const snapshot = {quarterKey:'2026Q2',businessGroups:[{inferredFromQuarter:'2026Q1',syntheticResidual:true}],usesFxConversion:true,sourceCurrency:'CNY',displayCurrency:'USD',displayScaleFactor:.125};
  const warnings = desk.evidenceWarnings(snapshot,{financials:{}},{imputedQuarterCount:2,missingQuarterCount:1});
  assert.ok(warnings.some(value=>value.includes('邻近报告期')));
  assert.ok(warnings.some(value=>value.includes('差额补齐')));
  assert.ok(warnings.some(value=>value.includes('汇率的日期及类型')));
  assert.ok(warnings.some(value=>value.includes('结构推算')));
  assert.ok(warnings.some(value=>value.includes('缺少可用数据')));
});
test('ordinary PNG click supplies scale one instead of the browser event', () => {
  const ctx = runtime();
  vm.runInContext(`refs.downloadPngBtn = { addEventListener: (event, handler) => { globalThis.pngHandler = handler; } }; exportPng = (scale) => { globalThis.actualScale = scale; }; bindEvents();`,ctx);
  ctx.pngHandler({type:'click'});
  assert.equal(ctx.actualScale,1);
});
test('PNG rasterization always uses finite positive canvas dimensions', async () => {
  const ctx = runtime(); const sizes = [];
  ctx.document.createElement = () => {
    const canvas = { width:0,height:0,getContext:()=>({fillRect(){},drawImage(){}}),toDataURL:()=>{sizes.push([canvas.width,canvas.height]);return 'data:image/png;base64,AA==';} };
    return canvas;
  };
  ctx.Image = class { set src(_) { this.onload(); } };
  vm.runInContext(`currentSvgText = () => '<svg viewBox="0 0 1600 900"></svg>';`,ctx);
  for (const scale of [{type:'click'},undefined,NaN,-2,3,900]) {ctx.inputScale=scale;await vm.runInContext('currentPngDataUrl(inputScale)',ctx);}
  assert.deepEqual(sizes,[[1600,900],[1600,900],[1600,900],[1600,900],[4800,2700],[4800,2700]]);
});
test('latest-company summaries and financial tables work for every company in the current index', () => {
  const ctx = runtime();
  const dataset = JSON.parse(fs.readFileSync(path.join(ROOT,'data/dataset-index.json'),'utf8'));
  ctx.payload = dataset;
  const result = vm.runInContext(`(() => {
    applyLoadedCompaniesToState(payload.companies, 'latest-only');
    state.logoCatalog = {}; state.supplementalComponents = {};
    return companies().map(company => {
      const snapshot = buildSnapshot(company,company.latestQuarter);
      if (!snapshot) throw new Error(company.id + ': no snapshot');
      const table = EarningsDesk.buildTable(snapshot,company,null);
      const insight = EarningsDesk.insights(snapshot);
      return { id:company.id, columns:table.headers.length, widths:table.rows.map(row=>row.length), nan:JSON.stringify(table).includes('NaN'), insight:insight.length };
    });
  })()`,ctx);
  assert.equal(result.length,dataset.companyCount);
  for (const company of result) {assert.ok(company.widths.every(width=>width===company.columns),company.id);assert.equal(company.nan,false,company.id);}
});
test('undo and redo restore a complete layout operation', () => {
  const ctx = runtime();
  const listeners = {};
  const panel = { setAttribute(){} };
  ctx.document.getElementById = id => id === 'chartPanel' ? panel : null;
  ctx.document.addEventListener = (name,fn) => {listeners[name]=fn;};
  vm.runInContext(`state.selectedCompanyId='nvidia'; state.selectedQuarter='2026Q3'; state.editor.enabled=true; EarningsDesk.init(); EarningsDesk.setBusy(false); EarningsDesk.rememberEdit(); setCurrentEditorNodeOverride('revenue',{dx:20,dy:35});`,ctx);
  const key = {target:{closest:()=>false},ctrlKey:true,key:'z',preventDefault(){},shiftKey:false};
  listeners.keydown(key);
  assert.equal(vm.runInContext('Object.keys(currentEditorOverrides()).length',ctx),0);
  // The real renderer clears the loading state between two user operations.
  ctx.EarningsDesk.setBusy(false);
  listeners.keydown({...key,shiftKey:true});
  assert.equal(vm.runInContext('currentEditorOverrides().revenue.dx',ctx),20);
  assert.equal(vm.runInContext('currentEditorOverrides().revenue.dy',ctx),35);
});
test('optional quarter preservation retains a comparable calendar period on company changes', () => {
  const ctx = runtime();
  ctx.payload = JSON.parse(fs.readFileSync(path.join(ROOT,'data/dataset-index.json'),'utf8'));
  const selected = vm.runInContext(`(() => {
    applyLoadedCompaniesToState(payload.companies,'latest-only'); refs.quarterSelect={value:'2026Q2',innerHTML:''};
    state.selectedCompanyId='microsoft'; state.selectedQuarter='2026Q2'; state.keepQuarterOnCompanySwitch=true;
    selectCompany('nvidia'); return state.selectedQuarter;
  })()`,ctx);
  assert.equal(selected,'2026Q2');
});
test('history loading that changes the available period queues the valid period instead of leaving the chart loading', async () => {
  const ctx = runtime();
  vm.runInContext(`
    state.selectedCompanyId='jpmorgan'; state.selectedQuarter='2026Q2'; refs.quarterSelect={value:'2026Q2'};
    getCompany=()=>({id:'jpmorgan',nameEn:'JPMorgan Chase'});
    syncQuarterNavigation=()=>{};
    companyNeedsHistoricalData=()=>true;
    ensureCompanyHistoricalDataLoaded=async()=>{state.selectedQuarter='2026Q1';return getCompany();};
    requestRenderCurrent=()=>{globalThis.validPeriodQueued=state.selectedQuarter;};
  `,ctx);
  await vm.runInContext('renderCurrent()',ctx);
  assert.equal(ctx.validPeriodQueued,'2026Q1');
});
test('background normalization preserves original artwork when it would erase a monochrome logo', async () => {
  const ctx = runtime();
  ctx.Image = class { constructor(){this.naturalWidth=100;this.naturalHeight=20;} set src(_){this.onload();} };
  ctx.document.createElement = () => ({getContext:()=>({drawImage(){},getImageData:()=>({data:new Uint8ClampedArray(100*20*4)}),clearRect(){},putImageData(){}}),toDataURL:()=> 'data:image/png;base64,EMPTY'});
  ctx.originalAsset = {mime:'image/svg+xml',dataUrl:'data:image/svg+xml;base64,ORIGINAL',width:100,height:20};
  vm.runInContext(`detectLogoBackground=()=>({red:0,green:0,blue:0}); removeEdgeBackground=(data)=>data; opaqueBoundsFromImageData=()=>null;`,ctx);
  const normalized = await vm.runInContext('normalizeBitmapLogoAsset(originalAsset)',ctx);
  assert.equal(normalized.dataUrl,ctx.originalAsset.dataUrl);
  assert.equal(normalized.mime,'image/svg+xml');
});
