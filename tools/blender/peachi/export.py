"""GLB export (three.js friendly)."""
import os
import bpy
import numpy as np
from mathutils import Matrix, Vector

DRACO = dict(
    export_draco_mesh_compression_enable=True,
    export_draco_mesh_compression_level=7,
    export_draco_position_quantization=14,
    export_draco_normal_quantization=10,
    export_draco_texcoord_quantization=12,
    export_draco_color_quantization=10,
    export_draco_generic_quantization=12,
)


def export_glb(path, log=print):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    for ob in bpy.data.objects:
        ob.select_set(False)
    kw = dict(
        filepath=path,
        export_format='GLB',
        use_selection=False,
        export_yup=True,
        export_apply=False,
        export_texcoords=True,
        export_normals=True,
        export_tangents=False,
        export_materials='EXPORT',
        export_image_format='AUTO',
        export_vertex_color='NAME',
        export_vertex_color_name='Col',
        export_all_vertex_colors=False,
        export_active_vertex_color_when_no_material=False,
        export_extras=True,
        export_skins=True,
        export_def_bones=True,
        export_leaf_bone=False,
        export_rest_position_armature=True,
        export_animations=True,
        export_animation_mode='ACTIONS',
        export_force_sampling=True,
        export_optimize_animation_size=True,
        export_morph=True,
        export_morph_normal=False,
        **DRACO,
    )
    # drop preview-only helpers
    hidden = []
    for ob in bpy.data.objects:
        if ob.type in ('CAMERA', 'LIGHT'):
            hidden.append(ob)
    for ob in hidden:
        bpy.data.objects.remove(ob, do_unlink=True)
    bpy.ops.export_scene.gltf(**kw)
    log('exported', path, '%.1f MB' % (os.path.getsize(path) / 1e6))


def export_item(objs, path, rename=None, log=print):
    """Export static copies of `objs` as their own GLB, centred on their bounding box (e.g. the pickup headphones)."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    for ob in bpy.data.objects:
        ob.select_set(False)
    dups = []
    for ob in objs:
        d = ob.copy()
        d.data = ob.data.copy()
        d.modifiers.clear()
        d.data.transform(ob.matrix_world)
        d.matrix_world = Matrix.Identity(4)
        d.name = rename(ob.name) if rename else ob.name + '_item'
        ob.users_collection[0].objects.link(d)
        dups.append(d)
    pts = np.concatenate([np.array([v.co[:] for v in d.data.vertices]) for d in dups])
    center = (pts.min(0) + pts.max(0)) / 2
    for d in dups:
        d.data.transform(Matrix.Translation(-Vector(center)))
        d.select_set(True)
    bpy.context.view_layer.objects.active = dups[0]
    bpy.ops.export_scene.gltf(
        filepath=path, export_format='GLB', use_selection=True, export_yup=True, export_apply=False,
        export_texcoords=True, export_normals=True, export_tangents=False, export_materials='EXPORT',
        export_image_format='AUTO', export_vertex_color='NAME', export_vertex_color_name='Col',
        export_all_vertex_colors=False, export_active_vertex_color_when_no_material=False, export_extras=True,
        export_skins=False, export_animations=False, export_morph=False, **DRACO)
    for d in dups:
        me = d.data
        bpy.data.objects.remove(d, do_unlink=True)
        bpy.data.meshes.remove(me)
    log('exported', path, '%.2f MB' % (os.path.getsize(path) / 1e6), 'size %.3f x %.3f x %.3f m' % tuple(pts.max(0) - pts.min(0)))
