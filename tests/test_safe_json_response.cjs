const test = require("node:test");
const assert = require("node:assert/strict");

const { safeParseJsonResponse } = require("../js/app-00-http.js");

test("safeParseJsonResponse returns null for html fallback pages", async () => {
  const response = new Response("<!doctype html><html></html>", {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
    },
  });

  const payload = await safeParseJsonResponse(response);

  assert.equal(payload, null);
});

test("safeParseJsonResponse parses application json payloads", async () => {
  const response = new Response(JSON.stringify({ companyCount: 2 }), {
    status: 200,
    headers: {
      "content-type": "application/json",
    },
  });

  const payload = await safeParseJsonResponse(response);

  assert.deepEqual(payload, { companyCount: 2 });
});
