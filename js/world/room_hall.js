// Hallway (x -10..10, z -1..1) and the spare room (x -2..4.5, z -7..-1).
import * as THREE from 'three';
import { shapes as S, heartShape } from './kit.js';
import { pillow, sheetOver, cable, duvet } from './soft.js';
import * as A from './art.js';

const TAU = Math.PI * 2;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const DARK = 0x3a2418, GOLD = 0xc8a060;

/** Pendant lamp (local origin at the ceiling). on → glowing bulb. */
function pendant(P, drop = 0.5, on = false, shade = 0x2a2a2e) {
  const { add } = P;
  add('metal', S.cyl(0.05, 0.05, 0.02, 16), { p: [0, -0.01, 0], color: shade, ao: false });
  add('plastic', S.cyl(0.004, 0.004, drop, 6), { p: [0, -drop / 2, 0], color: 0x111111, ao: false });
  add('metal', S.lathe([[0.03, 0], [0.04, -0.03], [0.14, -0.16], [0.15, -0.18], [0.13, -0.18], [0.03, -0.035]], 24), { p: [0, -drop, 0], color: shade, ao: false });
  add(on ? 'emitFlicker' : 'gloss', S.sphere(0.04, 14, 10), { p: [0, -drop - 0.11, 0], color: on ? 0xffc890 : 0xe8e0d0, emit: on ? 4 : 1, ao: false });
}
function balloon(P, x, z, h, color) {
  const { add } = P;
  add('gloss', S.sphere(0.13, 20, 16), { p: [x, h, z], s: [1, 1.2, 1], color, ao: false });
  add('gloss', S.cone(0.018, 0.03, 8), { p: [x, h - 0.165, z], r: [Math.PI, 0, 0], color, ao: false });
  add('plastic', cable([V(x, h - 0.18, z), V(x + 0.03, h - 0.6, z + 0.02), V(x - 0.02, 0.9, z)], 0.0015), { color: 0xdddddd, ao: false });
}
function shoe(P, x, z, ry, color, sole = 0xf4f4f4, kind = 'sneaker') {
  const { add, at } = P;
  at(x, 0, z, ry, () => {
    if (kind === 'slipper') {
      add('plush', S.rbox(0.1, 0.035, 0.26, 0.017), { p: [0, 0.018, 0], color });
      add('plush', S.sphere(0.055, 12, 8, 0, TAU, 0, Math.PI / 2), { p: [0, 0.03, 0.06], s: [1, 0.8, 1.2], color });
      for (const s of [-1, 1]) add('plush', S.sphere(0.02, 8, 6), { p: [s * 0.03, 0.09, 0.08], s: [0.6, 1.6, 0.6], color });
      return;
    }
    add('plastic', S.rbox(0.1, 0.03, 0.27, 0.015), { p: [0, 0.015, 0], color: sole });
    add('fabric', S.rbox(0.095, 0.07, 0.24, 0.035), { p: [0, 0.055, -0.01], color });
    add('fabric', S.rbox(0.09, 0.05, 0.1, 0.02), { p: [0, 0.09, -0.07], color });
    add('plastic', S.box(0.06, 0.004, 0.08), { p: [0, 0.092, 0.03], color: 0xf8f8f8 });
  });
}

export function roomHall(P, kit, M, root) {
  const { add, at, pic, framed } = P;
  const lights = [], anim = [];

  // runner rugs along the hallway
  for (const x of [-6.6, -1.2, 4.2]) at(x, 0, 0, Math.PI / 2, () => P.rug(A.runnerRug(), 0.85, 3.4, { y: 0.004 }));

  // ---------------------------------------------------------------- entrance (west end)
  at(-9.94, 1.55, 0, Math.PI / 2, () => { // Halloween wreath on the front door
    add('fabric', S.torus(0.2, 0.05, 10, 32), { color: 0x1a1016 });
    for (let i = 0; i < 18; i++) {
      const a = i / 18 * TAU;
      add('plastic', S.sphere(0.03, 8, 6), { p: [Math.cos(a) * 0.2, Math.sin(a) * 0.2, 0.04], color: [0xff7a1a, 0x8a4ac8, 0x1a1016, 0xffb030][i % 4] });
    }
    add('fabric', S.sphere(0.05, 10, 8), { p: [0, -0.21, 0.05], s: [1.4, 0.8, 0.6], color: 0xff7a1a });
    for (const s of [-1, 1]) add('fabric', S.cone(0.03, 0.14, 6), { p: [s * 0.04, -0.29, 0.05], r: [0, 0, s * 0.3 + Math.PI], s: [1, 1, 0.3], color: 0xff7a1a });
    at(0, 0.02, 0.05, 0, () => P.bat(1.1));
  });
  at(-9.4, 0, 0, Math.PI / 2, () => P.rug(A.doormat(), 0.9, 0.6, { y: 0.005 }));
  // shoe rack with shoes, slippers left by the mat
  at(-9.05, 0, 0.74, Math.PI, () => {
    add('wood', S.rbox(1.0, 0.025, 0.3, 0.005), { p: [0, 0.42, 0], color: 0x8a6a4a });
    add('wood', S.rbox(1.0, 0.02, 0.3, 0.005), { p: [0, 0.2, 0], color: 0x8a6a4a });
    for (const s of [-1, 1]) add('wood', S.box(0.025, 0.43, 0.3), { p: [s * 0.49, 0.215, 0], color: 0x6a4a2a });
    const pal = [[0xff8cbf, 0xffffff], [0x2a2a30, 0xf4f4f4], [0xfff4f0, 0xff8cbf], [0x6a8aff, 0xffffff], [0xe8e0d0, 0xc8a070]];
    for (let i = 0; i < 4; i++) for (const [y, off] of [[0.21, 0], [0.435, 0.06]]) {
      const [c, so] = pal[(i + (y > 0.3 ? 2 : 0)) % pal.length];
      for (const s of [-1, 1]) at(-0.36 + i * 0.24 + s * 0.055 + off, y, 0, 0, () => shoe(P, 0, 0, Math.PI, c, so));
    }
    at(0.25, 0.44, 0, 0.2, () => P.pumpkin(0.1));
    kit.collide(0, 0, 1.0, 0.3);
  });
  shoe(P, -9.2, -0.15, 1.3, 0xffb0d0, 0, 'slipper'); shoe(P, -9.18, 0.02, 1.5, 0xffb0d0, 0, 'slipper');
  shoe(P, -9.6, 0.35, 2.2, 0x2a2a30); shoe(P, -9.55, 0.5, 1.9, 0x2a2a30);
  // umbrella stand + jack-o'-lantern by the door
  at(-9.62, 0, -0.62, 0, () => {
    add('metalRough', S.cyl(0.11, 0.1, 0.5, 20, true), { p: [0, 0.25, 0], color: 0x3a3a40 });
    add('metalRough', S.cyl(0.1, 0.1, 0.01, 20), { p: [0, 0.005, 0], color: 0x3a3a40 });
    for (const [a, c] of [[0.1, 0xff8cbf], [-0.12, 0x2a4a8a]]) {
      at(Math.sin(a) * 0.04, 0, 0, a, () => {
        add('fabric', S.cone(0.05, 0.75, 8), { p: [0, 0.45, 0], color: c });
        add('metal', S.cyl(0.004, 0.004, 0.25, 6), { p: [0, 0.95, 0], color: 0x888888 });
        add('plastic', S.torus(0.03, 0.008, 6, 12, Math.PI), { p: [0.03, 1.07, 0], r: [0, 0, Math.PI], color: 0x2a1a14 });
      }, 0, a);
    }
    kit.collide(0, 0, 0.24, 0.24);
  });
  at(-9.55, 0, -0.25, Math.PI / 2 + 0.3, () => P.pumpkin(0.17));
  lights.push({ color: 0xff8a2a, intensity: 1.5, dist: 3.2, p: [-9.3, 0.45, -0.25], kind: 'candle' });
  // coat hooks with a coat and a tote bag
  at(-8.7, 1.72, -0.9, 0, () => {
    add('wood', S.rbox(0.7, 0.08, 0.02, 0.006), { p: [0, 0, 0.01], color: DARK });
    for (let i = 0; i < 4; i++) add('metal', S.cyl(0.006, 0.006, 0.06, 6), { p: [-0.27 + i * 0.18, 0, 0.04], r: [Math.PI / 2 - 0.4, 0, 0], color: GOLD });
    add('fabric', sheetOver(0.34, 0.12, (nx, nz) => 0.85 - 0.25 * nx * nx), { p: [-0.18, -0.9, 0.08], color: 0x5a4a6a });
    add('fabric', S.rbox(0.28, 0.32, 0.05, 0.02), { p: [0.2, -0.24, 0.07], color: 0xf4e8dc });
    add('fabric', S.torus(0.09, 0.008, 6, 16, Math.PI), { p: [0.2, -0.08, 0.07], color: 0xf4e8dc });
    pic(A.merchLabel(), 0.16, 0.1, { p: [0.2, -0.26, 0.097] });
  });

  // ---------------------------------------------------------------- console table + ornate mirror (north wall)
  at(-6.9, 0, -0.74, 0, () => {
    P.cabinet(1.2, 0.8, 0.32, { color: DARK, mat: 'wood', rows: [{ h: 1.5, kind: 'open' }, { h: 1, kind: 'drawer' }], plinth: 0.0, top: { mat: 'wood', color: 0x4a2e1e, t: 0.03 }, handle: 'knob', hColor: GOLD });
    const T0 = 0.83;
    at(-0.4, T0, 0, 0, () => { // lamp (off)
      add('gloss', S.lathe([[0, 0], [0.07, 0], [0.09, 0.12], [0.05, 0.28], [0.015, 0.3], [0, 0.3]], 20), { color: 0x2a4a5a });
      add('fabric', S.cyl(0.08, 0.13, 0.18, 24, true), { p: [0, 0.4, 0], color: 0xe8dcc8 });
    });
    at(0.0, T0, 0.02, 0, () => { // vase of dead roses
      add('gloss', S.lathe([[0, 0], [0.05, 0], [0.07, 0.08], [0.04, 0.2], [0.05, 0.24], [0, 0.22]], 18), { color: 0x1a1a24 });
      for (let i = 0; i < 5; i++) { const a = i * 1.3; add('plastic', cable([V(0, 0.2, 0), V(Math.cos(a) * 0.06, 0.32, Math.sin(a) * 0.04), V(Math.cos(a) * 0.1, 0.36, Math.sin(a) * 0.06)], 0.003), { color: 0x3a3020, ao: false }); add('plush', S.sphere(0.025, 8, 6), { p: [Math.cos(a) * 0.1, 0.37, Math.sin(a) * 0.06], s: [1, 0.7, 1], color: 0x4a0a14 }); }
    });
    at(0.32, T0, 0.03, 0, () => {
      add('gloss', S.lathe([[0, 0], [0.04, 0], [0.12, 0.05], [0.13, 0.07], [0, 0.02]], 20), { color: 0xff7a1a });
      for (let i = 0; i < 9; i++) add('gloss', S.sphere(0.017, 8, 6), { p: [Math.cos(i * 2.4) * (i % 3) * 0.03, 0.05, Math.sin(i * 2.4) * (i % 3) * 0.03], s: [1.4, 0.8, 0.8], color: [0x1a1020, 0x8a4ac8, 0xff5f95][i % 3] });
    });
    at(0.48, T0, -0.05, -0.2, () => framed(A.familyPhoto(11, true), 0.14, 0.11, { frame: GOLD, mat: 'metal' }), -0.25);
    at(0, 1.72, -0.16, 0, () => { // big mirror with a carved gold frame
      add('mirror', S.plane(0.62, 0.86), { p: [0, 0, 0.012], uv: 'keep', color: 0x9aa4b0, ao: false });
      const fr = new THREE.Shape(), hole = new THREE.Path();
      fr.moveTo(-0.42, -0.55); fr.lineTo(0.42, -0.55); fr.lineTo(0.42, 0.45); fr.quadraticCurveTo(0.2, 0.52, 0, 0.64); fr.quadraticCurveTo(-0.2, 0.52, -0.42, 0.45); fr.closePath();
      hole.moveTo(-0.31, -0.43); hole.lineTo(0.31, -0.43); hole.lineTo(0.31, 0.43); hole.lineTo(-0.31, 0.43); hole.closePath();
      fr.holes.push(hole);
      add('metal', S.extrude(fr, 0.03, 0.01, 12), { p: [0, 0, 0.015], color: 0xb8904a });
      add('metal', S.sphere(0.03, 12, 8), { p: [0, 0.62, 0.03], color: 0xd8b060 });
    });
  });

  // ---------------------------------------------------------------- walls: frames, clock, switches, bench, shelves
  const gallery = [[-8.6, 1.55, 0.9, Math.PI, 5, 0.03], [-8.0, 1.75, 0.9, Math.PI, 9, -0.05], [-7.3, 1.5, 0.9, Math.PI, 2, 0.02], [-4.6, 1.6, 0.9, Math.PI, 13, -0.08],
    [-1.8, 1.65, -0.9, 0, 21, 0.04], [-0.9, 1.5, -0.9, 0, 17, -0.03], [3.0, 1.62, -0.9, 0, 23, 0.06], [4.4, 1.55, -0.9, 0, 29, -0.02], [3.2, 1.6, 0.9, Math.PI, 31, 0.03], [4.6, 1.72, 0.9, Math.PI, 37, -0.1]];
  gallery.forEach(([x, y, z, ry, seed, tilt], i) => at(x, y, z, ry, () => framed(A.familyPhoto(seed, i % 4 === 1), 0.3, 0.24, { frame: i % 3 ? DARK : GOLD, mat: i % 3 ? 'wood' : 'metal', tilt })));
  at(-5.6, 2.1, 0.9, Math.PI, () => { // wall clock stopped at three
    add('wood', S.cyl(0.19, 0.19, 0.04, 40), { p: [0, 0, 0.02], r: [Math.PI / 2, 0, 0], color: DARK });
    pic(A.clockFace(), 0.33, 0.33, { p: [0, 0, 0.041] });
  });
  for (const [x, z, ry] of [[-4.72, -0.9, 0], [0.8, -0.9, 0], [6.1, -0.9, 0], [-3.7, 0.9, Math.PI], [5.62, 0.9, Math.PI]]) {
    at(x, 1.2, z, ry, () => { add('plastic', S.rbox(0.08, 0.12, 0.012, 0.004), { p: [0, 0, 0.006], color: 0xf4f0e8 }); add('plastic', S.box(0.018, 0.035, 0.01), { p: [0, 0, 0.015], r: [0.2, 0, 0], color: 0xe8e4dc }); });
  }
  at(-1.1, 0, -0.72, 0, () => { // bench with a cushion + pumpkin
    add('wood', S.rbox(1.0, 0.05, 0.34, 0.01), { p: [0, 0.44, 0], color: DARK });
    P.legs4('wood', 0.96, 0.3, 0.42, 0.02, DARK, 0.02, 'box');
    add('fabric', pillow(0.4, 0.08, 0.3), { p: [-0.22, 0.5, 0], color: 0x8a3a4a });
    at(0.25, 0.465, 0, 0.3, () => P.pumpkin(0.12, { lit: false }));
    kit.collide(0, 0, 1.0, 0.34);
  });
  at(5.3, 1.3, -0.9, 0, () => { // shelf with plants
    P.wallShelf(0.8, 0.18, DARK, 'wood');
    at(-0.2, 0.0125, 0.09, 0, () => P.plant('snake', 0x2a2a30, 0.45));
    at(0.2, 0.0125, 0.09, 0, () => P.candle(0.14, 0.03, 0x2a1a24, false));
  });

  // pendulum clock (south wall), stopped at 3:00
  at(0.9, 0, 0.74, Math.PI, () => {
    add('wood', S.rbox(0.46, 1.9, 0.3, 0.02), { p: [0, 0.95, 0], color: 0x4a2a1a });
    add('wood', S.rbox(0.52, 0.12, 0.34, 0.02), { p: [0, 0.06, 0], color: 0x3a2012 });
    const top = new THREE.Shape(); top.moveTo(-0.26, 0); top.lineTo(0.26, 0); top.lineTo(0.26, 0.1); top.quadraticCurveTo(0, 0.28, -0.26, 0.1); top.closePath();
    add('wood', S.extrude(top, 0.32, 0.01), { p: [0, 1.9, 0], color: 0x3a2012 });
    add('metal', S.cyl(0.16, 0.16, 0.02, 40), { p: [0, 1.58, 0.15], r: [Math.PI / 2, 0, 0], color: GOLD });
    pic(A.clockFace(), 0.28, 0.28, { p: [0, 1.58, 0.162] });
    add('glass', S.plane(0.3, 0.8), { p: [0, 0.85, 0.152], uv: 'keep', ao: false });
    add('wood', S.box(0.34, 0.84, 0.01), { p: [0, 0.85, 0.02], color: 0x1a0e08 });
    add('metal', S.cyl(0.004, 0.004, 0.6, 6), { p: [0.04, 0.95, 0.08], r: [0, 0, 0.12], color: GOLD });
    add('metal', S.cyl(0.07, 0.07, 0.012, 24), { p: [0.1, 0.62, 0.08], r: [Math.PI / 2, 0, 0], color: 0xd8b060 });
    kit.collide(0, 0, 0.52, 0.34);
  });

  // ---------------------------------------------------------------- east end: 249 banner, balloons, bunting
  at(9.9, 1.95, 0, -Math.PI / 2, () => {
    pic(A.banner249(), 1.7, 0.57, { p: [0, 0, 0.035], rough: 0.9 });
    for (const s of [-1, 1]) add('plastic', cable([V(s * 0.85, 0.28, 0.035), V(s * 0.95, 0.5, 0.02), V(s * 1.0, 0.7, 0.0)], 0.002), { color: 0x222222, ao: false });
  });
  for (const [x, z, h, c] of [[9.55, -0.62, 1.9, 0xff7a1a], [9.62, -0.45, 1.75, 0x1a1020], [9.48, -0.72, 1.62, 0x8a4ac8], [9.55, 0.62, 1.88, 0x8a4ac8], [9.62, 0.46, 1.7, 0xff7a1a], [9.47, 0.74, 1.6, 0x1a1020]]) balloon(P, x, z, h, c);
  add('metal', S.box(0.05, 0.05, 0.05), { p: [9.55, 0.9, -0.6], color: 0x888888 });
  at(9.5, 0, 0.0, -Math.PI / 2, () => P.pumpkin(0.2));
  P.bunting(V(-8.5, 2.6, -0.88), V(-2.5, 2.6, 0.88), 16);
  P.bunting(V(2.5, 2.6, 0.88), V(9.8, 2.6, -0.88), 18);
  at(9.9 - 0.18, 2.8, -0.9 + 0.18, -Math.PI / 4, () => P.cobweb(0.52), 0.3);
  at(-9.9 + 0.18, 2.8, 0.9 - 0.18, Math.PI * 3 / 4, () => P.cobweb(0.5), 0.3);

  // ---------------------------------------------------------------- pendant lamps (one swings, one is on)
  at(-6.5, 2.8, 0, 0, () => pendant(P, 0.35, false));
  at(-2.0, 2.8, 0, 0, () => pendant(P, 0.35, true));
  at(8.0, 2.8, 0, 0, () => pendant(P, 0.35, false));
  lights.push({ color: 0xffb070, intensity: 2.2, dist: 6.5, p: [-2, 2.3, 0], kind: 'bulb' });
  const swing = kit.capture(M, () => pendant(P, 0.7, true, 0x4a3a30));
  swing.position.set(3.4, 2.8, 0);
  root.add(swing);
  const swingLight = { color: 0xffb070, intensity: 1.6, dist: 5, p: [3.4, 1.95, 0], kind: 'bulb', follow: null };
  lights.push(swingLight);
  anim.push((dt, t, L) => {
    swing.rotation.z = Math.sin(t * 1.3) * 0.16; swing.rotation.x = Math.sin(t * 0.9 + 1) * 0.06;
    if (L) { L.position.set(3.4 + Math.sin(swing.rotation.z) * 0.8, 2.8 - 0.8 * Math.cos(swing.rotation.z), -Math.sin(swing.rotation.x) * 0.8); }
  });

  return {
    lights, anim,
    itemSpots: [V(-9.05, 0.44, 0.74), V(-6.5, 0.84, -0.74), V(9.35, 0.02, 0.35)],
    navPoints: [V(-8.0, 0, 0), V(-4.0, 0, 0), V(0, 0, 0), V(4.0, 0, 0), V(8.0, 0, 0)],
    ghostSpawns: [V(8.6, 0, 0)],
    update(dt, t) { for (const f of anim) f(dt, t, swingLight.ref); },
  };
}

// =====================================================================================================
// spare room: dust sheets, a rocking chair that rocks by itself, cosplay rack, dress form, vanity bulbs
export function roomGuest(P, kit, M, root) {
  const { add, at, pic, framed } = P;
  const lights = [], anim = [];
  const SHEET = 0xeeeae2;

  // faded rug
  at(1.0, 0, -4.1, 0.08, () => P.rug(A.livingRug(), 2.4, 1.7, { y: 0.004 }));
  // bed under a dust sheet (west wall), old trunk at its foot
  at(-1.33, 0, -5.2, 0, () => {
    add('fabric', sheetOver(1.08, 2.08, (nx, nz) => 0.52 + 0.5 * smooth(-0.8, -0.95, nz) + 0.04 * Math.cos(nx * 1.4), { seed: 2 }), { color: SHEET });
    kit.collide(0, 0, 1.08, 2.08);
  });
  at(-1.38, 0, -3.72, 0, () => {
    add('wood', S.rbox(0.8, 0.4, 0.45, 0.02), { p: [0, 0.2, 0], color: 0x5a3420 });
    add('wood', S.cyl(0.225, 0.225, 0.8, 24, false), { p: [0, 0.4, 0], r: [0, 0, Math.PI / 2], s: [1, 0.35, 1], color: 0x5a3420 });
    for (const x of [-0.3, 0.3]) add('metal', S.box(0.04, 0.46, 0.46), { p: [x, 0.25, 0], color: 0x8a7040 });
    add('metal', S.box(0.08, 0.08, 0.02), { p: [0, 0.34, 0.235], color: GOLD });
    kit.collide(0, 0, 0.8, 0.45);
  });
  // armchair and a tall mirror under sheets
  at(0.3, 0, -2.9, 0.5, () => { add('fabric', sheetOver(0.85, 0.85, (nx, nz) => 0.48 + 0.5 * smooth(-0.35, -0.75, nz) + 0.2 * smooth(0.55, 0.85, Math.abs(nx)) * (1 - smooth(-0.3, -0.7, nz)), { seed: 4 }), { color: SHEET }); kit.collide(0, 0, 0.85, 0.85); });
  at(3.75, 0, -6.45, -0.3, () => { add('fabric', sheetOver(0.7, 0.3, (nx, nz) => 1.85 - 0.08 * nx * nx, { seed: 6, folds: 30 }), { color: SHEET }); kit.collide(0, 0, 0.7, 0.35); });
  // antique wardrobe, one door open with clothes inside
  at(4.1, 0, -4.7, -Math.PI / 2, () => {
    const w = 1.1, h = 2.05, d = 0.55;
    add('wood', S.box(w, h - 0.1, 0.02), { p: [0, h / 2 + 0.05, -d / 2 + 0.01], color: 0x3a2014 });
    for (const s of [-1, 1]) add('wood', S.rbox(0.03, h - 0.1, d, 0.006), { p: [s * (w / 2 - 0.015), h / 2 + 0.05, 0], color: 0x4a2a18 });
    add('wood', S.rbox(w + 0.06, 0.08, d + 0.04, 0.01), { p: [0, h + 0.04, 0], color: 0x3a2012 });
    add('wood', S.rbox(w, 0.1, d, 0.01), { p: [0, 0.05, 0], color: 0x3a2012 });
    add('wood', S.rbox(w / 2 - 0.01, h - 0.14, 0.025, 0.008), { p: [-w / 4, h / 2 + 0.05, d / 2], color: 0x4a2a18 });
    add('mirror', S.plane(w / 2 - 0.12, h - 0.5), { p: [-w / 4, h / 2 + 0.07, d / 2 + 0.014], uv: 'keep', color: 0x8a8e96, ao: false });
    at(w / 2 - 0.01, 0, d / 2, 1.9, () => { // open right door
      add('wood', S.rbox(w / 2 - 0.01, h - 0.14, 0.025, 0.008), { p: [-(w / 4), h / 2 + 0.05, 0], color: 0x4a2a18 });
      add('metal', S.sphere(0.018, 10, 8), { p: [-(w / 2) + 0.06, 1.05, 0.02], color: GOLD });
    });
    add('metal', S.cyl(0.01, 0.01, w - 0.06, 8), { p: [0, h - 0.2, 0], r: [0, 0, Math.PI / 2], color: 0xb8b0a0 });
    for (let i = 0; i < 6; i++) { // hanging clothes
      const x = 0.05 + i * 0.075, c = [0xff8cbf, 0x2a2a3a, 0xf4f0e8, 0x8a4ac8, 0xff7a1a, 0x6ab0c8][i];
      add('metal', S.torus(0.05, 0.004, 4, 12, Math.PI), { p: [x, h - 0.26, 0], r: [0, Math.PI / 2, Math.PI], color: 0xc8c0b0, ao: false });
      add('fabric', sheetOver(0.34, 0.06, (nx) => 0.9 - 0.1 * nx * nx, { seed: i, folds: 14 }), { p: [x, h - 1.2, 0], r: [0, Math.PI / 2, 0], color: c });
    }
    kit.collide(0, 0, w, d);
  });
  // cosplay rack under the window side
  at(2.6, 0, -6.45, 0, () => {
    for (const s of [-1, 1]) {
      add('metal', S.cyl(0.012, 0.012, 1.6, 8), { p: [s * 0.65, 0.8, 0], color: 0xc8c8d0 });
      add('metal', S.cyl(0.01, 0.01, 0.5, 8), { p: [s * 0.65, 0.03, 0], r: [Math.PI / 2, 0, 0], color: 0xc8c8d0 });
    }
    add('metal', S.cyl(0.012, 0.012, 1.34, 8), { p: [0, 1.6, 0], r: [0, 0, Math.PI / 2], color: 0xc8c8d0 });
    const outfits = [[0x1a1a24, 0xffffff, 'maid'], [0x1a1024, 0x8a4ac8, 'witch'], [0xff8cbf, 0xffffff, 'idol'], [0x2a3a6a, 0xd8b060, 'uniform'], [0xf4f0f8, 0xff8cbf, 'jacket']];
    outfits.forEach(([c, trim], i) => at(-0.5 + i * 0.25, 1.6, 0, 0.2 * (i % 2 ? 1 : -1), () => {
      add('metal', S.torus(0.09, 0.005, 4, 16, Math.PI), { p: [0, -0.06, 0], r: [0, 0, Math.PI], color: 0xd8d0c0, ao: false });
      add('metal', S.cyl(0.003, 0.003, 0.06, 4), { p: [0, -0.02, 0], color: 0xd8d0c0, ao: false });
      add('fabric', sheetOver(0.36, 0.1, (nx) => 0.55 - 0.15 * nx * nx), { p: [0, -0.7, 0], r: [Math.PI, 0, 0], s: [1, -1, 1], color: c });
      add('fabric', sheetOver(0.46, 0.28, () => 0.4, { folds: 30, seed: i }), { p: [0, -1.12, 0], color: c });
      add('fabric', S.box(0.3, 0.03, 0.12), { p: [0, -0.72, 0], color: trim });
    }));
    kit.collide(0, 0, 1.4, 0.5);
  });
  // dress form wearing a pink jacket
  at(1.9, 0, -5.4, 0.6, () => {
    add('wood', S.cyl(0.18, 0.2, 0.03, 5), { p: [0, 0.015, 0], color: 0x2a1a14 });
    add('metal', S.cyl(0.012, 0.012, 1.0, 8), { p: [0, 0.52, 0], color: GOLD });
    add('fabric', S.lathe([[0.0, 0], [0.16, 0], [0.18, 0.12], [0.14, 0.3], [0.19, 0.46], [0.16, 0.56], [0.06, 0.62], [0.04, 0.66], [0, 0.66]], 24), { p: [0, 0.98, 0], s: [1, 1, 0.72], color: 0xe8dcc8 });
    add('fabric', S.lathe([[0.0, 0.12], [0.2, 0.12], [0.2, 0.3], [0.21, 0.46], [0.18, 0.57], [0.07, 0.63], [0, 0.63]], 24, ), { p: [0, 0.98, 0], s: [1.06, 1, 0.8], color: 0xffb8d0 });
    add('wood', S.sphere(0.03, 10, 8), { p: [0, 1.66, 0], color: 0x2a1a14 });
    kit.collide(0, 0, 0.42, 0.42);
  });
  // Hollywood vanity on the south wall, a few bulbs still working
  const bulbs = [];
  at(-0.75, 0, -1.34, Math.PI, () => {
    P.cabinet(1.1, 0.75, 0.42, { color: 0xf4efe8, mat: 'paint', rows: [{ h: 1, kind: 'doors' }, { h: 0.6, kind: 'drawer' }], top: { mat: 'gloss', color: 0xfbf8f4, t: 0.03 }, handle: 'knob', hColor: GOLD });
    at(0, 0, -0.2, 0, () => {
      add('paint', S.rbox(0.95, 0.8, 0.04, 0.02), { p: [0, 1.28, 0.0], color: 0xf4efe8 });
      add('mirror', S.plane(0.75, 0.6), { p: [0, 1.28, 0.022], uv: 'keep', color: 0x9aa0a8, ao: false });
      let k = 0;
      for (const [x, y] of [[-0.42, 0.98], [-0.42, 1.18], [-0.42, 1.38], [-0.42, 1.58], [-0.21, 1.64], [0, 1.64], [0.21, 1.64], [0.42, 1.58], [0.42, 1.38], [0.42, 1.18], [0.42, 0.98]]) {
        const on = [0, 2, 3, 5, 8, 9].includes(k++);
        add(on ? 'emitFlicker' : 'gloss', S.sphere(0.025, 12, 10), { p: [x, y, 0.04], color: on ? 0xffd8a0 : 0xe8e0d4, emit: on ? 3.5 : 1, ao: false });
        if (on) bulbs.push([x, y]);
      }
    });
    const T0 = 0.78;
    for (const [x, c] of [[-0.35, 0xff8cbf], [-0.28, 0xffffff], [0.3, 0xd8c0ff]]) at(x, T0, 0.02, 0, () => P.bottle(0.1, 0.02, c, GOLD, 'glass'));
    at(0.05, T0, 0.05, 0, () => { // mannequin head with a pink wig
      add('gloss', S.cyl(0.03, 0.05, 0.12, 12), { p: [0, 0.06, 0], color: 0xf0e4dc });
      add('gloss', S.sphere(0.09, 20, 16), { p: [0, 0.21, 0], s: [0.85, 1.05, 0.95], color: 0xf0e4dc });
      add('plush', S.sphere(0.1, 20, 16, 0, TAU, 0, Math.PI * 0.62), { p: [0, 0.23, -0.01], s: [0.95, 1.05, 1.02], color: 0xff9ac0 });
      for (const s of [-1, 1]) add('plush', S.cyl(0.035, 0.02, 0.3, 10), { p: [s * 0.08, 0.1, -0.02], color: 0xff9ac0 });
    });
    kit.collide(0, 0, 1.1, 0.42);
  });
  lights.push({ color: 0xffcf98, intensity: 1.3, dist: 3.8, p: [-0.75, 1.4, -1.75], kind: 'flicker' });
  // rocking chair that rocks by itself, facing the door
  const rocker = kit.capture(M, () => {
    const W2 = 0.5;
    for (const s of [-1, 1]) {
      const pts = []; for (let i = 0; i <= 12; i++) { const a = -0.55 + i / 12 * 1.1; pts.push(V(s * W2 / 2, 0.9 * (1 - Math.cos(a)) + 0.02, Math.sin(a) * 0.9)); }
      add('wood', new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.015, 6), { color: 0x5a3420, ao: false });
      for (const z of [-0.2, 0.2]) add('wood', S.cyl(0.015, 0.015, 0.42, 8), { p: [s * W2 / 2, 0.23, z], color: 0x5a3420, ao: false });
      add('wood', S.cyl(0.014, 0.014, 0.95, 8), { p: [s * W2 / 2, 0.85, -0.24], r: [-0.18, 0, 0], color: 0x5a3420, ao: false });
      add('wood', S.rbox(0.05, 0.03, 0.45, 0.01), { p: [s * W2 / 2, 0.62, -0.01], color: 0x5a3420, ao: false });
    }
    add('wood', S.rbox(W2 + 0.04, 0.035, 0.46, 0.01), { p: [0, 0.44, 0], color: 0x6a4028, ao: false });
    for (let i = 0; i < 5; i++) add('wood', S.cyl(0.01, 0.01, 0.55, 6), { p: [-0.18 + i * 0.09, 0.75, -0.3], r: [-0.18, 0, 0], color: 0x6a4028, ao: false });
    add('wood', S.rbox(W2 + 0.06, 0.07, 0.04, 0.015), { p: [0, 1.07, -0.35], r: [-0.18, 0, 0], color: 0x5a3420, ao: false });
    add('fabric', pillow(0.4, 0.06, 0.4), { p: [0, 0.48, 0], color: 0x8a3a4a, ao: false });
    at(0, 0.5, -0.05, 0, () => P.plush('bear', 0xc8a080));
  });
  rocker.position.set(1.2, 0, -4.9); rocker.rotation.y = 0.25;
  root.add(rocker);
  kit.collide(1.2, -4.9, 0.6, 0.8);
  anim.push((dt, t) => { rocker.rotation.x = Math.sin(t * 1.6) * 0.14; });
  // boxes stacked in the corner, a suitcase, frames (one fallen)
  const box = (x, y, z, w, h, d, ry, label) => at(x, y, z, ry, () => {
    add('paint', S.rbox(w, h, d, 0.006), { p: [0, h / 2, 0], color: 0xc8a070 });
    add('paint', S.box(w + 0.002, 0.004, 0.06), { p: [0, h, 0], color: 0xd8c0a0 });
    if (label) pic(A.merchLabel(), w * 0.6, w * 0.38, { p: [0, h * 0.55, d / 2 + 0.002] });
  });
  box(3.9, 0, -1.7, 0.6, 0.45, 0.5, 0.1, true); box(3.95, 0.45, -1.72, 0.5, 0.38, 0.45, -0.15, false); box(3.2, 0, -1.5, 0.5, 0.36, 0.4, 0.4, true);
  kit.collide(3.7, -1.6, 1.2, 0.6);
  at(-1.45, 0, -2.3, 1.2, () => {
    add('plastic', S.rbox(0.7, 0.22, 0.45, 0.04), { p: [0, 0.11, 0], color: 0xff8cbf });
    add('plastic', S.box(0.72, 0.012, 0.47), { p: [0, 0.11, 0], color: 0xe86a92 });
    add('metal', S.torus(0.05, 0.01, 6, 12, Math.PI), { p: [0, 0.23, 0], r: [Math.PI / 2, 0, 0], color: 0x2a2a30 });
  });
  at(-1.9, 1.7, -3.0, Math.PI / 2, () => framed(A.familyPhoto(41, true), 0.4, 0.3, { frame: GOLD, mat: 'metal', tilt: 0.15 }));
  at(-1.75, 0.02, -2.0, 1.9, () => framed(A.familyPhoto(43), 0.35, 0.27, { frame: DARK, mat: 'wood' }), -Math.PI / 2 + 0.05);
  at(4.4, 1.6, -3.0, -Math.PI / 2, () => framed(A.animePoster(320, 'NIGHT'), 0.4, 0.56, { frame: 0x1a1a1e, mat: 'paint', tilt: -0.04 }));
  for (const [x, z, ry] of [[-1.9 + 0.18, -6.9 + 0.18, Math.PI / 4], [4.4 - 0.18, -6.9 + 0.18, -Math.PI / 4], [4.4 - 0.18, -1.1 - 0.18, -Math.PI * 3 / 4]]) at(x, 2.8, z, ry, () => P.cobweb(0.56), 0.3);
  at(0.6, 2.8, -3.5, 0, () => pendant(P, 0.25, false, 0x6a5a48));

  return {
    lights, anim,
    itemSpots: [V(-1.38, 0.55, -5.0), V(-1.38, 0.47, -3.72), V(0.8, 0.02, -3.8)],
    navPoints: [V(0.0, 0, -3.8), V(2.9, 0, -2.6), V(2.6, 0, -4.4)],
    ghostSpawns: [V(0.8, 0, -5.8)],
    update(dt, t) { for (const f of anim) f(dt, t); },
  };
}
