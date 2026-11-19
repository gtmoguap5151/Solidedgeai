/**
 * GALINYX Governance Core — operator interaction layer (v1.2.0)
 * ================================================================
 * Governed messaging between operators: ASK, HANDOFF, NOTICE.
 *
 * Ordered by the owner (Matt Johnson), 2026-11-18. Design:
 *   governance-core/../interaction-layer-design-2026-11-18.md
 *
 * Before this layer, operators could not interact at all: no messaging, no
 * handoffs, no shared state. Each process held its own registry state. This
 * module is the one shared channel, and every message through it is a
 * recorded, authorized act — exactly like every other Core decision.
 *
 * How it works:
 *   - One append-only interaction log (interactions.jsonl, at the
 *     governance-core root). One entry per message: from, to, kind, payload,
 *     timestamp, Core decision (allowed/denied), reason. The log is the
 *     shared state; the registry still has no multi-process sync.
 *   - Every message decision is ALSO recorded in the Core audit log
 *     (audit-log.jsonl) via the core's recordInteractionAudit() hook, so
 *     interaction history shows up in the same audit trail as everything
 *     else. If the hook is missing (an older core), the message is still
 *     decided and recorded in interactions.jsonl, flagged auditLogged: false
 *     — the interaction log itself is the durable record.
 *
 * Rules enforced here, in code (fail closed, always):
 *   1. Same-environment only by default. A message across environments needs
 *      the owner's approval (ownerApproved + approvedBy at send time).
 *      A cross-environment denial also notifies the owner through the
 *      Core's notifyOwnerApprovalNeeded() hook (v1.3.0+), so the request
 *      reaches the owner's notification inbox instead of dying silently.
 *   2. A handoff NEVER transfers permission. Handing work to another operator
 *      does not change either operator's mode and grants nothing: publish
 *      and spend still need the owner's approval per action. Every entry
 *      records grantsPermission: false and both operators' modes at send time.
 *   3. Every message is audit-logged — allowed and denied alike, in both logs.
 *   4. No operator can impersonate another. Until signed-token auth exists
 *      (v1 Phase 4), every sender is an unverified claim: entries carry
 *      senderVerified: false and say so. When auth lands, this flag becomes
 *      meaningful; nothing here pretends it already is.
 *   5. The owner can read the whole log. getMessages() returns everything,
 *      allowed and denied. Nothing between operators is hidden from the owner.
 *
 * Sending requires a deployed sender: the sender's mode must allow 'advise'
 * and the recipient's mode must allow 'read'. A not-deployed operator can
 * neither send nor receive. An operator cannot message itself.
 *
 * Honest limits (same as the Core):
 *   - Sender identity is a claim, not a credential (see rule 4).
 *   - Cross-environment owner approval is a claim too: the caller passes
 *     ownerApproved + approvedBy, and the layer records them. It does NOT
 *     verify them against a signature — the Core's owner-identity guardrail
 *     has the same limit. Signed owner approvals are future work.
 *   - Single writer. The log file is append-only and survives restarts, but
 *     two writer processes would interleave entries and could collide on
 *     sequence numbers. Run exactly one writer process, as with the audit log.
 *   - Writes are buffered appends with NO fsync per entry (same trade-off as
 *     the audit log): survives a process crash, not guaranteed against an OS
 *     crash or power loss.
 *
 * Usage:
 *   import * as core from './index.mjs';
 *   import { createInteractionLayer } from './interactions.mjs';
 *   const layer = createInteractionLayer(core);
 *   layer.sendMessage('tailor-operator', 'blackpine-operator', 'HANDOFF', '...');
 *
 * The layer takes the core module as an argument (dependency injection) so
 * tests can hand it a fresh, isolated core instance instead of sharing the
 * one this module would import. No network calls. Zero third-party
 * dependencies. Only Node built-ins: fs, path, crypto, url.
 *
 * Environment variables:
 *   GALINYX_INTERACTIONS_FILE - append-only JSONL interaction log
 *                               (default: ../interactions.jsonl, i.e. the
 *                               governance-core root)
 */

import { openSync, readFileSync, writeSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const INTERACTION_LAYER_VERSION = '1.2.0';
export const INTERACTION_KINDS = Object.freeze(['ASK', 'HANDOFF', 'NOTICE']);

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

// Payloads are bounded: a message is a work note, not a file transfer.
const MAX_PAYLOAD_CHARS = 4096;
const MAX_IN_MEMORY_ENTRIES = 50000;
const TRIM_BATCH = 5000;

const SENDER_UNVERIFIED_NOTE =
  'Sender is an unverified claim: signed-token operator auth is not yet implemented (v1 Phase 4).';

// ---------------------------------------------------------------------------
// Layer factory. All state lives in the closure, so each layer instance is
// independent — tests get a fresh layer over a fresh temp file.
// ---------------------------------------------------------------------------

export function createInteractionLayer(core, opts = {}) {
  if (!core || typeof core.getOperator !== 'function') {
    throw new Error(
      'createInteractionLayer requires a Governance Core module (getOperator missing).',
    );
  }
  const modes = core.MODES && typeof core.MODES === 'object' ? core.MODES : {};
  const coreVersion =
    typeof core.CORE_VERSION === 'string' ? core.CORE_VERSION : 'unknown';

  const interactionsFile = opts.interactionsFile
    ? path.resolve(opts.interactionsFile)
    : process.env.GALINYX_INTERACTIONS_FILE
      ? path.resolve(process.env.GALINYX_INTERACTIONS_FILE)
      : fileURLToPath(new URL('../interactions.jsonl', import.meta.url));

  const messages = [];
  let seq = 0;
  let skippedLines = 0;
  let persistFailures = 0;
  let persistWarningsLogged = 0;
  let auditHookWarningsLogged = 0;
  let fd = null;

  // Replay the existing log on startup: resume the sequence, restore the
  // in-memory window. Corrupt lines are skipped (counted), never fatal.
  try {
    const text = readFileSync(interactionsFile, 'utf8');
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
        typeof entry.id !== 'string' ||
        entry.type !== 'interaction'
      ) {
        skippedLines++;
        continue;
      }
      messages.push(deepFreeze(entry));
      if (entry.seq > maxSeq) maxSeq = entry.seq;
    }
    seq = maxSeq;
    if (messages.length > MAX_IN_MEMORY_ENTRIES) {
      messages.splice(0, messages.length - MAX_IN_MEMORY_ENTRIES);
    }
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error(
        `[GALINYX] WARNING: could not read interaction log ${interactionsFile}: ${err.message}`,
      );
    }
    // ENOENT (no log yet) is normal: the first message creates the file.
  }

  function persistEntry(entry) {
    try {
      if (fd === null) fd = openSync(interactionsFile, 'a');
      writeSync(fd, `${JSON.stringify(entry)}\n`);
    } catch (err) {
      persistFailures++;
      if (persistWarningsLogged < 3) {
        persistWarningsLogged++;
        console.error(
          `[GALINYX] WARNING: could not append to interaction log ${interactionsFile}: ${err.message} (log continues in memory only)`,
        );
      }
    }
  }

  function modeAllows(modeName, action) {
    const mode = modes[modeName];
    return Boolean(mode && mode.permissions && mode.permissions[action] === true);
  }

  // -------------------------------------------------------------------------
  // sendMessage: the one way operators talk to each other.
  //
  // sendMessage() NEVER throws. Any invalid input, unknown ID, or unexpected
  // error results in a denial — and the attempt is still recorded in the
  // interaction log, so a failed attempt leaves a trace instead of a gap.
  //
  // options: { ownerApproved?: boolean, approvedBy?: string }
  //   Required for cross-environment messages. Both must be present and
  //   approvedBy must be a non-empty string; the approval is recorded as a
  //   claim (see the header: no signature verification until Phase 4).
  // -------------------------------------------------------------------------
  function sendMessage(fromId, toId, kind, payload, options = {}) {
    const timestamp = new Date().toISOString();
    const messageId = `msg-${randomUUID()}`;
    const safePayload = sanitizeValue(payload, MAX_PAYLOAD_CHARS);
    let allowed = false;
    let reason = '';
    let crossEnvironment = false;
    let ownerApproved = false;
    let approvedBy = null;
    let senderName = sanitizeValue(fromId);
    let recipientName = sanitizeValue(toId);
    let senderMode = '';
    let recipientMode = '';
    let environment = '';

    try {
      const sender = isValidId(fromId) ? core.getOperator(fromId) : null;
      const recipient = isValidId(toId) ? core.getOperator(toId) : null;

      if (!isValidId(fromId) || !isValidId(toId)) {
        reason =
          'Invalid input: sender and recipient must be non-empty ID strings. Message denied.';
      } else if (!INTERACTION_KINDS.includes(kind)) {
        reason = `Unknown message kind '${sanitizeValue(kind)}'. Kinds are ASK, HANDOFF, NOTICE. Message denied.`;
      } else if (!sender) {
        reason = `Unknown sender '${fromId}'. Message denied.`;
      } else if (!recipient) {
        reason = `Unknown recipient '${toId}'. Message denied.`;
      } else if (fromId === toId) {
        reason = 'An operator cannot message itself. Message denied.';
      } else if (!modeAllows(sender.mode, 'advise')) {
        reason = `Denied: '${sender.name}' in mode '${sender.mode}' may not send messages (sending requires the advise permission). Message denied.`;
      } else if (!modeAllows(recipient.mode, 'read')) {
        reason = `Denied: '${recipient.name}' in mode '${recipient.mode}' cannot receive messages (receiving requires the read permission). Message denied.`;
      } else {
        senderName = sender.name;
        recipientName = recipient.name;
        senderMode = sender.mode;
        recipientMode = recipient.mode;
        environment = sender.environment;
        crossEnvironment = sender.environment !== recipient.environment;
        if (crossEnvironment) {
          const approvalOk =
            options &&
            options.ownerApproved === true &&
            typeof options.approvedBy === 'string' &&
            options.approvedBy.trim() !== '';
          if (!approvalOk) {
            reason = `Environment separation: '${sender.name}' is bound to '${sender.environment}' and '${recipient.name}' to '${recipient.environment}'. Cross-environment messages need the owner's approval. Message denied.`;
            // The owner must be told: an operator wants to message across
            // environments and needs approval. Guarded — cores before v1.3.0
            // have no notifyOwnerApprovalNeeded, and the call is a no-op
            // with no notification sink registered. A failing alert path
            // never breaks the denial, which is still recorded below.
            if (typeof core.notifyOwnerApprovalNeeded === 'function') {
              try {
                core.notifyOwnerApprovalNeeded({
                  operatorId: fromId,
                  environment: sender.environment,
                  action: 'message:cross-environment',
                  reference: `message ${messageId} to '${recipient.name}' (${toId})`,
                  reason: `Cross-environment message from '${sender.name}' to '${recipient.name}' needs the owner's approval. Message denied.`,
                });
              } catch {
                // Never breaks the decision.
              }
            }
          } else {
            ownerApproved = true;
            approvedBy = sanitizeValue(options.approvedBy, 256);
            allowed = true;
            reason = `Allowed (cross-environment, owner-approved by '${approvedBy}'): '${sender.name}' -> '${recipient.name}' (${kind}).`;
          }
        } else {
          allowed = true;
          reason = `Allowed: '${sender.name}' -> '${recipient.name}' (${kind}) in '${sender.environment}'.`;
        }
        if (allowed && kind === 'HANDOFF') {
          reason +=
            ' Handoff grants no permission: neither operator\'s mode changes, and publish or spend still needs the owner\'s approval per action.';
        }
      }
    } catch (err) {
      // Fail closed: any unexpected error denies the message. The attempt is
      // still logged below.
      allowed = false;
      reason = `Message error (${sanitizeValue(err && err.message ? err.message : err)}). Failing closed: message denied.`;
    }

    // Record the decision in the Core audit log first, so the interaction
    // entry can say truthfully whether the audit copy exists.
    let auditLogged = false;
    if (typeof core.recordInteractionAudit === 'function') {
      try {
        const recorded = core.recordInteractionAudit({
          messageId,
          fromOperatorId: sanitizeValue(fromId),
          toOperatorId: sanitizeValue(toId),
          kind,
          environment: environment || '',
          allowed,
          reason,
        });
        auditLogged = recorded !== null;
      } catch {
        auditLogged = false;
      }
    } else if (auditHookWarningsLogged < 3) {
      auditHookWarningsLogged++;
      console.error(
        '[GALINYX] WARNING: core has no recordInteractionAudit hook; interaction decisions are recorded in interactions.jsonl only.',
      );
    }

    const entry = deepFreeze({
      id: messageId,
      seq: seq + 1,
      type: 'interaction',
      timestamp,
      coreVersion,
      layerVersion: INTERACTION_LAYER_VERSION,
      from: sanitizeValue(fromId),
      fromName: senderName,
      to: sanitizeValue(toId),
      toName: recipientName,
      kind: INTERACTION_KINDS.includes(kind) ? kind : sanitizeValue(kind),
      payload: safePayload,
      environment,
      crossEnvironment,
      ownerApproved,
      approvedBy,
      senderMode,
      recipientMode,
      senderVerified: false,
      senderNote: SENDER_UNVERIFIED_NOTE,
      // No message kind grants permission. Only an owner-approved mode change
      // does, and that goes through the Core's own flow — never through here.
      grantsPermission: false,
      allowed,
      reason,
      auditLogged,
    });
    seq = entry.seq;
    messages.push(entry);
    if (messages.length > MAX_IN_MEMORY_ENTRIES + TRIM_BATCH) {
      messages.splice(0, messages.length - MAX_IN_MEMORY_ENTRIES);
    }
    persistEntry(entry);

    return {
      allowed,
      reason,
      message: copy(entry),
    };
  }

  // -------------------------------------------------------------------------
  // Read accessors. The owner reads the whole log: getMessages() returns
  // everything, allowed and denied. Entries were deep-frozen at record time,
  // so returning them directly is safe — callers cannot rewrite history.
  // -------------------------------------------------------------------------
  function getMessages(limit = 0) {
    return limit > 0 ? messages.slice(-limit) : messages.slice();
  }

  function getMessagesFor(operatorId) {
    if (!isValidId(operatorId)) return [];
    return messages.filter((m) => m.from === operatorId || m.to === operatorId);
  }

  function getInteractionStats() {
    return {
      layerVersion: INTERACTION_LAYER_VERSION,
      coreVersion,
      inMemoryEntries: messages.length,
      lastSeq: seq,
      interactionsFile,
      skippedLines,
      persistFailures,
      auditHookAvailable: typeof core.recordInteractionAudit === 'function',
    };
  }

  return Object.freeze({
    sendMessage,
    getMessages,
    getMessagesFor,
    getInteractionStats,
  });
}
