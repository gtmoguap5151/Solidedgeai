"""Persistent AHAF record store (prototype; not an authorization boundary).

The store persists immutable agent bindings/grants, revocations, atomic budget
reservations, and a hash-chained audit stream. It deliberately does not
authenticate callers, evaluate action/resource policy, issue approvals, or
execute agent work. Callers must keep this object behind a trusted service.
"""
import hashlib
import json
import re
import sqlite3
from datetime import datetime, timezone
from uuid import uuid4


_UNIT = re.compile(r"^[A-Z0-9_]{1,32}$")


def _identifier(value, label, maximum=128):
    if not isinstance(value, str) or not value.strip() or len(value) > maximum:
        raise ValueError(f"{label} must be a nonempty string of at most {maximum} characters")
    return value


def _unit(value, label="unit_code"):
    value = _identifier(value, label, 32)
    if not _UNIT.fullmatch(value):
        raise ValueError(f"{label} must use uppercase letters, digits, and underscores")
    return value


def _integer(value, label, minimum=0):
    if not isinstance(value, int) or isinstance(value, bool) or value < minimum:
        raise ValueError(f"{label} must be an integer of at least {minimum}")
    return value


def _string_set(values, label):
    if isinstance(values, (str, bytes)):
        raise ValueError(f"{label} must be an iterable of strings, not a string")
    try:
        result = sorted(set(values))
    except TypeError:
        raise ValueError(f"{label} must be an iterable of strings") from None
    for value in result:
        _identifier(value, label)
    return result


def _timestamp(value, label):
    if not isinstance(value, datetime) or value.tzinfo is None or value.utcoffset() is None:
        raise ValueError(f"{label} must be a timezone-aware datetime")
    return value.astimezone(timezone.utc).isoformat()


class AuthorityStore:
    """SQLite persistence for AHAF records; caller identity remains external."""

    def __init__(self, connection):
        if not isinstance(connection, sqlite3.Connection):
            raise TypeError("connection must be a sqlite3.Connection")
        self.db = connection
        self.db.execute("PRAGMA foreign_keys=ON")
        self._ensure_ready()

    def _ensure_ready(self):
        from database_migrations import MigrationRunner
        from runtime_migrations import GALINYX_MIGRATIONS
        MigrationRunner(self.db, GALINYX_MIGRATIONS).migrate()
        version = MigrationRunner(self.db, GALINYX_MIGRATIONS).current_version()
        if version < 3:
            raise RuntimeError("AHAF persistence schema version 3 is required")

    def _begin(self):
        if self.db.in_transaction:
            raise RuntimeError("AuthorityStore requires a connection outside an active transaction")
        self.db.execute("BEGIN IMMEDIATE")

    def _finish(self, error=None):
        if error is None:
            self.db.commit()
        else:
            self.db.rollback()

    @staticmethod
    def _event_hash(previous_hash, event):
        canonical = json.dumps(event, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
        material = (previous_hash or "") + "\n" + canonical
        return hashlib.sha256(material.encode("utf-8")).hexdigest(), canonical

    def _append_audit(self, *, actor_type, actor_id, policy_version, payload,
                      agent_id=None, tenant_id=None, grant_id=None, request_id=None,
                      action=None, resource_id=None, decision=None, occurred_at=None):
        occurred_at = occurred_at or datetime.now(timezone.utc).isoformat()
        previous = self.db.execute(
            "SELECT event_hash FROM ahaf_audit_events ORDER BY event_id DESC LIMIT 1"
        ).fetchone()
        previous_hash = previous[0] if previous else None
        event = {
            "occurred_at": occurred_at, "actor_type": actor_type, "actor_id": actor_id,
            "agent_id": agent_id, "tenant_id": tenant_id, "grant_id": grant_id,
            "request_id": request_id, "action": action, "resource_id": resource_id,
            "decision": decision, "policy_version": policy_version, "payload": payload,
        }
        event_hash, payload_json = self._event_hash(previous_hash, event)
        self.db.execute(
            "INSERT INTO ahaf_audit_events "
            "(occurred_at,actor_type,actor_id,agent_id,tenant_id,grant_id,request_id,"
            "action,resource_id,decision,policy_version,payload_json,previous_hash,event_hash) "
            "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (occurred_at, actor_type, actor_id, agent_id, tenant_id, grant_id,
             request_id, action, resource_id, decision, policy_version, payload_json,
             previous_hash, event_hash),
        )
        return event_hash

    def verify_audit_chain(self):
        previous_hash = None
        for row in self.db.execute(
            "SELECT event_id,occurred_at,actor_type,actor_id,agent_id,tenant_id,grant_id,"
            "request_id,action,resource_id,decision,policy_version,payload_json,previous_hash,event_hash "
            "FROM ahaf_audit_events ORDER BY event_id"
        ):
            (event_id, occurred_at, actor_type, actor_id, agent_id, tenant_id, grant_id,
             request_id, action, resource_id, decision, policy_version, payload_json,
             stored_previous, stored_hash) = row
            if stored_previous != previous_hash:
                return False, event_id
            try:
                stored_event = json.loads(payload_json)
            except (TypeError, ValueError):
                return False, event_id
            if not isinstance(stored_event, dict):
                return False, event_id
            event = {
                "occurred_at": occurred_at, "actor_type": actor_type, "actor_id": actor_id,
                "agent_id": agent_id, "tenant_id": tenant_id, "grant_id": grant_id,
                "request_id": request_id, "action": action, "resource_id": resource_id,
                "decision": decision, "policy_version": policy_version,
                "payload": stored_event.get("payload"),
            }
            if stored_event != event:
                return False, event_id
            calculated, canonical = self._event_hash(previous_hash, event)
            if canonical != payload_json or calculated != stored_hash:
                return False, event_id
            previous_hash = stored_hash
        return True, None

    def bind_agent(self, agent_id, tenant_id, owner_principal_id, binding_ref):
        """Create a server-managed binding; binding_ref is an opaque key reference, not a secret."""
        agent_id = _identifier(agent_id, "agent_id")
        tenant_id = _identifier(tenant_id, "tenant_id")
        owner_principal_id = _identifier(owner_principal_id, "owner_principal_id")
        binding_ref = _identifier(binding_ref, "binding_ref", 256)
        self._begin()
        try:
            entity = self.db.execute(
                "SELECT kind FROM entities WHERE id=?", (agent_id,)
            ).fetchone()
            owner = self.db.execute(
                "SELECT 1 FROM principals p JOIN tenants t ON t.owner_principal_id=p.principal_id "
                "JOIN tenant_memberships m ON m.tenant_id=t.tenant_id AND m.principal_id=p.principal_id "
                "JOIN resource_ownership o ON o.tenant_id=t.tenant_id "
                "AND o.owner_principal_id=p.principal_id AND o.resource_id=? "
                "WHERE p.principal_id=? AND p.active=1 AND t.tenant_id=? AND t.active=1 "
                "AND m.active=1 AND m.role='owner'",
                (agent_id, owner_principal_id, tenant_id),
            ).fetchone()
            if entity is None or entity[0] != "agent":
                raise ValueError("an existing agent entity is required")
            if owner is None:
                raise PermissionError("active workspace owner required to bind agent")
            self.db.execute(
                "INSERT INTO ahaf_agent_bindings(agent_id,tenant_id,owner_principal_id,binding_ref,created_at) "
                "VALUES (?,?,?,?,?)",
                (agent_id, tenant_id, owner_principal_id, binding_ref,
                 datetime.now(timezone.utc).isoformat()),
            )
            self._append_audit(
                actor_type="human", actor_id=owner_principal_id, agent_id=agent_id,
                tenant_id=tenant_id, policy_version="ahaf-store-0.1",
                decision="binding_created", payload={"binding_ref": binding_ref},
            )
            self._finish()
            return agent_id
        except Exception as exc:
            self._finish(exc)
            raise

    def revoke_agent_binding(self, actor_principal_id, agent_id, reason):
        actor_principal_id = _identifier(actor_principal_id, "actor_principal_id")
        agent_id = _identifier(agent_id, "agent_id")
        reason = _identifier(reason, "reason", 512)
        self._begin()
        try:
            row = self.db.execute(
                "SELECT tenant_id,owner_principal_id FROM ahaf_agent_bindings WHERE agent_id=?",
                (agent_id,),
            ).fetchone()
            if row is None:
                self._finish()
                return False
            tenant_id, owner_id = row
            if owner_id != actor_principal_id:
                raise PermissionError("bound workspace owner required to revoke agent binding")
            if self.db.execute(
                "SELECT 1 FROM ahaf_agent_binding_revocations WHERE agent_id=?", (agent_id,)
            ).fetchone():
                self._finish()
                return False
            self.db.execute(
                "INSERT INTO ahaf_agent_binding_revocations(agent_id,actor_principal_id,revoked_at,reason) "
                "VALUES (?,?,?,?)",
                (agent_id, actor_principal_id, datetime.now(timezone.utc).isoformat(), reason),
            )
            self._append_audit(
                actor_type="human", actor_id=actor_principal_id, agent_id=agent_id,
                tenant_id=tenant_id, policy_version="ahaf-store-0.1",
                decision="agent_binding_revoked", payload={"reason": reason},
            )
            self._finish()
            return True
        except Exception as exc:
            self._finish(exc)
            raise

    def issue_root_grant(self, issuer_principal_id, subject_agent_id, *, actions, resources,
                         expires_at, budget_limit_units, budget_unit, max_transaction_units=None,
                         transaction_unit=None, transaction_actions=(), approval_required=(),
                         delegable_actions=(), delegation_depth=0, policy_version="ahaf-0.1"):
        issuer_principal_id = _identifier(issuer_principal_id, "issuer_principal_id")
        subject_agent_id = _identifier(subject_agent_id, "subject_agent_id")
        actions = _string_set(actions, "actions")
        resources = _string_set(resources, "resources")
        transaction_actions = _string_set(transaction_actions, "transaction_actions")
        approval_required = _string_set(approval_required, "approval_required")
        delegable_actions = _string_set(delegable_actions, "delegable_actions")
        if not actions or not resources:
            raise ValueError("grant requires actions and resources")
        if not set(transaction_actions).issubset(actions):
            raise ValueError("transaction_actions must be a subset of actions")
        if not set(approval_required).issubset(actions):
            raise ValueError("approval_required must be a subset of actions")
        if not set(delegable_actions).issubset(actions):
            raise ValueError("delegable_actions must be a subset of actions")
        budget_limit_units = _integer(budget_limit_units, "budget_limit_units")
        budget_unit = _unit(budget_unit)
        delegation_depth = _integer(delegation_depth, "delegation_depth")
        expiry = _timestamp(expires_at, "expires_at")
        if expiry <= datetime.now(timezone.utc).isoformat():
            raise ValueError("expires_at must be in the future")
        policy_version = _identifier(policy_version, "policy_version", 64)
        if transaction_actions:
            if max_transaction_units is None or transaction_unit is None:
                raise ValueError("transaction actions require an amount ceiling and unit")
            max_transaction_units = _integer(max_transaction_units, "max_transaction_units")
            transaction_unit = _unit(transaction_unit, "transaction_unit")
        elif max_transaction_units is not None or transaction_unit is not None:
            raise ValueError("transaction ceiling requires transaction_actions")
        grant_id = str(uuid4())
        created = datetime.now(timezone.utc).isoformat()
        self._begin()
        try:
            binding = self.db.execute(
                "SELECT b.tenant_id,b.owner_principal_id "
                "FROM ahaf_agent_bindings b "
                "JOIN principals p ON p.principal_id=b.owner_principal_id "
                "JOIN tenants t ON t.tenant_id=b.tenant_id AND t.owner_principal_id=p.principal_id "
                "JOIN tenant_memberships m ON m.tenant_id=t.tenant_id AND m.principal_id=p.principal_id "
                "LEFT JOIN ahaf_agent_binding_revocations r ON r.agent_id=b.agent_id "
                "WHERE b.agent_id=? AND r.agent_id IS NULL AND p.active=1 AND t.active=1 "
                "AND m.active=1 AND m.role='owner'",
                (subject_agent_id,),
            ).fetchone()
            if binding is None:
                raise PermissionError("active bound agent required")
            tenant_id, owner_id = binding
            if owner_id != issuer_principal_id:
                raise PermissionError("workspace owner governance required to issue root grant")
            self.db.execute(
                "INSERT INTO ahaf_authority_grants "
                "(grant_id,subject_agent_id,issuer_type,issuer_id,parent_grant_id,policy_version,"
                "actions_json,resources_json,expires_at,budget_limit_units,budget_unit,"
                "max_transaction_units,transaction_unit,transaction_actions_json,"
                "approval_required_json,delegable_actions_json,delegation_depth,created_at) "
                "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (grant_id, subject_agent_id, "human", issuer_principal_id, None, policy_version,
                 json.dumps(actions), json.dumps(resources), expiry, budget_limit_units, budget_unit,
                 max_transaction_units, transaction_unit, json.dumps(transaction_actions),
                 json.dumps(approval_required), json.dumps(delegable_actions), delegation_depth, created),
            )
            self._append_audit(
                actor_type="human", actor_id=issuer_principal_id, agent_id=subject_agent_id,
                tenant_id=tenant_id, grant_id=grant_id, policy_version=policy_version,
                decision="grant_issued",
                payload={"actions": actions, "resources": resources,
                         "budget_limit_units": budget_limit_units, "budget_unit": budget_unit},
            )
            self._finish()
            return grant_id
        except Exception as exc:
            self._finish(exc)
            raise

    def delegate_grant(self, parent_grant_id, delegator_agent_id, delegate_agent_id, *,
                       actions, resources, expires_at, budget_limit_units,
                       transaction_actions=(), max_transaction_units=None,
                       transaction_unit=None, approval_required=(), delegable_actions=()):
        """Persist an attenuated child grant; no agent credential is authenticated here."""
        parent_grant_id = _identifier(parent_grant_id, "parent_grant_id")
        delegator_agent_id = _identifier(delegator_agent_id, "delegator_agent_id")
        delegate_agent_id = _identifier(delegate_agent_id, "delegate_agent_id")
        if delegator_agent_id == delegate_agent_id:
            raise PermissionError("an agent cannot delegate authority to itself")
        actions = _string_set(actions, "actions")
        resources = _string_set(resources, "resources")
        transaction_actions = _string_set(transaction_actions, "transaction_actions")
        approval_required = _string_set(approval_required, "approval_required")
        delegable_actions = _string_set(delegable_actions, "delegable_actions")
        if not actions or not resources:
            raise ValueError("delegated grant requires actions and resources")
        budget_limit_units = _integer(budget_limit_units, "budget_limit_units")
        expiry = _timestamp(expires_at, "expires_at")
        if expiry <= datetime.now(timezone.utc).isoformat():
            raise ValueError("expires_at must be in the future")
        grant_id = str(uuid4())
        created = datetime.now(timezone.utc).isoformat()
        self._begin()
        try:
            self._grant_chain(parent_grant_id, require_active=True)
            parent = self.db.execute(
                "SELECT subject_agent_id,actions_json,resources_json,expires_at,budget_limit_units,"
                "budget_unit,max_transaction_units,transaction_unit,transaction_actions_json,"
                "approval_required_json,delegable_actions_json,delegation_depth,policy_version "
                "FROM ahaf_authority_grants WHERE grant_id=?",
                (parent_grant_id,),
            ).fetchone()
            if parent is None:
                raise PermissionError("active parent grant required")
            (parent_subject, parent_actions_json, parent_resources_json, parent_expiry,
             parent_budget, parent_unit, parent_max_transaction, parent_transaction_unit,
             parent_transaction_actions_json, parent_approval_json,
             parent_delegable_json, parent_depth, policy_version) = parent
            if parent_subject != delegator_agent_id:
                raise PermissionError("delegator is not the parent grant subject")
            if parent_depth <= 0:
                raise PermissionError("delegation depth exhausted")
            parent_actions = set(json.loads(parent_actions_json))
            parent_resources = set(json.loads(parent_resources_json))
            parent_transaction_actions = set(json.loads(parent_transaction_actions_json))
            parent_approval = set(json.loads(parent_approval_json))
            parent_delegable = set(json.loads(parent_delegable_json))
            if not parent_delegable.issubset(parent_actions):
                raise RuntimeError("parent grant has invalid delegable-action metadata")
            if not set(actions).issubset(parent_delegable):
                raise PermissionError("delegation cannot add actions or exceed delegable actions")
            if not set(resources).issubset(parent_resources):
                raise PermissionError("delegation cannot broaden resource scope")
            if expiry > parent_expiry:
                raise PermissionError("delegation cannot outlive parent grant")
            if budget_limit_units > parent_budget:
                raise PermissionError("delegation cannot increase budget")
            if not set(transaction_actions) == set(actions).intersection(parent_transaction_actions):
                raise PermissionError("delegation cannot add or remove transaction-limited actions")
            if not set(approval_required).issubset(actions):
                raise ValueError("approval_required must be a subset of delegated actions")
            if not set(approval_required).issuperset(parent_approval.intersection(actions)):
                raise PermissionError("delegation cannot remove required approval")
            if not set(delegable_actions).issubset(set(actions).intersection(parent_delegable)):
                raise PermissionError("delegated grant cannot broaden further delegation")
            if parent_transaction_actions.intersection(actions):
                if parent_max_transaction is None or parent_transaction_unit is None:
                    raise RuntimeError("parent transaction ceiling is inconsistent")
                if max_transaction_units is None:
                    child_max_transaction = parent_max_transaction
                else:
                    child_max_transaction = _integer(max_transaction_units, "max_transaction_units")
                    if child_max_transaction > parent_max_transaction:
                        raise PermissionError("delegation cannot increase transaction ceiling")
                if transaction_unit is not None and _unit(transaction_unit, "transaction_unit") != parent_transaction_unit:
                    raise PermissionError("delegation cannot change transaction unit")
                child_transaction_unit = parent_transaction_unit
            else:
                if max_transaction_units is not None or transaction_unit is not None:
                    raise ValueError("transaction ceiling requires transaction-limited actions")
                child_max_transaction = None
                child_transaction_unit = None

            delegate = self.db.execute(
                "SELECT b.tenant_id,b.owner_principal_id FROM ahaf_agent_bindings b "
                "JOIN principals p ON p.principal_id=b.owner_principal_id "
                "JOIN tenants t ON t.tenant_id=b.tenant_id AND t.owner_principal_id=p.principal_id "
                "JOIN tenant_memberships m ON m.tenant_id=t.tenant_id AND m.principal_id=p.principal_id "
                "LEFT JOIN ahaf_agent_binding_revocations r ON r.agent_id=b.agent_id "
                "WHERE b.agent_id=? AND r.agent_id IS NULL AND p.active=1 AND t.active=1 "
                "AND m.active=1 AND m.role='owner'",
                (delegate_agent_id,),
            ).fetchone()
            delegator = self.db.execute(
                "SELECT b.tenant_id,b.owner_principal_id FROM ahaf_agent_bindings b "
                "JOIN principals p ON p.principal_id=b.owner_principal_id "
                "JOIN tenants t ON t.tenant_id=b.tenant_id AND t.owner_principal_id=p.principal_id "
                "JOIN tenant_memberships m ON m.tenant_id=t.tenant_id AND m.principal_id=p.principal_id "
                "LEFT JOIN ahaf_agent_binding_revocations r ON r.agent_id=b.agent_id "
                "WHERE b.agent_id=? AND r.agent_id IS NULL AND p.active=1 AND t.active=1 "
                "AND m.active=1 AND m.role='owner'",
                (delegator_agent_id,),
            ).fetchone()
            if delegate is None or delegator is None:
                raise PermissionError("active bound delegator and delegate agents required")
            if delegate != delegator:
                raise PermissionError("delegated agents must share the same tenant owner")
            tenant_id, owner_id = delegate
            self.db.execute(
                "INSERT INTO ahaf_authority_grants "
                "(grant_id,subject_agent_id,issuer_type,issuer_id,parent_grant_id,policy_version,"
                "actions_json,resources_json,expires_at,budget_limit_units,budget_unit,"
                "max_transaction_units,transaction_unit,transaction_actions_json,"
                "approval_required_json,delegable_actions_json,delegation_depth,created_at) "
                "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (grant_id, delegate_agent_id, "agent", delegator_agent_id, parent_grant_id,
                 policy_version, json.dumps(actions), json.dumps(resources), expiry,
                 budget_limit_units, parent_unit, child_max_transaction, child_transaction_unit,
                 json.dumps(transaction_actions), json.dumps(approval_required),
                 json.dumps(delegable_actions), parent_depth - 1, created),
            )
            self._append_audit(
                actor_type="agent", actor_id=delegator_agent_id,
                agent_id=delegate_agent_id, tenant_id=tenant_id,
                grant_id=grant_id, policy_version=policy_version,
                decision="grant_delegated",
                payload={"parent_grant_id": parent_grant_id, "issuer_owner": owner_id,
                         "actions": actions, "resources": resources,
                         "budget_limit_units": budget_limit_units, "budget_unit": parent_unit,
                         "delegation_depth": parent_depth - 1},
            )
            self._finish()
            return grant_id
        except Exception as exc:
            self._finish(exc)
            raise

    def revoke_grant(self, actor_principal_id, grant_id, reason):
        actor_principal_id = _identifier(actor_principal_id, "actor_principal_id")
        grant_id = _identifier(grant_id, "grant_id")
        reason = _identifier(reason, "reason", 512)
        self._begin()
        try:
            row = self.db.execute(
                "SELECT g.subject_agent_id,b.tenant_id,b.owner_principal_id "
                "FROM ahaf_authority_grants g JOIN ahaf_agent_bindings b "
                "ON b.agent_id=g.subject_agent_id "
                "JOIN principals p ON p.principal_id=b.owner_principal_id "
                "JOIN tenants t ON t.tenant_id=b.tenant_id "
                "JOIN tenant_memberships m ON m.tenant_id=t.tenant_id AND m.principal_id=p.principal_id "
                "WHERE g.grant_id=? AND p.active=1 AND t.active=1 AND m.active=1 AND m.role='owner'",
                (grant_id,),
            ).fetchone()
            if row is None:
                self._finish()
                return False
            agent_id, tenant_id, owner_id = row
            if owner_id != actor_principal_id:
                raise PermissionError("workspace owner governance required to revoke grant")
            existing = self.db.execute(
                "SELECT 1 FROM ahaf_grant_revocations WHERE grant_id=?", (grant_id,)
            ).fetchone()
            if existing:
                self._finish()
                return False
            self.db.execute(
                "INSERT INTO ahaf_grant_revocations(grant_id,actor_principal_id,revoked_at,reason) "
                "VALUES (?,?,?,?)",
                (grant_id, actor_principal_id, datetime.now(timezone.utc).isoformat(), reason),
            )
            self._append_audit(
                actor_type="human", actor_id=actor_principal_id, agent_id=agent_id,
                tenant_id=tenant_id, grant_id=grant_id, policy_version="ahaf-store-0.1",
                decision="grant_revoked", payload={"reason": reason},
            )
            self._finish()
            return True
        except Exception as exc:
            self._finish(exc)
            raise

    def _grant_chain(self, grant_id, *, require_active=True):
        chain, seen, current_id = [], set(), grant_id
        now_text = datetime.now(timezone.utc).isoformat()
        while current_id is not None:
            if current_id in seen:
                raise RuntimeError("authority grant parent cycle detected")
            seen.add(current_id)
            row = self.db.execute(
                "SELECT g.grant_id,g.subject_agent_id,g.parent_grant_id,g.expires_at,"
                "g.budget_limit_units,g.budget_unit,b.tenant_id "
                "FROM ahaf_authority_grants g JOIN ahaf_agent_bindings b "
                "ON b.agent_id=g.subject_agent_id WHERE g.grant_id=?",
                (current_id,),
            ).fetchone()
            if row is None:
                raise PermissionError("complete authority grant chain required")
            (gid, subject, parent, expiry, limit_units, unit, tenant_id) = row
            if require_active:
                if expiry <= now_text:
                    raise PermissionError("expired authority grant")
                if self.db.execute(
                    "SELECT 1 FROM ahaf_grant_revocations WHERE grant_id=?", (gid,)
                ).fetchone():
                    raise PermissionError("revoked authority grant")
                if self.db.execute(
                    "SELECT 1 FROM ahaf_agent_binding_revocations WHERE agent_id=?", (subject,)
                ).fetchone():
                    raise PermissionError("revoked agent binding")
            chain.append({
                "grant_id": gid, "subject_agent_id": subject, "parent_grant_id": parent,
                "budget_limit_units": limit_units, "budget_unit": unit, "tenant_id": tenant_id,
            })
            current_id = parent
        return chain

    def grant_is_active(self, grant_id):
        try:
            self._grant_chain(grant_id, require_active=True)
            return True
        except PermissionError:
            return False

    def reserve_budget(self, grant_id, request_id, amount_units, unit_code):
        grant_id = _identifier(grant_id, "grant_id")
        request_id = _identifier(request_id, "request_id")
        amount_units = _integer(amount_units, "amount_units", 1)
        unit_code = _unit(unit_code)
        self._begin()
        try:
            existing = self.db.execute(
                "SELECT reservation_id,amount_units,unit_code FROM ahaf_budget_reservations "
                "WHERE leaf_grant_id=? AND request_id=?",
                (grant_id, request_id),
            ).fetchone()
            if existing:
                reservation_id, old_amount, old_unit = existing
                if old_amount != amount_units or old_unit != unit_code:
                    raise ValueError("request id was already used with different budget parameters")
                status = self._reservation_status(reservation_id)
                if status == "reserved":
                    self._grant_chain(grant_id, require_active=True)
                self._finish()
                return {"reservation_id": reservation_id, "status": status, "created": False}
            chain = self._grant_chain(grant_id, require_active=True)
            if not chain:
                raise PermissionError("authority grant required")
            for item in chain:
                if item["budget_unit"] != unit_code:
                    raise ValueError("budget unit must match every grant in the delegation chain")
                consumed = self.db.execute(
                    "SELECT COALESCE(SUM(CASE WHEN entry_type='reserve' THEN amount_units "
                    "WHEN entry_type='release' THEN -amount_units ELSE 0 END),0) "
                    "FROM ahaf_budget_ledger WHERE grant_id=?",
                    (item["grant_id"],),
                ).fetchone()[0]
                if consumed + amount_units > item["budget_limit_units"]:
                    raise PermissionError("cumulative grant budget exceeded")
            reservation_id = str(uuid4())
            created = datetime.now(timezone.utc).isoformat()
            self.db.execute(
                "INSERT INTO ahaf_budget_reservations "
                "(reservation_id,leaf_grant_id,request_id,amount_units,unit_code,created_at) "
                "VALUES (?,?,?,?,?,?)",
                (reservation_id, grant_id, request_id, amount_units, unit_code, created),
            )
            for item in chain:
                self.db.execute(
                    "INSERT INTO ahaf_budget_ledger "
                    "(reservation_id,grant_id,entry_type,amount_units,unit_code,idempotency_key,created_at) "
                    "VALUES (?,?,?,?,?,?,?)",
                    (reservation_id, item["grant_id"], "reserve", amount_units, unit_code,
                     f"reserve:{reservation_id}:{item['grant_id']}", created),
                )
            leaf = chain[0]
            self._append_audit(
                actor_type="system", actor_id="authority-store", agent_id=leaf["subject_agent_id"],
                tenant_id=leaf["tenant_id"], grant_id=grant_id, request_id=request_id,
                policy_version="ahaf-store-0.1", decision="budget_reserved",
                payload={"reservation_id": reservation_id, "amount_units": amount_units,
                         "unit_code": unit_code, "charged_grants": [x["grant_id"] for x in chain]},
            )
            self._finish()
            return {"reservation_id": reservation_id, "status": "reserved", "created": True}
        except Exception as exc:
            self._finish(exc)
            raise

    def _reservation_status(self, reservation_id):
        entries = self.db.execute(
            "SELECT DISTINCT entry_type FROM ahaf_budget_ledger WHERE reservation_id=?",
            (reservation_id,),
        ).fetchall()
        types = {row[0] for row in entries}
        if "commit" in types:
            return "committed"
        if "release" in types:
            return "released"
        return "reserved"

    def settle_reservation(self, reservation_id, outcome):
        reservation_id = _identifier(reservation_id, "reservation_id")
        if outcome not in ("commit", "release"):
            raise ValueError("outcome must be commit or release")
        self._begin()
        try:
            reservation = self.db.execute(
                "SELECT leaf_grant_id,request_id,amount_units,unit_code "
                "FROM ahaf_budget_reservations WHERE reservation_id=?",
                (reservation_id,),
            ).fetchone()
            if reservation is None:
                raise ValueError("unknown budget reservation")
            leaf_grant_id, request_id, amount_units, unit_code = reservation
            status = self._reservation_status(reservation_id)
            if (outcome == "commit" and status == "committed") or (
                outcome == "release" and status == "released"
            ):
                self._finish()
                return False
            if status != "reserved":
                raise ValueError("reservation already settled with a different outcome")
            chain = self._grant_chain(leaf_grant_id, require_active=False)
            reserve_grants = {
                row[0] for row in self.db.execute(
                    "SELECT grant_id FROM ahaf_budget_ledger "
                    "WHERE reservation_id=? AND entry_type='reserve'", (reservation_id,)
                )
            }
            if reserve_grants != {item["grant_id"] for item in chain}:
                raise RuntimeError("reservation grant ancestry no longer matches")
            created = datetime.now(timezone.utc).isoformat()
            for item in chain:
                self.db.execute(
                    "INSERT INTO ahaf_budget_ledger "
                    "(reservation_id,grant_id,entry_type,amount_units,unit_code,idempotency_key,created_at) "
                    "VALUES (?,?,?,?,?,?,?)",
                    (reservation_id, item["grant_id"], outcome, amount_units, unit_code,
                     f"{outcome}:{reservation_id}:{item['grant_id']}", created),
                )
            leaf = chain[0]
            self._append_audit(
                actor_type="system", actor_id="authority-store", agent_id=leaf["subject_agent_id"],
                tenant_id=leaf["tenant_id"], grant_id=leaf["grant_id"], request_id=request_id,
                policy_version="ahaf-store-0.1", decision="budget_"+outcome,
                payload={"reservation_id": reservation_id, "amount_units": amount_units,
                         "unit_code": unit_code},
            )
            self._finish()
            return True
        except Exception as exc:
            self._finish(exc)
            raise

    def budget_summary(self, grant_id):
        grant_id = _identifier(grant_id, "grant_id")
        row = self.db.execute(
            "SELECT budget_limit_units,budget_unit FROM ahaf_authority_grants WHERE grant_id=?",
            (grant_id,),
        ).fetchone()
        if row is None:
            raise ValueError("unknown authority grant")
        limit_units, unit_code = row
        values = self.db.execute(
            "SELECT COALESCE(SUM(CASE WHEN entry_type='reserve' THEN amount_units "
            "WHEN entry_type='release' THEN -amount_units ELSE 0 END),0), "
            "COALESCE(SUM(CASE WHEN entry_type='commit' THEN amount_units ELSE 0 END),0), "
            "COALESCE(SUM(CASE WHEN entry_type='reserve' THEN amount_units "
            "WHEN entry_type IN ('commit','release') THEN -amount_units ELSE 0 END),0) "
            "FROM ahaf_budget_ledger WHERE grant_id=?",
            (grant_id,),
        ).fetchone()
        consumed, committed, reserved = values
        return {
            "limit_units": limit_units, "consumed_units": consumed,
            "committed_units": committed, "reserved_units": reserved,
            "remaining_units": limit_units - consumed, "unit_code": unit_code,
        }
