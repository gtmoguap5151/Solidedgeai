import sqlite3
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from pathlib import Path

from runtime import Runtime
from authority_store import AuthorityStore


class AuthorityStoreTests(unittest.TestCase):
    def setUp(self):
        self.runtime = Runtime()
        self.runtime.register_human("owner-1")
        self.runtime.create_personal_workspace("tenant-1", "owner-1")
        self.agent_id = self.runtime.create_owned_entity(
            "owner-1", "tenant-1", "Research Agent", "agent", ["memory.write"]
        )
        self.store = AuthorityStore(self.runtime.db)
        self.store.bind_agent(
            self.agent_id, "tenant-1", "owner-1", "kms://galinyx/agent-key-1"
        )
        self.grant_id = self.store.issue_root_grant(
            "owner-1", self.agent_id,
            actions={"research.read", "purchase.request"},
            resources={"project-1"},
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
            budget_limit_units=1000,
            budget_unit="USD_CENT",
            max_transaction_units=500,
            transaction_unit="USD_CENT",
            transaction_actions={"purchase.request"},
            approval_required={"purchase.request"},
            delegable_actions={"research.read"},
            delegation_depth=1,
        )

    def tearDown(self):
        self.runtime.close()

    def test_runtime_uses_schema_version_three(self):
        self.assertEqual(self.runtime.schema_version(), 3)

    def test_agent_binding_requires_existing_agent_and_workspace_owner(self):
        with self.assertRaises(PermissionError):
            self.store.bind_agent(
                self.agent_id, "tenant-1", "someone-else", "kms://other"
            )
        with self.assertRaises(ValueError):
            self.store.bind_agent(
                "missing-agent", "tenant-1", "owner-1", "kms://missing"
            )
        unowned = self.runtime.create("Unowned Agent", "agent", [])
        with self.assertRaises(PermissionError):
            self.store.bind_agent(
                unowned, "tenant-1", "owner-1", "kms://unowned"
            )

    def test_root_grant_requires_owner_governance(self):
        with self.assertRaises(PermissionError):
            self.store.issue_root_grant(
                "not-owner", self.agent_id, actions={"read"}, resources={"r"},
                expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
                budget_limit_units=10, budget_unit="TASK",
            )

    def test_grants_and_bindings_are_append_only(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.runtime.db.execute(
                "UPDATE ahaf_authority_grants SET budget_limit_units=999999 WHERE grant_id=?",
                (self.grant_id,),
            )
        with self.assertRaises(sqlite3.IntegrityError):
            self.runtime.db.execute(
                "DELETE FROM ahaf_agent_bindings WHERE agent_id=?", (self.agent_id,)
            )
        self.runtime.db.rollback()

    def test_revocation_is_append_only_and_disables_grant(self):
        self.assertTrue(self.store.grant_is_active(self.grant_id))
        self.assertTrue(self.store.revoke_grant("owner-1", self.grant_id, "policy change"))
        self.assertFalse(self.store.grant_is_active(self.grant_id))
        self.assertFalse(self.store.revoke_grant("owner-1", self.grant_id, "repeat"))
        with self.assertRaises(sqlite3.IntegrityError):
            self.runtime.db.execute(
                "DELETE FROM ahaf_grant_revocations WHERE grant_id=?", (self.grant_id,)
            )
        self.runtime.db.rollback()

    def test_budget_reservation_is_atomic_cumulative_and_idempotent(self):
        first = self.store.reserve_budget(self.grant_id, "request-1", 700, "USD_CENT")
        repeated = self.store.reserve_budget(self.grant_id, "request-1", 700, "USD_CENT")
        self.assertEqual(first["reservation_id"], repeated["reservation_id"])
        self.assertFalse(repeated["created"])
        with self.assertRaises(ValueError):
            self.store.reserve_budget(self.grant_id, "request-1", 701, "USD_CENT")
        with self.assertRaises(PermissionError):
            self.store.reserve_budget(self.grant_id, "request-2", 301, "USD_CENT")
        self.assertEqual(self.store.budget_summary(self.grant_id)["reserved_units"], 700)
        self.assertTrue(self.store.settle_reservation(first["reservation_id"], "release"))
        self.assertFalse(self.store.settle_reservation(first["reservation_id"], "release"))
        self.assertEqual(self.store.budget_summary(self.grant_id)["remaining_units"], 1000)

    def test_committed_spend_remains_consumed_and_cannot_be_released(self):
        reservation = self.store.reserve_budget(
            self.grant_id, "request-commit", 600, "USD_CENT"
        )
        self.assertTrue(self.store.settle_reservation(reservation["reservation_id"], "commit"))
        self.assertFalse(self.store.settle_reservation(reservation["reservation_id"], "commit"))
        with self.assertRaises(ValueError):
            self.store.settle_reservation(reservation["reservation_id"], "release")
        summary = self.store.budget_summary(self.grant_id)
        self.assertEqual(summary["committed_units"], 600)
        self.assertEqual(summary["reserved_units"], 0)
        self.assertEqual(summary["remaining_units"], 400)

    def test_wrong_budget_unit_and_expired_grant_are_denied(self):
        with self.assertRaises(ValueError):
            self.store.reserve_budget(self.grant_id, "wrong-unit", 1, "TASK")
        expired = self.store.issue_root_grant(
            "owner-1", self.agent_id, actions={"read"}, resources={"r"},
            expires_at=datetime.now(timezone.utc) + timedelta(seconds=1),
            budget_limit_units=10, budget_unit="TASK",
        )
        # Directly make the test grant expired; grants are immutable in normal operation.
        self.runtime.db.execute(
            "DROP TRIGGER ahaf_authority_grants_no_update"
        )
        self.runtime.db.execute(
            "UPDATE ahaf_authority_grants SET expires_at='2000-01-01T00:00:00+00:00' WHERE grant_id=?",
            (expired,),
        )
        self.runtime.db.commit()
        self.assertFalse(self.store.grant_is_active(expired))
        with self.assertRaises(PermissionError):
            self.store.reserve_budget(expired, "expired-request", 1, "TASK")

    def test_revoked_agent_binding_disables_new_grants_and_reservations(self):
        self.assertTrue(self.store.revoke_agent_binding("owner-1", self.agent_id, "credential rotated"))
        self.assertFalse(self.store.grant_is_active(self.grant_id))
        with self.assertRaises(PermissionError):
            self.store.reserve_budget(self.grant_id, "after-revocation", 1, "USD_CENT")
        with self.assertRaises(PermissionError):
            self.store.issue_root_grant(
                "owner-1", self.agent_id, actions={"read"}, resources={"r"},
                expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
                budget_limit_units=10, budget_unit="TASK",
            )

    def test_audit_hash_chain_verifies_and_detects_tampering(self):
        self.store.reserve_budget(self.grant_id, "audit-request", 5, "USD_CENT")
        valid, bad_event = self.store.verify_audit_chain()
        self.assertTrue(valid)
        self.assertIsNone(bad_event)
        self.runtime.db.execute("DROP TRIGGER ahaf_audit_events_no_update")
        self.runtime.db.execute(
            "UPDATE ahaf_audit_events SET payload_json='{}' WHERE event_id=1"
        )
        self.runtime.db.commit()
        valid, bad_event = self.store.verify_audit_chain()
        self.assertFalse(valid)
        self.assertEqual(bad_event, 1)

    def test_concurrent_reservations_cannot_overspend_across_connections(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "shared.db"
            setup = Runtime(path)
            setup.register_human("owner")
            setup.create_personal_workspace("tenant", "owner")
            agent = setup.create_owned_entity("owner", "tenant", "Agent", "agent", [])
            store = AuthorityStore(setup.db)
            store.bind_agent(agent, "tenant", "owner", "kms://shared/agent")
            grant = store.issue_root_grant(
                "owner", agent, actions={"run"}, resources={"resource"},
                expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
                budget_limit_units=10, budget_unit="TASK",
            )
            setup.close()

            def reserve(request_id):
                runtime = Runtime(path)
                try:
                    local_store = AuthorityStore(runtime.db)
                    try:
                        local_store.reserve_budget(grant, request_id, 7, "TASK")
                        return True
                    except PermissionError:
                        return False
                finally:
                    runtime.close()

            with ThreadPoolExecutor(max_workers=2) as pool:
                outcomes = list(pool.map(reserve, ["worker-a", "worker-b"]))
            self.assertEqual(sum(outcomes), 1)
            check = Runtime(path)
            try:
                self.assertEqual(AuthorityStore(check.db).budget_summary(grant)["consumed_units"], 7)
            finally:
                check.close()


if __name__ == "__main__":
    unittest.main()
