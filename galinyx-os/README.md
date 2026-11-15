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

