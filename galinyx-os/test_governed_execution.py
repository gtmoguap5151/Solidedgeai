import unittest
from datetime import datetime, timedelta, timezone

from authority_store import AuthorityStore
from governed_execution import GovernedMockExecutor
from runtime import Runtime


class TestAuthenticator:
    def __init__(self, credentials):
        self.credentials = credentials

    def authenticate(self, credential):
        if credential not in self.credentials:
            raise ValueError("invalid credential")
        return self.credentials[credential]


class TestWorkloadAuthenticator(TestAuthenticator):
    """Deterministic test double; not a production credential provider."""


class GovernedExecutionTests(unittest.TestCase):
    def setUp(self):
        self.runtime = Runtime()
        self.runtime.register_human("owner-1")
        self.runtime.register_human("viewer-1")
        self.runtime.create_personal_workspace("tenant-1", "owner-1")
        self.agent_id = self.runtime.create_owned_entity(
            "owner-1", "tenant-1", "Mock Operator", "agent", []
        )
        self.store = AuthorityStore(self.runtime.db)
        self.store.bind_agent(
            self.agent_id, "tenant-1", "owner-1", "test-binding://operator-1"
        )
        self.auth = TestAuthenticator({
            "owner-token": "owner-1",
            "viewer-token": "viewer-1",
        })
        self.workload_auth = TestWorkloadAuthenticator({
            "agent-token": self.agent_id,
            "other-agent-token": "different-agent",
        })
        self.resources = {("tenant-1", "counter-1"): 0}
        self.executor = GovernedMockExecutor(
            self.store, self.auth, self.workload_auth, self.resources
        )
        self.action = GovernedMockExecutor.ACTION

    def tearDown(self):
        self.runtime.close()

    def issue_grant(self, *, approval_required=False, seconds=3600, budget=10):
        return self.store.issue_root_grant(
            "owner-1", self.agent_id,
            actions={self.action},
            resources={"counter-1"},
            expires_at=datetime.now(timezone.utc) + timedelta(seconds=seconds),
            budget_limit_units=budget,
            budget_unit="TASK",
            approval_required={self.action} if approval_required else set(),
        )

    def execute(self, grant_id, request_id="request-1", **kwargs):
        return self.executor.execute(
            agent_credential=kwargs.get("agent_credential", "agent-token"),
            grant_id=grant_id,
            request_id=request_id,
            action=kwargs.get("action", self.action),
            resource_id=kwargs.get("resource_id", "counter-1"),
            approval_id=kwargs.get("approval_id"),
        )

    def test_scoped_grant_allows_mock_action_and_records_audit(self):
        grant = self.issue_grant()
        result = self.execute(grant)
        self.assertEqual(result, {"status": "completed", "value": 1})
        valid, bad_event = self.store.verify_audit_chain()
        self.assertTrue(valid)
        self.assertIsNone(bad_event)
        event = self.runtime.db.execute(
            "SELECT decision FROM ahaf_audit_events WHERE request_id=? "
            "AND decision='mock_execution_completed'",
            ("request-1",),
        ).fetchone()
        self.assertIsNotNone(event)

    def test_request_outside_action_scope_is_denied(self):
        grant = self.issue_grant()
        with self.assertRaises(PermissionError):
            self.execute(grant, action="mock.counter.delete")
        self.assertEqual(self.resources[("tenant-1", "counter-1")], 0)

    def test_request_outside_resource_scope_is_denied(self):
        grant = self.issue_grant()
        with self.assertRaises(PermissionError):
            self.execute(grant, resource_id="counter-2")
        self.assertEqual(self.resources[("tenant-1", "counter-1")], 0)

    def test_authenticated_workload_must_match_grant_subject(self):
        grant = self.issue_grant()
        with self.assertRaises(PermissionError):
            self.execute(grant, agent_credential="other-agent-token")
        self.assertEqual(self.resources[("tenant-1", "counter-1")], 0)

    def test_invalid_workload_credential_is_denied_before_side_effect(self):
        grant = self.issue_grant()
        with self.assertRaises(PermissionError):
            self.execute(grant, agent_credential="forged-token")
        self.assertEqual(self.resources[("tenant-1", "counter-1")], 0)

    def test_executor_does_not_accept_caller_asserted_agent_or_tenant_ids(self):
        grant = self.issue_grant()
        with self.assertRaises(TypeError):
            self.executor.execute(
                tenant_id="tenant-1", agent_id=self.agent_id,
                agent_credential="agent-token", grant_id=grant,
                request_id="request-1", action=self.action, resource_id="counter-1"
            )
        self.assertEqual(self.resources[("tenant-1", "counter-1")], 0)

    def test_required_human_approval_is_enforced_and_action_bound(self):
        grant = self.issue_grant(approval_required=True)
        with self.assertRaises(PermissionError):
            self.execute(grant)
        approval = self.executor.approve(
            "owner-token", grant, "request-1", self.action, "counter-1"
        )
        with self.assertRaises(PermissionError):
            self.execute(grant, request_id="different-request", approval_id=approval)
        result = self.execute(grant, approval_id=approval)
        self.assertEqual(result, {"status": "completed", "value": 1})

    def test_only_authenticated_bound_owner_can_approve(self):
        grant = self.issue_grant(approval_required=True)
        with self.assertRaises(PermissionError):
            self.executor.approve(
                "viewer-token", grant, "request-1", self.action, "counter-1"
            )
        with self.assertRaises(PermissionError):
            self.executor.approve(
                "invalid-token", grant, "request-1", self.action, "counter-1"
            )

    def test_approval_cannot_be_reused_for_another_request(self):
        grant = self.issue_grant(approval_required=True)
        approval = self.executor.approve(
            "owner-token", grant, "request-1", self.action, "counter-1"
        )
        with self.assertRaises(PermissionError):
            self.execute(grant, request_id="request-2", approval_id=approval)

    def test_expired_grant_is_denied(self):
        grant = self.issue_grant(seconds=1)
        import time
        time.sleep(1.05)
        with self.assertRaises(PermissionError):
            self.execute(grant)
        self.assertEqual(self.resources[("tenant-1", "counter-1")], 0)

    def test_revoked_grant_is_denied(self):
        grant = self.issue_grant()
        self.assertTrue(self.store.revoke_grant("owner-1", grant, "test revocation"))
        with self.assertRaises(PermissionError):
            self.execute(grant)
        self.assertEqual(self.resources[("tenant-1", "counter-1")], 0)

    def test_committed_request_is_idempotent(self):
        grant = self.issue_grant()
        first = self.execute(grant, "same-request")
        second = self.execute(grant, "same-request")
        self.assertEqual(first["status"], "completed")
        self.assertEqual(second["status"], "already_executed")
        self.assertEqual(self.resources[("tenant-1", "counter-1")], 1)

    def test_budget_exhaustion_denies_new_request(self):
        grant = self.issue_grant(budget=1)
        self.execute(grant, "first")
        with self.assertRaises(PermissionError):
            self.execute(grant, "second")
        self.assertEqual(self.resources[("tenant-1", "counter-1")], 1)


if __name__ == "__main__":
    unittest.main()
