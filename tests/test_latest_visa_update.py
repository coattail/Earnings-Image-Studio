import json
import unittest
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]


class LatestVisaUpdateTests(unittest.TestCase):
    def test_visa_fy2026_q3_official_release_is_complete(self) -> None:
        dataset = json.loads((ROOT_DIR / "data" / "earnings-dataset.json").read_text(encoding="utf-8"))
        visa = next(company for company in dataset["companies"] if company["id"] == "visa")

        self.assertEqual(visa["quarters"][-1], "2026Q2")
        latest = visa["financials"]["2026Q2"]
        self.assertEqual(latest["fiscalLabel"], "FY2026 Q3")
        self.assertEqual(latest["statementFilingDate"], "2026-07-28")
        self.assertEqual(latest["statementSource"], "manual-visa-earnings-release")
        self.assertAlmostEqual(latest["revenueBn"], 11.633, delta=0.001)
        self.assertAlmostEqual(latest["operatingIncomeBn"], 6.877, delta=0.001)
        self.assertAlmostEqual(latest["netIncomeBn"], 5.628, delta=0.001)

        segments = {row["memberKey"]: row for row in latest["officialRevenueSegments"]}
        self.assertEqual(
            set(segments),
            {
                "servicerevenues",
                "dataprocessingrevenues",
                "internationaltransactionrevenues",
                "otherrevenues",
            },
        )
        self.assertAlmostEqual(segments["servicerevenues"]["valueBn"], 4.922, delta=0.001)
        self.assertAlmostEqual(segments["dataprocessingrevenues"]["valueBn"], 6.042, delta=0.001)
        self.assertAlmostEqual(segments["internationaltransactionrevenues"]["valueBn"], 3.853, delta=0.001)
        self.assertAlmostEqual(segments["otherrevenues"]["valueBn"], 1.496, delta=0.001)


if __name__ == "__main__":
    unittest.main()
