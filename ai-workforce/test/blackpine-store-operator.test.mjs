import test from "node:test";
import assert from "node:assert/strict";
import { runBlackpineStoreOperator } from "../blackpine-store-operator.mjs";

test("Blackpine Store Operator runs only the revenue-affiliate specialist", async () => {
  let snapshotCalls = 0;
  const snapshotLoader = async ({ ref }) => {
    snapshotCalls += 1;
    assert.equal(ref, "main");
    return {
      source: { owner: "gtmoguap5151", repository: "blackpine-field", ref: "main", treeSha: "a".repeat(40) },
      capturedAt: "2026-11-16T00:00:00.000Z",
      files: [],
      observations: [],
      evidence: [{ reference: "github://gtmoguap5151/blackpine-field@main/site/index.html#blob=x&sha256=y" }],
      warnings: [],
    };
  };
  const provider = {
    async generate() {
      return {
        summary: "Affiliate revenue evidence requires measurement before sales can be claimed.",
        findings: [{ title: "Commission reporting is not included in this repository snapshot", detail: "Store markup alone cannot prove sales or commissions.", severity: "medium", evidenceRefs: [] }],
        recommendations: [{ title: "Reconcile affiliate network reports with outbound click tracking", rationale: "This establishes the path from click to commission.", priority: "P1", evidenceRefs: [] }],
        proposedActions: [{ title: "Prepare a click-to-commission measurement specification", actionType: "measurement_setup", risk: "low", evidenceRefs: [] }],
        uncertainties: ["No affiliate network transaction report was supplied."],
      };
    },
  };

  const result = await runBlackpineStoreOperator({ provider, snapshotLoader, runId: "test-run" });
  assert.equal(snapshotCalls, 1);
  assert.equal(result.operator, "blackpine-store-operator");
  assert.equal(result.mode, "advisory_read_only");
  assert.equal(result.runId, "test-run");
  assert.equal(result.externalActionsExecuted, false);
  assert.equal(result.proposedActions.length, 1);
  assert.equal(result.proposedActions[0].status, "awaiting_human_review");
  assert.equal(result.governance.coreDecisionEngineInvoked, false);
});

test("Blackpine Store Operator fails closed without a configured provider", async () => {
  await assert.rejects(() => runBlackpineStoreOperator(), /MODEL_PROVIDER_REQUIRED/);
});
