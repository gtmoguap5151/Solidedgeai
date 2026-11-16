import test from "node:test";
import assert from "node:assert/strict";
import {
  AuditLedger,
  createDecision,
  evaluateDecision,
  recordApproval,
} from "../src/index.mjs";
import { blackpinePolicies } from "../adapters/blackpine/policies.mjs";

const requester = {
  id: "bp001-description-editor",
  principalType: "human",
  active: true,
  rank: "Secretary",
  levels: { "product-evidence": 3 },
  permissions: ["blackpine:claim:submit"],
  conflicts: [],
};

const approver = {
  id: "bp001-evidence-reviewer",
  principalType: "human",
  active: true,
  rank: "Product Evidence Reviewer",
  levels: { "product-evidence": 3 },
  permissions: ["blackpine:claim:verify"],
  conflicts: [],
};

const completeEvidence = [
  {
    type: "manufacturer-source",
    reference: "fixture://bp001/manufacturer-product-page",
  },
  {
    type: "specification-record",
    reference: "fixture://bp001/claim-to-source-mapping",
  },
];

test("BP-001: product-description draft is blocked when manufacturer evidence is missing", () => {
  const result = evaluateDecision({
    request: {
      id: "BP-001-missing-evidence",
      title: "Draft revised product description",
      scope: "blackpine:product-description:draft",
      evidence: [
        {
          type: "specification-record",
          reference: "fixture://bp001/incomplete-spec-record",
        },
      ],
    },
    requester,
    policy: blackpinePolicies.productClaim,
  });

  assert.equal(result.eligibleToSubmit, false);
  assert.equal(result.status, "blocked");
  assert.ok(
    result.reasons.includes("REQUIRED_EVIDENCE_MISSING:manufacturer-source"),
  );
});

test("BP-001: evidence-backed description draft can be approved by a distinct qualified human", () => {
  const ledger = new AuditLedger();
  const decision = createDecision({
    request: {
      id: "BP-001-evidence-backed-draft",
      title: "Draft revised product description",
      scope: "blackpine:product-description:draft",
      evidence: completeEvidence,
      changeClass: "draft-only",
    },
    requester,
    policy: blackpinePolicies.productClaim,
    ledger,
  });

  assert.equal(decision.status, "pending_approval");

  recordApproval({
    decision,
    approver,
    policy: blackpinePolicies.productClaim,
    ledger,
  });

  assert.equal(decision.status, "approved");
  assert.equal(decision.approvals.length, 1);
  assert.equal(decision.approvals[0].approverId, approver.id);
  assert.equal(ledger.verify(), true);
});

test("BP-001: approval of a description draft does not authorize production publication", () => {
  const result = evaluateDecision({
    request: {
      id: "BP-001-production-release",
      title: "Publish revised product description",
      scope: "blackpine:production",
      evidence: completeEvidence,
    },
    requester: {
      ...requester,
      id: "bp001-release-requester",
      levels: { "release-management": 4 },
      permissions: ["blackpine:publish:request"],
    },
    policy: blackpinePolicies.productionPublish,
  });

  assert.equal(result.eligibleToSubmit, false);
  assert.equal(result.status, "blocked");
  assert.ok(result.reasons.includes("REQUIRED_EVIDENCE_MISSING:staging-validation"));
  assert.ok(result.reasons.includes("REQUIRED_EVIDENCE_MISSING:rollback-plan"));
  assert.ok(result.reasons.includes("REQUIRED_EVIDENCE_MISSING:human-release-approval"));
});
