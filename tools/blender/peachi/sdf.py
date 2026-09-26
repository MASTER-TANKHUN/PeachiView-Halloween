"""Tiny signed-distance-field toolkit (numpy only) + OpenVDB meshing.

Shapes are a tree of nodes; every node is callable on an (N,3) array of points and
returns (N,) signed distances (negative inside). Unions cull children by bounding box
so dense grids stay cheap.
"""
import numpy as np

INF = 10.0


def _v(a):
    return np.asarray(a, dtype=np.float64)


def smin(a, b, k):
    if k <= 0:
        return np.minimum(a, b)
    h = np.clip(0.5 + 0.5 * (b - a) / k, 0.0, 1.0)
    return b * (1 - h) + a * h - k * h * (1 - h)


def smax(a, b, k):
    return -smin(-a, -b, k)


def rot_matrix(rx=0.0, ry=0.0, rz=0.0):
    """XYZ euler (radians) -> 3x3 matrix (local -> world, v_world = R @ v_local)."""
    cx, sx, cy, sy, cz, sz = np.cos(rx), np.sin(rx), np.cos(ry), np.sin(ry), np.cos(rz), np.sin(rz)
    Rx = np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]])
    Ry = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])
    Rz = np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]])
    return Rz @ Ry @ Rx


def frame_from_axis(axis, up=(0, 0, 1)):
    """Rotation (columns x,y,z) whose local +Z points along `axis`."""
    z = _v(axis) / np.linalg.norm(axis)
    u = _v(up)
    if abs(np.dot(z, u)) > 0.95:
        u = np.array([1.0, 0, 0]) if abs(z[0]) < 0.9 else np.array([0, 1.0, 0])
    x = np.cross(u, z); x /= np.linalg.norm(x)
    y = np.cross(z, x)
    return np.stack([x, y, z], axis=1)


class Node:
    def bounds(self):
        raise NotImplementedError

    def __call__(self, P):
        raise NotImplementedError


# ------------------------------------------------------------------ primitives
class Sphere(Node):
    def __init__(self, c, r):
        self.c, self.r = _v(c), float(r)

    def bounds(self):
        return self.c - self.r, self.c + self.r

    def __call__(self, P):
        return np.linalg.norm(P - self.c, axis=1) - self.r


class Ellipsoid(Node):
    """Approximate (IQ) ellipsoid distance; R = local->world rotation."""

    def __init__(self, c, radii, R=None):
        self.c, self.r = _v(c), _v(radii)
        self.R = np.eye(3) if R is None else _v(R)

    def bounds(self):
        m = self.r.max()
        return self.c - m, self.c + m

    def __call__(self, P):
        q = (P - self.c) @ self.R
        k0 = np.linalg.norm(q / self.r, axis=1)
        k1 = np.maximum(np.linalg.norm(q / (self.r * self.r), axis=1), 1e-9)
        return k0 * (k0 - 1.0) / k1


class RoundCone(Node):
    """Exact capsule with different end radii (IQ sdRoundCone)."""

    def __init__(self, a, b, ra, rb):
        self.a, self.b, self.ra, self.rb = _v(a), _v(b), float(ra), float(rb)

    def bounds(self):
        r = max(self.ra, self.rb)
        return np.minimum(self.a, self.b) - r, np.maximum(self.a, self.b) + r

    def __call__(self, P):
        a, b, r1, r2 = self.a, self.b, self.ra, self.rb
        ba = b - a
        l2 = ba @ ba
        rr = r1 - r2
        a2 = l2 - rr * rr
        il2 = 1.0 / l2
        pa = P - a
        y = pa @ ba
        z = y - l2
        x2v = pa * l2 - y[:, None] * ba
        x2 = np.einsum('ij,ij->i', x2v, x2v)
        y2 = y * y * l2
        z2 = z * z * l2
        k = np.sign(rr) * rr * rr * x2
        d3 = (np.sqrt(np.maximum(x2 * a2 * il2, 0)) + y * rr) * il2 - r1
        d1 = np.sqrt(x2 + z2) * il2 - r2
        d2 = np.sqrt(x2 + y2) * il2 - r1
        return np.where(np.sign(z) * a2 * z2 > k, d1, np.where(np.sign(y) * a2 * y2 < k, d2, d3))


class RoundBox(Node):
    def __init__(self, c, half, r=0.0, R=None):
        self.c, self.h, self.r = _v(c), _v(half), float(r)
        self.R = np.eye(3) if R is None else _v(R)

    def bounds(self):
        m = np.linalg.norm(self.h) + self.r
        return self.c - m, self.c + m

    def __call__(self, P):
        q = np.abs((P - self.c) @ self.R) - (self.h - self.r)
        return np.linalg.norm(np.maximum(q, 0), axis=1) + np.minimum(q.max(axis=1), 0) - self.r


class Plane(Node):
    """Half space, negative on the side opposite to the normal."""

    def __init__(self, p, n, box=None):
        self.p = _v(p); self.n = _v(n) / np.linalg.norm(n)
        self.box = box

    def bounds(self):
        if self.box is not None:
            return _v(self.box[0]), _v(self.box[1])
        return np.full(3, -INF), np.full(3, INF)

    def __call__(self, P):
        return (P - self.p) @ self.n


class Func(Node):
    def __init__(self, fn, lo, hi):
        self.fn, self.lo, self.hi = fn, _v(lo), _v(hi)

    def bounds(self):
        return self.lo, self.hi

    def __call__(self, P):
        return self.fn(P)


def chain(points, radii, k=0.0):
    segs = [RoundCone(points[i], points[i + 1], radii[i], radii[i + 1]) for i in range(len(points) - 1)]
    return Union(segs, k=k)


# ------------------------------------------------------------------ combinators
class Union(Node):
    def __init__(self, children, k=0.0):
        self.children = [c for c in children if c is not None]
        self.k = float(k)
        self._b = None

    def bounds(self):
        if self._b is None:
            los, his = zip(*[c.bounds() for c in self.children])
            self._b = (np.min(los, axis=0), np.max(his, axis=0))
        return self._b

    def __call__(self, P):
        d = np.full(len(P), INF)
        pad = self.k + 0.02
        for c in self.children:
            lo, hi = c.bounds()
            m = np.all((P >= lo - pad) & (P <= hi + pad), axis=1)
            if not m.any():
                continue
            d[m] = smin(d[m], c(P[m]), self.k)
        return d


class Subtract(Node):
    """a minus b (smooth)."""

    def __init__(self, a, b, k=0.0):
        self.a, self.b, self.k = a, b, float(k)

    def bounds(self):
        return self.a.bounds()

    def __call__(self, P):
        d = self.a(P)
        lo, hi = self.b.bounds()
        pad = self.k + 0.02
        m = np.all((P >= lo - pad) & (P <= hi + pad), axis=1)
        if m.any():
            d[m] = smax(d[m], -self.b(P[m]), self.k)
        return d


class Intersect(Node):
    def __init__(self, a, b, k=0.0):
        self.a, self.b, self.k = a, b, float(k)

    def bounds(self):
        la, ha = self.a.bounds(); lb, hb = self.b.bounds()
        return np.maximum(la, lb), np.minimum(ha, hb)

    def __call__(self, P):
        return smax(self.a(P), self.b(P), self.k)


class Offset(Node):
    def __init__(self, child, dist):
        self.c, self.dist = child, float(dist)

    def bounds(self):
        lo, hi = self.c.bounds()
        return lo - abs(self.dist), hi + abs(self.dist)

    def __call__(self, P):
        return self.c(P) - self.dist


class Shell(Node):
    """Layer between offsets inner..outer of a child surface."""

    def __init__(self, child, inner, outer):
        self.c, self.i, self.o = child, float(inner), float(outer)

    def bounds(self):
        lo, hi = self.c.bounds()
        return lo - abs(self.o), hi + abs(self.o)

    def __call__(self, P):
        d = self.c(P)
        return np.maximum(d - self.o, self.i - d)


class Transform(Node):
    def __init__(self, child, R=None, t=(0, 0, 0)):
        self.c = child
        self.R = np.eye(3) if R is None else _v(R)
        self.t = _v(t)

    def bounds(self):
        lo, hi = self.c.bounds()
        corners = np.array([[x, y, z] for x in (lo[0], hi[0]) for y in (lo[1], hi[1]) for z in (lo[2], hi[2])])
        w = corners @ self.R.T + self.t
        return w.min(axis=0), w.max(axis=0)

    def __call__(self, P):
        return self.c((P - self.t) @ self.R)


class Mirror(Node):
    """Evaluate child at |x| (symmetric about x = 0)."""

    def __init__(self, child):
        self.c = child

    def bounds(self):
        lo, hi = self.c.bounds()
        m = max(abs(lo[0]), abs(hi[0]))
        return np.array([-m, lo[1], lo[2]]), np.array([m, hi[1], hi[2]])

    def __call__(self, P):
        Q = P.copy(); Q[:, 0] = np.abs(Q[:, 0])
        return self.c(Q)


class Displace(Node):
    def __init__(self, child, fn, amp=0.01):
        self.c, self.fn, self.amp = child, fn, amp

    def bounds(self):
        lo, hi = self.c.bounds()
        return lo - self.amp, hi + self.amp

    def __call__(self, P):
        return self.c(P) + self.fn(P)


# ------------------------------------------------------------------ loft
def pchip(xs, ys):
    """Monotone cubic interpolator (vectorised)."""
    xs, ys = _v(xs), _v(ys)
    h = np.diff(xs); dl = np.diff(ys) / h
    n = len(xs)
    m = np.zeros(n)
    for i in range(1, n - 1):
        if dl[i - 1] * dl[i] > 0:
            w1, w2 = 2 * h[i] + h[i - 1], h[i] + 2 * h[i - 1]
            m[i] = (w1 + w2) / (w1 / dl[i - 1] + w2 / dl[i])
    m[0], m[-1] = dl[0], dl[-1]

    def f(x):
        x = np.clip(x, xs[0], xs[-1])
        i = np.clip(np.searchsorted(xs, x) - 1, 0, n - 2)
        t = (x - xs[i]) / h[i]
        t2, t3 = t * t, t * t * t
        return ((2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h[i] * m[i]
                + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h[i] * m[i + 1])
    return f


class Loft(Node):
    """Horizontal super-ellipse sections stacked along z.

    rows: (z, half_width, front_depth(toward -Y), back_depth(toward +Y), exponent, x_center, y_center)
    """

    def __init__(self, rows, cap=True):
        rows = np.array(rows, dtype=np.float64)
        self.z0, self.z1 = rows[0, 0], rows[-1, 0]
        self.f = [pchip(rows[:, 0], rows[:, i]) for i in range(1, rows.shape[1])]
        self.cap = cap
        self.maxw = rows[:, 1].max() + (np.abs(rows[:, 5]).max() if rows.shape[1] > 5 else 0)
        self.maxd = max(rows[:, 2].max(), rows[:, 3].max()) + (np.abs(rows[:, 6]).max() if rows.shape[1] > 6 else 0)

    def bounds(self):
        return np.array([-self.maxw, -self.maxd, self.z0]), np.array([self.maxw, self.maxd, self.z1])

    def __call__(self, P):
        z = P[:, 2]
        a = self.f[0](z); fd = self.f[1](z); bd = self.f[2](z)
        n = self.f[3](z) if len(self.f) > 3 else np.full_like(z, 2.0)
        xc = self.f[4](z) if len(self.f) > 4 else 0.0
        yc = self.f[5](z) if len(self.f) > 5 else 0.0
        x = P[:, 0] - xc
        y = P[:, 1] - yc
        r = np.where(y < 0, fd, bd)
        u = np.abs(x) / a; v = np.abs(y) / r
        rho = np.maximum((u ** n + v ** n) ** (1.0 / n), 1e-9)
        gx = (np.maximum(u, 1e-12) / rho) ** (n - 1) / a
        gy = (np.maximum(v, 1e-12) / rho) ** (n - 1) / r
        d = (rho - 1.0) / (np.sqrt(gx * gx + gy * gy) + 1e-9)
        if self.cap:
            d = np.maximum(d, np.maximum(self.z0 - z, z - self.z1))
        return d


# ------------------------------------------------------------------ meshing
def eval_grid(node, lo, hi, h, slab=12):
    lo, hi = _v(lo), _v(hi)
    n = np.ceil((hi - lo) / h).astype(int) + 1
    xs = lo[0] + np.arange(n[0]) * h
    ys = lo[1] + np.arange(n[1]) * h
    zs = lo[2] + np.arange(n[2]) * h
    out = np.empty((n[0], n[1], n[2]), dtype=np.float32)
    X, Y = np.meshgrid(xs, ys, indexing='ij')
    X = X.ravel(); Y = Y.ravel()
    for k0 in range(0, n[2], slab):
        k1 = min(n[2], k0 + slab)
        Z = zs[k0:k1]
        P = np.empty((len(X) * len(Z), 3))
        P[:, 0] = np.tile(X, len(Z)); P[:, 1] = np.tile(Y, len(Z)); P[:, 2] = np.repeat(Z, len(X))
        d = node(P)
        out[:, :, k0:k1] = d.reshape(len(Z), n[0], n[1]).transpose(1, 2, 0)
    return out, lo, h


def mesh_grid(values, origin, h, adaptivity=0.0):
    import openvdb as vdb
    g = vdb.FloatGrid(float(INF))
    g.copyFromArray(np.ascontiguousarray(values, dtype=np.float32))
    if adaptivity > 0:
        pts, tris, quads = g.convertToPolygons(0.0, adaptivity)
        V = origin + np.asarray(pts, dtype=np.float64) * h
        return V, np.asarray(quads, dtype=np.int64), np.asarray(tris, dtype=np.int64)
    pts, quads = g.convertToQuads(0.0)
    V = origin + np.asarray(pts, dtype=np.float64) * h
    return V, np.asarray(quads, dtype=np.int64), None


def gradient(node, P, eps=4e-4):
    g = np.empty_like(P)
    for i in range(3):
        e = np.zeros(3); e[i] = eps
        g[:, i] = (node(P + e) - node(P - e)) / (2 * eps)
    return g


def project(node, V, iters=3, eps=4e-4, maxstep=0.01):
    V = V.copy()
    for _ in range(iters):
        d = node(V)
        g = gradient(node, V, eps)
        gg = np.einsum('ij,ij->i', g, g) + 1e-12
        step = (d / gg)[:, None] * g
        n = np.linalg.norm(step, axis=1, keepdims=True)
        step *= np.minimum(1.0, maxstep / np.maximum(n, 1e-12))
        V -= step
    return V


def edges_of(F):
    k = F.shape[1]
    e = np.concatenate([F[:, [i, (i + 1) % k]] for i in range(k)])
    e = np.concatenate([e, e[:, ::-1]])
    return np.unique(e, axis=0)


def relax(V, F, iters=2, lam=0.5, pin=None):
    e = edges_of(F)
    cnt = np.bincount(e[:, 0], minlength=len(V)).astype(np.float64)
    for _ in range(iters):
        acc = np.zeros_like(V)
        np.add.at(acc, e[:, 0], V[e[:, 1]])
        avg = acc / np.maximum(cnt, 1)[:, None]
        delta = lam * (avg - V)
        if pin is not None:
            delta[pin] = 0
        V = V + delta
    return V


def fix_orientation(V, F):
    tri = np.concatenate([F[:, [0, 1, 2]], F[:, [0, 2, 3]]])
    a, b, c = V[tri[:, 0]], V[tri[:, 1]], V[tri[:, 2]]
    vol = np.einsum('ij,ij->i', a, np.cross(b, c)).sum() / 6.0
    return F[:, ::-1].copy() if vol < 0 else F


def sdf_to_mesh(node, lo=None, hi=None, h=0.004, relax_iters=2, project_iters=3, pad=0.01):
    if lo is None:
        lo, hi = node.bounds()
        lo = _v(lo) - pad; hi = _v(hi) + pad
    vals, origin, h = eval_grid(node, lo, hi, h)
    V, F, _ = mesh_grid(vals, origin, h)
    if len(F) == 0:
        return V, F
    F = fix_orientation(V, F)
    V = project(node, V, iters=project_iters, eps=h * 0.25, maxstep=h * 2)
    for _ in range(relax_iters):
        V = relax(V, F, iters=1, lam=0.5)
        V = project(node, V, iters=2, eps=h * 0.25, maxstep=h * 2)
    return V, F
