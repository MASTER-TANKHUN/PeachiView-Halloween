// Peachi's face, painted on a 1024² canvas and projected straight onto the front of the head
// (planar UVs, see FACE_WINDOW). Four expressions from the reference sheet + blink.
import * as THREE from 'three';

export const EXPRESSIONS = ['happy', 'cry', 'angry', 'scream'];

/** Model-space window (meters, rest pose) the canvas covers. model.js projects UVs with it. */
export const FACE_WINDOW = { x0: -0.085, x1: 0.085, y0: 1.345, y1: 1.515 };

const S = 1024;
const PX = S / (FACE_WINDOW.y1 - FACE_WINDOW.y0);           // px per meter
const Y = (m) => (FACE_WINDOW.y1 - m) * PX;                  // model height → canvas y
const CX = S / 2;
const EYE_Y = Y(1.447), EYE_DX = 0.034 * PX;                 // ≈ 410, 205
const BROW_Y = Y(1.489), NOSE_Y = Y(1.418), MOUTH_Y = Y(1.398), BLUSH_Y = Y(1.427);

const LASH = '#2a110d', LINE = '#6a3226', BROW = '#4b2318', MOUTH_IN = '#6e1a28', LIP = '#4e1519';

function ell(ctx, x, y, rx, ry, rot = 0) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); }

// ---------------------------------------------------------------- eyes
// side: -1 = canvas-left (her right eye), +1 = canvas-right (her left eye). "inner" = toward the nose.
function eyeGeom(side, o) {
  const cx = CX + side * EYE_DX, cy = EYE_Y + (o.dy || 0);
  const w = o.w ?? 104, h = (o.h ?? 92) * (o.open ?? 1);
  return { cx, cy, w, h, inner: cx - side * w, outer: cx + side * w };
}

// the visible eye opening: upper lid arc (flatter toward the inner corner), rounder lower lid
function openingPath(ctx, g, side, o) {
  const { cx, cy, w, h, inner, outer } = g;
  const slant = o.glare ? h * 0.55 : o.sad ? -h * 0.18 : 0;   // + = lid lower on the inner side
  ctx.beginPath();
  ctx.moveTo(inner, cy + h * 0.1 + slant * 0.4);
  ctx.bezierCurveTo(inner + side * w * 0.3, cy - h * 0.95 + slant, outer - side * w * 0.35, cy - h * 1.05 - slant * 0.2, outer + side * w * 0.04, cy - h * 0.2);
  ctx.bezierCurveTo(outer - side * w * 0.05, cy + h * 0.7, cx + side * w * 0.2, cy + h * 1.02, cx - side * w * 0.2, cy + h * 0.98);
  ctx.bezierCurveTo(inner + side * w * 0.2, cy + h * 0.9, inner - side * 2, cy + h * 0.5, inner, cy + h * 0.1 + slant * 0.4);
  ctx.closePath();
}

function drawEye(ctx, side, o = {}) {
  const g = eyeGeom(side, o);
  const { cx, cy, w, h, inner, outer } = g;
  if (o.closed) {
    ctx.save();
    ctx.strokeStyle = LASH; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.lineWidth = 13;
    ctx.beginPath(); ctx.moveTo(inner, cy + 8); ctx.quadraticCurveTo(cx, cy + 40, outer + side * 6, cy + 4); ctx.stroke();
    ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(outer, cy + 6); ctx.lineTo(outer + side * 22, cy - 6); ctx.stroke();
    ctx.restore();
    return;
  }
  ctx.save();
  openingPath(ctx, g, side, o); ctx.clip();
  // sclera with a cool shadow under the lid
  ctx.fillStyle = '#fffaf7'; ctx.fillRect(cx - w * 1.3, cy - h * 1.3, w * 2.6, h * 2.6);
  const sg = ctx.createLinearGradient(0, cy - h, 0, cy);
  sg.addColorStop(0, 'rgba(150,120,170,0.55)'); sg.addColorStop(1, 'rgba(150,120,170,0)');
  ctx.fillStyle = sg; ctx.fillRect(cx - w * 1.3, cy - h * 1.3, w * 2.6, h * 1.3);

  // iris
  const ir = o.iris ?? 1;
  const iw = w * 0.7 * ir, ih = h * 1.02 * ir;
  const icx = cx + side * (o.irisDx ?? -4), icy = cy + (o.irisDy ?? 10);
  const ig = ctx.createLinearGradient(0, icy - ih, 0, icy + ih);
  ig.addColorStop(0, o.angry ? '#4a0f06' : '#3b150b');
  ig.addColorStop(0.32, o.angry ? '#9c2d12' : '#8e3a17');
  ig.addColorStop(0.62, '#d9772a');
  ig.addColorStop(0.86, '#f7ad45');
  ig.addColorStop(1, '#ffe08a');
  ctx.fillStyle = ig; ell(ctx, icx, icy, iw, ih); ctx.fill();
  // fine radial striations
  ctx.save(); ell(ctx, icx, icy, iw, ih); ctx.clip();
  ctx.strokeStyle = 'rgba(255,210,140,0.18)'; ctx.lineWidth = 2;
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(icx + Math.cos(a) * iw * 0.35, icy + Math.sin(a) * ih * 0.35); ctx.lineTo(icx + Math.cos(a) * iw, icy + Math.sin(a) * ih); ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = '#3a1409'; ctx.lineWidth = 5; ell(ctx, icx, icy, iw, ih); ctx.stroke();
  // pupil with warm ring
  const p = o.pupil ?? 1;
  ctx.fillStyle = 'rgba(120,40,10,0.65)'; ell(ctx, icx, icy - ih * 0.04, iw * 0.55 * p, ih * 0.55 * p); ctx.fill();
  ctx.fillStyle = '#1c0804'; ell(ctx, icx, icy - ih * 0.06, iw * 0.38 * p, ih * 0.42 * p); ctx.fill();
  // lid shadow over the iris top
  const lg = ctx.createLinearGradient(0, cy - h, 0, cy - h * 0.25);
  lg.addColorStop(0, 'rgba(40,10,20,0.6)'); lg.addColorStop(1, 'rgba(40,10,20,0)');
  ctx.fillStyle = lg; ctx.fillRect(cx - w * 1.3, cy - h * 1.3, w * 2.6, h * 1.05);
  // highlights: big white upper-left, cyan + pink catch lights (sheet signature), small lower sparkle
  const hp = Math.max(p, 0.7);
  ctx.fillStyle = '#ffffff';
  ell(ctx, icx - iw * 0.4, icy - ih * 0.42, iw * 0.3 * hp, ih * 0.2 * hp, -0.3); ctx.fill();
  ctx.fillStyle = '#48e3ff'; ell(ctx, icx - iw * 0.02, icy - ih * 0.55, iw * 0.13, ih * 0.1); ctx.fill();
  ctx.fillStyle = '#ff4fa3'; ell(ctx, icx + iw * 0.3, icy - ih * 0.5, iw * 0.13, ih * 0.1); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.95)'; ell(ctx, icx + iw * 0.38, icy + ih * 0.46, iw * 0.1, ih * 0.07); ctx.fill();
  if (o.teary) {
    const tg = ctx.createLinearGradient(0, cy + h * 0.2, 0, cy + h);
    tg.addColorStop(0, 'rgba(190,235,255,0)'); tg.addColorStop(1, 'rgba(190,235,255,0.85)');
    ctx.fillStyle = tg; ctx.fillRect(cx - w * 1.3, cy + h * 0.2, w * 2.6, h);
    ctx.fillStyle = '#ffffff';
    ell(ctx, icx + iw * 0.05, icy + ih * 0.1, iw * 0.12, ih * 0.08); ctx.fill();
    ell(ctx, icx - iw * 0.55, icy + ih * 0.55, 6, 6); ctx.fill();
  }
  ctx.restore();

  // ---- lines on top
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const slant = o.glare ? h * 0.55 : o.sad ? -h * 0.18 : 0;
  // upper lash: thick, tapering toward the inner corner, with an outer flick
  ctx.fillStyle = LASH;
  ctx.beginPath();
  ctx.moveTo(inner - side * 4, cy + h * 0.06 + slant * 0.4);
  ctx.bezierCurveTo(inner + side * w * 0.3, cy - h * 1.0 + slant, outer - side * w * 0.35, cy - h * 1.12 - slant * 0.2, outer + side * w * 0.26, cy - h * 0.34);
  ctx.lineTo(outer + side * w * 0.08, cy - h * 0.12);
  ctx.bezierCurveTo(outer - side * w * 0.3, cy - h * 0.86 - slant * 0.2, inner + side * w * 0.32, cy - h * 0.76 + slant, inner + side * 2, cy + h * 0.14 + slant * 0.4);
  ctx.closePath(); ctx.fill();
  // lash spikes at the outer end
  ctx.strokeStyle = LASH; ctx.lineWidth = 6;
  for (const [dx, dy, lx, ly] of [[0.62, -0.95, 0.9, -1.25], [0.82, -0.72, 1.14, -0.92], [0.95, -0.46, 1.26, -0.54]]) {
    ctx.beginPath(); ctx.moveTo(cx + side * w * dx, cy + h * dy - slant * 0.1); ctx.lineTo(cx + side * w * lx, cy + h * ly - slant * 0.1); ctx.stroke();
  }
  // double-eyelid crease
  ctx.strokeStyle = 'rgba(110,50,38,0.75)'; ctx.lineWidth = 3.5;
  ctx.beginPath(); ctx.moveTo(inner + side * w * 0.35, cy - h * 1.12 + slant * 0.8);
  ctx.quadraticCurveTo(cx + side * w * 0.2, cy - h * 1.42 + slant * 0.3, outer + side * w * 0.05, cy - h * 1.06); ctx.stroke();
  // lower lash: short, only toward the outer corner
  ctx.strokeStyle = LINE; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(cx + side * w * 0.1, cy + h * 1.0); ctx.quadraticCurveTo(outer - side * w * 0.12, cy + h * 0.86, outer + side * w * 0.02, cy + h * 0.3); ctx.stroke();
  if (o.wide) { // scream: full lower line + inner corner
    ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.moveTo(inner, cy + h * 0.25); ctx.quadraticCurveTo(cx - side * w * 0.3, cy + h * 1.05, cx + side * w * 0.1, cy + h * 1.0); ctx.stroke();
  }
  ctx.restore();
}

function drawBrow(ctx, side, kind) {
  const cx = CX + side * (EYE_DX + 6);
  const y = BROW_Y;
  ctx.save();
  ctx.fillStyle = BROW;
  ctx.beginPath();
  if (kind === 'worried') { // inner ends raised
    ctx.moveTo(cx - side * 78, y - 30); ctx.quadraticCurveTo(cx, y - 14, cx + side * 84, y + 16);
    ctx.quadraticCurveTo(cx + side * 6, y - 4, cx - side * 78, y - 22);
  } else if (kind === 'angry') { // inner ends pulled down
    ctx.moveTo(cx - side * 76, y + 30); ctx.quadraticCurveTo(cx, y + 4, cx + side * 86, y - 22);
    ctx.quadraticCurveTo(cx - side * 2, y + 14, cx - side * 76, y + 40);
  } else if (kind === 'raised') {
    ctx.moveTo(cx - side * 78, y - 14); ctx.quadraticCurveTo(cx, y - 64, cx + side * 84, y - 10);
    ctx.quadraticCurveTo(cx, y - 52, cx - side * 78, y - 6);
  } else {
    ctx.moveTo(cx - side * 78, y + 4); ctx.quadraticCurveTo(cx, y - 26, cx + side * 84, y + 2);
    ctx.quadraticCurveTo(cx, y - 16, cx - side * 78, y + 12);
  }
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

function drawBlush(ctx, strength = 1, rgb = '255,110,140') {
  for (const side of [-1, 1]) {
    const x = CX + side * 0.046 * PX, y = BLUSH_Y + 10;
    const g = ctx.createRadialGradient(x, y, 4, x, y, 92);
    g.addColorStop(0, `rgba(${rgb},${0.5 * strength})`); g.addColorStop(0.6, `rgba(${rgb},${0.22 * strength})`); g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g; ell(ctx, x, y, 100, 54); ctx.fill();
    ctx.fillStyle = `rgba(255,255,255,${0.7 * strength})`; ell(ctx, x - side * 30, y - 24, 5, 5); ctx.fill();
  }
}

function drawNose(ctx) {
  ctx.save();
  ctx.strokeStyle = 'rgba(196,112,98,0.85)'; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(CX + 8, NOSE_Y - 10); ctx.quadraticCurveTo(CX + 2, NOSE_Y + 4, CX - 8, NOSE_Y + 6); ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------- mouths
function mouthPath(ctx, kind) {
  const y = MOUTH_Y;
  ctx.beginPath();
  if (kind === 'happy') {
    ctx.moveTo(CX - 66, y - 18);
    ctx.bezierCurveTo(CX - 30, y - 8, CX + 30, y - 8, CX + 66, y - 18);
    ctx.bezierCurveTo(CX + 58, y + 42, CX + 26, y + 70, CX, y + 70);
    ctx.bezierCurveTo(CX - 26, y + 70, CX - 58, y + 42, CX - 66, y - 18);
  } else if (kind === 'cry') {
    ctx.moveTo(CX - 30, y + 14);
    ctx.bezierCurveTo(CX - 14, y - 6, CX + 14, y - 6, CX + 30, y + 14);
    ctx.bezierCurveTo(CX + 14, y + 4, CX - 14, y + 4, CX - 30, y + 14);
  } else if (kind === 'angry') {
    ctx.moveTo(CX - 62, y - 6);
    ctx.lineTo(CX - 40, y - 14); ctx.lineTo(CX - 20, y - 6); ctx.lineTo(CX, y - 14); ctx.lineTo(CX + 20, y - 6); ctx.lineTo(CX + 40, y - 14); ctx.lineTo(CX + 62, y - 6);
    ctx.bezierCurveTo(CX + 52, y + 26, CX + 34, y + 46, CX + 16, y + 38);
    ctx.lineTo(CX, y + 46); ctx.lineTo(CX - 16, y + 38);
    ctx.bezierCurveTo(CX - 34, y + 46, CX - 52, y + 26, CX - 62, y - 6);
  } else { // scream: tall rounded trapezoid
    ctx.moveTo(CX - 50, y - 26);
    ctx.bezierCurveTo(CX - 20, y - 36, CX + 20, y - 36, CX + 50, y - 26);
    ctx.bezierCurveTo(CX + 62, y + 40, CX + 44, y + 108, CX, y + 110);
    ctx.bezierCurveTo(CX - 44, y + 108, CX - 62, y + 40, CX - 50, y - 26);
  }
  ctx.closePath();
}

const MOUTH_SCALE = { happy: [1.25, 1.18], cry: [1.2, 1.2], angry: [1.3, 1.3], scream: [1.05, 1.02] };

function drawMouth(ctx, kind) {
  const y = MOUTH_Y;
  ctx.save();
  const [sx, sy] = MOUTH_SCALE[kind];
  ctx.translate(CX, y); ctx.scale(sx, sy); ctx.translate(-CX, -y);
  mouthPath(ctx, kind);
  const g = ctx.createLinearGradient(0, y - 30, 0, y + 110);
  g.addColorStop(0, '#4a0d18'); g.addColorStop(1, '#a8323f');
  ctx.fillStyle = kind === 'cry' ? '#b8485a' : g; ctx.fill();
  ctx.save(); mouthPath(ctx, kind); ctx.clip();
  if (kind === 'happy') {
    ctx.fillStyle = '#fffaf6'; ctx.fillRect(CX - 70, y - 30, 140, 22);
    ctx.fillStyle = '#ff8597'; ell(ctx, CX, y + 64, 44, 30); ctx.fill();
  } else if (kind === 'angry') {
    ctx.fillStyle = '#ff8597'; ell(ctx, CX, y + 46, 34, 16); ctx.fill();
  } else if (kind === 'scream') {
    ctx.fillStyle = '#fffaf6'; ctx.fillRect(CX - 70, y - 40, 140, 26);
    ctx.fillStyle = '#ff8597'; ell(ctx, CX, y + 104, 46, 34); ctx.fill();
    ctx.fillStyle = '#ff9fb2'; ell(ctx, CX, y - 8, 7, 11); ctx.fill();
  }
  ctx.restore();
  if (kind === 'angry') { // fangs
    ctx.fillStyle = '#fffaf6'; ctx.strokeStyle = LIP; ctx.lineWidth = 2.5;
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(CX + s * 30, y - 9); ctx.lineTo(CX + s * 48, y - 12); ctx.lineTo(CX + s * 40, y + 14); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  }
  ctx.strokeStyle = LIP; ctx.lineWidth = kind === 'cry' ? 5 : 5.5; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  mouthPath(ctx, kind); ctx.stroke();
  ctx.restore();
}

function drawTears(ctx) {
  for (const side of [-1, 1]) {
    const cx = CX + side * EYE_DX;
    // pooled droplets on the lower lid (like the sheet), inner + outer
    for (const [dx, r] of [[-0.55, 22], [0.45, 26]]) {
      const x = cx + side * 104 * dx, y = EYE_Y + 92;
      const g = ctx.createRadialGradient(x - 6, y - 8, 2, x, y, r);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, 'rgba(200,238,255,0.95)'); g.addColorStop(1, 'rgba(120,190,240,0.9)');
      ctx.fillStyle = g; ell(ctx, x, y, r, r * 0.8); ctx.fill();
      ctx.strokeStyle = 'rgba(70,120,180,0.8)'; ctx.lineWidth = 3; ell(ctx, x, y, r, r * 0.8); ctx.stroke();
    }
    // a thin streak down the cheek
    const x = cx - side * 30, y0 = EYE_Y + 110;
    const sg = ctx.createLinearGradient(0, y0, 0, y0 + 130);
    sg.addColorStop(0, 'rgba(170,225,255,0.9)'); sg.addColorStop(1, 'rgba(170,225,255,0)');
    ctx.fillStyle = sg;
    ctx.beginPath(); ctx.moveTo(x - 7, y0); ctx.quadraticCurveTo(x - 10, y0 + 70, x - 2, y0 + 130); ctx.lineTo(x + 6, y0 + 130); ctx.quadraticCurveTo(x + 9, y0 + 70, x + 7, y0); ctx.fill();
  }
}

/** Paint a face on a 2D context (1024² space; `size` scales it). */
export function drawFace(ctx, name = 'happy', { blink = false, size = S } = {}) {
  ctx.save();
  ctx.clearRect(0, 0, size, size);
  ctx.scale(size / S, size / S);
  if (name === 'cry') {
    drawBlush(ctx, 1.25);
    drawBrow(ctx, -1, 'worried'); drawBrow(ctx, 1, 'worried');
    for (const s of [-1, 1]) drawEye(ctx, s, { open: 0.88, sad: true, teary: true, closed: blink, irisDy: 14 });
    if (!blink) drawTears(ctx);
    drawNose(ctx); drawMouth(ctx, 'cry');
  } else if (name === 'angry') {
    drawBlush(ctx, 1.1, '255,85,95');
    drawBrow(ctx, -1, 'angry'); drawBrow(ctx, 1, 'angry');
    for (const s of [-1, 1]) drawEye(ctx, s, { glare: true, angry: true, iris: 0.9, pupil: 0.8, closed: blink, irisDy: 16 });
    drawNose(ctx); drawMouth(ctx, 'angry');
  } else if (name === 'scream') {
    ctx.save(); // pale shock shading on the forehead
    ctx.translate(CX, BROW_Y - 40); ctx.scale(1, 0.45);
    const g = ctx.createRadialGradient(0, 0, 20, 0, 0, 300);
    g.addColorStop(0, 'rgba(80,100,200,0.5)'); g.addColorStop(1, 'rgba(80,100,200,0)');
    ctx.fillStyle = g; ctx.fillRect(-320, -320, 640, 640);
    ctx.restore();
    ctx.strokeStyle = 'rgba(70,80,170,0.55)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(CX + i * 34, BROW_Y - 70); ctx.lineTo(CX + i * 34, BROW_Y - 10); ctx.stroke(); }
    drawBlush(ctx, 0.45);
    drawBrow(ctx, -1, 'raised'); drawBrow(ctx, 1, 'raised');
    for (const s of [-1, 1]) drawEye(ctx, s, { w: 108, h: 104, iris: 0.55, pupil: 0.5, irisDy: 0, wide: true });
    drawNose(ctx); drawMouth(ctx, 'scream');
    ctx.fillStyle = 'rgba(180,230,255,0.95)'; ctx.strokeStyle = 'rgba(70,120,180,0.8)'; ctx.lineWidth = 3; // sweat drop
    const sx = CX + 330, sy = EYE_Y - 40;
    ctx.beginPath(); ctx.moveTo(sx, sy - 44); ctx.quadraticCurveTo(sx + 26, sy + 2, sx, sy + 12); ctx.quadraticCurveTo(sx - 26, sy + 2, sx, sy - 44); ctx.fill(); ctx.stroke();
  } else {
    drawBlush(ctx, 1);
    drawBrow(ctx, -1, 'soft'); drawBrow(ctx, 1, 'soft');
    for (const s of [-1, 1]) drawEye(ctx, s, { closed: blink });
    drawNose(ctx); drawMouth(ctx, 'happy');
  }
  ctx.restore();
}

/** Red anger mark (the popping-vein cross), shown as a sprite by the head in 'angry'. */
export function makeAngerMarkTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const ctx = c.getContext('2d');
  ctx.translate(64, 64);
  ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    ctx.save(); ctx.rotate(i * Math.PI / 2 + Math.PI / 4);
    for (const [col, lw] of [['#ffffff', 24], ['#d81e3a', 14]]) {
      ctx.strokeStyle = col; ctx.lineWidth = lw;
      ctx.beginPath(); ctx.moveTo(-20, -46); ctx.quadraticCurveTo(-12, -16, -44, -20); ctx.stroke();
    }
    ctx.restore();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Face controller: owns the canvas + texture, redraws on expression change and blinks. */
export function createFace() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  let expression = 'happy', blinking = false, nextBlink = 2 + Math.random() * 3, blinkEnd = 0;

  function redraw() { drawFace(ctx, expression, { blink: blinking }); texture.needsUpdate = true; }
  redraw();

  return {
    canvas, texture,
    get expression() { return expression; },
    setExpression(name) {
      if (!EXPRESSIONS.includes(name)) name = 'happy';
      if (name === expression) return;
      expression = name; blinking = false; redraw();
    },
    update(dt, t) {
      if (expression === 'scream') return; // shocked eyes never blink
      if (!blinking && t >= nextBlink) { blinking = true; blinkEnd = t + 0.12; redraw(); }
      else if (blinking && t >= blinkEnd) { blinking = false; nextBlink = t + 2.2 + Math.random() * 3.5; redraw(); }
    },
    dispose() { texture.dispose(); },
  };
}
