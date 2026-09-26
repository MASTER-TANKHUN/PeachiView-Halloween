// "ไฟเขียวไฟแดง" (red light, green light) — Night 3, 01:00. Peachi stands at the east end of the 20 m hall
// facing the wall and counts "หนึ่ง… สอง… สาม…"; then "ไฟแดง!" and she turns around. Move while she's
// looking and you're sent back to the front door (she gets grumpier). Reach her and she tells you where
// the first choker piece is. Three strikes and she sulks off.
import * as THREE from 'three';
import { UI } from '../ui.js';
import { sfx } from '../audio.js';
import { Talk } from '../game/talk.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const rand = (a, b) => a + Math.random() * (b - a);
export const RL_START = V(-8.9, 0, 0), RL_PEACHI = V(9.25, 0, 0);
const COUNT = ['หนึ่ง…', 'สอง…', 'สาม…'];

export class RedLight {
  constructor({ player, peachi, level }) {
    this.player = player;
    this.peachi = peachi;
    this.level = level;
    this.phase = null;
    this._dom();
  }

  get active() { return !!this.phase; }

  /** Begin: Peachi goes to the end of the hall; you go to the front door. */
  start() {
    const P = this.peachi;
    this.phase = 'setup'; this.t = 0; this.strikes = 0; this.round = 0;
    P.active = false; P.freeze();
    P.group.visible = true;
    P.group.position.copy(RL_PEACHI);
    this._face('wall');
    P._setPose('idle'); P._setExpression('happy');
    Talk.say('peachi', 'มาเล่นไฟเขียวไฟแดงกัน! ไปยืนที่ประตูหน้าบ้านนะ พีชชี่รออยู่สุดโถง~', { at: P.position, ms: 4200 });
    UI.setObjective('ไฟเขียวไฟแดง: ไปยืนที่ประตูหน้าบ้าน');
    this._ui('setup', 'ไปที่ประตูหน้าบ้าน');
  }

  stop() {
    if (!this.phase) return;
    this.phase = null;
    this.peachi.lookOverride = null;
    this.peachi.active = true;
    this._ui(null);
  }

  _face(where) {
    const P = this.peachi;
    if (where === 'wall') { P.group.rotation.y = Math.PI / 2; P.lookOverride = V(12, 1.4, 0); }
    else { P.group.rotation.y = -Math.PI / 2; P.lookOverride = null; }
  }

  /** Returns 'win' | 'fail' | 'skip' once, else null. */
  update(dt) {
    if (!this.phase) return null;
    const pl = this.player, p = pl.position;
    const inHall = this.level.roomAt(p) === 'hallway';
    this.t += dt;
    switch (this.phase) {
      case 'setup':
        if (inHall && p.x < -8.0) { this.phase = 'green'; this.t = 0; this._green(); }
        else if (this.t > 50) { this.stop(); return 'skip'; }
        break;
      case 'green': {
        const n = Math.min(COUNT.length - 1, Math.floor(this.t / this.beat));
        if (n !== this.said) { this.said = n; Talk.say('peachi', COUNT[n], { at: this.peachi.position, ms: 900 }); }
        if (this.t >= this.len) { this.phase = 'turn'; this.t = 0; Talk.say('peachi', 'ไฟแดง!', { at: this.peachi.position, ms: 1000 }); sfx.play('redLight'); this._ui('red', 'ไฟแดง — หยุด!'); }
        break;
      }
      case 'turn':
        if (this.t > 0.28) { this.phase = 'red'; this.t = 0; this._face('you'); this.hold = p.clone(); this.redLen = rand(2.0, 3.2); }
        break;
      case 'red': {
        const moved = Math.hypot(p.x - this.hold.x, p.z - this.hold.z);
        if (this.t > 0.22 && moved > 0.09) { this._caught(); if (this._result) { const r = this._result; this._result = null; return r; } break; }
        if (this.t < 0.22) this.hold.copy(p); // a moment to stop
        if (this.t >= this.redLen) { this.phase = 'green'; this.t = 0; this._face('wall'); this._green(); }
        break;
      }
      case 'back':
        if (this.t > 0.45 && !this.moved) { this.moved = true; pl.position.copy(RL_START); pl.yaw = -Math.PI / 2; pl.pitch = 0; UI.fade(0, 300); }
        if (this.t > 1.1) { this.phase = 'green'; this.t = 0; this._face('wall'); this._green(); }
        break;
    }
    // made it
    if ((this.phase === 'green' || this.phase === 'red' || this.phase === 'turn') && Math.hypot(p.x - RL_PEACHI.x, p.z - RL_PEACHI.z) < 1.8) {
      this.stop();
      this._face('you');
      this.peachi._setExpression('happy');
      sfx.play('found');
      return 'win';
    }
    return null;
  }

  _green() {
    this.round++;
    this.len = Math.max(1.6, rand(2.4, 3.6) - this.round * 0.15);
    this.beat = this.len / 3;
    this.said = -1;
    sfx.play('greenLight');
    this._ui('green', 'ไฟเขียว — เดิน!');
  }

  _caught() {
    this.strikes++;
    sfx.play('caught');
    this.peachi._setExpression('angry');
    this.peachi.mood = Math.min(100, this.peachi.mood + 20);
    if (this.strikes >= 3) {
      Talk.say('peachi', 'ขยับอีกแล้ว! ไม่เล่นด้วยแล้ว หึ', { at: this.peachi.position, ms: 2600 });
      this.stop();
      this._result = 'fail';
      return;
    }
    Talk.say('peachi', `ขยับแล้ว! กลับไปเริ่มใหม่~ (เหลือ ${3 - this.strikes} ครั้ง)`, { at: this.peachi.position, ms: 2400 });
    this.phase = 'back'; this.t = 0; this.moved = false;
    UI.fade(1, 300);
    this._ui('red', `โดนจับ! เหลือ ${3 - this.strikes} ครั้ง`);
  }

  _dom() {
    const el = document.createElement('div');
    el.className = 'rlgl';
    el.innerHTML = '<span class="rl-lamp g"></span><span class="rl-lamp r"></span><span class="rl-text"></span>';
    this.el = el; this.textEl = el.querySelector('.rl-text');
    UI.mount(el);
  }
  _ui(state, text) {
    if (!state) { this.el.className = 'rlgl'; return; }
    this.el.className = `rlgl on ${state}`;
    this.textEl.textContent = text || '';
  }
}
