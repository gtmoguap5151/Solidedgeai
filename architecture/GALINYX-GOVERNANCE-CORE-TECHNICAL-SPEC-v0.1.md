# GALINYX Governance Core — Technical Specification

**Document ID:** GXY-GOV-CORE-SPEC  
**Version:** 0.1.0  
**Date:** 2026-11-16  
**Status:** Founder decisions incorporated; implementation specification for review  
**Repository:** `gtmoguap5151/Solidedgeai`  
**Specification branch:** `galinyx-governance-core-spec`  
**Architecture baseline:** `galinyx-launch`  
**Related documents:**
- `architecture/GALINYX-GOVERNANCE-AND-AUTHORITY-ARCHITECTURE-v1.0.md`
- `architecture/GALINYX-STAGE-0-REPOSITORY-BASELINE-2026-11-16.md`
- `architecture/GALINYX-IDENTITY-OWNERSHIP-BOUNDARY-DESIGN-v0.1.md`
- `architecture/GALINYX-AGENT-HIERARCHY-AUTHORITY-FRAMEWORK.md`

---

## 1. Purpose

This specification translates the founder-approved GALINYX governance direction into implementable contracts, invariants, data concepts, decision flows, and acceptance criteria.

It defines the first governance-core implementation boundary. It does not claim that the complete design is implemented, production-secure, legally compliant, independently audited, or ready for customer workloads.

GALINYX is the wider technology ecosystem. GALINYX OS is its foundational platform layer. Governance is a reusable platform capability and an independently usable product—not the entirety of GALINYX.

## 2. Founder-approved architectural decisions

The following decisions are ratified requirements:

| Decision | Approved requirement |
|---|---|
| Ultimate authority | Human |
| Deployment strategy | Both internal GALINYX use and independent external use |
| Governance model | Hybrid: shared foundational safeguards plus organization-controlled policies |

### 2.1 Human authority

Humans retain ultimate authority over the creation and ownership of organizations, appointment of accountable decision-makers, grant of authority, policy activation within their jurisdiction, high-impact approvals designated by policy, and suspension or revocation.

AI systems may receive bounded operational authority. They may not:
- Create or elevate their own authority.
- Approve their own privilege elevation.
- Rewrite or disable the foundational security invariants.
- Treat a task assignment, rank, role, budget, model output, or claimed relationship as proof of authorization.
- Expand delegated authority beyond the delegator's valid and delegable authority.

Human authority does not mean every routine action requires a human click. A human may pre-authorize a narrow class of low-risk actions through an explicit, revocable policy or grant. The system enforces those boundaries on each protected action.

### 2.2 Dual deployment

One reusable governance core and one set of authorization semantics must support:
1. GALINYX-native first-party applications and operators.
2. Independent external organizations that do not adopt the wider GALINYX ecosystem.

The initial engineering design must not fork the policy engine for internal and external customers.

A managed service and customer-controlled/private deployment are future packaging profiles. They must not be marketed as available until their isolation, operations, support, update, and security requirements are implemented and tested.

### 2.3 Hybrid governance

Governance has three logical levels:

1. **Platform invariants:** security and integrity requirements that cannot be disabled by tenant policy.
2. **Organization policy:** customer- or first-party-controlled rules, roles, approval thresholds, data handling, limits, and workflows.
3. **Operational scope:** task-specific instructions and grants that must remain within the first two levels.

A tenant controls its own business policy within platform invariants. GALINYX must not use shared platform ownership as a hidden right to make a customer's business decisions or inspect customer action data.

Policy precedence is restrictive: a lower level may narrow authority, never broaden it past a higher-level restriction. Explicit deny and unmet required conditions take precedence over permit.

## 3. Product boundary

The governance core answers:

> Is this authenticated actor, acting for this tenant and organization, permitted to perform this specific action on this specific resource, for this stated purpose, under the current policy and constraints—and if so, what exact conditions must the enforcement point satisfy?

The governance core is responsible for:
- Actor and workload identity bindings.
- Tenant and organization context.
- Grants, roles, assignments, and bounded delegation.
- Policy evaluation and decision explanations.
- Human approval workflows.
- Short-lived action-bound permits.
- Enforcement integration contracts.
- Resource budget/limit reservations where required.
- Decision, approval, execution, and audit evidence.

It does not replace every identity provider, model provider, HR platform, workflow engine, compliance program, or security product. It cannot govern an external system through which all action paths do not pass. An integration must disclose its enforcement coverage and bypass paths.

## 4. Logical architecture and trust boundaries

The system is divided into logical planes. They may initially run in one deployable application, but their responsibilities and trust boundaries must remain explicit.

1. **Identity and trust:** verifies human, workload, service, application, and connector identities.
2. **Organization and authority:** resolves tenant, organization, membership, assignments, roles, grants, and delegation.
3. **Policy decision:** evaluates normalized requests against versioned policy.
4. **Approval and oversight:** obtains and verifies action-bound human approvals.
5. **Evidence and audit:** records decisions, permits, approvals, execution outcomes, and administrative changes.
6. **Administration and policy operations:** manages policy lifecycle, simulation, activation, rollback, and review.
7. **Enforcement plane:** intercepts the real protected action and validates the decision/permit before execution.

The enforcement plane is a separate trust boundary from the AI model, agent, planner, or caller. The requester cannot supply its own proof of identity or manufacture a permit.

## 5. Canonical domain model

The following concepts are logically distinct. Physical tables and storage technology are implementation choices to be decided against the existing contracts and migrations.

| Concept | Meaning | Required controls |
|---|---|---|
| Tenant | Customer or first-party security boundary | Isolation; explicit ownership |
| Organization | Governed entity within a tenant | Membership and policy scope |
| Human principal | Person authenticated through a trusted mechanism | Verified identity and lifecycle |
| Actor | Human, workload, service, app, connector, or other principal | Authenticated identity binding |
| Workload identity | Runtime identity for an AI agent or service | Issuer, audience, expiry, revocation |
| Assignment | Actor's organizational placement | Does not itself grant access |
| Role | Reusable responsibility template | Must resolve to explicit grants/policy |
| Rank/tier | Optional organizational classification | Never implicit permission |
| Resource | Protected object, account, system, or dataset | Tenant ownership and classification |
| Action | Normalized operation | Stable, versioned action vocabulary |
| Policy | Versioned decision rules | Review, simulation, activation history |
| Grant | Explicit authority over action/resource scope | Issuer, scope, conditions, expiry, revocation |
| Delegation | Narrower authority passed to another actor | Attenuation and bounded depth |
| Budget/limit | Quantitative constraint | Reservation and atomic accounting |
| Approval | Authenticated human decision | Action-bound, expiring, replay-safe |
| Decision | Policy evaluation result | Policy version and reason codes |
| Permit | Proof of one allowed execution opportunity | Bound, short-lived, audience-specific, single-use for high-risk actions |
| Execution | Actual attempt against a target system | Distinct from authorization |
| Audit event | Attributable record of an event | Integrity protection and retention controls |

A tenant may contain multiple organizations or workspaces. Organization structure is a configurable graph, not a mandatory hierarchy. Military-inspired ranks are optional and must never be a universal assumption.

## 6. Authorization contract

### 6.1 Request

A normalized authorization request must carry, directly or through trusted server-side resolution:

- Request identifier and schema version.
- Tenant and organization context.
- Authenticated actor and workload identity.
- Action identifier and version.
- Target resource identifier and type.
- Purpose, task, case, or workflow identifier.
- Material action parameters or a canonical payload digest.
- Relevant grant/delegation reference.
- Enforcement-point identity and audience.
- Context required by policy (for example amount, data classification, environment, time, or risk signals).
- Idempotency key where an action can create a side effect.

Caller-supplied tenant, actor, role, or grant identifiers are not trusted merely because they appear in the request. The trusted boundary must authenticate the caller and resolve or verify the relevant bindings.

### 6.2 Decision results

The decision interface must support:

- `PERMIT`: action may proceed only within the returned constraints and validity window.
- `DENY`: action must not execute.
- `REQUIRES_APPROVAL`: a specified human approval flow must complete.
- `STEP_UP_AUTH`: stronger authentication or additional evidence is required.
- `INDETERMINATE`: policy cannot safely decide from available evidence.
- `UNAVAILABLE`: policy service or required dependency is unavailable.

For protected actions, `INDETERMINATE` and `UNAVAILABLE` fail closed. No default permit, cached stale permit, or model-generated approval is allowed.

Each decision includes a decision ID, normalized result, policy version, reason codes, applicable constraints, timestamp, and—only for a permit—its bounded validity and enforcement audience.

### 6.3 Permit binding

A permit is not a general-purpose bearer credential. It must be cryptographically verifiable and bound to:
- Tenant and organization.
- Authenticated actor/workload.
- Exact action and target resource.
- Material parameters or payload digest.
- Enforcement audience.
- Decision and policy version.
- Issued-at and expiry.
- Unique permit/request identifier.
- Required approval evidence, if applicable.

High-impact permits must be single-use or have equivalent replay protection. Any material change to the action invalidates the permit and requires a new decision.

## 7. Human approval contract

Approval is an authenticated action by a human principal with current authority for the requested approval scope. A boolean supplied by an agent, a model statement, or a UI flag is not sufficient evidence.

An approval record must bind:
- Requesting actor and tenant/organization.
- Approver identity and authentication evidence reference.
- Action, target, and material parameters or constraints.
- Decision and policy version.
- Approval scope and timestamp.
- Expiration and revocation status.
- Separation-of-duties result.
- Evidence and audit references.

If the material action changes after approval, the approval is invalid. Where policy requires separation of duties, the requester cannot approve its own request. AI workloads cannot approve their own authority elevation.

A break-glass path, if implemented, must be separately specified, strongly authenticated, narrowly scoped, time-limited, visibly audited, and reviewed after use. It must not become a routine bypass.

## 8. Delegation contract

Delegation is allowed only when the source grant explicitly permits it and the delegator currently holds the relevant authority.

The delegated grant must be no broader than the intersection of:
- The delegator's current effective authority.
- The source grant's delegable scope.
- The requested task scope.
- The recipient's permitted actor/resource context.
- Applicable organization and platform restrictions.

Delegation may not increase actions, resources, transaction limits, data scope, geographic scope, tool access, duration, or approval exemptions. Delegation depth must be explicit and bounded. Revoking or expiring a source grant must invalidate dependent delegations within a defined propagation window.

An actor may request a delegation or recommend a role assignment; only an authorized human or trusted governance process can make the change effective.

## 9. Enforcement transaction

A successful policy decision is not proof that an action executed. Protected operations use a guarded lifecycle:

1. Authenticate the caller at the trusted boundary.
2. Resolve tenant, organization, actor, and workload identity.
3. Normalize and validate the action, target, and parameters.
4. Evaluate current policy and applicable grants/delegation.
5. Determine whether stronger authentication or human approval is required.
6. Reserve relevant budget/quota atomically, if applicable.
7. Issue a short-lived action-bound permit.
8. Enforcement point verifies and consumes the permit.
9. Execute against the target resource.
10. Commit actual usage or release the reservation on failure.
11. Record the target outcome and evidence.
12. Reconcile uncertain outcomes; do not blindly retry non-idempotent side effects.

The enforcement point must be located at or immediately in front of the resource operation. A planner-level check alone is insufficient.

## 10. Tenant isolation and deployment profiles

### 10.1 Required isolation

Each tenant must have separately scoped:
- Actor identities and credential bindings.
- Organization graph and assignments.
- Policies and policy versions.
- Grants and delegation chains.
- Budgets and reservations.
- Approval records.
- Decisions and permits.
- Execution evidence and audit records.
- Retention and export settings.

Cross-tenant access is denied by default. Administrative/support access must be explicitly authorized, attributable, narrowly scoped, and audited. First-party GALINYX organizations must not receive a hidden bypass.

### 10.2 Deployment profiles

**Profile A — GALINYX-native:** first-party applications use the same authorization contracts and enforcement requirements as external clients.

**Profile B — GALINYX-managed external service:** customer tenants use federated identity, customer-controlled policies, isolated state, configured retention/export, and customer-connected enforcement adapters.

**Profile C — Customer-controlled/private deployment:** future profile only. Do not promise self-hosted, air-gapped, or customer-managed-key capabilities until packaging and operational controls are proven.

All profiles must preserve the same policy semantics. Deployment packaging may differ; authority meaning must not.

## 11. Security invariants

The following are release-blocking properties for protected actions:

1. **Human ownership of authority:** no AI actor can create, elevate, or approve its own authority.
2. **Authenticated identity:** caller-supplied identifiers are never accepted as proof of identity.
3. **Tenant isolation:** a tenant cannot access another tenant's protected records or resources.
4. **Default deny:** missing, invalid, expired, or unverifiable required evidence denies protected actions.
5. **No rank privilege:** rank, role, budget, task assignment, and model output are not standalone permission.
6. **Delegation attenuation:** a delegate cannot receive more authority than the delegator may pass.
7. **Approval integrity:** approvals are human-authenticated, action-bound, time-limited, and replay-resistant.
8. **Enforcement at action boundary:** a protected operation cannot proceed solely on a planner's assertion.
9. **Revocation:** revoked/expired authority is rejected within a documented enforcement window.
10. **Permit integrity:** permits are scoped, audience-bound, short-lived, and replay-protected.
11. **Audit attribution:** decisions and execution outcomes are attributable to verified principals and policy versions.
12. **Fail closed:** policy, identity, approval, or permit unavailability cannot silently become permission.
13. **No hidden first-party bypass:** internal GALINYX services follow the same core authorization contracts.
14. **Policy precedence:** tenant and operational policies may narrow, not override, foundational security invariants.

## 12. Initial API surface

The first stable contract families are:

| Interface | Purpose |
|---|---|
| Identity binding / verification | Resolve authenticated principal and workload |
| Tenant / organization context | Resolve trusted governance scope |
| Actor and assignment registry | Manage governed identities and organizational placement |
| Grant lifecycle | Issue, inspect, expire, suspend, revoke |
| Delegation lifecycle | Create and validate attenuated grants |
| Policy lifecycle | Draft, validate, simulate, activate, rollback |
| Authorization decision | Return normalized decision and reason codes |
| Approval workflow | Request, approve, deny, expire, revoke |
| Permit verification / consumption | Enforce action-bound authorization |
| Budget reservation / commit / release | Control scarce resources and limits |
| Audit query / export | Review attributable evidence |

The exact HTTP framework, database, identity provider, policy language, and cryptographic token format remain open implementation choices until the existing repository contracts and prior-art review are reconciled. Do not introduce a new framework or policy engine merely because it is fashionable.

## 13. First vertical slice

The first end-to-end demonstration must be intentionally harmless and fully testable:

**Use case:** an authenticated test human authorizes a registered test operator to perform a bounded, non-destructive action against a mock resource in a test tenant.

The slice must demonstrate:
1. Test human and workload identities are resolved through a trusted test authenticator.
2. Tenant and organization boundaries are enforced.
3. A human-issued grant allows only the named action and mock resource.
4. A request outside scope is denied.
5. An action requiring approval cannot execute until an authorized test human approves the exact request.
6. A changed payload invalidates the prior approval/permit.
7. Revocation blocks subsequent execution.
8. Every decision, approval, denial, permit use, and outcome produces attributable audit evidence.
9. A simulated policy-service outage fails closed.
10. Cross-tenant access attempts are denied.

No real payment, public publishing, external messaging, production deployment, or other irreversible side effect is part of this first slice.

## 14. Acceptance criteria

The specification is ready to advance into implementation planning only when:

- The existing core-contract, identity, service-boundary, authority, migration, and persistence branches are mapped to these requirements.
- Existing code and tests are preserved where compatible; gaps are explicitly recorded.
- The first vertical slice has an agreed action vocabulary and mock resource.
- Each security invariant has one or more automated tests.
- The action enforcement point is identified and cannot be bypassed by the operator/requester in the test environment.
- Tenant isolation, revocation, replay, delegation attenuation, and failure behavior are covered by adversarial tests.
- Database changes use the existing versioned migration strategy; no destructive schema reset is used.
- CI runs the targeted suite and the relevant repository build/type checks.
- Documentation labels prototype, proposed, implemented, and production-ready status accurately.

A passing unit suite is necessary but not sufficient for production security. External protected actions require additional integration testing, operational controls, and independent security review.

## 15. Existing repository alignment and implementation order

The 2026-11-16 repository baseline identifies useful work already present on the stacked engineering branches:
- Versioned core contracts.
- Identity and ownership boundary.
- Credential-derived trusted service boundary.
- Synthetic authority policy model.
- Forward-only SQLite migrations.
- Persistent AHAF grants and budget ledger.

The baseline also records that the persistent AHAF store is not yet connected to protected task execution and is not a production authorization boundary. That limitation remains in force.

Implementation order:
1. Preserve the existing branch and pull-request history; do not merge, rebase, or rewrite the stack blindly.
2. Map the current branch stack and its contracts against this specification.
3. Identify the narrowest compatible enforcement seam in the existing service/runtime.
4. Implement the mock-resource vertical slice on a dedicated integration branch.
5. Add adversarial tests and verify revocation, approval binding, and tenant isolation.
6. Only then plan integration into the primary development line.

This specification branch is intentionally separate from the existing stacked engineering branches. Its creation does not merge code, alter the default branch, change production deployment, or declare the engineering stack integrated.

## 16. Open decisions intentionally not guessed

The following require repository inspection, standards/prior-art review, or explicit engineering evidence:
- Exact identity federation and workload credential profile.
- Policy language or policy engine selection.
- Permit signing and key-management design.
- First production datastore and tenant-isolation strategy.
- Revocation propagation guarantees for connected and disconnected enforcement points.
- Budget reservation semantics for each resource type.
- Customer-controlled deployment packaging and update model.
- Audit retention, export, and independent integrity anchoring.
- Licensing and commercial packaging.

These decisions must be resolved with traceable requirements and tests, not assumptions.

---

**Founder decision summary:** Human authority. Internal and independent external deployment. Hybrid governance. One reusable governance core, tenant-isolated operating environments, explicit enforcement, bounded delegation, and attributable evidence.


---

## 17. Self-hosting decision — implementation sequencing update

**Architecture decision:** GALINYX OS is the first customer and native development environment for Governance Core. See `architecture/GALINYX-SELF-HOSTING-ADR-001.md`.

The Governance Core must be implemented as a native platform service and consumed through the same versioned public contracts by first-party and external applications. Do not create a parallel first-party authorization path.

The existing governed mock executor is a conformance/test fixture only. It is not the canonical Governance Core runtime and must not become a second authorization architecture.

The next implementation work is therefore:

1. Map the canonical `galinyx-launch` runtime and the existing identity, AHAF, persistence, and trusted-service branches.
2. Identify and document the single protected-action enforcement seam in the canonical runtime.
3. Define versioned task, authorization, approval, decision, and audit contracts consumed by that runtime.
4. Integrate persistence through the existing migration strategy; do not fork data stores or blindly merge branches.
5. Demonstrate a first-party workload using the public runtime interfaces.
6. Demonstrate a second independent sample application using the same interfaces without privileged bypass.

The platform remains an offline local prototype until authentication, isolation, approvals, enforcement, and operational security are validated. Self-hosting is not a claim that GALINYX can autonomously modify, approve, merge, or deploy its own code.
