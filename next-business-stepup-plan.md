# Next business + faster operator step-up — prepared for Matt

Prepared 2026-11-17 ~12:35 ET, after Matt's questions in the main chat today:
- "What business would be best to start next? Using my core and workforce."
- "Few weeks is a long time for me" (on read-only before permissions step up).

## 1. Recommended next business: Coalfield Energy

Ranked against what already exists — not a new idea, a finished product waiting
for a launch and an operator.

| Candidate | What's actually ready | Distance to first dollar |
|---|---|---|
| **Coalfield Energy — $49 "Rare Earths from Kentucky Coal" guide** | Guide written (md + pdf in `~/workspace/goals/rare-earths-from-kentucky-coal/files/`, 2026-11-09); Stripe $49 link built 2026-11-12 and verified live | **Shortest.** Nothing left to build — launch it and give it an operator |
| Blackpine beginner firearm course | Draft built 2026-11-12 (19 pages, 10 modules, safety-first); $49 proposed; Stripe link NOT made — Matt hasn't reviewed the draft yet | One review + one link away; second in line |
| Leaf Compass | Finished 10-module course, $49 Stripe link live | Sellable, but the rename/domain flip is still open |
| KY contractor directory (suggested in chat today) | Nothing built — and it duplicates Rivet Reach, which already matches homeowners with contractors | Longest; don't build a second Rivet Reach |

Why Coalfield wins: it is a separate lane (energy, not gear, not lead-matching),
it reuses his own Harlan coal story, it gives the core a **third environment**
to prove scaling (Blackpine → Rivet Reach → Coalfield), and it costs $0 to start.

Decision needed from Matt: approve Coalfield Energy as the third environment,
with its operator registered `not-deployed` first, then moved to read-only
advisory once the launch is live. No code is pushed and no mode changes until
he approves — mode changes require explicit owner approval by the core's own rules.

### Exact registration to add to `operators.json` (validated JSON)

```json
{
  "id": "coalfield-energy",
  "kind": "guide sales",
  "label": "Coalfield Energy"
}
```
in `environments`, and:
```json
{
  "environment": "coalfield-energy",
  "id": "coalfield-operator",
  "mode": "not-deployed",
  "name": "Coalfield Operator",
  "status": "not-deployed",
  "statusNote": "Registered 2026-11-17. Not deployed until the owner approves the launch."
}
```
in `operators`.

## 2. Faster step-up — the honest blocker and the fix

Matt said a few weeks in read-only is too long. Checked the live core
(`~/workspace/galinyx-governance/governance-core/src/operators.json`):
**there is no middle step.** The core only has two modes — `not-deployed`
(nothing allowed) and `read-only-advisory` (read + advise only). There is no
mode that lets an operator draft or queue work without publishing it. So
"step up sooner" currently means jumping straight to publish/spend, which the
stress test says must NOT happen until real operator authentication exists
(finding 2: anyone can still claim any operator ID; the owner-identity
guardrail is not authentication).

The fix is a new middle mode, defined once, then granted operator by operator:

```json
"draft-only": {
  "description": "May observe, advise, and write drafts to a staging queue. May not publish, spend, or change anything live.",
  "label": "Draft-Only",
  "permissions": {
    "advise": true,
    "publish": false,
    "read": true,
    "spend": false,
    "write": true
  }
}
```
Note: `write` here means write-to-staging only. Live publish stays denied in
this mode, and `spend` stays denied in every mode until signed-token auth
(finding 2) is built. That is what makes stepping up sooner safe.

### Accelerated gates (days of proof, not weeks of waiting)

Step Blackpine up first (lowest risk — drafts are just post/card copy), Rivet
Reach second (its drafts touch real homeowners and contractors).

- **Gate 1 — Blackpine → draft-only:** 3 consecutive days where the operator's
  advice matches the live numbers (visitors, clicks, top products) with zero
  cross-environment denials and zero audit anomalies. Then Matt approves the
  mode change; the audit log records it.
- **Gate 2 — Rivet Reach → draft-only:** same 3-day clean record on its own
  environment, plus at least one real match or homeowner reply handled
  correctly in read-only. Then Matt approves.
- **Gate 3 — anything live (publish/spend):** NOT on this plan. Needs real
  operator authentication first (signed tokens, per the stress-test report's
  future-work spec). No date promised for that — it is a design decision Matt
  still has to make.

### What the audit log shows today (checked 2026-11-17 ~12:35 ET)

`governance-core/src/audit-log.jsonl` holds only 9 entries, all from today's
demo/stress probes (16:53–17:06 UTC): reads allowed, publish/spend denied,
cross-environment read denied. **No real operator work has been logged yet** —
so the 3-day gates above start from the next clean day, not from today. Do not
treat the demo probes as proof the operators are reliable.

## 3. What still needs Matt (smallest possible set)

1. Pick: Coalfield Energy as the third business — yes / no.
2. Approve the `draft-only` mode definition above — yes / no.
3. Nothing else: the guide, the Stripe link, and the core fixes are already done.
   The firearm-course draft review is the next ask after this, not part of it.
