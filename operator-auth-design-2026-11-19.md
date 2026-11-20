# Signed Operator Authentication — Design (GALINYX Governance Core v1.4.0)

**Date:** 2026-11-19
**Ordered by:** Matt Johnson, on the 2026-11-19 voice call (~08:21 ET):
"We're still missing the signed in. Let's do it."
**Status:** Built and verified locally. **NOT pushed, NOT live.** No keys issued.
**Stress test:** 94 PASS / 0 FAIL / 8 FINDING (was 80 / 0 / 8; Section L adds 14 checks).

## The gap it closes

From the Core's own stress-test findings (K13): until this build, any process
could claim to be any operator, and owner identity was a claim
(`GALINYX_OWNER_ID`, default `'owner'`), not a credential. Approving a
notification recorded a YES but proved nothing about who said it.

This build adds **authentication**: a signed proof that the caller holds the
private key registered for the operator (or owner) it claims to be.

## What authentication is — and is not

**Authentication proves WHO. It does not grant WHAT.**

- A valid signature makes `authorize()` return `authenticated: true`. The
  operator's **mode** still decides whether the action is allowed. A validly
  signed publish attempt by a draft-only operator is still denied
  (stress test L14).
- All 21 operators stay **draft-only**. This build changes no mode, grants no
  publish or spend to anyone, and creates no publish mode. Auth is the
  prerequisite for a future mode step-up, not the step-up.
- Approving a notification still grants no permission. A signed YES is still
  just a recorded YES.

## The protocol (GALINYX-AUTH-V1)

- **Algorithm:** Ed25519, via `node:crypto` only. Zero third-party
  dependencies — the whole Core keeps that rule.
- **Key pair:** generated with `generateKeyPair(subject, label)`. Public key
  is base64 SPKI; private key is base64 PKCS8. Key IDs look like
  `key-tailor-operator-6a7256cd`.
- **Proof:** the caller signs a canonical message — a fixed template, not
  JSON, so the signed bytes are identical on every runtime:

  ```
  GALINYX-AUTH-V1
  subject:<operator-id or 'owner'>
  action:<action, e.g. 'write' | 'mode-change' | 'notification-decision'>
  timestamp:<ISO-8601 UTC>
  nonce:<32 lowercase hex chars, random per proof>
  context:<request id / notification id, or ''>
  ```

  The proof object carries those fields plus `keyId` and the base64
  signature.
- **Verification** (`verifyProof`) checks, in order: the protocol tag, the
  key is registered and active, the key belongs to the claimed subject, the
  timestamp is inside a **5-minute window** (both directions — expired and
  far-future proofs are rejected), the action and context match what was
  asked for, the signature verifies against the registered public key, and
  the nonce has never been seen before.
- **Replay protection:** a nonce is recorded only *after* a proof verifies
  fully — a failed attempt never burns a nonce, so an attacker cannot deny a
  legitimate proof by submitting a tampered copy of it first. Seen nonces
  live in memory plus an append-only file (`src/auth-nonces.jsonl`), so a
  restart cannot resurrect a used nonce.
- **Binding:** a proof is bound to its action (a read-proof cannot authorize
  a write, L10) and to its context (an owner proof for request A cannot
  approve request B, L11; a decision proof for one notification cannot decide
  another, L12).

## How it wires into the Core

- `authorize(operatorId, environment, action, proof?)` — the proof is an
  optional 4th argument. **No proof: behavior is exactly as before**
  (identity stays a claim, `authenticated: false`). A valid proof sets
  `authenticated: true` and `authKeyId`. A presented-but-invalid proof
  **denies the action** — presenting a bad credential is worse than
  presenting none. Audit entries carry `authenticated`, `authReason`, and
  `authKeyId`.
- `approveModeChange(operatorId, requestId, approver, approve, proof?)` —
  once an owner key is registered, a valid owner signature bound to the
  request is **required**; without one the approval is refused and the
  request stays pending. Until then the identity claim still works, and the
  audit entry flags `authenticated: false`.
- `decide(notificationId, decidedBy, approve, reason, proof?)` — the same
  rule for notification decisions, with the proof bound to the notification
  ID (`action: 'notification-decision'`, `context: <notificationId>`).
- `isOwnerKeyRegistered()` is the switch. The Core re-reads the key store
  from disk on every operation, so a key registered by the issue-key tool
  (or revoked by it) takes effect without a restart.
- `getAuditStats()` includes `ownerKeyRegistered`, so the dashboard can
  show whether signed approvals are in force.

## Issuing a key

### Operator key — exact steps (when Matt orders it)

Run from the `galinyx-governance` folder. One command per operator:

```sh
node governance-core/tools/issue-key.mjs issue <operator-id> --label "issued <date>, <reason>"
```

The tool: (1) checks the operator is registered, (2) generates an Ed25519
key pair, (3) registers the public key in `src/operator-keys.json`,
(4) saves the private key to
`governance-core/.keys-local/<keyId>.key` (0600). It prints the keyId, the
public key, and the private-key path — **never the private key itself**.

Verify it worked:

```sh
node governance-core/tools/issue-key.mjs list <operator-id>
node governance-core/tools/issue-key.mjs stats
```

Then run the stress test (`node governance-core/src/stress-test.mjs`) — it
must stay 0 FAIL. The live key store is untouched by the test suite: the
suite points the auth module at temp files (see "A mistake caught in
development" below).

### Owner key — Matt issues his own, in person

**The issue-key tool REFUSES owner keys on purpose.** Matt's real owner key
is issued later, by him, when he says so. The ceremony:

1. Matt says the word — no one else's say-so counts.
2. On a machine Matt controls, generate the owner keypair and register the
   public key (`subject: 'owner'`, `subjectType: 'owner'`) — the same
   `generateKeyPair` / `registerPublicKey` functions, run as a one-off.
3. The private key goes into `.keys-local/` (0600) **and into a backup Matt
   controls** (his password manager / a written copy he keeps). There is no
   recovery if it is lost: with an owner key registered, unsigned approvals
   stop working, and a lost owner key means no mode change and no
   notification decision can ever be approved again until the key is rotated
   — and rotation of the owner key itself requires the owner's say-so.
4. Verify: `issue-key.mjs stats` must show `owner key registered: YES`, and
   an unsigned `approveModeChange` must be refused (stress test L8 covers
   this behavior).

**A LOCAL TEST owner keypair already exists** (`owner-TEST-9ca81fee`,
in `.keys-local/`). It is clearly marked TEST, it is **not registered** in
`operator-keys.json`, and it authenticates nothing. It exists so the signing
path can be exercised without touching Matt's real key. It must never be
registered as the owner key.

## Storage

| What | Where | Safe to commit? |
| --- | --- | --- |
| Public keys | `governance-core/src/operator-keys.json` | **Yes** — public keys only |
| Private keys | `governance-core/.keys-local/<keyId>.key` (0600, dir 0700) | **NO — NEVER** |
| Seen nonces | `governance-core/src/auth-nonces.jsonl` | Yes (nonces are single-use random values, not secrets) |
| Key-store env overrides | `GALINYX_AUTH_KEYS_FILE`, `GALINYX_AUTH_NONCES_FILE`, `GALINYX_AUTH_KEYS_DIR` | n/a |

**SECURITY — THE REPO IS PUBLIC: private keys must NEVER be written to any
file that could be pushed, pasted into chat, emailed, or screenshotted.
They live ONLY in `.keys-local/`, which is in `.gitignore`. The issue-key
tool never prints a private key. The stress test never writes a private key
to disk. If a private key ever appears in a file outside `.keys-local/`,
revoke that key immediately and rotate.**

## Rotation and revocation

- **Revoke** (`issue-key.mjs revoke <keyId> --reason "..."`): the key stops
  verifying immediately. The entry stays in the store marked `revoked`, so
  the history is on the record. Revocation is permanent — there is no
  un-revoke; rotate instead. Delete the private-key file from `.keys-local/`
  when convenient — a revoked key is useless, but a deleted one cannot leak.
- **Rotate** (`issue-key.mjs rotate <operator-id>`): revokes every active
  key for that operator and registers a fresh one, saving the new private
  key to `.keys-local/`. Old proofs stop verifying; new proofs work
  (stress test L7).
- **When to rotate:** on any suspected compromise, when an operator's role
  changes hands, or on a schedule Matt sets. There is no automatic expiry
  in this build — rotation is a deliberate act.

## What changes for operators

**Nothing — until a mode step-up is ordered.**

- Operators without keys keep working exactly as they do today: their
  drafts are claims, judged on their content, and nothing publishes or
  spends without Matt's per-action approval.
- Operators with keys can attach proofs to their actions. A proof makes the
  audit log able to say "this really was the Tailor" instead of "someone
  claiming to be the Tailor". It changes no permission.
- The interaction layer (`interactions.mjs`) does not yet verify sender
  proofs — its entries still flag `senderVerified: false`. Wiring proofs
  into ASK/HANDOFF/NOTICE is follow-up work (see below).

## What remains of Phase 4

This build is the auth half of Phase 4. Still open:

1. **Rate limits** — cap authorize() calls per operator per window, so a
   runaway or hostile process cannot flood the audit log or hammer
   verification. (Ed25519 verify is fast, but the audit append is not free.)
2. **Error handling** — the auth paths fail closed today (a corrupt key
   store reads as empty, which means "no keys registered", which means the
   claim path — that is the safe direction for availability, but a corrupt
   store should also *alarm*, not just degrade silently).
3. **Backup / export** — a documented, tested procedure to back up
   `.keys-local/` and `operator-keys.json` together, and to restore them;
   plus a way to export the public-key store for an external audit without
   touching private material.
4. **Tamper-proof audit log** — hash-chained audit entries, so a rewritten
   log is detectable. (The auth work makes this more valuable, not less:
   signed approvals are only as trustworthy as the log that records them.)
5. **Proofs in the interaction layer** — let ASK/HANDOFF/NOTICE carry
   operator proofs, so `senderVerified` can become true.
6. **Owner-key ceremony tooling** — a guided, Matt-driven flow for issuing
   (and, if ever needed, rotating) the owner key, with backup verification
   built in.
7. **Nonce-store pruning** — the seen-nonce file grows by one line per
   verified proof; expired nonces (older than the 5-minute window) can be
   compacted. No pruning exists yet; the file is small today and this is
   housekeeping, not a blocker.

## A mistake caught in development (2026-11-19)

The first stress-test run used the wrong env-var name for the key store
(`GALINYX_OPERATOR_KEYS_FILE` instead of the real
`GALINYX_AUTH_KEYS_FILE`), so 15 test keys — including 4 ACTIVE test owner
keys — were written into the **live** `operator-keys.json`. With an owner
key registered, unsigned owner approvals stop working — and the test owner
private keys existed only in the dead test process's memory, so that would
have locked Matt out of approvals entirely.

Caught the same run (L9 failed: the claim path was refused because an owner
key was registered). The live store was restored to empty
(`{"keys":[],"version":1}`) and verified empty after every run since.

Two guards now prevent a repeat:

1. The stress test sets the correct env vars (`GALINYX_AUTH_KEYS_FILE`,
   `GALINYX_AUTH_NONCES_FILE`, `GALINYX_AUTH_KEYS_DIR`) at the top, before
   any Core import.
2. The test's `resetAuth()` helper **fails loudly** if the store clear is
   refused — a silent refusal is what let the leak go unnoticed. The clear
   itself refuses to run unless all three store paths are inside the OS
   temp dir.

Lesson for the record: the env-var names are `GALINYX_AUTH_*`, and any
future tooling that touches the key store must verify which store it is
pointing at before writing.

## Files

| File | Change |
| --- | --- |
| `governance-core/src/auth.mjs` | **New.** Ed25519 issuance, registration, sign/verify, revocation, rotation, owner approvals. |
| `governance-core/src/index.mjs` | Wired: `authorize()` accepts a proof; `approveModeChange()` requires a signed owner approval once a key is registered; `CORE_VERSION` 1.3.0 → **1.4.0**. |
| `governance-core/src/notifications.mjs` | `decide()` requires a signed owner approval once a key is registered; layer version 1.4.0. |
| `governance-core/src/stress-test.mjs` | Section L (14 checks); I1 now allows first-party relative imports; K13 updated; import checks now catch multi-line imports. |
| `governance-core/src/operator-keys.json` | **New.** The public-key store. Ships empty. |
| `governance-core/.keys-local/` | **New, gitignored.** Holds only the LOCAL TEST owner keypair + README. |
| `governance-core/tools/issue-key.mjs` | **New.** The operator key tool (issue / revoke / rotate / list / stats). |
| `governance-core/README.md` | Version 1.4.0; auth files, modes, env vars, honest limits updated. |
| `galinyx-site/operator-dashboard/core-snapshot.json` | Re-exported locally: coreVersion 1.4.0, 21 operators, all draft-only. |
| `governance-core/src/operators.json` | **Untouched.** No mode, environment, or statusNote changed. |
| `governance-core/staging/`, `governance-core/src/audit-log.jsonl` | **Untouched by this build** (the Tailor's 10-design build was writing there concurrently). |

## Verification

- `node governance-core/src/stress-test.mjs` → **94 PASS / 0 FAIL / 8 FINDING**.
- Live key store empty after every run (`{"keys":[],"version":1}`).
- `issue-key.mjs` exercised end-to-end against a temp store: issue, list,
  rotate, revoke, stats; owner issuance refused; unknown operator refused.
- All 21 operators still draft-only (registry + re-exported snapshot).
- No private key material outside `.keys-local/` (only the TEST owner
  keypair, 0600, dir 0700).
