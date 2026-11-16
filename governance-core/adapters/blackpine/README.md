# Blackpine Field validation adapter — read-only boundary

This adapter is a policy profile for evaluating proposed Blackpine Field decisions.
It is not connected to the live storefront, Cloudflare, affiliate networks, social
accounts, financial accounts, or the Blackpine repository's write path.

## Why Blackpine is a useful test environment

The repository describes a real digital storefront with product specifications,
affiliate relationships, published editorial content, tracked links, and a
production deployment process. Its public-facing rules explicitly distinguish
manufacturer specifications from hands-on testing and require clear affiliate
disclosure. Those are concrete governance controls with observable evidence.

## Decision classes in this profile

| Decision class | Submit permission | Approval permission | Minimum level |
|---|---|---|---:|
| Editorial draft | `blackpine:content:submit` | `blackpine:content:approve` | 2 |
| Product claim / specification | `blackpine:claim:submit` | `blackpine:claim:verify` | 3 |
| Affiliate relationship | `blackpine:affiliate:propose` | `blackpine:owner:approve` | 4 |
| Production publish | `blackpine:publish:request` | `blackpine:owner:approve` | 4 |
| Financial account change | `blackpine:finance:request` | `blackpine:owner:approve` | 4 |

These levels are provisional test thresholds, not claims about existing Blackpine
job titles or authority. The business owner remains the ultimate human authority.

## Rank versus level — current working definition

- **Rank / office** answers: *What organizational office does this person hold?*
  Examples might include Owner, Secretary, Editor, or Treasurer.
- **Level** answers: *What complexity, risk, or evidence standard has this person
  been authorized and qualified to handle?*
- **Permission** answers: *Which exact operation may this person request or approve?*

Rank alone grants no permission. Level alone grants no permission. Permission
must be explicit and bounded by the policy. This is the key test of whether rank
and level are genuinely separate dimensions rather than duplicate ladders.

## Blackpine-specific safeguards to test

1. No hands-on testing claim without evidence of actual product possession,
   dates, conditions, and load.
2. Manufacturer claims must be labeled as manufacturer claims, not represented
   as independently verified test results.
3. Affiliate relationships and tracked links must be disclosed; compensation
   must not alter editorial verdicts.
4. Never retarget one advertiser's link to a different product or merchant.
5. No public content or production deployment is executed by this adapter.
6. No financial, tax, payout, credential, or account-setting change is executed
   by this adapter.
7. If required evidence, identity, authority, or approval is missing, the
   proposed decision remains blocked or pending.

## Integration boundary

The next stage is a read-only import of selected, non-secret repository metadata
and test fixtures. The adapter must never write to the production store. A later
write-capable integration would require a separate, explicitly approved design,
a staged deployment target, authenticated identity, durable audit storage, and
rollback controls.


## Repository reader

`repository-reader.mjs` reads a fixed allowlist from the public GitHub repository
using GET requests only. It verifies each downloaded file against the Git blob SHA
reported by the repository tree, calculates a SHA-256 content digest, and returns
a metadata snapshot plus evidence references. Raw file contents are not included
in the returned snapshot.

The reader intentionally does not fetch the operational status file, affiliate
application packet, private account data, or XABO working files. It does not write
to GitHub or the storefront.

## Evidence interpretation

- A source-reference-list record proves that a source section exists in a versioned
  repository file; it does not independently verify the source or the claim.
- A specification-record proves that a specification comparison document exists
  at a particular repository revision; it does not prove the manufacturer figure.
- The current reader does not manufacture manufacturer-source, possession, test-date,
  test-condition, or load evidence.
- Therefore a research draft may pass the editorial evidence gate while a product
  claim requiring manufacturer-source evidence remains blocked. A hands-on claim
  remains blocked until actual test evidence is attached.


## Live read-only check

Run from the repository root with Node.js 20 or later:

```sh
node governance-core/adapters/blackpine/check-live.mjs
```

The command reads the current public `main` revision, verifies Git blob hashes,
and prints only file metadata, control observations, and evidence references.
The pull-request workflow runs this check after the unit tests. It has no write
permissions and does not modify either repository.


## Competency domains

Blackpine policies deliberately use separate level domains:
- Editorial drafts: `editorial`
- Product claims: `product-evidence`
- Affiliate relationships: `commercial`
- Production publication: `release-management`
- Financial account changes: `financial-controls`

A person's level in one domain does not qualify them in another. Rank remains
organizational office metadata; explicit permissions remain action-specific.


The live CI check also runs a complete in-memory decision lifecycle against the
snapshot: an editorial draft with sufficient evidence is submitted and approved
by a distinct synthetic human principal; a product claim lacking manufacturer
source evidence remains blocked and cannot be approved. The test ledger is
verified afterward. These synthetic principals are test fixtures, not real
Blackpine identities or approvals.


## Verified identity and competency requirements

All Blackpine policies require a verified human principal resolved through the
GALINYX AuthorityRegistry. The registry supplies live permission grants and
domain competency credentials; decisions and approvals re-check those records
at the time of action. Revoked or expired requester permissions/competencies
block a pending decision.

The registry is in-memory for this validation. The CI identity assertions are
synthetic fixtures and are not real authentication. Production use requires a
trusted identity provider and durable, protected authority records.

## Evidence review and freshness

Blackpine editorial, product, affiliate, publishing, and financial policies
require the approver to acknowledge the exact evidence digest attached to the
decision. The price-claim policy additionally requires a retailer price check
observed within 24 hours and a future expiry timestamp. Evidence that becomes
stale or expires while awaiting approval blocks the decision.


## Evidence provenance checks

Policies can require HTTPS references, a SHA-256 content hash, a verifier
identifier, and a verification timestamp. The repository reader attaches the
Git blob hash, locally computed content hash, adapter identifier, and capture
time to each repository-derived evidence record. Price claims additionally
require a retailer observation timestamp and a future expiry.

These fields establish traceability and snapshot integrity, not truth. A
`verifiedBy` string is not a digital signature, and a hash proves which bytes
were reviewed—not that a manufacturer claim is accurate. Production requires
authenticated verifier identities, signed attestations where appropriate, and
independent source validation.
