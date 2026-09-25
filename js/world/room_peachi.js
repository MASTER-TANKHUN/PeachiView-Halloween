// Peachi's room (x -10..-2, z -7..-1): pastel pink bedroom + streaming corner, inspired by her stream
// background — big bed, white desk setup, keyboard by the blinds, hanging plants, bear figure on a cube
// shelf — at 3 a.m. on Halloween: moonlight through the slats, fairy lights, neon, a glowing peach lamp.
import * as THREE from 'three';
import { shapes as S, heartShape } from './kit.js';
import { pillow, duvet, beanbag, roundCushion, cable } from './soft.js';
import * as A from './art.js';
import { art } from './tex.js';

const TAU = Math.PI * 2;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const PINK = 0xf7a9c2, PINK2 = 0xff7fae, ROSE = 0xe86a92, BLUSH = 0xfbd6de, CREAM = 0xfff4ee, WHITE = 0xfbf8fa, GOLD = 0xe8c070, LEAF = 0x5cbf6a;

// ---------------------------------------------------------------- extra materials for this room
function roomMaterials(M) {
  if (M.bedding) return;
  const chevron = art(512, 512, (g, w, h) => { // bedding print: pink with white chevrons and tiny peaches
    g.fillStyle = '#f4a3bc'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#fff3f6'; g.lineWidth = 14; g.lineJoin = 'miter';
    for (let y = -64; y < h + 64; y += 128) { g.beginPath(); for (let x = 0; x <= w; x += 64) g.lineTo(x, y + ((x / 64) % 2 ? 36 : 0)); g.stroke(); }
    for (let y = 0; y < h; y += 128) for (let x = 32; x < w; x += 128) {
      g.fillStyle = '#ffd0b8'; g.beginPath(); g.arc(x, y + 80, 11, 0, TAU); g.fill();
      g.fillStyle = '#7ccf7a'; g.beginPath(); g.ellipse(x + 5, y + 67, 6, 3, -0.5, 0, TAU); g.fill();
    }
  }, { fonts: false });
  chevron.wrapS = chevron.wrapT = THREE.RepeatWrapping; chevron.repeat.set(1 / 0.5, 1 / 0.5);
  M.bedding = new THREE.MeshStandardMaterial({ map: chevron, normalMap: M.fabric.normalMap, normalScale: new THREE.Vector2(0.6, 0.6), roughness: 1, vertexColors: true, envMap: M.env, envMapIntensity: 0.05 });
  M.sheer = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, transparent: true, opacity: 0.45, side: THREE.DoubleSide, roughness: 1, depthWrite: false });
  M.sheer.userData.noShadow = true;
  M.acrylic = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, transparent: true, opacity: 0.22, roughness: 0.05, envMap: M.env, envMapIntensity: 1.5, depthWrite: false, side: THREE.DoubleSide });
  M.acrylic.userData.noShadow = true;
}

/** Hanging fabric with vertical folds (front +z), top edge at y = h. */
function drapeGeo(w, h, folds = 6, amp = 0.035) {
  const g = new THREE.PlaneGeometry(w, h, 48, 12), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i) + h / 2;
    const k = (x / w + 0.5) * folds * TAU;
    p.setXYZ(i, x, y, amp * Math.sin(k) * (0.75 + 0.25 * (1 - y / h)));
  }
  g.computeVertexNormals();
  return g;
}

export function roomPeachi(P, kit, M, root) {
  roomMaterials(M);
  const { add, at, pic, framed } = P;
  const lights = [], anim = [];

  // =========================================================== wall finishes
  // feature wallpaper behind the desk, framed by a thin white molding
  add('wall_peachFeature', S.plane(3.3, 2.58), { p: [-5.55, 0.12 + 1.29, -6.898], uv: 'world', ao: false });
  for (const [x, y, w, h] of [[-5.55, 2.72, 3.36, 0.03], [-5.55, 0.12, 3.36, 0.03], [-7.215, 1.42, 0.03, 2.62], [-3.885, 1.42, 0.03, 2.62]]) {
    add('paint', S.rbox(w, h, 0.02, 0.006), { p: [x, y, -6.89], color: WHITE, ao: false });
  }
  // pink LED strip around the ceiling (animated hue)
  for (const [x, z, w, d] of [[-6, -6.8, 7.6, 0.012], [-6, -1.2, 7.6, 0.012], [-9.8, -4, 0.012, 5.6], [-2.2, -4, 0.012, 5.6]]) {
    add('emitRGB', S.box(w, 0.012, d), { p: [x, 2.7, z], ao: false });
  }

  // =========================================================== bed (head on the north wall)
  at(-8.3, 0, -5.72, 0, () => {
    const W = 1.8, L = 2.2;
    add('paint', S.rbox(W, 0.24, L, 0.035, 3), { p: [0, 0.16, 0], color: WHITE });
    add('paint', S.box(W - 0.14, 0.05, L - 0.14), { p: [0, 0.025, 0], color: 0xcfc4ca });
    add('fabric', S.rbox(W - 0.08, 0.24, L - 0.1, 0.07, 3), { p: [0, 0.4, 0.02], color: 0xfff8fa });
    // scalloped, tufted headboard
    const hw = (W + 0.04) / 2, H0 = 0.72, radii = [0.29, 0.34, 0.29];
    const hb = new THREE.Shape();
    hb.moveTo(-hw, 0); hb.lineTo(hw, 0); hb.lineTo(hw, H0);
    let cx = hw;
    for (const r of radii) { hb.absarc(cx - r, H0, r, 0, Math.PI, false); cx -= 2 * r; }
    hb.lineTo(-hw, 0);
    add('fabric', S.extrude(hb, 0.09, 0.035, 24), { p: [0, 0.2, -L / 2 - 0.02], color: PINK });
    add('paint', S.box(W + 0.02, 0.2, 0.06), { p: [0, 0.1, -L / 2 - 0.02], color: WHITE });
    for (let row = 0; row < 3; row++) for (let i = -3; i <= 3; i++) {
      const x = i * 0.24 + (row % 2) * 0.12, y = 0.36 + row * 0.22;
      if (Math.abs(x) > hw - 0.12) continue;
      add('fabric', S.sphere(0.016, 10, 8), { p: [x, 0.2 + y, -L / 2 + 0.07], s: [1, 1, 0.6], color: ROSE, ao: false });
    }
    // duvet (printed), folded-back top edge, throw at the foot
    add('bedding', duvet(W, 1.42, 0.3, { thick: 0.04, seed: 2 }), { p: [0, 0.565, 0.36] });
    add('fabric', pillow(W - 0.02, 0.08, 0.3, { seed: 0.3 }), { p: [0, 0.6, -0.2], color: CREAM });
    add('fabric', duvet(W + 0.04, 0.42, 0.24, { thick: 0.02, seed: 5, folds: 9 }), { p: [0, 0.63, 0.78], color: 0xd9a0c8 });
    // pillows leaning on the headboard + cushions in front
    for (const s of [-1, 1]) add('fabric', pillow(0.66, 0.2, 0.46, { seed: s }), { p: [s * 0.42, 0.8, -0.86], r: [-1.18, 0, s * 0.04], color: 0xfff6f8 });
    add('fabric', pillow(0.44, 0.15, 0.44, { seed: 3 }), { p: [-0.25, 0.8, -0.66], r: [-1.0, 0.15, 0], color: PINK2 });
    add('plush', roundCushion(0.2, 0.08, { cleft: true }), { p: [0.3, 0.8, -0.62], r: [-0.35, -0.2, 0.08], color: (p, n, c) => c.set(0xffb3a0).lerp(new THREE.Color(0xff7f9e), Math.max(0, Math.min(1, (0.95 - p.y) / 0.35))) });
    add('plastic', S.cone(0.06, 0.12, 8), { p: [0.36, 1.02, -0.66], r: [0, 0, -1.1], s: [1, 1, 0.35], color: LEAF });
    add('plush', S.extrude(heartShape(0.13), 0.06, 0.03, 16), { p: [0.66, 0.76, -0.55], r: [-0.3, -0.35, 0.1], color: 0xff5f95 });
    at(-0.62, 0.55, -0.5, 0.3, () => P.plush('bear', 0xf4d0b8));
    at(0.05, 0.57, 0.62, -0.9, () => P.plush('ghost', 0xf6f4ff));
    // laptop open on the bed
    at(0.38, 0.6, 0.2, -0.4, () => {
      add('plastic', S.rbox(0.33, 0.016, 0.23, 0.006), { p: [0, 0.008, 0], color: 0xe8e0ea });
      add('plastic', S.box(0.28, 0.002, 0.1), { p: [0, 0.017, -0.03], color: 0xd0c8d4 });
      at(0, 0.016, -0.115, 0, () => {
        add('plastic', S.rbox(0.33, 0.22, 0.01, 0.005), { p: [0, 0.11, 0], color: 0xe8e0ea });
        pic(A.monitorSide(), 0.19, 0.2, { p: [0, 0.11, 0.0055], basic: true, emit: 1.1 }).rotation;
      }, -0.3, 0);
    });
    kit.collide(0, 0, W, L);
  });
  // canopy over the bed: sheer panels falling from a gold ring at the ceiling, tied back at the headboard
  at(-8.3, 0, -6.35, 0, () => {
    add('metal', S.torus(0.34, 0.012, 8, 48), { p: [0, 2.62, 0], r: [Math.PI / 2, 0, 0], color: GOLD, ao: false });
    for (let i = 0; i < 3; i++) add('metal', S.cyl(0.003, 0.003, 0.18, 4), { p: [Math.cos(i * 2.1) * 0.3, 2.71, Math.sin(i * 2.1) * 0.3], color: GOLD, ao: false });
    for (const [a, flare] of [[-1.25, 0.34], [-0.55, 0.3], [0.55, 0.3], [1.25, 0.34]]) at(Math.sin(a) * 0.33, 0.1, -Math.cos(a) * 0.1, -a * 0.9, () => {
      add('sheer', drapeGeo(0.62, 2.52, 6, 0.05), { p: [0, 0, 0], r: [0, 0, 0], uv: 'keep', color: 0xffeaf2, ao: false });
    }, 0, Math.sign(a) * flare * 0.5);
    for (const s of [-1, 1]) add('fabric', S.torus(0.05, 0.012, 6, 16), { p: [s * 0.95, 1.05, 0.05], r: [0, Math.PI / 2, 0], color: PINK2 });
    P.fairyLights(V(-0.3, 2.55, 0.25), V(-1.0, 1.2, 0.3), 12, 0.05, [0xffe0a0, 0xffb0d0], 3.5);
    P.fairyLights(V(0.3, 2.55, 0.25), V(1.0, 1.2, 0.3), 12, 0.05, [0xffe0a0, 0xffb0d0], 3.5);
  });
  // nightstands: glowing peach lamp on the left, clock + drink on the right
  const nightstand = (x, z) => at(x, 0, z, 0, () => P.cabinet(0.44, 0.52, 0.4, { color: WHITE, mat: 'paint', rows: [{ h: 1, kind: 'open' }, { h: 1, kind: 'drawer' }], top: { mat: 'gloss', color: WHITE, t: 0.025, over: 0.01 }, handle: 'knob', hColor: GOLD, plinth: 0.04 }));
  nightstand(-9.62, -6.62);
  nightstand(-7.0, -6.62);
  at(-9.62, 0.545, -6.64, 0.3, () => { // peach lamp
    add('metal', S.cyl(0.06, 0.07, 0.03, 20), { p: [0, 0.015, 0], color: GOLD });
    const peach = new THREE.SphereGeometry(0.11, 28, 20), pp = peach.attributes.position;
    for (let i = 0; i < pp.count; i++) { const x = pp.getX(i), y = pp.getY(i), z = pp.getZ(i); const c = Math.exp(-((x / 0.025) ** 2)) * Math.max(0, z) / 0.11; pp.setXYZ(i, x * 0.98, y + (y > 0.08 ? -Math.exp(-((x / 0.04) ** 2)) * 0.02 : 0), z * (1 - 0.12 * c)); }
    peach.computeVertexNormals();
    add('emitFlicker', peach, { p: [0, 0.14, 0], color: (p, n, c) => c.setRGB(1.0, 0.62, 0.52).multiplyScalar(1.3 + 0.5 * Math.max(0, n.y)), ao: false });
    add('plastic', S.cone(0.05, 0.1, 8), { p: [0.05, 0.26, 0], r: [0, 0, -1.2], s: [1, 1, 0.35], color: LEAF });
    add('haze', S.sphere(0.2, 16, 12), { p: [0, 0.14, 0], color: 0xff9a80, emit: 0.06, ao: false });
  });
  lights.push({ color: 0xffa488, intensity: 1.6, dist: 3.2, p: [-9.55, 0.8, -6.45], kind: 'lamp' });
  at(-7.0, 0.545, -6.66, -0.2, () => { // alarm clock stuck at 03:00, bubble tea, book
    add('plastic', S.rbox(0.13, 0.07, 0.06, 0.02), { p: [-0.08, 0.035, 0], color: 0xfbe4ec });
    pic(art(128, 64, (g, w, h) => { g.fillStyle = '#1a0a12'; g.fillRect(0, 0, w, h); g.fillStyle = '#ff5f95'; g.font = '700 44px Kanit, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('03:00', w / 2, h / 2 + 2); }), 0.1, 0.045, { p: [-0.08, 0.037, 0.031], basic: true, emit: 2.2 });
    add('plastic', S.cyl(0.042, 0.034, 0.14, 16), { p: [0.1, 0.07, 0.02], color: 0xf08a3a });
    add('acrylic', S.sphere(0.043, 14, 8, 0, TAU, 0, Math.PI / 2), { p: [0.1, 0.14, 0.02], color: 0xffffff, ao: false });
    add('plastic', S.cyl(0.005, 0.005, 0.12, 6), { p: [0.11, 0.2, 0.02], r: [0, 0, 0.15], color: 0xff5f95 });
    add('paint', S.rbox(0.15, 0.03, 0.21, 0.004), { p: [0.02, 0.015, -0.04], r: [0, 0.4, 0], color: 0x8a6ac8 });
  });

  // =========================================================== streaming desk (north wall)
  const DESK = { x: -5.55, z: -6.52, top: 0.775 };
  at(DESK.x, 0, DESK.z, 0, () => {
    add('gloss', S.rbox(2.4, 0.035, 0.75, 0.012), { p: [0, 0.7575, 0], color: WHITE });
    add('emitRGB', S.box(2.3, 0.01, 0.012), { p: [0, 0.735, -0.33], ao: false });
    at(-0.95, 0, -0.02, 0, () => P.cabinet(0.44, 0.74, 0.66, { color: WHITE, mat: 'paint', rows: [{ h: 1, kind: 'drawer' }, { h: 1, kind: 'drawer' }, { h: 1, kind: 'drawer' }], handle: 'bar', hColor: GOLD, plinth: 0.03 }));
    add('plastic', S.rbox(0.05, 0.74, 0.68, 0.015), { p: [1.14, 0.37, 0], color: WHITE });
    add('plastic', S.rbox(2.1, 0.28, 0.02, 0.008), { p: [0.1, 0.56, -0.33], color: 0xf0e8ec });
    kit.collide(0, 0, 2.4, 0.75);
    const T0 = 0.775;
    // main monitor
    at(-0.18, T0, -0.16, 0, () => {
      add('plastic', S.rbox(0.26, 0.012, 0.18, 0.006), { p: [0, 0.006, 0.02], color: WHITE });
      add('plastic', S.rbox(0.05, 0.3, 0.03, 0.01), { p: [0, 0.16, -0.02], color: WHITE });
      add('plastic', S.rbox(0.76, 0.45, 0.035, 0.012), { p: [0, 0.37, 0], color: 0xf4f0f2 });
      add('plastic', S.rbox(0.3, 0.2, 0.03, 0.02), { p: [0, 0.37, -0.03], color: 0xe8e2e6 });
      pic(A.monitorStream(), 0.72, 0.405, { p: [0, 0.378, 0.0185], basic: true, emit: 1.25 });
      pic(A.stickyNotes(), 0.2, 0.1, { p: [-0.29, 0.18, 0.02], transparent: true, alphaTest: 0.1 });
      // webcam on top
      add('plastic', S.rbox(0.09, 0.03, 0.03, 0.012), { p: [0, 0.61, 0.005], color: 0x1a1a20 });
      add('gloss', S.cyl(0.011, 0.011, 0.006, 16), { p: [0, 0.61, 0.021], r: [Math.PI / 2, 0, 0], color: 0x05050a });
      add('emit', S.sphere(0.0025, 6, 4), { p: [0.03, 0.61, 0.021], color: 0xffffff, emit: 2, ao: false });
    });
    // vertical side monitor, angled to the chair
    at(0.6, T0, -0.12, -0.38, () => {
      add('plastic', S.rbox(0.2, 0.012, 0.16, 0.006), { p: [0, 0.006, 0], color: WHITE });
      add('plastic', S.rbox(0.04, 0.24, 0.03, 0.01), { p: [0, 0.13, -0.03], color: WHITE });
      add('plastic', S.rbox(0.36, 0.62, 0.03, 0.01), { p: [0, 0.52, 0], color: 0xf4f0f2 });
      pic(A.monitorSide(), 0.33, 0.58, { p: [0, 0.52, 0.016], basic: true, emit: 1.2 });
    });
    // PC tower: white case, glass side facing the room center, pink fans
    at(-0.96, T0, -0.12, 0, () => {
      const w = 0.22, h = 0.46, d = 0.44;
      add('gloss', S.rbox(w, h, d, 0.01), { p: [0, h / 2 + 0.02, 0], color: WHITE, ao: false });
      for (const s of [-1, 1]) for (const z of [-1, 1]) add('plastic', S.cyl(0.012, 0.012, 0.02, 8), { p: [s * 0.08, 0.01, z * 0.17], color: 0x2a2a2a });
      add('glass', S.plane(d - 0.03, h - 0.03), { p: [w / 2 + 0.002, h / 2 + 0.02, 0], r: [0, Math.PI / 2, 0], uv: 'keep', ao: false });
      // interior (seen through the glass): board, GPU, RAM, cooler
      add('plastic', S.box(0.01, h - 0.06, d - 0.06), { p: [-0.07, h / 2 + 0.02, 0], color: 0x1a1a22, ao: false });
      add('plastic', S.rbox(0.05, 0.05, 0.3, 0.006), { p: [0.0, 0.2, 0.02], color: 0xf4f0f4, ao: false });
      add('emitRGB', S.box(0.052, 0.006, 0.28), { p: [0.0, 0.176, 0.02], ao: false });
      for (let i = 0; i < 4; i++) add('emitRGB', S.box(0.008, 0.07, 0.006), { p: [-0.05, 0.36, -0.05 + i * 0.018], ao: false });
      add('metal', S.cyl(0.04, 0.04, 0.05, 20), { p: [-0.03, 0.34, 0.08], r: [0, 0, Math.PI / 2], color: 0xd8d0d8, ao: false });
      add('emitRGB', S.torus(0.036, 0.004, 6, 24), { p: [-0.002, 0.34, 0.08], r: [0, Math.PI / 2, 0], ao: false });
      for (let i = 0; i < 3; i++) { // front intake fans
        add('plastic', S.cyl(0.058, 0.058, 0.01, 24), { p: [0, 0.12 + i * 0.13, d / 2 - 0.02], r: [Math.PI / 2, 0, 0], color: 0x2a2030, ao: false });
        add('emitRGB', S.torus(0.056, 0.005, 6, 28), { p: [0, 0.12 + i * 0.13, d / 2 - 0.012], ao: false });
      }
      add('gloss', S.box(w - 0.02, h - 0.04, 0.006), { p: [0, h / 2 + 0.02, d / 2 + 0.001], color: 0xf8f4f6 }); // mesh front
      add('emit', S.cyl(0.004, 0.004, 0.003, 8), { p: [0.07, h - 0.01, d / 2 + 0.005], r: [Math.PI / 2, 0, 0], color: 0x9ad0ff, emit: 3, ao: false });
    });
    // keyboard (white, pink caps, underglow), mouse, desk mat with a big peach
    pic(art(512, 224, (g, w, h) => {
      g.fillStyle = '#f7c3d0'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#fff'; g.lineWidth = 6; g.strokeRect(6, 6, w - 12, h - 12);
      A.drawPeach(g, w * 0.82, h * 0.52, 60);
      g.fillStyle = '#e86a92'; g.font = '700 30px Kanit, sans-serif'; g.fillText('peachi', 24, h - 26);
    }), 0.92, 0.4, { p: [-0.05, T0 + 0.002, 0.16], r: [-Math.PI / 2, 0, 0], rough: 1 });
    at(-0.2, T0 + 0.003, 0.15, 0, () => {
      add('plastic', S.rbox(0.44, 0.022, 0.14, 0.008), { p: [0, 0.011, 0], color: WHITE });
      add('emitRGB', S.box(0.43, 0.004, 0.13), { p: [0, 0.002, 0], ao: false });
      for (let r = 0; r < 5; r++) for (let c = 0; c < 15; c++) {
        if (r === 0 && c % 5 === 4) continue;
        const wide = r === 4 && c >= 4 && c <= 9;
        if (r === 4 && c > 4 && c <= 9) continue;
        add('plastic', S.rbox(wide ? 0.13 : 0.022, 0.012, 0.022, 0.004), { p: [-0.195 + c * 0.0275 + (wide ? 0.055 : 0), 0.027, -0.052 + r * 0.026], color: (r + c) % 4 === 0 ? PINK2 : 0xfdf0f4, ao: false });
      }
    });
    at(0.2, T0 + 0.003, 0.2, -0.1, () => {
      add('plastic', S.sphere(0.03, 16, 10), { p: [0, 0.012, 0], s: [0.9, 0.55, 1.35], color: WHITE });
      add('emitRGB', S.box(0.004, 0.002, 0.02), { p: [0, 0.028, -0.02], ao: false });
    });
    add('plastic', cable([V(0.2, T0 + 0.01, 0.15), V(0.18, T0 + 0.004, 0.0), V(0.1, T0 + 0.003, -0.25), V(0.05, T0 - 0.02, -0.36)], 0.0025), { color: WHITE, ao: false });
    // stream deck
    at(0.33, T0, 0.02, -0.25, () => {
      add('plastic', S.rbox(0.12, 0.018, 0.085, 0.006), { p: [0, 0.02, 0], r: [0.3, 0, 0], color: 0x1c1a22 });
      const cols = [0xff5f95, 0x9ad0ff, 0xffd36b, 0x7cff9a, 0xc89aff];
      for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) add('emit', S.box(0.016, 0.004, 0.016), { p: [-0.042 + c * 0.021, 0.03 + r * 0.006 * 0.3, -0.021 + r * 0.021], r: [0.3, 0, 0], color: cols[(r * 5 + c) % 5], emit: 1.6, ao: false });
    });
    // microphone on a boom arm (clamped at the back left), pop filter
    const arm = [V(-0.62, T0, -0.3), V(-0.62, T0 + 0.08, -0.3), V(-0.58, T0 + 0.42, -0.18), V(-0.5, T0 + 0.52, -0.02), V(-0.46, T0 + 0.36, 0.1)];
    add('metal', S.rbox(0.06, 0.05, 0.06, 0.01), { p: [-0.62, T0 + 0.02, -0.3], color: 0x1a1a1e });
    add('metal', cable(arm, 0.009, 0, 40), { color: 0x2a2a30, ao: false });
    add('metal', S.sphere(0.018, 10, 8), { p: [-0.58, T0 + 0.42, -0.18], color: 0x1a1a1e });
    at(-0.46, T0 + 0.3, 0.1, 0.3, () => {
      add('metal', S.cyl(0.03, 0.028, 0.15, 20), { p: [0, 0, 0], color: 0xf4c8d4 });
      add('metalRough', S.cyl(0.031, 0.031, 0.07, 20), { p: [0, 0.045, 0], color: 0x3a3440 });
      add('metal', S.sphere(0.031, 16, 8, 0, TAU, 0, Math.PI / 2), { p: [0, 0.08, 0], color: 0x3a3440 });
      add('metal', S.torus(0.045, 0.004, 6, 20), { p: [0, 0.0, 0], r: [Math.PI / 2, 0, 0], color: 0x2a2a30 });
      add('metal', S.torus(0.075, 0.004, 6, 28), { p: [0, 0.05, 0.12], color: 0x2a2a30 });
      add('acrylic', S.circle(0.073, 28), { p: [0, 0.05, 0.12], color: 0x2a2030, ao: false });
    });
    // headphone stand (empty — they're missing) with the place-here glow ring
    at(0.72, T0, 0.02, 0, () => {
      add('metal', S.cyl(0.07, 0.075, 0.012, 24), { p: [0, 0.006, 0], color: 0xf4c8d4 });
      add('metal', S.cyl(0.008, 0.008, 0.3, 10), { p: [0, 0.16, 0], color: 0xf4c8d4 });
      add('metal', S.torus(0.05, 0.009, 8, 20, Math.PI), { p: [0, 0.31, 0], r: [0, Math.PI / 2, 0], color: 0xf4c8d4 });
      add('emit', S.torus(0.16, 0.006, 6, 40), { p: [0, 0.004, 0], r: [-Math.PI / 2, 0, 0], color: 0xff5fa8, emit: 2.5, ao: false });
    });
    // speakers, drinks, plush, pumpkin, succulent
    for (const x of [-0.69, 1.02]) at(x, T0, -0.2, x < 0 ? 0.2 : -0.25, () => {
      add('plastic', S.rbox(0.11, 0.17, 0.12, 0.015), { p: [0, 0.085, 0], color: WHITE });
      add('gloss', S.cyl(0.035, 0.035, 0.01, 20), { p: [0, 0.11, 0.061], r: [Math.PI / 2, 0, 0], color: 0x2a2530 });
      add('gloss', S.cyl(0.018, 0.018, 0.01, 16), { p: [0, 0.04, 0.061], r: [Math.PI / 2, 0, 0], color: 0x2a2530 });
    });
    at(0.95, T0, 0.2, 0, () => P.can(0xff5f95, 0xffffff));
    at(0.52, T0, 0.26, 0, () => P.mug(0xffd6e2));
    at(-0.72, T0, 0.18, 0.4, () => P.pumpkin(0.07));
    at(1.05, T0, -0.05, -0.4, () => P.plush('cat', 0xffc0d4));
    at(-0.52, T0, 0.24, 0, () => {
      add('gloss', S.cyl(0.045, 0.038, 0.07, 16), { p: [0, 0.035, 0], color: 0xffffff });
      for (let i = 0; i < 7; i++) { const a = i / 7 * TAU; add('plastic', S.sphere(0.018, 8, 6), { p: [Math.cos(a) * 0.022, 0.08, Math.sin(a) * 0.022], s: [0.8, 1.4, 0.8], r: [Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5], color: 0x7cbf8a }); }
    });
  });
  const deskPosition = V(DESK.x + 0.72, DESK.top, DESK.z + 0.02);
  lights.push({ color: 0x9ab8ff, intensity: 1.3, dist: 3.4, p: [-5.7, 1.25, -5.95], kind: 'screen' });

  // wall above the desk: neon word + neon peach outline, floating shelves with plushies and figures
  pic(A.neonSign(), 1.5, 0.375, { p: [-5.7, 2.12, -6.86], basic: true, transparent: true, emit: 3.2 });
  add('acrylic', S.rbox(1.56, 0.42, 0.012, 0.02), { p: [-5.7, 2.12, -6.875], ao: false });
  {
    const pts = [];
    for (let i = 0; i < 64; i++) {
      const a = i / 64 * TAU, r = 0.21;
      const notch = 0.05 * Math.exp(-((Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2))) ** 2) * 30);
      pts.push(V(-7.0 + Math.cos(a) * (r - notch * 0.3), 1.92 + Math.sin(a) * (r - notch), -6.86));
    }
    add('emit', S.tube(pts, 0.009, 128, 6, true), { color: 0xffa0b0, emit: 3.2, ao: false });
    add('emit', S.tube([V(-6.98, 2.11, -6.86), V(-6.9, 2.19, -6.86), V(-6.82, 2.2, -6.86), V(-6.86, 2.15, -6.86), V(-6.98, 2.11, -6.86)], 0.008, 32, 6, true), { color: 0x8aff9a, emit: 2.6, ao: false });
    add('emit', S.tube([V(-7.0, 1.73, -6.86), V(-7.03, 1.9, -6.86), V(-7.0, 2.08, -6.86)], 0.007, 24, 6), { color: 0xffc8d0, emit: 2.2, ao: false });
  }
  for (const [x, items] of [[-6.95, ['bear', 'pumpkin']], [-4.3, ['cat', 'figure']]]) at(x, 1.5, -6.9, 0, () => {
    P.wallShelf(0.62, 0.2, WHITE);
    at(-0.15, 0.0125, 0.1, 0.2, () => (items[0] === 'bear' ? P.plush('bear', 0xffc8d8) : P.plush('cat', 0xfff0f4)));
    at(0.16, 0.0125, 0.1, -0.2, () => {
      if (items[1] === 'pumpkin') P.pumpkin(0.07);
      else { // little anime figure on a clear base
        add('acrylic', S.cyl(0.04, 0.04, 0.008, 20), { p: [0, 0.004, 0], color: 0xffffff });
        add('plastic', S.cone(0.035, 0.08, 12), { p: [0, 0.05, 0], color: 0x6a4ac8 });
        add('plastic', S.sphere(0.022, 12, 10), { p: [0, 0.105, 0], color: 0xffe0d4 });
        add('plastic', S.sphere(0.025, 12, 10, 0, TAU, 0, Math.PI * 0.6), { p: [0, 0.11, -0.003], color: 0x9ad0ff });
        add('plastic', S.cyl(0.006, 0.004, 0.08, 6), { p: [0.02, 0.08, -0.01], r: [0, 0, -0.3], color: 0x9ad0ff });
      }
    });
  });

  // =========================================================== gaming chair (pink/white, cat ears)
  at(-5.62, 0, -5.5, Math.PI + 0.12, () => {
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * TAU;
      at(0, 0.075, 0, a, () => {
        add('plastic', S.rbox(0.05, 0.035, 0.32, 0.012), { p: [0, 0, 0.16], r: [0.08, 0, 0], color: 0xf4f0f2 });
        add('plastic', S.cyl(0.024, 0.024, 0.03, 12), { p: [0, -0.045, 0.3], r: [0, 0, Math.PI / 2], color: 0x2a2a30 });
        add('plastic', S.box(0.035, 0.03, 0.03), { p: [0, -0.02, 0.3], color: 0xf4f0f2 });
      });
    }
    add('metal', S.cyl(0.022, 0.022, 0.22, 12), { p: [0, 0.2, 0], color: 0xc8c8cc });
    add('plastic', S.cyl(0.035, 0.05, 0.12, 12), { p: [0, 0.14, 0], color: 0x2a2a30 });
    add('plastic', S.rbox(0.36, 0.05, 0.36, 0.01), { p: [0, 0.33, 0], color: 0x2a2a30 });
    add('fabric', S.rbox(0.5, 0.1, 0.5, 0.04, 3), { p: [0, 0.4, 0.02], color: WHITE });
    add('fabric', S.rbox(0.3, 0.012, 0.44, 0.005), { p: [0, 0.452, 0.02], color: PINK2 });
    for (const s of [-1, 1]) add('fabric', S.rbox(0.07, 0.07, 0.48, 0.03), { p: [s * 0.23, 0.46, 0.02], color: WHITE });
    at(0, 0.45, -0.22, 0, () => {
      add('fabric', S.rbox(0.52, 0.86, 0.1, 0.05, 3), { p: [0, 0.43, 0], color: WHITE });
      add('fabric', S.rbox(0.28, 0.6, 0.012, 0.01), { p: [0, 0.4, 0.052], color: PINK2 });
      for (const s of [-1, 1]) add('fabric', S.rbox(0.07, 0.5, 0.14, 0.03), { p: [s * 0.24, 0.52, 0.03], r: [0, -s * 0.25, 0], color: WHITE });
      add('fabric', pillow(0.26, 0.09, 0.15), { p: [0, 0.76, 0.08], r: [-1.35, 0, 0], color: PINK2 });
      add('plush', roundCushion(0.13, 0.07, { cleft: true }), { p: [0, 0.2, 0.08], r: [-0.1, 0, 0], color: 0xffb3a0 });
      for (const s of [-1, 1]) { // cat ears
        add('fabric', S.cone(0.08, 0.14, 16), { p: [s * 0.16, 0.9, 0], r: [0, 0, -s * 0.3], s: [1, 1, 0.45], color: PINK2 });
        add('fabric', S.cone(0.05, 0.09, 14), { p: [s * 0.155, 0.88, 0.022], r: [0, 0, -s * 0.3], s: [1, 1, 0.3], color: WHITE });
      }
      // a witch hat hung on one ear
      at(0.2, 1.0, 0.02, 0, () => {
        add('fabric', S.cyl(0.15, 0.15, 0.01, 28), { color: 0x1a1024 });
        add('fabric', S.cone(0.08, 0.26, 24), { p: [0.02, 0.13, 0], r: [0, 0, -0.35], color: 0x1a1024 });
        add('fabric', S.cyl(0.082, 0.082, 0.03, 24), { p: [0, 0.02, 0], color: 0x8a4ac8 });
      }, 0, -0.35);
    }, -0.12);
    for (const s of [-1, 1]) {
      add('plastic', S.rbox(0.04, 0.2, 0.06, 0.01), { p: [s * 0.3, 0.52, -0.02], color: 0x2a2a30 });
      add('plastic', S.rbox(0.08, 0.03, 0.24, 0.012), { p: [s * 0.3, 0.63, 0.0], color: 0x2a2a30 });
    }
    kit.collide(0, 0, 0.62, 0.62);
  });

  // ring light on a tripod, turned toward the chair
  at(-4.05, 0, -6.2, -0.7, () => {
    for (let i = 0; i < 3; i++) { const a = i / 3 * TAU; add('metal', cable([V(Math.cos(a) * 0.32, 0, Math.sin(a) * 0.32), V(0, 0.55, 0)], 0.008), { color: 0x1a1a1e }); }
    add('metal', S.cyl(0.011, 0.011, 1.0, 10), { p: [0, 1.05, 0], color: 0x1a1a1e });
    add('emit', S.torus(0.23, 0.022, 10, 48), { p: [0, 1.58, 0.02], color: 0xfff0f4, emit: 2.4, ao: false });
    add('plastic', S.torus(0.23, 0.026, 8, 48), { p: [0, 1.58, -0.006], color: 0xf4f0f2, ao: false });
    add('plastic', S.rbox(0.07, 0.13, 0.01, 0.01), { p: [0, 1.58, 0.02], color: 0x1a1a20 });
    add('haze', S.circle(0.34, 32), { p: [0, 1.58, 0.05], color: 0xffd0e0, emit: 0.05, ao: false });
    kit.collide(0, 0, 0.4, 0.4);
  });

  // =========================================================== keyboard on an X-stand by the window
  at(-9.05, 0, -3.25, Math.PI / 2, () => {
    for (const s of [-1, 1]) at(s * 0.42, 0, 0, 0, () => {
      add('metal', S.cyl(0.013, 0.013, 0.85, 10), { p: [0, 0.37, 0], r: [0.72, 0, 0], color: 0x1a1a1e });
      add('metal', S.cyl(0.013, 0.013, 0.85, 10), { p: [0, 0.37, 0], r: [-0.72, 0, 0], color: 0x1a1a1e });
      add('metal', S.cyl(0.018, 0.018, 0.02, 10), { p: [0, 0.37, 0], r: [0, 0, Math.PI / 2], color: 0x4a4a50 });
      for (const z of [-1, 1]) add('plastic', S.rbox(0.03, 0.02, 0.05, 0.008), { p: [0, 0.01, z * 0.27], color: 0x111111 });
    });
    for (const z of [-0.2, 0.2]) add('metal', S.cyl(0.012, 0.012, 1.0, 10), { p: [0, 0.69, z * 0.8], r: [0, 0, Math.PI / 2], color: 0x1a1a1e });
    at(0, 0.71, 0, 0, () => {
      add('plastic', S.rbox(1.2, 0.09, 0.33, 0.02), { p: [0, 0.045, 0], color: WHITE });
      add('plastic', S.rbox(1.12, 0.012, 0.1, 0.004), { p: [0, 0.092, -0.1], color: 0x1c1a20 });
      for (let i = 0; i < 6; i++) add('metal', S.cyl(0.01, 0.01, 0.012, 12), { p: [-0.5 + i * 0.05, 0.1, -0.1], color: 0xd0c8cc });
      pic(art(128, 32, (g, w, h) => { g.fillStyle = '#0a1a2a'; g.fillRect(0, 0, w, h); g.fillStyle = '#7ad0ff'; g.font = '600 20px Kanit, sans-serif'; g.fillText('PIANO 01', 8, 23); }), 0.1, 0.025, { p: [0.1, 0.0985, -0.1], r: [-Math.PI / 2, 0, 0], basic: true, emit: 1.5 });
      const nWhite = 36, kw = 1.08 / nWhite;
      for (let i = 0; i < nWhite; i++) add('plastic', S.box(kw - 0.002, 0.02, 0.14), { p: [-0.54 + kw * (i + 0.5), 0.08, 0.08], color: 0xfdfcfb, ao: false });
      for (let i = 0; i < nWhite - 1; i++) {
        const n = i % 7; if (n === 2 || n === 6) continue;
        add('gloss', S.box(kw * 0.55, 0.018, 0.085), { p: [-0.54 + kw * (i + 1), 0.098, 0.05], color: 0x141216, ao: false });
      }
      // music rest with a sheet
      add('acrylic', S.box(0.6, 0.24, 0.006), { p: [0, 0.2, -0.13], r: [-0.25, 0, 0], color: 0xffffff });
      pic(art(128, 180, (g, w, h) => { g.fillStyle = '#fbf8f2'; g.fillRect(0, 0, w, h); g.strokeStyle = '#3a3030'; g.lineWidth = 1; for (let s = 0; s < 5; s++) for (let l = 0; l < 5; l++) { g.beginPath(); g.moveTo(8, 30 + s * 30 + l * 4); g.lineTo(w - 8, 30 + s * 30 + l * 4); g.stroke(); } g.fillStyle = '#3a3030'; for (let k = 0; k < 40; k++) { g.beginPath(); g.ellipse(14 + (k * 29) % 106, 34 + Math.floor(k / 8) * 30 + (k * 7) % 12, 3, 2.2, -0.4, 0, TAU); g.fill(); } g.font = '600 12px Kanit, sans-serif'; g.fillText('เพลงกล่อมผี', 30, 16); }), 0.2, 0.28, { p: [0, 0.21, -0.125], r: [-0.25, 0, 0] });
    });
    // bench and the sustain pedal
    at(0, 0, 0.6, 0, () => {
      add('fabric', S.rbox(0.62, 0.08, 0.32, 0.03), { p: [0, 0.5, 0], color: PINK });
      P.legs4('paint', 0.58, 0.28, 0.46, 0.018, WHITE, 0.01);
      kit.collide(0, 0, 0.62, 0.32);
    });
    add('plastic', S.rbox(0.08, 0.03, 0.2, 0.01), { p: [0.2, 0.015, 0.32], r: [0.12, 0, 0], color: 0x1a1a1e });
    add('plastic', cable([V(0.2, 0.02, 0.22), V(0.3, 0.005, 0.0), V(0.35, 0.3, -0.12), V(0.4, 0.72, -0.14)], 0.003), { color: 0x1a1a1e, ao: false });
    kit.collide(0, 0, 1.2, 0.4);
  });

  // =========================================================== window: blinds, sheer curtains, rod
  at(-9.9, 0, -4.0, Math.PI / 2, () => {
    const W = 2.55, top = 2.47, bottom = 0.72, tilt = 0.72;
    add('paint', S.rbox(W, 0.05, 0.07, 0.01), { p: [0, top, 0.08], color: WHITE });
    for (let y = top - 0.04; y > bottom; y -= 0.042) add('paint', S.box(W - 0.04, 0.003, 0.052), { p: [0, y, 0.08], r: [tilt, 0, 0], color: 0xfbfbfb });
    add('paint', S.rbox(W - 0.02, 0.02, 0.05, 0.006), { p: [0, bottom - 0.01, 0.08], color: WHITE });
    for (const x of [-0.8, 0, 0.8]) add('paint', S.box(0.004, top - bottom, 0.004), { p: [x, (top + bottom) / 2, 0.106], color: 0xf0ece8, ao: false });
    add('paint', cable([V(1.1, top, 0.1), V(1.12, 1.6, 0.1), V(1.12, 1.25, 0.1)], 0.003), { color: 0xf0ece8, ao: false });
    add('plastic', S.cyl(0.01, 0.006, 0.05, 8), { p: [1.12, 1.23, 0.1], color: 0xf0ece8 });
    // curtain rod and sheer curtains gathered at the sides
    add('metal', S.cyl(0.012, 0.012, 3.1, 12), { p: [0, 2.6, 0.18], r: [0, 0, Math.PI / 2], color: GOLD });
    for (const s of [-1, 1]) {
      add('metal', S.sphere(0.03, 12, 10), { p: [s * 1.57, 2.6, 0.18], color: GOLD });
      add('metal', S.cyl(0.008, 0.008, 0.16, 8), { p: [s * 1.45, 2.6, 0.1], r: [Math.PI / 2, 0, 0], color: GOLD });
      add('sheer', drapeGeo(0.55, 2.52, 7, 0.04), { p: [s * 1.25, 0.06, 0.2], uv: 'keep', color: 0xfff4f8, ao: false });
      for (let i = 0; i < 7; i++) add('metal', S.torus(0.018, 0.003, 6, 12), { p: [s * (1.02 + i * 0.075), 2.6, 0.18], r: [0, Math.PI / 2, 0], color: GOLD, ao: false });
    }
    // fairy lights along the top of the window
    P.fairyLights(V(-1.4, 2.5, 0.2), V(1.4, 2.5, 0.2), 22, 0.14, [0xffc878, 0xffa0c8], 4);
  });
  // macrame hanging plants either side of the window
  for (const z of [-5.55, -2.45]) at(-9.45, 0, z, 0, () => {
    add('metal', S.torus(0.02, 0.004, 6, 12), { p: [0, 2.74, 0], color: GOLD });
    const top = V(0, 2.72, 0), rim = 1.82;
    for (let i = 0; i < 4; i++) {
      const a = i / 4 * TAU + 0.4;
      const mid = V(Math.cos(a) * 0.07, 2.2, Math.sin(a) * 0.07), end = V(Math.cos(a) * 0.11, rim, Math.sin(a) * 0.11);
      add('fabric', cable([top, mid, end], 0.006), { color: 0xf4ead8, ao: false });
      add('fabric', S.sphere(0.014, 8, 6), { p: [mid.x, mid.y, mid.z], color: 0xf4ead8, ao: false });
    }
    add('gloss', S.lathe([[0, 1.66], [0.08, 1.67], [0.12, 1.74], [0.125, 1.83], [0.115, 1.83], [0, 1.8]], 20), { color: 0xfbf2ee, ao: false });
    let seed = Math.abs(z * 100) | 0;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let v = 0; v < 7; v++) { // trailing pothos vines with heart-shaped leaves
      const a = v / 7 * TAU + rnd(), len = 0.45 + rnd() * 0.55;
      const pts = [V(Math.cos(a) * 0.1, 1.83, Math.sin(a) * 0.1), V(Math.cos(a) * 0.17, 1.72, Math.sin(a) * 0.17), V(Math.cos(a) * 0.19, 1.83 - len * 0.6, Math.sin(a) * 0.19), V(Math.cos(a) * 0.2 + (rnd() - 0.5) * 0.08, 1.83 - len, Math.sin(a) * 0.2)];
      const curve = new THREE.CatmullRomCurve3(pts);
      add('plastic', new THREE.TubeGeometry(curve, 24, 0.0025, 4), { color: 0x4a7a3a, ao: false });
      for (let k = 1; k < 9; k++) {
        const t = k / 9, p = curve.getPointAt(t);
        at(p.x, p.y, p.z, a + (k % 2 ? 0.9 : -0.9), () => add('plastic', S.extrude(heartShape(0.022), 0.002, 0, 6), { r: [0.5, 0, Math.PI], color: new THREE.Color(0x3f9a4a).lerp(new THREE.Color(0xa8d860), rnd() * 0.6), ao: false }));
      }
    }
  });

  // =========================================================== east wall: cube shelf + bear, gallery, dresser + mirror
  at(-2.3, 0, -5.55, -Math.PI / 2, () => {
    const w = 1.12, h = 1.12, d = 0.36, t = 0.025, c = (w - t) / 3;
    add('paint', S.box(w, h, 0.008), { p: [0, h / 2, -d / 2 + 0.004], color: 0xf2e8ec }); // back
    for (let i = 0; i <= 3; i++) {
      add('paint', S.rbox(t, h, d, 0.004), { p: [-w / 2 + t / 2 + c * i, h / 2, 0], color: WHITE });
      add('paint', S.rbox(w, t, d, 0.004), { p: [0, t / 2 + c * i, 0], color: WHITE });
    }
    const cub = (i, j) => [-w / 2 + t / 2 + c * (i + 0.5), t / 2 + c * j + t / 2, 0];
    const fill = [
      (x, y) => add('fabric', S.rbox(c - 0.05, c - 0.06, d - 0.06, 0.02), { p: [x, y + (c - 0.06) / 2, 0.02], color: PINK }),
      (x, y) => P.books(x - c / 2 + 0.03, x + c / 2 - 0.03, y, 0.22, 7, { palette: [0xff8cb4, 0xfff0f4, 0xc8a0ff, 0x9ad0ff, 0xffd36b] }),
      (x, y) => add('fabric', S.rbox(c - 0.05, c - 0.06, d - 0.06, 0.02), { p: [x, y + (c - 0.06) / 2, 0.02], color: 0xfbf2f4 }),
      (x, y) => at(x, y, 0.05, 0, () => P.plush('bear', 0xffd0dc)),
      (x, y) => { for (let k = 0; k < 9; k++) add('paint', S.box(0.004, 0.3, 0.3), { p: [x - 0.14 + k * 0.012, y + 0.15, 0.0], color: [0x1a1a1e, 0xff8cb4, 0x2a2a30][k % 3] }); },
      (x, y) => at(x, y, 0.05, 0, () => P.plant('snake', 0xfbf2ee, 0.6)),
      (x, y) => P.books(x - c / 2 + 0.03, x + c / 2 - 0.03, y, 0.22, 3),
      (x, y) => at(x, y, 0.05, 0.3, () => P.pumpkin(0.08)),
      (x, y) => at(x, y, 0.02, 0, () => { add('paint', S.rbox(0.18, 0.24, 0.1, 0.006), { p: [0, 0.12, 0], color: 0xffe0ea }); pic(A.peachiPoster(), 0.13, 0.19, { p: [0, 0.13, 0.051] }); }),
    ];
    let k = 0;
    for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) { const [x, y] = cub(i, j); fill[k++](x, y); }
    kit.collide(0, 0, w, d);
    // bear figure on top (two-tone, glossy vinyl), wearing a tiny witch hat
    at(0.15, h, 0, 0, () => {
      const B = 0xffffff, Pk = 0xff9ec0;
      add('gloss', S.rbox(0.075, 0.13, 0.09, 0.03), { p: [-0.045, 0.065, 0], color: B });
      add('gloss', S.rbox(0.075, 0.13, 0.09, 0.03), { p: [0.045, 0.065, 0], color: Pk });
      add('gloss', S.rbox(0.19, 0.17, 0.13, 0.05), { p: [0, 0.21, 0], color: (p, n, c) => c.set(p.z < 0 ? B : Pk) });
      for (const s of [-1, 1]) add('gloss', S.rbox(0.05, 0.15, 0.06, 0.022), { p: [s * 0.12, 0.2, 0], r: [0, 0, s * 0.12], color: s < 0 ? B : Pk });
      add('gloss', S.rbox(0.25, 0.22, 0.21, 0.09, 3), { p: [0, 0.41, 0], color: B });
      for (const s of [-1, 1]) add('gloss', S.cyl(0.05, 0.05, 0.035, 20), { p: [s * 0.1, 0.53, 0], r: [Math.PI / 2, 0, 0], color: Pk });
      add('gloss', S.sphere(0.014, 10, 8), { p: [-0.05, 0.43, 0.106], color: 0x1a1014 });
      add('gloss', S.sphere(0.014, 10, 8), { p: [0.05, 0.43, 0.106], color: 0x1a1014 });
      add('gloss', S.sphere(0.03, 12, 8), { p: [0, 0.38, 0.1], s: [1.2, 0.8, 0.6], color: Pk });
      add('gloss', S.extrude(heartShape(0.035), 0.01, 0.004, 8), { p: [0.0, 0.22, 0.068], color: 0xff5f95 });
      at(0.02, 0.52, 0, 0, () => {
        add('fabric', S.cyl(0.12, 0.12, 0.008, 24), { color: 0x1a1024 });
        add('fabric', S.cone(0.065, 0.2, 20), { p: [0.015, 0.1, 0], r: [0, 0, -0.3], color: 0x1a1024 });
        add('fabric', S.cyl(0.066, 0.066, 0.025, 20), { p: [0, 0.016, 0], color: 0x8a4ac8 });
      }, 0, -0.15);
    });
  });
  // gallery: calendar, poster, polaroids, clock
  at(-2.1, 0, -4.45, -Math.PI / 2, () => {
    pic(A.thaiCalendar(), 0.3, 0.42, { p: [-0.35, 1.52, 0.003] });
    add('metal', S.cyl(0.004, 0.004, 0.02, 6), { p: [-0.35, 1.745, 0.01], r: [Math.PI / 2, 0, 0], color: 0x888888 });
    at(0.2, 1.62, 0, 0, () => framed(A.peachiPoster(), 0.42, 0.6, { frame: WHITE, mat: 'paint' }));
    at(0.72, 1.82, 0, 0, () => framed(A.familyPhoto(3), 0.22, 0.17, { frame: GOLD, mat: 'metal', tilt: 0.04 }));
    at(0.72, 1.48, 0, 0, () => framed(A.familyPhoto(8, true), 0.22, 0.17, { frame: WHITE, mat: 'paint', tilt: -0.06 }));
  });
  at(-2.33, 0, -3.0, -Math.PI / 2, () => { // dresser with a round mirror
    P.cabinet(1.2, 0.8, 0.45, { color: WHITE, mat: 'paint', rows: [{ h: 1, kind: 'drawer' }, { h: 1, kind: 'drawer' }, { h: 1, kind: 'drawer' }], top: { mat: 'gloss', color: 0xfbf4f6, t: 0.03 }, handle: 'knob', hColor: GOLD, plinth: 0.06 });
    at(0, 0, -0.225, 0, () => {
      add('mirror', S.circle(0.34, 48), { p: [0, 1.42, 0.02], color: 0xe8e4ec, uv: 'keep', ao: false });
      add('metal', S.torus(0.35, 0.018, 10, 64), { p: [0, 1.42, 0.02], color: GOLD, ao: false });
    });
    const T0 = 0.83;
    for (const [x, c, h] of [[-0.45, 0xffc0d8, 0.12], [-0.38, 0xd8c0ff, 0.09], [-0.31, 0xfff0c0, 0.1]]) at(x, T0, -0.05, 0, () => P.bottle(h, 0.028, c, GOLD, 'glass'));
    at(-0.1, T0, 0.0, 0.2, () => { add('plastic', S.rbox(0.18, 0.09, 0.12, 0.015), { p: [0, 0.045, 0], color: PINK2 }); add('metal', S.box(0.03, 0.02, 0.01), { p: [0, 0.07, 0.061], color: GOLD }); });
    at(0.2, T0, -0.05, 0, () => P.candle(0.1, 0.03, 0xfff0e8, true));
    at(0.32, T0, 0.02, -0.3, () => P.candle(0.07, 0.025, 0xffd0dc, true));
    at(0.45, T0, -0.05, -0.2, () => P.pumpkin(0.09));
  });
  for (const [z, y, s] of [[-3.5, 2.25, 1], [-3.1, 2.42, 0.8], [-2.6, 2.3, 1.2]]) at(-2.1, y, z, -Math.PI / 2, () => P.bat(s));

  // =========================================================== floor: peach rug, beanbag, clutter, plant
  at(-6.35, 0, -3.65, 0.3, () => {
    const pk = new THREE.Shape();
    pk.absarc(0, 0, 0.8, Math.PI / 2 + 0.2, Math.PI / 2 - 0.2 + TAU, false);
    pk.quadraticCurveTo(0, 0.7, -0.8 * Math.sin(0.2), 0.8 * Math.cos(0.2));
    add('fabric', S.extrude(pk, 0.012, 0.006, 48), { p: [0, 0.009, 0], r: [-Math.PI / 2, 0, 0], color: (p, n, c) => c.set(0xffc2b0).lerp(new THREE.Color(0xff8fae), Math.max(0, Math.min(1, (p.z + 3.65 + 0.5) / 1.5))), ao: false });
    const leaf = new THREE.Shape(); leaf.moveTo(0, 0); leaf.quadraticCurveTo(0.25, 0.12, 0.5, 0); leaf.quadraticCurveTo(0.25, -0.12, 0, 0);
    add('fabric', S.extrude(leaf, 0.012, 0.004, 16), { p: [0.08, 0.009, -0.78], r: [-Math.PI / 2, 0, 0.35], color: 0x7ccf7a, ao: false });
  });
  at(-7.45, 0, -2.25, 0.6, () => {
    add('plush', beanbag(0.46), { color: 0xf598b8 });
    at(0.02, 0.36, 0.05, 0.2, () => P.plush('ghost', 0xf4f2ff));
    kit.collide(0, 0, 0.8, 0.8);
  });
  at(-5.4, 0, -3.1, -0.4, () => add('plush', roundCushion(0.22, 0.08, { cleft: true }), { p: [0, 0.06, 0], r: [-Math.PI / 2, 0, 0], color: 0xffb8a4 }));
  at(-6.6, 0.005, -2.2, 0.8, () => { // chips bag, magazines, controller, candy bowl
    add('plastic', pillow(0.22, 0.06, 0.3, { seed: 7, wrinkle: 0.02 }), { p: [0, 0.03, 0], color: 0xffb020 });
    for (let i = 0; i < 3; i++) pic(A.animePoster(200 + i * 60, ['STAR', 'IDOL', 'MOON'][i]), 0.21, 0.29, { p: [0.35 + i * 0.07, 0.004 + i * 0.002, 0.25 + i * 0.05], r: [-Math.PI / 2, 0, 0.3 + i * 0.4] });
    at(-0.35, 0, 0.3, 0.5, () => {
      add('plastic', S.rbox(0.15, 0.03, 0.08, 0.02), { p: [0, 0.02, 0], color: WHITE });
      for (const s of [-1, 1]) add('plastic', S.sphere(0.035, 10, 8), { p: [s * 0.065, 0.02, 0.03], s: [1, 0.6, 1.2], color: WHITE });
      add('emit', S.box(0.03, 0.002, 0.004), { p: [0, 0.036, -0.03], color: 0xff5fa8, emit: 2, ao: false });
    });
  });
  at(-6.9, 0, -4.3, 0, () => { // candy bowl on the rug
    add('gloss', S.lathe([[0, 0], [0.08, 0], [0.13, 0.05], [0.15, 0.09], [0.14, 0.09], [0.11, 0.05], [0, 0.015]], 24), { color: 0x1a1024 });
    for (let i = 0; i < 16; i++) { const a = i * 2.4, r = (i % 4) * 0.025; add('gloss', S.sphere(0.018, 8, 6), { p: [Math.cos(a) * r, 0.06 + (i % 3) * 0.01, Math.sin(a) * r], s: [1.4, 0.8, 0.8], r: [0, a, 0], color: [0xff7a1a, 0x9a4ac8, 0x7cff9a, 0xff5f95][i % 4] }); }
  });
  at(-2.55, 0, -1.55, 0.4, () => P.plant('monstera', 0xfbf2ee, 1.6));
  kit.collide(-2.55, -1.55, 0.4, 0.4);

  // =========================================================== fairy lights + polaroids above the bed, cobwebs
  {
    const a = V(-9.75, 2.05, -6.86), b = V(-6.85, 2.05, -6.86);
    P.fairyLights(a, b, 26, 0.3, [0xffc878, 0xff9ac8, 0xffe0a0], 4);
    for (let i = 1; i < 6; i++) {
      const t = i / 6, p = new THREE.Vector3().lerpVectors(a, b, t); p.y -= 0.3 * 4 * t * (1 - t) + 0.1;
      at(p.x, p.y, p.z + 0.006, 0, () => {
        add('paint', S.box(0.09, 0.105, 0.002), { color: 0xfbfbf6, ao: false });
        pic(A.familyPhoto(i * 5, i === 3), 0.078, 0.07, { p: [0, 0.008, 0.0015] });
        add('plastic', S.box(0.012, 0.025, 0.006), { p: [0, 0.055, 0.002], color: 0xffc0d8 });
      }, 0, (i % 2 ? 0.08 : -0.06));
    }
  }
  at(-9.9 + 0.18, 2.8, -6.9 + 0.18, Math.PI / 4, () => P.cobweb(0.56), 0.3);
  at(-2.1 - 0.18, 2.8, -1.1 - 0.18, -Math.PI * 3 / 4, () => P.cobweb(0.56), 0.3);

  // lights
  lights.push({ color: 0xff4fc0, intensity: 3.0, dist: 8.5, p: [-6.0, 2.55, -4.0], kind: 'rgb' });

  return {
    lights,
    deskPosition,
    spawn: { position: V(-5.1, 0, -2.5), yaw: 0.35 },
    itemSpots: [V(-7.9, 0.62, -5.2), V(-2.55, 0.86, -3.3), V(-9.0, 0.95, -3.3)],
    navPoints: [V(-7.2, 0, -3.6), V(-4.2, 0, -2.4), V(-6.0, 0, -4.6)],
    update(dt, t) { for (const f of anim) f(dt, t); },
  };
}
