# Peachi 3D — Blender build pipeline

Everything is generated from code (no manual Blender steps), based on `Character_Sheet_1_Peachi.png`.

| Output | What |
|---|---|
| `assets/models/peachi.glb` | Rigged + skinned model, 12 animation clips, Draco-compressed (~5.8 MB) |
| `assets/models/headphones.glb` | The same cat-ear headphones on their own, static, centred (Night 1's pickup item, ~0.17 MB) |
| `assets/models/peachi.blend` | Same scene for editing in Blender (armature `PeachiRig`, one Action per clip) |

## Rebuild

```bash
python tools/blender/make_textures.py                 # 2D textures (needs Pillow): face atlases, logos, holo fabric…
blender --background --factory-startup --python tools/blender/build_peachi.py -- --save assets/models/peachi.blend
```

Useful flags: `--render DIR --views front,side,back,three --engine BLENDER_EEVEE` (preview renders),
`--frame 1.28,1.66` (zoom), `--pose Wave:20`, `--clips Idle,Wave`, `--no-rig`, `--no-export`.
`python tools/blender/compare_ref.py DIR out.png --region head` overlays renders on the sheet.

## How it's made

- **Body / head / hands / shoes**: signed-distance-field sculpting (`peachi/sdf.py`), meshed with OpenVDB.
  The head is lofted from the sheet's front + side silhouettes; face normals are transferred from a smooth
  proxy (Hoyoverse-style clean anime shading).
- **Face**: decal meshes projected from the front with expression atlases — eyes (8: open, smile, blink, wide,
  sad, angry, half, squint), brows (drawn through the bangs in three.js), mouth (8).
- **Hair**: ~110 clumps grown from the scalp and draped with a follow-the-leader rope sim (gravity + collision),
  brown→pink gradient in vertex colours.
- **Headphones** (`peachi/headphones.py`): fitted on the hair; `export.export_item()` also writes them alone to
  `headphones.glb` before rigging.
- **Rig** (`peachi/rig.py`): Mixamo-style humanoid (Hips…Head, arms, 15 finger bones per hand, legs) plus spring
  chains for hair (`Hair*`), skirt (`Skirt*`) and straps (`Strap*`) — 124 bones. Body/hands use bone-heat weights,
  clothes use weight transfer or procedural weights.
- **Animations** (`peachi/anim.py`): Idle, Walk, Wave, Peace, Float, Reach, Stunned, Jumpscare, Cry, Angry, Cheer,
  TPose, with baked secondary motion for hair/skirt/straps. Every clip keys every bone. Jumpscare only leans in a
  little: the game lunges her at the camera itself.

## Using it in three.js

The game goes through `buildPeachi()` / `buildHeadphonesItem()` in `js/peachi/model.js`, which keep the procedural
model's contract and swap the GLBs in once loaded (see `docs/ARCHITECTURE.md`). Directly:

```js
import { loadPeachi, loadHeadphones } from './js/peachi/peachi3d.js';
const peachi = await loadPeachi();      // a new instance per call; the GLB is fetched + decoded once
scene.add(peachi.object);
peachi.play('Wave');                    // crossfades
peachi.setEmotion('happy');             // neutral happy smile laugh cry angry scream surprised smug
peachi.setGhost(1);                     // legs fade out, pink rim, self-lit
peachi.setDark(1); peachi.setDesat(0.7); peachi.setHeadphones(false); peachi.lookAt(worldPoint);
// each frame: peachi.update(dt, camera)   (auto-blink, lean into motion, lip flap with setTalking(true))
const phones = await loadHeadphones();  // { object, dispose() }
```

Demo page: `peachi-3d.html` (serve the repo over http, e.g. `python -m http.server`).
