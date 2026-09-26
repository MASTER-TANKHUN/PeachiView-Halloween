// Night 1 — 30 Oct, the live has run 246 hours. Find Peachi's cat-ear headphones and bring them back to
// the stream desk. Until then her voice comes through broken. Script: first request at 00:30, hiding at
// 01:00, the webcam at 02:00, the clock wakes up at 03:00 (and the headphones start playing music),
// "เธอ" at 04:00, the last hour at 05:00. Ending: she puts them on and speaks clearly for the first time —
// then PeachiBot refuses to end the stream.
import * as THREE from 'three';
import { NightBase, pick, rand, randInt } from './base.js';
import { buildHeadphonesItem } from '../peachi/model.js';
import { UI } from '../ui.js';
import { sfx } from '../audio.js';
import { Talk } from '../game/talk.js';
import { BOT, HER, STORIES } from '../data/story.js';

const OBJ_FIND = 'ตามหา "หูฟังหูแมว" ของพีชชี่ในบ้าน';
const OBJ_RETURN = 'เอาหูฟังไปวางคืนที่ "โต๊ะสตรีม"';
const HYPE = ['ลูกพีชน้อย_249', 'peachlover', 'นอนไม่หลับ', 'ลูกพีชซ่า'];
const WEBCAM = new THREE.Vector3(-5.73, 1.39, -6.6);
const MONITOR = new THREE.Vector3(-5.73, 1.153, -6.66);
const CLOCK = new THREE.Vector3(0.9, 1.5, 0.74); // pendulum clock in the hall

export class Night1 extends NightBase {
  get number() { return 1; }
  get secondsPerHour() { return 50; }
  get uptimeBase() { return 246; }

  constructor(ctx) {
    super(ctx);
    // the headphones live in their own holder so their bob/spin stays local
    this.item = buildHeadphonesItem();
    this.holder = new THREE.Group();
    this.holder.name = 'headphonesHolder';
    this.holder.add(this.item);
    this.holder.visible = false;
    this.scene.add(this.holder);
    this.webcam = null;
  }

  /** Card before the night starts. */
  introCard() {
    return {
      title: 'คืนที่ 1', clock: '00:00', date: '30 ตุลาคม  ·  ไลฟ์มาแล้ว 246 ชั่วโมง',
      text: 'หาหูฟังหูแมวของพีชชี่ แล้วเอาไปวางคืนที่โต๊ะสตรีมก่อนหกโมงเช้า',
      story: pick(STORIES),
    };
  }

  onStart() {
    const { level, player, peachi, doors } = this;
    this.carrying = false;
    this.placed = false;
    this.endTried = false;
    this.musicT = 3;
    this.clockT = 0;
    this.reqTimer = 999;
    this.webcam = null;

    // Peachi, before: pale, glowing, no headphones, a broken voice
    Talk.brokenPeachi = true;
    peachi.model.setHeadphones(false);
    peachi.model.setDesat(0.72);
    peachi.moodScale = 1;

    // the guest room is locked tonight (keyhole peek)
    doors.locked.clear();
    doors.locked.add('bedroom');
    level.setDoor('bedroom', false, { instant: true });
    doors.onKeyhole = () => {
      UI.keyhole();
      sfx.play('whisper');
      if (!this.keyholeSeen) { this.keyholeSeen = true; setTimeout(() => this.chat(pick(HYPE), 'ในรูกุญแจมีตามองกลับมา!!!'), 1200); }
    };

    // headphones at a random spot, away from the player, never in the locked room
    const spots = (level.itemSpots || []).filter((s) => level.roomAt(s) !== 'bedroom');
    const far = spots.filter((s) => s.distanceTo(player.position) > 6);
    const spot = (pick(far.length ? far : spots) || level.spawn.position).clone();
    this.itemSpot = spot;
    this._dropItem(spot);
    this.interact({
      position: spot.clone(), radius: 1.6, label: '[E] เก็บหูฟังหูแมว',
      onUse: () => this._pickup(),
      enabled: () => this.state === 'play' && !this.carrying && !this.placed,
    });
    this.interact({
      position: level.deskPosition.clone(), radius: 1.9, label: '[E] วางหูฟังคืนที่โต๊ะ',
      onUse: () => this._place(),
      enabled: () => this.state === 'play' && this.carrying,
    });
    // pressing "end stream" before anything is fixed: PeachiBot says no (a joke, the night goes on)
    this.interact({
      position: new THREE.Vector3(MONITOR.x, 1.0, MONITOR.z + 0.2), radius: 1.5, label: '[E] กดจบไลฟ์',
      onUse: () => this._tryEnd(),
      enabled: () => this.state === 'play' && !this.carrying && !this.endTried,
    });

    UI.setObjective(OBJ_FIND);
    this.bot(BOT.n1Hello);
    UI.toast('หาหูฟังหูแมว แล้วเอาไปคืนที่โต๊ะสตรีมก่อนตีหก!');

    // ---- the script
    this.at(0.04, () => peachi.line('ม-มอด… หูฟัง… หาย… ช่วยหาหน่อย'));
    this.at(0.5, () => {
      if (this.requests.start('hungry')) UI.toast('พีชชี่ขออะไรบางอย่าง! ทำให้ทันเวลา เธอจะอารมณ์ดีขึ้น');
      this.reqTimer = rand(75, 90);
    });
    this.at(1.0, () => {
      UI.toast('ถ้าพีชชี่โกรธ ซ่อนใต้เตียง ในตู้ หรือหลังม่านอาบน้ำได้ (E)');
      this.chat('มอดรุ่นพี่_RIP', 'ทิปจากรุ่นพี่: ซ่อนแล้วกลั้นหายใจนะ เธอได้ยินหมด');
    });
    this.at(1.25, () => {
      this.addMission({ id: 'photo1', text: 'ซุปแชต: ถ่ายรูปพีชชี่', sub: 'C / คลิกขวา ยกกล้อง แล้วคลิกถ่าย', ask: 'ถ่ายรูปพีชชี่ให้ดูหน่อยค่ะมอด! คิดถึงงง', photo: 'peachi', left: 100, reward: 30, amount: 100, thanks: 'รูปพีชชี่!! เซฟแล้ว ขอบคุณค่ะมอด' });
      UI.toast('ซุปแชตขอรูป! กด C หรือคลิกขวา ยกกล้อง แล้วคลิกถ่าย');
    });
    this.at(2.0, () => { this.webcam = { phase: 'wait', t: 0, shown: false }; this.chat(pick(HYPE), 'จอคอมพีชชี่ขึ้นภาพกล้องเว็บแคมแล้ว มอดไปดูหน่อยดิ'); });
    this.at(2.95, () => { if (this.webcam && this.webcam.phase === 'wait') this._webcamOff(); });
    this.at(3.0, () => {
      this._chime(3);
      UI.toast('ตีสามแล้ว… นาฬิกาลูกตุ้มกลับมาเดินเอง');
      if (!this.carrying) setTimeout(() => this.state === 'play' && UI.toast('ได้ยินเสียงเพลงเบาๆ มั้ย… หูฟังกำลังเล่นเพลงอยู่'), 3500);
    });
    this.at(4.0, () => { this.chat('เธอ', HER.n1, 'her'); sfx.play('whisper'); });
    this.at(4.35, () => this._slamNearby());
    this.at(5.0, () => {
      this.level.setFlicker(true);
      setTimeout(() => { if (this.state === 'play' && !this.peachi.isAngry) this.level.setFlicker(false); }, 2600);
      UI.toast('ชั่วโมงสุดท้าย! รีบเอาหูฟังไปคืน');
      this.bot(BOT.hour5);
    });
  }

  goalRows() { return [{ text: this.carrying ? OBJ_RETURN.replace(/"/g, '') : OBJ_FIND.replace(/"/g, ''), kind: 'goal' }]; }

  onAbort() {
    this.holder.visible = false;
    if (this.holder.parent !== this.scene) this.scene.add(this.holder);
    this.carrying = false;
    this._webcamOff(true);
    this.doors.onFront = null; this.doors.onKeyhole = null;
  }

  onUpdate(dt, t) {
    if (!this.carrying && this.item.userData.update) this.item.userData.update(dt, t);
    // more requests, whenever she's calm
    this.reqTimer -= dt;
    if (this.reqTimer <= 0 && !this.requests.active && !this.peachi.isAngry && !this.hide.hidden) {
      const kinds = ['dark', 'lonely', 'hungry'].filter((k) => k !== this.lastReq);
      const k = pick(kinds);
      if (this.requests.start(k)) this.lastReq = k;
      this.reqTimer = rand(75, 90);
    }
    // after 03:00 the clock ticks, and the lost headphones play music you can follow
    if (this.hour >= 3) {
      this.clockT -= dt;
      if (this.clockT <= 0) { this.clockT = 1.0; const p = this.panAt(CLOCK.x, CLOCK.z); if (p.dist < 9) sfx.play('tick', { pan: p.pan }); }
      if (!this.carrying && !this.placed) {
        this.musicT -= dt;
        if (this.musicT <= 0) {
          this.musicT = 5.5;
          const p = this.panAt(this.itemSpot.x, this.itemSpot.z);
          sfx.play('tinyMusic', { pan: p.pan, vol: Math.max(0.12, Math.min(1, 2.2 / (1 + p.dist * 0.3))) });
        }
      }
    }
    this._updateWebcam(dt);
  }

  idleUpdate(dt, t) {
    if (this.holder.visible && !this.carrying && this.item.userData.update) this.item.userData.update(dt, t);
  }

  // ---------------------------------------------------------------- headphones
  _dropItem(pos) {
    if (this.holder.parent !== this.scene) this.scene.add(this.holder);
    this.holder.position.set(pos.x, pos.y + 0.05, pos.z);
    this.holder.rotation.set(0, 0, 0);
    this.holder.scale.setScalar(1);
    this.holder.visible = true;
  }

  _pickup() {
    if (this.state !== 'play' || this.carrying || this.placed) return;
    this.carrying = true;
    sfx.play('pickup');
    this.camera.add(this.holder); // bottom-right of the view
    this.holder.position.set(0.3, -0.26, -0.6);
    this.holder.rotation.set(0.25, -0.6, 0);
    this.holder.scale.setScalar(0.55);
    UI.setObjective(OBJ_RETURN);
    UI.toast('ได้หูฟังหูแมวแล้ว! รีบเอาไปคืนที่โต๊ะสตรีม');
    this._addViewers(randInt(8, 15));
    this.chat(pick(HYPE), 'เจอหูฟังแล้ววว เก่งมากมอด!');
    this.peachi.onHeadphonesFound();
  }

  _place() {
    if (this.state !== 'play' || !this.carrying) return;
    this.carrying = false;
    this.placed = true;
    sfx.play('place');
    const d = this.level.deskPosition;
    this._dropItem(new THREE.Vector3(d.x, d.y < 0.5 ? 0.8 : d.y, d.z));
    this.win();
  }

  // ---------------------------------------------------------------- jokes
  _tryEnd() {
    this.endTried = true;
    sfx.play('endStream');
    UI.flash('#000');
    setTimeout(() => { sfx.play('glitch'); this.bot(BOT.endTry); UI.toast('ไลฟ์เริ่มใหม่อัตโนมัติ…'); this._addViewers(randInt(5, 10)); }, 900);
  }

  _chime(n) {
    const p = this.panAt(CLOCK.x, CLOCK.z);
    for (let i = 0; i < n; i++) setTimeout(() => sfx.play('doorbell', { pan: p.pan }), i * 1400);
  }

  _slamNearby() {
    const pp = this.player.position;
    const open = Object.values(this.level.doors).filter((d) => d.id !== 'front' && !this.doors.locked.has(d.id) && this.level.doorOpen(d.id));
    open.sort((a, b) => Math.hypot(a.center.x - pp.x, a.center.z - pp.z) - Math.hypot(b.center.x - pp.x, b.center.z - pp.z));
    const d = open.find((x) => Math.hypot(x.center.x - pp.x, x.center.z - pp.z) > 1.6);
    if (!d) return;
    this.doors.slam(d.id);
    UI.shake(250);
    this.chat(pick(HYPE), 'ประตูปิดเองงงง!!!');
  }

  // ---------------------------------------------------------------- 02:00: the webcam shows who's behind you
  _webcamSetup() {
    if (this._wc) return this._wc;
    const tex = this.level.screens && this.level.screens.main;
    let mesh = null;
    this.level.root.traverse((o) => { if (!mesh && o.isMesh && o.material && o.material.map === tex) mesh = o; });
    const rt = new THREE.WebGLRenderTarget(384, 216);
    rt.texture.colorSpace = THREE.SRGBColorSpace;
    const cam = new THREE.PerspectiveCamera(78, 16 / 9, 0.05, 30);
    cam.position.copy(WEBCAM);
    cam.lookAt(-5.3, 1.25, -3.2);
    cam.layers.enable(3);
    // the player, as the webcam sees them: a dark hoodie from behind
    const me = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ color: 0x1c1822 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.7, 4, 10), mat); body.position.y = 0.95; body.scale.set(1, 1, 0.7);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 10), mat); head.position.y = 1.58;
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.18, 14, 10), mat); hood.position.set(0, 1.56, 0.03);
    me.add(body, head, hood);
    me.traverse((o) => o.layers.set(3));
    me.visible = false;
    this.scene.add(me);
    this._wc = { mesh, tex, rt, cam, me };
    return this._wc;
  }

  _setPeachiLayer(layer) { this.peachi.group.traverse((o) => o.layers.set(layer)); }

  _updateWebcam(dt) {
    const W = this.webcam;
    if (!W || W.phase === 'done') return;
    const { player, camera, peachi, level } = this;
    const inRoom = level.roomAt(player.position) === 'stream';
    const wc = this._webcamSetup();
    if (!wc.mesh || !this.renderer) { W.phase = 'done'; return; }
    const show = inRoom || W.phase !== 'wait';
    if (show !== W.shown) {
      W.shown = show;
      wc.mesh.material.map = show ? wc.rt.texture : wc.tex;
      wc.mesh.material.needsUpdate = true;
      wc.me.visible = show;
      if (show) sfx.play('glitch', { n: 3 });
    }
    if (!show) return;
    wc.me.position.set(player.position.x, 0, player.position.z);
    wc.me.rotation.y = player.yaw;
    W.t += dt;

    const toMon = new THREE.Vector3().subVectors(MONITOR, camera.position);
    const dMon = toMon.length();
    const fwd = camera.getWorldDirection(new THREE.Vector3());
    const looking = fwd.dot(toMon.normalize()) > 0.9;

    if (W.phase === 'wait' && dMon < 2.8 && looking && !this.hide.hidden && !peachi.isAngry) {
      // she appears behind the player, only on the webcam
      W.phase = 'reveal'; W.t = 0;
      W.saved = { pos: peachi.position.clone(), active: peachi.active };
      peachi.active = false;
      const f = new THREE.Vector3(fwd.x, 0, fwd.z).normalize();
      W.at = new THREE.Vector3(player.position.x - f.x * 0.95 + f.z * 0.25, 0, player.position.z - f.z * 0.95 - f.x * 0.25);
      peachi.group.position.copy(W.at);
      peachi.group.rotation.y = Math.atan2(WEBCAM.x - W.at.x, WEBCAM.z - W.at.z);
      peachi.lookOverride = WEBCAM.clone();
      peachi._setExpression('happy'); peachi._setPose('idle');
      this._setPeachiLayer(3);
      sfx.play('whisper');
    } else if (W.phase === 'reveal') {
      const toHer = new THREE.Vector3(W.at.x - camera.position.x, 0, W.at.z - camera.position.z).normalize();
      const turned = new THREE.Vector3(fwd.x, 0, fwd.z).normalize().dot(toHer) > 0.2;
      if (turned || W.t > 4.5) {
        W.phase = 'gone'; W.t = 0;
        this._setPeachiLayer(0);
        peachi.lookOverride = null;
        const far = (level.navPoints || []).filter((p) => p.distanceTo(player.position) > 9);
        peachi.group.position.copy(pick(far) || W.saved.pos);
        peachi.active = W.saved.active;
        sfx.play('giggle');
        this._addViewers(randInt(25, 35));
        for (const [i, m] of ['ข้างหลัง!!!!!', 'เห็นมั้ยยยย', 'หันไปแล้วหายยย', 'คลิปนี้ต้องได้!!!'].entries()) setTimeout(() => this.state === 'play' && this.chat(pick(HYPE), m), 300 + i * 450);
      }
    } else if (W.phase === 'gone' && W.t > 2.5) {
      this._webcamOff();
    }
    W.frameT = (W.frameT || 0) - dt;
    if (this.webcam && this.webcam.phase !== 'done' && W.frameT <= 0) { // the webcam view at ~15 fps, no shadow-map refresh
      W.frameT = 1 / 15;
      const r = this.renderer, auto = r.shadowMap.autoUpdate;
      r.shadowMap.autoUpdate = false;
      r.setRenderTarget(wc.rt);
      r.render(this.scene, wc.cam);
      r.setRenderTarget(null);
      r.shadowMap.autoUpdate = auto;
    }
  }

  _webcamOff(silent) {
    const W = this.webcam;
    if (W && W.phase === 'reveal') { this._setPeachiLayer(0); this.peachi.lookOverride = null; this.peachi.active = W.saved.active; }
    if (this._wc) {
      if (this._wc.mesh) { this._wc.mesh.material.map = this._wc.tex; this._wc.mesh.material.needsUpdate = true; }
      this._wc.me.visible = false;
      if (W && W.shown && !silent) sfx.play('glitch', { n: 4 });
    }
    if (W) W.phase = 'done';
  }

  // ---------------------------------------------------------------- ending: she can hear again
  async winScene() {
    const { cut, peachi, level } = this;
    this._webcamOff(true);
    Talk.stop();
    await cut.run(async (c) => {
      await c.fade(1, 450);
      peachi.group.visible = true;
      peachi.group.position.set(-6.35, 0, -5.35);
      peachi.group.rotation.y = 0.35;
      peachi._setPose('float'); peachi._setExpression('happy');
      peachi.lookOverride = null;
      this.holder.visible = false;
      level.setFlicker(false);
      level.setRoomLights('stream', true);
      c.set([-5.25, 1.5, -3.35], [-6.2, 1.25, -5.45]);
      await c.fade(0, 700);
      await c.say('peachi', 'หูฟัง…!', { hold: 1400 });
      // on they go
      peachi.model.setHeadphones(true);
      peachi.model.setGlow(1);
      sfx.play('pickup');
      UI.flash('#ffd0e8');
      Talk.brokenPeachi = false;
      await c.wait(0.8);
      peachi.model.setGlow(0.35);
      await c.to([-5.45, 1.45, -4.1], [-6.3, 1.3, -5.4], 1.6);
      await c.say('peachi', 'ฮัลโหล? ฮัลโหลลล!', { clean: true });
      await c.say('peachi', 'มอด! ได้ยินพีชชี่แล้วใช่มั้ย!', { clean: true });
      await c.say('peachi', 'เสียงกลับมาแล้ววว ขอบคุณนะ… ไม่ได้ซึ้งนะ แค่ฝุ่นเข้าตา');
      await c.say('peachi', 'ฟังนะ ไลฟ์นี้พีชชี่ไม่ได้เปิดค้างเอง มีบอทตัวนึงไม่ยอมให้มันจบ');
      await c.say('peachi', 'มอดลองกดจบไลฟ์ให้หน่อยสิ ปุ่มแดงบนจอเลย!');
      await c.to([-5.6, 1.4, -5.9], [-5.73, 1.15, -6.66], 1.3);
      sfx.play('endStream');
      await c.wait(0.9);
      sfx.play('glitch', { n: 9 });
      c.shake = 0.01;
      await c.say('bot', BOT.cantEnd, { hold: 3400 });
      this.bot(BOT.cantEnd);
      c.shake = 0;
      await c.to([-5.45, 1.45, -4.1], [-6.3, 1.3, -5.4], 1.0);
      await c.say('peachi', '…เห็นมั้ย มันไม่ยอม', { hold: 2400 });
      await c.say('peachi', 'พรุ่งนี้มาอีกนะมอด ห้ามหนีล่ะ!', { hold: 2600 });
      sfx.play('powerDown');
      await c.fade(1, 900);
    }, { skippable: true });
    UI.subtitle(null);
    UI.fade(0, 10);
  }

  winCard() {
    return {
      title: 'คืนที่ 1 ผ่านแล้ว',
      stamp: 'ได้เสียงคืน',
      text: 'พีชชี่ได้ยินแชตอีกครั้ง แต่ PeachiBot ยังไม่ยอมให้ไลฟ์จบ… ไลฟ์มาแล้ว 246:59:59 และยังนับต่อ',
      retry: 'เล่นคืนนี้อีกครั้ง',
    };
  }
}
