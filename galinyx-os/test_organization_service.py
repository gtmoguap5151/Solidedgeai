import unittest
from datetime import datetime, timedelta, timezone

from authority_store import AuthorityStore
from decision_workflow import DecisionWorkflowService
from governed_execution import GovernedMockExecutor
from governed_org_simulation import GovernedOrganizationSimulator
from org_registry import GalinyxOrganizationRegistry
from org_simulation import HUMAN_OWNER, ORG_ID, galinyx_ventures_org
from organization_service import AuthenticatedOrganizationService
from runtime import Runtime


class TestAuthenticator:
    def __init__(self, credentials):
        self.credentials = credentials

    def authenticate(self, credential):
        if credential not in self.credentials:
            raise ValueError("invalid credential")
        return self.credentials[credential]


class AuthenticatedOrganizationServiceTests(unittest.TestCase):
    def setUp(self):
        self.runtime = Runtime()
        self.runtime.register_human(HUMAN_OWNER)
        self.runtime.create_personal_workspace(ORG_ID, HUMAN_OWNER)
        self.store = AuthorityStore(self.runtime.db)
        self.agents = {}
        for actor_id in ("exec-ceo", "exec-governance"):
            agent_id = self.runtime.create_owned_entity(
                HUMAN_OWNER, ORG_ID, "GALINYX " + actor_id, "agent", []
            )
            self.store.bind_agent(
                agent_id, ORG_ID, HUMAN_OWNER, "org-service://" + actor_id
            )
            self.agents[actor_id] = agent_id

        org = galinyx_ventures_org()
        roles = [{
            "actor_id": HUMAN_OWNER, "role": "human_owner",
            "title": "Founder / Human Root", "reports_to": None, "division": None,
        }] + org["executives"]
        self.registry = GalinyxOrganizationRegistry(self.store)
        self.registry.register(
            org_id=ORG_ID, tenant_id=ORG_ID, owner_principal_id=HUMAN_OWNER,
            name=org["name"], roles=roles, actor_agent_bindings=self.agents,
        )
        expires = datetime.now(timezone.utc) + timedelta(hours=1)
        self.proposer_grant = self.store.issue_root_grant(
            HUMAN_OWNER, self.agents["exec-ceo"],
            actions={"strategy.propose"}, resources={"policy-set"},
            expires_at=expires, budget_limit_units=10, budget_unit="TASK",
        )
        self.target_grant = self.store.issue_root_grant(
            HUMAN_OWNER, self.agents["exec-governance"],
            actions={"policy.activate"}, resources={"policy-set"},
            expires_at=expires, budget_limit_units=10, budget_unit="TASK",
            approval_required={"policy.activate"},
        )
        self.human_auth = TestAuthenticator({"owner-token": HUMAN_OWNER})
        self.workload_auth = TestAuthenticator({
            "ceo-token": self.agents["exec-ceo"],
            "governance-token": self.agents["exec-governance"],
        })
        self.approval_issuer = GovernedMockExecutor(
            self.store, self.human_auth, self.workload_auth, {}
        )
        self.simulator = GovernedOrganizationSimulator(self.store)
        self.workflow = DecisionWorkflowService(
            self.store, self.registry, self.simulator
        )
        self.service = AuthenticatedOrganizationService(
            self.workflow, self.registry, self.human_auth,
            self.workload_auth, self.approval_issuer, ORG_ID,
        )

    def tearDown(self):
        self.runtime.close()

    def propose(self):
        return self.service.propose(
            "ceo-token",
            executor_actor_id="exec-governance",
            request_id="service-policy-001",
            action="policy.activate",
            resource_id="policy-set",
            proposer_grant_id=self.proposer_grant,
            target_grant_id=self.target_grant,
        )

    def test_service_derives_proposer_identity_from_workload_credential(self):
        proposal = self.propose()
        self.assertEqual(proposal["proposer_actor_id"], "exec-ceo")
        with self.assertRaises(PermissionError):
            self.service.propose(
                "invalid-token",
                executor_actor_id="exec-governance",
                request_id="service-policy-bad",
                action="policy.activate",
                resource_id="policy-set",
                proposer_grant_id=self.proposer_grant,
                target_grant_id=self.target_grant,
            )

    def test_service_issues_exact_owner_approval_and_executes_as_designated_agent(self):
        proposal = self.propose()
        approved = self.service.approve_proposal(
            "owner-token", proposal["proposal_id"]
        )
        self.assertEqual(approved["state"], "approved")
        outcome = self.service.execute_approved(
            "governance-token", proposal["proposal_id"]
        )
        self.assertEqual(outcome["proposal"]["state"], "executed")
        self.assertEqual(outcome["execution"]["status"], "simulated")

    def test_non_designated_workload_cannot_execute_approved_proposal(self):
        proposal = self.propose()
        self.service.approve_proposal("owner-token", proposal["proposal_id"])
        with self.assertRaisesRegex(PermissionError, "not the designated"):
            self.service.execute_approved("ceo-token", proposal["proposal_id"])

    def test_only_authenticated_human_root_can_approve_or_read(self):
        proposal = self.propose()
        with self.assertRaises(PermissionError):
            self.service.approve_proposal("invalid-human-token", proposal["proposal_id"])
        with self.assertRaises(PermissionError):
            self.service.get_proposal("invalid-human-token", proposal["proposal_id"])

    def test_rejection_is_available_to_authenticated_human_root(self):
        proposal = self.propose()
        rejected = self.service.reject_proposal(
            "owner-token", proposal["proposal_id"], "Not approved"
        )
        self.assertEqual(rejected["state"], "rejected")


if __name__ == "__main__":
    unittest.main()
