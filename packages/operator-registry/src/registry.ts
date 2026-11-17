/**
 * GALINYX Operator Registry v1
 *
 * Source-of-truth contract for reusable operators and workspace-scoped grants.
 * This module is intentionally storage- and provider-neutral. It does not create
 * credentials, authenticate a human, call a model, or authorize external actions.
 */

export type OperatorStatus = "proposed" | "registered" | "enabled" | "suspended" | "revoked";
export type WorkspaceStatus = "registered" | "active" | "suspended";
export type ExecutionMode = "advisory_read_only";

export interface GovernanceControlSet {
  policyVersion: string;
  /** Exactly six control identifiers supplied by the approved Governance Core policy. */
  controlIds: readonly [string, string, string, string, string, string];
}

export interface Workspace {
  id: string;
  name: string;
  legalEntity: string;
  status: WorkspaceStatus;
  description: string;
}

export interface Operator {
  id: string;
  name: string;
  role: string;
  reportsTo: string | null;
  status: OperatorStatus;
  modelProfile: string;
  executionMode: ExecutionMode;
  capabilities: readonly string[];
  prohibitedActions: readonly string[];
}

export interface WorkspaceGrant {
  id: string;
  operatorId: string;
  workspaceId: string;
  governance: GovernanceControlSet;
  allowedActions: readonly string[];
  approvalRequiredFor: readonly string[];
}

export interface RegistrySeed {
  platform: { id: string; name: string; status: "registered" };
  workspaces: readonly Workspace[];
  operators: readonly Operator[];
  grants: readonly WorkspaceGrant[];
}

const forbiddenExternalActions = [
  "publish",
  "send_customer_message",
  "spend_money",
  "change_financial_settings",
  "change_prices",
  "modify_affiliate_links",
  "deploy",
  "modify_repository",
] as const;

export function validateRegistry(seed: RegistrySeed): string[] {
  const errors: string[] = [];
  const unique = (values: readonly string[]) => new Set(values).size === values.length;

  if (!unique(seed.workspaces.map((x) => x.id))) errors.push("duplicate workspace id");
  if (!unique(seed.operators.map((x) => x.id))) errors.push("duplicate operator id");
  if (!unique(seed.grants.map((x) => x.id))) errors.push("duplicate grant id");

  const workspaceIds = new Set(seed.workspaces.map((x) => x.id));
  const operatorIds = new Set(seed.operators.map((x) => x.id));

  for (const operator of seed.operators) {
    if (operator.reportsTo && !operatorIds.has(operator.reportsTo)) {
      errors.push(`${operator.id}: unknown reporting operator ${operator.reportsTo}`);
    }
    if (operator.reportsTo === operator.id) errors.push(`${operator.id}: cannot report to itself`);
    if (operator.executionMode !== "advisory_read_only") {
      errors.push(`${operator.id}: unsupported execution mode`);
    }
    for (const action of forbiddenExternalActions) {
      if (operator.capabilities.includes(action)) errors.push(`${operator.id}: forbidden capability ${action}`);
    }
  }

  for (const grant of seed.grants) {
    if (!operatorIds.has(grant.operatorId)) errors.push(`${grant.id}: unknown operator`);
    if (!workspaceIds.has(grant.workspaceId)) errors.push(`${grant.id}: unknown workspace`);
    if (grant.governance.controlIds.length !== 6) errors.push(`${grant.id}: exactly six governance controls required`);
    if (new Set(grant.governance.controlIds).size !== 6) errors.push(`${grant.id}: governance control ids must be unique`);
    if (grant.allowedActions.some((action) => (forbiddenExternalActions as readonly string[]).includes(action))) {
      errors.push(`${grant.id}: grant contains a prohibited external action`);
    }
  }
  return errors;
}
