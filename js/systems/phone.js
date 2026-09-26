// The mod's phone (Tab). It comes up while the night keeps going (no pause, FNAF-style). Tabs:
//   ภารกิจ  — the night's goal, Peachi's request, super-chat missions, and actions (send the Wi-Fi password)
//   รายงาน  — report an anomaly: pick the room, then what changed (Night 2)
//   แผนที่  — the house plan: which rooms are lit, which doors are shut, you, the breaker / the peach
//   กล้อง   — the photos taken tonight; C / right click raises the camera anywhere
// Camera mode: a viewfinder, mouse wheel zooms, left click shoots (flash + shutter). A photo is scored by
// what's in frame (ghosts, anomalies), how close and how centered, whether they face you and whether they
// are doing something special (Krasue posing). The thumbnail is grabbed right after the frame renders.
import * as THREE from 'three';
import { UI } from '../ui.js';
import { sfx } from '../audio.js';
import { Settings } from '../settings.js';
import { KINDS, ROOM_NAMES, REPORT_ROOMS } from './anomalies.js';
import { roomsLinked } from '../ghosts/nav.js';

const TABS = [['missions', 'ภารกิจ'], ['report', 'รายงาน'], ['map', 'แผนที่'], ['camera', 'กล้อง']];
const MIN_FOV = 28;
const pad = (n) => String(Math.max(0, Math.floor(n))).padStart(2, '0');
const el = (tag, cls, parent, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; if (parent) parent.appendChild(n); return n; };
const _ndc = new THREE.Vector3(), _v = new THREE.Vector3();

export class Phone {
  constructor({ camera, player, level }) {
    this.camera = camera;
    this.player = player;
    this.level = level;
    this.enabled = false;  // the director turns it on while a night is being played
    this.open = false;
    this.cameraUp = false;
    this.tab = 'missions';
    this.sel = 0;
    this.reportRoom = null;
    this.photos = [];
    this.zoom = 0;
    this.shotCool = 0;
    this.pending = null;
    // what the night provides
    this.provider = null; // { missionRows(), actions(), report(room, kind), reportEnabled, reportInfo(), mapInfo(), subjects(), onPhoto(photo) }
    this._dom();
    window.addEventListener('keydown', (e) => this._key(e));
    window.addEventListener('mousedown', (e) => this._mouse(e));
    window.addEventListener('contextmenu', (e) => { if (this.enabled) e.preventDefault(); });
    window.addEventListener('wheel', (e) => this._wheel(e), { passive: true });
  }

  /** Photo-taking or phone use shouldn't happen right now (cutscene, hidden, QTE…). */
  get busy() { return this.cameraUp; }

  reset() {
    this.close();
    this.lower();
    this.photos = [];
    this.gallery.replaceChildren();
    this.provider = null;
  }

  // ---------------------------------------------------------------- open / close
  toggle() { if (this.open) this.close(); else this.show(); }
  show(tab) {
    if (!this.enabled || this.cameraUp) return;
    if (tab) this.tab = tab;
    this.open = true;
    this.player.blockArrows = true;
    this.root.classList.add('on');
    this.sel = 0;
    sfx.play('tick');
    this._render();
  }
  close() {
    if (!this.open) return;
    this.open = false;
    this.player.blockArrows = false;
    this.root.classList.remove('on');
    this.reportRoom = null;
  }

  raise() {
    if (!this.enabled || this.cameraUp || !this.player.enabled) return;
    this.close();
    this.cameraUp = true;
    this.zoom = 0;
    this.finder.classList.add('on');
    sfx.play('switch');
  }
  lower() {
    if (!this.cameraUp) return;
    this.cameraUp = false;
    this.finder.classList.remove('on');
    this._applyZoom(true);
  }

  // ---------------------------------------------------------------- input
  _key(e) {
    if (!this.enabled) return;
    if (e.code === 'Tab') { e.preventDefault(); if (this.cameraUp) this.lower(); this.toggle(); return; }
    if (e.code === 'KeyC' && !e.repeat) { if (this.cameraUp) this.lower(); else this.raise(); return; }
    if (!this.open) return;
    const n = this.items.length;
    if (e.code === 'ArrowDown') { e.preventDefault(); if (n) { this.sel = (this.sel + 1) % n; this._render(); sfx.play('tick'); } }
    else if (e.code === 'ArrowUp') { e.preventDefault(); if (n) { this.sel = (this.sel - 1 + n) % n; this._render(); sfx.play('tick'); } }
    else if (e.code === 'ArrowRight' || e.code === 'ArrowLeft') { e.preventDefault(); this._tab(e.code === 'ArrowRight' ? 1 : -1); }
    else if (/^Digit[1-4]$/.test(e.code)) { this.tab = TABS[Number(e.code.slice(5)) - 1][0]; this.sel = 0; this.reportRoom = null; this._render(); sfx.play('tick'); }
    else if (e.code === 'Enter' || e.code === 'NumpadEnter') { e.preventDefault(); this._pick(); }
    else if (e.code === 'Backspace') { if (this.reportRoom) { this.reportRoom = null; this.sel = 0; this._render(); } }
  }
  _mouse(e) {
    if (!this.enabled) return;
    if (e.button === 2) { if (this.cameraUp) this.lower(); else this.raise(); return; }
    if (e.button === 0 && this.cameraUp) this.shoot();
  }
  _wheel(e) {
    if (!this.enabled) return;
    if (this.cameraUp) { this.zoom = Math.max(0, Math.min(1, this.zoom + (e.deltaY < 0 ? 0.12 : -0.12))); return; }
    if (this.open && this.items.length) { this.sel = (this.sel + (e.deltaY > 0 ? 1 : -1) + this.items.length) % this.items.length; this._render(); }
  }
  _tab(d) {
    const i = TABS.findIndex((t) => t[0] === this.tab);
    this.tab = TABS[(i + d + TABS.length) % TABS.length][0];
    this.sel = 0; this.reportRoom = null;
    sfx.play('tick');
    this._render();
  }
  _pick() {
    const it = this.items[this.sel];
    if (!it || it.disabled) { sfx.play('denied'); return; }
    it.run();
  }

  // ---------------------------------------------------------------- camera
  _applyZoom(reset) {
    const base = Settings.get().fov || 70;
    const fov = reset ? base : base + (MIN_FOV - base) * this.zoom;
    if (Math.abs(this.camera.fov - fov) > 0.01) { this.camera.fov = fov; this.camera.updateProjectionMatrix(); }
  }

  shoot() {
    if (!this.cameraUp || this.shotCool > 0) return;
    this.shotCool = 0.9;
    sfx.play('shutter');
    UI.flash('#ffffff');
    const photo = this._score();
    this.pending = photo; // the thumbnail is grabbed after this frame renders (see capture)
    if (this.provider && this.provider.onPhoto) this.provider.onPhoto(photo);
  }

  /** Called by the main loop right after rendering: grab the thumbnail for a pending photo. */
  capture(canvas) {
    const p = this.pending;
    if (!p) return;
    this.pending = null;
    try {
      const c = this._thumb || (this._thumb = document.createElement('canvas'));
      c.width = 240; c.height = 135;
      const g = c.getContext('2d');
      const sw = canvas.width, sh = canvas.height, ar = 240 / 135;
      let w = sw, h = sw / ar; if (h > sh) { h = sh; w = sh * ar; }
      g.drawImage(canvas, (sw - w) / 2, (sh - h) / 2, w, h, 0, 0, 240, 135);
      p.url = c.toDataURL('image/jpeg', 0.72);
    } catch (e) { p.url = null; }
    this.photos.push(p);
    if (this.photos.length > 12) this.photos.shift();
    this._polaroid(p);
    if (this.open && this.tab === 'camera') this._render();
  }

  _score() {
    const cam = this.camera;
    const here = this.level.roomAt(this.player.position);
    const list = (this.provider && this.provider.subjects && this.provider.subjects()) || [];
    const hits = [];
    for (const s of list) {
      if (!s || !s.pos || s.visible === false) continue;
      _v.copy(s.pos);
      const d = cam.position.distanceTo(_v);
      if (d > (s.range || 12)) continue;
      _ndc.copy(_v).project(cam);
      if (_ndc.z > 1 || Math.abs(_ndc.x) > 0.95 || Math.abs(_ndc.y) > 0.95) continue;
      if (!roomsLinked(this.level, here, this.level.roomAt(_v))) continue;
      const center = 1 - Math.min(1, Math.hypot(_ndc.x, _ndc.y)) * 0.5;
      const near = Math.max(0.35, Math.min(1.5, 1.7 - d / 7)) * (1 + this.zoom * 0.4);
      const facing = s.facing ? !!s.facing() : false;
      const special = s.special ? !!s.special() : false;
      const score = Math.round((s.base || 30) * center * near * (facing ? 1.3 : 1) * (special ? 2 : 1));
      hits.push({ ...s, score, facing, special, dist: d });
    }
    hits.sort((a, b) => b.score - a.score);
    const total = hits.reduce((n, h) => n + h.score, 0);
    const best = hits[0];
    let caption = 'บ้านมืดๆ… ไม่มีอะไรในรูป';
    if (best) caption = typeof best.caption === 'function' ? best.caption(best) : best.caption || best.name;
    return { t: performance.now(), score: total, subjects: hits.map((h) => h.kind), ids: hits.map((h) => h.id || h.kind), hits, caption, url: null };
  }

  _polaroid(p) {
    const card = el('div', 'polaroid', null);
    if (p.url) { const img = el('img', null, card); img.src = p.url; img.alt = ''; } else el('div', 'polaroid-blank', card);
    el('div', 'polaroid-cap', card, p.caption);
    if (p.score > 0) el('div', 'polaroid-score tnum', card, `+${p.score}`);
    this.polaroids.appendChild(card);
    while (this.polaroids.children.length > 2) this.polaroids.firstChild.remove();
    setTimeout(() => card.classList.add('out'), 2600);
    setTimeout(() => card.remove(), 3200);
  }

  // ---------------------------------------------------------------- update
  update(dt) {
    if (this.shotCool > 0) this.shotCool -= dt;
    if (!this.enabled) { if (this.open) this.close(); if (this.cameraUp) this.lower(); return; }
    if (this.cameraUp) {
      if (!this.player.enabled) { this.lower(); return; }
      this._applyZoom(false);
      this.zoomEl.textContent = `${(1 + this.zoom * 1.5).toFixed(1)}×`;
    }
    if (this.open) {
      this.refreshT = (this.refreshT || 0) - dt;
      if (this.refreshT <= 0) { this.refreshT = 0.25; this._render(); }
    }
    const [h, m] = UI.clockText ? UI.clockText() : [0, 0];
    this.timeEl.textContent = `${pad(h)}:${pad(m)}`;
  }

  // ---------------------------------------------------------------- DOM
  _dom() {
    const r = el('div', 'mphone');
    const bar = el('div', 'mphone-bar', r);
    this.timeEl = el('span', 'tnum', bar, '00:00');
    el('span', null, bar, 'มอด · 5G ▮▮▮');
    const tabs = el('div', 'mphone-tabs', r);
    this.tabEls = {};
    TABS.forEach(([id, label], i) => { const t = el('div', 'mphone-tab', tabs); el('b', null, t, String(i + 1)); el('span', null, t, label); this.tabEls[id] = t; });
    this.body = el('div', 'mphone-body', r);
    this.gallery = el('div', 'mphone-gallery');
    const foot = el('div', 'mphone-foot', r);
    foot.innerHTML = '<kbd>↑↓</kbd> เลือก <kbd>Enter</kbd> ตกลง <kbd>←→</kbd> แท็บ <kbd>Tab</kbd> ปิด';
    this.root = r;
    UI.mount(r);

    const f = el('div', 'finder');
    for (const c of ['tl', 'tr', 'bl', 'br']) el('div', `finder-c ${c}`, f);
    const top = el('div', 'finder-top', f);
    el('span', 'finder-rec', top, 'REC');
    this.zoomEl = el('span', 'finder-zoom tnum', top, '1.0×');
    el('div', 'finder-reticle', f);
    const hint = el('div', 'finder-hint', f);
    hint.innerHTML = '<kbd>คลิกซ้าย</kbd> ถ่าย &nbsp; <kbd>ล้อเมาส์</kbd> ซูม &nbsp; <kbd>C</kbd> / <kbd>คลิกขวา</kbd> ลดกล้อง';
    this.finder = f;
    UI.mount(f);
    this.polaroids = el('div', 'polaroids');
    UI.mount(this.polaroids);
    this.items = [];
  }

  _render() {
    if (!this.open) return;
    for (const [id] of TABS) this.tabEls[id].classList.toggle('on', id === this.tab);
    const P = this.provider || {};
    const body = this.body;
    body.replaceChildren();
    this.items = [];
    const item = (label, run, { sub, disabled, cls } = {}) => {
      const i = this.items.length;
      const row = el('div', `mrow sel${cls ? ' ' + cls : ''}${i === this.sel ? ' on' : ''}${disabled ? ' off' : ''}`, body);
      el('div', 'mrow-t', row, label);
      if (sub) el('div', 'mrow-s', row, sub);
      this.items.push({ run, disabled });
      return row;
    };
    const info = (label, sub, cls) => { const row = el('div', `mrow${cls ? ' ' + cls : ''}`, body); el('div', 'mrow-t', row, label); if (sub) el('div', 'mrow-s', row, sub); return row; };
    const head = (t) => el('div', 'mhead', body, t);

    if (this.tab === 'missions') {
      const rows = (P.missionRows && P.missionRows()) || [];
      if (!rows.length) info('ไม่มีภารกิจตอนนี้', 'รอดให้ถึงหกโมงเช้าก็พอ');
      for (const m of rows) {
        const left = m.left != null ? ` · ${Math.floor(m.left / 60)}:${pad(m.left % 60)}` : '';
        info(m.text, (m.sub || '') + left, m.done ? 'done' : m.urgent ? 'urgent' : m.kind || '');
      }
      const acts = ((P.actions && P.actions()) || []).filter(Boolean);
      if (acts.length) head('ทำได้ตอนนี้');
      for (const a of acts) item(a.label, () => { a.run(); this._render(); }, { sub: a.sub, disabled: a.disabled });
    } else if (this.tab === 'report') {
      if (!P.reportEnabled) { info('ยังไม่มีอะไรผิดปกติ…', 'มั้ง'); }
      else if (!this.reportRoom) {
        const r = P.reportInfo ? P.reportInfo() : null;
        if (r) info(r.title, r.sub, 'note');
        head('1 · เกิดที่ห้องไหน');
        const here = this.level.roomAt(this.player.position);
        const rooms = [...REPORT_ROOMS].sort((a, b) => (b === here) - (a === here));
        for (const k of rooms) item(ROOM_NAMES[k], () => { this.reportRoom = k; this.sel = 0; sfx.play('tick'); this._render(); }, { sub: k === here ? 'ห้องที่อยู่ตอนนี้' : null });
      } else {
        head(`2 · ${ROOM_NAMES[this.reportRoom]} — อะไรเปลี่ยนไป`);
        for (const k of KINDS) item(k.label, () => { const room = this.reportRoom; this.reportRoom = null; this.sel = 0; if (P.report) P.report(room, k.id); this._render(); });
        item('← เลือกห้องใหม่', () => { this.reportRoom = null; this.sel = 0; this._render(); }, { cls: 'back' });
      }
    } else if (this.tab === 'map') {
      body.appendChild(this._map(P.mapInfo ? P.mapInfo() : {}));
    } else if (this.tab === 'camera') {
      item('ยกกล้องขึ้นถ่าย', () => this.raise(), { sub: 'หรือกด C / คลิกขวา ได้ทุกเมื่อ' });
      if (!this.photos.length) info('ยังไม่มีรูป', 'ถ่ายผี ถ่ายของแปลกๆ คนดูชอบ');
      else {
        head(`รูปคืนนี้ ${this.photos.length} รูป`);
        const g = el('div', 'mgallery', body);
        for (const p of this.photos.slice().reverse().slice(0, 6)) {
          const c = el('div', 'mshot', g);
          if (p.url) { const img = el('img', null, c); img.src = p.url; img.alt = ''; }
          el('div', 'mshot-cap', c, `${p.caption}${p.score ? ` (+${p.score})` : ''}`);
        }
      }
    }
    if (this.sel >= this.items.length) this.sel = Math.max(0, this.items.length - 1);
  }

  _map(M = {}) {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '-10.4 -7.4 20.8 14.8');
    svg.setAttribute('class', 'mmap');
    const add = (tag, attrs, text) => { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); if (text != null) n.textContent = text; svg.appendChild(n); return n; };
    const L = this.level;
    for (const k in L.rooms) {
      const r = L.rooms[k];
      add('rect', { x: r.x0, y: r.z0, width: r.x1 - r.x0, height: r.z1 - r.z0, class: `mroom${L.roomLit(k) ? ' lit' : ''}` });
      if (k !== 'hallway') add('text', { x: (r.x0 + r.x1) / 2, y: (r.z0 + r.z1) / 2 + 0.35, class: 'mlabel' }, ROOM_NAMES[k]);
    }
    for (const d of Object.values(L.doors)) {
      if (!d.center) continue;
      add('circle', { cx: d.center.x, cy: d.center.z, r: 0.32, class: `mdoor${L.doorOpen(d.id) ? ' open' : ''}` });
    }
    for (const ic of M.icons || []) add('text', { x: ic.x, y: ic.z + 0.35, class: `micon ${ic.cls || ''}` }, ic.icon);
    const p = this.player.position, yaw = this.player.yaw;
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    add('path', { d: `M ${p.x + fx * 0.9} ${p.z + fz * 0.9} L ${p.x - fz * 0.45} ${p.z + fx * 0.45} L ${p.x + fz * 0.45} ${p.z - fx * 0.45} Z`, class: 'mme' });
    const wrap = el('div', 'mmap-wrap');
    wrap.appendChild(svg);
    if (M.hint) el('div', 'mmap-hint', wrap, M.hint);
    const legend = el('div', 'mmap-legend', wrap);
    legend.innerHTML = '<span class="lg lit"></span>ไฟเปิด <span class="lg door"></span>ประตูปิด <span class="lg me"></span>คุณ';
    return wrap;
  }
}
