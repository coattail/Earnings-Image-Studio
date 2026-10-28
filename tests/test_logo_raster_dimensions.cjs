const test = require("node:test");
const assert = require("node:assert/strict");

const {
  resolveLogoRasterDimensions,
  shouldRasterizeSmallSvgLogo,
} = require("../js/app-00-logo-raster.js");

test("small square svg logos are upscaled for raster fallback", () => {
  const asset = { mime: "image/svg+xml" };

  assert.equal(shouldRasterizeSmallSvgLogo(asset, 24, 24), true);
  assert.deepEqual(resolveLogoRasterDimensions(asset, 24, 24), { width: 1024, height: 1024 });
});

test("small wide svg logos are upscaled proportionally for raster fallback", () => {
  const asset = { mime: "image/svg+xml" };

  assert.equal(shouldRasterizeSmallSvgLogo(asset, 100, 33), false);
  assert.deepEqual(resolveLogoRasterDimensions(asset, 24, 12), { width: 1024, height: 512 });
});

test("raster logos are not artificially upscaled", () => {
  const asset = { mime: "image/png" };

  assert.equal(shouldRasterizeSmallSvgLogo(asset, 24, 24), false);
  assert.deepEqual(resolveLogoRasterDimensions(asset, 24, 24), { width: 24, height: 24 });
});

test("large logos still respect the max raster side cap", () => {
  const asset = { mime: "image/svg+xml" };

  assert.deepEqual(resolveLogoRasterDimensions(asset, 1200, 400), { width: 1200, height: 400 });
});

 test("medium SVGs also get detailed alpha measurement and large inputs stay bounded", () => {
  assert.deepEqual(resolveLogoRasterDimensions({mime:"image/svg+xml"},100,33),{width:1024,height:338});
  assert.deepEqual(resolveLogoRasterDimensions({mime:"image/svg+xml"},6000,3000),{width:2048,height:1024});
 });
