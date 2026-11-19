/**
 * GALINYX Governance Core — shared state store (v1.5.0)
 * =====================================================
 * Zero third-party dependencies. (Only Node built-ins: fs, path, crypto.)
 *
 * The store interface behind the Core's shared state. The Core's registry
 * file (operators.json) is the single source of truth for who exists and
 * what mode they are in; this module is how the Core reads and writes it
 * safely. It knows nothing about operators — it is a generic JSON store,
 * and the Core passes its own validator.
 *
 * Guarantees:
 *   - Atomic writes: write to a temp file in the same directory, then
 *     rename over the original. A crash mid-write leaves either the old
 *     file or the new file, never a half-written one.
 *   - Single writer: an exclusive lockfile (created with 'wx', so a
 *     second writer fails instead of overwriting). A lock older than
 *     30 seconds whose PID is dead is stale and may be taken over; a
 *     live holder is never evicted.
 *   - Optimistic concurrency: every save carries the revision the
 *     writer last saw. If the file's revision moved since, the save is
 *     refused with conflict: true — the writer must sync and retry.
 *     Nobody silently overwrites a change they never saw.
 *   - Validation before write: a mutation that would corrupt the file
 *     (failing the caller's validator) is refused before it touches
 *     the disk.
 *
 * Revision tracking: the store keeps a sidecar file (<file>.revision)
 * holding the current revision number. The revision increments on
 * every successful save. The sidecar is itself written atomically.
 * A missing sidecar means revision 0 (the file predates revisions).
 *
 * This is the file-backed implementation. The Supabase cutover (see
 * ../shared-state-design-2026-11-19.md) replaces the backend behind
 * this same interface — the Core's calls do not change.
 */

import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
  writeSync,
} from 'node:fs';
import path from 'node:path';

export const STORE_VERSION = 1;
const LOCK_STALE_MS = 30 * 1000; // a lock older than this, with a dead PID, is stale
const LOCK_RETRY_MS = 50;
const LOCK_MAX_WAIT_MS = 5000; // how long withLock waits for a live holder

function revisionFile(file) {
  return `${file}.revision`;
}

function lockFile(file) {
  return `${file}.lock`;
}

function readRevision(file) {
  try {
    const raw = readFileSync(revisionFile(file), 'utf8').trim();
    const n = Number(raw);
    return Number.isInteger(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

function writeRevision(file, revision) {
  const tmp = `${revisionFile(file)}.tmp-${process.pid}`;
  writeFileSync(tmp, `${revision}\n`, 'utf8');
  renameSync(tmp, revisionFile(file));
}

// Atomic JSON write: temp file in the same directory, then rename.
// Returns { ok, reason } — never throws.
export function atomicWriteJson(file, data) {
  try {
    const dir = path.dirname(file);
    mkdirSync(dir, { recursive: true });
    const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
    writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
    renameSync(tmp, file);
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: `Atomic write failed for ${file}: ${err.message}` };
  }
}

// Read + parse a JSON file. Returns { ok, data, reason } — never throws.
export function readJsonFile(file) {
  try {
    const data = JSON.parse(readFileSync(file, 'utf8'));
    return { ok: true, data };
  } catch (err) {
    return { ok: false, data: null, reason: `Could not read ${file}: ${err.message}` };
  }
}

// Read-modify-validate-write, under the lock, with optimistic
// concurrency. mutate(data) changes the parsed data in place (or
// returns replacement data); validate(data) returns { ok, errors }
// when supplied. Nothing is written unless validation passes and the
// revision still matches. Returns { ok, revision, conflict, reason }.
export function updateJsonFile(file, mutate, validate = null, expectedRevision = null) {
  const store = createStateStore({ file });
  return store.withLock(() => {
    const current = store.getRevision();
    if (expectedRevision !== null && expectedRevision !== current) {
      return {
        ok: false,
        revision: current,
        conflict: true,
        reason: `Revision conflict: expected ${expectedRevision}, current is ${current}. Sync and retry.`,
      };
    }
    // A missing file is a fresh store (revision 0, no data yet) — save()
    // creates it, and the mutation receives null. A file that EXISTS
    // but cannot be read or parsed is refused, never overwritten blindly.
    let data = null;
    if (existsSync(file)) {
      const read = readJsonFile(file);
      if (!read.ok) {
        return { ok: false, revision: current, conflict: false, reason: read.reason };
      }
      data = read.data;
    }
    try {
      const replacement = mutate(data);
      if (replacement !== undefined) data = replacement;
    } catch (err) {
      return { ok: false, revision: current, conflict: false, reason: `Mutation failed: ${err.message}` };
    }
    if (validate) {
      let result;
      try {
        result = validate(data);
      } catch (err) {
        return { ok: false, revision: current, conflict: false, reason: `Validation threw: ${err.message}` };
      }
      if (!result || result.ok !== true) {
        const errors = result && Array.isArray(result.errors) ? result.errors.join('; ') : 'validation failed';
        return { ok: false, revision: current, conflict: false, reason: `Validation refused the write: ${errors}` };
      }
    }
    const written = atomicWriteJson(file, data);
    if (!written.ok) {
      return { ok: false, revision: current, conflict: false, reason: written.reason };
    }
    const next = current + 1;
    try {
      writeRevision(file, next);
    } catch {
      // The data write succeeded; a failed revision bump leaves the
      // revision stale (the next writer sees the old number). That is
      // the safe direction for availability, and the revision is a
      // concurrency aid, not the data itself.
    }
    return { ok: true, revision: next, conflict: false, reason: 'Written.' };
  });
}

export function createStateStore({ file } = {}) {
  if (typeof file !== 'string' || file === '') {
    throw new Error('createStateStore requires a file path.');
  }
  const resolved = path.resolve(file);
  const lock = lockFile(resolved);

  // Is a PID alive? process.kill(pid, 0) throws ESRCH when dead, EPERM
  // when alive-but-not-ours (still alive). Any other outcome: treat as
  // alive — never evict a lock on a guess.
  function pidAlive(pid) {
    if (!Number.isInteger(pid) || pid <= 0) return false;
    try {
      process.kill(pid, 0);
      return true;
    } catch (err) {
      return err && err.code === 'EPERM';
    }
  }

  // Try once to take the lock. Returns { held, reason }.
  function tryLock() {
    try {
      const fd = openSync(lock, 'wx');
      const payload = JSON.stringify({ pid: process.pid, at: new Date().toISOString() });
      writeSync(fd, payload);
      closeSync(fd);
      return { held: true, reason: 'Lock acquired.' };
    } catch (err) {
      if (err.code !== 'EEXIST') {
        return { held: false, reason: `Could not create lockfile: ${err.message}` };
      }
      // A lock exists. Stale only when it is old AND its PID is dead.
      try {
        const info = JSON.parse(readFileSync(lock, 'utf8'));
        const age = Date.now() - Date.parse(info.at || 0);
        if (Number.isFinite(age) && age > LOCK_STALE_MS && !pidAlive(info.pid)) {
          rmSync(lock, { force: true });
          return tryLock();
        }
        return { held: false, reason: `Locked by PID ${info.pid} (${info.at || 'unknown time'}).` };
      } catch {
        // Unreadable lockfile: check by age alone, using mtime.
        try {
          const mtime = statSync(lock).mtimeMs;
          if (Date.now() - mtime > LOCK_STALE_MS) {
            rmSync(lock, { force: true });
            return tryLock();
          }
        } catch {
          // Fall through to "held".
        }
        return { held: false, reason: 'Locked by another process (unreadable lockfile).' };
      }
    }
  }

  function releaseLock() {
    try {
      const info = JSON.parse(readFileSync(lock, 'utf8'));
      // Only remove a lock this process holds — never another's.
      if (info.pid === process.pid) rmSync(lock, { force: true });
      return true;
    } catch {
      return false;
    }
  }

  // Run fn while holding the lock; always releases. Waits briefly for
  // a live holder (up to LOCK_MAX_WAIT_MS), then fails loudly instead
  // of proceeding unlocked. Returns fn's return value, or
  // { ok: false, reason } when the lock could not be taken.
  function withLock(fn) {
    const deadline = Date.now() + LOCK_MAX_WAIT_MS;
    let attempt = tryLock();
    while (!attempt.held && Date.now() < deadline) {
      // Synchronous wait: the Core is synchronous throughout, and a
      // 50ms spin is cheaper than restructuring around async locks.
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, LOCK_RETRY_MS);
      attempt = tryLock();
    }
    if (!attempt.held) {
      return { ok: false, reason: `Could not take the store lock: ${attempt.reason}` };
    }
    try {
      return fn();
    } finally {
      releaseLock();
    }
  }

  return {
    file: resolved,
    load() {
      const read = readJsonFile(resolved);
      if (!read.ok) return { ok: false, data: null, revision: readRevision(resolved), reason: read.reason };
      return { ok: true, data: read.data, revision: readRevision(resolved) };
    },
    save(data, expectedRevision = null) {
      return updateJsonFile(resolved, () => data, null, expectedRevision);
    },
    getRevision() {
      return readRevision(resolved);
    },
    getFileMtime() {
      try {
        return statSync(resolved).mtimeMs;
      } catch {
        return 0;
      }
    },
    acquireLock: tryLock,
    releaseLock,
    withLock,
  };
}
