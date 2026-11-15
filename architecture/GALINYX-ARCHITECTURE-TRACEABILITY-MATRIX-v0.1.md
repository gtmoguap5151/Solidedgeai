# GALINYX — Architecture Traceability Matrix

**Version:** 0.1  
**Date:** 2026-11-15  
**Status:** Initial source-inspection baseline; not a test report, security audit, or claim of production readiness  
**Architecture baseline:** `architecture/GALINYX-MASTER-SYSTEM-ARCHITECTURE-v1.0.md`  
**Implementation baseline:** `galinyx-core-contracts` branch, `galinyx-os/`  
**Purpose:** Connect the ecosystem architecture to existing code, observable behavior, missing implementation, and proof required before release.

---

## 1. How to read this matrix

- **Present** means source code or tests visibly implement a limited capability. It does not mean production-ready.
- **Partial** means a narrow prototype behavior exists, but important architecture requirements are absent.
- **Proposed** means documented as a design, not implemented.
- **Not present** means no implementation was established by this source inspection.
- **Not verified** means this review did not execute the relevant tests or independently validate behavior.

This is a source-inspection baseline. The files were inspected on branch `galinyx-core-contracts`; the architecture and planning documents were inspected on `galinyx-launch`. These are separate branches. No merge is implied.

## 2. Executive assessment

The current executable asset is a small, local Python/SQLite runtime. It has useful foundations: versioned input contracts, entity registration, per-entity memory, capability-gated local task handling, task idempotency, event records, and a deterministic creator workflow.

It is **not** yet the shared operating infrastructure described by the master architecture. It has no verified human identity, tenant boundary, network service, real AI model execution, external tool integration, robust policy administration, or production-grade audit/security controls.

The next engineering priority is not adding more ecosystem features. It is to make the existing core's boundaries explicit, testable, and trustworthy before exposing it to untrusted users or external systems.

## 2.1 CI baseline evidence (verified)

The existing GitHub Actions workflow was inspected and its completed run was retrieved for the exact pull-request merge commit associated with PR #4.

- **Workflow:** Galinyx OS Tests
- **Run number:** 106
- **Run ID:** `43682157436`
- **Checked-out merge commit:** `44e86b04dd8339836be80631acc5a9634d647704`
- **PR head commit:** `091821605ebd1f1eb9e825dd3b7fdbcef3829cb1`
- **Environment:** GitHub-hosted Ubuntu 24.04; CPython 3.12.16
- **Unit tests:** 34 run; 34 passed; 0 failed
- **Demo smoke test:** completed successfully
- **Workflow conclusion:** success

This is real CI evidence for the PR merge commit at that point in time. It is not a fresh rerun initiated during this review, does not prove the current `galinyx-launch` branch contains the same code, and does not establish production security. The demo output also confirms that `story.plan` returns a completed task record while the creator implementation remains a deterministic offline template—not an AI story-generation system.

## 3. Traceability matrix

| Architecture capability | Current evidence | Status | Gap / risk | Proof required |
|---|---|---|---|---|
| Versioned entity contracts | `galinyx-os/contracts.py`; manifest validation in `runtime.py` | Present, narrow | Schema v1 only; shape validation does not prove identity, ownership, or authority | Contract tests for valid/invalid manifests, version compatibility, unknown fields, and size limits |
| Entity registry | SQLite `entities` table; `Runtime.create`, `create_from_manifest`, `list_entities` | Present, local | Caller controls local workflow; no tenant/owner model | Persistence, uniqueness, ownership and isolation tests |
| Entity types / extensibility | Allowed kinds include agent, organization, application, service, avatar, world, project | Partial | Type labels exist; domain-specific lifecycle and relationships are not implemented | Requirements and contract tests for each supported entity kind |
| Per-entity memory | SQLite `memories`; `remember` / memory write path | Present, local | No human/user ownership, retention, deletion, encryption, or cross-tenant guarantees | Isolation, deletion, retention, access-control and data-protection tests |
| Task envelope contract | `validate_task_envelope` in `contracts.py` | Present, narrow | Contract validator is not shown to be the single enforced ingress path for all execution | Prove all task ingress paths validate; reject malformed, expired and over-budget envelopes |
| Task execution | `Runtime.execute` | Partial | Local deterministic action dispatcher; no general scheduler, worker pool, or model execution | State-machine tests, failure/retry behavior, cancellation, concurrency and timeout tests |
| Capability checks | Deny-by-default action capability mapping in runtime | Present, narrow | Capabilities can be assigned at entity creation; no authenticated policy administrator or contextual policy engine | Negative tests for privilege escalation, unknown actions, policy changes and ownership |
| Agent identity | Entity IDs represent local runtime entities | Partial | IDs are not authenticated agent credentials; caller-supplied IDs are not identity proof | Cryptographic/workload identity design and spoofing/replay tests |
| Human identity and accounts | None established in inspected prototype | Not present | No login, account verification, session or identity provider | Select identity model; implement authentication and account lifecycle before multi-user access |
| Organization / tenant boundaries | Entity kind includes organization | Not present as a security boundary | No tenant ownership model or cross-tenant authorization | Tenant isolation threat model and adversarial cross-tenant tests |
| Rank, role and hierarchy | AHAF document on `galinyx-launch` | Proposed | Rank/role/permission/budget/delegation not implemented in runtime | Convert AHAF invariants into requirement IDs and executable tests |
| Delegation and approval | Creator review workflow; AHAF concept; prior-art research document | Partial / proposed | Reviewer identity is not authenticated; no general delegation chain, revocation or approval authority service | Authenticated approver tests, delegation attenuation/revocation tests, expiry and replay tests |
| Resource budgets | Task contract accepts optional budget fields | Partial | Contract shape only; no metering, enforcement, quotas, rate limits or cost ceilings | Demonstrate hard enforcement for steps, tokens, duration, and cost; test bypass attempts |
| Task idempotency | Request ID plus action/entity/payload digest in runtime | Present, local | Check-then-insert/concurrency limitations identified in security register | Concurrent duplicate-request tests with transactional uniqueness and deterministic outcomes |
| Event / audit records | SQLite `events`; task event recording; event contract | Partial | Append-only by convention, not tamper-evident, access-controlled or independently attributable | Tamper, deletion, actor attribution, ordering, retention and audit-export tests |
| Creator workflow | `creator.py`; creator draft and rights/review actions | Present, deterministic | Template output, not AI generation; rights status is metadata, not documentary proof; approval is not human-authenticated | Rights evidence model, reviewer identity, approval separation and output provenance tests |
| Storyworld / simulation data | SQLite `storyworlds` and `assets` tables | Partial | Basic persistence only; no simulation engine, world runtime or avatar interaction | Define world-state model, deterministic replay and isolation requirements |
| External tools / integrations | None established | Not present | No MCP/A2A/API connector or secrets boundary | Integration threat model, scoped credentials, tool-output trust tests and protocol conformance |
| AI model execution | README explicitly says no AI model calls | Not present | Current output is deterministic/offline | Provider abstraction, prompt-injection threat model, evaluation suite, privacy and cost controls |
| Application / developer ecosystem | Manifest and application entity kind | Proposed / partial | No SDK, app registry, distribution, install lifecycle or developer permissions | Developer API contract, package trust, versioning and app isolation tests |
| Creator economy / payments | README says no payment execution | Not present | No ledger, payout, tax, fraud or dispute controls | Separate economic architecture and legal/security review before money movement |
| Public network/API access | README says no network endpoints; CLI trusted-local only | Not present | Unsafe to expose current local runtime to untrusted callers | Authenticated service boundary, API abuse tests, deployment hardening and independent review |
| Privacy / data governance | Risks documented in `SECURITY-READINESS.md` | Proposed controls | No retention/deletion, encryption at app layer, backup or incident response controls | Data inventory, lifecycle policy, deletion verification, backup restore and incident exercises |
| Observability / operations | Local events and CLI inspection | Partial | No production telemetry, alerting, service health, operator access controls or incident workflow | Operational SLOs, structured logs, metrics, alerts and runbooks |
| Simulation / virtual worlds / avatars | Entity kinds and storyworld tables only | Future / partial foundation | No full simulation, avatar, spatial or multi-user world system | Keep as future architecture until a concrete use case and requirements justify implementation |

## 4. Existing implementation inventory

The following source files were inspected on `galinyx-core-contracts`:

| File | Observed responsibility |
|---|---|
| `galinyx-os/README.md` | Scope and explicit prototype limitations |
| `galinyx-os/contracts.py` | Version-1 entity, task-envelope and event-record validators |
| `galinyx-os/runtime.py` | SQLite runtime, entity creation, memory, task execution, idempotency and event recording |
| `galinyx-os/creator.py` | Deterministic offline scene-outline generation |
| `galinyx-os/SECURITY-READINESS.md` | Security/legal risk register and release gates |
| `galinyx-os/test_runtime.py` | Local runtime, isolation, idempotency, creator and persistence tests |
| `galinyx-os/test_security.py` | Unsupported action denial and request-ID collision regression tests |
| `galinyx-os/test_limits.py` | Payload size, identifier length, non-finite number and invalid-input tests |
| `galinyx-os/test_migrations.py` | Legacy task-row preservation and replay rejection |

Other test files exist in the prototype directory, but this first pass did not inspect every test file or execute the suite. Do not interpret this inventory as exhaustive.

## 5. Priority engineering sequence

The order below is a proposed dependency order, not a promise that every future ecosystem feature must be built.

### P0 — Establish a reproducible baseline
1. Record the exact source commit for `galinyx-core-contracts` and `galinyx-launch`.
2. Run the documented unit-test command in a clean environment and record the full result.
3. Record Python version, database setup, test count, failures, and warnings.
4. Confirm CI runs the same tests and that the result is reproducible.

**Exit condition:** A known source revision has a reproducible, recorded test result. No security claim is inferred from a green unit-test suite.

### P1 — Define identity, ownership and tenant boundaries
1. Define principal types: human, organization, agent, application and service.
2. Define who owns each entity and how ownership is verified.
3. Define tenant isolation and cross-tenant access rules.
4. Define authenticated actor attribution for every protected action.

**Exit condition:** Threat model and negative tests show that a caller cannot impersonate an entity, owner, tenant or reviewer by supplying an identifier.

### P2 — Make authority enforceable
1. Convert AHAF into stable requirement IDs.
2. Separate rank, role, permission, resource budget and delegation authority in data contracts.
3. Define policy evaluation and policy administration.
4. Add approval, expiry, revocation and delegation-chain rules.
5. Fail closed when identity, policy or approval evidence is missing.

**Exit condition:** Automated adversarial tests demonstrate that authority cannot be widened through rank, delegation, replay, stale policy or malformed inputs.

### P3 — Harden runtime and records
1. Replace unsafe concurrent idempotency behavior with transactional guarantees.
2. Define migration compatibility and backup/restore behavior.
3. Add retention/deletion and encryption design.
4. Strengthen audit integrity and authenticated actor attribution.
5. Add quotas, rate limits, timeouts and cost ceilings.

**Exit condition:** Concurrency, migration, audit, data lifecycle and resource-limit tests pass against documented requirements.

### P4 — Add controlled integrations and AI execution
1. Design a trusted service/API boundary before network exposure.
2. Add provider-neutral model interfaces and explicit data-sharing controls.
3. Treat tool output and retrieved content as untrusted input.
4. Add scoped connector credentials, approval gates and protocol-specific tests.
5. Evaluate MCP/A2A and existing standards rather than inventing replacements by default.

**Exit condition:** Each external action has an authenticated actor, policy decision, bounded resources, approval path where required, and attributable audit record.

### P5 — Expand the ecosystem
Only after the core gates are met, prioritize application/developer onboarding, creator workflows, distribution, monetization, simulation and virtual experiences based on validated user demand and technical readiness.

**Exit condition:** Each new subsystem has a concrete use case, owner, interface contract, risk assessment, acceptance tests and operating-cost model.

## 6. Immediate test and evidence backlog

| ID | Requirement to prove | Minimum negative test |
|---|---|---|
| ID-01 | Entity identity is authenticated | Forged entity ID cannot act as another entity |
| TEN-01 | Tenant boundaries are enforced | Tenant A cannot read or mutate Tenant B data |
| OWN-01 | Ownership is verified | Caller cannot create or claim an entity under another owner |
| AUTH-01 | Rank does not grant permission | Promote rank without changing permission; protected action remains denied |
| AUTH-02 | Delegation cannot widen authority | Child agent requests a permission absent from parent grant |
| AUTH-03 | Revocation takes effect | Reuse a revoked grant and verify denial |
| AUTH-04 | Approval is attributable | Unauthenticated or unauthorized reviewer cannot approve |
| BUD-01 | Budgets are enforced, not merely parsed | Exceed each budget dimension and verify execution is stopped |
| IDEM-01 | Idempotency is concurrency-safe | Submit same request concurrently; exactly one side effect occurs |
| AUD-01 | Audit actor attribution is trustworthy | Caller cannot write an event naming a different actor |
| AUD-02 | Audit history is protected | Attempt to alter or delete prior event and verify detection/prevention |
| DATA-01 | Deletion policy is real | Delete an authorized record and verify defined copies/derived data are handled |
| TOOL-01 | External tool calls are bounded | Tool call outside grant, target or argument constraints is denied |
| AI-01 | Prompt injection cannot override policy | Malicious tool output cannot grant permissions or bypass approvals |

These are requirements, not claims that the tests have been written or passed.

## 7. Scope boundaries

The current prototype is not:
- a production operating system or Linux replacement;
- a hosted multi-user platform;
- a secure agent identity or delegation service;
- an autonomous AI workforce;
- a payment, compensation or creator-payout system;
- an AI content-generation engine;
- a security certification or independently audited product.

The broader GALINYX architecture may eventually include these capabilities, but each requires separate design, implementation and evidence.

## 8. Key decisions still open

1. What is the authoritative principal identity model: external identity provider, GALINYX-managed identity, workload identity, or a combination?
2. What is the tenant model: individual-first, organization-first, or both?
3. Which authority policy model best fits the product: RBAC, ABAC, capability-based controls, relationship-based controls, or a carefully bounded combination?
4. Which event records must be immutable, cryptographically verifiable, exportable or independently retained?
5. What are the first two real user workflows that justify the core platform?
6. Which components should be open standards, open source, proprietary services or replaceable adapters?

Do not resolve these by preference alone. Use concrete workflows, prior art, threat models and tests.

## 9. Beginner's guide: architecture versus implementation

- **Architecture** is the plan for how the whole system is organized and how its parts should work together.
- **Implementation** is the actual code that performs those jobs.
- **Traceability** is the link between each planned capability, the code intended to provide it, and the test that proves it.
- **A test passing** proves only the behavior that test actually checks. It does not prove the entire platform is secure or complete.

Construction analogy: the master architecture is the site plan; the source code is the work installed on site; the tests and inspections are evidence that specific installed work meets its requirements. A drawing is not a completed building, and a passed inspection of one room is not approval of the entire structure.

## 10. Review rule

Every new GALINYX feature should be assigned:
1. an architecture layer;
2. a requirement ID;
3. an implementation owner/module;
4. dependencies and threat considerations;
5. acceptance and negative tests;
6. a status backed by evidence.

If a feature cannot be mapped to the architecture or justified as a deliberate architecture change, pause before adding it.

**Bottom line:** GALINYX has a meaningful local prototype and a broad target architecture. The next job is to close the trust, identity, authority and runtime gaps in a measured order—not to pretend the full ecosystem already exists.
