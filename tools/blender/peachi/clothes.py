"""Crop top, pleated skirt (+frill, shorts), belt + heart buckle, chain, PEACHI straps,
thigh-high sock, ankle socks, garters, choker."""
import math
import numpy as np
from . import sdf as S
from . import geom as G
from . import body as B
from . import util as U
from .materials import tex


def cyl_uv(V, z0, z1, cx=0.0, cy=0.004):
    u = 0.5 + np.arctan2(V[:, 0] - cx, -(V[:, 1] - cy)) / (2 * np.pi)
    v = (V[:, 2] - z0) / (z1 - z0)
    return np.stack([u, v], axis=1)


def sdf_obj(name, node, lo, hi, h, coll, mat, uv_fn=None, target=None):
    V, F = S.sdf_to_mesh(node, np.asarray(lo, float), np.asarray(hi, float), h=h)
    ob = U.make_mesh(name, V, F, coll, mat=mat, uv=uv_fn(V) if uv_fn else None)
    tgt = target or (1200 if len(F) < 20000 else 6000)
    if len(F) > tgt:
        U.decimate(ob, max(0.05, tgt / len(F)))
    return ob


# ------------------------------------------------------------------ crop top
def top_region(P):
    x, y, z = P[:, 0], P[:, 1], P[:, 2]
    front = np.clip(-y / 0.06, 0, 1)
    z_top = 1.246 + 0.018 * front - 0.024 * np.exp(-(x / 0.013) ** 2) * front
    return np.maximum(1.121 - z, z - z_top)


def build_top(ctx, M):
    base = B.torso_sdf(clothed=True)
    shell = S.Intersect(S.Shell(base, 0.0008, 0.0045), S.Func(top_region, (-0.2, -0.2, 1.1), (0.2, 0.2, 1.3)), k=0.0025)
    lo, hi = (-0.14, -0.16, 1.105), (0.14, 0.10, 1.285)
    top = sdf_obj('CropTop', shell, lo, hi, 0.0016, ctx['coll'], M['top'], lambda V: cyl_uv(V, 1.118, 1.270), target=14000)
    band = S.Intersect(S.Shell(base, 0.0020, 0.0065), S.Func(lambda P: np.maximum(1.116 - P[:, 2], P[:, 2] - 1.137), (-0.2, -0.2, 1.1), (0.2, 0.2, 1.15)), k=0.0012)
    hem = sdf_obj('CropTopHem', band, (-0.14, -0.16, 1.108), (0.14, 0.10, 1.145), 0.0018, ctx['coll'], M['top_hem'], lambda V: cyl_uv(V, 1.0, 1.4) * [3, 3])
    return [top, hem]


# ------------------------------------------------------------------ skirt
SK = dict(z_waist=0.999, hem_f=0.785, hem_b=0.797, w_rx=0.093, w_f=0.071, w_b=0.063, h_rx=0.180, h_f=0.128, h_b=0.186, pleats=28)


def skirt_radius(phi, t):
    """Base (unpleated) skirt ellipse at angle phi (0 = front, + toward her left) and t (0 waist .. 1 hem)."""
    tt = t ** 0.85
    rx = SK['w_rx'] + (SK['h_rx'] - SK['w_rx']) * tt
    rf = SK['w_f'] + (SK['h_f'] - SK['w_f']) * tt
    rb = SK['w_b'] + (SK['h_b'] - SK['w_b']) * tt
    c = np.cos(phi)
    ry = np.where(c > 0, rf, rb)
    return np.stack([np.sin(phi) * rx, -c * ry], axis=-1)


def skirt_z(phi, t):
    hem = SK['hem_f'] + (SK['hem_b'] - SK['hem_f']) * (1 - np.cos(phi)) / 2
    return SK['z_waist'] + (hem - SK['z_waist']) * t


def pleated_ring_mesh(rings, pleats, radius_fn, z_fn, depth_fn, name, coll, mats, lining_mat=None, ycenter=0.004):
    K = pleats * 4
    V, UV = [], []
    frac = np.array([0.0, 0.32, 0.64, 0.955])   # knife pleat: long slope, narrow fold
    for i in range(rings + 1):
        t = i / rings
        for j in range(K + 1):
            jj = j % K
            phi = 2 * np.pi * ((jj // 4) + frac[jj % 4]) / pleats
            base = radius_fn(phi, t)
            saw = (jj % 4) / 3.0
            n = G.normalize(np.array([base[0], base[1] * 1.0]))
            off = depth_fn(t) * (saw - 0.5)
            x, y = base[0] + n[0] * off, base[1] + n[1] * off
            V.append((x, y + ycenter, z_fn(phi, t)))
            UV.append((j / K * 8.0, 1.0 - t))
    F, mat_idx = [], []
    R = K + 1
    for i in range(rings):
        for j in range(K):
            a = i * R + j
            F.append((a, a + R, a + R + 1, a + 1))
            mat_idx.append(1 if (j % 4 == 3 and lining_mat is not None) else 0)
    ob = U.make_mesh(name, np.array(V), F, coll, mat=mats[0], uv=np.array(UV))
    if lining_mat is not None:
        ob.data.materials.append(lining_mat)
        ob.data.polygons.foreach_set('material_index', np.array(mat_idx, dtype=np.int32))
    return ob


def build_skirt(ctx, M):
    coll = ctx['coll']
    skirt = pleated_ring_mesh(22, SK['pleats'], skirt_radius, skirt_z, lambda t: 0.003 + 0.020 * t, 'Skirt', coll,
                              [M['skirt']], M['skirt_lining'])
    # white frill under the hem
    def fr_r(phi, t):
        f = 0.885 + 0.135 * min(1.0, max(0.0, (t - 0.30) / 0.70)) ** 0.8
        return skirt_radius(phi, 1.0) * f

    def fr_z(phi, t):
        top = skirt_z(phi, 1.0) + 0.016
        bot = skirt_z(phi, 1.0) - 0.024
        return top + (bot - top) * t
    frill = pleated_ring_mesh(8, 40, fr_r, fr_z, lambda t: 0.002 + 0.008 * max(0.0, t - 0.35), 'SkirtFrill', coll, [M['frill']])
    # safety shorts
    legs = S.Mirror(S.chain(B.LEG_PTS[:3], B.LEG_R[:3]))
    hips = S.Union([B.torso_sdf(), legs], k=0.03)
    reg = S.Func(lambda P: np.maximum(0.792 - P[:, 2], P[:, 2] - 0.985), (-0.2, -0.2, 0.75), (0.2, 0.2, 1.0))
    shorts = sdf_obj('Shorts', S.Intersect(S.Offset(hips, 0.003), reg, k=0.002), (-0.17, -0.12, 0.78), (0.17, 0.13, 0.995), 0.004, coll, M['black'])
    return [skirt, frill, shorts]


# ------------------------------------------------------------------ belt, buckle, chain
def waist_loop(z, grow, n=96):
    rows = np.array(B.TORSO_ROWS)
    hw = np.interp(z, rows[:, 0], rows[:, 1]) + grow
    fd = np.interp(z, rows[:, 0], rows[:, 2]) + grow
    bd = np.interp(z, rows[:, 0], rows[:, 3]) + grow
    phi = np.linspace(0, 2 * np.pi, n, endpoint=False)
    c = np.cos(phi)
    y = np.where(c > 0, -c * fd, -c * bd) + 0.004
    return np.stack([np.sin(phi) * hw, y, np.full_like(phi, z)], axis=1)


def build_belt(ctx, M):
    coll = ctx['coll']
    loop = waist_loop(1.009, 0.0125)
    V, F, UV, PR = G.sweep(loop, G.rounded_rect(0.0045, 0.026, 0.0015), up_hint=(0, 0, 1), closed=True, cap=False, return_prof=True)
    UVb = np.stack([UV[:, 1], 0.5 + PR[:, 1] / 0.026], axis=1)
    belt = U.make_mesh('Belt', V, F, coll, mat=M['belt'], uv=UVb)
    # heart buckle (gold frame + pink heart) at front-left
    Rf = S.rot_matrix(math.radians(90), 0, 0)   # heart plane facing -Y
    c = np.array([0.036, -0.083, 1.009])
    frame = S.Subtract(G.heart_node(c, 0.020, 0.006, Rf), G.heart_node(c + [0, -0.004, 0.0], 0.0145, 0.02, Rf), k=0.0005)
    buckle = sdf_obj('BeltBuckle', frame, c - 0.03, c + 0.03, 0.0007, coll, M['gold'])
    heart = sdf_obj('BeltHeart', G.heart_node(c + [0, -0.001, 0.0006], 0.0138, 0.005, Rf, puff=0.0025), c - 0.025, c + 0.025, 0.0006, coll, M['heart'])
    c2 = np.array([0.006, -0.081, 1.008])
    heart2 = sdf_obj('BeltHeartSmall', G.heart_node(c2, 0.0085, 0.004, Rf, puff=0.0015), c2 - 0.02, c2 + 0.02, 0.0006, coll, M['heart'])
    return [belt, buckle, heart, heart2]


def torus_mesh(center, R, r, axis, ref, nu=10, nv=6):
    axis = G.normalize(np.asarray(axis, float)); ref = G.normalize(np.asarray(ref, float) - axis * (np.dot(ref, axis)))
    b = np.cross(axis, ref)
    V, F = [], []
    for i in range(nu):
        a = 2 * np.pi * i / nu
        cdir = ref * np.cos(a) + b * np.sin(a)
        for j in range(nv):
            t = 2 * np.pi * j / nv
            V.append(center + cdir * (R + r * np.cos(t)) + axis * r * np.sin(t))
    for i in range(nu):
        for j in range(nv):
            a0 = i * nv + j; a1 = ((i + 1) % nu) * nv + j
            a2 = ((i + 1) % nu) * nv + (j + 1) % nv; a3 = i * nv + (j + 1) % nv
            F.append((a0, a1, a2, a3))
    return np.array(V), F


def chain_mesh(path_pts, link_len=0.0072, R=0.0036, r=0.0010):
    P = G.resample(G.catmull(path_pts, n=16), link_len * 0.78)
    T = G.normalize(np.gradient(P, axis=0))
    parts = []
    for i in range(len(P)):
        up = np.array([0, 0, 1.0]) if abs(T[i][2]) < 0.9 else np.array([1.0, 0, 0])
        side = G.normalize(np.cross(T[i], up))
        axis = side if i % 2 == 0 else G.normalize(np.cross(T[i], side))
        V, F = torus_mesh(P[i], R, r, axis, T[i])
        # stretch into an oval along the tangent
        d = V - P[i]
        V = P[i] + d + T[i] * (d @ T[i])[:, None] * 0.35
        parts.append((V, F, None))
    return G.merge(parts)


def build_chain(ctx, M):
    coll = ctx['coll']
    swag = [(-0.090, -0.048, 0.998), (-0.070, -0.090, 0.965), (-0.030, -0.112, 0.935), (0.012, -0.112, 0.930),
            (0.048, -0.100, 0.950), (0.074, -0.080, 0.985), (0.084, -0.066, 1.000)]
    drop = [(0.080, -0.078, 0.992), (0.086, -0.100, 0.955), (0.090, -0.112, 0.922)]
    V1, F1, _ = chain_mesh(swag)
    V2, F2, _ = chain_mesh(drop)
    V, F, _ = G.merge([(V1, F1, None), (V2, F2, None)])
    chain = U.make_mesh('Chain', V, F, coll, mat=M['gold'])
    Rf = S.rot_matrix(math.radians(90), 0, math.radians(-12))
    c = np.array([0.091, -0.116, 0.902])
    frame = S.Subtract(G.heart_node(c, 0.0145, 0.005, Rf), G.heart_node(c + [0, -0.003, 0], 0.0105, 0.02, Rf), k=0.0004)
    charm_f = sdf_obj('ChainCharmFrame', frame, c - 0.025, c + 0.025, 0.0006, coll, M['gold'])
    charm_h = sdf_obj('ChainCharmHeart', G.heart_node(c + [0, -0.0008, 0], 0.0098, 0.0045, Rf, puff=0.002), c - 0.02, c + 0.02, 0.0005, coll, M['heart'])
    return [chain, charm_f, charm_h]


# ------------------------------------------------------------------ straps
STRAPS = [  # (name, phi at belt (deg, 0=front, + her left), end z, outward drift)
    ('Strap.FR', -58.0, 0.610, 0.012),
    ('Strap.SL', 98.0, 0.615, 0.016),
    ('Strap.BL', 150.0, 0.625, 0.010),
    ('Strap.BR', -150.0, 0.625, 0.010),
]


def strap_path(phi_deg, z_end, drift, n=40):
    phi = math.radians(phi_deg)
    pts = []
    z_hem = skirt_z(phi, 1.0)
    for i in range(n + 1):
        z = 1.004 - (1.004 - z_end) * i / n
        if z >= z_hem:
            t = (SK['z_waist'] - z) / (SK['z_waist'] - z_hem)
            t = min(max(t, 0.0), 1.0)
            xy = skirt_radius(phi, t) * (1.0 + 0.02) + G.normalize(skirt_radius(phi, t)) * (0.020 * t + 0.009)
        else:
            xy_h = skirt_radius(phi, 1.0) * 1.02 + G.normalize(skirt_radius(phi, 1.0)) * 0.029
            k = (z_hem - z) / max(z_hem - z_end, 1e-6)
            xy = xy_h * (1 - 0.25 * k) + G.normalize(xy_h) * drift * k
        pts.append((xy[0], xy[1] + 0.004, z))
    return np.array(pts)


def build_straps(ctx, M):
    coll = ctx['coll']
    objs = []
    for name, phi, z_end, drift in STRAPS:
        P = G.catmull(strap_path(phi, z_end, drift)[::4], n=6)
        radial = np.stack([P[:, 0], P[:, 1] - 0.004, np.zeros(len(P))], axis=1)
        V, F, UV, PR = G.sweep(P, G.rounded_rect(0.036, 0.0026, 0.0009), up_hint=G.normalize(radial), cap=True, return_prof=True)
        UVs = np.stack([0.5 - PR[:, 0] / 0.036, 1.0 - UV[:, 1]], axis=1)
        ob = U.make_mesh(name, V, F, coll, mat=M['strap'], uv=UVs)
        objs.append(ob)
        # D-ring at the end
        T = G.normalize(P[-1] - P[-2])
        nrm = G.normalize(radial[-1])
        bn = np.cross(T, nrm)
        R = np.stack([bn, T, nrm], axis=1)
        c = P[-1] + T * 0.016
        ring = G.box_frame(c, (0.046, 0.030), (0.034, 0.018), 0.0045, 0.0016, R)
        objs.append(sdf_obj(name + '.Ring', ring, c - 0.035, c + 0.035, 0.0008, coll, M['gold']))
    return objs


# ------------------------------------------------------------------ legwear
def leg_axis(z, side):
    pts = np.array(B.LEG_PTS)
    x = np.interp(z, pts[::-1, 2], pts[::-1, 0]) * side
    y = np.interp(z, pts[::-1, 2], pts[::-1, 1])
    return x, y


def leg_uv(side):
    def f(V):
        cx, cy = leg_axis(V[:, 2], side)
        ang = np.arctan2(V[:, 0] - cx, -(V[:, 1] - cy))
        return np.stack([0.5 + ang / (2 * np.pi), (V[:, 2] - 0.10) / 0.59], axis=1)
    return f


def build_legwear(ctx, M):
    coll = ctx['coll']
    legR = S.Transform(B.leg_sdf(), np.diag([-1.0, 1, 1]))   # mirrored to her right (x<0)
    legL = B.leg_sdf()
    objs = []
    band = lambda z0, z1: S.Func(lambda P: np.maximum(z0 - P[:, 2], P[:, 2] - z1), (-0.3, -0.2, z0 - 0.05), (0.3, 0.2, z1 + 0.05))  # noqa: E731
    sock = S.Intersect(S.Shell(legR, 0.0008, 0.0042), band(0.10, 0.686), k=0.001)
    objs.append(sdf_obj('Sock.R', sock, (-0.17, -0.09, 0.08), (-0.02, 0.10, 0.70), 0.0016, coll, M['sock'], leg_uv(-1), target=16000))
    trim = S.Intersect(S.Shell(legR, 0.0020, 0.0052), band(0.677, 0.692), k=0.001)
    objs.append(sdf_obj('SockTrim.R', trim, (-0.16, -0.08, 0.665), (-0.02, 0.08, 0.70), 0.0016, coll, M['pink']))
    for side, leg, nm in ((-1, legR, 'R'), (1, legL, 'L')):
        a = S.Intersect(S.Shell(leg, 0.0034 if side < 0 else 0.0012, 0.0068 if side < 0 else 0.0046), band(0.178, 0.268), k=0.0012)
        lo = (-0.16, -0.06, 0.16) if side < 0 else (0.03, -0.06, 0.16)
        hi = (-0.03, 0.10, 0.28) if side < 0 else (0.16, 0.10, 0.28)
        objs.append(sdf_obj('AnkleSock.' + nm, a, lo, hi, 0.0022, coll, M['black']))
    # garters
    for side, nm, z0, z1 in ((-1, 'R', 0.664, 0.679), (1, 'L', 0.655, 0.671)):
        leg = legR if side < 0 else legL
        g = S.Intersect(S.Shell(leg, 0.0036 if side < 0 else 0.0010, 0.0078 if side < 0 else 0.0052), band(z0, z1), k=0.0012)
        lo = (-0.16, -0.08, z0 - 0.01) if side < 0 else (0.02, -0.08, z0 - 0.01)
        hi = (-0.02, 0.08, z1 + 0.01) if side < 0 else (0.16, 0.08, z1 + 0.01)
        objs.append(sdf_obj('Garter.' + nm, g, lo, hi, 0.0016, coll, M['black']))
        cx, cy = leg_axis((z0 + z1) / 2, side)
        ang = math.radians(-20 if side < 0 else 25)
        r = 0.060 if side < 0 else 0.056
        c = np.array([cx + math.sin(ang) * r * side, cy - math.cos(ang) * r, (z0 + z1) / 2])
        Rf = S.rot_matrix(math.radians(90), 0, ang * side)
        frame = S.Subtract(G.heart_node(c, 0.0115, 0.004, Rf), G.heart_node(c + [0, -0.003, 0], 0.0082, 0.02, Rf), k=0.0004)
        objs.append(sdf_obj('GarterRing.' + nm, frame, c - 0.02, c + 0.02, 0.0006, coll, M['gold']))
        objs.append(sdf_obj('GarterHeart.' + nm, G.heart_node(c + [0, -0.0008, 0], 0.0078, 0.0035, Rf, puff=0.0016), c - 0.015, c + 0.015, 0.0005, coll, M['heart']))
        if side > 0:   # dangling charm
            c2 = c + np.array([0.0, -0.002, -0.022])
            objs.append(sdf_obj('GarterCharm.' + nm, G.heart_node(c2, 0.0072, 0.0035, Rf, puff=0.0015), c2 - 0.015, c2 + 0.015, 0.0005, coll, M['heart']))
            link = S.RoundCone(c + [0, -0.001, -0.009], c2 + [0, 0, 0.007], 0.0012, 0.0012)
            objs.append(sdf_obj('GarterLink.' + nm, link, c2 - 0.02, c + 0.02, 0.0005, coll, M['gold']))
    return objs


# ------------------------------------------------------------------ choker
def build_choker(ctx, M):
    coll = ctx['coll']
    rows = np.array(B.NECK_ROWS)
    z = 1.351
    hw = np.interp(z, rows[:, 0], rows[:, 1]) + 0.0035
    fd = np.interp(z, rows[:, 0], rows[:, 2]) + 0.0035
    bd = np.interp(z, rows[:, 0], rows[:, 3]) + 0.0035
    yc = np.interp(z, rows[:, 0], rows[:, 6])
    phi = np.linspace(0, 2 * np.pi, 72, endpoint=False)
    c = np.cos(phi)
    loop = np.stack([np.sin(phi) * hw, np.where(c > 0, -c * fd, -c * bd) + yc, np.full_like(phi, z)], axis=1)
    V, F, UV = G.sweep(loop, G.rounded_rect(0.0038, 0.0135, 0.0015), up_hint=(0, 0, 1), closed=True, cap=False)
    objs = [U.make_mesh('Choker', V, F, coll, mat=M['navy'])]
    studs = []
    for a in np.linspace(0, 2 * np.pi, 22, endpoint=False):
        if abs(math.atan2(math.sin(a), math.cos(a))) < 0.5:
            continue
        cc = math.cos(a)
        p = np.array([math.sin(a) * (hw + 0.0022), (-cc * (fd if cc > 0 else bd)) * ((hw + 0.0022) / hw) + yc, z])
        studs.append(S.Sphere(p, 0.0015))
    objs.append(sdf_obj('ChokerStuds', S.Union(studs), (-0.05, -0.06, z - 0.01), (0.05, 0.05, z + 0.01), 0.0005, coll, M['gold']))
    Rf = S.rot_matrix(math.radians(90) - 0.12, 0, 0)
    hc = np.array([0.0, yc - fd - 0.0045, z - 0.001])
    objs.append(sdf_obj('ChokerHeart', G.heart_node(hc, 0.0108, 0.006, Rf, puff=0.003), hc - 0.02, hc + 0.02, 0.0006, coll, M['heart']))
    ring_c = hc + np.array([0, 0.0005, -0.0125])
    ring = G.Torus(ring_c, 0.0028, 0.0009, S.frame_from_axis((0, 1, 0)))
    beads = [S.Sphere(ring_c + [0, -0.0005, -0.0055 - 0.004 * i], 0.0018 - 0.0002 * i) for i in range(3)]
    objs.append(sdf_obj('ChokerRing', S.Union([ring] + beads), ring_c - 0.02, ring_c + 0.02, 0.0005, coll, M['gold']))
    pc = ring_c + np.array([0, -0.004, -0.028])
    Rp = S.rot_matrix(math.radians(90) - 0.35, 0, 0)
    objs.append(sdf_obj('ChokerPendant', G.heart_node(pc, 0.0105, 0.0055, Rp, puff=0.003), pc - 0.02, pc + 0.02, 0.0006, coll, M['heart']))
    return objs


def materials():
    M = {}
    M['top'] = U.principled('CropTop', (1, 1, 1), rough=0.6, image=tex('top.png'))
    M['top_hem'] = U.principled('HoloPinkTrim', (1, 1, 1), rough=0.3, image=tex('holo_pink.png'))
    M['skirt'] = U.principled('Skirt', (1, 1, 1), rough=0.5, image=tex('skirt.png'), double_sided=True)
    M['skirt_lining'] = U.principled('SkirtLining', (1, 1, 1), rough=0.4, image=tex('holo_dark.png'), double_sided=True)
    M['frill'] = U.principled('Frill', (0.97, 0.96, 1.0), rough=0.5, double_sided=True)
    M['black'] = U.principled('Black', (0.10, 0.10, 0.15), rough=0.6)
    M['navy'] = U.principled('Navy', (0.17, 0.18, 0.32), rough=0.45)
    M['belt'] = U.principled('Belt', (1, 1, 1), rough=0.4, image=tex('belt.png'))
    M['gold'] = U.principled('Gold', (0.98, 0.76, 0.28), rough=0.22, metal=1.0)
    M['heart'] = U.principled('HeartPink', (1.0, 0.52, 0.74), rough=0.18, spec=0.7)
    M['pink'] = U.principled('Pink', (1.0, 0.49, 0.71), rough=0.35)
    M['strap'] = U.principled('Strap', (1, 1, 1), rough=0.45, image=tex('strap.png'))
    M['sock'] = U.principled('HoloSock', (1, 1, 1), rough=0.35, image=tex('sock.png'))
    return M


def hide_skin(ctx, push=0.0045):
    """Pull body skin inward where tight clothing fully covers it (no poke-through)."""
    body = ctx['objects'].get('Body')
    if body is None:
        return
    from .face import vertex_normals
    V = U.mesh_arrays(body)
    N = vertex_normals(V, U.mesh_faces(body))
    x, z = V[:, 0], V[:, 2]
    m = np.zeros(len(V))
    m = np.maximum(m, ((x < -0.02) & (z > 0.115) & (z < 0.680)).astype(float))          # right thigh-high sock
    m = np.maximum(m, ((z > 0.182) & (z < 0.262) & (np.abs(x) > 0.02)).astype(float))   # ankle socks
    m = np.maximum(m, ((z > 0.797) & (z < 1.020)).astype(float))                        # shorts / skirt / belt
    top = (top_region(V) < -0.003).astype(float)
    m = np.maximum(m, top)                                                               # crop top
    Vn = V - N * (push * m)[:, None]
    U.set_verts(body, Vn)
    ctx['log']('hid skin under clothes', int(m.sum()), 'verts')


def build(ctx):
    M = materials()
    ctx['mats'].update({'c_' + k: v for k, v in M.items()})
    objs = []
    for fn in (build_top, build_skirt, build_belt, build_chain, build_straps, build_legwear, build_choker):
        o = fn(ctx, M)
        objs.extend(o)
        ctx['log'](fn.__name__, len(o), 'objects')
    for o in objs:
        ctx['objects'][o.name] = o
    hide_skin(ctx)
