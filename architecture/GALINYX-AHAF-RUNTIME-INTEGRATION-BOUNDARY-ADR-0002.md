# GALINYX AHAF — Runtime Integration Boundary ADR 0002

**Status:** Proposed architecture; implementation deliberately deferred  
**Depends on:** AHAF Executable Authority Model v0.1 and the trusted service boundary  
**Decision owner:** GALINYX project governance

## Context

GALINYX currently has two distinct policy concerns:

1. **Human/workspace authorization:** the existing identity and runtime layer authenticates a credential through an injected adapter, resolves a human principal, and checks tenant membership, resource ownership, and workspace role.
2. **Agent operational authority:** AHAF models what a particular agent may do, to which resources, under what expiry, budget, transaction ceiling, delegation, and approval constraints.

These concerns must not be collapsed. A human's workspace role does not automatically grant an agent operational authority. An agent's rank does not grant a human workspace permission. Passing one policy check must never substitute for the other.

The current `authority.py` is a synthetic in-memory harness. It is not yet integrated with `Runtime` or `GalinyxService`.

## Decision

When AHAF is integrated, protected agent execution must require the intersection of all applicable controls:

1. Authenticate the human or service caller at the trusted service boundary.
2. Derive the principal identity server-side; never trust a principal ID supplied in a request body.
3. Check that the principal has active membership and the required workspace permission for the target resource.
4. Resolve the agent identity from a server-controlled binding to the owned entity and tenant. Do not accept an arbitrary agent ID from the caller as proof of identity.
5. Evaluate the AHAF grant for the resolved agent, exact action, exact resource, current trusted time, budget cost, and any transaction amount.
6. Verify required approval through a separate authenticated approval flow. A string such as `approved_by` is not proof of approval.
7. Apply the existing entity capability and input-contract checks.
8. Execute the task and persist the decision, grant version, caller principal, agent identity, resource, action, approval reference, request ID, and outcome in an append-only audit record.

If any required layer denies, execution stops. No fallback path may skip a layer.

## Authority separation

- **Rank** is organizational metadata and may influence task routing or escalation policy only where an explicit policy says so. Rank alone is never a permission.
- **Human workspace role** controls the human's rights over the tenant and its resources.
- **Agent grant** controls the agent's permitted actions, resources, expiry, budget, transaction ceiling, and delegation.
- **Entity capability** is a final functional allow-list; it does not replace caller authorization or AHAF.
- **Human approval** is a separate, authenticated decision with a durable reference and clear scope.

The effective permission is the intersection, not the union, of these layers.

## Required persistent data model

Before production integration, define and migrate versioned storage for:

- Agent identity binding: agent entity, tenant, owning principal, status, and credential/key reference.
- Authority grants: immutable grant ID, subject agent, issuer, parent grant, policy version, actions, resources, expiry, budget, transaction-limited actions, transaction ceiling, approval requirements, and delegation depth.
- Grant revocation: revocation actor, timestamp, reason, and propagation semantics.
- Budget ledger: atomic reservations, commits, releases, currency/unit, idempotency key, and parent-chain accounting.
- Approval records: authenticated approver, approved action/resource/amount, grant or request reference, timestamp, expiry, and decision.
- Audit events: append-only, tamper-evident records with correlation IDs and policy version.

Schema changes must use forward migrations with backups and rollback procedures. Do not overwrite or discard existing runtime data.

## Enforcement and transaction semantics

The policy check and budget reservation must be atomic with respect to competing requests. A process-local mutex is insufficient for multiple workers, processes, or hosts. Use database transactions or a dedicated policy service with serializable reservation semantics.

A request must not spend the same budget twice on retry. Bind reservation and execution to a stable idempotency key. Define what happens if execution fails after reservation, if the process crashes, or if the external side effect succeeds but its response is lost.

Revocation must prevent new authorizations immediately according to a documented consistency model. In-flight operations need explicit cancellation/commit rules; do not assume revocation can undo an external side effect already completed.

## Threat model to validate

- Caller forges another principal or agent ID.
- Agent attempts self-promotion, self-granting, or self-approval.
- Delegator broadens actions, resource scope, expiry, budget, transaction ceiling, or delegation depth.
- Revoked or expired parent grant is replayed through a descendant.
- Two workers concurrently overspend one grant or parent budget.
- Approval is replayed for a different action, resource, amount, or request.
- Caller bypasses the service and invokes local Runtime methods directly.
- A malformed, stale, or unknown policy version is accepted.
- Audit events are modified, deleted, reordered, or detached from the task outcome.
- A tool adapter performs a side effect before the policy decision is durably committed.

## Acceptance gates before code integration

1. Threat model and trust boundaries reviewed.
2. Stable agent identity binding defined and tested.
3. Persistent grant schema and migration tests implemented.
4. Authenticated approval workflow implemented; no caller-provided approval strings.
5. Atomic budget reservation and idempotent execution semantics tested across concurrent workers.
6. Revocation, expiry, replay, and policy-version tests pass.
7. All network-facing execution paths enforce the same policy chain.
8. Direct Runtime and database access are restricted to the trusted service process in deployment.
9. Adversarial integration tests prove every denial prevents side effects.
10. Independent security review completed before exposure to untrusted users or privileged tools.

## Explicit non-goals for this phase

Do not add automatic agent promotion, autonomous grant issuance, autonomous approval, unrestricted tool execution, or self-modifying authorization policy. Autonomous repair may propose a policy or code change, but it must not grant itself authority to approve or deploy that change.

## Current engineering conclusion

Keep the executable AHAF harness isolated until the persistence, identity-binding, approval, budget-atomicity, and service-enforcement contracts are specified and tested. The present prototype demonstrates selected policy invariants; it does not establish a production security boundary.
