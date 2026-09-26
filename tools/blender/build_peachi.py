"""Build the rigged Peachi character in Blender and export GLB.

Run from the repo root:
  blender --background --factory-startup --python tools/blender/build_peachi.py -- [options]
Options:
  --parts all|body,hair,clothes,...   which parts to build (default all)
  --render DIR                        write orthographic preview renders
  --views front,side,back,three       preview views
  --no-rig / --no-export              skip rigging / GLB export
"""
import os
import sys
import time
import argparse
import importlib

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402
import numpy as np  # noqa: E402

T0 = time.time()


def log(*a):
    print('[peachi %6.1fs]' % (time.time() - T0), *a, flush=True)


def argv():
    a = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument('--parts', default='all')
    p.add_argument('--render', default='')
    p.add_argument('--views', default='front,side,back')
    p.add_argument('--engine', default='BLENDER_WORKBENCH')
    p.add_argument('--frame', default='0,1.75')
    p.add_argument('--center', default='0')
    p.add_argument('--no-rig', action='store_true')
    p.add_argument('--no-export', action='store_true')
    p.add_argument('--save', default='')
    p.add_argument('--clips', default='')
    p.add_argument('--pose', default='')
    return p.parse_args(a)


def main():
    args = argv()
    from peachi import util as U
    from peachi import config as C
    from peachi import materials as M
    from peachi import build_body
    U.clear_scene()
    coll = U.collection('Peachi')
    mats = M.make_materials()
    ctx = {'coll': coll, 'mats': mats, 'log': log, 'objects': {}}
    parts = set(args.parts.split(','))
    want = lambda p: 'all' in parts or p in parts  # noqa: E731

    build_body.build(ctx)
    from peachi import face
    face.build(ctx)
    if want('hair'):
        from peachi import hair
        hair.build(ctx)
    if want('head_acc'):
        from peachi import headphones
        headphones.build(ctx)
    if want('clothes'):
        from peachi import clothes
        clothes.build(ctx)
    if want('jacket'):
        from peachi import jacket
        jacket.build(ctx)
    if want('shoes'):
        from peachi import shoes
        shoes.build(ctx)

    if not args.no_rig:
        from peachi import rig, anim
        rig.build_armature(ctx)
        rig.skin(ctx)
        anim.bake(ctx, args.clips.split(',') if args.clips else None)
    if args.pose:
        clip, frame = args.pose.split(':')
        arm = ctx.get('armature')
        if arm is not None and bpy.data.actions.get(clip):
            arm.animation_data.action = bpy.data.actions[clip]
            bpy.context.scene.frame_set(int(frame))
    if args.render:
        os.makedirs(args.render, exist_ok=True)
        U.setup_preview(engine=args.engine)
        fr = tuple(float(x) for x in args.frame.split(','))
        for v in args.views.split(','):
            U.render_view(v, os.path.join(args.render, v + '.png'), frame=fr, center=(float(args.center), 0))
            log('rendered', v)
    if args.save:
        os.makedirs(os.path.dirname(os.path.abspath(args.save)), exist_ok=True)
        bpy.context.preferences.filepaths.save_version = 0
        bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(args.save))
        bak = os.path.abspath(args.save) + '1'
        if os.path.exists(bak):
            os.remove(bak)
        log('saved', args.save)
    if not args.no_export and not args.no_rig:
        from peachi import export
        export.export_glb(os.path.join(C.OUT_DIR, 'peachi.glb'), log)


main()
