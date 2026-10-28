const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const code=fs.readFileSync(path.join(__dirname,'../js/app-00-foundation.js'),'utf8');
const fn=code.slice(code.indexOf('function cropVectorLogoAsset('),code.indexOf('async function normalizeBitmapLogoAsset('));
function runtime(){
  return vm.createContext({Uint8Array,TextDecoder,TextEncoder,atob,btoa,
    DOMParser:class {parseFromString(source){
      const opening=source.match(/^<svg\b([^>]*)>/)?.[0] || '';
      const attrs=Object.fromEntries([...opening.matchAll(/([\w:]+)="([^"]*)"/g)].map(m=>[m[1],m[2]]));
      return {source,attrs,documentElement:{attrs,body:source.replace(/^<svg[^>]*>/,'').replace(/<\/svg>$/,''),localName:source.startsWith('<svg')?'svg':'invalid',
        hasAttribute:k=>k in attrs,setAttribute:(k,v)=>{attrs[k]=v}},querySelector:()=>null};
    }},
    XMLSerializer:class {serializeToString(root){return '<svg '+Object.entries(root.attrs).map(([k,v])=>k+'="'+v+'"').join(' ')+'>'+root.body+'</svg>';}}
  });
}
test('cropping retains SVG artwork, Unicode and crop geometry rather than PNG pixels',()=>{
  const ctx=runtime();vm.runInContext(fn,ctx);
  const source='<svg viewBox="7 8 24 24"><title>品牌</title><path d="M0 0L24 24"/></svg>';
  const asset={mime:'image/svg+xml',dataUrl:'data:image/svg+xml;base64,'+Buffer.from(source).toString('base64')};
  const result=ctx.cropVectorLogoAsset(asset,{left:10,top:300,width:1000,height:350},1024,1024,24,24);
  assert.equal(result.mime,'image/svg+xml');assert.equal(result.width,1000);assert.equal(result.height,350);
  const svg=Buffer.from(result.dataUrl.split(',')[1],'base64').toString();
  assert.match(svg,/viewBox="10 300 1000 350"/);assert.match(svg,/<path/);assert.match(svg,/品牌/);assert.match(svg,/viewBox="7 8 24 24"/);assert.doesNotMatch(svg,/image\/png/);
  assert.equal(asset.dataUrl,'data:image/svg+xml;base64,'+Buffer.from(source).toString('base64'));
});
test('malformed vector crops fail safely so callers can retain original artwork',()=>{
  const ctx=runtime();vm.runInContext(fn,ctx);
  assert.equal(ctx.cropVectorLogoAsset({dataUrl:'data:image/svg+xml;base64,'+Buffer.from('<invalid/>').toString('base64')},{left:0,top:0,width:10,height:10},24,24,24,24),null);
});
