import type { SoundMemory, SoundUnderstanding } from '../types/sound';

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/**
 * Enrich the existing Echo Atlas memory in-place-compatible fashion.
 * The returned object is still the app's canonical SoundMemory; AI data is
 * additive and existing map/playback fields remain untouched.
 */
export function attachSoundUnderstanding(memory: SoundMemory, understanding: SoundUnderstanding): SoundMemory {
  const { acousticFeatures } = understanding;
  const centroidIndex = acousticFeatures.frequencyProfile.reduce(
    (best, value, index, profile) => value > (profile[best] ?? -1) ? index : best,
    0,
  );
  const inferredCentroid = acousticFeatures.frequencyProfile.length > 1
    ? centroidIndex / (acousticFeatures.frequencyProfile.length - 1) * 6000
    : memory.soundFeatures.spectralCentroid;

  return {
    ...memory,
    duration: Math.max(memory.duration, Math.round(understanding.duration || 0)),
    tags: [...new Set([...memory.tags, ...understanding.tags])],
    moods: [...new Set([...memory.moods, ...understanding.mood])],
    soundFeatures: {
      ...memory.soundFeatures,
      loudness: clamp01(acousticFeatures.energy),
      rms: clamp01(acousticFeatures.energy),
      rhythmDensity: clamp01(acousticFeatures.rhythm),
      activityDensity: clamp01(acousticFeatures.rhythm),
      frequencyCentroid: inferredCentroid,
    },
    aiDescription: understanding.semanticDescription,
    echoMessage: understanding.aiReflection ?? `我听见了${understanding.semanticDescription}。`,
    aiUnderstanding: understanding,
  };
}
