"""Outfit textures (holo fabric, crop top, skirt, belt, straps, sock, banner, jacket hem).
Imported by make_textures.py."""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from make_textures import OUT, Canvas, hexc, ellipse_pts, peach_outline


def font(size, variation=b'Bold Condensed', name='bahnschrift.ttf'):
    f = ImageFont.truetype(name, size)
    if variation:
        try:
            f.set_variation_by_name(variation)
        except Exception:
            pass
    return f


def holo_array(W, H, seed=3, white=0.55, scale=1.0):
    """Pastel iridescent swirl (float RGB array)."""
    rng = np.random.default_rng(seed)
    y, x = np.mgrid[0:H, 0:W] / max(W, H) * 6.0 * scale
    ph = np.zeros((H, W))
    for _ in range(6):
        a, b, c, d = rng.uniform(0.4, 1.6, 4)
        ph += np.sin(x * a + np.sin(y * b + rng.uniform(0, 6)) * 1.3 + rng.uniform(0, 6)) * c * 0.4
        ph += np.sin(y * d + np.sin(x * a * 0.7 + rng.uniform(0, 6)) * 1.1) * 0.3
    t = (ph - ph.min()) / (ph.max() - ph.min())
    pal = np.array([hexc(h)[:3] for h in ('#9fe8ff', '#c8b5ff', '#ffb3dd', '#fff0b0', '#b8ffe8', '#9fe8ff')])
    idx = t * (len(pal) - 1)
    i0 = np.floor(idx).astype(int).clip(0, len(pal) - 2)
    f = (idx - i0)[..., None]
    rgb = pal[i0] * (1 - f) + pal[i0 + 1] * f
    sheen = (0.5 + 0.5 * np.sin(ph * 3.0)) ** 4
    rgb = rgb * (1 - white) + white + sheen[..., None] * 0.12
    return np.clip(rgb, 0, 1)


def save_rgb(arr, name):
    Image.fromarray((np.clip(arr, 0, 1) * 255).astype(np.uint8), 'RGB').save(os.path.join(OUT, name))


def holo():
    h = holo_array(1024, 1024, 3, 0.36)
    save_rgb(h, 'holo.png')
    # pre-tinted variants (glTF drops Blender colour factors on textured inputs)
    save_rgb(h * hexc('#3a3050')[:3] * 1.6, 'holo_dark.png')
    save_rgb(h * hexc('#ff9ccb')[:3], 'holo_pink.png')


def sock():
    """u around the leg (0.5 = front), v bottom (z=0.10) .. top (z=0.69)."""
    W, H = 1024, 1024
    im = Image.fromarray((holo_array(W, H, 11, 0.62, 0.7) * 255).astype(np.uint8), 'RGB')
    d = ImageDraw.Draw(im)
    rng = np.random.default_rng(5)
    for _ in range(26):
        x = rng.uniform(0, W); y = rng.uniform(H * 0.2, H)
        pts = [(x, y)]
        for _ in range(4):
            if rng.random() < 0.5:
                x += rng.uniform(-60, 60)
            else:
                y += rng.uniform(20, 90)
            pts.append((x, y))
        d.line(pts, fill=(255, 255, 255), width=3)
        d.ellipse([x - 6, y - 6, x + 6, y + 6], outline=(255, 255, 255), width=3)

    def v2y(z):
        return (1 - (z - 0.10) / 0.59) * H
    cx = 0.435 * W
    lab = Image.new('RGBA', (360, 330), (0, 0, 0, 0))
    ld = ImageDraw.Draw(lab)
    ld.text((180, 95), '249', font=font(170), fill=(255, 92, 158, 255), anchor='mm')
    ld.text((180, 215), 'PEACH', font=font(66, b'Bold'), fill=(255, 92, 158, 255), anchor='mm')
    xx, k = 100, 0
    while xx < 260:
        wbar = [4, 7, 3, 5, 8, 3, 4][k % 7]
        ld.rectangle([xx, 262, xx + wbar, 318], fill=(30, 26, 40, 255))
        xx += wbar + [4, 3, 5, 4][k % 4]
        k += 1
    lab = lab.resize((int(360 * 0.62), int(330 * 0.62 * 0.52)), Image.LANCZOS)
    im.paste(lab, (int(cx - lab.size[0] / 2), int(v2y(0.655))), lab)
    im.save(os.path.join(OUT, 'sock.png'))


def top():
    """u around the torso (0.5 = front centre), v: z 1.118 (bottom) .. 1.27 (top)."""
    W, H = 1024, 512
    im = Image.new('RGB', (W, H), (252, 250, 255))
    d = ImageDraw.Draw(im)

    def ty(z):
        return (1 - (z - 1.118) / 0.152) * H
    for off in (-0.085, 0.085):
        x = (0.5 + off) * W
        d.line([(x, ty(1.14)), (x, ty(1.245))], fill=(255, 128, 180), width=5)
    cv = Canvas((120, 106), (-1, 1, -1, 0.77))
    lobe1 = ellipse_pts((-0.28, -0.1), 0.6, 0.62)
    lobe2 = ellipse_pts((0.28, -0.1), 0.6, 0.62)
    cv.paint(np.clip(cv.mask([lobe1]) + cv.mask([lobe2]), 0, 1), hexc('#ffa3c8'))
    peach_outline(cv, 0.0, -0.05, 0.62, 0.09, hexc('#ff5c9e'))
    cv.paint(cv.mask(ellipse_pts((0.36, 0.6), 0.22, 0.1, rot=0.5)), hexc('#6cc070'))
    logo = cv.image()
    im.paste(logo, (int(0.5 * W - 60), int(ty(1.238))), logo)
    d.text((0.5 * W, ty(1.166)), 'PEACHI', font=font(24, b'SemiBold'), fill=(255, 92, 158), anchor='mm')
    im.save(os.path.join(OUT, 'top.png'))


def skirt():
    """u around, v: 0 = hem .. 1 = waist. Black with pink stripes."""
    W, H = 64, 512
    arr = np.zeros((H, W, 3)); arr[...] = hexc('#1c1c2c')[:3]
    vv = 1 - (np.arange(H) + 0.5) / H
    for v0, w, col in ((0.06, 0.035, '#ff6aa6'), (0.105, 0.006, '#ffd0e4'), (0.22, 0.008, '#ff7fb3'),
                       (0.36, 0.008, '#ff7fb3'), (0.50, 0.008, '#ff7fb3'), (0.63, 0.008, '#ff7fb3')):
        arr[np.abs(vv - v0) < w] = hexc(col)[:3]
    save_rgb(arr, 'skirt.png')


def belt():
    W, H = 1024, 64
    cv = Canvas((W, H), (0, 16, 0, 1))
    cv.rgba[...] = hexc('#ff7fb6')
    for i in range(16):
        t = np.linspace(0, 2 * np.pi, 60)
        x = 16 * np.sin(t) ** 3
        y = 13 * np.cos(t) - 5 * np.cos(2 * t) - 2 * np.cos(3 * t) - np.cos(4 * t)
        cv.paint(cv.mask(np.stack([i + 0.5 + x * 0.012, 0.5 + y * 0.022], axis=1)), hexc('#ffe6f1'))
    rows = np.arange(H)[:, None] * np.ones((1, W))
    cv.paint(((rows < 4) | (rows > H - 5)).astype(float), hexc('#ff4f94'))
    cv.image().convert('RGB').save(os.path.join(OUT, 'belt.png'))


def strap():
    """u across, v along (top .. bottom of image = attach .. ring end)."""
    W, H = 128, 1024
    im = Image.new('RGB', (W, H), (255, 128, 182))
    d = ImageDraw.Draw(im)
    d.line([(8, 0), (8, H)], fill=(255, 205, 225), width=3)
    d.line([(W - 9, 0), (W - 9, H)], fill=(255, 205, 225), width=3)
    txt = Image.new('RGBA', (520, 110), (0, 0, 0, 0))
    ImageDraw.Draw(txt).text((260, 55), 'PEACHI', font=font(96, b'SemiBold SemiCondensed'), fill=(255, 255, 255, 255), anchor='mm')
    txt = txt.rotate(90, expand=True)
    im.paste(txt, (int(W / 2 - txt.size[0] / 2), 330), txt)
    cv = Canvas((110, 110), (-1, 1, -1, 1))
    peach_outline(cv, 0, -0.05, 0.7, 0.1, hexc('#ffffff'))
    lg = cv.image()
    im.paste(lg, (9, 880), lg)
    im.save(os.path.join(OUT, 'strap.png'))


def banner():
    W, H = 512, 1024
    cv = Canvas((W, H), (0, 1, 0, 2))
    X, Z = cv.coords()
    g = np.zeros((H, W, 4)); g[..., 3] = 1
    t = np.clip(Z / 2, 0, 1)[..., None]
    g[..., :3] = hexc('#ffa6cf')[:3] * (1 - t) + hexc('#ff6fae')[:3] * t
    glow = np.exp(-(((X - 0.5) / 0.35) ** 2 + ((Z - 1.3) / 0.4) ** 2))[..., None]
    g[..., :3] = g[..., :3] * (1 - 0.35 * glow) + hexc('#ffd7a8')[:3] * 0.35 * glow
    cv.rgba = g
    peach_outline(cv, 0.5, 1.33, 0.30, 0.045, hexc('#ffffff'))
    bi = cv.image()
    ImageDraw.Draw(bi).text((W / 2, H * 0.60), 'PEACHI', font=font(150), fill=(255, 255, 255, 255), anchor='mm')
    bi.convert('RGB').save(os.path.join(OUT, 'banner.png'))


def hem():
    W, H = 1024, 64
    cv = Canvas((W, H), (0, 16, 0, 1))
    cv.rgba[...] = hexc('#f4efff')
    for i in range(16):
        cv.paint(cv.mask(ellipse_pts((i + 0.5, 0.5), 0.16, 0.34)), hexc('#ff5c9e'))
        cv.paint(cv.mask(ellipse_pts((i + 0.56, 0.82), 0.07, 0.12, rot=0.6)), hexc('#6cc070'))
    rows = np.arange(H)[:, None] * np.ones((1, W))
    cv.paint(((rows < 5) | (rows > H - 6)).astype(float), hexc('#ff8cc0'))
    cv.image().convert('RGB').save(os.path.join(OUT, 'hem.png'))


def sleeve():
    """holo with a pink stripe down the outer side (u = 0.5)."""
    W, H = 1024, 1024
    a = holo_array(W, H, 21, 0.36, 0.8)
    u = (np.arange(W) + 0.5) / W
    m = np.clip(1 - np.abs(u - 0.5) / 0.045, 0, 1)
    m = np.clip(m * 3, 0, 1)[None, :, None]
    a = a * (1 - m) + hexc('#ff8cc0')[:3] * m
    save_rgb(a, 'sleeve.png')


def all_outfit():
    for fn in (holo, sock, top, skirt, belt, strap, banner, hem, sleeve):
        fn()
    print('outfit textures')
