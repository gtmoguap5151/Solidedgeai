/**
 * GALINYX Governance Core — owner alert & notification system (v1.5.0)
 * ====================================================================
 * The owner's inbox: when an operator wants to do something that needs
 * owner approval, the owner is told and can respond.
 *
 * Ordered by the owner (Matt Johnson), 2026-11-18. Design:
 *   governance-core/../notification-system-design-2026-11-18.md
 *
 * Before this system, nothing told the owner when an operator wanted
 * something: the only paths were Xena (chat + the round table) and the
 * Core screen's pending-request list with copy-buttons. Now the Core
 * itself raises the alert.
 *
 * How it works:
 *   - The Core calls a registered notification sink when something needs
 *     the owner's approval: an authorize() denial caused only by the
 *     operator's mode (a legitimate action — publish, spend, write — the
 *     mode does not allow), a mode-change request, or a cross-environment
 *     message denial. The denial and the notification are one act.
 *   - This module is the sink. createNotificationSystem(core) registers
 *     itself with the Core's setNotificationSink(); every notification
 *     lands in one append-only log (notifications.jsonl, at the
 *     governance-core root) and in the in-memory inbox.
 *   - The owner decides with decide(): approve or deny. Only the owner
 *     can decide — operators can never approve their own or each other's
 *     requests. Every decision is audit-logged through the Core's
 *     recordNotificationAudit() hook.
 *
 * What triggers a notification (and what does not):
 *   - YES: mode-permission denials (publish/spend/write), mode-change
 *     requests, cross-environment message denials, and direct
 *     createNotification() calls (e.g. a draft ready for owner review).
 *   - NO: allowed actions, and denials for other reasons (unknown
 *     operator/action, bad input, environment separation, errors). The
 *     inbox stays quiet except when the owner is actually needed.
 *
 * The log is append-only, so a decision never rewrites history: creating
 * a notification appends a `notification` entry; deciding appends a
 * `notification-decision` entry. The in-memory record is the current
 * state (replayed from the log at startup); the log holds the whole
 * lifecycle. This mirrors the Core's own mode-change audit pattern
 * (mode-change-requested, then mode-change-approved/refused).
 *
 * What a decision does — and does NOT do:
 *   - Approving a notification records the owner's YES. It grants NO
 *     permission and changes NO mode: the operator still cannot publish
 *     or spend on its own. Execution follows through existing channels —
 *     the owner approves a mode change, or the owner/Xena performs the
 *     action. Every decision entry records grantsPermission: false, so
 *     the record itself cannot be misread as a grant.
 *   - Denying records the owner's NO the same way.
 *
 * Rules enforced here, in code (fail closed, always):
 *   1. Only the owner decides. decide() requires the Core's isOwner()
 *      check to pass AND refuses any decider that is a registered
 *      operator ID — even if the owner identity were misconfigured to
 *      match one. Without the Core's isOwner hook (an older core), all
 *      decisions are refused rather than guessed. v1.4.0: once an owner
 *      key is registered, decide() ALSO requires a valid owner signature
 *      bound to the notification — the identity claim alone is no
 *      longer enough. Until then the claim path still works, and the
 *      decision entry flags authenticated: false.
 *   2. A notification can be decided exactly once. Deciding an
 *      already-decided (or unknown) notification is refused.
 *   3. Every decision is audit-logged. If the Core's
 *      recordNotificationAudit hook is missing, the decision is still
 *      recorded in notifications.jsonl, flagged auditLogged: false —
 *      the notification log itself is the durable record.
 *   4. Nothing that needs approval fails silently. A sink failure is
 *      reported to the caller (the Core's notifyOwnerApprovalNeeded
 *      returns { notified: false }), and the underlying denial is always
 *      audit-logged by authorize() regardless.
 *
 * Honest limits (same as the Core):
 *   - Owner identity is a claim until an owner key is registered:
 *     isOwner() compares against the configured owner identity
 *     (GALINYX_OWNER_ID, default 'owner'), same guardrail as
 *     approveModeChange(). v1.4.0 adds signed owner approvals
 *     (./auth.mjs): once an owner key is registered, decide()
 *     requires a valid owner signature. Until then, only trusted
 *     in-process code may call decide().
 *   - No push delivery in this build. The inbox + log is the system;
 *     in-app Approve/Deny buttons use the copy-text fallback until the
 *     Phase 2 backend lands, and real push notifications come with it.
 *   - Single writer. The log file is append-only and survives restarts,
 *     but two writer processes would interleave entries and could
 *     collide on sequence numbers. Run exactly one writer process, as
 *     with the audit log.
 *   - Writes are buffered appends with NO fsync per entry (same
 *     trade-off as the audit log): survives a process crash, not
 *     guaranteed against an OS crash or power loss.
 *
 * Usage:
 *   import * as core from './index.mjs';
 *   import { createNotificationSystem } from './notifications.mjs';
 *   const system = createNotificationSystem(core);
 *   core.authorize('tailor-operator', 'blackpine-field', 'publish');
 *   // -> denied by the Core, notification created in the inbox
 *   const pending = system.listPending();
 *   system.decide(pending[0].id, 'owner', true, 'Go ahead.');
 *
 * The system takes the core module as an argument (dependency injection)
 * so tests can hand it a fresh, isolated core instance instead of sharing
 * the one this module would import. No network calls. Zero third-party
 * dependencies. Only Node built-ins: fs, path, crypto, url.
 *
 * Environment variables:
 *   GALINYX_NOTIFICATIONS_FILE - append-only JSONL notification log
 *                                (default: ../notifications.jsonl, i.e.
 *                                the governance-core root)
 */

import { openSync, readFileSync, writeSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const NOTIFICATION_LAYER_VERSION = '1.5.0';

// Actions a notification may concern. Core actions (from authorize()),
// plus the two approval-needing flows that don't go through authorize():
// mode-change requests and cross-environment message denials.
export const NOTIFIABLE_ACTIONS = Object.freeze([
  'read',
  'advise',
  'publish',
  'spend',
  'write',
  'mode-change',
  'message:cross-environment',
]);

// ---------------------------------------------------------------------------
// Input handling: same discipline as the Core — validate strictly, sanitize
// everything that gets recorded, never throw on hostile input.
// ---------------------------------------------------------------------------

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

function isValidId(value) {
  return typeof value === 'string' && ID_PATTERN.test(value);
}

// Convert ANY value to a JSON-safe, bounded string for logging. Never throws,
// never returns a live object reference, never stores more than maxLen chars.
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

function copy(value) {
  return JSON.parse(JSON.stringify(value));
}

// A notification is an alert, not a file transfer: references and reasons
// are bounded.
const MAX_REFERENCE_CHARS = 1024;
const MAX_REASON_CHARS = 512;
const MAX_IN_MEMORY_ENTRIES = 50000;
const TRIM_BATCH = 5000;

// ---------------------------------------------------------------------------
// System factory. All state lives in the closure, so each system instance is
// independent — tests get a fresh system over a fresh temp file.
// ---------------------------------------------------------------------------

export function createNotificationSystem(core, opts = {}) {
  if (!core || typeof core.getOperator !== 'function') {
    throw new Error(
      'createNotificationSystem requires a Governance Core module (getOperator missing).',
    );
  }
  const coreVersion =
    typeof core.CORE_VERSION === 'string' ? core.CORE_VERSION : 'unknown';

  const notificationsFile = opts.notificationsFile
    ? path.resolve(opts.notificationsFile)
    : process.env.GALINYX_NOTIFICATIONS_FILE
      ? path.resolve(process.env.GALINYX_NOTIFICATIONS_FILE)
      : fileURLToPath(new URL('../notifications.jsonl', import.meta.url));

  // id -> current notification record (frozen). Order is kept in `order`.
  const byId = new Map();
  const order = [];
  let seq = 0;
  let skippedLines = 0;
  let persistFailures = 0;
  let persistWarningsLogged = 0;
  let auditHookWarningsLogged = 0;
  let fd = null;

  // Replay the existing log on startup: creation entries build records,
  // decision entries update them. Corrupt lines are skipped (counted),
  // never fatal. A decision for an unknown notification is skipped too —
  // it cannot invent a notification that was never created.
  try {
    const text = readFileSync(notificationsFile, 'utf8');
    let maxSeq = 0;
    for (const line of text.split('\n')) {
      if (!line.trim()) continue;
      let entry;
      try {
        entry = JSON.parse(line);
      } catch {
        skippedLines++;
        continue;
      }
      if (
        !entry ||
        typeof entry !== 'object' ||
        Array.isArray(entry) ||
        typeof entry.seq !== 'number' ||
        typeof entry.id !== 'string'
      ) {
        skippedLines++;
        continue;
      }
      if (entry.type === 'notification') {
        if (typeof entry.operatorId !== 'string' || typeof entry.action !== 'string') {
          skippedLines++;
          continue;
        }
        if (!byId.has(entry.id)) {
          byId.set(entry.id, deepFreeze(entry));
          order.push(entry.id);
        }
      } else if (entry.type === 'notification-decision') {
        const current = byId.get(entry.notificationId);
        if (
          !current ||
          (entry.decision !== 'approved' && entry.decision !== 'denied')
        ) {
          skippedLines++;
          continue;
        }
        byId.set(
          entry.notificationId,
          deepFreeze({
            ...current,
            status: entry.decision,
            decidedBy: entry.decidedBy || null,
            decidedAt: entry.decidedAt || null,
            decisionReason: entry.decisionReason || null,
            auditLogged: entry.auditLogged === true,
          }),
        );
      } else {
        skippedLines++;
        continue;
      }
      if (entry.seq > maxSeq) maxSeq = entry.seq;
    }
    seq = maxSeq;
    if (order.length > MAX_IN_MEMORY_ENTRIES) {
      const excess = order.splice(0, order.length - MAX_IN_MEMORY_ENTRIES);
      for (const id of excess) byId.delete(id);
    }
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error(
        `[GALINYX] WARNING: could not read notification log ${notificationsFile}: ${err.message}`,
      );
    }
    // ENOENT (no log yet) is normal: the first notification creates the file.
  }

  function persistEntry(entry) {
    try {
      if (fd === null) fd = openSync(notificationsFile, 'a');
      writeSync(fd, `${JSON.stringify(entry)}\n`);
    } catch (err) {
      persistFailures++;
      if (persistWarningsLogged < 3) {
        persistWarningsLogged++;
        console.error(
          `[GALINYX] WARNING: could not append to notification log ${notificationsFile}: ${err.message} (log continues in memory only)`,
        );
      }
    }
  }

  // -------------------------------------------------------------------------
  // createNotification: the one way a notification is born.
  //
  // Called by the Core through the registered sink (the denial and the
  // notification are one act), or directly by trusted in-process code for
  // triggers that don't flow through authorize() — e.g. a draft ready for
  // owner review.
  //
  // createNotification() NEVER throws. Invalid input results in
  // { created: false, reason } and records nothing — a malformed call is a
  // programming error, not an authorization decision, so unlike authorize()
  // denials it leaves no log entry; the caller gets the failure back and
  // the Core's notifyOwnerApprovalNeeded reports { notified: false }.
  // -------------------------------------------------------------------------
  function createNotification(operatorId, action, reference, reason, source = 'core') {
    try {
      if (!isValidId(operatorId)) {
        return { created: false, reason: 'Invalid operator ID for notification.' };
      }
      const operator = core.getOperator(operatorId);
      if (!operator) {
        return { created: false, reason: `Unknown operator '${operatorId}' for notification.` };
      }
      if (typeof action !== 'string' || !NOTIFIABLE_ACTIONS.includes(action)) {
        return {
          created: false,
          reason: `Action '${sanitizeValue(action)}' is not a notifiable action.`,
        };
      }
      const entry = deepFreeze({
        id: `notif-${randomUUID()}`,
        seq: seq + 1,
        type: 'notification',
        timestamp: new Date().toISOString(),
        coreVersion,
        layerVersion: NOTIFICATION_LAYER_VERSION,
        operatorId,
        operatorName: operator.name,
        environment: operator.environment,
        action,
        reference: sanitizeValue(reference, MAX_REFERENCE_CHARS),
        reason: sanitizeValue(reason, MAX_REASON_CHARS),
        source: sanitizeValue(source, 64),
        status: 'pending',
        decidedBy: null,
        decidedAt: null,
        decisionReason: null,
        auditLogged: false,
      });
      seq = entry.seq;
      byId.set(entry.id, entry);
      order.push(entry.id);
      if (order.length > MAX_IN_MEMORY_ENTRIES + TRIM_BATCH) {
        const excess = order.splice(0, order.length - MAX_IN_MEMORY_ENTRIES);
        for (const id of excess) byId.delete(id);
      }
      persistEntry(entry);
      return { created: true, notification: copy(entry), reason: 'Notification created.' };
    } catch (err) {
      return {
        created: false,
        reason: `Notification error (${sanitizeValue(err && err.message ? err.message : err)}).`,
      };
    }
  }

  // The sink the Core calls. Validates the payload again (defense in depth:
  // the Core validated it too) and creates the notification. Never throws.
  function sink(payload) {
    try {
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return { created: false, reason: 'Invalid sink payload.' };
      }
      return createNotification(
        payload.operatorId,
        payload.action,
        payload.reference,
        payload.reason,
        'core-sink',
      );
    } catch (err) {
      return {
        created: false,
        reason: `Sink error (${sanitizeValue(err && err.message ? err.message : err)}).`,
      };
    }
  }

  // Register as the Core's notification sink. Last-wins on the Core (one
  // writer process). Older cores have no setNotificationSink — the system
  // still works for direct createNotification() calls, but authorize()
  // denials cannot reach it; the stats say so honestly.
  let sinkRegistered = false;
  if (typeof core.setNotificationSink === 'function') {
    try {
      sinkRegistered = core.setNotificationSink(sink) === true;
    } catch {
      sinkRegistered = false;
    }
  }

  // -------------------------------------------------------------------------
  // decide: the owner answers. approve=true approves, false denies.
  //
  // decide() NEVER throws. A refused decision returns { decided: false,
  // reason } and records nothing — the notification stays pending and the
  // owner can still decide it later.
  //
  // An approved notification grants NO permission and changes NO mode: the
  // decision is a recorded YES, not a grant. Execution follows through
  // existing channels (a mode change, or the owner/Xena performing the
  // action). Every decision entry records grantsPermission: false.
  //
  // Signed owner approval (v1.4.0): decide() accepts an optional 5th
  // argument, a signed owner proof (see ./auth.mjs). Once an owner key
  // is registered with the Core, a decision REQUIRES a valid proof bound
  // to the notification — the identity claim alone is refused. Until
  // then the claim path still works, and the decision entry records
  // authenticated: false. With an older Core (no isOwnerKeyRegistered
  // hook), the claim path is all there is.
  // -------------------------------------------------------------------------
  function decide(notificationId, decidedBy, approve, decisionReason = '', proof = null) {
    try {
      if (typeof notificationId !== 'string' || notificationId === '') {
        return { decided: false, reason: 'Invalid notification ID.' };
      }
      if (typeof approve !== 'boolean') {
        return { decided: false, reason: 'A decision requires an explicit approve (true) or deny (false).' };
      }
      // Only the owner decides. Two guards, both required:
      //   1. The Core's isOwner() check must pass.
      //   2. The decider must not be a registered operator ID — even if the
      //      owner identity were misconfigured to match one, an operator
      //      can never approve its own or another operator's request.
      // Without the Core's isOwner hook (an older core), every decision is
      // refused rather than guessed.
      if (typeof core.isOwner !== 'function') {
        return {
          decided: false,
          reason: 'This Core cannot verify the owner identity (no isOwner hook). Decision refused.',
        };
      }
      if (typeof decidedBy !== 'string' || decidedBy === '' || !core.isOwner(decidedBy)) {
        return {
          decided: false,
          reason: `Decider '${sanitizeValue(decidedBy)}' is not the configured owner identity. Only the owner can decide notifications.`,
        };
      }
      if (core.getOperator(decidedBy) !== null) {
        return {
          decided: false,
          reason: `Decider '${sanitizeValue(decidedBy)}' is a registered operator. Operators can never decide notifications — even their own.`,
        };
      }
      // Third guard (v1.4.0): when an owner key is registered, the
      // decision must carry a valid owner signature bound to this
      // notification. A signature for a different notification, an
      // expired or replayed proof, or no proof at all is refused — and
      // the notification stays pending, so the owner can decide it
      // properly later.
      let authenticated = false;
      let authKeyId = null;
      if (typeof core.isOwnerKeyRegistered === 'function' && core.isOwnerKeyRegistered()) {
        if (proof === null || proof === undefined) {
          return {
            decided: false,
            reason: 'An owner key is registered: decisions require a signed owner approval. No proof was presented.',
          };
        }
        if (typeof core.verifyOwnerApproval !== 'function') {
          return {
            decided: false,
            reason: 'This Core cannot verify owner signatures (no verifyOwnerApproval hook). Decision refused.',
          };
        }
        const check = core.verifyOwnerApproval(proof, {
          action: 'notification-decision',
          context: notificationId,
        });
        if (!check.authenticated) {
          return { decided: false, reason: `Owner approval rejected: ${check.reason}` };
        }
        authenticated = true;
        authKeyId = check.keyId;
      }
      const current = byId.get(notificationId);
      if (!current) {
        return { decided: false, reason: `Unknown notification '${notificationId}'.` };
      }
      if (current.status !== 'pending') {
        return {
          decided: false,
          reason: `Notification '${notificationId}' was already decided (${current.status}). A notification can be decided exactly once.`,
        };
      }

      const decision = approve ? 'approved' : 'denied';
      const decidedAt = new Date().toISOString();
      const safeReason = sanitizeValue(decisionReason, MAX_REASON_CHARS);

      // Audit-log the decision first, so the decision entry can say
      // truthfully whether the audit copy exists.
      let auditLogged = false;
      if (typeof core.recordNotificationAudit === 'function') {
        try {
          const recorded = core.recordNotificationAudit({
            notificationId,
            operatorId: current.operatorId,
            environment: current.environment,
            decision,
            decidedBy,
            reason: `Owner '${decidedBy}' ${decision} ${current.operatorName}'s request to '${current.action}' (${current.reference}).${safeReason ? ` Owner's note: ${safeReason}` : ''}${authenticated ? ' Signed owner approval.' : ''}`,
            authenticated,
            authKeyId,
          });
          auditLogged = recorded !== null;
        } catch {
          auditLogged = false;
        }
      } else if (auditHookWarningsLogged < 3) {
        auditHookWarningsLogged++;
        console.error(
          '[GALINYX] WARNING: core has no recordNotificationAudit hook; notification decisions are recorded in notifications.jsonl only.',
        );
      }

      const decisionEntry = deepFreeze({
        id: `notif-decision-${randomUUID()}`,
        seq: seq + 1,
        type: 'notification-decision',
        timestamp: decidedAt,
        coreVersion,
        layerVersion: NOTIFICATION_LAYER_VERSION,
        notificationId,
        operatorId: current.operatorId,
        decision,
        decidedBy,
        decidedAt,
        decisionReason: safeReason,
        // A decision is a recorded YES/NO, never a grant. Modes and
        // permissions change only through the Core's own flows.
        grantsPermission: false,
        auditLogged,
        authenticated,
        authKeyId,
      });
      seq = decisionEntry.seq;
      persistEntry(decisionEntry);

      const updated = deepFreeze({
        ...current,
        status: decision,
        decidedBy,
        decidedAt,
        decisionReason: safeReason,
        auditLogged,
        authenticated,
        authKeyId,
      });
      byId.set(notificationId, updated);

      return {
        decided: true,
        approved: approve,
        notification: copy(updated),
        auditLogged,
        authenticated,
        authKeyId,
        reason: `Owner '${decidedBy}' ${decision} the request from '${current.operatorName}' to '${current.action}'.${authenticated ? ' Signed.' : ''}`,
      };
    } catch (err) {
      return {
        decided: false,
        reason: `Decision error (${sanitizeValue(err && err.message ? err.message : err)}). Failing closed: notification stays pending.`,
      };
    }
  }

  // -------------------------------------------------------------------------
  // Read accessors. The owner reads the whole inbox: listAll() returns
  // everything, pending and decided. Entries were deep-frozen at record
  // time, so returning copies is safe — callers cannot rewrite history.
  // -------------------------------------------------------------------------
  function listPending() {
    return order
      .map((id) => byId.get(id))
      .filter((n) => n && n.status === 'pending')
      .map(copy);
  }

  function listAll(limit = 0) {
    const all = order.map((id) => byId.get(id)).filter(Boolean);
    const slice = limit > 0 ? all.slice(-limit) : all;
    return slice.map(copy);
  }

  function getNotification(notificationId) {
    if (typeof notificationId !== 'string') return null;
    const n = byId.get(notificationId);
    return n ? copy(n) : null;
  }

  function getNotificationsFor(operatorId) {
    if (!isValidId(operatorId)) return [];
    return order
      .map((id) => byId.get(id))
      .filter((n) => n && n.operatorId === operatorId)
      .map(copy);
  }

  function getNotificationStats() {
    const all = order.map((id) => byId.get(id)).filter(Boolean);
    return {
      layerVersion: NOTIFICATION_LAYER_VERSION,
      coreVersion,
      inMemoryEntries: all.length,
      pendingCount: all.filter((n) => n.status === 'pending').length,
      decidedCount: all.filter((n) => n.status !== 'pending').length,
      lastSeq: seq,
      notificationsFile,
      skippedLines,
      persistFailures,
      sinkRegistered,
      auditHookAvailable: typeof core.recordNotificationAudit === 'function',
      ownerHookAvailable: typeof core.isOwner === 'function',
    };
  }

  return Object.freeze({
    createNotification,
    decide,
    listPending,
    listAll,
    getNotification,
    getNotificationsFor,
    getNotificationStats,
  });
}
