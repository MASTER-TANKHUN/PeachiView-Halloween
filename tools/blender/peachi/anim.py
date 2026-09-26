"""Procedural animation clips baked as Blender actions (exported as glTF animations).

Poses are authored as euler angles (degrees) about ARMATURE axes (X = her left, Y = back,
Z = up) applied at each bone's rest orientation, relative to its parent. Finger curl uses
the palm geometry. Hair / skirt / strap chains get automatic lagged secondary motion.
"""
import math
import numpy as np
import bpy
from mathutils import Quaternion, Euler, Vector, Matrix
from . import body as B

FPS = 30
S = math.sin
C = math.cos
TAU = 2 * math.pi


def eu(rx=0.0, ry=0.0, rz=0.0):
    return Euler((math.radians(rx), math.radians(ry), math.radians(rz)), 'XYZ').to_quaternion()


class Pose(dict):
    """bone -> quaternion (armature axes). Special keys: '_loc' (hips offset), '_curl' {finger: deg}."""

    def rot(self, bone, rx=0.0, ry=0.0, rz=0.0):
        q = eu(rx, ry, rz)
        self[bone] = q @ self[bone] if bone in self else q
        return self


def palm_normal(side):
    o, u, t, n = B.hand_frame()
    n = np.array(n)
    if side < 0:
        n = n * np.array([-1, 1, 1])
    return n


def finger_curl_quat(arm, bone, deg, side):
    b = arm.data.bones[bone]
    yb = np.array(b.y_axis if hasattr(b, 'y_axis') else (b.tail_local - b.head_local))
    yb = np.array((b.tail_local - b.head_local).normalized())
    n = palm_normal(side)
    ax = np.cross(yb, n)
    if 'Thumb' in bone:
        ax = np.cross(yb, n + np.array([0, 0.0, 0.0]))
    ax = ax / max(np.linalg.norm(ax), 1e-9)
    return Quaternion(Vector(ax), math.radians(deg))


def to_local(arm, bone, q_arm):
    R = arm.data.bones[bone].matrix_local.to_quaternion()
    return R.inverted() @ q_arm @ R


# ------------------------------------------------------------------ helpers for common pose parts
def arms_down(p, amt=16.0, fwd=-4.0, elbow=-10.0, sway=0.0):
    p.rot('LeftArm', fwd, amt + sway, 0)
    p.rot('RightArm', fwd, -amt - sway, 0)
    p.rot('LeftForeArm', elbow, 0, 0)
    p.rot('RightForeArm', elbow, 0, 0)
    return p


def curl_all(p, side, deg, thumb=None, which=('Index', 'Middle', 'Ring', 'Pinky')):
    c = p.setdefault('_curl', {})
    sd = 'Left' if side > 0 else 'Right'
    for f in which:
        for i in (1, 2, 3):
            c['%sHand%s%d' % (sd, f, i)] = (deg * (1.0 if i > 1 else 0.8), side)
    if thumb is not None:
        for i in (1, 2, 3):
            c['%sHandThumb%d' % (sd, i)] = (thumb, side)
    return p


# ------------------------------------------------------------------ clips
def clip_idle(t, D=4.0):
    w = TAU * t / D
    b = S(w)
    p = Pose()
    p['_loc'] = (0.0, 0.0, 0.003 * b)
    p.rot('Hips', 0, 1.5 * S(w), 2.0 * S(w + 1))
    p.rot('Spine', 1.2 * b, 0, 0)
    p.rot('Spine2', -1.5 * b, 0, -1.0 * S(w + 1))
    p.rot('Neck', 2.0, 0, 1.5 * S(w + 0.5))
    p.rot('Head', -2.0 + 1.0 * S(w * 2), 4.0 * S(w + 0.8) + 2.5, 0)
    arms_down(p, 17 + 1.2 * S(w + 0.3), -5, -12 - 2 * b)
    p.rot('LeftHand', 0, 0, -8); p.rot('RightHand', 0, 0, 8)
    curl_all(p, 1, 18); curl_all(p, -1, 18)
    return p


def clip_walk(t, D=1.0):
    w = TAU * t / D
    p = Pose()
    p['_loc'] = (0.0, 0.0, 0.010 * C(2 * w) - 0.008)
    p.rot('Hips', 0, 2.5 * S(w), 5.0 * S(w))
    p.rot('Spine', 3.0, 0, 0)
    p.rot('Spine2', -2.0 * C(2 * w), 0, -7.0 * S(w))
    p.rot('Head', -2.0, 0, 3.0 * S(w))
    for side, ph in (('Left', 0.0), ('Right', math.pi)):
        s = S(w + ph)
        p.rot(side + 'UpLeg', -24 * s - 4, 0, 0)
        knee = 8 + 45 * max(0.0, S(w + ph + 2.2))
        p.rot(side + 'Leg', knee, 0, 0)
        p.rot(side + 'Foot', -12 * S(w + ph + 0.6) + 4, 0, 0)
    arms_down(p, 14, 0, -18)
    p.rot('LeftArm', 20 * S(w), 0, 0)
    p.rot('RightArm', 20 * S(w + math.pi), 0, 0)
    curl_all(p, 1, 25); curl_all(p, -1, 25)
    return p


def clip_wave(t, D=3.0):
    w = TAU * t / D
    p = Pose()
    p['_loc'] = (0.0, 0.0, 0.002 * S(w))
    p.rot('Hips', 0, -2, 3)
    p.rot('Spine2', 0, 3, 4)
    p.rot('Head', -3, -8 + 2 * S(w), -6)
    p.rot('LeftArm', -4, 17, 0); p.rot('LeftForeArm', -14, 0, 0)
    p.rot('RightShoulder', 0, 10, 0)
    p.rot('RightArm', -14, 64, 0)
    p.rot('RightForeArm', 0, 62 + 22 * S(TAU * t * 1.6), 0)
    p.rot('RightHand', 0, 0, 0)
    curl_all(p, 1, 20); curl_all(p, -1, 4, thumb=0)
    return p


def clip_peace(t, D=3.0):
    w = TAU * t / D
    p = Pose()
    p.rot('Hips', 0, 3, -4)
    p.rot('Spine2', 0, -3, -6)
    p.rot('Head', -4, 10 + 2 * S(w), 5)
    p.rot('LeftArm', -6, 20, 0); p.rot('LeftForeArm', -35, 0, 0)
    p.rot('LeftHand', 0, 0, -10)
    p.rot('RightArm', -62, 38, -10)
    p.rot('RightForeArm', -118, 0, 20)
    p.rot('RightHand', 10, 0, -20 + 3 * S(w * 2))
    curl_all(p, 1, 22)
    curl_all(p, -1, 95, thumb=55, which=('Ring', 'Pinky'))
    c = p['_curl']
    for f, spread in (('Index', 0), ('Middle', 0)):
        for i in (1, 2, 3):
            c['RightHand%s%d' % (f, i)] = (2, -1)
    p.rot('RightHandIndex1', 0, 0, 7); p.rot('RightHandMiddle1', 0, 0, -5)
    return p


def clip_float(t, D=3.0):
    w = TAU * t / D
    p = Pose()
    p['_loc'] = (0.0, 0.0, 0.08 + 0.03 * S(w))
    p.rot('Hips', 4, 2 * S(w + 1), 3 * S(w * 0.5))
    p.rot('Spine', 4, 0, 0)
    p.rot('Spine2', 3 + 2 * S(w + 0.4), 0, 0)
    p.rot('Head', 6, 6 * S(w + 1.2), 0)
    for side, sg, ph in (('Left', 1, 0.0), ('Right', -1, 1.7)):
        p.rot(side + 'UpLeg', -10 + 5 * S(w + ph), sg * 2, 0)
        p.rot(side + 'Leg', 32 + 6 * S(w + ph + 0.7), 0, 0)
        p.rot(side + 'Foot', 18, 0, 0)
        p.rot(side + 'Arm', -14 + 4 * S(w + ph), sg * (4 + 3 * S(w + ph)), 0)
        p.rot(side + 'ForeArm', -26 - 6 * S(w + ph + 0.5), 0, 0)
        p.rot(side + 'Hand', 18, 0, 0)
    curl_all(p, 1, 30); curl_all(p, -1, 30)
    return p


def clip_reach(t, D=2.4):
    w = TAU * t / D
    p = Pose()
    p['_loc'] = (0.0, -0.03, 0.02 * S(w))
    p.rot('Hips', 6, 0, 0)
    p.rot('Spine', 6, 0, 0)
    p.rot('Spine2', 6, 0, 2 * S(w))
    p.rot('Head', 8, 8 * S(w * 0.5), 0)
    for side, sg, ph in (('Left', 1, 0.0), ('Right', -1, 0.9)):
        p.rot(side + 'Arm', -84 + 6 * S(w + ph), sg * (-18), 0)
        p.rot(side + 'ForeArm', -8 - 5 * S(w + ph), 0, 0)
        p.rot(side + 'Hand', -10 + 10 * S(w * 2 + ph), 0, 0)
    curl_all(p, 1, 15 + 20 * max(0, S(w)), thumb=5); curl_all(p, -1, 15 + 20 * max(0, S(w + 0.9)), thumb=5)
    return p


def clip_jumpscare(t, D=1.4):
    p = Pose()
    k_in = min(1.0, t / 0.18)
    k = 0.0 if t < 0.18 else min(1.0, (t - 0.18) / 0.14)
    k = k * k * (3 - 2 * k)
    shake = 0.0 if t < 0.32 else 3.0 * S(TAU * t * 11)
    p['_loc'] = (0.0, 0.03 * k_in * (1 - k) - 0.30 * k, -0.03 * k_in * (1 - k) + 0.10 * k)
    p.rot('Hips', -6 * k_in * (1 - k) + 14 * k, 0, 0)
    p.rot('Spine', 8 * k, 0, 0)
    p.rot('Spine2', 10 * k, shake, 0)
    p.rot('Head', 12 * k + shake, shake * 0.5, 0)
    for side, sg in (('Left', 1), ('Right', -1)):
        p.rot(side + 'Arm', -20 * k_in * (1 - k) - 150 * k, sg * (-35 * k), 0)
        p.rot(side + 'ForeArm', -30 * k, 0, 0)
        p.rot(side + 'Hand', -35 * k, 0, 0)
        p.rot(side + 'UpLeg', -30 * k, sg * 6 * k, 0)
        p.rot(side + 'Leg', 50 * k, 0, 0)
        p.rot(side + 'Foot', 18 * k, 0, 0)
        curl_all(p, sg, 10 + 55 * k, thumb=30 * k)
    return p


def clip_cry(t, D=3.0):
    w = TAU * t / D
    sob = S(TAU * t * 2.0)
    p = Pose()
    p['_loc'] = (0.0, 0.0, -0.01 + 0.004 * sob)
    p.rot('Spine', 6, 0, 0)
    p.rot('Spine2', 8 + 2.5 * sob, 0, 0)
    p.rot('Neck', 8, 0, 0)
    p.rot('Head', 10 + 2 * sob, 4 * S(w), 0)
    for side, sg, ph in (('Left', 1, 0.0), ('Right', -1, 1.1)):
        p.rot(side + 'Shoulder', 0, sg * -6, 0)
        p.rot(side + 'Arm', -46, sg * 26, sg * 10)
        p.rot(side + 'ForeArm', -128 + 6 * S(w * 2 + ph), 0, sg * -30)
        p.rot(side + 'Hand', 20, 0, sg * 20)
        curl_all(p, sg, 40, thumb=20)
    return p


def clip_angry(t, D=2.0):
    w = TAU * t / D
    p = Pose()
    stompL = max(0.0, S(w)) ** 2
    stompR = max(0.0, S(w + math.pi)) ** 2
    p['_loc'] = (0.0, -0.01, 0.012 * (stompL + stompR) - 0.006)
    p.rot('Hips', 5, 3 * S(w), 0)
    p.rot('Spine', 5, 0, 0)
    p.rot('Spine2', 4, 0, 4 * S(w))
    p.rot('Head', 4 + 3 * S(w * 4), 0, 12 * S(w * 2))
    for side, sg, st in (('Left', 1, stompL), ('Right', -1, stompR)):
        p.rot(side + 'UpLeg', -30 * st, 0, 0)
        p.rot(side + 'Leg', 50 * st, 0, 0)
        p.rot(side + 'Arm', 10, sg * 8, 0)
        p.rot(side + 'ForeArm', -35, 0, 0)
        p.rot(side + 'Hand', 0, 0, 0)
        curl_all(p, sg, 95, thumb=50)
    return p


def clip_cheer(t, D=1.2):
    w = TAU * t / D
    up = max(0.0, S(w))
    p = Pose()
    p['_loc'] = (0.0, 0.0, 0.12 * up - 0.03 * max(0.0, -S(w)))
    for side, sg in (('Left', 1), ('Right', -1)):
        p.rot(side + 'Arm', -20, sg * -(40 + 110 * up), 0)
        p.rot(side + 'ForeArm', -20 * (1 - up), 0, 0)
        p.rot(side + 'UpLeg', -20 * up, 0, 0)
        p.rot(side + 'Leg', 40 * up + 20 * max(0.0, -S(w)), 0, 0)
        p.rot(side + 'Foot', 15 * up, 0, 0)
        curl_all(p, sg, 10 * up, thumb=0)
    p.rot('Head', -8 * up, 0, 0)
    return p


def clip_tpose(t, D=1.0):
    p = Pose()
    p.rot('LeftArm', 0, -60, 0); p.rot('RightArm', 0, 60, 0)
    return p


CLIPS = {
    'Idle': (clip_idle, 4.0, 'loop'),
    'Walk': (clip_walk, 1.0, 'loop'),
    'Wave': (clip_wave, 3.0, 'loop'),
    'Peace': (clip_peace, 3.0, 'loop'),
    'Float': (clip_float, 3.0, 'loop'),
    'Reach': (clip_reach, 2.4, 'loop'),
    'Jumpscare': (clip_jumpscare, 1.4, 'once'),
    'Cry': (clip_cry, 3.0, 'loop'),
    'Angry': (clip_angry, 2.0, 'loop'),
    'Cheer': (clip_cheer, 1.2, 'loop'),
    'TPose': (clip_tpose, 1.0, 'loop'),
}


# ------------------------------------------------------------------ secondary motion
def secondary(arm, pose_fn, t, D, amp=1.0):
    """Lagged sway for hair / skirt / strap chains driven by the body motion."""
    out = {}
    dt = 0.12
    a0 = pose_fn(max(0.0, t - dt), D) if t >= dt else pose_fn(t + D - dt, D)
    a1 = pose_fn(t, D)
    # hips velocity (armature space) drives the sway
    l0 = np.array(a0.get('_loc', (0, 0, 0))); l1 = np.array(a1.get('_loc', (0, 0, 0)))
    vel = (l1 - l0) / dt
    yaw0 = a0.get('Hips', Quaternion()).to_euler().z
    yaw1 = a1.get('Hips', Quaternion()).to_euler().z
    spin = (yaw1 - yaw0) / dt
    for b in arm.data.bones:
        nm = b.name
        if not nm.startswith(('Hair', 'Skirt', 'Strap')):
            continue
        idx = int(nm.split('_')[-1])
        lag = 0.35 * idx
        base = TAU * t / D
        k = amp * (0.5 + 0.5 * idx)
        if nm.startswith('Hair'):
            sx = 2.2 * S(base * 1 - lag) + 25 * vel[1] - 18 * vel[2]
            sy = 1.8 * S(base * 1 + 0.9 - lag) + 6 * spin
            out[nm] = eu(sx * k * 0.6, sy * k * 0.6, 0)
        elif nm.startswith('Skirt'):
            sx = 1.5 * S(base * 2 - lag) + 12 * vel[1] - 10 * vel[2]
            out[nm] = eu(sx * k * 0.5, 0.8 * S(base * 2 + 1 - lag) * k, 0)
        else:
            sx = 3.0 * S(base * 2 - lag) + 20 * vel[1] - 15 * vel[2]
            out[nm] = eu(sx * k * 0.6, 2.0 * S(base * 2 + 0.7 - lag) * k, 0)
    return out


# ------------------------------------------------------------------ baking
def bake(ctx, names=None):
    arm = ctx['armature']
    log = ctx['log']
    sc = bpy.context.scene
    sc.render.fps = FPS
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode='POSE')
    pbs = arm.pose.bones
    for pb in pbs:
        pb.rotation_mode = 'QUATERNION'
    arm.animation_data_create()
    actions = []
    for name, (fn, D, mode) in CLIPS.items():
        if names and name not in names:
            continue
        act = bpy.data.actions.new(name)
        act.use_fake_user = True
        arm.animation_data.action = act
        nframes = int(round(D * FPS))
        last = nframes if mode == 'loop' else nframes
        for f in range(0, last + 1):
            t = f / FPS
            tt = t if mode == 'once' else (t % D)
            pose = fn(tt, D)
            sec = secondary(arm, fn, tt, D)
            for pb in pbs:
                q = Quaternion()
                if pb.name in pose:
                    q = to_local(arm, pb.name, pose[pb.name])
                if pb.name in sec:
                    q = to_local(arm, pb.name, sec[pb.name]) @ q
                curl = pose.get('_curl', {}).get(pb.name)
                if curl is not None:
                    q = to_local(arm, pb.name, finger_curl_quat(arm, pb.name, curl[0], curl[1])) @ q
                pb.rotation_quaternion = q
                pb.keyframe_insert('rotation_quaternion', frame=f)
            loc = pose.get('_loc', (0, 0, 0))
            hb = arm.data.bones['Hips']
            Rl = hb.matrix_local.to_3x3().inverted()
            pbs['Hips'].location = Rl @ Vector(loc)
            pbs['Hips'].keyframe_insert('location', frame=f)
        actions.append(act)
        log('baked', name, nframes, 'frames')
    # leave Idle active; push others to NLA so the exporter finds all of them
    arm.animation_data.action = None
    for act in actions:
        tr = arm.animation_data.nla_tracks.new()
        tr.name = act.name
        st = tr.strips.new(act.name, 0, act)
        tr.mute = True
    arm.animation_data.action = bpy.data.actions.get('Idle')
    bpy.ops.object.mode_set(mode='OBJECT')
    return actions
