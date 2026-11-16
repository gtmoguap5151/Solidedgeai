# GALINYX Governance Core v1

A small, dependency-free policy evaluation core. This is an isolated implementation branch, not a production integration.

## Current semantics
- A **rank** is the role title; a numeric **level** is descriptive metadata. Neither grants authority by itself.
- Authority comes from explicit role/action permissions or a valid, unrevoked, unexpired delegation.
- Approval rules are action-specific. Approvers must be distinct from the requester and belong to an allowed role when specified.
- Declared conflicts block the action.
- Human overrides require an explicitly authorized role, a decision, and a reason.
- Audit events form a SHA-256 hash-linked sequence. This detects accidental or post-hoc edits when the chain is retained, but is **not tamper-proof** if an administrator can rewrite the entire store.

## Run tests
`node --test governance-core/test/core.test.mjs`

## Not yet implemented
Persistent append-only storage, authenticated identities, cryptographic signing, policy versioning, durable delegation lifecycle, UI, external integrations, and BLACKPINE FIELD adapter. Do not treat this as a certification, legal compliance determination, or production security boundary.
