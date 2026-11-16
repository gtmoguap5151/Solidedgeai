import test from "node:test";
import assert from "node:assert/strict";
import { blackpinePolicies } from "../adapters/blackpine/policies.mjs";
import {
  AuditLedger,
  DelegationRegistry,
  createDecision,
  grantDelegation,
  evaluateDecision,
  overrideDecision,
  recordApproval,
  rejectDecision,
  resolveDelegatedAuthority,
  revokeDelegation,
} from "../src/index.mjs";

const policy = {
  id: "blackpine-content-release",
  version: "1.0.0",
  permission: "content:submit",
  approverPermission: "content:approve",
  minimumLevel: 2,
  requiredApprovals: 1,
  prohibitedConflicts: ["vendor-interest"],
};

const requester = {
  id: "human-1", principalType: "human", active: true,
  rank: "Secretary", level: 2, permissions: ["content:submit"], conflicts: [],
};

const approver = {
  id: "human-2", principalType: "human", active: true,
  rank: "Director", level: 3, permissions: ["content:approve"], conflicts: [],
};

test("rank and level remain separate policy attributes", () => {
  const result = evaluateDecision({
    request: { id: "d-1", title: "Publish field guide" },
    requester,
    policy,
  });
  assert.equal(result.eligibleToSubmit, true);
  assert.equal(requester.rank, "Secretary");
  assert.equal(requester.level, 2);
});

test("AI principals cannot submit as accountable human requesters", () => {
  const result = evaluateDecision({
    request: { id: "d-2", title: "Automated publish" },
    requester: { ...requester, principalType: "agent" },
    policy,
  });
  assert.equal(result.eligibleToSubmit, false);
  assert.ok(result.reasons.includes("REQUESTER_MUST_BE_ACTIVE_HUMAN"));
});

test("missing permission fails closed", () => {
  const result = evaluateDecision({
    request: { id: "d-3", title: "Publish product claim" },
    requester: { ...requester, permissions: [] },
    policy,
  });
  assert.ok(result.reasons.includes("REQUESTER_LACKS_PERMISSION"));
});

test("requester cannot approve their own decision", () => {
  const ledger = new AuditLedger();
  const decision = createDecision({
    request: { id: "d-4", title: "Publish field guide" },
    requester, policy, ledger,
  });
  assert.throws(
    () => recordApproval({ decision, approver: requester, policy, ledger }),
    /SELF_APPROVAL_PROHIBITED/,
  );
});

test("eligible distinct human approval completes the decision", () => {
  const ledger = new AuditLedger();
  const decision = createDecision({
    request: { id: "d-5", title: "Publish field guide" },
    requester, policy, ledger,
  });
  recordApproval({ decision, approver, policy, ledger });
  assert.equal(decision.status, "approved");
  assert.equal(decision.approvals.length, 1);
});

test("conflicted approver is rejected", () => {
  const ledger = new AuditLedger();
  const decision = createDecision({
    request: { id: "d-6", title: "Approve vendor listing" },
    requester, policy, ledger,
  });
  assert.throws(
    () => recordApproval({
      decision,
      approver: { ...approver, conflicts: ["vendor-interest"] },
      policy,
      ledger,
    }),
    /APPROVER_HAS_PROHIBITED_CONFLICT/,
  );
});

test("rejection requires a human and a reason", () => {
  const ledger = new AuditLedger();
  const decision = createDecision({
    request: { id: "d-7", title: "Publish field guide" },
    requester, policy, ledger,
  });
  assert.throws(() => rejectDecision({
    decision, actor: { ...approver, principalType: "agent" }, reason: "No", ledger,
  }), /REJECTION_REQUIRES_ACTIVE_HUMAN/);
  rejectDecision({ decision, actor: approver, reason: "Evidence is incomplete", ledger });
  assert.equal(decision.status, "rejected");
});

test("human override requires permission and reason and is separately logged", () => {
  const ledger = new AuditLedger();
  const decision = createDecision({
    request: { id: "d-8", title: "Publish field guide" },
    requester, policy, ledger,
  });
  assert.throws(() => overrideDecision({
    decision, human: approver, reason: "Urgent", ledger,
  }), /OVERRIDE_PERMISSION_REQUIRED/);
  overrideDecision({
    decision,
    human: { ...approver, permissions: [...approver.permissions, "governance:override"] },
    reason: "Board-directed exception; evidence attached to case record",
    ledger,
  });
  assert.equal(decision.status, "overridden");
  assert.equal(ledger.list().at(-1).type, "human_override");
});

test("audit ledger verifies its hash-linked event sequence", () => {
  const ledger = new AuditLedger();
  const decision = createDecision({
    request: { id: "d-9", title: "Publish field guide" },
    requester, policy, ledger,
  });
  recordApproval({ decision, approver, policy, ledger });
  assert.equal(ledger.verify(), true);
  assert.equal(ledger.list()[1].previousHash, ledger.list()[0].hash);
});


test("blocked decisions cannot be approved", () => {
  const ledger = new AuditLedger();
  const blocked = createDecision({
    request: { id: "d-10", title: "Submit without permission" },
    requester: { ...requester, permissions: [] },
    policy,
    ledger,
  });
  assert.equal(blocked.status, "blocked");
  assert.throws(
    () => recordApproval({ decision: blocked, approver, policy, ledger }),
    /DECISION_NOT_ELIGIBLE_FOR_APPROVAL/,
  );
});

test("approval policy cannot be configured with zero approvals", () => {
  const result = evaluateDecision({
    request: { id: "d-11", title: "Bypass approval" },
    requester,
    policy: { ...policy, requiredApprovals: 0 },
  });
  assert.equal(result.eligibleToSubmit, false);
  assert.ok(result.reasons.includes("POLICY_REQUIRED_APPROVALS_INVALID"));
});

test("audit events snapshot nested data and returned copies cannot alter the ledger", () => {
  const ledger = new AuditLedger();
  const reasons = ["first"];
  ledger.append({ type: "test", reasons });
  reasons.push("mutated input");
  const exposed = ledger.list();
  exposed[0].reasons.push("mutated read");
  assert.deepEqual(ledger.list()[0].reasons, ["first"]);
  assert.equal(ledger.verify(), true);
});


test("Blackpine Secretary rank alone does not grant publish authority", () => {
  const secretary = {
    id: "bp-secretary", principalType: "human", active: true,
    rank: "Secretary", level: 4, permissions: [], conflicts: [],
  };
  const result = evaluateDecision({
    request: { id: "bp-1", title: "Publish approved field guide" },
    requester: secretary,
    policy: blackpinePolicies.productionPublish,
  });
  assert.equal(result.eligibleToSubmit, false);
  assert.ok(result.reasons.includes("REQUESTER_LACKS_PERMISSION"));
});

test("Blackpine high level without the required office permission is insufficient", () => {
  const editor = {
    id: "bp-editor", principalType: "human", active: true,
    rank: "Editor", level: 4,
    permissions: ["blackpine:content:submit"], conflicts: [],
  };
  const result = evaluateDecision({
    request: { id: "bp-2", title: "Change payout account" },
    requester: editor,
    policy: blackpinePolicies.financialAccountChange,
  });
  assert.equal(result.eligibleToSubmit, false);
  assert.ok(result.reasons.includes("REQUESTER_LACKS_PERMISSION"));
});

test("Blackpine product claims require a higher evidence level than editorial drafts", () => {
  assert.ok(blackpinePolicies.productClaim.minimumLevel > blackpinePolicies.contentDraft.minimumLevel);
  assert.equal(blackpinePolicies.productClaim.approverPermission, "blackpine:claim:verify");
});

test("Blackpine production publication requires owner approval", () => {
  assert.equal(blackpinePolicies.productionPublish.approverPermission, "blackpine:owner:approve");
  assert.equal(blackpinePolicies.productionPublish.minimumLevel, 4);
});


test("Blackpine product claims are blocked without source evidence", () => {
  const claimAuthor = {
    id: "bp-researcher", principalType: "human", active: true,
    rank: "Researcher", level: 3,
    permissions: ["blackpine:claim:submit"], conflicts: [],
  };
  const result = evaluateDecision({
    request: { id: "bp-claim-1", title: "Claim battery runtime" },
    requester: claimAuthor,
    policy: blackpinePolicies.productClaim,
  });
  assert.equal(result.eligibleToSubmit, false);
  assert.ok(result.reasons.includes("REQUIRED_EVIDENCE_MISSING:manufacturer-source"));
});

test("Blackpine hands-on claims require possession, date, conditions, and load evidence", () => {
  const claimAuthor = {
    id: "bp-researcher", principalType: "human", active: true,
    rank: "Researcher", level: 3,
    permissions: ["blackpine:claim:submit"], conflicts: [],
  };
  const evidence = [
    { type: "manufacturer-source", reference: "source://manufacturer/spec" },
    { type: "specification-record", reference: "record://spec-001" },
  ];
  const result = evaluateDecision({
    request: {
      id: "bp-claim-2", title: "Hands-on durability verdict",
      claimsHandsOnTesting: true, evidence,
    },
    requester: claimAuthor,
    policy: blackpinePolicies.productClaim,
  });
  assert.equal(result.eligibleToSubmit, false);
  assert.ok(result.reasons.includes("REQUIRED_EVIDENCE_MISSING:possession-record"));
  assert.ok(result.reasons.includes("REQUIRED_EVIDENCE_MISSING:load-record"));
});


const delegationIssuer = {
  id: "human-delegator", principalType: "human", active: true,
  rank: "Owner", level: 5,
  permissions: ["governance:delegate", "content:submit", "content:approve"],
  conflicts: [],
};
const delegate = {
  id: "human-delegate", principalType: "human", active: true,
  rank: "Assistant Secretary", level: 3, permissions: [], conflicts: [],
};

test("delegation grants only held permissions for an exact scope and expires", () => {
  const registry = new DelegationRegistry();
  const ledger = new AuditLedger();
  const now = new Date("2026-11-16T12:00:00.000Z");
  const grant = grantDelegation({
    delegator: delegationIssuer, delegate,
    permissions: ["content:submit"],
    scope: "blackpine:field-guides",
    expiresAt: "2026-11-17T12:00:00.000Z",
    reason: "Temporary editorial coverage",
    registry, ledger, now,
  });
  assert.equal(grant.subdelegationAllowed, false);
  assert.equal(resolveDelegatedAuthority({
    actor: delegate, permission: "content:submit",
    scope: "blackpine:field-guides", registry, now,
  }).allowed, true);
  assert.equal(resolveDelegatedAuthority({
    actor: delegate, permission: "content:submit",
    scope: "blackpine:financial-accounts", registry, now,
  }).allowed, false);
  assert.equal(resolveDelegatedAuthority({
    actor: delegate, permission: "content:submit",
    scope: "blackpine:field-guides", registry,
    now: new Date("2026-11-18T12:00:00.000Z"),
  }).allowed, false);
  assert.equal(ledger.verify(), true);
});

test("delegated permission can submit a scoped decision but cannot approve itself", () => {
  const registry = new DelegationRegistry();
  const ledger = new AuditLedger();
  const now = new Date("2026-11-16T12:00:00.000Z");
  grantDelegation({
    delegator: delegationIssuer, delegate,
    permissions: ["content:submit"],
    scope: "blackpine:field-guides",
    expiresAt: "2026-11-17T12:00:00.000Z",
    reason: "Temporary editorial coverage",
    registry, ledger, now,
  });
  const decision = createDecision({
    request: { id: "d-delegated-1", title: "Submit guide", scope: "blackpine:field-guides" },
    requester: delegate, policy, ledger, delegationRegistry: registry, now,
  });
  assert.equal(decision.status, "pending_approval");
  assert.equal(decision.permissionSource, "delegated");
  assert.throws(
    () => recordApproval({ decision, approver: delegate, policy, ledger, delegationRegistry: registry, now }),
    /SELF_APPROVAL_PROHIBITED/,
  );
});

test("delegated approval is recorded as delegated and remains subject to all other checks", () => {
  const registry = new DelegationRegistry();
  const ledger = new AuditLedger();
  const now = new Date("2026-11-16T12:00:00.000Z");
  const approvalDelegate = { ...delegate, id: "human-approval-delegate" };
  grantDelegation({
    delegator: delegationIssuer, delegate: approvalDelegate,
    permissions: ["content:approve"],
    scope: "blackpine:field-guides",
    expiresAt: "2026-11-17T12:00:00.000Z",
    reason: "Temporary approval coverage",
    registry, ledger, now,
  });
  const decision = createDecision({
    request: { id: "d-delegated-2", title: "Submit guide", scope: "blackpine:field-guides" },
    requester, policy, ledger, now,
  });
  recordApproval({
    decision, approver: approvalDelegate, policy, ledger,
    delegationRegistry: registry, now,
  });
  assert.equal(decision.status, "approved");
  assert.equal(decision.approvals[0].permissionSource, "delegated");
});

test("delegation cannot transfer override, delegation, or Blackpine owner approval", () => {
  const registry = new DelegationRegistry();
  const ledger = new AuditLedger();
  for (const permission of ["governance:override", "governance:delegate", "blackpine:owner:approve"]) {
    assert.throws(() => grantDelegation({
      delegator: delegationIssuer, delegate, permissions: [permission],
      scope: "blackpine:field-guides",
      expiresAt: "2026-11-17T12:00:00.000Z",
      reason: "Attempt to transfer reserved authority",
      registry, ledger,
    }), /NON_DELEGABLE_PERMISSION_REQUESTED/);
  }
});

test("delegation issuer cannot delegate permissions they do not hold", () => {
  const registry = new DelegationRegistry();
  const ledger = new AuditLedger();
  assert.throws(() => grantDelegation({
    delegator: delegationIssuer, delegate,
    permissions: ["blackpine:finance:request"],
    scope: "blackpine:financial-accounts",
    expiresAt: "2026-11-17T12:00:00.000Z",
    reason: "Attempt to exceed authority",
    registry, ledger,
  }), /DELEGATOR_CANNOT_DELEGATE_UNHELD_PERMISSION/);
});

test("delegator can revoke a grant immediately and revocation is audited", () => {
  const registry = new DelegationRegistry();
  const ledger = new AuditLedger();
  const grant = grantDelegation({
    delegator: delegationIssuer, delegate,
    permissions: ["content:submit"],
    scope: "blackpine:field-guides",
    expiresAt: "2026-11-17T12:00:00.000Z",
    reason: "Temporary editorial coverage",
    registry, ledger,
  });
  revokeDelegation({
    delegationId: grant.id, actor: delegationIssuer,
    reason: "Coverage ended", registry, ledger,
  });
  assert.equal(resolveDelegatedAuthority({
    actor: delegate, permission: "content:submit",
    scope: "blackpine:field-guides", registry,
  }).allowed, false);
  assert.equal(ledger.list().at(-1).type, "delegation_revoked");
  assert.equal(ledger.verify(), true);
});

test("delegation cannot be self-granted or issued by an agent", () => {
  const registry = new DelegationRegistry();
  const ledger = new AuditLedger();
  assert.throws(() => grantDelegation({
    delegator: delegationIssuer, delegate: delegationIssuer,
    permissions: ["content:submit"], scope: "blackpine:field-guides",
    expiresAt: "2026-11-17T12:00:00.000Z", reason: "Self grant",
    registry, ledger,
  }), /SELF_DELEGATION_PROHIBITED/);
  assert.throws(() => grantDelegation({
    delegator: { ...delegationIssuer, principalType: "agent" }, delegate,
    permissions: ["content:submit"], scope: "blackpine:field-guides",
    expiresAt: "2026-11-17T12:00:00.000Z", reason: "Agent grant",
    registry, ledger,
  }), /DELEGATION_REQUIRES_ACTIVE_HUMANS/);
});
