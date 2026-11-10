#!/usr/bin/env bash
set -euo pipefail

# The same offline contracts guard pull requests and scheduled publication.
"${EARNINGS_TEST_PYTHON:-python}" -m unittest \
  tests.test_release_chart_quality tests.test_release_chart_completion \
  tests.test_earnings_windows tests.test_publish_earnings_data \
  tests.test_all_company_chart_contract tests.test_margin_metrics \
  tests.test_release_parser_comparatives tests.test_official_ir_fallbacks \
  tests.test_generic_filing_table_cache_version tests.test_pages_dataset_index \
  tests.test_public_assets tests.test_earnings_watch_failures \
  tests.test_earnings_watch tests.test_check_for_updates_official_ir \
  tests.test_stockanalysis_financials_contracts tests.test_stockanalysis_financials_adapter \
  tests.test_earnings_pipeline_guardrails tests.test_scheduled_failure_replays

node --test tests/test_release_chart_render.cjs tests/test_cost_stage_clearance.cjs \
  tests/test_startup_assets.cjs tests/test_balanced_expense_fan.cjs tests/test_built_runtime_parity.cjs
