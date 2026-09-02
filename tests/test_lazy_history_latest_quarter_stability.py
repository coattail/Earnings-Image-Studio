import json
import subprocess
import unittest
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]


class LazyHistoryLatestQuarterStabilityTests(unittest.TestCase):
    def test_microsoft_latest_sankey_structure_survives_history_load(self) -> None:
        script = r"""
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const root = process.cwd();
const documentStub = {
  querySelector: () => null,
  querySelectorAll: () => [],
  getElementById: () => null,
  addEventListener: () => {},
};
const context = vm.createContext({
  console,
  setTimeout,
  clearTimeout,
  Math,
  Number,
  String,
  Boolean,
  Array,
  Object,
  JSON,
  Date,
  RegExp,
  Map,
  Set,
  Intl,
  Promise,
  URL,
  URLSearchParams,
  TextEncoder,
  TextDecoder,
  document: documentStub,
  window: { addEventListener: () => {}, removeEventListener: () => {}, document: documentStub },
  navigator: { userAgent: "node" },
});
context.globalThis = context;
["app-00-foundation.js", "app-01-layout.js", "app-02-sankey.js", "app-03-data.js", "app-04-bootstrap.js"].forEach((filename) => {
  vm.runInContext(fs.readFileSync(path.join(root, "js", filename), "utf8"), context, { filename });
});
const indexCompany = JSON.parse(fs.readFileSync(path.join(root, "data", "dataset-index.json"), "utf8"))
  .companies.find((company) => company.id === "microsoft");
const historyCompany = JSON.parse(fs.readFileSync(path.join(root, "data", "cache", "microsoft.json"), "utf8"));
context.indexCompany = indexCompany;
context.historyCompany = historyCompany;
const result = vm.runInContext(`(() => {
  const latestCompany = normalizeLoadedCompany(indexCompany, 0);
  const latestQuarter = latestCompany.latestQuarter;
  const beforeSnapshot = buildSnapshot(latestCompany, latestQuarter);
  const mergedCompany = mergeCompanyHistoricalPayload(latestCompany, historyCompany);
  const afterSnapshot = buildSnapshot(mergedCompany, latestQuarter);
  return {
    latestQuarter,
    beforeEntryOpex: latestCompany.financials[latestQuarter].officialOpexBreakdown,
    afterEntryOpex: mergedCompany.financials[latestQuarter].officialOpexBreakdown,
    beforeOpex: beforeSnapshot.opexBreakdown,
    afterOpex: afterSnapshot.opexBreakdown,
    beforeBusinessGroups: beforeSnapshot.businessGroups,
    afterBusinessGroups: afterSnapshot.businessGroups,
    historicalQuarterAvailable: !!mergedCompany.financials["2025Q4"],
    dataLoadMode: mergedCompany.dataLoadMode,
  };
})()`, context);
process.stdout.write(JSON.stringify(result));
"""
        result = subprocess.run(
            ["node", "-e", script],
            cwd=ROOT_DIR,
            check=True,
            capture_output=True,
            text=True,
        )
        payload = json.loads(result.stdout)

        self.assertEqual(payload["latestQuarter"], "2026Q2")
        self.assertIsNone(payload["beforeEntryOpex"])
        self.assertIsNone(payload["afterEntryOpex"])
        self.assertEqual(payload["afterOpex"], payload["beforeOpex"])
        self.assertEqual(payload["afterBusinessGroups"], payload["beforeBusinessGroups"])
        self.assertTrue(payload["historicalQuarterAvailable"])
        self.assertEqual(payload["dataLoadMode"], "full")

    def test_broadcom_latest_uses_the_same_compact_structure_before_and_after_history_load(self) -> None:
        script = r"""
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const root = process.cwd();
const documentStub = {
  querySelector: () => null,
  querySelectorAll: () => [],
  getElementById: () => null,
  addEventListener: () => {},
};
const context = vm.createContext({
  console, setTimeout, clearTimeout, Math, Number, String, Boolean, Array, Object,
  JSON, Date, RegExp, Map, Set, Intl, Promise, URL, URLSearchParams, TextEncoder,
  TextDecoder, document: documentStub,
  window: { addEventListener: () => {}, removeEventListener: () => {}, document: documentStub },
  navigator: { userAgent: "node" },
});
context.globalThis = context;
["app-00-foundation.js", "app-01-layout.js", "app-02-sankey.js", "app-03-data.js", "app-04-bootstrap.js"].forEach((filename) => {
  vm.runInContext(fs.readFileSync(path.join(root, "js", filename), "utf8"), context, { filename });
});
const indexCompany = JSON.parse(fs.readFileSync(path.join(root, "data", "dataset-index.json"), "utf8"))
  .companies.find((company) => company.id === "broadcom");
const historyCompany = JSON.parse(fs.readFileSync(path.join(root, "data", "cache", "broadcom.json"), "utf8"));
context.indexCompany = indexCompany;
context.historyCompany = historyCompany;
const result = vm.runInContext(`(() => {
  const latestCompany = normalizeLoadedCompany(indexCompany, 0);
  const latestQuarter = latestCompany.latestQuarter;
  const beforeSnapshot = buildSnapshot(latestCompany, latestQuarter);
  const mergedCompany = mergeCompanyHistoricalPayload(latestCompany, historyCompany);
  const afterSnapshot = buildSnapshot(mergedCompany, latestQuarter);
  const taxLabels = (snapshot) => [...(snapshot.positiveAdjustments || []), ...(snapshot.belowOperatingItems || [])]
    .map((item) => item.nameZh || item.name || "");
  return {
    latestQuarter,
    beforePresentation: latestCompany.sankeyPresentation,
    afterPresentation: mergedCompany.sankeyPresentation,
    beforeOpex: beforeSnapshot.opexBreakdown,
    afterOpex: afterSnapshot.opexBreakdown,
    beforeCost: beforeSnapshot.costBreakdown,
    afterCost: afterSnapshot.costBreakdown,
    beforeTaxLabels: taxLabels(beforeSnapshot),
    afterTaxLabels: taxLabels(afterSnapshot),
  };
})()`, context);
process.stdout.write(JSON.stringify(result));
"""
        result = subprocess.run(
            ["node", "-e", script],
            cwd=ROOT_DIR,
            check=True,
            capture_output=True,
            text=True,
        )
        payload = json.loads(result.stdout)

        self.assertEqual(payload["latestQuarter"], "2026Q3")
        self.assertEqual(payload["beforePresentation"], payload["afterPresentation"])
        self.assertEqual(payload["beforeOpex"], payload["afterOpex"])
        self.assertEqual(payload["beforeCost"], payload["afterCost"])
        self.assertEqual(len(payload["beforeOpex"]), 2)
        self.assertEqual(payload["beforeCost"], [])
        self.assertIn("税项", payload["beforeTaxLabels"])
        self.assertIn("税项", payload["afterTaxLabels"])


if __name__ == "__main__":
    unittest.main()
