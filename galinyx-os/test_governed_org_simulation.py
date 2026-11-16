import unittest
from datetime import datetime, timedelta, timezone

from authority_store import AuthorityStore
from governed_execution import GovernedMockExecutor
from governed_org_simulation import GovernedOrganizationSimulator
from org_simulation import Actor, CEO, HUMAN_OWNER, ORG_ID
from runtime import Runtime


class TestAuthenticator:
    def __init__(self, credentials):
        self.credentials = credentials

    def authenticate(self, credential):
        if credential not in self.credentials:
            raise ValueError("invalid credential")
        return self.credentials[credential]


class GovernedOrganizationSimulationTests(unittest.TestCase):
    def setUp(self):
        self.runtime = Runtime()
        self.runtime.register_human(HUMAN_OWNER)
        self.runtime.create_personal_workspace(ORG_ID, HUMAN_OWNER)
        self.agent_id = self.runtime.create_owned_entity(
            HUMAN_OWNER, ORG_ID, "GALINYX Product Executive", "agent", []
        )
        self.store = AuthorityStore(self.runtime.db)
        self.store.bind_agent(
            self.agent_id, ORG_ID, HUMAN_OWNER, "simulation://product-executive"
        )
        self.human_auth = TestAuthenticator({"owner-token": HUMAN_OWNER})
        self.workload_auth = TestAuthenticator({"product-token": self.agent_id})
        self.executor = GovernedMockExecutor(
            self.store, self.human_auth, self.workload_auth, {}
        )
        self.simulator = GovernedOrganizationSimulator(
            self.store, {"exec-product": self.agent_id, "exec-governance": self.agent_id, "exec-ceo": self.agent_id}
        )
        self.product = Actor("exec-product", "division_lead", "product-engineering")
        self.governance = Actor("exec-governance", "division_lead", "governance-risk")

    def tearDown(self):
        self.runtime.close()

    def grant(self, *, actions, approval_required=()):
        return self.store.issue_root_grant(
            HUMAN_OWNER,
            self.agent_id,
            actions=set(actions),
            resources={"roadmap"},
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
            budget_limit_units=20,
            budget_unit="TASK",
            approval_required=set(approval_required),
        )

    def test_approved_simulated_action_creates_completed_receipt(self):
        grant = self.grant(actions={"product.plan"})
        result = self.simulator.execute(
            self.product, "product.plan", "roadmap", "plan-001", grant
        )
        self.assertEqual(result["status"], "simulated")
        self.assertEqual(result["state"], "succeeded")
        self.assertEqual(result["side_effect"], "none")
        receipt = self.simulator.receipts.get(result["execution_id"], tenant_id=ORG_ID)
        self.assertEqual(receipt["action"], "product.plan")
        self.assertEqual(receipt["state"], "succeeded")
        self.assertTrue(self.store.verify_audit_chain()[0])

    def test_denied_action_is_audited_without_creating_receipt(self):
        grant = self.grant(actions={"product.plan"})
        before = self.runtime.db.execute(
            "SELECT COUNT(*) FROM ahaf_execution_receipts"
        ).fetchone()[0]
        result = self.simulator.execute(
            self.product, "funds.transfer", "roadmap", "deny-001", grant
        )
        after = self.runtime.db.execute(
            "SELECT COUNT(*) FROM ahaf_execution_receipts"
        ).fetchone()[0]
        self.assertEqual(result["status"], "denied")
        self.assertEqual(before, after)
        event = self.runtime.db.execute(
            "SELECT decision FROM ahaf_audit_events ORDER BY event_id DESC LIMIT 1"
        ).fetchone()
        self.assertEqual(event[0], "simulation_boundary_denied")
        self.assertTrue(self.store.verify_audit_chain()[0])

    def test_high_impact_policy_activation_requires_real_consumable_approval(self):
        grant = self.grant(
            actions={"policy.activate"},
            approval_required={"policy.activate"},
        )
        denied = self.simulator.execute(
            self.governance, "policy.activate", "roadmap", "policy-001", grant
        )
        self.assertEqual(denied["status"], "denied")
        approval = self.executor.approve(
            "owner-token", grant, "policy-002", "policy.activate", "roadmap"
        )
        result = self.simulator.execute(
            self.governance, "policy.activate", "roadmap", "policy-002", grant,
            approval_id=approval,
        )
        self.assertEqual(result["status"], "simulated")
        self.assertEqual(result["state"], "succeeded")
        consumed = self.runtime.db.execute(
            "SELECT execution_id FROM ahaf_approval_consumptions WHERE approval_id=?",
            (approval,),
        ).fetchone()
        self.assertEqual(consumed[0], result["execution_id"])

    def test_exact_replay_does_not_create_second_simulated_action(self):
        grant = self.grant(actions={"product.plan"})
        first = self.simulator.execute(
            self.product, "product.plan", "roadmap", "plan-replay", grant
        )
        second = self.simulator.execute(
            self.product, "product.plan", "roadmap", "plan-replay", grant
        )
        self.assertEqual(first["execution_id"], second["execution_id"])
        self.assertEqual(second["status"], "already_simulated")
        self.assertEqual(
            self.runtime.db.execute(
                "SELECT COUNT(*) FROM ahaf_execution_receipts WHERE grant_id=?",
                (grant,),
            ).fetchone()[0],
            1,
        )

    def test_unknown_actor_has_no_workload_binding(self):
        grant = self.grant(actions={"product.plan"})
        unknown = Actor("exec-unknown", "division_lead", "product-engineering")
        with self.assertRaisesRegex(PermissionError, "no persisted workload binding"):
            self.simulator.execute(
                unknown, "product.plan", "roadmap", "unknown-001", grant
            )

    def test_ceo_proposal_is_denied_if_grant_does_not_authorize_it(self):
        grant = self.grant(actions={"product.plan"})
        ceo = Actor(CEO, "ceo")
        result = self.simulator.execute(
            ceo, "strategy.propose", "roadmap", "ceo-001", grant
        )
        self.assertEqual(result["status"], "denied")
        self.assertEqual(result["decision"], "persisted_grant_denied")


if __name__ == "__main__":
    unittest.main()
