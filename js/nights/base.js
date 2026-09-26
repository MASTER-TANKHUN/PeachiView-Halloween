// What every night shares: the 00:00 → 06:00 clock with scripted events, viewers as HP, the live chat
// (normal / ghost spam / super chats / PeachiBot / "เธอ"), Peachi, hiding + her search, requests,
// the HUD, and the ways to lose. A night subclass adds its objective, its script and its ending scene.
import * as THREE from 'three';
import { UI } from '../ui.js';
import { sfx, ambient } from '../audio.js';
import { Scream } from '../mic.js';
import { Talk } from '../game/talk.js';
import { Save } from '../game/save.js';
import * as chatData from '../data/chat.js';
import { BOT, LOSE } from '../data/story.js';

const { normalChat, spamChat, superChats } = chatData;
export const START_VIEWERS = 249;
const SPAM_TTL = 8;
const END_HOUR = 6;

export const pick = (arr) => (arr && arr.length ? arr[Math.floor(Math.random() * arr.length)] : null);
export const rand = (a, b) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));

const HYPE_USERS = ['ลูกพีชน้อย_249', 'mod_ตัวจริง', 'peachlover', 'คนดูเงียบๆ', 'นอนไม่หลับ', 'ลูกพีชซ่า', 'ลุงป้อม_สายเปย์'];
const TENSION_CHAT = ['ข้างหลัง!!!', 'วิ่งงงงงง', 'มอดใหม่จะรอดมั้ย 555', 'ตะโกนใส่เลยมอด!!', 'ไฟฉาย! ส่องหน้าเลย', 'ใจเต้นแรงมากก'];
const SLEEPY_CHAT = ['มอดหลับเหรอ', 'ซ่อนนานไปแล้วว ออกมาทำคอนเทนต์!', 'จอดำ 20 วิ ใครเอาไลฟ์ไปทำอะไร', 'มอดนอนในตู้ป่ะเนี่ย'];

export class NightBase {
  constructor(ctx) {
    Object.assign(this, ctx); // scene, camera, renderer, level, player, peachi, doors, hide, requests, cut, params
    this.state = 'idle';
    this.paused = false;
    this.onEnd = () => {};
    this.handles = [];
    this.stats = {};
    this._resetVars();
  }

  // ---------------------------------------------------------------- config (override)
  get number() { return 1; }
  get label() { return `คืนที่ ${this.number}`; }
  get secondsPerHour() { return 50; }
  get uptimeBase() { return 246; }
  get total() { return END_HOUR * this.secondsPerHour; }
  get hour() { return this.time / this.secondsPerHour; }
  get speed() { return Number(this.params?.get('speed')) || 1; }
  get god() { return this.params?.get('god') === '1'; }
  /** Space is taken by something else right now (the breaker QTE): no screaming. */
  get inputLock() { return !!(this.power && this.power.busy); }

  _resetVars() {
    this.time = 0;
    this.lastMinute = -1;
    this.lastHour = 0;
    this.viewers = START_VIEWERS;
    this.shownViewers = -1;
    this.chatTimer = rand(0.5, 1.5);
    this.spamTimer = rand(6, 9);
    this.scTimer = rand(18, 30);
    this.botTimer = rand(40, 60);
    this.tensionTimer = 1;
    this.spamHintShown = false;
    this.penaltyToastAt = -99;
    this.noSpamToastAt = -99;
    this.tension = 0;
    this.shownVignette = -1;
    this.shownMood = null;
    this.events = [];
    this.hideT = 0;
    this.searchedThisHide = false;
    this.sleepyChatDone = false;
    this.caughtReason = 'caught';
    this.boredT = 0;
    this.stats = { screams: 0, bans: 0, requests: 0, maxViewers: START_VIEWERS, hides: 0, closeCalls: 0, photos: 0, bestPhoto: 0 };
    this.missions = []; // super-chat missions: { id, text, sub, left, reward, photo: subject kind, done }
  }

  // ---------------------------------------------------------------- lifecycle
  /** opts.keepPlayer: start where the player already stands (straight after the prologue). */
  start({ keepPlayer = false } = {}) {
    const { player, level, peachi } = this;
    this._clearHandles();
    this._resetVars();
    level.resetWorld();
    this.hide.reset();
    this.requests.reset();
    if (!keepPlayer) {
      player.position.copy(level.spawn.position);
      player.yaw = level.spawn.yaw || 0;
      player.pitch = 0;
    }
    if (player.flashlight) { player.flashlight.battery = 100; player.flashlight.on = false; }
    player.enabled = true;

    const gs = level.ghostSpawns || [];
    const far = gs.filter((s) => s.distanceTo(player.position) > 6);
    peachi.reset(pick(far.length ? far : gs));
    peachi.active = true;
    peachi.onCaught = () => this.lose(this.caughtReason);

    this.doors.attach();
    this.hide.attach();
    this.requests.attach();
    if (this.phone) { this.phone.reset(); this.phone.provider = this; }
    if (this.power) this.power.reset();
    if (this.memes) this.memes.attach(this);
    this.requests.onResult = (kind, ok, why) => this._onRequest(kind, ok, why);
    this.hide.onEnter = () => { this.hideT = 0; this.searchedThisHide = false; this.sleepyChatDone = false; this.stats.hides++; this.hideSeenDist = peachi.distToPlayer; };
    this.hide.onExit = () => { if (peachi.state === 'search') { peachi.search = null; peachi.state = 'roam'; } };
    this.resignArmed = 0;
    this.doors.onFront = () => this._frontDoor();

    UI.setHudMode('full');
    UI.setNight(this.label);
    UI.setClock(0, 0);
    UI.setViewers(this.viewers);
    this.shownViewers = this.viewers;
    UI.setMood('happy');
    UI.setPrompt(null);
    UI.setRequest(null);
    UI.vignette(0);
    UI.chat.clear();
    try { ambient.start(); ambient.setTension(0); } catch (e) { console.warn('ambient', e); }

    const startHour = Number(this.params?.get('hour')) || 0;
    this.time = Math.min(5.9, startHour) * this.secondsPerHour;
    this.lastHour = Math.floor(this.hour);
    this.state = 'play';
    this.paused = false;
    this.onStart();
    for (const ev of this.events) if (ev.at < this.hour) ev.done = true;
  }

  abort() {
    if (this.state === 'play' || this.state === 'cutscene') this._end();
    this.state = 'idle';
    this._clearHandles();
    this.doors.detach(); this.hide.detach(); this.requests.detach();
    this.hide.reset(); this.requests.cancel();
    this.peachi.freeze();
    UI.chat.clear();
    UI.setObjective(null);
    UI.setRequest(null);
    UI.subtitle(null);
    this.onAbort();
  }

  _clearHandles() {
    for (const h of this.handles) { try { h && h.remove && h.remove(); } catch (e) { /* ignore */ } }
    this.handles = [];
  }

  /** Add an interactable that is removed when the night ends. */
  interact(o) { const h = this.player.addInteractable(o); this.handles.push(h); return h; }
  /** Run fn once when the clock reaches `hour`. */
  at(hour, fn) { this.events.push({ at: hour, fn, done: false }); }

  _end() {
    if (this.memes) this.memes.close();
    if (this.power) this.power.close(true);
    if (this.phone) { this.phone.close(); this.phone.lower(); }
    this.hide.reset();
    this.requests.cancel();
    this.player.enabled = false;
    this.peachi.active = false;
    UI.setPrompt(null);
    UI.setRequest(null);
    UI.vignette(0);
    try { ambient.setTension(0); ambient.stop(); } catch (e) { /* ignore */ }
  }

  lose(reason) {
    if (this.state !== 'play') return;
    if (this.god && reason !== 'resign') { this.peachi.reset(pick(this.level.ghostSpawns)); this.peachi.active = true; this.player.enabled = true; UI.toast('[god] รอด'); return; }
    this.state = 'lost';
    this._end();
    Save.addStats({ deaths: 1 });
    if (reason !== 'caught' && reason !== 'found') sfx.play('lose');
    if (reason === 'timeout') { this.peachi._setExpression('scream'); UI.flash('#ff2a6d'); UI.shake(600); }
    const L = this.loseCard(reason);
    UI.showScreen('gameover', { ...L, stats: this.statRows() });
    this.onEnd('gameover', reason);
  }

  /** The objective is done: play the night's ending scene, then the win card. */
  async win() {
    if (this.state !== 'play') return;
    this.state = 'cutscene';
    this._end();
    this.peachi.freeze();
    Save.addStats({ screams: this.stats.screams, bans: this.stats.bans, requests: this.stats.requests, nightsPlayed: 1 });
    Save.clearNight(this.number);
    try { await this.winScene(); } catch (e) { console.error('[win scene]', e); }
    if (this.state !== 'cutscene') return; // aborted meanwhile
    this.state = 'won';
    UI.showScreen('win', { ...this.winCard(), stats: this.statRows(), next: this.nextLabel || null });
    this.onEnd('win');
  }

  loseCard(reason) { return LOSE[reason] || LOSE.caught; }

  /** The front door: press twice to quit the job (a joke ending). */
  _frontDoor() {
    if (this.resignArmed > 0) { this.bot(BOT.resign); this.lose('resign'); return; }
    this.resignArmed = 3;
    UI.toast('จะลาออกจริงเหรอ? กด E อีกครั้งเพื่อออกจากบ้าน');
  }

  statRows() {
    const s = this.stats;
    return [
      ['ผู้ชมสูงสุด', Math.round(s.maxViewers).toLocaleString('en-US')],
      ['ทำตามคำขอพีชชี่', `${s.requests} ครั้ง`],
      ['กรี๊ด', `${s.screams} ครั้ง`],
      ['แบนแชตผี', `${s.bans} ข้อความ`],
    ];
  }

  // ---------------------------------------------------------------- hooks (override)
  onStart() {}
  onAbort() {}
  onUpdate() {}
  async winScene() {}
  winCard() { return { title: 'รอดแล้ว', text: '' }; }

  // ---------------------------------------------------------------- the phone (Tab): what this night shows on it
  /** Goal line(s) at the top of the missions tab. */
  goalRows() { return []; }
  missionRows() {
    const rows = [...this.goalRows()];
    const r = this.requests.active;
    if (r) rows.push({ text: `พีชชี่ขอ: ${this.requests.noteOf(r.kind)}`, left: Math.ceil(r.left), urgent: r.left < 10 });
    for (const m of this.missions) rows.push({ text: m.text, sub: m.done ? 'สำเร็จแล้ว' : m.sub, left: m.done ? null : Math.ceil(m.left), done: m.done, kind: 'sc' });
    return rows;
  }
  // (the phone calls these through `provider`)
  actions() { return []; }
  get reportEnabled() { return false; }
  mapInfo() { return { hint: '', icons: [] }; }
  subjects() {
    const p = this.peachi;
    if (!p.group.visible || !p.active) return [];
    const pos = new THREE.Vector3(p.position.x, 1.2, p.position.z);
    return [{
      kind: 'peachi', id: 'peachi', pos, base: 45,
      facing: () => { const c = this.camera.position; const want = Math.atan2(c.x - p.position.x, c.z - p.position.z); let d = want - p.group.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); return Math.abs(d) < 0.6; },
      special: () => p.isStunned,
      caption: (h) => (p.isStunned ? 'พีชชี่ตาลาย (หลังโดนกรี๊ดใส่)' : p.isAngry ? 'พีชชี่โกรธใส่กล้อง!!' : h.facing ? 'พีชชี่ยิ้มให้กล้อง (แบบผีๆ)' : 'พีชชี่หลุดเฟรมนิดนึง'),
    }];
  }
  onPhoto(photo) {
    this.stats.photos++;
    this.stats.bestPhoto = Math.max(this.stats.bestPhoto, photo.score);
    if (photo.score > 0) {
      this._addViewers(Math.min(40, Math.round(photo.score / 5)));
      if (photo.score >= 40) this.chat(pick(HYPE_USERS), pick(['รูปนี้ต้องเป็นปกคลิป!', 'แคปจอไว้แล้ว!!', 'ขอรูปนี้ทำโปรไฟล์']));
    }
    for (const m of this.missions) {
      if (m.done || !m.photo) continue;
      const hit = photo.hits.find((h) => h.kind === m.photo && h.score >= (m.min || 15));
      if (hit) {
        m.done = true;
        this._addViewers(m.reward || 25);
        sfx.play('superchat');
        UI.chat.push({ user: m.user || 'ลูกพีชน้อย_249', text: m.thanks || 'ขอบคุณค่ะมอด! รูปสวยมาก', type: 'superchat', amount: m.amount || 100 });
        UI.toast(`ภารกิจสำเร็จ! +${m.reward || 25} ผู้ชม`);
      }
    }
    this.onPhotoTaken(photo);
  }
  onPhotoTaken() {}
  /** A super-chat asks for something (a photo of … within `sec`). */
  addMission(m) {
    const mm = { left: 90, reward: 25, done: false, ...m };
    this.missions.push(mm);
    sfx.play('superchat');
    UI.chat.push({ user: mm.user || 'ลูกพีชน้อย_249', text: mm.ask || mm.text, type: 'superchat', amount: mm.amount || 100 });
    return mm;
  }
  _updateMissions(dt) {
    for (const m of this.missions) {
      if (m.done || m.failed) continue;
      m.left -= dt;
      if (m.left <= 0) { m.failed = true; m.done = false; this.chat(m.user || 'ลูกพีชน้อย_249', 'ไม่เป็นไรค่ะ… ไว้คราวหน้า'); }
    }
    this.missions = this.missions.filter((m) => !m.failed && !(m.done && (m.shownDone = (m.shownDone || 0) + dt) > 8));
  }

  // ---------------------------------------------------------------- input / events
  banSpam() {
    if (this.state !== 'play' || this.paused) return;
    const r = UI.chat.banOldestSpam();
    if (r === 'refused') { sfx.play('denied'); return; }
    if (r) {
      sfx.play('ban');
      this.stats.bans++;
      this._addViewers(randInt(2, 5));
      if (this.stats.bans % 6 === 0) this.bot(pick(BOT.onBan));
    } else if (this.time - this.noSpamToastAt > 2) {
      this.noSpamToastAt = this.time;
      UI.toast('ยังไม่มีสแปมให้แบน');
    }
  }

  onScream() {
    if (this.state !== 'play' || this.paused || !this.player.enabled || this.hide.hidden) return;
    if (!Scream.usingMic) sfx.play('scream');
    this.stats.screams++;
    const r = this.peachi.onScream(this.player.position);
    if (r === 'stun') {
      this._addViewers(randInt(12, 25));
      UI.chat.push({ user: pick(HYPE_USERS), text: 'คลิปนี้ต้องได้!', type: 'normal' });
    }
  }

  bot(text) { UI.chat.push({ user: 'PeachiBot', text, type: 'bot' }); }
  chat(user, text, type = 'normal') { UI.chat.push({ user, text, type }); }

  _onRequest(kind, ok, why) {
    if (ok) {
      this.stats.requests++;
      this._addViewers(randInt(10, 20));
      this.chat(pick(HYPE_USERS), why === 'joke' ? '555555 ผักบุ้งเนี่ยนะ' : pick(['มอดใจดีจัง', 'พีชชี่ยิ้มแล้ววว', 'น่ารักกก']));
    } else {
      this.chat(pick(HYPE_USERS), 'มอดเมินพีชชี่… งอนแน่ๆ');
    }
  }

  _addViewers(n) {
    this.viewers = Math.max(0, this.viewers + n);
    if (this.viewers > this.stats.maxViewers) this.stats.maxViewers = this.viewers;
  }

  // ---------------------------------------------------------------- update
  update(dt, t) {
    const { player, peachi, camera } = this;
    if (this.state !== 'play') {
      peachi.update(dt, t, { camera });
      this.idleUpdate(dt, t);
      return;
    }
    const jumpscaring = peachi.state === 'jumpscare';
    const hidden = this.hide.hidden;

    // --- clock + script
    if (!jumpscaring) {
      this.time += dt * this.speed;
      if (this.time >= this.total) { UI.setClock(END_HOUR, 0); this.lose('timeout'); return; }
      const hour = Math.floor(this.hour);
      const minute = Math.floor(((this.time % this.secondsPerHour) / this.secondsPerHour) * 60);
      if (minute !== this.lastMinute) { this.lastMinute = minute; UI.setClock(hour, minute); }
      if (hour !== this.lastHour) { this.lastHour = hour; sfx.play('tick'); }
      for (const ev of this.events) {
        if (!ev.done && this.hour >= ev.at) { ev.done = true; try { ev.fn(); } catch (e) { console.error('[night event]', e); } }
      }
      if (this.state !== 'play') return;
    }

    // --- ghost
    peachi.update(dt, t, { player, camera, hour: this.hour, hidden });
    if (this.state !== 'play') return; // caught during this update
    if (jumpscaring || peachi.state === 'jumpscare') return;

    this._updateHiding(dt);
    if (this.state !== 'play' || peachi.state === 'jumpscare') return;
    this.requests.update(dt);
    this._updateMissions(dt);
    this._updateChat(dt);
    this._updateSpamPenalty();

    // --- tension & viewers
    const d = peachi.distToPlayer;
    const prox = Math.max(0, Math.min(1, 1 - d / 14));
    const angry = peachi.isAngry;
    this.tension = Math.max(0, Math.min(1, (peachi.mood / 100) * 0.35 + prox * (angry ? 0.75 : 0.3) + (this.hide.danger ? 0.5 : 0)));
    if (angry && d < 6 && !hidden) {
      this.tensionTimer -= dt;
      if (this.tensionTimer <= 0) {
        this.tensionTimer = rand(0.8, 1.8);
        this._addViewers(randInt(1, 4));
        this.stats.closeCalls++;
        if (Math.random() < 0.3) this.chat(pick(HYPE_USERS), pick(TENSION_CHAT));
      }
    }
    // nothing happening for a minute: the chat gets bored
    this.boredT = angry || d < 6 || this.requests.active ? 0 : this.boredT + dt;
    if (this.boredT > 60) { this._addViewers(-dt); if (Math.random() < dt * 0.1) this.chat(pick(HYPE_USERS), 'ง่วงแล้วว มีอะไรเกิดขึ้นบ้างมั้ย'); }

    if (this.resignArmed > 0) this.resignArmed -= dt;
    this.onUpdate(dt, t);
    if (this.state !== 'play') return;
    this._updateHud();
    if (this.viewers <= 0) this.lose('viewers');
  }

  /** Behind menus / during scenes. */
  idleUpdate() {}

  _updateHiding(dt) {
    const { hide, peachi, player, camera } = this;
    if (!hide.hidden) { hide.danger = false; return; }
    this.hideT += dt;
    const sp = hide.spot;
    if (peachi.isAngry && peachi.state !== 'search' && !this.searchedThisHide) {
      this.searchedThisHide = true;
      const real = this.hideSeenDist < 4.5 || Math.random() < 0.55;
      const inRoom = (this.level.navPoints || []).filter((p) => this.level.roomAt(p) === sp.room);
      const target = real ? sp.use : (pick(inRoom) || sp.use);
      peachi.startSearch(target, real);
    }
    if (peachi.state === 'search' && peachi.search) {
      const S = peachi.search;
      hide.danger = S.real && Math.hypot(peachi.position.x - sp.use.x, peachi.position.z - sp.use.z) < 3;
      if (S.checking) {
        if (S.real && hide.noisy && peachi.checkingFor > 0.7) {
          hide.exit();
          this.caughtReason = 'found';
          peachi.catchHidden(player, camera);
          return;
        }
        if (peachi.checkingFor > 3.4) { peachi.endSearch(); this._addViewers(randInt(8, 14)); this.chat(pick(HYPE_USERS), 'รอดดดด ใจจะวาย'); }
      }
    } else hide.danger = false;
    if (this.hideT > 20) {
      this._addViewers(-2 * dt);
      if (!this.sleepyChatDone) { this.sleepyChatDone = true; this.chat(pick(HYPE_USERS), pick(SLEEPY_CHAT)); }
    }
  }

  _updateChat(dt) {
    this.chatTimer -= dt;
    if (this.chatTimer <= 0) {
      this.chatTimer = rand(2, 4);
      const m = pick(this.chatPool ? this.chatPool() : normalChat);
      if (m) this.chat(m.user, m.text);
    }
    this.spamTimer -= dt;
    if (this.spamTimer <= 0) {
      this.spamTimer = this.hour >= 3 ? rand(3.5, 6) : rand(6, 10);
      const m = pick(spamChat);
      if (m) {
        this.chat(m.user, m.text, 'spam');
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
    this.botTimer -= dt;
    if (this.botTimer <= 0) { this.botTimer = rand(50, 80); this.bot(pick(BOT.polite)); }
  }

  // Each spam older than SPAM_TTL costs 10 viewers exactly once.
  _updateSpamPenalty() {
    const k = UI.chat.expireSpam(SPAM_TTL) || 0;
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
    UI.setUptime(this.uptimeBase * 3600 + (this.time / this.total) * 3599);
    ambient.setTension(this.tension);
  }

  /** Stereo pan for a world point. */
  panAt(x, z) {
    const p = this.player;
    const dx = x - p.position.x, dz = z - p.position.z;
    const d = Math.hypot(dx, dz) || 1;
    return { pan: Math.max(-0.9, Math.min(0.9, (dx * Math.cos(p.yaw) - dz * Math.sin(p.yaw)) / d)), dist: d };
  }
}

export { Talk, THREE };
