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

`contracts.py` validates version-1 entity manifests, task envelopes, and event records. Contract validation checks shape and size; it does not authenticate callers or prove ownership. The runtime records schema version `1`. Legacy task rows are preserved during migration, but their missing payload digest cannot be reconstructed; reusing those old request IDs is rejected rather than replayed.

## Next
Typed entity manifests, authenticated user ownership, storyworld persistence, approval queues, resource metering, and creator subsystem adapters.

## Database compatibility
The prototype schema is under active development. Existing SQLite databases created before the payload-hash schema change are **not automatically migrated**. Use a fresh local test database for this experimental version; never delete production data to work around migration failures. A versioned migration framework is a release blocker.

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
