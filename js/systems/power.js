// Blackouts (Night 2): the house loses power, every switched light and the TV go dark. The fix is the
// breaker box on the kitchen wall: a timing QTE — a needle sweeps a dial, hit Space (or click) while it
// is inside the green zone, three times. A miss goes "ปัง!": sparks, and every ghost hears where you are.
import * as THREE from 'three';
import { UI } from '../ui.js';
import { sfx } from '../audio.js';
import { panFor } from './doors.js';

export const BREAKER = new THREE.Vector3(-8.9, 1.45, 1.15); // kitchen, north wall, facing into the room
const TAU = Math.PI * 2;

function labelTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#f2c230'; g.fillRect(0, 0, 256, 128);
  g.fillStyle = '#141014';
  for (let i = -2; i < 12; i++) { g.beginPath(); g.moveTo(i * 28, 0); g.lineTo(i * 28 + 14, 0); g.lineTo(i * 28 - 14, 22); g.lineTo(i * 28 - 28, 22); g.fill(); }
  g.font = '700 38px Kanit, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('⚡ อันตราย', 128, 64);
  g.font = '500 20px Kanit, sans-serif'; g.fillText('เบรกเกอร์ · ห้ามเปิดเล่น', 128, 104);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function buildBox() {
  const g = new THREE.Group();
  g.name = 'breakerBox';
  const metal = new THREE.MeshStandardMaterial({ color: 0x8a9096, roughness: 0.45, metalness: 0.6 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.7 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.52, 0.1), metal);
  body.position.z = 0.05;
  const inner = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.48), dark);
  inner.position.z = 0.101;
  g.add(body, inner);
  // three breaker levers + one main
  const levers = [];
  const leverMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1e, roughness: 0.5 });
  for (let i = 0; i < 3; i++) {
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.14, 0.03), new THREE.MeshStandardMaterial({ color: 0xe8e4dc, roughness: 0.6 }));
    base.position.set(-0.12 + i * 0.12, 0.04, 0.115);
    const pivot = new THREE.Group(); pivot.position.set(-0.12 + i * 0.12, 0.04, 0.13);
    const lever = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.06, 0.03), leverMat);
    lever.position.y = 0.03;
    pivot.add(lever);
    g.add(base, pivot);
    levers.push(pivot);
  }
  const led = new THREE.Mesh(new THREE.CircleGeometry(0.012, 12), new THREE.MeshBasicMaterial({ color: 0x40ff70, toneMapped: false }));
  led.position.set(0.15, -0.18, 0.103);
  g.add(led);
  // the door (hinged on the left), with the warning label
  const hinge = new THREE.Group(); hinge.position.set(-0.21, 0, 0.105);
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.52, 0.012), metal);
  door.position.set(0.21, 0, 0.006);
  const label = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.13), new THREE.MeshStandardMaterial({ map: labelTexture(), roughness: 0.8 }));
  label.position.set(0.21, 0.12, 0.013);
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.08, 0.02), dark);
  handle.position.set(0.38, -0.02, 0.02);
  hinge.add(door, label, handle);
  g.add(hinge);
  g.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return { group: g, levers, led, hinge };
}

export class Power {
  constructor({ scene, level, player }) {
    this.level = level;
    this.player = player;
    const b = buildBox();
    this.box = b;
    b.group.position.copy(BREAKER);
    scene.add(b.group);
    // spark light for the "ปัง!" (always in the scene so adding it never recompiles shaders)
    this.spark = new THREE.PointLight(0xa8d0ff, 0, 5, 2);
    this.spark.position.set(BREAKER.x, BREAKER.y, BREAKER.z + 0.35);
    scene.add(this.spark);
    this.onBang = () => {};   // (position) ghosts come to look
    this.onFixed = () => {};  // power is back
    this.onCut = () => {};    // power just went out
    this.handle = null;
    this.q = null;            // the open QTE
    this.cool = 0;
    this.sparkT = 0;
    this.doorOpen = 0;
    this.fixes = 0;
    this._dom();
    window.addEventListener('keydown', (e) => {
      if (!this.q) return;
      if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) this._hit(); }
      else if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) && !e.repeat) this.close();
    });
    window.addEventListener('mousedown', (e) => { if (this.q && e.button === 0) this._hit(); });
    this.reset();
  }

  get on() { return this.level.power; }
  /** The QTE is up (the director mutes Space-screams). */
  get busy() { return !!this.q; }

  reset() {
    this.close(true);
    this.level.setPower(true);
    this.cool = 0; this.sparkT = 0; this.spark.intensity = 0;
    this.hits = 3; this.speedK = 1;
    this.fixes = 0;
    this._levers(true);
  }

  /** Add the "fix the breaker" interactable (night.interact removes it when the night ends). */
  attach(night) {
    this.handle = night.interact({
      position: new THREE.Vector3(BREAKER.x, 1.3, BREAKER.z + 0.25), radius: 1.5,
      label: '[E] ซ่อมเบรกเกอร์',
      onUse: () => this.open(),
      enabled: () => !this.on && !this.q && this.cool <= 0,
    });
  }

  /** Cut the power. hits: how many good presses the fix needs; speed: needle speed multiplier. */
  blackout({ hits = 3, speed = 1 } = {}) {
    if (!this.on) return false;
    this.hits = hits; this.speedK = speed;
    this.level.setPower(false);
    this._levers(false);
    sfx.play('powerDown');
    this.onCut();
    return true;
  }

  restore() {
    this.close(true);
    if (this.level.setPower(true)) { sfx.play('powerUp'); this.fixes++; }
    this._levers(true);
    this.onFixed();
  }

  open() {
    if (this.on || this.q) return;
    this.q = { done: 0, a: Math.random() * 360, zone: 0, width: 0, t: 0 };
    this._newZone();
    this.player.enabled = false;
    sfx.play('creak', { len: 0.4, vol: 0.5 });
    this.el.classList.add('on');
    this._draw();
  }

  close(silent) {
    if (!this.q) return;
    this.q = null;
    this.el.classList.remove('on', 'hit', 'miss');
    if (!silent) this.player.enabled = true;
  }

  _newZone() {
    const q = this.q;
    const k = q.done / Math.max(1, this.hits);
    q.width = 64 - 26 * k;                  // the zone shrinks
    q.speed = (190 + 120 * k) * this.speedK; // the needle speeds up
    q.zone = (q.a + 120 + Math.random() * 180) % 360; // never right under the needle
    q.dir = Math.random() < 0.5 ? 1 : -1;
  }

  _hit() {
    const q = this.q;
    if (!q) return;
    let d = Math.abs(((q.a - q.zone) % 360 + 540) % 360 - 180);
    if (d <= q.width / 2) {
      q.done++;
      sfx.play('switch');
      const lv = this.box.levers[Math.min(2, Math.floor((q.done - 1) * 3 / this.hits))];
      if (lv) lv.rotation.x = -0.5;
      this._pulse('hit');
      if (q.done >= this.hits) { this.close(); this.restore(); UI.toast('ไฟมาแล้ว!'); return; }
      this._newZone();
    } else {
      this._bang();
    }
    this._draw();
  }

  _bang() {
    this._pulse('miss');
    sfx.play('bang');
    UI.flash('#bcd8ff');
    UI.shake(350);
    this.sparkT = 0.5;
    this.close();
    this._levers(false);
    this.cool = 1.2;
    UI.toast('ปัง! ไฟช็อต… ผีได้ยินแน่ๆ');
    this.onBang(BREAKER.clone());
  }

  _pulse(cls) {
    this.el.classList.remove('hit', 'miss'); void this.el.offsetWidth; this.el.classList.add(cls);
  }

  _levers(on) { for (const l of this.box.levers) l.rotation.x = on ? -0.5 : 0.5; }

  update(dt, t) {
    if (this.cool > 0) this.cool -= dt;
    // the door swings open while you work on it; the LED blinks red in a blackout
    const want = this.q ? 1 : 0;
    this.doorOpen += (want - this.doorOpen) * Math.min(1, dt * 8);
    this.box.hinge.rotation.y = -this.doorOpen * 1.9;
    this.box.led.material.color.setHex(this.on ? 0x40ff70 : (Math.sin(t * 8) > 0 ? 0xff3040 : 0x300808));
    if (this.sparkT > 0) { this.sparkT -= dt; this.spark.intensity = this.sparkT > 0 ? 6 * Math.random() * (this.sparkT / 0.5) : 0; }
    const q = this.q;
    if (!q) return;
    q.t += dt;
    q.a = (q.a + q.dir * q.speed * dt + 360) % 360;
    this._draw();
  }

  /** Stereo pan of the box for the player (sounds from the kitchen). */
  pan() { return panFor(this.player, BREAKER.x, BREAKER.z); }

  // ---------------------------------------------------------------- the QTE dial (DOM)
  _dom() {
    const el = document.createElement('div');
    el.className = 'qte';
    el.innerHTML = `<div class="qte-card">
      <div class="qte-title">ซ่อมเบรกเกอร์</div>
      <svg class="qte-dial" viewBox="-110 -110 220 220" aria-hidden="true">
        <circle r="92" class="qte-ring"/>
        <path class="qte-zone"/>
        <g class="qte-ticks"></g>
        <line class="qte-needle" x1="0" y1="0" x2="0" y2="-84"/>
        <circle r="7" class="qte-hub"/>
      </svg>
      <div class="qte-pips"></div>
      <div class="qte-hint"><kbd>Space</kbd> / คลิก ตอนเข็มอยู่ในช่องเขียว &nbsp;·&nbsp; <kbd>WASD</kbd> ถอย</div>
    </div>`;
    const ticks = el.querySelector('.qte-ticks');
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * TAU, r0 = i % 3 ? 86 : 80;
      const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      l.setAttribute('x1', (Math.sin(a) * r0).toFixed(1)); l.setAttribute('y1', (-Math.cos(a) * r0).toFixed(1));
      l.setAttribute('x2', (Math.sin(a) * 92).toFixed(1)); l.setAttribute('y2', (-Math.cos(a) * 92).toFixed(1));
      ticks.appendChild(l);
    }
    this.el = el;
    this.zoneEl = el.querySelector('.qte-zone');
    this.needleEl = el.querySelector('.qte-needle');
    this.pipsEl = el.querySelector('.qte-pips');
    UI.mount(el);
  }

  _draw() {
    const q = this.q;
    if (!q) return;
    const arc = (a0, a1, r) => {
      const p = (a) => `${(Math.sin(a * Math.PI / 180) * r).toFixed(2)} ${(-Math.cos(a * Math.PI / 180) * r).toFixed(2)}`;
      return `M ${p(a0)} A ${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${p(a1)}`;
    };
    const key = `${q.zone.toFixed(1)}|${q.width}`;
    if (this.zoneEl._k !== key) { this.zoneEl._k = key; this.zoneEl.setAttribute('d', arc(q.zone - q.width / 2, q.zone + q.width / 2, 92)); }
    this.needleEl.setAttribute('transform', `rotate(${q.a.toFixed(1)})`);
    const pips = `${q.done}/${this.hits}`;
    if (this.pipsEl._k !== pips) {
      this.pipsEl._k = pips;
      this.pipsEl.replaceChildren(...Array.from({ length: this.hits }, (_, i) => { const s = document.createElement('span'); if (i < q.done) s.className = 'on'; return s; }));
    }
  }
}
