/**
 * GALINYX Governance Core — operator interaction demo
 * Run: node governance-core/src/demo-interactions.mjs
 *
 * Demonstrates, with real calls into the interaction layer:
 *   1. HANDOFF: The Tailor -> Blackpine Operator (a finished BLACKPINE
 *      product draft handed over for the store listing draft) -> ALLOWED
 *   2. ASK: Galileo -> Finance Brother (a cost check on a build) -> ALLOWED
 *   3. ASK across environments without owner approval -> DENIED
 * Then prints the append-only interaction log and the matching Core audit
 * entries. Every message lands in both logs.
 *
 * NOTE: this demo writes to the real logs (interactions.jsonl and
 * audit-log.jsonl), like demo.mjs does. The two proofs are real messages.
 */

import * as core from './index.mjs';
import { INTERACTION_KINDS, createInteractionLayer } from './interactions.mjs';

const layer = createInteractionLayer(core);

function show(title, result) {
  const verdict = result.allowed ? 'ALLOWED' : 'DENIED';
  console.log(`\n--- ${title} ---`);
  console.log(`[${verdict}] ${result.reason}`);
  console.log(`message id: ${result.message.id} | seq: ${result.message.seq}`);
  console.log(`grants permission: ${result.message.grantsPermission} | sender verified: ${result.message.senderVerified} | audit-logged: ${result.message.auditLogged}`);
}

console.log('GALINYX Governance Core — operator interaction demo');
console.log('====================================================');
console.log('\nRegistered operators:');
for (const op of core.listOperators()) {
  console.log(`  - ${op.name} | environment: ${op.environment} | mode: ${op.mode} | status: ${op.status}`);
}
console.log(`\nMessage kinds the layer knows: ${INTERACTION_KINDS.join(', ')}`);

// 1. Proof one: the Tailor hands a finished product draft to the Blackpine
// Operator for the store listing draft. Same environment (blackpine-field),
// so no owner approval is needed — and the handoff grants no permission.
show(
  'HANDOFF: The Tailor -> Blackpine Operator (product draft for the store listing)',
  layer.sendMessage(
    'tailor-operator',
    'blackpine-operator',
    'HANDOFF',
    'BLACKPINE back-print tee — geometric faceted pine, white + black colorways (1f/1g, locked Nov 18). Artwork ready: 3600x4800 print files, front + back. Blank: Gildan 5000, $9.55 US provider price. Draft the store listing (name, price, description) and hold it in staging — nothing goes live without the owner\'s approval.',
  ),
);

// 2. Proof two: Galileo asks the Finance Brother for a cost check before
// proposing a build. Same environment (galinyx-workforce).
show(
  'ASK: Galileo Ferraris -> Finance Brother (cost check on the camel-tee run)',
  layer.sendMessage(
    'galileo-operator',
    'finance-brother-operator',
    'ASK',
    'Cost check before I propose the camel-tee run: Gildan 5000 blank $9.55 US provider price, back print 12x16. What is the true per-unit cost with print + shipping, and what margin at a $34.99 list price? Reply with the numbers — I will not propose the run until the margin is real.',
  ),
);

// 3. Cross-environment without owner approval -> denied.
show(
  'ASK: Blackpine Operator -> Rivet Reach Operator (no owner approval)',
  layer.sendMessage(
    'blackpine-operator',
    'rivet-reach-operator',
    'ASK',
    'Do any of your contractors sell workwear we could stock?',
  ),
);

// 4. The interaction log: every message above, append-only.
console.log('\n--- Interaction log (append-only) ---');
for (const m of layer.getMessages()) {
  console.log(
    `${m.timestamp} | #${m.seq} | ${m.fromName} -> ${m.toName} | ${m.kind} | ${m.allowed ? 'ALLOWED' : 'DENIED'} | grantsPermission: ${m.grantsPermission}`,
  );
}

// 5. The matching Core audit entries: every message decision is audit-logged.
console.log('\n--- Core audit log: interaction entries ---');
for (const e of core.getAuditLog().filter((x) => x.type === 'interaction')) {
  console.log(
    `${e.timestamp} | ${e.operatorId} -> ${e.toOperatorId} | ${e.action} | ${e.allowed ? 'ALLOWED' : 'DENIED'} | ${e.messageId}`,
  );
}

console.log('\nDemo complete. Operators can now ask, hand off, and notify — under the Core, in the open, with every message on the record.');
