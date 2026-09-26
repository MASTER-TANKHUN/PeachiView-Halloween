// Kitchen + dining (x -10..3, z 1..7): sage cabinets with brass handles and a butcher-block top along the
// south wall, sink under the window, a pot of glowing potion on the stove, pastel fridge covered in magnets,
// water dispenser, a table set for a Halloween party, island with a stand mixer, snack rack, pantry.
import * as THREE from 'three';
import { shapes as S } from './kit.js';
import { pillow, cable, sheetOver } from './soft.js';
import * as A from './art.js';
import { art, tiles } from './tex.js';

const TAU = Math.PI * 2;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const SAGE = 0x9db8a2, BRASS = 0xd8b060, TOP = 0xc8966a, CHROME = 0xdfe4ea, WALNUT = 0x5a3620;

function kitchenMaterials(M) {
  if (M.subway) return;
  const t = tiles({ seed: 31, a: '#f4f2ec', grout: '#b8b4ac', count: 10, meters: 1.0, glaze: 0.08, bevel: 0.12, jitter: 0.03 });
  for (const k of ['map', 'normalMap', 'roughnessMap']) t[k].repeat.set(1, 2); // 10 × 5 cm tiles
  M.subway = new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, roughnessMap: t.roughnessMap, roughness: 1, vertexColors: true, envMap: M.env, envMapIntensity: 0.7 });
}

export function roomKitchen(P, kit, M, root) {
  kitchenMaterials(M);
  const { add, at, pic, framed } = P;
  const lights = [], anim = [];

  // ---------------------------------------------------------------- counter run (south wall)
  const X0 = -9.08, X1 = -4.22, ZC = 6.6, TOPY = 0.9, SINK = -6.92, STOVE = -5.15;
  const modules = [-8.78, -8.18, -7.58, -6.92, -6.3, -5.72, -5.15, -4.52];
  modules.forEach((x, i) => at(x, 0, ZC, Math.PI, () => {
    const w = i === 3 ? 0.72 : i === 4 || i === 6 ? 0.56 : 0.6;
    const rows = i === 3 ? [{ h: 1, kind: 'doors' }] : i === 6 ? [{ h: 1, kind: 'doors' }, { h: 0.3, kind: 'drawer' }] : i % 2 ? [{ h: 1, kind: 'drawer' }, { h: 1, kind: 'drawer' }, { h: 1, kind: 'drawer' }] : [{ h: 1, kind: 'door' }, { h: 0.35, kind: 'drawer' }];
    P.cabinet(w - 0.01, 0.86, 0.6, { color: SAGE, mat: 'paint', rows, plinth: 0.1, handle: 'bar', hColor: BRASS });
  }));
  // butcher-block top, with an opening for the sink
  const sl = SINK - 0.33, sr = SINK + 0.33;
  add('wood', S.rbox(sl - X0, 0.04, 0.64, 0.008), { p: [(X0 + sl) / 2, TOPY - 0.02, ZC - 0.02], color: TOP, grain: 0 });
  add('wood', S.rbox(X1 - sr, 0.04, 0.64, 0.008), { p: [(sr + X1) / 2, TOPY - 0.02, ZC - 0.02], color: TOP, grain: 0 });
  add('wood', S.box(0.66, 0.04, 0.1), { p: [SINK, TOPY - 0.02, ZC - 0.29], color: TOP });
  add('wood', S.box(0.66, 0.04, 0.1), { p: [SINK, TOPY - 0.02, ZC + 0.25], color: TOP });
  // sink basin (walls + bottom), faucet, dish rack, soap
  at(SINK, TOPY, ZC - 0.02, 0, () => {
    for (const [p, s] of [[[0, -0.1, -0.2], [0.66, 0.2, 0.02]], [[0, -0.1, 0.2], [0.66, 0.2, 0.02]], [[-0.32, -0.1, 0], [0.02, 0.2, 0.42]], [[0.32, -0.1, 0], [0.02, 0.2, 0.42]], [[0, -0.2, 0], [0.66, 0.02, 0.42]], [[0, -0.1, 0], [0.02, 0.2, 0.42]]]) add('metalRough', S.box(...s), { p, color: 0xb8bec4, ao: false });
    add('metal', S.box(0.7, 0.008, 0.46), { p: [0, 0.004, 0], color: CHROME, ao: false }).scale;
    add('metal', cable([V(0, 0, 0.26), V(0, 0.35, 0.26), V(0, 0.42, 0.18), V(0, 0.36, 0.08)], 0.013), { color: CHROME });
    add('metal', S.cyl(0.028, 0.028, 0.03, 16), { p: [0, 0.015, 0.26], color: CHROME });
    add('metal', S.rbox(0.02, 0.1, 0.02, 0.008), { p: [0.07, 0.07, 0.26], r: [0, 0, 0.5], color: CHROME });
    at(0.24, 0, 0.17, 0, () => P.bottle(0.2, 0.03, 0x7ad0a0, 0xffffff, 'plastic'));
    add('plastic', S.rbox(0.09, 0.03, 0.06, 0.01), { p: [0.2, 0.015, 0.06], color: 0xffd23a });
  });
  add('fabric', pillow(0.9, 0.02, 0.5, { puff: 0.5 }), { p: [SINK, 0.01, 5.85], color: 0x8a3a4a }); // mat
  at(-7.6, TOPY, 6.62, 0, () => { // dish rack with plates and cups
    add('metal', S.rbox(0.42, 0.02, 0.32, 0.01), { p: [0, 0.01, 0], color: 0xc8d0d8 });
    for (let i = 0; i < 6; i++) add('gloss', S.cyl(0.11, 0.11, 0.012, 24), { p: [-0.15 + i * 0.04, 0.12, 0.02], r: [0, 0, Math.PI / 2 - 0.15], color: [0xffffff, 0xf4d8e0, 0xffffff][i % 3] });
    for (const x of [0.1, 0.17]) add('gloss', S.cyl(0.04, 0.035, 0.1, 14), { p: [x, 0.07, -0.08], r: [Math.PI, 0, 0], color: 0x9ad0e0 });
    add('metal', S.box(0.42, 0.14, 0.004), { p: [0, 0.08, -0.16], color: 0xc8d0d8 });
  });
  // stove: hob, pot of glowing green potion with bubbles, kettle
  at(STOVE, TOPY, ZC - 0.02, 0, () => {
    add('gloss', S.rbox(0.52, 0.012, 0.5, 0.005), { p: [0, 0.006, 0], color: 0x141418 });
    for (const [x, z] of [[-0.12, -0.12], [0.12, 0.12]]) { add('metal', S.torus(0.08, 0.006, 6, 24), { p: [x, 0.016, z], r: [Math.PI / 2, 0, 0], color: 0x3a3a40 }); add('metal', S.cyl(0.035, 0.035, 0.01, 16), { p: [x, 0.016, z], color: 0x2a2a30 }); }
    at(-0.12, 0.02, -0.12, 0, () => {
      add('metal', S.cyl(0.13, 0.12, 0.2, 32, true), { p: [0, 0.1, 0], color: 0x3a3a44 });
      add('metal', S.cyl(0.12, 0.12, 0.01, 32), { p: [0, 0.005, 0], color: 0x3a3a44 });
      add('metal', S.torus(0.13, 0.008, 6, 32), { p: [0, 0.2, 0], r: [Math.PI / 2, 0, 0], color: 0x4a4a54 });
      for (const s of [-1, 1]) add('metal', S.torus(0.025, 0.007, 6, 10, Math.PI), { p: [s * 0.14, 0.17, 0], r: [0, s > 0 ? 0 : Math.PI, Math.PI / 2], color: 0x2a2a30 });
      add('emitFlicker', S.circle(0.125, 32), { p: [0, 0.175, 0], r: [-Math.PI / 2, 0, 0], color: 0x7aff6a, emit: 2.6, uv: 'keep', ao: false });
      for (let i = 0; i < 9; i++) add('emitFlicker', S.sphere(0.012 + (i % 3) * 0.008, 10, 8), { p: [Math.cos(i * 2.3) * 0.07, 0.178, Math.sin(i * 2.3) * 0.07], s: [1, 0.6, 1], color: 0xb8ff9a, emit: 2.4, ao: false });
      add('haze', S.cyl(0.13, 0.06, 0.35, 16, true), { p: [0, 0.36, 0], color: 0x5aff6a, emit: 0.07, ao: false });
      add('wood', S.cyl(0.008, 0.008, 0.36, 8), { p: [0.05, 0.3, 0.02], r: [0.3, 0, -0.35], color: 0x8a6a4a });
    });
    at(0.12, 0.02, 0.12, 0.6, () => { // kettle
      add('gloss', S.lathe([[0, 0], [0.09, 0], [0.1, 0.06], [0.08, 0.16], [0.03, 0.2], [0, 0.2]], 24), { color: 0xff9ec0 });
      add('gloss', S.cyl(0.012, 0.018, 0.12, 8), { p: [0.1, 0.1, 0], r: [0, 0, -0.9], color: 0xff9ec0 });
      add('plastic', S.torus(0.06, 0.01, 6, 14, Math.PI), { p: [0, 0.2, 0], color: 0x2a2a30 });
    });
  });
  for (let i = 0; i < 4; i++) add('metal', S.cyl(0.018, 0.018, 0.025, 14), { p: [STOVE - 0.21 + i * 0.14, 0.78, ZC - 0.315], r: [Math.PI / 2, 0, 0], color: 0x2a2a30 });
  // range hood with a warm light
  at(STOVE, 0, 6.72, Math.PI, () => {
    add('metal', S.lathe([[0.36, 0], [0.34, 0.06], [0.12, 0.3], [0.12, 0.31], [0, 0.31]], 4), { p: [0, 1.62, 0], r: [0, Math.PI / 4, 0], s: [1.05, 1, 0.62], color: CHROME });
    add('metal', S.box(0.24, 0.9, 0.2), { p: [0, 2.35, 0.08], color: CHROME });
    add('emit', S.box(0.18, 0.006, 0.08), { p: [0, 1.618, -0.02], color: 0xffd8a0, emit: 3, ao: false });
  });
  lights.push({ color: 0xffc890, intensity: 1.6, dist: 3.6, p: [STOVE, 1.45, 6.5], kind: 'lamp' });
  // backsplash tiles + upper cabinets (not over the window or the hood)
  const WL = -7.68, WR = -6.12; // window (with casing)
  add('subway', S.box(WL - X0, 0.58, 0.01), { p: [(X0 + WL) / 2, TOPY + 0.29, 6.895], uv: 'world', ao: false });
  add('subway', S.box(X1 - WR, 0.58, 0.01), { p: [(WR + X1) / 2, TOPY + 0.29, 6.895], uv: 'world', ao: false });
  add('subway', S.box(WR - WL, 0.1, 0.01), { p: [(WL + WR) / 2, TOPY + 0.05, 6.895], uv: 'world', ao: false });
  for (const [x, w] of [[-8.75, 0.6], [-8.15, 0.6], [-5.8, 0.58], [-4.55, 0.6]]) at(x, 1.5, 6.72, Math.PI, () => {
    P.cabinet(w - 0.01, 0.7, 0.34, { color: SAGE, mat: 'paint', rows: [{ h: 1, kind: 'door' }], plinth: 0, handle: 'bar', hColor: BRASS });
    kit.colliders.pop();
  });
  // things on the counter: microwave, rice cooker, knife block, pumpkin being carved, fruit bowl, mortar, spices
  at(-8.65, TOPY, 6.65, Math.PI, () => {
    add('plastic', S.rbox(0.48, 0.28, 0.36, 0.02), { p: [0, 0.14, 0], color: 0xf4f0ec });
    add('glass', S.plane(0.3, 0.2), { p: [-0.05, 0.14, 0.181], uv: 'keep', ao: false });
    add('plastic', S.box(0.3, 0.2, 0.002), { p: [-0.05, 0.14, 0.178], color: 0x1a1a1e });
    pic(art(96, 40, (g, w, h) => { g.fillStyle = '#081208'; g.fillRect(0, 0, w, h); g.fillStyle = '#6aff8a'; g.font = '700 26px Kanit, sans-serif'; g.fillText('03:00', 10, 30); }), 0.07, 0.03, { p: [0.17, 0.21, 0.182], basic: true, emit: 2 });
    for (let i = 0; i < 3; i++) add('plastic', S.cyl(0.012, 0.012, 0.01, 12), { p: [0.17, 0.15 - i * 0.04, 0.182], r: [Math.PI / 2, 0, 0], color: 0x9a9aa0 });
  });
  at(-8.05, TOPY, 6.62, 0.3, () => { // rice cooker
    add('gloss', S.cyl(0.15, 0.14, 0.2, 32), { p: [0, 0.1, 0], color: 0xffffff });
    add('gloss', S.sphere(0.15, 32, 12, 0, TAU, 0, Math.PI / 2), { p: [0, 0.2, 0], s: [1, 0.35, 1], color: 0xffffff });
    add('plastic', S.rbox(0.07, 0.03, 0.03, 0.01), { p: [0, 0.27, 0], color: 0x9a9aa0 });
    add('plastic', S.box(0.1, 0.06, 0.01), { p: [0, 0.1, 0.148], color: 0xff9ec0 });
    add('emit', S.sphere(0.006, 6, 4), { p: [0.03, 0.1, 0.155], color: 0xff5040, emit: 3, ao: false });
    add('plastic', cable([V(-0.1, 0.05, -0.1), V(-0.2, 0.02, -0.2), V(-0.25, 0.3, -0.24)], 0.004), { color: 0x1a1a1a, ao: false });
  });
  at(-6.3, TOPY, 6.55, 0, () => { // cutting board, half-carved pumpkin, knife, pulp
    add('wood', S.rbox(0.45, 0.025, 0.3, 0.01), { p: [0, 0.0125, 0], color: 0xd8b080 });
    at(0, 0.025, 0, 0.3, () => P.pumpkin(0.14, { lit: false }));
    add('metal', S.box(0.18, 0.003, 0.03), { p: [0.18, 0.03, 0.1], r: [0, 0.4, 0], color: CHROME });
    add('plastic', S.rbox(0.1, 0.02, 0.025, 0.008), { p: [0.04, 0.035, 0.16], r: [0, 0.4, 0], color: 0x1a1a1a });
    for (let i = 0; i < 7; i++) add('plastic', S.sphere(0.015, 6, 4), { p: [-0.15 + (i % 4) * 0.03, 0.03, 0.08 + Math.floor(i / 4) * 0.03], s: [1.5, 0.5, 1], color: 0xff8a2a });
  });
  at(-5.72, TOPY, 6.6, 0, () => { // fruit bowl with peaches
    add('gloss', S.lathe([[0, 0], [0.07, 0], [0.15, 0.06], [0.16, 0.08], [0.15, 0.08], [0, 0.02]], 24), { color: 0xf4efe8 });
    for (const [x, z, y] of [[-0.05, -0.03, 0.07], [0.05, -0.02, 0.07], [0, 0.05, 0.07], [0.01, 0.0, 0.13]]) {
      add('plush', S.sphere(0.045, 16, 12), { p: [x, y, z], color: (p, n, c) => c.set(0xffb898).lerp(new THREE.Color(0xff6f8a), Math.max(0, n.x * 0.6 + n.y * 0.4)) });
      add('plastic', S.cone(0.015, 0.03, 6), { p: [x + 0.01, y + 0.05, z], r: [0, 0, -1], s: [1, 1, 0.4], color: 0x5cbf6a });
    }
  });
  at(-4.55, TOPY, 6.62, 0, () => { // mortar and pestle, fish sauce, spices
    add('gloss', S.lathe([[0, 0], [0.08, 0], [0.1, 0.1], [0.095, 0.11], [0.07, 0.1], [0, 0.04]], 24), { color: 0x4a4a4e });
    add('wood', S.cyl(0.018, 0.024, 0.18, 10), { p: [0.03, 0.14, 0], r: [0, 0, 0.5], color: 0x8a6a4a });
    at(0.2, 0, 0.05, 0, () => P.bottle(0.24, 0.03, 0x8a4a1a, 0xff3030, 'glass'));
    for (let i = 0; i < 5; i++) { add('glass', S.cyl(0.025, 0.025, 0.09, 12), { p: [-0.18 + i * 0.055, 0.045, 0.2], color: 0xffffff }); add('plastic', S.cyl(0.022, 0.022, 0.07, 12), { p: [-0.18 + i * 0.055, 0.035, 0.2], color: [0xc8401a, 0xd8b040, 0x6a8a3a, 0x8a3a1a, 0xf4e8c8][i] }); add('wood', S.cyl(0.026, 0.026, 0.02, 12), { p: [-0.18 + i * 0.055, 0.1, 0.2], color: 0x8a6a4a }); }
  });

  // ---------------------------------------------------------------- pastel fridge covered in magnets
  at(-9.48, 0, 6.5, Math.PI, () => {
    const w = 0.78, h = 1.86, d = 0.72, C = 0xf8c6d2;
    add('gloss', S.rbox(w, h, d - 0.04, 0.05, 3), { p: [0, h / 2 + 0.03, -0.02], color: C });
    add('gloss', S.rbox(w - 0.01, h * 0.3 - 0.01, 0.05, 0.03), { p: [0, h * 0.85 + 0.03, d / 2 - 0.02], color: C });
    add('gloss', S.rbox(w - 0.01, h * 0.7 - 0.02, 0.05, 0.03), { p: [0, h * 0.35 + 0.03, d / 2 - 0.02], color: C });
    for (const [y, l] of [[h * 0.78, 0.2], [h * 0.55, 0.4]]) add('metal', S.rbox(0.03, l, 0.03, 0.012), { p: [w / 2 - 0.07, y, d / 2 + 0.03], color: CHROME });
    const fz = d / 2 + 0.006;
    pic(A.familyPhoto(51), 0.13, 0.1, { p: [-0.18, 1.2, fz + 0.001], r: [0, 0, 0.06] });
    pic(A.familyPhoto(53, true), 0.12, 0.09, { p: [0.05, 1.05, fz + 0.001], r: [0, 0, -0.08] });
    pic(art(160, 200, (g, w2, h2) => { g.fillStyle = '#fff8a0'; g.fillRect(0, 0, w2, h2); g.fillStyle = '#3a2a20'; g.font = '600 22px Mitr, sans-serif'; ['อย่ากิน', 'พุดดิ้ง', 'ของพีชชี่', 'นะทุกคน!!'].forEach((l, i) => g.fillText(l, 14, 44 + i * 40)); }), 0.12, 0.15, { p: [-0.15, 0.85, fz + 0.001], r: [0, 0, 0.05] });
    for (const [x, y, c] of [[-0.25, 1.32, 0xff5f95], [0.1, 1.14, 0x5fc8ff], [-0.1, 0.95, 0xffd23a], [0.15, 0.7, 0x7aff9a], [-0.3, 1.62, 0xff7a1a]]) add('plastic', S.cyl(0.02, 0.02, 0.012, 14), { p: [x, y, fz + 0.006], r: [Math.PI / 2, 0, 0], color: c });
    for (const [x, c] of [[-0.18, 0xffd23a], [0.1, 0xff7a1a]]) add('paint', S.rbox(0.18, 0.28, 0.07, 0.006), { p: [x, h + 0.17, 0], r: [0, 0.1, 0], color: c });
    kit.collide(0, 0, w, d);
  });
  // water dispenser with a 20 L bottle
  at(-9.62, 0, 5.3, Math.PI / 2, () => {
    add('gloss', S.rbox(0.32, 0.95, 0.32, 0.02), { p: [0, 0.475, 0], color: 0xfafafa });
    add('plastic', S.box(0.2, 0.2, 0.02), { p: [0, 0.72, 0.16], color: 0x3a3a40 });
    for (const [x, c] of [[-0.05, 0x3a7aff], [0.05, 0xff3a3a]]) add('plastic', S.rbox(0.03, 0.05, 0.04, 0.01), { p: [x, 0.8, 0.17], color: c });
    add('glass', S.lathe([[0, 0], [0.04, 0], [0.05, 0.05], [0.14, 0.12], [0.14, 0.42], [0.1, 0.48], [0, 0.49]], 24), { p: [0, 1.46, 0], r: [Math.PI, 0, 0], color: 0xffffff });
    add('gloss', S.cyl(0.13, 0.13, 0.3, 24), { p: [0, 1.24, 0], color: 0x9ad0f0, ao: false });
    kit.collide(0, 0, 0.34, 0.34);
  });
  // open shelves on the west wall (north of the window)
  at(-9.9, 0, 2.05, Math.PI / 2, () => {
    for (const [y, fill] of [[1.15, 'jars'], [1.55, 'plates'], [1.95, 'books']]) at(0, y, 0, 0, () => {
      P.wallShelf(1.05, 0.26, 0xf4efe6, 'paint');
      if (fill === 'jars') for (let i = 0; i < 5; i++) { add('glass', S.cyl(0.05, 0.05, 0.16, 16), { p: [-0.4 + i * 0.18, 0.093, 0.13], color: 0xffffff }); add('plastic', S.cyl(0.046, 0.046, 0.1 + (i % 2) * 0.03, 16), { p: [-0.4 + i * 0.18, 0.065, 0.13], color: [0xf4e8c8, 0x8a5a2a, 0xf8f4f0, 0xd8a040, 0x6a3a1a][i] }); add('wood', S.cyl(0.052, 0.052, 0.02, 16), { p: [-0.4 + i * 0.18, 0.18, 0.13], color: 0x8a6a4a }); }
      if (fill === 'plates') { for (let i = 0; i < 6; i++) add('gloss', S.cyl(0.11, 0.11, 0.012, 24), { p: [-0.3, 0.02 + i * 0.013, 0.13], color: 0xffffff }); for (let i = 0; i < 3; i++) at(0.05 + i * 0.13, 0.0125, 0.12, 0.4, () => P.mug([0xff9ec0, 0xffffff, 0x9ad0c8][i])); at(0.42, 0.0125, 0.12, 0, () => P.plant('snake', 0xd8c0a0, 0.4)); }
      if (fill === 'books') { P.books(-0.5, 0.1, 0.0125, 0.2, 21); at(0.3, 0.0125, 0.12, 0.3, () => P.pumpkin(0.08, { lit: false })); }
    });
  });

  // ---------------------------------------------------------------- dining table set for a party
  const TX = -4.6, TZ = 3.8, TY = 0.76;
  at(TX, 0, TZ, 0, () => {
    add('wood', S.rbox(1.7, 0.045, 0.92, 0.012), { p: [0, TY - 0.0225, 0], color: WALNUT });
    add('wood', S.box(1.56, 0.08, 0.78), { p: [0, TY - 0.08, 0], color: 0x4a2a18 });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) add('wood', S.lathe([[0, 0], [0.03, 0], [0.028, 0.08], [0.04, 0.15], [0.026, 0.3], [0.03, 0.6], [0.035, 0.7], [0, 0.7]], 12), { p: [sx * 0.74, 0, sz * 0.38], color: WALNUT });
    pic(art(512, 96, (g, w, h) => { for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? '#1a1020' : '#ff7a1a'; g.fillRect(i * 32, 0, 32, h); } g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 0, w, 6); g.fillRect(0, h - 6, w, 6); }, { fonts: false }), 1.72, 0.32, { p: [0, TY + 0.002, 0], r: [-Math.PI / 2, 0, 0], rough: 0.95 });
    at(0, TY, 0, 0.2, () => P.pumpkin(0.17));
    for (const x of [-0.42, 0.42]) at(x, TY, 0, 0, () => {
      add('metal', S.lathe([[0, 0], [0.06, 0], [0.05, 0.02], [0.015, 0.05], [0.015, 0.16], [0.035, 0.18], [0, 0.18]], 16), { color: 0x2a2a30 });
      at(0, 0.18, 0, 0, () => P.candle(0.24, 0.018, 0x141018, true));
    });
    for (const [x, z] of [[-0.45, -0.3], [0.45, -0.3], [-0.45, 0.3], [0.45, 0.3]]) at(x, TY, z, 0, () => { // plates with cupcakes
      add('gloss', S.cyl(0.12, 0.1, 0.015, 28), { p: [0, 0.0075, 0], color: 0xffffff });
      add('paint', S.cyl(0.035, 0.028, 0.045, 14), { p: [0, 0.037, 0], color: 0x3a2014 });
      add('plush', S.sphere(0.04, 14, 10), { p: [0, 0.07, 0], s: [1, 0.8, 1], color: [0xff7a1a, 0x9a4ac8, 0x1a1020, 0xff9ec0][Math.abs(Math.round(x * 10 + z * 3)) % 4] });
      add('plastic', S.sphere(0.012, 8, 6), { p: [0, 0.105, 0], color: 0xffffff });
    });
    at(0.1, TY, -0.05, 0, () => { // spider-web cake on a stand
      add('gloss', S.lathe([[0, 0], [0.07, 0], [0.02, 0.02], [0.02, 0.1], [0.15, 0.11], [0.15, 0.12], [0, 0.12]], 24), { p: [0.62, 0, 0], color: 0xf4efe8 });
      add('plush', S.cyl(0.12, 0.12, 0.1, 32), { p: [0.62, 0.17, 0], color: 0x141018 });
      pic(art(128, 128, (g, w) => { g.fillStyle = '#141018'; g.fillRect(0, 0, w, w); g.strokeStyle = '#fff'; g.lineWidth = 2; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; g.beginPath(); g.moveTo(64, 64); g.lineTo(64 + Math.cos(a) * 64, 64 + Math.sin(a) * 64); g.stroke(); } for (let r = 12; r < 64; r += 12) { g.beginPath(); g.arc(64, 64, r, 0, TAU); g.stroke(); } }, { fonts: false }), 0.24, 0.24, { p: [0.62, 0.222, 0], r: [-Math.PI / 2, 0, 0], geo: new THREE.CircleGeometry(0.12, 32) });
    });
    kit.collide(0, 0, 1.7, 0.92);
  });
  lights.push({ color: 0xff8a2a, intensity: 2.0, dist: 4.5, p: [TX, 1.05, TZ], kind: 'candle' });
  const chair = (x, z, ry) => at(x, 0, z, ry, () => {
    add('wood', S.rbox(0.44, 0.04, 0.42, 0.01), { p: [0, 0.45, 0], color: WALNUT });
    add('fabric', pillow(0.4, 0.05, 0.38), { p: [0, 0.49, 0], color: 0x8a3a4a });
    P.legs4('wood', 0.42, 0.4, 0.45, 0.018, WALNUT, 0.01);
    for (const s of [-1, 1]) add('wood', S.cyl(0.018, 0.016, 0.5, 8), { p: [s * 0.19, 0.7, -0.18], r: [-0.08, 0, 0], color: WALNUT });
    for (let i = 0; i < 3; i++) add('wood', S.rbox(0.36, 0.05, 0.02, 0.008), { p: [0, 0.68 + i * 0.12, -0.2], r: [-0.08, 0, 0], color: WALNUT });
    kit.collide(0, 0, 0.44, 0.42);
  });
  chair(TX - 0.42, TZ - 0.72, 0); chair(TX + 0.42, TZ - 0.72, 0.1); chair(TX - 0.42, TZ + 0.72, Math.PI); chair(TX + 0.45, TZ + 0.8, Math.PI - 0.35);
  at(TX, 2.8, TZ, 0, () => { add('plastic', S.cyl(0.004, 0.004, 0.7, 6), { p: [0, -0.35, 0], color: 0x111111, ao: false }); add('metal', S.lathe([[0.02, 0], [0.3, -0.2], [0.31, -0.22], [0.02, -0.03]], 32), { p: [0, -0.7, 0], color: 0x2a3a34, ao: false }); });

  // ---------------------------------------------------------------- island with stools, stand mixer, cupcake tray
  at(-0.6, 0, 4.3, 0, () => {
    P.cabinet(1.8, 0.88, 0.8, { color: SAGE, mat: 'paint', rows: [{ h: 1, kind: 'doors' }, { h: 0.35, kind: 'drawer' }], plinth: 0.1, handle: 'bar', hColor: BRASS });
    add('wood', S.rbox(1.9, 0.045, 0.92, 0.01), { p: [0, 0.9, -0.05], color: TOP });
    const T0 = 0.922;
    at(-0.5, T0, 0.05, -0.4, () => { // stand mixer
      add('gloss', S.rbox(0.18, 0.04, 0.3, 0.015), { p: [0, 0.02, 0], color: 0xff9ec0 });
      add('gloss', S.rbox(0.1, 0.28, 0.1, 0.04), { p: [0, 0.16, -0.1], color: 0xff9ec0 });
      add('gloss', S.sphere(0.1, 20, 14), { p: [0, 0.32, 0.0], s: [0.8, 0.75, 1.5], color: 0xff9ec0 });
      add('metal', S.lathe([[0, 0], [0.05, 0], [0.1, 0.06], [0.11, 0.14], [0.105, 0.14], [0, 0.02]], 24), { p: [0, 0.04, 0.05], color: CHROME });
      add('plush', S.cyl(0.1, 0.1, 0.02, 24), { p: [0, 0.16, 0.05], color: 0xf4e0c8 });
      add('metal', S.cyl(0.008, 0.02, 0.1, 8), { p: [0, 0.2, 0.08], color: CHROME });
    });
    at(0.2, T0, 0.0, 0, () => { // muffin tray
      add('metal', S.rbox(0.36, 0.03, 0.26, 0.01), { p: [0, 0.015, 0], color: 0x8a8a90 });
      for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) { add('paint', S.cyl(0.03, 0.025, 0.035, 12), { p: [-0.12 + i * 0.08, 0.05, -0.08 + j * 0.08], color: 0xffffff }); add('plush', S.sphere(0.034, 12, 8), { p: [-0.12 + i * 0.08, 0.075, -0.08 + j * 0.08], s: [1, 0.7, 1], color: (i + j) % 2 ? 0xff7a1a : 0xf4ecf8 }); }
    });
    at(0.6, T0, 0.1, 0.3, () => { add('paint', pillow(0.16, 0.26, 0.1, { wrinkle: 0.01 }), { p: [0, 0.13, 0], r: [Math.PI / 2, 0, 0], color: 0xf4efe6 }); });
    kit.collide(0, 0, 1.8, 0.8);
  });
  for (const x of [-1.1, -0.1]) at(x, 0, 3.6, 0, () => { // bar stools
    add('fabric', S.cyl(0.18, 0.17, 0.07, 24), { p: [0, 0.68, 0], color: 0x8a3a4a });
    add('metal', S.cyl(0.02, 0.02, 0.64, 10), { p: [0, 0.33, 0], color: 0x2a2a30 });
    add('metal', S.torus(0.15, 0.01, 6, 24), { p: [0, 0.3, 0], r: [Math.PI / 2, 0, 0], color: 0x2a2a30 });
    add('metal', S.cyl(0.2, 0.22, 0.02, 24), { p: [0, 0.01, 0], color: 0x2a2a30 });
    kit.collide(0, 0, 0.36, 0.36);
  });

  // ---------------------------------------------------------------- snack rack, pantry, bins, broom, wall decor
  at(0.9, 0, 1.36, 0, () => {
    for (const s of [-1, 1]) for (const z of [-1, 1]) add('metal', S.cyl(0.01, 0.01, 1.5, 8), { p: [s * 0.58, 0.75, z * 0.17], color: 0xc8c8d0 });
    let k = 0;
    for (const y of [0.1, 0.5, 0.9, 1.3]) {
      add('metal', S.box(1.18, 0.012, 0.36), { p: [0, y, 0], color: 0xb8b8c0 });
      if (y === 0.1) { for (let i = 0; i < 12; i++) at(-0.5 + (i % 6) * 0.2, y + 0.006, -0.08 + Math.floor(i / 6) * 0.16, 0, () => P.can([0xff3a3a, 0x3a7aff, 0xffd23a, 0x7aff6a][i % 4], 0xffffff)); continue; }
      if (y === 0.5) { for (let i = 0; i < 7; i++) add('plastic', pillow(0.14, 0.05, 0.22, { wrinkle: 0.02, seed: i }), { p: [-0.48 + i * 0.16, y + 0.12, 0], r: [Math.PI / 2 - 0.15, 0, 0], color: [0xffb020, 0xff3a3a, 0x3aa0ff, 0x7aff6a, 0xff9ec0, 0xffd23a, 0x9a4ac8][i] }); continue; }
      for (let i = 0; i < 6; i++) for (let j = 0; j < (y === 0.9 ? 3 : 2); j++) {
        const x = -0.48 + i * 0.19;
        add('paint', S.cyl(0.045, 0.036, 0.1, 14), { p: [x, y + 0.056 + j * 0.1, 0], color: [0xffffff, 0xff5a3a, 0xffd23a][(i + j + k) % 3] });
        add('paint', S.cyl(0.046, 0.046, 0.006, 14), { p: [x, y + 0.108 + j * 0.1, 0], color: 0xd8d0c0 });
      }
      k++;
    }
    kit.collide(0, 0, 1.2, 0.4);
  });
  at(2.6, 0, 6.2, -Math.PI / 2, () => P.cabinet(0.9, 2.1, 0.58, { color: SAGE, mat: 'paint', rows: [{ h: 1.2, kind: 'doors' }, { h: 1, kind: 'doors' }], plinth: 0.1, handle: 'bar', hColor: BRASS }));
  at(2.45, 0, 1.55, 0, () => {
    add('metal', S.cyl(0.15, 0.14, 0.5, 24), { p: [0, 0.25, 0], color: CHROME });
    add('metal', S.sphere(0.15, 24, 8, 0, TAU, 0, Math.PI / 2), { p: [0, 0.5, 0], s: [1, 0.3, 1], color: CHROME });
    add('plastic', S.rbox(0.3, 0.55, 0.3, 0.03), { p: [-0.38, 0.275, 0], color: 0x3a7aff });
    kit.collide(-0.2, 0, 0.7, 0.34);
  });
  at(-2.2, 0, 6.62, Math.PI, () => { // witch broom leaning on the wall, mop bucket
    at(0, 0, 0, 0, () => {
      add('wood', S.cyl(0.015, 0.018, 1.4, 8), { p: [0, 0.9, 0], color: 0x6a4a2a });
      add('fabric', S.cone(0.14, 0.4, 16, true), { p: [0, 0.18, 0], r: [Math.PI, 0, 0], color: 0xc8a050 });
      add('fabric', S.torus(0.045, 0.012, 6, 14), { p: [0, 0.36, 0], r: [Math.PI / 2, 0, 0], color: 0x8a2a3a });
    }, -0.25, 0.1);
    add('plastic', S.cyl(0.16, 0.13, 0.28, 20, true), { p: [0.45, 0.14, 0.05], color: 0xffd23a });
    add('plastic', S.cyl(0.13, 0.13, 0.01, 20), { p: [0.45, 0.005, 0.05], color: 0xffd23a });
  });
  at(-3.0, 2.5, 1.1, 0, () => { add('wood', S.cyl(0.17, 0.17, 0.035, 40), { p: [0, 0, 0.018], r: [Math.PI / 2, 0, 0], color: 0xf4efe6 }); pic(A.clockFace(), 0.3, 0.3, { p: [0, 0, 0.037] }); });
  at(-6.2, 1.55, 1.1, 0, () => pic(A.thaiCalendar(), 0.3, 0.42, { p: [0, 0, 0.003] }));
  at(-7.6, 1.6, 1.1, 0, () => framed(A.animePoster(20, 'CURRY'), 0.36, 0.5, { frame: 0xffffff, mat: 'paint', tilt: 0.03 }));
  for (const [x, z, ry] of [[-9.9 + 0.18, 6.9 - 0.18, Math.PI * 3 / 4], [2.9 - 0.18, 1.1 + 0.18, -Math.PI / 4]]) at(x, 2.8, z, ry, () => P.cobweb(0.56), 0.3);
  P.bunting(V(-9.8, 2.55, 1.2), V(-9.8, 2.55, 6.8), 14);

  return {
    lights,
    itemSpots: [V(-4.25, 0.78, 3.55), V(-6.3, 0.93, 6.5), V(-0.3, 0.94, 4.45), V(0.9, 0.52, 1.36)],
    navPoints: [V(-7.0, 0, 3.5), V(-2.0, 0, 5.2), V(0.5, 0, 2.5), V(-6.4, 0, 5.4)],
    ghostSpawns: [V(-8.3, 0, 2.3)],
    update(dt, t) { for (const f of anim) f(dt, t); },
  };
}
