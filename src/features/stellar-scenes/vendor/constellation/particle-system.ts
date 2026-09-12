/**
 * ParticleSystem — the high-density GPU star-dust field (the visual body).
 * Tens of thousands of fine points drifting in a swirling flow field, pulled
 * toward the pointer/gravity on press. Driven by amplitude / high / press.
 */
import * as THREE from "three";
import { PARTICLE_VERT, PARTICLE_FRAG } from "./shaders";
import { createDotTexture, hexColor } from "./utils";
import type { AudioFrame, EngineParams } from "./types";

export class ParticleSystem {
  readonly points: THREE.Points;
  private material: THREE.ShaderMaterial;
  private geometry: THREE.BufferGeometry;
  private texture: THREE.Texture;

  constructor(params: EngineParams, texture?: THREE.Texture) {
    this.texture = texture ?? createDotTexture();
    this.geometry = ParticleSystem.buildGeometry(params.particleCount);
    this.material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uAmp: { value: 0 },
        uHigh: { value: 0 },
        uPress: { value: 0 },
        uBass: { value: 0 },
        uMid: { value: 0 },
        uBeat: { value: 0 },
        uPointer: { value: new THREE.Vector2() },
        uPointerInfluence: { value: params.pointerInfluence },
        uTex: { value: this.texture },
        uColorStar: { value: hexColor(params.palette.star) },
      },
      vertexShader: PARTICLE_VERT,
      fragmentShader: PARTICLE_FRAG,
    });
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
  }

  private static buildGeometry(count: number): THREE.BufferGeometry {
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    const size = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const r = Math.pow(Math.random(), 0.62) * 18 + Math.random() * 12;
      const a = Math.random() * Math.PI * 2;
      const z = (Math.random() - 0.5) * 28;
      pos[i * 3] = Math.cos(a) * r * (0.55 + Math.random() * 0.8);
      pos[i * 3 + 1] = Math.sin(a) * r * (0.75 + Math.random() * 0.5);
      pos[i * 3 + 2] = z;
      seed[i] = Math.random();
      size[i] = Math.random() * 1.4 + 0.35;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    geo.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
    return geo;
  }

  update(
    time: number,
    audio: AudioFrame,
    pointer: THREE.Vector2,
    press: number,
  ): void {
    const u = this.material.uniforms;
    u.uTime.value = time;
    u.uAmp.value = audio.amplitude;
    u.uHigh.value = audio.high;
    u.uPress.value = press;
    u.uBass.value = audio.bass;
    u.uMid.value = audio.mid;
    u.uBeat.value = audio.beat;
    u.uPointer.value.copy(pointer);
  }

  applyPalette(params: EngineParams): void {
    this.material.uniforms.uColorStar.value = hexColor(params.palette.star);
    this.material.uniforms.uPointerInfluence.value = params.pointerInfluence;
  }

  /** Rebuild the point cloud at a new count (host param change). */
  rebuild(params: EngineParams): void {
    this.geometry.dispose();
    this.geometry = ParticleSystem.buildGeometry(params.particleCount);
    this.points.geometry = this.geometry;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.texture.dispose();
  }
}
