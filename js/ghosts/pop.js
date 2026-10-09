// Phi Pop (ผีปอบ, "the eating kind") — Night 3's guest: a skinny old man in a checked pha khao ma, pot belly,
// huge mouth. He walks (1.2 m/s) and is always hungry (0–100): he eats the snacks off the kitchen rack one
// by one (the chalkboard above it counts them down, and you can hear him chewing through the walls). When
// the snacks run out and he's starving, he hunts you — and a closed door only slows him down: three blows
// and it's gone. Red soda at the spirit house calms him for 90 s (he burps; the second choker piece comes
// out). A snack from your hand buys time; a scream stuns him for 2 s; the flashlight does nothing.
import * as THREE from 'three';
import { sfx } from '../audio.js';
import { UI } from '../ui.js';
import { Talk } from '../game/talk.js';
import { panFor } from '../systems/doors.js';
import { nearestRoom, buildRoute, roomsLinked } from './nav.js';
import { DIFF } from '../game/difficulty.js';

const TAU = Math.PI * 2;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];

export const RACK = V(0.9, 0, 2.0);        // where he stands to eat (the snack rack by the kitchen's north wall)
export const SHRINE = V(3.95, 0, 5.95);    // where he stands to drink (in front of the spirit house)
export const FRONT_OUT = V(-11.4, 0, 0), FRONT_IN = V(-8.9, 0, 0);
const WALK = 1.2, HUNT = 1.3, CATCH = 0.85;
const LINES = {
  hungry: ['หิว… หิวจัง…', 'ขนม… ขนมอยู่ไหน…', 'หมูกระทะหมดแล้วเหรอ…', 'ท้องร้องจนผนังสั่นแล้วนะ…'],
  hunt: ['กลิ่นมอด… หอมจัง…', 'มอดตัวนี้กินได้มั้ยน้า…', 'ขนมหมดแล้ว… มอดก็ได้…'],
  fed: ['อร่อย… ขอบใจนะหลาน', 'อิ่มไปห้านาที…', 'หลานใจดีจัง'],
  soda: ['น้ำแดง!! ของโปรด', 'เย็นชื่นใจ…'],
  giveUp: ['หายไปไหนแล้ว…', 'ช่างเถอะ… ไปกินขนมดีกว่า'],
};

// ---------------------------------------------------------------- the model
// seeded, so he is the same old man every night
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  if (repeat) t.repeat.set(...repeat);
  return t;
}
// grey-green dead skin: blotches, liver spots, bruises and purple veins
function skinTex() {
  return canvasTex(512, 512, (g, W, H) => {
    const r = rng(7);
    g.fillStyle = '#7f8a66'; g.fillRect(0, 0, W, H);
    const blot = (n, rad, colors) => { for (let i = 0; i < n; i++) { const x = r() * W, y = r() * H, s = rad * (0.4 + r()); const gr = g.createRadialGradient(x, y, 0, x, y, s); gr.addColorStop(0, colors[Math.floor(r() * colors.length)]); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - s, y - s, s * 2, s * 2); } };
    blot(60, 70, ['rgba(70,82,50,0.45)', 'rgba(120,124,88,0.4)', 'rgba(96,70,84,0.35)']);
    blot(26, 34, ['rgba(80,40,70,0.4)', 'rgba(60,70,40,0.5)']); // bruises
    for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(${60 + r() * 30},${40 + r() * 20},20,${0.25 + r() * 0.35})`; g.beginPath(); g.ellipse(r() * W, r() * H, 1 + r() * 4, 1 + r() * 3, r() * 3, 0, TAU); g.fill(); } // liver spots
    g.lineCap = 'round';
    for (let v = 0; v < 26; v++) { // veins: wandering, branching
      let x = r() * W, y = r() * H, a = r() * TAU;
      g.strokeStyle = `rgba(${70 + r() * 30},${44 + r() * 20},${100 + r() * 40},${0.3 + r() * 0.25})`;
      g.lineWidth = 1 + r() * 1.8;
      g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 14; k++) { a += (r() - 0.5) * 0.9; x += Math.cos(a) * 9; y += Math.sin(a) * 9; g.lineTo(x, y); if (r() < 0.15) { g.stroke(); g.lineWidth *= 0.7; g.beginPath(); g.moveTo(x, y); } }
      g.stroke();
    }
    const im = g.getImageData(0, 0, W, H), d = im.data; // pores / grain
    for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * 18; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
    g.putImageData(im, 0, 0);
  });
}
// a pha khao ma that has been worn for a hundred years: faded checks, grime, old stains
function clothTex() {
  return canvasTex(256, 256, (g, W, H) => {
    const r = rng(11);
    g.fillStyle = '#7a2632'; g.fillRect(0, 0, W, H);
    const band = (color, w, alpha, off) => { g.fillStyle = color; g.globalAlpha = alpha; for (let i = 0; i < W; i += 64) { g.fillRect(i + off, 0, w, H); g.fillRect(0, i + off, W, w); } g.globalAlpha = 1; };
    band('#1e2c5c', 22, 0.7, 8); band('#d8cfb8', 5, 0.55, 34); band('#2a5a3a', 9, 0.45, 46);
    for (let i = 0; i < W; i += 3) { g.fillStyle = 'rgba(0,0,0,0.07)'; g.fillRect(i, 0, 1, H); g.fillRect(0, i, W, 1); } // weave
    for (let i = 0; i < 18; i++) { const x = r() * W, y = r() * H, s = 10 + r() * 40; const gr = g.createRadialGradient(x, y, 0, x, y, s); gr.addColorStop(0, `rgba(${40 + r() * 30},${26 + r() * 14},10,0.45)`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - s, y - s, s * 2, s * 2); }
    for (let i = 0; i < 5; i++) { g.fillStyle = 'rgba(60,4,10,0.55)'; g.beginPath(); g.ellipse(r() * W, r() * H, 4 + r() * 10, 3 + r() * 8, r() * 3, 0, TAU); g.fill(); } // old blood
    g.fillStyle = 'rgba(200,190,170,0.12)'; g.fillRect(0, 0, W, H); // sun-faded
  }, [2, 1]);
}
/** Merge geometries (position + normal [+ uv]) into one, so a head of hair is one draw call. */
function merge(geos) {
  const uvs = geos.every((g) => g.attributes.uv);
  let nv = 0, ni = 0;
  for (const g of geos) { nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = uvs ? new Float32Array(nv * 2) : null, idx = new Uint32Array(ni);
  let ov = 0, oi = 0;
  for (const g of geos) {
    pos.set(g.attributes.position.array, ov * 3); nor.set(g.attributes.normal.array, ov * 3);
    if (uv) uv.set(g.attributes.uv.array, ov * 2);
    const n = g.attributes.position.count;
    if (g.index) for (let i = 0; i < g.index.count; i++) idx[oi++] = g.index.array[i] + ov; else for (let i = 0; i < n; i++) idx[oi++] = i + ov;
    ov += n; g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  if (uv) out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}
/** Fold every static part into its moving bone: one mesh per material per bone (a few dozen draw calls, not hundreds). */
function bake(root, live) {
  const _m = new THREE.Matrix4(), inv = new THREE.Matrix4();
  root.updateMatrixWorld(true);
  for (const owner of [root, ...live]) {
    const buckets = new Map(), empty = [];
    const visit = (o) => {
      for (const c of o.children) {
        if (live.has(c)) continue;
        if (c.isMesh && !c.children.length) { if (!buckets.has(c.material)) buckets.set(c.material, []); buckets.get(c.material).push(c); } else { visit(c); if (!c.isMesh) empty.push(c); }
      }
    };
    visit(owner);
    inv.copy(owner.matrixWorld).invert();
    for (const [mat, list] of buckets) {
      if (list.length < 2 && list[0].parent === owner) continue;
      const merged = merge(list.map((m) => m.geometry.clone().applyMatrix4(_m.multiplyMatrices(inv, m.matrixWorld))));
      for (const m of list) m.removeFromParent();
      owner.add(new THREE.Mesh(merged, mat));
    }
    for (const g of empty) if (!g.children.length) g.removeFromParent();
  }
}
/** Hair-thin tubes along curves: a list of point arrays → one geometry. */
function strands(paths, r0 = 0.004) {
  return merge(paths.map((pts) => {
    const curve = new THREE.CatmullRomCurve3(pts);
    const g = new THREE.TubeGeometry(curve, Math.max(4, pts.length * 3), r0, 4, false);
    const p = g.attributes.position, segs = g.parameters.tubularSegments; // taper to a point
    const c = new THREE.Vector3();
    for (let i = 0; i <= segs; i++) {
      curve.getPointAt(i / segs, c);
      const k = 1 - (i / segs) * 0.85;
      for (let j = 0; j <= 4; j++) { const o = i * 5 + j; p.setXYZ(o, c.x + (p.getX(o) - c.x) * k, c.y + (p.getY(o) - c.y) * k, c.z + (p.getZ(o) - c.z) * k); }
    }
    return g;
  }));
}
/** Push a sphere's surface around: f(n) → radius multiplier for the unit direction n. */
function sculpt(geo, f) {
  const p = geo.attributes.position, n = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { n.fromBufferAttribute(p, i); const r = n.length(); n.divideScalar(r || 1); const k = f(n); p.setXYZ(i, n.x * r * k, n.y * r * k, n.z * r * k); }
  geo.computeVertexNormals();
  return geo;
}
const bump = (n, x, y, z, s) => Math.exp(-((n.x - x) ** 2 + (n.y - y) ** 2 + (n.z - z) ** 2) / (s * s));

function buildModel() {
  const R = rng(3);
  const skinMap = skinTex();
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0, ...o });
  // his own faint corpse-light keeps him readable in a dark hallway, the texture showing through
  const SKIN = std({ map: skinMap, color: 0xc8ccb4, roughness: 0.72, emissive: 0x4a5640, emissiveMap: skinMap, emissiveIntensity: 0.32 });
  const SKIN_D = std({ map: skinMap, color: 0x9aa088, roughness: 0.78, emissive: 0x2e3828, emissiveMap: skinMap, emissiveIntensity: 0.3 });
  const CLOTH = std({ map: clothTex(), roughness: 0.95, side: THREE.DoubleSide, emissive: 0x1a0608 });
  const TEETH = std({ color: 0xd2c08a, roughness: 0.4, emissive: 0x2a2410 });
  const GUM = std({ color: 0x3a060c, roughness: 0.35, emissive: 0x0e0102 });
  const MOUTH = new THREE.MeshBasicMaterial({ color: 0x120204 });
  const TONGUE = std({ color: 0x5a1222, roughness: 0.5, emissive: 0x140204 });
  const BLOOD = std({ color: 0x3c0006, roughness: 0.22, emissive: 0x120002 });
  const HAIR = std({ color: 0xa6a296, roughness: 1, emissive: 0x161512 });
  const NAIL = std({ color: 0x2a2418, roughness: 0.3 });
  const EYE = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.8, 0.16, 0.04), toneMapped: false });
  const SCLERA = std({ color: 0x5a4a22, roughness: 0.25, emissive: 0x2a0806 });
  const SOCKET = new THREE.MeshBasicMaterial({ color: 0x0c0806 });
  const THREAD = std({ color: 0xa89e86, roughness: 0.9 });
  const mesh = (geo, mat, p, s, r) => { const m = new THREE.Mesh(geo, mat); if (p) m.position.set(...p); if (s) Array.isArray(s) ? m.scale.set(...s) : m.scale.setScalar(s); if (r) m.rotation.set(...r); return m; };
  const cyl = (r0, r1, h, seg = 12) => { const g = new THREE.CylinderGeometry(r0, r1, h, seg); g.translate(0, -h / 2, 0); return g; }; // hangs down from its pivot
  const ball = (r, w = 12, h = 10) => new THREE.SphereGeometry(r, w, h);

  const root = new THREE.Group(); root.name = 'phiPop';
  const hips = new THREE.Group(); hips.position.y = 0.64; root.add(hips);
  // ---- legs: bone and tendon, knobbly knees, long-toed feet
  const legs = [-1, 1].map((s) => {
    const thigh = new THREE.Group(); thigh.position.set(s * 0.08, 0, 0); hips.add(thigh);
    thigh.add(mesh(cyl(0.042, 0.028, 0.31), SKIN));
    const knee = new THREE.Group(); knee.position.y = -0.31; thigh.add(knee);
    knee.add(mesh(ball(0.036), SKIN_D, [0, 0, 0.01], [1, 0.9, 1.1]));
    knee.add(mesh(ball(0.02, 8, 6), SKIN_D, [0, -0.01, 0.034])); // kneecap
    knee.add(mesh(cyl(0.03, 0.019, 0.29), SKIN));
    knee.add(mesh(ball(0.024, 8, 6), SKIN_D, [0, -0.29, 0])); // ankle
    const foot = new THREE.Group(); foot.position.set(0, -0.3, 0.02); knee.add(foot);
    foot.add(mesh(ball(0.04, 12, 8), SKIN_D, [0, 0, 0.03], [0.85, 0.42, 1.9]));
    for (let k = 0; k < 4; k++) {
      const x = (k - 1.5) * 0.017;
      foot.add(mesh(new THREE.CapsuleGeometry(0.008, 0.035, 2, 6), SKIN_D, [x, -0.008, 0.11 + (k === 0 || k === 3 ? -0.008 : 0)], null, [Math.PI / 2 + 0.25, 0, 0]));
      foot.add(mesh(new THREE.ConeGeometry(0.006, 0.018, 5), NAIL, [x, -0.015, 0.142], null, [Math.PI / 2 + 0.6, 0, 0]));
    }
    return { thigh, knee, side: s };
  });
  // ---- pha khao ma: a ragged wrap round the hips, a flap hanging in front, the knot
  const skirtGeo = new THREE.CylinderGeometry(0.19, 0.25, 0.36, 32, 5, true);
  { const p = skirtGeo.attributes.position; const r = rng(5);
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i), x = p.getX(i), z = p.getZ(i), a = Math.atan2(z, x);
      if (y < -0.17) { p.setY(i, y + (r() - 0.3) * 0.07 + Math.sin(a * 5) * 0.015); p.setX(i, x * 1.04); p.setZ(i, z * 1.04); } // torn hem
      const fold = 1 + Math.sin(a * 9) * 0.03 * (0.18 - y); // folds, deeper near the hem
      p.setX(i, p.getX(i) * fold); p.setZ(i, p.getZ(i) * fold);
    }
    skirtGeo.computeVertexNormals(); }
  const skirt = mesh(skirtGeo, CLOTH, [0, -0.1, 0.02]); hips.add(skirt);
  const flapGeo = new THREE.PlaneGeometry(0.15, 0.36, 3, 6);
  { const p = flapGeo.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setZ(i, Math.sin((y + 0.18) * 6) * 0.012 + (0.18 - y) * 0.05); if (y < -0.15) p.setY(i, y - Math.abs(Math.sin(p.getX(i) * 60)) * 0.04); } flapGeo.computeVertexNormals(); }
  skirt.add(mesh(flapGeo, CLOTH, [0.02, -0.12, 0.25], null, [0.08, 0, 0.04]));
  skirt.add(mesh(new THREE.TorusGeometry(0.2, 0.022, 6, 28), CLOTH, [0, 0.16, 0], [1.02, 1, 1.06], [Math.PI / 2, 0, 0])); // rolled waistband
  hips.add(mesh(ball(0.045, 10, 8), CLOTH, [0.07, 0.07, 0.22], [1.3, 0.9, 0.8]));
  hips.add(mesh(cyl(0.02, 0.012, 0.16, 6), CLOTH, [0.09, 0.06, 0.225], null, [0.15, 0, 0.25])); // the knot's tail

  // ---- spine: hunched; a starved chest of ribs over a swollen belly
  const spine = new THREE.Group(); spine.position.y = 0.04; spine.rotation.x = 0.32; hips.add(spine);
  const prof = [[0.1, -0.06], [0.145, 0.0], [0.16, 0.08], [0.15, 0.16], [0.128, 0.24], [0.122, 0.3], [0.13, 0.37], [0.138, 0.43], [0.13, 0.49], [0.1, 0.535], [0.055, 0.565], [0.035, 0.58]].map(([r, y]) => new THREE.Vector2(r, y));
  const torsoGeo = new THREE.LatheGeometry(prof, 30);
  { const p = torsoGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const a = Math.atan2(x, z), side = Math.abs(Math.sin(a)), back = Math.max(0, -Math.cos(a));
      z *= 0.74; // flat, front to back
      if (y > 0.26 && y < 0.5) { // ribs on the sides and back, a groove between each
        const rib = Math.pow(Math.max(0, Math.sin((y - 0.26) / 0.04 * Math.PI)), 3) * 0.008 * (0.35 + side * 0.65);
        const k = 1 + rib / 0.13; x *= k; z *= k;
      }
      if (y > 0.36 && y < 0.53 && back > 0.4) { const sc = Math.exp(-(((Math.abs(x) - 0.06) / 0.04) ** 2 + ((y - 0.45) / 0.05) ** 2)) * 0.016; z -= sc; } // shoulder blades
      if (back > 0.96) z += 0.006; // the spine's groove
      p.setXYZ(i, x, y, z);
    }
    torsoGeo.computeVertexNormals(); }
  spine.add(mesh(torsoGeo, SKIN));
  const belly = mesh(sculpt(ball(0.18, 26, 18), (n) => 1 - bump(n, 0, 0, 1, 0.12) * 0.05), SKIN, [0, 0.11, 0.085], [1.0, 0.92, 1.05]); spine.add(belly);
  belly.add(mesh(ball(0.012, 8, 6), SKIN_D, [0, -0.01, 0.172], [1, 1.3, 0.5])); // navel
  for (let i = 0; i < 8; i++) spine.add(mesh(ball(0.016, 8, 6), SKIN_D, [0, 0.12 + i * 0.055, -0.088 - Math.sin(i / 7 * Math.PI) * 0.012], [1.1, 0.7, 0.7])); // vertebrae
  for (const s of [-1, 1]) spine.add(mesh(cyl(0.012, 0.01, 0.13, 6), SKIN_D, [s * 0.02, 0.535, 0.075], null, [0, 0, s * 1.35])); // collarbones
  for (let i = 0; i < 3; i++) for (const s of [-1, 1]) spine.add(mesh(new THREE.TorusGeometry(0.07, 0.006, 4, 12, Math.PI * 0.42), SKIN_D, [s * 0.025, 0.44 - i * 0.045, 0.06], [1, 0.8, 1], [Math.PI / 2 + 0.25, 0, s > 0 ? -0.55 : Math.PI + 0.55])); // front ribs
  // ---- arms: too long, bone-thin, claws for fingers
  const arms = [-1, 1].map((s) => {
    const sh = new THREE.Group(); sh.position.set(s * 0.15, 0.48, -0.02); spine.add(sh);
    sh.add(mesh(ball(0.042, 10, 8), SKIN, null, [1, 0.9, 1]));
    sh.add(mesh(cyl(0.032, 0.021, 0.29), SKIN));
    const el = new THREE.Group(); el.position.y = -0.29; sh.add(el);
    el.add(mesh(ball(0.026, 8, 6), SKIN_D, [0, 0, -0.008]));
    el.add(mesh(cyl(0.024, 0.015, 0.28), SKIN));
    el.add(mesh(new THREE.TorusGeometry(0.017, 0.003, 4, 12), THREAD, [0, -0.25, 0], null, [Math.PI / 2, 0, 0])); // sai sin on the wrist
    const hand = new THREE.Group(); hand.position.y = -0.29; el.add(hand);
    hand.add(mesh(ball(0.032, 10, 8), SKIN_D, [0, -0.015, 0], [0.95, 1.2, 0.5]));
    for (let f = 0; f < 4; f++) { // two bones a finger, curled, a black claw
      const fx = (f - 1.5) * 0.017, len = 0.045 + (f === 1 || f === 2 ? 0.012 : 0);
      const f1 = new THREE.Group(); f1.position.set(fx, -0.05, 0.004); f1.rotation.set(0.25, 0, (f - 1.5) * -0.08); hand.add(f1);
      f1.add(mesh(cyl(0.0075, 0.0062, len, 6), SKIN_D));
      const f2 = new THREE.Group(); f2.position.y = -len; f2.rotation.x = 0.45; f1.add(f2);
      f2.add(mesh(ball(0.0078, 6, 5), SKIN_D));
      f2.add(mesh(cyl(0.0062, 0.005, len * 0.85, 6), SKIN_D));
      f2.add(mesh(new THREE.ConeGeometry(0.0055, 0.032, 5), NAIL, [0, -len * 0.85 - 0.014, 0.003], null, [Math.PI + 0.25, 0, 0]));
    }
    const th = new THREE.Group(); th.position.set(s * -0.022, -0.02, 0.012); th.rotation.set(0.4, 0, s * -0.7); hand.add(th);
    th.add(mesh(cyl(0.008, 0.006, 0.045, 6), SKIN_D));
    th.add(mesh(new THREE.ConeGeometry(0.005, 0.025, 5), NAIL, [0, -0.055, 0], null, [Math.PI, 0, 0]));
    return { sh, el, hand, side: s };
  });
  // a pha khao ma slung over one shoulder
  const sashGeo = new THREE.PlaneGeometry(0.09, 0.62, 2, 10);
  { const p = sashGeo.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setZ(i, Math.cos(y * 4.2) * 0.05 - 0.02); } sashGeo.computeVertexNormals(); }
  spine.add(mesh(sashGeo, CLOTH, [0.02, 0.33, 0.115], null, [0.05, 0, 0.6]));

  // ---- head: a long skull with sunken cheeks, deep sockets, a mouth too wide for the face
  const neck = new THREE.Group(); neck.position.set(0, 0.56, 0.02); neck.rotation.x = -0.25; spine.add(neck);
  neck.add(mesh(cyl(0.036, 0.046, 0.09), SKIN, [0, 0.085, 0]));
  for (const s of [-1, 1]) neck.add(mesh(cyl(0.008, 0.007, 0.1, 5), SKIN_D, [s * 0.02, 0.09, 0.022], null, [0.15, 0, s * -0.3])); // tendons
  const head = new THREE.Group(); head.position.y = 0.13; neck.add(head);
  const skullGeo = sculpt(new THREE.SphereGeometry(0.13, 40, 30), (n) => {
    let k = 1;
    k += bump(n, 0, 0.42, 0.9, 0.3) * 0.06;                                    // heavy brow
    k -= (bump(n, 0.38, 0.22, 0.88, 0.2) + bump(n, -0.38, 0.22, 0.88, 0.2)) * 0.12; // eye sockets
    k -= (bump(n, 0.62, -0.25, 0.72, 0.28) + bump(n, -0.62, -0.25, 0.72, 0.28)) * 0.09; // hollow cheeks
    k += (bump(n, 0.62, 0.04, 0.76, 0.18) + bump(n, -0.62, 0.04, 0.76, 0.18)) * 0.05; // cheekbones
    k -= (bump(n, 0.92, 0.3, 0.1, 0.3) + bump(n, -0.92, 0.3, 0.1, 0.3)) * 0.07;   // sunken temples
    k -= bump(n, 0, -0.55, 0.8, 0.35) * 0.18;                                  // room for the jaw
    k += bump(n, 0, 0.1, -1, 0.6) * 0.06;                                      // the long back of the skull
    return k;
  });
  skullGeo.scale(0.9, 1.08, 1);
  const skull = mesh(skullGeo, SKIN, [0, 0.04, 0]); head.add(skull);
  head.add(mesh(new THREE.ConeGeometry(0.017, 0.075, 10), SKIN_D, [0, 0.03, 0.13], [1, 1, 0.8], [Math.PI / 2 + 0.75, 0, 0])); // long nose, hooked down
  for (const s of [-1, 1]) {
    head.add(mesh(ball(0.006, 6, 5), SOCKET, [s * 0.008, 0.006, 0.138])); // nostril
    head.add(mesh(ball(0.032, 12, 10), SOCKET, [s * 0.046, 0.068, 0.076], [1.1, 0.85, 0.6]));
    const eye = new THREE.Group(); eye.position.set(s * 0.046, 0.066, 0.095); head.add(eye);
    eye.position.z -= 0.004;
    eye.add(mesh(ball(0.015, 12, 10), SCLERA));
    eye.add(mesh(ball(0.0085, 10, 8), EYE, [s * -0.002, -0.002, 0.011], [1, 1.1, 0.6]));
    head.add(mesh(new THREE.SphereGeometry(0.022, 10, 8, 0, TAU, 0, Math.PI / 2), SKIN_D, [s * 0.046, 0.074, 0.099], [1.05, 0.55, 0.9], [-0.25, 0, 0])); // drooping lids
    head.add(mesh(ball(0.02, 10, 8), SKIN_D, [s * 0.046, 0.044, 0.104], [1.1, 0.45, 0.7])); // eye bags
    // big old ears, the lobes stretched long
    const ear = mesh(sculpt(ball(0.04, 12, 10), (n) => 1 - bump(n, s, 0, 0, 0.5) * 0.25), SKIN_D, [s * 0.118, 0.02, 0.0], [0.35, 1.3, 0.75], [0, s * 0.3, s * 0.1]);
    head.add(ear);
    // bushy white brows sticking out
    const brow = []; for (let k = 0; k < 7; k++) { const x = s * (0.022 + k * 0.009), y = 0.098 + Math.sin(k / 6 * Math.PI) * 0.008; brow.push([V(x, y, 0.112), V(x + s * (0.014 + R() * 0.008), y + 0.004 + R() * 0.006, 0.128), V(x + s * 0.026, y - 0.002, 0.13)]); }
    head.add(mesh(strands(brow, 0.003), HAIR));
  }
  // long thin white hair from a bald crown: down the back and over the shoulders, a few across the face
  const hair = [];
  for (let i = 0; i < 72; i++) {
    const a = (i / 71 - 0.5) * 4.5 + (R() - 0.5) * 0.12;   // 0 = the back of the head
    const e = 0.12 + R() * 0.5;
    const rx = Math.sin(a) * Math.cos(e), rz = -Math.cos(a) * Math.cos(e), ry = Math.sin(e);
    const p0 = V(rx * 0.118, 0.04 + ry * 0.135, rz * 0.13);
    const len = 0.16 + R() * 0.3, out = 1.04 + R() * 0.12, pts = [p0], ph = R() * TAU;
    for (let k = 1; k <= 6; k++) { const t = k / 6; pts.push(V(rx * 0.13 * out + Math.sin(ph + k * 1.3) * 0.014 * t, p0.y - t * len, rz * 0.14 * out + (rz < 0 ? -0.025 : 0.012) * t + Math.cos(ph + k * 1.1) * 0.012 * t)); }
    hair.push(pts);
  }
  for (const s of [-1, 1]) for (let i = 0; i < 2; i++) { const x = s * (0.05 + i * 0.022); hair.push([V(x * 0.8, 0.165, 0.06), V(x, 0.14, 0.128), V(x * 1.1 + s * 0.012, 0.06, 0.138), V(x * 1.25, -0.02 - i * 0.03, 0.128)]); } // strays over the face
  head.add(mesh(strands(hair, 0.0032), HAIR));
  // mouth: a dark gullet, a row of long crooked upper teeth on red gums, the jaw drops
  head.add(mesh(ball(0.058, 16, 10), MOUTH, [0, -0.032, 0.07], [1.25, 0.7, 0.8]));
  head.add(mesh(new THREE.TorusGeometry(0.052, 0.007, 6, 20, Math.PI), GUM, [0, -0.02, 0.07], [1.25, 1, 0.95], [Math.PI / 2, 0, 0]));
  for (let i = 0; i < 9; i++) {
    const a = (i / 8 - 0.5) * Math.PI * 0.95, long = i === 1 || i === 7 ? 1.7 : 1 + R() * 0.4;
    head.add(mesh(new THREE.ConeGeometry(0.0075, 0.026 * long, 5), TEETH, [Math.sin(a) * 0.064, -0.033 - 0.008 * long, 0.07 + Math.cos(a) * 0.05], null, [Math.PI + (R() - 0.5) * 0.3, 0, (R() - 0.5) * 0.3]));
  }
  const jaw = new THREE.Group(); jaw.position.set(0, -0.03, 0.02); head.add(jaw);
  const jawGeo = sculpt(new THREE.SphereGeometry(0.085, 24, 14, 0, TAU, Math.PI / 2, Math.PI / 2), (n) => 1 + bump(n, 0, -0.7, 0.7, 0.3) * 0.12); // pointed chin
  jaw.add(mesh(jawGeo, SKIN, [0, 0, 0.03], [1.05, 0.8, 1.08]));
  jaw.add(mesh(new THREE.CircleGeometry(0.07, 20), MOUTH, [0, 0.001, 0.035], [1.05, 1, 1], [-Math.PI / 2, 0, 0]));
  jaw.add(mesh(new THREE.TorusGeometry(0.05, 0.009, 6, 20, Math.PI), GUM, [0, 0.004, 0.04], [1.2, 1, 1.1], [-Math.PI / 2, 0, 0]));
  for (let i = 0; i < 7; i++) {
    const a = (i / 6 - 0.5) * Math.PI * 0.9;
    jaw.add(mesh(new THREE.ConeGeometry(0.0068, 0.02 + R() * 0.012, 5), TEETH, [Math.sin(a) * 0.058, 0.012, 0.04 + Math.cos(a) * 0.05], null, [(R() - 0.5) * 0.3, 0, (R() - 0.5) * 0.35]));
  }
  // the tongue lies over the lower teeth; a scraggly goatee; blood at the corners
  const tongue = new THREE.Group(); tongue.position.set(0, 0.01, 0.06); jaw.add(tongue);
  tongue.add(mesh(new THREE.CapsuleGeometry(0.018, 0.07, 4, 12), TONGUE, [0, -0.004, 0.03], [1.25, 1, 0.38], [Math.PI / 2 + 0.22, 0, 0]));
  const goatee = []; for (let i = 0; i < 6; i++) { const x = (i / 5 - 0.5) * 0.04; goatee.push([V(x, -0.055, 0.1), V(x * 1.2 + (R() - 0.5) * 0.01, -0.085, 0.108), V(x * 0.6 + (R() - 0.5) * 0.025, -0.12 - R() * 0.06, 0.1 + R() * 0.01)]); }
  jaw.add(mesh(strands(goatee, 0.0032), HAIR));
  for (const s of [-1, 1]) jaw.add(mesh(new THREE.CapsuleGeometry(0.0045, 0.035, 2, 5), BLOOD, [s * 0.062, -0.028, 0.072], [1, 1, 0.4], [0.3, s * 0.6, s * 0.15])); // blood at the corners
  bake(root, new Set([hips, spine, belly, neck, head, jaw, skirt, ...legs.flatMap((l) => [l.thigh, l.knee]), ...arms.flatMap((a) => [a.sh, a.el, a.hand])]));
  root.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  return { root, hips, spine, belly, legs, arms, neck, head, jaw, skirt };
}

const _v = new THREE.Vector3(), _ndc = new THREE.Vector3();

export class PhiPop {
  constructor(scene, level, doors) {
    this.level = level;
    this.doors = doors;
    this.M = buildModel();
    this.group = this.M.root;
    this.position = this.group.position;
    scene.add(this.group);
    this.onCaught = () => {};
    this.onBurp = () => {};
    this.onAte = () => {};
    this.onSmash = () => {};
    this.onHunt = () => {};
    this.avoid = new Set(['bedroom']); // the guest room is the safe room (and locked before that)
    this.pass = () => true;            // he goes through any door (bashing the closed ones)
    this.reset();
  }

  reset() {
    this.state = 'off';
    this.group.visible = false;
    this.position.copy(FRONT_OUT);
    this.hunger = 30;
    this.calmT = 0;
    this.stunT = 0;
    this.route = [];
    this.stateT = 0;
    this.eatT = 0;
    this.chompT = 0;
    this.lineT = rand(8, 14);
    this.walkPhase = 0;
    this.yaw = Math.PI / 2;
    this.bashDoor = null; this.bashN = 0;
    this.huntCool = 0;
    this.lastSeen = null;
    this.stuckT = 0; this.lastPos = this.position.clone();
    this.jaw = 0;
    this.speedK = 1;
    this.moving = false;
  }

  get active() { return this.state !== 'off'; }
  get hunting() { return this.state === 'hunt' || this.state === 'bash' && this.huntBash; }
  get room() { return nearestRoom(this.level, this.position); }

  /** Walk in through the front door. */
  enter() {
    this.reset();
    this.state = 'enter';
    this.group.visible = true;
    this.route = [{ p: FRONT_IN.clone(), cross: true }];
  }

  /** "หมดเวลาคอลแลป": walk out the front door and vanish. */
  leave() {
    if (!this.active) return;
    this.state = 'leave';
    this.route = buildRoute(this.level, this.position, FRONT_IN, 'hallway', this.pass, this.avoid) || [];
    this.route.push({ p: FRONT_OUT.clone(), cross: true });
  }

  /** A snack from the player's hand. */
  feed(amount = 40) {
    this.hunger = Math.max(0, this.hunger - amount);
    if (this.state === 'hunt' || this.state === 'bash' || this.state === 'search') { this.huntCool = 25; }
    this.state = 'eat'; this.stateT = 0; this.eatT = 2.2; this.route = [];
    sfx.play('chomp');
    this.say(pick(LINES.fed));
  }

  /** Scream: frozen for a moment. */
  stun(sec = 2) {
    if (!this.active || this.state === 'jumpscare' || this.state === 'leave' || this.state === 'enter') return false;
    this.stunT = sec;
    return true;
  }

  say(text) { Talk.say('pop', text, { at: this.position, ms: 2600 }); }

  // ---------------------------------------------------------------- update
  /** ctx: { player, camera, snacks: { count, take() }, soda: bool (red soda waiting at the shrine), drinkSoda(), hidden, safe, hour } */
  update(dt, t, ctx = {}) {
    if (this.state === 'off') return;
    this.stateT += dt;
    const { player } = ctx;
    if (this.state === 'jumpscare') { this._jumpscare(dt, t, ctx); this._pose(dt, t); return; }
    if (this.huntCool > 0) this.huntCool -= dt;

    // hunger
    if (this.calmT > 0) { this.calmT -= dt; this.hunger = Math.max(8, this.hunger - dt * 2); }
    else if (this.state !== 'eat' && this.state !== 'drink') this.hunger = Math.min(100, this.hunger + dt * (ctx.hour >= 4 ? 1.1 : 0.85));

    if (this.stunT > 0) { this.stunT -= dt; this.moving = false; this._pose(dt, t); return; }

    const S = this.state;
    const free = S === 'idle' || S === 'wander' || S === 'toFood' || S === 'hunt' || S === 'search';
    // red soda waiting at the shrine beats everything
    if (ctx.soda && (free || S === 'eat') && this.state !== 'toShrine') {
      const r = buildRoute(this.level, this.position, SHRINE, 'living', this.pass, this.avoid);
      if (r) { this.state = 'toShrine'; this.route = r; this.stateT = 0; }
    }
    // hunt when starving and nothing is left
    const canHunt = player && !ctx.hidden && !ctx.safe && this.huntCool <= 0 && this.calmT <= 0;
    if (canHunt && (S === 'idle' || S === 'wander' || S === 'toFood')) {
      const near = Math.hypot(player.position.x - this.position.x, player.position.z - this.position.z) < 6 && roomsLinked(this.level, this.room, this.level.roomAt(player.position));
      if ((ctx.snacks.count <= 0 && this.hunger >= 100) || (ctx.snacks.count <= 0 && this.hunger >= 85 && near)) {
        this.state = 'hunt'; this.stateT = 0; this.say(pick(LINES.hunt)); this.onHunt();
      }
    }
    // food
    if ((S === 'idle' || S === 'wander') && this.hunger >= 50 && ctx.snacks.count > 0 && this.calmT <= 0) {
      const r = buildRoute(this.level, this.position, RACK, 'kitchen', this.pass, this.avoid);
      if (r) { this.state = 'toFood'; this.route = r; this.stateT = 0; }
    }

    switch (this.state) {
      case 'enter':
        this._walk(dt, WALK, true);
        if (!this.route.length) { this.state = 'idle'; this.stateT = 0; this.onEntered && this.onEntered(); }
        break;
      case 'leave':
        this._walk(dt, WALK * 1.2, true);
        if (!this.route.length) { this.state = 'off'; this.group.visible = false; }
        break;
      case 'idle':
        this.moving = false;
        if (this.stateT > rand(2, 4)) this._wander();
        break;
      case 'wander':
        this._walk(dt, WALK * 0.8);
        if (!this.route.length) { this.state = 'idle'; this.stateT = 0; }
        break;
      case 'toFood':
        this._walk(dt, WALK);
        if (!this.route.length) {
          if (ctx.snacks.count > 0) { this.state = 'eat'; this.stateT = 0; this.eatT = 4; this.yaw = Math.PI; }
          else { this.state = 'idle'; this.stateT = 0; }
        }
        break;
      case 'eat':
        this.moving = false;
        this.eatT -= dt;
        this._chew(dt, player, 0.24);
        if (this.eatT <= 0) {
          if (this.route.length === 0 && this.stateT > 2.3 && Math.hypot(this.position.x - RACK.x, this.position.z - RACK.z) < 0.6 && ctx.snacks.count > 0 && ctx.snacks.take()) {
            this.hunger = Math.max(0, this.hunger - 35);
            this.onAte();
          }
          if (this.hunger >= 40 && ctx.snacks.count > 0 && Math.hypot(this.position.x - RACK.x, this.position.z - RACK.z) < 0.6) { this.eatT = 4; this.stateT = 0; } else { this.state = 'idle'; this.stateT = 0; }
        }
        break;
      case 'toShrine':
        this._walk(dt, WALK * 1.15);
        if (!ctx.soda) { this.state = 'idle'; this.stateT = 0; break; }
        if (!this.route.length) { this.state = 'drink'; this.stateT = 0; sfx.play('gulp', this._pan(player)); this.say(pick(LINES.soda)); }
        break;
      case 'drink':
        this.moving = false;
        this.yaw = Math.atan2(3.5 - this.position.x, 6.45 - this.position.z);
        if (this.stateT > 2.4) {
          ctx.drinkSoda && ctx.drinkSoda();
          this.calmT = 90; this.hunger = 10; this.huntCool = 0;
          this.state = 'burp'; this.stateT = 0;
          sfx.play('burp', { ...this._pan(player), vol: 1 });
          UI.shake(200);
          this.onBurp(this.position.clone());
        }
        break;
      case 'burp':
        this.moving = false;
        if (this.stateT > 1.6) { this.state = 'idle'; this.stateT = 0; }
        break;
      case 'hunt': {
        if (!player || ctx.hidden || ctx.safe || this.calmT > 0) {
          this.state = 'search'; this.stateT = 0;
          this.route = this.lastSeen ? (buildRoute(this.level, this.position, this.lastSeen, null, this.pass, this.avoid) || []) : [];
          break;
        }
        this.lastSeen = player.position.clone();
        if (this.stateT > 0.5 || !this.route.length) { this.stateT = 0.001; this.route = buildRoute(this.level, this.position, player.position, this.level.roomAt(player.position), this.pass, this.avoid) || []; }
        this._walk(dt, HUNT * this.speedK);
        this._chew(dt, player, 0.5);
        const d = Math.hypot(player.position.x - this.position.x, player.position.z - this.position.z);
        if (d < CATCH) this._startJumpscare(player, ctx.camera);
        break;
      }
      case 'search':
        this._walk(dt, WALK);
        if (!this.route.length && this.stateT > 4) { this.state = 'idle'; this.stateT = 0; this.huntCool = 12; this.say(pick(LINES.giveUp)); }
        break;
      case 'bash':
        this.moving = false;
        if (this.stateT > 1.1) {
          this.stateT = 0;
          this.bashN++;
          this.doors.bash(this.bashDoor);
          if (player && Math.hypot(player.position.x - this.position.x, player.position.z - this.position.z) < 5) UI.shake(160);
          if (this.bashN >= 3) {
            this.doors.smash(this.bashDoor);
            this.onSmash(this.bashDoor);
            this.state = this.bashResume || 'idle'; this.bashDoor = null;
          }
        }
        break;
    }

    // hunger lines
    this.lineT -= dt;
    if (this.lineT <= 0) {
      this.lineT = rand(12, 20);
      if (player && Math.hypot(player.position.x - this.position.x, player.position.z - this.position.z) < 12 && this.hunger > 60 && this.state !== 'hunt') this.say(pick(LINES.hungry));
    }
    this._pose(dt, t);
  }

  _pan(player) { if (!player) return {}; const p = panFor(player, this.position.x, this.position.z); return { pan: p.pan, vol: p.vol }; }

  _chew(dt, player, every) {
    this.chompT -= dt;
    if (this.chompT <= 0) {
      this.chompT = every;
      if (player) { const p = panFor(player, this.position.x, this.position.z); if (p.dist < 14) sfx.play('chomp', { pan: p.pan, vol: p.vol * 0.9 }); }
    }
  }

  _wander() {
    const rooms = ['kitchen', 'kitchen', 'living', 'hallway'];
    const room = pick(rooms);
    const pts = (this.level.navPoints || []).filter((p) => this.level.roomAt(p) === room);
    const dest = pick(pts.length ? pts : [RACK]);
    const r = buildRoute(this.level, this.position, dest, room, this.pass, this.avoid);
    if (r) { this.route = r; this.state = 'wander'; this.stateT = 0; }
  }

  _walk(dt, speed, noClamp = false) {
    const pos = this.position;
    const w = this.route[0];
    if (!w) { this.moving = false; return; }
    // a closed door in the way: bash it down
    if (w.cross && w.link && w.link.door && !this.level.doorOpen(w.link.door)) {
      const L = w.link;
      if (Math.hypot(pos.x - (L.pa.x + L.pb.x) / 2, pos.z - (L.pa.z + L.pb.z) / 2) < 1.0) {
        this.bashResume = this.state; this.huntBash = this.state === 'hunt';
        this.state = 'bash'; this.stateT = 0.6; this.bashN = 0; this.bashDoor = L.door; this.moving = false;
        this.yaw = Math.atan2(w.p.x - pos.x, w.p.z - pos.z);
        return;
      }
    }
    const dx = w.p.x - pos.x, dz = w.p.z - pos.z, d = Math.hypot(dx, dz);
    const last = this.route.length === 1;
    if (d < (last ? 0.4 : 0.12)) { this.route.shift(); return; }
    const step = Math.min(d, speed * DIFF.speed * dt);
    pos.x += (dx / d) * step; pos.z += (dz / d) * step;
    const crossing = w.cross || noClamp;
    if (!crossing) {
      this.level.collide(pos, 0.3);
      const room = this.level.roomAt(pos);
      if (room) { const r = this.level.rooms[room], m = 0.32; pos.x = Math.min(r.x1 - m, Math.max(r.x0 + m, pos.x)); pos.z = Math.min(r.z1 - m, Math.max(r.z0 + m, pos.z)); }
    }
    // turn toward the way he walks
    let want = Math.atan2(dx, dz), dy = want - this.yaw;
    dy = ((dy + Math.PI) % TAU + TAU) % TAU - Math.PI;
    this.yaw += dy * Math.min(1, dt * 5);
    this.moving = true;
    this.walkPhase += step * 5.2;
    // stuck on furniture: skip ahead or detour
    this.stuckT += dt;
    if (this.stuckT > 1.5) {
      if (this.lastPos.distanceTo(pos) < 0.12 && this.route.length) {
        const end = this.route[this.route.length - 1].p;
        if (this.route.length === 1 && Math.hypot(end.x - pos.x, end.z - pos.z) < 1.4) this.route.length = 0; // furniture in the way: close enough
        else if (this.route.length > 1 && !this.route[0].cross) this.route.shift();
        else { const r = this.level.rooms[this.room]; if (r) this.route.unshift({ p: V(rand(r.x0 + 0.8, r.x1 - 0.8), 0, rand(r.z0 + 0.8, r.z1 - 0.8)), cross: false }); }
      }
      this.stuckT = 0; this.lastPos.copy(pos);
    }
  }

  // ---------------------------------------------------------------- jumpscare
  _startJumpscare(player, camera) {
    this.state = 'jumpscare'; this.stateT = 0;
    player.enabled = false;
    sfx.play('jumpscare'); sfx.play('burp', { vol: 0.6 });
    UI.flash('#9aff7a'); UI.shake(1000);
    this._js = { player, camera, fired: false };
  }
  _jumpscare(dt, t, ctx) {
    const J = this._js;
    if (!J) return;
    const pp = J.player.position;
    const f = V(-Math.sin(J.player.yaw), 0, -Math.cos(J.player.yaw));
    const k = Math.min(1, this.stateT / 0.15);
    this.position.set(pp.x + f.x * (1.1 - 0.4 * k), 0, pp.z + f.z * (1.1 - 0.4 * k));
    this.yaw = Math.atan2(pp.x - this.position.x, pp.z - this.position.z);
    this.moving = false;
    if (J.camera) {
      this.M.head.getWorldPosition(_v);
      const eye = V(pp.x, 1.6, pp.z);
      J.camera.position.set(eye.x + (Math.random() - 0.5) * 0.02, eye.y, eye.z);
      J.camera.lookAt(_v);
    }
    if (this.stateT > 1.2 && !J.fired) { J.fired = true; this.onCaught(); }
  }

  /** Is he in the camera frame (for photos / the hunger meter)? */
  inView(camera) {
    if (!this.group.visible) return false;
    this.M.head.getWorldPosition(_v);
    if (camera.position.distanceTo(_v) > 12) return false;
    _ndc.copy(_v).project(camera);
    return _ndc.z < 1 && Math.abs(_ndc.x) < 1 && Math.abs(_ndc.y) < 1;
  }
  headPos(out = V()) { return this.M.head.getWorldPosition(out); }

  // ---------------------------------------------------------------- animation
  _pose(dt, t) {
    const M = this.M;
    this.group.rotation.y = this.yaw;
    const S = this.state, ph = this.walkPhase;
    const walk = this.moving ? 1 : 0;
    this._walkW = (this._walkW || 0) + (walk - (this._walkW || 0)) * Math.min(1, dt * 6);
    const w = this._walkW;
    M.hips.position.y = 0.64 + Math.abs(Math.sin(ph)) * 0.025 * w - (S === 'bash' ? 0.02 : 0);
    M.hips.rotation.z = Math.sin(ph) * 0.06 * w;
    for (const L of M.legs) {
      const a = Math.sin(ph + (L.side > 0 ? Math.PI : 0));
      L.thigh.rotation.x = -a * 0.5 * w - 0.08;
      L.knee.rotation.x = Math.max(0, a) * 0.7 * w + 0.12;
    }
    M.skirt.rotation.z = Math.sin(ph * 0.5) * 0.04 * w;
    const breath = Math.sin(t * 1.8);
    M.belly.scale.set(1.02 + breath * 0.01 + Math.sin(ph * 2) * 0.015 * w, 0.95 + Math.abs(Math.sin(ph)) * 0.02 * w, 1.08);
    M.spine.rotation.x = 0.32 + (S === 'hunt' ? 0.1 : 0) + (S === 'drink' || S === 'burp' ? -0.3 : 0);
    // arms
    let jawOpen = 0.14 + Math.max(0, Math.sin(t * 0.9)) * 0.08; // mouth hangs open, always a little hungry
    for (const A of M.arms) {
      let sx = Math.sin(ph + (A.side > 0 ? 0 : Math.PI)) * 0.45 * w, sz = A.side * 0.12, ex = -0.25;
      if (S === 'eat' || S === 'drink') { sx = -1.5 + Math.sin(t * 9 + A.side) * 0.12; sz = A.side * -0.25; ex = -1.6; jawOpen = 0.12 + Math.abs(Math.sin(t * 9)) * 0.28; }
      else if (S === 'bash') { const k = (this.stateT % 1.1) / 1.1; sx = k < 0.6 ? -2.6 * (k / 0.6) : -2.6 + (k - 0.6) / 0.4 * 2.2; ex = -0.4; sz = A.side * 0.2; }
      else if (S === 'hunt') { sx = -1.1 + Math.sin(ph + A.side) * 0.2; ex = -0.5; jawOpen = 0.25 + Math.abs(Math.sin(t * 6)) * 0.2; }
      else if (S === 'jumpscare') { sx = -1.4; ex = -0.2; sz = A.side * 0.5; jawOpen = 0.8; }
      else if (this.stunT > 0) { sx = -2.4; ex = -2.0; sz = A.side * -0.6; jawOpen = 0.35; }
      else if (S === 'burp') { jawOpen = 0.6 * Math.max(0, 1 - this.stateT / 1.2); }
      A.sh.rotation.set(sx, 0, sz);
      A.el.rotation.x = ex;
    }
    this.jaw += (jawOpen - this.jaw) * Math.min(1, dt * 14 || 1);
    M.jaw.rotation.x = this.jaw;
    M.neck.rotation.x = -0.25 + (S === 'burp' ? -0.4 : 0) + (S === 'drink' ? -0.5 : 0);
    M.head.rotation.y = S === 'idle' ? Math.sin(t * 0.7) * 0.5 : 0;
    M.head.rotation.z = this.stunT > 0 ? Math.sin(t * 12) * 0.2 : 0;
  }
}
