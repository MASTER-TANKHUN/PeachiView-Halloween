// DOM layer: title screen (play / how to play / settings / credits), pause, intro, end screens and the
// in-game stream HUD. Everything is built inside #hud. No emoji: small inline SVG icons, and Peachi's
// mood is shown with her own face art.
import { Settings } from './settings.js';

const MAX_CHAT = 12;
const SPAM_TTL_HINT = 8; // seconds (visual timer only; the rule lives in the game logic)
const FACE = (name) => new URL(`../assets/peachi/face_${name}.webp`, import.meta.url).href;

const MOODS = {
  happy: { label: 'อารมณ์ดี', face: 'happy' },
  cry: { label: 'เริ่มเหงา', face: 'cry' },
  angry: { label: 'โกรธแล้ว', face: 'angry' },
  scream: { label: 'กรี๊ด', face: 'scream' },
};

const ICON = {
  eye: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12z" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="2.6" fill="currentColor"/></svg>',
  light: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 9h9l3.5-3.5h4.5v13H16L12.5 15h-9z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M7 12h3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  mic: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  key: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="7" width="19" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M7 13.5h10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  chat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
};
const PEACH = '<svg class="peach-mark" viewBox="0 0 64 64" aria-hidden="true"><path d="M32 15c-9-6-25-2-25 16 0 14 11 25 25 25s25-11 25-25c0-18-16-22-25-16z" fill="#ffae98"/><path d="M32 17c-5 10-5 25 0 37" stroke="#e8708e" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M33.5 14c3-8 12-10 18-8-2 7-9 11-18 8z" fill="#7fcb8c"/></svg>';

let root = null;
let E = {};
const cbs = { start: [], retry: [], home: [], resume: [], next: [] };
let chatMsgs = []; // { el, type, t0, banned }
let viewers = { shown: 0, target: 0, from: 0, t0: 0 };
let subTimer = 0;
let subType = 0;
let currentScreen = null;
let menuPanel = null;       // open panel on the title screen
let pausePanel = null;      // open panel on the pause screen
let sound = () => {};       // UI blips (set by main once audio exists)
let dmDone = null;          // resolver of the phone-DM screen
let fadeTimer = 0;

function el(tag, cls, parent, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  if (parent) parent.appendChild(n);
  return n;
}
function html(tag, cls, parent, markup) { const n = el(tag, cls, parent); n.innerHTML = markup; return n; }
const pad = (n) => String(Math.max(0, Math.floor(n))).padStart(2, '0');
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const now = () => performance.now();
const fire = (k, ...a) => { for (const f of cbs[k]) f(...a); };

function clearedNight1() {
  try {
    const d = JSON.parse(localStorage.getItem('peachi.save') || 'null');
    return !!(d && Array.isArray(d.nightsCleared) && d.nightsCleared.includes(1)) || !!localStorage.getItem('peachi.nightCleared');
  } catch { return false; }
}
function restartAnim(node, cls) {
  node.classList.remove(cls);
  void node.offsetWidth;
  node.classList.add(cls);
}
function userColor(name) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.codePointAt(0)) >>> 0;
  return `hsl(${h % 360} 70% 74%)`;
}
function scTier(amount) {
  if (amount >= 500) return 'sc-t5';
  if (amount >= 200) return 'sc-t4';
  if (amount >= 100) return 'sc-t3';
  if (amount >= 50) return 'sc-t2';
  return 'sc-t1';
}

// ------------------------------------------------------------------ menu list with keyboard support
function menuList(parent, items, onPick) {
  const nav = el('nav', 'mlist', parent);
  const btns = items.map(([id, label, hint], i) => {
    const b = el('button', 'mitem', nav);
    b.type = 'button'; b.dataset.id = id;
    el('span', 'mitem-bar', b);
    el('span', 'mitem-label', b, label);
    if (hint) el('span', 'mitem-hint', b, hint);
    b.addEventListener('mouseenter', () => focus(i));
    b.addEventListener('click', () => { b.blur(); sound('select'); onPick(id); });
    return b;
  });
  let cur = 0;
  function focus(i, silent) {
    i = (i + btns.length) % btns.length;
    if (i !== cur && !silent) sound('move');
    cur = i;
    btns.forEach((b, k) => b.classList.toggle('on', k === cur));
  }
  focus(0, true);
  return { nav, btns, focus, move: (d) => focus(cur + d), pick: () => { sound('select'); onPick(btns[cur].dataset.id); }, reset: () => focus(0, true) };
}

// ------------------------------------------------------------------ settings form (shared by title + pause)
function buildSettings(parent) {
  const form = el('div', 'sform', parent);
  const s = Settings.get();
  const row = (label, note) => { const r = el('div', 'srow', form); const l = el('div', 'slab', r); el('div', 'sname', l, label); if (note) el('div', 'snote', l, note); return el('div', 'sctl', r); };
  const slider = (label, key, min, max, step, show, note) => {
    const c = row(label, note);
    const inp = el('input', 'srange', c); inp.type = 'range'; inp.min = min; inp.max = max; inp.step = step; inp.value = s[key];
    const out = el('span', 'sval', c, show(+inp.value));
    const paint = () => inp.style.setProperty('--p', `${((inp.value - min) / (max - min)) * 100}%`);
    paint();
    inp.addEventListener('input', () => { out.textContent = show(+inp.value); paint(); Settings.set({ [key]: +inp.value }); });
    return inp;
  };
  const choice = (label, key, opts, note) => {
    const c = row(label, note), seg = el('div', 'sseg', c);
    const bs = opts.map(([v, t]) => { const b = el('button', 'sopt', seg, t); b.type = 'button'; b.addEventListener('click', () => { sound('move'); Settings.set({ [key]: v }); bs.forEach((x) => x.classList.toggle('on', x === b)); }); b.classList.toggle('on', s[key] === v); return b; });
  };
  slider('ระดับเสียง', 'volume', 0, 1, 0.05, (v) => `${Math.round(v * 100)}`);
  slider('ความไวเมาส์', 'sensitivity', 0.4, 2, 0.05, (v) => v.toFixed(2));
  slider('มุมกล้อง', 'fov', 60, 90, 1, (v) => `${v}°`);
  choice('คุณภาพภาพ', 'quality', [['high', 'สูง'], ['medium', 'กลาง'], ['low', 'ต่ำ']], 'ต่ำ = ปิดเงาและแสงฟุ้ง เหมาะกับเครื่องที่ไม่แรง');
  choice('กรี๊ดใส่ไมค์', 'mic', [[true, 'ใช้'], [false, 'ไม่ใช้']], 'ไม่ใช้ไมค์ก็กด Space รัวๆ แทนได้');
  choice('ลดแสงวาบและจอสั่น', 'calm', [[false, 'ปกติ'], [true, 'ลด']]);
  return form;
}
function buildHowto(parent) {
  el('p', 'ptext', parent, 'คืนก่อนฮาโลวีน พีชชี่เปิดไลฟ์มาราธอนแล้วเผลอหลับ บอทมอดของเธอไม่ยอมให้ไลฟ์จบ จนเธอกลายเป็นผีติดอยู่ในไลฟ์ของตัวเอง คุณคือมอดมือใหม่ที่ถูกเรียกมาตอนเที่ยงคืน');
  el('p', 'ptext', parent, 'หาหูฟังหูแมวที่หายไปในบ้าน แล้วเอาไปวางคืนที่โต๊ะสตรีมก่อนหกโมงเช้า พีชชี่จะขอโน่นขอนี่เป็นระยะ ทำให้ทันเธอจะอารมณ์ดี ถ้าปล่อยให้เหงานานๆ เธอจะโกรธและไล่ตามคุณ');
  const grid = el('div', 'keys', parent);
  for (const [k, v] of [['W A S D', 'เดิน'], ['Shift', 'วิ่ง'], ['เมาส์', 'มองรอบๆ'], ['E', 'หยิบ / ประตู / สวิตช์ / ซ่อน'], ['F', 'ไฟฉาย (แบตหมดได้)'], ['Space รัวๆ', 'กรี๊ดไล่ผี'], ['Space ค้าง', 'กลั้นหายใจตอนซ่อน'], ['Q', 'แบนแชตผี'], ['Tab', 'มือถือ: ภารกิจ / รายงาน / แผนที่'], ['C / คลิกขวา', 'ยกกล้องถ่ายรูป'], ['R ค้าง', 'ซ่อนลูกพีชทองในเสื้อ'], ['Esc', 'พักเกม']]) {
    const r = el('div', 'krow', grid); el('kbd', null, r, k); el('span', null, r, v);
  }
  el('p', 'pnote', parent, 'ถ้าอนุญาตไมค์ ตะโกนใส่ไมค์ได้เลย ระยะไม่เกิน 7 เมตร พีชชี่จะชะงักและถอยไป แต่ตอนซ่อนต้องเงียบนะ ส่องไฟฉายใส่ตอนเธอโกรธจะช่วยให้เธอช้าลง แนะนำให้ใส่หูฟัง');
}
function buildCredits(parent) {
  const sec = (h, lines) => { el('div', 'chead', parent, h); for (const l of lines) el('div', 'cline', parent, l); };
  const by = el('div', 'cby', parent);
  el('div', 'cby-label', by, 'ทำโดย');
  el('div', 'cby-name', by, 'Master Tankhun');
  el('div', 'cby-sub', by, 'Master Tankhun | Tankhun Gaming');
  sec('ตัวละคร', ['PeachiView  —  youtube.com/@PeachiView249']);
  sec('เกมนี้', ['แฟนเกมที่ทำขึ้นเพื่อฉลองฮาโลวีน ไม่ใช่ผลงานทางการของช่อง', 'โมเดล ฉาก และเสียงทั้งหมดสร้างด้วยโค้ด', 'รูปลับพีชชี่ในบ้าน: รูปที่แจกให้แฟนใช้ฟรี']);
  sec('เครื่องมือ', ['three.js', 'ฟอนต์ Kanit, Mitr และ Sriracha (SIL Open Font License)', 'เสียงสังเคราะห์ด้วย Web Audio']);
  sec('ขอบคุณ', ['ลูกพีชน้อยทุกคน', 'มอดทุกคนที่ทำงานฟรี']);
  el('p', 'pnote', parent, 'แฟนเกมไม่เป็นทางการ ภาพลักษณ์ตัวละครเป็นของ PeachiView');
}

// ------------------------------------------------------------------ screens
function buildMenu() {
  // the menu itself lives in the 3D room (sticky notes, see menu.js); this layer only adds the footer
  // and the notebook page that opens for how-to / settings / credits
  const s = el('div', 'screen screen-menu');
  el('div', 'menu-shade', s);
  const foot = el('div', 'menu-foot', s);
  const left = el('span', 'menu-foot-l', foot);
  el('span', null, left, 'แฟนเกมไม่เป็นทางการ');
  E.menuCleared = el('span', 'menu-cleared', left, 'ผ่านคืนที่ 1 แล้ว');
  E.menuCleared.hidden = true;
  const keys = el('span', 'menu-keys', foot);
  el('span', null, keys, 'เลือกโน้ตบนผนัง');
  el('kbd', null, keys, '← →'); el('kbd', null, keys, 'Enter');
  E.menuSheet = buildSheet(s, 'menu', { howto: ['วิธีเล่น', buildHowto], settings: ['ตั้งค่า', buildSettings], credits: ['เครดิต', buildCredits] });
  s.addEventListener('click', (e) => { if (menuPanel && !e.target.closest('.sheet')) { e.stopPropagation(); sound('back'); closePanel('menu'); } });
  return s;
}
function buildSheet(parent, owner, panels) {
  const sheet = el('aside', 'sheet', parent);
  const inner = el('div', 'sheet-in', sheet);
  const head = el('div', 'sheet-head', inner);
  const title = el('h2', 'sheet-title', head);
  const close = el('button', 'sheet-close', head, 'กลับ');
  close.type = 'button';
  close.addEventListener('click', () => { sound('back'); closePanel(owner); });
  const body = el('div', 'sheet-body', inner);
  const nodes = {};
  for (const [id, [t, fn]] of Object.entries(panels)) { const n = el('div', 'panel-' + id, body); fn(n); n.hidden = true; nodes[id] = { node: n, title: t }; }
  return { sheet, title, nodes };
}
function openPanel(owner, id) {
  const sh = owner === 'menu' ? E.menuSheet : E.pauseSheet;
  for (const [k, v] of Object.entries(sh.nodes)) v.node.hidden = k !== id;
  sh.title.textContent = sh.nodes[id].title;
  sh.sheet.classList.add('open');
  sh.sheet.parentElement.classList.add('panel-open');
  if (owner === 'menu') menuPanel = id; else pausePanel = id;
}
function closePanel(owner) {
  const sh = owner === 'menu' ? E.menuSheet : E.pauseSheet;
  sh.sheet.classList.remove('open');
  sh.sheet.parentElement.classList.remove('panel-open');
  if (owner === 'menu') menuPanel = null; else pausePanel = null;
}

function buildPause() {
  const s = el('div', 'screen screen-pause');
  const card = el('div', 'paper pause-card', s);
  el('h2', 'paper-title', card, 'พักเกม');
  el('p', 'paper-sub', card, 'ไลฟ์ยังเดินอยู่ คนดูรออยู่นะ');
  E.pauseList = menuList(card, [['resume', 'เล่นต่อ'], ['settings', 'ตั้งค่า'], ['howto', 'วิธีเล่น'], ['home', 'กลับหน้าแรก']], (id) => {
    if (id === 'resume') fire('resume');
    else if (id === 'home') fire('home');
    else openPanel('pause', id);
  });
  E.pauseSheet = buildSheet(s, 'pause', { settings: ['ตั้งค่า', buildSettings], howto: ['วิธีเล่น', buildHowto] });
  return s;
}
function buildIntro() {
  const s = el('div', 'screen screen-intro');
  E.introDate = el('div', 'intro-date', s, '');
  E.introClock = el('div', 'intro-clock tnum', s, '00:00');
  E.introTitle = el('div', 'intro-title', s, 'คืนที่ 1');
  E.introText = el('div', 'intro-text', s, '');
  E.introStory = el('div', 'intro-story', s);
  return s;
}
function buildDM() {
  // the prologue opens on a phone: a DM from Peachi's account, 23:58
  const s = el('div', 'screen screen-dm');
  const phone = el('div', 'phone', s);
  const bar = el('div', 'phone-bar', phone);
  E.dmTime = el('span', 'tnum', bar, '23:58');
  el('span', null, bar, '5G  ▮▮▮');
  const head = el('div', 'phone-head', phone);
  el('div', 'phone-ava', head);
  const hn = el('div', 'phone-hn', head);
  E.dmName = el('div', 'phone-name', hn, 'PeachiView');
  el('div', 'phone-status', hn, 'กำลังไลฟ์อยู่');
  E.dmList = el('div', 'phone-list', phone);
  E.dmActions = el('div', 'phone-actions', s);
  return s;
}
function buildHideOverlay(parent) {
  const h = el('div', 'hide', parent);
  el('div', 'hide-slit', h);
  const b = el('div', 'hide-ui', h);
  E.hideHint = el('div', 'hide-hint', b, '');
  const bar = el('div', 'hide-bar', b);
  E.hideFill = el('div', 'hide-fill', bar);
  el('div', 'hide-label', b, 'ลมหายใจ');
  E.hide = h;
  return h;
}
function buildKeyhole(parent) {
  const k = html('div', 'keyhole', parent, `<svg viewBox="0 0 400 400" aria-hidden="true">
    <defs><radialGradient id="kh-iris" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#1a0c06"/><stop offset=".35" stop-color="#6b3a1a"/><stop offset=".8" stop-color="#b4702c"/><stop offset="1" stop-color="#3a1a0a"/></radialGradient>
    <radialGradient id="kh-white" cx="50%" cy="45%" r="60%"><stop offset="0" stop-color="#f4ece4"/><stop offset=".75" stop-color="#d8c4bc"/><stop offset="1" stop-color="#8a5a5a"/></radialGradient>
    <clipPath id="kh-clip"><circle cx="200" cy="150" r="80"/><path d="M160 190 L240 190 L275 360 L125 360 Z"/></clipPath></defs>
    <g clip-path="url(#kh-clip)"><rect width="400" height="400" fill="#120406"/>
    <ellipse class="kh-eye" cx="200" cy="175" rx="150" ry="95" fill="url(#kh-white)"/>
    <path d="M60 170 C 110 150 130 190 170 176 M250 190 C 290 200 300 160 350 180 M120 230 C 150 215 170 240 190 226" stroke="#b02a2a" stroke-width="2" fill="none" opacity=".7"/>
    <circle class="kh-iris" cx="200" cy="172" r="58" fill="url(#kh-iris)"/><circle class="kh-iris" cx="200" cy="172" r="24" fill="#050202"/>
    <circle cx="182" cy="152" r="9" fill="#fff" opacity=".85"/>
    <g class="kh-man"><rect width="400" height="400" fill="#0a0406"/><ellipse cx="200" cy="80" rx="150" ry="70" fill="#ff8cbf"/>
    <ellipse cx="200" cy="200" rx="110" ry="140" fill="#e8dccc"/><path d="M60 110 C 90 60 310 60 340 110 L 330 190 C 300 120 100 120 70 190 Z" fill="#ff8cbf"/>
    <ellipse cx="160" cy="205" rx="20" ry="11" fill="#2a1a1a"/><ellipse cx="240" cy="205" rx="20" ry="11" fill="#2a1a1a"/>
    <path d="M175 290 Q 200 300 225 290" stroke="#a08a80" stroke-width="4" fill="none"/></g></g></svg>`);
  E.keyhole = k;
  return k;
}
function buildEnd(kind) {
  const s = el('div', `screen screen-end screen-${kind}`);
  el('div', 'end-shade', s);
  const card = el('div', 'paper end-card', s);
  const stamp = el('div', 'stamp', card, kind === 'win' ? 'รอดแล้ว' : 'ไลฟ์จบ');
  const title = el('h2', 'paper-title', card, '');
  const text = el('p', 'paper-text', card, '');
  const stats = el('div', 'end-stats', card);
  const E2 = (E[kind] = { title, text, stamp, stats, card, list: null });
  E2.build = (next, retry) => {
    if (E2.list) E2.list.nav.remove();
    const items = [];
    if (next) items.push(['next', next]);
    items.push(['retry', retry || (kind === 'win' ? 'เล่นอีกครั้ง' : 'ลองอีกครั้ง')], ['home', 'กลับหน้าแรก']);
    E2.list = menuList(card, items, (id) => fire(id));
  };
  E2.build(null, null);
  return s;
}

// ------------------------------------------------------------------ HUD
function buildHud(parent) {
  const hud = el('div', 'hud-play', parent);
  // top-left: clock + mood
  const tl = el('div', 'hud-tl', hud);
  const clock = el('div', 'clock', tl);
  const ct = el('div', 'clock-row', clock);
  E.clock = el('span', 'clock-time tnum', ct, '00:00');
  el('span', 'clock-ampm', ct, 'AM');
  E.night = el('div', 'clock-night', clock, 'คืนที่ 1');
  const mood = (E.mood = el('div', 'mood mood-happy', tl));
  E.moodFace = el('div', 'mood-face', mood);
  E.moodFace.style.backgroundImage = `url(${FACE('happy')})`;
  const mt = el('div', 'mood-txt', mood);
  el('div', 'mood-name', mt, 'พีชชี่');
  E.moodLabel = el('div', 'mood-label', mt, MOODS.happy.label);
  E.hunger = el('div', 'hunger', tl);
  el('span', null, E.hunger, 'ผีปอบหิว');
  const hb = el('div', 'hunger-bar', E.hunger);
  E.hungerFill = el('div', 'hunger-fill', hb);
  // top-center: objective + toasts
  const tc = el('div', 'hud-tc', hud);
  E.objective = el('div', 'objective', tc);
  el('span', 'obj-tag', E.objective, 'ภารกิจ');
  E.objText = el('span', 'obj-text', E.objective, '');
  E.objective.hidden = true;
  E.req = el('div', 'req', tc);
  E.reqWho = el('span', 'req-who', E.req, 'พีชชี่ขอ');
  E.reqText = el('span', 'req-text', E.req, '');
  E.reqTime = el('span', 'req-time tnum', E.req, '');
  E.reqBar = el('div', 'req-bar', E.req);
  E.reqFill = el('div', 'req-fill', E.reqBar);
  E.req.hidden = true;
  E.toasts = el('div', 'toasts', tc);
  // top-right: live + viewers, chat
  const tr = el('div', 'hud-tr', hud);
  const live = el('div', 'live-row', tr);
  el('span', 'live-badge', live, 'LIVE');
  const vw = el('span', 'viewers', live);
  html('span', 'ico', vw, ICON.eye);
  E.viewers = el('span', 'viewers-n tnum', vw, '0');
  E.viewersDelta = el('span', 'viewers-deltas', vw);
  E.uptime = el('div', 'uptime tnum', tr, '');
  const chat = el('div', 'chat', tr);
  const ch = el('div', 'chat-head', chat);
  html('span', 'ico', ch, ICON.chat);
  el('span', 'chat-title', ch, 'แชตสด');
  E.spamCount = el('span', 'chat-spamcount', ch, '');
  E.chatList = el('div', 'chat-list', chat);
  const cf = el('div', 'chat-foot', chat);
  el('kbd', null, cf, 'Q'); el('span', null, cf, 'แบนแชตผี');
  // bottom-left: flashlight + scream meters
  const bl = el('div', 'hud-bl', hud);
  const meter = (cls, icon, name) => {
    const m = el('div', `meter ${cls}`, bl);
    const top = el('div', 'meter-head', m);
    const ic = html('span', 'ico', top, icon);
    const nm = el('span', 'meter-name', top, name);
    const val = el('span', 'meter-val tnum', top, '');
    const bar = el('div', 'bar', m);
    const fill = el('div', 'bar-fill', bar);
    return { m, ic, nm, val, bar, fill };
  };
  const bat = meter('battery', ICON.light, 'ไฟฉาย  F');
  E.bat = bat; E.batFill = bat.fill; E.batPct = bat.val;
  const scr = meter('scream', ICON.key, 'Space รัวๆ');
  E.scr = scr; E.scrFill = scr.fill; E.scrVal = scr.val; E.scrName = scr.nm; E.scrIcon = scr.ic; E.scream = scr.m;
  E.scrThresh = el('div', 'bar-thresh', scr.bar);
  E.inv = el('div', 'inv', hud);
  // center
  el('div', 'crosshair', hud);
  E.prompt = el('div', 'prompt', hud);
  E.prompt.hidden = true;
  E.subtitle = el('div', 'subtitle', hud);
  E.subtitle.hidden = true;
  return hud;
}

function build() {
  root = el('div', 'pv-root');
  root.dataset.screen = 'none';
  E.vignette = el('div', 'fx-vignette', root);
  buildHideOverlay(root);
  E.flash = el('div', 'fx-flash', root);
  E.hud = buildHud(root);
  E.bars = el('div', 'fx-bars', root);
  el('div', 'fx-bar top', E.bars); el('div', 'fx-bar bottom', E.bars);
  E.skip = el('div', 'fx-skip', root);
  el('kbd', null, E.skip, 'Enter'); el('span', null, E.skip, 'ข้าม');
  buildKeyhole(root);
  E.black = el('div', 'fx-black', root);
  E.screens = { menu: buildMenu(), pause: buildPause(), intro: buildIntro(), dm: buildDM(), gameover: buildEnd('gameover'), win: buildEnd('win') };
  for (const s of Object.values(E.screens)) root.appendChild(s);
  return root;
}

// keyboard navigation for whichever list is on screen
let menuKeys = null, menuBusy = false;
let lastClock = [0, 0];
function onKey(e) {
  const scr = currentScreen;
  if (scr === 'menu') {
    if (menuPanel) { if (e.code === 'Escape') { e.preventDefault(); sound('back'); closePanel('menu'); } return; }
    if (!menuKeys || menuBusy) return;
    if (['ArrowRight', 'ArrowDown', 'KeyD', 'KeyS'].includes(e.code)) { e.preventDefault(); menuKeys.move(1); } else if (['ArrowLeft', 'ArrowUp', 'KeyA', 'KeyW'].includes(e.code)) { e.preventDefault(); menuKeys.move(-1); } else if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space') { e.preventDefault(); menuKeys.pick(); }
    return;
  }
  const list = scr === 'pause' ? E.pauseList : scr === 'gameover' ? E.gameover.list : scr === 'win' ? E.win.list : scr === 'dm' ? E.dmMenu : null;
  if (!list) return;
  const panelOpen = (scr === 'menu' && menuPanel) || (scr === 'pause' && pausePanel);
  if (e.code === 'Escape') {
    if (panelOpen) { e.preventDefault(); sound('back'); closePanel(scr === 'menu' ? 'menu' : 'pause'); }
    return;
  }
  if (panelOpen) return;
  if (e.code === 'ArrowDown' || e.code === 'KeyS') { e.preventDefault(); list.move(1); } else if (e.code === 'ArrowUp' || e.code === 'KeyW') { e.preventDefault(); list.move(-1); } else if (e.code === 'Enter' || e.code === 'NumpadEnter') { e.preventDefault(); list.pick(); }
}

// ------------------------------------------------------------------ viewer tween
function loop() {
  requestAnimationFrame(loop);
  if (!root) return;
  if (viewers.shown !== viewers.target) {
    const k = Math.min(1, (now() - viewers.t0) / 600);
    const e = 1 - Math.pow(1 - k, 3);
    viewers.shown = k >= 1 ? viewers.target : viewers.from + (viewers.target - viewers.from) * e;
    E.viewers.textContent = fmt(viewers.shown);
  }
}
function updateSpamCount() {
  const n = chatMsgs.filter((m) => m.type === 'spam' && !m.banned).length;
  E.spamCount.textContent = n ? `แชตผี ${n}` : '';
  E.spamCount.classList.toggle('on', n > 0);
}
function removeMsg(m) {
  const i = chatMsgs.indexOf(m);
  if (i >= 0) chatMsgs.splice(i, 1);
  m.el.remove();
}
function trimChat() {
  let visible = chatMsgs.filter((m) => !m.banned).length;
  while (visible > MAX_CHAT) {
    const old = chatMsgs.find((m) => m.type !== 'spam' && !m.banned);
    if (!old) break;
    removeMsg(old);
    visible--;
  }
}

export const UI = {
  init() {
    if (root) return;
    const host = document.getElementById('hud') || document.body;
    host.appendChild(build());
    E.menuCleared.hidden = !clearedNight1();
    window.addEventListener('keydown', onKey);
    requestAnimationFrame(loop);
    this.showScreen('menu');
  },

  onStart(cb) { if (typeof cb === 'function') cbs.start.push(cb); },
  onRetry(cb) { if (typeof cb === 'function') cbs.retry.push(cb); },
  onHome(cb) { if (typeof cb === 'function') cbs.home.push(cb); },
  onResume(cb) { if (typeof cb === 'function') cbs.resume.push(cb); },
  onNext(cb) { if (typeof cb === 'function') cbs.next.push(cb); },
  /** Title-screen hooks (the 3D sticky-note menu drives these). */
  setMenuKeys(h) { menuKeys = h; },
  setMenuBusy(v) { menuBusy = !!v; },
  openMenuPanel(id) { openPanel('menu', id); },
  menuPanelOpen() { return !!menuPanel; },
  requestStart() { fire('start'); },
  /** fn(kind) plays a UI sound: 'move' | 'select' | 'back' */
  setSound(fn) { sound = typeof fn === 'function' ? fn : () => {}; },
  get screen() { return currentScreen; },
  /** Add a system's own overlay (breaker QTE, phone, …) to the UI root. */
  mount(node) { (root || document.body).appendChild(node); return node; },

  showScreen(name, data = {}) {
    if (!root) return;
    data = data || {};
    const prev = currentScreen;
    currentScreen = name;
    root.dataset.screen = name;
    for (const [k, s] of Object.entries(E.screens)) {
      const on = k === name;
      s.classList.toggle('show', on);
      if (on && prev !== name) restartAnim(s, 'enter');
    }
    if (document.activeElement && root.contains(document.activeElement)) document.activeElement.blur();
    if (name === 'menu') {
      closePanel('menu'); menuBusy = false;
      E.menuCleared.hidden = !clearedNight1();
    } else if (name === 'pause') {
      closePanel('pause'); E.pauseList.reset();
    } else if (name === 'intro') {
      E.introTitle.textContent = data.title || 'คืนที่ 1';
      E.introClock.textContent = data.clock || '00:00';
      E.introText.textContent = data.text || '';
      E.introDate.textContent = data.date || '';
      E.introStory.replaceChildren();
      (data.story || []).forEach((line, i) => { const l = el('div', 'intro-line', E.introStory, line); l.style.animationDelay = `${0.9 + i * 1.5}s`; });
    } else if (name === 'gameover' || name === 'win') {
      const d = E[name];
      d.title.textContent = data.title || (name === 'win' ? 'รอดคืนที่ 1' : 'ไลฟ์จบแล้ว');
      d.text.textContent = data.text || '';
      d.stamp.textContent = data.stamp || (name === 'win' ? 'รอดแล้ว' : 'ไลฟ์จบ');
      d.build(data.next || null, data.retry || null);
      d.stats.replaceChildren();
      for (const [k, v] of data.stats || []) { const r = el('div', 'end-stat', d.stats); el('span', null, r, k); el('b', 'tnum', r, String(v)); }
      d.list.reset();
    }
    if (name !== 'play') this.setPrompt(null);
  },

  /**
   * Phone DM (prologue). messages: [{ from: 'them'|'me'|'sys', text, delay }], actions: [[id, label], …].
   * Resolves with the chosen action id.
   */
  showDM({ name = 'PeachiView', time = '23:58', messages = [], actions = [['go', 'ไปบ้านพีชชี่']] } = {}) {
    if (!root) return Promise.resolve(actions[0][0]);
    this.showScreen('dm');
    E.dmName.textContent = name; E.dmTime.textContent = time;
    E.dmList.replaceChildren(); E.dmActions.replaceChildren();
    return new Promise((resolve) => {
      let t = 400;
      for (const m of messages) {
        t += m.delay ?? 900;
        setTimeout(() => {
          if (currentScreen !== 'dm') return;
          el('div', `bubble bubble-${m.from || 'them'}${m.glitch ? ' bubble-glitch' : ''}`, E.dmList, m.text);
          E.dmList.scrollTop = E.dmList.scrollHeight;
          if (m.from !== 'me') sound('dm');
        }, t);
      }
      setTimeout(() => {
        if (currentScreen !== 'dm') return;
        const card = el('div', 'dm-card', E.dmActions);
        E.dmMenu = menuList(card, actions, (id) => { E.dmMenu = null; resolve(id); });
      }, t + 700);
    });
  },

  /** Hide overlay: null to remove, or { slit: 'h'|'v', breath: 0..1, hint, danger } */
  setHide(st) {
    if (!root) return;
    if (!st) { E.hide.classList.remove('on', 'danger', 'slit-h', 'slit-v'); return; }
    E.hide.classList.add('on');
    E.hide.classList.toggle('slit-h', st.slit === 'h');
    E.hide.classList.toggle('slit-v', st.slit !== 'h');
    E.hide.classList.toggle('danger', !!st.danger);
    E.hideFill.style.width = `${Math.round(Math.max(0, Math.min(1, st.breath ?? 1)) * 100)}%`;
    if (E.hideHint.textContent !== (st.hint || '')) E.hideHint.textContent = st.hint || '';
  },

  /** Peek through the locked door's keyhole: an eye looks back ('eye'), or the mannequin has turned ('mannequin'). */
  keyhole(ms = 1600, variant = 'eye') {
    if (!root) return;
    E.keyhole.classList.toggle('mannequin', variant === 'mannequin');
    restartAnim(E.keyhole, 'on');
    clearTimeout(E.keyhole._t);
    E.keyhole._t = setTimeout(() => E.keyhole.classList.remove('on'), ms);
  },

  /** Black overlay: v 0..1 over ms. Resolves when done. */
  fade(v, ms = 600) {
    if (!root) return Promise.resolve();
    E.black.style.transitionDuration = `${ms}ms`;
    E.black.style.opacity = String(v);
    clearTimeout(fadeTimer);
    return new Promise((r) => { fadeTimer = setTimeout(r, ms); });
  },
  letterbox(on) { if (root) root.classList.toggle('cine', !!on); },
  skipHint(on) { if (root) E.skip.classList.toggle('on', !!on); },
  /** 'full' | 'prologue' (clock, objective and toasts only) | 'cine' (nothing) */
  setHudMode(mode) { if (root) root.dataset.hud = mode || 'full'; },
  setNight(label) { if (root) E.night.textContent = label; },
  setUptime(sec) {
    if (!root) return;
    if (sec == null) { E.uptime.textContent = ''; return; }
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), x = Math.floor(sec % 60);
    const txt = `ไลฟ์มาแล้ว ${h}:${pad(m)}:${pad(x)}`;
    if (E.uptime.textContent !== txt) E.uptime.textContent = txt;
  },
  /** Peachi's current request: null, or { text, left (s), frac (0..1 progress), hint } */
  setRequest(r) {
    if (!root) return;
    if (!r) { if (!E.req.hidden) { E.req.hidden = true; E.req._t = null; } return; }
    if (E.req.hidden || E.req._t !== r.text) { E.req._t = r.text; E.reqText.textContent = r.text; E.req.hidden = false; restartAnim(E.req, 'pop'); }
    const left = Math.max(0, Math.ceil(r.left || 0));
    E.reqTime.textContent = `${Math.floor(left / 60)}:${pad(left % 60)}`;
    E.req.classList.toggle('urgent', left <= 10);
    E.reqFill.style.width = `${Math.round(Math.max(0, Math.min(1, r.frac || 0)) * 100)}%`;
    E.reqBar.hidden = !(r.frac > 0);
  },

  /** Phi Pop's hunger 0..100 under the mood (null hides it). */
  setHunger(v) {
    if (!root) return;
    const on = v != null;
    if (E.hunger.classList.contains('on') !== on) E.hunger.classList.toggle('on', on);
    if (on) E.hungerFill.style.width = `${Math.round(Math.max(0, Math.min(100, v)))}%`;
  },
  /** What you carry: [{ icon, label }] (bottom right). */
  setInventory(items) {
    if (!root) return;
    const key = (items || []).map((i) => i.icon + i.label).join('|');
    if (E.inv._k === key) return;
    E.inv._k = key;
    E.inv.replaceChildren();
    for (const it of items || []) { const d = el('div', 'inv-item', E.inv); el('b', null, d, it.icon); el('span', null, d, it.label); }
  },
  /** [hour, minute] last shown on the HUD clock (the phone shows it too). */
  clockText() { return lastClock; },

  /** Krasue licked the camera: green slime over everything, fading after ms. */
  slime(ms = 10000) {
    if (!root) return;
    if (!E.slime) {
      E.slime = html('div', 'slime', root, `<svg viewBox="0 0 1600 900" preserveAspectRatio="none" aria-hidden="true"><defs>
        <radialGradient id="sl-g" cx="50%" cy="40%" r="70%"><stop offset="0" stop-color="#9aff7a" stop-opacity=".55"/><stop offset=".6" stop-color="#4ad86a" stop-opacity=".7"/><stop offset="1" stop-color="#1a6a2a" stop-opacity=".85"/></radialGradient></defs>
        <path fill="url(#sl-g)" d="M0 0 H1600 V120 C1500 140 1480 330 1440 340 C1400 350 1390 200 1330 190 C1260 180 1250 460 1200 470 C1150 480 1150 230 1080 220 C1000 210 990 380 930 385 C870 390 880 180 800 170 C720 160 720 520 660 530 C600 540 610 240 540 230 C470 220 470 360 410 360 C350 360 360 150 290 150 C220 150 230 420 170 430 C110 440 120 200 60 190 C30 185 10 220 0 230 Z"/>
        <path fill="url(#sl-g)" opacity=".7" d="M0 900 V760 C120 740 160 820 260 810 C360 800 380 700 480 720 C580 740 600 860 720 850 C840 840 860 740 980 760 C1100 780 1120 870 1240 860 C1360 850 1400 760 1600 780 V900 Z"/>
        <g fill="#c8ff9a" opacity=".5"><ellipse cx="300" cy="80" rx="60" ry="14"/><ellipse cx="900" cy="60" rx="90" ry="16"/><ellipse cx="1350" cy="90" rx="50" ry="10"/><circle cx="700" cy="420" r="10"/><circle cx="1180" cy="400" r="7"/></g></svg>`);
    }
    restartAnim(E.slime, 'on');
    clearTimeout(E.slime._t);
    E.slime._t = setTimeout(() => E.slime.classList.remove('on'), ms);
  },

  /** A paper note in the middle of the screen: { title, lines: [[text, cls]], ms } */
  sticker({ title = '', lines = [], ms = 4200 } = {}) {
    if (!root) return;
    if (!E.sticker) E.sticker = el('div', 'sticker', root);
    E.sticker.replaceChildren();
    if (title) el('b', null, E.sticker, title);
    for (const [t, cls] of lines) el('div', cls || null, E.sticker, t);
    restartAnim(E.sticker, 'on');
    clearTimeout(E.sticker._t);
    E.sticker._t = setTimeout(() => E.sticker.classList.remove('on'), ms);
  },

  setClock(hour, minute = 0) {
    if (!root) return;
    lastClock = [hour, minute];
    const txt = `${pad(hour)}:${pad(minute)}`;
    if (E.clock.textContent !== txt) {
      E.clock.textContent = txt;
      E.clock.closest('.clock').classList.toggle('dawn', hour >= 5 && hour < 12);
      E.clock.nextSibling.textContent = hour < 12 ? 'AM' : '';
    }
  },

  setViewers(n) {
    if (!root) return;
    n = Math.max(0, Math.round(Number(n) || 0));
    const prev = viewers.target;
    if (n === prev) return;
    viewers.from = viewers.shown; viewers.target = n; viewers.t0 = now();
    const vw = E.viewers.parentElement;
    const cls = n > prev ? 'up' : 'down';
    vw.classList.remove('up', 'down'); void vw.offsetWidth; vw.classList.add(cls);
    clearTimeout(vw._t);
    vw._t = setTimeout(() => vw.classList.remove('up', 'down'), 900);
    vw.classList.toggle('danger', n > 0 && n < 50);
    if (prev !== 0 || currentScreen === 'play') {
      const d = el('span', `vdelta ${cls}`, E.viewersDelta, `${n > prev ? '+' : '−'}${fmt(Math.abs(n - prev))}`);
      setTimeout(() => d.remove(), 1200);
    }
  },

  setBattery(pct) {
    if (!root) return;
    const p = Math.max(0, Math.min(100, Number(pct) || 0));
    E.batFill.style.width = `${p}%`;
    E.batPct.textContent = `${Math.ceil(p)}%`;
    const b = E.bat.m;
    b.classList.toggle('mid', p <= 50 && p > 20);
    b.classList.toggle('low', p <= 20 && p > 0);
    b.classList.toggle('empty', p <= 0);
  },

  setScreamMeter(v, cooldownSec = 0, usingMic = false) {
    if (!root) return;
    const x = Math.max(0, Math.min(1, Number(v) || 0));
    E.scrFill.style.width = `${x * 100}%`;
    if (E.scream._mic !== !!usingMic) {
      E.scream._mic = !!usingMic;
      E.scrName.textContent = usingMic ? 'ไมค์  ตะโกนเลย' : 'Space รัวๆ';
      E.scrIcon.innerHTML = usingMic ? ICON.mic : ICON.key;
    }
    const cd = cooldownSec > 0.05;
    E.scream.classList.toggle('cooldown', cd);
    E.scream.classList.toggle('hot', !cd && x >= (usingMic ? 0.5 : 0.75));
    E.scrVal.textContent = cd ? `พักเสียง ${cooldownSec.toFixed(1)} วิ` : 'พร้อม';
  },

  setMood(name) {
    if (!root) return;
    const key = MOODS[name] ? name : 'happy';
    if (E.mood.dataset.mood === key) return;
    E.mood.dataset.mood = key;
    E.mood.className = `mood mood-${key}`;
    E.moodFace.style.backgroundImage = `url(${FACE(MOODS[key].face)})`;
    E.moodLabel.textContent = MOODS[key].label;
    restartAnim(E.mood, 'pop');
  },

  setPrompt(text) {
    if (!root) return;
    if (!text) { E.prompt.hidden = true; E.prompt._txt = null; return; }
    if (E.prompt._txt === text && !E.prompt.hidden) return;
    E.prompt._txt = text;
    let key = 'E', label = String(text);
    const m = label.match(/^\s*\[([^\]]+)\]\s*(.*)$/);
    if (m) { key = m[1]; label = m[2]; }
    E.prompt.replaceChildren();
    el('kbd', null, E.prompt, key);
    el('span', null, E.prompt, label);
    E.prompt.hidden = false;
  },

  setObjective(text) {
    if (!root) return;
    if (!text) { E.objective.hidden = true; return; }
    const t = String(text).replace(/"/g, '');
    if (E.objText.textContent === t && !E.objective.hidden) return;
    E.objText.textContent = t;
    E.objective.hidden = false;
    restartAnim(E.objective, 'pulse');
  },

  toast(text) {
    if (!root) return;
    const t = el('div', 'toast', E.toasts, text);
    while (E.toasts.children.length > 3) E.toasts.firstChild.remove();
    setTimeout(() => t.classList.add('out'), 2600);
    setTimeout(() => t.remove(), 3100);
  },

  /** opts: { name = 'พีชชี่', cls } — cls styles the line ('bot', 'broken', 'her', 'me') */
  subtitle(text, ms = 3000, opts = {}) {
    if (!root) return;
    clearTimeout(subTimer); clearInterval(subType);
    if (!text) { E.subtitle.hidden = true; return; }
    E.subtitle.replaceChildren();
    E.subtitle.className = 'subtitle' + (opts.cls ? ' ' + opts.cls.split(' ').map((c) => 'sub-' + c).join(' ') : '');
    el('span', 'sub-name', E.subtitle, opts.name ?? 'พีชชี่');
    const body = el('span', 'sub-text', E.subtitle, '');
    E.subtitle.hidden = false;
    restartAnim(E.subtitle, 'in');
    const chars = Array.from(String(text));
    let i = 0;
    subType = setInterval(() => {
      i = Math.min(chars.length, i + 2);
      body.textContent = chars.slice(0, i).join('');
      if (i >= chars.length) clearInterval(subType);
    }, 22);
    subTimer = setTimeout(() => { E.subtitle.hidden = true; }, Math.max(800, ms));
  },

  chat: {
    /** type: 'normal' | 'spam' | 'superchat' | 'bot' (PeachiBot) | 'her' ("เธอ": looks like spam, can't be banned) */
    push({ user = '???', text = '', type = 'normal', amount = 0 } = {}) {
      if (!root) return null;
      const her = type === 'her';
      if (her) type = 'spam';
      const line = el('div', `chat-msg chat-${type}${her ? ' chat-her' : ''}`);
      if (type === 'superchat') {
        line.classList.add(scTier(amount));
        const head = el('div', 'sc-head', line);
        el('span', 'sc-user', head, user);
        el('span', 'sc-amount tnum', head, `฿${fmt(amount)}`);
        el('div', 'sc-text', line, text);
      } else {
        if (type === 'bot') html('span', 'chat-badge', line, 'บอท');
        const u = el('span', 'chat-user', line, user);
        if (type !== 'spam' && type !== 'bot') u.style.color = userColor(user);
        el('span', 'chat-text', line, text);
        if (type === 'spam') {
          const timer = el('div', 'spam-timer', line);
          timer.style.animationDuration = `${SPAM_TTL_HINT}s`;
        }
      }
      E.chatList.appendChild(line);
      const m = { el: line, type, t0: now(), banned: false, her, user, text };
      chatMsgs.push(m);
      trimChat();
      if (type === 'spam') updateSpamCount();
      E.chatList.scrollTop = E.chatList.scrollHeight;
      return line;
    },
    /** true = banned, 'refused' = it was "เธอ" (she comes right back), false = nothing to ban */
    banOldestSpam() {
      if (!root) return false;
      const m = chatMsgs.find((x) => x.type === 'spam' && !x.banned);
      if (!m) return false;
      if (m.her) {
        m.el.classList.add('refused');
        setTimeout(() => { removeMsg(m); updateSpamCount(); UI.chat.push({ user: m.user, text: 'แบนฉันไม่ได้หรอก', type: 'her' }); }, 650);
        m.banned = true;
        return 'refused';
      }
      m.banned = true;
      m.el.classList.add('banned');
      el('span', 'ban-stamp', m.el, 'แบนแล้ว');
      updateSpamCount();
      setTimeout(() => removeMsg(m), 700);
      return true;
    },
    spamAges() {
      const t = now();
      return chatMsgs.filter((m) => m.type === 'spam' && !m.banned && !m.her).map((m) => (t - m.t0) / 1000);
    },
    expireSpam(maxAge = SPAM_TTL_HINT) {
      const t = now();
      let n = 0;
      for (const m of chatMsgs.slice()) {
        if (m.type === 'spam' && !m.banned && !m.her && (t - m.t0) / 1000 > maxAge) {
          m.banned = true; m.el.classList.add('expired');
          setTimeout(() => removeMsg(m), 600);
          n++;
        }
      }
      if (n) updateSpamCount();
      return n;
    },
    clear() {
      for (const m of chatMsgs) m.el.remove();
      chatMsgs = [];
      if (root) updateSpamCount();
    },
  },

  flash(color = '#fff') {
    if (!root || Settings.get().calm) return;
    E.flash.style.background = color;
    restartAnim(E.flash, 'go');
  },

  shake(ms = 400) {
    const app = document.getElementById('app');
    if (!app) return;
    if (Settings.get().calm) ms = Math.min(ms, 160);
    app.style.setProperty('--shake-ms', `${Math.max(50, ms)}ms`);
    restartAnim(app, 'pv-shake');
    clearTimeout(app._shakeT);
    app._shakeT = setTimeout(() => app.classList.remove('pv-shake'), ms + 50);
  },

  vignette(v) {
    if (!root) return;
    const x = Math.max(0, Math.min(1, Number(v) || 0));
    E.vignette.style.setProperty('--v', x.toFixed(3));
  },
};
