// Room-to-room navigation for ghosts that can't go through walls (Krasue, Phi Pop): the house as a graph
// of rooms joined by doorways, each doorway with a point on either side. A route is a list of waypoints
// [{ p, cross, link }] — `cross` marks the step through a doorway (where a door may be in the way).
import * as THREE from 'three';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// doorways between rooms: door id (null = open arch), a point on each side
export const LINKS = [
  { a: 'stream', b: 'hallway', door: 'stream', pa: V(-4, 0, -1.7), pb: V(-4, 0, -0.35) },
  { a: 'bedroom', b: 'hallway', door: 'bedroom', pa: V(1.5, 0, -1.7), pb: V(1.5, 0, -0.35) },
  { a: 'bathroom', b: 'hallway', door: 'bathroom', pa: V(6.8, 0, -1.7), pb: V(6.8, 0, -0.35) },
  { a: 'kitchen', b: 'hallway', door: 'kitchen', pa: V(-3, 0, 1.7), pb: V(-3, 0, 0.35) },
  { a: 'living', b: 'hallway', door: null, pa: V(6.5, 0, 1.7), pb: V(6.5, 0, 0.35) },
  { a: 'kitchen', b: 'living', door: null, pa: V(2.3, 0, 4.5), pb: V(3.7, 0, 4.5) },
];

/** Default: a link is passable when it has no door or the door is open. */
export const openDoors = (level) => (L) => !L.door || level.doorOpen(L.door);

/** Can you see from room a into room b? (same room, or one open doorway between them) */
export function roomsLinked(level, a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  return LINKS.some((L) => ((L.a === a && L.b === b) || (L.a === b && L.b === a)) && (!L.door || level.doorOpen(L.door)));
}

/** The room a point is in, or the closest one (for points in a doorway or outside). */
export function nearestRoom(level, pos) {
  const r0 = level.roomAt(pos);
  if (r0) return r0;
  let best = 'kitchen', bd = Infinity;
  for (const k in level.rooms) {
    const r = level.rooms[k];
    const d = Math.max(r.x0 - pos.x, 0, pos.x - r.x1) + Math.max(r.z0 - pos.z, 0, pos.z - r.z1);
    if (d < bd) { bd = d; best = k; }
  }
  return best;
}

/** Rooms → list of { L, from } hops, or null. pass(link) decides which doorways count; avoid: rooms never entered. */
export function planRooms(from, to, pass, avoid = null) {
  if (!from || !to) return null;
  if (from === to) return [];
  if (avoid && avoid.has(to)) return null;
  const prev = { [from]: null }, q = [from];
  while (q.length) {
    const r = q.shift();
    for (const L of LINKS) {
      if (!pass(L)) continue;
      const next = L.a === r ? L.b : L.b === r ? L.a : null;
      if (!next || next in prev || (avoid && avoid.has(next))) continue;
      prev[next] = { L, from: r };
      if (next === to) {
        const hops = [];
        let cur = to;
        while (prev[cur]) { hops.unshift(prev[cur]); cur = prev[cur].from; }
        return hops;
      }
      q.push(next);
    }
  }
  return null;
}

const sides = (h) => (h.L.a === h.from ? [h.L.pa, h.L.pb] : [h.L.pb, h.L.pa]);

/** Walking length from pos through the hops to dest. */
export function pathLength(pos, hops, dest) {
  let len = 0, x = pos.x, z = pos.z;
  for (const h of hops) { const [a, b] = sides(h); len += Math.hypot(a.x - x, a.z - z) + a.distanceTo(b); x = b.x; z = b.z; }
  return len + Math.hypot(dest.x - x, dest.z - z);
}

/** Waypoints from pos to dest, or null when there's no way through. */
export function buildRoute(level, pos, dest, destRoom, pass, avoid = null) {
  const hops = planRooms(nearestRoom(level, pos), destRoom || nearestRoom(level, dest), pass, avoid);
  if (!hops) return null;
  const r = [];
  for (const h of hops) { const [a, b] = sides(h); r.push({ p: a.clone(), cross: false, link: h.L }, { p: b.clone(), cross: true, link: h.L }); }
  r.push({ p: V(dest.x, 0, dest.z), cross: false });
  return r;
}
