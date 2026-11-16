import sqlite3
import unittest
from datetime import datetime, timedelta, timezone

from authority_store import AuthorityStore
from execution_receipts import ExecutionReceiptService
from runtime import Runtime
from governed_execution import GovernedMockExecutor


class TestAuthenticator:
    def __init__(self, credentials):
        self.credentials = credentials

    def authenticate(self, credential):
        if credential not in self.credentials:
            raise ValueError("invalid credential")
        return self.credentials[credential]


class ExecutionReceiptTests(unittest.TestCase):
    def setUp(self):
        self.runtime = Runtime()
        self.runtime.register_human("owner-1")
        self.runtime.create_personal_workspace("tenant-1", "owner-1")
        self.agent_id = self.runtime.create_owned_entity(
            "owner-1", "tenant-1", "Receipt Test Agent", "agent", []
        )
        self.store = AuthorityStore(self.runtime.db)
        self.store.bind_agent(
            self.agent_id, "tenant-1", "owner-1", "test-binding://receipt-agent"
        )
        self.service = ExecutionReceiptService(self.store)
        self.human_auth = TestAuthenticator({"owner-token": "owner-1"})
        self.workload_auth = TestAuthenticator({"agent-token": self.agent_id})
        self.action = GovernedMockExecutor.ACTION

    def tearDown(self):
        self.runtime.close()

    def issue_grant(self, *, approval_required=False, budget=10):
        return self.store.issue_root_grant(
            "owner-1", self.agent_id,
            actions={self.action},
            resources={"counter-1"},
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
            budget_limit_units=budget,
            budget_unit="TASK",
            approval_required={self.action} if approval_required else set(),
        )

    def approve(self, grant_id, request_id="request-1"):
        # Reuse the existing human-approval issuance path. Authentication here
        # is a deterministic test double, not a production credential provider.
        executor = GovernedMockExecutor(
            self.store, self.human_auth, self.workload_auth, {}
        )
        return executor.approve(
            "owner-token", grant_id, request_id, self.action, "counter-1"
        )

    def prepare(self, grant_id, request_id="request-1", **kwargs):
        return self.service.prepare(
            tenant_id="tenant-1",
            agent_id=self.agent_id,
            grant_id=grant_id,
            request_id=request_id,
            action=kwargs.get("action", self.action),
            resource_id=kwargs.get("resource_id", "counter-1"),
            approval_id=kwargs.get("approval_id"),
            amount_units=kwargs.get("amount_units", 1),
        )

    def test_prepare_creates_durable_receipt_and_budget_reservation(self):
        grant = self.issue_grant()
        result = self.prepare(grant)
        self.assertTrue(result["created"])
        self.assertEqual(result["state"], "reserved")
        receipt = self.service.get(result["execution_id"], tenant_id="tenant-1")
        self.assertEqual(receipt["grant_id"], grant)
        self.assertEqual(receipt["state"], "reserved")
        self.assertEqual(
            self.store._reservation_status(result["reservation_id"]), "reserved"
        )
        self.assertTrue(self.store.verify_audit_chain()[0])

    def test_exact_replay_returns_same_receipt_without_double_reserving(self):
        grant = self.issue_grant()
        first = self.prepare(grant)
        second = self.prepare(grant)
        self.assertEqual(first["execution_id"], second["execution_id"])
        self.assertFalse(second["created"])
        self.assertEqual(
            self.store.budget_summary(grant)["reserved_units"], 1
        )

    def test_request_id_reuse_with_changed_content_is_rejected(self):
        grant = self.issue_grant()
        self.prepare(grant)
        with self.assertRaisesRegex(ValueError, "different execution content"):
            self.prepare(grant, amount_units=2)
        self.assertEqual(
            self.store.budget_summary(grant)["reserved_units"], 1
        )

    def test_approval_is_consumed_atomically_with_receipt(self):
        grant = self.issue_grant(approval_required=True)
        approval = self.approve(grant)
        result = self.prepare(grant, approval_id=approval)
        row = self.runtime.db.execute(
            "SELECT execution_id FROM ahaf_approval_consumptions WHERE approval_id=?",
            (approval,),
        ).fetchone()
        self.assertEqual(row[0], result["execution_id"])
        self.assertEqual(
            self.runtime.db.execute(
                "SELECT COUNT(*) FROM ahaf_approval_consumptions WHERE approval_id=?",
                (approval,),
            ).fetchone()[0],
            1,
        )

    def test_required_approval_cannot_be_omitted(self):
        grant = self.issue_grant(approval_required=True)
        with self.assertRaisesRegex(PermissionError, "approval is required"):
            self.prepare(grant)

    def test_approval_and_receipt_roll_back_together_on_budget_failure(self):
        grant = self.issue_grant(approval_required=True, budget=0)
        approval = self.approve(grant)
        with self.assertRaisesRegex(PermissionError, "budget exceeded"):
            self.prepare(grant, approval_id=approval)
        self.assertIsNone(self.runtime.db.execute(
            "SELECT 1 FROM ahaf_approval_consumptions WHERE approval_id=?",
            (approval,),
        ).fetchone())
        self.assertIsNone(self.runtime.db.execute(
            "SELECT 1 FROM ahaf_execution_receipts WHERE grant_id=?",
            (grant,),
        ).fetchone())

    def test_receipt_reads_are_tenant_scoped(self):
        grant = self.issue_grant()
        result = self.prepare(grant)
        with self.assertRaises(KeyError):
            self.service.get(result["execution_id"], tenant_id="tenant-other")

    def test_receipt_identity_and_events_are_append_only(self):
        grant = self.issue_grant()
        result = self.prepare(grant)
        with self.assertRaises(sqlite3.IntegrityError):
            self.runtime.db.execute(
                "UPDATE ahaf_execution_receipts SET action='forged' WHERE execution_id=?",
                (result["execution_id"],),
            )
        with self.assertRaises(sqlite3.IntegrityError):
            self.runtime.db.execute(
                "DELETE FROM ahaf_execution_receipt_events WHERE execution_id=?",
                (result["execution_id"],),
            )


    def test_unknown_outcome_keeps_budget_held_until_owner_reconciles(self):
        grant = self.issue_grant()
        prepared = self.prepare(grant)
        execution_id = prepared["execution_id"]
        self.service.mark_dispatching(
            execution_id, tenant_id="tenant-1",
            adapter_id="test-adapter", adapter_version="0.1",
        )
        self.service.record_outcome(
            execution_id, tenant_id="tenant-1",
            outcome="outcome_unknown", reason="adapter response was lost",
        )
        self.assertEqual(
            self.store.budget_summary(grant)["reserved_units"], 1
        )
        self.service.begin_reconciliation(
            execution_id, tenant_id="tenant-1", reconciler_id="reconciler-1"
        )
        result = self.service.resolve_reconciliation(
            execution_id, tenant_id="tenant-1", owner_principal_id="owner-1",
            resolution="succeeded", evidence_ref="target://operation/123",
            evidence_digest="sha256:verified-test-evidence",
        )
        self.assertEqual(result["state"], "reconciled_succeeded")
        summary = self.store.budget_summary(grant)
        self.assertEqual(summary["reserved_units"], 0)
        self.assertEqual(summary["committed_units"], 1)
        self.assertEqual(
            self.service.get(execution_id, tenant_id="tenant-1")["state"],
            "reconciled_succeeded",
        )
        self.assertTrue(self.store.verify_audit_chain()[0])

    def test_confirmed_no_effect_reconciliation_releases_reservation(self):
        grant = self.issue_grant()
        prepared = self.prepare(grant)
        execution_id = prepared["execution_id"]
        self.service.mark_dispatching(
            execution_id, tenant_id="tenant-1",
            adapter_id="test-adapter", adapter_version="0.1",
        )
        self.service.record_outcome(
            execution_id, tenant_id="tenant-1",
            outcome="outcome_unknown", reason="target lookup timed out",
        )
        self.service.begin_reconciliation(
            execution_id, tenant_id="tenant-1", reconciler_id="reconciler-1"
        )
        result = self.service.resolve_reconciliation(
            execution_id, tenant_id="tenant-1", owner_principal_id="owner-1",
            resolution="not_executed", evidence_ref="target://lookup/123",
            evidence_digest="sha256:no-effect-proof",
        )
        self.assertEqual(result["state"], "reconciled_not_executed")
        summary = self.store.budget_summary(grant)
        self.assertEqual(summary["reserved_units"], 0)
        self.assertEqual(summary["committed_units"], 0)
        self.assertEqual(summary["remaining_units"], 10)

    def test_manual_review_keeps_reservation_held(self):
        grant = self.issue_grant()
        prepared = self.prepare(grant)
        execution_id = prepared["execution_id"]
        self.service.mark_dispatching(
            execution_id, tenant_id="tenant-1",
            adapter_id="test-adapter", adapter_version="0.1",
        )
        self.service.record_outcome(
            execution_id, tenant_id="tenant-1",
            outcome="outcome_unknown", reason="target state is ambiguous",
        )
        self.service.begin_reconciliation(
            execution_id, tenant_id="tenant-1", reconciler_id="reconciler-1"
        )
        result = self.service.resolve_reconciliation(
            execution_id, tenant_id="tenant-1", owner_principal_id="owner-1",
            resolution="manual_review_required",
            reason="available target evidence conflicts",
        )
        self.assertEqual(result["state"], "manual_review_required")
        self.assertEqual(
            self.store.budget_summary(grant)["reserved_units"], 1
        )

    def test_only_active_workspace_owner_can_resolve_reconciliation(self):
        grant = self.issue_grant()
        prepared = self.prepare(grant)
        execution_id = prepared["execution_id"]
        self.service.mark_dispatching(
            execution_id, tenant_id="tenant-1",
            adapter_id="test-adapter", adapter_version="0.1",
        )
        self.service.record_outcome(
            execution_id, tenant_id="tenant-1",
            outcome="outcome_unknown", reason="unknown",
        )
        self.service.begin_reconciliation(
            execution_id, tenant_id="tenant-1", reconciler_id="reconciler-1"
        )
        with self.assertRaisesRegex(PermissionError, "tenant owner required"):
            self.service.resolve_reconciliation(
                execution_id, tenant_id="tenant-1",
                owner_principal_id="not-the-owner",
                resolution="not_executed", evidence_ref="target://lookup/123",
                evidence_digest="sha256:no-effect-proof",
            )
        self.assertEqual(
            self.store.budget_summary(grant)["reserved_units"], 1
        )

    def test_confirmed_adapter_outcomes_settle_budget(self):
        committed_grant = self.issue_grant()
        committed = self.prepare(committed_grant, "success-request")
        self.service.mark_dispatching(
            committed["execution_id"], tenant_id="tenant-1",
            adapter_id="test-adapter", adapter_version="0.1",
        )
        self.service.record_outcome(
            committed["execution_id"], tenant_id="tenant-1",
            outcome="succeeded", evidence_ref="target://operation/success",
            evidence_digest="sha256:success-proof",
        )
        self.assertEqual(
            self.store.budget_summary(committed_grant)["committed_units"], 1
        )

        released_grant = self.issue_grant()
        failed = self.prepare(released_grant, "failed-request")
        self.service.mark_dispatching(
            failed["execution_id"], tenant_id="tenant-1",
            adapter_id="test-adapter", adapter_version="0.1",
        )
        self.service.record_outcome(
            failed["execution_id"], tenant_id="tenant-1",
            outcome="failed_known", evidence_ref="target://operation/no-effect",
            evidence_digest="sha256:no-effect-proof",
        )
        self.assertEqual(
            self.store.budget_summary(released_grant)["reserved_units"], 0
        )
        self.assertEqual(
            self.store.budget_summary(released_grant)["committed_units"], 0
        )

    def test_grant_binding_is_checked_against_server_resolved_context(self):
        grant = self.issue_grant()
        with self.assertRaisesRegex(PermissionError, "must match persisted grant"):
            self.service.prepare(
                tenant_id="tenant-other", agent_id=self.agent_id,
                grant_id=grant, request_id="request-1",
                action=self.action, resource_id="counter-1",
            )


if __name__ == "__main__":
    unittest.main()
