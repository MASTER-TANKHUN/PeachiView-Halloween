// Peachi's heart choker, broken into three pieces on Night 3: the heart pendant (seen only in a mirror),
// the strap (inside Phi Pop), the heart padlock (in the Room of Waiting's music box).
import * as THREE from 'three';

const PINK = 0xff7ab0, GOLD = 0xe8b84a, INK = 0x1a1420;

function heartShape(s) {
  const h = new THREE.Shape();
  h.moveTo(0, -s * 0.95);
  h.bezierCurveTo(-s * 0.25, -s * 0.6, -s, -s * 0.28, -s, s * 0.22);
  h.bezierCurveTo(-s, s * 0.78, -s * 0.28, s * 0.95, 0, s * 0.45);
  h.bezierCurveTo(s * 0.28, s * 0.95, s, s * 0.78, s, s * 0.22);
  h.bezierCurveTo(s, -s * 0.28, s * 0.25, -s * 0.6, 0, -s * 0.95);
  return h;
}
const heart = (s, depth) => { const g = new THREE.ExtrudeGeometry(heartShape(s), { depth, bevelEnabled: true, bevelThickness: depth * 0.4, bevelSize: depth * 0.4, bevelSegments: 2, curveSegments: 10 }); g.translate(0, 0, -depth / 2); return g; };
const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: o.rough ?? 0.3, metalness: o.metal ?? 0, emissive: o.emissive ?? 0x000000, emissiveIntensity: o.ei ?? 1 });

export function buildPendant() {
  const g = new THREE.Group(); g.name = 'chokerPendant';
  g.add(new THREE.Mesh(heart(0.035, 0.014), mat(PINK, { emissive: 0xff3a8a, ei: 0.45, rough: 0.2 })));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.009, 0.0025, 6, 16), mat(GOLD, { metal: 0.8 }));
  ring.position.y = 0.038; g.add(ring);
  const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.0012, 0.0012, 0.14, 4), mat(GOLD, { metal: 0.8 }));
  chain.position.y = 0.115; g.add(chain);
  return g;
}

export function buildStrap() {
  const g = new THREE.Group(); g.name = 'chokerStrap';
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.009, 6, 28, Math.PI * 1.6), mat(INK, { rough: 0.45 }));
  band.scale.set(1, 1, 1.8); band.rotation.x = Math.PI / 2; g.add(band);
  for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 1.6; const st = new THREE.Mesh(new THREE.SphereGeometry(0.0045, 6, 5), mat(GOLD, { metal: 0.8 })); st.position.set(Math.cos(a) * 0.055, 0.004, Math.sin(a) * 0.055); g.add(st); }
  return g;
}

export function buildLock() {
  const g = new THREE.Group(); g.name = 'chokerLock';
  g.add(new THREE.Mesh(heart(0.022, 0.012), mat(GOLD, { metal: 0.85, rough: 0.25, emissive: 0x6a4a10, ei: 0.4 })));
  const sh = new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.0028, 6, 16, Math.PI), mat(GOLD, { metal: 0.9 }));
  sh.position.y = 0.018; g.add(sh);
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.004, 10), new THREE.MeshBasicMaterial({ color: 0x1a1008 }));
  hole.position.set(0, -0.002, 0.0125); g.add(hole);
  return g;
}

/** The three pieces laid out together (the stream desk, the finale). */
export function buildChokerSet() {
  const g = new THREE.Group(); g.name = 'chokerSet';
  const strap = buildStrap(); strap.position.set(0, 0.012, 0); g.add(strap);
  const p = buildPendant(); p.children[2].visible = false; p.rotation.x = -Math.PI / 2; p.position.set(0, 0.018, 0.075); g.add(p);
  const l = buildLock(); l.rotation.x = -Math.PI / 2; l.position.set(0, 0.016, -0.075); g.add(l);
  g.userData.parts = { strap, pendant: p, lock: l };
  return g;
}
