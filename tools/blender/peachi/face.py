"""Face decals: eyes / mouth expression atlases projected from the front onto the head.

Atlas layout (must match tools/blender/make_textures.py): cell 0 = top-left, row-major.
UVs address cell 0; three.js switches expressions with texture.offset = (col/cols, row/rows).
"""
import numpy as np
import bpy
from . import util as U
from .materials import tex

EYES_REGION = (-0.068, 0.068, 1.402, 1.498)
EYES_GRID = (2, 4)
EYE_NAMES = ['open', 'smile', 'blink', 'wide', 'sad', 'angry', 'half', 'squint']
MOUTH_REGION = (-0.026, 0.026, 1.372, 1.414)
MOUTH_GRID = (4, 2)
MOUTH_NAMES = ['smile', 'open', 'frown', 'fang', 'scream', 'o', 'ah', 'neutral']


def vertex_normals(V, F):
    n = np.zeros_like(V)
    if isinstance(F, np.ndarray) and F.ndim == 2:
        F = F.tolist()
    for f in F:
        f = list(f)
        for i in range(len(f) - 2):
            a, b, c = V[f[0]], V[f[i + 1]], V[f[i + 2]]
            fn = np.cross(b - a, c - a)
            n[f[0]] += fn; n[f[i + 1]] += fn; n[f[i + 2]] += fn
    return n / np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-12)


def decal(name, head_ob, region, grid, mat, coll, offset=0.00025, margin=0.0, custom=None):
    V = U.mesh_arrays(head_ob)
    Fl = [list(f) for f in U.mesh_faces(head_ob)]
    x0, x1, z0, z1 = region
    inside = (V[:, 0] > x0 + margin) & (V[:, 0] < x1 - margin) & (V[:, 2] > z0 + margin) & (V[:, 2] < z1 - margin)
    N = vertex_normals(V, Fl)
    front = (N[:, 1] < -0.12) & (V[:, 1] < -0.02)
    ok = inside & front
    sel = [f for f in Fl if ok[f].all()]
    used = np.unique(np.concatenate([np.array(f) for f in sel]))
    remap = -np.ones(len(V), dtype=np.int64); remap[used] = np.arange(len(used))
    Vd = V[used] + N[used] * offset
    Fd = [list(remap[np.array(f)]) for f in sel]
    cols, rows = grid
    u = (V[used, 0] - x0) / (x1 - x0) / cols
    v = 1.0 - 1.0 / rows + (V[used, 2] - z0) / (z1 - z0) / rows
    ob = U.make_mesh(name, Vd, Fd, coll, mat=mat, uv=np.stack([u, v], axis=1))
    if custom is not None:
        ob.data.normals_split_custom_set_from_vertices(custom[used].tolist())
    return ob


def build(ctx):
    coll, head = ctx['coll'], ctx['objects']['Head']
    m_eyes = U.principled('FaceEyes', (1, 1, 1), rough=0.8, image=tex('face_eyes.png'), blend='BLEND')
    m_mouth = U.principled('FaceMouth', (1, 1, 1), rough=0.8, image=tex('face_mouth.png'), blend='BLEND')
    cn = ctx.get('head_normals')
    eyes = decal('FaceEyes', head, EYES_REGION, EYES_GRID, m_eyes, coll, custom=cn)
    mouth = decal('FaceMouth', head, MOUTH_REGION, MOUTH_GRID, m_mouth, coll, offset=0.0003, custom=cn)
    for ob, names, grid in ((eyes, EYE_NAMES, EYES_GRID), (mouth, MOUTH_NAMES, MOUTH_GRID)):
        ob['atlas_grid'] = list(grid)
        ob['atlas_names'] = ','.join(names)
    m_brows = U.principled('FaceBrows', (1, 1, 1), rough=0.8, image=tex('face_brows.png'), blend='BLEND')
    brows = decal('FaceBrows', head, EYES_REGION, EYES_GRID, m_brows, coll, offset=0.0004, custom=cn)
    brows['atlas_grid'] = list(EYES_GRID)
    brows['atlas_names'] = ','.join(EYE_NAMES)
    ctx['objects']['FaceBrows'] = brows
    ctx['objects']['FaceEyes'] = eyes
    ctx['objects']['FaceMouth'] = mouth
    ctx['log']('face decals', len(eyes.data.vertices), len(mouth.data.vertices))
