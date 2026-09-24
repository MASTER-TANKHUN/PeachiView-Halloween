// Boot, renderer, main loop and game state machine (menu → intro → play → gameover/win → retry).
import * as THREE from 'three';
import { buildLevel } from './level.js';
import { Player } from './player.js';
import { UI } from './ui.js';
import { sfx } from './audio.js';
import { Scream } from './mic.js';
import { PeachiGhost } from './ghosts/peachi.js';
import { Night } from './night.js';

const params = new URLSearchParams(location.search);
const AUTOSTART = params.get('autostart') === '1';

// ---------------------------------------------------------------- renderer / scene / camera
const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07040c);
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 120);

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onResize);

// ---------------------------------------------------------------- boot
UI.init();
UI.showScreen('menu');

const level = buildLevel(scene);
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

UI.onStart(async () => {
  if (game.state !== 'menu') return;
  game.state = 'intro';
  try { sfx.init(); } catch (e) { console.warn('sfx.init failed', e); }
  UI.showScreen('intro');
  try { await withTimeout(Promise.resolve(Scream.init()), 8000); } catch (e) { console.warn('mic unavailable, using Space fallback', e); }
  startNight();
  safeLock();
});

UI.onRetry(() => {
  try { sfx.init(); } catch (e) { /* already initialised */ }
  startNight();
  if (!AUTOSTART) safeLock();
});

// re-lock on click while playing (mousedown so it doesn't double up with the retry button's click)
window.addEventListener('mousedown', () => {
  if (game.state === 'play' && !AUTOSTART && !player.isLocked && night.state === 'play') safeLock();
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
  renderer.render(scene, camera);
}

if (AUTOSTART) {
  try { sfx.init(); } catch (e) { /* no gesture in headless; audio stays suspended */ }
  startNight();
}
requestAnimationFrame(frame);
