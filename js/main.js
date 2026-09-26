// Boot: renderer, scene, level, player, Peachi, the title menu and the director (game flow), then the
// main loop. Debug params: ?autostart=1 (straight into the night; add &prologue=1 for the prologue),
// ?night=N, ?skip=prologue, ?hour=N, ?speed=N, ?god=1, ?post=0.
// The loading screen (#boot in index.html) stays up until the 3D Peachi is downloaded, decoded, swapped in
// and her shaders compiled, so the title never shows the stand-in model (45 s cap, then it goes on anyway).
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
import { preloadModels } from './peachi/peachi3d.js';

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
// start the 3D model download first, so the builds below find it in flight
const bootEl = document.getElementById('boot');
const bootFill = document.getElementById('boot-fill');
const bootText = document.getElementById('boot-text');
const bootSay = (k, text) => { if (bootFill) bootFill.style.width = `${Math.round(k * 100)}%`; if (bootText) bootText.textContent = text; };
const modelsReady = preloadModels((k) => bootSay(k * 0.85, k < 1 ? `กำลังโหลดพีชชี่… ${Math.round(k * 100)}%` : 'กำลังแต่งตัวพีชชี่…'))
  .catch((e) => console.warn('[boot] 3D model preload failed, using the stand-in model:', e));

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
  krasue: director.krasue, phone: director.phone, power: director.power, anomalies: director.anomalies, games: director.games,
  get state() { return director.state; }, get night() { return director.night; }, get paused() { return director.paused; } };
window.__game = game;

// ---------------------------------------------------------------- performance: FPS meter + auto resolution
// Below ~40 FPS for 3 s the render scale steps down (to 60% at most); above ~56 FPS for 10 s it steps back.
let renderScale = 1, fpsEma = 60, lowT = 0, highT = 0, fpsShowT = 0;
const fpsEl = document.createElement('div');
fpsEl.className = 'fps-meter tnum'; fpsEl.hidden = true;
document.body.appendChild(fpsEl);
function watchFps(rawDt) {
  const dt = Math.min(Math.max(rawDt, 1e-3), 0.25); // a hidden tab comes back with one huge frame
  fpsEma += (1 / dt - fpsEma) * 0.05;
  const s = Settings.get();
  if ((fpsShowT -= dt) <= 0 && s.showFps) { fpsShowT = 0.5; fpsEl.textContent = `${Math.round(fpsEma)} FPS${renderScale < 1 ? ` · ${Math.round(renderScale * 100)}%` : ''}`; }
  if (!s.autoRes) return;
  if (fpsEma < 40) { lowT += dt; highT = 0; } else if (fpsEma > 56) { highT += dt; lowT = 0; } else { lowT = 0; highT = 0; }
  const step = lowT > 3 && renderScale > 0.6 ? -0.15 : highT > 10 && renderScale < 1 ? 0.15 : 0;
  if (step) { renderScale = Math.min(1, Math.max(0.6, renderScale + step)); lowT = 0; highT = 0; applySettings(s); }
}

// ---------------------------------------------------------------- settings
function recompileAll() { scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); }); }
function applySettings(s) {
  sfx.setMaster(s.volume * 0.6);
  player.sensitivity = 0.0022 * s.sensitivity;
  if (camera.fov !== s.fov) { camera.fov = s.fov; camera.updateProjectionMatrix(); }
  const shadows = s.quality !== 'low';
  const wantPost = !!post && s.quality !== 'low';
  sfx.setLoudCap(s.streamer ? 0.4 : 1);
  if (fpsEl) fpsEl.hidden = !s.showFps;
  if (!s.autoRes) renderScale = 1;
  const ratio = (s.quality === 'high' ? DPR : 1) * renderScale;
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
UI.onNext(() => director.next());

// ---------------------------------------------------------------- loop
const clock = new THREE.Clock();
let elapsed = 0;
const reported = new Set();

function frame() {
  requestAnimationFrame(frame);
  const raw = clock.getDelta();
  const dt = Math.min(raw, 0.05);
  watchFps(raw);
  elapsed += dt;
  try {
    director.tick(dt, elapsed);
  } catch (e) {
    const key = String(e && e.message);
    if (!reported.has(key)) { reported.add(key); console.error('[game loop]', e); }
  }
  if (post && usePost) post.render(dt); else renderer.render(scene, camera);
  director.afterRender(renderer.domElement);
}

requestAnimationFrame(frame);

async function boot() {
  const until = (fn, ms) => new Promise((resolve) => { const t0 = performance.now(); const tick = () => (fn() || performance.now() - t0 > ms ? resolve() : setTimeout(tick, 50)); tick(); });
  const cap = new Promise((r) => setTimeout(r, 45000));
  await Promise.race([modelsReady.then(() => until(() => peachi.model.is3D, 8000)), cap]);
  // compile her shaders now (visible for the pass), not on the first frame she shows up
  bootSay(0.95, 'เตรียมห้องสตรีม…');
  const wasVisible = peachi.group.visible;
  peachi.group.visible = true;
  try {
    if (renderer.compileAsync) await Promise.race([renderer.compileAsync(scene, camera), new Promise((r) => setTimeout(r, 8000))]);
    else renderer.compile(scene, camera);
  } catch (e) { /* the first frame compiles instead */ }
  peachi.group.visible = wasVisible;
  bootSay(1, 'พร้อมแล้ว!');
  if (bootEl) { bootEl.classList.add('done'); setTimeout(() => bootEl.remove(), 700); }
  if (AUTOSTART) {
    director.autoStart();
  } else {
    menu.enter();
    if (params.get('flash') === '1') menu.flashNow();
  }
}
boot();
