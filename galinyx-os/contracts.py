"""Versioned, dependency-free contracts for the GALINYX runtime.

These validators check data shape only. They do not authenticate callers or
establish ownership, legal identity, or permission to perform external actions.
"""
from datetime import datetime
import re

SCHEMA_VERSION = 1
MAX_NAME = 128
MAX_DESCRIPTION = 1000
MAX_CAPABILITIES = 64
MAX_IDENTIFIER = 128
MAX_INPUT_BYTES = 65536
MAX_METADATA_BYTES = 16384

class ContractError(ValueError):
    """Raised when an input does not satisfy a versioned GALINYX contract."""

def _object(value, label):
    if not isinstance(value, dict):
        raise ContractError(f"{label} must be an object")
    return value

def _keys(value, required, optional, label):
    missing = set(required) - set(value)
    unknown = set(value) - set(required) - set(optional)
    if missing:
        raise ContractError(f"{label} missing required fields: {', '.join(sorted(missing))}")
    if unknown:
        raise ContractError(f"{label} contains unsupported fields: {', '.join(sorted(unknown))}")

def _string(value, label, maximum, *, nonempty=True):
    if not isinstance(value, str):
        raise ContractError(f"{label} must be a string")
    if nonempty and not value.strip():
        raise ContractError(f"{label} must not be empty")
    if len(value) > maximum:
        raise ContractError(f"{label} exceeds {maximum} characters")
    return value

def _json_size(value, label, maximum):
    import json
    try:
        encoded = json.dumps(value, allow_nan=False, ensure_ascii=False, separators=(",", ":"))
    except (TypeError, ValueError) as exc:
        raise ContractError(f"{label} must contain JSON-compatible values") from exc
    if len(encoded.encode("utf-8")) > maximum:
        raise ContractError(f"{label} exceeds {maximum} bytes")

def _version(value):
    if value != SCHEMA_VERSION or isinstance(value, bool):
        raise ContractError(f"schema_version must equal supported version {SCHEMA_VERSION}")

def validate_entity_manifest(value):
    """Validate a portable entity declaration; owner identity is external."""
    data = _object(value, "entity manifest")
    _keys(data, {"schema_version", "name", "kind", "capabilities"},
          {"description", "metadata"}, "entity manifest")
    _version(data["schema_version"])
    _string(data["name"], "name", MAX_NAME)
    _string(data["kind"], "kind", 64)
    capabilities = data["capabilities"]
    if not isinstance(capabilities, list) or len(capabilities) > MAX_CAPABILITIES:
        raise ContractError(f"capabilities must be a list of at most {MAX_CAPABILITIES} items")
    if any(not isinstance(item, str) or not item.strip() or len(item) > MAX_IDENTIFIER for item in capabilities):
        raise ContractError("each capability must be a nonempty string of at most 128 characters")
    if len(set(capabilities)) != len(capabilities):
        raise ContractError("capabilities must not contain duplicates")
    if "description" in data:
        _string(data["description"], "description", MAX_DESCRIPTION, nonempty=False)
    if "metadata" in data:
        _object(data["metadata"], "metadata")
        _json_size(data["metadata"], "metadata", MAX_METADATA_BYTES)
    return data

def validate_task_envelope(value):
    data = _object(value, "task envelope")
    required = {"schema_version", "task_id", "entity_id", "action", "input",
                "idempotency_key", "created_at", "deadline", "resource_budget",
                "policy_version"}
    _keys(data, required, set(), "task envelope")
    _version(data["schema_version"])
    for field in ("task_id", "entity_id", "action", "idempotency_key", "policy_version"):
        _string(data[field], field, MAX_IDENTIFIER)
    _object(data["input"], "input")
    _json_size(data["input"], "input", MAX_INPUT_BYTES)
    for field in ("created_at", "deadline"):
        raw = _string(data[field], field, 64)
        try:
            datetime.fromisoformat(raw.replace("Z", "+00:00"))
        except ValueError as exc:
            raise ContractError(f"{field} must be an ISO-8601 timestamp") from exc
    budget = _object(data["resource_budget"], "resource_budget")
    _keys(budget, set(), {"max_steps", "max_tokens", "max_duration_seconds", "max_cost_microunits"},
          "resource_budget")
    for key, amount in budget.items():
        if not isinstance(amount, int) or isinstance(amount, bool) or amount < 0:
            raise ContractError(f"resource_budget.{key} must be a nonnegative integer")
    return data

def validate_event_record(value):
    data = _object(value, "event record")
    required = {"schema_version", "event_id", "event_type", "actor_id",
                "entity_id", "occurred_at", "payload"}
    _keys(data, required, {"task_id", "correlation_id", "policy_version"}, "event record")
    _version(data["schema_version"])
    for field in ("event_id", "event_type", "actor_id", "entity_id"):
        _string(data[field], field, MAX_IDENTIFIER)
    for field in ("task_id", "correlation_id", "policy_version"):
        if field in data:
            _string(data[field], field, MAX_IDENTIFIER)
    raw = _string(data["occurred_at"], "occurred_at", 64)
    try:
        datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ContractError("occurred_at must be an ISO-8601 timestamp") from exc
    _object(data["payload"], "payload")
    _json_size(data["payload"], "payload", MAX_INPUT_BYTES)
    return data
