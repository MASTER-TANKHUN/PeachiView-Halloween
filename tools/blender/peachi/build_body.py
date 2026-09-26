"""Skin meshes: body, head (+ face UVs), hands."""
import numpy as np
from . import sdf as S
from . import body as B
from . import util as U


def face_uv(V):
    """Planar front projection used by the face decals: x -> u, z -> v (1 unit = 0.16 m)."""
    u = 0.5 + V[:, 0] / 0.16
    v = 0.5 + (V[:, 2] - 1.43) / 0.16
    return np.stack([u, v], axis=1)


def build(ctx):
    coll, mats, log = ctx['coll'], ctx['mats'], ctx['log']
    V, F = S.sdf_to_mesh(B.body_sdf(), *B.body_bounds(), h=0.0045)
    log('body', len(V), 'verts')
    ctx['objects']['Body'] = U.decimate(U.make_mesh('Body', V, F, coll, mat=mats['skin']), 0.30, symmetric=True)

    V, F = S.sdf_to_mesh(B.head_sdf(), *B.head_bounds(), h=0.0020)
    log('head', len(V), 'verts')
    head = U.decimate(U.make_mesh('Head', V, F, coll, mat=mats['skin'], uv=face_uv(V)), 0.40, symmetric=True)
    from .face import vertex_normals
    V = U.mesh_arrays(head)
    N = B.face_normals(V, vertex_normals(V, U.mesh_faces(head)))
    head.data.normals_split_custom_set_from_vertices(N.tolist())
    ctx['head_normals'] = N
    ctx['objects']['Head'] = head

    V, F = S.sdf_to_mesh(B.hand_sdf_local(), *B.hand_local_bounds(), h=0.0014)
    ctx['objects']['Hand.L'] = U.decimate(U.make_mesh('Hand.L', B.hand_to_world(V, 1), F, coll, mat=mats['skin']), 0.30)
    ctx['objects']['Hand.R'] = U.decimate(U.make_mesh('Hand.R', B.hand_to_world(V, -1), F[:, ::-1], coll, mat=mats['skin']), 0.30)
    log('hands', len(V), 'verts each')
