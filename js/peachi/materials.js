// Peachi materials: anime cel shading in the style of Genshin Impact / Honkai: Star Rail, on top of
// MeshToonMaterial:
// - two-tone lighting with per-material shadow tint, a warm band at the terminator, lit areas capped
//   at the albedo (no blow-out); no tone mapping so colors match the character sheet
// - SDF face shadow: the face ignores its polygons and shades from a shadow-threshold map sampled by
//   the horizontal light angle, mirrored for lights on the other side (clean anime face shadows)
// - eye overlay: an eyes/brows-only copy of the face drawn semi-transparent over the bangs, pulled a
//   little toward the camera so only hair right in front of the face lets them through
// - crisp rim light on the lit side, angel-ring highlight and inked strand lines on hair,
//   holographic film for the jacket/sock
// - ghost treatment (dithered leg fade, pink rim, self-light) and vertex sway for hair/skirt
// - inverted-hull outline with per-vertex colors (darkened base color), sharing the same sway
import * as THREE from 'three';

export function createUniforms(ghost) {
  return {
    uTime: { value: 0 },
    uGhost: { value: ghost ? 1 : 0 },
    uGlow: { value: 0 },
    uBaseY: { value: 0 },
    uFade: { value: new THREE.Vector2(0.05, 0.55) }, // world-height range (above the model origin) of the leg fade
    uGlowColor: { value: new THREE.Color(0xff5fa8) },
    uSelfLit: { value: ghost ? 0.2 : 0.06 },
    uFlare: { value: 0 },  // 0..1 hair/skirt lift (float, jumpscare)
    uSwayK: { value: 1 },  // sway energy
    uShadeEdge: { value: 0.05 },
    uLightCap: { value: 1.06 }, // lit areas never exceed albedo × cap
    uLining: { value: new THREE.Color(0xff8dbd) },
    uRimK: { value: 0.3 },
    // face SDF shading (filled in by the model)
    uFaceSDF: { value: null },
    uFaceWin: { value: new THREE.Vector4(-0.085, 0, 0.085, 0.17) }, // head-local x0, y0, x1, y1
    uFaceZ: { value: 0.012 },
    uHeadFwd: { value: new THREE.Vector3(0, 0, 1) },
    uHeadUp: { value: new THREE.Vector3(0, 1, 0) },
  };
}

const SWAY_PARS = /* glsl */`
attribute vec2 aSway;
uniform float uTime, uFlare, uSwayK;
varying vec3 vGWorld;
varying vec3 vLocalP;
`;
// aSway.x = displacement amplitude (m) at this vertex, aSway.y = phase.
const SWAY_MAIN = /* glsl */`
vLocalP = transformed;
if (aSway.x > 0.0) {
  float ph = aSway.y;
  vec3 dsp = vec3(sin(uTime * 1.6 + ph) + 0.35 * sin(uTime * 3.7 + ph * 2.3), 0.0, 0.6 * cos(uTime * 1.25 + ph * 1.7)) * aSway.x * uSwayK;
  vec2 rad = transformed.xz;
  float rl = length(rad);
  rad = rl > 1e-4 ? rad / rl : vec2(0.0, -1.0);
  dsp.xz += rad * aSway.x * uFlare * 5.0;
  dsp.y += aSway.x * uFlare * 2.2;
  transformed += dsp;
}
`;
const FADE_PARS = /* glsl */`
varying vec3 vGWorld;
varying vec3 vLocalP;
uniform float uGhost, uGlow, uBaseY, uTime, uSelfLit, uRimK;
uniform vec2 uFade;
uniform vec3 uGlowColor;
float pvIGN(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
`;
// ghost legs dissolve with a stable dither (no transparency sorting problems)
const FADE_MAIN = /* glsl */`
{
  float gh = vGWorld.y - uBaseY;
  float fade = mix(1.0, smoothstep(uFade.x, uFade.y, gh), uGhost);
  if (fade < 0.999 && fade <= pvIGN(gl_FragCoord.xy)) discard;
}
`;

const HOLO_PARS = /* glsl */`
vec3 pvHolo(float t) {
  t = fract(t) * 4.0;
  vec3 c0 = vec3(1.0, 0.64, 0.86), c1 = vec3(0.74, 0.7, 1.0), c2 = vec3(0.62, 0.93, 1.0), c3 = vec3(1.0, 0.95, 0.76);
  if (t < 1.0) return mix(c0, c1, smoothstep(0.0, 1.0, t));
  if (t < 2.0) return mix(c1, c2, smoothstep(1.0, 2.0, t));
  if (t < 3.0) return mix(c2, c3, smoothstep(2.0, 3.0, t));
  return mix(c3, c0, smoothstep(3.0, 4.0, t));
}
`;

// Head frame in view space (the face shading works in the head's horizontal plane).
const HEAD_PARS = /* glsl */`
uniform sampler2D uFaceSDF;
uniform vec4 uFaceWin;
uniform float uFaceZ;
uniform vec3 uHeadFwd, uHeadUp;
vec3 pvHeadFwd() { return normalize((viewMatrix * vec4(uHeadFwd, 0.0)).xyz); }
vec3 pvHeadUp() { return normalize((viewMatrix * vec4(uHeadUp, 0.0)).xyz); }
`;

/** Shadow multiply colors per material family (warm skin, lavender cloth). */
export const SHADE = {
  cloth: new THREE.Color(0.8, 0.74, 0.93),
  skin: new THREE.Color(0.95, 0.72, 0.7),
  face: new THREE.Color(0.97, 0.78, 0.76),
  warm: new THREE.Color(0.86, 0.66, 0.74),
};
export const TERM = { skin: new THREE.Color(1.0, 0.42, 0.34) };

/**
 * Toon material with the Peachi injections.
 * flags: { holo, lining, rim (ghost glow), crisp (lit-side rim light), shade, term (terminator band color),
 *          strands (hair lines + angel ring), faceSDF, eyeOverlay }
 */
export function toonMaterial(U, params = {}, flags = {}) {
  const {
    holo = false, lining = false, rim = true, crisp = true, shade = SHADE.warm, term = null,
    strands = false, faceSDF = false, eyeOverlay = false,
  } = flags;
  const m = new THREE.MeshToonMaterial(params);
  if (strands) m.defines = { ...(m.defines || {}), USE_UV: '' };
  m.toneMapped = false; // colors are authored to match the sheet; the cap below keeps them in range
  const own = {
    uShadeColor: { value: shade.clone() },
    uTermColor: { value: term ? term.clone() : new THREE.Color(0, 0, 0) },
  };
  m.userData.shade = own.uShadeColor;
  const gradient = faceSDF ? /* glsl */`
    vec3 getGradientIrradiance(vec3 normal, vec3 lightDirection) {
      // SDF face shadow: threshold map vs. the light's angle around the head (vertical component ignored)
      vec3 fwd = pvHeadFwd(), up = pvHeadUp(), lft = normalize(cross(up, fwd));
      vec3 Lp = lightDirection - dot(lightDirection, up) * up;
      float lpl = length(Lp);
      float FoL01 = lpl > 1e-3 ? dot(fwd, Lp / lpl) * 0.5 + 0.5 : 1.0;
      vec2 fuv = (vLocalP.xy - uFaceWin.xy) / (uFaceWin.zw - uFaceWin.xy);
      if (dot(Lp, lft) < 0.0) fuv.x = 1.0 - fuv.x;       // map is authored for a light on her left
      float sdf = texture2D(uFaceSDF, clamp(fuv, 0.0, 1.0)).r;
      float sF = smoothstep(1.0 - sdf - 0.02, 1.0 - sdf + 0.02, FoL01);
      // outside the face (sides/back of the head): regular two-tone lighting
      float sN = smoothstep(uShadeEdge - 0.06, uShadeEdge + 0.06, dot(normal, lightDirection));
      float inFace = smoothstep(0.0, 0.06, min(min(fuv.x, 1.0 - fuv.x), min(fuv.y, 1.0 - fuv.y))) * smoothstep(0.0, 0.03, vLocalP.z - uFaceZ);
      float s = mix(sN, sF, inFace);
      return mix(uShadeColor, vec3(1.0), s) + uTermColor * (4.0 * s * (1.0 - s)) * 0.3;
    }` : /* glsl */`
    vec3 getGradientIrradiance(vec3 normal, vec3 lightDirection) {
      float dotNL = dot(normal, lightDirection);
      float s = smoothstep(uShadeEdge - 0.06, uShadeEdge + 0.06, dotNL);
      return mix(uShadeColor, vec3(1.0), s) + uTermColor * (4.0 * s * (1.0 - s)) * 0.3;
    }`;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U, own);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + SWAY_PARS)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + SWAY_MAIN)
      .replace('#include <project_vertex>', `#include <project_vertex>
        vGWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
        ${eyeOverlay ? `
        // pull toward the camera so the overlay wins against hair within ~2 cm of the face only
        mvPosition.xyz -= normalize(mvPosition.xyz) * 0.022;
        gl_Position = projectionMatrix * mvPosition;` : ''}`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + FADE_PARS + HOLO_PARS + HEAD_PARS + '\nuniform vec3 uShadeColor, uLining, uTermColor;\nuniform float uShadeEdge, uLightCap;')
      .replace('#include <gradientmap_pars_fragment>', gradient)
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n' + FADE_MAIN)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        {
          ${holo ? `
          // holographic film on white areas: liquid pink/lavender/cyan/cream bands that slide with the view
          vec3 hv = normalize(vViewPosition);
          float ndv = dot(normal, hv);
          float wHolo = smoothstep(0.8, 0.93, min(diffuseColor.r, min(diffuseColor.g, diffuseColor.b)));
          vec3 wp = vGWorld * 1.0;
          float liq = sin(wp.x * 21.0 + sin(wp.y * 15.0) * 1.6) + sin(wp.y * 17.0 - wp.z * 19.0 + sin(wp.x * 12.0) * 1.3) + 0.7 * sin((wp.x + wp.z) * 9.0 + wp.y * 6.0);
          float hk = liq * 0.16 + ndv * 0.85 + uTime * 0.03;
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * pvHolo(hk), wHolo);
          float streak = smoothstep(0.72, 0.97, sin(liq * 2.1 + ndv * 3.0));
          totalEmissiveRadiance += vec3(1.0) * streak * 0.22 * wHolo + diffuseColor.rgb * pow(1.0 - abs(ndv), 3.0) * 0.12 * wHolo;` : ''}
          ${lining ? 'if (!gl_FrontFacing) diffuseColor.rgb = uLining;' : ''}
          ${strands ? `
          // inked strand lines running along each lock (anti-aliased, fade out when too dense)
          float sx = vUv.x * 6.0 + sin(vUv.y * 11.0) * 0.12;
          float fw = fwidth(sx);
          float sl = abs(fract(sx) - 0.5);
          float line = 1.0 - smoothstep(0.035, 0.035 + fw * 1.5, sl);
          diffuseColor.rgb *= 1.0 - 0.2 * line * (1.0 - smoothstep(0.15, 0.4, fw));
          // angel ring: a glossy band that stays on the crown as the view turns (matcap-like, view-space normal)
          vec3 nvw = normalize(normal);
          float ringB = smoothstep(0.16, 0.26, nvw.y) * (1.0 - smoothstep(0.4, 0.52, nvw.y)) * smoothstep(0.1, 0.13, vLocalP.y) * step(0.0, nvw.z);
          totalEmissiveRadiance += vec3(1.0, 0.84, 0.78) * ringB * (0.26 - 0.12 * line);` : ''}
          totalEmissiveRadiance += diffuseColor.rgb * uSelfLit;
        }`)
      .replace('#include <aomap_fragment>', `#include <aomap_fragment>
        {
          vec3 ls = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
          reflectedLight.directDiffuse = min(ls, diffuseColor.rgb * uLightCap);
          reflectedLight.indirectDiffuse = vec3(0.0);
        }`)
      .replace('#include <opaque_fragment>', `#include <opaque_fragment>
        ${crisp ? `{
          // crisp rim light on the upper/lit side of the silhouette (Genshin-style: albedo × rim)
          vec3 nvr = normalize(normal);
          float ndvR = clamp(dot(nvr, normalize(vViewPosition)), 0.0, 1.0);
          float rimC = smoothstep(0.6, 0.66, 1.0 - ndvR) * smoothstep(0.05, 0.35, dot(nvr, normalize(vec3(0.55, 0.62, 0.25))));
          gl_FragColor.rgb += diffuseColor.rgb * rimC * uRimK;
        }` : ''}
        ${rim ? `{
          float rimF = pow(1.0 - clamp(abs(dot(normalize(normal), normalize(vViewPosition))), 0.0, 1.0), 2.4);
          float flick = 0.85 + 0.15 * sin(uTime * 3.0 + vGWorld.y * 9.0);
          gl_FragColor.rgb += uGlowColor * (rimF * (0.55 * uGhost * flick + 2.0 * uGlow) + 0.06 * uGlow);
        }` : ''}
        ${eyeOverlay ? `{
          // only while she faces the camera (fades out toward profile, like Star Rail's see-through bangs)
          float facing = dot(pvHeadFwd(), normalize(vViewPosition));
          gl_FragColor.a *= 0.55 * smoothstep(0.5, 0.82, facing);
        }` : ''}`);
  };
  const key = `peachi-toon4-${[holo, lining, rim, crisp, strands, faceSDF, eyeOverlay].map(Number).join('')}`;
  m.customProgramCacheKey = () => key;
  return m;
}

/** Inverted-hull outline: back faces pushed out along smooth normals, per-vertex line color. */
export function outlineMaterial(U, { px = 1.7, max = 0.006 } = {}) {
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
    uOutlinePx: { value: px },
    uOutlineMax: { value: max },
  }]);
  for (const k of ['uTime', 'uGhost', 'uGlow', 'uBaseY', 'uFade', 'uGlowColor', 'uFlare', 'uSwayK', 'uSelfLit', 'uRimK']) uniforms[k] = U[k];
  return new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    fog: true,
    vertexShader: /* glsl */`
      #include <common>
      #include <fog_pars_vertex>
      ${SWAY_PARS}
      attribute float aOL;
      attribute vec3 aOLC;
      varying vec3 vOLC;
      uniform float uOutlinePx, uOutlineMax;
      void main() {
        vec3 transformed = position;
        ${SWAY_MAIN}
        vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
        vec3 n = normalize(normalMatrix * normal);
        float w = min(uOutlinePx * 2.0 / (720.0 * projectionMatrix[1][1]) * -mvPosition.z, uOutlineMax) * aOL;
        mvPosition.xyz += n * w;
        gl_Position = projectionMatrix * mvPosition;
        vGWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vOLC = aOLC;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */`
      #include <common>
      #include <fog_pars_fragment>
      ${FADE_PARS}
      varying vec3 vOLC;
      void main() {
        ${FADE_MAIN}
        vec3 c = mix(vOLC, uGlowColor * 0.9, clamp(uGlow * 0.7 + uGhost * 0.12, 0.0, 1.0));
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
}
