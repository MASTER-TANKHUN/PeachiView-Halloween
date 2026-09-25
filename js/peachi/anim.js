// Procedural pose animation for the Peachi rig (nested Groups, no skinning).
// Pose params blend toward the active pose's targets every frame; hair/skirt/strap motion is done
// in the vertex shader through the shared uniforms (uFlare, uSwayK).

export const POSES = ['idle', 'float', 'reach', 'jumpscare'];

// hover = float height (m), lean = torso pitch forward, lunge = forward offset (m),
// armPitch = shoulder rotation.x (negative = forward/up), armSpread = outward, elbow = forearm bend,
// wrist = hands flared outward, legSwing = thighs forward, knee = shin bend back, foot = toes down,
// flare = hair/skirt lift, sway = hair/skirt sway energy, shake = jitter.
const TARGETS = {
  idle:      { hover: 0.08, bobAmp: 0.02, bobSpd: 1.6, lean: 0.00, lunge: 0.00, armPitch: 0.03, armSpread: 0.48, elbow: 0.16, wrist: 0.3, headTilt: 0.06, headPitch: 0.03, headScale: 1.0, legSwing: 0.06, knee: 0.14, foot: 0.3, flare: 0.00, sway: 1.0, shake: 0 },
  float:     { hover: 0.26, bobAmp: 0.05, bobSpd: 1.1, lean: 0.05, lunge: 0.00, armPitch: -0.2, armSpread: 0.72, elbow: 0.42, wrist: 0.45, headTilt: -0.12, headPitch: -0.04, headScale: 1.0, legSwing: 0.16, knee: 0.55, foot: 0.55, flare: 0.25, sway: 1.6, shake: 0 },
  reach:     { hover: 0.12, bobAmp: 0.025, bobSpd: 2.2, lean: 0.2, lunge: 0.08, armPitch: -1.3, armSpread: 0.2, elbow: 0.12, wrist: -0.15, headTilt: 0.00, headPitch: 0.12, headScale: 1.0, legSwing: 0.25, knee: 0.45, foot: 0.45, flare: 0.3, sway: 1.8, shake: 0 },
  jumpscare: { hover: 0.04, bobAmp: 0.00, bobSpd: 0.0, lean: 0.26, lunge: 0.32, armPitch: -2.05, armSpread: 0.62, elbow: 0.55, wrist: 0.35, headTilt: 0.28, headPitch: 0.1, headScale: 1.25, legSwing: 0.4, knee: 0.85, foot: 0.6, flare: 1.0, sway: 2.6, shake: 1 },
};

const MOOD = { // small additive modifiers per expression
  happy:  { headPitch: 0, tremble: 0, sob: 0 },
  cry:    { headPitch: 0.14, tremble: 0, sob: 1 },
  angry:  { headPitch: 0.05, tremble: 0.4, sob: 0 },
  scream: { headPitch: -0.1, tremble: 1, sob: 0 },
};

/**
 * rig: { root, hips, torso, head, arms: [{ shoulder, elbow, hand, side }], legs: [{ hip, knee, ankle, side }] }
 * opts.U: shared shader uniforms (uFlare, uSwayK). opts.ghost=false keeps her standing on the floor.
 */
export function createAnimator(rig, { ghost = true, U } = {}) {
  let pose = 'idle', mood = 'happy';
  const cur = { ...TARGETS.idle };
  const m = { ...MOOD.happy };

  function apply(t) {
    const grounded = !ghost && pose === 'idle';
    const hover = ghost ? cur.hover : Math.max(0, cur.hover - 0.08);
    const bobAmp = ghost ? cur.bobAmp : cur.bobAmp * 0.2;
    const shake = cur.shake + m.tremble * 0.15;
    const jit = () => (Math.random() - 0.5) * shake;

    rig.root.position.set(jit() * 0.02, hover + Math.sin(t * cur.bobSpd) * bobAmp, cur.lunge + jit() * 0.02);
    rig.root.rotation.y = Math.sin(t * 0.5) * 0.04 * (1 - cur.shake);

    const breathe = Math.sin(t * 2.1) * 0.01 + m.sob * Math.sin(t * 13) * 0.012;
    rig.torso.rotation.x = cur.lean + breathe;
    rig.torso.rotation.z = Math.sin(t * 0.9) * 0.02;
    rig.hips.rotation.z = -Math.sin(t * 0.9) * 0.012;

    rig.head.rotation.x = cur.headPitch + m.headPitch + jit() * 0.05;
    rig.head.rotation.z = cur.headTilt + Math.sin(t * 1.3) * 0.04 + jit() * 0.08;
    rig.head.rotation.y = Math.sin(t * 0.7) * 0.07 * (1 - cur.shake);
    rig.head.scale.setScalar(cur.headScale);

    for (const a of rig.arms) {
      const sway = Math.sin(t * 1.7 + a.side) * 0.04;
      a.shoulder.rotation.x = cur.armPitch + sway + jit() * 0.1;
      a.shoulder.rotation.z = a.side * cur.armSpread;
      a.elbow.rotation.x = -cur.elbow + Math.sin(t * 2.3 + a.side) * 0.03;
      a.hand.rotation.z = a.side * cur.wrist;
      a.hand.rotation.x = -0.1 + Math.sin(t * 1.9 + a.side * 2) * 0.05;
    }
    for (const l of rig.legs) {
      const lead = l.side > 0 ? 1 : 0.6;
      const kick = grounded ? 0 : Math.sin(t * 1.2 + (l.side > 0 ? 0 : Math.PI)) * 0.07 * (hover > 0.04 ? 1 : 0);
      l.hip.rotation.x = grounded ? 0 : -cur.legSwing * lead + kick;
      l.hip.rotation.z = l.side * 0.07;
      l.knee.rotation.x = grounded ? 0 : cur.knee * (l.side > 0 ? 1 : 0.75) + kick * 0.6;
      l.ankle.rotation.x = grounded ? 0 : cur.foot;
      l.ankle.rotation.z = -l.side * 0.07;
    }
    if (U) {
      U.uFlare.value = cur.flare;
      U.uSwayK.value = cur.sway * (0.8 + 0.2 * Math.sin(t * 0.6));
    }
  }

  return {
    get pose() { return pose; },
    setPose(name) { if (TARGETS[name]) pose = name; },
    setMood(name) { if (MOOD[name]) mood = name; },
    update(dt, t) {
      const rate = pose === 'jumpscare' ? 14 : 5;
      const k = 1 - Math.exp(-Math.min(dt, 0.1) * rate);
      const tgt = TARGETS[pose];
      for (const key in tgt) cur[key] += (tgt[key] - cur[key]) * k;
      const mt = MOOD[mood], k2 = 1 - Math.exp(-Math.min(dt, 0.1) * 4);
      for (const key in mt) m[key] += (mt[key] - m[key]) * k2;
      apply(t);
    },
  };
}
