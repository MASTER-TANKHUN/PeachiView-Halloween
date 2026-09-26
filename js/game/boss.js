// PeachiBot, the boss of Night 3 (05:00, once the choker is on the desk): a floating CRT head with an
// emoticon face, cable arms, a ban hammer and a © stamp. Three phases:
//  1 · spam flood: 30 s of bot spam, ban at least 12 (Q)
//  2 · © claim: the three choker pieces fly to the kitchen, the living room and the bathroom behind a
//      "muted for copyright" ring. Stand close and scream to appeal; each piece has 40 s
//  3 · ban hammer: a red wind-up, then a pink window. Scream in it to knock the hammer back. 3 = win
// Every miss is a copyright strike; the third one deletes the channel. The night owns the clock and
// the ghosts; this only needs { scene, level, player, camera, night } and reports via callbacks.
import * as THREE from 'three';
import { UI } from '../ui.js';
import { sfx } from '../audio.js';
import { buildPendant, buildStrap, buildLock } from '../world/choker.js';
import { art } from '../world/tex.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
export const BOSS_HOME = V(-5.4, 1.95, -4.6);
const SPAM_TIME = 30, SPAM_NEED = 12;
const CLAIM_TIME = 40, APPEAL_DIST = 3.2;
const WINDUP = 2.8, WINDOW = 1.8, REST = 1.6, DEFLECTS = 3, SCREAM_DIST = 9;
const SPOTS = {
  pendant: { room: 'kitchen', th: 'ครัว', pos: V(-6.4, 1.3, 3.9) },
  strap: { room: 'living', th: 'ห้องนั่งเล่น', pos: V(6.6, 1.3, 4.0) },
  lock: { room: 'bathroom', th: 'ห้องน้ำ', pos: V(7.2, 1.3, -4.0) },
};
const SPAM = [
  'ช่องนี้เป็นของ PeachiBot ค่ะ :)', 'ขออภัย ห้ามพูดคำว่า "หยุด" ค่ะ', 'ไลฟ์ 24/7 ดีต่อสุขภาพค่ะ',
  'กด Q ไม่ช่วยอะไรหรอกค่ะ :)', '© © © © © ©', 'พีชชี่เหนื่อยแล้ว ให้บอทไลฟ์แทนนะคะ',
  'สมัครสมาชิกเพื่อปลดล็อกการหายใจค่ะ', 'ระบบตรวจพบความหวัง กำลังลบ…', 'ขอบคุณที่ใช้บริการ PeachiBot™',
];
const FACES = { smile: '^_^', type: '-_-', claim: '©_©', angry: '>_<', dizzy: '@_@', dead: 'x_x', laugh: '^o^' };

function drawFace(g, w, h, face, hue) {
  g.fillStyle = '#081018'; g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 4) { g.fillStyle = 'rgba(120,255,200,0.05)'; g.fillRect(0, y, w, 2); } // scanlines
  g.fillStyle = hue; g.shadowColor = hue; g.shadowBlur = 18;
  g.font = 'bold 84px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(FACES[face] || face, w / 2, h / 2 - 8);
  g.shadowBlur = 0; g.font = 'bold 20px monospace'; g.fillText('PeachiBot v2.49', w / 2, h - 18);
}

function ring(color) {
  const m = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.025, 8, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 }));
  return m;
}

function copySprite(size = 0.35) {
  const tex = art(128, 128, (g) => {
    g.fillStyle = 'rgba(255,40,70,0.95)'; g.beginPath(); g.arc(64, 64, 58, 0, TAU); g.fill();
    g.fillStyle = '#fff'; g.font = 'bold 92px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('©', 64, 70);
  });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  s.scale.setScalar(size);
  return s;
}

function buildBot() {
  const g = new THREE.Group();
  const plastic = new THREE.MeshStandardMaterial({ color: 0xd8d0c0, roughness: 0.6 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x222228, roughness: 0.5 });
  const head = new THREE.Group(); g.add(head);
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.58, 0.6), plastic); head.add(box);
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.42, 0.3), plastic); back.position.z = -0.4; head.add(back);
  const bezel = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.48, 0.02), dark); bezel.position.z = 0.3; head.add(bezel);
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 200;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.42), new THREE.MeshBasicMaterial({ map: tex }));
  screen.position.z = 0.312; head.add(screen);
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.3, 6), dark); ant.position.set(0.18, 0.42, -0.1); ant.rotation.z = -0.4; head.add(ant);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff3355 })); tip.position.set(0.24, 0.56, -0.1); head.add(tip);
  const glow = new THREE.PointLight(0x66ffcc, 0, 4, 2); glow.position.z = 0.6; head.add(glow);
  // cable arms: beads along a curve, re-laid every frame
  const cableMat = new THREE.MeshStandardMaterial({ color: 0x15151a, roughness: 0.4 });
  const bead = new THREE.SphereGeometry(0.028, 8, 6);
  const arms = [-1, 1].map((side) => {
    const beads = [];
    for (let i = 0; i < 14; i++) { const b = new THREE.Mesh(bead, cableMat); g.add(b); beads.push(b); }
    const hand = new THREE.Group(); g.add(hand);
    return { side, beads, hand };
  });
  // right hand: the ban hammer; left hand: the © stamp
  const hammer = new THREE.Group();
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.55, 8), dark); handle.position.y = -0.2; hammer.add(handle);
  const hamMat = new THREE.MeshStandardMaterial({ color: 0x551018, emissive: 0xff2040, emissiveIntensity: 0.4, roughness: 0.4 });
  const hamHead = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.18, 0.18), hamMat); hamHead.position.y = 0.08; hammer.add(hamHead);
  const banTex = art(128, 64, (x, w, h) => { x.fillStyle = '#fff'; x.font = 'bold 40px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('BAN', w / 2, h / 2 + 2); });
  const label = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.13), new THREE.MeshBasicMaterial({ map: banTex, transparent: true }));
  label.position.set(0, 0.08, 0.092); hammer.add(label);
  arms[1].hand.add(hammer);
  const stamp = new THREE.Group();
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), dark); knob.position.y = 0.1; stamp.add(knob);
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.05, 20), new THREE.MeshStandardMaterial({ color: 0xff2446, roughness: 0.5 })); stamp.add(pad);
  arms[0].hand.add(stamp);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  return { group: g, head, screen: { cv, tex }, glow, arms, hammer, hamMat, stamp, tip };
}

export class Boss {
  constructor({ scene, level, player, camera }) {
    Object.assign(this, { scene, level, player, camera });
    this.active = false;
    this.bot = null;
    this.onStrike = () => {};
    this.onWin = () => {};
    this.onDelete = () => {};
    this._hud();
  }

  _build() {
    if (this.bot) return;
    this.bot = buildBot();
    this.bot.group.visible = false;
    this.scene.add(this.bot.group);
    this.pieces = {};
    const makers = { pendant: buildPendant, strap: buildStrap, lock: buildLock };
    for (const k in SPOTS) {
      const g = new THREE.Group();
      const part = makers[k](); part.scale.setScalar(k === 'pendant' ? 3 : 2.2); g.add(part);
      const r1 = ring(0xff2446), r2 = ring(0xff2446); r2.rotation.x = Math.PI / 2; g.add(r1, r2);
      const c = copySprite(); c.position.y = 0.6; g.add(c);
      g.visible = false; this.scene.add(g);
      this.pieces[k] = { group: g, part, rings: [r1, r2], copy: c, state: 'desk', from: V(0, 0, 0), t: 0 };
    }
  }

  _hud() {
    const d = document.createElement('div');
    d.className = 'boss-hud hidden';
    d.innerHTML = '<div class="bh-name">PeachiBot <small>© ผีเคลม</small></div><div class="bh-bar"><i></i></div>'
      + '<div class="bh-phase"></div><div class="bh-strikes" title="Copyright strike"><span>©</span><span>©</span><span>©</span></div>';
    UI.mount(d);
    this.hud = d;
    this.hudBar = d.querySelector('.bh-bar i');
    this.hudPhase = d.querySelector('.bh-phase');
    this.hudStrikes = [...d.querySelectorAll('.bh-strikes span')];
    const m = document.createElement('div');
    m.className = 'boss-muted hidden';
    m.innerHTML = '🔇 ถูกปิดเสียงเนื่องจากลิขสิทธิ์<small>เข้าใกล้แล้วตะโกนเพื่อยื่นอุทธรณ์!</small>';
    UI.mount(m);
    this.muted = m;
  }

  /** desk: where the pieces go back to. strikes: carry over (0 on a checkpoint retry). */
  start({ desk, night }) {
    this._build();
    this.night = night;
    this.desk = desk.clone();
    this.active = true;
    this.strikes = 0;
    this.hp = 1;
    this.face = '';
    this.t = 0;
    this.home = BOSS_HOME.clone();
    this.pos = this.home.clone();
    this.bot.group.position.copy(this.pos);
    this.bot.group.visible = true;
    this.bot.glow.intensity = 1.2;
    this.hud.classList.remove('hidden');
    this._strikesUi();
    this._phase1();
  }

  /** Stop fighting, keep the model where it is (lose card / win scene). */
  halt() {
    this.active = false;
    this.hud.classList.add('hidden');
    this.muted.classList.add('hidden');
    try { sfx.setDuck(0); } catch (e) { /* no audio */ }
  }

  stop() {
    this.halt();
    this.phase = 0;
    if (!this.bot) return;
    this.bot.group.visible = false;
    this.bot.glow.intensity = 0;
    for (const k in this.pieces) this.pieces[k].group.visible = false;
    this._clearBits();
  }

  /** The win: the bot bursts into pink pixels (fx() animates them). */
  shatter() {
    this.halt();
    if (!this.bot) return;
    this._clearBits();
    const n = 70, at = this.bot.group.position;
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.06, 0.06, 0.06), new THREE.MeshBasicMaterial({ color: 0xff8ad0 }), n);
    mesh.frustumCulled = false;
    const p = [], v = [];
    for (let i = 0; i < n; i++) {
      p.push(V(at.x + rand(-0.35, 0.35), at.y + rand(-0.3, 0.3), at.z + rand(-0.3, 0.3)));
      v.push(V(rand(-2, 2), rand(0.5, 3), rand(-2, 2)));
    }
    this.bits = { mesh, p, v, t: 0, m: new THREE.Matrix4() };
    this.scene.add(mesh);
    this.bot.group.visible = false;
    this.bot.glow.intensity = 0;
  }

  fx(dt) {
    const b = this.bits;
    if (!b) return;
    b.t += dt;
    const s = Math.max(0.01, 1 - b.t / 3);
    for (let i = 0; i < b.p.length; i++) {
      b.v[i].y -= 5 * dt;
      b.p[i].addScaledVector(b.v[i], dt);
      if (b.p[i].y < 0.03) { b.p[i].y = 0.03; b.v[i].multiplyScalar(0.4); b.v[i].y *= -1; }
      b.m.makeScale(s, s, s).setPosition(b.p[i]);
      b.mesh.setMatrixAt(i, b.m);
    }
    b.mesh.instanceMatrix.needsUpdate = true;
    if (b.t > 3) this._clearBits();
  }

  _clearBits() {
    if (!this.bits) return;
    this.scene.remove(this.bits.mesh);
    this.bits.mesh.geometry.dispose(); this.bits.mesh.material.dispose();
    this.bits = null;
  }

  // ---------------------------------------------------------------- phases
  _phase1() {
    this.phase = 1; this.pt = 0; this.bans0 = this.night.stats.bans; this.spamT = 0.5;
    this._setFace('type');
    this.night.bot('เริ่มปฏิบัติการ "ไลฟ์ถาวร" ค่ะ :) ขอให้แชทสนุกนะคะ');
    UI.toast(`บอทสแปมแชท! กด Q แบนให้ได้ ${SPAM_NEED} ข้อความใน ${SPAM_TIME} วิ`);
    sfx.play('glitch', { n: 10 });
  }

  _phase2() {
    this.phase = 2; this.pt = 0; this.claimT = 0;
    this._setFace('claim');
    this.night.bot('ตรวจพบเนื้อหาที่มีลิขสิทธิ์: โชคเกอร์หัวใจ ×3 · ดำเนินการเคลมค่ะ ©');
    sfx.play('sting');
    UI.flash('#ff2446');
    this.night.hideDeskPieces();
    for (const k in this.pieces) {
      const p = this.pieces[k];
      p.state = 'fly'; p.t = 0; p.from.copy(this.desk);
      p.group.position.copy(this.desk); p.group.visible = true;
    }
    setTimeout(() => this.active && this.phase === 2 && UI.toast('ชิ้นส่วนโดนเคลม! ไปครัว · ห้องนั่งเล่น · ห้องน้ำ แล้วตะโกนใกล้ๆ เพื่ออุทธรณ์'), 1500);
  }

  _phase3() {
    this.phase = 3; this.pt = 0; this.swing = 'rest'; this.st = 1.5; this.deflects = 0; this.screamedAt = -9;
    this._setFace('angry');
    this.night.bot('อุทธรณ์ถูกปฏิเสธค่ะ :) เตรียมแบนถาวร');
    UI.toast('กลับไปห้องสตรีม! ค้อนเป็นสีชมพูเมื่อไหร่ → ตะโกน! (Space รัวๆ ตั้งแต่ค้อนแดง)');
    sfx.play('cackle');
  }

  // ---------------------------------------------------------------- input
  onScream() {
    if (!this.active) return;
    const pp = this.player.position;
    if (this.phase === 2) {
      for (const k in this.pieces) {
        const p = this.pieces[k];
        if (p.state !== 'claimed') continue;
        if (Math.hypot(p.group.position.x - pp.x, p.group.position.z - pp.z) > APPEAL_DIST) continue;
        p.state = 'back'; p.t = 0; p.from.copy(p.group.position);
        sfx.play('found'); UI.flash('#ffc0dc');
        this.night.chat('ลูกพีชน้อย_249', `อุทธรณ์สำเร็จ! ${SPOTS[k].th} ✓`);
        this.claimT = 0;
        this.hp = Math.max(0.34, this.hp - 0.11);
      }
    } else if (this.phase === 3) {
      const d = this.bot.group.position.distanceTo(pp);
      if (this.swing === 'window' && d < SCREAM_DIST) this._deflect();
      else if (this.swing === 'windup') { this.screamedAt = this.t; this._setFace('laugh'); this.night.bot('เร็วไปค่ะ :)'); }
    }
  }

  _deflect() {
    this.deflects++;
    this.swing = 'bounce'; this.st = 1.2;
    this.hp = Math.max(0, 0.34 * (1 - this.deflects / DEFLECTS));
    this._setFace('dizzy');
    sfx.play('stun'); sfx.play('glitch', { n: 8 });
    UI.flash('#ff9ad0'); UI.shake(300);
    this.night.chat('mod_ตัวจริง', pick(['สะท้อนกลับ!!!', 'เสียงมอดดังกว่าค้อน 555', 'บอทมึนแล้ว!']));
    if (this.deflects >= DEFLECTS) {
      this.phase = 4; this.st = 0;
      this._setFace('dead');
      setTimeout(() => this.active && this.onWin(), 900);
    }
  }

  _strike(why) {
    this.strikes++;
    this._strikesUi();
    sfx.play('caught'); UI.flash('#ff2446'); UI.shake(500);
    UI.toast(`Copyright strike ${this.strikes}/3 · ${why}`);
    this.night.bot(`ช่องของคุณได้รับ Copyright strike ครั้งที่ ${this.strikes} ค่ะ :)`);
    this.onStrike(this.strikes);
    if (this.strikes >= 3) { this.active = false; this.onDelete(); }
  }

  _strikesUi() { this.hudStrikes.forEach((s, i) => s.classList.toggle('on', i < this.strikes)); }

  _setFace(face) {
    if (!this.bot || this.face === face) return;
    this.face = face;
    const { cv, tex } = this.bot.screen;
    const hue = face === 'angry' || face === 'claim' ? '#ff4d6d' : face === 'dizzy' ? '#ffb3e0' : '#7dffc8';
    drawFace(cv.getContext('2d'), cv.width, cv.height, face, hue);
    tex.needsUpdate = true;
  }

  // ---------------------------------------------------------------- update
  update(dt, t) {
    if (!this.active || !this.bot) return;
    this.t += dt; this.pt += dt;
    const pp = this.player.position;
    const B = this.bot;
    if (this.phase === 1) {
      this.spamT -= dt;
      if (this.spamT <= 0) { this.spamT = rand(0.7, 1.2); this.night.chat('PeachiBot', pick(SPAM), 'spam'); }
      const bans = this.night.stats.bans - this.bans0;
      this.hp = 1 - 0.33 * Math.min(1, bans / SPAM_NEED);
      this.hudPhase.textContent = `เฟส 1 · สแปมท่วมแชท — แบน ${Math.min(bans, SPAM_NEED)}/${SPAM_NEED} · ${Math.ceil(SPAM_TIME - this.pt)} วิ`;
      if (bans >= SPAM_NEED) this._phase2();
      else if (this.pt >= SPAM_TIME) { this._strike('แบนสแปมไม่ทัน'); if (this.active) this._phase2(); }
    } else if (this.phase === 2) {
      this._updatePieces(dt, t, pp);
    } else if (this.phase === 3 || this.phase === 4) {
      this._updateHammer(dt, t, pp);
    }
    // float, face the player
    this.pos.lerp(this.home, 1 - Math.exp(-dt * 2));
    B.group.position.set(this.pos.x, this.pos.y + Math.sin(t * 1.7) * 0.08, this.pos.z);
    const yaw = Math.atan2(pp.x - this.pos.x, pp.z - this.pos.z);
    B.head.rotation.y = yaw;
    B.head.rotation.z = this.face === 'dizzy' ? Math.sin(t * 9) * 0.25 : Math.sin(t * 1.3) * 0.05;
    B.tip.material.color.setHex(Math.sin(t * 6) > 0 ? 0xff3355 : 0x331018);
    this._layArms(t);
    this.hudBar.style.width = `${Math.round(this.hp * 100)}%`;
  }

  _updatePieces(dt, t, pp) {
    let near = 0, left = 0;
    for (const k in this.pieces) {
      const p = this.pieces[k], s = SPOTS[k];
      p.rings[0].rotation.z += dt * 2; p.rings[1].rotation.y += dt * 1.4;
      if (p.state === 'fly' || p.state === 'back') {
        p.t = Math.min(1, p.t + dt / (p.state === 'fly' ? 2.2 : 1.6));
        const to = p.state === 'fly' ? s.pos : this.desk;
        const e = p.t * p.t * (3 - 2 * p.t);
        p.group.position.lerpVectors(p.from, to, e);
        p.group.position.y += Math.sin(e * Math.PI) * 1.2;
        p.rings.forEach((r) => { r.visible = p.state === 'fly'; });
        p.copy.visible = p.state === 'fly';
        if (p.t >= 1) {
          if (p.state === 'fly') p.state = 'claimed';
          else { p.state = 'desk'; p.group.visible = false; this.night.showDeskPiece(k); sfx.play('place'); }
        }
      }
      if (p.state === 'claimed') {
        p.group.position.y = s.pos.y + Math.sin(t * 2 + s.pos.x) * 0.08;
        p.part.rotation.y += dt;
        const d = Math.hypot(p.group.position.x - pp.x, p.group.position.z - pp.z);
        near = Math.max(near, Math.max(0, 1 - d / 4.5));
      }
      if (p.state !== 'desk') left++;
    }
    this.claimT += dt;
    try { sfx.setDuck(near * 0.6); } catch (e) { /* no audio */ }
    this.muted.classList.toggle('hidden', near <= 0.2);
    this.hudPhase.textContent = `เฟส 2 · ผีเคลม © — เหลือ ${left} ชิ้น · ${Math.max(0, Math.ceil(CLAIM_TIME - this.claimT))} วิ`;
    if (!left) { this.muted.classList.add('hidden'); try { sfx.setDuck(0); } catch (e) { /* */ } this._phase3(); return; }
    if (this.claimT >= CLAIM_TIME) { this.claimT = 0; this._strike('อุทธรณ์ไม่ทัน'); }
  }

  _updateHammer(dt, t, pp) {
    const B = this.bot;
    this.st -= dt;
    const inRoom = this.level.roomAt(pp) === 'stream';
    if (this.phase === 4) {
      B.group.position.y -= dt * 0.4;
      B.head.rotation.x = Math.min(0.6, B.head.rotation.x + dt);
      this.hudPhase.textContent = 'PeachiBot ถูกแบน!';
      return;
    }
    if (this.swing === 'rest' && this.st <= 0) {
      this.swing = 'windup'; this.st = WINDUP;
      this._setFace('angry'); sfx.play('bash', { vol: 0.6 });
    } else if (this.swing === 'windup' && this.st <= 0) {
      this.swing = 'window'; this.st = WINDOW;
      sfx.play('sparkle'); UI.flash('#ff9ad0');
    } else if (this.swing === 'window' && this.st <= 0) {
      this.swing = 'slam'; this.st = 0.5;
      sfx.play('doorSlam'); sfx.play('ban');
      this._strike(inRoom ? 'ค้อนแบนฟาดโดน' : 'อยู่ไกลเกินจะตะโกนสะท้อน');
    } else if ((this.swing === 'slam' || this.swing === 'bounce') && this.st <= 0) {
      this.swing = 'rest'; this.st = REST;
      if (this.face !== 'dead') this._setFace('smile');
    }
    const pink = this.swing === 'window';
    B.hamMat.emissive.setHex(pink ? 0xff5fbf : 0xff2040);
    B.hamMat.emissiveIntensity = this.swing === 'windup' ? 0.5 + (1 - this.st / WINDUP) * 1.5 : pink ? 2.2 + Math.sin(t * 20) * 0.5 : 0.4;
    const labels = { rest: 'เตรียมตัว…', windup: 'ค้อนแดง: รัว Space / เตรียมตะโกน', window: '💗 ตะโกนเลย!!', slam: 'โดนแบน!', bounce: 'สะท้อนกลับ!' };
    this.hudPhase.textContent = `เฟส 3 · ค้อนแบน — สะท้อน ${this.deflects}/${DEFLECTS} · ${labels[this.swing]}${inRoom ? '' : ' (กลับห้องสตรีม!)'}`;
  }

  _layArms(t) {
    const B = this.bot;
    const raise = this.phase >= 3 ? (this.swing === 'windup' ? 1 - Math.max(0, this.st) / WINDUP : this.swing === 'window' ? 1 : this.swing === 'slam' ? -0.6 : this.swing === 'bounce' ? 1.3 : 0) : 0;
    const yaw = B.head.rotation.y, c = Math.cos(yaw), sn = Math.sin(yaw);
    const L = (x, y, z) => V(x * c + z * sn, y, -x * sn + z * c); // arms live in the group, turned with the head
    for (const a of B.arms) {
      const s = a.side;
      let hy = -0.25 + Math.sin(t * 2 + s) * 0.08, hx = s * 0.75;
      if (s > 0) { hy += raise * 0.75; hx -= raise * 0.2; }
      if (s < 0 && this.phase === 2) hy += Math.abs(Math.sin(t * 5)) * 0.2; // stamping
      const hand = L(hx, hy, 0.25), from = L(s * 0.36, -0.1, 0);
      const mid = from.clone().lerp(hand, 0.5); mid.y -= 0.35;
      const n = a.beads.length;
      for (let i = 0; i < n; i++) {
        const u = (i + 1) / (n + 1), v = 1 - u;
        a.beads[i].position.set(v * v * from.x + 2 * u * v * mid.x + u * u * hand.x, v * v * from.y + 2 * u * v * mid.y + u * u * hand.y, v * v * from.z + 2 * u * v * mid.z + u * u * hand.z);
      }
      a.hand.position.copy(hand);
      a.hand.rotation.set(0, yaw, s > 0 ? -0.3 - raise * 0.9 : 0);
    }
  }
}

function rand(a, b) { return a + Math.random() * (b - a); }
function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
