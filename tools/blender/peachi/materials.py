"""Material library. Names matter: the three.js side upgrades materials by name
(toon shading, iridescence for Holo*, emissive glow for *Glow, alpha for Face*)."""
import os
import bpy
from . import util as U
from .config import PAL, TEX_DIR


def tex(name, non_color=False):
    p = os.path.join(TEX_DIR, name)
    if not os.path.exists(p):
        return None
    return U.load_image(p, non_color=non_color)


def make_materials():
    M = {}
    M['skin'] = U.principled('Skin', PAL['skin'], rough=0.65)
    M['hair'] = U.principled('Hair', (1, 1, 1), rough=0.45, image=tex('hair.png'), vcol='Col', double_sided=True)
    M['pink'] = U.principled('Pink', PAL['pink'], rough=0.35)
    M['pink_hot'] = U.principled('PinkHot', PAL['pink_hot'], rough=0.35)
    M['pink_pale'] = U.principled('PinkPale', PAL['pink_pale'], rough=0.4)
    M['white'] = U.principled('White', PAL['white'], rough=0.45)
    M['lavender'] = U.principled('Lavender', PAL['lavender'], rough=0.35)
    M['black'] = U.principled('Black', PAL['black'], rough=0.55)
    M['navy'] = U.principled('Navy', PAL['navy'], rough=0.5)
    M['gold'] = U.principled('Gold', PAL['gold'], rough=0.25, metal=1.0)
    return M
