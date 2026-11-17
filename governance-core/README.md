# GALINYX Governance Core

The Governance Core is the authority layer of GALINYX OS. It decides what
each specialist operator is allowed to do, and it records every decision.

```
GALINYX (technology company)
  -> GALINYX OS (operating platform)
    -> Governance Core (this folder: authority, policies, permissions, oversight)
      -> AI Workforce (operator registry, roles, assignments)
        -> Blackpine Operator   -> Blackpine Field (storefront environment)
        -> Rivet Reach Operator -> Rivet Reach (lead-generation environment)
```

## Files

- `src/index.mjs` — the core. Zero dependencies, no secrets, no network calls.
- `src/operators.json` — the operator registry as data (same registry as in
  `index.mjs`, for tools and dashboards to read).
- `src/demo.mjs` — runnable demo. See below.

## Modes

| Mode | May do | May not do |
| --- | --- | --- |
| `read-only-advisory` | read, advise | publish, spend, write |
| `not-deployed` | nothing | everything |

Current state:

- **Blackpine Operator** — deployed in read-only advisory mode. Its analysis
  has **not** yet been proven reliable.
- **Rivet Reach Operator** — registered, not deployed. Deployment is not yet
  confirmed.

## The rules, enforced in code

1. Each operator is bound to exactly one environment. No cross-environment
   access, ever.
2. An operator may only perform actions its current mode allows.
3. Every authorization decision is recorded in an append-only audit log.
4. A mode change is never self-approved.

## How a mode change works

1. Anyone may call `requestModeChange(operatorId, newMode)`. It records a
   **pending** request and changes nothing.
2. The operator stays in its current mode until the owner explicitly approves.
3. The owner approves with `approveModeChange(operatorId, requestId,
   approvedBy)`. The approver's identity is required and recorded in the
   audit log. Without an approver, nothing happens.

Access changes happen in the Governance Core, not on a dashboard. The
Blackpine Operator Dashboard (`galinyx-site/operator-dashboard/`) only shows
what the core allows — it cannot grant access.

## Run the demo

From the repository root:

```sh
node governance-core/src/demo.mjs
```

The demo shows the core allowing a read, denying a publish, denying a
cross-environment read, recording a mode-change request as pending, and then
printing the audit log.
