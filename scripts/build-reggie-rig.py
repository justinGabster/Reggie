"""
Builds Reggie's animation rig from the final character art.

Input : design/mockups/sprites/front.png   (uncut full-body front view, cut from the character sheet)
Output: public/reggie/rig/{base,earL,earR,tail,ball}.png  (same canvas size, stacked in the browser)
        src/components/reggie/rigData.ts                  (coordinates for the live SVG face)

What it does:
  - ears, tail and ball become separate layers so they can wag / sway / fly;
    their hidden parts (under the head, body or thigh) are filled so rotation never shows gaps
  - eyes, eyebrows and mouth are erased from the base (filled from the surrounding fur/muzzle)
    and redrawn in SVG by <Reggie>, so pupils can follow the cursor and every mood is a real expression
  - the ground shadow is removed and redrawn as an SVG ellipse (it stays on the ground when he jumps)

Run:  python -P scripts/build-reggie-rig.py      (needs pillow, numpy, scipy)
"""
import json
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "design/mockups/sprites/front.png"
OUT = ROOT / "public/reggie/rig"
TS = ROOT / "src/components/reggie/rigData.ts"
OUT.mkdir(parents=True, exist_ok=True)

rgba = np.array(Image.open(SRC).convert("RGBA")).astype(np.int32)
H, W = rgba.shape[:2]
r, g, b, a = (rgba[..., i] for i in range(4))
yy, xx = np.mgrid[0:H, 0:W]
opaque = a > 40
anyalpha = a > 0


def largest(mask):
    lab, n = ndi.label(mask)
    if n == 0:
        return mask
    sizes = ndi.sum(mask, lab, range(1, n + 1))
    return lab == (int(np.argmax(sizes)) + 1)


def nn_fill(img, hole, source):
    """Fill `hole` pixels with the colour of the nearest `source` pixel (good for flat vector art)."""
    out = img.copy()
    _, (iy, ix) = ndi.distance_transform_edt(~source, return_indices=True)
    out[hole] = img[iy[hole], ix[hole]]
    return out


def grow_edge(mask, steps, exclude):
    """Include the soft anti-aliased fringe around a part (pixels with any alpha), but not `exclude`."""
    return mask | (ndi.binary_dilation(mask, iterations=steps) & anyalpha & ~exclude)


light_fur = opaque & (r > 132) & (g > 75)            # head / body fur and lighter
cream = opaque & (r > 230) & (g > 195) & (b > 150)

# ---------------------------------------------------------------- ears (behind the head)
dark_brown = opaque & (r >= 35) & (r <= 132) & (g <= 82) & (b <= 60) & (r > b + 15) & (yy < 140)
lab, n = ndi.label(dark_brown)
ear = np.zeros_like(opaque)
for i in range(1, n + 1):
    m = lab == i
    if m.sum() >= 150 and (xx[m].min() < 30 or xx[m].max() > W - 30):
        ear |= m
ear = ndi.binary_closing(ear, iterations=2) & opaque
# drop thin strands (the head's dark rim along the cheek touches the ear)
ear = ndi.binary_opening(ear, iterations=3)
earL = largest(ear & (xx < W // 2))
earR = largest(ear & (xx >= W // 2))
earL = grow_edge(earL, 2, light_fur | earR)
earR = grow_edge(earR, 2, light_fur | earL)

# ---------------------------------------------------------------- tail (behind the right thigh)
tail_zone = opaque & (xx > 186) & (yy > 145) & (yy < 232)
tail = tail_zone & (((r > 230) & (g > 200)) | ((r < 132) & (g < 82)))
tail = largest(ndi.binary_closing(tail, iterations=2) & opaque)
tail = grow_edge(tail, 2, light_fur & (xx < 190))

# ---------------------------------------------------------------- ball (behind the left thigh)
BALL = dict(cx=33.5, cy=216.5, r=27.0)
in_ball = (xx - BALL["cx"]) ** 2 + (yy - BALL["cy"]) ** 2 <= BALL["r"] ** 2
ball_px = in_ball & opaque & (
    ((r > 180) & (g < 135) & (b < 60))                     # orange
    | ((r < 130) & (g < 50) & (b < 40) & (r > g))          # seams
    | ((r > 235) & (g > 235) & (b > 235))                  # shine
)
ball_px = largest(ndi.binary_closing(ball_px, iterations=1)) & in_ball
ball_visible = grow_edge(ball_px, 1, light_fur | ~in_ball)

# ---------------------------------------------------------------- ground shadow
shadow = anyalpha & (yy > 225) & (r > 150) & (g > 100) & (g < 190) & (b < 60)
shadow = grow_edge(shadow, 2, light_fur | cream | in_ball)
sy, sx = np.nonzero(shadow & opaque)
SHADOW = dict(cx=round(float(sx.min() + sx.max()) / 2, 1), cy=round(float(sy.min() + sy.max()) / 2, 1),
              rx=round(float(sx.max() - sx.min()) / 2, 1), ry=round(float(sy.max() - sy.min()) / 2, 1))
shadow_rgb = np.median(rgba[shadow & opaque][:, :3], axis=0).astype(int)

# ---------------------------------------------------------------- face features to erase
white = opaque & (r > 232) & (g > 232) & (b > 228) & (yy < 110)
dark = opaque & (r < 70) & (g < 70) & (b < 90)
eyes = []
face_hole = np.zeros_like(opaque)
for x0, x1 in [(60, 116), (118, 176)]:
    box = (xx >= x0) & (xx <= x1) & (yy >= 36) & (yy <= 100)
    pupil = ndi.binary_fill_holes(largest(dark & box))
    eye = largest(ndi.binary_fill_holes((white | pupil) & box))
    ey, ex = np.nonzero(eye)
    py, px = np.nonzero(pupil)
    eyes.append(dict(
        cx=round((ex.min() + ex.max()) / 2, 1), cy=round((ey.min() + ey.max()) / 2, 1),
        rx=round((ex.max() - ex.min() + 1) / 2, 1), ry=round((ey.max() - ey.min() + 1) / 2, 1),
        px=round(float(px.mean()), 1), py=round(float(py.mean()), 1),
        pr=round((px.max() - px.min() + py.max() - py.min() + 2) / 4, 1),
    ))
    face_hole |= ndi.binary_dilation(eye, iterations=2)

black = opaque & (r < 60) & (g < 60) & (b < 70)
brow = black & (yy >= 18) & (yy <= 38) & (xx > 64) & (xx < 172)
mouth = black & (yy >= 111) & (yy <= 127) & (xx > 95) & (xx < 142)
eye_hole = face_hole.copy()
brow_hole = ndi.binary_dilation(brow, iterations=2)
mouth_hole = ndi.binary_dilation(mouth, iterations=2)
face_hole |= brow_hole | mouth_hole
face_hole &= opaque
eye_hole &= opaque
FUR = np.median(rgba[(yy > 40) & (yy < 50) & (xx > 112) & (xx < 124) & opaque][:, :3], axis=0).astype(int)
MUZZLE = np.median(rgba[(yy > 124) & (yy < 134) & (xx > 100) & (xx < 136) & opaque][:, :3], axis=0).astype(int)

# ---------------------------------------------------------------- compose layers
canvas = rgba.copy()

# base: remove ears, tail, ball, shadow; erase face features
base = canvas.copy()
# The head/body keep a 3px rim of whatever touches them (ear/tail edge pixels). The part layers also
# contain those pixels, so at rest nothing changes; when an ear sways, the head keeps a clean edge
# instead of opening a see-through seam.
core = largest(light_fur & (a == 255) & (b > 25) & ~(earL | earR | tail | ball_visible | shadow))
rim = ndi.binary_dilation(core, iterations=3)
remove = ((earL | earR | tail) & ~rim) | ball_visible | shadow
base[remove] = 0
base[..., :3][eye_hole | (brow_hole & opaque)] = FUR
base[..., :3][mouth_hole & opaque] = MUZZLE
base[..., 3][face_hole] = 255
# soften the seam between the flat fill and the painted fur (1px blur on the ring only)
ring_px = ndi.binary_dilation(face_hole, iterations=1) & ~ndi.binary_erosion(face_hole, iterations=1) & opaque
blurred = np.stack([ndi.uniform_filter(base[..., i].astype(float), size=3) for i in range(3)], -1)
base[..., :3][ring_px] = blurred[ring_px].astype(np.int32)

# strip the faint anti-aliased fringe the removed parts left behind
near_removed = ndi.binary_dilation(remove, iterations=4) & ~remove
base[near_removed & (base[..., 3] < 120)] = 0
# leftover ball seams / orange specks around where the ball was
br, bg_, bb = base[..., 0], base[..., 1], base[..., 2]
ball_zone = ndi.binary_dilation(in_ball, iterations=4)
ball_bits = ball_zone & (base[..., 3] > 0) & (
    ((br > 170) & (bg_ < 135) & (bb < 70) & (br - bg_ > 70))      # orange
    | ((br < 135) & (bg_ < 60) & (bb < 45) & (br > bg_ + 20))     # dark seams
)
base[ball_bits] = 0
lab_b, n_b = ndi.label(base[..., 3] > 0)
if n_b > 1:
    sizes_b = ndi.sum(base[..., 3] > 0, lab_b, range(1, n_b + 1))
    keep = np.isin(lab_b, [i + 1 for i, sz in enumerate(sizes_b) if sz >= 40])
    base[~keep] = 0


def part_layer(mask, extend_into, steps, max_y=None, min_y=None):
    """The part's pixels, plus a filled extension under whatever covers it (hidden at rest)."""
    layer = np.zeros_like(canvas)
    layer[mask] = canvas[mask]
    ext = ndi.binary_dilation(mask & opaque, iterations=steps) & extend_into & ~mask
    if max_y is not None:
        ext &= yy < max_y
    if min_y is not None:
        ext &= yy > min_y
    if ext.any():
        solid = mask & (a == 255) & ~ndi.binary_dilation(~mask, iterations=2)
        colour = np.median(canvas[solid if solid.any() else mask][:, :3], axis=0).astype(int)
        layer[..., :3][ext] = colour
        layer[..., 3][ext] = 255
        # pixels along the part's inner edge: make them opaque in the part colour so no fringe shows
        inner = mask & ndi.binary_dilation(ext, iterations=1) & (a < 255)
        layer[..., :3][inner] = colour
        layer[..., 3][inner] = 255
    return layer


head_or_body = opaque & ~(earL | earR | tail | ball_visible | shadow)
# only extend near the attachment point; lower down the ear swings away from the head instead
L_earL = part_layer(earL, head_or_body, 12, max_y=int(np.nonzero(earL)[0].min()) + 42)
L_earR = part_layer(earR, head_or_body, 12, max_y=int(np.nonzero(earR)[0].min()) + 42)
L_tail = part_layer(tail, head_or_body, 12, min_y=int(np.nonzero(tail)[0].max()) - 26)

# ball: full circle, hidden part filled from the visible ball, anti-aliased edge
L_ball = np.zeros_like(canvas)
fill_ball = nn_fill(canvas, in_ball & ~ball_px, ball_px)
L_ball[in_ball] = fill_ball[in_ball]
dist = np.sqrt((xx + 0.5 - BALL["cx"]) ** 2 + (yy + 0.5 - BALL["cy"]) ** 2)
edge_alpha = np.clip((BALL["r"] + 0.5 - dist) * 255, 0, 255)
ring = (dist > BALL["r"] - 1) & (dist < BALL["r"] + 1)
L_ball[..., 3] = np.where(in_ball | ring, edge_alpha, 0)
L_ball[ring & ~in_ball, :3] = fill_ball[ring & ~in_ball, :3] if (ring & ~in_ball).any() else 0

for name, arr in [("base", base), ("earL", L_earL), ("earR", L_earR), ("tail", L_tail), ("ball", L_ball)]:
    Image.fromarray(arr.clip(0, 255).astype(np.uint8), "RGBA").save(OUT / f"{name}.png", optimize=True)


# ---------------------------------------------------------------- pivots
def top_attach(mask, side):
    ys, xs = np.nonzero(mask)
    top = ys.min()
    row = xs[ys <= top + 6]
    return (float(row.max() if side == "L" else row.min()) - (4 if side == "L" else -4), float(top + 10))


ty, tx = np.nonzero(tail)
rig = {
    "width": W,
    "height": H,
    "eyes": eyes,
    "brows": {
        "L": "M74 32 Q88 21 102 28",
        "R": "M133 28 Q147 21 163 32",
    },
    "mouth": {"cx": 118.5, "cy": 118},
    "furColor": "#%02X%02X%02X" % tuple(int(v) for v in np.median(rgba[(yy > 40) & (yy < 50) & (xx > 112) & (xx < 124) & opaque][:, :3], axis=0)),
    "shadow": {**SHADOW, "color": "#%02X%02X%02X" % tuple(int(v) for v in shadow_rgb)},
    "ball": BALL,
    "pivots": {
        "earL": top_attach(earL, "L"),
        "earR": top_attach(earR, "R"),
        "tail": (float(tx.min()) + 6, float(ty.max()) - 4),
        "body": (W / 2, float(SHADOW["cy"])),
    },
}
TS.write_text(
    "// Generated by scripts/build-reggie-rig.py — do not edit by hand.\n"
    "export const RIG = " + json.dumps(rig, indent=2) + " as const;\n",
    encoding="utf-8",
)
print(json.dumps(rig, indent=1))
