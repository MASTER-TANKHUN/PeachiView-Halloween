// Rigged 3D Peachi (GLB exported from tools/blender/build_peachi.py) for three.js.
//
//   import { loadPeachi } from './js/peachi/peachi3d.js';
//   const peachi = await loadPeachi('assets/models/peachi.glb');
//   scene.add(peachi.object);
//   peachi.play('Idle');            // Idle Walk Wave Peace Float Reach Jumpscare Cry Angry Cheer TPose
//   peachi.setEmotion('happy');     // neutral happy smile laugh cry angry scream surprised smug
//   // every frame:  peachi.update(dt, camera)
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

const DRACO_PATH = 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/draco/gltf/';

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

function toonRamp() {
  // soft two-tone anime ramp (shadow, soft edge, lit)
  const data = new Uint8Array([90, 90, 90, 255, 150, 150, 150, 255, 235, 235, 235, 255, 255, 255, 255, 255]);
  const t = new THREE.DataTexture(data, 4, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}

// rim light + optional ghost fade injected into toon / physical materials
function addRim(mat, U, rim = true) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPWorld;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvPWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vPWorld;
        uniform vec3 uRimColor; uniform float uRim, uGhost, uGhostBase, uTime;`)
      .replace('#include <opaque_fragment>', `#include <opaque_fragment>
        {
          ${rim ? `float fres = pow(1.0 - clamp(abs(dot(normalize(normal), normalize(vViewPosition))), 0.0, 1.0), 3.0);
          gl_FragColor.rgb += uRimColor * fres * (uRim + 1.6 * uGhost * (0.85 + 0.15 * sin(uTime * 3.0 + vPWorld.y * 8.0)));` : ''}
          float h = vPWorld.y - uGhostBase;
          gl_FragColor.a *= mix(1.0, smoothstep(0.02, 0.55, h) * 0.82, uGhost);
        }`);
  };
  mat.customProgramCacheKey = () => 'peachi-rim' + (rim ? 1 : 0);
}

function makeToon(src, U, ramp) {
  const m = new THREE.MeshToonMaterial({
    color: src.color ? src.color.clone() : new THREE.Color(1, 1, 1),
    map: src.map || null,
    gradientMap: ramp,
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

export async function loadPeachi(url = 'assets/models/peachi.glb', opts = {}) {
  const { toon = true } = opts;
  const draco = new DRACOLoader().setDecoderPath(opts.dracoPath || DRACO_PATH);
  const loader = new GLTFLoader().setDRACOLoader(draco);
  const gltf = await loader.loadAsync(url);
  draco.dispose();
  const root = gltf.scene;
  root.name = 'Peachi3D';
  const ramp = toonRamp();
  const U = {
    uRimColor: { value: new THREE.Color(0xffc2dc) },
    uRim: { value: 0.35 },
    uGhost: { value: 0 },
    uGhostBase: { value: 0 },
    uTime: { value: 0 },
  };
  const bones = {};
  let eyes = null, mouth = null, browsMesh = null, skinned = [];
  const replaced = new Map();

  root.traverse((o) => {
    if (o.isBone) bones[o.name] = o;
    if (!o.isMesh) return;
    o.frustumCulled = false;
    if (o.isSkinnedMesh) skinned.push(o);
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const out = mats.map((m) => {
      if (replaced.has(m)) return replaced.get(m);
      let nm;
      const n = m.name || '';
      if (n === 'FaceBrows') {
        // anime brows drawn over the bangs: depth-tested, but pulled 4 cm toward the camera so they clear the
        // bangs (1-3 cm in front of the forehead) while walls and props in front of her still hide them
        nm = new THREE.MeshBasicMaterial({ map: m.map.clone(), transparent: true, depthWrite: false, opacity: 0.6, name: n });
        nm.map.needsUpdate = true;
        nm.map.wrapS = nm.map.wrapT = THREE.ClampToEdgeWrapping;
        nm.toneMapped = false;
        nm.onBeforeCompile = (sh) => {
          sh.vertexShader = sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
            mvPosition.xyz += normalize(-mvPosition.xyz) * 0.04;
            gl_Position = projectionMatrix * mvPosition;`);
        };
      } else if (n === 'FaceEyes' || n === 'FaceMouth') {
        nm = new THREE.MeshBasicMaterial({ map: m.map.clone(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, name: n });
        nm.map.needsUpdate = true;
        nm.map.wrapS = nm.map.wrapT = THREE.ClampToEdgeWrapping;
        nm.toneMapped = false;
        addRim(nm, U, false);
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
      } else if (toon) {
        nm = makeToon(m, U, ramp);
      } else {
        nm = m;
        addRim(nm, U);
      }
      replaced.set(m, nm);
      return nm;
    });
    o.material = Array.isArray(o.material) ? out : out[0];
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
    talking: false, talkT: 0, look: true, lookYaw: 0, lookPitch: 0, anger: false, ghostOn: false,
  };

  const api = {
    object: root,
    gltf,
    bones,
    skinned,
    mixer,
    clips: Object.keys(clips),
    uniforms: U,
    get emotion() { return state.emotion; },
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
      state.anger = !!e.anger;
      api.setExpression(e.eyes, e.mouth);
    },
    setTalking(on) { state.talking = on; if (!on) setCell(mouth, MA, state.mouth); },
    setLookAt(on) { state.look = on; },
    setGhost(v) {
      U.uGhost.value = v;
      const on = v > 0.001;
      if (on !== state.ghostOn) {
        state.ghostOn = on;
        root.traverse((o) => {
          if (!o.isMesh) return;
          for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
            if (m.userData.baseTransparent === undefined) m.userData.baseTransparent = m.transparent;
            m.transparent = on ? true : m.userData.baseTransparent;
            if (!m.name.startsWith('Face')) m.depthWrite = true;
            m.needsUpdate = true;
          }
        });
      }
    },
    setRim(v) { U.uRim.value = v; },
    update(dt, camera) {
      U.uTime.value += dt;
      mixer.update(dt);
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
      if (state.look && camera && bones.Head && bones.Neck) lookAt(camera, dt);
    },
  };

  // ---- head look-at (additive on top of the animation)
  const _v = new THREE.Vector3(), _t = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
  const _f = new THREE.Vector3(), _q2 = new THREE.Quaternion();
  root.updateMatrixWorld(true);
  const headBindInv = bones.Head ? bones.Head.getWorldQuaternion(new THREE.Quaternion()).invert() : new THREE.Quaternion();
  // brows through the bangs only while the face looks at the camera that renders them
  // (per render camera, so it also works when update() gets no camera, as in the game)
  if (browsMesh && bones.Head) {
    browsMesh.onBeforeRender = (renderer, scene, camera) => {
      bones.Head.getWorldPosition(_v); camera.getWorldPosition(_t);
      bones.Head.getWorldQuaternion(_q2).multiply(headBindInv); _f.set(0, 0, 1).applyQuaternion(_q2);
      const facing = _f.dot(_t.sub(_v).normalize());
      browsMesh.material.opacity = 0.6 * Math.min(1, Math.max(0, (facing - 0.25) / 0.35)) * (1 - U.uGhost.value * 0.5);
    };
  }
  const _m = new THREE.Matrix4();
  function lookAt(camera, dt) {
    const head = bones.Head;
    head.getWorldPosition(_v);
    camera.getWorldPosition(_t);
    // direction to camera in the character root space
    root.updateMatrixWorld();
    _m.copy(root.matrixWorld).invert();
    const a = _v.clone().applyMatrix4(_m), b = _t.clone().applyMatrix4(_m);
    const d = b.sub(a);
    let yaw = Math.atan2(d.x, d.z);
    let pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
    const lim = (x, m) => Math.max(-m, Math.min(m, x));
    const inFront = Math.abs(yaw) < 1.6;
    yaw = inFront ? lim(yaw, 0.7) : 0;
    pitch = inFront ? lim(pitch, 0.35) : 0;
    const k = 1 - Math.exp(-dt * 6);
    state.lookYaw += (yaw - state.lookYaw) * k;
    state.lookPitch += (pitch - state.lookPitch) * k;
    for (const [bn, w] of [['Neck', 0.4], ['Head', 0.6]]) {
      const bone = bones[bn];
      // rotate in root space, convert into the bone's local frame
      _e.set(-state.lookPitch * w, state.lookYaw * w, 0, 'YXZ');
      _q.setFromEuler(_e);
      const parentWorld = new THREE.Quaternion();
      bone.parent.getWorldQuaternion(parentWorld);
      const rootWorld = new THREE.Quaternion();
      root.getWorldQuaternion(rootWorld);
      const inRoot = parentWorld.clone().premultiply(rootWorld.clone().invert());
      const delta = inRoot.clone().invert().multiply(_q).multiply(inRoot);
      bone.quaternion.premultiply(delta);
    }
  }

  // ---- anger mark (red cross vein, like the sheet's angry face) on the head
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
  const anger = new THREE.Sprite(new THREE.SpriteMaterial({ map: angerTex, depthTest: true, transparent: true }));
  anger.scale.setScalar(0.045);
  anger.visible = false;
  if (bones.Head) {
    root.updateMatrixWorld(true);
    const p = new THREE.Vector3(0.098, 1.548, 0.040);       // upper right of the head (her left), on the hair, root space
    bones.Head.worldToLocal(p.applyMatrix4(root.matrixWorld));
    anger.position.copy(p);
    bones.Head.add(anger);
  }
  const _setEmotion = api.setEmotion;
  api.setEmotion = (name) => { _setEmotion(name); anger.visible = !!(EMOTIONS[name] || {}).anger; };
  const _update = api.update;
  api.update = (dt, camera) => {
    _update(dt, camera);
    if (anger.visible) anger.scale.setScalar(0.045 * (1 + 0.15 * Math.max(0, Math.sin(U.uTime.value * 9))));
  };

  api.setEmotion('neutral');
  if (clips.Idle) api.play('Idle', 0);
  return api;
}
