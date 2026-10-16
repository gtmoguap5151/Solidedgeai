# GALINYX OS — Developer Platform Roadmap

Status: working engineering plan for the `galinyx-launch` branch. This is not a claim that the listed future capabilities exist.

## Product definition

GALINYX OS is an application-layer runtime and developer platform for building AI-powered entities and applications with consistent identity, persistence, capability authorization, execution lifecycle, observability, and human control.

It does not replace a computer's operating system or a model provider. It should work above existing infrastructure and support multiple model providers through explicit adapters.

## Primary developer promise

A developer should be able to define an entity, grant narrowly scoped capabilities, submit a task, inspect its events and resource use, pause or revoke it, and export or delete its data without rebuilding those controls for every application.

The native Creator subsystem is the first reference application. It must consume the same public runtime interfaces as other plugins; it must not receive privileged shortcuts.

## Core platform contracts

These are target interfaces, not implemented public APIs yet:

- **Entity manifest:** stable ID; schema version; display name; declared capabilities; data scope; lifecycle state; optional adapter configuration. Secrets must be references to a secret manager, never inline manifest values.
- **Capability policy:** deny by default; action/resource/scope matching; explicit policy version; decision reason; revocation taking effect before the next protected action.
- **Task envelope:** task ID; entity ID; action; validated input; idempotency key; creation time; deadline; resource budget; policy version.
- **Task result:** status; structured output or safe error code; start/end timestamps; retry metadata; resource accounting; event references. Do not leak secrets or raw sensitive provider errors.
- **Event record:** stable event ID; timestamp; actor; entity/task references; event type; policy version; correlation ID; integrity metadata. “Append-only” is an application property until tamper resistance and external retention are designed and tested.
- **Memory record:** owner scope; key; schema/version; value; source/provenance; created/updated times; retention and deletion status. Cross-entity reads must fail closed.
- **Plugin adapter:** declared inputs/outputs, required capabilities, timeout, retry safety, data handling, provider dependencies, and test contract.
- **Human approval:** authenticated reviewer identity, requested action, exact content/target, policy decision, decision timestamp, expiry, and one-time binding to the action approved. An entity capability alone must never impersonate a human approval.

## Staged delivery

### Stage 0 — Establish trustworthy baseline
- Preserve the existing Solid Edge AI site and production branch.
- Make the test workflow reliable and inspect actual run results.
- Keep the runtime offline and standard-library-only until security boundaries are testable.
- Document current limitations and prohibit production credentials.

**Exit gate:** test suite and demo pass in CI; clean install/run instructions work; no unsupported claim of production readiness.

### Stage 1 — Define and validate contracts
- Add versioned JSON schemas for entity manifests, task envelopes, task results, and event records.
- Reject unknown or malformed fields where appropriate; cap payload size and nesting/depth to prevent resource abuse.
- Define stable error codes and a versioning/compatibility policy.
- Add schema fixtures for valid and invalid inputs.

**Exit gate:** schema validation tests cover malformed types, oversized inputs, unsupported versions, and backwards-compatibility expectations.

### Stage 2 — Make the runtime safely extensible
- Add a versioned SQLite migration mechanism with backups and rollback/recovery guidance.
- Add a plugin registry that only loads explicitly registered adapters.
- Centralize authorization so every protected operation checks entity state, owner scope, capability, and policy version.
- Add task deadlines, bounded retries, cancellation, and per-task resource limits.
- Ensure idempotency behavior is defined under concurrent requests and tested with multiple database connections.

**Exit gate:** concurrent tests, migration tests, revocation tests, isolation tests, and negative authorization tests pass.

### Stage 3 — Add developer ergonomics
- Provide a small Python SDK around stable runtime interfaces.
- Add a CLI for local initialization, validation, demo execution, event inspection, and export/deletion.
- Publish runnable examples and API reference documentation.
- Add structured logs and diagnostics with secret redaction.

**Exit gate:** a new developer can follow the quickstart from a clean checkout and complete a sample task without undocumented setup.

### Stage 4 — Human identity and controlled integrations
- Introduce authenticated users and explicit ownership/tenant boundaries.
- Keep authorization distinct from authentication; a valid login does not imply permission to act.
- Implement approval records bound to exact action, content, target, and expiry.
- Add external-model and tool adapters behind opt-in capabilities, timeouts, quotas, and audit events.
- Keep public publishing, financial transfers, and destructive actions disabled until reviewed separately.

**Exit gate:** threat model, abuse cases, secret handling, privacy/data-retention review, and integration-specific tests approved before any external action is enabled.

### Stage 5 — Measure whether it deserves to be a platform
- Build Creator as a first-party plugin and one independent non-Creator example.
- Benchmark setup time, failure recovery, authorization coverage, state isolation, task latency, and cost accounting.
- Compare against relevant agent frameworks and workflow runtimes using the same tasks.
- Interview developers and test whether they will repeatedly use the shared runtime.

**Exit gate:** evidence of a real developer problem, repeatable advantage, and willingness to adopt. Do not claim a moat or first-of-kind status without comparative evidence.

## Security and reliability release blockers

- No multi-tenant claims until identity, ownership, isolation, and authorization are tested.
- No production secrets, payments, public posting, or destructive tool access in the current local prototype.
- No trust in self-reported rights evidence without an explicit verification process.
- No claim of tamper-proof audit logs until integrity, retention, and privileged-administrator threat cases are addressed.
- No autonomous retry for non-idempotent side effects unless the adapter defines safe deduplication or reconciliation.
- No telemetry that silently exports prompts, memory, identifiers, or customer data.
- Provide data export and deletion semantics, including backups and retention exceptions.
- Pin or review third-party actions; never grant broad repository or cloud permissions by default.

## Immediate next engineering priorities

1. Verify the current test workflow and obtain a real green run; a missing status is not a pass.
2. Inspect and run the full current test suite locally or in CI before changing behavior.
3. Add versioned schemas and strict validation as the first new public contract.
4. Implement database migrations before extending persistent data structures.
5. Only then introduce the developer SDK and plugin interface.

## Truthful status vocabulary

- **Implemented:** code exists on the branch.
- **Tested:** a named test was executed and its result is recorded.
- **Validated:** defined acceptance criteria have evidence.
- **Deployed:** the exact build is reachable in the intended environment.
- **Production-ready:** security, reliability, operational, privacy, and support gates have been met.

These terms are not interchangeable.
