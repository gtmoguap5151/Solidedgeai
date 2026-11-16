"""Test-only governed mock execution slice for GALINYX.

This module connects persisted AHAF grants, authenticated human approvals, and
an injected workload-authentication adapter to a harmless in-memory mock
resource. The tests prove that the executor derives the agent identity from a
credential adapter rather than trusting a caller-supplied agent ID. The test
adapter is not production credential issuance, cryptographic verification, or
an enforcement boundary for external systems.
"""
import hashlib
import json
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from execution_receipts import ExecutionReceiptService


class GovernedMockExecutor:
    """Authorize a fixed mock action before changing an in-memory counter."""

    ACTION = "mock.counter.increment"

    def __init__(self, authority_store, human_authenticator, workload_authenticator, resources=None):
        if authority_store is None or human_authenticator is None or workload_authenticator is None:
            raise ValueError("authority_store, human_authenticator, and workload_authenticator are required")
        if not callable(getattr(human_authenticator, "authenticate", None)):
            raise TypeError("human_authenticator must provide authenticate(credential)")
        if not callable(getattr(workload_authenticator, "authenticate", None)):
            raise TypeError("workload_authenticator must provide authenticate(credential)")
        self.store = authority_store
        self.db = authority_store.db
        self.authenticator = human_authenticator
        self.workload_authenticator = workload_authenticator
        self.receipts = ExecutionReceiptService(authority_store)
        # Preserve the supplied mock mapping so tests and the executor observe the same resource state.
        self.resources = resources if resources is not None else {}

    def _human_principal(self, credential):
        try:
            principal_id = self.authenticator.authenticate(credential)
        except Exception as exc:
            raise PermissionError("human authentication failed") from exc
        if not isinstance(principal_id, str) or not principal_id.strip():
            raise PermissionError("human authentication failed")
        return principal_id

    def _workload_agent(self, credential):
        """Resolve an authenticated workload credential to a server-side agent ID."""
        try:
            agent_id = self.workload_authenticator.authenticate(credential)
        except Exception as exc:
            raise PermissionError("agent workload authentication failed") from exc
        if not isinstance(agent_id, str) or not agent_id.strip():
            raise PermissionError("agent workload authentication failed")
        return agent_id

    def _grant(self, grant_id):
        row = self.db.execute(
            "SELECT g.subject_agent_id,b.tenant_id,b.owner_principal_id,"
            "g.actions_json,g.resources_json,g.approval_required_json,"
            "g.budget_unit,g.policy_version "
            "FROM ahaf_authority_grants g "
            "JOIN ahaf_agent_bindings b ON b.agent_id=g.subject_agent_id "
            "WHERE g.grant_id=?",
            (grant_id,),
        ).fetchone()
        if row is None:
            raise PermissionError("unknown authority grant")
        if not self.store.grant_is_active(grant_id):
            raise PermissionError("inactive authority grant")
        return {
            "agent_id": row[0], "tenant_id": row[1], "owner_id": row[2],
            "actions": set(json.loads(row[3])), "resources": set(json.loads(row[4])),
            "approval_required": set(json.loads(row[5])),
            "budget_unit": row[6], "policy_version": row[7],
        }

    def approve(self, credential, grant_id, request_id, action, resource_id,
                expires_in_seconds=300):
        """Record a human owner's approval bound to one exact mock action request."""
        approver_id = self._human_principal(credential)
        if not isinstance(expires_in_seconds, int) or isinstance(expires_in_seconds, bool):
            raise ValueError("expires_in_seconds must be an integer")
        if not 1 <= expires_in_seconds <= 900:
            raise ValueError("approval lifetime must be between 1 and 900 seconds")
        grant = self._grant(grant_id)
        if action not in grant["actions"] or resource_id not in grant["resources"]:
            raise PermissionError("approval request is outside grant scope")
        if action not in grant["approval_required"]:
            raise ValueError("the action does not require human approval")
        if approver_id != grant["owner_id"]:
            raise PermissionError("the bound human owner must approve this request")
        membership = self.db.execute(
            "SELECT 1 FROM principals p JOIN tenant_memberships m "
            "ON m.principal_id=p.principal_id "
            "WHERE p.principal_id=? AND p.active=1 AND m.tenant_id=? "
            "AND m.active=1 AND m.role='owner'",
            (approver_id, grant["tenant_id"]),
        ).fetchone()
        if membership is None:
            raise PermissionError("active tenant owner approval required")

        approval_id = str(uuid4())
        nonce = str(uuid4())
        issued = datetime.now(timezone.utc)
        expires = issued + timedelta(seconds=expires_in_seconds)
        self.store._begin()
        try:
            self.store._grant_chain(grant_id, require_active=True)
            existing = self.db.execute(
                "SELECT 1 FROM ahaf_approvals WHERE grant_id=? AND request_id=?",
                (grant_id, request_id),
            ).fetchone()
            if existing:
                raise ValueError("an approval record already exists for this request")
            self.db.execute(
                "INSERT INTO ahaf_approvals "
                "(approval_id,grant_id,approver_principal_id,request_id,action,resource_id,"
                "amount_units,unit_code,decision,issued_at,expires_at,nonce) "
                "VALUES (?,?,?,?,?,?,NULL,NULL,'approved',?,?,?)",
                (approval_id, grant_id, approver_id, request_id, action, resource_id,
                 issued.isoformat(), expires.isoformat(), nonce),
            )
            self.store._append_audit(
                actor_type="human", actor_id=approver_id, agent_id=grant["agent_id"],
                tenant_id=grant["tenant_id"], grant_id=grant_id, request_id=request_id,
                action=action, resource_id=resource_id, decision="human_approved",
                policy_version=grant["policy_version"],
                payload={"approval_id": approval_id, "expires_at": expires.isoformat()},
            )
            self.store._finish()
        except Exception as exc:
            self.store._finish(exc)
            raise
        return approval_id

    def execute(self, *, agent_credential, grant_id, request_id,
                action, resource_id, approval_id=None):
        """Run only the fixed, harmless mock increment action.

        Agent identity is resolved from the injected workload authenticator;
        callers cannot assert an agent or tenant ID as proof of identity. This
        remains a local test harness: production credential issuance, rotation,
        revocation, and target-system enforcement are not implemented here.
        """
        if action != self.ACTION:
            raise PermissionError("mock executor only supports its fixed action")
        if not all(isinstance(v, str) and v.strip() for v in
                   (grant_id, request_id, resource_id)):
            raise ValueError("grant, request, and resource IDs are required")
        agent_id = self._workload_agent(agent_credential)
        grant = self._grant(grant_id)
        if grant["agent_id"] != agent_id:
            raise PermissionError("authenticated workload does not match the authority grant subject")
        tenant_id = grant["tenant_id"]
        if action not in grant["actions"]:
            raise PermissionError("action is outside grant scope")
        if resource_id not in grant["resources"]:
            raise PermissionError("resource is outside grant scope")
        if (tenant_id, resource_id) not in self.resources:
            raise PermissionError("mock resource is not registered in this tenant")

        if action in grant["approval_required"]:
            if not approval_id:
                raise PermissionError("human approval is required")
            approval = self.db.execute(
                "SELECT approver_principal_id,decision,expires_at "
                "FROM ahaf_approvals WHERE approval_id=? AND grant_id=? "
                "AND request_id=? AND action=? AND resource_id=?",
                (approval_id, grant_id, request_id, action, resource_id),
            ).fetchone()
            if approval is None or approval[1] != "approved":
                raise PermissionError("matching human approval is required")
            if approval[2] <= datetime.now(timezone.utc).isoformat():
                raise PermissionError("human approval has expired")
            if approval[0] != grant["owner_id"]:
                raise PermissionError("approval was not issued by the bound human owner")
        elif approval_id is not None:
            raise PermissionError("unexpected approval supplied for an action without approval requirement")

        prepared = self.receipts.prepare(
            tenant_id=tenant_id, agent_id=agent_id, grant_id=grant_id,
            request_id=request_id, action=action, resource_id=resource_id,
            approval_id=approval_id, amount_units=1,
        )
        if not prepared["created"]:
            if prepared["state"] in ("succeeded", "reconciled_succeeded"):
                return {
                    "status": "already_executed",
                    "value": self.resources[(tenant_id, resource_id)],
                    "execution_id": prepared["execution_id"],
                }
            raise PermissionError(
                "existing execution requires reconciliation; automatic redispatch is blocked"
            )

        execution_id = prepared["execution_id"]
        key = (tenant_id, resource_id)
        self.receipts.mark_dispatching(
            execution_id, tenant_id=tenant_id,
            adapter_id="local-mock-counter", adapter_version="0.2",
        )
        try:
            # The mock adapter changes only this process-local test resource.
            self.resources[key] += 1
            value_after = self.resources[key]
            evidence_ref = f"mock://{tenant_id}/{resource_id}/{request_id}"
            evidence_digest = hashlib.sha256(
                f"{execution_id}:{value_after}".encode("utf-8")
            ).hexdigest()
            self.receipts.record_outcome(
                execution_id, tenant_id=tenant_id, outcome="succeeded",
                evidence_ref=evidence_ref, evidence_digest=evidence_digest,
            )
            return {
                "status": "completed", "value": value_after,
                "execution_id": execution_id,
            }
        except Exception as exc:
            # Once dispatch intent is durable, an exception is ambiguous. Do not
            # release the reservation or retry; record unknown and require review.
            try:
                self.receipts.record_outcome(
                    execution_id, tenant_id=tenant_id,
                    outcome="outcome_unknown",
                    reason=f"mock adapter exception: {type(exc).__name__}",
                )
            except Exception:
                # If even the unknown receipt cannot be persisted, leave the
                # dispatching receipt and reserved budget for operator recovery.
                pass
            return {
                "status": "outcome_unknown", "execution_id": execution_id,
            }
