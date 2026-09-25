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
          (1.422, 0.0535), (1.447, 0.062), (1.475, 0.069), (1.505, 0.073)]


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


def build_mask(rgb):
    r, g, b = [rgb[..., i].astype(int) for i in range(3)]
    skin = (r > 205) & (g > 140) & (b > 120) & (r - b < 110) & (r - g < 90)
    skin = ndimage.binary_opening(skin, iterations=2)
    yy, xx = np.mgrid[0:N, 0:N]
    eyes = np.zeros((N, N), bool)
    for cx in (512 - EYE_DX, 512 + EYE_DX):   # eye regions incl. lashes, wing and tears
        eyes |= ((xx - cx) / 158.0) ** 2 + ((yy - (EYE_Y + 6)) / 118.0) ** 2 <= 1
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
    face = lower | upper | eyes
    # wide feather at the cheeks/jaw so the drawn skin melts into the 3D skin; eyes stay crisp
    m = ndimage.gaussian_filter(ndimage.binary_erosion(face, iterations=4).astype(float), 6.0)
    m = np.maximum(np.clip((m - 0.1) / 0.8, 0, 1), ndimage.gaussian_filter(eyes.astype(float), 2.0))
    return m


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
        mask = build_mask(arr)
        rgba = np.dstack([arr, (mask * 255).astype(np.uint8)])
        Image.fromarray(rgba, 'RGBA').save(os.path.join(OUT, f'face_{name}.webp'), quality=92, method=6)
        cheek = arr[640:700, 250:330].reshape(-1, 3)
        skin_samples.append(np.median(cheek, axis=0))
        print(name, 'written')
    s = np.median(np.array(skin_samples), axis=0).astype(int)
    print('cheek skin sRGB #%02x%02x%02x' % tuple(s))


if __name__ == '__main__':
    main()
