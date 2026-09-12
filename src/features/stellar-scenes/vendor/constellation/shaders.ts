/**
 * GLSL shader sources for the engine. Isolated here so the visual language
 * (nebula fbm, curl-noise particle drift, node glow) is editable without
 * touching the render/scene wiring. All shaders share the warm→bone→green
 * palette derived from the reference nebula (NGC7000).
 */

/* ---- Volumetric nebula background (full-screen fbm cloud) ---- */
export const NEBULA_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const NEBULA_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uTime, uAmp, uBeat, uDrone, uBass, uMid;
uniform vec2 uPointer;
uniform vec3 uColorStar;

float hash(vec2 p){ return fract(sin(dot(p, vec2(41.7, 289.1))) * 45758.54); }
float n(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1,0)), f.x),
             mix(hash(i + vec2(0,1)), hash(i + vec2(1)), f.x), f.y);
}
float fbm(vec2 p){
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 5; i++){ s += a * n(p); p *= 2.05; a *= 0.52; }
  return s;
}
void main(){
  vec2 uv = vUv;
  vec2 p = (uv - 0.5) * vec2(1.25, 1.0);
  // Bass gently inflates / contracts the whole cloud (large-scale swell).
  p *= 1.0 - uBass * 0.12 - uBeat * 0.05;
  float d = length(p - uPointer * 0.08);
  // Mid frequency speeds up the texture flow; drone adds slow drift.
  float drift = uTime * 0.025 + uDrone * 0.4 + uMid * 0.35;
  float f = fbm(p * 3.2 + vec2(drift, -uTime * 0.018 - uMid * 0.2));
  float lane = smoothstep(0.28, 0.78, fbm(p * 6.0 + 1.7 + uBass * 0.4));
  // Bass thickens the cloud body; the whole field breathes with the low end.
  float cloud = smoothstep(0.36 - uBass * 0.1, 0.86, f) * (1.0 - lane * 0.52);
  cloud *= 1.0 + uBass * 0.5 + uAmp * 0.25;
  float core = exp(-d * 3.2) * (0.08 + uBeat * 0.34 + uBass * 0.18);
  vec3 bg = vec3(0.02, 0.023, 0.047);
  vec3 warm = vec3(0.72, 0.42, 0.28);
  vec3 bone = uColorStar;
  vec3 green = vec3(0.18, 0.32, 0.27);
  vec3 col = mix(bg, warm, cloud * 0.55 + core);
  col = mix(col, bone, core * 0.65 + uAmp * 0.12 + uBeat * 0.1);
  col += green * smoothstep(0.58, 0.96, fbm(p * 2.1 - 2.0)) * (0.16 + uMid * 0.12);
  float vign = smoothstep(0.95, 0.18, length(p));
  gl_FragColor = vec4(col * vign, cloud * 0.42 + core * 0.55);
}
`;

/* ---- GPU star-dust particles (curl-ish drift + pointer gravity) ---- */
export const PARTICLE_VERT = /* glsl */ `
attribute float aSeed, aSize;
uniform float uTime, uAmp, uHigh, uPress, uPointerInfluence, uBass, uMid, uBeat;
uniform vec2 uPointer;
varying float vA;
void main(){
  vec3 p = position;
  float t = uTime * 0.08 + aSeed * 6.283;
  // Mid frequency reorganizes the swarm (flow reshuffle); bass adds swell.
  float swirl = 0.28 + uPress * 0.9 + uAmp * 0.35 + uMid * 0.7;
  p.xy += vec2(cos(t + p.y * 0.04), sin(t + p.x * 0.05)) * swirl;
  // Bass radially inflates the whole dust field — a large-scale breathing pulse.
  float radial = 1.0 + uBass * 0.28 + uBeat * 0.12 * (0.5 + 0.5 * sin(aSeed * 30.0));
  p.xy *= radial;
  vec2 m = uPointer * 8.0;
  float d = distance(p.xy, m);
  p.xy += normalize(m - p.xy + 0.0001) * exp(-d * 0.16) * (uPress * 2.4 + 0.35) * uPointerInfluence;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  // High + beat drive per-particle twinkle and size punch.
  float twinkle = 1.2 + uHigh * 2.2 + uPress * 0.6 + uBeat * 1.4 * step(0.5, fract(aSeed * 91.0 + uTime));
  gl_PointSize = (aSize * twinkle) * (28.0 / -mv.z);
  vA = 0.3 + uAmp * 0.6 + uBass * 0.2 + sin(t * 9.0) * uHigh * 0.28 + uBeat * 0.2;
  gl_Position = projectionMatrix * mv;
}
`;

export const PARTICLE_FRAG = /* glsl */ `
uniform sampler2D uTex;
uniform vec3 uColorStar;
varying float vA;
void main(){
  vec4 s = texture2D(uTex, gl_PointCoord);
  gl_FragColor = vec4(uColorStar, s.a * vA);
}
`;
