const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const ctx = vm.createContext({});
vm.runInContext('function clamp(n,min,max){return Math.min(Math.max(n,min),max)};' +
  fs.readFileSync(path.join(__dirname, '../js/app-01-layout.js'), 'utf8'), ctx);
function pack(entries, bounds = { minY: 0, maxY: 400, gap: 12 }) {
  ctx.entries = entries; ctx.bounds = bounds;
  return JSON.parse(vm.runInContext('JSON.stringify(resolveSourceInformationColumn(entries,bounds))', ctx));
}
const row = (top, left = 0, right = 100) => ({ top,
  rects: [{ left, right, top: top - 60, bottom: top + 30 }] });

test('complete text footprints use available room above a crowded suffix', () => {
  const entries = [row(200), row(220), row(240)];
  const before = JSON.stringify(entries), result = pack(entries);
  assert.equal(result.feasible, true);
  assert.deepEqual(result.tops, [166, 268, 370]);
  assert.equal(JSON.stringify(entries), before);
});
test('nonadjacent overlapping columns constrain one another while separate lanes interleave', () => {
  const result = pack([row(100), row(110, 200, 300), row(120)]);
  assert.deepEqual(result, { tops: [100, 110, 202], feasible: true });
});
test('tiny monetary nodes reserve wrapped titles and metrics without changing their height', () => {
  const entries = [row(100), { top: 140, rects: [
    { left: 0, right: 50, top: 140, bottom: 142 },
    { left: 0, right: 100, top: 60, bottom: 130 },
    { left: -180, right: -10, top: 110, bottom: 180 },
  ] }];
  const result = pack(entries);
  assert.deepEqual(result, { tops: [100, 222], feasible: true });
});
test('packing honors flow-direction bounds and remains invariant under canvas scaling and translation', () => {
  const entries = [{ ...row(200), maxTop: 160 }, { ...row(220), minTop: 300 }];
  const base = pack(entries);
  assert.deepEqual(base, { tops: [160, 300], feasible: true });
  const transformed = entries.map(entry => ({ top: entry.top * 2 + 40,
    minTop: entry.minTop === undefined ? undefined : entry.minTop * 2 + 40,
    maxTop: entry.maxTop === undefined ? undefined : entry.maxTop * 2 + 40,
    rects: entry.rects.map(r => ({ left: r.left * 2 + 15, right: r.right * 2 + 15,
      top: r.top * 2 + 40, bottom: r.bottom * 2 + 40 })) }));
  assert.deepEqual(pack(transformed, { minY: 40, maxY: 840, gap: 24 }).tops,
    base.tops.map(top => top * 2 + 40));
});
test('empty, invalid and infeasible inputs preserve original positions', () => {
  assert.deepEqual(pack([]), { tops: [], feasible: true });
  assert.deepEqual(pack([row(100), row(120)], { minY: 0, maxY: 120, gap: 12 }),
    { tops: [100, 120], feasible: false });
  assert.deepEqual(pack([{ top: 100, rects: [] }]), { tops: [100], feasible: false });
});
