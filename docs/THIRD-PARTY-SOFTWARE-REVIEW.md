# Third-Party Software and License Review — Initial Inventory

**Review date:** 2026-11-16  
**Repository:** `gtmoguap5151/Solidedgeai`  
**Branch inspected:** `galinyx-ai-workforce-v1`  
**Scope:** Read-only review of root/workspace package manifests, pnpm workspace configuration, and lockfile. This is an inventory, not a completed license-compliance opinion or security audit.

## Executive finding

The repository is **not ready for a defensible proprietary licensing or external-distribution statement** until the root package's `"license": "MIT"` metadata is resolved and a complete dependency/license report is generated.

The repository is private, but private visibility does not resolve the package metadata or third-party license obligations. No repository license file was present in the inspected root tree during the earlier repository audit. The root `package.json` declares MIT despite being marked private. Those fields do not cancel each other out; consumers and tooling may treat the license metadata as a licensing declaration. Obtain qualified legal review before publishing or changing the declaration.

## Manifest inventory

The following manifests were fetched from the inspected branch:

| Manifest | Package | Direct runtime dependencies | Dev dependencies | Declared package license |
|---|---|---:|---:|---|
| `package.json` | `workspace` | 1 | 2 | MIT |
| `artifacts/solidedgeai/package.json` | `@workspace/solidedgeai` | 1 | 63 | Not declared |
| `artifacts/api-server/package.json` | `@workspace/api-server` | 8 | 8 | Not declared |
| `artifacts/mockup-sandbox/package.json` | `@workspace/mockup-sandbox` | 0 | 60 | Not declared |
| `lib/api-client-react/package.json` | `@workspace/api-client-react` | 1 | 0 | Not declared |
| `lib/api-spec/package.json` | `@workspace/api-spec` | 0 | 1 | Not declared |
| `lib/api-zod/package.json` | `@workspace/api-zod` | 1 | 0 | Not declared |
| `lib/db/package.json` | `@workspace/db` | 4 | 3 | Not declared |
| `scripts/package.json` | `@workspace/scripts` | 0 | 2 | Not declared |
| `.migration-backup/package.json` | `vite-react-typescript-starter` | 4 | 14 | Not declared |

The pnpm workspace declares nine active importers (root plus eight workspace package paths). The migration-backup manifest was inspected separately and is not listed as an active importer in the lockfile's importer section.

## Notable direct dependencies

The application manifest directly references Supabase JS, React, Vite, TanStack Query, Radix UI components, Tailwind CSS, Zod, Recharts, Framer Motion, React Hook Form, date-fns, and other ecosystem packages. The API server references Express, Drizzle ORM, Pino, and related packages. The database package references Drizzle ORM, Drizzle Zod, PostgreSQL's `pg` driver, and Zod.

The workspace configuration also contains a one-day minimum package release age setting (`minimumReleaseAge: 1440`) and explicit package build allowlisting. These are useful supply-chain controls, but they do **not** establish that dependencies are vulnerability-free or license-compatible.

## What this review did not establish

- It did not resolve the license of every direct or transitive package.
- It did not produce an SPDX or CycloneDX SBOM.
- It did not run a vulnerability audit against a current advisory database.
- It did not inspect every dependency's upstream license text, exceptions, notices, source obligations, or commercial-use terms.
- It did not determine whether scaffolded/generated code or third-party assets have separate terms.
- It did not establish that all code in the repository is authored by or assignable to the intended owner.

The pnpm lockfile is approximately 212,892 characters / 5,646 lines in the inspected branch. A lockfile records dependency resolution; it is not a license report.

## Required next actions

1. Have counsel review the root MIT metadata against the intended ownership and distribution model. Do not simply delete or replace it without confirming the repository's history and obligations.
2. Generate an SBOM and package-license inventory from the exact lockfile using a reputable scanner, preserving tool/version/date and output.
3. Review every flagged license and notice requirement, including transitive dependencies and any copyleft/network-copyleft obligations, before distribution.
4. Run a current dependency vulnerability audit and review the results separately from license compliance.
5. Identify and document generated/scaffolded code, third-party assets, external course content, and AI-assisted contributions.
6. Preserve the reports as dated records and repeat them for each release.

## Ownership boundary

Third-party packages remain subject to their respective owners' licenses and terms. Listing a dependency here does not transfer ownership to GALINYX or its founder. This software review applies to the GALINYX repository only; it does not merge BLACKPINE FIELD, NYX AI Academy content, Southeast Home Service, Rivet Reach, or any blue-collar operations into one ownership or operating entity.

**Status: Initial manifest inventory complete; full license and vulnerability audit pending.**
