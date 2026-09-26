// Doors and light switches: E opens/closes a door (creak, shut), flips a room's lights. Some doors can be
// locked by the night (the guest room in Nights 1–2: peek through the keyhole). Ghosts ignore doors.
import { sfx } from '../audio.js';
import { UI } from '../ui.js';

/** Stereo pan / volume of a world point for the player. */
export function panFor(player, x, z) {
  const dx = x - player.position.x, dz = z - player.position.z;
  const d = Math.hypot(dx, dz) || 1;
  const pan = Math.max(-0.9, Math.min(0.9, (dx * Math.cos(player.yaw) - dz * Math.sin(player.yaw)) / d));
  return { pan, vol: Math.max(0.15, Math.min(1, 1.6 / (1 + d * 0.35))), dist: d };
}

export class Doors {
  constructor({ level, player }) {
    this.level = level;
    this.player = player;
    this.locked = new Set();
    this.handles = [];
    this.onFront = null;      // () => void: the front door was used (resign joke)
    this.onKeyhole = null;    // (id) => void
    this.onSwitch = null;     // (room, on) => void
    this.frontLabel = '[E] ออกจากบ้าน';
    this.lockedLabel = '[E] ส่องรูกุญแจ';
  }

  attach() {
    this.detach();
    const { level, player } = this;
    for (const d of Object.values(level.doors)) {
      this.handles.push(player.addInteractable({
        position: d.center,
        radius: 1.35,
        label: () => {
          if (d.id === 'front' && this.onFront) return this.frontLabel;
          if (this.locked.has(d.id)) return this.lockedLabel;
          return level.doorOpen(d.id) ? '[E] ปิดประตู' : '[E] เปิดประตู';
        },
        onUse: () => this.use(d.id),
        enabled: () => d.id !== 'front' || !!this.onFront,
      }));
    }
    for (const sw of level.switches) {
      this.handles.push(player.addInteractable({
        position: sw.p,
        radius: 1.25,
        label: () => (level.roomLightsOn(sw.room) ? '[E] ปิดไฟ' : '[E] เปิดไฟ'),
        onUse: () => this.flip(sw.room),
      }));
    }
  }

  detach() {
    for (const h of this.handles) h.remove();
    this.handles = [];
  }

  use(id) {
    const { level, player } = this;
    const d = level.doors[id];
    if (!d) return;
    if (id === 'front' && this.onFront) { this.onFront(); return; }
    if (this.locked.has(id)) {
      sfx.play('locked');
      if (this.onKeyhole) this.onKeyhole(id); else UI.toast('ประตูล็อกอยู่');
      return;
    }
    const open = !level.doorOpen(id);
    level.setDoor(id, open);
    const p = panFor(player, d.center.x, d.center.z);
    sfx.play(open ? 'creak' : 'doorShut', { pan: p.pan, vol: p.vol });
  }

  /** The house does it by itself (scares). */
  slam(id) {
    const d = this.level.doors[id];
    if (!d) return;
    this.level.setDoor(id, false, { slam: true });
    const p = panFor(this.player, d.center.x, d.center.z);
    sfx.play('doorSlam', { pan: p.pan });
  }
  open(id, { silent = false } = {}) {
    const d = this.level.doors[id];
    if (!d) return;
    this.level.setDoor(id, true);
    if (!silent) { const p = panFor(this.player, d.center.x, d.center.z); sfx.play('creak', { pan: p.pan, vol: p.vol, len: 1.3 }); }
  }

  flip(room) {
    const on = !this.level.roomLightsOn(room);
    this.level.setRoomLights(room, on);
    sfx.play('switch');
    if (this.onSwitch) this.onSwitch(room, on);
  }
}
