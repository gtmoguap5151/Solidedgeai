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

This module is a trusted-service component. Its actor IDs are attribution fields, not credentials. It does not authenticate people, authorize tenant membership, verify that an approver is the legal owner, or enforce project access. A network-facing service must authenticate and authorize every caller before invoking it and must derive actor and tenant identity server-side. Production use must not expose direct database access.

## Current scope

This milestone supplies durable task lifecycle, role assignment, evidence, approval records, and append-only events. It does not yet dispatch autonomous agents, send communications, publish content, spend money, or execute external business actions.
