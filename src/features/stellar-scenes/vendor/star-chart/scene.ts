/**
 * Stellar Synth — 场景
 * ====================
 * 组合所有视觉层（粒子星云、白线星图、核心、脉冲），持有 Three.js scene/camera，
 * 并在 update(dt, audioFrame, hold, pointer) 中统一驱动每一层。
 */

import * as THREE from "three";
import type { AudioFrame, EngineConfig, PointerNDC } from "./config";
import { createGlowTexture } from "./gpu-assets";
import { ParticleNebulaField } from "./particle-nebula-field";
import { StarChartLayer } from "./star-chart-layer";
import { CoreGlow, PulseSystem } from "./core-glow";
import { AudioReactiveMapping } from "./audio-reactive-mapping";

export class Scene {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  private root = new THREE.Group();
  private chart = new THREE.Group();
  private glowTex: THREE.Texture;
  private nebula: ParticleNebulaField;
  private starChart: StarChartLayer;
  private core: CoreGlow;
  readonly pulses: PulseSystem;
  private mapping: AudioReactiveMapping;

  constructor(private cfg: EngineConfig) {
    this.camera = new THREE.PerspectiveCamera(44, 1, 0.1, 500);
    this.camera.position.z = 126;
    this.scene.add(this.root);
    this.root.add(this.chart);

    this.glowTex = createGlowTexture();
    this.mapping = new AudioReactiveMapping(cfg);

    // 中心核心 + 光晕
    this.core = new CoreGlow(this.glowTex, cfg.colors.ink);
    this.chart.add(this.core.core, this.core.halo);

    // 白线星图
    this.starChart = new StarChartLayer(this.glowTex, cfg.colors.ink);
    this.chart.add(this.starChart.group);

    // 底层粒子星云流场
    this.nebula = new ParticleNebulaField(
      cfg.particleCount,
      this.glowTex,
      cfg.colors.ink,
    );
    if (this.nebula.object) this.root.add(this.nebula.object);

    // 脉冲挂在 chart 上，跟随场景变换
    this.pulses = new PulseSystem(this.chart, cfg.colors.ink);
  }

  /** 根据视口尺寸调整相机与场景缩放 */
  resize(w: number, h: number): void {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    const s = Math.min(w, h) / 390;
    this.chart.scale.setScalar(s * 0.88);
    this.chart.position.y = h > w ? 8 : -2;
  }

  /** 发射脉冲（tap） */
  emitPulse(x: number, y: number): void {
    this.pulses.emit(x, y);
  }

  /** 每帧更新所有层 */
  update(now: number, dt: number, rawAudio: AudioFrame, hold: number, pointer: PointerNDC): void {
    this.mapping.ingest(rawAudio, dt);
    const audio = this.mapping.smoothed;
    const w = this.cfg.weights;
    const energy = this.mapping.energy(hold);
    const spin = this.mapping.spin(hold);

    // 场景整体自转 + 指针视差 + 随音频的缓慢摆动（更大动态）
    this.chart.rotation.z += dt * spin;
    const sway = 0.16 + audio.mid * this.cfg.weights.chart * 0.22;
    this.chart.rotation.x +=
      (pointer.y * this.cfg.parallax +
        Math.sin(now * 0.00013) * sway -
        this.chart.rotation.x) *
      0.045;
    this.chart.rotation.y +=
      (pointer.x * this.cfg.parallax +
        Math.cos(now * 0.00017) * sway -
        this.chart.rotation.y) *
      0.045;

    this.core.update(audio, hold, w.core, energy, this.cfg.coreGlow);
    this.starChart.update(dt, audio, hold, w.chart);
    this.nebula.update(now, dt, audio, pointer, w.nebula);
    this.pulses.update(dt, audio);
  }

  dispose(): void {
    this.nebula.dispose();
    this.starChart.dispose();
    this.core.dispose();
    this.pulses.dispose();
    this.glowTex.dispose();
  }
}
