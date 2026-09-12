/**
 * AudioReactiveMapping — the audio → visual contract.
 *
 * Two ways to feed it, both producing the same normalized `AudioFrame`:
 *  1. External:  host calls `push(frame)` every analysis tick. This is the
 *     integration path for the "星宿合成器" synthesizer.
 *  2. Built-in demo source: `connectMicrophone()` or `connectMediaElement()`
 *     attach a Web Audio `AnalyserNode`, and `sample()` derives an AudioFrame
 *     from the live FFT (bass / mid / high bands + beat + drone + amplitude).
 *
 * When no audio is connected and `ambientMotion` is on, `synthesizeAmbient()`
 * produces a gentle breathing frame so the scene is never fully static.
 */
import { clamp01, damp } from "./utils";
import { EMPTY_AUDIO_FRAME, type AudioFrame } from "./types";

export class AudioReactiveMapping {
  /** The current smoothed frame the render loop reads. */
  readonly frame: AudioFrame = { ...EMPTY_AUDIO_FRAME };

  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private freq: Uint8Array | null = null;
  private source: AudioNode | null = null;
  private mediaEl: HTMLMediaElement | null = null;
  private externalPushed = false;

  /** Beat detection state. */
  private bassEnv = 0;
  private lastBeat = 0;

  get isConnected(): boolean {
    return this.analyser !== null;
  }

  /** External audio path (host integration). */
  push(partial: Partial<AudioFrame>): void {
    this.externalPushed = true;
    const f = this.frame;
    if (partial.amplitude != null) f.amplitude = clamp01(partial.amplitude);
    if (partial.bass != null) f.bass = clamp01(partial.bass);
    if (partial.mid != null) f.mid = clamp01(partial.mid);
    if (partial.high != null) f.high = clamp01(partial.high);
    if (partial.beat != null) f.beat = Math.max(f.beat, clamp01(partial.beat));
    if (partial.drone != null) f.drone = clamp01(partial.drone);
  }

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      this.ctx = new Ctor();
    }
    return this.ctx;
  }

  private buildAnalyser(): AnalyserNode {
    const ctx = this.ensureContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.78;
    this.analyser = analyser;
    this.freq = new Uint8Array(analyser.frequencyBinCount);
    return analyser;
  }

  /** Built-in demo source: microphone. Requires a user gesture beforehand. */
  async connectMicrophone(): Promise<void> {
    const ctx = this.ensureContext();
    await ctx.resume();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const src = ctx.createMediaStreamSource(stream);
    const analyser = this.buildAnalyser();
    src.connect(analyser);
    this.source = src;
    this.externalPushed = false;
  }

  /** Built-in demo source: an <audio>/<video> element (uploaded track). */
  async connectMediaElement(el: HTMLMediaElement): Promise<void> {
    const ctx = this.ensureContext();
    await ctx.resume();
    const src = ctx.createMediaElementSource(el);
    const analyser = this.buildAnalyser();
    src.connect(analyser);
    analyser.connect(ctx.destination);
    this.source = src;
    this.mediaEl = el;
    this.externalPushed = false;
  }

  private bandAverage(from: number, to: number): number {
    if (!this.freq) return 0;
    let sum = 0;
    const n = this.freq.length;
    const a = Math.floor(from * n);
    const b = Math.min(n, Math.floor(to * n));
    for (let i = a; i < b; i++) sum += this.freq[i];
    return b > a ? sum / (b - a) / 255 : 0;
  }

  /** Sample the live analyser into `frame` (built-in demo path). */
  private sampleAnalyser(now: number): void {
    if (!this.analyser || !this.freq) return;
    this.analyser.getByteFrequencyData(this.freq as Uint8Array<ArrayBuffer>);
    const bass = this.bandAverage(0.0, 0.08);
    const mid = this.bandAverage(0.08, 0.35);
    const high = this.bandAverage(0.35, 0.9);
    const amp = clamp01(bass * 0.5 + mid * 0.35 + high * 0.25);
    const f = this.frame;
    f.bass = bass;
    f.mid = mid;
    f.high = high;
    f.amplitude = amp;
    f.drone = damp(f.drone, clamp01(mid * 0.6 + bass * 0.4), 1.2, 0.016);
    // Simple onset detection on the bass envelope.
    const rising = bass - this.bassEnv;
    this.bassEnv = damp(this.bassEnv, bass, 6, 0.016);
    if (rising > 0.06 && now - this.lastBeat > 180) {
      f.beat = 1;
      this.lastBeat = now;
    }
  }

  /** Gentle self-motion when nothing is connected. */
  private synthesizeAmbient(time: number): void {
    const f = this.frame;
    f.amplitude = damp(f.amplitude, 0.24 + Math.sin(time * 0.8) * 0.04, 1.8, 0.016);
    f.high = damp(f.high, Math.abs(Math.sin(time * 2.7)) * 0.28, 3.5, 0.016);
    f.mid = damp(f.mid, 0.22 + Math.sin(time * 0.5) * 0.08, 1.5, 0.016);
    f.bass = damp(f.bass, 0.2 + Math.abs(Math.sin(time * 0.6)) * 0.14, 1.5, 0.016);
    f.drone = damp(f.drone, 0.34 + Math.sin(time * 0.21) * 0.1, 1.0, 0.016);
  }

  /**
   * Advance one frame. `time` is seconds, `now` ms. Chooses the right source:
   * live analyser > external push > ambient. Decays the transient beat.
   */
  update(time: number, now: number, ambientMotion: boolean): void {
    if (this.analyser) {
      this.sampleAnalyser(now);
    } else if (!this.externalPushed && ambientMotion) {
      this.synthesizeAmbient(time);
    }
    // Beat is a transient regardless of source.
    this.frame.beat *= 0.9;
  }

  dispose(): void {
    try {
      this.source?.disconnect();
      this.analyser?.disconnect();
      if (this.mediaEl) this.mediaEl = null;
      void this.ctx?.close();
    } catch {
      /* noop */
    }
    this.ctx = null;
    this.analyser = null;
    this.freq = null;
    this.source = null;
  }
}
