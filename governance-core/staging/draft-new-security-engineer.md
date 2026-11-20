DRAFT — NOT PUBLISHED. Staging only.
Status: approved by the owner 2026-11-20 ~01:20 ET (audit seq 85) — registered as The Seal (draft-only)
Written by: Governance Core — new-operator announcement, ordered by the owner
Date: Nov 20, 2026
Status: in staging
Type: Announcement of a new operator role in the GALINYX Workforce environment. Working title only — the owner names this worker.

## In plain English
- **What this is:** A new helper on the Core and model team who owns security — the keys, the signed approvals, and keeping secrets out of the public repo.
- **What it found / what it does:** It guards the owner key ceremony, checks that every signed approval is real, watches the audit log for breaks, and reviews every permission before it goes live. It only writes drafts and security reports; nothing gets changed or granted without Matt's say-so.
- **What it costs or earns:** The draft doesn't say.
- **What Matt needs to decide:** What to name this helper, and whether the role is right.

---

The Information Security Analyst/Engineer is the newest member of the Core and model team. It owns the locks: the owner key that signs approvals, the per-operator keys, the hash-chained audit log, and the line between what is public and what is secret.

It reviews every permission, every token, and every push for what could leak — a dataset, a model weight, a secret — and it says no in writing before anything ships. No owner key exists yet; when the ceremony happens, this helper drafts the procedure and checks each step. A check it can't show doesn't count.

Draft-only, like every operator. It may draft security reviews and procedures to staging; it may not grant, revoke, or change anything. Every decision waits for the owner. It never handles a live secret itself — keys stay in the owner's hands and the secure store.

The name is the owner's call. "Information Security Analyst/Engineer" is the role, not the name.

---
DECISION: Approved — registered as The Seal (draft-only) by owner order Nov 20, 2026 ("I say go").
