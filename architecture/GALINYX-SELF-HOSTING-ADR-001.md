# GALINYX Self-Hosting Architecture Decision Record 001

**Date:** 2026-11-16  
**Status:** Accepted direction; implementation sequencing updated  
**Decision owners:** Founder / GALINYX architecture  
**Applies to:** GALINYX OS and all first-party GALINYX applications

## Decision

GALINYX will use GALINYX OS as its own native development and operating environment wherever the platform's verified capabilities support the work.

The platform is its own first customer. Governance Core, Creator, internal operator workflows, and future first-party applications should be built as native platform capabilities or applications consuming the same public contracts available to external developers.

We will not create a parallel privileged implementation of the platform's core capabilities solely to accelerate a first-party product.

## Why

GALINYX's purpose is to provide shared infrastructure for applications, organizations, services, and AI operators. If first-party products bypass that infrastructure, the platform will not prove its own architecture and may develop incompatible internal and external paths.

Self-hosting creates a practical conformance test:
- First-party applications use the same identity and authority semantics as external applications.
- Platform capabilities are tested through real workloads, not only diagrams.
- Defects in developer experience and integration become visible early.
- Shared contracts are validated against more than one application type.
- First-party convenience does not become a hidden privilege.

## Verified current baseline

The `galinyx-launch` branch documents and contains a standard-library Python runtime prototype with:
- Durable local SQLite entity registry.
- Per-entity memory records.
- Deny-by-default entity capability checks.
- Task records with idempotency keys bound to action/entity/payload digest.
- Entity-scoped event records.
- Creator and researcher entity types sharing one runtime.
- A deterministic offline Creator draft workflow.

The current runtime documentation explicitly says it is not production-secure. It does not provide real human authentication, production tenant isolation, network endpoints, external model calls, a production plugin sandbox, or authenticated human approval. Its local review capability is not proof of a human reviewer's identity.

The separate AHAF persistence and trusted-service branches contain additional prototypes. Their capabilities must be reconciled with the canonical runtime and branch stack before they are treated as integrated platform services.

## Architectural rule

A first-party GALINYX application must consume the same versioned public contracts, authorization interfaces, event formats, and enforcement points intended for external developers.

No first-party application may:
- Bypass identity or authorization checks.
- Treat a caller-supplied entity ID as authenticated identity.
- Use internal-only grants that external applications could not obtain under equivalent policy.
- Directly mutate protected records outside documented platform interfaces.
- Treat a model output or agent assertion as human approval.
- Claim a platform security property that has not been tested at the enforcement point.

Test fixtures and local development adapters may use synthetic identities and in-memory resources, but they must be isolated, explicitly labelled, and impossible to mistake for production identity or enforcement.

## Governance Core product placement

Governance Core is a native GALINYX OS platform service and an independently distributable product surface.

Its first-party implementation must be exercised by a first-party application running through the same public interfaces. The governance service may enforce platform invariants, but it must not grant first-party apps a bypass around those invariants.

The existing AHAF persistence work is a candidate implementation component, not automatically the final canonical storage architecture. It must be integrated through reviewed contracts and migrations rather than copied into a second database path.

## Development sequence

1. **Preserve and map:** retain the current `galinyx-launch` baseline and all useful engineering branches. Map runtime, identity, AHAF, persistence, trusted-service, and application contracts. No blind merge or history rewrite.
2. **Make the native development loop reproducible:** document clean setup, runtime invocation, test commands, fixtures, and local data lifecycle. Keep it offline and harmless.
3. **Define platform contracts:** version entity manifests, task envelopes/results, authority requests/decisions, approvals, permits, and audit events. Make the canonical runtime the consumer of these interfaces.
4. **Integrate governance into the runtime:** route protected task actions through a single authorization/enforcement seam. Keep identity authentication distinct from entity identity and capability declarations.
5. **Build a native first-party workload:** demonstrate one narrow governance-managed workflow inside GALINYX OS using the same interfaces intended for external applications.
6. **Prove parity:** run a second, independent sample application through the same contracts without first-party privilege.
7. **Expand only after evidence:** add network APIs, external identity federation, model adapters, plugin isolation, and external deployment profiles only after threat modelling and tests.

## Role of the current governed mock executor

The governed mock executor branch is a test harness for exercising existing AHAF persistence behavior. It is not the Governance Core product architecture and must not become a parallel runtime. Retain it as an isolated conformance fixture if its tests prove useful. Rework or retire any overlapping implementation after the canonical runtime integration seam is established.

## Acceptance criteria for self-hosting

- A clean checkout can run the canonical GALINYX runtime and its tests using documented steps.
- A first-party application registers and submits tasks through public, versioned platform contracts.
- A protected action is checked at the enforcement point, not only by a planner or UI.
- Human approval is backed by authenticated human identity and bound to the exact action and payload.
- Revocation blocks subsequent protected execution.
- A second, non-first-party sample uses the same contracts and receives no hidden bypass.
- Tenant/organization isolation and failure-closed behavior are covered by adversarial tests.
- All prototype limitations remain clearly documented.

## Consequences

This approach may require improving platform foundations before the Governance Core can be shipped as a standalone product. That is intentional. It reduces architectural duplication and makes GALINYX prove its own value.

Self-hosting is a development and conformance strategy, not a claim of full autonomous self-development. AI-assisted code changes still require authenticated authority, human review where policy requires it, tests, and explicit human control over merges and deployments.
