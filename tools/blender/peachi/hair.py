"""Procedural anime hair: a scalp cap plus layered clumps (bangs, face-framing locks,
front locks, side and back hair) grown along the head surface, then hanging with
gravity and body collision. Colors live in vertex colors (brown -> pink by distance
from the root, shine band on top); hair.png adds strand streaks."""
import math
import numpy as np
from . import sdf as S
from . import body as B
from . import util as U
from .config import J

HEAD_C = np.array([0.0, -0.012, 1.472])
GRAV = np.array([0.0, 0.0, -1.0])
LMAX = 0.8   # v coordinate = distance from root / LMAX


def _dirs(P):
    d = P - HEAD_C
    return d / np.maximum(np.linalg.norm(d, axis=1, keepdims=True), 1e-9)


def volume(P):
    """How far the hair surface stands off the skull (meters)."""
    u = _dirs(P)
    fx, fy_f, fy_b = u[:, 0] ** 2, np.maximum(-u[:, 1], 0) ** 2, np.maximum(u[:, 1], 0) ** 2
    s = fx + fy_f + fy_b + 1e-9
    horiz = (0.028 * fx + 0.007 * fy_f + 0.022 * fy_b) / s
    top = np.clip(u[:, 2], 0, 1) ** 2
    v = horiz * (1 - top) + 0.017 * top
    # face-framing locks lie on the cheeks (front-side of the face, below the temples)
    face = np.clip((-u[:, 1] - 0.15) / 0.35, 0, 1) * np.clip((1.49 - P[:, 2]) / 0.03, 0, 1)
    v = v * (1 - face) + 0.0035 * face
    # hair hugs the neck/nape lower down
    low = np.clip((1.43 - P[:, 2]) / 0.05, 0, 1)
    return v * (1 - low) + 0.004 * low


_head = None


def head():
    """Head field for hair growth: the sculpted head plus a matching skull ellipsoid
    (exact distances over the crown, so inflated shells stay smooth at the apex)."""
    global _head
    if _head is None:
        _head = S.Union([B.head_sdf(), S.Ellipsoid((0.0, -0.0065, 1.500), (0.0725, 0.085, 0.0765))], k=0.008)
    return _head


def envelope(extra=0.0):
    h = head()
    return S.Func(lambda P: h(P) - volume(P) - extra, np.array([-0.13, -0.16, 1.30]), np.array([0.13, 0.14, 1.64]))


def collision_sdf():
    """Where hanging hair may not go (head+neck+shoulders+chest+back, arms with sleeves, hood)."""
    h = head()
    headv = S.Func(lambda P: h(P) - volume(P) * 0.9, np.array([-0.13, -0.16, 1.30]), np.array([0.13, 0.14, 1.64]))
    torso = S.Offset(B.torso_sdf(clothed=True), 0.012)
    neck = S.Offset(B.neck_sdf(), 0.006)
    a, e = np.array(J['Arm']), np.array(J['ForeArm'])
    arm = S.RoundCone(a, e, 0.055, 0.07)
    arms = S.Mirror(arm)
    hood = S.Ellipsoid((0.0, 0.085, 1.27), (0.12, 0.05, 0.08))
    return S.Union([headv, torso, neck, arms, hood], k=0.02)


# ------------------------------------------------------------------ clump growth
def _normalize(v):
    return v / max(np.linalg.norm(v), 1e-12)


def _grad(node, p, eps=5e-4):
    P = np.array([p + [eps, 0, 0], p - [eps, 0, 0], p + [0, eps, 0], p - [0, eps, 0], p + [0, 0, eps], p - [0, 0, eps]])
    d = node(P)
    return np.array([d[0] - d[1], d[2] - d[3], d[4] - d[5]]) / (2 * eps)


def _proj(node, p, iters=8, maxstep=0.006):
    for _ in range(iters):
        d = node(p[None])[0]
        if abs(d) < 1e-5:
            break
        g = _grad(node, p)
        gn = np.linalg.norm(g)
        if gn < 1e-6:
            break
        step = d / gn
        step = max(-maxstep, min(maxstep, step))
        p = p - step * g / gn
    return p


def root_point(theta, alpha, env):
    """March inward along the ray from outside the head until the envelope is hit."""
    th, al = math.radians(theta), math.radians(alpha)
    d = np.array([math.sin(th) * math.cos(al), -math.cos(th) * math.cos(al), math.sin(al)])
    r = np.linspace(0.20, 0.03, 341)
    P = HEAD_C + r[:, None] * d
    v = env(P)
    idx = np.argmax(v < 0)
    if v[idx] >= 0:
        idx = len(r) - 1
    r0 = r[max(idx - 1, 0)]; r1 = r[idx]
    for _ in range(20):
        rm = 0.5 * (r0 + r1)
        if env((HEAD_C + rm * d)[None])[0] < 0:
            r1 = rm
        else:
            r0 = rm
    return HEAD_C + 0.5 * (r0 + r1) * d


def initial_rope(spec, env):
    """Root on the envelope + an initial polyline following the flow direction."""
    layer = spec.get('layer', 0.0)
    envl = S.Offset(env, layer) if layer else env
    p = root_point(spec['theta'], spec['alpha'], envl)
    n = _normalize(_grad(envl, p))
    p = p - n * 0.003
    flow = np.array(spec.get('flow', (0, 0, -1)), dtype=float)
    t = _normalize(flow - (flow @ n) * n)
    ds = spec.get('step', 0.005)
    cnt = max(4, int(round(spec['len'] / ds)))
    pts = [p]
    for i in range(cnt):
        t = _normalize(t + GRAV * 0.08 - n * 0.02)
        pts.append(pts[-1] + t * ds)
    return np.array(pts), ds


def drape(specs, env, col, iters=140, log=None):
    """Follow-the-leader rope drape of all clumps at once (gravity + collision)."""
    ropes = [initial_rope(sp, env) for sp in specs]
    C = len(ropes)
    nmax = max(len(r[0]) for r in ropes)
    P = np.zeros((C, nmax, 3)); valid = np.zeros((C, nmax), bool)
    seg = np.zeros(C); layer = np.zeros(C); pin = np.zeros(C, int); stiff = np.zeros(C); margin = np.zeros(C)
    for i, ((pts, ds), sp) in enumerate(zip(ropes, specs)):
        P[i, :len(pts)] = pts; valid[i, :len(pts)] = True
        P[i, len(pts):] = pts[-1]
        seg[i] = ds; layer[i] = sp.get('layer', 0.0); pin[i] = sp.get('pin', 3)
        stiff[i] = sp.get('stiff', 0.25); margin[i] = sp.get('margin', 0.003)
    idx = np.arange(nmax)[None, :]
    free = valid & (idx >= pin[:, None])
    h = head()
    body = col

    def field(Q, lay):
        return np.minimum(h(Q) - volume(Q) - lay, body(Q))

    for it in range(iters):
        g = 0.0016 * (1.0 if it < iters - 20 else 0.3)
        P[free] += GRAV * g
        # bending stiffness: pull interior points toward neighbour midpoint
        mid = np.zeros_like(P)
        mid[:, 1:-1] = 0.5 * (P[:, :-2] + P[:, 2:])
        inner = free.copy(); inner[:, -1] = False
        last = valid.sum(axis=1) - 1
        inner[np.arange(C), last] = False
        P[inner] += (stiff[:, None, None] * (mid - P))[inner]
        # collision
        Q = P[free]
        lay = np.broadcast_to(layer[:, None], free.shape)[free]
        mar = np.broadcast_to(margin[:, None], free.shape)[free]
        d = field(Q, lay)
        hit = d < mar
        if hit.any():
            Qh = Q[hit]; lh = lay[hit]
            eps = 5e-4
            gr = np.stack([(field(Qh + e, lh) - field(Qh - e, lh)) / (2 * eps) for e in np.eye(3) * eps], axis=1)
            gr /= np.maximum(np.linalg.norm(gr, axis=1, keepdims=True), 1e-9)
            Qh += gr * (mar[hit] - d[hit])[:, None]
            Q[hit] = Qh
            P[free] = Q
        # follow the leader: restore segment lengths from the root outward
        for j in range(1, nmax):
            a = P[:, j - 1]; b = P[:, j]
            v = b - a
            L = np.maximum(np.linalg.norm(v, axis=1, keepdims=True), 1e-9)
            nb = a + v / L * seg[:, None]
            m = free[:, j]
            P[m, j] = nb[m]
    out = []
    for i in range(C):
        out.append(P[i, valid[i]])
    return out


def normals_for(P, env, col, layer):
    """Outward direction for orienting clumps: radial from the head centre near the
    head, radial from the body axis lower down (clumps lie flat, never edge-on)."""
    rh = P - HEAD_C
    rb = P.copy(); rb[:, 2] = 0.0; rb[:, 1] -= 0.01
    w = np.clip((P[:, 2] - 1.36) / 0.08, 0, 1)[:, None]
    rh /= np.maximum(np.linalg.norm(rh, axis=1, keepdims=True), 1e-9)
    rb /= np.maximum(np.linalg.norm(rb, axis=1, keepdims=True), 1e-9)
    n = rh * w + rb * (1 - w)
    # smooth along the clump so the ribbon never flips
    for _ in range(3):
        n[1:-1] = 0.5 * n[1:-1] + 0.25 * (n[:-2] + n[2:])
    return n / np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-9)


def _smooth(P, iters=3, lam=0.5, keep=2):
    P = P.copy()
    for _ in range(iters):
        Q = P.copy()
        Q[1:-1] = P[1:-1] + lam * ((P[:-2] + P[2:]) / 2 - P[1:-1])
        Q[:keep] = P[:keep]
        P = Q
    return P


def add_waves(P, N, spec):
    """Sideways S-waves growing along the free part of the clump."""
    amp, wl, ph = spec.get('wave', (0.0, 0.1, 0.0))
    if amp <= 0:
        return P
    seg = np.linalg.norm(np.diff(P, axis=0), axis=1)
    d = np.concatenate([[0], np.cumsum(seg)])
    start = spec.get('wave_start', 0.12)
    ramp = np.clip((d - start) / 0.12, 0, 1)
    T = np.gradient(P, axis=0); T /= np.maximum(np.linalg.norm(T, axis=1, keepdims=True), 1e-9)
    Bn = np.cross(T, N); Bn /= np.maximum(np.linalg.norm(Bn, axis=1, keepdims=True), 1e-9)
    w = amp * ramp * np.sin(2 * np.pi * d / wl + ph)
    w2 = amp * 0.35 * ramp * np.sin(2 * np.pi * d / (wl * 0.7) + ph * 1.7)
    return P + Bn * w[:, None] + N * w2[:, None]


def width_profile(t, spec, L=0.3):
    kind = spec.get('taper', 'long')
    if kind == 'bang':      # wide then sharp point
        w = np.where(t < 0.55, 1.0 + 0.1 * np.sin(t / 0.55 * np.pi), (1 - (t - 0.55) / 0.45) ** 0.8)
    elif kind == 'strand':
        w = (1 - t) ** 0.6
    else:                   # long clumps: slight swell, long taper, pointed tip
        w = np.interp(t, [0, 0.12, 0.5, 0.82, 0.93, 1.0], [0.85, 1.0, 0.9, 0.62, 0.35, 0.0])
    # root blends into the scalp: narrow for the first ~2.5 cm
    root = np.clip(t * L / 0.025, 0, 1)
    w = w * (0.35 + 0.65 * root * root * (3 - 2 * root))
    return np.maximum(w, 0.0)


def clump_mesh(P, N, spec, K=8):
    """Tube with a lens cross-section oriented by the outward normal N."""
    n = len(P)
    T = np.gradient(P, axis=0); T /= np.maximum(np.linalg.norm(T, axis=1, keepdims=True), 1e-9)
    N = N - (np.einsum('ij,ij->i', N, T))[:, None] * T
    N /= np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-9)
    Bn = np.cross(T, N)
    seg = np.linalg.norm(np.diff(P, axis=0), axis=1)
    d = np.concatenate([[0], np.cumsum(seg)])
    t = d / max(d[-1], 1e-9)
    W = spec['w'] * width_profile(t, spec, d[-1])
    rootk = np.clip(t * d[-1] / 0.025, 0, 1)
    TH = spec.get('th', spec['w'] * 0.28) * np.interp(t, [0, 0.6, 1.0], [1.0, 0.75, 0.3]) * (0.45 + 0.55 * rootk)
    bend = spec.get('bend', 0.22)
    twist = spec.get('twist', 0.0)
    verts, uvs, rad, dist = [], [], [], []
    for i in range(n - 1):
        tw = twist * t[i]
        c, s_ = math.cos(tw), math.sin(tw)
        bi = Bn[i] * c + N[i] * s_
        ni = N[i] * c - Bn[i] * s_
        for k in range(K + 1):
            a = 2 * math.pi * k / K
            x = math.cos(a) * W[i] / 2
            y = math.sin(a) * TH[i] / 2 - bend * W[i] * (math.cos(a) ** 2) * 0.5
            verts.append(P[i] + bi * x + ni * y)
            uvs.append((k / K, d[i] / LMAX))
            rad.append(math.sin(a)); dist.append(d[i])
    tip = len(verts)
    verts.append(P[-1]); uvs.append((0.5, d[-1] / LMAX)); rad.append(0.0); dist.append(d[-1])
    faces = []
    R = K + 1
    for i in range(n - 2):
        for k in range(K):
            a0 = i * R + k
            faces.append((a0, a0 + 1, a0 + R + 1, a0 + R))
    last = (n - 2) * R
    for k in range(K):
        faces.append((last + k, last + k + 1, tip))
    # root cap
    root = len(verts)
    verts.append(P[0] - T[0] * 0.001); uvs.append((0.5, 0.0)); rad.append(0.0); dist.append(0.0)
    for k in range(K):
        faces.append((k + 1, k, root))
    return np.array(verts), faces, np.array(uvs), np.array(rad), np.array(dist)


# ------------------------------------------------------------------ colors
HAIR_STOPS = [  # distance from root (m), sRGB  (sheet: dark brown -> warm brown -> rose -> pink tips)
    (0.00, (0.190, 0.110, 0.098)),
    (0.10, (0.265, 0.148, 0.128)),
    (0.19, (0.360, 0.185, 0.165)),
    (0.26, (0.520, 0.250, 0.260)),
    (0.33, (0.820, 0.400, 0.520)),
    (0.42, (0.950, 0.560, 0.690)),
    (0.55, (0.990, 0.710, 0.810)),
]


def hair_color(dist, rad, P, spec):
    shift = spec.get('pink_shift', 0.0)
    dd = dist - shift
    cols = np.array([c for _, c in HAIR_STOPS])
    ds = np.array([s for s, _ in HAIR_STOPS])
    rgb = np.stack([np.interp(dd, ds, cols[:, i]) for i in range(3)], axis=1)
    # darker underside (facing the head), lighter outside
    shade = 0.78 + 0.22 * (0.5 + 0.5 * rad)
    rgb = rgb * shade[:, None]
    # shine band on the upper hair (anime "angel ring")
    band = np.exp(-((P[:, 2] - 1.532) / 0.016) ** 2) * np.clip(rad, 0, 1) * (dist < 0.22)
    rgb = rgb + band[:, None] * np.array([0.30, 0.17, 0.14])
    return np.clip(rgb, 0, 1)


# ------------------------------------------------------------------ specs
def clump_specs():
    S_ = []

    def add(**kw):
        S_.append(kw)

    sn = lambda d: math.sin(math.radians(d))  # noqa: E731
    cs = lambda d: math.cos(math.radians(d))  # noqa: E731
    # --- bangs: top-front roots, drape forward/down over the forehead
    # (theta, length, width, alpha): long thin centre strands, alternating long/short pointed tips,
    # outer bangs sweep outward toward the cheeks (sheet front view)
    bang_rows = [(-38, 0.118, 0.022, 60), (-31, 0.104, 0.020, 62), (-24, 0.112, 0.021, 64), (-17, 0.097, 0.019, 65),
                 (-10, 0.109, 0.018, 66), (-4, 0.126, 0.012, 67), (2, 0.121, 0.011, 67), (8, 0.102, 0.017, 66),
                 (14, 0.110, 0.019, 65), (21, 0.098, 0.020, 64), (28, 0.111, 0.021, 62), (35, 0.104, 0.021, 61),
                 (41, 0.120, 0.022, 59)]
    for i, (th, L, w, al) in enumerate(bang_rows):
        L = L * 1.16
        w = w * 1.25
        add(group='bangs', theta=th, alpha=al, len=L, w=w, th=0.0040, flow=(sn(th) * 0.55, -1.0, 0.1),
            layer=0.0035 + 0.0018 * (i % 2), taper='bang', pin=4, stiff=0.33, lift=0.45, bend=0.14,
            twist=sn(th) * 0.25)
    for th in (-34, -27, -20, -13, -7, 5, 11, 18, 25, 31):   # under-layer fills gaps (shorter)
        add(group='bangs', theta=th, alpha=61, len=0.108, w=0.024, th=0.0038, flow=(sn(th) * 0.45, -1.0, 0.0),
            layer=0.0012, taper='bang', pin=4, stiff=0.35, lift=0.25, bend=0.12)
    # --- face framing locks: temples, down along the cheeks
    for sg in (-1, 1):
        for th, L, w in ((40, 0.150, 0.023), (48, 0.185, 0.024), (56, 0.215, 0.022)):
            add(group='bangs', theta=sg * th, alpha=53, len=L, w=w, th=0.005, flow=(sg * 0.15, -0.9, -0.3),
                layer=0.002, taper='bang', pin=3, stiff=0.3, lift=0.05, twist=sg * 0.25, bend=0.16)
    # --- front locks: in front of the shoulders down the chest (pink ends)
    for sg in (-1, 1):
        sd = 'L' if sg > 0 else 'R'
        for j, (th, al, L, w, sh) in enumerate(((66, 40, 0.50, 0.036, 0.0), (74, 32, 0.54, 0.038, 0.02), (82, 26, 0.48, 0.032, -0.02))):
            add(group='front_' + sd, theta=sg * th, alpha=al, len=L, w=w, th=0.008, flow=(sg * 0.3, -0.6, -0.5),
                layer=0.005 + 0.002 * j, pin=3, stiff=0.26, wave=(0.016, 0.17, j * 1.3 + sg), wave_start=0.15,
                pink_shift=sh, twist=sg * 0.3, bend=0.25)
    # --- side hair: behind the headphones, spilling over the shoulders and upper arms (wide, wavy, pink ends)
    for sg in (-1, 1):
        sd = 'L' if sg > 0 else 'R'
        j = 0
        for al, fwd in ((12, 0.25), (34, 0.10), (52, -0.05)):
            for th in (88, 99, 110, 121):
                L = 0.50 + 0.05 * ((j * 7) % 3) / 2
                add(group='side_' + sd, theta=sg * th, alpha=al + (j % 2) * 4, len=L, w=0.050, th=0.010,
                    flow=(sg * 0.75, 0.25 - fwd, -0.55), layer=0.003 + 0.0028 * (j % 3), pin=3, stiff=0.22,
                    wave=(0.020, 0.16, j * 0.9 + sg * 0.7), wave_start=0.13, pink_shift=-0.02 - 0.012 * (j % 3), bend=0.3)
                j += 1
    # --- back hair: layered, down the back (tips end under the hood)
    k = 0
    for al, L in ((6, 0.33), (28, 0.33), (50, 0.30)):
        for th in range(134, 227, 13):
            thw = th if th <= 180 else th - 360
            add(group='back', theta=thw, alpha=al + (k % 2) * 3, len=L + 0.02 * (k % 3), w=0.052, th=0.011,
                flow=(sn(thw) * 0.2, 0.6, -0.6), layer=0.002 + 0.0025 * (k % 3), pin=3, stiff=0.26,
                wave=(0.008, 0.2, k * 0.77), wave_start=0.16, bend=0.3)
            k += 1
    # --- top layer: from the part line, flowing back / to the sides (lies flat, no bun)
    for th in range(-150, 181, 25):
        a = abs(th)
        if a < 55:
            continue
        grp = 'back' if a > 120 else ('side_L' if th > 0 else 'side_R')
        add(group=grp, theta=th, alpha=68, len=0.30 if a > 100 else 0.36, w=0.050, th=0.008,
            flow=(sn(th) * 0.8, 0.6, -0.4), layer=0.0065, pin=2, stiff=0.3, bend=0.3,
            wave=(0.008, 0.2, a * 0.03), wave_start=0.16)
    # --- thin flyaway strands for a wavy silhouette
    for sg in (-1, 1):
        sd = 'L' if sg > 0 else 'R'
        for j, (th, al, L) in enumerate(((96, 44, 0.52), (118, 40, 0.48), (72, 44, 0.44))):
            add(group=('side_' if j < 2 else 'front_') + sd, theta=sg * th, alpha=al, len=L, w=0.007, th=0.003,
                taper='strand', flow=(sg * 0.6, 0.1, -0.8), layer=0.011, pin=3, stiff=0.2,
                wave=(0.022, 0.15, j * 1.1), wave_start=0.12, margin=0.006, bend=0.1)
    return S_


# ------------------------------------------------------------------ cap
def hairline_z(P):
    u = _dirs(P)
    th = np.degrees(np.arctan2(u[:, 0], -u[:, 1]))   # 0 = front, +-180 = back
    a = np.abs(th)
    return np.interp(a, [0, 30, 60, 90, 120, 150, 180], [1.505, 1.498, 1.472, 1.440, 1.415, 1.400, 1.395])


def cap_sdf():
    h = head()

    def f(P):
        hv = h(P)
        outer = hv - volume(P) + 0.0035
        inner = -(hv + 0.002)
        line = hairline_z(P) - P[:, 2]
        return S.smax(S.smax(outer, inner, 0.0), line, 0.004)
    return S.Func(f, np.array([-0.12, -0.14, 1.36]), np.array([0.12, 0.13, 1.62]))


# ------------------------------------------------------------------ build
def build(ctx):
    coll, mats, log = ctx['coll'], ctx['mats'], ctx['log']
    env = envelope()
    col = collision_sdf()
    # cap
    V, F = S.sdf_to_mesh(cap_sdf(), np.array([-0.12, -0.14, 1.36]), np.array([0.12, 0.13, 1.62]), h=0.0025)
    dist = np.maximum(0.0, 1.60 - V[:, 2]) * 0.6
    rad = np.clip(_dirs(V)[:, 2], 0, 1)
    colr = hair_color(dist, rad * 0 + 0.3, V, {})
    cap = U.make_mesh('HairCap', V, F, coll, mat=mats['hair'])
    U.set_vcol(cap.data, U.srgb_to_lin(colr))
    uv = np.stack([V[:, 0] * 4 + 0.5, (1.60 - V[:, 2]) / LMAX], axis=1)
    U.set_uv(cap.data, uv)
    U.decimate(cap, 0.25, symmetric=True)
    log('hair cap', len(V))
    # clumps
    allV, allF, allUV, allC, off = [], [], [], [], 0
    paths = []
    specs = clump_specs()
    ropes = drape(specs, env, col)
    log('draped', len(ropes), 'clumps')
    for sp, P in zip(specs, ropes):
        N = normals_for(P, env, col, sp.get('layer', 0.0))
        lift = sp.get('lift', 0.0)
        if lift:
            tt = np.linspace(0, 1, len(P))
            P = P + N * (lift * 0.02 * tt ** 2)[:, None]
        P = add_waves(P, N, sp)
        P = _smooth(P, iters=2, keep=3)
        Ltot = np.linalg.norm(np.diff(P, axis=0), axis=1).sum()
        m = max(6, int(Ltot / 0.0075))
        idx = np.linspace(0, len(P) - 1, m + 1)
        P = np.stack([np.interp(idx, np.arange(len(P)), P[:, i]) for i in range(3)], axis=1)
        N = np.stack([np.interp(idx, np.arange(len(N)), N[:, i]) for i in range(3)], axis=1)
        Vc, Fc, UVc, R, D = clump_mesh(P, N, sp)
        allV.append(Vc); allF.extend([tuple(x + off for x in f) for f in Fc]); allUV.append(UVc)
        allC.append(hair_color(D, R, Vc, sp))
        paths.append({'group': sp['group'], 'points': P, 'vstart': off, 'vcount': len(Vc), 'dist': D,
                      'theta': sp['theta'], 'taper': sp.get('taper', 'long')})
        off += len(Vc)
    V = np.concatenate(allV); UV = np.concatenate(allUV); Cc = np.concatenate(allC)
    ob = U.make_mesh('Hair', V, allF, coll, mat=mats['hair'], uv=UV)
    U.set_vcol(ob.data, U.srgb_to_lin(Cc))
    ctx['objects']['Hair'] = ob
    ctx['objects']['HairCap'] = cap
    ctx['hair_paths'] = paths
    log('hair clumps', len(specs), 'verts', len(V))
