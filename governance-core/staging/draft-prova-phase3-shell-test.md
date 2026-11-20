DRAFT — NOT PUBLISHED. Staging only.

Written by: Prova (prova-operator, draft-only).
Date: Nov 19, 2026.
Assignment: live Phase 3 shell test (all-hands work order, Nov 19 ~16:16 ET).

## In plain English
- **What this is:** Prova's test of the live GALINYX app, done by reading the live pages — no clicking or signing in.
- **What it found / what it does:** The app loads, the "Generate with AI" button is there and wired up, the AI helper answers healthy, and all seven screens exist. Two things are wrong: the worker dashboard is five days out of date (it shows 7 workers when there are 21, and still calls Adamo "unnamed"), and the Account screen may still say the database setup is pending even though it was done.
- **What it costs or earns:** Nothing — it's a plan, not a spend.
- **What Matt needs to decide:** Say yes or no to fixing the out-of-date dashboard and the Account wording, and to a live click-through test of the Generate button.

---

## 1. What I checked and how

I am Prova, Galileo's tester. I cannot operate a live browser — no clicking, no
sign-in, no form fills, no installs. Everything below comes from two kinds of
text fetch, both run Nov 19, 2026 ~16:18–16:25 ET:

- `browser.open` text fetches of the live pages (what a reader sees as text).
- `curl` fetches of the same live URLs (HTTP status, byte size, and raw HTML
  source — this is how I checked things the text extraction hides, like the
  footer, the nav buttons, and the Creator Studio markup, which lives in the
  single-page shell and is not shown by the homepage text fetch).

I did NOT click anything, sign in, create an account, press Generate, install
anything, or change any live content. Anything that needs a click or a sign-in
is listed in section 4 as UNTESTED-BY-TEXT-FETCH.

Scope: the live Phase 3 shell at https://gtmoguap5151.github.io/Solidedgeai/,
its Creator Studio AI wiring (studio-ai.js + the galinyx-ai Worker), the app
icons, the service worker, the manifest, and the operator-dashboard page.

---

## 2. PASS / FAIL per check

### PASS — Homepage loads and says what Phase 3 promises
- URL: https://gtmoguap5151.github.io/Solidedgeai/
- Evidence: HTTP 200, 61,821 bytes; `<title>GALINYX OS™ — Workspace</title>`.
  Text fetch (crawled 2026-11-19 21:18 UTC) shows the home view: "Make the
  next idea real.", the CURRENT CAPABILITIES callout — "AI generation is
  connected through the GALINYX AI Worker. External publishing and autonomous
  execution are not connected." — and the counters (0 projects / 0 memory
  notes / 0 tasks) plus "Sign in from Account — it shows who you are. The
  tools still work signed out, local-only."

### PASS — Footer wording present in the shell
- Evidence: raw HTML contains "Local-first · Account sync available · AI
  connected". (Note: the `browser.open` text fetch did not show the footer —
  that is a limitation of the text extraction, not a missing footer; curl
  confirms it is in the page.)

### PASS — "Generate with AI" button present in Creator Studio
- Evidence: raw HTML contains exactly one match for `btn-generate-ai`:
  `<button class="btn secondary" id="btn-generate-ai"
  onclick="generateWithAI()">Generate with AI`. All four fields the script
  reads are also present: `project-title`, `creator-type`, `project-idea`,
  `project-constraints`, plus `draft-output` and `draft-status` targets.
  The Creator Studio view text reads: "Generate with AI sends your idea to
  the GALINYX AI Worker; the key stays server-side."

### PASS — studio-ai.js serves, complete and correctly wired
- URL: https://gtmoguap5151.github.io/Solidedgeai/studio-ai.js
- Evidence: text fetch returned the full file, 281 lines. It points at
  `https://galinyx-ai.gtmoguap5151.workers.dev`, POSTs to `/generate`, checks
  `/health` on load and disables the button with "AI not set up yet" if the
  Worker reports `configured: false`, guards every shell global so nothing
  throws if loaded alone, alerts "Add your idea first." on an empty idea,
  restores the previous draft on failure, and re-enables the button in a
  `finally`. No API key appears in the file. The shell HTML references
  `studio-ai.js`.

### PASS — Worker /health is live and configured
- URL: https://galinyx-ai.gtmoguap5151.workers.dev/health
- Evidence: HTTP 200, 29 bytes: `{"ok":true,"configured":true}`. This matches
  the button's own health check, so a stranger loading the Studio should see
  the button enabled, not the "AI not set up yet" state.

### PASS — App icons serve at the expected sizes
- `icon-192.png`: HTTP 200, 65,508 bytes — exactly the size in the brief.
- `icon-512.png`: HTTP 200, 371,842 bytes.

### PASS — Service worker is the Phase 3 version
- URL: https://gtmoguap5151.github.io/Solidedgeai/sw.js
- Evidence: HTTP 200, 2,294 bytes; contains
  `CACHE_NAME = "galinyx-os-shell-v8"`.

### PASS — Manifest serves (under its real filename)
- URL: https://gtmoguap5151.github.io/Solidedgeai/manifest.webmanifest
- Evidence: HTTP 200, 689 bytes. The shell links `./manifest.webmanifest`.
- Side note (not a user-facing failure): `manifest.json` at the same path
  returns HTTP 503 with a 54,887-byte body (GitHub Pages error page). Nothing
  in the app links to `manifest.json`, so no visitor hits this — but anyone
  probing the conventional filename gets a 503 instead of a clean 404.

### PASS — All seven views exist with readable nav labels
- Evidence: raw HTML has `id="view-home"`, `view-creator`, `view-memory`,
  `view-tasks`, `view-workforce`, `view-activity`, `view-account`, and nav
  buttons labeled Overview, Creator Studio, Project Memory, Task Planner,
  Workforce, Activity Log, Account.

### PASS — Operator dashboard loads
- URL: https://gtmoguap5151.github.io/Solidedgeai/operator-dashboard/
- Evidence: HTTP 200, 12,341 bytes; text fetch returned 211 lines: Blackpine
  Operator, Rivet Reach Operator, Galileo Ferraris, Finance Brother, the
  Registry, measured Blackpine numbers, staging drafts, and the activity/audit
  note. The snapshot it reads also serves:
  `operator-dashboard/core-snapshot.json` — HTTP 200, 38,315 bytes.

### FAIL (stale content) — Operator dashboard numbers and registry are out of date
- Evidence from the fetched dashboard text:
  - "Operators registered: 7" and "Operators in draft-only: 4 (Blackpine,
    Rivet Reach, Galileo, Finance Brother)" — but the live system now has 21
    operators, all draft-only. The dashboard shows a third of the workforce.
  - "Finance Brother (unnamed)" / "He has no name yet; Galileo names him" —
    he has been named Adamo. The dashboard still says unnamed.
  - "60 Products across 9 departments / Last verified: Nov 14, 2026" — the
    store is now 88 products across 11 departments (10 tees + 16 new gear
    went live Nov 19). The Black Friday staging draft on the same page also
    says "60 products across 9 departments".
  - "32 decisions logged as of Nov 18, 2026, morning" — five days of
    decisions since are not reflected.
  - "12 Affiliate clicks total (Awin 8 + CJ 4) / Last verified: Nov 14,
    2026, evening" and "0 Sales — $0.00 revenue" — five days old.
- The page is honest about this ("Nothing here is a live feed", "figures
  update only when Xena re-checks the live sources"), so this is staleness,
  not fabrication — but a stranger reading it today gets a wrong picture of
  the workforce size, the store size, and the Finance Brother's name. The
  snapshot needs republishing.

### FAIL (possibly stale wording) — Account view says the database setup is still pending
- Evidence from the raw HTML, view-account text: "Sync needs the one-time
  database setup in the project dashboard. Until then, sign-in works but sync
  reports 'setup pending'."
- The Supabase migration was applied Nov 19 (4 tables, 15 RLS policies), so
  if the setup is done, this sentence is now wrong and will tell a new user
  sync is broken when it is not. I could not verify either way without
  signing in (see section 4). If sync works, this line should be removed or
  reworded; if sync still reports "setup pending" for a real sign-in, it is
  accurate and the setup is genuinely unfinished.

### No invented results
Every claim above traces to a fetch I ran in this session. Where the text
fetch and the raw HTML disagreed (the footer), I said so and trusted the raw
HTML. Where I could not check something, it is in section 4, not here.

---

## 3. What confuses a stranger

These are wording, layout, and wayfinding problems visible in the fetched
text — things Galileo built from first principles that a real first-time
visitor trips over.

1. **The homepage never says what GALINYX OS is for, in one sentence a
   stranger can use.** "Make the next idea real" + "A place to shape creative
   projects, preserve important context, and turn ideas into reviewable next
   steps" is evocative but vague. A stranger cannot tell from the home view
   whether this is a notes app, a project tool, or an AI workforce system —
   and the Workforce view (the actual differentiator) is two clicks away
   behind a gear icon. The home view should say, plainly, that this workspace
   is governed by operators under a Governance Core.

2. **"Choose a workspace tool" is a dead end in the fetched text.** The home
   view ends with that heading and then only the sign-in line. If the tool
   cards render below it, the text fetch does not show them — and if they
   render only after JavaScript runs, a slow or JS-limited load leaves a
   stranger staring at a heading with nothing under it. (Needs a live-browser
   check to confirm what actually renders.)

3. **The Workforce view talks about "Xena" as if the stranger knows her.**
   Fetched text: "Until the backend lands, Approve / Deny copies the decision
   text for you to paste back to Xena." and "approval copies a message you
   paste back to Xena". A stranger has no idea who Xena is, where the chat
   with her lives, or why an app's approve button needs a paste into a
   conversation. This is an owner-workflow leak into a stranger-facing view.

4. **The operator dashboard tells a stranger to run a command in "the
   repository".** Fetched text: "run `node governance-core/src/demo.mjs` in
   the repository to see the core log real decisions." A stranger has no
   repository, no checkout, and no node. Either link to the public repo or
   drop the instruction from the public page.

5. **No install guidance anywhere in the shell.** I searched the raw HTML for
   "install" — zero matches. There is a manifest and a service worker, so the
   app is installable, but nothing in the app tells a stranger how to add it
   to their home screen, or even that they can. Matt himself uninstalled and
   reinstalled today; a stranger would never find the path.

6. **"0 / 0 / 0" on first load looks broken, not empty.** The three home
   counters show 0 with captions ("Projects saved in this browser") but no
   hint of what to do first. One line — "Create your first draft in Creator
   Studio" — would turn an empty state into a next step.

7. **"CURRENT CAPABILITIES" is honest but reads like a warning label.**
   "External publishing and autonomous execution are not connected" is true
   and important, but a stranger reads it as "half this app doesn't work".
   It would land better paired with what IS connected first (AI generation,
   local tools, sync) — the connected items are there, but the negative
   clause is the sentence's ending and the thing a reader remembers.

8. **Account view: "Google sign-in is coming later" with no date or
   alternative.** Fine as a fact, but a stranger who only signs in with
   Google (most people) hits a dead end with no "when" and no workaround
   beyond email. Also, email confirmation is ON, and nothing on the Account
   view warns a new user to check their inbox before they can sign in — the
   first sign-in attempt after creating an account can fail silently-confusingly
   if they never confirmed.

9. **The dashboard's "Deployed — draft-only, analysis unproven" status line
   undercuts itself.** It is honest, but a stranger reads "analysis has not
   yet been proven reliable" on every operator card and reasonably asks why
   any of this is on a public page. The honesty is right; the placement —
   repeated four times before any result is shown — makes the system look
   untested rather than careful.

---

## 4. UNTESTED-BY-TEXT-FETCH — needs a live browser

I could not test any of the following without clicking, signing in, or
running the app in a real browser. A live-browser test would need to check
each one:

1. **Pressing "Generate with AI" end-to-end through the shell.** The backend
   `/generate` passed a direct test today (HTTP 200), and the button and
   script are present — but nobody has pressed the button in the live app and
   watched a draft appear. Check: does the click fire, does the "Generating
   your draft…" state show, does the draft land in `draft-output`, does
   "Save to Project Memory" then work, and how long does it take (the direct
   test took 12.5s — does the shell feel hung during that wait?).
2. **The button's health-check state on load.** `initStudioAI` fetches
   `/health` and disables the button if unconfigured. Verify the button
   actually renders enabled on a fresh load, and what it looks like if the
   Worker is unreachable (button stays as-is; first click reports the error
   — check the error text a stranger sees).
3. **Empty-idea behaviour.** The script `alert()`s "Add your idea first."
   Verify the alert actually appears and the button re-enables — a native
   alert is jarring; check whether it reads as an error or a hint.
4. **Sign-in and account creation flow (Supabase).** Create an account, check
   whether the confirmation email arrives and what it says, confirm, sign in,
   and verify sync actually works — this is the only way to settle the
   "setup pending" wording question in section 2. Also verify the "Your
   password goes to Supabase only" claim behaves as described and that sign-out
   keeps the local copy.
5. **Sync across two browsers/devices.** Sign in on a second browser and
   confirm projects, memory, and tasks actually sync — the core Phase 2
   promise, still unverified by a real second-device sign-in.
6. **Install flow.** Install the app from the live URL (Add to Home Screen /
   browser install prompt) and confirm the orbit-G icon appears, the app
   opens standalone, and the service worker serves it offline. Confirm
   whether any install prompt appears at all — the shell has no install
   wording (section 3, item 5).
7. **View switching and rendering.** Click through all seven nav views and
   confirm each renders (especially the home "Choose a workspace tool" cards
   and the Workforce snapshot, which loads `core-snapshot.json` with
   `cache: 'no-store'` — check what a stranger sees while it loads and if it
   fails).
8. **Workforce Approve / Deny copy-to-clipboard flow.** Click Approve/Deny on
   a notification and confirm the decision text actually copies, and check
   what a stranger is supposed to do with it afterwards (the "paste back to
   Xena" step has no in-app destination).
9. **New-worker draft flow.** Define a worker in the Workforce view and
   confirm the draft appears, the approval copy works, and nothing registers
   without approval.
10. **Mobile layout.** Load the shell on a phone-width viewport: nav labels,
    the Creator Studio form, and the dashboard cards. The text fetch says
    nothing about layout, overflow, or tap targets.
11. **Service-worker update behaviour.** Load the app, then confirm a repeat
    visit picks up shell v8 (not a stale cached v7) — relevant because Matt
    reinstalled today and a stale cache would hide the AI button.
12. **Error states a stranger will hit.** Worker down, offline load, slow
    Gemini response, and a failed sign-in — what does the app show in each
    case, in plain language?

---

## Summary

The Phase 3 shell is live and its wiring is sound: homepage, AI button,
studio-ai.js, Worker health, icons, service worker v8, manifest, all seven
views, and the operator dashboard all serve correctly. The two real defects
are content, not code: the operator dashboard is five days stale (7 operators
shown vs 21 live; Finance Brother still "unnamed"; store still "60 products,
9 departments"), and the Account view may still warn that the database setup
is pending after the migration was applied. The stranger-facing gaps are
wayfinding — no install guidance, no plain statement of what the app is, the
Workforce view assuming the visitor knows Xena, and an empty home screen with
no first step. Twelve checks need a live browser before this can be called a
full test; the most important is pressing Generate in the app itself.

— Prova
