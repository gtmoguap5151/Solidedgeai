"""Persistent, append-only registry for GALINYX organizational structure."""
from datetime import datetime, timezone


def _required(value, label, maximum=256):
    if not isinstance(value, str) or not value.strip() or len(value) > maximum:
        raise ValueError(f"{label} must be a nonempty string of at most {maximum} characters")
    return value


class GalinyxOrganizationRegistry:
    """Register a simulation organization against an owner-controlled tenant."""

    def __init__(self, authority_store):
        if authority_store is None:
            raise ValueError("authority_store is required")
        self.store = authority_store
        self.db = authority_store.db

    def register(self, *, org_id, tenant_id, owner_principal_id, name,
                 roles, actor_agent_bindings, policy_version="galinyx-ventures-policy-1"):
        org_id = _required(org_id, "org_id")
        tenant_id = _required(tenant_id, "tenant_id")
        owner_principal_id = _required(owner_principal_id, "owner_principal_id")
        name = _required(name, "name")
        policy_version = _required(policy_version, "policy_version", 64)
        if not isinstance(roles, (list, tuple)) or not roles:
            raise ValueError("roles must be a nonempty list")
        if not isinstance(actor_agent_bindings, dict):
            raise ValueError("actor_agent_bindings must be a mapping")

        normalized_roles = {}
        for role in roles:
            if not isinstance(role, dict):
                raise ValueError("each role must be a mapping")
            actor_id = _required(role.get("actor_id"), "role.actor_id")
            normalized_roles[actor_id] = {
                "title": _required(role.get("title"), "role.title"),
                "reports_to_actor_id": role.get("reports_to"),
                "division": role.get("division"),
            }
        if owner_principal_id not in normalized_roles:
            raise ValueError("the human root principal must have an organizational role")
        for actor_id, role in normalized_roles.items():
            parent = role["reports_to_actor_id"]
            if parent is not None and parent not in normalized_roles:
                raise ValueError("every reporting line must reference a registered actor")
            if actor_id == owner_principal_id and parent is not None:
                raise ValueError("the human root role cannot report to another actor")

        bindings = {}
        for actor_id, agent_id in actor_agent_bindings.items():
            actor_id = _required(actor_id, "binding.actor_id")
            agent_id = _required(agent_id, "binding.agent_id")
            if actor_id not in normalized_roles:
                raise ValueError("every bound actor must have a registered organizational role")
            bindings[actor_id] = agent_id

        created_at = datetime.now(timezone.utc).isoformat()
        self.store._begin()
        try:
            owner = self.db.execute(
                "SELECT 1 FROM principals p "
                "JOIN tenants t ON t.owner_principal_id=p.principal_id "
                "JOIN tenant_memberships m ON m.tenant_id=t.tenant_id AND m.principal_id=p.principal_id "
                "WHERE p.principal_id=? AND p.active=1 AND t.tenant_id=? AND t.active=1 "
                "AND m.active=1 AND m.role='owner'",
                (owner_principal_id, tenant_id),
            ).fetchone()
            if owner is None:
                raise PermissionError("active tenant owner is required to register an organization")
            if self.db.execute(
                "SELECT 1 FROM galinyx_organizations WHERE org_id=? OR tenant_id=?",
                (org_id, tenant_id),
            ).fetchone():
                raise ValueError("organization ID or tenant is already registered")

            for actor_id, agent_id in bindings.items():
                binding = self.db.execute(
                    "SELECT b.tenant_id,b.owner_principal_id "
                    "FROM ahaf_agent_bindings b "
                    "LEFT JOIN ahaf_agent_binding_revocations r ON r.agent_id=b.agent_id "
                    "WHERE b.agent_id=? AND r.agent_id IS NULL",
                    (agent_id,),
                ).fetchone()
                if binding is None or binding[0] != tenant_id or binding[1] != owner_principal_id:
                    raise PermissionError("each executive must have an active agent binding owned by this tenant owner")

            self.db.execute(
                "INSERT INTO galinyx_organizations "
                "(org_id,tenant_id,name,mode,authority_model,root_principal_id,policy_version,created_at) "
                "VALUES (?,?,?,'simulation-only','human-root/hybrid-enforcement',?,?,?)",
                (org_id, tenant_id, name, owner_principal_id, policy_version, created_at),
            )
            for actor_id, role in normalized_roles.items():
                self.db.execute(
                    "INSERT INTO galinyx_org_roles "
                    "(org_id,actor_id,title,reports_to_actor_id,division,created_at) "
                    "VALUES (?,?,?,?,?,?)",
                    (org_id, actor_id, role["title"], role["reports_to_actor_id"],
                     role["division"], created_at),
                )
            for actor_id, agent_id in bindings.items():
                self.db.execute(
                    "INSERT INTO galinyx_org_actor_bindings "
                    "(org_id,actor_id,agent_id,created_at) VALUES (?,?,?,?)",
                    (org_id, actor_id, agent_id, created_at),
                )
            self.store._append_audit(
                actor_type="human",
                actor_id=owner_principal_id,
                tenant_id=tenant_id,
                policy_version=policy_version,
                action="organization.register",
                resource_id=org_id,
                decision="organization_registered",
                payload={
                    "name": name,
                    "mode": "simulation-only",
                    "authority_model": "human-root/hybrid-enforcement",
                    "role_count": len(normalized_roles),
                    "agent_binding_count": len(bindings),
                },
            )
            self.store._finish()
        except Exception as exc:
            self.store._finish(exc)
            raise
        return self.get(org_id)

    def get(self, org_id):
        org_id = _required(org_id, "org_id")
        row = self.db.execute(
            "SELECT org_id,tenant_id,name,mode,authority_model,root_principal_id,policy_version,created_at "
            "FROM galinyx_organizations WHERE org_id=?",
            (org_id,),
        ).fetchone()
        if row is None:
            raise KeyError("organization not found")
        keys = ("org_id", "tenant_id", "name", "mode", "authority_model",
                "root_principal_id", "policy_version", "created_at")
        result = dict(zip(keys, row))
        result["roles"] = [
            {
                "actor_id": r[0], "title": r[1],
                "reports_to": r[2], "division": r[3],
            }
            for r in self.db.execute(
                "SELECT actor_id,title,reports_to_actor_id,division "
                "FROM galinyx_org_roles WHERE org_id=? ORDER BY actor_id",
                (org_id,),
            )
        ]
        result["actor_agent_bindings"] = {
            r[0]: r[1] for r in self.db.execute(
                "SELECT actor_id,agent_id FROM galinyx_org_actor_bindings WHERE org_id=?",
                (org_id,),
            )
        }
        return result

    def agent_for_actor(self, org_id, actor_id):
        row = self.db.execute(
            "SELECT b.agent_id FROM galinyx_org_actor_bindings b "
            "JOIN galinyx_organizations o ON o.org_id=b.org_id "
            "JOIN ahaf_agent_bindings a ON a.agent_id=b.agent_id "
            "LEFT JOIN ahaf_agent_binding_revocations r ON r.agent_id=a.agent_id "
            "WHERE b.org_id=? AND b.actor_id=? AND o.mode='simulation-only' "
            "AND a.tenant_id=o.tenant_id AND r.agent_id IS NULL",
            (org_id, actor_id),
        ).fetchone()
        if row is None:
            raise PermissionError("actor has no active persisted organization workload binding")
        return row[0]
