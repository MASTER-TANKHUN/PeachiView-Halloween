// The guest room's mannequin (a cameo, it never hurts): at 03:00 on Night 3 it's out in the hall. It only
// moves while you aren't looking; stare at it up close and it topples over and is gone.
import * as THREE from 'three';
import { sfx } from '../audio.js';
import { Talk } from '../game/talk.js';
import { panFor } from '../systems/doors.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const _ndc = new THREE.Vector3();

function build() {
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0xe8dccc, roughness: 0.35 });
  const pink = new THREE.MeshStandardMaterial({ color: 0xff8cbf, roughness: 0.6 });
  const wig = new THREE.MeshStandardMaterial({ color: 0xff9ac8, roughness: 0.8 });
  const m = (geo, mat, p, s, r) => { const x = new THREE.Mesh(geo, mat); x.position.set(...p); if (s) x.scale.set(...s); if (r) x.rotation.set(...r); g.add(x); return x; };
  m(new THREE.CylinderGeometry(0.16, 0.2, 0.03, 20), skin, [0, 0.015, 0]);           // base
  m(new THREE.CylinderGeometry(0.015, 0.015, 0.8, 8), skin, [0, 0.42, 0]);           // pole
  m(new THREE.CapsuleGeometry(0.15, 0.36, 4, 14), skin, [0, 1.08, 0], [1, 1, 0.7]);  // torso
  m(new THREE.CapsuleGeometry(0.165, 0.3, 4, 14), pink, [0, 1.12, 0], [1.05, 1, 0.78]); // jacket
  for (const s of [-1, 1]) m(new THREE.CapsuleGeometry(0.045, 0.45, 4, 10), pink, [s * 0.2, 1.05, 0], null, [0, 0, s * 0.12]);
  m(new THREE.CylinderGeometry(0.04, 0.045, 0.1, 10), skin, [0, 1.42, 0]);           // neck
  m(new THREE.SphereGeometry(0.1, 20, 16), skin, [0, 1.56, 0], [0.9, 1.15, 0.95]);   // featureless head
  m(new THREE.SphereGeometry(0.115, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.6), wig, [0, 1.6, -0.01], [0.95, 1.1, 1]);
  for (const s of [-1, 1]) m(new THREE.SphereGeometry(0.013, 8, 6), new THREE.MeshBasicMaterial({ color: 0x2a1a1a }), [s * 0.035, 1.57, 0.09]);
  g.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return g;
}

export class Mannequin {
  constructor(scene) {
    this.group = build();
    this.group.visible = false;
    scene.add(this.group);
    this.state = 'off';
    this.onTap = () => {};
  }

  reset() { this.state = 'off'; this.group.visible = false; this.group.rotation.set(0, 0, 0); }

  /** Stand at pos, facing look. */
  appear(pos) {
    this.group.position.set(pos.x, 0, pos.z);
    this.group.rotation.set(0, 0, 0);
    this.group.visible = true;
    this.state = 'stalk';
    this.seenT = 0; this.fallT = 0; this.moveT = 0;
  }

  update(dt, ctx) {
    if (this.state === 'off') return;
    const g = this.group;
    if (this.state === 'fall') {
      this.fallT += dt;
      g.rotation.x = Math.min(Math.PI / 2, this.fallT * this.fallT * 6);
      if (this.fallT > 1.4) this.reset();
      return;
    }
    const { player, camera } = ctx;
    const pos = g.position, pp = player.position;
    const dx = pp.x - pos.x, dz = pp.z - pos.z, d = Math.hypot(dx, dz);
    _ndc.set(pos.x, 1.2, pos.z).project(camera);
    const seen = _ndc.z < 1 && Math.abs(_ndc.x) < 0.95 && Math.abs(_ndc.y) < 1;
    if (seen) {
      this.seenT += dt;
      if (d < 2.4 && this.seenT > 1.2) { // stared down: it topples
        this.state = 'fall'; this.fallT = 0;
        const p = panFor(player, pos.x, pos.z);
        setTimeout(() => sfx.play('doorShut', { pan: p.pan, vol: 0.6 }), 350);
      }
      return;
    }
    this.seenT = 0;
    if (d > 1.3) {
      const s = Math.min(d - 1.3, 2.6 * dt);
      pos.x += (dx / d) * s; pos.z += (dz / d) * s;
      g.rotation.y = Math.atan2(dx, dz);
      this.moveT -= dt;
      if (this.moveT <= 0) { this.moveT = 0.9; const p = panFor(player, pos.x, pos.z); sfx.play('creak', { pan: p.pan, vol: p.vol * 0.5, len: 0.2 }); }
    } else if (this.state === 'stalk') {
      this.state = 'fall'; this.fallT = 0;
      Talk.say('her', 'ไม่ได้จะทำอะไรหรอก… แค่อยากทัก', { ms: 2600 });
      this.onTap();
    }
  }
}
