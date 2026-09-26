// The flow of the whole game: title → DM (+ the prologue the first time) → night card → night → ending
// scene → win/lose card → next night, retry or back to the title. The title starts the first night not
// yet cleared (?night=N overrides); later nights open with their own DM, which also lets you replay a
// cleared night. Owns the shared systems (cutscenes, doors, hiding, requests, the phone, the breaker,
// the anomalies, Krasue) and decides what updates each frame and when the game counts as paused.
import { UI } from '../ui.js';
import { sfx } from '../audio.js';
import { Scream } from '../mic.js';
import { Settings } from '../settings.js';
import { Save } from './save.js';
import { Talk } from './talk.js';
import { Cutscene } from './cutscene.js';
import { Doors } from '../systems/doors.js';
import { Hide } from '../systems/hide.js';
import { Requests } from '../systems/requests.js';
import { Phone } from '../systems/phone.js';
import { Power } from '../systems/power.js';
import { Anomalies } from '../systems/anomalies.js';
import { Krasue } from '../ghosts/krasue.js';
import { Memes } from '../systems/memes.js';
import { MiniGames } from '../systems/minigames.js';
import { Ending } from './ending.js';
import { Night1 } from '../nights/night1.js';
import { Night2 } from '../nights/night2.js';
import { Night3 } from '../nights/night3.js';
import { Prologue } from '../nights/prologue.js';
import { NIGHT_DM } from '../data/story.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const INTRO_MS = 4600;

export class Director {
  constructor({ scene, camera, renderer, level, player, peachi, menu, params }) {
    this.scene = scene; this.camera = camera; this.renderer = renderer;
    this.level = level; this.player = player; this.peachi = peachi; this.menu = menu;
    this.params = params;
    this.autostart = params.get('autostart') === '1';
    this.state = 'menu'; // 'menu' | 'dm' | 'prologue' | 'intro' | 'play' | 'end'
    this.paused = false;
    this.run = 0; // bumps on every start/abort so stale async flows stop

    this.cut = new Cutscene({ camera, player });
    this.doors = new Doors({ level, player });
    this.hide = new Hide({ player, camera });
    this.requests = new Requests({ player, peachi, level, doors: this.doors });
    this.phone = new Phone({ camera, player, level });
    this.power = new Power({ scene, level, player });
    this.anomalies = new Anomalies({ scene, level });
    this.krasue = new Krasue(scene, level);
    this.memes = new Memes({ scene });
    this.games = new MiniGames({ scene, level, player, camera });
    this.ending = new Ending();
    const ctx = {
      scene, camera, renderer, level, player, peachi, cut: this.cut, doors: this.doors, hide: this.hide, requests: this.requests,
      phone: this.phone, power: this.power, anomalies: this.anomalies, krasue: this.krasue, memes: this.memes, games: this.games, params,
    };
    this.nights = { 1: new Night1(ctx), 2: new Night2(ctx), 3: new Night3(ctx) };
    this.maxNight = Math.max(...Object.keys(this.nights).map(Number));
    this.night = this.nights[1];
    this.prologue = new Prologue(ctx);
    for (const n of Object.values(this.nights)) {
      n.nextLabel = this.nights[n.number + 1] ? `ไปต่อคืนที่ ${n.number + 1}` : null;
      n.onEnd = (kind) => {
        if (kind === 'ending') { this.playEnding(n.statRows()); return; } // Night 3's boss is down
        this.state = 'end';
        this.paused = false;
        if (document.pointerLockElement) document.exitPointerLock();
      };
    }
    Talk.listener = () => ({ x: player.position.x, z: player.position.z, yaw: player.yaw });
    Scream.onScream(() => { if (this.state === 'play') this.night.onScream(); });
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyQ' && this.state === 'play' && !this.paused) this.night.banSpam();
    });
  }

  lock() {
    try {
      const r = this.player.lock();
      if (r && typeof r.catch === 'function') r.catch(() => {});
    } catch (e) { /* pointer lock may be refused; the pause card handles it */ }
  }

  /** Which night the title's "start" leads to: the first one not cleared yet (or ?night=N). */
  pickNight() {
    const want = Number(this.params.get('night'));
    if (want && this.nights[want]) return want;
    return Math.min(Save.nextNight, this.maxNight);
  }
  setNight(n) { this.night = this.nights[n] || this.nights[1]; return this.night; }

  /** "เริ่มไลฟ์" on the title. */
  async start() {
    if (this.state !== 'menu') return;
    const run = ++this.run;
    try { sfx.init(); } catch (e) { /* no audio */ }
    if (Settings.get().mic) Promise.resolve(Scream.init()).catch(() => {}); // the permission prompt shows during the DM
    const skipParam = this.params.get('skip') === 'prologue';
    let n = this.pickNight();
    let choice = 'skip';
    if (n === 1) {
      if (!skipParam) {
        this.state = 'dm';
        choice = await this.prologue.dm(Save.data.prologueSeen);
        if (run !== this.run) return;
      }
    } else if (!this.params.get('night')) {
      // a returning player: this night's DM, with the cleared nights to replay
      this.state = 'dm';
      const beyond = Save.nextNight > this.maxNight;
      const actions = [];
      if (!beyond) actions.push([`n${n}`, `ไปต่อคืนที่ ${n}`]);
      for (let k = this.maxNight; k >= 1; k--) if (Save.cleared(k) && k !== n) actions.push([`n${k}`, `เล่นคืนที่ ${k} อีกครั้ง`]);
      if (beyond) actions.unshift([`n${this.maxNight}`, `เล่นคืนที่ ${this.maxNight} อีกครั้ง`]);
      const msgs = NIGHT_DM[beyond ? this.maxNight + 1 : n] || NIGHT_DM[n] || [];
      const pickd = await UI.showDM({ name: 'PeachiView', time: '23:59', messages: msgs, actions: actions.filter((a, i, arr) => arr.findIndex((b) => b[0] === a[0]) === i) });
      if (run !== this.run) return;
      n = Number(String(pickd).slice(1)) || n;
    }
    this.setNight(n);
    this.lock();
    this.menu.exit();
    if (choice === 'go' && n === 1) {
      this.state = 'prologue';
      await this.prologue.run();
      if (run !== this.run) return;
      Save.set({ prologueSeen: true });
    }
    await this.introThenNight(run, { keepPlayer: choice === 'go' && n === 1 });
  }

  async introThenNight(run, opts = {}) {
    this.state = 'intro';
    UI.showScreen('intro', this.night.introCard());
    await wait(INTRO_MS);
    if (run !== this.run) return;
    this.startNight(opts);
  }

  /** "คืนต่อไป" on the win card. */
  async next() {
    const n = this.night.number + 1;
    if (!this.nights[n]) return;
    const run = ++this.run;
    this.night.abort();
    this.setNight(n);
    try { sfx.init(); } catch (e) { /* already */ }
    if (!this.autostart) this.lock();
    await this.introThenNight(run);
  }

  startNight(opts = {}) {
    this.state = 'play';
    this.paused = false;
    UI.showScreen('play');
    UI.fade(0, 10);
    this.night.start(opts);
  }

  retry() {
    ++this.run;
    try { sfx.init(); } catch (e) { /* already */ }
    this.night.abort();
    this.night.retrying = true; // Night 3 restarts from the boss if it was lost there
    this.startNight();
    if (!this.autostart) this.lock();
  }

  toMenu() {
    ++this.run;
    this.prologue.abort();
    this.night.abort();
    this.hide.reset();
    this.phone.reset();
    this.power.reset();
    this.games.stop(true);
    if (this.cut.active) this.cut.skip();
    Talk.stop();
    this.player.enabled = false;
    this.state = 'menu';
    this.paused = false;
    if (document.pointerLockElement) document.exitPointerLock();
    this.level.resetWorld();
    UI.fade(0, 10);
    UI.setHudMode('full');
    UI.showScreen('menu');
    this.menu.enter();
  }

  /** Headless / debug start: straight into the night (or the prologue with ?prologue=1). */
  async autoStart() {
    const run = ++this.run;
    try { sfx.init(); } catch (e) { /* no gesture */ }
    this.setNight(this.pickNight());
    this.menu.exit();
    if (this.params.get('ending') === '1') { await this.playEnding(); return; }
    if (this.params.get('prologue') === '1') {
      this.state = 'prologue';
      await this.prologue.run();
      if (run !== this.run) return;
      this.startNight({ keepPlayer: true });
    } else this.startNight();
  }

  tick(dt, t) {
    const { level, player, cut, hide, night, peachi } = this;
    level.update(dt, t);
    cut.update(dt);
    const walking = this.state === 'prologue' || (this.state === 'play' && night.state === 'play');
    const paused = walking && !this.autostart && !player.isLocked && !cut.active && peachi.state !== 'jumpscare';
    if (paused !== this.paused) UI.showScreen(paused ? 'pause' : 'play');
    this.paused = paused;
    night.paused = paused;
    Scream.enabled = this.state === 'play' && !paused && !hide.hidden && !cut.active && !night.inputLock;
    this.phone.enabled = this.state === 'play' && night.state === 'play' && !paused && !cut.active;
    this.phone.update(dt);
    this.power.update(dt, t);
    if (paused) return;
    if (this.state === 'menu') this.menu.update(dt);
    if (walking && !cut.active && !hide.hidden) player.update(dt);
    hide.update(dt);
    Scream.update(dt);
    if (this.state === 'prologue') {
      this.prologue.update(dt);
      peachi.update(dt, t, { camera: this.camera });
    } else night.update(dt, t);
  }

  /** The normal ending (after the boss): dawn scene → Happy Halloween → credits → title. */
  async playEnding(stats) {
    const run = ++this.run;
    this.state = 'ending';
    this.night.abort();
    UI.setHudMode('cine');
    UI.showScreen('play');
    await this.ending.play({ cut: this.cut, peachi: this.peachi, level: this.level, stats: stats || this.night.statRows() });
    if (run !== this.run) return;
    this.toMenu();
  }

  /** Right after the frame is rendered: the phone grabs a pending photo's thumbnail. */
  afterRender(canvas) { this.phone.capture(canvas); }
}
