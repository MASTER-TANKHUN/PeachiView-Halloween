// Post-processing for the game view: MSAA HDR render → bloom (neon, LEDs, candles, Peachi's glow) →
// grade (soft highlight roll-off instead of a filmic curve, so Peachi's toon colors stay as authored;
// vignette, a touch of lens fringing, film grain) → sRGB output.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uVignette: { value: 0.55 },
    uGrain: { value: 0.045 },
    uFringe: { value: 0.006 },
    uLift: { value: new THREE.Color(0.006, 0.003, 0.012) }, // shadows lean violet
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uTime, uVignette, uGrain, uFringe;
    uniform vec3 uLift;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 d = vUv - 0.5;
      float r2 = dot(d, d);
      vec3 col;
      col.r = texture2D(tDiffuse, vUv - d * uFringe * r2 * 4.0).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv + d * uFringe * r2 * 4.0).b;
      // highlights roll off toward white above 0.8 (linear); everything below is untouched
      float l = max(col.r, max(col.g, col.b));
      if (l > 0.8) { float t = l - 0.8; float nl = 0.8 + t / (1.0 + t / 0.2); col *= nl / l; col = mix(col, vec3(nl), clamp(t * 0.35, 0.0, 0.5)); }
      col += uLift * (1.0 - clamp(l * 6.0, 0.0, 1.0));
      col *= mix(1.0, smoothstep(0.92, 0.18, sqrt(r2) * 1.25), uVignette);
      float g = hash(vUv * 1024.0 + fract(uTime * 7.13)) - 0.5;
      col += g * uGrain * (0.015 + 0.25 * sqrt(max(col.g, 0.0)));
      gl_FragColor = vec4(max(col, 0.0), 1.0);
    }`,
};

export function createPost(renderer, scene, camera, { bloom = 0.55, radius = 0.55, threshold = 0.95 } = {}) {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, rt);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), bloom, radius, threshold);
  composer.addPass(bloomPass);
  const grade = new ShaderPass(GradeShader);
  composer.addPass(grade);
  composer.addPass(new OutputPass());
  let t = 0;
  return {
    composer, bloomPass, grade,
    render(dt = 0.016) { t += dt; grade.uniforms.uTime.value = t; composer.render(dt); },
    setSize(w, h) { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h); },
    set camera(c) { renderPass.camera = c; },
  };
}
