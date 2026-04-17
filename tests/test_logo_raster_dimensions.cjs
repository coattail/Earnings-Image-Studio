const test = require("node:test");
const assert = require("node:assert/strict");

const {
  resolveLogoRasterDimensions,
  shouldRasterizeSmallSvgLogo,
} = require("../js/app-00-logo-raster.js");

test("small square svg logos are upscaled for raster fallback", () => {
  const asset = { mime: "image/svg+xml" };

  assert.equal(shouldRasterizeSmallSvgLogo(asset, 24, 24), true);
  assert.deepEqual(resolveLogoRasterDimensions(asset, 24, 24), { width: 256, height: 256 });
});

test("small wide svg logos are upscaled proportionally for raster fallback", () => {
  const asset = { mime: "image/svg+xml" };

  assert.equal(shouldRasterizeSmallSvgLogo(asset, 100, 33), false);
  assert.deepEqual(resolveLogoRasterDimensions(asset, 24, 12), { width: 256, height: 128 });
});

test("raster logos are not artificially upscaled", () => {
  const asset = { mime: "image/png" };

  assert.equal(shouldRasterizeSmallSvgLogo(asset, 24, 24), false);
  assert.deepEqual(resolveLogoRasterDimensions(asset, 24, 24), { width: 24, height: 24 });
});

test("large logos still respect the max raster side cap", () => {
  const asset = { mime: "image/svg+xml" };

  assert.deepEqual(resolveLogoRasterDimensions(asset, 1200, 400), { width: 900, height: 300 });
});
