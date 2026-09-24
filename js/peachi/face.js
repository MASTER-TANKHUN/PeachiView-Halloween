// Peachi face: drawn on a canvas, used as a CanvasTexture on the head's front patch.
// Canvas layout (512x512) maps onto a spherical patch (see model.js FACE_PATCH): eyes ~y262, mouth ~y405.
import * as THREE from 'three';

export const EXPRESSIONS = ['happy', 'cry', 'angry', 'scream'];

const S = 512;
const CX = 256;
const EYE_Y = 262;
const EYE_DX = 150;   // designed in "true aspect" space; compressed horizontally by SQUASH
const MOUTH_Y = 408;
const SQUASH = 0.8;   // the sphere patch is ~1.25x wider than tall per pixel

const LASH = '#2a120e';

function ell(ctx, x, y, rx, ry, rot = 0) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); }

// side: -1 = canvas-left eye (her right), +1 = canvas-right eye (her left)
function drawEye(ctx, side, o) {
  const cx = CX + side * EYE_DX, cy = EYE_Y + (o.dy || 0);
  const w = o.w || 58, h = (o.h || 74) * (o.open ?? 1);
  if (o.closed) { // blink / closed curve
    ctx.strokeStyle = LASH; ctx.lineWidth = 11; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx - w, cy + 4); ctx.quadraticCurveTo(cx, cy + 26, cx + w, cy + 4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - side * w, cy + 4); ctx.lineTo(cx - side * (w + 16), cy - 6); ctx.stroke();
    return;
  }
  const inner = cx - side * w, outer = cx + side * w; // inner = toward the nose
  ctx.save();
  ell(ctx, cx, cy, w, h); ctx.clip();
  if (o.glare) { // angry: upper lid slants down toward the nose
    ctx.beginPath();
    ctx.moveTo(outer + side * 10, cy - h * 0.55);
    ctx.lineTo(inner - side * 10, cy - h * 0.05);
    ctx.lineTo(inner - side * 10, cy + h + 10);
    ctx.lineTo(outer + side * 10, cy + h + 10);
    ctx.closePath(); ctx.clip();
  }
  ctx.fillStyle = '#fffaf6'; ctx.fillRect(cx - w - 2, cy - h - 2, w * 2 + 4, h * 2 + 4);
  const ir = o.iris ?? 1;
  const iw = w * 0.86 * ir, ih = h * 0.9 * ir;
  const icy = cy + (o.irisDy ?? 6);
  const g = ctx.createLinearGradient(0, icy - ih, 0, icy + ih);
  g.addColorStop(0, o.angryTint ? '#5a1406' : '#4a1c0a');
  g.addColorStop(0.35, o.angryTint ? '#c24a1a' : '#b8601e');
  g.addColorStop(0.75, '#e8912f');
  g.addColorStop(1, '#ffd98a');
  ctx.fillStyle = g; ell(ctx, cx, icy, iw, ih); ctx.fill();
  ctx.strokeStyle = 'rgba(70,25,8,0.9)'; ctx.lineWidth = 4; ell(ctx, cx, icy, iw, ih); ctx.stroke();
  const p = o.pupil ?? 1;
  ctx.fillStyle = '#2a0e05'; ell(ctx, cx, icy - ih * 0.05, iw * 0.42 * p, ih * 0.48 * p); ctx.fill();
  // warm inner ring + pink reflection (like the sheet)
  ctx.fillStyle = 'rgba(255,150,120,0.55)'; ell(ctx, cx, icy + ih * 0.55, iw * 0.55, ih * 0.22); ctx.fill();
  if (o.teary) {
    const tg = ctx.createLinearGradient(0, cy, 0, cy + h);
    tg.addColorStop(0, 'rgba(170,225,255,0)'); tg.addColorStop(1, 'rgba(170,225,255,0.75)');
    ctx.fillStyle = tg; ctx.fillRect(cx - w, cy, w * 2, h);
  }
  // highlights
  ctx.fillStyle = '#ffffff';
  ell(ctx, cx - w * 0.28, icy - ih * 0.42, iw * 0.3 * Math.max(p, 0.6), ih * 0.24 * Math.max(p, 0.6)); ctx.fill();
  ell(ctx, cx + w * 0.3, icy + ih * 0.4, iw * 0.13, ih * 0.1); ctx.fill();
  if (o.teary) { ell(ctx, cx + w * 0.05, icy - ih * 0.05, iw * 0.12, ih * 0.09); ctx.fill(); ell(ctx, cx - w * 0.4, icy + ih * 0.3, 5, 5); ctx.fill(); }
  ctx.restore();

  // lashes / lids
  ctx.strokeStyle = LASH; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (o.glare) {
    ctx.lineWidth = 13;
    ctx.beginPath(); ctx.moveTo(outer + side * 12, cy - h * 0.58); ctx.lineTo(inner - side * 6, cy - h * 0.06); ctx.stroke();
  } else {
    ctx.lineWidth = 12;
    ctx.beginPath(); ctx.ellipse(cx, cy + 2, w + 3, h + 3, 0, Math.PI * 1.06, Math.PI * 1.94); ctx.stroke();
    // outer flick
    ctx.lineWidth = 9;
    ctx.beginPath(); ctx.moveTo(outer - side * 4, cy - h * 0.55); ctx.lineTo(outer + side * 18, cy - h * 0.3); ctx.stroke();
  }
  ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(60,20,12,0.8)';
  ctx.beginPath(); ctx.ellipse(cx, cy, w * 0.92, h + 2, 0, Math.PI * 0.3, Math.PI * 0.7); ctx.stroke();
}

function drawBrow(ctx, side, kind) {
  const cx = CX + side * EYE_DX, y = EYE_Y - 108;
  ctx.strokeStyle = '#3b1a12'; ctx.lineWidth = 8; ctx.lineCap = 'round';
  ctx.beginPath();
  if (kind === 'worried') { ctx.moveTo(cx + side * 40, y + 6); ctx.quadraticCurveTo(cx, y + 4, cx - side * 42, y - 16); }
  else if (kind === 'angry') { ctx.moveTo(cx + side * 44, y - 18); ctx.lineTo(cx - side * 44, y + 16); }
  else if (kind === 'raised') { ctx.moveTo(cx + side * 42, y - 8); ctx.quadraticCurveTo(cx, y - 34, cx - side * 42, y - 10); }
  else { ctx.moveTo(cx + side * 42, y - 2); ctx.quadraticCurveTo(cx, y - 16, cx - side * 42, y - 4); }
  ctx.stroke();
}

function drawBlush(ctx, strength = 1, color = '255,110,150') {
  for (const side of [-1, 1]) {
    const x = CX + side * 185, y = EYE_Y + 92;
    const g = ctx.createRadialGradient(x, y, 4, x, y, 48);
    g.addColorStop(0, `rgba(${color},${0.55 * strength})`); g.addColorStop(1, `rgba(${color},0)`);
    ctx.fillStyle = g; ell(ctx, x, y, 52, 30); ctx.fill();
    ctx.strokeStyle = `rgba(235,80,120,${0.7 * strength})`; ctx.lineWidth = 3;
    for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(x + i * 14 - 5, y + 8); ctx.lineTo(x + i * 14 + 5, y - 8); ctx.stroke(); }
  }
}

function drawNose(ctx) {
  ctx.strokeStyle = 'rgba(190,110,100,0.8)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(CX + 2, EYE_Y + 70); ctx.lineTo(CX - 4, EYE_Y + 80); ctx.stroke();
}

function mouthPath(ctx, kind) {
  const y = MOUTH_Y;
  ctx.beginPath();
  if (kind === 'happy') {
    ctx.moveTo(CX - 52, y - 12); ctx.quadraticCurveTo(CX, y - 2, CX + 52, y - 12);
    ctx.quadraticCurveTo(CX + 30, y + 58, CX, y + 58); ctx.quadraticCurveTo(CX - 30, y + 58, CX - 52, y - 12);
  } else if (kind === 'cry') {
    ctx.moveTo(CX - 22, y + 12); ctx.quadraticCurveTo(CX, y - 10, CX + 22, y + 12); ctx.quadraticCurveTo(CX, y + 4, CX - 22, y + 12);
  } else if (kind === 'angry') {
    ctx.moveTo(CX - 50, y - 4); ctx.lineTo(CX - 18, y - 12); ctx.lineTo(CX, y - 6); ctx.lineTo(CX + 18, y - 12); ctx.lineTo(CX + 50, y - 4);
    ctx.quadraticCurveTo(CX + 36, y + 40, CX, y + 38); ctx.quadraticCurveTo(CX - 36, y + 40, CX - 50, y - 4);
  } else { // scream
    ctx.ellipse(CX, y + 22, 50, 70, 0, 0, Math.PI * 2);
  }
  ctx.closePath();
}

function drawMouth(ctx, kind) {
  const y = MOUTH_Y;
  mouthPath(ctx, kind);
  const g = ctx.createLinearGradient(0, y - 40, 0, y + 90);
  g.addColorStop(0, '#5a0f1e'); g.addColorStop(1, '#a3283f');
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); mouthPath(ctx, kind); ctx.clip();
  ctx.fillStyle = '#ff8aa3';
  if (kind === 'happy') { ell(ctx, CX, y + 52, 34, 22); ctx.fill(); }
  if (kind === 'angry') { ell(ctx, CX, y + 42, 30, 16); ctx.fill(); }
  if (kind === 'scream') {
    ell(ctx, CX, y + 88, 40, 26); ctx.fill();
    ctx.fillStyle = '#fffaf6'; ctx.fillRect(CX - 60, y - 60, 120, 20); // upper teeth
    ctx.fillStyle = '#ff9fb2'; ell(ctx, CX, y - 34, 8, 12); ctx.fill(); // uvula
  }
  ctx.restore();
  if (kind === 'angry') { // fangs
    ctx.fillStyle = '#fffaf6';
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(CX + s * 20, y - 11); ctx.lineTo(CX + s * 38, y - 7); ctx.lineTo(CX + s * 30, y + 14); ctx.closePath(); ctx.fill();
    }
  }
  ctx.strokeStyle = '#3a0c12'; ctx.lineWidth = 5; ctx.lineJoin = 'round';
  mouthPath(ctx, kind); ctx.stroke();
}

function drawTears(ctx) {
  for (const side of [-1, 1]) {
    const x = CX + side * (EYE_DX - 30), y0 = EYE_Y + 58;
    const g = ctx.createLinearGradient(0, y0, 0, y0 + 150);
    g.addColorStop(0, 'rgba(150,215,255,0.95)'); g.addColorStop(1, 'rgba(150,215,255,0.1)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(x - 9, y0); ctx.quadraticCurveTo(x - 14, y0 + 80, x - 4, y0 + 150); ctx.lineTo(x + 10, y0 + 150); ctx.quadraticCurveTo(x + 12, y0 + 80, x + 9, y0); ctx.fill();
    // drop at the eye corner
    ctx.fillStyle = 'rgba(170,228,255,0.95)';
    const dx = CX + side * (EYE_DX + 52);
    ctx.beginPath(); ctx.moveTo(dx, EYE_Y + 10); ctx.quadraticCurveTo(dx + 14, EYE_Y + 36, dx, EYE_Y + 42); ctx.quadraticCurveTo(dx - 14, EYE_Y + 36, dx, EYE_Y + 10); ctx.fill();
    ctx.fillStyle = '#fff'; ell(ctx, x - 2, y0 + 30, 3, 8); ctx.fill();
  }
}

/** Draw a Peachi face on a 2D context (512x512 space). Exported so UI can reuse it for a mood icon. */
export function drawFace(ctx, name = 'happy', { blink = false, size = S } = {}) {
  ctx.save();
  ctx.clearRect(0, 0, size, size);
  const k = size / S;
  ctx.setTransform(k * SQUASH, 0, 0, k, k * CX * (1 - SQUASH), 0);
  if (name === 'cry') {
    drawBlush(ctx, 1.1);
    drawBrow(ctx, -1, 'worried'); drawBrow(ctx, 1, 'worried');
    for (const s of [-1, 1]) drawEye(ctx, s, { open: 0.92, teary: true, closed: blink });
    drawTears(ctx); drawNose(ctx); drawMouth(ctx, 'cry');
  } else if (name === 'angry') {
    drawBlush(ctx, 0.9, '255,90,90');
    drawBrow(ctx, -1, 'angry'); drawBrow(ctx, 1, 'angry');
    for (const s of [-1, 1]) drawEye(ctx, s, { glare: true, angryTint: true, pupil: 0.75, closed: blink });
    drawNose(ctx); drawMouth(ctx, 'angry');
  } else if (name === 'scream') {
    // pale shock shading under the bangs
    const g = ctx.createLinearGradient(0, EYE_Y - 120, 0, EYE_Y - 40);
    g.addColorStop(0, 'rgba(90,110,200,0.45)'); g.addColorStop(1, 'rgba(90,110,200,0)');
    ctx.fillStyle = g; ctx.fillRect(CX - 230, EYE_Y - 120, 460, 80);
    drawBrow(ctx, -1, 'raised'); drawBrow(ctx, 1, 'raised');
    for (const s of [-1, 1]) drawEye(ctx, s, { w: 60, h: 80, iris: 0.5, pupil: 0.55, irisDy: 0 });
    drawNose(ctx); drawMouth(ctx, 'scream');
    ctx.fillStyle = 'rgba(170,228,255,0.9)'; // sweat drop
    ctx.beginPath(); ctx.moveTo(CX + 228, EYE_Y - 40); ctx.quadraticCurveTo(CX + 248, EYE_Y - 4, CX + 228, EYE_Y + 4); ctx.quadraticCurveTo(CX + 208, EYE_Y - 4, CX + 228, EYE_Y - 40); ctx.fill();
  } else { // happy
    drawBlush(ctx, 1);
    drawBrow(ctx, -1, 'soft'); drawBrow(ctx, 1, 'soft');
    for (const s of [-1, 1]) drawEye(ctx, s, { closed: blink });
    drawNose(ctx); drawMouth(ctx, 'happy');
  }
  ctx.restore();
}

/** Red anger mark (💢) texture, shown as a sprite next to the head in the 'angry' expression. */
export function makeAngerMarkTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const ctx = c.getContext('2d');
  ctx.translate(64, 64);
  ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    ctx.save(); ctx.rotate(i * Math.PI / 2 + Math.PI / 4);
    for (const [col, lw] of [['#ffffff', 26], ['#e0202e', 16]]) {
      ctx.strokeStyle = col; ctx.lineWidth = lw;
      ctx.beginPath(); ctx.moveTo(-22, -48); ctx.quadraticCurveTo(-14, -16, -46, -20); ctx.stroke();
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
  texture.anisotropy = 4;
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
