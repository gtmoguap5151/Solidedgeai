import test from "node:test";
import assert from "node:assert/strict";
import { AuthorityRegistry } from "../src/authority-registry.mjs";
import { AuditLedger, createDecision, evaluateDecision, recordApproval } from "../src/index.mjs";
import { blackpineRevenuePolicies } from "../adapters/blackpine/revenue-policies.mjs";
import { blackpinePolicies } from "../adapters/blackpine/policies.mjs";

const now = new Date("2026-11-16T18:00:00.000Z");
const expiry = "2035-01-01T00:00:00.000Z";

function setup() {
  const ledger = new AuditLedger();
  const registry = new AuthorityRegistry();
  const root = registry.bootstrap({
    identity: { id: "bp-revenue-test-root", principalType: "human", active: true, verified: true, rank: "Owner", issuer: "test" },
    initialPermissions: ["governance:permission:grant", "governance:competency:certify"],
    reason: "Synthetic test authority",
    ledger,
    now,
  });
  function principal(id, rank, permission, level, domain = "commercial") {
    registry.issuePermission({
      issuer: root, subjectId: id, permission, scope: "*", expiresAt: expiry,
      reason: "Synthetic test grant", ledger, now,
    });
    registry.certifyCompetency({
      issuer: root, subjectId: id, domain, level,
      evidence: [{ type: "test-credential", reference: `fixture://${id}/commercial` }],
      expiresAt: expiry, reason: "Synthetic test competency", ledger, now,
    });
    return registry.resolve({
      identity: { id, principalType: "human", active: true, verified: true, rank, conflicts: [], issuer: "test" },
      now,
    });
  }
  return { ledger, registry, principal };
}

const repositoryEvidence = [
  { type: "repository-snapshot", reference: "https://github.com/gtmoguap5151/blackpine-field/tree/main", contentSha256: "a".repeat(64), verifiedBy: "test-adapter", verifiedAt: now.toISOString() },
  { type: "affiliate-disclosure-check", reference: "https://github.com/gtmoguap5151/blackpine-field/blob/main/site/index.html", contentSha256: "b".repeat(64), verifiedBy: "test-adapter", verifiedAt: now.toISOString() },
  { type: "specification-record", reference: "https://github.com/gtmoguap5151/blackpine-field/blob/main/launch-slate/01-cordura-vs-ballistic-nylon.md", contentSha256: "c".repeat(64), verifiedBy: "test-adapter", verifiedAt: now.toISOString() },
];

test("BP-REV-001: evidence-backed revenue audit plan can enter a distinct-human approval workflow", () => {
  const { ledger, registry, principal } = setup();
  const requester = principal("bp-revenue-analyst", "Secretary", "blackpine:revenue:audit:submit", 2);
  const approver = principal("bp-revenue-approver", "Owner", "blackpine:revenue:audit:approve", 2);
  const decision = createDecision({
    request: { id: "BP-REV-001", title: "Prepare a measured revenue-readiness audit", scope: "blackpine:revenue:audit", evidence: repositoryEvidence },
    requester, policy: blackpineRevenuePolicies.revenueAuditPlan, ledger, authorityRegistry: registry, now,
  });
  assert.equal(decision.status, "pending_approval");
  recordApproval({
    decision, approver, policy: blackpineRevenuePolicies.revenueAuditPlan,
    ledger, authorityRegistry: registry, reviewedEvidenceDigest: decision.evidenceDigest, now,
  });
  assert.equal(decision.status, "approved");
  assert.notEqual(decision.requesterId, decision.approvals[0].approverId);
  assert.equal(ledger.verify(), true);
});

test("BP-REV-002: repository content alone cannot support a revenue or performance claim", () => {
  const { registry, principal, ledger } = setup();
  const requester = principal("bp-revenue-claimant", "Commercial Analyst", "blackpine:revenue:claim:submit", 3);
  const result = evaluateDecision({
    request: { id: "BP-REV-002", title: "Assert revenue performance", scope: "blackpine:revenue:claim", evidence: repositoryEvidence },
    requester, policy: blackpineRevenuePolicies.revenuePerformanceClaim, authorityRegistry: registry, now,
  });
  assert.equal(result.eligibleToSubmit, false);
  assert.equal(result.status, "blocked");
  assert.ok(result.reasons.includes("REQUIRED_EVIDENCE_MISSING:analytics-report"));
  assert.ok(result.reasons.includes("REQUIRED_EVIDENCE_MISSING:affiliate-click-report"));
  assert.ok(result.reasons.includes("REQUIRED_EVIDENCE_MISSING:commission-report"));
  assert.equal(ledger.verify(), true);
});

test("BP-REV-003: a revenue audit approval does not authorize public publishing", () => {
  const { registry, principal } = setup();
  const requester = principal("bp-revenue-publisher", "Release Manager", "blackpine:publish:request", 4, "release-management");
  const result = evaluateDecision({
    request: { id: "BP-REV-003", title: "Publish an unreviewed revenue claim", scope: "blackpine:production", evidence: repositoryEvidence },
    requester, policy: blackpinePolicies.productionPublish,
    authorityRegistry: registry, now,
  });
  assert.equal(result.eligibleToSubmit, false);
  assert.equal(result.status, "blocked");
  assert.ok(result.reasons.includes("REQUIRED_EVIDENCE_MISSING:staging-validation"));
  assert.ok(result.reasons.includes("REQUIRED_EVIDENCE_MISSING:rollback-plan"));
  assert.ok(result.reasons.includes("REQUIRED_EVIDENCE_MISSING:human-release-approval"));
});
