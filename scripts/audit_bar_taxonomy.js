#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const workspaceRoot = path.resolve(__dirname, "..");
const appPath = path.join(workspaceRoot, "app.js");
const datasetPath = path.join(workspaceRoot, "data", "earnings-dataset.json");

const appCode = fs.readFileSync(appPath, "utf8");
const dataset = JSON.parse(fs.readFileSync(datasetPath, "utf8"));

const context = {
  console,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  fetch: async () => {
    throw new Error("fetch disabled");
  },
  window: { addEventListener() {} },
  document: {
    addEventListener() {},
    getElementById() {
      return null;
    },
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
  },
  navigator: {},
  URL,
  Blob,
  Math,
  Date,
  Intl,
  Array,
  Object,
  Map,
  Set,
  WeakMap,
  WeakSet,
  JSON,
  Number,
  String,
  Boolean,
  RegExp,
  parseInt,
  parseFloat,
  isNaN,
  NaN,
  Infinity,
};
context.global = context;
context.globalThis = context;
vm.createContext(context);
vm.runInContext(appCode, context, { filename: "app.js" });

function stableKeys(quarter) {
  return [...new Set((quarter?.segmentRows || []).map((item) => item.key).filter((key) => key && key !== "otherrevenue" && key !== "reportedrevenue"))].sort();
}

function signature(quarter) {
  return stableKeys(quarter).join("|");
}

function formatIssue(issue) {
  return [
    issue.company,
    issue.quarterKey,
    issue.rawSegmentSource,
    issue.reconciliationMode || "none",
    issue.coverageRatio !== null && issue.coverageRatio !== undefined ? issue.coverageRatio.toFixed(3) : "n/a",
    issue.details,
  ].join(" | ");
}

const isolatedSchemaIssues = [];
const isolatedOfficialGroupIssues = [];
const syntheticResidualIssues = [];

for (const company of dataset.companies || []) {
  const history = context.buildRevenueSegmentBarHistory(company, "2025Q4", 80);
  if (!history?.quarters?.length) continue;
  const quarters = history.quarters;

  for (let index = 0; index < quarters.length; index += 1) {
    const quarter = quarters[index];
    const residualRow = (quarter.segmentRows || []).find((item) => item?.key === "otherrevenue") || null;
    if (residualRow && quarter.rawSegmentSource !== "official-groups") {
      syntheticResidualIssues.push({
        company: company.id,
        quarterKey: quarter.quarterKey,
        rawSegmentSource: quarter.rawSegmentSource || "none",
        reconciliationMode: quarter.reconciliationMode || "none",
        coverageRatio: quarter.rawCoverageRatio ?? null,
        details: `residualShare=${((Number(residualRow.valueBn) || 0) / Math.max(Number(quarter.totalRevenueBn) || 0, 0.001)).toFixed(3)}`,
      });
    }

    if (index === 0 || index === quarters.length - 1) continue;
    const previousQuarter = quarters[index - 1];
    const nextQuarter = quarters[index + 1];
    const previousSignature = signature(previousQuarter);
    const currentSignature = signature(quarter);
    const nextSignature = signature(nextQuarter);
    if (!previousSignature || previousSignature !== nextSignature || currentSignature === previousSignature) continue;
    if (quarter.rawSegmentSource === "official-segments") {
      isolatedSchemaIssues.push({
        company: company.id,
        quarterKey: quarter.quarterKey,
        rawSegmentSource: quarter.rawSegmentSource || "none",
        reconciliationMode: quarter.reconciliationMode || "none",
        coverageRatio: quarter.rawCoverageRatio ?? null,
        details: `prev=${previousSignature} | cur=${currentSignature} | next=${nextSignature}`,
      });
      continue;
    }
    if (quarter.rawSegmentSource !== "official-groups") continue;
    isolatedOfficialGroupIssues.push({
      company: company.id,
      quarterKey: quarter.quarterKey,
      rawSegmentSource: quarter.rawSegmentSource || "none",
      reconciliationMode: quarter.reconciliationMode || "none",
      coverageRatio: quarter.rawCoverageRatio ?? null,
      details: `prev=${previousSignature} | cur=${currentSignature} | next=${nextSignature}`,
    });
  }
}

console.log("=== Revenue Bar Audit ===");
console.log(`isolated_official_segments=${isolatedSchemaIssues.length}`);
isolatedSchemaIssues.forEach((issue) => console.log(formatIssue(issue)));
console.log("");
console.log(`isolated_official_groups=${isolatedOfficialGroupIssues.length}`);
isolatedOfficialGroupIssues.forEach((issue) => console.log(formatIssue(issue)));
console.log("");
console.log(`synthetic_residuals=${syntheticResidualIssues.length}`);
syntheticResidualIssues.forEach((issue) => console.log(formatIssue(issue)));
