# Next Build — The Notification Inbox Display

**For Matt Johnson — written 2026-11-18, ~20:32 ET.**
**Status: summary only. The build has not started yet.**

## The next build

**The notification inbox, visible in the app.** The alert system itself is
already built and working in the Core — when a worker wants to publish or
spend, the Core stops it and writes a notification. But right now Matt
can't SEE that inbox anywhere in the app. This build puts it on screen.

It is next because Xena already told Matt it comes right after the seven
new workers, and because it closes the loop he asked for on 2026-11-18
~20:21 ET: *"So I need an alert system, a notification system... so I know
when they want to do something and I can respond."* The alert half is
done. This is the half he looks at.

## What it includes

1. **The snapshot exporter includes notifications.** Today the app's
   Workforce view reads a published snapshot (operators, rules, drafts,
   audit). That snapshot doesn't carry notifications yet. The exporter
   learns to include them — pending requests and decided ones, with the
   operator, the action wanted, and when it was asked.
2. **An inbox section in the Workforce view.** A bell with a count, a list
   of pending requests, and Approve / Deny on each one — the same place
   Matt already sees the workers, the rules, and the drafts.
3. **Approve / Deny that works today.** Until the backend exists, the
   buttons copy the decision text for Matt to paste back — the same
   copy-text fallback the Core screen already uses for mode-change
   requests. It works; it's one extra step.

## What it does NOT include

- **No push delivery.** Nothing buzzes Matt's phone when a request lands —
  that needs the Phase 2 backend (Supabase). He sees the inbox when he
  opens the app. Real push alerts come with Phase 2.
- **No notifications for other users' workers.** Multi-tenancy comes with
  accounts (Phase 2).
- **No change to the rules.** Only the owner can decide a notification.
  Operators can never approve their own or each other's requests. Every
  decision is audit-logged. Approving a notification records a yes — it
  grants no permission by itself.

## What it needs from Matt

**Nothing.** No tap, no key, no money. The only thing that comes back to
him is the same as every build: his go-ahead to push it live once it's
built and verified. Nothing goes live without his word.

## What follows after it, in order

1. **Phase 1b — New-worker flow inside the app.** A "New worker" button in
   the Workforce view: define the worker (name, role, the five character
   questions), register it as a DRAFT, and the owner approves it before it
   goes live. Matt's rule: a worker isn't "built" until it shows up in the
   OS.
2. **Phase 2 — Accounts + sync (Supabase).** A stranger can sign up, sign
   in, and have their own space; their work follows them across devices.
   **Needs from Matt: his Supabase signup tap (Google, ~2 minutes).**
   This is also when push delivery becomes real.
3. **Phase 3 — AI generation in Creator Studio.** The Studio actually
   creates, governed by the Core — drafts to staging first, nothing live
   without approval. **Needs from Matt: his call on whose key pays for
   generation.**
4. **Phase 4 — Operator auth + hardening.** Signed tokens for operators, so
   nobody can fake being a worker. Rate limits, backup/export, an audit
   log that can't be rewritten.
5. **Phase 5 — Release checks + his verdict.** Fresh-device install test, a
   full new-user walkthrough, the Core stress suite staying green, privacy
   + terms pages — and a real install test on his phone. Then Matt's
   go/no-go verdict. Nothing ships without it.

## Where things stand (honest)

- **Done:** installs (verified live); Core + Workforce view in the app
  (live); interaction layer — workers can message and hand off (built,
  local only); notification Core half — alerts are created and decided in
  the Core (built, local only; stress test 80 PASS / 0 FAIL / 8 FINDING,
  Core v1.3.0); 15 operators registered, all draft-only except the three
  read-only-advisory ones (local only — the live app still shows 8).
- **Open:** this inbox display; the Phase 1b new-worker flow; accounts +
  sync; AI generation; operator auth; release checks; and a go-live push
  for everything built tonight (needs Matt's word).

Design doc: `notification-system-design-2026-11-18.md`.
V1 plan: `v1-production-ready-plan-2026-11-18.md`.
