# GALINYX — Funding Readiness Brief
**Status:** Internal working draft — not an application, offer, or representation that funding is secured  
**Prepared:** 2026-11-15  
**Project identity:** GALINYX (master ecosystem); GALINYX OS (foundational platform layer)  
**Source of truth:** `galinyx-launch` branch of `gtmoguap5151/Solidedgeai`

## 1. Executive position

GALINYX is an early-stage technology project exploring an extensible platform layer through which independently developed applications, services, organizations, and AI agents can interoperate under explicit identity, ownership, permission, task, event, and resource-governance contracts.

GALINYX OS is intended to provide shared platform capabilities. It is not a replacement computer kernel, a finished commercial operating system, or a currently deployed multi-tenant service.

The funding case must be built around a bounded, testable technical R&D project—not the full long-range ecosystem vision.

## 2. Verified current baseline

The current `galinyx-launch` branch contains a standard-library-only Python prototype backed by SQLite. The repository documentation and source identify these implemented elements:

- Durable entity registry and per-entity memory records
- Deny-by-default capability checks
- Task records and application-level audit events
- Idempotency keys bound to action, entity, and payload digest
- A Creator workflow with deterministic/offline scene drafting

The current prototype does **not** include:
- An integrated external AI model or provider adapter
- Real human authentication or verified entity ownership
- Production multi-tenant authorization or independently authenticated human approvals
- A public network API, production execution sandbox, or production quotas
- Live publishing, payment execution, or completed cross-application integrations

The Creator drafting behavior is deterministic/offline, not AI-generated. A stored story plan is not a generated story.

### Branch and test status (checked 2026-11-15)

- Default branch: `main`
- Working branch: `galinyx-launch`
- Working-branch head at this review: `6305030aa959ac64784c7fb22487035c41943471`
- Open draft PR #4: `galinyx-core-contracts` into `galinyx-launch`; adds versioned data contracts, manifest registration, schema version tracking, a preservation-oriented migration, and a local CLI.
- GitHub Actions runs on PR #4's head included successful `Galinyx OS Tests` runs at commit `091821605ebd1f1eb9e825dd3b7fdbcef3829cb1`.
- PR #4 remains unmerged. Its passing workflow is evidence for that PR head only; it is not evidence that the working branch or a production deployment has those changes.

No claim is made here that a deployed product, security audit, penetration test, or production release has been completed.

## 3. Candidate R&D problem — not yet validated as novel

**Working research question:** Can a platform provide portable, versioned task and authority contracts that allow independently developed applications and agents to delegate bounded work while preserving owner-scoped authorization, explicit human approval for sensitive actions, revocation, idempotency, and auditable event provenance?

This is a candidate research direction, not a proven invention or established differentiator. Existing identity, authorization, workflow, agent-interoperability, and audit technologies must be compared before claiming novelty. The project must identify a specific technical gap that existing approaches do not adequately solve.

### Hypothesis to test

A common, versioned execution-and-authority contract can reduce integration inconsistency across heterogeneous applications while preserving enforceable permission boundaries and traceable task histories.

### Proposed measurable evaluation

The R&D plan should define and test:
1. Cross-application contract compatibility across at least two independently implemented application types.
2. Correct rejection of unauthorized, expired, revoked, malformed, and replayed tasks.
3. Human approval bound to the exact action, target, content, and expiry for designated high-impact actions.
4. Isolation of owner-scoped data under adversarial cross-tenant access tests.
5. Event provenance and tamper-detection behavior under a defined threat model.
6. Resource-budget enforcement and safe failure under load and concurrency tests.
7. Reproducible build and test results from a clean checkout.

Numerical performance targets, baselines, sample sizes, and acceptance thresholds must be set before submission; they are intentionally not invented in this draft.

## 4. Proposed staged use of funds

Funding would support a defined R&D work package, subject to the selected program's rules and an approved budget:

- **Work package A — contracts and migration:** review and reconcile PR #4, stabilize versioned schemas, migration and compatibility tests.
- **Work package B — identity and authorization:** implement authenticated identity, ownership checks, server-controlled capability grants, and action-bound human approvals.
- **Work package C — safe execution:** add task isolation, revocation, idempotency under concurrency, quotas, and explicit failure handling.
- **Work package D — data and audit integrity:** implement export/deletion, backup/restore, provenance, and tamper-evident audit controls.
- **Work package E — interoperability demonstration:** run two independent application types against the same documented contracts and publish reproducible evaluation results.

No budget allocation is proposed until the exact research scope, eligible personnel, indirect-cost rules, and program requirements are confirmed.

## 5. Funding routes under consideration

### NSF America's Seed Fund / SBIR
Potential route for a genuinely novel, high-risk technical R&D project. NSF requires a Project Pitch invitation before a full Phase I proposal. The NSF page currently lists **March 4, 2027** as the next full-proposal deadline. The technical problem must fit NSF's deep-technology remit; a broad platform vision or ordinary product-development plan is not enough.

NSF's published instructions include sole proprietorships among possible organizational forms, so LLC formation is not automatically a prerequisite for this route. The applicant must still meet all current ownership, employment, U.S. work-location, registration, and solicitation requirements. Confirm eligibility before submission.

### Kentucky KSTC pre-seed
KSTC currently describes a $20,000 pre-seed investment with no matching requirement. This is an investment, not a grant. KSTC requires an LLC or C-Corp and a qualifying Kentucky business presence. It is therefore a later option if the founder can form the company without creating an unaffordable burden and is willing to evaluate the investment terms.

### Kentucky SBIR/STTR matching
This is a possible follow-on only after winning a qualifying federal SBIR/STTR award. The state describes it as a competitive, reimbursable match, not upfront startup capital.

## 6. Immediate no-cost readiness sequence

1. Preserve the current working branch and review PR #4 in detail; do not merge blindly.
2. Establish a reproducible baseline on the exact candidate commit.
3. Complete a prior-art and competitor analysis of identity, authorization, delegated execution, agent interoperability, and audit systems.
4. Select one defensible technical gap and define the research hypothesis, baseline, metrics, and pass/fail criteria.
5. Obtain customer/problem validation from prospective developers, application builders, and organizations that would use the proposed platform.
6. Draft the NSF Project Pitch only if the technical gap and eligibility withstand review.
7. Keep the KSTC investment route on the later-stage list until legal formation and Kentucky-presence requirements can be met.

## 7. Claims discipline

Until supported by evidence, do not claim that GALINYX OS is production-ready, autonomous, AI-integrated, secure for multi-tenant use, certified, patented, trademark-cleared, or already interoperable with the named ecosystem projects.

Do not describe planned integrations as completed. Do not promise commercial outcomes, revenue, investor returns, or award selection.

## 8. Open diligence items

- Confirm the intended applicant's legal form and ownership before any application.
- Confirm where the applicant's principal place of business and funded work will be located.
- Confirm who could serve as the technical Principal Investigator and satisfy the selected program's employment/time commitment.
- Identify prospective users and obtain documented feedback.
- Determine the exact R&D scope and eligible budget.
- Review all third-party code, dependencies, licenses, and intellectual-property ownership before external disclosure.
- Confirm current solicitation terms and deadlines immediately before applying.

**Decision:** Build the evidence and Project Pitch first. Do not spend money on company formation solely to pursue a program that may accept a sole proprietorship. Do not submit a grant application until the research problem, eligibility, and measurable work plan are defensible.
