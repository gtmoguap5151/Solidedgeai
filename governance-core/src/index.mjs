import { createHash, randomUUID } from "node:crypto";
import { AuthorityRegistry, isVerifiedPrincipal } from "./authority-registry.mjs";

const TERMINAL = new Set(["approved", "rejected", "overridden"]);
const decisionStates = new WeakMap();
const decisionInputs = new WeakMap();

function getDecisionState(handle) {
  const state = decisionStates.get(handle);
  if (!state) throw new Error("UNTRUSTED_DECISION_HANDLE");
  return state;
}

function createDecisionHandle(state) {
  const handle = {};
  for (const key of Object.keys(state)) {
    Object.defineProperty(handle, key, {
      enumerable: true,
      configurable: false,
      get: () => structuredClone(state[key]),
    });
  }
  Object.freeze(handle);
  decisionStates.set(handle, state);
  return handle;
}

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

function actorLevel(actor, policy, authorityRegistry, now = new Date()) {
  const domain = policy?.levelDomain ?? "general";
  if (isVerifiedPrincipal(actor)) {
    if (!(authorityRegistry instanceof AuthorityRegistry)) return null;
    return authorityRegistry.getActiveCompetencyLevel({
      subjectId: actor.id, domain, now,
    });
  }
  if (policy?.levelDomain) return actor?.levels?.[policy.levelDomain];
  return actor?.level;
}

const REGISTRY_WRITE_TOKEN = Symbol("GALINYX_REGISTRY_WRITE");

const NEVER_DELEGABLE = new Set([
  "governance:delegate",
  "governance:override",
  "governance:authority:grant",
  "governance:delegation:revoke",
  "blackpine:owner:approve",
]);

function hasEffectivePermission(actor, permission, { registry, authorityRegistry, scope, now } = {}) {
  if (isVerifiedPrincipal(actor)) {
    if (!(authorityRegistry instanceof AuthorityRegistry)) return { allowed: false, source: "none" };
    const grant = authorityRegistry.findActivePermissionGrant({
      subjectId: actor.id, permission, scope, now,
    });
    if (grant) return { allowed: true, source: "authority-grant", authorityGrantId: grant.id };
  } else if (hasPermission(actor, permission)) {
    return { allowed: true, source: "direct" };
  }
  if (!(registry instanceof DelegationRegistry) || !scope) return { allowed: false, source: "none" };
  const grant = registry.findActive({ delegateId: actor?.id, permission, scope, now });
  return grant
    ? { allowed: true, source: "delegated", delegationId: grant.id }
    : { allowed: false, source: "none" };
}

function eventDigest(event) {
  return createHash("sha256").update(JSON.stringify(event)).digest("hex");
}

function stableSerialize(value) {
  if (Array.isArray(value)) return "[" + value.map(stableSerialize).join(",") + "]";
  if (value && typeof value === "object") {
    return "{" + Object.keys(value).sort().map((key) =>
      JSON.stringify(key) + ":" + stableSerialize(value[key])
    ).join(",") + "}";
  }
  return JSON.stringify(value);
}

function policyDigest(policy) {
  return createHash("sha256").update(stableSerialize(policy)).digest("hex");
}

function evidenceForReview(evidence) {
  if (!Array.isArray(evidence)) return [];
  return evidence.map((item) => ({
    type: typeof item?.type === "string" ? item.type : null,
    reference: typeof item?.reference === "string" ? item.reference : null,
    observedAt: typeof item?.observedAt === "string" ? item.observedAt : null,
    expiresAt: typeof item?.expiresAt === "string" ? item.expiresAt : null,
    contentSha256: typeof item?.contentSha256 === "string" ? item.contentSha256 : null,
    verifiedBy: typeof item?.verifiedBy === "string" ? item.verifiedBy : null,
    verifiedAt: typeof item?.verifiedAt === "string" ? item.verifiedAt : null,
  }));
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
export function evaluateDecision({ request, requester, policy, delegationRegistry, authorityRegistry, now = new Date() }) {
  const reasons = [];
  if (!request || !policy) throw new TypeError("request and policy are required");
  if (!isHuman(requester)) reasons.push("REQUESTER_MUST_BE_ACTIVE_HUMAN");
  if (policy.requireVerifiedIdentity === true && !isVerifiedPrincipal(requester)) {
    reasons.push("REQUESTER_IDENTITY_NOT_VERIFIED");
  }
  if (policy.requireVerifiedIdentity === true && !(authorityRegistry instanceof AuthorityRegistry)) {
    reasons.push("AUTHORITY_REGISTRY_REQUIRED");
  }
  if (typeof request.id !== "string" || request.id.trim() === "" ||
      typeof request.title !== "string" || request.title.trim() === "") {
    reasons.push("REQUEST_ID_AND_TITLE_REQUIRED");
  }
  if (typeof policy.id !== "string" || policy.id.trim() === "" ||
      typeof policy.version !== "string" || policy.version.trim() === "" ||
      typeof policy.permission !== "string" || policy.permission.trim() === "") {
    reasons.push("POLICY_ID_VERSION_AND_PERMISSION_REQUIRED");
  }
  if (policy.approverPermission !== undefined &&
      (typeof policy.approverPermission !== "string" || policy.approverPermission.trim() === "")) {
    reasons.push("POLICY_APPROVER_PERMISSION_INVALID");
  }
  if (policy.prohibitedConflicts !== undefined && !Array.isArray(policy.prohibitedConflicts)) {
    reasons.push("POLICY_CONFLICTS_INVALID");
  }
  if (policy.requiredEvidence !== undefined && !Array.isArray(policy.requiredEvidence)) {
    reasons.push("POLICY_REQUIRED_EVIDENCE_INVALID");
  }
  if (policy.handsOnEvidence !== undefined && !Array.isArray(policy.handsOnEvidence)) {
    reasons.push("POLICY_HANDS_ON_EVIDENCE_INVALID");
  }
  if (policy.evidenceFreshness !== undefined) {
    if (!policy.evidenceFreshness || typeof policy.evidenceFreshness !== "object" ||
        Array.isArray(policy.evidenceFreshness)) {
      reasons.push("POLICY_EVIDENCE_FRESHNESS_INVALID");
    } else {
      for (const [evidenceType, rule] of Object.entries(policy.evidenceFreshness)) {
        if (!evidenceType || !rule || typeof rule !== "object" ||
            !Number.isFinite(rule.maxAgeHours) || rule.maxAgeHours <= 0 ||
            (rule.requireExpiresAt !== undefined && typeof rule.requireExpiresAt !== "boolean")) {
          reasons.push("POLICY_EVIDENCE_FRESHNESS_INVALID");
          break;
        }
      }
    }
  }
  if (policy.requireEvidenceReview !== undefined && typeof policy.requireEvidenceReview !== "boolean") {
    reasons.push("POLICY_EVIDENCE_REVIEW_INVALID");
  }
  if (request.scope !== undefined && (typeof request.scope !== "string" || request.scope.trim() === "")) {
    reasons.push("REQUEST_SCOPE_INVALID");
  }
  if (request.evidence !== undefined && !Array.isArray(request.evidence)) {
    reasons.push("REQUEST_EVIDENCE_INVALID");
  }
  if (!Number.isInteger(policy.minimumLevel) || policy.minimumLevel < 0) reasons.push("POLICY_MINIMUM_LEVEL_INVALID");
  if (policy.levelDomain !== undefined && (typeof policy.levelDomain !== "string" || policy.levelDomain.trim() === "")) {
    reasons.push("POLICY_LEVEL_DOMAIN_INVALID");
  }
  if (!Number.isInteger(policy.requiredApprovals) || policy.requiredApprovals < 1) reasons.push("POLICY_REQUIRED_APPROVALS_INVALID");

  const requesterPermission = isHuman(requester) && policy.permission
    ? hasEffectivePermission(requester, policy.permission, { registry: delegationRegistry, authorityRegistry, scope: request.scope, now })
    : { allowed: false, source: "none" };
  if (isHuman(requester) && policy.permission && !requesterPermission.allowed) {
    reasons.push("REQUESTER_LACKS_PERMISSION");
  }
  const requesterLevel = actorLevel(requester, policy, authorityRegistry, now);
  if (isHuman(requester) && (!Number.isInteger(requesterLevel) || requesterLevel < 0)) {
    reasons.push(policy.levelDomain ? "REQUESTER_DOMAIN_LEVEL_INVALID" : "REQUESTER_LEVEL_INVALID");
  } else if (isHuman(requester) && Number.isInteger(policy.minimumLevel) && requesterLevel < policy.minimumLevel) {
    reasons.push("REQUESTER_LEVEL_INSUFFICIENT");
  }
  if ((Array.isArray(policy.prohibitedConflicts) ? policy.prohibitedConflicts : [])
    .some((conflict) => requester?.conflicts?.includes(conflict))) {
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
  if (policy.evidenceFreshness && typeof policy.evidenceFreshness === "object" &&
      !Array.isArray(policy.evidenceFreshness)) {
    const evaluationTime = now instanceof Date ? now.getTime() : Number.NaN;
    for (const [evidenceType, rule] of Object.entries(policy.evidenceFreshness)) {
      if (!rule || typeof rule !== "object" || !Number.isFinite(rule.maxAgeHours) ||
          rule.maxAgeHours <= 0) continue;
      const matchingEvidence = suppliedEvidence.filter((item) =>
        item?.type === evidenceType &&
        typeof item?.reference === "string" &&
        item.reference.trim() !== ""
      );
      for (const item of matchingEvidence) {
        const observedAt = typeof item.observedAt === "string"
          ? Date.parse(item.observedAt)
          : Number.NaN;
        if (!Number.isFinite(observedAt)) {
          reasons.push("EVIDENCE_OBSERVED_AT_REQUIRED:" + evidenceType);
        } else if (!Number.isFinite(evaluationTime)) {
          reasons.push("POLICY_EVALUATION_TIME_INVALID");
        } else if (observedAt > evaluationTime) {
          reasons.push("EVIDENCE_OBSERVED_AT_IN_FUTURE:" + evidenceType);
        } else if (evaluationTime - observedAt > rule.maxAgeHours * 60 * 60 * 1000) {
          reasons.push("EVIDENCE_STALE:" + evidenceType);
        }
        if (rule.requireExpiresAt === true) {
          const expiresAt = typeof item.expiresAt === "string"
            ? Date.parse(item.expiresAt)
            : Number.NaN;
          if (!Number.isFinite(expiresAt)) {
            reasons.push("EVIDENCE_EXPIRY_REQUIRED:" + evidenceType);
          } else if (Number.isFinite(evaluationTime) && expiresAt <= evaluationTime) {
            reasons.push("EVIDENCE_EXPIRED:" + evidenceType);
          } else if (Number.isFinite(observedAt) && expiresAt < observedAt) {
            reasons.push("EVIDENCE_EXPIRY_BEFORE_OBSERVATION:" + evidenceType);
          }
        }
      }
    }
  }

  return Object.freeze({
    decisionId: request.id,
    policyId: policy.id,
    policyVersion: policy.version,
    policyDigest: policyDigest(policy),
    permission: policy.permission,
    requireVerifiedIdentity: policy.requireVerifiedIdentity === true,
    eligibleToSubmit: reasons.length === 0,
    reasons,
    status: reasons.length === 0 ? "pending_approval" : "blocked",
    requiredApprovals: policy.requiredApprovals,
    levelDomain: policy.levelDomain ?? "general",
    requesterLevel: Number.isInteger(requesterLevel) ? requesterLevel : null,
    scope: request.scope ?? null,
    permissionSource: requesterPermission.source,
    delegationId: requesterPermission.delegationId ?? null,
    authorityGrantId: requesterPermission.authorityGrantId ?? null,
  });
}

export function createDecision({ request, requester, policy, ledger, delegationRegistry, authorityRegistry, now = new Date() }) {
  if (!(ledger instanceof AuditLedger)) throw new TypeError("ledger must be an AuditLedger");
  const evaluation = evaluateDecision({ request, requester, policy, delegationRegistry, authorityRegistry, now });
  const evidence = evidenceForReview(request.evidence);
  const evidenceDigest = createHash("sha256").update(stableSerialize(evidence)).digest("hex");
  const state = {
    ...evaluation,
    title: request.title,
    requesterId: requester?.id ?? null,
    evidence,
    evidenceDigest,
    approvals: [],
    createdAt: new Date().toISOString(),
  };
  const decision = createDecisionHandle(state);
  decisionInputs.set(decision, {
    request: structuredClone(request),
    requester: structuredClone(requester),
  });
  ledger.append({
    type: "decision_created",
    decisionId: state.decisionId,
    actorId: requester?.id ?? null,
    status: state.status,
    policyId: policy.id,
    policyVersion: policy.version,
    policyDigest: state.policyDigest,
    evidenceDigest: state.evidenceDigest,
    evidenceCount: state.evidence.length,
    evidenceTypes: state.evidence.map((item) => item.type),
    scope: state.scope,
    permissionSource: state.permissionSource,
    delegationId: state.delegationId,
    authorityGrantId: state.authorityGrantId,
    reasons: [...state.reasons],
  });
  return decision;
}

export function recordApproval({ decision, approver, policy, ledger, delegationRegistry, authorityRegistry, reviewedEvidenceDigest, now = new Date() }) {
  if (!(ledger instanceof AuditLedger)) throw new TypeError("ledger must be an AuditLedger");
  const state = getDecisionState(decision);
  if (TERMINAL.has(state.status)) throw new Error("TERMINAL_DECISION_CANNOT_BE_CHANGED");
  if (state.status !== "pending_approval") throw new Error("DECISION_NOT_ELIGIBLE_FOR_APPROVAL");
  if (state.policyId !== policy.id ||
      state.policyVersion !== policy.version ||
      state.policyDigest !== policyDigest(policy) ||
      state.permission !== policy.permission ||
      state.requiredApprovals !== policy.requiredApprovals ||
      state.levelDomain !== (policy.levelDomain ?? "general")) {
    throw new Error("DECISION_POLICY_MISMATCH");
  }
  if (!isHuman(approver)) throw new Error("APPROVER_MUST_BE_ACTIVE_HUMAN");
  if (policy.requireVerifiedIdentity === true && !(authorityRegistry instanceof AuthorityRegistry)) {
    throw new Error("AUTHORITY_REGISTRY_REQUIRED_FOR_APPROVAL");
  }
  if (policy.requireVerifiedIdentity === true && !isVerifiedPrincipal(approver)) {
    throw new Error("APPROVER_IDENTITY_NOT_VERIFIED");
  }
  if (approver.id === state.requesterId) throw new Error("SELF_APPROVAL_PROHIBITED");
  if (state.permissionSource === "authority-grant") {
    if (!(authorityRegistry instanceof AuthorityRegistry)) {
      throw new Error("AUTHORITY_REGISTRY_REQUIRED_FOR_APPROVAL");
    }
    const sourceGrant = authorityRegistry.findActivePermissionGrant({
      subjectId: state.requesterId,
      permission: state.permission,
      scope: state.scope,
      grantId: state.authorityGrantId,
      now,
    });
    if (!sourceGrant) throw new Error("REQUESTER_AUTHORITY_GRANT_NO_LONGER_ACTIVE");
  }
  if (state.permissionSource === "delegated") {
    if (!(delegationRegistry instanceof DelegationRegistry)) {
      throw new Error("DELEGATION_REGISTRY_REQUIRED_FOR_APPROVAL");
    }
    const sourceGrant = delegationRegistry.findActive({
      delegateId: state.requesterId,
      permission: state.permission,
      scope: state.scope,
      now,
    });
    if (!sourceGrant || sourceGrant.id !== state.delegationId) {
      throw new Error("DELEGATED_AUTHORITY_NO_LONGER_ACTIVE");
    }
    if (sourceGrant.delegatorId === approver.id) {
      throw new Error("DELEGATION_GRANTOR_CANNOT_APPROVE");
    }
  }
  const approvalPermission = policy.approverPermission ?? policy.permission;
  const approverPermission = hasEffectivePermission(approver, approvalPermission, {
    registry: delegationRegistry, authorityRegistry, scope: state.scope, now,
  });
  if (!approverPermission.allowed) throw new Error("APPROVER_LACKS_PERMISSION");
  const approverLevel = actorLevel(approver, policy, authorityRegistry, now);
  if (!Number.isInteger(approverLevel) || approverLevel < 0) {
    throw new Error(policy.levelDomain ? "APPROVER_DOMAIN_LEVEL_INVALID" : "APPROVER_LEVEL_INVALID");
  }
  if (!Number.isInteger(policy.minimumLevel) || approverLevel < policy.minimumLevel) throw new Error("APPROVER_LEVEL_INSUFFICIENT");
  if (state.approvals.some((approval) => approval.approverId === approver.id)) {
    throw new Error("DUPLICATE_APPROVAL_PROHIBITED");
  }
  const conflicts = policy.prohibitedConflicts ?? [];
  if (conflicts.some((conflict) => approver.conflicts?.includes(conflict))) {
    throw new Error("APPROVER_HAS_PROHIBITED_CONFLICT");
  }

  if (policy.evidenceFreshness !== undefined) {
    const original = decisionInputs.get(decision);
    if (original) {
      const currentEvaluation = evaluateDecision({
        request: original.request,
        requester: original.requester,
        policy,
        delegationRegistry,
        authorityRegistry,
        now,
      });
      const freshnessFailures = currentEvaluation.reasons.filter((reason) =>
        reason.startsWith("EVIDENCE_") ||
        reason === "POLICY_EVALUATION_TIME_INVALID" ||
        reason === "POLICY_EVIDENCE_FRESHNESS_INVALID"
      );
      if (freshnessFailures.length > 0) {
        state.status = "blocked";
        state.reasons = [...new Set([...state.reasons, ...freshnessFailures])];
        ledger.append({
          type: "decision_blocked_at_approval",
          decisionId: state.decisionId,
          actorId: approver.id,
          policyDigest: state.policyDigest,
          reasons: freshnessFailures,
        });
        throw new Error("DECISION_EVIDENCE_NO_LONGER_VALID");
      }
    }
  }

  if (policy.requireEvidenceReview === true) {
    if (typeof reviewedEvidenceDigest !== "string" || reviewedEvidenceDigest.trim() === "") {
      throw new Error("EVIDENCE_REVIEW_ACKNOWLEDGEMENT_REQUIRED");
    }
    if (reviewedEvidenceDigest !== state.evidenceDigest) {
      throw new Error("EVIDENCE_REVIEW_DIGEST_MISMATCH");
    }
  }

  state.approvals.push({
    approverId: approver.id,
    evidenceDigest: state.evidenceDigest,
    rank: approver.rank ?? null,
    level: approverLevel,
    levelDomain: policy.levelDomain ?? "general",
    permissionSource: approverPermission.source,
    delegationId: approverPermission.delegationId ?? null,
    authorityGrantId: approverPermission.authorityGrantId ?? null,
    approvedAt: new Date().toISOString(),
  });
  if (state.approvals.length >= state.requiredApprovals) state.status = "approved";
  ledger.append({
    type: "approval_recorded",
    decisionId: state.decisionId,
    actorId: approver.id,
    policyDigest: state.policyDigest,
    evidenceDigest: state.evidenceDigest,
    permissionSource: approverPermission.source,
    delegationId: approverPermission.delegationId ?? null,
    authorityGrantId: approverPermission.authorityGrantId ?? null,
    approvalCount: state.approvals.length,
    status: state.status,
  });
  return decision;
}

export function rejectDecision({ decision, actor, reason, ledger, policy, authorityRegistry, now = new Date() }) {
  if (!(ledger instanceof AuditLedger)) throw new TypeError("ledger must be an AuditLedger");
  const state = getDecisionState(decision);
  if (!isHuman(actor)) throw new Error("REJECTION_REQUIRES_ACTIVE_HUMAN");
  if (policy?.requireVerifiedIdentity === true && !(authorityRegistry instanceof AuthorityRegistry)) {
    throw new Error("AUTHORITY_REGISTRY_REQUIRED_FOR_REJECTION");
  }
  if (policy?.requireVerifiedIdentity === true && !isVerifiedPrincipal(actor)) {
    throw new Error("REJECTOR_IDENTITY_NOT_VERIFIED");
  }
  if (TERMINAL.has(state.status)) throw new Error("TERMINAL_DECISION_CANNOT_BE_CHANGED");
  if (!policy || state.policyId !== policy.id || state.policyVersion !== policy.version ||
      state.policyDigest !== policyDigest(policy) ||
      state.permission !== policy.permission || state.levelDomain !== (policy.levelDomain ?? "general")) {
    throw new Error("DECISION_POLICY_MISMATCH");
  }
  const rejectionPermission = policy.rejectionPermission ?? policy.approverPermission ?? policy.permission;
  const rejectionAuthority = hasEffectivePermission(actor, rejectionPermission, {
    authorityRegistry, scope: decision.scope, now,
  });
  if (!rejectionAuthority.allowed) throw new Error("REJECTION_PERMISSION_REQUIRED");
  const level = actorLevel(actor, policy, authorityRegistry, now);
  if (!Number.isInteger(level) || level < 0) {
    throw new Error(policy.levelDomain ? "REJECTOR_DOMAIN_LEVEL_INVALID" : "REJECTOR_LEVEL_INVALID");
  }
  if (!Number.isInteger(policy.minimumLevel) || level < policy.minimumLevel) {
    throw new Error("REJECTOR_LEVEL_INSUFFICIENT");
  }
  if ((policy.prohibitedConflicts ?? []).some((conflict) => actor.conflicts?.includes(conflict))) {
    throw new Error("REJECTOR_HAS_PROHIBITED_CONFLICT");
  }
  const detail = requireString(reason, "reason");
  state.status = "rejected";
  ledger.append({
    type: "decision_rejected",
    decisionId: state.decisionId,
    actorId: actor.id,
    permission: rejectionPermission,
    authorityGrantId: rejectionAuthority.authorityGrantId ?? null,
    policyDigest: state.policyDigest,
    evidenceDigest: state.evidenceDigest,
    levelDomain: policy.levelDomain ?? "general",
    level,
    reason: detail,
  });
  return decision;
}

export function overrideDecision({ decision, human, reason, ledger, authorityRegistry, now = new Date() }) {
  if (!(ledger instanceof AuditLedger)) throw new TypeError("ledger must be an AuditLedger");
  const state = getDecisionState(decision);
  if (!isHuman(human)) throw new Error("OVERRIDE_REQUIRES_ACTIVE_HUMAN");
  if (!isVerifiedPrincipal(human)) throw new Error("OVERRIDE_IDENTITY_NOT_VERIFIED");
  const overrideAuthority = hasEffectivePermission(human, "governance:override", {
    authorityRegistry, scope: "*", now,
  });
  if (!overrideAuthority.allowed) throw new Error("OVERRIDE_PERMISSION_REQUIRED");
  const detail = requireString(reason, "reason");
  const previousStatus = state.status;
  state.status = "overridden";
  state.override = {
    actorId: human.id,
    authorityGrantId: overrideAuthority.authorityGrantId ?? null,
    reason: detail,
    previousStatus,
    occurredAt: new Date().toISOString(),
  };
  ledger.append({
    type: "human_override",
    decisionId: state.decisionId,
    actorId: human.id,
    reason: detail,
    previousStatus,
    evidenceDigest: state.evidenceDigest,
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
    if (!isVerifiedPrincipal(actor)) throw new Error("DELEGATION_REVOCATION_IDENTITY_NOT_VERIFIED");
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
  if (!isVerifiedPrincipal(delegator) || !isVerifiedPrincipal(delegate)) {
    throw new Error("DELEGATION_PRINCIPALS_NOT_VERIFIED");
  }
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
  if (!isVerifiedPrincipal(actor)) throw new Error("DELEGATION_REVOCATION_IDENTITY_NOT_VERIFIED");
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
