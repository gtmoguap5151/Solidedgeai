"""Receipt-backed GALINYX Ventures policy simulation.

Accepted simulated actions use the durable AHAF execution-receipt ledger.
Denied attempts are recorded in the append-only AHAF audit chain.
No external adapter is invoked; the only adapter identity is explicitly synthetic.
"""
import hashlib
import json

from execution_receipts import ExecutionReceiptService
from org_simulation import ORG_ID, authorize
from org_registry import GalinyxOrganizationRegistry


class GovernedOrganizationSimulator:
    """Bridge org-level authority decisions to durable receipts and audit events."""

    ADAPTER_ID = "galinyx-ventures-simulation-only"
    ADAPTER_VERSION = "0.1"

    def __init__(self, authority_store, organization_id=ORG_ID):
        if authority_store is None:
            raise ValueError("authority_store is required")
        self.store = authority_store
        self.db = authority_store.db
        self.receipts = ExecutionReceiptService(authority_store)
        self.registry = GalinyxOrganizationRegistry(authority_store)
        self.organization_id = organization_id

    def _binding(self, actor_id):
        organization = self.registry.get(self.organization_id)
        agent_id = self.registry.agent_for_actor(self.organization_id, actor_id)
        row = self.db.execute(
            "SELECT tenant_id,owner_principal_id FROM ahaf_agent_bindings WHERE agent_id=?",
            (agent_id,),
        ).fetchone()
        if row is None or row[0] != organization["tenant_id"]:
            raise PermissionError("actor workload is not bound to this organization")
        return agent_id, row[0], row[1]

    def _record_denial(self, actor, agent_id, action, resource_id, decision):
        self.store._begin()
        try:
            self.store._append_audit(
                actor_type="agent",
                actor_id=actor.actor_id,
                agent_id=agent_id,
                tenant_id=self.organization_id,
                policy_version="galinyx-ventures-policy-1",
                action=action,
                resource_id=resource_id,
                decision=decision.code,
                payload={
                    "organization_id": ORG_ID,
                    "mode": "simulation-only",
                    "reason": decision.reason,
                    "side_effect": "none",
                },
            )
            self.store._finish()
        except Exception as exc:
            self.store._finish(exc)
            raise

    def execute(self, actor, action, resource_id, request_id, grant_id,
                *, approval_id=None, amount_units=1, tenant_id=ORG_ID, resource_division=None):
        """Authorize, persist, and complete one harmless simulated operation.

        A real approval ID is required for policy paths that require approval;
        the receipt service independently validates and consumes it.
        """
        if tenant_id != self.organization_id:
            decision = authorize(actor, action, tenant_id=tenant_id)
            self._record_denial(actor, None, action, resource_id, decision)
            return {"status": "denied", "decision": decision.code, "side_effect": "none"}

        agent_id, persisted_tenant, owner_id = self._binding(actor.actor_id)
        decision = authorize(
            actor, action,
            resource_division=resource_division,
            human_approval=approval_id is not None,
            tenant_id=persisted_tenant,
        )
        if not decision.allowed:
            self._record_denial(actor, agent_id, action, resource_id, decision)
            return {
                "status": "denied",
                "decision": decision.code,
                "reason": decision.reason,
                "side_effect": "none",
            }

        try:
            prepared = self.receipts.prepare(
                tenant_id=persisted_tenant,
                agent_id=agent_id,
                grant_id=grant_id,
                request_id=request_id,
                action=action,
                resource_id=resource_id,
                approval_id=approval_id,
                amount_units=amount_units,
            )
        except PermissionError as exc:
            denied = type("DeniedDecision", (), {
                "code": "persisted_grant_denied",
                "reason": str(exc),
            })()
            self._record_denial(actor, agent_id, action, resource_id, denied)
            return {
                "status": "denied",
                "decision": denied.code,
                "reason": denied.reason,
                "side_effect": "none",
            }
        if not prepared["created"]:
            state = prepared["state"]
            if state in {"succeeded", "reconciled_succeeded"}:
                return {
                    "status": "already_simulated",
                    "execution_id": prepared["execution_id"],
                    "state": state,
                    "side_effect": "none",
                }
            raise PermissionError("existing execution receipt is not safely replayable")

        execution_id = prepared["execution_id"]
        self.receipts.mark_dispatching(
            execution_id,
            tenant_id=persisted_tenant,
            adapter_id=self.ADAPTER_ID,
            adapter_version=self.ADAPTER_VERSION,
        )
        evidence = {
            "organization_id": ORG_ID,
            "execution_id": execution_id,
            "actor_id": actor.actor_id,
            "action": action,
            "resource_id": resource_id,
            "simulation_only": True,
            "side_effect": "none",
        }
        evidence_digest = "sha256:" + hashlib.sha256(
            json.dumps(evidence, sort_keys=True, separators=(",", ":")).encode("utf-8")
        ).hexdigest()
        self.receipts.record_outcome(
            execution_id,
            tenant_id=persisted_tenant,
            outcome="succeeded",
            evidence_ref="galinyx-simulation://receipts/" + execution_id,
            evidence_digest=evidence_digest,
        )
        receipt = self.receipts.get(execution_id, tenant_id=persisted_tenant)
        return {
            "status": "simulated",
            "execution_id": execution_id,
            "state": receipt["state"],
            "decision": decision.code,
            "adapter": self.ADAPTER_ID,
            "side_effect": "none",
        }
