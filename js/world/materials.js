// Shared materials for the house. Most are tinted per part by vertex colors (one material → one merged mesh),
// floors and walls get their own textured materials. Emissive bins are HDR (colors > 1) so they bloom.
import * as THREE from 'three';
import * as T from './tex.js';

/** Small painted environment for reflections: dark room, a pink neon strip, a warm lamp, a moonlit window. */
function nightEnv() {
  const S = 64;
  const face = (fn) => {
    const c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d');
    const bg = g.createLinearGradient(0, 0, 0, S);
    bg.addColorStop(0, '#1c1230'); bg.addColorStop(1, '#07040c');
    g.fillStyle = bg; g.fillRect(0, 0, S, S);
    fn(g);
    return c;
  };
  const faces = [
    face((g) => { g.fillStyle = '#ff5fc0'; g.fillRect(0, 10, S, 4); }),                          // +x
    face((g) => { g.fillStyle = '#8fb0ff'; g.fillRect(18, 16, 22, 26); }),                       // -x (window)
    face((g) => { g.fillStyle = '#2a2036'; g.fillRect(0, 0, S, S); g.fillStyle = '#ffd9a0'; g.beginPath(); g.arc(32, 32, 6, 0, 7); g.fill(); }), // +y ceiling lamp
    face((g) => { g.fillStyle = '#0a0610'; g.fillRect(0, 0, S, S); }),                           // -y floor
    face((g) => { g.fillStyle = '#ffb070'; g.fillRect(40, 30, 8, 8); }),                         // +z
    face((g) => { g.fillStyle = '#7b2fff'; g.fillRect(6, 44, 52, 3); }),                         // -z
  ];
  const t = new THREE.CubeTexture(faces);
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

function scaled(tex, metersU, metersV) {
  for (const k of ['map', 'normalMap', 'roughnessMap']) if (tex[k]) tex[k].repeat.set(1 / metersU, 1 / metersV);
  return tex;
}

export function createMaterials() {
  const env = nightEnv();
  const wood = scaled(T.woodGrain(), 1.2, 0.6);
  const weave = scaled(T.weave(), 0.25, 0.25);
  const plaster = scaled(T.plaster(), 1, 1);
  const std = (o) => new THREE.MeshStandardMaterial({ vertexColors: true, envMap: env, envMapIntensity: 0.25, ...o });
  const basic = (o = {}) => new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, ...o });

  const M = {
    paint: std({ map: plaster.map, normalMap: plaster.normalMap, normalScale: new THREE.Vector2(0.35, 0.35), roughness: 0.9 }),
    wood: std({ map: wood.map, normalMap: wood.normalMap, normalScale: new THREE.Vector2(0.4, 0.4), roughness: 0.55, envMapIntensity: 0.35 }),
    woodMatte: std({ map: wood.map, normalMap: wood.normalMap, normalScale: new THREE.Vector2(0.6, 0.6), roughness: 0.85 }),
    fabric: std({ map: weave.map, normalMap: weave.normalMap, normalScale: new THREE.Vector2(0.6, 0.6), roughness: 1, envMapIntensity: 0.1 }),
    plush: std({ roughness: 1, envMapIntensity: 0.05 }),
    plastic: std({ roughness: 0.4, envMapIntensity: 0.4 }),
    gloss: std({ roughness: 0.12, envMapIntensity: 0.9 }),
    metal: std({ metalness: 1, roughness: 0.28, envMapIntensity: 1.1 }),
    metalRough: std({ metalness: 0.85, roughness: 0.55, envMapIntensity: 0.8 }),
    glass: new THREE.MeshStandardMaterial({ color: 0xbfd8ff, transparent: true, opacity: 0.16, roughness: 0.03, metalness: 0, envMap: env, envMapIntensity: 1.6, depthWrite: false, side: THREE.DoubleSide }),
    mirror: std({ metalness: 1, roughness: 0.04, envMapIntensity: 1.2 }),
    // emissive bins (HDR vertex colors): steady screens/LEDs, lights that flicker with the house, RGB strips
    emit: basic(),
    emitFlicker: basic(),
    emitRGB: basic(),
    // soft additive glows (light shafts, halos) — never cast/receive shadows
    haze: basic({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    ceiling: std({ map: plaster.map, normalMap: plaster.normalMap, normalScale: new THREE.Vector2(0.08, 0.08), roughness: 0.95, envMapIntensity: 0.1 }),
  };
  M.haze.userData.noShadow = true;

  // ---- floors
  const floorMat = (t, o = {}) => new THREE.MeshStandardMaterial({
    map: t.map, normalMap: t.normalMap, roughnessMap: t.roughnessMap, roughness: 1, vertexColors: true,
    envMap: env, envMapIntensity: 0.3, normalScale: new THREE.Vector2(1, 1), ...o,
  });
  const fl = {
    oak: scaled(T.planks({ seed: 11, base: '#5a3a28', light: '#8a5a3c' }), 1.92, 1.92),
    darkOak: scaled(T.planks({ seed: 12, base: '#3a2419', light: '#5e3a26', gap: '#120a06' }), 1.92, 1.92),
    honey: scaled(T.planks({ seed: 14, base: '#8a6242', light: '#c0915f', plankW: 0.12, meters: 1.44 }), 1.44, 1.44),
    blush: scaled(T.planks({ seed: 15, base: '#d8b8b0', light: '#f4e2dc', gap: '#8a6a66', plankW: 0.18, meters: 2.16 }), 2.16, 2.16),
    checker: scaled(T.tiles({ seed: 21, a: '#e8e2d6', b: '#2a2430', grout: '#6a6460', count: 4, meters: 1.2, glaze: 0.25 }), 1.2, 1.2),
    bathTile: scaled(T.tiles({ seed: 23, a: '#dfe9e6', grout: '#8a9894', count: 8, meters: 0.8, glaze: 0.15, jitter: 0.04 }), 0.8, 0.8),
    carpet: scaled(T.carpet({ seed: 25, a: '#231634', b: '#3a2352' }), 1, 1),
  };
  for (const [k, t] of Object.entries(fl)) M['floor_' + k] = floorMat(t, k === 'carpet' ? { envMapIntensity: 0.05 } : {});

  // ---- walls (texture = full wall height, v = height)
  for (const kind of ['peachi', 'peachFeature', 'guest', 'hall', 'kitchen', 'living', 'bath']) {
    const t = scaled(T.wallpaper(kind), 1.4, T.WALL_H);
    for (const k of ['map', 'normalMap']) t[k].wrapT = THREE.ClampToEdgeWrapping;
    M['wall_' + kind] = new THREE.MeshStandardMaterial({
      map: t.map, normalMap: t.normalMap, normalScale: new THREE.Vector2(0.8, 0.8), roughness: kind === 'bath' ? 0.45 : 0.9,
      vertexColors: true, envMap: env, envMapIntensity: kind === 'bath' ? 0.5 : 0.15,
    });
  }
  M.env = env;
  return M;
}
