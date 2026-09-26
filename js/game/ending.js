// The normal ending (1 Nov, dawn): Peachi is herself again, explains PeachiBot, asks "ยังคิดถึงกันมั้ยคะ?"
// (the "ไม่" button runs from the mouse), a shooting star takes one wish, "I'll see you soon", the mod
// ends the stream. Then the stream-ended card, the Happy Halloween card (save it as a PNG) and the credits
// (made by Master Tankhun), the bloopers (four NG takes with the real cast) and a last wave from the shadow.
import * as THREE from 'three';
import { UI } from '../ui.js';
import { sfx } from '../audio.js';
import { Save } from './save.js';
import { Ach } from './meta.js';

const el = (tag, cls, parent, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; if (parent) parent.appendChild(n); return n; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const WISHES = [
  ['live', 'ขอให้พีชชี่ไลฟ์บ่อยๆ', 'ไลฟ์บ่อยๆ เหรอ… ได้เลย! แต่ไม่ถึง 249 ชั่วโมงแล้วนะ'],
  ['fans', 'ขอให้ลูกพีชน้อยทุกคนมีความสุข', 'ขอพรให้คนอื่นด้วย… มอดคนนี้ใจดีจัง'],
  ['snack', 'ขอขนมพีชตลอดชีพ', 'ขนมพีชตลอดชีพ!? อันนี้พีชชี่ขอแบ่งด้วยนะ'],
];
const CREDITS = [
  ['big', 'ทำโดย'], ['huge', 'Master Tankhun'], ['sub', 'Master Tankhun | Tankhun Gaming'], ['gap'],
  ['h', 'ตัวละคร'], ['', 'PeachiView — youtube.com/@PeachiView249'], ['gap'],
  ['h', 'นักแสดงรับเชิญ (เบื้องหลัง)'], ['', 'กระสือ_Official — "ถอดหัวได้ยัง ร้อนมาก"'], ['', 'ผีปอบ (สายกิน) — "ค่าอาหารเบิกได้ที่ไหน"'],
  ['', 'PeachiBot — "ขออภัยในความไม่สะดวกค่ะ :)"'], ['', 'ตัวดำ — (โบกมือ)'], ['gap'],
  ['h', 'เครื่องมือ'], ['', 'three.js'], ['', 'ฟอนต์ Kanit, Mitr, Sriracha (SIL OFL)'], ['', 'เสียงสังเคราะห์ด้วย Web Audio'], ['', 'รูปลับพีชชี่: รูปที่แจกให้แฟนใช้ฟรี'], ['gap'],
  ['h', 'ขอบคุณ'], ['', 'ลูกพีชน้อยทุกคน'], ['', 'มอดทุกคนที่ทำงานฟรี'], ['', 'ลูกพีชน้อย_1702 ที่รอมาตลอด'], ['gap'],
  ['note', 'แฟนเกมไม่เป็นทางการ ภาพลักษณ์ตัวละครเป็นของ PeachiView'], ['gap'], ['big', 'Happy Halloween 🎃'],
];

export class Ending {
  constructor() { this._dom(); }

  /**
   * Runs the whole ending. ctx: { cut, peachi, level, stats: [[label, value]], actors: { krasue, pop, boss } }.
   * Resolves when the credits end.
   */
  async play({ cut, peachi, level, stats = [], actors = {} }) {
    if (document.pointerLockElement) document.exitPointerLock();
    let wish = WISHES[0];
    await cut.run(async (c) => {
      await c.fade(1, 500);
      level.setPower(true); level.setFlicker(false); level.setRoomLights('stream', true);
      level.moon.color.setHex(0xffc890); level.moon.intensity *= 1.4; // sunrise through the blinds
      peachi.freeze();
      peachi.model.setDesat(0); peachi.model.setGlow(0); peachi.model.setHeadphones(true);
      peachi.group.visible = true; peachi.group.position.set(-5.62, 0, -5.0); peachi.group.rotation.y = 0.25;
      peachi._setPose('idle'); peachi._setExpression('happy'); peachi.lookOverride = null;
      c.set([-4.9, 1.45, -3.2], [-5.6, 1.2, -5.0]);
      sfx.play('peachShine');
      await c.fade(0, 900);
      await c.say('peachi', 'เช้าแล้ว… ขากลับมาแล้วด้วย ดูสิ ไม่ลอยแล้ว!', { clean: true });
      await c.say('peachi', 'PeachiBot น่ะ พีชชี่ทำไว้แกล้งคนใน REALITY… แล้วลืมปิด ขอโทษนะ', { clean: true });
      await c.say('peachi', 'ส่วนกระสือกับผีปอบ… ผีรับจ้างคอลแลป ค่าตัวแพงมาก', { clean: true });
      await c.say('peachi', 'ยังคิดถึงกันมั้ยคะ?', { clean: true, hold: 600 });
      const miss = await this._choice('ยังคิดถึงกันมั้ยคะ?', [['yes', 'คิดถึงสิ'], ['no', 'ไม่']], true);
      if (miss === 'no') await c.say('peachi', 'กดไม่ได้จริงด้วย… งอนแล้ว! แต่นับเป็นคิดถึงนะ', { clean: true });
      else await c.say('peachi', 'คิดถึงเหมือนกัน!', { clean: true });
      sfx.play('sparkle', { vol: 1 });
      UI.flash('#fff4d0');
      const w = await this._choice('ดาวตก! ขอพร 1 ข้อ', WISHES.map(([id, label]) => [id, label]));
      wish = WISHES.find((x) => x[0] === w) || wish;
      await c.say('peachi', wish[2], { clean: true });
      await c.say('peachi', "I'll see you soon — คราวนี้ soon จริงๆ นะ!", { clean: true, hold: 3200 });
      await c.to([-5.6, 1.4, -5.9], [-5.73, 1.15, -6.66], 1.2);
      sfx.play('endStream');
      await c.fade(1, 800);
    }, { skippable: true, id: 'ending' });
    UI.subtitle(null);
    Save.data.endings.normal = Date.now(); Save.set({ lastWish: wish[0] });
    Ach.unlock('halloween');
    // cards
    UI.fade(1, 10);
    await this._card('ended');
    await this._card('halloween', stats);
    await this._credits();
    try { await this._bloopers({ cut, peachi, level, actors }); } catch (e) { console.error('[bloopers]', e); }
    await this._sting();
    UI.fade(0, 400);
  }

  _choice(title, options, runaway = false) {
    return new Promise((resolve) => {
      this.qTitle.textContent = title;
      this.qBtns.replaceChildren();
      options.forEach(([id, label], i) => {
        const b = el('button', 'end-btn', this.qBtns, label);
        b.type = 'button';
        b.onclick = () => { this.q.classList.remove('on'); sfx.play('pickup'); resolve(id); };
        if (runaway && id === 'no') {
          b.classList.add('run');
          b.onmouseenter = () => { b.style.transform = `translate(${(Math.random() - 0.5) * 360}px, ${(Math.random() - 0.5) * 160}px)`; sfx.play('pop'); };
        }
        if (i === 0) setTimeout(() => b.focus(), 50);
      });
      this.q.classList.add('on');
    });
  }

  _card(kind, stats = []) {
    return new Promise((resolve) => {
      const C = this.card;
      C.replaceChildren();
      C.className = `end-sheet on ${kind}`;
      if (kind === 'ended') {
        el('div', 'es-live', C, '● LIVE จบแล้ว');
        el('div', 'es-big', C, 'ไลฟ์จบแล้ว');
        el('div', 'es-time tnum', C, 'ความยาว 249:00:00');
        setTimeout(() => { C.classList.remove('on'); resolve(); }, 3200);
        return;
      }
      C.innerHTML = PUMPKIN;
      el('div', 'es-hh', C, 'Happy Halloween!');
      el('div', 'es-msg', C, 'ขอให้คืนฮาโลวีนนี้สนุกนะคะ ลูกพีชน้อยทุกคน');
      el('div', 'es-from', C, '— จาก พีชชี่ และ Master Tankhun');
      const st = el('div', 'es-stats', C);
      for (const [k, v] of stats) { const r = el('div', null, st); el('span', null, r, k); el('b', null, r, String(v)); }
      const row = el('div', 'es-row', C);
      const save = el('button', 'end-btn', row, 'บันทึกการ์ด (PNG)'); save.type = 'button';
      save.onclick = () => this._png(stats);
      const next = el('button', 'end-btn', row, 'ดูเครดิต →'); next.type = 'button';
      next.onclick = () => { C.classList.remove('on'); resolve(); };
      sfx.play('win');
    });
  }

  _png(stats) {
    const c = document.createElement('canvas'); c.width = 1080; c.height = 1350;
    const g = c.getContext('2d');
    const bg = g.createLinearGradient(0, 0, 0, 1350); bg.addColorStop(0, '#2a0f3a'); bg.addColorStop(1, '#ff8a3a');
    g.fillStyle = bg; g.fillRect(0, 0, 1080, 1350);
    g.fillStyle = '#ff7a1a'; g.beginPath(); g.ellipse(540, 420, 230, 190, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#1a0a12'; g.beginPath(); g.moveTo(450, 380); g.lineTo(500, 330); g.lineTo(520, 400); g.fill(); g.beginPath(); g.moveTo(630, 380); g.lineTo(580, 330); g.lineTo(560, 400); g.fill();
    g.beginPath(); g.moveTo(420, 470); g.quadraticCurveTo(540, 560, 660, 470); g.quadraticCurveTo(540, 510, 420, 470); g.fill();
    g.textAlign = 'center'; g.fillStyle = '#fff4e0';
    g.font = '400 110px Sriracha, cursive'; g.fillText('Happy Halloween!', 540, 780);
    g.font = '500 40px Mitr, sans-serif'; g.fillText('ขอให้คืนฮาโลวีนนี้สนุกนะคะ ลูกพีชน้อยทุกคน', 540, 860);
    g.font = '400 36px Sriracha, cursive'; g.fillText('— จาก พีชชี่ และ Master Tankhun', 540, 920);
    g.font = '500 32px Kanit, sans-serif';
    stats.slice(0, 5).forEach(([k, v], i) => g.fillText(`${k}: ${v}`, 540, 1020 + i * 48));
    g.font = '400 26px Kanit, sans-serif'; g.fillStyle = 'rgba(255,244,224,0.7)'; g.fillText('PeachiView Halloween · แฟนเกมไม่เป็นทางการ', 540, 1310);
    const a = document.createElement('a'); a.download = 'peachi-happy-halloween.png'; a.href = c.toDataURL('image/png'); a.click();
  }

  _credits() {
    return new Promise((resolve) => {
      const R = this.roll;
      R.replaceChildren();
      const inner = el('div', 'cr-inner', R);
      for (const [cls, text] of CREDITS) el('div', `cr-line ${cls}`, inner, text || '');
      R.classList.add('on');
      const seen = Save.data.scenes || {};
      const canSkip = !!seen.credits; // like the scenes: skippable once watched to the end
      const skip = (e) => { if (canSkip && (e.code === 'Enter' || e.code === 'Escape' || e.type === 'click')) done(); };
      const done = (whole) => {
        window.removeEventListener('keydown', skip); R.removeEventListener('click', skip); clearTimeout(this._crT);
        R.classList.remove('on');
        if (whole === true && !seen.credits) Save.set({ scenes: { ...(Save.data.scenes || {}), credits: 1 } });
        resolve();
      };
      window.addEventListener('keydown', skip); R.addEventListener('click', skip);
      R.classList.toggle('no-skip', !canSkip);
      this._crT = setTimeout(() => done(true), 26000);
    });
  }

  /** After everything: the shadow waves from the monitor. */
  async _sting() {
    this.sting.classList.add('on'); sfx.play('glitch', { n: 5 });
    await wait(2600);
    this.sting.classList.remove('on');
  }

  // ---------------------------------------------------------------- bloopers
  /** Four NG takes with the real cast (Enter skips all). Actors missing → that take is left out. */
  async _bloopers({ cut, peachi, level, actors }) {
    const { krasue, pop, boss } = actors;
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const B = this.bl;
    let take = 0;
    const clap = async (c, label) => { // the clapperboard: title card for each take
      take++;
      B.take.textContent = `${label} · เทค ${take + 2}`;
      B.ng.classList.remove('on');
      UI.subtitle(null);
      B.clap.classList.add('on'); sfx.play('switch');
      await c.wait(0.7);
      B.clap.classList.remove('on');
    };
    const ng = async (c) => { B.ng.classList.remove('on'); void B.ng.offsetWidth; B.ng.classList.add('on'); sfx.play('denied'); await c.wait(1.1); };
    this.onSet = { krasue, pop, boss, cam: cut.camera };
    await cut.run(async (c) => {
      UI.fade(1, 10);
      B.root.classList.add('on');
      level.setPower(true); level.setFlicker(false);
      for (const r of ['stream', 'kitchen', 'living', 'hallway']) level.setRoomLights(r, true);
      peachi.group.visible = false;
      await c.fade(0, 400);

      if (krasue) { // 1 · Krasue: "it's so hot, can I take my head off?"
        krasue.reset(); krasue.freeze(); krasue.onSet = true;
        krasue.place(V(6.3, 1.45, 3.6), V(4.2, 1.5, 3.4)); krasue.setExpression('smile');
        c.set([4.3, 1.55, 3.4], [6.3, 1.4, 3.6]);
        await clap(c, 'กระสือ_Official');
        await c.say('krasue', 'บ๊ายบาย~ ✨ …คัทยังคะ? ร้อนมาก ถอดหัวได้ยัง', { hold: 2400 });
        krasue.setExpression('annoyed');
        await c.say('krasue', 'เอ๊ย หัวถอดอยู่แล้วนี่ ถอดตัวต่างหาก… ตัวอยู่ไหนเนี่ย', { hold: 2400 });
        sfx.play('cackle');
        await ng(c);
        krasue.reset(); krasue.onSet = false;
      }
      if (pop) { // 2 · Phi Pop asks where to claim the food money
        pop.reset(); pop.group.visible = true; pop.position.set(-6.2, 0, 3.6); pop.yaw = Math.PI; pop.state = 'eat'; pop.stateT = 0; pop.moving = false;
        c.set([-6.1, 1.35, 1.7], [-6.2, 1.1, 3.6]);
        await clap(c, 'ผีปอบ (สายกิน)');
        await c.say('pop', 'ง่ำๆๆ… ขนมพร็อพนี่กินได้จริงนะหลาน', { hold: 2200 });
        pop.state = 'burp'; pop.stateT = 0; sfx.play('burp');
        await c.wait(0.8);
        pop.state = 'idle';
        await c.say('pop', 'ว่าแต่… ค่าอาหารเบิกได้ที่ไหน หมูกระทะสามถาดนะ', { hold: 2400 });
        await ng(c);
        pop.reset();
      }
      if (boss) { // 3 · PeachiBot drops the ban hammer on its own head
        boss.cameo(V(-5.4, 1.85, -4.6), 'smile');
        c.set([-4.0, 1.7, -2.6], [-5.4, 1.75, -4.6]);
        await clap(c, 'PeachiBot');
        await c.say('bot', 'ขออภัยในความไม่สะดวกค่ะ :) เดี๋ยวบอทจะแบนให้ดูนะคะ', { hold: 2200 });
        boss.swingTo('window');
        await c.wait(0.9);
        boss.swingTo('slam'); boss.setFace('dizzy'); sfx.play('bash'); UI.shake(300); c.shake = 0.01;
        await c.wait(0.4); c.shake = 0;
        await c.say('bot', 'ข้อผิดพลาด: ค้อนตกใส่หัวตัวเอง… ขอเทคใหม่นะคะ @_@', { hold: 2400 });
        await ng(c);
        boss.stop();
      }
      // 4 · the shadow in the hallway waves… it's Peachi, laughing
      peachi.group.visible = true; peachi.group.position.set(2.2, 0, 0); peachi.group.rotation.y = -Math.PI / 2;
      peachi.model.setDark(1); peachi._setPose('reach'); peachi._setExpression('happy'); peachi.lookOverride = null;
      c.set([0.1, 1.45, 0.1], [2.2, 1.2, 0]);
      await clap(c, 'ตัวดำ (รับเชิญ)');
      await c.wait(1.6);
      sfx.play('switch'); peachi.model.setDark(0); peachi._setPose('idle');
      await c.say('peachi', 'ตกใจมั้ยล่ะ 555 ตัวดำก็พีชชี่เองแหละ! …ฉากนี้ตัดออกด้วยนะ', { hold: 2600 });
      sfx.play('giggle');
      await ng(c);
      await c.fade(1, 500);
    }, { skippable: true, id: 'bloopers' });
    this.onSet = null;
    B.root.classList.remove('on');
    UI.subtitle(null);
    if (krasue) { krasue.onSet = false; krasue.reset(); }
    if (pop) pop.reset();
    if (boss) boss.stop();
    peachi.model.setDark(0);
    peachi.group.visible = false;
  }

  /** While a blooper plays: keep the cast breathing (the director calls this in its 'ending' state). */
  update(dt, t) {
    const S = this.onSet;
    if (!S) return;
    if (S.krasue && S.krasue.visible) S.krasue.update(dt, t, {});
    if (S.pop && S.pop.group.visible) S.pop._pose(dt, t);
    if (S.boss) S.boss.idle(dt, t, S.cam.position);
  }

  _dom() {
    const r = el('div', 'ending');
    this.q = el('div', 'end-q', r);
    this.qTitle = el('div', 'end-q-title', this.q);
    this.qBtns = el('div', 'end-q-btns', this.q);
    this.card = el('div', 'end-sheet', r);
    this.roll = el('div', 'credits-roll', r);
    this.sting = el('div', 'end-sting', r);
    el('div', 'sting-live', this.sting, '● LIVE');
    el('div', 'sting-wave', this.sting, '👋');
    el('div', 'sting-text', this.sting, 'ปลดล็อก: คืนที่ 249 (เร็วๆ นี้)');
    const bl = el('div', 'blooper', r); // camcorder frame over the 3D takes
    el('div', 'bl-rec', bl, '● REC');
    el('div', 'bl-title', bl, 'บลูเปอร์');
    const take = el('div', 'bl-take', bl, '');
    const clap = el('div', 'bl-clap', bl);
    el('div', 'bl-clap-top', clap);
    el('div', 'bl-clap-text', clap, 'แอ็กชั่น!');
    const ng = el('div', 'bl-ng', bl, 'NG!');
    this.bl = { root: bl, take, clap, ng };
    UI.mount(r);
  }
}

const PUMPKIN = `<svg class="es-pumpkin" viewBox="0 0 200 170" aria-hidden="true">
  <path d="M100 30 q-6 -18 10 -26" stroke="#4a6a20" stroke-width="8" fill="none" stroke-linecap="round"/>
  <ellipse cx="100" cy="100" rx="90" ry="66" fill="#ff7a1a"/><ellipse cx="100" cy="100" rx="40" ry="66" fill="#ff8f3a"/>
  <path d="M60 85 l20 -22 l12 26 z M140 85 l-20 -22 l-12 26 z" fill="#1a0a12"/>
  <path d="M55 115 q45 40 90 0 q-45 18 -90 0 z" fill="#1a0a12"/></svg>`;
