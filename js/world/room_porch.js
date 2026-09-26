// Front porch (x -12.4..-10.1, z -1.9..1.9), where the prologue starts: plank deck under a small roof,
// a flickering lantern by the door, the doorbell, a PEACHI doormat, jack-o'-lanterns on the steps,
// hedges on both sides and the street beyond the gate.
import * as THREE from 'three';
import { shapes as S } from './kit.js';
import { art } from './tex.js';
import { panorama } from './shell.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const X0 = -12.4, X1 = -10.1, Z = 1.9, GROUND = -0.36, ROOF = 2.62;
const DECK = 0x6a4a36, POST = 0xf2ede4, HEDGE = 0x1f3a24;

function matTexture() {
  return art(512, 320, (g, w, h) => {
    g.fillStyle = '#8a5a3a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(${40 + Math.random() * 60},${20 + Math.random() * 30},10,${0.25 + Math.random() * 0.3})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 5); }
    g.strokeStyle = '#3a2214'; g.lineWidth = 14; g.strokeRect(14, 14, w - 28, h - 28);
    g.font = '400 92px Sriracha, Kanit, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#2a160c'; g.fillText('PEACHI', w / 2, h * 0.44);
    g.font = '400 34px Sriracha, Mitr, sans-serif'; g.fillText('ยินดีต้อนรับ (มั้ง)', w / 2, h * 0.74);
  });
}
function plaqueTexture() {
  return art(256, 160, (g, w, h) => {
    g.fillStyle = '#f4ece0'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#8a6a4a'; g.lineWidth = 8; g.strokeRect(6, 6, w - 12, h - 12);
    g.font = '600 86px Kanit, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#3a2418'; g.fillText('249', w / 2, h * 0.54);
  });
}

export function roomPorch(P, kit, M, root) {
  const { add, at, pic } = P;
  const lights = [];

  // ---------------------------------------------------------------- deck, steps, ground, path
  add('wood', S.box(X1 - X0, 0.12, Z * 2), { p: [(X0 + X1) / 2, -0.06, 0], color: DECK, uv: 'world' });
  for (let z = -Z + 0.07; z < Z; z += 0.14) add('woodMatte', S.box(X1 - X0, 0.004, 0.006), { p: [(X0 + X1) / 2, 0.001, z], color: 0x2a1a10, ao: false });
  for (let i = 0; i < 2; i++) add('wood', S.box(0.32, 0.12, 1.3), { p: [X0 - 0.16 - i * 0.32, -0.12 - i * 0.12, 0], color: DECK });
  add('paint', S.box(6, 0.04, 16), { p: [X0 - 3, GROUND - 0.02, 0], color: 0x14201a, uv: 'world' });
  add('paint', S.box(3.2, 0.03, 1.1), { p: [X0 - 2.2, GROUND, 0], color: 0x3a3438, uv: 'world' });
  // gate + picket fence along x = -14.6
  for (let z = -3.4; z <= 3.4; z += 0.16) {
    if (Math.abs(z) < 0.55) continue;
    add('paint', S.box(0.06, 0.9, 0.08), { p: [-14.6, GROUND + 0.45, z], color: 0xd8d0c4 });
    add('paint', S.cone(0.05, 0.08, 4), { p: [-14.6, GROUND + 0.94, z], r: [0, Math.PI / 4, 0], color: 0xd8d0c4 });
  }
  for (const y of [0.25, 0.7]) for (const s of [-1, 1]) add('paint', S.box(0.04, 0.06, 2.9), { p: [-14.56, GROUND + y, s * 1.98], color: 0xc8c0b4 });
  at(-14.6, GROUND, 0.25, -0.9, () => { for (let z = -0.45; z <= 0.02; z += 0.16) add('paint', S.box(0.06, 0.95, 0.08), { p: [0, 0.47, z - 0.02], color: 0xd8d0c4 }); });

  // ---------------------------------------------------------------- posts, railing, roof
  for (const z of [-Z + 0.08, Z - 0.08]) {
    add('paint', S.box(0.12, ROOF, 0.12), { p: [X0 + 0.08, ROOF / 2, z], color: POST });
    add('paint', S.box(X1 - X0 - 0.1, 0.06, 0.05), { p: [(X0 + X1) / 2 + 0.05, 0.9, z], color: POST });
    for (let x = X0 + 0.25; x < X1 - 0.1; x += 0.16) add('paint', S.box(0.035, 0.84, 0.035), { p: [x, 0.45, z], color: POST });
  }
  for (const s of [-1, 1]) { // front railing either side of the steps
    add('paint', S.box(0.05, 0.06, Z - 0.7), { p: [X0 + 0.08, 0.9, s * (0.7 + (Z - 0.7) / 2)], color: POST });
    for (let z = 0.8; z < Z - 0.1; z += 0.16) add('paint', S.box(0.035, 0.84, 0.035), { p: [X0 + 0.08, 0.45, s * z], color: POST });
  }
  add('paint', S.box(X1 - X0 + 0.5, 0.08, Z * 2 + 0.5), { p: [(X0 + X1) / 2 - 0.2, ROOF + 0.04, 0], color: 0x3a2a30 });
  add('paint', S.box(X1 - X0 + 0.5, 0.16, 0.06), { p: [(X0 + X1) / 2 - 0.2, ROOF - 0.04, -Z - 0.22], color: POST });
  add('paint', S.box(X1 - X0 + 0.5, 0.16, 0.06), { p: [(X0 + X1) / 2 - 0.2, ROOF - 0.04, Z + 0.22], color: POST });
  add('paint', S.box(0.06, 0.16, Z * 2 + 0.5), { p: [X0 - 0.42, ROOF - 0.04, 0], color: POST });
  add('ceiling', S.plane(X1 - X0 + 0.4, Z * 2 + 0.4), { p: [(X0 + X1) / 2 - 0.2, ROOF - 0.001, 0], r: [Math.PI / 2, 0, 0], uv: 'world', ao: false, color: 0xcfc6bc });
  at(X0 + 0.14, ROOF - 0.02, Z - 0.14, Math.PI * 0.75, () => P.cobweb(0.5));
  at(X1 - 0.05, ROOF - 0.02, -Z + 0.12, -Math.PI * 0.25, () => P.cobweb(0.42));
  P.bunting(V(X1 - 0.05, 2.34, -0.72), V(X1 - 0.05, 2.34, 0.72), 7);

  // ---------------------------------------------------------------- hedges on both sides
  for (const s of [-1, 1]) {
    add('plush', S.rbox(4.6, 1.15, 0.7, 0.2), { p: [-12.4, GROUND + 0.55, s * (Z + 0.45)], color: HEDGE });
    for (let i = 0; i < 16; i++) add('plush', S.sphere(0.28 + (i % 3) * 0.06, 10, 8), { p: [-14.5 + i * 0.29, GROUND + 1.1 + (i % 2) * 0.06, s * (Z + 0.4 + ((i * 7) % 3) * 0.06)], color: 0x1a321f });
  }

  // ---------------------------------------------------------------- by the door: lantern, bell, plaque, mat, pumpkins
  at(X1 - 0.02, 1.95, -0.8, -Math.PI / 2, () => { // wall lantern (front +z = away from the wall)
    add('metal', S.box(0.1, 0.16, 0.03), { p: [0, 0, 0.015], color: 0x1a1a1a });
    add('metal', S.box(0.14, 0.03, 0.14), { p: [0, 0.14, 0.1], color: 0x1a1a1a });
    add('metal', S.cone(0.1, 0.08, 4), { p: [0, 0.2, 0.1], r: [0, Math.PI / 4, 0], color: 0x1a1a1a });
    add('glass', S.box(0.12, 0.2, 0.12), { p: [0, 0.03, 0.1] });
    add('emitFlicker', S.sphere(0.022, 10, 8), { p: [0, 0.03, 0.1], s: [0.8, 1.4, 0.8], color: 0xffb060, emit: 2.2, ao: false });
    add('haze', S.sphere(0.09, 12, 10), { p: [0, 0.03, 0.1], color: 0xff9040, emit: 0.05, ao: false });
  });
  lights.push({ color: 0xffa860, intensity: 2.4, dist: 5.5, p: [X1 - 0.3, 2.0, -0.8], kind: 'flicker' });
  at(X1 - 0.005, 1.28, 0.74, -Math.PI / 2, () => { // doorbell
    add('plastic', S.rbox(0.07, 0.11, 0.02, 0.008), { p: [0, 0, 0.01], color: 0xe8e0d4 });
    add('emit', S.cyl(0.016, 0.016, 0.012, 16), { p: [0, 0.01, 0.024], r: [Math.PI / 2, 0, 0], color: 0xffb4d0, emit: 2.5, ao: false });
  });
  at(X1 - 0.005, 1.72, 0.74, -Math.PI / 2, () => pic(plaqueTexture(), 0.22, 0.14, { p: [0, 0, 0.012] }));
  at(X1 - 0.5, 0.004, 0, Math.PI / 2, () => pic(matTexture(), 0.95, 0.6, { r: [-Math.PI / 2, 0, 0], rough: 1 }));
  for (const [x, z, r, ry] of [[X0 + 0.35, 1.35, 0.2, -1.2], [X0 + 0.3, -1.3, 0.17, -1.9], [X0 - 0.22, 0.95, 0.14, -1.6]]) {
    const y = x < X0 ? -0.12 : 0;
    at(x, y, z, ry, () => P.pumpkin(r));
    lights.push({ color: 0xff8a2a, intensity: 0.9, dist: 2.6, p: [x + 0.3, y + 0.3, z], kind: 'candle' });
  }
  at(X0 + 0.3, 0.92, -1.55, -1.4, () => P.pumpkin(0.11, { lit: false, face: false, color: 0xf0e6d8 })); // a white one on the rail

  // ---------------------------------------------------------------- the street beyond the gate
  panorama(root, -11.2, 0, 7.4, -Math.PI / 2, 2.9, -1.2, 7);

  // porch colliders: the steps and the gate are scenery, the hedges close the sides
  kit.collide(X0 - 0.25, 0, 0.3, Z * 2 + 0.4);
  kit.collide((X0 + X1) / 2, -Z - 0.2, X1 - X0 + 0.6, 0.3);
  kit.collide((X0 + X1) / 2, Z + 0.2, X1 - X0 + 0.6, 0.3);

  return {
    lights,
    porch: {
      spawn: { position: V(-12.0, 0, 0.0), yaw: -Math.PI / 2 }, // facing the front door (+x)
      bell: V(X1 - 0.02, 1.28, 0.74),
      bounds: { x0: X0, x1: X1, z0: -Z, z1: Z },
    },
  };
}
