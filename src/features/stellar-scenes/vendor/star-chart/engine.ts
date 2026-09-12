/**
 * Stellar Synth — 引擎门面（集成入口）
 * ====================================
 * 这是你的「星宿合成器」要接触的唯一对象。它负责：
 *   - mount(canvas)  挂载到一个 <canvas> 并启动渲染
 *   - dispose()      彻底销毁、释放资源（可被外部切换启用/销毁）
 *   - start()/stop() 暂停 / 恢复动画循环
 *   - resize()       统一的 resize 处理（也自动监听 window resize）
 *   - setConfig()    运行时覆写参数（层权重、颜色、视差…）
 *   - setAudioFrame()外部注入标准化音频帧
 *   - input.tap/press/hold/release  外部注入交互
 *   - useAudioSource(kind, url?)  内置麦克风/文件/模拟音频源切换
 *
 * 框架无关：不依赖 React。React 组件只是它的一个挂载壳。
 */

import * as THREE from "three";
import type { AudioFrame, EngineConfig } from "./config";
import { defaultConfig, idleAudioFrame } from "./config";
import { Scene } from "./scene";
import { InteractionController } from "./interaction-controller";
import {
  AudioAnalyser,
  FileAudioSource,
  MicAudioSource,
  SimulatedAudioSource,
  type AudioSource,
} from "./audio";

export type AudioSourceKind = "simulated" | "mic" | "file";

export interface EngineInput {
  tap: (x?: number, y?: number) => void;
  press: () => void;
  hold: (v?: number) => void;
  release: () => void;
}

export class StellarSynthEngine {
  private cfg: EngineConfig;
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: Scene | null = null;
  private interaction: InteractionController | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private host: HTMLElement | null = null;
  private raf = 0;
  private last = performance.now();
  private running = false;
  private reduced = false;

  // 音频
  private ctx: AudioContext | null = null;
  private analyser: AudioAnalyser | null = null;
  private source: AudioSource | null = null;
  private sourceKind: AudioSourceKind = "simulated";
  private simulated = new SimulatedAudioSource();
  private externalFrame: AudioFrame | null = null;
  private rawFrame: AudioFrame = idleAudioFrame();

  /** 外部注入交互的接口 */
  readonly input: EngineInput;

  constructor(config: Partial<EngineConfig> = {}) {
    this.cfg = { ...defaultConfig(), ...config };
    this.input = {
      tap: (x = 0, y = 0) => this.scene?.emitPulse(x, y),
      press: () => this.interaction?.externalPress(),
      hold: (v = 1) => this.interaction?.externalHold(v),
      release: () => this.interaction?.externalRelease(),
    };
  }

  /** 挂载到 canvas（host 用于承接指针事件，默认取 canvas 的父元素或自身） */
  mount(canvas: HTMLCanvasElement, host?: HTMLElement): void {
    this.canvas = canvas;
    this.host = host ?? canvas.parentElement ?? canvas;
    this.reduced =
      this.cfg.respectReducedMotion &&
      typeof matchMedia !== "undefined" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (this.reduced) this.cfg.particleCount = 0;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: false,
      powerPreference: "high-performance",
    });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new Scene(this.cfg);

    this.interaction = new InteractionController(this.host, this.cfg, {
      onTap: () => {
        const world = this.interaction!.pointerToWorld();
        this.scene!.emitPulse(world.x, world.y);
      },
    });
    this.interaction.attach();

    window.addEventListener("resize", this.resize, { passive: true });
    this.resize();
    this.start();
  }

  /** 统一 resize 处理 */
  resize = (): void => {
    if (!this.renderer || !this.canvas || !this.scene) return;
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, this.cfg.maxPixelRatio);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.scene.resize(w, h);
  };

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    if (this.reduced) {
      // 静态渲染一帧
      this.renderer?.render(this.scene!.scene, this.scene!.camera);
      return;
    }
    this.raf = requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  private frame = (now: number): void => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.frame);
    if (typeof document !== "undefined" && document.hidden) return;
    const dt = Math.min((now - this.last) / 1000, 0.05);
    this.last = now;

    // 取音频帧：外部注入 > 真实分析 > 模拟
    let frame: AudioFrame;
    if (this.externalFrame) {
      frame = this.externalFrame;
    } else if (this.analyser && this.sourceKind !== "simulated") {
      frame = this.analyser.read(dt);
    } else {
      frame = this.simulated.sampleFrame(now / 1000);
    }
    this.rawFrame = frame;

    this.interaction!.step(dt);
    this.scene!.update(now, dt, frame, this.interaction!.hold, this.interaction!.pointer);
    this.renderer!.render(this.scene!.scene, this.scene!.camera);
  };

  /** 运行时覆写配置（浅合并） */
  setConfig(patch: Partial<EngineConfig>): void {
    this.cfg = { ...this.cfg, ...patch };
  }

  /** 外部注入标准化音频帧（传 null 恢复内部音频源） */
  setAudioFrame(frame: AudioFrame | null): void {
    this.externalFrame = frame;
  }

  /** 当前使用的音频源类型 */
  get currentAudioSource(): AudioSourceKind {
    return this.sourceKind;
  }

  /**
   * 切换内置音频源。mic/file 需要用户手势触发（浏览器策略）。
   * @returns 切换是否成功
   */
  async useAudioSource(kind: AudioSourceKind, url?: string): Promise<boolean> {
    // 清理旧源
    this.source?.stop();
    this.source = null;
    this.analyser?.disconnect();
    this.externalFrame = null;

    if (kind === "simulated") {
      this.sourceKind = "simulated";
      return true;
    }

    try {
      if (!this.ctx) this.ctx = new AudioContext();
      if (this.ctx.state === "suspended") await this.ctx.resume();
      if (!this.analyser) this.analyser = new AudioAnalyser(this.ctx);

      this.source =
        kind === "mic"
          ? new MicAudioSource(this.ctx)
          : new FileAudioSource(this.ctx, url ?? "");
      const node = await this.source.start();
      if (node) this.analyser.connect(node);
      this.sourceKind = kind;
      return true;
    } catch {
      // 失败回退到模拟源
      this.source?.stop();
      this.source = null;
      this.sourceKind = "simulated";
      return false;
    }
  }

  /** 当前平滑前的原始音频帧（调试 / 宿主监控用） */
  get audioFrame(): AudioFrame {
    return this.rawFrame;
  }

  /** 彻底销毁并释放资源 */
  dispose(): void {
    this.stop();
    window.removeEventListener("resize", this.resize);
    this.interaction?.detach();
    this.source?.stop();
    this.analyser?.disconnect();
    this.ctx?.close().catch(() => {});
    this.scene?.dispose();
    this.renderer?.dispose();
    this.renderer = null;
    this.scene = null;
    this.interaction = null;
    this.ctx = null;
    this.analyser = null;
  }
}
