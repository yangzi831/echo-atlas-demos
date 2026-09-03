import type { SoundMemory } from '../../../types/sound';

export type VisualPresetId = 'trace' | 'field' | 'archive';

export type ReactiveVisualFeatures = {
  volume: number;
  bass: number;
  mid: number;
  high: number;
  beat: number;
  continuity: number;
};

export type MemoryVisualProfile = {
  id: string;
  seed: number;
  imprintType: SoundMemory['visualImprint']['type'];
  loudness: number;
  centroid: number;
  rhythm: number;
  age: number;
};

export type VisualScene = {
  mount(container: HTMLElement): void;
  resize(width: number, height: number, pixelRatio: number): void;
  update(delta: number, elapsed: number, audio: ReactiveVisualFeatures, residue: number): void;
  dispose(): void;
};

export type PresetDefinition = {
  id: VisualPresetId;
  label: string;
  create: (profile: MemoryVisualProfile) => VisualScene;
};
