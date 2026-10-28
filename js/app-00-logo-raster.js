(function initEarningsVizLogoRaster(globalScope) {
  "use strict";

  const MAX_RASTER_SIDE = 2048;
  const SMALL_SVG_EDGE_THRESHOLD = 64;
  const SMALL_SVG_TARGET_SIDE = 1024;

  function isSvgLogoMime(mime) {
    return /^image\/(svg\+xml|svg)$/i.test(String(mime || "").trim());
  }

  function shouldRasterizeSmallSvgLogo(asset, naturalWidth, naturalHeight) {
    if (!isSvgLogoMime(asset?.mime)) return false;
    return Math.max(Number(naturalWidth) || 0, Number(naturalHeight) || 0) <= SMALL_SVG_EDGE_THRESHOLD;
  }

  function resolveLogoRasterDimensions(asset, naturalWidth, naturalHeight) {
    const sourceWidth = Math.max(1, Math.round(Number(naturalWidth) || 0));
    const sourceHeight = Math.max(1, Math.round(Number(naturalHeight) || 0));
    const naturalMaxSide = Math.max(sourceWidth, sourceHeight, 1);
    let rasterScale = Math.min(1, MAX_RASTER_SIDE / naturalMaxSide);

    if (isSvgLogoMime(asset?.mime)) {
      rasterScale = Math.max(rasterScale, SMALL_SVG_TARGET_SIDE / naturalMaxSide);
    }

    return {
      width: Math.max(1, Math.round(sourceWidth * rasterScale)),
      height: Math.max(1, Math.round(sourceHeight * rasterScale)),
    };
  }

  const api = {
    MAX_RASTER_SIDE,
    SMALL_SVG_EDGE_THRESHOLD,
    SMALL_SVG_TARGET_SIDE,
    isSvgLogoMime,
    shouldRasterizeSmallSvgLogo,
    resolveLogoRasterDimensions,
  };

  if (globalScope && typeof globalScope === "object") {
    const existingApi =
      globalScope.EarningsVizLogoRaster && typeof globalScope.EarningsVizLogoRaster === "object"
        ? globalScope.EarningsVizLogoRaster
        : {};
    globalScope.EarningsVizLogoRaster = Object.freeze({
      ...existingApi,
      ...api,
    });
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
