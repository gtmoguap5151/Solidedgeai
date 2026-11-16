# GALINYX Governance Core v1.0 — Foundational Runtime

This directory contains the first executable, dependency-free governance domain core.

## Scope

The core evaluates proposed decisions against explicit policy. It separates:

- **Rank / office:** the organizational role held (for example, Secretary).
- **Level:** the demonstrated scope or complexity an actor is authorized to handle within a named competency domain (for example, editorial, product evidence, release management, or financial controls).
- **Permission:** the specific action an actor may perform.
- **Authority:** the human-granted mandate that permits a decision or approval.

A title does not automatically confer every permission. A higher level does not silently override policy. Rank and level are separate fields and are evaluated separately. Where a policy declares a `levelDomain`, the actor must hold that domain's level in `levels[domain]`; a high general level cannot substitute for a low or missing domain-specific level. A legacy `level` is accepted only by policies that do not declare a domain.

## Non-negotiable design constraints

1. Human beings retain ultimate authority. An AI or automated system may prepare recommendations but cannot finalize, approve, or override a decision.
2. Verified principals receive permissions and competency levels from authority records, not caller-supplied permission arrays. Permission grants and competency credentials are scoped, time-limited, revocable, and audited.
3. The core fails closed when identity, authority, permission, domain-specific level, required approvals, or conflict checks are missing. Approval and rejection are bound to the complete policy digest, ID, and version used when the decision was created.
4. The requester cannot approve their own decision.
5. Required approvals must come from distinct, eligible human actors.
6. Decision state is held behind immutable handles; callers receive snapshots, not writable approval arrays or status fields. Only governance operations can mutate the internal decision state.
7. A human override requires an explicit reason and is recorded as a separate event; it does not erase the original evaluation.
8. Delegation is single-hop, permission-bounded, exact-scope, time-limited, revocable, and auditable. Delegators cannot grant permissions they do not hold. Reserved authority such as governance override, further delegation, and Blackpine owner approval is non-delegable.
9. Delegated permissions do not transfer the delegator's identity, rank, level, or accountability. The delegate remains the acting human and must independently satisfy the policy's domain-specific level, conflict, evidence, and separation-of-duties checks.
10. Audit events are hash-linked to make accidental or unauthorized alteration detectable when the chain is retained. This is **not** immutable storage or a security guarantee. Production requires protected persistence, access controls, backups, and independent verification.
11. The core does not connect to Blackpine Field, external APIs, or production data in this milestone.

## Files

- `src/index.mjs` — policy evaluation, decision lifecycle, and scoped delegation functions.
- `src/authority-registry.mjs` — in-memory verified-principal, permission-grant, and competency-credential registry with expiry and revocation.
- `adapters/blackpine/policies.mjs` — Blackpine-specific decision and evidence policies.
- `adapters/blackpine/repository-reader.mjs` — allowlisted, read-only GitHub snapshot reader with Git blob integrity checks; returns evidence references and observations, not raw repository file contents.
- `adapters/blackpine/check-live.mjs` — live, read-only snapshot and full decision-lifecycle check used by CI after the unit tests.
- `adapters/blackpine/README.md` — read-only integration boundary and operating rules.
- `test/governance.test.mjs` — Node built-in tests for core invariants and Blackpine scenarios.

## Run tests

Requires Node.js 18 or later:

```sh
node --test governance-core/test/governance.test.mjs
```

No dependencies or secrets are required.

## Current limitations / next gates

This is a foundational domain engine, not a complete enterprise governance product. It has no authentication, database, multi-tenant isolation, UI, network service, key management, durable audit storage, or Blackpine integration. The in-memory audit ledger, delegation registry, and authority registry are suitable for tests only. The authority registry trusts a verified identity assertion from an external authentication adapter; it does not authenticate people. Production requires a real identity provider, durable permission/competency records, tenant isolation, protected audit storage, and independent verification. The Blackpine reader is read-only and inspects selected public repository files; it does not inspect external affiliate accounts, authenticate source claims, or change the live storefront. Do not use it to make live business decisions.

Before integration, add:
- authenticated identity and verified human/agent principals;
- durable delegation records, authenticated revocation, and policy-controlled delegation limits;
- tenant and project boundaries;
- durable append-only audit storage with independently controlled retention;
- signed policy versions and approval records;
- authorization tests against real deployment boundaries;
- a read-only Blackpine adapter and isolated test dataset.
