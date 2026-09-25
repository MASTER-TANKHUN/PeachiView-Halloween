// First-person player: pointer-lock mouse look, WASD + Shift run with head bob, collision via level.collide,
// camera-mounted flashlight with battery, E-key interactables.
import * as THREE from 'three';

const EYE = 1.6, WALK = 2.2, RUN = 3.8, RADIUS = 0.3;
const DRAIN = 100 / 240;           // battery % per second while on (100 per 4 min)
const BEAM_RANGE = 12;
const FL_INTENSITY = 22;
const STEP_WALK = 0.75, STEP_RUN = 1.0; // meters per footstep
const MOVE_KEYS = {
  KeyW: 'f', ArrowUp: 'f', KeyS: 'b', ArrowDown: 'b', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r',
  ShiftLeft: 'run', ShiftRight: 'run',
};

const _v = new THREE.Vector3(), _eye = new THREE.Vector3(), _fwd = new THREE.Vector3();

export class Player {
  constructor(camera, domElement, level) {
    this.camera = camera;
    this.domElement = domElement;
    this.level = level;
    this.position = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    if (level && level.spawn) { this.position.copy(level.spawn.position); this.yaw = level.spawn.yaw || 0; }
    this.velocity = new THREE.Vector3();
    this.isLocked = false;
    this.moving = false;
    this.running = false;
    this.sensitivity = 0.0022;

    this.onPrompt = () => {};
    this.onFlashlightToggle = () => {};
    this.onStep = () => {};

    this._enabled = true;
    this._input = { f: false, b: false, l: false, r: false, run: false };
    this._interactables = new Set();
    this._prompt = null;
    this._bobPhase = 0;
    this._bobW = 0;
    this._flOn = false;
    this._flFlick = 1;

    camera.rotation.order = 'YXZ';
    if (!camera.parent && level && level.scene) level.scene.add(camera);

    // flashlight: warm spot hanging off the camera, aimed forward
    const spot = new THREE.SpotLight(0xffe2b8, 0, 14, 0.45, 0.45, 1.5);
    spot.position.set(0.12, -0.12, 0);
    // the beam casts shadows (furniture shadows swinging with the flashlight); ghosts don't cast any
    spot.castShadow = true;
    spot.shadow.mapSize.set(1024, 1024);
    spot.shadow.camera.near = 0.15;
    spot.shadow.camera.far = 14;
    spot.shadow.bias = -0.0006;
    spot.shadow.normalBias = 0.02;
    spot.target.position.set(0, 0, -8);
    camera.add(spot);
    camera.add(spot.target);
    const self = this;
    this.flashlight = {
      light: spot,
      battery: 100,
      get on() { return self._flOn; },
      set on(v) { self._setFlashlight(!!v); },
    };

    // ---- input
    this._onMouseMove = (e) => {
      if (!this.isLocked || !this._enabled) return;
      this.yaw -= (e.movementX || 0) * this.sensitivity;
      this.pitch -= (e.movementY || 0) * this.sensitivity;
      this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch));
    };
    this._onLockChange = () => {
      this.isLocked = document.pointerLockElement === this.domElement;
      if (!this.isLocked) this._clearInput();
    };
    this._onKeyDown = (e) => {
      if (!this._enabled) return;
      const k = MOVE_KEYS[e.code];
      if (k) this._input[k] = true;
      if (e.repeat) return;
      if (e.code === 'KeyF') this.flashlight.on = !this._flOn;
      else if (e.code === 'KeyE') this.interact();
    };
    this._onKeyUp = (e) => { const k = MOVE_KEYS[e.code]; if (k) this._input[k] = false; };
    this._onBlur = () => this._clearInput();
    document.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('pointerlockchange', this._onLockChange);
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);

    this._syncCamera();
  }

  get enabled() { return this._enabled; }
  set enabled(v) {
    this._enabled = !!v;
    if (!this._enabled) {
      this._clearInput();
      this.velocity.set(0, 0, 0);
      this._setPrompt(null);
    }
  }

  lock() {
    const el = this.domElement;
    if (!el || !el.requestPointerLock) return undefined;
    const r = el.requestPointerLock();
    if (r && typeof r.catch === 'function') r.catch(() => {});
    return r;
  }

  unlock() { if (document.pointerLockElement === this.domElement) document.exitPointerLock(); }

  addInteractable({ position, radius = 1.5, label = '', onUse = () => {}, enabled = () => true }) {
    const it = { position, radius, label, onUse, enabled };
    this._interactables.add(it);
    return { remove: () => { this._interactables.delete(it); if (this._current === it) this._current = null; } };
  }

  // nearest usable interactable (within radius in XZ, roughly in view)
  _findTarget() {
    if (!this._enabled) return null;
    this._eyeAndForward();
    let best = null, bestD = Infinity;
    for (const it of this._interactables) {
      const ok = typeof it.enabled === 'function' ? it.enabled() : it.enabled !== false;
      if (!ok) continue;
      const p = typeof it.position === 'function' ? it.position() : it.position;
      if (!p) continue;
      const dxz = Math.hypot(p.x - this.position.x, p.z - this.position.z);
      if (dxz > it.radius) continue;
      _v.subVectors(p, _eye);
      const d = _v.length();
      if (d > 1e-4 && _v.dot(_fwd) / d < 0.6) continue;
      if (dxz < bestD) { bestD = dxz; best = it; }
    }
    return best;
  }

  interact() {
    if (!this._enabled) return false;
    const it = this._findTarget();
    if (!it) return false;
    it.onUse();
    this._current = null;
    this._setPrompt(null); // refreshed next update
    return true;
  }

  isLightOn(targetPos) {
    if (!this._flOn || !targetPos) return false;
    this._eyeAndForward();
    _v.subVectors(targetPos, _eye);
    const d = _v.length();
    if (d > BEAM_RANGE) return false;
    if (d < 0.3) return true;
    return _v.dot(_fwd) / d >= Math.cos(this.flashlight.light.angle);
  }

  update(dt) {
    dt = Math.min(Math.max(dt || 0, 0), 0.05);
    const fl = this.flashlight;

    // battery
    if (this._flOn) {
      fl.battery = Math.max(0, fl.battery - DRAIN * dt);
      if (fl.battery <= 0) this._setFlashlight(false);
    }
    fl.battery = Math.min(100, fl.battery);
    if (this._flOn && fl.battery < 15) { // weak battery sputters
      if (Math.random() < dt * 4) this._flFlick = 0.1 + Math.random() * 0.5;
      else this._flFlick += (1 - this._flFlick) * Math.min(1, dt * 10);
    } else this._flFlick = 1;
    fl.light.intensity = this._flOn ? FL_INTENSITY * this._flFlick * (fl.battery < 15 ? 0.6 + fl.battery / 37 : 1) : 0;

    // movement
    const inp = this._input;
    const f = this._enabled ? (inp.f ? 1 : 0) - (inp.b ? 1 : 0) : 0;
    const s = this._enabled ? (inp.r ? 1 : 0) - (inp.l ? 1 : 0) : 0;
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    let mx = -sy * f + cy * s, mz = -cy * f - sy * s;
    const len = Math.hypot(mx, mz);
    this.running = len > 0 && inp.run;
    const speed = this.running ? RUN : WALK;
    if (len > 0) { mx = (mx / len) * speed; mz = (mz / len) * speed; }
    const a = 1 - Math.exp(-14 * dt);
    this.velocity.x += (mx - this.velocity.x) * a;
    this.velocity.z += (mz - this.velocity.z) * a;
    if (len === 0 && Math.hypot(this.velocity.x, this.velocity.z) < 0.02) this.velocity.set(0, 0, 0);

    const ox = this.position.x, oz = this.position.z;
    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;
    if (this.level && this.level.collide) this.level.collide(this.position, RADIUS);
    const moved = Math.hypot(this.position.x - ox, this.position.z - oz);
    this.moving = len > 0 && moved > 1e-4;

    // head bob + footsteps (a step lands each time the bob phase crosses a multiple of PI)
    if (this.moving) {
      const prev = Math.floor(this._bobPhase / Math.PI);
      this._bobPhase += (moved / (this.running ? STEP_RUN : STEP_WALK)) * Math.PI;
      if (Math.floor(this._bobPhase / Math.PI) !== prev) this.onStep(this.running);
    }
    this._bobW += ((this.moving ? 1 : 0) - this._bobW) * Math.min(1, dt * 8);

    // interaction prompt
    const target = this._findTarget();
    this._current = target;
    this._setPrompt(target ? (typeof target.label === 'function' ? target.label() : target.label) : null);

    this._syncCamera();
  }

  dispose() {
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('pointerlockchange', this._onLockChange);
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
    const l = this.flashlight.light;
    l.parent && l.parent.remove(l.target, l);
  }

  // ---- internals
  _syncCamera() {
    const amp = (this.running ? 0.07 : 0.035) * this._bobW;
    const bobY = Math.abs(Math.sin(this._bobPhase)) * amp - amp * 0.5;
    const sway = Math.sin(this._bobPhase) * amp * 0.5;
    const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
    this.camera.position.set(this.position.x + cy * sway, this.position.y + EYE + bobY, this.position.z - sy * sway);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    this.camera.updateMatrixWorld();
  }

  _eyeAndForward() {
    _eye.set(this.position.x, this.position.y + EYE, this.position.z);
    const cp = Math.cos(this.pitch);
    _fwd.set(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp);
  }

  _setFlashlight(on) {
    if (on && this.flashlight.battery <= 0) on = false;
    if (on === this._flOn) return;
    this._flOn = on;
    this.flashlight.light.intensity = on ? FL_INTENSITY : 0;
    this.onFlashlightToggle(on);
  }

  _setPrompt(label) {
    const v = label || null;
    if (v === this._prompt) return;
    this._prompt = v;
    this.onPrompt(v);
  }

  _clearInput() { for (const k in this._input) this._input[k] = false; }
}
