import { analyzeAudioBlob, toSoundUnderstanding } from '../audioAnalyzer';
import type { SoundUnderstanding, SoundUnderstandingAdapter } from '../types';

export interface AudioModelAdapterOptions {
  endpoint: string;
  headers?: HeadersInit;
  model?: string;
}

/** Generic HTTP boundary for MOSS-Audio, Ocean Listen, OpenAI audio, etc. */
export class AudioModelAdapter implements SoundUnderstandingAdapter {
  constructor(private readonly options: AudioModelAdapterOptions) {}

  async analyze(audio: Blob): Promise<SoundUnderstanding> {
    const analysis = await analyzeAudioBlob(audio);
    const response = await fetch(this.options.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': audio.type || 'application/octet-stream', ...this.options.headers },
      body: audio,
    });
    if (!response.ok) throw new Error(`Audio model adapter failed (${response.status}).`);
    const result = await response.json() as Partial<SoundUnderstanding>;
    return {
      ...toSoundUnderstanding(analysis),
      semanticDescription: result.semanticDescription ?? 'Audio model returned no semantic description.',
      mood: result.mood ?? [],
      detectedEvents: result.detectedEvents ?? [],
      tags: result.tags ?? [],
    };
  }
}

