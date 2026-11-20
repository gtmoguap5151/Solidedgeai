Written by: The Content Operator
Date: Nov 20, 2026
Status: APPROVED
Decided: Direction A APPROVED by Matt, Nov 20, 2026 ~09:42 ET ("I think A"). Direction C REJECTED ~09:40 ET ("No" while viewing it). Direction B set aside, not rejected.
Type: Storefront redesign — 3 finished directions as full-page mockups for Matt's pick. Nothing live, nothing built on the store.

## In plain English

- **What this is:** Three new looks for the front of the Blackpine Field store, drawn as full-page pictures. Matt picks one — or mixes them — and only then does anything get built. Nothing on the live store changes until he says so.
- **Where it came from:** Matt sent a ChatGPT concept (luxury outdoor editorial — dark charcoal, cream type, big photos) and said "I want it to look expensive," with customers seeing hero, collections, and featured products all together. Direction A is that concept, rebuilt with the store's REAL products and prices. Directions B and C are ours.
- **What is real here:** Every product name, price, and photo in these mockups comes from the live store or the Black Friday page. The ChatGPT screenshot's products and prices (Field Jacket $279, Summit Sweater $129, Ridge Vest $185, Pine Cap $34) were invented — none of them appear anywhere in these mockups.
- **What stays in all three:** the True Pine line, the Black Friday shelf (92 deals), the price buttons, the locked mark (symmetric Faceted Pine + BLACKPINE + ROOTS RAN DEEP), and 120 products across 12 departments.
- **What Matt needs to decide:** Pick A, B, or C — or tell us what to mix. Nothing goes live until he picks.

---

Photo: ~/workspace/blackpine-field/brand/storefront/storefront-a-luxury-editorial.png
Photo: ~/workspace/blackpine-field/brand/storefront/storefront-b-morning-porch-elevated.png
Photo: ~/workspace/blackpine-field/brand/storefront/storefront-c-field-catalog.png

## Direction A — Luxury Outdoor Editorial (the screenshot, made real)

Photo: ~/workspace/blackpine-field/brand/storefront/storefront-a-luxury-editorial.png

The ChatGPT direction, rebuilt with real store content. Dark charcoal navigation and footer, cream serif headlines, the misty-pines hero photo full-bleed with the headline over it: "Built for the field. Judged on the numbers." Amber accents throughout. Hero, five department tiles, the True Pine line, a dark Black Friday door-buster band, and featured products — all on one page, the combination Matt asked for.

- **Feels like:** a premium outfitter's flagship page. The most "expensive" of the three.
- **Watch-out:** the darkest of the three. The cream sections keep it from going cold, but Granny reads it on a bright screen — the cream body text on charcoal is high-contrast by design.
- **Changes from today:** everything about the frame — charcoal nav, serif display type, amber rules, editorial spacing. The store's current Morning Porch look is replaced, not kept.

## Direction B — Morning Porch, Elevated (bright and expensive)

Photo: ~/workspace/blackpine-field/brand/storefront/storefront-b-morning-porch-elevated.png

The same page structure as A, but bright: warm cream background, pine-green navigation and footer, amber buy buttons, soft rounded cards with gentle shadows. The hero carries a bright white welcome card over the pines: "Come in. Stay a while." — deer season is open, and the porch light is on.

- **Feels like:** the store Matt already has, grown up. Expensive through restraint and light, not darkness.
- **Granny test:** the strongest of the three — bright, warm, easy to read, nothing hidden in dark bands except the photography itself.
- **Changes from today:** the layout and typography go editorial (serif headlines, letterspaced kickers, generous whitespace), but the bright, welcoming feel of the current store is kept and sharpened.

## Direction C — The Field Catalog (genuinely different) — REJECTED by Matt, Nov 20 ~09:40 ET

Photo: ~/workspace/blackpine-field/brand/storefront/storefront-c-field-catalog.png

Not a web page that looks like a web page — a premium outfitter's catalog. Newspaper-style masthead ("BLACKPINE FIELD" across the top, "THE FIELD CATALOG · VOL. I · NOVEMBER 2026"), ruled hairlines, numbered sections: Nº 01 The True Pine Line (big tee photo, dotted-leader price list for all seven pieces), Nº 02 Black Friday (ninety-two deals, door-busters as ruled list entries), Nº 03 Field picks, Nº 04 the full 12-department index.

- **Feels like:** something you'd keep on the coffee table. The most distinctive — nobody else's store looks like this.
- **Watch-out:** the biggest departure from how the store works today. The list-style entries suit the True Pine line and Black Friday well; the full 120-product catalog would need the same treatment section by section.
- **Changes from today:** the whole structure — masthead, numbered sections, price lists instead of cards. The content is identical; the frame is new.

## What is real in every mockup

- **True Pine line:** Tee $27.99, Long-Sleeve $34.99, Hoodie $54.99, Crewneck $44.99, Trucker Cap $34.99, Dad Cap $34.99, Mug $19.99 — from the live store cards. Pants shown as "coming soon, not for sale yet" with no price, as on the live store.
- **Featured products:** Piscifun AlinoX 300 $109.99, ALLPOWERS S2000 Pro $664.05 (was $1,399.00), TideWe ThermCore Heated Vest $109.99, MeoWant SC09 $645.99 — verified live prices.
- **Door-busters:** EcoFlow DELTA 3 Max $759.05, YETI Roadie 48 $297.50, Anker SOLIX C1000 Gen 2 + Alternator Charger $879.98 — from the live Black Friday page (92 deals).
- **Counts:** 120 products, 12 departments, deer season open — from the live store.
- **Photos:** the store's own hero photo, real product photos from the store, and the Tailor's real True Pine mockups. No image was generated for any product, and no product image was faked. No face, no footage, no likeness of Matt anywhere.
- **The dead tagline** ("Gear judged under load") appears nowhere. The locked mark (symmetric Faceted Pine + BLACKPINE + ROOTS RAN DEEP) is on every page.

## What changes from today's store (all directions)

- The frame: navigation, typography, spacing, and section order are redesigned. Today's Morning Porch / Real Photo Hero look is replaced by the picked direction.
- The front page becomes one composed page — hero, collections, True Pine line, Black Friday shelf, featured products — instead of the current long department-by-department scroll. The departments themselves stay; they move below the fold and keep their own sections.
- Nothing about what sells changes: same products, same prices, same links, same price buttons.

## Build notes (for whoever builds the picked direction)

- Mockups are 1280px wide, desktop layout. The builder script re-renders all three from the same real content: ~/workspace/blackpine-field/brand/storefront/src/build_storefront_mockups.py
- The headless-Chrome route was blocked on this machine (the installed Chromium refuses to start outside the Hatch browser harness), so the mockups were composed directly from real photos with PIL — which is also why every price and product name is exact, not generated.
- Mobile layout is not mocked here — whichever direction Matt picks, the build needs a phone-width pass before it goes live.

---

Order: governance-core/orders/order-2026-11-20-storefront-redesign.md (owner's chat instruction, Nov 20, 2026 ~09:21 ET; audit seq 107).
