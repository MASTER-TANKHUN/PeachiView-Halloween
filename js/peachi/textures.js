// Peachi print atlas: every printed surface on her outfit lives in one 2048² canvas texture.
// Lettering is drawn with hand-built stroke glyphs so "PEΛCHI" matches the sheet without web fonts.
import * as THREE from 'three';

const SIZE = 2048;
const TAU = Math.PI * 2;

// pixel rects [x, y, w, h] (canvas space, y down)
const RECTS = {
  skirt: [0, 0, 1024, 512],
  crop: [0, 512, 1024, 256],
  sock: [1024, 0, 512, 1024],
  banner: [1536, 0, 512, 768],
  strap: [0, 768, 128, 1024],
  cup: [128, 768, 256, 256],
  emblem: [384, 768, 128, 128],
  tag: [384, 896, 128, 128],
  white: [2024, 2024, 24, 24],
};

export const PINK = '#ff86b9', PINK_DEEP = '#ec5a9a', PINK_PALE = '#ffd3e6', INK = '#1f1b2c', CORAL = '#f2546f';

// ------------------------------------------------------------------ stroke lettering
// Glyph strokes in a box of height 1 (y down). w = advance width.
const GLYPHS = {
  P: { w: 0.66, d: (c) => { c.moveTo(0, 1); c.lineTo(0, 0); c.lineTo(0.38, 0); c.bezierCurveTo(0.7, 0, 0.7, 0.54, 0.38, 0.54); c.lineTo(0, 0.54); } },
  E: { w: 0.58, d: (c) => { c.moveTo(0.58, 0); c.lineTo(0, 0); c.lineTo(0, 1); c.lineTo(0.58, 1); c.moveTo(0, 0.5); c.lineTo(0.5, 0.5); } },
  A: { w: 0.74, d: (c) => { c.moveTo(0, 1); c.lineTo(0.37, 0); c.lineTo(0.74, 1); } }, // Λ, as on the sheet
  C: { w: 0.66, d: (c) => { c.moveTo(0.64, 0.14); c.bezierCurveTo(0.5, -0.04, 0.02, -0.06, 0.0, 0.5); c.bezierCurveTo(0.02, 1.06, 0.5, 1.04, 0.64, 0.86); } },
  H: { w: 0.66, d: (c) => { c.moveTo(0, 0); c.lineTo(0, 1); c.moveTo(0.66, 0); c.lineTo(0.66, 1); c.moveTo(0, 0.5); c.lineTo(0.66, 0.5); } },
  I: { w: 0, d: (c) => { c.moveTo(0, 0); c.lineTo(0, 1); } },
  2: { w: 0.62, d: (c) => { c.moveTo(0.02, 0.24); c.bezierCurveTo(0.06, -0.06, 0.62, -0.08, 0.6, 0.28); c.bezierCurveTo(0.58, 0.5, 0.3, 0.64, 0.0, 1); c.lineTo(0.62, 1); } },
  4: { w: 0.66, d: (c) => { c.moveTo(0.48, 1); c.lineTo(0.48, 0); c.lineTo(0, 0.7); c.lineTo(0.66, 0.7); } },
  9: { w: 0.6, d: (c) => { c.moveTo(0.6, 0.32); c.ellipse(0.3, 0.32, 0.3, 0.32, 0, 0, TAU); c.moveTo(0.6, 0.32); c.lineTo(0.6, 0.62); c.bezierCurveTo(0.6, 1.02, 0.12, 1.08, 0.02, 0.84); } },
};

export function wordWidth(text, h, track = 0.34) {
  let w = 0;
  for (const ch of text) w += (GLYPHS[ch]?.w ?? 0.5) * h + track * h;
  return w - track * h;
}

/** Draw monoline lettering. (x, y) = left/center/right edge × top of the caps. */
export function drawWord(ctx, text, x, y, h, { lw = h * 0.16, color = '#fff', align = 'left', track = 0.34 } = {}) {
  const w = wordWidth(text, h, track);
  let cx = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const ch of text) {
    const g = GLYPHS[ch];
    if (g) {
      ctx.save(); ctx.translate(cx, y); ctx.scale(h, h); ctx.lineWidth = lw / h;
      ctx.beginPath(); g.d(ctx); ctx.stroke(); ctx.restore();
    }
    cx += (g?.w ?? 0.5) * h + track * h;
  }
  ctx.restore();
  return w;
}

// ------------------------------------------------------------------ peach logo
function peachPath(ctx, cx, cy, r) {
  // two lobes meeting in a soft cleft on top, pointed bottom like the sheet's logo
  ctx.beginPath();
  ctx.moveTo(cx, cy - r * 0.55);
  ctx.bezierCurveTo(cx - r * 0.35, cy - r * 0.95, cx - r * 1.02, cy - r * 0.62, cx - r * 0.98, cy + r * 0.02);
  ctx.bezierCurveTo(cx - r * 0.94, cy + r * 0.62, cx - r * 0.45, cy + r * 0.96, cx, cy + r * 0.98);
  ctx.bezierCurveTo(cx + r * 0.45, cy + r * 0.96, cx + r * 0.94, cy + r * 0.62, cx + r * 0.98, cy + r * 0.02);
  ctx.bezierCurveTo(cx + r * 1.02, cy - r * 0.62, cx + r * 0.35, cy - r * 0.95, cx, cy - r * 0.55);
  ctx.closePath();
}
function peachLeaf(ctx, cx, cy, r, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx + r * 0.02, cy - r * 0.62);
  ctx.bezierCurveTo(cx + r * 0.2, cy - r * 1.12, cx + r * 0.7, cy - r * 1.05, cx + r * 0.72, cy - r * 0.98);
  ctx.bezierCurveTo(cx + r * 0.62, cy - r * 0.7, cx + r * 0.25, cy - r * 0.6, cx + r * 0.02, cy - r * 0.62);
  ctx.fill();
  ctx.restore();
}
/** style: 'fill' (pink peach, crop top / cups) · 'outline' (white outline on pink, banner) */
export function drawPeach(ctx, cx, cy, r, style = 'fill') {
  ctx.save();
  if (style === 'outline') {
    const g = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    g.addColorStop(0, 'rgba(255,255,255,0.18)'); g.addColorStop(0.5, 'rgba(255,190,220,0.55)'); g.addColorStop(1, 'rgba(220,120,220,0.5)');
    peachPath(ctx, cx, cy, r); ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = r * 0.14; ctx.lineJoin = 'round';
    peachPath(ctx, cx, cy, r); ctx.stroke();
    // inner cleft line
    ctx.beginPath(); ctx.moveTo(cx - r * 0.02, cy - r * 0.5); ctx.bezierCurveTo(cx - r * 0.48, cy - r * 0.1, cx - r * 0.42, cy + r * 0.6, cx + r * 0.12, cy + r * 0.86);
    ctx.lineWidth = r * 0.11; ctx.lineCap = 'round'; ctx.stroke();
    ctx.lineWidth = r * 0.1;
    ctx.beginPath(); ctx.moveTo(cx + r * 0.02, cy - r * 0.62);
    ctx.bezierCurveTo(cx + r * 0.2, cy - r * 1.12, cx + r * 0.7, cy - r * 1.05, cx + r * 0.72, cy - r * 0.98);
    ctx.bezierCurveTo(cx + r * 0.62, cy - r * 0.7, cx + r * 0.25, cy - r * 0.6, cx + r * 0.02, cy - r * 0.62);
    ctx.stroke();
  } else {
    const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.2, r * 0.05, cx, cy + r * 0.1, r * 1.1);
    g.addColorStop(0, '#ffe3ee'); g.addColorStop(0.45, '#ffa4c8'); g.addColorStop(1, '#f06aa2');
    peachPath(ctx, cx, cy, r); ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = '#e2558f'; ctx.lineWidth = r * 0.07; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - r * 0.02, cy - r * 0.5); ctx.bezierCurveTo(cx - r * 0.45, cy - r * 0.1, cx - r * 0.4, cy + r * 0.55, cx + r * 0.1, cy + r * 0.84);
    ctx.strokeStyle = 'rgba(214,70,130,0.8)'; ctx.lineWidth = r * 0.07; ctx.lineCap = 'round'; ctx.stroke();
    peachLeaf(ctx, cx, cy, r, '#6fc27a');
    ctx.strokeStyle = '#7b4b2c'; ctx.lineWidth = r * 0.07;
    ctx.beginPath(); ctx.moveTo(cx, cy - r * 0.55); ctx.lineTo(cx - r * 0.04, cy - r * 0.82); ctx.stroke();
  }
  ctx.restore();
}

function heartPath(ctx, cx, cy, s) {
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 0.9);
  ctx.bezierCurveTo(cx - s * 0.25, cy + s * 0.6, cx - s, cy + s * 0.28, cx - s, cy - s * 0.2);
  ctx.bezierCurveTo(cx - s, cy - s * 0.78, cx - s * 0.28, cy - s * 0.92, cx, cy - s * 0.45);
  ctx.bezierCurveTo(cx + s * 0.28, cy - s * 0.92, cx + s, cy - s * 0.78, cx + s, cy - s * 0.2);
  ctx.bezierCurveTo(cx + s, cy + s * 0.28, cx + s * 0.25, cy + s * 0.6, cx, cy + s * 0.9);
  ctx.closePath();
}

// ------------------------------------------------------------------ regions
function drawSkirt(ctx, w, h) {
  // u across = around the waist (0 back, 0.5 front), y down = waist → hem
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#24203a'); g.addColorStop(1, '#171425');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  // soft fold lines between pleats
  ctx.globalAlpha = 0.22; ctx.fillStyle = '#4a4468';
  for (let i = 0; i < 28; i++) { const x = (i + 0.5) * (w / 28); ctx.fillRect(x - 1.5, h * 0.12, 3, h * 0.78); }
  ctx.globalAlpha = 1;
  // holographic inverted pleat at the front
  const fx = w * 0.5, top = h * 0.3;
  const hg = ctx.createLinearGradient(fx - 60, top, fx + 60, h);
  hg.addColorStop(0, '#b8e6ff'); hg.addColorStop(0.35, '#f3d4ff'); hg.addColorStop(0.7, '#ffd0e6'); hg.addColorStop(1, '#d2f4ff');
  ctx.fillStyle = hg;
  ctx.beginPath(); ctx.moveTo(fx, top); ctx.lineTo(fx + 58, h * 0.9); ctx.lineTo(fx - 58, h * 0.9); ctx.closePath(); ctx.fill();
  // thin pink/white stripes
  for (const [y, a] of [[0.24, 0.9], [0.4, 0.95], [0.54, 1], [0.66, 1], [0.77, 1]]) {
    ctx.fillStyle = `rgba(255,190,220,${a})`; ctx.fillRect(0, h * y, w, 4);
    ctx.fillStyle = `rgba(255,120,180,${a * 0.9})`; ctx.fillRect(0, h * y + 4, w, 3);
  }
  // hem: pink band + white edge
  ctx.fillStyle = PINK; ctx.fillRect(0, h * 0.86, w, h * 0.09);
  ctx.fillStyle = '#ffc1dc'; ctx.fillRect(0, h * 0.86, w, 5);
  ctx.fillStyle = '#fbf6ff'; ctx.fillRect(0, h * 0.95, w, h * 0.05);
}

function drawCrop(ctx, w, h) {
  // u across = around the chest (0 back, 0.5 front); y down = neckline → hem
  ctx.fillStyle = '#fcf8fc'; ctx.fillRect(0, 0, w, h);
  const sh = ctx.createLinearGradient(0, 0, 0, h);
  sh.addColorStop(0, 'rgba(230,220,245,0)'); sh.addColorStop(1, 'rgba(210,200,235,0.35)');
  ctx.fillStyle = sh; ctx.fillRect(0, 0, w, h);
  // pink hem band with holo sheen and thin white line
  const hb = ctx.createLinearGradient(0, 0, w, 0);
  hb.addColorStop(0, '#ffb6d6'); hb.addColorStop(0.5, '#ff8cbf'); hb.addColorStop(1, '#ffb6d6');
  ctx.fillStyle = hb; ctx.fillRect(0, h - 40, w, 40);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, h - 44, w, 4);
  // vertical pink piping at the front sides, with gold keepers on the hem
  for (const s of [-1, 1]) {
    const x = w * (0.5 + s * 0.085);
    ctx.fillStyle = '#ff9cc8'; ctx.fillRect(x - 4, 0, 8, h - 40);
    ctx.fillStyle = '#e8b64a'; ctx.fillRect(x - 11, h - 42, 22, 38);
    ctx.fillStyle = '#fff1c2'; ctx.fillRect(x - 5, h - 36, 10, 26);
  }
  // neckline trim + tiny gold bead at the center
  ctx.fillStyle = '#ffc6de'; ctx.fillRect(0, 0, w, 6);
  ctx.fillStyle = '#e8b64a'; ctx.beginPath(); ctx.arc(w * 0.5, 14, 6, 0, TAU); ctx.fill();
  // peach logo + PEACHI
  drawPeach(ctx, w * 0.5, h * 0.42, 34, 'fill');
  drawWord(ctx, 'PEACHI', w * 0.5, h * 0.62, 20, { color: '#f05f9e', align: 'center', lw: 3.6 });
}

function drawSock(ctx, w, h) {
  // u across = around the leg (0 back, 0.5 front); y down = top of the sock → ankle
  ctx.fillStyle = '#fbfbff'; ctx.fillRect(0, 0, w, h);
  // faint circuit lines
  ctx.strokeStyle = 'rgba(190,200,240,0.7)'; ctx.lineWidth = 2;
  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 14; i++) {
    let x = rnd() * w, y = h * (0.35 + rnd() * 0.6);
    ctx.beginPath(); ctx.moveTo(x, y);
    for (let k = 0; k < 4; k++) { if (k % 2) x += (rnd() - 0.5) * 60; else y -= 30 + rnd() * 70; ctx.lineTo(x, y); }
    ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, 4, 0, TAU); ctx.stroke();
  }
  // top band
  ctx.fillStyle = '#ffc9df'; ctx.fillRect(0, 0, w, 26);
  ctx.fillStyle = PINK; ctx.fillRect(0, 26, w, 8);
  // front print: 249 / PEACH / barcode (front = middle of the canvas)
  const cx = w * 0.5;
  drawWord(ctx, '249', cx, 74, 58, { color: '#f45c9c', align: 'center', lw: 11, track: 0.22 });
  drawWord(ctx, 'PEACH', cx, 146, 24, { color: '#f45c9c', align: 'center', lw: 5.5, track: 0.3 });
  ctx.fillStyle = '#1d1a2a';
  let x = cx - 44; seed = 7;
  while (x < cx + 44) { const bw = 1 + Math.floor(rnd() * 4); ctx.fillRect(x, 182, bw, 26); x += bw + 1 + Math.floor(rnd() * 3); }
}

function drawBanner(ctx, w, h) {
  // pink banner with a V point; transparent outside the shape (alphaTest)
  ctx.clearRect(0, 0, w, h);
  const vy = h * 0.82;
  const shape = () => { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w, 0); ctx.lineTo(w, vy); ctx.lineTo(w / 2, h - 6); ctx.lineTo(0, vy); ctx.closePath(); };
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#f77fb6'); g.addColorStop(0.45, '#ff9fca'); g.addColorStop(1, '#f07ab2');
  shape(); ctx.fillStyle = g; ctx.fill();
  const glow = ctx.createRadialGradient(w / 2, h * 0.36, 10, w / 2, h * 0.4, w * 0.55);
  glow.addColorStop(0, 'rgba(255,240,200,0.55)'); glow.addColorStop(1, 'rgba(255,240,200,0)');
  ctx.fillStyle = glow; shape(); ctx.fill();
  ctx.save(); shape(); ctx.clip();
  ctx.strokeStyle = '#e65a98'; ctx.lineWidth = 26; shape(); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(22, 0); ctx.lineTo(22, vy - 8); ctx.lineTo(w / 2, h - 30); ctx.lineTo(w - 22, vy - 8); ctx.lineTo(w - 22, 0); ctx.stroke();
  ctx.restore();
  drawPeach(ctx, w / 2, h * 0.34, w * 0.2, 'outline');
  drawWord(ctx, 'PEACHI', w / 2, h * 0.58, 64, { color: '#ffffff', align: 'center', lw: 12, track: 0.26 });
}

function drawStrap(ctx, w, h) {
  ctx.fillStyle = '#f98bbd'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#ffc3dc'; ctx.fillRect(0, 0, 10, h); ctx.fillRect(w - 10, 0, 10, h);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(12, 0, 3, h); ctx.fillRect(w - 15, 0, 3, h);
  // text reads bottom → top like on the sheet
  ctx.save(); ctx.translate(w / 2, h * 0.52); ctx.rotate(-Math.PI / 2);
  drawWord(ctx, 'PEACHI', 0, -26, 52, { color: '#ffffff', align: 'center', lw: 8.5, track: 0.3 });
  ctx.restore();
  ctx.save(); ctx.translate(w / 2, h * 0.86); ctx.rotate(-Math.PI / 2); drawPeach(ctx, 0, 0, 26, 'outline'); ctx.restore();
}

function drawCup(ctx, w, h) {
  const g = ctx.createRadialGradient(w * 0.4, h * 0.38, 10, w / 2, h / 2, w / 2);
  g.addColorStop(0, '#ffc2dc'); g.addColorStop(0.7, '#ff86b9'); g.addColorStop(1, '#f06aa6');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(w / 2, h / 2, w * 0.43, 0, TAU); ctx.stroke();
  drawPeach(ctx, w / 2, h * 0.53, w * 0.22, 'outline');
}

function drawEmblem(ctx, w, h) {
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
  heartPath(ctx, w / 2, h / 2, w * 0.4); ctx.fillStyle = PINK; ctx.fill();
  ctx.strokeStyle = '#e8b64a'; ctx.lineWidth = 6; ctx.stroke();
  drawPeach(ctx, w / 2, h * 0.5, w * 0.2, 'outline');
}

function drawTag(ctx, w, h) {
  ctx.fillStyle = '#ff8fb8'; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 6; ctx.strokeRect(8, 8, w - 16, h - 16);
  heartPath(ctx, w / 2, h / 2, w * 0.24); ctx.lineWidth = 6; ctx.stroke();
}

/** Builds the atlas once per model. Returns { texture, rect(name) → [u0, v0, u1, v1], dispose }. */
export function createAtlas() {
  const c = document.createElement('canvas'); c.width = c.height = SIZE;
  const ctx = c.getContext('2d');
  const draws = { skirt: drawSkirt, crop: drawCrop, sock: drawSock, banner: drawBanner, strap: drawStrap, cup: drawCup, emblem: drawEmblem, tag: drawTag };
  for (const [name, fn] of Object.entries(draws)) {
    const [x, y, w, h] = RECTS[name];
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); ctx.translate(x, y);
    fn(ctx, w, h);
    ctx.restore();
  }
  const [wx, wy, ww, wh] = RECTS.white; ctx.fillStyle = '#ffffff'; ctx.fillRect(wx, wy, ww, wh);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  const inset = 1.5; // px, keeps mip filtering inside each region
  return {
    texture, canvas: c,
    rect(name) {
      const [x, y, w, h] = RECTS[name];
      return [(x + inset) / SIZE, 1 - (y + h - inset) / SIZE, (x + w - inset) / SIZE, 1 - (y + inset) / SIZE];
    },
    white() { const [x, y, w, h] = RECTS.white; const u = (x + w / 2) / SIZE, v = 1 - (y + h / 2) / SIZE; return [u, v, u, v]; },
    dispose() { texture.dispose(); },
  };
}
