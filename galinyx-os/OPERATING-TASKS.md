# Governed Operating Tasks

The operating-task registry is the first reusable execution primitive for GALINYX operating cells.

## Task record

Each task is scoped to a tenant and project and records:
- title and description;
- accountable operating role;
- priority, due date, and lifecycle status;
- whether human approval is required;
- creator, timestamps, and optimistic version counter.

## Lifecycle

Supported states are `open`, `in_progress`, `blocked`, `awaiting_approval`, `completed`, and `cancelled`. Terminal states cannot be reopened. A task marked as approval-required cannot be completed until an approval record exists with an approved decision.

## Evidence and auditability

Evidence references, approval decisions, and task events are separate append-only records. Status changes create events with actor, prior state, new state, timestamp, and note. Evidence is referenced by URI or other caller-defined reference; the registry does not fetch or validate the referenced content.

## Security boundary

The registry remains a trusted-service component. Its actor IDs are attribution fields, not credentials. The `GalinyxService` facade now authenticates through an injected authenticator, derives the actor ID server-side, checks active human membership and role in the requested tenant, scopes reads and writes to that tenant, and permits approval only to the persisted workspace owner. A later rejection supersedes an earlier approval for completion gating.

The authenticator is still a deterministic test adapter in this repository; no production credential issuer, cryptographic token verification, network endpoint, session lifecycle, or protected deployment boundary is included. Do not expose direct Runtime/database access to network callers. Project IDs are currently tenant-scoped labels, not separately authorized project resources.

## Current scope

This milestone supplies durable task lifecycle, role assignment, evidence, approval records, append-only events, and an authenticated local service integration seam. It does not yet dispatch autonomous agents, send communications, publish content, spend money, or execute external business actions.
