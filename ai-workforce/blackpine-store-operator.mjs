import { runBlackpineWorkforce } from "./workforce.mjs";

/**
 * First named business operator for GALINYX:
 * Blackpine Store Operator — revenue and affiliate operations.
 *
 * This is an explicit, one-worker entry point over the existing verified,
 * read-only Blackpine repository snapshot. It requires a caller-supplied model
 * provider; importing this module performs no network or model request.
 */
export async function runBlackpineStoreOperator({
  provider,
  snapshotLoader,
  ref = "main",
  maxOutputTokens = 900,
  runId,
} = {}) {
  if (!provider || typeof provider.generate !== "function") {
    throw new Error("MODEL_PROVIDER_REQUIRED");
  }

  const result = await runBlackpineWorkforce({
    provider,
    workerIds: ["revenue-affiliate"],
    ...(snapshotLoader ? { snapshotLoader } : {}),
    ref,
    maxOutputTokensPerWorker: maxOutputTokens,
    ...(runId ? { runId } : {}),
  });

  const report = result.reports[0];
  if (!report || report.workerId !== "revenue-affiliate") {
    throw new Error("BLACKPINE_OPERATOR_REPORT_MISSING");
  }

  return Object.freeze({
    schemaVersion: "1.0.0",
    operator: "blackpine-store-operator",
    title: "Blackpine Store Operator",
    mission: "Inspect Blackpine storefront evidence and identify measurable affiliate-revenue improvements.",
    mode: "advisory_read_only",
    runId: result.runId,
    source: result.source,
    capturedAt: result.capturedAt,
    summary: report.summary,
    findings: report.findings,
    recommendations: report.recommendations,
    proposedActions: result.humanReviewPackets,
    uncertainties: report.uncertainties,
    governance: result.governanceBoundary,
    externalActionsExecuted: false,
  });
}
