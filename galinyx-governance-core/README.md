# GALINYX Governance Core — alpha service

This service is the first executable policy component behind GALINYX OS.

## Endpoints

- `GET /api/health` — service status and execution-disabled flag.
- `GET /api/governance/policies` — current baseline policy catalogue.
- `POST /api/governance/evaluate` — evaluates a proposed action and returns `allow`, `requires_human_approval`, or `deny`.

## Evaluation request

```json
{
  "actor": { "id": "operator-001", "lane": "White-collar" },
  "action": { "type": "read", "description": "Summarize public project notes" },
  "targetLane": "White-collar"
}
```

Allowed lane values: `White-collar`, `Blue-collar`, `Shared platform`.

## Safety boundary

This alpha is a **decision service only**. It does not execute actions, authenticate callers, persist audit records, or establish production-grade authorization. It uses conservative keyword escalation for consequential actions and denies malformed or cross-lane requests. A future release must add authenticated identities, durable audit storage, policy tests, and explicit human approval records before connecting real operators or tools.

White-collar and blue-collar lanes remain separate. Shared governance does not merge their authority.
