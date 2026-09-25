"""Cut Peachi's four expression faces out of Character_Sheet_1_Peachi.png into face textures.

Each face is aligned by its eye catch-lights onto the model's face canvas (1024 px = 0.17 m, see
FACE_WINDOW in js/peachi/face.js), masked to skin + features (no drawn hair outside the eyes, nothing
outside the 3D face outline) and written to assets/peachi/face_<expression>.webp.

Usage (from the repo root): python3 tools/extract_face_art.py   (needs Pillow, numpy, scipy)
"""
import cmath
import os

import numpy as np
from PIL import Image
from scipy import ndimage

Image.MAX_IMAGE_PIXELS = None
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHEET = os.path.join(ROOT, 'Character_Sheet_1_Peachi.png')
OUT = os.path.join(ROOT, 'assets', 'peachi')

N = 1024
PX = N / 0.17                      # canvas px per meter
Y1 = 1.515                         # model height at canvas row 0
EYE_Y, EYE_DX, E = 410, 208, 416   # model eye centers (canvas px) and eye spacing
# Cyan catch-light dot of each eye on the sheet (found by color; the scream face has none, its head is
# the same drawing as the angry one, one sheet row lower).
ANCHORS = {
    'happy': ((1056.6, 1179.4), (1248.6, 1186.0)),
    'cry': ((5876.4, 1381.7), (6113.0, 1373.4)),
    'angry': ((5876.4, 3046.7), (6113.0, 3038.4)),
    'scream': ((5876.4, 4685.0), (6113.0, 4676.7)),
}
DOT = (-0.05 * E, -0.067 * E)      # catch-light position relative to the eye center
# half-width of the 3D face by height (keep in sync with HEAD_RINGS Wf in js/peachi/model.js)
FACE_W = [(1.3635, 0.0), (1.369, 0.009), (1.376, 0.022), (1.386, 0.0365), (1.4, 0.047), (1.41, 0.05),
          (1.422, 0.055), (1.435, 0.0605), (1.447, 0.066), (1.475, 0.069), (1.505, 0.073)]


def face_half_width(y):
    xs, ws = zip(*FACE_W)
    return float(np.interp(y, xs, ws))


def align(src, anchors):
    """Similarity transform mapping the two catch-lights onto the model's eye positions."""
    (ax, ay), (bx, by) = anchors
    ta = complex(512 - EYE_DX + DOT[0], EYE_Y + DOT[1])
    tb = complex(512 + EYE_DX + DOT[0], EYE_Y + DOT[1])
    za, zb = complex(ax, ay), complex(bx, by)
    s = (tb - ta) / (zb - za)
    inv = 1 / s
    a_, b_, c_, d_ = inv.real, -inv.imag, inv.imag, inv.real
    tx = za.real - (a_ * ta.real + b_ * ta.imag)
    ty = za.imag - (c_ * ta.real + d_ * ta.imag)
    return src.transform((N, N), Image.AFFINE, (a_, b_, tx, c_, d_, ty), resample=Image.BICUBIC)


def center_lower_face(img, dx_chin):
    """Shift rows below the eyes sideways (0 at the eye line → dx_chin at the chin) to center a turned face."""
    a = np.array(img)
    out = a.copy()
    for y in range(EYE_Y, N):
        t = min(1.0, (y - EYE_Y) / (914 - EYE_Y))
        sh = int(round(dx_chin * (t * t * (3 - 2 * t))))
        if sh:
            out[y] = np.roll(a[y], sh, axis=0)
    return Image.fromarray(out)


# how far the lashes reach above the eye center (the shocked eyes open much wider)
EYE_TOP = {'happy': 106, 'cry': 106, 'angry': 104, 'scream': 124}
# eyes drawn without a liner wing on one side, where a hair lock crosses the face instead: {side: max |dx|}
EYE_OUTER = {'scream': {1: 72}}


def build_mask(rgb, name):
    r, g, b = [rgb[..., i].astype(int) for i in range(3)]
    skin = (r > 205) & (g > 140) & (b > 120) & (r - b < 110) & (r - g < 90)
    skin = ndimage.binary_opening(skin, iterations=2)
    yy, xx = np.mgrid[0:N, 0:N]
    eyes = np.zeros((N, N), bool)
    for s in (-1, 1):   # eye regions incl. lashes, wing and tears; tight above the lashes (drawn hair there)
        cx, cy = 512 + s * EYE_DX, EYE_Y + 10
        ry = np.where(yy < cy, EYE_TOP[name], 112.0)
        one = ((xx - cx) / 152.0) ** 2 + ((yy - cy) / ry) ** 2 <= 1
        one |= ((xx - (cx + s * 142)) / 34.0) ** 2 + ((yy - (EYE_Y - 8)) / 26.0) ** 2 <= 1   # liner wing
        if s in EYE_OUTER.get(name, {}):
            one &= s * (xx - cx) <= EYE_OUTER[name][s]
        eyes |= one
    face = skin | eyes
    lab, _ = ndimage.label(face)
    face = lab == lab[640, 512]
    face = ndimage.binary_closing(face, iterations=6)
    face = ndimage.binary_fill_holes(face)
    # stay inside the 3D face outline (the texture would smear onto the sides of the head otherwise)
    heights = Y1 - (yy + 0.5) / PX
    limit = np.vectorize(face_half_width)(heights[:, 0])[:, None] * PX - 5
    inside = np.abs(xx - 512) <= limit
    lower = face & inside & (heights < 1.447)
    upper = ((skin & inside) | eyes) & (heights >= 1.447) & (heights < 1.458)   # no filled-in hair up here
    region = lower | upper | eyes
    feats = eyes.copy()
    feats |= find_mouth(r, g, b, xx, yy)
    feats |= ((xx - 516) / 34.0) ** 2 + ((yy - 548) / 48.0) ** 2 <= 1          # nose
    # wide feather at the outline so the drawn skin melts into the 3D skin; features stay crisp
    outer = ndimage.gaussian_filter(ndimage.binary_erosion(region, iterations=4).astype(float), 6.0)
    outer = np.clip((outer - 0.1) / 0.8, 0, 1)
    return np.maximum(outer, ndimage.gaussian_filter((feats & region).astype(float), 1.5)), feats


def find_mouth(r, g, b, xx, yy):
    """The drawn mouth: the non-skin blob (lips, inside, teeth, outline) around the mouth position."""
    skin = (r > 200) & (g > 145) & (b > 130) & (r - b < 110)
    white = (np.minimum(np.minimum(r, g), b) > 215) & (np.abs(r - b) < 30)   # teeth
    area = ((xx - 512) / 170.0) ** 2 + ((yy - 720) / 165.0) ** 2 <= 1
    lab, n = ndimage.label((~skin | white) & area)
    near = (((xx - 512) / 70.0) ** 2 + ((yy - 712) / 70.0) ** 2 <= 1)
    sizes = ndimage.sum(near, lab, range(1, n + 1))
    mouth = lab == 1 + int(np.argmax(sizes))
    return ndimage.binary_dilation(ndimage.binary_fill_holes(mouth), iterations=4)


def clean_skin(arr, feats):
    """Outside the eyes/nose/mouth keep only the smooth skin shading (blush gradients): the drawn side hair
    leaves thin dark strokes on the cheeks that look like scratches on a 3D face. A wide median removes
    them; skin-colored neighbors fill in."""
    r, g, b = [arr[..., i].astype(int) for i in range(3)]
    # skin and blush are bright (r+g+b ≥ ~560 on the sheet); drawn hair shadow on the cheeks is darker
    skin_px = (r > 236) & (g > 145) & (b > 135) & (r + g + b > 545) & (r - b < 110)
    fill = arr.copy()
    # replace non-skin pixels with the nearest skin pixel before the median, so strokes don't bleed in
    idx = ndimage.distance_transform_edt(~skin_px, return_distances=False, return_indices=True)
    fill = fill[idx[0], idx[1]]
    smooth = ndimage.median_filter(fill, size=(15, 15, 1))
    keep = ndimage.gaussian_filter(feats.astype(float), 2.0)[..., None]
    return (arr * keep + smooth * (1 - keep)).round().astype(np.uint8)


def main():
    os.makedirs(OUT, exist_ok=True)
    sheet = Image.open(SHEET).convert('RGBA')
    skin_samples = []
    for name, anchors in ANCHORS.items():
        img = align(sheet, anchors)
        bg = Image.new('RGBA', (N, N), (255, 255, 255, 255))
        bg.alpha_composite(img)
        rgb = bg.convert('RGB')
        if name == 'happy':  # the front view is turned slightly: center the chin on the 3D chin
            rgb = center_lower_face(rgb, 42)
        arr = np.array(rgb)
        mask, feats = build_mask(arr, name)
        arr = clean_skin(arr, feats)
        rgba = np.dstack([arr, (mask * 255).astype(np.uint8)])
        Image.fromarray(rgba, 'RGBA').save(os.path.join(OUT, f'face_{name}.webp'), quality=92, method=6)
        cheek = arr[640:700, 250:330].reshape(-1, 3)
        skin_samples.append(np.median(cheek, axis=0))
        print(name, 'written')
    s = np.median(np.array(skin_samples), axis=0).astype(int)
    print('cheek skin sRGB #%02x%02x%02x' % tuple(s))


if __name__ == '__main__':
    main()
