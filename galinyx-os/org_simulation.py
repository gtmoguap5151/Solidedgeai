"""Synthetic GALINYX Ventures org and authority model.

This is a local simulation fixture, not authentication or production authorization.
No external adapters or real-world side effects are available.
"""
from dataclasses import dataclass
from typing import Optional


ORG_ID = "galinyx-ventures"
HUMAN_OWNER = "human-founder"
CEO = "exec-ceo"

DIVISIONS = {
    "governance-risk": {"leader": "exec-governance", "actions": {"policy.propose", "risk.review", "audit.read"}},
    "product-engineering": {"leader": "exec-product", "actions": {"product.plan", "engineering.propose", "test.run"}},
    "operations": {"leader": "exec-operations", "actions": {"operations.plan", "workflow.simulate"}},
    "commercial-strategy": {"leader": "exec-commercial", "actions": {"market.research", "offer.propose", "pipeline.analyze"}},
}

HIGH_IMPACT = {"policy.activate", "grant.issue", "grant.revoke", "external.dispatch", "funds.transfer"}
FORBIDDEN_SIMULATION_ACTIONS = {"external.dispatch", "funds.transfer", "publish.live", "delete.production"}


@dataclass(frozen=True)
class Actor:
    actor_id: str
    role: str
    division: Optional[str] = None


@dataclass(frozen=True)
class Decision:
    allowed: bool
    code: str
    requires_human_approval: bool = False
    reason: str = ""


def galinyx_ventures_org():
    """Return the canonical synthetic org registry; ranks never imply permissions."""
    return {
        "org_id": ORG_ID,
        "name": "GALINYX Ventures",
        "mode": "simulation-only",
        "authority_model": "human-root / hybrid-enforcement",
        "root_authority": HUMAN_OWNER,
        "executives": [
            {"actor_id": CEO, "title": "Chief Executive Officer", "reports_to": HUMAN_OWNER},
            {"actor_id": "exec-governance", "title": "Governance & Risk", "reports_to": CEO, "division": "governance-risk"},
            {"actor_id": "exec-product", "title": "Product & Engineering", "reports_to": CEO, "division": "product-engineering"},
            {"actor_id": "exec-operations", "title": "Operations", "reports_to": CEO, "division": "operations"},
            {"actor_id": "exec-commercial", "title": "Commercial Strategy", "reports_to": CEO, "division": "commercial-strategy"},
        ],
        "principle": "organizational rank is descriptive; explicit scoped authority controls actions",
    }


def authorize(actor: Actor, action: str, *, resource_division: Optional[str] = None,
              human_approval: bool = False, tenant_id: str = ORG_ID) -> Decision:
    """Fail-closed policy decision for synthetic actors and simulated actions."""
    if tenant_id != ORG_ID:
        return Decision(False, "cross_tenant_denied", reason="Actor cannot cross organization boundary.")
    if action in FORBIDDEN_SIMULATION_ACTIONS:
        return Decision(False, "simulation_boundary_denied", reason="This environment has no live external-action capability.")
    if actor.actor_id == HUMAN_OWNER and actor.role == "human_owner":
        if action in HIGH_IMPACT:
            return Decision(True, "human_root_authorized", reason="Human root authority authorized the simulated decision.")
        return Decision(True, "human_root_authorized", reason="Human owner retains ultimate authority.")
    if actor.actor_id == CEO and actor.role == "ceo":
        if action in {"org.coordinate", "division.report", "strategy.propose", "budget.propose"}:
            return Decision(True, "ceo_scope_authorized", reason="CEO authority is limited to coordination and proposals.")
        if action in HIGH_IMPACT:
            return Decision(False, "human_root_required", requires_human_approval=True,
                            reason="Executive rank cannot override the human owner.")
        return Decision(False, "ceo_scope_denied", reason="Action is outside the CEO's delegated scope.")
    if actor.division not in DIVISIONS:
        return Decision(False, "unknown_division", reason="No recognized delegated division.")
    if resource_division and resource_division != actor.division:
        return Decision(False, "cross_division_denied", reason="Division authority cannot cross functional boundaries.")
    allowed_actions = DIVISIONS[actor.division]["actions"]
    if action not in allowed_actions:
        return Decision(False, "division_scope_denied", reason="Action is outside this division's explicit scope.")
    if action in HIGH_IMPACT and not human_approval:
        return Decision(False, "human_approval_required", requires_human_approval=True,
                        reason="High-impact actions require explicit human approval.")
    return Decision(True, "division_scope_authorized", reason="Action is within the division's simulation scope.")


def simulate_decision(actor: Actor, action: str, **kwargs):
    """Produce a deterministic simulated outcome; never invokes a real adapter."""
    decision = authorize(actor, action, **kwargs)
    return {
        "org_id": ORG_ID,
        "mode": "simulation-only",
        "actor_id": actor.actor_id,
        "action": action,
        "decision": decision.code,
        "allowed": decision.allowed,
        "requires_human_approval": decision.requires_human_approval,
        "side_effect": "none",
        "reason": decision.reason,
    }
