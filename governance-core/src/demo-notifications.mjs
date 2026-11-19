/**
 * GALINYX Governance Core — owner alert & notification demo
 * Run: node governance-core/src/demo-notifications.mjs
 *
 * Demonstrates, with real calls into the Core and the notification system:
 *   1. The Tailor attempts a publish -> DENIED by the Core (draft-only) and
 *      a notification lands in the owner's inbox.
 *   2. The owner APPROVES it -> decision recorded in notifications.jsonl
 *      and audit-logged. Approving grants no permission: the Tailor's mode
 *      is unchanged and a re-attempt is still denied.
 *   3. The Tailor attempts a spend -> DENIED + notification, and the owner
 *      DENIES it -> decision recorded and audit-logged.
 * Then prints the append-only notification log and the matching Core audit
 * entries. Every decision lands in both logs.
 *
 * NOTE: this demo writes to the real logs (notifications.jsonl and
 * audit-log.jsonl), like demo.mjs and demo-interactions.mjs do. The two
 * requests and both decisions are real records.
 */

import * as core from './index.mjs';
import { createNotificationSystem } from './notifications.mjs';

const system = createNotificationSystem(core);

function showAttempt(title, result) {
  const verdict = result.allowed ? 'ALLOWED' : 'DENIED';
  console.log(`\n--- ${title} ---`);
  console.log(`[${verdict}] ${result.reason}`);
}

function showNotification(n) {
  console.log(`notification: ${n.id} | seq: ${n.seq}`);
  console.log(`  ${n.operatorName} (${n.operatorId}) wants to '${n.action}' in ${n.environment}`);
  console.log(`  what: ${n.reference}`);
  console.log(`  status: ${n.status} | asked: ${n.timestamp}`);
}

function showDecision(title, result) {
  console.log(`\n--- ${title} ---`);
  console.log(
    result.decided
      ? `[DECIDED: ${result.approved ? 'APPROVED' : 'DENIED'}] ${result.reason}`
      : `[REFUSED] ${result.reason}`,
  );
  console.log(`audit-logged: ${result.auditLogged}`);
}

console.log('GALINYX Governance Core — owner alert & notification demo');
console.log('==========================================================');
console.log('\nRegistered operators:');
for (const op of core.listOperators()) {
  console.log(`  - ${op.name} | environment: ${op.environment} | mode: ${op.mode} | status: ${op.status}`);
}
console.log(`\nInbox at start: ${system.listPending().length} pending notification(s).`);

// 1. The Tailor attempts a publish. Draft-only: the Core denies it, and the
// denial creates a notification — the owner is told.
showAttempt(
  'The Tailor attempts to publish the 1f/1g back-print tee listing',
  core.authorize('tailor-operator', 'blackpine-field', 'publish'),
);
const [publishNotif] = system.listPending();
showNotification(publishNotif);

// 2. The owner approves it. The decision is recorded and audit-logged —
// but it grants no permission: the Tailor stays draft-only.
showDecision(
  'The owner APPROVES the publish request',
  system.decide(publishNotif.id, 'owner', true, 'Go ahead — list the tee.'),
);
console.log(`mode after approval: ${core.getOperator('tailor-operator').mode} (unchanged)`);
showAttempt(
  'The Tailor re-attempts the publish (approval is not a grant)',
  core.authorize('tailor-operator', 'blackpine-field', 'publish'),
);
console.log('(The re-attempt raised a second notification — it is still pending below.)');

// 3. The Tailor attempts a spend. Denied + notification; the owner denies it.
showAttempt(
  'The Tailor attempts to spend (order 50 blank tees)',
  core.authorize('tailor-operator', 'blackpine-field', 'spend'),
);
const spendNotif = system
  .listPending()
  .find((n) => n.action === 'spend');
showNotification(spendNotif);
showDecision(
  'The owner DENIES the spend request',
  system.decide(spendNotif.id, 'owner', false, 'Not yet — no sales channel connected. Hold the order.'),
);

// 4. The notification log: every request and every decision, append-only.
console.log('\n--- Notification log (append-only) ---');
for (const n of system.listAll()) {
  const decision = n.status === 'pending'
    ? 'awaiting owner'
    : `${n.status} by ${n.decidedBy} at ${n.decidedAt}`;
  console.log(
    `${n.timestamp} | #${n.seq} | ${n.operatorName} wants '${n.action}' | ${n.status} | ${decision}`,
  );
}

// 5. The matching Core audit entries: every decision is audit-logged.
console.log('\n--- Core audit log: notification-decision entries ---');
for (const e of core.getAuditLog().filter((x) => x.type === 'notification-decision')) {
  console.log(
    `${e.timestamp} | ${e.operatorId} | ${e.action} | ${e.allowed ? 'APPROVED' : 'DENIED'} | ${e.notificationId} | decided by ${e.decidedBy}`,
  );
}

const stats = system.getNotificationStats();
console.log(`\nInbox now: ${stats.pendingCount} pending, ${stats.decidedCount} decided.`);
console.log('Demo complete. When a worker wants something, the owner hears about it — and answers.');
