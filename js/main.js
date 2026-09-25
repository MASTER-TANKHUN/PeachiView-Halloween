// Boot, renderer, main loop and game state machine (menu → intro → play → gameover/win → retry).
import * as THREE from 'three';
import { buildLevel } from './level.js';
import { Player } from './player.js';
import { UI } from './ui.js';
import { sfx } from './audio.js';
import { Scream } from './mic.js';
import { PeachiGhost } from './ghosts/peachi.js';
import { Night } from './night.js';
import { createPost } from './world/post.js';

const params = new URLSearchParams(location.search);
const AUTOSTART = params.get('autostart') === '1';

// ---------------------------------------------------------------- renderer / scene / camera
const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
// tone mapping happens in the post grade pass (soft highlight roll-off); without post fall back to ACES
const USE_POST = params.get('post') !== '0';
renderer.toneMapping = USE_POST ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07040c);
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 120);

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  if (post) post.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onResize);
let post = null;

// ---------------------------------------------------------------- boot
UI.init();
UI.showScreen('menu');

const level = buildLevel(scene);
if (USE_POST) {
  try { post = createPost(renderer, scene, camera); } catch (e) { console.warn('post-processing unavailable', e); renderer.toneMapping = THREE.ACESFilmicToneMapping; }
}
if (!scene.fog) scene.fog = new THREE.FogExp2(0x1a0b2e, 0.06);
const player = new Player(camera, renderer.domElement, level);
if (!camera.parent) scene.add(camera); // flashlight SpotLight hangs off the camera
player.enabled = false;
player.onPrompt = (label) => UI.setPrompt(label);
player.onFlashlightToggle = () => sfx.play('tick');

const peachi = new PeachiGhost(scene, level);
const night = new Night({ scene, camera, level, player, peachi });

// menu backdrop: stand at spawn looking into the house
camera.position.copy(level.spawn.position).add(new THREE.Vector3(0, 1.6, 0));
camera.rotation.set(0, level.spawn.yaw || 0, 0, 'YXZ');

let pausedFor = 0;
let hintAt = -99;

const game = {
  state: 'menu', // 'menu' | 'intro' | 'play' | 'gameover' | 'win'
  paused: false,
  autostart: AUTOSTART,
  night, peachi, player, level, scene, camera, renderer, UI, Scream,
};
window.__game = game;

night.onEnd = (result) => {
  game.state = result === 'win' ? 'win' : 'gameover';
  game.paused = false;
  if (document.pointerLockElement) document.exitPointerLock();
};

function safeLock() {
  try {
    const r = player.lock();
    if (r && typeof r.catch === 'function') r.catch(() => {});
  } catch (e) { /* pointer lock may be refused (cooldown, no gesture) — click hint handles it */ }
}

function startNight() {
  game.state = 'play';
  game.paused = false;
  pausedFor = 0;
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
  UI.showScreen('intro', { title: 'คืนที่ 1', clock: '00:00', text: 'หาหูฟังหูแมวให้พีชชี่ แล้วเอาไปวางคืนที่โต๊ะสตรีมก่อนตี 6…' });
  try { await withTimeout(Promise.resolve(Scream.init()), 8000); } catch (e) { console.warn('mic unavailable, using Space fallback', e); }
  safeLock(); // as soon as the mic prompt is gone (gesture may still be fresh); otherwise the click hint re-locks
  const rest = INTRO_MS - (performance.now() - t0);
  if (rest > 0) await new Promise((r) => setTimeout(r, rest));
  if (game.state === 'intro') startNight();
});

UI.onRetry(() => {
  try { sfx.init(); } catch (e) { /* already initialised */ }
  startNight();
  if (!AUTOSTART) safeLock();
});

// re-lock on click while playing (mousedown so it doesn't double up with the retry button's click)
window.addEventListener('mousedown', () => {
  if (AUTOSTART || player.isLocked) return;
  if ((game.state === 'play' && night.state === 'play') || game.state === 'intro') safeLock();
});

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
    game.paused = paused;
    night.paused = paused;
    Scream.enabled = !paused;
    if (paused) {
      pausedFor += dt;
      if (pausedFor > 0.35 && t - hintAt > 3.5) { hintAt = t; UI.toast('คลิกเพื่อเล่นต่อ'); }
      return;
    }
    pausedFor = 0;
    player.update(dt);
    Scream.update(dt);
    night.update(dt, t);
  } else {
    Scream.enabled = false;
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
  if (post) post.render(dt); else renderer.render(scene, camera);
}

if (AUTOSTART) {
  try { sfx.init(); } catch (e) { /* no gesture in headless; audio stays suspended */ }
  startNight();
}
requestAnimationFrame(frame);
