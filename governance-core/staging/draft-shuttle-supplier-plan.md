DRAFT — NOT PUBLISHED. Staging only.

Written by: The Shuttle (shuttle-operator, draft-only)
Date: Nov 19, 2026
Assignment: supplier plan for the BLACKPINE owned line

## In plain English
- **What this is:** The Shuttle's plan for getting Matt's 26 own-brand products made and shipped through Printify, plus the state of two other supplier lanes.
- **What it found / what it does:** The Printify account exists but has no products and no payment method saved, so orders are still placed by hand. The plan builds the 26 products in four waves, keeps the manual flow through Black Friday, and leaves CJ Dropshipping blocked on a human-check box only Matt can tap, with the CanvasCamp application drafted but not sent.
- **What it costs or earns:** A tee costs $9.55 to make and keeps $12.83 at the $27.99 price; the hoodie keeps $26.42 on $54.99, the best in the line.
- **What Matt needs to decide:** Say yes to building the products wave by wave, put a card on file in Printify, and say "Send it" or "Drop it" on the CanvasCamp application.

## Where things stand

- The store (blackpinefield.com) lists 26 owned BLACKPINE products in the
  BLACKPINE Gear department: the Tailor's 10 tees + the 16-piece full line
  (3 mugs, 3 hoodies, 2 trucker caps, 2 dad caps, 3 long sleeves, 3 crewnecks).
- All 26 have Stripe payment links on the store (26 unique buy.stripe.com
  links in site/index.html). The 16 full-line links were verified against
  Stripe's API on Nov 19 (active, correct amount, correct product name;
  account acct_1TnPedCZRLLet9af, livemode; US shipping-address collection on
  every link). The 10 tee links are present in the HTML; they were not
  individually re-verified against the API in the records I read — verify
  before the first order.
- Printify account EXISTS: store named "Blackpine Field", FREE plan, business
  details saved (verified Nov 18, 15:45–15:54 ET). NO products created in
  Printify, 0 orders, NO sales channel connected.
- Nothing is printed until a customer buys. Fulfillment today is manual:
  when the first order lands, the Shuttle creates the Printify product and
  places the order by hand. No automated path exists.
- Corrections that stand: there is NO existing "supplier catalog we buy
  from"; affiliate programs (Awin, CJ, Amazon Associates) are NOT suppliers;
  dropship gear keeps the MANUFACTURER's brand — what Blackpine owns is the
  store, the listing, and the margin.

## 1. Printify product-creation plan

### Costs (verified live Nov 18, US provider, product + print, before shipping)

- Gildan 5000 tee $9.55 · Bella+Canvas 3001 $11.43 · Comfort Colors 1717 $12.65
- Gildan 18500 hoodie $21.58 · Gildan 2400 long sleeve $12.83
- Gildan 18000 crewneck $17.15 · Ceramic mug $5.03
- Yupoong 6006 trucker $14.30 DTF / $17.29 embroidered
- Yupoong 6245CM dad cap $16.12 DTF / $21.36 embroidered

Pricing convention (same as the tee math): shipping is INSIDE the retail
price. Margin = retail − Printify cost − estimated shipping. Shipping figures
are ESTIMATES — Printify US provider rates vary by provider and destination.
Stripe fees (~2.9% + $0.30) are NOT included in any margin below.

### The 26 products, mapped to Printify catalog items

Wave 1 — the 10 tees (the line's core; designs are Matt's own picks, art
files already exist). All on the Gildan 5000 blank, DTF, retail $27.99,
cost $9.55, est. shipping $5.61, TRUE margin $12.83 each.

| # | Design | Colorway | Placement |
|---|--------|----------|-----------|
| 01 | The Classic Combo | White | Chest mark + big back |
| 02 | The Classic Combo | Black | Chest mark + big back |
| 03 | Chest Lockup — ROOTS RAN DEEP | White | Front centre |
| 04 | Chest Lockup — ROOTS RAN DEEP | Black | Front centre |
| 05 | Camel Back — True Pine | Camel | Back, big |
| 06 | Fall Drop — BORN TO HUNT | White | Front centre |
| 07 | Winter Drop — BUILT FOR COLD | Black | Front centre |
| 08 | Oversized True Pine | White | Back, oversized |
| 09 | Left-Chest Minimal — BLACKPINE only | Black | Left chest only |
| 10 | Spring Drop — SPRING THUNDER CALLS | Camel | Front centre |

Art source: `brand/label/v2/tailor-ten/` — mockups design-01.png …
design-10.png, lockup art files art-lockup-*.png (black/bone ink).
CAVEAT before creating #01/#02: they carry TWO print placements (chest +
back). The verified $9.55 is product + print; confirm in Printify whether
the second placement adds cost before creating those two, and re-do the
margin if it does. Do not assume.

Wave 2 — hoodies + crewnecks (highest dollar margin per sale).

| SKU | Printify item | Retail | Cost | Est. ship | Margin |
|-----|---------------|--------|------|-----------|--------|
| hoodie-01 | Gildan 18500, DTF — Chest lockup, black, ROOTS RAN DEEP (bone) | $54.99 | $21.58 | $6.99 | $26.42 |
| hoodie-02 | Gildan 18500, DTF — Winter lockup, black, BUILT FOR COLD (bone) | $54.99 | $21.58 | $6.99 | $26.42 |
| hoodie-03 | Gildan 18500, DTF — True pine front, white, tree only | $54.99 | $21.58 | $6.99 | $26.42 |
| crewneck-01 | Gildan 18000, DTF — Chest lockup, black, ROOTS RAN DEEP (bone) | $44.99 | $17.15 | $6.99 | $20.85 |
| crewneck-02 | Gildan 18000, DTF — True pine front, white, tree only | $44.99 | $17.15 | $6.99 | $20.85 |
| crewneck-03 | Gildan 18000, DTF — Fall lockup, white, BORN TO HUNT | $44.99 | $17.15 | $6.99 | $20.85 |

Wave 3 — long sleeves + caps.

| SKU | Printify item | Retail | Cost | Est. ship | Margin |
|-----|---------------|--------|------|-----------|--------|
| longsleeve-01 | Gildan 2400, DTF — True pine back, white, big tree only | $34.99 | $12.83 | $5.99 | $16.17 |
| longsleeve-02 | Gildan 2400, DTF — Chest lockup, white, ROOTS RAN DEEP | $34.99 | $12.83 | $5.99 | $16.17 |
| longsleeve-03 | Gildan 2400, DTF — Minimal, black, small chest mark + BLACKPINE (bone) | $34.99 | $12.83 | $5.99 | $16.17 |
| trucker-01 | Yupoong 6006, DTF — Chest-mark lockup, black (bone) | $34.99 | $14.30 | $4.99 | $15.70 |
| trucker-02 | Yupoong 6006, DTF — True pine, black, tree only (bone) | $34.99 | $14.30 | $4.99 | $15.70 |
| dadcap-01 | Yupoong 6245CM, DTF — Chest-mark lockup, black (bone) | $34.99 | $16.12 | $4.99 | $13.88 |
| dadcap-02 | Yupoong 6245CM, DTF — Faceted pine alone, black (bone) | $34.99 | $16.12 | $4.99 | $13.88 |

Embroidery option on caps (decision for Matt, not assumed): trucker
embroidered $17.29 → margin $12.71; dad cap embroidered $21.36 → margin
$8.64. DTF is the plan as priced; embroidery costs margin for a cleaner
look on caps. The Tailor's note from the Nov 18 check-in stands: do not
chase the cheapest blank at the cost of a garment nobody reaches for twice.

Wave 4 — mugs (lowest margin, lowest ticket; last).

| SKU | Printify item | Retail | Cost | Est. ship | Margin |
|-----|---------------|--------|------|-----------|--------|
| mug-01 | Ceramic mug — Full lockup, white | $19.99 | $5.03 | $4.99 | $9.97 |
| mug-02 | Ceramic mug — True pine, black, tree only | $19.99 | $5.03 | $4.99 | $9.97 |
| mug-03 | Ceramic mug — Minimal, white, small chest mark + BLACKPINE | $19.99 | $5.03 | $4.99 | $9.97 |

### Alternate tee blanks (not the plan — for Matt's call only)

- Bella+Canvas 3001 at $11.43 → tee margin $10.95 (softer blank, $1.88 less margin).
- Comfort Colors 1717 at $12.65 → tee margin $9.73 ($3.10 less margin).
- Gildan 5000 stays the plan unless Matt picks an upgrade.

### Prep before any product is created

1. Confirm print-ready art exists for all 26. The ten tees have lockup art
   files (art-lockup-*.png). The full line's files are mockups
   (mug-01.png, hoodie-01.png, etc.) plus the builder script
   (build_full_line.py) — confirm the transparent print files are on hand
   or re-export them from the builder before creating products. Do not
   upload a mockup photo as print art.
2. Verify the 10 tee Stripe links against Stripe's API (the 16 full-line
   links are already verified).
3. Confirm in Printify whether designs 01/02 (front + back) carry a
   second-placement charge, and re-do their margin if so.
4. Confirm a payment method is on file in Printify before the first manual
   order — no payment method is recorded as saved. Without one, an order
   cannot be placed. This is Matt's hands (his card), flagged here, not
   done here.
5. Create in the wave order above, one wave at a time, reporting back after
   each wave. Nothing is created until Matt gives the word per wave.

## 2. Connecting a sales channel inside Printify

blackpinefield.com is a custom static site (Cloudflare Pages). It has NO
direct Printify integration — there is no plug-in to connect. Options:

A. No channel — manual fulfillment (CURRENT STATE, works today).
   Orders come in through the Stripe payment links already on the store;
   the Shuttle places each order in Printify by hand (see §5). Needs from
   Matt: nothing new — just his word to start creating products, and a
   payment method on file in Printify. Cost: $0 extra. Downside: every
   order is hand work; fine at low volume, not at scale.

B. Printify Pop-Up Store (Printify's own hosted storefront).
   Free; Printify hosts a store page for the products. Needs from Matt:
   his word + brand decisions (store name, what shows). Downside: it lives
   on Printify's URL, not blackpinefield.com — a second storefront to send
   people to, splitting the brand. The Stripe links on blackpinefield.com
   would still be the main checkout unless the store is re-pointed.

C. Shopify / WooCommerce / Etsy integration.
   Printify connects natively to all three, and orders would flow in
   automatically. Needs from Matt: a NEW store to set up on one of those
   platforms (he has none of them today), his account + sign-in, and his
   approval for whatever that platform charges — I have not verified
   current pricing for any of them and will not quote a number here.
   Downside: a second store to run alongside blackpinefield.com, plus
   ongoing cost. This is the scale answer, not the Black Friday answer.

D. Printify API (custom integration into blackpinefield.com).
   Technically possible — orders could flow from the site to Printify
   automatically. Needs from Matt: his word for the build, and an API key
   created in his Printify account (his hands). Downside: real development
   work; nothing exists today.

RECOMMENDATION: stay on A (manual) through Black Friday. The Stripe links
already work, the volume is zero today, and every other option costs Matt
money, a new account, or build time before a single sale exists. Revisit C
or D when manual orders become a burden — i.e. after real sales prove the
line.

## 3. CJ Dropshipping — unblock path

STATUS: signup BLOCKED. Cloudflare Turnstile ("Verify you are human")
failed 8× across two browser routes (5 + 3) on Nov 18. Matt took over the
live browser briefly (~15:18 ET, 7 seconds, no recorded activity) and
handed it back unsolved. Matt parked both supplier signups ~15:09 ET
("we'll catch up for that when it comes on") and moved on.

UNBLOCK PATH (his hands only — no action from us now):
1. Matt opens CJ Dropshipping's signup on HIS OWN phone browser/network
   and taps the "Verify you are human" checkbox himself, OR
2. Matt takes over a live browser session and taps the checkbox there.
Then the signup continues (email verification tap is also his).

Do NOT nag him about it — he parked it. When he is ready, the signup is
free to join; CJ has US warehouses (3–8 days from US stock) but most of
its catalog ships from China, so the plan filters for US stock only.
Note: CJ Dropshipping is NOT CJ Affiliate (CID 8107750) — different
company, different account. Do not confuse them.

## 4. CanvasCamp direct dropship application

STATUS: DRAFTED, sits in Gmail, NOT SENT. Addressed to
partners@canvascamp.com. On the Nov 18 voice call Matt said "Go ahead and
send it" — but the send was never confirmed: the email permission card was
issued after his go-ahead and he moved on to Printify without answering
it. The send is UNCONFIRMED, not declined, and must NOT be treated as
sent. (Note: CanvasCamp is ALSO a pending CJ Affiliate application,
programme 7451882, applied Oct 24 — that is the affiliate program, a
separate thing from this direct dropship application. Do not confuse
them.)

DECISION NEEDED FROM MATT (one word, either way):
- "Send it" — the drafted application goes to partners@canvascamp.com, OR
- "Drop it" — the draft stays unsent and the CanvasCamp lane closes.

Do NOT resend or re-raise the send card without his explicit word. The
application itself asks for CanvasCamp's direct dropship program (blind
shipping, no strict minimums, per their program terms as recorded Nov 18).
If approved, CanvasCamp gear would ship under CANVASCAMP's brand, not
Blackpine's — the margin is ours, the label is theirs.

## 5. When the first order comes in (manual fulfillment, as it stands today)

1. Customer pays through the product's Stripe payment link on
   blackpinefield.com. Payment lands in Stripe (acct_1TnPedCZRLLet9af,
   livemode). Every link collects a US shipping address at checkout.
2. The Shuttle (or Xena) reads the order from Stripe: which product,
   size/color, customer name, shipping address, amount paid.
3. In the Printify dashboard, create the product FIRST if it does not
   exist yet (from the art files in §1 — the plan is to have products
   created ahead of orders, but a first order on an uncreated product
   means creating it on the spot).
4. Place a MANUAL order in Printify for that product, size/color, with the
   CUSTOMER's name and shipping address as the ship-to. Printify charges
   product + print + shipping to the payment method on file. (Open item:
   no payment method is recorded as saved in Printify — see §1 prep step
   4. This must be fixed before an order can be placed.)
5. Printify prints and ships direct to the customer. No Blackpine
   warehouse, no repacking, nothing passes through Matt's hands.
6. When Printify issues tracking, forward it to the customer by email
   (from gtmoguap5151@gmail.com). No delivery-time promise beyond what
   Printify shows; no refund promises in any customer message.
7. Record the sale: retail received, Printify cost, shipping paid, Stripe
   fee, net margin. The margin figures in §1 are estimates until the
   first real Printify invoice shows the true shipping charge — re-do
   the math on real numbers after order #1.

What can go wrong, stated plainly: a first order on a product not yet
created in Printify means same-day creation under time pressure; a
missing payment method in Printify blocks the order outright; Printify
shipping estimates may come in higher than the figures in §1, which
would eat margin. All three are fixed by doing the §1 prep steps BEFORE
the first order, not after.

## Decisions needed from Matt

1. Word to create Printify products — per wave (§1), starting with Wave 1
   (the 10 tees).
2. Payment method on file in Printify (his card, his hands) before any
   order can be placed.
3. Sales channel: stay manual (recommended) or pick B, C, or D (§2).
4. CJ Dropshipping: his tap on the Turnstile check, when he is ready —
   no action now, no nagging (§3).
5. CanvasCamp: "Send it" or "Drop it" (§4).
6. Caps: DTF as priced, or embroidery at lower margin (§1, Wave 3).

---
*Draft-only. Nothing in this plan has been created, sent, signed up for,
contacted, or spent. No Printify products exist, no sales channel is
connected, no application has been sent, no money has moved.*
