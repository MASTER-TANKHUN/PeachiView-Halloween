"""Off-shoulder holographic jacket: puffy sleeves (cuffs, black straps, shoulder band),
open body with pink lining, front trims + studs, peach hem band, hood, PEACHI banner."""
import math
import numpy as np
from . import sdf as S
from . import geom as G
from . import util as U
from .config import J
from .materials import tex
from .clothes import sdf_obj

# ------------------------------------------------------------------ sleeve
SLEEVE_S = [0.00, 0.08, 0.25, 0.45, 0.60, 0.72, 0.82, 0.88, 0.915, 0.955, 1.00]
SLEEVE_R = [0.047, 0.050, 0.054, 0.059, 0.067, 0.074, 0.075, 0.067, 0.046, 0.035, 0.033]
SLEEVE_DROOP = [0.0, 0.0, 0.05, 0.12, 0.22, 0.28, 0.28, 0.22, 0.05, 0.0, 0.0]


def sleeve_axis(side=1, n=90):
    A, E, W = np.array(J['Arm']), np.array(J['ForeArm']), np.array(J['Hand'])
    s0 = A + (E - A) * 0.22
    s1 = W + (W - E) * 0.03
    lu = np.linalg.norm(E - s0); lf = np.linalg.norm(s1 - E)
    s = np.linspace(0, 1, n)
    split = lu / (lu + lf)
    P = np.where(s[:, None] < split, s0 + (E - s0) * (s / split)[:, None], E + (s1 - E) * ((s - split) / (1 - split))[:, None])
    P = G.resample(G.catmull(P[::6], n=8), (lu + lf) / (n - 1))
    s = np.linspace(0, 1, len(P))
    if side < 0:
        P = P * np.array([-1, 1, 1])
    return P, s


def sleeve_mesh(side=1, K=36):
    P, s = sleeve_axis(side)
    T = G.normalize(np.gradient(P, axis=0))
    down = np.array([0, 0, -1.0])
    D = G.normalize(down - (T @ down)[:, None] * T)
    Bn = np.cross(T, D)            # horizontal-ish, perpendicular
    r = np.interp(s, SLEEVE_S, SLEEVE_R)
    droop = np.interp(s, SLEEVE_S, SLEEVE_DROOP)
    puff = np.clip((s - 0.2) / 0.3, 0, 1) * np.clip((0.9 - s) / 0.08, 0, 1)
    V, UV = [], []
    # outward direction for the stripe (away from the body): +x for the left arm
    for i in range(len(P)):
        c = P[i] + D[i] * droop[i] * r[i]
        for k in range(K + 1):
            th = 2 * np.pi * k / K
            fold = 1 + puff[i] * (0.035 * math.sin(5 * th + 9 * s[i]) + 0.022 * math.sin(9 * th - 5 * s[i]))
            rr = r[i] * fold
            d = D[i] * math.cos(th) + Bn[i] * math.sin(th)
            V.append(c + d * rr)
            UV.append((k / K, 1 - s[i]))
    V = np.array(V); UV = np.array(UV)
    # rotate u so the stripe (u=0.5) sits on the outer side
    R = K + 1
    F = []
    for i in range(len(P) - 1):
        for k in range(K):
            a = i * R + k
            F.append((a, a + 1, a + R + 1, a + R) if side > 0 else (a, a + R, a + R + 1, a + 1))
    # find the vertex direction pointing most outward (+x*side) to align the stripe
    ring0 = V[len(P) // 2 * R:(len(P) // 2 + 1) * R]
    kout = int(np.argmax(ring0[:, 0] * side))
    UV[:, 0] = (UV[:, 0] - kout / K + 0.5) % 1.0
    return V, F, UV, P, s, r, D, Bn, droop


def band_on_sleeve(P, s, r, D, Bn, droop, s0, s1, extra, profile_h, n=36):
    """A ring band around the sleeve between params s0..s1 (sweep of a closed loop)."""
    sm = (s0 + s1) / 2
    i = int(np.argmin(np.abs(s - sm)))
    c = P[i] + D[i] * droop[i] * r[i]
    T = G.normalize(P[min(i + 1, len(P) - 1)] - P[max(i - 1, 0)])
    th = np.linspace(0, 2 * np.pi, n, endpoint=False)
    loop = c + (D[i][None] * np.cos(th)[:, None] + Bn[i][None] * np.sin(th)[:, None]) * (r[i] + extra)
    V, F, UV = G.sweep(loop, G.rounded_rect(0.0035, profile_h, 0.0012), up_hint=T, closed=True, cap=False)
    return V, F, c, T


# ------------------------------------------------------------------ body
JK_ROWS = [  # z, rx, ry_front, ry_back
    (0.860, 0.170, 0.122, 0.164),
    (0.920, 0.156, 0.112, 0.137),
    (0.980, 0.141, 0.101, 0.107),
    (1.050, 0.131, 0.095, 0.089),
    (1.150, 0.129, 0.090, 0.087),
    (1.245, 0.133, 0.081, 0.089),
]
PHI0, PHI1 = math.radians(71), math.radians(289)


def jk_point(phi, z, grow=0.0):
    rows = np.array(JK_ROWS)
    rx = np.interp(z, rows[:, 0], rows[:, 1]) + grow
    rf = np.interp(z, rows[:, 0], rows[:, 2]) + grow
    rb = np.interp(z, rows[:, 0], rows[:, 3]) + grow
    c = math.cos(phi)
    ry = rf if c > 0 else rb
    return np.array([math.sin(phi) * rx, -c * ry + 0.004, z])


def z_top(phi):
    sphi = math.sin(phi)
    return 1.243 - 0.05 * sphi * sphi


def z_hem(phi):
    return 0.866 - 0.008 * (1 - math.cos(phi)) / 2


def body_mesh(nu=72, nv=26, grow=0.0):
    V, UV = [], []
    for i in range(nv + 1):
        v = i / nv
        for j in range(nu + 1):
            u = j / nu
            phi = PHI0 + (PHI1 - PHI0) * u
            z = z_top(phi) + (z_hem(phi) - z_top(phi)) * v
            # gentle vertical folds that grow toward the hem
            fold = 0.006 * v * math.sin(u * 2 * math.pi * 7 + 1.3)
            V.append(jk_point(phi, z, grow + fold))
            UV.append((u * 2.0, 1 - v))
    F = []
    R = nu + 1
    for i in range(nv):
        for j in range(nu):
            a = i * R + j
            F.append((a, a + R, a + R + 1, a + 1))
    return np.array(V), F, np.array(UV)


def edge_curve(which, n=40, grow=0.0):
    pts = []
    if which in ('front_L', 'front_R'):
        phi = PHI0 if which == 'front_L' else PHI1
        for i in range(n + 1):
            v = i / n
            pts.append(jk_point(phi, z_top(phi) + (z_hem(phi) - z_top(phi)) * v, grow))
    elif which == 'hem':
        for i in range(n + 1):
            phi = PHI0 + (PHI1 - PHI0) * i / n
            pts.append(jk_point(phi, z_hem(phi) + 0.009, grow))
    elif which == 'top':
        for i in range(n + 1):
            phi = PHI0 + (PHI1 - PHI0) * i / n
            pts.append(jk_point(phi, z_top(phi), grow))
    return np.array(pts)


# ------------------------------------------------------------------ build
def materials():
    M = {}
    M['holo'] = U.principled('HoloJacket', (1, 1, 1), rough=0.28, image=tex('holo.png'), spec=0.6)
    M['sleeve'] = U.principled('HoloSleeve', (1, 1, 1), rough=0.28, image=tex('sleeve.png'), spec=0.6, double_sided=True)
    M['lining'] = U.principled('JacketLining', (1.0, 0.55, 0.76), rough=0.5)
    M['trim'] = U.principled('JacketTrim', (1.0, 0.52, 0.74), rough=0.35)
    M['hem'] = U.principled('JacketHem', (1, 1, 1), rough=0.4, image=tex('hem.png'))
    M['banner'] = U.principled('Banner', (1, 1, 1), rough=0.4, image=tex('banner.png'))
    M['white'] = U.principled('CuffWhite', (0.96, 0.95, 1.0), rough=0.45)
    M['black'] = U.principled('Black', (0.10, 0.10, 0.15), rough=0.6)
    M['gold'] = U.principled('Gold', (0.98, 0.76, 0.28), rough=0.22, metal=1.0)
    M['heart'] = U.principled('HeartPink', (1.0, 0.52, 0.74), rough=0.18, spec=0.7)
    return M


def build(ctx):
    coll, log = ctx['coll'], ctx['log']
    M = materials()
    objs = []
    # ---- sleeves
    for side, nm in ((1, 'L'), (-1, 'R')):
        V, F, UV, P, s, r, D, Bn, droop = sleeve_mesh(side)
        objs.append(U.make_mesh('Sleeve.' + nm, V, F, coll, mat=M['sleeve'], uv=UV))
        bands = [('CuffWhite', 0.905, 0.955, 0.002, 0.020, M['white']), ('CuffBlack', 0.958, 1.0, 0.001, 0.014, M['black']),
                 ('SleeveStrapTop', 0.05, 0.09, 0.003, 0.017, M['black']), ('SleeveStrapMid', 0.36, 0.40, 0.004, 0.018, M['black']),
                 ('ShoulderBand', 0.0, 0.03, 0.003, 0.020, M['trim'])]
        for bname, s0, s1, extra, hgt, mat in bands:
            Vb, Fb, c, T = band_on_sleeve(P, s, r, D, Bn, droop, s0, s1, extra, hgt)
            objs.append(U.make_mesh('%s.%s' % (bname, nm), Vb, Fb, coll, mat=mat))
            if bname in ('SleeveStrapMid', 'CuffWhite', 'SleeveStrapTop'):
                i = int(np.argmin(np.abs(s - (s0 + s1) / 2)))
                outward = G.normalize(np.array([side, -0.35, 0.0]))
                d = outward - (outward @ T) * T
                d = G.normalize(d)
                rr = r[i] + extra + 0.003
                cpos = c + d * rr
                Rb = np.stack([G.normalize(np.cross(T, d)), T, d], axis=1)
                if bname == 'CuffWhite':
                    node = S.Sphere(cpos, 0.0042)
                else:
                    node = G.box_frame(cpos, (0.022, 0.026), (0.013, 0.017), 0.0035, 0.0012, Rb)
                objs.append(sdf_obj('%sBuckle.%s' % (bname, nm), node, cpos - 0.02, cpos + 0.02, 0.0006, coll, M['gold']))
    # ---- body (outer holo + inner pink lining)
    V, F, UV = body_mesh()
    objs.append(U.make_mesh('JacketBody', V, F, coll, mat=M['holo'], uv=UV))
    Vi, Fi, UVi = body_mesh(grow=-0.003)
    objs.append(U.make_mesh('JacketLining', Vi, [f[::-1] for f in Fi], coll, mat=M['lining'], uv=UVi))
    # front edge trims (pink) + gold studs
    for which in ('front_L', 'front_R'):
        P = edge_curve(which, grow=0.0)
        radial = G.normalize(P * np.array([1, 1, 0]) - np.array([0, 0.004, 0]))
        Vt, Ft, _ = G.sweep(P, G.rounded_rect(0.020, 0.006, 0.002), up_hint=radial)
        objs.append(U.make_mesh('JacketTrim.' + which, Vt, Ft, coll, mat=M['trim']))
        studs = [S.Sphere(P[i] + radial[i] * 0.004, 0.0023) for i in range(3, len(P) - 2, 5)]
        lo = P.min(axis=0) - 0.02; hi = P.max(axis=0) + 0.02
        objs.append(sdf_obj('JacketStuds.' + which, S.Union(studs), lo, hi, 0.0007, coll, M['gold']))
    # hem band with peach icons
    P = edge_curve('hem', n=80, grow=0.003)
    radial = G.normalize(P * np.array([1, 1, 0]) - np.array([0, 0.004, 0]))
    Vh, Fh, UVh, PR = G.sweep(P, G.rounded_rect(0.006, 0.024, 0.002), up_hint=np.array([0, 0, 1.0]), return_prof=True)
    UVhem = np.stack([UVh[:, 1] * 2.0, 0.5 + PR[:, 1] / 0.024], axis=1)
    objs.append(U.make_mesh('JacketHem', Vh, Fh, coll, mat=M['hem'], uv=UVhem))
    bc = jk_point(math.pi, z_hem(math.pi) + 0.009, 0.009)
    objs.append(sdf_obj('JacketHemButton', G.Torus(bc, 0.005, 0.0018, S.frame_from_axis((0, 1, 0))), bc - 0.01, bc + 0.01, 0.0005, coll, M['gold']))
    # ---- hood (folded on the upper back)
    hc = np.array([0.0, 0.070, 1.268])
    hood_outer = S.Ellipsoid(hc, (0.112, 0.060, 0.086))
    hood = S.Intersect(S.Shell(hood_outer, -0.004, 0.0), S.Func(lambda P: np.maximum(0.078 - P[:, 1], P[:, 2] - 1.335), hc - 0.2, hc + 0.2), k=0.003)
    Vh, Fh = S.sdf_to_mesh(hood, hc - [0.13, 0.02, 0.11], hc + [0.13, 0.08, 0.11], h=0.0022)
    ho = U.make_mesh('Hood', Vh, Fh, coll, mat=M['holo'], uv=np.stack([Vh[:, 0] * 4 + 0.5, Vh[:, 2] * 4], axis=1))
    ho.data.materials.append(M['lining'])
    # inner faces (pointing toward the body / up into the opening) get the pink lining
    fidx = []
    for poly in ho.data.polygons:
        c = np.array(poly.center); nrm = np.array(poly.normal)
        out = c - hc
        fidx.append(0 if (nrm @ out) > 0 else 1)
    ho.data.polygons.foreach_set('material_index', np.array(fidx, dtype=np.int32))
    objs.append(ho)
    # hood opening rim (pink)
    t = np.linspace(-1, 1, 40)
    rim = []
    for tt in t:
        x = tt * 0.108
        yy = hc[1] + 0.060 * math.sqrt(max(0.0, 1 - (x / 0.112) ** 2 - ((1.335 - hc[2]) / 0.086) ** 2))
        rim.append((x, max(yy, 0.08), 1.333))
    rim = G.catmull(np.array(rim)[::3], n=6)
    Vr, Fr, _ = G.sweep(rim, G.ellipse(0.010, 0.010, 10), up_hint=(0, 0, 1))
    objs.append(U.make_mesh('HoodRim', Vr, Fr, coll, mat=M['trim']))
    # heart emblem on the hood
    ec = np.array([0.0, hc[1] + 0.058, 1.300])
    Re = S.rot_matrix(math.radians(-90), 0, 0)
    ring = S.Subtract(G.heart_node(ec, 0.013, 0.004, Re), G.heart_node(ec + [0, 0.003, 0], 0.009, 0.02, Re), k=0.0004)
    objs.append(sdf_obj('HoodEmblemRing', ring, ec - 0.02, ec + 0.02, 0.0005, coll, M['gold']))
    objs.append(sdf_obj('HoodEmblemHeart', G.heart_node(ec + [0, 0.0008, 0], 0.0088, 0.004, Re, puff=0.0018), ec - 0.015, ec + 0.015, 0.0005, coll, M['heart']))
    # ---- banner on the back
    Vb, UVb, Fb = [], [], []
    nx, nz = 6, 24
    ztop, zbot, ztip, hw = 1.215, 0.945, 0.915, 0.053
    for i in range(nz + 1):
        v = i / nz
        for j in range(nx + 1):
            u = j / nx
            x = (u - 0.5) * 2 * hw
            z = ztop + (zbot - ztop) * v
            if v > 0.85:   # pointed bottom
                k = (v - 0.85) / 0.15
                z = z - k * (ztip - zbot) * 0 + (-(1 - abs(u - 0.5) * 2) * (zbot - ztip)) * k
            phi = math.pi - math.asin(max(-0.99, min(0.99, x / 0.13)))
            y = jk_point(phi, z, 0.0045)[1]
            Vb.append((x, y, z))
            UVb.append((1.0 - u, 1 - (ztop - z) / (ztop - ztip) * 1.0))   # read correctly from behind
    R = nx + 1
    for i in range(nz):
        for j in range(nx):
            a = i * R + j
            Fb.append((a, a + 1, a + R + 1, a + R))
    objs.append(U.make_mesh('Banner', np.array(Vb), Fb, coll, mat=M['banner'], uv=np.array(UVb)))
    for o in objs:
        ctx['objects'][o.name] = o
    ctx['mats'].update({'j_' + k: v for k, v in M.items()})
    log('jacket', len(objs), 'objects')
