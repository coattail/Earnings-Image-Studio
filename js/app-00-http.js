(function initEarningsVizHttp(globalScope) {
  "use strict";

  function isJsonContentType(contentType) {
    const normalized = String(contentType || "").trim().toLowerCase();
    if (!normalized) return true;
    return normalized.includes("application/json") || normalized.includes("+json");
  }

  async function safeParseJsonResponse(response) {
    if (!response || !response.ok) return null;
    const contentType = typeof response.headers?.get === "function" ? response.headers.get("content-type") : "";
    if (!isJsonContentType(contentType)) return null;
    try {
      return await response.json();
    } catch (_error) {
      return null;
    }
  }

  const api = {
    isJsonContentType,
    safeParseJsonResponse,
  };

  if (globalScope && typeof globalScope === "object") {
    const existingApi = globalScope.EarningsVizHttp && typeof globalScope.EarningsVizHttp === "object"
      ? globalScope.EarningsVizHttp
      : {};
    globalScope.EarningsVizHttp = Object.freeze({
      ...existingApi,
      ...api,
    });
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
