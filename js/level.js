// Peachi's house on Halloween night (Night 1). Layout in meters, Y up. House spans x -10..10, z -7..7.
//   North (z -7..-1): stream room (x -10..-2) | bedroom (x -2..4.5) | bathroom (x 4.5..10)
//   Hallway along X at z -1..1 (front door at the west end)
//   South (z  1.. 7): kitchen + dining (x -10..3) | living room (x 3..10)
// Built from js/world/*: procedural textures, a merge-per-material kit, the house shell and furnished rooms.
import * as THREE from 'three';
import { Kit } from './world/kit.js';
import { createMaterials } from './world/materials.js';
import { buildShell, buildOutside } from './world/shell.js';
import { furnish } from './world/rooms.js';

const H = 2.8, T = 0.2;
const DOOR = { y0: 0, y1: 2.15, kind: 'door' };

export const PLAN = {
  H, T,
  bounds: { x0: -10, x1: 10, z0: -7, z1: 7 },
  rooms: {
    stream: { x0: -10, x1: -2, z0: -7, z1: -1, floor: 'blush', wall: 'peachi', ceiling: 0xf6e4e8 },
    bedroom: { x0: -2, x1: 4.5, z0: -7, z1: -1, floor: 'honey', wall: 'guest', ceiling: 0xd8d4c8 },
    bathroom: { x0: 4.5, x1: 10, z0: -7, z1: -1, floor: 'bathTile', wall: 'bath', ceiling: 0xdde6e4 },
    hallway: { x0: -10, x1: 10, z0: -1, z1: 1, floor: 'darkOak', wall: 'hall', ceiling: 0xb8a898 },
    kitchen: { x0: -10, x1: 3, z0: 1, z1: 7, floor: 'checker', wall: 'kitchen', ceiling: 0xe8e8e0 },
    living: { x0: 3, x1: 10, z0: 1, z1: 7, floor: 'oak', wall: 'living', ceiling: 0xe0d4c0 },
  },
  wallLines: [
    { axis: 'x', at: -7, a: -10.1, b: 10.1 }, { axis: 'x', at: 7, a: -10.1, b: 10.1 },
    { axis: 'z', at: -10, a: -7.1, b: 7.1 }, { axis: 'z', at: 10, a: -7.1, b: 7.1 },
    { axis: 'x', at: -1, a: -10, b: 10 }, { axis: 'x', at: 1, a: -10, b: 10 },
    { axis: 'z', at: -2, a: -7, b: -1 }, { axis: 'z', at: 4.5, a: -7, b: -1 }, { axis: 'z', at: 3, a: 1, b: 7 },
  ],
  // axis 'x' = wall running along x at z = at; 'z' = along z at x = at. c = center along the wall.
  // Door leaf: hinge ±1 (end of the opening along the wall), swing ±1 (toward +/- normal), open (rad).
  openings: [
    { ...DOOR, id: 'stream', axis: 'x', at: -1, c: -4, w: 1.1, trim: 0xffffff, trimBack: 0x3b2418, threshold: true, leaf: { hinge: -1, swing: -1, open: 1.95, color: 0xfff4f6 } },
    { ...DOOR, id: 'bedroom', axis: 'x', at: -1, c: 1.5, w: 1.1, trim: 0xe8e2d4, trimBack: 0x3b2418, threshold: true, leaf: { hinge: 1, swing: -1, open: 1.85, color: 0xd8d2c4 } },
    { ...DOOR, id: 'bathroom', axis: 'x', at: -1, c: 6.8, w: 1.1, trim: 0xf4f7f5, trimBack: 0x3b2418, threshold: true, leaf: { hinge: -1, swing: -1, open: 1.7, color: 0xe8f0ee } },
    { ...DOOR, id: 'kitchen', axis: 'x', at: 1, c: -3, w: 1.1, trim: 0x3b2418, trimBack: 0xf2f0e8, threshold: true, leaf: { hinge: 1, swing: 1, open: 1.95, color: 0xefe8da } },
    { ...DOOR, axis: 'x', at: 1, c: 6.5, w: 1.4, trim: 0x3b2418, trimBack: 0x5a3b26, threshold: true },
    { ...DOOR, axis: 'z', at: 3, c: 4.5, w: 1.4, trim: 0xf2f0e8, trimBack: 0x5a3b26 },
    { ...DOOR, id: 'front', axis: 'z', at: -10, c: 0, w: 1.0, closed: true, trim: 0x3b2418, trimBack: 0x3b2418, leaf: { hinge: -1, swing: 1, open: 0, color: 0x5a2a22, mat: 'wood' } },
    // windows (inside: which side of the wall line is the room, +1 / -1 along the normal)
    { kind: 'window', axis: 'z', at: -10, c: -4.0, w: 2.3, y0: 0.7, y1: 2.35, inside: 1, trim: 0xffffff, transom: false, view: 8.3 },
    { kind: 'window', axis: 'x', at: -7, c: 1.2, w: 1.1, y0: 0.9, y1: 2.1, inside: 1, trim: 0xe8e2d4 },
    { kind: 'window', axis: 'x', at: -7, c: 8.75, w: 0.9, y0: 1.6, y1: 2.25, inside: 1, trim: 0xf4f7f5, frosted: true, mullion: false },
    { kind: 'window', axis: 'x', at: 7, c: -6.9, w: 1.4, y0: 1.1, y1: 2.1, inside: -1, trim: 0xf2f0e8 },
    { kind: 'window', axis: 'z', at: -10, c: 3.6, w: 1.2, y0: 0.9, y1: 2.1, inside: 1, trim: 0xf2f0e8, view: 8.3 },
    { kind: 'window', axis: 'x', at: 7, c: 6.5, w: 2.0, y0: 1.05, y1: 2.15, inside: -1, trim: 0x5a3b26, transom: true },
  ],
};

export function buildLevel(scene) {
  const root = new THREE.Group();
  root.name = 'level';
  scene.add(root);
  scene.background = new THREE.Color(0x040208);
  scene.fog = new THREE.FogExp2(0x0d0818, 0.055);

  const M = createMaterials();
  const kit = new Kit();
  kit.regionOf = (x, z) => { for (const k in PLAN.rooms) { const r = PLAN.rooms[k]; if (x >= r.x0 - 0.15 && x <= r.x1 + 0.15 && z >= r.z0 - 0.15 && z <= r.z1 + 0.15) return k; } return 'out'; };
  const { doors } = buildShell(kit, PLAN, M, root);
  const rooms = furnish(kit, M, root, PLAN);
  const meshes = kit.build(root, M);
  buildOutside(root, PLAN);

  // ---------------- lights
  const hemi = new THREE.HemisphereLight(0x3c3060, 0x0a0610, 0.55);
  root.add(hemi);
  // moonlight from the west-southwest, through the west and south windows (shadow map rendered once);
  // it falls across Peachi's bed through the blinds
  const moon = new THREE.DirectionalLight(0x8ea6ff, 1.8);
  moon.position.set(-14, 11, 9);
  moon.target.position.set(0, 0, 0);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  Object.assign(moon.shadow.camera, { left: -15, right: 15, top: 15, bottom: -15, near: 1, far: 45 });
  moon.shadow.bias = -0.0004; moon.shadow.normalBias = 0.03;
  moon.shadow.autoUpdate = false; moon.shadow.needsUpdate = true;
  root.add(moon, moon.target);

  const lights = [];
  function point(color, intensity, dist, x, y, z, kind) {
    const l = new THREE.PointLight(color, intensity, dist, 2);
    l.position.set(x, y, z);
    root.add(l);
    lights.push({ light: l, base: intensity, kind, seed: Math.random() * 100 });
    return l;
  }
  for (const L of rooms.lights) L.ref = point(L.color, L.intensity, L.dist, L.p[0], L.p[1], L.p[2], L.kind);
  const rgbLight = lights.find((l) => l.kind === 'rgb')?.light;

  // ---------------- gameplay points
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const { itemSpots, ghostSpawns, navPoints, deskPosition, spawn, porch } = rooms.points;

  // ---------------- runtime
  let flicker = false, flickT = 0, flickM = 1;
  const boxes = kit.colliders;
  function collide(pos, radius = 0.3) {
    for (let iter = 0; iter < 2; iter++) {
      for (const b of boxes) {
        if (b.off) continue;
        if (pos.x < b.x0 - radius || pos.x > b.x1 + radius || pos.z < b.z0 - radius || pos.z > b.z1 + radius) continue;
        const cx = Math.min(Math.max(pos.x, b.x0), b.x1), cz = Math.min(Math.max(pos.z, b.z0), b.z1);
        const dx = pos.x - cx, dz = pos.z - cz, d2 = dx * dx + dz * dz;
        if (d2 >= radius * radius) continue;
        if (d2 > 1e-10) {
          const d = Math.sqrt(d2), k = (radius - d) / d;
          pos.x += dx * k; pos.z += dz * k;
        } else { // centre inside the box: leave by the nearest side
          const l = pos.x - b.x0, r = b.x1 - pos.x, n = pos.z - b.z0, s = b.z1 - pos.z, m = Math.min(l, r, n, s);
          if (m === l) pos.x = b.x0 - radius; else if (m === r) pos.x = b.x1 + radius;
          else if (m === n) pos.z = b.z0 - radius; else pos.z = b.z1 + radius;
        }
      }
    }
    return pos;
  }
  function roomAt(pos) {
    for (const k in PLAN.rooms) { const r = PLAN.rooms[k]; if (pos.x >= r.x0 && pos.x <= r.x1 && pos.z >= r.z0 && pos.z <= r.z1) return k; }
    return null;
  }

  // ---------------- doors (E opens/closes; the story can slam them)
  const doorById = {};
  for (const d of doors) doorById[d.id] = d;
  function moveDoor(d, dt) {
    if (d.target == null) return;
    const diff = d.target - d.angle;
    const speed = d.slam ? 10 : 2.6;
    const step = Math.sign(diff) * Math.min(Math.abs(diff), speed * dt * (0.35 + 0.65 * Math.min(1, Math.abs(diff) * 2)));
    d.angle += step;
    if (Math.abs(d.target - d.angle) < 1e-3) { d.angle = d.target; d.target = null; d.slam = false; moon.shadow.needsUpdate = true; }
    d.swing.rotation.y = d.sign * d.angle;
    d.collider.off = d.angle > 0.35;
  }

  // ---------------- room lights on switches (candles, screens and the TV stay as they are)
  const SWITCHED = new Set(['room', 'bulb', 'lamp', 'flicker', 'rgb']);
  for (const L of lights) L.room = roomAt(L.light.position);
  const roomOn = {};
  for (const k in PLAN.rooms) roomOn[k] = true;
  const offMat = new THREE.MeshLambertMaterial({ vertexColors: true, color: 0x2a2628 });
  const switchedMeshes = [...(meshes.emitFairy || []), ...(meshes.emitRGB || [])];
  function setRoomLights(room, on) {
    if (!(room in roomOn) || roomOn[room] === !!on) return false;
    roomOn[room] = !!on;
    for (const m of switchedMeshes) if (m.userData.region === room) m.material = on ? M[m.name] : offMat;
    return true;
  }
  // wall switches, inside each room by its door (latch side)
  const SWITCHES = [
    { room: 'stream', p: V(-3.25, 1.22, -1.105), ry: Math.PI },
    { room: 'bedroom', p: V(0.72, 1.22, -1.105), ry: Math.PI },
    { room: 'bathroom', p: V(7.58, 1.22, -1.105), ry: Math.PI },
    { room: 'kitchen', p: V(-3.78, 1.22, 1.105), ry: 0 },
    { room: 'living', p: V(7.45, 1.22, 1.105), ry: 0 },
  ];
  const plateGeo = new THREE.BoxGeometry(0.075, 0.115, 0.012), rockerGeo = new THREE.BoxGeometry(0.03, 0.05, 0.012), dotGeo = new THREE.CircleGeometry(0.005, 10);
  const plateMat = new THREE.MeshStandardMaterial({ color: 0xf4f0ea, roughness: 0.5 });
  const dotMat = new THREE.MeshBasicMaterial({ color: 0xffa040, toneMapped: false });
  for (const sw of SWITCHES) {
    const g = new THREE.Group(); g.position.copy(sw.p); g.rotation.y = sw.ry;
    const plate = new THREE.Mesh(plateGeo, plateMat); g.add(plate);
    const rocker = new THREE.Mesh(rockerGeo, plateMat); rocker.position.z = 0.008; g.add(rocker);
    const dot = new THREE.Mesh(dotGeo, dotMat); dot.position.set(0, -0.042, 0.0065); g.add(dot); // glows so it can be found in the dark
    root.add(g);
    sw.rocker = rocker;
  }
  const syncSwitches = () => { for (const sw of SWITCHES) sw.rocker.rotation.x = roomOn[sw.room] ? -0.28 : 0.28; };
  syncSwitches();

  const emitF = M.emitFlicker, emitRGB = M.emitRGB;
  function update(dt, t) {
    for (const d of doors) moveDoor(d, dt);
    const hue = 0.86 + 0.07 * Math.sin(t * 0.9);
    emitRGB.color.setHSL(hue, 0.9, 0.62);
    if (rgbLight) rgbLight.color.setHSL(hue, 0.85, 0.6);

    if (flicker) {
      flickT -= dt;
      if (flickT <= 0) { flickT = 0.04 + Math.random() * 0.12; flickM = Math.random() < 0.35 ? 0.03 : 0.35 + Math.random() * 0.9; }
    } else flickM = 1;
    for (const L of lights) {
      let m = 1;
      if (L.kind === 'candle') m = 0.82 + 0.12 * Math.sin(t * 11 + L.seed) + 0.07 * Math.sin(t * 23.7 + L.seed);
      else if (L.kind === 'tv') m = 0.7 + 0.3 * Math.sin(t * 7.3 + L.seed) * Math.sin(t * 2.1);
      else if (L.kind === 'bulb') m = 0.94 + 0.06 * Math.sin(t * 31 + L.seed) * Math.sin(t * 3.3);
      else if (L.kind === 'flicker') { const k = Math.sin(t * 2.3 + L.seed) + Math.sin(t * 5.1 + L.seed * 2); m = k > 1.55 ? 0.15 + 0.3 * Math.random() : 0.9 + 0.1 * Math.sin(t * 40); }
      const off = SWITCHED.has(L.kind) && L.room && !roomOn[L.room];
      L.light.intensity = off ? 0 : L.base * m * (L.kind === 'screen' || L.kind === 'moon' ? Math.max(flickM, 0.3) : flickM);
    }
    emitF.color.setScalar(flicker ? Math.max(flickM, 0.1) : 1);
    rooms.update(dt, t, flicker ? flickM : 1);
  }

  return {
    spawn, deskPosition, itemSpots, ghostSpawns, navPoints,
    collide,
    setFlicker(on) { flicker = !!on; if (!flicker) flickM = 1; },
    update,
    // extras (not part of the contract)
    scene, root, colliders: boxes, rooms: PLAN.rooms, roomAt, meshes, materials: M, moon, V, screens: rooms.screens,
    porch,
    doors: doorById,
    /** Swing a door to open/closed. slam: fast. instant: no animation. */
    setDoor(id, open, { slam = false, instant = false } = {}) {
      const d = doorById[id];
      if (!d) return;
      const target = open ? d.openAngle : 0;
      if (instant) { d.angle = target; d.target = null; d.swing.rotation.y = d.sign * target; d.collider.off = target > 0.35; moon.shadow.needsUpdate = true; return; }
      d.target = target; d.slam = slam;
    },
    doorOpen(id) { const d = doorById[id]; return !!d && (d.target != null ? d.target > 0 : d.angle > 0.35); },
    switches: SWITCHES,
    setRoomLights(room, on) { const r = setRoomLights(room, on); syncSwitches(); return r; },
    roomLightsOn(room) { return roomOn[room] !== false; },
    resetWorld() {
      for (const d of doors) this.setDoor(d.id, !d.o.closed, { instant: true });
      for (const k in roomOn) setRoomLights(k, true);
      syncSwitches();
    },
  };
}
