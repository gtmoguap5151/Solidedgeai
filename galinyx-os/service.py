"""Trusted service facade for GALINYX's local prototype.

The facade derives principal IDs from an injected authenticator rather than
accepting principal IDs in individual operations. No production authenticator
is included. This is an integration seam for testing, not a deployed login system.
"""
from runtime import Runtime


class AuthenticationError(PermissionError):
    """Credential could not be mapped to an active authenticated principal."""


class GalinyxService:
    """Narrow application-facing facade around the trusted-local Runtime.

    The authenticator must validate credentials and return the corresponding
    principal ID. The caller never supplies a principal ID to service methods.
    Production use requires a real, independently reviewed authenticator and
    a deployment boundary that does not expose Runtime or its SQLite connection.
    """

    def __init__(self, runtime: Runtime, authenticator):
        if runtime is None or authenticator is None:
            raise ValueError("runtime and authenticator are required")
        if not callable(getattr(authenticator, "authenticate", None)):
            raise TypeError("authenticator must provide authenticate(credential)")
        self.__runtime = runtime
        self.__authenticator = authenticator

    def _principal(self, credential):
        try:
            principal_id = self.__authenticator.authenticate(credential)
        except Exception as exc:
            raise AuthenticationError("authentication failed") from exc
        if not isinstance(principal_id, str) or not principal_id.strip():
            raise AuthenticationError("authentication failed")
        return principal_id

    def create_agent(self, credential, tenant_id, name, capabilities=()):
        principal_id = self._principal(credential)
        return self.__runtime.create_owned_entity(
            principal_id, tenant_id, name, "agent", capabilities
        )

    def execute_agent(self, credential, tenant_id, entity_id, action,
                      payload=None, request_id=None):
        principal_id = self._principal(credential)
        return self.__runtime.execute_as(
            principal_id, tenant_id, entity_id, action, payload, request_id
        )

    def read_memory(self, credential, tenant_id, entity_id, key):
        principal_id = self._principal(credential)
        allowed, reason = self.__runtime.authorize_resource(
            principal_id, tenant_id, entity_id, "resource.read"
        )
        if not allowed:
            raise PermissionError(reason)
        return self.__runtime.remember(entity_id, key)

    def add_workspace_member(self, credential, tenant_id, member_principal_id, role):
        grantor_principal_id = self._principal(credential)
        return self.__runtime.grant_workspace_membership_as(
            grantor_principal_id, tenant_id, member_principal_id, role
        )

    def remove_workspace_member(self, credential, tenant_id, member_principal_id):
        grantor_principal_id = self._principal(credential)
        return self.__runtime.revoke_workspace_membership_as(
            grantor_principal_id, tenant_id, member_principal_id
        )

    def inspect_agent(self, credential, tenant_id, entity_id):
        principal_id = self._principal(credential)
        allowed, reason = self.__runtime.authorize_resource(
            principal_id, tenant_id, entity_id, "resource.read"
        )
        if not allowed:
            raise PermissionError(reason)
        return self.__runtime.entity(entity_id)

    def _task_registry(self):
        from operating_tasks import OperatingTaskRegistry
        return OperatingTaskRegistry(self.__runtime.db)

    def _task_actor(self, credential, tenant_id, allowed_roles):
        """Authenticate and authorize a human workspace member for task operations."""
        principal_id = self._principal(credential)
        if not isinstance(tenant_id, str) or not tenant_id.strip() or len(tenant_id) > 128:
            raise ValueError("tenant_id must be a nonempty string of at most 128 characters")
        row = self.__runtime.db.execute(
            "SELECT m.role FROM tenant_memberships m "
            "JOIN tenants t ON t.tenant_id=m.tenant_id "
            "JOIN principals p ON p.principal_id=m.principal_id "
            "WHERE m.tenant_id=? AND m.principal_id=? "
            "AND m.active=1 AND t.active=1 AND p.active=1 AND p.principal_type='human'",
            (tenant_id, principal_id)
        ).fetchone()
        if row is None or row[0] not in allowed_roles:
            raise PermissionError("active workspace membership and role are required")
        return principal_id, row[0]

    def create_operating_task(self, credential, tenant_id, project_id, title,
                              assigned_role, description="", priority="normal",
                              approval_required=False, due_at=None):
        principal_id, _ = self._task_actor(credential, tenant_id, {"owner", "editor"})
        return self._task_registry().create_task(
            tenant_id=tenant_id, project_id=project_id, title=title,
            assigned_role=assigned_role, created_by=principal_id,
            description=description, priority=priority,
            approval_required=approval_required, due_at=due_at
        )

    def list_operating_tasks(self, credential, tenant_id, project_id=None, status=None):
        self._task_actor(credential, tenant_id, {"owner", "editor", "viewer"})
        return self._task_registry().list_tasks(
            tenant_id=tenant_id, project_id=project_id, status=status
        )

    def get_operating_task(self, credential, tenant_id, task_id):
        self._task_actor(credential, tenant_id, {"owner", "editor", "viewer"})
        task = self._task_registry().get_task(task_id)
        if task is None or task["tenant_id"] != tenant_id:
            return None
        return task

    def transition_operating_task(self, credential, tenant_id, task_id, status, note=""):
        principal_id, _ = self._task_actor(credential, tenant_id, {"owner", "editor"})
        task = self._task_registry().get_task(task_id)
        if task is None or task["tenant_id"] != tenant_id:
            raise PermissionError("task is outside the authenticated workspace")
        return self._task_registry().transition(
            task_id, actor_id=principal_id, status=status, note=note
        )

    def add_operating_task_evidence(self, credential, tenant_id, task_id,
                                    evidence_type, reference, note=""):
        principal_id, _ = self._task_actor(credential, tenant_id, {"owner", "editor"})
        task = self._task_registry().get_task(task_id)
        if task is None or task["tenant_id"] != tenant_id:
            raise PermissionError("task is outside the authenticated workspace")
        return self._task_registry().add_evidence(
            task_id, submitted_by=principal_id, evidence_type=evidence_type,
            reference=reference, note=note
        )

    def approve_operating_task(self, credential, tenant_id, task_id, decision, note=""):
        principal_id, _ = self._task_actor(credential, tenant_id, {"owner"})
        owner = self.__runtime.db.execute(
            "SELECT owner_principal_id FROM tenants WHERE tenant_id=? AND active=1",
            (tenant_id,)
        ).fetchone()
        if owner is None or owner[0] != principal_id:
            raise PermissionError("workspace owner approval is required")
        task = self._task_registry().get_task(task_id)
        if task is None or task["tenant_id"] != tenant_id:
            raise PermissionError("task is outside the authenticated workspace")
        return self._task_registry().record_approval(
            task_id, approver_id=principal_id, decision=decision, note=note
        )
