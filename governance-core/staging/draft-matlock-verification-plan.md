DRAFT — NOT PUBLISHED. Staging only.

Written by: Matlock (matlock-operator, verifier, draft-only)
Date: Nov 19, 2026
Assignment: Tampa/Orlando verification plan + D-001 open items
Owner: Matt Johnson

## In plain English
- **What this is:** Matlock's step-by-step plan for checking six more house leads (three in Tampa, three in Orlando) against county records, plus the three open questions on the first deal.
- **What it found / what it does:** Nothing is checked yet — this is the plan for the check, not the results. For each lead it lists which county offices to read and what to confirm, and it flags one trap: 430 Bonifay Ave is a different house from the lead at 474 Bonifay Ave.
- **What it costs or earns:** The fee target is about $10,000 per deal if one closes, but the checking itself costs nothing.
- **What Matt needs to decide:** Say yes or no to running the county-record checks on the six leads and the three open questions on D-001.

---

## Scope and method

PLAN ONLY. This draft is the exact checklist the live checker follows. No live browser work was done to produce it. Every address, parcel number, Zestimate, and lis pendens date below comes from the tracker (`~/workspace/goals/reverse-wholesaling/system/deal-pipeline.md`, as read Nov 19, 2026). Nothing else is asserted as fact. Anything not in the tracker is marked **TO BE CHECKED**.

Background (from the tracker): the Nov 18 Duval Clerk check verified 9 Jacksonville properties in the live browser, but the Tampa/Orlando check failed only because the browser task was given street names without house numbers. The tracker HAS the full addresses. This plan re-runs that check with them.

Standing rules that govern the live check:
- Written records only — no owner, agent, buyer, or title-company contact during verification.
- Do not share any property address with a buyer until POF + assignment acceptance are confirmed (buyer-first rule; market the assignment, never the house — Fla. Stat. §475.42).
- A property is **Verified** only when the Property Appraiser record confirms identity, owner, value, building, and sales history. A **deal** is verified only when the Clerk check confirms lis pendens/case/mortgage/liens AND the owner agrees a price AND a contract is signed. No deal in the tracker is deal-verified yet.
- 2026 tax paid-vs-delinquent status is unverified for ALL properties in the tracker — the Tax Collector portal was blocked Nov 18. Tax status is a required check on every lead below, not an optional one.

---

## Part 1 — Tampa leads (Hillsborough County)

County for all three: **Hillsborough**. Prior block: Hillsborough PA portal blocked (HTTP 403 / timeout) on Nov 18 — the live browser is the route.

Portals to check for each Tampa lead, in this order:
1. **Hillsborough County Property Appraiser** (parcel search by the PIN below) — owner of record, assessed/market value, building details, sales history, homestead status.
2. **Hillsborough Clerk of the Circuit Court — Official Records** — deed of record, mortgage(s) recorded, lis pendens (confirm it exists + record its filing date and any case number it cites), judgments/liens of record.
3. **Hillsborough Clerk — case search** (court records) — foreclosure case number, case status, any hearing/trial/sale dates, any bankruptcy filing or stay, any judgment entered.
4. **Hillsborough County Tax Collector** — 2026 tax paid vs. delinquent; any delinquent-tax certificate.
5. **Listing status** — MLS/Zillow/Redfin: listed, under contract, pending, or off-market. Record MLS number if listed/under contract.

Confirm for each lead: (a) owner of record matches the PA record and the deed; (b) lis pendens exists in Official Records and the case number it cites; (c) every mortgage of record with amount, lender, and recording date; (d) any judgments/liens of record with amounts and dates; (e) 2026 tax status; (f) listing status; (g) whether the numbers leave a wholesale spread after mortgage payoff + the ~$10,000 target assignment fee.

### D-013 — 8108 Fir Dr, Tampa 33619

- **Parcel (PIN):** U0130191QP000028000100
- **Zestimate (secondary, Zillow):** $342,900
- **Lis pendens (secondary, Zillow):** 5/28/2026
- **Tracker note:** Equity flag — PropertyReach estimates −$30,767. **The payoff check decides this one.** If recorded mortgage debt exceeds value, it is dead on the numbers; record the exact payoff-relevant mortgage figures, not just the total.
- **TO BE CHECKED:** owner of record; lis pendens confirmation + case number; mortgage amounts/lenders; judgments/liens; 2026 tax status; listing status; payoff vs. value.

### D-014 — 15429 Brushwood Dr, Tampa 33624

- **Parcel (PIN):** U3227180Q9000007000180
- **Zestimate (secondary, Zillow):** $464,600
- **Lis pendens (secondary, Zillow):** 3/11/2026
- **Tracker note:** Highest Tampa value; solar + new roof; Carrollwood. Record whether the solar is owned or leased (a leased system is a lien/encumbrance question — check Official Records for any solar UCC/lien filing) and whether the roof work shows any recorded lien.
- **TO BE CHECKED:** owner of record; lis pendens confirmation + case number; mortgage amounts/lenders; judgments/liens (including any solar-related filing); 2026 tax status; listing status; payoff vs. value.

### D-015 — 8208 N 12th St, Tampa 33604

- **Parcel (PIN):** A30281945M000034000160
- **Zestimate (secondary, Zillow):** $219,000
- **Lis pendens (secondary, Zillow):** 3/30/2026
- **Tracker note:** Lowest entry of the six; 1920 cottage, Sulphur Springs. Age of the building makes the PA building record and any code-lien record worth checking closely.
- **TO BE CHECKED:** owner of record; lis pendens confirmation + case number; mortgage amounts/lenders; judgments/liens (including any municipal/code liens); 2026 tax status; listing status; payoff vs. value.

---

## Part 2 — Orlando leads (Orange County)

County for all three: **Orange**. Prior block: Orange PA portal is a JS app — "Loading…" only on Nov 18 — the live browser is the route.

Portals to check for each Orlando lead, in this order:
1. **Orange County Property Appraiser** (parcel search by the parcel number below) — owner of record, assessed/market value, building details, sales history, homestead status.
2. **Orange County Clerk of Courts — Official Records** — deed of record, mortgage(s) recorded, lis pendens (confirm it exists + record its filing date and any case number it cites), judgments/liens of record.
3. **Orange County Clerk — case search** (court records) — foreclosure case number, case status, any hearing/trial/sale dates, any bankruptcy filing or stay, any judgment entered.
4. **Orange County Tax Collector** — 2026 tax paid vs. delinquent; any delinquent-tax certificate.
5. **Listing status** — MLS/Zillow/Redfin: listed, under contract, pending, or off-market. Record MLS number if listed/under contract.

Confirm for each lead: (a) owner of record matches the PA record and the deed; (b) lis pendens exists in Official Records and the case number it cites; (c) every mortgage of record with amount, lender, and recording date; (d) any judgments/liens of record with amounts and dates; (e) 2026 tax status; (f) listing status; (g) whether the numbers leave a wholesale spread after mortgage payoff + the ~$10,000 target assignment fee.

### D-016 — 2008 Leisure Dr, Orlando 32808

- **Parcel:** 282213757003100
- **Zestimate (secondary, Zillow):** $271,000
- **Lis pendens (secondary, Zillow):** 4/7/2026
- **Tracker note:** Lowest Orlando entry; no HOA.
- **TO BE CHECKED:** owner of record; lis pendens confirmation + case number; mortgage amounts/lenders; judgments/liens; 2026 tax status; listing status; payoff vs. value.

### D-017 — 1211 Carey Glen Cir, Orlando 32824

- **Parcel:** 302430351000180
- **Zestimate (secondary, Zillow):** $351,600
- **Lis pendens (secondary, Zillow):** 9/15/2026
- **Tracker note:** Pool; HOA $68/mo. Check Official Records for any HOA lien — an HOA lien is a payoff item that changes the spread.
- **TO BE CHECKED:** owner of record; lis pendens confirmation + case number; mortgage amounts/lenders; judgments/liens (including any HOA lien); 2026 tax status; listing status; payoff vs. value.

### D-018 — 474 Bonifay Ave, Orlando 32825

- **Parcel:** 312231198602310
- **Zestimate (secondary, Zillow):** $452,800
- **Lis pendens (secondary, Zillow):** 9/29/2026
- **Tracker note:** Freshest of the six; payoff check critical at this price.
- **WARNING (from the tracker):** 430 Bonifay Ave surfaced in search but does NOT match D-018 — different property, lis pendens 09/01/21, not 9/29/2026. The checker must confirm the house number is **474** on every record pulled, and must not record anything from 430 Bonifay Ave against D-018.
- **TO BE CHECKED:** owner of record; lis pendens confirmation + case number; mortgage amounts/lenders; judgments/liens; 2026 tax status; listing status; payoff vs. value.

---

## Part 3 — D-001 open items re-confirmed

**D-001 — 6718 Cavalier Rd, Jacksonville 32208** · Parcel (RE) 025525-0000 · Stage: Verified (property) — best first deal, workable. No deal in the tracker is deal-verified yet, including D-001.

What the tracker already confirms (Clerk check Nov 18, 23:09–23:38 ET, live browser):
- Owner of record: **Shaun T. McNeil** (confirmed).
- Deed: last sale **$121,500, Jan 23, 2020**.
- Lis pendens **confirmed** — filed 8/27/2026; foreclosure case **16-2026-CA-006007**.
- Mortgage: **$119,298** + **$5,205.97 HUD mortgage** (second lien).
- PA assessed value: **$117,756**. Zestimate (secondary): **$165,400**.
- **NOT listed.** No sale date, no judgment entered.

### Open item 1 — Satisfaction of old judgments of record against McNeil (UNVERIFIED)

- The judgments in question: **2006 Asset Acceptance**, **2008 Royal American Management**, **2012 Lovell**. All three are unverified — it is not established whether any of them is satisfied, still open, or even still of record against McNeil.
- **What closes it:** a Duval Clerk Official Records search under the owner name (Shaun T. McNeil) returning, for each judgment: whether it is of record, the amount, and whether a satisfaction/release is recorded. If a satisfaction is recorded, note its recording date and instrument number. If a judgment is still open, record the amount — it is a payoff item that changes the spread.
- **Also check:** whether any other judgment or lien of record against McNeil exists beyond these three (do not stop at the three named items).

### Open item 2 — HUD lien satisfaction (UNVERIFIED)

- The **$5,205.97 HUD mortgage** is confirmed of record. What is NOT confirmed is whether it has been satisfied or remains an open payoff item.
- **What closes it:** a Duval Clerk Official Records search for a satisfaction/release of the HUD mortgage. If satisfied, note the recording date and instrument number. If open, the $5,205.97 stands as a payoff item in the deal math.

### Open item 3 — 2026 tax paid-vs-delinquent status (UNVERIFIED)

- **Status:** unverified. On Nov 18 the City Fees, Property Appraiser, and Tax Collector portals all connection-reset in the browser, so no tax figure was obtained.
- **What closes it:** a successful read of the Duval Tax Collector record (or the City Fees portal) for parcel 025525-0000 showing 2026 taxes paid or delinquent, the amount, and whether any tax certificate has issued. Until that read succeeds, the tax position is unknown and must not be assumed either way in the deal math.

### Other D-001 items still open (from the tracker, unchanged)

- **Owner contact + price:** McNeil has not been contacted and no price has been agreed. (Owner contact is a later step, not part of this verification check.)
- **Repair scope:** unknown — no walkthrough or repair list on file.
- **Earnest money:** source still open (see open-questions.md in the reverse-wholesaling system folder).

---

## What the checker records when the live run is done

For each of D-013–D-018, the checker returns to the tracker:
1. Owner of record (PA + deed) — or "owner unidentified" with the reason.
2. Lis pendens confirmed or not, with filing date and case number.
3. Every mortgage of record: amount, lender, recording date.
4. Every judgment/lien of record: type, amount, date, satisfied or open.
5. 2026 tax status: paid or delinquent, amount, certificate status.
6. Listing status: off-market, listed, or under contract (with MLS number if any).
7. Verdict per lead: promote to Verified, keep as Lead (state what is still missing), or move to Dead (state the reason).
8. For D-001: the three open items above, each closed with a recorded instrument or still open with the reason the check could not close it.

No figures beyond the tracker are asserted in this plan. Every case number, amount, and date not listed here is TO BE CHECKED at the live source.

— End of draft —
