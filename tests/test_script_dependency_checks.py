import io
import sys
import unittest
from pathlib import Path
from unittest.mock import patch


ROOT_DIR = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = ROOT_DIR / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

import build_dataset  # noqa: E402
import run_parser_regression_suite  # noqa: E402


class ScriptDependencyCheckTests(unittest.TestCase):
    def test_build_dataset_reports_missing_dependencies_before_work(self) -> None:
        with (
            patch.object(build_dataset, "_MISSING_RUNTIME_MODULES", ["bs4", "requests"]),
            patch.object(build_dataset, "parse_args") as parse_args,
            patch("sys.stderr", new=io.StringIO()) as stderr,
        ):
            exit_code = build_dataset.main()

        self.assertEqual(exit_code, 2)
        self.assertIn("Missing Python dependencies: bs4, requests.", stderr.getvalue())
        self.assertIn(build_dataset.RUNTIME_DEPENDENCY_INSTALL_HINT, stderr.getvalue())
        parse_args.assert_not_called()

    def test_regression_suite_reports_missing_dependencies_before_cases(self) -> None:
        with (
            patch.object(run_parser_regression_suite, "_MISSING_RUNTIME_MODULES", ["requests"]),
            patch("sys.stderr", new=io.StringIO()) as stderr,
        ):
            with self.assertRaises(SystemExit) as exit_ctx:
                run_parser_regression_suite.main()

        self.assertEqual(exit_ctx.exception.code, 2)
        self.assertIn("Missing Python dependencies: requests.", stderr.getvalue())
        self.assertIn(run_parser_regression_suite.RUNTIME_DEPENDENCY_INSTALL_HINT, stderr.getvalue())


if __name__ == "__main__":
    unittest.main()
