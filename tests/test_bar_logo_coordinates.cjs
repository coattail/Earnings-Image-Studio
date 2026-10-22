const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/app-04-bootstrap.js'), 'utf8');
const ctx = vm.createContext({ Math, Number, Array, Object, Set,
  safeNumber: (value, fallback = 0) => value == null || !Number.isFinite(Number(value)) ? fallback : Number(value),
});
vm.runInContext(source.slice(0, source.indexOf('function computeNiceBarAxisStep')), ctx);
class Matrix {
  constructor(a = 1, b = 0, c = 0, d = 1, e = 0, f = 0) { Object.assign(this, {a,b,c,d,e,f}); }
  multiply(m) { return new Matrix(this.a*m.a+this.c*m.b, this.b*m.a+this.d*m.b,
    this.a*m.c+this.c*m.d, this.b*m.c+this.d*m.d, this.a*m.e+this.c*m.f+this.e, this.b*m.e+this.d*m.f+this.f); }
  inverse() { const k=this.a*this.d-this.b*this.c; return new Matrix(this.d/k,-this.b/k,-this.c/k,this.a/k,
    (this.c*this.f-this.d*this.e)/k,(this.b*this.e-this.a*this.f)/k); }
}
function node(attrs = {}) { return { attrs: {...attrs}, getAttribute(k) {return this.attrs[k] ?? null;},
  setAttribute(k,v) {this.attrs[k]=v;}, removeAttribute(k) {delete this.attrs[k];}, querySelectorAll: () => [] }; }
function fixture() {
  const svg = node({viewBox:'0 0 2048 1325'}); svg.matrix = new Matrix(.3,0,0,.3,25,140); svg.getCTM=()=>svg.matrix;
  const inner = node({transform:'translate(84 280) scale(1)'});
  const wrapper = node({'data-logo-zone-left':'118','data-logo-zone-top':'96','data-logo-zone-right':'614','data-logo-zone-bottom':'484'});
  wrapper.firstElementChild=inner;
  wrapper.getCTM=()=>{const t=ctx.parseBarChartLogoTransform(wrapper.getAttribute('transform')); return svg.matrix.multiply(new Matrix(1,0,0,1,t?.x||0,t?.y||0));};
  wrapper.getBBox=()=>{const t=ctx.parseBarChartLogoTransform(inner.getAttribute('transform'));return {x:t.x+6*t.scale,y:t.y+6*t.scale,width:98*t.scale,height:98*t.scale};};
  const axis=node({'data-bar-axis':'true'});axis.tagName='line';axis.getBBox=()=>({x:94,y:270,width:0,height:890});axis.getCTM=()=>svg.matrix;
  const unit=node();unit.tagName='text';unit.getBBox=()=>({x:18,y:226,width:90,height:36});unit.getCTM=()=>svg.matrix;
  const content={querySelectorAll:()=>[axis,unit,wrapper]};
  svg.querySelector=selector=>selector==='#chartContent'?content:selector==="[data-bar-chart-logo='true']"?wrapper:null;
  return {svg,wrapper,inner,axis};
}
test('logo and zero-width axis bounds use the same SVG coordinate space under letterboxing', () => {
  const {svg,wrapper,axis}=fixture();
  const first=ctx.barChartSvgRect(svg,wrapper), line=ctx.barChartSvgRect(svg,axis,6);
  assert.ok(Math.abs(first.left-90)<1e-7);
  assert.ok(Math.abs(line.left-88)<1e-7 && Math.abs(line.right-100)<1e-7);
  svg.matrix=new Matrix(.75,0,0,.75,400,12);
  assert.ok(Math.abs(ctx.barChartSvgRect(svg,wrapper).left-first.left)<1e-7);
});
test('refinement is independent of the previous view size and never crosses the axis clearance', () => {
  const {svg,wrapper,inner}=fixture();
  let expected;
  for (const matrix of [new Matrix(.3,0,0,.3,25,140),new Matrix(.72,0,0,.72,410,0),new Matrix(.22,0,0,.22,0,250)]) {
    svg.matrix=matrix;ctx.refineRenderedBarChartLogoPlacement(svg);
    const rect=ctx.barChartSvgRect(svg,wrapper);
    assert.ok(rect.left>=118-1e-7,'24 SVG units to the right of the vertical axis');
    const placement=[wrapper.getAttribute('transform'),inner.getAttribute('transform')];
    if(expected)assert.deepEqual(placement,expected,'view switching and repeated refinement are stable');
    expected=placement;
  }
});
test('hidden or unmeasurable SVGs do not produce invalid logo transforms', () => {
  const {svg,wrapper,inner}=fixture();svg.getCTM=()=>null;
  assert.equal(ctx.barChartSvgRect(svg,wrapper),null);
  ctx.refineRenderedBarChartLogoPlacement(svg);
  assert.ok(!/NaN|Infinity/.test(inner.getAttribute('transform')));
});
