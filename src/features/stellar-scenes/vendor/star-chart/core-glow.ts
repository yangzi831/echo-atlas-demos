/**
 * Stellar Synth — 中心引力核心 + 脉冲波系统
 * =========================================
 * CoreGlow：居中的引力亮核，随 bass/beat/hold 膨胀与呼吸，是视觉锚点。
 * PulseSystem：tap 触发的环形扩散波，随 bass/beat 增强，随时间衰减（余辉）。
 */

import * as THREE from "three";
import type { AudioFrame } from "./config";

export class CoreGlow {
  readonly core: THREE.Sprite;
  readonly halo: THREE.Sprite;
  private coreMat: THREE.SpriteMaterial;
  private haloMat: THREE.SpriteMaterial;

  constructor(glowTex: THREE.Texture, ink: number) {
    this.coreMat = new THREE.SpriteMaterial({
      map: glowTex,
      color: ink,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.core = new THREE.Sprite(this.coreMat);
    this.core.scale.set(13, 13, 1);

    this.haloMat = this.coreMat.clone();
    this.haloMat.opacity = 0.18;
    this.halo = new THREE.Sprite(this.haloMat);
    this.halo.scale.set(54, 54, 1);
  }

  update(audio: AudioFrame, hold: number, weight: number, energy: number, glow = 1): void {
    const bass = audio.bass * weight;
    const beat = audio.beat * weight;
    const g = Math.max(0, glow);
    this.core.scale.setScalar((6 + bass * 8 + hold * 6 + beat * 5) * (0.4 + g * 0.6));
    this.halo.scale.setScalar((40 + bass * 26 + hold * 16) * (0.5 + g * 0.5));
    this.coreMat.opacity = (0.62 + energy * 0.48) * g;
    this.haloMat.opacity = (0.1 + bass * 0.22 + hold * 0.12) * g;
    this.core.visible = g > 0.001;
    this.halo.visible = g > 0.001;
  }

  dispose(): void {
    this.coreMat.dispose();
    this.haloMat.dispose();
  }
}

interface Pulse {
  line: THREE.Line;
  mat: THREE.LineBasicMaterial;
  geo: THREE.BufferGeometry;
  age: number;
  life: number;
}

export class PulseSystem {
  private pulses: Pulse[] = [];
  private ringPts: THREE.Vector3[];

  constructor(
    private parent: THREE.Object3D,
    private ink: number,
  ) {
    this.ringPts = [];
    for (let i = 0; i <= 160; i++) {
      const t = (i / 160) * Math.PI * 2;
      this.ringPts.push(new THREE.Vector3(Math.cos(t), Math.sin(t), 0));
    }
  }

  /** 在 (x,y) 处发射一圈扩散脉冲波 */
  emit(x = 0, y = 0): void {
    const geo = new THREE.BufferGeometry().setFromPoints(this.ringPts);
    const mat = new THREE.LineBasicMaterial({
      color: this.ink,
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
    });
    const line = new THREE.Line(geo, mat);
    line.position.set(x, y, 3);
    this.parent.add(line);
    this.pulses.push({ line, mat, geo, age: 0, life: 1.7 });
  }

  update(dt: number, audio: AudioFrame): void {
    for (let i = this.pulses.length - 1; i >= 0; i--) {
      const p = this.pulses[i];
      p.age += dt;
      const q = p.age / p.life;
      p.line.scale.setScalar(4 + q * (58 + audio.bass * 28));
      p.mat.opacity = (1 - q) * (0.68 + audio.beat * 0.25);
      if (q >= 1) {
        this.parent.remove(p.line);
        p.geo.dispose();
        p.mat.dispose();
        this.pulses.splice(i, 1);
      }
    }
  }

  dispose(): void {
    for (const p of this.pulses) {
      this.parent.remove(p.line);
      p.geo.dispose();
      p.mat.dispose();
    }
    this.pulses = [];
  }
}
