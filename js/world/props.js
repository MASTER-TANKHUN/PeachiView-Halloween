// Furniture and props, built in code with the kit. Convention: origin on the floor under the footprint's
// center, front faces +z (callers rotate with kit.at). Colliders are added in local space.
import * as THREE from 'three';
import { shapes as S, roundRect, heartShape } from './kit.js';

const TAU = Math.PI * 2;

export function makeProps(kit, M, root) {
  const add = (key, geo, o) => kit.add(key, geo, o);
  const at = (x, y, z, ry, fn, rx = 0, rz = 0) => kit.at(x, y, z, ry, fn, rx, rz);
  const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _one = new THREE.Vector3(1, 1, 1);

  /** A plane with its own texture (posters, screens, rugs). basic = unlit (HDR via emit). */
  function pic(tex, w, h, { p = [0, 0, 0], r = [0, 0, 0], basic = false, emit = 1, rough = 0.75, transparent = false, alphaTest = 0, side = THREE.FrontSide, metal = 0, geo } = {}) {
    const mat = basic
      ? new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, transparent, alphaTest, side, color: new THREE.Color(emit, emit, emit), depthWrite: !transparent })
      : new THREE.MeshStandardMaterial({ map: tex, roughness: rough, metalness: metal, transparent, alphaTest, side, envMap: M.env, envMapIntensity: 0.25 });
    const mesh = new THREE.Mesh(geo || new THREE.PlaneGeometry(w, h), mat);
    const local = new THREE.Matrix4().compose(_v.set(p[0], p[1], p[2]), _q.setFromEuler(_e.set(r[0], r[1], r[2], 'YXZ')), _one);
    mesh.matrix.copy(kit.top).multiply(local);
    mesh.matrixAutoUpdate = false;
    mesh.receiveShadow = !basic;
    root.add(mesh);
    return mesh;
  }
  /** Picture in a frame on a wall (front +z). */
  function framed(tex, w, h, { frame = 0x2a1a14, border = 0.03, mat = 'wood', tilt = 0, glass = true, mount = 0.05 } = {}) {
    at(0, 0, 0, 0, () => {
      add(mat, S.rbox(w + border * 2, h + border * 2, 0.025, 0.006), { p: [0, 0, 0.0125], color: frame, ao: false });
      add('paint', S.box(w + 0.01, h + 0.01, 0.004), { p: [0, 0, 0.022], color: 0xf4efe6, ao: false });
      pic(tex, w - mount, h - mount, { p: [0, 0, 0.0245], rough: glass ? 0.25 : 0.8 });
    }, 0, tilt);
  }
  const legs4 = (key, w, d, h, r, color, inset = 0.03, shape = 'cyl') => {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const g = shape === 'cyl' ? S.cyl(r, r * 0.8, h, 10) : S.box(r * 2, h, r * 2);
      add(key, g, { p: [sx * (w / 2 - inset - r), h / 2, sz * (d / 2 - inset - r)], color });
    }
  };
  const handleBar = (x, y, z, len = 0.12, vertical = false, color = 0xb8b0a8) => {
    add('metal', S.cyl(0.006, 0.006, len, 8), { p: [x, y, z + 0.022], r: vertical ? [0, 0, 0] : [0, 0, Math.PI / 2], color });
    for (const s of [-1, 1]) add('metal', S.cyl(0.005, 0.005, 0.022, 6), { p: vertical ? [x, y + s * len * 0.4, z + 0.011] : [x + s * len * 0.4, y, z + 0.011], r: [Math.PI / 2, 0, 0], color });
  };
  const knob = (x, y, z, color = 0xc8a060, r = 0.012) => add('metal', S.sphere(r, 10, 8), { p: [x, y, z + r * 0.6], s: [1, 1, 0.7], color });

  // =========================================================== generic furniture
  /** Cabinet body with drawers/doors on the front. rows: [{ h, kind: 'drawer'|'doors'|'door'|'open' }] from the bottom. */
  function cabinet(w, h, d, { color = 0xe8e0d4, mat = 'paint', rows = [{ h: 1, kind: 'doors' }], plinth = 0.08, top = null, handle = 'bar', hColor = 0xb8b0a8, gap = 0.004 } = {}) {
    add(mat, S.rbox(w, h - plinth, d, 0.006), { p: [0, plinth + (h - plinth) / 2, 0], color });
    if (plinth > 0) add(mat, S.box(w - 0.04, plinth, d - 0.05), { p: [0, plinth / 2, -0.025], color: new THREE.Color(color).multiplyScalar(0.55) });
    let y = plinth;
    const H = h - plinth, total = rows.reduce((s, r) => s + r.h, 0);
    for (const r of rows) {
      const rh = (r.h / total) * H;
      const cy = y + rh / 2, fz = d / 2 + 0.009;
      if (r.kind === 'drawer') {
        add(mat, S.rbox(w - gap * 2, rh - gap * 2, 0.018, 0.004), { p: [0, cy, fz], color });
        if (handle === 'bar') handleBar(0, cy + rh * 0.15, fz, Math.min(0.2, w * 0.4), false, hColor); else knob(0, cy, fz, hColor);
      } else if (r.kind === 'doors' || r.kind === 'door') {
        const n = r.kind === 'doors' ? 2 : 1, dw = w / n;
        for (let i = 0; i < n; i++) {
          const cx = -w / 2 + dw * (i + 0.5);
          add(mat, S.rbox(dw - gap * 2, rh - gap * 2, 0.018, 0.004), { p: [cx, cy, fz], color });
          const hx = n === 2 ? cx + (i === 0 ? dw / 2 - 0.05 : -dw / 2 + 0.05) : cx + dw / 2 - 0.05;
          if (handle === 'bar') handleBar(hx, cy + rh * 0.3 - 0.05, fz, 0.12, true, hColor); else knob(hx, cy + rh * 0.3, fz, hColor);
        }
      } else if (r.kind === 'open') {
        add(mat, S.box(w - 0.04, rh - 0.02, 0.01), { p: [0, cy, -d / 2 + 0.03], color: new THREE.Color(color).multiplyScalar(0.7) });
      }
      y += rh;
    }
    if (top) add(top.mat, S.rbox(w + (top.over ?? 0.02) * 2, top.t ?? 0.03, d + (top.over ?? 0.02) + 0.01, 0.006), { p: [0, h + (top.t ?? 0.03) / 2, (top.over ?? 0.02) / 2], color: top.color });
    kit.collide(0, 0, w, d);
  }
  /** Row of books between x0..x1 on a shelf top at y (front +z). */
  function books(x0, x1, y, d, seed = 1, { lean = true, palette } = {}) {
    let s = seed * 9301 + 49297;
    const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    const pal = palette || [0x8a2a3a, 0x2a4a6a, 0xd8b060, 0x3a6a4a, 0xe8d8c8, 0x6a3a8a, 0xff8cbf, 0x1a1a24, 0xc8603a, 0x4ab0c8];
    let x = x0;
    while (x < x1 - 0.03) {
      const bw = 0.018 + rnd() * 0.03, bh = 0.16 + rnd() * 0.11, bd = d * (0.7 + rnd() * 0.25);
      if (x + bw > x1) break;
      const c = pal[Math.floor(rnd() * pal.length)];
      const tilt = lean && rnd() < 0.08 && x + bw + 0.05 < x1 ? -0.25 : 0;
      add('paint', S.box(bw, bh, bd), { p: [x + bw / 2 + (tilt ? bh * 0.12 : 0), y + bh / 2 - (tilt ? 0.01 : 0), 0], r: [0, 0, tilt], color: c, ao: false });
      if (rnd() < 0.5) add('paint', S.box(bw + 0.001, 0.008, bd * 0.95), { p: [x + bw / 2, y + bh * 0.8, 0], color: 0xe8d090, ao: false });
      x += bw + 0.002 + (tilt ? 0.05 : 0);
      if (rnd() < 0.05) x += 0.06;
    }
  }
  /** Open bookcase with n shelves; fill(i, y, w, d) decorates each shelf. */
  function bookcase(w, h, d, { color = 0x5a3a28, mat = 'wood', shelves = 4, fill } = {}) {
    const t = 0.022;
    add(mat, S.box(t, h, d), { p: [-w / 2 + t / 2, h / 2, 0], color });
    add(mat, S.box(t, h, d), { p: [w / 2 - t / 2, h / 2, 0], color });
    add(mat, S.box(w, h, 0.01), { p: [0, h / 2, -d / 2 + 0.005], color: new THREE.Color(color).multiplyScalar(0.7) });
    for (let i = 0; i <= shelves; i++) {
      const y = 0.06 + (h - 0.08) * i / shelves;
      add(mat, S.box(w - t * 2, t, d - 0.01), { p: [0, y, 0.005], color });
      if (i < shelves && fill) fill(i, y + t / 2, w - t * 2, d - 0.02);
    }
    add(mat, S.box(w, 0.06, 0.01), { p: [0, 0.03, d / 2 - 0.005], color });
    kit.collide(0, 0, w, d);
  }
  /** Wall shelf (front +z, back on the wall at z = 0). */
  function wallShelf(w, d = 0.2, color = 0xf4efe8, mat = 'paint') {
    add(mat, S.rbox(w, 0.025, d, 0.005), { p: [0, 0, d / 2], color });
    for (const s of [-1, 1]) add('metal', S.box(0.015, 0.1, d * 0.8), { p: [s * (w / 2 - 0.08), -0.06, d * 0.4], color: 0x2a2a30 });
  }

  // =========================================================== small things
  function plush(kind = 'bear', color = 0xf0c8a0, s = 1) {
    const c = new THREE.Color(color), dark = 0x1a1014;
    at(0, 0, 0, 0, () => {
      add('plush', S.sphere(0.1, 16, 12), { p: [0, 0.09, 0], s: [1, 0.95, 0.85], color: c });
      add('plush', S.sphere(0.085, 16, 12), { p: [0, 0.22, 0.01], color: c });
      if (kind === 'bear') for (const x of [-1, 1]) add('plush', S.sphere(0.03, 10, 8), { p: [x * 0.06, 0.29, 0], color: c });
      if (kind === 'cat') for (const x of [-1, 1]) add('plush', S.cone(0.03, 0.06, 8), { p: [x * 0.05, 0.3, 0], r: [0, 0, -x * 0.3], color: c });
      if (kind === 'ghost') add('plush', S.cone(0.1, 0.12, 14), { p: [0, 0.02, 0], r: [Math.PI, 0, 0], color: c });
      for (const x of [-1, 1]) add('gloss', S.sphere(0.012, 8, 6), { p: [x * 0.03, 0.23, 0.08], color: dark });
      add('plush', S.sphere(0.022, 10, 8), { p: [0, 0.2, 0.08], s: [1.2, 0.9, 0.8], color: kind === 'ghost' ? 0xffc8d8 : new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.5) });
      if (kind !== 'ghost') for (const x of [-1, 1]) {
        add('plush', S.sphere(0.035, 10, 8), { p: [x * 0.09, 0.1, 0.04], color: c });
        add('plush', S.sphere(0.035, 10, 8), { p: [x * 0.05, 0.02, 0.07], color: c });
      }
    }, 0, 0);
    void s;
  }
  function can(color, label = 0xffffff) {
    add('metal', S.cyl(0.033, 0.033, 0.12, 14), { p: [0, 0.06, 0], color });
    add('plastic', S.cyl(0.0335, 0.0335, 0.05, 14), { p: [0, 0.065, 0], color: label });
    add('metal', S.cyl(0.028, 0.033, 0.01, 14), { p: [0, 0.125, 0], color: 0xd0d0d4 });
  }
  function mug(color = 0xffffff) {
    add('gloss', S.cyl(0.04, 0.036, 0.095, 16, true), { p: [0, 0.0475, 0], color });
    add('gloss', S.cyl(0.036, 0.036, 0.006, 16), { p: [0, 0.003, 0], color });
    add('gloss', S.torus(0.025, 0.007, 6, 12), { p: [0.045, 0.05, 0], r: [0, 0, 0], color });
    add('plastic', S.circle(0.036, 16), { p: [0, 0.07, 0], r: [-Math.PI / 2, 0, 0], color: 0x3a2014, ao: false });
  }
  function bottle(h = 0.25, r = 0.035, color = 0x7ac0a0, cap = 0xffffff, key = 'gloss') {
    add(key, S.lathe([[0, 0], [r, 0], [r, h * 0.62], [r * 0.45, h * 0.82], [r * 0.4, h * 0.9], [0, h * 0.9]], 14), { color });
    add('plastic', S.cyl(r * 0.42, r * 0.42, h * 0.1, 10), { p: [0, h * 0.95, 0], color: cap });
  }
  function candle(h = 0.12, r = 0.022, color = 0xf4ead8, lit = true) {
    add('plastic', S.cyl(r, r * 1.02, h, 14), { p: [0, h / 2, 0], color });
    add('plastic', S.sphere(r * 0.4, 8, 6), { p: [r * 0.7, h - 0.01, 0], s: [0.6, 1.6, 0.6], color });
    add('paint', S.cyl(0.0015, 0.0015, 0.014, 4), { p: [0, h + 0.007, 0], color: 0x1a1010 });
    if (lit) {
      add('emitFlicker', S.sphere(0.009, 10, 8), { p: [0, h + 0.02, 0], s: [0.8, 1.9, 0.8], color: 0xffc070, emit: 5, ao: false });
      add('haze', S.sphere(0.04, 10, 8), { p: [0, h + 0.022, 0], color: 0xff8a2a, emit: 0.12, ao: false });
    }
  }
  /** Jack-o'-lantern: ribbed pumpkin with a glowing carved face (front +z). */
  function pumpkin(r = 0.16, { lit = true, face = true, color = 0xe8701a } = {}) {
    const ribs = 8, geo = S.sphere(r, 32, 20), pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      _v.fromBufferAttribute(pos, i);
      const a = Math.atan2(_v.z, _v.x), k = 1 - 0.07 * Math.pow(Math.abs(Math.cos(a * ribs / 2)), 0.5);
      const yy = _v.y / r;
      pos.setXYZ(i, _v.x * k, _v.y * 0.78 - 0.1 * r * Math.pow(Math.max(0, yy), 6) + 0.06 * r * Math.pow(Math.max(0, -yy), 6), _v.z * k);
    }
    geo.computeVertexNormals();
    const col = new THREE.Color(color);
    add('plastic', geo, { p: [0, r * 0.78, 0], color: (p, n, c) => c.copy(col).multiplyScalar(0.8 + 0.25 * Math.max(0, n.y)) });
    add('woodMatte', S.cyl(r * 0.07, r * 0.11, r * 0.4, 7), { p: [0.01, r * 1.62, 0], r: [0.15, 0, 0.2], color: 0x4a5a22 });
    if (face) {
      const fz = r * 0.93, glow = { color: lit ? 0xffa030 : 0x1a0a04, emit: lit ? 4 : 1, ao: false };
      const key = lit ? 'emitFlicker' : 'paint';
      for (const s of [-1, 1]) add(key, S.cone(r * 0.16, r * 0.22, 3), { p: [s * r * 0.34, r * 1.0, fz * 0.95], r: [Math.PI / 2, 0, Math.PI], s: [1, 1, 0.3], ...glow });
      add(key, S.cone(r * 0.09, r * 0.12, 3), { p: [0, r * 0.82, fz], r: [Math.PI / 2, 0, Math.PI], s: [1, 1, 0.3], ...glow });
      const mouth = new THREE.Shape();
      mouth.moveTo(-0.5, 0); for (let i = 0; i <= 6; i++) mouth.lineTo(-0.5 + i / 6, i % 2 ? -0.12 : 0.05);
      mouth.lineTo(0.45, -0.25); mouth.quadraticCurveTo(0, -0.5, -0.45, -0.25); mouth.closePath();
      add(key, S.extrude(mouth, 0.02), { p: [0, r * 0.58, fz * 0.92], s: [r * 1.05, r * 0.9, 1], ...glow });
    }
  }
  /** Corner cobweb: a square in the local xy plane hanging from its top edge at y = 0 (place it across a corner). */
  function cobweb(size = 0.5) {
    add('web', S.plane(size, size * 0.8), { p: [0, -size * 0.4, 0], uv: 'keep', ao: false });
  }
  /** Catenary string of warm bulbs between a and b (Vector3, local). */
  function fairyLights(a, b, n = 18, sag = 0.12, color = 0xffc878, emit = 4) {
    const pts = [];
    for (let i = 0; i <= 24; i++) { const t = i / 24; pts.push(new THREE.Vector3().lerpVectors(a, b, t).add(_v.set(0, -sag * 4 * t * (1 - t), 0))); }
    add('plastic', S.tube(pts, 0.002, 48, 4), { color: 0x1a1a1a, ao: false });
    const cols = Array.isArray(color) ? color : [color];
    for (let i = 1; i < n; i++) {
      const t = i / n, p = new THREE.Vector3().lerpVectors(a, b, t).add(_v.set(0, -sag * 4 * t * (1 - t) - 0.012, 0));
      add('emit', S.sphere(0.009, 8, 6), { p: [p.x, p.y, p.z], s: [1, 1.4, 1], color: cols[i % cols.length], emit, ao: false });
    }
  }
  function bunting(a, b, n = 10, colors = [0xff7a1a, 0x1a1020, 0x8a4ac8]) { // pennant flags on a string
    const pts = [];
    const sag = 0.18;
    for (let i = 0; i <= 20; i++) { const t = i / 20; pts.push(new THREE.Vector3().lerpVectors(a, b, t).add(_v.set(0, -sag * 4 * t * (1 - t), 0))); }
    add('plastic', S.tube(pts, 0.0025, 40, 4), { color: 0x222222, ao: false });
    const dir = new THREE.Vector3().subVectors(b, a); const ry = Math.atan2(-dir.z, dir.x);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n, p = new THREE.Vector3().lerpVectors(a, b, t).add(_v.set(0, -sag * 4 * t * (1 - t), 0));
      const tri = new THREE.Shape(); tri.moveTo(-0.06, 0); tri.lineTo(0.06, 0); tri.lineTo(0, -0.15); tri.closePath();
      add('fabric', new THREE.ShapeGeometry(tri), { p: [p.x, p.y, p.z], r: [0.12, ry, 0], color: colors[i % colors.length], uv: 'local', ao: false });
    }
  }
  function bat(s = 1) { // paper bat cutout on a wall (front +z)
    const sh = new THREE.Shape();
    sh.moveTo(0, 0.03); sh.quadraticCurveTo(0.05, 0.06, 0.12, 0.05); sh.quadraticCurveTo(0.1, 0.02, 0.11, -0.01);
    sh.quadraticCurveTo(0.08, 0.0, 0.07, -0.03); sh.quadraticCurveTo(0.05, -0.01, 0.03, -0.035); sh.lineTo(0, -0.02);
    sh.lineTo(-0.03, -0.035); sh.quadraticCurveTo(-0.05, -0.01, -0.07, -0.03); sh.quadraticCurveTo(-0.08, 0, -0.11, -0.01);
    sh.quadraticCurveTo(-0.1, 0.02, -0.12, 0.05); sh.quadraticCurveTo(-0.05, 0.06, 0, 0.03);
    add('paint', new THREE.ShapeGeometry(sh), { p: [0, 0, 0.003], s: [s, s, 1], color: 0x120a14, uv: 'local', ao: false });
  }
  function plant(kind = 'monstera', potColor = 0xe8e0d4, s = 1) {
    add('gloss', S.lathe([[0, 0], [0.1 * s, 0], [0.12 * s, 0.2 * s], [0.13 * s, 0.24 * s], [0.115 * s, 0.24 * s], [0, 0.22 * s]], 20), { color: potColor });
    add('woodMatte', S.cyl(0.11 * s, 0.11 * s, 0.01, 16), { p: [0, 0.225 * s, 0], color: 0x2a1a10 });
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const leaves = kind === 'snake' ? 9 : 11;
    for (let i = 0; i < leaves; i++) {
      const a = rnd() * TAU, len = (kind === 'snake' ? 0.45 : 0.3) * s * (0.7 + rnd() * 0.5), tilt = kind === 'snake' ? 0.15 + rnd() * 0.15 : 0.5 + rnd() * 0.5;
      const leaf = new THREE.Shape();
      if (kind === 'snake') { leaf.moveTo(-0.025, 0); leaf.quadraticCurveTo(-0.03, len * 0.6, 0, len); leaf.quadraticCurveTo(0.03, len * 0.6, 0.025, 0); }
      else { leaf.moveTo(0, 0); leaf.bezierCurveTo(-0.14 * s, len * 0.3, -0.12 * s, len * 0.9, 0, len); leaf.bezierCurveTo(0.12 * s, len * 0.9, 0.14 * s, len * 0.3, 0, 0); }
      at(0, 0.23 * s, 0, a, () => {
        add('plastic', new THREE.ShapeGeometry(leaf, 6), { r: [-tilt, 0, 0], color: kind === 'snake' ? 0x3a6a3a : new THREE.Color(0x2e6a3a).multiplyScalar(0.8 + rnd() * 0.4), uv: 'local', ao: false });
        if (kind !== 'snake') add('plastic', S.cyl(0.004, 0.005, len * 0.8, 5), { p: [0, len * 0.35 * Math.cos(tilt), len * 0.35 * Math.sin(tilt) * -1], r: [-tilt, 0, 0], color: 0x3a6a2a });
      });
    }
  }
  function rug(tex, w, d, { y = 0.004, round = false } = {}) {
    pic(tex, w, d, { p: [0, y, 0], r: [-Math.PI / 2, 0, 0], rough: 1, transparent: round, alphaTest: round ? 0.5 : 0, geo: round ? new THREE.CircleGeometry(w / 2, 48) : undefined });
    if (round) { const m = root.children[root.children.length - 1]; const uv = m.geometry.attributes.uv; void uv; }
  }

  return { add, at, pic, framed, legs4, handleBar, knob, cabinet, books, bookcase, wallShelf, plush, can, mug, bottle, candle, pumpkin, cobweb, fairyLights, bunting, bat, plant, rug, roundRect, heartShape, S };
}
