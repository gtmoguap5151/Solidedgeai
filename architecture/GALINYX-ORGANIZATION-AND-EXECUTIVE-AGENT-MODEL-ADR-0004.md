# GALINYX — Organization and AI Executive Model ADR 0004

**Status:** Proposed architecture; no implementation claim  
**Date:** 2026-11-16  
**Branch:** `galinyx-org-executive-model`  
**Depends on:** Master System Architecture v1.0; AHAF; Identity/Ownership Boundary ADR; AHAF Runtime Integration Boundary ADR 0002; Persistent AHAF Store ADR 0003

## 1. Purpose

Define how GALINYX OS should represent real operating organizations and the AI executives assigned to manage work within them. This is the platform model needed to use GALINYX to create and govern AI CEOs for the founder's own ventures, then offer the same capability to other organizations.

This ADR extends the existing identity, organization, agent hierarchy, and authority architecture. It does not replace AHAF or introduce a second permission system.

## 2. Core decision

An **organization** is a first-class GALINYX tenant and operational boundary. It owns or is responsible for its people, agents, applications, resources, policies, budgets, and audit records.

An **AI executive** is an agent entity appointed to an organizational position. A CEO is not a special kind of omnipotent agent. It is an organizational appointment with a defined role and responsibilities, backed by explicit AHAF grants.

Keep these concepts separate:

- **Organization:** which operating boundary the work belongs to.
- **Agent identity:** which software actor is acting.
- **Position/title:** the job assigned within the organization (for example, CEO, COO, CFO, department manager, or specialist).
- **AHAF rank:** organizational responsibility tier (Assistant, Specialist, Supervisor, Manager, Executive).
- **Role:** the functional duties assigned to the agent.
- **Permissions/grants:** the exact actions and resources the agent may access, under what conditions.
- **Budget:** the resource and transaction limits available to the agent.
- **Human governance:** the accountable human owner or authorized governance body that appoints agents, grants authority, approves reserved actions, suspends agents, and revokes authority.

A title or rank must never automatically create permissions. In particular, a CEO title does not confer unrestricted access to banking, payroll, legal execution, ownership changes, security controls, or other organizations.

## 3. Organization and business-unit model

The platform must distinguish an operational organization from a legal entity. Creating an organization workspace in GALINYX does not form a company, establish legal ownership, or determine tax or liability treatment.

The model must support:
- independent organizations with their own tenant boundaries;
- parent/child organizational units and business units;
- explicit human owners and organization memberships;
- agents assigned to one organization by default;
- narrowly scoped cross-organization collaboration;
- organization-specific policies, operating models, budgets, and audit history.

Initial reference configuration for internal validation (conceptual, not a statement of legal formation or ownership records):

- **Southeast Home Service:** blue-collar operating group.
  - **Rivet Reach:** business/technology unit or brand within the Southeast Home Service group unless and until its legal and ownership status is separately established.
- **GALINYX:** white-collar technology and corporate systems group; also the platform developer/operator.
- **NYX AI Academy:** existing education venture, represented as its own organizational workspace or business unit according to its eventual legal/operating arrangement.

Do not create separate legal subsidiaries or assume a holding-company structure in software merely because an organization or business unit exists.

## 4. AI executive appointment model

An AI executive appointment must bind:
- an existing agent identity;
- one organization/tenant;
- one position/title;
- a role definition and version;
- an AHAF rank;
- an effective start and optional end time;
- the human principal or governance authority that made the appointment;
- the applicable policy and grant references;
- appointment status (active, suspended, ended).

The same agent must not silently act as CEO for multiple organizations. Any multi-organization appointment requires explicit separate appointments and grants, with independent tenant checks and audit attribution.

An organization may have an AI CEO and no additional AI department managers. GALINYX must support modular structures: create only the executive, departments, managers, or specialists the organization actually needs. Industry operating-model templates may recommend structures, but must not force every organization into an identical hierarchy.

## 5. Authority and reserved human powers

Every protected operation must enforce the intersection of:
1. authenticated human or workload identity at the trusted service boundary;
2. active organization membership and resource ownership;
3. the agent's server-resolved binding to that organization;
4. an active AHAF grant covering the exact action, resource, context, time, and limits;
5. entity capability and validated task contract;
6. independent authenticated approval where required.

The human owner retains the ability to:
- appoint, suspend, replace, or remove an AI executive;
- grant, narrow, or revoke agent authority;
- set and change budgets and transaction ceilings;
- define reserved decisions and required approvals;
- inspect decisions, activity, performance, and audit records;
- stop the agent and disable integrations.

An agent may recommend a new role, hire, delegation, budget, policy, or organizational change. It cannot authorize its own promotion, issue itself new root authority, approve its own high-impact action, or deploy a policy change that expands its own permissions.

Cross-organization access is denied by default. A central GALINYX coordination service is not a super-agent and does not inherit all tenant data or permissions. Cross-company work requires explicit purpose, data scope, authority, and audit records.

## 6. Industry-specific operating models

GALINYX should support reusable industry operating-model packages rather than one identical management chart for every business. A package may define suggested positions, workflows, controls, metrics, and permission templates. Applying a package creates a proposed configuration only; an authorized human must review and activate appointments and grants.

The system must permit a small business to operate with one AI executive and a few specialist agents, while a larger or regulated organization may require additional human managers, independent approvers, separation of duties, and stricter controls.

## 7. Required data model (proposed)

The implementation should evaluate normalized records for:
- organizations/tenants and organization status;
- parent-child organizational relationships or business-unit membership;
- human membership and organization roles;
- agent-to-organization bindings;
- executive appointments and appointment history;
- versioned role and industry operating-model definitions;
- AHAF grants scoped to the organization and agent;
- reserved-action and approval policies;
- performance objectives and reporting relationships.

Do not overload the current personal-workspace membership role with corporate job titles. Keep tenant access roles, organizational positions, AHAF ranks, functional roles, and permissions distinct.

## 8. Implementation sequence

1. Extend the current personal-workspace model to support organization tenants through a forward-only SQLite migration. Preserve existing personal workspaces and their memberships.
2. Add organization membership and parent/child business-unit relationships without treating them as proof of legal ownership.
3. Add versioned agent appointments to organizational positions.
4. Bind appointments to the existing persistent AHAF agent bindings and grants; do not duplicate grant logic.
5. Integrate authorization at the single trusted service boundary. No direct runtime or alternate execution path may bypass the full policy chain.
6. Implement authenticated human approvals and authenticated agent/workload identity before privileged execution.
7. Add an end-to-end internal demonstration using Southeast Home Service, GALINYX, and NYX AI Academy, with Rivet Reach represented at the correct business-unit level.
8. Test tenant isolation, appointment changes, suspension, revocation, cross-organization denial, delegated authority, reserved human powers, budget enforcement, and audit provenance.

## 9. Acceptance tests

At minimum:
- A personal workspace continues to work after migration.
- An organization tenant can be created only by an authenticated, authorized human governance actor.
- An agent cannot be appointed to an organization it is not bound to.
- A CEO title or Executive rank alone grants no action.
- A CEO agent cannot read another organization's resources without an explicit grant.
- A CEO cannot change its own appointment, rank, root grant, or approval requirements.
- A delegated agent cannot exceed the CEO agent's delegable authority.
- Suspension or revocation blocks new protected work and invalidates descendant grants according to the documented consistency bound.
- An approval cannot be replayed for another action, resource, amount, or request.
- Cross-company coordination exposes only the expressly authorized data and actions.
- Every decision is attributable to the authenticated principal, agent, organization, grant/policy version, request, and outcome.
- A small organization can run without artificial departments or unnecessary management agents.

## 10. Explicit non-goals

This ADR does not:
- establish the user's legal corporate ownership structure or form subsidiaries;
- make an AI agent a legally recognized corporate officer or replace required human directors, officers, license holders, or fiduciaries;
- authorize autonomous banking, payroll, legal commitments, hiring/firing, ownership transfers, or other high-impact acts;
- claim production security, regulatory compliance, or independent certification;
- require every organization to have the same departments or management hierarchy.

## 11. Current implementation boundary

As of this ADR, the persistent AHAF store is a prototype record layer. It supports owner-checked local bindings, root and attenuated delegated grant records, revocation, integer-unit budget reservation/settlement, and hash-chain verification. It does not authenticate callers, evaluate action/resource authorization, validate authenticated human approvals, or execute tasks.

The current workspace schema is personal-workspace-oriented. Organization tenants and executive appointments are not yet implemented. This ADR therefore records the next architecture requirement; it does not describe a completed feature.
