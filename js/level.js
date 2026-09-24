// Peachi's small haunted house (Night 1). Low-poly primitives merged into a handful of meshes.
// Layout (meters, Y up). House spans x -10..10, z -7..7. Hallway runs along X at z -1..1.
//   North (z -7..-1): stream room (x -10..-2) | bedroom (x -2..4.5) | bathroom (x 4.5..10)
//   South (z  1.. 7): kitchen (x -10..3)      | living room (x 3..10)
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const WALL_H = 2.8, T = 0.2, DOOR_W = 1.3, DOOR_H = 2.15;

const ROOMS = {
  stream: { x0: -10, x1: -2, z0: -7, z1: -1 },
  bedroom: { x0: -2, x1: 4.5, z0: -7, z1: -1 },
  bathroom: { x0: 4.5, x1: 10, z0: -7, z1: -1 },
  hallway: { x0: -10, x1: 10, z0: -1, z1: 1 },
  kitchen: { x0: -10, x1: 3, z0: 1, z1: 7 },
  living: { x0: 3, x1: 10, z0: 1, z1: 7 },
};

// ------------------------------------------------------------------ canvas textures
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  // redraw once the Thai web fonts are ready (index.html loads Kanit / Mitr)
  if (document.fonts && document.fonts.load) {
    Promise.all([document.fonts.load('700 40px Kanit'), document.fonts.load('600 40px Mitr')])
      .then(() => { g.clearRect(0, 0, w, h); draw(g, w, h); tex.needsUpdate = true; })
      .catch(() => {});
  }
  return tex;
}

function drawPeach(g, x, y, r) {
  const grd = g.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  grd.addColorStop(0, '#ffd1c1'); grd.addColorStop(0.6, '#ff8f9e'); grd.addColorStop(1, '#e0527a');
  g.fillStyle = grd;
  g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(160,40,80,0.6)'; g.lineWidth = r * 0.06;
  g.beginPath(); g.moveTo(x, y - r * 0.95); g.quadraticCurveTo(x - r * 0.35, y, x, y + r * 0.9); g.stroke();
  g.fillStyle = '#5fbf5a';
  g.beginPath(); g.ellipse(x + r * 0.3, y - r * 1.0, r * 0.35, r * 0.15, -0.5, 0, Math.PI * 2); g.fill();
}

const monitorDraw = (g, w, h) => {
  const bg = g.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#2a1140'); bg.addColorStop(1, '#0c0616');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  // stream preview area
  g.fillStyle = '#1a0c28'; g.fillRect(12, 48, 340, 228);
  drawPeach(g, 182, 170, 62);
  g.fillStyle = '#fff'; g.font = '700 26px Kanit, sans-serif';
  g.fillText('BRB...', 140, 270);
  // header
  g.fillStyle = '#ff2d55'; g.fillRect(12, 10, 86, 30);
  g.fillStyle = '#fff'; g.font = '700 20px Kanit, sans-serif'; g.fillText('● LIVE', 20, 32);
  g.fillStyle = '#ffb3d9'; g.font = '600 20px Kanit, sans-serif'; g.fillText('PeachiView · ไลฟ์ผี 249 ชม.', 108, 32);
  // chat column
  g.fillStyle = '#12081d'; g.fillRect(362, 48, 138, 228);
  const names = ['#ff7ab8', '#9ad0ff', '#c6ff8a', '#ffd36b', '#d59bff'];
  g.font = '500 13px Kanit, sans-serif';
  for (let i = 0; i < 11; i++) {
    g.fillStyle = names[i % names.length]; g.fillRect(370, 60 + i * 19, 30 + (i * 17) % 22, 8);
    g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillRect(408, 60 + i * 19, 40 + (i * 29) % 46, 8);
  }
};

const posterDraw = (g, w, h) => {
  g.fillStyle = '#2b0f2e'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#ff9ec7';
  for (let i = 0; i < 40; i++) { g.globalAlpha = 0.25; g.fillRect((i * 53) % w, (i * 97) % h, 3, 3); }
  g.globalAlpha = 1;
  drawPeach(g, w / 2, 160, 78);
  // witch hat
  g.fillStyle = '#16091c';
  g.beginPath(); g.moveTo(w / 2 - 70, 92); g.lineTo(w / 2 + 70, 92); g.lineTo(w / 2 + 12, 10); g.closePath(); g.fill();
  g.fillStyle = '#ff5fa8'; g.fillRect(w / 2 - 44, 78, 88, 10);
  // eyes
  g.fillStyle = '#2a0f1f';
  g.beginPath(); g.arc(w / 2 - 25, 160, 8, 0, 7); g.arc(w / 2 + 25, 160, 8, 0, 7); g.fill();
  g.fillStyle = '#fff'; g.textAlign = 'center';
  g.font = '800 50px Kanit, sans-serif'; g.fillText('PEACHI', w / 2, 292);
  g.fillStyle = '#ffb347'; g.font = '700 30px Kanit, sans-serif'; g.fillText('♥ 249 ♥', w / 2, 334);
  g.textAlign = 'left';
};

const bannerDraw = (g, w, h) => {
  g.fillStyle = '#ff7a1a'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#1a0a12';
  for (let i = 0; i < w; i += 32) { g.beginPath(); g.moveTo(i, h); g.lineTo(i + 16, h - 16); g.lineTo(i + 32, h); g.fill(); }
  g.textAlign = 'center';
  g.font = '700 26px Kanit, sans-serif'; g.fillText('HAPPY HALLOWEEN', w / 2, 34);
  g.font = '800 104px Kanit, sans-serif'; g.fillText('249', w / 2, 132);
  g.font = '600 22px Mitr, sans-serif'; g.fillText('ไลฟ์ผี 249 ชั่วโมง ห้ามปิดไลฟ์!', w / 2, 164);
  g.textAlign = 'left';
};

const mirrorDraw = (g, w, h) => {
  const bg = g.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, '#2c3a48'); bg.addColorStop(0.5, '#141c24'); bg.addColorStop(1, '#253240');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(255,255,255,0.07)';
  g.beginPath(); g.moveTo(30, 0); g.lineTo(90, 0); g.lineTo(0, 120); g.lineTo(0, 60); g.fill();
  g.save(); g.translate(w / 2, h / 2); g.rotate(-0.12);
  g.fillStyle = '#c2102a'; g.textAlign = 'center';
  g.font = '600 46px Mitr, sans-serif'; g.fillText('กดไลค์', 0, -30);
  g.font = '600 40px Mitr, sans-serif'; g.fillText('ด้วยยย...', 0, 26);
  g.font = '700 30px Kanit, sans-serif'; g.fillText('249', 0, 80);
  g.restore();
  // hand print
  g.fillStyle = 'rgba(194,16,42,0.55)';
  g.beginPath(); g.ellipse(200, 270, 22, 26, 0, 0, 7); g.fill();
  for (let i = 0; i < 4; i++) { g.beginPath(); g.ellipse(180 + i * 13, 232 - (i === 1 || i === 2 ? 8 : 0), 5, 14, 0, 0, 7); g.fill(); }
};

// ------------------------------------------------------------------ build
export function buildLevel(scene) {
  const root = new THREE.Group();
  root.name = 'level';
  scene.add(root);
  scene.background = new THREE.Color(0x050308);
  scene.fog = new THREE.FogExp2(0x0b0714, 0.09);

  const solid = [], glow = [], led = [], ceil = [], tpParts = [];
  const boxes = []; // XZ colliders {x0,x1,z0,z1}

  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
  let parentM = null; // optional group transform for assemblies

  function put(geo, color, list, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    _m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz));
    geo.applyMatrix4(_m);
    if (parentM) geo.applyMatrix4(parentM);
    const c = new THREE.Color(color), n = geo.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
    list.push(geo);
    return geo;
  }
  function collider(x, z, w, d, ry = 0) {
    const c = Math.abs(Math.cos(ry)), s = Math.abs(Math.sin(ry));
    const hw = (c * w + s * d) / 2, hd = (s * w + c * d) / 2;
    boxes.push({ x0: x - hw, x1: x + hw, z0: z - hd, z1: z + hd });
  }
  // box: center x,z, bottom y0
  function box(x, y0, z, w, h, d, color, o = {}) {
    put(new THREE.BoxGeometry(w, h, d), color, o.list || solid, x, y0 + h / 2, z, o.rx || 0, o.ry || 0, o.rz || 0);
    if (o.col) collider(x, z, w, d, o.ry || 0);
  }
  function cyl(x, y0, z, rt, rb, h, color, o = {}) {
    put(new THREE.CylinderGeometry(rt, rb, h, o.seg || 8), color, o.list || solid, x, y0 + h / 2, z, o.rx || 0, o.ry || 0, o.rz || 0);
    if (o.col) collider(x, z, Math.max(rt, rb) * 2, Math.max(rt, rb) * 2);
  }
  function ball(x, y, z, r, color, o = {}) {
    put(new THREE.SphereGeometry(r, o.ws || 8, o.hs || 6), color, o.list || solid, x, y, z, 0, o.ry || 0, 0, o.sx || 1, o.sy || 1, o.sz || 1);
  }
  function group(x, z, ry, fn) {
    parentM = new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(1, 1, 1));
    fn();
    parentM = null;
  }

  // ---------------- walls (doors = list of centers along the wall)
  const WALL = 0x5a4a63, LINTEL = 0x4f4158;
  function wallX(z, x0, x1, doors = []) {
    let cur = x0;
    for (const dc of [...doors].sort((a, b) => a - b)) {
      const a = dc - DOOR_W / 2, b = dc + DOOR_W / 2;
      if (a > cur) box((cur + a) / 2, 0, z, a - cur, WALL_H, T, WALL, { col: true });
      box(dc, DOOR_H, z, DOOR_W, WALL_H - DOOR_H, T, LINTEL);
      cur = b;
    }
    if (x1 > cur) box((cur + x1) / 2, 0, z, x1 - cur, WALL_H, T, WALL, { col: true });
  }
  function wallZ(x, z0, z1, doors = []) {
    let cur = z0;
    for (const dc of [...doors].sort((a, b) => a - b)) {
      const a = dc - DOOR_W / 2, b = dc + DOOR_W / 2;
      if (a > cur) box(x, 0, (cur + a) / 2, T, WALL_H, a - cur, WALL, { col: true });
      box(x, DOOR_H, dc, T, WALL_H - DOOR_H, DOOR_W, LINTEL);
      cur = b;
    }
    if (z1 > cur) box(x, 0, (cur + z1) / 2, T, WALL_H, z1 - cur, WALL, { col: true });
  }
  wallX(-7, -10.1, 10.1);
  wallX(7, -10.1, 10.1);
  wallZ(-10, -7, 7);
  wallZ(10, -7, 7);
  wallX(-1, -10, 10, [-4, 1.5, 6.8]); // stream | bedroom | bathroom doors
  wallX(1, -10, 10, [-3, 6.5]);       // kitchen | living doors
  wallZ(-2, -7, -1);
  wallZ(4.5, -7, -1);
  wallZ(3, 1, 7, [4.5]);              // kitchen <-> living

  // ---------------- floors + ceiling
  const floor = (r, color) => box((r.x0 + r.x1) / 2, -0.05, (r.z0 + r.z1) / 2, r.x1 - r.x0, 0.05, r.z1 - r.z0, color);
  floor(ROOMS.stream, 0x3a1f4a);
  floor(ROOMS.bedroom, 0x5a3b2a);
  floor(ROOMS.bathroom, 0x2f5a5a);
  floor(ROOMS.hallway, 0x4a3326);
  floor(ROOMS.kitchen, 0x7a746c);
  floor(ROOMS.living, 0x3d3530);
  for (let i = 0; i < 13; i++) for (let j = 0; j < 6; j++) { // kitchen checker tiles
    if ((i + j) % 2) put(new THREE.PlaneGeometry(1, 1), 0x2e2a30, solid, -9.5 + i, 0.003, 1.5 + j, -Math.PI / 2);
  }
  box(0, WALL_H, 0, 20.4, 0.1, 14.4, 0x1a1420, { list: ceil });

  // ---------------- props helpers
  function pumpkin(x, z, r, ry, y0 = 0, col = true) {
    const cy = y0 + r * 0.72;
    ball(x, cy, z, r, 0xe8701a, { ws: 10, hs: 7, sy: 0.72 });
    put(new THREE.CylinderGeometry(r * 0.08, r * 0.12, r * 0.4, 5), 0x3d5a1e, solid, x, cy + r * 0.8, z, 0.2, 0, 0.15);
    const fx = Math.sin(ry), fz = Math.cos(ry), rx = Math.cos(ry), rz = -Math.sin(ry);
    for (const s of [-1, 1]) {
      put(new THREE.BoxGeometry(r * 0.22, r * 0.22, r * 0.12), 0xffa31a, glow,
        x + fx * r * 0.86 + rx * s * r * 0.36, cy + r * 0.2, z + fz * r * 0.86 + rz * s * r * 0.36, 0, ry, Math.PI / 4);
    }
    put(new THREE.BoxGeometry(r * 0.62, r * 0.13, r * 0.12), 0xffa31a, glow, x + fx * r * 0.9, cy - r * 0.17, z + fz * r * 0.9, 0, ry, 0);
    if (col) collider(x, z, r * 2, r * 2);
  }
  function chairSimple(x, z, ry, color) {
    group(x, z, ry, () => {
      box(0, 0.42, 0, 0.44, 0.05, 0.44, color);
      for (const [a, b] of [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]]) box(a, 0, b, 0.04, 0.42, 0.04, color);
      box(0, 0.47, 0.2, 0.44, 0.5, 0.04, color);
    });
    collider(x, z, 0.46, 0.46, ry);
  }
  function frame(x, y, z, ry, w, h, tilt, inner) {
    const fx = Math.sin(ry), fz = Math.cos(ry);
    box(x, y - h / 2, z, w, h, 0.03, 0x1b1210, { ry, rz: tilt });
    box(x + fx * 0.02, y - h / 2 + 0.05, z + fz * 0.02, w - 0.1, h - 0.1, 0.01, inner, { ry, rz: tilt });
  }
  function windowGlow(x, y, z, ry, w, h) {
    const fx = Math.sin(ry), fz = Math.cos(ry);
    put(new THREE.PlaneGeometry(w, h), 0x1b2a55, glow, x, y, z, 0, ry, 0);
    put(new THREE.CircleGeometry(0.1, 10), 0xaabbff, glow, x + fx * 0.004 + Math.cos(ry) * w * 0.25, y + h * 0.22, z + fz * 0.004 - Math.sin(ry) * w * 0.25, 0, ry, 0);
    box(x + fx * 0.02, y - h / 2, z + fz * 0.02, 0.05, h, 0.04, 0x241a22, { ry });
    box(x + fx * 0.02, y - 0.025, z + fz * 0.02, w, 0.05, 0.04, 0x241a22, { ry });
    box(x + fx * 0.02, y - h / 2 - 0.08, z + fz * 0.02, w + 0.2, 0.06, 0.12, 0x241a22, { ry });
  }

  // ================= STREAM ROOM (x -10..-2, z -7..-1)
  const DESK_TOP = 0.77;
  box(-6, 0.72, -6.5, 1.9, 0.05, 0.8, 0x1c1624, { col: true });            // desk top
  box(-6.92, 0, -6.5, 0.05, 0.72, 0.75, 0x151019); box(-5.08, 0, -6.5, 0.05, 0.72, 0.75, 0x151019);
  box(-6, 0.69, -6.1, 1.85, 0.02, 0.02, 0, { list: led });                 // under-desk RGB
  // monitor
  box(-6.1, DESK_TOP, -6.72, 0.3, 0.02, 0.2, 0x111111);
  box(-6.1, DESK_TOP, -6.74, 0.05, 0.35, 0.04, 0x111111);
  box(-6.1, 0.93, -6.64, 0.96, 0.56, 0.05, 0x0d0d12);
  put(new THREE.ConeGeometry(0.07, 0.12, 3), 0xff5fa8, solid, -6.48, 1.52, -6.64, 0, 0, 0.2);  // cat ears on monitor
  put(new THREE.ConeGeometry(0.07, 0.12, 3), 0xff5fa8, solid, -5.72, 1.52, -6.64, 0, 0, -0.2);
  // PC tower with glowing side
  box(-6.78, DESK_TOP, -6.5, 0.22, 0.46, 0.44, 0x15121a);
  box(-6.78, DESK_TOP + 0.04, -6.275, 0.18, 0.38, 0.01, 0, { list: led });
  box(-6.665, DESK_TOP + 0.05, -6.5, 0.005, 0.36, 0.36, 0x7b2fff, { list: glow });
  // keyboard, mouse, mic
  box(-6.1, DESK_TOP, -6.25, 0.46, 0.025, 0.15, 0x1e1a24);
  box(-6.1, DESK_TOP + 0.024, -6.25, 0.42, 0.004, 0.11, 0xb04fff, { list: glow });
  box(-5.72, DESK_TOP, -6.24, 0.06, 0.03, 0.1, 0x1e1a24);
  cyl(-5.55, DESK_TOP, -6.72, 0.06, 0.07, 0.02, 0x111111);
  cyl(-5.55, DESK_TOP, -6.72, 0.012, 0.012, 0.42, 0x222222);
  ball(-5.55, DESK_TOP + 0.47, -6.68, 0.045, 0x2b2b30, { sy: 1.7 });
  // "place here" glow ring for the headphones
  const deskPosition = new THREE.Vector3(-5.35, DESK_TOP, -6.38);
  put(new THREE.TorusGeometry(0.15, 0.008, 4, 24), 0xff5fa8, glow, deskPosition.x, DESK_TOP + 0.006, deskPosition.z, -Math.PI / 2);
  // gaming chair (cat ears on the backrest)
  group(-6.35, -5.3, 0.25, () => {
    cyl(0, 0.02, 0, 0.3, 0.3, 0.05, 0x111111, { seg: 5 });
    cyl(0, 0.07, 0, 0.04, 0.04, 0.38, 0x333333);
    box(0, 0.45, 0, 0.52, 0.1, 0.5, 0x1a1420);
    box(0, 0.5, 0.01, 0.3, 0.02, 0.44, 0xff5fa8);
    box(0, 0.55, 0.24, 0.52, 0.8, 0.1, 0x1a1420);
    box(0, 0.6, 0.185, 0.16, 0.7, 0.01, 0xff5fa8);
    box(-0.28, 0.55, 0, 0.05, 0.2, 0.4, 0x222222); box(0.28, 0.55, 0, 0.05, 0.2, 0.4, 0x222222);
    put(new THREE.ConeGeometry(0.08, 0.16, 3), 0xff5fa8, solid, -0.17, 1.42, 0.24, 0, 0, 0.25);
    put(new THREE.ConeGeometry(0.08, 0.16, 3), 0xff5fa8, solid, 0.17, 1.42, 0.24, 0, 0, -0.25);
  });
  collider(-6.35, -5.3, 0.55, 0.55);
  // ring light on a stand, facing the chair
  cyl(-4.75, 0, -6.2, 0.02, 0.02, 1.35, 0x222222);
  put(new THREE.ConeGeometry(0.22, 0.25, 3), 0x1a1a1a, solid, -4.75, 0.12, -6.2);
  put(new THREE.TorusGeometry(0.26, 0.028, 5, 20), 0xffe6f2, glow, -4.75, 1.55, -6.2, 0, Math.atan2(-1.6, 0.9), 0);
  collider(-4.75, -6.2, 0.4, 0.4);
  // neon cat-ear sign above the monitor
  put(new THREE.TorusGeometry(0.3, 0.022, 4, 24), 0xff4fb0, glow, -6.1, 2.05, -6.88);
  put(new THREE.ConeGeometry(0.13, 0.22, 3), 0xff4fb0, glow, -6.33, 2.38, -6.88, 0, 0, 0.45, 1, 1, 0.15);
  put(new THREE.ConeGeometry(0.13, 0.22, 3), 0xff4fb0, glow, -5.87, 2.38, -6.88, 0, 0, -0.45, 1, 1, 0.15);
  // acoustic foam panels
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    box(-3.9 + i * 0.4, 1.0 + j * 0.4, -6.88, 0.36, 0.36, 0.05, (i + j) % 2 ? 0x6a2458 : 0x33195a);
  }
  // shelf with little figures, beanbag + ghost plush
  box(-9.78, 1.4, -4.5, 0.25, 0.04, 1.2, 0x2a1e2e);
  ball(-9.78, 1.52, -4.9, 0.08, 0xff9ec7); ball(-9.78, 1.5, -4.5, 0.06, 0xffffff, { sy: 1.4 }); box(-9.78, 1.44, -4.1, 0.12, 0.18, 0.08, 0x8a5cff);
  ball(-9.1, 0.3, -2.0, 0.55, 0x6a2f6a, { ws: 10, hs: 7, sy: 0.55 });
  ball(-9.1, 0.72, -2.05, 0.14, 0xeae6f0, { sy: 1.2 });
  collider(-9.1, -2.0, 1.0, 1.0);
  // LED strip around the stream room ceiling
  box(-6, 2.7, -6.88, 7.7, 0.03, 0.03, 0, { list: led });
  box(-6, 2.7, -1.12, 7.7, 0.03, 0.03, 0, { list: led });
  box(-9.88, 2.7, -4, 0.03, 0.03, 5.7, 0, { list: led });
  box(-2.12, 2.7, -4, 0.03, 0.03, 5.7, 0, { list: led });

  // ================= BEDROOM (x -2..4.5, z -7..-1)
  box(1.2, 0.12, -5.85, 1.6, 0.18, 2.1, 0x3a2418, { col: true });          // bed frame (raised)
  for (const [a, b] of [[0.45, -6.85], [1.95, -6.85], [0.45, -4.85], [1.95, -4.85]]) box(a, 0, b, 0.08, 0.12, 0.08, 0x2a1a12);
  box(1.2, 0, -6.85, 1.6, 1.0, 0.1, 0x3a2418);                              // headboard
  box(1.2, 0.3, -5.85, 1.52, 0.2, 2.0, 0xd8d0e0);                           // mattress
  box(1.2, 0.5, -5.3, 1.56, 0.07, 1.3, 0xb04a80);                           // blanket
  ball(1.0, 0.6, -5.5, 0.3, 0xb04a80, { sx: 1.1, sy: 0.35, sz: 1.5 });      // suspicious lump
  box(1.2, 0.5, -6.5, 0.7, 0.12, 0.35, 0xf0eaf4);                           // pillow
  box(0.95, 0.05, -4.8, 0.05, 0.03, 0.01, 0xd8ff5a, { list: glow });        // eyes under the bed
  box(1.15, 0.05, -4.8, 0.05, 0.03, 0.01, 0xd8ff5a, { list: glow });
  box(2.4, 0, -6.62, 0.45, 0.55, 0.45, 0x3a2418, { col: true });           // nightstand
  cyl(2.4, 0.55, -6.62, 0.05, 0.07, 0.2, 0x444444);
  put(new THREE.ConeGeometry(0.14, 0.16, 6, 1, true), 0x7a3a18, glow, 2.4, 0.83, -6.62);
  box(4.1, 0, -4.7, 0.6, 2.1, 1.6, 0x3a2a22, { col: true });               // closet
  box(3.795, 0.05, -4.7, 0.01, 2.0, 0.02, 0x0a0608);
  box(3.79, 1.0, -4.8, 0.02, 0.12, 0.03, 0xc8a040); box(3.79, 1.0, -4.6, 0.02, 0.12, 0.03, 0xc8a040);
  cyl(1.2, 0.001, -3.4, 1.0, 1.0, 0.01, 0x4a2a5e, { seg: 16 });            // rug
  windowGlow(-0.8, 1.55, -6.885, 0, 1.0, 0.9);
  frame(-1.2, 1.7, -0.88, 0, 0.45, 0.55, 0.15, 0x4a3a5a);                   // hallway frames
  frame(3.8, 1.6, 0.88, Math.PI, 0.4, 0.5, -0.1, 0x3a4a5a);
  frame(-6.5, 1.75, 0.88, Math.PI, 0.5, 0.4, 0.08, 0x5a3a3a);

  // ================= BATHROOM (x 4.5..10, z -7..-1)
  const TUB = 0xd8dde0;
  box(8.75, 0, -6.06, 2.3, 0.55, 0.08, TUB); box(8.75, 0, -6.84, 2.3, 0.55, 0.08, TUB);
  box(7.64, 0, -6.45, 0.08, 0.55, 0.7, TUB); box(9.86, 0, -6.45, 0.08, 0.55, 0.7, TUB);
  box(8.75, 0, -6.45, 2.2, 0.1, 0.72, TUB);
  put(new THREE.PlaneGeometry(2.14, 0.7), 0x234d44, glow, 8.75, 0.42, -6.45, -Math.PI / 2);
  ball(9.2, 0.47, -6.4, 0.06, 0xffd21a, { sy: 0.8 }); ball(9.24, 0.54, -6.4, 0.035, 0xffd21a); // rubber duck
  collider(8.75, -6.45, 2.3, 0.9);
  box(5.2, 0, -6.5, 0.36, 0.4, 0.45, TUB);                                  // toilet
  cyl(5.2, 0.3, -6.38, 0.22, 0.17, 0.12, TUB);
  cyl(5.2, 0.42, -6.38, 0.22, 0.22, 0.03, 0xffb3d9);
  box(5.2, 0.42, -6.82, 0.45, 0.4, 0.18, TUB);
  collider(5.2, -6.55, 0.5, 0.75);
  put(new THREE.CylinderGeometry(0.055, 0.055, 0.1, 8), 0xf4f4f4, solid, 4.67, 0.72, -6.0, Math.PI / 2, 0, 0);
  cyl(9.62, 0, -3.2, 0.08, 0.1, 0.72, TUB);                                 // sink
  box(9.62, 0.72, -3.2, 0.45, 0.15, 0.55, TUB);
  box(9.62, 0.86, -3.2, 0.34, 0.012, 0.42, 0x6a8a9a);
  collider(9.62, -3.2, 0.5, 0.6);
  box(9.9, 1.08, -3.2, 0.03, 0.94, 0.74, 0x3a2a22);                         // mirror frame

  // ================= KITCHEN (x -10..3, z 1..7)
  box(-9.45, 0, 6.5, 0.8, 1.85, 0.75, 0xcfd6dc, { col: true });             // fridge
  box(-9.45, 1.2, 6.12, 0.78, 0.015, 0.01, 0x55585c);
  box(-9.15, 1.35, 6.1, 0.03, 0.35, 0.03, 0x999999); box(-9.15, 0.6, 6.1, 0.03, 0.4, 0.03, 0x999999);
  box(-9.6, 1.5, 6.115, 0.08, 0.08, 0.01, 0xff5fa8); box(-9.4, 1.62, 6.115, 0.07, 0.1, 0.01, 0xffd21a); box(-9.55, 0.9, 6.115, 0.1, 0.07, 0.01, 0x6ad0ff);
  box(-6.9, 0, 6.6, 4.1, 0.88, 0.6, 0x3a3430, { col: true });               // counter
  box(-6.9, 0.88, 6.58, 4.15, 0.04, 0.66, 0x8a8078);
  for (const [a, b] of [[-5.9, 6.45], [-5.45, 6.45], [-5.9, 6.75], [-5.45, 6.75]]) cyl(a, 0.92, b, 0.1, 0.1, 0.01, 0x151515);
  put(new THREE.TorusGeometry(0.08, 0.01, 3, 16), 0xff3a1a, glow, -5.45, 0.935, 6.45, -Math.PI / 2);
  box(-8.4, 0.92, 6.65, 0.5, 0.3, 0.38, 0x1e1e22);                          // microwave
  box(-8.25, 1.0, 6.455, 0.1, 0.05, 0.01, 0x3aff7a, { list: glow });
  cyl(-7.4, 0.92, 6.6, 0.14, 0.15, 0.22, 0xf2f2f2, { seg: 10 });            // rice cooker
  ball(-7.4, 1.14, 6.6, 0.13, 0xf2f2f2, { sy: 0.35 });
  box(-6.9, 1.55, 6.72, 4.1, 0.7, 0.35, 0x3a3430);                          // upper cabinets
  box(-4, 0.72, 3.8, 1.4, 0.05, 0.9, 0x6a4a32, { col: true });              // table
  for (const [a, b] of [[-4.62, 3.43], [-3.38, 3.43], [-4.62, 4.17], [-3.38, 4.17]]) box(a, 0, b, 0.06, 0.72, 0.06, 0x4a3222);
  chairSimple(-4.3, 2.95, Math.PI, 0x4a3222);
  chairSimple(-3.4, 4.75, 0.4, 0x4a3222);
  pumpkin(-4.25, 3.85, 0.22, Math.atan2(1.2, -2.8), 0.77, false);
  windowGlow(-9.885, 1.55, 3.5, Math.PI / 2, 1.0, 0.9);

  // ================= LIVING ROOM (x 3..10, z 1..7)
  box(6.5, 0, 6.45, 3.0, 0.42, 0.85, 0x4a2a3a, { col: true });              // sofa
  box(6.5, 0.42, 6.78, 3.0, 0.5, 0.2, 0x4a2a3a);
  box(5.05, 0.42, 6.45, 0.2, 0.2, 0.85, 0x4a2a3a); box(7.95, 0.42, 6.45, 0.2, 0.2, 0.85, 0x4a2a3a);
  box(5.8, 0.42, 6.35, 1.3, 0.06, 0.6, 0x5a3348); box(7.2, 0.42, 6.35, 1.3, 0.06, 0.6, 0x5a3348);
  box(6.5, 0, 4.3, 1.0, 0.4, 0.55, 0x2e2018, { col: true });                // coffee table
  cyl(6.75, 0.4, 4.25, 0.12, 0.08, 0.07, 0xd0d0d0, { seg: 8 });
  box(9.65, 0, 4.0, 0.45, 0.5, 1.8, 0x2a1e18, { col: true });               // TV stand
  box(9.82, 0.8, 4.0, 0.06, 0.72, 1.25, 0x0b0b0e);                          // TV body
  // spirit house (ศาลพระภูมิ) with red soda offerings
  box(3.55, 0, 6.4, 0.12, 1.0, 0.12, 0xe8dcc0);
  box(3.55, 1.0, 6.4, 0.6, 0.04, 0.6, 0xc89a2a);
  box(3.55, 1.04, 6.55, 0.3, 0.28, 0.26, 0xe8d8b0);
  box(3.55, 1.06, 6.415, 0.1, 0.16, 0.01, 0x3a1a0a);
  put(new THREE.ConeGeometry(0.28, 0.25, 4), 0xc89a2a, solid, 3.55, 1.45, 6.55, 0, Math.PI / 4, 0);
  put(new THREE.ConeGeometry(0.02, 0.2, 4), 0xe8c04a, solid, 3.55, 1.66, 6.55);
  cyl(3.4, 1.04, 6.2, 0.025, 0.025, 0.12, 0xff2040, { list: glow });
  cyl(3.72, 1.04, 6.2, 0.025, 0.025, 0.12, 0xff2040, { list: glow });
  ball(3.72, 1.1, 6.2, 0.008, 0xffffff); // straw tip
  collider(3.55, 6.4, 0.6, 0.6);

  // ================= HALLWAY (x -10..10, z -1..1)
  box(-9.87, 0, 0, 0.06, 2.1, 1.0, 0x3a2418);                               // front door
  ball(-9.83, 1.0, 0.35, 0.035, 0xc8a040);
  box(-9.4, 0, 0, 0.5, 0.01, 0.9, 0x5a2a2a);                                // doormat
  pumpkin(-9.25, 0.55, 0.25, Math.PI / 2);
  pumpkin(3.3, -0.6, 0.18, 0);
  pumpkin(8.9, 0.6, 0.2, -Math.PI / 2);
  cyl(-2, 2.55, 0, 0.005, 0.005, 0.25, 0x111111);                           // hanging bulb
  ball(-2, 2.52, 0, 0.05, 0xffc080, { list: glow });
  // banner strings to the 249 banner (east end)
  box(9.87, 2.2, -0.8, 0.01, 0.6, 0.01, 0x111111);
  box(9.87, 2.2, 0.8, 0.01, 0.6, 0.01, 0x111111);

  // ---------------- merged meshes
  const solidMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85, metalness: 0 });
  const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  const ledMat = new THREE.MeshBasicMaterial({ color: 0xff4fc0 });
  const mk = (list, mat, name) => {
    const m = new THREE.Mesh(mergeGeometries(list, false), mat);
    m.name = name; m.matrixAutoUpdate = false; m.updateMatrix();
    root.add(m);
    list.forEach((g) => g.dispose());
    return m;
  };
  mk(solid, solidMat, 'house');
  mk(glow, glowMat, 'glow');
  mk(led, ledMat, 'rgb-led');
  mk(ceil, solidMat, 'ceiling');

  // floating toilet-paper roll (bathroom)
  put(new THREE.CylinderGeometry(0.06, 0.06, 0.11, 10), 0xf4f4f4, tpParts, 0, 0, 0, 0, 0, Math.PI / 2);
  put(new THREE.CylinderGeometry(0.022, 0.022, 0.113, 6), 0x8a6a4a, tpParts, 0, 0, 0, 0, 0, Math.PI / 2);
  put(new THREE.BoxGeometry(0.1, 0.35, 0.004), 0xf4f4f4, tpParts, 0, -0.17, 0.058, 0.08, 0, 0);
  const tpRoll = new THREE.Mesh(mergeGeometries(tpParts, false), solidMat);
  tpRoll.name = 'toilet-paper';
  tpRoll.position.set(6.9, 1.35, -4.2);
  root.add(tpRoll);

  // textured planes
  function plane(w, h, mat, x, y, z, ry, name) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.set(x, y, z); m.rotation.y = ry; m.name = name;
    m.matrixAutoUpdate = false; m.updateMatrix();
    root.add(m);
    return m;
  }
  const texMat = (draw, w, h, emissive = 0.18) => {
    const map = canvasTex(w, h, draw);
    return new THREE.MeshStandardMaterial({ map, emissiveMap: map, emissive: 0xffffff, emissiveIntensity: emissive, roughness: 0.8 });
  };
  const screenMat = new THREE.MeshBasicMaterial({ map: canvasTex(512, 288, monitorDraw) });
  plane(0.9, 0.506, screenMat, -6.1, 1.21, -6.612, 0, 'monitor-screen');
  plane(0.7, 0.96, texMat(posterDraw, 256, 352), -8.4, 1.55, -6.885, 0, 'peach-poster');
  plane(1.7, 0.64, texMat(bannerDraw, 512, 192, 0.3), 9.885, 1.9, 0, -Math.PI / 2, 'banner-249');
  const mirrorMat = texMat(mirrorDraw, 256, 340, 0.3);
  mirrorMat.roughness = 0.12; mirrorMat.metalness = 0.2;
  plane(0.62, 0.84, mirrorMat, 9.88, 1.55, -3.2, -Math.PI / 2, 'mirror');
  const tvMat = new THREE.MeshBasicMaterial({ color: 0x1c2a44 });
  plane(1.15, 0.62, tvMat, 9.785, 1.16, 4.0, -Math.PI / 2, 'tv-screen');

  // ---------------- lights
  const hemi = new THREE.HemisphereLight(0x5a4a8a, 0x120a18, 0.45);
  root.add(hemi);
  const lights = [];
  function point(color, intensity, dist, x, y, z, kind) {
    const l = new THREE.PointLight(color, intensity, dist, 2);
    l.position.set(x, y, z);
    root.add(l);
    lights.push({ light: l, base: intensity, kind, seed: Math.random() * 100 });
    return l;
  }
  const rgbLight = point(0xff4fc0, 4.5, 7, -6, 2.3, -4.6, 'rgb');
  point(0x7aa0ff, 1.4, 3.5, -6.1, 1.25, -6.1, 'screen');
  point(0x6f86ff, 1.6, 5, -0.8, 1.6, -6.2, 'room');       // bedroom moonlight
  point(0x5fffc0, 1.8, 5.5, 7.2, 2.2, -4.0, 'room');      // bathroom
  point(0xff8a2a, 2.2, 5, -4.25, 1.2, 3.85, 'candle');     // kitchen pumpkin
  point(0x6a8aff, 1.6, 5, 8.9, 1.2, 4.0, 'tv');            // living TV
  point(0xffb070, 1.8, 6, -2, 2.35, 0, 'room');            // hallway bulb

  // ---------------- gameplay points
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const itemSpots = [
    V(1.4, 0.58, -5.6),    // bedroom: on the bed
    V(2.4, 0.56, -6.55),   // bedroom: nightstand
    V(3.45, 0.02, -3.4),   // bedroom: floor by the closet
    V(8.6, 0.44, -6.45),   // bathroom: in the tub
    V(9.55, 0.88, -3.2),   // bathroom: sink
    V(-3.75, 0.78, 3.65),  // kitchen: table
    V(-6.5, 0.92, 6.5),    // kitchen: counter
    V(6.0, 0.49, 6.3),     // living: sofa
    V(6.3, 0.41, 4.3),     // living: coffee table
    V(3.55, 1.05, 6.24),   // living: spirit house offering shelf
    V(9.35, 0.02, 0.35),   // hallway: under the 249 banner
  ];
  const ghostSpawns = [V(7.0, 0, -4.0), V(-8.3, 0, 2.3), V(8.4, 0, 2.6), V(3.3, 0, -2.2)];
  const navPoints = [
    V(-7.5, 0, -3.5), V(-4.0, 0, -2.5),
    V(-8.0, 0, 0), V(-4.0, 0, 0), V(0, 0, 0), V(4.0, 0, 0), V(8.0, 0, 0),
    V(0.0, 0, -3.0), V(3.0, 0, -2.5),
    V(6.5, 0, -3.5), V(8.5, 0, -4.5),
    V(-7.0, 0, 3.5), V(-2.0, 0, 5.2), V(0.5, 0, 2.5),
    V(5.0, 0, 3.2), V(8.3, 0, 2.8),
  ];
  const spawn = { position: V(-6, 0, -3.3), yaw: 0 };

  // ---------------- runtime
  let flicker = false, flickT = 0, flickM = 1;
  const baseGlow = new THREE.Color(1, 1, 1);
  const tmpC = new THREE.Color();

  function collide(pos, radius = 0.3) {
    for (let iter = 0; iter < 2; iter++) {
      for (const b of boxes) {
        if (pos.x < b.x0 - radius || pos.x > b.x1 + radius || pos.z < b.z0 - radius || pos.z > b.z1 + radius) continue;
        const cx = Math.min(Math.max(pos.x, b.x0), b.x1), cz = Math.min(Math.max(pos.z, b.z0), b.z1);
        const dx = pos.x - cx, dz = pos.z - cz, d2 = dx * dx + dz * dz;
        if (d2 >= radius * radius) continue;
        if (d2 > 1e-10) {
          const d = Math.sqrt(d2), k = (radius - d) / d;
          pos.x += dx * k; pos.z += dz * k;
        } else { // centre inside the box: leave by the nearest side
          const l = pos.x - b.x0, r = b.x1 - pos.x, n = pos.z - b.z0, s = b.z1 - pos.z, m = Math.min(l, r, n, s);
          if (m === l) pos.x = b.x0 - radius; else if (m === r) pos.x = b.x1 + radius;
          else if (m === n) pos.z = b.z0 - radius; else pos.z = b.z1 + radius;
        }
      }
    }
    return pos;
  }

  function roomAt(pos) {
    for (const k in ROOMS) { const r = ROOMS[k]; if (pos.x >= r.x0 && pos.x <= r.x1 && pos.z >= r.z0 && pos.z <= r.z1) return k; }
    return null;
  }

  function update(dt, t) {
    // RGB strip: pink <-> purple sweep
    const hue = 0.86 + 0.07 * Math.sin(t * 0.9);
    ledMat.color.setHSL(hue, 0.95, 0.58);
    rgbLight.color.setHSL(hue, 0.85, 0.6);

    if (flicker) {
      flickT -= dt;
      if (flickT <= 0) {
        flickT = 0.04 + Math.random() * 0.12;
        flickM = Math.random() < 0.35 ? 0.03 : 0.35 + Math.random() * 0.9;
      }
    } else flickM = 1;

    for (const L of lights) {
      let m = 1;
      if (L.kind === 'candle') m = 0.85 + 0.1 * Math.sin(t * 11 + L.seed) + 0.06 * Math.sin(t * 23.7 + L.seed);
      else if (L.kind === 'tv') m = 0.75 + 0.25 * Math.sin(t * 7.3 + L.seed) * Math.sin(t * 2.1);
      L.light.intensity = L.base * m * (L.kind === 'screen' ? Math.max(flickM, 0.3) : flickM);
    }
    glowMat.color.copy(baseGlow).multiplyScalar(flicker ? Math.max(flickM, 0.15) : 1);
    screenMat.color.setScalar(flicker ? Math.max(flickM, 0.25) : 1);
    const n = 0.7 + 0.3 * Math.random();
    tvMat.color.copy(tmpC.setRGB(0.07 * n, 0.1 * n, 0.18 * n));

    tpRoll.position.y = 1.35 + Math.sin(t * 1.3) * 0.12;
    tpRoll.rotation.y = t * 0.5;
    tpRoll.rotation.z = Math.sin(t * 0.7) * 0.4;
  }

  return {
    spawn, deskPosition, itemSpots, ghostSpawns, navPoints,
    collide,
    setFlicker(on) { flicker = !!on; if (!flicker) flickM = 1; },
    update,
    // extras (not part of the contract)
    scene, root, colliders: boxes, rooms: ROOMS, roomAt,
  };
}
