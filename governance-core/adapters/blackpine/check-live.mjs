import { evaluateDecision } from "../../src/index.mjs";
import { blackpinePolicies } from "./policies.mjs";
import { loadBlackpineSnapshot } from "./repository-reader.mjs";

const snapshot = await loadBlackpineSnapshot({ ref: "main" });

// Synthetic CI principals exercise policy logic; they are not real identities,
// grants, approvals, or authority to publish anything.
const editorialDecision = evaluateDecision({
  request: {
    id: "ci-blackpine-editorial-check",
    title: "Validate research draft evidence",
    scope: "blackpine:editorial",
    evidence: snapshot.evidence,
  },
  requester: {
    id: "ci-editor", principalType: "human", active: true, levels: { editorial: 2 },
    permissions: ["blackpine:content:submit"], conflicts: [],
  },
  policy: blackpinePolicies.contentDraft,
});

const productClaimDecision = evaluateDecision({
  request: {
    id: "ci-blackpine-product-claim-check",
    title: "Validate product claim evidence",
    scope: "blackpine:product-claims",
    evidence: snapshot.evidence,
  },
  requester: {
    id: "ci-researcher", principalType: "human", active: true, levels: { "product-evidence": 3 },
    permissions: ["blackpine:claim:submit"], conflicts: [],
  },
  policy: blackpinePolicies.productClaim,
});

const handsOnClaimDecision = evaluateDecision({
  request: {
    id: "ci-blackpine-hands-on-check",
    title: "Validate hands-on test evidence",
    scope: "blackpine:product-claims",
    claimsHandsOnTesting: true,
    evidence: snapshot.evidence,
  },
  requester: {
    id: "ci-researcher", principalType: "human", active: true, level: 3,
    permissions: ["blackpine:claim:submit"], conflicts: [],
  },
  policy: blackpinePolicies.productClaim,
});

if (!editorialDecision.eligibleToSubmit) {
  throw new Error("BLACKPINE_EDITORIAL_EVIDENCE_GATE_FAILED");
}
if (productClaimDecision.eligibleToSubmit) {
  throw new Error("BLACKPINE_PRODUCT_CLAIM_GATE_FAILED_OPEN");
}
if (handsOnClaimDecision.eligibleToSubmit) {
  throw new Error("BLACKPINE_HANDS_ON_GATE_FAILED_OPEN");
}

process.stdout.write(JSON.stringify({
  source: snapshot.source,
  capturedAt: snapshot.capturedAt,
  fileCount: snapshot.files.length,
  files: snapshot.files.map(({ path, blobSha, contentSha256, byteLength }) => ({
    path, blobSha, contentSha256, byteLength,
  })),
  observations: snapshot.observations,
  policyEvaluations: {
    editorialDraft: editorialDecision,
    productClaim: productClaimDecision,
    handsOnClaim: handsOnClaimDecision,
  },
  evidence: snapshot.evidence,
  warnings: snapshot.warnings,
}, null, 2) + "\n");
