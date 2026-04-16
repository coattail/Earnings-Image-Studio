from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass, field
from typing import Any


def build_error_detail(
    message: Any,
    *,
    layer: str = "",
    source_id: str = "",
    phase: str = "",
    severity: str = "error",
    error_type: str = "",
    retryable: bool | None = None,
) -> dict[str, Any]:
    detail = {
        "message": str(message or "").strip(),
        "severity": str(severity or "error").strip() or "error",
    }
    if layer:
        detail["layer"] = str(layer)
    if source_id:
        detail["sourceId"] = str(source_id)
    if phase:
        detail["phase"] = str(phase)
    if error_type:
        detail["errorType"] = str(error_type)
    if retryable is not None:
        detail["retryable"] = bool(retryable)
    return detail


def normalize_error_details(
    raw_details: Any,
    *,
    layer: str = "",
    source_id: str = "",
    phase: str = "",
    severity: str = "error",
) -> list[dict[str, Any]]:
    normalized: list[dict[str, Any]] = []
    if not isinstance(raw_details, list):
        return normalized
    for raw in raw_details:
        if not isinstance(raw, dict):
            continue
        item = deepcopy(raw)
        message = str(item.get("message") or item.get("error") or "").strip()
        if not message:
            continue
        item["message"] = message
        if layer and not item.get("layer"):
            item["layer"] = str(layer)
        if source_id and not item.get("sourceId"):
            item["sourceId"] = str(source_id)
        if phase and not item.get("phase"):
            item["phase"] = str(phase)
        if not item.get("severity"):
            item["severity"] = str(severity or "error").strip() or "error"
        if item.get("errorType") is None and item.get("type"):
            item["errorType"] = str(item.get("type"))
        normalized.append(item)
    return normalized


def payload_error_bundle(
    payload: Any,
    *,
    layer: str = "",
    source_id: str = "",
    phase: str = "",
    severity: str = "error",
) -> tuple[list[str], list[dict[str, Any]]]:
    if not isinstance(payload, dict):
        return [], []
    errors = [str(item).strip() for item in (payload.get("errors") or []) if str(item).strip()]
    error_details = normalize_error_details(
        payload.get("errorDetails"),
        layer=layer,
        source_id=source_id,
        phase=phase,
        severity=severity,
    )
    if not error_details and errors:
        error_details = [
            build_error_detail(
                message,
                layer=layer,
                source_id=source_id,
                phase=phase,
                severity=severity,
            )
            for message in errors
        ]
    if not errors and error_details:
        errors = [str(detail.get("message") or "").strip() for detail in error_details if str(detail.get("message") or "").strip()]
    return errors, error_details


@dataclass
class AdapterResult:
    adapter_id: str
    kind: str
    label: str
    priority: int
    payload: dict[str, Any]
    field_priorities: dict[str, int] = field(default_factory=dict)
    errors: list[str] = field(default_factory=list)
    error_details: list[dict[str, Any]] = field(default_factory=list)
    enabled: bool = True
