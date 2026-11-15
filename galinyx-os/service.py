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
