/** Stable hearing output shared with the canonical app SoundMemory model. */
import type { SoundUnderstanding as CanonicalSoundUnderstanding } from '../types/sound';

export type SoundUnderstanding = CanonicalSoundUnderstanding & { duration: number };

export interface SoundUnderstandingAdapter {
  analyze(audio: Blob): Promise<SoundUnderstanding>;
}

export interface SoundMemoryLocation {
  city: string;
  latitude?: number;
  longitude?: number;
}

/** Intermediate memory draft emitted by the hearing layer before app metadata is added. */
export interface HearingMemoryDraft {
  id: string;
  audio: string;
  location?: SoundMemoryLocation;
  recordedAt: string;
  title: string;
  description: string;
  soundFeatures: {
    texture: string;
    energy: number;
    rhythm: string;
  };
  semanticTags: string[];
  mood: string[];
  aiReflection?: string;
}

export interface MemoryExtractionContext {
  audio: string;
  recordedAt?: string;
  location?: SoundMemoryLocation;
  id?: string;
  title?: string;
  description?: string;
  aiReflection?: string;
}
