// Living room (x 3..10, z 1..7): sofa under the window, coffee table with a spirit board and snacks, TV of
// static on a low cabinet, armchair with a skeleton holding the remote, arc lamp, bookcase, standing fan,
// and the spirit house in the corner with red soda, jasmine garlands, zebra figurines and incense.
import * as THREE from 'three';
import { shapes as S } from './kit.js';
import { pillow, cable, sheetOver, duvet, roundCushion } from './soft.js';
import * as A from './art.js';
import { art } from './tex.js';

const TAU = Math.PI * 2;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const SOFA = 0x6a4a78, WOOD = 0x6a4028, BONE = 0xefe8d8, GOLD = 0xd8b060;

export function roomLiving(P, kit, M, root) {
  const { add, at, pic, framed } = P;
  const lights = [], anim = [];

  at(6.5, 0, 4.35, 0, () => P.rug(A.livingRug(), 2.6, 1.75, { y: 0.004 }));

  // ---------------------------------------------------------------- sofa (south wall, under the window)
  at(6.5, 0, 6.42, Math.PI, () => {
    const W = 2.3, D = 0.9;
    add('fabric', S.rbox(W, 0.28, D, 0.05, 3), { p: [0, 0.24, 0], color: SOFA });
    add('fabric', S.rbox(W - 0.1, 0.5, 0.22, 0.08, 3), { p: [0, 0.62, -D / 2 + 0.12], color: SOFA });
    for (const s of [-1, 1]) add('fabric', S.rbox(0.2, 0.36, D, 0.08, 3), { p: [s * (W / 2 - 0.1), 0.52, 0], color: SOFA });
    for (let i = 0; i < 3; i++) {
      add('fabric', pillow(0.62, 0.16, 0.66, { seed: i }), { p: [-0.64 + i * 0.64, 0.45, 0.06], color: 0x7a5a88 });
      add('fabric', pillow(0.6, 0.18, 0.42, { seed: i + 3 }), { p: [-0.64 + i * 0.64, 0.72, -0.24], r: [-1.25, 0, 0], color: 0x7a5a88 });
    }
    for (const s of [-1, 1]) for (const z of [-1, 1]) add('wood', S.cyl(0.025, 0.018, 0.1, 10), { p: [s * (W / 2 - 0.1), 0.05, z * (D / 2 - 0.1)], color: 0x2a1a10 });
    add('fabric', pillow(0.42, 0.13, 0.42, { seed: 7 }), { p: [-0.85, 0.72, -0.06], r: [-1.0, 0.3, 0], color: 0xff9ec0 });
    add('fabric', pillow(0.4, 0.13, 0.4, { seed: 8 }), { p: [0.85, 0.72, -0.08], r: [-1.0, -0.4, 0.1], color: 0xff7a1a });
    add('plush', roundCushion(0.17, 0.07, { cleft: true }), { p: [0.45, 0.66, -0.05], r: [-0.5, 0, 0], color: 0xffb8a4 });
    add('fabric', duvet(0.8, 0.5, 0.32, { thick: 0.02, folds: 8 }), { p: [0.55, 0.555, 0.1], r: [0, 0.2, 0], color: 0xe8d8c8 });
    at(-0.3, 0.53, 0.05, 0.4, () => P.plush('cat', 0x2a2a30));
    kit.collide(0, 0, W, D);
  });
  P.bunting(V(5.3, 2.3, 6.86), V(7.7, 2.3, 6.86), 10);

  // ---------------------------------------------------------------- coffee table: spirit board, candles, snacks
  at(6.5, 0, 4.35, 0, () => {
    add('wood', S.rbox(1.15, 0.05, 0.62, 0.015), { p: [0, 0.42, 0], color: WOOD });
    add('wood', S.rbox(1.05, 0.03, 0.52, 0.01), { p: [0, 0.12, 0], color: WOOD });
    P.legs4('wood', 1.1, 0.58, 0.42, 0.025, 0x4a2a18, 0.02, 'box');
    const T0 = 0.445;
    pic(art(512, 340, (g, w, h) => { // Thai spirit board
      g.fillStyle = '#d8c8a0'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#3a2210'; g.lineWidth = 6; g.strokeRect(10, 10, w - 20, h - 20);
      g.fillStyle = '#3a2210'; g.textAlign = 'center'; g.font = '700 30px Kanit, sans-serif';
      g.fillText('ใช่', 70, 64); g.fillText('ไม่', w - 70, 64);
      const letters = 'กขคงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรลวศษสหฬอฮ';
      g.font = '600 26px Kanit, sans-serif';
      for (let i = 0; i < letters.length; i++) { const row = i < 22 ? 0 : 1, k = row ? i - 22 : i, n = row ? letters.length - 22 : 22; const a = Math.PI * (0.15 + 0.7 * k / (n - 1)); g.fillText(letters[i], w / 2 - Math.cos(a) * (row ? 150 : 210), 250 - Math.sin(a) * (row ? 100 : 150)); }
      g.font = '500 24px Mitr, sans-serif'; g.fillText('0 1 2 3 4 5 6 7 8 9', w / 2, 285); g.fillText('ลาก่อน', w / 2, 318);
    }), 0.62, 0.41, { p: [-0.12, T0 + 0.004, 0.0], r: [-Math.PI / 2, 0, 0.08], rough: 0.6 });
    at(-0.05, T0 + 0.006, 0.03, 0.5, () => { // planchette
      const hs = new THREE.Shape(); hs.moveTo(0, 0.07); hs.quadraticCurveTo(0.06, 0.02, 0.05, -0.05); hs.lineTo(-0.05, -0.05); hs.quadraticCurveTo(-0.06, 0.02, 0, 0.07);
      hs.holes.push(new THREE.Path().absarc(0, 0.0, 0.018, 0, TAU, true));
      add('wood', S.extrude(hs, 0.012, 0.004, 12), { r: [-Math.PI / 2, 0, 0], p: [0, 0.01, 0], color: 0x5a3420 });
    });
    for (const [x, z, h] of [[0.4, -0.18, 0.12], [0.48, -0.1, 0.08], [0.36, -0.04, 0.16]]) at(x, T0, z, 0, () => P.candle(h, 0.026, 0xf4ead8, true));
    at(0.38, T0, 0.16, 0, () => { add('gloss', S.lathe([[0, 0], [0.05, 0], [0.11, 0.05], [0.12, 0.07], [0.11, 0.07], [0, 0.015]], 24), { color: 0xffffff }); for (let i = 0; i < 12; i++) add('plastic', S.sphere(0.018, 8, 6), { p: [Math.cos(i * 2.2) * (i % 3) * 0.028, 0.05, Math.sin(i * 2.2) * (i % 3) * 0.028], s: [1.3, 0.7, 1], color: [0xffb020, 0xffd23a, 0xff8a2a][i % 3] }); });
    at(0.2, T0, 0.2, 0.3, () => P.can(0x3a7aff, 0xffffff));
    at(0.1, T0, -0.2, 1.2, () => { add('plastic', S.rbox(0.05, 0.02, 0.18, 0.01), { p: [0, 0.01, 0], color: 0x1a1a20 }); for (let i = 0; i < 6; i++) add('plastic', S.cyl(0.006, 0.006, 0.004, 8), { p: [0, 0.021, -0.06 + i * 0.022], color: i === 0 ? 0xff3030 : 0x5a5a60 }); });
    kit.collide(0, 0, 1.15, 0.62);
  });
  lights.push({ color: 0xffa050, intensity: 1.2, dist: 3, p: [6.9, 0.75, 4.2], kind: 'candle' });

  // ---------------------------------------------------------------- TV wall (east): cabinet, TV of static, console, soundbar
  const tvTex = A.tvStatic();
  anim.push((dt, t) => tvTex.userData.tick(t));
  at(9.66, 0, 4.1, -Math.PI / 2, () => {
    P.cabinet(1.9, 0.5, 0.42, { color: 0x2a2226, mat: 'wood', rows: [{ h: 1, kind: 'open' }], plinth: 0.06, top: { mat: 'wood', color: WOOD, t: 0.03 } });
    for (const x of [-0.475, 0.475]) add('wood', S.rbox(0.94, 0.4, 0.02, 0.006), { p: [x, 0.3, 0.215], color: 0x3a2e32 });
    const T0 = 0.53;
    at(0, T0, 0.02, 0, () => {
      add('plastic', S.rbox(0.4, 0.015, 0.22, 0.006), { p: [0, 0.008, 0], color: 0x141418 });
      add('plastic', S.rbox(0.07, 0.36, 0.06, 0.01), { p: [0, 0.19, -0.05], color: 0x141418 });
      add('plastic', S.rbox(1.3, 0.76, 0.05, 0.012), { p: [0, 0.72, -0.02], color: 0x0c0c10 });
      pic(tvTex, 1.24, 0.7, { p: [0, 0.72, 0.006], basic: true, emit: 1.35 });
      add('plastic', S.rbox(0.9, 0.07, 0.09, 0.03), { p: [0, 0.035, 0.14], color: 0x1a1a1e });
      add('emit', S.sphere(0.004, 6, 4), { p: [0.4, 0.035, 0.186], color: 0x6aff8a, emit: 3, ao: false });
    });
    at(-0.72, T0, 0.02, 0, () => { add('gloss', S.rbox(0.08, 0.28, 0.22, 0.02), { p: [0, 0.14, 0], color: 0xf4f4f6 }); add('emit', S.box(0.004, 0.2, 0.004), { p: [0.041, 0.15, 0.1], color: 0x7ab8ff, emit: 2.5, ao: false }); });
    at(0.72, T0, 0.0, 0, () => P.plant('snake', 0x2a2a30, 0.55));
    at(-0.55, T0, 0.12, 0.3, () => P.pumpkin(0.12));
    // consoles / game cases inside the open cabinet
    for (let i = 0; i < 8; i++) add('plastic', S.box(0.014, 0.17, 0.13), { p: [-0.85 + i * 0.018, 0.17, 0.0], color: [0x3a7aff, 0xff3a3a, 0x2a2a30, 0xffffff][i % 4] });
    add('plastic', S.rbox(0.3, 0.06, 0.24, 0.01), { p: [0.2, 0.12, 0], color: 0x1a1a1e });
    kit.collide(0, 0, 1.9, 0.42);
  });
  lights.push({ color: 0x7a9aff, intensity: 1.8, dist: 5, p: [9.0, 1.2, 4.1], kind: 'tv' });

  // ---------------------------------------------------------------- armchair with a skeleton, arc lamp
  at(4.05, 0, 5.7, 2.2, () => {
    add('fabric', S.rbox(0.82, 0.3, 0.8, 0.06, 3), { p: [0, 0.25, 0], color: 0x2e5a4a });
    add('fabric', S.rbox(0.78, 0.62, 0.18, 0.08, 3), { p: [0, 0.68, -0.32], r: [-0.1, 0, 0], color: 0x2e5a4a });
    for (const s of [-1, 1]) add('fabric', S.rbox(0.14, 0.26, 0.76, 0.06, 3), { p: [s * 0.36, 0.52, 0.0], color: 0x2e5a4a });
    add('fabric', pillow(0.54, 0.12, 0.56), { p: [0, 0.44, 0.06], color: 0x3a6a58 });
    for (const s of [-1, 1]) for (const z of [-1, 1]) add('wood', S.cyl(0.022, 0.016, 0.1, 8), { p: [s * 0.34, 0.05, z * 0.32], color: 0x2a1a10 });
    // skeleton, slouched, holding the remote
    at(0, 0.5, -0.05, 0, () => {
      const bone = (a, b, r = 0.018) => add('plastic', cable([a, b], r, 0, 6), { color: BONE, ao: false });
      add('plastic', S.sphere(0.1, 20, 16), { p: [0, 0.62, 0.02], s: [0.9, 1, 1], color: BONE });
      add('plastic', S.rbox(0.12, 0.05, 0.1, 0.02), { p: [0, 0.52, 0.06], color: BONE });
      for (const s of [-1, 1]) add('gloss', S.sphere(0.028, 10, 8), { p: [s * 0.036, 0.63, 0.098], color: 0x0a0806 });
      add('gloss', S.cone(0.012, 0.025, 3), { p: [0, 0.585, 0.11], r: [Math.PI, 0, 0], color: 0x0a0806 });
      bone(V(0, 0.5, -0.02), V(0, 0.08, -0.08), 0.015);
      for (let i = 0; i < 6; i++) add('plastic', S.torus(0.1 - i * 0.004, 0.009, 6, 20, Math.PI * 1.4), { p: [0, 0.42 - i * 0.045, 0.0], r: [Math.PI / 2, 0, Math.PI * 0.8], s: [1, 0.8, 1], color: BONE, ao: false });
      add('plastic', S.rbox(0.24, 0.08, 0.14, 0.04), { p: [0, 0.03, 0.0], color: BONE });
      for (const s of [-1, 1]) {
        const sh = V(s * 0.14, 0.44, -0.02), el = V(s * 0.22, 0.22, 0.08), wr = V(s * 0.12, 0.1, 0.26);
        bone(sh, el); bone(el, wr, 0.014);
        add('plastic', S.sphere(0.03, 10, 8), { p: [wr.x, wr.y, wr.z], s: [1, 0.5, 1.4], color: BONE });
        const hip = V(s * 0.1, 0.02, 0.04), kn = V(s * 0.14, 0.02, 0.42), an = V(s * 0.16, -0.4, 0.5);
        bone(hip, kn, 0.022); bone(kn, an, 0.018);
        add('plastic', S.rbox(0.07, 0.03, 0.16, 0.012), { p: [an.x, an.y - 0.02, an.z + 0.06], color: BONE });
      }
      add('plastic', S.rbox(0.05, 0.02, 0.18, 0.01), { p: [0.12, 0.12, 0.3], r: [0, 0.2, 0], color: 0x1a1a20 });
      at(0.02, 0.72, 0.0, 0, () => { add('fabric', S.cyl(0.16, 0.16, 0.01, 24), { color: 0x1a1024 }); add('fabric', S.cone(0.09, 0.26, 20), { p: [0, 0.13, -0.02], r: [-0.3, 0, 0], color: 0x1a1024 }); add('fabric', S.cyl(0.092, 0.092, 0.03, 20), { p: [0, 0.02, 0], color: 0xff7a1a }); });
    });
    kit.collide(0, 0, 0.82, 0.8);
  });
  at(3.5, 0, 6.5, 0.6, () => { // arc floor lamp, on (dim)
    add('metal', S.cyl(0.16, 0.18, 0.04, 24), { p: [0, 0.02, 0], color: 0x2a2a30 });
    add('metal', cable([V(0, 0.04, 0), V(0, 1.2, 0), V(0.2, 1.9, 0.1), V(0.6, 2.05, 0.3), V(0.85, 1.85, 0.42)], 0.012), { color: 0xc8c0b0 });
    add('metal', S.lathe([[0.02, 0], [0.18, -0.14], [0.19, -0.16], [0.02, -0.02]], 28), { p: [0.85, 1.9, 0.42], color: 0xe8dcc8 });
    add('emitFlicker', S.sphere(0.035, 12, 8), { p: [0.85, 1.78, 0.42], color: 0xffd8a8, emit: 3, ao: false });
    kit.collide(0, 0, 0.36, 0.36);
  });
  lights.push({ color: 0xffc890, intensity: 1.5, dist: 4, p: [4.1, 1.6, 6.3], kind: 'lamp' });

  // ---------------------------------------------------------------- bookcase + sideboard (north wall), fan, plants
  at(8.7, 0, 1.28, 0, () => P.bookcase(1.9, 2.0, 0.34, { color: WOOD, shelves: 5, fill: (i, y, w, d) => {
    if (i === 1) { for (let k = 0; k < 4; k++) add('paint', S.rbox(0.28, 0.06, 0.2, 0.004), { p: [-0.6, y + 0.03 + k * 0.062, 0], r: [0, (k % 2) * 0.1, 0], color: [0xff3a3a, 0x3a7aff, 0xffd23a, 0x2a2a30][k] }); P.books(-0.4, w / 2 - 0.05, y, d * 0.8, 12 + i); return; }
    if (i === 3) { at(-0.5, y, 0.05, 0, () => framed(A.familyPhoto(61), 0.2, 0.16, { frame: GOLD, mat: 'metal' }), -0.2); at(0.0, y, 0.0, 0, () => P.plant('snake', 0xf4efe8, 0.5)); at(0.5, y, 0.05, 0.3, () => P.pumpkin(0.1, { lit: false })); return; }
    P.books(-w / 2 + 0.02, w / 2 - 0.02, y, d * 0.8, 5 + i * 7);
  } }));
  at(4.3, 0, 1.3, 0, () => { // sideboard with a record player
    P.cabinet(1.5, 0.75, 0.42, { color: WOOD, mat: 'wood', rows: [{ h: 1, kind: 'doors' }], plinth: 0.08, top: { mat: 'wood', color: 0x5a3420, t: 0.03 }, handle: 'knob', hColor: GOLD });
    at(-0.35, 0.78, 0.0, 0, () => {
      add('wood', S.rbox(0.42, 0.1, 0.34, 0.012), { p: [0, 0.05, 0], color: 0x8a5a3a });
      add('gloss', S.cyl(0.15, 0.15, 0.008, 40), { p: [-0.02, 0.105, 0], color: 0x141414 });
      add('paint', S.cyl(0.045, 0.045, 0.009, 24), { p: [-0.02, 0.106, 0], color: 0xff7a1a });
      add('metal', cable([V(0.17, 0.12, -0.12), V(0.16, 0.14, 0.02), V(0.06, 0.12, 0.06)], 0.005), { color: CHROME_ });
    });
    for (let i = 0; i < 6; i++) add('paint', S.box(0.31, 0.31, 0.006), { p: [0.3, 0.94, -0.1 + i * 0.012], r: [0.15, 0, 0], color: [0x2a2a30, 0xff7a1a, 0x9a4ac8][i % 3] });
    at(0.55, 0.78, 0.0, 0, () => P.candle(0.2, 0.025, 0x1a1020, false));
  });
  const fan = kit.capture(M, () => { // standing fan (the blades turn)
    add('plastic', S.cyl(0.18, 0.2, 0.04, 28), { p: [0, 0.02, 0], color: 0xf4f4f0, ao: false });
    add('plastic', S.cyl(0.018, 0.018, 1.0, 10), { p: [0, 0.54, 0], color: 0xf4f4f0, ao: false });
    add('plastic', S.rbox(0.12, 0.1, 0.16, 0.04), { p: [0, 1.08, -0.06], color: 0xf4f4f0, ao: false });
    for (let r = 0.06; r <= 0.21; r += 0.05) add('metal', S.torus(r, 0.0025, 4, 36), { p: [0, 1.08, 0.08], color: 0xe8e8ec, ao: false });
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; add('metal', S.cyl(0.002, 0.002, 0.21, 4), { p: [Math.cos(a) * 0.105, 1.08 + Math.sin(a) * 0.105, 0.08], r: [0, 0, a + Math.PI / 2], color: 0xe8e8ec, ao: false }); }
    for (const s of [0.13, 0.03]) add('metal', S.torus(0.215, 0.004, 4, 40), { p: [0, 1.08, s - 0.03], color: 0xe8e8ec, ao: false });
    for (let i = 0; i < 5; i++) add('plastic', S.cyl(0.004, 0.004, 0.005, 6), { p: [-0.04 + i * 0.02, 0.05, 0.16], r: [Math.PI / 2, 0, 0], color: [0x3a7aff, 0x6ab8ff, 0x9ad0ff, 0xff5a5a, 0x2a2a30][i], ao: false });
  });
  const blades = kit.capture(M, () => {
    for (let i = 0; i < 3; i++) { const a = i / 3 * TAU; add('acrylic', S.sphere(0.09, 12, 8), { p: [Math.cos(a) * 0.09, Math.sin(a) * 0.09, 0], s: [1, 0.55, 0.12], r: [0, 0, a], color: 0x9ad0ff, ao: false }); }
    add('plastic', S.cyl(0.03, 0.03, 0.04, 16), { r: [Math.PI / 2, 0, 0], color: 0x6ab8ff, ao: false });
  });
  blades.position.set(0, 1.08, 0.075); fan.add(blades);
  fan.position.set(9.2, 0, 6.35); fan.rotation.y = -2.4; root.add(fan);
  kit.collide(9.2, 6.35, 0.4, 0.4);
  anim.push((dt, t) => { blades.rotation.z -= dt * 14; fan.rotation.y = -2.4 + Math.sin(t * 0.4) * 0.5; });
  at(9.5, 0, 1.55, 0, () => P.plant('monstera', 0x2a2a30, 1.7));
  at(3.5, 0, 1.6, 0, () => P.plant('snake', 0xd8c0a0, 0.9));

  // ---------------------------------------------------------------- spirit house (ศาลพระภูมิ) in the corner
  at(3.5, 0, 6.45, Math.PI * 0.75, () => {
    add('paint', S.rbox(0.16, 1.0, 0.16, 0.02), { p: [0, 0.5, 0], color: 0xf4efe8 });
    add('paint', S.rbox(0.3, 0.06, 0.3, 0.01), { p: [0, 0.03, 0], color: 0xe8e0d0 });
    add('gloss', S.rbox(0.64, 0.05, 0.64, 0.01), { p: [0, 1.02, 0], color: 0xc8a040 });
    add('paint', S.rbox(0.34, 0.3, 0.3, 0.01), { p: [0, 1.2, -0.06], color: 0xf4e8d0 });
    add('paint', S.box(0.12, 0.2, 0.01), { p: [0, 1.15, 0.095], color: 0x3a1a0a });
    for (const s of [-1, 1]) for (const z of [-0.18, 0.08]) add('gloss', S.cyl(0.015, 0.015, 0.34, 8), { p: [s * 0.2, 1.21, z], color: 0xc8a040 });
    for (let i = 0; i < 3; i++) add('gloss', S.cone(0.34 - i * 0.08, 0.14, 4), { p: [0, 1.43 + i * 0.1, -0.06], r: [0, Math.PI / 4, 0], s: [1.2, 1, 1], color: i % 2 ? 0xc8a040 : 0xb02028 });
    add('gloss', S.cone(0.02, 0.26, 6), { p: [0, 1.78, -0.06], color: 0xe8c040 });
    for (const s of [-1, 1]) add('gloss', S.cone(0.012, 0.1, 4), { p: [s * 0.24, 1.47, 0.14], r: [0, 0, s * 0.8], color: 0xe8c040 });
    // offerings: red soda with straws, jasmine garlands, zebra figurines, incense
    for (const x of [-0.2, 0.2]) at(x, 1.045, 0.2, 0, () => {
      add('glass', S.cyl(0.028, 0.028, 0.16, 14), { p: [0, 0.08, 0], color: 0xffffff });
      add('emit', S.cyl(0.025, 0.025, 0.12, 14), { p: [0, 0.062, 0], color: 0xff1a3a, emit: 1.3, ao: false });
      add('plastic', S.cyl(0.004, 0.004, 0.14, 6), { p: [0.01, 0.17, 0], r: [0, 0, 0.2], color: 0xffffff });
    });
    for (const s of [-1, 1]) {
      add('plush', S.torus(0.05, 0.012, 6, 16), { p: [s * 0.2, 1.12, -0.12], r: [0.3, 0, 0], color: 0xfbfbf0 });
      add('plush', S.sphere(0.016, 8, 6), { p: [s * 0.2, 1.06, -0.1], color: 0xff5a8a });
    }
    for (const [x, z, ry] of [[-0.12, 0.25, 0.4], [0.1, 0.26, -0.3], [0.0, 0.18, 0.1]]) at(x, 1.045, z, ry, () => { // zebra figurines
      const zc = (p, n, c) => c.set(Math.floor((p.x * 6 + p.y * 60 + p.z * 6) * 3) % 2 ? 0x141414 : 0xf8f8f8);
      add('gloss', S.rbox(0.06, 0.03, 0.025, 0.01), { p: [0, 0.045, 0], color: zc });
      for (const lx of [-0.02, 0.02]) for (const lz of [-0.008, 0.008]) add('gloss', S.cyl(0.004, 0.004, 0.03, 4), { p: [lx, 0.015, lz], color: 0xf8f8f8 });
      add('gloss', S.rbox(0.018, 0.04, 0.016, 0.006), { p: [0.035, 0.07, 0], r: [0, 0, -0.5], color: zc });
    });
    at(0.0, 1.045, 0.28, 0, () => {
      add('gloss', S.cyl(0.035, 0.03, 0.05, 14), { p: [0, 0.025, 0], color: 0xc8a040 });
      for (let i = 0; i < 3; i++) { add('wood', S.cyl(0.0015, 0.0015, 0.16, 4), { p: [(i - 1) * 0.012, 0.12, 0], r: [0, 0, (i - 1) * 0.12], color: 0xb8402a }); add('emitFlicker', S.sphere(0.003, 4, 3), { p: [(i - 1) * 0.022, 0.2, 0], color: 0xff5a1a, emit: 5, ao: false }); }
      add('haze', S.cyl(0.02, 0.05, 0.4, 8, true), { p: [0, 0.42, 0], color: 0x9aa0b0, emit: 0.05, ao: false });
    });
    kit.collide(0, 0, 0.64, 0.64);
  });

  // ---------------------------------------------------------------- walls: photos, clock, cobwebs
  for (const [z, y, seed, tilt] of [[2.1, 1.7, 71, 0.04], [2.6, 1.45, 73, -0.03], [2.95, 1.8, 77, 0.08]]) at(3.1, y, z, Math.PI / 2, () => framed(A.familyPhoto(seed, seed === 73), 0.3, 0.24, { frame: GOLD, mat: 'metal', tilt }));
  at(8.1, 1.9, 6.9, Math.PI, () => { add('wood', S.cyl(0.2, 0.2, 0.04, 40), { p: [0, 0, 0.02], r: [Math.PI / 2, 0, 0], color: WOOD }); pic(A.clockFace(), 0.34, 0.34, { p: [0, 0, 0.041] }); });
  for (const [x, z, ry] of [[9.9 - 0.18, 6.9 - 0.18, -Math.PI * 3 / 4], [9.9 - 0.18, 1.1 + 0.18, -Math.PI / 4]]) at(x, 2.8, z, ry, () => P.cobweb(0.56), 0.3);

  return {
    lights, anim, screens: { tv: tvTex },
    itemSpots: [V(5.9, 0.5, 6.4), V(6.3, 0.46, 4.25), V(9.62, 0.56, 3.45), V(4.7, 0.81, 1.35)],
    navPoints: [V(5.0, 0, 3.2), V(8.3, 0, 2.8), V(7.6, 0, 5.2)],
    ghostSpawns: [V(8.4, 0, 2.6)],
    update(dt, t) { for (const f of anim) f(dt, t); },
  };
}
const CHROME_ = 0xdfe4ea;
