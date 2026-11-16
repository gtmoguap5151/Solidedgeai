import test from "node:test";
import assert from "node:assert/strict";
import { AuthorityRegistry } from "../src/authority-registry.mjs";
import { AuditLedger } from "../src/index.mjs";
import { ExecutionAuthorityRegistry } from "../src/execution-policy.mjs";

function setup() {
  const ledger = new AuditLedger();
  const authority = new AuthorityRegistry();
  const owner = authority.bootstrap({
    identity: {
      id: "blackpine-owner",
      principalType: "human",
      active: true,
      verified: true,
      rank: "Owner",
      issuer: "trusted-test-identity-adapter",
    },
    initialPermissions: ["governance:permission:grant", "governance:authority:revoke"],
    initialCompetencies: [{
      domain: "general",
      level: 5,
      evidence: [{ type: "test", reference: "test://owner" }],
    }],
    reason: "Controlled test bootstrap",
    ledger,
  });
  const execution = new ExecutionAuthorityRegistry();
  return { ledger, authority, owner, execution };
}

const testResource = "repo:gtmoguap5151/blackpine-field:branch:galinyx-governance-test:path:content/drafts";

test("human mandate grants an agent only exact allowlisted operations and resources", () => {
  const { ledger, authority, owner, execution } = setup();
  const mandate = execution.registerAgent({
    issuer: owner,
    agentId: "agent:blackpine-editor",
    operations: ["blackpine.content.draft.create", "blackpine.metadata.audit"],
    resources: [testResource],
    expiresAt: "2026-11-17T12:00:00.000Z",
    reason: "Bounded editorial validation work",
    authorityRegistry: authority,
    ledger,
    now: new Date("2026-11-16T12:00:00.000Z"),
  });
  const agent = execution.resolveAgent({
    agentId: "agent:blackpine-editor",
    identityAssertion: {
      id: "agent:blackpine-editor",
      principalType: "agent",
      verified: true,
      issuer: "trusted-agent-identity-adapter",
    },
    authorityRegistry: authority,
    now: new Date("2026-11-16T12:00:00.000Z"),
  });
  const authorization = execution.authorizeExecution({
    actor: agent,
    operation: "blackpine.content.draft.create",
    resource: testResource,
    taskId: "bp-task-001",
    idempotencyKey: "bp-task-001:create-draft:1",
    dryRunPassed: true,
    rollbackPlan: "Delete the created draft file from this isolated branch",
    evidenceFreshUntil: "2026-11-16T18:00:00.000Z",
    ledger,
    authorityRegistry: authority,
    now: new Date("2026-11-16T12:05:00.000Z"),
  });
  assert.equal(authorization.authorized, true);
  assert.equal(authorization.executionOccurred, false);
  assert.equal(authorization.mandateId, mandate.id);
  assert.equal(ledger.verify(), true);
});

test("agent cannot self-issue or widen its own mandate", () => {
  const { authority, owner, execution, ledger } = setup();
  assert.throws(() => execution.registerAgent({
    issuer: { id: "agent:blackpine-editor", principalType: "agent", active: true },
    agentId: "agent:blackpine-editor",
    operations: ["blackpine.content.draft.create"],
    resources: [testResource],
    expiresAt: "2026-11-17T12:00:00.000Z",
    reason: "Self-issued",
    authorityRegistry: authority,
    ledger,
  }), /MANDATE_ISSUER_NOT_VERIFIED/);
  assert.ok(owner);
});

test("production, finance, affiliate account, and wildcard scopes are rejected", () => {
  const { authority, owner, execution, ledger } = setup();
  for (const resource of [
    "repo:gtmoguap5151/blackpine-field:branch:main:path:content",
    "repo:gtmoguap5151/blackpine-field:environment:production",
    "repo:gtmoguap5151/blackpine-field:financial-account:payout",
    "repo:gtmoguap5151/blackpine-field:affiliate-account:awin",
    "*",
  ]) {
    assert.throws(() => execution.registerAgent({
      issuer: owner,
      agentId: "agent:restricted",
      operations: ["blackpine.content.draft.create"],
      resources: [resource],
      expiresAt: "2026-11-17T12:00:00.000Z",
      reason: "Should reject this scope",
      authorityRegistry: authority,
      ledger,
      now: new Date("2026-11-16T12:00:00.000Z"),
    }), /AGENT_RESOURCE_SCOPE_INVALID_OR_PRODUCTION_FORBIDDEN/);
  }
  assert.throws(() => execution.registerAgent({
    issuer: owner,
    agentId: "agent:restricted",
    operations: ["blackpine.production.publish"],
    resources: [testResource],
    expiresAt: "2026-11-17T12:00:00.000Z",
    reason: "Unsupported operation",
    authorityRegistry: authority,
    ledger,
    now: new Date("2026-11-16T12:00:00.000Z"),
  }), /AGENT_OPERATION_NOT_ALLOWLISTED/);
});

test("missing dry-run, rollback, fresh evidence, or mandate blocks execution authorization", () => {
  const { authority, owner, execution, ledger } = setup();
  execution.registerAgent({
    issuer: owner,
    agentId: "agent:checks",
    operations: ["blackpine.content.draft.update"],
    resources: [testResource],
    expiresAt: "2026-11-17T12:00:00.000Z",
    reason: "Bounded test",
    authorityRegistry: authority,
    ledger,
    now: new Date("2026-11-16T12:00:00.000Z"),
  });
  const agent = execution.resolveAgent({
    agentId: "agent:checks",
    identityAssertion: {
      id: "agent:checks", principalType: "agent", verified: true,
      issuer: "trusted-agent-identity-adapter",
    },
    authorityRegistry: authority,
    now: new Date("2026-11-16T12:00:00.000Z"),
  });
  const request = {
    actor: agent,
    operation: "blackpine.content.draft.update",
    resource: testResource,
    taskId: "bp-task-002",
    idempotencyKey: "bp-task-002:update:1",
    dryRunPassed: true,
    rollbackPlan: "Restore the prior draft from the recorded Git commit",
    evidenceFreshUntil: "2026-11-16T18:00:00.000Z",
    ledger,
    authorityRegistry: authority,
    now: new Date("2026-11-16T12:05:00.000Z"),
  };
  assert.throws(() => execution.authorizeExecution({ ...request, dryRunPassed: false }), /SUCCESSFUL_DRY_RUN_REQUIRED/);
  assert.throws(() => execution.authorizeExecution({ ...request, rollbackPlan: "" }), /ROLLBACK_PLAN_REQUIRED/);
  assert.throws(() => execution.authorizeExecution({
    ...request, evidenceFreshUntil: "2026-11-16T11:00:00.000Z",
  }), /EXECUTION_EVIDENCE_STALE/);
  assert.throws(() => execution.authorizeExecution({
    ...request, resource: "repo:gtmoguap5151/blackpine-field:branch:main:path:content",
  }), /EXECUTION_OUTSIDE_ACTIVE_MANDATE/);
});

test("revoked and expired mandates no longer authorize actions", () => {
  const { authority, owner, execution, ledger } = setup();
  const mandate = execution.registerAgent({
    issuer: owner,
    agentId: "agent:revocable",
    operations: ["blackpine.metadata.audit"],
    resources: [testResource],
    expiresAt: "2026-11-17T12:00:00.000Z",
    reason: "Temporary audit mandate",
    authorityRegistry: authority,
    ledger,
    now: new Date("2026-11-16T12:00:00.000Z"),
  });
  const agent = execution.resolveAgent({
    agentId: "agent:revocable",
    identityAssertion: {
      id: "agent:revocable", principalType: "agent", verified: true,
      issuer: "trusted-agent-identity-adapter",
    },
    authorityRegistry: authority,
    now: new Date("2026-11-16T12:00:00.000Z"),
  });
  execution.revokeMandate({
    mandateId: mandate.id,
    actor: owner,
    reason: "Owner revoked temporary authority",
    ledger,
    authorityRegistry: authority,
    now: new Date("2026-11-16T12:10:00.000Z"),
  });
  assert.throws(() => execution.authorizeExecution({
    actor: agent,
    operation: "blackpine.metadata.audit",
    resource: testResource,
    taskId: "bp-task-003",
    idempotencyKey: "bp-task-003:audit:1",
    dryRunPassed: true,
    rollbackPlan: "No mutation is performed by metadata audit",
    evidenceFreshUntil: "2026-11-16T18:00:00.000Z",
    ledger,
    authorityRegistry: authority,
    now: new Date("2026-11-16T12:11:00.000Z"),
  }), /EXECUTION_OUTSIDE_ACTIVE_MANDATE/);
  assert.equal(ledger.verify(), true);
});

test("idempotency key prevents replay of an authorization request", () => {
  const { authority, owner, execution, ledger } = setup();
  execution.registerAgent({
    issuer: owner,
    agentId: "agent:replay",
    operations: ["blackpine.metadata.audit"],
    resources: [testResource],
    expiresAt: "2026-11-17T12:00:00.000Z",
    reason: "Replay protection test",
    authorityRegistry: authority,
    ledger,
    now: new Date("2026-11-16T12:00:00.000Z"),
  });
  const agent = execution.resolveAgent({
    agentId: "agent:replay",
    identityAssertion: {
      id: "agent:replay", principalType: "agent", verified: true,
      issuer: "trusted-agent-identity-adapter",
    },
    authorityRegistry: authority,
    now: new Date("2026-11-16T12:00:00.000Z"),
  });
  const args = {
    actor: agent,
    operation: "blackpine.metadata.audit",
    resource: testResource,
    taskId: "bp-task-004",
    idempotencyKey: "bp-task-004:audit:1",
    dryRunPassed: true,
    rollbackPlan: "No mutation is performed by metadata audit",
    evidenceFreshUntil: "2026-11-16T18:00:00.000Z",
    ledger,
    authorityRegistry: authority,
    now: new Date("2026-11-16T12:05:00.000Z"),
  };
  execution.authorizeExecution(args);
  assert.throws(() => execution.authorizeExecution(args), /IDEMPOTENCY_KEY_ALREADY_USED/);
});

test("revoking the human issuer's authority also disables every agent mandate", () => {
  const { authority, owner, execution, ledger } = setup();
  execution.registerAgent({
    issuer: owner,
    agentId: "agent:issuer-revocation",
    operations: ["blackpine.metadata.audit"],
    resources: [testResource],
    expiresAt: "2026-11-17T12:00:00.000Z",
    reason: "Mandate must depend on continuing human authority",
    authorityRegistry: authority,
    ledger,
    now: new Date("2026-11-16T12:00:00.000Z"),
  });
  const agent = execution.resolveAgent({
    agentId: "agent:issuer-revocation",
    identityAssertion: {
      id: "agent:issuer-revocation",
      principalType: "agent",
      verified: true,
      issuer: "trusted-agent-identity-adapter",
    },
    authorityRegistry: authority,
    now: new Date("2026-11-16T12:00:00.000Z"),
  });
  const issuerGrant = authority.listRecords().find((record) =>
    record.subjectId === owner.id &&
    record.permission === "governance:permission:grant"
  );
  authority.revoke({
    recordId: issuerGrant.id,
    actor: owner,
    reason: "Human delegation authority withdrawn",
    ledger,
    now: new Date("2026-11-16T12:06:00.000Z"),
  });
  assert.throws(() => execution.authorizeExecution({
    actor: agent,
    operation: "blackpine.metadata.audit",
    resource: testResource,
    taskId: "bp-task-issuer-revoked",
    idempotencyKey: "bp-task-issuer-revoked:audit:1",
    dryRunPassed: true,
    rollbackPlan: "No mutation is performed by metadata audit",
    evidenceFreshUntil: "2026-11-16T18:00:00.000Z",
    ledger,
    authorityRegistry: authority,
    now: new Date("2026-11-16T12:07:00.000Z"),
  }), /EXECUTION_OUTSIDE_ACTIVE_MANDATE/);
  assert.equal(ledger.verify(), true);
});

test("execution authorization cannot be issued without an audit ledger", () => {
  const { authority, owner, execution } = setup();
  assert.throws(() => execution.registerAgent({
    issuer: owner,
    agentId: "agent:no-ledger",
    operations: ["blackpine.metadata.audit"],
    resources: [testResource],
    expiresAt: "2026-11-17T12:00:00.000Z",
    reason: "Audit is mandatory",
    authorityRegistry: authority,
  }), /EXECUTION_AUDIT_LEDGER_REQUIRED/);
});
