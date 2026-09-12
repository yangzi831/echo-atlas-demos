/**
 * Stellar Synth — particle system.
 *
 * The gravitational vortex flow field: tens of thousands of fine particles are
 * pulled tangentially by a curl-noise wind field while being drawn toward a
 * central attractor, producing the streaked, inward-spiralling lines of the
 * "Gravity Core" direction. Runs the per-particle simulation on the CPU into a
 * dynamic position buffer and renders it as additive point sprites.
 *
 * Self-contained around a THREE.Points object; the Scene owns lifecycle.
 */
import * as THREE from "three";
import type { EngineConfig } from "./types";
import type { VisualDrive } from "./audio-reactive-mapping";

const VERT = /* glsl */ `
attribute float aSeed;
varying vec3 vColor;
varying float vSeed;
uniform float uSize;
uniform float uBright;
uniform float uHigh;
void main() {
  vColor = color;
  vSeed = aSeed;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = uSize * (1.4 + uHigh * 2.2) * (12.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = /* glsl */ `
varying vec3 vColor;
varying float vSeed;
uniform float uBright;
void main() {
  vec2 p = gl_PointCoord - 0.5;
  float d = length(p);
  float a = smoothstep(0.5, 0.0, d);
  a *= 0.55 + 0.45 * sin(vSeed * 9.17);
  gl_FragColor = vec4(vColor * uBright, a);
}`;

export class ParticleSystem {
  readonly points: THREE.Points;
  private geo: THREE.BufferGeometry;
  private mat: THREE.ShaderMaterial;
  private pos: Float32Array;
  private col: Float32Array;
  private seed: Float32Array;
  private vel: Float32Array;
  private count: number;
  private cfg: EngineConfig;

  constructor(cfg: EngineConfig, count: number) {
    this.cfg = cfg;
    this.count = count;
    const n = count;
    this.pos = new Float32Array(n * 3);
    this.col = new Float32Array(n * 3);
    this.seed = new Float32Array(n);
    this.vel = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) this.spawn(i, 1.1);

    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute(
      "position",
      new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage),
    );
    this.geo.setAttribute("color", new THREE.BufferAttribute(this.col, 3));
    this.geo.setAttribute("aSeed", new THREE.BufferAttribute(this.seed, 1));

    this.mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
      uniforms: {
        uSize: { value: cfg.pointSize },
        uBright: { value: 1 },
        uHigh: { value: 0.2 },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
    });

    this.points = new THREE.Points(this.geo, this.mat);
  }

  private spawn(i: number, wide = 1): void {
    const r = Math.pow(Math.random(), 0.42) * 8.8 * wide + 0.22;
    const a = Math.random() * Math.PI * 2;
    const z = (Math.random() - 0.5) * 7;
    this.pos[i * 3] = Math.cos(a) * r * 1.24;
    this.pos[i * 3 + 1] = Math.sin(a) * r * 0.74;
    this.pos[i * 3 + 2] = z;
    this.seed[i] = Math.random() * 10;
    const base = this.cfg.particleColor;
    const cool = 0.72 + Math.random() * 0.28;
    this.col[i * 3] = base[0] * cool;
    this.col[i * 3 + 1] = base[1] * (cool + Math.random() * 0.08);
    this.col[i * 3 + 2] = base[2] * (cool + Math.random() * 0.04);
  }

  /**
   * Advance the flow-field simulation one frame.
   * @param dt      delta time in seconds
   * @param now     high-res timestamp (ms)
   * @param drive   audio+interaction drive values
   * @param pointer smoothed pointer state in [-1,1]
   */
  update(
    dt: number,
    now: number,
    drive: VisualDrive,
    pointer: { x: number; y: number; active: number },
  ): void {
    const cfg = this.cfg;
    this.mat.uniforms.uBright.value = drive.brightness;
    this.mat.uniforms.uHigh.value = drive.high;

    const px = pointer.x * 6.5;
    const py = pointer.y * 3.8;
    const t = now * 0.00023;
    const sw = cfg.swirl + drive.swirlBoost;
    const att = cfg.attractor + drive.attractorBoost;
    const pr2 = cfg.pointerRadius;
    const pos = this.pos;
    const vel = this.vel;
    const seed = this.seed;
    const n = this.count;

    for (let i = 0; i < n; i++) {
      const k = i * 3;
      const x = pos[k];
      const y = pos[k + 1];
      const z = pos[k + 2];
      const rr = Math.hypot(x, y) + 0.001;
      let a = Math.atan2(y, x);
      const curl =
        Math.sin(x * 0.73 + y * 0.37 + z * 0.25 + t * 9 + seed[i]) *
          cfg.curl +
        Math.cos(y * 0.9 - t * 7 + seed[i]) * 0.25;
      a += Math.PI / 2 + curl;
      let vx = Math.cos(a) * sw - (x / rr) * att;
      let vy = Math.sin(a) * sw - (y / rr) * att;
      if (pointer.active) {
        const dx = x - px;
        const dy = y - py;
        const d2 = dx * dx + dy * dy;
        if (d2 < pr2) {
          const f = (1 - d2 / pr2) * cfg.pointerInfluence;
          vx += -dy * f;
          vy += dx * f;
        }
      }
      vel[k] = vel[k] * 0.92 + vx;
      vel[k + 1] = vel[k + 1] * 0.92 + vy;
      vel[k + 2] = vel[k + 2] * 0.96 + Math.sin(t * 20 + seed[i]) * 0.001;
      pos[k] += vel[k];
      pos[k + 1] += vel[k + 1];
      pos[k + 2] += vel[k + 2];
      if (rr < 0.18 || rr > 10.8 || Math.abs(pos[k + 2]) > 7.5) this.spawn(i, 1.05);
    }
    this.geo.attributes.position.needsUpdate = true;
  }

  setConfig(cfg: EngineConfig): void {
    this.cfg = cfg;
    this.mat.uniforms.uSize.value = cfg.pointSize;
  }

  dispose(): void {
    this.geo.dispose();
    this.mat.dispose();
  }
}
