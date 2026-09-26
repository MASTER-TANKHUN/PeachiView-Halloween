// Title screen, inside Peachi's room at 3 a.m.: the camera waits behind her gaming chair, her monitor
// shows the stream's title card, and the menu is a row of handwritten sticky notes stuck on the wall
// above it. Hover peels a note up; picking "เริ่มไลฟ์" pushes the camera into the screen. Every so
// often Peachi is standing right there — a black silhouette — for a tenth of a second.
// The notes follow the save: "ไลฟ์ต่อ · คืนที่ N", night select / shop / album once there is something
// to show, and after the ending Peachi herself stands in the room (and the bot's face flickers on the
// monitor instead of the silhouette).
import * as THREE from 'three';
import { FONT_SPECS } from './world/tex.js';
import { Save } from './game/save.js';

const TAU = Math.PI * 2;
const cleared = () => Save.data.nightsCleared.length;
const ended = () => !!Save.data.endings.normal;
const NOTES = [ // id, text, paper color, size, tilt, a little height jitter; `need`: only shown once it's true
  { id: 'play', text: 'เริ่มไลฟ์', sub: 'คืนที่ 1', color: '#ff9fc4', s: 0.28, tilt: 0.07, dy: 0.02, doodle: 'play' },
  { id: 'nights', text: 'เลือกคืน', color: '#ffc58f', s: 0.24, tilt: -0.06, dy: -0.02, doodle: 'moon', need: () => cleared() > 0 },
  { id: 'shop', text: 'ร้านลูกพีช', color: '#ffb8e0', s: 0.24, tilt: 0.05, dy: 0.015, doodle: 'bag', need: () => cleared() > 0 || Save.data.money > 0 },
  { id: 'album', text: 'อัลบั้ม', color: '#d9c7ff', s: 0.24, tilt: -0.04, dy: -0.01, doodle: 'star', need: () => cleared() > 0 || Object.keys(Save.data.achievements).length > 0 },
  { id: 'howto', text: 'วิธีเล่น', color: '#ffe57a', s: 0.24, tilt: -0.05, dy: -0.02, doodle: 'q' },
  { id: 'settings', text: 'ตั้งค่า', color: '#a6dcff', s: 0.24, tilt: 0.04, dy: 0.025, doodle: 'gear' },
  { id: 'credits', text: 'เครดิต', color: '#bdf2a8', s: 0.235, tilt: -0.08, dy: -0.035, doodle: 'heart' },
];
const ROW_X = -5.7425, ROW_GAP = 0.305;
/** The play note's text for this save. */
function playText(n) {
  const next = Save.nextNight;
  if (ended() || next > 3) { n.text = 'ไลฟ์อีกครั้ง'; n.sub = 'จบแล้ว ♡'; } else if (cleared()) { n.text = 'ไลฟ์ต่อ'; n.sub = `คืนที่ ${next}`; } else { n.text = 'เริ่มไลฟ์'; n.sub = 'คืนที่ 1'; }
}
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
  let size = 64; // shrink long labels to fit the paper
  g.font = `400 ${size}px Sriracha, Mitr, sans-serif`;
  while (size > 34 && g.measureText(n.text).width > w - 64) { size -= 4; g.font = `400 ${size}px Sriracha, Mitr, sans-serif`; }
  inkText(g, n.text, w / 2, h * 0.47, size);
  if (n.sub) inkText(g, n.sub, w / 2, h * 0.73, 30, '#5a3350');
  g.strokeStyle = '#26203a'; g.lineWidth = 3; g.lineCap = 'round'; g.lineJoin = 'round';
  const dx = w - 58, dy = 48;
  if (n.doodle === 'play') { g.beginPath(); g.moveTo(dx - 12, dy - 14); g.lineTo(dx + 14, dy); g.lineTo(dx - 12, dy + 14); g.closePath(); g.stroke(); }
  if (n.doodle === 'heart') { g.beginPath(); g.moveTo(dx, dy + 12); g.bezierCurveTo(dx - 22, dy - 2, dx - 10, dy - 18, dx, dy - 6); g.bezierCurveTo(dx + 10, dy - 18, dx + 22, dy - 2, dx, dy + 12); g.stroke(); }
  if (n.doodle === 'q') inkText(g, '?', dx, dy, 40);
  if (n.doodle === 'moon') { g.beginPath(); g.arc(dx, dy, 14, 0.9, TAU - 0.9); g.quadraticCurveTo(dx + 2, dy, dx + 14 * Math.cos(0.9), dy + 14 * Math.sin(0.9)); g.stroke(); }
  if (n.doodle === 'bag') { g.strokeRect(dx - 13, dy - 6, 26, 22); g.beginPath(); g.arc(dx, dy - 6, 8, Math.PI, 0); g.stroke(); }
  if (n.doodle === 'star') { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 7 : 16; g.lineTo(dx + Math.cos(a) * r, dy + Math.sin(a) * r); } g.closePath(); g.stroke(); }
  if (n.doodle === 'gear') { g.beginPath(); g.arc(dx, dy, 9, 0, TAU); g.stroke(); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; g.beginPath(); g.moveTo(dx + Math.cos(a) * 12, dy + Math.sin(a) * 12); g.lineTo(dx + Math.cos(a) * 17, dy + Math.sin(a) * 17); g.stroke(); } }
  if (hot) { // pen underline under the chosen note
    g.strokeStyle = '#d23a6e'; g.lineWidth = 5;
    g.beginPath(); g.moveTo(w * 0.2, h * (n.sub ? 0.63 : 0.67)); g.quadraticCurveTo(w * 0.5, h * (n.sub ? 0.67 : 0.71), w * 0.8, h * (n.sub ? 0.61 : 0.65)); g.stroke();
  }
}
function drawTitleCard(g, w, h, t, glitch, done) {
  const bg = g.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#2c1540'); bg.addColorStop(1, '#10071a');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 22; i++) { g.fillStyle = `rgba(255,190,230,${0.15 + (i % 4) * 0.08})`; g.beginPath(); g.arc((i * 131 + t * 6) % w, (i * 71) % h, 1.2 + (i % 3), 0, TAU); g.fill(); }
  g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, 0, w, 40); // top bar of the stream app
  if (Math.floor(t * 1.2) % 2 === 0) { g.fillStyle = '#ff3b4f'; g.beginPath(); g.arc(22, 20, 7, 0, TAU); g.fill(); }
  g.font = '500 18px Kanit, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillStyle = '#efe2f2';
  const m = Math.floor(t / 60) % 60;
  g.fillText(done ? 'ไลฟ์จบแล้ว 249:00:00   🎃 Happy Halloween' : `ไลฟ์ยังไม่ปิด   03:${String(m).padStart(2, '0')}   ผู้ชม 249`, 38, 21);
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
  g.fillText(done ? 'ขอบคุณที่อยู่ด้วยกันจนจบนะ ♡ แล้วเจอกันใหม่' : 'รอมอดมากดเริ่มไลฟ์...', w / 2, h - 30);
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
    const pivot = new THREE.Group(); // hinge along the top edge so the note peels up (placed by layout())
    pivot.rotation.z = n.tilt;
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
  let vis = notes, botFace = 0; // the notes on the wall right now; after the ending the bot face flickers instead

  /** Which notes show for this save, and where: one row of ≤ 4, else progress on top, the rest below. */
  function layout() {
    playText(notes[0].n); notes[0].draw();
    vis = notes.filter((o) => !o.n.need || o.n.need());
    notes.forEach((o) => { o.pivot.visible = vis.includes(o); });
    const rows = vis.length <= 4 ? [[vis, 1.64]] : [[vis.filter((o) => NOTES.indexOf(o.n) < 4), 1.8], [vis.filter((o) => NOTES.indexOf(o.n) >= 4), 1.535]];
    for (const [row, y] of rows) {
      row.forEach((o, i) => {
        const s = vis.length <= 4 ? o.n.s : Math.min(o.n.s, 0.25);
        o.mesh.scale.setScalar(s / o.n.s);
        o.base = s / o.n.s;
        o.mesh.position.y = -s / 2;
        o.pivot.position.set(ROW_X + (i - (row.length - 1) / 2) * ROW_GAP, y + o.n.dy + s / 2, WALL_Z);
      });
    }
  }

  const blip = (name) => { try { sfx.play(name); } catch { /* audio not started yet */ } };
  function setSel(i, silent) {
    i = (i + vis.length) % vis.length;
    if (i !== sel && !silent) blip('tick');
    sel = i;
    vis.forEach((o, k) => { const h = k === sel; if (o.hot !== h) { o.hot = h; o.draw(); } });
  }
  function pick(i) {
    const id = vis[i].n.id;
    blip('pickup');
    if (id === 'play') { going = { t: 0 }; UI.setMenuBusy(true); } else UI.openMenuPanel(id);
  }
  function schedule(first) { next = first ? 7 + Math.random() * 6 : 25 + Math.random() * 35; }
  function flash() {
    if (ended()) { botFace = 0.14; glitch = 0.4; blip('glitch'); return true; } // she's here for real now: the bot peeks instead
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
    drawTitleCard(ctx, canvas.width, canvas.height, t, glitch, ended());
    if (botFace > 0) { // PeachiBot's face for a blink
      ctx.fillStyle = '#081018'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#7dffc8'; ctx.font = `bold ${Math.round(canvas.height * 0.4)}px monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('^_^', canvas.width / 2, canvas.height / 2);
    }
    screen.needsUpdate = true;
  }

  // pointer: hover / click the notes (only on the title screen with no panel open)
  const ready = () => active && !going && UI.screen === 'menu' && !UI.menuPanelOpen();
  window.addEventListener('pointermove', (e) => {
    if (!ready()) { hover = -1; document.body.style.cursor = ''; return; }
    ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(vis.map((o) => o.mesh))[0];
    hover = hit ? vis.findIndex((o) => o.mesh === hit.object) : -1;
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
      layout();
      peachi.group.visible = false; peachi.model.setDark(0);
      if (ended()) { // after the ending: Peachi is just here, by the desk, happy
        const g = peachi.group;
        g.position.set(-6.5, 0, -5.95); g.rotation.set(0, Math.atan2(HOME.eye.x + 6.5, HOME.eye.z + 5.95), 0);
        peachi.model.setGlow(0); peachi.model.setPose('idle'); peachi.model.setExpression('happy');
        g.visible = true;
      }
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
      vis.forEach((o, k) => { // the chosen note peels up a little
        const want = k === sel && !UI.menuPanelOpen() ? 1 : 0;
        o.lift += (want - o.lift) * Math.min(1, dt * 10);
        o.pivot.rotation.x = -0.32 * o.lift;
        o.pivot.position.z = WALL_Z + 0.012 * o.lift;
        o.mesh.scale.setScalar((o.base || 1) * (1 + 0.07 * o.lift));
      });
      if (botFace > 0) botFace -= dt;
      if (flashLeft > 0) { flashLeft -= dt; if (flashLeft <= 0) { peachi.group.visible = false; peachi.model.setDark(0); } }
      if (flickLeft > 0) { flickLeft -= dt; if (flickLeft <= 0) level.setFlicker(false); }
      if (!going) glitch = Math.max(0, glitch - dt * 3);
      cardT -= dt;
      if (cardT <= 0) { cardT = 0.12; drawCard(); }
      next -= dt;
      if (next <= 0 && flashLeft <= 0 && !going) { if (!flash()) next = 2; else schedule(false); }
      if (ended() && peachi.group.visible) peachi.model.lookAt(eye);
    },
    /** Re-read the save (a purchase, a new achievement): which notes show. */
    refresh() { if (active) { layout(); setSel(Math.min(sel, vis.length - 1), true); } },
    flashNow() { next = 0; },
    /** Push into the monitor and start (night select picked a night). */
    go() { if (active && !going) { going = { t: 0 }; UI.setMenuBusy(true); } },
  };
}
