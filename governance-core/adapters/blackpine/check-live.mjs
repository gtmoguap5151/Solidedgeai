import { AuthorityRegistry } from "../../src/authority-registry.mjs";
import { AuditLedger, createDecision, evaluateDecision, recordApproval } from "../../src/index.mjs";
import { blackpinePolicies } from "./policies.mjs";
import { loadBlackpineSnapshot } from "./repository-reader.mjs";

const snapshot = await loadBlackpineSnapshot({ ref: "main" });

// Synthetic CI principals are resolved through the authority registry.
// They are test fixtures, not real Blackpine identities or approvals.
const authorityLedger = new AuditLedger();
const authorityRegistry = new AuthorityRegistry();
const root = authorityRegistry.bootstrap({
  identity: {
    id: "ci-root-authority",
    principalType: "human",
    active: true,
    verified: true,
    rank: "Root Authority",
    issuer: "github-actions-test-bootstrap",
  },
  initialPermissions: [
    "governance:permission:grant",
    "governance:competency:certify",
  ],
  reason: "Synthetic CI authority bootstrap",
  ledger: authorityLedger,
});

function principal(id, rank, permission, domain, level) {
  authorityRegistry.issuePermission({
    issuer: root,
    subjectId: id,
    permission,
    scope: "*",
    expiresAt: "2035-01-01T00:00:00.000Z",
    reason: "Synthetic CI permission",
    ledger: authorityLedger,
  });
  authorityRegistry.certifyCompetency({
    issuer: root,
    subjectId: id,
    domain,
    level,
    evidence: [{ type: "ci-competency-fixture", reference: `ci://${id}/${domain}` }],
    expiresAt: "2035-01-01T00:00:00.000Z",
    reason: "Synthetic CI competency",
    ledger: authorityLedger,
  });
  return authorityRegistry.resolve({
    identity: {
      id,
      principalType: "human",
      active: true,
      verified: true,
      rank,
      conflicts: [],
      issuer: "github-actions-test-identity",
    },
  });
}

const editor = principal("ci-editor", "Editor", "blackpine:content:submit", "editorial", 2);
const researcher = principal("ci-researcher", "Researcher", "blackpine:claim:submit", "product-evidence", 3);
const commercial = principal("ci-commercial", "Commercial Officer", "blackpine:affiliate:propose", "commercial", 4);
const releaseManager = principal("ci-release-manager", "Release Manager", "blackpine:publish:request", "release-management", 4);
const financialController = principal("ci-financial-controller", "Financial Controller", "blackpine:finance:request", "financial-controls", 4);
const editorialApprover = principal("ci-editorial-approver", "Owner", "blackpine:content:approve", "editorial", 2);
const claimApprover = principal("ci-claim-approver", "Product Verifier", "blackpine:claim:verify", "product-evidence", 3);

const editorialDecision = evaluateDecision({
  request: {
    id: "ci-blackpine-editorial-check",
    title: "Validate research draft evidence",
    scope: "blackpine:editorial",
    evidence: snapshot.evidence,
  },
  requester: editor,
  policy: blackpinePolicies.contentDraft,
});

const productClaimDecision = evaluateDecision({
  request: {
    id: "ci-blackpine-product-claim-check",
    title: "Validate product claim evidence",
    scope: "blackpine:product-claims",
    evidence: snapshot.evidence,
  },
  requester: researcher,
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
  requester: researcher,
  policy: blackpinePolicies.productClaim,
});

const affiliateDecision = evaluateDecision({
  request: {
    id: "ci-blackpine-affiliate-check",
    title: "Validate affiliate relationship evidence",
    scope: "blackpine:commercial",
    evidence: snapshot.evidence,
  },
  requester: commercial,
  policy: blackpinePolicies.affiliateRelationship,
});

const productionDecision = evaluateDecision({
  request: {
    id: "ci-blackpine-production-check",
    title: "Validate production release evidence",
    scope: "blackpine:production",
    evidence: snapshot.evidence,
  },
  requester: releaseManager,
  policy: blackpinePolicies.productionPublish,
});

const financialDecision = evaluateDecision({
  request: {
    id: "ci-blackpine-financial-check",
    title: "Validate financial account change evidence",
    scope: "blackpine:financial-controls",
    evidence: snapshot.evidence,
  },
  requester: financialController,
  policy: blackpinePolicies.financialAccountChange,
});

if (!editorialDecision.eligibleToSubmit) throw new Error("BLACKPINE_EDITORIAL_EVIDENCE_GATE_FAILED");
if (productClaimDecision.eligibleToSubmit) throw new Error("BLACKPINE_PRODUCT_CLAIM_GATE_FAILED_OPEN");
if (handsOnClaimDecision.eligibleToSubmit) throw new Error("BLACKPINE_HANDS_ON_GATE_FAILED_OPEN");
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
  requester: editor,
  policy: blackpinePolicies.contentDraft,
  ledger: lifecycleLedger,
});

recordApproval({
  decision: editorialLifecycle,
  approver: editorialApprover,
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
  requester: researcher,
  policy: blackpinePolicies.productClaim,
  ledger: lifecycleLedger,
});

if (editorialLifecycle.status !== "approved") throw new Error("BLACKPINE_EDITORIAL_LIFECYCLE_FAILED");
if (blockedProductClaim.status !== "blocked") throw new Error("BLACKPINE_PRODUCT_CLAIM_LIFECYCLE_FAILED_OPEN");
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
  authorityRegistry: {
    principalCount: new Set([
      editor.id, researcher.id, commercial.id, releaseManager.id,
      financialController.id, editorialApprover.id, claimApprover.id,
    ]).size,
    permissionAndCompetencyRecords: authorityRegistry.listRecords().length,
    bootstrapAuditVerified: authorityLedger.verify(),
  },
  evidence: snapshot.evidence,
  warnings: snapshot.warnings,
}, null, 2) + "\n");
