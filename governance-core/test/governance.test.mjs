import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { AuthorityRegistry, isVerifiedPrincipal } from "../src/authority-registry.mjs";
import { BLACKPINE_READ_PATHS, loadBlackpineSnapshot } from "../adapters/blackpine/repository-reader.mjs";
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

function createBlackpineTestAuthority() {
  const registry = new AuthorityRegistry();
  const ledger = new AuditLedger();
  const root = registry.bootstrap({
    identity: {
      id: "test-root-authority",
      principalType: "human",
      active: true,
      verified: true,
      rank: "Root Authority",
      issuer: "test-auth-adapter",
    },
    initialPermissions: [
      "governance:permission:grant",
      "governance:competency:certify",
      "governance:authority:revoke",
      "governance:delegate",
      "governance:override",
      "content:submit",
      "content:approve",
    ],
    initialCompetencies: [{
      domain: "general", level: 5,
      evidence: [{ type: "bootstrap-assessment", reference: "test://root/general-level-5" }],
    }],
    reason: "Controlled test bootstrap",
    ledger,
  });

  function principal({ id, rank = "Staff", permissions = [], levels = {}, conflicts = [] }) {
    for (const permission of permissions) {
      registry.issuePermission({
        issuer: root, subjectId: id, permission, scope: "*",
        expiresAt: "2035-01-01T00:00:00.000Z",
        reason: "Synthetic test permission", ledger,
      });
    }
    for (const [domain, level] of Object.entries(levels)) {
      registry.certifyCompetency({
        issuer: root, subjectId: id, domain, level,
        evidence: [{ type: "test-assessment", reference: `test://${id}/${domain}` }],
        expiresAt: "2035-01-01T00:00:00.000Z",
        reason: "Synthetic test competency", ledger,
      });
    }
    return registry.resolve({
      identity: {
        id, principalType: "human", active: true, verified: true,
        rank, conflicts, issuer: "test-auth-adapter",
      },
    });
  }

  return { registry, ledger, root, principal };
}

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
  rejectDecision({ decision, actor: approver, reason: "Evidence is incomplete", ledger, policy });
  assert.equal(decision.status, "rejected");
});

test("human override requires permission and reason and is separately logged", () => {
  const ledger = new AuditLedger();
  const overrideAuthority = createBlackpineTestAuthority();
  const decision = createDecision({
    request: { id: "d-8", title: "Publish field guide" },
    requester, policy, ledger,
  });
  const verifiedWithoutOverride = overrideAuthority.principal({
    id: "verified-without-override",
  });
  assert.throws(() => overrideDecision({
    decision,
    human: verifiedWithoutOverride,
    reason: "Urgent",
    ledger,
    authorityRegistry: overrideAuthority.registry,
  }), /OVERRIDE_PERMISSION_REQUIRED/);
  overrideDecision({
    decision,
    human: overrideAuthority.root,
    reason: "Board-directed exception; evidence attached to case record",
    ledger,
    authorityRegistry: overrideAuthority.registry,
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
    rank: "Secretary", level: 99, levels: { "release-management": 4 }, permissions: [], conflicts: [],
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
    rank: "Editor", level: 99, levels: { "financial-controls": 4 },
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
  assert.equal(blackpinePolicies.productClaim.levelDomain, "product-evidence");
  assert.equal(blackpinePolicies.contentDraft.levelDomain, "editorial");
  assert.equal(blackpinePolicies.productClaim.approverPermission, "blackpine:claim:verify");
});

test("Blackpine production publication requires owner approval", () => {
  assert.equal(blackpinePolicies.productionPublish.approverPermission, "blackpine:owner:approve");
  assert.equal(blackpinePolicies.productionPublish.minimumLevel, 4);
});


test("Blackpine product claims are blocked without source evidence", () => {
  const claimAuthor = {
    id: "bp-researcher", principalType: "human", active: true,
    rank: "Researcher", levels: { "product-evidence": 3 },
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
    rank: "Researcher", levels: { "product-evidence": 3 },
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


const delegationAuthorityFixture = createBlackpineTestAuthority();
const delegationIssuer = delegationAuthorityFixture.root;
const delegate = delegationAuthorityFixture.principal({
  id: "human-delegate",
  rank: "Assistant Secretary",
  levels: { general: 3 },
});

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
    registry, authorityRegistry: delegationAuthorityFixture.registry, ledger, now,
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
    registry, authorityRegistry: delegationAuthorityFixture.registry, ledger, now,
  });
  const decision = createDecision({
    request: { id: "d-delegated-1", title: "Submit guide", scope: "blackpine:field-guides" },
    requester: delegate, policy, ledger, delegationRegistry: registry, authorityRegistry: delegationAuthorityFixture.registry, now,
  });
  assert.equal(decision.status, "pending_approval");
  assert.equal(decision.permissionSource, "delegated");
  assert.throws(
    () => recordApproval({ decision, approver: delegate, policy, ledger, delegationRegistry: registry, authorityRegistry: delegationAuthorityFixture.registry, now }),
    /SELF_APPROVAL_PROHIBITED/,
  );
  assert.throws(
    () => recordApproval({ decision, approver: delegationIssuer, policy, ledger, delegationRegistry: registry, authorityRegistry: delegationAuthorityFixture.registry, now }),
    /DELEGATION_GRANTOR_CANNOT_APPROVE/,
  );
});

test("delegated approval is recorded as delegated and remains subject to all other checks", () => {
  const registry = new DelegationRegistry();
  const ledger = new AuditLedger();
  const now = new Date("2026-11-16T12:00:00.000Z");
  const approvalDelegate = delegationAuthorityFixture.principal({
    id: "human-approval-delegate",
    rank: "Assistant Secretary",
    levels: { general: 3 },
  });
  grantDelegation({
    delegator: delegationIssuer, delegate: approvalDelegate,
    permissions: ["content:approve"],
    scope: "blackpine:field-guides",
    expiresAt: "2026-11-17T12:00:00.000Z",
    reason: "Temporary approval coverage",
    registry, authorityRegistry: delegationAuthorityFixture.registry, ledger, now,
  });
  const decision = createDecision({
    request: { id: "d-delegated-2", title: "Submit guide", scope: "blackpine:field-guides" },
    requester, policy, ledger, now,
  });
  recordApproval({
    decision, approver: approvalDelegate, policy, ledger,
    delegationRegistry: registry, authorityRegistry: delegationAuthorityFixture.registry, now,
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
      registry, authorityRegistry: delegationAuthorityFixture.registry, ledger,
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
    registry, authorityRegistry: delegationAuthorityFixture.registry, ledger,
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
    registry, authorityRegistry: delegationAuthorityFixture.registry, ledger,
  });
  revokeDelegation({
    delegationId: grant.id, actor: delegationIssuer,
    reason: "Coverage ended", registry, authorityRegistry: delegationAuthorityFixture.registry, ledger,
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
    registry, authorityRegistry: delegationAuthorityFixture.registry, ledger,
  }), /SELF_DELEGATION_PROHIBITED/);
  assert.throws(() => grantDelegation({
    delegator: { ...delegationIssuer, principalType: "agent" }, delegate,
    permissions: ["content:submit"], scope: "blackpine:field-guides",
    expiresAt: "2026-11-17T12:00:00.000Z", reason: "Agent grant",
    registry, authorityRegistry: delegationAuthorityFixture.registry, ledger,
  }), /DELEGATION_REQUIRES_ACTIVE_HUMANS/);
});


test("delegation registry rejects direct writes without the governance capability", () => {
  const registry = new DelegationRegistry();
  assert.throws(() => registry.add({
    id: "forged", delegatorId: "attacker", delegateId: delegate.id,
    permissions: ["content:submit"], scope: "blackpine:field-guides",
    expiresAt: "2026-11-17T12:00:00.000Z",
  }), /REGISTRY_WRITE_NOT_AUTHORIZED/);
});

test("only the delegator or a separately authorized human can revoke a grant", () => {
  const registry = new DelegationRegistry();
  const ledger = new AuditLedger();
  const grant = grantDelegation({
    delegator: delegationIssuer, delegate,
    permissions: ["content:submit"], scope: "blackpine:field-guides",
    expiresAt: "2026-11-17T12:00:00.000Z",
    reason: "Temporary editorial coverage", registry, authorityRegistry: delegationAuthorityFixture.registry, ledger,
  });
  assert.throws(() => revokeDelegation({
    delegationId: grant.id, actor: delegate,
    reason: "Attempted revocation by recipient", registry, authorityRegistry: delegationAuthorityFixture.registry, ledger,
  }), /DELEGATION_REVOCATION_PERMISSION_REQUIRED/);
  assert.equal(registry.get(grant.id).revokedAt, null);
});


test("decision evaluation ignores untrusted objects masquerading as a delegation registry", () => {
  const fakeRegistry = {
    findActive: () => ({
      id: "forged-delegation", delegatorId: "attacker",
      delegateId: delegate.id, permissions: ["content:submit"],
      scope: "blackpine:field-guides",
    }),
  };
  const result = evaluateDecision({
    request: {
      id: "d-forged-registry", title: "Submit guide",
      scope: "blackpine:field-guides",
    },
    requester: delegate,
    policy,
    delegationRegistry: fakeRegistry,
  });
  assert.equal(result.eligibleToSubmit, false);
  assert.ok(result.reasons.includes("REQUESTER_LACKS_PERMISSION"));
});


function mockBlackpineFetch(fileContents, { tamperPath = null, truncated = false } = {}) {
  const blobSha = (content) => {
    const bytes = Buffer.from(content, "utf8");
    return createHash("sha1")
      .update(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`), bytes]))
      .digest("hex");
  };
  const tree = Object.entries(fileContents).map(([path, content]) => ({
    path, type: "blob", size: Buffer.byteLength(content, "utf8"), sha: blobSha(content),
  }));
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, method: options?.method });
    assert.equal(options?.method, "GET");
    if (url.includes("/git/trees/")) {
      return {
        ok: true,
        json: async () => ({ sha: "mock-tree-sha", truncated, tree }),
      };
    }
    const path = decodeURIComponent(url.split("/main/")[1]);
    let content = fileContents[path];
    if (path === tamperPath) content += "tampered";
    return { ok: true, text: async () => content };
  };
  return { fetchImpl, calls };
}

function blackpineFixtureFiles() {
  const files = {
    "site/index.html": "Some links on this page are affiliate links. Commission at no extra cost. Commissions never change our verdicts. We have not hands-on tested the products covered. We never invent test results. Right now it is $64 with Rewards, down from $160.",
    "brand-guide.md": "No hype. Honest limits.",
  };
  const drafts = [
    "launch-slate/01-cordura-vs-ballistic-nylon.md",
    "launch-slate/02-solar-generator-vs-gas-inverter.md",
    "launch-slate/03-best-water-filtration-preparedness.md",
  ];
  const published = [
    "site/cordura-vs-ballistic-nylon.html",
    "site/solar-generator-vs-gas-inverter.html",
    "site/best-water-filtration-preparedness.html",
  ];
  for (const path of drafts) {
    files[path] = "Format: research/spec comparison. No hands-on testing is claimed in this piece. **Sources (checked 2026-11-16):** published specifications.";
  }
  for (const path of published) files[path] = "<html>Published companion</html>";
  return files;
}

test("Blackpine repository adapter reads only allowlisted public files with GET", async () => {
  const mock = mockBlackpineFetch(blackpineFixtureFiles());
  const snapshot = await loadBlackpineSnapshot({ fetchImpl: mock.fetchImpl });
  assert.equal(snapshot.source.repository, "blackpine-field");
  assert.equal(snapshot.observations.affiliateDisclosurePresent, true);
  assert.equal(snapshot.observations.handsOnTestingDisclosurePresent, true);
  assert.equal(snapshot.observations.researchOnlyLabelsPresent, true);
  assert.equal(snapshot.observations.publishedCompanionsPresent, true);
  assert.equal(snapshot.observations.noHypeBrandRulePresent, true);
  assert.equal(snapshot.observations.timeSensitivePriceClaimsPresent, true);
  assert.equal(snapshot.observations.manufacturerSourceRecordsPresent, false);
  assert.ok(snapshot.evidence.some((item) => item.type === "affiliate-disclosure-check"));
  assert.ok(snapshot.evidence.some((item) => item.type === "source-reference-list"));
  assert.ok(snapshot.evidence.some((item) => item.type === "specification-record"));
  assert.ok(snapshot.files.every((file) => BLACKPINE_READ_PATHS.includes(file.path)));
  assert.ok(snapshot.files.every((file) => !("content" in file)));
  assert.ok(mock.calls.every((call) => call.method === "GET"));
  assert.ok(mock.calls.every((call) => call.url.startsWith("https://api.github.com/") || call.url.startsWith("https://raw.githubusercontent.com/")));
});

test("Blackpine repository adapter detects content that does not match the Git tree hash", async () => {
  const files = blackpineFixtureFiles();
  const mock = mockBlackpineFetch(files, { tamperPath: "site/index.html" });
  await assert.rejects(
    () => loadBlackpineSnapshot({ fetchImpl: mock.fetchImpl }),
    /BLACKPINE_FILE_INTEGRITY_MISMATCH/,
  );
});

test("Blackpine repository adapter rejects arbitrary refs and truncated trees", async () => {
  const mock = mockBlackpineFetch(blackpineFixtureFiles(), { truncated: true });
  await assert.rejects(
    () => loadBlackpineSnapshot({ fetchImpl: mock.fetchImpl, ref: "../main" }),
    /ref must be main or a full Git commit SHA/,
  );
  await assert.rejects(
    () => loadBlackpineSnapshot({ fetchImpl: mock.fetchImpl }),
    /BLACKPINE_REPOSITORY_TREE_TRUNCATED/,
  );
});


test("Blackpine snapshot evidence satisfies editorial controls but not unsupported product claims", async () => {
  const mock = mockBlackpineFetch(blackpineFixtureFiles());
  const snapshot = await loadBlackpineSnapshot({ fetchImpl: mock.fetchImpl });
  const authority = createBlackpineTestAuthority();
  const editor = authority.principal({
    id: "bp-editor-from-snapshot", rank: "Editor",
    levels: { editorial: 2 },
    permissions: ["blackpine:content:submit"],
  });
  const draft = evaluateDecision({
    request: {
      id: "bp-snapshot-draft", title: "Prepare research guide",
      scope: "blackpine:editorial", evidence: snapshot.evidence,
    },
    requester: editor,
    authorityRegistry: authority.registry,
    policy: blackpinePolicies.contentDraft,
  });
  assert.equal(draft.eligibleToSubmit, true, `reasons: ${draft.reasons.join(", ")}`);

  const researcher = authority.principal({
    id: "bp-snapshot-researcher", rank: "Researcher",
    levels: { "product-evidence": 3 },
    permissions: ["blackpine:claim:submit"],
  });
  const claim = evaluateDecision({
    request: {
      id: "bp-snapshot-claim", title: "Publish verified product claim",
      scope: "blackpine:product-claims", evidence: snapshot.evidence,
    },
    requester: researcher,
    authorityRegistry: authority.registry,
    policy: blackpinePolicies.productClaim,
  });
  assert.equal(claim.eligibleToSubmit, false);
  assert.ok(claim.reasons.includes("REQUIRED_EVIDENCE_MISSING:manufacturer-source"));
});


test("a high general level cannot substitute for a low product-evidence level", () => {
  const claimant = {
    id: "domain-claimant", principalType: "human", active: true,
    rank: "Researcher", level: 99,
    levels: { "product-evidence": 2 },
    permissions: ["blackpine:claim:submit"], conflicts: [],
  };
  const result = evaluateDecision({
    request: {
      id: "bp-domain-level-1", title: "Verify a product specification",
      evidence: [
        { type: "manufacturer-source", reference: "source://manufacturer" },
        { type: "specification-record", reference: "record://specification" },
      ],
    },
    requester: claimant,
    policy: blackpinePolicies.productClaim,
  });
  assert.equal(result.eligibleToSubmit, false);
  assert.ok(result.reasons.includes("REQUESTER_LEVEL_INSUFFICIENT"));
  assert.equal(result.requesterLevel, 2);
  assert.equal(result.levelDomain, "product-evidence");
});

test("approver must meet the policy's domain level, not merely a high general level", () => {
  const ledger = new AuditLedger();
  const domainPolicy = { ...policy, levelDomain: "editorial" };
  const domainRequester = {
    ...requester, level: 99, levels: { editorial: 2 },
  };
  const decision = createDecision({
    request: { id: "bp-domain-approval-1", title: "Review draft" },
    requester: domainRequester, policy: domainPolicy, ledger,
  });
  const underqualifiedApprover = {
    ...approver, level: 99, levels: { editorial: 1 },
  };
  assert.throws(
    () => recordApproval({ decision, approver: underqualifiedApprover, policy: domainPolicy, ledger }),
    /APPROVER_LEVEL_INSUFFICIENT/,
  );
});


test("a revoked delegation cannot be used to complete a pending decision", () => {
  const registry = new DelegationRegistry();
  const ledger = new AuditLedger();
  const now = new Date("2026-11-16T12:00:00.000Z");
  const grant = grantDelegation({
    delegator: delegationIssuer, delegate,
    permissions: ["content:submit"], scope: "blackpine:field-guides",
    expiresAt: "2026-11-17T12:00:00.000Z",
    reason: "Temporary editorial coverage", registry, authorityRegistry: delegationAuthorityFixture.registry, ledger, now,
  });
  const decision = createDecision({
    request: { id: "d-revoked-delegation", title: "Submit guide", scope: "blackpine:field-guides" },
    requester: delegate, policy, ledger, delegationRegistry: registry, authorityRegistry: delegationAuthorityFixture.registry, now,
  });
  revokeDelegation({
    delegationId: grant.id, actor: delegationIssuer,
    reason: "Authority withdrawn", registry, authorityRegistry: delegationAuthorityFixture.registry, ledger,
  });
  assert.throws(
    () => recordApproval({ decision, approver, policy, ledger, delegationRegistry: registry, authorityRegistry: delegationAuthorityFixture.registry, now }),
    /DELEGATED_AUTHORITY_NO_LONGER_ACTIVE/,
  );
  assert.equal(decision.status, "blocked");
  assert.ok(decision.reasons.includes("DELEGATED_AUTHORITY_NO_LONGER_ACTIVE"));
});

test("approval cannot substitute a different policy version after submission", () => {
  const ledger = new AuditLedger();
  const decision = createDecision({
    request: { id: "d-policy-version", title: "Submit guide" },
    requester, policy, ledger,
  });
  assert.throws(
    () => recordApproval({
      decision, approver,
      policy: { ...policy, version: "2.0.0" },
      ledger,
    }),
    /DECISION_POLICY_MISMATCH/,
  );
});

test("a delegated decision cannot be approved without its delegation registry", () => {
  const registry = new DelegationRegistry();
  const ledger = new AuditLedger();
  const now = new Date("2026-11-16T12:00:00.000Z");
  grantDelegation({
    delegator: delegationIssuer, delegate,
    permissions: ["content:submit"], scope: "blackpine:field-guides",
    expiresAt: "2026-11-17T12:00:00.000Z",
    reason: "Temporary editorial coverage", registry, authorityRegistry: delegationAuthorityFixture.registry, ledger, now,
  });
  const decision = createDecision({
    request: { id: "d-no-registry", title: "Submit guide", scope: "blackpine:field-guides" },
    requester: delegate, policy, ledger, delegationRegistry: registry, authorityRegistry: delegationAuthorityFixture.registry, now,
  });
  assert.throws(
    () => recordApproval({ decision, approver, policy, ledger, authorityRegistry: delegationAuthorityFixture.registry, now }),
    /DELEGATION_REGISTRY_REQUIRED_FOR_APPROVAL/,
  );
});


test("an active human without the policy rejection permission cannot reject", () => {
  const ledger = new AuditLedger();
  const decision = createDecision({
    request: { id: "d-reject-permission", title: "Submit guide" },
    requester, policy, ledger,
  });
  assert.throws(
    () => rejectDecision({
      decision, actor: { ...approver, permissions: [] },
      reason: "Not authorized", ledger, policy,
    }),
    /REJECTION_PERMISSION_REQUIRED/,
  );
});

test("a rejector must meet the same domain competency threshold", () => {
  const ledger = new AuditLedger();
  const domainPolicy = { ...policy, levelDomain: "editorial" };
  const domainRequester = { ...requester, levels: { editorial: 2 } };
  const decision = createDecision({
    request: { id: "d-reject-level", title: "Submit guide" },
    requester: domainRequester, policy: domainPolicy, ledger,
  });
  assert.throws(
    () => rejectDecision({
      decision,
      actor: { ...approver, levels: { editorial: 1 } },
      reason: "Not qualified", ledger, policy: domainPolicy,
    }),
    /REJECTOR_LEVEL_INSUFFICIENT/,
  );
});


test("decision handles cannot be externally mutated or forged", () => {
  const ledger = new AuditLedger();
  const decision = createDecision({
    request: { id: "d-immutable-handle", title: "Submit guide" },
    requester, policy, ledger,
  });
  assert.throws(() => { decision.status = "approved"; }, TypeError);
  const exposedApprovals = decision.approvals;
  exposedApprovals.push({ approverId: "forged-human" });
  assert.equal(decision.approvals.length, 0);
  assert.throws(
    () => recordApproval({ decision: { ...decision }, approver, policy, ledger }),
    /UNTRUSTED_DECISION_HANDLE/,
  );
  recordApproval({ decision, approver, policy, ledger });
  assert.equal(decision.status, "approved");
  assert.equal(decision.approvals.length, 1);
});


test("policy digest prevents same-version policy substitution", () => {
  const ledger = new AuditLedger();
  const decision = createDecision({
    request: { id: "d-policy-digest", title: "Submit guide" },
    requester, policy, ledger,
  });
  const substitutedPolicy = { ...policy, minimumLevel: 3 };
  assert.equal(substitutedPolicy.id, policy.id);
  assert.equal(substitutedPolicy.version, policy.version);
  assert.throws(
    () => recordApproval({ decision, approver, policy: substitutedPolicy, ledger }),
    /DECISION_POLICY_MISMATCH/,
  );
});

test("malformed policy evidence definitions fail closed", () => {
  const result = evaluateDecision({
    request: { id: "d-malformed-policy", title: "Submit guide" },
    requester,
    policy: { ...policy, requiredEvidence: "source-check" },
  });
  assert.equal(result.status, "blocked");
  assert.ok(result.reasons.includes("POLICY_REQUIRED_EVIDENCE_INVALID"));
});

test("malformed request evidence fails closed", () => {
  const result = evaluateDecision({
    request: { id: "d-malformed-evidence", title: "Submit guide", evidence: "not-an-array" },
    requester,
    policy,
  });
  assert.equal(result.status, "blocked");
  assert.ok(result.reasons.includes("REQUEST_EVIDENCE_INVALID"));
});


test("Blackpine live-snapshot evidence completes an editorial decision lifecycle and blocks unsupported claims", async () => {
  const mock = mockBlackpineFetch(blackpineFixtureFiles());
  const snapshot = await loadBlackpineSnapshot({ fetchImpl: mock.fetchImpl });
  const ledger = new AuditLedger();
  const authority = createBlackpineTestAuthority();
  const editorialRequester = authority.principal({
    id: "bp-lifecycle-editor", rank: "Editor",
    levels: { editorial: 2 }, permissions: ["blackpine:content:submit"],
  });
  const editorialApprover = authority.principal({
    id: "bp-lifecycle-approver", rank: "Owner",
    levels: { editorial: 2 }, permissions: ["blackpine:content:approve"],
  });
  const editorial = createDecision({
    request: {
      id: "bp-lifecycle-editorial", title: "Research guide draft",
      scope: "blackpine:editorial", evidence: snapshot.evidence,
    },
    requester: editorialRequester,
    policy: blackpinePolicies.contentDraft,
    ledger,
    authorityRegistry: authority.registry,
  });
  assert.equal(editorial.status, "pending_approval", `reasons: ${editorial.reasons.join(", ")}`);
  recordApproval({
    decision: editorial, approver: editorialApprover,
    policy: blackpinePolicies.contentDraft, ledger,
    authorityRegistry: authority.registry,
    reviewedEvidenceDigest: editorial.evidenceDigest,
  });
  assert.equal(editorial.status, "approved");

  const productClaim = createDecision({
    request: {
      id: "bp-lifecycle-product-claim", title: "Verified product claim",
      scope: "blackpine:product-claims", evidence: snapshot.evidence,
    },
    requester: authority.principal({
      id: "bp-lifecycle-researcher", rank: "Researcher",
      levels: { "product-evidence": 3 },
      permissions: ["blackpine:claim:submit"],
    }),
    policy: blackpinePolicies.productClaim,
    ledger,
    authorityRegistry: authority.registry,
  });
  assert.equal(productClaim.status, "blocked");
  assert.throws(
    () => recordApproval({
      decision: productClaim,
      approver: authority.principal({
        id: "bp-lifecycle-claim-approver", rank: "Verifier",
        levels: { "product-evidence": 3 },
        permissions: ["blackpine:claim:verify"],
      }),
      policy: blackpinePolicies.productClaim,
      ledger, authorityRegistry: authority.registry,
    }),
    /DECISION_NOT_ELIGIBLE_FOR_APPROVAL/,
  );
  assert.equal(ledger.verify(), true);
});


test("authority registry resolves verified identities with scoped permissions and domain credentials", () => {
  const authority = createBlackpineTestAuthority();
  const { registry, root, ledger } = authority;
  registry.issuePermission({
    issuer: root, subjectId: "scoped-editor", permission: "scoped:content:submit",
    scope: "blackpine:guide-a", expiresAt: "2035-01-01T00:00:00.000Z",
    reason: "Bounded editorial assignment", ledger,
  });
  registry.certifyCompetency({
    issuer: root, subjectId: "scoped-editor", domain: "editorial", level: 2,
    evidence: [{ type: "assessment", reference: "assessment://editorial-2" }],
    expiresAt: "2035-01-01T00:00:00.000Z",
    reason: "Editorial competency assessment", ledger,
  });
  const principal = registry.resolve({
    identity: {
      id: "scoped-editor", principalType: "human", active: true,
      verified: true, rank: "Editor", issuer: "test-auth-adapter",
    },
  });
  assert.equal(isVerifiedPrincipal(principal), true);
  assert.equal(principal.levels.editorial, 2);
  assert.equal(principal.permissions.includes("scoped:content:submit"), false);

  const scopedPolicy = {
    id: "scoped-editorial", version: "1.0.0",
    permission: "scoped:content:submit", minimumLevel: 2,
    levelDomain: "editorial", requiredApprovals: 1,
    requireVerifiedIdentity: true,
  };
  const allowed = evaluateDecision({
    request: {
      id: "scoped-a", title: "Submit guide A",
      scope: "blackpine:guide-a",
    },
    requester: principal, policy: scopedPolicy, authorityRegistry: registry,
  });
  const denied = evaluateDecision({
    request: {
      id: "scoped-b", title: "Submit guide B",
      scope: "blackpine:guide-b",
    },
    requester: principal, policy: scopedPolicy, authorityRegistry: registry,
  });
  assert.equal(allowed.eligibleToSubmit, true);
  assert.equal(denied.eligibleToSubmit, false);
  assert.ok(denied.reasons.includes("REQUESTER_LACKS_PERMISSION"));
  assert.equal(ledger.verify(), true);
});

test("authority registry refuses unverified identities and unauthorized issuers", () => {
  const registry = new AuthorityRegistry();
  const ledger = new AuditLedger();
  assert.throws(() => registry.bootstrap({
    identity: { id: "fake-root", principalType: "human", active: true, verified: false },
    initialPermissions: ["governance:permission:grant"],
    reason: "Unverified bootstrap", ledger,
  }), /BOOTSTRAP_REQUIRES_VERIFIED_ACTIVE_HUMAN/);

  const authority = createBlackpineTestAuthority();
  const unprivileged = authority.principal({
    id: "unprivileged-issuer", permissions: [],
  });
  assert.throws(() => authority.registry.issuePermission({
    issuer: unprivileged, subjectId: "target", permission: "content:submit",
    scope: "*", expiresAt: "2035-01-01T00:00:00.000Z",
    reason: "Unauthorized grant", ledger: authority.ledger,
  }), /PERMISSION_GRANT_AUTHORITY_REQUIRED/);
});

test("authority registry prevents self-grants, self-certification, and reserved permission grants", () => {
  const authority = createBlackpineTestAuthority();
  const { registry, root, ledger } = authority;
  assert.throws(() => registry.issuePermission({
    issuer: root, subjectId: root.id, permission: "content:submit",
    scope: "*", expiresAt: "2035-01-01T00:00:00.000Z",
    reason: "Self grant", ledger,
  }), /SELF_PERMISSION_GRANT_PROHIBITED/);
  assert.throws(() => registry.certifyCompetency({
    issuer: root, subjectId: root.id, domain: "editorial", level: 5,
    evidence: [{ type: "assessment", reference: "assessment://self" }],
    expiresAt: "2035-01-01T00:00:00.000Z",
    reason: "Self certification", ledger,
  }), /SELF_CERTIFICATION_PROHIBITED/);
  assert.throws(() => registry.issuePermission({
    issuer: root, subjectId: "target", permission: "governance:override",
    scope: "*", expiresAt: "2035-01-01T00:00:00.000Z",
    reason: "Attempt to grant reserved permission", ledger,
  }), /RESERVED_PERMISSION_REQUIRES_BOOTSTRAP/);
});

test("authority revocation removes permission and competency on the next principal resolution", () => {
  const authority = createBlackpineTestAuthority();
  const { registry, root, ledger } = authority;
  const permission = registry.issuePermission({
    issuer: root, subjectId: "revoked-subject", permission: "content:submit",
    scope: "*", expiresAt: "2035-01-01T00:00:00.000Z",
    reason: "Temporary permission", ledger,
  });
  const competency = registry.certifyCompetency({
    issuer: root, subjectId: "revoked-subject", domain: "editorial", level: 3,
    evidence: [{ type: "assessment", reference: "assessment://editorial-3" }],
    expiresAt: "2035-01-01T00:00:00.000Z",
    reason: "Temporary competency", ledger,
  });
  const identity = {
    id: "revoked-subject", principalType: "human", active: true,
    verified: true, rank: "Editor",
  };
  const before = registry.resolve({ identity });
  assert.ok(before.permissions.includes("content:submit"));
  assert.equal(before.levels.editorial, 3);

  registry.revoke({ recordId: permission.id, actor: root, reason: "Permission withdrawn", ledger });
  registry.revoke({ recordId: competency.id, actor: root, reason: "Competency expired after review", ledger });
  const after = registry.resolve({ identity });
  assert.equal(after.permissions.includes("content:submit"), false);
  assert.equal(after.levels.editorial, undefined);
  assert.equal(ledger.verify(), true);
});

test("authority records expire and cannot be revived by resolution", () => {
  const authority = createBlackpineTestAuthority();
  const { registry, root, ledger } = authority;
  registry.issuePermission({
    issuer: root, subjectId: "expired-subject", permission: "content:submit",
    scope: "*", expiresAt: "2026-11-17T00:00:00.000Z",
    reason: "One-day access", ledger,
  });
  const identity = {
    id: "expired-subject", principalType: "human", active: true,
    verified: true, rank: "Editor",
  };
  const before = registry.resolve({ identity, now: new Date("2026-11-16T12:00:00.000Z") });
  const after = registry.resolve({ identity, now: new Date("2026-11-18T12:00:00.000Z") });
  assert.ok(before.permissions.includes("content:submit"));
  assert.equal(after.permissions.includes("content:submit"), false);
});


test("requester permission revoked while pending blocks approval", () => {
  const authority = createBlackpineTestAuthority();
  const editor = authority.principal({
    id: "pending-revoked-permission-editor",
    rank: "Editor",
    levels: { editorial: 2 },
    permissions: ["blackpine:content:submit"],
  });
  const approver = authority.principal({
    id: "pending-revoked-permission-approver",
    rank: "Owner",
    levels: { editorial: 2 },
    permissions: ["blackpine:content:approve"],
  });
  const decision = createDecision({
    request: {
      id: "pending-revoked-permission",
      title: "Research guide awaiting approval",
      scope: "blackpine:editorial",
      evidence: [
        { type: "source-reference-list", reference: "fixture://sources" },
        { type: "affiliate-disclosure-check", reference: "fixture://disclosure" },
      ],
    },
    requester: editor,
    policy: blackpinePolicies.contentDraft,
    ledger: authority.ledger,
    authorityRegistry: authority.registry,
  });
  assert.equal(decision.status, "pending_approval");

  const grant = authority.registry.listRecords().find((record) =>
    record.recordType === "permission" &&
    record.subjectId === editor.id &&
    record.permission === "blackpine:content:submit"
  );
  assert.ok(grant);
  authority.registry.revoke({
    recordId: grant.id,
    actor: authority.root,
    reason: "Requester permission withdrawn before approval",
    ledger: authority.ledger,
  });

  assert.throws(
    () => recordApproval({
      decision,
      approver,
      policy: blackpinePolicies.contentDraft,
      ledger: authority.ledger,
      authorityRegistry: authority.registry,
      reviewedEvidenceDigest: decision.evidenceDigest,
    }),
    /REQUESTER_AUTHORITY_GRANT_NO_LONGER_ACTIVE/,
  );
  assert.equal(decision.status, "blocked");
  assert.ok(decision.reasons.includes("REQUESTER_AUTHORITY_GRANT_NO_LONGER_ACTIVE"));
  assert.equal(authority.ledger.verify(), true);
});

test("requester competency revoked while pending blocks approval", () => {
  const authority = createBlackpineTestAuthority();
  const editor = authority.principal({
    id: "pending-revoked-competency-editor",
    rank: "Editor",
    levels: { editorial: 2 },
    permissions: ["blackpine:content:submit"],
  });
  const approver = authority.principal({
    id: "pending-revoked-competency-approver",
    rank: "Owner",
    levels: { editorial: 2 },
    permissions: ["blackpine:content:approve"],
  });
  const decision = createDecision({
    request: {
      id: "pending-revoked-competency",
      title: "Research guide awaiting approval",
      scope: "blackpine:editorial",
      evidence: [
        { type: "source-reference-list", reference: "fixture://sources" },
        { type: "affiliate-disclosure-check", reference: "fixture://disclosure" },
      ],
    },
    requester: editor,
    policy: blackpinePolicies.contentDraft,
    ledger: authority.ledger,
    authorityRegistry: authority.registry,
  });
  assert.equal(decision.status, "pending_approval");

  const credential = authority.registry.listRecords().find((record) =>
    record.recordType === "competency" &&
    record.subjectId === editor.id &&
    record.domain === "editorial"
  );
  assert.ok(credential);
  authority.registry.revoke({
    recordId: credential.id,
    actor: authority.root,
    reason: "Editorial competency withdrawn before approval",
    ledger: authority.ledger,
  });

  assert.throws(
    () => recordApproval({
      decision,
      approver,
      policy: blackpinePolicies.contentDraft,
      ledger: authority.ledger,
      authorityRegistry: authority.registry,
      reviewedEvidenceDigest: decision.evidenceDigest,
    }),
    /DECISION_AUTHORITY_OR_EVIDENCE_NO_LONGER_VALID/,
  );
  assert.equal(decision.status, "blocked");
  assert.ok(decision.reasons.includes("REQUESTER_DOMAIN_LEVEL_INVALID"));
  assert.equal(authority.ledger.verify(), true);
});


test("verified Blackpine policies fail closed without a live authority registry", () => {
  const authority = createBlackpineTestAuthority();
  const principal = authority.principal({
    id: "verified-without-registry", rank: "Editor",
    levels: { editorial: 2 },
    permissions: ["blackpine:content:submit"],
  });
  const result = evaluateDecision({
    request: {
      id: "bp-no-authority-registry", title: "Submit editorial draft",
      scope: "blackpine:editorial",
      evidence: [
        { type: "source-reference-list", reference: "source://list" },
        { type: "affiliate-disclosure-check", reference: "site://disclosure" },
      ],
    },
    requester: principal,
    policy: blackpinePolicies.contentDraft,
  });
  assert.equal(result.eligibleToSubmit, false);
  assert.ok(result.reasons.includes("AUTHORITY_REGISTRY_REQUIRED"));
});

test("revoking a permission grant after submission blocks the pending decision", () => {
  const authority = createBlackpineTestAuthority();
  const { registry, root, ledger } = authority;
  const requesterGrant = registry.issuePermission({
    issuer: root, subjectId: "permission-revoked-requester",
    permission: "scoped:submit", scope: "*",
    expiresAt: "2035-01-01T00:00:00.000Z",
    reason: "Temporary request permission", ledger,
  });
  registry.certifyCompetency({
    issuer: root, subjectId: "permission-revoked-requester",
    domain: "editorial", level: 2,
    evidence: [{ type: "assessment", reference: "assessment://permission-revoked" }],
    expiresAt: "2035-01-01T00:00:00.000Z",
    reason: "Editorial competency", ledger,
  });
  const requesterPrincipal = registry.resolve({
    identity: { id: "permission-revoked-requester", principalType: "human", active: true, verified: true },
  });
  const approverGrant = registry.issuePermission({
    issuer: root, subjectId: "permission-revoked-approver",
    permission: "scoped:approve", scope: "*",
    expiresAt: "2035-01-01T00:00:00.000Z",
    reason: "Approval permission", ledger,
  });
  registry.certifyCompetency({
    issuer: root, subjectId: "permission-revoked-approver",
    domain: "editorial", level: 2,
    evidence: [{ type: "assessment", reference: "assessment://approver" }],
    expiresAt: "2035-01-01T00:00:00.000Z",
    reason: "Editorial competency", ledger,
  });
  const approverPrincipal = registry.resolve({
    identity: { id: "permission-revoked-approver", principalType: "human", active: true, verified: true },
  });
  const policy = {
    id: "permission-revocation-test", version: "1.0.0",
    permission: "scoped:submit", approverPermission: "scoped:approve",
    minimumLevel: 2, levelDomain: "editorial", requiredApprovals: 1,
    requireVerifiedIdentity: true,
  };
  const decision = createDecision({
    request: { id: "permission-revocation-decision", title: "Submit draft", scope: "blackpine:editorial" },
    requester: requesterPrincipal, policy, ledger, authorityRegistry: registry,
  });
  registry.revoke({
    recordId: requesterGrant.id, actor: root,
    reason: "Request permission withdrawn", ledger,
  });
  assert.throws(
    () => recordApproval({
      decision, approver: approverPrincipal, policy, ledger,
      authorityRegistry: registry,
    }),
    /REQUESTER_AUTHORITY_GRANT_NO_LONGER_ACTIVE/,
  );
  assert.equal(decision.status, "blocked");
  assert.ok(decision.reasons.includes("REQUESTER_AUTHORITY_GRANT_NO_LONGER_ACTIVE"));
});

test("revoking a competency credential after submission blocks approval", () => {
  const authority = createBlackpineTestAuthority();
  const { registry, root, ledger } = authority;
  registry.issuePermission({
    issuer: root, subjectId: "competency-revoked-requester",
    permission: "scoped:submit", scope: "*",
    expiresAt: "2035-01-01T00:00:00.000Z",
    reason: "Request permission", ledger,
  });
  const credential = registry.certifyCompetency({
    issuer: root, subjectId: "competency-revoked-requester",
    domain: "editorial", level: 2,
    evidence: [{ type: "assessment", reference: "assessment://competency-revoked" }],
    expiresAt: "2035-01-01T00:00:00.000Z",
    reason: "Editorial competency", ledger,
  });
  registry.issuePermission({
    issuer: root, subjectId: "competency-revoked-approver",
    permission: "scoped:approve", scope: "*",
    expiresAt: "2035-01-01T00:00:00.000Z",
    reason: "Approval permission", ledger,
  });
  registry.certifyCompetency({
    issuer: root, subjectId: "competency-revoked-approver",
    domain: "editorial", level: 2,
    evidence: [{ type: "assessment", reference: "assessment://approver-2" }],
    expiresAt: "2035-01-01T00:00:00.000Z",
    reason: "Editorial competency", ledger,
  });
  const requesterPrincipal = registry.resolve({
    identity: { id: "competency-revoked-requester", principalType: "human", active: true, verified: true },
  });
  const approverPrincipal = registry.resolve({
    identity: { id: "competency-revoked-approver", principalType: "human", active: true, verified: true },
  });
  const policy = {
    id: "competency-revocation-test", version: "1.0.0",
    permission: "scoped:submit", approverPermission: "scoped:approve",
    minimumLevel: 2, levelDomain: "editorial", requiredApprovals: 1,
    requireVerifiedIdentity: true,
  };
  const decision = createDecision({
    request: { id: "competency-revocation-decision", title: "Submit draft", scope: "blackpine:editorial" },
    requester: requesterPrincipal, policy, ledger, authorityRegistry: registry,
  });
  registry.revoke({
    recordId: credential.id, actor: root,
    reason: "Competency credential withdrawn", ledger,
  });
  assert.throws(
    () => recordApproval({
      decision, approver: approverPrincipal, policy, ledger,
      authorityRegistry: registry,
    }),
    /DECISION_AUTHORITY_OR_EVIDENCE_NO_LONGER_VALID/,
  );
  assert.equal(decision.status, "blocked");
  assert.ok(decision.reasons.includes("REQUESTER_DOMAIN_LEVEL_INVALID"));
});
