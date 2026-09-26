// Hiding spots: under Peachi's bed, behind the shower curtain, in the kitchen pantry. Inside, you peek
// through a crack (a little mouse look), your heart pounds, and the rules flip: stay quiet. Without a
// mic, hold Space to hold your breath (limited); with a mic, anything louder than a whisper gives you away.
import * as THREE from 'three';
import { sfx } from '../audio.js';
import { UI } from '../ui.js';
import { Scream } from '../mic.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const HIDE_SPOTS = [
  { id: 'bed', room: 'stream', label: '[E] ซ่อนใต้เตียง', use: V(-8.3, 1.0, -4.4), eye: V(-8.3, 0.2, -4.7), look: V(-7.2, 0.35, -1.5), exit: V(-8.3, 0, -3.95), slit: 'h', range: 0.75 },
  { id: 'tub', room: 'bathroom', label: '[E] ซ่อนหลังม่านอาบน้ำ', use: V(8.7, 1.0, -5.65), eye: V(8.95, 1.45, -6.5), look: V(6.8, 1.15, -1.2), exit: V(8.6, 0, -5.35), slit: 'v', range: 0.5 },
  { id: 'pantry', room: 'kitchen', label: '[E] ซ่อนในตู้กับข้าว', use: V(1.95, 1.0, 6.2), eye: V(2.62, 1.5, 6.2), look: V(-2.0, 1.2, 4.3), exit: V(1.85, 0, 6.0), slit: 'v', range: 0.5 },
];
const HOLD_MAX = 7;         // seconds of held breath
const MIC_LOUD = 0.2;       // mic level that counts as a sound

const _m = new THREE.Matrix4(), _up = new THREE.Vector3(0, 1, 0), _dir = new THREE.Vector3(), _look = new THREE.Vector3();

export class Hide {
  constructor({ player, camera }) {
    this.player = player;
    this.camera = camera;
    this.handles = [];
    this.spot = null;
    this.breath = 1;
    this.holding = false;
    this.gasp = 0;
    this.time = 0;
    this.danger = false;
    this.offYaw = 0; this.offPitch = 0;
    this.onEnter = null; this.onExit = null;
    this.blocked = false; // e.g. during cutscenes
    this.enteredAt = 0;

    window.addEventListener('keydown', (e) => {
      if (!this.spot || e.repeat) return;
      if (e.code === 'KeyE' && performance.now() - this.enteredAt > 300) { e.preventDefault(); this.exit(); } // not the press that got us in
      if (e.code === 'Space') { e.preventDefault(); this._hold(true); }
    });
    window.addEventListener('keyup', (e) => { if (e.code === 'Space' && this.spot) this._hold(false); });
    document.addEventListener('mousemove', (e) => {
      if (!this.spot || !this.player.isLocked) return;
      const s = this.player.sensitivity;
      this.offYaw = Math.max(-this.spot.range, Math.min(this.spot.range, this.offYaw - (e.movementX || 0) * s));
      this.offPitch = Math.max(-0.3, Math.min(0.3, this.offPitch - (e.movementY || 0) * s));
    });
  }

  get hidden() { return !!this.spot; }
  /** Is the player making a sound right now? */
  get noisy() {
    if (!this.spot) return true;
    if (this.gasp > 0) return true;
    if (Scream.usingMic) return (Scream.level || 0) > MIC_LOUD;
    return !this.holding;
  }

  attach() {
    this.detach();
    for (const sp of HIDE_SPOTS) {
      this.handles.push(this.player.addInteractable({
        position: sp.use, radius: 1.3, label: sp.label,
        onUse: () => this.enter(sp),
        enabled: () => !this.spot && !this.blocked,
      }));
    }
  }
  detach() { for (const h of this.handles) h.remove(); this.handles = []; }

  enter(sp) {
    if (this.spot) return;
    this.spot = sp;
    this.enteredAt = performance.now();
    this.breath = 1; this.holding = false; this.gasp = 0; this.time = 0; this.offYaw = 0; this.offPitch = 0; this.danger = false;
    this.player.enabled = false;
    sfx.play('creak', { vol: 0.35, len: 0.3 });
    UI.setPrompt(null);
    this._ui();
    if (this.onEnter) this.onEnter(sp);
  }

  exit() {
    const sp = this.spot;
    if (!sp) return;
    this.spot = null;
    this.holding = false;
    const p = this.player;
    p.position.set(sp.exit.x, 0, sp.exit.z);
    _dir.subVectors(sp.look, sp.eye);
    p.yaw = Math.atan2(-_dir.x, -_dir.z); p.pitch = 0;
    p.enabled = true;
    sfx.play('creak', { vol: 0.3, len: 0.25 });
    UI.setHide(null);
    if (this.onExit) this.onExit(sp);
  }

  reset() { if (this.spot) this.exit(); this.spot = null; UI.setHide(null); }

  _hold(on) {
    if (on === this.holding) return;
    if (on && this.breath <= 0.02) return;
    this.holding = on;
    sfx.play(on ? 'inhale' : 'exhale');
  }

  /** Call after player.update(): places the camera in the hiding spot. */
  update(dt) {
    const sp = this.spot;
    if (!sp) return;
    this.time += dt;
    if (this.gasp > 0) this.gasp -= dt;
    if (this.holding) {
      this.breath -= dt / HOLD_MAX;
      if (this.breath <= 0) { this.breath = 0; this.holding = false; this.gasp = 1.2; sfx.play('gasp'); }
    } else this.breath = Math.min(1, this.breath + dt / 4);
    // camera: base view + a small look around
    _dir.subVectors(sp.look, sp.eye).normalize();
    const yaw = Math.atan2(-_dir.x, -_dir.z) + this.offYaw, pitch = Math.asin(_dir.y) + this.offPitch;
    const cp = Math.cos(pitch);
    _look.set(-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp).add(sp.eye);
    this.camera.position.copy(sp.eye);
    _m.lookAt(sp.eye, _look, _up);
    this.camera.quaternion.setFromRotationMatrix(_m);
    this.camera.updateMatrixWorld();
    this._ui();
  }

  _ui() {
    const sp = this.spot;
    if (!sp) return;
    let hint;
    if (this.danger) hint = Scream.usingMic ? 'เธออยู่ตรงนี้… ห้ามส่งเสียง' : 'เธออยู่ตรงนี้… กด Space ค้าง กลั้นหายใจ!';
    else if (this.gasp > 0) hint = 'แฮ่ก… หายใจไม่ทัน';
    else hint = Scream.usingMic ? 'เงียบไว้ ไมค์ได้ยินหมด   ·   E ออก' : 'Space ค้าง = กลั้นหายใจ   ·   E ออก';
    UI.setHide({ slit: sp.slit, breath: this.breath, hint, danger: this.danger });
  }
}
