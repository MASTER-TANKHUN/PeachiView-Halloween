// Scripted scenes: an async script drives the camera (eased moves, look-at), subtitles and waits,
// while the player is frozen. Enter skips a skippable scene: every wait resolves at once and every
// camera move jumps to its end, so the script still ends in the right state.
import * as THREE from 'three';
import { UI } from '../ui.js';
import { Talk } from './talk.js';

const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _up = new THREE.Vector3(0, 1, 0);

export class Cutscene {
  constructor({ camera, player }) {
    this.camera = camera;
    this.player = player;
    this.active = false;
    this.skipping = false;
    this.skippable = false;
    this.waits = [];
    this.move = null;
    this.eye = new THREE.Vector3();
    this.look = new THREE.Vector3();
    this.shake = 0;
    window.addEventListener('keydown', (e) => {
      if (!this.active || !this.skippable || this.skipping) return;
      if (e.code === 'Enter' || e.code === 'NumpadEnter') { e.preventDefault(); this.skip(); }
    });
  }

  /** Run an async scene: fn(cut) → Promise. Resolves when it ends. */
  async run(fn, { skippable = false, bars = true } = {}) {
    this.active = true; this.skipping = false; this.skippable = skippable;
    this.player.enabled = false;
    this.eye.copy(this.camera.position);
    this.camera.getWorldDirection(this.look).multiplyScalar(2).add(this.eye);
    UI.setHudMode('cine');
    UI.letterbox(bars);
    UI.skipHint(skippable);
    UI.setPrompt(null);
    try { await fn(this); } finally {
      this.active = false; this.skipping = false;
      this.move = null; this.waits.forEach((w) => w.resolve()); this.waits = [];
      UI.letterbox(false); UI.skipHint(false); UI.setHudMode('full');
    }
  }

  skip() {
    this.skipping = true;
    Talk.stop();
    this.waits.forEach((w) => w.resolve()); this.waits = [];
    if (this.move) { this.move.t = this.move.dur; }
  }

  wait(sec) {
    if (this.skipping || sec <= 0) return Promise.resolve();
    return new Promise((resolve) => this.waits.push({ left: sec, resolve }));
  }

  /** Fade to black (1) or back (0); instant while skipping. */
  fade(v, ms = 600) { return UI.fade(v, this.skipping ? 0 : ms); }

  /** Line + wait for it (unless skipping). */
  async say(who, text, opts = {}) {
    if (this.skipping) return;
    const ms = Talk.say(who, text, opts);
    await this.wait((opts.hold ?? ms) / 1000);
  }

  /** Put the camera at eye, looking at look (Vector3 or [x,y,z]). */
  set(eye, look) {
    this.eye.copy(toV(eye)); this.look.copy(toV(look));
    this.move = null;
    this._apply();
  }

  /** Ease the camera to eye/look over sec. */
  to(eye, look, sec = 1.5) {
    const m = { e0: this.eye.clone(), l0: this.look.clone(), e1: toV(eye).clone(), l1: toV(look).clone(), t: 0, dur: Math.max(0.01, sec) };
    this.move = m;
    if (this.skipping) m.t = m.dur;
    return new Promise((resolve) => { m.resolve = resolve; if (this.skipping) { this.update(0); } });
  }

  update(dt) {
    if (!this.active) return;
    for (const w of this.waits.slice()) { w.left -= dt; if (w.left <= 0) { this.waits.splice(this.waits.indexOf(w), 1); w.resolve(); } }
    const m = this.move;
    if (m) {
      m.t = Math.min(m.dur, m.t + dt);
      const k = ease(m.t / m.dur);
      this.eye.lerpVectors(m.e0, m.e1, k);
      this.look.lerpVectors(m.l0, m.l1, k);
      if (m.t >= m.dur) { this.move = null; m.resolve && m.resolve(); }
    }
    this._apply();
  }

  _apply() {
    const c = this.camera;
    c.position.copy(this.eye);
    if (this.shake > 0) c.position.add(new THREE.Vector3((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake, 0));
    _m.lookAt(this.eye, this.look, _up);
    _q.setFromRotationMatrix(_m);
    c.quaternion.copy(_q);
    c.updateMatrixWorld();
  }

  /** Hand control back: the player stands where the camera is, looking the same way. */
  handBack({ keepPosition = false } = {}) {
    const p = this.player;
    const d = new THREE.Vector3().subVectors(this.look, this.eye).normalize();
    p.yaw = Math.atan2(-d.x, -d.z);
    p.pitch = Math.max(-1.2, Math.min(1.2, Math.asin(d.y)));
    if (!keepPosition) { p.position.x = this.eye.x; p.position.z = this.eye.z; }
    p.camera.rotation.set(p.pitch, p.yaw, 0, 'YXZ');
    p.enabled = true;
  }

  /** Current player view as eye/look pair. */
  playerView(dist = 3) {
    const p = this.player;
    const eye = new THREE.Vector3(p.position.x, 1.6, p.position.z);
    const cp = Math.cos(p.pitch);
    const look = new THREE.Vector3(-Math.sin(p.yaw) * cp, Math.sin(p.pitch), -Math.cos(p.yaw) * cp).multiplyScalar(dist).add(eye);
    return { eye, look };
  }
}

function toV(v) { return Array.isArray(v) ? new THREE.Vector3(v[0], v[1], v[2]) : v; }
