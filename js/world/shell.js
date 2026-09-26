// The house itself: per-room wall finishes (each room owns the inner half of its walls), door and window
// openings with casings and jamb linings, baseboards, crown molding, floors, ceilings, door leaves, window
// frames with glass, and a painted night view outside every window.
import * as THREE from 'three';
import { shapes as S } from './kit.js';
import { art } from './tex.js';

const TRIM = { stream: 0xffffff, bedroom: 0xe8e2d4, bathroom: 0xf4f7f5, hallway: 0x3b2418, kitchen: 0xf2f0e8, living: 0x5a3b26 };
const CROWN = { stream: 0xffffff, bedroom: 0xe8e2d4, bathroom: 0xf4f7f5, hallway: 0x4a3020, kitchen: 0xf6f4ee, living: 0xe8dcc8 };

/** Openings on a wall line. line: { axis: 'x'|'z', at } */
function openingsOn(plan, axis, at, a, b) {
  return plan.openings.filter((o) => o.axis === axis && Math.abs(o.at - at) < 1e-6 && o.c > a && o.c < b).sort((p, q) => p.c - q.c);
}

export function buildShell(kit, plan, M, root) {
  const { H, T } = plan;
  const half = T / 2;
  const doors = [];

  // ------------------------------------------------ walls
  // A wall slab for one room side: runs along `axis` at coordinate `at`, from a to b, thickness `th`
  // on the side given by `dir` (+1 / -1 along the normal axis).
  function slab(key, axis, at, a, b, dir, th, color = 0xffffff) {
    const ops = openingsOn(plan, axis, at, a, b);
    const piece = (u0, u1, y0, y1) => {
      if (u1 - u0 < 1e-4 || y1 - y0 < 1e-4) return;
      const len = u1 - u0, cu = (u0 + u1) / 2, cn = at + dir * th / 2, cy = (y0 + y1) / 2;
      const geo = axis === 'x' ? S.box(len, y1 - y0, th) : S.box(th, y1 - y0, len);
      const p = axis === 'x' ? [cu, cy, cn] : [cn, cy, cu];
      kit.add(key, geo, { p, uv: 'world', ao: false, color });
    };
    let cur = a;
    for (const o of ops) {
      const l = o.c - o.w / 2, r = o.c + o.w / 2;
      piece(cur, l, 0, H);
      piece(l, r, o.y1, H);
      if (o.y0 > 0) piece(l, r, 0, o.y0);
      cur = r;
    }
    piece(cur, b, 0, H);
    return ops;
  }
  // trims along an inner face: baseboard + crown, broken at door openings
  function faceTrims(room, axis, at, a, b, dir) {
    const R = plan.rooms[room], ops = openingsOn(plan, axis, at, a, b);
    const face = at + dir * half; // inner face coordinate
    const run = (u0, u1, fn) => { if (u1 - u0 > 0.01) fn(u0, u1); };
    const along = (u0, u1, y, h, d, key, color, rot = 0) => {
      const len = u1 - u0, cu = (u0 + u1) / 2, cn = face + dir * d / 2;
      const geo = axis === 'x' ? S.box(len, h, d) : S.box(d, h, len);
      const p = axis === 'x' ? [cu, y, cn] : [cn, y, cu];
      const r = axis === 'x' ? [rot, 0, 0] : [0, 0, rot];
      kit.add(key, geo, { p, r, color, ao: false });
    };
    // baseboard (skip door gaps)
    let cur = a;
    for (const o of ops.filter((o) => o.y0 === 0)) { run(cur, o.c - o.w / 2 - 0.08, (u0, u1) => along(u0, u1, 0.055, 0.11, 0.018, 'paint', TRIM[room])); cur = o.c + o.w / 2 + 0.08; }
    run(cur, b, (u0, u1) => along(u0, u1, 0.055, 0.11, 0.018, 'paint', TRIM[room]));
    // crown: a 45° bar half in the wall/ceiling corner
    along(a, b, H - 0.001, 0.075, 0.075, 'paint', CROWN[room], Math.PI / 4);
    void R;
  }

  const sides = (r) => [
    { axis: 'x', at: r.z0, a: r.x0, b: r.x1, dir: +1 },  // north side, faces +z
    { axis: 'x', at: r.z1, a: r.x0, b: r.x1, dir: -1 },  // south side
    { axis: 'z', at: r.x0, a: r.z0, b: r.z1, dir: +1 },  // west side, faces +x
    { axis: 'z', at: r.x1, a: r.z0, b: r.z1, dir: -1 },  // east side
  ];
  const B = plan.bounds;
  const exterior = (sd) => (sd.axis === 'x' ? Math.abs(sd.at - B.z0) < 1e-6 || Math.abs(sd.at - B.z1) < 1e-6 : Math.abs(sd.at - B.x0) < 1e-6 || Math.abs(sd.at - B.x1) < 1e-6);

  for (const [name, r] of Object.entries(plan.rooms)) {
    for (const sd of sides(r)) {
      slab('wall_' + r.wall, sd.axis, sd.at, sd.a, sd.b, sd.dir, half);
      if (exterior(sd)) slab('paint', sd.axis, sd.at, sd.a - (sd.axis === 'x' ? 0 : 0), sd.b, -sd.dir, half, 0x2a2430);
      faceTrims(name, sd.axis, sd.at, sd.a, sd.b, sd.dir);
    }
    // floor + ceiling
    kit.add('floor_' + r.floor, S.box(r.x1 - r.x0, 0.06, r.z1 - r.z0), { p: [(r.x0 + r.x1) / 2, -0.03, (r.z0 + r.z1) / 2], uv: 'world', ao: false });
    kit.add('ceiling', S.plane(r.x1 - r.x0, r.z1 - r.z0), { p: [(r.x0 + r.x1) / 2, H, (r.z0 + r.z1) / 2], r: [Math.PI / 2, 0, 0], uv: 'world', ao: false, color: r.ceiling ?? 0xd8d0d8 });
  }
  // colliders: every wall slab outside door openings (full thickness, both rooms at once); a door leaf
  // gets its own collider that is switched off while it stands open
  for (const w of plan.wallLines) {
    const ops = openingsOn(plan, w.axis, w.at, w.a, w.b).filter((o) => o.y0 === 0 && o.kind === 'door');
    let cur = w.a;
    const col = (u0, u1) => { if (u1 - u0 < 1e-3) return; const c = (u0 + u1) / 2; if (w.axis === 'x') kit.collide(c, w.at, u1 - u0, T); else kit.collide(w.at, c, T, u1 - u0); };
    for (const o of ops) { col(cur, o.c - o.w / 2); cur = o.c + o.w / 2; }
    col(cur, w.b);
  }

  // ------------------------------------------------ openings: casings, jambs, doors, windows
  for (const o of plan.openings) {
    // local frame: origin at the opening center on the wall line, +x along the wall, +z toward `o.front`
    const ry = o.axis === 'x' ? 0 : Math.PI / 2;
    const [cx, cz] = o.axis === 'x' ? [o.c, o.at] : [o.at, o.c];
    kit.at(cx, 0, cz, ry, () => {
      const w = o.w, y0 = o.y0, y1 = o.y1;
      const trimCol = o.trim ?? 0xf4efe8, trimB = o.trimBack ?? trimCol;
      // jamb lining over the reveal
      const lining = (key, color) => {
        kit.add(key, S.box(0.025, y1 - y0, T + 0.01), { p: [-w / 2 + 0.0125, (y0 + y1) / 2, 0], color, ao: false });
        kit.add(key, S.box(0.025, y1 - y0, T + 0.01), { p: [w / 2 - 0.0125, (y0 + y1) / 2, 0], color, ao: false });
        kit.add(key, S.box(w, 0.025, T + 0.01), { p: [0, y1 - 0.0125, 0], color, ao: false });
        if (y0 > 0) kit.add(key, S.box(w, 0.025, T + 0.01), { p: [0, y0 + 0.0125, 0], color, ao: false });
      };
      lining('paint', trimCol);
      // casings on both faces
      for (const side of [1, -1]) {
        const col = side === 1 ? trimCol : trimB, zc = side * (half + 0.009), cw = 0.075;
        const bottom = y0 > 0 ? y0 - (o.kind === 'window' ? 0.09 : 0) : 0;
        kit.add('paint', S.rbox(cw, y1 - bottom + cw, 0.018, 0.006), { p: [-w / 2 - cw / 2 + 0.01, (bottom + y1 + cw) / 2, zc], color: col, ao: false });
        kit.add('paint', S.rbox(cw, y1 - bottom + cw, 0.018, 0.006), { p: [w / 2 + cw / 2 - 0.01, (bottom + y1 + cw) / 2, zc], color: col, ao: false });
        kit.add('paint', S.rbox(w + cw * 2, cw * 1.2, 0.022, 0.006), { p: [0, y1 + cw * 0.6, zc], color: col, ao: false });
        if (o.kind === 'window' && (side === 1) === (o.inside !== -1)) { // sill (stool) + apron on the room side
          kit.add('paint', S.rbox(w + 0.2, 0.03, 0.09, 0.008), { p: [0, y0 - 0.015, side * (half + 0.035)], color: col });
          kit.add('paint', S.rbox(w + 0.1, 0.07, 0.016, 0.005), { p: [0, y0 - 0.065, zc], color: col });
        }
      }
      if (o.kind === 'door' && o.leaf) doors.push(doorLeaf(kit, o, M, root, T));
      if (o.kind === 'door' && o.threshold) kit.add('wood', S.rbox(w, 0.012, T + 0.02, 0.004), { p: [0, 0.006, 0], color: 0x6a4a34 });
      if (o.kind === 'window') windowFrame(kit, o, T);
    });
  }
  return { doors };
}

/**
 * Panel door on a hinge, built as its own movable object (called inside the opening's frame).
 * o.leaf = { hinge: -1|1 (side along the wall), open: radians, swing: +1|-1 (into which face), color }
 * Returns { id, o, pivot, swing, sign, openAngle, angle, collider }: rotate swing.rotation.y = sign * angle.
 */
function doorLeaf(kit, o, M, root, T) {
  const L = o.leaf, w = o.w - 0.05, h = o.y1 - 0.02, th = 0.04;
  const hx = L.hinge * (o.w / 2 - 0.03);
  const pivot = new THREE.Group();
  pivot.name = 'door_' + (o.id || o.c);
  pivot.position.copy(kit.world(hx, 0, L.swing * 0.02));
  pivot.rotation.y = o.axis === 'x' ? 0 : Math.PI / 2;
  const swing = new THREE.Group();
  pivot.add(swing);
  const leaf = kit.capture(M, () => {
    kit.at(-L.hinge * w / 2, 0, 0, 0, () => {
      const col = L.color ?? 0xefe6dc;
      kit.add(L.mat ?? 'paint', S.rbox(w, h, th, 0.008), { p: [0, h / 2 + 0.01, 0], color: col });
      // raised panels on both faces
      for (const f of [1, -1]) for (const [py, ph] of [[h * 0.7, h * 0.42], [h * 0.25, h * 0.36]]) {
        kit.add(L.mat ?? 'paint', S.rbox(w - 0.2, ph, 0.012, 0.01), { p: [0, py, f * (th / 2 + 0.004)], color: col });
      }
      // knob + rose on both faces, latch side
      for (const f of [1, -1]) {
        const kx = -L.hinge * (w / 2 - 0.08);
        kit.add('metal', S.cyl(0.028, 0.028, 0.008, 16), { p: [kx, 1.0, f * (th / 2 + 0.004)], r: [Math.PI / 2, 0, 0], color: 0xc8a060 });
        kit.add('metal', S.sphere(0.03, 14, 10), { p: [kx, 1.0, f * (th / 2 + 0.05)], s: [1, 1, 0.8], color: 0xd4b070 });
        kit.add('metal', S.cyl(0.009, 0.009, 0.045, 8), { p: [kx, 1.0, f * (th / 2 + 0.025)], r: [Math.PI / 2, 0, 0], color: 0xc8a060 });
      }
      for (const hy of [0.25, h - 0.25]) kit.add('metal', S.cyl(0.008, 0.008, 0.09, 8), { p: [L.hinge * (w / 2 + 0.004), hy, 0], color: 0x9a8a6a });
    });
  });
  swing.add(leaf);
  root.add(pivot);
  // closed-door collider across the opening (world space, XZ)
  const [cx, cz] = o.axis === 'x' ? [o.c, o.at] : [o.at, o.c];
  const collider = o.axis === 'x'
    ? { x0: cx - o.w / 2, x1: cx + o.w / 2, z0: cz - T / 2, z1: cz + T / 2, off: false }
    : { x0: cx - T / 2, x1: cx + T / 2, z0: cz - o.w / 2, z1: cz + o.w / 2, off: false };
  kit.colliders.push(collider);
  const door = { id: o.id || String(o.c), o, pivot, swing, sign: L.hinge * L.swing, openAngle: L.open || 1.5, angle: 0, collider, center: new THREE.Vector3(cx, 1.3, cz) };
  const angle = o.closed ? 0 : door.openAngle;
  door.angle = angle;
  swing.rotation.y = door.sign * angle;
  collider.off = angle > 0.35;
  return door;
}

function windowFrame(kit, o, T) {
  const w = o.w, y0 = o.y0, y1 = o.y1, h = y1 - y0, fw = 0.045, col = o.frame ?? 0xf6f2ea;
  const z = -0.02; // set a little toward the outside
  kit.add('paint', S.box(w, fw, 0.06), { p: [0, y0 + fw / 2, z], color: col });
  kit.add('paint', S.box(w, fw, 0.06), { p: [0, y1 - fw / 2, z], color: col });
  kit.add('paint', S.box(fw, h, 0.06), { p: [-w / 2 + fw / 2, (y0 + y1) / 2, z], color: col });
  kit.add('paint', S.box(fw, h, 0.06), { p: [w / 2 - fw / 2, (y0 + y1) / 2, z], color: col });
  if (o.mullion !== false) kit.add('paint', S.box(fw * 0.8, h, 0.05), { p: [0, (y0 + y1) / 2, z], color: col });
  if (o.transom) kit.add('paint', S.box(w, fw * 0.8, 0.05), { p: [0, y1 - h * 0.3, z], color: col });
  kit.add('glass', S.plane(w - fw, h - fw), { p: [0, (y0 + y1) / 2, z], uv: 'keep', ao: false, color: o.frosted ? 0xe8f0f0 : 0xffffff });
  void T;
}

// ------------------------------------------------ night view outside the windows
function drawNight(g, w, h, seed) {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#0b0a24'); sky.addColorStop(0.55, '#1d1840'); sky.addColorStop(0.78, '#3a2446'); sky.addColorStop(1, '#120c16');
  g.fillStyle = sky; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(255,255,255,${0.2 + rnd() * 0.6})`; const r = rnd() < 0.1 ? 1.6 : 0.8; g.fillRect(rnd() * w, rnd() * h * 0.6, r, r); }
  // moon with a halo
  const mx = w * 0.7, my = h * 0.2, mr = h * 0.07;
  const halo = g.createRadialGradient(mx, my, mr, mx, my, mr * 5);
  halo.addColorStop(0, 'rgba(200,210,255,0.35)'); halo.addColorStop(1, 'rgba(200,210,255,0)');
  g.fillStyle = halo; g.fillRect(0, 0, w, h);
  g.fillStyle = '#f4f0dc'; g.beginPath(); g.arc(mx, my, mr, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(180,170,150,0.45)';
  for (const [dx, dy, r] of [[-0.3, -0.2, 0.18], [0.25, 0.1, 0.12], [-0.05, 0.35, 0.1]]) { g.beginPath(); g.arc(mx + dx * mr, my + dy * mr, r * mr, 0, 7); g.fill(); }
  // clouds across the moon
  g.fillStyle = 'rgba(40,30,70,0.55)';
  for (let i = 0; i < 6; i++) { g.beginPath(); g.ellipse(mx - mr * 3 + i * mr * 1.3, my + mr * (0.6 + rnd() * 0.4), mr * (1.4 + rnd()), mr * 0.28, 0, 0, 7); g.fill(); }
  // neighbours' roofs with a few lit windows
  g.fillStyle = '#0c0812';
  for (let x = -40; x < w; x += 170 + rnd() * 80) {
    const bw = 130 + rnd() * 70, bh = h * (0.18 + rnd() * 0.08), by = h * 0.8 - bh;
    g.beginPath(); g.moveTo(x, h); g.lineTo(x, by); g.lineTo(x + bw / 2, by - bh * 0.45); g.lineTo(x + bw, by); g.lineTo(x + bw, h); g.fill();
    if (rnd() < 0.6) { g.fillStyle = rnd() < 0.5 ? '#ffb86a' : '#8fd0ff'; g.fillRect(x + bw * 0.3, by + bh * 0.3, 16, 20); g.fillStyle = '#0c0812'; }
  }
  // trees and a power pole with sagging lines (very Thai street)
  g.fillStyle = '#07050a';
  for (let x = 0; x < w; x += 60 + rnd() * 120) {
    const th = h * (0.25 + rnd() * 0.2), tw = 40 + rnd() * 50;
    g.fillRect(x - 3, h - th * 0.5, 6, th * 0.5);
    for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(x + (rnd() - 0.5) * tw, h - th * (0.55 + rnd() * 0.4), tw * (0.35 + rnd() * 0.3), 0, 7); g.fill(); }
  }
  const px = w * 0.18;
  g.fillRect(px - 4, h * 0.25, 8, h);
  g.fillRect(px - 30, h * 0.3, 60, 5);
  g.strokeStyle = 'rgba(5,4,8,0.9)'; g.lineWidth = 2;
  for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(px - 28 + k * 18, h * 0.3); g.quadraticCurveTo(px + w * 0.4, h * (0.4 + k * 0.03), w + 20, h * (0.28 + k * 0.02)); g.stroke(); }
  g.fillStyle = 'rgba(8,6,12,1)'; g.fillRect(0, h * 0.93, w, h * 0.07);
}

let nightTex = null;
const nightTexture = () => nightTex || (nightTex = art(1024, 512, (g, w, h) => drawNight(g, w, h, 7), { fonts: false }));

/** A painted night-street backdrop plane (w × h m) at (x, y, z) turned by ry (front +z). */
export function backdrop(root, x, y, z, ry, w = 7, h = 3.5, offset = 0, dim = 0.55) {
  const t = nightTexture().clone(); t.needsUpdate = true; t.wrapS = THREE.RepeatWrapping; t.offset.x = offset; t.repeat.x = Math.min(1, w / 11);
  const mat = new THREE.MeshBasicMaterial({ map: t, toneMapped: false, color: new THREE.Color(dim, dim, dim * 1.12) });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.position.set(x, y, z); m.rotation.y = ry; m.name = 'outside';
  root.add(m);
  return m;
}

/** A curved painted panorama (inside of a cylinder arc) around (cx, cz), centered on direction `dir` (rad, 0 = +z). */
export function panorama(root, cx, cz, r, dir, arc = 2.6, y0 = -1, h = 6.5, dim = 0.6) {
  const t = nightTexture().clone(); t.needsUpdate = true; t.wrapS = THREE.RepeatWrapping; t.repeat.x = Math.max(1, Math.round(r * arc / 10));
  const mat = new THREE.MeshBasicMaterial({ map: t, toneMapped: false, side: THREE.BackSide, color: new THREE.Color(dim, dim, dim * 1.12) });
  const geo = new THREE.CylinderGeometry(r, r, h, 48, 1, true, dir - arc / 2, arc);
  const m = new THREE.Mesh(geo, mat);
  m.position.set(cx, y0 + h / 2, cz); m.name = 'outside';
  root.add(m);
  return m;
}

/** Backdrop planes outside the windows (unique textures, so separate meshes). */
export function buildOutside(root, plan) {
  const tex = nightTexture();
  tex.wrapS = THREE.RepeatWrapping;
  const meshes = [];
  plan.openings.filter((o) => o.kind === 'window' || o.outside).forEach((o, i) => {
    const t = tex.clone(); t.needsUpdate = true; t.offset.x = (i * 0.37) % 1; t.repeat.x = 0.6;
    const mat = new THREE.MeshBasicMaterial({ map: t, toneMapped: false, color: new THREE.Color(0.55, 0.55, 0.62) });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(7, 3.5), mat);
    const out = -(o.inside ?? 1); // which side of the wall line is outside (+ along the normal axis)
    const d = o.view ?? 2.8;
    if (o.axis === 'x') { m.position.set(o.c, 1.5, o.at + out * d); m.rotation.y = out > 0 ? Math.PI : 0; } else { m.position.set(o.at + out * d, 1.5, o.c); m.rotation.y = out > 0 ? -Math.PI / 2 : Math.PI / 2; }
    m.name = 'outside';
    root.add(m); meshes.push(m);
  });
  return meshes;
}
