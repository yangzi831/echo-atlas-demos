import { MockSoundUnderstandingAdapter } from './adapters/mockAdapter';
import type { SoundUnderstanding, SoundUnderstandingAdapter } from './types';

/** Analyze audio through an injected adapter; mock is the safe default. */
export async function understandSound(
  audio: Blob,
  adapter: SoundUnderstandingAdapter = new MockSoundUnderstandingAdapter(),
): Promise<SoundUnderstanding> {
  return adapter.analyze(audio);
}

