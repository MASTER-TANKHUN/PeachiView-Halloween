// Procedural low-poly chibi "Peachi" (ghost VTuber) built from Three.js primitives only.
// Contract: see docs/ARCHITECTURE.md (buildPeachi / buildHeadphonesItem).
import * as THREE from 'three';
import { createFace, makeAngerMarkTexture } from './face.js';
import { createAnimator } from './anim.js';

// ---------- palette (sampled from the reference sheet) ----------
const C = {
  skin: 0xf6d3c0, pink: 0xff7eb6, pinkDeep: 0xf0508f, pinkPale: 0xffd0e2, white: 0xfbf6fb,
  lavender: 0xe9e0ff, black: 0x1b1b2e, dark: 0x2b2340, gold: 0xe9b949, earInner: 0xf1e6ff,
};
const HAIR = [new THREE.Color(0x3a1d17), new THREE.Color(0x5a2a22), new THREE.Color(0x7a3a2a), new THREE.Color(0xe0709a), new THREE.Color(0xf7a3c2)];

// ---------- layout (meters, absolute heights from the floor with hover = 0) ----------
const HIP_Y = 0.60, NECK_Y = 0.98, SH_X = 0.128, SH_Y = 0.895, LEG_X = 0.058, LEG_Y = 0.56;
const HEAD_C = 0.21, HEAD_R = 0.235, HEAD_S = [1.06, 0.96, 1.0];
// face patch on the head sphere (UV 0..1 == face canvas)
const FACE = { phiStart: Math.PI / 2 - 0.8, phiLength: 1.6, thetaStart: 0.36 * Math.PI, thetaLength: 0.44 * Math.PI };

// ---------- small helpers ----------
const TAU = Math.PI * 2;
const _c = new THREE.Color();

function mesh(geo, mat, parent, [x = 0, y = 0, z = 0] = [], [rx = 0, ry = 0, rz = 0] = [], s) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
  if (s !== undefined) Array.isArray(s) ? m.scale.set(...s) : m.scale.setScalar(s);
  parent.add(m);
  return m;
}

function paint(geo, fn) {
  const p = geo.attributes.position, col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    fn(_c, p.getX(i), p.getY(i), p.getZ(i), i);
    col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

// holographic pastel: cyan -> lavender -> pink, varying by position
function holo(c, x, y, z) {
  const h = 0.74 + 0.2 * Math.sin(x * 31 + y * 17 + z * 23) + 0.06 * Math.sin(y * 57 - x * 11);
  return c.setHSL(((h % 1) + 1) % 1, 0.62, 0.86, THREE.SRGBColorSpace);
}

function hairColor(c, t) { // t: 0 = root, 1 = tip
  if (t < 0.35) return c.copy(HAIR[0]).lerp(HAIR[1], t / 0.35);
  if (t < 0.6) return c.copy(HAIR[1]).lerp(HAIR[2], (t - 0.35) / 0.25);
  if (t < 0.85) return c.copy(HAIR[2]).lerp(HAIR[3], (t - 0.6) / 0.25);
  return c.copy(HAIR[3]).lerp(HAIR[4], (t - 0.85) / 0.15);
}

function heartGeo(s, depth = 0.35) {
  const h = new THREE.Shape();
  h.moveTo(0, -s * 0.9);
  h.bezierCurveTo(-s * 0.2, -s * 0.55, -s, -s * 0.25, -s, s * 0.25);
  h.bezierCurveTo(-s, s * 0.8, -s * 0.25, s * 0.9, 0, s * 0.45);
  h.bezierCurveTo(s * 0.25, s * 0.9, s, s * 0.8, s, s * 0.25);
  h.bezierCurveTo(s, -s * 0.25, s * 0.2, -s * 0.55, 0, -s * 0.9);
  const g = new THREE.ExtrudeGeometry(h, { depth: s * depth, bevelEnabled: false, curveSegments: 3 });
  g.translate(0, 0, -s * depth / 2);
  return g;
}

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

function drawPeach(ctx, cx, cy, r, { outline = false } = {}) {
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.2, r * 0.1, cx, cy, r);
  g.addColorStop(0, '#ffd2e2'); g.addColorStop(0.6, '#ff8fbd'); g.addColorStop(1, '#f0508f');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx - r * 0.2, cy + r * 0.08, r * 0.8, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + r * 0.2, cy + r * 0.08, r * 0.8, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#d23a78'; ctx.lineWidth = r * 0.09; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx, cy - r * 0.6); ctx.quadraticCurveTo(cx - r * 0.3, cy, cx - r * 0.05, cy + r * 0.6); ctx.stroke();
  if (outline) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = r * 0.12; ctx.beginPath(); ctx.arc(cx - r * 0.2, cy + r * 0.08, r * 0.8, 0.9, 5.2); ctx.stroke(); }
  ctx.fillStyle = '#6cc070';
  ctx.beginPath(); ctx.ellipse(cx + r * 0.3, cy - r * 0.72, r * 0.32, r * 0.14, -0.5, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#7a4a2a'; ctx.lineWidth = r * 0.08;
  ctx.beginPath(); ctx.moveTo(cx, cy - r * 0.62); ctx.lineTo(cx + r * 0.05, cy - r * 0.9); ctx.stroke();
}

// ---------- textures ----------
function makeTextures() {
  const logo = canvasTex(256, 256, (ctx) => {
    ctx.fillStyle = '#fbf6fb'; ctx.fillRect(0, 0, 256, 256);
    drawPeach(ctx, 128, 136, 78);
  });
  const crop = canvasTex(1024, 256, (ctx, w, h) => {
    ctx.fillStyle = '#fbf6fb'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ff7eb6'; ctx.fillRect(0, h - 34, w, 34);
    ctx.fillStyle = '#ffc3da'; ctx.fillRect(0, h - 40, w, 6);
    drawPeach(ctx, 512, 92, 54);
    ctx.fillStyle = '#ff5f9e'; ctx.font = 'bold 46px Kanit, Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('PEACHI', 512, 180);
    // thin pink straps going up
    ctx.fillStyle = '#ff7eb6'; ctx.fillRect(512 - 150, 0, 14, 60); ctx.fillRect(512 + 136, 0, 14, 60);
  });
  const skirt = canvasTex(64, 256, (ctx, w, h) => {
    ctx.fillStyle = '#1b1b2e'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#2a2a46'; for (let x = 0; x < w; x += 16) ctx.fillRect(x, 0, 3, h); // pleat shading
    ctx.fillStyle = '#ff7eb6'; for (const y of [70, 110, 146, 178]) ctx.fillRect(0, y, w, 4);
    ctx.fillStyle = '#ff7eb6'; ctx.fillRect(0, 200, w, 14);
    ctx.fillStyle = '#fbf6fb'; ctx.fillRect(0, 214, w, 42);
    ctx.fillStyle = '#d9d3e6'; for (let x = 8; x < w; x += 16) ctx.fillRect(x, 214, 3, 42);
  });
  const strap = canvasTex(64, 384, (ctx, w, h) => {
    ctx.fillStyle = '#ff7eb6'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(4, 0, 3, h); ctx.fillRect(w - 7, 0, 3, h);
    ctx.save(); ctx.translate(w / 2, h * 0.45); ctx.rotate(Math.PI / 2);
    ctx.font = 'bold 40px Kanit, Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('PEACHI', 0, 0); ctx.restore();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4;
    ctx.save(); ctx.translate(w / 2, h * 0.85); ctx.beginPath(); ctx.arc(-6, 0, 11, 0, TAU); ctx.arc(6, 0, 11, 0, TAU); ctx.stroke(); ctx.restore();
  });
  const sock = canvasTex(512, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#f4f0ff'); g.addColorStop(0.3, '#fff3fa'); g.addColorStop(0.55, '#eaf8ff'); g.addColorStop(0.8, '#f6ecff'); g.addColorStop(1, '#fff0f7');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ffc3da'; ctx.fillRect(0, 0, w, 20);
    const cx = 236;
    ctx.fillStyle = '#ff5f9e'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = 'bold 76px Kanit, Arial, sans-serif'; ctx.fillText('249', cx, 82);
    ctx.font = 'bold 40px Kanit, Arial, sans-serif'; ctx.fillText('PEACH', cx, 138);
    ctx.fillStyle = '#1b1b2e';
    let x = cx - 70; let seed = 7;
    while (x < cx + 70) { seed = (seed * 9301 + 49297) % 233280; const bw = 2 + (seed % 5); ctx.fillRect(x, 166, bw, 38); x += bw + 2 + (seed % 3); }
  });
  return { logo, crop, skirt, strap, sock };
}

// ---------- ghost shader (fade toward floor + pink fresnel rim + translucency) ----------
function makeGhostUniforms(ghost) {
  return {
    uGhost: { value: ghost ? 1 : 0 },
    uGlow: { value: 0 },
    uBaseY: { value: 0 },
    uFade: { value: new THREE.Vector2(0.04, 0.62) }, // world-height range (relative to model origin) of the leg fade
    uOpacity: { value: 0.84 },
    uTime: { value: 0 },
    uGlowColor: { value: new THREE.Color(0xff5fa8) },
  };
}

function ghostify(mat, U, ghost, rim = true) {
  mat.transparent = ghost || mat.transparent;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGWorld;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvGWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vGWorld;
        uniform float uGhost, uGlow, uBaseY, uOpacity, uTime;
        uniform vec2 uFade;
        uniform vec3 uGlowColor;`)
      .replace('#include <opaque_fragment>', `#include <opaque_fragment>
        {
          float gh = vGWorld.y - uBaseY;
          float fade = mix(1.0, smoothstep(uFade.x, uFade.y, gh), uGhost);
          ${rim ? `
          float gF = pow(1.0 - clamp(abs(dot(normalize(normal), normalize(vViewPosition))), 0.0, 1.0), 2.2);
          float flick = 0.85 + 0.15 * sin(uTime * 3.0 + vGWorld.y * 9.0);
          gl_FragColor.rgb += uGlowColor * gF * (0.45 * uGhost * flick + 2.2 * uGlow);` : ''}
          gl_FragColor.rgb += uGlowColor * uGlow * 0.10;
          gl_FragColor.a *= fade * mix(1.0, uOpacity, uGhost);
        }`);
  };
  mat.customProgramCacheKey = () => 'peachi-ghost-' + (rim ? 1 : 0);
  return mat;
}

// ---------- headphones (shared by the model and the pickup item) ----------
function makeHeadphones(M) {
  const g = new THREE.Group(); g.name = 'headphones';
  const R = 0.265;
  const band = mesh(new THREE.TorusGeometry(R, 0.019, 5, 16, Math.PI), M.pink, g, [0, 0, 0], [0, 0, 0], [1, 0.93, 1]);
  band.name = 'band';
  mesh(new THREE.TorusGeometry(R - 0.018, 0.012, 4, 16, Math.PI), M.white, g, [0, 0, 0], [0, 0, 0], [1, 0.93, 1]);
  for (const s of [-1, 1]) {
    // ear cups: white oval with pink rim + peach logo
    mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.06, 14), M.white, g, [s * 0.287, -0.005, 0], [0, 0, Math.PI / 2], [1.15, 1, 0.95]);
    mesh(new THREE.CylinderGeometry(0.068, 0.068, 0.03, 12), M.pink, g, [s * 0.252, -0.005, 0], [0, 0, Math.PI / 2], [1.15, 1, 0.95]);
    mesh(new THREE.TorusGeometry(0.078, 0.011, 4, 14), M.pink, g, [s * 0.317, -0.005, 0], [0, Math.PI / 2, 0], [0.95, 1.15, 1]);
    mesh(new THREE.CircleGeometry(0.066, 14), M.logo, g, [s * 0.3185, -0.005, 0], [0, s * Math.PI / 2, 0], [0.95, 1.15, 1]);
    // cat ears on the band
    const a = 0.62, px = s * R * Math.sin(a), py = R * 0.93 * Math.cos(a);
    const ear = new THREE.Group(); ear.position.set(px, py, 0); ear.rotation.z = -s * a * 0.8; g.add(ear);
    const outer = new THREE.ConeGeometry(0.078, 0.14, 4, 1); outer.rotateY(Math.PI / 4);
    mesh(outer, M.pink, ear, [0, 0.06, 0], [0, 0, 0], [1, 1, 0.45]);
    const inner = new THREE.ConeGeometry(0.052, 0.1, 3, 1);
    mesh(inner, M.earInner, ear, [0, 0.05, 0.022], [0, 0, 0], [1, 1, 0.25]);
  }
  return g;
}

// ---------- hair strand ----------
function strandGeo(len, w, { depth = 0.42, waves = 2.3, amp = 0.028, phase = 0, colorStart = 0 } = {}) {
  const g = new THREE.CylinderGeometry(w, w * 0.25, len, 5, 7, false);
  g.translate(0, -len / 2, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const t = -y / len;
    z *= depth;
    x += Math.sin(t * Math.PI * waves + phase) * amp * (0.3 + t);
    z += Math.cos(t * Math.PI * waves * 0.8 + phase) * amp * 0.5 * t;
    p.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  return paint(g, (c, x, y) => hairColor(c, colorStart + (1 - colorStart) * Math.min(1, -y / len)));
}

// =====================================================================
export function buildPeachi({ ghost = true } = {}) {
  const U = makeGhostUniforms(ghost);
  const T = makeTextures();
  const face = createFace();
  const mats = [];
  const std = (o, rim = true) => { const m = new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.75, ...o }); mats.push(ghostify(m, U, ghost, rim)); return m; };
  const phys = (o) => { const m = new THREE.MeshPhysicalMaterial({ flatShading: true, ...o }); mats.push(ghostify(m, U, ghost)); return m; };

  const M = {
    skin: std({ color: C.skin }),
    hair: std({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide }),
    white: std({ color: C.white }),
    pink: std({ color: C.pink, roughness: 0.5 }),
    pinkDeep: std({ color: C.pinkDeep, roughness: 0.5 }),
    black: std({ color: C.black, roughness: 0.6 }),
    dark: std({ color: C.dark }),
    gold: std({ color: C.gold, metalness: 0.85, roughness: 0.3, emissive: 0x3a2a05 }),
    earInner: std({ color: C.earInner }),
    logo: std({ map: T.logo, flatShading: false, roughness: 0.5 }),
    crop: std({ map: T.crop, flatShading: false }),
    skirt: std({ map: T.skirt, side: THREE.DoubleSide, roughness: 0.55 }),
    strap: std({ map: T.strap, roughness: 0.5 }),
    lining: std({ color: C.pink, side: THREE.BackSide }),
    jacket: phys({ vertexColors: true, roughness: 0.28, metalness: 0.15, iridescence: 1, iridescenceIOR: 1.35, iridescenceThicknessRange: [180, 620], clearcoat: 0.4, sheen: 0.4, sheenColor: new THREE.Color(0xffb0d8), side: THREE.FrontSide }),
    sock: phys({ map: T.sock, flatShading: false, roughness: 0.3, iridescence: 0.8, iridescenceIOR: 1.3, iridescenceThicknessRange: [200, 500] }),
    sockPlain: phys({ color: 0xf6f2ff, roughness: 0.3, iridescence: 0.8, iridescenceIOR: 1.3, iridescenceThicknessRange: [200, 500] }),
  };
  const faceMat = new THREE.MeshStandardMaterial({ map: face.texture, emissiveMap: face.texture, emissive: 0xffffff, emissiveIntensity: 0.3, transparent: true, depthWrite: false, roughness: 0.8 });
  mats.push(ghostify(faceMat, U, ghost));

  const group = new THREE.Group(); group.name = 'Peachi';
  const root = new THREE.Group(); group.add(root);
  const hips = new THREE.Group(); hips.position.y = HIP_Y; root.add(hips);
  const torso = new THREE.Group(); torso.position.y = HIP_Y; root.add(torso);
  const ty = (y) => y - HIP_Y; // absolute -> torso/hips local

  // ---------------- torso ----------------
  const body = new THREE.Group(); body.scale.z = 0.8; torso.add(body);
  mesh(new THREE.CylinderGeometry(0.083, 0.096, 0.18, 8), M.skin, body, [0, ty(0.70), 0]);                  // midriff
  const crop = new THREE.CylinderGeometry(0.1, 0.09, 0.15, 14, 1, false, Math.PI); mesh(crop, M.crop, body, [0, ty(0.853), 0]);
  mesh(new THREE.CylinderGeometry(0.058, 0.1, 0.04, 10), M.skin, body, [0, ty(0.947), 0]);                  // bare shoulders/chest
  mesh(new THREE.CylinderGeometry(0.034, 0.038, 0.09, 7), M.skin, torso, [0, ty(0.98), 0]);                 // neck
  // choker: black band + pink heart with gold ring
  mesh(new THREE.TorusGeometry(0.038, 0.009, 4, 12), M.black, torso, [0, ty(0.965), 0], [Math.PI / 2, 0, 0]);
  mesh(new THREE.TorusGeometry(0.007, 0.002, 3, 6), M.gold, torso, [0, ty(0.952), 0.043]);
  mesh(heartGeo(0.017), M.pink, torso, [0, ty(0.936), 0.045]);

  // ---------------- jacket (off-shoulder, short, holo, pink lining) ----------------
  const jacket = new THREE.Group(); jacket.scale.z = 0.86; torso.add(jacket);
  const gap = 2.3; // open front
  const jGeo = paint(new THREE.CylinderGeometry(0.152, 0.186, 0.25, 14, 3, true, gap / 2, TAU - gap), holo);
  mesh(jGeo, M.jacket, jacket, [0, ty(0.72), 0]);
  mesh(jGeo, M.lining, jacket, [0, ty(0.72), 0]);
  for (const s of [-1, 1]) { // pink front plackets
    const edge = new THREE.CylinderGeometry(0.157, 0.191, 0.25, 1, 1, true, s > 0 ? gap / 2 : TAU - gap / 2 - 0.16, 0.16);
    mesh(edge, M.pink, jacket, [0, ty(0.72), 0]);
  }
  const trimArc = (r, y, mat, tube = 0.012) => {
    const g = new THREE.TorusGeometry(r, tube, 4, 14, TAU - gap);
    g.rotateX(Math.PI / 2); g.rotateY(-(Math.PI / 2 + gap / 2));
    return mesh(g, mat, jacket, [0, ty(y), 0]);
  };
  trimArc(0.153, 0.845, M.pink, 0.016);   // collar
  trimArc(0.187, 0.597, M.white, 0.014);  // hem band
  for (let i = 0; i < 6; i++) { // gold studs on the hem (back half)
    const a = Math.PI + (i - 2.5) * 0.38;
    mesh(new THREE.OctahedronGeometry(0.008), M.gold, jacket, [Math.sin(a) * 0.2, ty(0.597), Math.cos(a) * 0.2]);
  }

  // ---------------- arms ----------------
  const arms = [];
  for (const s of [-1, 1]) {
    const shoulder = new THREE.Group(); shoulder.position.set(s * SH_X, ty(SH_Y), 0); torso.add(shoulder);
    mesh(new THREE.SphereGeometry(0.04, 7, 5), M.skin, shoulder);
    mesh(new THREE.CylinderGeometry(0.03, 0.026, 0.16, 7), M.skin, shoulder, [0, -0.08, 0]);
    // puffy upper sleeve with pink outer stripe
    const puff = paint(new THREE.SphereGeometry(0.066, 9, 6), (c, x, y, z) => (x * s > 0.045 && Math.abs(z) < 0.035 ? c.set(C.pink) : holo(c, x, y, z)));
    mesh(puff, M.jacket, shoulder, [0, -0.13, 0], [0, 0, 0], [1, 1.35, 1]);
    mesh(new THREE.TorusGeometry(0.064, 0.009, 3, 12), M.black, shoulder, [0, -0.1, 0], [Math.PI / 2, 0, 0]);
    mesh(new THREE.BoxGeometry(0.018, 0.022, 0.01), M.gold, shoulder, [s * 0.052, -0.1, 0.04], [0, s * 0.8, 0]);
    const elbow = new THREE.Group(); elbow.position.y = -0.16; shoulder.add(elbow);
    mesh(new THREE.CylinderGeometry(0.024, 0.021, 0.14, 6), M.skin, elbow, [0, -0.07, 0]);
    const low = paint(new THREE.CylinderGeometry(0.058, 0.074, 0.15, 10, 2, true), (c, x, y, z) => (x * s > 0.05 && Math.abs(z) < 0.03 ? c.set(C.pink) : holo(c, x, y, z)));
    mesh(low, M.jacket, elbow, [0, -0.065, 0]);
    mesh(low, M.lining, elbow, [0, -0.065, 0]);
    mesh(new THREE.TorusGeometry(0.072, 0.011, 3, 12), M.pinkDeep, elbow, [0, -0.128, 0], [Math.PI / 2, 0, 0]);
    mesh(new THREE.TorusGeometry(0.07, 0.008, 3, 12), M.dark, elbow, [0, -0.145, 0], [Math.PI / 2, 0, 0]);
    mesh(new THREE.SphereGeometry(0.034, 7, 5), M.skin, elbow, [0, -0.178, 0.004], [0, 0, 0], [0.8, 1.15, 0.6]);
    arms.push({ shoulder, elbow, side: s });
  }

  // ---------------- hips: shorts, skirt, belt, chain, straps ----------------
  mesh(new THREE.CylinderGeometry(0.094, 0.1, 0.1, 10), M.black, hips, [0, ty(0.575), 0]);
  const skirtGeo = new THREE.CylinderGeometry(0.1, 0.205, 0.17, 18, 2, true, Math.PI);
  { // pleats: push every other column outward, more toward the hem
    const p = skirtGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const ix = i % 19, row = Math.floor(i / 19); // 3 rows (top, mid, hem)
      if (ix % 2 === 1 && row > 0) { const k = 1 + 0.07 * row; p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); }
    }
  }
  mesh(skirtGeo, M.skirt, hips, [0, ty(0.545), 0]);
  mesh(new THREE.CylinderGeometry(0.104, 0.104, 0.028, 16, 1, true), M.pink, hips, [0, ty(0.628), 0]);        // belt
  for (let i = -2; i <= 2; i++) if (i) mesh(heartGeo(0.007), M.pinkPale ?? M.white, hips, [Math.sin(i * 0.35) * 0.106, ty(0.628), Math.cos(i * 0.35) * 0.106], [0, i * 0.35, 0]);
  mesh(heartGeo(0.02), M.gold, hips, [-0.012, ty(0.628), 0.108]);                                         // heart buckle
  const chain = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.098, 0.622, 0.035), new THREE.Vector3(-0.072, 0.586, 0.112), new THREE.Vector3(0, 0.566, 0.146),
    new THREE.Vector3(0.07, 0.58, 0.122), new THREE.Vector3(0.1, 0.615, 0.042),
  ].map((v) => v.setY(v.y - HIP_Y)));
  mesh(new THREE.TubeGeometry(chain, 14, 0.0045, 4), M.gold, hips);
  const drop = new THREE.CatmullRomCurve3([new THREE.Vector3(0.092, 0.6, 0.09), new THREE.Vector3(0.1, 0.57, 0.13)].map((v) => v.setY(v.y - HIP_Y)));
  mesh(new THREE.TubeGeometry(drop, 3, 0.004, 4), M.gold, hips);
  mesh(heartGeo(0.017), M.pink, hips, [0.101, ty(0.556), 0.138], [0, 0.6, 0]);

  const straps = [];
  for (const s of [-1, 1]) {
    const a = s * 1.95; // around the sides, slightly behind
    const orient = new THREE.Group(); orient.rotation.y = a; hips.add(orient);
    const seg1 = new THREE.Group(); seg1.position.set(0, ty(0.628), 0.108); seg1.rotation.x = -0.55; orient.add(seg1);
    mesh(new THREE.BoxGeometry(0.036, 0.19, 0.006), M.pink, seg1, [0, -0.095, 0.004]);
    const seg2 = new THREE.Group(); seg2.position.y = -0.19; seg2.rotation.x = 0.55; seg2.userData = { baseX: 0.55, phase: s * 1.7 }; seg1.add(seg2);
    mesh(new THREE.BoxGeometry(0.036, 0.22, 0.006), M.strap, seg2, [0, -0.11, 0.004]);
    mesh(new THREE.TorusGeometry(0.022, 0.005, 3, 4), M.gold, seg2, [0, -0.24, 0.004], [0, 0, Math.PI / 4]);
    straps.push(seg2);
  }

  // ---------------- legs ----------------
  const legs = [];
  for (const s of [-1, 1]) {
    const right = s < 0; // her right leg is at -X (she faces +Z)
    const hip = new THREE.Group(); hip.position.set(s * LEG_X, LEG_Y - HIP_Y, 0); hips.add(hip);
    mesh(new THREE.CylinderGeometry(0.052, 0.04, 0.23, 8), M.skin, hip, [0, -0.115, 0]);
    const knee = new THREE.Group(); knee.position.y = -0.23; hip.add(knee);
    mesh(new THREE.CylinderGeometry(0.039, 0.029, 0.215, 7), M.skin, knee, [0, -0.1075, 0]);
    if (right) { // white holographic thigh-high "249 PEACH"
      mesh(new THREE.CylinderGeometry(0.05, 0.043, 0.13, 12, 1, true, Math.PI), M.sock, hip, [0, -0.165, 0]);
      mesh(new THREE.CylinderGeometry(0.043, 0.033, 0.215, 8), M.sockPlain, knee, [0, -0.1075, 0]);
    }
    // garter: black band, gold buckle, pink heart
    const gr = right ? 0.051 : 0.049;
    mesh(new THREE.TorusGeometry(gr, 0.007, 3, 12), M.black, hip, [0, -0.12, 0], [Math.PI / 2, 0, 0]);
    mesh(heartGeo(0.011), M.gold, hip, [s * 0.015, -0.12, gr + 0.002]);
    mesh(heartGeo(0.011), M.pink, hip, [s * 0.015, -0.14, gr + 0.004]);
    // chunky high-top sneaker
    const shoe = new THREE.Group(); shoe.position.y = -0.215; knee.add(shoe);
    if (!right) mesh(new THREE.CylinderGeometry(0.033, 0.035, 0.045, 7), M.black, shoe, [0, 0.012, 0]);      // black ankle sock
    mesh(new THREE.CylinderGeometry(0.045, 0.048, 0.06, 8), M.white, shoe, [0, -0.03, -0.005]);                // high-top shaft
    mesh(new THREE.TorusGeometry(0.045, 0.008, 3, 10), M.pink, shoe, [0, 0.0, -0.005], [Math.PI / 2, 0, 0]);
    mesh(new THREE.SphereGeometry(0.058, 8, 5), M.white, shoe, [0, -0.072, 0.03], [0, 0, 0], [0.82, 0.62, 1.45]);
    mesh(new THREE.BoxGeometry(0.1, 0.034, 0.175), M.pinkDeep, shoe, [0, -0.098, 0.028]);                   // thick pink sole
    mesh(new THREE.BoxGeometry(0.102, 0.01, 0.177), M.white, shoe, [0, -0.08, 0.028]);
    mesh(new THREE.BoxGeometry(0.03, 0.045, 0.02), M.pink, shoe, [0, -0.04, -0.055]);                        // heel tab
    for (let i = 0; i < 3; i++) mesh(new THREE.BoxGeometry(0.05, 0.006, 0.008), M.gold, shoe, [0, -0.028 - i * 0.008, 0.052 + i * 0.022], [0.5, 0, 0]);
    legs.push({ hip, knee, side: s });
  }

  // ---------------- head ----------------
  const head = new THREE.Group(); head.position.y = ty(NECK_Y); torso.add(head);
  const hc = new THREE.Group(); hc.position.y = HEAD_C; head.add(hc);
  const skull = mesh(new THREE.SphereGeometry(HEAD_R, 14, 10), M.skin, hc, [0, 0, 0], [0, 0, 0], HEAD_S);
  const facePatch = mesh(new THREE.SphereGeometry(HEAD_R * 1.012, 12, 10, FACE.phiStart, FACE.phiLength, FACE.thetaStart, FACE.thetaLength), faceMat, skull);
  facePatch.renderOrder = 1;
  // hair cap (top + sides/back, leaves the face window open)
  const capR = HEAD_R * 1.065;
  const hairDark = (c, x, y) => hairColor(c, Math.max(0, 0.12 - y * 0.5));
  mesh(paint(new THREE.SphereGeometry(capR, 14, 4, 0, TAU, 0, 0.38 * Math.PI), hairDark), M.hair, skull);
  const win = 1.02;
  mesh(paint(new THREE.SphereGeometry(capR, 12, 5, Math.PI / 2 + win, TAU - 2 * win, 0.3 * Math.PI, 0.5 * Math.PI), hairDark), M.hair, skull);
  // straight bangs with a jagged fringe
  {
    const W = 12, H = 2, R = HEAD_R * 1.085, ps = Math.PI / 2 - 1.05, pl = 2.1, ts = 0.2 * Math.PI, tl = 0.31 * Math.PI;
    const g = new THREE.SphereGeometry(R, W, H, ps, pl, ts, tl);
    const p = g.attributes.position;
    for (let ix = 0; ix <= W; ix++) {
      const i = H * (W + 1) + ix;
      const edge = ix === 0 || ix === W;
      const th = ts + tl - (ix % 2 ? 0.075 * Math.PI : 0) - (edge ? -0.06 * Math.PI : 0) + (ix === 6 ? 0.03 * Math.PI : 0);
      const ph = ps + (ix / W) * pl;
      const r = R * (ix % 2 ? 1 : 0.985);
      p.setXYZ(i, -r * Math.cos(ph) * Math.sin(th), r * Math.cos(th), r * Math.sin(ph) * Math.sin(th));
    }
    g.computeVertexNormals();
    mesh(paint(g, hairDark), M.hair, skull);
  }
  // long wavy hair strands: [angleDeg, radius, y, length, halfWidth, yawDeg|null, tilt, colorStart]
  const hair = [];
  const strands = [
    [180, 0.2, 0.03, 0.8, 0.07, null, -0.12, 0], [158, 0.2, 0.03, 0.78, 0.068, null, -0.13, 0], [-158, 0.2, 0.03, 0.78, 0.068, null, -0.13, 0],
    [136, 0.2, 0.03, 0.74, 0.066, null, -0.14, 0], [-136, 0.2, 0.03, 0.74, 0.066, null, -0.14, 0],
    [118, 0.2, 0.02, 0.68, 0.058, null, -0.16, 0], [-118, 0.2, 0.02, 0.68, 0.058, null, -0.16, 0],
    [98, 0.2, 0.01, 0.56, 0.045, 60, -0.1, 0], [-98, 0.2, 0.01, 0.56, 0.045, -60, -0.1, 0],               // over the shoulders
    [66, 0.2, -0.02, 0.5, 0.042, 25, -0.18, 0.05], [-66, 0.2, -0.02, 0.5, 0.042, -25, -0.18, 0.05],    // front locks to the waist
    [46, 0.205, 0.0, 0.34, 0.034, 30, -0.05, 0.1], [-46, 0.205, 0.0, 0.34, 0.034, -30, -0.05, 0.1],     // face-framing
  ];
  strands.forEach(([deg, r, y, len, w, yaw, tilt, cs], i) => {
    const a = THREE.MathUtils.degToRad(deg);
    const orient = new THREE.Group();
    orient.position.set(Math.sin(a) * r * HEAD_S[0], y, Math.cos(a) * r);
    orient.rotation.y = yaw === null ? a : THREE.MathUtils.degToRad(yaw);
    hc.add(orient);
    const pivot = new THREE.Group(); pivot.rotation.x = tilt; pivot.userData = { baseX: tilt, phase: i * 1.37 }; orient.add(pivot);
    mesh(strandGeo(len, w, { phase: i * 0.9, colorStart: cs, amp: 0.022 + 0.01 * (i % 3) }), M.hair, pivot);
    hair.push(pivot);
  });
  // headphones
  const phones = makeHeadphones(M); phones.position.y = 0.005; hc.add(phones);
  // anger mark sprite (angry only)
  const angerTex = makeAngerMarkTexture();
  const anger = new THREE.Sprite(new THREE.SpriteMaterial({ map: angerTex, transparent: true, depthWrite: false }));
  anger.position.set(0.2, 0.2, 0.13); anger.scale.setScalar(0.11); anger.visible = false; hc.add(anger);

  // ---------------- animation / API ----------------
  const animator = createAnimator({ root, torso, head, arms, legs, hair, straps }, { ghost });
  const _s = new THREE.Vector3();
  let glow = 0;

  const model = {
    group,
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
      U.uTime.value = t;
      U.uBaseY.value = group.matrixWorld.elements[13];
      _s.setFromMatrixScale(group.matrixWorld);
      U.uFade.value.set(0.04 * _s.y, 0.62 * _s.y);
      if (anger.visible) anger.scale.setScalar(0.11 * (1 + 0.12 * Math.max(0, Math.sin(t * 9))));
    },
    dispose() {
      group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
      for (const m of mats) m.dispose();
      Object.values(T).forEach((t) => t.dispose());
      face.dispose(); angerTex.dispose(); anger.material.dispose();
    },
  };
  model.setExpression('happy');
  return model;
}

// =====================================================================
// Pickup item: glowing cat-ear headphones (~0.3 m). group.position is left to the caller;
// the inner part spins/bobs via group.userData.update(dt, t).
export function buildHeadphonesItem() {
  const T = makeTextures();
  const e = (color, o = {}) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.35, flatShading: true, roughness: 0.45, ...o });
  const M = {
    pink: e(C.pink), white: e(C.white, { emissiveIntensity: 0.2 }), earInner: e(C.earInner, { emissiveIntensity: 0.25 }),
    logo: new THREE.MeshStandardMaterial({ map: T.logo, emissiveMap: T.logo, emissive: 0xffffff, emissiveIntensity: 0.3, roughness: 0.5 }),
  };
  Object.entries(T).forEach(([k, t]) => { if (k !== 'logo') t.dispose(); });
  const group = new THREE.Group(); group.name = 'HeadphonesItem';
  const inner = new THREE.Group(); inner.position.y = 0.2; group.add(inner);
  const phones = makeHeadphones(M); phones.scale.setScalar(0.52); phones.position.y = -0.06; phones.rotation.x = -0.25; inner.add(phones);
  const halo = canvasTex(128, 128, (ctx) => {
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,140,200,0.9)'); g.addColorStop(0.4, 'rgba(255,110,180,0.35)'); g.addColorStop(1, 'rgba(255,110,180,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  });
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  sprite.scale.setScalar(0.6); inner.add(sprite);
  group.userData.update = (dt, t) => {
    inner.rotation.y += dt * 1.2;
    inner.position.y = 0.2 + Math.sin(t * 2.2) * 0.03;
    sprite.material.opacity = 0.7 + 0.3 * Math.sin(t * 3.1);
  };
  group.userData.dispose = () => {
    group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    Object.values(M).forEach((m) => m.dispose()); T.logo.dispose(); halo.dispose(); sprite.material.dispose();
  };
  return group;
}
