import type { SoundMemory } from '../../../types/sound';
import type { ListeningAudioFeatures } from '../audio';
import type { MemoryVisualProfile, ReactiveVisualFeatures } from './types';

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export const getMemoryVisualProfile = (memory: SoundMemory): MemoryVisualProfile => {
  const recordedAt = new Date(memory.recordedAt).getTime();
  const now = Date.now();
  const ageYears = Math.max(0, (now - recordedAt) / (365.25 * 24 * 60 * 60 * 1000));
  return {
    id: memory.id,
    seed: memory.visualImprint.seed,
    imprintType: memory.visualImprint.type,
    loudness: clamp01(memory.soundFeatures.loudness),
    centroid: clamp01(memory.soundFeatures.spectralCentroid / 6000),
    rhythm: clamp01(memory.soundFeatures.rhythmDensity),
    age: clamp01(ageYears / 20),
  };
};

export const adaptAudioFeatures = (
  live: ListeningAudioFeatures,
  memory: SoundMemory,
  useLiveAudio: boolean,
): ReactiveVisualFeatures => {
  const storedLoudness = clamp01(memory.soundFeatures.loudness);
  const storedCentroid = clamp01(memory.soundFeatures.spectralCentroid / 7000);
  const storedRhythm = clamp01(memory.soundFeatures.rhythmDensity);
  const liveWeight = useLiveAudio ? 0.82 : 0;
  const baselineWeight = useLiveAudio ? 0.18 : 1;
  const centroid = clamp01(live.spectralCentroid / 9000);
  return {
    volume: clamp01(live.rms * liveWeight + storedLoudness * 0.34 * baselineWeight),
    bass: clamp01((live.rms * 0.7 + live.peak * 0.3) * liveWeight + storedLoudness * 0.48 * baselineWeight),
    mid: clamp01((live.activityDensity * 0.72 + live.continuity * 0.28) * liveWeight + storedRhythm * 0.52 * baselineWeight),
    high: clamp01((centroid * 0.7 + live.transient * 0.3) * liveWeight + storedCentroid * 0.62 * baselineWeight),
    beat: clamp01(live.transient * liveWeight + storedRhythm * 0.18 * baselineWeight),
    continuity: clamp01(live.continuity * liveWeight + (0.3 + storedLoudness * 0.4) * baselineWeight),
  };
};
