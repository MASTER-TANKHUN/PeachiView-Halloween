// DOM HUD + screens for the livestream overlay. Builds everything inside #hud.

const MAX_CHAT = 12;
const SPAM_TTL_HINT = 8; // seconds (visual timer only; the rule lives in the game logic)

const MOODS = {
  happy: { emoji: '😊', label: 'อารมณ์ดี' },
  cry: { emoji: '😢', label: 'เหงา...' },
  angry: { emoji: '😠', label: 'โกรธ!!' },
  scream: { emoji: '😱', label: 'กรี๊ดดด!!' },
};

let root = null;
let E = {};
const startCbs = [];
const retryCbs = [];
let chatMsgs = []; // { el, type, t0, banned }
let viewers = { shown: 0, target: 0, from: 0, t0: 0 };
let subTimer = 0;
let subType = 0;
let currentScreen = null;

function el(tag, cls, parent, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  if (parent) parent.appendChild(n);
  return n;
}
const pad = (n) => String(Math.max(0, Math.floor(n))).padStart(2, '0');
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const now = () => performance.now();

function restartAnim(node, cls) {
  node.classList.remove(cls);
  void node.offsetWidth; // reflow so the animation restarts
  node.classList.add(cls);
}

function userColor(name) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.codePointAt(0)) >>> 0;
  return `hsl(${h % 360} 85% 72%)`;
}

function scTier(amount) {
  if (amount >= 500) return 'sc-t5';
  if (amount >= 200) return 'sc-t4';
  if (amount >= 100) return 'sc-t3';
  if (amount >= 50) return 'sc-t2';
  return 'sc-t1';
}

function makeGrain() {
  try {
    const c = document.createElement('canvas');
    c.width = c.height = 160;
    const g = c.getContext('2d');
    const img = g.createImageData(160, 160);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return c.toDataURL();
  } catch { return ''; }
}

function build() {
  root = el('div', 'pv-root');
  root.dataset.screen = 'none';

  // ---- effects layers (below HUD widgets) ----
  E.vignette = el('div', 'fx-vignette', root);
  E.flash = el('div', 'fx-flash', root);
  E.crt = el('div', 'fx-crt', root);
  const grain = makeGrain();
  if (grain) E.crt.style.setProperty('--grain', `url(${grain})`);

  // ---- play HUD ----
  const hud = (E.hud = el('div', 'hud-play', root));

  // top-left: clock + night + mood
  const tl = el('div', 'hud-tl', hud);
  const clock = el('div', 'panel clock', tl);
  E.clock = el('div', 'clock-time', clock, '00:00 AM');
  E.night = el('div', 'clock-night', clock, '🎃 คืนที่ 1');
  const mood = (E.mood = el('div', 'panel mood mood-happy', tl));
  E.moodFace = el('div', 'mood-face', mood, '😊');
  const moodTxt = el('div', 'mood-txt', mood);
  el('div', 'mood-name', moodTxt, 'พีชชี่ 👻');
  E.moodLabel = el('div', 'mood-label', moodTxt, 'อารมณ์ดี');

  // top-center: objective + toasts
  const tc = el('div', 'hud-tc', hud);
  E.objective = el('div', 'objective', tc);
  E.objective.hidden = true;
  E.toasts = el('div', 'toasts', tc);

  // top-right: LIVE + viewers, chat panel
  const tr = el('div', 'hud-tr', hud);
  const live = el('div', 'live-row', tr);
  el('div', 'live-badge', live, '● LIVE');
  const vw = el('div', 'viewers', live);
  el('span', 'viewers-eye', vw, '👁');
  E.viewers = el('span', 'viewers-n', vw, '0');
  E.viewersDelta = el('div', 'viewers-deltas', vw);

  const chat = el('div', 'chat panel', tr);
  const ch = el('div', 'chat-head', chat);
  el('span', 'chat-title', ch, '💬 แชตสด');
  E.spamCount = el('span', 'chat-spamcount', ch, '');
  E.chatList = el('div', 'chat-list', chat);
  E.chatFoot = el('div', 'chat-foot', chat, 'มอด: กด Q แบนแชตผี 🔨');

  // bottom-left: battery + scream
  const bl = el('div', 'hud-bl panel', hud);
  const bat = el('div', 'meter battery', bl);
  const batHead = el('div', 'meter-head', bat);
  el('span', 'meter-name', batHead, '🔦 ไฟฉาย [F]');
  E.batPct = el('span', 'meter-val', batHead, '100%');
  const batBar = el('div', 'bar', bat);
  E.batFill = el('div', 'bar-fill', batBar);

  const scr = (E.scream = el('div', 'meter scream', bl));
  const scrHead = el('div', 'meter-head', scr);
  E.scrName = el('span', 'meter-name', scrHead, '⌨ Space รัวๆ');
  E.scrVal = el('span', 'meter-val', scrHead, 'พร้อมกรีด!');
  const scrBar = el('div', 'bar', scr);
  E.scrFill = el('div', 'bar-fill', scrBar);
  E.scrThresh = el('div', 'bar-thresh', scrBar);

  // center: crosshair, prompt, subtitles
  el('div', 'crosshair', hud);
  E.prompt = el('div', 'prompt', hud);
  E.prompt.hidden = true;
  E.subtitle = el('div', 'subtitle', hud);
  E.subtitle.hidden = true;

  // ---- screens ----
  E.screens = {};
  E.screens.menu = buildMenu();
  E.screens.intro = buildIntro();
  E.screens.gameover = buildEnd('gameover');
  E.screens.win = buildEnd('win');
  for (const s of Object.values(E.screens)) root.appendChild(s);

  return root;
}

function buildMenu() {
  const s = el('div', 'screen screen-menu');
  const card = el('div', 'menu-card', s);
  const top = el('div', 'menu-top', card);
  el('span', 'live-badge', top, '● LIVE');
  el('span', 'menu-tag', top, '🎃 Halloween Special · ตี 3');
  E.menuTitle = el('h1', 'menu-title', card);
  E.menuTitle.innerHTML = '<span class="t-brand">PeachiView</span><span class="t-sub">ไลฟ์ผี 249 ชั่วโมง</span>';
  E.menuText = el('p', 'menu-blurb', card,
    'คืนฮาโลวีน พีชชี่ลืมปิดไลฟ์แล้วเผลอหลับ… ตื่นมาอีกทีกลายเป็น "ผี" ติดอยู่ในไลฟ์ของตัวเอง! ' +
    'คุณคือมอดมือใหม่ที่โดน DM ตอนตี 3 ให้มาช่วยดูแลไลฟ์ — หาหูฟังหูแมวของพีชชี่ แล้วเอาไปวางที่โต๊ะสตรีมให้ได้ก่อน 06:00');
  const ctr = el('div', 'controls', card);
  const rows = [
    ['WASD', 'เดิน'], ['Shift', 'วิ่ง'], ['เมาส์', 'มองรอบๆ'], ['E', 'หยิบ / วาง'],
    ['F', 'ไฟฉาย (แบตหมดได้)'], ['Space รัวๆ', 'กรีดไล่ผี'], ['Q', 'แบนแชตผี'], ['Esc', 'ปล่อยเมาส์'],
  ];
  for (const [k, v] of rows) {
    const r = el('div', 'ctrl', ctr);
    el('kbd', null, r, k);
    el('span', null, r, v);
  }
  el('p', 'menu-note', card, '🎤 ไมค์ไม่บังคับ: กดอนุญาตไมค์แล้ว "กรีดใส่ไมค์" เพื่อไล่ผีได้เลย — ไม่อนุญาตก็กด Space รัวๆ แทน · แนะนำใส่หูฟัง 🎧');
  E.startBtn = el('button', 'btn btn-start', card, '▶ เริ่มไลฟ์');
  E.startBtn.type = 'button';
  E.startBtn.addEventListener('click', () => {
    E.startBtn.blur();
    for (const cb of startCbs) cb();
  });
  E.menuCleared = el('div', 'menu-cleared', card, '✓ ผ่านคืนที่ 1 แล้ว — มอดตัวจริง!');
  E.menuCleared.hidden = true;
  return s;
}

function buildIntro() {
  const s = el('div', 'screen screen-intro');
  E.introTitle = el('div', 'intro-title', s, 'คืนที่ 1');
  E.introClock = el('div', 'intro-clock', s, '00:00');
  E.introText = el('div', 'intro-text', s, 'หาหูฟังหูแมวให้พีชชี่ ก่อนตี 6…');
  return s;
}

function buildEnd(kind) {
  const s = el('div', `screen screen-end screen-${kind}`);
  const card = el('div', 'end-card', s);
  el('div', 'end-tag', card, kind === 'win' ? '🍑 STREAM SAVED' : '■ STREAM OFFLINE');
  const title = el('h2', 'end-title', card, kind === 'win' ? 'คืนที่ 1 รอด!' : 'ไลฟ์จบแล้ว');
  const text = el('p', 'end-text', card, '');
  const btn = el('button', 'btn btn-retry', card, kind === 'win' ? '🔁 เล่นอีกครั้ง' : '↻ ลองอีกครั้ง');
  btn.type = 'button';
  btn.addEventListener('click', () => {
    btn.blur();
    for (const cb of retryCbs) cb();
  });
  E[kind] = { title, text, btn };
  return s;
}

// ---------- animation loop (viewer count tween) ----------
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
  E.spamCount.textContent = n ? `👻 แชตผี ${n} · [Q] แบน` : '';
  E.spamCount.classList.toggle('on', n > 0);
}

function removeMsg(m) {
  const i = chatMsgs.indexOf(m);
  if (i >= 0) chatMsgs.splice(i, 1);
  m.el.remove();
}

function trimChat() {
  // drop the oldest non-spam lines first — spam stays until banned so it can still be punished
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
    try {
      if (localStorage.getItem('peachi.nightCleared')) E.menuCleared.hidden = false;
    } catch {}
    requestAnimationFrame(loop);
    this.showScreen('menu');
  },

  onStart(cb) { if (typeof cb === 'function') startCbs.push(cb); },
  onRetry(cb) { if (typeof cb === 'function') retryCbs.push(cb); },

  showScreen(name, data = {}) {
    if (!root) return;
    data = data || {};
    currentScreen = name;
    root.dataset.screen = name;
    for (const [k, s] of Object.entries(E.screens)) {
      const on = k === name;
      s.classList.toggle('show', on);
      if (on) restartAnim(s, 'enter');
    }
    if (document.activeElement && root.contains(document.activeElement)) document.activeElement.blur();

    if (name === 'menu') {
      if (data.title) E.menuTitle.textContent = data.title;
      if (data.text) E.menuText.textContent = data.text;
      try { E.menuCleared.hidden = !localStorage.getItem('peachi.nightCleared'); } catch {}
    } else if (name === 'intro') {
      E.introTitle.textContent = data.title || 'คืนที่ 1';
      E.introClock.textContent = data.clock || '00:00';
      E.introText.textContent = data.text || 'หาหูฟังหูแมวให้พีชชี่ ก่อนตี 6…';
    } else if (name === 'gameover' || name === 'win') {
      const d = E[name];
      d.title.textContent = data.title || (name === 'win' ? 'คืนที่ 1 รอด!' : 'ไลฟ์จบแล้ว');
      d.title.dataset.text = d.title.textContent;
      d.text.textContent = data.text || '';
      if (name === 'win') {
        try { E.menuCleared.hidden = !localStorage.getItem('peachi.nightCleared'); } catch {}
      }
    }
    if (name !== 'play') { this.setPrompt(null); }
  },

  setClock(hour, minute = 0) {
    if (!root) return;
    const txt = `${pad(hour)}:${pad(minute)} AM`;
    if (E.clock.textContent !== txt) {
      E.clock.textContent = txt;
      E.clock.parentElement.classList.toggle('dawn', hour >= 5);
    }
  },

  setViewers(n) {
    if (!root) return;
    n = Math.max(0, Math.round(Number(n) || 0));
    const prev = viewers.target;
    if (n === prev) return;
    viewers.from = viewers.shown;
    viewers.target = n;
    viewers.t0 = now();
    const vw = E.viewers.parentElement;
    const cls = n > prev ? 'up' : 'down';
    vw.classList.remove('up', 'down');
    void vw.offsetWidth;
    vw.classList.add(cls);
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
    const b = E.batFill.closest('.battery');
    b.classList.toggle('mid', p <= 50 && p > 20);
    b.classList.toggle('low', p <= 20 && p > 0);
    b.classList.toggle('empty', p <= 0);
  },

  setScreamMeter(v, cooldownSec = 0, usingMic = false) {
    if (!root) return;
    const x = Math.max(0, Math.min(1, Number(v) || 0));
    E.scrFill.style.width = `${x * 100}%`;
    E.scrName.textContent = usingMic ? '🎤 ไมค์ · กรีดเลย!' : '⌨ Space รัวๆ';
    E.scream.classList.toggle('mic', !!usingMic);
    const cd = cooldownSec > 0.05;
    E.scream.classList.toggle('cooldown', cd);
    E.scream.classList.toggle('hot', !cd && x >= (usingMic ? 0.5 : 0.75));
    E.scrVal.textContent = cd ? `พักเสียง ${cooldownSec.toFixed(1)}s` : 'พร้อมกรีด!';
  },

  setMood(name) {
    if (!root) return;
    const m = MOODS[name] || MOODS.happy;
    const key = MOODS[name] ? name : 'happy';
    if (E.mood.dataset.mood === key) return;
    E.mood.dataset.mood = key;
    E.mood.className = `panel mood mood-${key}`;
    E.moodFace.textContent = m.emoji;
    E.moodLabel.textContent = m.label;
    restartAnim(E.mood, 'pop');
  },

  setPrompt(text) {
    if (!root) return;
    if (!text) { E.prompt.hidden = true; E.prompt._txt = null; return; }
    if (E.prompt._txt === text && !E.prompt.hidden) return;
    E.prompt._txt = text;
    let key = 'E';
    let label = String(text);
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
    if (E.objective.textContent === `🎯 ${text}` && !E.objective.hidden) return;
    E.objective.textContent = `🎯 ${text}`;
    E.objective.hidden = false;
    restartAnim(E.objective, 'pulse');
  },

  toast(text) {
    if (!root) return;
    const t = el('div', 'toast', E.toasts, text);
    while (E.toasts.children.length > 4) E.toasts.firstChild.remove();
    setTimeout(() => t.classList.add('out'), 2600);
    setTimeout(() => t.remove(), 3100);
  },

  subtitle(text, ms = 3000) {
    if (!root) return;
    clearTimeout(subTimer);
    clearInterval(subType);
    if (!text) { E.subtitle.hidden = true; return; }
    E.subtitle.replaceChildren();
    el('span', 'sub-name', E.subtitle, 'พีชชี่');
    const body = el('span', 'sub-text', E.subtitle, '');
    E.subtitle.hidden = false;
    restartAnim(E.subtitle, 'in');
    // quick typewriter
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
    push({ user = '???', text = '', type = 'normal', amount = 0 } = {}) {
      if (!root) return null;
      const line = el('div', `chat-msg chat-${type}`);
      if (type === 'superchat') {
        line.classList.add(scTier(amount));
        const head = el('div', 'sc-head', line);
        el('span', 'sc-user', head, user);
        el('span', 'sc-amount', head, `฿${fmt(amount)}`);
        el('div', 'sc-text', line, text);
      } else {
        const u = el('span', 'chat-user', line, type === 'spam' ? `👻 ${user}` : user);
        if (type !== 'spam') u.style.color = userColor(user);
        el('span', 'chat-text', line, text);
        if (type === 'spam') {
          el('span', 'spam-hint', line, '[Q] แบน');
          const timer = el('div', 'spam-timer', line);
          timer.style.animationDuration = `${SPAM_TTL_HINT}s`;
        }
      }
      E.chatList.appendChild(line);
      const m = { el: line, type, t0: now(), banned: false };
      chatMsgs.push(m);
      trimChat();
      if (type === 'spam') updateSpamCount();
      E.chatList.scrollTop = E.chatList.scrollHeight;
      return line;
    },

    banOldestSpam() {
      if (!root) return false;
      const m = chatMsgs.find((x) => x.type === 'spam' && !x.banned);
      if (!m) return false;
      m.banned = true;
      m.el.classList.add('banned');
      const stamp = el('span', 'ban-stamp', m.el, '🔨 BANNED');
      stamp.setAttribute('aria-hidden', 'true');
      updateSpamCount();
      setTimeout(() => removeMsg(m), 700);
      return true;
    },

    spamAges() {
      const t = now();
      return chatMsgs.filter((m) => m.type === 'spam' && !m.banned).map((m) => (t - m.t0) / 1000);
    },

    // extra: remove spam older than maxAge seconds (after it has been punished) → count removed
    expireSpam(maxAge = SPAM_TTL_HINT) {
      const t = now();
      let n = 0;
      for (const m of chatMsgs.slice()) {
        if (m.type === 'spam' && !m.banned && (t - m.t0) / 1000 > maxAge) {
          m.banned = true;
          m.el.classList.add('expired');
          setTimeout(() => removeMsg(m), 600);
          n++;
        }
      }
      if (n) updateSpamCount();
      return n;
    },

    // extra: wipe chat (retry)
    clear() {
      for (const m of chatMsgs) m.el.remove();
      chatMsgs = [];
      if (root) updateSpamCount();
    },
  },

  flash(color = '#fff') {
    if (!root) return;
    E.flash.style.background = color;
    restartAnim(E.flash, 'go');
  },

  shake(ms = 400) {
    const app = document.getElementById('app');
    if (!app) return;
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
