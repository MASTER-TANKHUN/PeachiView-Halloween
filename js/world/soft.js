// Soft goods and organic shapes: plump pillows, a duvet draped over a mattress, beanbags, cushions,
// cables and ropes. Smooth normals (vertices welded) so they shade like cloth, not boxes.
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { fbm } from './tex.js';

const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function weld(g) {
  g.deleteAttribute('normal'); g.deleteAttribute('uv');
  const m = mergeVertices(g, 1e-5);
  m.computeVertexNormals();
  return m;
}
const wr = fbm([6, 6], 3, 41);

/** Plump pillow w × h × d: thick in the middle, thin seamed edges, slightly pinched corners. */
export function pillow(w, h, d, { puff = 1, wrinkle = 0.006, seed = 0 } = {}) {
  const g = new THREE.BoxGeometry(w, h, d, 14, 4, 10), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const nx = x / (w / 2), nz = z / (d / 2);
    const e = Math.max(Math.abs(nx) ** 2.5, Math.abs(nz) ** 2.5);
    y *= (1 - 0.85 * e) * puff;
    x *= 1 - 0.07 * nz * nz; z *= 1 - 0.1 * nx * nx;
    y += (wr((nx + 1) * 0.5 + seed, (nz + 1) * 0.5) - 0.5) * wrinkle * (1 - e);
    p.setXYZ(i, x, y, z);
  }
  return weld(g);
}

/**
 * Duvet over a mattress: flat top (w × d) that drapes `drop` down the sides and the foot (+z end),
 * with soft folds on the hanging parts and a few wrinkles on top. Origin = center of the top surface.
 */
export function duvet(w, d, drop, { thick = 0.05, folds = 7, seed = 3, r = 0.05 } = {}) {
  const nx = 48, nz = 40;
  const g = new THREE.PlaneGeometry(1, 1, nx, nz);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  const S = w / 2 + drop, Z0 = -d / 2, Z1 = d / 2 + drop;
  const bend = (s, half) => { // unfolded coordinate → [horizontal, down] around a rounded edge
    const a = Math.abs(s);
    if (a <= half - r) return [s, 0];
    const arc = Math.PI / 2 * r;
    const t = a - (half - r);
    if (t < arc) { const th = t / r; return [Math.sign(s) * (half - r + Math.sin(th) * r), r - Math.cos(th) * r]; }
    return [Math.sign(s) * half, r + (t - arc)];
  };
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) + 0.5, v = p.getZ(i) + 0.5;
    const s = (u * 2 - 1) * S, tz = Z0 + v * (Z1 - Z0);
    const [x, dx] = bend(s, w / 2);
    let z = tz, dz = 0;
    if (tz > d / 2 - r) { const [zz, dd] = bend(tz, d / 2); z = zz; dz = dd; }
    let y = -Math.max(dx, dz) - Math.min(dx, dz) * 0.35;
    const hang = Math.max(dx, dz);
    // folds on the hanging cloth, wrinkles on top
    const fold = Math.sin((dx > dz ? tz : s) * folds * 2.2 + seed) * 0.018 * smooth(0.02, 0.2, hang);
    const outX = dx > 0 ? Math.sign(s) : 0, outZ = dz > 0 ? 1 : 0;
    const wk = (wr(u * 2 + seed, v * 2) - 0.5) * 0.03 * (1 - smooth(0, 0.05, hang));
    p.setXYZ(i, x + outX * fold, y + wk, z + outZ * fold);
  }
  let top = weld(g);
  if (thick > 0) { // give it body: a slightly smaller copy underneath, joined visually by the outline of the top
    const under = top.clone();
    under.scale(0.99, 1, 0.99); under.translate(0, -thick, 0);
    const idx = under.index.array;
    for (let i = 0; i < idx.length; i += 3) { const t = idx[i]; idx[i] = idx[i + 2]; idx[i + 2] = t; }
    under.computeVertexNormals();
    top = mergeGeo([top, under]);
  }
  return top;
}
function mergeGeo(list) {
  let n = 0, m = 0;
  for (const g of list) { n += g.attributes.position.count; m += g.index.count; }
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), idx = new Uint32Array(m);
  let vo = 0, io = 0;
  for (const g of list) {
    pos.set(g.attributes.position.array, vo * 3); nor.set(g.attributes.normal.array, vo * 3);
    for (let i = 0; i < g.index.count; i++) idx[io + i] = g.index.array[i] + vo;
    vo += g.attributes.position.count; io += g.index.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}

/** Beanbag: squashed teardrop that sags, with a dent where someone sat. */
export function beanbag(r = 0.45) {
  const g = new THREE.SphereGeometry(r, 36, 24), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const ny = y / r;
    const k = 1 + 0.25 * smooth(0.2, -1, ny);
    x *= k; z *= k;
    y = y * 0.62 + (ny < 0 ? -ny * ny * r * 0.1 : 0);
    const dent = Math.exp(-((x / (r * 0.5)) ** 2 + ((z - r * 0.1) / (r * 0.5)) ** 2)) * smooth(0, 1, ny) * r * 0.28;
    y -= dent;
    y += (wr((x / r + 1) * 0.5, (z / r + 1) * 0.5) - 0.5) * r * 0.06;
    p.setXYZ(i, x, y + r * 0.62, z);
  }
  return weld(g);
}

/** Round cushion with a button dent (or a peach cleft with cleft = true). */
export function roundCushion(r = 0.22, h = 0.09, { cleft = false } = {}) {
  const g = new THREE.SphereGeometry(r, 32, 16), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const rr = Math.hypot(x, y) / r; // lying in the xy plane, thickness along z
    let zz = z * (h / r) * (1 - 0.35 * rr ** 3);
    zz *= 1 - 0.55 * Math.exp(-((rr / 0.12) ** 2));
    let xx = x, yy = y;
    if (cleft) {
      const c = Math.exp(-((x / (r * 0.12)) ** 2)) * smooth(-0.2, 1, y / r);
      zz *= 1 - 0.45 * c;
      if (y > r * 0.8) yy -= Math.exp(-((x / (r * 0.3)) ** 2)) * r * 0.12;
    }
    p.setXYZ(i, xx, yy, zz);
  }
  return weld(g);
}

/** Cable/rope along points (sagging between them if sag > 0). */
export function cable(points, r = 0.004, sag = 0, seg = 48) {
  let pts = points;
  if (sag > 0 && points.length === 2) {
    const [a, b] = points; pts = [];
    for (let i = 0; i <= 16; i++) { const t = i / 16; pts.push(new THREE.Vector3().lerpVectors(a, b, t).add(new THREE.Vector3(0, -sag * 4 * t * (1 - t), 0))); }
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), seg, r, 6, false);
}

/**
 * A dust sheet thrown over furniture: w × d footprint, top height from heightFn(nx, nz) (nx, nz in -1..1),
 * sides falling to the floor with a slight flare and folds. Origin on the floor at the center.
 */
export function sheetOver(w, d, heightFn, { folds = 22, seed = 1 } = {}) {
  const g = new THREE.BoxGeometry(w, 1, d, 20, 10, 16), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i) + 0.5, z = p.getZ(i);
    const nx = x / (w / 2), nz = z / (d / 2);
    const H = heightFn(Math.max(-1, Math.min(1, nx)), Math.max(-1, Math.min(1, nz)));
    const t = y; // 0 floor … 1 top
    const yy = t * H;
    const side = Math.max(Math.abs(nx), Math.abs(nz)) > 0.999;
    const flare = 1 + 0.1 * (1 - t) ** 2;
    const round = 1 - 0.1 * Math.pow(t, 6);
    const per = Math.atan2(nz, nx);
    const fold = side ? Math.sin(per * folds + seed) * 0.02 * (1 - t) : 0;
    const len = Math.hypot(nx, nz) || 1;
    x = x * flare * round + (nx / len) * fold;
    z = z * flare * round + (nz / len) * fold;
    const wk = t > 0.95 ? (wr((nx + 1) * 0.5 + seed, (nz + 1) * 0.5) - 0.5) * 0.03 : 0;
    p.setXYZ(i, x, Math.max(0.005, yy + wk), z);
  }
  return weld(g);
}
