# Operator Interaction Layer — Design

**Ordered by Matt Johnson, 2026-11-18 ~20:17 ET ("So we need to build that.").**
**Status: design written; build starts after the live push (3b4fc23c) completes, so the two don't touch the same files.**

## The problem (verified 2026-11-18)

Operators cannot interact. There is no messaging, no handoff, no shared
state in the Core — the stress test itself records: "each process holds its
own registry state; there is no shared state or sync." Each operator is
bound to exactly one environment with no cross-environment access. Today
their work only meets in staging drafts, the audit log, and the round table
(Xena-orchestrated).

## What the layer is

One append-only interaction log, governed by the Core — every operator
message is a recorded, authorized act, exactly like every other Core
decision.

**New files:**
- `governance-core/src/interactions.mjs` — the interaction module (send,
  authorize, read).
- `governance-core/interactions.jsonl` — the append-only log. One entry per
  message: from, to, kind, payload, timestamp, Core decision
  (allowed/denied), reason.
- Stress-test additions: same 54-check suite stays green; new checks cover
  the interaction rules.

**Message kinds:**
- ASK — request information or work from another operator.
- HANDOFF — pass a draft or task to another operator (e.g., Tailor hands a
  finished product draft to the Blackpine Operator for the store listing).
- NOTICE — inform, no reply needed.

## Rules (enforced by the Core, fail-closed)

1. Same-environment only by default. Cross-environment messages need the
   owner's approval (the Core's one-environment rule stands).
2. A handoff never transfers permission. A draft-only operator handing work
   to another draft-only operator does not make it publishable — publish
   and spend still need the owner's approval per action.
3. Every message is audit-logged. A denied message is recorded as denied,
   with the reason.
4. No operator can impersonate another. (Full fix needs signed-token auth —
   v1 Phase 4; until then, the log records the claimed sender and the Core
   flags unverified senders.)
5. The owner can read the whole log. Nothing between operators is hidden
   from Matt.

## First proof (after the build)

- Tailor → Blackpine Operator HANDOFF: a finished BLACKPINE product draft
  handed over for the store listing draft.
- Galileo → Finance Brother ASK: a cost check on a build before it is
  proposed.

## Dashboard / shell

After the layer works: an Interactions feed in the Workforce view showing
recent messages (from → to, kind, decision). Not in the first build — the
log and the Core rules come first.

## Out of scope for this build

- Real-time chat between operators (the log is the channel; no live socket).
- Cross-environment messaging without owner approval.
- Changing any operator's mode.

## Future: speak the outside world's language

The industry already has a wire protocol for agents talking across vendors:
**A2A (Agent2Agent)** — Google's open standard, now under the Linux
Foundation's Agentic AI Foundation, v1.0 March 2026, 150+ organizations
(AWS, Cisco, Google, IBM, Microsoft, Salesforce, SAP, ServiceNow).
A2A is the language; MCP (Anthropic) is the agent-to-tools layer. Neither is
a governed place — A2A lets agents talk, it doesn't govern them or give them
a shared home. The interaction layer should be built so it can BRIDGE to A2A
later: outside agents join the log through a translator, under the Core's
rules, like any other operator. That is how GALINYX becomes the system that
brings everybody together — every model, every culture — instead of another
walled garden.
