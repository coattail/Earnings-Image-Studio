import json
import re
import subprocess
import tempfile
import unittest
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
NODE_RENDERER = ROOT_DIR / "scripts" / "direct_chart_render.cjs"
DATASET_PATH = ROOT_DIR / "data" / "earnings-dataset.json"


def load_dataset_company(company_id: str) -> dict[str, object]:
    dataset = json.loads(DATASET_PATH.read_text(encoding="utf-8"))
    for company in dataset.get("companies", []):
        if str(company.get("id") or "").strip().lower() == company_id.lower():
            return company
    raise AssertionError(f"Company '{company_id}' was not found in the dataset.")


def render_bar_summary(company_payload: dict[str, object], basename: str, quarter: str = "latest") -> dict[str, object]:
    with tempfile.TemporaryDirectory(prefix=f"bars-{basename}-") as temp_dir:
        output_dir = Path(temp_dir)
        payload_path = output_dir / f"{basename}.json"
        payload_path.write_text(json.dumps(company_payload, ensure_ascii=False), encoding="utf-8")
        result = subprocess.run(
            [
                "node",
                str(NODE_RENDERER),
                "--payload",
                str(payload_path),
                "--quarter",
                quarter,
                "--language",
                "zh",
                "--modes",
                "bars",
                "--output-dir",
                str(output_dir),
                "--basename",
                basename,
            ],
            cwd=ROOT_DIR,
            check=True,
            capture_output=True,
            text=True,
        )
        return json.loads(result.stdout)


def render_bar_svg(company_payload: dict[str, object], basename: str, quarter: str = "latest") -> str:
    with tempfile.TemporaryDirectory(prefix=f"bars-{basename}-") as temp_dir:
        output_dir = Path(temp_dir)
        payload_path = output_dir / f"{basename}.json"
        payload_path.write_text(json.dumps(company_payload, ensure_ascii=False), encoding="utf-8")
        result = subprocess.run(
            [
                "node",
                str(NODE_RENDERER),
                "--payload",
                str(payload_path),
                "--quarter",
                quarter,
                "--language",
                "zh",
                "--modes",
                "bars",
                "--output-dir",
                str(output_dir),
                "--basename",
                basename,
            ],
            cwd=ROOT_DIR,
            check=True,
            capture_output=True,
            text=True,
        )
        summary = json.loads(result.stdout)
        svg_path = Path(summary["outputs"]["bars"]["svg"])
        return svg_path.read_text(encoding="utf-8")


def legend_color_by_label(svg_markup: str) -> dict[str, str]:
    matches = re.findall(
        r'<rect x="[^"]+" y="[^"]+" width="(?:24|28)" height="(?:24|28)"[^>]* fill="([^"]+)"></rect><text[^>]*>([^<]+)</text>',
        svg_markup,
    )
    return {label: color for color, label in matches}


def legend_labels(svg_markup: str) -> list[str]:
    return [
        label
        for _color, label in re.findall(
            r'<rect x="[^"]+" y="[^"]+" width="(?:24|28)" height="(?:24|28)"[^>]* fill="([^"]+)"></rect><text[^>]*>([^<]+)</text>',
            svg_markup,
        )
    ]


class BarHistoryWindowCountTests(unittest.TestCase):
    def test_tsm_latest_bar_window_keeps_thirty_quarters(self) -> None:
        summary = render_bar_summary(load_dataset_company("tsmc"), "tsmc-window")

        self.assertEqual(summary["outputs"]["bars"]["quarterCount"], 30)

    def test_byd_latest_bar_window_uses_all_available_quarters(self) -> None:
        company = load_dataset_company("byd")
        expected_quarter_count = min(30, len(company.get("quarters") or []))
        summary = render_bar_summary(company, "byd-window")

        self.assertEqual(summary["outputs"]["bars"]["quarterCount"], expected_quarter_count)

    def test_byd_annual_bars_are_rendered_as_second_half_incremental_periods(self) -> None:
        svg_markup = render_bar_svg(load_dataset_company("byd"), "byd-incremental-half-year", "2025Q4")

        self.assertIn(">2023 H2</text>", svg_markup)
        self.assertIn(">2024 H2</text>", svg_markup)
        self.assertIn(">2025 H2</text>", svg_markup)
        self.assertNotIn(">FY 2025</text>", svg_markup)
        self.assertNotIn(">94</text>", svg_markup)

    def test_segment_colors_stay_stable_when_anchor_quarter_changes(self) -> None:
        company = load_dataset_company("amd")
        early_colors = legend_color_by_label(render_bar_svg(company, "amd-early-window", "2022Q3"))
        latest_colors = legend_color_by_label(render_bar_svg(company, "amd-latest-window", "2026Q1"))

        for label in ["数据中心", "客户端", "游戏", "嵌入式"]:
            self.assertIn(label, early_colors)
            self.assertIn(label, latest_colors)
            self.assertEqual(
                early_colors[label],
                latest_colors[label],
                f"{label} should keep the same bar color regardless of the selected quarter.",
            )

    def test_alibaba_bar_history_uses_four_comparable_business_groups(self) -> None:
        labels = legend_labels(render_bar_svg(load_dataset_company("alibaba"), "alibaba-bar-taxonomy"))

        self.assertEqual(
            labels,
            ["阿里巴巴中国电商集团", "其他业务", "云智能集团", "阿里巴巴数字商业集团"],
        )

    def test_alibaba_bar_history_marks_fy24_taxonomy_break(self) -> None:
        svg_markup = render_bar_svg(load_dataset_company("alibaba"), "alibaba-bar-taxonomy-break")

        self.assertIn('data-bar-taxonomy-break="alibaba-fy24"', svg_markup)
        self.assertIn("Q1 FY24 起分部口径调整", svg_markup)

    def test_amd_bar_history_marks_segment_taxonomy_break(self) -> None:
        svg_markup = render_bar_svg(load_dataset_company("amd"), "amd-bar-taxonomy-break", "2026Q1")

        self.assertIn('data-bar-taxonomy-break="amd-2022q1"', svg_markup)
        self.assertIn("Q1 FY22 起分部口径调整", svg_markup)

    def test_oracle_bar_history_marks_fy26_taxonomy_break(self) -> None:
        svg_markup = render_bar_svg(load_dataset_company("oracle"), "oracle-bar-taxonomy-break", "2026Q2")

        self.assertIn('data-bar-taxonomy-break="oracle-fy26"', svg_markup)
        self.assertIn("Q1 FY26 起分部口径调整", svg_markup)

    def test_oracle_bar_history_uses_high_contrast_segment_colors(self) -> None:
        colors = legend_color_by_label(render_bar_svg(load_dataset_company("oracle"), "oracle-bar-colors", "2026Q2"))

        self.assertEqual(colors["云业务"], "#2563eb")
        self.assertEqual(colors["软件"], "#7c3aed")
        self.assertEqual(colors["服务"], "#099267")
        self.assertEqual(colors["硬件"], "#f1751e")
        self.assertEqual(colors["云与 许可证业务"], "#e11d48")

    def test_broadcom_bar_history_does_not_mark_tiny_ip_licensing_flips(self) -> None:
        svg_markup = render_bar_svg(load_dataset_company("broadcom"), "broadcom-bar-taxonomy-break", "2026Q1")

        self.assertNotIn("data-bar-taxonomy-break", svg_markup)

    def test_tencent_taxonomy_break_note_avoids_fx_note(self) -> None:
        svg_markup = render_bar_svg(load_dataset_company("tencent"), "tencent-bar-taxonomy-break", "2026Q1")
        match = re.search(r'<text x="([^"]+)"[^>]*>Q1 FY19 起分部口径调整</text>', svg_markup)

        self.assertIsNotNone(match)
        self.assertGreater(float(match.group(1)), 300)

    def test_tencent_taxonomy_break_connector_avoids_logo(self) -> None:
        svg_markup = render_bar_svg(load_dataset_company("tencent"), "tencent-bar-taxonomy-break", "2026Q1")
        match = re.search(
            r'data-bar-taxonomy-break="tencent-2019q1"[\s\S]*?<path d="M [0-9.]+ ([0-9.]+) V',
            svg_markup,
        )

        self.assertIsNotNone(match)
        self.assertGreater(float(match.group(1)), 360)

    def test_netease_bar_history_keeps_only_main_taxonomy_break(self) -> None:
        svg_markup = render_bar_svg(load_dataset_company("netease"), "netease-bar-taxonomy-break", "2025Q4")

        self.assertEqual(svg_markup.count("data-bar-taxonomy-break"), 1)
        self.assertIn("Q3 FY19 起分部口径调整", svg_markup)

    def test_visa_sankey_revenue_groups_match_bar_taxonomy(self) -> None:
        script = r"""
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const root = process.cwd();
function createContext() {
  const noop = () => {};
  const documentStub = {
    addEventListener: noop,
    removeEventListener: noop,
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementById: () => null,
    createElement: () => ({ style: {}, setAttribute: noop, appendChild: noop }),
    createElementNS: () => ({ style: {}, setAttribute: noop, appendChild: noop }),
    body: null,
    documentElement: null,
  };
  const windowStub = { addEventListener: noop, removeEventListener: noop, document: documentStub, devicePixelRatio: 1 };
  const context = {
    console, setTimeout, clearTimeout, setInterval, clearInterval,
    requestAnimationFrame: (callback) => setTimeout(() => callback(Date.now()), 0),
    cancelAnimationFrame: clearTimeout,
    performance: { now: () => Date.now() },
    Math, Number, String, Boolean, Array, Object, JSON, Date, RegExp, Map, Set, WeakMap, WeakSet, Intl, Promise,
    URL, URLSearchParams, TextEncoder, TextDecoder,
    window: windowStub, document: documentStub, navigator: { userAgent: "node" },
    globalThis: null, self: null, fetch: undefined,
  };
  context.globalThis = context;
  context.self = context;
  windowStub.window = windowStub;
  windowStub.self = windowStub;
  windowStub.globalThis = context;
  return vm.createContext(context);
}
const context = createContext();
["app-00-foundation.js", "app-01-layout.js", "app-02-sankey.js", "app-03-data.js", "app-04-bootstrap.js"].forEach((filename) => {
  vm.runInContext(fs.readFileSync(path.join(root, "js", filename), "utf8"), context, { filename });
});
const dataset = JSON.parse(fs.readFileSync(path.join(root, "data", "earnings-dataset.json"), "utf8"));
context.__payload = dataset.companies.find((company) => company.id === "visa");
const result = vm.runInContext(`(() => {
  const company = normalizeLoadedCompany(__payload, 0);
  const snapshot = buildSnapshot(company, "2026Q1");
  const history = buildRevenueSegmentBarHistory(company, "2026Q1", 30);
  const normalize = (rows) => rows.map((item) => ({
    key: item.memberKey || item.key || item.id,
    valueBn: Number(item.valueBn.toFixed(3)),
  })).sort((left, right) => left.key.localeCompare(right.key));
  return {
    sankey: normalize(snapshot.businessGroups || []),
    bars: normalize(history.quarters[history.quarters.length - 1].segmentRows || []),
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

        self.assertEqual(payload["sankey"], payload["bars"])


if __name__ == "__main__":
    unittest.main()
