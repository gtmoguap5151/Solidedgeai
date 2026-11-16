"""Run: python galinyx-os/ventures_governed_demo.py

Creates a disposable local GALINYX Ventures tenant, issues narrow grants,
and demonstrates both denied and approved receipt-backed simulated actions.
No network calls or real-world side effects occur.
"""
from datetime import datetime, timedelta, timezone

from authority_store import AuthorityStore
from governed_execution import GovernedMockExecutor
from governed_org_simulation import GovernedOrganizationSimulator
from org_registry import GalinyxOrganizationRegistry
from org_simulation import Actor, CEO, HUMAN_OWNER, ORG_ID, galinyx_ventures_org
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

        actors = {
            "exec-ceo": Actor(CEO, "ceo"),
            "exec-product": Actor("exec-product", "division_lead", "product-engineering"),
            "exec-governance": Actor("exec-governance", "division_lead", "governance-risk"),
        }
        agents = {}
        for actor_id in actors:
            agent_id = runtime.create_owned_entity(
                HUMAN_OWNER, ORG_ID, actor_id, "agent", []
            )
            store.bind_agent(
                agent_id, ORG_ID, HUMAN_OWNER, "simulation://" + actor_id
            )
            agents[actor_id] = agent_id

        def grant(actor_id, actions, approval_required=()):
            return store.issue_root_grant(
                HUMAN_OWNER, agents[actor_id],
                actions=set(actions), resources={"strategy-roadmap", "policy-set"},
                expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
                budget_limit_units=10, budget_unit="TASK",
                approval_required=set(approval_required),
            )

        product_grant = grant("exec-product", {"product.plan"})
        governance_grant = grant(
            "exec-governance", {"policy.activate"}, {"policy.activate"}
        )

        org = galinyx_ventures_org()
        roles = [{
            "actor_id": HUMAN_OWNER,
            "role": "human_owner",
            "title": "Founder / Human Root",
            "reports_to": None,
            "division": None,
        }] + org["executives"]
        GalinyxOrganizationRegistry(store).register(
            org_id=ORG_ID,
            tenant_id=ORG_ID,
            owner_principal_id=HUMAN_OWNER,
            name=org["name"],
            roles=roles,
            actor_agent_bindings=agents,
        )

        human_auth = DemoAuthenticator({"owner-token": HUMAN_OWNER})
        workload_auth = DemoAuthenticator({
            "ceo-token": agents["exec-ceo"],
            "product-token": agents["exec-product"],
            "governance-token": agents["exec-governance"],
        })
        approval_issuer = GovernedMockExecutor(
            store, human_auth, workload_auth, {}
        )
        simulator = GovernedOrganizationSimulator(store)

        print("GALINYX Ventures — simulation-only governed workflow")
        print("Product planning:", simulator.execute(
            actors["exec-product"], "product.plan", "strategy-roadmap",
            "demo-product-plan", product_grant,
        ))
        print("CEO proposal without matching grant:", simulator.execute(
            actors["exec-ceo"], "strategy.propose", "strategy-roadmap",
            "demo-ceo-proposal", product_grant,
        ))
        print("Policy activation without approval:", simulator.execute(
            actors["exec-governance"], "policy.activate", "policy-set",
            "demo-policy-no-approval", governance_grant,
        ))
        approval_id = approval_issuer.approve(
            "owner-token", governance_grant, "demo-policy-approved",
            "policy.activate", "policy-set",
        )
        print("Policy activation with owner approval:", simulator.execute(
            actors["exec-governance"], "policy.activate", "policy-set",
            "demo-policy-approved", governance_grant, approval_id=approval_id,
        ))
        print("Audit chain verified:", store.verify_audit_chain())
        print("External actions available: no")
    finally:
        runtime.close()


if __name__ == "__main__":
    main()
