// Blackpine Field policy profile for controlled, read-only validation.
// These policies are examples for governance evaluation; they do not authorize
// or execute changes on blackpinefield.com or in the Blackpine repository.

export const blackpinePolicies = Object.freeze({
  contentDraft: Object.freeze({
    id: "blackpine.content.draft",
    version: "1.0.0",
    permission: "blackpine:content:submit",
    approverPermission: "blackpine:content:approve",
    minimumLevel: 2,
    requiredApprovals: 1,
    prohibitedConflicts: ["direct-product-vendor-interest"],
    requiredEvidence: ["source-check", "affiliate-disclosure-check"],
  }),
  productClaim: Object.freeze({
    id: "blackpine.product.claim",
    version: "1.0.0",
    permission: "blackpine:claim:submit",
    approverPermission: "blackpine:claim:verify",
    minimumLevel: 3,
    requiredApprovals: 1,
    prohibitedConflicts: ["direct-product-vendor-interest"],
    requiredEvidence: ["manufacturer-source", "specification-record"],
    handsOnEvidence: ["possession-record", "test-date", "test-conditions", "load-record"],
  }),
  affiliateRelationship: Object.freeze({
    id: "blackpine.affiliate.relationship",
    version: "1.0.0",
    permission: "blackpine:affiliate:propose",
    approverPermission: "blackpine:owner:approve",
    minimumLevel: 4,
    requiredApprovals: 1,
    prohibitedConflicts: ["affiliate-network-conflict"],
    requiredEvidence: ["programme-terms", "merchant-fit-review", "disclosure-plan"],
  }),
  productionPublish: Object.freeze({
    id: "blackpine.production.publish",
    version: "1.0.0",
    permission: "blackpine:publish:request",
    approverPermission: "blackpine:owner:approve",
    minimumLevel: 4,
    requiredApprovals: 1,
    prohibitedConflicts: [],
    requiredEvidence: ["staging-validation", "rollback-plan", "human-release-approval"],
  }),
  financialAccountChange: Object.freeze({
    id: "blackpine.financial.account.change",
    version: "1.0.0",
    permission: "blackpine:finance:request",
    approverPermission: "blackpine:owner:approve",
    minimumLevel: 4,
    requiredApprovals: 1,
    prohibitedConflicts: ["personal-financial-interest"],
    requiredEvidence: ["verified-account-owner", "change-confirmation"],
  }),
});
