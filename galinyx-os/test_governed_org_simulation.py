import unittest
from datetime import datetime, timedelta, timezone

from authority_store import AuthorityStore
from governed_execution import GovernedMockExecutor
from governed_org_simulation import GovernedOrganizationSimulator
from org_registry import GalinyxOrganizationRegistry
from org_simulation import Actor, CEO, HUMAN_OWNER, ORG_ID, galinyx_ventures_org
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
        self.store = AuthorityStore(self.runtime.db)
        self.agent_ids = {}
        for actor_id in ("exec-ceo", "exec-product", "exec-governance"):
            agent_id = self.runtime.create_owned_entity(
                HUMAN_OWNER, ORG_ID, "GALINYX " + actor_id, "agent", []
            )
            self.store.bind_agent(
                agent_id, ORG_ID, HUMAN_OWNER, "simulation://" + actor_id
            )
            self.agent_ids[actor_id] = agent_id

        org = galinyx_ventures_org()
        roles = [{
            "actor_id": HUMAN_OWNER,
            "title": "Founder / Human Root",
            "reports_to": None,
            "division": None,
        }] + org["executives"]
        self.registry = GalinyxOrganizationRegistry(self.store)
        self.registry.register(
            org_id=ORG_ID,
            tenant_id=ORG_ID,
            owner_principal_id=HUMAN_OWNER,
            name=org["name"],
            roles=roles,
            actor_agent_bindings=self.agent_ids,
        )
        self.human_auth = TestAuthenticator({"owner-token": HUMAN_OWNER})
        self.workload_auth = TestAuthenticator({
            "ceo-token": self.agent_ids["exec-ceo"],
            "product-token": self.agent_ids["exec-product"],
            "governance-token": self.agent_ids["exec-governance"],
        })
        self.executor = GovernedMockExecutor(
            self.store, self.human_auth, self.workload_auth, {}
        )
        self.simulator = GovernedOrganizationSimulator(self.store)
        self.product = Actor("exec-product", "division_lead", "product-engineering")
        self.governance = Actor("exec-governance", "division_lead", "governance-risk")

    def tearDown(self):
        self.runtime.close()

    def grant(self, *, actions, approval_required=(), actor_id="exec-product"):
        return self.store.issue_root_grant(
            HUMAN_OWNER,
            self.agent_ids[actor_id],
            actions=set(actions),
            resources={"roadmap"},
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
            budget_limit_units=20,
            budget_unit="TASK",
            approval_required=set(approval_required),
        )

    def test_registry_persists_roles_and_actor_workload_bindings(self):
        org = self.registry.get(ORG_ID)
        self.assertEqual(org["root_principal_id"], HUMAN_OWNER)
        self.assertEqual(org["mode"], "simulation-only")
        self.assertEqual(len(org["roles"]), 6)
        self.assertEqual(org["actor_agent_bindings"], self.agent_ids)
        self.assertEqual(
            self.registry.agent_for_actor(ORG_ID, "exec-product"),
            self.agent_ids["exec-product"],
        )

    def test_registry_records_are_append_only(self):
        with self.assertRaises(Exception):
            self.runtime.db.execute(
                "UPDATE galinyx_org_roles SET title='Supreme AI' "
                "WHERE org_id=? AND actor_id='exec-ceo'",
                (ORG_ID,),
            )
        with self.assertRaises(Exception):
            self.runtime.db.execute(
                "DELETE FROM galinyx_organizations WHERE org_id=?", (ORG_ID,)
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
            actor_id="exec-governance",
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
        with self.assertRaisesRegex(PermissionError, "no active persisted organization workload binding"):
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
