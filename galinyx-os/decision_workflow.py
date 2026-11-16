"""Human-approved executive proposal and decision workflow for GALINYX Ventures."""
import json
from datetime import datetime, timezone
from uuid import uuid4

from org_simulation import ORG_ID, RESOURCE_DIVISIONS, Actor, authorize


def _required(value, label, maximum=256):
    if not isinstance(value, str) or not value.strip() or len(value) > maximum:
        raise ValueError(f"{label} must be a nonempty string of at most {maximum} characters")
    return value


class DecisionWorkflowService:
    """Persist proposals; require owner approval before governed execution."""

    def __init__(self, authority_store, registry, simulator, organization_id=ORG_ID):
        if authority_store is None or registry is None or simulator is None:
            raise ValueError("authority_store, registry, and simulator are required")
        self.store = authority_store
        self.db = authority_store.db
        self.registry = registry
        self.simulator = simulator
        self.organization_id = organization_id

    def _organization(self):
        return self.registry.get(self.organization_id)

    def _latest_event(self, proposal_id):
        return self.db.execute(
            "SELECT state,actor_type,actor_id,approval_id,execution_id,detail_json,occurred_at "
            "FROM galinyx_decision_events WHERE proposal_id=? "
            "ORDER BY event_id DESC LIMIT 1",
            (proposal_id,),
        ).fetchone()

    def _append_event(self, *, proposal_id, state, actor_type, actor_id,
                      detail, approval_id=None, execution_id=None,
                      grant_id=None, request_id=None, action=None, resource_id=None,
                      agent_id=None):
        occurred_at = datetime.now(timezone.utc).isoformat()
        self.store._begin()
        try:
            proposal = self.db.execute(
                "SELECT org_id FROM galinyx_decision_proposals WHERE proposal_id=?",
                (proposal_id,),
            ).fetchone()
            if proposal is None:
                raise KeyError("proposal not found")
            self.db.execute(
                "INSERT INTO galinyx_decision_events "
                "(proposal_id,state,actor_type,actor_id,approval_id,execution_id,detail_json,occurred_at) "
                "VALUES (?,?,?,?,?,?,?,?)",
                (proposal_id, state, actor_type, actor_id, approval_id, execution_id,
                 json.dumps(detail, sort_keys=True, separators=(",", ":")), occurred_at),
            )
            organization = self._organization()
            self.store._append_audit(
                actor_type=actor_type,
                actor_id=actor_id,
                agent_id=agent_id,
                tenant_id=organization["tenant_id"],
                grant_id=grant_id,
                request_id=request_id,
                action=action,
                resource_id=resource_id,
                decision=state,
                policy_version="galinyx-decision-workflow-1",
                payload={"proposal_id": proposal_id, **detail},
                occurred_at=occurred_at,
            )
            self.store._finish()
        except Exception as exc:
            self.store._finish(exc)
            raise

    def _require_owner(self, owner_principal_id):
        org = self._organization()
        if owner_principal_id != org["root_principal_id"]:
            raise PermissionError("human root owner approval is required")
        membership = self.db.execute(
            "SELECT 1 FROM principals p JOIN tenant_memberships m "
            "ON m.principal_id=p.principal_id "
            "WHERE p.principal_id=? AND p.active=1 AND m.tenant_id=? "
            "AND m.active=1 AND m.role='owner'",
            (owner_principal_id, org["tenant_id"]),
        ).fetchone()
        if membership is None:
            raise PermissionError("active organization owner membership is required")
        return org

    def _grant_scope(self, grant_id, agent_id, action, resource_id, *, require_approval=False):
        row = self.db.execute(
            "SELECT g.actions_json,g.resources_json,g.approval_required_json,"
            "b.tenant_id FROM ahaf_authority_grants g "
            "JOIN ahaf_agent_bindings b ON b.agent_id=g.subject_agent_id "
            "WHERE g.grant_id=? AND g.subject_agent_id=?",
            (grant_id, agent_id),
        ).fetchone()
        if row is None or row[3] != self._organization()["tenant_id"]:
            raise PermissionError("grant is not bound to the registered organization workload")
        if not self.store.grant_is_active(grant_id):
            raise PermissionError("authority grant is inactive")
        actions, resources, approvals = map(json.loads, row[:3])
        if action not in actions or resource_id not in resources:
            raise PermissionError("grant does not authorize the requested action and resource")
        if require_approval and action not in approvals:
            raise PermissionError("proposal target action must require human approval")
        return True

    def propose(self, *, proposer_actor_id, executor_actor_id, request_id,
                action, resource_id, proposer_grant_id, target_grant_id):
        org = self._organization()
        proposer_role = self.registry.role_for_actor(self.organization_id, proposer_actor_id)
        proposer = Actor(proposer_actor_id, proposer_role["role"], proposer_role["division"])
        policy = authorize(
            proposer, "strategy.propose",
            resource_division=RESOURCE_DIVISIONS.get(resource_id),
            tenant_id=self.organization_id,
        )
        if not policy.allowed:
            raise PermissionError(policy.reason)
        proposer_agent = self.registry.agent_for_actor(self.organization_id, proposer_actor_id)
        executor_agent = self.registry.agent_for_actor(self.organization_id, executor_actor_id)
        self._grant_scope(
            proposer_grant_id, proposer_agent, "strategy.propose", resource_id
        )
        executor_role = self.registry.role_for_actor(self.organization_id, executor_actor_id)
        executor = Actor(executor_actor_id, executor_role["role"], executor_role["division"])
        target_policy = authorize(
            executor, action,
            resource_division=RESOURCE_DIVISIONS.get(resource_id),
            human_approval=True,
            tenant_id=self.organization_id,
        )
        if not target_policy.allowed:
            raise PermissionError(target_policy.reason)
        self._grant_scope(
            target_grant_id, executor_agent, action, resource_id, require_approval=True
        )
        request_id = _required(request_id, "request_id")
        proposal_id = str(uuid4())
        created_at = datetime.now(timezone.utc).isoformat()
        self.store._begin()
        try:
            self.db.execute(
                "INSERT INTO galinyx_decision_proposals "
                "(proposal_id,org_id,proposer_actor_id,executor_actor_id,request_id,"
                "action,resource_id,proposer_grant_id,grant_id,created_at) "
                "VALUES (?,?,?,?,?,?,?,?,?,?)",
                (proposal_id, self.organization_id, proposer_actor_id, executor_actor_id,
                 request_id, action, resource_id, proposer_grant_id, target_grant_id, created_at),
            )
            self.db.execute(
                "INSERT INTO galinyx_decision_events "
                "(proposal_id,state,actor_type,actor_id,detail_json,occurred_at) "
                "VALUES (?,'proposed','agent',?,?,?)",
                (proposal_id, proposer_actor_id,
                 json.dumps({"action": action, "resource_id": resource_id,
                             "executor_actor_id": executor_actor_id}, sort_keys=True),
                 created_at),
            )
            self.store._append_audit(
                actor_type="agent", actor_id=proposer_actor_id,
                agent_id=proposer_agent, tenant_id=org["tenant_id"],
                grant_id=proposer_grant_id, request_id=request_id,
                action="decision.propose", resource_id=resource_id,
                decision="proposed", policy_version="galinyx-decision-workflow-1",
                payload={"proposal_id": proposal_id, "target_action": action,
                         "executor_actor_id": executor_actor_id},
                occurred_at=created_at,
            )
            self.store._finish()
        except Exception as exc:
            self.store._finish(exc)
            raise
        return self.get(proposal_id)

    def approve(self, proposal_id, owner_principal_id, approval_id):
        org = self._require_owner(owner_principal_id)
        proposal = self.db.execute(
            "SELECT request_id,action,resource_id,grant_id,executor_actor_id "
            "FROM galinyx_decision_proposals WHERE proposal_id=? AND org_id=?",
            (proposal_id, self.organization_id),
        ).fetchone()
        if proposal is None:
            raise KeyError("proposal not found")
        latest = self._latest_event(proposal_id)
        if latest is None or latest[0] != "proposed":
            raise PermissionError("only a proposed decision can be approved")
        request_id, action, resource_id, grant_id, _ = proposal
        approval = self.db.execute(
            "SELECT approver_principal_id,grant_id,request_id,action,resource_id,decision,expires_at "
            "FROM ahaf_approvals WHERE approval_id=?",
            (approval_id,),
        ).fetchone()
        if approval is None:
            raise PermissionError("a persisted human approval is required")
        (approver, approved_grant, approved_request, approved_action,
         approved_resource, decision, expires_at) = approval
        if (approver != owner_principal_id or approved_grant != grant_id
                or approved_request != request_id or approved_action != action
                or approved_resource != resource_id or decision != "approved"
                or expires_at <= datetime.now(timezone.utc).isoformat()):
            raise PermissionError("approval does not match this exact proposal")
        if self.db.execute(
            "SELECT 1 FROM ahaf_approval_consumptions WHERE approval_id=?",
            (approval_id,),
        ).fetchone():
            raise PermissionError("approval has already been consumed")
        self._append_event(
            proposal_id=proposal_id, state="approved", actor_type="human",
            actor_id=owner_principal_id, approval_id=approval_id,
            grant_id=grant_id, request_id=request_id, action="decision.approve",
            resource_id=resource_id,
            detail={"approval_id": approval_id, "decision": "approved"},
        )
        return self.get(proposal_id)

    def reject(self, proposal_id, owner_principal_id, reason):
        self._require_owner(owner_principal_id)
        proposal = self.db.execute(
            "SELECT request_id,action,resource_id,proposer_actor_id "
            "FROM galinyx_decision_proposals WHERE proposal_id=? AND org_id=?",
            (proposal_id, self.organization_id),
        ).fetchone()
        if proposal is None:
            raise KeyError("proposal not found")
        if self._latest_event(proposal_id)[0] != "proposed":
            raise PermissionError("only a proposed decision can be rejected")
        request_id, action, resource_id, proposer_actor_id = proposal
        self._append_event(
            proposal_id=proposal_id, state="rejected", actor_type="human",
            actor_id=owner_principal_id, request_id=request_id,
            action="decision.reject", resource_id=resource_id,
            detail={"reason": str(reason)[:512]},
        )
        return self.get(proposal_id)

    def execute_approved(self, proposal_id):
        proposal = self.db.execute(
            "SELECT executor_actor_id,request_id,action,resource_id,grant_id "
            "FROM galinyx_decision_proposals WHERE proposal_id=? AND org_id=?",
            (proposal_id, self.organization_id),
        ).fetchone()
        if proposal is None:
            raise KeyError("proposal not found")
        latest = self._latest_event(proposal_id)
        if latest is None or latest[0] != "approved":
            raise PermissionError("only an owner-approved proposal can execute")
        executor_actor_id, request_id, action, resource_id, grant_id = proposal
        approval_id = latest[3]
        role = self.registry.role_for_actor(self.organization_id, executor_actor_id)
        actor = Actor(executor_actor_id, role["role"], role["division"])
        result = self.simulator.execute(
            actor, action, resource_id, request_id, grant_id,
            approval_id=approval_id,
        )
        if result["status"] in {"simulated", "already_simulated"}:
            state = "executed"
            execution_id = result["execution_id"]
        else:
            state = "execution_denied"
            execution_id = None
        agent_id = self.registry.agent_for_actor(self.organization_id, executor_actor_id)
        self._append_event(
            proposal_id=proposal_id, state=state, actor_type="agent",
            actor_id=executor_actor_id, execution_id=execution_id,
            grant_id=grant_id, request_id=request_id, action=action,
            resource_id=resource_id, agent_id=agent_id,
            detail={"execution_status": result["status"], "decision": result.get("decision")},
        )
        return {"proposal": self.get(proposal_id), "execution": result}

    def get(self, proposal_id):
        proposal = self.db.execute(
            "SELECT proposal_id,org_id,proposer_actor_id,executor_actor_id,request_id,"
            "action,resource_id,proposer_grant_id,grant_id,created_at "
            "FROM galinyx_decision_proposals WHERE proposal_id=?",
            (proposal_id,),
        ).fetchone()
        if proposal is None:
            raise KeyError("proposal not found")
        keys = ("proposal_id", "org_id", "proposer_actor_id", "executor_actor_id",
                "request_id", "action", "resource_id", "proposer_grant_id",
                "grant_id", "created_at")
        result = dict(zip(keys, proposal))
        events = self.db.execute(
            "SELECT state,actor_type,actor_id,approval_id,execution_id,detail_json,occurred_at "
            "FROM galinyx_decision_events WHERE proposal_id=? ORDER BY event_id",
            (proposal_id,),
        ).fetchall()
        result["state"] = events[-1][0] if events else "invalid"
        result["events"] = [
            {"state": row[0], "actor_type": row[1], "actor_id": row[2],
             "approval_id": row[3], "execution_id": row[4],
             "detail": json.loads(row[5]), "occurred_at": row[6]}
            for row in events
        ]
        return result
