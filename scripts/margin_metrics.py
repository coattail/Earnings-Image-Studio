"""Complete margin comparisons after every source has finished enrichment.

Compare the same reporting quarter, never the fourth preceding available row:
an issuer may have missing quarters or a fiscal year different from the calendar.
"""
from datetime import date
import math
import re

MARGIN_FIELDS = (
    ("grossMarginPct", "grossProfitBn", "grossMarginYoyDeltaPp"),
    ("operatingMarginPct", "operatingIncomeBn", "operatingMarginYoyDeltaPp"),
    ("profitMarginPct", "netIncomeBn", "profitMarginYoyDeltaPp"),
)


def finite(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def comparable_year_ago(financials, quarter):
    current = financials[quarter]
    fiscal_year, fiscal_quarter = str(current.get("fiscalYear", "")), current.get("fiscalQuarter")
    prior = None
    if fiscal_year.isdigit() and re.fullmatch(r"Q[1-4]", str(fiscal_quarter)):
        candidates = [entry for entry in financials.values()
                      if str(entry.get("fiscalYear")) == str(int(fiscal_year) - 1)
                      and entry.get("fiscalQuarter") == fiscal_quarter]
        if len(candidates) == 1:
            prior = candidates[0]
    if prior is None and re.fullmatch(r"\d{4}Q[1-4]", quarter):
        prior = financials.get(f"{int(quarter[:4]) - 1}{quarter[4:]}")
        if prior and fiscal_quarter and prior.get("fiscalQuarter") not in (None, fiscal_quarter):
            return None
    if not prior:
        return None
    if current.get('statementSpanQuarters', 1) != prior.get('statementSpanQuarters', 1):
        return None
    # Quarterly and cumulative/annual periods must not be mixed.
    try:
        ends = [date.fromisoformat(e["periodEnd"]) for e in (current, prior)]
        if not 330 <= (ends[0] - ends[1]).days <= 400:
            return None
        spans = [(ends[i] - date.fromisoformat(e["statementPeriodStart"])).days
                 for i, e in enumerate((current, prior)) if e.get("statementPeriodStart")]
        if len(spans) == 2 and abs(spans[0] - spans[1]) > 20:
            return None
    except (KeyError, ValueError, TypeError):
        pass
    return prior


def margin_value(entry, margin_field, amount_field):
    value = entry.get(margin_field)
    if finite(value):
        return value
    revenue, amount = entry.get("revenueBn"), entry.get(amount_field)
    if finite(revenue) and revenue > 0 and finite(amount):
        return 100 * amount / revenue
    return None


def complete_margin_metrics(financials, *, quarters=None):
    """Fill gaps only; retain issuer/recast comparisons already supplied."""
    for quarter in financials if quarters is None else quarters:
        entry = financials[quarter]
        prior = comparable_year_ago(financials, quarter)
        for margin, amount, delta in MARGIN_FIELDS:
            current_value = margin_value(entry, margin, amount)
            if entry.get(margin) is None and current_value is not None:
                entry[margin] = round(current_value, 6)
            prior_value = margin_value(prior, margin, amount) if prior else None
            if entry.get(delta) is None and current_value is not None and prior_value is not None:
                entry[delta] = round(current_value - prior_value, 3)


def missing_margin_comparisons(financials, quarter):
    prior = comparable_year_ago(financials, quarter)
    if not prior:
        return []
    entry = financials[quarter]
    return [delta for margin, amount, delta in MARGIN_FIELDS
            if margin_value(entry, margin, amount) is not None
            and margin_value(prior, margin, amount) is not None and not finite(entry.get(delta))]
