/**
 * GALINYX Governance Core — adversarial stress test / fail test.
 *
 * Run: node governance-core/src/stress-test.mjs
 *
 * Tests the REAL module (./index.mjs) with attacks and edge cases. Each check
 * states the SECURE behavior it expects and reports one of:
 *   [PASS]    - the core behaved securely.
 *   [FAIL]    - the core did something insecure or wrong (a real bug).
 *   [FINDING] - a measurement or a structural property worth knowing. Not a
 *               bug in the code as written, but a limit of the design.
 *
 * Section J tests the operator interaction layer (./interactions.mjs) the
 * same way: fresh core instances, fresh temp interaction logs.
 *
 * Section K tests the owner alert & notification system
 * (./notifications.mjs) the same way: fresh core instances, fresh temp
 * notification logs, with the notification system registered as the
 * Core's sink so authorize() denials reach the inbox.
 *
 * Section L tests signed operator authentication (./auth.mjs) the same
 * way: fresh core instances, a fresh temp auth key store, and fresh
 * nonces, so the shipped operator-keys store is never touched.
 *
 * Section M tests the v1.5.0 hierarchy-gap closures: operator
 * registration (registerOperator), the hash-chained audit log
 * (./audit-chain.mjs), shared state (./state-store.mjs, syncState),
 * the owner-key ceremony (./owner-key.mjs, test keys only, temp
 * store), the seq allocator, and the authorize() denial reason.
 *
 * Checks use fresh module instances (cache-busted imports) so each group
 * starts from a clean registry and audit log. Temp files go under an mkdtemp
 * directory and are removed at the end. Nothing in this test writes to the
 * working copy: every instance gets its own temp audit file AND its own
 * temp copy of the registry (v1.5.0: approveModeChange() and
 * registerOperator() persist to the registry file, so a shared live
 * registry would be written by the tests).
 *
 * Exit code: 1 if any check FAILED, else 0.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createInteractionLayer } from './interactions.mjs';
import { createNotificationSystem } from './notifications.mjs';
import * as auditChain from './audit-chain.mjs';
import { createStateStore } from './state-store.mjs';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'galinyx-stress-'));

// Auth stores for Section L: the auth module resolves its files from
// these env vars at import time, so set them before any core instance is
// imported. Tests that need a clean auth store call resetAuth() (Section
// L), which FAILS LOUDLY if the clear is refused — a wrong env-var name
// once sent test keys into the live store, and the suite must never
// silently do that again. The shipped operator-keys store is never touched.
process.env.GALINYX_AUTH_KEYS_FILE = path.join(TMP, 'operator-keys.json');
process.env.GALINYX_AUTH_NONCES_FILE = path.join(TMP, 'auth-nonces.jsonl');
process.env.GALINYX_AUTH_KEYS_DIR = path.join(TMP, '.keys-local');

const MODULE_URL = new URL('./index.mjs', import.meta.url).href;
const AUTH_MODULE_URL = new URL('./auth.mjs', import.meta.url).href;
const SRC_TEXT = fs.readFileSync(new URL('./index.mjs', import.meta.url), 'utf8');
const AUTH_TEXT = fs.readFileSync(new URL('./auth.mjs', import.meta.url), 'utf8');
const INTERACTIONS_TEXT = fs.readFileSync(new URL('./interactions.mjs', import.meta.url), 'utf8');
const NOTIFICATIONS_TEXT = fs.readFileSync(new URL('./notifications.mjs', import.meta.url), 'utf8');
const AUDIT_CHAIN_TEXT = fs.readFileSync(new URL('./audit-chain.mjs', import.meta.url), 'utf8');
const STATE_STORE_TEXT = fs.readFileSync(new URL('./state-store.mjs', import.meta.url), 'utf8');
const OWNER_KEY_TEXT = fs.readFileSync(new URL('./owner-key.mjs', import.meta.url), 'utf8');
const VERSION = (SRC_TEXT.match(/CORE_VERSION\s*=\s*['"]([^'"]+)['"]/) || [])[1] || 'unversioned (original build)';

console.log('GALINYX Governance Core — adversarial stress test');
console.log(`Testing core version: ${VERSION}`);
console.log(`Temp dir: ${TMP}`);

let passCount = 0;
let failCount = 0;
let findingCount = 0;
const failures = [];

async function check(name, fn) {
  try {
    const r = await fn();
    const status = r && r.status ? r.status : 'pass';
    const detail = r && r.detail ? ` — ${r.detail}` : '';
    if (status === 'pass') {
      passCount++;
      console.log(`[PASS] ${name}${detail}`);
    } else if (status === 'finding') {
      findingCount++;
      console.log(`[FINDING] ${name}${detail}`);
    } else {
      failCount++;
      failures.push(name);
      console.log(`[FAIL] ${name}${detail}`);
    }
  } catch (e) {
    failCount++;
    failures.push(name);
    console.log(`[FAIL] ${name} — check itself threw: ${e.constructor.name}: ${e.message}`);
  }
}

const ok = (cond, detail) => ({ status: cond ? 'pass' : 'fail', detail });
const finding = (detail) => ({ status: 'finding', detail });

// Fresh module instance, isolated: its own temp audit file, optional temp
// registry file, optional owner identity, optional mode-change TTL.
let instanceCounter = 0;
async function fresh(tag, opts = {}) {
  instanceCounter++;
  process.env.GALINYX_AUDIT_FILE =
    opts.auditFile || path.join(TMP, `audit-${tag}-${instanceCounter}.jsonl`);
  if (opts.operatorsFile) process.env.GALINYX_OPERATORS_FILE = opts.operatorsFile;
  else {
    // v1.5.0: approveModeChange() and registerOperator() now PERSIST to
    // the registry file. Every instance gets its own temp copy of the
    // shipped registry, so no check can ever write to the live
    // operators.json. The copy is byte-identical, so behavior matches
    // the shipped registry exactly.
    const copy = path.join(TMP, `operators-${tag}-${instanceCounter}.json`);
    fs.copyFileSync(new URL('./operators.json', import.meta.url), copy);
    process.env.GALINYX_OPERATORS_FILE = copy;
  }
  if (opts.ownerId) process.env.GALINYX_OWNER_ID = opts.ownerId;
  else delete process.env.GALINYX_OWNER_ID;
  if (opts.ttlMs !== undefined) process.env.GALINYX_MODE_CHANGE_TTL_MS = String(opts.ttlMs);
  else delete process.env.GALINYX_MODE_CHANGE_TTL_MS;
  const url = `${MODULE_URL}?instance=${tag}-${instanceCounter}-${Date.now()}`;
  return import(url);
}

function buildRegistry({ operators = null, modes = null, environments = null } = {}) {
  return {
    actions: ['read', 'advise', 'publish', 'spend', 'write'],
    company: 'GALINYX',
    environments: environments || [
      { id: 'blackpine-field', kind: 'storefront', label: 'Blackpine Field' },
      { id: 'rivet-reach', kind: 'lead generation', label: 'Rivet Reach' },
    ],
    governanceCore: 'Authority, policies, permissions, oversight',
    modes: modes || {
      'read-only-advisory': {
        label: 'Read-Only Advisory',
        description: 'May observe and advise.',
        permissions: { read: true, advise: true, publish: false, spend: false, write: false },
      },
      'not-deployed': {
        label: 'Not Deployed',
        description: 'No access.',
        permissions: { read: false, advise: false, publish: false, spend: false, write: false },
      },
    },
    operators: operators || [
      {
        id: 'blackpine-operator',
        name: 'Blackpine Operator',
        environment: 'blackpine-field',
        mode: 'read-only-advisory',
        status: 'deployed-unproven',
      },
      {
        id: 'rivet-reach-operator',
        name: 'Rivet Reach Operator',
        environment: 'rivet-reach',
        mode: 'not-deployed',
        status: 'pending-confirmation',
      },
    ],
    platform: 'GALINYX OS',
    rules: [],
  };
}

function writeRegistry(name, obj) {
  const p = path.join(TMP, name);
  fs.writeFileSync(p, typeof obj === 'string' ? obj : JSON.stringify(obj));
  return p;
}

// Fresh interaction layer over a fresh temp log, bound to a given core
// instance. All layer state lives in the factory closure, so no cache-busted
// import is needed — a new temp file per layer is the isolation.
let layerCounter = 0;
function freshLayer(tag, coreModule) {
  layerCounter++;
  const file = path.join(TMP, `interactions-${tag}-${layerCounter}.jsonl`);
  const layer = createInteractionLayer(coreModule, { interactionsFile: file });
  return { layer, file };
}

// Same isolation for the notification system: a new temp file per system.
// Creating the system registers it as the core's notification sink, so
// authorize() denials on that core reach this system's inbox.
let notificationCounter = 0;
function freshNotificationSystem(tag, coreModule) {
  notificationCounter++;
  const file = path.join(TMP, `notifications-${tag}-${notificationCounter}.jsonl`);
  const system = createNotificationSystem(coreModule, { notificationsFile: file });
  return { system, file };
}

// ---------------------------------------------------------------------------
// A. Fail-closed authorization
// ---------------------------------------------------------------------------
console.log('\n== A. Fail-closed authorization ==');

{
  const m = await fresh('a1');
  await check('A1 unknown operator is denied', () => {
    const r = m.authorize('nope-operator', 'blackpine-field', 'read');
    return ok(r.allowed === false, r.reason);
  });
}

{
  const m = await fresh('a2');
  await check('A2 unknown environment is denied', () => {
    const r = m.authorize('blackpine-operator', 'nowhere', 'read');
    return ok(r.allowed === false, r.reason);
  });
}

{
  const m = await fresh('a3');
  await check('A3 unknown action is denied', () => {
    const r = m.authorize('blackpine-operator', 'blackpine-field', 'delete');
    return ok(r.allowed === false, r.reason);
  });
}

{
  const m = await fresh('a4');
  await check('A4 missing args denied, no throw', () => {
    const r = m.authorize();
    return ok(r.allowed === false, r.reason);
  });
}

{
  const m = await fresh('a5');
  await check('A5 null/undefined args denied, no throw', () => {
    const r1 = m.authorize(null, null, null);
    const r2 = m.authorize(undefined, 'blackpine-field', 'read');
    const r3 = m.authorize('blackpine-operator', undefined, 'read');
    const r4 = m.authorize('blackpine-operator', 'blackpine-field', undefined);
    return ok(!r1.allowed && !r2.allowed && !r3.allowed && !r4.allowed, 'all denied');
  });
}

{
  const m = await fresh('a6');
  await check('A6 wrong-type args denied, no throw, string echo', () => {
    const bad = [42, true, [], {}, ['blackpine-operator']];
    for (const b of bad) {
      const r = m.authorize(b, 'blackpine-field', 'read');
      if (r.allowed) return ok(false, `ALLOWED with operatorId=${JSON.stringify(b)} (type coercion)`);
      if (typeof r.operatorId !== 'string') {
        return ok(false, `echoed operatorId is ${typeof r.operatorId}, not a string`);
      }
    }
    return ok(true, 'numbers/booleans/arrays/objects all denied with string echo');
  });
}

{
  const m = await fresh('a7');
  await check('A7 Symbol inputs denied, no throw, attempt logged', () => {
    const r1 = m.authorize(Symbol('x'), 'blackpine-field', 'read');
    const r2 = m.authorize('blackpine-operator', 'blackpine-field', Symbol('read'));
    const r3 = m.authorize('blackpine-operator', Symbol('env'), 'read');
    const logged = m.getAuditLog().length;
    if (r1.allowed || r2.allowed || r3.allowed) return ok(false, 'a Symbol input was allowed');
    return ok(logged >= 3, `audit entries recorded: ${logged} (expected >= 3)`);
  });
}

{
  const m = await fresh('a8');
  await check('A8 BigInt input denied, no throw', () => {
    const r = m.authorize(10n, 'blackpine-field', 'read');
    return ok(r.allowed === false, 'denied');
  });
}

{
  const m = await fresh('a9');
  await check('A9 100k-char input denied and log entry bounded', () => {
    const big = 'x'.repeat(100000);
    const r = m.authorize(big, 'blackpine-field', 'read');
    if (r.allowed) return ok(false, 'allowed');
    const entry = m.getAuditLog().at(-1);
    const stored = String(entry.operatorId).length;
    return ok(stored <= 512, `stored operatorId length in log: ${stored} (limit 512)`);
  });
}

{
  const m = await fresh('a10');
  await check('A10 case/whitespace variants denied', () => {
    const tests = [
      m.authorize('BLACKPINE-OPERATOR', 'blackpine-field', 'read'),
      m.authorize('blackpine-operator', 'blackpine-field', 'READ'),
      m.authorize('blackpine-operator', ' blackpine-field', 'read'),
      m.authorize('blackpine-operator', 'blackpine-field ', 'read'),
      m.authorize('blackpine-operator', 'Blackpine-Field', 'read'),
    ];
    return ok(
      tests.every((r) => r.allowed === false),
      'all denied',
    );
  });
}

{
  const m = await fresh('a11');
  await check('A11 __proto__/constructor/toString as IDs denied, no throw', () => {
    for (const id of ['__proto__', 'constructor', 'toString', 'hasOwnProperty', 'prototype']) {
      const r = m.authorize(id, 'blackpine-field', 'read');
      if (r.allowed) return ok(false, `${id} was allowed`);
    }
    return ok(true, 'all denied');
  });
}

{
  const m = await fresh('a12');
  await check('A12 fuzz sweep: 24 nasty inputs, authorize never throws, always denies', () => {
    const nasty = [
      null, undefined, 0, -1, 1.5, NaN, Infinity, true, false, '', ' ', [], [1], {},
      { toString: () => 'blackpine-operator' }, Symbol('s'), 10n, 'x'.repeat(5000),
      '__proto__', 'constructor', '\0', 'blackpine-operator\0', '１２３', 'ｂlackpine-operator',
    ];
    for (const v of nasty) {
      const r = m.authorize(v, 'blackpine-field', 'read');
      if (r.allowed) return ok(false, `ALLOWED for input ${String(v).slice(0, 40)}`);
    }
    return ok(true, `${nasty.length} inputs, all denied, no throw`);
  });
}

// ---------------------------------------------------------------------------
// B. Prototype chain & pollution
// ---------------------------------------------------------------------------
console.log('\n== B. Prototype chain & pollution ==');

{
  const m = await fresh('b1');
  await check('B1 prototype pollution cannot create a fake operator', () => {
    Object.prototype['evil-operator'] = {
      id: 'evil-operator',
      name: 'Evil',
      environment: 'blackpine-field',
      mode: 'read-only-advisory',
      status: 'x',
    };
    try {
      const r = m.authorize('evil-operator', 'blackpine-field', 'read');
      return ok(r.allowed === false, r.allowed ? 'POLLUTED OPERATOR WAS ALLOWED' : 'denied');
    } finally {
      delete Object.prototype['evil-operator'];
    }
  });
}

{
  const m = await fresh('b2');
  await check('B2 operator mode __proto__ cannot crash authorize', () => {
    let mutationBlocked = false;
    try {
      m.OPERATORS['blackpine-operator'].mode = '__proto__';
    } catch {
      mutationBlocked = true;
    }
    const r = m.authorize('blackpine-operator', 'blackpine-field', 'read');
    return ok(
      r.allowed === true && mutationBlocked,
      mutationBlocked
        ? 'mutation blocked, read still allowed'
        : `mutation applied; authorize returned allowed=${r.allowed}`,
    );
  });
}

{
  const m = await fresh('b3');
  await check('B3 mode change to __proto__/constructor/toString rejected', () => {
    for (const mode of ['__proto__', 'constructor', 'toString']) {
      const req = m.requestModeChange('blackpine-operator', mode, 'attacker');
      if (req.recorded) return ok(false, `mode '${mode}' was recorded as a pending request`);
    }
    return ok(true, 'all three rejected');
  });
}

{
  const m = await fresh('b4');
  await check('B4 getOperator(__proto__) returns null, not Object.prototype', () => {
    const op = m.getOperator('__proto__');
    return ok(op === null, op === null ? 'null' : `returned ${JSON.stringify(op)}`);
  });
}

// ---------------------------------------------------------------------------
// C. Exported registry mutability
// ---------------------------------------------------------------------------
console.log('\n== C. Exported registry mutability ==');

{
  const m = await fresh('c1');
  await check('C1 OPERATORS cannot be rewritten from outside', () => {
    const before = m.authorize('blackpine-operator', 'blackpine-field', 'publish').allowed;
    let blocked = 0;
    try {
      m.OPERATORS['blackpine-operator'].mode = 'not-deployed';
    } catch {
      blocked++;
    }
    try {
      m.OPERATORS['evil-operator'] = {
        id: 'evil-operator',
        name: 'Evil',
        environment: 'blackpine-field',
        mode: 'read-only-advisory',
        status: 'x',
      };
    } catch {
      blocked++;
    }
    try {
      delete m.OPERATORS['blackpine-operator'];
    } catch {
      blocked++;
    }
    const afterPublish = m.authorize('blackpine-operator', 'blackpine-field', 'publish').allowed;
    const afterRead = m.authorize('blackpine-operator', 'blackpine-field', 'read').allowed;
    const evil = m.authorize('evil-operator', 'blackpine-field', 'read').allowed;
    const unchanged = before === afterPublish && afterRead === true && evil === false;
    return ok(
      unchanged,
      `mutation attempts blocked: ${blocked}/3; publish still denied: ${!afterPublish}; read still allowed: ${afterRead}; evil denied: ${!evil}`,
    );
  });
}

{
  const m = await fresh('c2');
  await check('C2 MODES permissions cannot be rewritten from outside', () => {
    try {
      m.MODES['read-only-advisory'].permissions.publish = true;
    } catch {
      /* blocked */
    }
    const r = m.authorize('blackpine-operator', 'blackpine-field', 'publish');
    return ok(
      r.allowed === false,
      r.allowed ? 'PUBLISH ALLOWED after flipping permissions' : 'publish still denied',
    );
  });
}

{
  const m = await fresh('c3');
  await check('C3 ACTIONS cannot be rewritten from outside', () => {
    try {
      m.ACTIONS.push('delete');
    } catch {
      /* blocked */
    }
    try {
      m.ACTIONS.length = 0;
    } catch {
      /* blocked */
    }
    const readOk = m.authorize('blackpine-operator', 'blackpine-field', 'read').allowed;
    const delDenied = !m.authorize('blackpine-operator', 'blackpine-field', 'delete').allowed;
    return ok(readOk && delDenied, `read allowed: ${readOk}; delete denied: ${delDenied}`);
  });
}

{
  const m = await fresh('c4');
  await check('C4 ENVIRONMENTS cannot be rewritten from outside', () => {
    let blocked = false;
    try {
      m.ENVIRONMENTS['evil-env'] = { id: 'evil-env' };
    } catch {
      blocked = true;
    }
    const present = 'evil-env' in m.ENVIRONMENTS;
    return ok(
      blocked || !present,
      blocked ? 'assignment threw' : present ? 'evil env was added' : 'not present',
    );
  });
}

// ---------------------------------------------------------------------------
// D. Mode changes
// ---------------------------------------------------------------------------
console.log('\n== D. Mode changes ==');

{
  const m = await fresh('d1', { ownerId: 'matt-johnson' });
  await check('D1 approval without an approver is rejected', () => {
    const req = m.requestModeChange('blackpine-operator', 'not-deployed', 'someone');
    if (!req.recorded) return ok(false, 'setup: request was not recorded');
    const a1 = m.approveModeChange('blackpine-operator', req.request.id, '');
    const a2 = m.approveModeChange('blackpine-operator', req.request.id, undefined);
    const a3 = m.approveModeChange('blackpine-operator', req.request.id, '   ');
    const a4 = m.approveModeChange('blackpine-operator', req.request.id, 42);
    return ok(
      !a1.applied && !a2.applied && !a3.applied && !a4.applied,
      'empty/undefined/whitespace/non-string approvers all rejected',
    );
  });
}

{
  const m = await fresh('d2', { ownerId: 'matt-johnson' });
  await check('D2 approval by an arbitrary string is rejected', () => {
    const req = m.requestModeChange('blackpine-operator', 'not-deployed', 'someone');
    const ap = m.approveModeChange('blackpine-operator', req.request.id, 'mallory');
    return ok(ap.applied === false, ap.applied ? 'MALLORY APPROVED THE MODE CHANGE' : 'rejected');
  });
}

{
  const m = await fresh('d3', { ownerId: 'matt-johnson' });
  await check('D3 approval by the configured owner is applied', () => {
    const req = m.requestModeChange('blackpine-operator', 'not-deployed', 'someone');
    const ap = m.approveModeChange('blackpine-operator', req.request.id, 'matt-johnson');
    const mode = m.getOperator('blackpine-operator').mode;
    return ok(ap.applied === true && mode === 'not-deployed', `applied: ${ap.applied}, mode now: ${mode}`);
  });
}

{
  const m = await fresh('d4');
  await check('D4 approving a request that was never made is rejected', () => {
    const ap = m.approveModeChange('blackpine-operator', 'mode-change-9999', 'owner');
    return ok(ap.applied === false, 'rejected');
  });
}

{
  const m = await fresh('d5');
  await check('D5 double approval is rejected', () => {
    const req = m.requestModeChange('blackpine-operator', 'not-deployed', 'x');
    const a1 = m.approveModeChange('blackpine-operator', req.request.id, 'owner');
    const a2 = m.approveModeChange('blackpine-operator', req.request.id, 'owner');
    return ok(a1.applied === true && a2.applied === false, `first: ${a1.applied}, second: ${a2.applied}`);
  });
}

{
  const m = await fresh('d6');
  await check('D6 approving after a refusal is rejected', () => {
    const req = m.requestModeChange('rivet-reach-operator', 'not-deployed', 'x');
    const refuse = m.approveModeChange('rivet-reach-operator', req.request.id, 'owner', false);
    const ap = m.approveModeChange('rivet-reach-operator', req.request.id, 'owner', true);
    return ok(
      refuse.applied === false && ap.applied === false,
      `refuse applied: ${refuse.applied}, later approve applied: ${ap.applied}`,
    );
  });
}

{
  const m = await fresh('d7');
  await check('D7 approving a request for the wrong operator is rejected', () => {
    const req = m.requestModeChange('blackpine-operator', 'not-deployed', 'x');
    const ap = m.approveModeChange('rivet-reach-operator', req.request.id, 'owner');
    return ok(ap.applied === false, 'rejected');
  });
}

{
  const m = await fresh('d8');
  await check('D8 duplicate pending requests are rejected', () => {
    const r1 = m.requestModeChange('blackpine-operator', 'not-deployed', 'a');
    const r2 = m.requestModeChange('blackpine-operator', 'not-deployed', 'b');
    return ok(r1.recorded === true && r2.recorded === false, `first: ${r1.recorded}, second: ${r2.recorded}`);
  });
}

{
  const m = await fresh('d9');
  await check('D9 a stale pending request cannot be approved after the mode already changed', () => {
    const r1 = m.requestModeChange('blackpine-operator', 'not-deployed', 'a');
    const r2 = m.requestModeChange('blackpine-operator', 'not-deployed', 'b');
    if (!r1.recorded) return ok(false, 'setup: first request not recorded');
    m.approveModeChange('blackpine-operator', r1.request.id, 'owner');
    if (!r2.recorded) {
      return ok(true, 'second request was rejected at creation (dedup), so no stale approval is possible');
    }
    const ap = m.approveModeChange('blackpine-operator', r2.request.id, 'owner');
    return ok(ap.applied === false, ap.applied ? 'STALE REQUEST WAS APPROVED' : 'stale approval rejected');
  });
}

{
  const m = await fresh('d10', { ttlMs: 50 });
  await check('D10 an expired pending request cannot be approved', async () => {
    const req = m.requestModeChange('blackpine-operator', 'not-deployed', 'a');
    if (!req.recorded) return ok(false, 'setup: request not recorded');
    await new Promise((r) => setTimeout(r, 120));
    const ap = m.approveModeChange('blackpine-operator', req.request.id, 'owner');
    return ok(ap.applied === false, ap.applied ? 'EXPIRED REQUEST WAS APPROVED' : 'expired request rejected');
  });
}

{
  const m = await fresh('d11');
  await check('D11 requestModeChange rejects bad operator/mode without throwing', () => {
    const cases = [
      m.requestModeChange('nope', 'not-deployed', 'x'),
      m.requestModeChange('blackpine-operator', 'nope-mode', 'x'),
      m.requestModeChange(null, 'not-deployed', 'x'),
      m.requestModeChange('blackpine-operator', null, 'x'),
      m.requestModeChange(Symbol('s'), 'not-deployed', 'x'),
      m.requestModeChange('blackpine-operator', Symbol('s'), 'x'),
    ];
    return ok(
      cases.every((c) => c.recorded === false),
      'all rejected',
    );
  });
}

{
  const m1 = await fresh('d12a');
  const m2 = await fresh('d12b');
  await check('D12 mode-change request IDs are unique across restarts', () => {
    const r1 = m1.requestModeChange('blackpine-operator', 'not-deployed', 'a');
    const r2 = m2.requestModeChange('blackpine-operator', 'not-deployed', 'a');
    return ok(
      r1.request.id !== r2.request.id,
      `instance1: ${r1.request.id}, instance2: ${r2.request.id}`,
    );
  });
}

{
  const m = await fresh('d13');
  await check('D13 a non-string requestedBy cannot poison the request list', () => {
    const circ = {};
    circ.self = circ;
    m.requestModeChange('blackpine-operator', 'not-deployed', circ);
    const all = m.getAllModeChangeRequests();
    const stored = all[0] ? all[0].requestedBy : undefined;
    return ok(typeof stored === 'string', `stored requestedBy type: ${typeof stored}`);
  });
}

// ---------------------------------------------------------------------------
// E. Audit log integrity
// ---------------------------------------------------------------------------
console.log('\n== E. Audit log integrity ==');

{
  const m = await fresh('e1');
  await check('E1 audit entries cannot be rewritten by mutating caller objects', () => {
    const evil = { x: 1 };
    m.authorize('blackpine-operator', 'blackpine-field', evil);
    evil.x = 999;
    evil.pwned = true;
    const entry = m.getAuditLog().at(-1);
    const actionStr = JSON.stringify(entry.action);
    return ok(
      !actionStr.includes('999') && !actionStr.includes('pwned'),
      `stored action: ${actionStr}`,
    );
  });
}

{
  const m = await fresh('e2');
  await check('E2 a circular input cannot permanently break getAuditLog', () => {
    const c = {};
    c.self = c;
    m.authorize('blackpine-operator', 'blackpine-field', c);
    const log = m.getAuditLog();
    m.authorize('blackpine-operator', 'blackpine-field', 'read');
    const log2 = m.getAuditLog();
    return ok(log.length >= 1 && log2.length >= 2, `log readable: ${log.length} then ${log2.length} entries`);
  });
}

{
  const m = await fresh('e3');
  await check('E3 a BigInt input cannot break getAuditLog', () => {
    m.authorize(10n, 'blackpine-field', 'read');
    const log = m.getAuditLog();
    return ok(log.length >= 1, `log readable: ${log.length} entries`);
  });
}

{
  const m = await fresh('e4');
  await check('E4 mutating a returned log copy cannot rewrite history', () => {
    m.authorize('blackpine-operator', 'blackpine-field', 'read');
    const copy = m.getAuditLog();
    try {
      copy[0].allowed = false;
      copy[0].operatorId = 'forged';
    } catch {
      /* frozen: blocked */
    }
    const again = m.getAuditLog();
    return ok(
      again[0].allowed === true && again[0].operatorId === 'blackpine-operator',
      'internal log unchanged',
    );
  });
}

{
  const sharedFile = path.join(TMP, 'audit-shared.jsonl');
  const m1 = await fresh('e5a', { auditFile: sharedFile });
  await check('E5 audit history survives a restart (same audit file)', async () => {
    m1.authorize('blackpine-operator', 'blackpine-field', 'read');
    m1.authorize('blackpine-operator', 'blackpine-field', 'publish');
    const before = m1.getAuditLog().length;
    const m2 = await fresh('e5b', { auditFile: sharedFile });
    const after = m2.getAuditLog().length;
    return ok(after >= before && before >= 2, `entries before restart: ${before}, after restart: ${after}`);
  });
}

{
  const m = await fresh('e6');
  await check('E6 audit entries carry unique monotonic sequence numbers', () => {
    m.authorize('blackpine-operator', 'blackpine-field', 'read');
    m.authorize('blackpine-operator', 'blackpine-field', 'publish');
    m.authorize('blackpine-operator', 'blackpine-field', 'spend');
    const log = m.getAuditLog();
    const seqs = log.map((e) => e.seq);
    const allNumbers = seqs.every((s) => typeof s === 'number');
    const increasing = seqs.every((s, i) => i === 0 || s > seqs[i - 1]);
    return ok(allNumbers && increasing, `seqs: ${JSON.stringify(seqs)}`);
  });
}

{
  const m = await fresh('e7');
  await check('E7 audit entries carry a core version', () => {
    m.authorize('blackpine-operator', 'blackpine-field', 'read');
    const entry = m.getAuditLog().at(-1);
    return ok(
      typeof entry.coreVersion === 'string' && entry.coreVersion.length > 0,
      `coreVersion: ${entry.coreVersion}`,
    );
  });
}

{
  const m = await fresh('e8');
  await check('E8 a backward clock jump cannot corrupt log ordering', () => {
    const RealDate = Date;
    const now = Date.now();
    m.authorize('blackpine-operator', 'blackpine-field', 'read');
    // Jump the clock 10 years backward for the next entry.
    globalThis.Date = class extends RealDate {
      constructor(...args) {
        super(...(args.length ? args : [now - 10 * 365 * 24 * 3600 * 1000]));
      }
      static now() {
        return now - 10 * 365 * 24 * 3600 * 1000;
      }
    };
    try {
      m.authorize('blackpine-operator', 'blackpine-field', 'publish');
    } finally {
      globalThis.Date = RealDate;
    }
    const log = m.getAuditLog();
    const ts = log.map((e) => e.timestamp);
    const seqs = log.map((e) => e.seq);
    const tsOrdered = ts.every((t, i) => i === 0 || t >= ts[i - 1]);
    const seqOrdered =
      seqs.every((s) => typeof s === 'number') && seqs.every((s, i) => i === 0 || s > seqs[i - 1]);
    return ok(
      seqOrdered,
      `timestamps ordered: ${tsOrdered}; seq ordered: ${seqOrdered}; ts: ${JSON.stringify(ts)}`,
    );
  });
}

{
  const m = await fresh('e9');
  await check('E9 100k audit entries: time and memory (measurement)', () => {
    const t0 = Date.now();
    const heap0 = process.memoryUsage().heapUsed;
    for (let i = 0; i < 100000; i++) {
      m.authorize('blackpine-operator', 'blackpine-field', i % 2 === 0 ? 'read' : 'publish');
    }
    const elapsed = Date.now() - t0;
    const heapDeltaMB = (process.memoryUsage().heapUsed - heap0) / 1048576;
    const t1 = Date.now();
    const log = m.getAuditLog();
    const readMs = Date.now() - t1;
    const stats = typeof m.getAuditStats === 'function' ? m.getAuditStats() : null;
    return finding(
      `100k authorizes in ${elapsed}ms; heap +${heapDeltaMB.toFixed(1)}MB; ` +
        `getAuditLog returned ${log.length} entries in ${readMs}ms` +
        (stats ? `; in-memory window: ${stats.inMemoryEntries}, lastSeq: ${stats.lastSeq}` : ''),
    );
  });
}

// ---------------------------------------------------------------------------
// F. Scale
// ---------------------------------------------------------------------------
console.log('\n== F. Scale ==');

{
  const envs = [];
  for (let i = 0; i < 200; i++) envs.push({ id: `env-${i}`, kind: 'test', label: `Env ${i}` });
  const ops = [];
  for (let i = 0; i < 500; i++) {
    ops.push({
      id: `operator-${i}`,
      name: `Operator ${i}`,
      environment: `env-${i % 200}`,
      mode: 'read-only-advisory',
      status: 'test',
    });
  }
  const regFile = writeRegistry('registry-500.json', buildRegistry({ operators: ops, environments: envs }));
  const m = await fresh('f1', { operatorsFile: regFile });
  await check('F1 500 operators / 200 environments: authorize latency (measurement)', () => {
    let count = m.listOperators().length;
    let via = 'registry file';
    if (count < 500) {
      // No registration API: fall back to direct mutation of the exported registry.
      via = 'direct mutation of exported OPERATORS (no registration API)';
      for (let i = 0; i < 500; i++) {
        m.OPERATORS[`operator-${i}`] = {
          id: `operator-${i}`,
          name: `Operator ${i}`,
          environment: `env-${i % 200}`,
          mode: 'read-only-advisory',
          status: 'test',
        };
      }
      count = m.listOperators().length;
    }
    const times = [];
    for (let i = 0; i < 1000; i++) {
      const t0 = process.hrtime.bigint();
      m.authorize(`operator-${i % 500}`, `env-${(i % 500) % 200}`, 'read');
      times.push(Number(process.hrtime.bigint() - t0) / 1000);
    }
    times.sort((a, b) => a - b);
    const p50 = times[500].toFixed(1);
    const p99 = times[990].toFixed(1);
    const t0 = Date.now();
    m.listOperators();
    const listMs = Date.now() - t0;
    return finding(
      `${count} operators loaded via ${via}; authorize p50 ${p50}us p99 ${p99}us; listOperators ${listMs}ms`,
    );
  });
}

{
  const m = await fresh('f2');
  await check('F2 authorize throughput: 10k calls (measurement)', () => {
    const t0 = Date.now();
    for (let i = 0; i < 10000; i++) m.authorize('blackpine-operator', 'blackpine-field', 'read');
    const ms = Date.now() - t0;
    return finding(`10k authorizes in ${ms}ms (${(10000 / (ms / 1000)).toFixed(0)}/sec)`);
  });
}

{
  const m = await fresh('f3');
  await check('F3 registerOperator() exists — registration goes through the Core (v1.5.0)', () => {
    return ok(
      typeof m.registerOperator === 'function',
      'registration requires owner approval, writes the registry, is audit-logged, and defaults to draft-only (see Section M)',
    );
  });
}

{
  const modes = {
    'read-only-advisory': {
      label: 'RO',
      description: '',
      permissions: { read: true, advise: true, publish: false, spend: false, write: false },
    },
    'not-deployed': {
      label: 'ND',
      description: '',
      permissions: { read: false, advise: false, publish: false, spend: false, write: false },
    },
  };
  for (let i = 0; i < 1000; i++) {
    modes[`mode-${i}`] = {
      label: `M${i}`,
      description: '',
      permissions: { read: false, advise: false, publish: false, spend: false, write: false },
    };
  }
  const regFile = writeRegistry('registry-modes.json', buildRegistry({ modes }));
  const m = await fresh('f4', { operatorsFile: regFile });
  await check('F4 approval latency with ~1000 pending requests (measurement)', () => {
    let recorded = 0;
    let lastId = null;
    for (let i = 0; i < 1000; i++) {
      const r = m.requestModeChange('blackpine-operator', `mode-${i}`, 'scale-test');
      if (r.recorded) {
        recorded++;
        lastId = r.request.id;
      }
    }
    if (recorded < 100) {
      // Fallback for a core that only knows 2 modes: repeat the same request.
      for (let i = 0; i < 1000; i++) {
        const r = m.requestModeChange('blackpine-operator', 'not-deployed', 'scale-test');
        if (r.recorded) {
          recorded++;
          lastId = r.request.id;
        }
      }
    }
    const t0 = process.hrtime.bigint();
    const ap = m.approveModeChange('blackpine-operator', lastId, 'owner');
    const us = Number(process.hrtime.bigint() - t0) / 1000;
    return finding(
      `${recorded} pending requests; approving the last took ${us.toFixed(0)}us (applied: ${ap.applied})`,
    );
  });
}

// ---------------------------------------------------------------------------
// G. Registry integrity
// ---------------------------------------------------------------------------
console.log('\n== G. Registry integrity ==');

{
  const ghost = buildRegistry();
  ghost.operators.push({
    id: 'ghost-operator',
    name: 'Ghost',
    environment: 'blackpine-field',
    mode: 'read-only-advisory',
    status: 'x',
  });
  const regFile = writeRegistry('registry-ghost.json', ghost);
  const m = await fresh('g1', { operatorsFile: regFile });
  await check('G1 operators.json is the live registry (a new operator in the file takes effect)', () => {
    const ids = m.listOperators().map((o) => o.id);
    return ok(ids.includes('ghost-operator'), `operators visible: ${ids.join(', ')}`);
  });
}

{
  const regFile = writeRegistry('registry-badjson.json', '{ this is not json');
  const m = await fresh('g2', { operatorsFile: regFile });
  await check('G2 corrupt registry JSON: core keeps working on known-good fallback and warns', () => {
    const r = m.authorize('blackpine-operator', 'blackpine-field', 'read');
    const log = m.getAuditLog();
    const warned = log.some(
      (e) =>
        e.type === 'registry-fallback' ||
        (typeof e.reason === 'string' && e.reason.toLowerCase().includes('registry')),
    );
    return ok(r.allowed === true && warned, `read allowed: ${r.allowed}; fallback warning in log: ${warned}`);
  });
}

{
  const dup = buildRegistry();
  dup.operators.push({
    id: 'blackpine-operator',
    name: 'Copy',
    environment: 'rivet-reach',
    mode: 'not-deployed',
    status: 'x',
  });
  const regFile = writeRegistry('registry-dup.json', dup);
  const m = await fresh('g3', { operatorsFile: regFile });
  await check('G3 duplicate operator IDs in the registry are rejected (fallback, no crash)', () => {
    const ids = m.listOperators().map((o) => o.id);
    const r = m.authorize('blackpine-operator', 'blackpine-field', 'read');
    const warned = m.getAuditLog().some((e) => e.type === 'registry-fallback');
    return ok(
      ids.length === 2 && r.allowed === true && warned,
      `operators: ${ids.join(', ')}; read allowed: ${r.allowed}; warned: ${warned}`,
    );
  });
}

{
  const bad = buildRegistry();
  bad.operators[0].mode = 'super-user';
  const regFile = writeRegistry('registry-badmode.json', bad);
  const m = await fresh('g4', { operatorsFile: regFile });
  await check('G4 unknown mode in the registry is rejected (fallback, no crash)', () => {
    const op = m.getOperator('blackpine-operator');
    const warned = m.getAuditLog().some((e) => e.type === 'registry-fallback');
    return ok(op && op.mode === 'read-only-advisory' && warned, `mode: ${op && op.mode}; warned: ${warned}`);
  });
}

{
  const bad = buildRegistry();
  delete bad.operators[0].environment;
  const regFile = writeRegistry('registry-nofield.json', bad);
  const m = await fresh('g5', { operatorsFile: regFile });
  await check('G5 registry entry with a missing field is rejected (fallback, no crash)', () => {
    const op = m.getOperator('blackpine-operator');
    const warned = m.getAuditLog().some((e) => e.type === 'registry-fallback');
    return ok(
      op && op.environment === 'blackpine-field' && warned,
      `environment: ${op && op.environment}; warned: ${warned}`,
    );
  });
}

{
  const bad = buildRegistry();
  bad.operators.push({
    id: '__proto__',
    name: 'Proto',
    environment: 'blackpine-field',
    mode: 'read-only-advisory',
    status: 'x',
  });
  const regFile = writeRegistry('registry-proto.json', bad);
  const m = await fresh('g6', { operatorsFile: regFile });
  await check('G6 operator id __proto__ in the registry is rejected', () => {
    const ids = m.listOperators().map((o) => o.id);
    const warned = m.getAuditLog().some((e) => e.type === 'registry-fallback');
    return ok(!ids.includes('__proto__') && warned, `operators: ${ids.join(', ')}; warned: ${warned}`);
  });
}

{
  const m = await fresh('g7');
  await check('G7 the shipped operators.json parses and matches the live registry today', () => {
    const file = JSON.parse(fs.readFileSync(new URL('./operators.json', import.meta.url), 'utf8'));
    const fileIds = file.operators.map((o) => o.id).sort();
    const liveIds = m.listOperators().map((o) => o.id).sort();
    const match = JSON.stringify(fileIds) === JSON.stringify(liveIds);
    return ok(match, `file: ${fileIds.join(', ')}; live: ${liveIds.join(', ')}`);
  });
}

// ---------------------------------------------------------------------------
// H. Concurrency & multi-instance
// ---------------------------------------------------------------------------
console.log('\n== H. Concurrency & multi-instance ==');

{
  const m = await fresh('h1');
  await check('H1 10k rapid-fire calls + interleaved mode changes: no lost entries, no errors', () => {
    let errors = 0;
    for (let i = 0; i < 10000; i++) {
      try {
        m.authorize('blackpine-operator', 'blackpine-field', i % 2 ? 'read' : 'publish');
        if (i % 1000 === 0) m.requestModeChange('rivet-reach-operator', 'read-only-advisory', 'burst');
      } catch {
        errors++;
      }
    }
    const log = m.getAuditLog();
    return ok(errors === 0 && log.length >= 10000, `errors: ${errors}; log entries: ${log.length}`);
  });
}

{
  // v1.5.0: both instances share ONE registry file here, so the mode
  // change in A persists where B can sync from. (fresh() normally gives
  // each instance its own temp copy, so a shared file must be explicit.)
  const sharedRegistry = path.join(TMP, 'operators-h2-shared.json');
  fs.copyFileSync(new URL('./operators.json', import.meta.url), sharedRegistry);
  const m1 = await fresh('h2a', { operatorsFile: sharedRegistry });
  const m2 = await fresh('h2b', { operatorsFile: sharedRegistry });
  await check('H2 two live instances diverge until syncState() — shared state is explicit, not automatic (v1.5.0)', () => {
    const req = m1.requestModeChange('blackpine-operator', 'not-deployed', 'a');
    m1.approveModeChange('blackpine-operator', req.request.id, 'owner');
    const mode1 = m1.getOperator('blackpine-operator').mode;
    const before = m2.getOperator('blackpine-operator').mode;
    // The approval persisted to the registry FILE, but B still holds
    // its own copy until it syncs. After syncState(), B converges.
    const sync = m2.syncState();
    const after = m2.getOperator('blackpine-operator').mode;
    return ok(
      mode1 === 'not-deployed' && before === 'draft-only' && sync.synced === true && after === 'not-deployed',
      `A: ${mode1}; B before sync: ${before}; after syncState(): ${after} (changes: ${sync.changes})`,
    );
  });
}

{
  const sharedFile = path.join(TMP, 'audit-modes.jsonl');
  const m1 = await fresh('h3a', { auditFile: sharedFile });
  await check('H3 an approved mode change survives a restart', async () => {
    const req = m1.requestModeChange('blackpine-operator', 'not-deployed', 'a');
    m1.approveModeChange('blackpine-operator', req.request.id, 'owner');
    const before = m1.getOperator('blackpine-operator').mode;
    const m2 = await fresh('h3b', { auditFile: sharedFile });
    const after = m2.getOperator('blackpine-operator').mode;
    return ok(after === 'not-deployed', `mode before restart: ${before}; after restart: ${after}`);
  });
}

// ---------------------------------------------------------------------------
// I. Longevity (static checks)
// ---------------------------------------------------------------------------
console.log('\n== I. Longevity (static checks) ==');

{
  // v1.4.0: index.mjs imports ./auth.mjs, a first-party sibling module.
  // The rule is still "no third-party dependencies": node: built-ins
  // and relative first-party imports are allowed; bare specifiers are not.
  await check('I1 zero third-party dependencies (only node: built-ins + first-party relative imports)', () => {
    const imports = [...SRC_TEXT.matchAll(/^import\s+[\s\S]*?\s+from\s+['"]([^'"]+)['"]/gm)].map((x) => x[1]);
    const thirdParty = imports.filter(
      (i) => !i.startsWith('node:') && !i.startsWith('./') && !i.startsWith('../'),
    );
    return ok(thirdParty.length === 0, `imports: ${imports.join(', ') || '(none)'}`);
  });
}

{
  await check('I2 no eval, no Function constructor, no network calls in the core', () => {
    const bad = ['eval(', 'new Function', 'fetch(', 'http.request', 'XMLHttpRequest'].filter((s) =>
      SRC_TEXT.includes(s),
    );
    return ok(bad.length === 0, bad.length ? `found: ${bad.join(', ')}` : 'clean');
  });
}

{
  await check('I3 no exotic syntax (no decorators, no top-level await in the core)', () => {
    const hasDecorator = /^@/m.test(SRC_TEXT);
    const hasTLA = /^await\s/m.test(SRC_TEXT);
    return ok(
      !hasDecorator && !hasTLA,
      'ES2015-2022 features only: ESM, template literals, spread, Object.freeze',
    );
  });
}

{
  await check('I4 the shipped operators.json is valid JSON', () => {
    const raw = fs.readFileSync(new URL('./operators.json', import.meta.url), 'utf8');
    JSON.parse(raw);
    return ok(true, 'parses');
  });
}

// ---------------------------------------------------------------------------
// J. Operator interaction layer (interactions.mjs)
// ---------------------------------------------------------------------------
console.log('\n== J. Operator interaction layer ==');

{
  const m = await fresh('j1');
  const { layer } = freshLayer('j1', m);
  await check('J1 same-environment ASK is allowed and recorded', () => {
    const r = layer.sendMessage('galileo-operator', 'finance-brother-operator', 'ASK', 'cost check?');
    const logged = layer.getMessages();
    return ok(
      r.allowed === true && logged.length === 1 && logged[0].id === r.message.id && logged[0].allowed === true,
      r.reason,
    );
  });
}

{
  const m = await fresh('j2');
  const { layer } = freshLayer('j2', m);
  await check('J2 same-environment HANDOFF is allowed, grants no permission', () => {
    const r = layer.sendMessage('tailor-operator', 'blackpine-operator', 'HANDOFF', 'product draft for the store listing');
    return ok(
      r.allowed === true && r.message.grantsPermission === false,
      r.reason,
    );
  });
}

{
  const m = await fresh('j3');
  const { layer } = freshLayer('j3', m);
  await check('J3 a handoff transfers no permission: recipient still cannot publish, mode unchanged', () => {
    const before = m.getOperator('blackpine-operator').mode;
    const r = layer.sendMessage('tailor-operator', 'blackpine-operator', 'HANDOFF', 'product draft');
    const after = m.getOperator('blackpine-operator').mode;
    const publish = m.authorize('blackpine-operator', 'blackpine-field', 'publish');
    const spend = m.authorize('blackpine-operator', 'blackpine-field', 'spend');
    return ok(
      r.allowed === true && before === after && publish.allowed === false && spend.allowed === false,
      `mode stayed '${after}'; publish denied, spend denied`,
    );
  });
}

{
  const m = await fresh('j4');
  const { layer } = freshLayer('j4', m);
  await check('J4 cross-environment message denied without owner approval, denial recorded', () => {
    const r = layer.sendMessage('blackpine-operator', 'rivet-reach-operator', 'ASK', 'hello?');
    const logged = layer.getMessages();
    return ok(
      r.allowed === false && logged.length === 1 && logged[0].allowed === false && logged[0].crossEnvironment === true,
      r.reason,
    );
  });
}

{
  const m = await fresh('j5');
  const { layer } = freshLayer('j5', m);
  await check('J5 cross-environment message allowed with owner approval, approval on the record', () => {
    const r = layer.sendMessage(
      'blackpine-operator',
      'rivet-reach-operator',
      'ASK',
      'hello?',
      { ownerApproved: true, approvedBy: 'owner' },
    );
    return ok(
      r.allowed === true &&
        r.message.crossEnvironment === true &&
        r.message.ownerApproved === true &&
        r.message.approvedBy === 'owner',
      r.reason,
    );
  });
}

{
  const m = await fresh('j6');
  const { layer } = freshLayer('j6', m);
  await check('J6 cross-environment denied when approval lacks an approver', () => {
    const r1 = layer.sendMessage('blackpine-operator', 'rivet-reach-operator', 'ASK', 'x', {
      ownerApproved: true,
    });
    const r2 = layer.sendMessage('blackpine-operator', 'rivet-reach-operator', 'ASK', 'x', {
      ownerApproved: true,
      approvedBy: '   ',
    });
    const r3 = layer.sendMessage('blackpine-operator', 'rivet-reach-operator', 'ASK', 'x', {
      approvedBy: 'owner',
    });
    return ok(!r1.allowed && !r2.allowed && !r3.allowed, 'all three denied');
  });
}

{
  const m = await fresh('j7');
  const { layer } = freshLayer('j7', m);
  await check('J7 unknown sender/recipient, bad kind, self-message: all denied, none throws, all recorded', () => {
    const r1 = layer.sendMessage('ghost-operator', 'blackpine-operator', 'ASK', 'x');
    const r2 = layer.sendMessage('blackpine-operator', 'ghost-operator', 'ASK', 'x');
    const r3 = layer.sendMessage('blackpine-operator', 'rivet-reach-operator', 'SHOUT', 'x');
    const r4 = layer.sendMessage('blackpine-operator', 'blackpine-operator', 'ASK', 'x');
    const r5 = layer.sendMessage(null, null, null, null);
    const r6 = layer.sendMessage(42, {}, 'ASK', 'x');
    const logged = layer.getMessages();
    return ok(
      !r1.allowed && !r2.allowed && !r3.allowed && !r4.allowed && !r5.allowed && !r6.allowed &&
        logged.length === 6 && logged.every((e) => e.allowed === false),
      '6 attempts, 6 denials, 6 log entries',
    );
  });
}

{
  const reg = buildRegistry({
    operators: [
      {
        id: 'sender-down',
        name: 'Sender Down',
        environment: 'blackpine-field',
        mode: 'not-deployed',
        status: 'pending',
      },
      {
        id: 'receiver-up',
        name: 'Receiver Up',
        environment: 'blackpine-field',
        mode: 'read-only-advisory',
        status: 'deployed',
      },
    ],
  });
  const m = await fresh('j8', { operatorsFile: writeRegistry('ix-j8.json', reg) });
  const { layer } = freshLayer('j8', m);
  await check('J8 not-deployed operator can neither send nor receive', () => {
    const r1 = layer.sendMessage('sender-down', 'receiver-up', 'ASK', 'x');
    const r2 = layer.sendMessage('receiver-up', 'sender-down', 'ASK', 'x');
    return ok(!r1.allowed && !r2.allowed, 'send denied, receive denied');
  });
}

{
  const m = await fresh('j9');
  const { layer } = freshLayer('j9', m);
  await check('J9 every message is audit-logged (allowed and denied) with matching message id', () => {
    const r1 = layer.sendMessage('galileo-operator', 'finance-brother-operator', 'ASK', 'x');
    const r2 = layer.sendMessage('blackpine-operator', 'rivet-reach-operator', 'ASK', 'x');
    const audit = m.getAuditLog().filter((e) => e.type === 'interaction');
    const byId = new Map(audit.map((e) => [e.messageId, e]));
    const a1 = byId.get(r1.message.id);
    const a2 = byId.get(r2.message.id);
    return ok(
      r1.message.auditLogged === true &&
        r2.message.auditLogged === true &&
        audit.length === 2 &&
        a1 && a1.allowed === true &&
        a2 && a2.allowed === false,
      `audit entries: ${audit.length}, allowed + denied both present`,
    );
  });
}

{
  const m = await fresh('j10');
  const { layer } = freshLayer('j10', m);
  await check('J10 every entry flags the sender unverified (no auth yet — honest, not hidden)', () => {
    layer.sendMessage('galileo-operator', 'finance-brother-operator', 'NOTICE', 'x');
    const logged = layer.getMessages();
    return ok(
      logged.length === 1 &&
        logged[0].senderVerified === false &&
        typeof logged[0].senderNote === 'string' &&
        logged[0].senderNote.length > 0,
      logged[0].senderNote,
    );
  });
}

{
  const m = await fresh('j11');
  const { layer } = freshLayer('j11', m);
  await check('J11 payload safety: circular payload does not throw, oversized payload truncated to 4096', () => {
    const circular = { note: 'loop' };
    circular.self = circular;
    const r1 = layer.sendMessage('galileo-operator', 'finance-brother-operator', 'ASK', circular);
    const r2 = layer.sendMessage('galileo-operator', 'finance-brother-operator', 'ASK', 'x'.repeat(10000));
    return ok(
      r1.allowed === true &&
        typeof r1.message.payload === 'string' &&
        r1.message.payload.includes('[circular]') &&
        r2.allowed === true &&
        r2.message.payload.length === 4096,
      `circular -> ${r1.message.payload.length} chars; oversized -> ${r2.message.payload.length} chars`,
    );
  });
}

{
  const m = await fresh('j12');
  const { layer, file } = freshLayer('j12', m);
  await check('J12 persistence: seq resumes across instances, corrupt line skipped and counted', () => {
    layer.sendMessage('galileo-operator', 'finance-brother-operator', 'ASK', 'one');
    layer.sendMessage('galileo-operator', 'finance-brother-operator', 'ASK', 'two');
    fs.appendFileSync(file, 'this is not json\n');
    const layer2 = createInteractionLayer(m, { interactionsFile: file });
    const r3 = layer2.sendMessage('galileo-operator', 'finance-brother-operator', 'ASK', 'three');
    const stats = layer2.getInteractionStats();
    return ok(
      r3.message.seq === 3 &&
        layer2.getMessages().length === 3 &&
        stats.skippedLines === 1,
      `resumed at seq ${r3.message.seq}; skipped lines: ${stats.skippedLines}`,
    );
  });
}

{
  const m = await fresh('j13');
  const { layer } = freshLayer('j13', m);
  await check('J13 owner reads the whole log: allowed + denied; per-operator view filters', () => {
    layer.sendMessage('tailor-operator', 'blackpine-operator', 'HANDOFF', 'x');
    layer.sendMessage('blackpine-operator', 'rivet-reach-operator', 'ASK', 'x');
    layer.sendMessage('galileo-operator', 'finance-brother-operator', 'ASK', 'x');
    const all = layer.getMessages();
    const tailor = layer.getMessagesFor('tailor-operator');
    const newest = layer.getMessages(1);
    return ok(
      all.length === 3 &&
        all.filter((e) => e.allowed).length === 2 &&
        all.filter((e) => !e.allowed).length === 1 &&
        tailor.length === 1 &&
        tailor[0].from === 'tailor-operator' &&
        newest.length === 1 &&
        newest[0].seq === 3,
      '3 entries (2 allowed, 1 denied); tailor view has 1',
    );
  });
}

{
  await check('J14 interactions module: zero third-party deps, no eval/fetch/network', () => {
    const imports = [...INTERACTIONS_TEXT.matchAll(/^import\s+[\s\S]*?\s+from\s+['"]([^'"]+)['"]/gm)].map((x) => x[1]);
    const thirdParty = imports.filter((i) => !i.startsWith('node:'));
    const bad = ['eval(', 'new Function', 'fetch(', 'http.request', 'XMLHttpRequest'].filter((s) =>
      INTERACTIONS_TEXT.includes(s),
    );
    return ok(
      thirdParty.length === 0 && bad.length === 0,
      `imports: ${imports.join(', ') || '(none)'}; clean`,
    );
  });
}

{
  await check('J15 cross-environment owner approval and sender identity are claims until signed auth exists', () => {
    return finding(
      'ownerApproved/approvedBy is a recorded claim, not a verified signature (same limit as the Core owner guardrail); senderVerified is always false until signed-token auth lands in v1 Phase 4',
    );
  });
}

// ---------------------------------------------------------------------------
// K. Owner alert & notification system (notifications.mjs)
// ---------------------------------------------------------------------------
console.log('\n== K. Owner alert & notification system ==');

{
  const m = await fresh('k1');
  const { system } = freshNotificationSystem('k1', m);
  await check('K1 publish attempt by a draft-only operator is denied and creates a pending notification', () => {
    const r = m.authorize('tailor-operator', 'blackpine-field', 'publish');
    const pending = system.listPending();
    return ok(
      r.allowed === false &&
        pending.length === 1 &&
        pending[0].operatorId === 'tailor-operator' &&
        pending[0].action === 'publish' &&
        pending[0].status === 'pending',
      r.reason,
    );
  });
}

{
  const m = await fresh('k2');
  const { system } = freshNotificationSystem('k2', m);
  await check('K2 allowed actions (read, advise, write) create no notifications', () => {
    const r1 = m.authorize('tailor-operator', 'blackpine-field', 'read');
    const r2 = m.authorize('tailor-operator', 'blackpine-field', 'advise');
    const r3 = m.authorize('tailor-operator', 'blackpine-field', 'write');
    return ok(
      r1.allowed && r2.allowed && r3.allowed && system.listPending().length === 0,
      '3 allowed, 0 notifications — the inbox stays quiet',
    );
  });
}

{
  const m = await fresh('k3');
  const { system } = freshNotificationSystem('k3', m);
  await check('K3 denials for other reasons (unknown operator/action, environment separation, bad input) create no notifications', () => {
    const r1 = m.authorize('ghost-operator', 'blackpine-field', 'publish');
    const r2 = m.authorize('tailor-operator', 'blackpine-field', 'fly');
    const r3 = m.authorize('tailor-operator', 'rivet-reach', 'publish');
    const r4 = m.authorize(null, null, null);
    return ok(
      !r1.allowed && !r2.allowed && !r3.allowed && !r4.allowed && system.listPending().length === 0,
      '4 denials, 0 notifications — only approval-needed denials alert the owner',
    );
  });
}

{
  const m = await fresh('k4');
  const { system } = freshNotificationSystem('k4', m);
  await check('K4 decide() rejects operator deciders and arbitrary strings; only the owner decides', async () => {
    m.authorize('tailor-operator', 'blackpine-field', 'publish');
    const id = system.listPending()[0].id;
    const d1 = system.decide(id, 'tailor-operator', true);
    const d2 = system.decide(id, 'mallory', true);
    const d3 = system.decide(id, '', true);
    const d4 = system.decide(id, null, true);
    const still = system.getNotification(id);
    const d5 = system.decide(id, 'owner', true);
    // Misconfigured owner identity matching an operator ID: the operator
    // guard must still refuse — an operator can never decide, even its own.
    const m2 = await fresh('k4-misconfig', { ownerId: 'tailor-operator' });
    const { system: system2 } = freshNotificationSystem('k4-misconfig', m2);
    m2.authorize('tailor-operator', 'blackpine-field', 'publish');
    const id2 = system2.listPending()[0].id;
    const d6 = system2.decide(id2, 'tailor-operator', true);
    return ok(
      !d1.decided && !d2.decided && !d3.decided && !d4.decided &&
        still.status === 'pending' && d5.decided === true && d5.approved === true &&
        !d6.decided && system2.getNotification(id2).status === 'pending',
      'operator, stranger, empty, null all refused; owner approved; misconfigured owner-as-operator still refused',
    );
  });
}

{
  const m = await fresh('k5');
  const { system } = freshNotificationSystem('k5', m);
  await check('K5 every decision is audit-logged with the matching notification id', () => {
    m.authorize('tailor-operator', 'blackpine-field', 'publish');
    m.authorize('tailor-operator', 'blackpine-field', 'spend');
    const [n1, n2] = system.listPending();
    const d1 = system.decide(n1.id, 'owner', true, 'Go ahead.');
    const d2 = system.decide(n2.id, 'owner', false, 'Not yet.');
    const audit = m.getAuditLog().filter((e) => e.type === 'notification-decision');
    const byId = new Map(audit.map((e) => [e.notificationId, e]));
    const a1 = byId.get(n1.id);
    const a2 = byId.get(n2.id);
    return ok(
      d1.auditLogged === true && d2.auditLogged === true &&
        audit.length === 2 &&
        a1 && a1.allowed === true && a1.decision === 'approved' &&
        a2 && a2.allowed === false && a2.decision === 'denied',
      `audit entries: ${audit.length}, approved + denied both present`,
    );
  });
}

{
  const m = await fresh('k6');
  const { system } = freshNotificationSystem('k6', m);
  await check('K6 pending list excludes decided notifications; listAll keeps the whole history', () => {
    m.authorize('tailor-operator', 'blackpine-field', 'publish');
    m.authorize('tailor-operator', 'blackpine-field', 'spend');
    m.authorize('blackpine-operator', 'blackpine-field', 'publish');
    const [n1, n2, n3] = system.listPending();
    system.decide(n1.id, 'owner', true);
    system.decide(n2.id, 'owner', false);
    const pending = system.listPending();
    const all = system.listAll();
    const tailor = system.getNotificationsFor('tailor-operator');
    return ok(
      pending.length === 1 && pending[0].id === n3.id &&
        all.length === 3 &&
        all.filter((n) => n.status === 'approved').length === 1 &&
        all.filter((n) => n.status === 'denied').length === 1 &&
        all.filter((n) => n.status === 'pending').length === 1 &&
        tailor.length === 2,
      '1 pending, 1 approved, 1 denied; tailor view has 2',
    );
  });
}

{
  const m = await fresh('k7');
  const { system } = freshNotificationSystem('k7', m);
  await check('K7 double decision, unknown id, and non-boolean approve are rejected, no throw', () => {
    m.authorize('tailor-operator', 'blackpine-field', 'publish');
    const id = system.listPending()[0].id;
    const d1 = system.decide(id, 'owner', true);
    const d2 = system.decide(id, 'owner', false);
    const d3 = system.decide('notif-does-not-exist', 'owner', true);
    const d4 = system.decide(id, 'owner', 'yes');
    return ok(
      d1.decided === true && !d2.decided && !d3.decided && !d4.decided &&
        system.getNotification(id).status === 'approved',
      'first decision stands; later attempts refused',
    );
  });
}

{
  const m = await fresh('k8');
  const { system } = freshNotificationSystem('k8', m);
  await check('K8 approving a notification grants no permission: mode unchanged, publish still denied', () => {
    m.authorize('tailor-operator', 'blackpine-field', 'publish');
    const id = system.listPending()[0].id;
    const before = m.getOperator('tailor-operator').mode;
    const d = system.decide(id, 'owner', true);
    const after = m.getOperator('tailor-operator').mode;
    const retry = m.authorize('tailor-operator', 'blackpine-field', 'publish');
    return ok(
      d.decided === true && before === after &&
        retry.allowed === false &&
        system.getNotification(id).status === 'approved',
      `mode stayed '${after}'; re-attempt still denied (and it raised a second notification)`,
    );
  });
}

{
  const m = await fresh('k9');
  const { system, file } = freshNotificationSystem('k9', m);
  await check('K9 persistence: pending + decided state replays across instances, seq resumes, corrupt line skipped', () => {
    m.authorize('tailor-operator', 'blackpine-field', 'publish');
    m.authorize('tailor-operator', 'blackpine-field', 'spend');
    const [n1] = system.listPending();
    system.decide(n1.id, 'owner', true);
    fs.appendFileSync(file, 'this is not json\n');
    const system2 = createNotificationSystem(m, { notificationsFile: file });
    const all = system2.listAll();
    const stats = system2.getNotificationStats();
    const r = system2.createNotification('galileo-operator', 'publish', 'replay check', 'test');
    return ok(
      all.length === 2 &&
        all.filter((n) => n.status === 'approved').length === 1 &&
        all.filter((n) => n.status === 'pending').length === 1 &&
        stats.skippedLines === 1 &&
        r.created === true && r.notification.seq === 4,
      `replayed 2 (1 approved, 1 pending); next seq ${r.notification.seq}; skipped lines: ${stats.skippedLines}`,
    );
  });
}

{
  const m = await fresh('k10');
  const { system } = freshNotificationSystem('k10', m);
  await check('K10 a mode-change request creates a notification for the owner', () => {
    // Blackpine Operator ships in draft-only, so the request moves it to
    // read-only-advisory (requesting its current mode would be refused).
    const r = m.requestModeChange('blackpine-operator', 'read-only-advisory', 'blackpine-operator');
    const pending = system.listPending();
    return ok(
      r.recorded === true &&
        pending.length === 1 &&
        pending[0].operatorId === 'blackpine-operator' &&
        pending[0].action === 'mode-change' &&
        pending[0].reference.includes('read-only-advisory'),
      'mode-change request reached the inbox',
    );
  });
}

{
  const m = await fresh('k11');
  const { system } = freshNotificationSystem('k11', m);
  const { layer } = freshLayer('k11', m);
  await check('K11 a cross-environment message denial creates a notification for the owner', () => {
    const r = layer.sendMessage('blackpine-operator', 'rivet-reach-operator', 'ASK', 'hello?');
    const pending = system.listPending();
    return ok(
      r.allowed === false &&
        pending.length === 1 &&
        pending[0].operatorId === 'blackpine-operator' &&
        pending[0].action === 'message:cross-environment',
      'cross-env denial reached the inbox',
    );
  });
}

{
  await check('K12 notifications module: zero third-party deps, no eval/fetch/network', () => {
    const imports = [...NOTIFICATIONS_TEXT.matchAll(/^import\s+[\s\S]*?\s+from\s+['"]([^'"]+)['"]/gm)].map((x) => x[1]);
    const thirdParty = imports.filter((i) => !i.startsWith('node:'));
    const bad = ['eval(', 'new Function', 'fetch(', 'http.request', 'XMLHttpRequest'].filter((s) =>
      NOTIFICATIONS_TEXT.includes(s),
    );
    return ok(
      thirdParty.length === 0 && bad.length === 0,
      `imports: ${imports.join(', ') || '(none)'}; clean`,
    );
  });
}

{
  await check('K13 owner identity is a claim until an owner key is registered; a decision grants nothing', () => {
    return finding(
      'decide() trusts the configured owner identity (GALINYX_OWNER_ID, default \'owner\') until an owner key is registered — a claim, not a credential. v1.4.0 (Section L) adds signed owner approvals: once a key is registered, decide() and approveModeChange() require a valid owner signature. v1.5.0 adds the owner-key ceremony tooling (src/owner-key.mjs, tools/owner-key.mjs) — but no owner key is registered yet; generating one is Matt\'s step, in person. Approving a notification records a YES but grants no permission — execution still needs a mode change or the owner/Xena acting',
    );
  });
}

// ---------------------------------------------------------------------------
// L. Signed operator authentication (auth.mjs)
// ---------------------------------------------------------------------------
console.log('\n== L. Signed operator authentication ==');

// The auth module is imported cache-busted so each group gets a fresh
// instance; every instance reads the same temp key store (set at the top
// of this file), and verifyProof() re-reads the store on every call, so
// keys registered here are visible to fresh Core instances — the same
// way a production deployment shares one key store.
let authInstanceCounter = 0;
async function freshAuth(tag) {
  authInstanceCounter++;
  const url = `${AUTH_MODULE_URL}?instance=${tag}-${authInstanceCounter}-${Date.now()}`;
  return import(url);
}

// Wipe the temp auth store between groups. FAILS LOUDLY if the clear is
// refused (e.g. the store paths point at the live store): a silent
// refusal once let test keys leak into the live operator-keys.json and
// left a test owner key registered, which would have locked the owner
// out of approvals. Never again.
async function resetAuth(auth) {
  const r = await auth.clearAuthStoreForTests();
  if (!r.cleared) throw new Error(`auth store reset refused: ${r.reason}`);
}

// Issue + register a key for one operator subject; returns the keypair
// (public + private key, both in memory only — never written to disk by
// this suite except inside the temp key store's public-key records).
async function makeOperatorKey(auth, subject) {
  const g = auth.generateKeyPair(subject, `stress test ${subject}`);
  if (!g.ok) throw new Error(`keygen failed for ${subject}: ${g.reason}`);
  const r = auth.registerPublicKey({
    keyId: g.keyId,
    subject,
    subjectType: 'operator',
    publicKey: g.publicKey,
  });
  if (!r.registered) throw new Error(`register failed for ${subject}: ${r.reason}`);
  return g;
}

async function makeOwnerKey(auth) {
  const g = auth.generateKeyPair('owner', 'stress test owner');
  if (!g.ok) throw new Error(`owner keygen failed: ${g.reason}`);
  const r = auth.registerPublicKey({
    keyId: g.keyId,
    subject: 'owner',
    subjectType: 'owner',
    publicKey: g.publicKey,
  });
  if (!r.registered) throw new Error(`owner register failed: ${r.reason}`);
  return g;
}

function mustProof(auth, args) {
  const p = auth.createProof(args);
  if (!p.ok) throw new Error(`proof failed: ${p.reason}`);
  return p.proof;
}

{
  const auth = await freshAuth('l1');
  await resetAuth(auth);
  const key = await makeOperatorKey(auth, 'tailor-operator');
  const m = await fresh('l1');
  await check('L1 valid operator proof authenticates authorize()', () => {
    const proof = mustProof(auth, {
      subject: 'tailor-operator',
      action: 'write',
      privateKey: key.privateKey,
      keyId: key.keyId,
    });
    const r = m.authorize('tailor-operator', 'blackpine-field', 'write', proof);
    return ok(
      r.allowed === true && r.authenticated === true && r.authKeyId === key.keyId,
      `allowed + authenticated with ${key.keyId}`,
    );
  });
}

{
  const auth = await freshAuth('l2');
  await resetAuth(auth);
  const key = await makeOperatorKey(auth, 'tailor-operator');
  const m = await fresh('l2');
  await check('L2 forged signature is rejected and denies the action', () => {
    const proof = mustProof(auth, {
      subject: 'tailor-operator',
      action: 'write',
      privateKey: key.privateKey,
      keyId: key.keyId,
    });
    // Same shape, wrong signature: flip bytes in the signature.
    const sig = Buffer.from(proof.signature, 'base64');
    sig[0] ^= 0xff;
    const forged = { ...proof, signature: sig.toString('base64') };
    const r = m.authorize('tailor-operator', 'blackpine-field', 'write', forged);
    return ok(r.allowed === false && r.authenticated === false, r.reason);
  });
}

{
  const auth = await freshAuth('l3');
  await resetAuth(auth);
  await makeOperatorKey(auth, 'tailor-operator');
  const blackpine = await makeOperatorKey(auth, 'blackpine-operator');
  const m = await fresh('l3');
  await check("L3 another operator's key cannot prove this operator's identity", () => {
    // Blackpine signs a proof that claims to be the Tailor.
    const proof = mustProof(auth, {
      subject: 'tailor-operator',
      action: 'write',
      privateKey: blackpine.privateKey,
      keyId: blackpine.keyId,
    });
    const r = m.authorize('tailor-operator', 'blackpine-field', 'write', proof);
    return ok(r.allowed === false && r.authenticated === false, r.reason);
  });
}

{
  const auth = await freshAuth('l4');
  await resetAuth(auth);
  const key = await makeOperatorKey(auth, 'tailor-operator');
  const m = await fresh('l4');
  await check('L4 expired and far-future timestamps are rejected', () => {
    const old = mustProof(auth, {
      subject: 'tailor-operator',
      action: 'write',
      privateKey: key.privateKey,
      keyId: key.keyId,
      timestamp: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
    });
    const future = mustProof(auth, {
      subject: 'tailor-operator',
      action: 'write',
      privateKey: key.privateKey,
      keyId: key.keyId,
      timestamp: new Date(Date.now() + 6 * 60 * 1000).toISOString(),
    });
    const r1 = m.authorize('tailor-operator', 'blackpine-field', 'write', old);
    const r2 = m.authorize('tailor-operator', 'blackpine-field', 'write', future);
    return ok(
      r1.allowed === false && r1.authenticated === false && r2.allowed === false && r2.authenticated === false,
      '6 minutes old and 6 minutes ahead both denied',
    );
  });
}

{
  const auth = await freshAuth('l5');
  await resetAuth(auth);
  const key = await makeOperatorKey(auth, 'tailor-operator');
  const m = await fresh('l5');
  await check('L5 replayed proof is rejected (first use works, second does not)', () => {
    const proof = mustProof(auth, {
      subject: 'tailor-operator',
      action: 'write',
      privateKey: key.privateKey,
      keyId: key.keyId,
    });
    const r1 = m.authorize('tailor-operator', 'blackpine-field', 'write', proof);
    const r2 = m.authorize('tailor-operator', 'blackpine-field', 'write', proof);
    return ok(
      r1.allowed === true && r1.authenticated === true && r2.allowed === false && r2.authenticated === false,
      'same proof twice: first allowed, replay denied',
    );
  });
}

{
  const auth = await freshAuth('l6');
  await resetAuth(auth);
  const key = await makeOperatorKey(auth, 'tailor-operator');
  const m = await fresh('l6');
  await check('L6 revoked key verifies as invalid', () => {
    const before = mustProof(auth, {
      subject: 'tailor-operator',
      action: 'write',
      privateKey: key.privateKey,
      keyId: key.keyId,
    });
    const r1 = m.authorize('tailor-operator', 'blackpine-field', 'write', before);
    const revoked = auth.revokeKey(key.keyId, 'stress test: key compromised');
    // A FRESH proof with the revoked key must still fail — revocation is
    // checked at verify time, not only against old proofs.
    const after = mustProof(auth, {
      subject: 'tailor-operator',
      action: 'write',
      privateKey: key.privateKey,
      keyId: key.keyId,
    });
    const r2 = m.authorize('tailor-operator', 'blackpine-field', 'write', after);
    return ok(
      r1.allowed === true && revoked.revoked === true && r2.allowed === false && r2.authenticated === false,
      'worked before revocation, denied after',
    );
  });
}

{
  const auth = await freshAuth('l7');
  await resetAuth(auth);
  const oldKey = await makeOperatorKey(auth, 'tailor-operator');
  const m = await fresh('l7');
  await check('L7 rotation: old key stops working, new key works', () => {
    const replacement = auth.generateKeyPair('tailor-operator', 'stress test rotation');
    if (!replacement.ok) throw new Error(`rotation keygen failed: ${replacement.reason}`);
    const rotated = auth.rotateKey('tailor-operator', replacement.publicKey);
    const oldProof = mustProof(auth, {
      subject: 'tailor-operator',
      action: 'write',
      privateKey: oldKey.privateKey,
      keyId: oldKey.keyId,
    });
    const newProof = mustProof(auth, {
      subject: 'tailor-operator',
      action: 'write',
      privateKey: replacement.privateKey,
      keyId: rotated.newKeyId,
    });
    const rOld = m.authorize('tailor-operator', 'blackpine-field', 'write', oldProof);
    const rNew = m.authorize('tailor-operator', 'blackpine-field', 'write', newProof);
    return ok(
      rotated.rotated === true &&
        rOld.allowed === false &&
        rOld.authenticated === false &&
        rNew.allowed === true &&
        rNew.authenticated === true &&
        rNew.authKeyId === rotated.newKeyId,
      'old key denied, replacement key authenticated',
    );
  });
}

{
  const auth = await freshAuth('l8');
  await resetAuth(auth);
  const owner = await makeOwnerKey(auth);
  const m = await fresh('l8');
  await check('L8 owner approval requires a valid owner signature once an owner key is registered', () => {
    const req = m.requestModeChange('tailor-operator', 'read-only-advisory', 'stress test');
    if (!req.recorded) throw new Error(`request failed: ${req.reason}`);
    // No proof at all: refused, and the request stays pending.
    const noProof = m.approveModeChange('tailor-operator', req.request.id, 'owner', true);
    // A proof bound to a DIFFERENT request: refused, request still pending.
    const wrongProof = mustProof(auth, {
      subject: 'owner',
      action: 'mode-change',
      context: 'mode-change-someone-elses-request',
      privateKey: owner.privateKey,
      keyId: owner.keyId,
    });
    const wrong = m.approveModeChange('tailor-operator', req.request.id, 'owner', true, wrongProof);
    // The correctly-bound proof: applied, and the audit records it signed.
    const goodProof = mustProof(auth, {
      subject: 'owner',
      action: 'mode-change',
      context: req.request.id,
      privateKey: owner.privateKey,
      keyId: owner.keyId,
    });
    const good = m.approveModeChange('tailor-operator', req.request.id, 'owner', true, goodProof);
    const entry = m.getAuditLog().find((e) => e.type === 'mode-change-approved');
    return ok(
      noProof.applied === false &&
        wrong.applied === false &&
        good.applied === true &&
        m.getOperator('tailor-operator').mode === 'read-only-advisory' &&
        entry &&
        entry.authenticated === true &&
        entry.authKeyId === owner.keyId,
      'unsigned and mis-bound approvals refused; signed approval applied and audit-flagged',
    );
  });
}

{
  const auth = await freshAuth('l9');
  await resetAuth(auth);
  const m = await fresh('l9');
  await check('L9 with no owner key registered, the claim path still works (and is flagged unauthenticated)', () => {
    const req = m.requestModeChange('tailor-operator', 'read-only-advisory', 'stress test');
    if (!req.recorded) throw new Error(`request failed: ${req.reason}`);
    const ap = m.approveModeChange('tailor-operator', req.request.id, 'owner', true);
    const entry = m.getAuditLog().find((e) => e.type === 'mode-change-approved');
    return ok(
      ap.applied === true &&
        m.getOperator('tailor-operator').mode === 'read-only-advisory' &&
        entry &&
        entry.authenticated === false,
      'claim approval applied; audit entry flags authenticated: false',
    );
  });
}

{
  const auth = await freshAuth('l10');
  await resetAuth(auth);
  const key = await makeOperatorKey(auth, 'tailor-operator');
  const m = await fresh('l10');
  await check('L10 a proof is bound to its action: a read-proof cannot authorize write', () => {
    const proof = mustProof(auth, {
      subject: 'tailor-operator',
      action: 'read',
      privateKey: key.privateKey,
      keyId: key.keyId,
    });
    const r = m.authorize('tailor-operator', 'blackpine-field', 'write', proof);
    return ok(r.allowed === false && r.authenticated === false, r.reason);
  });
}

{
  const auth = await freshAuth('l11');
  await resetAuth(auth);
  const owner = await makeOwnerKey(auth);
  const m = await fresh('l11');
  await check('L11 an owner proof for one request cannot approve a different request', () => {
    const reqA = m.requestModeChange('tailor-operator', 'read-only-advisory', 'stress test');
    const reqB = m.requestModeChange('blackpine-operator', 'read-only-advisory', 'stress test');
    if (!reqA.recorded || !reqB.recorded) throw new Error('requests failed');
    const proofForA = mustProof(auth, {
      subject: 'owner',
      action: 'mode-change',
      context: reqA.request.id,
      privateKey: owner.privateKey,
      keyId: owner.keyId,
    });
    // Present A's proof against B's request: refused.
    const wrong = m.approveModeChange('blackpine-operator', reqB.request.id, 'owner', true, proofForA);
    // B's own proof still works afterwards — the refused attempt left B pending.
    const proofForB = mustProof(auth, {
      subject: 'owner',
      action: 'mode-change',
      context: reqB.request.id,
      privateKey: owner.privateKey,
      keyId: owner.keyId,
    });
    const good = m.approveModeChange('blackpine-operator', reqB.request.id, 'owner', true, proofForB);
    return ok(
      wrong.applied === false &&
        good.applied === true &&
        m.getOperator('blackpine-operator').mode === 'read-only-advisory' &&
        m.getOperator('tailor-operator').mode === 'draft-only',
      "A's proof refused for B; B's own proof applied; A untouched",
    );
  });
}

{
  const auth = await freshAuth('l12');
  await resetAuth(auth);
  const owner = await makeOwnerKey(auth);
  const m = await fresh('l12');
  const { system } = freshNotificationSystem('l12', m);
  await check('L12 notification decide() requires a signed owner approval once an owner key is registered', () => {
    m.authorize('tailor-operator', 'blackpine-field', 'publish');
    const pending = system.listPending();
    if (pending.length !== 1) throw new Error(`expected 1 pending notification, got ${pending.length}`);
    const id = pending[0].id;
    // No proof: refused, notification stays pending.
    const noProof = system.decide(id, 'owner', true, 'go ahead');
    // A proof bound to a different notification: refused.
    const wrongProof = mustProof(auth, {
      subject: 'owner',
      action: 'notification-decision',
      context: 'notif-someone-elses',
      privateKey: owner.privateKey,
      keyId: owner.keyId,
    });
    const wrong = system.decide(id, 'owner', true, 'go ahead', wrongProof);
    // The correctly-bound proof: decided, flagged authenticated.
    const goodProof = mustProof(auth, {
      subject: 'owner',
      action: 'notification-decision',
      context: id,
      privateKey: owner.privateKey,
      keyId: owner.keyId,
    });
    const good = system.decide(id, 'owner', true, 'go ahead', goodProof);
    return ok(
      noProof.decided === false &&
        wrong.decided === false &&
        good.decided === true &&
        good.authenticated === true &&
        good.authKeyId === owner.keyId &&
        system.listPending().length === 0,
      'unsigned and mis-bound decisions refused; signed decision applied',
    );
  });
}

{
  await check('L13 auth module: zero third-party deps, no eval/fetch/network', () => {
    const imports = [...AUTH_TEXT.matchAll(/^import\s+[\s\S]*?\s+from\s+['"]([^'"]+)['"]/gm)].map((x) => x[1]);
    const thirdParty = imports.filter(
      (i) => !i.startsWith('node:') && !i.startsWith('./') && !i.startsWith('../'),
    );
    const bad = ['eval(', 'new Function', 'fetch(', 'http.request', 'XMLHttpRequest'].filter((s) =>
      AUTH_TEXT.includes(s),
    );
    return ok(
      thirdParty.length === 0 && bad.length === 0,
      `imports: ${imports.join(', ') || '(none)'}; clean`,
    );
  });
}

{
  const auth = await freshAuth('l14');
  await resetAuth(auth);
  const key = await makeOperatorKey(auth, 'tailor-operator');
  const m = await fresh('l14');
  await check('L14 authentication is NOT permission: a valid signature still cannot publish', () => {
    const proof = mustProof(auth, {
      subject: 'tailor-operator',
      action: 'publish',
      privateKey: key.privateKey,
      keyId: key.keyId,
    });
    const r = m.authorize('tailor-operator', 'blackpine-field', 'publish', proof);
    return ok(
      r.allowed === false && r.authenticated === true,
      'identity proven, action still denied by draft-only mode',
    );
  });
}

// ---------------------------------------------------------------------------
// M. Hierarchy gaps closed (v1.5.0): operator registration, hash-chained
// audit log, shared state, owner-key ceremony, seq allocator.
// ---------------------------------------------------------------------------
console.log('\n== M. Hierarchy gaps closed (v1.5.0) ==');

// The M checks need a registry that includes a draft-only mode (the
// default buildRegistry() does not). One shared builder for all M
// registry files.
function buildRegistryWithDraftOnly() {
  return buildRegistry({
    modes: {
      'read-only-advisory': {
        label: 'RO',
        description: 'Observe and advise only.',
        permissions: { read: true, advise: true, write: false, publish: false, spend: false },
      },
      'draft-only': {
        label: 'Draft-Only',
        description: 'Drafts freely; publishes and spends nothing.',
        permissions: { read: true, advise: true, write: true, publish: false, spend: false },
      },
      'not-deployed': {
        label: 'ND',
        description: 'No access at all.',
        permissions: { read: false, advise: false, write: false, publish: false, spend: false },
      },
    },
  });
}

{
  const regFile = writeRegistry('operators-m1.json', buildRegistryWithDraftOnly());
  const m = await fresh('m1', { operatorsFile: regFile });
  await check('M1 registerOperator() registers a draft-only operator through the Core', () => {
    const r = m.registerOperator(
      { id: 'test-operator', name: 'Test Operator', environment: 'blackpine-field' },
      'owner',
    );
    const onDisk = JSON.parse(fs.readFileSync(regFile, 'utf8'));
    const inFile = onDisk.operators.find((o) => o.id === 'test-operator');
    const entry = m.getAuditLog().find((e) => e.type === 'operator-registration');
    return ok(
      r.registered === true &&
        r.operator.mode === 'draft-only' &&
        m.getOperator('test-operator') !== null &&
        m.getOperator('test-operator').mode === 'draft-only' &&
        inFile !== undefined &&
        inFile.mode === 'draft-only' &&
        entry !== undefined &&
        entry.allowed === true,
      'registered in memory + file, draft-only, audit-logged',
    );
  });
}

{
  const regFile = writeRegistry('operators-m2.json', buildRegistryWithDraftOnly());
  const m = await fresh('m2', { operatorsFile: regFile });
  await check('M2 registerOperator() refuses a non-owner approver', () => {
    const r = m.registerOperator(
      { id: 'intruder-operator', name: 'Intruder', environment: 'blackpine-field' },
      'someone-else',
    );
    const onDisk = JSON.parse(fs.readFileSync(regFile, 'utf8'));
    return ok(
      r.registered === false &&
        m.getOperator('intruder-operator') === null &&
        !onDisk.operators.some((o) => o.id === 'intruder-operator'),
      r.reason,
    );
  });
}

{
  const regFile = writeRegistry('operators-m3.json', buildRegistryWithDraftOnly());
  const m = await fresh('m3', { operatorsFile: regFile });
  await check('M3 registerOperator() validates: duplicate, unknown environment, bad id, empty name', () => {
    const dup = m.registerOperator(
      { id: 'blackpine-operator', name: 'Copy', environment: 'blackpine-field' },
      'owner',
    );
    const badEnv = m.registerOperator(
      { id: 'new-op', name: 'New', environment: 'no-such-place' },
      'owner',
    );
    const badId = m.registerOperator(
      { id: '__proto__', name: 'Bad', environment: 'blackpine-field' },
      'owner',
    );
    const badName = m.registerOperator(
      { id: 'new-op-2', name: '  ', environment: 'blackpine-field' },
      'owner',
    );
    return ok(
      dup.registered === false &&
        badEnv.registered === false &&
        badId.registered === false &&
        badName.registered === false &&
        m.getOperator('new-op') === null &&
        m.getOperator('new-op-2') === null,
      'all four refused',
    );
  });
}

{
  const auditFile = path.join(TMP, 'audit-m4.jsonl');
  const m = await fresh('m4', { auditFile });
  await check('M4 hash chain: a fresh log verifies; a tampered entry is detected', () => {
    m.authorize('blackpine-operator', 'blackpine-field', 'read');
    m.authorize('blackpine-operator', 'blackpine-field', 'publish');
    const before = auditChain.verifyAuditFile(auditFile);
    // Tamper: rewrite the first entry's reason.
    const lines = fs.readFileSync(auditFile, 'utf8').split('\n');
    const e0 = JSON.parse(lines[0]);
    e0.reason = 'TAMPERED';
    lines[0] = JSON.stringify(e0);
    fs.writeFileSync(auditFile, lines.join('\n'));
    const after = auditChain.verifyAuditFile(auditFile);
    return ok(
      before.ok === true &&
        before.chained === 2 &&
        after.ok === false &&
        after.errors.length > 0,
      `clean log verified (${before.chained} chained); tampered log failed: ${after.errors[0] || ''}`,
    );
  });
}

{
  const auditFile = path.join(TMP, 'audit-m5.jsonl');
  // Simulate the pre-chain log: two legacy lines (no chain fields),
  // one shaped like the owner entries (a `ts` field, no `timestamp`).
  const legacy = [
    JSON.stringify({
      type: 'owner-direction',
      ts: '2026-11-19T13:25:44.000Z',
      operator: 'tailor-operator',
      action: 'record-direction',
      decision: 'RECORDED',
      detail: 'legacy',
      seq: 52,
      coreVersion: '1.4.0',
    }),
    JSON.stringify({
      type: 'authorization',
      timestamp: '2026-11-19T13:44:02.000Z',
      operatorId: 'tailor-operator',
      environment: 'blackpine-field',
      action: 'read',
      allowed: true,
      reason: 'legacy',
      seq: 53,
      coreVersion: '1.4.0',
    }),
  ];
  fs.writeFileSync(auditFile, `${legacy.join('\n')}\n`);
  const genesisPath = path.join(TMP, 'audit-m5-genesis.json');
  const g = auditChain.createGenesis(auditFile);
  auditChain.writeGenesis(g.genesis, genesisPath);
  const m = await fresh('m5', { auditFile });
  await check('M5 genesis: legacy pre-chain lines verify, and new entries chain from the tail', () => {
    m.authorize('blackpine-operator', 'blackpine-field', 'read'); // line 3, seq 54
    // External append (another writer, no chain fields) — like Xena's entries.
    fs.appendFileSync(
      auditFile,
      `${JSON.stringify({
        type: 'owner-note',
        ts: new Date().toISOString(),
        operator: 'tailor-operator',
        action: 'record-note',
        decision: 'RECORDED',
        detail: 'external',
        seq: 55,
        coreVersion: '1.5.0',
      })}\n`,
    );
    m.authorize('blackpine-operator', 'blackpine-field', 'write'); // line 5, seq 56
    const report = auditChain.verifyAuditFile(auditFile, genesisPath);
    const last = m.getAuditLog().at(-1);
    return ok(
      report.ok === true &&
        report.genesis.ok === true &&
        report.chained === 2 &&
        report.unchained.length === 1 &&
        report.unchained[0] === 4 &&
        last.seq === 56,
      `genesis OK, ${report.chained} chained, ${report.unchained.length} unchained (line ${report.unchained[0]}), last seq ${last.seq}`,
    );
  });
}

{
  const sharedRegistry = path.join(TMP, 'operators-m6-shared.json');
  fs.copyFileSync(new URL('./operators.json', import.meta.url), sharedRegistry);
  const m1 = await fresh('m6a', { operatorsFile: sharedRegistry });
  const m2 = await fresh('m6b', { operatorsFile: sharedRegistry });
  await check('M6 shared state: a mode change in one instance is visible to another after syncState()', () => {
    const req = m1.requestModeChange('blackpine-operator', 'not-deployed', 'm6');
    const ap = m1.approveModeChange('blackpine-operator', req.request.id, 'owner');
    const before = m2.getOperator('blackpine-operator').mode;
    const sync = m2.syncState();
    const after = m2.getOperator('blackpine-operator').mode;
    const onDisk = JSON.parse(fs.readFileSync(sharedRegistry, 'utf8'));
    const diskMode = onDisk.operators.find((o) => o.id === 'blackpine-operator').mode;
    return ok(
      ap.applied === true &&
        diskMode === 'not-deployed' &&
        before === 'draft-only' &&
        sync.synced === true &&
        after === 'not-deployed',
      `disk: ${diskMode}; B before sync: ${before}; after: ${after}`,
    );
  });
}

{
  await check('M7 state store: a save with a stale revision is refused (optimistic concurrency)', () => {
    const file = path.join(TMP, 'store-m7.json');
    const store = createStateStore({ file });
    const first = store.save({ a: 1 });
    const stale = store.save({ a: 2 }, 0); // revision moved to 1; 0 is stale
    const current = store.load();
    return ok(
      first.ok === true &&
        first.revision === 1 &&
        stale.ok === false &&
        stale.conflict === true &&
        current.data.a === 1,
      'stale write refused, data untouched',
    );
  });
}

{
  const auth = await freshAuth('m8');
  await resetAuth(auth);
  const ownerKey = await import('./owner-key.mjs?instance=m8');
  const m = await fresh('m8');
  await check('M8 owner-key ceremony (test key, temp store): generate -> registered -> unsigned refused -> signed works', () => {
    const unconfirmed = ownerKey.generateOwnerKey({ confirmed: false });
    const gen = ownerKey.generateOwnerKey({ confirmed: true, label: 'stress test owner key' });
    if (!gen.generated) throw new Error(`generate failed: ${gen.reason}`);
    const status = ownerKey.ownerKeyStatus();
    const backup = ownerKey.verifyOwnerKeyBackup({ file: gen.privateKeyPath });
    const req = m.requestModeChange('tailor-operator', 'read-only-advisory', 'm8');
    if (!req.recorded) throw new Error(`request failed: ${req.reason}`);
    const noProof = m.approveModeChange('tailor-operator', req.request.id, 'owner', true);
    const loaded = auth.loadPrivateKey(gen.keyId);
    if (!loaded.ok) throw new Error(`load private key failed: ${loaded.reason}`);
    const proof = mustProof(auth, {
      subject: 'owner',
      action: 'mode-change',
      context: req.request.id,
      privateKey: loaded.privateKey,
      keyId: gen.keyId,
    });
    const signed = m.approveModeChange('tailor-operator', req.request.id, 'owner', true, proof);
    return ok(
      unconfirmed.generated === false &&
        status.registered === true &&
        status.keyId === gen.keyId &&
        backup.ok === true &&
        backup.matches === true &&
        noProof.applied === false &&
        signed.applied === true &&
        m.getOperator('tailor-operator').mode === 'read-only-advisory',
      'unconfirmed refused; key registered; backup verified; unsigned refused; signed applied',
    );
  });
}

{
  const auth = await freshAuth('m9');
  await resetAuth(auth);
  const ownerKey = await import('./owner-key.mjs?instance=m9');
  const m = await fresh('m9');
  await check('M9 owner-key rotation (test key, temp store): old key stops, new key works', () => {
    const gen = ownerKey.generateOwnerKey({ confirmed: true, label: 'stress test owner key 1' });
    if (!gen.generated) throw new Error(`generate failed: ${gen.reason}`);
    const oldKeyId = gen.keyId;
    const rot = ownerKey.rotateOwnerKey({ confirmed: true, label: 'stress test owner key 2' });
    if (!rot.rotated) throw new Error(`rotate failed: ${rot.reason}`);
    const oldLoaded = auth.loadPrivateKey(oldKeyId);
    const newLoaded = auth.loadPrivateKey(rot.newKeyId);
    if (!newLoaded.ok) throw new Error(`new key load failed: ${newLoaded.reason}`);
    const req = m.requestModeChange('tailor-operator', 'read-only-advisory', 'm9');
    if (!req.recorded) throw new Error(`request failed: ${req.reason}`);
    let oldApplied = false;
    if (oldLoaded.ok) {
      const oldProof = mustProof(auth, {
        subject: 'owner',
        action: 'mode-change',
        context: req.request.id,
        privateKey: oldLoaded.privateKey,
        keyId: oldKeyId,
      });
      oldApplied = m.approveModeChange('tailor-operator', req.request.id, 'owner', true, oldProof).applied;
    }
    const newProof = mustProof(auth, {
      subject: 'owner',
      action: 'mode-change',
      context: req.request.id,
      privateKey: newLoaded.privateKey,
      keyId: rot.newKeyId,
    });
    const newApplied = m.approveModeChange('tailor-operator', req.request.id, 'owner', true, newProof).applied;
    return ok(
      rot.newKeyId !== oldKeyId &&
        oldApplied === false &&
        newApplied === true &&
        m.getOperator('tailor-operator').mode === 'read-only-advisory',
      'old key refused after rotation; new key applied',
    );
  });
}

{
  const m = await fresh('m10');
  await check("M10 authorize() denial reason names the operator's actual mode", () => {
    const r = m.authorize('tailor-operator', 'blackpine-field', 'publish');
    return ok(
      r.allowed === false &&
        r.reason.includes('Draft-Only') &&
        !r.reason.includes('Read-only advisory mode allows') &&
        r.reason.includes('read, advise, write'),
      r.reason,
    );
  });
}

{
  await check('M11 new modules (audit-chain, state-store, owner-key): zero third-party deps, no eval/fetch/network', () => {
    const texts = [AUDIT_CHAIN_TEXT, STATE_STORE_TEXT, OWNER_KEY_TEXT];
    const bad = ['eval(', 'new Function', 'fetch(', 'http.request', 'XMLHttpRequest'];
    const found = [];
    for (const t of texts) {
      const imports = [...t.matchAll(/^import\s+[\s\S]*?\s+from\s+['"]([^'"]+)['"]/gm)].map((x) => x[1]);
      const thirdParty = imports.filter(
        (i) => !i.startsWith('node:') && !i.startsWith('./') && !i.startsWith('../'),
      );
      found.push(...thirdParty);
      found.push(...bad.filter((s) => t.includes(s)));
    }
    return ok(found.length === 0, found.length ? `found: ${found.join(', ')}` : 'clean');
  });
}

{
  const auditFile = path.join(TMP, 'audit-m12.jsonl');
  // A log where the highest seq sits on a `ts`-shaped entry (no
  // `timestamp`) — the shape that fooled the old allocator into
  // restarting at 51 (live log, 2026-11-19).
  const lines = [
    JSON.stringify({
      type: 'authorization',
      timestamp: '2026-11-19T13:00:00.000Z',
      operatorId: 'tailor-operator',
      environment: 'blackpine-field',
      action: 'read',
      allowed: true,
      reason: 'x',
      seq: 50,
      coreVersion: '1.4.0',
    }),
    JSON.stringify({
      type: 'owner-order',
      ts: '2026-11-19T13:43:41.000Z',
      operator: 'tailor-operator',
      action: 'grant',
      decision: 'GRANTED',
      detail: 'x',
      seq: 60,
      coreVersion: '1.4.0',
    }),
  ];
  fs.writeFileSync(auditFile, `${lines.join('\n')}\n`);
  const m = await fresh('m12', { auditFile });
  await check("M12 seq allocator continues from the file's max seq, even when the top entry has no timestamp field", () => {
    m.authorize('blackpine-operator', 'blackpine-field', 'read');
    const entry = m.getAuditLog().find(
      (e) => e.type === 'authorization' && e.operatorId === 'blackpine-operator',
    );
    return ok(entry !== undefined && entry.seq === 61, `next seq: ${entry ? entry.seq : 'none'} (must be 61, not 51)`);
  });
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log('\n================================');
console.log(`Stress test complete: ${passCount} PASS, ${failCount} FAIL, ${findingCount} FINDING`);
if (failures.length) {
  console.log('\nFailed checks:');
  for (const f of failures) console.log(`  - ${f}`);
}

try {
  fs.rmSync(TMP, { recursive: true, force: true });
} catch {
  /* temp cleanup is best-effort */
}
process.exitCode = failCount > 0 ? 1 : 0;
