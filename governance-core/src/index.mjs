import { createHash, randomUUID } from "node:crypto";

const TERMINAL = new Set(["approved", "rejected", "overridden"]);

function requireString(value, name) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${name} must be a non-empty string`);
  }
  return value.trim();
}

function isHuman(actor) {
  return actor?.principalType === "human" && actor?.active === true && typeof actor?.id === "string" && actor.id.trim() !== "";
}

function hasPermission(actor, permission) {
  return Array.isArray(actor?.permissions) && actor.permissions.includes(permission);
}

const REGISTRY_WRITE_TOKEN = Symbol("GALINYX_REGISTRY_WRITE");

const NEVER_DELEGABLE = new Set([
  "governance:delegate",
  "governance:override",
  "governance:authority:grant",
  "governance:delegation:revoke",
  "blackpine:owner:approve",
]);

function hasEffectivePermission(actor, permission, { registry, scope, now } = {}) {
  if (hasPermission(actor, permission)) return { allowed: true, source: "direct" };
  if (!(registry instanceof DelegationRegistry) || !scope) return { allowed: false, source: "none" };
  const grant = registry.findActive({ delegateId: actor?.id, permission, scope, now });
  return grant
    ? { allowed: true, source: "delegated", delegationId: grant.id }
    : { allowed: false, source: "none" };
}

function eventDigest(event) {
  return createHash("sha256").update(JSON.stringify(event)).digest("hex");
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

/**
 * A small in-memory, hash-linked ledger for development and tests.
 * This is tamper-evident only while the full chain and trusted head are protected.
 * It is not durable or immutable storage.
 */
export class AuditLedger {
  #events = [];

  append(input) {
    const previousHash = this.#events.at(-1)?.hash ?? "GENESIS";
    const snapshot = structuredClone(input);
    const body = {
      ...snapshot,
      sequence: this.#events.length + 1,
      previousHash,
      occurredAt: snapshot.occurredAt ?? new Date().toISOString(),
    };
    const hash = eventDigest(body);
    const event = deepFreeze({ ...body, hash });
    this.#events.push(event);
    return event;
  }

  list() {
    return this.#events.map((event) => structuredClone(event));
  }

  verify() {
    let previousHash = "GENESIS";
    for (let i = 0; i < this.#events.length; i += 1) {
      const { hash, ...body } = this.#events[i];
      if (body.sequence !== i + 1 || body.previousHash !== previousHash) return false;
      if (eventDigest(body) !== hash) return false;
      previousHash = hash;
    }
    return true;
  }
}

/**
 * Evaluate policy without granting authority.
 * Policy shape:
 * {
 *   id, version, permission, minimumLevel,
 *   requiredApprovals: number,
 *   approverPermission?: string,
 *   prohibitedConflicts?: string[]
 * }
 */
export function evaluateDecision({ request, requester, policy, delegationRegistry, now = new Date() }) {
  const reasons = [];
  if (!request || !policy) throw new TypeError("request and policy are required");
  if (!isHuman(requester)) reasons.push("REQUESTER_MUST_BE_ACTIVE_HUMAN");
  if (!request.id || !request.title) reasons.push("REQUEST_ID_AND_TITLE_REQUIRED");
  if (!policy.id || !policy.version || !policy.permission) reasons.push("POLICY_ID_VERSION_AND_PERMISSION_REQUIRED");
  if (!Number.isInteger(policy.minimumLevel) || policy.minimumLevel < 0) reasons.push("POLICY_MINIMUM_LEVEL_INVALID");
  if (!Number.isInteger(policy.requiredApprovals) || policy.requiredApprovals < 1) reasons.push("POLICY_REQUIRED_APPROVALS_INVALID");

  const requesterPermission = isHuman(requester) && policy.permission
    ? hasEffectivePermission(requester, policy.permission, { registry: delegationRegistry, scope: request.scope, now })
    : { allowed: false, source: "none" };
  if (isHuman(requester) && policy.permission && !requesterPermission.allowed) {
    reasons.push("REQUESTER_LACKS_PERMISSION");
  }
  if (isHuman(requester) && (!Number.isInteger(requester.level) || requester.level < 0)) {
    reasons.push("REQUESTER_LEVEL_INVALID");
  } else if (isHuman(requester) && Number.isInteger(policy.minimumLevel) && requester.level < policy.minimumLevel) {
    reasons.push("REQUESTER_LEVEL_INSUFFICIENT");
  }
  if (policy.prohibitedConflicts?.some((conflict) => requester?.conflicts?.includes(conflict))) {
    reasons.push("REQUESTER_HAS_PROHIBITED_CONFLICT");
  }
  const suppliedEvidence = Array.isArray(request.evidence) ? request.evidence : [];
  const requiredEvidence = [
    ...(Array.isArray(policy.requiredEvidence) ? policy.requiredEvidence : []),
    ...(request.claimsHandsOnTesting && Array.isArray(policy.handsOnEvidence) ? policy.handsOnEvidence : []),
  ];
  for (const evidenceType of requiredEvidence) {
    if (!suppliedEvidence.some((item) => item?.type === evidenceType && typeof item?.reference === "string" && item.reference.trim() !== "")) {
      reasons.push("REQUIRED_EVIDENCE_MISSING:" + evidenceType);
    }
  }

  return Object.freeze({
    decisionId: request.id,
    policyId: policy.id,
    policyVersion: policy.version,
    eligibleToSubmit: reasons.length === 0,
    reasons,
    status: reasons.length === 0 ? "pending_approval" : "blocked",
    requiredApprovals: policy.requiredApprovals,
    scope: request.scope ?? null,
    permissionSource: requesterPermission.source,
    delegationId: requesterPermission.delegationId ?? null,
  });
}

export function createDecision({ request, requester, policy, ledger, delegationRegistry, now = new Date() }) {
  if (!(ledger instanceof AuditLedger)) throw new TypeError("ledger must be an AuditLedger");
  const evaluation = evaluateDecision({ request, requester, policy, delegationRegistry, now });
  const decision = {
    ...evaluation,
    title: request.title,
    requesterId: requester?.id ?? null,
    approvals: [],
    createdAt: new Date().toISOString(),
  };
  ledger.append({
    type: "decision_created",
    decisionId: decision.decisionId,
    actorId: requester?.id ?? null,
    status: decision.status,
    policyId: policy.id,
    policyVersion: policy.version,
    scope: decision.scope,
    permissionSource: decision.permissionSource,
    delegationId: decision.delegationId,
    reasons: [...decision.reasons],
  });
  return decision;
}

export function recordApproval({ decision, approver, policy, ledger, delegationRegistry, now = new Date() }) {
  if (!(ledger instanceof AuditLedger)) throw new TypeError("ledger must be an AuditLedger");
  if (TERMINAL.has(decision.status)) throw new Error("TERMINAL_DECISION_CANNOT_BE_CHANGED");
  if (decision.status !== "pending_approval") throw new Error("DECISION_NOT_ELIGIBLE_FOR_APPROVAL");
  if (!isHuman(approver)) throw new Error("APPROVER_MUST_BE_ACTIVE_HUMAN");
  if (approver.id === decision.requesterId) throw new Error("SELF_APPROVAL_PROHIBITED");
  if (decision.delegationId && delegationRegistry) {
    const sourceGrant = delegationRegistry.get(decision.delegationId);
    if (sourceGrant?.delegatorId === approver.id) {
      throw new Error("DELEGATION_GRANTOR_CANNOT_APPROVE");
    }
  }
  const approvalPermission = policy.approverPermission ?? policy.permission;
  const approverPermission = hasEffectivePermission(approver, approvalPermission, {
    registry: delegationRegistry, scope: decision.scope, now,
  });
  if (!approverPermission.allowed) throw new Error("APPROVER_LACKS_PERMISSION");
  if (!Number.isInteger(approver.level) || approver.level < 0) throw new Error("APPROVER_LEVEL_INVALID");
  if (!Number.isInteger(policy.minimumLevel) || approver.level < policy.minimumLevel) throw new Error("APPROVER_LEVEL_INSUFFICIENT");
  if (decision.approvals.some((approval) => approval.approverId === approver.id)) {
    throw new Error("DUPLICATE_APPROVAL_PROHIBITED");
  }
  const conflicts = policy.prohibitedConflicts ?? [];
  if (conflicts.some((conflict) => approver.conflicts?.includes(conflict))) {
    throw new Error("APPROVER_HAS_PROHIBITED_CONFLICT");
  }

  decision.approvals.push({
    approverId: approver.id,
    rank: approver.rank ?? null,
    level: approver.level,
    permissionSource: approverPermission.source,
    delegationId: approverPermission.delegationId ?? null,
    approvedAt: new Date().toISOString(),
  });
  if (decision.approvals.length >= decision.requiredApprovals) decision.status = "approved";
  ledger.append({
    type: "approval_recorded",
    decisionId: decision.decisionId,
    actorId: approver.id,
    permissionSource: approverPermission.source,
    delegationId: approverPermission.delegationId ?? null,
    approvalCount: decision.approvals.length,
    status: decision.status,
  });
  return decision;
}

export function rejectDecision({ decision, actor, reason, ledger }) {
  if (!(ledger instanceof AuditLedger)) throw new TypeError("ledger must be an AuditLedger");
  if (!isHuman(actor)) throw new Error("REJECTION_REQUIRES_ACTIVE_HUMAN");
  if (TERMINAL.has(decision.status)) throw new Error("TERMINAL_DECISION_CANNOT_BE_CHANGED");
  const detail = requireString(reason, "reason");
  decision.status = "rejected";
  ledger.append({ type: "decision_rejected", decisionId: decision.decisionId, actorId: actor.id, reason: detail });
  return decision;
}

export function overrideDecision({ decision, human, reason, ledger }) {
  if (!(ledger instanceof AuditLedger)) throw new TypeError("ledger must be an AuditLedger");
  if (!isHuman(human)) throw new Error("OVERRIDE_REQUIRES_ACTIVE_HUMAN");
  if (!hasPermission(human, "governance:override")) throw new Error("OVERRIDE_PERMISSION_REQUIRED");
  const detail = requireString(reason, "reason");
  const previousStatus = decision.status;
  decision.status = "overridden";
  decision.override = {
    actorId: human.id,
    reason: detail,
    previousStatus,
    occurredAt: new Date().toISOString(),
  };
  ledger.append({
    type: "human_override",
    decisionId: decision.decisionId,
    actorId: human.id,
    reason: detail,
    previousStatus,
    status: "overridden",
  });
  return decision;
}


/**
 * In-memory delegation registry for development and tests only.
 * Grants are single-hop, exact-scope, permission-bounded, and time-limited.
 */
export class DelegationRegistry {
  #grants = new Map();

  add(grant, token) {
    if (token !== REGISTRY_WRITE_TOKEN) throw new Error("REGISTRY_WRITE_NOT_AUTHORIZED");
    if (this.#grants.has(grant.id)) throw new Error("DUPLICATE_DELEGATION_ID");
    this.#grants.set(grant.id, deepFreeze(structuredClone(grant)));
    return structuredClone(grant);
  }

  get(id) {
    const grant = this.#grants.get(id);
    return grant ? structuredClone(grant) : null;
  }

  list() {
    return [...this.#grants.values()].map((grant) => structuredClone(grant));
  }

  findActive({ delegateId, permission, scope, now = new Date() }) {
    const timestamp = new Date(now).getTime();
    for (const grant of this.#grants.values()) {
      if (
        grant.delegateId === delegateId &&
        grant.permissions.includes(permission) &&
        grant.scope === scope &&
        !grant.revokedAt &&
        new Date(grant.expiresAt).getTime() > timestamp
      ) return structuredClone(grant);
    }
    return null;
  }

  revoke(id, actor, reason, ledger, token) {
    if (token !== REGISTRY_WRITE_TOKEN) throw new Error("REGISTRY_WRITE_NOT_AUTHORIZED");
    if (!isHuman(actor)) throw new Error("DELEGATION_REVOCATION_REQUIRES_ACTIVE_HUMAN");
    const grant = this.#grants.get(id);
    if (!grant) throw new Error("DELEGATION_NOT_FOUND");
    if (grant.revokedAt) throw new Error("DELEGATION_ALREADY_REVOKED");
    if (actor.id !== grant.delegatorId && !hasPermission(actor, "governance:delegation:revoke")) {
      throw new Error("DELEGATION_REVOCATION_PERMISSION_REQUIRED");
    }
    const detail = requireString(reason, "reason");
    const updated = deepFreeze({
      ...grant,
      revokedAt: new Date().toISOString(),
      revokedBy: actor.id,
      revocationReason: detail,
    });
    this.#grants.set(id, updated);
    ledger.append({ type: "delegation_revoked", delegationId: id, actorId: actor.id, reason: detail });
    return structuredClone(updated);
  }
}

export function grantDelegation({
  delegator, delegate, permissions, scope, expiresAt, reason,
  registry, ledger, policy = {}, now = new Date(),
}) {
  if (!(registry instanceof DelegationRegistry)) throw new TypeError("registry must be a DelegationRegistry");
  if (!(ledger instanceof AuditLedger)) throw new TypeError("ledger must be an AuditLedger");
  if (!isHuman(delegator) || !isHuman(delegate)) throw new Error("DELEGATION_REQUIRES_ACTIVE_HUMANS");
  if (delegator.id === delegate.id) throw new Error("SELF_DELEGATION_PROHIBITED");
  if (!hasPermission(delegator, "governance:delegate")) throw new Error("DELEGATION_GRANT_PERMISSION_REQUIRED");
  if (!Array.isArray(permissions) || permissions.length === 0) throw new Error("DELEGATION_PERMISSIONS_REQUIRED");
  if (new Set(permissions).size !== permissions.length) throw new Error("DUPLICATE_DELEGATED_PERMISSION");
  if (permissions.some((permission) => typeof permission !== "string" || permission.trim() === "")) {
    throw new Error("INVALID_DELEGATED_PERMISSION");
  }
  const prohibited = new Set([...NEVER_DELEGABLE, ...(policy.nonDelegablePermissions ?? [])]);
  if (permissions.some((permission) => prohibited.has(permission))) {
    throw new Error("NON_DELEGABLE_PERMISSION_REQUESTED");
  }
  if (permissions.some((permission) => !hasPermission(delegator, permission))) {
    throw new Error("DELEGATOR_CANNOT_DELEGATE_UNHELD_PERMISSION");
  }
  const normalizedScope = requireString(scope, "scope");
  const detail = requireString(reason, "reason");
  const expiry = new Date(expiresAt);
  const current = new Date(now);
  if (!Number.isFinite(expiry.getTime()) || !Number.isFinite(current.getTime()) || expiry <= current) {
    throw new Error("DELEGATION_EXPIRY_MUST_BE_FUTURE");
  }
  const grant = {
    id: randomUUID(),
    delegatorId: delegator.id,
    delegateId: delegate.id,
    permissions: [...permissions],
    scope: normalizedScope,
    issuedAt: current.toISOString(),
    expiresAt: expiry.toISOString(),
    reason: detail,
    revokedAt: null,
    revokedBy: null,
    revocationReason: null,
    subdelegationAllowed: false,
    authoritySource: "human_grant",
  };
  registry.add(grant, REGISTRY_WRITE_TOKEN);
  ledger.append({
    type: "delegation_granted",
    delegationId: grant.id,
    delegatorId: delegator.id,
    delegateId: delegate.id,
    permissions: grant.permissions,
    scope: grant.scope,
    expiresAt: grant.expiresAt,
    reason: detail,
  });
  return structuredClone(grant);
}

export function revokeDelegation({ delegationId, actor, reason, registry, ledger }) {
  if (!(registry instanceof DelegationRegistry)) throw new TypeError("registry must be a DelegationRegistry");
  if (!(ledger instanceof AuditLedger)) throw new TypeError("ledger must be an AuditLedger");
  if (!isHuman(actor)) throw new Error("DELEGATION_REVOCATION_REQUIRES_ACTIVE_HUMAN");
  return registry.revoke(delegationId, actor, reason, ledger, REGISTRY_WRITE_TOKEN);
}

export function resolveDelegatedAuthority({ actor, permission, scope, registry, now = new Date() }) {
  if (!isHuman(actor)) return Object.freeze({ allowed: false, reason: "ACTIVE_HUMAN_REQUIRED" });
  if (hasPermission(actor, permission)) return Object.freeze({ allowed: true, source: "direct", delegationId: null });
  if (!(registry instanceof DelegationRegistry)) {
    return Object.freeze({ allowed: false, reason: "NO_DELEGATION_REGISTRY" });
  }
  const grant = registry.findActive({ delegateId: actor.id, permission, scope, now });
  return grant
    ? Object.freeze({ allowed: true, source: "delegated", delegationId: grant.id, delegatorId: grant.delegatorId })
    : Object.freeze({ allowed: false, reason: "NO_ACTIVE_SCOPED_DELEGATION" });
}
