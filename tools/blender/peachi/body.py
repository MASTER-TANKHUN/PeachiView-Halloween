"""Body, head and hand shapes as signed distance fields (Blender space, meters)."""
import math
import numpy as np
from . import sdf as S
from .config import J, ARM_DIR

V = np.array


def _lerp(a, b, t):
    return tuple(np.asarray(a, float) + (np.asarray(b, float) - np.asarray(a, float)) * t)


# ------------------------------------------------------------------ torso
# (z, half_width, front_depth, back_depth, exponent, x_center, y_center)
TORSO_ROWS = [
    (0.780, 0.080, 0.048, 0.052, 2.0, 0.0, 0.004),
    (0.830, 0.094, 0.054, 0.064, 2.1, 0.0, 0.004),
    (0.880, 0.101, 0.057, 0.070, 2.2, 0.0, 0.004),
    (0.930, 0.100, 0.059, 0.066, 2.2, 0.0, 0.004),
    (0.975, 0.092, 0.061, 0.058, 2.15, 0.0, 0.004),
    (1.010, 0.082, 0.065, 0.052, 2.1, 0.0, 0.004),
    (1.045, 0.071, 0.070, 0.048, 2.0, 0.0, 0.004),
    (1.080, 0.066, 0.073, 0.047, 2.0, 0.0, 0.004),
    (1.120, 0.073, 0.075, 0.050, 2.1, 0.0, 0.004),
    (1.165, 0.079, 0.074, 0.054, 2.2, 0.0, 0.004),
    (1.215, 0.082, 0.069, 0.057, 2.3, 0.0, 0.004),
    (1.255, 0.080, 0.061, 0.058, 2.4, 0.0, 0.004),
    (1.285, 0.070, 0.052, 0.055, 2.3, 0.0, 0.004),
    (1.308, 0.052, 0.040, 0.047, 2.1, 0.0, 0.006),
    (1.330, 0.036, 0.030, 0.038, 2.0, 0.0, 0.008),
]


def breast_sdf(clothed=False):
    R = S.rot_matrix(math.radians(-8), 0, math.radians(12))
    lower = S.Ellipsoid((0.046, -0.080, 1.200), (0.044, 0.046, 0.041), R)
    slope = S.RoundCone((0.034, -0.050, 1.268), (0.044, -0.094, 1.212), 0.020, 0.032)
    parts = [lower, slope]
    if clothed:  # fabric bridges the under-bust crease
        parts.append(S.RoundCone((0.042, -0.090, 1.200), (0.040, -0.086, 1.122), 0.040, 0.037))
    return S.Union(parts, k=0.022)


def torso_sdf(clothed=False):
    glute = S.Ellipsoid((0.044, 0.040, 0.878), (0.054, 0.044, 0.062))
    clav = S.RoundCone((0.012, -0.036, 1.318), (0.100, -0.004, 1.300), 0.0105, 0.0095)
    trap = S.RoundCone((0.018, 0.022, 1.330), (0.100, 0.012, 1.296), 0.024, 0.020)
    delt = S.Ellipsoid(_lerp(J['Arm'], (J['Arm'][0] + 0.02, J['Arm'][1], J['Arm'][2] - 0.035), 0.5),
                       (0.030, 0.034, 0.044), S.rot_matrix(0, -0.35, 0))
    scap = S.Ellipsoid((0.050, 0.050, 1.215), (0.042, 0.018, 0.060))
    side = S.Union([breast_sdf(clothed), glute, clav, trap, delt, scap], k=0.0)
    return S.Union([S.Loft(TORSO_ROWS), S.Mirror(side)], k=0.03 if not clothed else 0.04)


NECK_ROWS = [  # (z, hw, fd, bd, n, xc, yc) - thin anime neck, tilted forward
    (1.270, 0.046, 0.040, 0.042, 2.0, 0.0, 0.004),
    (1.290, 0.039, 0.033, 0.036, 2.0, 0.0, 0.001),
    (1.312, 0.0335, 0.028, 0.031, 2.0, 0.0, -0.005),
    (1.335, 0.0315, 0.026, 0.028, 2.0, 0.0, -0.011),
    (1.360, 0.0308, 0.025, 0.027, 2.0, 0.0, -0.014),
    (1.390, 0.0305, 0.025, 0.028, 2.0, 0.0, -0.012),
    (1.425, 0.0305, 0.026, 0.030, 2.0, 0.0, -0.008),
]


def neck_sdf(z0=1.270, z1=1.425):
    rows = [r for r in NECK_ROWS if z0 - 1e-6 <= r[0] <= z1 + 1e-6]
    return S.Loft(rows)


def arm_sdf():
    a, e, w = V(J['Arm']), V(J['ForeArm']), V(J['Hand'])
    pts = [a, _lerp(a, e, 0.45), e, _lerp(e, w, 0.35), _lerp(e, w, 0.8), w + (w - e) * 0.08]
    radii = [0.031, 0.0285, 0.0215, 0.0235, 0.0195, 0.0165]
    return S.chain(pts, radii)


LEG_PTS = [(0.062, 0.010, 0.885), (0.072, 0.000, 0.730), (0.079, -0.004, 0.600), (0.083, -0.003, 0.508),
           (0.086, 0.006, 0.455), (0.090, 0.020, 0.380), (0.094, 0.032, 0.290), (0.097, 0.040, 0.200),
           (0.098, 0.044, 0.105)]
LEG_R = [0.066, 0.059, 0.046, 0.036, 0.034, 0.035, 0.029, 0.0235, 0.022]


def leg_sdf():
    leg = S.chain(LEG_PTS, LEG_R)
    calf = S.Ellipsoid((0.089, 0.030, 0.405), (0.027, 0.028, 0.065))
    knee = S.Ellipsoid((0.083, -0.028, 0.515), (0.021, 0.012, 0.024))
    foot = S.RoundCone((0.098, 0.044, 0.085), (0.099, -0.050, 0.055), 0.024, 0.020)
    return S.Union([leg, S.Union([calf, knee], k=0.0), foot], k=0.018)


def navel_sdf():
    return S.Ellipsoid((0.0, -0.0705, 1.037), (0.0042, 0.006, 0.0075))


def body_sdf():
    left = S.Union([arm_sdf(), leg_sdf()], k=0.0)
    core = S.Union([torso_sdf(), neck_sdf(1.270, 1.390), S.Mirror(left)], k=0.022)
    return S.Subtract(core, navel_sdf(), k=0.004)


def body_bounds():
    return V([-0.45, -0.16, 0.03]), V([0.45, 0.16, 1.41])


# ------------------------------------------------------------------ head
# Silhouettes traced from the sheet. Front: half outline x(z), chin -> crown.
HEAD_FRONT = [(0.0, 1.3615), (0.0100, 1.3620), (0.0200, 1.3645), (0.0295, 1.3690), (0.0380, 1.3760),
              (0.0452, 1.3850), (0.0512, 1.3950), (0.0562, 1.4060), (0.0600, 1.4180), (0.0625, 1.4300),
              (0.0640, 1.4435), (0.0655, 1.4580), (0.0680, 1.4740), (0.0708, 1.4900), (0.0725, 1.5060),
              (0.0728, 1.5220), (0.0705, 1.5380), (0.0650, 1.5520), (0.0556, 1.5635), (0.0400, 1.5715),
              (0.0200, 1.5755), (0.0, 1.5765)]
# Side: front profile Y(z) (nose separate) and back/jaw line Y(z), chin -> crown.
HEAD_SIDE_FRONT = [(-0.0715, 1.3615), (-0.0820, 1.3650), (-0.0878, 1.3720), (-0.0905, 1.3800), (-0.0908, 1.3870),
                   (-0.0900, 1.3925), (-0.0925, 1.3985), (-0.0930, 1.4060), (-0.0935, 1.4140), (-0.0950, 1.4250),
                   (-0.0955, 1.4350), (-0.0948, 1.4435), (-0.0956, 1.4550), (-0.0965, 1.4700), (-0.0950, 1.4850),
                   (-0.0915, 1.5000), (-0.0850, 1.5150), (-0.0750, 1.5300), (-0.0610, 1.5440), (-0.0440, 1.5560),
                   (-0.0250, 1.5660), (-0.0080, 1.5750), (0.0, 1.5765)]
HEAD_SIDE_BACK = [(-0.0715, 1.3615), (-0.0560, 1.3625), (-0.0400, 1.3660), (-0.0200, 1.3730), (0.0000, 1.3820),
                  (0.0200, 1.3920), (0.0420, 1.4050), (0.0600, 1.4250), (0.0720, 1.4500), (0.0780, 1.4800),
                  (0.0790, 1.5050), (0.0750, 1.5300), (0.0640, 1.5500), (0.0460, 1.5650), (0.0240, 1.5740),
                  (0.0050, 1.5765)]


def _curve_at(pts, z):
    pts = np.asarray(pts)
    return S.pchip(pts[:, 1], pts[:, 0])(np.asarray(z, dtype=float))


def silhouette_rows(front_half, side_front, side_back, z0, z1, dz=0.002, n_fn=None, split=0.5, xc=0.0):
    rows = []
    for z in np.arange(z0, z1 + 1e-9, dz):
        hw = max(_curve_at(front_half, z), 5e-4)
        yf = _curve_at(side_front, z); yb = max(_curve_at(side_back, z), yf + 1e-3)
        yc = yf + split * (yb - yf)
        rows.append((z, hw, yc - yf, yb - yc, n_fn(z) if n_fn else 2.0, xc, yc))
    return rows


def _head_n(z):
    """Section roundness: flat face front, round chin and dome."""
    return float(np.interp(z, [1.3615, 1.372, 1.392, 1.47, 1.50, 1.54, 1.577], [2.0, 2.05, 2.5, 2.5, 2.3, 2.1, 2.0]))


def head_sdf():
    rows = silhouette_rows(HEAD_FRONT, HEAD_SIDE_FRONT, HEAD_SIDE_BACK, 1.3615, 1.5763, dz=0.0012, n_fn=_head_n, split=0.55)
    skull = S.Loft(rows)
    nose = S.RoundCone((0.0, -0.0950, 1.4370), (0.0, -0.1008, 1.4215), 0.0021, 0.0025)
    head = S.Union([skull, nose], k=0.006)
    return S.Union([head, neck_sdf(1.335, 1.425)], k=0.012)


# Smooth proxy used for anime-style face normals (Hoyoverse-like clean face shading).
FACE_PROXY = ((0.0, 0.004, 1.462), (0.074, 0.100, 0.108))


def face_normal_weight(V):
    """1 on the face front, fading to 0 toward the sides/back/neck."""
    fy = np.clip((-V[:, 1] - 0.02) / 0.05, 0, 1)
    fz = np.clip((V[:, 2] - 1.352) / 0.012, 0, 1) * np.clip((1.52 - V[:, 2]) / 0.03, 0, 1)
    return fy * fz


def face_normals(V, N):
    c, r = np.array(FACE_PROXY[0]), np.array(FACE_PROXY[1])
    q = (V - c) / (r * r)
    pn = q / np.maximum(np.linalg.norm(q, axis=1, keepdims=True), 1e-9)
    w = face_normal_weight(V)[:, None]
    out = N * (1 - w) + pn * w
    return out / np.maximum(np.linalg.norm(out, axis=1, keepdims=True), 1e-9)


def head_bounds():
    return V([-0.09, -0.13, 1.335]), V([0.09, 0.09, 1.60])


# ------------------------------------------------------------------ hand (left hand)
def hand_frame():
    """(origin, u = along fingers, t = thumb side, n = palm normal) for the LEFT hand."""
    d = V(ARM_DIR, dtype=float)
    o = V(J['Hand'])
    n = V((-math.cos(math.radians(30)), 0.0, -math.sin(math.radians(30))))
    t = np.cross(n, d); t /= np.linalg.norm(t)
    if t[1] > 0:
        t = -t
    ang = math.radians(25)
    n2 = n * math.cos(ang) + t * math.sin(ang)
    t2 = np.cross(n2, d); t2 /= np.linalg.norm(t2)
    if t2[1] > 0:
        t2 = -t2
    return o, d, t2, n2


FINGERS = {  # name: (y offset, length, base radius, curl)
    'Index': (0.023, 0.066, 0.0078, 0.9),
    'Middle': (0.0075, 0.073, 0.0080, 1.0),
    'Ring': (-0.0085, 0.069, 0.0076, 1.1),
    'Pinky': (-0.0235, 0.055, 0.0068, 1.3),
}
FINGER_SEGS = (0.45, 0.30, 0.25)


def finger_points(name):
    y0, L, r0, curl = FINGERS[name]
    angs = [math.radians(12) * curl, math.radians(22) * curl, math.radians(14) * curl]
    p = V((0.072 - abs(y0) * 0.12, y0 * 1.05, -0.001))
    dirv = V((1.0, y0 * 0.9, 0.0)); dirv /= np.linalg.norm(dirv)
    pts = [p.copy()]
    a = 0.0
    for s, da in zip(FINGER_SEGS, angs):
        a += da
        dd = dirv * math.cos(a) + V((0, 0, 1.0)) * math.sin(a)
        p = p + dd * L * s
        pts.append(p.copy())
    return pts, [r0, r0 * 0.92, r0 * 0.84, r0 * 0.74]


THUMB = ([V((0.010, 0.020, 0.000)), V((0.032, 0.036, 0.010)), V((0.052, 0.045, 0.018)), V((0.068, 0.049, 0.024))],
         [0.0125, 0.0105, 0.0088, 0.0074])


def hand_sdf_local():
    """Local coords: x = along fingers, y = thumb side, z = palm normal."""
    palm = S.Union([
        S.RoundBox((0.040, 0.000, 0.000), (0.034, 0.030, 0.0105), 0.009),
        S.RoundBox((0.012, 0.000, -0.001), (0.014, 0.024, 0.0105), 0.009),
    ], k=0.012)
    parts = [palm]
    for name in FINGERS:
        pts, radii = finger_points(name)
        parts.append(S.chain(pts, radii))
    parts.append(S.chain(*THUMB))
    parts.append(S.RoundCone((-0.025, 0.0, 0.0), (0.012, 0.0, 0.0), 0.0165, 0.017))
    return S.Union(parts, k=0.008)


def hand_local_bounds():
    return V([-0.03, -0.045, -0.035]), V([0.15, 0.065, 0.06])


def hand_to_world(P, side=1):
    o, u, t, n = hand_frame()
    R = np.stack([u, t, n], axis=1)
    W = np.asarray(P) @ R.T + o
    if side < 0:
        W = W * V([-1, 1, 1])
    return W
