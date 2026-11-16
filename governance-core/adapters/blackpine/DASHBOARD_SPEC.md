# GALINYX Control Room — BLACKPINE FIELD Dashboard Specification

## Purpose
A mobile-first operator console that makes GALINYX governance, BLACKPINE FIELD operations, evidence, revenue measurement, approvals, and outcomes visible in one place. The dashboard is an interface to governed systems, not an authority of its own. Human authority remains final.

## Initial operating mode
- Read-only observation by default.
- Show verified source, capture time, period, and freshness for every external metric.
- Unknown or unavailable values render as "Not connected", "Not yet measured", or "Stale" — never as zero.
- Distinguish live source data, repository-derived checks, synthetic test results, and manually supplied reports.
- No publishing, spending, affiliate-account changes, customer-policy changes, or external outreach from the first release.
- Recommendations can be prepared for review; execution remains disabled unless a separate, explicit human approval and a valid scoped authorization exist.

## Primary navigation
1. **Overview** — overall system health, current priority, last successful sync, outstanding blockers, and a concise business pulse.
2. **BLACKPINE FIELD** — storefront health, Cloudflare Pages deployment, custom domain, product/guide counts, affiliate disclosure checks, and site change history.
3. **Revenue** — sessions, product-page views, outbound affiliate clicks, orders, reversals, commissions, and attributable revenue. Show funnel conversion only when numerator and denominator share a compatible period and source.
4. **Opportunities** — evidence-backed revenue opportunities ranked by priority, with evidence, business mechanism, uncertainty, required approval, and expected measurement.
5. **Governance** — policies, authority registry, rank and level, allowed/denied operations, approval queue, and authorization expiry/revocation.
6. **Evidence** — analytics exports, affiliate reports, product/manufacturer references, retailer price evidence, provenance, verification status, and freshness.
7. **Audit Trail** — immutable event history for observations, recommendations, approvals, denials, actions, rollbacks, and outcomes.
8. **Connections** — GitHub, Cloudflare Pages, GA4, Awin, CJ, and future connectors, each showing connection state, permission scope, last successful read, and known gaps.

## Overview cards
- Storefront status and latest production deployment.
- Measurement coverage: GA4, affiliate clicks, commissions.
- Revenue: display only source-backed totals for a clearly stated period; otherwise show "Not measured".
- Top three active opportunities.
- Approval queue and governance warnings.
- Last data refresh and evidence freshness.

## BLACKPINE FIELD integration
Initial confirmed Cloudflare Pages configuration (captured 2026-11-16):
- Pages project: blackpine-field
- Custom domain: blackpinefield.com
- Pages subdomain: blackpine-field.pages.dev
- GitHub source: gtmoguap5151/blackpine-field
- Production branch: main
- Build output directory: site
- Latest known production deployment: 2026-11-13, successful
- Cloudflare Pages Web Analytics tag/token: not configured in the Pages project settings at capture time
- GA4 tracking snippet: not detected in the inspected homepage source; full-site verification remains required.
These are observations, not proof that all possible third-party or injected tracking is absent.

## Data contracts
Every metric/evidence record must include:
- source system and source account/property identifier (non-secret)
- source report or endpoint
- captured_at timestamp and timezone
- reporting period start/end
- currency where relevant
- verification status and verifier
- freshness state
- raw artifact reference or reproducible source pointer
- integrity hash for imported files where available

Never merge incompatible reporting periods, currencies, attribution models, or time zones without an explicit normalization record.

## Governance and safety
- Human authority is final.
- Separate role/rank from competence/level.
- Default to least privilege and read-only connectors.
- Keep credentials and tokens server-side; never expose secrets to browser clients or logs.
- Every approval is scoped to exact operation, resource, and expiry.
- Denials, expirations, revocations, and rollbacks are first-class audit events.
- Recommendations must explain evidence, mechanism, uncertainty, and how success will be measured.
- No self-modifying policy or silent privilege escalation.

## Phased delivery
### Phase 1 — Visibility shell
Responsive dashboard with clearly labelled mock/known/unknown states; no writes to business systems.
### Phase 2 — Verified read integrations
Read-only Cloudflare Pages and GitHub status; GA4 and affiliate CSV intake with provenance and freshness.
### Phase 3 — Evidence and opportunity operations
Ranked opportunities, review workflow, approval queue, and outcome tracking.
### Phase 4 — Governed execution
Only after separate security review: narrowly scoped server-side actions with explicit approvals, idempotency, rollback, and audit receipts.

## Acceptance criteria
- A phone user can understand current status in under one minute.
- Every displayed number is traceable to a source and period.
- Missing data is never presented as zero.
- Test/synthetic data is visually distinct from live business data.
- No action can publish, spend, or alter a commercial relationship without an explicit human approval.
- The dashboard never claims revenue impact until measured outcomes support the claim.
