import { createHash, randomUUID } from "node:crypto";
import { WORKFORCE_LIMITS } from "./roles.mjs";

function digest(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

/**
 * Converts recommendations into review packets.
 * This is a non-authoritative handoff format, not the Governance Core decision
 * engine. It cannot approve, reject, grant authority, or execute an action.
 */
export function createHumanReviewPackets({ runId, workerReports, allowedEvidenceRefs = [] }) {
  if (typeof runId !== "string" || !runId.trim()) throw new TypeError("runId required");
  if (!Array.isArray(workerReports)) throw new TypeError("workerReports must be an array");
  const knownEvidence = new Set(allowedEvidenceRefs);
  const packets = [];

  for (const report of workerReports) {
    for (const proposal of report.proposedActions) {
      const refs = proposal.evidenceRefs.filter((ref) => knownEvidence.has(ref));
      packets.push(Object.freeze({
        id: randomUUID(),
        runId,
        sourceWorker: report.workerId,
        title: proposal.title,
        actionType: proposal.actionType,
        risk: proposal.risk,
        evidenceRefs: Object.freeze(refs),
        missingEvidence: proposal.evidenceRefs.filter((ref) => !knownEvidence.has(ref)),
        requiresHumanApproval: true,
        status: "awaiting_human_review",
        policyReviewRequired: true,
        packetSha256: digest({
          runId,
          sourceWorker: report.workerId,
          title: proposal.title,
          actionType: proposal.actionType,
          risk: proposal.risk,
          evidenceRefs: refs,
        }),
      }));
    }
  }

  return Object.freeze(packets);
}

export function assertProposalOnly(packet) {
  if (!packet || packet.status !== "awaiting_human_review" ||
      packet.requiresHumanApproval !== true || packet.policyReviewRequired !== true ||
      !WORKFORCE_LIMITS.allowedActionTypes.includes(packet.actionType)) {
    throw new Error("WORKFORCE_PROPOSAL_NOT_ELIGIBLE_FOR_HANDOFF");
  }
  return true;
}
