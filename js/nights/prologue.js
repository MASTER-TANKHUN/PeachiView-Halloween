// Prologue — 29 Oct, 23:58. A DM from Peachi's account, then the front porch: learn to walk, the
// flashlight and E, ring the bell, the door opens by itself (and slams shut behind you), walk to the
// stream room, and meet Peachi for the first time: pale, no headphones, her voice breaking up.
import * as THREE from 'three';
import { UI } from '../ui.js';
import { sfx, ambient } from '../audio.js';
import { Talk } from '../game/talk.js';
import { PROLOGUE_DM } from '../data/story.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export class Prologue {
  constructor(ctx) {
    Object.assign(this, ctx); // level, player, peachi, doors, cut, camera
    this.active = false;
    this.step = null;
    this.handles = [];
  }

  /** The phone DM. Resolves 'go' | 'skip'. */
  dm(canSkip) {
    const actions = [['go', 'ไปบ้านพีชชี่']];
    if (canSkip) actions.push(['skip', 'ข้ามบทนำ']);
    return UI.showDM({ name: 'PeachiView', time: '23:58', messages: PROLOGUE_DM, actions });
  }

  /** Walk-in part, after the DM. Resolves when the player has met Peachi. */
  run() {
    const { level, player, peachi, doors } = this;
    this.active = true;
    level.resetWorld();
    level.setDoor('front', false, { instant: true });
    level.setDoor('stream', false, { instant: true });
    doors.locked.clear();
    doors.onFront = null;
    doors.attach();
    const P = level.porch;
    player.position.copy(P.spawn.position);
    player.yaw = P.spawn.yaw; player.pitch = 0.05;
    if (player.flashlight) { player.flashlight.battery = 100; player.flashlight.on = false; }
    player.enabled = true;

    // Peachi waits in her room, back turned, no AI
    peachi.reset(new THREE.Vector3(-6.3, 0, -5.6));
    peachi.active = false;
    peachi.group.rotation.y = Math.PI;
    peachi.model.setHeadphones(false);
    peachi.model.setDesat(0.72);
    peachi._setPose('idle');
    Talk.brokenPeachi = true;

    UI.showScreen('play');
    UI.setHudMode('prologue');
    UI.setClock(23, 59);
    UI.setNight('บทนำ');
    UI.setObjective('เดินไปที่ประตูหน้าบ้าน');
    UI.chat.clear();
    UI.setUptime(null);
    try { ambient.start(); ambient.setTension(0.05); } catch { /* audio not started */ }
    UI.toast('W A S D เดิน · เมาส์มองรอบๆ');

    this.moved = 0;
    this.last = player.position.clone();
    this.step = 'walk';
    this.t = 0;
    return new Promise((resolve) => { this.done = resolve; });
  }

  abort() {
    this.active = false; this.step = null;
    for (const h of this.handles) h.remove();
    this.handles = [];
    this.doors.detach();
    UI.setObjective(null);
  }

  update(dt) {
    if (!this.active) return;
    const { player, level } = this;
    this.t += dt;
    const p = player.position;
    this.moved += Math.hypot(p.x - this.last.x, p.z - this.last.z);
    this.last.copy(p);

    if (this.step === 'walk' && this.moved > 1.2) {
      this.step = 'light';
      UI.toast('มืดจัง… กด F เปิดไฟฉาย');
    }
    if (this.step === 'light' && player.flashlight.on) {
      this.step = 'bell';
      UI.setObjective('กดกริ่งหน้าบ้าน');
      const bell = level.porch.bell;
      this.handles.push(player.addInteractable({ position: bell, radius: 1.5, label: '[E] กดกริ่ง', onUse: () => this._ring(), enabled: () => this.step === 'bell' }));
      UI.toast('กด E เพื่อใช้ของ / เปิดประตู');
    }
    if (this.step === 'bell' && this.t > 25 && !this.nudged) { this.nudged = true; UI.toast('กริ่งอยู่ข้างประตู ใต้ป้าย 249'); }
    if (this.step === 'enter' && p.x > -9.2) {
      this.step = 'hall';
      this.doors.slam('front');
      UI.shake(300);
      UI.setObjective('ไปที่ห้องสตรีม (ประตูสีชมพู)');
      setTimeout(() => this.active && UI.toast('ประตูปิดเอง… ถอยไม่ได้แล้ว'), 700);
      setTimeout(() => this.active && this.doors.open('stream'), 2600);
    }
    if (this.step === 'hall' && level.roomAt(p) === 'stream' && p.z < -1.6) {
      this.step = 'meet';
      this._meet();
    }
  }

  async _ring() {
    if (this.step !== 'bell') return;
    this.step = 'wait';
    sfx.play('doorbell');
    UI.setObjective(null);
    await wait(2600);
    if (!this.active) return;
    Talk.say('peachi', 'เข้ามาเลย… ประตูไม่ได้ล็อก…', { ms: 3000 });
    await wait(1800);
    if (!this.active) return;
    this.doors.open('front');
    this.step = 'enter';
    UI.setObjective('เข้าไปในบ้าน');
  }

  async _meet() {
    const { cut, peachi, level } = this;
    for (const h of this.handles) h.remove();
    this.handles = [];
    await cut.run(async (c) => {
      level.setFlicker(true);
      sfx.play('flicker');
      const v = c.playerView();
      c.set(v.eye, v.look);
      await c.to([-5.6, 1.55, -3.3], [-6.3, 1.3, -5.6], 1.6);
      level.setFlicker(false);
      await c.wait(0.6);
      // she turns around
      peachi.group.rotation.y = Math.PI * 0.2;
      peachi._setPose('float');
      sfx.play('whisper');
      await c.wait(0.9);
      await c.say('peachi', 'มอด… มาแล้ว… เหรอ', { hold: 2600 });
      await c.say('peachi', 'หูฟัง… หาย… ได้ยินแชตไม่ชัดเลย', { hold: 2800 });
      await c.say('peachi', 'ช่วยหา… ก่อนเช้า… นะ', { hold: 2600 });
      await c.say('bot', 'ยินดีต้อนรับมอดคนใหม่ค่ะ! ไลฟ์มาแล้ว 246 ชั่วโมง กรุณาอย่าสแปมนะคะ :)', { hold: 3400 });
    }, { skippable: true });
    UI.subtitle(null);
    this.active = false;
    this.step = null;
    this.doors.detach();
    cut.handBack({ keepPosition: true });
    this.done && this.done();
  }
}
