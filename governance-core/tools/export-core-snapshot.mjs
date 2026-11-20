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
import * as coreModule from '../src/index.mjs';
import { createNotificationSystem } from '../src/notifications.mjs';

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
// Drafts use the worker's nickname id in their "Written by:" line where the
// registry uses the formal id. Resolve the nickname before validating.
const OPERATOR_ALIASES = {
  'handshake-operator': 'partnerships-operator',
  'hearth-operator': 'homeowner-operator',
  'proof-operator': 'deal-checker-operator',
  'shuttle-operator': 'supplier-operator',
  'mirror-operator': 'performance-operator',
  'prova-operator': 'tester-operator',
};
// Filename prefixes for drafts whose "Written by:" line names no operator:
// new-operator announcements are written by the Governance Core, and the
// helper-needs drafts carry no author line at all (each is the named
// operator's answer to the owner's question). Matched longest-prefix-first
// against the filename with the leading "draft-" stripped. Ids not in the
// registry are working titles for operators the owner has not registered
// yet — published as-is, never added to the registry here.
const FILENAME_OPERATORS = [
  ['new-rivet-reach-contractor-recruiter', { id: 'rivet-reach-contractor-recruiter', name: 'Contractor Recruiter' }],
  ['new-rivet-reach-contractor-followup', { id: 'rivet-reach-contractor-followup', name: 'Contractor Follow-up' }],
  ['new-rivet-reach-homeowner-followup', { id: 'rivet-reach-homeowner-followup', name: 'Homeowner Follow-up' }],
  ['new-rivet-reach-homeowner-matcher', { id: 'rivet-reach-homeowner-matcher', name: 'Homeowner Matcher' }],
  ['new-pricing-promotions-worker', { id: 'pricing-promotions-operator', name: 'Pricing & Promotions Worker' }],
  ['new-product-promotion-worker', { id: 'product-promotion-operator', name: 'Product Promotion Worker' }],
  ['new-customer-care-worker', { id: 'customer-care-operator', name: 'Customer Care Worker' }],
  ['new-repeat-buyer-worker', { id: 'repeat-buyer-operator', name: 'Repeat Buyer Worker' }],
  ['new-ev-record-builder', { id: 'ev-record-builder', name: 'Record Builder' }],
  ['new-ev-packet-followup', { id: 'ev-packet-followup', name: 'Packet Follow-up' }],
  ['new-catalog-worker', { id: 'catalog-operator', name: 'Catalog Worker' }],
  ['new-novelty-designer', { id: 'novelty-designer', name: 'Novelty Designer' }],
  ['new-listings-worker', { id: 'listings-operator', name: 'Listings Worker' }],
  ['new-orders-worker', { id: 'orders-operator', name: 'Orders Worker' }],
  ['new-ev-rapport', { id: 'ev-rapport', name: 'Rapport' }],
  ['rivet-reach-operator-', { id: 'rivet-reach-operator', name: 'Rivet Reach Operator' }],
  ['printify-department-', { id: 'printify-department', name: 'Printify Department' }],
  ['blackpine-operator-', { id: 'blackpine-operator', name: 'Blackpine Operator' }],
  ['black-friday-', { id: 'black-friday-operator', name: 'Black Friday Operator' }],
  ['helper-needs-handshake', { id: 'partnerships-operator', name: 'The Handshake' }],
  ['helper-needs-hearth', { id: 'homeowner-operator', name: 'The Hearth' }],
  ['helper-needs-closer', { id: 'closer-operator', name: 'The Closer' }],
  ['helper-needs-mirror', { id: 'performance-operator', name: 'The Mirror' }],
  ['helper-needs-proof', { id: 'deal-checker-operator', name: 'The Proof' }],
  ['helper-needs-prova', { id: 'tester-operator', name: 'Prova' }],
  ['helper-needs-shuttle', { id: 'supplier-operator', name: 'The Shuttle' }],
  ['content-mirror-', { id: 'content-operator', name: 'Content Operator' }],
  ['catalog-worker-', { id: 'catalog-operator', name: 'Catalog Worker' }],
  ['finance-brother-', { id: 'finance-brother-operator', name: 'Adamo — Finance Brother' }],
  ['affiliate-', { id: 'affiliate-operator', name: 'Affiliate Operator' }],
  ['handshake-', { id: 'partnerships-operator', name: 'The Handshake' }],
  ['sherlock-', { id: 'sherlock-operator', name: 'Sherlock' }],
  ['deadlock-', { id: 'deadlock-operator', name: 'Deadlock' }],
  ['interlock-', { id: 'interlock-operator', name: 'Interlock' }],
  ['matlock-', { id: 'matlock-operator', name: 'Matlock' }],
  ['content-', { id: 'content-operator', name: 'Content Operator' }],
  ['tailor-', { id: 'tailor-operator', name: 'The Tailor' }],
  ['closer-', { id: 'closer-operator', name: 'The Closer' }],
  ['hearth-', { id: 'homeowner-operator', name: 'The Hearth' }],
  ['proof-', { id: 'deal-checker-operator', name: 'The Proof' }],
  ['prova-', { id: 'tester-operator', name: 'Prova' }],
  ['mirror-', { id: 'performance-operator', name: 'The Mirror' }],
  ['shuttle-', { id: 'supplier-operator', name: 'The Shuttle' }],
  ['galileo-', { id: 'galileo-operator', name: 'Galileo Ferraris' }],
  ['adamo-', { id: 'finance-brother-operator', name: 'Adamo — Finance Brother' }],
];
// Resolve a draft's author. Order: (a) an operator id in the file's
// "Written by:" line, validated against the registry (aliases resolved
// first; an unregistered "-operator" id is kept as-is with the name from
// the line — a working title, not a registry entry); (b) the
// filename-prefix map; (c) the legacy "<env>-draft-NNN-" filename pattern.
// draft-log.md matches nothing and legitimately stays unlinked: it is the
// log, not a draft.
function resolveOperator(file, lines) {
  const writtenBy = lines.find((l) => /^Written by:/i.test(l)) || '';
  if (writtenBy) {
    const displayName = writtenBy
      .replace(/^Written by:\s*/i, '')
      .split('(')[0]
      .trim();
    const candidates = [];
    for (const paren of writtenBy.matchAll(/\(([^)]*)\)/g)) {
      for (const raw of paren[1].split(',')) {
        const token = raw.replace(/[`'"]/g, '').trim();
        if (/^[a-z0-9]+(-[a-z0-9]+)*-operator$/.test(token)) {
          candidates.push(token);
        }
      }
    }
    for (const id of candidates) {
      const registryId = OPERATOR_ALIASES[id] || id;
      const reg = byId.get(registryId);
      if (reg) return { id: reg.id, name: reg.name };
    }
    if (candidates.length > 0) {
      return { id: candidates[0], name: displayName || candidates[0] };
    }
  }
  const stem = file.replace(/^draft-/, '').replace(/\.md$/, '');
  const sorted = [...FILENAME_OPERATORS].sort(
    (a, b) => b[0].length - a[0].length,
  );
  for (const [prefix, op] of sorted) {
    if (stem.startsWith(prefix)) {
      const reg = byId.get(op.id);
      return reg ? { id: reg.id, name: reg.name } : op;
    }
  }
  const m = file.match(/^(.+?)-draft-(\d+)-(.+)\.md$/);
  const opKey = m ? m[1] : '';
  return OPERATOR_NAMES[opKey] || { id: opKey, name: opKey };
}
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
    // Decision state, same rules as the draft log: an explicit Status: line,
    // a DECISION line, or a first-line banner. Anything without an explicit
    // decision is pending. The app shows Approve/Deny buttons only on pending
    // drafts (owner's order, Nov 19, 2026).
    const statusLine = lines.find((l) => /^Status:/i.test(l)) || '';
    const decisionText = `${statusLine} ${decisionLine} ${firstLine}`.toLowerCase();
    const decisionStatus = /denied|refused|rejected/.test(decisionText)
      ? 'denied'
      : /approved/.test(decisionText)
        ? 'approved'
        : /published/.test(decisionText) && !/not published/.test(decisionText)
          ? 'published'
          : 'pending';
    // Design-suggestion drafts carry a Photo line with the live image URL
    // (owner's rule, Nov 19, 2026): "- Photo: https://...". The app shows
    // the photo when the draft is opened.
    const photoLine = lines.find((l) => /^\s*[-*]?\s*Photo:\s*\S+/.test(l)) || '';
    const photoMatch = photoLine.match(/Photo:\s*(\S+)/);
    const image = photoMatch ? photoMatch[1].replace(/[),.]+$/, '') : '';
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
    const op = resolveOperator(file, lines);
    const entry = {
      file,
      draftId: m ? `draft-${m[2]}` : file,
      operatorId: op.id,
      operatorName: op.name,
      title: m ? humanizeSlug(m[3]) : file,
      status: published ? 'published' : 'draft',
      decisionStatus,
      date,
      summary: truncate(summaryLine, 160),
    };
    if (decisionLine) entry.decision = truncate(decisionLine, 220);
    if (image) entry.image = image;
    if (published) {
      const url = firstLine.match(/https?:\/\/\S+/);
      if (url) entry.publishedUrl = url[0].replace(/[),.]+$/, '');
    }
    return entry;
  });

// Notifications: the owner's inbox. Replay the append-only log through the
// notification module itself, so creation + decision entries merge exactly
// as the live system sees them (a decision updates the record's status;
// corrupt lines are skipped, never fatal). Read-only here: the exporter
// creates no notifications and decides none — it only lists.
const notificationSystem = createNotificationSystem(coreModule);
const notifications = notificationSystem
  .listAll()
  .slice()
  .reverse() // Newest first, so the page renders in file order.
  .map((n) => ({
    id: n.id,
    seq: n.seq,
    operatorId: n.operatorId,
    operatorName: n.operatorName,
    environment: n.environment,
    action: n.action,
    reference: n.reference,
    reason: n.reason,
    timestamp: n.timestamp,
    status: n.status,
    decidedBy: n.decidedBy,
    decidedAt: n.decidedAt,
    decisionReason: n.decisionReason,
  }));
const notificationStats = {
  total: notifications.length,
  pendingCount: notifications.filter((n) => n.status === 'pending').length,
  decidedCount: notifications.filter((n) => n.status !== 'pending').length,
};

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
  notifications,
  notificationStats,
  audit,
  auditStats,
};

writeFileSync(outPath, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(`Wrote ${outPath}`);
console.log(
  `operators: ${operators.length}, rules: ${rules.length}, ` +
    `staging drafts: ${staging.length}, pending: ${pending.length} ` +
    `(${pending.filter((r) => r.stale).length} stale), ` +
    `notifications: ${notificationStats.total} ` +
    `(${notificationStats.pendingCount} pending, ${notificationStats.decidedCount} decided), ` +
    `audit entries in snapshot: ${audit.length}, total in log: ${auditStats.inMemoryEntries}`,
);
