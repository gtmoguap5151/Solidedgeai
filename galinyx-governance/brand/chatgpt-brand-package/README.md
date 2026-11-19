# GALINYX — ChatGPT Brand Package (DRAFT)

**Status:** Draft option only. Nothing in this folder touches the live site.
The live app still uses the Ferraris switchboard (option 60, brightened
Nov 19, 2026). This orbit-G identity would REPLACE it — that is Matt's
call, and he has not made it yet.

## Source

Matt's screenshot, shared on the voice call Nov 19, 2026:
`~/workspace/user/files/1013_0_x9n0.png` (720 x 1604, a phone screenshot
of a ChatGPT conversation). The brand board inside it is a composite
image ChatGPT made: metallic G with a blue orbit ring, GALINYX wordmark,
"BUILD • CONNECT • GROW", "THE AI OPERATING PLATFORM", logo variants on
black/white, app-icon sizes 512/256/128/96/72/48, phone mockup.

Everything here was extracted or built from that screenshot. There is no
clean source file — no vector, no standalone logo render.

## What's in here

| File | What it is |
|---|---|
| `brand-board.png` | The full ChatGPT board, cropped from the screenshot (670 x 440). Reference only. |
| `emblem-source.png` | The tightest emblem crop: metallic G + orbit ring (245 x 125). Best available mark. |
| `wordmark.png` | GALINYX wordmark + tagline + "THE AI OPERATING PLATFORM" (590 x 130). |
| `lockup-black.png` | Black-variant lockup tile (150 x 100). |
| `lockup-white.png` | White-variant lockup tile (150 x 100). |
| `lockup-horizontal.png` | Horizontal "GALINYX OS" lockup tile (198 x 100). |
| `icon-sizes-row.png` | The six size tiles as shared (512/256/128/96/72/48). |
| `app-icon-512.png` | Draft app icon, built from the emblem: deep-space canvas, radial glow, neon rim. |
| `app-icon-192.png` | Same icon at 192. |
| `app-icon-maskable-512.png` | Maskable version: no rim, emblem inside the 80% safe zone. |
| `brand-sheet.png` | Contact sheet of the whole package, with the decision note. |

## Generated set (Nov 19, 2026, ~11:50 ET)

Matt ordered the correct sizes generated individually. The emblem was
re-rendered fresh at high resolution from the emblem crop (not upscaled
from the screenshot), corners fixed to dark navy, then each size exported
as its own file from the 1600 x 1600 master:

| File | What it is |
|---|---|
| `emblem-master.png` | Fresh render, 1600 x 1600. The source for every size below. |
| `icon-512.png` | 512 x 512 (PWA manifest / store listing) |
| `icon-256.png` | 256 x 256 |
| `icon-192.png` | 192 x 192 (PWA manifest) |
| `icon-128.png` | 128 x 128 |
| `icon-96.png` | 96 x 96 |
| `icon-72.png` | 72 x 72 |
| `icon-48.png` | 48 x 48 (mild sharpen + contrast so the G holds up tiny) |
| `icon-maskable-512.png` | 512 x 512 maskable: artwork at 80% on a feathered dark backdrop |
| `favicon-32.png` / `favicon-16.png` | Favicons (sharpened) |
| `icon-sizes-row.png` | Rebuilt from the new set, true pixel sizes, left to right |

`app-icon-512.png`, `app-icon-192.png`, `app-icon-maskable-512.png`
are the earlier upscaled drafts — SUPERSEDED by the `icon-*.png` set
above. Kept in the folder for reference only.

Honest limit: at 48 px and below the G reads soft — the mark holds as
a blue/silver shape, not a crisp letter. 72 px and up carry the detail.
The raw generation file (`media-generation-emblem-master-0-*.png`) is a
local working intermediate (white corners, superseded by
`emblem-master.png`) and is NOT committed.

## Quality — honest limits

- The emblem source is **245 x 125 px**. The 512 icon upscales it ~2x.
  It reads cleanly at app-icon sizes (verified by eye), but it is NOT
  production resolution. Edges are softer than a native render.
- The lockup and size tiles are 100–200 px crops. They show the design;
  they cannot be reused at larger sizes.
- The icon's wide mark (the emblem is ~2:1 landscape) sits as a bold
  band on the square canvas. That is the shape of ChatGPT's artwork,
  not a layout choice.

## What production quality needs

The **original ChatGPT image file** — the full-resolution board Matt's
screenshot came from. From that, the emblem, wordmark, and lockups can
be extracted at full size and the icons rebuilt without upscaling. Ask
Matt to send the original image from his ChatGPT conversation (download
or share from the ChatGPT app, not a screenshot).

## The decision

Two identities now exist in draft:

1. **Ferraris switchboard (option 60)** — Matt's pick from Nov 17.
   Copper wiring on a switchboard panel tracing a hidden G. Brightened
   Nov 19. Meaning: named for Galileo Ferraris, the namesake. Currently
   the live app's logo.
2. **Orbit G (ChatGPT)** — metallic G with a blue orbit ring, space
   background, "BUILD • CONNECT • GROW". The package in this folder.

They are different brands. Picking the orbit G means replacing the
switchboard everywhere: app icons, manifest, favicon, dashboard, and
the brand story (the Ferraris meaning goes with it). Do not mix them.
