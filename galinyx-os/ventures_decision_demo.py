"""Run: python galinyx-os/ventures_decision_demo.py

Demonstrates the full executive proposal -> human approval -> governed execution path.
All records are created in a disposable local SQLite runtime. No external actions occur.
"""
from datetime import datetime, timedelta, timezone

from authority_store import AuthorityStore
from decision_workflow import DecisionWorkflowService
from governed_execution import GovernedMockExecutor
from governed_org_simulation import GovernedOrganizationSimulator
from org_registry import GalinyxOrganizationRegistry
from org_simulation import HUMAN_OWNER, ORG_ID, galinyx_ventures_org
from runtime import Runtime


class DemoAuthenticator:
    def __init__(self, credentials):
        self.credentials = credentials

    def authenticate(self, credential):
        if credential not in self.credentials:
            raise ValueError("invalid demo credential")
        return self.credentials[credential]


def main():
    runtime = Runtime()
    try:
        runtime.register_human(HUMAN_OWNER)
        runtime.create_personal_workspace(ORG_ID, HUMAN_OWNER)
        store = AuthorityStore(runtime.db)
        agents = {}
        for actor_id in ("exec-ceo", "exec-governance"):
            agent_id = runtime.create_owned_entity(
                HUMAN_OWNER, ORG_ID, "GALINYX " + actor_id, "agent", []
            )
            store.bind_agent(
                agent_id, ORG_ID, HUMAN_OWNER, "decision-demo://" + actor_id
            )
            agents[actor_id] = agent_id

        org = galinyx_ventures_org()
        roles = [{
            "actor_id": HUMAN_OWNER, "role": "human_owner",
            "title": "Founder / Human Root", "reports_to": None, "division": None,
        }] + org["executives"]
        registry = GalinyxOrganizationRegistry(store)
        registry.register(
            org_id=ORG_ID, tenant_id=ORG_ID, owner_principal_id=HUMAN_OWNER,
            name=org["name"], roles=roles, actor_agent_bindings=agents,
        )

        expires = datetime.now(timezone.utc) + timedelta(hours=1)
        proposer_grant = store.issue_root_grant(
            HUMAN_OWNER, agents["exec-ceo"],
            actions={"strategy.propose"}, resources={"policy-set"},
            expires_at=expires, budget_limit_units=10, budget_unit="TASK",
        )
        target_grant = store.issue_root_grant(
            HUMAN_OWNER, agents["exec-governance"],
            actions={"policy.activate"}, resources={"policy-set"},
            expires_at=expires, budget_limit_units=10, budget_unit="TASK",
            approval_required={"policy.activate"},
        )

        human_auth = DemoAuthenticator({"owner-token": HUMAN_OWNER})
        workload_auth = DemoAuthenticator({
            "governance-token": agents["exec-governance"]
        })
        approval_issuer = GovernedMockExecutor(
            store, human_auth, workload_auth, {}
        )
        simulator = GovernedOrganizationSimulator(store)
        workflow = DecisionWorkflowService(store, registry, simulator)

        proposal = workflow.propose(
            proposer_actor_id="exec-ceo",
            executor_actor_id="exec-governance",
            request_id="demo-policy-revision-001",
            action="policy.activate",
            resource_id="policy-set",
            proposer_grant_id=proposer_grant,
            target_grant_id=target_grant,
        )
        print("Submitted proposal:", proposal["proposal_id"], proposal["state"])

        approval_id = approval_issuer.approve(
            "owner-token", target_grant, "demo-policy-revision-001",
            "policy.activate", "policy-set",
        )
        approved = workflow.approve(
            proposal["proposal_id"], HUMAN_OWNER, approval_id
        )
        print("Human owner decision:", approved["state"])

        outcome = workflow.execute_approved(proposal["proposal_id"])
        print("Execution outcome:", outcome["execution"])
        print("Final proposal state:", outcome["proposal"]["state"])
        print("Decision history:", outcome["proposal"]["events"])
        print("Audit chain verified:", store.verify_audit_chain())
        print("External actions available: no")
    finally:
        runtime.close()


if __name__ == "__main__":
    main()
