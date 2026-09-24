// Scream input: microphone loudness (optional) + Space-mash fallback.
// Never throws: if the mic is denied/unavailable, usingMic stays false and Space still works.

const MIC_THRESHOLD = 0.5;   // level needed to count as a scream
const MIC_HOLD = 0.15;       // seconds above threshold
const CHARGE_PER_PRESS = 0.12;
const CHARGE_DECAY = 0.35;   // per second
const COOLDOWN = 3;

let analyser = null;
let buf = null;
let loudTime = 0;
let keysBound = false;
const listeners = [];

function fire() {
  Scream.cooldown = COOLDOWN;
  Scream.charge = 0;
  loudTime = 0;
  for (const cb of listeners) {
    try { cb(); } catch (e) { console.warn('[Scream] listener failed', e); }
  }
}

function onKey(e) {
  if (e.code !== 'Space') return;
  // keep the page from scrolling; ignore auto-repeat so it must be mashed
  if (!e.target?.closest?.('input,textarea')) e.preventDefault();
  if (e.repeat || !Scream.enabled || Scream.cooldown > 0) return;
  Scream.charge = Math.min(1, Scream.charge + CHARGE_PER_PRESS);
  if (Scream.charge >= 1) fire();
}

function bindKeys() {
  if (keysBound || typeof window === 'undefined') return;
  window.addEventListener('keydown', onKey);
  keysBound = true;
}

export const Scream = {
  usingMic: false,
  level: 0,
  charge: 0,
  cooldown: 0,
  enabled: true, // extra: set false to ignore input (menus)
  threshold: MIC_THRESHOLD,

  async init() {
    bindKeys();
    if (analyser) return this.usingMic;
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('getUserMedia unavailable');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      const AC = window.AudioContext || window.webkitAudioContext;
      const ctx = new AC();
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      const src = ctx.createMediaStreamSource(stream);
      analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      buf = new Float32Array(analyser.fftSize);
      src.connect(analyser); // not connected to destination (no feedback)
      this.usingMic = true;
    } catch (e) {
      console.info('[Scream] mic unavailable, Space fallback only:', e?.message || e);
      analyser = null;
      this.usingMic = false;
    }
    return this.usingMic;
  },

  onScream(cb) {
    if (typeof cb === 'function') listeners.push(cb);
  },

  update(dt) {
    bindKeys();
    dt = Math.min(Math.max(dt || 0, 0), 0.25);
    if (this.cooldown > 0) this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.charge > 0) this.charge = Math.max(0, this.charge - CHARGE_DECAY * dt);

    if (analyser) {
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      const rms = Math.sqrt(sum / buf.length);
      // speech ≈ 0.02–0.08 rms, shouting into the mic ≈ 0.15+
      const target = Math.min(1, Math.max(0, (rms - 0.01) / 0.25));
      const k = target > this.level ? 18 : 4; // fast attack, slow release
      this.level += (target - this.level) * Math.min(1, k * dt);

      if (this.enabled && this.cooldown <= 0 && this.level > this.threshold) {
        loudTime += dt;
        if (loudTime >= MIC_HOLD) fire();
      } else {
        loudTime = 0;
      }
    } else {
      this.level = 0;
    }
  },
};

bindKeys();
