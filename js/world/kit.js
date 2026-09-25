// Scene-building kit for the house: parts are added with a transform stack, merged per material at the end
// (a few dozen draw calls for the whole house), with box-projected UVs in meters so tiling textures keep
// their real-world scale, baked contact darkening near the floor, and XZ box colliders.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
const _c = new THREE.Color(), _n = new THREE.Vector3(), _v = new THREE.Vector3(), _nm = new THREE.Matrix3();
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ---------------------------------------------------------------- shapes (all centered, meters)
export const shapes = {
  box: (w, h, d) => new THREE.BoxGeometry(w, h, d),
  /** rounded box; r = corner radius */
  rbox: (w, h, d, r = 0.02, seg = 2) => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4)),
  cyl: (rt, rb, h, seg = 16, open = false) => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open),
  sphere: (r, ws = 16, hs = 12, ...rest) => new THREE.SphereGeometry(r, ws, hs, ...rest),
  torus: (R, r, rs = 8, ts = 24, arc = Math.PI * 2) => new THREE.TorusGeometry(R, r, rs, ts, arc),
  cone: (r, h, seg = 12) => new THREE.ConeGeometry(r, h, seg),
  plane: (w, h) => new THREE.PlaneGeometry(w, h),
  circle: (r, seg = 24) => new THREE.CircleGeometry(r, seg),
  /** lathe from [[r, y], …] profile */
  lathe: (pts, seg = 24) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg),
  /** extruded 2D shape, centered on z */
  extrude: (shape, depth, bevel = 0, curveSegments = 8) => {
    const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments });
    g.translate(0, 0, -depth / 2);
    return g;
  },
  tube: (points, r, seg = 32, rs = 6, closed = false) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, closed), seg, r, rs, closed),
};
export function roundRect(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
export function heartShape(s) {
  const h = new THREE.Shape();
  h.moveTo(0, -s * 0.95);
  h.bezierCurveTo(-s * 0.25, -s * 0.6, -s, -s * 0.28, -s, s * 0.22);
  h.bezierCurveTo(-s, s * 0.78, -s * 0.28, s * 0.95, 0, s * 0.45);
  h.bezierCurveTo(s * 0.28, s * 0.95, s, s * 0.78, s, s * 0.22);
  h.bezierCurveTo(s, -s * 0.28, s * 0.25, -s * 0.6, 0, -s * 0.95);
  return h;
}

// ---------------------------------------------------------------- the kit
export class Kit {
  constructor() {
    this.bins = new Map();       // material key → geometries (world space)
    this.colliders = [];         // { x0, x1, z0, z1 }
    this.stack = [new THREE.Matrix4()];
  }
  get top() { return this.stack[this.stack.length - 1]; }
  /** Enter a local frame: position, yaw (and optional pitch/roll, uniform scale). Use with pop(). */
  push(x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0, s = 1) {
    _m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz, 'YXZ')), _s.set(s, s, s));
    this.stack.push(this.top.clone().multiply(_m));
    return this;
  }
  pop() { if (this.stack.length > 1) this.stack.pop(); return this; }
  /** Run fn inside a local frame. */
  at(x, y, z, ry, fn, rx = 0, rz = 0, s = 1) { this.push(x, y, z, ry, rx, rz, s); try { fn(this); } finally { this.pop(); } return this; }

  /**
   * Add a geometry (built centered at the local origin) to material `key`.
   * o: { p: [x,y,z], r: [rx,ry,rz], s: number|[sx,sy,sz], color, uv: 'world'|'keep'|'local', ao: true, emit: k }
   *  - color: hex/Color/[r,g,b] or fn(worldPos, normal, color) → color
   *  - uv 'world' (default for tiling materials): box projection in meters; 'keep' keeps the geometry's UVs
   *  - ao: darken toward the floor (contact shade); emit: multiply color (HDR, for bloom on emissive bins)
   */
  add(key, geo, o = {}) {
    const p = o.p || [0, 0, 0], r = o.r || [0, 0, 0];
    const s = Array.isArray(o.s) ? o.s : [o.s ?? 1, o.s ?? 1, o.s ?? 1];
    _m.compose(_p.set(p[0], p[1], p[2]), _q.setFromEuler(_e.set(r[0], r[1], r[2], 'YXZ')), _s.set(s[0], s[1], s[2]));
    const local = _m.clone();
    const uvMode = o.uv || 'local';
    // grain axis (wood etc.) for local UVs: the part's longest dimension
    let grainAxis = 0;
    if (uvMode === 'local') {
      geo.computeBoundingBox();
      const sz = geo.boundingBox.getSize(_v).multiply(_s.set(Math.abs(s[0]), Math.abs(s[1]), Math.abs(s[2])));
      grainAxis = o.grain ?? (sz.x >= sz.y && sz.x >= sz.z ? 0 : sz.z >= sz.y ? 2 : 1);
    }
    const world = this.top.clone().multiply(local);
    if (!geo.index) {
      const n = geo.attributes.position.count, idx = new (n > 65535 ? Uint32Array : Uint16Array)(n);
      for (let i = 0; i < n; i++) idx[i] = i;
      geo.setIndex(new THREE.BufferAttribute(idx, 1));
    }
    if (!geo.attributes.normal) geo.computeVertexNormals();
    const n = geo.attributes.position.count;
    // box-projected UVs in meters: 'local' before the transform (grain follows the part), 'world' after it
    // (floors/walls stay continuous across pieces; vertical faces always get v = height)
    const projectUV = (scaleLocal) => {
      const pos = geo.attributes.position, nor = geo.attributes.normal;
      const uvs = new Float32Array(n * 2), meters = o.uvScale || 1, off = o.uvOff || [0, 0];
      for (let i = 0; i < n; i++) {
        _v.fromBufferAttribute(pos, i); if (scaleLocal) _v.multiply(_s.set(s[0], s[1], s[2]));
        _n.fromBufferAttribute(nor, i);
        const ax = Math.abs(_n.x), ay = Math.abs(_n.y), az = Math.abs(_n.z);
        const N = ax >= ay && ax >= az ? 0 : ay >= az ? 1 : 2; // dominant normal axis
        const others = N === 0 ? [1, 2] : N === 1 ? [0, 2] : [0, 1];
        const ga = scaleLocal ? grainAxis : (N === 0 ? 2 : 0);
        let U, W;
        if (others.includes(ga)) { U = ga; W = others[0] === U ? others[1] : others[0]; } else { U = others.includes(0) ? 0 : 2; W = others[0] === U ? others[1] : others[0]; }
        const c = [_v.x, _v.y, _v.z];
        uvs[i * 2] = (c[U] + off[0]) / meters;
        uvs[i * 2 + 1] = (c[W] + off[1]) / meters;
      }
      geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    };
    if (uvMode === 'local') projectUV(true);
    else if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    geo.applyMatrix4(world);
    if (uvMode === 'world') projectUV(false);
    // colors
    const col = new Float32Array(n * 3);
    const base = new THREE.Color();
    const setBase = (c) => (c instanceof THREE.Color ? base.copy(c) : Array.isArray(c) ? base.setRGB(c[0], c[1], c[2]) : base.set(c ?? 0xffffff));
    if (typeof o.color !== 'function') setBase(o.color);
    const ao = o.ao ?? true, emit = o.emit ?? 1;
    const P = geo.attributes.position, Nn = geo.attributes.normal;
    for (let i = 0; i < n; i++) {
      if (typeof o.color === 'function') { _v.fromBufferAttribute(P, i); _n.fromBufferAttribute(Nn, i); setBase(o.color(_v, _n, _c.set(0xffffff))); }
      let k = emit;
      if (ao) { const y = P.getY(i); k *= 0.55 + 0.45 * smooth(0.0, 0.3, y); }
      col[i * 3] = base.r * k; col[i * 3 + 1] = base.g * k; col[i * 3 + 2] = base.b * k;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    for (const name of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(name)) geo.deleteAttribute(name);
    geo.clearGroups();
    // bin per material and per room, so each room's meshes can be frustum-culled on their own
    let bin = key;
    if (this.regionOf) { geo.computeBoundingSphere(); const c = geo.boundingSphere.center; bin = key + '@' + this.regionOf(c.x, c.z); }
    if (!this.bins.has(bin)) this.bins.set(bin, []);
    this.bins.get(bin).push(geo);
    return geo;
  }

  /** XZ collider for a w×d footprint centered at local (x, z), rotated by local yaw. */
  collide(x, z, w, d, ry = 0) {
    const corners = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]];
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    const c = Math.cos(ry), s = Math.sin(ry);
    for (const [a, b] of corners) {
      _v.set(x + a * c + b * s, 0, z - a * s + b * c).applyMatrix4(this.top);
      x0 = Math.min(x0, _v.x); x1 = Math.max(x1, _v.x); z0 = Math.min(z0, _v.z); z1 = Math.max(z1, _v.z);
    }
    this.colliders.push({ x0, x1, z0, z1 });
    return this;
  }
  /** Local point → world Vector3. */
  world(x, y, z) { return new THREE.Vector3(x, y, z).applyMatrix4(this.top); }

  /**
   * Build a separate, movable object: everything added inside fn (in its own local space, no colliders)
   * becomes meshes under a new Group, which the caller positions and animates.
   */
  capture(mats, fn) {
    const bins = this.bins, stack = this.stack, cols = this.colliders;
    this.bins = new Map(); this.stack = [new THREE.Matrix4()]; this.colliders = [];
    const group = new THREE.Group(), region = this.regionOf;
    this.regionOf = null;
    try { fn(this); this.build(group, mats); } finally { this.bins = bins; this.stack = stack; this.colliders = cols; this.regionOf = region; }
    for (const m of group.children) m.matrixAutoUpdate = true;
    return group;
  }

  /** Merge every bin into one mesh per material. mats: key → Material. */
  build(root, mats, { shadows = true } = {}) {
    const meshes = {};
    for (const [bin, list] of this.bins) {
      const key = bin.split('@')[0];
      const mat = mats[key];
      if (!mat) { console.warn('kit: no material for', key); continue; }
      const geo = mergeGeometries(list, false);
      list.forEach((g) => g.dispose());
      if (!geo) continue;
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = key;
      mesh.matrixAutoUpdate = false;
      const emissive = mat.isMeshBasicMaterial || mat.userData.noShadow;
      mesh.castShadow = shadows && !emissive && !mat.transparent;
      mesh.receiveShadow = shadows && !mat.isMeshBasicMaterial;
      root.add(mesh);
      (meshes[key] ||= []).push(mesh);
    }
    this.bins.clear();
    return meshes;
  }
}
