// Progress outside the nights: achievements (a toast in play, a page in the album), money ฿ (super
// chats and requests during a night, paid out when it ends) and the shop "ร้านลูกพีช" (bought on the
// title, used by the next nights). Also the title's extra notebook pages: night select, shop, album.
import { UI } from '../ui.js';
import { sfx } from '../audio.js';
import { Save } from './save.js';
import { MEMES } from '../systems/memes.js';

export const ACH = [
  { id: 'mod', name: 'I am Mod!', desc: 'ผ่านคืนที่ 1', icon: '🎧' },
  { id: 'goldpeach', name: 'ลูกพีชทองคำ', desc: 'ผ่านคืนที่ 2', icon: '🍑' },
  { id: 'owner', name: 'เจ้าของช่องมาเอง', desc: 'ชนะบอส PeachiBot', icon: '🔨' },
  { id: 'halloween', name: 'Happy Halloween!', desc: 'ดูฉากจบ', icon: '🎃' },
  { id: 'scream', name: 'กรี๊ดแตก!!!!!', desc: 'กรี๊ดรวม 50 ครั้ง', icon: '😱', count: ['screams', 50] },
  { id: 'popcat', name: 'เอาชัยชนะของประเทศไทยคืนมา', desc: 'POPCAT รวม 1,000 ครั้ง', icon: '🐱', count: ['pops', 1000] },
  { id: 'wifi', name: 'ให้รหัส Wi-Fi แล้ว', desc: 'บอกรหัส Wi-Fi ให้กระสือ', icon: '📶' },
  { id: 'mookata', name: 'หมูกระทะหมดแล้วนะ', desc: 'ป้อนขนมผีปอบรวม 10 ครั้ง', icon: '🍖', count: ['fed', 10] },
  { id: 'tally', name: '1,702', desc: 'เข้าห้องแห่งการรอ', icon: '🕯️' },
  { id: 'clip', name: 'คลิปนี้ต้องได้!', desc: 'ถ่ายรูปติดพีชชี่ กระสือ ผีปอบ และตัวปลอม', icon: '📸' },
  { id: 'nolight', name: 'มอดไร้ไฟ', desc: 'ผ่านคืนไหนก็ได้โดยไม่เปิดไฟฉายเลย', icon: '🔦' },
  { id: 'quiet', name: 'ไม่ต้องกรี๊ดก็ได้', desc: 'ผ่านคืนไหนก็ได้โดยไม่กรี๊ดเลย', icon: '🤫' },
  { id: 'speed', name: 'ไลฟ์สั้นที่สุด', desc: 'ผ่านคืนที่ 1 ก่อนตีสอง', icon: '⏱️' },
  { id: 'appeal', name: 'ยื่นอุทธรณ์สำเร็จ', desc: 'ผ่านเฟส 2 ของบอสโดยไม่โดนสไตรก์', icon: '📝' },
  { id: 'clean', name: 'ช่องสะอาด', desc: 'ชนะบอสโดยไม่โดนสไตรก์เลย', icon: '✨' },
  { id: 'eagle', name: 'ตาดี', desc: 'แจ้งความผิดปกติถูกรวม 10 ครั้ง', icon: '👁️', count: ['anomalies', 10] },
  { id: 'karaoke', name: 'นักร้องประจำไลฟ์', desc: 'ร้องคาราโอเกะกับพีชชี่ผ่าน', icon: '🎤' },
  { id: 'dance', name: 'แดนซ์ตามพีชชี่', desc: 'เต้นตามพีชชี่ผ่าน', icon: '💃' },
  { id: 'memes', name: 'นักสะสมรูปลับ', desc: `เก็บรูปลับพีชชี่ครบ ${MEMES.length} รูป`, icon: '🖼️' },
  { id: 'rich', name: 'สายเปย์', desc: 'ได้เงินรวม ฿5,000', icon: '💸', count: ['earned', 5000] },
  { id: 'shopper', name: 'ลูกค้าประจำ', desc: 'ซื้อของร้านลูกพีช 5 ชิ้น', icon: '🛍️', count: ['bought', 5] },
  { id: 'deleted', name: 'ช่องถูกลบ (ชั่วคราว)', desc: 'แพ้บอสจนโดนลบช่อง', icon: '🗑️', hidden: true },
  { id: 'resign', name: 'ขอลาออกค่ะ', desc: 'ลาออกกลางไลฟ์ที่ประตูหน้าบ้าน', icon: '🚪', hidden: true },
];
const DEF = Object.fromEntries(ACH.map((a) => [a.id, a]));

export const SHOP = [
  { id: 'battery', icon: '🔋', name: 'ถ่านก้อนใหญ่', desc: 'คืนถัดไป ไฟฉายกินแบตน้อยลง 40%', price: 100, max: 3 },
  { id: 'peach', icon: '🍑', name: 'ขนมพีช', desc: 'พีชชี่หิวเมื่อไหร่ หยิบจากกระเป๋าได้เลย ไม่ต้องไปครัว', price: 80, max: 5 },
  { id: 'amulet', icon: '🧧', name: 'ยันต์กันผี', desc: 'โดนพีชชี่จับได้ รอด 1 ครั้ง (แล้วยันต์ไหม้)', price: 249, max: 2 },
  { id: 'soda', icon: '🥤', name: 'น้ำแดง', desc: 'คืนที่ 3: น้ำแดงในตู้เย็นเพิ่ม 1 ขวด', price: 60, max: 3 },
  { id: 'mic', icon: '🎙️', name: 'ไมค์คอนเดนเซอร์', desc: 'ถาวร: กด Space น้อยลงก็กรี๊ดได้', price: 400, once: true },
  { id: 'case', icon: '📱', name: 'เคสมือถือลายพีช', desc: 'ถาวร: มือถือมอดลายลูกพีช (สวยอย่างเดียว)', price: 300, once: true },
];
const NIGHTS = [
  [1, 'หูฟังหูแมว', '30 ต.ค.'],
  [2, 'ลูกพีชทองคำ + กระสือ', '31 ต.ค. ก่อนรุ่ง'],
  [3, 'คืนฮาโลวีน · โชคเกอร์หัวใจ', '31 ต.ค.'],
];
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const el = (tag, cls, parent, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; if (parent) parent.appendChild(n); return n; };

// ---------------------------------------------------------------- achievements
let toastBox = null;
function toast(a) {
  if (!toastBox) { toastBox = el('div', 'ach-box'); UI.mount(toastBox); }
  const t = el('div', 'ach-toast', toastBox);
  el('span', 'ach-icon', t, a.icon);
  const b = el('div', null, t);
  el('div', 'ach-label', b, 'ปลดล็อกความสำเร็จ');
  el('div', 'ach-name', b, a.name);
  try { sfx.play('sparkle'); } catch (e) { /* no audio */ }
  setTimeout(() => t.classList.add('out'), 4200);
  setTimeout(() => t.remove(), 4800);
}

export const Ach = {
  has(id) { return !!Save.data.achievements[id]; },
  unlock(id) {
    const a = DEF[id];
    if (a && Save.unlock(id)) toast(a);
  },
  /** Add to a lifetime counter; unlocks what it reaches. */
  count(key, n = 1) {
    if (!n) return;
    const c = Save.data.counts;
    c[key] = (c[key] || 0) + n;
    Save.set({});
    for (const a of ACH) if (a.count && a.count[0] === key && c[key] >= a.count[1]) this.unlock(a.id);
  },
  /** A photo's subjects, for "คลิปนี้ต้องได้!". */
  photographed(kinds) {
    const seen = Save.data.counts.seen || (Save.data.counts.seen = {});
    for (const k of kinds) seen[k] = 1;
    Save.set({});
    if (['peachi', 'krasue', 'pop', 'fake'].every((k) => seen[k])) this.unlock('clip');
  },
};

// ---------------------------------------------------------------- money + items
export const Money = {
  get() { return Save.data.money; },
  add(n) {
    n = Math.round(n);
    if (n <= 0) return;
    Save.set({ money: Save.data.money + n });
    Ach.count('earned', n);
  },
};

export const Shop = {
  has(id) { return (Save.data.inv[id] || 0) > 0; },
  left(id) { return Save.data.inv[id] || 0; },
  /** Use one; true if there was one. */
  use(id) {
    const inv = Save.data.inv;
    if (!inv[id]) return false;
    const it = SHOP.find((s) => s.id === id);
    if (it && it.once) return true; // permanent
    inv[id]--;
    Save.set({});
    return true;
  },
  canBuy(it) {
    const n = this.left(it.id);
    return Save.data.money >= it.price && (it.once ? n < 1 : n < it.max);
  },
  buy(id) {
    const it = SHOP.find((s) => s.id === id);
    if (!it || !this.canBuy(it)) return false;
    const inv = Save.data.inv;
    inv[id] = (inv[id] || 0) + 1;
    Save.set({ money: Save.data.money - it.price });
    Ach.count('bought', 1);
    return true;
  },
};

// ---------------------------------------------------------------- title pages
/** Adds the night select, shop and album pages to the title's notebook. onPick(n) starts night n. */
export function mountMetaPanels({ onPick }) {
  UI.addMenuPanel('nights', 'เลือกคืน', (root) => {
    root.replaceChildren();
    el('p', 'ptext', root, 'คืนที่ผ่านแล้วเล่นซ้ำได้ เก็บของสะสมกับความสำเร็จที่ยังขาด');
    const next = Save.nextNight;
    for (const [n, name, date] of NIGHTS) {
      const open = n <= next;
      const b = el('button', `night-pick${open ? '' : ' locked'}`, root);
      b.type = 'button'; b.disabled = !open;
      el('span', 'np-n', b, `คืนที่ ${n}`);
      el('span', 'np-name', b, open ? name : '???');
      el('span', 'np-state', b, Save.cleared(n) ? 'ผ่านแล้ว ✓' : open ? `${date} · เล่นต่อ →` : 'ล็อก');
      if (open) b.addEventListener('click', () => { UI.closeMenuPanel(); onPick(n); });
    }
  });
  UI.addMenuPanel('shop', 'ร้านลูกพีช', (root) => {
    const draw = () => {
      root.replaceChildren();
      const top = el('div', 'shop-money', root);
      el('span', null, top, 'เงินมอด');
      el('b', 'tnum', top, `฿${fmt(Money.get())}`);
      el('p', 'pnote', root, 'ได้เงินจากซุปแชตกับคำขอของพีชชี่ระหว่างไลฟ์ จบคืนแล้วเงินเข้าทันที (แพ้ได้ครึ่งเดียว)');
      for (const it of SHOP) {
        const row = el('div', 'shop-row', root);
        el('span', 'shop-icon', row, it.icon);
        const mid = el('div', 'shop-mid', row);
        el('div', 'shop-name', mid, it.name + (Shop.left(it.id) ? (it.once ? ' · มีแล้ว' : ` · มี ${Shop.left(it.id)}`) : ''));
        el('div', 'shop-desc', mid, it.desc);
        const b = el('button', 'shop-buy', row, it.once && Shop.left(it.id) ? '✓' : `฿${it.price}`);
        b.type = 'button';
        b.disabled = !Shop.canBuy(it);
        b.addEventListener('click', (e) => {
          e.stopPropagation(); // the list re-renders; a detached target would read as a click outside the page
          if (Shop.buy(it.id)) { try { sfx.play('superchat'); } catch (err) { /* */ } draw(); UI.refreshProgress(); }
        });
      }
    };
    draw();
  });
  UI.addMenuPanel('album', 'อัลบั้ม', (root) => {
    root.replaceChildren();
    const got = ACH.filter((a) => Ach.has(a.id)).length;
    el('div', 'chead', root, `ความสำเร็จ ${got}/${ACH.length}`);
    const grid = el('div', 'ach-grid', root);
    for (const a of ACH) {
      const on = Ach.has(a.id);
      const c = el('div', `ach-cell${on ? ' on' : ''}`, grid);
      el('span', 'ach-icon', c, on || !a.hidden ? a.icon : '❔');
      const t = el('div', null, c);
      el('div', 'ach-name', t, on || !a.hidden ? a.name : '???');
      el('div', 'ach-desc', t, on || !a.hidden ? a.desc : 'ความสำเร็จลับ');
    }
    const memes = MEMES.filter((m) => Save.data.memes[m.id]);
    el('div', 'chead', root, `รูปลับพีชชี่ ${memes.length}/${MEMES.length}`);
    const mg = el('div', 'album-grid', root);
    for (const m of MEMES) {
      const f = el('div', 'album-pic', mg);
      if (Save.data.memes[m.id]) { f.style.backgroundImage = `url(assets/memes/${m.id}.webp)`; f.title = m.caption; } else f.textContent = '?';
    }
    const shots = Save.data.photos || [];
    el('div', 'chead', root, `รูปเด็ดของมอด ${shots.length}`);
    if (!shots.length) el('div', 'cline', root, 'ยังไม่มี (ถ่ายรูปผีระหว่างไลฟ์ รูปที่ดีที่สุดของคืนจะมาอยู่ที่นี่)');
    const pg = el('div', 'album-grid wide', root);
    for (const p of shots.slice().reverse()) {
      const f = el('div', 'album-pic shot', pg);
      f.style.backgroundImage = `url(${p.url})`;
      el('span', null, f, p.caption);
    }
    el('div', 'chead', root, 'ฉากจบ');
    el('div', 'cline', root, Save.data.endings.normal ? '✓ ฉากจบปกติ · Happy Halloween' : '???');
  });
}
