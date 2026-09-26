// Procedural animation for Peachi. Body parameters blend between poses; arms are driven by two-bone IK
// toward hand targets (torso space) so she can wave, wipe her tears, put her hands on her hips, reach
// for you, or clutch her cheeks; the head turns to look at a target; the body leans into its motion.
import * as THREE from 'three';

export const POSES = ['idle', 'float', 'reach', 'stunned', 'jumpscare'];

// body targets per pose. legBack > 0 swings the legs behind her; knee bends the shins back.
const TARGETS = {
  idle:      { hover: 0.06, bobAmp: 0.018, bobSpd: 1.5, lean: 0.02, lunge: 0.0, legBack: 0.02, knee: 0.16, foot: 0.25, flare: 0.0, sway: 1.0, shake: 0, hipSway: 1.0, tilt: 0.1, headScale: 1 },
  float:     { hover: 0.18, bobAmp: 0.045, bobSpd: 1.1, lean: 0.06, lunge: 0.0, legBack: 0.16, knee: 0.62, foot: 0.55, flare: 0.2, sway: 1.5, shake: 0, hipSway: 0.4, tilt: 0.06, headScale: 1 },
  reach:     { hover: 0.12, bobAmp: 0.02, bobSpd: 2.2, lean: 0.22, lunge: 0.08, legBack: 0.3, knee: 0.75, foot: 0.6, flare: 0.35, sway: 2.0, shake: 0, hipSway: 0.2, tilt: 0.0, headScale: 1 },
  stunned:   { hover: 0.1, bobAmp: 0.012, bobSpd: 4.0, lean: -0.2, lunge: -0.04, legBack: -0.1, knee: 0.55, foot: 0.4, flare: 0.3, sway: 2.2, shake: 0.18, hipSway: 0.0, tilt: 0.22, headScale: 1 },
  jumpscare: { hover: 0.04, bobAmp: 0.0, bobSpd: 0.0, lean: 0.26, lunge: 0.32, legBack: 0.45, knee: 0.9, foot: 0.6, flare: 1.0, sway: 2.6, shake: 1, hipSway: 0.0, tilt: 0.28, headScale: 1.25 },
};
const MOOD = { // additive
  happy:  { headPitch: 0.0, shrug: 0.0, sob: 0, tremble: 0 },
  cry:    { headPitch: 0.22, shrug: 0.012, sob: 1, tremble: 0 },
  angry:  { headPitch: 0.08, shrug: 0.008, sob: 0, tremble: 0.35 },
  scream: { headPitch: -0.08, shrug: 0.016, sob: 0, tremble: 1 },
};

// hand targets (wrist position, torso space, side s = ±1 = model x) and elbow pole directions
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const ARM = {
  down:   (s, t) => [V(s * 0.2, -0.19 + 0.006 * Math.sin(t * 1.5 + s), 0.03), V(s * 0.4, 0, -1)],
  glide:  (s, t) => [V(s * 0.3, -0.1 + 0.02 * Math.sin(t * 1.1 + s * 0.8), -0.08), V(s * 0.3, 0.2, -1)],
  clasp:  (s, t) => [V(s * 0.03, -0.12 + 0.01 * Math.sin(t * 1.5), 0.17), V(s, -0.4, -0.5)],
  behind: (s, t) => [V(s * 0.06, -0.13, -0.15 + 0.005 * Math.sin(t * 1.5)), V(s, -0.3, -0.3)],
  wave:   (s, t) => [V(s * 0.25 + s * 0.045 * Math.sin(t * 8.5), 0.44 + 0.015 * Math.sin(t * 17), 0.09), V(s, -0.6, 0.1)],
  wipe:   (s, t, k) => [V(s * 0.085, 0.36 + 0.014 * Math.sin(t * 9 + k * 3), 0.13), V(s * 1, -1, -0.3)],
  chest:  (s, t) => [V(s * 0.05, 0.12 + 0.01 * Math.sin(t * 3), 0.16), V(s * 0.8, -1, -0.2)],
  cheeks: (s, t) => [V(s * 0.1, 0.33 + 0.008 * Math.sin(t * 20 + s), 0.075), V(s, -1, -0.3)],
  hips:   (s) => [V(s * 0.165, -0.03, 0.0), V(s, 0.1, -0.3)],
  fists:  (s, t) => [V(s * 0.17, 0.0 + 0.07 * Math.sin(t * 7 + (s > 0 ? 0 : Math.PI)), 0.18), V(s * 0.5, -1, -0.4)],
  reach:  (s, t) => [V(s * 0.13, 0.24 + 0.03 * Math.sin(t * 3 + s), 0.52), V(s * 0.6, -1, -0.2)],
  wide:   (s, t) => [V(s * 0.42, 0.4 + 0.03 * Math.sin(t * 25 + s), 0.3), V(s * 0.3, -1, -0.5)],
  guard:  (s, t) => [V(-s * 0.02, 0.37 + 0.01 * Math.sin(t * 6 + s), 0.24), V(s, -1, 0)],
};

/**
 * rig: { root, hips, torso, head, arms: [{ shoulder, elbow, hand, side }], legs: [{ hip, knee, ankle, side }] }
 * opts.U: shared shader uniforms (uFlare, uSwayK). opts.ghost=false keeps her standing on the floor.
 */
export function createAnimator(rig, { ghost = true, U, upper = 0.255, fore = 0.225 } = {}) {
  let pose = 'idle', mood = 'happy';
  const cur = { ...TARGETS.idle };
  const m = { ...MOOD.happy };
  const look = { target: null, yaw: 0, pitch: 0, twist: 0 };
  const vel = new THREE.Vector3();
  const speedS = { v: 0 };
  const arms = rig.arms.map((a) => ({
    ...a,
    rest: a.shoulder.position.clone(),
    tgt: V(a.side * 0.2, -0.19, 0.03), pole: V(a.side * 0.4, 0, -1),
    handZ: 0,
  }));
  // idle gesture cycle (happy)
  const gest = { name: 'clasp', t: 0, dur: 5, cryHand: 1 };
  const HAPPY = [['clasp', 5], ['wave', 2.8], ['behind', 5], ['down', 3.5], ['clasp', 4], ['behind', 4], ['wave', 2.4]];
  let gi = 0;

  // ---------------------------------------------------------------- two-bone IK
  const _d = V(), _p = V(), _u = V(), _f = V(), _x = V(), _y = V(), _z = V(), _m = new THREE.Matrix4();
  function solveArm(a) {
    const S = a.shoulder.position;
    _d.copy(a.tgt).sub(S);
    let dist = _d.length();
    if (dist < 1e-4) return;
    _d.divideScalar(dist);
    dist = THREE.MathUtils.clamp(dist, 0.08, upper + fore - 0.002);
    const cosA = THREE.MathUtils.clamp((upper * upper + dist * dist - fore * fore) / (2 * upper * dist), -1, 1);
    const A = Math.acos(cosA);
    _p.copy(a.pole).addScaledVector(_d, -a.pole.dot(_d));
    if (_p.lengthSq() < 1e-6) _p.set(0, -1, 0).addScaledVector(_d, _d.y);
    _p.normalize();
    _u.copy(_d).multiplyScalar(Math.cos(A)).addScaledVector(_p, Math.sin(A)).normalize();      // upper arm direction
    _f.copy(_d).multiplyScalar(dist).addScaledVector(_u, -upper).normalize();                   // forearm direction
    _y.copy(_u).negate();
    _z.copy(_f).addScaledVector(_u, -_f.dot(_u));
    if (_z.lengthSq() < 1e-6) _z.copy(_p).addScaledVector(_u, -_p.dot(_u));
    _z.normalize();
    _x.crossVectors(_y, _z);
    _m.makeBasis(_x, _y, _z);
    a.shoulder.quaternion.setFromRotationMatrix(_m);
    a.elbow.rotation.set(-Math.acos(THREE.MathUtils.clamp(_u.dot(_f), -1, 1)), 0, 0);
  }

  // which arm pose each side should hold right now
  function armPlan(t) {
    const moving = speedS.v > 0.35;
    if (pose === 'jumpscare') return ['wide', 'wide'];
    if (pose === 'reach') return ['reach', 'reach'];
    if (pose === 'stunned') return ['guard', 'guard'];
    if (mood === 'scream') return ['cheeks', 'cheeks'];
    if (mood === 'angry') return moving ? ['fists', 'fists'] : ['hips', 'hips'];
    if (mood === 'cry') return gest.cryHand > 0 ? ['chest', 'wipe'] : ['wipe', 'chest'];
    if (moving && pose === 'float') return ['glide', 'glide'];
    const g = gest.name;
    if (g === 'wave') return ['wave', 'down'];      // her right hand (−x) waves
    return [g, g];
  }

  function apply(t, dt) {
    const grounded = !ghost && pose === 'idle';
    const hover = ghost ? cur.hover : Math.max(0, cur.hover - 0.08);
    const bobAmp = ghost ? cur.bobAmp : cur.bobAmp * 0.2;
    const shake = cur.shake + m.tremble * 0.12;
    const jit = () => (Math.random() - 0.5) * shake;

    // lean into the motion (local velocity), recoil when stunned
    const fwd = THREE.MathUtils.clamp(vel.z, -2, 2), side = THREE.MathUtils.clamp(vel.x, -2, 2);
    rig.root.position.set(jit() * 0.02, hover + Math.sin(t * cur.bobSpd) * bobAmp, cur.lunge + jit() * 0.02);
    rig.root.rotation.set(fwd * 0.12, Math.sin(t * 0.5) * 0.04 * (1 - cur.shake), -side * 0.1);

    const breathe = Math.sin(t * 2.1) * 0.012 + m.sob * Math.sin(t * 13) * 0.014;
    const weight = Math.sin(t * 0.8) * cur.hipSway;
    rig.hips.rotation.set(0, weight * 0.05, weight * 0.035);
    rig.torso.rotation.set(cur.lean + breathe + m.headPitch * 0.25, look.twist, -weight * 0.03 + Math.sin(t * 0.9) * 0.015);

    // head: look target + playful tilt + mood pitch
    rig.head.rotation.set(
      -look.pitch + m.headPitch + jit() * 0.05 + Math.sin(t * 1.7) * 0.02,
      look.yaw - look.twist + Math.sin(t * 0.7) * 0.05 * (1 - cur.shake),
      cur.tilt * Math.sin(t * 0.55 + 0.6) + jit() * 0.08, 'YXZ');
    rig.head.scale.setScalar(cur.headScale);

    // arms: IK toward the planned hand targets, eased
    const plan = armPlan(t);
    const ka = 1 - Math.exp(-dt * (pose === 'jumpscare' ? 16 : 7));
    arms.forEach((a, i) => {
      const s = a.side;
      const key = plan[s < 0 ? 0 : 1];
      const [tg, pl] = ARM[key](s, t, i);
      tg.y += m.shrug * 0.5; tg.x += jit() * 0.02; tg.y += jit() * 0.02;
      a.tgt.lerp(tg, ka); a.pole.lerp(pl, ka);
      a.shoulder.position.copy(a.rest).setY(a.rest.y + m.shrug + m.sob * Math.max(0, Math.sin(t * 13)) * 0.006);
      solveArm(a);
      const hz = key === 'wave' ? s * (0.25 + 0.35 * Math.sin(t * 8.5)) : key === 'wide' ? s * 0.5 : key === 'reach' ? s * 0.15 : key === 'hips' ? -s * 0.4 : 0;
      a.handZ += (hz - a.handZ) * ka;
      a.hand.rotation.set(key === 'fists' ? -0.6 : key === 'wide' ? -0.5 : -0.1, 0, a.handZ);
    });

    // legs
    for (const l of rig.legs) {
      const lead = l.side > 0 ? 1 : 0.7;
      const kick = grounded ? 0 : Math.sin(t * 1.3 + (l.side > 0 ? 0 : Math.PI)) * 0.08;
      if (grounded) { // contrapposto: weight shifts from leg to leg
        const w = Math.max(0, l.side * weight);
        l.hip.rotation.set(-0.02 - w * 0.08, 0, l.side * 0.05);
        l.knee.rotation.set(w * 0.28, 0, 0);
        l.ankle.rotation.set(-w * 0.18, 0, -l.side * 0.05);
        continue;
      }
      l.hip.rotation.set(cur.legBack * lead + kick + fwd * 0.12, 0, l.side * 0.05);
      l.knee.rotation.set(cur.knee * (l.side > 0 ? 1 : 0.8) + kick * 0.6 + Math.max(0, fwd) * 0.2, 0, 0);
      l.ankle.rotation.set(cur.foot, 0, -l.side * 0.05);
    }
    if (U) {
      U.uFlare.value = cur.flare + Math.min(0.3, speedS.v * 0.15);
      U.uSwayK.value = cur.sway * (0.8 + 0.2 * Math.sin(t * 0.6)) + speedS.v * 0.4;
    }
  }

  return {
    get pose() { return pose; },
    setPose(name) { if (TARGETS[name]) pose = name; },
    setMood(name) { if (MOOD[name]) mood = name; },
    /** target in torso space (Vector3) or null to look straight ahead */
    setLook(v) { look.target = v ? (look.target || V()).copy(v) : null; },
    /** local-space velocity of the model (m/s) */
    setVelocity(v) { vel.lerp(v, 0.2); },
    update(dt, t) {
      dt = Math.min(dt, 0.1);
      const rate = pose === 'jumpscare' ? 14 : 5;
      const k = 1 - Math.exp(-dt * rate);
      const tgt = TARGETS[pose];
      for (const key in tgt) cur[key] += (tgt[key] - cur[key]) * k;
      const mt = MOOD[mood], k2 = 1 - Math.exp(-dt * 4);
      for (const key in mt) m[key] += (mt[key] - m[key]) * k2;
      speedS.v += (vel.length() - speedS.v) * k2;
      // gestures
      gest.t += dt;
      if (gest.t > gest.dur) {
        gest.t = 0;
        if (mood === 'cry') { gest.cryHand = -gest.cryHand; gest.dur = 1.6 + Math.random(); } else { gi = (gi + 1) % HAPPY.length; [gest.name, gest.dur] = HAPPY[gi]; gest.dur *= 0.8 + Math.random() * 0.4; }
      }
      // look: yaw/pitch toward the target from the head pivot, limited, eased; the torso twists a little too
      let yaw = 0, pitch = 0;
      if (look.target) {
        const hx = rig.head.position.x, hy = rig.head.position.y + 0.09, hz = rig.head.position.z;
        const dx = look.target.x - hx, dy = look.target.y - hy, dz = look.target.z - hz;
        yaw = THREE.MathUtils.clamp(Math.atan2(dx, dz), -1.1, 1.1);
        pitch = THREE.MathUtils.clamp(Math.atan2(dy, Math.hypot(dx, dz)), -0.45, 0.4);
        if (dz < -0.2 && Math.abs(yaw) > 1.0) yaw = 0; // behind her: don't twist the neck around
      }
      const kl = 1 - Math.exp(-dt * 5);
      look.yaw += (yaw - look.yaw) * kl;
      look.pitch += (pitch - look.pitch) * kl;
      look.twist += (yaw * 0.3 - look.twist) * kl;
      apply(t, dt);
    },
  };
}
