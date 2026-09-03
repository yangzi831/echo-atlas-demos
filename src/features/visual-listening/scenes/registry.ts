import { ArchiveScene } from './ArchiveScene';
import { FieldScene } from './FieldScene';
import { TraceScene } from './TraceScene';
import type { PresetDefinition, VisualPresetId } from './types';

export const VISUAL_PRESETS: PresetDefinition[] = [
  { id: 'trace', label: 'TRACE', create: (profile) => new TraceScene(profile) },
  { id: 'field', label: 'FIELD', create: (profile) => new FieldScene(profile) },
  { id: 'archive', label: 'ARCHIVE', create: (profile) => new ArchiveScene(profile) },
];

export const getVisualPreset = (id: VisualPresetId) =>
  VISUAL_PRESETS.find((preset) => preset.id === id) ?? VISUAL_PRESETS[0];
