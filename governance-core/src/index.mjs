/**
 * GALINYX Governance Core
 * =======================
 * Authority, policies, permissions, and oversight for GALINYX specialist
 * operators. Zero dependencies. No secrets. No network calls.
 *
 * Architecture:
 *   GALINYX (technology company)
 *     -> GALINYX OS (operating platform)
 *       -> Governance Core (this module)
 *         -> AI Workforce (operator registry, roles, assignments)
 *           -> Specialist Operators, one per business environment
 *             - Blackpine Operator  -> Blackpine Field (storefront)
 *             - Rivet Reach Operator -> Rivet Reach (lead generation)
 *
 * Rules enforced here, in code:
 *   1. Each operator is bound to exactly ONE environment. No cross-environment
 *      access, ever.
 *   2. An operator may only perform actions its current mode allows.
 *   3. Every authorization decision is recorded in an append-only audit log.
 *   4. A mode change is NEVER self-approved. requestModeChange() records a
 *      PENDING request only; a mode only changes when the owner explicitly
 *      approves it with approveModeChange().
 */

export const ACTIONS = ['read', 'advise', 'publish', 'spend', 'write'];

/**
 * Modes and the actions each mode allows.
 * read-only-advisory: observe and advise only. Nothing is changed, published,
 *   spent, or written.
 * not-deployed: the operator is registered but has no access at all.
 */
export const MODES = {
  'read-only-advisory': {
    label: 'Read-Only Advisory',
    description: 'May observe and advise. May not change anything.',
    permissions: { read: true, advise: true, publish: false, spend: false, write: false },
  },
  'not-deployed': {
    label: 'Not Deployed',
    description: 'Registered but not deployed. No access of any kind.',
    permissions: { read: false, advise: false, publish: false, spend: false, write: false },
  },
};

export const ENVIRONMENTS = {
  'blackpine-field': {
    id: 'blackpine-field',
    label: 'Blackpine Field',
    kind: 'storefront',
  },
  'rivet-reach': {
    id: 'rivet-reach',
    label: 'Rivet Reach',
    kind: 'lead generation',
  },
};

/**
 * Operator registry (the AI Workforce). Mirrors operators.json in this folder.
 * status "deployed-unproven" means the operator is deployed in read-only
 * advisory mode but its analysis has NOT yet been proven reliable.
 */
export const OPERATORS = {
  'blackpine-operator': {
    id: 'blackpine-operator',
    name: 'Blackpine Operator',
    environment: 'blackpine-field',
    mode: 'read-only-advisory',
    status: 'deployed-unproven',
  },
  'rivet-reach-operator': {
    id: 'rivet-reach-operator',
    name: 'Rivet Reach Operator',
    environment: 'rivet-reach',
    mode: 'not-deployed',
    status: 'pending-confirmation',
  },
};

// ---------------------------------------------------------------------------
// Append-only audit log (in-memory). Every authorization decision is recorded.
// Entries are never edited or removed. getAuditLog() returns copies, so a
// caller cannot rewrite history.
// ---------------------------------------------------------------------------
const auditLog = [];
const pendingModeChanges = [];
let modeChangeCounter = 0;

function recordAudit(entry) {
  auditLog.push(Object.freeze({ ...entry }));
}

function copy(value) {
  return JSON.parse(JSON.stringify(value));
}

// ---------------------------------------------------------------------------
// Authorization
// ---------------------------------------------------------------------------

/**
 * Decide whether an operator may perform an action in an environment.
 *
 * @param {string} operatorId  - e.g. 'blackpine-operator'
 * @param {string} environment - e.g. 'blackpine-field'
 * @param {string} action      - one of ACTIONS: read, advise, publish, spend, write
 * @returns {{allowed: boolean, reason: string, operatorId: string, environment: string, action: string, timestamp: string}}
 */
export function authorize(operatorId, environment, action) {
  const timestamp = new Date().toISOString();
  let allowed = false;
  let reason = '';

  const operator = OPERATORS[operatorId];
  if (!operator) {
    reason = `Unknown operator '${operatorId}'. Access denied.`;
  } else if (!ACTIONS.includes(action)) {
    reason = `Unknown action '${action}'. Access denied.`;
  } else if (operator.environment !== environment) {
    reason =
      `Environment separation: '${operator.name}' is bound to ` +
      `'${operator.environment}' and may not act in '${environment}'. Access denied.`;
  } else if (!MODES[operator.mode]) {
    reason = `Unknown mode '${operator.mode}' on '${operator.name}'. Access denied.`;
  } else if (MODES[operator.mode].permissions[action]) {
    allowed = true;
    reason =
      `Allowed: '${operator.name}' in mode '${MODES[operator.mode].label}' ` +
      `may '${action}' in '${environment}'.`;
  } else {
    reason =
      `Denied: '${operator.name}' in mode '${MODES[operator.mode].label}' ` +
      `may not '${action}'. Read-only advisory mode allows observe and advise only.`;
  }

  recordAudit({
    type: 'authorization',
    timestamp,
    operatorId,
    environment,
    action,
    allowed,
    reason,
  });

  return { allowed, reason, operatorId, environment, action, timestamp };
}

// ---------------------------------------------------------------------------
// Mode changes: requested here, approved ONLY by the owner.
// ---------------------------------------------------------------------------

/**
 * Request a mode change. This records a PENDING request and nothing more.
 * It never changes the operator's mode and never approves itself.
 *
 * @param {string} operatorId
 * @param {string} newMode    - a key of MODES
 * @param {string} [requestedBy] - who asked (informational only)
 * @returns {{recorded: boolean, request: object|null, reason: string}}
 */
export function requestModeChange(operatorId, newMode, requestedBy = 'unknown') {
  const timestamp = new Date().toISOString();
  const operator = OPERATORS[operatorId];

  if (!operator) {
    return { recorded: false, request: null, reason: `Unknown operator '${operatorId}'.` };
  }
  if (!MODES[newMode]) {
    return { recorded: false, request: null, reason: `Unknown mode '${newMode}'.` };
  }
  if (operator.mode === newMode) {
    return {
      recorded: false,
      request: null,
      reason: `'${operator.name}' is already in mode '${newMode}'.`,
    };
  }

  modeChangeCounter += 1;
  const request = {
    id: `mode-change-${modeChangeCounter}`,
    operatorId,
    operatorName: operator.name,
    environment: operator.environment,
    currentMode: operator.mode,
    requestedMode: newMode,
    status: 'pending-owner-approval',
    requestedBy,
    requestedAt: timestamp,
    decidedAt: null,
    decidedBy: null,
  };
  pendingModeChanges.push(request);

  recordAudit({
    type: 'mode-change-requested',
    timestamp,
    operatorId,
    environment: operator.environment,
    action: 'mode-change-request',
    allowed: false,
    reason:
      `Mode change requested for '${operator.name}': '${operator.mode}' -> ` +
      `'${newMode}'. Recorded as PENDING. Mode changes require explicit owner ` +
      `approval and are never self-approved.`,
  });

  return {
    recorded: true,
    request: copy(request),
    reason: `Recorded as pending-owner-approval. '${operator.name}' stays in '${operator.mode}' until the owner approves.`,
  };
}

/**
 * Approve (or refuse) a pending mode change. Only the owner approves a mode
 * change, and the approval is explicit: the approver's identity is required
 * and recorded. Without an approver, nothing happens.
 *
 * @param {string} operatorId
 * @param {string} requestId  - e.g. 'mode-change-1'
 * @param {string} approvedBy - identity of the owner approving. Required.
 * @param {boolean} [approve=true] - false records a refusal instead.
 * @returns {{applied: boolean, reason: string}}
 */
export function approveModeChange(operatorId, requestId, approvedBy, approve = true) {
  const timestamp = new Date().toISOString();

  if (!approvedBy || typeof approvedBy !== 'string' || approvedBy.trim() === '') {
    return {
      applied: false,
      reason: 'An approver is required. Mode changes require explicit owner approval.',
    };
  }

  const operator = OPERATORS[operatorId];
  if (!operator) {
    return { applied: false, reason: `Unknown operator '${operatorId}'.` };
  }

  const request = pendingModeChanges.find(
    (r) => r.id === requestId && r.operatorId === operatorId && r.status === 'pending-owner-approval',
  );
  if (!request) {
    return {
      applied: false,
      reason: `No pending mode-change request '${requestId}' for '${operatorId}'.`,
    };
  }

  request.status = approve ? 'approved' : 'refused';
  request.decidedAt = timestamp;
  request.decidedBy = approvedBy;

  if (approve) {
    const previousMode = operator.mode;
    operator.mode = request.requestedMode;
    recordAudit({
      type: 'mode-change-approved',
      timestamp,
      operatorId,
      environment: operator.environment,
      action: 'mode-change',
      allowed: true,
      reason:
        `Owner '${approvedBy}' approved mode change for '${operator.name}': ` +
        `'${previousMode}' -> '${operator.mode}'.`,
    });
    return {
      applied: true,
      reason: `'${operator.name}' mode changed '${previousMode}' -> '${operator.mode}' by owner approval (${approvedBy}).`,
    };
  }

  recordAudit({
    type: 'mode-change-refused',
    timestamp,
    operatorId,
    environment: operator.environment,
    action: 'mode-change',
    allowed: false,
    reason:
      `Owner '${approvedBy}' refused mode change for '${operator.name}'. ` +
      `Mode stays '${operator.mode}'.`,
  });
  return {
    applied: false,
    reason: `Refused by ${approvedBy}. '${operator.name}' stays in '${operator.mode}'.`,
  };
}

// ---------------------------------------------------------------------------
// Read access (copies only — callers cannot rewrite the registry or the log)
// ---------------------------------------------------------------------------

export function getOperator(operatorId) {
  return OPERATORS[operatorId] ? copy(OPERATORS[operatorId]) : null;
}

export function listOperators() {
  return Object.values(OPERATORS).map(copy);
}

export function getAuditLog() {
  return auditLog.map(copy);
}

export function getPendingModeChanges() {
  return pendingModeChanges
    .filter((r) => r.status === 'pending-owner-approval')
    .map(copy);
}

export function getAllModeChangeRequests() {
  return pendingModeChanges.map(copy);
}
