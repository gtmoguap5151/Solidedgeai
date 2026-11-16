"""Test-only governed mock execution slice for GALINYX.

This module connects persisted AHAF grants and authenticated human approvals to a
harmless in-memory mock resource. It is an integration test harness, not a
production workload-authentication mechanism or an enforcement boundary for
external systems. The agent ID is checked against the grant subject, but no
cryptographic agent workload credential is validated here.
"""
import json
from datetime import datetime, timedelta, timezone
from uuid import uuid4


class GovernedMockExecutor:
    """Authorize a fixed mock action before changing an in-memory counter."""

    ACTION = "mock.counter.increment"

    def __init__(self, authority_store, authenticator, resources=None):
        if authority_store is None or authenticator is None:
            raise ValueError("authority_store and authenticator are required")
        if not callable(getattr(authenticator, "authenticate", None)):
            raise TypeError("authenticator must provide authenticate(credential)")
        self.store = authority_store
        self.db = authority_store.db
        self.authenticator = authenticator
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

    def execute(self, *, tenant_id, agent_id, grant_id, request_id,
                action, resource_id, approval_id=None):
        """Run only the fixed, harmless mock increment action.

        The caller is expected to be a trusted local test harness. A production
        service must authenticate the agent workload and enforce the permit at
        the actual target-system boundary before exposing this operation.
        """
        if action != self.ACTION:
            raise PermissionError("mock executor only supports its fixed action")
        if not all(isinstance(v, str) and v.strip() for v in
                   (tenant_id, agent_id, grant_id, request_id, resource_id)):
            raise ValueError("tenant, agent, grant, request, and resource IDs are required")
        grant = self._grant(grant_id)
        if grant["agent_id"] != agent_id or grant["tenant_id"] != tenant_id:
            raise PermissionError("agent or tenant does not match the authority grant")
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

        reservation = self.store.reserve_budget(
            grant_id, request_id, 1, grant["budget_unit"]
        )
        if reservation["status"] == "committed":
            return {"status": "already_executed", "value": self.resources[(tenant_id, resource_id)]}
        if reservation["status"] != "reserved" or not reservation["created"]:
            raise PermissionError("existing unsettled request requires reconciliation")

        key = (tenant_id, resource_id)
        try:
            # This is deliberately a local mock side effect, not a real external action.
            self.resources[key] += 1
            self.store.settle_reservation(reservation["reservation_id"], "commit")
            self.store._begin()
            try:
                self.store._append_audit(
                    actor_type="agent", actor_id=agent_id, agent_id=agent_id,
                    tenant_id=tenant_id, grant_id=grant_id, request_id=request_id,
                    action=action, resource_id=resource_id, decision="mock_execution_completed",
                    policy_version=grant["policy_version"],
                    payload={"value_after": self.resources[key]},
                )
                self.store._finish()
            except Exception as exc:
                self.store._finish(exc)
                raise
            return {"status": "completed", "value": self.resources[key]}
        except Exception:
            # A committed reservation is not released; reconciliation is required
            # if a failure occurs after the mock side effect or settlement.
            current = self.store._reservation_status(reservation["reservation_id"])
            if current == "reserved":
                self.store.settle_reservation(reservation["reservation_id"], "release")
            raise
