"""Synthetic, fail-closed agent authority model for GALINYX AHAF.

This module demonstrates policy invariants only. It is not authentication,
cryptographic delegation, durable state, a sandbox, or a production policy engine.
"""
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from uuid import uuid4
from threading import RLock


RANKS = {
    "assistant": 1,
    "specialist": 2,
    "supervisor": 3,
    "manager": 4,
    "executive": 5,
}


def _id(value, label):
    if not isinstance(value, str) or not value.strip() or len(value) > 128:
        raise ValueError(f"{label} must be a nonempty string of at most 128 characters")
    return value


def _utc(value, label="timestamp"):
    if not isinstance(value, datetime) or value.tzinfo is None or value.utcoffset() is None:
        raise ValueError(f"{label} must be a timezone-aware datetime")
    return value.astimezone(timezone.utc)


def _money(value, label):
    try:
        result = Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError):
        raise ValueError(f"{label} must be a finite nonnegative decimal") from None
    if not result.is_finite() or result < 0:
        raise ValueError(f"{label} must be a finite nonnegative decimal")
    return result


@dataclass(frozen=True)
class Agent:
    agent_id: str
    rank: str
    role: str
    active: bool = True


@dataclass(frozen=True)
class AuthorityGrant:
    grant_id: str
    subject_id: str
    issuer_id: str
    actions: frozenset
    resources: frozenset
    expires_at: datetime
    max_transaction: Decimal | None
    transaction_actions: frozenset
    budget: Decimal
    delegable_actions: frozenset
    delegation_depth: int
    approval_required: frozenset
    parent_grant_id: str | None = None
    policy_version: str = "ahaf-0.1"


@dataclass(frozen=True)
class Decision:
    allowed: bool
    reason: str
    grant_id: str | None = None


class AuthorityPolicy:
    """In-memory policy harness. Governance actor IDs are trusted test inputs."""

    def __init__(self, governance_actors=()):
        self._governance = {_id(x, "governance_actor") for x in governance_actors}
        self._agents = {}
        self._grants = {}
        self._revoked = set()
        self.audit = []
        self._spent = {}
        self._lock = RLock()

    def register_agent(self, agent_id, rank, role):
        agent_id = _id(agent_id, "agent_id")
        if rank not in RANKS:
            raise ValueError("unknown rank")
        role = _id(role, "role")
        if agent_id in self._agents:
            raise ValueError("agent already exists")
        self._agents[agent_id] = Agent(agent_id, rank, role)
        self._record("agent.registered", agent_id=agent_id, rank=rank, role=role)
        return self._agents[agent_id]

    def set_rank(self, actor_id, target_id, rank):
        actor_id = _id(actor_id, "actor_id")
        target_id = _id(target_id, "target_id")
        if actor_id not in self._governance:
            raise PermissionError("trusted human governance authority required")
        if target_id not in self._agents or rank not in RANKS:
            raise ValueError("known agent and rank required")
        old = self._agents[target_id]
        self._agents[target_id] = Agent(old.agent_id, rank, old.role, old.active)
        self._record("agent.rank_changed", actor_id=actor_id, target_id=target_id,
                     old_rank=old.rank, new_rank=rank)
        return self._agents[target_id]

    def issue_grant(self, issuer_id, subject_id, actions, resources, expires_at,
                    budget, max_transaction=None, transaction_actions=(),
                    delegable_actions=(), delegation_depth=0, approval_required=()):
        issuer_id = _id(issuer_id, "issuer_id")
        subject_id = _id(subject_id, "subject_id")
        if issuer_id not in self._governance:
            raise PermissionError("only trusted governance may issue root grants")
        if subject_id not in self._agents or not self._agents[subject_id].active:
            raise ValueError("active subject agent required")
        actions = self._string_set(actions, "actions")
        resources = self._string_set(resources, "resources")
        delegable_actions = self._string_set(delegable_actions, "delegable_actions")
        approval_required = self._string_set(approval_required, "approval_required")
        transaction_actions = self._string_set(transaction_actions, "transaction_actions")
        if not actions or not resources or not delegable_actions.issubset(actions):
            raise ValueError("grant needs actions/resources; delegable actions must be granted actions")
        if not transaction_actions.issubset(actions):
            raise ValueError("transaction_actions must be a subset of granted actions")
        if not approval_required.issubset(actions):
            raise ValueError("approval_required must be a subset of granted actions")
        if transaction_actions and max_transaction is None:
            raise ValueError("transaction_actions require a max_transaction ceiling")
        if not isinstance(delegation_depth, int) or isinstance(delegation_depth, bool) or delegation_depth < 0:
            raise ValueError("delegation_depth must be a nonnegative integer")
        expiry = _utc(expires_at, "expires_at")
        budget_value = _money(budget, "budget")
        transaction = None if max_transaction is None else _money(max_transaction, "max_transaction")
        grant = AuthorityGrant(
            str(uuid4()), subject_id, issuer_id, actions, resources, expiry,
            transaction, transaction_actions, budget_value, delegable_actions, delegation_depth,
            approval_required, None
        )
        self._grants[grant.grant_id] = grant
        self._record("grant.issued", grant_id=grant.grant_id, issuer_id=issuer_id,
                     subject_id=subject_id, policy_version=grant.policy_version)
        return grant

    def delegate(self, parent_grant_id, delegator_id, delegate_id, actions, resources,
                 expires_at, budget, max_transaction=None, transaction_actions=(),
                 delegable_actions=(), approval_required=()):
        parent = self._grants.get(parent_grant_id)
        delegator_id = _id(delegator_id, "delegator_id")
        delegate_id = _id(delegate_id, "delegate_id")
        if parent is None or not self._grant_chain_active(parent_grant_id):
            raise PermissionError("active parent grant required")
        if parent.subject_id != delegator_id:
            raise PermissionError("delegator is not the grant subject")
        if parent.delegation_depth <= 0:
            raise PermissionError("delegation depth exhausted")
        if delegate_id not in self._agents or not self._agents[delegate_id].active:
            raise ValueError("active delegate agent required")
        requested_actions = self._string_set(actions, "actions")
        requested_resources = self._string_set(resources, "resources")
        requested_approval = self._string_set(approval_required, "approval_required")
        requested_transaction_actions = self._string_set(transaction_actions, "transaction_actions")
        requested_delegable_actions = self._string_set(delegable_actions, "delegable_actions")
        if delegate_id == delegator_id:
            raise PermissionError("an agent cannot delegate authority to itself")
        if not requested_actions or not requested_actions.issubset(parent.delegable_actions):
            raise PermissionError("delegation cannot add actions or exceed delegable actions")
        if not requested_delegable_actions.issubset(requested_actions.intersection(parent.delegable_actions)):
            raise PermissionError("delegated authority cannot add further delegable actions")
        required_transaction_actions = requested_actions.intersection(parent.transaction_actions)
        if not required_transaction_actions.issubset(requested_transaction_actions):
            raise PermissionError("delegation cannot remove transaction limits")
        if not requested_transaction_actions.issubset(requested_actions.intersection(parent.transaction_actions)):
            raise PermissionError("delegation cannot add transaction-limited actions")
        if not requested_approval.issubset(requested_actions):
            raise ValueError("approval_required must be a subset of delegated actions")
        if requested_transaction_actions and max_transaction is None and parent.max_transaction is None:
            raise PermissionError("transaction-limited actions require a transaction ceiling")
        if not requested_resources or not requested_resources.issubset(parent.resources):
            raise PermissionError("delegation cannot broaden resource scope")
        expiry = _utc(expires_at, "expires_at")
        if expiry > parent.expires_at:
            raise PermissionError("delegation cannot outlive parent grant")
        child_budget = _money(budget, "budget")
        if child_budget > parent.budget:
            raise PermissionError("delegation cannot increase budget")
        if parent.max_transaction is None:
            child_transaction = None if max_transaction is None else _money(max_transaction, "max_transaction")
        else:
            if max_transaction is None:
                child_transaction = parent.max_transaction
            else:
                child_transaction = _money(max_transaction, "max_transaction")
                if child_transaction > parent.max_transaction:
                    raise PermissionError("delegation cannot increase transaction ceiling")
        if not requested_approval.issuperset(parent.approval_required.intersection(requested_actions)):
            raise PermissionError("delegation cannot remove required human approval")
        grant = AuthorityGrant(
            str(uuid4()), delegate_id, delegator_id, requested_actions,
            requested_resources, expiry, child_transaction, requested_transaction_actions,
            child_budget, requested_delegable_actions, parent.delegation_depth - 1,
            requested_approval,
            parent_grant_id, parent.policy_version
        )
        self._grants[grant.grant_id] = grant
        self._record("grant.delegated", grant_id=grant.grant_id,
                     parent_grant_id=parent_grant_id, delegator_id=delegator_id,
                     delegate_id=delegate_id, policy_version=grant.policy_version)
        return grant

    def revoke(self, actor_id, grant_id):
        actor_id = _id(actor_id, "actor_id")
        grant = self._grants.get(grant_id)
        if actor_id not in self._governance:
            raise PermissionError("trusted human governance authority required")
        if grant is None:
            return False
        self._revoked.add(grant_id)
        self._record("grant.revoked", actor_id=actor_id, grant_id=grant_id)
        return True

    def authorize(self, agent_id, action, resource_id, now, cost=0,
                  transaction_amount=None, approved_by=None):
        agent_id = _id(agent_id, "agent_id")
        action = _id(action, "action")
        resource_id = _id(resource_id, "resource_id")
        instant = _utc(now, "now")
        cost_value = _money(cost, "cost")
        agent = self._agents.get(agent_id)
        if agent is None or not agent.active:
            return self._deny("unknown_or_inactive_agent")
        # Rank is intentionally not consulted here. It is organizational metadata,
        # never an authorization shortcut.
        candidates = [g for g in self._grants.values()
                      if g.subject_id == agent_id and action in g.actions
                      and resource_id in g.resources]
        with self._lock:
            for grant in reversed(candidates):
                chain = self._active_chain(grant.grant_id)
                if chain is None or instant >= grant.expires_at:
                    continue
                if action in grant.transaction_actions:
                    if transaction_amount is None:
                        continue
                    amount = _money(transaction_amount, "transaction_amount")
                    if grant.max_transaction is None or amount > grant.max_transaction:
                        continue
                elif transaction_amount is not None:
                    continue
                if action in grant.approval_required:
                    if approved_by not in self._governance or approved_by == agent_id:
                        continue
                # A grant budget is cumulative, not a per-request allowance.
                # Charge the selected grant and every ancestor so delegated
                # spending is included in the delegator's aggregate ceiling.
                if any(self._spent.get(item.grant_id, Decimal("0")) + cost_value > item.budget
                       for item in chain):
                    continue
                for item in chain:
                    self._spent[item.grant_id] = (
                        self._spent.get(item.grant_id, Decimal("0")) + cost_value
                    )
                self._record("authorization.allowed", agent_id=agent_id,
                             action=action, resource_id=resource_id,
                             grant_id=grant.grant_id, cost=str(cost_value),
                             policy_version=grant.policy_version)
                return Decision(True, "authorized", grant.grant_id)
        return self._deny("no_valid_grant_or_constraint_failed",
                          agent_id=agent_id, action=action, resource_id=resource_id)

    def _active_chain(self, grant_id):
        """Return leaf-to-root grants, or None if any link is missing/revoked."""
        seen = set()
        chain = []
        current_id = grant_id
        while current_id is not None:
            if current_id in seen or current_id in self._revoked:
                return None
            seen.add(current_id)
            current = self._grants.get(current_id)
            if current is None:
                return None
            chain.append(current)
            current_id = current.parent_grant_id
        return chain

    def _grant_chain_active(self, grant_id):
        return self._active_chain(grant_id) is not None

    @staticmethod
    def _string_set(values, label):
        if isinstance(values, (str, bytes)):
            raise ValueError(f"{label} must be an iterable of strings, not a string")
        try:
            result = frozenset(values)
        except TypeError:
            raise ValueError(f"{label} must be an iterable of strings") from None
        if any(not isinstance(x, str) or not x.strip() or len(x) > 128 for x in result):
            raise ValueError(f"{label} must contain nonempty strings of at most 128 characters")
        return result

    def _deny(self, reason, **details):
        self._record("authorization.denied", reason=reason, **details)
        return Decision(False, reason)

    def _record(self, event, **details):
        self.audit.append({"event": event, **details})
