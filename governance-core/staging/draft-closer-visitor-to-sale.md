DRAFT — NOT PUBLISHED. Staging only.

Written by: The Closer (closer-operator, draft-only)
Date: Nov 19, 2026
Assignment: visitor-to-sale fix

## In plain English
- **What this is:** The Closer's plan to turn store visitors into buyers.
- **What it found / what it does:** The store gets about 99 visitors a day but has only 12 clicks ever and $0 in sales. The big problems: Matt's own products are buried at the bottom, the first product a visitor sees is a $649.99 litter box, the buttons say "Check price", the shirts lead with "All sales are final. No refunds.", and 52 of 68 partner links land on search pages instead of the product.
- **What it costs or earns:** Nothing to spend — the first seven fixes are wording and shelf order only, and the store has earned $0.00 so far.
- **What Matt needs to decide:** Say yes or no to the 14 fixes, starting with the wording and the order of the shelves.

# The Visitor-to-Sale Fix — blackpinefield.com

## The problem, stated plainly

The store gets visitors and sells nothing. Cloudflare showed 99 visitors in the last 24 hours on Nov 14, 2026 — the last traffic figure on record. Web Analytics is OFF (Matt's decision), so there is no newer visitor number and I am not inventing one. What the affiliate dashboards do show, live-checked Nov 14 evening and again Nov 17: **12 clicks ever, 0 sales, $0.00** — Awin 8 clicks (Piscifun 3, ALLPOWERS 2, TideWe 2, MeoWant 1, WILDGUARDER 0), CJ 4 clicks (Kings Camo 3, Marmot 1). No clicks on either network since Nov 15 (Awin) / Nov 12 (CJ). Traffic is not the problem. The traffic walks out empty-handed, and nobody owns the path between the visit and the buy. That path is mine now. This draft is the fix.

The store as it stands today (verified against the live homepage by curl, Nov 19): **94 products, 11 departments** — 68 affiliate + 26 Matt-owned. Department order and card counts, top to bottom: Power 6, Water 5, Carry 5, Camp & Sleep 7, Survival 5, Fun Buys 6, Fish 1, Hunt 24, Holiday Gift Picks 9, BLACKPINE Tees 10, BLACKPINE Gear 16, then 4 Field Guides. Above all of it: a Black Friday band, a hero, a firearm-course band, a Black Friday door-buster strip, and a featured MeoWant SC09 card.

---

## 1. What is being ignored, and why

These are judgments from the layout, not from analytics — there are no analytics. Each one is a structural reason a visitor never reaches the buy.

**The BLACKPINE label is buried at the bottom.** Tees (Dept 10) and Gear (Dept 11) are the only products Matt owns outright — the only ones where a sale is real money, not a 3–15% commission. They sit below nine affiliate departments. A visitor has to scroll past 68 affiliate cards to reach the first BLACKPINE tee. The money shelf is the last shelf. That is backwards.

**Hunt is eight departments down.** The reels, the countdowns, the deer-season guide, the checklist — nearly all of the store's traffic drivers are deer-season content. A visitor who arrives because Kentucky gun season opened has to scroll past Power, Water, Carry, Camp & Sleep, Survival, Fun Buys, and Fish before reaching the Hunt shelf. Every department they pass is a chance to leave. Hunt should be the first shelf a November visitor sees, not the eighth.

**The first product on the page is a $649.99 litter box.** The featured MeoWant SC09 card sits above every department. It is the biggest per-sale commission on the store (≈$78–$97.50 at 12–15%), which is why it got the spot — but it is the highest-ticket, lowest-impulse item on the site, off-brand for an outdoors store, and the first thing a hunter or camper sees. A $650 cat box as the store's front window tells an outdoors visitor this store is not for them. It has 1 click ever (Awin, Nov 14 check). The featured slot should sell the store, not the commission.

**Fish is a department of one.** One card (Piscifun AlinoX 300, ≈$11/sale) gets its own department, its own heading, its own scroll row, seven departments down. A one-card department reads as an empty shelf. It should be folded into Hunt or Fun Buys, or given company.

**Horizontal scroll-snap shelves hide most of the store.** Every department is a sideways-scrolling row. On a phone — where most of this traffic arrives, from reels — roughly two cards are visible per shelf before the visitor has to swipe. Hunt has 24 cards; 22 of them are behind swipes. Holiday has 9; 7 are behind swipes. A visitor who does not swipe sees about 20 cards out of 94. The shelves look full to us because we built them; to a visitor they look like two cards and a hint of a third.

**The deer-season playbook is invisible.** `deer-playbook.html` exists — $19, with a $59 course bundle — and it is linked from nowhere on the homepage. Zero links. A finished owned product that no homepage visitor can find. The firearm course at least has a nav link and a green band; the playbook has nothing.

**The email capture is at the bottom, after the Guides.** The only way to keep a visitor who does not buy today is the free deer-season checklist band — and it sits below all 11 departments and all 4 guides, next to the footer. A visitor who leaves after two shelves never sees it. There is no capture anywhere near the top of the page. (Also unverified: FormSubmit holds signups until a one-time activation email is clicked. Whether that activation was ever completed is not on record — if it was not, every signup so far went nowhere. That needs checking before any capture fix matters.)

**Stale numbers undermine trust.** The hero note still says "Eighty-eight products" while the caption below it says 94. The Hunt band still says "eighteen deer-season picks" while Hunt now holds 24 cards. The checklist band still says "the six Hunt shelf picks." A visitor who counts — and hunters count — catches the store contradicting itself on its own homepage.

---

## 2. What the product pages say now vs. what they should say

There are no individual product pages — every product is a card on the homepage (plus the course and playbook pages). So the cards ARE the product pages, and right now they read like spec sheets, not sales copy. The house format is: spec-line / pick / verdict-line / button. The verdicts are good writing. What is missing is every line that answers "why buy this, why buy it here, why buy it now."

### The affiliate cards

**Now (typical):** spec-line of numbers, a two-sentence "pick" describing the product, a one-line verdict ("Field verdict: the output heavyweight."), and a button that says **"Check price."**

**Problems:**
- "Check price" is the weakest possible button. It promises a chore, not a product. It says "go find out what this costs somewhere else." A visitor who is even slightly interested has to do work to stay interested.
- Nothing on the card says what the product is FOR in the visitor's life — only what it IS. "1,451 Wh · 2,400W out · 1.5-hour recharge" is a spec sheet. The buyer needs one line: what night does this save?
- No price on most cards. The visitor cannot compare two cards without clicking out to two different stores. The card that shows its price wins the click; the card that hides it loses it.
- No urgency, no scarcity, no reason to act today — except the Black Friday countdown, which is about the site, not the product.

**Should say — concrete copy fixes:**

- Button: "Check price" → **"See it at [retailer]"** (e.g. "See it at Amazon", "See it at TideWe"). Names the destination, removes the mystery, and reads like a recommendation instead of a chore. For the deep-linked Awin/CJ cards, the destination is a real product page — say so: "See it at Marmot — $79.99".
- Add the price to every card where it is verified. Example, ALLPOWERS S2000 Pro card:
  - Now: "The biggest battery on this shelf — 2,400W of pure sine output, a 1.5-hour recharge, and a 5-year warranty behind it."
  - Should say: "The biggest battery on this shelf — 2,400W of pure sine output, a 1.5-hour recharge, and a 5-year warranty behind it. **$664 on sale (list $1,399).** When the DELTA 2 class runs out of headroom, this is the next step up."
- Add one use-line to the top-earning cards — the line that puts the product in the buyer's hands. Examples:
  - TideWe ThermCore Heated Vest: "Three heat zones, one battery, all-day sits in January. The vest that keeps you in the stand past noon."
  - WILDGUARDER WG9801: "4K night vision for $189.99 — see the hogs before they see you. Ships direct, 7–20 business days, so order before the weekend you need it."
  - Piscifun AlinoX 300: "Piscifun's best-selling casting reel — 8.1:1 retrieve, aluminum frame, $109.99."
- The Hunt band copy is stale and should read: "Kentucky gun is open. Tennessee opens Nov 21. **Twenty-four deer-season picks**, trail cam to field dress kit." (Count verified: 24 cards in Hunt today.)
- The hero note should read "Ninety-four products" — or better, drop the count from the note entirely and let the caption carry it, so the two can never disagree again.

### The owned (BLACKPINE) cards

**Now:** "Printed to order — $27.99." plus a department fineprint line that reads, in full: **"All sales are final. No refunds."** That line appears twice on the live homepage — once over Tees, once over Gear — and it is the single most hostile sentence on the store. It is also the ONLY returns/shipping language anywhere on the site: `info.html` says nothing about shipping, returns, or refunds at all.

**Problems:**
- "All sales are final. No refunds." is a door slammed in the buyer's face before they have even picked a shirt. It is honest — print-on-demand cannot be restocked — but as written it reads as "we don't care if it doesn't fit." For a first-time buyer on a store they found from a reel, that line alone kills the sale.
- No size information anywhere. The cards do not say what sizes exist, and whether the Stripe payment link asks the buyer for a size is **unverified** — the cards show no size selector. If the link does not collect a size, a buyer cannot complete a correct order; if it does, the card should say so ("Pick your size at checkout — S to 3XL" or whatever the true range is; do not guess the range).
- No delivery timeframe. "Printed to order" tells the buyer it is not in stock. It does not tell them when it arrives. Near Black Friday and Christmas, "when does it get here" is the question that decides the purchase, and the store does not answer it anywhere.
- No reason to buy the label. The copy describes the design ("the faceted pine over BLACKPINE, ROOTS RAN DEEP underneath") but never says why the shirt matters — whose label it is, what it stands for. The owner story lives on `info.html`, one click away, where nobody goes.

**Should say — concrete copy fixes:**

- Replace the fineprint line. Now: "All sales are final. No refunds. Every tee is a Gildan 5000, $27.99 including shipping."
  Should say: **"Every tee is a Gildan 5000, $27.99 including shipping. Printed to order when you buy — nothing sits on a shelf. Because each one is made for you, we can't take returns on size or color, so check the size chart before you order. If it arrives damaged or misprinted, we'll make it right — email gtmoguap5151@gmail.com."**
  (The damaged/misprinted promise needs Matt's approval — it is a commitment. But without some version of it, the no-refunds line will keep killing first sales. Printify's own reprint policy covers misprints; the store should say so rather than saying nothing.)
- Add a delivery line once the true Printify production + shipping time is confirmed — e.g. "Printed to order, ships in [X] business days." Do not guess the number; confirm it from the Printify account first.
- Add a size line to every apparel card: "Sizes S–3XL — pick yours at checkout" (only if the Stripe link actually collects size; verify first).
- Add one line of label story to the Tees department sub: "The label, on a shirt. Designed in Harlan County, Kentucky — BLACKPINE, ROOTS RAN DEEP. Printed to order when you buy."
- Button: "Buy — $27.99" is fine. It is the best button on the site — price included, action clear. Keep it. The problem is everything around it, not the button.

### The course and playbook pages

- The firearm course page has one Stripe link and a $49 buy button, and the homepage band for it is good ("10 modules, 19-page PDF, $49 · Education only"). Keep the band. What is missing: the playbook needs the same treatment — a homepage band or a card, and the $59 bundle needs to be visible from the course page and the homepage, not only from the playbook page itself.

---

## 3. What happens after a click — and where buyers drop off

### The affiliate handoff (68 products)

**Amazon — 52 of the 68 affiliate cards.** Every single Amazon link on the store is a **search link** (`amazon.com/s?k=Product+Name&tag=blackpinefield-20`). Zero deep product links. Here is what happens: the visitor clicks "Check price," lands on an Amazon search results page, and has to find the product themselves among sponsored listings, lookalikes, and other sellers. Amazon's own page is designed to distract them — and every distraction is a product we do not get paid for. Worse, Amazon's cookie is 24 hours and the commission is ~3%. This is the weakest handoff on the store, and it carries 52 of 68 affiliate products.

Drop-off points, in order:
1. The button says "Check price" — low intent to click at all.
2. The landing page is a search page, not the product — the visitor has to re-find it.
3. Amazon shows competitors and sponsored alternatives first — the visitor buys something else, or nothing.
4. 24-hour cookie — if they come back tomorrow, the click is worth nothing.

**Awin — 11 links (ALLPOWERS, Piscifun, 4× TideWe, MeoWant, WILDGUARDER, Vortex, SilverAnt). CJ — 4 links (Kings Camo, Marmot, Free Country, plus the tracked links on the newest cards).** These are deep links to real product pages, and they are the best handoffs on the store — 30-day cookies, 3–15% commission. The drop-off here is upstream: the cards do not show prices, so the visitor clicks blind, and the merchants' own pages have to do the closing the card did not do. The WILDGUARDER card is the honest exception — it warns about 7–20 business day shipping on the card itself, so the buyer who clicks is a buyer who already accepted the wait.

**The real affiliate problem is not the handoff — it is that almost nobody clicks.** 12 clicks from ~99 visitors in a day (Nov 14) is a click-through of roughly 12% on that day's traffic against the whole month's clicks — and the honest read is worse: those 12 clicks accumulated across weeks, not one day. The cards do not earn the click. Fix the cards first; the handoff fixes (deep Amazon links) come second.

### The owned-product Stripe path (26 products + course + playbook)

**What happens:** the visitor clicks "Buy — $27.99," a new tab opens to a Stripe payment link, they pay, done. No cart, no account, no shipping form on our site. Stripe handles the money; Printify handles the printing (per the store's model — printed/ordered only when someone buys).

**Where buyers drop off:**
1. **"All sales are final. No refunds."** — read before the click. Kills the hesitant buyer outright.
2. **No size, no delivery date** — the buyer who is ready to pay still does not know what size they are getting or when it arrives. Uncertainty at the moment of payment is where carts die, and we do not even have a cart to die in.
3. **One checkout per item.** Each product has its own Stripe payment link. A buyer who wants two tees, or a tee and a mug, pays twice, in two separate checkouts, with two separate shipping charges baked in (prices "include shipping" per item). There is no bundle, no cart, no "add another." Every second item is a second decision, and most second decisions are "no."
4. **The new tab.** The Stripe link opens in a new tab (`target="_blank"`). The store tab stays open behind it — good — but the buyer is now on a bare Stripe page with no BLACKPINE branding, no order summary beyond the one item, and no way back to the store except the back button. If they hesitate and close the tab, they are gone, and we have no email, no cart, no way to follow up.
5. **No follow-up exists.** There is no post-purchase email, no "thanks, here's what happens next," no review request, no second-purchase offer. A buyer who does buy once is never invited back. (Whether Stripe is configured to send receipts is unverified — check it.)

### The course/playbook path

Same Stripe pattern, one link each. The course has a homepage band and a nav link; the playbook has neither. The $59 bundle (course + playbook) is only visible on the playbook page. A buyer on the course page never sees the bundle offer. That is a straight revenue leak: the bundle is $10 less than buying both separately ($49 + $19 = $68), and nobody is told.

---

## 4. Prioritized fix list — quick wins first

Nothing here is done. Everything below is a draft proposal. Each item names what Matt would need to approve.

### Quick wins — copy and order only, no new tooling, no spend

**1. Fix the hostile fineprint on Tees and Gear.**
Replace "All sales are final. No refunds." with the rewritten version in Section 2 (no returns on size/color, damaged/misprinted made right, contact email). This is the single highest-leverage change on the store: it is the first thing a buyer reads on the only shelf that pays Matt directly.
*Matt approves: the exact replacement wording, and the damaged/misprinted promise.*

**2. Move Hunt to the top of the departments and BLACKPINE up behind it.**
New order for November: Hunt, BLACKPINE Tees, BLACKPINE Gear, Holiday Gift Picks, then Power, Water, Carry, Camp & Sleep, Survival, Fun Buys, Fish. The traffic is deer-season traffic; the money is the label. The page should open with what the visitor came for and what pays Matt.
*Matt approves: the new department order.*

**3. Replace the featured MeoWant card with the BLACKPINE label or the Hunt shelf.**
The $649.99 litter box leaves the front window. The featured slot goes to the BLACKPINE Combo tee (the label's flagship, $27.99, an easy first buy) or to a Hunt feature card. MeoWant keeps its Holiday card — it stays on the store, it just stops greeting every visitor.
*Matt approves: which product takes the featured slot.*

**4. Fix the three stale numbers.**
Hero note "Eighty-eight products" → 94 (or drop the count from the note). Hunt band "eighteen deer-season picks" → twenty-four. Checklist band "the six Hunt shelf picks" → match the PDF's actual content or reword to "the Hunt shelf picks."
*Matt approves: the corrected wording. (Straight corrections — lowest-risk item on this list.)*

**5. Put the price on every card where it is verified, and rename the buttons.**
"Check price" → "See it at [retailer]" on affiliate cards. Add the verified price to the pick line on the top-earning cards first (ALLPOWERS, TideWe ×4, WILDGUARDER, Piscifun, Marmot, Kings Camo, Free Country). Prices must be re-verified live before they go on a card — no stale prices.
*Matt approves: the button wording change and the price-on-card rule.*

**6. Link the playbook from the homepage.**
Add the deer-season playbook ($19) to the Guides section or as a card in Hunt, and add the $59 bundle to the course band and the course page. A finished owned product with zero homepage links is money left on the table.
*Matt approves: where the playbook card goes and the bundle wording.*

**7. Move the email capture up.**
Add a short capture line near the top of the page — under the hero or above the first department — not only at the bottom. Same offer (free deer-season checklist PDF), same FormSubmit, just visible to the visitor who leaves after two shelves.
*Matt approves: the capture placement and wording. Also needs a check first: confirm the FormSubmit activation was completed, or no signup has ever landed.*

### Medium — needs verification or a small build

**8. Verify the Stripe links collect size (apparel) and send receipts.**
Check each apparel payment link: does it ask for a size? Does Stripe send a purchase receipt? If size is not collected, the links need size options added before another tee sells — a buyer who cannot pick a size cannot complete a correct order. If receipts are off, turn them on.
*Matt approves: any change to the payment links. (His Stripe account, his call.)*

**9. Add a delivery timeframe to every owned card.**
Confirm the true Printify production + shipping time from the Printify account, then add one line to each owned card: "Printed to order, ships in [X] business days." Do not guess the number.
*Matt approves: the timeframe wording once the number is confirmed.*

**10. Convert Amazon search links to deep product links, top earners first.**
All 52 Amazon links go to search pages. Replace them with links to the actual product pages, starting with the highest-traffic departments (Hunt, Power, Holiday). This is the biggest handoff fix on the affiliate side — the visitor lands on the product, not a search page full of competitors.
*Matt approves: the deep-linking work (link-by-link verification; each product page must be confirmed live before its link changes).*

**11. Add one use-line to the top-earning cards.**
The copy fixes in Section 2 for ALLPOWERS, TideWe, WILDGUARDER, Piscifun, Marmot, Kings Camo. One line each, putting the product in the buyer's hands.
*Matt approves: the exact lines.*

### Bigger — needs a decision, not just a draft

**12. A cart, or at minimum a bundle path.**
Twenty-six separate Stripe checkouts means no multi-item orders. Options: a real cart (Stripe Checkout with line items, or a Printify storefront), or simpler — bundle payment links (e.g. "Combo White + Combo Black — $49.99" as one link). The bundle links are the cheap version and can be built now; a cart is the real fix and is a build.
*Matt approves: which route, and the bundle pricing.*

**13. Fold Fish into Hunt, and give the shelves a "most wanted" row.**
Fish (1 card) folds into Hunt or Fun Buys. Add a short "Most wanted" row near the top — 4–6 cards, hand-picked, mixing the best affiliate earners and the best owned products — so a visitor who never scrolls still sees the store's best shot.
*Matt approves: which cards make the row.*

**14. Post-purchase follow-up.**
A thank-you email that says what happens next (printed to order, ships in X days), a review request after delivery, and a second-purchase offer. This needs an email setup decision — FormSubmit is capture-only; Stripe receipts are transactional. Worth doing once the first sale lands, not before.
*Matt approves: the email setup and the copy. (Do not build until there is a first sale to follow up on.)*

---

## What I am NOT claiming

- No current visitor number. Web Analytics is off; Nov 14 (99 visitors in 24h) is the last figure on record.
- No click or conversion rate for today. The last live dashboard checks (Nov 14 evening, Nov 17) showed 12 clicks, 0 sales, $0.00, unchanged. A fresh check would be needed before quoting anything newer.
- No claim about which cards get clicked. Without analytics, the "ignored" section above is layout reasoning, not measurement.
- No claim about Stripe link behavior (size collection, receipts) — flagged as unverified in items 8 and 9.
- No claim about FormSubmit activation — flagged as unverified in item 7.

## Bottom line

The store does not have a traffic problem. It has a closing problem, and the closing problem is specific: the money shelf is last, the first product is a $650 litter box, the buttons promise a chore, the owned products lead with "no refunds" and no size or delivery date, 52 of 68 affiliate links land on search pages, and there is no cart, no capture near the top, and no follow-up. Items 1–7 are copy and order — they cost nothing, need no new tooling, and can go live in one deploy. Start there.

— The Closer
