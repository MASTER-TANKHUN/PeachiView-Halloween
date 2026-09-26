// Difficulty (a setting): ลูกพีชน้อย (easy) / ปกติ / ตีสาม (hard). Ghost movement is multiplied by
// DIFF.speed; the night reads the rest (battery drain, spam rate, the bathroom jail, troll chat).
import { Settings } from '../settings.js';

export const MODES = {
  easy: { speed: 0.75, drain: 0.67, spam: 1.3, jail: true, trolls: false, label: 'ลูกพีชน้อย' },
  normal: { speed: 1, drain: 1, spam: 1, jail: false, trolls: false, label: 'ปกติ' },
  hard: { speed: 1.2, drain: 1.2, spam: 0.7, jail: false, trolls: true, label: 'ตีสาม' },
};
export const DIFF = { id: 'normal', ...MODES.normal };
Settings.onChange((s) => { const id = MODES[s.difficulty] ? s.difficulty : 'normal'; Object.assign(DIFF, MODES[id], { id }); });

/** ตีสาม: the chat is all trolls with wrong tips. */
export const TROLLS = [
  { user: 'เกรียน_ตีสาม', text: 'หูฟังอยู่ในตู้เย็นแน่นอน เชื่อผม' },
  { user: 'troll_249', text: 'ปิดไฟฉายสิ ผีกลัวความมืด 555' },
  { user: 'คนดูสายป่วน', text: 'อย่ากรี๊ดนะ เดี๋ยวพีชชี่ตกใจ (โกหก)' },
  { user: 'เกรียน_ตีสาม', text: 'ซ่อนในตู้ไปเลย ปลอดภัยแน่ๆ… มั้ง' },
  { user: 'ผู้เชี่ยวชาญ_ตัวปลอม', text: 'ทางลัด: เดินชนกำแพงไปเรื่อยๆ เดี๋ยวก็ทะลุ' },
  { user: 'troll_249', text: 'มอดเดินช้าจัง ยายผมยังเร็วกว่า' },
  { user: 'คนดูสายป่วน', text: 'พีชชี่อยู่ข้างหลัง!! …ล้อเล่น …หรือเปล่านะ' },
  { user: 'เกรียน_ตีสาม', text: 'แบนผมไม่ได้หรอก ผมไม่ใช่สแปม 😏' },
  { user: 'ผู้เชี่ยวชาญ_ตัวปลอม', text: 'ผมเล่นจบแล้ว ตอนจบคือมอดเป็นผีเองแหละ' },
];
