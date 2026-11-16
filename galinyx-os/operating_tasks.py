"""Governed operating-task registry for GALINYX.

This is a trusted-service component, not a network authorization boundary.
Callers must authenticate actors and authorize tenant/project access before
calling it. Evidence, approvals, and task events are append-only records.
"""
import json
import sqlite3
from datetime import datetime, timezone
from uuid import uuid4


_STATUSES = {"open", "in_progress", "blocked", "awaiting_approval", "completed", "cancelled"}
_PRIORITIES = {"low", "normal", "high", "critical"}
_TRANSITIONS = {
    "open": {"in_progress", "blocked", "cancelled"},
    "in_progress": {"blocked", "awaiting_approval", "completed", "cancelled", "open"},
    "blocked": {"open", "in_progress", "cancelled"},
    "awaiting_approval": {"in_progress", "completed", "cancelled"},
    "completed": set(),
    "cancelled": set(),
}


def _now():
    return datetime.now(timezone.utc).isoformat()


def _required(value, label, maximum=512):
    if not isinstance(value, str) or not value.strip() or len(value) > maximum:
        raise ValueError(f"{label} must be a nonempty string of at most {maximum} characters")
    return value.strip()


class OperatingTaskRegistry:
    """Durable task lifecycle with explicit human approval and append-only evidence."""

    def __init__(self, connection):
        if not isinstance(connection, sqlite3.Connection):
            raise TypeError("connection must be a sqlite3.Connection")
        self.db = connection
        self.db.execute("PRAGMA foreign_keys=ON")
        from database_migrations import MigrationRunner
        from runtime_migrations import GALINYX_MIGRATIONS
        MigrationRunner(self.db, GALINYX_MIGRATIONS).migrate()
        if MigrationRunner(self.db, GALINYX_MIGRATIONS).current_version() < 4:
            raise RuntimeError("operating task schema version 4 is required")

    def _event(self, task_id, actor_id, event_type, payload, *, from_status=None, to_status=None):
        self.db.execute(
            "INSERT INTO operating_task_events "
            "(event_id,task_id,actor_id,event_type,from_status,to_status,payload_json,occurred_at) "
            "VALUES (?,?,?,?,?,?,?,?)",
            (str(uuid4()), task_id, actor_id, event_type, from_status, to_status,
             json.dumps(payload, sort_keys=True, separators=(",", ":")), _now()),
        )

    def create_task(self, *, tenant_id, project_id, title, assigned_role, created_by,
                    description="", priority="normal", approval_required=False, due_at=None):
        tenant_id = _required(tenant_id, "tenant_id", 128)
        project_id = _required(project_id, "project_id", 128)
        title = _required(title, "title", 200)
        assigned_role = _required(assigned_role, "assigned_role", 128)
        created_by = _required(created_by, "created_by", 128)
        description = _required(description, "description", 4000) if description else ""
        if priority not in _PRIORITIES:
            raise ValueError("unsupported priority")
        if not isinstance(approval_required, bool):
            raise ValueError("approval_required must be boolean")
        if due_at is not None:
            due_at = _required(due_at, "due_at", 64)
            datetime.fromisoformat(due_at.replace("Z", "+00:00"))
        task_id, stamp = str(uuid4()), _now()
        with self.db:
            tenant = self.db.execute(
                "SELECT 1 FROM tenants WHERE tenant_id=? AND active=1", (tenant_id,)
            ).fetchone()
            if tenant is None:
                raise ValueError("active tenant is required")
            self.db.execute(
                "INSERT INTO operating_tasks "
                "(task_id,tenant_id,project_id,title,description,assigned_role,status,priority,"
                "approval_required,created_by,created_at,updated_at,due_at,version) "
                "VALUES (?,?,?,?,?,?,'open',?,?,?,?,?,?,1)",
                (task_id, tenant_id, project_id, title, description, assigned_role,
                 priority, int(approval_required), created_by, stamp, stamp, due_at),
            )
            self._event(task_id, created_by, "task.created", {
                "project_id": project_id, "assigned_role": assigned_role,
                "priority": priority, "approval_required": approval_required,
            }, to_status="open")
        return task_id

    def get_task(self, task_id):
        task_id = _required(task_id, "task_id", 128)
        row = self.db.execute(
            "SELECT task_id,tenant_id,project_id,title,description,assigned_role,status,priority,"
            "approval_required,created_by,created_at,updated_at,due_at,version "
            "FROM operating_tasks WHERE task_id=?", (task_id,)
        ).fetchone()
        if row is None:
            return None
        keys = ("task_id","tenant_id","project_id","title","description","assigned_role","status",
                "priority","approval_required","created_by","created_at","updated_at","due_at","version")
        result = dict(zip(keys, row))
        result["approval_required"] = bool(result["approval_required"])
        result["evidence"] = self.list_evidence(task_id)
        result["events"] = self.list_events(task_id)
        result["approvals"] = self.list_approvals(task_id)
        return result

    def list_tasks(self, *, tenant_id, project_id=None, status=None):
        tenant_id = _required(tenant_id, "tenant_id", 128)
        if status is not None and status not in _STATUSES:
            raise ValueError("unsupported status")
        query = "SELECT task_id FROM operating_tasks WHERE tenant_id=?"
        args = [tenant_id]
        if project_id is not None:
            query += " AND project_id=?"
            args.append(_required(project_id, "project_id", 128))
        if status is not None:
            query += " AND status=?"
            args.append(status)
        query += " ORDER BY CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 "
        query += "WHEN 'normal' THEN 2 ELSE 3 END, created_at"
        return [self.get_task(row[0]) for row in self.db.execute(query, args)]

    def transition(self, task_id, *, actor_id, status, note=""):
        task_id = _required(task_id, "task_id", 128)
        actor_id = _required(actor_id, "actor_id", 128)
        note = _required(note, "note", 1000) if note else ""
        if status not in _STATUSES:
            raise ValueError("unsupported status")
        with self.db:
            row = self.db.execute(
                "SELECT status,approval_required FROM operating_tasks WHERE task_id=?", (task_id,)
            ).fetchone()
            if row is None:
                raise ValueError("unknown task")
            old, approval_required = row
            if status not in _TRANSITIONS[old]:
                raise ValueError(f"invalid task transition: {old} -> {status}")
            if status == "completed" and approval_required:
                approved = self.db.execute(
                    "SELECT 1 FROM operating_task_approvals WHERE task_id=? "
                    "AND decision='approved' ORDER BY created_at DESC LIMIT 1", (task_id,)
                ).fetchone()
                if approved is None:
                    raise PermissionError("human approval is required before completion")
            stamp = _now()
            self.db.execute(
                "UPDATE operating_tasks SET status=?,updated_at=?,version=version+1 WHERE task_id=?",
                (status, stamp, task_id),
            )
            self._event(task_id, actor_id, "task.status_changed",
                        {"note": note}, from_status=old, to_status=status)
        return self.get_task(task_id)

    def add_evidence(self, task_id, *, submitted_by, evidence_type, reference, note=""):
        task_id = _required(task_id, "task_id", 128)
        submitted_by = _required(submitted_by, "submitted_by", 128)
        evidence_type = _required(evidence_type, "evidence_type", 64)
        reference = _required(reference, "reference", 2048)
        note = _required(note, "note", 1000) if note else ""
        evidence_id, stamp = str(uuid4()), _now()
        with self.db:
            if self.db.execute("SELECT 1 FROM operating_tasks WHERE task_id=?", (task_id,)).fetchone() is None:
                raise ValueError("unknown task")
            self.db.execute(
                "INSERT INTO operating_task_evidence VALUES (?,?,?,?,?,?,?)",
                (evidence_id, task_id, submitted_by, evidence_type, reference, note, stamp),
            )
            self._event(task_id, submitted_by, "task.evidence_added",
                        {"evidence_id": evidence_id, "evidence_type": evidence_type})
        return evidence_id

    def record_approval(self, task_id, *, approver_id, decision, note=""):
        task_id = _required(task_id, "task_id", 128)
        approver_id = _required(approver_id, "approver_id", 128)
        if decision not in {"approved", "rejected"}:
            raise ValueError("decision must be approved or rejected")
        note = _required(note, "note", 1000) if note else ""
        approval_id, stamp = str(uuid4()), _now()
        with self.db:
            task = self.db.execute(
                "SELECT status,approval_required FROM operating_tasks WHERE task_id=?", (task_id,)
            ).fetchone()
            if task is None:
                raise ValueError("unknown task")
            if not task[1]:
                raise ValueError("task does not require approval")
            if task[0] not in {"awaiting_approval", "in_progress"}:
                raise ValueError("task is not eligible for approval")
            self.db.execute(
                "INSERT INTO operating_task_approvals VALUES (?,?,?,?,?,?,?)",
                (approval_id, task_id, approver_id, decision, note, stamp),
            )
            self._event(task_id, approver_id, "task.approval_recorded",
                        {"approval_id": approval_id, "decision": decision})
        return approval_id

    def list_evidence(self, task_id):
        rows = self.db.execute(
            "SELECT evidence_id,submitted_by,evidence_type,reference,note,created_at "
            "FROM operating_task_evidence WHERE task_id=? ORDER BY created_at", (task_id,)
        )
        keys = ("evidence_id","submitted_by","evidence_type","reference","note","created_at")
        return [dict(zip(keys, row)) for row in rows]

    def list_approvals(self, task_id):
        rows = self.db.execute(
            "SELECT approval_id,approver_id,decision,note,created_at "
            "FROM operating_task_approvals WHERE task_id=? ORDER BY created_at", (task_id,)
        )
        keys = ("approval_id","approver_id","decision","note","created_at")
        return [dict(zip(keys, row)) for row in rows]

    def list_events(self, task_id):
        rows = self.db.execute(
            "SELECT event_id,actor_id,event_type,from_status,to_status,payload_json,occurred_at "
            "FROM operating_task_events WHERE task_id=? ORDER BY occurred_at,event_id", (task_id,)
        )
        keys = ("event_id","actor_id","event_type","from_status","to_status","occurred_at")
        result = []
        for row in rows:
            item = dict(zip(keys, row[:5] + (row[6],)))
            item["payload"] = json.loads(row[5])
            result.append(item)
        return result
