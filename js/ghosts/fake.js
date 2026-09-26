// The fake (ตัวปลอม, "ตัวดำ") — Night 3, from 02:30: a copy PeachiBot made of Peachi. Same face, same voice…
// almost: her voice runs backward, her face drops to black for a frame now and then, and in a mirror or
// a photo she is a black shadow (that's the silhouette from the title screen). She acts friendly, keeps a
// few meters away and asks you to come somewhere ("มาห้องน้ำหน่อย~ ไม่มีอะไรหรอก~") — usually where Phi Pop
// is. Walk up to her and she lunges. Ignore her too long and she comes for you. A scream (or a photo)
// bursts her into smoke for a while.
import * as THREE from 'three';
import { buildPeachi } from '../peachi/model.js';
import { sfx } from '../audio.js';
import { UI } from '../ui.js';
import { Talk } from '../game/talk.js';
import { panFor } from '../systems/doors.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];

const ROOM_TH = { stream: 'ห้องสตรีม', bathroom: 'ห้องน้ำ', kitchen: 'ครัว', living: 'ห้องนั่งเล่น', hallway: 'โถงทางเดิน' };
const LINES = {
  hello: ['มอดขาาา~ อยู่นี่เอง', 'หาตั้งนาน มอดขาาา~', 'ฮัลโหลลล มอดได้ยินพีชชี่มั้ยคะ~'],
  lure: (room) => [`มอดขาาา มา${ROOM_TH[room]}หน่อย~ ไม่มีอะไรหรอก~`, `ตามมาที่${ROOM_TH[room]}สิ พีชชี่มีอะไรจะให้ดู~`, `ไป${ROOM_TH[room]}กัน~ รับรองไม่มีผีปอบ~`],
  come: ['มาใกล้ๆ หน่อยสิ~', 'ทำไมยืนไกลจัง มาหาพีชชี่สิ~', 'กอดหน่อยได้มั้ย~'],
  odd: ['วันนี้วันอะไรนะ… วันจันทร์ใช่มั้ย~', 'หูฟังพีชชี่… สีเขียวใช่มั้ยนะ~', 'พีชชี่ชอบผักบุ้งที่สุดเลย~', 'ไลฟ์นี้… ไม่ต้องจบก็ได้นะ~'],
  angry: ['ทำไมไม่มาาา', 'มอดไม่รักพีชชี่แล้วเหรอ', 'มาาาาาาา'],
};

export class FakePeachi {
  constructor(scene, level) {
    this.scene = scene;
    this.level = level;
    this.model = null; // built the first time Night 3 needs her
    this.onCaught = () => {};
    this.onGone = () => {};   // (why: 'scream' | 'photo')
    this.onLure = () => {};   // (room)
    this.state = 'off';
    this.position = V();
  }

  _ensure() {
    if (this.model) return;
    this.model = buildPeachi({ ghost: true });
    this.group = this.model.group;
    this.group.name = 'fakePeachi';
    this.position = this.group.position;
    this.model.setHeadphones(true);
    this.model.setGlowColor(0xb56cff); // a shade too purple
    this.model.setExpression('happy');
    this.model.setPose('float');
    this.group.visible = false;
    this.scene.add(this.group);
  }

  reset() {
    if (this.model) { this.group.visible = false; this.model.setDark(0); this.model.setGlow(0.25); this.model.setExpression('happy'); this.model.setPose('float'); }
    this.state = 'off';
    this.stateT = 0;
    this.lineT = 3;
    this.glitchT = rand(2, 5);
    this.darkT = 0;
    this.forceDark = 0;
    this.ignoreT = 0;
    this.lure = null;
    this.cool = 0;
    this.target = V();
  }

  get active() { return this.state !== 'off' && this.state !== 'smoke' && this.state !== 'wait'; }
  get visible() { return !!this.model && this.group.visible; }

  /** Start haunting: appear somewhere out of sight in a while. */
  begin() { this._ensure(); this.reset(); this.state = 'wait'; this.cool = 2; }
  stop() { this.reset(); }

  /** Paint her black for one render (mirrors, photos). */
  withDark(fn) {
    if (!this.visible) return fn();
    const d = this.model.dark;
    this.model.setDark(1);
    try { return fn(); } finally { this.model.setDark(d); }
  }
  /** Stay black for a few frames (the photo flash). */
  flashDark(sec = 0.15) { this.forceDark = sec; }

  /** Screamed at / caught on camera: smoke, gone for a while. */
  burst(why = 'scream', player) {
    if (!this.active || this.state === 'lunge') return false;
    this.state = 'smoke'; this.stateT = 0; this.cool = rand(22, 32);
    this.group.visible = false;
    const p = player ? panFor(player, this.position.x, this.position.z) : { pan: 0 };
    sfx.play('smoke', { pan: p.pan });
    this.onGone(why);
    return true;
  }

  // ---------------------------------------------------------------- update
  /** ctx: { player, camera, peachi, popRoom, safe, hidden } */
  update(dt, t, ctx = {}) {
    if (!this.model || this.state === 'off') return;
    const { player, camera } = ctx;
    this.stateT += dt;
    if (this.state === 'lunge') { this._lunge(dt, ctx); this.model.update(dt, t); return; }
    if (this.state === 'smoke' || this.state === 'wait') {
      this.cool -= dt;
      if (this.cool <= 0 && player && !ctx.safe && !ctx.hidden) this._appear(ctx);
      return;
    }
    if (ctx.safe) { this.group.visible = false; this.state = 'wait'; this.cool = 6; return; } // she can't come in there

    const pos = this.position, pp = player.position;
    const dx = pp.x - pos.x, dz = pp.z - pos.z, dist = Math.hypot(dx, dz);
    // tells: a black face for a frame now and then
    this.glitchT -= dt;
    if (this.glitchT <= 0) { this.glitchT = rand(2.5, 6); this.darkT = 0.08 + Math.random() * 0.06; }
    if (this.darkT > 0) this.darkT -= dt;
    if (this.forceDark > 0) this.forceDark -= dt;
    this.model.setDark(this.darkT > 0 || this.forceDark > 0 ? 1 : 0);

    // where she wants to be
    let speed = 1.3, want = null;
    if (this.state === 'mimic') {
      // keep ~3.5 m from you, slowly drifting
      const k = dist > 0.01 ? (dist - 3.5) / dist : 0;
      want = V(pos.x + dx * k, 0, pos.z + dz * k);
      this.ignoreT += dt;
      if (this.stateT > rand(10, 14)) this._startLure(ctx);
    } else if (this.state === 'lure') {
      want = this.lure.at;
      speed = 1.6;
      this.ignoreT += dt;
      // you came too close: gotcha
      if (dist < 1.4) this._startLunge(player, camera);
      else if (this.ignoreT > 24) { this.state = 'hunt'; this.stateT = 0; Talk.say('fake', pick(LINES.angry), { at: pos, ms: 2000 }); sfx.play('glitch', { n: 6 }); }
      else if (this.stateT > 16) { this.state = 'mimic'; this.stateT = 0; }
    } else if (this.state === 'hunt') {
      want = pp; speed = 2.0;
      if (dist < 1.1) this._startLunge(player, camera);
      if (this.stateT > 15) { this.state = 'mimic'; this.stateT = 0; this.ignoreT = 0; }
      this.model.setExpression('angry');
    }
    if (this.state === 'mimic' && dist < 1.25) this._startLunge(player, camera); // she lets you come to her
    if (this.state === 'lunge') { this.model.update(dt, t); return; }
    if (want) {
      const wx = want.x - pos.x, wz = want.z - pos.z, wd = Math.hypot(wx, wz);
      if (wd > 0.05) { const s = Math.min(wd, speed * dt); pos.x += (wx / wd) * s; pos.z += (wz / wd) * s; }
    }
    pos.y = 0;
    // face you, like she does
    let yaw = Math.atan2(dx, dz), dy = yaw - this.group.rotation.y;
    dy = ((dy + Math.PI) % TAU + TAU) % TAU - Math.PI;
    this.group.rotation.y += dy * Math.min(1, dt * 5);
    this.model.lookAt(camera.position);
    this.model.setPose(this.state === 'hunt' ? 'reach' : 'float');
    this.model.setGlow(0.3 + 0.15 * Math.sin(t * 2.3));
    // chatter
    this.lineT -= dt;
    if (this.lineT <= 0) {
      this.lineT = rand(7, 11);
      if (dist < 12 && this.state !== 'lure') Talk.say('fake', pick(Math.random() < 0.5 ? LINES.come : LINES.odd), { at: pos, ms: 2600 });
    }
    this.model.update(dt, t);
  }

  _appear(ctx) {
    const { player, camera } = ctx;
    const fwd = V(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
    // somewhere 4–9 m away, not in front of you, not where the real Peachi is
    const pts = (this.level.navPoints || []).filter((p) => {
      const d = p.distanceTo(player.position);
      if (d < 4 || d > 10) return false;
      const to = V(p.x - player.position.x, 0, p.z - player.position.z).normalize();
      if (to.dot(fwd) > 0.2) return false;
      return !ctx.peachi || p.distanceTo(ctx.peachi.position) > 3;
    });
    const at = pick(pts);
    if (!at) { this.cool = 2; return; }
    this.position.set(at.x, 0, at.z);
    this.group.visible = true;
    this.model.setExpression('happy');
    this.state = 'mimic'; this.stateT = 0; this.ignoreT = 0;
    // the real Peachi keeps out of the way, so you rarely see both
    if (ctx.peachi && ctx.peachi.active && ctx.peachi.distToPlayer < 9 && !ctx.peachi.isAngry) {
      const far = (this.level.navPoints || []).filter((p) => p.distanceTo(player.position) > 10);
      const f = pick(far); if (f) ctx.peachi.group.position.set(f.x, 0, f.z);
    }
    Talk.say('fake', pick(LINES.hello), { at: this.position, ms: 2400 });
  }

  _startLure(ctx) {
    const room = ctx.popRoom && ctx.popRoom !== 'bedroom' && ctx.popRoom !== this.level.roomAt(ctx.player.position) ? ctx.popRoom : pick(['bathroom', 'kitchen', 'living', 'stream'].filter((r) => r !== this.level.roomAt(ctx.player.position)));
    const pts = (this.level.navPoints || []).filter((p) => this.level.roomAt(p) === room);
    const at = (pick(pts) || V(0, 0, 0)).clone();
    this.lure = { room, at };
    this.state = 'lure'; this.stateT = 0;
    Talk.say('fake', pick(LINES.lure(room)), { at: this.position, ms: 3200 });
    this.onLure(room);
  }

  _startLunge(player, camera) {
    this.state = 'lunge'; this.stateT = 0;
    player.enabled = false;
    this.model.setDark(1);
    this.model.setPose('jumpscare');
    this.model.setExpression('scream');
    sfx.play('jumpscare'); sfx.play('glitch', { n: 12 });
    UI.flash('#000000'); UI.shake(1100);
    this._js = { player, camera, fired: false, dir: V(this.position.x - player.position.x, 0, this.position.z - player.position.z).normalize() };
  }
  _lunge(dt, ctx) {
    const J = this._js, pp = J.player.position;
    const k = Math.min(1, this.stateT / 0.12);
    this.position.set(pp.x + J.dir.x * (1.0 - 0.25 * k), 0.1 * k, pp.z + J.dir.z * (1.0 - 0.25 * k));
    this.group.rotation.y = Math.atan2(pp.x - this.position.x, pp.z - this.position.z);
    this.model.setDark(Math.random() < 0.85 ? 1 : 0.3);
    const face = V();
    this.group.updateMatrixWorld(true);
    this.model.faceAnchor.getWorldPosition(face);
    const eye = V(pp.x, 1.6, pp.z);
    J.player.yaw = Math.atan2(-(face.x - eye.x), -(face.z - eye.z));
    if (J.camera) { J.camera.position.set(eye.x + (Math.random() - 0.5) * 0.02, eye.y, eye.z); J.camera.lookAt(face); }
    if (this.stateT > 1.2 && !J.fired) { J.fired = true; this.onCaught(); }
  }

  /** In the camera frame (photos)? */
  inView(camera) {
    if (!this.visible || this.state === 'smoke') return false;
    const p = V(this.position.x, 1.2, this.position.z);
    if (camera.position.distanceTo(p) > 12) return false;
    p.project(camera);
    return p.z < 1 && Math.abs(p.x) < 1 && Math.abs(p.y) < 1;
  }
}
