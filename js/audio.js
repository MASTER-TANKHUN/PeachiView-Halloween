// Procedural Web Audio: one-shot sfx + ambient drone/heartbeat. No audio files.
// Chain: voices → master gain (≤ 0.6) → DynamicsCompressor (limiter) → destination.

const MASTER_CAP = 0.6;
let ctx = null;
let master = null;
let limiter = null;
let noiseBuf = null;
let masterLevel = 0.5;

function ensure() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }
  const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!AC) return null;
  try {
    ctx = new AC();
  } catch (e) {
    console.warn('[audio] no AudioContext', e);
    return null;
  }
  limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -10;
  limiter.knee.value = 4;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.002;
  limiter.release.value = 0.2;
  master = ctx.createGain();
  master.gain.value = masterLevel;
  master.connect(limiter).connect(ctx.destination);

  // 2 s of white noise, reused by every noise voice
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

  // resume on any later gesture (autoplay policies)
  const wake = () => { if (ctx.state === 'suspended') ctx.resume().catch(() => {}); };
  window.addEventListener('pointerdown', wake);
  window.addEventListener('keydown', wake);
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

// ---------- tiny synth helpers ----------
const rand = (a, b) => a + Math.random() * (b - a);

function env(g, t, a, peak, hold, rel) {
  g.gain.cancelScheduledValues(t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + a);
  g.gain.setValueAtTime(peak, t + a + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + rel);
  return t + a + hold + rel;
}

function out(dest, pan = 0) {
  if (pan && ctx.createStereoPanner) {
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    p.connect(dest || master);
    return p;
  }
  return dest || master;
}

/** oscillator voice: freq may be number or [start, end] (exp glide) */
function tone({ type = 'sine', freq = 440, t = ctx.currentTime, a = 0.005, hold = 0, rel = 0.15, vol = 0.3, pan = 0, detune = 0, vib = 0, vibRate = 6, dest }) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.detune.value = detune;
  const [f0, f1] = Array.isArray(freq) ? freq : [freq, freq];
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + a + hold + rel);
  if (vib) {
    const lfo = ctx.createOscillator();
    const lg = ctx.createGain();
    lfo.frequency.value = vibRate;
    lg.gain.value = vib;
    lfo.connect(lg).connect(o.frequency);
    lfo.start(t);
    lfo.stop(t + a + hold + rel + 0.05);
  }
  const end = env(g, t, a, vol, hold, rel);
  o.connect(g).connect(out(dest, pan));
  o.start(t);
  o.stop(end + 0.05);
  return o;
}

/** filtered noise voice */
function noise({ t = ctx.currentTime, a = 0.005, hold = 0, rel = 0.2, vol = 0.3, filter = 'bandpass', f = 1000, f1, q = 1, pan = 0, rate = 1, dest }) {
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  s.loop = true;
  s.playbackRate.value = rate;
  const fl = ctx.createBiquadFilter();
  fl.type = filter;
  fl.Q.value = q;
  fl.frequency.setValueAtTime(f, t);
  if (f1) fl.frequency.exponentialRampToValueAtTime(f1, t + a + hold + rel);
  const g = ctx.createGain();
  const end = env(g, t, a, vol, hold, rel);
  s.connect(fl).connect(g).connect(out(dest, pan));
  s.start(t, Math.random());
  s.stop(end + 0.05);
  return fl;
}

function distortion(amount = 30) {
  const ws = ctx.createWaveShaper();
  const n = 1024;
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    c[i] = ((3 + amount) * x * 20 * (Math.PI / 180)) / (Math.PI + amount * Math.abs(x));
  }
  ws.curve = c;
  return ws;
}

// ---------- sound recipes ----------
const recipes = {
  jumpscare(t) {
    // sub thump
    tone({ type: 'sine', freq: [120, 30], t, a: 0.005, rel: 0.6, vol: 0.9 });
    // loud noise burst
    noise({ t, a: 0.004, hold: 0.25, rel: 0.7, vol: 0.8, filter: 'highpass', f: 400, q: 0.5 });
    // dissonant screech cluster through distortion
    const ws = distortion(60);
    const g = ctx.createGain();
    g.gain.value = 0.35;
    ws.connect(g).connect(master);
    for (const [f, d] of [[880, 0], [932, 7], [1245, -12], [1661, 5]]) {
      tone({ type: 'sawtooth', freq: [f, f * 1.5], t, a: 0.01, hold: 0.45, rel: 0.5, vol: 0.25, detune: d, vib: 40, vibRate: 13, dest: ws });
    }
  },
  pickup(t) {
    [659, 784, 988, 1319].forEach((f, i) => {
      tone({ type: 'triangle', freq: f, t: t + i * 0.06, rel: 0.25, vol: 0.28 });
      tone({ type: 'sine', freq: f * 2, t: t + i * 0.06, rel: 0.15, vol: 0.08 });
    });
    noise({ t: t + 0.2, rel: 0.4, vol: 0.06, filter: 'highpass', f: 6000 });
  },
  place(t) {
    tone({ type: 'sine', freq: [140, 60], t, rel: 0.2, vol: 0.5 });
    tone({ type: 'triangle', freq: 784, t: t + 0.08, rel: 0.5, vol: 0.25 });
    tone({ type: 'triangle', freq: 1175, t: t + 0.22, rel: 0.8, vol: 0.25 });
    tone({ type: 'sine', freq: 2350, t: t + 0.22, rel: 0.6, vol: 0.06 });
  },
  ban(t) {
    // cartoon hammer "BONK"
    tone({ type: 'square', freq: [520, 90], t, a: 0.002, rel: 0.18, vol: 0.28 });
    tone({ type: 'sine', freq: [300, 120], t, a: 0.002, rel: 0.25, vol: 0.5 });
    noise({ t, rel: 0.06, vol: 0.4, filter: 'bandpass', f: 2500, q: 2 });
    tone({ type: 'sine', freq: 1568, t: t + 0.12, rel: 0.2, vol: 0.08 });
  },
  whisper(t) {
    const pan = rand(-0.9, 0.9);
    const syll = 5 + Math.floor(Math.random() * 4);
    for (let i = 0; i < syll; i++) {
      const tt = t + i * rand(0.12, 0.2);
      noise({ t: tt, a: 0.04, hold: 0.04, rel: 0.12, vol: 0.18, filter: 'bandpass', f: rand(1200, 3200), f1: rand(800, 2400), q: 6, pan });
      noise({ t: tt, a: 0.03, rel: 0.1, vol: 0.08, filter: 'highpass', f: 5000, pan });
    }
  },
  step(t) {
    noise({ t, a: 0.003, rel: 0.09, vol: 0.35, filter: 'lowpass', f: rand(250, 420), q: 1.5 });
    tone({ type: 'sine', freq: [rand(70, 95), 45], t, rel: 0.08, vol: 0.25 });
  },
  flicker(t) {
    const g = ctx.createGain();
    g.gain.value = 0;
    g.connect(master);
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = 100;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 900;
    f.Q.value = 1.2;
    o.connect(f).connect(g);
    let tt = t;
    for (let i = 0; i < 9; i++) {
      const on = rand(0.02, 0.08);
      g.gain.setValueAtTime(rand(0.08, 0.2), tt);
      g.gain.setValueAtTime(0, tt + on);
      if (Math.random() < 0.6) noise({ t: tt, rel: 0.03, vol: 0.25, filter: 'highpass', f: 3000 });
      tt += on + rand(0.02, 0.09);
    }
    o.start(t);
    o.stop(tt + 0.05);
  },
  superchat(t) {
    // "ka-ching!"
    noise({ t, rel: 0.05, vol: 0.3, filter: 'highpass', f: 4000 });
    tone({ type: 'square', freq: 988, t: t + 0.02, rel: 0.08, vol: 0.12 });
    tone({ type: 'square', freq: 1319, t: t + 0.1, hold: 0.05, rel: 0.4, vol: 0.12 });
    tone({ type: 'sine', freq: 2637, t: t + 0.1, rel: 0.5, vol: 0.08, vib: 30, vibRate: 20 });
    noise({ t: t + 0.1, a: 0.01, rel: 0.5, vol: 0.08, filter: 'highpass', f: 8000 });
  },
  tick(t) {
    tone({ type: 'sine', freq: 2000, t, a: 0.001, rel: 0.03, vol: 0.2 });
    noise({ t, a: 0.001, rel: 0.02, vol: 0.15, filter: 'highpass', f: 3000 });
    tone({ type: 'sine', freq: 1500, t: t + 0.25, a: 0.001, rel: 0.03, vol: 0.12 });
  },
  win(t) {
    const notes = [523, 659, 784, 1047, 784, 1047, 1319];
    const times = [0, 0.12, 0.24, 0.36, 0.52, 0.64, 0.8];
    notes.forEach((f, i) => {
      const long = i === notes.length - 1;
      tone({ type: 'triangle', freq: f, t: t + times[i], hold: long ? 0.4 : 0.05, rel: long ? 0.8 : 0.12, vol: 0.25, vib: long ? 8 : 0 });
      tone({ type: 'square', freq: f / 2, t: t + times[i], hold: long ? 0.4 : 0.03, rel: long ? 0.6 : 0.1, vol: 0.05 });
    });
    for (let i = 0; i < 10; i++) tone({ type: 'sine', freq: rand(2000, 4200), t: t + 0.8 + i * 0.07, rel: 0.2, vol: 0.05 });
  },
  lose(t) {
    // sad trombone: wah wah wah waaaah
    const notes = [392, 370, 349, 330];
    notes.forEach((f, i) => {
      const last = i === 3;
      const dest = ctx.createBiquadFilter();
      dest.type = 'lowpass';
      dest.frequency.setValueAtTime(700, t + i * 0.45);
      dest.frequency.linearRampToValueAtTime(1800, t + i * 0.45 + 0.15);
      dest.frequency.linearRampToValueAtTime(600, t + i * 0.45 + (last ? 1.4 : 0.4));
      dest.Q.value = 3;
      dest.connect(master);
      tone({ type: 'sawtooth', freq: last ? [f, f * 0.94] : f, t: t + i * 0.45, a: 0.04, hold: last ? 0.9 : 0.25, rel: last ? 0.5 : 0.12, vol: 0.3, vib: last ? 10 : 2, vibRate: last ? 6 : 4, dest });
    });
  },
  scream(t) {
    // the player's scream shockwave: "AAAH" formant + whoosh + boom
    const f1 = ctx.createBiquadFilter();
    f1.type = 'bandpass'; f1.frequency.value = 800; f1.Q.value = 5;
    const f2 = ctx.createBiquadFilter();
    f2.type = 'bandpass'; f2.frequency.value = 1200; f2.Q.value = 6;
    const mix = ctx.createGain();
    mix.gain.value = 2.2;
    const ws = distortion(20);
    f1.connect(mix); f2.connect(mix);
    mix.connect(ws).connect(master);
    tone({ type: 'sawtooth', freq: [260, 340], t, a: 0.03, hold: 0.4, rel: 0.35, vol: 0.35, vib: 18, vibRate: 7, dest: f1 });
    tone({ type: 'sawtooth', freq: [262, 345], t, a: 0.03, hold: 0.4, rel: 0.35, vol: 0.35, detune: 12, vib: 18, vibRate: 7.5, dest: f2 });
    noise({ t, a: 0.02, hold: 0.2, rel: 0.6, vol: 0.35, filter: 'bandpass', f: 300, f1: 3000, q: 0.8 });
    tone({ type: 'sine', freq: [90, 35], t, rel: 0.5, vol: 0.6 });
  },
  stun(t) {
    // cartoon dizzy "boi-oi-oing" + twinkle stars
    tone({ type: 'sine', freq: [300, 700], t, a: 0.005, hold: 0.1, rel: 0.5, vol: 0.3, vib: 120, vibRate: 14 });
    [2093, 2637, 3136, 2637, 2093].forEach((f, i) => tone({ type: 'triangle', freq: f, t: t + 0.25 + i * 0.09, rel: 0.12, vol: 0.07 }));
  },
  doorbell(t) {
    // ding… dong (a slightly out-of-tune two-tone chime, it's an old house)
    for (const [f, dt] of [[659, 0], [523, 0.55]]) {
      tone({ type: 'sine', freq: f, t: t + dt, a: 0.004, hold: 0.05, rel: 1.6, vol: 0.32, vib: 3, vibRate: 5 });
      tone({ type: 'triangle', freq: f * 2.01, t: t + dt, a: 0.004, rel: 0.7, vol: 0.07 });
      tone({ type: 'sine', freq: f * 3.02, t: t + dt, a: 0.004, rel: 0.4, vol: 0.03 });
    }
  },
  creak(t, o = {}) {
    // slow door hinge: rubbing sawtooth through a narrow band, pitch wandering
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = rand(700, 1100); f.Q.value = 9;
    f.connect(out(null, o.pan || 0));
    const len = o.len || rand(0.5, 0.9);
    tone({ type: 'sawtooth', freq: [rand(140, 190), rand(80, 110)], t, a: 0.08, hold: len, rel: 0.2, vol: (o.vol ?? 1) * 0.3, vib: 22, vibRate: rand(9, 16), dest: f });
    tone({ type: 'sawtooth', freq: [rand(300, 360), rand(200, 240)], t: t + 0.05, a: 0.1, hold: len * 0.7, rel: 0.2, vol: (o.vol ?? 1) * 0.08, vib: 30, vibRate: 11, dest: f });
  },
  doorShut(t, o = {}) {
    const v = o.vol ?? 1, pan = o.pan || 0;
    tone({ type: 'sine', freq: [110, 45], t, a: 0.003, rel: 0.3, vol: 0.55 * v, pan });
    noise({ t, a: 0.002, rel: 0.12, vol: 0.35 * v, filter: 'lowpass', f: 900, pan });
    noise({ t: t + 0.04, a: 0.001, rel: 0.03, vol: 0.2 * v, filter: 'bandpass', f: 3200, q: 4, pan }); // latch
  },
  doorSlam(t, o = {}) {
    const pan = o.pan || 0;
    tone({ type: 'sine', freq: [90, 32], t, a: 0.002, rel: 0.55, vol: 0.9, pan });
    noise({ t, a: 0.002, hold: 0.04, rel: 0.4, vol: 0.6, filter: 'lowpass', f: 1400, pan });
    for (let i = 0; i < 5; i++) noise({ t: t + 0.08 + i * rand(0.04, 0.07), rel: 0.03, vol: 0.12, filter: 'bandpass', f: rand(1500, 4000), q: 6, pan }); // frame rattle
  },
  locked(t) {
    for (let i = 0; i < 3; i++) {
      noise({ t: t + i * 0.11, a: 0.001, rel: 0.04, vol: 0.3, filter: 'bandpass', f: rand(2200, 3200), q: 5 });
      tone({ type: 'square', freq: rand(180, 240), t: t + i * 0.11, a: 0.001, rel: 0.03, vol: 0.05 });
    }
  },
  switch(t) {
    noise({ t, a: 0.001, rel: 0.018, vol: 0.4, filter: 'highpass', f: 2500 });
    tone({ type: 'sine', freq: 1900, t, a: 0.001, rel: 0.02, vol: 0.12 });
  },
  crunch(t) {
    for (let i = 0; i < 6; i++) noise({ t: t + i * rand(0.09, 0.14), a: 0.002, rel: rand(0.04, 0.08), vol: 0.28, filter: 'bandpass', f: rand(1800, 4500), q: 1.2 });
    tone({ type: 'sine', freq: [300, 520], t: t + 0.8, a: 0.01, rel: 0.12, vol: 0.12 }); // happy "mm!"
  },
  gasp(t) {
    noise({ t, a: 0.05, hold: 0.12, rel: 0.25, vol: 0.4, filter: 'bandpass', f: 1400, f1: 2400, q: 1.5 });
  },
  inhale(t) { noise({ t, a: 0.12, hold: 0.1, rel: 0.15, vol: 0.14, filter: 'bandpass', f: 900, f1: 1600, q: 1.2 }); },
  exhale(t) { noise({ t, a: 0.03, hold: 0.15, rel: 0.4, vol: 0.12, filter: 'bandpass', f: 1500, f1: 700, q: 1.2 }); },
  notify(t) {
    tone({ type: 'sine', freq: 1568, t, a: 0.003, rel: 0.16, vol: 0.2 });
    tone({ type: 'sine', freq: 2093, t: t + 0.09, a: 0.003, rel: 0.3, vol: 0.2 });
  },
  glitch(t, o = {}) {
    const n = o.n || 7;
    for (let i = 0; i < n; i++) {
      const tt = t + i * rand(0.02, 0.06);
      tone({ type: 'square', freq: rand(80, 2400), t: tt, a: 0.001, rel: rand(0.015, 0.05), vol: 0.12 });
      noise({ t: tt, a: 0.001, rel: 0.03, vol: 0.18, filter: 'bandpass', f: rand(500, 6000), q: 3 });
    }
  },
  powerDown(t) {
    tone({ type: 'sawtooth', freq: [220, 28], t, a: 0.01, hold: 0.1, rel: 1.2, vol: 0.3 });
    tone({ type: 'sine', freq: [120, 20], t, a: 0.01, rel: 1.4, vol: 0.4 });
    noise({ t, a: 0.005, rel: 0.2, vol: 0.2, filter: 'highpass', f: 5000 });
  },
  endStream(t) {
    tone({ type: 'sine', freq: 880, t, a: 0.005, rel: 0.12, vol: 0.22 });
    tone({ type: 'sine', freq: 587, t: t + 0.12, a: 0.005, rel: 0.35, vol: 0.22 });
  },
  denied(t) {
    tone({ type: 'square', freq: 196, t, a: 0.004, hold: 0.12, rel: 0.05, vol: 0.14 });
    tone({ type: 'square', freq: 185, t: t + 0.2, a: 0.004, hold: 0.25, rel: 0.08, vol: 0.14 });
  },
  tinyMusic(t, o = {}) {
    // music leaking out of the lost headphones: a tiny music-box phrase, panned toward them
    const vol = (o.vol ?? 1) * 0.16, pan = o.pan || 0;
    const tune = [784, 988, 1175, 988, 1319, 1175, 988, 784];
    tune.forEach((f, i) => {
      tone({ type: 'triangle', freq: f, t: t + i * 0.16, a: 0.004, rel: 0.22, vol, pan });
      tone({ type: 'sine', freq: f * 2, t: t + i * 0.16, a: 0.004, rel: 0.12, vol: vol * 0.3, pan });
    });
  },
  shutter(t) {
    noise({ t, a: 0.001, rel: 0.03, vol: 0.35, filter: 'highpass', f: 3000 });
    noise({ t: t + 0.07, a: 0.001, rel: 0.05, vol: 0.25, filter: 'bandpass', f: 2000, q: 2 });
  },
  bang(t) {
    // breaker short: a crack, a buzz, sparks
    noise({ t, a: 0.001, rel: 0.12, vol: 0.9, filter: 'lowpass', f: 3000 });
    tone({ type: 'sine', freq: [140, 40], t, a: 0.002, rel: 0.35, vol: 0.7 });
    tone({ type: 'sawtooth', freq: 100, t: t + 0.02, a: 0.005, hold: 0.25, rel: 0.1, vol: 0.12 });
    for (let i = 0; i < 9; i++) noise({ t: t + 0.05 + i * rand(0.02, 0.06), a: 0.001, rel: 0.02, vol: 0.2, filter: 'highpass', f: rand(3000, 7000) });
  },
  powerUp(t) {
    // relays clack, the fridge hums back, lights tick on
    for (let i = 0; i < 3; i++) noise({ t: t + i * 0.09, a: 0.001, rel: 0.03, vol: 0.3, filter: 'bandpass', f: 1800, q: 3 });
    tone({ type: 'sawtooth', freq: [30, 100], t: t + 0.2, a: 0.3, hold: 0.3, rel: 0.5, vol: 0.08 });
    tone({ type: 'sine', freq: [200, 520], t: t + 0.25, a: 0.2, rel: 0.3, vol: 0.12 });
  },
  drip(t, o = {}) {
    const v = o.vol ?? 1, pan = o.pan || 0;
    tone({ type: 'sine', freq: [rand(900, 1300), rand(300, 450)], t, a: 0.002, rel: 0.09, vol: 0.2 * v, pan });
    tone({ type: 'sine', freq: [rand(1800, 2400), 900], t: t + 0.03, a: 0.002, rel: 0.05, vol: 0.06 * v, pan });
  },
  whoosh(t, o = {}) {
    noise({ t, a: 0.15, hold: 0.05, rel: 0.35, vol: 0.22 * (o.vol ?? 1), filter: 'bandpass', f: 400, f1: 1600, q: 0.8, pan: o.pan || 0 });
  },
  lick(t) {
    // a long wet slurp, then goo
    noise({ t, a: 0.05, hold: 0.35, rel: 0.2, vol: 0.45, filter: 'bandpass', f: 600, f1: 1500, q: 3 });
    tone({ type: 'sine', freq: [180, 90], t, a: 0.05, hold: 0.3, rel: 0.2, vol: 0.2, vib: 30, vibRate: 22 });
    for (let i = 0; i < 5; i++) tone({ type: 'sine', freq: [rand(500, 900), 200], t: t + 0.6 + i * rand(0.08, 0.16), a: 0.002, rel: 0.06, vol: 0.12 });
  },
  cackle(t, o = {}) {
    // Krasue's laugh: high, nasal, "hi-hi-hiiii"
    const pan = o.pan || 0, v = o.vol ?? 1;
    for (let i = 0; i < 6; i++) {
      const tt = t + i * 0.12, f = 1300 - i * 40 + (i === 5 ? 200 : 0);
      tone({ type: 'square', freq: [f, f * 0.85], t: tt, a: 0.005, hold: i === 5 ? 0.25 : 0.03, rel: 0.06, vol: 0.05 * v, vib: 60, vibRate: 30, pan });
      noise({ t: tt, a: 0.004, rel: 0.05, vol: 0.05 * v, filter: 'highpass', f: 4000, pan });
    }
  },
  sparkle(t, o = {}) {
    const pan = o.pan || 0, v = o.vol ?? 1;
    [2637, 3136, 3951, 3520].forEach((f, i) => tone({ type: 'sine', freq: f, t: t + i * 0.06, a: 0.002, rel: 0.25, vol: 0.06 * v, pan }));
  },
  found(t) {
    // "เจอแล้ว!" jingle
    [784, 988, 1175, 1568].forEach((f, i) => { tone({ type: 'triangle', freq: f, t: t + i * 0.08, a: 0.004, rel: 0.2, vol: 0.2 }); tone({ type: 'sine', freq: f * 2, t: t + i * 0.08, a: 0.004, rel: 0.12, vol: 0.05 }); });
  },
  sting(t) {
    // horror sting for the mirror
    tone({ type: 'sawtooth', freq: [220, 233], t, a: 0.01, hold: 0.5, rel: 0.8, vol: 0.14, vib: 8, vibRate: 7 });
    tone({ type: 'sawtooth', freq: [311, 330], t, a: 0.01, hold: 0.5, rel: 0.8, vol: 0.1, vib: 9, vibRate: 6 });
    noise({ t, a: 0.005, rel: 0.6, vol: 0.2, filter: 'highpass', f: 3000 });
    tone({ type: 'sine', freq: [80, 40], t, a: 0.005, rel: 0.8, vol: 0.5 });
  },
  peachShine(t) {
    // the golden peach: a warm shimmering chord
    [523, 659, 784, 1047].forEach((f, i) => tone({ type: 'sine', freq: f, t: t + i * 0.05, a: 0.05, hold: 0.3, rel: 1.2, vol: 0.08, vib: 4, vibRate: 5 }));
  },
  squelch(t) {
    noise({ t, a: 0.01, hold: 0.1, rel: 0.25, vol: 0.4, filter: 'lowpass', f: 700, f1: 300 });
    tone({ type: 'sine', freq: [260, 120], t, a: 0.01, rel: 0.3, vol: 0.2, vib: 40, vibRate: 25 });
  },
  modem(t) {
    // the Wi-Fi joke: a tiny dial-up handshake
    tone({ type: 'sine', freq: 1070, t, a: 0.01, hold: 0.25, rel: 0.02, vol: 0.08 });
    tone({ type: 'sine', freq: 2100, t: t + 0.3, a: 0.01, hold: 0.2, rel: 0.02, vol: 0.07 });
    for (let i = 0; i < 8; i++) tone({ type: 'square', freq: rand(900, 2600), t: t + 0.55 + i * 0.05, a: 0.002, rel: 0.04, vol: 0.04 });
    noise({ t: t + 0.55, a: 0.02, hold: 0.35, rel: 0.1, vol: 0.06, filter: 'bandpass', f: 1800, q: 1 });
  },
  giggle(t, o = {}) {
    // cute "hi-hi-hi-hii~"
    const pan = o.pan || 0, v = o.vol ?? 1;
    const n = 4 + Math.floor(Math.random() * 3);
    const base = rand(820, 980);
    for (let i = 0; i < n; i++) {
      const tt = t + i * 0.11;
      const f = base * (1 + (n - i) * 0.04) * (i === n - 1 ? 1.2 : 1);
      const last = i === n - 1;
      tone({ type: 'triangle', freq: last ? [f, f * 0.8] : [f * 1.08, f], t: tt, a: 0.008, hold: last ? 0.08 : 0.02, rel: last ? 0.25 : 0.06, vol: 0.22 * v, vib: 25, vibRate: 22, pan });
      tone({ type: 'sine', freq: f * 2.01, t: tt, a: 0.008, rel: 0.05, vol: 0.05 * v, pan });
      noise({ t: tt, a: 0.005, rel: 0.04, vol: 0.05 * v, filter: 'highpass', f: 5000, pan }); // breathy "h""
    }
  },
};

export const sfx = {
  init() {
    return !!ensure();
  },
  /** opts (some sounds): { pan: -1..1, vol: 0..1 } */
  play(name, opts) {
    if (!ensure()) return;
    const r = recipes[name];
    if (!r) { console.warn('[sfx] unknown sound', name); return; }
    try { r(ctx.currentTime + 0.01, opts || {}); } catch (e) { console.warn('[sfx] failed', name, e); }
  },
  setMaster(v) {
    masterLevel = Math.max(0, Math.min(MASTER_CAP, Number(v) || 0));
    if (master) master.gain.setTargetAtTime(masterLevel, ctx.currentTime, 0.05);
  },
  names: Object.keys(recipes),
};

// ---------- ambient: drone + wind + heartbeat + random creaks ----------
let amb = null;

function scheduleBeat(t, strength) {
  const g = amb.hbGain;
  // lub
  const o1 = ctx.createOscillator();
  const e1 = ctx.createGain();
  o1.frequency.setValueAtTime(70, t);
  o1.frequency.exponentialRampToValueAtTime(38, t + 0.12);
  env(e1, t, 0.008, strength, 0.02, 0.14);
  o1.connect(e1).connect(g);
  o1.start(t); o1.stop(t + 0.25);
  // dub
  const t2 = t + 0.22;
  const o2 = ctx.createOscillator();
  const e2 = ctx.createGain();
  o2.frequency.setValueAtTime(62, t2);
  o2.frequency.exponentialRampToValueAtTime(34, t2 + 0.12);
  env(e2, t2, 0.008, strength * 0.7, 0.02, 0.16);
  o2.connect(e2).connect(g);
  o2.start(t2); o2.stop(t2 + 0.25);
}

function tickAmbient() {
  if (!amb) return;
  const now = ctx.currentTime;
  const k = amb.tension;
  const bpm = 58 + k * 82;
  while (amb.nextBeat < now + 0.3) {
    if (amb.nextBeat < now) amb.nextBeat = now + 0.02;
    scheduleBeat(amb.nextBeat, 0.25 + k * 0.75);
    amb.nextBeat += 60 / bpm;
  }
  if (now > amb.nextCreak) {
    const t = now + 0.05;
    // door creak / floorboard
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = rand(500, 1400); f.Q.value = 8;
    f.connect(amb.bus);
    tone({ type: 'sawtooth', freq: [rand(90, 160), rand(50, 80)], t, a: 0.2, hold: rand(0.2, 0.6), rel: 0.3, vol: 0.12, vib: 15, vibRate: rand(8, 25), dest: f, pan: rand(-0.8, 0.8) });
    amb.nextCreak = now + rand(9, 22) * (1 - k * 0.5);
  }
}

export const ambient = {
  start() {
    if (!ensure() || amb) return;
    const t = ctx.currentTime;
    const bus = ctx.createGain();
    bus.gain.setValueAtTime(0.0001, t);
    bus.gain.exponentialRampToValueAtTime(0.5, t + 3);
    bus.connect(master);

    // drone: detuned low saws through a lowpass whose cutoff rises with tension
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 180; lp.Q.value = 4;
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.35;
    lp.connect(droneGain).connect(bus);
    const oscs = [];
    for (const [f, type] of [[55, 'sawtooth'], [55.4, 'sawtooth'], [82.4, 'triangle'], [27.5, 'sine']]) {
      const o = ctx.createOscillator();
      o.type = type; o.frequency.value = f;
      o.connect(lp); o.start(t);
      oscs.push(o);
    }
    // slow filter wobble
    const lfo = ctx.createOscillator();
    const lfoG = ctx.createGain();
    lfo.frequency.value = 0.07; lfoG.gain.value = 60;
    lfo.connect(lfoG).connect(lp.frequency); lfo.start(t);
    oscs.push(lfo);

    // dissonant high tone that fades in with tension
    const high = ctx.createOscillator();
    high.type = 'sine'; high.frequency.value = 1244; // tritone-ish against the drone
    const high2 = ctx.createOscillator();
    high2.type = 'sine'; high2.frequency.value = 1318;
    const highG = ctx.createGain();
    highG.gain.value = 0;
    high.connect(highG); high2.connect(highG); highG.connect(bus);
    high.start(t); high2.start(t);
    oscs.push(high, high2);

    // wind: looping noise through a wandering bandpass
    const wind = ctx.createBufferSource();
    wind.buffer = noiseBuf; wind.loop = true;
    const wf = ctx.createBiquadFilter();
    wf.type = 'bandpass'; wf.frequency.value = 500; wf.Q.value = 1.5;
    const wg = ctx.createGain();
    wg.gain.value = 0.12;
    const wl = ctx.createOscillator();
    const wlg = ctx.createGain();
    wl.frequency.value = 0.11; wlg.gain.value = 300;
    wl.connect(wlg).connect(wf.frequency); wl.start(t);
    wind.connect(wf).connect(wg).connect(bus);
    wind.start(t);
    oscs.push(wl, wind);

    const hbGain = ctx.createGain();
    hbGain.gain.value = 0.15;
    hbGain.connect(bus);

    amb = { bus, lp, highG, hbGain, oscs, tension: 0, nextBeat: t + 0.5, nextCreak: t + 6, timer: setInterval(tickAmbient, 100) };
    ambient.setTension(0);
  },
  stop() {
    if (!amb) return;
    const a = amb;
    amb = null;
    clearInterval(a.timer);
    const t = ctx.currentTime;
    a.bus.gain.cancelScheduledValues(t);
    a.bus.gain.setValueAtTime(Math.max(0.0001, a.bus.gain.value), t);
    a.bus.gain.exponentialRampToValueAtTime(0.0001, t + 1);
    for (const o of a.oscs) { try { o.stop(t + 1.1); } catch {} }
    setTimeout(() => a.bus.disconnect(), 1300);
  },
  setTension(v) {
    if (!amb) return;
    const k = Math.max(0, Math.min(1, Number(v) || 0));
    amb.tension = k;
    const t = ctx.currentTime;
    amb.lp.frequency.setTargetAtTime(160 + k * 700, t, 0.5);
    amb.highG.gain.setTargetAtTime(k * k * 0.03, t, 0.5);
    amb.hbGain.gain.setTargetAtTime(0.12 + k * 0.9, t, 0.3);
  },
};

// ---------- voices: Animal-Crossing-style babble, one blip per syllable ----------
// The same text always sounds the same (pitches come from the characters), so lines have a "tune".
const THAI_CONS = /[ก-ฮ]/;
const LATIN = /[A-Za-z0-9]/;
const VOICES = {
  // Peachi: bright and bouncy
  peachi: { base: 560, spread: 0.32, dur: 0.062, gap: 0.014, type: 'triangle', formant: 1900, q: 1.4, vol: 0.2, vib: 14 },
  // Peachi before she gets her headphones back: the same voice through a broken stream
  peachiBroken: { base: 520, spread: 0.45, dur: 0.07, gap: 0.02, type: 'triangle', formant: 1500, q: 2.5, vol: 0.18, vib: 40, broken: 0.4 },
  // PeachiBot: modem beeps, perfectly on grid
  bot: { base: 880, spread: 0.6, dur: 0.045, gap: 0.03, type: 'square', formant: 2400, q: 0.8, vol: 0.07, vib: 0, steps: [1, 1.5, 2, 1.25, 0.75] },
  // Krasue: high, nasal, a bit too pleased with herself
  krasue: { base: 760, spread: 0.55, dur: 0.055, gap: 0.012, type: 'square', formant: 2900, q: 2.2, vol: 0.07, vib: 28 },
  // "เธอ" and other whispers: breathy, no pitch
  whisper: { base: 300, spread: 0.2, dur: 0.08, gap: 0.03, type: 'sine', formant: 2600, q: 5, vol: 0.05, vib: 0, breath: 1 },
};
let voiceBus = null, voiceTimer = 0;
function hashChar(c) { const x = c.codePointAt(0); return ((x * 2654435761) >>> 0) / 4294967296; }
function syllables(text) {
  const out = [];
  let latin = 0;
  for (const ch of String(text)) {
    if (THAI_CONS.test(ch)) out.push(ch);
    else if (LATIN.test(ch)) { if (latin++ % 2 === 0) out.push(ch); }
    else latin = 0;
  }
  return out.slice(0, 26);
}
export const voice = {
  /**
   * Babble `text` in a character's voice. Returns the duration in seconds.
   * opts: { pan, vol, pitch (multiplier) }
   */
  speak(text, who = 'peachi', opts = {}) {
    if (!ensure()) return 0;
    const V = VOICES[who] || VOICES.peachi;
    if (!voiceBus) { voiceBus = ctx.createGain(); voiceBus.gain.value = 1; voiceBus.connect(master); }
    this.stop();
    const bus = ctx.createGain(); bus.gain.value = opts.vol ?? 1; bus.connect(voiceBus);
    voiceTimer = bus;
    const syl = syllables(text);
    const str = String(text).trim();
    const ask = /[?？]$|มั้ย|ไหม|หรอ|เหรอ/.test(str.slice(-6));
    const shout = /!|!!/.test(str) || /ดดด|ออออ|กกก/.test(str);
    const pitch = (opts.pitch || 1) * (shout ? 1.12 : 1);
    let t = ctx.currentTime + 0.02;
    const pan = opts.pan || 0;
    syl.forEach((ch, i) => {
      const h = hashChar(ch);
      const last = i === syl.length - 1;
      let f = V.base * pitch * (V.steps ? V.steps[Math.floor(h * V.steps.length)] : 1 + (h - 0.5) * V.spread);
      if (last && ask) f *= 1.25;
      if (last && !ask && !V.steps) f *= 0.9;
      const dur = V.dur * (last ? 1.6 : 1) * (0.85 + h * 0.3);
      if (V.broken && Math.random() < V.broken) { // a dropped syllable: crackle instead of voice
        noise({ t, a: 0.002, rel: dur * 0.8, vol: V.vol * 0.9, filter: 'bandpass', f: rand(800, 4000), q: 2, pan, dest: bus });
      } else if (V.breath) {
        noise({ t, a: 0.02, hold: dur * 0.3, rel: dur, vol: V.vol * 2.5, filter: 'bandpass', f: V.formant * (0.8 + h * 0.4), q: V.q, pan, dest: bus });
      } else {
        const fl = ctx.createBiquadFilter();
        fl.type = 'peaking'; fl.frequency.value = V.formant * (0.8 + h * 0.5); fl.Q.value = V.q; fl.gain.value = 9;
        fl.connect(out(bus, pan));
        tone({ type: V.type, freq: [f * 1.06, f * (last && ask ? 1.18 : 0.96)], t, a: 0.006, hold: dur * 0.45, rel: dur * 0.55, vol: V.vol, vib: V.vib, vibRate: 18, dest: fl });
        tone({ type: 'sine', freq: f * 2, t, a: 0.006, rel: dur * 0.5, vol: V.vol * 0.25, dest: fl });
        if (!V.steps) noise({ t, a: 0.001, rel: 0.014, vol: V.vol * 0.35, filter: 'highpass', f: 4200, pan, dest: bus }); // consonant tick
      }
      t += dur + V.gap * (0.6 + h * 0.8);
      if (ch === ' ' || (i % 5 === 4 && !V.steps)) t += V.gap;
    });
    return t - ctx.currentTime;
  },
  stop() {
    if (voiceTimer && ctx) {
      const b = voiceTimer; voiceTimer = 0;
      b.gain.setTargetAtTime(0, ctx.currentTime, 0.02);
      setTimeout(() => { try { b.disconnect(); } catch {} }, 300);
    }
  },
};
