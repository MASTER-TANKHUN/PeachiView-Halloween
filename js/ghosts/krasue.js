// Krasue (กระสือ) — Night 2's guest star: a floating head with long black hair and glowing entrails that
// swing on spring chains. She is drawn to light: the flashlight (12 m, seen through open doors), rooms
// with their lights on, the golden peach. She flies at 2.2 m/s but can't pass a closed door (she paths
// room to room through doorways). Raise the camera and she stops to pose; give her the Wi-Fi password and
// she leaves to watch series for a minute. If she reaches you: a lick — slime on the screen, the
// flashlight dies, viewers drop — and she flies off giggling. She never kills.
import * as THREE from 'three';
import { sfx } from '../audio.js';
import { panFor } from '../systems/doors.js';
import { roomsLinked, nearestRoom, planRooms, pathLength, buildRoute } from './nav.js';
import { DIFF } from '../game/difficulty.js';

const TAU = Math.PI * 2;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];

const HEAD_Y = 1.62;
const SPEED = 2.2, WANDER = 0.9;
const SIGHT = 12;
const LICK_RANGE = 0.85;
// the kitchen window she uses (south wall, x -6.9)
export const WINDOW_IN = V(-6.9, 1.7, 6.1), WINDOW_OUT = V(-6.9, 1.9, 10.5);

export { roomsLinked };

// ---------------------------------------------------------------- textures
function faceTexture(expr) {
  const W = 512, H = 256, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const skin = g.createLinearGradient(0, 0, 0, H);
  skin.addColorStop(0, '#cfd0c6'); skin.addColorStop(0.55, '#d8d6cc'); skin.addColorStop(1, '#a6b4a2');
  g.fillStyle = skin; g.fillRect(0, 0, W, H);
  const cx = 128, ey = 116; // the face sits at u = 0.25 (+z on a three.js sphere)
  // blush + under-eye shadows
  for (const s of [-1, 1]) {
    const b = g.createRadialGradient(cx + s * 34, 146, 2, cx + s * 34, 146, 20);
    b.addColorStop(0, 'rgba(255,110,150,0.18)'); b.addColorStop(1, 'rgba(255,110,150,0)');
    g.fillStyle = b; g.fillRect(cx + s * 34 - 22, 124, 44, 44);
    const sh = g.createRadialGradient(cx + s * 22, ey + 2, 4, cx + s * 22, ey + 2, 24); // sunken, sleepless eyes
    sh.addColorStop(0, 'rgba(60,20,50,0.5)'); sh.addColorStop(1, 'rgba(60,20,50,0)');
    g.fillStyle = sh; g.fillRect(cx + s * 22 - 26, ey - 24, 52, 52);
    g.strokeStyle = 'rgba(90,60,120,0.35)'; g.lineWidth = 1; // veins at the temples
    for (let k = 0; k < 3; k++) { g.beginPath(); let x = cx + s * (40 + k * 4), y = ey - 30 + k * 10; g.moveTo(x, y); for (let j = 0; j < 5; j++) { x += s * (3 + Math.random() * 3); y += (Math.random() - 0.3) * 7; g.lineTo(x, y); } g.stroke(); }
  }
  const eye = (x, closed, half) => {
    g.save();
    if (closed) { // wink ^
      g.strokeStyle = '#140a10'; g.lineWidth = 3.5; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x - 13, ey + 2); g.quadraticCurveTo(x, ey - 9, x + 13, ey + 2); g.stroke();
      for (const k of [-1, 0, 1]) { g.beginPath(); g.moveTo(x + k * 7, ey - 4); g.lineTo(x + k * 9, ey - 10); g.stroke(); }
      g.restore(); return;
    }
    g.beginPath(); g.ellipse(x, ey, 14, half ? 5 : 9, 0, 0, TAU); g.fillStyle = '#e6d6cc'; g.fill();
    g.clip();
    const ir = g.createRadialGradient(x, ey, 1, x, ey, 9);
    ir.addColorStop(0, '#0a0204'); ir.addColorStop(0.45, '#4a0812'); ir.addColorStop(1, '#a01828');
    g.fillStyle = ir; g.beginPath(); g.arc(x + 1, ey + (half ? 2 : 0), 8.5, 0, TAU); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(x - 3, ey - 3, 2.4, 0, TAU); g.fill();
    g.restore();
    g.strokeStyle = '#140a10'; g.lineWidth = 3; g.lineCap = 'round';
    g.beginPath(); g.ellipse(x, ey, 14, half ? 5 : 9, 0, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
    g.beginPath(); g.moveTo(x + 13, ey - 3); g.lineTo(x + 20, ey - 8); g.stroke(); // winged liner
    g.lineWidth = 1.6; for (const k of [-8, -3, 2, 7]) { g.beginPath(); g.moveTo(x + k, ey - (half ? 5 : 8.5)); g.lineTo(x + k + 2, ey - (half ? 9 : 13)); g.stroke(); }
    g.strokeStyle = 'rgba(200,40,60,0.7)'; g.lineWidth = 1.5; // red lower lid
    g.beginPath(); g.ellipse(x, ey + 1, 13, half ? 5 : 8.5, 0, Math.PI * 0.1, Math.PI * 0.9); g.stroke();
  };
  const annoyed = expr === 'annoyed';
  eye(cx - 22, expr === 'pose', annoyed);
  eye(cx + 22, false, annoyed);
  // brows
  g.strokeStyle = '#1a0e12'; g.lineWidth = 2.5; g.lineCap = 'round';
  for (const s of [-1, 1]) {
    g.beginPath();
    if (annoyed) { g.moveTo(cx + s * 34, ey - 18); g.lineTo(cx + s * 12, ey - 13); } else { g.moveTo(cx + s * 34, ey - 15); g.quadraticCurveTo(cx + s * 22, ey - 23, cx + s * 11, ey - 17); }
    g.stroke();
  }
  // nose
  g.strokeStyle = 'rgba(120,80,80,0.55)'; g.lineWidth = 1.6;
  g.beginPath(); g.moveTo(cx - 3, 142); g.quadraticCurveTo(cx, 145, cx + 3, 142); g.stroke();
  // mouth
  const my = 162;
  g.fillStyle = '#c0142c'; g.strokeStyle = '#5a0612'; g.lineWidth = 1.5;
  if (expr === 'lick') {
    g.fillStyle = '#2a040c'; g.beginPath(); g.ellipse(cx, my + 2, 11, 9, 0, 0, TAU); g.fill();
    g.strokeStyle = '#c0142c'; g.lineWidth = 3; g.stroke();
  } else if (expr === 'pose') { // duck lips
    g.beginPath(); g.ellipse(cx, my, 7, 5.5, 0, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.ellipse(cx - 2, my - 2, 2.5, 1.2, 0, 0, TAU); g.fill();
    g.fillStyle = '#ffe890'; // sparkle by the cheek
    const star = (x, y, r) => { g.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr = i % 2 ? r * 0.35 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.fill(); };
    star(cx + 50, ey - 20, 9); star(cx + 60, ey + 2, 5);
  } else if (annoyed) {
    g.beginPath(); g.moveTo(cx - 10, my); g.lineTo(cx + 10, my + 1); g.lineWidth = 4; g.strokeStyle = '#c0142c'; g.stroke();
  } else { // smug smirk + a drop of blood at the corner
    g.beginPath(); g.moveTo(cx - 12, my - 1); g.quadraticCurveTo(cx, my + 7, cx + 13, my - 4); g.quadraticCurveTo(cx, my + 1, cx - 12, my - 1); g.fill(); g.stroke();
    g.strokeStyle = '#8a0010'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx + 11, my - 2); g.quadraticCurveTo(cx + 13, my + 12, cx + 12, my + 22); g.stroke();
    g.fillStyle = '#8a0010'; g.beginPath(); g.arc(cx + 12, my + 23, 2.4, 0, TAU); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function gradientMap() {
  const d = new Uint8Array([70, 70, 70, 255, 150, 150, 150, 255, 255, 255, 255, 255]);
  const t = new THREE.DataTexture(d, 3, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true;
  return t;
}

// ---------------------------------------------------------------- verlet chains (hair, entrails)
class Chain {
  constructor(n, seg, start) {
    this.n = n; this.seg = seg;
    this.p = Array.from({ length: n }, (_, i) => start.clone().add(V(0, -i * seg, 0)));
    this.o = this.p.map((v) => v.clone());
    this.end = null; // optional pinned last node (a loop)
  }
  step(dt, anchor, { grav = 3.5, damp = 0.94, iters = 4, avoid = null, avoidR = 0 } = {}) {
    const { p, o, n, seg } = this;
    p[0].copy(anchor); o[0].copy(anchor);
    const g = grav * dt * dt;
    for (let i = 1; i < n; i++) {
      const x = p[i], ox = o[i];
      const vx = (x.x - ox.x) * damp, vy = (x.y - ox.y) * damp, vz = (x.z - ox.z) * damp;
      ox.copy(x);
      x.x += vx; x.y += vy - g; x.z += vz;
    }
    for (let k = 0; k < iters; k++) {
      for (let i = 1; i < n; i++) {
        const a = p[i - 1], b = p[i];
        const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
        const f = (d - seg) / d;
        if (i === 1) { b.x -= dx * f; b.y -= dy * f; b.z -= dz * f; } else { const h = f * 0.5; a.x += dx * h; a.y += dy * h; a.z += dz * h; b.x -= dx * h; b.y -= dy * h; b.z -= dz * h; }
      }
      p[0].copy(anchor);
      if (this.end) p[n - 1].copy(this.end);
      if (avoid) for (let i = 1; i < n; i++) { // hair drapes around the head, not through it
        const x = p[i], dx = x.x - avoid.x, dy = x.y - avoid.y, dz = x.z - avoid.z, d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d < avoidR && d > 1e-5) { const s = avoidR / d; x.set(avoid.x + dx * s, avoid.y + dy * s, avoid.z + dz * s); }
      }
    }
  }
  /** Point at fraction u (0..n-1) along the chain. */
  at(u, out) {
    const i = Math.min(this.n - 2, Math.max(0, Math.floor(u)));
    return out.lerpVectors(this.p[i], this.p[i + 1], Math.min(1, u - i));
  }
  teleport(delta) { for (const v of this.p) v.add(delta); for (const v of this.o) v.add(delta); }
}

// ---------------------------------------------------------------- shapes
const bump = (n, x, y, z, s) => Math.exp(-((n.x - x) ** 2 + (n.y - y) ** 2 + (n.z - z) ** 2) / (s * s));
/** Push a sphere's surface around: f(n) → radius multiplier for the unit direction n. */
function sculpt(geo, f) {
  const p = geo.attributes.position, n = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { n.fromBufferAttribute(p, i); const r = n.length(); n.divideScalar(r || 1); const k = f(n); p.setXYZ(i, n.x * r * k, n.y * r * k, n.z * r * k); }
  geo.computeVertexNormals();
  return geo;
}
// wet flesh with glowing green veins running along it (u runs along a tube)
function gutTexture() {
  const W = 256, H = 64, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const base = g.createLinearGradient(0, 0, 0, H);
  base.addColorStop(0, '#8a2a48'); base.addColorStop(0.5, '#d0607e'); base.addColorStop(1, '#8a2a48');
  g.fillStyle = base; g.fillRect(0, 0, W, H);
  for (let x = 0; x < W; x += 16) { const f = g.createLinearGradient(x, 0, x + 16, 0); f.addColorStop(0, 'rgba(60,8,24,0.55)'); f.addColorStop(0.25, 'rgba(60,8,24,0)'); f.addColorStop(1, 'rgba(255,200,220,0.12)'); g.fillStyle = f; g.fillRect(x, 0, 16, H); } // folds
  g.lineCap = 'round';
  for (let k = 0; k < 5; k++) { // veins
    let y = 6 + k * 12 + Math.random() * 6;
    g.strokeStyle = k % 2 ? 'rgba(120,255,180,0.9)' : 'rgba(90,230,160,0.7)'; g.lineWidth = 1.5 + Math.random() * 1.5;
    g.beginPath(); g.moveTo(0, y);
    for (let x = 8; x <= W; x += 8) { y += (Math.random() - 0.5) * 5; y = Math.max(2, Math.min(H - 2, y)); g.lineTo(x, y); }
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
/** Several tubes in one mesh, re-skinned every frame along chain points (entrails). */
class Tubes {
  constructor(rings, radial, mat) {
    this.rings = rings; this.radial = radial;
    const total = rings.reduce((a, b) => a + b, 0), nv = total * (radial + 1);
    this.pos = new Float32Array(nv * 3); this.nor = new Float32Array(nv * 3);
    const uv = new Float32Array(nv * 2), idx = [];
    let base = 0;
    this.start = [];
    for (const n of rings) {
      this.start.push(base);
      for (let i = 0; i < n; i++) for (let j = 0; j <= radial; j++) { const o = base + i * (radial + 1) + j; uv[o * 2] = i * 0.18; uv[o * 2 + 1] = j / radial; }
      for (let i = 0; i < n - 1; i++) for (let j = 0; j < radial; j++) { const a = base + i * (radial + 1) + j, b = a + radial + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
      base += n * (radial + 1);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(this.nor, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(idx);
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this._t = new THREE.Vector3(); this._n = new THREE.Vector3(1, 0, 0); this._b = new THREE.Vector3(); this._a = new THREE.Vector3(); this._c = new THREE.Vector3();
  }
  /** Tube k through pts (Vector3[] of length rings[k]), radius(i) per ring. */
  set(k, pts, radius) {
    const n = this.rings[k], R = this.radial, T = this._t, N = this._n, B = this._b;
    for (let i = 0; i < n; i++) {
      T.subVectors(pts[Math.min(n - 1, i + 1)], pts[Math.max(0, i - 1)]).normalize();
      if (i === 0) { N.set(T.y, -T.x, 0); if (N.lengthSq() < 1e-4) N.set(0, T.z, -T.y); N.normalize(); }
      N.addScaledVector(T, -N.dot(T)).normalize(); // parallel transport: no twisting
      B.crossVectors(T, N);
      const r = radius(i), p = pts[i];
      for (let j = 0; j <= R; j++) {
        const a = (j / R) * TAU, ca = Math.cos(a), sa = Math.sin(a), o = (this.start[k] + i * (R + 1) + j) * 3;
        const nx = N.x * ca + B.x * sa, ny = N.y * ca + B.y * sa, nz = N.z * ca + B.z * sa;
        this.pos[o] = p.x + nx * r; this.pos[o + 1] = p.y + ny * r; this.pos[o + 2] = p.z + nz * r;
        this.nor[o] = nx; this.nor[o + 1] = ny; this.nor[o + 2] = nz;
      }
    }
  }
  done() { const g = this.mesh.geometry; g.attributes.position.needsUpdate = true; g.attributes.normal.needsUpdate = true; }
}
/** Smooth point at u (0..n-1) along chain nodes (Catmull-Rom). */
function smoothAt(p, u, out) {
  const n = p.length, i = Math.min(n - 2, Math.max(0, Math.floor(u))), t = Math.min(1, u - i);
  const p0 = p[Math.max(0, i - 1)], p1 = p[i], p2 = p[i + 1], p3 = p[Math.min(n - 1, i + 2)];
  const t2 = t * t, t3 = t2 * t;
  const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
  return out.set(f(p0.x, p1.x, p2.x, p3.x), f(p0.y, p1.y, p2.y, p3.y), f(p0.z, p1.z, p2.z, p3.z));
}
const SUB = 3; // tube rings per chain link

// ---------------------------------------------------------------- the model
function buildModel() {
  const group = new THREE.Group();
  group.name = 'krasue';
  const head = new THREE.Group();
  group.add(head);
  const grad = gradientMap();
  const faces = { smile: faceTexture('smile'), pose: faceTexture('pose'), lick: faceTexture('lick'), annoyed: faceTexture('annoyed') };
  const skinMat = new THREE.MeshStandardMaterial({ map: faces.smile, roughness: 0.6, emissive: 0xffffff, emissiveMap: faces.smile, emissiveIntensity: 0.16 });
  const R = 0.11;
  // a face, not a ball: narrow jaw, a small chin, cheekbones, a nose and lips under the painted face
  const skullGeo = sculpt(new THREE.SphereGeometry(R, 48, 36), (n) => {
    let k = 1;
    k -= Math.max(0, -n.y - 0.15) * Math.abs(n.x) * 0.32;                 // narrow jaw
    k += bump(n, 0, -0.78, 0.6, 0.28) * 0.035;                             // chin
    k += (bump(n, 0.5, -0.05, 0.86, 0.2) + bump(n, -0.5, -0.05, 0.86, 0.2)) * 0.03; // cheekbones
    k -= (bump(n, 0.27, 0.15, 0.95, 0.12) + bump(n, -0.27, 0.15, 0.95, 0.12)) * 0.025; // eye sockets
    k += bump(n, 0, -0.14, 0.99, 0.09) * 0.07;                             // nose
    k += bump(n, 0, -0.4, 0.92, 0.1) * 0.025;                              // lips
    k += bump(n, 0, 0.2, -1, 0.7) * 0.05;                                  // the back of the skull
    return k;
  });
  const skull = new THREE.Mesh(skullGeo, skinMat);
  skull.scale.set(1, 1.12, 1.04);
  head.add(skull);
  const ink = new THREE.MeshBasicMaterial({ color: 0x050306, side: THREE.BackSide });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x0e0a12, roughness: 0.45, side: THREE.DoubleSide, emissive: 0x06030a }); // wet black
  // hair cap: the crown all around + the back of the head, leaving the face open, middle part
  const cap = new THREE.Mesh(new THREE.SphereGeometry(R * 1.06, 32, 20, 0, TAU, 0, Math.PI * 0.36), hairMat);
  const back = new THREE.Mesh(new THREE.SphereGeometry(R * 1.07, 32, 20, Math.PI * 0.92, Math.PI * 1.16, 0, Math.PI * 0.78), hairMat);
  for (const m of [cap, back]) { m.scale.copy(skull.scale); head.add(m); }
  for (const s of [-1, 1]) { // side curtains framing the face
    const side = new THREE.Mesh(new THREE.SphereGeometry(R * 1.08, 16, 16, Math.PI * (s > 0 ? 0.08 : 0.72), Math.PI * 0.2, Math.PI * 0.2, Math.PI * 0.62), hairMat);
    side.scale.copy(skull.scale);
    head.add(side);
  }
  const hull = new THREE.Mesh(skull.geometry, ink); hull.scale.copy(skull.scale).multiplyScalar(1.07); head.add(hull);
  // neck stump: torn, with strips of skin hanging off it
  const flesh = new THREE.MeshStandardMaterial({ color: 0x7a1424, roughness: 0.3, emissive: 0x3a0610, emissiveIntensity: 1 });
  const stumpGeo = new THREE.CylinderGeometry(0.036, 0.03, 0.06, 18, 2, true);
  { const p = stumpGeo.attributes.position; for (let i = 0; i < p.count; i++) if (p.getY(i) < -0.02) p.setY(i, p.getY(i) - Math.abs(Math.sin(i * 2.7)) * 0.025); stumpGeo.computeVertexNormals(); }
  const stump = new THREE.Mesh(stumpGeo, flesh);
  stump.position.y = -R * 1.18 + 0.005;
  head.add(stump);
  const neckSkin = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.037, 0.035, 18, 1, true), skinMat);
  neckSkin.position.y = -R * 1.18 + 0.012; head.add(neckSkin);
  for (let i = 0; i < 4; i++) {
    const a = i * 1.7 + 0.4, strip = new THREE.Mesh(new THREE.CapsuleGeometry(0.006, 0.03 + (i % 2) * 0.02, 2, 6), flesh);
    strip.position.set(Math.sin(a) * 0.03, -R * 1.18 - 0.04, Math.cos(a) * 0.03); strip.scale.set(1.6, 1, 0.5); strip.rotation.set(Math.cos(a) * 0.3, a, -Math.sin(a) * 0.3);
    head.add(strip);
  }
  // tongue (hidden until she licks)
  const tongue = new THREE.Mesh(new THREE.CapsuleGeometry(0.016, 0.16, 4, 10), new THREE.MeshToonMaterial({ color: 0xff5a88, gradientMap: grad, emissive: 0xff2a60, emissiveIntensity: 0.4 }));
  tongue.rotation.x = Math.PI / 2;
  const tongueG = new THREE.Group(); tongueG.position.set(0, -0.055, R * 0.95); tongueG.add(tongue); tongue.position.z = 0.09;
  tongueG.scale.set(1, 1, 0.01); tongueG.visible = false;
  head.add(tongueG);

  // long hair: ribbons that hang on verlet chains
  const STRANDS = 40, HN = 7;
  const roots = [];
  for (let i = 0; i < STRANDS; i++) {
    const a = -1.95 + (i / (STRANDS - 1)) * 3.9; // around the back, from temple to temple
    const y = 0.05 - Math.abs(a) * 0.02;
    roots.push({ local: V(Math.sin(a) * R * 1.02, y, -Math.cos(a) * R * 1.02), w0: 0.05, len: rand(0.05, 0.1), flare: rand(0.004, 0.01) });
  }
  const hairGeo = new THREE.BufferGeometry();
  const hv = new Float32Array(STRANDS * HN * 2 * 3);
  hairGeo.setAttribute('position', new THREE.BufferAttribute(hv, 3));
  const idx = [];
  for (let s = 0; s < STRANDS; s++) for (let k = 0; k < HN - 1; k++) { const a = (s * HN + k) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  hairGeo.setIndex(idx);
  const hair = new THREE.Mesh(hairGeo, hairMat);
  hair.frustumCulled = false;
  group.add(hair);

  // entrails: a gullet, a loop of gut and two torn ends, one wet glowing mesh; organs hung on them
  const gutTex = gutTexture();
  const gutMat = new THREE.MeshStandardMaterial({ map: gutTex, emissiveMap: gutTex, emissive: 0xffffff, emissiveIntensity: 0.42, roughness: 0.22, metalness: 0 });
  const guts = new Tubes([7 * SUB + 1, 14 * SUB + 1, 9 * SUB + 1, 7 * SUB + 1], 8, gutMat);
  group.add(guts.mesh);
  const organ = (geo, color, glow) => { const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, emissive: glow, emissiveIntensity: 1, roughness: 0.3 })); group.add(m); return m; };
  // heart: two lobes, a point, a stub of artery
  const heart = organ(sculpt(new THREE.SphereGeometry(0.034, 18, 14), (n) => 1 + (bump(n, 0.55, 0.6, 0.2, 0.45) + bump(n, -0.55, 0.6, 0.2, 0.45)) * 0.12 - bump(n, 0, 1, 0, 0.35) * 0.18 + bump(n, 0, -1, 0, 0.5) * 0.25), 0xa01830, 0x6a0820);
  const aorta = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.007, 6, 12, Math.PI * 1.2), heart.material); aorta.position.set(0.005, 0.03, 0); aorta.rotation.set(0, Math.PI / 2, 0.3); heart.add(aorta);
  const lungGeo = sculpt(new THREE.SphereGeometry(0.045, 18, 14), (n) => 1 + Math.sin(n.x * 9) * Math.sin(n.y * 7) * Math.sin(n.z * 8) * 0.06 - bump(n, 0, -1, 0, 0.5) * 0.15);
  const lungs = [-1, 1].map(() => organ(lungGeo, 0x8a3a52, 0x2a0c18));
  for (const l of lungs) l.scale.set(0.58, 1.0, 0.5);
  const stomach = organ(sculpt(new THREE.SphereGeometry(0.04, 16, 12), (n) => 1 - bump(n, -0.7, 0.5, 0, 0.45) * 0.3), 0xb86a6a, 0x2a6a40);
  stomach.scale.set(1.3, 0.9, 0.9);
  const light = new THREE.PointLight(0x8affc0, 0, 6, 2); // added to the scene itself (always visible: no shader recompiles)
  group.traverse((o) => { o.castShadow = false; o.receiveShadow = false; });
  return { group, head, skinMat, faces, tongueG, hair, hv, hairGeo, roots, STRANDS, HN, guts, heart, lungs, stomach, light, R };
}

const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _s = new THREE.Vector3(), _e = new THREE.Euler();
const _side = new THREE.Vector3(), _dir = new THREE.Vector3(), _out = new THREE.Vector3(), _ndc = new THREE.Vector3(), _a = new THREE.Vector3();

export class Krasue {
  constructor(scene, level) {
    this.level = level;
    this.M = buildModel();
    this.group = this.M.group;
    this.position = V(0, HEAD_Y, 0); // head, world
    scene.add(this.group);
    scene.add(this.M.light);
    // callbacks for the night
    this.onLick = () => {};
    this.onSpot = () => {};
    this.onPose = () => {};
    this.onEntered = () => {};
    this.onGone = () => {};
    // nav points per room
    this.roomPoints = {};
    for (const k in level.rooms) {
      const r = level.rooms[k];
      const pts = (level.navPoints || []).filter((p) => level.roomAt(p) === k);
      this.roomPoints[k] = pts.length ? pts : [V((r.x0 + r.x1) / 2, 0, (r.z0 + r.z1) / 2)];
    }
    this._chains();
    this.reset();
  }

  _chains() {
    const p = this.position;
    this.hairChains = this.M.roots.map((r) => new Chain(this.M.HN, r.len, p.clone().add(r.local)));
    this.spine = new Chain(8, 0.06, p);
    this.loop = new Chain(15, 0.05, p);
    this.dangle = [new Chain(10, 0.05, p), new Chain(8, 0.05, p)];
  }

  reset() {
    this.state = 'off'; // off | enter | wander | hunt | search | pose | lick | retreat | leave | away
    this.group.visible = false;
    this.M.light.intensity = 0;
    this.position.set(WINDOW_OUT.x, WINDOW_OUT.y, WINDOW_OUT.z);
    this.route = [];
    this.target = null;       // { pos, kind, strength }
    this.targetKind = null;
    this.thinkT = 0;
    this.poseCool = 0;
    this.lickCool = 0;
    this.spotCool = 0;
    this.stateT = 0;
    this.stuckT = 0;
    this.dripT = 1;
    this.wanderRoom = null;
    this.wanderT = 0;
    this.lastSeen = null;
    this.yaw = 0; this.tilt = 0;
    this.awayT = 0;
    this.strong = false;
    this.frenzy = false;
    this.avoid = null; // Set of rooms she won't enter (Night 3's safe room)
    this.expr = null;
    this._setExpr('smile');
    this._snapChains();
  }

  get active() { return this.state !== 'off' && this.state !== 'away'; }
  get visible() { return this.group.visible; }
  get room() { return this.level.roomAt(this.position); }

  /** Fly in from the garden through the kitchen window. */
  enter(kind = 'first') {
    this.enterKind = kind;
    this.state = 'enter';
    this.stateT = 0;
    this.group.visible = true;
    this.position.copy(WINDOW_OUT);
    this._snapChains();
    this.route = [{ p: WINDOW_IN.clone(), cross: true }];
  }

  /** Leave through the kitchen window for `sec` seconds (the Wi-Fi joke). */
  leave(sec = 60) {
    if (!this.active) return false;
    this.awayT = sec;
    this.state = 'leave';
    this.stateT = 0;
    this._routeTo(V(WINDOW_IN.x, 0, WINDOW_IN.z), 'kitchen');
    this.route.push({ p: WINDOW_OUT.clone(), cross: true });
    return true;
  }

  /** Put her somewhere for a scene. */
  place(pos, look) {
    this.group.visible = true;
    this.position.copy(pos);
    if (look) this.yaw = Math.atan2(look.x - pos.x, look.z - pos.z);
    this._snapChains();
    this._pose(0, 0);
  }

  freeze() { this.state = 'off'; }

  // ---------------------------------------------------------------- update
  /**
   * ctx: { player, camera, lures: [{ pos, strength, range, kind }], cameraUp, playerHidden, t }
   */
  update(dt, t, ctx = {}) {
    if (this.state === 'off') { if (this.group.visible) this._pose(dt, t); return; }
    const { player } = ctx;
    this.stateT += dt;
    this.poseCool -= dt; this.lickCool -= dt; this.spotCool -= dt;

    if (this.state === 'away') {
      this.awayT -= dt;
      if (this.awayT <= 0) this.enter('back');
      return;
    }

    // --- decide what she wants
    this.thinkT -= dt;
    const free = this.state === 'wander' || this.state === 'hunt' || this.state === 'search';
    if (free && this.thinkT <= 0) { this.thinkT = 0.35; this._think(ctx); }

    // --- the camera: she can't resist posing
    if (free && ctx.cameraUp && this.poseCool <= 0 && this._inShot(ctx.camera, player)) {
      this.state = 'pose'; this.stateT = 0; this.route = [];
      this._setExpr('pose');
      sfx.play('sparkle', this._pan(player));
      this.onPose();
    }
    if (this.state === 'pose') {
      if (this.stateT > 3) { this.state = 'wander'; this.poseCool = 10; this._setExpr('smile'); this.thinkT = 0; }
    }

    // --- licking
    if (this.state === 'lick') {
      const k = this.stateT;
      this.M.tongueG.visible = true;
      this.M.tongueG.scale.z = Math.min(1, k * 4) * (1 - Math.max(0, k - 1.1) * 3);
      this.M.tongueG.rotation.y = Math.sin(k * 18) * 0.3;
      if (player && k < 1.2) { // stay right in front of the face
        const f = V(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
        _v.set(player.position.x + f.x * 0.42, 1.52, player.position.z + f.z * 0.42);
        this.position.lerp(_v, Math.min(1, dt * 10));
        this.yaw = Math.atan2(player.position.x - this.position.x, player.position.z - this.position.z);
      }
      if (k > 1.4) {
        this.M.tongueG.visible = false;
        this._setExpr('smile');
        this.state = 'retreat'; this.stateT = 0;
        const far = this._farRoom(player);
        this._routeTo(pick(this.roomPoints[far]), far);
        sfx.play('cackle', this._pan(player));
      }
    }
    if (this.state === 'retreat' && (this.stateT > 7 || !this.route.length)) { this.state = 'wander'; this.thinkT = 0; }

    // --- move along the route
    const moving = ['enter', 'leave', 'wander', 'hunt', 'search', 'retreat'].includes(this.state);
    if (moving) this._move(dt);

    if (this.state === 'enter' && !this.route.length) { this.state = 'wander'; this.thinkT = 0; this.onEntered(this.enterKind); }
    if (this.state === 'leave' && !this.route.length) { this.state = 'away'; this.group.visible = false; this.M.light.intensity = 0; this.onGone(); return; }
    if (this.state === 'search' && !this.route.length && this.stateT > 2.5) { this.state = 'wander'; this.thinkT = 0; }

    // --- reach the player → lick
    if ((this.state === 'hunt') && this.targetKind === 'player' && player && this.lickCool <= 0 && !ctx.playerHidden) {
      const d = Math.hypot(player.position.x - this.position.x, player.position.z - this.position.z);
      if (d < LICK_RANGE) {
        this.state = 'lick'; this.stateT = 0; this.route = [];
        this.lickCool = 22;
        this._setExpr('lick');
        sfx.play('lick');
        this.onLick();
      }
    }

    // --- facing: toward where she flies, or at the player when close / posing
    let want = null;
    if (player) {
      const dx = player.position.x - this.position.x, dz = player.position.z - this.position.z;
      if (this.state === 'pose' || Math.hypot(dx, dz) < 5) want = Math.atan2(dx, dz);
    }
    if (want === null && this._vel && this._vel.lengthSq() > 1e-4) want = Math.atan2(this._vel.x, this._vel.z);
    if (want !== null) {
      let d = want - this.yaw; d = ((d + Math.PI) % TAU + TAU) % TAU - Math.PI;
      this.yaw += d * Math.min(1, dt * 5);
    }

    // --- drips, heard around the house
    this.dripT -= dt;
    if (this.dripT <= 0 && player) {
      this.dripT = rand(1.2, 2.6);
      const p = panFor(player, this.position.x, this.position.z);
      if (p.dist < 11) sfx.play('drip', { pan: p.pan, vol: p.vol * 0.9 });
    }
    this._pose(dt, t);
  }

  _pan(player) { if (!player) return {}; const p = panFor(player, this.position.x, this.position.z); return { pan: p.pan, vol: p.vol }; }

  _speed() {
    let s = this.state === 'wander' ? WANDER : this.state === 'enter' ? 1.3 : this.state === 'leave' || this.state === 'retreat' ? 2.6 : SPEED;
    if (this.state === 'hunt' || this.state === 'search') { if (this.strong) s *= 1.2; if (this.frenzy) s *= 1.3; }
    return s * DIFF.speed;
  }
  get sight() { return SIGHT + (this.strong ? 3 : 0) + (this.frenzy ? 4 : 0); }

  _think(ctx) {
    const { player, lures = [], playerHidden } = ctx;
    const my = this.room || this._nearestRoom();
    let best = null;
    const consider = (pos, kind, strength, range) => {
      const room = this.level.roomAt(pos);
      if (!room) return;
      const path = this._plan(my, room);
      if (!path) return;
      const len = this._pathLen(path, pos);
      if (len > range) return;
      if (!best || strength > best.strength || (strength === best.strength && len < best.len)) best = { pos, kind, strength, len, room };
    };
    if (player && !playerHidden) {
      if (player.flashlight && player.flashlight.on) consider(player.position, 'player', 3, this.sight);
      else if (player.running && Math.hypot(player.position.x - this.position.x, player.position.z - this.position.z) < 3.5) consider(player.position, 'player', 2, 4);
    }
    for (const L of lures) consider(L.pos, L.kind === 'player' && playerHidden ? 'spot' : (L.kind || 'lure'), L.strength ?? 2, L.range ?? 20);
    for (const k in this.level.rooms) if (this.level.roomLit(k)) consider(this.roomPoints[k][0], 'room', 1, 30);

    const was = this.targetKind, wasRoom = this.target && this.target.room;
    if (best) {
      this.targetKind = best.kind;
      this.target = best;
      if (best.kind === 'player' || best.kind === 'lure' || best.kind === 'bang' || best.kind === 'peach') {
        if (this.state !== 'hunt') { this.state = 'hunt'; this.stateT = 0; sfx.play('whoosh', this._pan(player)); }
        if (best.kind === 'player') {
          this.lastSeen = best.pos.clone();
          if (was !== 'player' && this.spotCool <= 0) { this.spotCool = 14; sfx.play('cackle', this._pan(player)); this.onSpot(); }
        }
      } else if (this.state === 'hunt') { this.state = 'wander'; }
      if (best.kind === 'room') { // drift around a lit room like a moth
        if (!(was === 'room' && wasRoom === best.room && this.route.length)) this._routeTo(this._wanderPoint(best.room), best.room);
      } else this._routeTo(best.pos, best.room);
    } else {
      this.targetKind = null;
      if (was === 'player' && this.lastSeen) { // lost the light: check where it was
        this.state = 'search'; this.stateT = 0;
        this._routeTo(this.lastSeen, this.level.roomAt(this.lastSeen));
        this.lastSeen = null;
      } else if (this.state !== 'search') {
        this.state = 'wander';
        this.wanderT -= 0.35;
        if (!this.wanderRoom || this.wanderT <= 0 || !this.route.length) {
          this.wanderT = rand(9, 16);
          const rooms = Object.keys(this.level.rooms).filter((k) => this._plan(my, k));
          this.wanderRoom = pick(rooms.length ? rooms : [my]);
          this._routeTo(this._wanderPoint(this.wanderRoom), this.wanderRoom);
        }
      }
    }
  }

  _wanderPoint(room) {
    const r = this.level.rooms[room];
    const base = pick(this.roomPoints[room]);
    return V(Math.min(r.x1 - 0.6, Math.max(r.x0 + 0.6, base.x + rand(-1.2, 1.2))), 0, Math.min(r.z1 - 0.6, Math.max(r.z0 + 0.6, base.z + rand(-1, 1))));
  }

  _nearestRoom() { return nearestRoom(this.level, this.position); }

  _farRoom(player) {
    let best = null, bd = -1;
    const my = this.room || this._nearestRoom();
    for (const k in this.level.rooms) {
      if (!this._plan(my, k)) continue;
      const p = this.roomPoints[k][0];
      const d = player ? Math.hypot(p.x - player.position.x, p.z - player.position.z) : Math.random();
      if (d > bd) { bd = d; best = k; }
    }
    return best || my;
  }

  _open(link) { return !link.door || this.level.doorOpen(link.door); }
  _pass() { return this._passFn || (this._passFn = (L) => this._open(L)); }

  /** Rooms → hops through open doorways (never into `avoid` rooms), or null. */
  _plan(from, to) { return planRooms(from, to, this._pass(), this.avoid); }
  _pathLen(hops, dest) { return pathLength(this.position, hops, dest); }
  _routeTo(dest, destRoom) {
    const r = buildRoute(this.level, this.position, dest, destRoom || this.level.roomAt(dest), this._pass(), this.avoid);
    this.route = r || [];
    return !!r;
  }

  _move(dt) {
    const pos = this.position;
    this._vel ||= V();
    this._vel.set(0, 0, 0);
    let budget = this._speed() * dt;
    while (budget > 0 && this.route.length) {
      const w = this.route[0];
      // a door shut in front of her: she can't go through, try again later
      if (w.cross && w.link && !this._open(w.link)) { this.route = []; this.thinkT = 0; this.stuckT += dt; break; }
      const dx = w.p.x - pos.x, dz = w.p.z - pos.z, d = Math.hypot(dx, dz);
      if (d < 0.05) { this.route.shift(); continue; }
      const step = Math.min(d, budget);
      pos.x += (dx / d) * step; pos.z += (dz / d) * step;
      this._vel.x += dx / d; this._vel.z += dz / d;
      budget -= step;
      if (step >= d - 1e-4) this.route.shift(); else break;
    }
    // stay inside the room she's in unless going through a doorway or the window
    const w = this.route[0];
    const crossing = (w && w.cross) || this.state === 'enter' || this.state === 'leave';
    const room = this.level.roomAt(pos);
    if (!crossing && room) {
      const r = this.level.rooms[room], m = 0.3;
      pos.x = Math.min(r.x1 - m, Math.max(r.x0 + m, pos.x));
      pos.z = Math.min(r.z1 - m, Math.max(r.z0 + m, pos.z));
    }
    // height: floats at head height (higher when she comes in the window)
    const hy = this.state === 'enter' || this.state === 'leave' ? 1.8 : HEAD_Y;
    pos.y += (hy - pos.y) * Math.min(1, dt * 2);
  }

  _inShot(camera, player) {
    if (!camera || !this.group.visible) return false;
    const d = camera.position.distanceTo(this.position);
    if (d > 10) return false;
    _ndc.copy(this.position).project(camera);
    if (_ndc.z > 1 || Math.abs(_ndc.x) > 0.7 || Math.abs(_ndc.y) > 0.75) return false;
    // same room or a straight shot through an open doorway
    const pr = this.level.roomAt(player.position), kr = this.room;
    if (pr === kr) return true;
    const hops = this._plan(pr, kr);
    return !!hops && hops.length <= 1;
  }

  /** Can the player see her in a photo right now? (for the phone camera) */
  inShot(camera, player) { return this._inShot(camera, player); }

  _setExpr(name) {
    if (this.expr === name) return;
    this.expr = name;
    const tex = this.M.faces[name] || this.M.faces.smile;
    this.M.skinMat.map = tex; this.M.skinMat.emissiveMap = tex;
    this.M.skinMat.needsUpdate = true;
  }
  setExpression(name) { this._setExpr(name); }

  _snapChains() {
    this._pose(0, 0, true);
    const all = [...this.hairChains, this.spine, this.loop, ...this.dangle];
    for (const c of all) for (let i = 0; i < c.n; i++) c.o[i].copy(c.p[i]);
  }

  // ---------------------------------------------------------------- pose: head, hair, entrails
  _pose(dt, t, snap = false) {
    const M = this.M, pos = this.position;
    const bob = Math.sin(t * 1.7) * 0.05 + Math.sin(t * 0.63) * 0.03;
    const posing = this.state === 'pose';
    const tiltWant = posing ? 0.38 : this.state === 'lick' ? -0.15 : Math.sin(t * 0.8) * 0.06;
    this.tilt += (tiltWant - this.tilt) * Math.min(1, dt * 6 || 1);
    M.head.position.set(pos.x, pos.y + bob, pos.z);
    M.head.rotation.set(posing ? -0.12 : 0, this.yaw, this.tilt, 'YXZ');
    M.head.updateMatrixWorld();
    const d = snap ? 1 / 60 : Math.min(dt, 1 / 30);
    const hp = M.head.position;
    // hair ribbons
    const avoid = hp, avoidR = M.R * 1.15;
    const cyaw = Math.cos(this.yaw), syaw = Math.sin(this.yaw);
    for (let s = 0; s < M.STRANDS; s++) {
      const ch = this.hairChains[s];
      _w.copy(M.roots[s].local).applyMatrix4(M.head.matrixWorld);
      if (snap) for (let i = 0; i < ch.n; i++) { ch.p[i].set(_w.x - syaw * 0.02 * i, _w.y - i * ch.seg, _w.z - cyaw * 0.02 * i); ch.o[i].copy(ch.p[i]); }
      ch.step(d, _w, { grav: 2.6, damp: 0.93, iters: 3, avoid, avoidR });
      const fl = M.roots[s].flare;
      for (let i = 0; i < ch.n; i++) {
        const p = _a.copy(ch.p[i]);
        _out.set(p.x - hp.x, 0, p.z - hp.z).normalize(); p.addScaledVector(_out, fl * i);
        const nb = ch.p[Math.min(ch.n - 1, i + 1)], pb = ch.p[Math.max(0, i - 1)];
        _dir.subVectors(nb, pb).normalize();
        _out.set(p.x - hp.x, 0, p.z - hp.z).normalize();
        _side.crossVectors(_dir, _out).normalize();
        const w = 0.0105 * (1 - i / ch.n * 0.65);
        const o = (s * ch.n + i) * 6;
        M.hv[o] = p.x - _side.x * w; M.hv[o + 1] = p.y - _side.y * w; M.hv[o + 2] = p.z - _side.z * w;
        M.hv[o + 3] = p.x + _side.x * w; M.hv[o + 4] = p.y + _side.y * w; M.hv[o + 5] = p.z + _side.z * w;
      }
    }
    M.hairGeo.attributes.position.needsUpdate = true;
    M.hairGeo.computeVertexNormals();
    // entrails
    _w.set(0, -M.R * 1.18 - 0.06, 0).applyMatrix4(M.head.matrixWorld);
    if (snap) for (const c of [this.spine, this.loop, ...this.dangle]) for (let i = 0; i < c.n; i++) { c.p[i].set(_w.x, _w.y - i * c.seg, _w.z); c.o[i].copy(c.p[i]); }
    this.spine.step(d, _w, { grav: 3.2, damp: 0.95 });
    const sp = this.spine.p;
    this.loop.end = sp[7];
    this.loop.step(d, sp[3], { grav: 3.0, damp: 0.94 });
    this.dangle[0].step(d, sp[5], { grav: 3.4, damp: 0.93 });
    this.dangle[1].step(d, sp[6], { grav: 3.4, damp: 0.93 });
    // re-skin the entrails along the chains (Catmull-Rom between the nodes, a bulge every fold)
    const tube = (k, chain, r0, r1, fold) => {
      const n = (chain.n - 1) * SUB + 1, pts = this._tp[k] || (this._tp[k] = Array.from({ length: n }, () => new THREE.Vector3()));
      for (let i = 0; i < n; i++) smoothAt(chain.p, i / SUB, pts[i]);
      M.guts.set(k, pts, (i) => { const u = i / (n - 1); const end = Math.min(1, (n - 1 - i) / 2.5); return (r0 + (r1 - r0) * u) * (1 + Math.abs(Math.sin(i * fold + t * 1.5)) * 0.2) * (0.3 + 0.7 * end); });
    };
    this._tp = this._tp || [];
    tube(0, this.spine, 0.016, 0.014, 1.6);
    tube(1, this.loop, 0.03, 0.026, 0.9);
    tube(2, this.dangle[0], 0.024, 0.012, 1.1);
    tube(3, this.dangle[1], 0.021, 0.01, 1.2);
    M.guts.done();
    const beat = 1 + Math.max(0, Math.sin(t * 7)) * 0.18;
    M.heart.position.copy(sp[2]).add(_v.set(cyaw * 0.03, 0, -syaw * 0.03));
    M.heart.scale.set(beat, 1.2 * beat, 0.9 * beat);
    M.lungs.forEach((l, i) => { const s = i ? 1 : -1; l.position.copy(sp[1]).lerp(sp[2], 0.5).add(_v.set(cyaw * 0.055 * s, 0, -syaw * 0.055 * s)); l.rotation.y = this.yaw; });
    M.stomach.position.copy(sp[4]);
    M.light.position.copy(sp[7]); // low, so it lights the room and only the chin from below
    M.light.intensity = this.group.visible ? 1.5 + Math.sin(t * 3.1) * 0.25 : 0;
  }
}
