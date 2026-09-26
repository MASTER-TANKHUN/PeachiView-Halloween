// Rigged 3D Peachi (GLB exported from tools/blender/build_peachi.py) for three.js.
//
//   import { loadPeachi } from './js/peachi/peachi3d.js';
//   const peachi = await loadPeachi();   // every call returns its own instance (the GLB is fetched and decoded once)
//   scene.add(peachi.object);
//   peachi.play('Idle');            // Idle Walk Wave Peace Float Reach Stunned Jumpscare Cry Angry Cheer TPose
//   peachi.setEmotion('happy');     // neutral happy smile laugh cry angry scream surprised smug
//   // every frame:  peachi.update(dt, camera)
//
// The game uses it through buildPeachi() / buildHeadphonesItem() in model.js (same contract as the procedural model).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

const DRACO_PATH = 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/draco/gltf/';
export const PEACHI_GLB = new URL('../../assets/models/peachi.glb', import.meta.url).href;
export const HEADPHONES_GLB = new URL('../../assets/models/headphones.glb', import.meta.url).href;
/** Center of her face in model space (rest pose): faceAnchor sits here, on the Head bone. */
export const FACE_POINT = [0, 1.435, 0.09];

export const EMOTIONS = {
  neutral: { eyes: 'open', mouth: 'smile' },
  happy: { eyes: 'open', mouth: 'open' },
  smile: { eyes: 'smile', mouth: 'smile' },
  laugh: { eyes: 'squint', mouth: 'open' },
  cry: { eyes: 'sad', mouth: 'frown' },
  angry: { eyes: 'angry', mouth: 'fang', anger: true },
  scream: { eyes: 'wide', mouth: 'scream' },
  surprised: { eyes: 'wide', mouth: 'o' },
  smug: { eyes: 'half', mouth: 'neutral' },
};

const ONESHOT = new Set(['Jumpscare']);
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const clampAbs = (x, m) => Math.max(-m, Math.min(m, x));

// ---- GLBs are fetched + decoded once per url, then cloned per instance
const assets = new Map();
function loadAsset(url, dracoPath) {
  let p = assets.get(url);
  if (!p) {
    const draco = new DRACOLoader().setDecoderPath(dracoPath || DRACO_PATH);
    p = new GLTFLoader().setDRACOLoader(draco).loadAsync(url).finally(() => draco.dispose());
    p.catch(() => assets.delete(url));   // let a later call retry
    assets.set(url, p);
  }
  return p;
}

let ramp = null;
function toonRamp() {
  // soft two-tone anime ramp (shadow, soft edge, lit)
  if (ramp) return ramp;
  const data = new Uint8Array([90, 90, 90, 255, 150, 150, 150, 255, 235, 235, 235, 255, 255, 255, 255, 255]);
  ramp = new THREE.DataTexture(data, 4, 1, THREE.RGBAFormat);
  ramp.minFilter = ramp.magFilter = THREE.LinearFilter;
  ramp.generateMipmaps = false;
  ramp.needsUpdate = true;
  return ramp;
}

function makeUniforms() {
  return {
    uRimColor: { value: new THREE.Color(0xffc2dc) },
    uRim: { value: 0.35 },
    uGhost: { value: 0 },
    uGhostBase: { value: 0 },
    uTime: { value: 0 },
    uSelfLit: { value: 0.06 }, // emissive floor so she never goes fully black in dark rooms (0.2 as a ghost)
    uDark: { value: 0 },       // 1 = pitch-black silhouette (same math as the procedural model)
    uDesat: { value: 0 },      // 1 = colors drained to a cold grey
  };
}

// rim light, ghost fade, self-light, desaturate / darken, injected into every material.
// bias > 0 pulls the surface that far toward the camera in depth only (brows drawn over the bangs).
function addRim(mat, U, { rim = true, bias = 0 } = {}) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPWorld;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        vPWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;${bias ? `
        mvPosition.xyz += normalize(-mvPosition.xyz) * ${bias.toFixed(3)};
        gl_Position = projectionMatrix * mvPosition;` : ''}`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vPWorld;
        uniform vec3 uRimColor; uniform float uRim, uGhost, uGhostBase, uTime, uSelfLit, uDark, uDesat;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += diffuseColor.rgb * uSelfLit;`)
      .replace('#include <opaque_fragment>', `#include <opaque_fragment>
        {
          ${rim ? `float fres = pow(1.0 - clamp(abs(dot(normalize(normal), normalize(vViewPosition))), 0.0, 1.0), 3.0);
          gl_FragColor.rgb += uRimColor * fres * (uRim + 1.6 * uGhost * (0.85 + 0.15 * sin(uTime * 3.0 + vPWorld.y * 8.0)));` : ''}
          float h = vPWorld.y - uGhostBase;
          gl_FragColor.a *= mix(1.0, smoothstep(0.02, 0.55, h), uGhost);   // ghost: only the legs fade out
          float lum = dot(gl_FragColor.rgb, vec3(0.3, 0.55, 0.15));
          gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(lum * 0.86, lum * 0.93, lum * 1.12), uDesat);
          gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.006, 0.003, 0.01), uDark);
        }`);
  };
  mat.customProgramCacheKey = () => 'peachi-rim' + (rim ? 1 : 0) + ':' + bias;
}

function makeToon(src, U) {
  const m = new THREE.MeshToonMaterial({
    color: src.color ? src.color.clone() : new THREE.Color(1, 1, 1),
    map: src.map || null,
    gradientMap: toonRamp(),
    vertexColors: !!src.vertexColors,
    transparent: src.transparent,
    alphaTest: src.alphaTest,
    side: src.side,
    emissive: src.emissive ? src.emissive.clone() : new THREE.Color(0, 0, 0),
    emissiveMap: src.emissiveMap || null,
    emissiveIntensity: src.emissiveIntensity ?? 1,
  });
  m.name = src.name;
  addRim(m, U);
  return m;
}

// Swap the exported materials for the anime ones (by material name). Returns every material it made.
function convertMaterials(root, U, { toon = true } = {}) {
  const replaced = new Map();
  root.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const out = mats.map((m) => {
      if (replaced.has(m)) return replaced.get(m);
      let nm;
      const n = m.name || '';
      if (n === 'FaceEyes' || n === 'FaceMouth' || n === 'FaceBrows') {
        // face decals: lit like the skin under them (they darken with the room), own map for the atlas offset
        const brows = n === 'FaceBrows';
        nm = new THREE.MeshToonMaterial({
          map: m.map.clone(), gradientMap: toonRamp(), transparent: true, depthWrite: false, name: n,
          ...(brows ? { opacity: 0.6 } : { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
        });
        nm.map.needsUpdate = true;
        nm.map.wrapS = nm.map.wrapT = THREE.ClampToEdgeWrapping;
        // brows are drawn over the bangs: depth-tested, but pulled 4 cm toward the camera so they clear the
        // bangs (1-3 cm in front of the forehead) while walls and props in front of her still hide them
        addRim(nm, U, { rim: false, bias: brows ? 0.04 : 0 });
      } else if (n.startsWith('Holo')) {
        nm = new THREE.MeshPhysicalMaterial({
          map: m.map || null, color: m.color.clone(), roughness: 0.25, metalness: 0.05, side: m.side,
          iridescence: 1.0, iridescenceIOR: 1.35, iridescenceThicknessRange: [180, 620], clearcoat: 0.5, clearcoatRoughness: 0.2,
          sheen: 0.4, sheenColor: new THREE.Color(0xffc8e4), envMapIntensity: 1.0, name: n,
        });
        addRim(nm, U);
      } else if (n === 'Gold') {
        nm = new THREE.MeshStandardMaterial({ color: 0xffc453, metalness: 1, roughness: 0.25, envMapIntensity: 1.3, name: n });
        addRim(nm, U);
      } else if (n === 'EarGlow') {
        nm = new THREE.MeshBasicMaterial({ map: m.map, name: n });
        nm.color.setScalar(1.25);
        addRim(nm, U, { rim: false });
      } else if (toon) {
        nm = makeToon(m, U);
      } else {
        nm = m.clone();
        addRim(nm, U);
      }
      replaced.set(m, nm);
      return nm;
    });
    o.material = Array.isArray(o.material) ? out : out[0];
  });
  return [...replaced.values()];
}

function disposeMaterials(list) {
  for (const m of list) {
    if (m.name.startsWith('Face') && m.map) m.map.dispose();   // the per-instance atlas clones
    m.dispose();
  }
}

export async function loadPeachi(url = PEACHI_GLB, opts = {}) {
  const gltf = await loadAsset(url, opts.dracoPath);
  const root = cloneSkinned(gltf.scene);
  root.name = 'Peachi3D';
  const U = makeUniforms();
  const bones = {};
  const skinned = [], phones = [];
  let eyes = null, mouth = null, browsMesh = null;
  const materials = convertMaterials(root, U, opts);

  root.traverse((o) => {
    if (o.isBone) bones[o.name] = o;
    if (!o.isMesh) return;
    o.frustumCulled = false;
    if (o.isSkinnedMesh) skinned.push(o);
    if (o.name.startsWith('Headphones')) phones.push(o);
    if (o.name.startsWith('FaceEyes')) { eyes = o; o.renderOrder = 2; }
    if (o.name.startsWith('FaceMouth')) { mouth = o; o.renderOrder = 2; }
    if (o.name.startsWith('FaceBrows')) { browsMesh = o; o.renderOrder = 20; }
  });

  // ---- expressions (texture atlas cells)
  const atlas = (mesh) => {
    const ud = mesh.userData || {};
    const grid = ud.atlas_grid || (mesh.name.startsWith('FaceEyes') ? [2, 4] : [4, 2]);
    const names = (ud.atlas_names || '').split(',').filter(Boolean);
    return { grid, names };
  };
  const EA = eyes ? atlas(eyes) : null;
  const MA = mouth ? atlas(mouth) : null;
  const setCell = (mesh, A, name) => {
    if (!mesh || !A) return;
    const i = Math.max(0, A.names.indexOf(name));
    const [cols, rows] = A.grid;
    mesh.material.map.offset.set((i % cols) / cols, Math.floor(i / cols) / rows);
  };

  // ---- animation
  const mixer = new THREE.AnimationMixer(root);
  const clips = {};
  for (const c of gltf.animations) clips[c.name] = c;
  let current = null;

  const state = {
    eyes: 'open', mouth: 'smile', emotion: 'neutral', blinkT: 2.5, blinking: 0,
    talking: false, talkT: 0, look: true, lookYaw: 0, lookPitch: 0, ghostOn: false, phones: true,
    leanF: 0, leanS: 0,
  };
  let lookTarget = null;

  // ---- rest-pose anchors on the head
  root.updateMatrixWorld(true);
  const headBindInv = bones.Head ? bones.Head.getWorldQuaternion(new THREE.Quaternion()).invert() : new THREE.Quaternion();
  const onHead = (obj, x, y, z) => {
    const p = new THREE.Vector3(x, y, z);
    if (bones.Head) { bones.Head.worldToLocal(p); bones.Head.add(obj); } else root.add(obj);
    obj.position.copy(p);
    return obj;
  };
  const faceAnchor = onHead(new THREE.Object3D(), ...FACE_POINT);
  faceAnchor.name = 'faceAnchor';

  // anger mark (red cross vein, like the sheet's angry face): upper right of the head (her left), on the hair
  const angerTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    g.translate(64, 64);
    for (let i = 0; i < 4; i++) {
      g.save(); g.rotate(i * Math.PI / 2 + Math.PI / 4);
      g.beginPath(); g.moveTo(10, -14); g.quadraticCurveTo(44, -18, 50, 6); g.quadraticCurveTo(40, -4, 12, 2); g.closePath();
      g.fillStyle = '#e8203c'; g.fill(); g.lineWidth = 5; g.strokeStyle = '#ffffff'; g.stroke();
      g.restore();
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const anger = onHead(new THREE.Sprite(new THREE.SpriteMaterial({ map: angerTex, depthTest: true, transparent: true })), 0.098, 1.548, 0.040);
  anger.scale.setScalar(0.045);
  anger.visible = false;

  // brows through the bangs only while the face looks at the camera that renders them
  // (per render camera, so it also works when update() gets no camera, as in the game)
  const _v = new THREE.Vector3(), _t = new THREE.Vector3(), _f = new THREE.Vector3(), _p = new THREE.Vector3();
  const _last = new THREE.Vector3(), _vel = new THREE.Vector3();
  const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion();
  const _e = new THREE.Euler(), _m = new THREE.Matrix4();
  let hasLast = false;
  // the look / lean layer is added on top of the animation every frame. The mixer only writes a bone when its
  // animated value changes, so undo last frame's layer first or it would pile up on bones held still by the clip.
  const layered = ['Spine', 'Spine1', 'Neck', 'Head'].map((n) => bones[n]).filter(Boolean);
  const layerBase = layered.map(() => new THREE.Quaternion());
  let layerOn = false;
  if (browsMesh && bones.Head) {
    browsMesh.onBeforeRender = (renderer, scene, camera) => {
      bones.Head.getWorldPosition(_v); camera.getWorldPosition(_t);
      bones.Head.getWorldQuaternion(_q2).multiply(headBindInv); _f.set(0, 0, 1).applyQuaternion(_q2);
      const facing = _f.dot(_t.sub(_v).normalize());
      browsMesh.material.opacity = 0.6 * clamp01((facing - 0.25) / 0.35) * (1 - U.uGhost.value * 0.5);
    };
  }

  // rotate a bone by `euler`, given in the model's root space, on top of the animation
  function addRootRotation(bone, euler) {
    _q.setFromEuler(euler);
    bone.parent.getWorldQuaternion(_qa);
    root.getWorldQuaternion(_qb);
    _qa.premultiply(_qb.invert());                       // parent orientation in root space
    bone.quaternion.premultiply(_qb.copy(_qa).invert().multiply(_q).multiply(_qa));
  }

  // head + neck turn toward a world point (additive, limited, eased)
  function applyLook(target, dt) {
    let yaw = 0, pitch = 0;
    if (target) {
      root.updateMatrixWorld();
      _m.copy(root.matrixWorld).invert();
      bones.Head.getWorldPosition(_v).applyMatrix4(_m);
      const d = _t.copy(target).applyMatrix4(_m).sub(_v);
      yaw = Math.atan2(d.x, d.z);
      pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
      const inFront = Math.abs(yaw) < 1.6;
      yaw = inFront ? clampAbs(yaw, 0.7) : 0;
      pitch = inFront ? clampAbs(pitch, 0.35) : 0;
    }
    const k = 1 - Math.exp(-dt * 6);
    state.lookYaw += (yaw - state.lookYaw) * k;
    state.lookPitch += (pitch - state.lookPitch) * k;
    if (Math.abs(state.lookYaw) + Math.abs(state.lookPitch) < 1e-4) return;
    for (const [bn, w] of [['Neck', 0.4], ['Head', 0.6]]) addRootRotation(bones[bn], _e.set(-state.lookPitch * w, state.lookYaw * w, 0, 'YXZ'));
  }

  // lean into the motion: velocity of the model root, in her own frame
  function applyLean(dt) {
    root.getWorldPosition(_p);
    if (hasLast && dt > 1e-4) {
      _vel.copy(_p).sub(_last).divideScalar(dt);
      _vel.y = 0;
      if (_vel.lengthSq() > 100) _vel.set(0, 0, 0);   // teleports
      _vel.applyQuaternion(root.getWorldQuaternion(_qa).invert());
      const k = 1 - Math.exp(-dt * 5);
      state.leanF += (clampAbs(_vel.z * 0.09, 0.22) - state.leanF) * k;
      state.leanS += (clampAbs(-_vel.x * 0.07, 0.15) - state.leanS) * k;
    }
    _last.copy(_p); hasLast = true;
    if (Math.abs(state.leanF) + Math.abs(state.leanS) < 1e-4) return;
    for (const [bn, w] of [['Spine', 0.6], ['Spine1', 0.4]]) if (bones[bn]) addRootRotation(bones[bn], _e.set(state.leanF * w, 0, state.leanS * w, 'XYZ'));
  }

  const api = {
    object: root,
    gltf,
    bones,
    skinned,
    mixer,
    clips: Object.keys(clips),
    uniforms: U,
    faceAnchor,                 // Object3D at the center of her face, follows the head
    faceHeight: FACE_POINT[1],
    get emotion() { return state.emotion; },
    get dark() { return U.uDark.value; },
    get headphones() { return state.phones; },
    play(name, fade = 0.35) {
      const clip = clips[name];
      if (!clip) return null;
      const action = mixer.clipAction(clip);
      action.reset();
      if (ONESHOT.has(name)) { action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true; } else action.setLoop(THREE.LoopRepeat, Infinity);
      action.enabled = true;
      action.setEffectiveWeight(1);
      if (current && current !== action) action.crossFadeFrom(current, fade, false);
      action.play();
      current = action;
      return action;
    },
    setExpression(eyesName, mouthName) {
      if (eyesName) { state.eyes = eyesName; setCell(eyes, EA, eyesName); setCell(browsMesh, EA, eyesName); }
      if (mouthName) { state.mouth = mouthName; setCell(mouth, MA, mouthName); }
    },
    setEmotion(name) {
      const e = EMOTIONS[name] || EMOTIONS.neutral;
      state.emotion = name;
      anger.visible = !!e.anger;
      api.setExpression(e.eyes, e.mouth);
    },
    setTalking(on) { state.talking = on; if (!on) setCell(mouth, MA, state.mouth); },
    /** Follow the camera passed to update() (viewer). */
    setLookAt(on) { state.look = on; },
    /** Follow a world-space point (overrides setLookAt), or null to stop. */
    lookAt(v) { lookTarget = v ? (lookTarget || new THREE.Vector3()).copy(v) : null; },
    setGhost(v) {
      U.uGhost.value = v;
      U.uSelfLit.value = 0.06 + 0.14 * v;
      const on = v > 0.001;
      if (on !== state.ghostOn) {
        state.ghostOn = on;
        for (const m of materials) {
          if (m.userData.baseTransparent === undefined) m.userData.baseTransparent = m.transparent;
          m.transparent = on ? true : m.userData.baseTransparent;
          if (!m.name.startsWith('Face')) m.depthWrite = true;
          m.needsUpdate = true;
        }
      }
    },
    setRim(v) { U.uRim.value = v; },
    setGlowColor(hex) { U.uRimColor.value.set(hex); },
    /** 0..1: fade her to a pitch-black silhouette. */
    setDark(v) { U.uDark.value = clamp01(v); anger.material.color.setScalar(1 - 0.97 * U.uDark.value); },
    /** 0..1: drain her colors toward a cold ghost-grey. */
    setDesat(v) { U.uDesat.value = clamp01(v); },
    setHeadphones(on) { state.phones = !!on; for (const o of phones) o.visible = state.phones; },
    update(dt, camera) {
      U.uTime.value += dt;
      if (layerOn) layered.forEach((b, i) => b.quaternion.copy(layerBase[i]));
      mixer.update(dt);
      layered.forEach((b, i) => layerBase[i].copy(b.quaternion));
      layerOn = true;
      U.uGhostBase.value = root.getWorldPosition(_v).y;
      // blink when eyes are open-type
      state.blinkT -= dt;
      if (state.blinking > 0) {
        state.blinking -= dt;
        if (state.blinking <= 0) { setCell(eyes, EA, state.eyes); setCell(browsMesh, EA, state.eyes); }
      } else if (state.blinkT <= 0) {
        state.blinkT = 2.2 + Math.random() * 3.5;
        if (['open', 'wide', 'angry', 'sad', 'half'].includes(state.eyes)) { state.blinking = 0.12; setCell(eyes, EA, 'blink'); }
      }
      // simple lip flap
      if (state.talking) {
        state.talkT -= dt;
        if (state.talkT <= 0) {
          state.talkT = 0.07 + Math.random() * 0.1;
          const opts2 = ['ah', 'o', 'smile', 'ah', 'neutral'];
          setCell(mouth, MA, opts2[(Math.random() * opts2.length) | 0]);
        }
      }
      applyLean(dt);
      if (bones.Head && bones.Neck) applyLook(lookTarget || (state.look && camera ? camera.getWorldPosition(_t) : null), dt);
      if (anger.visible) anger.scale.setScalar(0.045 * (1 + 0.15 * Math.max(0, Math.sin(U.uTime.value * 9))));
    },
    dispose() {
      mixer.stopAllAction();
      mixer.uncacheRoot(root);
      root.removeFromParent();
      disposeMaterials(materials);
      angerTex.dispose();
      anger.material.dispose();
    },
  };

  api.setEmotion('neutral');
  if (clips.Idle) api.play('Idle', 0);
  return api;
}

/** The cat-ear headphones on their own (Night 1's pickup), centered on their bounding box, real size (~0.26 m). */
export async function loadHeadphones(url = HEADPHONES_GLB, opts = {}) {
  const gltf = await loadAsset(url, opts.dracoPath);
  const object = gltf.scene.clone(true);
  object.name = 'Headphones3D';
  const U = makeUniforms();
  U.uSelfLit.value = opts.selfLit ?? 0.45;
  U.uRim.value = opts.rim ?? 0.5;
  const materials = convertMaterials(object, U, opts);
  return {
    object,
    uniforms: U,
    setGlowColor(hex) { U.uRimColor.value.set(hex); },
    dispose() { object.removeFromParent(); disposeMaterials(materials); },
  };
}
