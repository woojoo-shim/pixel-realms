"""Generate a 32x32 hooded pixel-art hero for Pixel Realms.

Renders the original sprite at 1x, then exports an 8x upscale (256x256)
PNG suitable for previews, marketing shots, or import into the game.
"""

from PIL import Image

W, H = 32, 32
img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
px = img.load()

# Palette
HOOD_DK    = (28, 78, 56)      # dark hood outline
HOOD       = (52, 132, 96)     # hood body
TUNIC_DK   = (40, 110, 80)     # tunic shade
TUNIC      = (110, 231, 183)   # mint tunic (matches in-game player color)
SKIN_DK    = (148, 92, 64)     # skin shadow
SKIN       = (228, 168, 124)   # face
BELT       = (84, 52, 24)
BOOT       = (54, 32, 16)
SWORD_HILT = (102, 64, 28)
SWORD      = (232, 232, 236)
SWORD_DK   = (140, 140, 148)
SHIELD     = (160, 60, 48)
SHIELD_RIM = (74, 32, 24)
GOLD       = (252, 209, 64)
OUTLINE    = (10, 10, 14)
EYE        = (8, 8, 12)
SHADOW     = (0, 0, 0, 96)


def fill(x1, y1, x2, y2, color):
    """Inclusive rectangle fill."""
    for y in range(y1, y2 + 1):
        for x in range(x1, x2 + 1):
            if 0 <= x < W and 0 <= y < H:
                px[x, y] = color


def dot(x, y, color):
    if 0 <= x < W and 0 <= y < H:
        px[x, y] = color


# ── Soft oval shadow under feet ──────────────────────────────────────
for x in range(9, 23):
    px[x, 30] = SHADOW
for x in range(7, 25):
    px[x, 31] = SHADOW

# ── Hood (top) ───────────────────────────────────────────────────────
# Outline silhouette
fill(11, 4,  20, 4,  HOOD_DK)
fill(10, 5,  21, 5,  HOOD_DK)
fill(9,  6,  22, 6,  HOOD_DK)
fill(9,  7,  22, 7,  HOOD_DK)
fill(9,  8,  22, 8,  HOOD_DK)
fill(9,  9,  22, 9,  HOOD_DK)
fill(9,  10, 22, 10, HOOD_DK)
fill(9,  11, 22, 11, HOOD_DK)
fill(9,  12, 10, 13, HOOD_DK)   # left flap
fill(21, 12, 22, 13, HOOD_DK)   # right flap

# Hood body highlight
fill(12, 5,  19, 5,  HOOD)
fill(11, 6,  20, 6,  HOOD)
fill(10, 7,  10, 11, HOOD)
fill(21, 7,  21, 11, HOOD)

# ── Face ─────────────────────────────────────────────────────────────
fill(12, 9,  19, 13, SKIN)
fill(12, 13, 19, 13, SKIN_DK)   # jawline shadow
# Eyes
dot(13, 11, EYE)
dot(14, 11, EYE)
dot(17, 11, EYE)
dot(18, 11, EYE)

# ── Tunic torso ──────────────────────────────────────────────────────
fill(10, 14, 21, 14, OUTLINE)
fill(9,  15, 22, 15, OUTLINE)
fill(9,  16, 22, 22, TUNIC)
fill(10, 23, 21, 23, OUTLINE)
# Tunic shading (right side darker)
fill(18, 16, 22, 22, TUNIC_DK)
fill(9,  16, 9,  22, TUNIC_DK)
# Tunic neck V
fill(15, 16, 16, 17, SKIN_DK)
# Gold trim line
fill(11, 22, 20, 22, GOLD)

# ── Belt ─────────────────────────────────────────────────────────────
fill(9,  21, 22, 21, BELT)
fill(15, 21, 16, 21, GOLD)   # buckle

# ── Arms ─────────────────────────────────────────────────────────────
# Left arm + shield grip
fill(6,  16, 8,  20, TUNIC)
fill(6,  16, 6,  20, TUNIC_DK)
fill(6,  20, 8,  20, OUTLINE)
# Right arm + sword grip
fill(23, 16, 25, 20, TUNIC)
fill(25, 16, 25, 20, TUNIC_DK)
fill(23, 20, 25, 20, OUTLINE)

# ── Hands ────────────────────────────────────────────────────────────
fill(6,  19, 8,  20, SKIN)
dot(6, 20, SKIN_DK)
fill(23, 19, 25, 20, SKIN)
dot(25, 20, SKIN_DK)

# ── Shield (left side) ───────────────────────────────────────────────
# Round-ish shield
fill(2,  17, 5,  22, SHIELD)
fill(2,  17, 2,  22, SHIELD_RIM)
fill(5,  17, 5,  22, SHIELD_RIM)
fill(3,  16, 4,  16, SHIELD_RIM)
fill(3,  23, 4,  23, SHIELD_RIM)
# Cross emblem
fill(3,  18, 4,  21, GOLD)
fill(2,  19, 5,  20, GOLD)

# ── Sword (right side) ───────────────────────────────────────────────
# Hilt
fill(26, 19, 27, 20, SWORD_HILT)
# Crossguard
fill(25, 18, 28, 18, GOLD)
# Blade
fill(26, 7,  27, 17, SWORD)
fill(27, 7,  27, 17, SWORD_DK)
# Sword tip
dot(26, 6, SWORD)
dot(27, 6, SWORD_DK)
# Pommel
dot(26, 21, GOLD)
dot(27, 21, GOLD)

# ── Pants + boots ────────────────────────────────────────────────────
fill(10, 24, 14, 28, TUNIC_DK)
fill(17, 24, 21, 28, TUNIC_DK)
fill(10, 24, 10, 28, OUTLINE)
fill(14, 24, 14, 28, OUTLINE)
fill(17, 24, 17, 28, OUTLINE)
fill(21, 24, 21, 28, OUTLINE)
# Boots
fill(9,  28, 14, 29, BOOT)
fill(17, 28, 22, 29, BOOT)
fill(9,  29, 22, 29, OUTLINE)

# ── Save 1x and 8x preview ───────────────────────────────────────────
import os
out_dir = os.path.dirname(os.path.abspath(__file__))
# 1x for in-game use
img.save(os.path.join(out_dir, "..", "apps", "client", "public", "hero.png"))
# Upscaled for preview (nearest-neighbor keeps pixels crisp)
preview = img.resize((W * 8, H * 8), Image.NEAREST)
preview_path = os.path.abspath(os.path.join(out_dir, "..", "hero-preview.png"))
preview.save(preview_path)

print(f"32x32:  apps/client/public/hero.png")
print(f"256x256 preview: {preview_path}")
