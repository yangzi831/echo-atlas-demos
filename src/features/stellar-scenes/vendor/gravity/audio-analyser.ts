/**
 * Stellar Synth — internal audio analysis.
 *
 * Wraps the Web Audio API to turn a local audio file or microphone stream into
 * a normalized {@link AudioFrame}. This is OPTIONAL: the host can bypass it
 * entirely by pushing frames through `StellarScene.setAudioFrame(...)`.
 *
 * Kept framework-agnostic and self-contained so it can be reused independently
 * of the visual engine.
 */
import type { AudioFrame, AudioSourceKind } from "./types";

const EMPTY_FRAME: AudioFrame = {
  amplitude: 0.5,
  bass: 0.32,
  mid: 0.2,
  high: 0.18,
  beat: 0,
  drone: 0.2,
};

export class AudioAnalyser {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private data: Uint8Array<ArrayBuffer> | null = null;
  private source: AudioSourceKind = "none";
  private mediaEl: HTMLAudioElement | null = null;
  private stream: MediaStream | null = null;
  private objectUrl: string | null = null;
  private lastBeat = 0;
  private drone = 0.2;

  /** Whether internal analysis is currently active. */
  get active(): boolean {
    return this.analyser !== null && this.source !== "none";
  }

  get kind(): AudioSourceKind {
    return this.source;
  }

  private ensure(): Promise<void> {
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      this.ctx = new Ctor();
    }
    if (!this.analyser) {
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 1024;
      this.data = new Uint8Array(new ArrayBuffer(this.analyser.frequencyBinCount));
    }
    return this.ctx.resume();
  }

  /** Attach and play a local audio file, looping. */
  async playFile(file: File): Promise<void> {
    await this.ensure();
    this.detachSource();
    this.objectUrl = URL.createObjectURL(file);
    const el = new Audio(this.objectUrl);
    el.crossOrigin = "anonymous";
    el.loop = true;
    const node = this.ctx!.createMediaElementSource(el);
    node.connect(this.analyser!);
    this.analyser!.connect(this.ctx!.destination);
    this.mediaEl = el;
    this.source = "file";
    await el.play().catch(() => {});
  }

  /** Attach the microphone stream (not routed to speakers to avoid feedback). */
  async startMic(): Promise<void> {
    await this.ensure();
    this.detachSource();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.stream = stream;
    this.ctx!.createMediaStreamSource(stream).connect(this.analyser!);
    this.source = "mic";
  }

  /** Stop and release the current internal source. */
  stop(): void {
    this.detachSource();
    this.source = "none";
  }

  private detachSource(): void {
    if (this.mediaEl) {
      this.mediaEl.pause();
      this.mediaEl.src = "";
      this.mediaEl = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }

  /**
   * Read the current normalized frame. Returns null when no internal analysis
   * is active (so the caller can fall back to a mock/external frame).
   */
  read(now: number): AudioFrame | null {
    if (!this.analyser || !this.data || this.source === "none") return null;
    this.analyser.getByteFrequencyData(this.data);
    const data = this.data;
    const len = data.length;
    let lo = 0;
    let mi = 0;
    let hi = 0;
    let all = 0;
    for (let i = 0; i < len; i++) {
      const v = data[i] / 255;
      all += v;
      if (i < 24) lo += v;
      else if (i < 150) mi += v;
      else hi += v;
    }
    const bass = lo / 24;
    const mid = mi / 126;
    const high = hi / (len - 150);
    const amplitude = clamp01((all / len) * 1.9);
    this.drone = this.drone * 0.96 + mid * 0.04;
    let beat = 0;
    if (bass > 0.56 && now - this.lastBeat > 330) {
      beat = 1;
      this.lastBeat = now;
    }
    return {
      amplitude,
      bass: clamp01(bass),
      mid: clamp01(mid),
      high: clamp01(high),
      beat,
      drone: clamp01(this.drone),
    };
  }

  /** Fully tear down the audio context. */
  dispose(): void {
    this.detachSource();
    this.source = "none";
    if (this.analyser) this.analyser.disconnect();
    this.analyser = null;
    this.data = null;
    if (this.ctx) this.ctx.close().catch(() => {});
    this.ctx = null;
  }

  static empty(): AudioFrame {
    return { ...EMPTY_FRAME };
  }
}

/**
 * Deterministic mock audio frame generator, used when no real audio source is
 * attached so the visual still "breathes" on first paint. Purely math-based.
 */
export function mockAudioFrame(now: number): AudioFrame {
  const t = now * 0.001;
  return {
    amplitude: 0.38 + 0.14 * Math.sin(t * 1.7) + 0.07 * Math.sin(t * 3.1),
    bass: 0.28 + 0.18 * Math.max(0, Math.sin(t * 1.05)),
    mid: 0.22 + 0.15 * Math.sin(t * 0.63 + 1.4),
    high: 0.14 + 0.12 * Math.sin(t * 7.2),
    beat: 0,
    drone: 0.35 + 0.15 * Math.sin(t * 0.22),
  };
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
