DRAFT — NOT PUBLISHED. Staging only.

Written by: Printify department — Listings, Product Promotion, Orders, Customer Care, Pricing & Promotions, Repeat Buyer (all draft-only).
Date: Nov 19, 2026.
Assignment: Printify product setup for the BLACKPINE owned line.

## In plain English
- **What this is:** The Printify team's full setup plan for Matt's 26 own-brand products — tees, mugs, hoodies, caps, long sleeves, and crewnecks.
- **What it found / what it does:** The 26 products are live on the store with Stripe links, but none exists yet in Printify, so orders are still filled by hand. The plan maps every product to its Printify blank, sets the build order (tees first, caps last), and drafts the customer-care replies and the prices.
- **What it costs or earns:** A tee sells for $27.99 and keeps about $11.72 after printing, shipping, and card fees; a hoodie at $54.99 keeps about $24.53 — the best earner in the line.
- **What Matt needs to decide:** Say yes to building the 26 products in Printify, and pick printed or stitched for the caps (stitched dad caps at $34.99 leave only about $7.33).

---

## Ground truth this draft stands on

- The 26 owned products are LIVE on blackpinefield.com (Department 11, "BLACKPINE Gear") with one Stripe payment link each, fulfilled MANUALLY. Nothing is printed until a customer buys.
- Printify account EXISTS (store "Blackpine Field", FREE plan). NO products have been created in Printify. NO sales channel is connected inside Printify.
- All Printify costs below are the verified US provider prices from Nov 18, 2026 (product + print, before shipping). Shipping figures are ESTIMATES — Printify US provider rates vary by provider and destination. Shipping is INSIDE the retail price on every product (same convention as the tee math).
- Stripe fees (~2.9% + $0.30) are NOT included in the headline margins. The Pricing section shows the after-Stripe numbers.
- Store policy, standing: **"All sales are final. No refunds."** Customer Care NEVER promises refunds.
- The Shuttle's standing plan: when the first order lands, the Shuttle creates the Printify product and places the order manually — no automated path exists. This draft is the setup work that makes that first order smooth instead of improvised.

---

## 1. Listings

### The 26, mapped to Printify catalog items

**Tees — the Tailor's Ten (design-01 … design-10), all $27.99**
Printify catalog item: **Gildan 5000 Heavy Cotton Tee**, DTG/DTF print, cost $9.55.
Art files on hand: `art-lockup-*.png` (black and bone ink lockups) in `brand/label/v2/tailor-ten/`.

| # | Design | Placement | Colorway | Print areas |
|---|--------|-----------|----------|-------------|
| 01 | The Classic Combo — White | Chest mark + big back | White | Front left-chest + back |
| 02 | The Classic Combo — Black | Chest mark + big back | Black | Front left-chest + back |
| 03 | Chest Lockup — White | Front centre | White | Front |
| 04 | Chest Lockup — Black | Front centre | Black | Front |
| 05 | Camel Back — True Pine | Back, big | Camel | Back |
| 06 | Fall Drop — BORN TO HUNT | Front centre | White | Front |
| 07 | Winter Drop — BUILT FOR COLD | Front centre | Black | Front |
| 08 | Oversized True Pine — White | Back, oversized | White | Back |
| 09 | Left-Chest Minimal — Black | Left chest only | Black | Front left-chest |
| 10 | Spring Drop — SPRING THUNDER CALLS | Front centre | Camel | Front |

Margin (each tee): $27.99 − $9.55 cost − ~$5.61 shipping = **$12.83**.

**Mugs — 3, all $19.99**
Printify catalog item: **Ceramic Mug 11oz**, cost $5.03.

| SKU | Design | Margin |
|-----|--------|--------|
| mug-01 | Full lockup, white — faceted pine + BLACKPINE + ROOTS RAN DEEP | $19.99 − $5.03 − $4.99 ship = **$9.97** |
| mug-02 | True pine, black — bone true pine, tree only | **$9.97** |
| mug-03 | Minimal, white — small chest mark + BLACKPINE | **$9.97** |

Note: mug-02 is a black mug with bone ink; the mug-01/03 white mugs carry black ink. The mug squeeze-wrap treatment from the Tailor's line needs the wrap art sized to the mug template, not the flat mockup.

**Hoodies — 3, all $54.99**
Printify catalog item: **Gildan 18500 Heavy Blend Hooded Sweatshirt**, cost $21.58.

| SKU | Design | Margin |
|-----|--------|--------|
| hoodie-01 | Chest lockup, black — ROOTS RAN DEEP (bone) | $54.99 − $21.58 − $6.99 ship = **$26.42** |
| hoodie-02 | Winter lockup, black — BUILT FOR COLD (bone) | **$26.42** |
| hoodie-03 | True pine front, white — black true pine, tree only | **$26.42** |

**Trucker caps — 2, all $34.99**
Printify catalog item: **Yupoong 6006 Classic Trucker**, DTF cost $14.30 / embroidered $17.29.

| SKU | Design | Margin (DTF) | Margin (embroidered) |
|-----|--------|--------------|----------------------|
| trucker-01 | Chest-mark lockup, black (bone) | $34.99 − $14.30 − $4.99 = **$15.70** | $34.99 − $17.29 − $4.99 = **$12.71** |
| trucker-02 | True pine, black — bone true pine, tree only | **$15.70** | **$12.71** |

**Dad caps — 2, all $34.99**
Printify catalog item: **Yupoong 6245CM Classic Dad Cap**, DTF cost $16.12 / embroidered $21.36.

| SKU | Design | Margin (DTF) | Margin (embroidered) |
|-----|--------|--------------|----------------------|
| dadcap-01 | Chest-mark lockup, black (bone) | $34.99 − $16.12 − $4.99 = **$13.88** | $34.99 − $21.36 − $4.99 = **$8.64** |
| dadcap-02 | Faceted pine alone, black — the Tailor's minimal mark (bone) | **$13.88** | **$8.64** |

**Long sleeve tees — 3, all $34.99**
Printify catalog item: **Gildan 2400 Long Sleeve Tee**, cost $12.83.

| SKU | Design | Margin |
|-----|--------|--------|
| longsleeve-01 | True pine back, white — big black true pine, tree only | $34.99 − $12.83 − $5.99 ship = **$16.17** |
| longsleeve-02 | Chest lockup, white — ROOTS RAN DEEP | **$16.17** |
| longsleeve-03 | Minimal, black — small chest mark + BLACKPINE (bone) | **$16.17** |

**Crewnecks — 3, all $44.99**
Printify catalog item: **Gildan 18000 Heavy Blend Crewneck Sweatshirt**, cost $17.15.

| SKU | Design | Margin |
|-----|--------|--------|
| crewneck-01 | Chest lockup, black — ROOTS RAN DEEP (bone) | $44.99 − $17.15 − $6.99 ship = **$20.85** |
| crewneck-02 | True pine front, white — black true pine, tree only | **$20.85** |
| crewneck-03 | Fall lockup, white — BORN TO HUNT | **$20.85** |

### Build order (when Matt says go)

1. **The 10 tees first.** They are the line's spine, the art is print-ready, and the Gildan 5000 is the most widely stocked US blank. Start with design-01/02 (Classic Combo, both colorways) since they carry both print areas and prove the two-sided workflow.
2. **The 3 hoodies + 3 crewnecks second.** Highest dollar margins in the line ($26.42 / $20.85) and the cold-weather season is now — BUILT FOR COLD and BORN TO HUNT are season-right.
3. **The 3 long sleeves third.** Strong margin ($16.17), same print workflow as the tees.
4. **The 3 mugs fourth.** Lowest margin ($9.97) but the cheapest entry point for a first-time buyer — they are the trial purchase, not the profit engine.
5. **The 4 caps last.** The DTF-vs-embroidery decision (see Decisions) has to land before these are built, and caps carry the most print-area fiddling.

### Per-item setup checklist (for each of the 26, when built)

- Print file sized to the Printify template for that blank (mockup PNGs are presentation images, not print files — the lockup art files are the source).
- Correct ink color per colorway: BLACK ink on light garments, BONE ink on black garments. No amber pine on any product.
- Back prints tree-only, name off the back (designs 01, 02, 05, 08, longsleeve-01).
- Mockup generated in Printify and eyeballed against the store mockup before the product is marked ready — text spelled right (BLACKPINE, ROOTS RAN DEEP, BUILT FOR COLD, BORN TO HUNT, SPRING THUNDER CALLS).
- Product title and description written in house voice (see Product Promotion for the naming pattern).
- Variant set: sizes S–3XL on apparel where the blank offers them; note that 2XL/3XL carry a Printify upcharge — price those variants up, do not absorb it (see Pricing).

---

## 2. Product Promotion

Drafts only. Nothing here is posted, sent, or scheduled. Each item below is a draft to be built and brought to Matt for approval before it goes anywhere.

### Naming and description pattern (Printify product titles)

- Tees: "BLACKPINE — [Design name] Tee" (e.g. "BLACKPINE — Roots Ran Deep Chest Lockup Tee").
- Hoodies/crewnecks/long sleeves: "BLACKPINE — [Design name] [Hoodie/Crewneck/Long Sleeve]".
- Mugs: "BLACKPINE — [Design name] Mug".
- Caps: "BLACKPINE — [Design name] [Trucker/Dad Cap]".
- Descriptions lead with the spec, not the hype: blank, weight, print method, colorway, then one line of brand voice. No fake hands-on claims, no "tested" language about garments nobody has worn. FTC disclosure stays on the store; Printify listings carry the same honest-spec standard.

### Promotion drafts per product (once live in Printify)

- **The 10 tees:** one carousel draft (all ten mockups, one slide each) + one reel draft built around the Classic Combo front/back sheet. Hook: the ten are Matt's designs — the line starts with the owner's hand. The seasonal drops (Fall, Winter, Spring) each get their own short post draft tied to the season, not a generic "new merch" blast.
- **Hoodies + crewnecks:** one "cold weather" reel draft — BUILT FOR COLD hoodie and BORN TO HUNT crewneck as the season pair. The hoodie is the highest-margin item in the line; it leads the cold-weather push.
- **Long sleeves:** one draft pairing longsleeve-01 (true pine back) with the tee line — the layer-up companion piece.
- **Mugs:** one draft — the mug as the lowest-priced way into the label ($19.99). Morning-coffee framing, no fake lifestyle claims.
- **Caps:** one draft per style — trucker (work/field) and dad cap (everyday) — once the DTF-vs-embroidery call is made, so the copy describes the real product.
- **The full line:** one "26 pieces, one label" contact-sheet draft for the Black Friday window, using the two contact sheets already on file (tailor-ten + full-line). This is the one big push draft; everything else is small and specific.

### What promotion does NOT do

- No price in a post that contradicts the store price. No "sale" language unless Pricing has approved a real promotion (see section 5).
- No AI-generated people wearing the gear. Still mockups only, same rule as the Tailor's build.
- No promise about delivery speed beyond what Printify's production + shipping actually quotes at order time.

---

## 3. Orders

### Today's manual flow (how it works right now)

1. Customer buys on blackpinefield.com through the product's Stripe payment link (US shipping address collected at checkout).
2. Stripe confirms payment. Somebody (today: Xena/the Shuttle) sees the order.
3. The Shuttle creates the Printify product for that design (if not already created) and places a manual Printify order to the customer's address.
4. Printify prints and ships. Tracking comes back to the Shuttle, who passes it to the customer.
5. Margin lands in Stripe minus Printify cost, shipping, and Stripe fees.

Weak points in today's flow: every first-time design needs its Printify product built at order time (slow, error-prone under pressure); tracking is hand-carried; there is no automatic link between a Stripe payment and a Printify order, so a missed step means a paid customer with nothing printed.

### The flow once Printify is set up (this draft's target state)

1. All 26 products pre-built in Printify (per the Listings order above), each matched to its Stripe link by SKU.
2. Customer buys through the same Stripe link. No change to the storefront.
3. The Shuttle places the Printify order from the pre-built product — pick the SKU, pick the size/color the customer chose, enter the shipping address from Stripe, submit. No design work at order time.
4. Printify prints and ships; tracking flows back. The Shuttle sends the customer the tracking number and the expected window.
5. If a print fails quality or a shipment is lost, the Shuttle re-orders through Printify's reprint/reship path — the customer is told what is happening and when, never promised a refund (see Customer Care).

### What is NOT in this draft

- No sales-channel connection is proposed here. Connecting a sales channel inside Printify (Shopify, Etsy, etc.) is a separate decision with its own costs and its own storefront implications — the store is a static site with Stripe links, and Printify has no native "Stripe payment link" sales channel. The manual-order flow above is the honest path for this store as built.
- No automation is built by this draft. The Shuttle's manual order is the fulfillment method until Matt approves something else.

---

## 4. Customer Care

### Standing policy (non-negotiable)

**"All sales are final. No refunds."** This is the store policy. Customer Care NEVER promises refunds — not in a template, not in a one-off reply, not to defuse an angry customer. If a customer asks for a refund, the answer is the policy, stated plainly and politely, plus whatever remedy the situation actually allows (reprint, reship, replacement — see below).

### What we CAN do for a customer

- **Wrong item / misprint / damaged in transit:** reprint or reship through Printify. This is the real remedy and it costs the Printify reprint, not a refund.
- **Lost shipment:** check tracking, wait out the carrier window, then reship if the carrier confirms loss.
- **Wrong size ordered by the customer:** the customer ordered it; all sales final. We can offer to help them order the right size at full price. No exchange promise — an exchange is a new order.
- **Order status / "where is my stuff":** tracking number + the Printify production window, honestly stated.

### Response templates (drafts — to be used as written, never improvised past the policy)

**Order confirmation (sent after the Printify order is placed):**
> Thanks for your BLACKPINE order — [product] in [size/color] is in production. Print-on-demand takes [X] business days to print, then ships to [city, state]. Tracking: [link/number]. All sales are final — if anything arrives misprinted or damaged, let us know and we'll make it right with a reprint.

**Shipping question ("when will it arrive?"):**
> Your [product] is printed to order — production takes [X] business days, then shipping is [X–Y] days to your address. Tracking: [link]. If the tracking hasn't moved in [X] days, message us and we'll check with the printer.

**Wrong size / wants to change the order:**
> All sales are final, so we can't change or cancel an order once it's in production. If your order hasn't started printing yet, message us right away with what you need and we'll check — no promises, but we'll try. If it's already printing, the way to get the other size is a new order.

**Refund request:**
> I hear you, and I'm sorry it's not what you wanted. Our store policy is all sales are final — we don't do refunds. What I can do: if the item arrived misprinted, damaged, or wrong, we'll reprint or reship it at no cost to you. Send a photo of the issue and we'll get it sorted.

**Misprint / damaged / wrong item:**
> Sorry about that — send a photo of what arrived and we'll get a reprint going right away. No need to send anything back. Your replacement will ship to the same address.

**"Is this real / is the store legit?":**
> Yes — BLACKPINE FIELD is a real store at blackpinefield.com. The BLACKPINE label is our own line, printed to order in the US. Your order is made after you buy it, which is why production takes a few days.

### Care rules

- Answer within one business day. A slow honest answer beats a fast promise we can't keep.
- Never invent a tracking number, a ship date, or a production time. If Printify hasn't given it, say so.
- Never apologize by offering money back. Apologize by fixing the thing.
- Every care exchange that touches a real order gets logged with the order details so the next person doesn't start from zero.

---

## 5. Pricing & Promotions

### Are the current prices right?

Short answer: **yes, with two flags.** Every product clears a healthy margin at its current price, and the margins survive Stripe fees. The line is priced like a real label, not a clearance rack, and the prices hold up against the verified Printify costs.

### Margin table (headline margin, then after Stripe fees)

Stripe fee at each price point (~2.9% + $0.30): $27.99 → $1.11 · $19.99 → $0.88 · $54.99 → $1.89 · $34.99 → $1.31 · $44.99 → $1.60.

| Product group | Price | Printify cost | Est. ship | Headline margin | After Stripe |
|---|---|---|---|---|---|
| Tee (Gildan 5000) | $27.99 | $9.55 | ~$5.61 | $12.83 | ~$11.72 |
| Mug | $19.99 | $5.03 | $4.99 | $9.97 | ~$9.09 |
| Hoodie (Gildan 18500) | $54.99 | $21.58 | $6.99 | $26.42 | ~$24.53 |
| Trucker (DTF) | $34.99 | $14.30 | $4.99 | $15.70 | ~$14.39 |
| Trucker (embroidered) | $34.99 | $17.29 | $4.99 | $12.71 | ~$11.40 |
| Dad cap (DTF) | $34.99 | $16.12 | $4.99 | $13.88 | ~$12.57 |
| Dad cap (embroidered) | $34.99 | $21.36 | $4.99 | $8.64 | ~$7.33 |
| Long sleeve (Gildan 2400) | $34.99 | $12.83 | $5.99 | $16.17 | ~$14.86 |
| Crewneck (Gildan 18000) | $44.99 | $17.15 | $6.99 | $20.85 | ~$19.25 |

### Price verdicts

- **Tees at $27.99 — right.** $12.83 headline / ~$11.72 after Stripe on a $9.55 blank is a strong print-on-demand margin. Do not cut it.
- **Hoodies at $54.99 — right, and the best dollar margin in the line.** $26.42 headline. This is the item to push hardest.
- **Crewnecks at $44.99 — right.** $20.85 headline. Second-best dollar margin.
- **Long sleeves at $34.99 — right.** $16.17 headline — better margin than the tees in dollars.
- **Truckers at $34.99 — right on DTF, acceptable on embroidery.** DTF $15.70 is strong; embroidery $12.71 is fine. Either way the price holds.
- **Dad caps at $34.99 — right on DTF, FLAG on embroidery.** DTF $13.88 is fine. Embroidered at $21.36 cost leaves only $8.64 headline / ~$7.33 after Stripe — the thinnest margin in the line. If Matt wants embroidered dad caps, the price should move to $39.99 (margin $13.64 headline) or the caps stay DTF. **Do not sell embroidered dad caps at $34.99 without a conscious call.**
- **Mugs at $19.99 — right, with a role note.** $9.97 headline is the lowest dollar margin in the line, but the mug is the cheapest way into the label and the most likely first purchase. Its job is to open the door, not to carry the month. Keep the price; do not discount it further.

### Blank upgrades — the tee question

- Gildan 5000 ($9.55) is the current blank. Bella+Canvas 3001 ($11.43) would cut the tee margin to ~$10.95 headline; Comfort Colors 1717 ($12.65) would cut it to ~$9.73. Both are softer, better-feeling shirts — but neither is worth a ~$2–$3 margin cut across ten designs until the line has real sales data. **Recommendation: stay on Gildan 5000 for the launch. Revisit a premium-blank variant (one or two designs on Bella+Canvas at $29.99) only after the first sales come in.**

### Size upcharges

- 2XL/3XL blanks cost more in Printify. When the products are built, price the extended sizes up to cover the upcharge — do not absorb it into the base margin. Exact upcharge varies by provider; set it at build time from the live Printify price.

### Promotions (drafts only — nothing runs without Matt's word)

- **Black Friday window:** the one promotion worth drafting. A bundle draft: tee + mug at a combined price that keeps both margins positive (e.g. $44.99 for the pair vs $47.98 separate — the $3.00 discount comes out of the combined ~$22.80 headline margin, leaving ~$19.80). Draft only; the exact bundle and price need Matt's approval.
- **No blanket percentage-off sale.** A 20%-off-everything sale would cut the tee margin to ~$7.23 and the mug to ~$5.97 — the line is too young and too thin to give away margin for volume it hasn't proven it can get.
- **Free shipping is already inside the price.** Do not advertise "free shipping" as a promotion — it is the pricing model, not a deal.

---

## 6. Repeat Buyer

### What brings a buyer back for a second order

The honest answer: the second order comes from the first order being good. A buyer who gets a well-printed shirt that fits right and arrives when we said it would is the buyer who comes back. Everything below assumes the first order went right — if it didn't, Customer Care's reprint is the retention move, not a discount.

### The repeat path, product by product

- **Mug first, tee second.** The $19.99 mug is the lowest-risk first buy. A mug buyer who likes the print is the natural next buyer of a $27.99 tee — same mark, bigger canvas. The mug is the trial; the tee is the conversion.
- **Tee first, hoodie second.** A tee buyer who likes the fit and print is the natural buyer of the $54.99 hoodie — the highest-margin item in the line and the one that turns a $27.99 customer into an $82.98 customer across two orders.
- **Seasonal drops as the reason to return.** The Fall (BORN TO HUNT), Winter (BUILT FOR COLD), and Spring (SPRING THUNDER CALLS) drops are already built into the ten tees. Each season is a natural reason to come back — not a manufactured sale, a real new design for a real season.
- **The caps as the add-on.** A $34.99 cap is the easiest second item in a cart that already has a tee or hoodie in it. Caps don't lead; they follow.
- **The full line as the collection.** 26 pieces, one mark, one story. A buyer who owns two or three pieces starts collecting the set. The contact sheets (tailor-ten + full-line) are the collection view — show the buyer what they don't have yet.

### Repeat-buyer drafts (nothing sent without Matt's word)

- **Post-delivery thank-you draft:** a short message after the tracking shows delivered — thanks, the mark's story in one line, and a pointer to the piece that pairs with what they bought (mug → tee, tee → hoodie). No discount in the first message; the product is the pitch.
- **Second-order nudge draft:** one follow-up, weeks later, tied to the season — the Winter drop for a Fall buyer, the Spring drop for a Winter buyer. One message, not a drip campaign.
- **No loyalty program yet.** A points program for a store with zero owned-line sales is theater. Earn the first ten repeat buyers by hand, then decide if a program is worth building.

---

## Decisions needed from Matt

1. **DTF or embroidery for the caps?** DTF is cheaper on both styles (trucker $14.30 vs $17.29; dad cap $16.12 vs $21.36). Embroidery looks and lasts better on a cap, but the embroidered dad cap at $34.99 leaves only $8.64 headline margin. If embroidery: approve a dad-cap price move to $39.99, or accept the thin margin.
2. **Build order approved?** Tees → hoodies/crewnecks → long sleeves → mugs → caps, as laid out in Listings. Or a different order?
3. **Stay on Gildan 5000 for the tees?** Pricing recommends yes for launch; Bella+Canvas 3001 ($11.43) or Comfort Colors 1717 ($12.65) as a later premium variant only.
4. **2XL/3XL pricing:** price extended sizes up to cover Printify's upcharge (Pricing's recommendation), or absorb it?
5. **Black Friday bundle draft:** approve drafting a tee + mug bundle (draft price $44.99 for the pair), or no bundle?
6. **Customer Care templates:** approved as written, or any wording changes — especially the refund-request reply?
7. **Go-ahead to build:** when Matt says go, the Shuttle builds the 26 products in Printify in the order above. Nothing is built until he says so — this draft creates nothing.

---

*End of draft. Nothing in this document has been created in Printify, sent, published, contacted, listed, or spent.*
