import { GOVERNANCE_CONTROLS, REQUIRED_GOVERNANCE_CONTROL_IDS } from "./governance-controls.mjs";

const FORBIDDEN = new Set([
  "publish", "send_customer_message", "spend_money", "change_financial_settings",
  "change_prices", "modify_affiliate_links", "deploy", "modify_repository",
]);

function requireText(value, name) {
  if (typeof value !== "string" || value.trim() === "") throw new TypeError(name + " is required");
  return value.trim();
}

/**
 * Fail-closed bridge from an operator proposal to the GALINYX Governance Core.
 * The caller supplies the real policy evaluator and verified human principal.
 * This adapter never executes a proposal or grants authority.
 */
export function createGovernedOperatorGateway({ registrySeed, governanceCore, controlImplementations }) {
  if (!registrySeed || !Array.isArray(registrySeed.operators) || !Array.isArray(registrySeed.workspaces)) {
    throw new TypeError("REGISTRY_SEED_INVALID");
  }
  if (!governanceCore || typeof governanceCore.evaluateDecision !== "function") {
    throw new TypeError("GOVERNANCE_CORE_EVALUATOR_REQUIRED");
  }
  if (!controlImplementations || typeof controlImplementations !== "object") {
    throw new TypeError("GOVERNANCE_CONTROL_IMPLEMENTATIONS_REQUIRED");
  }

  const missing = REQUIRED_GOVERNANCE_CONTROL_IDS.filter((id) =>
    typeof controlImplementations[id] !== "function"
  );
  if (missing.length) {
    const error = new Error("GOVERNANCE_CONTROLS_NOT_CONNECTED:" + missing.join(","));
    error.code = "GOVERNANCE_CONTROLS_NOT_CONNECTED";
    error.missingControls = missing;
    throw error;
  }

  return Object.freeze({
    submitProposal({ operatorId, workspaceId, request, policy, humanRequester, now = new Date() }) {
      const operator = registrySeed.operators.find((item) => item.id === operatorId);
      const workspace = registrySeed.workspaces.find((item) => item.id === workspaceId);
      if (!operator || !workspace) throw new Error("OPERATOR_OR_WORKSPACE_NOT_REGISTERED");
      if (operator.status !== "registered" && operator.status !== "enabled") throw new Error("OPERATOR_NOT_ACTIVE");
      if (operator.executionMode !== "advisory_read_only") throw new Error("OPERATOR_MODE_NOT_ALLOWED");
      if (workspace.status !== "registered" && workspace.status !== "active") throw new Error("WORKSPACE_NOT_ACTIVE");

      const actionType = requireText(request?.actionType, "request.actionType");
      if (FORBIDDEN.has(actionType)) throw new Error("PROHIBITED_EXTERNAL_ACTION");
      if (humanRequester?.principalType !== "human" || humanRequester?.active !== true) {
        throw new Error("ACTIVE_HUMAN_REQUESTER_REQUIRED");
      }

      const grant = registrySeed.grants?.find((item) =>
        item.operatorId === operatorId && item.workspaceId === workspaceId
      );
      if (!grant) throw new Error("WORKSPACE_SCOPED_OPERATOR_GRANT_REQUIRED");
      const boundIds = grant.governance?.controlIds ?? [];
      if (REQUIRED_GOVERNANCE_CONTROL_IDS.some((id) => !boundIds.includes(id))) {
        throw new Error("SIX_GOVERNANCE_CONTROLS_NOT_BOUND_TO_GRANT");
      }

      const controlResults = {};
      for (const control of GOVERNANCE_CONTROLS) {
        controlResults[control.id] = controlImplementations[control.id]({
          operator, workspace, request, policy, humanRequester, now,
        });
        if (controlResults[control.id] !== true) {
          throw new Error("GOVERNANCE_CONTROL_BLOCKED:" + control.id);
        }
      }

      const decision = governanceCore.evaluateDecision({
        request: { ...request, scope: workspaceId },
        requester: humanRequester,
        policy,
        now,
      });
      return Object.freeze({
        operatorId,
        workspaceId,
        decision,
        controlResults: Object.freeze(controlResults),
        execution: "not_executed",
        requiresHumanApproval: true,
      });
    },
  });
}
