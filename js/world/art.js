// Canvas artwork for the house: posters, screens, rugs, signs, labels. All drawn in code; Thai text uses
// the page's Kanit / Mitr fonts (redrawn once they load, see tex.art).
import { art } from './tex.js';

const TAU = Math.PI * 2;
export function drawPeach(g, x, y, r) {
  const grd = g.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  grd.addColorStop(0, '#ffd8c6'); grd.addColorStop(0.55, '#ff93a4'); grd.addColorStop(1, '#e0527a');
  g.fillStyle = grd;
  g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(160,40,80,0.55)'; g.lineWidth = r * 0.06;
  g.beginPath(); g.moveTo(x, y - r * 0.95); g.quadraticCurveTo(x - r * 0.35, y, x, y + r * 0.9); g.stroke();
  g.fillStyle = '#6cc460';
  g.beginPath(); g.ellipse(x + r * 0.32, y - r * 1.0, r * 0.36, r * 0.15, -0.5, 0, TAU); g.fill();
}
function roundRect(g, x, y, w, h, r) { g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); }
function catEars(g, x, y, s, color) {
  g.fillStyle = color;
  for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(x + sx * s * 0.2, y); g.lineTo(x + sx * s * 0.62, y - s * 0.55); g.lineTo(x + sx * s * 0.8, y + s * 0.05); g.fill(); }
}
function chibiPeachi(g, x, y, s) { // tiny avatar: brown hair, cat-ear headphones, big eyes
  g.fillStyle = '#5a2a22'; g.beginPath(); g.ellipse(x, y + s * 0.1, s * 0.62, s * 0.66, 0, 0, TAU); g.fill();
  catEars(g, x, y - s * 0.42, s * 0.9, '#ff8cc0');
  g.fillStyle = '#ffe0d8'; g.beginPath(); g.ellipse(x, y + s * 0.12, s * 0.46, s * 0.44, 0, 0, TAU); g.fill();
  g.fillStyle = '#5a2a22'; g.beginPath(); g.ellipse(x, y - s * 0.22, s * 0.5, s * 0.2, 0, Math.PI, TAU); g.fill();
  for (const sx of [-1, 1]) {
    g.fillStyle = '#6a2a12'; g.beginPath(); g.ellipse(x + sx * s * 0.18, y + s * 0.1, s * 0.09, s * 0.12, 0, 0, TAU); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(x + sx * s * 0.16, y + s * 0.05, s * 0.03, 0, TAU); g.fill();
    g.fillStyle = '#ff9ac0'; g.beginPath(); g.arc(x + sx * s * 0.62, y + s * 0.06, s * 0.14, 0, TAU); g.fill();
  }
  g.strokeStyle = '#8a2a3a'; g.lineWidth = s * 0.04; g.beginPath(); g.arc(x, y + s * 0.26, s * 0.08, 0.2, Math.PI - 0.2); g.stroke();
}

// ---------------------------------------------------------------- stream room
export const monitorStream = () => art(768, 432, (g, w, h) => {
  g.fillStyle = '#16101f'; g.fillRect(0, 0, w, h);
  // top bar of a streaming app
  g.fillStyle = '#231a30'; g.fillRect(0, 0, w, 34);
  g.fillStyle = '#ff2d55'; roundRect(g, 10, 7, 78, 20, 4); g.fill();
  g.fillStyle = '#fff'; g.font = '700 15px Kanit, sans-serif'; g.fillText('ออนไลน์', 22, 23);
  g.fillStyle = '#cdbfe0'; g.font = '500 15px Kanit, sans-serif'; g.fillText('ไลฟ์ผี 249 ชั่วโมง  ·  ชั่วโมงที่ 248', 100, 23);
  g.fillStyle = '#ffb3d9'; g.fillText('ผู้ชม 2,490', w - 110, 23);
  // preview: BRB scene with chibi Peachi
  const px = 14, py = 46, pw = 520, ph = 292;
  const bg = g.createLinearGradient(0, py, 0, py + ph);
  bg.addColorStop(0, '#3a1a52'); bg.addColorStop(1, '#170a22');
  g.fillStyle = bg; g.fillRect(px, py, pw, ph);
  for (let i = 0; i < 26; i++) { g.fillStyle = 'rgba(255,190,230,0.35)'; g.beginPath(); g.arc(px + (i * 97) % pw, py + (i * 53) % ph, 1.5 + (i % 3), 0, TAU); g.fill(); }
  chibiPeachi(g, px + pw / 2, py + ph * 0.48, 78);
  g.fillStyle = '#fff'; g.font = '700 30px Kanit, sans-serif'; g.textAlign = 'center';
  g.fillText('เดี๋ยวมานะ... อย่าเพิ่งไปไหน', px + pw / 2, py + ph - 26);
  g.textAlign = 'left';
  // scenes / sources panels
  g.fillStyle = '#1f1729'; g.fillRect(px, py + ph + 10, pw, h - py - ph - 20);
  g.fillStyle = '#8f80a8'; g.font = '500 13px Kanit, sans-serif';
  ['ฉาก: พักจอ', 'ฉาก: คุยเล่น', 'ฉาก: เล่นเกม'].forEach((t, i) => { g.fillStyle = i === 0 ? '#ff7ab8' : '#8f80a8'; g.fillText(t, px + 12 + i * 170, py + ph + 36); });
  // audio meters
  for (let i = 0; i < 3; i++) { g.fillStyle = '#2d2338'; g.fillRect(px + 12 + i * 170, py + ph + 48, 150, 10); g.fillStyle = ['#46e08a', '#e8d34a', '#46e08a'][i]; g.fillRect(px + 12 + i * 170, py + ph + 48, 40 + i * 30, 10); }
  // chat column
  const cx = pw + 26;
  g.fillStyle = '#120c1a'; g.fillRect(cx, 46, w - cx - 12, h - 58);
  g.fillStyle = '#cdbfe0'; g.font = '600 14px Kanit, sans-serif'; g.fillText('แชต', cx + 10, 66);
  const lines = [['#ff7ab8', 'พีชชี่ไปไหนอะ'], ['#9ad0ff', 'ได้ยินเสียงอะไรป่ะ'], ['#c6ff8a', '249 249 249'], ['#ffd36b', 'ไฟกะพริบอีกแล้ว'], ['#d59bff', 'ข้างหลังพีชชี่...'], ['#ff7ab8', 'มอดอยู่ไหมคะ'], ['#9ad0ff', 'ตีสามแล้วนะ'], ['#c6ff8a', 'ใครเปิดประตู'], ['#ffd36b', 'อย่ามองกระจก']];
  lines.forEach(([c, t], i) => {
    g.fillStyle = c; g.font = '600 13px Kanit, sans-serif'; g.fillText('ผู้ชม' + (i * 37 % 90 + 10), cx + 10, 92 + i * 36);
    g.fillStyle = '#e9e0f5'; g.font = '400 14px Kanit, sans-serif'; g.fillText(t, cx + 10, 109 + i * 36);
  });
});

export const monitorSide = () => art(256, 448, (g, w, h) => { // vertical monitor: spooky DM + to-do list
  g.fillStyle = '#10141e'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#1b2233'; g.fillRect(0, 0, w, 30);
  g.fillStyle = '#9ab4ff'; g.font = '600 14px Kanit, sans-serif'; g.fillText('ข้อความ (1)', 10, 20);
  g.fillStyle = '#26314a'; roundRect(g, 10, 44, w - 20, 92, 8); g.fill();
  g.fillStyle = '#ffb3d9'; g.font = '600 13px Kanit, sans-serif'; g.fillText('peachi_249', 20, 64);
  g.fillStyle = '#e8ecf5'; g.font = '400 14px Kanit, sans-serif';
  g.fillText('มอดคะ ช่วยหาหูฟัง', 20, 86); g.fillText('ให้หน่อยได้ไหม', 20, 106); g.fillText('หายไปไหนไม่รู้...', 20, 126);
  g.fillStyle = '#8a94aa'; g.font = '400 11px Kanit, sans-serif'; g.fillText('03:00', w - 50, 64);
  g.fillStyle = '#e8ecf5'; g.font = '600 14px Kanit, sans-serif'; g.fillText('สิ่งที่ต้องทำคืนนี้', 12, 176);
  ['ไลฟ์ให้ครบ 249 ชม.', 'ตอบซุปแชต', 'ซื้อขนมเพิ่ม', 'อย่าหลับ'].forEach((t, i) => {
    g.strokeStyle = '#8a94aa'; g.lineWidth = 1.5; g.strokeRect(14, 192 + i * 30, 13, 13);
    if (i === 1) { g.strokeStyle = '#46e08a'; g.beginPath(); g.moveTo(16, 199 + i * 30); g.lineTo(20, 203 + i * 30); g.lineTo(26, 194 + i * 30); g.stroke(); }
    g.fillStyle = i === 3 ? '#ff6a7a' : '#c8d0e0'; g.font = '400 13px Kanit, sans-serif'; g.fillText(t, 36, 204 + i * 30);
  });
  const gd = g.createLinearGradient(0, h - 120, 0, h);
  gd.addColorStop(0, 'rgba(255,60,120,0)'); gd.addColorStop(1, 'rgba(255,60,120,0.25)');
  g.fillStyle = gd; g.fillRect(0, h - 120, w, 120);
});

export const neonSign = () => art(1024, 256, (g, w, h) => { // glowing tubes on a clear acrylic backplate
  g.clearRect(0, 0, w, h);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '800 150px Kanit, sans-serif';
  for (const [blur, alpha, lw] of [[40, 0.5, 20], [18, 0.8, 12], [0, 1, 7]]) {
    g.shadowColor = '#ff3fa8'; g.shadowBlur = blur; g.globalAlpha = alpha;
    g.strokeStyle = blur ? '#ff4fb4' : '#ffe6f4'; g.lineWidth = lw; g.lineJoin = 'round';
    g.strokeText('PEACHI', w * 0.46, h / 2 + 6);
  }
  g.globalAlpha = 1; g.shadowBlur = 0;
  // little heart after the word
  g.save(); g.translate(w * 0.86, h / 2); g.scale(2.4, 2.4);
  g.strokeStyle = '#ffe6f4'; g.lineWidth = 3; g.shadowColor = '#ff3fa8'; g.shadowBlur = 12;
  g.beginPath(); g.moveTo(0, 14); g.bezierCurveTo(-22, -2, -12, -22, 0, -8); g.bezierCurveTo(12, -22, 22, -2, 0, 14); g.stroke();
  g.restore();
}, { fonts: true });

export const peachiPoster = () => art(360, 512, (g, w, h) => {
  const bg = g.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#3a1648'); bg.addColorStop(1, '#12071a');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 50; i++) { g.fillStyle = `rgba(255,170,220,${0.1 + (i % 5) * 0.06})`; g.fillRect((i * 53) % w, (i * 97) % h, 3, 3); }
  // moon + bats
  g.fillStyle = '#ffe9b0'; g.beginPath(); g.arc(w * 0.72, 90, 46, 0, TAU); g.fill();
  g.fillStyle = '#3a1648'; g.beginPath(); g.arc(w * 0.66, 78, 42, 0, TAU); g.fill();
  chibiPeachi(g, w / 2, 230, 96);
  g.fillStyle = '#fff'; g.textAlign = 'center';
  g.font = '800 58px Kanit, sans-serif'; g.fillText('PEACHI', w / 2, 392);
  g.fillStyle = '#ffb347'; g.font = '700 26px Kanit, sans-serif'; g.fillText('ไลฟ์ผี 249 ชั่วโมง', w / 2, 432);
  g.fillStyle = '#d7a8ff'; g.font = '500 18px Mitr, sans-serif'; g.fillText('คืนวันที่ 31 ตุลาคม', w / 2, 466);
});
export const animePoster = (hue = 200, title = 'STARLIGHT') => art(300, 420, (g, w, h) => {
  const bg = g.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, `hsl(${hue},55%,62%)`); bg.addColorStop(1, `hsl(${hue + 50},60%,30%)`);
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 7; i++) { g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 60 + i * 40); g.lineTo(w, 20 + i * 52); g.stroke(); }
  // silhouette character with long hair and a sword
  g.fillStyle = `hsl(${hue + 180},30%,14%)`;
  g.beginPath(); g.ellipse(w * 0.5, 150, 44, 50, 0, 0, TAU); g.fill();
  g.beginPath(); g.moveTo(w * 0.3, 160); g.quadraticCurveTo(w * 0.2, 300, w * 0.28, 380); g.lineTo(w * 0.72, 380); g.quadraticCurveTo(w * 0.8, 300, w * 0.7, 160); g.fill();
  g.strokeStyle = '#fff'; g.lineWidth = 4; g.beginPath(); g.moveTo(w * 0.82, 110); g.lineTo(w * 0.62, 330); g.stroke();
  g.fillStyle = '#fff'; g.font = '800 38px Kanit, sans-serif'; g.textAlign = 'center'; g.fillText(title, w / 2, h - 18);
});
export const banner249 = () => art(768, 256, (g, w, h) => {
  g.fillStyle = '#ff7a1a'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#1a0a12';
  for (let i = 0; i < w; i += 40) { g.beginPath(); g.moveTo(i, h); g.lineTo(i + 20, h - 20); g.lineTo(i + 40, h); g.fill(); }
  g.textAlign = 'center';
  g.font = '700 32px Kanit, sans-serif'; g.fillText('HAPPY HALLOWEEN', w / 2, 46);
  g.font = '800 140px Kanit, sans-serif'; g.fillText('249', w / 2, 178);
  g.font = '600 28px Mitr, sans-serif'; g.fillText('ไลฟ์ผี 249 ชั่วโมง ห้ามปิดไลฟ์', w / 2, 222);
});

// ---------------------------------------------------------------- bathroom
export const mirrorWriting = () => art(320, 420, (g, w, h) => {
  const bg = g.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, '#34424e'); bg.addColorStop(0.5, '#161e26'); bg.addColorStop(1, '#2a3642');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(255,255,255,0.08)';
  g.beginPath(); g.moveTo(40, 0); g.lineTo(110, 0); g.lineTo(0, 150); g.lineTo(0, 70); g.fill();
  // fog on the glass, written through with a finger
  g.fillStyle = 'rgba(220,230,240,0.16)'; g.fillRect(0, 0, w, h);
  g.save(); g.translate(w / 2, h / 2); g.rotate(-0.1);
  g.fillStyle = '#b8101f'; g.textAlign = 'center';
  g.font = '600 54px Mitr, sans-serif'; g.fillText('กดไลก์', 0, -40);
  g.font = '600 46px Mitr, sans-serif'; g.fillText('ด้วยยย...', 0, 22);
  g.font = '700 36px Kanit, sans-serif'; g.fillText('249', 0, 88);
  g.restore();
  g.fillStyle = 'rgba(184,16,31,0.5)';
  for (const [x, y, l] of [[98, 150, 40], [150, 158, 70], [226, 172, 30], [120, 236, 50]]) g.fillRect(x, y, 3, l);
  g.beginPath(); g.ellipse(250, 330, 26, 30, 0, 0, TAU); g.fill();
  for (let i = 0; i < 4; i++) { g.beginPath(); g.ellipse(228 + i * 15, 288 - (i === 1 || i === 2 ? 9 : 0), 6, 16, 0, 0, TAU); g.fill(); }
});

// ---------------------------------------------------------------- living room / kitchen
export function tvStatic() { // animated: call .userData.tick(t) to redraw a few times per second
  const t = art(256, 144, (g, w, h) => { g.fillStyle = '#111'; g.fillRect(0, 0, w, h); }, { fonts: false });
  const g = t.userData.ctx, img = g.createImageData(256, 144);
  let last = -1;
  t.userData.tick = (time) => {
    const f = Math.floor(time * 12);
    if (f === last) return; last = f;
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) { const v = Math.random() * 200; d[i] = v * 0.85; d[i + 1] = v * 0.9; d[i + 2] = v; d[i + 3] = 255; }
    g.putImageData(img, 0, 0);
    const band = (f * 17) % 144;
    g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(0, band, 256, 10);
    if (f % 40 < 8) { g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(0, 0, 256, 144); chibiPeachi(g, 128, 76, 34); }
    t.needsUpdate = true;
  };
  return t;
}
export const thaiCalendar = () => art(256, 360, (g, w, h) => {
  g.fillStyle = '#fbf6ee'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#c0282e'; g.fillRect(0, 0, w, 70);
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = '700 30px Kanit, sans-serif'; g.fillText('ตุลาคม 2569', w / 2, 46);
  g.fillStyle = '#c0282e'; g.font = '800 150px Kanit, sans-serif'; g.fillText('31', w / 2, 220);
  g.fillStyle = '#333'; g.font = '500 24px Mitr, sans-serif'; g.fillText('วันเสาร์', w / 2, 262);
  g.fillStyle = '#6a6a6a'; g.font = '400 17px Mitr, sans-serif'; g.fillText('วันฮาโลวีน', w / 2, 294);
  g.fillStyle = '#c0282e'; g.font = '600 17px Mitr, sans-serif'; g.fillText('ฤกษ์ไม่ดี ห้ามไลฟ์ดึก', w / 2, 330);
});
export const clockFace = () => art(256, 256, (g, w, h) => {
  g.fillStyle = '#f6efe2'; g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 4, 0, TAU); g.fill();
  g.fillStyle = '#2a2020'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '600 26px Kanit, sans-serif';
  for (let i = 1; i <= 12; i++) { const a = i / 12 * TAU - Math.PI / 2; g.fillText(String(i), w / 2 + Math.cos(a) * 96, h / 2 + Math.sin(a) * 96); }
  g.strokeStyle = '#2a2020'; g.lineCap = 'round';
  g.lineWidth = 7; g.beginPath(); g.moveTo(w / 2, h / 2); g.lineTo(w / 2 + 52, h / 2); g.stroke();  // 3 o'clock
  g.lineWidth = 4; g.beginPath(); g.moveTo(w / 2, h / 2); g.lineTo(w / 2, h / 2 - 84); g.stroke();
  g.fillStyle = '#c0282e'; g.beginPath(); g.arc(w / 2, h / 2, 7, 0, TAU); g.fill();
}, { fonts: true });
export const familyPhoto = (seed = 1, ghost = false) => art(200, 160, (g, w, h) => {
  const hue = (seed * 67) % 360;
  const bg = g.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, `hsl(${hue},25%,70%)`); bg.addColorStop(1, `hsl(${hue + 30},20%,40%)`);
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  const n = 2 + (seed % 3);
  for (let i = 0; i < n; i++) {
    const x = w * (i + 1) / (n + 1), s = 20 + ((seed + i) % 3) * 4;
    g.fillStyle = `hsl(${(hue + i * 90) % 360},35%,35%)`; g.beginPath(); g.ellipse(x, h - 20, s * 1.1, s * 1.6, 0, Math.PI, TAU); g.fill();
    g.fillStyle = '#e8c4a8'; g.beginPath(); g.arc(x, h - 58 - s * 0.3, s * 0.75, 0, TAU); g.fill();
    g.fillStyle = '#2a1a14'; g.beginPath(); g.arc(x, h - 64 - s * 0.3, s * 0.78, Math.PI, TAU); g.fill();
  }
  if (ghost) { // a pale face in the back that shouldn't be there
    g.fillStyle = 'rgba(235,240,255,0.55)'; g.beginPath(); g.ellipse(w * 0.84, 42, 13, 17, 0, 0, TAU); g.fill();
    g.fillStyle = 'rgba(0,0,0,0.7)'; g.beginPath(); g.arc(w * 0.84 - 5, 40, 3, 0, TAU); g.arc(w * 0.84 + 5, 40, 3, 0, TAU); g.fill();
  }
  const v = g.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, w * 0.7);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(40,20,0,0.45)');
  g.fillStyle = v; g.fillRect(0, 0, w, h);
}, { fonts: false });

// ---------------------------------------------------------------- rugs
export const roundRug = (a = '#f4b6cc', b = '#fbe3ec', c = '#e58aac') => art(512, 512, (g, w) => {
  g.clearRect(0, 0, w, w);
  for (let i = 0; i < 9; i++) { g.fillStyle = [a, b, c][i % 3]; g.beginPath(); g.arc(w / 2, w / 2, w / 2 - 4 - i * 26, 0, TAU); g.fill(); }
  g.fillStyle = 'rgba(255,255,255,0.08)'; for (let i = 0; i < 400; i++) g.fillRect((i * 97) % w, (i * 57) % w, 2, 2);
}, { fonts: false });
export const runnerRug = () => art(256, 1024, (g, w, h) => {
  g.fillStyle = '#5a1e24'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#c89a4a'; g.lineWidth = 8; g.strokeRect(14, 14, w - 28, h - 28);
  g.strokeStyle = '#2a0c10'; g.lineWidth = 16; g.strokeRect(34, 34, w - 68, h - 68);
  for (let y = 110; y < h - 90; y += 140) {
    g.save(); g.translate(w / 2, y);
    g.fillStyle = '#c89a4a'; g.beginPath(); g.moveTo(0, -48); g.lineTo(46, 0); g.lineTo(0, 48); g.lineTo(-46, 0); g.fill();
    g.fillStyle = '#2a4a5a'; g.beginPath(); g.moveTo(0, -30); g.lineTo(28, 0); g.lineTo(0, 30); g.lineTo(-28, 0); g.fill();
    g.fillStyle = '#e8d8b0'; g.beginPath(); g.arc(0, 0, 8, 0, TAU); g.fill();
    g.restore();
  }
  for (let i = 0; i < 2000; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.12})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
  for (let x = 6; x < w; x += 10) { g.fillStyle = '#d8c8a8'; g.fillRect(x, 0, 3, 8); g.fillRect(x, h - 8, 3, 8); }
}, { fonts: false });
export const livingRug = () => art(768, 512, (g, w, h) => {
  g.fillStyle = '#2e3a4a'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#d8b878'; g.lineWidth = 10; g.strokeRect(20, 20, w - 40, h - 40);
  g.strokeStyle = '#8a3a3a'; g.lineWidth = 22; g.strokeRect(46, 46, w - 92, h - 92);
  g.fillStyle = '#d8b878';
  for (let x = 110; x < w - 80; x += 90) for (let y = 110; y < h - 80; y += 90) {
    g.save(); g.translate(x, y); g.rotate(Math.PI / 4); g.fillRect(-12, -12, 24, 24); g.restore();
  }
  g.fillStyle = '#8a3a3a'; g.beginPath(); g.ellipse(w / 2, h / 2, 120, 80, 0, 0, TAU); g.fill();
  g.fillStyle = '#e8d8b0'; g.beginPath(); g.ellipse(w / 2, h / 2, 70, 44, 0, 0, TAU); g.fill();
  for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.1})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
}, { fonts: false });
export const doormat = () => art(384, 256, (g, w, h) => {
  g.fillStyle = '#6a4a2a'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(${40 + Math.random() * 60},${25 + Math.random() * 30},10,0.6)`; g.fillRect(Math.random() * w, Math.random() * h, 2, 3); }
  g.fillStyle = '#1a0e06'; g.textAlign = 'center'; g.font = '700 54px Kanit, sans-serif'; g.fillText('ยินดีต้อนรับ', w / 2, h / 2 + 4);
  g.font = '500 26px Mitr, sans-serif'; g.fillText('(ถ้ายังมีชีวิตอยู่)', w / 2, h / 2 + 50);
});

// ---------------------------------------------------------------- small labels
export const merchLabel = () => art(256, 160, (g, w, h) => {
  g.fillStyle = '#c8a070'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#6a4a2a'; g.fillRect(0, h / 2 - 6, w, 12);
  g.fillStyle = '#3a2210'; g.font = '800 34px Kanit, sans-serif'; g.textAlign = 'center'; g.fillText('PEACHI', w / 2, 52);
  g.font = '600 22px Mitr, sans-serif'; g.fillText('ของที่ระลึก ระวังแตก', w / 2, 128);
});
export const stickyNotes = () => art(256, 128, (g, w, h) => {
  g.clearRect(0, 0, w, h);
  const notes = [['#ffe66a', 'อย่าลืม\nปิดไลฟ์'], ['#ff9ac0', 'หูฟัง\nอยู่ไหน??'], ['#9ae6ff', 'ตีสาม\nห้ามหลับ']];
  notes.forEach(([c, t], i) => {
    g.save(); g.translate(14 + i * 82, 12); g.rotate((i - 1) * 0.08);
    g.fillStyle = c; g.fillRect(0, 0, 74, 74);
    g.fillStyle = '#2a2020'; g.font = '500 15px Mitr, sans-serif';
    t.split('\n').forEach((l, k) => g.fillText(l, 8, 28 + k * 22));
    g.restore();
  });
});
