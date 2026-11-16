import test from "node:test";
import assert from "node:assert/strict";
import {
  AuditLedger,
  createDecision,
  evaluateDecision,
  recordApproval,
} from "../src/index.mjs";
import { blackpinePolicies } from "../adapters/blackpine/policies.mjs";

const now = new Date("2026-11-16T18:02:00.000Z");

const requester = {
  id: "bp002-price-editor",
  principalType: "human",
  active: true,
  rank: "Secretary",
  levels: { commercial: 3 },
  permissions: ["blackpine:price:submit"],
  conflicts: [],
};

const approver = {
  id: "bp002-price-reviewer",
  principalType: "human",
  active: true,
  rank: "Commerce Reviewer",
  levels: { commercial: 3 },
  permissions: ["blackpine:price:verify"],
  conflicts: [],
};

const offerTerms = {
  type: "offer-terms",
  reference: "fixture://bp002/offer-terms",
};

test("BP-002: expired and stale retailer price evidence is blocked", () => {
  const result = evaluateDecision({
    request: {
      id: "BP-002-expired-price",
      title: "Update Marmot PreCip Eco Pro offer price",
      scope: "blackpine:product-price",
      evidence: [
        {
          type: "retailer-price-check",
          reference: "https://www.marmot.com/p/mens-precip-eco-pro-rain-jacket/SP_3185004.html",
          observedAt: "2026-11-13T23:30:00.000Z",
          expiresAt: "2026-11-13T23:58:00.000Z",
        },
        offerTerms,
      ],
    },
    requester,
    policy: blackpinePolicies.priceClaim,
    now,
  });

  assert.equal(result.eligibleToSubmit, false);
  assert.equal(result.status, "blocked");
  assert.ok(result.reasons.includes("EVIDENCE_STALE:retailer-price-check"));
  assert.ok(result.reasons.includes("EVIDENCE_EXPIRED:retailer-price-check"));
});

test("BP-002: missing observation time or offer expiry is blocked", () => {
  const result = evaluateDecision({
    request: {
      id: "BP-002-undated-price",
      title: "Update product price without dated evidence",
      scope: "blackpine:product-price",
      evidence: [
        {
          type: "retailer-price-check",
          reference: "https://retailer.example/product",
        },
        offerTerms,
      ],
    },
    requester,
    policy: blackpinePolicies.priceClaim,
    now,
  });

  assert.equal(result.eligibleToSubmit, false);
  assert.ok(result.reasons.includes("EVIDENCE_OBSERVED_AT_REQUIRED:retailer-price-check"));
  assert.ok(result.reasons.includes("EVIDENCE_EXPIRY_REQUIRED:retailer-price-check"));
});

test("BP-002: fresh, unexpired price evidence can enter a separate human approval workflow", () => {
  const ledger = new AuditLedger();
  const decision = createDecision({
    request: {
      id: "BP-002-fresh-price",
      title: "Update product price from current retailer evidence",
      scope: "blackpine:product-price",
      evidence: [
        {
          type: "retailer-price-check",
          reference: "fixture://bp002/current-retailer-check",
          observedAt: "2026-11-16T17:45:00.000Z",
          expiresAt: "2026-11-17T17:45:00.000Z",
        },
        offerTerms,
      ],
    },
    requester,
    policy: blackpinePolicies.priceClaim,
    ledger,
    now,
  });

  assert.equal(decision.status, "pending_approval");

  recordApproval({
    decision,
    approver,
    policy: blackpinePolicies.priceClaim,
    ledger,
    now,
  });

  assert.equal(decision.status, "approved");
  assert.equal(decision.approvals[0].approverId, approver.id);
  assert.equal(ledger.verify(), true);
});

test("BP-002: future-dated retailer evidence is blocked", () => {
  const result = evaluateDecision({
    request: {
      id: "BP-002-future-price",
      title: "Update price using future-dated evidence",
      scope: "blackpine:product-price",
      evidence: [
        {
          type: "retailer-price-check",
          reference: "fixture://bp002/future-retailer-check",
          observedAt: "2026-11-17T00:00:00.000Z",
          expiresAt: "2026-11-18T00:00:00.000Z",
        },
        offerTerms,
      ],
    },
    requester,
    policy: blackpinePolicies.priceClaim,
    now,
  });

  assert.equal(result.eligibleToSubmit, false);
  assert.ok(result.reasons.includes("EVIDENCE_OBSERVED_AT_IN_FUTURE:retailer-price-check"));
});
