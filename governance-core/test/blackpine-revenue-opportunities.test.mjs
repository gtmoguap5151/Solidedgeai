import test from "node:test";
import assert from "node:assert/strict";
import { rankBlackpineRevenueOpportunities } from "../adapters/blackpine/revenue-opportunities.mjs";

const base = {
  observations: {
    timeSensitivePriceClaimsPresent: true,
    manufacturerSourceRecordsPresent: false,
    handsOnEvidenceRecordsPresent: false,
  },
  capturedAt: "2026-11-16T19:00:00.000Z",
  sourceReference: "https://github.com/gtmoguap5151/blackpine-field/tree/main",
};

test("BP-OPP-001: missing measurement evidence ranks baseline first without inventing zero revenue", () => {
  const result = rankBlackpineRevenueOpportunities(base);
  assert.equal(result.opportunities[0].id, "BP-OPP-001");
  assert.equal(result.opportunities[0].status, "blocked_by_missing_evidence");
  assert.equal(result.revenueMetrics.status, "unknown");
  assert.equal(result.revenueMetrics.commission, null);
  assert.equal(result.controls.missingValuesTreatedAsZero, false);
});

test("BP-OPP-002: time-sensitive price language triggers an evidence review, not an automatic edit", () => {
  const result = rankBlackpineRevenueOpportunities(base);
  const item = result.opportunities.find((x) => x.id === "BP-OPP-002");
  assert.ok(item);
  assert.equal(item.status, "review_required");
  assert.equal(item.executionAllowed, false);
  assert.match(item.recommendedAction, /current retailer page/);
});

test("BP-OPP-003: absence of structured manufacturer records is described as a coverage gap, not proof every claim is unsupported", () => {
  const result = rankBlackpineRevenueOpportunities(base);
  const item = result.opportunities.find((x) => x.id === "BP-OPP-003");
  assert.ok(item);
  assert.match(item.evidence[1].observation, /does not prove that every product claim is unsupported/);
});

test("BP-OPP-004: complete measurement coverage removes the baseline blocker", () => {
  const result = rankBlackpineRevenueOpportunities({
    ...base,
    availableMeasurements: {
      "analytics-report": true,
      "affiliate-click-report": true,
      "commission-report": true,
    },
  });
  assert.equal(result.opportunities.some((x) => x.id === "BP-OPP-001"), false);
  assert.deepEqual(Object.values(result.measurementCoverage), [true, true, true]);
});

test("BP-OPP-005: all recommendations remain read-only and non-executable", () => {
  const result = rankBlackpineRevenueOpportunities(base);
  assert.equal(result.controls.readOnly, true);
  assert.equal(result.controls.publicChangesPermitted, false);
  assert.equal(result.controls.spendingPermitted, false);
  assert.equal(result.controls.externalOutreachPermitted, false);
  assert.ok(result.opportunities.every((x) => x.executionAllowed === false));
});

test("BP-OPP-006: invalid or unverified inputs are rejected", () => {
  assert.throws(() => rankBlackpineRevenueOpportunities({ ...base, capturedAt: "not-a-date" }), /CAPTURE_TIME_REQUIRED/);
  assert.throws(() => rankBlackpineRevenueOpportunities({ ...base, sourceReference: "file:///private.csv" }), /HTTPS_SOURCE_REFERENCE_REQUIRED/);
  assert.throws(() => rankBlackpineRevenueOpportunities({
    ...base,
    observations: { ...base.observations, timeSensitivePriceClaimsPresent: "yes" },
  }), /OBSERVATION_MUST_BE_BOOLEAN/);
});
