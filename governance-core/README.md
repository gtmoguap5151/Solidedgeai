# GALINYX Governance Core — v1.1.0

The Governance Core is the authority layer of GALINYX OS. It decides what
each specialist operator is allowed to do, and it records every decision.

```
GALINYX (technology company)
  -> GALINYX OS (operating platform)
    -> Governance Core (this folder: authority, policies, permissions, oversight)
      -> AI Workforce (operator registry, roles, assignments)
        -> Blackpine Operator   -> Blackpine Field (storefront environment)
        -> Rivet Reach Operator -> Rivet Reach (lead-generation environment)
```

## Files

- `src/index.mjs` — the core. Zero third-party dependencies, no secrets, no
  network calls (only Node built-ins: fs, path, crypto, url).
- `src/operators.json` — the operator registry. The core **loads this file at
  import** and validates it strictly (unique IDs, required fields, known
  environments and modes, ID pattern). A missing, unparsable, or invalid
  registry falls back to a built-in known-good registry, and the fallback is
  recorded in the audit log.
- `src/demo.mjs` — runnable demo. See below.
- `src/stress-test.mjs` — adversarial stress test: 60 checks covering
  fail-closed authorization, input abuse, prototype pollution, mode-change
  lifecycle, audit-log integrity, scale, registry integrity, concurrency,
  and longevity. Run it after any change to the core.
- `src/audit-log.jsonl` — **runtime state, not source.** The append-only audit
  log the core writes as it runs. Do not commit it (see `.gitignore`).
  Deleting it wipes history and resets sequence numbers.

## Modes

| Mode | May do | May not do |
| --- | --- | --- |
| `read-only-advisory` | read, advise | publish, spend, write |
| `not-deployed` | nothing | everything |

Current state:

- **Blackpine Operator** — deployed in read-only advisory mode. Its analysis
  has **not** yet been proven reliable.
- **Rivet Reach Operator** — registered, not deployed. Deployment is not yet
  confirmed.

## The rules, enforced in code

1. Each operator is bound to exactly one environment. No cross-environment
   access, ever.
2. An operator may only perform actions its current mode allows.
3. Every authorization decision is recorded in an append-only audit log — in
   memory (a 50,000-entry rolling window) and in `audit-log.jsonl`, so
   history survives restarts. Entries carry a monotonic sequence number and
   the core version, and are deep-frozen at record time.
4. A mode change is never self-approved.
5. **Fail closed, always.** Unknown operators, environments, actions, modes,
   malformed input, and unexpected errors all DENY. `authorize()` never
   throws, and a denied attempt is still logged.
6. **Inputs are validated, not trusted.** IDs must match
   `^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/`; anything recorded in the audit log
   is first sanitized to a bounded, JSON-safe string.
7. **The registry exports are read-only.** `OPERATORS` is a Proxy over live
   state (reads work, writes throw); `MODES`, `ENVIRONMENTS`, and `ACTIONS`
   are deep-frozen. To change the registry, edit `operators.json` and
   restart.

## How a mode change works

1. Anyone may call `requestModeChange(operatorId, newMode)`. It records a
   **pending** request and changes nothing. Duplicate pending requests for
   the same operator+mode are rejected. Requests expire after 30 days
   (configurable) and go stale if the operator's mode moves first.
2. The operator stays in its current mode until the owner explicitly approves.
3. The owner approves with `approveModeChange(operatorId, requestId,
   approvedBy)`. The approver must match the configured owner identity
   (`GALINYX_OWNER_ID`, default `'owner'`) and is recorded in the audit log.
   **This is a guardrail, not authentication** — see "Honest limits" below.

Access changes happen in the Governance Core, not on a dashboard. The
Blackpine Operator Dashboard (`galinyx-site/operator-dashboard/`) only shows
what the core allows — it cannot grant access.

## Environment variables

| Variable | Default | Meaning |
| --- | --- | --- |
| `GALINYX_OPERATORS_FILE` | `./operators.json` | Registry file to load. |
| `GALINYX_AUDIT_FILE` | `./audit-log.jsonl` | Append-only audit log file. |
| `GALINYX_OWNER_ID` | `owner` | Approver identity accepted for mode changes. |
| `GALINYX_MODE_CHANGE_TTL_MS` | 30 days | Pending-request lifetime in ms. |

## Run the demo

From the repository root:

```sh
node governance-core/src/demo.mjs
```

The demo shows the core allowing a read, denying a publish, denying a
cross-environment read, recording a mode-change request as pending, and then
printing the audit log. (The demo appends to `src/audit-log.jsonl`, so the
printed log grows across runs — that is persistence working.)

## Run the stress test

```sh
node governance-core/src/stress-test.mjs
```

Exit 0 means every check passed (measurement findings do not fail the run).
The full findings report is `../stress-test-report.md`.

## Honest limits

- **No operator authentication.** An operator ID is a claim, not a
  credential — anyone who can call the module can claim any operator ID, and
  the owner-identity check in `approveModeChange()` only checks that the
  caller *names* the configured owner. Real authentication (signed operator
  tokens, signed owner approvals, key rotation/revocation) is specified as
  future work in the stress-test report. Until it exists, only trusted
  in-process code may call this module.
- **One writer process.** State is per-process; two processes do not sync.
  The JSONL file gives restart consistency for one process, not live
  multi-process sync. Run exactly one writer.
- **Persistence trade-off.** Audit writes are buffered appends with no fsync
  per entry. They survive a process crash and a normal restart, but not an
  OS crash or power loss (the last few entries may be lost). Add fsync if
  that guarantee is ever needed.
