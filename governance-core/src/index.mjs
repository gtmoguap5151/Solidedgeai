import { createHash } from "node:crypto";
const stable = v => Array.isArray(v) ? v.map(stable) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map(k => [k, stable(v[k])])) : v;
const digest = v => createHash("sha256").update(JSON.stringify(stable(v))).digest("hex");
export class GovernanceError extends Error {
  constructor(code, message) { super(message); this.name = "GovernanceError"; this.code = code; }
}
export function validatePolicy(p) {
  if (!p || !Array.isArray(p.roles) || !Array.isArray(p.permissions) || !Array.isArray(p.approvalRules)) throw new GovernanceError("INVALID_POLICY", "Policy requires roles, permissions, and approvalRules arrays.");
  const ids = new Set();
  for (const r of p.roles) { if (!r.id || ids.has(r.id)) throw new GovernanceError("DUPLICATE_ROLE", "Roles need unique ids."); if (!Number.isInteger(r.level) || r.level < 0) throw new GovernanceError("INVALID_LEVEL", "Role level must be a non-negative integer."); ids.add(r.id); }
  for (const x of p.permissions) if (!ids.has(x.roleId) || !x.action) throw new GovernanceError("INVALID_PERMISSION", "Permission references an unknown role or has no action.");
  for (const x of p.approvalRules) { if (!x.action || !Number.isInteger(x.minimumApprovals) || x.minimumApprovals < 0) throw new GovernanceError("INVALID_APPROVAL_RULE", "Approval rule requires action and non-negative minimumApprovals."); if (x.approverRoleIds?.some(id => !ids.has(id))) throw new GovernanceError("UNKNOWN_APPROVER_ROLE", "Unknown approver role."); }
  return true;
}
const roleFor = (actor, p) => { const r = p.roles.find(x => x.id === actor?.roleId); if (!actor?.id || !r) throw new GovernanceError("UNKNOWN_ACTOR", "Actor or assigned role is not recognized."); return r; };
export function evaluateAction({ actor, action, resource = {}, approvals = [], policy, delegations = [], now = Date.now() }) {
  validatePolicy(policy); const role = roleFor(actor, policy);
  const direct = policy.permissions.some(x => x.roleId === actor.roleId && x.action === action && x.enabled !== false);
  const delegated = delegations.some(d => d.delegateId === actor.id && d.actions?.includes(action) && Date.parse(d.expiresAt) > now && d.revoked !== true);
  const rule = policy.approvalRules.find(x => x.action === action);
  const valid = approvals.filter(a => a?.actorId && a.actorId !== actor.id && a.decision === "approve" && policy.roles.some(r => r.id === a.roleId) && (!rule?.approverRoleIds?.length || rule.approverRoleIds.includes(a.roleId)));
  const count = new Set(valid.map(a => a.actorId)).size, required = rule?.minimumApprovals ?? 0;
  const conflict = Boolean(resource.conflictOfInterestActorIds?.includes(actor.id));
  const blocked = conflict || valid.some(a => a.actorId === actor.id);
  const authority = direct || delegated, enough = count >= required, allowed = authority && enough && !blocked;
  return Object.freeze({ status: blocked ? "blocked_conflict" : allowed ? "approved" : "pending_or_denied", allowed, actorId: actor.id, actorRole: role.id, authoritySource: direct ? "direct_permission" : delegated ? "delegation" : "none", requiredApprovals: required, validApprovalCount: count, conflict, reasons: [...(!authority ? ["actor_lacks_permission_or_valid_delegation"] : []), ...(!enough ? ["required_approvals_not_met"] : []), ...(conflict ? ["declared_conflict_of_interest"] : []), ...(blocked && !conflict ? ["requester_cannot_approve_own_action"] : [])] });
}
export function applyHumanOverride(evaluation, { actor, reason, decision, policy }) {
  validatePolicy(policy); const role = roleFor(actor, policy);
  if (!policy.humanOverrideRoleIds?.includes(role.id)) throw new GovernanceError("OVERRIDE_NOT_AUTHORIZED", "Role is not authorized to override.");
  if (evaluation?.conflict || evaluation?.status === "blocked_conflict") throw new GovernanceError("HARD_BLOCK_CANNOT_BE_OVERRIDDEN", "A conflict-of-interest hard block cannot be overridden.");
  if (evaluation?.actorId === actor.id) throw new GovernanceError("SELF_OVERRIDE_NOT_ALLOWED", "The requester cannot override their own action.");
  if (!reason || reason.trim().length < 12) throw new GovernanceError("OVERRIDE_REASON_REQUIRED", "A meaningful override reason (12+ characters) is required.");
  if (!["approve", "deny"].includes(decision)) throw new GovernanceError("INVALID_OVERRIDE", "Decision must be approve or deny.");
  return Object.freeze({ ...evaluation, status: decision === "approve" ? "human_override_approved" : "human_override_denied", allowed: decision === "approve", override: Object.freeze({ actorId: actor.id, roleId: role.id, reason: reason.trim(), decision }) });
}
export function appendAuditEvent(previous, event) {
  const body = { sequence: previous ? previous.sequence + 1 : 1, previousHash: previous?.hash ?? "GENESIS", timestamp: event.timestamp ?? new Date().toISOString(), actorId: event.actorId ?? "system", eventType: event.eventType, subjectId: event.subjectId ?? null, outcome: event.outcome ?? null, details: event.details ?? {} };
  if (!body.eventType) throw new GovernanceError("AUDIT_EVENT_TYPE_REQUIRED", "Audit eventType is required.");
  return Object.freeze({ ...body, hash: digest(body) });
}
export function verifyAuditChain(events) {
  let previous = null;
  for (const e of events) { const expected = appendAuditEvent(previous, e); if (e.sequence !== expected.sequence || e.previousHash !== expected.previousHash || e.hash !== expected.hash) return false; previous = e; }
  return true;
}
