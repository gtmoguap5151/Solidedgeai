import { AuditLedger, createDecision, evaluateDecision, recordApproval } from "../../src/index.mjs";
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
    id: "ci-researcher", principalType: "human", active: true, levels: { "product-evidence": 3 },
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

const affiliateDecision = evaluateDecision({
  request: {
    id: "ci-blackpine-affiliate-check",
    title: "Validate affiliate relationship evidence",
    scope: "blackpine:commercial",
    evidence: snapshot.evidence,
  },
  requester: {
    id: "ci-commercial", principalType: "human", active: true, levels: { commercial: 4 },
    permissions: ["blackpine:affiliate:propose"], conflicts: [],
  },
  policy: blackpinePolicies.affiliateRelationship,
});

const productionDecision = evaluateDecision({
  request: {
    id: "ci-blackpine-production-check",
    title: "Validate production release evidence",
    scope: "blackpine:production",
    evidence: snapshot.evidence,
  },
  requester: {
    id: "ci-release-manager", principalType: "human", active: true, levels: { "release-management": 4 },
    permissions: ["blackpine:publish:request"], conflicts: [],
  },
  policy: blackpinePolicies.productionPublish,
});

const financialDecision = evaluateDecision({
  request: {
    id: "ci-blackpine-financial-check",
    title: "Validate financial account change evidence",
    scope: "blackpine:financial-controls",
    evidence: snapshot.evidence,
  },
  requester: {
    id: "ci-financial-controller", principalType: "human", active: true, levels: { "financial-controls": 4 },
    permissions: ["blackpine:finance:request"], conflicts: [],
  },
  policy: blackpinePolicies.financialAccountChange,
});

if (affiliateDecision.eligibleToSubmit) throw new Error("BLACKPINE_AFFILIATE_GATE_FAILED_OPEN");
if (productionDecision.eligibleToSubmit) throw new Error("BLACKPINE_PRODUCTION_GATE_FAILED_OPEN");
if (financialDecision.eligibleToSubmit) throw new Error("BLACKPINE_FINANCIAL_GATE_FAILED_OPEN");

const lifecycleLedger = new AuditLedger();
const editorialLifecycle = createDecision({
  request: {
    id: "ci-blackpine-editorial-lifecycle",
    title: "Research guide draft lifecycle",
    scope: "blackpine:editorial",
    evidence: snapshot.evidence,
  },
  requester: {
    id: "ci-lifecycle-editor", principalType: "human", active: true,
    levels: { editorial: 2 },
    permissions: ["blackpine:content:submit"], conflicts: [],
  },
  policy: blackpinePolicies.contentDraft,
  ledger: lifecycleLedger,
});

recordApproval({
  decision: editorialLifecycle,
  approver: {
    id: "ci-lifecycle-approver", principalType: "human", active: true,
    levels: { editorial: 2 },
    permissions: ["blackpine:content:approve"], conflicts: [],
  },
  policy: blackpinePolicies.contentDraft,
  ledger: lifecycleLedger,
});

const blockedProductClaim = createDecision({
  request: {
    id: "ci-blackpine-blocked-claim-lifecycle",
    title: "Product claim without manufacturer source",
    scope: "blackpine:product-claims",
    evidence: snapshot.evidence,
  },
  requester: {
    id: "ci-lifecycle-researcher", principalType: "human", active: true,
    levels: { "product-evidence": 3 },
    permissions: ["blackpine:claim:submit"], conflicts: [],
  },
  policy: blackpinePolicies.productClaim,
  ledger: lifecycleLedger,
});

if (editorialLifecycle.status !== "approved") {
  throw new Error("BLACKPINE_EDITORIAL_LIFECYCLE_FAILED");
}
if (blockedProductClaim.status !== "blocked") {
  throw new Error("BLACKPINE_PRODUCT_CLAIM_LIFECYCLE_FAILED_OPEN");
}
if (!lifecycleLedger.verify()) throw new Error("BLACKPINE_AUDIT_CHAIN_INVALID");

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
    affiliateRelationship: affiliateDecision,
    productionPublish: productionDecision,
    financialAccountChange: financialDecision,
  },
  lifecycle: {
    editorialStatus: editorialLifecycle.status,
    unsupportedProductClaimStatus: blockedProductClaim.status,
    auditEventCount: lifecycleLedger.list().length,
    auditChainVerified: lifecycleLedger.verify(),
  },
  evidence: snapshot.evidence,
  warnings: snapshot.warnings,
}, null, 2) + "\n");
