# GALINYX OS — Unified Architecture v0.1

Status: architecture proposal, not a working operating system. This is an application-layer runtime built on existing OS infrastructure, not a kernel.

## Core principle
One runtime for persistent, human-governed digital entities. Creator functionality is a first-party subsystem, not a second operating system.

## Kernel-equivalent services
- **Entity registry:** immutable entity IDs, human owner/controller, lifecycle, versioned manifests.
- **Capability security:** deny-by-default permissions for tools, files, network, posting and payments.
- **Memory:** scoped episodic and semantic records, provenance, export and deletion.
- **Execution:** job queues, durable state machines, timeouts, budgets, retries and idempotency.
- **Event bus:** typed events, audit log, replay, subscription and access control.
- **Resource accounting:** model tokens, compute, media generation, storage and monetary costs.
- **Human control:** approval gates, pause, revoke, kill switch and incident history.
- **Interoperability:** versioned APIs and adapters; no single-model dependency.

## Native Creator subsystem
- Character manifest: traits, creative constraints, disclosure and rights.
- Storyworld graph: continuity, relationships, narrative events.
- Studio pipeline: scripts, assets, editorial review, provenance.
- Distribution: official platform integrations only, subject to policy and account approval.
- Revenue: contracts, affiliate attribution, sponsorship, sales, payouts to eligible human/legal account holders.
- Optimization: retention and contribution margin, with experiment controls.

## Architecture boundaries
Core cannot assume entities are entertainers. Creator subsystem cannot bypass capability checks. No entity can initiate financial transfers or public publishing without delegated authority and configured approval policy. No promise of Meta monetization eligibility.

## MVP, zero paid infrastructure
1. Typed JSON entity manifests with validation.
2. Local durable SQLite event store and append-only audit log.
3. In-process task scheduler and capability-checking executor.
4. Creator plugin that maintains one character and a storyworld.
5. Offline tests for isolation, denied permissions, replay and approvals.
6. Demo interface showing entity creation, task history and simulated revenue ledger.

## Technical acceptance tests
- A creator and researcher entity coexist with distinct memories and permissions.
- Unauthorized publishing or spending fails closed.
- Jobs can be replayed idempotently without duplicate actions.
- Every media asset links to source inputs, license status and human approval.
- Cost and revenue are separated; hypothetical revenue never appears as actual cash.
- Export and deletion work for entity-owned data.

## Competitive truth
Agent orchestration frameworks and creator tools exist. Novelty is not established. We must benchmark interoperability, permission security, continuity and operating costs against established alternatives before any first-of-kind claims.
