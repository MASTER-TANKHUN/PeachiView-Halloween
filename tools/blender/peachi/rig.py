"""Armature (Mixamo-style humanoid + hair / skirt / strap chains) and skin weights."""
import math
import numpy as np
import bpy
from mathutils import Vector
from . import body as B
from . import util as U
from . import clothes as CL
from . import jacket as JK
from .config import J

SIDES = (('Left', 1), ('Right', -1))


def mirror(p, side):
    return (p[0] * side, p[1], p[2])


# ------------------------------------------------------------------ skeleton definition
def humanoid_bones():
    """[(name, head, tail, parent, deform)]"""
    b = []
    b.append(('Hips', J['Hips'], J['Spine'], None, True))
    b.append(('Spine', J['Spine'], J['Spine1'], 'Hips', True))
    b.append(('Spine1', J['Spine1'], J['Spine2'], 'Spine', True))
    b.append(('Spine2', J['Spine2'], J['Neck'], 'Spine1', True))
    b.append(('Neck', J['Neck'], J['Head'], 'Spine2', True))
    b.append(('Head', J['Head'], J['HeadTop'], 'Neck', True))
    for side, s in SIDES:
        m = lambda p: mirror(p, s)  # noqa: E731
        b.append((side + 'Shoulder', m(J['Shoulder']), m(J['Arm']), 'Spine2', True))
        b.append((side + 'Arm', m(J['Arm']), m(J['ForeArm']), side + 'Shoulder', True))
        b.append((side + 'ForeArm', m(J['ForeArm']), m(J['Hand']), side + 'Arm', True))
        o, u, t, n = B.hand_frame()
        hand_tail = o + u * 0.072
        b.append((side + 'Hand', m(J['Hand']), m(tuple(hand_tail)), side + 'ForeArm', True))
        for fname in ('Index', 'Middle', 'Ring', 'Pinky'):
            pts, _ = B.finger_points(fname)
            W = B.hand_to_world(np.array(pts), s)
            parent = side + 'Hand'
            for i in range(3):
                nm = '%sHand%s%d' % (side, fname, i + 1)
                b.append((nm, tuple(W[i]), tuple(W[i + 1]), parent, True))
                parent = nm
        tpts = B.hand_to_world(np.array(B.THUMB[0]), s)
        parent = side + 'Hand'
        for i in range(3):
            nm = '%sHandThumb%d' % (side, i + 1)
            b.append((nm, tuple(tpts[i]), tuple(tpts[i + 1]), parent, True))
            parent = nm
        b.append((side + 'UpLeg', m(J['UpLeg']), m(J['Leg']), 'Hips', True))
        b.append((side + 'Leg', m(J['Leg']), m(J['Foot']), side + 'UpLeg', True))
        b.append((side + 'Foot', m(J['Foot']), m(J['Toe']), side + 'Leg', True))
        b.append((side + 'ToeBase', m(J['Toe']), m(J['ToeEnd']), side + 'Foot', True))
    return b


def resample_path(P, n):
    P = np.asarray(P, float)
    seg = np.linalg.norm(np.diff(P, axis=0), axis=1)
    d = np.concatenate([[0], np.cumsum(seg)])
    t = np.linspace(0, d[-1], n)
    return np.stack([np.interp(t, d, P[:, i]) for i in range(3)], axis=1), d[-1]


def hair_chain_of(path):
    g, th = path['group'], path.get('theta', 0.0)
    if g == 'crown':
        return None
    if g == 'bangs':
        if abs(th) > 40:
            return 'HairFrameL' if th > 0 else 'HairFrameR'
        return 'HairBangsC' if abs(th) <= 12 else ('HairBangsL' if th > 0 else 'HairBangsR')
    if g == 'back':
        a = th if th >= 0 else th + 360
        if a < 165:
            return 'HairBackL'
        if a > 195:
            return 'HairBackR'
        return 'HairBackC'
    return {'front_L': 'HairFrontL', 'front_R': 'HairFrontR', 'side_L': 'HairSideL', 'side_R': 'HairSideR'}[g]


HAIR_CHAIN_BONES = {'HairBangsL': 2, 'HairBangsC': 2, 'HairBangsR': 2, 'HairFrameL': 3, 'HairFrameR': 3,
                    'HairFrontL': 5, 'HairFrontR': 5, 'HairSideL': 5, 'HairSideR': 5,
                    'HairBackL': 4, 'HairBackC': 4, 'HairBackR': 4}
HAIR_T0 = {'HairBangsL': 0.35, 'HairBangsC': 0.35, 'HairBangsR': 0.35, 'HairFrameL': 0.3, 'HairFrameR': 0.3}


def hair_chains(paths):
    """Average member clump paths per chain -> list of (chain, points, t0)."""
    groups = {}
    for p in paths:
        c = hair_chain_of(p)
        if c is None:
            continue
        P, L = resample_path(p['points'], 40)
        if p.get('taper') == 'strand' or L < 0.05:
            continue
        groups.setdefault(c, []).append((P, L))
    chains = {}
    for c, items in groups.items():
        Ls = np.array([L for _, L in items])
        Pm = np.mean([P for P, _ in items], axis=0)
        chains[c] = (Pm, float(Ls.mean()))
    return chains


def chain_bone_list(name, P, nb, t0, parent):
    Pn, _ = resample_path(P, 200)
    i0 = int(t0 * 199)
    idx = np.linspace(i0, 199, nb + 1).astype(int)
    out = []
    prev = parent
    for k in range(nb):
        nm = '%s_%02d' % (name, k + 1)
        out.append((nm, tuple(Pn[idx[k]]), tuple(Pn[idx[k + 1]]), prev, True))
        prev = nm
    return out


SKIRT_CHAINS = 8


def skirt_chain_bones():
    out = []
    for k in range(SKIRT_CHAINS):
        phi = 2 * math.pi * k / SKIRT_CHAINS
        pts = []
        for t in (0.08, 0.55, 1.0):
            xy = CL.skirt_radius(phi, t)
            pts.append((float(xy[0]), float(xy[1]) + 0.004, float(CL.skirt_z(phi, t))))
        prev = 'Hips'
        for i in range(2):
            nm = 'Skirt%d_%02d' % (k, i + 1)
            out.append((nm, pts[i], pts[i + 1], prev, True))
            prev = nm
    return out


def strap_chain_bones():
    out = []
    for name, phi, z_end, drift in CL.STRAPS:
        P = CL.strap_path(phi, z_end, drift)
        Pn, _ = resample_path(P, 100)
        idx = [0, 30, 62, 99]
        prev = 'Hips'
        base = name.replace('.', '')
        for i in range(3):
            nm = '%s_%02d' % (base, i + 1)
            out.append((nm, tuple(Pn[idx[i]]), tuple(Pn[idx[i + 1]]), prev, True))
            prev = nm
    return out


def build_armature(ctx):
    bones = humanoid_bones()
    chains = hair_chains(ctx.get('hair_paths', []))
    ctx['hair_chains'] = chains
    for c, (P, L) in chains.items():
        bones += chain_bone_list(c, P, HAIR_CHAIN_BONES[c], HAIR_T0.get(c, 0.18), 'Head')
    bones += skirt_chain_bones()
    bones += strap_chain_bones()
    arm_data = bpy.data.armatures.new('PeachiRig')
    arm = bpy.data.objects.new('PeachiRig', arm_data)
    ctx['coll'].objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode='EDIT')
    eb = arm_data.edit_bones
    for name, h, t, parent, deform in bones:
        e = eb.new(name)
        e.head = Vector(h); e.tail = Vector(t)
        if (e.tail - e.head).length < 1e-4:
            e.tail = e.head + Vector((0, 0, 0.01))
        e.use_deform = deform
        if parent:
            e.parent = eb[parent]
            e.use_connect = False
    # roll: make humanoid limbs consistent (x axis roughly forward/back)
    for e in eb:
        if e.name.startswith(('Left', 'Right')) and ('Arm' in e.name or 'Hand' in e.name):
            e.align_roll(Vector((0, -1, 0)) if 'Thumb' not in e.name else Vector((0, 0, 1)))
        elif e.name.startswith(('Left', 'Right')) and ('Leg' in e.name or 'Foot' in e.name or 'Toe' in e.name):
            e.align_roll(Vector((0, -1, 0)) if 'Foot' not in e.name and 'Toe' not in e.name else Vector((0, 0, 1)))
    bpy.ops.object.mode_set(mode='OBJECT')
    arm.show_in_front = True
    arm_data.display_type = 'STICK'
    ctx['armature'] = arm
    ctx['log']('armature', len(bones), 'bones')
    return arm


# ------------------------------------------------------------------ weights
def set_weights(ob, weights):
    """weights: {group: array(nverts)} (rows normalised here)."""
    names = list(weights.keys())
    W = np.stack([np.asarray(weights[n], float) for n in names], axis=1)
    W = np.clip(W, 0, None)
    # keep 4 strongest
    if W.shape[1] > 4:
        idx = np.argsort(-W, axis=1)[:, 4:]
        np.put_along_axis(W, idx, 0.0, axis=1)
    s = W.sum(axis=1, keepdims=True)
    W = np.where(s > 1e-9, W / np.maximum(s, 1e-9), 0)
    for gi, n in enumerate(names):
        col = W[:, gi]
        nz = np.nonzero(col > 1e-4)[0]
        if len(nz) == 0:
            continue
        vg = ob.vertex_groups.get(n) or ob.vertex_groups.new(name=n)
        for v in nz:
            vg.add([int(v)], float(col[v]), 'REPLACE')


def rigid(ob, bone):
    vg = ob.vertex_groups.get(bone) or ob.vertex_groups.new(name=bone)
    vg.add(list(range(len(ob.data.vertices))), 1.0, 'REPLACE')


def smooth01(x):
    x = np.clip(x, 0, 1)
    return x * x * (3 - 2 * x)


def bind(ob, arm):
    ob.parent = arm
    mod = ob.modifiers.new('Armature', 'ARMATURE')
    mod.object = arm


def auto_weights(ob, arm, allowed):
    """Bone-heat weights using only `allowed` deform bones."""
    saved = {}
    for b in arm.data.bones:
        saved[b.name] = b.use_deform
        b.use_deform = b.name in allowed
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True); arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    for b in arm.data.bones:
        b.use_deform = saved[b.name]
    return ob


def transfer_weights(ob, src):
    """Copy vertex-group weights from src (nearest surface, interpolated)."""
    for g in src.vertex_groups:
        if ob.vertex_groups.get(g.name) is None:
            ob.vertex_groups.new(name=g.name)
    m = ob.modifiers.new('DT', 'DATA_TRANSFER')
    m.object = src
    m.use_vert_data = True
    m.data_types_verts = {'VGROUP_WEIGHTS'}
    m.vert_mapping = 'POLYINTERP_NEAREST'
    m.layers_vgroup_select_src = 'ALL'
    m.layers_vgroup_select_dst = 'NAME'
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.modifier_apply(modifier=m.name)


def seg_dist(P, a, b):
    a, b = np.asarray(a), np.asarray(b)
    ab = b - a
    t = np.clip(((P - a) @ ab) / (ab @ ab), 0, 1)
    return np.linalg.norm(P - (a + t[:, None] * ab), axis=1), t


def spine_weights(V):
    z = V[:, 2]
    w = {}
    w['Hips'] = 1 - smooth01((z - 0.93) / 0.06)
    w['Spine'] = smooth01((z - 0.93) / 0.06) * (1 - smooth01((z - 1.03) / 0.06))
    w['Spine1'] = smooth01((z - 1.03) / 0.06) * (1 - smooth01((z - 1.15) / 0.06))
    w['Spine2'] = smooth01((z - 1.15) / 0.06)
    return w


def weights_jacket_body(V):
    w = spine_weights(V)
    for side, s in SIDES:
        a = np.array(mirror(J['Arm'], s)); e = np.array(mirror(J['ForeArm'], s))
        d, t = seg_dist(V, a, e)
        k = (1 - smooth01((d - 0.07) / 0.06)) * smooth01((V[:, 2] - 1.08) / 0.08)
        for n in list(w.keys()):
            w[n] = w[n] * (1 - k)
        w[side + 'Arm'] = k * 0.8
        w[side + 'Shoulder'] = k * 0.2
    return w


def weights_sleeve(V, side_name, s_sign):
    A, E, W = [np.array(mirror(J[n], s_sign)) for n in ('Arm', 'ForeArm', 'Hand')]
    d1, t1 = seg_dist(V, A, E)
    d2, t2 = seg_dist(V, E, W)
    # parameter along the arm: 0..1 upper, 1..2 forearm
    along = np.where(d1 + 0.01 * (t1 >= 1) < d2, t1, 1 + t2)
    w = {}
    w[side_name + 'Shoulder'] = 0.25 * (1 - smooth01(along / 0.25))
    w[side_name + 'Arm'] = (1 - smooth01((along - 0.85) / 0.3)) - w[side_name + 'Shoulder'] * 0.0
    w[side_name + 'ForeArm'] = smooth01((along - 0.85) / 0.3) * (1 - smooth01((along - 1.93) / 0.12))
    w[side_name + 'Hand'] = smooth01((along - 1.93) / 0.12)
    return w


def weights_hair(ob, paths, arm):
    n = len(ob.data.vertices)
    acc = {}
    for p in paths:
        c = hair_chain_of(p)
        sl = slice(p['vstart'], p['vstart'] + p['vcount'])
        dist = np.asarray(p['dist'], float)
        L = max(dist.max(), 1e-6)
        if c is None or ('%s_01' % c) not in arm.data.bones:
            acc.setdefault('Head', np.zeros(n))[sl] += 1.0
            continue
        nb = HAIR_CHAIN_BONES[c]
        t0 = HAIR_T0.get(c, 0.18)
        # absolute distance along the clump mapped onto the chain's length
        chainL = sum((arm.data.bones['%s_%02d' % (c, k + 1)].length for k in range(nb)))
        t = dist / max(L, 1e-6)
        x = (t - t0) / (1 - t0) * nb
        head_w = 1 - smooth01((t - t0 * 0.6) / (t0 * 0.7 + 1e-6))
        acc.setdefault('Head', np.zeros(n))[sl] += head_w
        for k in range(nb):
            center = k + 0.5
            wk = np.clip(1 - np.abs(x - center), 0, 1)
            if k == 0:
                wk = np.where(x < center, np.clip(x / center, 0, 1), wk)
            if k == nb - 1:
                wk = np.where(x > center, 1.0, wk)
            acc.setdefault('%s_%02d' % (c, k + 1), np.zeros(n))[sl] += wk * (1 - head_w)
    set_weights(ob, acc)


def weights_skirt(V):
    phi = np.arctan2(V[:, 0], -(V[:, 1] - 0.004)) % (2 * math.pi)
    z = V[:, 2]
    zw = CL.SK['z_waist']
    zh = CL.skirt_z(phi, 1.0)
    t = np.clip((zw - z) / (zw - zh), 0, 1.2)
    w = {}
    hips = 1 - smooth01(t / 0.25)
    w['Hips'] = hips
    f = phi / (2 * math.pi) * SKIRT_CHAINS
    k0 = np.floor(f).astype(int) % SKIRT_CHAINS
    k1 = (k0 + 1) % SKIRT_CHAINS
    a = f - np.floor(f)
    for k in range(SKIRT_CHAINS):
        wk = np.where(k0 == k, 1 - a, 0) + np.where(k1 == k, a, 0)
        w1 = wk * (1 - smooth01((t - 0.35) / 0.3)) * (1 - hips)
        w2 = wk * smooth01((t - 0.35) / 0.3) * (1 - hips)
        w['Skirt%d_01' % k] = w1
        w['Skirt%d_02' % k] = w2
    # follow the thighs a little near the hem (front/back over each leg)
    for side, s in SIDES:
        near = np.clip((V[:, 0] * s) / 0.12, 0, 1) * smooth01((t - 0.3) / 0.6) * 0.35
        for key in list(w.keys()):
            w[key] = w[key] * (1 - near)
        w[side + 'UpLeg'] = w.get(side + 'UpLeg', 0) + near
    return w


def weights_strap(V, base):
    bones = ['%s_%02d' % (base, i + 1) for i in range(3)]
    arm = bpy.data.objects['PeachiRig']
    heads = np.array([arm.data.bones[b].head_local for b in bones])
    tails = np.array([arm.data.bones[b].tail_local for b in bones])
    D = np.stack([seg_dist(V, heads[i], tails[i])[0] for i in range(3)], axis=1)
    W = np.exp(-(D / 0.025) ** 2)
    w = {b: W[:, i] for i, b in enumerate(bones)}
    top = 1 - smooth01((heads[0][2] - V[:, 2]) / 0.03)
    for b in bones:
        w[b] = w[b] * (1 - top)
    w['Hips'] = top
    return w


def weights_head(V):
    z = V[:, 2]
    k = smooth01((z - 1.365) / 0.03)
    return {'Head': k, 'Neck': 1 - k}


def weights_shoe(V, side, s):
    z = V[:, 2]
    leg = smooth01((z - 0.100) / 0.065)              # high-top collar follows the shin (no gaping when the foot points)
    toe = smooth01(((-V[:, 1]) - 0.02) / 0.04) * (z < 0.09) * (1 - leg)
    foot = np.clip(1 - leg - toe * 0.8, 0, 1)
    return {side + 'Leg': leg, side + 'Foot': foot, side + 'ToeBase': toe * 0.8}


def skin(ctx):
    arm = ctx['armature']
    O = ctx['objects']
    log = ctx['log']
    body_bones = [b.name for b in arm.data.bones if not b.name.startswith(('Hair', 'Skirt', 'Strap')) and not any(f in b.name for f in ('Thumb', 'Index', 'Middle', 'Ring', 'Pinky'))]
    body = O['Body']
    auto_weights(body, arm, set(body_bones) - {'Head'})
    log('body auto weights')
    for nm, side in (('Hand.L', 'Left'), ('Hand.R', 'Right')):
        hand_bones = {b.name for b in arm.data.bones if b.name.startswith(side + 'Hand')} | {side + 'ForeArm'}
        auto_weights(O[nm], arm, hand_bones)
    log('hand auto weights')
    done = {'Body', 'Hand.L', 'Hand.R'}
    for nm, ob in O.items():
        if nm in done or ob.type != 'MESH':
            continue
        V = U.mesh_arrays(ob)
        if nm in ('Head',):
            set_weights(ob, weights_head(V))
        elif nm.startswith(('FaceEyes', 'FaceMouth', 'FaceBrows', 'HairCap', 'Headphones', 'Anger')):
            rigid(ob, 'Head')
        elif nm == 'Hair':
            weights_hair(ob, ctx['hair_paths'], arm)
        elif nm.startswith('Choker'):
            rigid(ob, 'Neck')
        elif nm in ('Skirt', 'SkirtFrill'):
            set_weights(ob, weights_skirt(V))
        elif nm.startswith('Strap.') and not nm.endswith('.Ring'):
            set_weights(ob, weights_strap(V, nm.replace('.', '')))
        elif nm.startswith('Strap.') and nm.endswith('.Ring'):
            rigid(ob, nm.replace('.Ring', '').replace('.', '') + '_03')
        elif nm.startswith(('Belt', 'Chain')):
            set_weights(ob, {'Hips': np.full(len(V), 0.85), 'Spine': np.full(len(V), 0.15)})
        elif nm.startswith(('JacketBody', 'JacketLining', 'JacketTrim', 'JacketStuds', 'JacketHem', 'Banner', 'Hood')):
            set_weights(ob, weights_jacket_body(V))
        elif nm.startswith(('Sleeve.', 'CuffWhite', 'CuffBlack', 'SleeveStrap', 'ShoulderBand')):
            s = 1 if nm.endswith('.L') else -1
            set_weights(ob, weights_sleeve(V, 'Left' if s > 0 else 'Right', s))
        elif nm.startswith('Shoe'):
            s = 1 if nm.endswith('.L') else -1
            side = 'Left' if s > 0 else 'Right'
            set_weights(ob, weights_shoe(V, side, s))
        else:
            transfer_weights(ob, body)
        done.add(nm)
    for nm, ob in O.items():
        if ob.type == 'MESH' and ob.parent is None:
            bind(ob, arm)
        elif ob.type == 'MESH' and not any(m.type == 'ARMATURE' for m in ob.modifiers):
            mod = ob.modifiers.new('Armature', 'ARMATURE'); mod.object = arm
    log('skinned', len(done), 'meshes')
