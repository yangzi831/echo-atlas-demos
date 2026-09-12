import type { SoundUnderstanding } from './types';

export interface AudioAnalysis {
  duration: number;
  amplitude: number;
  energy: number;
  rhythm: number;
  frequencyProfile: number[];
  texture: string;
  energyChanges: number[];
}

export interface AudioAnalyzerOptions {
  /** Number of PCM samples per temporal frame. */
  frameSize?: number;
  /** Number of bins in the returned normalized frequency profile. */
  frequencyBins?: number;
}

type ExtendedAudioContext = typeof AudioContext & {
  new (): AudioContext;
};

function getAudioContextConstructor(): ExtendedAudioContext | undefined {
  if (typeof window === 'undefined') return undefined;
  const browserWindow = window as Window & {
    webkitAudioContext?: ExtendedAudioContext;
  };
  return window.AudioContext ?? browserWindow.webkitAudioContext;
}

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function monoSamples(buffer: AudioBuffer) {
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, index) => buffer.getChannelData(index));
  const mono = new Float32Array(buffer.length);
  for (let index = 0; index < buffer.length; index += 1) {
    let sample = 0;
    for (const channel of channels) sample += channel[index] ?? 0;
    mono[index] = sample / Math.max(1, channels.length);
  }
  return mono;
}

function frameRms(samples: Float32Array, frameSize: number) {
  const frames: number[] = [];
  for (let start = 0; start < samples.length; start += frameSize) {
    const end = Math.min(samples.length, start + frameSize);
    let sum = 0;
    for (let index = start; index < end; index += 1) sum += (samples[index] ?? 0) ** 2;
    frames.push(Math.sqrt(sum / Math.max(1, end - start)));
  }
  return frames;
}

function calculateFrequencyProfile(samples: Float32Array, bins: number) {
  // A small sampled DFT keeps this layer dependency-free while retaining a
  // stable profile for retrieval and future model adapters.
  const sampleCount = Math.min(samples.length, 4096);
  const step = Math.max(1, Math.floor(samples.length / sampleCount));
  const profile: number[] = [];
  for (let bin = 0; bin < bins; bin += 1) {
    const frequency = (bin + 0.5) / (bins * 2);
    let real = 0;
    let imaginary = 0;
    for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
      const sample = samples[sampleIndex * step] ?? 0;
      const phase = 2 * Math.PI * frequency * sampleIndex;
      real += sample * Math.cos(phase);
      imaginary -= sample * Math.sin(phase);
    }
    profile.push(Math.sqrt(real ** 2 + imaginary ** 2) / Math.max(1, sampleCount));
  }
  const peak = Math.max(...profile, 1e-9);
  return profile.map((value) => Number(clamp(value / peak).toFixed(4)));
}

function inferTexture(energy: number, rhythm: number, profile: number[]) {
  const low = profile.slice(0, Math.ceil(profile.length / 3)).reduce((sum, value) => sum + value, 0);
  const high = profile.slice(-Math.ceil(profile.length / 3)).reduce((sum, value) => sum + value, 0);
  if (energy < 0.08) return 'quiet / sparse';
  if (rhythm > 0.62) return high > low ? 'bright / rhythmic' : 'pulsing / rhythmic';
  if (high > low * 1.35) return 'bright / textured';
  if (low > high * 1.35) return 'warm / low-frequency';
  return 'soft / continuous';
}

/**
 * Decode an uploaded audio Blob and derive device-side acoustic features.
 * No audio leaves the browser; semantic interpretation is delegated to an
 * adapter.
 */
export async function analyzeAudioBlob(
  audio: Blob,
  options: AudioAnalyzerOptions = {},
): Promise<AudioAnalysis> {
  if (audio.size === 0) throw new Error('Cannot analyze an empty audio blob.');
  const AudioContextConstructor = getAudioContextConstructor();
  if (!AudioContextConstructor) {
    throw new Error('Web Audio API is unavailable in this environment.');
  }

  const frameSize = options.frameSize ?? 1024;
  const frequencyBins = options.frequencyBins ?? 32;
  const context = new AudioContextConstructor();
  try {
    const decoded = await context.decodeAudioData(await audio.arrayBuffer());
    const samples = monoSamples(decoded);
    const rmsFrames = frameRms(samples, frameSize);
    const meanRms = rmsFrames.reduce((sum, value) => sum + value, 0) / Math.max(1, rmsFrames.length);
    const peak = Math.max(...samples.map((sample) => Math.abs(sample)), 0);
    const meanChange = rmsFrames.slice(1).reduce((sum, value, index) => (
      sum + Math.abs(value - (rmsFrames[index] ?? 0))
    ), 0) / Math.max(1, rmsFrames.length - 1);
    const rhythm = clamp(meanChange * 8 + (meanRms > 0 ? (Math.max(...rmsFrames) - meanRms) * 1.5 : 0));
    const energy = clamp(meanRms * 4);
    const frequencyProfile = calculateFrequencyProfile(samples, frequencyBins);
    return {
      duration: decoded.duration,
      amplitude: Number(clamp(peak).toFixed(4)),
      energy: Number(energy.toFixed(4)),
      rhythm: Number(rhythm.toFixed(4)),
      frequencyProfile,
      texture: inferTexture(energy, rhythm, frequencyProfile),
      energyChanges: rmsFrames.slice(1).map((value, index) => Number((value - (rmsFrames[index] ?? 0)).toFixed(4))),
    };
  } finally {
    await context.close();
  }
}

/** Connect a live source to an AnalyserNode for UI visualisation. */
export function createAnalyserNode(
  context: AudioContext,
  source: AudioNode,
  fftSize = 2048,
) {
  const analyser = context.createAnalyser();
  analyser.fftSize = fftSize;
  analyser.smoothingTimeConstant = 0.82;
  source.connect(analyser);
  return analyser;
}

export interface RecordedAudio {
  blob: Blob;
  duration: number;
}

/** A small MediaRecorder wrapper for microphone capture. */
export class MicrophoneRecorder {
  private recorder?: MediaRecorder;
  private stream?: MediaStream;
  private chunks: BlobPart[] = [];
  private startedAt = 0;

  static get supported() {
    return typeof navigator !== 'undefined'
      && Boolean(navigator.mediaDevices?.getUserMedia)
      && typeof MediaRecorder !== 'undefined';
  }

  async start() {
    if (!MicrophoneRecorder.supported) throw new Error('Microphone recording is unavailable in this browser.');
    if (this.recorder?.state === 'recording') throw new Error('Microphone recording is already in progress.');
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.chunks = [];
    this.startedAt = performance.now();
    this.recorder = new MediaRecorder(this.stream);
    this.recorder.ondataavailable = (event) => {
      if (event.data.size > 0) this.chunks.push(event.data);
    };
    this.recorder.start();
  }

  stop(): Promise<RecordedAudio> {
    if (!this.recorder || this.recorder.state !== 'recording') {
      return Promise.reject(new Error('Microphone recording is not active.'));
    }
    return new Promise((resolve, reject) => {
      const recorder = this.recorder as MediaRecorder;
      recorder.onerror = () => reject(new Error('Microphone recording failed.'));
      recorder.onstop = () => {
        this.stream?.getTracks().forEach((track) => track.stop());
        const blob = new Blob(this.chunks, { type: recorder.mimeType || 'audio/webm' });
        resolve({ blob, duration: Math.max(0, (performance.now() - this.startedAt) / 1000) });
      };
      recorder.stop();
    });
  }

  cancel() {
    this.recorder?.stop();
    this.stream?.getTracks().forEach((track) => track.stop());
    this.recorder = undefined;
    this.chunks = [];
  }
}

export function toSoundUnderstanding(analysis: AudioAnalysis): Pick<SoundUnderstanding, 'duration' | 'acousticFeatures'> {
  return {
    duration: analysis.duration,
    acousticFeatures: {
      energy: analysis.energy,
      rhythm: analysis.rhythm,
      frequencyProfile: analysis.frequencyProfile,
      texture: analysis.texture,
    },
  };
}

