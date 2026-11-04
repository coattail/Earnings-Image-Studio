const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');

function runtime() {
  const ctx = vm.createContext({ console, setTimeout, clearTimeout, URLSearchParams,
    document: { addEventListener() {} }, window: { addEventListener() {} } });
  vm.runInContext(fs.readFileSync(path.join(root, 'js/app-00-foundation.js'), 'utf8'), ctx);
  vm.runInContext(`
    var requests = [], normalized = [];
    loadJsonAsset = async url => { requests.push(url); return { dataUrl: 'data:image/svg+xml;base64,PHN2Zy8+', width: 20, height: 10 }; };
    normalizeBitmapLogoAsset = async asset => { normalized.push(asset); return {...asset, width: 18}; };
    state.logoCatalog = {apple:{assetUrl:'apple.json'},microsoft:{assetUrl:'microsoft.json'},other:{assetUrl:'other.json'}};
  `, ctx);
  return ctx;
}

test('only chart-referenced logos are downloaded and normalized, with shared concurrent jobs', async () => {
  const ctx = runtime();
  await vm.runInContext(`Promise.all([
    prepareChartLogoAssets({companyLogoKey:'apple-corporate',groups:[{lockupKey:'microsoft'}]}),
    prepareChartLogoAssets({companyLogoKey:'apple'})
  ])`, ctx);
  const result = JSON.parse(vm.runInContext(`JSON.stringify({requests,count:normalized.length,asset:state.logoCatalog.apple})`, ctx));
  assert.deepEqual(result.requests.sort(), ['apple.json', 'microsoft.json']);
  assert.equal(result.count, 2);
  assert.ok(result.asset.dataUrl.startsWith('data:image/'), 'exports retain embedded images');
  assert.equal(result.asset.width, 18, 'same normalization used before template metrics');
  await vm.runInContext(`prepareChartLogoAssets({companyLogoKey:'apple'})`, ctx);
  assert.equal(vm.runInContext('requests.length', ctx), 2);
});

test('failed logo requests release their job so a later selection can retry', async () => {
  const ctx = runtime();
  vm.runInContext(`loadJsonAsset = async () => {throw new Error('temporary network failure')}`, ctx);
  await assert.rejects(vm.runInContext(`prepareChartLogoAssets({companyLogoKey:'apple'})`, ctx));
  assert.equal(vm.runInContext('Object.keys(state.logoNormalizationJobs).length', ctx), 0);
  vm.runInContext(`loadJsonAsset = async () => ({dataUrl:'data:image/svg+xml;base64,PHN2Zy8+'})`, ctx);
  await vm.runInContext(`prepareChartLogoAssets({companyLogoKey:'apple'})`, ctx);
  assert.equal(vm.runInContext('state.normalizedLogoKeys.apple', ctx), true);
});

test('inline logos keep the exact normalization and export path without a network request', async () => {
  const ctx=runtime();
  vm.runInContext("state.logoCatalog.apple={assetUrl:'apple.json',dataUrl:'data:image/svg+xml;base64,PHN2Zy8+',width:20,height:10}",ctx);
  await vm.runInContext("prepareChartLogoAssets({companyLogoKey:'apple'})",ctx);
  assert.equal(vm.runInContext('requests.length',ctx),0);
  assert.equal(vm.runInContext('normalized.length',ctx),1);
  assert.equal(vm.runInContext('state.logoCatalog.apple.width',ctx),18);
  assert.ok(vm.runInContext('state.logoCatalog.apple.dataUrl',ctx).startsWith('data:image/'));
});
