// Phi Pop (ผีปอบ, "the eating kind") — Night 3's guest: a skinny old man in a checked pha khao ma, pot belly,
// huge mouth. He walks (1.2 m/s) and is always hungry (0–100): he eats the snacks off the kitchen rack one
// by one (the chalkboard above it counts them down, and you can hear him chewing through the walls). When
// the snacks run out and he's starving, he hunts you — and a closed door only slows him down: three blows
// and it's gone. Red soda at the spirit house calms him for 90 s (he burps; the second choker piece comes
// out). A snack from your hand buys time; a scream stuns him for 2 s; the flashlight does nothing.
import * as THREE from 'three';
import { sfx } from '../audio.js';
import { UI } from '../ui.js';
import { Talk } from '../game/talk.js';
import { panFor } from '../systems/doors.js';
import { nearestRoom, buildRoute, roomsLinked } from './nav.js';

const TAU = Math.PI * 2;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];

export const RACK = V(0.9, 0, 2.0);        // where he stands to eat (the snack rack by the kitchen's north wall)
export const SHRINE = V(3.95, 0, 5.95);    // where he stands to drink (in front of the spirit house)
export const FRONT_OUT = V(-11.4, 0, 0), FRONT_IN = V(-8.9, 0, 0);
const WALK = 1.2, HUNT = 1.3, CATCH = 0.85;
const LINES = {
  hungry: ['หิว… หิวจัง…', 'ขนม… ขนมอยู่ไหน…', 'หมูกระทะหมดแล้วเหรอ…', 'ท้องร้องจนผนังสั่นแล้วนะ…'],
  hunt: ['กลิ่นมอด… หอมจัง…', 'มอดตัวนี้กินได้มั้ยน้า…', 'ขนมหมดแล้ว… มอดก็ได้…'],
  fed: ['อร่อย… ขอบใจนะหลาน', 'อิ่มไปห้านาที…', 'หลานใจดีจัง'],
  soda: ['น้ำแดง!! ของโปรด', 'เย็นชื่นใจ…'],
  giveUp: ['หายไปไหนแล้ว…', 'ช่างเถอะ… ไปกินขนมดีกว่า'],
};

// ---------------------------------------------------------------- the model
function plaid() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#b82a3a'; g.fillRect(0, 0, 256, 256);
  const band = (color, w, alpha) => { g.fillStyle = color; g.globalAlpha = alpha; for (let i = 0; i < 256; i += 64) { g.fillRect(i + 8, 0, w, 256); g.fillRect(0, i + 8, 256, w); } g.globalAlpha = 1; };
  band('#1a3a8a', 22, 0.75); band('#f4f0e6', 6, 0.8); band('#2a7a4a', 10, 0.55);
  for (let i = 0; i < 256; i += 4) { g.fillStyle = 'rgba(0,0,0,0.06)'; g.fillRect(i, 0, 1, 256); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 1);
  return t;
}
function gradient() {
  const d = new Uint8Array([60, 60, 60, 255, 140, 140, 140, 255, 255, 255, 255, 255]);
  const t = new THREE.DataTexture(d, 3, 1, THREE.RGBAFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t;
}

function buildModel() {
  const grad = gradient();
  const toon = (color, o = {}) => new THREE.MeshToonMaterial({ color, gradientMap: grad, emissive: o.emissive ?? 0x0e140a, emissiveIntensity: 1, ...o.extra });
  const SKIN = toon(0x8ea276, { emissive: 0x15220c }), SKIN_D = toon(0x6e8058, { emissive: 0x101a08 }), CLOTH = new THREE.MeshToonMaterial({ map: plaid(), gradientMap: grad, emissive: 0x100406 });
  const TEETH = toon(0xeee2b8), MOUTH = new THREE.MeshBasicMaterial({ color: 0x1a0406 }), HAIR = toon(0xf0ece4, { emissive: 0x202020 });
  const EYE = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 0.35, 0.2), toneMapped: false }), SOCKET = new THREE.MeshBasicMaterial({ color: 0x0a0806 });
  const INK = new THREE.MeshBasicMaterial({ color: 0x06050a, side: THREE.BackSide });
  const mesh = (geo, mat, p, s, r) => { const m = new THREE.Mesh(geo, mat); if (p) m.position.set(...p); if (s) Array.isArray(s) ? m.scale.set(...s) : m.scale.setScalar(s); if (r) m.rotation.set(...r); return m; };
  const hull = (m, k = 1.05) => { const h = new THREE.Mesh(m.geometry, INK); h.position.copy(m.position); h.rotation.copy(m.rotation); h.scale.copy(m.scale).multiplyScalar(k); m.parent.add(h); return h; };
  const cyl = (r0, r1, h, seg = 10) => { const g = new THREE.CylinderGeometry(r0, r1, h, seg); g.translate(0, -h / 2, 0); return g; }; // hangs down from its pivot

  const root = new THREE.Group(); root.name = 'phiPop';
  const hips = new THREE.Group(); hips.position.y = 0.64; root.add(hips);
  // legs
  const legs = [-1, 1].map((s) => {
    const thigh = new THREE.Group(); thigh.position.set(s * 0.075, 0, 0); hips.add(thigh);
    thigh.add(mesh(cyl(0.036, 0.03, 0.31), SKIN));
    const knee = new THREE.Group(); knee.position.y = -0.31; thigh.add(knee);
    knee.add(mesh(new THREE.SphereGeometry(0.04, 10, 8), SKIN_D));
    knee.add(mesh(cyl(0.03, 0.024, 0.3), SKIN));
    const foot = mesh(new THREE.SphereGeometry(0.05, 10, 8), SKIN_D, [0, -0.31, 0.04], [0.9, 0.45, 1.7]); knee.add(foot);
    return { thigh, knee, side: s };
  });
  // pha khao ma, worn as a loincloth-sarong
  const skirt = mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.34, 20, 1, true), CLOTH, [0, -0.1, 0.02]);
  skirt.material.side = THREE.DoubleSide;
  hips.add(skirt);
  const knot = mesh(new THREE.SphereGeometry(0.045, 10, 8), CLOTH, [0.06, 0.07, 0.21], [1.2, 0.8, 0.8]); hips.add(knot);
  // spine: hunched forward
  const spine = new THREE.Group(); spine.position.y = 0.04; spine.rotation.x = 0.32; hips.add(spine);
  const belly = mesh(new THREE.SphereGeometry(0.2, 22, 16), SKIN, [0, 0.14, 0.09], [1.02, 0.95, 1.08]); spine.add(belly); hull(belly, 1.04);
  spine.add(mesh(new THREE.SphereGeometry(0.012, 8, 6), SKIN_D, [0, 0.12, 0.305]));
  const chest = mesh(new THREE.CapsuleGeometry(0.115, 0.16, 4, 14), SKIN, [0, 0.38, -0.02], [1.15, 1, 0.75]); spine.add(chest); hull(chest, 1.05);
  for (let i = 0; i < 4; i++) spine.add(mesh(new THREE.TorusGeometry(0.1 - i * 0.004, 0.005, 4, 16, Math.PI * 0.7), SKIN_D, [0, 0.44 - i * 0.04, 0.045], [0, 0, 1], [Math.PI / 2, 0, Math.PI * 0.15 + Math.PI])); // ribs
  const sash = mesh(new THREE.BoxGeometry(0.08, 0.55, 0.02), CLOTH, [0.02, 0.36, 0.085], null, [0.1, 0, 0.62]); spine.add(sash); // over the shoulder
  // arms: long and bony
  const arms = [-1, 1].map((s) => {
    const sh = new THREE.Group(); sh.position.set(s * 0.15, 0.47, -0.02); spine.add(sh);
    sh.add(mesh(new THREE.SphereGeometry(0.04, 10, 8), SKIN));
    sh.add(mesh(cyl(0.028, 0.022, 0.28), SKIN));
    const el = new THREE.Group(); el.position.y = -0.28; sh.add(el);
    el.add(mesh(new THREE.SphereGeometry(0.027, 8, 6), SKIN_D));
    el.add(mesh(cyl(0.022, 0.018, 0.27), SKIN));
    const hand = new THREE.Group(); hand.position.y = -0.28; el.add(hand);
    hand.add(mesh(new THREE.SphereGeometry(0.035, 10, 8), SKIN_D, [0, -0.01, 0], [1, 1.2, 0.6]));
    for (let f = 0; f < 4; f++) hand.add(mesh(new THREE.ConeGeometry(0.008, 0.09, 6), SKIN_D, [(f - 1.5) * 0.016, -0.075, 0.005], null, [Math.PI, 0, 0]));
    return { sh, el, hand, side: s };
  });
  // head
  const neck = new THREE.Group(); neck.position.set(0, 0.56, 0.02); neck.rotation.x = -0.25; spine.add(neck);
  neck.add(mesh(cyl(0.04, 0.045, 0.08), SKIN, [0, 0.08, 0]));
  const head = new THREE.Group(); head.position.y = 0.13; neck.add(head);
  const skull = mesh(new THREE.SphereGeometry(0.13, 24, 18), SKIN, [0, 0.04, 0], [0.92, 1.02, 1]); head.add(skull); hull(skull, 1.05);
  for (const s of [-1, 1]) {
    head.add(mesh(new THREE.SphereGeometry(0.035, 10, 8), SOCKET, [s * 0.047, 0.06, 0.1], [1.1, 0.8, 0.5]));
    head.add(mesh(new THREE.SphereGeometry(0.011, 8, 6), EYE, [s * 0.047, 0.058, 0.118]));
    head.add(mesh(new THREE.BoxGeometry(0.06, 0.018, 0.02), HAIR, [s * 0.05, 0.1, 0.11], null, [0, 0, s * -0.3])); // bushy brows
    head.add(mesh(new THREE.SphereGeometry(0.035, 10, 8), SKIN_D, [s * 0.125, 0.04, 0], [0.4, 1, 0.8])); // big ears
    for (let k = 0; k < 3; k++) head.add(mesh(new THREE.SphereGeometry(0.035, 8, 6), HAIR, [s * (0.095 + k * 0.012), 0.1 - k * 0.04, -0.06 - k * 0.012], [0.7, 1, 1])); // tufts
  }
  head.add(mesh(new THREE.SphereGeometry(0.026, 10, 8), SKIN_D, [0, 0.025, 0.13], [1, 1.2, 1])); // nose
  // mouth: upper teeth fixed, the jaw drops
  head.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.01, 20, 1, false, 0, Math.PI), MOUTH, [0, -0.025, 0.1], [1.2, 1, 0.7], [0, Math.PI / 2, Math.PI / 2]));
  for (let i = 0; i < 6; i++) head.add(mesh(new THREE.BoxGeometry(0.014, 0.018, 0.01), TEETH, [-0.04 + i * 0.016, -0.03, 0.118 - Math.abs(i - 2.5) * 0.004]));
  const jaw = new THREE.Group(); jaw.position.set(0, -0.03, 0.02); head.add(jaw);
  jaw.add(mesh(new THREE.SphereGeometry(0.085, 18, 10, 0, TAU, Math.PI / 2, Math.PI / 2), SKIN, [0, 0, 0.03], [1.05, 0.75, 1.05]));
  jaw.add(mesh(new THREE.CircleGeometry(0.07, 18), MOUTH, [0, 0.001, 0.035], [1.05, 1, 1], [-Math.PI / 2, 0, 0]));
  for (let i = 0; i < 5; i++) jaw.add(mesh(new THREE.BoxGeometry(0.014, 0.016, 0.01), TEETH, [-0.032 + i * 0.016, 0.006, 0.1 - Math.abs(i - 2) * 0.005]));
  root.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  return { root, hips, spine, belly, legs, arms, neck, head, jaw, skirt };
}

const _v = new THREE.Vector3(), _ndc = new THREE.Vector3();

export class PhiPop {
  constructor(scene, level, doors) {
    this.level = level;
    this.doors = doors;
    this.M = buildModel();
    this.group = this.M.root;
    this.position = this.group.position;
    scene.add(this.group);
    this.onCaught = () => {};
    this.onBurp = () => {};
    this.onAte = () => {};
    this.onSmash = () => {};
    this.onHunt = () => {};
    this.avoid = new Set(['bedroom']); // the guest room is the safe room (and locked before that)
    this.pass = () => true;            // he goes through any door (bashing the closed ones)
    this.reset();
  }

  reset() {
    this.state = 'off';
    this.group.visible = false;
    this.position.copy(FRONT_OUT);
    this.hunger = 30;
    this.calmT = 0;
    this.stunT = 0;
    this.route = [];
    this.stateT = 0;
    this.eatT = 0;
    this.chompT = 0;
    this.lineT = rand(8, 14);
    this.walkPhase = 0;
    this.yaw = Math.PI / 2;
    this.bashDoor = null; this.bashN = 0;
    this.huntCool = 0;
    this.lastSeen = null;
    this.stuckT = 0; this.lastPos = this.position.clone();
    this.jaw = 0;
    this.speedK = 1;
    this.moving = false;
  }

  get active() { return this.state !== 'off'; }
  get hunting() { return this.state === 'hunt' || this.state === 'bash' && this.huntBash; }
  get room() { return nearestRoom(this.level, this.position); }

  /** Walk in through the front door. */
  enter() {
    this.reset();
    this.state = 'enter';
    this.group.visible = true;
    this.route = [{ p: FRONT_IN.clone(), cross: true }];
  }

  /** "หมดเวลาคอลแลป": walk out the front door and vanish. */
  leave() {
    if (!this.active) return;
    this.state = 'leave';
    this.route = buildRoute(this.level, this.position, FRONT_IN, 'hallway', this.pass, this.avoid) || [];
    this.route.push({ p: FRONT_OUT.clone(), cross: true });
  }

  /** A snack from the player's hand. */
  feed(amount = 40) {
    this.hunger = Math.max(0, this.hunger - amount);
    if (this.state === 'hunt' || this.state === 'bash' || this.state === 'search') { this.huntCool = 25; }
    this.state = 'eat'; this.stateT = 0; this.eatT = 2.2; this.route = [];
    sfx.play('chomp');
    this.say(pick(LINES.fed));
  }

  /** Scream: frozen for a moment. */
  stun(sec = 2) {
    if (!this.active || this.state === 'jumpscare' || this.state === 'leave' || this.state === 'enter') return false;
    this.stunT = sec;
    return true;
  }

  say(text) { Talk.say('pop', text, { at: this.position, ms: 2600 }); }

  // ---------------------------------------------------------------- update
  /** ctx: { player, camera, snacks: { count, take() }, soda: bool (red soda waiting at the shrine), drinkSoda(), hidden, safe, hour } */
  update(dt, t, ctx = {}) {
    if (this.state === 'off') return;
    this.stateT += dt;
    const { player } = ctx;
    if (this.state === 'jumpscare') { this._jumpscare(dt, t, ctx); this._pose(dt, t); return; }
    if (this.huntCool > 0) this.huntCool -= dt;

    // hunger
    if (this.calmT > 0) { this.calmT -= dt; this.hunger = Math.max(8, this.hunger - dt * 2); }
    else if (this.state !== 'eat' && this.state !== 'drink') this.hunger = Math.min(100, this.hunger + dt * (ctx.hour >= 4 ? 1.1 : 0.85));

    if (this.stunT > 0) { this.stunT -= dt; this.moving = false; this._pose(dt, t); return; }

    const S = this.state;
    const free = S === 'idle' || S === 'wander' || S === 'toFood' || S === 'hunt' || S === 'search';
    // red soda waiting at the shrine beats everything
    if (ctx.soda && (free || S === 'eat') && this.state !== 'toShrine') {
      const r = buildRoute(this.level, this.position, SHRINE, 'living', this.pass, this.avoid);
      if (r) { this.state = 'toShrine'; this.route = r; this.stateT = 0; }
    }
    // hunt when starving and nothing is left
    const canHunt = player && !ctx.hidden && !ctx.safe && this.huntCool <= 0 && this.calmT <= 0;
    if (canHunt && (S === 'idle' || S === 'wander' || S === 'toFood')) {
      const near = Math.hypot(player.position.x - this.position.x, player.position.z - this.position.z) < 6 && roomsLinked(this.level, this.room, this.level.roomAt(player.position));
      if ((ctx.snacks.count <= 0 && this.hunger >= 100) || (ctx.snacks.count <= 0 && this.hunger >= 85 && near)) {
        this.state = 'hunt'; this.stateT = 0; this.say(pick(LINES.hunt)); this.onHunt();
      }
    }
    // food
    if ((S === 'idle' || S === 'wander') && this.hunger >= 50 && ctx.snacks.count > 0 && this.calmT <= 0) {
      const r = buildRoute(this.level, this.position, RACK, 'kitchen', this.pass, this.avoid);
      if (r) { this.state = 'toFood'; this.route = r; this.stateT = 0; }
    }

    switch (this.state) {
      case 'enter':
        this._walk(dt, WALK, true);
        if (!this.route.length) { this.state = 'idle'; this.stateT = 0; this.onEntered && this.onEntered(); }
        break;
      case 'leave':
        this._walk(dt, WALK * 1.2, true);
        if (!this.route.length) { this.state = 'off'; this.group.visible = false; }
        break;
      case 'idle':
        this.moving = false;
        if (this.stateT > rand(2, 4)) this._wander();
        break;
      case 'wander':
        this._walk(dt, WALK * 0.8);
        if (!this.route.length) { this.state = 'idle'; this.stateT = 0; }
        break;
      case 'toFood':
        this._walk(dt, WALK);
        if (!this.route.length) {
          if (ctx.snacks.count > 0) { this.state = 'eat'; this.stateT = 0; this.eatT = 4; this.yaw = Math.PI; }
          else { this.state = 'idle'; this.stateT = 0; }
        }
        break;
      case 'eat':
        this.moving = false;
        this.eatT -= dt;
        this._chew(dt, player, 0.24);
        if (this.eatT <= 0) {
          if (this.route.length === 0 && this.stateT > 2.3 && Math.hypot(this.position.x - RACK.x, this.position.z - RACK.z) < 0.6 && ctx.snacks.count > 0 && ctx.snacks.take()) {
            this.hunger = Math.max(0, this.hunger - 35);
            this.onAte();
          }
          if (this.hunger >= 40 && ctx.snacks.count > 0 && Math.hypot(this.position.x - RACK.x, this.position.z - RACK.z) < 0.6) { this.eatT = 4; this.stateT = 0; } else { this.state = 'idle'; this.stateT = 0; }
        }
        break;
      case 'toShrine':
        this._walk(dt, WALK * 1.15);
        if (!ctx.soda) { this.state = 'idle'; this.stateT = 0; break; }
        if (!this.route.length) { this.state = 'drink'; this.stateT = 0; sfx.play('gulp', this._pan(player)); this.say(pick(LINES.soda)); }
        break;
      case 'drink':
        this.moving = false;
        this.yaw = Math.atan2(3.5 - this.position.x, 6.45 - this.position.z);
        if (this.stateT > 2.4) {
          ctx.drinkSoda && ctx.drinkSoda();
          this.calmT = 90; this.hunger = 10; this.huntCool = 0;
          this.state = 'burp'; this.stateT = 0;
          sfx.play('burp', { ...this._pan(player), vol: 1 });
          UI.shake(200);
          this.onBurp(this.position.clone());
        }
        break;
      case 'burp':
        this.moving = false;
        if (this.stateT > 1.6) { this.state = 'idle'; this.stateT = 0; }
        break;
      case 'hunt': {
        if (!player || ctx.hidden || ctx.safe || this.calmT > 0) {
          this.state = 'search'; this.stateT = 0;
          this.route = this.lastSeen ? (buildRoute(this.level, this.position, this.lastSeen, null, this.pass, this.avoid) || []) : [];
          break;
        }
        this.lastSeen = player.position.clone();
        if (this.stateT > 0.5 || !this.route.length) { this.stateT = 0.001; this.route = buildRoute(this.level, this.position, player.position, this.level.roomAt(player.position), this.pass, this.avoid) || []; }
        this._walk(dt, HUNT * this.speedK);
        this._chew(dt, player, 0.5);
        const d = Math.hypot(player.position.x - this.position.x, player.position.z - this.position.z);
        if (d < CATCH) this._startJumpscare(player, ctx.camera);
        break;
      }
      case 'search':
        this._walk(dt, WALK);
        if (!this.route.length && this.stateT > 4) { this.state = 'idle'; this.stateT = 0; this.huntCool = 12; this.say(pick(LINES.giveUp)); }
        break;
      case 'bash':
        this.moving = false;
        if (this.stateT > 1.1) {
          this.stateT = 0;
          this.bashN++;
          this.doors.bash(this.bashDoor);
          if (player && Math.hypot(player.position.x - this.position.x, player.position.z - this.position.z) < 5) UI.shake(160);
          if (this.bashN >= 3) {
            this.doors.smash(this.bashDoor);
            this.onSmash(this.bashDoor);
            this.state = this.bashResume || 'idle'; this.bashDoor = null;
          }
        }
        break;
    }

    // hunger lines
    this.lineT -= dt;
    if (this.lineT <= 0) {
      this.lineT = rand(12, 20);
      if (player && Math.hypot(player.position.x - this.position.x, player.position.z - this.position.z) < 12 && this.hunger > 60 && this.state !== 'hunt') this.say(pick(LINES.hungry));
    }
    this._pose(dt, t);
  }

  _pan(player) { if (!player) return {}; const p = panFor(player, this.position.x, this.position.z); return { pan: p.pan, vol: p.vol }; }

  _chew(dt, player, every) {
    this.chompT -= dt;
    if (this.chompT <= 0) {
      this.chompT = every;
      if (player) { const p = panFor(player, this.position.x, this.position.z); if (p.dist < 14) sfx.play('chomp', { pan: p.pan, vol: p.vol * 0.9 }); }
    }
  }

  _wander() {
    const rooms = ['kitchen', 'kitchen', 'living', 'hallway'];
    const room = pick(rooms);
    const pts = (this.level.navPoints || []).filter((p) => this.level.roomAt(p) === room);
    const dest = pick(pts.length ? pts : [RACK]);
    const r = buildRoute(this.level, this.position, dest, room, this.pass, this.avoid);
    if (r) { this.route = r; this.state = 'wander'; this.stateT = 0; }
  }

  _walk(dt, speed, noClamp = false) {
    const pos = this.position;
    const w = this.route[0];
    if (!w) { this.moving = false; return; }
    // a closed door in the way: bash it down
    if (w.cross && w.link && w.link.door && !this.level.doorOpen(w.link.door)) {
      const L = w.link;
      if (Math.hypot(pos.x - (L.pa.x + L.pb.x) / 2, pos.z - (L.pa.z + L.pb.z) / 2) < 1.0) {
        this.bashResume = this.state; this.huntBash = this.state === 'hunt';
        this.state = 'bash'; this.stateT = 0.6; this.bashN = 0; this.bashDoor = L.door; this.moving = false;
        this.yaw = Math.atan2(w.p.x - pos.x, w.p.z - pos.z);
        return;
      }
    }
    const dx = w.p.x - pos.x, dz = w.p.z - pos.z, d = Math.hypot(dx, dz);
    const last = this.route.length === 1;
    if (d < (last ? 0.4 : 0.12)) { this.route.shift(); return; }
    const step = Math.min(d, speed * dt);
    pos.x += (dx / d) * step; pos.z += (dz / d) * step;
    const crossing = w.cross || noClamp;
    if (!crossing) {
      this.level.collide(pos, 0.3);
      const room = this.level.roomAt(pos);
      if (room) { const r = this.level.rooms[room], m = 0.32; pos.x = Math.min(r.x1 - m, Math.max(r.x0 + m, pos.x)); pos.z = Math.min(r.z1 - m, Math.max(r.z0 + m, pos.z)); }
    }
    // turn toward the way he walks
    let want = Math.atan2(dx, dz), dy = want - this.yaw;
    dy = ((dy + Math.PI) % TAU + TAU) % TAU - Math.PI;
    this.yaw += dy * Math.min(1, dt * 5);
    this.moving = true;
    this.walkPhase += step * 5.2;
    // stuck on furniture: skip ahead or detour
    this.stuckT += dt;
    if (this.stuckT > 1.5) {
      if (this.lastPos.distanceTo(pos) < 0.12 && this.route.length) {
        const end = this.route[this.route.length - 1].p;
        if (this.route.length === 1 && Math.hypot(end.x - pos.x, end.z - pos.z) < 1.4) this.route.length = 0; // furniture in the way: close enough
        else if (this.route.length > 1 && !this.route[0].cross) this.route.shift();
        else { const r = this.level.rooms[this.room]; if (r) this.route.unshift({ p: V(rand(r.x0 + 0.8, r.x1 - 0.8), 0, rand(r.z0 + 0.8, r.z1 - 0.8)), cross: false }); }
      }
      this.stuckT = 0; this.lastPos.copy(pos);
    }
  }

  // ---------------------------------------------------------------- jumpscare
  _startJumpscare(player, camera) {
    this.state = 'jumpscare'; this.stateT = 0;
    player.enabled = false;
    sfx.play('jumpscare'); sfx.play('burp', { vol: 0.6 });
    UI.flash('#9aff7a'); UI.shake(1000);
    this._js = { player, camera, fired: false };
  }
  _jumpscare(dt, t, ctx) {
    const J = this._js;
    if (!J) return;
    const pp = J.player.position;
    const f = V(-Math.sin(J.player.yaw), 0, -Math.cos(J.player.yaw));
    const k = Math.min(1, this.stateT / 0.15);
    this.position.set(pp.x + f.x * (1.1 - 0.4 * k), 0, pp.z + f.z * (1.1 - 0.4 * k));
    this.yaw = Math.atan2(pp.x - this.position.x, pp.z - this.position.z);
    this.moving = false;
    if (J.camera) {
      this.M.head.getWorldPosition(_v);
      const eye = V(pp.x, 1.6, pp.z);
      J.camera.position.set(eye.x + (Math.random() - 0.5) * 0.02, eye.y, eye.z);
      J.camera.lookAt(_v);
    }
    if (this.stateT > 1.2 && !J.fired) { J.fired = true; this.onCaught(); }
  }

  /** Is he in the camera frame (for photos / the hunger meter)? */
  inView(camera) {
    if (!this.group.visible) return false;
    this.M.head.getWorldPosition(_v);
    if (camera.position.distanceTo(_v) > 12) return false;
    _ndc.copy(_v).project(camera);
    return _ndc.z < 1 && Math.abs(_ndc.x) < 1 && Math.abs(_ndc.y) < 1;
  }
  headPos(out = V()) { return this.M.head.getWorldPosition(out); }

  // ---------------------------------------------------------------- animation
  _pose(dt, t) {
    const M = this.M;
    this.group.rotation.y = this.yaw;
    const S = this.state, ph = this.walkPhase;
    const walk = this.moving ? 1 : 0;
    this._walkW = (this._walkW || 0) + (walk - (this._walkW || 0)) * Math.min(1, dt * 6);
    const w = this._walkW;
    M.hips.position.y = 0.64 + Math.abs(Math.sin(ph)) * 0.025 * w - (S === 'bash' ? 0.02 : 0);
    M.hips.rotation.z = Math.sin(ph) * 0.06 * w;
    for (const L of M.legs) {
      const a = Math.sin(ph + (L.side > 0 ? Math.PI : 0));
      L.thigh.rotation.x = -a * 0.5 * w - 0.08;
      L.knee.rotation.x = Math.max(0, a) * 0.7 * w + 0.12;
    }
    M.skirt.rotation.z = Math.sin(ph * 0.5) * 0.04 * w;
    const breath = Math.sin(t * 1.8);
    M.belly.scale.set(1.02 + breath * 0.01 + Math.sin(ph * 2) * 0.015 * w, 0.95 + Math.abs(Math.sin(ph)) * 0.02 * w, 1.08);
    M.spine.rotation.x = 0.32 + (S === 'hunt' ? 0.1 : 0) + (S === 'drink' || S === 'burp' ? -0.3 : 0);
    // arms
    let jawOpen = 0.14 + Math.max(0, Math.sin(t * 0.9)) * 0.08; // mouth hangs open, always a little hungry
    for (const A of M.arms) {
      let sx = Math.sin(ph + (A.side > 0 ? 0 : Math.PI)) * 0.45 * w, sz = A.side * 0.12, ex = -0.25;
      if (S === 'eat' || S === 'drink') { sx = -1.5 + Math.sin(t * 9 + A.side) * 0.12; sz = A.side * -0.25; ex = -1.6; jawOpen = 0.12 + Math.abs(Math.sin(t * 9)) * 0.28; }
      else if (S === 'bash') { const k = (this.stateT % 1.1) / 1.1; sx = k < 0.6 ? -2.6 * (k / 0.6) : -2.6 + (k - 0.6) / 0.4 * 2.2; ex = -0.4; sz = A.side * 0.2; }
      else if (S === 'hunt') { sx = -1.1 + Math.sin(ph + A.side) * 0.2; ex = -0.5; jawOpen = 0.25 + Math.abs(Math.sin(t * 6)) * 0.2; }
      else if (S === 'jumpscare') { sx = -1.4; ex = -0.2; sz = A.side * 0.5; jawOpen = 0.8; }
      else if (this.stunT > 0) { sx = -2.4; ex = -2.0; sz = A.side * -0.6; jawOpen = 0.35; }
      else if (S === 'burp') { jawOpen = 0.6 * Math.max(0, 1 - this.stateT / 1.2); }
      A.sh.rotation.set(sx, 0, sz);
      A.el.rotation.x = ex;
    }
    this.jaw += (jawOpen - this.jaw) * Math.min(1, dt * 14 || 1);
    M.jaw.rotation.x = this.jaw;
    M.neck.rotation.x = -0.25 + (S === 'burp' ? -0.4 : 0) + (S === 'drink' ? -0.5 : 0);
    M.head.rotation.y = S === 'idle' ? Math.sin(t * 0.7) * 0.5 : 0;
    M.head.rotation.z = this.stunT > 0 ? Math.sin(t * 12) * 0.2 : 0;
  }
}
