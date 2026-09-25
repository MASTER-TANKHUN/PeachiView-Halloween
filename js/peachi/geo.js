// Geometry helpers for the procedural Peachi model: parametric surfaces, lofts, swept hair clumps,
// and a bin that merges pieces per (bone group, material) and builds matching outline shells.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

export const TAU = Math.PI * 2;
const _p = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3();
const _col = new THREE.Color();

export const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (e0, e1, x) => { const t = clamp01((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };

/** Catmull-Rom interpolation over a table of keyframes [{ k, ...values }] sorted by k. Returns an object. */
export function tableLerp(rows, k, out = {}) {
  const n = rows.length;
  let i = 0;
  while (i < n - 2 && k > rows[i + 1].k) i++;
  const r1 = rows[i], r2 = rows[i + 1], r0 = rows[Math.max(0, i - 1)], r3 = rows[Math.min(n - 1, i + 2)];
  const t = clamp01((k - r1.k) / (r2.k - r1.k)), t2 = t * t, t3 = t2 * t;
  for (const key in r1) {
    if (key === 'k') continue;
    const p0 = r0[key], p1 = r1[key], p2 = r2[key], p3 = r3[key];
    out[key] = 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
  }
  return out;
}

/**
 * Parametric surface over u,v in [0,1]; fn(u, v, out:Vector3) writes the position.
 * Normals come from central differences of fn, so closed/periodic surfaces have no seam.
 * opts.color: hex | (u, v, p, outColor) => void · opts.sway: (u, v, p) => [amp, phase] · opts.uv: (u, v) => [s, t]
 * opts.flip: reverse winding + normals (use when dP/du × dP/dv points inward).
 */
export function surface(fn, nu, nv, opts = {}) {
  const flip = !!opts.flip;
  const cols = nu + 1, rows = nv + 1, n = cols * rows;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  const col = new Float32Array(n * 3), sw = new Float32Array(n * 2);
  const e = 1e-3;
  const colorFn = typeof opts.color === 'function' ? opts.color : null;
  const base = new THREE.Color(colorFn ? 0xffffff : (opts.color ?? 0xffffff));
  for (let j = 0; j < rows; j++) {
    const v = j / nv;
    for (let i = 0; i < cols; i++) {
      const u = i / nu, k = j * cols + i;
      fn(u, v, _p);
      pos[k * 3] = _p.x; pos[k * 3 + 1] = _p.y; pos[k * 3 + 2] = _p.z;
      const uu = Math.min(Math.max(u, e), 1 - e), vv = Math.min(Math.max(v, e), 1 - e);
      fn(uu + e, vv, _a); fn(uu - e, vv, _b); _a.sub(_b);
      fn(uu, vv + e, _c); fn(uu, vv - e, _d); _c.sub(_d);
      _a.cross(_c);
      if (flip) _a.negate();
      if (_a.lengthSq() < 1e-24) _a.set(0, 1, 0);
      _a.normalize();
      nor[k * 3] = _a.x; nor[k * 3 + 1] = _a.y; nor[k * 3 + 2] = _a.z;
      const st = opts.uv ? opts.uv(u, v) : null;
      uv[k * 2] = st ? st[0] : u; uv[k * 2 + 1] = st ? st[1] : v;
      if (colorFn) colorFn(u, v, _p, _col); else _col.copy(base);
      col[k * 3] = _col.r; col[k * 3 + 1] = _col.g; col[k * 3 + 2] = _col.b;
      if (opts.sway) { const s = opts.sway(u, v, _p); sw[k * 2] = s[0]; sw[k * 2 + 1] = s[1]; }
    }
  }
  const idx = new (n > 65535 ? Uint32Array : Uint16Array)(nu * nv * 6);
  let q = 0;
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = j * cols + i, b = a + 1, c = a + cols + 1, d = a + cols;
    if (flip) { idx[q++] = a; idx[q++] = d; idx[q++] = b; idx[q++] = b; idx[q++] = d; idx[q++] = c; }
    else { idx[q++] = a; idx[q++] = b; idx[q++] = d; idx[q++] = b; idx[q++] = c; idx[q++] = d; }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aSway', new THREE.BufferAttribute(sw, 2));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
}

/** Ellipsoid (optionally a partial one: v0..v1 = polar range from the top, 0..1). */
export function ellipsoid(rx, ry, rz, nu = 16, nv = 10, opts = {}) {
  const v0 = opts.v0 ?? 0, v1 = opts.v1 ?? 1, a0 = opts.a0 ?? 0, a1 = opts.a1 ?? 1;
  return surface((u, v, o) => {
    const az = Math.PI + TAU * lerp(a0, a1, u), p = Math.PI * lerp(v0, v1, v);
    o.set(rx * Math.sin(p) * Math.sin(az), ry * Math.cos(p), rz * Math.sin(p) * Math.cos(az));
  }, nu, nv, { ...opts, flip: !opts.flip });
}

/**
 * Loft of elliptical rings stacked along y. ring(v) → { y, rx, rzF, rzB, zc, x? } (v = 0 bottom … 1 top).
 * u runs around: 0 = back, 0.25 = +x (her left), 0.5 = front, 0.75 = -x. Optional radial(u, v, θ) multiplier.
 */
export function loft(ring, nu, nv, opts = {}) {
  const R = {};
  const a0 = opts.a0 ?? 0, a1 = opts.a1 ?? 1;
  return surface((u, v, o) => {
    ring(v, R);
    const th = Math.PI + TAU * lerp(a0, a1, u);
    const s = Math.sin(th), c = Math.cos(th);
    const m = opts.radial ? opts.radial(u, v, th, R) : 1;
    const rz = c >= 0 ? R.rzF : R.rzB;
    o.set((R.x || 0) + R.rx * s * m, R.y, (R.zc || 0) + rz * c * m);
    if (opts.post) opts.post(u, v, th, o, R);
  }, nu, nv, opts);
}

/** Tapered tube along -y from y=0 to y=-len (radius r0 → r1), closed with round caps. */
export function limb(len, r0, r1, nu = 12, nv = 8, opts = {}) {
  const cap0 = opts.cap0 ?? r0, cap1 = opts.cap1 ?? r1, zs = opts.zs ?? 1;
  const total = cap0 + len + cap1;
  return surface((u, v, o) => {
    const th = Math.PI + TAU * u;
    const d = v * total; // distance from the top of the top cap
    let y, r;
    if (d < cap0) { const a = (1 - d / cap0) * Math.PI / 2; y = Math.sin(a) * cap0; r = Math.cos(a) * r0; }
    else if (d > cap0 + len) { const a = ((d - cap0 - len) / cap1) * Math.PI / 2; y = -len - Math.sin(a) * cap1; r = Math.cos(a) * r1; }
    else { const t = (d - cap0) / len; y = -t * len; r = lerp(r0, r1, t) * (opts.bulge ? 1 + opts.bulge(t, th) : 1); }
    o.set(r * Math.sin(th), y, r * Math.cos(th) * zs);
  }, nu, nv, { ...opts, flip: true });
}

const _T = new THREE.Vector3(), _N = new THREE.Vector3(), _S = new THREE.Vector3(), _q = new THREE.Vector3();
/**
 * Hair clump / ribbon swept along a curve with a lens cross-section that curls inward (crescent).
 * outward(t, p, out) sets the "away from the head" direction. width/thick: (t) => meters.
 */
export function clump(path, { width, thick, outward, nu = 6, nv = 14, curl = 0.3, color, sway, flip = true }) {
  return surface((u, v, out) => {
    path.getPointAt(v, _q); path.getTangentAt(v, _T);
    outward(v, _q, _N);
    _N.addScaledVector(_T, -_N.dot(_T)).normalize();
    _S.crossVectors(_T, _N).normalize();
    const phi = u * TAU, cw = Math.cos(phi), sn = Math.sin(phi);
    const w = width(v), d = thick(v);
    out.copy(_q).addScaledVector(_S, w * cw).addScaledVector(_N, d * sn - curl * w * cw * cw);
  }, nu, nv, { color, sway, flip });
}

/** Rounded 2D shape helpers → extruded, smooth-beveled geometry (centered on z). */
export function heartShape(s) {
  const h = new THREE.Shape();
  h.moveTo(0, -s * 0.95);
  h.bezierCurveTo(-s * 0.25, -s * 0.6, -s, -s * 0.28, -s, s * 0.22);
  h.bezierCurveTo(-s, s * 0.78, -s * 0.28, s * 0.95, 0, s * 0.45);
  h.bezierCurveTo(s * 0.28, s * 0.95, s, s * 0.78, s, s * 0.22);
  h.bezierCurveTo(s, -s * 0.28, s * 0.25, -s * 0.6, 0, -s * 0.95);
  return h;
}
export function roundRectShape(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
export function extrude(shape, depth, bevel = depth * 0.35, { curveSegments = 5, bevelSegments = 1, holes } = {}) {
  if (holes) shape.holes.push(...holes);
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments, curveSegments });
  g.translate(0, 0, -depth / 2);
  return g;
}
export function heartGeo(s, depth = s * 0.5) { return extrude(heartShape(s), depth, depth * 0.45, { curveSegments: 4 }); }

/** Make any geometry mergeable with surface() output: indexed, with normal/uv/color/aSway, no groups. */
export function normalize(g, color = 0xffffff) {
  if (!g.index) {
    const n = g.attributes.position.count, idx = new (n > 65535 ? Uint32Array : Uint16Array)(n);
    for (let i = 0; i < n; i++) idx[i] = i;
    g.setIndex(new THREE.BufferAttribute(idx, 1));
  }
  const n = g.attributes.position.count;
  if (!g.attributes.normal) g.computeVertexNormals();
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  if (!g.attributes.color) {
    _col.set(color);
    const c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { c[i * 3] = _col.r; c[i * 3 + 1] = _col.g; c[i * 3 + 2] = _col.b; }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  }
  if (!g.attributes.aSway) g.setAttribute('aSway', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color', 'aSway'].includes(k)) g.deleteAttribute(k);
  g.clearGroups();
  return g;
}

/** Recolor all vertices of a geometry. */
export function tint(g, color) {
  _col.set(color);
  const c = g.attributes.color;
  for (let i = 0; i < c.count; i++) c.setXYZ(i, _col.r, _col.g, _col.b);
  return g;
}

/** Remap uv (0..1) into an atlas rectangle [u0, v0, u1, v1]. */
export function atlasUV(g, rect) {
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, lerp(rect[0], rect[2], uv.getX(i)), lerp(rect[1], rect[3], uv.getY(i)));
  return g;
}

/** Set a constant sway on every vertex (used for rigid accessories hanging off swaying parts). */
export function setSway(g, amp, phase = 0) {
  const s = g.attributes.aSway;
  for (let i = 0; i < s.count; i++) s.setXY(i, amp, phase);
  return g;
}

const _m = new THREE.Matrix4(), _e = new THREE.Euler(), _qt = new THREE.Quaternion(), _sv = new THREE.Vector3(), _tv = new THREE.Vector3();
export function place(g, pos = [0, 0, 0], rot = [0, 0, 0], scale = 1) {
  _e.set(rot[0], rot[1], rot[2]);
  _qt.setFromEuler(_e);
  if (Array.isArray(scale)) _sv.set(scale[0], scale[1], scale[2]); else _sv.setScalar(scale);
  _m.compose(_tv.set(pos[0], pos[1], pos[2]), _qt, _sv);
  g.applyMatrix4(_m);
  return g;
}

/**
 * Collects geometry pieces per (bone group, material key), then merges them into one mesh per bin
 * plus one inverted-hull outline mesh per group.
 */
export class PartBin {
  constructor() { this.bins = new Map(); this.outlines = new Map(); }
  /** outline: width multiplier (0 = no outline). */
  add(group, matKey, geo, { pos, rot, scale, outline = 1, color } = {}) {
    normalize(geo, color);
    if (color !== undefined) tint(geo, color);
    if (pos || rot || scale !== undefined) place(geo, pos, rot, scale ?? 1);
    const key = group.uuid + '|' + matKey;
    if (!this.bins.has(key)) this.bins.set(key, { group, matKey, geos: [] });
    this.bins.get(key).geos.push(geo);
    if (outline > 0) {
      if (!this.outlines.has(group.uuid)) this.outlines.set(group.uuid, { group, geos: [] });
      this.outlines.get(group.uuid).geos.push({ geo, w: outline });
    }
    return geo;
  }
  build(materials, outlineMaterial) {
    const meshes = [];
    for (const { group, matKey, geos } of this.bins.values()) {
      const g = mergeGeometries(geos, false);
      const mesh = new THREE.Mesh(g, materials[matKey]);
      mesh.name = matKey;
      mesh.frustumCulled = false; // vertex sway can push parts outside the static bounds
      group.add(mesh);
      meshes.push(mesh);
    }
    if (outlineMaterial) {
      for (const { group, geos } of this.outlines.values()) {
        const parts = geos.map(({ geo, w }) => {
          const o = new THREE.BufferGeometry();
          o.setAttribute('position', geo.attributes.position.clone());
          o.setAttribute('aSway', geo.attributes.aSway.clone());
          o.setIndex(geo.index.clone());
          const m = mergeVertices(o, 1e-5);
          m.computeVertexNormals();
          const n = m.attributes.position.count;
          m.setAttribute('aOL', new THREE.BufferAttribute(new Float32Array(n).fill(w), 1));
          return m;
        });
        const g = mergeGeometries(parts, false);
        const mesh = new THREE.Mesh(g, outlineMaterial);
        mesh.name = 'outline';
        mesh.frustumCulled = false;
        group.add(mesh);
        meshes.push(mesh);
      }
    }
    for (const b of this.bins.values()) for (const g of b.geos) g.dispose();
    this.bins.clear(); this.outlines.clear();
    return meshes;
  }
}
