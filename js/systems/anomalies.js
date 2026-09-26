// Spot the difference (Night 2): the house changes one thing at a time, somewhere you aren't looking.
// Open the phone (Tab) → รายงาน, pick the room and what kind of change it is. Right: +10 viewers,
// Peachi calms down (−10 mood), the thing goes back to normal. Wrong: −5 viewers. Leaving 3 or more
// unreported makes Krasue stronger; 5 correct reports bring out the golden peach.
// Everything here is added at runtime (the house itself is merged geometry): a few "baseline" props that
// are always there (a bear on the bookcase, a doll on the hall bench, a portrait) and overlays that
// appear only while their anomaly is active.
import * as THREE from 'three';
import { art } from '../world/tex.js';
import { drawPeach } from '../world/art.js';
import { sfx } from '../audio.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
const PI = Math.PI;

export const KINDS = [
  { id: 'extra', label: 'ของเพิ่มขึ้นมา' },
  { id: 'moved', label: 'ของย้าย / หันผิด / ขยับเอง' },
  { id: 'picture', label: 'ภาพหรือจอเปลี่ยน' },
  { id: 'text', label: 'ข้อความแปลกๆ' },
  { id: 'someone', label: 'มีใครอยู่ตรงนั้น' },
  { id: 'color', label: 'สีเปลี่ยน' },
];
export const ROOM_NAMES = { stream: 'ห้องสตรีม', bedroom: 'ห้องแขก', bathroom: 'ห้องน้ำ', hallway: 'โถงทางเดิน', kitchen: 'ครัว', living: 'ห้องนั่งเล่น' };
export const REPORT_ROOMS = ['stream', 'hallway', 'kitchen', 'living', 'bathroom', 'bedroom'];

// ---------------------------------------------------------------- little builders
const mats = new Map();
function mat(color, o = {}) {
  const key = `${color}|${o.emissive || 0}|${o.rough ?? 0.7}|${o.basic ? 1 : 0}|${o.opacity ?? 1}`;
  if (!mats.has(key)) {
    const m = o.basic
      ? new THREE.MeshBasicMaterial({ color, transparent: (o.opacity ?? 1) < 1, opacity: o.opacity ?? 1, toneMapped: o.toneMapped ?? true, depthWrite: (o.opacity ?? 1) >= 1 })
      : new THREE.MeshStandardMaterial({ color, roughness: o.rough ?? 0.7, metalness: o.metal ?? 0, emissive: o.emissive || 0x000000, emissiveIntensity: o.ei ?? 1 });
    mats.set(key, m);
  }
  return mats.get(key);
}
function mesh(geo, material, p = [0, 0, 0], s = null, r = null) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(p[0], p[1], p[2]);
  if (s) Array.isArray(s) ? m.scale.set(s[0], s[1], s[2]) : m.scale.setScalar(s);
  if (r) m.rotation.set(r[0], r[1], r[2]);
  m.castShadow = false; m.receiveShadow = true;
  return m;
}
const sph = (r, a = 16, b = 12) => new THREE.SphereGeometry(r, a, b);
function decal(tex, w, h, pos, ry = 0, o = {}) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), o.basic
    ? new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, depthWrite: false, color: new THREE.Color(o.emit ?? 1, o.emit ?? 1, o.emit ?? 1) })
    : new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: o.rough ?? 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  m.position.copy(pos); m.rotation.y = ry;
  return m;
}

function bear(color = 0xc8966a) {
  const g = new THREE.Group();
  const fur = mat(color, { rough: 0.95 }), light = mat(0xf0d8b8, { rough: 0.95 }), ink = mat(0x141014, { rough: 0.3 });
  g.add(mesh(sph(0.09), fur, [0, 0.09, 0], [1, 1.1, 0.9]));
  g.add(mesh(sph(0.075), fur, [0, 0.215, 0]));
  for (const s of [-1, 1]) {
    g.add(mesh(sph(0.028), fur, [s * 0.056, 0.275, 0]));
    g.add(mesh(sph(0.03), fur, [s * 0.085, 0.11, 0.03]));
    g.add(mesh(sph(0.036), fur, [s * 0.05, 0.03, 0.06]));
    g.add(mesh(sph(0.009, 8, 6), ink, [s * 0.027, 0.228, 0.066]));
  }
  g.add(mesh(sph(0.032), light, [0, 0.196, 0.062], [1, 0.8, 0.7]));
  g.add(mesh(sph(0.011, 8, 6), ink, [0, 0.207, 0.085]));
  const bow = mat(0xff4a7a, { rough: 0.5 });
  for (const s of [-1, 1]) g.add(mesh(new THREE.ConeGeometry(0.022, 0.04, 8), bow, [s * 0.022, 0.155, 0.062], null, [0, 0, s * PI / 2]));
  return g;
}

function doll() {
  const g = new THREE.Group();
  const dress = mat(0xf2c830, { rough: 0.8 }), skin = mat(0xf4dcc8, { rough: 0.6 }), hair = mat(0x141014, { rough: 0.5 }), ink = mat(0x050305, { rough: 0.2 }), sock = mat(0xf4f0ea);
  g.add(mesh(new THREE.ConeGeometry(0.12, 0.26, 20), dress, [0, 0.17, 0]));
  g.add(mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.1, 14), dress, [0, 0.3, 0]));
  for (const s of [-1, 1]) {
    g.add(mesh(new THREE.CylinderGeometry(0.014, 0.012, 0.16, 8), skin, [s * 0.065, 0.24, 0.01], null, [0, 0, s * 0.18]));
    g.add(mesh(new THREE.CylinderGeometry(0.016, 0.014, 0.08, 8), sock, [s * 0.035, 0.03, 0]));
    g.add(mesh(sph(0.011, 8, 6), ink, [s * 0.024, 0.408, 0.062]));
  }
  g.add(mesh(sph(0.07, 20, 16), skin, [0, 0.4, 0]));
  g.add(mesh(sph(0.076, 20, 16, 0, TAU, 0, PI * 0.55), hair, [0, 0.405, -0.008], [1, 1.02, 1]));
  g.add(mesh(new THREE.BoxGeometry(0.12, 0.05, 0.02), hair, [0, 0.455, 0.055], null, [0.25, 0, 0])); // straight bangs
  g.add(mesh(new THREE.BoxGeometry(0.03, 0.006, 0.004), mat(0xa01820), [0, 0.37, 0.069]));
  const ribbon = mat(0xff3a4a);
  g.add(mesh(sph(0.02, 8, 6), ribbon, [0.05, 0.47, 0.02], [1.6, 0.8, 0.8]));
  return g;
}

function chair(color = 0x5a3620) {
  const g = new THREE.Group();
  const wood = mat(color, { rough: 0.6 }), cushion = mat(0x8a3a4a, { rough: 0.9 });
  g.add(mesh(new THREE.BoxGeometry(0.44, 0.04, 0.42), wood, [0, 0.45, 0]));
  g.add(mesh(new THREE.BoxGeometry(0.4, 0.05, 0.38), cushion, [0, 0.49, 0]));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(mesh(new THREE.CylinderGeometry(0.018, 0.015, 0.45, 8), wood, [sx * 0.19, 0.225, sz * 0.18]));
  for (const s of [-1, 1]) g.add(mesh(new THREE.CylinderGeometry(0.018, 0.016, 0.5, 8), wood, [s * 0.19, 0.7, -0.18], null, [-0.08, 0, 0]));
  for (let i = 0; i < 3; i++) g.add(mesh(new THREE.BoxGeometry(0.36, 0.05, 0.02), wood, [0, 0.68 + i * 0.12, -0.2], null, [-0.08, 0, 0]));
  return g;
}

function catHeadphones() {
  const g = new THREE.Group();
  const pink = mat(0xff8cbf, { rough: 0.4 }), white = mat(0xfff4f8, { rough: 0.5 }), led = mat(0xff9ad0, { emissive: 0xff5aa8, ei: 1.5 });
  g.add(mesh(new THREE.TorusGeometry(0.105, 0.012, 8, 24, PI), pink, [0, 0, 0]));
  for (const s of [-1, 1]) {
    g.add(mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.035, 20), white, [s * 0.105, -0.01, 0], null, [0, 0, PI / 2]));
    g.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.037, 20), led, [s * 0.107, -0.01, 0], null, [0, 0, PI / 2]));
    g.add(mesh(new THREE.ConeGeometry(0.03, 0.06, 4), pink, [s * 0.06, 0.1, 0], null, [0, PI / 4, s * -0.5]));
  }
  return g;
}

function peachiPlush() {
  const g = new THREE.Group();
  const hair = mat(0xffa8cc, { rough: 0.9 }), skin = mat(0xffe4d8, { rough: 0.8 }), ink = mat(0x1f1b2c, { rough: 0.3 }), coat = mat(0xfff4fa, { rough: 0.9 });
  g.add(mesh(sph(0.08), coat, [0, 0.08, 0], [1, 0.9, 0.9]));
  g.add(mesh(sph(0.1), hair, [0, 0.22, -0.01]));
  g.add(mesh(sph(0.075), skin, [0, 0.205, 0.035], [1, 0.95, 0.8]));
  for (const s of [-1, 1]) {
    g.add(mesh(new THREE.ConeGeometry(0.035, 0.07, 4), hair, [s * 0.06, 0.32, 0], null, [0, 0, s * -0.4]));
    g.add(mesh(sph(0.014, 8, 6), ink, [s * 0.03, 0.215, 0.093], [1, 1.3, 0.5]));
    g.add(mesh(sph(0.012, 8, 6), mat(0xff7aa8), [s * 0.05, 0.19, 0.088], [1.2, 0.6, 0.5]));
  }
  return g;
}

// ---------------------------------------------------------------- textures
const tvPeachi = () => art(256, 144, (g, w, h) => {
  g.fillStyle = '#ff7ab0'; g.fillRect(0, 0, w, h);
  g.imageSmoothingEnabled = false;
  const px = 6; // pixel peach
  const P = ['..ggg...', '...gg...', '.pppppp.', 'pppppppp', 'pppwpppp', 'pppppppp', '.pppppp.', '..pppp..'];
  P.forEach((row, y) => [...row].forEach((c, x) => { if (c === '.') return; g.fillStyle = c === 'g' ? '#6cc460' : c === 'w' ? '#fff' : '#ffb08a'; g.fillRect(20 + x * px, 38 + y * px, px, px); }));
  g.fillStyle = '#1f1b2c'; g.font = '800 30px Kanit, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle';
  g.fillText('I am', 84, 52); g.fillText('Peachi!', 84, 88);
  g.fillStyle = 'rgba(0,0,0,0.12)'; for (let y = 0; y < h; y += 3) g.fillRect(0, y, w, 1);
});
const monitorText = () => art(768, 432, (g, w, h) => {
  g.fillStyle = '#070308'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#ff3b5a'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '700 64px Kanit, sans-serif'; g.fillText('มอดเห็นฉันมั้ย', w / 2, h * 0.38);
  g.font = '500 30px Mitr, sans-serif'; g.fillStyle = '#c8a0b0'; g.fillText('ฉันเห็นมอดนะ', w / 2, h * 0.6);
  g.fillStyle = 'rgba(255,255,255,0.05)'; for (let y = 0; y < h; y += 4) g.fillRect(0, y, w, 1);
});
const magnets = () => art(256, 160, (g, w, h) => {
  g.clearRect(0, 0, w, h);
  const letters = [['ห', '#ff5f95', 60, 96, -0.1], ['ิ', '#5fc8ff', 118, 70, 0.15], ['ว', '#ffd23a', 150, 98, 0.08], ['!', '#7aff9a', 206, 92, -0.2]];
  for (const [c, col, x, y, r] of letters) {
    g.save(); g.translate(x, y); g.rotate(r);
    g.font = '800 92px Kanit, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillText(c, 4, 5);
    g.fillStyle = col; g.fillText(c, 0, 0);
    g.restore();
  }
});
const banner250 = () => art(300, 128, (g, w, h) => {
  g.fillStyle = '#ff7a1a'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#1a0a12'; g.textAlign = 'center'; g.font = '800 140px Kanit, sans-serif';
  g.fillText('250', w / 2, 118);
});
const handprints = () => art(320, 420, (g, w, h) => {
  g.clearRect(0, 0, w, h);
  const hand = (x, y, r, s) => {
    g.save(); g.translate(x, y); g.rotate(r); g.scale(s, s);
    g.fillStyle = 'rgba(150,10,20,0.78)';
    g.beginPath(); g.ellipse(0, 0, 26, 32, 0, 0, TAU); g.fill();
    [[-22, -36, -0.35], [-8, -48, -0.1], [8, -48, 0.08], [22, -38, 0.3], [33, 4, 1.1]].forEach(([fx, fy, fr]) => { g.save(); g.translate(fx, fy); g.rotate(fr); g.beginPath(); g.ellipse(0, 0, 7, 20, 0, 0, TAU); g.fill(); g.restore(); });
    g.fillRect(-4, 20, 8, 26 + Math.random() * 30); // drip
    g.restore();
  };
  hand(90, 120, -0.2, 1); hand(230, 150, 0.25, 0.9); hand(160, 300, 0.05, 0.8);
  g.fillStyle = 'rgba(170,10,24,0.9)'; g.font = '700 58px Sriracha, cursive'; g.textAlign = 'center';
  g.fillText('ข้างหลัง', w / 2, 240);
});
const calendarX = () => art(150, 210, (g, w, h) => {
  g.clearRect(0, 0, w, h);
  g.strokeStyle = 'rgba(200,10,20,0.85)'; g.lineWidth = 3; g.lineCap = 'round';
  for (let r = 0; r < 5; r++) for (let c = 0; c < 7; c++) {
    if (r === 4 && c === 3) continue;
    const x = 12 + c * 19, y = 80 + r * 24;
    g.beginPath(); g.moveTo(x - 6, y - 7); g.lineTo(x + 6, y + 7); g.moveTo(x + 6, y - 7); g.lineTo(x - 6, y + 7); g.stroke();
  }
  g.lineWidth = 4; g.beginPath(); g.ellipse(69, 176, 16, 13, 0, 0, TAU); g.stroke();
  g.fillStyle = 'rgba(200,10,20,0.9)'; g.font = '700 22px Sriracha, cursive'; g.textAlign = 'center'; g.fillText('31', 69, 184);
  g.font = '600 15px Sriracha, cursive'; g.fillText('วันสุดท้าย', 75, 206);
});
const cleanClockFace = () => art(256, 256, (g, w, h) => {
  g.fillStyle = '#f6efe2'; g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 4, 0, TAU); g.fill();
  g.fillStyle = '#2a2020'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '600 26px Kanit, sans-serif';
  for (let i = 1; i <= 12; i++) { const a = i / 12 * TAU - PI / 2; g.fillText(String(i), w / 2 + Math.cos(a) * 96, h / 2 + Math.sin(a) * 96); }
});
const portraitArt = () => art(256, 320, (g, w, h) => {
  const bg = g.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#3a2a30'); bg.addColorStop(1, '#140c10');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.fillStyle = '#1a1014'; g.beginPath(); g.moveTo(40, h); g.quadraticCurveTo(128, 170, 216, h); g.fill(); // dark dress
  g.fillStyle = '#d8c8b8'; g.beginPath(); g.ellipse(128, 140, 50, 64, 0, 0, TAU); g.fill(); // face
  g.fillStyle = '#20141a'; g.beginPath(); g.ellipse(128, 104, 60, 50, 0, PI, TAU); g.fill(); // hair
  g.fillRect(68, 100, 18, 110); g.fillRect(170, 100, 18, 110);
  g.fillStyle = '#b8a898'; g.fillRect(110, 140, 36, 3); // painted-shut eyes behind the real ones
  g.fillStyle = '#8a3a40'; g.fillRect(116, 178, 24, 4);
  g.fillStyle = '#c8a040'; g.font = '600 16px Kanit, sans-serif'; g.textAlign = 'center'; g.fillText('คุณยาย', 128, 300);
});

// ---------------------------------------------------------------- the house changes
function defs(level) {
  const list = [];
  const def = (o) => list.push(o);
  const findMesh = (tex) => { let m = null; level.root.traverse((o) => { if (!m && o.isMesh && o.material && (o.material.map === tex || (o.userData.onMat && o.userData.onMat.map === tex))) m = o; }); return m; };

  // baseline: a bear on the living-room bookcase, facing the room. Anomaly: it turns its back.
  const B = bear(0xd89a70);
  B.position.set(8.25, 2.0, 1.3);
  def({ id: 'bear', name: 'หมีบนตู้หนังสือหันหลัง', rooms: ['living'], kind: 'moved', pos: V(8.25, 2.1, 1.3), base: [B],
    on() { B.rotation.y = PI; }, off() { B.rotation.y = 0; } });

  // baseline: a portrait of grandma in the hall. Anomaly: her eyes follow you.
  const P = new THREE.Group();
  P.position.set(-1.4, 1.62, 0.895); P.rotation.y = PI;
  P.add(mesh(new THREE.BoxGeometry(0.46, 0.56, 0.03), mat(0x3a2412, { rough: 0.5 }), [0, 0, 0.015]));
  P.add(mesh(new THREE.BoxGeometry(0.5, 0.6, 0.02), mat(0xc8a040, { rough: 0.4, metal: 0.6 }), [0, 0, 0.005]));
  const canvas = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.5), new THREE.MeshStandardMaterial({ map: portraitArt(), roughness: 0.6 }));
  canvas.position.z = 0.031; P.add(canvas);
  const eyes = [-1, 1].map((s) => {
    const e = new THREE.Group(); e.position.set(s * 0.021, 0.059, 0.028);
    e.add(mesh(sph(0.012, 12, 10), mat(0xf4ece0, { rough: 0.3 })));
    const pupil = mesh(sph(0.0062, 10, 8), mat(0x0a0406, { rough: 0.2 }), [0, 0, 0.009], [1, 1, 0.5]);
    e.add(pupil); P.add(e); return e;
  });
  def({ id: 'portrait', name: 'ตาภาพคุณยายมองตาม', rooms: ['hallway'], kind: 'picture', pos: V(-1.4, 1.62, 0.89), base: [P],
    on() {}, off() { for (const e of eyes) e.rotation.set(0, 0, 0); },
    update(dt, t, ctx) { for (const e of eyes) e.lookAt(ctx.camera.position); } });

  // baseline: a doll in a yellow dress on the hall bench. Anomaly: she's standing in the living room.
  const D = doll();
  D.position.set(-1.45, 0.49, -0.74);
  def({ id: 'doll', name: 'ตุ๊กตาชุดเหลืองย้ายที่', rooms: ['hallway', 'living'], kind: 'moved', pos: V(6.5, 0.3, 2.3), base: [D],
    on() { D.position.set(6.5, 0, 2.3); D.rotation.y = PI; }, off() { D.position.set(-1.45, 0.49, -0.74); D.rotation.y = 0; } });

  // pendulum clock in the hall: hands running backward
  const C = new THREE.Group();
  C.position.set(0.9, 1.58, 0.576); C.rotation.y = PI;
  C.add(new THREE.Mesh(new THREE.CircleGeometry(0.14, 40), new THREE.MeshStandardMaterial({ map: cleanClockFace(), roughness: 0.5 })));
  const hand = (len, w) => { const pv = new THREE.Group(); pv.add(mesh(new THREE.BoxGeometry(w, len, 0.004), mat(0x2a2020), [0, len / 2 - 0.01, 0.004])); C.add(pv); return pv; };
  const hh = hand(0.06, 0.012), mh = hand(0.095, 0.007);
  C.add(mesh(new THREE.CircleGeometry(0.008, 16), mat(0xc0282e), [0, 0, 0.008]));
  def({ id: 'clock', name: 'นาฬิกาลูกตุ้มเดินถอยหลัง', rooms: ['hallway'], kind: 'moved', pos: V(0.9, 1.58, 0.58), show: [C],
    on() { hh.rotation.z = -PI / 2; mh.rotation.z = 0; },
    update(dt) { mh.rotation.z += dt * 2.4; hh.rotation.z += dt * 0.2; } });

  // one chair too many at the party table
  const CH = chair();
  CH.position.set(-3.42, 0, 3.8); CH.rotation.y = -PI / 2;
  const chairBox = { x0: -3.64, x1: -3.2, z0: 3.58, z1: 4.02, off: true };
  level.colliders.push(chairBox);
  def({ id: 'chair', name: 'เก้าอี้โต๊ะปาร์ตี้เพิ่มมา 1 ตัว', rooms: ['kitchen'], kind: 'extra', pos: V(-3.42, 0.6, 3.8), show: [CH],
    on() { chairBox.off = false; }, off() { chairBox.off = true; } });

  // the TV turns on by itself: "I am Peachi!"
  const tvTex = level.screens && level.screens.tv;
  const tvMesh = tvTex ? findMesh(tvTex) : null;
  const tvArt = tvPeachi();
  def({ id: 'tv', name: 'ทีวีขึ้นคำว่า I am Peachi!', rooms: ['living'], kind: 'picture', pos: V(9.6, 1.25, 4.1), need: !!tvMesh,
    on() { const m = tvMesh.userData.onMat || tvMesh.material; m.map = tvArt; m.needsUpdate = true; },
    off() { const m = tvMesh.userData.onMat || tvMesh.material; m.map = tvTex; m.needsUpdate = true; } });

  // fridge magnets spell "หิว!"
  const F = decal(magnets(), 0.4, 0.25, V(-9.48, 1.0, 6.122), PI);
  def({ id: 'fridge', name: 'แม่เหล็กตู้เย็นเรียงเป็นคำว่า หิว', rooms: ['kitchen'], kind: 'text', pos: V(-9.48, 1.0, 6.12), show: [F] });

  // the skeleton wears cat-ear headphones
  const HP = catHeadphones();
  HP.position.set(4.03, 1.12, 5.72); HP.rotation.y = 2.2;
  def({ id: 'skeleton', name: 'โครงกระดูกใส่หูฟังหูแมว', rooms: ['living'], kind: 'extra', pos: V(4.03, 1.12, 5.72), show: [HP] });

  // banner 249 → 250
  const BN = decal(banner250(), 0.66, 0.28, V(9.86, 1.955, 0), -PI / 2, { rough: 0.9 });
  def({ id: 'banner', name: 'ป้าย 249 กลายเป็น 250', rooms: ['hallway'], kind: 'text', pos: V(9.86, 1.95, 0), show: [BN] });

  // pink water in the jar
  const J = mesh(new THREE.CircleGeometry(0.19, 32), mat(0xff5fa8, { emissive: 0xff2a88, ei: 0.6, rough: 0.2 }), [9.35, 0.604, -1.65], null, [-PI / 2, 0, 0]);
  def({ id: 'jar', name: 'น้ำในโอ่งเป็นสีชมพู', rooms: ['bathroom'], kind: 'color', pos: V(9.35, 0.6, -1.65), show: [J] });

  // ten red sodas lined up in front of the TV
  const RS = new THREE.Group();
  const glass = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1, transparent: true, opacity: 0.35 });
  const red = mat(0xff1a3a, { emissive: 0x8a0010, ei: 0.8, rough: 0.2 });
  for (let i = 0; i < 10; i++) {
    const b = new THREE.Group(); b.position.set(9.05, 0, 3.3 + i * 0.18);
    b.add(mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.16, 12), glass, [0, 0.08, 0]));
    b.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.12, 12), red, [0, 0.062, 0]));
    b.add(mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.14, 6), mat(0xffffff), [0.01, 0.17, 0], null, [0, 0, 0.2]));
    RS.add(b);
  }
  def({ id: 'soda', name: 'น้ำแดง 10 ขวดเรียงหน้าทีวี', rooms: ['living'], kind: 'extra', pos: V(9.05, 0.1, 4.1), show: [RS] });

  // a tall shadow at the end of the hall (it fades when you get close)
  const SH = new THREE.Group();
  const shade = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.93, depthWrite: false });
  SH.add(mesh(new THREE.CapsuleGeometry(0.2, 1.2, 4, 12), shade, [0, 0.95, 0], [1, 1, 0.6]));
  SH.add(mesh(sph(0.14), shade, [0, 1.85, 0], [1, 1.15, 1]));
  for (const s of [-1, 1]) SH.add(mesh(sph(0.016, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 0.25, 0.25), toneMapped: false }), [s * 0.045, 1.87, 0.12]));
  SH.position.set(9.25, 0, 0.45); SH.rotation.y = -PI / 2;
  def({ id: 'shadow', name: 'เงาคนยืนสุดโถงทางเดิน', rooms: ['hallway'], kind: 'someone', pos: V(9.25, 1.4, 0.45), show: [SH],
    update(dt, t, ctx) { const d = Math.hypot(ctx.camera.position.x - SH.position.x, ctx.camera.position.z - SH.position.z); shade.opacity = Math.max(0.08, Math.min(0.93, (d - 2.2) / 2.5)); } });

  // a giant rubber duck in the tub
  const DK = new THREE.Group();
  const yel = mat(0xffd21a, { rough: 0.35 });
  DK.add(mesh(sph(0.22), yel, [0, 0.08, 0], [1.25, 0.8, 1]));
  DK.add(mesh(sph(0.13), yel, [0.2, 0.3, 0]));
  DK.add(mesh(new THREE.ConeGeometry(0.05, 0.12, 12), mat(0xff7a1a, { rough: 0.4 }), [0.36, 0.28, 0], null, [0, 0, -PI / 2]));
  for (const s of [-1, 1]) DK.add(mesh(sph(0.018, 8, 6), mat(0x141014), [0.3, 0.34, s * 0.07]));
  DK.position.set(8.3, 0.42, -6.5); DK.rotation.y = -PI / 2;
  def({ id: 'duck', name: 'เป็ดยางยักษ์ในอ่างอาบน้ำ', rooms: ['bathroom'], kind: 'extra', pos: V(8.3, 0.6, -6.5), show: [DK],
    update(dt, t) { DK.position.y = 0.42 + Math.sin(t * 1.3) * 0.01; DK.rotation.z = Math.sin(t * 0.9) * 0.04; } });

  // the stream monitor talks to you
  const monTex = level.screens && level.screens.main;
  const monMesh = monTex ? findMesh(monTex) : null;
  const monArt = monitorText();
  def({ id: 'monitor', name: 'จอคอมขึ้นว่า มอดเห็นฉันมั้ย', rooms: ['stream'], kind: 'text', pos: V(-5.73, 1.15, -6.66), need: !!monMesh,
    on() { monMesh.material.map = monArt; monMesh.material.needsUpdate = true; }, off() { monMesh.material.map = monTex; monMesh.material.needsUpdate = true; } });

  // the bathroom door turns blood red
  const bathDoor = level.doors && level.doors.bathroom;
  const doorMeshes = [];
  if (bathDoor) bathDoor.swing.traverse((o) => { if (o.isMesh) doorMeshes.push(o); });
  def({ id: 'door', name: 'ประตูห้องน้ำกลายเป็นสีแดง', rooms: ['bathroom', 'hallway'], kind: 'color', pos: bathDoor ? bathDoor.center.clone() : V(6.8, 1.1, -1), need: doorMeshes.length > 0,
    on() { for (const m of doorMeshes) { m.userData.baseMat = m.material; m.material = m.material.clone(); m.material.color.setRGB(0.5, 0.03, 0.05); } },
    off() { for (const m of doorMeshes) if (m.userData.baseMat) { m.material.dispose(); m.material = m.userData.baseMat; m.userData.baseMat = null; } } });

  // the kitchen light turns red
  const kl = level.lightsIn ? level.lightsIn('kitchen').filter((L) => L.kind !== 'candle') : [];
  def({ id: 'redlight', name: 'ไฟครัวกลายเป็นสีแดง', rooms: ['kitchen'], kind: 'color', pos: V(-5.15, 1.4, 6.3), need: kl.length > 0,
    on() { for (const L of kl) { L.oldColor = L.light.color.getHex(); L.light.color.setHex(0xff1020); } },
    off() { for (const L of kl) if (L.oldColor != null) L.light.color.setHex(L.oldColor); } });

  // someone sleeping in Peachi's bed (it breathes)
  const BD = new THREE.Group();
  const sheet = mat(0xfff0f4, { rough: 0.95 });
  const body = mesh(sph(0.3, 20, 14), sheet, [-8.15, 0.64, -5.45], [0.85, 0.6, 1.9]);
  BD.add(body);
  BD.add(mesh(sph(0.15, 16, 12), sheet, [-8.2, 0.7, -6.2], [1, 0.95, 1]));
  BD.add(mesh(sph(0.22, 16, 10), mat(0x141014, { rough: 0.6 }), [-8.2, 0.72, -6.42], [0.9, 0.22, 0.7]));
  def({ id: 'bed', name: 'มีคนนอนอยู่บนเตียงพีชชี่', rooms: ['stream'], kind: 'someone', pos: V(-8.15, 0.6, -5.6), show: [BD],
    update(dt, t) { body.scale.y = 0.6 + Math.sin(t * 1.6) * 0.04; } });

  // handprints on the bathroom mirror: "ข้างหลัง"
  const MR = decal(handprints(), 0.6, 0.8, V(9.832, 1.62, -3.3), -PI / 2, { rough: 0.3 });
  def({ id: 'mirror', name: 'รอยมือบนกระจก เขียนว่า ข้างหลัง', rooms: ['bathroom'], kind: 'text', pos: V(9.83, 1.62, -3.3), show: [MR] });

  // the kitchen calendar: every day crossed out, the 31st circled
  const CL = decal(calendarX(), 0.3, 0.42, V(-6.2, 1.55, 1.106), 0, { rough: 0.8 });
  def({ id: 'calendar', name: 'ปฏิทินกากบาททุกวัน วงวันที่ 31', rooms: ['kitchen'], kind: 'text', pos: V(-6.2, 1.55, 1.11), show: [CL] });

  // a little Peachi plush sitting in the middle of her room, facing the door
  const PL = peachiPlush();
  PL.position.set(-6.2, 0, -3.3); PL.rotation.y = 0.76;
  def({ id: 'plush', name: 'ตุ๊กตาพีชชี่นั่งกลางห้อง', rooms: ['stream'], kind: 'extra', pos: V(-6.2, 0.2, -3.3), show: [PL] });

  return list.filter((d) => d.need !== false);
}

export class Anomalies {
  constructor({ scene, level }) {
    this.scene = scene;
    this.level = level;
    this.list = defs(level);
    this.byId = {};
    for (const a of this.list) {
      this.byId[a.id] = a;
      for (const o of a.base || []) scene.add(o);
      for (const o of a.show || []) { o.visible = false; scene.add(o); }
      a.active = false;
    }
    this.reset();
  }

  reset() {
    for (const a of this.list) this._set(a, false);
    this.queue = [];
    this.reported = 0;
    this.wrong = 0;
    this.spawned = 0;
  }

  /** The night's lineup: `first` always first, then n−1 random others. */
  plan(n = 8, first = 'bear') {
    const rest = this.list.filter((a) => a.id !== first).sort(() => Math.random() - 0.5);
    this.queue = [this.byId[first], ...rest].filter(Boolean).slice(0, n);
  }

  /** Switch on the next anomaly from the plan, in a room the player isn't in. Returns it (or null). */
  spawnNext(player) {
    const here = this.level.roomAt(player.position);
    const i = this.queue.findIndex((a) => !a.rooms.includes(here));
    if (i < 0) return null;
    const a = this.queue.splice(i, 1)[0];
    this._set(a, true);
    this.spawned++;
    return a;
  }
  spawn(id) { const a = this.byId[id]; if (!a || a.active) return null; this.queue = this.queue.filter((x) => x !== a); this._set(a, true); this.spawned++; return a; }

  get active() { return this.list.filter((a) => a.active); }
  get unresolved() { return this.active.length; }
  get left() { return this.queue.length; }

  /** Report a room + kind. Returns { ok, anomaly }. */
  report(room, kind) {
    const a = this.list.find((x) => x.active && x.rooms.includes(room) && x.kind === kind);
    if (!a) { this.wrong++; return { ok: false }; }
    this._set(a, false);
    this.reported++;
    sfx.play('glitch', { n: 4 });
    return { ok: true, anomaly: a };
  }

  _set(a, on) {
    if (a.active === on) return;
    a.active = on;
    for (const o of a.show || []) o.visible = on;
    try { if (on) a.on && a.on(); else a.off && a.off(); } catch (e) { console.warn('[anomaly]', a.id, e); }
  }

  update(dt, t, ctx) {
    for (const a of this.list) if (a.active && a.update) a.update(dt, t, ctx);
  }
}
