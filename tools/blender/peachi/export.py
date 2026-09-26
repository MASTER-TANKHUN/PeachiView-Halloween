"""GLB export (three.js friendly)."""
import os
import bpy


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
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=7,
        export_draco_position_quantization=14,
        export_draco_normal_quantization=10,
        export_draco_texcoord_quantization=12,
        export_draco_color_quantization=10,
        export_draco_generic_quantization=12,
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
