import type { SoundMemory } from '../../types/sound';

export type EchoFieldMode =
  | 'listen-setup'
  | 'listen-live'
  | 'listen-decision'
  | 'memories'
  | 'recall-idle'
  | 'recall-resolving'
  | 'recall-result';

export type EchoFieldAudioFeatures = {
  rms: number;
  peak: number;
  frequencyCentroid: number;
  activityDensity: number;
  transientDensity: number;
  continuity: number;
};

export type EchoFieldInput = {
  mode: EchoFieldMode;
  audioFeatures?: EchoFieldAudioFeatures;
  memories?: SoundMemory[];
  activeMemoryId?: string;
  selectedIntentions?: string[];
  recallQuery?: string;
  interactionPoint?: { x: number; y: number };
};
