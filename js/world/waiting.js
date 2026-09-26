// "ห้องแห่งการรอ" (the Room of Waiting) — Night 3, 04:00: the locked guest room opens by itself. Inside, the
// walls are covered in tally marks, 1,702 of them (the days Peachi was gone, 14 Jan 2022 → 12 Sep 2026),
// a calendar flips from 2022 to 2026, sticky notes from ลูกพีชน้อย say they're still waiting, and a music
// box plays on a little table under a dust sheet. The choker's heart padlock is in the music box. No ghost
// comes in here.
import * as THREE from 'three';
import { art } from './tex.js';
import { sfx } from '../audio.js';
import { buildLock } from './choker.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
export const TABLE = V(1.0, 0, -3.95);
const NOTES = [
  'ยังรออยู่นะคะ', 'สบายดีไหมพีชชี่', 'ลูกพีชน้อยยังอยู่ตรงนี้นะ', 'วันที่ 500 แล้ว ยังรอ', 'คิดถึงเสียงหัวเราะ', 'ไม่ต้องรีบนะ ค่อยๆ กลับมา',
  'ดูคลิปเก่าวนร้อยรอบแล้ว', 'กินข้าวยังคะ', 'วันที่ 1,000 ♡', 'รอฟังเพลงใหม่นะ', 'ขอให้หายเหนื่อยนะ', 'กลับมาแล้ว!! 12.09.2026',
];
const NOTE_SPOTS = [ // [x, y, z, ry]
  [-1.885, 1.45, -6.3, Math.PI / 2], [-1.885, 1.25, -4.4, Math.PI / 2], [-1.885, 1.55, -2.1, Math.PI / 2],
  [-1.25, 1.35, -6.885, 0], [-0.6, 1.6, -6.885, 0], [0.4, 1.3, -6.885, 0], [1.25, 1.55, -6.885, 0],
  [4.385, 1.35, -6.2, -Math.PI / 2], [4.385, 1.25, -2.2, -Math.PI / 2], [4.385, 1.5, -1.6, -Math.PI / 2],
  [2.6, 1.3, -1.115, Math.PI], [3.95, 1.55, -1.115, Math.PI],
];
const NOTE_COLORS = ['#fff39a', '#ffc8dc', '#c8ecff', '#d4f7c4'];

function tallyWall(count, seed, w = 2048, h = 512, label = false) {
  return art(w, h, (g) => {
    g.clearRect(0, 0, w, h);
    let s = seed;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    const groups = Math.ceil(count / 5), gw = 58, gh = 96, cols = Math.floor((w - 40) / (gw + 8));
    g.lineCap = 'round';
    let left = count;
    for (let i = 0; i < groups; i++) {
      const cx = 24 + (i % cols) * (gw + 8) + (rnd() - 0.5) * 10, cy = 16 + Math.floor(i / cols) * (gh + 22) + (rnd() - 0.5) * 12;
      const n = Math.min(5, left); left -= n;
      g.strokeStyle = `rgba(${230 + rnd() * 20},${222 + rnd() * 20},${205 + rnd() * 20},${0.55 + rnd() * 0.35})`;
      g.lineWidth = 2.6 + rnd() * 1.4;
      g.save(); g.translate(cx, cy); g.rotate((rnd() - 0.5) * 0.12);
      for (let k = 0; k < Math.min(4, n); k++) { const x = 6 + k * 11 + (rnd() - 0.5) * 3; g.beginPath(); g.moveTo(x, 4 + rnd() * 5); g.lineTo(x + (rnd() - 0.5) * 5, gh - 6 - rnd() * 6); g.stroke(); }
      if (n === 5) { g.beginPath(); g.moveTo(-2, gh * 0.72); g.lineTo(gw - 2, gh * 0.25); g.stroke(); }
      g.restore();
    }
    if (label) {
      g.strokeStyle = 'rgba(220,40,60,0.9)'; g.lineWidth = 5;
      g.beginPath(); g.ellipse(w - 220, h - 70, 160, 52, -0.05, 0, TAU); g.stroke();
      g.fillStyle = 'rgba(220,40,60,0.95)'; g.font = '400 54px Sriracha, cursive'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('1,702 วัน', w - 220, h - 66);
    }
  });
}

const PAGES = [
  ['มกราคม', '2022', 14, 'ไลฟ์ล่าสุด'], ['2023', '2023', 0, ''], ['2024', '2024', 0, ''], ['2025', '2025', 0, ''], ['กันยายน', '2026', 12, 'กลับมาแล้ว!'],
];
function calendarPage(i) {
  const [month, year, day, note] = PAGES[i];
  return art(256, 356, (g, w, h) => {
    g.fillStyle = '#f7f2e6'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#c0283a'; g.fillRect(0, 0, w, 70);
    g.fillStyle = '#fff'; g.font = '600 30px Kanit, sans-serif'; g.textAlign = 'center'; g.fillText(`${month} ${year}`, w / 2, 46);
    g.fillStyle = '#3a2a2a'; g.font = '500 17px Kanit, sans-serif';
    for (let d = 1; d <= 31; d++) {
      const x = 22 + ((d - 1) % 7) * 35, y = 108 + Math.floor((d - 1) / 7) * 44;
      g.fillStyle = d === day ? '#c0283a' : '#3a2a2a'; g.fillText(String(d), x + 8, y);
      if (!day || d < day) { g.strokeStyle = 'rgba(40,30,30,0.55)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x - 4, y - 14); g.lineTo(x + 20, y + 4); g.moveTo(x + 20, y - 14); g.lineTo(x - 4, y + 4); g.stroke(); }
      if (d === day) { g.strokeStyle = '#e0304a'; g.lineWidth = 3; g.beginPath(); g.ellipse(x + 8, y - 6, 18, 15, 0, 0, TAU); g.stroke(); }
    }
    if (note) { g.fillStyle = '#e0304a'; g.font = '400 24px Sriracha, cursive'; g.fillText(note, w / 2, h - 18); }
  });
}

function stickyNote(text, color) {
  return art(160, 160, (g, w, h) => {
    g.fillStyle = color; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,0.06)'; g.fillRect(0, 0, w, 18);
    g.fillStyle = '#3a2a36'; g.font = '400 22px Sriracha, cursive'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const words = text.split(' '); const lines = []; let cur = '';
    for (const wd of words) { const t = cur ? `${cur} ${wd}` : wd; if (g.measureText(t).width > 136 && cur) { lines.push(cur); cur = wd; } else cur = t; }
    if (cur) lines.push(cur);
    lines.forEach((l, i) => g.fillText(l, w / 2, h / 2 + (i - (lines.length - 1) / 2) * 30));
    g.font = '400 13px Sriracha, cursive'; g.fillStyle = 'rgba(58,42,54,0.7)'; g.fillText('— ลูกพีชน้อย', w / 2, h - 14);
  });
}

export class WaitingRoom {
  constructor(scene) {
    const root = new THREE.Group(); root.name = 'waitingRoom'; root.visible = false;
    scene.add(root);
    this.root = root;
    const decal = (tex, w, h, p, ry, rough = 0.9) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, roughness: rough, polygonOffset: true, polygonOffsetFactor: -2 }));
      m.position.copy(p); m.rotation.y = ry; root.add(m); return m;
    };
    // 1,702 tallies across three walls (600 + 551 + 551)
    decal(tallyWall(600, 7), 6.1, 1.4, V(1.25, 2.05, -6.888), 0);
    decal(tallyWall(551, 13), 5.6, 1.4, V(-1.888, 2.05, -3.95), Math.PI / 2);
    decal(tallyWall(551, 29, 2048, 512, true), 5.6, 1.4, V(4.388, 2.05, -3.95), -Math.PI / 2);
    // the calendar that flips from 2022 to 2026
    this.pages = PAGES.map((_, i) => calendarPage(i));
    this.cal = decal(this.pages[0], 0.36, 0.5, V(3.25, 1.5, -1.113), Math.PI, 0.8);
    this.cal.material.transparent = false; this.cal.material.depthWrite = true;
    // sticky notes from the fans
    NOTES.forEach((t, i) => {
      const [x, y, z, ry] = NOTE_SPOTS[i];
      const n = decal(stickyNote(t, i === NOTES.length - 1 ? '#ff9ac8' : NOTE_COLORS[i % 4]), i === NOTES.length - 1 ? 0.17 : 0.13, i === NOTES.length - 1 ? 0.17 : 0.13, V(x, y, z), ry, 0.95);
      n.rotation.z = (Math.sin(i * 7.3) * 0.12);
    });
    // a little table with the music box and a candle
    const wood = new THREE.MeshStandardMaterial({ color: 0x6a4028, roughness: 0.6 });
    const table = new THREE.Group(); table.position.copy(TABLE); root.add(table);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.03, 28), wood); top.position.y = 0.6; table.add(top);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.6, 10), wood); leg.position.y = 0.3; table.add(leg);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.03, 20), wood); foot.position.y = 0.015; table.add(foot);
    const box = new THREE.Group(); box.position.set(0.02, 0.615, 0); table.add(box);
    const pinkMat = new THREE.MeshStandardMaterial({ color: 0xff9ac8, roughness: 0.4 }), goldMat = new THREE.MeshStandardMaterial({ color: 0xe8b84a, metalness: 0.8, roughness: 0.3 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.07, 0.11), pinkMat); base.position.y = 0.035; box.add(base);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(0.165, 0.012, 0.115), goldMat); trim.position.y = 0.07; box.add(trim);
    const lidPivot = new THREE.Group(); lidPivot.position.set(0, 0.075, -0.055); box.add(lidPivot);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.025, 0.11), pinkMat); lid.position.set(0, 0.0125, 0.055); lidPivot.add(lid);
    const heartTop = buildLock(); heartTop.scale.setScalar(0.8); heartTop.rotation.x = -Math.PI / 2; heartTop.position.set(0, 0.027, 0.055); lidPivot.add(heartTop);
    this.lock = buildLock(); this.lock.position.set(0, 0.07, 0); this.lock.visible = true; box.add(this.lock);
    const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.1, 12), new THREE.MeshStandardMaterial({ color: 0xf8f0e0 })); candle.position.set(-0.17, 0.665, 0.08); table.add(candle);
    this.flame = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.5, 1.5, 0.6), toneMapped: false })); this.flame.scale.set(1, 1.8, 1); this.flame.position.set(-0.17, 0.73, 0.08); table.add(this.flame);
    this.light = new THREE.PointLight(0xffb070, 0, 4.5, 2); this.light.position.set(TABLE.x - 0.17, 0.85, TABLE.z + 0.08);
    scene.add(this.light); // always in the scene (no shader recompiles); dark until the room opens
    // the dust sheet over the table
    const sheet = new THREE.Group(); sheet.position.set(TABLE.x, 0, TABLE.z); root.add(sheet);
    const cloth = new THREE.MeshStandardMaterial({ color: 0xe8e4dc, roughness: 1, side: THREE.DoubleSide });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.34, 20, 10, 0, TAU, 0, Math.PI / 2), cloth); dome.scale.set(1, 0.5, 1); dome.position.y = 0.66; sheet.add(dome);
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.42, 0.6, 20, 1, true), cloth); skirt.position.y = 0.36; sheet.add(skirt);
    this.sheet = sheet; this.lidPivot = lidPivot; this.box = box;
    root.traverse((o) => { if (o.isMesh) o.castShadow = false; });
    this.reset();
  }

  reset() {
    this.root.visible = false;
    this.light.intensity = 0;
    this.entered = false;
    this.sheetT = -1; this.calT = -1; this.page = 0;
    this.cal.material.map = this.pages[0]; this.cal.material.needsUpdate = true;
    this.sheet.position.set(TABLE.x, 0, TABLE.z); this.sheet.rotation.set(0, 0, 0); this.sheet.visible = true;
    this.lidPivot.rotation.x = 0; this.lock.visible = true; this.lock.position.y = 0.07;
    this.musicT = 0; this.open = false;
  }

  show() { this.root.visible = true; this.light.intensity = 1.6; }
  get shown() { return this.root.visible; }

  /** The first step inside: the sheet slides off, the calendar starts flipping. */
  enter() {
    if (this.entered) return;
    this.entered = true;
    this.sheetT = 0; this.calT = 0;
    sfx.play('whoosh', { vol: 0.6 });
  }

  openBox() {
    if (this.open) return false;
    this.open = true;
    this.lock.visible = false;
    return true;
  }

  update(dt, t, player) {
    if (!this.root.visible) return;
    this.flame.scale.y = 1.8 + Math.sin(t * 13) * 0.2; this.light.intensity = 1.4 + Math.sin(t * 11) * 0.12 + Math.sin(t * 23) * 0.06;
    if (this.sheetT >= 0 && this.sheetT < 1.3) {
      this.sheetT += dt;
      const k = Math.min(1, this.sheetT / 1.1), e = k * k;
      this.sheet.position.set(TABLE.x + e * 0.75, -e * 0.58, TABLE.z + e * 0.2);
      this.sheet.rotation.z = -e * 1.2;
      if (this.sheetT >= 1.3) this.sheet.visible = false;
    }
    if (this.calT >= 0 && this.page < PAGES.length - 1) {
      this.calT += dt;
      if (this.calT > 1.3 + this.page * 0.9) { this.page++; this.cal.material.map = this.pages[this.page]; this.cal.material.needsUpdate = true; sfx.play('pageFlip'); }
    }
    if (this.entered) {
      this.lidPivot.rotation.x += ((this.open || this.entered ? -1.2 : 0) - this.lidPivot.rotation.x) * Math.min(1, dt * 3);
      this.musicT -= dt;
      if (this.musicT <= 0 && player) {
        this.musicT = 4.4;
        const dx = TABLE.x - player.position.x, dz = TABLE.z - player.position.z, d = Math.hypot(dx, dz) || 1;
        const pan = Math.max(-0.8, Math.min(0.8, (dx * Math.cos(player.yaw) - dz * Math.sin(player.yaw)) / d));
        sfx.play('musicBox', { pan, vol: Math.max(0.15, Math.min(1, 2.5 / (1 + d * 0.5))) });
      }
      if (!this.open) this.lock.position.y = 0.07 + Math.sin(t * 2) * 0.01;
    }
  }
}
