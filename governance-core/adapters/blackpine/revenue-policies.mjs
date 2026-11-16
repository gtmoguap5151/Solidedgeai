// Revenue-operation controls for the BLACKPINE FIELD validation cell.
// These authorize bounded analysis and planning only. They do not authorize
// publishing, outreach, spending, pricing changes, or financial account changes.

export const blackpineRevenuePolicies = Object.freeze({
  revenueAuditPlan: Object.freeze({
    id: "blackpine.revenue.audit.plan",
    levelDomain: "commercial",
    version: "1.0.0",
    requireEvidenceReview: true,
    requireVerifiedIdentity: true,
    permission: "blackpine:revenue:audit:submit",
    approverPermission: "blackpine:revenue:audit:approve",
    minimumLevel: 2,
    requiredApprovals: 1,
    prohibitedConflicts: [],
    requiredEvidence: [
      "repository-snapshot",
      "affiliate-disclosure-check",
      "specification-record",
    ],
    evidenceRules: {
      "repository-snapshot": { requireHttps: true, requireContentSha256: true, requireVerifiedBy: true, requireVerifiedAt: true },
      "affiliate-disclosure-check": { requireContentSha256: true, requireVerifiedBy: true, requireVerifiedAt: true },
      "specification-record": { requireContentSha256: true, requireVerifiedBy: true, requireVerifiedAt: true },
    },
  }),
  revenuePerformanceClaim: Object.freeze({
    id: "blackpine.revenue.performance.claim",
    levelDomain: "commercial",
    version: "1.0.0",
    requireEvidenceReview: true,
    requireVerifiedIdentity: true,
    permission: "blackpine:revenue:claim:submit",
    approverPermission: "blackpine:revenue:claim:verify",
    minimumLevel: 3,
    requiredApprovals: 1,
    prohibitedConflicts: [],
    requiredEvidence: [
      "analytics-report",
      "affiliate-click-report",
      "commission-report",
    ],
    evidenceRules: {
      "analytics-report": { requireContentSha256: true, requireVerifiedBy: true, requireVerifiedAt: true },
      "affiliate-click-report": { requireContentSha256: true, requireVerifiedBy: true, requireVerifiedAt: true },
      "commission-report": { requireContentSha256: true, requireVerifiedBy: true, requireVerifiedAt: true },
    },
    evidenceFreshness: {
      "analytics-report": { maxAgeHours: 168 },
      "affiliate-click-report": { maxAgeHours: 168 },
      "commission-report": { maxAgeHours: 168 },
    },
  }),
});
