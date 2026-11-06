"""Persist useful failure context without suppressing retries or failures."""
import hashlib
import json


class SourceContractError(RuntimeError):
    def __init__(self, message, source_url):
        super().__init__(message)
        self.source_url = source_url


def record_failure(state, item, error, phase, now):
    company_state = state.setdefault(item['companyId'], {})
    previous = company_state.get('failure') or {}
    release = item.get('release') or {}
    source = (getattr(error, 'source_url', None)
              or getattr(error, 'url', None)
              or getattr(getattr(error, 'request', None), 'url', None)
              or getattr(getattr(error, 'response', None), 'url', None)
              or item.get('refreshSourceUrl') or release.get('sourceUrl')
              or (release.get('entry') or {}).get('statementSourceUrl') or '')
    message = str(error)[:2000]
    quarter = item.get('remoteQuarter') or item.get('remoteOfficialRevenueQuarter') or ''
    signature = [phase, type(error).__name__, message, quarter,
                 item.get('remoteAccession') or release.get('accession') or '', source]
    fingerprint = hashlib.sha256(json.dumps(signature).encode()).hexdigest()
    same = previous.get('fingerprint') == fingerprint
    failure = dict(phase=phase, errorType=type(error).__name__, message=message,
                   quarter=quarter, sourceUrl=source, fingerprint=fingerprint,
                   consecutiveFailures=previous.get('consecutiveFailures', 0) + 1,
                   sameFailureCount=previous.get('sameFailureCount', 0) + 1 if same else 1,
                   firstFailedAt=previous.get('firstFailedAt', now), lastFailedAt=now)
    company_state.update(error=message, failure=failure)
    item['failure'] = failure


def clear_failure(state, company_id):
    company_state = state.setdefault(company_id, {})
    for field in ('error', 'failure', 'pendingDetails'):
        company_state.pop(field, None)
