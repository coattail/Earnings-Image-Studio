from datetime import date
from pathlib import Path
import sys
import unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from earnings_windows import release_window

class ReleaseWindowTests(unittest.TestCase):
    def payload(self,dates):return {'financials':{str(i):{'statementFilingDate':d}for i,d in enumerate(dates)}}
    def test_non_calendar_issuer_is_active_near_its_own_release(self):
        self.assertTrue(release_window({},self.payload(['2025-11-19','2026-08-20']),date(2026,11,18))[0])
    def test_outside_release_window_does_not_refresh_financials(self):
        self.assertFalse(release_window({},self.payload(['2025-11-19','2026-08-20']),date(2026,10,1))[0])
    def test_recent_release_remains_eligible_for_statutory_filing_enrichment(self):
        self.assertTrue(release_window({},self.payload(['2026-10-30']),date(2026,11,3))[0])
    def test_announced_date_overrides_historical_cadence(self):
        self.assertTrue(release_window({'nextEarningsDate':'2026-10-05'},self.payload(['2026-08-20']),date(2026,10,1))[0])
    def test_missing_history_is_discovered_instead_of_silently_ignored(self):
        self.assertTrue(release_window({}, {},date(2026,11,3))[0])

if __name__=='__main__':unittest.main()
