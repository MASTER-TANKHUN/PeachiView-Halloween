"""Procedural 2D textures for Peachi (run with system python + Pillow + numpy).

  python tools/blender/make_textures.py [--only eyes,mouth,...]

Writes PNGs into tools/blender/tex/. Face textures are drawn in "face space":
x (meters, + = her left) and z (meters, height), matching the planar front projection
used for the face decals in Blender.
"""
import math
import os
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'tex')
SS = 4  # supersampling for anti-aliased masks

# ---------------------------------------------------------------- face regions (meters)
EYES_REGION = (-0.068, 0.068, 1.402, 1.498)     # x0, x1, z0, z1
EYES_CELL = (1024, 722)
EYES_GRID = (2, 4)                             # cols, rows
EYE_NAMES = ['open', 'smile', 'blink', 'wide', 'sad', 'angry', 'half', 'squint']
MOUTH_REGION = (-0.026, 0.026, 1.372, 1.414)
MOUTH_CELL = (512, 414)
MOUTH_GRID = (4, 2)
MOUTH_NAMES = ['smile', 'open', 'frown', 'fang', 'scream', 'o', 'ah', 'neutral']
EYE_CX, EYE_CZ = 0.0330, 1.4430


def hexc(h, a=1.0):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)] + [a])


# ---------------------------------------------------------------- geometry helpers
def bezier(p0, p1, p2, p3, n=40):
    t = np.linspace(0, 1, n)[:, None]
    p0, p1, p2, p3 = map(np.asarray, (p0, p1, p2, p3))
    return (1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t ** 2 * p2 + t ** 3 * p3


def catmull(pts, n=16, closed=False):
    P = np.asarray(pts, float)
    if closed:
        P = np.concatenate([P[-1:], P, P[:2]])
    else:
        P = np.concatenate([P[:1] * 2 - P[1:2], P, P[-1:] * 2 - P[-2:-1]])
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for t in np.linspace(0, 1, n, endpoint=False):
            t2, t3 = t * t, t * t * t
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    if not closed:
        out.append(P[-2])
    return np.array(out)


def ribbon(center, widths, cap_start=False, cap_end=False):
    """Polygon around a centerline with per-point widths."""
    C = np.asarray(center, float)
    w = np.broadcast_to(np.asarray(widths, float), (len(C),))
    d = np.gradient(C, axis=0)
    d /= np.maximum(np.linalg.norm(d, axis=1, keepdims=True), 1e-12)
    n = np.stack([-d[:, 1], d[:, 0]], axis=1)
    L = C + n * (w[:, None] / 2)
    R = C - n * (w[:, None] / 2)
    return np.concatenate([L, R[::-1]])


def ellipse_pts(c, rx, ry, rot=0.0, n=80):
    t = np.linspace(0, 2 * np.pi, n, endpoint=False)
    x, y = rx * np.cos(t), ry * np.sin(t)
    cr, sr = math.cos(rot), math.sin(rot)
    return np.stack([c[0] + x * cr - y * sr, c[1] + x * sr + y * cr], axis=1)


class Canvas:
    """RGBA float canvas addressed in world units (x right, z up)."""

    def __init__(self, size, region):
        self.w, self.h = size
        self.x0, self.x1, self.z0, self.z1 = region
        self.rgba = np.zeros((self.h, self.w, 4))

    def to_px(self, pts):
        pts = np.asarray(pts, float)
        u = (pts[:, 0] - self.x0) / (self.x1 - self.x0) * self.w
        v = (self.z1 - pts[:, 1]) / (self.z1 - self.z0) * self.h
        return np.stack([u, v], axis=1)

    def px_size(self, meters):
        return meters / (self.x1 - self.x0) * self.w

    def mask(self, polys, blur=0.0):
        """Anti-aliased coverage of one or more polygons (world coords)."""
        if isinstance(polys, np.ndarray):
            polys = [polys]
        im = Image.new('L', (self.w * SS, self.h * SS), 0)
        dr = ImageDraw.Draw(im)
        for p in polys:
            q = self.to_px(p) * SS
            dr.polygon([tuple(x) for x in q], fill=255)
        im = im.resize((self.w, self.h), Image.BOX)
        if blur > 0:
            im = im.filter(ImageFilter.GaussianBlur(self.px_size(blur)))
        return np.asarray(im, dtype=np.float64) / 255.0

    def coords(self):
        xs = self.x0 + (np.arange(self.w) + 0.5) / self.w * (self.x1 - self.x0)
        zs = self.z1 - (np.arange(self.h) + 0.5) / self.h * (self.z1 - self.z0)
        return np.meshgrid(xs, zs)

    def paint(self, m, color):
        """Composite `color` (rgba or HxWx4 array) with coverage m (HxW)."""
        col = np.asarray(color, float)
        if col.ndim == 1:
            col = np.broadcast_to(col, self.rgba.shape)
        a = m * col[..., 3]
        dst = self.rgba
        out_a = a + dst[..., 3] * (1 - a)
        rgb = (col[..., :3] * a[..., None] + dst[..., :3] * dst[..., 3:4] * (1 - a[..., None])) / np.maximum(out_a[..., None], 1e-9)
        self.rgba = np.concatenate([rgb, out_a[..., None]], axis=2)

    def image(self):
        return Image.fromarray((np.clip(self.rgba, 0, 1) * 255 + 0.5).astype(np.uint8), 'RGBA')


def vgrad(cv, z_top, z_bot, stops):
    """Vertical gradient (list of (t, rgba)) from z_top (t=0) to z_bot (t=1)."""
    X, Z = cv.coords()
    t = np.clip((z_top - Z) / (z_top - z_bot), 0, 1)
    ts = [s[0] for s in stops]
    out = np.zeros(t.shape + (4,))
    for c in range(4):
        out[..., c] = np.interp(t, ts, [s[1][c] for s in stops])
    return out


# ---------------------------------------------------------------- eyes
C_LASH = hexc('#1a0c12')
C_LID = hexc('#6d2a35')
C_CREASE = hexc('#7a3a3a')
C_SCLERA = hexc('#fbf9ff')
C_SCLERA_SH = hexc('#b8b0dc')
C_IRIS_RING = hexc('#3a1110')
C_PUPIL = hexc('#1d0c20')
C_BROW = hexc('#4a2420')
C_BLUSH = hexc('#ff7d8e')


EYE_SX, EYE_SZ = 1.21, 1.10   # overall eye scale (sheet eyes are wide/almond)


def eye_frame(side):
    """side=+1 her left eye (image right), -1 her right eye. s = outward, t = up."""
    cx = side * EYE_CX
    return lambda s, t: (cx + side * s * EYE_SX, EYE_CZ + t * EYE_SZ)


def mapped(f, pts):
    return np.array([f(s, t) for s, t in pts])


# eye shapes in (s,t) meters; s>0 = outer corner
def eye_shape(kind):
    """Returns dict with upper lash centerline, lower lid line, opening polygon, params."""
    if kind in ('open', 'wide', 'sad', 'angry', 'half'):
        top = {'open': 0.0128, 'wide': 0.0150, 'sad': 0.0112, 'angry': 0.0098, 'half': 0.0040}[kind]
        bot = {'open': -0.0135, 'wide': -0.0150, 'sad': -0.0128, 'angry': -0.0122, 'half': -0.0128}[kind]
        tilt = {'open': 0.0, 'wide': 0.0, 'sad': -0.0030, 'angry': 0.0040, 'half': 0.0}[kind]
        inner = (-0.0138, 0.0040 + (0.0025 if kind == 'angry' else 0))
        outer = (0.0200, 0.0055 + tilt)
        upper = catmull([inner, (-0.0075, top * 0.80 - tilt * 0.3), (0.0010, top), (0.0110, top * 0.86 + tilt * 0.5), outer], n=14)
        lower = catmull([(0.0195, -0.0010), (0.0120, bot * 0.78), (0.0005, bot), (-0.0080, bot * 0.80), (-0.0132, -0.0015)], n=14)
        return {'upper': upper, 'lower': lower, 'open': True, 'top': top, 'bot': bot, 'tilt': tilt, 'outer': outer, 'inner': inner}
    return {'open': False}


def draw_brow(cv, side, kind):
    f = eye_frame(side)
    brow = BROWS[kind]
    bl = catmull(brow, n=12)
    bw = np.interp(np.linspace(0, 1, len(bl)), [0, 0.15, 0.7, 1], [0.0006, 0.0017, 0.0013, 0.0003])
    cv.paint(cv.mask(ribbon(mapped(f, bl), bw)), C_BROW)


def draw_eye(cv, side, kind, blush=0.55):
    f = eye_frame(side)
    sh = eye_shape(kind)
    if sh['open']:
        up, lo = sh['upper'], sh['lower']
        opening = mapped(f, np.concatenate([up, lo]))
        m_open = cv.mask(opening)
        # sclera with lavender shade under the lid
        z_top = EYE_CZ + sh['top']
        scl = vgrad(cv, z_top, EYE_CZ + sh['bot'], [(0, C_SCLERA_SH), (0.38, C_SCLERA), (1, C_SCLERA)])
        cv.paint(m_open, scl)
        # iris
        iris_scale = 0.78 if kind == 'wide' else 1.0
        ic = f(0.0012, -0.0006 - (0.0012 if kind == 'wide' else 0))
        rs, rt = 0.0122 * iris_scale, 0.0146 * iris_scale
        iris_poly = ellipse_pts(ic, rs, rt, n=90)
        m_iris = cv.mask(iris_poly) * m_open
        ig = vgrad(cv, ic[1] + rt, ic[1] - rt, [(0.0, hexc('#3d1420')), (0.22, hexc('#5c1d24')), (0.42, hexc('#a8411b')),
                                                (0.62, hexc('#e27a1c')), (0.82, hexc('#f5a345')), (1.0, hexc('#f9cf92'))])
        cv.paint(m_iris, ig)
        # dark streaks radiating from the pupil
        X, Z = cv.coords()
        ang = np.arctan2(Z - ic[1], (X - ic[0]) / (rs / rt))
        streak = (0.5 + 0.5 * np.cos(ang * 22)) ** 6 * (Z < ic[1] + 0.002)
        rr = np.sqrt(((X - ic[0]) / rs) ** 2 + ((Z - ic[1]) / rt) ** 2)
        cv.paint(m_iris * streak * np.clip((rr - 0.35) / 0.3, 0, 1) * 0.35, hexc('#5a1a10'))
        # lower iris glow
        glow = np.clip(1 - np.sqrt(((X - ic[0]) / (rs * 0.8)) ** 2 + ((Z - (ic[1] - rt * 0.62)) / (rt * 0.32)) ** 2), 0, 1)
        cv.paint(m_iris * glow * 0.55, hexc('#ffe0b0'))
        # iris rim
        rim = cv.mask(iris_poly) - cv.mask(ellipse_pts(ic, rs - 0.0007, rt - 0.0007, n=90))
        cv.paint(np.clip(rim, 0, 1) * m_open * 0.9, C_IRIS_RING)
        # pupil
        pr = 0.62 if kind == 'wide' else 1.0
        pc = (ic[0], ic[1] + 0.0016 * iris_scale)
        cv.paint(cv.mask(ellipse_pts(pc, 0.0037 * pr, 0.0058 * pr)) * m_open, C_PUPIL)
        # upper-lid shadow on the eye (maroon band under the lash line)
        lid_sh = vgrad(cv, z_top, z_top - 0.011, [(0, hexc('#4a1522', 0.95)), (0.45, hexc('#6d2433', 0.55)), (1, hexc('#6d2433', 0.0))])
        cv.paint(m_open, lid_sh)
        # highlights (same light direction for both eyes)
        hl = [((-0.0040, 0.0060), 0.0017, 0.0017, hexc('#27d8ef')),
              ((0.0034, 0.0063), 0.0020, 0.0019, hexc('#f02d9c')),
              ((-0.0058, -0.0072), 0.0031, 0.0021, hexc('#ffffff'))]
        for (ds, dt), a, b, c in hl:
            cx = ic[0] + ds * iris_scale; cz = ic[1] + dt * iris_scale
            cv.paint(cv.mask(ellipse_pts((cx, cz), a * iris_scale, b * iris_scale, rot=-0.3)) * m_open, c)
        cv.paint(cv.mask(ellipse_pts((ic[0] + 0.0048 * iris_scale, ic[1] - 0.0040 * iris_scale), 0.0009, 0.0009)) * m_open, hexc('#ffffff', 0.9))
        # tears (sad)
        if kind == 'sad':
            for ds, sz in ((-0.006, 0.0022), (0.002, 0.0026), (0.010, 0.0020)):
                tc = f(ds, sh['bot'] + 0.0004)
                drop = ellipse_pts(tc, sz * 1.1, sz * 0.8)
                cv.paint(cv.mask(drop), hexc('#d9f2ff', 0.85))
                cv.paint(cv.mask(ellipse_pts((tc[0] - 0.0005, tc[1] + 0.0003), sz * 0.35, sz * 0.25)), hexc('#ffffff'))
                cv.paint(np.clip(cv.mask(drop) - cv.mask(ellipse_pts(tc, sz * 0.9, sz * 0.6)), 0, 1), hexc('#6aa6cf', 0.7))
        # upper lash line: thick, tapering in, winged out
        up_w = np.interp(np.linspace(0, 1, len(up)), [0, 0.25, 0.6, 0.9, 1.0], [0.0006, 0.0017, 0.0024, 0.0030, 0.0022])
        lash = ribbon(mapped(f, up), up_w)
        cv.paint(cv.mask(lash), C_LASH)
        o = sh['outer']
        wing = mapped(f, [(o[0] - 0.0035, o[1] + 0.0012), (o[0] + 0.0052, o[1] - 0.0014), (o[0] - 0.0005, o[1] - 0.0022)])
        cv.paint(cv.mask(wing), C_LASH)
        for k, (ds, dt, L, a) in enumerate([(0.0150, 0.0105, 0.0042, 0.55), (0.0182, 0.0085, 0.0040, 0.25), (-0.0110, 0.0052, 0.0022, 2.3)]):
            base = np.array([ds, dt])
            if kind == 'half':
                base[1] = min(base[1], sh['top'] + 0.001)
            tip = base + L * np.array([math.cos(a), math.sin(a)])
            cv.paint(cv.mask(mapped(f, [base + (0, 0.0008), tip, base - (0, 0.0008)])), C_LASH)
        # crease line above
        if kind != 'half':
            cr = catmull([(-0.0100, sh['top'] * 0.75 + 0.0035), (0.0010, sh['top'] + 0.0036), (0.0150, sh['top'] * 0.85 + 0.0030 + sh['tilt'] * 0.6)], n=14)
            cv.paint(cv.mask(ribbon(mapped(f, cr), np.interp(np.linspace(0, 1, len(cr)), [0, 0.5, 1], [0.0002, 0.0007, 0.0003]))), C_CREASE * [1, 1, 1, 0.8])
        # lower lash (outer 2/3)
        lw = np.interp(np.linspace(0, 1, len(lo)), [0, 0.35, 0.7, 1], [0.0011, 0.0008, 0.0004, 0.0])
        cv.paint(cv.mask(ribbon(mapped(f, lo), lw)), hexc('#3a1518', 0.9))
        if kind == 'half':  # heavy lid: extra lid crease just above the lowered lash line
            cv.paint(cv.mask(ribbon(mapped(f, catmull([(-0.012, 0.0072), (0.001, 0.0088), (0.017, 0.0075)], n=12)), 0.0006)), C_CREASE * [1, 1, 1, 0.8])
    else:
        # closed variants
        if kind == 'smile':      # happy closed ^ ^
            arc = catmull([(-0.0135, -0.0020), (-0.0060, 0.0050), (0.0040, 0.0068), (0.0130, 0.0035), (0.0195, -0.0010)], n=14)
            w = np.interp(np.linspace(0, 1, len(arc)), [0, 0.3, 0.7, 1], [0.0007, 0.0026, 0.0026, 0.0010])
            cv.paint(cv.mask(ribbon(mapped(f, arc), w)), C_LASH)
            for ds, dt, a in ((0.0170, 0.0022, 0.5), (0.0192, 0.0000, 0.1)):
                base = np.array([ds, dt]); tip = base + 0.0035 * np.array([math.cos(a), math.sin(a)])
                cv.paint(cv.mask(mapped(f, [base + (0, 0.0007), tip, base - (0, 0.0007)])), C_LASH)
        elif kind == 'blink':    # relaxed closed eye (downward curve with lashes)
            arc = catmull([(-0.0135, 0.0030), (-0.0040, -0.0022), (0.0070, -0.0030), (0.0200, 0.0015)], n=14)
            w = np.interp(np.linspace(0, 1, len(arc)), [0, 0.3, 0.8, 1], [0.0006, 0.0022, 0.0026, 0.0012])
            cv.paint(cv.mask(ribbon(mapped(f, arc), w)), C_LASH)
            for ds, dt in ((0.004, -0.0030), (0.009, -0.0028), (0.014, -0.0015)):
                base = np.array([ds, dt]); tip = base + (0.0008, -0.0028)
                cv.paint(cv.mask(mapped(f, [base + (0.0006, 0), tip, base - (0.0006, 0)])), C_LASH)
            cr = catmull([(-0.010, 0.0060), (0.002, 0.0055), (0.016, 0.0060)], n=10)
            cv.paint(cv.mask(ribbon(mapped(f, cr), 0.0005)), C_CREASE * [1, 1, 1, 0.7])
        elif kind == 'squint':   # >  <
            tip_s = -0.0120
            pts = [(0.0150, 0.0085), (tip_s, 0.0000), (0.0150, -0.0085)]
            line = catmull(pts, n=10)
            cv.paint(cv.mask(ribbon(mapped(f, line), np.interp(np.linspace(0, 1, len(line)), [0, 0.5, 1], [0.0014, 0.0030, 0.0014]))), C_LASH)
    # eyebrow
    brow = BROWS[kind]
    _unused = {'open': [(-0.018, 0.0365), (-0.004, 0.0412), (0.012, 0.0420), (0.024, 0.0380)],
            'smile': [(-0.018, 0.0380), (-0.004, 0.0428), (0.012, 0.0432), (0.024, 0.0390)],
            'blink': [(-0.018, 0.0360), (-0.004, 0.0400), (0.012, 0.0408), (0.024, 0.0372)],
            'wide': [(-0.018, 0.0420), (-0.004, 0.0475), (0.012, 0.0482), (0.024, 0.0440)],
            'sad': [(-0.018, 0.0435), (-0.006, 0.0422), (0.010, 0.0390), (0.024, 0.0348)],
            'angry': [(-0.018, 0.0280), (-0.004, 0.0330), (0.012, 0.0380), (0.024, 0.0390)],
            'half': [(-0.018, 0.0350), (-0.004, 0.0390), (0.012, 0.0395), (0.024, 0.0365)],
            'squint': [(-0.018, 0.0330), (-0.004, 0.0390), (0.012, 0.0408), (0.024, 0.0380)]}
    bl = catmull(brow, n=12)
    bw = np.interp(np.linspace(0, 1, len(bl)), [0, 0.15, 0.7, 1], [0.0006, 0.0017, 0.0013, 0.0003])
    cv.paint(cv.mask(ribbon(mapped(f, bl), bw)), C_BROW)
    # blush + sparkle
    bc = f(0.006, -0.0215)
    cv.paint(cv.mask(ellipse_pts(bc, 0.0145, 0.0068), blur=0.0045) * blush, C_BLUSH * [1, 1, 1, 0.75])
    for k in range(3):
        a = f(0.000 + k * 0.0045, -0.0195)
        hatch = [(a[0] - side * 0.0010, a[1] + 0.0022), (a[0] + side * 0.0012, a[1] - 0.0022)]
        cv.paint(cv.mask(ribbon(np.array(hatch), 0.0005)) * blush, hexc('#f06a80', 0.55))
    sp = f(0.0205, -0.0175)
    cv.paint(cv.mask(ellipse_pts(sp, 0.0008, 0.0007)), hexc('#ffffff', 0.95))


BROWS = {'open': [(-0.018, 0.0355), (-0.004, 0.0400), (0.012, 0.0408), (0.024, 0.0370)],
         'smile': [(-0.018, 0.0370), (-0.004, 0.0416), (0.012, 0.0420), (0.024, 0.0380)],
         'blink': [(-0.018, 0.0350), (-0.004, 0.0390), (0.012, 0.0398), (0.024, 0.0362)],
         'wide': [(-0.018, 0.0405), (-0.004, 0.0455), (0.012, 0.0462), (0.024, 0.0425)],
         'sad': [(-0.018, 0.0420), (-0.006, 0.0408), (0.010, 0.0378), (0.024, 0.0338)],
         'angry': [(-0.018, 0.0275), (-0.004, 0.0322), (0.012, 0.0370), (0.024, 0.0380)],
         'half': [(-0.018, 0.0340), (-0.004, 0.0378), (0.012, 0.0384), (0.024, 0.0355)],
         'squint': [(-0.018, 0.0322), (-0.004, 0.0378), (0.012, 0.0396), (0.024, 0.0368)]}


def draw_nose(cv):
    cv.paint(cv.mask(np.array([(-0.0010, 1.4290), (0.0012, 1.4290), (0.0022, 1.4240), (-0.0006, 1.4235)]), blur=0.0006), hexc('#ffffff', 0.55))
    cv.paint(cv.mask(ribbon(np.array([(-0.0020, 1.4200), (0.0000, 1.4188), (0.0016, 1.4195)]), 0.0007)), hexc('#9a4a44', 0.8))


def eyes_atlas():
    cw, ch = EYES_CELL
    cols, rows = EYES_GRID
    atlas = Image.new('RGBA', (cw * cols, ch * rows), (0, 0, 0, 0))
    for i, name in enumerate(EYE_NAMES):
        cv = Canvas(EYES_CELL, EYES_REGION)
        blush = {'open': 0.6, 'smile': 0.8, 'blink': 0.55, 'wide': 0.35, 'sad': 0.75, 'angry': 0.85, 'half': 0.5, 'squint': 0.9}[name]
        for side in (-1, 1):
            draw_eye(cv, side, name, blush)
        draw_nose(cv)
        atlas.paste(cv.image(), ((i % cols) * cw, (i // cols) * ch))
        print('eyes', name)
    atlas.save(os.path.join(OUT, 'face_eyes.png'), optimize=True)
    brows = Image.new('RGBA', (cw * cols, ch * rows), (0, 0, 0, 0))
    for i, name in enumerate(EYE_NAMES):
        cv = Canvas(EYES_CELL, EYES_REGION)
        for side in (-1, 1):
            draw_brow(cv, side, name)
        brows.paste(cv.image(), ((i % cols) * cw, (i // cols) * ch))
    brows.save(os.path.join(OUT, 'face_brows.png'), optimize=True)
    return atlas


# ---------------------------------------------------------------- mouth
C_MOUTH_LINE = hexc('#5a1f22')
C_MOUTH_IN = hexc('#9c3337')
C_TONGUE = hexc('#ee7b86')
C_TEETH = hexc('#ffffff')


def draw_mouth(cv, kind):
    cz = 1.3945

    def line(pts, w0=0.0006, w1=0.0010):
        c = catmull(pts, n=12)
        w = np.interp(np.linspace(0, 1, len(c)), [0, 0.5, 1], [w0, w1, w0])
        cv.paint(cv.mask(ribbon(c, w)), C_MOUTH_LINE)

    if kind == 'smile':
        line([(-0.0085, cz + 0.0015), (-0.0035, cz - 0.0012), (0.0035, cz - 0.0012), (0.0085, cz + 0.0015)], 0.0005, 0.0009)
    elif kind == 'neutral':
        line([(-0.0055, cz), (0.0, cz - 0.0004), (0.0055, cz)], 0.0004, 0.0008)
    elif kind == 'frown':
        line([(-0.0060, cz - 0.0020), (-0.0020, cz + 0.0005), (0.0020, cz + 0.0005), (0.0060, cz - 0.0020)], 0.0005, 0.0010)
        cv.paint(cv.mask(ellipse_pts((0.0, cz - 0.0035), 0.0040, 0.0010), blur=0.001), hexc('#e8a09a', 0.5))
    else:
        if kind == 'open':    # happy open "D" (sheet: wide open smile)
            outline = catmull([(-0.0150, cz + 0.0046), (0.0, cz + 0.0026), (0.0150, cz + 0.0046), (0.0098, cz - 0.0082),
                               (0.0, cz - 0.0126), (-0.0098, cz - 0.0082)], n=12, closed=True)
            tongue = ellipse_pts((0.0005, cz - 0.0098), 0.0084, 0.0042)
            teeth = None
        elif kind == 'ah':
            outline = catmull([(-0.0080, cz + 0.0015), (0.0, cz + 0.0030), (0.0080, cz + 0.0015), (0.0050, cz - 0.0060),
                               (0.0, cz - 0.0075), (-0.0050, cz - 0.0060)], n=12, closed=True)
            tongue = ellipse_pts((0.0, cz - 0.0058), 0.0045, 0.0024)
            teeth = None
        elif kind == 'o':
            outline = ellipse_pts((0.0, cz - 0.0020), 0.0038, 0.0045)
            tongue = ellipse_pts((0.0, cz - 0.0048), 0.0025, 0.0014)
            teeth = None
        elif kind == 'scream':
            outline = catmull([(-0.0105, cz + 0.0035), (0.0, cz + 0.0060), (0.0105, cz + 0.0035), (0.0095, cz - 0.0090),
                               (0.0, cz - 0.0175), (-0.0095, cz - 0.0090)], n=12, closed=True)
            tongue = ellipse_pts((0.0, cz - 0.0140), 0.0068, 0.0040)
            teeth = catmull([(-0.0092, cz + 0.0030), (0.0, cz + 0.0052), (0.0092, cz + 0.0030), (0.0070, cz + 0.0005),
                             (0.0, cz + 0.0018), (-0.0070, cz + 0.0005)], n=10, closed=True)
        else:  # fang (angry, wavy)
            top = [(-0.0110, cz + 0.0010), (-0.0060, cz + 0.0035), (-0.0020, cz + 0.0015), (0.0025, cz + 0.0038), (0.0070, cz + 0.0018), (0.0110, cz + 0.0030)]
            bot = [(0.0095, cz - 0.0040), (0.0045, cz - 0.0070), (0.0, cz - 0.0055), (-0.0050, cz - 0.0075), (-0.0095, cz - 0.0035)]
            outline = catmull(top + bot, n=10, closed=True)
            tongue = ellipse_pts((0.0, cz - 0.0060), 0.0060, 0.0022)
            teeth = np.array([(0.0048, cz + 0.0028), (0.0078, cz + 0.0020), (0.0066, cz - 0.0012)])
        m = cv.mask(outline)
        cv.paint(m, vgrad(cv, cz + 0.006, cz - 0.016, [(0, hexc('#7a2228')), (1, C_MOUTH_IN)]))
        cv.paint(cv.mask(tongue) * m, C_TONGUE)
        if teeth is not None:
            cv.paint(cv.mask(teeth) * m, C_TEETH)
        edge = np.clip(cv.mask(ribbon(np.concatenate([outline, outline[:1]]), 0.0011)), 0, 1)
        cv.paint(edge, C_MOUTH_LINE)


def mouth_atlas():
    cw, ch = MOUTH_CELL
    cols, rows = MOUTH_GRID
    atlas = Image.new('RGBA', (cw * cols, ch * rows), (0, 0, 0, 0))
    for i, name in enumerate(MOUTH_NAMES):
        cv = Canvas(MOUTH_CELL, MOUTH_REGION)
        draw_mouth(cv, name)
        atlas.paste(cv.image(), ((i % cols) * cw, (i // cols) * ch))
        print('mouth', name)
    atlas.save(os.path.join(OUT, 'face_mouth.png'), optimize=True)
    return atlas


# ---------------------------------------------------------------- hair strands (grayscale, multiplied by vertex colors)
def hair_texture():
    W, H = 256, 1024
    rng = np.random.default_rng(7)
    u = (np.arange(W) + 0.5) / W
    v = (np.arange(H) + 0.5) / H
    U_, V_ = np.meshgrid(u, v)
    img = np.full((H, W), 0.93)
    for _ in range(70):
        c = rng.random(); w = rng.uniform(0.004, 0.02); depth = rng.uniform(-0.16, 0.08)
        wob = rng.uniform(0.0, 0.01) * np.sin(V_ * rng.uniform(8, 20) + rng.uniform(0, 6))
        du = np.abs(((U_ - c - wob + 0.5) % 1.0) - 0.5)
        img += depth * np.exp(-(du / w) ** 2)
    # soft vertical variation
    img *= 0.96 + 0.04 * np.sin(V_ * 37.0)[:, :]
    img = np.clip(img, 0.55, 1.0)
    im = Image.fromarray((img * 255).astype(np.uint8), 'L').convert('RGB')
    im.save(os.path.join(OUT, 'hair.png'))
    print('hair texture')


# ---------------------------------------------------------------- headphone cup logo + inner-ear glow
def peach_outline(cv, cx, cy, r, w, col):
    """White outline peach (two lobes + cleft + leaf), in canvas world units."""
    lobe = ellipse_pts((cx - r * 0.28, cy - r * 0.05), r * 0.62, r * 0.66, n=90)
    lobe2 = ellipse_pts((cx + r * 0.28, cy - r * 0.05), r * 0.62, r * 0.66, n=90)
    m = np.clip(cv.mask([lobe]) + cv.mask([lobe2]), 0, 1)
    inner1 = ellipse_pts((cx - r * 0.28, cy - r * 0.05), r * 0.62 - w, r * 0.66 - w, n=90)
    inner2 = ellipse_pts((cx + r * 0.28, cy - r * 0.05), r * 0.62 - w, r * 0.66 - w, n=90)
    mi = np.clip(cv.mask([inner1]) + cv.mask([inner2]), 0, 1)
    cv.paint(np.clip(m - mi, 0, 1), col)
    cleft = catmull([(cx + r * 0.05, cy + r * 0.55), (cx - r * 0.12, cy + r * 0.1), (cx + r * 0.02, cy - r * 0.35), (cx + r * 0.15, cy - r * 0.62)], n=12)
    cv.paint(cv.mask(ribbon(cleft, w * 0.9)), col)
    leaf = [(cx + r * 0.05, cy + r * 0.62), (cx + r * 0.35, cy + r * 0.95), (cx + r * 0.62, cy + r * 0.85), (cx + r * 0.3, cy + r * 0.6)]
    cv.paint(cv.mask(ribbon(catmull(leaf + leaf[:1], n=8), w * 0.8)), col)


def cup_logo():
    cv = Canvas((512, 512), (-1, 1, -1, 1))
    X, Z = cv.coords()
    r = np.sqrt(X ** 2 + Z ** 2)
    t = np.clip(r, 0, 1)[..., None]
    c0, c1 = hexc('#ffb3d4')[:3], hexc('#f0468f')[:3]
    rgb = c0 * (1 - t) + c1 * t
    cv.rgba = np.concatenate([rgb, np.ones(r.shape + (1,))], axis=2)
    # glossy highlight
    hl = np.clip(1 - np.sqrt(((X + 0.35) / 0.45) ** 2 + ((Z - 0.45) / 0.25) ** 2), 0, 1) ** 1.5
    cv.paint(hl, hexc('#ffffff', 0.55))
    peach_outline(cv, 0.0, -0.05, 0.62, 0.09, hexc('#ffffff'))
    cv.image().convert('RGB').save(os.path.join(OUT, 'cup_logo.png'))
    # inner ear glow: lavender top -> white -> warm yellow bottom
    cv = Canvas((128, 256), (0, 1, 0, 1))
    X, Z = cv.coords()
    stops = [(0.0, hexc('#fff0a8')), (0.35, hexc('#ffffff')), (0.75, hexc('#e3d6ff')), (1.0, hexc('#c9b4ff'))]
    g = np.zeros(Z.shape + (4,))
    for i in range(4):
        g[..., i] = np.interp(Z, [s_[0] for s_ in stops], [s_[1][i] for s_ in stops])
    cv.rgba = g
    cv.image().convert('RGB').save(os.path.join(OUT, 'ear_inner.png'))
    print('cup logo + ear glow')


def main():
    os.makedirs(OUT, exist_ok=True)
    only = None
    if '--only' in sys.argv:
        only = set(sys.argv[sys.argv.index('--only') + 1].split(','))
    def outfit():
        sys.path.insert(0, HERE)
        import tex_outfit
        tex_outfit.all_outfit()
    jobs = {'eyes': eyes_atlas, 'mouth': mouth_atlas, 'hair': hair_texture, 'cup': cup_logo, 'outfit': outfit}
    for k, fn in jobs.items():
        if only is None or k in only:
            fn()


if __name__ == '__main__':
    main()
