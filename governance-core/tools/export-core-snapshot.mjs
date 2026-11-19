/**
 * Export a read-only snapshot of the Governance Core for the operator
 * dashboard's Core screen (galinyx-site/operator-dashboard/core.html)
 * and the GALINYX OS shell's Workforce view (galinyx-site/index.html).
 * Both pages read this one file; it is the single published source for
 * registry, rules, staging drafts, pending requests, and audit entries.
 *
 * Read-only: calls only the Core's read accessors. It never calls
 * authorize() or any mode-change function, so it never appends to the
 * audit log. Staging drafts are read from the staging folder as text.
 *
 * Usage: node governance-core/tools/export-core-snapshot.mjs
 * Output: galinyx-site/operator-dashboard/core-snapshot.json
 *
 * The snapshot is a point-in-time export. The Core screen and the shell's
 * Workforce view refresh only when this script is re-run and the snapshot
 * re-published; there is no live feed.
 */

import { writeFileSync, readdirSync, readFileSync } from 'node:fs';
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

// The Core's five rules. Four live in operators.json; the fifth (fail
// closed) is the Core's documented design — see the header comment in
// src/index.mjs ("Fail closed, always... authorize() never throws") and
// the fail-closed branch in authorize(). The wording below matches the
// Core screen (operator-dashboard/core.html) verbatim.
const registry = JSON.parse(
  readFileSync(path.resolve(here, '../src/operators.json'), 'utf8'),
);
const rules = [
  ...registry.rules,
  'Fail closed, always. Unknown operators, environments, actions, modes, malformed input, and unexpected errors all deny.',
];

// Staging drafts: one entry per file in governance-core/staging/.
// Status comes from the first line ("PUBLISHED ..." vs "DRAFT — ...").
// The summary is the first substantive line of the body, truncated.
const stagingDir = path.resolve(here, '../staging');
const OPERATOR_NAMES = {
  'blackpine': { id: 'blackpine-operator', name: 'Blackpine Operator' },
  'rivet-reach': { id: 'rivet-reach-operator', name: 'Rivet Reach Operator' },
};
function humanizeSlug(slug) {
  return slug
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
function truncate(s, max) {
  const clean = String(s || '').replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}
const staging = readdirSync(stagingDir)
  .filter((f) => f.endsWith('.md'))
  .sort()
  .map((file) => {
    const text = readFileSync(path.join(stagingDir, file), 'utf8');
    const lines = text.split('\n');
    const firstLine = lines[0] || '';
    const published = firstLine.startsWith('PUBLISHED');
    const dateLine = lines.find((l) => l.startsWith('Date:')) || '';
    const date = dateLine.replace(/^Date:\s*/, '').trim();
    const decisionLine = lines.find((l) => l.startsWith('DECISION')) || '';
    const dividerAt = lines.findIndex((l) => l.trim() === '---');
    const body = dividerAt >= 0 ? lines.slice(dividerAt + 1) : lines;
    // First line with real content: skip blanks and section headers
    // (lines that are just a label ending in ':').
    const summaryLine =
      body.find((l) => {
        const t = l.trim();
        return t && !t.endsWith(':');
      }) || '';
    const m = file.match(/^(.+?)-draft-(\d+)-(.+)\.md$/);
    const opKey = m ? m[1] : '';
    const op = OPERATOR_NAMES[opKey] || { id: opKey, name: opKey };
    const entry = {
      file,
      draftId: m ? `draft-${m[2]}` : file,
      operatorId: op.id,
      operatorName: op.name,
      title: m ? humanizeSlug(m[3]) : file,
      status: published ? 'published' : 'draft',
      date,
      summary: truncate(summaryLine, 160),
    };
    if (decisionLine) entry.decision = truncate(decisionLine, 220);
    if (published) {
      const url = firstLine.match(/https?:\/\/\S+/);
      if (url) entry.publishedUrl = url[0].replace(/[),.]+$/, '');
    }
    return entry;
  });

const snapshot = {
  generatedAt: new Date().toISOString(),
  coreVersion: CORE_VERSION,
  // The Core loader keeps only id/name/environment/mode/status, so
  // listOperators() drops statusNote. Merge it back from the registry so
  // owner rules (e.g. the Tailor's approval rule) reach the published
  // snapshot and the dashboard.
  operators: operators.map((op) => {
    const note = registry.operators.find((r) => r.id === op.id)?.statusNote;
    return note ? { ...op, statusNote: note } : op;
  }),
  environments: Object.values(ENVIRONMENTS),
  modes: MODES,
  rules,
  staging,
  pendingRequests: pending,
  audit,
  auditStats,
};

writeFileSync(outPath, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(`Wrote ${outPath}`);
console.log(
  `operators: ${operators.length}, rules: ${rules.length}, ` +
    `staging drafts: ${staging.length}, pending: ${pending.length} ` +
    `(${pending.filter((r) => r.stale).length} stale), ` +
    `audit entries in snapshot: ${audit.length}, total in log: ${auditStats.inMemoryEntries}`,
);
