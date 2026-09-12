/**
 * The stable contract between audio input, AI models and Sound Memory.
 * Keep this module independent from the map application's legacy SoundMemory
 * shape so that the hearing layer can be adopted incrementally.
 */
export interface SoundUnderstanding {
  duration: number;
  acousticFeatures: {
    /** Normalized average energy, from 0 (silent) to 1 (very loud). */
    energy: number;
    /** Normalized temporal variation, from 0 (steady) to 1 (highly rhythmic). */
    rhythm: number;
    /** Normalized spectral magnitudes, suitable for visualisation or retrieval. */
    frequencyProfile: number[];
    /** Human-readable acoustic texture, for example "soft / continuous". */
    texture: string;
  };
  semanticDescription: string;
  mood: string[];
  detectedEvents: string[];
  tags: string[];
}

export interface SoundUnderstandingAdapter {
  analyze(audio: Blob): Promise<SoundUnderstanding>;
}

export interface SoundMemoryLocation {
  city: string;
  latitude?: number;
  longitude?: number;
}

/**
 * Standalone memory shape emitted by the hearing layer. An adapter can map it
 * to Echo Atlas' existing `src/types/sound.ts` SoundMemory when integrating.
 */
export interface SoundMemory {
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

