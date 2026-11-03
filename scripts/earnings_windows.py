"""Company-specific release windows learned from actual publication dates."""
from datetime import date,timedelta
import calendar

def day(value):
    try:return date.fromisoformat(str(value)[:10])
    except ValueError:return None

def release_window(company,payload,today=None):
    today=today or date.today()
    dates=[]
    for entry in (payload or {}).get('financials',{}).values():
        filed=day((entry.get('automaticEarnings')or{}).get('filingDate')or entry.get('statementFilingDate'))
        end=day(entry.get('periodEnd'))
        if filed and filed<=today and (not end or end<=filed):dates.append(filed)
    explicit=day(company.get('nextEarningsDate')or (payload or {}).get('nextEarningsDate'))
    if explicit and explicit-timedelta(days=14)<=today<=explicit+timedelta(days=35):return True,'announced-release-window'
    if not dates:return True,'first-release-discovery'
    latest=max(dates)
    if 0<=(today-latest).days<=21:return True,'recent-release-enrichment-window'
    policy=(payload or {}).get('classificationPolicy')or{}
    cadence=182 if policy.get('officialClassificationReportingFrequency')=='semiannual'else 91
    predictions=[latest+timedelta(days=cadence*step)for step in range(1,5)]
    # Last year's individual quarter dates preserve non-calendar fiscal years
    # and the longer delay before annual results. Do not hard-code Q1 months.
    for filed in dates:
        if (today-filed).days>800:continue
        for year in [today.year,today.year+1]:
            if year<=filed.year:continue
            predictions.append(date(year,filed.month,min(filed.day,calendar.monthrange(year,filed.month)[1])))
    if any(predicted-timedelta(days=14)<=today<=predicted+timedelta(days=35)for predicted in predictions):
        return True,'historical-release-window'
    return False,'outside-company-earnings-window'
