# Shared State — Design (GALINYX Governance Core v1.5.0)

**Date:** 2026-11-19
**Ordered by:** Matt Johnson, on the 2026-11-19 voice call (~08:46 ET):
"Let's get them" — closing the four hierarchy gaps the stress test
reported (94 PASS / 0 FAIL / 8 FINDING, Core v1.4.0).
**Status:** File-backed implementation built and verified locally.
**NOT pushed, NOT live.** Supabase cutover is the documented next step.

## The gap it closes

From the Core's own stress-test findings (H2): two live Core instances
diverge. Each process holds its own registry state; a mode change approved
in process A is invisible to process B until B restarts and replays the
audit log. There was no shared state and no sync — only the rule "run
exactly one writer process."

## The design

### One file is the truth

The registry file (`operators.json`) is the single source of truth for
**who exists and what mode they are in**. Everything else derives from it:

- The Core loads the registry from the file at import (unchanged).
- **Every state change writes the file.** `approveModeChange()` now
  persists the new mode to the file the moment it applies in memory.
  `registerOperator()` writes the new operator to the file as part of
  registration. The audit log remains the durable *history* of why each
  change happened; the registry file is the durable *current state*.
- Writes are atomic: write to a temp file in the same directory, then
  rename over the original. A crash mid-write leaves either the old file
  or the new file, never a half-written one. (`src/state-store.mjs`.)

### Who writes

**One writer at a time.** The store takes an exclusive lock (a lockfile
created with `wx`, so a second writer fails instead of overwriting).
The lock carries the holder's PID and a timestamp; a lock older than 30
seconds with a dead PID is stale and may be taken over. A live holder is
never evicted.

In practice there is still one writer process (Xena's Core). The lock
exists so a second writer fails loudly instead of silently corrupting
the registry — the failure mode H2 warned about.

### How instances sync

**Explicit sync, not magic.** A second instance does not see changes
until it syncs — there is no background watcher and no push.

- `syncState()` re-reads the registry file and applies it to the live
  Maps: modes updated, new operators added, removed operators dropped.
  Pending mode-change requests are NOT clobbered by a sync; a request
  whose operator's mode moved becomes stale, and the existing staleness
  check in `approveModeChange()` refuses it (a fresh request is needed).
- `syncState()` is cheap and safe to call before any read that must be
  current (the snapshot exporter, the dashboard, a second process).
- Optimistic concurrency: every store write carries the revision the
  writer last saw. If the file's revision moved since, the write is
  refused with `conflict: true` — the writer must sync and retry.
  Nobody silently overwrites a change they never saw.

### What happens offline

The file-backed store is local disk: it works offline, always. There is
no network call anywhere in the Core (zero third-party deps, node:
built-ins only — the rule stands). "Offline" is the normal case here,
not a degraded mode.

### What the file-backed store does NOT do

- **Pending requests are not shared live.** Pending mode-change requests
  still live in memory + the audit log (replayed on restart). A second
  instance does not see another instance's pending requests until it
  restarts. The registry (who exists, what mode) syncs; the request
  queue does not yet. The Supabase cutover (below) closes this.
- **No live push.** Instances poll via `syncState()`. Nothing notifies
  a second instance that state changed.
- **No multi-writer merge.** Two writers race; the lock + optimistic
  concurrency turn the race into a loud refusal, not a merge.

## The store interface (`src/state-store.mjs`)

```js
createStateStore({ file }) -> {
  load(),              // { ok, data, revision } — read + parse + validate shape
  save(data, expectedRevision?), // atomic write; refuses on revision conflict
  getRevision(),       // current on-disk revision (0 when the file is absent)
  acquireLock(), releaseLock(), // single-writer lockfile
  withLock(fn),        // run fn while holding the lock; always releases
}
updateJsonFile(file, mutate, validate?) // read → mutate → validate → atomic write
```

The store is generic JSON; it knows nothing about operators. The Core
passes its own `validateRegistry` as the validator, so a write that
would corrupt the registry is refused before it touches the disk.

## Supabase cutover (next step, not this build)

The galinyx Supabase project is live
(ref `sebcnrlexkcuuyfmigoq`, us-east-1) and is the natural store for
shared state. The cutover, when ordered:

1. **Tables** (new migration, RLS on): `core_registry` (one row per
   operator: id, name, environment, mode, status, status_note,
   updated_at, updated_by), `core_mode_change_requests` (one row per
   request, incl. status + decided fields), `core_state_meta`
   (single row: revision counter).
2. **A Supabase-backed store** implementing the same interface as
   `createStateStore` (`load` / `save` / `getRevision` / lock via a
   `core_state_meta` row update with `revision = expected` as the
   optimistic-concurrency guard). The Core's calls to the store do not
   change — only the store behind the interface does.
3. **Realtime (optional):** Supabase Realtime on `core_registry` turns
   `syncState()` polling into a push. Not required for correctness.
4. **Offline:** keep the file-backed store as the local cache. Local
   writes go to the file first (works offline), then push to Supabase
   when online; conflicts resolve owner-wins, with the audit log as the
   tiebreaker record. This mirrors the shell's local-first sync engine
   (Phase 2) and must be designed with it, not beside it.
5. **NEVER touch the Yield Flow project** (Rivet Reach's backend,
   ref `mibvbzdrmjtchapqgelv`). Shared Core state lives in the galinyx
   project only.

## What changes for operators

Nothing. Operators still see one Core, one registry, one set of rules.
The change is underneath: when the owner approves a mode change, the
new mode is now durable in the registry file the same moment it applies
in memory — a restart can no longer silently revert it, and a second
instance can see it after a sync.

## Files

| File | Change |
| --- | --- |
| `governance-core/src/state-store.mjs` | **New.** Store interface + file-backed implementation (atomic writes, revision, lock, optimistic concurrency). |
| `governance-core/src/index.mjs` | `registerOperator()`, `syncState()`, mode-change persistence, `CORE_VERSION` 1.5.0. |
| `governance-core/src/stress-test.mjs` | Section M: shared-state sync + conflict checks. |
| `governance-core/README.md` | "One writer process" limit updated to the sync design. |
