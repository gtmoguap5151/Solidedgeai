// Evidence-led, read-only opportunity ranking for BLACKPINE FIELD.
// This module identifies operating work; it does not estimate revenue or execute changes.

const REQUIRED_MEASUREMENTS = Object.freeze([
  "analytics-report",
  "affiliate-click-report",
  "commission-report",
]);

function requireObservations(observations) {
  if (!observations || typeof observations !== "object") {
    throw new TypeError("BLACKPINE_OBSERVATIONS_REQUIRED");
  }
  for (const key of [
    "timeSensitivePriceClaimsPresent",
    "manufacturerSourceRecordsPresent",
    "handsOnEvidenceRecordsPresent",
  ]) {
    if (typeof observations[key] !== "boolean") {
      throw new TypeError(`BLACKPINE_OBSERVATION_MUST_BE_BOOLEAN:${key}`);
    }
  }
}

function measurementCoverage(input = {}) {
  const result = {};
  for (const type of REQUIRED_MEASUREMENTS) {
    result[type] = input[type] === true;
  }
  return Object.freeze(result);
}

/**
 * Build a ranked list from verified repository observations and explicitly
 * supplied measurement-coverage flags. Missing data is "unknown", never zero.
 * No item grants permission to publish, spend, contact a third party, or alter
 * production systems.
 */
export function rankBlackpineRevenueOpportunities({
  observations,
  availableMeasurements = {},
  capturedAt,
  sourceReference,
}) {
  requireObservations(observations);
  if (typeof capturedAt !== "string" || !Number.isFinite(Date.parse(capturedAt))) {
    throw new TypeError("BLACKPINE_CAPTURE_TIME_REQUIRED");
  }
  if (typeof sourceReference !== "string" || !sourceReference.startsWith("https://")) {
    throw new TypeError("BLACKPINE_HTTPS_SOURCE_REFERENCE_REQUIRED");
  }

  const coverage = measurementCoverage(availableMeasurements);
  const missingMeasurements = REQUIRED_MEASUREMENTS.filter((type) => !coverage[type]);
  const opportunities = [];

  if (missingMeasurements.length > 0) {
    opportunities.push({
      id: "BP-OPP-001",
      rank: 1,
      priority: "P1",
      title: "Establish an attributable revenue baseline",
      category: "measurement",
      status: "blocked_by_missing_evidence",
      evidence: [
        { observation: "Required operating reports are not present in the supplied measurement coverage.", missing: missingMeasurements },
        { observation: "Repository snapshot is not a source of traffic, click, order, or commission metrics." },
      ],
      businessImpact: "Without aligned traffic, outbound-click, and commission data, GALINYX cannot locate the revenue-funnel constraint or verify improvement.",
      recommendedAction: "Obtain analytics-report, affiliate-click-report, and commission-report exports for the same reporting window; validate source, timezone, currency, coverage, and capture time before calculating funnel metrics.",
      expectedMechanism: "Creates the minimum evidence base to distinguish acquisition, product-page engagement, merchant click-through, and affiliate conversion constraints.",
      revenueEstimate: null,
      approvalRequired: "Human review of source exports before accepting the baseline.",
      executionAllowed: false,
    });
  }

  if (observations.timeSensitivePriceClaimsPresent) {
    opportunities.push({
      id: "BP-OPP-002",
      rank: opportunities.length + 1,
      priority: "P1",
      title: "Review time-sensitive price language against current retailer evidence",
      category: "trust_and_content_accuracy",
      status: "review_required",
      evidence: [
        { observation: "The repository snapshot detected time-sensitive price language and a dollar amount in the homepage source." },
        { observation: "The snapshot does not contain a verified current retailer-price record or offer-terms record for that claim." },
      ],
      businessImpact: "An outdated price or offer can undermine customer trust and create avoidable affiliate-content accuracy risk.",
      recommendedAction: "Check each affected claim against a current retailer page and applicable offer terms; if current evidence cannot be obtained, prepare neutral wording that does not assert a live price or deadline.",
      expectedMechanism: "Reduces stale-claim risk and protects the credibility of the storefront; no conversion uplift is assumed.",
      revenueEstimate: null,
      approvalRequired: "Human approval before changing or publishing public copy.",
      executionAllowed: false,
    });
  }

  if (!observations.manufacturerSourceRecordsPresent) {
    opportunities.push({
      id: "BP-OPP-003",
      rank: opportunities.length + 1,
      priority: "P2",
      title: "Create a product-claim evidence coverage register",
      category: "product_evidence",
      status: "coverage_not_verified",
      evidence: [
        { observation: "The adapter did not detect manufacturer-source evidence records in the inspected repository snapshot." },
        { observation: "This does not prove that every product claim is unsupported; it means the adapter cannot verify a structured manufacturer-source record set." },
      ],
      businessImpact: "A traceable claim-to-source register makes it easier to maintain accurate comparisons and defend editorial decisions.",
      recommendedAction: "Map each material product specification or comparison claim to a current manufacturer source and record the URL, capture time, reviewer, and content hash.",
      expectedMechanism: "Improves evidence traceability and reduces the chance of publishing unsupported specifications.",
      revenueEstimate: null,
      approvalRequired: "Human evidence review; separate approval before any public copy change.",
      executionAllowed: false,
    });
  }

  return Object.freeze({
    schemaVersion: "1.0.0",
    generatedAt: new Date(capturedAt).toISOString(),
    sourceReference,
    measurementCoverage: coverage,
    revenueMetrics: Object.freeze({
      status: "unknown",
      sessions: null,
      productPageViews: null,
      outboundClicks: null,
      orders: null,
      reversals: null,
      commission: null,
      reason: "No validated measurement exports were supplied to this ranking run.",
    }),
    opportunities: Object.freeze(opportunities.map((item, index) => Object.freeze({
      ...item,
      rank: index + 1,
      evidence: Object.freeze(item.evidence),
    }))),
    controls: Object.freeze({
      readOnly: true,
      publicChangesPermitted: false,
      spendingPermitted: false,
      externalOutreachPermitted: false,
      missingValuesTreatedAsZero: false,
    }),
  });
}
