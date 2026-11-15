# GALINYX — Identity & Ownership Requirements-to-Tests Specification

**Version:** 0.1  
**Date:** 2026-11-15  
**Status:** Proposed acceptance specification; tests not yet implemented  
**Parent design:** `architecture/GALINYX-IDENTITY-OWNERSHIP-BOUNDARY-DESIGN-v0.1.md`  
**Parent architecture:** `architecture/GALINYX-MASTER-SYSTEM-ARCHITECTURE-v1.0.md`  
**Branch:** `galinyx-launch`

---

## 1. Purpose

Convert the Identity and Ownership Boundary Design into observable, repeatable acceptance tests. This document defines what the system must prove before GALINYX exposes protected multi-user operations.

It does **not** select an identity provider, define a credential protocol, prescribe a final database schema, or claim that the current prototype meets these requirements.

**Plain English:** the design says what the locks should protect. This specification defines the tests that try the wrong keys, forged badges, expired permissions, and unauthorized doors.

## 2. Test levels

Tests must be labeled by the boundary they actually exercise:

| Level | What it proves | What it does not prove |
|---|---|---|
| Unit / policy | Authorization rules return the correct decision for controlled inputs | That credentials are genuine |
| Service integration | The service derives trusted request context and enforces policy across storage operations | That an external identity provider is configured correctly in production |
| Identity integration | Credentials are validated, principals are mapped correctly, lifecycle changes take effect | That the entire deployment is secure |
| Deployment / adversarial | Configuration, network boundary, secrets, logging and operational controls behave as intended | Absolute security or absence of unknown vulnerabilities |

A test must never be described as proving a stronger layer than the one it exercises.

## 3. Shared test fixtures and terminology

Unless a test says otherwise, use this isolated fixture:

- Human principal **H-A** with a valid authenticated session.
- Human principal **H-B** with a separate valid authenticated session.
- Personal tenants **T-A** and **T-B**.
- Resource **R-A** owned by T-A.
- Resource **R-B** owned by T-B.
- Agent **AG-A** registered to T-A and controlled by H-A.
- Active grant **G-A1** from H-A to AG-A, scoped only to action `asset.draft` on resource R-A, with a defined expiry and constraints.
- Revoked grant **G-A2** and expired grant **G-A3**.
- Organization tenant **T-ORG**, with members H-A and H-B assigned different roles where relevant.

Fixture IDs are test labels, not literal production identifiers. Test clocks must be controllable; expiry tests must not depend on sleeping or wall-clock timing.

Every test must start from a known isolated state and clean up its own records. Tests must not use production data.

## 4. Core acceptance tests

### A. Identity and principal integrity

| Test ID | Requirement | Attack / condition | Expected result |
|---|---|---|---|
| IDT-001 | Protected remote requests require authentication | No credential supplied | Deny; no protected read or mutation occurs |
| IDT-002 | Credentials are validated | Malformed, invalid-signature, or unknown credential | Deny; no fallback to caller-supplied identity |
| IDT-003 | Credential expiry is enforced | Expired credential | Deny |
| IDT-004 | Disabled principals cannot act | Principal is disabled after session/credential issuance | Deny according to defined revocation freshness policy |
| IDT-005 | Principal type is explicit | Agent credential presented to a human-only endpoint | Deny |
| IDT-006 | Identity is server-derived | Request body contains forged `principal_id` or `actor_id` for H-A while authenticated as H-B | Ignore untrusted identity fields or reject request; never act as H-A |
| IDT-007 | Authentication failure is non-oracular | Probe unknown principal IDs or credentials | No protected data disclosure; response does not reveal whether a target account exists beyond documented behavior |

**Implementation note:** IDT-002 through IDT-004 require an actual authentication integration to be meaningful. A policy unit test with a fabricated “authenticated=true” flag is not credential validation.

### B. Tenant isolation and resource ownership

| Test ID | Requirement | Attack / condition | Expected result |
|---|---|---|---|
| TEN-001 | Resource creation requires authorized tenant context | Create resource without tenant context | Deny |
| TEN-002 | Tenant context is trusted | H-A submits T-B in request body while authenticated in T-A | Deny or derive T-A from trusted membership context; never silently operate in T-B |
| TEN-003 | Cross-tenant reads are denied | H-A requests R-B by guessing or substituting its ID | Deny; no resource content or metadata leakage |
| TEN-004 | Cross-tenant mutations are denied | H-A attempts update/delete on R-B | Deny; R-B remains unchanged |
| TEN-005 | Ownership is platform-established | Caller submits `owner_id=H-A` or `tenant_id=T-A` to claim a resource | Caller-supplied ownership is ignored or rejected |
| TEN-006 | Sharing does not transfer ownership | T-A shares R-A with an authorized collaborator from T-B | Owner remains T-A; collaborator receives only explicitly granted access |
| TEN-007 | Ownership transfer is explicit | Attempt to change owner through ordinary update endpoint | Deny; only a separately authorized transfer operation may change ownership |
| TEN-008 | Unknown ownership fails closed | Resource exists but ownership record is missing, corrupt, or ambiguous | Deny protected operation and emit a security-relevant diagnostic without leaking data |
| TEN-009 | Resource IDs are not authorization | A valid resource ID is supplied by a principal with no rights | Deny |

### C. Membership and role lifecycle

| Test ID | Requirement | Attack / condition | Expected result |
|---|---|---|---|
| MEM-001 | Active membership is required | Non-member requests organization resource | Deny |
| MEM-002 | Revocation takes effect | Member is removed, then reuses an existing session | Deny after the documented revocation propagation bound |
| MEM-003 | Role changes take effect | Member is downgraded, then repeats a previously allowed action | Deny if the new role lacks that permission |
| MEM-004 | Roles do not imply unlisted permissions | Member has a read-only role and attempts mutation | Deny |
| MEM-005 | Membership cannot be self-assigned | User submits a membership record or changes their own role | Deny |
| MEM-006 | Tenant administrators are tenant-scoped | Admin of T-ORG attempts to administer T-B | Deny |
| MEM-007 | Suspended tenant is restricted | Member attempts protected operation in a suspended tenant | Deny according to tenant lifecycle policy |

### D. Agent identity and delegation

| Test ID | Requirement | Attack / condition | Expected result |
|---|---|---|---|
| AGT-001 | Agent has a distinct principal identity | Agent submits a request claiming to be its human controller | Deny impersonation; audit actor remains AG-A |
| AGT-002 | Agent registration is tenant-bound | AG-A attempts to operate in T-B without a valid grant | Deny |
| DEL-001 | Delegation is required for acting on behalf of a principal | Agent performs a protected action with no grant | Deny |
| DEL-002 | Grant action scope is enforced | G-A1 permits `asset.draft`; AG-A attempts `asset.publish` | Deny |
| DEL-003 | Grant resource scope is enforced | AG-A uses G-A1 on R-B | Deny |
| DEL-004 | Grant expiry is enforced | AG-A uses G-A3 after expiry | Deny |
| DEL-005 | Revocation is enforced | AG-A uses G-A2 after revocation | Deny within the documented revocation propagation bound |
| DEL-006 | Delegation cannot widen authority | Child grant requests an action absent from parent grant | Deny creation of child grant |
| DEL-007 | Delegation cannot widen resource scope | Child grant requests resources outside parent scope | Deny creation of child grant |
| DEL-008 | Delegation cannot extend authority lifetime | Child grant expires later than parent grant | Deny creation of child grant |
| DEL-009 | Delegation depth is bounded | Grant chain exceeds configured maximum depth | Deny |
| DEL-010 | Constraints are preserved | Child grant drops or weakens a parent constraint | Deny creation of child grant |
| DEL-011 | Revoked ancestor invalidates descendants | Parent grant is revoked while child grant remains nominally active | Deny descendant-authorized action |
| DEL-012 | Agent cannot self-issue authority | Agent attempts to create a grant for itself without an authorized grantor | Deny |
| DEL-013 | Human and agent authority are not conflated | Human has permission but agent has no delegation | Agent action is denied |

### E. Approval, audit, and fail-closed behavior

| Test ID | Requirement | Attack / condition | Expected result |
|---|---|---|---|
| APR-001 | Approval is tied to authenticated approver | Request body supplies `approved_by=H-A` without H-A authenticating and approving | Deny |
| APR-002 | Approver has authority | Authenticated user without approval permission attempts approval | Deny |
| APR-003 | Approval is action/resource-specific | Approval for R-A is replayed for R-B or a different action | Deny |
| APR-004 | Approval lifecycle is enforced | Approval expires or is revoked before execution | Deny |
| AUD-001 | Audit actor is server-derived | Caller forges actor, owner, tenant, or approver fields | Audit records verified request context, not forged fields |
| AUD-002 | Denied attempts are recorded safely | Authorization denial occurs | Record minimum security event without logging credentials or secrets |
| AUD-003 | Audit event links decision context | Protected operation succeeds or fails | Event records actor, tenant, resource, action, decision, policy/version reference and correlation ID where available |
| FAIL-001 | Missing identity fails closed | Identity context unavailable | Deny protected operation |
| FAIL-002 | Missing ownership fails closed | Ownership lookup fails or returns ambiguous result | Deny protected operation |
| FAIL-003 | Policy service failure fails closed | Authorization policy cannot be evaluated | Deny protected operation; do not silently bypass |
| FAIL-004 | Missing approval fails closed | Action requires approval but no valid approval exists | Deny |
| FAIL-005 | Storage failure cannot create partial authorization success | Policy/ownership check fails midway through mutation | No unauthorized partial mutation; transaction is rolled back or operation safely aborted |

## 5. Abuse and regression tests

The following tests target common implementation mistakes. They should be included before any public multi-user release.

1. **Identifier substitution:** change only a resource ID, tenant ID, owner ID, agent ID, or grant ID in an otherwise valid request.
2. **Confused deputy:** cause a more privileged service or agent to use its own authority for a caller who lacks permission.
3. **Replay:** reuse a previously valid request, approval, or delegation after expiry/revocation or after its permitted one-time use.
4. **Concurrent revocation:** race a protected operation against membership or grant revocation; document the consistency guarantee and test it.
5. **Privilege escalation through defaults:** omit role, tenant, resource owner, scope, or constraint fields and verify that defaults never grant authority.
6. **Over-posting / mass assignment:** include protected fields such as `owner_id`, `tenant_id`, `role`, `principal_type`, `approved_by`, or `grantor_id` in ordinary create/update payloads.
7. **Cross-tenant query leakage:** test list, search, count, pagination, export, attachment, and error paths—not only direct object lookup.
8. **Audit spoofing:** attempt to forge or suppress actor and decision fields.
9. **Policy drift:** change a permission or role definition and verify that cached decisions cannot outlive the documented policy freshness bound.
10. **Failure injection:** force identity, policy, ownership, and storage dependencies to timeout or return malformed data; protected actions must fail closed.

## 6. First-release scope and release gate

The first multi-user implementation should remain narrow:

- authenticated human principal;
- personal tenant;
- service-derived tenant and ownership context;
- server-side resource authorization;
- no cross-tenant sharing;
- no autonomous external agent actions;
- no external publishing or payment execution.

**Minimum release gate:**

1. All applicable IDT, TEN, MEM, AUD and FAIL tests pass at service-integration level.
2. All tests for features not yet supported are explicitly marked **not applicable / not implemented**, never silently counted as passing.
3. No protected endpoint trusts caller-supplied identity, tenant, ownership, role, or approval fields.
4. Cross-tenant list/search/export paths are tested, not just direct record access.
5. Revocation behavior and its maximum propagation delay are documented and tested.
6. CI runs the required suite on every change to identity, tenant, ownership, authorization, or protected data access.
7. Security review confirms that test fixtures and local CLI behavior do not masquerade as production authentication.

Passing this gate is evidence for the tested release boundary. It is not a penetration-test certificate, compliance certification, or proof of total security.

## 7. Current prototype status

As of this specification:

- The existing Python/SQLite prototype is a trusted-local development runtime.
- It accepts caller-supplied entity identifiers and does not establish real human identity.
- It does not provide production tenant isolation or authenticated organization membership.
- It does not provide verified agent credentials or production delegation.
- Existing capability checks and audit events are useful prototype foundations, but they do not satisfy this specification.
- The previously inspected CI run passed 34 tests on the PR #4 merge revision. That result is a historical baseline for that revision only; it does not mean the tests in this document exist or pass.

No production migration, endpoint exposure, or merge is authorized by this document.

## 8. Traceability to the design

| Design invariant | Test coverage |
|---|---|
| ID-01 / ID-02 | IDT-001 through IDT-007 |
| TEN-01 / TEN-02 | TEN-001 through TEN-004 |
| OWN-01 | TEN-005 through TEN-009 |
| MEM-01 | MEM-001 through MEM-007 |
| AGT-01 | AGT-001 / AGT-002 |
| DEL-01 | DEL-001 through DEL-005 |
| DEL-02 | DEL-006 through DEL-010 |
| DEL-03 | DEL-005 / DEL-011 |
| APR-01 | APR-001 through APR-004 |
| AUD-01 | AUD-001 through AUD-003 |
| FAIL-01 | FAIL-001 through FAIL-005 |

---

## 9. Engineering decision

**Decision:** define and review the test contract before choosing a provider or changing the prototype schema.

**Reason:** an identity provider can tell GALINYX who authenticated. GALINYX must still decide which tenant they are acting in, who owns the resource, what permission applies, and whether delegation or approval is valid. Those are platform responsibilities.

**Next implementation decision:** select the first real protected use case and trust boundary, then choose the smallest authentication mechanism that can support it. Do not build a universal identity protocol or a complete enterprise IAM system before the product requires one.
