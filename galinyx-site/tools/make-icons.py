#!/usr/bin/env python3
"""Generate GALINYX OS PWA icons from the chosen logo (option 60).

Chrome requires raster (PNG) icons for installability; a manifest with only
an SVG icon makes phones report "app cannot be installed". The chosen logo
is the Ferraris switchboard: copper wiring on a vintage switchboard panel
tracing a hidden G. The source is stored as base64 text
(logo-source-bright.b64, next to this script) so the repo stays text-only
(no binary files committed); this script decodes and resizes it at
deploy time.

The brightened source (Nov 19, 2026) is the same option-60 artwork with a
gamma lift — the owner said the original was too dark to see. The original
dark source is preserved untouched in logo-source.b64.

Run by the Pages workflow before upload. Outputs, next to galinyx-site/:
  icon-192.png, icon-512.png, icon-maskable-512.png
"""

import base64
import io
import os

from PIL import Image

BG = (56, 56, 59)  # #38383b, the brightened tile background (was #18181a)


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    out_dir = os.path.dirname(here)

    with open(os.path.join(here, "logo-source-bright.b64"), "r") as f:
        raw = base64.b64decode(f.read())
    src = Image.open(io.BytesIO(raw)).convert("RGB")

    # Standard icons: the full logo tile, resized.
    img512 = src.resize((512, 512), Image.LANCZOS)
    img512.save(os.path.join(out_dir, "icon-512.png"))
    img512.resize((192, 192), Image.LANCZOS).save(
        os.path.join(out_dir, "icon-192.png")
    )

    # Maskable: full-bleed opaque square, artwork at 80% (safe zone).
    m = Image.new("RGB", (512, 512), BG)
    art = src.resize((410, 410), Image.LANCZOS)
    m.paste(art, (51, 51))
    m.save(os.path.join(out_dir, "icon-maskable-512.png"))

    print("icons written:", sorted(
        f for f in os.listdir(out_dir)
        if f.startswith("icon-") and f.endswith(".png")
    ))


if __name__ == "__main__":
    main()
