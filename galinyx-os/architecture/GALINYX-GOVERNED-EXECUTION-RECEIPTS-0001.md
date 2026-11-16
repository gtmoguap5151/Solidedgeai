# GALINYX Governed Execution Receipts and Reconciliation — ADR 0001

- Status: Proposed architecture; documentation only
- Scope: Governance Core execution lifecycle
- Applies to: Internal GALINYX operators and independently deployed external organizations
- Authority model: Human authority remains ultimate; enforcement is hybrid
- Security classification: Design specification, not an implemented control

## 1. Decision

GALINYX will treat a governed action as a durable, auditable state transition rather than a function call that returns success or failure. Every accepted execution request receives a stable execution ID and a durable receipt. The receipt records what was requested, which authority permitted it, which approval was consumed, what the execution adapter reported, and whether the outcome is known.

The system must never claim exactly-once execution merely because a request ID is unique in the governance database. Exactly-once effects across a database and an independent target system cannot be guaranteed without cooperation from that target. Where the target supports idempotency keys, GALINYX must pass the stable execution ID. Where it does not, ambiguous outcomes must stop for reconciliation rather than trigger an automatic retry.

## 2. Invariants

1. **Human supremacy:** Governance policy may constrain and enforce delegated work, but it cannot promote an agent above the human authority that owns the organization or grant.
2. **Identity is server-derived:** Human and workload identities come from trusted authentication adapters. Caller-supplied IDs are descriptive data, never proof.
3. **Deny by default:** Missing, expired, revoked, malformed, mismatched, or unverifiable authority denies dispatch.
4. **Immutable request binding:** An execution ID is permanently bound to a canonical digest of tenant, authenticated workload, grant, action, resource, parameters, and policy version. Reuse with different content is rejected.
5. **Approval is specific and single-use:** A human approval is bound to one execution ID and exact action/resource/parameter digest. It cannot authorize a different request or a second dispatch.
6. **No false success:** A receipt reports success only after the target adapter supplies verifiable success evidence.
7. **Unknown is not failure:** A timeout, process crash, lost response, or ambiguous adapter result is outcome_unknown, not failed. It must not be automatically retried.
8. **No blind release:** Reserved budget is released only when the system has evidence that the target did not perform the action. Unknown outcomes retain a hold until reconciled.
9. **Audit continuity:** State transitions and receipt evidence are append-only and linked to the existing hash-chained audit stream.
10. **Tenant isolation:** Receipt, approval, grant, and reconciliation queries are always scoped by persisted tenant and authority relationships, never by a caller-selected tenant ID.

## 3. Execution state model

The canonical lifecycle is:

- received: Request accepted for validation; no authority or side effect implied.
- denied: Validation or policy check failed; reason is recorded; no dispatch occurred.
- authorized: Identity, grant chain, scope, limits, and any required approval were verified.
- reserved: Budget reservation and one-time approval consumption were committed durably.
- dispatching: The trusted adapter has begun dispatch. This state is written before calling the target.
- succeeded: Target success is confirmed with adapter evidence; reservation is committed.
- failed_known: Target confirms no effect occurred; reservation may be released according to policy.
- outcome_unknown: The system cannot determine whether the target acted. No automatic retry or budget release.
- reconciling: An authorized reconciliation process is evaluating target evidence.
- reconciled_succeeded: Evidence establishes that the target action occurred.
- reconciled_not_executed: Evidence establishes that no target action occurred.
- manual_review_required: Evidence is absent, conflicting, or insufficient; human decision is required.

Terminal states are denied, succeeded, failed_known, reconciled_succeeded, reconciled_not_executed, and manual_review_required. A terminal receipt is never silently rewritten; corrections are appended as new events.

## 4. Durable receipt contract

A receipt should contain, at minimum:

- execution_id — globally unique, stable idempotency key.
- tenant_id, agent_id, grant_id, and parent_grant_chain — resolved server-side.
- request_digest — digest of canonical immutable request content.
- action, resource_id, and parameter digest — no secrets or raw credentials.
- policy_version and relevant policy decision reference.
- approval_id and approver principal when human approval is required.
- reservation_id, reserved amount, and unit where applicable.
- adapter_id, adapter version, target correlation/idempotency key, and dispatch timestamps.
- Current state, append-only transition history, and reason codes.
- Target evidence reference and evidence digest; avoid storing credentials or sensitive payloads in audit events.
- Reconciliation actor, timestamp, evidence, and final determination when applicable.

The receipt is a record of the system's knowledge and evidence, not a claim that an external action is reversible.

## 5. Atomic approval consumption and dispatch preparation

Before any target call, one database transaction must:

1. Revalidate the active grant chain, workload binding, scope, policy version, and approval expiry.
2. Verify that the approval matches the exact execution ID and immutable request digest.
3. Insert a unique approval-consumption record. A database uniqueness constraint must prevent one approval from being consumed by more than one execution.
4. Create or retrieve the idempotent budget reservation.
5. Persist the execution receipt in reserved state and append the corresponding audit transition.

Only after commit may the adapter be invoked. The adapter call must use the stable execution ID as its idempotency key whenever supported. Approval consumption is not rolled back merely because the adapter response is lost; an ambiguous dispatch must be reconciled.

## 6. Adapter contract

A production adapter must expose a narrow contract with:

- Explicit capability declaration: idempotency support, lookup-by-correlation support, and evidence format.
- dispatch(execution_id, immutable_request) returning a typed result: confirmed success, confirmed no-effect failure, or unknown.
- lookup(execution_id) for reconciliation when supported.
- Authenticated target communication, bounded timeouts, secret isolation, and structured error classification.
- No ability to broaden action/resource scope or change request parameters after authorization.

An adapter that cannot provide reliable evidence must be classified as non-reconcilable. It must not be used for privileged or irreversible actions until an independent control design is approved.

## 7. Reconciliation rules

- succeeded requires target evidence tied to the stable execution ID or an independently verifiable target reference.
- failed_known requires affirmative evidence that no effect occurred; a generic exception is insufficient.
- outcome_unknown remains held. Never release the reservation or redispatch automatically.
- Reconciliation may query the target using the original execution ID. It must not create a new execution ID to disguise a retry.
- If the target confirms the effect, settle the reservation as committed and append reconciled_succeeded.
- If the target confirms no effect, release the reservation and append reconciled_not_executed.
- If evidence remains unavailable or contradictory, transition to manual_review_required; a human with appropriate authority determines the next permitted action.
- A retry after a confirmed no-effect outcome is a new, explicitly authorized execution, linked to the prior receipt. It is not a replay of the old receipt.

## 8. Failure windows that must be tested

1. Crash before the preparation transaction commits: no dispatch and no consumed approval.
2. Crash after preparation commit but before adapter invocation: receipt remains reserved; safe recovery can establish that dispatch never started only if the adapter boundary proves it.
3. Crash during dispatch or lost response: mark unknown and reconcile; do not blindly retry.
4. Target succeeds but receipt persistence fails: query target by execution ID and reconcile.
5. Target confirms no effect: release reservation only after recording evidence.
6. Audit append fails: fail closed before dispatch where possible; if the target already acted, preserve the unknown state and recover audit continuity without fabricating success.
7. Duplicate concurrent request: one receipt and one dispatch at most; same digest returns the existing receipt, different digest is rejected.
8. Approval replay or concurrent consumption: exactly one execution can consume an approval.
9. Revocation or expiry before dispatch: revalidation denies dispatch. A policy change after dispatch is recorded but does not falsify the historical decision.
10. Tenant/grant/agent mismatch: deny without creating a target side effect.

## 9. Relationship to the current prototype

The current GovernedMockExecutor is a deterministic local test harness. It authenticates workload identity through an injected test adapter, derives tenant context from the persisted grant binding, checks a human approval record, reserves budget, and changes an in-memory counter.

It does not yet provide a durable execution receipt, production credential verification, one-time approval consumption, an external target adapter, target-side idempotency, or reliable reconciliation. The in-memory counter and SQLite reservation are separate systems; a process failure between their updates cannot prove whether an effect occurred. This ADR explicitly does not represent those controls as implemented.

## 10. Implementation sequence and acceptance gates

1. Add schema migration for immutable execution receipts, append-only receipt transitions, unique approval consumption, and adapter evidence references.
2. Implement canonical request hashing and execution-ID idempotency with conflict detection.
3. Implement atomic approval consumption and reservation/receipt preparation.
4. Define a mock adapter with deterministic crash/failure injection and idempotency behavior.
5. Implement reconciliation as a separate privileged workflow; never embed automatic retries in exception handling.
6. Add tests for every failure window above, including multi-connection concurrency.
7. Integrate the governed execution service through the canonical GALINYX runtime/service boundary; keep direct store and runtime methods private to trusted process code.
8. Conduct independent security review before any real external target, financial action, customer data, or privileged integration is enabled.

Completion of the local test suite is evidence of tested behavior, not production certification. Internal deployment and external organizational deployment must use the same invariants, with tenant-specific policy and key-management configuration.

## 11. Open engineering decisions

- Select a production credential provider and key lifecycle before production workload authentication.
- Define the canonical serialization and digest algorithm/version for request binding.
- Define adapter evidence schemas and retention requirements per target class.
- Define which human roles may reconcile ambiguous outcomes and which decisions require the organization owner.
- Define retention, export, and independent backup requirements for receipts and audit evidence.

No open decision may weaken the invariants in Section 2.
