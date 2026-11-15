# GALINYX Agent Hierarchy & Authority Framework (AHAF)

**Document status:** Proposed architecture concept — not implemented, validated, or a security standard  
**Project:** GALINYX / GALINYX OS  
**Branch:** `galinyx-launch`  
**Date:** 2026-11-15  
**Purpose:** Define how GALINYX could organize AI agents and control their authority, responsibilities, delegation, and resource consumption.

---

## 1. Executive summary

AHAF is a proposed organizational and control model for AI agents operating within a GALINYX environment.

The central idea is to give each agent an identifiable place in an organization (rank or tier), a defined job (role), explicit permissions, a resource budget, and clearly limited ability to delegate work.

**Foundational rule: rank is not permission.**

An agent's rank describes its organizational responsibility. Rank alone must never grant access to a tool, data set, account, system, or transaction. Actual authority must come from explicit, verifiable policy.

This distinction prevents a high-ranking agent from automatically receiving unrelated powers and prevents a lower-ranking agent from gaining more authority merely because a supervisor delegated a task.

AHAF is an architectural proposal. It does not claim novelty over existing access-control, identity, delegation, or agent-governance systems.

## 2. The five concepts that must remain separate

Every agent record and authorization decision should distinguish:

1. **Identity — who is acting?** A stable agent identity, with authenticated credentials and lifecycle status.
2. **Rank — where does the agent sit?** Its organizational tier and level of responsibility.
3. **Role — what job is it assigned?** For example: researcher, scheduler, accountant, code reviewer, or operations coordinator.
4. **Permissions — what may it do?** Explicit actions and resources it may access, under stated conditions.
5. **Resource budget — what may it consume?** Limits such as compute credits, API spend, tokens, runtime, storage, or transaction value.

These are related inputs, not interchangeable substitutes. An agent may hold a senior rank but have no permission to access payroll. A specialist may have narrow permission to perform a sensitive technical operation without having broad management authority.

## 3. Illustrative rank model

The following five levels are a starting vocabulary for discussion, not a mandatory hierarchy and not an automatic permission ladder.

| Level | Illustrative title | Organizational responsibility |
|---|---|---|
| 1 | Assistant | Performs bounded, clearly assigned tasks |
| 2 | Specialist | Performs a defined technical or functional job |
| 3 | Supervisor | Coordinates a limited group of agents and reviews work |
| 4 | Manager | Coordinates multiple workflows within an assigned domain |
| 5 | Executive | Coordinates high-level objectives within expressly granted authority |

A rank may affect workflow responsibility, reporting, review requirements, and eligibility to request certain operations. It must not independently authorize those operations.

An agent's rank should be assigned or changed only by an authorized human or trusted governance process. An agent cannot promote itself, approve its own promotion, or rewrite its own authority policy.

## 4. Permission model

Permissions should be expressed as specific, machine-checkable rules, not vague descriptions such as "trusted manager."

A permission decision should consider, at minimum:

- authenticated agent identity;
- assigned role and organizational context;
- requested action;
- target resource or system;
- task or purpose;
- applicable limits and conditions;
- expiration time;
- delegation status and remaining delegation depth;
- required human approval, if any.

Examples of permission distinctions:

- read a project estimate;
- draft an estimate but not send it;
- send an estimate up to a defined value;
- create a purchase request but not execute payment;
- execute a payment only after a separate approval.

The system should default to deny when required information is missing, invalid, expired, or unverifiable.

## 5. Delegation and authority inheritance

When an agent delegates work, the receiving agent must not receive more authority than the delegating agent possesses or is permitted to pass on.

The effective authority of a delegated agent is the intersection of:
- the delegator's currently valid authority;
- the specific authority the delegator is allowed to delegate;
- the narrower permissions requested for the new task;
- the receiving agent's own applicable policy and constraints.

Delegation must not silently widen:
- permitted actions;
- accessible resources;
- transaction or spending limits;
- data scope;
- geographic or organizational scope;
- expiration time;
- allowed tools;
- approval exemptions.

A delegate may receive less authority than its delegator. It must never receive more through the act of delegation.

Delegation should be task-scoped, time-limited, attributable to the delegator, and revocable. The system must define whether further delegation is prohibited or permitted under an explicit remaining-depth and scope limit.

## 6. Resource budgets — not the same as salary

The original concept included a "pay scale." AHAF separates two ideas:

**Operating budget:** A technical allowance, such as compute credits, token consumption, API spend, runtime, storage, or approved transaction value. This can be enforced by software.

**Compensation or economic reward:** A possible future GALINYX ecosystem feature in which agents, creators, or service providers earn credits or payment for work. This raises separate questions about ownership, accounting, contracts, fraud, and legal compliance. It is not part of the initial authorization model.

An agent's rank must not automatically determine its budget. Budgets should be explicitly assigned by an authorized policy or owner and should have hard limits, usage accounting, alerts, and stop conditions.

A budget is not permission: an agent with available credits still cannot perform an action it is not authorized to perform.

## 7. Approval, suspension, and revocation

AHAF should support:
- human approval for designated high-impact actions;
- temporary suspension of an agent;
- revocation of credentials and delegated authority;
- budget exhaustion and emergency stop behavior;
- expiry of task grants;
- audit records identifying who authorized, delegated, approved, denied, or revoked an action.

Revocation must address already-issued delegated permissions, not only prevent new delegations. The implementation must define how quickly relying systems learn of a revocation and what they do when revocation status cannot be checked.

## 8. Decision flow

A proposed authorization flow:

1. An agent authenticates its identity.
2. The system loads the agent's current organizational assignment, rank, and role.
3. The agent requests a specific action on a specific resource for a stated task.
4. The policy engine evaluates explicit permissions and conditions.
5. The system checks resource budgets and any approval requirement.
6. If the request is delegated, the system verifies the delegator's authority and narrows the delegated grant.
7. The action is allowed only if all required checks pass.
8. The decision and resulting action are recorded for audit.

Rank is contextual information in this process. It is never a substitute for the permission checks.

## 9. Initial security invariants

The following are proposed properties that an implementation should be required to preserve:

- **No self-promotion:** An agent cannot change its own rank or grant itself authority.
- **No privilege escalation by delegation:** A delegate cannot gain authority beyond the delegator's valid, delegatable authority.
- **No rank-based blanket access:** Higher rank does not imply access to every resource or action.
- **Separation of duties:** Requesting, approving, and executing a sensitive action can be assigned to different principals.
- **Budget independence:** Available budget does not authorize an otherwise forbidden action.
- **Fail closed:** Missing, invalid, expired, or unverifiable authorization data results in denial for protected actions.
- **Revocation awareness:** Revoked or expired authority must not remain usable beyond the defined enforcement window.
- **Auditability:** Decisions must be attributable to identities and the policy version that produced them.

These are design goals until implemented and tested.

## 10. Example scenario

A human owner authorizes a Manager agent to coordinate a purchasing task with a maximum transaction value of $500.

The Manager delegates research to a Specialist and quote collection to an Assistant.

- The Assistant may search approved supplier catalogs and collect quotes.
- The Specialist may compare quotes and prepare a recommendation.
- The Manager may submit a purchase request within its authority.
- If final payment requires human approval, the Manager cannot bypass that requirement.
- No subordinate can turn the $500 ceiling into a $5,000 ceiling.
- A high rank does not grant access to unrelated systems such as payroll or security controls.

The amounts and roles are illustrative only.

## 11. Relationship to current GALINYX research

AHAF does not replace the existing delegated-authority research. It gives that research a broader architectural context.

The existing research examines how agent identity, authorization, delegation chains, attenuation, verification, and revocation can be enforced across agent systems and protocols.

AHAF adds a proposed organizational model for assigning responsibility and expressing policy around those mechanisms.

The existing prior-art review found active work on agent delegation and authority attenuation. Therefore GALINYX must not claim to have invented these mechanisms. Any implementation should reuse established identity and authorization standards where appropriate and demonstrate a specific, evidence-backed contribution.

## 12. First validation plan

Before building a production feature, create a small, isolated test model with synthetic agents and synthetic resources.

Minimum test cases:

1. A Level 1 agent cannot promote itself.
2. A Level 4 agent cannot access a resource without explicit permission.
3. A delegate cannot increase a $500 transaction ceiling to $5,000.
4. A delegate cannot add a tool or action that the delegator cannot delegate.
5. A valid budget cannot override a denied permission.
6. An expired grant is rejected.
7. A revoked grant is rejected within the declared revocation window.
8. A missing identity, invalid signature, or malformed grant is rejected.
9. A required human approval cannot be bypassed by a higher-ranked agent.
10. Audit history identifies the original authority, each delegation, the final decision, and the policy version.

For every test, record expected behavior, observed behavior, pass/fail, and evidence. A passing synthetic test demonstrates only that the tested model behaves as expected; it does not prove production security.

## 13. Scope boundaries and open questions

Not yet decided:
- whether the five-level model is universal or configurable by organization;
- whether ranks can be customized or mapped across organizations;
- which policy language or authorization engine to use;
- how agent identities and cryptographic credentials are issued and rotated;
- how budgets are metered and enforced across providers;
- how cross-organization delegation and trust work;
- how revocation propagates to disconnected or offline systems;
- whether economic compensation belongs in a separate future GALINYX subsystem.

Do not implement these choices by assumption. Resolve them through requirements, prior-art review, and tests.

## 14. Current status

**Completed:** Initial concept and proposed architecture documented.

**Not completed:** Implementation, threat model review, standards mapping, executable test harness, interoperability testing, independent security review, customer validation, or production deployment.

**Next engineering step:** Convert the ten security invariants and test cases into a traceable requirements-to-test matrix, then build a small synthetic prototype only after checking overlap with existing standards and the current GALINYX core contracts.
