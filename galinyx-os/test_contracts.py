import unittest
from contracts import (
    ContractError, validate_entity_manifest, validate_event_record,
    validate_task_envelope,
)

class ContractTests(unittest.TestCase):
    def test_valid_entity_manifest(self):
        manifest = {
            "schema_version": 1, "name": "Rivet Reach", "kind": "application",
            "capabilities": ["leads.read"], "metadata": {"region": "KY"}
        }
        self.assertIs(validate_entity_manifest(manifest), manifest)

    def test_entity_rejects_unknown_fields_and_duplicate_capabilities(self):
        base = {"schema_version": 1, "name": "App", "kind": "application", "capabilities": []}
        with self.assertRaises(ContractError):
            validate_entity_manifest({**base, "owner_id": "claimed-owner"})
        with self.assertRaises(ContractError):
            validate_entity_manifest({**base, "capabilities": ["read", "read"]})

    def test_entity_rejects_unsupported_schema_version(self):
        with self.assertRaises(ContractError):
            validate_entity_manifest({
                "schema_version": 2, "name": "App", "kind": "application", "capabilities": []
            })

    def test_valid_task_envelope(self):
        task = {
            "schema_version": 1, "task_id": "task-1", "entity_id": "entity-1",
            "action": "memory.write", "input": {"key": "a"},
            "idempotency_key": "request-1", "created_at": "2026-11-15T12:00:00Z",
            "deadline": "2026-11-15T12:05:00Z", "resource_budget": {"max_steps": 10},
            "policy_version": "policy-1"
        }
        self.assertIs(validate_task_envelope(task), task)

    def test_task_rejects_negative_budget_and_invalid_timestamp(self):
        task = {
            "schema_version": 1, "task_id": "task-1", "entity_id": "entity-1",
            "action": "memory.write", "input": {},
            "idempotency_key": "request-1", "created_at": "not-a-date",
            "deadline": "2026-11-15T12:05:00Z", "resource_budget": {"max_steps": -1},
            "policy_version": "policy-1"
        }
        with self.assertRaises(ContractError):
            validate_task_envelope(task)

    def test_valid_event_record(self):
        event = {
            "schema_version": 1, "event_id": "event-1", "event_type": "entity.created",
            "actor_id": "human-1", "entity_id": "entity-1",
            "occurred_at": "2026-11-15T12:00:00Z", "payload": {"kind": "application"}
        }
        self.assertIs(validate_event_record(event), event)

if __name__ == "__main__":
    unittest.main()
