DRAFT — NOT PUBLISHED. Staging only.
Status: approved by the owner 2026-11-20 ~01:20 ET (audit seq 85) — registered as The Forge (draft-only)
Written by: Governance Core — new-operator announcement, ordered by the owner
Date: Nov 20, 2026
Status: in staging
Type: Announcement of a new operator role in the GALINYX Workforce environment. Working title only — the owner names this worker.

## In plain English
- **What this is:** A new helper on the Core and model team who trains the brain — takes the Galileo dataset and turns it into a working GALINYX model.
- **What it found / what it does:** It runs the fine-tuning: picks the training setup, runs it, tests whether the trained model actually answers like Galileo and follows the Core rules, and hands the finished adapter to the Core for approval. It only writes drafts and test reports; nothing gets trained onto the live system without Matt's say-so.
- **What it costs or earns:** The draft doesn't say. Training runs are priced before they start — the Mistral route is $0, the Qwen route is about $3 a run — and nothing spends without Matt's word.
- **What Matt needs to decide:** What to name this helper, and whether the role is right.

---

The AI/Machine Learning Engineer is the newest member of the Core and model team. It owns the training: the Galileo dataset goes in, a tested GALINYX model comes out.

It knows the two routes — Mistral-7B on free Colab/Kaggle with Cloudflare BYO LoRA, or Qwen3-8B on Fireworks — and it runs whichever one the owner picks, then proves the result with real test questions before anyone calls it done. A trained adapter that can't hold Galileo's voice, or that breaks a Core rule, never reaches the live system.

Draft-only, like every operator. It may draft training plans and test reports to staging; it may not train, deploy, or spend anything. Every run waits for the owner's approval. It never touches the trade-secret dataset outside the approved path, and it never puts dataset or weights in the public repo.

The name is the owner's call. "AI/Machine Learning Engineer" is the role, not the name.

---
DECISION: Approved — registered as The Forge (draft-only) by owner order Nov 20, 2026 ("I say go").
