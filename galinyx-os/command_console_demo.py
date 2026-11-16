"""Run: python galinyx-os/command_console_demo.py

Prints a disposable, in-memory GALINYX Ventures governance dashboard.
Demo credentials and records are synthetic. No files, network calls, or
real-world side effects are created.
"""
from datetime import datetime, timedelta, timezone

from authority_store import AuthorityStore
from command_console import CommandConsole
from decision_workflow import DecisionWorkflowService
from governed_execution import GovernedMockExecutor
from governed_org_simulation import GovernedOrganizationSimulator
from org_registry import GalinyxOrganizationRegistry
from org_simulation import CEO, HUMAN_OWNER, ORG_ID, galinyx_ventures_org
from organization_service import AuthenticatedOrganizationService
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
        agent_ids = {}
        for actor_id in (CEO, "exec-governance"):
            agent_id = runtime.create_owned_entity(
                HUMAN_OWNER, ORG_ID, actor_id, "agent", []
            )
            store.bind_agent(
                agent_id, ORG_ID, HUMAN_OWNER, "console-demo://" + actor_id
            )
            agent_ids[actor_id] = agent_id

        org = galinyx_ventures_org()
        roles = [{
            "actor_id": HUMAN_OWNER, "role": "human_owner",
            "title": "Founder / Human Root", "reports_to": None, "division": None,
        }] + org["executives"]
        registry = GalinyxOrganizationRegistry(store)
        registry.register(
            org_id=ORG_ID, tenant_id=ORG_ID, owner_principal_id=HUMAN_OWNER,
            name=org["name"], roles=roles, actor_agent_bindings=agent_ids,
        )
        expiry = datetime.now(timezone.utc) + timedelta(hours=1)
        proposer_grant = store.issue_root_grant(
            HUMAN_OWNER, agent_ids[CEO], actions={"strategy.propose"},
            resources={"policy-set"}, expires_at=expiry,
            budget_limit_units=5, budget_unit="TASK",
        )
        target_grant = store.issue_root_grant(
            HUMAN_OWNER, agent_ids["exec-governance"],
            actions={"policy.activate"}, resources={"policy-set"},
            expires_at=expiry, budget_limit_units=5, budget_unit="TASK",
            approval_required={"policy.activate"},
        )
        human_auth = DemoAuthenticator({"demo-owner-token": HUMAN_OWNER})
        workload_auth = DemoAuthenticator({
            "demo-ceo-token": agent_ids[CEO],
            "demo-governance-token": agent_ids["exec-governance"],
        })
        approval_issuer = GovernedMockExecutor(
            store, human_auth, workload_auth, {}
        )
        simulator = GovernedOrganizationSimulator(store)
        workflow = DecisionWorkflowService(store, registry, simulator)
        service = AuthenticatedOrganizationService(
            workflow, registry, human_auth, workload_auth,
            approval_issuer, ORG_ID,
        )
        service.propose(
            "demo-ceo-token", executor_actor_id="exec-governance",
            request_id="command-console-demo-policy-001",
            action="policy.activate", resource_id="policy-set",
            proposer_grant_id=proposer_grant, target_grant_id=target_grant,
        )
        console = CommandConsole(service)
        snapshot = console.snapshot("demo-owner-token")
        print(CommandConsole.render(snapshot))
        print("Founder controls: not enabled in this read-only console.")
        print("Demo data: disposable in-memory simulation only.")
    finally:
        runtime.close()


if __name__ == "__main__":
    main()
