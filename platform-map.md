# GALINYX OS — Platform Map: how other builders use it

Written 2026-11-17, after Matt's go-ahead on the voice call ("perform whatever
action necessary"). This is the map, not the build — the agreed order still
holds: Black Friday cash first, prove the operators, then backend + paid
tiers, then license.

## The idea in Matt's words

GALINYX OS is an operating platform "for anybody to use their AI, build on
it, test it."

- **NYX AI Academy** teaches people how to USE AI.
- **GALINYX OS** is where they go to BUILD and TEST their own AI — under the
  Governance Core, with a license to run it.

That is the "GitHub of AI" endgame: the platform other developers find
themselves in need of.

## How a builder uses it (the path)

1. **Sign up** — an account on GALINYX OS (does not exist yet).
2. **Get an environment** — their own sandbox, separate data and permissions,
   the same way Blackpine Field and Rivet Reach each have one.
3. **Bring their AI** — their build registers as operators in that environment.
4. **The Core governs it** — every action goes through authorize(): read,
   advise, write, publish, spend. Modes step up only on owner approval:
   not-deployed → read-only advisory → draft-only → (later) live, once
   signed-token auth exists.
5. **Draft first, prove, then run** — drafts land in staging for review.
   Clean days (advice matches live numbers, zero cross-environment denials,
   zero audit anomalies) are the proof that earns more permission.
6. **License to run** — paid tiers for running live operators on the platform
   (pricing undecided; this is the revenue engine).

## What exists today (Nov 17, 2026)

- Governance Core v1.1.0: registry, permissions, authorize(), append-only
  audit log, mode changes by owner approval only. Stress-tested 54/54.
- Draft-only mode: live on Blackpine + Rivet Reach operators (owner-approved
  Nov 17). Write-to-staging works; publish/spend denied.
- Operator Dashboard (live): shows modes, permissions, verified figures.
- Two proving-ground environments: Blackpine Field (retail) and Rivet Reach
  (home services). Neither has made money — nothing to lose, everything to
  prove.
- Installable GALINYX OS shell (Creator Studio, Project Memory, Task Planner).

## What is missing before anybody else can build on it

1. **Accounts + cloud sync** — no sign-in, no user data beyond local storage.
   (Revival order: own Supabase backend first.)
2. **Signed operator auth** — today an operator ID is a claim, not a
   credential. Third-party operators cannot be trusted without it. Needs a
   design decision from Matt.
3. **AI generation in the platform** — the shell has no generation; operators
   today are authorization entries, not live AI workers.
4. **Shared state** — workers in different processes cannot coordinate yet.
5. **Billing / licensing** — no paid tiers, no license issuance, no metering.
6. **A first outside builder** — nobody to test the platform with yet. The
   industry workforce app (6–10 workers per industry: warehouse, shipping,
   auto — pick still open) is the first product built ON the platform, and
   the proof story for licensing.

## Order of work (agreed with Matt)

1. Black Friday cash (Blackpine storefront + push) — closest money.
2. Prove the operators on Blackpine + Rivet Reach (clean days, draft-only).
3. Backend (Supabase accounts + sync) + AI generation + paid tiers.
4. License: industry workforce apps, then the open platform for any builder.
