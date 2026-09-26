// The flow of the whole game: title → (DM + prologue the first time) → night card → night → ending
// scene → win/lose card → retry or back to the title. Owns the shared systems (cutscenes, doors,
// hiding, requests) and decides what updates each frame and when the game counts as paused.
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
import { Night1 } from '../nights/night1.js';
import { Prologue } from '../nights/prologue.js';

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
    const ctx = { scene, camera, renderer, level, player, peachi, cut: this.cut, doors: this.doors, hide: this.hide, requests: this.requests, params };
    this.nights = { 1: new Night1(ctx) };
    this.night = this.nights[1];
    this.prologue = new Prologue(ctx);
    for (const n of Object.values(this.nights)) {
      n.onEnd = () => {
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

  /** "เริ่มไลฟ์" on the title. */
  async start() {
    if (this.state !== 'menu') return;
    const run = ++this.run;
    try { sfx.init(); } catch (e) { /* no audio */ }
    if (Settings.get().mic) Promise.resolve(Scream.init()).catch(() => {}); // the permission prompt shows during the DM
    const skipParam = this.params.get('skip') === 'prologue';
    let choice = 'skip';
    if (!skipParam) {
      this.state = 'dm';
      choice = await this.prologue.dm(Save.data.prologueSeen);
      if (run !== this.run) return;
    }
    this.lock();
    this.menu.exit();
    if (choice === 'go') {
      this.state = 'prologue';
      await this.prologue.run();
      if (run !== this.run) return;
      Save.set({ prologueSeen: true });
    }
    await this.introThenNight(run, { keepPlayer: choice === 'go' });
  }

  async introThenNight(run, opts = {}) {
    this.state = 'intro';
    UI.showScreen('intro', this.night.introCard());
    await wait(INTRO_MS);
    if (run !== this.run) return;
    this.startNight(opts);
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
    this.startNight();
    if (!this.autostart) this.lock();
  }

  toMenu() {
    ++this.run;
    this.prologue.abort();
    this.night.abort();
    this.hide.reset();
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
    this.menu.exit();
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
    Scream.enabled = this.state === 'play' && !paused && !hide.hidden && !cut.active;
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
}
