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
    uShadeEdge: { value: 0.05 },
    uLightCap: { value: 1.06 }, // lit areas never exceed albedo × cap (anime cel look, no blow-out)
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

/**
 * Toon material with the Peachi injections.
 * flags: { holo, lining, rim = true, shade: shadow multiply color, strands: drawn hair lines along uv.x }
 */
export const SHADE = {
  cloth: new THREE.Color(0.8, 0.74, 0.93),
  skin: new THREE.Color(0.95, 0.72, 0.7),
  warm: new THREE.Color(0.86, 0.66, 0.74),
};
export function toonMaterial(U, params = {}, flags = {}) {
  const { holo = false, lining = false, rim = true, shade = SHADE.warm, strands = false } = flags;
  const m = new THREE.MeshToonMaterial(params);
  if (strands) m.defines = { ...(m.defines || {}), USE_UV: '' };
  m.toneMapped = false; // colors are authored to match the sheet; the cap below keeps them in range
  const own = { uShadeColor: { value: shade.clone() } };
  m.userData.shade = own.uShadeColor;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U, own);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + SWAY_PARS)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + SWAY_MAIN)
      .replace('#include <project_vertex>', '#include <project_vertex>\nvGWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + FADE_PARS + HOLO_PARS + '\nuniform vec3 uShadeColor, uLining;\nuniform float uShadeEdge, uLightCap;')
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
          diffuseColor.rgb *= 1.0 - 0.2 * line * (1.0 - smoothstep(0.15, 0.4, fw));` : ''}
          totalEmissiveRadiance += diffuseColor.rgb * uSelfLit;
        }`)
      .replace('#include <aomap_fragment>', `#include <aomap_fragment>
        {
          vec3 ls = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
          reflectedLight.directDiffuse = min(ls, diffuseColor.rgb * uLightCap);
          reflectedLight.indirectDiffuse = vec3(0.0);
        }`)
      .replace('#include <opaque_fragment>', `#include <opaque_fragment>
        ${rim ? `{
          float rimF = pow(1.0 - clamp(abs(dot(normalize(normal), normalize(vViewPosition))), 0.0, 1.0), 2.4);
          float flick = 0.85 + 0.15 * sin(uTime * 3.0 + vGWorld.y * 9.0);
          gl_FragColor.rgb += uGlowColor * (rimF * (0.55 * uGhost * flick + 2.0 * uGlow) + 0.06 * uGlow);
        }` : ''}`);
  };
  const key = `peachi-toon3-${holo ? 1 : 0}${lining ? 1 : 0}${rim ? 1 : 0}${strands ? 1 : 0}`;
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
