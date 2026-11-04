const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const {loadRuntime} = require('../scripts/direct_chart_render.cjs');
const root = path.resolve(__dirname, '..');

function capture(compiled) {
  const {context:ctx} = loadRuntime(root, {compiled});
  for (const [key,name] of [['dataset','earnings-dataset'],['logos','logo-catalog'],['supplemental','supplemental-components'],['learned','learned-sankey-layouts']]) {
    ctx[key] = JSON.parse(fs.readFileSync(path.join(root,'data',`${name}.json`)));
  }
  const rows = vm.runInContext(`(() => {
    applyLoadedCompaniesToState(dataset.companies,'full');
    state.logoCatalog=logos.logos; state.supplementalComponents=supplemental; state.learnedSankeyLayouts=learned;
    const results=[];
    for(const original of dataset.companies) {
      const company=getCompany(original.id),qs=Object.keys(company.financials).sort(),latest=qs.at(-1);
      for(const q of [...new Set([latest,qs.at(-2),qs[0]])].filter(Boolean))
      for(const lang of (q===latest?['zh','en']:['zh'])) for(const mode of ['sankey','bars']) {
        state.selectedCompanyId=company.id;state.selectedQuarter=q;state.uiLanguage=lang;
        try {
          const s=buildSnapshot(company,q);
          s.editorNodeOverrides=currentResolvedEditorOverrides();s.learnedEditorNodeOverrides=s.editorNodeOverrides;
          const svg=mode==='bars'?EarningsVizRuntime.render.renderRevenueSegmentBarsSvg(s,company).svg:EarningsVizRuntime.render.renderIncomeStatementSvg(s,company);
          results.push({id:company.id,q,lang,mode,svg});
          if(mode==='sankey'&&q===latest&&lang==='zh'&&['apple','alibaba','nvidia','samsung','amazon','palantir'].includes(company.id)) {
            for(const enabled of [true,false]) {
              const drag={cost:{dx:0,dy:38},'operating-expenses':{dx:14,dy:24}};
              results.push({id:company.id,q,lang,mode:'edited-'+enabled,
                svg:EarningsVizRuntime.render.renderIncomeStatementSvg({...s,editorNodeOverrides:mergeEditorNodeOffsets(s.learnedEditorNodeOverrides,drag),interactiveEditorNodeOverrides:drag,editModeEnabled:enabled},company)});
            }
          }
        } catch(e) { results.push({id:company.id,q,lang,mode,error:e.message}); }
      }
    }
    return results;
  })()`,ctx);
  return Array.from(rows, ({svg,...row}) => ({...row,...(svg?{hash:crypto.createHash('sha256').update(svg).digest('hex')}:{})}));
}

test('production bundle preserves every company, historical SVG, both languages and additive editor drafts', () => {
  const source=capture(false), compiled=capture(true);
  const companies=JSON.parse(fs.readFileSync(path.join(root,'data/earnings-dataset.json'))).companies;
  assert.equal(new Set(source.map(r=>r.id)).size,companies.length);
  assert.ok(source.length>companies.length*7,'cover latest bilingual views and two history periods');
  assert.deepEqual(compiled,source,'minification and runtime ordering must not change SVGs or existing publication errors');
});
