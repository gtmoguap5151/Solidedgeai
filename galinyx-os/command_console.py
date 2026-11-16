"""Read-only, owner-authenticated GALINYX governance command console.

This module is a local application/service component, not an HTTP server or
production authentication provider. It only reads the existing governance
records and never approves, rejects, executes, reserves, or mutates anything.
"""
import json


class CommandConsole:
    """Build a read-only governance snapshot through the trusted service seam."""

    def __init__(self, organization_service):
        if organization_service is None:
            raise ValueError("organization_service is required")
        self.service = organization_service
        self.db = organization_service.workflow.db
        self.store = organization_service.workflow.store
        self.organization_id = organization_service.organization_id

    def snapshot(self, human_credential, *, limit=25):
        """Return a bounded dashboard snapshot after authenticating the human root."""
        self.service._human_owner(human_credential)
        if not isinstance(limit, int) or isinstance(limit, bool) or not 1 <= limit <= 100:
            raise ValueError("limit must be an integer from 1 to 100")

        organization = self.service.registry.get(self.organization_id)
        tenant_id = organization["tenant_id"]

        proposals = self.db.execute(
            "SELECT p.proposal_id,p.proposer_actor_id,p.executor_actor_id,"
            "p.request_id,p.action,p.resource_id,p.created_at,"
            "(SELECT e.state FROM galinyx_decision_events e "
            " WHERE e.proposal_id=p.proposal_id ORDER BY e.event_id DESC LIMIT 1) AS state,"
            "(SELECT e.occurred_at FROM galinyx_decision_events e "
            " WHERE e.proposal_id=p.proposal_id ORDER BY e.event_id DESC LIMIT 1) AS updated_at "
            "FROM galinyx_decision_proposals p WHERE p.org_id=? "
            "ORDER BY p.created_at DESC,p.proposal_id LIMIT ?",
            (self.organization_id, limit),
        ).fetchall()
        proposal_rows = [
            {
                "proposal_id": r[0], "proposer_actor_id": r[1],
                "executor_actor_id": r[2], "request_id": r[3],
                "action": r[4], "resource_id": r[5], "created_at": r[6],
                "state": r[7] or "invalid", "updated_at": r[8],
            }
            for r in proposals
        ]

        grants = self.db.execute(
            "SELECT g.grant_id,b.actor_id,g.issuer_type,g.issuer_id,g.parent_grant_id,"
            "g.actions_json,g.resources_json,g.approval_required_json,g.expires_at,"
            "g.budget_limit_units,g.budget_unit,g.max_transaction_units,"
            "g.transaction_unit,g.created_at "
            "FROM ahaf_authority_grants g "
            "JOIN galinyx_org_actor_bindings b ON b.agent_id=g.subject_agent_id "
            "WHERE b.org_id=? ORDER BY g.created_at DESC,g.grant_id LIMIT ?",
            (self.organization_id, limit),
        ).fetchall()
        grant_rows = []
        for r in grants:
            grant_rows.append({
                "grant_id": r[0], "actor_id": r[1], "issuer_type": r[2],
                "issuer_id": r[3], "parent_grant_id": r[4],
                "actions": json.loads(r[5]), "resources": json.loads(r[6]),
                "approval_required_actions": json.loads(r[7]),
                "expires_at": r[8], "budget_limit_units": r[9],
                "budget_unit": r[10], "max_transaction_units": r[11],
                "transaction_unit": r[12], "created_at": r[13],
                "active": self.store.grant_is_active(r[0]),
            })

        receipts = self.db.execute(
            "SELECT r.execution_id,r.agent_id,r.grant_id,r.request_id,r.action,"
            "r.resource_id,r.created_at,"
            "(SELECT e.state FROM ahaf_execution_receipt_events e "
            " WHERE e.execution_id=r.execution_id ORDER BY e.event_id DESC LIMIT 1) AS state,"
            "(SELECT e.occurred_at FROM ahaf_execution_receipt_events e "
            " WHERE e.execution_id=r.execution_id ORDER BY e.event_id DESC LIMIT 1) AS updated_at "
            "FROM ahaf_execution_receipts r WHERE r.tenant_id=? "
            "ORDER BY r.created_at DESC,r.execution_id LIMIT ?",
            (tenant_id, limit),
        ).fetchall()
        receipt_rows = [
            {
                "execution_id": r[0], "agent_id": r[1], "grant_id": r[2],
                "request_id": r[3], "action": r[4], "resource_id": r[5],
                "created_at": r[6], "state": r[7] or "invalid",
                "updated_at": r[8],
            }
            for r in receipts
        ]

        audit_count = self.db.execute(
            "SELECT COUNT(*) FROM ahaf_audit_events WHERE tenant_id=?",
            (tenant_id,),
        ).fetchone()[0]
        audit_valid, invalid_event_id = self.store.verify_audit_chain()

        pending = [p for p in proposal_rows if p["state"] == "proposed"]
        approved = [p for p in proposal_rows if p["state"] == "approved"]
        unresolved_states = {"outcome_unknown", "reconciling", "manual_review_required"}
        unresolved = [r for r in receipt_rows if r["state"] in unresolved_states]

        return {
            "console_version": 1,
            "read_only": True,
            "organization": organization,
            "roles": organization["roles"],
            "pending_proposals": pending,
            "approved_awaiting_execution": approved,
            "recent_proposals": proposal_rows,
            "authority_grants": grant_rows,
            "recent_receipts": receipt_rows,
            "unresolved_receipts": unresolved,
            "audit": {
                "hash_chain_valid": audit_valid,
                "first_invalid_event_id": invalid_event_id,
                "organization_event_count": audit_count,
                "scope_note": "Hash-chain verification covers the complete local audit stream; event count is organization-scoped.",
            },
            "limits": {"recent_records": limit},
            "safety": {
                "mode": organization["mode"],
                "external_actions_enabled": False,
                "authentication_note": "Credential verification is supplied by the injected authenticator; repository test doubles are not production identity providers.",
            },
        }

    @staticmethod
    def render(snapshot):
        """Render a compact, plain-text view without changing the snapshot."""
        org = snapshot["organization"]
        audit = snapshot["audit"]
        lines = [
            f"{org['name']} — GOVERNANCE COMMAND CONSOLE",
            f"Mode: {org['mode']} | Authority: {org['authority_model']}",
            f"Roles: {len(snapshot['roles'])} | Pending approvals: {len(snapshot['pending_proposals'])}",
            f"Approved awaiting execution: {len(snapshot['approved_awaiting_execution'])}",
            f"Authority grants shown: {len(snapshot['authority_grants'])}",
            f"Recent receipts: {len(snapshot['recent_receipts'])} | Unresolved: {len(snapshot['unresolved_receipts'])}",
            f"Audit hash chain: {'VALID' if audit['hash_chain_valid'] else 'INVALID'}",
            f"Organization audit events: {audit['organization_event_count']}",
            "External actions: DISABLED",
            "",
            "PENDING DECISIONS",
        ]
        if snapshot["pending_proposals"]:
            for item in snapshot["pending_proposals"]:
                lines.append(
                    f"- {item['proposal_id']} | {item['action']} | "
                    f"executor={item['executor_actor_id']} | resource={item['resource_id']}"
                )
        else:
            lines.append("- None")
        lines.extend(["", "UNRESOLVED EXECUTION RECEIPTS"])
        if snapshot["unresolved_receipts"]:
            for item in snapshot["unresolved_receipts"]:
                lines.append(f"- {item['execution_id']} | {item['state']} | {item['action']}")
        else:
            lines.append("- None")
        return "\n".join(lines)
