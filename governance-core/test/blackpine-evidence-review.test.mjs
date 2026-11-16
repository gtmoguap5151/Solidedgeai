import test from "node:test";
import assert from "node:assert/strict";
import { AuditLedger, createDecision, recordApproval } from "../src/index.mjs";
import { blackpinePolicies } from "../adapters/blackpine/policies.mjs";

const now = new Date("2026-11-16T18:10:00.000Z");

const requester = {
  id: "bp003-price-requester",
  principalType: "human",
  active: true,
  rank: "Secretary",
  levels: { commercial: 3 },
  permissions: ["blackpine:price:submit"],
  conflicts: [],
};

const approver = {
  id: "bp003-price-approver",
  principalType: "human",
  active: true,
  rank: "Commerce Reviewer",
  levels: { commercial: 3 },
  permissions: ["blackpine:price:verify"],
  conflicts: [],
};

function makeDecision(ledger) {
  return createDecision({
    request: {
      id: "BP-003-evidence-review",
      title: "Approve a price claim against exact source evidence",
      scope: "blackpine:product-price",
      evidence: [
        {
          type: "retailer-price-check",
          reference: "https://retailer.example/product",
          observedAt: "2026-11-16T18:00:00.000Z",
          expiresAt: "2026-11-17T18:00:00.000Z",
          contentSha256: "a".repeat(64),
          verifiedBy: "blackpine-read-only-source-adapter",
          verifiedAt: "2026-11-16T18:00:01.000Z",
        },
        {
          type: "offer-terms",
          reference: "https://retailer.example/offer-terms",
          contentSha256: "b".repeat(64),
        },
      ],
    },
    requester,
    policy: blackpinePolicies.priceClaim,
    ledger,
    now,
  });
}

test("BP-003: approval requires acknowledgement of the exact evidence digest", () => {
  const ledger = new AuditLedger();
  const decision = makeDecision(ledger);

  assert.equal(decision.status, "pending_approval");
  assert.match(decision.evidenceDigest, /^[a-f0-9]{64}$/);
  assert.equal(decision.evidence.length, 2);
  assert.equal(decision.evidence[0].type, "retailer-price-check");
  assert.equal(decision.evidence[0].contentSha256, "a".repeat(64));
  assert.equal("rawContent" in decision.evidence[0], false);

  assert.throws(
    () => recordApproval({
      decision, approver, policy: blackpinePolicies.priceClaim, ledger, now,
    }),
    /EVIDENCE_REVIEW_ACKNOWLEDGEMENT_REQUIRED/,
  );

  assert.throws(
    () => recordApproval({
      decision,
      approver,
      policy: blackpinePolicies.priceClaim,
      ledger,
      reviewedEvidenceDigest: "0".repeat(64),
      now,
    }),
    /EVIDENCE_REVIEW_DIGEST_MISMATCH/,
  );

  assert.equal(decision.status, "pending_approval");

  recordApproval({
    decision,
    approver,
    policy: blackpinePolicies.priceClaim,
    ledger,
    reviewedEvidenceDigest: decision.evidenceDigest,
    now,
  });

  assert.equal(decision.status, "approved");
  assert.equal(decision.approvals[0].evidenceDigest, decision.evidenceDigest);
  assert.equal(ledger.list()[0].evidenceDigest, decision.evidenceDigest);
  assert.equal(ledger.list()[0].evidenceCount, 2);
  assert.equal(ledger.list()[1].evidenceDigest, decision.evidenceDigest);
  assert.equal(ledger.verify(), true);
});

test("BP-003: evidence exposed to reviewers is a defensive copy", () => {
  const ledger = new AuditLedger();
  const decision = makeDecision(ledger);
  const reviewerCopy = decision.evidence;
  reviewerCopy[0].reference = "https://attacker.example/replacement";
  reviewerCopy.push({ type: "fake", reference: "fixture://fake" });

  assert.equal(decision.evidence.length, 2);
  assert.equal(decision.evidence[0].reference, "https://retailer.example/product");
  assert.equal(ledger.verify(), true);
});
