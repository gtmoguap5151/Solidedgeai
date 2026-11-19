/**
 * GALINYX Governance Core — tamper-proof audit log (v1.5.0)
 * =========================================================
 * Hash-chained audit entries. Zero third-party dependencies.
 * (Only Node built-ins: crypto, fs, path.)
 *
 * The problem: audit-log.jsonl was a plain file. Anyone with file
 * access could rewrite history — change a decision, delete a denial —
 * and nothing would notice.
 *
 * The fix: every entry the Core writes now carries two fields:
 *
 *   prevHash  — SHA-256 of the raw previous line in the file
 *   entryHash — SHA-256 of this entry's canonical JSON (keys sorted,
 *               entryHash itself excluded, prevHash included)
 *
 * To rewrite history, an attacker would have to rewrite every entry
 * after the one they changed AND the genesis record — and the genesis
 * record lives in a separate file (audit-genesis.json) that the
 * verifier checks independently.
 *
 * The chain is POSITIONAL, not seq-based: it links line N to line N-1
 * by raw bytes. It deliberately does not depend on seq numbers — the
 * live log has duplicate seqs 51-60 (a seq-counter restart on
 * 2026-11-19, when the Core's in-memory counter restarted at 51 instead
 * of continuing from the file's max of 60; fixed in v1.5.0 by tracking
 * max seq from every parsed line). The chain covers the log AS IT IS,
 * duplicate seqs included. History is never rewritten or renumbered.
 *
 * Genesis: the log already had 71 entries before chaining existed.
 * Those lines stay byte-identical. audit-genesis.json records the
 * SHA-256 of their exact bytes (first N lines, terminators included)
 * plus the hash of the last pre-chain line. The verifier checks the
 * genesis region first, then the chain.
 *
 * External entries: entries appended by other writers (Xena records
 * owner decisions directly) carry no chain fields. They are NOT a
 * failure — the verifier reports them as "unchained" (with line
 * numbers) and still uses their raw bytes as the anchor for the next
 * chained entry, so the chain stays continuous across them. The Core
 * re-reads the file tail before chaining each new entry, so an
 * external append never breaks the next link.
 */

import { createHash } from 'node:crypto';
import { existsSync, openSync, closeSync, readFileSync, readSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

// The prevHash of the first entry in a fresh (empty) log. A fixed
// constant, so a fresh log's chain is verifiable without a genesis file.
export const GENESIS_PREV_HASH = createHash('sha256')
  .update('GALINYX-AUDIT-GENESIS', 'utf8')
  .digest('hex');

export const CHAIN_VERSION = 1;

export function sha256Hex(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

// Hash of one raw log line (no trailing newline).
export function hashLine(rawLine) {
  return sha256Hex(rawLine);
}

// Canonical JSON: keys sorted recursively, entryHash excluded. Sorting
// makes the hash independent of key insertion order, so the verifier
// reproduces the exact bytes the Core hashed at write time.
function sortKeys(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(sortKeys);
  const out = {};
  for (const key of Object.keys(value).sort()) {
    if (key === 'entryHash') continue;
    out[key] = sortKeys(value[key]);
  }
  return out;
}

export function canonicalEntry(entry) {
  return JSON.stringify(sortKeys(entry));
}

// Chain an entry: attach prevHash, then compute entryHash over the
// canonical entry (which includes prevHash). Returns a NEW object;
// the input is not mutated.
export function chainEntry(entry, prevHash) {
  const withPrev = { ...entry, prevHash };
  return { ...withPrev, entryHash: sha256Hex(canonicalEntry(withPrev)) };
}

// Read the last non-empty line of a file, scanning backwards in chunks
// so a large log is never read whole. Returns null when the file is
// missing, empty, or has no complete line.
export function readLastLine(filePath) {
  let fd;
  try {
    fd = openSync(filePath, 'r');
    const size = statSync(filePath).size;
    if (size === 0) return null;
    const CHUNK = 8192;
    let end = size;
    let buf = Buffer.alloc(0);
    // Scan backwards until a newline is found (or the file start).
    // Cap the scan at 1 MB: Core audit lines are bounded (sanitized,
    // truncated fields) and are a few KB at most.
    while (end > 0 && buf.length < 1024 * 1024) {
      const start = Math.max(0, end - CHUNK);
      const chunk = Buffer.alloc(end - start);
      readSync(fd, chunk, 0, chunk.length, start);
      buf = Buffer.concat([chunk, buf]);
      end = start;
      const idx = buf.lastIndexOf(0x0a); // '\n'
      if (idx >= 0) {
        const after = buf.subarray(idx + 1).toString('utf8');
        if (after.length > 0) return after;
        // Trailing newline with nothing after it: the last line is
        // the text before it. Keep scanning for the previous newline.
        const prev = buf.subarray(0, idx).lastIndexOf(0x0a);
        if (prev >= 0) return buf.subarray(prev + 1, idx).toString('utf8');
        if (end === 0) return buf.subarray(0, idx).toString('utf8');
      } else if (end === 0) {
        return buf.toString('utf8');
      }
    }
    return null;
  } catch {
    return null;
  } finally {
    if (fd !== undefined) {
      try {
        closeSync(fd);
      } catch {
        // Best-effort close.
      }
    }
  }
}

// Split file bytes into raw lines (no terminators), dropping the empty
// tail produced by a trailing newline. Returns [] for a missing file.
export function readRawLines(filePath) {
  let text;
  try {
    text = readFileSync(filePath, 'utf8');
  } catch {
    return [];
  }
  if (text === '') return [];
  const lines = text.split('\n');
  if (lines.length && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

// ---------------------------------------------------------------------------
// Genesis: the record of the log as it stood when chaining began.
// ---------------------------------------------------------------------------

// Compute a genesis record for the CURRENT contents of a log file:
// the hash of the file's exact bytes (all lines, terminators included),
// the line count, and the hash of the last line. Does NOT modify the log.
export function createGenesis(filePath) {
  let text;
  try {
    text = readFileSync(filePath, 'utf8');
  } catch (err) {
    return { ok: false, reason: `Could not read ${filePath}: ${err.message}` };
  }
  const lines = text === '' ? [] : text.split('\n').filter((l, i, a) => !(i === a.length - 1 && l === ''));
  return {
    ok: true,
    genesis: {
      version: CHAIN_VERSION,
      file: path.basename(filePath),
      lines: lines.length,
      bytesHash: sha256Hex(text),
      lastLineHash: lines.length ? hashLine(lines[lines.length - 1]) : GENESIS_PREV_HASH,
      createdAt: new Date().toISOString(),
      note: 'SHA-256 of the exact bytes of the first N lines of the audit log as it stood when hash-chaining began (Core v1.5.0). Those lines stay byte-identical; the chain covers the log as it is, duplicate seqs 51-60 included. History is never rewritten or renumbered.',
    },
  };
}

export function writeGenesis(genesis, genesisPath) {
  writeFileSync(genesisPath, `${JSON.stringify(genesis, null, 2)}\n`, 'utf8');
}

export function loadGenesis(genesisPath) {
  try {
    const data = JSON.parse(readFileSync(genesisPath, 'utf8'));
    if (
      !data ||
      typeof data !== 'object' ||
      data.version !== CHAIN_VERSION ||
      typeof data.lines !== 'number' ||
      typeof data.bytesHash !== 'string' ||
      typeof data.lastLineHash !== 'string'
    ) {
      return { ok: false, reason: 'Genesis file is malformed.' };
    }
    return { ok: true, genesis: data };
  } catch (err) {
    return { ok: false, reason: `Could not read genesis file: ${err.message}` };
  }
}

// ---------------------------------------------------------------------------
// Verification.
// ---------------------------------------------------------------------------

// Verify a log file. Returns a report; `ok` is false when ANY check
// fails. Unchained (external/legacy) entries are warnings, not failures:
// they are listed with line numbers, and the chain still anchors on
// their raw bytes. The report is plain data — the CLI formats it.
export function verifyAuditFile(filePath, genesisPath = null) {
  const report = {
    ok: true,
    file: filePath,
    lines: 0,
    genesis: null, // { checked, lines, ok, reason }
    chained: 0,
    unchained: [], // line numbers (1-based) of entries without chain fields
    errors: [],
  };
  const lines = readRawLines(filePath);
  report.lines = lines.length;
  if (lines.length === 0) {
    report.genesis = { checked: false, lines: 0, ok: true, reason: 'Empty log; nothing to verify.' };
    return report;
  }

  let chainStart = 0; // first line index (0-based) after the genesis region
  if (genesisPath !== null && existsSync(genesisPath)) {
    const g = loadGenesis(genesisPath);
    if (!g.ok) {
      report.ok = false;
      report.errors.push(`Genesis file unreadable: ${g.reason}`);
      report.genesis = { checked: false, lines: 0, ok: false, reason: g.reason };
    } else {
      const n = g.genesis.lines;
      if (lines.length < n) {
        report.ok = false;
        report.errors.push(
          `Genesis region is ${n} lines but the log has only ${lines.length} — lines were deleted.`,
        );
        report.genesis = { checked: true, lines: n, ok: false, reason: 'Log is shorter than the genesis region.' };
      } else {
        const regionBytes = `${lines.slice(0, n).join('\n')}\n`;
        const hash = sha256Hex(regionBytes);
        if (hash !== g.genesis.bytesHash) {
          report.ok = false;
          report.errors.push(
            `Genesis region changed: the first ${n} lines no longer hash to the recorded genesis. History was rewritten.`,
          );
          report.genesis = { checked: true, lines: n, ok: false, reason: 'Genesis hash mismatch.' };
        } else {
          report.genesis = { checked: true, lines: n, ok: true, reason: 'Genesis region intact.' };
        }
        chainStart = n;
      }
    }
  } else {
    report.genesis = { checked: false, lines: 0, ok: true, reason: 'No genesis file; chain verified from line 1.' };
  }

  for (let i = chainStart; i < lines.length; i++) {
    const lineNo = i + 1;
    let entry;
    try {
      entry = JSON.parse(lines[i]);
    } catch {
      report.ok = false;
      report.errors.push(`Line ${lineNo}: not valid JSON — the line is corrupt or was tampered with.`);
      continue;
    }
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      report.ok = false;
      report.errors.push(`Line ${lineNo}: not a JSON object.`);
      continue;
    }
    if (typeof entry.prevHash !== 'string' || typeof entry.entryHash !== 'string') {
      // External/legacy entry: no chain fields. Not a failure — but
      // recorded, so an attacker cannot hide a forged entry by omitting
      // the fields: the count of unchained entries is visible.
      report.unchained.push(lineNo);
      continue;
    }
    const expectedPrev = i === 0 ? GENESIS_PREV_HASH : hashLine(lines[i - 1]);
    if (entry.prevHash !== expectedPrev) {
      report.ok = false;
      report.errors.push(
        `Line ${lineNo}: prevHash does not match the previous line — the log was edited between lines ${lineNo - 1} and ${lineNo}, or an entry was inserted or deleted.`,
      );
      continue;
    }
    const expectedHash = sha256Hex(canonicalEntry(entry));
    if (entry.entryHash !== expectedHash) {
      report.ok = false;
      report.errors.push(`Line ${lineNo}: entryHash mismatch — this entry's contents were altered after it was written.`);
      continue;
    }
    report.chained++;
  }
  return report;
}
