# GALINYX Intellectual Property Asset Register

**Record date:** 2026-11-16  
**Repository:** `gtmoguap5151/Solidedgeai`  
**Working branch:** `galinyx-ai-workforce-v1`  
**Status:** Initial inventory — ownership, authorship, provenance, and third-party rights remain subject to verification.

## Purpose and ownership boundary

This register identifies potentially protectable GALINYX-related materials currently visible in this repository. It is an evidence and diligence register, not a legal determination, registration, assignment, or proof that every listed item is exclusively owned by the intended individual owner.

The founder's recorded intention is personal ownership. No assignment, transfer, contribution, sale, pledge, or license is made by this register. Do not infer that Southeast Home Service, BLACKPINE FIELD, NYX AI as a separate entity, or any future company owns these assets.

## Asset inventory

| ID | Asset family | Current repository evidence | Potential protection | Verification required |
|---|---|---|---|---|
| GX-001 | GALINYX ecosystem architecture and identity | `docs/galinyx-ecosystem-and-nyx-ai-charter.md` | Copyright in original written expression; possible trademark rights in eligible names/logos | First-use dates, drafts, public disclosures, name clearance, logo/design authorship |
| GX-002 | Governance Core architecture and implementation | `governance-core/README.md`; `governance-core/src/`; `governance-core/test/` | Copyright in original code/docs; confidential know-how in non-public policy design | Author/contributor history, code provenance, dependency/license review, invention analysis |
| GX-003 | Governance policy and authority model | `authority-registry.mjs`, `execution-policy.mjs`, related tests | Copyright in original expression; possible trade-secret value in non-public methods | Identify pre-existing concepts, third-party inputs, dated design records, public disclosures |
| GX-004 | BLACKPINE FIELD adapter and evidence-control implementation | `governance-core/adapters/blackpine/` | Copyright in original adapter code, policy expression, documentation | Separate GALINYX platform IP from BLACKPINE-specific data/content; verify repository permissions and source rights |
| GX-005 | AI Workforce orchestration | `ai-workforce/` including roles, orchestration, providers, handoff and tests | Copyright in original code/docs; possible trade-secret value in non-public orchestration methods | Contributor and commit audit, provider/API terms, dependency inventory, disclosure review |
| GX-006 | Six specialist workforce role definitions | `ai-workforce/roles.mjs` and workforce documentation | Copyright in original role descriptions and selection/coordination expression | Verify originality and dates; generic job functions alone may not be protectable |
| GX-007 | Control Room and Evidence Studio interface | `artifacts/solidedgeai/src/App.tsx`; `src/components/EvidenceStudio.tsx`; related UI | Copyright in original UI code, text, layout and graphics | Separate original work from generated/scaffolded code and third-party UI components |
| GX-008 | NYX AI Academy web application and learning materials | `artifacts/solidedgeai/src/pages/AcademyPage.tsx`, `ProgramsPage.tsx`, `ResourcesPage.tsx`, `SkillLabPage.tsx`, `AssessmentPage.tsx`, `courseData.ts`, `builtInResources.ts` | Copyright in original course text, curriculum expression, assessments, software and graphics; possible trademark rights | Identify original vs sourced learning content, author, source/license, dates and first use |
| GX-009 | NYX AI identity and related ecosystem materials | NYX AI references in ecosystem charter and Academy application | Copyright in original brand materials; possible trademark rights | Exact goods/services, first-use dates, name/logo ownership and clearance |
| GX-010 | GALINYX OS product and application implementation | `artifacts/solidedgeai/` application source, configuration and UI | Copyright in original source and authored content | Determine which parts are GALINYX OS platform assets versus NYX AI Academy product/application assets; inspect history and dependencies |
| GX-011 | Revenue measurement and operating methods | BLACKPINE adapter measurement, revenue opportunity and policy files | Copyright in original code/docs; possible trade-secret value in non-public methods | Keep BLACKPINE business data and third-party affiliate/store content separate; verify source and access rights |
| GX-012 | Brand, visual, written and media assets not represented in this tree | Any separately stored logos, graphics, videos, course files, diagrams, prompts, specifications or design source files | Copyright; possible trademark and trade-secret protection | Locate originals, identify creators, creation dates, source files, licenses, and publication history |

## Third-party and generated-material boundary

The repository includes software and UI dependencies, framework-generated/scaffolded structures, provider integrations, and potentially third-party learning or product-reference content. Their presence does **not** make those materials personally owned GALINYX IP.

For every dependency or externally sourced asset, record:
- package, author/publisher, version and source;
- applicable license or terms of use;
- whether the material is modified;
- required notices/attribution and redistribution conditions;
- whether it is compatible with the intended commercial distribution.

AI-assisted output should be recorded with the available prompt, model/provider, date, human editing, and contributor information. Do not assume that AI-generated material automatically qualifies for copyright protection or that its output is free of third-party rights.

## Evidence to preserve

For each asset, maintain:
1. Original source files and dated drafts.
2. Git commit history and immutable commit identifiers.
3. Named human authors, contributors, contractors, and their agreements.
4. Prompt/model records for material AI-assisted contributions, where available.
5. Third-party dependency and content-source records.
6. First-use, publication, pitch, demo, and other disclosure dates.
7. Any confidentiality agreements, licenses, permissions, or assignments.
8. Registration filings and counsel advice, if later obtained.

Do not rewrite history or backdate records. Record uncertain dates as unknown and preserve the evidence that exists.

## Immediate diligence register

| Check | Status | Required evidence/action |
|---|---|---|
| Founder personal-ownership intention recorded | Recorded in `docs/IP-OWNERSHIP-AND-PROTECTION.md` | Legal review still required |
| Repository visibility | Private at time of repository inspection | Recheck periodically |
| Asset paths inventoried | Initial repository-tree inventory completed | Review additional repositories, local files, and external storage |
| Human authorship and contributor chain | Not verified | Review commit authors, collaborators, contractor arrangements and contributions |
| Third-party dependencies and licenses | Not verified | Generate and review dependency/license inventory |
| AI-assisted contribution provenance | Not verified | Preserve available prompts, dates, model/provider and human edits |
| Public disclosure and first-use history | Not verified | Build dated disclosure/brand-use chronology |
| Branch protections and collaborator permissions | Not verified | Inspect repository settings and access list |
| Independent backups | Not verified | Establish encrypted backup and restore test |
| Trademark/patent/copyright strategy | Not assessed by counsel | Obtain qualified IP counsel review before filing or disclosure |

## Business and workspace separation

GALINYX / GALINYX OS, Governance Core, AI Workforce, Control Room, NYX AI, and NYX AI Academy are recorded as the white-collar technology and intellectual-property ecosystem.

Southeast Home Service and its construction/trades activities remain a separate blue-collar business lane. Rivet Reach remains a Southeast Home Service brand. BLACKPINE FIELD is an isolated operating workspace used to test the workforce; it is not the owner of GALINYX or its platform IP. Other ventures, including EV Station Record Passport and real-estate initiatives, must remain separately identified workspaces unless the founder expressly authorizes a documented arrangement.

Shared infrastructure does not imply shared ownership, books, funds, customers, data, authority, or operating control.

## Change control

Add a new asset only with a unique ID, evidence location, creation/provenance status, third-party status, and verification owner. Update this register through dated commits. Do not publicly disclose confidential technical details, file patent applications, grant licenses, change repository visibility, or transfer assets solely on the basis of this register.

**End of initial register.**


## Repository and provenance audit — 2026-11-17

A read-only inspection of the current `galinyx-ai-workforce-v1` branch and repository tree found:

- The repository is marked **private**.
- The inspected branch endpoint reports `protected: false` and `protection.enabled: false`. Branch protection is therefore **not enabled** on this branch at the time of inspection.
- The GitHub integration could not read the collaborators/administration endpoints because the required permission was unavailable. The collaborator/access list is **not verified**.
- A sample of the latest 100 commits on this branch reports the same GitHub account as author and committer on all 100. All 100 are reported as unsigned (`verification.verified: false`, reason `unsigned`). This is useful account-level repository history, but it does not independently prove who wrote each change or establish legal ownership.
- The repository tree contains no root `LICENSE` or `COPYING` file. However, the root `package.json` declares `"license": "MIT"`. That metadata is a material licensing ambiguity and should be reviewed before any public distribution, copying, or licensing statement. Do not assume it is harmless merely because the repository is private.
- The workspace uses a pnpm lockfile and multiple package manifests. A complete package-by-package license and provenance review has **not** been performed.

### Required remediation

1. Review and correct the root package's `license` metadata so it accurately reflects the founder's intended proprietary status, after checking the full repository and any existing obligations. Do not add a restrictive license notice that purports to override third-party rights.
2. Enable branch protection for the default branch and active development branch: block force pushes and deletion, require pull requests for the default branch, and require relevant passing CI checks where supported. Confirm settings in GitHub because the current integration cannot administer branch protection.
3. Review repository collaborators, deploy keys, GitHub Apps, Actions permissions, and any external integrations directly in repository settings.
4. Enable commit signing for future commits where practical, and preserve signed release tags for important milestones. Historical unsigned commits remain unsigned; do not rewrite them merely to make them appear signed.
5. Produce a full software bill of materials (SBOM) and third-party license report for every workspace/package before external distribution.
6. Review commit history beyond the latest 100 entries and compare it with actual human contribution records and any contractor/AI-tool agreements.

