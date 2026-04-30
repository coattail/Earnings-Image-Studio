import json
import subprocess
import unittest
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]


class CompanySelectionLatestQuarterTests(unittest.TestCase):
    def test_selecting_company_defaults_to_its_latest_quarter(self) -> None:
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
  requestAnimationFrame: () => 1,
  cancelAnimationFrame: () => {},
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
const dataset = JSON.parse(fs.readFileSync(path.join(root, "data", "dataset-index.json"), "utf8"));
context.__companies = dataset.companies
  .filter((company) => ["microsoft", "alphabet"].includes(company.id))
  .map((company, index) => vm.runInContext(`normalizeLoadedCompany(__companiesRaw[${index}], ${index})`, Object.assign(context, {
    __companiesRaw: dataset.companies.filter((company) => ["microsoft", "alphabet"].includes(company.id)),
  })));
const result = vm.runInContext(`(() => {
  state.sortedCompanies = __companies;
  state.companyById = Object.fromEntries(__companies.map((company) => [company.id, company]));
  refs.quarterSelect = { innerHTML: "", value: "" };
  refs.companyList = { querySelectorAll: () => [] };
  state.selectedCompanyId = "microsoft";
  state.selectedQuarter = "2025Q4";
  selectCompany("alphabet", { preferReplica: false, rerenderList: false });
  return {
    selectedCompanyId: state.selectedCompanyId,
    selectedQuarter: state.selectedQuarter,
    latestQuarter: getCompany("alphabet").latestQuarter,
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

        self.assertEqual(payload["selectedCompanyId"], "alphabet")
        self.assertEqual(payload["selectedQuarter"], payload["latestQuarter"])


if __name__ == "__main__":
    unittest.main()
