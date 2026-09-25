// Peachi's face, painted on a 1024² canvas and projected straight onto the front of the head
// (planar UVs, see FACE_WINDOW). Four expressions from the reference sheet + blink.
import * as THREE from 'three';

export const EXPRESSIONS = ['happy', 'cry', 'angry', 'scream'];

/** Model-space window (meters, rest pose) the canvas covers. model.js projects UVs with it. */
export const FACE_WINDOW = { x0: -0.085, x1: 0.085, y0: 1.345, y1: 1.515 };

const S = 1024;
const PX = S / (FACE_WINDOW.y1 - FACE_WINDOW.y0);           // px per meter (~6024)
const Y = (m) => (FACE_WINDOW.y1 - m) * PX;                  // model height → canvas y
const CX = S / 2;
// Proportions measured on the sheet, in units of the eye spacing E (0.069 m):
// eye width 0.66E, iris 0.42E, brows just above the lash line, nose 0.32E and mouth 0.70E below the eyes.
const EYE_Y = Y(1.447), EYE_DX = 0.0345 * PX;
const EYE_W = 0.0228 * PX, EYE_H = 0.0156 * PX;              // half sizes (~137 × 94 px)
const BROW_Y = Y(1.47), NOSE_Y = Y(1.425), MOUTH_Y = Y(1.399), BLUSH_Y = Y(1.43);

const LASH = '#1f0b08', CREASE = 'rgba(112,52,40,0.8)', LOWER = '#8a4636', BROW = '#4f2519', LIP = '#3e0d12';

function ell(ctx, x, y, rx, ry, rot = 0) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); }
const bez = (p0, p1, p2, p3, t) => {
  const a = 1 - t;
  return [a * a * a * p0[0] + 3 * a * a * t * p1[0] + 3 * a * t * t * p2[0] + t * t * t * p3[0],
    a * a * a * p0[1] + 3 * a * a * t * p1[1] + 3 * a * t * t * p2[1] + t * t * t * p3[1]];
};

// ---------------------------------------------------------------- eyes
// side: -1 = canvas-left (her right eye), +1 = canvas-right (her left eye).
// Eye-local coords: u = -1 inner corner … +1 outer corner, v = -1 top … +1 bottom.
function eyeFrame(side, o) {
  const cx = CX + side * EYE_DX, cy = EYE_Y;
  const w = EYE_W * (o.scale || 1), h = EYE_H * (o.scale || 1) * (o.open ?? 1);
  const P = (u, v) => [cx + side * u * w, cy + v * h];
  // upper lid (inner → outer) and lower lid (outer → inner) as cubic beziers
  let up;
  if (o.glare) up = [P(-1, 0.3), P(-0.55, -0.3), P(0.4, -0.95), P(1.02, -0.32)];
  else if (o.sad) up = [P(-1, 0.02), P(-0.55, -1.02), P(0.45, -0.86), P(1.02, 0.04)];
  else if (o.wide) up = [P(-1, 0.08), P(-0.55, -1.22), P(0.45, -1.36), P(1.02, -0.26)];
  else up = [P(-1, 0.12), P(-0.55, -0.88), P(0.45, -1.12), P(1.02, -0.2)];
  const lo = o.wide
    ? [up[3], P(0.95, 0.72), P(0.35, 1.18), P(-0.12, 1.14), P(-0.62, 1.1), P(-0.96, 0.62), up[0]]
    : [up[3], P(0.9, 0.58), P(0.36, 1.0), P(-0.1, 0.98), P(-0.6, 0.95), P(-0.95, 0.6), up[0]];
  return { cx, cy, w, h, P, up, lo };
}
function openingPath(ctx, f) {
  const { up, lo } = f;
  ctx.beginPath();
  ctx.moveTo(...up[0]); ctx.bezierCurveTo(...up[1], ...up[2], ...up[3]);
  ctx.bezierCurveTo(...lo[1], ...lo[2], ...lo[3]); ctx.bezierCurveTo(...lo[4], ...lo[5], ...lo[6]);
  ctx.closePath();
}

function drawLash(ctx, f, side, o) {
  // thick upper lash that tapers toward the nose and ends in a wing at the outer corner
  const N = 28, top = [], bot = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, p = bez(...f.up, t), q = bez(...f.up, Math.min(1, t + 0.01)), r = bez(...f.up, Math.max(0, t - 0.01));
    let nx = -(q[1] - r[1]), ny = q[0] - r[0];
    const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
    if (ny > 0) { nx = -nx; ny = -ny; } // point upward
    const th = f.h * (0.07 + 0.3 * Math.pow(t, 1.6));
    bot.push(p); top.push([p[0] + nx * th, p[1] + ny * th]);
  }
  const end = f.up[3], wing = f.P(1.3, o.glare ? -0.1 : 0.02), wingTop = f.P(1.18, -0.42);
  ctx.save();
  ctx.fillStyle = LASH;
  ctx.beginPath();
  ctx.moveTo(...bot[0]);
  for (const p of bot) ctx.lineTo(...p);
  ctx.quadraticCurveTo(end[0] + side * f.w * 0.1, end[1] + f.h * 0.02, ...wing);
  ctx.quadraticCurveTo(...f.P(1.12, -0.28), ...wingTop);
  for (let i = top.length - 1; i >= 0; i--) ctx.lineTo(...top[i]);
  ctx.closePath(); ctx.fill();
  // lash spikes at the outer end
  ctx.strokeStyle = LASH; ctx.lineCap = 'round';
  const spikes = [[0.5, -1.2, 0.64, -1.52, 5], [0.74, -1.02, 0.96, -1.32, 6], [0.93, -0.72, 1.2, -0.9, 6]];
  for (const [u0, v0, u1, v1, lw] of spikes) {
    const a = f.P(u0, v0 + (o.glare ? 0.5 : o.sad ? 0.12 : 0) * (1 - u0)), b = f.P(u1, v1 + (o.glare ? 0.5 : o.sad ? 0.12 : 0) * (1 - u0));
    ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(...a); ctx.quadraticCurveTo(a[0] + side * f.w * 0.05, (a[1] + b[1]) / 2, ...b); ctx.stroke();
  }
  // double-eyelid crease
  ctx.strokeStyle = CREASE; ctx.lineWidth = 3.5;
  ctx.beginPath();
  for (let i = 5; i <= 26; i++) {
    const t = i / N, p = bez(...f.up, t);
    const lift = f.h * (0.36 + 0.1 * t);
    if (i === 5) ctx.moveTo(p[0], p[1] - lift); else ctx.lineTo(p[0], p[1] - lift);
  }
  ctx.stroke();
  // lower lash: thin, only on the outer two thirds
  ctx.strokeStyle = LOWER; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(...f.lo[0]); ctx.bezierCurveTo(...f.lo[1], ...f.lo[2], ...f.lo[3]); ctx.stroke();
  ctx.fillStyle = 'rgba(236,150,150,0.9)'; ell(ctx, ...f.P(-0.98, 0.3), 8, 10); ctx.fill(); // inner corner
  ctx.restore();
}

function drawEye(ctx, side, o = {}) {
  const f = eyeFrame(side, o);
  if (o.closed) { // blink: a soft downward curve with the wing
    ctx.save();
    ctx.strokeStyle = LASH; ctx.lineCap = 'round'; ctx.lineWidth = 12;
    ctx.beginPath(); ctx.moveTo(...f.P(-1, 0.25)); ctx.bezierCurveTo(...f.P(-0.4, 0.78), ...f.P(0.45, 0.72), ...f.P(1.05, 0.1)); ctx.stroke();
    ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(...f.P(1.0, 0.14)); ctx.lineTo(...f.P(1.26, 0.02)); ctx.stroke();
    ctx.restore();
    return;
  }
  const { w, h } = f;
  ctx.save();
  openingPath(ctx, f); ctx.clip();
  // sclera: soft white with a lavender shadow under the lid
  ctx.fillStyle = '#fdfbff'; ctx.fillRect(f.cx - w * 1.5, f.cy - h * 1.6, w * 3, h * 3.2);
  const sg = ctx.createLinearGradient(0, f.cy - h * 1.2, 0, f.cy + h * 0.2);
  sg.addColorStop(0, 'rgba(160,150,220,0.9)'); sg.addColorStop(1, 'rgba(190,185,235,0)');
  ctx.fillStyle = sg; ctx.fillRect(f.cx - w * 1.5, f.cy - h * 1.6, w * 3, h * 1.8);

  // iris: round, dark under the lid, glowing amber at the bottom
  const ir = o.iris ?? 1;
  const rx = w * 0.64 * ir, ry = h * 1.02 * ir;
  const icx = f.cx - side * w * 0.04 + (o.look || 0) * w * 0.1, icy = f.cy + h * (o.irisDy ?? 0.1);
  const ig = ctx.createLinearGradient(0, icy - ry, 0, icy + ry);
  ig.addColorStop(0, o.angry ? '#2e0804' : '#26100a');
  ig.addColorStop(0.3, o.angry ? '#6a1a0c' : '#5a2410');
  ig.addColorStop(0.55, o.angry ? '#b8401a' : '#b24d1a');
  ig.addColorStop(0.76, '#e98a32');
  ig.addColorStop(0.91, '#ffc05a');
  ig.addColorStop(1, '#ffe7a0');
  ctx.fillStyle = ig; ell(ctx, icx, icy, rx, ry); ctx.fill();
  ctx.save(); ell(ctx, icx, icy, rx, ry); ctx.clip();
  const rg = ctx.createRadialGradient(icx, icy + ry * 0.1, rx * 0.2, icx, icy + ry * 0.1, rx);
  rg.addColorStop(0, 'rgba(255,170,80,0.55)'); rg.addColorStop(0.55, 'rgba(255,140,60,0.2)'); rg.addColorStop(1, 'rgba(255,140,60,0)');
  ctx.fillStyle = rg; ctx.fillRect(icx - rx, icy - ry, rx * 2, ry * 2);
  ctx.strokeStyle = 'rgba(255,200,140,0.16)'; ctx.lineWidth = 2;
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(icx + Math.cos(a) * rx * 0.34, icy + Math.sin(a) * ry * 0.34); ctx.lineTo(icx + Math.cos(a) * rx * 0.95, icy + Math.sin(a) * ry * 0.95); ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = '#2b0f07'; ctx.lineWidth = 5; ell(ctx, icx, icy, rx, ry); ctx.stroke();
  // pupil
  const pp = o.pupil ?? 1;
  ctx.fillStyle = '#1a0703'; ell(ctx, icx, icy - ry * 0.06, rx * 0.34 * pp, ry * 0.44 * pp); ctx.fill();
  // lid shadow across the top of the iris
  const lg = ctx.createLinearGradient(0, f.cy - h * 1.2, 0, f.cy - h * 0.2);
  lg.addColorStop(0, 'rgba(30,8,14,0.7)'); lg.addColorStop(1, 'rgba(30,8,14,0)');
  ctx.fillStyle = lg; ctx.fillRect(f.cx - w * 1.5, f.cy - h * 1.6, w * 3, h * 1.4);
  // highlights: cyan + pink catch lights (the sheet's signature), white oval lower-left, small dot upper-right
  const hs = Math.max(pp, 0.75);
  ctx.fillStyle = '#3fe3ff'; ell(ctx, icx - rx * 0.2, icy - ry * 0.46, rx * 0.15 * hs, ry * 0.12 * hs); ctx.fill();
  ctx.fillStyle = '#ff3f9f'; ell(ctx, icx + rx * 0.2, icy - ry * 0.46, rx * 0.15 * hs, ry * 0.12 * hs); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.95)'; ell(ctx, icx - rx * 0.46, icy + ry * 0.38, rx * 0.22, ry * 0.13, -0.35); ctx.fill();
  ctx.fillStyle = '#ffffff'; ell(ctx, icx + rx * 0.48, icy - ry * 0.12, rx * 0.07, ry * 0.06); ctx.fill();
  if (o.teary) {
    const tg = ctx.createLinearGradient(0, f.cy, 0, f.cy + h);
    tg.addColorStop(0, 'rgba(200,238,255,0)'); tg.addColorStop(1, 'rgba(200,238,255,0.8)');
    ctx.fillStyle = tg; ctx.fillRect(f.cx - w * 1.5, f.cy, w * 3, h * 1.2);
    ctx.fillStyle = '#ffffff'; ell(ctx, icx + rx * 0.1, icy + ry * 0.12, rx * 0.12, ry * 0.08); ctx.fill();
  }
  ctx.restore();
  drawLash(ctx, f, side, o);
}

function drawBrow(ctx, side, kind) {
  const cx = CX + side * (EYE_DX + 8), y = BROW_Y;
  const W = EYE_W * 1.02;
  // tapered brush stroke, inner end thicker
  const pts = kind === 'worried' ? [[-1, -26], [-0.2, -30], [0.5, -16], [1, 12]]
    : kind === 'angry' ? [[-1, 30], [-0.3, 12], [0.4, -10], [1, -26]]
      : kind === 'raised' ? [[-1, -8], [-0.3, -46], [0.4, -50], [1, -18]]
        : [[-1, 6], [-0.3, -14], [0.4, -16], [1, 2]];
  const P = ([u, v]) => [cx + side * u * W, y + v];
  ctx.save();
  ctx.strokeStyle = BROW; ctx.lineCap = 'round';
  for (let i = 0; i < 12; i++) {
    const t0 = i / 12, t1 = (i + 1) / 12;
    ctx.lineWidth = lerp2(8, 3, t0);
    const a = bez(P(pts[0]), P(pts[1]), P(pts[2]), P(pts[3]), t0), b = bez(P(pts[0]), P(pts[1]), P(pts[2]), P(pts[3]), t1);
    ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke();
  }
  ctx.restore();
}
const lerp2 = (a, b, t) => a + (b - a) * t;

function drawBlush(ctx, strength = 1, rgb = '255,118,128') {
  for (const side of [-1, 1]) {
    const x = CX + side * 0.045 * PX, y = BLUSH_Y + 14;
    const g = ctx.createRadialGradient(x, y, 6, x, y, 130);
    g.addColorStop(0, `rgba(${rgb},${0.55 * strength})`); g.addColorStop(0.55, `rgba(${rgb},${0.25 * strength})`); g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g; ell(ctx, x, y, 132, 70); ctx.fill();
    ctx.fillStyle = `rgba(255,255,255,${0.85 * Math.min(1, strength)})`;
    ell(ctx, x - side * 40, y - 30, 5, 5); ctx.fill();
    ell(ctx, x - side * 22, y - 18, 3, 3); ctx.fill();
  }
}

function drawNose(ctx) {
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.55)'; ell(ctx, CX + 4, NOSE_Y - 36, 7, 18, 0.1); ctx.fill(); // bridge highlight
  ctx.strokeStyle = 'rgba(176,96,86,0.95)'; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(CX + 12, NOSE_Y - 6); ctx.quadraticCurveTo(CX + 6, NOSE_Y + 6, CX - 4, NOSE_Y + 7); ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------- mouths
function mouthPath(ctx, kind) {
  const x = CX, y = MOUTH_Y;
  ctx.beginPath();
  if (kind === 'happy') { // wide open smile, flat top that dips slightly in the middle
    ctx.moveTo(x - 108, y - 46);
    ctx.bezierCurveTo(x - 50, y - 32, x + 50, y - 32, x + 108, y - 46);
    ctx.bezierCurveTo(x + 102, y + 14, x + 54, y + 74, x, y + 76);
    ctx.bezierCurveTo(x - 54, y + 74, x - 102, y + 14, x - 108, y - 46);
  } else if (kind === 'cry') { // small pout
    ctx.moveTo(x - 38, y + 10);
    ctx.bezierCurveTo(x - 20, y - 18, x + 20, y - 18, x + 38, y + 10);
    ctx.bezierCurveTo(x + 18, y - 2, x - 18, y - 2, x - 38, y + 10);
  } else if (kind === 'angry') { // open "rawr" mouth with a wavy lower lip
    ctx.moveTo(x - 86, y - 26);
    ctx.bezierCurveTo(x - 40, y - 34, x + 40, y - 34, x + 86, y - 26);
    ctx.bezierCurveTo(x + 76, y + 6, x + 62, y + 30, x + 40, y + 24);
    ctx.bezierCurveTo(x + 24, y + 44, x + 8, y + 44, x, y + 30);
    ctx.bezierCurveTo(x - 8, y + 44, x - 24, y + 44, x - 40, y + 24);
    ctx.bezierCurveTo(x - 62, y + 30, x - 76, y + 6, x - 86, y - 26);
  } else { // scream: tall rounded trapezoid
    ctx.moveTo(x - 64, y - 56);
    ctx.bezierCurveTo(x - 24, y - 66, x + 24, y - 66, x + 64, y - 56);
    ctx.bezierCurveTo(x + 80, y + 40, x + 56, y + 128, x, y + 132);
    ctx.bezierCurveTo(x - 56, y + 128, x - 80, y + 40, x - 64, y - 56);
  }
  ctx.closePath();
}

function drawMouth(ctx, kind) {
  const x = CX, y = MOUTH_Y;
  ctx.save();
  mouthPath(ctx, kind);
  const g = ctx.createLinearGradient(0, y - 50, 0, y + 130);
  g.addColorStop(0, '#50101a'); g.addColorStop(1, '#a8323f');
  ctx.fillStyle = kind === 'cry' ? '#c2586a' : g; ctx.fill();
  ctx.save(); mouthPath(ctx, kind); ctx.clip();
  ctx.fillStyle = '#ee6f7e';
  if (kind === 'happy') { ell(ctx, x, y + 60, 66, 36); ctx.fill(); ctx.fillStyle = 'rgba(255,190,190,0.6)'; ell(ctx, x - 18, y + 48, 20, 8); ctx.fill(); }
  else if (kind === 'angry') { ell(ctx, x, y + 34, 44, 16); ctx.fill(); }
  else if (kind === 'scream') {
    ell(ctx, x, y + 118, 56, 38); ctx.fill();
    ctx.fillStyle = '#fffaf6'; ctx.fillRect(x - 80, y - 72, 160, 30);
  }
  ctx.restore();
  if (kind === 'angry') { // fangs
    ctx.fillStyle = '#fffaf6'; ctx.strokeStyle = LIP; ctx.lineWidth = 3; ctx.lineJoin = 'round';
    for (const sd of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(x + sd * 34, y - 30); ctx.lineTo(x + sd * 58, y - 29); ctx.lineTo(x + sd * 48, y - 2); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  }
  ctx.strokeStyle = LIP; ctx.lineWidth = kind === 'cry' ? 5.5 : 5; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  mouthPath(ctx, kind); ctx.stroke();
  if (kind === 'happy' || kind === 'angry') { // soft shadow under the lower lip
    ctx.strokeStyle = 'rgba(214,120,120,0.45)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(x - 26, y + (kind === 'happy' ? 96 : 60)); ctx.quadraticCurveTo(x, y + (kind === 'happy' ? 104 : 66), x + 26, y + (kind === 'happy' ? 96 : 60)); ctx.stroke();
  }
  ctx.restore();
}

function drawTears(ctx) {
  for (const side of [-1, 1]) {
    const f = eyeFrame(side, { sad: true, open: 0.9 });
    for (const [u, r] of [[-0.5, 24], [0.42, 28]]) {
      const [px, py] = f.P(u, 0.98);
      const g = ctx.createRadialGradient(px - 7, py - 9, 2, px, py, r);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, 'rgba(205,240,255,0.95)'); g.addColorStop(1, 'rgba(120,190,240,0.92)');
      ctx.fillStyle = g; ell(ctx, px, py, r, r * 0.82); ctx.fill();
      ctx.strokeStyle = 'rgba(60,110,170,0.8)'; ctx.lineWidth = 3; ell(ctx, px, py, r, r * 0.82); ctx.stroke();
    }
    const [sx, sy] = f.P(-0.2, 1.3);
    const sg = ctx.createLinearGradient(0, sy, 0, sy + 150);
    sg.addColorStop(0, 'rgba(175,228,255,0.9)'); sg.addColorStop(1, 'rgba(175,228,255,0)');
    ctx.fillStyle = sg;
    ctx.beginPath(); ctx.moveTo(sx - 7, sy); ctx.quadraticCurveTo(sx - 11, sy + 80, sx - 2, sy + 150); ctx.lineTo(sx + 6, sy + 150); ctx.quadraticCurveTo(sx + 9, sy + 80, sx + 7, sy); ctx.fill();
  }
}

/** Paint a face on a 2D context (1024² space; `size` scales it). */
export function drawFace(ctx, name = 'happy', { blink = false, size = S, eyesOnly = false } = {}) {
  ctx.save();
  ctx.clearRect(0, 0, size, size);
  ctx.scale(size / S, size / S);
  if (eyesOnly) { // overlay drawn through the bangs: just brows + eyes
    const kind = { cry: 'worried', angry: 'angry', scream: 'raised' }[name] || 'soft';
    const eo = name === 'cry' ? { sad: true, open: 0.9, teary: true, irisDy: 0.16 }
      : name === 'angry' ? { glare: true, angry: true, iris: 0.92, pupil: 0.8, irisDy: 0.2 }
        : name === 'scream' ? { wide: true, iris: 0.62, pupil: 0.5, irisDy: 0.02 } : {};
    drawBrow(ctx, -1, kind); drawBrow(ctx, 1, kind);
    for (const sd of [-1, 1]) drawEye(ctx, sd, { ...eo, closed: blink && name !== 'scream' });
    ctx.restore();
    return;
  }
  // soft hair shadow on the forehead, under the bangs
  const hs = ctx.createLinearGradient(0, 0, 0, BROW_Y + 30);
  hs.addColorStop(0, 'rgba(196,108,112,0.45)'); hs.addColorStop(0.7, 'rgba(206,122,124,0.2)'); hs.addColorStop(1, 'rgba(206,122,124,0)');
  ctx.fillStyle = hs; ctx.fillRect(0, 0, S, BROW_Y + 30);
  if (name === 'cry') {
    drawBlush(ctx, 1.3);
    drawBrow(ctx, -1, 'worried'); drawBrow(ctx, 1, 'worried');
    for (const sd of [-1, 1]) drawEye(ctx, sd, { sad: true, open: 0.9, teary: true, closed: blink, irisDy: 0.16 });
    if (!blink) drawTears(ctx);
    drawNose(ctx); drawMouth(ctx, 'cry');
  } else if (name === 'angry') {
    drawBlush(ctx, 1.15, '255,86,96');
    drawBrow(ctx, -1, 'angry'); drawBrow(ctx, 1, 'angry');
    for (const sd of [-1, 1]) drawEye(ctx, sd, { glare: true, angry: true, iris: 0.92, pupil: 0.8, closed: blink, irisDy: 0.2 });
    drawNose(ctx); drawMouth(ctx, 'angry');
  } else if (name === 'scream') {
    ctx.save(); // pale shock shading across the upper face
    ctx.translate(CX, BROW_Y - 10); ctx.scale(1, 0.5);
    const g = ctx.createRadialGradient(0, 0, 20, 0, 0, 330);
    g.addColorStop(0, 'rgba(80,100,200,0.5)'); g.addColorStop(1, 'rgba(80,100,200,0)');
    ctx.fillStyle = g; ctx.fillRect(-340, -340, 680, 680);
    ctx.restore();
    ctx.strokeStyle = 'rgba(70,80,170,0.5)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(CX + i * 36, BROW_Y - 90); ctx.lineTo(CX + i * 36, BROW_Y - 36); ctx.stroke(); }
    drawBlush(ctx, 0.4);
    drawBrow(ctx, -1, 'raised'); drawBrow(ctx, 1, 'raised');
    for (const sd of [-1, 1]) drawEye(ctx, sd, { wide: true, iris: 0.62, pupil: 0.5, irisDy: 0.02 });
    drawNose(ctx); drawMouth(ctx, 'scream');
    ctx.fillStyle = 'rgba(180,230,255,0.95)'; ctx.strokeStyle = 'rgba(70,120,180,0.8)'; ctx.lineWidth = 3; // sweat drop
    const sx = CX + 350, sy = EYE_Y - 30;
    ctx.beginPath(); ctx.moveTo(sx, sy - 46); ctx.quadraticCurveTo(sx + 27, sy + 2, sx, sy + 13); ctx.quadraticCurveTo(sx - 27, sy + 2, sx, sy - 46); ctx.fill(); ctx.stroke();
  } else {
    drawBlush(ctx, 1);
    drawBrow(ctx, -1, 'soft'); drawBrow(ctx, 1, 'soft');
    for (const sd of [-1, 1]) drawEye(ctx, sd, { closed: blink });
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

/**
 * SDF face-shadow map (Genshin/Star Rail technique), generated instead of hand-painted.
 * Value v per texel = how far the light may swing away from the front before this texel falls into
 * shadow: lit while (F·L)*0.5+0.5 ≥ 1 − v. Authored for a light on her left (+x); the shader mirrors u.
 * Proxy: a flattened face (stays lit for moderate side angles), a jaw that narrows toward the chin, and a
 * small nose-shadow wedge that appears once the light is ~45° to the side.
 */
export function createFaceSDF(N = 256, faceHalfWidth = null) {
  const c = document.createElement('canvas'); c.width = c.height = N;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(N, N);
  const { x0, x1, y0, y1 } = FACE_WINDOW;
  const inTri = (px, py, a, b, d) => {
    const s1 = (b[0] - a[0]) * (py - a[1]) - (b[1] - a[1]) * (px - a[0]);
    const s2 = (d[0] - b[0]) * (py - b[1]) - (d[1] - b[1]) * (px - b[0]);
    const s3 = (a[0] - d[0]) * (py - d[1]) - (a[1] - d[1]) * (px - d[0]);
    return (s1 >= 0 && s2 >= 0 && s3 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0);
  };
  for (let j = 0; j < N; j++) {
    const y = y0 + (1 - (j + 0.5) / N) * (y1 - y0);
    const halfW = Math.max(0.012, faceHalfWidth ? faceHalfWidth(y) : 0.062);
    for (let i = 0; i < N; i++) {
      const x = x0 + ((i + 0.5) / N) * (x1 - x0);
      const xn = Math.max(-1.3, Math.min(1.3, x / halfW));
      const nz = Math.sqrt(Math.max(0, 1 - Math.min(1, xn * xn)));
      const phic = Math.atan2(Math.pow(nz, 0.5) * 1.3, -xn);
      let v = (1 - Math.cos(phic)) / 2;
      if (inTri(x, y, [0.0015, 1.431], [-0.012, 1.419], [0.0005, 1.413])) v = Math.min(v, 0.16);
      const k = (j * N + i) * 4;
      img.data[k] = img.data[k + 1] = img.data[k + 2] = Math.round(v * 255); img.data[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  t.generateMipmaps = false; t.minFilter = THREE.LinearFilter;
  return t;
}

/** Face controller: owns the face + eyes-overlay canvases/textures, redraws on expression change and blinks. */
export function createFace() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  const oCanvas = document.createElement('canvas');
  oCanvas.width = oCanvas.height = S / 2;
  const octx = oCanvas.getContext('2d');
  const overlayTexture = new THREE.CanvasTexture(oCanvas);
  overlayTexture.colorSpace = THREE.SRGBColorSpace;
  let expression = 'happy', blinking = false, nextBlink = 2 + Math.random() * 3, blinkEnd = 0;

  function redraw() {
    drawFace(ctx, expression, { blink: blinking }); texture.needsUpdate = true;
    drawFace(octx, expression, { blink: blinking, size: S / 2, eyesOnly: true }); overlayTexture.needsUpdate = true;
  }
  redraw();

  return {
    canvas, texture, overlayTexture,
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
    dispose() { texture.dispose(); overlayTexture.dispose(); },
  };
}
