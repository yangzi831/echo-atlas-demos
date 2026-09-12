/**
 * Stellar Synth — 音频源与分析
 * ============================
 * AudioSource 是统一的音频源接口：麦克风 / 音频文件 / 模拟发生器都实现它。
 * AudioAnalyser 把任意 AudioNode 的 FFT 数据切分为频段，产出标准化 AudioFrame。
 *
 * 集成说明：如果你的「星宿合成器」已经有自己的音频分析，可以完全跳过这里，
 * 直接调用 engine.setAudioFrame(frame) 注入你算好的 AudioFrame。
 */

import type { AudioFrame } from "./config";
import { idleAudioFrame } from "./config";

/** 音频源统一接口 */
export interface AudioSource {
  readonly kind: "mic" | "file" | "simulated";
  /** 启动并返回一个可连接到 AnalyserNode 的输出（模拟源返回 null） */
  start(): Promise<AudioNode | null>;
  /** 停止并释放资源 */
  stop(): void;
  /** 模拟源专用：直接产出当前帧（真实源返回 null，交给 AudioAnalyser） */
  sampleFrame?(timeSec: number): AudioFrame;
}

/** 麦克风音频源 */
export class MicAudioSource implements AudioSource {
  readonly kind = "mic" as const;
  private stream: MediaStream | null = null;
  constructor(private ctx: AudioContext) {}
  async start(): Promise<AudioNode | null> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false },
    });
    return this.ctx.createMediaStreamSource(this.stream);
  }
  stop(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }
}

/** 音频文件源（播放并驱动可视化） */
export class FileAudioSource implements AudioSource {
  readonly kind = "file" as const;
  private el: HTMLAudioElement | null = null;
  private node: MediaElementAudioSourceNode | null = null;
  constructor(
    private ctx: AudioContext,
    private url: string,
  ) {}
  async start(): Promise<AudioNode | null> {
    const el = new Audio(this.url);
    el.crossOrigin = "anonymous";
    el.loop = true;
    this.el = el;
    this.node = this.ctx.createMediaElementSource(el);
    // 文件源需连接到扬声器才能听到声音
    this.node.connect(this.ctx.destination);
    await el.play().catch(() => {});
    return this.node;
  }
  stop(): void {
    this.el?.pause();
    this.node?.disconnect();
    this.el = null;
    this.node = null;
  }
}

/**
 * 模拟音频发生器 —— 无需麦克风/文件即可展示完整效果的 fallback / 演示模式。
 * 合成带 BPM 的 beat、起伏的 bass/mid/high 与 drone 铺底。
 */
export class SimulatedAudioSource implements AudioSource {
  readonly kind = "simulated" as const;
  constructor(private bpm = 82) {}
  async start(): Promise<AudioNode | null> {
    return null; // 无真实音频节点，直接由 sampleFrame 产帧
  }
  stop(): void {}
  sampleFrame(t: number): AudioFrame {
    const ph = ((t * this.bpm) / 60) % 1;
    const beat = ph < 0.045 ? 1 - ph / 0.045 : 0;
    return {
      amplitude: 0.22 + 0.15 * Math.sin(t * 0.7) ** 2 + 0.28 * beat,
      bass: 0.18 + 0.5 * beat + 0.12 * Math.sin(t * 0.47 + 1) ** 2,
      mid: 0.26 + 0.22 * Math.sin(t * 0.91) ** 2,
      high: 0.18 + 0.2 * Math.sin(t * 5.1) ** 2 + 0.35 * beat,
      beat,
      drone: 0.42 + 0.22 * Math.sin(t * 0.12),
    };
  }
}

/**
 * FFT 分析器：从真实音频节点提取频谱，切分为 bass/mid/high，
 * 做时间平滑并检测 beat，产出标准化 AudioFrame。
 */
export class AudioAnalyser {
  private analyser: AnalyserNode;
  private freq: Uint8Array;
  private prevBass = 0;
  private beatEnv = 0;
  private frame: AudioFrame = idleAudioFrame();

  constructor(private ctx: AudioContext, fftSize = 4096) {
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = fftSize;
    this.analyser.smoothingTimeConstant = 0.72;
    this.freq = new Uint8Array(this.analyser.frequencyBinCount);
  }

  connect(node: AudioNode): void {
    node.connect(this.analyser);
  }

  disconnect(): void {
    try {
      this.analyser.disconnect();
    } catch {
      /* noop */
    }
  }

  /** 采一帧频谱并映射为 AudioFrame */
  read(dt: number): AudioFrame {
    this.analyser.getByteFrequencyData(this.freq as Uint8Array<ArrayBuffer>);
    const n = this.freq.length;
    // 频段边界（大致：bass<8%, mid 8–45%, high 45–100%）
    const bEnd = Math.floor(n * 0.08);
    const mEnd = Math.floor(n * 0.45);
    let bass = 0,
      mid = 0,
      high = 0,
      total = 0;
    for (let i = 0; i < n; i++) {
      const v = this.freq[i] / 255;
      total += v;
      if (i < bEnd) bass += v;
      else if (i < mEnd) mid += v;
      else high += v;
    }
    bass /= Math.max(1, bEnd);
    mid /= Math.max(1, mEnd - bEnd);
    high /= Math.max(1, n - mEnd);
    const amplitude = total / n;

    // beat 检测：bass 骤增 → 触发脉冲冲量
    const rise = bass - this.prevBass;
    if (rise > 0.06 && bass > 0.3) this.beatEnv = 1;
    this.prevBass = bass;
    this.beatEnv = Math.max(0, this.beatEnv - dt * 4.2);

    // drone：低频能量的缓慢持续分量
    const drone = Math.min(1, (bass * 0.6 + mid * 0.4) * 0.9 + 0.15);

    const f = this.frame;
    const s = 0.35; // 帧内轻度平滑
    f.amplitude += (amplitude * 2.4 - f.amplitude) * s;
    f.bass += (bass * 1.6 - f.bass) * s;
    f.mid += (mid * 2.2 - f.mid) * s;
    f.high += (high * 2.6 - f.high) * s;
    f.beat = this.beatEnv;
    f.drone += (drone - f.drone) * 0.08;
    // 夹紧
    f.amplitude = Math.min(1, f.amplitude);
    f.bass = Math.min(1, f.bass);
    f.mid = Math.min(1, f.mid);
    f.high = Math.min(1, f.high);
    return f;
  }
}
