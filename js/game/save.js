// Progress that survives between sessions: localStorage 'peachi.save'. Never throws (private mode,
// blocked storage): the game just forgets on reload.
const KEY = 'peachi.save';
const VERSION = 1;

function fresh() {
  return {
    v: VERSION,
    prologueSeen: false,
    nightsCleared: [],      // [1, 2, 3]
    money: 0,               // ฿ from super chats (shop, week 4)
    achievements: {},       // id → timestamp
    stats: { screams: 0, bans: 0, requests: 0, deaths: 0, nightsPlayed: 0 },
    endings: {},            // id → timestamp
  };
}

let data = null;

function load() {
  let d = null;
  try { d = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { d = null; }
  const f = fresh();
  if (!d || typeof d !== 'object') {
    d = f;
    try { if (localStorage.getItem('peachi.nightCleared')) d.nightsCleared = [1]; } catch { /* no storage */ }
  }
  for (const k of Object.keys(f)) if (d[k] === undefined) d[k] = f[k];
  d.stats = { ...f.stats, ...d.stats };
  d.v = VERSION;
  return d;
}

function write() {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* no storage */ }
}

export const Save = {
  get data() { return data || (data = load()); },
  cleared(n) { return this.data.nightsCleared.includes(n); },
  clearNight(n) {
    if (!this.cleared(n)) this.data.nightsCleared.push(n);
    this.data.nightsCleared.sort();
    write();
  },
  /** Highest night the player may start. */
  get nextNight() { let n = 1; while (this.cleared(n)) n++; return n; },
  set(patch) { Object.assign(this.data, patch); write(); },
  addStats(patch) {
    const s = this.data.stats;
    for (const [k, v] of Object.entries(patch)) s[k] = (s[k] || 0) + v;
    write();
  },
  unlock(id) {
    if (this.data.achievements[id]) return false;
    this.data.achievements[id] = Date.now();
    write();
    return true;
  },
  reset() { data = fresh(); write(); },
};
