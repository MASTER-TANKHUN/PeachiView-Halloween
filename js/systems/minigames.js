// Mini-games that happen inside the night — the clock keeps running and the ghosts keep moving while you
// play, so every one of them is also a risk:
//   POPCAT      — at the stream PC: pop the cat 80 times in 15 s (click / E / Space)
//   เต้นตาม     — Peachi dances a sequence of arrows; repeat it (arrow keys or WASD), two rounds
//   คาราโอเกะ   — at the living-room TV: hit the notes on the beat (Space / click, or sing into the mic)
//   กระดานวิญญาณ — the spirit board spells a hint, letter by letter (once a night)
// Each game freezes the player while it runs and reports back through a callback.
import * as THREE from 'three';
import { UI } from '../ui.js';
import { sfx } from '../audio.js';
import { Scream } from '../mic.js';
import { Talk } from '../game/talk.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const el = (tag, cls, parent, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; if (parent) parent.appendChild(n); return n; };

const ARROWS = { ArrowLeft: 'L', KeyA: 'L', ArrowRight: 'R', KeyD: 'R', ArrowUp: 'U', KeyW: 'U', ArrowDown: 'D', KeyS: 'D' };
const GLYPH = { L: '←', R: '→', U: '↑', D: '↓' };
const SAY = { L: 'ซ้าย!', R: 'ขวา!', U: 'ขึ้น!', D: 'ลง!' };

// the karaoke song: C-pentatonic, one syllable a note
const NOTE = { C: 523.25, D: 587.33, E: 659.25, G: 783.99, A: 880 };
const SONGS = {
  default: {
    title: 'มอดจ๋า (เพลงแต่งเอง)',
    lines: [
      { syl: ['มอด', 'จ๋า', 'อย่า', 'เพิ่ง', 'ไป', 'ไหน', 'นะ', 'คะ'], notes: 'EGAGEDEG' },
      { syl: ['ไลฟ์', 'นี้', 'ยัง', 'ไม่', 'จบ', 'เลย', 'น้า', '~'], notes: 'AGEDCDEC' },
    ],
  },
  halloween: {
    title: 'ฮาโลวีนนี้ (เพลงแต่งเอง)',
    lines: [
      { syl: ['สุข', 'สันต์', 'วัน', 'ฮา', 'โล', 'วีน', 'นะ', 'มอด'], notes: 'EGAGEDEG' },
      { syl: ['ผี', 'ปอบ', 'กิน', 'ขนม', 'หมด', 'แล้ว', 'จ้า', '~'], notes: 'AGEDCDEC' },
    ],
  },
};
const BEAT = 0.55, LEAD = 2.0;

// spirit board: letter positions (same layout as the board drawn in room_living.js)
const BOARD_LETTERS = 'กขคงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรลวศษสหฬอฮ';
const BOARD_C = V(6.38, 0.456, 4.35), BOARD_W = 0.62, BOARD_H = 0.41, BOARD_ROT = 0.08;
function boardPoint(cx, cy, out = V()) { // canvas (512×340) → world
  const u = (cx / 512 - 0.5) * BOARD_W, v = (0.5 - cy / 340) * BOARD_H;
  const c = Math.cos(BOARD_ROT), s = Math.sin(BOARD_ROT);
  return out.set(BOARD_C.x + u * c - v * s, BOARD_C.y, BOARD_C.z - (u * s + v * c));
}
function letterPoint(ch) {
  if (ch === 'ใช่') return boardPoint(70, 56);
  if (ch === 'ไม่') return boardPoint(442, 56);
  if (ch === 'ลาก่อน') return boardPoint(256, 310);
  const i = BOARD_LETTERS.indexOf(ch);
  if (i < 0) return boardPoint(256, 170);
  const row = i < 22 ? 0 : 1, k = row ? i - 22 : i, n = row ? BOARD_LETTERS.length - 22 : 22;
  const a = Math.PI * (0.15 + 0.7 * k / (n - 1));
  return boardPoint(256 - Math.cos(a) * (row ? 150 : 210), 242 - Math.sin(a) * (row ? 100 : 150));
}

export class MiniGames {
  constructor({ scene, level, player, camera }) {
    this.level = level; this.player = player; this.camera = camera;
    this.game = null;      // 'popcat' | 'dance' | 'karaoke' | 'board'
    this.onDone = null;    // (ok, game) => void
    this._dom();
    // the spirit board's ghost planchette
    const shape = new THREE.Shape(); shape.moveTo(0, 0.06); shape.quadraticCurveTo(0.05, 0.02, 0.045, -0.045); shape.lineTo(-0.045, -0.045); shape.quadraticCurveTo(-0.05, 0.02, 0, 0.06);
    shape.holes.push(new THREE.Path().absarc(0, 0, 0.016, 0, TAU, true));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.008, bevelEnabled: false }); geo.rotateX(-Math.PI / 2);
    this.planchette = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.7, 1.3), transparent: true, opacity: 0.85, toneMapped: false, depthWrite: false }));
    this.planchette.visible = false;
    scene.add(this.planchette);
    window.addEventListener('keydown', (e) => this._key(e));
    window.addEventListener('mousedown', (e) => { if (e.button === 0) this._tap('click'); });
  }

  get active() { return !!this.game; }
  /** Space belongs to the game while one runs (no screams). */
  get busy() { return this.game === 'popcat' || this.game === 'karaoke'; }

  _begin(game, onDone) {
    this.stop(true);
    this.game = game; this.t = 0; this.onDone = onDone || null;
    this.player.enabled = false;
    this.player.blockArrows = true;
  }
  _finish(ok) {
    const g = this.game, cb = this.onDone;
    this.stop();
    if (cb) cb(ok, g);
  }
  /** Leave the current game (no result). */
  stop(silent) {
    if (!this.game) return;
    const g = this.game;
    this.game = null;
    this.root.className = 'mg';
    this.planchette.visible = false;
    if (g === 'karaoke') this._tvRestore();
    this.player.blockArrows = false;
    if (!silent) this.player.enabled = true;
  }

  _key(e) {
    if (!this.game) return;
    if (this.game === 'dance') { const a = ARROWS[e.code]; if (a && !e.repeat) { e.preventDefault(); this._danceInput(a); } return; }
    if (e.code === 'Space' || e.code === 'KeyE' || e.code === 'Enter') { e.preventDefault(); if (!e.repeat) this._tap('key'); return; }
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code) && this.game !== 'board') { this.stop(); UI.toast('เลิกเล่นแล้ว'); }
  }
  _tap() {
    if (this.game === 'popcat') this._pop();
    else if (this.game === 'karaoke') this._karaHit(false);
  }

  update(dt, t) {
    if (!this.game) return;
    this.t += dt;
    if (this.game === 'popcat') this._popUpdate(dt);
    else if (this.game === 'dance') this._danceUpdate(dt);
    else if (this.game === 'karaoke') this._karaUpdate(dt, t);
    else if (this.game === 'board') this._boardUpdate(dt, t);
  }

  // ================================================================= POPCAT
  popcat(onDone) {
    this._begin('popcat', onDone);
    this.pops = 0; this.need = 80; this.left = 15;
    this.root.className = 'mg on popcat';
    this._popDraw();
  }
  _pop() {
    this.pops++;
    sfx.play('pop');
    this.cat.classList.remove('open'); void this.cat.offsetWidth; this.cat.classList.add('open');
    clearTimeout(this._catT); this._catT = setTimeout(() => this.cat.classList.remove('open'), 90);
    this._popDraw();
    if (this.pops >= this.need) { sfx.play('found'); this._finish(true); }
  }
  _popUpdate(dt) {
    this.left -= dt;
    this.popBar.style.width = `${Math.max(0, this.left / 15) * 100}%`;
    if (this.left <= 0) { sfx.play('denied'); this._finish(false); }
  }
  _popDraw() { this.popCount.textContent = `${this.pops} / ${this.need}`; }

  // ================================================================= dance (Simon says)
  dance(peachi, onDone) {
    this._begin('dance', onDone);
    this.peachi = peachi;
    this.round = 0; this.fails = 0;
    this.root.className = 'mg on dance';
    this._danceRound();
  }
  _danceRound() {
    const n = this.round === 0 ? 4 : 6;
    this.seq = Array.from({ length: n }, () => 'LRUD'[Math.floor(Math.random() * 4)]);
    this.phase = 'show'; this.idx = -1; this.showT = 0.6; this.input = [];
    this.danceSlots.replaceChildren(...this.seq.map(() => el('span', 'mg-slot')));
    this.danceText.textContent = `รอบ ${this.round + 1}/2 · ดูท่าให้ดี`;
  }
  _danceUpdate(dt) {
    if (this.phase !== 'show') return;
    this.showT -= dt;
    if (this.showT > 0) return;
    this.idx++;
    const slots = this.danceSlots.children;
    for (const s of slots) s.classList.remove('lit');
    if (this.idx >= this.seq.length) {
      this.phase = 'input';
      for (const s of slots) s.textContent = '';
      this.danceText.textContent = 'ถึงตามอด! กดลูกศรตามท่า (หรือ W A S D)';
      if (this.peachi) this.peachi._setPose('idle');
      return;
    }
    const a = this.seq[this.idx];
    slots[this.idx].textContent = GLYPH[a]; slots[this.idx].classList.add('lit');
    sfx.play('danceNote', { i: 'LRUD'.indexOf(a) });
    if (this.peachi) {
      Talk.say('peachi', SAY[a], { at: this.peachi.position, ms: 500 });
      this.peachi._setPose(this.idx % 2 ? 'reach' : 'float');
      this.peachi.group.rotation.y += (a === 'L' ? 0.35 : a === 'R' ? -0.35 : 0);
    }
    this.showT = Math.max(0.36, 0.62 - this.round * 0.12);
  }
  _danceInput(a) {
    if (this.phase !== 'input') return;
    const slots = this.danceSlots.children, i = this.input.length;
    if (a === this.seq[i]) {
      this.input.push(a);
      slots[i].textContent = GLYPH[a]; slots[i].classList.add('ok');
      sfx.play('danceNote', { i: 'LRUD'.indexOf(a) });
      if (this.input.length === this.seq.length) {
        this.round++;
        if (this.round >= 2) { sfx.play('found'); this._finish(true); }
        else { this.danceText.textContent = 'เก่ง! รอบต่อไปเร็วขึ้นนะ'; this.phase = 'wait'; setTimeout(() => this.game === 'dance' && this._danceRound(), 900); }
      }
    } else {
      slots[i].textContent = GLYPH[a]; slots[i].classList.add('bad');
      sfx.play('denied');
      this.fails++;
      if (this.fails >= 2) { this.danceText.textContent = 'ผิดท่าอีกแล้ว…'; this._finish(false); return; }
      this.danceText.textContent = 'ผิดท่า! ดูใหม่อีกรอบ';
      this.phase = 'wait';
      setTimeout(() => this.game === 'dance' && this._danceRound(), 900);
    }
  }

  // ================================================================= karaoke
  karaoke(song = 'default', onDone) {
    this._begin('karaoke', onDone);
    const S = SONGS[song] || SONGS.default;
    this.song = S;
    this.notes = [];
    S.lines.forEach((ln, li) => ln.syl.forEach((syl, k) => this.notes.push({ t: LEAD + (li * 9 + k) * BEAT, f: NOTE[ln.notes[k]], syl, line: li, hit: null, played: false })));
    this.kEnd = this.notes[this.notes.length - 1].t + 1.2;
    this.beatT = 0; this.nextBeat = LEAD - BEAT * 4;
    this.hits = 0; this._lyricKey = null;
    this.root.className = 'mg on karaoke';
    this.karaLane.replaceChildren();
    for (const n of this.notes) { n.el = el('span', 'mg-note', this.karaLane, '🍑'); }
    this.karaTitle.textContent = S.title;
    this.karaHint.textContent = Scream.usingMic ? 'ร้องใส่ไมค์ตอนลูกพีชถึงวง (หรือกด Space)' : 'กด Space / คลิก ตอนลูกพีชถึงวง';
    this._tvSetup();
  }
  _karaHit(fromMic) {
    const t = this.t;
    let best = null, bd = 1;
    for (const n of this.notes) { if (n.hit) continue; const d = Math.abs(n.t - t); if (d < bd) { bd = d; best = n; } }
    if (!best || bd > 0.2) { if (!fromMic) this._rate('พลาด', 'miss'); return; }
    best.hit = bd < 0.09 ? 'perfect' : 'good';
    this.hits++;
    best.el.classList.add('hit');
    this._rate(best.hit === 'perfect' ? 'เป๊ะ!' : 'ดี!', best.hit);
    sfx.play('karaNote', { f: best.f * 2, vol: 0.6 });
  }
  _rate(text, cls) {
    const r = el('span', `mg-rate ${cls}`, this.karaRates, text);
    setTimeout(() => r.remove(), 600);
  }
  _karaUpdate(dt, t) {
    const now = this.t;
    // backing: kick on the beat, hats between
    while (this.nextBeat <= now) { if (this.nextBeat >= 0) sfx.play('karaBeat'); this.nextBeat += BEAT; }
    const W = 520, hitX = 60, speed = (W - hitX) / LEAD;
    for (const n of this.notes) {
      const x = hitX + (n.t - now) * speed;
      n.el.style.transform = `translateX(${x.toFixed(1)}px)`;
      n.el.style.opacity = x > W + 20 || x < -40 ? '0' : '1';
      if (!n.played && now >= n.t) { n.played = true; sfx.play('karaNote', { f: n.f, vol: 0.9 }); }
      if (!n.hit && now > n.t + 0.2 && !n.missed) { n.missed = true; n.el.classList.add('miss'); }
    }
    // singing into the mic counts when a note is on the ring
    if (Scream.usingMic && Scream.level > 0.12) { const n = this.notes.find((x) => !x.hit && Math.abs(x.t - now) < 0.15); if (n) this._karaHit(true); }
    // lyrics (one span per note of the current line; rebuilt only when something changes)
    const cur = this.notes.filter((n) => n.t <= now + 0.05).pop() || this.notes[0];
    const li = cur.line, lineNotes = this.notes.filter((n) => n.line === li);
    const key = `${li}|${lineNotes.map((n) => (n.t <= now + 0.05 ? (n.hit ? 2 : 1) : 0)).join('')}`;
    if (key !== this._lyricKey) {
      this._lyricKey = key;
      this.karaLyric.replaceChildren(...lineNotes.map((n) => el('span', n.t <= now + 0.05 ? (n.hit ? 'sung hit' : 'sung') : null, null, n.syl)));
    }
    this._tvDraw(li, now);
    if (now >= this.kEnd) {
      const ok = this.hits / this.notes.length >= 0.65;
      this.karaHint.textContent = `ร้องถูก ${this.hits}/${this.notes.length}`;
      sfx.play(ok ? 'found' : 'denied');
      this._finish(ok);
    }
  }
  _tvFind() {
    if (this._tv !== undefined) return this._tv;
    const tex = this.level.screens && this.level.screens.tv;
    let m = null;
    if (tex) this.level.root.traverse((o) => { if (!m && o.isMesh && o.material && (o.material.map === tex || (o.userData.onMat && o.userData.onMat.map === tex))) m = o; });
    this._tv = m;
    return m;
  }
  _tvSetup() {
    const m = this._tvFind();
    if (!m) return;
    if (!this.tvTex) { const c = document.createElement('canvas'); c.width = 512; c.height = 288; this.tvCanvas = c; this.tvTex = new THREE.CanvasTexture(c); this.tvTex.colorSpace = THREE.SRGBColorSpace; }
    const mat = m.userData.onMat || m.material;
    this._tvPrev = mat.map; mat.map = this.tvTex; mat.needsUpdate = true;
  }
  _tvRestore() {
    const m = this._tvFind();
    if (!m || !this._tvPrev) return;
    const mat = m.userData.onMat || m.material;
    mat.map = this._tvPrev; mat.needsUpdate = true; this._tvPrev = null;
  }
  _tvDraw(li, now) {
    if (!this.tvCanvas || (this._tvT = (this._tvT || 0) + 1) % 2) return;
    const g = this.tvCanvas.getContext('2d'), w = 512, h = 288;
    const grd = g.createLinearGradient(0, 0, w, h); grd.addColorStop(0, '#2a0a3a'); grd.addColorStop(1, '#0a1a4a');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ff9ac8'; g.font = '600 22px Kanit, sans-serif'; g.textAlign = 'center'; g.fillText(`♪ ${this.song.title} ♪`, w / 2, 40);
    const lineNotes = this.notes.filter((q) => q.line === li);
    g.font = '700 34px Kanit, sans-serif';
    const widths = lineNotes.map((n) => g.measureText(n.syl).width + 10), total = widths.reduce((a, b) => a + b, 0);
    let x = (w - total) / 2;
    let ballX = null;
    lineNotes.forEach((n, k) => {
      g.fillStyle = n.t <= now ? '#ffe06a' : '#ffffff'; g.textAlign = 'left'; g.fillText(n.syl, x, 170);
      if (Math.abs(n.t - now) < BEAT / 2) ballX = x + widths[k] / 2 - 5;
      x += widths[k];
    });
    if (ballX != null) { const b = Math.abs(Math.sin(now / BEAT * Math.PI)) * 26; g.fillStyle = '#ff7ab0'; g.beginPath(); g.arc(ballX, 128 - b, 9, 0, TAU); g.fill(); }
    g.fillStyle = 'rgba(255,255,255,0.08)'; for (let y = 0; y < h; y += 3) g.fillRect(0, y, w, 1);
    this.tvTex.needsUpdate = true;
  }

  // ================================================================= spirit board
  /** Spell `word` (consonants + ใช่/ไม่/ลาก่อน), then call onDone(true). */
  board(word, onDone) {
    this._begin('board', onDone);
    this.player.enabled = true; // you can look around (and run) while it spells
    this.player.blockArrows = false;
    this.letters = Array.isArray(word) ? word : Array.from(word);
    this.li = -1; this.at = letterPoint('ลาก่อน').clone(); this.from = this.at.clone(); this.to = this.at.clone(); this.moveT = 1; this.spelled = '';
    this.planchette.visible = true;
    this.planchette.position.copy(this.at);
    sfx.play('whisper');
  }
  _boardUpdate(dt, t) {
    this.moveT += dt / 0.8;
    const k = Math.min(1, this.moveT), e = k * k * (3 - 2 * k);
    this.planchette.position.lerpVectors(this.from, this.to, e);
    this.planchette.position.y = BOARD_C.y + 0.006 + Math.sin(t * 6) * 0.002;
    this.planchette.rotation.y = Math.sin(t * 1.3) * 0.2;
    this.planchette.material.opacity = 0.65 + 0.25 * Math.sin(t * 5);
    if (k < 1) return;
    if (this.li >= 0 && this.li < this.letters.length && !this.shown) {
      this.shown = true;
      this.spelled += (this.spelled ? '…' : '') + this.letters[this.li];
      UI.subtitle(this.spelled, 2600, { name: 'กระดานวิญญาณ', cls: 'her' });
      sfx.play('pageFlip');
    }
    this.holdT = (this.holdT || 0) + dt;
    if (this.holdT < 0.45) return;
    this.holdT = 0;
    this.li++;
    this.shown = false;
    if (this.li >= this.letters.length) { this._finish(true); return; }
    this.from.copy(this.planchette.position);
    this.to.copy(letterPoint(this.letters[this.li]));
    this.moveT = 0;
  }

  // ================================================================= DOM
  _dom() {
    const r = el('div', 'mg');
    // POPCAT
    const pc = el('div', 'mg-card mg-popcat', r);
    el('div', 'mg-title', pc, 'POPCAT');
    this.cat = el('div', 'mg-cat', pc);
    this.cat.innerHTML = `<svg viewBox="0 0 200 180" aria-hidden="true">
      <path d="M30 70 L40 10 L85 45 Z M170 70 L160 10 L115 45 Z" fill="#f2c9a0" stroke="#2a1a14" stroke-width="5" stroke-linejoin="round"/>
      <ellipse cx="100" cy="100" rx="82" ry="70" fill="#f5d7a8" stroke="#2a1a14" stroke-width="5"/>
      <g class="shut"><path d="M60 90 q10 -8 20 0 M120 90 q10 -8 20 0" stroke="#2a1a14" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M88 122 q12 8 24 0" stroke="#2a1a14" stroke-width="5" fill="none" stroke-linecap="round"/></g>
      <g class="wide"><circle cx="70" cy="88" r="9" fill="#2a1a14"/><circle cx="130" cy="88" r="9" fill="#2a1a14"/><ellipse cx="100" cy="128" rx="24" ry="28" fill="#3a0a14" stroke="#2a1a14" stroke-width="5"/></g>
      <ellipse cx="45" cy="118" rx="12" ry="7" fill="#ff9ab0" opacity=".6"/><ellipse cx="155" cy="118" rx="12" ry="7" fill="#ff9ab0" opacity=".6"/></svg>`;
    this.popCount = el('div', 'mg-count tnum', pc, '0 / 80');
    const pb = el('div', 'mg-bar', pc); this.popBar = el('div', 'mg-bar-fill', pb);
    el('div', 'mg-hint', pc, 'คลิก / E / Space รัวๆ · W A S D เลิก');
    // dance
    const dc = el('div', 'mg-card mg-dance', r);
    el('div', 'mg-title', dc, 'เต้นตามพีชชี่');
    this.danceSlots = el('div', 'mg-slots', dc);
    this.danceText = el('div', 'mg-hint', dc, '');
    // karaoke
    const kc = el('div', 'mg-card mg-kara', r);
    this.karaTitle = el('div', 'mg-title', kc, 'คาราโอเกะ');
    const lane = el('div', 'mg-lane', kc);
    el('span', 'mg-ring', lane);
    this.karaLane = el('div', 'mg-notes', lane);
    this.karaRates = el('div', 'mg-rates', lane);
    this.karaLyric = el('div', 'mg-lyric', kc);
    this.karaHint = el('div', 'mg-hint', kc, '');
    this.root = r;
    UI.mount(r);
  }
}
