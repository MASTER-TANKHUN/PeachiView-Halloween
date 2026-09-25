// Peachi, the ghost VTuber: procedural anime model built from parametric surfaces (no model files).
// Proportions and outfit follow Character_Sheet_1_Peachi.png (≈7 heads, 1.6 m).
// Contract: docs/ARCHITECTURE.md (buildPeachi / buildHeadphonesItem).
import * as THREE from 'three';
import {
  TAU, lerp, smooth, clamp01, tableLerp, surface, ellipsoid, loft, limb, clump,
  heartGeo, roundRectShape, extrude, tint, atlasUV, setSway, place, normalize, PartBin,
} from './geo.js';
import { createAtlas } from './textures.js';
import { createUniforms, toonMaterial, outlineMaterial, SHADE, TERM } from './materials.js';
import { createFace, createFaceSDF, makeAngerMarkTexture, FACE_WINDOW } from './face.js';
import { createAnimator } from './anim.js';

const PI = Math.PI, DEG = PI / 180;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// ---------------------------------------------------------------- palette (sRGB, sampled from the sheet)
const C = {
  skin: 0xf6c8b2, navel: 0xd99684, white: 0xfbf8fd, lav: 0xece6fb, pink: 0xff8cbf, pinkDeep: 0xef5f9f,
  pinkPale: 0xffd0e4, coral: 0xf2566f, ink: 0x221f30, inkSoft: 0x2e2a42, gold: 0xebbd52, sock: 0x221f2d,
};
const HAIR = ['#55261c', '#733224', '#8f3b2c', '#bb5060', '#e8718f', '#f59cba'].map((c) => new THREE.Color(c));
const _hc = new THREE.Color(), _ring = new THREE.Color('#9b5a4a');

/** Hair color by height (the sheet's gradient is dark brown at the crown → pink below the chest). */
function hairColorAt(y, out, ring = 0) {
  const t = clamp01((1.56 - y) / 0.46); // 0 crown … 1 at y=1.10
  const stops = [0, 0.3, 0.5, 0.64, 0.8, 1];
  let i = 0;
  while (i < stops.length - 2 && t > stops[i + 1]) i++;
  out.copy(HAIR[i]).lerp(HAIR[i + 1], clamp01((t - stops[i]) / (stops[i + 1] - stops[i])));
  if (ring > 0) out.lerp(_ring, ring);
  return out;
}

// ---------------------------------------------------------------- rig layout (world rest pose, meters)
const HIPS_O = V(0, 0.98, 0);
const TORSO_O = V(0, 1.03, 0);
const HEAD_O = V(0, 1.36, -0.004);
const HC = V(0, 1.485, 0.008);                 // cranium center
const SHOULDER = V(0.118, 1.292, -0.01);
const HIP_J = V(0.07, 0.865, 0);
const UPPER = 0.255, FORE = 0.225, THIGH = 0.36, SHIN = 0.41;
export const FACE_HEIGHT = 1.425;

// ---------------------------------------------------------------- body shapes
const TORSO = [
  { k: 0.90, rx: 0.100, rzF: 0.064, rzB: 0.070, zc: 0.000 },
  { k: 0.95, rx: 0.100, rzF: 0.062, rzB: 0.068, zc: 0.000 },
  { k: 1.00, rx: 0.091, rzF: 0.058, rzB: 0.060, zc: 0.000 },
  { k: 1.05, rx: 0.079, rzF: 0.055, rzB: 0.053, zc: 0.002 },
  { k: 1.09, rx: 0.075, rzF: 0.054, rzB: 0.051, zc: 0.003 },
  { k: 1.14, rx: 0.082, rzF: 0.060, rzB: 0.053, zc: 0.002 },
  { k: 1.19, rx: 0.090, rzF: 0.064, rzB: 0.056, zc: 0.000 },
  { k: 1.235, rx: 0.097, rzF: 0.064, rzB: 0.058, zc: -0.002 },
  { k: 1.275, rx: 0.102, rzF: 0.057, rzB: 0.055, zc: -0.006 },
  { k: 1.305, rx: 0.090, rzF: 0.047, rzB: 0.050, zc: -0.008 },
  { k: 1.33, rx: 0.056, rzF: 0.037, rzB: 0.041, zc: -0.008 },
  { k: 1.35, rx: 0.033, rzF: 0.030, rzB: 0.033, zc: -0.006 },
];
const _R = {};
const bust = (y, x) => 0.022 * Math.exp(-(((y - 1.2) / 0.038) ** 2)) * Math.exp(-(((Math.abs(x) - 0.042) / 0.034) ** 2));
const wrap = (a) => (a > PI ? a - TAU : a <= -PI ? a + TAU : a);

function torsoPoint(th, y, off, out) {
  tableLerp(TORSO, y, _R);
  const s = Math.sin(th), c = Math.cos(th);
  out.set((_R.rx + off) * s, y, _R.zc + ((c >= 0 ? _R.rzF : _R.rzB) + off) * c);
  if (c > 0) out.z += bust(y, out.x) * Math.pow(c, 1.5);
  return out;
}
// sweetheart neckline of the crop top
const cropTop = (th) => 1.226 + 0.03 * Math.exp(-(((Math.abs(wrap(th)) - 0.5) / 0.26) ** 2)) - 0.006 * Math.exp(-((wrap(th) / 0.16) ** 2));

// off-shoulder jacket: open front (|θ| < J_ALPHA), top edge rises into a collar at the front edges
const J_ALPHA = 0.72;
const jacketTop = (th) => { const a = Math.abs(wrap(th)); return 1.19 + 0.022 * smooth(PI / 2, PI, a) + 0.09 * (1 - smooth(J_ALPHA, PI / 2 + 0.2, a)); };
const jacketBot = (th) => { const a = Math.abs(wrap(th)); return 0.918 + 0.016 * smooth(J_ALPHA, PI, a); };
function jacketPoint(th, y, off, out) {
  const k = clamp01((y - 0.92) / 0.3);
  const rx = lerp(0.19, 0.168, k), rzB = lerp(0.128, 0.086, k), rzF = lerp(0.118, 0.1, k);
  const s = Math.sin(th), c = Math.cos(th);
  const fold = 1 + 0.022 * Math.sin(th * 7 + 0.6) * (1 - k * 0.6) + 0.01 * Math.sin(th * 13 + y * 20);
  return out.set((rx + off) * s * fold, y, -0.012 + ((c >= 0 ? rzF : rzB) + off) * c * fold);
}

// Anime head built from horizontal rings (world Y), tuned to the sheet's face measured in eye spacings
// E (0.069 m): face half-width 0.91E at the eyes, 0.76E at the cheeks, 0.63E at the mouth, 0.31E just
// below it, then a short rounded chin 1.18E under the eye line (a U/V-line jaw, not a long triangle).
// Wf = half-width of the face (front half), Wb = half-width of the skull behind it (hidden by hair/cups),
// zF / zB = frontmost / rearmost z of the ring.
const HEAD_RINGS = [
  { k: 1.366, Wf: 0.0, Wb: 0.0, zF: 0.052, zB: 0.04 },
  { k: 1.369, Wf: 0.008, Wb: 0.011, zF: 0.061, zB: 0.022 },
  { k: 1.376, Wf: 0.02, Wb: 0.026, zF: 0.069, zB: -0.004 },
  { k: 1.386, Wf: 0.033, Wb: 0.042, zF: 0.077, zB: -0.034 },
  { k: 1.4, Wf: 0.0445, Wb: 0.056, zF: 0.083, zB: -0.058 },
  { k: 1.422, Wf: 0.0535, Wb: 0.068, zF: 0.087, zB: -0.08 },
  { k: 1.447, Wf: 0.062, Wb: 0.076, zF: 0.089, zB: -0.092 },
  { k: 1.475, Wf: 0.069, Wb: 0.079, zF: 0.089, zB: -0.098 },
  { k: 1.505, Wf: 0.073, Wb: 0.079, zF: 0.086, zB: -0.098 },
  { k: 1.535, Wf: 0.069, Wb: 0.074, zF: 0.077, zB: -0.09 },
  { k: 1.56, Wf: 0.055, Wb: 0.06, zF: 0.061, zB: -0.074 },
  { k: 1.577, Wf: 0.031, Wb: 0.034, zF: 0.034, zB: -0.046 },
  { k: 1.585, Wf: 0.0, Wb: 0.0, zF: -0.006, zB: -0.012 },
];
const _hr = {};
export const faceHalfWidth = (y) => (y <= 1.366 ? 0 : tableLerp(HEAD_RINGS, Math.min(1.585, y), _hr).Wf);
// v (0 top … 1 chin) → height; the upper half keeps the old spherical spacing so hair placement by
// polar angle stays where it was designed
const headY = (v) => (v <= 0.5 ? HC.y + 0.1 * Math.cos(PI * v) : HC.y - (HC.y - 1.366) * Math.sin(PI * (v - 0.5)));
function headPoint(u, v, o) {
  const th = PI + TAU * u, y = headY(Math.min(1, Math.max(0, v)));
  const R = tableLerp(HEAD_RINGS, y, _hr);
  const s = Math.sin(th), c = Math.cos(th);
  const W = lerp(R.Wb, R.Wf, smooth(-0.35, 0.35, c));
  const x = W * s;
  // flat anime face plane in front, round skull behind
  let z = c >= 0 ? R.zF * c * (1 + 0.35 * (1 - c)) : -R.zB * c;
  z += 0.006 * Math.exp(-((x / 0.0065) ** 2)) * Math.exp(-(((y - 1.428) / 0.011) ** 2)) * smooth(0.8, 1, c); // small nose
  return o.set(x, y, z + HC.z);
}
const _hd = V();
function headAt(az, pol, off, out = V()) {
  headPoint(0.5 + az / TAU, pol / PI, out);
  _hd.copy(out).sub(HC).normalize();
  return out.addScaledVector(_hd, off);
}
const _o1 = V(), _o2 = V();
function hairOutward(t, p, out) {
  _o1.copy(p).sub(HC).normalize();
  _o2.set(p.x, 0, p.z + 0.01);
  if (_o2.lengthSq() < 1e-8) _o2.set(0, 0, -1);
  _o2.normalize();
  return out.copy(_o2).lerp(_o1, smooth(HC.y - 0.14, HC.y - 0.02, p.y)).normalize();
}

// ---------------------------------------------------------------- small helpers
function roundedPoly(pts, r) {
  const s = new THREE.Shape(), n = pts.length;
  const at = (i) => pts[(i + n) % n];
  const towards = (a, b, d) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy); return [a[0] + dx / l * d, a[1] + dy / l * d]; };
  for (let i = 0; i < n; i++) {
    const p = at(i), rr = Array.isArray(r) ? r[i] : r;
    const a = towards(p, at(i - 1), rr), b = towards(p, at(i + 1), rr);
    if (i === 0) s.moveTo(a[0], a[1]); else s.lineTo(a[0], a[1]);
    s.quadraticCurveTo(p[0], p[1], b[0], b[1]);
  }
  s.closePath();
  return s;
}
function paintY(g, fn) {
  const p = g.attributes.position, c = g.attributes.color;
  for (let i = 0; i < p.count; i++) { fn(_hc, p.getX(i), p.getY(i), p.getZ(i)); c.setXYZ(i, _hc.r, _hc.g, _hc.b); }
  return g;
}
function frameGeo(w, h, bar, depth) { // rectangular buckle frame
  const outer = roundRectShape(w, h, bar * 0.9);
  const hole = roundRectShape(w - bar * 2, h - bar * 2, bar * 0.4);
  return extrude(outer, depth, depth * 0.35, { holes: [hole], curveSegments: 4 });
}
function sphere(r, seg = 8) { return new THREE.SphereGeometry(r, seg, Math.max(4, seg * 0.6 | 0)); }

// =====================================================================================
// headphones — authored around the cranium center (HC-local). add(key, geo, opts)
// =====================================================================================
function buildHeadphones(add, atlas) {
  const Rx = 0.106, Ry = 0.127, zB = 0.012, A0 = 1.62;
  const arc = (a, r, out) => out.set(Math.sin(a) * (Rx + r), Math.cos(a) * (Ry + r), zB);
  const band = (rIn, rOut, halfW, color) => surface((u, v, o) => {
    const a = lerp(-A0, A0, v), ph = u * TAU, c = Math.cos(ph), s = Math.sin(ph);
    const n = Math.sign(c) * Math.pow(Math.abs(c), 0.55), b = Math.sign(s) * Math.pow(Math.abs(s), 0.55);
    arc(a, (rIn + rOut) / 2 + n * (rOut - rIn) / 2, o); o.z += b * halfW;
  }, 12, 44, { color });
  add('solid', band(0.0, 0.012, 0.0125, C.pink));
  add('solid', band(-0.007, 0.001, 0.0095, C.lav), { outline: 0.6 });
  // pink segment ridges on the band (the sheet's band is built from plates)
  for (const a of [-1.2, -0.95, 0.95, 1.2]) {
    const g = new THREE.BoxGeometry(0.02, 0.006, 0.028);
    place(g, arc(a, 0.012, V()).toArray(), [0, 0, -a]);
    add('solid', g, { color: C.pinkDeep, outline: 0.5 });
  }
  for (const s of [-1, 1]) {
    // slider + yoke
    add('solid', extrude(roundRectShape(0.016, 0.03, 0.005), 0.022, 0.004), { pos: [s * 0.104, -0.002, zB], color: C.pink });
    const yoke = new THREE.TorusGeometry(0.052, 0.0055, 6, 20, PI);
    yoke.rotateY(PI / 2);
    add('solid', yoke, { pos: [s * 0.108, -0.052, 0], color: C.lav });
    // cup (axis along y, then turned to face outward)
    const cup = [];
    const cushion = new THREE.TorusGeometry(0.033, 0.012, 8, 24); cushion.rotateX(PI / 2);
    cup.push(['solid', tint(normalizeColor(cushion), C.lav)]);
    const shell = new THREE.LatheGeometry([
      new THREE.Vector2(0.03, 0.006), new THREE.Vector2(0.044, 0.01), new THREE.Vector2(0.048, 0.019),
      new THREE.Vector2(0.047, 0.03), new THREE.Vector2(0.041, 0.036), new THREE.Vector2(0.03, 0.037),
    ], 28);
    cup.push(['solid', tint(normalizeColor(shell), C.pink)]);
    const rim = new THREE.TorusGeometry(0.041, 0.0055, 8, 28); rim.rotateX(PI / 2); rim.translate(0, 0.035, 0);
    cup.push(['solid', tint(normalizeColor(rim), C.white)]);
    const plate = new THREE.CircleGeometry(0.037, 28); plate.rotateZ(s * PI / 2); plate.rotateX(-PI / 2); plate.translate(0, 0.0385, 0);
    cup.push(['print', atlasUV(normalizeColor(plate), atlas.rect('cup'))]);
    for (const [key, g] of cup) {
      g.scale(1, 1, 1.14); g.rotateZ(-s * PI / 2);
      g.translate(s * 0.09, -0.052, 0);
      add(key, g, { outline: key === 'print' ? 0 : 1 });
    }
    // cat ear: pink rounded frame + glowing inner panel
    const a = s * 0.62;
    const base = arc(a, 0.004, V());
    const ear = extrude(roundedPoly([[-0.035, 0], [0.035, 0], [0.006 * s, 0.074]], [0.008, 0.008, 0.012]), 0.018, 0.004);
    const inner = extrude(roundedPoly([[-0.022, 0.008], [0.022, 0.008], [0.005 * s, 0.052]], [0.005, 0.005, 0.008]), 0.006, 0.0015);
    inner.translate(0, 0, 0.0105);
    normalizeColor(inner);
    paintY(inner, (c, x, y) => c.set(y < 0.018 ? '#ffe7a6' : y < 0.034 ? '#f3e8ff' : '#ffffff'));
    for (const [key, g] of [['solid', tint(normalizeColor(ear), C.pink)], ['led', inner]]) {
      g.rotateY(s * 0.22); g.rotateZ(-a * 0.8);
      g.translate(base.x, base.y - 0.012, base.z);
      add(key, g, { outline: key === 'led' ? 0 : 1.1 });
    }
  }
}
function normalizeColor(g) { // ensure a color attribute exists so tint/paint can write into it
  if (!g.attributes.color) g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(1), 3));
  return g;
}

// =====================================================================================
export function buildPeachi({ ghost = true } = {}) {
  const U = createUniforms(ghost);
  const atlas = createAtlas();
  const face = createFace();
  const faceSDF = createFaceSDF(256, faceHalfWidth);
  U.uFaceSDF.value = faceSDF;
  U.uFaceWin.value.set(FACE_WINDOW.x0 - HEAD_O.x, FACE_WINDOW.y0 - HEAD_O.y, FACE_WINDOW.x1 - HEAD_O.x, FACE_WINDOW.y1 - HEAD_O.y);
  U.uFaceZ.value = HC.z - HEAD_O.z;

  const M = {
    solid: toonMaterial(U, { vertexColors: true, side: THREE.DoubleSide }, { shade: SHADE.cloth }),
    skin: toonMaterial(U, { vertexColors: true }, { shade: SHADE.skin, term: TERM.skin }),
    faceSkin: toonMaterial(U, { vertexColors: true }, { shade: SHADE.face, term: TERM.skin, faceSDF: true }),
    hair: toonMaterial(U, { vertexColors: true, side: THREE.DoubleSide }, { shade: SHADE.warm, strands: true }),
    holo: toonMaterial(U, { vertexColors: true, map: atlas.texture, side: THREE.DoubleSide }, { holo: true, lining: true, shade: SHADE.cloth }),
    print: toonMaterial(U, { vertexColors: true, map: atlas.texture, alphaTest: 0.5, side: THREE.DoubleSide }, { shade: SHADE.cloth }),
    led: toonMaterial(U, { vertexColors: true, emissive: 0xff9ad0, emissiveIntensity: 0.75 }, { rim: false }),
    face: toonMaterial(U, {
      map: face.texture, transparent: true, depthWrite: false, emissive: 0xffffff, emissiveMap: face.texture, emissiveIntensity: 0.16,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
    }, { rim: false, crisp: false, shade: SHADE.face, faceSDF: true }),
    // Star Rail-style see-through bangs: eyes + brows drawn again, half-transparent, over hair right in front
    eyes: toonMaterial(U, {
      map: face.overlayTexture, transparent: true, depthWrite: false, emissive: 0xffffff, emissiveMap: face.overlayTexture, emissiveIntensity: 0.16,
    }, { rim: false, crisp: false, shade: SHADE.face, faceSDF: true, eyeOverlay: true }),
  };
  const outline = outlineMaterial(U);

  // ---------------- rig
  const group = new THREE.Group(); group.name = 'Peachi';
  const root = new THREE.Group(); group.add(root);
  const joint = (parent, world) => {
    const g = new THREE.Group();
    g.userData.o = world.clone();
    g.position.copy(world).sub(parent.userData.o || V());
    parent.add(g);
    return g;
  };
  root.userData.o = V();
  const hips = joint(root, HIPS_O);
  const torso = joint(root, TORSO_O);
  const head = joint(torso, HEAD_O);

  const bin = new PartBin();
  const W = (grp, key, geo, opts = {}) => {
    const { pos, rot, scale, ...rest } = opts;
    if (pos || rot || scale !== undefined) place(geo, pos, rot, scale ?? 1);
    const o = grp.userData.o; geo.translate(-o.x, -o.y, -o.z);
    return bin.add(grp, key, geo, rest);
  };
  const L = (grp, key, geo, opts) => bin.add(grp, key, geo, opts);
  const white = atlas.white();
  const holoW = (grp, geo, opts) => W(grp, 'holo', atlasUV(geo, white), opts);
  const holoL = (grp, geo, opts) => L(grp, 'holo', atlasUV(geo, white), opts);
  const _p = V();

  // =================================================================== head
  W(head, 'faceSkin', surface(headPoint, 40, 30, { color: C.skin, flip: true }), { outline: 0.8 });
  { // face decal: same surface, planar-projected UVs from the front
    const fw = FACE_WINDOW;
    const g = surface((u, v, o) => {
      headPoint(lerp(0.3, 0.7, u), lerp(0.28, 0.86, v), o);
      _hd.copy(o).sub(HC).multiplyScalar(0.004); o.add(_hd);
    }, 22, 22, { flip: true });
    const pos = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) - fw.x0) / (fw.x1 - fw.x0), (pos.getY(i) - fw.y0) / (fw.y1 - fw.y0));
    const eyes = g.clone();
    W(head, 'face', g, { outline: 0 });
    W(head, 'eyes', eyes, { outline: 0 });
  }
  // ---- hair: scalp shell
  {
    const polMax = (az) => PI * (0.3 + 0.42 * Math.pow((1 - Math.cos(az)) / 2, 0.8));
    const g = surface((u, v, o) => {
      const az = (u - 0.5) * TAU;
      headAt(az, polMax(az) * v, 0.0085 + 0.004 * (1 - v), o);
    }, 36, 14, {
      flip: true,
      sway: () => [0, 0],
      uv: (u, v) => [u * 10, v],
      color: (u, v, p, c) => hairColorAt(p.y, c, 0.5 * Math.exp(-(((p.y - 1.545) / 0.01) ** 2)) * smooth(-0.02, 0.05, p.z - HC.z)),
    });
    W(head, 'hair', g, { outline: 1 });
  }
  let hairSeed = 3;
  const hairPiece = (pts, { w, d = 0.006, amp = 0.01, phase = 0, curl = 0.3, nv = 14, nu = 6, ringY = 1.545, shape = 'bang' }) => {
    hairSeed = (hairSeed * 16807) % 2147483647;
    const tone = 0.92 + 0.14 * (hairSeed / 2147483647);
    const path = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    // w is the half-width. 'front' locks stay slim beside the face and fan out over the shoulders/chest.
    const width = shape === 'bang'
      ? (t) => w * (0.82 + 0.3 * t) * Math.pow(1 - Math.pow(t, 5), 0.85)
      : shape === 'front'
        ? (t) => w * (0.24 + 0.9 * smooth(0.34, 0.66, t)) * (1 - Math.pow(t, 3.2))
        : (t) => w * (0.62 + 0.55 * Math.sin(PI * Math.min(1, t * 1.15)) ** 0.6) * (1 - Math.pow(t, 3.2));
    const g = clump(path, {
      width, thick: (t) => d * (1 - 0.65 * t), outward: hairOutward, nu, nv, curl,
      color: (u, v, p, c) => {
        const ph = u * TAU, cw = Math.abs(Math.cos(ph)), sn = Math.sin(ph);
        hairColorAt(p.y, c, 0.45 * Math.exp(-(((p.y - ringY) / 0.009) ** 2)));
        return c.multiplyScalar(tone * (1 - 0.3 * cw * cw * cw) * (sn < 0 ? 0.78 : 1));
      },
      sway: (u, v) => [amp * Math.pow(v, 1.7), phase],
    });
    W(head, 'hair', g, { outline: 1 });
  };
  // ---- bangs [azimuth°, end polar (×π), width]: heavy, cut at the brows, one lock between the eyes
  { // under-layer so no forehead shows between the locks
    const g = surface((u, v, o) => {
      const az = lerp(-78, 78, u) * DEG;
      headAt(az, lerp(0.16, 0.5 + 0.08 * Math.pow(Math.abs(u - 0.5) * 2, 2), v) * PI, 0.0075, o);
    }, 16, 6, { flip: true, color: (u, v, p, c) => hairColorAt(p.y, c).multiplyScalar(0.8) });
    W(head, 'hair', g, { outline: 0 });
  }
  const BANGS = [[-74, 0.73, 0.013], [-61, 0.62, 0.022], [-47, 0.572, 0.036], [-34, 0.552, 0.036], [-22, 0.562, 0.036], [-10, 0.55, 0.036],
    [2, 0.6, 0.013], [12, 0.55, 0.036], [25, 0.56, 0.036], [37, 0.548, 0.036], [49, 0.566, 0.036], [61, 0.62, 0.022], [74, 0.73, 0.013]];
  BANGS.forEach(([deg, end, w], i) => {
    const az = deg * DEG, off = i % 2 ? 0.0135 : 0.0115;
    hairPiece([
      headAt(az * 0.3, 0.05 * PI, off), headAt(az * 0.72, 0.22 * PI, off + 0.004), headAt(az * 0.94, 0.4 * PI, off + 0.005),
      headAt(az, (end - 0.07) * PI, off + 0.001), headAt(az * 1.03, end * PI, off - 0.004),
    ], { w, d: 0.0065, amp: 0.004, phase: i * 1.3, curl: 0.3 });
  });
  // ---- front hair: locks tucked under the headphone cups that come out below them and fall
  // in front of the shoulders, over the collar and the upper sleeves (the face stays clear from the side)
  for (const s of [-1, 1]) {
    // inner lock over the chest
    hairPiece([
      headAt(s * 52 * DEG, 0.2 * PI, 0.014), headAt(s * 62 * DEG, 0.44 * PI, 0.02), V(s * 0.071, 1.45, 0.03),
      V(s * 0.074, 1.4, 0.028), V(s * 0.077, 1.36, 0.036), V(s * 0.084, 1.31, 0.047), V(s * 0.1, 1.265, 0.05), V(s * 0.086, 1.205, 0.058),
      V(s * 0.104, 1.15, 0.058), V(s * 0.126, 1.105, 0.052), V(s * 0.14, 1.08, 0.046),
    ], { w: 0.034, d: 0.012, amp: 0.012, phase: s * 2.1, curl: 0.25, nv: 26, shape: 'front' });
    // wide lock over the shoulder front and the upper sleeve, curling outward
    hairPiece([
      headAt(s * 72 * DEG, 0.17 * PI, 0.013), headAt(s * 80 * DEG, 0.42 * PI, 0.024), V(s * 0.078, 1.43, 0.006),
      V(s * 0.088, 1.37, 0.02), V(s * 0.124, 1.315, 0.042), V(s * 0.158, 1.26, 0.062), V(s * 0.16, 1.2, 0.074),
      V(s * 0.184, 1.15, 0.078), V(s * 0.21, 1.11, 0.074), V(s * 0.234, 1.085, 0.064), V(s * 0.25, 1.07, 0.056),
    ], { w: 0.044, d: 0.015, amp: 0.016, phase: s * 3.3, curl: 0.22, nu: 8, nv: 26, shape: 'front' });
    // outer lock: behind the cup, then spilling over the shoulder in an S-wave
    hairPiece([
      headAt(s * 86 * DEG, 0.2 * PI, 0.013), headAt(s * 98 * DEG, 0.45 * PI, 0.024), V(s * 0.086, 1.42, -0.042),
      V(s * 0.112, 1.36, -0.022), V(s * 0.152, 1.315, 0.018), V(s * 0.19, 1.27, 0.03), V(s * 0.206, 1.21, 0.05),
      V(s * 0.198, 1.16, 0.07), V(s * 0.214, 1.12, 0.08), V(s * 0.24, 1.1, 0.076),
    ], { w: 0.042, d: 0.014, amp: 0.018, phase: s * 4.1, curl: 0.22, nu: 8, nv: 24, shape: 'front' });
    // a thinner wisp between them for a layered edge
    hairPiece([
      headAt(s * 64 * DEG, 0.24 * PI, 0.015), headAt(s * 70 * DEG, 0.48 * PI, 0.022), V(s * 0.074, 1.43, 0.018),
      V(s * 0.08, 1.37, 0.03), V(s * 0.1, 1.3, 0.05), V(s * 0.12, 1.235, 0.062), V(s * 0.118, 1.18, 0.066),
    ], { w: 0.022, d: 0.009, amp: 0.014, phase: s * 1.2, curl: 0.25, nv: 22, shape: 'front' });
  }
  // ---- back hair: behind the cups and shoulders; long and wavy at the sides, ending at the hood in the middle.
  // Waves stay in phase between neighbours (like real wavy hair) and an under-layer fills the gaps.
  // [azimuth°, tip y, tip radius, width]
  const BACK = [
    [94, 1.06, 0.25, 0.06], [106, 1.01, 0.245, 0.07], [118, 0.99, 0.232, 0.076], [130, 1.02, 0.212, 0.078],
    [142, 1.06, 0.2, 0.078], [154, 1.14, 0.185, 0.076], [166, 1.23, 0.165, 0.074], [180, 1.3, 0.148, 0.078],
  ];
  const INNER = [[100, 1.05, 0.225, 0.07], [112, 1.02, 0.215, 0.074], [124, 1.02, 0.2, 0.076], [136, 1.05, 0.2, 0.076], [148, 1.1, 0.19, 0.074], [160, 1.19, 0.17, 0.07], [173, 1.27, 0.155, 0.07]];
  const PSI = [{ k: 90, p: 114 }, { k: 106, p: 124 }, { k: 118, p: 131 }, { k: 130, p: 137 }, { k: 142, p: 141 }, { k: 154, p: 147 }, { k: 166, p: 158 }, { k: 176, p: 168 }];
  const waveOf = (az, k) => 0.024 * Math.sin(k * 6.6 + az * 0.018) * smooth(0, 0.45, k);
  const hangPoint = (sgn, az, k, y, tipR, inset, out, r0 = 0.105) => {
    // sides swing back behind the shoulders; near the middle the hair parts around the hood
    const a = sgn * az * DEG, psi = sgn * (az >= 179 ? 180 : tableLerp(PSI, az).p) * DEG;
    const ang = lerp(a, psi, smooth(0, 0.45, k));
    const R = lerp(r0, tipR, Math.pow(k, 0.85)) + 0.03 * smooth(0.65, 1, k) - inset;
    const wv = waveOf(az, k) * sgn, sx = Math.sin(ang), cz = Math.cos(ang);
    return out.set(sx * R + cz * wv, y, cz * R - 0.01 - sx * wv * 0.35);
  };
  const backClump = (sgn, az, tipY, tipR, w, inner) => {
    const a = sgn * az * DEG;
    // over the crown, down the back of the head, then hang straight off the nape (no outward jump → no twisting)
    const off = inner ? 0.018 : 0.026;
    const pts = [headAt(a * 0.85, 0.08 * PI, 0.012), headAt(a, 0.36 * PI, off - 0.004), headAt(a, 0.56 * PI, off), headAt(a, 0.68 * PI, off + 0.004)];
    const last = pts[3], y0 = last.y, r0 = Math.hypot(last.x, last.z + 0.01) + (inner ? 0.014 : 0);
    for (let i = 1; i <= 7; i++) { const k = i / 7; pts.push(hangPoint(sgn, az, k, lerp(y0, tipY, k), tipR, inner ? 0.014 : 0, V(), r0)); }
    hairPiece(pts, { w, d: inner ? 0.016 : 0.021, amp: 0.026, phase: az * 0.02, curl: 0.18, nu: 8, nv: 22, shape: 'lock' });
  };
  for (const [az, tipY, tipR, w] of INNER) for (const sg of [-1, 1]) backClump(sg, az, tipY, tipR, w, true);
  for (const [az, tipY, tipR, w] of BACK) for (const sg of az === 180 ? [1] : [-1, 1]) backClump(sg, az, tipY, tipR, w, false);
  { // under-layer: a wavy curtain just inside the clumps, from the crown to a bit above the tips
    const tipAt = (az) => tableLerp(BACK.map(([k, y, r]) => ({ k, y, r })), az);
    const g = surface((u, v, o) => {
      const around = lerp(96, 264, u), sg = around <= 180 ? 1 : -1, az = around <= 180 ? around : 360 - around;
      const T = tipAt(az);
      const yTop = 1.44, y = lerp(yTop, T.y + 0.06, v);
      const k = clamp01((yTop - y) / (yTop - T.y));
      hangPoint(sg, az, k, y, T.r, 0.022 + 0.01 * (1 - k), o);
    }, 32, 12, { color: (u, v, p, c) => hairColorAt(p.y, c).multiplyScalar(0.72), sway: (u, v) => [0.016 * v * v, 0.4] });
    W(head, 'hair', g, { outline: 0 });
  }
  // ---- headphones + anger mark
  buildHeadphones((key, g, opts) => { g.translate(HC.x, HC.y, HC.z); W(head, key, g, opts); }, atlas);

  // =================================================================== neck, torso, crop top, choker
  W(torso, 'skin', limb(0.13, 0.0295, 0.031, 14, 8, { cap0: 0.01, cap1: 0.01 }).translate(0, 1.425, -0.006), { color: C.skin });
  W(torso, 'skin', surface((u, v, o) => torsoPoint(PI + TAU * u, lerp(0.9, 1.35, v), 0, o), 32, 30), { color: C.skin });
  W(torso, 'solid', ellipsoid(0.005, 0.008, 0.003, 8, 6), { pos: [0, 1.036, 0.056], color: C.navel, outline: 0 });
  W(torso, 'print', surface((u, v, o) => { const th = PI + TAU * u; torsoPoint(th, lerp(1.121, cropTop(th), v), 0.0035, o); }, 44, 10, {
    uv: (u, v) => { const r = atlas.rect('crop'); return [lerp(r[0], r[2], u), lerp(r[1], r[3], v)]; },
  }));
  { // choker: black band, gold studs, pink heart + second heart on the chest
    const band = new THREE.TorusGeometry(0.0335, 0.0068, 8, 28); band.rotateX(PI / 2); band.scale(1, 1, 1.1);
    W(torso, 'solid', band.translate(0, 1.352, -0.006), { color: C.ink });
    for (let i = -3; i <= 3; i++) { if (!i) continue; const a = i * 0.36; W(torso, 'solid', sphere(0.0028, 6), { pos: [Math.sin(a) * 0.0385, 1.352, Math.cos(a) * 0.0405 - 0.006], color: C.gold, outline: 0 }); }
    W(torso, 'solid', heartGeo(0.011, 0.007), { pos: [0, 1.349, 0.036], color: C.pink, outline: 0.7 });
    W(torso, 'solid', new THREE.TorusGeometry(0.003, 0.0011, 4, 8), { pos: [0, 1.335, 0.037], color: C.gold, outline: 0 });
    W(torso, 'solid', sphere(0.0022, 6), { pos: [0, 1.328, 0.038], color: C.gold, outline: 0 });
    W(torso, 'solid', heartGeo(0.0095, 0.006), { pos: [0, 1.316, 0.04], rot: [-0.25, 0, 0], color: C.pink, outline: 0.7 });
  }

  // =================================================================== jacket
  {
    const span = TAU - 2 * J_ALPHA;
    const body = surface((u, v, o) => { const th = wrap(J_ALPHA + u * span); jacketPoint(th, lerp(jacketBot(th), jacketTop(th), v), 0, o); }, 56, 16, { color: C.white });
    holoW(torso, body);
    // hem band with peach studs at the back and gold studs at the front
    holoW(torso, surface((u, v, o) => { const th = wrap(J_ALPHA + u * span); jacketPoint(th, jacketBot(th) - 0.002 + v * 0.028, 0.004, o); }, 56, 2, { color: C.lav }));
    for (let i = 0; i <= 8; i++) {
      const th = PI + (i - 4) * 0.2, y = jacketBot(th) + 0.012;
      if (i === 4) { W(torso, 'solid', new THREE.TorusGeometry(0.006, 0.002, 5, 10), { pos: jacketPoint(th, y, 0.009, _p).toArray(), color: C.gold, outline: 0 }); continue; }
      W(torso, 'solid', heartGeo(0.0065, 0.004), { pos: jacketPoint(th, y, 0.008, _p).toArray(), rot: [0, PI, 0], color: C.pinkDeep, outline: 0 });
    }
    for (const s of [-1, 1]) {
      const e = s * J_ALPHA;
      // placket along the front edge
      holoW(torso, surface((u, v, o) => { const th = e + s * u * 0.17; jacketPoint(th, lerp(jacketBot(th), jacketTop(th) - 0.002, v), 0.003, o); }, 4, 14, {
        color: (u, v, p, c) => c.set(u > 0.82 ? C.white : C.pink),
      }));
      for (let k = 0; k < 6; k++) {
        const y = lerp(0.95, 1.2, k / 5);
        W(torso, 'solid', sphere(0.0036, 6), { pos: jacketPoint(e + s * 0.21, y, 0.006, _p).toArray(), color: C.gold, outline: 0 });
      }
      // pink folded collar leaning outward at the top of each front
      holoW(torso, surface((u, v, o) => {
        const th = e + s * u * 0.5, top = jacketTop(th);
        jacketPoint(th, top - 0.006 + v * 0.032 * (1 - u * 0.6), 0.003 + v * 0.018, o);
      }, 10, 3, { color: (u, v, p, c) => c.set(v > 0.8 ? C.white : C.pink) }));
      // black strap with a gold buckle on each front
      const sth = e + s * 0.34;
      W(torso, 'solid', surface((u, v, o) => jacketPoint(sth + (u - 0.5) * 0.11, lerp(1.08, jacketTop(sth) - 0.004, v), 0.006, o), 2, 8, { color: C.ink }), { outline: 0.6 });
      jacketPoint(sth, 1.19, 0.01, _p);
      W(torso, 'solid', frameGeo(0.026, 0.02, 0.0045, 0.004), { pos: _p.toArray(), rot: [0, sth, 0], color: C.gold, outline: 0.5 });
      for (const y of [1.12, 1.15]) W(torso, 'solid', sphere(0.0028, 6), { pos: jacketPoint(sth, y, 0.009, _p).toArray(), color: C.gold, outline: 0 });
    }
    // hood lying on the upper back: holo with a pink center stripe and rolled pink edge
    const backZ = (y) => {
      const zt = torsoPoint(PI, y, 0.015, _p).z;
      return y < jacketTop(PI) ? Math.min(zt, jacketPoint(PI, y, 0.008, _p).z) : zt;
    };
    const hoodPoint = (u, v, o) => {
      const y = lerp(1.292, 1.13, v);
      const halfW = 0.118 * Math.sqrt(Math.max(0, 1 - Math.pow(v * 0.96, 3)));
      const puff = 0.042 * Math.pow(Math.sin(PI * u), 0.7) * Math.pow(Math.sin(PI * clamp01(v * 0.88 + 0.12)), 0.8);
      return o.set((u - 0.5) * 2 * halfW, y, backZ(y) - puff - 0.006);
    };
    holoW(torso, surface(hoodPoint, 18, 12, { color: (u, v, p, c) => c.set(Math.abs(u - 0.5) < 0.05 ? C.pink : C.white) }));
    const edge = new THREE.CatmullRomCurve3(Array.from({ length: 9 }, (_, i) => hoodPoint(i / 8, 0, V()).add(V(0, 0.002, -0.004))));
    W(torso, 'solid', new THREE.TubeGeometry(edge, 24, 0.0075, 6), { color: C.pink });
    W(torso, 'print', atlasUV(surface((u, v, o) => {
      hoodPoint(lerp(0.4, 0.6, 1 - u), lerp(0.74, 0.54, v), o); o.z -= 0.004;
    }, 4, 4), atlas.rect('emblem')), { outline: 0 });
    // PEACHI banner down the back
    W(torso, 'print', surface((u, v, o) => { const th = PI + (u - 0.5) * 0.7; jacketPoint(th, lerp(0.94, 1.175, v), 0.0045, o); }, 10, 10, {
      uv: (u, v) => { const r = atlas.rect('banner'); return [lerp(r[0], r[2], u), lerp(r[1], r[3], v)]; },
    }), { outline: 0 });
  }

  // =================================================================== arms
  const arms = [];
  for (const s of [-1, 1]) {
    const shoulder = new THREE.Group(); shoulder.position.set(s * SHOULDER.x, SHOULDER.y - TORSO_O.y, SHOULDER.z); torso.add(shoulder);
    const elbow = new THREE.Group(); elbow.position.y = -UPPER; shoulder.add(elbow);
    const hand = new THREE.Group(); hand.position.y = -FORE; elbow.add(hand);
    const outerTh = s * PI / 2; // loft θ of the arm's outer side
    L(shoulder, 'skin', ellipsoid(0.037, 0.042, 0.035, 14, 10), { pos: [s * 0.004, -0.012, 0], color: C.skin });
    L(shoulder, 'skin', limb(UPPER, 0.033, 0.027, 14, 10, { cap0: 0.02, zs: 0.95 }), { color: C.skin });
    // sleeve: pink cap band → puffy holo upper sleeve → black band
    const upR = (y) => tableLerp([{ k: -0.275, r: 0.06 }, { k: -0.235, r: 0.058 }, { k: -0.19, r: 0.055 }, { k: -0.14, r: 0.051 }, { k: -0.105, r: 0.047 }], y).r;
    const wr = (th, y) => 1 + 0.045 * Math.sin(th * 5 + y * 40) + 0.03 * Math.sin(th * 3 - y * 25);
    holoL(shoulder, surface((u, v, o) => {
      const th = PI + TAU * u, y = lerp(-0.275, -0.105, v), r = upR(y) * wr(th, y);
      o.set(s * 0.003 + r * Math.sin(th), y, -0.004 + r * Math.cos(th));
    }, 28, 10, { color: C.white }));
    holoL(shoulder, surface((u, v, o) => {
      const th = outerTh + (u - 0.5) * 0.36, y = lerp(-0.272, -0.12, v), r = upR(y) * wr(th, y) + 0.0022;
      o.set(s * 0.003 + r * Math.sin(th), y, -0.004 + r * Math.cos(th));
    }, 3, 10, { color: C.pink }));
    holoL(shoulder, loft((v, R) => { R.y = lerp(-0.124, -0.076, v); R.rx = R.rzF = R.rzB = lerp(0.051, 0.045, v); R.zc = -0.004; R.x = s * 0.003; }, 28, 3, {
      color: (u, v, p, c) => c.set(v < 0.2 ? C.white : C.pink),
    }));
    for (const k of [-1, 0, 1]) {
      const th = s * 0.6 + k * 0.32;
      L(shoulder, 'solid', sphere(0.0034, 6), { pos: [s * 0.003 + Math.sin(th) * 0.053, -0.1, -0.004 + Math.cos(th) * 0.053], color: C.gold, outline: 0 });
    }
    L(shoulder, 'solid', loft((v, R) => { R.y = lerp(-0.184, -0.156, v); R.rx = R.rzF = R.rzB = upR(R.y) + 0.006; R.zc = -0.004; R.x = s * 0.003; }, 28, 2), { color: C.ink, outline: 0.8 });
    L(shoulder, 'solid', frameGeo(0.026, 0.024, 0.0045, 0.004), { pos: [s * 0.061, -0.17, -0.004], rot: [0, s * PI / 2, 0], color: C.gold, outline: 0.5 });

    // forearm: balloon sleeve gathered into a banded cuff
    L(elbow, 'skin', limb(FORE, 0.027, 0.02, 12, 10, { cap0: 0.02 }), { color: C.skin });
    const loR = (y) => tableLerp([{ k: -0.2, r: 0.038 }, { k: -0.188, r: 0.05 }, { k: -0.165, r: 0.063 }, { k: -0.12, r: 0.068 }, { k: -0.06, r: 0.066 }, { k: 0.0, r: 0.062 }, { k: 0.035, r: 0.058 }], y).r;
    const droop = (y) => 0.012 * Math.exp(-(((y + 0.12) / 0.06) ** 2));
    holoL(elbow, surface((u, v, o) => {
      const th = PI + TAU * u, y = lerp(-0.2, 0.035, v), r = loR(y) * wr(th, y * 1.3);
      o.set(s * (0.003 + droop(y)) + r * Math.sin(th), y, -0.006 - droop(y) + r * Math.cos(th));
    }, 30, 14, { color: C.white }));
    holoL(elbow, surface((u, v, o) => {
      const th = outerTh + (u - 0.5) * 0.3, y = lerp(-0.19, 0.03, v), r = loR(y) * wr(th, y * 1.3) + 0.0022;
      o.set(s * (0.003 + droop(y)) + r * Math.sin(th), y, -0.006 - droop(y) + r * Math.cos(th));
    }, 3, 14, { color: C.pink }));
    // cuff: white band, pink ring, dark end band, gold buckle
    L(elbow, 'solid', loft((v, R) => { R.y = lerp(-0.23, -0.196, v); R.rx = R.rzF = R.rzB = lerp(0.034, 0.037, v); R.zc = -0.004; R.x = s * 0.003; }, 24, 2), { color: C.white });
    const cring = new THREE.TorusGeometry(0.0375, 0.0042, 6, 24); cring.rotateX(PI / 2);
    L(elbow, 'solid', cring, { pos: [s * 0.003, -0.2, -0.004], color: C.pink, outline: 0.6 });
    L(elbow, 'solid', loft((v, R) => { R.y = lerp(-0.238, -0.224, v); R.rx = R.rzF = R.rzB = 0.0355; R.zc = -0.004; R.x = s * 0.003; }, 24, 1), { color: C.inkSoft });
    L(elbow, 'solid', frameGeo(0.02, 0.016, 0.0038, 0.004), { pos: [s * 0.04, -0.213, -0.004], rot: [0, s * PI / 2, 0], color: C.gold, outline: 0.5 });

    // hand: slim palm facing the thigh, four fingers, thumb forward
    L(hand, 'skin', ellipsoid(0.0125, 0.034, 0.021, 12, 8), { pos: [0, -0.03, 0.002], color: C.skin });
    const FING = [[0.012, 0.042, 0.03], [0.004, 0.047, 0.0], [-0.004, 0.045, -0.03], [-0.012, 0.037, -0.06]];
    for (const [z, len, fan] of FING) {
      L(hand, 'skin', limb(len, 0.0064, 0.0052, 8, 6), { pos: [-s * 0.002, -0.058, z], rot: [fan, 0, -s * 0.42], color: C.skin, outline: 0.7 });
    }
    L(hand, 'skin', limb(0.04, 0.0068, 0.0052, 8, 6), { pos: [-s * 0.004, -0.018, 0.018], rot: [-0.75, 0, -s * 0.35], color: C.skin, outline: 0.7 });
    arms.push({ shoulder, elbow, hand, side: s });
  }

  // =================================================================== hips: shorts, skirt, frill, belt, chain, straps
  W(hips, 'solid', loft((v, R) => { R.y = lerp(0.835, 1.0, v); R.rx = lerp(0.1, 0.093, v); R.rzF = 0.068; R.rzB = 0.074; R.zc = 0; }, 24, 4), { color: C.ink, outline: 0 });
  const PLEATS = 26;
  const tri = (x) => 1 - 4 * Math.abs(((x % 1) + 1) % 1 - 0.5); // -1..1 triangle wave
  const skirtR = (v) => ({ rx: lerp(0.218, 0.101, Math.pow(v, 0.85)), rzF: lerp(0.176, 0.067, Math.pow(v, 0.85)), rzB: lerp(0.19, 0.074, Math.pow(v, 0.85)) });
  const hemY = (th) => lerp(0.806, 0.822, (Math.cos(th) + 1) / 2);
  const skirtPoint = (u, v, o, off = 0, pl = PLEATS) => {
    const th = PI + TAU * u, R = skirtR(v);
    const m = 1 + tri(u * pl) * (0.034 * (1 - v) + 0.006);
    const y = lerp(hemY(th), 1.004, v);
    return o.set((R.rx + off) * Math.sin(th) * m, y, ((Math.cos(th) >= 0 ? R.rzF : R.rzB) + off) * Math.cos(th) * m);
  };
  W(hips, 'print', surface((u, v, o) => skirtPoint(u, v, o), PLEATS * 4, 7, {
    uv: (u, v) => { const r = atlas.rect('skirt'); return [lerp(r[0], r[2], u), lerp(r[1], r[3], v)]; },
    sway: (u, v) => [0.01 * (1 - v) ** 2, u * TAU * 2],
  }), { outline: 0.9 });
  W(hips, 'solid', surface((u, v, o) => {
    skirtPoint(u, lerp(0.0, 0.3, v), o, -0.006);
    o.y = lerp(0.793, 0.86, v);
  }, PLEATS * 4, 3, {
    color: (u, v, p, c) => c.set(v < 0.34 ? C.white : C.lav),
    sway: (u, v) => [0.01 * (1 - v) ** 2, u * TAU * 2],
  }), { outline: 0.35 });
  // belt
  const beltR = (v, R) => { R.y = lerp(0.99, 1.024, v); R.rx = 0.106; R.rzF = 0.073; R.rzB = 0.079; R.zc = 0; };
  W(hips, 'solid', loft(beltR, 36, 2, { color: (u, v, p, c) => c.set(v === 0 || v === 1 ? C.pinkPale : C.pink) }));
  for (const th of [-0.9, -0.55, -0.2, 0.62, 0.95, 1.3, -1.3]) {
    W(hips, 'solid', heartGeo(0.0055, 0.003), { pos: [Math.sin(th) * 0.111, 1.007, Math.cos(th) * 0.077], rot: [0, th, 0], color: C.pinkPale, outline: 0 });
  }
  W(hips, 'solid', heartGeo(0.02, 0.008), { pos: [0.034, 1.006, 0.076], rot: [0, 0.3, 0], color: C.gold, outline: 0.6 });
  W(hips, 'solid', heartGeo(0.013, 0.006), { pos: [0.0355, 1.0065, 0.081], rot: [0, 0.3, 0], color: C.pink, outline: 0 });
  { // gold chain: links along a drooping curve + a dangling heart charm
    const chain = (pts, n) => {
      const c = new THREE.CatmullRomCurve3(pts);
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n, p = c.getPointAt(t), tg = c.getTangentAt(t);
        const link = new THREE.TorusGeometry(0.0058, 0.0015, 3, 8);
        link.rotateY(PI / 2);
        link.scale(1, 1, 1.35);
        const q = new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), tg);
        link.applyQuaternion(new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), i % 2 ? PI / 2 : 0).premultiply(q));
        link.translate(p.x, p.y, p.z);
        W(hips, 'solid', link, { color: C.gold, outline: 0 });
      }
    };
    chain([V(-0.095, 0.998, 0.058), V(-0.07, 0.955, 0.1), V(-0.02, 0.93, 0.118), V(0.02, 0.945, 0.112), V(0.05, 0.99, 0.086)], 20);
    chain([V(0.07, 0.994, 0.078), V(0.08, 0.95, 0.105), V(0.085, 0.905, 0.126)], 8);
    W(hips, 'solid', heartGeo(0.019, 0.007), { pos: [0.086, 0.884, 0.128], color: C.gold, outline: 0.6 });
    W(hips, 'solid', heartGeo(0.015, 0.008), { pos: [0.086, 0.8845, 0.1315], color: C.pink, outline: 0 });
  }
  // PEACHI straps hanging from the belt, swaying from the waist down
  for (const [th, len] of [[-0.78, 0.4], [2.35, 0.38]]) {
    const sx = Math.sin(th), cz = Math.cos(th);
    const topP = V(sx * 0.113, 1.0, cz * 0.082);
    const outDir = V(sx, 0, cz * 1.1).normalize();
    const path = (t, o) => { // leaves the belt, clears the skirt flare, then hangs straight
      const y = 1.0 - t * len;
      const out = 0.12 * smooth(0, 0.55, t) + 0.01;
      return o.copy(topP).addScaledVector(outDir, out).setY(y);
    };
    const side = V().crossVectors(V(0, 1, 0), outDir).normalize();
    const strap = surface((u, v, o) => {
      path(v, o); o.addScaledVector(side, (u - 0.5) * 0.036);
    }, 1, 12, {
      flip: true,
      uv: (u, v) => { const r = atlas.rect('strap'); return [lerp(r[0], r[2], u), lerp(r[3], r[1], v)]; },
      sway: (u, v) => [0.022 * Math.pow(v, 1.4), th * 3],
    });
    W(hips, 'print', strap, { outline: 0.6 });
    path(1, _p).addScaledVector(V(0, 1, 0), 0.012);
    const buckle = setSway(normalize(frameGeo(0.05, 0.036, 0.007, 0.005)), 0.022, th * 3);
    buckle.lookAt(outDir); buckle.translate(_p.x, _p.y, _p.z);
    W(hips, 'solid', tint(buckle, C.gold), { outline: 0.6 });
    const tip = setSway(normalize(new THREE.BoxGeometry(0.034, 0.016, 0.004)), 0.022, th * 3);
    tip.lookAt(outDir); tip.translate(_p.x, _p.y + 0.0, _p.z);
    W(hips, 'solid', tint(tip, C.white), { outline: 0 });
  }

  // =================================================================== legs + sneakers
  const legs = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(s * HIP_J.x, HIP_J.y - HIPS_O.y, HIP_J.z); hips.add(hip);
    const knee = new THREE.Group(); knee.position.y = -THIGH; hip.add(knee);
    const ankle = new THREE.Group(); ankle.position.y = -SHIN; knee.add(ankle);
    const sockLeg = s < 0; // her right leg wears the "249 PEACH" thigh-high
    const thighR = (y) => tableLerp([{ k: -0.37, rx: 0.043, rz: 0.044 }, { k: -0.3, rx: 0.046, rz: 0.047 }, { k: -0.2, rx: 0.053, rz: 0.055 }, { k: -0.08, rx: 0.06, rz: 0.062 }, { k: 0.06, rx: 0.064, rz: 0.066 }], y);
    const thighPt = (u, y, off, o) => { const th = PI + TAU * u, R = thighR(y); return o.set((R.rx + off) * Math.sin(th) + s * 0.004 * smooth(-0.16, 0, y), y, (R.rz + off) * Math.cos(th) + 0.004); };
    L(hip, 'skin', surface((u, v, o) => thighPt(u, lerp(-0.37, 0.06, v), 0, o), 20, 12), { color: C.skin });
    L(knee, 'skin', ellipsoid(0.042, 0.045, 0.043, 14, 10), { pos: [0, 0.005, 0.002], color: C.skin, outline: 0.6 });
    const shinR = (y) => tableLerp([{ k: -0.42, rx: 0.026, zf: 0.027, zb: 0.028 }, { k: -0.33, rx: 0.029, zf: 0.03, zb: 0.032 }, { k: -0.2, rx: 0.037, zf: 0.036, zb: 0.045 }, { k: -0.1, rx: 0.041, zf: 0.038, zb: 0.049 }, { k: 0.0, rx: 0.041, zf: 0.041, zb: 0.042 }, { k: 0.03, rx: 0.04, zf: 0.04, zb: 0.04 }], y);
    const shinPt = (u, y, off, o) => { const th = PI + TAU * u, R = shinR(y), c = Math.cos(th); return o.set((R.rx + off) * Math.sin(th), y, ((c > 0 ? R.zf : R.zb) + off) * c); };
    L(knee, 'skin', surface((u, v, o) => shinPt(u, lerp(-0.42, 0.03, v), 0, o), 18, 12), { color: C.skin });
    if (sockLeg) {
      const sr = atlas.rect('sock'), total = 0.19 + 0.325;
      const uvS = (u, dist) => [lerp(sr[0], sr[2], u), lerp(sr[3], sr[1], dist / total)];
      L(hip, 'holo', surface((u, v, o) => thighPt(u, lerp(-0.365, -0.175, v), 0.0045, o), 22, 8, { uv: (u, v) => uvS(u, (1 - v) * 0.19), color: C.white }));
      L(knee, 'holo', surface((u, v, o) => shinPt(u, lerp(-0.3, 0.025, v), 0.0045, o), 22, 10, { uv: (u, v) => uvS(u, 0.19 + (1 - v) * 0.325), color: C.white }));
      holoL(knee, ellipsoid(0.047, 0.048, 0.048, 14, 10), { pos: [0, 0.005, 0.002], color: C.white, outline: 0.4 });
    }
    // garter: black band, gold heart buckle, pink heart (+ a dangling heart on her left leg)
    const gy = -0.176, gOff = sockLeg ? 0.01 : 0.004;
    L(hip, 'solid', surface((u, v, o) => thighPt(u, lerp(gy - 0.011, gy + 0.011, v), gOff, o), 22, 2), { color: C.ink, outline: 0.7 });
    const hth = s * 0.3;
    thighPt(0.5 + hth / TAU, gy, gOff + 0.004, _p);
    L(hip, 'solid', heartGeo(0.0125, 0.006), { pos: _p.toArray(), rot: [0, hth, 0], color: C.gold, outline: 0.5 });
    L(hip, 'solid', heartGeo(0.0085, 0.006), { pos: [_p.x + Math.sin(hth) * 0.003, _p.y + 0.0005, _p.z + Math.cos(hth) * 0.003], rot: [0, hth, 0], color: C.pink, outline: 0 });
    if (!sockLeg) {
      L(hip, 'solid', sphere(0.0022, 6), { pos: [_p.x, _p.y - 0.017, _p.z + 0.002], color: C.gold, outline: 0 });
      L(hip, 'solid', heartGeo(0.0095, 0.006), { pos: [_p.x, _p.y - 0.03, _p.z + 0.003], rot: [0, hth, 0], color: C.pink, outline: 0.5 });
    }
    // black ankle sock with a rolled cuff
    const sockTop = sockLeg ? -0.285 : -0.26;
    L(knee, 'solid', surface((u, v, o) => shinPt(u, lerp(-0.42, sockTop, v), 0.004, o), 18, 4), { color: C.sock });
    const cuff = new THREE.TorusGeometry(1, 0.2, 6, 20); cuff.rotateX(PI / 2);
    const cr = shinR(sockTop);
    L(knee, 'solid', cuff, { pos: [0, sockTop, 0.001], scale: [cr.rx + 0.006, 0.02, (cr.zf + cr.zb) / 2 + 0.006], color: C.sock, outline: 0.6 });

    // ---- chunky high-top sneaker (ankle-local; floor at y = -0.095 when standing)
    const shoe = ankle;
    const foot = roundedPoly([[-0.046, -0.088], [0.046, -0.088], [0.056, 0.02], [0.054, 0.118], [0.034, 0.162], [-0.034, 0.162], [-0.054, 0.118], [-0.058, 0.02]].map(([x, z]) => [x, -z]), 0.026);
    const slab = (y0, y1, grow, color) => {
      const g = extrude(foot, y1 - y0, Math.min(0.004, (y1 - y0) * 0.3), { curveSegments: 3 });
      g.rotateX(-PI / 2); g.scale(1 + grow, 1, 1 + grow * 0.6); g.translate(0, (y0 + y1) / 2, 0.005);
      L(shoe, 'solid', g, { color, outline: 0.8 });
    };
    slab(-0.095, -0.087, 0.02, C.coral);
    slab(-0.088, -0.056, 0.0, C.white);
    slab(-0.079, -0.07, 0.035, C.coral);
    L(shoe, 'solid', ellipsoid(0.052, 0.048, 0.088, 18, 10, { v1: 0.5 }), { pos: [0, -0.058, 0.072], color: C.white });
    L(shoe, 'solid', ellipsoid(0.053, 0.022, 0.052, 16, 6, { v1: 0.5 }), { pos: [0, -0.057, 0.112], scale: [1.01, 1, 1], color: C.coral, outline: 0.5 });
    const shaftR = (v, R) => { R.y = lerp(-0.058, 0.08, v); R.rx = lerp(0.056, 0.047, v); R.rzF = lerp(0.07, 0.043, smooth(0, 0.5, v)); R.rzB = lerp(0.084, 0.046, smooth(0, 0.6, v)); R.zc = lerp(0.012, -0.004, v); };
    L(shoe, 'solid', loft(shaftR, 24, 8, { color: (u, v, p, c) => c.set(C.white) }));
    for (const k of [-1, 1]) { // coral side panels
      L(shoe, 'solid', loft(shaftR, 4, 3, { a0: k > 0 ? 0.08 : 0.72, a1: k > 0 ? 0.28 : 0.92, post: (u, v, th, o) => { o.x *= 1.03; o.z *= 1.03; } }), { color: C.coral, outline: 0.5 });
    }
    // tongue, laces, crown charm, tag
    const tongue = new THREE.CatmullRomCurve3([V(0, -0.045, 0.1), V(0, 0.0, 0.07), V(0, 0.05, 0.05), V(0, 0.1, 0.038)]);
    L(shoe, 'solid', clump(tongue, { width: () => 0.021, thick: () => 0.004, outward: () => V(0, 0.3, 1), nu: 8, nv: 8, curl: 0.12 }), { color: C.ink, outline: 0.6 });
    for (let k = 0; k < 4; k++) {
      const t0 = 0.12 + k * 0.2, t1 = t0 + 0.2;
      const a = tongue.getPointAt(t0), b = tongue.getPointAt(Math.min(1, t1));
      for (const d of [-1, 1]) {
        const lace = new THREE.CatmullRomCurve3([V(d * 0.024, a.y, a.z + 0.004), V(0, (a.y + b.y) / 2, (a.z + b.z) / 2 + 0.008), V(-d * 0.024, b.y, b.z + 0.004)]);
        L(shoe, 'solid', new THREE.TubeGeometry(lace, 6, 0.0022, 4), { color: C.gold, outline: 0 });
      }
    }
    L(shoe, 'solid', heartGeo(0.009, 0.004), { pos: [0, 0.066, 0.054], rot: [-0.3, 0, 0], color: C.gold, outline: 0.5 });
    const tag = atlasUV(new THREE.BoxGeometry(0.028, 0.028, 0.003), atlas.rect('tag'));
    L(shoe, 'print', tag, { pos: [0, 0.098, 0.047], rot: [-0.25, 0, 0], outline: 0.4 });
    // padded collar, ankle strap with buckle + dangling tag, heel tab
    const col = new THREE.TorusGeometry(1, 0.16, 6, 22); col.rotateX(PI / 2);
    L(shoe, 'solid', col, { pos: [0, 0.08, -0.004], scale: [0.046, 0.05, 0.047], color: C.lav, outline: 0.8 });
    L(shoe, 'solid', loft((v, R) => { shaftR(lerp(0.66, 0.84, v), R); R.rx += 0.004; R.rzF += 0.004; R.rzB += 0.004; }, 24, 2), { color: C.white, outline: 0.7 });
    L(shoe, 'solid', frameGeo(0.02, 0.024, 0.004, 0.004), { pos: [s * 0.05, 0.043, 0.0], rot: [0, s * PI / 2, 0], color: C.gold, outline: 0.5 });
    L(shoe, 'solid', new THREE.TorusGeometry(0.006, 0.0016, 4, 10), { pos: [s * 0.051, 0.022, -0.012], rot: [0, s * PI / 2, 0], color: C.gold, outline: 0 });
    L(shoe, 'solid', extrude(roundedPoly([[-0.008, 0], [0.008, 0], [0.012, -0.034], [-0.004, -0.034]], 0.003), 0.003, 0.001), { pos: [s * 0.052, 0.016, -0.016], rot: [0.2, s * PI / 2, s * 0.35], color: C.coral, outline: 0.5 });
    L(shoe, 'solid', new THREE.BoxGeometry(0.018, 0.03, 0.008), { pos: [0, 0.085, -0.05], rot: [-0.2, 0, 0], color: C.coral, outline: 0.5 });
    L(shoe, 'solid', ellipsoid(0.02, 0.018, 0.006, 10, 6), { pos: [0, -0.03, -0.086], color: C.ink, outline: 0.4 });
    L(shoe, 'solid', heartGeo(0.0075, 0.003), { pos: [0, -0.03, -0.092], rot: [0, PI, 0], color: C.pink, outline: 0 });
    legs.push({ hip, knee, ankle, side: s });
  }

  // =================================================================== finalize
  bin.build(M, outline);
  const angerTex = makeAngerMarkTexture();
  const anger = new THREE.Sprite(new THREE.SpriteMaterial({ map: angerTex, transparent: true, depthWrite: false }));
  anger.position.copy(HC).sub(HEAD_O).add(V(0.068, 0.07, 0.07));
  anger.scale.setScalar(0.06); anger.visible = false; head.add(anger);
  const faceAnchor = new THREE.Object3D(); faceAnchor.name = 'faceAnchor';
  faceAnchor.position.set(0, FACE_HEIGHT - HEAD_O.y, 0.08 - HEAD_O.z); head.add(faceAnchor);

  const animator = createAnimator({ root, hips, torso, head, arms, legs }, { ghost, U });
  const _s = V();
  let glow = 0;

  const model = {
    group,
    faceHeight: FACE_HEIGHT,
    faceAnchor, // Object3D at the center of her face (follows head/lean/lunge): faceAnchor.getWorldPosition(v)
    get expression() { return face.expression; },
    get pose() { return animator.pose; },
    setExpression(name) {
      face.setExpression(name);
      animator.setMood(face.expression);
      anger.visible = face.expression === 'angry';
    },
    setPose(name) { animator.setPose(name); },
    setGlow(v) { glow = THREE.MathUtils.clamp(v, 0, 1); U.uGlow.value = glow; },
    update(dt, t) {
      animator.update(dt, t);
      face.update(dt, t);
      const he = head.matrixWorld.elements; // head frame for the face shading (one frame behind is fine)
      U.uHeadUp.value.set(he[4], he[5], he[6]).normalize();
      U.uHeadFwd.value.set(he[8], he[9], he[10]).normalize();
      U.uTime.value = t;
      U.uBaseY.value = group.matrixWorld.elements[13];
      _s.setFromMatrixScale(group.matrixWorld);
      U.uFade.value.set(0.05 * _s.y, 0.55 * _s.y);
      if (anger.visible) anger.scale.setScalar(0.06 * (1 + 0.14 * Math.max(0, Math.sin(t * 9))));
    },
    dispose() {
      group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
      Object.values(M).forEach((m) => m.dispose()); outline.dispose();
      atlas.dispose(); face.dispose(); faceSDF.dispose(); angerTex.dispose(); anger.material.dispose();
    },
  };
  model.setExpression('happy');
  return model;
}

// =====================================================================================
// Pickup item: the glowing cat-ear headphones (~0.3 m). group.position is left to the caller;
// the inner part spins/bobs via group.userData.update(dt, t).
export function buildHeadphonesItem() {
  const U = createUniforms(false);
  U.uSelfLit.value = 0.45;
  U.uGlow.value = 0.15;
  const atlas = createAtlas();
  const M = {
    solid: toonMaterial(U, { vertexColors: true }),
    print: toonMaterial(U, { vertexColors: true, map: atlas.texture, alphaTest: 0.5, side: THREE.DoubleSide }),
    led: toonMaterial(U, { vertexColors: true, emissive: 0xff9ad0, emissiveIntensity: 1.1 }, { rim: false }),
  };
  const outline = outlineMaterial(U, { px: 1.4 });
  const group = new THREE.Group(); group.name = 'HeadphonesItem';
  const inner = new THREE.Group(); inner.position.y = 0.2; group.add(inner);
  const phones = new THREE.Group(); phones.scale.setScalar(1.35); phones.rotation.x = -0.25; inner.add(phones);
  const bin = new PartBin();
  buildHeadphones((key, g, opts) => bin.add(phones, key, g, opts), atlas);
  bin.build(M, outline);
  const haloTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,140,200,0.9)'); g.addColorStop(0.4, 'rgba(255,110,180,0.35)'); g.addColorStop(1, 'rgba(255,110,180,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  sprite.scale.setScalar(0.6); inner.add(sprite);
  group.userData.update = (dt, t) => {
    inner.rotation.y += dt * 1.2;
    inner.position.y = 0.2 + Math.sin(t * 2.2) * 0.03;
    sprite.material.opacity = 0.7 + 0.3 * Math.sin(t * 3.1);
    U.uTime.value = t;
  };
  group.userData.dispose = () => {
    group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    Object.values(M).forEach((m) => m.dispose()); outline.dispose();
    atlas.dispose(); haloTex.dispose(); sprite.material.dispose();
  };
  return group;
}
