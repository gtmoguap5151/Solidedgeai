# Galinyx OS — executable prototype v0.1

A **standard-library-only Python runtime**, not a Linux replacement or finished commercial product.

Implemented:
- Versioned, dependency-free entity/task/event contract validators
- Manifest-based entity registration for extensible entity types
- Schema version tracking and a preservation-first legacy task-table migration
- Durable SQLite entity registry
- Per-entity memories
- Deny-by-default capability checks
- Append-only task audit events
- Idempotent task request IDs bound to action, entity and payload digest
- Creator and researcher entities sharing one runtime

No AI model calls, media generation, autonomous publishing, payment execution, real user authentication, or network endpoints. Review actions currently depend on entity capabilities and do not verify that a human reviewer is acting; this is a prototype workflow, not a production security boundary. `story.plan` currently records a successful task but **does not generate a story**. A permitted but unsupported action returns `not_implemented`.

## Run
```bash
python galinyx-os/demo.py
python -m unittest discover -s galinyx-os -p 'test_*.py' -v
```

## Security boundaries
This is a local proof of concept, **not production-secure**. The caller supplies entity IDs directly, so it is not a multi-tenant authentication boundary. Do not connect payment, posting, or privileged APIs until authentication, authorization, approval policies, secrets handling, and threat modeling are implemented.

## Contract and migration notes

`contracts.py` validates version-1 entity manifests, task envelopes, and event records. Contract validation checks shape and size; it does not authenticate callers or prove ownership. The runtime currently records schema version `4` through the ordered migration runner. Legacy task rows are preserved during migration, but their missing payload digest cannot be reconstructed; reusing those old request IDs is rejected rather than replayed.

## Next
Authenticated workload identity and human-approval provider integrations remain future work. The durable receipt foundation now atomically prepares scoped requests, consumes approvals once, and reserves budget; target dispatch and evidence-based reconciliation are still future work.

## Database compatibility
The prototype schema is under active development. Existing SQLite databases created before the payload-hash schema change are **not automatically migrated**. Use a fresh local test database for this experimental version; never delete production data to work around migration failures. The versioned migration runner is wired into runtime startup. Supported upgrades are covered by integration tests; back up existing databases before upgrading, and do not treat this prototype migration path as a substitute for production backup and recovery procedures.

## Local developer CLI

The standard-library CLI provides a small local workflow:

```bash
python galinyx-os/cli.py init --database galinyx.db
python galinyx-os/cli.py validate-manifest examples/application.json
python galinyx-os/cli.py create-entity examples/application.json --database galinyx.db
python galinyx-os/cli.py list-entities --database galinyx.db
python galinyx-os/cli.py inspect-entity ENTITY_ID --database galinyx.db
python galinyx-os/cli.py events ENTITY_ID --database galinyx.db
```

The CLI is for trusted local development. It is not a login system, network API, or multi-user security boundary. Do not expose it to untrusted users or connect privileged external tools.

## Credential-derived service facade (prototype seam)

`service.py` adds a narrow `GalinyxService` facade for creating agents,
executing agent tasks, reading memory, and inspecting an agent. Each operation
accepts a credential and asks an injected authenticator to resolve it to a
principal ID; callers do not pass principal IDs as operation arguments. The
facade then applies the persisted workspace authorization checks.

The repository includes only a deterministic test authenticator. It is a test
double, **not** a login system, password verifier, token validator, or production
identity provider. No real credentials are issued or validated. The service
facade is an architectural seam showing where authentication must connect.

This does not make the Python process a security sandbox: trusted code in the
same process can still access the underlying runtime or database. A deployed
service must keep those internals private to the service process, authenticate
credentials with a reviewed provider, protect secrets, enforce transport and
session security, and expose only the facade's authorized operations. The local
CLI and direct Runtime methods remain trusted developer interfaces.

## Runtime-enforced workspace ownership (prototype)

The runtime now persists local human-principal records, personal workspaces,
workspace memberships, and entity ownership in SQLite. Use
`register_human()`, `create_personal_workspace()`, and
`create_owned_entity()` to create the local test fixture. Use
`execute_as(principal_id, tenant_id, entity_id, ...)` as the protected
task-execution entry point; it checks active membership, resource ownership
within the selected tenant, and the caller's workspace role before invoking
the existing entity capability check.

**Important limitations:** these methods accept a principal ID as trusted local
context. They do not validate a password, session, token, or external identity
provider. The existing `execute()`, `create()`, and local inspection methods
remain trusted developer APIs and can bypass this workspace boundary if called
directly. Do not expose those methods through a network service. A future service
must authenticate the request, derive the principal ID server-side, and expose
only appropriately authorized operations. Organization tenants, cross-tenant
sharing, agent-to-agent delegation, and production concurrency guarantees are
not implemented.

Example local-only setup:

```python
runtime.register_human("human-001")
runtime.create_personal_workspace("personal-001", "human-001")
agent_id = runtime.create_owned_entity(
    "human-001", "personal-001", "Research Agent", "agent", ["memory.write"]
)
runtime.execute_as(
    "human-001", "personal-001", agent_id,
    "memory.write", {"key": "topic", "value": "renewable energy"}
)
```

## Identity and ownership policy foundation

`identity.py` contains a provider-neutral, in-memory policy model for human principals,
personal workspaces, membership roles, resource ownership, and fail-closed authorization
decisions. Its unit tests are in `test_identity.py`.

This is **not authentication** and is not a production security boundary. Principal IDs
must eventually be derived from validated credentials by a trusted service adapter.
The directory is in-memory only; its setup methods are trusted local hooks and must not
be exposed to untrusted callers. Passing these tests proves policy behavior for trusted
inputs, not credential validation, persistence, tenant isolation in a deployed service,
or production security.

Run the full suite, including identity policy tests, with:

```bash
python -m unittest discover -s galinyx-os -p 'test_*.py' -v
```

## Synthetic AHAF authority policy prototype

`authority.py` provides an isolated, standard-library policy harness for a
subset of the Agent Hierarchy & Authority Framework. It models ranks as
organizational metadata (not permissions), explicit grants, scoped delegation,
expiry, cumulative operating budgets, transaction ceilings, separate human
approval identity, revocation through a grant chain, and in-memory audit events.

Run its tests with the full suite:

```bash
python -m unittest discover -s galinyx-os -p 'test_*.py' -v
```

This is a synthetic policy model only. It is not integrated with the runtime,
does not authenticate humans or agents, does not cryptographically sign grants,
and does not persist policy or audit state. It is not a production security
boundary. See `architecture/GALINYX-AHAF-EXECUTABLE-AUTHORITY-MODEL-0001.md`
for scope and required validation gates.

## Versioned SQLite runtime migrations

`database_migrations.py` provides ordered migration versions, `BEGIN IMMEDIATE`
serialization, rollback on failure, and fail-closed handling of databases newer
than the supported migration set. `runtime_migrations.py` defines the current
core-runtime migration (version 1), workspace-identity migration (version 2), AHAF persistence migration (version 3), and durable execution receipt migration (version 4).
`Runtime.__init__` now applies these migrations before exposing the runtime.

Tests cover fresh upgrades, idempotent reopen, failed-migration rollback,
legacy task-table conversion, valid-row preservation, orphan-row archival,
version-1-to-version-4 upgrades, and future schema rejection.

**Important:** this is still a prototype persistence layer. The version-3 schema reserves persistent records for agent bindings, immutable
grants, revocations, budget reservations/ledger entries, approval records, and
hash-chained audit events. `authority_store.py` implements a narrow local store
for binding, root-grant issuance, attenuated delegation, revocation, atomic budget reservation/settlement,
and audit-chain verification. It does not authenticate the caller, enforce
agent actions, implement delegated grant issuance, or validate authenticated
human approvals. Back up databases before upgrading and retain independent
recovery copies.


## Governed mock execution and workload identity seam

`governed_execution.py` is a test-only integration harness that joins persisted
AHAF grants, a separate human approval authenticator, and a workload
authenticator before changing a fixed in-memory counter. The executor derives
the agent ID from the workload credential adapter and derives the tenant from
the persisted grant binding; caller-supplied agent and tenant IDs are not
accepted as identity proof.

The tests use deterministic credential maps only. This does **not** implement
production workload credential issuance, cryptographic verification, key
rotation/revocation, network authentication, or enforcement at a real external
target. The mock resource is not a production action adapter. Keep this module
inside the trusted local test boundary until those controls receive independent
engineering and security review.


## Durable governed execution receipt foundation (schema version 4)

\`execution_receipts.py\` provides a trusted-process service for preparing governed
executions. It binds a stable request ID to a canonical SHA-256 request digest,
checks the persisted grant and tenant/agent binding, enforces action/resource
scope, validates the exact human approval when required, consumes that approval
once, reserves the grant-chain budget, and writes the immutable receipt plus its
initial lifecycle event in one SQLite transaction. Replaying the exact request
returns the existing receipt; reusing its request ID with different content is
rejected. Receipt reads are tenant-scoped.

The version-4 migration adds immutable receipt identities, append-only receipt
events, unique approval-consumption records, and supporting indexes. The receipt
service can record dispatch intent, classify adapter outcomes, and reconcile
unknown outcomes using evidence. Confirmed success commits the reservation;
confirmed no-effect releases it; unknown and manual-review states keep the
reservation held. Human reconciliation resolution requires an active workspace
owner context. These are trusted-process APIs, not production credential
authentication or a real external action adapter. The module does not itself
dispatch actions or claim exactly-once effects at an external target.

Run the new receipt tests with the full unittest discovery command above.

## GALINYX Ventures — governed organization simulation

GALINYX Ventures is the first synthetic operating organization for the human-root / hybrid-governance model. The organization chart and deterministic policy decisions are in org_simulation.py. Receipt-backed simulation is in governed_org_simulation.py.

Run the end-to-end local demonstration:

```bash
python galinyx-os/ventures_governed_demo.py
```

The demonstration creates a disposable local tenant, persists executive workload bindings and scoped AHAF grants, and exercises:
- a permitted product-planning action that receives a durable execution receipt;
- a CEO proposal that is denied when no matching persisted grant exists;
- a high-impact policy activation denied without approval;
- the same policy activation after an exact, single-use human-owner approval;
- verification of the append-only AHAF audit hash chain.

The simulation adapter is synthetic and performs no external work. The injected actor-to-agent map and deterministic credentials are trusted local test/demo setup, not production identity. This environment is not a live company, production security boundary, or deployment.
