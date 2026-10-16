# GALINYX branch audit — 2026-10-16

Status: source inspection only. No build or test run was executed in this audit. This report records what the connected GitHub branch returned at the time of inspection; it does not assert that a separately deployed build is identical.

## Findings

### 1. Branding rename is not complete in the inspected branch snapshot

The `galinyx-launch` branch still returned legacy product identity in these tracked files:

- `artifacts/solidedgeai/index.html`: page title and Open Graph/Twitter titles say “Solid Edge AI Academy”.
- `artifacts/solidedgeai/src/components/Header.tsx` and `Footer.tsx`: visible brand still says “Solid Edge AI”.
- `artifacts/solidedgeai/src/pages/LandingPage.tsx`: “The Solid Edge approach”.
- `artifacts/solidedgeai/src/pages/PrivacyPage.tsx` and `TermsPage.tsx`: policy text names “Solid Edge AI”.
- `artifacts/solidedgeai/src/pages/ProgramsPage.tsx`, `DownloadPage.tsx`, `SkillLabPage.tsx`, and `EvidenceStudio.tsx`: product names, filenames, or exported content retain the old brand.
- `artifacts/solidedgeai/supabase/functions/create-checkout/index.ts`, `download-product/index.ts`, and `stripe-webhook/index.ts`: commerce metadata retains old product naming.
- `artifacts/solidedgeai/package.json`: package identity remains `@workspace/solidedgeai`.
- Root `package.json`: development script filters for `@workspace/solidedgeai`.
- `.github/workflows/solid-edge-pages.yml`: workflow title and build/deployment paths/artifact names retain the old identity.
- `artifacts/solidedgeai/.replit-artifact/artifact.toml`: artifact title and public directory retain old identity.

This conflicts with the report that the rename is complete. The repository folder name may be cosmetic, but visible text, metadata, package selectors, deployment configuration, generated filenames, and checkout metadata are functional references. Reconcile the branch with the intended renamed source before claiming the rename is complete. The default-branch code-search endpoint and the explicitly fetched feature-branch snapshot may reflect different revisions, so verify the exact branch head before making broad replacements.

### 2. The app source inspected is an academy/storefront, not the foundational runtime

The React app source in `artifacts/solidedgeai` contains routes for academy, resources, skill lab, programs, checkout, downloads, assessment, privacy, and terms. The separate Python prototype under `galinyx-os` is a local SQLite runtime. The current repository does not establish that the public static academy is an interactive developer operating platform.

Public positioning should distinguish:
- the public academy/storefront,
- the local Python runtime prototype,
- the longer-term GALINYX OS developer-platform roadmap.

Do not imply that the public academy currently exposes runtime APIs, authenticated entity management, secure multi-tenant execution, model adapters, or production-grade orchestration unless those capabilities are demonstrated by the deployed build.

### 3. CI failure identified; fix committed, verification pending

GitHub Actions run [38941561644](https://github.com/gtmoguap5151/Solidedgeai/actions/runs/38941561644) failed in the unit-test step: `test_creator_prompt_limit_and_setting_type`. The failing assertion supplied `canon.setting = 42` to `story.plan`; the runtime accepted and persisted it because validation only happened later in the creator draft path.

Fix committed on `galinyx-launch` as `2f11fc993b8802c321c11af0cdba3639fb9a6a5e`: `story.plan` now rejects a missing, non-string, whitespace-only, or over-256-character setting before persisting canon.

The change has not yet been verified by a successful post-fix CI run. No passing test or production build is claimed.

### 4. Safe order of remediation

1. Confirm the current head SHA for `galinyx-launch` and inspect the actual failed CI run.
2. Reconcile any discrepancy between that head and the renamed source/build reported by the maintainer.
3. Correct stale brand references and package/workflow selectors together, preserving the intended deployment target and checkout-disabled setting.
4. Run the locked install, typecheck, test suite, and production build in CI.
5. Compare the resulting static artifact against the live Surge deployment before claiming parity.
6. Update public copy to describe only capabilities verified in the build.

## Release status

- Source inspection: completed for the files listed above.
- Local build/tests: not run.
- CI diagnosis: blocked on access to the actual failed run and logs.
- Deployment parity: not verified.
- Production readiness: not established.


## Follow-up work — 2026-10-16

The following source changes were committed on `galinyx-launch` after the initial inspection:

- `artifacts/solidedgeai/src/pages/LandingPage.tsx` now presents GALINYX OS as an application-layer AI platform in development, identifies Creator as one native reference application, links to the platform roadmap and prototype, and explicitly discloses prototype limitations.
- `artifacts/solidedgeai/src/components/Header.tsx` and `Footer.tsx` now display GALINYX OS and the application-layer platform descriptor. The existing support email was deliberately preserved because a GALINYX-domain support address has not been verified.
- `artifacts/solidedgeai/index.html` title and social metadata now use GALINYX OS positioning.
- `.github/workflows/galinyx-app-checks.yml` was added to run a locked pnpm install, app typecheck, and app build for relevant changes on `galinyx-launch`.

These are source changes only. No successful CI result was returned at the time of this update; a missing status is not a pass. The live Surge deployment has not been updated or verified. The academy, program, privacy/terms, and digital-download pages still require a coordinated identity/content review before the entire site can be called fully rebranded. Existing Stripe/Supabase metadata and product delivery paths were not changed in this pass to avoid breaking the current checkout-disabled setup or product identifiers.
