// Night 1 rules: clock, headphones objective, viewers, chat scheduler, win/lose.
import * as THREE from 'three';
import { buildHeadphonesItem } from './peachi/model.js';
import { UI } from './ui.js';
import { sfx, ambient } from './audio.js';
import { Scream } from './mic.js';
import * as chatData from './data/chat.js';

const { normalChat, spamChat, superChats, peachiLines } = chatData;
const ENDINGS = chatData.endings || {};

export const SECONDS_PER_HOUR = 50;
export const END_HOUR = 6;
export const START_VIEWERS = 249;
const SPAM_TTL = 8;

const pick = (arr) => (arr && arr.length ? arr[Math.floor(Math.random() * arr.length)] : null);
const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));

const HYPE_USERS = ['ติ่งพีช249', 'mod_ตัวจริง', 'peachlover', 'คนดูเงียบๆ', 'นอนไม่หลับ', 'ลูกพีชซ่า'];
const TENSION_CHAT = ['ข้างหลัง!!!', 'วิ่งงงงงง', 'ม็อดใหม่จะรอดมั้ย 555', 'ตะโกนใส่เลยม็อด!!', 'ไฟฉาย! ส่องหน้าเลย', 'ใจเต้นแรงมากก'];
const OBJ_FIND = 'ตามหา "หูฟังหูแมว" ของพีชชี่ในบ้าน';
const OBJ_RETURN = 'เอาหูฟังไปวางคืนที่ "โต๊ะสตรีม"';

const LOSE_TEXT = {
  caught: {
    title: 'โดนพีชชี่กอดแน่นจนวิญญาณหลุด!',
    text: 'ม็อดใหม่ทำงานวันแรกก็โดนผีสตรีมเมอร์จับได้… คลิปนี้ยอดวิวพุ่งทะลุล้าน แต่คุณไม่รอดดูแล้วนะ',
  },
  timeout: {
    title: 'พีชชี่งอนจนกรีด',
    text: 'ตีหกแล้วหูฟังหูแมวยังไม่กลับบ้าน… พีชชี่กรีดร้องจนไลฟ์เสียงแตก ม็อดโดนปลดกลางอากาศ',
  },
  viewers: {
    title: 'ไลฟ์ล่ม',
    text: 'สแปมผีเต็มแชทจนคนดูหนีหมด เหลือแต่ผีดูอยู่คนเดียว… ม็อดใหม่โดนแบนตัวเองซะงั้น',
  },
};

export class Night {
  constructor({ scene, camera, level, player, peachi }) {
    this.scene = scene;
    this.camera = camera;
    this.level = level;
    this.player = player;
    this.peachi = peachi;
    this.state = 'idle'; // 'idle' | 'play' | 'won' | 'lost'
    this.paused = false;
    this.onEnd = () => {};
    this.handles = [];
    this.lastPos = new THREE.Vector3();

    // headphones live inside our own holder so their self-bob/spin stays local
    this.item = buildHeadphonesItem();
    this.holder = new THREE.Group();
    this.holder.name = 'headphonesHolder';
    this.holder.add(this.item);
    this.holder.visible = false;
    scene.add(this.holder);

    peachi.onCaught = () => this._lose('caught');
    // Player (B) exposes an onStep hook synced to head-bob; fall back to distance-based steps otherwise.
    this.nativeSteps = 'onStep' in player;
    if (this.nativeSteps) player.onStep = () => { if (this.state === 'play') sfx.play('step'); };
    Scream.onScream(() => this._onScream());
    this._resetVars();
  }

  get hour() { return this.time / SECONDS_PER_HOUR; }

  _resetVars() {
    this.time = 0;
    this.lastMinute = -1;
    this.lastHour = 0;
    this.viewers = START_VIEWERS;
    this.shownViewers = -1;
    this.carrying = false;
    this.placed = false;
    this.chatTimer = rand(0.5, 1.5);
    this.spamTimer = rand(5, 8);
    this.scTimer = rand(18, 30);
    this.tensionTimer = 1;
    this.spamPenalized = 0;
    this.spamHintShown = false;
    this.penaltyToastAt = -99;
    this.noSpamToastAt = -99;
    this.stepAcc = 0;
    this.tension = 0;
    this.shownVignette = -1;
    this.shownMood = null;
  }

  // ---------------------------------------------------------------- lifecycle
  start() {
    const { player, level, peachi } = this;
    this._clearHandles();
    this._resetVars();

    // player back to spawn
    player.position.copy(level.spawn.position);
    player.yaw = level.spawn.yaw || 0;
    player.pitch = 0;
    if (player.flashlight) player.flashlight.battery = 100;
    player.enabled = true;
    this.lastPos.copy(player.position);

    // headphones at a random item spot (prefer away from spawn)
    const spots = level.itemSpots || [];
    const far = spots.filter((s) => s.distanceTo(level.spawn.position) > 5);
    const spot = (pick(far.length ? far : spots) || level.spawn.position).clone();
    this.itemSpot = spot;
    this._dropItem(spot);
    this.handles.push(player.addInteractable({
      position: spot.clone(),
      radius: 1.6,
      label: '[E] เก็บหูฟังหูแมว',
      onUse: () => this._pickup(),
      enabled: () => this.state === 'play' && !this.carrying && !this.placed,
    }));
    this.handles.push(player.addInteractable({
      position: level.deskPosition.clone(),
      radius: 1.9,
      label: '[E] วางหูฟังคืนที่โต๊ะ',
      onUse: () => this._place(),
      enabled: () => this.state === 'play' && this.carrying,
    }));

    // Peachi spawns away from the player
    const gs = level.ghostSpawns || [];
    const farGs = gs.filter((s) => s.distanceTo(level.spawn.position) > 6);
    peachi.reset(pick(farGs.length ? farGs : gs));
    peachi.active = true;

    // UI
    UI.setClock(0, 0);
    UI.setViewers(this.viewers);
    this.shownViewers = this.viewers;
    UI.setObjective(OBJ_FIND);
    UI.setMood('happy');
    UI.setPrompt(null);
    UI.vignette(0);
    if (typeof UI.chat.clear === 'function') UI.chat.clear();
    UI.chat.push({ user: 'PeachiView', text: 'ไลฟ์กลับมาแล้ว!? ใครเปิดเนี่ย…', type: 'normal' });
    UI.toast('หาหูฟังหูแมว แล้วเอาไปคืนที่โต๊ะสตรีมก่อนตีหก!');
    try { ambient.start(); ambient.setTension(0); } catch (e) { console.warn('ambient', e); }
    this.state = 'play';
    this.paused = false;
  }

  _clearHandles() {
    for (const h of this.handles) { try { h && h.remove && h.remove(); } catch (e) { /* ignore */ } }
    this.handles = [];
  }

  _dropItem(pos) {
    if (this.holder.parent !== this.scene) this.scene.add(this.holder);
    this.holder.position.set(pos.x, pos.y + 0.05, pos.z);
    this.holder.rotation.set(0, 0, 0);
    this.holder.scale.setScalar(1);
    this.holder.visible = true;
  }

  _pickup() {
    if (this.state !== 'play' || this.carrying || this.placed) return;
    this.carrying = true;
    sfx.play('pickup');
    // hold it in the bottom-right of the view
    this.camera.add(this.holder);
    this.holder.position.set(0.3, -0.26, -0.6);
    this.holder.rotation.set(0.25, -0.6, 0);
    this.holder.scale.setScalar(0.55);
    UI.setObjective(OBJ_RETURN);
    UI.toast('ได้หูฟังหูแมวแล้ว! รีบเอาไปคืนที่โต๊ะสตรีม');
    this._addViewers(randInt(8, 15));
    UI.chat.push({ user: pick(HYPE_USERS), text: 'เจอหูฟังแล้ววว เก่งมากม็อด!', type: 'normal' });
    this.peachi.onHeadphonesFound();
  }

  _place() {
    if (this.state !== 'play' || !this.carrying) return;
    this.carrying = false;
    this.placed = true;
    sfx.play('place');
    const d = this.level.deskPosition;
    this._dropItem(new THREE.Vector3(d.x, d.y < 0.5 ? 0.8 : d.y, d.z));
    this._win();
  }

  _win() {
    if (this.state !== 'play') return;
    this.state = 'won';
    this._end();
    this.peachi._setExpression('happy');
    this.peachi._setPose('idle');
    this.peachi._setFlicker(false);
    sfx.play('win');
    try { localStorage.setItem('peachi.nightCleared', '1'); } catch (e) { /* private mode */ }
    const line = pick(peachiLines && peachiLines.win);
    if (line) UI.subtitle(line, 4000);
    UI.showScreen('win', {
      title: 'รอดคืนแรก! ไลฟ์ยังไม่ล่ม',
      text: `หูฟังหูแมวกลับมาที่โต๊ะแล้ว พีชชี่ยิ้มหวาน (แบบผีๆ) ผู้ชม ${Math.round(this.viewers)} คนส่งหัวใจรัวๆ … เจอกันคืนที่ 2 นะม็อด`,
    });
    this.onEnd('win');
  }

  _lose(reason) {
    if (this.state !== 'play') return;
    this.state = 'lost';
    this._end();
    if (reason !== 'caught') sfx.play('lose');
    if (reason === 'timeout') { this.peachi._setExpression('scream'); UI.flash('#ff2a6d'); UI.shake(600); }
    const key = reason === 'caught' ? 'jumpscare' : reason;
    UI.showScreen('gameover', ENDINGS[key] || LOSE_TEXT[reason] || LOSE_TEXT.caught);
    this.onEnd('gameover', reason);
  }

  _end() {
    this.player.enabled = false;
    this.peachi.active = false;
    UI.setPrompt(null);
    UI.vignette(0);
    try { ambient.setTension(0); ambient.stop(); } catch (e) { /* ignore */ }
  }

  // ---------------------------------------------------------------- input / events
  banSpam() {
    if (this.state !== 'play' || this.paused) return;
    if (UI.chat.banOldestSpam()) {
      sfx.play('ban');
      this._addViewers(randInt(2, 5));
    } else if (this.time - this.noSpamToastAt > 2) {
      this.noSpamToastAt = this.time;
      UI.toast('ยังไม่มีสแปมให้แบน');
    }
  }

  _onScream() {
    if (this.state !== 'play' || this.paused || !this.player.enabled) return;
    if (!Scream.usingMic) sfx.play('scream');
    const r = this.peachi.onScream(this.player.position);
    if (r === 'stun') {
      this._addViewers(randInt(12, 25));
      UI.chat.push({ user: pick(HYPE_USERS), text: 'คลิปนี้ต้องได้!', type: 'normal' });
    }
  }

  _addViewers(n) {
    this.viewers = Math.max(0, this.viewers + n);
  }

  // ---------------------------------------------------------------- update
  update(dt, t) {
    const { player, peachi, camera } = this;
    if (this.state !== 'play') {
      peachi.update(dt, t, null);
      if (this.holder.visible && !this.carrying && this.item.userData.update) this.item.userData.update(dt, t);
      return;
    }
    const jumpscaring = peachi.state === 'jumpscare';

    // --- clock
    if (!jumpscaring) {
      this.time += dt;
      const total = END_HOUR * SECONDS_PER_HOUR;
      if (this.time >= total) { UI.setClock(END_HOUR, 0); this._lose('timeout'); return; }
      const hour = Math.floor(this.time / SECONDS_PER_HOUR);
      const minute = Math.floor(((this.time % SECONDS_PER_HOUR) / SECONDS_PER_HOUR) * 60);
      if (minute !== this.lastMinute) { this.lastMinute = minute; UI.setClock(hour, minute); }
      if (hour !== this.lastHour) {
        this.lastHour = hour;
        sfx.play('tick');
        if (hour === 3) UI.toast('ตีสามแล้ว… เวลาผีออก พีชชี่อารมณ์แปรปรวนไวขึ้น');
        else if (hour === 4) UI.toast('ตีสี่! พีชชี่ลอยเร็วขึ้นนะ ระวัง');
        else if (hour === 5) UI.toast('เหลืออีกชั่วโมงเดียวก่อนเช้า!');
      }
    }

    // --- ghost
    peachi.update(dt, t, { player, camera, hour: this.hour });
    if (this.state !== 'play') return; // caught during this update

    if (!this.carrying && this.item.userData.update) this.item.userData.update(dt, t);
    if (jumpscaring || peachi.state === 'jumpscare') return;

    this._updateChat(dt);
    this._updateSpamPenalty();

    // --- tension & viewers
    const d = peachi.distToPlayer;
    const prox = Math.max(0, Math.min(1, 1 - d / 14));
    const angry = peachi.isAngry;
    this.tension = Math.max(0, Math.min(1, (peachi.mood / 100) * 0.35 + prox * (angry ? 0.75 : 0.3)));
    if (angry && d < 6) {
      this.tensionTimer -= dt;
      if (this.tensionTimer <= 0) {
        this.tensionTimer = rand(0.8, 1.8);
        this._addViewers(randInt(1, 4));
        if (Math.random() < 0.3) UI.chat.push({ user: pick(HYPE_USERS), text: pick(TENSION_CHAT), type: 'normal' });
      }
    }

    // --- footsteps (fallback when the player has no onStep hook)
    if (!this.nativeSteps) {
      const p = player.position;
      const moved = Math.hypot(p.x - this.lastPos.x, p.z - this.lastPos.z);
      if (moved < 1) this.stepAcc += moved; // ignore teleports
      this.lastPos.copy(p);
      if (this.stepAcc > 0.8) { this.stepAcc = 0; sfx.play('step'); }
    }

    // --- HUD
    this._updateHud();

    if (this.viewers <= 0) this._lose('viewers');
  }

  _updateChat(dt) {
    this.chatTimer -= dt;
    if (this.chatTimer <= 0) {
      this.chatTimer = rand(2, 4);
      const m = pick(normalChat);
      if (m) UI.chat.push({ user: m.user, text: m.text, type: 'normal' });
    }
    this.spamTimer -= dt;
    if (this.spamTimer <= 0) {
      this.spamTimer = this.hour >= 3 ? rand(3.5, 6) : rand(6, 10);
      const m = pick(spamChat);
      if (m) {
        UI.chat.push({ user: m.user, text: m.text, type: 'spam' });
        if (!this.spamHintShown) { this.spamHintShown = true; UI.toast('สแปมผีโผล่! กด Q เพื่อแบนก่อนคนดูหนี'); }
      }
    }
    this.scTimer -= dt;
    if (this.scTimer <= 0) {
      this.scTimer = rand(22, 40);
      const m = pick(superChats);
      if (m) {
        UI.chat.push({ user: m.user, text: m.text, type: 'superchat', amount: m.amount });
        sfx.play('superchat');
        this._addViewers(randInt(3, 8));
      }
    }
  }

  // Each spam older than SPAM_TTL costs 10 viewers exactly once.
  // Preferred: UI.chat.expireSpam (extra) removes the punished spam so Q keeps targeting fresh ones.
  // Fallback (contract only): count spam past the TTL; ages only grow and bans only remove.
  _updateSpamPenalty() {
    let k = 0;
    if (typeof UI.chat.expireSpam === 'function') {
      k = UI.chat.expireSpam(SPAM_TTL) || 0;
    } else {
      const ages = UI.chat.spamAges() || [];
      let n = 0;
      for (const a of ages) if (a > SPAM_TTL) n++;
      k = Math.max(0, n - this.spamPenalized);
      this.spamPenalized = n;
    }
    if (k > 0) {
      this._addViewers(-10 * k);
      if (this.time - this.penaltyToastAt > 3) {
        this.penaltyToastAt = this.time;
        UI.toast(`สแปมค้างนานเกิน! ผู้ชม −${10 * k} (กด Q แบน)`);
      }
    }
  }

  _updateHud() {
    const { player, peachi } = this;
    const v = Math.round(this.viewers);
    if (v !== this.shownViewers) { this.shownViewers = v; UI.setViewers(v); }
    if (player.flashlight) UI.setBattery(player.flashlight.battery);
    UI.setScreamMeter(Math.max(Scream.level || 0, Scream.charge || 0), Scream.cooldown || 0, !!Scream.usingMic);
    const mood = peachi.expression;
    if (mood !== this.shownMood) { this.shownMood = mood; UI.setMood(mood); }
    if (Math.abs(this.tension - this.shownVignette) > 0.02) {
      this.shownVignette = this.tension;
      UI.vignette(this.tension * 0.85);
    }
    ambient.setTension(this.tension);
  }
}
