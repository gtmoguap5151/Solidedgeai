# Galinyx OS — executable prototype v0.1

A **standard-library-only Python runtime**, not a Linux replacement or finished commercial product.

Implemented:
- Durable SQLite entity registry
- Per-entity memories
- Deny-by-default capability checks
- Append-only task audit events
- Idempotent task request IDs
- Creator and researcher entities sharing one runtime

No AI model calls, media generation, autonomous publishing, payment execution, real user authentication, or network endpoints. Review actions currently depend on entity capabilities and do not verify that a human reviewer is acting; this is a prototype workflow, not a production security boundary. `story.plan` currently records a successful task but **does not generate a story**. A permitted but unsupported action returns `not_implemented`.

## Run
```bash
python galinyx-os/demo.py
python -m unittest discover -s galinyx-os -p 'test_*.py' -v
```

## Security boundaries
This is a local proof of concept, **not production-secure**. The caller supplies entity IDs directly, so it is not a multi-tenant authentication boundary. Do not connect payment, posting, or privileged APIs until authentication, authorization, approval policies, secrets handling, and threat modeling are implemented.

## Next
Typed entity manifests, authenticated user ownership, storyworld persistence, approval queues, resource metering, and creator subsystem adapters.
