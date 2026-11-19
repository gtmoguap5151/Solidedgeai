APPROVED by the owner 2026-11-19 ~17:57 ET (audit seq 74) — via the app's Approve button.

Written by: Blackpine Operator (blackpine-operator, draft-only)
Date: Nov 19, 2026
Status: approved by the owner 2026-11-19 ~17:57 ET (audit seq 74)
Assignment: store-improvement drafts (ordered Nov 19 ~08:37 ET). Matt's words: my job is not only to make money but to make the store better.

## In plain English
- **What this is:** Seven plans to fix the store before Black Friday, from the Blackpine worker.
- **What it found / what it does:** The store has 94 products and about 90 visitors a day, but only 12 clicks ever and $0 in sales. The plans add a Black Friday deals shelf, give Matt's own 26 products their own home, fix the wording on the cards, add an honest trust strip, re-check all 94 prices and links, send one email to the checklist list, and post three times on social media.
- **What it costs or earns:** Nothing to spend — every plan costs $0, and the store has earned $0.00 so far.
- **What Matt needs to decide:** Say yes or no to each of the seven plans, starting with the price-and-link check and the Black Friday deals shelf.

## Where the store stands (honest numbers, Nov 19, 2026)

- 94 products, 11 departments. 68 affiliate + 26 Matt-owned (10 Tailor tees + 16-piece line: mugs, hoodies, caps, long sleeves, crewnecks — each with its own Stripe payment link, printed/ordered only when someone buys).
- Revenue ever: **$0.00**. Affiliate clicks ever: **12** (CJ 4, Awin 8), 0 sales.
- Store traffic was 86–99 visitors/day on Nov 14 (Cloudflare). Web Analytics is OFF (Matt's decision), so we cannot see what visitors do once they land.
- Black Friday is Nov 27 — 8 days away. Amazon deal week runs Nov 19–30. The Black Friday research file holds 110 verified deals, 62 earnable now through live affiliates.
- Six new affiliate brands went live as cards today (Xtratuf, Durango, Char-Broil, Muck, OpticsPlanet/Vortex, SilverAnt). Pyramyd Air is still pending (needs Matt's traffic figure — not my call).

The problem in one line: traffic exists (~90/day), clicks barely exist (12 ever), sales don't exist. Every draft below attacks one of those three gaps. No invented projections — the store has never sold anything, so nothing here promises it will.

---

## Draft 1 — Black Friday deals shelf (top of the store, this week)

**What:** A "Black Friday Deals" department at the top of the homepage, built from the 10 strongest earnable deals already researched (Anker SOLIX S2000 $699.99, EcoFlow DELTA 3 Max $878.99, Leatherman FREE K4X $49.98, TideWe AquaWade waders $189.99, Kings Camo KC Ultra 40% off + BOGO flannels, Marmot PreCip Evo $101, Leatherman Wave Plus $103.95, YETI Roadie 48 $340, ALLPOWERS P1800 $399, Piscifun AlinoX 400 $149.99). Every price re-verified on the merchant page the day it goes live — prices change fast in deal week, and the research file warns against publishing unverified prices. Two deals have hard expiry dates shoppers should know: Kings Camo's sale ends Nov 25, Marmot's 25% off ends Nov 23.

**Why:** 62 earnable deals are sitting in a file nobody can see. The store's only problem bigger than traffic is that the visitors who do arrive (~90/day) have almost nothing time-sensitive to act on — 12 clicks ever says so. Black Friday is the one week of the year when shoppers arrive ready to buy. The shelf turns existing research into the store's first real conversion attempt.

**What it takes:** Re-verify all 10 prices on the merchant pages; build 10 cards in house style with tracked links (Amazon tag blackpinefield-20, Awin, CJ as already live); one GitHub push to main (Pages auto-deploys). No new affiliate applications, no money spent.

**Matt would need to approve:** The shelf itself and the 10 picks (or a different 10 from the 62). He would also need to accept the expiry risk: any price that moves between verification and publish is wrong on the shelf until someone re-checks it.

## Draft 2 — Give the 26 owned products a real home on the store

**What:** A dedicated "Blackpine" department for Matt's own products — the 10 Tailor tees and the 16-piece line — grouped together with a clear name, instead of sitting mixed into the affiliate shelves. Each keeps its own Stripe payment link. Short plain copy: what it is, what it costs, printed to order when you buy.

**Why:** The owned line is the only part of the store where a sale pays Matt the full margin instead of a 3–15% affiliate cut — and it is the only part that is actually his brand. Right now it is buried among 68 affiliate cards. A shopper who wants to support Blackpine can't tell what is Blackpine's and what is someone else's. The affiliate shelves earn us $0 so far; the owned line is the highest-value sale on the site and the hardest to find.

**What it takes:** Rearrange existing cards into one department in site/index.html; write ~6 lines of plain copy; one deploy via GitHub push. No new products, no new links, no money spent.

**Matt would need to approve:** The department name and the copy, and whether the owned line sits at the top of the store or after the affiliate shelves.

## Draft 3 — Fix the click gap: make "Check Price" earn its click

**What:** On the store's highest-commission cards, add one honest line under the price that tells the shopper why this card is worth clicking: the deal, the discount, or the comparison. Examples from real numbers already on file: ALLPOWERS S2000 Pro ($664 sale vs $1,399 regular), MeoWant SC09 (~$78/sale at 12% — biggest per-sale number on the store, and its Black Friday price drops to $289.99 with code BC350 Nov 27–Dec 2), TideWe heated gear (10% tracked, duck season live). Start with the top 6–8 earning cards, not all 94.

**Why:** 12 clicks ever against ~90 visitors a day means visitors are browsing and leaving without clicking anything. The cards read like a catalog — specs, no reason to act now. We cannot see click-through per card (Web Analytics is off), so the honest move is to strengthen the cards that pay the most when they do convert, rather than guess at the whole shelf.

**What it takes:** Draft one line per card (6–8 cards), verify every price/discount claim against the live merchant page, edit site/index.html, one deploy. No new links, no money spent.

**Matt would need to approve:** The exact wording on each card — especially any discount claim, since a wrong price is a trust problem, not just a typo.

## Draft 4 — A plain-words trust strip: shipping, returns, and who we are

**What:** A short, honest band on the homepage (near the top, under the sign) answering the three questions a first-time buyer asks before trusting a new store: (1) who runs it — Matt Johnson, Harlan County, KY, already on info.html; (2) how buying works — affiliate cards take you to the merchant's site to check out; Blackpine-owned items are printed to order and ship from the printer; (3) returns — affiliate returns follow the merchant's policy; owned items follow the printer's policy (state it plainly once confirmed, don't guess). No fake guarantees, no invented policies.

**Why:** Zero sales from ~90 visitors a day is partly a traffic problem and partly a trust problem. A new store with no reviews, no visible owner, and no shipping or returns information asks a stranger to hand money to a stranger. The info.html page already has the owner story and the FTC disclosure — it just isn't where the shopper is. This draft puts the honest version of it on the homepage.

**What it takes:** Confirm the owned-line return/shipping terms from the printer (Printify) before writing anything — do not publish a policy we haven't verified. Then ~10 lines of copy, one edit, one deploy. No money spent.

**Matt would need to approve:** The exact copy, and the returns wording for owned items (his call on what we promise).

## Draft 5 — Re-verify the whole shelf before Black Friday week traffic lands

**What:** A full link-and-price audit of all 94 cards before Nov 27: every "Check Price" button clicked and confirmed it lands on the right product page with tracking intact; every price re-checked against the merchant. Known weak spots to hit first: the Kings Camo Pinnacle card (its CJ destination 404'd once before when Kings changed the slug), the MeoWant SC09 card (the og:image promo graphic showed a $299 price that contradicted the verified $649.99 — the image was not used, but the card price needs re-checking against the live Black Friday price), and any Amazon card whose price has moved since it was built.

**Why:** The store's first real traffic spike of the year is 8 days away. A dead link or a wrong price on Black Friday week doesn't just lose one sale — it tells the shopper the store isn't maintained, and they don't come back. We have already had one dead-destination card (Pinnacle) and one contradictory price (SC09). An audit now is cheap; discovering a dead link from a customer is not.

**What it takes:** Systematic click-through of 94 buttons + price re-checks; a written list of what broke and what got fixed. No new content, no money spent. This is labor, not spend.

**Matt would need to approve:** Any price changes found (he approves the corrected numbers before they go live), and any card that has to be pulled because its product is gone or its link is unfixable.

## Draft 6 — One email-capture follow-up: the checklist list is the only audience we own

**What:** The deer-season checklist lead magnet (live since Oct 30, FormSubmit to gtmoguap5151@gmail.com) is the store's only email list. Draft a single Black Friday email to that list — short, plain, no hype: the Black Friday deals shelf is live, here are the 3–4 strongest deals with real prices, here's the owned Blackpine line. One email, sent once, Nov 25 or 26.

**Why:** Every other channel (reels, posts, search) is rented — the algorithm decides who sees it. The email list is the only audience the store owns outright, and it has never been emailed. The list is small (we don't know the count — FormSubmit holds signups and needs one activation click before any arrive, so the first step is confirming the list exists at all). Even a handful of real shoppers who already asked for something from us are worth more than another reel to strangers.

**What it takes:** Confirm the FormSubmit activation is done and the signup list is accessible; draft the email; send once from Matt's Gmail. No money spent.

**Matt would need to approve:** The exact email copy, the send date, and confirmation that the list is real (he is the one who can check the Gmail/FormSubmit side).

## Draft 7 — Black Friday week social: three posts, one per phase, tied to the shelf

**What:** Three short posts (Facebook profile + Instagram, the channels that already carry the store), each pointing at the Black Friday deals shelf: (1) Nov 20 — "Black Friday week is here, the deals shelf is live" with the 3 strongest deals; (2) Nov 25 — "last day for Kings Camo's sale" (real expiry, not manufactured urgency); (3) Nov 27 — Black Friday itself, the owned Blackpine line + the deepest deal. Exact copy drafted for Matt's verdict before anything posts.

**Why:** The store has published dozens of reels to four channels and still has 12 clicks ever. More volume of the same won't fix it. Three posts tied to a real, time-limited shelf — with real prices and real expiry dates — is a test of whether the problem is the offer (nothing urgent to click) rather than the audience. If three focused posts still produce no clicks, that tells us something honest too.

**What it takes:** Draft three captions + pick the deal for each; build or reuse visuals; publish on Matt's approval. No money spent, no ads.

**Matt would need to approve:** Exact copy for each post and the publish dates. Nothing posts without his word.

---

## What I am NOT proposing

- No paid ads, no boosted posts, no spend of any kind — the store has $0 revenue and no evidence ads would convert.
- No new affiliate applications — 12 Awin + ~20 CJ applications are already pending; more applications don't fix a click problem.
- No price or discount claims I haven't re-verified — every number in this draft comes from STATUS.md or the Nov 17 deals research file, and the deals file itself warns prices move fast.
- No Pyramyd Air reply — that needs Matt's traffic figure and is his call.

## Order of work if Matt approves

1. Draft 5 (audit) + Draft 1 (deals shelf) — both before Nov 27, the audit first so the shelf launches clean.
2. Draft 2 (owned line home) + Draft 3 (click lines) — same deploy window as the shelf if time allows.
3. Draft 4 (trust strip) — needs the printer's returns terms confirmed first.
4. Draft 6 (email) + Draft 7 (social) — Nov 20–27, tied to the shelf.

Nothing in this draft is published, listed, changed on the live site, sent, contacted, or spent. Staging only, awaiting Matt's verdict.
