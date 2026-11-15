# GALINYX AHAF — Executable Authority Model v0.1

**Status:** Synthetic policy prototype; not production authorization or a security certification  
**Parent architecture:** `architecture/GALINYX-AGENT-HIERARCHY-AUTHORITY-FRAMEWORK.md`  
**Implementation:** `galinyx-os/authority.py`  
**Tests:** `galinyx-os/test_authority.py`

## Purpose

Convert a bounded subset of AHAF's written invariants into executable, repeatable tests. This is a deliberately small policy harness, not a full agent runtime integration.

## Enforced in this prototype

- Five named ranks are represented as organizational metadata.
- Only a trusted governance actor can change an agent's rank.
- Rank is not consulted by the authorization decision and cannot create permissions.
- Root grants are explicitly issued by trusted governance.
- Grants are scoped to a subject, action set, resource set, expiry, operating budget, optional transaction ceiling, approval requirements, and delegation depth.
- Delegation can only narrow actions, resources, expiry, cumulative budget, transaction ceiling, and approval requirements; transaction-limited actions cannot lose their ceiling during delegation.
- Further delegation is possible only when the parent explicitly marks a subset of actions as delegable and remaining depth is positive; the child receives only the expressly delegated subset.
- Revoking a parent grant invalidates its descendants when they are next evaluated.
- Required approval must be attributed to someone other than the requesting agent.
- Transaction amounts are mandatory for explicitly transaction-limited actions.
- Budget consumption is cumulative within the in-memory process and is charged to the selected grant and each ancestor under a process-local reentrant lock that serializes policy state transitions.
- Required approvals are accepted only from the configured trusted governance identities in this test harness.
- Authorization decisions append an in-memory audit event with the policy version.

## Deliberate limits

This is not yet integrated into `Runtime` or `GalinyxService`. It uses in-memory Python objects and trusted governance actor IDs supplied by the test harness. It does not authenticate agents or humans, sign grants, persist policy, provide cross-process or crash-safe budget accounting, validate approval credentials beyond trusted in-memory IDs, or isolate code execution. The process-local lock protects only calls through this in-memory instance; it does not coordinate separate processes or hosts. Audit events are mutable in-memory records, not tamper-evident logs.

A passing unit test proves only the behavior of this synthetic model under the tested inputs. It does not prove security of the full GALINYX system or any deployed agent.

## Validation gates before integration

1. Threat-model the grant issuer, subject, delegator, delegate, approver, policy store, and enforcement point.
2. Select and document a canonical grant representation and cryptographic verification approach; do not invent custom cryptography.
3. Define atomic budget reservation/debit and concurrency semantics.
4. Define durable, append-only audit storage and policy-version migration.
5. Bind agent identity to authenticated workload credentials, separately from human login.
6. Integrate enforcement at one service entry point; prevent alternate runtime paths from bypassing it.
7. Add adversarial tests for malformed grants, duplicate IDs, replay, concurrent spend, clock skew, revocation races, and approval spoofing.
8. Obtain independent security review before any untrusted network exposure.

## Decision

Keep this prototype isolated and reviewable. Do not claim that GALINYX has production-grade agent governance, autonomous repair, or a novel authorization standard on the strength of this model.
