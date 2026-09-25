// Boot, renderer, main loop and game state machine: title (live room backdrop) → intro → play ⇄ pause
// → gameover/win → retry or back to the title.
import * as THREE from 'three';
import { buildLevel } from './level.js';
import { Player } from './player.js';
import { UI } from './ui.js';
import { sfx } from './audio.js';
import { Scream } from './mic.js';
import { PeachiGhost } from './ghosts/peachi.js';
import { Night } from './night.js';
import { createPost } from './world/post.js';
import { createMenuScene } from './menu.js';
import { Settings } from './settings.js';

const params = new URLSearchParams(location.search);
const AUTOSTART = params.get('autostart') === '1';
const ALLOW_POST = params.get('post') !== '0';
const DPR = Math.min(window.devicePixelRatio || 1, 1.5);

// ---------------------------------------------------------------- renderer / scene / camera
const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(DPR);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = ALLOW_POST ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07040c);
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 120);

let post = null, usePost = false;
function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  if (post) post.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onResize);

// ---------------------------------------------------------------- boot
UI.init();
UI.showScreen('menu');

const level = buildLevel(scene);
if (ALLOW_POST) {
  try { post = createPost(renderer, scene, camera); } catch (e) { console.warn('post-processing unavailable', e); }
}
if (!scene.fog) scene.fog = new THREE.FogExp2(0x1a0b2e, 0.06);
const player = new Player(camera, renderer.domElement, level);
if (!camera.parent) scene.add(camera); // flashlight SpotLight hangs off the camera
player.enabled = false;
player.onPrompt = (label) => UI.setPrompt(label);
player.onFlashlightToggle = () => sfx.play('tick');

const peachi = new PeachiGhost(scene, level);
const night = new Night({ scene, camera, level, player, peachi });
const menu = createMenuScene({ camera, level, peachi, sfx, UI });

const game = {
  state: 'menu', // 'menu' | 'intro' | 'play' | 'gameover' | 'win'
  paused: false,
  autostart: AUTOSTART,
  night, peachi, player, level, scene, camera, renderer, UI, Scream, menu, Settings,
};
window.__game = game;

// ---------------------------------------------------------------- settings
function recompileAll() { scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); }); }
function applySettings(s) {
  sfx.setMaster(s.volume * 0.6);
  player.sensitivity = 0.0022 * s.sensitivity;
  if (camera.fov !== s.fov) { camera.fov = s.fov; camera.updateProjectionMatrix(); }
  const shadows = s.quality !== 'low';
  const wantPost = !!post && s.quality !== 'low';
  const ratio = s.quality === 'high' ? DPR : 1;
  let recompile = false;
  if (renderer.shadowMap.enabled !== shadows) { renderer.shadowMap.enabled = shadows; recompile = true; if (shadows && level.moon) level.moon.shadow.needsUpdate = true; }
  const tm = wantPost ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
  if (renderer.toneMapping !== tm) { renderer.toneMapping = tm; recompile = true; }
  usePost = wantPost;
  if (post) post.bloomPass.enabled = s.quality === 'high';
  if (renderer.getPixelRatio() !== ratio) { renderer.setPixelRatio(ratio); onResize(); }
  if (recompile) recompileAll();
}
Settings.onChange(applySettings);

// audio can only start after a user gesture: start it on the first key / click anywhere
const wakeAudio = () => { try { sfx.init(); } catch (e) { /* ignore */ } window.removeEventListener('pointerdown', wakeAudio); window.removeEventListener('keydown', wakeAudio); };
window.addEventListener('pointerdown', wakeAudio);
window.addEventListener('keydown', wakeAudio);
UI.setSound((kind) => { try { sfx.play(kind === 'select' ? 'pickup' : 'tick'); } catch (e) { /* ignore */ } });

// ---------------------------------------------------------------- state machine
night.onEnd = (result) => {
  game.state = result === 'win' ? 'win' : 'gameover';
  game.paused = false;
  if (document.pointerLockElement) document.exitPointerLock();
};

function safeLock() {
  try {
    const r = player.lock();
    if (r && typeof r.catch === 'function') r.catch(() => {});
  } catch (e) { /* pointer lock may be refused (cooldown, no gesture) — the pause menu handles it */ }
}

function toMenu() {
  night.abort();
  player.enabled = false;
  game.state = 'menu';
  game.paused = false;
  if (document.pointerLockElement) document.exitPointerLock();
  UI.showScreen('menu');
  menu.enter();
}

function startNight() {
  menu.exit();
  game.state = 'play';
  game.paused = false;
  UI.showScreen('play');
  night.start();
}

function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((res) => setTimeout(res, ms))]);
}

const INTRO_MS = 3200;
UI.onStart(async () => {
  if (game.state !== 'menu') return;
  game.state = 'intro';
  const t0 = performance.now();
  try { sfx.init(); } catch (e) { console.warn('sfx.init failed', e); }
  UI.showScreen('intro', { title: 'คืนที่ 1', clock: '00:00', text: 'หาหูฟังหูแมวของพีชชี่ให้เจอ แล้วเอาไปวางคืนที่โต๊ะสตรีมก่อนหกโมงเช้า' });
  if (Settings.get().mic) {
    try { await withTimeout(Promise.resolve(Scream.init()), 8000); } catch (e) { console.warn('mic unavailable, using Space fallback', e); }
  }
  safeLock();
  const rest = INTRO_MS - (performance.now() - t0);
  if (rest > 0) await new Promise((r) => setTimeout(r, rest));
  if (game.state === 'intro') startNight();
});
UI.onRetry(() => {
  try { sfx.init(); } catch (e) { /* already initialised */ }
  startNight();
  if (!AUTOSTART) safeLock();
});
UI.onHome(() => toMenu());
UI.onResume(() => { safeLock(); });

window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyQ' && game.state === 'play' && !game.paused) night.banSpam();
});

// ---------------------------------------------------------------- loop
const clock = new THREE.Clock();
let elapsed = 0;
const reported = new Set();

function tick(dt, t) {
  level.update(dt, t);
  if (game.state === 'play') {
    const paused = !AUTOSTART && !player.isLocked && night.state === 'play' && peachi.state !== 'jumpscare';
    if (paused !== game.paused) UI.showScreen(paused ? 'pause' : 'play');
    game.paused = paused;
    night.paused = paused;
    Scream.enabled = !paused;
    if (paused) return;
    player.update(dt);
    Scream.update(dt);
    night.update(dt, t);
  } else {
    Scream.enabled = false;
    if (game.state === 'menu') menu.update(dt);
    night.update(dt, t); // idle animation (Peachi / headphones) behind menus
  }
}

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;
  try {
    tick(dt, elapsed);
  } catch (e) {
    const key = String(e && e.message);
    if (!reported.has(key)) { reported.add(key); console.error('[game loop]', e); }
  }
  if (post && usePost) post.render(dt); else renderer.render(scene, camera);
}

if (AUTOSTART) {
  try { sfx.init(); } catch (e) { /* no gesture in headless; audio stays suspended */ }
  startNight();
} else {
  menu.enter();
  if (params.get('flash') === '1') menu.flashNow();
}
requestAnimationFrame(frame);
