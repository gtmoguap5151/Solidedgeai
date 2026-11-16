import test from "node:test";
import assert from "node:assert/strict";
import {
  AuditLedger,
  createDecision,
  evaluateDecision,
  overrideDecision,
  recordApproval,
  rejectDecision,
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
