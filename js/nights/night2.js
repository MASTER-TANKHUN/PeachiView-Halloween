// Night 2 — 31 Oct before dawn, the live has run 247 hours. Peachi can hear again, but she's still grey.
// A guest arrives: Krasue (กระสือ_Official), drawn to every light in the house. The house starts changing
// behind your back: report the anomalies on the phone; after five, the golden peach appears on the party
// table. Carry it back to the stream desk (it glows — hold R to hide it in your shirt, but you walk slower).
// Script: Krasue flies in at 00:00, the first anomaly (the bear) at 00:30, the Wi-Fi joke at 01:00,
// blackout at 02:00 (the breaker in the kitchen), hide-and-seek at 02:30, the bathroom mirror at 03:00,
// a longer blackout at 04:00, the last hour at 05:00. Ending: her colors come back; Krasue wants her fee;
// PeachiBot glitches — "see you on the last night".
import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { NightBase, pick, rand, randInt } from './base.js';
import { UI } from '../ui.js';
import { sfx } from '../audio.js';
import { Talk } from '../game/talk.js';
import { BOT, HER, KRASUE, STORIES, LOSE } from '../data/story.js';
import { ROOM_NAMES, KINDS } from '../systems/anomalies.js';
import { BREAKER } from '../systems/power.js';

const HYPE = ['ลูกพีชน้อย_249', 'peachlover', 'นอนไม่หลับ', 'ลูกพีชซ่า', 'mod_ตัวจริง'];
const NEED = 5;                                   // correct reports for the golden peach
const TABLE = new THREE.Vector3(-4.6, 1.2, 3.8);  // above the pumpkin on the party table
const ROUTER = new THREE.Vector3(9.6, 0.09, 4.62); // inside the TV cabinet
const MIRROR = new THREE.Vector3(9.8355, 1.62, -3.3);
const WIFI_PW = 'peachi249';
const KRASUE_USER = 'กระสือ_Official';

function goldenPeach() {
  const g = new THREE.Group();
  const gold = new THREE.MeshStandardMaterial({ color: 0xffc84a, metalness: 0.75, roughness: 0.22, emissive: 0xff9a20, emissiveIntensity: 0.55 });
  for (const s of [-1, 1]) { const h = new THREE.Mesh(new THREE.SphereGeometry(0.075, 24, 18), gold); h.position.x = s * 0.018; h.scale.set(1, 1.05, 0.98); g.add(h); }
  const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 8), new THREE.MeshStandardMaterial({ color: 0x9ad060, metalness: 0.4, roughness: 0.4, emissive: 0x3a6a10, emissiveIntensity: 0.5 }));
  leaf.scale.set(1.2, 0.3, 0.55); leaf.position.set(0.04, 0.085, 0); leaf.rotation.z = -0.5;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.008, 0.03, 8), new THREE.MeshStandardMaterial({ color: 0x6a4a20 }));
  stem.position.y = 0.085;
  g.add(leaf, stem);
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d'), grd = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,220,120,0.9)'); grd.addColorStop(0.4, 'rgba(255,190,80,0.35)'); grd.addColorStop(1, 'rgba(255,180,60,0)');
  x.fillStyle = grd; x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.setScalar(0.55);
  g.add(halo);
  g.userData = { gold, halo };
  return g;
}

function disguise() { // Peachi as a pumpkin — with pink cat ears and a bow, if you look closely
  const g = new THREE.Group();
  const orange = new THREE.MeshStandardMaterial({ color: 0xff8a2a, roughness: 0.55 });
  for (let i = 0; i < 6; i++) { const r = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), orange); r.scale.set(0.55, 0.85, 1); r.rotation.y = (i / 6) * Math.PI; r.position.y = 0.1; g.add(r); }
  const pink = new THREE.MeshStandardMaterial({ color: 0xff8cbf, roughness: 0.5 });
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.06, 4), pink); e.position.set(s * 0.055, 0.2, 0); e.rotation.z = s * -0.4; g.add(e); }
  const bow = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), pink); bow.scale.set(2, 0.8, 0.8); bow.position.set(0, 0.2, 0.06); g.add(bow);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.05, 8), new THREE.MeshStandardMaterial({ color: 0x4a6a20 })); stem.position.y = 0.2; g.add(stem);
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'); x.fillStyle = '#fff';
  for (let i = 0; i < 9; i++) { const px = 10 + Math.random() * 44, py = 10 + Math.random() * 44, r = 1 + Math.random() * 2.5; x.beginPath(); x.moveTo(px, py - r * 2); x.lineTo(px + r * 0.5, py); x.lineTo(px, py + r * 2); x.lineTo(px - r * 0.5, py); x.fill(); x.beginPath(); x.moveTo(px - r * 2, py); x.lineTo(px, py + r * 0.5); x.lineTo(px + r * 2, py); x.lineTo(px, py - r * 0.5); x.fill(); }
  const t = new THREE.CanvasTexture(c);
  const sparkle = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, color: 0xff7ac0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  sparkle.scale.setScalar(0.45); sparkle.position.y = 0.14;
  g.add(sparkle);
  g.userData.sparkle = sparkle;
  return g;
}

function router() {
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xf2f2f4, roughness: 0.4 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.035, 0.14), white); body.position.y = 0.018; g.add(body);
  for (const s of [-1, 1]) { const a = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.006, 0.13, 6), new THREE.MeshStandardMaterial({ color: 0x1a1a1e })); a.position.set(s * 0.09, 0.09, -0.06); a.rotation.z = s * 0.2; g.add(a); }
  const led = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 1.8, 0.5), toneMapped: false });
  for (let i = 0; i < 4; i++) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.004, 0.004), led); l.position.set(-0.06 + i * 0.03, 0.03, 0.071); g.add(l); }
  const sticker = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.035), new THREE.MeshStandardMaterial({ color: 0xfaf0d8 })); sticker.position.set(0.05, 0.0005, 0.02); sticker.rotation.x = Math.PI / 2; g.add(sticker);
  return g;
}

export class Night2 extends NightBase {
  get number() { return 2; }
  get secondsPerHour() { return 60; }
  get uptimeBase() { return 247; }

  constructor(ctx) {
    super(ctx);
    const { scene } = this;
    this.peach = goldenPeach();
    this.holder = new THREE.Group(); this.holder.add(this.peach); this.holder.visible = false;
    scene.add(this.holder);
    this.peachLight = new THREE.PointLight(0xffc060, 0, 4.5, 2); // always in the scene (no recompiles)
    scene.add(this.peachLight);
    this.seekObj = disguise(); this.seekObj.visible = false; scene.add(this.seekObj);
    this.router = router(); this.router.position.copy(ROUTER); this.router.rotation.y = -Math.PI / 2; scene.add(this.router);
    this.mirror = null;
    this._rDown = false;
    window.addEventListener('keydown', (e) => { if (e.code === 'KeyR') this._rDown = true; });
    window.addEventListener('keyup', (e) => { if (e.code === 'KeyR') this._rDown = false; });
    window.addEventListener('blur', () => { this._rDown = false; });
  }

  introCard() {
    return {
      title: 'คืนที่ 2', clock: '00:00', date: '31 ตุลาคม ก่อนรุ่ง  ·  ไลฟ์มาแล้ว 247 ชั่วโมง',
      text: 'บ้านเริ่มเปลี่ยนไปทีละจุด รายงานให้ครบ 5 จุด ลูกพีชทองจะโผล่ แล้วเอาไปคืนที่โต๊ะสตรีมก่อนหกโมงเช้า',
      story: pick(STORIES),
    };
  }

  loseCard(reason) {
    if (reason === 'timeout') return { title: 'ตีหกแล้ว…', text: 'ลูกพีชทองยังไม่กลับโต๊ะ สีของพีชชี่เลยไม่กลับมา กระสือเก็บลูกพีชไปเป็นค่าตัวแทน' };
    return super.loseCard(reason);
  }

  // ---------------------------------------------------------------- start
  onStart() {
    const { level, peachi, doors, krasue, anomalies, power } = this;
    this.peachState = 'none'; // none | table | carried | placed
    this.peachHidden = false;
    this.wifiKnown = false; this.wifiUsed = false; this.wifiAsked = false;
    this.lures = [];
    this.spawnT = 999;
    this.reqTimer = 999;
    this.seek = null; this.seekDone = false;
    this.mirrorEv = null;
    this.stats.licks = 0; this.stats.reports = 0;
    this.player.speedMul = 1;

    // Peachi: she can hear (headphones on, clear voice), still grey
    Talk.brokenPeachi = false;
    peachi.model.setHeadphones(true);
    peachi.model.setDesat(0.72);
    peachi.moodScale = 1;

    doors.locked.clear();
    doors.locked.add('bedroom');
    level.setDoor('bedroom', false, { instant: true });
    doors.onKeyhole = () => {
      const man = this.hour >= 3;
      UI.keyhole(1600, man ? 'mannequin' : 'eye');
      sfx.play(man ? 'sting' : 'whisper');
      if (man && !this.mannequinSeen) { this.mannequinSeen = true; setTimeout(() => this.state === 'play' && this.chat(pick(HYPE), 'หุ่นในห้องแขกหันมาแล้ว!!! เมื่อกี้มันหันหลังอยู่นะ'), 1200); }
    };

    // Krasue waits in the dark garden
    krasue.reset();
    krasue.onEntered = (kind) => {
      if (kind === 'back') { this.chat(KRASUE_USER, KRASUE.back); return; }
      this.chat(KRASUE_USER, KRASUE.chatHi);
      UI.toast('กระสือชอบแสง… ปิดไฟฉายแล้วยืนนิ่งๆ เธอจะมองไม่เห็น');
    };
    krasue.onSpot = () => Talk.say('krasue', pick(KRASUE.spot), { at: krasue.position, ms: 2200 });
    krasue.onPose = () => { Talk.say('krasue', pick(KRASUE.pose), { at: krasue.position, ms: 2400 }); this.chat(pick(HYPE), 'กระสือโพสท่า!! ถ่ายเลยมอด'); };
    krasue.onLick = () => this._licked();
    krasue.onGone = () => {};

    anomalies.reset();
    anomalies.plan(anomalies.list.length, 'bear');

    power.attach(this);
    power.onCut = () => {};
    power.onFixed = () => { krasue.frenzy = false; this.bot('ไฟกลับมาแล้วค่ะ ขอบคุณค่ะมอด :)'); this._objective(); };
    power.onBang = (pos) => {
      this.lures.push({ pos, kind: 'bang', strength: 5, range: 30, t: 8 });
      this.peachi.mood = Math.min(100, this.peachi.mood + 12);
      this.chat(pick(HYPE), 'ปังงง! ผีได้ยินหมดบ้านแล้ว');
    };

    // the router in the TV cabinet: the Wi-Fi password is on a sticker underneath
    this.interact({
      position: new THREE.Vector3(9.3, 0.55, 4.62), radius: 1.5,
      label: () => (this.wifiKnown ? '[E] ดูรหัส Wi-Fi อีกครั้ง' : '[E] ดูใต้เราเตอร์'),
      onUse: () => this._readSticker(),
      enabled: () => this.state === 'play',
    });
    // the golden peach
    this.interact({
      position: () => this.holder.position, radius: 1.8, label: '[E] หยิบลูกพีชทอง',
      onUse: () => this._takePeach(),
      enabled: () => this.state === 'play' && this.peachState === 'table',
    });
    this.interact({
      position: level.deskPosition.clone(), radius: 1.9, label: '[E] วางลูกพีชทองที่โต๊ะสตรีม',
      onUse: () => this._placePeach(),
      enabled: () => this.state === 'play' && this.peachState === 'carried',
    });
    // hide-and-seek: find the thing that giggles
    this.interact({
      position: () => this.seekObj.position, radius: 1.7, label: '[E] เจอแล้ว!',
      onUse: () => this._seekEnd(true),
      enabled: () => this.state === 'play' && !!this.seek,
    });

    this.holder.visible = false;
    this.peachLight.intensity = 0;
    this.seekObj.visible = false;
    this._objective();
    this.bot(BOT.n2Hello);
    UI.toast('รอบนี้มีมือถือ! กด Tab เปิด (ภารกิจ / รายงาน / แผนที่ / กล้อง)');

    // ---- the script
    this.at(0.02, () => { this.bot(BOT.guest); sfx.play('cackle'); });
    this.at(0.08, () => krasue.enter());
    this.at(0.12, () => peachi.line('มอด! ได้ยินชัดแล้วนะ! …แต่ทำไมยังเป็นสีเทาอยู่อะ'));
    this.at(0.3, () => this._firstAnomaly());
    this.at(0.6, () => { this.reqTimer = rand(20, 35); });
    this.at(1.0, () => {
      this.wifiAsked = true;
      this.chat(KRASUE_USER, KRASUE.wifi);
      setTimeout(() => this.state === 'play' && UI.toast('รหัส Wi-Fi อยู่ใต้เราเตอร์ ในตู้ทีวี (ห้องนั่งเล่น)'), 1500);
    });
    this.at(1.3, () => this.addMission({ id: 'photoK', text: 'ซุปแชต: รูปกระสือโพสท่า', sub: 'ยกกล้องใส่ เธอจะหยุดโพสท่า 3 วิ', ask: 'ขอรูปกระสือโพสท่าหน่อยค่า อยากได้ไปทำสติกเกอร์', photo: 'krasue', min: 30, left: 110, reward: 35, amount: 249, user: 'ลุงป้อม_สายเปย์', thanks: 'สติกเกอร์กระสือ!! ขอบคุณครับมอด' }));
    this.at(2.0, () => this._blackout(1));
    this.at(3.0, () => { this.mirrorEv = { phase: 'wait', t: 0 }; });
    this.at(4.0, () => this._blackout(2));
    this.at(4.5, () => { this.chat('เธอ', HER.n2, 'her'); sfx.play('whisper'); });
    this.at(5.0, () => {
      this.level.setFlicker(true);
      setTimeout(() => { if (this.state === 'play' && !this.peachi.isAngry) this.level.setFlicker(false); }, 2600);
      UI.toast('ชั่วโมงสุดท้าย!');
      this.bot(BOT.hour5);
    });
  }

  onAbort() {
    this._peachReset();
    this._seekClear();
    this._mirrorOff();
    this.krasue.reset();
    this.anomalies.reset();
    this.player.speedMul = 1;
    this.doors.onKeyhole = null;
  }

  _end() {
    super._end();
    this.player.speedMul = 1;
    this.krasue.freeze();
    this._mirrorOff();
  }

  _objective() {
    let t;
    if (this.seek) t = 'ซ่อนแอบ! หาพีชชี่ที่แปลงร่างเป็นของในบ้าน';
    else if (!this.power.on) t = 'ไฟดับ! ไปซ่อมเบรกเกอร์ในครัว';
    else if (this.peachState === 'table') t = 'ลูกพีชทองโผล่แล้ว! ไปหยิบที่โต๊ะปาร์ตี้ในครัว';
    else if (this.peachState === 'carried') t = 'เอาลูกพีชทองไปวางที่โต๊ะสตรีม (R ค้าง = ซ่อนแสง)';
    else t = `รายงานความผิดปกติในบ้าน (Tab) ${this.anomalies.reported}/${NEED}`;
    UI.setObjective(t);
  }

  goalRows() {
    const rows = [];
    const r = this.anomalies.reported;
    if (this.peachState === 'none') rows.push({ text: `รายงานความผิดปกติ ${r}/${NEED}`, sub: 'ครบแล้วลูกพีชทองจะโผล่', kind: 'goal' });
    else if (this.peachState === 'table') rows.push({ text: 'หยิบลูกพีชทองที่โต๊ะปาร์ตี้ (ครัว)', kind: 'goal' });
    else if (this.peachState === 'carried') rows.push({ text: 'เอาลูกพีชทองไปวางที่โต๊ะสตรีม', sub: this.peachHidden ? 'ซ่อนแสงอยู่ (เดินช้า)' : 'แสงดึงกระสือ! กด R ค้างเพื่อซ่อน', kind: 'goal' });
    if (!this.power.on) rows.push({ text: 'ไฟดับ: ซ่อมเบรกเกอร์ในครัว', sub: 'กด Space ตอนเข็มอยู่ในช่องเขียว', urgent: true });
    if (this.seek) rows.push({ text: 'ซ่อนแอบ: หาพีชชี่ (ของที่มีหูแมว)', left: Math.ceil(this.seek.t), urgent: this.seek.t < 15 });
    return rows;
  }

  actions() {
    const k = this.krasue;
    if (!this.wifiAsked && !this.wifiKnown) return [];
    if (this.wifiUsed) return [{ label: 'ส่งรหัส Wi-Fi แล้ว', sub: 'ใช้ได้คืนละครั้ง', disabled: true, run: () => {} }];
    return [{
      label: 'ส่งรหัส Wi-Fi ให้กระสือ',
      sub: this.wifiKnown ? 'เธอจะออกไปดูซีรีส์ 60 วิ (ครั้งเดียว)' : 'ยังไม่รู้รหัส… ดูใต้เราเตอร์ในตู้ทีวีก่อน',
      disabled: !this.wifiKnown || !k.active,
      run: () => this._sendWifi(),
    }];
  }

  get reportEnabled() { return true; }
  reportInfo() {
    return { title: `รายงานถูกแล้ว ${this.anomalies.reported}/${NEED}`, sub: this.peachState === 'none' ? 'ครบ 5 จุด ลูกพีชทองจะโผล่' : 'ลูกพีชทองโผล่แล้ว (รายงานต่อได้ ได้ยอดวิว)' };
  }
  report(room, kind) {
    if (this.state !== 'play') return;
    const r = this.anomalies.report(room, kind);
    if (r.ok) {
      this.stats.reports++;
      this._addViewers(10);
      this.peachi.mood = Math.max(0, this.peachi.mood - 10);
      this.bot(pick(BOT.rightReport));
      UI.toast(`รายงานถูก! "${r.anomaly.name}" (${this.anomalies.reported}/${NEED})`);
      this.spawnT = Math.min(this.spawnT, rand(8, 14));
      if (this.anomalies.reported >= NEED && this.peachState === 'none') this._spawnPeach();
    } else {
      this._addViewers(-5);
      sfx.play('denied');
      this.bot(pick(BOT.wrongReport));
      UI.toast(`ไม่มีอะไรผิดปกติแบบนั้นที่${ROOM_NAMES[room]}… ผู้ชม −5`);
    }
    this._objective();
  }

  mapInfo() {
    const icons = [];
    if (!this.power.on) icons.push({ x: BREAKER.x + 0.6, z: BREAKER.z + 0.6, icon: '⚡' });
    if (this.peachState === 'table') icons.push({ x: TABLE.x, z: TABLE.z, icon: '🍑' });
    const k = this.krasue;
    if (k.visible && k.active && Math.hypot(k.position.x - this.player.position.x, k.position.z - this.player.position.z) < 8) icons.push({ x: k.position.x, z: k.position.z, icon: '👻' });
    let hint = 'ห้องที่เปิดไฟไว้จะดึงกระสือไปหา';
    if (this.seek) hint = 'ได้ยินเสียงหัวเราะ… ส่องไฟฉายจะเห็นประกายชมพู';
    else if (!this.power.on) hint = 'เบรกเกอร์อยู่ผนังครัว ฝั่งซ้ายสุด';
    else if (this.peachState === 'carried') hint = 'โต๊ะสตรีมอยู่ห้องสตรีม (ประตูชมพู)';
    return { hint, icons };
  }

  subjects() {
    const list = super.subjects();
    const k = this.krasue;
    if (k.visible && k.state !== 'off') list.push({
      kind: 'krasue', id: 'krasue', pos: k.position.clone(), base: 50,
      facing: () => true, special: () => k.state === 'pose',
      caption: (h) => (h.special ? 'กระสือแย่งซีน ✨' : k.state === 'lick' ? 'ลิ้นกระสือ (ใกล้ไปมั้ย)' : 'กระสือหลุดเฟรม'),
    });
    for (const a of this.anomalies.active) list.push({ kind: 'anomaly', id: a.id, pos: a.pos, base: 30, caption: `หลักฐาน: ${a.name}` });
    if (this.peachState === 'table') list.push({ kind: 'peach', id: 'peach', pos: this.holder.position.clone(), base: 25, caption: 'ลูกพีชทองคำ ✨' });
    if (this.seek) list.push({ kind: 'seek', id: 'seek', pos: this.seekObj.position.clone(), base: 35, caption: 'ฟักทองหูแมว…?' });
    return list;
  }

  onPhotoTaken(photo) {
    this.lures.push({ pos: this.player.position.clone(), kind: 'lure', strength: 2, range: 10, t: 2.5 }); // the flash is a light too
    if (photo.hits.some((h) => h.kind === 'krasue' && h.special)) this.chat(pick(HYPE), 'กระสือเป๊ะมาก 555 ลงไอจีเลย');
  }

  // ---------------------------------------------------------------- update
  onUpdate(dt, t) {
    const { krasue, anomalies, player, peachi, hide } = this;
    anomalies.update(dt, t, { camera: this.camera, player });

    // new anomalies over time (never in the room you're in, at most 4 waiting)
    if (anomalies.spawned > 0) {
      this.spawnT -= dt;
      if (this.spawnT <= 0) {
        this.spawnT = rand(28, 40);
        if (anomalies.unresolved < 4 && anomalies.spawnNext(player)) {
          if (Math.random() < 0.35) this.chat(pick(HYPE), pick(['เหมือนบ้านเปลี่ยนไปนิดนึงนะ', 'เมื่อกี้มีอะไรขยับมั้ย', 'บ้านนี้แปลกๆ แล้ว']));
        } else if (anomalies.unresolved < 4) this.spawnT = 3; // you were standing in the only room left
      }
    }
    krasue.strong = anomalies.unresolved >= 3;

    // Krasue follows the lights
    for (const L of this.lures) L.t -= dt;
    this.lures = this.lures.filter((L) => L.t > 0);
    const lures = [...this.lures];
    if (this.peachState === 'table') lures.push({ pos: this.holder.position, kind: 'peach', strength: 4, range: 22 });
    if (this.peachState === 'carried' && !this.peachHidden) lures.push({ pos: player.position, kind: 'player', strength: 4, range: 22 });
    krasue.update(dt, t, { player, camera: this.camera, lures, cameraUp: this.phone.cameraUp, playerHidden: hide.hidden });

    // Peachi hates the dark
    peachi.moodScale = this.power.on ? 1 : 1.5;

    // requests (no "turn the light on" during a blackout)
    this.reqTimer -= dt;
    if (this.reqTimer <= 0 && !this.requests.active && !peachi.isAngry && !hide.hidden && !this.seek) {
      const kinds = ['hungry', 'lonely', ...(this.power.on ? ['dark'] : [])].filter((k) => k !== this.lastReq);
      const k = pick(kinds);
      if (this.requests.start(k)) this.lastReq = k;
      this.reqTimer = rand(70, 90);
    }

    this._updatePeach(dt, t);
    if (this.hour >= 2.5 && !this.seekDone && !this.seek && this.power.on && !peachi.isAngry && !hide.hidden && peachi.state !== 'jumpscare') this._seekStart();
    this._updateSeek(dt, t);
    this._updateMirror(dt);
  }

  idleUpdate(dt, t) {
    this.krasue.update(dt, t, {});
    if (this.holder.visible) this._bobPeach(dt, t);
  }

  // ---------------------------------------------------------------- anomalies
  _firstAnomaly() {
    const a = this.anomalies.spawn('bear') || this.anomalies.spawnNext(this.player);
    this.spawnT = rand(30, 40);
    this.bot(BOT.anomalyTip);
    this.peachi.line('เอ๊ะ… หมีบนตู้หนังสือห้องนั่งเล่นหันหลังไปแล้ว! มอดรายงานในมือถือหน่อย');
    UI.toast('เปิดมือถือ (Tab) → รายงาน → เลือกห้อง → เลือกสิ่งที่เปลี่ยน');
    if (!a) this.spawnT = 5;
  }

  // ---------------------------------------------------------------- blackouts
  _blackout(n) {
    const hard = n >= 2;
    if (!this.power.on) { // still dark from the last one: it just gets worse
      if (hard) { this.power.hits = Math.max(this.power.hits, 4); this.power.speedK = 1.25; this.krasue.frenzy = true; this.bot(BOT.blackout2); }
      return;
    }
    this.power.blackout({ hits: hard ? 4 : 3, speed: hard ? 1.25 : 1 });
    this.krasue.frenzy = hard;
    this.requests.cancel();
    this.bot(hard ? BOT.blackout2 : BOT.blackout);
    this.peachi.line(hard ? 'อีกแล้วเหรอ!! มอดดด ไฟฟฟ' : 'กรี๊ด! ไฟดับ! มอดซ่อมไฟที เบรกเกอร์อยู่ในครัว!');
    UI.shake(300);
    if (hard) this.chat(pick(HYPE), 'กระสือคลั่งแล้ววว ไส้เรืองแสงวิ่งไปมา');
    this._objective();
  }

  // ---------------------------------------------------------------- Wi-Fi
  _readSticker() {
    sfx.play('pickup');
    UI.sticker({ title: 'Wi-Fi · ติดใต้เราเตอร์', lines: [['ชื่อ: PeachiView_5G'], [`รหัส: ${WIFI_PW}`, 'pw'], ['(ห้ามบอกผี)']], ms: 4200 });
    if (!this.wifiKnown) {
      this.wifiKnown = true;
      setTimeout(() => this.state === 'play' && UI.toast('ได้รหัสแล้ว! ส่งให้กระสือได้ในมือถือ (Tab → ภารกิจ)'), 1800);
    }
  }
  _sendWifi() {
    if (!this.wifiKnown || this.wifiUsed || !this.krasue.active) return;
    this.wifiUsed = true;
    this.chat('มอด (คุณ)', `รหัส Wi-Fi: ${WIFI_PW}`);
    sfx.play('modem');
    setTimeout(() => {
      if (this.state !== 'play') return;
      this.chat(KRASUE_USER, KRASUE.wifiThanks);
      Talk.say('krasue', 'ต่อเน็ตได้แล้ว~ ไปดูซีรีส์ก่อนนะคะ', { at: this.krasue.position, ms: 2400 });
      this.krasue.leave(60);
      this._addViewers(randInt(8, 14));
    }, 1300);
  }

  // ---------------------------------------------------------------- the lick
  _licked() {
    this.stats.licks++;
    UI.slime(10000);
    UI.shake(250);
    sfx.play('squelch');
    const fl = this.player.flashlight;
    if (fl) { fl.battery = 0; fl.on = false; }
    this._addViewers(-20);
    Talk.say('krasue', pick(KRASUE.lick), { at: this.krasue.position, ms: 2400 });
    for (const [i, m] of ['ยี้ยยยยย', 'จอเลอะหมดแล้ว', 'แบตไฟฉายหมดเลยยย 555'].entries()) setTimeout(() => this.state === 'play' && this.chat(pick(HYPE), m), 400 + i * 500);
    setTimeout(() => { if (this.state === 'play' && fl) { fl.battery = Math.max(fl.battery, 35); UI.toast('เช็ดจอเสร็จ… ไฟฉายชาร์จกลับมานิดหน่อย'); } }, 12000);
  }

  // ---------------------------------------------------------------- the golden peach
  _spawnPeach() {
    this.peachState = 'table';
    if (this.holder.parent !== this.scene) this.scene.add(this.holder);
    this.holder.position.copy(TABLE);
    this.holder.rotation.set(0, 0, 0);
    this.holder.scale.setScalar(1);
    this.holder.visible = true;
    sfx.play('peachShine');
    UI.flash('#ffd890');
    this.bot(BOT.peach);
    this.peachi.line('ลูกพีชทองของพีชชี่! อยู่บนโต๊ะปาร์ตี้ในครัว เอามาคืนหน่อยน้า');
    this._objective();
  }
  _takePeach() {
    if (this.peachState !== 'table') return;
    this.peachState = 'carried';
    sfx.play('pickup');
    this.camera.add(this.holder);
    this.holder.position.set(0.32, -0.27, -0.66);
    this.holder.rotation.set(0.2, -0.5, 0);
    this.holder.scale.setScalar(0.7);
    UI.toast('ได้ลูกพีชทองแล้ว! แสงมันดึงกระสือ… กด R ค้างเพื่อซ่อนในเสื้อ');
    this._addViewers(randInt(10, 16));
    this._objective();
  }
  _placePeach() {
    if (this.peachState !== 'carried') return;
    this.peachState = 'placed';
    this.peachHidden = false;
    this.player.speedMul = 1;
    sfx.play('place');
    const d = this.level.deskPosition;
    this.scene.add(this.holder);
    this.holder.position.set(d.x, (d.y < 0.5 ? 0.8 : d.y) + 0.1, d.z);
    this.holder.rotation.set(0, 0, 0);
    this.holder.scale.setScalar(1);
    this.win();
  }
  _peachReset() {
    this.peachState = 'none';
    this.peachHidden = false;
    if (this.holder.parent !== this.scene) this.scene.add(this.holder);
    this.holder.visible = false;
    this.peachLight.intensity = 0;
  }
  _bobPeach(dt, t) {
    this.peach.rotation.y += dt * 1.3;
    this.peach.position.y = Math.sin(t * 2.1) * 0.03;
    this.peach.userData.halo.material.opacity = 0.65 + 0.3 * Math.sin(t * 3.3);
  }
  _updatePeach(dt, t) {
    const S = this.peachState;
    if (S === 'none' || S === 'placed') { this.peachLight.intensity = 0; return; }
    this._bobPeach(dt, t);
    const hide = S === 'carried' && this._rDown && this.player.enabled;
    if (hide !== this.peachHidden) {
      this.peachHidden = hide;
      this.player.speedMul = hide ? 0.6 : 1;
      this.peach.visible = !hide;
      if (hide) UI.toast('ซ่อนลูกพีชไว้ในเสื้อ… เดินช้าลง');
      this._objective();
    }
    const glow = S === 'carried' && hide ? 0 : 1;
    this.peach.userData.halo.visible = glow > 0;
    this.peach.userData.halo.scale.setScalar(S === 'carried' ? 0.22 : 0.55); // in hand it sits right by the lens
    if (S === 'carried') { // a warm glow around you, not a lamp in your face
      this.peachLight.position.set(this.player.position.x, 1.1, this.player.position.z);
      this.peachLight.distance = 3.5;
    } else { this.holder.getWorldPosition(this.peachLight.position); this.peachLight.distance = 4.5; }
    this.peachLight.intensity = glow * (S === 'table' ? 3.2 : 0.9) * (0.85 + 0.15 * Math.sin(t * 4));
  }

  // ---------------------------------------------------------------- 02:30 hide-and-seek
  _seekStart() {
    const { level, peachi, player } = this;
    const here = level.roomAt(player.position);
    const rooms = ['stream', 'kitchen', 'living', 'bathroom', 'hallway'].filter((r) => r !== here);
    const room = pick(rooms);
    const spots = [...(level.itemSpots || []), ...(level.navPoints || [])].filter((p) => level.roomAt(p) === room);
    const spot = (pick(spots) || new THREE.Vector3(0, 0, 0)).clone();
    this.seek = { room, t: 60, giggleT: 2.5, sparkT: 0 };
    this.seekDone = true;
    this.requests.cancel();
    peachi.line('เล่นซ่อนแอบกัน! พีชชี่จะแปลงร่างเป็นของในบ้าน หาให้เจอใน 60 วินะ~', 3600);
    sfx.play('giggle');
    peachi.active = false;
    this._seekSaved = peachi.position.clone();
    setTimeout(() => { if (this.seek && this.state === 'play') { peachi.group.visible = false; sfx.play('sparkle'); } }, 1400);
    this.seekObj.position.set(spot.x, spot.y > 0.2 ? spot.y : 0, spot.z);
    this.seekObj.rotation.y = Math.random() * Math.PI * 2;
    this.seekObj.visible = true;
    this.chat(pick(HYPE), 'ซ่อนแอบ!!! พีชชี่ไปอยู่ไหนแล้ว');
    this._objective();
  }
  _updateSeek(dt, t) {
    const S = this.seek;
    if (!S) return;
    S.t -= dt;
    const pos = this.seekObj.position;
    S.giggleT -= dt;
    if (S.giggleT <= 0) {
      S.giggleT = rand(4.5, 6.5);
      const p = this.panAt(pos.x, pos.z);
      sfx.play('giggle', { pan: p.pan, vol: Math.max(0.2, Math.min(1, 2.4 / (1 + p.dist * 0.3))) });
    }
    const lit = this.player.isLightOn(new THREE.Vector3(pos.x, pos.y + 0.15, pos.z));
    const sp = this.seekObj.userData.sparkle;
    sp.material.opacity += ((lit ? 1 : 0) - sp.material.opacity) * Math.min(1, dt * 6);
    sp.material.rotation += dt * 0.8;
    if (lit) { S.sparkT -= dt; if (S.sparkT <= 0) { S.sparkT = 1.2; sfx.play('sparkle', { vol: 0.5 }); } }
    this.seekObj.rotation.z = Math.sin(t * 9) * 0.03 * (lit ? 1 : 0.3); // trying not to laugh
    if (S.t <= 0) this._seekEnd(false);
  }
  _seekEnd(found) {
    const S = this.seek;
    if (!S) return;
    const { peachi, player } = this;
    const at = this.seekObj.position.clone();
    this._seekClear();
    peachi.group.visible = true;
    peachi.active = true;
    peachi.state = 'roam';
    if (found) {
      sfx.play('found');
      peachi.group.position.set(at.x, 0, at.z);
      peachi.mood = Math.max(0, peachi.mood - 40);
      this._addViewers(randInt(18, 26));
      this.chat(pick(HYPE), 'เจอแล้ววว มอดตาดีมาก');
      peachi.line(`เจอแล้วเหรอ! เก่งจัง… ให้คำใบ้นะ: ${this._hint()}`, 5200);
    } else {
      const f = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
      peachi.group.position.set(player.position.x - f.x * 2.2, 0, player.position.z - f.z * 2.2);
      peachi.mood = Math.min(100, peachi.mood + 20);
      sfx.play('giggle');
      peachi.line('หาไม่เจอ~ พีชชี่ชนะ! แฮร่~ อยู่ข้างหลังตั้งนาน', 3400);
      this.chat(pick(HYPE), 'หันหลังงง!!!');
    }
    this._objective();
  }
  _seekClear() {
    this.seek = null;
    this.seekObj.visible = false;
    this.seekObj.userData.sparkle.material.opacity = 0;
  }
  _hint() {
    const a = this.anomalies.active[0];
    if (a) return `ที่${ROOM_NAMES[a.rooms[0]]} มี "${(KINDS.find((k) => k.id === a.kind) || {}).label}" อยู่นะ`;
    if (!this.wifiUsed) return 'รหัส Wi-Fi อยู่ใต้เราเตอร์ในตู้ทีวี ให้กระสือไป เธอจะหายไปแป๊บนึง';
    return 'กระสือชอบแสง ปิดไฟฉายแล้วยืนนิ่งๆ นะ';
  }

  // ---------------------------------------------------------------- 03:00 the bathroom mirror
  _mirrorSetup() {
    if (this.mirror) return this.mirror;
    const m = new Reflector(new THREE.PlaneGeometry(0.6, 0.82), { textureWidth: 512, textureHeight: 512, color: 0x9098a0, clipBias: 0.003 });
    m.position.copy(MIRROR);
    m.rotation.y = -Math.PI / 2;
    m.camera.layers.enable(3); // Peachi is on layer 3 while she's only in the mirror
    const draw = m.onBeforeRender;
    m.onBeforeRender = (r, s, c) => { const a = r.shadowMap.autoUpdate; r.shadowMap.autoUpdate = false; draw(r, s, c); r.shadowMap.autoUpdate = a; };
    m.visible = false;
    this.scene.add(m);
    this.mirror = m;
    return m;
  }
  _setPeachiLayer(layer) { this.peachi.group.traverse((o) => o.layers.set(layer)); }
  _updateMirror(dt) {
    const E = this.mirrorEv;
    if (!E || E.phase === 'done') return;
    const { player, camera, peachi } = this;
    const m = this._mirrorSetup();
    const d = Math.hypot(player.position.x - MIRROR.x, player.position.z - MIRROR.z);
    const inBath = this.level.roomAt(player.position) === 'bathroom';
    m.visible = inBath && d < 4.5;
    if (E.phase === 'wait') {
      if (!m.visible || this.hide.hidden || peachi.isAngry || this.seek || !peachi.active) return;
      const fwd = camera.getWorldDirection(new THREE.Vector3());
      const to = new THREE.Vector3().subVectors(MIRROR, camera.position).normalize();
      if (d < 2.8 && fwd.dot(to) > 0.88) {
        E.phase = 'reveal'; E.t = 0;
        E.saved = peachi.position.clone();
        peachi.active = false;
        const f = new THREE.Vector3(fwd.x, 0, fwd.z).normalize();
        E.at = new THREE.Vector3(player.position.x - f.x * 0.85 - f.z * 0.2, 0, player.position.z - f.z * 0.85 + f.x * 0.2);
        peachi.group.position.copy(E.at);
        peachi.group.rotation.y = Math.atan2(MIRROR.x - E.at.x, MIRROR.z - E.at.z);
        peachi.lookOverride = MIRROR.clone();
        peachi._setExpression('happy'); peachi._setPose('idle');
        this._setPeachiLayer(3);
        setTimeout(() => this.mirrorEv && this.mirrorEv.phase === 'reveal' && sfx.play('sting'), 500);
      }
    } else if (E.phase === 'reveal') {
      E.t += dt;
      const fwd = camera.getWorldDirection(new THREE.Vector3());
      const toHer = new THREE.Vector3(E.at.x - camera.position.x, 0, E.at.z - camera.position.z).normalize();
      if (new THREE.Vector3(fwd.x, 0, fwd.z).normalize().dot(toHer) > 0.2 || E.t > 5 || d > 3.5) {
        E.phase = 'done';
        this._setPeachiLayer(0);
        peachi.lookOverride = null;
        const far = (this.level.navPoints || []).filter((p) => p.distanceTo(player.position) > 8);
        peachi.group.position.copy(pick(far) || E.saved);
        peachi.active = true;
        sfx.play('giggle');
        this._addViewers(randInt(25, 35));
        for (const [i, msg] of ['ในกระจกกกก!!!', 'พีชชี่ยืนข้างหลัง!!', 'หันไปไม่มีใคร', 'ขนลุกทั้งแชต'].entries()) setTimeout(() => this.state === 'play' && this.chat(pick(HYPE), msg), 300 + i * 450);
        setTimeout(() => this._mirrorOff(), 1500);
      }
    }
  }
  _mirrorOff() {
    const E = this.mirrorEv;
    if (E && E.phase === 'reveal') { this._setPeachiLayer(0); this.peachi.lookOverride = null; this.peachi.active = true; }
    if (E) E.phase = 'done';
    if (this.mirror) this.mirror.visible = false;
  }

  // ---------------------------------------------------------------- ending: her colors come back
  async winScene() {
    const { cut, peachi, level, krasue } = this;
    this._mirrorOff();
    this._seekClear();
    Talk.stop();
    await cut.run(async (c) => {
      await c.fade(1, 450);
      level.setPower(true);
      level.setFlicker(false);
      level.setRoomLights('stream', true);
      peachi.group.visible = true;
      peachi.group.position.set(-6.35, 0, -5.35);
      peachi.group.rotation.y = 0.35;
      peachi._setPose('float'); peachi._setExpression('happy');
      peachi.lookOverride = null;
      const d = level.deskPosition;
      this.holder.visible = true; this.peach.visible = true;
      this.holder.position.set(d.x, (d.y < 0.5 ? 0.8 : d.y) + 0.12, d.z);
      krasue.freeze();
      krasue.place(new THREE.Vector3(-4.0, 1.62, -1.9), new THREE.Vector3(-6.3, 1.3, -5.4));
      c.set([-5.2, 1.5, -3.2], [-6.2, 1.25, -5.45]);
      await c.fade(0, 700);
      await c.say('peachi', 'ลูกพีชทอง! ของพีชชี่!', { hold: 1600 });
      // the peach flies to her
      const from = this.holder.position.clone(), to = new THREE.Vector3(-6.3, 1.05, -5.15);
      for (let i = 0; i <= 20; i++) { this.holder.position.lerpVectors(from, to, i / 20); await c.wait(0.03); }
      sfx.play('peachShine');
      UI.flash('#ffd890');
      peachi.model.setGlow(1);
      for (let i = 0; i <= 30; i++) { peachi.model.setDesat(0.72 * (1 - i / 30)); await c.wait(0.05); }
      this.holder.visible = false;
      peachi.model.setGlow(0.35);
      await c.to([-5.4, 1.45, -4.0], [-6.3, 1.3, -5.4], 1.4);
      await c.say('peachi', 'สีกลับมาแล้ว! ผมชมพูแล้ว ดูสิ ดูสิ!');
      await c.say('peachi', 'มอดดูออกมั้ย… สวยขึ้นใช่ปะ ห้ามตอบว่าไม่นะ');
      await c.to([-5.0, 1.55, -3.3], [-4.0, 1.6, -1.9], 1.0);
      krasue.setExpression('annoyed');
      await c.say('krasue', KRASUE.fee);
      await c.to([-5.4, 1.45, -4.0], [-6.3, 1.3, -5.4], 0.8);
      await c.say('peachi', 'เดี๋ยวโอนให้นะ… เป็นลูกพีช');
      await c.to([-5.0, 1.55, -3.3], [-4.0, 1.6, -1.9], 0.8);
      await c.say('krasue', 'ลูกพีชอีกแล้ว… ก็ได้ค่ะ ✨ ไว้เจอกันนะคะทุกคน');
      krasue.setExpression('smile');
      sfx.play('cackle');
      await c.wait(0.4);
      krasue.group.visible = false; krasue.M.light.intensity = 0;
      await c.to([-5.6, 1.4, -5.9], [-5.73, 1.15, -6.66], 1.2);
      sfx.play('glitch', { n: 12 });
      c.shake = 0.012;
      level.setFlicker(true);
      await c.say('bot', BOT.glitch, { hold: 3600 });
      this.bot(BOT.glitch);
      c.shake = 0;
      level.setFlicker(false);
      await c.to([-5.4, 1.45, -4.0], [-6.3, 1.3, -5.4], 1.0);
      await c.say('peachi', '…มันรู้แล้วว่าเราจะทำอะไร', { hold: 2400 });
      await c.say('peachi', 'คืนพรุ่งนี้ฮาโลวีน คืนสุดท้าย… มอดต้องมานะ สัญญา!', { hold: 2800 });
      sfx.play('powerDown');
      await c.fade(1, 900);
    }, { skippable: true });
    peachi.model.setDesat(0);
    krasue.reset();
    UI.subtitle(null);
    UI.fade(0, 10);
  }

  winCard() {
    return {
      title: 'คืนที่ 2 ผ่านแล้ว',
      stamp: 'สีกลับมาแล้ว',
      text: 'พีชชี่ได้สีคืนมา กระสือยังไม่ได้ค่าตัว และ PeachiBot เริ่มรู้ตัว… ไลฟ์มาแล้ว 247:59:59 เหลืออีกคืนเดียว',
    };
  }

  statRows() {
    return [
      ...super.statRows(),
      ['รายงานความผิดปกติ', `${this.anomalies.reported} จุด`],
      ['โดนกระสือเลีย', `${this.stats.licks || 0} ครั้ง`],
    ];
  }
}
