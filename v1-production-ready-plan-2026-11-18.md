# GALINYX OS v1 — Production-Ready Plan

**Ordered by Matt Johnson, 2026-11-18 ~20:10 ET.**
**Goal: v1.0 that COULD go live — not launching yet.** Production-ready means a stranger can install it, create an account, build a project with AI help under the Governance Core, and their work syncs across devices. No launch, no sales, until Matt says so.

## What "production ready" means for v1

1. Installs clean on a fresh phone (PWA, no errors).
2. A new person can sign up, sign in, and have their own space.
3. Their projects, memory, and tasks save and sync across devices.
4. Creator Studio actually creates — AI generation works, governed by the Core.
5. The Workforce is visible in the app — operators, modes, drafts, audit.
6. It fails gracefully: offline works, errors explain themselves, nothing silently loses work.

**Not in v1:** paid tiers, licensing sales, the industry workforce apps (warehouse/shipping/auto). Those come after v1 proves the system works.

## Phases

### Phase 0 — Installable (DONE, verified live 2026-11-18 20:09 ET)
- Manifest lists PNG icons (192/512/maskable); icons serve 200 image/png.
- The app should install on Android now. Still to confirm: a real install test on Matt's phone.

### Phase 1 — Core inside the shell (DONE + LIVE 2026-11-18 20:20 ET, commit a0bd9f1b)
- Recover the shell source from the live repo (local copy was missing index.html).
- Add a fourth section, "Workforce": the 8 operators with names/environments/modes, the Core's 5 rules, pending drafts, recent audit entries.
- Reads the published read-only snapshot (core-snapshot.json). No backend yet.
- Verify locally; push only after Matt sees it.

### Phase 1b — Workers are built INSIDE the OS (Matt's requirement, 2026-11-18 20:11 ET)
- A worker isn't "built" until it lives in the OS — not just files in a workspace. The Tailor was built as files first; Matt corrected this.
- Add a "New worker" flow in the Workforce view: define the worker (name, role, the five character questions), register it as a DRAFT operator, and the owner approves it before it goes live. The Core records the approval in the audit log.
- The Tailor is the first worker to appear in the OS through the Workforce view (Phase 1).
- **DONE + LIVE 2026-11-18 20:58 ET, commit 0d9de695** — New worker form in the Workforce view (name, role, environment, five character questions), draft cards badged "DRAFT — not registered", nothing registers on its own. Verified live: index.html md5-matches, sw.js v4.

### Phase 1c — Operator interaction layer (Matt's order, 2026-11-18 20:17 ET) — DONE 20:24 ET, local only
- Operators can't talk to each other yet — no messaging, no handoffs, no shared state. Build the interaction layer: one append-only log, governed by the Core (ASK / HANDOFF / NOTICE), same-environment by default, every message audit-logged, handoffs never transfer permission. Design: `interaction-layer-design-2026-11-18.md`. Build RUNNING (started 20:20 ET, after the live push). **Done 20:24 ET: stress test 68 PASS / 0 FAIL / 7 FINDING; demo proofs landed (Tailor→Blackpine handoff, Galileo→Finance Brother ask, both ALLOWED; cross-env ASK DENIED). CORE_VERSION 1.2.0.**

### Phase 1d — Owner alert & notification system (Matt's order, 2026-11-18 20:21 ET) — CORE HALF DONE 20:28 ET (local only); DISPLAY BUILD RUNNING 20:37 ET
- When an operator wants something that needs his approval (publish, spend, mode change, cross-environment message, draft ready), the OS must TELL him and let him respond. Design: `notification-system-design-2026-11-18.md` — append-only notifications log, in-app inbox in the Workforce view, Approve/Deny (copy-text fallback until the backend; real push delivery comes with Phase 2). Core half built 20:28 ET: stress test 80 PASS / 0 FAIL / 8 FINDING, CORE_VERSION 1.3.0; demo proved (Tailor publish denied → notification → owner approved; Tailor spend denied → notification → owner denied). Display half (exporter + inbox UI) ordered by Matt 20:37 ET, building now.

### Phase 2 — Accounts + sync (Supabase)
- Supabase project DONE 2026-11-18 ~23:58 ET: "galinyx" in org "Lead spark 98", Free plan, us-east-1, Healthy — https://sebcnrlexkcuuyfmigoq.supabase.co (ref sebcnrlexkcuuyfmigoq). Created after pausing Habit House (reversible, not deleted) to free a free-plan slot; Yield Flow untouched (it's Rivet Reach's backend). Details: phase-2-supabase.md. Backend build (auth + tables + sync) now underway, local only.
- Auth: email + Google sign-in. Per-user projects, memory, tasks.
- Local-first stays: works offline, syncs when online. Nobody sees anybody else's work.
- Data export: a user can take their data out at any time.
- **Foundation slice DONE 2026-11-19 ~00:42 ET, local only, 28/28 checks green** — Supabase client wired into the shell (CDN, pinned 2.119.1), Account view (email sign-up/sign-in/sign-out), live sync-status pill, local-first sync engine (tombstones for deletes, local-wins conflicts); SQL migration written (profiles/projects/memories/tasks, RLS, 15 policies) but NOT applied; sw.js v5. Project: galinyx, live on the free plan (Habit House paused to free the slot; Yield Flow untouched). Local store is localStorage, not IndexedDB. Open: apply migration in dashboard SQL editor; set Site URL to the live app URL (else email-confirmation links break); email-confirmation on/off is Matt's call; Google sign-in needs OAuth setup; end-to-end sync test needs an account. **Migration APPLIED + Site URL SET 2026-11-19 ~08:04 ET** — all 4 tables live with RLS (15 policies verified), Site URL https://gtmoguap5151.github.io/Solidedgeai/; signed in via GitHub (no Google button on Supabase; saved email/password rejected as invalid). Email confirmation untouched (still on). **Shell PUSHED LIVE 2026-11-19 ~08:12 ET, commit 0dd55a09** (with the columns + Printify department push) — verified live by md5, sw.js v6, snapshot 21 operators. Accounts + sync are live in the app now; end-to-end sync test with a real account is the next check.

### Phase 3 — AI generation in Creator Studio
- Backend Worker + model API key. The key lives server-side, never in the app.
- Generation governed by the Core: drafts to staging first, nothing live without approval.
- **Matt wants a FREE key, nothing that costs (2026-11-19).** **KEY CREATED 2026-11-19 ~08:13 ET** — empty "My First Project" renamed galinyx (project-e7e19133-5c22-46b3-b90); "Gemini API Key" in AI Studio, Free tier, no billing, nothing deleted, Money 4 Me + Exitguard untouched. Key value lives in AI Studio only, not recorded. **Wiring BUILT 2026-11-19 (reported in-call, ~08:33 ET)** — galinyx-ai Worker code + studio-ai.js, 16/16 tests reported; shell patch applied with honest interim wording ('AI wiring ready'); key stays server-side, never in the app. **Deploy blocked from here — no Cloudflare access; the Worker package is ready for Matt to paste/deploy from his phone.** Do not describe the AI as fully live until that deploy is confirmed.

### Phase 4 — Operator auth + hardening
- Signed tokens for operators — the Core's known open gap (today any process could claim to be an operator).
- **BUILT 2026-11-19 ~08:33 ET (reported in-call, ordered by Matt ~08:21 ET)** — per-operator Ed25519 tokens, owner approvals signed too; reported verified 94 PASS / 0 FAIL, Core v1.4.0; local only, awaiting push; key store empty — no keys issued yet; all 21 operators stay draft-only; private keys never in the repo.
- **HIERARCHY GAPS CLOSED 2026-11-19 ~09:00 ET (Core v1.5.0, ordered by Matt ~08:46 ET)** — owner-key ceremony tooling (`src/owner-key.mjs`, `tools/owner-key.mjs`; key itself still needs Matt's hands), shared state (registry file is the single source of truth; `syncState()`; `src/state-store.mjs`; Supabase cutover documented in `shared-state-design-2026-11-19.md`), operator registration API (`registerOperator()`, owner approval required, draft-only default), tamper-proof audit log (SHA-256 hash chain + genesis over the 72-line pre-chain log, duplicate seqs 51–60 included; `tools/verify-audit.mjs`), seq allocator fixed (continues from the file's max seq), authorize() denial reason names the operator's actual mode. Stress test 108 PASS / 0 FAIL / 6 FINDING. Local only, awaiting push with the v1.4.0 set; key store still empty; all 21 operators still draft-only.
- Rate limits, error handling, backup/export, audit log that can't be rewritten.

### Phase 5 — v1.0 release checks
- Fresh-device install test, new-user walkthrough start to finish.
- Load/stress pass on the Core (108-check suite stays green, v1.5.0).
- Privacy + terms pages in the app.
- Matt's go/no-go verdict. Nothing ships without it.

## Needs from Matt
1. Supabase — DONE (reported 2026-11-18 ~23:58 ET): account existed, Habit House paused, GALINYX project created; Xena to verify the Supabase state before relying on it. (Phase 2)
2. API key (Phase 3): DONE 2026-11-19 ~08:13 ET — "Gemini API Key", Free tier, galinyx project. Wiring built 2026-11-19 (reported in-call); deploy needs Matt's phone (no Cloudflare access from here).
3. The v1.0 verdict when the build is ready to look at (Phase 5).

## Standing rules for this build
- Draft-only for every operator until Matt approves a mode change.
- No payment or paid tier in v1.
- Verify every claim live before reporting it — no "it's done" until it's checked.
