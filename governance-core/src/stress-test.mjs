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
 * Checks use fresh module instances (cache-busted imports) so each group
 * starts from a clean registry and audit log. Temp files go under an mkdtemp
 * directory and are removed at the end. Nothing in this test writes to the
 * working copy: every instance gets its own temp audit file.
 *
 * Exit code: 1 if any check FAILED, else 0.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createInteractionLayer } from './interactions.mjs';
import { createNotificationSystem } from './notifications.mjs';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'galinyx-stress-'));
const MODULE_URL = new URL('./index.mjs', import.meta.url).href;
const SRC_TEXT = fs.readFileSync(new URL('./index.mjs', import.meta.url), 'utf8');
const INTERACTIONS_TEXT = fs.readFileSync(new URL('./interactions.mjs', import.meta.url), 'utf8');
const NOTIFICATIONS_TEXT = fs.readFileSync(new URL('./notifications.mjs', import.meta.url), 'utf8');
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
  else delete process.env.GALINYX_OPERATORS_FILE;
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
  await check('F3 there is no public API to register an operator', () => {
    const hasApi = typeof m.registerOperator === 'function';
    return finding(
      hasApi
        ? 'registerOperator() exists'
        : 'no registerOperator() — operators are added by editing the registry and restarting (original code: by editing source or mutating the export)',
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
  const m1 = await fresh('h2a');
  const m2 = await fresh('h2b');
  await check('H2 two live instances diverge (state is per-process)', () => {
    const req = m1.requestModeChange('blackpine-operator', 'not-deployed', 'a');
    m1.approveModeChange('blackpine-operator', req.request.id, 'owner');
    const mode1 = m1.getOperator('blackpine-operator').mode;
    const mode2 = m2.getOperator('blackpine-operator').mode;
    return finding(
      `instance A mode: ${mode1}; instance B mode: ${mode2} — each process holds its own registry state; there is no shared state or sync`,
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
  await check('I1 zero third-party dependencies (only node: built-ins)', () => {
    const imports = [...SRC_TEXT.matchAll(/^import\s+.*?\s+from\s+['"]([^'"]+)['"]/gm)].map((x) => x[1]);
    const thirdParty = imports.filter((i) => !i.startsWith('node:'));
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
    const imports = [...INTERACTIONS_TEXT.matchAll(/^import\s+.*?\s+from\s+['"]([^'"]+)['"]/gm)].map((x) => x[1]);
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
    const imports = [...NOTIFICATIONS_TEXT.matchAll(/^import\s+.*?\s+from\s+['"]([^'"]+)['"]/gm)].map((x) => x[1]);
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
  await check('K13 owner identity is a claim until signed auth; a decision grants nothing', () => {
    return finding(
      'decide() trusts the configured owner identity (GALINYX_OWNER_ID, default \'owner\'), the same guardrail as approveModeChange — a claim, not a credential, until signed owner approvals land in v1 Phase 4; approving a notification records a YES but grants no permission — execution still needs a mode change or the owner/Xena acting',
    );
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
