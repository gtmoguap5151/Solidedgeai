# Security and legal readiness — Galinyx OS

Status: **experimental, not production-ready**. This is an engineering risk register, not a legal opinion or certification.

## Critical blockers (must close before public multi-user access)
1. **Authentication/authorization:** Entity IDs are caller-supplied. There is no verified user identity, tenant isolation boundary, or secure ownership check. Treat all APIs as trusted-local-only.
2. **Review spoofing:** `creator.review` and `creator.rights` enforce entity capabilities, not an authenticated human reviewer's identity. Approval state is a workflow flag, not legally meaningful human sign-off.
3. **Capability administration:** Entity creator can assign arbitrary capabilities; no role hierarchy or privileged administrative approval.
4. **Data protection:** SQLite records are unencrypted at the application layer, no retention/deletion controls, secrets manager, backup or incident response plan.
5. **Concurrency:** Shared SQLite connection and check-then-insert idempotency are not safe under arbitrary concurrent access. Use transactional locking, unique constraints and tested worker isolation before parallel processing.
6. **Audit integrity:** Events are append-only by convention, not cryptographically tamper-evident or access-controlled.
7. **Resource abuse:** Basic request (64 KiB), story canon (32 KiB), prompt (4,000 characters), memory key (256 characters), and identifier limits are now enforced. Quotas, rate limits, sandboxing, and cost ceilings remain absent.
8. **Provenance:** A `rights_status=cleared` field is not evidence of ownership, licenses, releases, or permission. No documentary chain of title.
9. **AI risk:** Current deterministic outlines are not model-generated. Before integrating models, assess prompt injection, untrusted tool outputs, content moderation, privacy, impersonation, and model provider terms.
10. **Publishing/payments:** No platform integrations, financial transfers or live publishing. Do not enable without verified account ownership, delegated authority, platform API rules, fraud controls and regulatory review.

## Legal workstreams (jurisdiction-specific review required)
- **Brand:** Trademark clearance (similar marks/classes and common-law use), company formation and domain registration. GALINYX is not represented as registered or cleared.
- **IP:** Copyright ownership and licensing for code, models, training inputs, generated outputs, music, voices, likenesses, and character designs. Record third-party license terms; do not assume AI-generated material is automatically copyright-protected.
- **Privacy:** Privacy notices, consent, data minimization, access/deletion, retention, cross-border transfers and children's data restrictions where applicable.
- **Media:** FTC advertising disclosures and endorsements; synthetic media labeling; right of publicity; defamation; platform-specific automation and monetization rules.
- **Commercial:** Consumer protection, subscription/auto-renewal rules, payment processing, taxes, contractor/worker classification where relevant.
- **Open source:** Maintain dependency inventory, attribution, license compliance, vulnerability scanning and software bill of materials when dependencies are added.
- **Accessibility/security:** WCAG-oriented accessibility checks and an independent penetration test before a public launch.

## Release gates
- Unit/integration tests pass in CI with recorded results.
- Security threat model and abuse-case tests reviewed.
- Real user authentication and per-object authorization verified.
- No financial/public actions without auditable authenticated approvals.
- Rights evidence, privacy controls, and platform terms verified.
- Professional legal counsel reviews jurisdiction-specific claims before commercial deployment.
- Publish a clear security disclosure/contact policy and avoid any unsupported certification or compliance claim.

## Responsible communication
Never claim production readiness, legal compliance, trademark clearance, platform approval, security certification, monetization eligibility, or independent audit without documentary proof.
