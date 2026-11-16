import { randomUUID } from "node:crypto";

const principalHandles = new WeakSet();
const principalStates = new WeakMap();

export const COMPETENCY_DOMAINS = Object.freeze([
  "general",
  "editorial",
  "product-evidence",
  "commercial",
  "release-management",
  "financial-controls",
]);

const RESERVED_PERMISSIONS = new Set([
  "governance:permission:grant",
  "governance:competency:certify",
  "governance:authority:revoke",
  "governance:delegate",
  "governance:delegation:revoke",
  "governance:override",
  "governance:authority:grant",
  "blackpine:owner:approve",
]);

function requireString(value, name) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${name} must be a non-empty string`);
  }
  return value.trim();
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function activeHuman(identity) {
  return identity?.verified === true &&
    identity?.principalType === "human" &&
    identity?.active === true &&
    typeof identity?.id === "string" &&
    identity.id.trim() !== "";
}

function appendAudit(ledger, event) {
  if (!ledger || typeof ledger.append !== "function") {
    throw new TypeError("ledger must support append");
  }
  ledger.append(event);
}

function futureExpiry(expiresAt, now) {
  const expiry = new Date(expiresAt);
  const current = new Date(now);
  if (!Number.isFinite(expiry.getTime()) || !Number.isFinite(current.getTime()) || expiry <= current) {
    throw new Error("AUTHORITY_EXPIRY_MUST_BE_FUTURE");
  }
  return { expiry, current };
}

function makePrincipalHandle(state) {
  const handle = {};
  for (const key of Object.keys(state)) {
    Object.defineProperty(handle, key, {
      enumerable: true,
      configurable: false,
      get: () => structuredClone(state[key]),
    });
  }
  Object.freeze(handle);
  principalHandles.add(handle);
  principalStates.set(handle, state);
  return handle;
}

export function isVerifiedPrincipal(value) {
  return principalHandles.has(value);
}

/**
 * In-memory authority and competency registry for development and validation.
 * Identity verification remains the responsibility of a trusted authentication
 * adapter. The registry accepts only verified identity assertions and does not
 * itself authenticate people.
 */
export class AuthorityRegistry {
  #permissionGrants = new Map();
  #competencyCredentials = new Map();
  #bootstrapped = false;

  bootstrap({ identity, initialPermissions, initialCompetencies = [], reason, ledger, now = new Date() }) {
    if (this.#bootstrapped) throw new Error("AUTHORITY_REGISTRY_ALREADY_BOOTSTRAPPED");
    if (!activeHuman(identity)) throw new Error("BOOTSTRAP_REQUIRES_VERIFIED_ACTIVE_HUMAN");
    if (!Array.isArray(initialPermissions) || initialPermissions.length === 0) {
      throw new Error("BOOTSTRAP_PERMISSIONS_REQUIRED");
    }
    const detail = requireString(reason, "reason");
    const { current, expiry } = futureExpiry(new Date(new Date(now).getTime() + 3650 * 24 * 60 * 60 * 1000), now);
    this.#bootstrapped = true;

    for (const permission of initialPermissions) {
      const normalized = requireString(permission, "permission");
      const grant = deepFreeze({
        id: randomUUID(),
        recordType: "permission",
        subjectId: identity.id,
        permission: normalized,
        scope: "*",
        issuedBy: "bootstrap",
        issuedAt: current.toISOString(),
        expiresAt: expiry.toISOString(),
        reason: detail,
        revokedAt: null,
        revokedBy: null,
        revocationReason: null,
      });
      this.#permissionGrants.set(grant.id, grant);
    }

    for (const item of initialCompetencies) {
      this.#validateCompetency(item);
      const credential = deepFreeze({
        id: randomUUID(),
        recordType: "competency",
        subjectId: identity.id,
        domain: item.domain,
        level: item.level,
        evidence: structuredClone(item.evidence),
        issuedBy: "bootstrap",
        issuedAt: current.toISOString(),
        expiresAt: expiry.toISOString(),
        reason: detail,
        revokedAt: null,
        revokedBy: null,
        revocationReason: null,
      });
      this.#competencyCredentials.set(credential.id, credential);
    }

    appendAudit(ledger, {
      type: "authority_registry_bootstrapped",
      principalId: identity.id,
      permissions: [...initialPermissions],
      competencyCount: initialCompetencies.length,
      reason: detail,
    });
    return this.resolve({ identity, now });
  }

  #validateCompetency({ domain, level, evidence }) {
    if (!COMPETENCY_DOMAINS.includes(domain)) throw new Error("UNKNOWN_COMPETENCY_DOMAIN");
    if (!Number.isInteger(level) || level < 1 || level > 5) throw new Error("COMPETENCY_LEVEL_OUT_OF_RANGE");
    if (!Array.isArray(evidence) || evidence.length === 0 ||
        evidence.some((item) => typeof item?.type !== "string" || item.type.trim() === "" ||
          typeof item?.reference !== "string" || item.reference.trim() === "")) {
      throw new Error("COMPETENCY_EVIDENCE_REQUIRED");
    }
  }

  issuePermission({ issuer, subjectId, permission, scope, expiresAt, reason, ledger, now = new Date() }) {
    if (!isVerifiedPrincipal(issuer)) throw new Error("PERMISSION_ISSUER_NOT_VERIFIED");
    if (!this.findActivePermissionGrant({
      subjectId: issuer.id, permission: "governance:permission:grant", scope: "*", now,
    })) {
      throw new Error("PERMISSION_GRANT_AUTHORITY_REQUIRED");
    }
    const targetId = requireString(subjectId, "subjectId");
    if (issuer.id === targetId) throw new Error("SELF_PERMISSION_GRANT_PROHIBITED");
    const normalizedPermission = requireString(permission, "permission");
    if (RESERVED_PERMISSIONS.has(normalizedPermission)) {
      throw new Error("RESERVED_PERMISSION_REQUIRES_BOOTSTRAP");
    }
    const normalizedScope = scope === "*" ? "*" : requireString(scope, "scope");
    const detail = requireString(reason, "reason");
    const { current, expiry } = futureExpiry(expiresAt, now);
    const grant = deepFreeze({
      id: randomUUID(),
      recordType: "permission",
      subjectId: targetId,
      permission: normalizedPermission,
      scope: normalizedScope,
      issuedBy: issuer.id,
      issuedAt: current.toISOString(),
      expiresAt: expiry.toISOString(),
      reason: detail,
      revokedAt: null,
      revokedBy: null,
      revocationReason: null,
    });
    this.#permissionGrants.set(grant.id, grant);
    appendAudit(ledger, {
      type: "authority_permission_granted",
      grantId: grant.id,
      subjectId: targetId,
      permission: normalizedPermission,
      scope: normalizedScope,
      issuerId: issuer.id,
      expiresAt: grant.expiresAt,
      reason: detail,
    });
    return structuredClone(grant);
  }

  certifyCompetency({ issuer, subjectId, domain, level, evidence, expiresAt, reason, ledger, now = new Date() }) {
    if (!isVerifiedPrincipal(issuer)) throw new Error("COMPETENCY_ISSUER_NOT_VERIFIED");
    if (!this.findActivePermissionGrant({
      subjectId: issuer.id, permission: "governance:competency:certify", scope: "*", now,
    })) {
      throw new Error("COMPETENCY_CERTIFICATION_AUTHORITY_REQUIRED");
    }
    const targetId = requireString(subjectId, "subjectId");
    if (issuer.id === targetId) throw new Error("SELF_CERTIFICATION_PROHIBITED");
    const detail = requireString(reason, "reason");
    this.#validateCompetency({ domain, level, evidence });
    const { current, expiry } = futureExpiry(expiresAt, now);
    const credential = deepFreeze({
      id: randomUUID(),
      recordType: "competency",
      subjectId: targetId,
      domain,
      level,
      evidence: structuredClone(evidence),
      issuedBy: issuer.id,
      issuedAt: current.toISOString(),
      expiresAt: expiry.toISOString(),
      reason: detail,
      revokedAt: null,
      revokedBy: null,
      revocationReason: null,
    });
    this.#competencyCredentials.set(credential.id, credential);
    appendAudit(ledger, {
      type: "authority_competency_certified",
      credentialId: credential.id,
      subjectId: targetId,
      domain,
      level,
      issuerId: issuer.id,
      expiresAt: credential.expiresAt,
      reason: detail,
    });
    return structuredClone(credential);
  }

  revoke({ recordId, actor, reason, ledger, now = new Date() }) {
    if (!isVerifiedPrincipal(actor)) throw new Error("AUTHORITY_REVOCATION_ACTOR_NOT_VERIFIED");
    const detail = requireString(reason, "reason");
    const record = this.#permissionGrants.get(recordId) ?? this.#competencyCredentials.get(recordId);
    if (!record) throw new Error("AUTHORITY_RECORD_NOT_FOUND");
    if (record.revokedAt) throw new Error("AUTHORITY_RECORD_ALREADY_REVOKED");
    if (actor.id !== record.issuedBy && !this.findActivePermissionGrant({
      subjectId: actor.id, permission: "governance:authority:revoke", scope: "*", now,
    })) {
      throw new Error("AUTHORITY_REVOCATION_PERMISSION_REQUIRED");
    }
    const updated = deepFreeze({
      ...record,
      revokedAt: new Date().toISOString(),
      revokedBy: actor.id,
      revocationReason: detail,
    });
    if (record.recordType === "permission") this.#permissionGrants.set(recordId, updated);
    else this.#competencyCredentials.set(recordId, updated);
    appendAudit(ledger, {
      type: "authority_record_revoked",
      recordId,
      recordType: record.recordType,
      subjectId: record.subjectId,
      actorId: actor.id,
      reason: detail,
    });
    return structuredClone(updated);
  }

  resolve({ identity, now = new Date() }) {
    if (!activeHuman(identity)) throw new Error("PRINCIPAL_REQUIRES_VERIFIED_ACTIVE_HUMAN");
    const timestamp = new Date(now).getTime();
    if (!Number.isFinite(timestamp)) throw new Error("PRINCIPAL_RESOLUTION_TIME_INVALID");
    const permissionGrants = [...this.#permissionGrants.values()].filter((grant) =>
      grant.subjectId === identity.id &&
      !grant.revokedAt &&
      new Date(grant.expiresAt).getTime() > timestamp
    );
    const competencyCredentials = [...this.#competencyCredentials.values()].filter((credential) =>
      credential.subjectId === identity.id &&
      !credential.revokedAt &&
      new Date(credential.expiresAt).getTime() > timestamp
    );
    const levels = {};
    for (const credential of competencyCredentials) {
      levels[credential.domain] = Math.max(levels[credential.domain] ?? 0, credential.level);
    }
    const permissions = [...new Set(permissionGrants.filter((grant) => grant.scope === "*").map((grant) => grant.permission))];
    const state = {
      id: identity.id,
      principalType: "human",
      active: true,
      rank: identity.rank ?? null,
      conflicts: Array.isArray(identity.conflicts) ? [...identity.conflicts] : [],
      permissions,
      permissionGrants: permissionGrants.map((grant) => structuredClone(grant)),
      level: levels.general ?? identity.level ?? null,
      levels,
      competencyCredentials: competencyCredentials.map((credential) => structuredClone(credential)),
      identityIssuer: identity.issuer ?? null,
      identityVerifiedAt: identity.verifiedAt ?? null,
    };
    return makePrincipalHandle(state);
  }

  findActivePermissionGrant({ subjectId, permission, scope, grantId, now = new Date() }) {
    const timestamp = new Date(now).getTime();
    if (!Number.isFinite(timestamp)) throw new Error("AUTHORITY_RESOLUTION_TIME_INVALID");
    for (const grant of this.#permissionGrants.values()) {
      if (
        grant.subjectId === subjectId &&
        grant.permission === permission &&
        (grant.scope === "*" || grant.scope === scope) &&
        (!grantId || grant.id === grantId) &&
        !grant.revokedAt &&
        new Date(grant.expiresAt).getTime() > timestamp
      ) return structuredClone(grant);
    }
    return null;
  }

  getActiveCompetencyLevel({ subjectId, domain, now = new Date() }) {
    const timestamp = new Date(now).getTime();
    if (!Number.isFinite(timestamp)) throw new Error("AUTHORITY_RESOLUTION_TIME_INVALID");
    let level = null;
    for (const credential of this.#competencyCredentials.values()) {
      if (
        credential.subjectId === subjectId &&
        credential.domain === domain &&
        !credential.revokedAt &&
        new Date(credential.expiresAt).getTime() > timestamp
      ) level = Math.max(level ?? 0, credential.level);
    }
    return level;
  }

  listRecords() {
    return [
      ...[...this.#permissionGrants.values()].map((record) => structuredClone(record)),
      ...[...this.#competencyCredentials.values()].map((record) => structuredClone(record)),
    ];
  }
}
