// ลูกพีชน้อย (easy): the first time Peachi catches you in a night you don't lose. You wake up locked in
// the bathroom ("คุกห้องน้ำ", after Roblox Jail Break) and the key is somewhere in the water jar (โอ่ง):
// rummage three times (E) within 30 s. Out of time = the normal lose card.
import * as THREE from 'three';
import { UI } from '../ui.js';
import { sfx } from '../audio.js';

const JAR = new THREE.Vector3(5.25, 0, -6.35);
const CELL = { x: 6.9, z: -3.6 };
const TIME = 30;
const FINDS = ['ล้วงโอ่ง… เจอขันน้ำ', 'ล้วงลึกอีก… เจอเป็ดยาง (ของใครเนี่ย)', 'เจอแล้ว! กุญแจห้องน้ำ'];

function buildJar() {
  const g = new THREE.Group();
  const pts = [[0, 0], [0.2, 0], [0.3, 0.12], [0.33, 0.3], [0.3, 0.5], [0.22, 0.6], [0.24, 0.64], [0.21, 0.64]].map(([x, y]) => new THREE.Vector2(x, y));
  const clay = new THREE.Mesh(new THREE.LatheGeometry(pts, 28), new THREE.MeshStandardMaterial({ color: 0x8a4a26, roughness: 0.8, side: THREE.DoubleSide }));
  const water = new THREE.Mesh(new THREE.CircleGeometry(0.2, 24), new THREE.MeshStandardMaterial({ color: 0x3a6a78, roughness: 0.1, metalness: 0.2 }));
  water.rotation.x = -Math.PI / 2; water.position.y = 0.58;
  const dipper = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.05, 14, 1, true), new THREE.MeshStandardMaterial({ color: 0xff8fb1, side: THREE.DoubleSide }));
  dipper.position.set(0.06, 0.6, 0.02);
  g.add(clay, water, dipper);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.position.copy(JAR);
  return g;
}

export class Jail {
  constructor({ scene, level, player, doors }) {
    Object.assign(this, { scene, level, player, doors });
    this.active = false;
    this.jar = buildJar();
    this.jar.visible = false;
    scene.add(this.jar);
    this.handle = null;
  }

  /** Lock the player in. onFree() when the key is found, onFail() when time runs out. */
  start({ onFree, onFail }) {
    const { player, level, doors } = this;
    this.active = true; this.left = TIME; this.found = 0; this.shown = -1;
    this.onFree = onFree; this.onFail = onFail;
    this.jar.visible = true;
    player.position.set(CELL.x, player.position.y, CELL.z);
    player.yaw = Math.atan2(-(JAR.x - CELL.x), -(JAR.z - CELL.z)); player.pitch = -0.2;
    player.enabled = true;
    level.setDoor('bathroom', false, { instant: true });
    doors.locked.add('bathroom'); doors.jailed = 'bathroom';
    level.setRoomLights('bathroom', true);
    UI.fade(1, 10); UI.fade(0, 900);
    UI.toast('ติดคุกห้องน้ำ! ประตูล็อก… กุญแจอยู่ในโอ่ง ล้วงหาภายใน 30 วิ');
    sfx.play('doorSlam'); sfx.play('locked');
    this.handle = player.addInteractable({
      position: new THREE.Vector3(JAR.x, 0.7, JAR.z), radius: 1.5,
      label: () => `[E] ล้วงโอ่ง (${this.found}/3)`,
      onUse: () => this._rummage(),
      enabled: () => this.active,
    });
  }

  _rummage() {
    UI.toast(FINDS[this.found]);
    this.found++;
    sfx.play(this.found < 3 ? 'drip' : 'found');
    if (this.found < 3) return;
    this.stop();
    this.level.setDoor('bathroom', true);
    sfx.play('creak');
    UI.setObjective(null);
    UI.toast('ออกจากคุกได้แล้ว! (ลูกพีชน้อยได้โอกาสแก้ตัวแค่ครั้งเดียวต่อคืนนะ)');
    if (this.onFree) this.onFree();
  }

  update(dt) {
    if (!this.active) return;
    this.left -= dt;
    const s = Math.max(0, Math.ceil(this.left));
    if (s !== this.shown) { this.shown = s; UI.setObjective(`คุกห้องน้ำ: ล้วงโอ่งหากุญแจ ${this.found}/3 · เหลือ ${s} วิ`); if (s <= 5 && s > 0) sfx.play('tick'); }
    if (this.left <= 0) { const f = this.onFail; this.stop(); if (f) f(); }
  }

  stop() {
    this.active = false;
    if (this.handle) { this.handle.remove(); this.handle = null; }
    this.doors.locked.delete('bathroom'); this.doors.jailed = null;
    this.jar.visible = false;
  }
}
