#!/usr/bin/env python3
"""GALINYX workers diagram — 15 operators, grouped by environment.
Names, environments, and modes match governance-core/src/operators.json exactly
(verified 2026-11-18: blackpine-field 10, rivet-reach 2, galinyx-workforce 3)."""
from PIL import Image, ImageDraw, ImageFont

FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONTB = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

BG = (8, 12, 24)
CARD = (17, 26, 45)
CARD_BORDER = (42, 58, 95)
GOLD = (233, 199, 122)
BLUE = (167, 188, 255)
TEXT = (232, 236, 245)
MUTED = (139, 152, 184)
GREEN = (127, 212, 168)
BAND_AMBER = (38, 30, 12)
BAND_BLUE = (14, 26, 52)

W = 1600
MARGIN = 48
GUTTER = 28
COLW = (W - 2 * MARGIN - 2 * GUTTER) // 3  # 482
GAP = 16
CARD_ORIG_H = 138
CARD_NEW_H = 176


def font(path, size):
    return ImageFont.truetype(path, size)


def fit_text(draw, text, path, size, max_w, min_size=22):
    """Shrink font until text fits max_w."""
    while size > min_size:
        f = font(path, size)
        if draw.textlength(text, font=f) <= max_w:
            return f
        size -= 2
    return font(path, min_size)


# (name, role, mode, named_by_or_note)
# Modes and names copied from operators.json. Roles are one-line summaries.
COLUMNS = [
    ("BLACKPINE FIELD", "10 workers", [
        ("Blackpine Operator", "Runs the store", "draft-only", None),
        ("Affiliate Operator", "Watches the affiliate pipeline", "read-only-advisory", None),
        ("Black Friday Operator", "Black Friday deals & countdown", "read-only-advisory", None),
        ("Content Operator", "Reels & posts that drive traffic", "read-only-advisory", None),
        ("The Tailor", "Clothing & apparel", "draft-only", None),
        ("The Closer", "Turns visitors into sales", "draft-only", "Named by Blackpine Operator"),
        ("The Handshake", "Chases affiliate approvals", "draft-only", "Named by Affiliate Operator"),
        ("The Proof", "Proves every deal price", "draft-only", "Named by Black Friday Operator"),
        ("The Mirror", "Shows what reels really did", "draft-only", "Named by Content Operator"),
        ("The Shuttle", "Suppliers & fulfillment", "draft-only", "Named by The Tailor"),
    ]),
    ("RIVET REACH", "2 workers", [
        ("Rivet Reach Operator", "Contractor matching", "draft-only", None),
        ("The Hearth", "Finds homeowners & jobs", "draft-only", "Named by Rivet Reach Operator"),
    ]),
    ("GALINYX WORKFORCE", "3 workers", [
        ("Galileo Ferraris", "Builds & teaches", "draft-only", None),
        ("Finance Brother", "Numbers & money", "draft-only", "Unnamed — Galileo names him"),
        ("Prova", "Tests what Galileo builds", "draft-only", "Named by Galileo Ferraris"),
    ]),
]

# --- height computation ---
HEADER_H = 210
MATT_H = 118
ARROW_H = 44
CORE_H = 150
BAND_H = 92
BAND_GAP = 14
ENV_H = 76
FOOTER_H = 80

col_heights = []
for _, _, ops in COLUMNS:
    h = sum(CARD_NEW_H if nb else CARD_ORIG_H for *_, nb in ops) + GAP * (len(ops) - 1)
    col_heights.append(h)
COLS_H = max(col_heights)

H = (MARGIN + HEADER_H + 24 + MATT_H + ARROW_H + CORE_H + 24
     + BAND_H + BAND_GAP + BAND_H + 28 + ENV_H + COLS_H + 24 + FOOTER_H + MARGIN)

img = Image.new("RGB", (W, H), BG)
d = ImageDraw.Draw(img)

y = MARGIN
# --- title ---
f_title = font(FONTB, 62)
d.text((W // 2, y), "GALINYX WORKFORCE", font=f_title, fill=GOLD, anchor="ma")
y += 78
f_sub = font(FONT, 34)
d.text((W // 2, y), "15 operators  ·  3 environments  ·  Nov 18, 2026",
       font=f_sub, fill=BLUE, anchor="ma")
y += 52
f_note = font(FONT, 28)
d.text((W // 2, y), "Every worker is draft-only unless marked — nothing publishes or spends without the owner.",
       font=f_note, fill=MUTED, anchor="ma")
y += 62

# --- Matt card ---
mx0, mx1 = W // 2 - 430, W // 2 + 430
d.rounded_rectangle([mx0, y, mx1, y + MATT_H], radius=18, fill=CARD, outline=GOLD, width=4)
f_matt = font(FONTB, 40)
d.text((W // 2, y + 16), "MATT JOHNSON — OWNER", font=f_matt, fill=GOLD, anchor="ma")
f_mattsub = font(FONT, 28)
d.text((W // 2, y + 68), "Approves every publish, spend & mode change",
       font=f_mattsub, fill=TEXT, anchor="ma")
y += MATT_H

# --- arrow Matt -> Core ---
cx = W // 2
d.line([cx, y + 4, cx, y + ARROW_H - 8], fill=GOLD, width=4)
d.polygon([(cx, y + ARROW_H), (cx - 12, y + ARROW_H - 16), (cx + 12, y + ARROW_H - 16)], fill=GOLD)
y += ARROW_H

# --- Governance Core card ---
cx0, cx1 = W // 2 - 560, W // 2 + 560
d.rounded_rectangle([cx0, y, cx1, y + CORE_H], radius=18, fill=CARD, outline=BLUE, width=4)
f_core = font(FONTB, 38)
d.text((W // 2, y + 14), "GOVERNANCE CORE  ·  v1.3.0", font=f_core, fill=BLUE, anchor="ma")
f_coresub = font(FONT, 28)
d.text((W // 2, y + 64), "5 rules  ·  every decision audit-logged",
       font=f_coresub, fill=TEXT, anchor="ma")
d.text((W // 2, y + 100), "One environment per worker  ·  modes gate every action",
       font=f_coresub, fill=MUTED, anchor="ma")
y += CORE_H + 24

# --- connective bands ---
def band(y0, fill, border, title, body):
    d.rounded_rectangle([MARGIN, y0, W - MARGIN, y0 + BAND_H], radius=14, fill=fill, outline=border, width=2)
    ft = font(FONTB, 30)
    fb = font(FONT, 27)
    d.text((MARGIN + 28, y0 + 12), title, font=ft, fill=GOLD)
    d.text((MARGIN + 28, y0 + 50), body, font=fb, fill=TEXT)

band(y, BAND_AMBER, GOLD,
     "INTERACTION LAYER — workers talk to each other",
     "Messages & handoffs (ASK / HANDOFF / NOTICE) · same environment · handoffs never transfer permission")
y += BAND_H + BAND_GAP
band(y, BAND_BLUE, BLUE,
     "NOTIFICATIONS — alerts go up to Matt",
     "A worker needs approval → the Core alerts the owner → only the owner decides (Approve / Deny)")
y += BAND_H + 28

# --- environment headers + columns ---
xs = [MARGIN + i * (COLW + GUTTER) for i in range(3)]
f_env = font(FONTB, 34)
f_envn = font(FONT, 28)
for i, (env, count, ops) in enumerate(COLUMNS):
    d.text((xs[i] + COLW // 2, y), env, font=f_env, fill=GOLD, anchor="ma")
    d.text((xs[i] + COLW // 2, y + 40), count, font=f_envn, fill=MUTED, anchor="ma")
y += ENV_H

for i, (env, count, ops) in enumerate(COLUMNS):
    cy = y
    for name, role, mode, note in ops:
        h = CARD_NEW_H if note else CARD_ORIG_H
        x0, x1 = xs[i], xs[i] + COLW
        d.rounded_rectangle([x0, cy, x1, cy + h], radius=14, fill=CARD, outline=CARD_BORDER, width=2)
        if note and note.startswith("Named by"):
            d.rounded_rectangle([x0, cy, x0 + 10, cy + h], radius=5, fill=GOLD)
        inner = COLW - 56
        fn = fit_text(d, name, FONTB, 36, inner)
        d.text((x0 + 28, cy + 14), name, font=fn, fill=TEXT)
        fr = fit_text(d, role, FONT, 28, inner)
        d.text((x0 + 28, cy + 58), role, font=fr, fill=MUTED)
        if mode == "draft-only":
            d.text((x0 + 28, cy + 94), "●  DRAFT-ONLY", font=font(FONTB, 25), fill=GOLD)
        else:
            d.text((x0 + 28, cy + 94), "●  READ-ONLY ADVISORY", font=font(FONTB, 25), fill=BLUE)
        if note:
            fnb = fit_text(d, note, FONT, 26, inner)
            d.text((x0 + 28, cy + 128), note, font=fnb, fill=GOLD)
        cy += h + GAP

y += COLS_H + 24
# --- footer ---
f_foot = font(FONT, 27)
d.text((W // 2, y), "Core v1.3.0  ·  Stress test 80 PASS / 0 FAIL  ·  7 new workers built tonight (local only)",
       font=f_foot, fill=MUTED, anchor="ma")

out = "/home/hatch/workspace/galinyx-governance/workers-diagram-2026-11-18.png"
img.save(out)
print("saved", out, img.size)
