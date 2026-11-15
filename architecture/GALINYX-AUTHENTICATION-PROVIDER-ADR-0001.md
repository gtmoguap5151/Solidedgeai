# GALINYX — Authentication Provider Decision Record 0001

**Date:** 2026-11-15  
**Status:** Decision deferred; provider-neutral integration contract approved as the next design constraint  
**Scope:** Human authentication for the first personal-workspace service boundary  
**Related:** Identity and Ownership Boundary Design v0.1; draft PRs #5 and #6

## 1. Decision

Do **not** hard-code an identity vendor into GALINYX OS yet.

The service facade introduced in PR #6 accepts a credential and delegates verification to an injected authenticator. Preserve that provider-neutral seam. The next implementation must validate a real credential using a selected provider's supported protocol and derive the principal ID from verified claims or a trusted user-info response.

The current deterministic test authenticator is not a production authenticator. No real login, password storage, token verification, or session lifecycle has been implemented.

## 2. Why the decision is deferred

The product's first real deployment environment is not yet selected. The current runtime is local Python/SQLite; the broader GALINYX architecture is intended to be extensible and interoperable. Choosing a vendor before defining the deployment boundary could create avoidable coupling.

The immediate goal is not to build a proprietary identity system. It is to consume a proven identity provider while GALINYX retains its own tenant, ownership, permission, delegation, and audit policy.

## 3. Candidate comparison — current public plans and capabilities

| Candidate | Publicly documented entry tier | Strengths relevant to GALINYX | Trade-offs / questions |
|---|---|---|---|
| Supabase Auth | Free plan lists 50,000 monthly active users, social OAuth, OAuth 2.1 server, basic MFA; free projects pause after one week of inactivity | PostgreSQL ecosystem, user-data ownership, standards-based auth; potentially fits a later Postgres-backed service | Free project inactivity pause; separate database and auth lifecycle; verify exact JWT verification and operational model before adoption |
| Clerk | Hobby plan lists $0, 50,000 monthly retained users per app, sign-in APIs/UI, custom domain, and machine-auth features with monthly limits | Fast application integration, user-management UI, basic organizations and role features in free tier | MRU metric differs from MAU; free tier has fixed 7-day session lifetime and limited logs; advanced MFA and enterprise SSO are paid-tier features |
| Auth0 | Free tier lists up to 25,000 external active users and 1,000 machine-to-machine authentications | Mature identity platform, social/passwordless options, established OIDC/OAuth ecosystem | Free machine-to-machine allowance and paid-plan thresholds need careful review; may be more platform than the first prototype needs |
| Keycloak | Open-source IAM software; no software subscription fee | Self-hosted control, OIDC/OAuth 2.0/SAML, user federation, MFA and administrative controls | Not zero-cost to operate: hosting, upgrades, monitoring, backups, security response and availability become GALINYX's responsibility |

Pricing and quotas are vendor-published and may change. They are not a guarantee of free production operation or a complete security assessment.

Official sources reviewed:
- Supabase pricing: https://supabase.com/pricing
- Supabase billing and free-plan behavior: https://supabase.com/docs/guides/platform/billing-on-supabase
- Clerk pricing: https://clerk.com/pricing
- Auth0 pricing: https://auth0.com/pricing
- Keycloak capabilities: https://www.keycloak.org/
- Keycloak application integration guidance: https://www.keycloak.org/securing-apps/overview

## 4. Required integration contract

Whichever provider is selected, the GALINYX adapter must:

1. Validate a credential cryptographically or through a provider-supported trusted verification endpoint. Never decode a JWT and treat its contents as verified.
2. Validate issuer, audience, signature, expiry, not-before time, and permitted signing algorithm.
3. Map the verified, stable provider subject to an internal GALINYX principal ID. Email address is not the immutable principal key.
4. Reject missing, expired, malformed, wrong-issuer, wrong-audience, or revoked/disabled credentials according to a documented revocation-freshness policy.
5. Derive principal context server-side. Ignore or reject client-supplied principal, owner, actor, and approval identities.
6. Keep authentication separate from GALINYX authorization. A valid login does not grant tenant membership or resource permissions.
7. Keep human sessions separate from agent/workload credentials. Do not use a human access token as an agent identity.
8. Keep provider secrets and signing material out of source code, client bundles, logs, and user-controlled database fields.
9. Support account disablement, credential rotation, logout/session invalidation, recovery, and security event handling.
10. Provide a tested adapter interface so a provider can be replaced without rewriting GALINYX ownership and policy logic.

For browser-based sign-in, prefer the provider's supported OpenID Connect Authorization Code flow with PKCE. For backend verification, use a maintained library or the provider's documented verification mechanism; do not hand-roll JWT cryptography.

## 5. What the provider does — and does not — decide

The provider may establish that a credential represents a particular user. GALINYX must still decide:
- which internal principal that user maps to;
- which personal or organization tenant they may enter;
- which resources belong to that tenant;
- what their role permits;
- whether an agent may act on their behalf;
- whether an action requires human approval;
- what budget and constraints apply.

Provider organization roles must not silently become GALINYX agent rank, resource permissions, or delegated authority. Those remain separate GALINYX policy decisions.

## 6. Selection gates

Before choosing a provider, answer these questions with evidence:

- What is the first deployable GALINYX application and where will its backend run?
- Does the provider support standards-based verification from the chosen Python service?
- Can the free tier support the intended prototype without requiring a payment method or paid feature?
- What happens when a free project is idle, exceeds quotas, or is suspended?
- Can GALINYX export users and map them to internal principal IDs without losing ownership records?
- What are the session revocation and account-disablement semantics?
- Can human identity and future machine identity remain distinct?
- What are the data residency, privacy, backup, and incident-response responsibilities?

## 7. Recommendation for the current stage

Continue with the generic authenticator interface and test suite. Do not install or configure a provider yet. Once the first hosted service and deployment environment are selected, run a small provider proof-of-integration that validates real tokens and proves the negative cases in the requirements-to-tests specification.

**Decision status:** provider selection is intentionally open. The architecture should be vendor-replaceable; the security requirements are not optional.
