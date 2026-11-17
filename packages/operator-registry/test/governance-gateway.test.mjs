import test from "node:test";
import assert from "node:assert/strict";
import { createGovernedOperatorGateway } from "../src/governance-gateway.mjs";
import { REQUIRED_GOVERNANCE_CONTROL_IDS } from "../src/governance-controls.mjs";

const controls = Object.fromEntries(REQUIRED_GOVERNANCE_CONTROL_IDS.map((id) => [id, () => true]));
const seed = {
  workspaces: [{ id: "blackpine-field", status: "registered" }],
  operators: [{ id: "operator-chief-of-staff", status: "registered", executionMode: "advisory_read_only" }],
  grants: [{
    operatorId: "operator-chief-of-staff",
    workspaceId: "blackpine-field",
    governance: { controlIds: [...REQUIRED_GOVERNANCE_CONTROL_IDS] },
  }],
};
const human = { id: "owner-1", principalType: "human", active: true };

test("gateway fails closed when any foundational control is missing", () => {
  const partial = { ...controls };
  delete partial.risk_controls_enforcement;
  assert.throws(() => createGovernedOperatorGateway({
    registrySeed: seed,
    governanceCore: { evaluateDecision() {} },
    controlImplementations: partial,
  }), /GOVERNANCE_CONTROLS_NOT_CONNECTED/);
});

test("all six controls run before the Governance Core evaluator", () => {
  const called = [];
  const implementations = Object.fromEntries(REQUIRED_GOVERNANCE_CONTROL_IDS.map((id) => [
    id, () => { called.push(id); return true; },
  ]));
  let evaluated = false;
  const gateway = createGovernedOperatorGateway({
    registrySeed: seed,
    governanceCore: { evaluateDecision(input) { evaluated = true; return { status: "pending_approval", input }; } },
    controlImplementations: implementations,
  });
  const result = gateway.submitProposal({
    operatorId: "operator-chief-of-staff",
    workspaceId: "blackpine-field",
    request: { id: "proposal-1", title: "Prepare a research summary", actionType: "prepare_report" },
    policy: { id: "test.policy", version: "1", permission: "test:submit" },
    humanRequester: human,
  });
  assert.deepEqual(called, [...REQUIRED_GOVERNANCE_CONTROL_IDS]);
  assert.equal(evaluated, true);
  assert.equal(result.execution, "not_executed");
  assert.equal(result.requiresHumanApproval, true);
});

test("gateway rejects prohibited external actions", () => {
  const gateway = createGovernedOperatorGateway({
    registrySeed: seed,
    governanceCore: { evaluateDecision() { throw new Error("must not run"); } },
    controlImplementations: controls,
  });
  assert.throws(() => gateway.submitProposal({
    operatorId: "operator-chief-of-staff",
    workspaceId: "blackpine-field",
    request: { id: "proposal-2", title: "Publish now", actionType: "publish" },
    policy: { id: "test.policy", version: "1", permission: "test:submit" },
    humanRequester: human,
  }), /PROHIBITED_EXTERNAL_ACTION/);
});
