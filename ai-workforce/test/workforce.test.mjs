import test from "node:test";
import assert from "node:assert/strict";
import { WORKFORCE_ROLES } from "../roles.mjs";
import { runBlackpineWorkforce } from "../workforce.mjs";
import { createOpenAICompatibleProvider } from "../model-provider.mjs";
import { assertProposalOnly } from "../governance-handoff.mjs";

const evidenceRef = "github://gtmoguap5151/blackpine-field@main/README.md#blob=abc&sha256=def";
const fixtureSnapshot = {
  source: { owner: "gtmoguap5151", repository: "blackpine-field", ref: "main", treeSha: "tree" },
  capturedAt: "2026-11-16T00:00:00.000Z",
  files: [{ path: "README.md", blobSha: "abc", contentSha256: "def", byteLength: 20 }],
  observations: {
    affiliateDisclosurePresent: true,
    handsOnTestingDisclosurePresent: true,
    researchOnlyLabelsPresent: true,
    publishedCompanionsPresent: true,
    noHypeBrandRulePresent: true,
    timeSensitivePriceClaimsPresent: false,
    sourceReferenceListCount: 1,
    repositoryProductCardCount: 3,
    manufacturerSourceRecordsPresent: false,
    handsOnEvidenceRecordsPresent: false,
  },
  evidence: [{ type: "source-reference-list", reference: evidenceRef }],
  warnings: ["Fixture evidence only."],
};

function fixtureProvider() {
  return {
    async generate() {
      return {
        summary: "Evidence snapshot indicates basic disclosure and content controls are present; revenue remains unmeasured.",
        findings: [{
          title: "Revenue evidence is incomplete",
          detail: "No analytics, click, or commission values are present in this snapshot.",
          severity: "high",
          evidenceRefs: [evidenceRef],
        }],
        recommendations: [{
          title: "Connect read-only performance exports",
          rationale: "Traffic, outbound clicks, and commission evidence are required before making revenue claims.",
          priority: "P1",
          evidenceRefs: [evidenceRef],
        }],
        proposedActions: [{
          title: "Prepare an analytics evidence checklist",
          actionType: "measurement_setup",
          risk: "low",
          evidenceRefs: [evidenceRef],
        }],
        uncertainties: ["No traffic, click, conversion, or commission metrics were supplied."],
      };
    },
  };
}

test("workforce exposes six distinct specialist roles", () => {
  assert.equal(WORKFORCE_ROLES.length, 6);
  assert.equal(new Set(WORKFORCE_ROLES.map((role) => role.id)).size, 6);
});

test("workforce runs selected workers on one shared snapshot and produces human-review packets", async () => {
  let snapshots = 0;
  let calls = 0;
  const provider = {
    async generate(input) {
      calls += 1;
      assert.match(input.prompt, /BLACKPINE|Evidence snapshot JSON/);
      return fixtureProvider().generate();
    },
  };
  const result = await runBlackpineWorkforce({
    provider,
    workerIds: ["chief-of-staff", "revenue-affiliate"],
    snapshotLoader: async () => { snapshots += 1; return fixtureSnapshot; },
    runId: "test-run-001",
  });
  assert.equal(snapshots, 1);
  assert.equal(calls, 2);
  assert.equal(result.reports.length, 2);
  assert.equal(result.humanReviewPackets.length, 2);
  assert.equal(result.externalActionsExecuted, false);
  assert.equal(result.governanceBoundary.coreDecisionEngineInvoked, false);
  assert.equal(result.humanReviewPackets[0].status, "awaiting_human_review");
  assert.equal(assertProposalOnly(result.humanReviewPackets[0]), true);
});

test("workforce rejects invented evidence references", async () => {
  const provider = {
    async generate() {
      const report = await fixtureProvider().generate();
      report.findings[0].evidenceRefs = ["https://invented.example/evidence"];
      return report;
    },
  };
  await assert.rejects(
    runBlackpineWorkforce({
      provider,
      workerIds: ["research-evidence"],
      snapshotLoader: async () => fixtureSnapshot,
    }),
    /WORKER_REFERENCED_UNAVAILABLE_EVIDENCE/,
  );
});

test("workforce rejects unsupported roles and excessive token budgets", async () => {
  await assert.rejects(
    runBlackpineWorkforce({ provider: fixtureProvider(), workerIds: ["superuser"] }),
    /UNKNOWN_WORKFORCE_ROLE/,
  );
  await assert.rejects(
    runBlackpineWorkforce({ provider: fixtureProvider(), workerIds: ["chief-of-staff"], maxOutputTokensPerWorker: 9000 }),
    /WORKFORCE_TOKEN_LIMIT_INVALID/,
  );
});

test("model provider validates secure endpoint and does not call until invoked", async () => {
  let requests = 0;
  const provider = createOpenAICompatibleProvider({
    baseUrl: "https://model.example/v1",
    apiKey: "test-key",
    model: "test-model",
    fetchImpl: async () => {
      requests += 1;
      return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ ok: true }) } }] }) };
    },
  });
  assert.equal(requests, 0);
  const result = await provider.generate({ system: "system", prompt: "prompt" });
  assert.deepEqual(result, { ok: true });
  assert.equal(requests, 1);
  assert.throws(() => createOpenAICompatibleProvider({
    baseUrl: "http://remote.example/v1", apiKey: "x", model: "x",
  }), /MODEL_ENDPOINT_MUST_USE_HTTPS_OR_LOCALHOST/);
});

test("model provider rejects non-JSON model output", async () => {
  const provider = createOpenAICompatibleProvider({
    baseUrl: "https://model.example/v1",
    apiKey: "test-key",
    model: "test-model",
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "not json" } }] }),
    }),
  });
  await assert.rejects(provider.generate({ system: "system", prompt: "prompt" }), /MODEL_RESPONSE_NOT_VALID_JSON/);
});
