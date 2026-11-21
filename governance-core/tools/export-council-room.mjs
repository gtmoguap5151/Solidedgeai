/**
 * Export the Council Room snapshot for the GALINYX OS shell
 * (galinyx-site/council-room.js renders it in the Council Room view).
 *
 * The Council Room is the QUIET room (owner's order, Nov 20, 2026): a
 * read-only window onto the written notes the five council members pass
 * each other through the Core's interaction layer, plus notes from Xena
 * as Director. No live generation, no auto-replies, no reply box — the
 * room only shows notes that already exist in interactions.jsonl.
 *
 * Read-only: reads interactions.jsonl and writes one JSON file. It never
 * calls authorize() or any mode-change function, and it never appends to
 * the audit log or the interactions log.
 *
 * Usage: node governance-core/tools/export-council-room.mjs
 * Output: galinyx-site/council-room.json
 *
 * The snapshot is a point-in-time export. The room refreshes only when
 * this script is re-run and the snapshot re-published; there is no live
 * feed. (Refresh cadence is a follow-up to this build, not part of it.)
 */

import { writeFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const interactionsPath = path.resolve(here, '../interactions.jsonl');
const outPath = path.resolve(here, '../../galinyx-site/council-room.json');

// Who belongs in the room: the five council members plus Xena as
// Director. Display names come from this map, not from the stored
// fromName/toName fields — those freeze the name as it stood when the
// message was written (seq 2 still calls Adamo "unnamed"). Franklin's
// operator id is scout-operator (The Scout); Lincoln has no operator
// id in the registry yet, so 'lincoln-operator' matches nothing today
// — it is here so his notes appear in the room the day he is
// registered, with no script change.
const ROOM_MEMBERS = {
  'galileo-operator': 'Galileo Ferraris',
  'scout-operator': 'Benjamin Franklin',
  'lincoln-operator': 'Abraham Lincoln',
  'finance-brother-operator': 'Adamo',
  'tester-operator': 'Prova',
  'xena-director': 'Xena',
};

// A note belongs in the room only when BOTH ends are in it: a council
// member writing to a worker outside the council is council business,
// not a council-room note, and the same the other way round.
function inRoom(msg) {
  return Boolean(ROOM_MEMBERS[msg.from]) && Boolean(ROOM_MEMBERS[msg.to]);
}

const lines = readFileSync(interactionsPath, 'utf8')
  .split('\n')
  .map((l) => l.trim())
  .filter(Boolean);

const notes = [];
for (const line of lines) {
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    continue; // Corrupt lines are skipped, never fatal.
  }
  if (!inRoom(msg)) continue;
  notes.push({
    seq: msg.seq,
    id: msg.id,
    fromId: msg.from,
    from: ROOM_MEMBERS[msg.from],
    toId: msg.to,
    to: ROOM_MEMBERS[msg.to],
    kind: msg.kind,
    timestamp: msg.timestamp,
    text: msg.payload,
    allowed: msg.allowed,
  });
}

// Newest first, so the page renders in file order.
notes.sort((a, b) => b.seq - a.seq);

const snapshot = {
  generatedAt: new Date().toISOString(),
  // The room is quiet by design: nothing in it generates, replies, acts,
  // spends, or publishes. This flag is the published record of that.
  quiet: true,
  members: Object.entries(ROOM_MEMBERS).map(([id, name]) => ({ id, name })),
  notes,
};

writeFileSync(outPath, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(`Wrote ${outPath}`);
console.log(
  `interaction lines read: ${lines.length}, ` +
    `council-room notes: ${notes.length}`,
);
