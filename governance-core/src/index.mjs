import { createHash } from "node:crypto";

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
    const body = {
      ...input,
      sequence: this.#events.length + 1,
      previousHash,
      occurredAt: input.occurredAt ?? new Date().toISOString(),
    };
    const hash = eventDigest(body);
    const event = Object.freeze({ ...body, hash });
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
export function evaluateDecision({ request, requester, policy }) {
  const reasons = [];
  if (!request || !policy) throw new TypeError("request and policy are required");
  if (!isHuman(requester)) reasons.push("REQUESTER_MUST_BE_ACTIVE_HUMAN");
  if (!request.id || !request.title) reasons.push("REQUEST_ID_AND_TITLE_REQUIRED");
  if (!policy.id || !policy.version || !policy.permission) reasons.push("POLICY_ID_VERSION_AND_PERMISSION_REQUIRED");
  if (!Number.isInteger(policy.minimumLevel) || policy.minimumLevel < 0) reasons.push("POLICY_MINIMUM_LEVEL_INVALID");
  if (!Number.isInteger(policy.requiredApprovals) || policy.requiredApprovals < 1) reasons.push("POLICY_REQUIRED_APPROVALS_INVALID");

  if (isHuman(requester) && policy.permission && !hasPermission(requester, policy.permission)) {
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
  });
}

export function createDecision({ request, requester, policy, ledger }) {
  if (!(ledger instanceof AuditLedger)) throw new TypeError("ledger must be an AuditLedger");
  const evaluation = evaluateDecision({ request, requester, policy });
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
    reasons: [...decision.reasons],
  });
  return decision;
}

export function recordApproval({ decision, approver, policy, ledger }) {
  if (!(ledger instanceof AuditLedger)) throw new TypeError("ledger must be an AuditLedger");
  if (TERMINAL.has(decision.status)) throw new Error("TERMINAL_DECISION_CANNOT_BE_CHANGED");
  if (decision.status !== "pending_approval") throw new Error("DECISION_NOT_ELIGIBLE_FOR_APPROVAL");
  if (!isHuman(approver)) throw new Error("APPROVER_MUST_BE_ACTIVE_HUMAN");
  if (approver.id === decision.requesterId) throw new Error("SELF_APPROVAL_PROHIBITED");
  if (!hasPermission(approver, policy.approverPermission ?? policy.permission)) {
    throw new Error("APPROVER_LACKS_PERMISSION");
  }
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
    approvedAt: new Date().toISOString(),
  });
  if (decision.approvals.length >= decision.requiredApprovals) decision.status = "approved";
  ledger.append({
    type: "approval_recorded",
    decisionId: decision.decisionId,
    actorId: approver.id,
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
