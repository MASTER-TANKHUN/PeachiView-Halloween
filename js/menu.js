// Title screen, inside Peachi's room at 3 a.m.: the camera waits behind her gaming chair, her monitor
// shows the stream's title card, and the menu is a row of handwritten sticky notes stuck on the wall
// above it. Hover peels a note up; picking "เริ่มไลฟ์" pushes the camera into the screen. Every so
// often Peachi is standing right there — a black silhouette — for a tenth of a second.
import * as THREE from 'three';
import { FONT_SPECS } from './world/tex.js';

const TAU = Math.PI * 2;
const NOTES = [ // id, text, paper color, position on the wall above the monitor (x, y), size, tilt
  { id: 'play', text: 'เริ่มไลฟ์', sub: 'คืนที่ 1', color: '#ff9fc4', x: -6.2, y: 1.675, s: 0.28, tilt: 0.07, doodle: 'play' },
  { id: 'howto', text: 'วิธีเล่น', color: '#ffe57a', x: -5.885, y: 1.62, s: 0.24, tilt: -0.05, doodle: 'q' },
  { id: 'settings', text: 'ตั้งค่า', color: '#a6dcff', x: -5.585, y: 1.665, s: 0.24, tilt: 0.04, doodle: 'gear' },
  { id: 'credits', text: 'เครดิต', color: '#bdf2a8', x: -5.285, y: 1.605, s: 0.235, tilt: -0.08, doodle: 'heart' },
];
const WALL_Z = -6.884;
const HOME = { eye: new THREE.Vector3(-5.06, 1.6, -5.0), look: new THREE.Vector3(-5.78, 1.37, -6.8) };
const SCREEN = new THREE.Vector3(-5.73, 1.153, -6.66); // main monitor
const SPOTS = [[-6.3, -5.8], [-4.55, -5.95], [-6.9, -5.5]];

// ------------------------------------------------------------------ canvas art
function inkText(g, text, x, y, size, color = '#26203a') {
  g.font = `400 ${size}px Sriracha, Mitr, sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = color; g.fillText(text, x, y);
}
function drawNote(g, w, h, n, hot) {
  g.clearRect(0, 0, w, h);
  const pad = 10;
  g.save();
  g.shadowColor = 'rgba(0,0,0,0.35)'; g.shadowBlur = 10; g.shadowOffsetY = 4;
  g.fillStyle = n.color; g.fillRect(pad, pad, w - pad * 2, h - pad * 2);
  g.restore();
  const shade = g.createLinearGradient(0, pad, 0, h - pad);
  shade.addColorStop(0, 'rgba(0,0,0,0.10)'); shade.addColorStop(0.18, 'rgba(0,0,0,0)'); shade.addColorStop(0.8, 'rgba(255,255,255,0.05)'); shade.addColorStop(1, 'rgba(0,0,0,0.12)');
  g.fillStyle = shade; g.fillRect(pad, pad, w - pad * 2, h - pad * 2);
  g.fillStyle = 'rgba(0,0,0,0.12)'; // curl at the bottom-right corner
  g.beginPath(); g.moveTo(w - pad, h - pad - 40); g.quadraticCurveTo(w - pad - 12, h - pad - 12, w - pad - 40, h - pad); g.lineTo(w - pad, h - pad); g.fill();
  inkText(g, n.text, w / 2, h * 0.47, n.text.length > 6 ? 58 : 64);
  if (n.sub) inkText(g, n.sub, w / 2, h * 0.73, 30, '#5a3350');
  g.strokeStyle = '#26203a'; g.lineWidth = 3; g.lineCap = 'round'; g.lineJoin = 'round';
  const dx = w - 58, dy = 48;
  if (n.doodle === 'play') { g.beginPath(); g.moveTo(dx - 12, dy - 14); g.lineTo(dx + 14, dy); g.lineTo(dx - 12, dy + 14); g.closePath(); g.stroke(); }
  if (n.doodle === 'heart') { g.beginPath(); g.moveTo(dx, dy + 12); g.bezierCurveTo(dx - 22, dy - 2, dx - 10, dy - 18, dx, dy - 6); g.bezierCurveTo(dx + 10, dy - 18, dx + 22, dy - 2, dx, dy + 12); g.stroke(); }
  if (n.doodle === 'q') inkText(g, '?', dx, dy, 40);
  if (n.doodle === 'gear') { g.beginPath(); g.arc(dx, dy, 9, 0, TAU); g.stroke(); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; g.beginPath(); g.moveTo(dx + Math.cos(a) * 12, dy + Math.sin(a) * 12); g.lineTo(dx + Math.cos(a) * 17, dy + Math.sin(a) * 17); g.stroke(); } }
  if (hot) { // pen underline under the chosen note
    g.strokeStyle = '#d23a6e'; g.lineWidth = 5;
    g.beginPath(); g.moveTo(w * 0.2, h * (n.sub ? 0.63 : 0.67)); g.quadraticCurveTo(w * 0.5, h * (n.sub ? 0.67 : 0.71), w * 0.8, h * (n.sub ? 0.61 : 0.65)); g.stroke();
  }
}
function drawTitleCard(g, w, h, t, glitch) {
  const bg = g.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#2c1540'); bg.addColorStop(1, '#10071a');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 22; i++) { g.fillStyle = `rgba(255,190,230,${0.15 + (i % 4) * 0.08})`; g.beginPath(); g.arc((i * 131 + t * 6) % w, (i * 71) % h, 1.2 + (i % 3), 0, TAU); g.fill(); }
  g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, 0, w, 40); // top bar of the stream app
  if (Math.floor(t * 1.2) % 2 === 0) { g.fillStyle = '#ff3b4f'; g.beginPath(); g.arc(22, 20, 7, 0, TAU); g.fill(); }
  g.font = '500 18px Kanit, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillStyle = '#efe2f2';
  const m = Math.floor(t / 60) % 60;
  g.fillText(`ไลฟ์ยังไม่ปิด   03:${String(m).padStart(2, '0')}   ผู้ชม 249`, 38, 21);
  g.save(); // hand-lettered logo, sticker style
  g.translate(w / 2, h * 0.43); g.rotate(-0.05);
  g.font = '400 118px Sriracha, Kanit, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillText('PeachiView', 6, 8);
  g.strokeStyle = '#fff4f8'; g.lineWidth = 16; g.strokeText('PeachiView', 0, 0);
  g.fillStyle = '#ff6fa3'; g.fillText('PeachiView', 0, 0);
  g.restore();
  g.save(); // tape strip with the Thai subtitle
  g.translate(w / 2 + 40, h * 0.66); g.rotate(0.035);
  g.fillStyle = 'rgba(245,230,200,0.9)'; g.fillRect(-190, -30, 380, 60);
  g.fillStyle = 'rgba(0,0,0,0.06)'; for (let i = -190; i < 190; i += 14) g.fillRect(i, -30, 2, 60);
  inkText(g, 'ไลฟ์ผี 249 ชั่วโมง', 0, 2, 42, '#2a1a30');
  g.restore();
  g.save(); g.translate(w * 0.14, h * 0.7); g.rotate(-0.2); // ghost-peach doodle
  g.fillStyle = '#ffae98'; g.beginPath(); g.arc(0, 0, 30, 0, TAU); g.fill();
  g.fillStyle = '#7fcb8c'; g.beginPath(); g.ellipse(12, -30, 14, 6, -0.5, 0, TAU); g.fill();
  g.fillStyle = '#2a1a30'; g.beginPath(); g.arc(-9, -2, 4, 0, TAU); g.arc(9, -2, 4, 0, TAU); g.fill();
  g.beginPath(); g.arc(0, 9, 5, 0, Math.PI); g.fill();
  g.restore();
  g.font = '400 20px Mitr, sans-serif'; g.textAlign = 'center'; g.fillStyle = `rgba(239,226,242,${0.55 + 0.35 * Math.sin(t * 3)})`;
  g.fillText('รอมอดมากดเริ่มไลฟ์...', w / 2, h - 30);
  g.fillStyle = 'rgba(0,0,0,0.13)'; for (let y = 0; y < h; y += 3) g.fillRect(0, y, w, 1); // scanlines
  if (glitch > 0) { // static burst when she shows up
    const img = g.getImageData(0, 0, w, h), d = img.data;
    for (let i = 0; i < d.length; i += 4) { if (Math.random() < glitch) { const v = Math.random() * 255; d[i] = d[i + 1] = d[i + 2] = v; } }
    g.putImageData(img, 0, 0);
  }
}

// ------------------------------------------------------------------ controller
export function createMenuScene({ camera, level, peachi, sfx, UI }) {
  const root = new THREE.Group(); root.name = 'titleNotes';
  level.scene.add(root);
  const notes = NOTES.map((n) => {
    const c = document.createElement('canvas'); c.width = 320; c.height = 320;
    const g = c.getContext('2d');
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.9, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.28, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(n.s * 1.06, n.s * 1.06), mat);
    const pivot = new THREE.Group(); // hinge along the top edge so the note peels up
    pivot.position.set(n.x, n.y + n.s / 2, WALL_Z); pivot.rotation.z = n.tilt;
    mesh.position.y = -n.s / 2;
    pivot.add(mesh); root.add(pivot);
    const o = { n, g, tex, mesh, pivot, hot: false, lift: 0 };
    o.draw = () => { drawNote(g, 320, 320, n, o.hot); tex.needsUpdate = true; };
    o.draw();
    return o;
  });
  if (document.fonts) Promise.all(FONT_SPECS.map((f) => document.fonts.load(f, 'กขA'))).then(() => notes.forEach((o) => o.draw())).catch(() => {});

  const screen = level.screens && level.screens.main;
  const eye = new THREE.Vector3(), look = new THREE.Vector3(), tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let t = 0, active = false, next = 0, flashLeft = 0, flickLeft = 0, glitch = 0, cardT = 0, sel = 0, hover = -1, going = null;

  const blip = (name) => { try { sfx.play(name); } catch { /* audio not started yet */ } };
  function setSel(i, silent) {
    i = (i + notes.length) % notes.length;
    if (i !== sel && !silent) blip('tick');
    sel = i;
    notes.forEach((o, k) => { const h = k === sel; if (o.hot !== h) { o.hot = h; o.draw(); } });
  }
  function pick(i) {
    const id = notes[i].n.id;
    blip('pickup');
    if (id === 'play') { going = { t: 0 }; UI.setMenuBusy(true); } else UI.openMenuPanel(id);
  }
  function schedule(first) { next = first ? 7 + Math.random() * 6 : 25 + Math.random() * 35; }
  function flash() {
    const cands = SPOTS.filter(([x, z]) => { tmp.set(x, 1.2, z).project(camera); return Math.abs(tmp.x) < 0.9 && Math.abs(tmp.y) < 0.9; });
    if (!cands.length) return false;
    const [x, z] = cands[Math.floor(Math.random() * cands.length)];
    const g = peachi.group;
    g.position.set(x, 0, z);
    g.rotation.set(0, Math.atan2(eye.x - x, eye.z - z), 0);
    peachi.model.setDark(1); peachi.model.lookAt(eye); peachi.model.setGlow(0);
    peachi.model.setPose('idle'); peachi.model.setExpression(Math.random() < 0.5 ? 'happy' : 'scream');
    g.visible = true;
    flashLeft = 0.1; flickLeft = 0.35; glitch = 0.5;
    level.setFlicker(true);
    blip('flicker');
    return true;
  }
  function drawCard() {
    if (!screen) return;
    const { ctx, canvas } = screen.userData;
    drawTitleCard(ctx, canvas.width, canvas.height, t, glitch);
    screen.needsUpdate = true;
  }

  // pointer: hover / click the notes (only on the title screen with no panel open)
  const ready = () => active && !going && UI.screen === 'menu' && !UI.menuPanelOpen();
  window.addEventListener('pointermove', (e) => {
    if (!ready()) { hover = -1; document.body.style.cursor = ''; return; }
    ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(notes.map((o) => o.mesh))[0];
    hover = hit ? notes.findIndex((o) => o.mesh === hit.object) : -1;
    if (hover >= 0) setSel(hover);
    document.body.style.cursor = hover >= 0 ? 'pointer' : '';
  });
  window.addEventListener('click', (e) => {
    if (!ready() || (e.target.closest && e.target.closest('.sheet, button'))) return;
    if (hover >= 0) pick(hover);
  });
  UI.setMenuKeys({ move: (d) => setSel(sel + d), pick: () => pick(sel) });

  return {
    get active() { return active; },
    home: HOME, // camera framing (tweakable from the console)
    enter() {
      active = true; going = null; t = Math.random() * 30;
      root.visible = true;
      peachi.group.visible = false; peachi.model.setDark(0);
      setSel(0, true);
      UI.setMenuBusy(false);
      schedule(true);
    },
    exit() {
      active = false;
      root.visible = false;
      flashLeft = 0; flickLeft = 0; glitch = 0;
      level.setFlicker(false);
      peachi.model.setDark(0); peachi.group.visible = true;
      document.body.style.cursor = '';
      if (screen) { const { ctx, canvas, draw } = screen.userData; ctx.clearRect(0, 0, canvas.width, canvas.height); draw(ctx, canvas.width, canvas.height); screen.needsUpdate = true; }
    },
    update(dt) {
      if (!active) return;
      t += dt;
      // handheld drift around the home framing; push into the monitor when starting
      eye.copy(HOME.eye).add(tmp.set(0.05 * Math.sin(t * 0.37), 0.025 * Math.sin(t * 0.61 + 1) + 0.006 * Math.sin(t * 2.3), 0.04 * Math.sin(t * 0.23)));
      look.copy(HOME.look).add(tmp.set(0.03 * Math.sin(t * 0.29 + 2), 0.02 * Math.sin(t * 0.41), 0));
      if (going) {
        going.t += dt;
        const k = Math.min(1, going.t / 1.1), e = k * k * (3 - 2 * k);
        eye.lerp(tmp2.copy(SCREEN).setZ(SCREEN.z + 0.3), e);
        look.lerp(SCREEN, e);
        glitch = Math.max(glitch, e * 0.6);
        if (going.t >= 1.1 && !going.fired) { going.fired = true; UI.requestStart(); }
      }
      camera.position.copy(eye);
      camera.lookAt(look);
      notes.forEach((o, k) => { // the chosen note peels up a little
        const want = k === sel && !UI.menuPanelOpen() ? 1 : 0;
        o.lift += (want - o.lift) * Math.min(1, dt * 10);
        o.pivot.rotation.x = -0.32 * o.lift;
        o.pivot.position.z = WALL_Z + 0.012 * o.lift;
        o.mesh.scale.setScalar(1 + 0.07 * o.lift);
      });
      if (flashLeft > 0) { flashLeft -= dt; if (flashLeft <= 0) { peachi.group.visible = false; peachi.model.setDark(0); } }
      if (flickLeft > 0) { flickLeft -= dt; if (flickLeft <= 0) level.setFlicker(false); }
      if (!going) glitch = Math.max(0, glitch - dt * 3);
      cardT -= dt;
      if (cardT <= 0) { cardT = 0.12; drawCard(); }
      next -= dt;
      if (next <= 0 && flashLeft <= 0 && !going) { if (!flash()) next = 2; else schedule(false); }
    },
    flashNow() { next = 0; },
  };
}
