"""Provider-neutral identity and ownership policy core for the GALINYX prototype.

IMPORTANT SECURITY BOUNDARY:
- This module is a local policy model, not authentication.
- principal_id arguments must come from a future trusted authentication adapter.
- Never expose these methods directly as network endpoints.
- The in-memory directory is not durable and is not suitable for production.
- Tests here prove policy decisions for supplied trusted context; they do not prove
  that a credential belongs to the principal named in that context.
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class Principal:
    principal_id: str
    principal_type: str
    active: bool = True


@dataclass(frozen=True)
class Tenant:
    tenant_id: str
    tenant_type: str
    owner_principal_id: str
    active: bool = True


@dataclass(frozen=True)
class Membership:
    tenant_id: str
    principal_id: str
    role: str
    active: bool = True


@dataclass(frozen=True)
class ResourceOwnership:
    resource_id: str
    tenant_id: str
    owner_principal_id: str


@dataclass(frozen=True)
class AuthorizationDecision:
    allowed: bool
    reason: str


class IdentityPolicyError(ValueError):
    """Raised when trusted setup data is invalid or conflicts with existing state."""


class IdentityDirectory:
    """Small in-memory policy directory for isolated tests and local prototyping.

    Setup methods represent trusted platform administration. They are not safe
    to call with untrusted request fields. A future service must authenticate a
    credential first, derive the principal server-side, then call authorize().
    """

    _ROLE_ACTIONS = {
        "owner": frozenset({"resource.read", "resource.write", "resource.delete", "membership.manage"}),
        "editor": frozenset({"resource.read", "resource.write"}),
        "viewer": frozenset({"resource.read"}),
    }
    _ACTIONS = frozenset({"resource.read", "resource.write", "resource.delete", "membership.manage"})

    def __init__(self):
        self._principals = {}
        self._tenants = {}
        self._memberships = {}
        self._resources = {}

    @staticmethod
    def _required_id(value, label):
        if not isinstance(value, str) or not value.strip() or len(value) > 128:
            raise IdentityPolicyError(f"{label} must be a nonempty string of at most 128 characters")
        return value

    def register_human(self, principal_id):
        principal_id = self._required_id(principal_id, "principal_id")
        if principal_id in self._principals:
            raise IdentityPolicyError("principal already exists")
        self._principals[principal_id] = Principal(principal_id, "human")
        return self._principals[principal_id]

    def create_personal_workspace(self, tenant_id, owner_principal_id):
        tenant_id = self._required_id(tenant_id, "tenant_id")
        owner_principal_id = self._required_id(owner_principal_id, "owner_principal_id")
        principal = self._principals.get(owner_principal_id)
        if principal is None or not principal.active or principal.principal_type != "human":
            raise IdentityPolicyError("active registered human required to own a personal workspace")
        if tenant_id in self._tenants:
            raise IdentityPolicyError("tenant already exists")
        tenant = Tenant(tenant_id, "personal", owner_principal_id)
        self._tenants[tenant_id] = tenant
        self._memberships[(tenant_id, owner_principal_id)] = Membership(
            tenant_id, owner_principal_id, "owner"
        )
        return tenant

    def grant_membership(self, tenant_id, principal_id, role):
        """Trusted setup hook; a future API must authorize the grantor separately."""
        tenant_id = self._required_id(tenant_id, "tenant_id")
        principal_id = self._required_id(principal_id, "principal_id")
        tenant = self._tenants.get(tenant_id)
        principal = self._principals.get(principal_id)
        if tenant is None or not tenant.active:
            raise IdentityPolicyError("active tenant required")
        if principal is None or not principal.active or principal.principal_type != "human":
            raise IdentityPolicyError("active registered human required")
        if role not in ("editor", "viewer"):
            raise IdentityPolicyError("membership role must be editor or viewer")
        key = (tenant_id, principal_id)
        if key in self._memberships and self._memberships[key].active:
            raise IdentityPolicyError("active membership already exists")
        self._memberships[key] = Membership(tenant_id, principal_id, role)
        return self._memberships[key]

    def revoke_membership(self, tenant_id, principal_id):
        key = (tenant_id, principal_id)
        membership = self._memberships.get(key)
        if membership is None or not membership.active:
            return False
        self._memberships[key] = Membership(
            membership.tenant_id, membership.principal_id, membership.role, False
        )
        return True

    def disable_principal(self, principal_id):
        principal = self._principals.get(principal_id)
        if principal is None:
            return False
        self._principals[principal_id] = Principal(
            principal.principal_id, principal.principal_type, False
        )
        return True

    def register_resource(self, resource_id, tenant_id, owner_principal_id):
        """Trusted platform setup hook; never accept ownership from a client."""
        resource_id = self._required_id(resource_id, "resource_id")
        tenant_id = self._required_id(tenant_id, "tenant_id")
        owner_principal_id = self._required_id(owner_principal_id, "owner_principal_id")
        tenant = self._tenants.get(tenant_id)
        membership = self._memberships.get((tenant_id, owner_principal_id))
        if tenant is None or not tenant.active:
            raise IdentityPolicyError("active tenant required")
        if tenant.owner_principal_id != owner_principal_id:
            raise IdentityPolicyError("personal resource owner must be the workspace owner")
        if membership is None or not membership.active or membership.role != "owner":
            raise IdentityPolicyError("active workspace owner membership required")
        if resource_id in self._resources:
            raise IdentityPolicyError("resource already exists")
        resource = ResourceOwnership(resource_id, tenant_id, owner_principal_id)
        self._resources[resource_id] = resource
        return resource

    def authorize(self, principal_id, tenant_id, resource_id, action):
        """Evaluate policy for a principal already authenticated by a trusted caller."""
        principal = self._principals.get(principal_id)
        if principal is None or not principal.active or principal.principal_type != "human":
            return AuthorizationDecision(False, "unknown_or_inactive_human")
        tenant = self._tenants.get(tenant_id)
        if tenant is None or not tenant.active:
            return AuthorizationDecision(False, "unknown_or_inactive_tenant")
        membership = self._memberships.get((tenant_id, principal_id))
        if membership is None or not membership.active:
            return AuthorizationDecision(False, "active_membership_required")
        resource = self._resources.get(resource_id)
        if resource is None:
            return AuthorizationDecision(False, "unknown_resource")
        if resource.tenant_id != tenant_id:
            return AuthorizationDecision(False, "cross_tenant_access_denied")
        if action not in self._ACTIONS:
            return AuthorizationDecision(False, "unknown_action_denied")
        allowed_actions = self._ROLE_ACTIONS.get(membership.role, frozenset())
        if action not in allowed_actions:
            return AuthorizationDecision(False, "role_permission_denied")
        return AuthorizationDecision(True, "authorized")
