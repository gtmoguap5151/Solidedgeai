import { createHash } from "node:crypto";
import { AuthorityRegistry } from "../../src/authority-registry.mjs";
import { AuditLedger, createDecision, evaluateDecision, recordApproval } from "../../src/index.mjs";
import { loadBlackpineSnapshot } from "./repository-reader.mjs";
import { blackpineRevenuePolicies } from "./revenue-policies.mjs";

const snapshot = await loadBlackpineSnapshot({ ref: "main" });

async function loadLiveStorefrontSnapshot() {
  try {
    const response = await fetch("https://blackpinefield.com/", {
      method: "GET",
      redirect: "follow",
      headers: { Accept: "text/html", "User-Agent": "GALINYX-Blackpine-ReadOnly-Validation/1.0" },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      return { status: "http_error", httpStatus: response.status, finalUrl: response.url };
    }
    const html = await response.text();
    return {
      status: "available",
      httpStatus: response.status,
      finalUrl: response.url,
      productCardCount: (html.match(/<article\\s+class=["']product["']/gi) ?? []).length,
    };
  } catch (error) {
    return { status: "unavailable", errorName: error?.name ?? "UnknownError" };
  }
}

const liveStorefront = await loadLiveStorefrontSnapshot();
const repositoryProductCardCount = snapshot.observations.repositoryProductCardCount;
const storefrontProductCountMatches = liveStorefront.status === "available"
  ? liveStorefront.productCardCount === repositoryProductCardCount
  : null;

const ledger = new AuditLedger();
const authorityRegistry = new AuthorityRegistry();
const root = authorityRegistry.bootstrap({
  identity: {
    id: "ci-revenue-root",
    principalType: "human",
    active: true,
    verified: true,
    rank: "Owner",
    issuer: "github-actions-test-bootstrap",
  },
  initialPermissions: ["governance:permission:grant", "governance:competency:certify"],
  reason: "Synthetic CI authority bootstrap",
  ledger,
});

function principal(id, rank, permission, level) {
  authorityRegistry.issuePermission({
    issuer: root, subjectId: id, permission, scope: "*",
    expiresAt: "2035-01-01T00:00:00.000Z",
    reason: "Synthetic CI permission", ledger,
  });
  authorityRegistry.certifyCompetency({
    issuer: root, subjectId: id, domain: "commercial", level,
    evidence: [{ type: "ci-competency-fixture", reference: `ci://${id}/commercial` }],
    expiresAt: "2035-01-01T00:00:00.000Z",
    reason: "Synthetic CI competency", ledger,
  });
  return authorityRegistry.resolve({
    identity: {
      id, principalType: "human", active: true, verified: true, rank,
      conflicts: [], issuer: "github-actions-test-identity",
    },
  });
}

const analyst = principal("ci-revenue-analyst", "Secretary", "blackpine:revenue:audit:submit", 2);
const ownerApprover = principal("ci-revenue-owner-approver", "Owner", "blackpine:revenue:audit:approve", 2);
const claimant = principal("ci-revenue-claimant", "Commercial Analyst", "blackpine:revenue:claim:submit", 3);

const repositoryEvidence = {
  type: "repository-snapshot",
  reference: `https://github.com/${snapshot.source.owner}/${snapshot.source.repository}/tree/${snapshot.source.ref}`,
  contentSha256: createHash("sha256").update(JSON.stringify({
    treeSha: snapshot.source.treeSha,
    files: snapshot.files.map(({ path, blobSha, contentSha256, byteLength }) => ({ path, blobSha, contentSha256, byteLength })),
  })).digest("hex"),
  verifiedBy: "galinyx-blackpine-read-only-adapter",
  verifiedAt: snapshot.capturedAt,
};
const auditEvidence = [repositoryEvidence, ...snapshot.evidence];

const auditEvaluation = evaluateDecision({
  request: {
    id: "ci-blackpine-revenue-audit",
    title: "Prepare an evidence-based revenue-readiness audit",
    scope: "blackpine:revenue:audit",
    evidence: auditEvidence,
  },
  requester: analyst,
  authorityRegistry,
  policy: blackpineRevenuePolicies.revenueAuditPlan,
});

if (!auditEvaluation.eligibleToSubmit) {
  throw new Error(`BLACKPINE_REVENUE_AUDIT_PLAN_BLOCKED:${auditEvaluation.reasons.join(",")}`);
}

const auditDecision = createDecision({
  request: {
    id: "ci-blackpine-revenue-audit-lifecycle",
    title: "Prepare an evidence-based revenue-readiness audit",
    scope: "blackpine:revenue:audit",
    evidence: auditEvidence,
  },
  requester: analyst,
  authorityRegistry,
  policy: blackpineRevenuePolicies.revenueAuditPlan,
  ledger,
});
recordApproval({
  decision: auditDecision,
  approver: ownerApprover,
  authorityRegistry,
  policy: blackpineRevenuePolicies.revenueAuditPlan,
  ledger,
  reviewedEvidenceDigest: auditDecision.evidenceDigest,
});
if (auditDecision.status !== "approved") throw new Error("BLACKPINE_REVENUE_AUDIT_APPROVAL_FAILED");

const performanceEvaluation = evaluateDecision({
  request: {
    id: "ci-blackpine-revenue-performance-claim",
    title: "Assert current revenue performance",
    scope: "blackpine:revenue:claim",
    evidence: auditEvidence,
  },
  requester: claimant,
  authorityRegistry,
  policy: blackpineRevenuePolicies.revenuePerformanceClaim,
});
if (performanceEvaluation.eligibleToSubmit) {
  throw new Error("BLACKPINE_REVENUE_CLAIM_GATE_FAILED_OPEN");
}
for (const type of ["analytics-report", "affiliate-click-report", "commission-report"]) {
  if (!performanceEvaluation.reasons.includes(`REQUIRED_EVIDENCE_MISSING:${type}`)) {
    throw new Error(`BLACKPINE_REVENUE_CLAIM_GATE_MISSING_REASON:${type}`);
  }
}
if (!ledger.verify()) throw new Error("BLACKPINE_REVENUE_AUDIT_CHAIN_INVALID");

process.stdout.write(JSON.stringify({
  source: snapshot.source,
  capturedAt: snapshot.capturedAt,
  repositoryFilesReviewed: snapshot.files.length,
  storefrontReconciliation: {
    liveStatus: liveStorefront.status,
    liveHttpStatus: liveStorefront.httpStatus ?? null,
    liveUrl: liveStorefront.finalUrl ?? null,
    repositoryProductCardCount,
    liveProductCardCount: liveStorefront.productCardCount ?? null,
    productCountMatches: storefrontProductCountMatches,
  },
  revenueAuditPlan: { status: auditDecision.status, approvalCount: auditDecision.approvals.length },
  revenuePerformanceClaim: { status: performanceEvaluation.status, reasons: performanceEvaluation.reasons },
  measurementState: {
    analyticsReportInRepositorySnapshot: false,
    affiliateClickReportInRepositorySnapshot: false,
    commissionReportInRepositorySnapshot: false,
    revenueClaimPermitted: false,
  },
  observations: snapshot.observations,
  auditLedgerValid: ledger.verify(),
  boundary: "Read-only public repository and storefront GET requests only. No analytics accounts, affiliate dashboards, storefront write paths, publishing, outreach, spending, or financial accounts were accessed.",
}, null, 2) + "\n");
