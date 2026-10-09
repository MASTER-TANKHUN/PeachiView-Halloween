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
    memes: {},              // secret Peachi pictures found around the house: id → timestamp
    counts: {},             // lifetime counters for achievements (screams, pops, fed, earned, …)
    inv: {},                // shop items: id → how many (permanent ones: 1)
    photos: [],             // the best photo of each night won: { url, caption, score } (≤ 12)
    scenes: {},             // cutscenes watched to the end: id → 1 (only those can be skipped with Enter)
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

// Another tab (an old one left open) must never wind progress back: every write first folds in what is
// already stored, so cleared nights, achievements, endings and finds only ever grow.
const UNION = ['achievements', 'endings', 'memes', 'scenes', 'tips'];
function merge(d, s) {
  if (!s || typeof s !== 'object') return;
  if (Array.isArray(s.nightsCleared)) for (const n of s.nightsCleared) if (!d.nightsCleared.includes(n)) d.nightsCleared.push(n);
  d.nightsCleared.sort();
  for (const k of UNION) if (s[k] && typeof s[k] === 'object') d[k] = { ...s[k], ...(d[k] || {}) };
  if (s.prologueSeen) d.prologueSeen = true;
}
function write() {
  try {
    let s = null; try { s = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { s = null; }
    merge(data, s);
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch { /* no storage */ }
}
// another tab saved: read it again next time
if (typeof window !== 'undefined') window.addEventListener('storage', (e) => { if (e.key === KEY || e.key === null) data = null; });

export const Save = {
  get data() { return data || (data = load()); },
  cleared(n) { return this.data.nightsCleared.includes(n); },
  clearNight(n) {
    if (!this.cleared(n)) this.data.nightsCleared.push(n);
    this.data.nightsCleared.sort();
    write();
  },
  /** Highest night the player may start: the one after the furthest night cleared. */
  get nextNight() { return Math.max(0, ...this.data.nightsCleared) + 1; },
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
  /** Mark a secret picture found. Returns true the first time. */
  findMeme(id) {
    if (this.data.memes[id]) return false;
    this.data.memes[id] = Date.now();
    write();
    return true;
  },
  addPhoto(p) {
    if (!p || !p.url) return;
    this.data.photos.push({ url: p.url, caption: p.caption, score: p.raw ?? p.score });
    while (this.data.photos.length > 12) this.data.photos.shift();
    write();
  },
  reset() { data = fresh(); try { localStorage.removeItem(KEY); } catch { /* no storage */ } write(); },
};
