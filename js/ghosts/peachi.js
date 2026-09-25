// Peachi ghost AI: mood meter → expression/behaviour, chase, stun, jumpscare.
import * as THREE from 'three';
import { buildPeachi } from '../peachi/model.js';
import { UI } from '../ui.js';
import { sfx } from '../audio.js';
import { peachiLines } from '../data/chat.js';

const pick = (arr) => (arr && arr.length ? arr[Math.floor(Math.random() * arr.length)] : null);
const rand = (a, b) => a + Math.random() * (b - a);
const TAU = Math.PI * 2;

const TELEPORT_LINES = [
  'แฮร่~ อยู่ข้างหลังนะ~',
  'คิกๆ หันมาสิม็อดใหม่~',
  'เซอร์ไพรส์! พีชชี่วาร์ปได้ด้วยนะ',
  'เดินหนีทำไมอ่า~ คิกๆ',
];
const MISS_TOASTS = [
  'ตะโกนใส่อากาศ… พีชชี่อยู่ไกลเกินไป',
  'ตะโกนใส่อากาศ… ข้างบ้านตื่นแทน',
  'ตะโกนใส่อากาศ… แชท: "ม็อดเป็นอะไรคะ"',
  'ตะโกนใส่อากาศ… ต้องเข้าใกล้กว่านี้ (7 ม.)',
];

export const STUN_RANGE = 7;
export const TOUCH_RANGE = 1.1;

export class PeachiGhost {
  constructor(scene, level) {
    this.level = level;
    this.model = buildPeachi({ ghost: true });
    this.group = this.model.group;
    this.position = this.group.position;
    scene.add(this.group);
    this.onCaught = () => {};
    this.onMoodChange = () => {};
    this.knock = new THREE.Vector3();
    this.target = null;
    this.reset();
  }

  get moodName() {
    if (this.mood < 25) return 'happy';
    if (this.mood < 50) return 'cry';
    return 'angry';
  }
  get isAngry() { return this.state !== 'stunned' && this.state !== 'jumpscare' && this.mood >= 50; }
  get isStunned() { return this.state === 'stunned'; }

  reset(spawnPos) {
    this.mood = 0;
    this.state = 'roam'; // 'roam' | 'chase' | 'stunned' | 'jumpscare'
    this.active = false;
    this.stunTimer = 0;
    this.lonely = 0;
    this.knock.set(0, 0, 0);
    this.target = null;
    this.teleportTimer = rand(14, 22);
    this.lineTimer = rand(3, 6);
    this.whisperTimer = rand(4, 8);
    this.jumpTimer = 0;
    this.caughtFired = false;
    this.distToPlayer = Infinity;
    this.lit = false;
    this.lastMood = null;
    this._expr = null;
    this._pose = null;
    this._flicker = null;
    this.group.scale.setScalar(1);
    const pos = spawnPos || pick(this.level.ghostSpawns) || new THREE.Vector3();
    this.group.position.set(pos.x, 0, pos.z);
    this.group.rotation.set(0, 0, 0);
    this._setExpression('happy');
    this._setPose('float');
    this._setFlicker(false);
  }

  say(key, ms = 2800) {
    const line = pick(peachiLines && peachiLines[key]);
    if (line) UI.subtitle(line, ms);
  }

  // ---------------------------------------------------------------- update
  update(dt, t, ctx) {
    this.model.update(dt, t);
    if (!this.active || !ctx) return;
    const { player, camera, hour = 0 } = ctx;
    const pos = this.group.position;
    const pp = player.position;
    const dx = pp.x - pos.x, dz = pp.z - pos.z;
    const dist = Math.hypot(dx, dz);
    this.distToPlayer = dist;

    if (this.state === 'jumpscare') { this._updateJumpscare(dt, player, camera); return; }

    // knockback after a scream stun (≈3 m total)
    if (this.knock.lengthSq() > 1e-4) {
      pos.addScaledVector(this.knock, dt);
      this.knock.multiplyScalar(Math.exp(-4 * dt));
    }

    // --- mood
    if (dist < 5) this.lonely = 0; else this.lonely += dt;
    if (this.state === 'stunned') {
      this.stunTimer -= dt;
      if (this.stunTimer <= 0) { this.state = 'roam'; this._setPose('float'); }
    } else {
      let rate = 1.2;
      if (hour >= 3) rate *= 1.5;
      if (this.lonely > 20) rate *= 1.6;           // nobody visits her → lonely → faster
      else if (dist < 5 && this.mood < 50) rate *= 0.6; // company calms her down
      this.mood = Math.min(100, this.mood + rate * dt);
    }

    const stunned = this.state === 'stunned';
    const mood = this.moodName;
    if (mood !== this.lastMood) {
      const prev = this.lastMood;
      this.lastMood = mood;
      if (prev !== null && !stunned) {
        if (mood === 'cry' && prev === 'happy') { sfx.play('whisper'); this.say('cry'); }
        if (mood === 'angry') this.say('angry');
        this.lineTimer = rand(8, 12);
      }
      this.onMoodChange(mood, prev);
    }
    this._setExpression(stunned ? 'cry' : mood);
    this._setFlicker(stunned || mood === 'cry');
    this.model.setGlow(stunned ? 0.15 + Math.random() * 0.35 : 0.25 + (this.mood / 100) * 0.75);

    // --- movement
    let moveX = 0, moveZ = 0;
    if (!stunned) {
      if (mood === 'angry') {
        this.state = 'chase';
        let speed = hour >= 4 ? 2.6 : 1.6;
        if (this.mood >= 80) speed *= 1.3;
        this.lit = !!player.isLightOn(new THREE.Vector3(pos.x, 1.0, pos.z));
        if (this.lit) speed *= 0.5;
        if (dist > 0.01) {
          const step = Math.min(dist, speed * dt);
          moveX = (dx / dist) * step; moveZ = (dz / dist) * step;
        }
        this._setPose(dist < 2.6 ? 'reach' : 'float');
      } else {
        this.state = 'roam';
        this.lit = false;
        [moveX, moveZ] = this._roamStep(dt);
        this._setPose('float');
        this.teleportTimer -= dt;
        if (this.teleportTimer <= 0) {
          this.teleportTimer = rand(16, 28);
          if (dist > 8 && Math.random() < 0.6) this._teleportBehind(player);
        }
      }
      pos.x += moveX; pos.z += moveZ;
    }
    pos.y = 0;

    // --- facing: always look at the player when within 10 m, else along movement
    let targetYaw = null;
    const ndx = pp.x - pos.x, ndz = pp.z - pos.z;
    if (Math.hypot(ndx, ndz) < 10) targetYaw = Math.atan2(ndx, ndz);
    else if (Math.abs(moveX) + Math.abs(moveZ) > 1e-5) targetYaw = Math.atan2(moveX, moveZ);
    if (targetYaw !== null) {
      let d = targetYaw - this.group.rotation.y;
      d = ((d + Math.PI) % TAU + TAU) % TAU - Math.PI;
      this.group.rotation.y += d * Math.min(1, dt * 6);
    }

    // --- voice lines
    this.lineTimer -= dt;
    if (this.lineTimer <= 0) {
      this.lineTimer = rand(9, 15);
      if (!stunned) this.say(mood);
    }
    if (!stunned && mood === 'cry') {
      this.whisperTimer -= dt;
      if (this.whisperTimer <= 0) { this.whisperTimer = rand(6, 10); sfx.play('whisper'); }
    }

    // --- touch → jumpscare
    if (!stunned && mood === 'angry' && Math.hypot(pp.x - pos.x, pp.z - pos.z) < TOUCH_RANGE) {
      this._startJumpscare(player, camera);
    }
  }

  _roamStep(dt) {
    const pos = this.group.position;
    const nav = this.level.navPoints || [];
    if (!nav.length) return [0, 0];
    if (!this.target || Math.hypot(this.target.x - pos.x, this.target.z - pos.z) < 0.3) {
      let next = pick(nav);
      for (let i = 0; i < 4 && next === this.target; i++) next = pick(nav);
      this.target = next;
    }
    const dx = this.target.x - pos.x, dz = this.target.z - pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 1e-4) return [0, 0];
    const step = Math.min(d, 1.0 * dt);
    return [(dx / d) * step, (dz / d) * step];
  }

  _teleportBehind(player) {
    const pp = player.position;
    const fx = -Math.sin(player.yaw || 0), fz = -Math.cos(player.yaw || 0); // camera forward
    let best = null, bestScore = Infinity;
    for (const p of this.level.navPoints || []) {
      const dx = p.x - pp.x, dz = p.z - pp.z;
      const d = Math.hypot(dx, dz);
      if (d < 3 || d > 10) continue;
      if ((dx * fx + dz * fz) / d > -0.3) continue; // must be behind the player
      const score = Math.abs(d - 6);
      if (score < bestScore) { bestScore = score; best = p; }
    }
    if (!best) return false;
    this.group.position.set(best.x, 0, best.z);
    this.target = null;
    sfx.play('giggle');
    UI.subtitle(pick(TELEPORT_LINES), 2600);
    return true;
  }

  // ---------------------------------------------------------------- events
  /** Player screamed. Returns 'stun' | 'miss' | null (ignored). */
  onScream(playerPos) {
    if (!this.active || this.state === 'jumpscare') return null;
    const pos = this.group.position;
    const dx = pos.x - playerPos.x, dz = pos.z - playerPos.z;
    const d = Math.hypot(dx, dz);
    if (d > STUN_RANGE) {
      UI.toast(pick(MISS_TOASTS));
      return 'miss';
    }
    this.state = 'stunned';
    this.stunTimer = 3;
    this.mood = Math.max(0, this.mood - 25);
    this._setPose('idle');
    this._setExpression('cry');
    this._setFlicker(true);
    let nx = dx, nz = dz;
    if (d < 1e-3) { const a = Math.random() * TAU; nx = Math.sin(a); nz = Math.cos(a); }
    else { nx /= d; nz /= d; }
    this.knock.set(nx * 12, 0, nz * 12); // v0/k = 12/4 = 3 m push
    sfx.play('stun');
    this.say('stunned');
    return 'stun';
  }

  onHeadphonesFound() {
    this.mood = Math.max(0, this.mood - 30);
    this.say('found', 3200);
  }

  // ---------------------------------------------------------------- jumpscare
  _startJumpscare(player, camera) {
    this.state = 'jumpscare';
    this.jumpTimer = 0;
    this.caughtFired = false;
    player.enabled = false;
    const pos = this.group.position, pp = player.position;
    const dx = pos.x - pp.x, dz = pos.z - pp.z;
    const d = Math.hypot(dx, dz) || 1;
    this.jsDir = new THREE.Vector2(dx / d, dz / d);
    this._setPose('jumpscare');
    this._setExpression('scream');
    this._setFlicker(true);
    this.model.setGlow(1);
    sfx.play('jumpscare');
    UI.flash('#ff2a6d');
    UI.shake(1100);
    this.say('scream', 1500);
    this._updateJumpscare(0, player, camera);
  }

  _updateJumpscare(dt, player, camera) {
    this.jumpTimer += dt;
    const pp = player.position;
    const pos = this.group.position;
    const k = Math.min(1, this.jumpTimer / 0.12); // lunge in fast
    const dist = 1.0 - 0.25 * k;
    pos.set(pp.x + this.jsDir.x * dist, 0.12 * k, pp.z + this.jsDir.y * dist);
    this.group.rotation.y = Math.atan2(pp.x - pos.x, pp.z - pos.z);

    const eye = new THREE.Vector3(pp.x, (pp.y || 0) + 1.6, pp.z);
    const face = new THREE.Vector3(pos.x, pos.y + (this.model.faceHeight || 1.22), pos.z);
    if (this.model.faceAnchor) { this.group.updateMatrixWorld(true); this.model.faceAnchor.getWorldPosition(face); }
    const fx = face.x - eye.x, fy = face.y - eye.y, fz = face.z - eye.z;
    player.yaw = Math.atan2(-fx, -fz);
    player.pitch = Math.atan2(fy, Math.hypot(fx, fz));
    if (camera) {
      const s = this.jumpTimer < 0.8 ? 0.02 : 0;
      camera.position.set(eye.x + (Math.random() - 0.5) * s, eye.y + (Math.random() - 0.5) * s, eye.z);
      camera.lookAt(face);
    }
    if (this.jumpTimer >= 1.2 && !this.caughtFired) {
      this.caughtFired = true;
      this.onCaught();
    }
  }

  // ---------------------------------------------------------------- helpers
  get expression() { return this._expr; }

  _setExpression(name) {
    if (this._expr === name) return;
    this._expr = name;
    this.model.setExpression(name);
  }
  _setPose(name) {
    if (this._pose === name) return;
    this._pose = name;
    this.model.setPose(name);
  }
  _setFlicker(on) {
    if (this._flicker === on) return;
    const was = this._flicker;
    this._flicker = on;
    this.level.setFlicker(on);
    if (on && was === false) sfx.play('flicker');
  }
}
