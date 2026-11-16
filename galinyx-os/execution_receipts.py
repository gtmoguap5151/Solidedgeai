"""Durable preparation ledger for governed GALINYX executions.

This module prepares an execution and reserves its budget atomically. It does
not dispatch work to a target system and is not a production enforcement
boundary. Callers must supply tenant and agent identities resolved by trusted
authentication and grant-binding code.
"""
import hashlib
import json
from datetime import datetime, timezone
from uuid import uuid4


def _required(value, label, maximum=256):
    if not isinstance(value, str) or not value.strip() or len(value) > maximum:
        raise ValueError(f"{label} must be a nonempty string of at most {maximum} characters")
    return value


def _positive_integer(value, label):
    if not isinstance(value, int) or isinstance(value, bool) or value < 1:
        raise ValueError(f"{label} must be a positive integer")
    return value


class ExecutionReceiptService:
    """Create immutable execution identities and append-only lifecycle events."""

    def __init__(self, authority_store):
        if authority_store is None or not callable(getattr(authority_store, "_begin", None)):
            raise TypeError("a trusted AuthorityStore is required")
        self.store = authority_store
        self.db = authority_store.db

    @staticmethod
    def _canonical_request(*, tenant_id, agent_id, grant_id, request_id,
                           action, resource_id, amount_units, approval_id, policy_version):
        request = {
            "tenant_id": tenant_id,
            "agent_id": agent_id,
            "grant_id": grant_id,
            "request_id": request_id,
            "action": action,
            "resource_id": resource_id,
            "amount_units": amount_units,
            "approval_id": approval_id,
            "policy_version": policy_version,
        }
        encoded = json.dumps(
            request, sort_keys=True, separators=(",", ":"),
            ensure_ascii=False, allow_nan=False,
        )
        return request, encoded, hashlib.sha256(encoded.encode("utf-8")).hexdigest()

    def prepare(self, *, tenant_id, agent_id, grant_id, request_id,
                action, resource_id, approval_id=None, amount_units=1):
        """Atomically consume approval, reserve budget, and create a receipt.

        Replaying the same request ID and exact digest returns the existing
        receipt. Reusing that request ID for different content is rejected.
        The returned state is reserved; no target action has been dispatched.
        """
        tenant_id = _required(tenant_id, "tenant_id")
        agent_id = _required(agent_id, "agent_id")
        grant_id = _required(grant_id, "grant_id")
        request_id = _required(request_id, "request_id")
        action = _required(action, "action")
        resource_id = _required(resource_id, "resource_id")
        if approval_id is not None:
            approval_id = _required(approval_id, "approval_id")
        amount_units = _positive_integer(amount_units, "amount_units")
        now = datetime.now(timezone.utc).isoformat()
        execution_id = str(uuid4())
        reservation_id = str(uuid4())

        self.store._begin()
        try:
            grant = self.db.execute(
                "SELECT g.subject_agent_id,b.tenant_id,b.owner_principal_id,"
                "g.actions_json,g.resources_json,g.approval_required_json,"
                "g.budget_unit,g.policy_version,g.max_transaction_units,"
                "g.transaction_unit,g.transaction_actions_json "
                "FROM ahaf_authority_grants g "
                "JOIN ahaf_agent_bindings b ON b.agent_id=g.subject_agent_id "
                "WHERE g.grant_id=?",
                (grant_id,),
            ).fetchone()
            if grant is None:
                raise PermissionError("unknown authority grant")
            (grant_agent, grant_tenant, owner_id, actions_json, resources_json,
             approval_json, budget_unit, policy_version, max_transaction_units,
             transaction_unit, transaction_actions_json) = grant
            _, _, request_digest = self._canonical_request(
                tenant_id=tenant_id, agent_id=agent_id, grant_id=grant_id,
                request_id=request_id, action=action, resource_id=resource_id,
                amount_units=amount_units, approval_id=approval_id,
                policy_version=policy_version,
            )
            existing = self.db.execute(
                "SELECT execution_id,request_digest,reservation_id "
                "FROM ahaf_execution_receipts WHERE grant_id=? AND request_id=?",
                (grant_id, request_id),
            ).fetchone()
            if existing is not None:
                if existing[1] != request_digest:
                    raise ValueError("request ID reused for different execution content")
                state_row = self.db.execute(
                    "SELECT state FROM ahaf_execution_receipt_events "
                    "WHERE execution_id=? ORDER BY event_id DESC LIMIT 1",
                    (existing[0],),
                ).fetchone()
                self.store._finish()
                return {
                    "execution_id": existing[0], "reservation_id": existing[2],
                    "state": state_row[0] if state_row else "invalid_receipt",
                    "created": False,
                }
            if grant_agent != agent_id or grant_tenant != tenant_id:
                raise PermissionError("authenticated workload and tenant must match persisted grant binding")
            chain = self.store._grant_chain(grant_id, require_active=True)
            if action not in set(json.loads(actions_json)):
                raise PermissionError("action is outside grant scope")
            if resource_id not in set(json.loads(resources_json)):
                raise PermissionError("resource is outside grant scope")

            approval_required = action in set(json.loads(approval_json))
            if approval_required and approval_id is None:
                raise PermissionError("human approval is required")
            if not approval_required and approval_id is not None:
                raise PermissionError("unexpected approval supplied for an action without approval requirement")

            if approval_required:
                approval = self.db.execute(
                    "SELECT approver_principal_id,request_id,action,resource_id,decision,expires_at "
                    "FROM ahaf_approvals WHERE approval_id=? AND grant_id=?",
                    (approval_id, grant_id),
                ).fetchone()
                if approval is None:
                    raise PermissionError("matching human approval is required")
                (approver_id, approved_request, approved_action, approved_resource,
                 decision, expires_at) = approval
                if (approved_request != request_id or approved_action != action
                        or approved_resource != resource_id or decision != "approved"):
                    raise PermissionError("human approval does not match this exact request")
                if expires_at <= now:
                    raise PermissionError("human approval has expired")
                if approver_id != owner_id:
                    raise PermissionError("approval was not issued by the bound human owner")
                membership = self.db.execute(
                    "SELECT 1 FROM principals p JOIN tenant_memberships m "
                    "ON m.principal_id=p.principal_id "
                    "WHERE p.principal_id=? AND p.active=1 AND m.tenant_id=? "
                    "AND m.active=1 AND m.role='owner'",
                    (approver_id, tenant_id),
                ).fetchone()
                if membership is None:
                    raise PermissionError("active tenant owner approval required")
                consumed = self.db.execute(
                    "SELECT execution_id FROM ahaf_approval_consumptions WHERE approval_id=?",
                    (approval_id,),
                ).fetchone()
                if consumed is not None:
                    raise PermissionError("human approval has already been consumed")

            transaction_actions = set(json.loads(transaction_actions_json))
            if action in transaction_actions:
                if transaction_unit != budget_unit or max_transaction_units is None:
                    raise RuntimeError("grant transaction limit metadata is inconsistent")
                if amount_units > max_transaction_units:
                    raise PermissionError("execution amount exceeds the grant transaction ceiling")

            # Reuse the existing budget model, but perform its checks and writes
            # inside this same transaction as receipt creation and approval use.
            for item in chain:
                if item["budget_unit"] != budget_unit:
                    raise ValueError("budget unit must match every grant in the delegation chain")
                consumed_units = self.db.execute(
                    "SELECT COALESCE(SUM(CASE WHEN entry_type='reserve' THEN amount_units "
                    "WHEN entry_type='release' THEN -amount_units ELSE 0 END),0) "
                    "FROM ahaf_budget_ledger WHERE grant_id=?",
                    (item["grant_id"],),
                ).fetchone()[0]
                if consumed_units + amount_units > item["budget_limit_units"]:
                    raise PermissionError("cumulative grant budget exceeded")

            prior_reservation = self.db.execute(
                "SELECT reservation_id FROM ahaf_budget_reservations "
                "WHERE leaf_grant_id=? AND request_id=?",
                (grant_id, request_id),
            ).fetchone()
            if prior_reservation is not None:
                raise PermissionError("unlinked budget reservation requires reconciliation")

            self.db.execute(
                "INSERT INTO ahaf_budget_reservations "
                "(reservation_id,leaf_grant_id,request_id,amount_units,unit_code,created_at) "
                "VALUES (?,?,?,?,?,?)",
                (reservation_id, grant_id, request_id, amount_units, budget_unit, now),
            )
            for item in chain:
                self.db.execute(
                    "INSERT INTO ahaf_budget_ledger "
                    "(reservation_id,grant_id,entry_type,amount_units,unit_code,idempotency_key,created_at) "
                    "VALUES (?,?,?,?,?,?,?)",
                    (reservation_id, item["grant_id"], "reserve", amount_units,
                     budget_unit, f"reserve:{reservation_id}:{item['grant_id']}", now),
                )

            self.db.execute(
                "INSERT INTO ahaf_execution_receipts "
                "(execution_id,tenant_id,agent_id,grant_id,request_id,request_digest,"
                "action,resource_id,policy_version,approval_id,reservation_id,created_at) "
                "VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                (execution_id, tenant_id, agent_id, grant_id, request_id,
                 request_digest, action, resource_id, policy_version, approval_id,
                 reservation_id, now),
            )
            if approval_required:
                self.db.execute(
                    "INSERT INTO ahaf_approval_consumptions "
                    "(approval_id,execution_id,consumed_at) VALUES (?,?,?)",
                    (approval_id, execution_id, now),
                )
            self.db.execute(
                "INSERT INTO ahaf_execution_receipt_events "
                "(execution_id,state,actor_type,actor_id,detail_json,occurred_at) "
                "VALUES (?,?,?,?,?,?)",
                (execution_id, "reserved", "system", "execution-receipt-service",
                 json.dumps({"reservation_id": reservation_id, "amount_units": amount_units,
                             "unit_code": budget_unit}, sort_keys=True), now),
            )
            self.store._append_audit(
                actor_type="system", actor_id="execution-receipt-service",
                agent_id=agent_id, tenant_id=tenant_id, grant_id=grant_id,
                request_id=request_id, action=action, resource_id=resource_id,
                decision="execution_prepared", policy_version=policy_version,
                payload={"execution_id": execution_id, "request_digest": request_digest,
                         "reservation_id": reservation_id, "approval_id": approval_id,
                         "amount_units": amount_units, "unit_code": budget_unit},
                occurred_at=now,
            )
            self.store._finish()
            return {
                "execution_id": execution_id, "reservation_id": reservation_id,
                "state": "reserved", "created": True,
            }
        except Exception as exc:
            self.store._finish(exc)
            raise

    def get(self, execution_id, *, tenant_id):
        """Read a receipt only within its persisted tenant boundary."""
        execution_id = _required(execution_id, "execution_id")
        tenant_id = _required(tenant_id, "tenant_id")
        row = self.db.execute(
            "SELECT execution_id,tenant_id,agent_id,grant_id,request_id,request_digest,"
            "action,resource_id,policy_version,approval_id,reservation_id,created_at "
            "FROM ahaf_execution_receipts WHERE execution_id=? AND tenant_id=?",
            (execution_id, tenant_id),
        ).fetchone()
        if row is None:
            raise KeyError("execution receipt not found")
        event = self.db.execute(
            "SELECT state,actor_type,actor_id,detail_json,occurred_at "
            "FROM ahaf_execution_receipt_events WHERE execution_id=? "
            "ORDER BY event_id DESC LIMIT 1",
            (execution_id,),
        ).fetchone()
        return {
            "execution_id": row[0], "tenant_id": row[1], "agent_id": row[2],
            "grant_id": row[3], "request_id": row[4], "request_digest": row[5],
            "action": row[6], "resource_id": row[7], "policy_version": row[8],
            "approval_id": row[9], "reservation_id": row[10], "created_at": row[11],
            "state": event[0] if event else "invalid_receipt",
            "last_event": ({
                "actor_type": event[1], "actor_id": event[2],
                "detail": json.loads(event[3]), "occurred_at": event[4],
            } if event else None),
        }
