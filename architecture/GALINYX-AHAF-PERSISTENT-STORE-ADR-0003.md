# GALINYX AHAF — Persistent Record Store ADR 0003

**Status:** Experimental implementation; not a production authorization boundary  
**Depends on:** SQLite migration framework, AHAF policy prototype, runtime integration boundary ADR 0002  
**Implementation:** `galinyx-os/authority_store.py`  
**Schema:** Runtime migration version 3  
**Tests:** `galinyx-os/test_authority_store.py`

## Decision

Introduce a persistent record layer for a limited subset of AHAF without connecting it to task execution. This layer stores agent-to-workspace bindings, immutable root and delegated grants, revocations, budget reservations and settlement ledger entries, approval-record slots, and a hash-chained audit stream.

The store is a trusted local component. It is not exposed as a network API and does not establish identity merely because a caller supplies an ID.

## Record model

- **Agent binding:** binds an existing agent entity to a tenant, owner principal, and opaque external credential/key reference. The reference is metadata only; it is not a credential or secret. Binding records are append-only. Revocation is represented by a separate record.
- **Authority grant:** immutable root or delegated grant scoped to a subject agent, action set, resource set, expiry, integer budget limit and unit, optional transaction ceiling and unit, transaction actions, approval-required actions, delegable actions, delegation depth, and policy version.
- **Delegated grant issuance:** the current store can create an attenuated child grant that references a parent grant and bound delegator/delegate agent records. The method checks the grant relationship, shared workspace ownership, and attenuation constraints. **It does not authenticate the delegator agent's workload identity.** The current operation is therefore a trusted-local, owner-governed grant-writing capability—not yet autonomous or authenticated agent-to-agent delegation.
- **Grant revocation:** separate append-only record. A revoked ancestor makes descendant grants inactive when the chain is evaluated.
- **Budget reservation:** stable request-scoped reservation with integer units. `BEGIN IMMEDIATE` serializes reservation decisions across SQLite connections. A reserve entry is written against the selected grant and every ancestor, so parent limits include delegated spend across the full grant chain.
- **Budget ledger:** append-only `reserve`, `commit`, and `release` entries. A committed reservation remains consumed; a released reservation restores available budget. Request IDs make reserve retries idempotent and reject parameter changes.
- **Approval records:** schema slot for immutable, scope-bound approval evidence. No API accepts or validates approvals yet. A string approver ID is not proof of authentication.
- **Audit events:** append-only records linked by SHA-256 hashes over canonical event content and the prior event hash. This detects row alteration while the chain remains intact; it is not tamper-proof against an actor who can rewrite the database and recompute the entire chain. Production audit requires external anchoring or a separately protected log service.

## Units and accounting

Budget and transaction quantities are stored as nonnegative integers plus explicit unit codes such as `USD_CENT`, `COMPUTE_MS`, or `TASK`. Floating-point arithmetic is prohibited. All grants in a delegation chain must use the same budget unit before a reservation is accepted. Transaction units are stored separately from operating-budget units.

A reservation consumes available budget immediately. Commit converts reserved units into spent units without changing total consumption. Release removes the reservation from consumption. Each transition is atomic across the leaf grant and its ancestor chain. The store does not itself authorize the underlying action; the future enforcement layer must evaluate policy before reserving budget and must bind the reservation to the exact authorized action/resource/request.

## Implemented behavior

- Owner-checked local agent binding and root-grant issuance.
- Immutable grant and binding rows enforced by SQLite update/delete triggers.
- Owner-governed creation of attenuated delegated grants for bound agents. The implementation prevents broader action/resource scope, longer expiry, increased budget, weaker transaction ceilings, removal of inherited approval requirements, broader further-delegation rights, or increased delegation depth. Delegator workload authentication is not implemented.
- Append-only revocation records; revocation of an ancestor makes descendant grants inactive when the grant chain is checked.
- Grant-chain expiry and revocation checks for budget reservation eligibility.
- Atomic cumulative budget reservation, commit, and release using integer units.
- Idempotent reserve retry behavior and conflict rejection when a request ID is reused with different budget parameters.
- Cross-connection concurrency tests for competing reservations against shared grant budgets.
- Hash-chain verification with tamper-detection tests.

## Explicitly not implemented

- Production human or agent workload authentication.
- Cryptographic signing or verification of grants.
- Authenticated human approval creation, verification, expiry, or replay protection.
- Action/resource authorization or execution integration.
- A complete crash-recovery workflow for external side effects.
- Cross-host or distributed database coordination beyond the guarantees of the selected SQLite deployment.
- External audit anchoring, independent log storage, or key management.
- Agent self-promotion, self-granting, self-approval, autonomous policy changes, or unrestricted tool execution.

## Required next gates

1. Specify authenticated agent workload identity and bind it to the opaque key reference; do not treat the reference itself as proof of identity. Require authenticated agent identity and explicit delegation authority before allowing an agent to issue a delegated grant.
2. Implement approvals through an independent authenticated governance flow, scoped to request, action, resource, amount, and expiry.
3. Implement a fail-closed authorization decision interface that evaluates the complete grant chain against a server-resolved agent identity and an exact operation/resource context.
4. Define and test the authorize → reserve → execute → commit/release protocol, including idempotency, revocation races, and crash or external-side-effect recovery.
5. Prove all privileged execution paths independently enforce human/workspace authorization, AHAF policy, entity capability/input checks, and authenticated approval before side effects.
6. Add adversarial tests for delegation escalation, approval replay, revocation races, stale policy versions, concurrent reservations, and audit-chain recovery.
7. Obtain independent security review before exposing any privileged action to untrusted callers.

## Operational warning

Do not connect this store to autonomous execution or privileged external tools. It is a persistence prototype for review and further engineering, not a claim that GALINYX has production-grade agent governance.
