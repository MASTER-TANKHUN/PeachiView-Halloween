// Bathroom (x 4.5..10, z -7..-1): tub with a shower curtain, toilet with the bidet sprayer, vanity and a
// fogged mirror with a message, a glazed water jar with a floating dipper, washing machine, towels.
import * as THREE from 'three';
import { shapes as S } from './kit.js';
import { pillow, cable, sheetOver } from './soft.js';
import * as A from './art.js';

const TAU = Math.PI * 2;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const PORC = 0xf6f8f8, CHROME = 0xdfe4ea, PINK = 0xff9ec0;

function drapeGeo(w, h, folds = 6, amp = 0.035) {
  const g = new THREE.PlaneGeometry(w, h, 40, 10), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i) + h / 2; p.setXYZ(i, x, y, amp * Math.sin((x / w + 0.5) * folds * TAU) * (0.7 + 0.3 * (1 - y / h))); }
  g.computeVertexNormals();
  return g;
}

export function roomBath(P, kit, M, root) {
  const { add, at, pic } = P;
  const lights = [], anim = [];

  // ---------------------------------------------------------------- bathtub on the north wall
  at(8.72, 0, -6.5, 0, () => {
    const L = 2.3, W = 0.78, H = 0.56;
    add('gloss', S.rbox(L, H, W, 0.05, 3), { p: [0, H / 2, 0], color: PORC });
    add('gloss', S.rbox(L - 0.16, 0.2, W - 0.16, 0.06, 3), { p: [0, H - 0.08, 0], color: 0xe8eef0, ao: false }); // inner lip shade
    add('gloss', S.plane(L - 0.14, W - 0.14), { p: [0, 0.42, 0], r: [-Math.PI / 2, 0, 0], color: 0x3a6a6a, uv: 'keep', ao: false }); // water
    add('gloss', S.rbox(L + 0.02, 0.06, 0.04, 0.02), { p: [0, 0.03, W / 2 - 0.02], color: 0xd8dde0 }); // toe kick
    for (let i = 0; i < 26; i++) { const a = i * 2.39, r = 0.1 + (i % 6) * 0.05; add('gloss', S.sphere(0.02 + (i % 3) * 0.012, 8, 6), { p: [0.5 + Math.cos(a) * r * 1.5, 0.43, Math.sin(a) * r * 0.6], s: [1, 0.6, 1], color: 0xffffff, ao: false }); }
    for (const [x, z, s, ry] of [[-0.3, 0.05, 1, 0.5], [0.1, -0.12, 0.7, -1.2], [-0.62, -0.1, 0.8, 2.1]]) at(x, 0.42, z, ry, () => { // rubber ducks
      add('plastic', S.sphere(0.045 * s, 12, 10), { p: [0, 0.03 * s, 0], s: [1.25, 0.9, 1], color: 0xffd21a });
      add('plastic', S.sphere(0.03 * s, 12, 10), { p: [0.035 * s, 0.075 * s, 0], color: 0xffd21a });
      add('plastic', S.cone(0.012 * s, 0.03 * s, 8), { p: [0.07 * s, 0.07 * s, 0], r: [0, 0, -Math.PI / 2], color: 0xff7a1a });
      for (const q of [-1, 1]) add('gloss', S.sphere(0.005 * s, 6, 4), { p: [0.05 * s, 0.085 * s, q * 0.015 * s], color: 0x111111 });
    });
    // faucet + handles at the east end, shower riser on the wall
    add('metal', S.cyl(0.018, 0.018, 0.14, 12), { p: [L / 2 - 0.1, 0.62, -0.0], r: [0, 0, Math.PI / 2], color: CHROME });
    add('metal', S.cyl(0.015, 0.015, 0.12, 12), { p: [L / 2 - 0.16, 0.58, 0], color: CHROME });
    for (const z of [-0.12, 0.12]) add('metal', S.cyl(0.03, 0.03, 0.03, 16), { p: [L / 2 - 0.04, 0.72, z], r: [0, 0, Math.PI / 2], color: CHROME });
    at(L / 2 - 0.4, 0, -W / 2 + 0.02, 0, () => {
      add('metal', S.cyl(0.012, 0.012, 1.1, 10), { p: [0, 1.45, 0.03], color: CHROME });
      add('metal', S.cyl(0.07, 0.05, 0.03, 24), { p: [0, 1.95, 0.1], r: [0.5, 0, 0], color: CHROME });
      add('metal', cable([V(0, 1.1, 0.04), V(0.1, 0.8, 0.12), V(0.2, 0.72, 0.18), V(0.06, 1.2, 0.08)], 0.008), { color: CHROME, ao: false });
    });
    // shower curtain on a rod along the front edge, half drawn
    add('metal', S.cyl(0.012, 0.012, L, 10), { p: [0, 2.02, W / 2 + 0.02], r: [0, 0, Math.PI / 2], color: CHROME });
    add('bedding', drapeGeo(1.1, 1.62, 14, 0.035), { p: [L / 2 - 0.62, 0.4, W / 2 + 0.02], uv: 'keep', color: 0xffffff, ao: false });
    for (let i = 0; i < 12; i++) add('metal', S.torus(0.02, 0.003, 4, 10), { p: [L / 2 - 1.12 + i * 0.09, 2.02, W / 2 + 0.02], r: [0, Math.PI / 2, 0], color: CHROME, ao: false });
    // candles + bottles on the tub corner
    at(-L / 2 + 0.12, H, -W / 2 + 0.12, 0, () => { P.candle(0.1, 0.03, 0xffe0e8, true); at(0.1, 0, 0.02, 0, () => P.candle(0.07, 0.025, 0xffffff, true)); });
    for (const [x, c, h] of [[-0.6, 0xff9ec0, 0.2], [-0.5, 0x9ad0c8, 0.24], [-0.4, 0xffffff, 0.16]]) at(x, H, -W / 2 + 0.06, 0, () => P.bottle(h, 0.03, c, 0xffffff, 'plastic'));
    kit.collide(0, 0, L, W);
  });
  add('fabric', pillow(0.8, 0.03, 0.5, { puff: 0.6 }), { p: [8.7, 0.012, -5.75], color: PINK }); // bath mat

  // ---------------------------------------------------------------- toilet (west wall) + bidet sprayer
  at(4.95, 0, -5.4, Math.PI / 2, () => {
    add('gloss', S.lathe([[0, 0], [0.12, 0], [0.13, 0.1], [0.11, 0.26], [0.19, 0.38], [0.2, 0.4], [0.16, 0.4], [0.1, 0.34], [0, 0.34]], 32), { p: [0, 0, 0.1], s: [1, 1, 1.25], color: PORC });
    add('gloss', S.rbox(0.44, 0.4, 0.2, 0.03), { p: [0, 0.58, -0.2], color: PORC });
    add('gloss', S.rbox(0.46, 0.04, 0.22, 0.015), { p: [0, 0.8, -0.2], color: PORC });
    add('metal', S.cyl(0.02, 0.02, 0.012, 16), { p: [0, 0.822, -0.2], color: CHROME });
    add('plastic', S.cyl(0.19, 0.19, 0.03, 32), { p: [0, 0.42, 0.12], s: [1, 1, 1.25], color: PINK });
    add('plastic', S.cyl(0.19, 0.19, 0.025, 32), { p: [0, 0.6, -0.08], r: [-1.35, 0, 0], s: [1, 1, 1.25], color: PINK });
    kit.collide(0, 0.0, 0.46, 0.7);
  });
  at(4.6, 0, -6.05, Math.PI / 2, () => { // bidet sprayer on its hook + hose
    add('metal', S.rbox(0.05, 0.08, 0.03, 0.01), { p: [0, 0.75, 0.015], color: CHROME });
    add('plastic', S.rbox(0.035, 0.11, 0.04, 0.012), { p: [0, 0.76, 0.05], r: [0.2, 0, 0], color: 0xf4f4f4 });
    add('metal', cable([V(0, 0.45, 0.02), V(0.05, 0.25, 0.08), V(0.12, 0.2, 0.1), V(0.06, 0.55, 0.06), V(0, 0.7, 0.05)], 0.006), { color: CHROME, ao: false });
    add('metal', S.cyl(0.02, 0.02, 0.05, 12), { p: [0, 0.45, 0.025], r: [Math.PI / 2, 0, 0], color: CHROME });
  });
  at(4.6, 0.8, -4.85, Math.PI / 2, () => { // toilet paper holder
    add('metal', S.rbox(0.06, 0.06, 0.02, 0.01), { p: [0, 0, 0.01], color: CHROME });
    add('metal', S.cyl(0.008, 0.008, 0.14, 8), { p: [0.06, 0, 0.04], r: [0, 0, Math.PI / 2], color: CHROME });
    add('paint', S.cyl(0.055, 0.055, 0.1, 20), { p: [0.07, -0.02, 0.06], r: [0, 0, Math.PI / 2], color: 0xffffff });
  });
  at(4.85, 0, -4.7, 0, () => { add('plastic', S.cyl(0.1, 0.09, 0.28, 18), { p: [0, 0.14, 0], color: 0xfbe0ea }); add('plastic', S.cyl(0.105, 0.105, 0.02, 18), { p: [0, 0.29, 0], color: 0xff9ec0 }); });

  // ---------------------------------------------------------------- vanity + fogged mirror (east wall)
  at(9.62, 0, -3.3, -Math.PI / 2, () => {
    P.cabinet(0.95, 0.82, 0.5, { color: 0xc8a888, mat: 'wood', rows: [{ h: 1, kind: 'doors' }, { h: 0.45, kind: 'drawer' }], plinth: 0.06, top: { mat: 'gloss', color: 0xf4f2ee, t: 0.03 }, handle: 'bar', hColor: CHROME });
    add('gloss', S.lathe([[0, 0], [0.12, 0], [0.19, 0.05], [0.21, 0.13], [0.195, 0.13], [0.17, 0.06], [0, 0.02]], 32), { p: [0, 0.85, 0.02], color: PORC });
    add('metal', cable([V(0, 0.85, -0.2), V(0, 1.1, -0.2), V(0, 1.14, -0.12), V(0, 1.05, -0.04)], 0.012), { color: CHROME });
    add('metal', S.cyl(0.02, 0.02, 0.06, 12), { p: [0.08, 0.88, -0.2], color: CHROME });
    at(0, 0, -0.25, 0, () => {
      add('wood', S.rbox(0.72, 0.94, 0.03, 0.01), { p: [0, 1.62, 0.015], color: 0x3a2a22 });
      pic(A.mirrorWriting(), 0.64, 0.86, { p: [0, 1.62, 0.032], rough: 0.1, metal: 0.3 });
      add('metal', S.rbox(0.6, 0.05, 0.08, 0.01), { p: [0, 2.14, 0.05], color: CHROME });
      add('gloss', S.box(0.56, 0.01, 0.05), { p: [0, 2.115, 0.05], color: 0xe8f0f4, ao: false });
    });
    const T0 = 0.85;
    at(-0.34, T0, -0.1, 0, () => { add('gloss', S.cyl(0.035, 0.03, 0.1, 16), { p: [0, 0.05, 0], color: 0xffd6e2 }); for (const [c, a] of [[0xff5f95, 0.15], [0x5fc8ff, -0.1]]) add('plastic', S.cyl(0.006, 0.006, 0.19, 6), { p: [Math.sin(a) * 0.06, 0.13, 0], r: [0, 0, a], color: c }); });
    at(0.33, T0, -0.12, 0, () => { add('plastic', S.cyl(0.035, 0.035, 0.14, 16), { p: [0, 0.07, 0], color: 0xff9ec0 }); add('metal', S.cyl(0.01, 0.01, 0.05, 8), { p: [0, 0.16, 0], color: CHROME }); add('metal', S.box(0.05, 0.012, 0.015), { p: [0.02, 0.18, 0], color: CHROME }); });
    at(0.35, T0, 0.1, 0, () => P.plant('snake', 0xffffff, 0.35));
    kit.collide(0, 0, 0.95, 0.5);
  });

  // ---------------------------------------------------------------- water jar (โอ่ง) with dipper, stool, basin
  at(9.35, 0, -1.65, 0, () => {
    const prof = [[0, 0], [0.17, 0], [0.26, 0.1], [0.33, 0.3], [0.33, 0.42], [0.27, 0.58], [0.2, 0.64], [0.21, 0.67], [0.18, 0.67], [0.17, 0.62], [0, 0.6]];
    add('gloss', S.lathe(prof, 40), { color: (p, n, c) => { const y = p.y; return c.set(0x5a2a14).lerp(new THREE.Color(0xc89040), Math.abs(y - 0.4) < 0.05 ? 0.8 : 0.1 * Math.sin(Math.atan2(p.z + 1.65, p.x - 9.35) * 8) + 0.1); } });
    add('gloss', S.circle(0.19, 32), { p: [0, 0.6, 0], r: [-Math.PI / 2, 0, 0], color: 0x1a3a3a, uv: 'keep', ao: false });
    at(0.04, 0.61, 0.02, 0.6, () => { // floating dipper (ขัน)
      add('plastic', S.lathe([[0, 0], [0.06, 0], [0.09, 0.04], [0.1, 0.07], [0.095, 0.07], [0.085, 0.045], [0, 0.01]], 24), { color: 0xff7aa8 });
      add('plastic', S.rbox(0.14, 0.02, 0.035, 0.01), { p: [0.14, 0.055, 0], r: [0, 0, 0.3], color: 0xff7aa8 });
    });
    kit.collide(0, 0, 0.66, 0.66);
  });
  at(8.6, 0, -1.55, 0.3, () => { // pink plastic stool + basin
    add('plastic', S.cyl(0.14, 0.17, 0.25, 20, true), { p: [0, 0.125, 0], color: 0xff7aa8 });
    add('plastic', S.cyl(0.145, 0.145, 0.025, 20), { p: [0, 0.25, 0], color: 0xff7aa8 });
  });
  at(7.95, 0, -1.7, -0.2, () => {
    add('plastic', S.lathe([[0, 0], [0.18, 0], [0.26, 0.12], [0.27, 0.13], [0.25, 0.13], [0.17, 0.02], [0, 0.02]], 28), { color: 0x6ab8e8 });
    add('fabric', pillow(0.3, 0.07, 0.25, { wrinkle: 0.03 }), { p: [0, 0.08, 0], color: 0xf4f0e8 });
  });

  // ---------------------------------------------------------------- washing machine + basket (west wall)
  at(4.92, 0, -2.9, Math.PI / 2, () => {
    add('gloss', S.rbox(0.6, 0.85, 0.6, 0.03), { p: [0, 0.425, 0], color: 0xfafafa });
    add('metal', S.torus(0.17, 0.025, 10, 40), { p: [0, 0.42, 0.305], color: CHROME });
    add('glass', S.circle(0.16, 32), { p: [0, 0.42, 0.31], uv: 'keep', ao: false });
    add('fabric', S.sphere(0.15, 16, 10), { p: [0, 0.37, 0.18], s: [1, 0.7, 0.6], color: (p, n, c) => c.set([0xff9ec0, 0x6ab8e8, 0xffffff][Math.floor((p.x + p.y * 7) * 20) % 3]) });
    add('plastic', S.box(0.58, 0.1, 0.02), { p: [0, 0.78, 0.301], color: 0xe8ecef });
    add('metal', S.cyl(0.03, 0.03, 0.02, 20), { p: [0.18, 0.78, 0.31], r: [Math.PI / 2, 0, 0], color: CHROME });
    add('emit', S.box(0.08, 0.03, 0.004), { p: [-0.1, 0.78, 0.312], color: 0x7aff9a, emit: 1.4, ao: false });
    at(0, 0.85, 0, 0.2, () => { // laundry basket on top
      add('plastic', S.cyl(0.2, 0.17, 0.26, 20, true), { p: [0, 0.13, 0], color: 0xfff0f4 });
      add('fabric', sheetOver(0.34, 0.3, (nx, nz) => 0.3 + 0.05 * Math.cos(nx * 3) * Math.cos(nz * 2), { folds: 12 }), { p: [0, 0, 0], color: 0xb8a8d8 });
    });
    kit.collide(0, 0, 0.62, 0.62);
  });

  // ---------------------------------------------------------------- towel rail (south wall), shelf, drain
  at(8.6, 0, -1.1, Math.PI, () => {
    for (const y of [1.05, 1.45]) {
      add('metal', S.cyl(0.012, 0.012, 1.1, 10), { p: [0, y, 0.08], r: [0, 0, Math.PI / 2], color: CHROME });
      for (const s of [-1, 1]) add('metal', S.cyl(0.01, 0.01, 0.08, 8), { p: [s * 0.55, y, 0.04], r: [Math.PI / 2, 0, 0], color: CHROME });
    }
    for (const [x, y, c, w] of [[-0.25, 1.45, 0xffc0d8, 0.45], [0.25, 1.45, 0xffffff, 0.45], [0.05, 1.05, 0xb8e0d8, 0.6]]) {
      add('fabric', sheetOver(w, 0.05, () => 0.5, { folds: 10 }), { p: [x, y - 0.5, 0.08], color: c });
      add('fabric', S.cyl(0.03, 0.03, w, 12), { p: [x, y, 0.08], r: [0, 0, Math.PI / 2], color: c });
    }
  });
  at(9.9, 1.6, -5.4, -Math.PI / 2, () => {
    P.wallShelf(0.6, 0.18, 0xffffff);
    for (const [x, c] of [[-0.2, 0xff9ec0], [-0.08, 0xffffff], [0.05, 0x9ad0c8]]) at(x, 0.0125, 0.09, 0, () => P.bottle(0.16, 0.028, c, 0xffffff, 'plastic'));
    at(0.2, 0.0125, 0.09, 0, () => P.plush('ghost', 0xf4f2ff));
  });
  add('metal', S.cyl(0.06, 0.06, 0.004, 16), { p: [7.4, 0.002, -4.3], color: 0x9aa0a8, ao: false });
  at(9.9 - 0.18, 2.8, -6.9 + 0.18, -Math.PI / 4, () => P.cobweb(0.52), 0.3);

  // floating toilet paper roll (it bobs and turns by itself)
  const tp = kit.capture(M, () => {
    add('paint', S.cyl(0.06, 0.06, 0.11, 20), { r: [0, 0, Math.PI / 2], color: 0xffffff, ao: false });
    add('paint', S.cyl(0.022, 0.022, 0.113, 10), { r: [0, 0, Math.PI / 2], color: 0x8a6a4a, ao: false });
    add('paint', S.box(0.1, 0.35, 0.004), { p: [0, -0.17, 0.058], r: [0.08, 0, 0], color: 0xffffff, ao: false });
  });
  tp.position.set(6.9, 1.35, -4.2); root.add(tp);
  anim.push((dt, t) => { tp.position.y = 1.35 + Math.sin(t * 1.3) * 0.12; tp.rotation.y = t * 0.5; tp.rotation.z = Math.sin(t * 0.7) * 0.4; });
  lights.push({ color: 0x5fffc0, intensity: 1.3, dist: 5.5, p: [7.0, 2.3, -4.5], kind: 'room' });

  return {
    lights,
    itemSpots: [V(8.6, 0.44, -6.4), V(4.92, 0.87, -2.9), V(8.9, 0.02, -2.2)],
    navPoints: [V(6.5, 0, -3.5), V(8.3, 0, -4.4)],
    ghostSpawns: [V(7.0, 0, -4.0)],
    update(dt, t) { for (const f of anim) f(dt, t); },
  };
}
