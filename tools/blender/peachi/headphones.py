"""Cat-ear headphones: cups with peach logo, sliders, headband, cat ears with glow panels."""
import math
import numpy as np
from . import sdf as S
from . import geom as G
from . import util as U
from .materials import tex

CUP_C = np.array([0.100, 0.022, 1.463])   # left cup centre (mirrored for right)
CUP_R = 0.041
BAND_RX, BAND_Z0, BAND_RZ = 0.1030, 1.512, 0.0885


def poly2d(pts):
    """Convex polygon 2D sdf (CCW points)."""
    P = np.asarray(pts, float)
    E = np.roll(P, -1, axis=0) - P
    Nn = np.stack([E[:, 1], -E[:, 0]], axis=1)
    Nn /= np.linalg.norm(Nn, axis=1, keepdims=True)

    def f(q):
        d = np.einsum('nkj,kj->nk', q[:, None, :] - P[None], Nn)
        return d.max(axis=1)
    return f


def _surface_r(env, c, d, r0=0.03, r1=0.2):
    """Distance along ray c + r d where the hair envelope surface is crossed."""
    for _ in range(40):
        rm = 0.5 * (r0 + r1)
        if env((c + rm * d)[None])[0] < 0:
            r0 = rm
        else:
            r1 = rm
    return 0.5 * (r0 + r1)


def band_path(n=60, clearance=0.0125):
    """Headband arc resting on the hair: each point sits `clearance` above the hair envelope."""
    from . import hair as HR
    env = HR.envelope()
    a = np.linspace(-math.radians(84), math.radians(84), n)
    y = 0.018 - 0.012 * np.cos(a) ** 2
    pts = []
    for ai, yi in zip(a, y):
        c = np.array([0.0, yi, BAND_Z0])
        d = np.array([math.sin(ai) * BAND_RX / BAND_RZ, 0.0, math.cos(ai)])
        d /= np.linalg.norm(d)
        r = _surface_r(env, c, d) + clearance
        pts.append(c + d * r)
    P = np.array(pts)
    # smooth arc: fit radius(a) with an even polynomial (no bumps from individual clumps)
    rr = np.array([np.linalg.norm((P[i] - np.array([0.0, y[i], BAND_Z0])) * np.array([BAND_RZ / BAND_RX, 1, 1])) for i in range(len(P))])
    coef = np.polyfit(a * a, rr, 2)
    rs = np.polyval(coef, a * a)
    rs = np.maximum(rs, rr.max() * 0.0 + np.polyval(coef, a * a))
    out = []
    for ai, yi, ri in zip(a, y, rs):
        d = np.array([math.sin(ai) * BAND_RX / BAND_RZ, 0.0, math.cos(ai)])
        d /= np.linalg.norm(d)
        k = np.linalg.norm(d * np.array([BAND_RZ / BAND_RX, 1, 1]))
        out.append(np.array([0.0, yi, BAND_Z0]) + d * (ri / k))
    P = np.array(out)
    # never sink into the hair: push out where needed
    for i in range(len(P)):
        c = np.array([0.0, y[i], BAND_Z0])
        d = (P[i] - c) / np.linalg.norm(P[i] - c)
        rmin = _surface_r(env, c, d) + clearance * 0.8
        if np.linalg.norm(P[i] - c) < rmin:
            P[i] = c + d * rmin
    return P, a


def build(ctx):
    coll, log = ctx['coll'], ctx['log']
    m_pink = U.principled('HeadphonePink', (1.0, 0.50, 0.74), rough=0.25, spec=0.6)
    m_white = U.principled('HeadphoneWhite', (0.93, 0.90, 1.0), rough=0.3, spec=0.5)
    m_lav = U.principled('HeadphoneLavender', (0.80, 0.74, 0.98), rough=0.3, spec=0.5)
    logo_img = tex('cup_logo.png')
    m_logo = U.principled('CupLogo', (1, 1, 1), rough=0.2, image=logo_img, spec=0.8)
    ear_img = tex('ear_inner.png')
    m_glow = U.principled('EarGlow', (1, 1, 1), rough=0.3, image=ear_img, emission_image=ear_img, emission_strength=0.6)

    parts = {'pink': [], 'white': [], 'lav': [], 'logo': [], 'glow': [], 'glowsdf': []}

    def add(key, V, F, UV=None):
        parts[key].append((V, F, UV))

    def sdf_part(key, node, h=0.0012, mirror=True):
        V, F = S.sdf_to_mesh(node, h=h, pad=0.004)
        add(key, V, F.tolist(), None)
        if mirror:
            add(key, V * np.array([-1, 1, 1]), F[:, ::-1].tolist(), None)

    ax = S.frame_from_axis((1, 0, 0))
    # ---- ear cup sits on the side hair
    from . import hair as HR
    xs = _surface_r(HR.envelope(), np.array([0.0, 0.022, 1.463]), np.array([1.0, 0, 0]))
    global CUP_C
    CUP_C = np.array([xs + 0.0185, 0.022, 1.463])
    # ---- ear cup: cushion (lavender) + shell (pink) + rim (white)
    def cyl(c, r, half, rr):
        # rounded cylinder along x
        def f(P):
            q = P - c
            d = np.stack([np.sqrt(q[:, 1] ** 2 + q[:, 2] ** 2) - r + rr, np.abs(q[:, 0]) - half + rr], axis=1)
            return np.minimum(np.maximum(d[:, 0], d[:, 1]), 0) + np.linalg.norm(np.maximum(d, 0), axis=1) - rr
        m = max(r, half) + 0.002
        return S.Func(f, c - m, c + m)
    c = CUP_C
    sdf_part('lav', cyl(c + [-0.008, 0, 0], CUP_R * 0.93, 0.0065, 0.005))
    sdf_part('pink', cyl(c + [0.004, 0, 0], CUP_R, 0.0085, 0.004))
    rim = S.Subtract(cyl(c + [0.0135, 0, 0], CUP_R * 0.97, 0.0022, 0.0018), cyl(c + [0.0135, 0, 0], CUP_R * 0.74, 0.004, 0.001), k=0.001)
    sdf_part('white', rim)
    # logo disc (slightly domed), planar UVs
    k = 32
    ring = [(0.0, 0.0)]
    Vd, UVd = [c + [0.0152, 0, 0]], [(0.5, 0.5)]
    Fd = []
    rr = CUP_R * 0.76
    for i in range(k):
        a = 2 * math.pi * i / k
        y, z = math.cos(a) * rr, math.sin(a) * rr
        Vd.append(c + [0.0138, y, z]); UVd.append((0.5 - math.cos(a) * 0.5, 0.5 + math.sin(a) * 0.5))
    for i in range(k):
        Fd.append((0, 1 + i, 1 + (i + 1) % k))
    Vd = np.array(Vd); UVd = np.array(UVd)
    add('logo', Vd, Fd, UVd)
    VdR = Vd * np.array([-1, 1, 1]); UVr = UVd.copy(); UVr[:, 0] = 1 - UVr[:, 0]
    add('logo', VdR, [f[::-1] for f in Fd], UVr)
    # ---- slider / yoke: from cup top up to the band
    y0 = c[2] + CUP_R - 0.004
    yoke = S.RoundBox((c[0] - 0.002, c[1] - 0.002, y0 + 0.020), (0.0045, 0.0065, 0.021), 0.003)
    sdf_part('white', yoke)
    for dz in (0.012, 0.030):
        sdf_part('pink', S.RoundBox((c[0] - 0.002, c[1] - 0.002, y0 + dz), (0.0062, 0.0082, 0.0055), 0.0025))
    # ---- headband: pink outer, white inner stripe
    P, ang = band_path()
    radial = G.normalize(np.stack([np.sin(ang), np.zeros_like(ang), np.cos(ang) * (BAND_RX / BAND_RZ)], axis=1))
    V, F, UV = G.sweep(P, G.rounded_rect(0.017, 0.0075, 0.003), up_hint=radial)
    add('pink', V, F, None)
    Pi = P - radial * 0.0042
    V, F, UV = G.sweep(Pi, G.rounded_rect(0.011, 0.003, 0.0012), up_hint=radial)
    add('white', V, F, None)
    # ---- cat ears (left, mirrored)
    ea = math.radians(33)
    ia = int(np.argmin(np.abs(ang - ea)))
    base = P[ia] + radial[ia] * 0.002
    # ear plane: x (outward-up tilt) and z; thickness along y
    tilt = math.radians(14)
    # local 2D: u = along x, v = up; build world rotation: local x -> world x tilted, local y -> world up, local z -> world -y
    ux = np.array([math.cos(tilt), 0, -math.sin(tilt)])
    uy = np.array([math.sin(tilt), 0, math.cos(tilt)])
    uz = np.cross(ux, uy)
    Rw = np.stack([ux, uy, uz], axis=1)
    def rtri(pts, r):
        P = np.array(pts, float); c = P.mean(axis=0)
        Ps = c + (P - c) * (1 - r / 0.02)
        f = poly2d([tuple(p) for p in Ps])
        return lambda q: f(q) - r
    tri = [(-0.025, -0.004), (0.023, -0.004), (0.011, 0.050)]
    outer = G.Extrude(rtri(tri, 0.006), 0.06, 0.014, 0.004, Rw, base)
    sdf_part('pink', outer, h=0.0010)
    inner_tri = [(-0.0165, 0.0035), (0.0150, 0.0035), (0.0095, 0.0385)]
    panel = G.Extrude(rtri(inner_tri, 0.004), 0.05, 0.004, 0.0016, Rw, base + uz * 0.0072)
    sdf_part('glowsdf', panel, h=0.0007)
    # glowing inner panel (planar UV from the triangle)
    it = np.array(inner_tri)
    tri_pts = [(it[0][0], it[0][1]), (it[1][0], it[1][1]), (it[2][0], it[2][1])]
    Vg, Fg, UVg = [], [], []
    nsub = 8
    for i in range(nsub + 1):
        for j in range(nsub + 1 - i):
            a_, b_ = i / nsub, j / nsub
            p2 = np.array(tri_pts[0]) * (1 - a_ - b_) + np.array(tri_pts[1]) * a_ + np.array(tri_pts[2]) * b_
            p2 = p2 * 0.95 + np.array([0.0, 0.0])
            Vg.append(base + Rw @ np.array([p2[0], p2[1], 0.0053]))
            UVg.append((0.5 + (p2[0]) / 0.04, (p2[1] - 0.004) / 0.036))
    idx = {}
    n = 0
    for i in range(nsub + 1):
        for j in range(nsub + 1 - i):
            idx[(i, j)] = n; n += 1
    for i in range(nsub):
        for j in range(nsub - i):
            Fg.append((idx[(i, j)], idx[(i + 1, j)], idx[(i, j + 1)]))
            if j < nsub - i - 1:
                Fg.append((idx[(i + 1, j)], idx[(i + 1, j + 1)], idx[(i, j + 1)]))
    Vg = np.array(Vg); UVg = np.array(UVg)
    # push the panel to the recess floor (front face, toward -y)
    Vg = Vg - uz * 0.0
    # (planar panel replaced by the extruded 'glowsdf' panel below)

    objs = {}
    # glowing inner-ear panels: planar UV in the ear plane
    if parts['glowsdf']:
        Vg, Fg, _ = G.merge([(a, b, None) for a, b, _ in parts['glowsdf']])
        side = np.sign(Vg[:, 0])
        loc = (np.abs(Vg[:, 0])[:, None] * 0 + Vg)
        loc[:, 0] = np.abs(loc[:, 0])
        rel = loc - base
        uvx = rel @ ux; uvy = rel @ uy
        UVg = np.stack([0.5 + uvx / 0.035, (uvy - 0.003) / 0.037], axis=1)
        parts['glow'] = [(Vg, Fg, UVg)]
        parts['glowsdf'] = []
    for key, mat in (('pink', m_pink), ('white', m_white), ('lav', m_lav), ('logo', m_logo), ('glow', m_glow)):
        if not parts[key]:
            continue
        V, F, UV = G.merge(parts[key]) if all(p[2] is not None for p in parts[key]) else G.merge([(a, b, None) for a, b, _ in parts[key]])
        ob = U.make_mesh('Headphones_' + key, V, F, coll, mat=mat, uv=UV)
        if key in ('pink', 'white', 'lav'):
            U.decimate(ob, 0.22, symmetric=True)
        objs[key] = ob
    ctx['objects'].update({'Headphones_' + k: v for k, v in objs.items()})
    log('headphones', sum(len(o.data.vertices) for o in objs.values()), 'verts')
