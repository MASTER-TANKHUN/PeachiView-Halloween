"""Mesh-building helpers shared by clothes / accessories (numpy, Blender-free)."""
import math
import numpy as np
from . import sdf as S


def normalize(v, axis=-1):
    return v / np.maximum(np.linalg.norm(v, axis=axis, keepdims=True), 1e-12)


def catmull(pts, n=12, closed=False):
    P = np.asarray(pts, float)
    if closed:
        P = np.concatenate([P[-1:], P, P[:2]])
    else:
        P = np.concatenate([2 * P[:1] - P[1:2], P, 2 * P[-1:] - P[-2:-1]])
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for t in np.linspace(0, 1, n, endpoint=False):
            t2, t3 = t * t, t * t * t
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    if not closed:
        out.append(P[-2])
    return np.array(out)


def resample(P, step):
    seg = np.linalg.norm(np.diff(P, axis=0), axis=1)
    d = np.concatenate([[0], np.cumsum(seg)])
    n = max(2, int(round(d[-1] / step)) + 1)
    t = np.linspace(0, d[-1], n)
    return np.stack([np.interp(t, d, P[:, i]) for i in range(P.shape[1])], axis=1)


def frames(P, up_hint=None, closed=False):
    """Tangent/normal/binormal along a polyline. up_hint: (n,3) or (3,) preferred normal."""
    if closed:
        T = normalize(np.roll(P, -1, axis=0) - np.roll(P, 1, axis=0))
    else:
        T = normalize(np.gradient(P, axis=0))
    if up_hint is None:
        up_hint = np.array([0, 0, 1.0])
    U = np.broadcast_to(np.asarray(up_hint, float), P.shape).copy()
    N = U - np.einsum('ij,ij->i', U, T)[:, None] * T
    bad = np.linalg.norm(N, axis=1) < 1e-6
    if bad.any():
        alt = np.cross(T[bad], [1.0, 0, 0])
        N[bad] = alt
    N = normalize(N)
    B = np.cross(T, N)
    return T, N, B


def sweep(P, profile, up_hint=None, closed=False, cap=True, scale=None, u_len=None, return_prof=False):
    """Sweep a closed 2D profile ((k,2) in (binormal, normal) coords) along P.
    Returns V, F(quads/tris list), UV (u = around profile 0..1, v = distance / u_len)."""
    P = np.asarray(P, float)
    T, N, Bn = frames(P, up_hint, closed)
    prof = np.asarray(profile, float)
    k = len(prof)
    n = len(P)
    if scale is None:
        scale = np.ones(n)
    scale = np.broadcast_to(np.asarray(scale, float), (n,))
    seg = np.linalg.norm(np.diff(P, axis=0), axis=1)
    dist = np.concatenate([[0], np.cumsum(seg)])
    if u_len is None:
        u_len = max(dist[-1], 1e-6)
    V, UV, PR = [], [], []
    for i in range(n):
        for j in range(k + 1):
            x, y = prof[j % k] * scale[i]
            V.append(P[i] + Bn[i] * x + N[i] * y)
            UV.append((j / k, dist[i] / u_len))
            PR.append((prof[j % k][0], prof[j % k][1]))
    V = np.array(V); UV = np.array(UV); PR = np.array(PR)
    F = []
    R = k + 1
    rings = n if not closed else n + 1
    for i in range(rings - 1):
        a = i % n; b = (i + 1) % n
        for j in range(k):
            F.append((a * R + j, a * R + j + 1, b * R + j + 1, b * R + j))
    if cap and not closed:
        for idx, rev in ((0, True), (n - 1, False)):
            c = len(V)
            V = np.vstack([V, P[idx]]); UV = np.vstack([UV, [0.5, dist[idx] / u_len]]); PR = np.vstack([PR, [0.0, 0.0]])
            for j in range(k):
                f = (idx * R + j, idx * R + j + 1, c)
                F.append(f[::-1] if rev else f)
    if return_prof:
        return V, F, UV, PR
    return V, F, UV


def rounded_rect(w, h, r, seg=3):
    """Closed CCW profile of a rounded rectangle centred at 0."""
    r = min(r, w / 2, h / 2)
    pts = []
    for cx, cy, a0 in ((w / 2 - r, h / 2 - r, 0), (-w / 2 + r, h / 2 - r, 90), (-w / 2 + r, -h / 2 + r, 180), (w / 2 - r, -h / 2 + r, 270)):
        for i in range(seg + 1):
            a = math.radians(a0 + 90 * i / seg)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return np.array(pts)


def ellipse(w, h, k=12):
    t = np.linspace(0, 2 * np.pi, k, endpoint=False)
    return np.stack([np.cos(t) * w / 2, np.sin(t) * h / 2], axis=1)


def ring_path(center, radii, z_axis=(0, 0, 1), n=48, phase=0.0, rot=None):
    """Closed elliptical loop (for bands around limbs / waist)."""
    t = np.linspace(0, 2 * np.pi, n, endpoint=False) + phase
    Rm = S.frame_from_axis(z_axis) if rot is None else rot
    loc = np.stack([np.cos(t) * radii[0], np.sin(t) * radii[1], np.zeros_like(t)], axis=1)
    return loc @ Rm.T + np.asarray(center, float)


# ------------------------------------------------------------------ 2D SDFs extruded (hearts, frames)
def heart2d(p, s):
    """IQ heart centred at the origin, lobes up; s = half width (m)."""
    k = s / 0.6036
    x = np.abs(p[:, 0]) / k
    y = p[:, 1] / k + 0.55
    d1 = np.sqrt((x - 0.25) ** 2 + (y - 0.75) ** 2) - np.sqrt(2) / 4
    m = 0.5 * np.maximum(x + y, 0.0)
    d2 = np.sqrt(np.minimum(x ** 2 + (y - 1.0) ** 2, (x - m) ** 2 + (y - m) ** 2)) * np.sign(x - y)
    return np.where(x + y > 1.0, d1, d2) * k


class Extrude(S.Node):
    """Extrude a 2D sdf (in the local x/y plane) to thickness t with rounding r."""

    def __init__(self, fn2d, half_extent, thick, round_r, R=None, c=(0, 0, 0)):
        self.fn, self.h, self.t, self.r = fn2d, half_extent, thick, round_r
        self.R = np.eye(3) if R is None else np.asarray(R, float)
        self.c = np.asarray(c, float)

    def bounds(self):
        m = self.h + self.t + self.r
        return self.c - m, self.c + m

    def __call__(self, P):
        q = (P - self.c) @ self.R
        d2 = self.fn(q[:, :2]) + self.r
        w = np.stack([d2, np.abs(q[:, 2]) - self.t / 2 + self.r], axis=1)
        return np.minimum(np.maximum(w[:, 0], w[:, 1]), 0) + np.linalg.norm(np.maximum(w, 0), axis=1) - self.r


def heart_node(center, size, thick, R=None, puff=0.0):
    """Puffy extruded heart. size = half width (m)."""
    hn = Extrude(lambda p: heart2d(p, size * 1.0), size * 1.3, thick, min(thick * 0.45, size * 0.3), R, center)
    if puff > 0:
        return S.Union([hn, S.Ellipsoid(center, (size * 0.75, size * 0.6, thick * 0.5 + puff), R)], k=size * 0.3)
    return hn


def box_frame(center, outer, inner, thick, round_r, R=None):
    """Rectangular ring (buckle / D-ring)."""
    o = S.RoundBox(center, (outer[0] / 2, outer[1] / 2, thick / 2), round_r, R)
    i = S.RoundBox(center, (inner[0] / 2, inner[1] / 2, thick), round_r * 0.5, R)
    return S.Subtract(o, i, k=0.0)


class Torus(S.Node):
    def __init__(self, c, R_major, r_minor, Rm=None):
        self.c, self.Rm_, self.r = np.asarray(c, float), R_major, r_minor
        self.M = np.eye(3) if Rm is None else np.asarray(Rm, float)

    def bounds(self):
        m = self.Rm_ + self.r
        return self.c - m, self.c + m

    def __call__(self, P):
        q = (P - self.c) @ self.M
        qx = np.sqrt(q[:, 0] ** 2 + q[:, 1] ** 2) - self.Rm_
        return np.sqrt(qx ** 2 + q[:, 2] ** 2) - self.r


def merge(parts):
    """Concatenate (V, F, UV|None) parts into one mesh."""
    Vs, Fs, UVs, off = [], [], [], 0
    has_uv = all(p[2] is not None for p in parts)
    for V, F, UV in parts:
        Vs.append(np.asarray(V))
        Fs.extend([tuple(int(i) + off for i in f) for f in (F.tolist() if isinstance(F, np.ndarray) else F)])
        if has_uv:
            UVs.append(np.asarray(UV))
        off += len(V)
    return np.concatenate(Vs), Fs, (np.concatenate(UVs) if has_uv else None)
