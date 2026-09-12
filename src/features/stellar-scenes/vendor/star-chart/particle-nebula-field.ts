/**
 * Stellar Synth — 底层粒子星云流场
 * ================================
 * 数万级细小粒子在 curl-noise 式流场中低速漂移，向中心呈引力聚焦，
 * 铺陈纵深与星尘感。响应 amplitude / bass / mid / high / drone。
 */

import * as THREE from "three";
import type { AudioFrame, PointerNDC } from "./config";

export class ParticleNebulaField {
  readonly object: THREE.Points | null = null;
  private geo: THREE.BufferGeometry | null = null;
  private mat: THREE.PointsMaterial | null = null;
  private pos: Float32Array | null = null;
  private base: Float32Array | null = null;
  private readonly count: number;

  constructor(count: number, glowTex: THREE.Texture, ink: number) {
    this.count = count;
    if (count <= 0) return;

    const pos = new Float32Array(count * 3);
    const base = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = Math.pow(Math.random(), 0.58) * 78;
      const a = Math.random() * Math.PI * 2;
      const z = (Math.random() - 0.5) * 62;
      const flat = 0.54 + Math.random() * 0.36;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r * flat + (Math.random() - 0.5) * 18;
      pos[i * 3] = base[i * 3] = x;
      pos[i * 3 + 1] = base[i * 3 + 1] = y;
      pos[i * 3 + 2] = base[i * 3 + 2] = z;
    }
    this.pos = pos;
    this.base = base;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.32,
      map: glowTex,
      color: ink,
      transparent: true,
      opacity: 0.52,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.geo = geo;
    this.mat = mat;
    this.object = new THREE.Points(geo, mat);
  }

  /**
   * @param now       毫秒时间戳
   * @param dt        帧间隔（秒）
   * @param audio     标准化音频帧
   * @param pointer   归一化指针（视差 / 局部扰动）
   * @param weight    该层音频响应权重
   */
  update(
    now: number,
    dt: number,
    audio: AudioFrame,
    pointer: PointerNDC,
    weight: number,
  ): void {
    if (!this.geo || !this.pos || !this.base || !this.mat) return;
    const pos = this.pos;
    const base = this.base;
    const bass = audio.bass * weight;
    const mid = audio.mid * weight;
    const drone = audio.drone * weight;
    const beat = audio.beat * weight;
    // 随拍呼吸：低频撑开整体半径，节拍瞬间外推一把 —— 点云随音乐脉动
    const pump = 1 + bass * 0.22 + beat * 0.34;
    // 高频抖动强度：让微粒随高频跳动
    const jitter = audio.high * weight * 3.2;

    for (let i = 0; i < this.count; i++) {
      const j = i * 3;
      const x = base[j];
      const y = base[j + 1];
      const z = base[j + 2];
      const r = Math.hypot(x, y) + 0.001;
      // 螺旋牵引：越近中心角速度越高（引力感），随 bass 增强
      const a =
        Math.atan2(y, x) +
        now * 0.000025 * (1 + bass * 2) +
        (80 / (r + 30)) * dt * bass;
      // curl-noise 式流动波纹，随 mid 增强
      const wave = Math.sin(now * 0.0007 + x * 0.045 + z * 0.026) * (0.7 + mid * 1.8);
      // 高频细抖（每粒相位不同），随高频能量增强
      const jx = Math.sin(now * 0.011 + i * 1.7) * jitter * 0.12;
      const jy = Math.cos(now * 0.013 + i * 2.3) * jitter * 0.12;
      pos[j] = Math.cos(a) * r * pump + pointer.x * mid * 1.8 + wave + jx;
      pos[j + 1] =
        Math.sin(a) * r * 0.72 * pump +
        pointer.y * mid * 1.8 +
        Math.cos(now * 0.00045 + y * 0.05) * 1.2 +
        jy;
      pos[j + 2] = z + Math.sin(now * 0.0006 + r * 0.06) * 7 * drone;
    }
    this.geo.attributes.position.needsUpdate = true;
    // 亮度随节拍闪一下，随高频微闪
    this.mat.opacity =
      0.38 + audio.amplitude * weight * 0.4 + audio.high * weight * 0.28 + beat * 0.22;
    this.mat.size = 0.26 + audio.high * weight * 0.2 + beat * 0.14;
  }

  dispose(): void {
    this.geo?.dispose();
    this.mat?.dispose();
  }
}
