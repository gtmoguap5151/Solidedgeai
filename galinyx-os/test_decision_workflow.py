import unittest
from datetime import datetime, timedelta, timezone

from authority_store import AuthorityStore
from decision_workflow import DecisionWorkflowService
from governed_execution import GovernedMockExecutor
from governed_org_simulation import GovernedOrganizationSimulator
from org_registry import GalinyxOrganizationRegistry
from org_simulation import HUMAN_OWNER, ORG_ID, galinyx_ventures_org
from runtime import Runtime


class TestAuthenticator:
    def __init__(self, credentials):
        self.credentials = credentials

    def authenticate(self, credential):
        if credential not in self.credentials:
            raise ValueError("invalid credential")
        return self.credentials[credential]


class DecisionWorkflowTests(unittest.TestCase):
    def setUp(self):
        self.runtime = Runtime()
        self.runtime.register_human(HUMAN_OWNER)
        self.runtime.create_personal_workspace(ORG_ID, HUMAN_OWNER)
        self.store = AuthorityStore(self.runtime.db)
        self.agent_ids = {}
        for actor_id in ("exec-ceo", "exec-governance"):
            agent_id = self.runtime.create_owned_entity(
                HUMAN_OWNER, ORG_ID, "GALINYX " + actor_id, "agent", []
            )
            self.store.bind_agent(
                agent_id, ORG_ID, HUMAN_OWNER, "decision-workflow://" + actor_id
            )
            self.agent_ids[actor_id] = agent_id
        org = galinyx_ventures_org()
        roles = [{
            "actor_id": HUMAN_OWNER, "role": "human_owner",
            "title": "Founder / Human Root", "reports_to": None, "division": None,
        }] + org["executives"]
        self.registry = GalinyxOrganizationRegistry(self.store)
        self.registry.register(
            org_id=ORG_ID, tenant_id=ORG_ID, owner_principal_id=HUMAN_OWNER,
            name=org["name"], roles=roles, actor_agent_bindings=self.agent_ids,
        )
        self.proposer_grant = self.store.issue_root_grant(
            HUMAN_OWNER, self.agent_ids["exec-ceo"],
            actions={"strategy.propose"}, resources={"policy-set"},
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
            budget_limit_units=20, budget_unit="TASK",
        )
        self.target_grant = self.store.issue_root_grant(
            HUMAN_OWNER, self.agent_ids["exec-governance"],
            actions={"policy.activate"}, resources={"policy-set"},
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
            budget_limit_units=20, budget_unit="TASK",
            approval_required={"policy.activate"},
        )
        self.human_auth = TestAuthenticator({"owner-token": HUMAN_OWNER})
        self.workload_auth = TestAuthenticator({
            "governance-token": self.agent_ids["exec-governance"]
        })
        self.approval_issuer = GovernedMockExecutor(
            self.store, self.human_auth, self.workload_auth, {}
        )
        self.simulator = GovernedOrganizationSimulator(self.store)
        self.workflow = DecisionWorkflowService(
            self.store, self.registry, self.simulator
        )

    def tearDown(self):
        self.runtime.close()

    def propose(self, request_id="policy-change-001"):
        return self.workflow.propose(
            proposer_actor_id="exec-ceo",
            executor_actor_id="exec-governance",
            request_id=request_id,
            action="policy.activate",
            resource_id="policy-set",
            proposer_grant_id=self.proposer_grant,
            target_grant_id=self.target_grant,
        )

    def test_proposal_requires_registered_ceo_and_scoped_proposer_grant(self):
        proposal = self.propose()
        self.assertEqual(proposal["state"], "proposed")
        self.assertEqual(proposal["proposer_actor_id"], "exec-ceo")
        self.assertEqual(proposal["executor_actor_id"], "exec-governance")
        self.assertTrue(self.store.verify_audit_chain()[0])

    def test_non_ceo_cannot_submit_executive_proposal(self):
        with self.assertRaises(PermissionError):
            self.workflow.propose(
                proposer_actor_id="exec-governance",
                executor_actor_id="exec-governance",
                request_id="bad-proposal",
                action="policy.activate",
                resource_id="policy-set",
                proposer_grant_id=self.proposer_grant,
                target_grant_id=self.target_grant,
            )

    def test_proposal_cannot_be_executed_before_owner_approval(self):
        proposal = self.propose()
        with self.assertRaisesRegex(PermissionError, "owner-approved"):
            self.workflow.execute_approved(proposal["proposal_id"])

    def test_owner_approval_is_exact_and_then_executes_through_receipt(self):
        proposal = self.propose()
        approval = self.approval_issuer.approve(
            "owner-token", self.target_grant, "policy-change-001",
            "policy.activate", "policy-set",
        )
        approved = self.workflow.approve(
            proposal["proposal_id"], HUMAN_OWNER, approval
        )
        self.assertEqual(approved["state"], "approved")
        executed = self.workflow.execute_approved(proposal["proposal_id"])
        self.assertEqual(executed["proposal"]["state"], "executed")
        self.assertEqual(executed["execution"]["status"], "simulated")
        execution_id = executed["execution"]["execution_id"]
        receipt = self.simulator.receipts.get(execution_id, tenant_id=ORG_ID)
        self.assertEqual(receipt["state"], "succeeded")
        consumed = self.runtime.db.execute(
            "SELECT execution_id FROM ahaf_approval_consumptions WHERE approval_id=?",
            (approval,),
        ).fetchone()
        self.assertEqual(consumed[0], execution_id)
        self.assertTrue(self.store.verify_audit_chain()[0])

    def test_wrong_owner_cannot_approve(self):
        proposal = self.propose()
        approval = self.approval_issuer.approve(
            "owner-token", self.target_grant, "policy-change-001",
            "policy.activate", "policy-set",
        )
        with self.assertRaises(PermissionError):
            self.workflow.approve(proposal["proposal_id"], "someone-else", approval)

    def test_approval_for_different_action_or_request_is_rejected(self):
        proposal = self.propose()
        approval = self.approval_issuer.approve(
            "owner-token", self.target_grant, "different-request",
            "policy.activate", "policy-set",
        )
        with self.assertRaisesRegex(PermissionError, "does not match"):
            self.workflow.approve(proposal["proposal_id"], HUMAN_OWNER, approval)

    def test_owner_can_reject_and_rejected_proposal_cannot_execute(self):
        proposal = self.propose()
        rejected = self.workflow.reject(
            proposal["proposal_id"], HUMAN_OWNER, "Rejected during governance review"
        )
        self.assertEqual(rejected["state"], "rejected")
        with self.assertRaises(PermissionError):
            self.workflow.execute_approved(proposal["proposal_id"])

    def test_proposal_and_decision_events_are_append_only(self):
        proposal = self.propose()
        with self.assertRaises(Exception):
            self.runtime.db.execute(
                "UPDATE galinyx_decision_proposals SET action='grant.issue' WHERE proposal_id=?",
                (proposal["proposal_id"],),
            )
        with self.assertRaises(Exception):
            self.runtime.db.execute(
                "DELETE FROM galinyx_decision_events WHERE proposal_id=?",
                (proposal["proposal_id"],),
            )


if __name__ == "__main__":
    unittest.main()
