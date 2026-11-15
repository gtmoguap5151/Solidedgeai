# GALINYX — Identity and Ownership Boundary Design

**Version:** 0.1  
**Date:** 2026-11-15  
**Status:** Proposed engineering design; not implemented or security-validated  
**Parent architecture:** `architecture/GALINYX-MASTER-SYSTEM-ARCHITECTURE-v1.0.md`  
**Traceability:** `architecture/GALINYX-ARCHITECTURE-TRACEABILITY-MATRIX-v0.1.md`

---

## 1. Why this is the next foundation

The current prototype accepts an entity ID supplied by its caller. That is acceptable only inside its documented trusted-local development boundary. It does not prove who the caller is, who owns the entity, or whether the caller is authorized to act for that owner.

Before GALINYX supports multiple people, organizations, or remotely operating agents, it must distinguish identity from ownership and permission.

**Plain English:** a name badge is not proof that you are the person wearing it. And being an employee of a company does not mean you can open every door in the building.

## 2. Terms that must not be confused

| Term | Meaning | Example |
|---|---|---|
| Principal | An authenticated actor that can request an action | A human user, agent workload, or service |
| Identity | The verified identifier and credentials for a principal | A user account plus an authenticated session |
| Tenant | The security and data-isolation boundary | A person's workspace or an organization's workspace |
| Owner | The principal or tenant that controls a resource under policy | An organization owns an application registration |
| Entity | A thing represented in GALINYX | Agent, app, organization, project, world |
| Actor | The principal actually making this request | An agent acting under a delegated grant |
| Subject/resource | The object an action is being performed against | A project record or creator asset |
| Role | A named bundle of responsibilities or permissions | Researcher, reviewer, administrator |
| Permission | An explicit action allowed on a resource under conditions | Read a project, draft an asset |
| Delegation | A bounded grant allowing one principal to act through another | A user authorizes an agent to prepare a draft |

Identity answers **who is acting?** Ownership answers **whose resource is this?** Authorization answers **may this actor perform this action on this resource now?**

A correct decision needs all three.

## 3. Proposed principal types

The platform should support these principal categories without treating them as interchangeable:

1. **Human principal** — an individual using GALINYX.
2. **Organization principal** — a legally or operationally recognized organization represented within the platform. Its existence and authority must be verified according to the product's requirements; merely creating an organization record does not verify a real-world company.
3. **Agent principal** — a software agent with its own stable identity and lifecycle.
4. **Application principal** — an installed or registered application acting within a defined application boundary.
5. **Service principal** — a platform or integration service acting for a narrowly defined technical purpose.

An agent is not a human. An organization record is not proof of legal registration. An application ID is not permission to access every user's data.

## 4. Recommended ownership model

Support both individual and organization workspaces.

- An individual can own a personal tenant.
- An organization can own an organization tenant.
- A user may be a member of multiple organization tenants.
- An entity/resource belongs to exactly one tenant at creation.
- A resource may have multiple authorized collaborators, but sharing does not silently transfer ownership.
- An agent belongs to a tenant and has an authenticated controller/owner relationship.
- An agent may act for a user or organization only through an explicit, bounded authorization grant.
- Cross-tenant access is denied by default and requires a separately defined sharing or transfer operation.

This model avoids the mistake of using one `owner_id` field to represent the person who created a record, the organization that owns it, the tenant that isolates it, and the agent currently acting on it. Those are different relationships.

## 5. Minimum conceptual records

These are proposed data concepts, not a finalized SQL schema.

### Principal
- principal_id
- principal_type
- identity_provider / credential reference
- lifecycle_status
- created_at
- disabled_at

### Tenant
- tenant_id
- tenant_type: individual or organization
- lifecycle_status
- created_at

### TenantMembership
- tenant_id
- principal_id
- membership_status
- role reference
- joined_at
- revoked_at

### EntityOwnership
- entity_id
- tenant_id
- owner_principal_id, where direct individual ownership is needed
- created_at
- ownership_status

### AgentRegistration
- agent_id
- tenant_id
- controller_principal_id
- credential/key reference
- software/build identity reference, when available
- lifecycle_status
- created_at
- revoked_at

### DelegationGrant
- grant_id
- granting_principal_id
- receiving_principal_id
- tenant_id
- allowed_actions
- resource_scope
- constraints
- issued_at
- expires_at
- revoked_at
- parent_grant_id, when delegated from another grant

The exact credential format and identity provider are intentionally undecided. Do not invent a GALINYX identity protocol when established identity and workload-credential standards may meet the need.

## 6. Authorization decision

Every protected operation should be evaluated against a complete request context:

- authenticated actor;
- actor's principal type and current status;
- tenant context;
- resource identity and tenant ownership;
- requested action;
- applicable role and explicit permissions;
- delegation grant, if acting on behalf of another principal;
- grant expiry and revocation state;
- resource and action constraints;
- required approval state;
- resource budget and rate limits.

**Decision rule:** if the platform cannot establish the actor, tenant, resource ownership, applicable authority, or required approval, it denies the protected action.

The platform must not accept a caller-provided `actor_id`, `owner_id`, `tenant_id`, or `approved_by` as proof of those facts.

## 7. Required security invariants

| ID | Invariant | Required negative test |
|---|---|---|
| ID-01 | Every remote protected request has an authenticated principal | Missing, expired or invalid credentials are denied |
| ID-02 | Principal type is explicit | Agent credentials cannot be used as a human session |
| TEN-01 | Every resource belongs to a tenant | Resource creation without an authorized tenant is denied |
| TEN-02 | Tenant boundaries are enforced server-side | Tenant A cannot read or mutate Tenant B's resource by changing an ID |
| OWN-01 | Ownership is established by trusted platform state | Caller cannot claim another principal as owner |
| MEM-01 | Membership is current and revocable | Removed member loses access without relying on client-side state |
| AGT-01 | Agent identity is distinct from its controller | Agent cannot impersonate the human who registered it |
| DEL-01 | Delegation is explicit, scoped and time-bounded | Agent cannot use an action or resource outside the grant |
| DEL-02 | Delegation cannot increase authority | Child grant cannot exceed the authority of its parent grant |
| DEL-03 | Revoked grants stop authorizing new actions | A revoked or expired grant is denied |
| APR-01 | Approval identifies an authenticated approver | Caller cannot self-assert another reviewer |
| AUD-01 | Audit actor comes from verified request context | Caller cannot forge the recorded actor |
| FAIL-01 | Uncertainty fails closed for protected operations | Missing policy, identity or ownership record causes denial |

## 8. Current prototype changes implied by this design

Do not add these fields to the current SQLite schema and call the system secure. A field is not a security boundary.

Before implementation:
1. Choose the first supported identity provider or authentication mechanism.
2. Define how a verified principal is attached to a request.
3. Define tenant creation and membership lifecycle.
4. Define resource ownership and migration for existing local entities.
5. Define the trusted service boundary; keep the existing CLI explicitly local-only.
6. Build adversarial tests for spoofing and cross-tenant access before adding public endpoints.

The existing prototype can remain a local development runtime while this model is designed. No production database should be migrated or deleted as part of this proposal.

## 9. Decisions deliberately left open

1. Identity provider and credential lifecycle.
2. Whether organization verification is required for the first release or only for organization-specific features.
3. Whether the first multi-user release is individual-first or organization-first.
4. How agent workloads prove possession of their credentials.
5. How tenant deletion, export, recovery and legal retention interact.
6. Whether a user can belong to multiple tenants with different identities or roles.

These decisions should be made against the first real use cases, not by building an elaborate identity system without a validated product need.

## 10. Recommended first implementation boundary

The first implementation should be deliberately small:

- authenticated human principal;
- personal tenant;
- resource ownership enforced by the service, not supplied by the client;
- no cross-tenant sharing;
- no autonomous external agent actions;
- no payments or publishing;
- audit records tied to the authenticated principal.

Once that boundary is proven, add organization membership and agent delegation as separate increments.

**Bottom line:** GALINYX needs to know who is acting, which workspace they are acting within, whose resource they are touching, and what authority they have. Until those facts are trustworthy, higher-level autonomy must remain behind the gate.
