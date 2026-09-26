"""Side-by-side + overlay of Blender preview renders against the character sheet.

Usage (system python with Pillow):
  python tools/blender/compare_ref.py RENDER_DIR OUT.png [--views front,side,back] [--region full|head|torso|legs|arms] [--mode blend|edges] [--h 900]
Renders come from build_peachi.py --render (orthographic, frame = 0..1.75 m, ground at the bottom edge).
"""
import os
import sys
from PIL import Image, ImageFilter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SHEET = os.path.join(ROOT, 'Character_Sheet_1_Peachi.png')
FRAME_M = 1.75

# per view: sheet crop box, ground row (crop px), center column (crop px), meters per px
REF = {
    'front': dict(box=(100, 600, 2130, 5600), ground=4960, cx=1050, k=1.60 / 4840),
    'side': dict(box=(2260, 580, 3350, 5520), ground=4913, cx=440, k=1.60 / 4780),
    'back': dict(box=(3380, 600, 5420, 5500), ground=4872, cx=985, k=1.60 / 4752),
}
REGIONS = {  # meters: (x0, x1, z0, z1)
    'full': (-0.875, 0.875, 0.0, 1.75),
    'head': (-0.16, 0.16, 1.30, 1.66),
    'torso': (-0.30, 0.30, 0.75, 1.40),
    'legs': (-0.30, 0.30, 0.0, 0.90),
    'arms': (-0.55, 0.55, 0.60, 1.40),
    'feet': (-0.25, 0.25, 0.0, 0.32),
}

_sheet = None


def sheet():
    global _sheet
    if _sheet is None:
        im = Image.open(SHEET).convert('RGBA')
        bg = Image.new('RGBA', im.size, (255, 255, 255, 255)); bg.alpha_composite(im)
        _sheet = bg.convert('RGB')
    return _sheet


def ref_view(view, size, frame=(0.0, FRAME_M), center=0.0):
    """Reference sheet mapped into the pixel space of a render with the given frame."""
    r = REF[view]
    ppm = size[1] / (frame[1] - frame[0])
    s = r['k'] * ppm
    # only resample the needed part of the sheet crop
    x0 = r['cx'] + (center - size[0] / 2 / ppm) / r['k']
    y0 = r['ground'] - frame[1] / r['k']
    w = size[0] / s; h = size[1] / s
    bx = r['box']
    crop = sheet().crop((int(bx[0] + x0), int(bx[1] + y0), int(bx[0] + x0 + w), int(bx[1] + y0 + h)))
    return crop.resize(size, Image.LANCZOS)


def region_box(size, region, frame=(0.0, FRAME_M), center=0.0):
    x0, x1, z0, z1 = REGIONS[region]
    ppm = size[1] / (frame[1] - frame[0])
    cx = size[0] / 2 - center * ppm
    return (int(cx + x0 * ppm), int((frame[1] - z1) * ppm), int(cx + x1 * ppm), int((frame[1] - z0) * ppm))


def main():
    rdir, outp = sys.argv[1], sys.argv[2]
    opts = {'--views': 'front,side,back', '--region': 'full', '--mode': 'blend', '--h': '900'}
    for i, a in enumerate(sys.argv):
        if a in opts and i + 1 < len(sys.argv):
            opts[a] = sys.argv[i + 1]
    rows = []
    for v in opts['--views'].split(','):
        p = os.path.join(rdir, v + '.png')
        if not os.path.exists(p):
            continue
        ren = Image.open(p).convert('RGB')
        meta = {'frame': [0.0, FRAME_M], 'center': [0.0, 0.0]}
        jp = p[:-4] + '.json'
        if os.path.exists(jp):
            import json
            meta = json.load(open(jp))
        frame, center = tuple(meta['frame']), meta['center'][0]
        tiles = [ren]
        if v in REF:
            ref = ref_view(v, ren.size, frame, center)
            if opts['--mode'] == 'blend':
                ov = Image.blend(ren, ref, 0.5)
            else:
                sil = ref.convert('L').point(lambda x: 255 if x < 246 else 0)
                e = sil.filter(ImageFilter.FIND_EDGES).filter(ImageFilter.MaxFilter(3))
                ov = ren.copy(); ov.paste(Image.new('RGB', ren.size, (255, 0, 60)), (0, 0), e)
            tiles = [ref, ren, ov]
        box = region_box(ren.size, opts['--region'], frame, center) if opts['--region'] != 'all' else (0, 0) + ren.size
        tiles = [im.crop(box) for im in tiles]
        H = int(opts['--h'])
        s = H / tiles[0].size[1]
        rows.append([t.resize((max(1, int(t.size[0] * s)), H), Image.LANCZOS) for t in tiles])
    w = max(sum(t.size[0] for t in r) for r in rows)
    h = sum(r[0].size[1] for r in rows)
    out = Image.new('RGB', (w, h), 'white')
    y = 0
    for r in rows:
        x = 0
        for t in r:
            out.paste(t, (x, y)); x += t.size[0]
        y += r[0].size[1]
    out.save(outp)
    print('saved', outp, out.size)


if __name__ == '__main__':
    main()
