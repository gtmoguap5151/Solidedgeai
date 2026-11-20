# Owner Alert & Notification System — Design

**Ordered by Matt Johnson, 2026-11-18 ~20:21 ET ("So I need an alert system,
a notification system... so I know when they want to do something and I can
respond.").**
**Status: design written; build queued behind the interaction layer build
(992b622e), so the two don't touch the same Core files.**

## The problem

When an operator wants to do something that needs the owner's approval —
publish, spend, change mode, message across environments — nothing tells
the owner. Today the only notification path is Xena (chat + the round
table) and the Core screen's pending-request list with copy-buttons (no
backend — Matt pastes text back to Xena). The OS needs its own alert
system, for Matt and for every future user.

## What triggers a notification

Anything an operator wants that it cannot do alone:
- Publish something (a post, a product, a page).
- Spend money (an order, a subscription, an ad).
- Change its own mode or permissions.
- Message an operator in another environment.
- A draft is ready for the owner's review (draft-only operators).

NOT notified: routine reads, advice, drafts still being worked on, allowed
actions that need no approval. The inbox stays quiet except when the owner
is actually needed.

## The notification record

One append-only log, same pattern as the audit log and the interaction log:
`governance-core/notifications.jsonl`. One entry per notification:
id, operator, action wanted, what it is (the draft or request), when it was
asked, status (pending / approved / denied), decision + decider + time.

Rules:
- A notification is created by the Core when it DENIES an action for
  needing approval — the denial and the notification are one act. Nothing
  that needs approval ever fails silently.
- Only the owner can decide a notification. Operators can never approve
  their own (or each other's) requests.
- Every decision is audit-logged, like every other Core decision.
- The owner sees the whole history, not just the pending ones.

## Where the owner sees it

- **In the app:** a notifications inbox in the Workforce view (a bell with a
  count, a list of pending requests, Approve / Deny on each). Fed by the
  same published snapshot mechanism as the rest of the dashboard.
- **Until the backend exists:** the in-app Approve/Deny buttons copy the
  decision text for the owner to paste back (the same fallback core.html
  uses today for mode-change requests). It works, it's just one extra step.
- **With the backend (v1 Phase 2, Supabase):** decisions write back
  directly from the app, and push notifications reach the owner's phone
  when a new request lands. That is the real alert — the inbox alone is
  only half the system.

## Out of scope for this build

- Push delivery itself (needs the Phase 2 backend).
- Notifications for other users' operators (multi-tenancy comes with
  accounts).
- Letting operators notify each other (that's the interaction layer's job).
