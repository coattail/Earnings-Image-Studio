#!/usr/bin/env node
// Audit the same normalized snapshots and SVG renderer used by the webpage.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..');

function auditDataset(dataset, {renderAll = false} = {}) {
  const noop = () => {};
  const document = {addEventListener:noop, querySelector:()=>null, querySelectorAll:()=>[], getElementById:()=>null, createElement:()=>({style:{},setAttribute:noop}), documentElement:null};
  const context = vm.createContext({console,setTimeout,clearTimeout,requestAnimationFrame:()=>1,cancelAnimationFrame:noop,Math,Number,String,Boolean,Array,Object,JSON,Date,RegExp,Map,Set,Intl,Promise,URL,URLSearchParams,Blob,document,window:{addEventListener:noop,document},navigator:{userAgent:'node'}});
  context.globalThis = context;
  for (const file of ['app-00-foundation.js','app-01-layout.js','app-02-sankey.js','app-03-data.js','app-04-bootstrap.js']) {
    vm.runInContext(fs.readFileSync(path.join(ROOT,'js',file),'utf8'),context,{filename:file});
  }
  context.payload = dataset;
  context.supplemental = JSON.parse(fs.readFileSync(path.join(ROOT,'data/supplemental-components.json'),'utf8'));
  context.logos = JSON.parse(fs.readFileSync(path.join(ROOT,'data/logo-catalog.json'),'utf8')).logos;
  context.renderAll = renderAll;
  const companies = vm.runInContext(`(() => {
    applyLoadedCompaniesToState(payload.companies,'full');
    state.logoCatalog=logos; state.supplementalComponents=supplemental;
    return companies().map(company => {
      state.selectedCompanyId=company.id;
      const quarters=Object.keys(company.financials).sort();
      const results=quarters.map(quarter => {
        state.selectedQuarter=quarter;
        try {
          const snapshot=buildSnapshot(company,quarter);
          const missing=['revenueBn','grossProfitBn','costOfRevenueBn','operatingProfitBn','netProfitBn'].filter(key => snapshot?.[key] == null || !Number.isFinite(Number(snapshot[key])));
          const result={quarter,mode:snapshot?.bridgeCoverageMode||'full',missing};
          if(snapshot && (renderAll || quarter===quarters.at(-1))) {
            try {
              const svg=EarningsVizRuntime.render.renderIncomeStatementSvg(snapshot,company);
              result.svgValid=svg.includes('<svg') && !/\\b(?:NaN|Infinity)\\b/.test(svg);
              if(!result.svgValid) result.renderError='Invalid numeric SVG output';
            } catch(error) {result.renderError=error.message;}
          }
          return result;
        } catch(error) {return{quarter,missing:['snapshot'],renderError:error.message};}
      });
      return{id:company.id,name:company.nameZh,latest:results.at(-1),quarters:results};
    });
  })()`,context);
  const quarters = companies.flatMap(company=>company.quarters);
  return {
    companyCount:companies.length,quarterCount:quarters.length,
    completeLatestCompanyCount:companies.filter(company=>company.latest?.mode!=='revenue-only' && company.latest?.missing.length===0 && !company.latest?.renderError).length,
    incompleteQuarterCount:quarters.filter(quarter=>quarter.mode==='revenue-only'||quarter.missing.length).length,
    renderedQuarterCount:quarters.filter(quarter=>quarter.svgValid!==undefined || quarter.renderError).length,
    renderErrorCount:quarters.filter(quarter=>quarter.renderError).length,
    companies,
  };
}

if (require.main === module) {
  const args=process.argv.slice(2);
  const value=(name,fallback)=>args.includes(name)?args[args.indexOf(name)+1]:fallback;
  const dataset=JSON.parse(fs.readFileSync(value('--dataset',path.join(ROOT,'data/earnings-dataset.json')),'utf8'));
  const report=auditDataset(dataset,{renderAll:args.includes('--render-all')});
  const output=value('--output',null);
  if(output) fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({companyCount:report.companyCount,quarterCount:report.quarterCount,completeLatestCompanyCount:report.completeLatestCompanyCount,incompleteQuarterCount:report.incompleteQuarterCount,renderedQuarterCount:report.renderedQuarterCount,renderErrorCount:report.renderErrorCount},null,2));
  if(report.incompleteQuarterCount || report.renderErrorCount) process.exitCode=1;
}
module.exports={auditDataset};
