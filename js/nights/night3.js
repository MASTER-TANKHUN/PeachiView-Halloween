// Night 3 — Halloween, 31 Oct: the live has run 248 hours, one more and it never ends. Peachi's heart
// choker is broken in three: the pendant (only in the hall mirror), the strap (inside Phi Pop) and the
// padlock (in the guest room, which opens at 04:00 as the Room of Waiting). Bring all three to the stream
// desk. Guests: Phi Pop (hungry, the kitchen's snacks are shared with Peachi's requests), the fake Peachi
// from 02:30, a Krasue cameo, the walking mannequin at 03:00. Rain all night.
// Script: Phi Pop walks in 00:00 · red light green light 01:00 · the mirror 02:00 · the fake 02:30 ·
// "เธอ" + the mannequin 03:00 · the strap hint 03:30 · the Room of Waiting 04:00 · 05:00 PeachiBot wakes up
// (the boss fight comes next week: for now a "to be continued" scene once the choker is complete).
import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { NightBase, pick, rand, randInt } from './base.js';
import { UI } from '../ui.js';
import { sfx, ambient } from '../audio.js';
import { Talk } from '../game/talk.js';
import { BOT, HER, KRASUE, STORIES } from '../data/story.js';
import { PhiPop, SHRINE } from '../ghosts/pop.js';
import { FakePeachi } from '../ghosts/fake.js';
import { Mannequin } from '../ghosts/mannequin.js';
import { RedLight } from '../systems/redlight.js';
import { WaitingRoom, TABLE as WAIT_TABLE } from '../world/waiting.js';
import { buildPendant, buildStrap, buildLock, buildChokerSet } from '../world/choker.js';
import { art } from '../world/tex.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const HYPE = ['ลูกพีชน้อย_249', 'peachlover', 'นอนไม่หลับ', 'ลูกพีชซ่า', 'mod_ตัวจริง', 'แม่นาค_ตัวจริง'];
const POP_USER = 'ผีปอบ_สายกิน';
const SNACKS = 10;
const HALL_MIRROR = V(-6.9, 1.72, -0.884);
const BATH_MIRROR = V(9.8355, 1.62, -3.3);
const PENDANT_AT = V(-6.3, 1.45, 0.86);      // hanging on the hall's south wall — only the mirror shows it
const FRIDGE = V(-9.3, 1.0, 5.95);
const SHRINE_TOP = V(3.64, 1.05, 6.31);
const SIGN_AT = V(0.9, 1.55, 1.108);

function sodaBottle() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.17, 14), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1, transparent: true, opacity: 0.35 })));
  const liquid = new THREE.Mesh(new THREE.CylinderGeometry(0.027, 0.027, 0.13, 14), new THREE.MeshStandardMaterial({ color: 0xff1a3a, emissive: 0x8a0010, emissiveIntensity: 0.8, roughness: 0.2 }));
  liquid.position.y = -0.015; g.add(liquid);
  const straw = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.16, 6), new THREE.MeshStandardMaterial({ color: 0xffffff }));
  straw.position.set(0.01, 0.1, 0); straw.rotation.z = 0.2; g.add(straw);
  g.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return g;
}

export class Night3 extends NightBase {
  get number() { return 3; }
  get secondsPerHour() { return 70; }
  get uptimeBase() { return 248; }

  constructor(ctx) {
    super(ctx);
    const { scene, level } = this;
    this.pop = new PhiPop(scene, level, this.doors);
    this.fake = new FakePeachi(scene, level);
    this.mannequin = new Mannequin(scene);
    this.waiting = new WaitingRoom(scene);
    this.redlight = new RedLight({ player: this.player, peachi: this.peachi, level });
    // the pendant hangs where only a mirror can see it (layer 3)
    this.pendant = buildPendant(); this.pendant.position.copy(PENDANT_AT); this.pendant.rotation.y = Math.PI; this.pendant.scale.setScalar(2.2);
    { // a pink glow so it catches the eye in the mirror
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,150,200,1)'); gr.addColorStop(0.35, 'rgba(255,90,170,0.45)'); gr.addColorStop(1, 'rgba(255,90,170,0)');
      x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      halo.scale.setScalar(0.16); this.pendant.add(halo); this.pendantHalo = halo;
    }
    this.pendant.traverse((o) => o.layers.set(3)); this.pendant.visible = false; scene.add(this.pendant);
    this.strap = buildStrap(); this.strap.visible = false; scene.add(this.strap);
    // what's on the stream desk
    this.deskSet = buildChokerSet(); this.deskSet.visible = false; scene.add(this.deskSet);
    // red soda: in your hand, and on the shrine
    this.hand = sodaBottle(); this.hand.visible = false; this.hand.position.set(0.3, -0.27, -0.55); this.hand.rotation.set(0.2, 0, -0.2);
    this.camera.add(this.hand);
    this.shrineSoda = sodaBottle(); this.shrineSoda.position.copy(SHRINE_TOP).add(V(0, 0.085, 0)); this.shrineSoda.visible = false; scene.add(this.shrineSoda);
    // the chalkboard above the snack rack counts what's left
    this.signTex = art(256, 150, (g, w, h) => this._drawSign(g, w, h));
    this.sign = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.2), new THREE.MeshStandardMaterial({ map: this.signTex, roughness: 0.9 }));
    this.sign.position.copy(SIGN_AT); this.sign.visible = false; scene.add(this.sign);
    this.mirrors = [];
    this.snacks = { count: SNACKS, take: () => this._takeSnack() };
  }

  introCard() {
    return {
      title: 'คืนที่ 3', clock: '00:00', date: '31 ตุลาคม · ฮาโลวีน  ·  ไลฟ์มาแล้ว 248 ชั่วโมง',
      text: 'อีก 1 ชั่วโมงสู่ไลฟ์ถาวร: ตามหาโชคเกอร์หัวใจ 3 ชิ้น แล้วเอาไปวางที่โต๊ะสตรีม',
      story: pick(STORIES),
    };
  }

  // ---------------------------------------------------------------- start
  onStart() {
    const { level, peachi, doors, requests } = this;
    this.pieces = { pendant: 'hidden', strap: 'inside', lock: 'box' }; // → 'held' → 'placed'
    this.pendantSeen = false;
    this.soda = { stock: 3, held: false, onShrine: false };
    this.snacks.count = SNACKS;
    this.strapOut = false;
    this.reqTimer = 999;
    this.thunderT = rand(8, 16);
    this.rlDone = false; this.rlWant = false;
    this.teased = false;
    this.inWaiting = false;
    this.hungerShown = null;
    this.stats.fed = 0; this.stats.sodas = 0; this.stats.fakes = 0;
    this.player.speedMul = 1;

    // Peachi: colors back, still a ghost
    Talk.brokenPeachi = false;
    peachi.model.setHeadphones(true);
    peachi.model.setDesat(0);
    peachi.moodScale = 1.1;

    doors.locked.clear();
    doors.locked.add('bedroom');
    level.setDoor('bedroom', false, { instant: true });
    doors.onKeyhole = () => {
      UI.keyhole(1600, this.hour < 3 ? 'mannequin' : 'eye');
      sfx.play(this.hour < 3 ? 'whisper' : 'sting');
      if (this.hour >= 3 && !this.keyEye) { this.keyEye = true; setTimeout(() => this.state === 'play' && this.chat(pick(HYPE), 'หุ่นหายไปแล้ว… แล้วใครมองอยู่!?'), 1100); }
    };

    // the shared snack supply
    requests.freeSnacks = true;
    requests.takeSnack = () => this._takeSnack();

    // guests
    this.pop.reset();
    this.pop.onCaught = () => this.lose('pop');
    this.pop.onBurp = (at) => this._burp(at);
    this.pop.onAte = () => { if (this.snacks.count <= 2 && !this.lowWarned) { this.lowWarned = true; UI.toast(`ขนมในครัวเหลือ ${this.snacks.count}! ขนมหมดเมื่อไหร่ ผีปอบจะหิวหามอดแทน`); } };
    this.pop.onSmash = (id) => { this.chat(pick(HYPE), 'ประตูพังงงง!!!'); UI.shake(400); if (id === 'stream') this.chat(pick(HYPE), 'ห้องพีชชี่ประตูพังแล้ว 555'); };
    this.pop.onHunt = () => { this.chat(POP_USER, 'ขนมหมด… งั้นมอดก็ได้ 🍖'); this.bot('แจ้งเตือนค่ะ: ผีปอบหิวเต็มหลอด กรุณาหาอะไรให้กินด่วนค่ะ'); };
    this.fake.reset();
    this.fake.onCaught = () => this.lose('fake');
    this.fake.onGone = (why) => { this.stats.fakes++; this._addViewers(why === 'photo' ? randInt(22, 30) : randInt(10, 16)); this.chat(pick(HYPE), why === 'photo' ? 'กล้องจับได้!! ตัวปลอมจริงๆ' : 'แตกเป็นควันเลย 555'); };
    this.fake.onLure = () => { if (Math.random() < 0.5) this.chat(pick(HYPE), pick(['พีชชี่ตัวนี้เสียงแปลกๆ นะ', 'อย่าไปนะมอด!!', 'ทำไมเรียกว่ามอดขาาา…'])); };
    this.mannequin.reset();
    this.mannequin.onTap = () => { this._addViewers(randInt(15, 22)); for (const [i, m] of ['หุ่นมันเดินได้!!!', 'มาจากไหน', 'ใจหล่นไปที่ตาตุ่ม'].entries()) setTimeout(() => this.state === 'play' && this.chat(pick(HYPE), m), 200 + i * 450); };
    this.krasue.reset();
    this.krasue.avoid = new Set(['bedroom']);
    this.waiting.reset();
    this.redlight.stop();

    // world bits
    this.pendant.visible = false;
    this.strap.visible = false;
    this.deskSet.visible = false;
    for (const k of ['strap', 'pendant', 'lock']) this.deskSet.userData.parts[k].visible = false;
    const d = level.deskPosition;
    this.deskSet.position.set(d.x + 0.25, (d.y < 0.5 ? 0.8 : d.y) + 0.005, d.z + 0.12);
    this.hand.visible = false;
    this.shrineSoda.visible = false;
    this.sign.visible = true;
    this._drawSignNow();

    // ---- interactables
    this.interact({ position: FRIDGE, radius: 1.4, label: () => (this.soda.stock > 0 ? `[E] หยิบน้ำแดงจากตู้เย็น (เหลือ ${this.soda.stock})` : '[E] น้ำแดงหมดแล้ว'),
      onUse: () => this._takeSoda(), enabled: () => this.state === 'play' && !this.soda.held && this._in('kitchen') });
    this.interact({ position: SHRINE_TOP, radius: 1.7, label: '[E] วางน้ำแดงไหว้ศาลพระภูมิ',
      onUse: () => this._offerSoda(), enabled: () => this.state === 'play' && this.soda.held && !this.soda.onShrine && this._in('living') });
    this.interact({ position: () => V(this.pop.position.x, 1.0, this.pop.position.z), radius: 2.2, label: () => `[E] ให้${requests.snack ? requests.snack.name : 'ขนม'}ผีปอบ`,
      onUse: () => this._feedPop(), enabled: () => this.state === 'play' && !!requests.snack && this.pop.active && this.pop.state !== 'jumpscare' && this.pop.state !== 'enter' });
    this.interact({ position: PENDANT_AT.clone().setY(1.2), radius: 1.3, label: '[E] ควานหาจี้หัวใจ (ในกระจกมันอยู่ตรงนี้)',
      onUse: () => this._takePiece('pendant'), enabled: () => this.state === 'play' && this.pendantSeen && this.pieces.pendant === 'hidden' && this._in('hallway') });
    this.interact({ position: () => this.strap.position, radius: 1.6, label: '[E] หยิบสายโชคเกอร์ (เปียกนิดหน่อย)',
      onUse: () => this._takePiece('strap'), enabled: () => this.state === 'play' && this.pieces.strap === 'out' });
    this.interact({ position: WAIT_TABLE.clone().setY(0.7), radius: 1.5, label: '[E] เปิดกล่องดนตรี',
      onUse: () => this._takePiece('lock'), enabled: () => this.state === 'play' && this.waiting.entered && this.pieces.lock === 'box' && this._in('bedroom') });
    this.interact({ position: level.deskPosition.clone(), radius: 1.9, label: () => `[E] วางชิ้นส่วนโชคเกอร์ (${this._count('placed') + this._count('held')}/3)`,
      onUse: () => this._placePieces(), enabled: () => this.state === 'play' && this._count('held') > 0 && this._in('stream') });

    UI.setObjective('ตามหาชิ้นส่วนโชคเกอร์หัวใจ 3 ชิ้น');
    this.bot(BOT.n3Hello);
    try { ambient.setRain(1); } catch (e) { /* no audio */ }

    // ---- the script
    this.at(0.02, () => { this.bot(BOT.guestPop); this._popEnters(); });
    this.at(0.12, () => peachi.line('สุขสันต์วันฮาโลวีน มอด! คืนนี้คืนสุดท้ายแล้ว…'));
    this.at(0.35, () => {
      UI.chat.push({ user: POP_USER, text: 'หมูกระทะหมดแล้วนะ… มีขนมมั้ย', type: 'superchat', amount: 20 });
      sfx.play('superchat');
      UI.toast('ผีปอบกินขนมในครัว (ป้ายบนชั้นบอกว่าเหลือเท่าไหร่) ขนมหมดเมื่อไหร่… มันจะหิวหามอด');
    });
    this.at(0.6, () => { this.reqTimer = rand(25, 40); });
    this.at(1.0, () => this._redLight());
    this.at(2.0, () => this._pendantHint());
    this.at(2.5, () => { this.fake.begin(); this.bot(BOT.fake); });
    this.at(2.75, () => { this.krasue.enter(); this.chat('กระสือ_Official', 'แวะมาเอาค่าตัวค่ะ… ลูกพีชอยู่ไหนคะ ✨'); });
    this.at(3.0, () => {
      this.chat('เธอ', HER.n3, 'her'); sfx.play('whisper');
      if (!this.waiting.shown) this.mannequin.appear(V(8.6, 0, 0.35));
    });
    this.at(3.3, () => { if (this.krasue.active) { this.krasue.leave(9999); this.chat('กระสือ_Official', 'ไม่มีค่าตัว ไม่อยู่ค่ะ บ๊ายบาย~'); } });
    this.at(3.5, () => this._strapHint());
    this.at(4.0, () => this._openWaiting());
    this.at(4.6, () => this.chat('นอนไม่หลับ', 'ง่วงแล้ว… แต่จะดูจนจบนะมอด'));
    this.at(5.0, () => {
      this.level.setFlicker(true);
      setTimeout(() => { if (this.state === 'play' && !this.peachi.isAngry) this.level.setFlicker(false); }, 2600);
      this.bot(BOT.n3Hour5);
      if (this._count('placed') >= 3) this._teaser();
      else UI.toast('ตีห้าแล้ว! รีบเอาชิ้นส่วนไปวางที่โต๊ะสตรีมให้ครบ');
    });
  }

  onAbort() {
    this._cleanup();
    this.pop.reset();
    this.fake.stop();
    this.mannequin.reset();
    this.krasue.reset();
    this.waiting.reset();
  }

  _end() {
    super._end();
    this.redlight.stop();
    this.krasue.freeze();
    this._cleanup();
  }

  _cleanup() {
    this.redlight.stop();
    this.hand.visible = false;
    this.player.speedMul = 1;
    this.requests.freeSnacks = false;
    this.doors.onKeyhole = null;
    UI.setHunger(null);
    UI.setInventory([]);
    for (const m of this.mirrors) m.visible = false;
    try { ambient.setRain(0); } catch (e) { /* no audio */ }
  }

  inSafeRoom() { return this.waiting.shown && this.level.roomAt(this.player.position) === 'bedroom'; }
  otherJumpscare() { return this.pop.state === 'jumpscare' || this.fake.state === 'lunge'; }
  jumpscareUpdate(dt, t) {
    const ctx = this._ghostCtx();
    if (this.pop.state === 'jumpscare') this.pop.update(dt, t, ctx);
    if (this.fake.state === 'lunge') this.fake.update(dt, t, ctx);
  }

  loseCard(reason) {
    if (reason === 'timeout') return { title: 'ตีหก… ไลฟ์ถาวร', text: 'โชคเกอร์ยังไม่ครบ 3 ชิ้น ไลฟ์ครบ 249 ชั่วโมงแล้ว PeachiBot เปลี่ยนชื่อช่องเป็น "PeachiBot 24/7"' };
    return super.loseCard(reason);
  }

  // ---------------------------------------------------------------- the phone
  goalRows() {
    const rows = [];
    const st = { hidden: 'ยังไม่เจอ', inside: 'ยังไม่เจอ', box: 'ยังไม่เจอ', out: 'หล่นอยู่ที่ศาล!', held: 'ถืออยู่', placed: 'วางแล้ว ✓' };
    rows.push({ text: `โชคเกอร์ ${this._count('placed')}/3 วางที่โต๊ะสตรีม`, kind: 'goal' });
    rows.push({ text: `1 · จี้หัวใจ: ${st[this.pieces.pendant]}`, sub: this.hour >= 2 && this.pieces.pendant === 'hidden' ? 'มองหาในกระจกโถงทางเดิน' : null, done: this.pieces.pendant === 'placed' });
    rows.push({ text: `2 · สายโชคเกอร์: ${st[this.pieces.strap]}`, sub: this.pieces.strap === 'inside' ? 'น้ำแดงจากตู้เย็น → ไหว้ศาลพระภูมิ → ผีปอบเรอ' : null, done: this.pieces.strap === 'placed' });
    rows.push({ text: `3 · ตัวล็อก: ${st[this.pieces.lock]}`, sub: this.pieces.lock === 'box' ? (this.waiting.shown ? 'ห้องแขกเปิดแล้ว' : 'ห้องแขกยังล็อก (เปิดตีสี่)') : null, done: this.pieces.lock === 'placed' });
    rows.push({ text: `ขนมในครัวเหลือ ${this.snacks.count}`, sub: `ผีปอบหิว ${Math.round(this.pop.hunger)}%${this.pop.calmT > 0 ? ' · อิ่มน้ำแดงอยู่' : ''}`, urgent: this.snacks.count <= 2 });
    return rows;
  }

  mapInfo() {
    const icons = [{ x: 0.9, z: 1.9, icon: '🍬' }, { x: -9.2, z: 5.7, icon: '🥤' }, { x: 3.5, z: 6.1, icon: '⛩' }];
    if (this.pieces.strap === 'out') icons.push({ x: this.strap.position.x, z: this.strap.position.z, icon: '💗' });
    const pp = this.player.position;
    if (this.pop.active && Math.hypot(this.pop.position.x - pp.x, this.pop.position.z - pp.z) < 10) icons.push({ x: this.pop.position.x, z: this.pop.position.z, icon: '👹' });
    let hint = 'ขนมเหลือน้อยเมื่อไหร่ เอาน้ำแดงไปไหว้ศาล ผีปอบจะอิ่มไป 90 วิ';
    if (this.pieces.pendant === 'hidden' && this.hour >= 2) hint = 'จี้หัวใจเห็นได้แค่ในกระจกโถง (หน้าโต๊ะคอนโซล)';
    else if (this.waiting.shown && this.pieces.lock === 'box') hint = 'ห้องแขกเปิดแล้ว… ในนั้นผีเข้าไม่ได้';
    return { hint, icons };
  }

  subjects() {
    const list = super.subjects();
    const P = this.pop;
    if (P.active && P.group.visible) list.push({
      kind: 'pop', id: 'pop', pos: P.headPos(), base: 45, facing: () => true,
      special: () => P.state === 'eat' || P.state === 'drink',
      caption: (h) => (h.special ? 'ผีปอบกำลังกิน (ห้ามรบกวน)' : P.hunting ? 'ผีปอบหิวโซ วิ่งมาแล้ว!!' : 'คุณตาผีปอบ'),
    });
    if (this.fake.visible && this.fake.state !== 'smoke') list.push({ kind: 'fake', id: 'fake', pos: V(this.fake.position.x, 1.2, this.fake.position.z), base: 60, caption: 'ตัวปลอม!! (ในรูปเป็นเงาดำ)' });
    if (this.mannequin.group.visible) list.push({ kind: 'mannequin', id: 'mannequin', pos: this.mannequin.group.position.clone().setY(1.3), base: 30, caption: 'หุ่นโชว์… ขยับได้?' });
    if (this.krasue.visible && this.krasue.state !== 'off') list.push({ kind: 'krasue', id: 'krasue', pos: this.krasue.position.clone(), base: 45, special: () => this.krasue.state === 'pose', caption: 'กระสือแวะมาทวงค่าตัว' });
    return list;
  }

  onPhotoTaken(photo) {
    if (photo.hits.some((h) => h.kind === 'fake')) {
      this.fake.flashDark(0.3);
      setTimeout(() => { if (this.state === 'play') this.fake.burst('photo', this.player); }, 250);
      photo.caption = 'ตัวปลอม!! กล้องเห็นเป็นเงาดำ';
    }
  }

  onScream() {
    super.onScream();
    if (this.state !== 'play' || this.hide.hidden) return;
    const pp = this.player.position;
    if (this.pop.active && Math.hypot(this.pop.position.x - pp.x, this.pop.position.z - pp.z) < 7 && this.pop.stun(2)) this.chat(pick(HYPE), 'ผีปอบสะดุ้ง 555');
    if (this.fake.active && Math.hypot(this.fake.position.x - pp.x, this.fake.position.z - pp.z) < 7) this.fake.burst('scream', this.player);
  }

  // ---------------------------------------------------------------- update
  _ghostCtx() {
    const pp = this.player.position;
    return {
      player: this.player, camera: this.camera, hour: this.hour, hidden: this.hide.hidden, safe: this.inSafeRoom(),
      snacks: this.snacks, soda: this.soda.onShrine, drinkSoda: () => this._sodaDrunk(),
      peachi: this.peachi, popRoom: this.pop.active ? this.level.roomAt(this.pop.position) : null,
      lures: [], cameraUp: this.phone.cameraUp, playerHidden: this.hide.hidden || this.inSafeRoom(), pp,
    };
  }

  onUpdate(dt, t) {
    const ctx = this._ghostCtx();
    const { player, camera } = this;
    this.pop.update(dt, t, ctx);
    if (this.state !== 'play') return;
    this.fake.update(dt, t, ctx);
    if (this.state !== 'play') return;
    this.mannequin.update(dt, ctx);
    this.krasue.update(dt, t, ctx);
    this.waiting.update(dt, t, player);

    // the Room of Waiting: first step inside
    const inBed = this.level.roomAt(player.position) === 'bedroom';
    if (this.waiting.shown && inBed && !this.waiting.entered) this._enterWaiting();
    if (inBed !== this.inWaiting) { this.inWaiting = inBed; try { ambient.setRain(1, inBed ? 1 : 0); } catch (e) { /* */ } }

    // red light, green light
    this._maybeRedLight();
    const r = this.redlight.update(dt);
    if (r) this._redLightDone(r);

    // requests (her hungry request eats from the same rack)
    this.reqTimer -= dt;
    if (this.reqTimer <= 0 && !this.requests.active && !this.peachi.isAngry && !this.hide.hidden && !this.redlight.active) {
      const kinds = ['hungry', 'lonely', 'dark'].filter((k) => k !== this.lastReq && (k !== 'hungry' || this.snacks.count > 0));
      const k = pick(kinds);
      if (this.requests.start(k)) this.lastReq = k;
      this.reqTimer = rand(70, 90);
    }

    // rain + lightning
    this.thunderT -= dt;
    if (this.thunderT <= 0) {
      this.thunderT = rand(22, 42);
      this.level.lightning(0.4);
      setTimeout(() => this.state === 'play' && sfx.play('thunder', { vol: this.inWaiting ? 0.4 : 1 }), 400 + Math.random() * 1400);
    }

    this._updateMirrors();
    this._updateStrap(dt);
    if (this.pendant.visible) { this.pendant.rotation.z = Math.sin(t * 1.3) * 0.12; this.pendantHalo.material.opacity = 0.7 + 0.3 * Math.sin(t * 4); }
    this._hud();
  }

  idleUpdate(dt, t) {
    this.waiting.update(dt, t, this.player);
    if (this.krasue.visible) this.krasue.update(dt, t, {});
  }

  _hud() {
    const P = this.pop;
    const show = P.active && (P.inView(this.camera) || Math.hypot(P.position.x - this.player.position.x, P.position.z - this.player.position.z) < 5);
    UI.setHunger(show ? P.hunger : null);
    const inv = [];
    if (this.soda.held) inv.push({ icon: '🥤', label: 'น้ำแดง' });
    if (this.requests.snack) inv.push({ icon: '🍬', label: this.requests.snack.name });
    const names = { pendant: 'จี้หัวใจ', strap: 'สายโชคเกอร์', lock: 'ตัวล็อก' };
    for (const k of ['pendant', 'strap', 'lock']) if (this.pieces[k] === 'held') inv.push({ icon: '💗', label: names[k] });
    UI.setInventory(inv);
  }

  // ---------------------------------------------------------------- snacks, soda, Phi Pop
  _takeSnack() {
    if (this.snacks.count <= 0) return false;
    this.snacks.count--;
    this._drawSignNow();
    return true;
  }
  _drawSign(g, w, h) {
    g.fillStyle = '#1e2a22'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#8a6a44'; g.lineWidth = 10; g.strokeRect(0, 0, w, h);
    g.fillStyle = '#f0ece0'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '400 26px Sriracha, cursive'; g.fillText('ขนมเหลือ', w / 2, 40);
    const n = this.snacks ? this.snacks.count : SNACKS;
    g.font = '400 64px Sriracha, cursive'; g.fillStyle = n <= 2 ? '#ff8a8a' : '#f0ece0'; g.fillText(String(n), w / 2, 98);
    g.font = '400 16px Sriracha, cursive'; g.fillStyle = 'rgba(240,236,224,0.7)'; g.fillText('ผีปอบห้ามกินหมด!!', w / 2, 136);
  }
  _drawSignNow() { const t = this.signTex; const g = t.userData.ctx; g.clearRect(0, 0, 256, 150); this._drawSign(g, 256, 150); t.needsUpdate = true; }

  _popEnters() {
    this.doors.open('front');
    this.pop.enter();
    this.pop.onEntered = () => { this.doors.slam('front'); this.chat(POP_USER, 'สวัสดีหลานๆ… ขนมอยู่ครัวใช่มั้ย'); };
    sfx.play('bash', { vol: 0.5 });
  }

  _feedPop() {
    const s = this.requests.snack;
    if (!s) return;
    this.requests.snack = null;
    this.pop.feed(40);
    this.stats.fed++;
    this._addViewers(randInt(6, 12));
    if (this.stats.fed === 3) this.chat(pick(HYPE), 'มอดเลี้ยงผีปอบเก่งกว่าเลี้ยงตัวเอง');
  }

  _takeSoda() {
    if (this.soda.stock <= 0) { sfx.play('denied'); UI.toast('น้ำแดงหมดตู้แล้ว'); return; }
    this.soda.stock--; this.soda.held = true;
    this.hand.visible = true;
    sfx.play('pickup');
    UI.toast('ได้น้ำแดงแล้ว เอาไปวางที่ศาลพระภูมิในห้องนั่งเล่น');
  }
  _offerSoda() {
    if (!this.soda.held) return;
    this.soda.held = false; this.soda.onShrine = true;
    this.hand.visible = false;
    this.shrineSoda.visible = true;
    sfx.play('place');
    this.stats.sodas++;
    this.chat(pick(HYPE), 'ไหว้ศาลแล้ว ขอให้รอดนะมอด 🙏');
  }
  _sodaDrunk() { this.soda.onShrine = false; this.shrineSoda.visible = false; }

  _burp(at) {
    this.chat(POP_USER, 'เอิ๊กกก… ขอบใจหลาน อิ่มไปอีกพักนึง');
    this._addViewers(randInt(10, 16));
    if (this.pieces.strap === 'inside' && this.hour >= 2) {
      this.pieces.strap = 'out';
      this.strapOut = true;
      // it flies out in an arc and lands in front of the shrine
      this.strapFly = { t: 0, from: V(at.x, 1.35, at.z), to: V(SHRINE.x + 0.4, 0.02, SHRINE.z - 0.5) };
      this.strap.visible = true;
      this.strap.position.copy(this.strapFly.from);
      setTimeout(() => this.state === 'play' && this.chat(pick(HYPE), 'สายโชคเกอร์กระเด็นออกมา!!! อี๋'), 600);
    }
  }
  _updateStrap(dt) {
    const F = this.strapFly;
    if (!F) return;
    F.t += dt;
    const k = Math.min(1, F.t / 0.9);
    this.strap.position.lerpVectors(F.from, F.to, k);
    this.strap.position.y += Math.sin(k * Math.PI) * 0.6;
    this.strap.rotation.x += dt * 9;
    if (k >= 1) { this.strap.rotation.set(0, 0.4, 0); this.strapFly = null; sfx.play('place'); }
  }

  _in(room) { return this.level.roomAt(this.player.position) === room; }

  // ---------------------------------------------------------------- the pieces
  _count(state) { return Object.values(this.pieces).filter((s) => s === state).length; }
  _takePiece(which) {
    if (which === 'pendant') {
      if (this.pieces.pendant !== 'hidden') return;
      this.pieces.pendant = 'held'; this.pendant.visible = false;
      UI.flash('#ffc0dc'); sfx.play('found');
      this.peachi.line('จี้หัวใจ! มันอยู่ตรงนั้นจริงๆ ด้วย', 2600);
    } else if (which === 'strap') {
      if (this.pieces.strap !== 'out') return;
      this.pieces.strap = 'held'; this.strap.visible = false;
      sfx.play('squelch');
      UI.toast('ได้สายโชคเกอร์แล้ว (เช็ดก่อนนะ)');
    } else if (which === 'lock') {
      if (this.pieces.lock !== 'box') return;
      this.waiting.openBox();
      this.pieces.lock = 'held';
      sfx.play('found');
      UI.toast('ได้ตัวล็อกโชคเกอร์แล้ว');
      setTimeout(() => this.state === 'play' && this.chat('ลูกพีชน้อย_1702', 'รอมา 1,702 วัน รออีกคืนได้ ♡'), 1200);
    }
    this._addViewers(randInt(10, 18));
    this._objective();
  }
  _placePieces() {
    let n = 0;
    for (const k of ['pendant', 'strap', 'lock']) if (this.pieces[k] === 'held') { this.pieces[k] = 'placed'; this.deskSet.userData.parts[k].visible = true; n++; }
    if (!n) return;
    this.deskSet.visible = true;
    sfx.play('place');
    const total = this._count('placed');
    this.peachi.mood = Math.max(0, this.peachi.mood - 15 * n);
    if (total >= 3) {
      sfx.play('peachShine');
      UI.flash('#ffc0dc');
      this.peachi.line('ครบแล้ว!! โชคเกอร์ครบ 3 ชิ้น… ตีห้าบอทจะตื่น อยู่ด้วยกันก่อนนะมอด', 4200);
      if (this.hour >= 5) setTimeout(() => this._teaser(), 1200);
    } else UI.toast(`วางชิ้นส่วนแล้ว ${total}/3`);
    this._objective();
  }
  _objective() {
    const placed = this._count('placed');
    if (placed >= 3) UI.setObjective(this.hour >= 5 ? 'PeachiBot กำลังตื่น…' : 'โชคเกอร์ครบแล้ว! รอดให้ถึงตีห้า');
    else if (this._count('held') > 0) UI.setObjective(`เอาชิ้นส่วนไปวางที่โต๊ะสตรีม (${placed}/3)`);
    else UI.setObjective(`ตามหาชิ้นส่วนโชคเกอร์หัวใจ (${placed}/3)`);
  }

  // ---------------------------------------------------------------- 01:00 red light, green light
  _redLight() { this.rlWant = true; }
  _maybeRedLight() { // she only asks when she's calm and you're not hiding; after 01:48 she forgets about it
    if (!this.rlWant || this.redlight.active) return;
    if (this.hour > 1.8) { this.rlWant = false; return; }
    if (this.peachi.isAngry || this.hide.hidden || this.peachi.state === 'search') return;
    this.rlWant = false;
    this.requests.cancel();
    this.redlight.start();
  }
  _redLightDone(r) {
    this.rlDone = true;
    if (r === 'win') {
      this._addViewers(randInt(25, 35));
      this.peachi.mood = Math.max(0, this.peachi.mood - 30);
      this.peachi.line('ถึงแล้ว!! เก่งมาก… ให้คำใบ้นะ: ชิ้นแรกอยู่ในกระจก ตีสองไปส่องกระจกโถงดูนะ', 5000);
      this.chat(pick(HYPE), 'มอดนิ่งกว่าหุ่นอีก 555');
    } else {
      this.peachi.line(r === 'fail' ? 'ไม่เล่นแล้ว หึ! …แต่ชิ้นแรกอยู่ในกระจกนะ' : 'ไม่มาเล่นด้วยเลย… งอน', 3200);
      this.peachi.mood = Math.min(100, this.peachi.mood + (r === 'fail' ? 10 : 15));
    }
    this._objective();
  }

  // ---------------------------------------------------------------- 02:00 the pendant in the mirror
  _pendantHint() {
    this.pendant.visible = true;
    this.mirrorArmed = true;
    if (this.pieces.pendant === 'hidden') {
      this.peachi.line('ชิ้นแรก… จี้หัวใจ อยู่ในกระจกโถงทางเดิน ลองไปส่องดูสิ', 3600);
      UI.setObjective('ชิ้นที่ 1: ส่องกระจกโถงทางเดิน (หน้าโต๊ะคอนโซล)');
    }
  }
  _mirror(pos, w, h, ry) {
    const m = new Reflector(new THREE.PlaneGeometry(w, h), { textureWidth: 512, textureHeight: 512, color: 0x9aa2ac, clipBias: 0.003 });
    m.position.copy(pos); m.rotation.y = ry;
    m.camera.layers.enable(3);
    const draw = m.onBeforeRender;
    m.onBeforeRender = (r, s, c) => { const a = r.shadowMap.autoUpdate; r.shadowMap.autoUpdate = false; this.fake.withDark(() => draw(r, s, c)); r.shadowMap.autoUpdate = a; };
    m.visible = false;
    this.scene.add(m);
    this.mirrors.push(m);
    return m;
  }
  _updateMirrors() {
    if (!this.hallMirror) { this.hallMirror = this._mirror(HALL_MIRROR, 0.62, 0.86, 0); this.bathMirror = this._mirror(BATH_MIRROR, 0.6, 0.82, -Math.PI / 2); }
    const p = this.player.position, room = this.level.roomAt(p);
    const nearHall = room === 'hallway' && Math.hypot(p.x - HALL_MIRROR.x, p.z - HALL_MIRROR.z) < 5;
    const nearBath = room === 'bathroom' && Math.hypot(p.x - BATH_MIRROR.x, p.z - BATH_MIRROR.z) < 4.5;
    this.hallMirror.visible = nearHall && (this.mirrorArmed || this.fake.visible);
    this.bathMirror.visible = nearBath && this.fake.visible;
    if (this.mirrorArmed && this.pieces.pendant === 'hidden' && nearHall && !this.pendantSeen) {
      const fwd = this.camera.getWorldDirection(V());
      const to = V().subVectors(HALL_MIRROR, this.camera.position);
      const d = to.length();
      if (d < 2.6 && fwd.dot(to.normalize()) > 0.86) {
        this.pendantSeen = true;
        sfx.play('sparkle');
        UI.toast('ในกระจกมีจี้หัวใจแขวนอยู่ข้างหลัง… แต่หันไปไม่เห็น ลองเดินไปควานดู');
        this.chat(pick(HYPE), 'ในกระจกมีของวิบๆ ที่ผนังข้างหลังมอด!');
      }
    }
  }

  // ---------------------------------------------------------------- 03:30 the strap
  _strapHint() {
    if (this.pieces.strap !== 'inside') return;
    this.peachi.line('ชิ้นที่สอง… สายโชคเกอร์ ผีปอบกลืนเข้าไปแล้ว! เอาน้ำแดงจากตู้เย็นไปไหว้ศาล ให้มันเรอออกมา', 4800);
    UI.setObjective('ชิ้นที่ 2: น้ำแดงจากตู้เย็น → ไหว้ศาลพระภูมิ');
  }

  // ---------------------------------------------------------------- 04:00 the Room of Waiting
  _openWaiting() {
    this.mannequin.reset();
    this.waiting.show();
    this.doors.locked.delete('bedroom');
    this.doors.open('bedroom');
    sfx.play('creak', { len: 1.6 });
    this.peachi.line('ห้องแขก… เปิดเองได้ไง ห้องนั้นพีชชี่ไม่เคยกล้าเข้าไปเลย', 3600);
    if (this.pieces.lock === 'box') UI.setObjective('ชิ้นที่ 3: ห้องแขกเปิดแล้ว');
    UI.toast('ห้องแขกเปิดแล้ว… ผีเข้าไปในห้องนั้นไม่ได้');
  }
  _enterWaiting() {
    this.waiting.enter();
    this.hide.reset();
    this.chat(pick(HYPE), 'ห้องนี้คือ…');
    setTimeout(() => this.state === 'play' && this.chat('ลูกพีชน้อย_1702', 'ขีดบนผนังพวกนี้… 1,702 วันที่รอเลยเหรอ'), 1600);
    setTimeout(() => this.state === 'play' && this.chat('Master Tankhun', 'ทำเกมให้ฟรีครับ ♡ รอพีชชี่เหมือนกัน'), 3600);
    setTimeout(() => this.state === 'play' && this.peachi.line('ทุกคน… รอพีชชี่อยู่ตลอดเลยเหรอ… ขอโทษนะที่หายไปนาน', 4200), 5200);
  }

  // ---------------------------------------------------------------- 05:00: PeachiBot wakes up (to be continued)
  async _teaser() {
    if (this.teased || this.state !== 'play') return;
    this.teased = true;
    this.pop.leave(); this.chat(POP_USER, 'หมดเวลาคอลแลปแล้ว… ตาไปก่อนนะหลาน');
    await this.win({ clear: false });
  }

  async winScene() {
    const { cut, peachi, level } = this;
    Talk.stop();
    this.fake.stop();
    this.mannequin.reset();
    await cut.run(async (c) => {
      await c.fade(1, 450);
      level.setFlicker(false);
      level.setRoomLights('stream', true);
      peachi.group.visible = true;
      peachi.group.position.set(-6.35, 0, -5.35);
      peachi.group.rotation.y = 0.35;
      peachi._setPose('float'); peachi._setExpression('happy');
      peachi.lookOverride = null;
      this.deskSet.visible = true;
      for (const k of ['strap', 'pendant', 'lock']) this.deskSet.userData.parts[k].visible = true;
      c.set([-5.2, 1.5, -3.2], [-6.0, 1.1, -5.9]);
      await c.fade(0, 700);
      await c.say('peachi', 'โชคเกอร์ครบแล้ว… ถ้าใส่มันได้ พีชชี่จะกลับมาเป็นตัวเองเต็มตัว', { hold: 3000 });
      sfx.play('peachShine');
      await c.to([-5.6, 1.4, -5.9], [-5.73, 1.15, -6.66], 1.2);
      sfx.play('glitch', { n: 14 });
      level.setFlicker(true);
      c.shake = 0.014;
      await c.say('bot', BOT.claim, { hold: 3800 });
      this.bot(BOT.claim);
      c.shake = 0;
      await c.say('bot', 'ผีเคลม © จะมาพบท่านในอีกไม่ช้าค่ะ :)', { hold: 2600 });
      level.setFlicker(false);
      await c.to([-5.45, 1.45, -4.1], [-6.3, 1.3, -5.4], 1.0);
      peachi._setExpression('angry');
      await c.say('peachi', 'บอทนั่น… พีชชี่เป็นคนสร้างมันเองแหละ ตอนนั้นแค่อยากแกล้งคนเล่น', { hold: 3200 });
      await c.say('peachi', 'มอด… ช่วยพีชชี่อีกครั้งนะ ครั้งสุดท้ายแล้ว', { hold: 2800 });
      sfx.play('powerDown');
      await c.fade(1, 900);
    }, { skippable: true });
    UI.subtitle(null);
    UI.fade(0, 10);
  }

  winCard() {
    return {
      title: 'คืนที่ 3 · ยังไม่จบ',
      stamp: 'ต่อ…',
      text: 'โชคเกอร์หัวใจครบ 3 ชิ้น แต่ PeachiBot ตื่นเต็มตัวแล้ว บอสผีเคลม © และรุ่งเช้าของวันฮาโลวีน มาในอัปเดตถัดไป',
      retry: 'เล่นคืนนี้อีกครั้ง',
    };
  }

  statRows() {
    return [
      ...super.statRows(),
      ['ป้อนขนมผีปอบ', `${this.stats.fed || 0} ครั้ง`],
      ['ไล่ตัวปลอม', `${this.stats.fakes || 0} ครั้ง`],
    ];
  }
}
