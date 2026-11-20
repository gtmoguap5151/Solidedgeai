# GALINYX Governance Core — Stress-Test Report

**Date:** 2026-11-17
**Code tested:** `governance-core/src/index.mjs` as pushed in `gtmoguap5151/Solidedgeai`
commit `8803edc` (local copies at `~/workspace/galinyx-governance/governance-core/`,
byte-identical to the push). The core was unversioned at test time.
**Test:** `governance-core/src/stress-test.mjs` — 60 checks run with Node v24.22.1.
**Method:** every finding below was proven by running code against the real module
(the probe script and the stress test), not by reading alone. Where a finding is
analysis/judgment rather than a reproduced failure, it is labeled as such.

## Verdict in one paragraph

The core's *happy path* is honest: it denies unknown operators, unknown actions,
cross-environment access, and double approvals, and the demo's claims all hold.
But the security boundary is conventional, not enforced. The exported registries
are mutable from any importing code, there is no operator authentication at all,
`authorize()` crashes instead of denying on several inputs, the audit log can be
rewritten and permanently broken by single bad inputs, and a restart wipes all
history and silently reverts approved mode changes. Nothing here is exotic — these
are the standard failure modes of a first-draft authorization module. All of the
critical and high findings have fixes staged locally (see "Fixes staged").

## Score

| Run | PASS | FAIL | FINDING |
| --- | --- | --- | --- |
| Original code (commit 8803edc) | 21 | 33 | 6 |
| Fixed code (local, v1.1.0) | 54 | 0 | 6 |

Full original output: `stress-test-original-run.txt` in this folder.
Full fixed output: `stress-test-fixed-run.txt` in this folder.

## Findings

Severity: **critical** = the core's promises don't hold right now;
**high** = breaks security, integrity, or availability under realistic conditions;
**medium** = breaks at scale or over years; **low** = hygiene / future-proofing.

### CRITICAL

#### 1. The exported registries are mutable — anyone can rewrite the rules

- **Severity:** critical. **When it matters:** now.
- **What breaks:** `OPERATORS`, `MODES`, `ACTIONS`, and `ENVIRONMENTS` are exported
  as live mutable objects. Any code in the same process can rewrite the security
  policy: flipping one boolean (`MODES['read-only-advisory'].permissions.publish
  = true`) makes `authorize()` allow publish. Adding a fake operator, deleting
  Blackpine, or emptying `ACTIONS` (deny-all denial of service) all work.
- **Proof (stress test C1–C4, probe 2):**
  - C1: mutation attempts blocked 0/3; after mutation, read denied and a fake
    `evil-operator` was allowed.
  - C2: "PUBLISH ALLOWED after flipping permissions".
  - C3: after `ACTIONS.length = 0`, even `read` was denied.
  - C4: an `evil-env` environment was added from outside.
- **Fix (staged):** registry state moved into private `Map`s inside the module.
  `OPERATORS` is now a read-only Proxy over live state (reads work, writes throw),
  `MODES`/`ENVIRONMENTS`/`ACTIONS` are deep-frozen snapshots. Internal mode
  changes still work because they go through the private state, not the exports.

#### 2. No operator authentication — identity is just a string the caller claims

- **Severity:** critical. **When it matters:** now, and decisively at licensing scale.
- **What breaks:** `authorize(operatorId, ...)` trusts whatever ID the caller
  passes. There is no token, signature, or credential anywhere. Anyone who can
  call the function can claim to be the Blackpine Operator. The same applies to
  the most sensitive function: `approveModeChange()` accepts ANY non-empty string
  as the "owner" — approving as `'mallory'` or `'definitely-not-the-owner'` works.
  The core's central promise — "mode changes require explicit owner approval" —
  is enforced only by convention.
- **Proof (stress test D2, probe 8b/9):** `approveModeChange(..., 'mallory')`
  returned `{applied: true}`; the mode changed.
- **Fix:** this cannot be fully fixed inside this module without an auth system,
  and the task explicitly forbids inventing one here. Staged mitigation: an
  owner-identity guardrail — the approver must match the configured owner identity
  (`GALINYX_OWNER_ID`, default `'owner'`). This is a guardrail, NOT
  authentication: anyone who can call the function and knows the owner string can
  still approve. The real fix is specified in "Future work: operator
  authentication" below. Until that exists, the core must only be called by
  trusted in-process code — never expose `authorize()` / `approveModeChange()`
  directly to untrusted input (e.g. an HTTP API) without an auth layer in front.

### HIGH

#### 3. `authorize()` crashes instead of denying on hostile input — fail-crash, with an audit gap

- **Severity:** high. **When it matters:** now.
- **What breaks:** several inputs make `authorize()` throw instead of returning
  a denial: a `Symbol` as any argument (`TypeError: Cannot convert a Symbol value
  to a string`, from the template literal in the reason string), and an operator
  whose mode is `'__proto__'` / `'constructor'` (`TypeError: Cannot read
  properties of undefined`, because `MODES[mode].permissions` is `undefined`).
  The throw happens BEFORE the audit entry is recorded, so the attempt is never
  logged. Whether this fails open depends on the caller's error handling; at
  minimum it is a denial of service and an audit hole.
- **Proof (stress test A7, A12, B2, D11; probe 1, 3):** A7 threw with 0 audit
  entries recorded; B2 threw on a `__proto__` mode.
- **Fix (staged):** strict input validation (all IDs must be real strings
  matching an ID pattern), all values sanitized before use, and a try/catch
  fail-closed wrapper guaranteeing `authorize()` never throws and always logs.

#### 4. Type coercion lets non-strings pass as operator IDs

- **Severity:** high. **When it matters:** now.
- **What breaks:** `authorize()` looks up `OPERATORS[operatorId]` with no type
  check, so JavaScript coerces the key. `authorize(['blackpine-operator'], ...)`
  is ALLOWED (the array stringifies to the ID), and an object with a custom
  `toString()` returning `'blackpine-operator'` is also ALLOWED. Any JSON/API
  caller that passes a non-string where a string was expected can inherit an
  operator's access.
- **Proof (stress test A6, A12):** A12: "ALLOWED for input blackpine-operator"
  (from the `{toString: () => 'blackpine-operator'}` case).
- **Fix (staged):** `authorize()` (and the mode-change functions) require actual
  strings matching the ID pattern; anything else is denied.

#### 5. Prototype pollution fails open

- **Severity:** high. **When it matters:** now if the host app has any pollution
  vector; the risk grows as the codebase grows.
- **What breaks:** all registry lookups are plain-object property accesses
  (`OPERATORS[id]`, `MODES[mode]`), which resolve through the prototype chain.
  If any other code in the process pollutes `Object.prototype`, a fake operator
  entry is found and authorized. `getOperator('__proto__')` returns `{}` instead
  of `null`.
- **Proof (stress test B1, B4; probe 4):** after setting
  `Object.prototype['evil-operator'] = {...read-only-advisory...}`, the fake
  operator's read was ALLOWED.
- **Fix (staged):** all registries are `Map`s (exact keys, no prototype chain),
  and ID validation rejects names starting with `_`.

#### 6. A mode change to a prototype-chain name, via the legitimate API, permanently breaks authorization

- **Severity:** high. **When it matters:** now.
- **What breaks:** `requestModeChange()` accepts `'__proto__'`, `'constructor'`,
  and `'toString'` as modes, because `MODES['__proto__']` is truthy (it's
  `Object.prototype`). Once approved, every `authorize()` call for that operator
  throws `TypeError` forever (until process restart) — and, per finding 3, throws
  are never logged. Combined with finding 2 (anyone can approve), this is a
  one-call denial of service through the public API.
- **Proof (stress test B3, B2; probe 8):** mode `'__proto__'` recorded as pending,
  approved by `'mallory'`, then `authorize()` threw on every call.
- **Fix (staged):** mode validation uses `Map.has()` (prototype names are not
  modes); the requested mode is re-validated at approval time.

#### 7. The audit log is forgeable and fragile

- **Severity:** high. **When it matters:** now.
- **What breaks:** two defects.
  (a) Entries are only shallow-frozen and hold references to caller objects: pass
  an object as the action, mutate it afterwards, and the stored audit entry
  changes — history is rewritten.
  (b) `getAuditLog()` deep-copies via `JSON.parse(JSON.stringify(...))`, so a
  single circular object or `BigInt` anywhere in the log makes `getAuditLog()`
  throw on EVERY call forever after. One bad input permanently destroys audit
  retrieval. The same defect affects `getAllModeChangeRequests()` via a
  non-string `requestedBy`.
- **Proof (stress test E1, E2, E3, D13; probe 5, 6, 7):** E1 stored action became
  `{"x":999,"pwned":true}` after the caller mutated the object; E2/E3 threw
  `Converting circular structure to JSON` / `Do not know how to serialize a
  BigInt` on every `getAuditLog()` call, including after later clean calls.
- **Fix (staged):** every value is sanitized to a JSON-safe primitive (bounded
  string) before it is recorded — circular structures, BigInts, Symbols, and
  objects are all converted, never stored by reference; entries are deep-frozen;
  `getAuditLog()` returns frozen entries instead of JSON round-trips.

#### 8. No persistence — a restart wipes the audit log, pending requests, and approved modes

- **Severity:** high. **When it matters:** over years — every deploy, crash, or
  restart.
- **What breaks:** all state is in-memory. A restart loses the entire audit
  history, silently reverts approved mode changes (the operator is back to its
  hardcoded mode with no record that it ever changed), drops all pending mode
  change requests, and resets the request counter so IDs collide across restarts
  (`mode-change-1` again in every process).
- **Proof (stress test E5, H3, D12; probe 11):** E5: 2 entries before restart, 0
  after; H3: mode `not-deployed` before restart, `read-only-advisory` after;
  D12: both instances issued `mode-change-1`.
- **Fix (staged):** append-only JSONL audit file (`audit-log.jsonl`, path via
  `GALINYX_AUDIT_FILE`). Every entry is appended with `writeSync` on a
  persistently open file descriptor. On startup the core reloads the file,
  resumes the sequence counter, replays approved mode changes (restoring modes),
  and rebuilds the pending-request list (minus decided/expired ones). Request IDs
  are now UUIDs. Trade-off, stated honestly: writes use `writeSync` without
  `fsync`, so history survives a process crash/restart but could lose the last
  buffered entries on OS crash or power loss. Full fsync-per-entry would cost
  roughly 1ms per authorization.

#### 9. `operators.json` is not loaded — the registry is hardcoded and the file is a decoy

- **Severity:** high. **When it matters:** now (already a trap for maintainers),
  worse over years.
- **What breaks:** `index.mjs` never reads `operators.json`. The "registry as
  data" is a parallel copy that drifts silently: editing the file changes
  nothing, and editing the code leaves the file stale. There is no validation on
  load because there is no load.
- **Proof (stress test G1–G6; probe 15):** adding a `ghost-operator` to
  `operators.json` changed nothing — `listOperators()` still showed only the two
  hardcoded operators.
- **Fix (staged):** the core now loads `operators.json` at import (path via
  `GALINYX_OPERATORS_FILE`) and strictly validates it — unique IDs, required
  fields, known environments and modes, ID pattern, no `__proto__`/`constructor`
  keys. On any problem (missing file, invalid JSON, failed validation) it falls
  back to the built-in known-good registry AND records a `registry-fallback`
  warning in the audit log, so a bad registry can never silently take effect and
  never crashes the core.

### MEDIUM

#### 10. No input size limits; unbounded log growth; `getAuditLog()` is O(n) deep copy

- **Severity:** medium. **When it matters:** at scale and over years.
- **What breaks:** a 1 MB operator ID is stored verbatim in the log, and every
  `authorize()` call — even denied garbage — appends an entry. Measured:
  100,000 entries cost +47.1 MB of heap (~470 bytes/entry) and `getAuditLog()`
  took 414 ms to deep-copy them. Extrapolating (analysis, not a measurement):
  1,000 authorizations/day for 20 years is ~7.3M entries ≈ 3.4 GB — the process
  would run out of memory long before year 20.
- **Proof (stress test A9, E9):** A9 stored a 100,000-char ID in full; E9 measured
  the heap and read costs above.
- **Fix (staged):** inputs truncated to 128 chars; in-memory log capped at a
  50,000-entry rolling window (full history stays in the JSONL file);
  `getAuditLog()` returns frozen entries instead of JSON deep copies.

#### 11. Mode-change lifecycle holes: duplicates, staleness, no expiry

- **Severity:** medium. **When it matters:** now (duplicates/staleness); over
  years (expiry).
- **What breaks:** the same mode change can be requested any number of times
  (duplicate pending requests); a request made when the mode was X can be
  approved after the mode already changed (its recorded `currentMode` is stale);
  pending requests never expire, so a request from 20 years ago is still
  approvable.
- **Proof (stress test D8, D9, D10):** duplicates both recorded; the stale
  duplicate was approved after the mode had already changed; an "expired"
  request was approved (there was no expiry).
- **Fix (staged):** duplicate pending requests rejected; approval re-checks that
  the operator's current mode still matches the request's recorded `currentMode`
  (stale requests are marked `stale`); requests expire after 30 days by default
  (`GALINYX_MODE_CHANGE_TTL_MS`).

#### 12. No ordering key in the audit log — timestamps alone can't order entries or detect clock jumps

- **Severity:** medium. **When it matters:** over years (NTP jumps, VM restores,
  clock mistakes).
- **What breaks:** entries carry only a wall-clock timestamp. Two entries in the
  same millisecond are indistinguishable, and a backward clock jump makes the log
  run backward with no way to detect it.
- **Proof (stress test E6, E8):** E8, with the clock jumped 10 years back, showed
  timestamps `2026-11-17` then `2016-11-19` and no sequence numbers to recover
  the true order.
- **Fix (staged):** every entry carries a monotonic `seq` number, resumed from
  the persisted log on restart.

#### 13. No core version on audit entries

- **Severity:** medium (low impact, easy fix). **When it matters:** over years.
- **What breaks:** the original code was unversioned, and audit entries carry no
  version — in 5 or 20 years there is no way to tell which core version produced
  a log entry.
- **Proof (stress test E7):** `coreVersion: undefined`.
- **Fix (staged):** `CORE_VERSION` (`1.1.0` after these fixes) is stamped on
  every entry and exported.

#### 14. Per-process state — two live instances diverge (analysis + demonstration)

- **Severity:** medium. **When it matters:** at scale, if the core ever runs in
  more than one process (or worker threads).
- **What breaks:** each process holds its own registry and modes. A mode change
  approved in one process is invisible to another. The JSONL persistence fixes
  restart consistency for a single process, not live multi-process sync.
- **Proof (stress test H2, demonstration):** instance A showed mode
  `not-deployed`, instance B showed `read-only-advisory` for the same operator.
- **Fix:** not staged — this needs a shared store or a single-writer design, which
  is an architecture decision, not a code patch. Documented as a constraint: run
  exactly one writer process per deployment.

#### 15. No registration API — adding an operator requires a code change or direct mutation

- **Severity:** medium. **When it matters:** at scale.
- **What breaks:** there is no `registerOperator()`. On the original code the
  only ways to add an operator are editing the source or mutating the exported
  registry (which finding 1 shows is unsafe).
- **Proof (stress test F1, F3):** the 500-operator test could only load operators
  by direct mutation of the export.
- **Fix (staged, partial):** the registry is now file-loaded, so adding an
  operator is an edit to `operators.json` plus a restart — a real, safe path. A
  runtime `registerOperator()` API is deliberately NOT added: it would need the
  authentication system from finding 2 first.

### LOW

#### 16. `getAuditLog()` is an O(n) full deep copy on every call

- Covered under finding 10; fixed the same way (frozen entries + slice).

#### 17. No tests or CI in the repo — only a demo

- **Severity:** low (process, not code). Over 20 years, no regression protection.
  This stress test is the start of the fix: `src/stress-test.mjs` runs with plain
  `node`, no test framework needed. A CI run on every push is recommended.

#### 18. No registry versioning or backup

- **Severity:** low. `operators.json` has no version field and no backup; a bad
  edit overwrites the only copy (mitigated now by fallback-to-builtins on
  validation failure, finding 9). Versioned registry snapshots are future work.

## What's solid (passed checks, original code)

The core got the basics right, and these held under the stress test:

- Unknown operator / environment / action are denied (A1–A3).
- Missing, null, and undefined arguments are denied, not crashed (A4–A5).
- Case and whitespace variants are denied (A10); prototype-chain names used
  directly as IDs are denied (A11).
- Approval requires a non-empty approver (D1); no double approval, no approval
  after refusal, no cross-operator approval (D4–D7).
- Returned log copies cannot rewrite history for string entries (E4).
- 10,000 rapid-fire calls plus interleaved mode changes: 0 errors, 0 lost entries
  (H1) — the synchronous single-threaded design has no race conditions.
- Authorization is fast: p50 2µs at 500 operators, ~333,000 authorizations/sec
  (F1, F2); approving with 1,000 pending requests took 263µs (F4).
- Zero dependencies, no `eval`, no `Function` constructor, no network calls, no
  exotic syntax — only stable ES2015–2022 features (I1–I3). This is genuinely
  good for 20-year durability: there is nothing to rot except Node itself.
- The shipped `operators.json` is valid JSON and currently matches the live
  registry (G7, I4) — the drift in finding 9 hasn't bitten yet.

## Measurements (original code)

| Measurement | Result |
| --- | --- |
| 100k authorizations (in-memory only) | 209 ms |
| Heap growth for 100k audit entries | +47.1 MB (~470 B/entry) |
| `getAuditLog()` at 100k entries | 414 ms (full JSON deep copy) |
| Authorize throughput | ~333,000/sec |
| Authorize latency at 500 operators | p50 2.0µs, p99 20.3µs |
| Approval with 1,000 pending requests | 263µs |
| 20-year projection at 1,000 auths/day (analysis) | ~7.3M entries ≈ 3.4 GB heap — would OOM |

## Fixes staged (local working copy only — NOT pushed)

All fixes are implemented in `~/workspace/galinyx-governance/governance-core/`
and NOT pushed to GitHub. They go up only after Matt reviews this list.

| # | Finding | Fix in the local copy |
| --- | --- | --- |
| 1 | Mutable exports | Private `Map` state; `OPERATORS` is a read-only Proxy over live state; `MODES`/`ENVIRONMENTS`/`ACTIONS` deep-frozen |
| 2 | No authentication | Owner-identity guardrail (`GALINYX_OWNER_ID`, default `'owner'`); real auth specified below as future work — the guardrail is NOT authentication |
| 3 | Fail-crash on hostile input | Strict input validation + sanitization + try/catch fail-closed wrapper; `authorize()` never throws and always logs |
| 4 | Type coercion | All IDs must be real strings matching `^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$` |
| 5 | Prototype pollution | `Map`-based lookups; ID pattern rejects leading `_` |
| 6 | Prototype-chain modes | Mode validation via `Map.has()`; re-validated at approval |
| 7 | Forgeable/fragile audit log | Inputs sanitized to JSON-safe primitives before recording; entries deep-frozen; `getAuditLog()` returns frozen entries, no JSON round-trip |
| 8 | No persistence | Append-only JSONL audit file; load + replay on startup (history, approved modes, pending requests); UUID request IDs |
| 9 | Registry not loaded | `operators.json` loaded and strictly validated at import; fallback to built-ins + logged warning on any problem |
| 10 | Unbounded growth | Inputs truncated to 128 chars; in-memory log capped at a 50,000-entry rolling window (full history on disk) |
| 11 | Mode-change lifecycle | Duplicate requests rejected; stale requests rejected at approval; 30-day expiry (`GALINYX_MODE_CHANGE_TTL_MS`) |
| 12 | No ordering key | Monotonic `seq` on every entry, resumed from disk |
| 13 | No version | `CORE_VERSION` (`1.1.0`) stamped on every entry and exported |
| 16 | O(n) log reads | Frozen entries + slice (see 7, 10) |

Fixes NOT staged (need decisions or bigger work): operator authentication (see
below), multi-process shared state (finding 14), runtime operator registration
(finding 15), registry versioning/backups (finding 18).

### Fix verification

Re-run Nov 17, 2026 (~16:54 UTC) against the fixed local code (v1.1.0):

- **`node src/demo.mjs` — passes, same decisions as before** (read allowed,
  publish denied, cross-environment read denied, spend denied, mode-change
  request recorded pending). Request IDs are now UUIDs
  (`mode-change-a3dfd9de-…`).
- **`node src/stress-test.mjs` — 54 PASS, 0 FAIL, 6 FINDING, exit 0.**
  All 33 failures from the original run are cleared. The 6 remaining FINDINGs
  are the structural/measurement items, not regressions:
  - **E9** (measurement): 100k authorizes in 730 ms; in-memory window holds
    54,991 entries (capped at 50,000 + 5,000 trim batch) while `lastSeq`
    reaches 100,000 — the full history is on disk. `getAuditLog()` now
    returns in 0 ms (frozen entries, no JSON copy). Heap grew 46.7 MB for the
    window — bounded, not unbounded: it stops growing at ~55k entries.
  - **F1** (measurement): 500 operators now load **via the registry file**
    (not by mutation); authorize p50 6.0 µs, p99 43.8 µs.
  - **F2** (measurement): 10k authorizes in 89 ms (~112,000/sec). Slower
    than the original's ~333,000/sec — that is the cost of writing every
    decision to the audit file. Still far faster than any realistic load.
  - **F3**: still no runtime `registerOperator()` — by design; operators are
    added by editing `operators.json` and restarting.
  - **F4** (measurement): approving the last of 1,000 pending requests took
    533 µs.
  - **H2**: two live processes still diverge (per-process state) — the
    documented single-writer limit. Restart consistency is now proven (H3
    passes: an approved mode change survives a restart).

No regressions: every check that passed on the original code still passes,
and D2 (arbitrary-string approval) now passes — `approveModeChange(…,
'mallory')` is rejected by the owner-identity guardrail. The guardrail is
still not authentication (finding 2 stays open as future work).

## Future work: operator authentication (specified, not built)

What a real fix for finding 2 needs to look like:

1. **Operator keys.** Each operator gets a keypair. The registry holds the
   public key per operator (in `operators.json`, validated at load).
2. **Signed calls.** Every call carries a token: operator ID + environment +
   action + timestamp + nonce, signed with the operator's private key.
   `authorize()` verifies the signature, rejects expired tokens (short window,
   e.g. 5 minutes) and replays (nonce cache), and denies anything unsigned.
3. **Owner key.** Mode-change approvals must carry a signature from the owner's
   keypair. The `approvedBy` string becomes a verified identity, not a claim.
4. **Rotation and revocation.** The registry supports multiple keys per operator
   with validity windows; removing a key from the registry revokes it on the
   next restart (or reload, once a reload path exists).
5. **Until then:** the core must only be called by trusted in-process code. Any
   network front-end in front of it must do its own authentication first.

## Honesty: what this test can and cannot prove

- **Proven by running code:** every FAIL above was reproduced by executing the
  module — the throws, the allowed publish, the polluted operator, the forged
  log entry, the poisoned `getAuditLog()`, the wiped restart, the ignored
  registry file. The measurements (latency, heap, throughput) are measured, not
  estimated.
- **Analysis / judgment:** the 20-year heap projection (extrapolation from a
  measured per-entry cost); multi-process divergence (demonstrated with two
  in-process instances — real multi-process behavior depends on deployment);
  syntax/dependency longevity (judgment based on the stability of the features
  used); the claim that the owner-identity guardrail is not authentication
  (reasoning, stated plainly).
- **No test proves 20-year durability.** What this pass does is remove the
  failure modes that are already provable today, put the audit trail on disk so
  history survives restarts, and leave the remaining risks (authentication,
  multi-process state) named and specified instead of hidden.

## How to re-run

```sh
cd governance-core
node src/demo.mjs          # the demo (must still pass)
node src/stress-test.mjs   # the stress test (exit 0 = all checks pass)
```

Environment variables the fixed core understands:

| Variable | Default | Meaning |
| --- | --- | --- |
| `GALINYX_AUDIT_FILE` | `src/audit-log.jsonl` (next to the module) | Append-only JSONL audit log |
| `GALINYX_OPERATORS_FILE` | `src/operators.json` | Registry file, loaded + validated at import |
| `GALINYX_OWNER_ID` | `owner` | The approver identity accepted for mode changes (guardrail, not auth) |
| `GALINYX_MODE_CHANGE_TTL_MS` | 30 days | How long a pending mode-change request stays approvable |

Note: `audit-log.jsonl` is runtime state. It should be git-ignored, not
committed — it grows forever by design.
