/**
 * GALINYX Governance Core — demo
 * Run: node governance-core/src/demo.mjs
 *
 * Demonstrates, with real calls into the core:
 *   1. A READ by the Blackpine Operator in its own environment -> ALLOWED
 *   2. A PUBLISH by the Blackpine Operator -> DENIED (read-only advisory mode)
 *   3. A READ by the Blackpine Operator in the Rivet Reach environment -> DENIED
 *      (environment separation)
 *   4. A mode-change request -> recorded PENDING, never self-approved
 * Then prints the append-only audit log.
 */

import {
  ACTIONS,
  authorize,
  getAllModeChangeRequests,
  getAuditLog,
  getPendingModeChanges,
  listOperators,
  requestModeChange,
} from './index.mjs';

function show(title, result) {
  const verdict = result.allowed ? 'ALLOWED' : 'DENIED';
  console.log(`\n--- ${title} ---`);
  console.log(`[${verdict}] ${result.reason}`);
}

console.log('GALINYX Governance Core — demo');
console.log('================================');
console.log('\nRegistered operators:');
for (const op of listOperators()) {
  console.log(`  - ${op.name} | environment: ${op.environment} | mode: ${op.mode} | status: ${op.status}`);
}
console.log(`\nActions the core knows: ${ACTIONS.join(', ')}`);

// 1. Read in its own environment -> allowed.
show(
  'Blackpine Operator reads Blackpine Field',
  authorize('blackpine-operator', 'blackpine-field', 'read'),
);

// 2. Publish -> denied in read-only advisory mode.
show(
  'Blackpine Operator publishes to Blackpine Field',
  authorize('blackpine-operator', 'blackpine-field', 'publish'),
);

// 3. Cross-environment read -> denied.
show(
  'Blackpine Operator reads Rivet Reach',
  authorize('blackpine-operator', 'rivet-reach', 'read'),
);

// 4. Spend -> denied.
show(
  'Blackpine Operator spends in Blackpine Field',
  authorize('blackpine-operator', 'blackpine-field', 'spend'),
);

// 5. Mode-change request -> recorded pending only, never self-approved.
console.log('\n--- Mode-change request ---');
const request = requestModeChange('blackpine-operator', 'not-deployed', 'demo');
console.log(`recorded: ${request.recorded}`);
console.log(`reason: ${request.reason}`);
if (request.request) {
  console.log(`request id: ${request.request.id} | status: ${request.request.status}`);
}
console.log(`pending requests: ${getPendingModeChanges().length}`);
console.log(`all requests: ${getAllModeChangeRequests().length}`);

// 6. The audit log: every decision above, append-only.
function label(entry) {
  if (entry.type === 'authorization') return entry.allowed ? 'ALLOWED' : 'DENIED';
  if (entry.type === 'mode-change-requested') return 'RECORDED-PENDING';
  if (entry.type === 'mode-change-approved') return 'APPLIED';
  if (entry.type === 'mode-change-refused') return 'REFUSED';
  return entry.allowed ? 'ALLOWED' : 'DENIED';
}

console.log('\n--- Audit log (append-only) ---');
for (const entry of getAuditLog()) {
  console.log(
    `${entry.timestamp} | ${entry.type} | ${entry.operatorId} | ${entry.environment} | ${entry.action} | ${label(entry)}`,
  );
}

console.log('\nDemo complete. The core enforces read-only advisory mode: observe and advise only.');
