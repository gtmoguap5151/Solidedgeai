/**
 * Export a read-only snapshot of the Governance Core for the operator
 * dashboard's Core screen (galinyx-site/operator-dashboard/core.html).
 *
 * Read-only: calls only the Core's read accessors. It never calls
 * authorize() or any mode-change function, so it never appends to the
 * audit log.
 *
 * Usage: node governance-core/tools/export-core-snapshot.mjs
 * Output: galinyx-site/operator-dashboard/core-snapshot.json
 *
 * The snapshot is a point-in-time export. The Core screen refreshes only
 * when this script is re-run and the snapshot re-published; there is no
 * live feed.
 */

import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CORE_VERSION,
  ENVIRONMENTS,
  MODES,
  listOperators,
  getPendingModeChanges,
  getAuditLog,
  getAuditStats,
} from '../src/index.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.resolve(
  here,
  '../../galinyx-site/operator-dashboard/core-snapshot.json',
);

const operators = listOperators();
const byId = new Map(operators.map((op) => [op.id, op]));

const pending = getPendingModeChanges().map((req) => ({
  ...req,
  // A request is stale when the operator's mode moved after the request was
  // made. The Core refuses to apply stale requests: approveModeChange marks
  // them stale instead of changing the mode.
  stale: byId.get(req.operatorId)?.mode !== req.currentMode,
}));

// Newest first, so the page renders in file order.
const audit = getAuditLog(20).slice().reverse();

// Only the safe stats fields: auditFile is an absolute local path and is
// deliberately left out of the published snapshot.
const stats = getAuditStats();
const auditStats = {
  inMemoryEntries: stats.inMemoryEntries,
  lastSeq: stats.lastSeq,
  persistFailures: stats.persistFailures,
};

const snapshot = {
  generatedAt: new Date().toISOString(),
  coreVersion: CORE_VERSION,
  operators,
  environments: Object.values(ENVIRONMENTS),
  modes: MODES,
  pendingRequests: pending,
  audit,
  auditStats,
};

writeFileSync(outPath, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(`Wrote ${outPath}`);
console.log(
  `operators: ${operators.length}, pending: ${pending.length} ` +
    `(${pending.filter((r) => r.stale).length} stale), ` +
    `audit entries in snapshot: ${audit.length}, total in log: ${auditStats.inMemoryEntries}`,
);
