// Procedural pose animation for the Peachi rig (nested Groups, no skinning).
// Pose params are blended toward the active pose's targets every frame.

export const POSES = ['idle', 'float', 'reach', 'jumpscare'];

// hover = float height of the whole body (m), lean = torso pitch forward, lunge = forward offset (m),
// armPitch = shoulder rotation.x (negative = forward/up), armSpread = outward, elbow = forearm bend,
// legSwing = thighs forward, knee = shin bend back, hairFlare = strands lifted outward, shake = jitter.
const TARGETS = {
  idle:      { hover: 0.10, bobAmp: 0.025, bobSpd: 1.6, lean: 0.00, lunge: 0.00, armPitch: -0.05, armSpread: 0.22, elbow: 0.25, headTilt: 0.07, headPitch: 0.02, headScale: 1.0, legSwing: 0.00, knee: 0.08, hairFlare: 0.00, shake: 0 },
  float:     { hover: 0.30, bobAmp: 0.06, bobSpd: 1.1, lean: 0.06, lunge: 0.00, armPitch: -0.30, armSpread: 0.60, elbow: 0.55, headTilt: -0.14, headPitch: -0.04, headScale: 1.0, legSwing: 0.15, knee: 0.60, hairFlare: 0.25, shake: 0 },
  reach:     { hover: 0.16, bobAmp: 0.03, bobSpd: 2.2, lean: 0.22, lunge: 0.10, armPitch: -1.45, armSpread: 0.10, elbow: 0.20, headTilt: 0.00, headPitch: 0.10, headScale: 1.0, legSwing: 0.25, knee: 0.50, hairFlare: 0.35, shake: 0 },
  jumpscare: { hover: 0.22, bobAmp: 0.00, bobSpd: 0.0, lean: 0.32, lunge: 0.45, armPitch: -2.45, armSpread: 0.55, elbow: 0.75, headTilt: 0.45, headPitch: 0.18, headScale: 1.3, legSwing: 0.45, knee: 0.90, hairFlare: 1.00, shake: 1 },
};

const MOOD = { // small additive modifiers per expression
  happy:  { headPitch: 0, tremble: 0, sob: 0 },
  cry:    { headPitch: 0.16, tremble: 0, sob: 1 },
  angry:  { headPitch: 0.06, tremble: 0.4, sob: 0 },
  scream: { headPitch: -0.12, tremble: 1, sob: 0 },
};

/**
 * rig: { root, torso, head, arms: [{ shoulder, elbow, side }], legs: [{ hip, knee, side }],
 *        hair: [pivot (userData.phase, userData.baseX)], straps: [pivot (userData.phase)] }
 */
export function createAnimator(rig, { ghost = true } = {}) {
  let pose = 'idle', mood = 'happy';
  const cur = { ...TARGETS.idle };
  const m = { ...MOOD.happy };

  function apply(t) {
    const hover = ghost ? cur.hover : Math.max(0, cur.hover - 0.1);
    const bobAmp = ghost ? cur.bobAmp : cur.bobAmp * 0.25;
    const shake = cur.shake + m.tremble * 0.15;
    const jit = () => (Math.random() - 0.5) * shake;

    rig.root.position.set(jit() * 0.02, hover + Math.sin(t * cur.bobSpd) * bobAmp, cur.lunge + jit() * 0.02);
    rig.root.rotation.y = Math.sin(t * 0.5) * 0.04 * (1 - cur.shake);

    const breathe = Math.sin(t * 2.1) * 0.012 + m.sob * Math.sin(t * 13) * 0.012;
    rig.torso.rotation.x = cur.lean + breathe;
    rig.torso.rotation.z = Math.sin(t * 0.9) * 0.025;

    rig.head.rotation.x = cur.headPitch + m.headPitch + jit() * 0.05;
    rig.head.rotation.z = cur.headTilt + Math.sin(t * 1.3) * 0.05 + jit() * 0.08;
    rig.head.rotation.y = Math.sin(t * 0.7) * 0.08 * (1 - cur.shake);
    rig.head.scale.setScalar(cur.headScale);

    for (const a of rig.arms) {
      const sway = Math.sin(t * 1.7 + a.side) * 0.05;
      a.shoulder.rotation.x = cur.armPitch + sway + jit() * 0.1;
      a.shoulder.rotation.z = a.side * cur.armSpread;
      a.elbow.rotation.x = -cur.elbow + Math.sin(t * 2.3 + a.side) * 0.04;
    }
    for (const l of rig.legs) {
      const kick = Math.sin(t * 1.2 + (l.side > 0 ? 0 : Math.PI)) * 0.08 * (hover > 0.05 ? 1 : 0);
      l.hip.rotation.x = -cur.legSwing * (l.side > 0 ? 1 : 0.6) + kick;
      l.knee.rotation.x = cur.knee * (l.side > 0 ? 1 : 0.75) + kick * 0.6;
    }
    for (const h of rig.hair) {
      const ph = h.userData.phase;
      h.rotation.x = h.userData.baseX - cur.hairFlare * 0.55 + Math.sin(t * 1.6 + ph) * 0.035 - Math.cos(t * cur.bobSpd) * bobAmp * 0.8;
      h.rotation.z = Math.sin(t * 1.2 + ph * 1.3) * 0.045 + jit() * 0.1;
    }
    for (const s of rig.straps) {
      const ph = s.userData.phase;
      s.rotation.x = s.userData.baseX + Math.sin(t * 1.9 + ph) * 0.09 - cur.hairFlare * 0.4;
      s.rotation.z = Math.sin(t * 1.4 + ph) * 0.06;
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
