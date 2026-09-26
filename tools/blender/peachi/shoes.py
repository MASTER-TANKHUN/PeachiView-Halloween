"""Chunky high-top sneakers (SDF) with vertex-colour panels, gold laces, collar strap, heart charm."""
import math
import numpy as np
from . import sdf as S
from . import geom as G
from . import util as U
from .clothes import sdf_obj

FX = 0.099   # foot centre x (left)


def shoe_sdf():
    # outsole+midsole: rounded footprint slab
    def slab(P):
        x, y, z = P[:, 0] - FX, P[:, 1], P[:, 2]
        # footprint: rounded capsule-ish outline, wider at the ball
        w = 0.040 + 0.004 * np.exp(-((y + 0.035) / 0.03) ** 2) - 0.004 * np.clip((y - 0.05) / 0.05, 0, 1)
        d2 = np.maximum(np.abs(x) - w, np.maximum(-0.090 - y, y - 0.104))
        d2 = np.where((np.abs(x) > w * 0.55) & ((y < -0.07) | (y > 0.085)),
                      np.sqrt(np.maximum(np.abs(x) - w * 0.55, 0) ** 2 + np.maximum(np.maximum(-0.070 - y, y - 0.085), 0) ** 2) - w * 0.45, d2)
        dz = np.maximum(-z, z - 0.043)
        q = np.stack([d2, dz], axis=1)
        r = 0.006
        return np.minimum(np.maximum(q[:, 0], q[:, 1]), 0) + np.linalg.norm(np.maximum(q + r, 0), axis=1) - r
    sole = S.Func(slab, (FX - 0.06, -0.11, -0.01), (FX + 0.06, 0.12, 0.06))
    toe = S.Ellipsoid((FX, -0.050, 0.052), (0.039, 0.042, 0.030))
    mid = S.Ellipsoid((FX, 0.004, 0.064), (0.041, 0.060, 0.042))
    heel = S.Ellipsoid((FX, 0.062, 0.070), (0.037, 0.040, 0.046))
    shaft = S.RoundCone((FX, 0.036, 0.085), (FX - 0.001, 0.041, 0.206), 0.046, 0.044)
    upper = S.Union([toe, mid, heel, shaft], k=0.022)
    shoe = S.Union([sole, upper], k=0.006)
    hole = S.RoundCone((FX - 0.001, 0.041, 0.150), (FX - 0.001, 0.041, 0.26), 0.031, 0.031)
    return S.Subtract(shoe, hole, k=0.004)


def shoe_colors(V):
    x, y, z = V[:, 0] - FX, V[:, 1], V[:, 2]
    col = np.tile(np.array([0.93, 0.91, 1.0]), (len(V), 1))            # white-lavender upper
    pink = np.array([1.0, 0.36, 0.52]); pink2 = np.array([1.0, 0.55, 0.70]); black = np.array([0.10, 0.10, 0.15])
    white = np.array([0.99, 0.98, 1.0])
    col[z < 0.044] = white
    col[z < 0.017] = pink
    band = (np.abs(z - 0.031) < 0.0022)
    col[band] = pink2
    # toe cap rim + side swoosh + heel counter
    toe_rim = (y < -0.040) & (np.abs(z - 0.058) < 0.004)
    col[toe_rim] = pink
    side = (np.abs(x) > 0.030) & (np.abs((y + 0.01) - (z - 0.065) * 1.2) < 0.012) & (z > 0.045) & (z < 0.14)
    col[side] = pink
    heel = (y > 0.080) & (z > 0.045) & (z < 0.14)
    col[heel] = pink2
    # tongue (front centre, black)
    tongue = (np.abs(x) < 0.017) & (y < 0.02) & (z > 0.066) & (z < 0.212)
    col[tongue] = black
    return col


def lace_mesh():
    parts = []
    for i in range(4):
        z0 = 0.090 + i * 0.027
        a = np.array([FX - 0.016, 0.0, z0]); b = np.array([FX + 0.016, 0.0, z0 + 0.021])
        c = np.array([FX + 0.016, 0.0, z0]); d = np.array([FX - 0.016, 0.0, z0 + 0.021])
        for p0, p1 in ((a, b), (c, d)):
            P = np.linspace(p0, p1, 8)
            # sit on the tongue surface: y follows the front of the shaft/toe
            P[:, 1] = -0.040 + (P[:, 2] - 0.09) * 0.25
            V, F, _ = G.sweep(P, G.ellipse(0.0028, 0.0028, 6), up_hint=(0, -1, 0))
            parts.append((V, F, None))
    return G.merge(parts)


def build(ctx):
    coll, log = ctx['coll'], ctx['log']
    m_shoe = U.principled('Shoe', (1, 1, 1), rough=0.35, vcol='Col')
    m_gold = U.principled('Gold', (0.98, 0.76, 0.28), rough=0.22, metal=1.0)
    m_heart = U.principled('HeartPink', (1.0, 0.52, 0.74), rough=0.18, spec=0.7)
    m_white = U.principled('CuffWhite', (0.96, 0.95, 1.0), rough=0.45)
    node = shoe_sdf()
    V, F = S.sdf_to_mesh(node, (FX - 0.06, -0.11, -0.012), (FX + 0.06, 0.125, 0.23), h=0.0022)
    C = U.srgb_to_lin(shoe_colors(V))
    objs = []
    for side, nm in ((1, 'L'), (-1, 'R')):
        VV = V if side > 0 else V * np.array([-1, 1, 1])
        FF = F if side > 0 else F[:, ::-1]
        ob = U.make_mesh('Shoe.' + nm, VV, FF, coll, mat=m_shoe)
        U.set_vcol(ob.data, C)
        U.decimate(ob, 0.22)
        objs.append(ob)
        Vl, Fl, _ = lace_mesh()
        Vl = Vl if side > 0 else Vl * np.array([-1, 1, 1])
        objs.append(U.make_mesh('ShoeLaces.' + nm, Vl, Fl if side > 0 else [f[::-1] for f in Fl], coll, mat=m_gold))
        # collar strap (white band) + gold buckle
        th = np.linspace(0, 2 * np.pi, 40, endpoint=False)
        loop = np.stack([side * FX + np.cos(th) * 0.0475, 0.040 + np.sin(th) * 0.0485, np.full_like(th, 0.188)], axis=1)
        Vs, Fs, _ = G.sweep(loop, G.rounded_rect(0.004, 0.020, 0.0015), up_hint=(0, 0, 1), closed=True, cap=False)
        objs.append(U.make_mesh('ShoeStrap.' + nm, Vs, Fs, coll, mat=m_white))
        bc = np.array([side * (FX + 0.050), 0.030, 0.188])
        Rb = S.frame_from_axis((side, 0, 0))
        objs.append(sdf_obj('ShoeBuckle.' + nm, G.box_frame(bc, (0.020, 0.024), (0.012, 0.016), 0.004, 0.0012, Rb), bc - 0.02, bc + 0.02, 0.0006, coll, m_gold))
        # heart charm on the tongue top + pink heel tab
        hc = np.array([side * FX, -0.044, 0.185])
        Rf = S.rot_matrix(math.radians(90) - 0.25, 0, 0)
        frame = S.Subtract(G.heart_node(hc, 0.011, 0.004, Rf), G.heart_node(hc + [0, -0.003, 0], 0.0072, 0.02, Rf), k=0.0004)
        objs.append(sdf_obj('ShoeCharm.' + nm, frame, hc - 0.02, hc + 0.02, 0.0005, coll, m_gold))
        tc = np.array([side * FX, 0.090, 0.195])
        tab = S.RoundBox(tc, (0.012, 0.004, 0.018), 0.003)
        objs.append(sdf_obj('ShoeTab.' + nm, tab, tc - 0.03, tc + 0.03, 0.0008, coll, m_heart))
    for o in objs:
        ctx['objects'][o.name] = o
    log('shoes', len(objs), 'objects', len(V), 'verts each')
