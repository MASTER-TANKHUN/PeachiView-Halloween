// Peachi materials: anime two-tone toon shading with tinted shadows, a holographic film for the
// jacket/sock, vertex sway for hair & skirt, the ghost treatment (dithered leg fade, pink rim, self-light)
// and an inverted-hull outline that follows the same deformation.
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
    uShadeColor: { value: new THREE.Color(0.66, 0.54, 0.72) },
    uShadeEdge: { value: 0.02 },
    uLining: { value: new THREE.Color(0xff8dbd) },
  };
}

const SWAY_PARS = /* glsl */`
attribute vec2 aSway;
uniform float uTime, uFlare, uSwayK;
varying vec3 vGWorld;
`;
// aSway.x = displacement amplitude (m) at this vertex, aSway.y = phase.
const SWAY_MAIN = /* glsl */`
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
uniform float uGhost, uGlow, uBaseY, uTime, uSelfLit;
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

const _cache = new Map();

/**
 * Toon material with the Peachi injections.
 * flags: { holo, lining, rim = true, faceLit }
 */
export function toonMaterial(U, params = {}, flags = {}) {
  const { holo = false, lining = false, rim = true } = flags;
  const m = new THREE.MeshToonMaterial(params);
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + SWAY_PARS)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + SWAY_MAIN)
      .replace('#include <project_vertex>', '#include <project_vertex>\nvGWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + FADE_PARS + '\nuniform vec3 uShadeColor, uLining;\nuniform float uShadeEdge;')
      .replace('#include <gradientmap_pars_fragment>', /* glsl */`
        vec3 getGradientIrradiance(vec3 normal, vec3 lightDirection) {
          float dotNL = dot(normal, lightDirection);
          float s = smoothstep(uShadeEdge - 0.06, uShadeEdge + 0.06, dotNL);
          return mix(uShadeColor, vec3(1.0), s);
        }`)
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n' + FADE_MAIN)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        {
          ${holo ? `
          // holographic film: pastel rainbow that slides with view angle and position (white areas only)
          vec3 hv = normalize(vViewPosition);
          float ndv = dot(normal, hv);
          float wHolo = smoothstep(0.78, 0.92, min(diffuseColor.r, min(diffuseColor.g, diffuseColor.b)));
          float hk = ndv * 1.25 + vGWorld.y * 2.6 + vGWorld.x * 1.7 + vGWorld.z * 1.1 + uTime * 0.05;
          vec3 hc = 0.5 + 0.5 * cos(6.2832 * (hk + vec3(0.0, 0.33, 0.67)));
          hc = mix(vec3(1.0), hc, 0.34);
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * hc * 1.03, wHolo);
          totalEmissiveRadiance += diffuseColor.rgb * pow(1.0 - abs(ndv), 3.0) * 0.18 * wHolo;` : ''}
          ${lining ? 'if (!gl_FrontFacing) diffuseColor.rgb = uLining;' : ''}
          totalEmissiveRadiance += diffuseColor.rgb * uSelfLit;
        }`)
      .replace('#include <opaque_fragment>', `#include <opaque_fragment>
        ${rim ? `{
          float rimF = pow(1.0 - clamp(abs(dot(normalize(normal), normalize(vViewPosition))), 0.0, 1.0), 2.4);
          float flick = 0.85 + 0.15 * sin(uTime * 3.0 + vGWorld.y * 9.0);
          gl_FragColor.rgb += uGlowColor * (rimF * (0.55 * uGhost * flick + 2.0 * uGlow) + 0.06 * uGlow);
        }` : ''}`);
  };
  const key = `peachi-toon-${holo ? 1 : 0}${lining ? 1 : 0}${rim ? 1 : 0}`;
  m.customProgramCacheKey = () => key;
  return m;
}

/** Inverted-hull outline: back faces pushed out along smooth normals, constant-ish pixel width. */
export function outlineMaterial(U, { color = 0x2b1624, px = 1.7, max = 0.006 } = {}) {
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
    uOutlineColor: { value: new THREE.Color(color) },
    uOutlinePx: { value: px },
    uOutlineMax: { value: max },
  }]);
  for (const k of ['uTime', 'uGhost', 'uGlow', 'uBaseY', 'uFade', 'uGlowColor', 'uFlare', 'uSwayK']) uniforms[k] = U[k];
  return new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    fog: true,
    vertexShader: /* glsl */`
      #include <common>
      #include <fog_pars_vertex>
      ${SWAY_PARS}
      attribute float aOL;
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
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */`
      #include <common>
      #include <fog_pars_fragment>
      ${FADE_PARS}
      uniform vec3 uOutlineColor;
      void main() {
        ${FADE_MAIN}
        vec3 c = mix(uOutlineColor, uGlowColor * 0.9, clamp(uGlow * 0.7 + uGhost * 0.12, 0.0, 1.0));
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
}
