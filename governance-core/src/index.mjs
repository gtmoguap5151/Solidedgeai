/**
 * GALINYX Governance Core — v1.3.0
 * =================================
 * Authority, policies, permissions, and oversight for GALINYX specialist
 * operators. Zero third-party dependencies. No secrets. No network calls.
 * (Only Node built-ins: fs, path, crypto, url.)
 *
 * Architecture:
 *   GALINYX (technology company)
 *     -> GALINYX OS (operating platform)
 *       -> Governance Core (this module)
 *         -> AI Workforce (operator registry, roles, assignments)
 *           -> Specialist Operators, bound to one environment each
 *             (an environment may host a team of operators)
 *             - Blackpine Operator  -> Blackpine Field (storefront)
 *             - Affiliate Operator  -> Blackpine Field (revenue team test)
 *             - Black Friday Operator -> Blackpine Field (revenue team test)
 *             - Content Operator    -> Blackpine Field (revenue team test)
 *             - Rivet Reach Operator -> Rivet Reach (lead generation)
 *
 * Rules enforced here, in code:
 *   1. Each operator is bound to exactly ONE environment. No cross-environment
 *      access, ever.
 *   2. An operator may only perform actions its current mode allows.
 *   3. Every authorization decision is recorded in an append-only audit log,
 *      in memory AND in an append-only JSONL file, so history survives restarts.
 *   4. A mode change is NEVER self-approved. requestModeChange() records a
 *      PENDING request only; a mode only changes when the owner explicitly
 *      approves it with approveModeChange().
 *   5. Fail closed, always. Unknown operators, environments, actions, modes,
 *      malformed input, and unexpected errors all DENY. authorize() never throws.
 *   6. The registry is loaded from operators.json and strictly validated at
 *      import. A corrupt registry falls back to the built-in known-good
 *      registry and the fallback is recorded in the audit log.
 *
 * What this module does NOT do (honest limits — see the stress-test report):
 *   - It does NOT authenticate operators. An operator ID is a claim, not a
 *     credential. The owner-identity check in approveModeChange() is a
 *     guardrail, not authentication. Real authentication (signed operator
 *     tokens, signed owner approvals) is specified as future work. Until it
 *     exists, only trusted in-process code may call this module.
 *   - It does NOT sync state between processes. Each process holds its own
 *     registry state; the JSONL file gives restart consistency for one
 *     process, not live multi-process sync. Run exactly one writer process.
 *     (The operator interaction layer, interactions.mjs, keeps its own
 *     append-only log, interactions.jsonl, as the one shared channel
 *     between operators — but it inherits the same single-writer caveat.)
 *
 * v1.2.0 adds recordInteractionAudit(): a narrow hook so the interaction
 * layer can record each message decision in this audit log. Nothing else
 * about authorization, modes, or the registry changed in 1.2.0.
 *
 * v1.3.0 adds the owner-notification sink: setNotificationSink() /
 * notifyOwnerApprovalNeeded(), recordNotificationAudit(), and isOwner().
 * When authorize() denies an action only because the operator's mode does
 * not allow it (a legitimate action that needs owner approval), the Core
 * notifies the registered sink so the owner-notification system
 * (notifications.mjs) can alert the owner. A mode-change request notifies
 * the same way. Nothing else about authorization, modes, or the registry
 * changed in 1.3.0. The Core never imports the notification module — the
 * sink is registered by the layer, so the Core works with no sink at all.
 *
 * Environment variables:
 *   GALINYX_OPERATORS_FILE   - registry file (default: ./operators.json)
 *   GALINYX_AUDIT_FILE       - append-only JSONL audit log (default: ./audit-log.jsonl)
 *   GALINYX_OWNER_ID         - approver identity accepted for mode changes (default: 'owner')
 *   GALINYX_MODE_CHANGE_TTL_MS - pending-request lifetime in ms (default: 30 days)
 */

import { openSync, readFileSync, writeSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const CORE_VERSION = '1.3.0';

// ---------------------------------------------------------------------------
// Built-in known-good registry. This is the fallback when operators.json is
// missing, invalid, or fails validation — and the reference the file must match.
// ---------------------------------------------------------------------------

const BUILTIN_ACTIONS = ['read', 'advise', 'publish', 'spend', 'write'];

const BUILTIN_MODES = {
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

const BUILTIN_ENVIRONMENTS = {
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

const BUILTIN_OPERATORS = {
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
    mode: 'read-only-advisory',
    status: 'deployed-unproven',
  },
};

// ---------------------------------------------------------------------------
// Input handling: validate strictly, sanitize everything that gets recorded.
// ---------------------------------------------------------------------------

// IDs must be real strings: start alphanumeric, then letters/digits/._-,
// max 128 chars. This rejects '', '__proto__', 'constructor', whitespace,
// and every non-string — before any lookup happens.
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

function isValidId(value) {
  return typeof value === 'string' && ID_PATTERN.test(value);
}

// Convert ANY value to a JSON-safe, bounded string for logging. Never throws,
// never returns a live object reference, never stores more than maxLen chars.
// Circular structures become '[circular]', BigInts become '123n', Symbols
// become 'Symbol(x)', objects become truncated JSON.
function sanitizeValue(value, maxLen = 128) {
  try {
    if (typeof value === 'string') {
      return value.length > maxLen ? value.slice(0, maxLen) : value;
    }
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      typeof value === 'bigint'
    ) {
      return String(value).slice(0, maxLen);
    }
    if (typeof value === 'symbol') return String(value).slice(0, maxLen);
    if (typeof value === 'function') return '[function]';
    const seen = new Set();
    const json = JSON.stringify(value, (_key, v) => {
      if (typeof v === 'bigint') return `${v}n`;
      if (typeof v === 'object' && v !== null) {
        if (seen.has(v)) return '[circular]';
        seen.add(v);
      }
      return v;
    });
    const out = json === undefined ? '[unserializable]' : json;
    return out.length > maxLen ? out.slice(0, maxLen) : out;
  } catch {
    return '[unserializable]';
  }
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value)) deepFreeze(v);
  }
  return value;
}

// Deep copy for validated plain data (registry entries, mode-change requests).
// Only ever called on values the core itself built from validated primitives,
// so the JSON round-trip is safe here.
function copy(value) {
  return JSON.parse(JSON.stringify(value));
}

// ---------------------------------------------------------------------------
// Registry loading + strict validation.
// The registry is loaded from operators.json at import. Anything wrong with
// the file — missing, unparsable, failed validation — falls back to the
// built-in known-good registry, and the fallback is recorded in the audit log.
// A bad registry can never silently take effect and never crashes the core.
// ---------------------------------------------------------------------------

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function validateRegistry(data) {
  const errors = [];
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, errors: ['registry root must be a JSON object'] };
  }
  if (data.actions !== undefined && !Array.isArray(data.actions)) {
    errors.push('actions must be an array when present');
  }

  const environments = new Map();
  if (!Array.isArray(data.environments)) {
    errors.push('environments must be an array');
  } else {
    for (const env of data.environments) {
      if (!env || typeof env !== 'object' || Array.isArray(env)) {
        errors.push('each environment must be an object');
        continue;
      }
      if (!isValidId(env.id)) {
        errors.push(`environment id invalid: ${sanitizeValue(env.id)}`);
        continue;
      }
      if (FORBIDDEN_KEYS.has(env.id)) {
        errors.push(`environment id forbidden: ${env.id}`);
        continue;
      }
      if (environments.has(env.id)) {
        errors.push(`duplicate environment id: ${env.id}`);
        continue;
      }
      environments.set(env.id, {
        id: env.id,
        label: typeof env.label === 'string' ? env.label : env.id,
        kind: typeof env.kind === 'string' ? env.kind : '',
      });
    }
  }

  const modes = new Map();
  if (!data.modes || typeof data.modes !== 'object' || Array.isArray(data.modes)) {
    errors.push('modes must be an object');
  } else {
    for (const [name, mode] of Object.entries(data.modes)) {
      if (!isValidId(name)) {
        errors.push(`mode name invalid: ${sanitizeValue(name)}`);
        continue;
      }
      if (FORBIDDEN_KEYS.has(name)) {
        errors.push(`mode name forbidden: ${name}`);
        continue;
      }
      if (!mode || typeof mode !== 'object' || Array.isArray(mode)) {
        errors.push(`mode '${name}' must be an object`);
        continue;
      }
      const perms = mode.permissions;
      if (!perms || typeof perms !== 'object' || Array.isArray(perms)) {
        errors.push(`mode '${name}' is missing permissions`);
        continue;
      }
      const clean = {};
      let permsOk = true;
      for (const action of BUILTIN_ACTIONS) {
        if (typeof perms[action] !== 'boolean') {
          errors.push(`mode '${name}' permission '${action}' must be a boolean`);
          permsOk = false;
          break;
        }
        clean[action] = perms[action];
      }
      if (!permsOk) continue;
      modes.set(name, {
        label: typeof mode.label === 'string' ? mode.label : name,
        description: typeof mode.description === 'string' ? mode.description : '',
        permissions: clean,
      });
    }
  }

  const operators = new Map();
  if (!Array.isArray(data.operators)) {
    errors.push('operators must be an array');
  } else {
    for (const op of data.operators) {
      if (!op || typeof op !== 'object' || Array.isArray(op)) {
        errors.push('each operator must be an object');
        continue;
      }
      if (!isValidId(op.id)) {
        errors.push(`operator id invalid: ${sanitizeValue(op.id)}`);
        continue;
      }
      if (FORBIDDEN_KEYS.has(op.id)) {
        errors.push(`operator id forbidden: ${op.id}`);
        continue;
      }
      if (operators.has(op.id)) {
        errors.push(`duplicate operator id: ${op.id}`);
        continue;
      }
      if (typeof op.name !== 'string' || op.name.trim() === '') {
        errors.push(`operator '${op.id}' is missing a name`);
        continue;
      }
      if (!environments.has(op.environment)) {
        errors.push(
          `operator '${op.id}' references unknown environment '${sanitizeValue(op.environment)}'`,
        );
        continue;
      }
      if (!modes.has(op.mode)) {
        errors.push(`operator '${op.id}' references unknown mode '${sanitizeValue(op.mode)}'`);
        continue;
      }
      if (typeof op.status !== 'string' || op.status.trim() === '') {
        errors.push(`operator '${op.id}' is missing a status`);
        continue;
      }
      operators.set(op.id, {
        id: op.id,
        name: op.name,
        environment: op.environment,
        mode: op.mode,
        status: op.status,
      });
    }
  }

  if (operators.size === 0) errors.push('registry has no valid operators');
  return { ok: errors.length === 0, errors, operators, modes, environments };
}

function buildMapsFromBuiltins() {
  return {
    operators: new Map(
      Object.entries(BUILTIN_OPERATORS).map(([id, op]) => [id, { ...op }]),
    ),
    modes: new Map(
      Object.entries(BUILTIN_MODES).map(([name, m]) => [
        name,
        { label: m.label, description: m.description, permissions: { ...m.permissions } },
      ]),
    ),
    environments: new Map(
      Object.entries(BUILTIN_ENVIRONMENTS).map(([id, e]) => [id, { ...e }]),
    ),
  };
}

function loadRegistry() {
  const file = process.env.GALINYX_OPERATORS_FILE
    ? path.resolve(process.env.GALINYX_OPERATORS_FILE)
    : fileURLToPath(new URL('./operators.json', import.meta.url));
  try {
    const raw = readFileSync(file, 'utf8');
    const data = JSON.parse(raw);
    const result = validateRegistry(data);
    if (result.ok) {
      return {
        operators: result.operators,
        modes: result.modes,
        environments: result.environments,
        source: file,
        fallback: false,
        errors: [],
      };
    }
    return { ...buildMapsFromBuiltins(), source: file, fallback: true, errors: result.errors };
  } catch (err) {
    return {
      ...buildMapsFromBuiltins(),
      source: file,
      fallback: true,
      errors: [`could not load registry from ${file}: ${err.message}`],
    };
  }
}

// Live registry state: private Maps. Nothing outside this module can reach
// them; the exports below are frozen snapshots / a read-only Proxy.
const registry = loadRegistry();
const operators = registry.operators;
const modes = registry.modes;
const environments = registry.environments;

// ---------------------------------------------------------------------------
// Audit log: append-only, persisted to a JSONL file, replayed on startup.
//
// - Every entry carries a monotonic seq (resumed from disk) and the core
//   version, so ordering never depends on timestamps alone and the code
//   version behind every decision is on the record.
// - Entries are deep-frozen at record time and hold only sanitized
//   primitives — callers cannot mutate history by mutating what they passed in.
// - The file is the durable history; the in-memory array is a rolling window
//   (50,000 entries) so a process that runs for years does not grow
//   unboundedly. Full history stays in the file.
// - Persistence trade-off (deliberate): writes are buffered appends via a
//   lazily-opened fd, with NO fsync per entry. This survives a process crash
//   and a normal restart; it does NOT guarantee the last few entries survive
//   an OS crash or power loss. Add fsync if that guarantee is ever needed.
// - On startup the file is replayed: approved mode changes are re-applied and
//   still-pending requests are restored, so a restart no longer silently
//   reverts modes or drops pending requests.
// - Corrupt lines in the file are skipped (counted), never fatal.
// ---------------------------------------------------------------------------

const AUDIT_FILE = process.env.GALINYX_AUDIT_FILE
  ? path.resolve(process.env.GALINYX_AUDIT_FILE)
  : fileURLToPath(new URL('./audit-log.jsonl', import.meta.url));

const MAX_IN_MEMORY_ENTRIES = 50000;
const TRIM_BATCH = 5000;

const auditLog = [];
let auditSeq = 0;
const pendingModeChanges = [];
let auditFd = null;
let persistFailures = 0;
let persistWarningsLogged = 0;

function persistEntry(entry) {
  try {
    if (auditFd === null) auditFd = openSync(AUDIT_FILE, 'a');
    writeSync(auditFd, `${JSON.stringify(entry)}\n`);
  } catch (err) {
    // Persistence failing must not crash authorization. The entry is still in
    // the in-memory log; the failure is counted and warned about (at most 3
    // times) so a broken audit file is visible, not silent.
    persistFailures++;
    if (persistWarningsLogged < 3) {
      persistWarningsLogged++;
      console.error(
        `[GALINYX] WARNING: could not append to audit file ${AUDIT_FILE}: ${err.message} (audit continues in memory only)`,
      );
    }
  }
}

// Records one entry. Never throws: a logging failure must not break the
// decision it was recording.
function recordAudit(entry) {
  try {
    const full = deepFreeze({ ...entry, seq: auditSeq + 1, coreVersion: CORE_VERSION });
    auditSeq = full.seq;
    auditLog.push(full);
    if (auditLog.length > MAX_IN_MEMORY_ENTRIES + TRIM_BATCH) {
      auditLog.splice(0, auditLog.length - MAX_IN_MEMORY_ENTRIES);
    }
    persistEntry(full);
    return full;
  } catch (err) {
    console.error(`[GALINYX] WARNING: failed to record audit entry: ${err.message}`);
    return null;
  }
}

function loadPersistedAuditLog() {
  let loaded = 0;
  let skipped = 0;
  let maxSeq = 0;
  const requested = new Map(); // requestId -> request snapshot
  const decided = new Set(); // requestIds with a terminal decision

  let text;
  try {
    text = readFileSync(AUDIT_FILE, 'utf8');
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error(
        `[GALINYX] WARNING: could not read audit file ${AUDIT_FILE}: ${err.message}`,
      );
    }
    return { loaded: 0, skipped: 0 };
  }

  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      skipped++;
      continue;
    }
    if (
      !entry ||
      typeof entry !== 'object' ||
      Array.isArray(entry) ||
      typeof entry.seq !== 'number' ||
      typeof entry.type !== 'string' ||
      typeof entry.timestamp !== 'string'
    ) {
      skipped++;
      continue;
    }
    const frozen = deepFreeze(entry);
    auditLog.push(frozen);
    if (frozen.seq > maxSeq) maxSeq = frozen.seq;
    loaded++;

    // Replay bookkeeping (mode changes only).
    if (
      frozen.type === 'mode-change-requested' &&
      frozen.request &&
      typeof frozen.request === 'object' &&
      typeof frozen.request.id === 'string'
    ) {
      requested.set(frozen.request.id, frozen.request);
    } else if (
      (frozen.type === 'mode-change-approved' ||
        frozen.type === 'mode-change-refused' ||
        frozen.type === 'mode-change-expired' ||
        frozen.type === 'mode-change-stale') &&
      typeof frozen.requestId === 'string'
    ) {
      decided.add(frozen.requestId);
      if (
        frozen.type === 'mode-change-approved' &&
        typeof frozen.operatorId === 'string' &&
        typeof frozen.newMode === 'string'
      ) {
        const op = operators.get(frozen.operatorId);
        if (op && modes.has(frozen.newMode)) op.mode = frozen.newMode;
      }
    }
  }

  auditSeq = maxSeq;
  if (auditLog.length > MAX_IN_MEMORY_ENTRIES) {
    auditLog.splice(0, auditLog.length - MAX_IN_MEMORY_ENTRIES);
  }

  // Restore pending requests: requested, never decided, not expired, still
  // referencing a known operator and mode.
  const now = Date.now();
  for (const req of requested.values()) {
    if (decided.has(req.id)) continue;
    if (typeof req.expiresAt === 'string' && Date.parse(req.expiresAt) <= now) continue;
    if (!operators.has(req.operatorId) || !modes.has(req.requestedMode)) continue;
    pendingModeChanges.push({
      id: req.id,
      operatorId: req.operatorId,
      operatorName: typeof req.operatorName === 'string' ? req.operatorName : req.operatorId,
      environment: typeof req.environment === 'string' ? req.environment : '',
      currentMode: req.currentMode,
      requestedMode: req.requestedMode,
      status: 'pending-owner-approval',
      requestedBy: typeof req.requestedBy === 'string' ? req.requestedBy : 'unknown',
      requestedAt: req.requestedAt,
      expiresAt: req.expiresAt,
      decidedAt: null,
      decidedBy: null,
    });
  }
  return { loaded, skipped };
}

loadPersistedAuditLog();

// If the registry file failed, say so loudly in the audit log (and on stderr).
if (registry.fallback) {
  recordAudit({
    type: 'registry-fallback',
    timestamp: new Date().toISOString(),
    operatorId: 'governance-core',
    environment: '',
    action: 'registry-load',
    allowed: false,
    reason: `Registry file '${registry.source}' failed validation or could not be loaded (${registry.errors.join('; ')}). Running on the built-in known-good registry.`,
    errors: registry.errors.slice(0, 10),
  });
  console.error(`[GALINYX] WARNING: registry fallback in effect: ${registry.errors.join('; ')}`);
}

// ---------------------------------------------------------------------------
// Mode-change lifecycle configuration.
// ---------------------------------------------------------------------------

const MODE_CHANGE_TTL_MS = (() => {
  const v = Number(process.env.GALINYX_MODE_CHANGE_TTL_MS);
  return Number.isFinite(v) && v > 0 ? v : 30 * 24 * 60 * 60 * 1000; // default: 30 days
})();

// Owner-identity guardrail for approveModeChange(). This checks that the
// approver NAMES the configured owner identity. It is NOT authentication:
// anyone who can call this function and knows the owner string can approve.
// Real authentication (signed owner approvals) is future work — see the
// stress-test report. Until then, only trusted in-process code may call this.
const OWNER_ID = process.env.GALINYX_OWNER_ID || 'owner';

// ---------------------------------------------------------------------------
// Public exports: read-only views of the live registry.
//
// MODES / ENVIRONMENTS / ACTIONS are deep-frozen snapshots taken at import.
// They cannot be mutated — not by accident, not by a hostile caller — and
// authorize() never reads them anyway; it reads the private Maps.
//
// OPERATORS is a Proxy over the live operator Map: reads reflect current
// state (including approved mode changes), writes throw.
// ---------------------------------------------------------------------------

export const ACTIONS = Object.freeze([...BUILTIN_ACTIONS]);

function frozenModes() {
  const out = {};
  for (const [name, m] of modes) {
    out[name] = Object.freeze({
      label: m.label,
      description: m.description,
      permissions: Object.freeze({ ...m.permissions }),
    });
  }
  return Object.freeze(out);
}
export const MODES = frozenModes();

function frozenEnvironments() {
  const out = {};
  for (const [id, e] of environments) {
    out[id] = Object.freeze({ ...e });
  }
  return Object.freeze(out);
}
export const ENVIRONMENTS = frozenEnvironments();

export const OPERATORS = new Proxy(Object.create(null), {
  get(_target, key) {
    if (typeof key !== 'string') return undefined;
    const op = operators.get(key);
    return op ? Object.freeze({ ...op }) : undefined;
  },
  set() {
    throw new Error(
      'OPERATORS is read-only. Change the registry file (operators.json) and restart; do not mutate the export.',
    );
  },
  deleteProperty() {
    throw new Error(
      'OPERATORS is read-only. Change the registry file (operators.json) and restart; do not mutate the export.',
    );
  },
  defineProperty() {
    throw new Error(
      'OPERATORS is read-only. Change the registry file (operators.json) and restart; do not mutate the export.',
    );
  },
  has(_target, key) {
    return typeof key === 'string' && operators.has(key);
  },
  ownKeys() {
    return [...operators.keys()];
  },
  getOwnPropertyDescriptor(_target, key) {
    if (typeof key === 'string' && operators.has(key)) {
      return {
        value: Object.freeze({ ...operators.get(key) }),
        writable: false,
        enumerable: true,
        configurable: true,
      };
    }
    return undefined;
  },
});

// ---------------------------------------------------------------------------
// Authorization.
//
// authorize() NEVER throws. Any invalid input, unknown ID, or unexpected
// error results in a denial — and the attempt is still recorded in the
// audit log, so a failed attack leaves a trace instead of a gap.
// ---------------------------------------------------------------------------

export function authorize(operatorId, environment, action) {
  const timestamp = new Date().toISOString();
  const safeOp = sanitizeValue(operatorId);
  const safeEnv = sanitizeValue(environment);
  const safeAction = sanitizeValue(action);
  let allowed = false;
  let reason = '';
  // Set only when the denial means "a legitimate action this operator's mode
  // does not allow" — i.e. the operator wants to do something that needs
  // owner approval. Unknown operators/actions, bad input, environment
  // separation, and errors are NOT approval requests and never notify.
  let needsOwnerApproval = false;
  let deniedModeLabel = '';
  try {
    if (!isValidId(operatorId) || !isValidId(environment) || !isValidId(action)) {
      reason =
        'Invalid input: operator, environment, and action must be non-empty ID strings. Access denied.';
    } else {
      const operator = operators.get(operatorId);
      if (!operator) {
        reason = `Unknown operator '${operatorId}'. Access denied.`;
      } else if (!ACTIONS.includes(action)) {
        reason = `Unknown action '${action}'. Access denied.`;
      } else if (operator.environment !== environment) {
        reason = `Environment separation: '${operator.name}' is bound to '${operator.environment}' and may not act in '${environment}'. Access denied.`;
      } else {
        const mode = modes.get(operator.mode);
        if (!mode) {
          reason = `Unknown mode '${operator.mode}' on '${operator.name}'. Access denied.`;
        } else if (mode.permissions[action]) {
          allowed = true;
          reason = `Allowed: '${operator.name}' in mode '${mode.label}' may '${action}' in '${environment}'.`;
        } else {
          needsOwnerApproval = true;
          deniedModeLabel = mode.label;
          reason = `Denied: '${operator.name}' in mode '${mode.label}' may not '${action}'. Read-only advisory mode allows observe and advise only.`;
        }
      }
    }
  } catch (err) {
    // Fail closed: any unexpected error denies access. The attempt is still
    // logged below.
    allowed = false;
    reason = `Authorization error (${sanitizeValue(err && err.message ? err.message : err)}). Failing closed: access denied.`;
  }

  recordAudit({
    type: 'authorization',
    timestamp,
    operatorId: safeOp,
    environment: safeEnv,
    action: safeAction,
    allowed,
    reason,
  });

  // The denial and the notification are one act: when a known operator in
  // its own environment is denied only because its mode does not allow a
  // legitimate action, the owner is told. notifyOwnerApprovalNeeded() never
  // throws and is a no-op with no sink registered, so this cannot break
  // authorize().
  if (!allowed && needsOwnerApproval) {
    notifyOwnerApprovalNeeded({
      operatorId,
      environment,
      action,
      reference: `'${action}' in '${environment}' (mode '${deniedModeLabel}')`,
      reason,
    });
  }

  return {
    allowed,
    reason,
    operatorId: safeOp,
    environment: safeEnv,
    action: safeAction,
    timestamp,
  };
}

// ---------------------------------------------------------------------------
// Interaction audit hook.
//
// recordInteractionAudit() is called ONLY by the operator interaction layer
// (interactions.mjs), so every operator-to-operator message decision is
// recorded in this audit log alongside every other Core decision. It
// validates and sanitizes its input, never throws, and cannot set
// type/seq/coreVersion — those are set here by recordAudit(). A malformed
// call returns null and records nothing; it never forges an entry.
// ---------------------------------------------------------------------------

export function recordInteractionAudit(input) {
  try {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
    const { messageId, fromOperatorId, toOperatorId, kind, environment, allowed, reason } = input;
    if (typeof messageId !== 'string' || messageId === '') return null;
    if (typeof kind !== 'string' || kind === '') return null;
    if (typeof allowed !== 'boolean') return null;
    // A malformed attempt still leaves a trace (the Core's rule: a failed
    // attack leaves a trace instead of a gap). Invalid IDs are recorded as
    // 'invalid-input' and an empty environment means none was established —
    // the same convention the registry-fallback entry already uses. The kind
    // is recorded as claimed (sanitized): kind validation belongs to the
    // layer's authorization decision, not to the audit recorder — exactly
    // as authorize() records denied unknown actions.
    const safeFrom = isValidId(fromOperatorId) ? fromOperatorId : 'invalid-input';
    const safeTo = isValidId(toOperatorId) ? toOperatorId : 'invalid-input';
    const safeEnv = environment === '' || isValidId(environment) ? environment : 'invalid-input';
    const safeKind = sanitizeValue(kind, 64);
    return recordAudit({
      type: 'interaction',
      timestamp: new Date().toISOString(),
      operatorId: safeFrom,
      environment: safeEnv,
      action: `message:${safeKind}`,
      allowed,
      reason: sanitizeValue(reason, 512),
      messageId: sanitizeValue(messageId, 128),
      toOperatorId: safeTo,
      kind: safeKind,
    });
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Owner-notification sink.
//
// setNotificationSink() / notifyOwnerApprovalNeeded() / isOwner() /
// recordNotificationAudit() — narrow hooks for the owner-notification system
// (notifications.mjs), ordered by the owner 2026-11-18: when an operator
// wants to do something that needs owner approval, the owner must be told
// and able to respond.
//
// The Core never imports the notification module: the layer registers a
// sink function with setNotificationSink(), and the Core calls it when
// something needs the owner's approval (an authorize() mode denial, a
// mode-change request). With no sink registered, everything here is a
// no-op and the Core behaves exactly as before. The sink is last-wins:
// registering a second sink replaces the first (one writer process, same
// rule as the audit log).
//
// notifyOwnerApprovalNeeded() never throws and cannot break the caller:
// a failing or missing sink means no notification is created, and the
// denial itself is still audit-logged by authorize() — so the attempt is
// never silent even if the alert path is down.
// ---------------------------------------------------------------------------

let notificationSink = null;

export function setNotificationSink(fn) {
  if (fn !== null && typeof fn !== 'function') return false;
  notificationSink = fn;
  return true;
}

export function notifyOwnerApprovalNeeded(payload) {
  try {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return { notified: false, reason: 'Invalid notification payload.' };
    }
    const { operatorId, environment, action, reference, reason } = payload;
    if (!isValidId(operatorId) || !operators.has(operatorId)) {
      return { notified: false, reason: 'Unknown operator for notification.' };
    }
    if (environment !== '' && !isValidId(environment)) {
      return { notified: false, reason: 'Invalid environment for notification.' };
    }
    if (typeof action !== 'string' || action === '') {
      return { notified: false, reason: 'Invalid action for notification.' };
    }
    if (notificationSink === null) {
      return { notified: false, reason: 'No notification sink registered.' };
    }
    const result = notificationSink({
      operatorId,
      environment: environment || '',
      action: sanitizeValue(action, 128),
      reference: sanitizeValue(reference, 1024),
      reason: sanitizeValue(reason, 512),
    });
    const created = Boolean(result && typeof result === 'object' && result.created === true);
    return {
      notified: created,
      reason: created ? 'Notification created.' : 'Sink did not create a notification.',
    };
  } catch (err) {
    return {
      notified: false,
      reason: `Notification sink failed (${sanitizeValue(err && err.message ? err.message : err)}). The denial itself is still audit-logged.`,
    };
  }
}

// isOwner() exposes the same owner-identity guardrail approveModeChange()
// uses, so the notification layer can enforce "only the owner decides"
// without duplicating the configured identity. Same limit as that
// guardrail: the identity is a claim, not a credential, until signed owner
// approvals exist (v1 Phase 4).
export function isOwner(identity) {
  return typeof identity === 'string' && identity !== '' && identity === OWNER_ID;
}

// recordNotificationAudit() is called ONLY by the owner-notification system
// (notifications.mjs), so every owner decision on a notification is recorded
// in this audit log alongside every other Core decision. It validates and
// sanitizes its input, never throws, and cannot set type/seq/coreVersion —
// those are set here by recordAudit(). A malformed call returns null and
// records nothing; it never forges an entry. (Notification CREATION needs
// no audit entry of its own: the authorize() denial that caused it is
// already audit-logged, and a mode-change request is audit-logged as
// mode-change-requested. Only the owner's DECISION is a new act.)
export function recordNotificationAudit(input) {
  try {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
    const { notificationId, operatorId, environment, decision, decidedBy, reason } = input;
    if (typeof notificationId !== 'string' || notificationId === '') return null;
    if (decision !== 'approved' && decision !== 'denied') return null;
    if (typeof decidedBy !== 'string' || decidedBy === '') return null;
    const safeOp = isValidId(operatorId) ? operatorId : 'invalid-input';
    const safeEnv = environment === '' || isValidId(environment) ? environment : 'invalid-input';
    return recordAudit({
      type: 'notification-decision',
      timestamp: new Date().toISOString(),
      operatorId: safeOp,
      environment: safeEnv,
      action: `notification:${decision}`,
      allowed: decision === 'approved',
      reason: sanitizeValue(reason, 512),
      notificationId: sanitizeValue(notificationId, 128),
      decision,
      decidedBy: sanitizeValue(decidedBy, 256),
    });
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Mode changes.
//
// requestModeChange() NEVER changes a mode. It records a PENDING request
// only. approveModeChange() is the only function that changes a mode, and
// only when the approver matches the configured owner identity.
// Requests are deduplicated (one pending request per operator+mode), expire
// after GALINYX_MODE_CHANGE_TTL_MS (default 30 days), and go stale if the
// operator's mode moves after the request was made.
// ---------------------------------------------------------------------------

export function requestModeChange(operatorId, newMode, requestedBy = 'unknown') {
  const timestamp = new Date().toISOString();
  const safeBy = sanitizeValue(requestedBy, 256);

  if (!isValidId(operatorId) || !isValidId(newMode)) {
    return { recorded: false, request: null, reason: 'Invalid operator or mode.' };
  }
  const operator = operators.get(operatorId);
  if (!operator) {
    return { recorded: false, request: null, reason: `Unknown operator '${operatorId}'.` };
  }
  if (!modes.has(newMode)) {
    return { recorded: false, request: null, reason: `Unknown mode '${newMode}'.` };
  }
  if (operator.mode === newMode) {
    return {
      recorded: false,
      request: null,
      reason: `'${operator.name}' is already in mode '${newMode}'.`,
    };
  }
  const existing = pendingModeChanges.find(
    (r) =>
      r.operatorId === operatorId &&
      r.requestedMode === newMode &&
      r.status === 'pending-owner-approval',
  );
  if (existing) {
    return {
      recorded: false,
      request: null,
      reason: `A request for '${operator.name}' to move to '${newMode}' is already pending (${existing.id}).`,
    };
  }

  const request = {
    id: `mode-change-${randomUUID()}`,
    operatorId,
    operatorName: operator.name,
    environment: operator.environment,
    currentMode: operator.mode,
    requestedMode: newMode,
    status: 'pending-owner-approval',
    requestedBy: safeBy,
    requestedAt: timestamp,
    expiresAt: new Date(Date.now() + MODE_CHANGE_TTL_MS).toISOString(),
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
    reason: `Mode change requested for '${operator.name}': '${operator.mode}' -> '${newMode}'. Recorded as PENDING. Mode changes require explicit owner approval and are never self-approved.`,
    requestId: request.id,
    request: { ...request },
  });

  // A pending mode-change request is an operator asking the owner for
  // something — the owner must be told. No-op with no sink registered.
  notifyOwnerApprovalNeeded({
    operatorId,
    environment: operator.environment,
    action: 'mode-change',
    reference: `mode-change request ${request.id}: '${operator.mode}' -> '${newMode}'`,
    reason: `Mode change requested for '${operator.name}': '${operator.mode}' -> '${newMode}'. Awaiting owner approval.`,
  });

  return {
    recorded: true,
    request: copy(request),
    reason: `Recorded as pending-owner-approval. '${operator.name}' stays in '${operator.mode}' until the owner approves.`,
  };
}

export function approveModeChange(operatorId, requestId, approvedBy, approve = true) {
  const timestamp = new Date().toISOString();

  if (typeof approvedBy !== 'string' || approvedBy.trim() === '') {
    return {
      applied: false,
      reason: 'An approver is required. Mode changes require explicit owner approval.',
    };
  }
  if (approvedBy !== OWNER_ID) {
    return {
      applied: false,
      reason: `Approver '${sanitizeValue(approvedBy)}' is not the configured owner identity. Mode changes require owner approval.`,
    };
  }
  if (!isValidId(operatorId) || typeof requestId !== 'string' || requestId === '') {
    return { applied: false, reason: 'Invalid operator or request ID.' };
  }

  const operator = operators.get(operatorId);
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

  // Expired requests cannot be approved.
  if (typeof request.expiresAt === 'string' && Date.parse(request.expiresAt) <= Date.now()) {
    request.status = 'expired';
    request.decidedAt = timestamp;
    request.decidedBy = approvedBy;
    recordAudit({
      type: 'mode-change-expired',
      timestamp,
      operatorId,
      environment: operator.environment,
      action: 'mode-change',
      allowed: false,
      reason: `Mode-change request '${requestId}' for '${operator.name}' expired before approval. Mode stays '${operator.mode}'.`,
      requestId,
    });
    return {
      applied: false,
      reason: `Request '${requestId}' expired. '${operator.name}' stays in '${operator.mode}'.`,
    };
  }

  // Stale requests (the mode moved since the request was made) cannot be
  // approved — approving them would apply a decision made against old state.
  if (request.currentMode !== operator.mode) {
    request.status = 'stale';
    request.decidedAt = timestamp;
    request.decidedBy = approvedBy;
    recordAudit({
      type: 'mode-change-stale',
      timestamp,
      operatorId,
      environment: operator.environment,
      action: 'mode-change',
      allowed: false,
      reason: `Mode-change request '${requestId}' for '${operator.name}' is stale: it was made when the mode was '${request.currentMode}', but the mode is now '${operator.mode}'. A fresh request is needed.`,
      requestId,
    });
    return {
      applied: false,
      reason: `Request '${requestId}' is stale (mode moved since it was made). Make a fresh request.`,
    };
  }

  // The requested mode must still exist at approval time.
  if (!modes.has(request.requestedMode)) {
    return {
      applied: false,
      reason: `Requested mode '${request.requestedMode}' no longer exists.`,
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
      reason: `Owner '${approvedBy}' approved mode change for '${operator.name}': '${previousMode}' -> '${operator.mode}'.`,
      requestId,
      previousMode,
      newMode: operator.mode,
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
    reason: `Owner '${approvedBy}' refused mode change for '${operator.name}'. Mode stays '${operator.mode}'.`,
    requestId,
  });
  return {
    applied: false,
    reason: `Refused by ${approvedBy}. '${operator.name}' stays in '${operator.mode}'.`,
  };
}

// ---------------------------------------------------------------------------
// Read accessors.
//
// getAuditLog() returns the frozen entries themselves: they were deep-frozen
// at record time, so returning them directly is safe — callers cannot rewrite
// history. The array is a fresh copy. Pass a limit to get the newest N.
// getOperator() / listOperators() / mode-change accessors return deep copies.
// ---------------------------------------------------------------------------

export function getOperator(operatorId) {
  if (!isValidId(operatorId)) return null;
  const op = operators.get(operatorId);
  return op ? copy(op) : null;
}

export function listOperators() {
  return [...operators.values()].map(copy);
}

export function getAuditLog(limit = 0) {
  return limit > 0 ? auditLog.slice(-limit) : auditLog.slice();
}

export function getPendingModeChanges() {
  return pendingModeChanges
    .filter((r) => r.status === 'pending-owner-approval')
    .map(copy);
}

export function getAllModeChangeRequests() {
  return pendingModeChanges.map(copy);
}

export function getAuditStats() {
  return {
    coreVersion: CORE_VERSION,
    inMemoryEntries: auditLog.length,
    lastSeq: auditSeq,
    auditFile: AUDIT_FILE,
    persistFailures,
  };
}
