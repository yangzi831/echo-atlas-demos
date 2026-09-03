export type ListeningAudioFeatures = {
  rms: number;
  peak: number;
  spectralCentroid: number;
  activityDensity: number;
  transient: number;
  continuity: number;
};

export type ListeningAudioSnapshot = {
  features: ListeningAudioFeatures;
  memoryId?: string;
  playing: boolean;
  ready: boolean;
  error?: string;
};

export const SILENT_LISTENING_FEATURES: ListeningAudioFeatures = {
  rms: 0,
  peak: 0,
  spectralCentroid: 0,
  activityDensity: 0,
  transient: 0,
  continuity: 0,
};
