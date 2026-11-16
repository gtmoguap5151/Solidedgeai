# BLACKPINE FIELD — Revenue Operations Validation Plan

**Owner:** Blackpine Field human owner  
**Governance platform:** GALINYX Governance Core  
**Validation date:** 2026-11-16  
**Status:** Read-only repository integration passed; operating-data baseline still incomplete

## 1. Purpose

Use BLACKPINE FIELD as GALINYX's first real operating environment. The objective is to test whether governed digital operations can help move an existing storefront toward measurable affiliate revenue without weakening evidence standards or allowing unauthorized external actions.

This is a business-operating test, not a sales forecast and not proof that GALINYX can generate revenue.

## 2. Verified integration result

The CI integration read 11 allowlisted files from the BLACKPINE FIELD GitHub repository at tree commit `ca9deb36e957910539af22cc8c83c20c94690bc5`. It verified Git blob integrity and generated content hashes.

The live snapshot reported:

- Deployed storefront responded HTTP 200 at `https://blackpinefield.com/` on 2026-11-16 18:59 UTC.
- Repository source contained 60 product cards; the live storefront also contained 60 product cards. **Inventory count matched.**
- This current live check supersedes the older 2026-11-13 status note that listed 59 products live. The status document itself still needs a routine update.
- Affiliate disclosure present.
- Hands-on-testing disclosure present.
- Research-only labels present across the three guide drafts.
- Published guide companions present.
- Brand guide contains the no-hype / honest-limits rule.
- Three source-reference lists detected.
- No manufacturer-source evidence records detected by this adapter.
- No hands-on possession, test-date, test-condition, or load evidence records detected by this adapter.
- Time-sensitive price language is present in the homepage source and therefore requires fresh retailer evidence before any price claim is approved.

The governance test passed 73/73 unit tests. The live repository integration passed. The revenue-audit planning decision completed a synthetic approval lifecycle, while a revenue-performance claim was blocked for missing analytics, affiliate-click, and commission evidence.

**Synthetic CI identities are test fixtures, not real Blackpine employees, owner approvals, or authenticated users.** The approval result demonstrates engine behavior only.

## 3. What is not yet verified

The live revenue check now makes a read-only GET request to the deployed storefront and compares the live product-card count with the repository snapshot when the site responds. It does not yet perform a full deployed-HTML diff or verify every destination link.

The adapter does not access:

- Website analytics or traffic reports.
- Awin, CJ, Amazon, or other affiliate dashboards.
- Actual outbound clicks, orders, commissions, payout records, or revenue.
- Social-platform reach, link clicks, or attributed visits.

Consequently, the repository snapshot cannot establish current traffic, conversion, affiliate earnings, or profitability. Missing evidence means unknown, not zero.

The Blackpine `STATUS.md` file is maintained separately from this allowlisted snapshot and was last updated 2026-11-13. Any operating assumptions drawn from it must be rechecked before action.

## 4. Revenue baseline required

Use one consistent reporting window and record the source, capture time, timezone, currency, and coverage for each dataset.

| Dataset | Minimum fields | Why it is needed |
|---|---|---|
| Store analytics | Sessions, landing page, source/medium, product-page views, date | Establish whether qualified visitors reach the store |
| Outbound-link analytics | Product/page, destination, outbound clicks, date | Measure whether visitors click through to merchants |
| Affiliate network reports | Network, advertiser, clicks, orders, reversals, commission, date | Verify whether traffic produces attributable earnings |
| Content analytics | Platform, post/video ID, reach/views, profile/link clicks, date | Identify which content contributes visits |
| Store deployment snapshot | Live product count, canonical URL, deployed revision/time | Detect differences between repository source and live store |

Do not combine incompatible date windows or currencies. Do not treat link availability as proof of clicks, and do not treat clicks as proof of commissions.

## 5. Core scorecard

Calculate only when the required numerator and denominator are available:

- **Product-page click-through rate:** outbound affiliate clicks ÷ product-page views.
- **Affiliate conversion rate:** attributed orders ÷ affiliate clicks.
- **Earnings per click (EPC):** commission ÷ affiliate clicks.
- **Commission by product and network:** attributed commission grouped by product and affiliate programme.
- **Content-to-store contribution:** measurable store sessions attributed to each content item or channel.

If a source does not expose a metric, mark it unavailable. Do not estimate it silently.

## 6. Operating sequence

### Gate A — Read-only reconciliation

1. Confirm the canonical live storefront and current deployed state.
2. Compare live product inventory and tracked destinations with the repository source.
3. Obtain current analytics and affiliate-network reports for the same date range.
4. Reconcile discrepancies and document missing coverage.
5. Produce a ranked list of the three largest measurable revenue constraints.

**Acceptance:** A dated baseline with source references, reconciled counts, actual metrics, and explicit unknowns.

### Gate B — Governed opportunity selection

For each proposed action, record:

- The observed problem and evidence.
- Expected mechanism of improvement (not a guaranteed result).
- Effort and reversibility.
- Customer, brand, compliance, and affiliate-program risks.
- The exact approval required.

Prefer fixing measurable friction in the existing funnel before expanding product count or adding new channels.

### Gate C — One controlled operating change

After the baseline is accepted, prepare one low-cost, reversible organic-content or storefront-copy improvement. Keep existing tracked destinations intact. Require human approval before publishing or sending anything externally.

Measure the same metrics before and after the change. If attribution is unavailable, the outcome is inconclusive—not a success claim.

## 7. Authority boundary

The current adapter is read-only. It may inspect approved public repository files, evaluate evidence, draft analyses, and recommend actions.

The following remain outside autonomous authority and require explicit human approval: publishing or materially changing public content, external outreach, accepting affiliate or commercial terms, paid promotion or spending, pricing or customer-policy changes, credentials, payment settings, and legal/tax records.

No physical inventory, shipping, or site visit is assumed.

## 8. Exit criteria for this validation

GALINYX will have demonstrated useful operating value only when it can:

1. Reconcile real operating data without inventing missing values.
2. Identify a specific, evidence-supported revenue bottleneck.
3. Recommend a bounded action with clear trade-offs.
4. Route the action through the correct human authority.
5. Record the approval and the exact evidence reviewed.
6. Measure the outcome against a documented baseline.
7. Preserve a complete audit trail and respect the human approval boundary.

Passing the current CI tests is a prerequisite, not completion of this real-world business test.


## 4A. Measurement CSV intake implemented

A strict, read-only intake module now accepts externally exported CSV files for three evidence types:

- `analytics-report`: `date,sessions,landing_page,source_medium,product_page_views`
- `affiliate-click-report`: `date,product,destination,outbound_clicks`
- `commission-report`: `date,network,advertiser,clicks,orders,reversals,commission,currency`

Each intake requires source identity, an HTTPS evidence reference, reporting-period start/end, timezone, ISO currency code, capture timestamp, and verifier identity. It validates required columns, row widths, dates within the declared period, nonnegative numeric values, and currency consistency. It computes a SHA-256 hash of the original CSV bytes and returns normalized rows, totals, and a provenance record.

The intake does **not** fetch files, connect to GA4/Awin/CJ/Amazon, authenticate users, or prove that a supplied export is truthful. A human must obtain and review each export, preserve its original source, and supply accurate metadata. The hash proves file integrity after intake, not the truth of the underlying report. The first version intentionally requires canonical column names; source-specific export mappings are a later adapter task.

Seven dedicated tests cover normalization, quoted CSV fields, missing columns, currency mismatch, reporting-window violations, malformed/negative metrics, and HTTPS evidence references. These tests run with the existing governance suite.
