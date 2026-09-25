// Furnishes every room and gathers room lights and gameplay points (item spots, nav points, spawns).
import * as THREE from 'three';
import { makeProps } from './props.js';
import { art } from './tex.js';
import { roomPeachi } from './room_peachi.js';
import { roomHall, roomGuest } from './room_hall.js';
import { roomBath } from './room_bath.js';
import { roomKitchen } from './room_kitchen.js';
import { roomLiving } from './room_living.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

function webMaterial() {
  const t = art(256, 205, (g, w, h) => { // corner web: strands from the top edge, sagging rings between them
    g.clearRect(0, 0, w, h);
    g.strokeStyle = 'rgba(235,235,245,0.75)'; g.lineWidth = 1.3;
    const cx = w / 2, n = 9, rays = [];
    for (let i = 0; i < n; i++) { const a = Math.PI * (0.04 + 0.92 * i / (n - 1)); rays.push([Math.cos(a), Math.sin(a)]); g.beginPath(); g.moveTo(cx, 0); g.lineTo(cx + Math.cos(a) * w, Math.sin(a) * w); g.stroke(); }
    g.lineWidth = 1;
    for (let r = 14; r < w * 0.75; r += 14 + r * 0.08) {
      g.beginPath();
      for (let i = 0; i < n; i++) {
        const [dx, dy] = rays[i], x = cx + dx * r, y = dy * r;
        if (i === 0) g.moveTo(x, y); else { const [px, py] = rays[i - 1]; g.quadraticCurveTo(cx + (dx + px) * r * 0.42, (dy + py) * r * 0.42, x, y); }
      }
      g.stroke();
    }
  }, { fonts: false });
  const m = new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, side: THREE.DoubleSide, color: new THREE.Color(0.55, 0.55, 0.6), toneMapped: false });
  m.userData.noShadow = true;
  return m;
}

export function furnish(kit, M, root, plan) {
  M.web = webMaterial();
  const P = makeProps(kit, M, root);
  const rooms = [roomPeachi, roomHall, roomGuest, roomBath, roomKitchen, roomLiving].map((f) => f(P, kit, M, root));

  const lights = [], points = { itemSpots: [], ghostSpawns: [], navPoints: [] };
  let deskPosition = null, spawn = null;
  const screens = {};
  for (const r of rooms) {
    lights.push(...r.lights);
    points.itemSpots.push(...(r.itemSpots || []));
    points.navPoints.push(...(r.navPoints || []));
    points.ghostSpawns.push(...(r.ghostSpawns || []));
    if (r.deskPosition) deskPosition = r.deskPosition;
    if (r.spawn) spawn = r.spawn;
    if (r.screens) Object.assign(screens, r.screens);
  }
  points.deskPosition = deskPosition;
  points.spawn = spawn;
  return { lights, points, screens, update(dt, t, flick) { for (const r of rooms) r.update && r.update(dt, t, flick); } };
}
