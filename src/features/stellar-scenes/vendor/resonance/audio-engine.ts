// Unified audio analysis for the Resonance Axis visual.
// Extracts a rich feature set (not a single volume value) from mic or file,
// and synthesizes an autonomous demo signal when nothing is playing.
// Everything here is framework-agnostic and disposable.

export interface AudioFeatures {
  /** Overall energy 0..~1.5 (smoothed). */
  energy: number;
  /** Low band 0..~1.5. */
  bass: number;
  /** Mid band 0..~1.5. */
  mid: number;
  /** High band 0..~1.5. */
  high: number;
  /** Beat/transient pulse 0..1 with decay. */
  beat: number;
  /** True only on the exact frame a new beat/transient is detected. */
  beatOnset: boolean;
  /** Monotonically increasing id, bumped on every detected beat. */
  beatId: number;
  /** Spectral flux (rate of spectrum change) 0..1. */
  flux: number;
  /** Normalized frequency data 0..1 (length = fftBins). */
  spectrum: Float32Array;
  /** Normalized waveform -1..1 (length = fftBins). */
  waveform: Float32Array;
  /** Whether a real (mic/file) source is currently feeding the analyser. */
  live: boolean;
}

export type AudioSourceKind = "none" | "mic" | "file";

const FFT = 1024;
const BINS = FFT / 2;

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private freqBytes = new Uint8Array(BINS);
  private timeBytes = new Uint8Array(BINS);

  private micStream: MediaStream | null = null;
  private micNode: MediaStreamAudioSourceNode | null = null;
  private el: HTMLAudioElement | null = null;
  private elNode: MediaElementAudioSourceNode | null = null;

  private kind: AudioSourceKind = "none";
  private objectUrl: string | null = null;

  // smoothed feature state
  private sBass = 0;
  private sMid = 0;
  private sHigh = 0;
  private sEnergy = 0;
  private beatEnv = 0;
  private lastBeatAt = -10;
  private beatId = 0;
  private prevSpectrum = new Float32Array(BINS);
  private fluxEnv = 0;
  private bassHistory: number[] = [];
  private externalFeatures: AudioFeatures | null = null;

  private outSpectrum = new Float32Array(BINS);
  private outWaveform = new Float32Array(BINS);

  smoothing = 0.72;
  sensitivity = 1.0;

  readonly fftBins = BINS;

  /** Host integration path: reuse an existing analyser instead of opening a second one. */
  pushExternal(features: Partial<AudioFeatures>) {
    const previous = this.externalFeatures;
    this.externalFeatures = {
      energy: features.energy ?? previous?.energy ?? 0,
      bass: features.bass ?? previous?.bass ?? 0,
      mid: features.mid ?? previous?.mid ?? 0,
      high: features.high ?? previous?.high ?? 0,
      beat: features.beat ?? previous?.beat ?? 0,
      beatOnset: features.beatOnset ?? previous?.beatOnset ?? false,
      beatId: features.beatId ?? previous?.beatId ?? 0,
      flux: features.flux ?? previous?.flux ?? 0,
      spectrum: features.spectrum ?? previous?.spectrum ?? new Float32Array(BINS),
      waveform: features.waveform ?? previous?.waveform ?? new Float32Array(BINS),
      live: features.live ?? previous?.live ?? true,
    };
  }

  private ensureCtx(): AudioContext {
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      this.ctx = new Ctor();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = FFT;
      this.analyser.smoothingTimeConstant = 0.65;
    }
    return this.ctx;
  }

  get sourceKind(): AudioSourceKind {
    return this.kind;
  }

  get audioElement(): HTMLAudioElement | null {
    return this.el;
  }

  async resume() {
    if (this.ctx && this.ctx.state === "suspended") {
      await this.ctx.resume();
    }
  }

  private disconnectSources() {
    if (this.micNode) {
      try {
        this.micNode.disconnect();
      } catch {}
      this.micNode = null;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop());
      this.micStream = null;
    }
    if (this.elNode) {
      try {
        this.elNode.disconnect();
      } catch {}
      this.elNode = null;
    }
    if (this.el) {
      this.el.pause();
      this.el = null;
    }
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }

  async useMic(): Promise<void> {
    const ctx = this.ensureCtx();
    await this.resume();
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });
    this.disconnectSources();
    this.micStream = stream;
    this.micNode = ctx.createMediaStreamSource(stream);
    this.micNode.connect(this.analyser!);
    this.kind = "mic";
  }

  /** Load a file, returns the <audio> element so the UI can control playback. */
  async useFile(file: File): Promise<HTMLAudioElement> {
    const ctx = this.ensureCtx();
    await this.resume();
    this.disconnectSources();
    const url = URL.createObjectURL(file);
    this.objectUrl = url;
    const el = new Audio(url);
    el.crossOrigin = "anonymous";
    el.loop = true;
    this.el = el;
    this.elNode = ctx.createMediaElementSource(el);
    this.elNode.connect(this.analyser!);
    this.analyser!.connect(ctx.destination);
    this.kind = "file";
    return el;
  }

  stopSource() {
    this.disconnectSources();
    this.kind = "none";
  }

  /** Sample the analyser (or synthesize demo) and return smoothed features. */
  sample(timeSec: number): AudioFeatures {
    if (this.externalFeatures) return this.externalFeatures;
    const alpha = 1 - Math.min(0.95, Math.max(0, this.smoothing));
    const live = this.kind !== "none" && !!this.analyser;

    let rawBass = 0;
    let rawMid = 0;
    let rawHigh = 0;
    const spectrum = this.outSpectrum;
    const waveform = this.outWaveform;

    if (live && this.analyser) {
      this.analyser.getByteFrequencyData(this.freqBytes);
      this.analyser.getByteTimeDomainData(this.timeBytes);

      const bassEnd = Math.floor(BINS * 0.08);
      const midEnd = Math.floor(BINS * 0.4);
      let bSum = 0;
      let mSum = 0;
      let hSum = 0;
      let fluxSum = 0;
      for (let i = 0; i < BINS; i++) {
        const v = this.freqBytes[i] / 255;
        spectrum[i] = v;
        const prev = this.prevSpectrum[i];
        const d = v - prev;
        if (d > 0) fluxSum += d;
        this.prevSpectrum[i] = v;
        if (i < bassEnd) bSum += v;
        else if (i < midEnd) mSum += v;
        else hSum += v;
        waveform[i] = (this.timeBytes[i] - 128) / 128;
      }
      rawBass = (bSum / bassEnd) * this.sensitivity;
      rawMid = (mSum / (midEnd - bassEnd)) * this.sensitivity;
      rawHigh = (hSum / (BINS - midEnd)) * this.sensitivity * 1.35;
      const flux = (fluxSum / BINS) * 6 * this.sensitivity;
      this.fluxEnv = Math.max(flux, this.fluxEnv * 0.9);
    } else {
      // ---- Autonomous demo signal: slow, musical, layered ----
      const t = timeSec;
      const slow = 0.5 + 0.5 * Math.sin(t * 0.18);
      rawBass =
        0.34 +
        0.3 * (0.5 + 0.5 * Math.sin(t * 0.9)) +
        0.12 * Math.sin(t * 0.37);
      rawMid = 0.28 + 0.22 * (0.5 + 0.5 * Math.sin(t * 0.55 + 1.3)) * slow;
      rawHigh = 0.2 + 0.18 * (0.5 + 0.5 * Math.sin(t * 1.7 + 0.6));
      // synth spectrum + waveform so structure still has fine detail
      for (let i = 0; i < BINS; i++) {
        const f = i / BINS;
        const env = Math.exp(-f * 3.2);
        spectrum[i] =
          env *
          (0.4 +
            0.35 * Math.abs(Math.sin(f * 40 + t * 1.1)) +
            0.25 * Math.abs(Math.sin(f * 130 + t * 2.3)));
        waveform[i] =
          0.5 * Math.sin(f * 26 + t * 1.4) +
          0.3 * Math.sin(f * 62 + t * 0.7) +
          0.2 * Math.sin(f * 9 - t * 0.9);
      }
      this.fluxEnv = 0.12 + 0.1 * (0.5 + 0.5 * Math.sin(t * 0.8));
    }

    // smooth bands
    this.sBass += (rawBass - this.sBass) * alpha;
    this.sMid += (rawMid - this.sMid) * alpha;
    this.sHigh += (rawHigh - this.sHigh) * alpha;
    const energy = (this.sBass + this.sMid + this.sHigh) / 2.4;
    this.sEnergy += (energy - this.sEnergy) * alpha;

    // beat detection on bass with adaptive threshold
    this.bassHistory.push(this.sBass);
    if (this.bassHistory.length > 43) this.bassHistory.shift();
    const avg =
      this.bassHistory.reduce((a, b) => a + b, 0) /
      Math.max(1, this.bassHistory.length);
    let variance = 0;
    for (const v of this.bassHistory) variance += (v - avg) ** 2;
    variance /= Math.max(1, this.bassHistory.length);
    const threshold = avg + (0.14 + variance * 8) * (live ? 1 : 0.55);
    let pulse = 0;
    let onset = false;
    if (
      this.sBass > threshold &&
      this.sBass > 0.22 &&
      timeSec - this.lastBeatAt > 0.12 // refractory period, avoids double-fires
    ) {
      pulse = Math.min(1, (this.sBass - avg) * 4);
      onset = true;
      this.lastBeatAt = timeSec;
      this.beatId += 1;
    }
    this.beatEnv = Math.max(pulse, this.beatEnv * 0.86);

    return {
      energy: this.sEnergy,
      bass: this.sBass,
      mid: this.sMid,
      high: this.sHigh,
      beat: this.beatEnv,
      beatOnset: onset,
      beatId: this.beatId,
      flux: Math.min(1, this.fluxEnv),
      spectrum,
      waveform,
      live,
    };
  }

  dispose() {
    this.disconnectSources();
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
      this.analyser = null;
    }
  }
}
