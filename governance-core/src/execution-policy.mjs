import { randomUUID } from "node:crypto";
import { isVerifiedPrincipal } from "./authority-registry.mjs";

const agentHandles = new WeakMap();

const ALLOWED_ROUTINE_OPERATIONS = new Set([
  "blackpine.content.draft.create",
  "blackpine.content.draft.update",
  "blackpine.metadata.audit",
  "blackpine.measurement.import",
]);

const FORBIDDEN_RESOURCE_MARKERS = [
  ":branch:main",
  ":branch:master",
  ":environment:production",
  ":financial-account:",
  ":affiliate-account:",
  ":credential:",
  ":payout:",
];

function requireText(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(label + "_REQUIRED");
  }
  return value.trim();
}

function parseTime(value, label) {
  const result = new Date(value);
  if (!Number.isFinite(result.getTime())) throw new Error(label + "_INVALID");
  return result;
}

function activeHumanGrant(authorityRegistry, issuer, now) {
  return authorityRegistry.findActivePermissionGrant({
    subjectId: issuer.id,
    permission: "governance:permission:grant",
    scope: "*",
    now,
  });
}

/**
 * In-memory execution mandates for authenticated agents.
 *
 * This registry does not authenticate agents. A trusted identity adapter must
 * supply the verified assertion passed to resolveAgent(). Mandates are exact
 * operation/resource pairs, expire, can be revoked, and are test-only until
 * backed by durable protected storage.
 */
export class ExecutionAuthorityRegistry {
  #mandates = new Map();
  #usedKeys = new Set();

  registerAgent({
    issuer,
    agentId,
    operations,
    resources,
    expiresAt,
    reason,
    authorityRegistry,
    ledger,
    now = new Date(),
  }) {
    if (!isVerifiedPrincipal(issuer)) throw new Error("MANDATE_ISSUER_NOT_VERIFIED");
    if (!authorityRegistry || !activeHumanGrant(authorityRegistry, issuer, now)) {
      throw new Error("AGENT_AUTHORIZATION_PERMISSION_REQUIRED");
    }
    const id = requireText(agentId, "AGENT_ID");
    if (id === issuer.id) throw new Error("AGENT_ID_MUST_DIFFER_FROM_ISSUER");
    if (!Array.isArray(operations) || operations.length === 0 ||
        operations.some((item) => !ALLOWED_ROUTINE_OPERATIONS.has(item))) {
      throw new Error("AGENT_OPERATION_NOT_ALLOWLISTED");
    }
    if (!Array.isArray(resources) || resources.length === 0 ||
        resources.some((item) => typeof item !== "string" || item.trim() === "" ||
          item.includes("*") || FORBIDDEN_RESOURCE_MARKERS.some((marker) => item.includes(marker)))) {
      throw new Error("AGENT_RESOURCE_SCOPE_INVALID_OR_PRODUCTION_FORBIDDEN");
    }
    const expiry = parseTime(expiresAt, "MANDATE_EXPIRY");
    if (expiry <= new Date(now)) throw new Error("MANDATE_EXPIRY_MUST_BE_FUTURE");
    const detail = requireText(reason, "MANDATE_REASON");
    const mandate = {
      id: randomUUID(),
      agentId: id,
      issuerId: issuer.id,
      operations: [...new Set(operations)],
      resources: [...new Set(resources)],
      issuedAt: new Date(now).toISOString(),
      expiresAt: expiry.toISOString(),
      reason: detail,
      revokedAt: null,
      revokedBy: null,
    };
    this.#mandates.set(mandate.id, mandate);
    ledger?.append({
      type: "agent_execution_mandate_issued",
      mandateId: mandate.id,
      agentId: id,
      issuerId: issuer.id,
      operations: mandate.operations,
      resources: mandate.resources,
      expiresAt: mandate.expiresAt,
      reason: detail,
    });
    return structuredClone(mandate);
  }

  resolveAgent({ agentId, identityAssertion, now = new Date() }) {
    const id = requireText(agentId, "AGENT_ID");
    if (identityAssertion?.verified !== true ||
        identityAssertion?.principalType !== "agent" ||
        identityAssertion?.id !== id ||
        typeof identityAssertion?.issuer !== "string" ||
        identityAssertion.issuer.trim() === "") {
      throw new Error("AGENT_IDENTITY_ASSERTION_INVALID");
    }
    const activeMandates = [...this.#mandates.values()].filter((mandate) =>
      mandate.agentId === id && !mandate.revokedAt &&
      new Date(mandate.expiresAt).getTime() > new Date(now).getTime()
    );
    if (activeMandates.length === 0) throw new Error("AGENT_HAS_NO_ACTIVE_EXECUTION_MANDATE");
    const handle = Object.freeze({ id, principalType: "agent" });
    agentHandles.set(handle, { id, issuer: identityAssertion.issuer });
    return handle;
  }

  revokeMandate({ mandateId, actor, reason, ledger, now = new Date() }) {
    if (!isVerifiedPrincipal(actor)) throw new Error("MANDATE_REVOCATION_REQUIRES_VERIFIED_HUMAN");
    const mandate = this.#mandates.get(mandateId);
    if (!mandate) throw new Error("MANDATE_NOT_FOUND");
    if (mandate.revokedAt) throw new Error("MANDATE_ALREADY_REVOKED");
    if (actor.id !== mandate.issuerId &&
        !activeHumanGrant({ findActivePermissionGrant: ({subjectId,permission,scope,now}) =>
          subjectId === actor.id && permission === "governance:authority:revoke" &&
          scope === "*" && actor.active === true ? { id: "authorized" } : null
        }, actor, now)) {
      throw new Error("MANDATE_REVOCATION_AUTHORITY_REQUIRED");
    }
    const updated = {
      ...mandate,
      revokedAt: new Date(now).toISOString(),
      revokedBy: actor.id,
      revocationReason: requireText(reason, "MANDATE_REVOCATION_REASON"),
    };
    this.#mandates.set(mandateId, updated);
    ledger?.append({
      type: "agent_execution_mandate_revoked",
      mandateId,
      agentId: mandate.agentId,
      actorId: actor.id,
      reason: updated.revocationReason,
    });
    return structuredClone(updated);
  }

  authorizeExecution({
    actor,
    operation,
    resource,
    taskId,
    idempotencyKey,
    dryRunPassed,
    rollbackPlan,
    evidenceFreshUntil,
    ledger,
    now = new Date(),
  }) {
    const identity = agentHandles.get(actor);
    if (!identity) throw new Error("UNTRUSTED_AGENT_HANDLE");
    const op = requireText(operation, "EXECUTION_OPERATION");
    const target = requireText(resource, "EXECUTION_RESOURCE");
    const task = requireText(taskId, "EXECUTION_TASK_ID");
    const key = requireText(idempotencyKey, "IDEMPOTENCY_KEY");
    if (!ALLOWED_ROUTINE_OPERATIONS.has(op)) throw new Error("EXECUTION_OPERATION_NOT_ALLOWLISTED");
    if (dryRunPassed !== true) throw new Error("SUCCESSFUL_DRY_RUN_REQUIRED");
    if (typeof rollbackPlan !== "string" || rollbackPlan.trim().length < 12) {
      throw new Error("ROLLBACK_PLAN_REQUIRED");
    }
    if (this.#usedKeys.has(key)) throw new Error("IDEMPOTENCY_KEY_ALREADY_USED");
    const evidenceExpiry = parseTime(evidenceFreshUntil, "EVIDENCE_FRESHNESS");
    if (evidenceExpiry <= new Date(now)) throw new Error("EXECUTION_EVIDENCE_STALE");
    const mandate = [...this.#mandates.values()].find((item) =>
      item.agentId === identity.id && !item.revokedAt &&
      new Date(item.expiresAt).getTime() > new Date(now).getTime() &&
      item.operations.includes(op) && item.resources.includes(target)
    );
    if (!mandate) throw new Error("EXECUTION_OUTSIDE_ACTIVE_MANDATE");
    this.#usedKeys.add(key);
    const authorization = {
      authorized: true,
      mandateId: mandate.id,
      agentId: identity.id,
      operation: op,
      resource: target,
      taskId: task,
      idempotencyKey: key,
      authorizedAt: new Date(now).toISOString(),
      expiresAt: mandate.expiresAt,
      dryRunPassed: true,
      rollbackPlan,
      evidenceFreshUntil: evidenceExpiry.toISOString(),
      executionOccurred: false,
    };
    ledger?.append({
      type: "agent_execution_authorized",
      mandateId: mandate.id,
      agentId: identity.id,
      operation: op,
      resource: target,
      taskId: task,
      idempotencyKey: key,
      dryRunPassed: true,
      executionOccurred: false,
    });
    return Object.freeze(authorization);
  }

  listMandates() {
    return [...this.#mandates.values()].map((item) => structuredClone(item));
  }
}

export { ALLOWED_ROUTINE_OPERATIONS };
