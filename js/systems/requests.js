// Peachi's requests: every so often (when she isn't angry) she wants something. Doing it in time calms
// her down and the chat loves it; ignoring it makes her sulk. Night 1: hungry, dark, lonely.
import * as THREE from 'three';
import { sfx } from '../audio.js';
import { UI } from '../ui.js';
import { Scream } from '../mic.js';
import { Talk } from '../game/talk.js';

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const SNACKS = [
  { name: 'ขนมพีช', line: 'ขนมพีช!! มอดรู้ใจที่สุดดด' },
  { name: 'มันฝรั่งทอด', line: 'กรอบบบ… ผีก็กินของกรอบได้นะ รู้ยัง' },
  { name: 'ช็อกโกแลต', line: 'หวานเหมือนพีชชี่เลย… ไม่ได้ชมตัวเองนะ ข้อเท็จจริง' },
  { name: 'ผักบุ้ง', line: 'นี่มันผักบุ้ง!? …ก็ได้ ผีก็ต้องกินผัก', joke: true },
  { name: 'ปลากระป๋อง', line: 'มอดคิดว่าพีชชี่เป็นแมวเหรอ… (กินหมดเกลี้ยง)', joke: true },
  { name: 'มาม่าต้มยำ', line: 'มาม่าตอนตีสอง… มอดเข้าใจชีวิตสตรีมเมอร์' },
];

export const REQUESTS = {
  hungry: {
    note: 'หิวอ่า ขอขนมหน่อย',
    ask: ['หิวอ่าาา มอดมีขนมมั้ย ชั้นขนมอยู่ในครัวนะ', 'ท้องร้องแล้ววว ผีก็หิวเป็นนะ!', 'ขนม… ขนม… ใครก็ได้เอาขนมมาให้หน่อยยย'],
    fail: 'หิวจนงอนแล้ว… ไม่คุยด้วยแล้ว',
  },
  dark: {
    note: 'มืดจัง เปิดไฟห้องให้หน่อย',
    ask: ['กรี๊ด! ไฟดับ! มอดเปิดไฟห้องสตรีมให้หน่อย สวิตช์อยู่ข้างประตู', 'มืดจังงง พีชชี่กลัวความมืด… ทั้งที่เป็นผีเนี่ยแหละ'],
    ok: ['สว่างแล้ววว ไฟนางฟ้าสวยที่สุดในโลก', 'ขอบคุณมอด! ความมืดน่ากลัวจะตาย'],
    fail: 'มืดตื๋อเลย… มอดใจร้าย',
  },
  lonely: {
    note: 'เหงา อยู่เป็นเพื่อนหน่อย',
    ask: ['เหงาอ่า… มาอยู่ใกล้ๆ พีชชี่หน่อยสิ', 'คุยกับพีชชี่หน่อยได้มั้ย แค่แป๊บเดียวก็ได้'],
    ok: ['หายเหงาแล้ว มอดใจดีจัง', 'แค่นี้ก็พอแล้ว… ขอบคุณนะ'],
    fail: 'ไม่มีใครสนใจพีชชี่เลย…',
  },
};
// requests that are mini-games (they finish through complete()), and the photo one (through onPhoto())
Object.assign(REQUESTS, {
  photo: {
    note: 'ถ่ายรูปพีชชี่หน่อย โพสท่ารอแล้ว', time: 50, hold: true,
    ask: ['ถ่ายรูปพีชชี่หน่อย! โพสท่ารอแล้ว (C หรือคลิกขวา ยกกล้อง)', 'อยากได้รูปใหม่ลงช่อง! ถ่ายให้หน่อยน้า มุมสวยๆ'],
    ok: ['สวยมั้ย! ส่งให้ดูด้วยนะ', 'รูปนี้ขึ้นปกคลิปเลย!'],
    fail: 'ไม่มีใครถ่ายรูปให้เลย… เมื่อยแล้ว',
  },
  popcat: {
    note: 'เล่น POPCAT บนคอมให้ 80 ที', time: 55,
    ask: ['มอด เล่น POPCAT บนคอมพีชชี่ให้หน่อย! แข่งกับประเทศอื่นอยู่ ขอ 80 ที', 'POPCAT อันดับตกแล้ว! ไปกดที่คอมห้องสตรีมให้หน่อย'],
    ok: ['POPCAT ไทยแลนด์ขึ้นอันดับแล้ว!!', 'นิ้วไวมาก มอดคนนี้ใช้ได้'],
    fail: 'อันดับตกหมดแล้ว… ไม่เป็นไร (งอน)',
  },
  dance: {
    note: 'เต้นตามท่าพีชชี่', time: 45, hold: true,
    ask: ['มาเต้นกัน! ยืนใกล้ๆ แล้วกด E ดูท่าพีชชี่นะ', 'ท่าเต้นใหม่! มาจำท่ากัน ห้ามพลาดนะมอด'],
    ok: ['เต้นเก่งนี่ ไปแคสต์ไอดอลได้แล้ว', 'เป๊ะ! ถ่ายไปลงติ๊กต็อกได้เลย'],
    fail: 'ไม่เต้นด้วยเลย… เขินเหรอ',
  },
  karaoke: {
    note: 'ร้องคาราโอเกะที่ทีวีด้วยกัน', time: 60,
    ask: ['ไปร้องคาราโอเกะที่ทีวีห้องนั่งเล่นกัน! พีชชี่แต่งเพลงเองเลยนะ', 'อยากร้องเพลง! มอดไปเปิดคาราโอเกะที่ทีวีให้หน่อย'],
    ok: ['เสียงดีกว่าที่คิดนะเนี่ย!', 'คู่ดูโอ้ใหม่ของช่อง: พีชชี่กับมอด!'],
    fail: 'ไม่มีใครร้องด้วยเลย… ร้องคนเดียวก็ได้ (เศร้า)',
  },
});
const LONELY_NEED = 8; // seconds near her
const TIME = 45;

export class Requests {
  constructor({ player, peachi, level, doors }) {
    this.player = player; this.peachi = peachi; this.level = level; this.doors = doors;
    this.handles = [];
    this.onResult = () => {};   // (kind, ok)
    // Night 3: the rack is a shared, limited supply (Phi Pop eats from it too)
    this.freeSnacks = false;          // the rack works even without a "hungry" request
    this.takeSnack = () => true;      // () => bool: take one from the supply (false = none left)
    this.reset();
  }

  reset() {
    this.active = null;
    this.snack = null;
    this.freeSnacks = false;
    this.takeSnack = () => true;
    this.done = 0;
    this.eyeCooldown = 0;
    UI.setRequest(null);
  }

  attach() {
    this.detach();
    const { player, peachi } = this;
    this.handles.push(player.addInteractable({
      position: new THREE.Vector3(0.9, 0.9, 1.62), radius: 1.35,
      label: () => (this.snack ? `[E] เปลี่ยนขนม (ถือ ${this.snack.name} อยู่)` : '[E] หยิบขนม'),
      onUse: () => {
        if (!this.snack && !this.takeSnack()) { sfx.play('denied'); UI.toast('ขนมหมดชั้นแล้ว…'); return; }
        this.snack = pick(SNACKS.filter((s) => s !== this.snack)); sfx.play('pickup'); UI.toast(`ได้ "${this.snack.name}" มา`);
      },
      enabled: () => this.freeSnacks || (!!this.active && this.active.kind === 'hungry'),
    }));
    const at = new THREE.Vector3();
    this.handles.push(player.addInteractable({
      position: () => at.set(peachi.position.x, 1.0, peachi.position.z), radius: 2.3,
      label: () => `[E] ให้${this.snack ? this.snack.name : 'ขนม'}พีชชี่`,
      onUse: () => this._feed(),
      enabled: () => !!this.snack && !!this.active && this.active.kind === 'hungry' && !peachi.isAngry,
    }));
  }
  detach() { for (const h of this.handles) h.remove(); this.handles = []; }

  /** Ask for something. Returns false if she can't right now. */
  start(kind) {
    if (this.active || this.peachi.isAngry) return false;
    const R = REQUESTS[kind];
    this.active = { kind, left: R.time || TIME, progress: 0 };
    if (kind === 'dark') {
      this.level.setRoomLights('stream', false);
      sfx.play('powerDown');
    }
    this.peachi.hold = kind === 'lonely' || !!R.hold;
    if (kind === 'photo') { this.peachi._setExpression('happy'); }
    this._say(pick(R.ask));
    sfx.play('notify');
    this._ui();
    return true;
  }

  _say(line) { Talk.say('peachi', line, { at: this.peachi.position }); }

  _feed() {
    const s = this.snack;
    this.snack = null;
    sfx.play('crunch');
    this._say(s.line);
    this._finish(true, s.joke ? 'joke' : null);
  }

  _finish(ok, why) {
    const a = this.active;
    if (!a) return;
    this.active = null;
    this.peachi.hold = false;
    UI.setRequest(null);
    const R = REQUESTS[a.kind];
    if (ok) {
      this.done++;
      this.peachi.mood = Math.max(0, this.peachi.mood - (why === 'joke' ? 22 : 30));
      if (R.ok) this._say(pick(R.ok));
    } else {
      this.peachi.mood = Math.min(100, this.peachi.mood + 15);
      this._say(R.fail);
      if (a.kind === 'dark') this.level.setRoomLights('stream', true); // she turns it back on herself, sulking
    }
    this.onResult(a.kind, ok, why);
  }

  noteOf(kind) { return (REQUESTS[kind] && REQUESTS[kind].note) || ''; }

  /** A mini-game finished: true completes the request (a failed try just lets you try again). */
  complete(kind, ok) { if (ok && this.active && this.active.kind === kind) this._finish(true); }
  /** A photo was taken: the photo request wants Peachi in it. */
  onPhoto(photo) {
    if (!this.active || this.active.kind !== 'photo') return;
    if (photo.hits.some((h) => h.kind === 'peachi' && h.score >= 18)) this._finish(true);
  }

  cancel() { if (this.active) { if (this.active.kind === 'dark') this.level.setRoomLights('stream', true); this.active = null; this.peachi.hold = false; UI.setRequest(null); } }

  update(dt) {
    const { peachi, player } = this;
    // shining the flashlight in her face while she's in a good mood: "แสบตา!"
    this.eyeCooldown -= dt;
    if (this.eyeCooldown <= 0 && peachi.moodName === 'happy' && peachi.distToPlayer < 7 && player.isLightOn(new THREE.Vector3(peachi.position.x, 1.25, peachi.position.z))) {
      this.eyeCooldown = 16;
      peachi.mood = Math.min(100, peachi.mood + 5);
      this._say(pick(['แสบตานะ! ส่องทำไมมม', 'โอ๊ย ตาจะบอด! พีชชี่ไม่ใช่ผีดูดแสงนะ', 'ไฟฉายเข้าตา!! มอดดด']));
    }
    const a = this.active;
    if (!a) return;
    if (peachi.isAngry) { this._finish(false); return; }
    a.left -= dt;
    if (a.kind === 'dark' && this.level.roomLit('stream')) { this._finish(true); return; }
    if (a.kind === 'lonely') {
      let rate = 0;
      if (peachi.distToPlayer < 3.2) rate = 1;
      if (Scream.usingMic && peachi.distToPlayer < 6 && (Scream.level || 0) > 0.05) rate = 2; // talking to her counts double
      a.progress = Math.min(LONELY_NEED, a.progress + rate * dt);
      if (a.progress >= LONELY_NEED) { this._finish(true); return; }
    }
    if (a.left <= 0) { this._finish(false); return; }
    this._ui();
  }

  _ui() {
    const a = this.active;
    if (!a) return;
    UI.setRequest({ text: REQUESTS[a.kind].note, left: a.left, frac: a.kind === 'lonely' ? a.progress / LONELY_NEED : 0 });
  }
}
