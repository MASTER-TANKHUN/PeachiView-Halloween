// Player settings (saved in localStorage). Listeners get the whole settings object on every change.
const KEY = 'peachi.settings';
const DEFAULTS = {
  volume: 0.7,        // 0..1 (the audio module caps the real master level)
  sensitivity: 1,     // mouse look multiplier 0.4..2
  fov: 70,            // degrees
  quality: 'high',    // 'high' (bloom + shadows) | 'medium' (shadows, no bloom) | 'low' (neither)
  mic: true,          // ask for the mic to scream at ghosts (Space works either way)
  calm: false,        // fewer flashes / less screen shake
};
const listeners = new Set();
let data = { ...DEFAULTS };
try { data = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { /* private mode */ }

export const Settings = {
  get: () => data,
  set(patch) {
    data = { ...data, ...patch };
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* private mode */ }
    for (const f of listeners) f(data);
  },
  reset() { this.set({ ...DEFAULTS }); },
  onChange(f) { listeners.add(f); f(data); return () => listeners.delete(f); },
  DEFAULTS,
};
