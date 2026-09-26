// Boot: renderer, scene, level, player, Peachi, the title menu and the director (game flow), then the
// main loop. Debug params: ?autostart=1 (straight into the night; add &prologue=1 for the prologue),
// ?skip=prologue, ?hour=N, ?speed=N, ?god=1, ?post=0.
import * as THREE from 'three';
import { buildLevel } from './level.js';
import { Player } from './player.js';
import { UI } from './ui.js';
import { sfx } from './audio.js';
import { Scream } from './mic.js';
import { PeachiGhost } from './ghosts/peachi.js';
import { Director } from './game/director.js';
import { Save } from './game/save.js';
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
const menu = createMenuScene({ camera, level, peachi, sfx, UI });
const director = new Director({ scene, camera, renderer, level, player, peachi, menu, params });

const game = { director, peachi, player, level, scene, camera, renderer, UI, Scream, menu, Settings, Save,
  get state() { return director.state; }, get night() { return director.night; }, get paused() { return director.paused; } };
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
UI.setSound((kind) => { try { sfx.play(kind === 'select' ? 'pickup' : kind === 'dm' ? 'notify' : 'tick'); } catch (e) { /* ignore */ } });

UI.onStart(() => director.start());
UI.onRetry(() => director.retry());
UI.onHome(() => director.toMenu());
UI.onResume(() => director.lock());

// ---------------------------------------------------------------- loop
const clock = new THREE.Clock();
let elapsed = 0;
const reported = new Set();

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;
  try {
    director.tick(dt, elapsed);
  } catch (e) {
    const key = String(e && e.message);
    if (!reported.has(key)) { reported.add(key); console.error('[game loop]', e); }
  }
  if (post && usePost) post.render(dt); else renderer.render(scene, camera);
}

if (AUTOSTART) {
  director.autoStart();
} else {
  menu.enter();
  if (params.get('flash') === '1') menu.flashNow();
}
requestAnimationFrame(frame);
