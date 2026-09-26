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
const LONELY_NEED = 8; // seconds near her
const TIME = 45;

export class Requests {
  constructor({ player, peachi, level, doors }) {
    this.player = player; this.peachi = peachi; this.level = level; this.doors = doors;
    this.handles = [];
    this.onResult = () => {};   // (kind, ok)
    this.reset();
  }

  reset() {
    this.active = null;
    this.snack = null;
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
      onUse: () => { this.snack = pick(SNACKS.filter((s) => s !== this.snack)); sfx.play('pickup'); UI.toast(`ได้ "${this.snack.name}" มา`); },
      enabled: () => !!this.active && this.active.kind === 'hungry',
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
    this.active = { kind, left: TIME, progress: 0 };
    if (kind === 'dark') {
      this.level.setRoomLights('stream', false);
      sfx.play('powerDown');
    }
    this.peachi.hold = kind === 'lonely';
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
    if (a.kind === 'dark' && this.level.roomLightsOn('stream')) { this._finish(true); return; }
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
