# Architecture & Module Contracts (Night 1 MVP)

Plain ES modules, no build. `import * as THREE from 'three'`, addons from `three/addons/...` (three r170, see import map in `index.html`).
World units = meters. Y up. Player eye height 1.6. All UI text Thai (fonts: Kanit / Mitr already loaded).
Run a page headless: `node tools/smoke.mjs <page.html> <out.png> [waitMs] [clickSelector]` → prints console errors + saves screenshot.

## File ownership (edit ONLY your own files)
| Owner | Files |
|---|---|
| A — Peachi model | `js/peachi/model.js`, `js/peachi/face.js`, `js/peachi/anim.js`, `peachi-viewer.html` |
| B — World & player | `js/level.js`, `js/player.js` |
| C — UI / audio / mic | `js/ui.js`, `js/mic.js`, `js/audio.js`, `js/data/chat.js`, `css/style.css` |
| D — Game logic | `js/main.js`, `js/night.js`, `js/ghosts/peachi.js` |

## Night 1 design (what "done" means)
- Setting: Peachi's small haunted house at night: stream room (desk + PC + RGB light), hallway, bedroom, kitchen, bathroom. Dark, purple fog.
- Clock 00:00 → 06:00, **50 s per in-game hour** (5 min total).
- Objective: find Peachi's **cat-ear headphones** (random item spot), press **E** to pick up, bring to **stream desk**, press **E** to place → **night cleared**. Reach 06:00 without placing → lose ("พีชชี่งอนจนกรีด").
- Lose also if: Peachi (angry) touches player → **jumpscare**; viewers drop to 0 → "ไลฟ์ล่ม".
- Peachi ghost phases through walls (no pathfinding): floats around nav points; mood rises over time; angry = chases player.
- Scream (mic loud / Space mash) within 7 m of Peachi → stun 3 s, mood −25, pushed back. Cooldown 3 s.
- Flashlight (F toggle) drains battery; beam on angry Peachi slows her 50%. Battery 0 → flashlight off.
- Chat: ghost spam messages appear; **Q** bans oldest spam. Spam alive > 8 s → viewers −10 each. Normal chat/superchat are jokes.
- Controls: WASD move, Shift run, mouse look (pointer lock), E interact, F flashlight, Space scream fallback, Q ban.

## Contracts

### A: `js/peachi/model.js`
```js
export function buildPeachi({ ghost = true } = {}) // → PeachiModel
// PeachiModel:
{
  group,                    // THREE.Group, origin at floor under her, faces +Z, ~1.5 m tall chibi (head:body ≈ 1:2)
  setExpression(name),      // 'happy' | 'cry' | 'angry' | 'scream'
  setPose(name),            // 'idle' | 'float' | 'reach' | 'jumpscare'
  setGlow(v),               // 0..1 pink rim/emissive intensity
  update(dt, t),            // animate (bob, hair sway, pose blending). Bobbing is internal (group.position untouched)
  dispose(),
}
export function buildHeadphonesItem() // → THREE.Group, the glowing cat-ear headphones pickup (~0.3 m), spins/bobs itself via userData.update(dt,t)
```
Recognizable features (from `PLAN.md` §5): pink/white cat-ear headphones with peach logo, long wavy brown hair → pink tips, iridescent off-shoulder white/pink jacket, white crop top with peach "PEACHI", black pleated skirt with pink stripes, pink straps "PEACHI", heart choker, right leg white thigh-high "249 PEACH", chunky white/pink sneakers, big amber anime eyes. Face = CanvasTexture (`face.js`), 4 expressions. Ghost mode: legs fade out toward the floor, pink Fresnel rim glow, slightly translucent. Low-poly `flatShading`, ≤ ~5k tris.

### B: `js/level.js`
```js
export function buildLevel(scene) // → Level
{
  spawn: { position: THREE.Vector3, yaw: number },
  deskPosition: THREE.Vector3,          // stream desk (place headphones here)
  itemSpots: THREE.Vector3[],           // ≥ 6 possible headphone spots (floor/furniture height)
  ghostSpawns: THREE.Vector3[],         // ≥ 3
  navPoints: THREE.Vector3[],           // ≥ 10 points spread across rooms (y = 0)
  collide(pos, radius),                 // mutates pos (Vector3) to push it out of walls/furniture (XZ only)
  setFlicker(on: boolean),              // flicker room lights
  update(dt, t),
}
```
### B: `js/player.js`
```js
export class Player {
  constructor(camera, domElement, level)
  position                 // THREE.Vector3 (feet), camera at +1.6
  yaw, pitch
  flashlight               // { on: boolean, battery: 0..100 } — SpotLight attached to camera, battery drains ~100 per 4 min when on
  isLocked                 // pointer lock state
  lock()                   // request pointer lock (call from a user gesture)
  enabled                  // false = ignore input (menus, jumpscare)
  addInteractable({ position, radius, label, onUse, enabled = () => true }) // → handle { remove() }
  onPrompt = (label|null) => {} // nearest usable interactable within radius & roughly in view
  onFlashlightToggle = (on) => {}
  isLightOn(targetPos)     // true if flashlight on and targetPos inside beam cone (≤ 12 m)
  update(dt)
}
```
### C: `js/mic.js`
```js
export const Scream = {
  async init(),            // request mic (call from user gesture). On failure/deny: usingMic=false, Space fallback still works
  usingMic,                // boolean
  level,                   // 0..1 smoothed mic loudness (0 when no mic)
  charge,                  // 0..1 Space-mash meter (decays)
  onScream(cb),            // cb() fired when loud mic (level > threshold ~0.5 for 0.15 s) OR charge reaches 1; 3 s cooldown
  cooldown,                // seconds remaining
  update(dt),
}
```
### C: `js/audio.js`
```js
export const sfx = { init(), play(name), setMaster(v) } // procedural Web Audio, no files. Master capped (jumpscare must not blow ears).
// names: 'jumpscare','pickup','place','ban','whisper','step','flicker','superchat','tick','win','lose','scream','stun','giggle'
export const ambient = { start(), stop(), setTension(0..1) } // low drone, heartbeat louder with tension
```
### C: `js/ui.js`
```js
export const UI = {
  init(),                                   // builds DOM inside #hud
  onStart(cb),                              // menu "เริ่มไลฟ์" button click (user gesture) → cb()
  onRetry(cb),
  showScreen(name, data),                   // 'menu' | 'intro' | 'play' | 'gameover' | 'win'; data: { title, text }
  setClock(hour, minute), setViewers(n), setBattery(pct), setScreamMeter(v0to1, cooldownSec, usingMic),
  setMood(name),                            // 'happy'|'cry'|'angry'|'scream' → small Peachi mood icon/face indicator
  setPrompt(text|null), setObjective(text), toast(text),
  subtitle(text, ms),                       // Peachi's voice line at bottom
  chat: { push({ user, text, type: 'normal'|'spam'|'superchat', amount }), banOldestSpam() /*→ bool*/, spamAges() /*→ number[] seconds*/ },
  flash(color), shake(ms), vignette(0..1),  // screen effects
}
```
### C: `js/data/chat.js`
```js
export const normalChat = [{ user, text }], spamChat = [{ user, text }], superChats = [{ user, text, amount }]
export const peachiLines = { happy: [], cry: [], angry: [], scream: [], stunned: [], found: [], win: [] } // Thai, funny
```
### Game flow (week 1 onward)
```
js/main.js              boot: renderer, level, player, Peachi, title menu, Director, loop
js/game/director.js     title → DM + prologue (first time) → night card → night → ending scene → win/lose card
js/game/save.js         localStorage 'peachi.save' (nights cleared, prologue seen, stats, achievements)
js/game/cutscene.js     async scenes: camera moves, subtitles, waits; Enter skips
js/game/talk.js         every spoken line: subtitle + babble voice (audio.js `voice`), Peachi's broken voice
js/nights/base.js       shared night: clock + scripted events at(hour), viewers, chat, hiding + search, lose/win
js/nights/night1.js     headphones, requests schedule, webcam scare 02:00, music hint 03:00, "เธอ" 04:00, ending
js/nights/prologue.js   DM, porch tutorial, doorbell, first meeting
js/systems/doors.js     E doors (animated leaves + colliders), locked doors, light switches
js/systems/hide.js      hiding spots, peek view, hold breath / stay quiet
js/systems/requests.js  Peachi's requests (hungry, dark, lonely)
js/ghosts/peachi.js     Peachi AI: mood, chase, stun, teleport, search a hiding spot, jumpscare
js/data/chat.js story.js   Thai text
```
