// Secret pictures: funny shots of Peachi's new 3D model (made by Master Tankhun in Blender), hidden around
// the house as an easter egg. A cork board of photo cards on the stream room's south wall (behind you as
// you walk in), a gold-framed "masterpiece" above the living-room TV, and a photo stuck on the fridge.
// Press E on one to see it big with its caption; each one found is remembered (Save.memes).
import * as THREE from 'three';
import { UI } from '../ui.js';
import { sfx } from '../audio.js';
import { Save } from '../game/save.js';
import { art } from '../world/tex.js';

const URL_OF = (f) => new URL(`../../assets/memes/${f}.webp`, import.meta.url).href;

export const MEMES = [
  { id: 'shock', caption: 'ตอนเห็นบิลค่าไฟ หลังไลฟ์ 249 ชั่วโมง' },
  { id: 'xd', caption: 'ตอนได้ซุปแชต 20 บาท' },
  { id: 'smile', caption: 'ตอนมอดหาหูฟังเจอ' },
  { id: 'yawn', caption: 'ตีสี่ ชั่วโมงที่ 247 ของไลฟ์' },
  { id: 'oh', caption: 'ตอนแชตพิมพ์ว่า "ข้างหลัง"' },
  { id: 'calm', caption: 'หน้าตอนบอกว่า "ไม่ได้กลัวผีนะ"' },
  { id: 'surprised', caption: 'ตอนรู้ว่ามอดทำงานฟรี' },
  { id: 'dank', caption: 'ผลงานชิ้นเอก: "พีชชี่ตอนอ่านแชตผี"' },
];
const BOARD = ['shock', 'xd', 'smile', 'yawn', 'oh', 'calm'];
const BOARD_AT = new THREE.Vector3(-6.9, 1.55, -1.11);  // stream room, south wall, facing into the room
const FRAME_AT = new THREE.Vector3(9.875, 2.15, 4.1);   // living room, above the TV
const FRIDGE_AT = new THREE.Vector3(-9.71, 1.47, 6.124); // kitchen, fridge door

const loader = new THREE.TextureLoader();
const tex = {};
function photo(id) {
  if (!tex[id]) { const t = loader.load(URL_OF(id)); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; tex[id] = t; }
  return tex[id];
}

function polaroid(id, w, h, tilt = 0) {
  const g = new THREE.Group();
  const card = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.004), new THREE.MeshStandardMaterial({ color: 0xf7f0e1, roughness: 0.85 }));
  const pw = w * 0.86, ph = pw * 0.92;
  const pic = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), new THREE.MeshStandardMaterial({ map: photo(id), roughness: 0.55 }));
  pic.position.set(0, h / 2 - w * 0.07 - ph / 2, 0.0025);
  const pin = new THREE.Mesh(new THREE.SphereGeometry(0.011, 10, 8), new THREE.MeshStandardMaterial({ color: [0xff3a5a, 0x3a9aff, 0xffd23a, 0x5aff8a][id.length % 4], roughness: 0.3 }));
  pin.position.set(0, h / 2 - 0.02, 0.01);
  g.add(card, pic, pin);
  g.rotation.z = tilt;
  return g;
}

function corkBoard() {
  const g = new THREE.Group();
  const cork = art(512, 300, (c, w, h) => {
    c.fillStyle = '#b8864e'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) { c.fillStyle = `rgba(${Math.random() < 0.5 ? '80,50,20' : '230,190,130'},${0.15 + Math.random() * 0.25})`; c.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2); }
    c.fillStyle = '#fff4f8'; c.font = '400 30px Sriracha, cursive'; c.textAlign = 'center';
    c.save(); c.translate(w / 2, 34); c.rotate(-0.02); c.fillText('Peachi reaction pack ♡ ห้ามแคป!', 0, 0); c.restore();
  });
  const W = 1.5, H = 0.88;
  g.add(new THREE.Mesh(new THREE.BoxGeometry(W + 0.06, H + 0.06, 0.025), new THREE.MeshStandardMaterial({ color: 0x5a3620, roughness: 0.6 })));
  const face = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshStandardMaterial({ map: cork, roughness: 0.95 }));
  face.position.z = 0.0131; g.add(face);
  BOARD.forEach((id, i) => {
    const p = polaroid(id, 0.3, 0.34, [0.05, -0.04, 0.03, -0.06, 0.04, -0.02][i]);
    p.position.set(-0.5 + (i % 3) * 0.5 + (i > 2 ? 0.06 : 0), 0.13 - Math.floor(i / 3) * 0.4 + (i % 2 ? 0.02 : 0), 0.018);
    g.add(p);
  });
  return g;
}

function goldFrame() {
  const g = new THREE.Group();
  const gold = new THREE.MeshStandardMaterial({ color: 0xd8a840, metalness: 0.8, roughness: 0.3 });
  const W = 0.5, H = 0.625, B = 0.06;
  for (const [x, y, w, h] of [[0, (H + B) / 2, W + 2 * B, B], [0, -(H + B) / 2, W + 2 * B, B], [(W + B) / 2, 0, B, H], [-(W + B) / 2, 0, B, H]]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.045), gold); m.position.set(x, y, 0.0225); g.add(m);
  }
  const pic = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshStandardMaterial({ map: photo('dank'), roughness: 0.4 }));
  pic.position.z = 0.012; g.add(pic);
  const plaque = art(256, 64, (c, w, h) => { c.fillStyle = '#c89a3a'; c.fillRect(0, 0, w, h); c.fillStyle = '#2a1a08'; c.font = '600 26px Kanit, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('ผลงานชิ้นเอก', w / 2, h / 2 + 2); });
  const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.05), new THREE.MeshStandardMaterial({ map: plaque, metalness: 0.5, roughness: 0.4 }));
  pl.position.set(0, -H / 2 - B - 0.045, 0.01); g.add(pl);
  return g;
}

export class Memes {
  constructor({ scene }) {
    const board = corkBoard(); board.position.copy(BOARD_AT); board.rotation.y = Math.PI; scene.add(board);
    const frame = goldFrame(); frame.position.copy(FRAME_AT); frame.rotation.y = -Math.PI / 2; scene.add(frame);
    const fridge = polaroid('surprised', 0.16, 0.18, 0.08); fridge.position.copy(FRIDGE_AT); fridge.rotation.y = Math.PI; scene.add(fridge);
    this.open = null;
    this._dom();
  }

  get found() { return MEMES.filter((m) => Save.data.memes[m.id]).length; }

  /** Interactables for the night (removed with it). */
  attach(night) {
    const spots = [
      { at: new THREE.Vector3(BOARD_AT.x, 1.35, BOARD_AT.z - 0.3), r: 1.9, label: '[E] ดูรูปบนบอร์ด', ids: BOARD },
      { at: new THREE.Vector3(FRAME_AT.x - 0.4, 1.7, FRAME_AT.z), r: 2.2, label: '[E] ดูภาพในกรอบทอง', ids: ['dank'] },
      { at: new THREE.Vector3(FRIDGE_AT.x, 1.3, FRIDGE_AT.z - 0.25), r: 1.5, label: '[E] ดูรูปบนตู้เย็น', ids: ['surprised'] },
    ];
    for (const s of spots) night.interact({ position: s.at, radius: s.r, label: () => (this.open ? '[E] เก็บรูป' : s.label), onUse: () => this.show(s.ids), enabled: () => night.state === 'play' });
  }

  show(ids) {
    if (this.open) { this.close(); return; }
    const fresh = ids.filter((id) => Save.findMeme(id));
    this.card.replaceChildren();
    this.card.classList.toggle('grid', ids.length > 1);
    for (const id of ids) {
      const m = MEMES.find((x) => x.id === id);
      const c = document.createElement('figure');
      c.className = 'meme-card';
      const img = document.createElement('img'); img.src = URL_OF(id); img.alt = m.caption;
      const cap = document.createElement('figcaption'); cap.textContent = m.caption;
      c.append(img, cap);
      this.card.appendChild(c);
    }
    this.el.classList.add('on');
    this.open = ids;
    sfx.play(fresh.length ? 'found' : 'pickup');
    if (fresh.length) UI.toast(`เจอรูปลับของพีชชี่! (${this.found}/${MEMES.length})`);
    clearTimeout(this._t);
    this._t = setTimeout(() => this.close(), ids.length > 1 ? 8000 : 5000);
  }

  close() {
    this.open = null;
    clearTimeout(this._t);
    this.el.classList.remove('on');
  }

  _dom() {
    const el = document.createElement('div');
    el.className = 'memes';
    this.card = document.createElement('div');
    this.card.className = 'meme-cards';
    const note = document.createElement('div');
    note.className = 'meme-note';
    note.textContent = 'รูปจากโมเดล 3D ตัวใหม่ของพีชชี่ · กด E เก็บรูป';
    el.append(this.card, note);
    this.el = el;
    UI.mount(el);
  }
}
