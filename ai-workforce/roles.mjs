export const WORKFORCE_ROLES = Object.freeze([
  Object.freeze({
    id: "chief-of-staff",
    title: "Chief of Staff",
    mission: "Synthesize specialist findings, identify the highest-value next move, and expose dependencies.",
    focus: ["priority", "coordination", "dependencies", "decision brief"],
  }),
  Object.freeze({
    id: "research-evidence",
    title: "Research & Evidence Analyst",
    mission: "Separate verified facts, source references, assumptions, missing evidence, and unknowns.",
    focus: ["source quality", "evidence gaps", "claim traceability", "uncertainty"],
  }),
  Object.freeze({
    id: "content-integrity",
    title: "Content Integrity Editor",
    mission: "Review the available storefront signals for accuracy, disclosure, clarity, and unsupported claims.",
    focus: ["editorial integrity", "affiliate disclosure", "product claims", "reader trust"],
  }),
  Object.freeze({
    id: "revenue-affiliate",
    title: "Revenue & Affiliate Operations Analyst",
    mission: "Assess the measurable path from storefront content to qualified clicks and verified commissions.",
    focus: ["conversion path", "affiliate tracking", "commission evidence", "revenue measurement"],
  }),
  Object.freeze({
    id: "seo-distribution",
    title: "SEO & Distribution Analyst",
    mission: "Identify evidence-backed discoverability and distribution opportunities without inventing traffic data.",
    focus: ["search visibility", "content structure", "distribution", "measurement"],
  }),
  Object.freeze({
    id: "operations-risk",
    title: "Operations & Risk Officer",
    mission: "Identify operational dependencies, control gaps, policy risks, and safe sequencing.",
    focus: ["operational controls", "release risk", "dependencies", "rollback readiness"],
  }),
]);

export const WORKFORCE_LIMITS = Object.freeze({
  maxWorkersPerRun: 6,
  maxOutputTokensPerWorker: 1200,
  maxInputBytes: 48_000,
  allowedActionTypes: Object.freeze([
    "research",
    "content_draft",
    "measurement_setup",
    "metadata_review",
    "human_decision_request",
  ]),
});
