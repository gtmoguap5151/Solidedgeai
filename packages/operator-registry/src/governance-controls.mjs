export const GOVERNANCE_CONTROLS = Object.freeze([
  Object.freeze({ id: "authority_registry", name: "Authority Registry" }),
  Object.freeze({ id: "execution_permission_policies", name: "Execution and Permission Policies" }),
  Object.freeze({ id: "governance_rules_decision_controls", name: "Governance Rules and Decision Controls" }),
  Object.freeze({ id: "evidence_validation_audit", name: "Evidence Validation and Audit Mechanisms" }),
  Object.freeze({ id: "human_approval_authorization", name: "Human Approval and Authorization Framework" }),
  Object.freeze({ id: "risk_controls_enforcement", name: "Risk Controls and Enforcement Logic" }),
]);

export const REQUIRED_GOVERNANCE_CONTROL_IDS = Object.freeze(
  GOVERNANCE_CONTROLS.map((control) => control.id)
);
