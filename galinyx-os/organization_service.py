"""Credential-derived service facade for GALINYX Ventures decisions.

Authenticators are injected. The repository's tests use deterministic doubles;
a deployment must supply reviewed human and workload identity providers.
"""
class AuthenticatedOrganizationService:
    """Expose decision operations without accepting caller-asserted actor IDs."""

    def __init__(self, workflow, registry, human_authenticator,
                 workload_authenticator, approval_issuer, organization_id):
        if workflow is None or registry is None or approval_issuer is None:
            raise ValueError("workflow, registry, and approval_issuer are required")
        if not callable(getattr(human_authenticator, "authenticate", None)):
            raise TypeError("human_authenticator must provide authenticate(credential)")
        if not callable(getattr(workload_authenticator, "authenticate", None)):
            raise TypeError("workload_authenticator must provide authenticate(credential)")
        if not callable(getattr(approval_issuer, "approve", None)):
            raise TypeError("approval_issuer must provide approve(...)")
        self.workflow = workflow
        self.registry = registry
        self.human_authenticator = human_authenticator
        self.workload_authenticator = workload_authenticator
        self.approval_issuer = approval_issuer
        self.organization_id = organization_id

    @staticmethod
    def _principal(authenticator, credential, label):
        try:
            identity = authenticator.authenticate(credential)
        except Exception as exc:
            raise PermissionError(label + " authentication failed") from exc
        if not isinstance(identity, str) or not identity.strip():
            raise PermissionError(label + " authentication failed")
        return identity

    def _human_owner(self, credential):
        principal_id = self._principal(
            self.human_authenticator, credential, "human"
        )
        self.workflow._require_owner(principal_id)
        return principal_id

    def _workload_actor(self, credential):
        agent_id = self._principal(
            self.workload_authenticator, credential, "workload"
        )
        actor_id = self.registry.actor_for_agent(self.organization_id, agent_id)
        return agent_id, actor_id

    def propose(self, workload_credential, *, executor_actor_id, request_id,
                action, resource_id, proposer_grant_id, target_grant_id):
        _, proposer_actor_id = self._workload_actor(workload_credential)
        return self.workflow.propose(
            proposer_actor_id=proposer_actor_id,
            executor_actor_id=executor_actor_id,
            request_id=request_id,
            action=action,
            resource_id=resource_id,
            proposer_grant_id=proposer_grant_id,
            target_grant_id=target_grant_id,
        )

    def approve_proposal(self, human_credential, proposal_id):
        owner_id = self._human_owner(human_credential)
        proposal = self.workflow.get(proposal_id)
        approval_id = self.approval_issuer.approve(
            human_credential,
            proposal["grant_id"],
            proposal["request_id"],
            proposal["action"],
            proposal["resource_id"],
        )
        return self.workflow.approve(proposal_id, owner_id, approval_id)

    def reject_proposal(self, human_credential, proposal_id, reason):
        owner_id = self._human_owner(human_credential)
        return self.workflow.reject(proposal_id, owner_id, reason)

    def execute_approved(self, workload_credential, proposal_id):
        agent_id, actor_id = self._workload_actor(workload_credential)
        proposal = self.workflow.get(proposal_id)
        if proposal["executor_actor_id"] != actor_id:
            raise PermissionError("authenticated workload is not the designated proposal executor")
        expected_agent = self.registry.agent_for_actor(
            self.organization_id, proposal["executor_actor_id"]
        )
        if agent_id != expected_agent:
            raise PermissionError("authenticated workload does not match the designated executive")
        return self.workflow.execute_approved(proposal_id)

    def get_proposal(self, human_credential, proposal_id):
        self._human_owner(human_credential)
        return self.workflow.get(proposal_id)
