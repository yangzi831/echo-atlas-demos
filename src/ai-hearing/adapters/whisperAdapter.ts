import { analyzeAudioBlob, toSoundUnderstanding } from '../audioAnalyzer';
import type { SoundUnderstanding, SoundUnderstandingAdapter } from '../types';

export interface WhisperAdapterOptions {
  endpoint: string;
  headers?: HeadersInit;
  model?: string;
}

/**
 * Future speech-to-text adapter. The endpoint is injected so API keys and
 * hosting remain outside the hearing layer.
 */
export class WhisperAdapter implements SoundUnderstandingAdapter {
  constructor(private readonly options: WhisperAdapterOptions) {}

  async analyze(audio: Blob): Promise<SoundUnderstanding> {
    const analysis = await analyzeAudioBlob(audio);
    const form = new FormData();
    form.append('file', audio, 'echo-atlas-audio.webm');
    form.append('model', this.options.model ?? 'whisper-1');
    const response = await fetch(this.options.endpoint, {
      method: 'POST',
      headers: this.options.headers,
      body: form,
    });
    if (!response.ok) throw new Error(`Whisper adapter failed (${response.status}).`);
    const result = await response.json() as { text?: string; semanticDescription?: string };
    return {
      ...toSoundUnderstanding(analysis),
      semanticDescription: result.semanticDescription ?? result.text ?? 'Speech transcription returned no text.',
      mood: [],
      detectedEvents: [],
      tags: ['speech'],
    };
  }
}

