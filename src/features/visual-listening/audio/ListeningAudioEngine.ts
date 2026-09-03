import type { SoundMemory } from '../../../types/sound';
import { SILENT_LISTENING_FEATURES, type ListeningAudioSnapshot } from './types';

type Listener = () => void;

const canUseAudioUrl = (url: string) => Boolean(
  url && (url.startsWith('blob:') || url.startsWith('data:') || url.startsWith('/') || /^https?:\/\//.test(url)),
);

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

class ListeningAudioEngine {
  private audio?: HTMLAudioElement;
  private context?: AudioContext;
  private analyser?: AnalyserNode;
  private source?: MediaElementAudioSourceNode;
  private frequencyData?: Uint8Array<ArrayBuffer>;
  private timeData?: Uint8Array<ArrayBuffer>;
  private listeners = new Set<Listener>();
  private frameId = 0;
  private endedListener?: () => void;
  private errorListener?: () => void;
  private previousRms = 0;
  private activityEnvelope = 0;
  private snapshot: ListeningAudioSnapshot = {
    features: { ...SILENT_LISTENING_FEATURES },
    playing: false,
    ready: false,
  };

  getSnapshot = () => this.snapshot;
  getServerSnapshot = () => this.snapshot;

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  setEndedListener(listener?: () => void) {
    this.endedListener = listener;
  }

  setErrorListener(listener?: () => void) {
    this.errorListener = listener;
  }

  load(memory?: SoundMemory) {
    if (this.snapshot.memoryId === memory?.id && this.audio) return;
    this.releaseMediaElement();
    this.previousRms = 0;
    this.activityEnvelope = 0;

    if (!memory || !canUseAudioUrl(memory.audioUrl)) {
      this.patch({
        memoryId: memory?.id,
        playing: false,
        ready: false,
        error: memory ? 'Audio preview is unavailable for this memory.' : undefined,
        features: { ...SILENT_LISTENING_FEATURES },
      });
      return;
    }

    const audio = new Audio(memory.audioUrl);
    audio.preload = 'auto';
    audio.crossOrigin = memory.audioUrl.startsWith('http') ? 'anonymous' : '';
    audio.addEventListener('canplay', this.handleCanPlay);
    audio.addEventListener('play', this.handlePlay);
    audio.addEventListener('pause', this.handlePause);
    audio.addEventListener('ended', this.handleEnded);
    audio.addEventListener('error', this.handleError);
    this.audio = audio;
    this.patch({
      memoryId: memory.id,
      playing: false,
      ready: false,
      error: undefined,
      features: { ...SILENT_LISTENING_FEATURES },
    });
    audio.load();
  }

  async play() {
    if (!this.audio) return;
    try {
      await this.ensureGraph();
      await this.context?.resume();
      await this.audio.play();
    } catch (error) {
      this.patch({
        playing: false,
        error: error instanceof Error ? error.message : 'Audio playback failed.',
      });
      this.errorListener?.();
    }
  }

  pause() {
    this.audio?.pause();
  }

  dispose() {
    cancelAnimationFrame(this.frameId);
    this.releaseMediaElement();
    void this.context?.close();
    this.context = undefined;
    this.analyser = undefined;
    this.frequencyData = undefined;
    this.timeData = undefined;
    this.listeners.clear();
  }

  private ensureGraph = async () => {
    if (!this.audio) return;
    if (!this.context) {
      this.context = new AudioContext();
      this.analyser = this.context.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.7;
      this.analyser.connect(this.context.destination);
      this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
      this.timeData = new Uint8Array(this.analyser.fftSize);
    }
    if (!this.source && this.analyser) {
      this.source = this.context.createMediaElementSource(this.audio);
      this.source.connect(this.analyser);
    }
    if (!this.frameId) this.tick();
  };

  private tick = () => {
    const analyser = this.analyser;
    const frequencyData = this.frequencyData;
    const timeData = this.timeData;
    if (!analyser || !frequencyData || !timeData) return;

    analyser.getByteFrequencyData(frequencyData);
    analyser.getByteTimeDomainData(timeData);
    let sumSquares = 0;
    let peak = 0;
    for (const sample of timeData) {
      const value = Math.abs((sample - 128) / 128);
      sumSquares += value * value;
      peak = Math.max(peak, value);
    }
    const rawRms = Math.sqrt(sumSquares / timeData.length);

    let weightedFrequency = 0;
    let magnitudeTotal = 0;
    let activeBins = 0;
    for (let index = 0; index < frequencyData.length; index += 1) {
      const magnitude = frequencyData[index] / 255;
      const frequency = index * (this.context!.sampleRate / 2) / frequencyData.length;
      weightedFrequency += frequency * magnitude;
      magnitudeTotal += magnitude;
      if (magnitude > 0.12) activeBins += 1;
    }

    const transient = clamp01(Math.max(0, rawRms - this.previousRms) * 13 + Math.max(0, peak - 0.62) * 0.65);
    this.previousRms = rawRms;
    const activityTarget = activeBins / frequencyData.length;
    this.activityEnvelope += (activityTarget - this.activityEnvelope) * (activityTarget > this.activityEnvelope ? 0.22 : 0.06);
    const continuityTarget = rawRms > 0.012 ? 1 : 0;
    const previous = this.snapshot.features;
    const smooth = (current: number, target: number, attack = 0.3, release = 0.08) =>
      current + (target - current) * (target > current ? attack : release);

    this.snapshot = {
      ...this.snapshot,
      features: {
        rms: clamp01(smooth(previous.rms, rawRms * 3.2)),
        peak: clamp01(smooth(previous.peak, peak * 1.2, 0.38, 0.1)),
        spectralCentroid: magnitudeTotal > 0 ? weightedFrequency / magnitudeTotal : 0,
        activityDensity: clamp01(this.activityEnvelope * 2.3),
        transient: smooth(previous.transient, transient, 0.62, 0.12),
        continuity: clamp01(smooth(previous.continuity, continuityTarget, 0.045, 0.025)),
      },
    };
    this.emit();
    this.frameId = requestAnimationFrame(this.tick);
  };

  private releaseMediaElement() {
    cancelAnimationFrame(this.frameId);
    this.frameId = 0;
    if (!this.audio) return;
    this.audio.pause();
    this.audio.removeEventListener('canplay', this.handleCanPlay);
    this.audio.removeEventListener('play', this.handlePlay);
    this.audio.removeEventListener('pause', this.handlePause);
    this.audio.removeEventListener('ended', this.handleEnded);
    this.audio.removeEventListener('error', this.handleError);
    try { this.source?.disconnect(); } catch { /* already disconnected */ }
    this.source = undefined;
    this.audio.src = '';
    this.audio.load();
    this.audio = undefined;
  }

  private handleCanPlay = () => this.patch({ ready: true, error: undefined });
  private handlePlay = () => this.patch({ playing: true });
  private handlePause = () => this.patch({ playing: false });
  private handleEnded = () => {
    this.patch({ playing: false });
    this.endedListener?.();
  };
  private handleError = () => {
    this.patch({ playing: false, ready: false, error: 'Audio preview could not be loaded.' });
    this.errorListener?.();
  };

  private patch(patch: Partial<ListeningAudioSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.emit();
  }

  private emit() {
    this.listeners.forEach((listener) => listener());
  }
}

export const listeningAudioEngine = new ListeningAudioEngine();
