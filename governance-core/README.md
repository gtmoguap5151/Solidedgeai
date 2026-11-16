# GALINYX Governance Core v1.0 — Foundational Runtime

This directory contains the first executable, dependency-free governance domain core.

## Scope

The core evaluates proposed decisions against explicit policy. It separates:

- **Rank / office:** the organizational role held (for example, Secretary).
- **Level:** the demonstrated scope or complexity level an actor is authorized to handle.
- **Permission:** the specific action an actor may perform.
- **Authority:** the human-granted mandate that permits a decision or approval.

A title does not automatically confer every permission. A higher level does not silently override policy. Rank and level are separate fields and are evaluated separately.

## Non-negotiable design constraints

1. Human beings retain ultimate authority. An AI or automated system may prepare recommendations but cannot finalize, approve, or override a decision.
2. The core fails closed when identity, authority, permission, level, required approvals, or conflict checks are missing.
3. The requester cannot approve their own decision.
4. Required approvals must come from distinct, eligible human actors.
5. A human override requires an explicit reason and is recorded as a separate event; it does not erase the original evaluation.
6. Delegation is single-hop, permission-bounded, exact-scope, time-limited, revocable, and auditable. Delegators cannot grant permissions they do not hold. Reserved authority such as governance override, further delegation, and Blackpine owner approval is non-delegable.
7. Delegated permissions do not transfer the delegator's identity, rank, level, or accountability. The delegate remains the acting human and must independently satisfy the policy's level, conflict, evidence, and separation-of-duties checks.
6. Audit events are hash-linked to make accidental or unauthorized alteration detectable when the chain is retained. This is **not** immutable storage or a security guarantee. Production requires protected persistence, access controls, backups, and independent verification.
7. The core does not connect to Blackpine Field, external APIs, or production data in this milestone.

## Files

- `src/index.mjs` — policy evaluation, decision lifecycle, and scoped delegation functions.
- `adapters/blackpine/policies.mjs` — Blackpine-specific decision and evidence policies.
- `adapters/blackpine/README.md` — read-only integration boundary and operating rules.
- `test/governance.test.mjs` — Node built-in tests for core invariants and Blackpine scenarios.

## Run tests

Requires Node.js 18 or later:

```sh
node --test governance-core/test/governance.test.mjs
```

No dependencies or secrets are required.

## Current limitations / next gates

This is a foundational domain engine, not a complete enterprise governance product. It has no authentication, database, multi-tenant isolation, UI, network service, key management, durable audit storage, or Blackpine integration. The in-memory audit ledger and delegation registry are suitable for tests only. Do not use it to make live business decisions.

Before integration, add:
- authenticated identity and verified human/agent principals;
- durable delegation records, authenticated revocation, and policy-controlled delegation limits;
- tenant and project boundaries;
- durable append-only audit storage with independently controlled retention;
- signed policy versions and approval records;
- authorization tests against real deployment boundaries;
- a read-only Blackpine adapter and isolated test dataset.
