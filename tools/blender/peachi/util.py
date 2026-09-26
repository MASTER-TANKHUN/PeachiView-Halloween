"""Blender-side helpers: scene reset, mesh creation, materials, preview renders."""
import math
import numpy as np
import bpy
from mathutils import Vector


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def collection(name, parent=None):
    c = bpy.data.collections.get(name)
    if c is None:
        c = bpy.data.collections.new(name)
        (parent or bpy.context.scene.collection).children.link(c)
    return c


def make_mesh(name, V, F, coll=None, smooth=True, mat=None, uv=None):
    """V: (n,3); F: (m,k) array or list of index lists; uv: optional per-vertex (n,2)."""
    me = bpy.data.meshes.new(name)
    V = np.asarray(V, dtype=np.float64)
    faces = F.tolist() if isinstance(F, np.ndarray) else [list(f) for f in F]
    me.from_pydata(V.tolist(), [], faces)
    me.validate(clean_customdata=False)
    me.update()
    if uv is not None:
        set_uv(me, uv)
    if smooth:
        me.shade_smooth()
    ob = bpy.data.objects.new(name, me)
    (coll or bpy.context.scene.collection).objects.link(ob)
    if mat is not None:
        me.materials.append(mat)
    return ob


def decimate(ob, ratio, symmetric=False):
    """Collapse-decimate a mesh in place (keeps UVs / colour attributes)."""
    if ratio >= 0.999:
        return ob
    m = ob.modifiers.new('Dec', 'DECIMATE')
    m.decimate_type = 'COLLAPSE'
    m.ratio = ratio
    m.use_collapse_triangulate = True
    if symmetric:
        m.use_symmetry = True
        m.symmetry_axis = 'X'
    dg = bpy.context.evaluated_depsgraph_get()
    ev = ob.evaluated_get(dg)
    me = bpy.data.meshes.new_from_object(ev)
    me.validate(clean_customdata=False)
    old = ob.data
    ob.modifiers.remove(m)
    ob.data = me
    bpy.data.meshes.remove(old)
    me.name = ob.name
    return ob


def set_uv(me, uv_per_vertex, name='UVMap'):
    uvl = me.uv_layers.get(name) or me.uv_layers.new(name=name)
    idx = np.empty(len(me.loops), dtype=np.int64)
    me.loops.foreach_get('vertex_index', idx)
    uv = np.asarray(uv_per_vertex, dtype=np.float32)[idx]
    uvl.data.foreach_set('uv', uv.ravel())
    return uvl


def set_uv_loops(me, uv_per_loop, name='UVMap'):
    uvl = me.uv_layers.get(name) or me.uv_layers.new(name=name)
    uvl.data.foreach_set('uv', np.asarray(uv_per_loop, dtype=np.float32).ravel())
    return uvl


def set_vcol(me, colors_per_vertex, name='Col'):
    """colors: (n,3|4) linear floats, stored per corner (exports as COLOR_0)."""
    c = np.asarray(colors_per_vertex, dtype=np.float32)
    if c.shape[1] == 3:
        c = np.concatenate([c, np.ones((len(c), 1), np.float32)], axis=1)
    attr = me.color_attributes.get(name) or me.color_attributes.new(name, 'FLOAT_COLOR', 'POINT')
    attr.data.foreach_set('color', c.ravel())
    return attr


def mesh_arrays(ob, world=False):
    me = ob.data
    V = np.empty(len(me.vertices) * 3)
    me.vertices.foreach_get('co', V)
    V = V.reshape(-1, 3)
    if world:
        M = np.array(ob.matrix_world)
        V = V @ M[:3, :3].T + M[:3, 3]
    return V


def mesh_faces(ob):
    me = ob.data
    ls = np.empty(len(me.polygons), dtype=np.int64); me.polygons.foreach_get('loop_start', ls)
    lt = np.empty(len(me.polygons), dtype=np.int64); me.polygons.foreach_get('loop_total', lt)
    vi = np.empty(len(me.loops), dtype=np.int64); me.loops.foreach_get('vertex_index', vi)
    return [vi[s:s + t] for s, t in zip(ls, lt)]


def set_verts(ob, V):
    ob.data.vertices.foreach_set('co', np.asarray(V, dtype=np.float32).ravel())
    ob.data.update()


def srgb_to_lin(c):
    c = np.asarray(c, dtype=np.float64)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def load_image(path, name=None, non_color=False):
    im = bpy.data.images.load(path, check_existing=True)
    if name:
        im.name = name
    if non_color:
        im.colorspace_settings.name = 'Non-Color'
    return im


def principled(name, color=(0.8, 0.8, 0.8), rough=0.6, metal=0.0, emission=None, emission_strength=0.0,
               alpha=1.0, image=None, vcol=None, blend='OPAQUE', double_sided=False, spec=0.3,
               emission_image=None):
    """Principled BSDF material that exports cleanly to glTF. `color` is sRGB."""
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial'); out.location = (400, 0)
    bs = nt.nodes.new('ShaderNodeBsdfPrincipled'); bs.location = (100, 0)
    nt.links.new(bs.outputs['BSDF'], out.inputs['Surface'])
    lin = tuple(srgb_to_lin(color[:3])) + (1.0,)
    bs.inputs['Base Color'].default_value = lin
    bs.inputs['Roughness'].default_value = rough
    bs.inputs['Metallic'].default_value = metal
    if 'Specular IOR Level' in bs.inputs:
        bs.inputs['Specular IOR Level'].default_value = spec
    if image is not None:
        tex = nt.nodes.new('ShaderNodeTexImage'); tex.location = (-320, 0)
        tex.image = image
        if vcol:
            vc = nt.nodes.new('ShaderNodeVertexColor'); vc.location = (-320, -300); vc.layer_name = vcol
            mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'
            mix.location = (-100, 0); mix.inputs['Factor'].default_value = 1.0
            nt.links.new(tex.outputs['Color'], mix.inputs['A'])
            nt.links.new(vc.outputs['Color'], mix.inputs['B'])
            nt.links.new(mix.outputs['Result'], bs.inputs['Base Color'])
        else:
            nt.links.new(tex.outputs['Color'], bs.inputs['Base Color'])
        if blend != 'OPAQUE':
            nt.links.new(tex.outputs['Alpha'], bs.inputs['Alpha'])
    elif vcol:
        vc = nt.nodes.new('ShaderNodeVertexColor'); vc.location = (-320, 0); vc.layer_name = vcol
        nt.links.new(vc.outputs['Color'], bs.inputs['Base Color'])
    if emission is not None or emission_image is not None:
        bs.inputs['Emission Color'].default_value = tuple(srgb_to_lin((emission or (1, 1, 1))[:3])) + (1.0,)
        bs.inputs['Emission Strength'].default_value = emission_strength
        if emission_image is not None:
            et = nt.nodes.new('ShaderNodeTexImage'); et.location = (-320, -350); et.image = emission_image
            nt.links.new(et.outputs['Color'], bs.inputs['Emission Color'])
    if alpha < 1.0:
        bs.inputs['Alpha'].default_value = alpha
    if blend != 'OPAQUE' or alpha < 1.0:
        try:
            m.surface_render_method = 'BLENDED' if blend == 'BLEND' else 'DITHERED'
        except Exception:
            pass
        try:
            m.blend_method = 'BLEND' if blend == 'BLEND' else 'CLIP'
        except Exception:
            pass
    m.use_backface_culling = not double_sided
    m.diffuse_color = lin
    return m


# ------------------------------------------------------------------ preview rendering
VIEWS = {
    'front': ((0.0, -6.0, 0.0), (math.radians(90), 0.0, 0.0)),
    'side': ((6.0, 0.0, 0.0), (math.radians(90), 0.0, math.radians(90))),
    'back': ((0.0, 6.0, 0.0), (math.radians(90), 0.0, math.radians(180))),
    'three': ((-3.44, -4.91, 0.0), (math.radians(90), 0.0, math.radians(-35))),
    'rside': ((-6.0, 0.0, 0.0), (math.radians(90), 0.0, math.radians(-90))),
}


def setup_preview(engine='BLENDER_WORKBENCH', res=(1400, 1400), shading='MATERIAL'):
    sc = bpy.context.scene
    sc.render.engine = engine
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.resolution_percentage = 100
    sc.render.film_transparent = False
    sc.view_settings.view_transform = 'Standard'
    cam = bpy.data.objects.get('PreviewCam')
    if cam is None:
        cd = bpy.data.cameras.new('PreviewCam')
        cam = bpy.data.objects.new('PreviewCam', cd)
        sc.collection.objects.link(cam)
    cam.data.type = 'ORTHO'
    cam.data.clip_start, cam.data.clip_end = 0.1, 20
    sc.camera = cam
    if engine == 'BLENDER_WORKBENCH':
        sh = sc.display.shading
        sh.light = 'STUDIO'
        sh.color_type = shading
        sh.show_cavity = False
        sh.show_object_outline = True
        sh.object_outline_color = (0.05, 0.03, 0.05)
        sh.show_specular_highlight = True
        sc.display.render_aa = '8'
    if sc.world is None:
        sc.world = bpy.data.worlds.new('World')
    sc.world.color = (1, 1, 1)
    if engine != 'BLENDER_WORKBENCH':
        w = sc.world
        w.use_nodes = True
        bg = w.node_tree.nodes.get('Background')
        bg.inputs['Color'].default_value = (1.0, 1.0, 1.0, 1)
        bg.inputs['Strength'].default_value = 0.9
        if 'PreviewSun' not in bpy.data.objects:
            ld = bpy.data.lights.new('PreviewSun', 'SUN'); ld.energy = 2.2; ld.angle = 0.3
            lo = bpy.data.objects.new('PreviewSun', ld); sc.collection.objects.link(lo)
            lo.rotation_euler = (math.radians(50), 0, math.radians(-30))
        try:
            sc.eevee.taa_render_samples = 16
        except Exception:
            pass
    return cam


def render_view(view, path, frame=(0.0, 1.75), center=(0.0, 0.0)):
    """frame = (z_bottom, z_top) visible; center = horizontal offset of the frame center."""
    cam = bpy.data.objects['PreviewCam']
    sc = bpy.context.scene
    cam.data.ortho_scale = (frame[1] - frame[0]) * max(sc.render.resolution_x, sc.render.resolution_y) / sc.render.resolution_y
    loc, rot = VIEWS[view]
    zc = (frame[0] + frame[1]) / 2
    cam.rotation_euler = rot
    right = cam.rotation_euler.to_matrix() @ Vector((1, 0, 0))
    cam.location = Vector((loc[0], loc[1], zc)) + right * center[0]
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    import json
    with open(path.rsplit('.', 1)[0] + '.json', 'w') as f:
        json.dump({'view': view, 'frame': list(frame), 'center': list(center)}, f)
