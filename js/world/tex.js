// Procedural textures for the house (canvas-drawn, no image files): floors, walls, wood, fabric, plus
// normal maps built from height fields so grooves, grout and weave catch the flashlight.
// Tiling textures are authored in meters (see `metersU/metersV`) and mapped with world-space UVs (kit.js).
import * as THREE from 'three';

// ---------------------------------------------------------------- noise
function mulberry(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Tileable value noise: period px × py lattice cells. */
function valueNoise(px, py, seed = 1) {
  const r = mulberry(seed), g = new Float32Array(px * py);
  for (let i = 0; i < g.length; i++) g[i] = r();
  const at = (x, y) => g[(((y % py) + py) % py) * px + (((x % px) + px) % px)];
  return (x, y) => { // x, y in lattice units
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
}
/** Tileable fBm over a W×H canvas (u,v in 0..1). */
function fbm(cells, octaves, seed) {
  const layers = [];
  for (let o = 0; o < octaves; o++) layers.push({ n: valueNoise(cells[0] << o, cells[1] << o, seed + o * 17), c: [cells[0] << o, cells[1] << o], a: 0.5 ** o });
  const norm = layers.reduce((s, l) => s + l.a, 0);
  return (u, v) => { let s = 0; for (const l of layers) s += l.n(u * l.c[0], v * l.c[1]) * l.a; return s / norm; };
}

// ---------------------------------------------------------------- canvas helpers
function canvas(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  return [c, c.getContext('2d', { willReadFrequently: true })];
}
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const hexRGB = (hex) => { const c = new THREE.Color(hex); return [c.r * 255, c.g * 255, c.b * 255]; }; // sRGB 0..255
function toTexture(c, { srgb = true, repeat = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = aniso;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}
/** Sobel height → tangent-space normal map (wraps at the edges so it tiles). */
function normalFromHeight(h, w, hh, strength = 2) {
  const [c, g] = canvas(w, hh), img = g.createImageData(w, hh), d = img.data;
  const H = (x, y) => h[(((y + hh) % hh) * w) + ((x + w) % w)];
  for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) {
    const dx = (H(x + 1, y - 1) + 2 * H(x + 1, y) + H(x + 1, y + 1)) - (H(x - 1, y - 1) + 2 * H(x - 1, y) + H(x - 1, y + 1));
    const dy = (H(x - 1, y + 1) + 2 * H(x, y + 1) + H(x + 1, y + 1)) - (H(x - 1, y - 1) + 2 * H(x, y - 1) + H(x + 1, y - 1));
    let nx = -dx * strength, ny = dy * strength, nz = 1;
    const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    const i = (y * w + x) * 4;
    d[i] = (nx * 0.5 + 0.5) * 255; d[i + 1] = (ny * 0.5 + 0.5) * 255; d[i + 2] = (nz * 0.5 + 0.5) * 255; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return toTexture(c, { srgb: false });
}
/** Build albedo (+ optional height→normal, roughness) from a per-pixel function. */
function pixels(w, h, fn, { normal = 0, rough = false } = {}) {
  const [c, g] = canvas(w, h), img = g.createImageData(w, h), d = img.data;
  const height = normal ? new Float32Array(w * h) : null;
  const rgh = rough ? new Uint8ClampedArray(w * h) : null;
  const out = { r: 0, g: 0, b: 0, h: 0, rough: 0.8 };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    out.h = 0; out.rough = 0.8;
    fn(x / w, y / h, out, x, y);
    const i = (y * w + x) * 4;
    d[i] = out.r; d[i + 1] = out.g; d[i + 2] = out.b; d[i + 3] = 255;
    if (height) height[y * w + x] = out.h;
    if (rgh) rgh[y * w + x] = clamp(out.rough) * 255;
  }
  g.putImageData(img, 0, 0);
  const res = { map: toTexture(c), canvas: c };
  if (height) res.normalMap = normalFromHeight(height, w, h, normal);
  if (rgh) {
    const [rc, rg] = canvas(w, h), ri = rg.createImageData(w, h);
    for (let i = 0; i < w * h; i++) { ri.data[i * 4] = 0; ri.data[i * 4 + 1] = rgh[i]; ri.data[i * 4 + 2] = 0; ri.data[i * 4 + 3] = 255; }
    rg.putImageData(ri, 0, 0);
    res.roughnessMap = toTexture(rc, { srgb: false });
  }
  return res;
}
const mix3 = (o, a, b, t) => { o.r = a[0] + (b[0] - a[0]) * t; o.g = a[1] + (b[1] - a[1]) * t; o.b = a[2] + (b[2] - a[2]) * t; };

// ---------------------------------------------------------------- tiling surface textures
// Each returns { map, normalMap?, roughnessMap?, metersU, metersV } — the size in meters one repeat covers.

/** Wood grain for furniture (grain runs along U). Neutral warm; tinted by vertex colors. */
export function woodGrain(seed = 3) {
  const n = fbm([4, 32], 4, seed), rings = fbm([2, 6], 3, seed + 9);
  const A = [178, 150, 124], B = [238, 222, 204];
  const t = pixels(512, 512, (u, v, o) => {
    const w = rings(u, v) * 9 + v * 24;
    const line = Math.abs(Math.sin(w * Math.PI + n(u, v) * 5));
    const k = clamp(0.25 + 0.55 * Math.pow(line, 0.6) + 0.2 * n(u * 3 % 1, v));
    mix3(o, A, B, k);
    o.h = k * 0.35 + n(u, v) * 0.2;
  }, { normal: 1.2 });
  return { ...t, metersU: 1.2, metersV: 0.6 };
}
/** Fabric weave (tinted by vertex colors). */
export function weave(seed = 5) {
  const n = fbm([32, 32], 2, seed);
  const t = pixels(256, 256, (u, v, o, x, y) => {
    const a = Math.sin(x / 256 * Math.PI * 96), b = Math.sin(y / 256 * Math.PI * 96);
    const over = (Math.floor(x / 256 * 48) + Math.floor(y / 256 * 48)) % 2 ? a : b;
    const k = 0.78 + 0.12 * over + 0.1 * n(u, v);
    o.r = o.g = o.b = k * 255;
    o.h = over * 0.5 + n(u, v) * 0.3;
  }, { normal: 1.5 });
  return { ...t, metersU: 0.25, metersV: 0.25 };
}
/** Subtle plaster / paint noise (tinted). */
export function plaster(seed = 7) {
  const n = fbm([16, 16], 5, seed);
  const t = pixels(256, 256, (u, v, o) => {
    const k = 0.9 + 0.1 * n(u, v);
    o.r = o.g = o.b = k * 255; o.h = n(u, v);
  }, { normal: 0.9 });
  return { ...t, metersU: 1, metersV: 1 };
}

/** Plank floor: planks along U. */
export function planks({ seed = 11, base = '#6b4a36', light = '#9a6c4c', plankW = 0.16, meters = 1.92, gap = '#1e140e' } = {}) {
  const rows = Math.round(meters / plankW), r = mulberry(seed);
  const cuts = [], tones = [];
  for (let i = 0; i < rows; i++) {
    const L = 0.35 + r() * 0.4, o = r();
    cuts.push([o, L]); tones.push(r());
  }
  const grain = fbm([3, 48], 4, seed + 3), fine = fbm([64, 8], 2, seed + 5);
  const A = hexRGB(base), B = hexRGB(light), G = hexRGB(gap);
  const t = pixels(1024, 1024, (u, v, o) => {
    const row = Math.floor(v * rows), fv = v * rows - row;
    const [off, L] = cuts[row];
    const along = (u + off) / L, seg = Math.floor(along), fu = along - seg;
    const plankTone = (tones[row] * 7.1 + seg * 3.3) % 1;
    const gr = grain((u + row * 0.37) % 1, v);
    const w = Math.abs(Math.sin((gr * 6 + fv * 2.5 + plankTone * 5) * Math.PI));
    let k = clamp(0.3 + 0.45 * plankTone + 0.3 * Math.pow(w, 3) + 0.12 * fine(u, v) - 0.15);
    mix3(o, A, B, k);
    const edgeV = Math.min(fv, 1 - fv) * plankW * 1000, edgeU = Math.min(fu, 1 - fu) * L * meters * 1000; // mm to the seam
    const seam = Math.min(edgeV, edgeU * 1.6);
    const gapK = clamp(1 - seam / 2.2);
    if (gapK > 0) mix3(o, [o.r, o.g, o.b], G, gapK * 0.85);
    o.h = (1 - gapK) * 0.6 + w * 0.05 + fine(u, v) * 0.05 - gapK * 0.4;
    o.rough = 0.5 + 0.25 * (1 - w) + 0.2 * gapK;
  }, { normal: 3, rough: true });
  return { ...t, metersU: meters, metersV: meters };
}

/** Square tiles with grout (optionally checkered). */
export function tiles({ seed = 13, a = '#e9e4dc', b = null, grout = '#9a948c', count = 4, meters = 1.2, glaze = 0.18, bevel = 0.08, jitter = 0.05 } = {}) {
  const r = mulberry(seed), tone = [];
  for (let i = 0; i < count * count; i++) tone.push(r());
  const n = fbm([8, 8], 4, seed + 1);
  const A = hexRGB(a), B = hexRGB(b || a), Gr = hexRGB(grout);
  const gw = 0.035; // grout fraction of a tile
  const t = pixels(1024, 1024, (u, v, o) => {
    const cx = Math.floor(u * count), cy = Math.floor(v * count), fx = u * count - cx, fy = v * count - cy;
    const d = Math.min(fx, 1 - fx, fy, 1 - fy);
    const base = (cx + cy) % 2 && b ? B : A;
    const tt = tone[cy * count + cx], nn = n(u, v);
    const k = 1 - jitter + jitter * 2 * tt - 0.05 * nn;
    o.r = base[0] * k; o.g = base[1] * k; o.b = base[2] * k;
    const gk = clamp((gw - d) / 0.012 + 0.5);
    if (gk > 0) mix3(o, [o.r, o.g, o.b], Gr, gk);
    const edge = clamp(d / bevel);
    o.h = gk > 0.5 ? 0 : 0.25 + 0.75 * Math.sqrt(edge) + nn * 0.03;
    o.rough = gk > 0.5 ? 0.95 : glaze + 0.1 * nn;
  }, { normal: 2.5, rough: true });
  return { ...t, metersU: meters, metersV: meters };
}

/** Short-pile carpet. */
export function carpet({ seed = 17, a = '#2a1838', b = '#3b2250', meters = 1 } = {}) {
  const n = fbm([48, 48], 3, seed), m = fbm([6, 6], 3, seed + 4);
  const A = hexRGB(a), B = hexRGB(b);
  const t = pixels(512, 512, (u, v, o) => {
    const k = clamp(n(u, v) * 0.7 + m(u, v) * 0.5 - 0.1);
    mix3(o, A, B, k);
    o.h = n(u, v); o.rough = 1;
  }, { normal: 2.2, rough: true });
  return { ...t, metersU: meters, metersV: meters };
}

// ---------------------------------------------------------------- walls (one repeat = full wall height)
export const WALL_H = 2.8;
/**
 * Wall finish drawn over the full height (v: 0 = ceiling … 1 = floor), repeating along the wall.
 * kind: 'stream' | 'bedroom' | 'hall' | 'kitchen' | 'living' | 'bath'
 */
export function wallpaper(kind, seed = 19) {
  const W = 512, H = 1024, meters = 1.4;
  const [c, g] = canvas(W, H);
  const hc = document.createElement('canvas'); hc.width = W; hc.height = H;
  const hg = hc.getContext('2d', { willReadFrequently: true });
  const Y = (m) => H - (m / WALL_H) * H; // meters above the floor → px
  const X = (m) => (m / meters) * W;
  hg.fillStyle = '#808080'; hg.fillRect(0, 0, W, H);
  const n = fbm([8, 16], 4, seed);
  const grain = (alpha) => { // painterly noise over everything
    const img = g.getImageData(0, 0, W, H), d = img.data;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const k = 1 + (n(x / W, y / H) - 0.5) * alpha, i = (y * W + x) * 4;
      d[i] *= k; d[i + 1] *= k; d[i + 2] *= k;
    }
    g.putImageData(img, 0, 0);
  };
  const band = (y0, y1, color, h = null) => { g.fillStyle = color; g.fillRect(0, Y(y1), W, Y(y0) - Y(y1)); if (h) { hg.fillStyle = h; hg.fillRect(0, Y(y1), W, Y(y0) - Y(y1)); } };
  const motif = (fn, stepX, stepY, y0 = 0, y1 = WALL_H, stagger = true) => {
    for (let j = 0, ym = y0 + stepY / 2; ym < y1; j++, ym += stepY) {
      for (let i = -1, xm = (stagger && j % 2 ? stepX / 2 : 0); xm < meters + stepX; i++, xm += stepX) fn(X(xm), Y(ym), j, i);
    }
  };
  const star = (x, y, r, color) => {
    g.fillStyle = color; g.beginPath();
    for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * 0.42 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    g.closePath(); g.fill();
  };
  const heart = (x, y, s, color) => {
    g.fillStyle = color; g.beginPath(); g.moveTo(x, y + s * 0.9);
    g.bezierCurveTo(x - s * 1.2, y + s * 0.1, x - s * 0.8, y - s * 0.9, x, y - s * 0.3);
    g.bezierCurveTo(x + s * 0.8, y - s * 0.9, x + s * 1.2, y + s * 0.1, x, y + s * 0.9); g.fill();
  };
  const damask = (x, y, s, color) => { // symmetric ornament
    g.save(); g.translate(x, y); g.fillStyle = color; g.strokeStyle = color; g.lineWidth = s * 0.07;
    for (const sx of [-1, 1]) {
      g.save(); g.scale(sx, 1);
      g.beginPath(); g.moveTo(0, -s); g.bezierCurveTo(s * 0.55, -s * 0.7, s * 0.2, -s * 0.2, s * 0.62, 0);
      g.bezierCurveTo(s * 0.2, s * 0.2, s * 0.55, s * 0.7, 0, s); g.stroke();
      g.beginPath(); g.ellipse(s * 0.32, -s * 0.42, s * 0.12, s * 0.2, -0.6, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(s * 0.32, s * 0.42, s * 0.12, s * 0.2, 0.6, 0, Math.PI * 2); g.fill();
      g.restore();
    }
    g.beginPath(); g.ellipse(0, 0, s * 0.16, s * 0.34, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.moveTo(0, -s * 1.25); g.lineTo(s * 0.1, -s * 1.05); g.lineTo(0, -s * 0.95); g.lineTo(-s * 0.1, -s * 1.05); g.fill();
    g.restore();
  };
  const panelWainscot = (top, color, dark, light) => { // raised panels below `top` meters
    band(0, top, color, '#8a8a8a');
    const pw = meters / 2;
    for (let i = 0; i < 2; i++) {
      const x0 = X(i * pw + 0.08), x1 = X((i + 1) * pw - 0.08), y0 = Y(top - 0.12), y1 = Y(0.2);
      g.strokeStyle = dark; g.lineWidth = 6; g.strokeRect(x0, y0, x1 - x0, y1 - y0);
      g.strokeStyle = light; g.lineWidth = 3; g.strokeRect(x0 + 5, y0 + 5, x1 - x0 - 10, y1 - y0 - 10);
      hg.fillStyle = '#9a9a9a'; hg.fillRect(x0 + 8, y0 + 8, x1 - x0 - 16, y1 - y0 - 16);
      hg.strokeStyle = '#606060'; hg.lineWidth = 6; hg.strokeRect(x0, y0, x1 - x0, y1 - y0);
    }
  };

  if (kind === 'peachi') { // Peachi's room (from her stream background): soft pastel pink paint, white trim band
    band(0, WALL_H, '#f3c4cf');
    for (let x = 0; x < W; x += X(0.35)) { g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(x, 0, X(0.17), H); }
    band(0, 0.02, '#ffffff');
    grain(0.07);
  } else if (kind === 'peachFeature') { // feature wallpaper behind the desk: little peaches and hearts on blush
    band(0, WALL_H, '#f8d3da');
    const peach = (x, y, r) => {
      const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
      gr.addColorStop(0, '#ffe3d4'); gr.addColorStop(0.6, '#ffa3b0'); gr.addColorStop(1, '#f07a94');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(200,70,100,0.35)'; g.lineWidth = r * 0.08; g.beginPath(); g.moveTo(x, y - r * 0.9); g.quadraticCurveTo(x - r * 0.3, y, x, y + r * 0.85); g.stroke();
      g.fillStyle = '#7ccf7a'; g.beginPath(); g.ellipse(x + r * 0.35, y - r * 1.0, r * 0.4, r * 0.16, -0.5, 0, Math.PI * 2); g.fill();
    };
    motif((x, y, j) => (j % 2 ? heart(x, y, 7, 'rgba(255,255,255,0.7)') : peach(x, y, 13)), 0.23, 0.23, 0.0, WALL_H);
    grain(0.06);
  } else if (kind === 'guest') { // spare room: faded sage stripes, water stains, old
    band(0, WALL_H, '#a9b4a4');
    for (let x = 0; x < W; x += X(0.2)) { g.fillStyle = 'rgba(70,80,60,0.18)'; g.fillRect(x, 0, X(0.07), H); g.fillStyle = 'rgba(255,255,240,0.1)'; g.fillRect(x + X(0.09), 0, 4, H); }
    panelWainscot(0.85, '#d8d2c4', 'rgba(60,50,40,0.45)', 'rgba(255,255,250,0.5)');
    band(0.83, 0.88, '#e8e2d4', '#b0b0b0');
    grain(0.3);
    for (const [cx, cy, r] of [[0.35, 2.4, 120], [1.1, 1.6, 70]]) {
      const sg = g.createRadialGradient(X(cx), Y(cy), 4, X(cx), Y(cy), r);
      sg.addColorStop(0, 'rgba(70,55,30,0.4)'); sg.addColorStop(0.7, 'rgba(70,55,30,0.15)'); sg.addColorStop(1, 'rgba(70,55,30,0)');
      g.fillStyle = sg; g.fillRect(0, 0, W, H);
    }
  } else if (kind === 'stream') { // deep plum paint, soft stars and moons stenciled on
    band(0, WALL_H, '#3a2450');
    motif((x, y, j, i) => { if ((i + j) % 3 === 0) star(x, y, 9, 'rgba(255,190,240,0.16)'); else star(x, y, 4, 'rgba(255,255,255,0.1)'); }, 0.35, 0.3, 0.2, WALL_H);
    grain(0.18);
  } else if (kind === 'bedroom') { // pastel pink wallpaper with little hearts and stars, cream wainscot
    band(0, WALL_H, '#e9b7c8');
    for (let x = 0; x < W; x += X(0.14)) { g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(x, 0, X(0.05), H); }
    motif((x, y, j) => (j % 2 ? heart(x, y, 9, 'rgba(255,255,255,0.55)') : star(x, y, 8, 'rgba(255,240,170,0.6)')), 0.2, 0.2, 0.95, WALL_H);
    panelWainscot(0.95, '#f3e6e8', 'rgba(150,100,110,0.45)', 'rgba(255,255,255,0.6)');
    band(0.93, 0.98, '#fff6f4', '#b0b0b0');
    grain(0.1);
  } else if (kind === 'hall') { // old damask wallpaper over dark wood wainscot (the house is old)
    band(0, WALL_H, '#3e2a36');
    motif((x, y) => damask(x, y, 34, 'rgba(160,110,90,0.35)'), 0.35, 0.42, 1.0, WALL_H);
    panelWainscot(1.0, '#4a2e20', 'rgba(20,10,5,0.6)', 'rgba(160,110,70,0.35)');
    band(0.97, 1.03, '#5a3a26', '#b0b0b0');
    grain(0.25);
    // water stain + peeling seam
    const sg = g.createRadialGradient(X(0.9), Y(2.35), 5, X(0.9), Y(2.35), 110);
    sg.addColorStop(0, 'rgba(60,40,20,0.35)'); sg.addColorStop(1, 'rgba(60,40,20,0)');
    g.fillStyle = sg; g.fillRect(0, 0, W, Y(1.2));
  } else if (kind === 'kitchen') { // pale mint paint, darker skirting band
    band(0, WALL_H, '#cfe3d6');
    band(0, 0.1, '#9fb8a8');
    grain(0.12);
  } else if (kind === 'living') { // warm beige with fine vertical pinstripes and a floral repeat
    band(0, WALL_H, '#d6c3a2');
    for (let x = 0; x < W; x += X(0.1)) { g.fillStyle = 'rgba(120,80,40,0.12)'; g.fillRect(x, 0, 3, H); }
    motif((x, y, j) => { g.fillStyle = 'rgba(150,70,60,0.22)'; for (let k = 0; k < 5; k++) { const a = k * Math.PI * 2 / 5; g.beginPath(); g.ellipse(x + Math.cos(a) * 9, y + Math.sin(a) * 9, 7, 4.5, a, 0, Math.PI * 2); g.fill(); } g.fillStyle = 'rgba(200,150,60,0.35)'; g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); }, 0.35, 0.35, 0.9, WALL_H);
    panelWainscot(0.9, '#b89a78', 'rgba(60,35,15,0.5)', 'rgba(255,240,210,0.35)');
    band(0.88, 0.93, '#8a6a4a', '#b0b0b0');
    grain(0.14);
  } else if (kind === 'bath') { // mint tiles to 1.4 m, paint above
    band(0, WALL_H, '#d8e6e4');
    const tile = 0.14, top = 1.4;
    for (let yy = 0; yy < top - 1e-6; yy += tile) for (let xx = 0; xx < meters - 1e-6; xx += tile) {
      const x0 = X(xx), x1 = X(xx + tile), y1 = Y(yy), y0 = Y(yy + tile);
      const tone = 0.93 + 0.07 * n(xx / meters, yy / WALL_H);
      g.fillStyle = `rgb(${150 * tone},${205 * tone},${192 * tone})`; g.fillRect(x0, y0, x1 - x0, y1 - y0);
      g.strokeStyle = '#8fa8a2'; g.lineWidth = 3; g.strokeRect(x0, y0, x1 - x0, y1 - y0);
      hg.fillStyle = '#a0a0a0'; hg.fillRect(x0 + 2, y0 + 2, x1 - x0 - 4, y1 - y0 - 4);
      hg.strokeStyle = '#505050'; hg.lineWidth = 3; hg.strokeRect(x0, y0, x1 - x0, y1 - y0);
    }
    band(top, top + 0.04, '#f2f2ee', '#b8b8b8');
    grain(0.1);
  }
  // soft grime near the floor on every wall
  const gg = g.createLinearGradient(0, Y(0.35), 0, H);
  gg.addColorStop(0, 'rgba(0,0,0,0)'); gg.addColorStop(1, 'rgba(20,10,20,0.22)');
  g.fillStyle = gg; g.fillRect(0, Y(0.35), W, H - Y(0.35));

  const hd = hg.getImageData(0, 0, W, H).data, height = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) height[i] = hd[i * 4] / 255 + (n((i % W) / W, Math.floor(i / W) / H) - 0.5) * 0.08;
  return { map: toTexture(c), normalMap: normalFromHeight(height, W, H, 2), metersU: meters, metersV: WALL_H, canvas: c };
}

// ---------------------------------------------------------------- one-off art (not tiling)
/** Draw a picture into a canvas texture (for posters, screens, rugs…). Redraws once the Thai fonts load. */
export function art(w, h, draw, { fonts = true } = {}) {
  const [c, g] = canvas(w, h);
  draw(g, w, h);
  const t = toTexture(c, { repeat: false });
  if (fonts && document.fonts && document.fonts.load) {
    Promise.all([document.fonts.load('700 40px Kanit'), document.fonts.load('600 40px Mitr')])
      .then(() => { g.clearRect(0, 0, w, h); draw(g, w, h); t.needsUpdate = true; })
      .catch(() => {});
  }
  t.userData.canvas = c; t.userData.ctx = g; t.userData.draw = draw;
  return t;
}
export { mulberry, fbm };
