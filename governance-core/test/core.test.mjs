import test from "node:test";
import assert from "node:assert/strict";
import { evaluateAction, applyHumanOverride, appendAuditEvent, verifyAuditChain, validatePolicy, GovernanceError } from "./index.mjs";

const policy = {
  roles: [{id:"secretary",level:1},{id:"director",level:5},{id:"reviewer",level:3}],
  permissions: [{roleId:"secretary",action:"propose_product"},{roleId:"director",action:"publish_product"}],
  approvalRules: [{action:"publish_product",minimumApprovals:1,approverRoleIds:["reviewer"]}],
  humanOverrideRoleIds:["director"]
};
const actor = {id:"user-1",roleId:"secretary"};
test("explicit permission permits a proposal with no approval rule", () => {
  assert.equal(evaluateAction({actor,action:"propose_product",policy}).allowed,true);
});
test("missing permission is denied", () => {
  assert.equal(evaluateAction({actor,action:"publish_product",policy}).allowed,false);
});
test("publication requires an independent eligible approval", () => {
  const result=evaluateAction({actor:{id:"publisher",roleId:"director"},action:"publish_product",policy,approvals:[{actorId:"reviewer-1",roleId:"reviewer",decision:"approve"}]});
  assert.equal(result.allowed,true);
});
test("requester cannot satisfy their own approval requirement", () => {
  const result=evaluateAction({actor:{id:"publisher",roleId:"director"},action:"publish_product",policy,approvals:[{actorId:"publisher",roleId:"reviewer",decision:"approve"}]});
  assert.equal(result.allowed,false);
  assert.ok(result.reasons.includes("required_approvals_not_met"));
});
test("declared conflict blocks an otherwise authorized action", () => {
  const result=evaluateAction({actor:{id:"publisher",roleId:"director"},action:"publish_product",policy,approvals:[{actorId:"reviewer-1",roleId:"reviewer",decision:"approve"}],resource:{conflictOfInterestActorIds:["publisher"]}});
  assert.equal(result.status,"blocked_conflict");
});
test("human override requires an authorized role and a reason", () => {
  const evaluation=evaluateAction({actor,action:"publish_product",policy});
  assert.equal(applyHumanOverride(evaluation,{actor:{id:"director-1",roleId:"director"},reason:"Documented exception after review",decision:"approve",policy}).allowed,true);
  assert.throws(()=>applyHumanOverride(evaluation,{actor,reason:"because",decision:"approve",policy}),e=>e instanceof GovernanceError && e.code==="OVERRIDE_NOT_AUTHORIZED");
});
test("audit chain detects mutation", () => {
  const first=appendAuditEvent(null,{eventType:"proposal.created",actorId:"user-1",timestamp:"2026-11-16T12:00:00.000Z"});
  const second=appendAuditEvent(first,{eventType:"approval.granted",actorId:"reviewer-1",timestamp:"2026-11-16T12:01:00.000Z"});
  assert.equal(verifyAuditChain([first,second]),true);
  assert.equal(verifyAuditChain([first,{...second,outcome:"tampered"}]),false);
});
test("policy rejects duplicate role identifiers", () => {
  assert.throws(()=>validatePolicy({...policy,roles:[...policy.roles,{id:"secretary",level:2}]}),e=>e.code==="DUPLICATE_ROLE");
});
