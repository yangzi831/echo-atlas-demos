import type { VisualPreset } from './types'

export interface VisualPresetDefinition {
  id: VisualPreset
  label: string
  description: string
  character: string
}

export const VISUAL_PRESETS: readonly VisualPresetDefinition[] = [
  { id: 'trace', label: 'TRACE', description: 'Echo Form as a directional memory filament.', character: 'spine / residue / event nodes' },
  { id: 'field', label: 'FIELD', description: 'The same form becomes a particle and attraction field.', character: 'particles / pressure / orbit' },
  { id: 'archive', label: 'ARCHIVE', description: 'Time settles into layered strata around the form.', character: 'layers / sediment / chronology' },
  { id: 'growth', label: 'GROWTH', description: 'Onsets and high energy branch from the form.', character: 'root / mycelium / becoming' },
] as const

export const getVisualPreset = (preset: VisualPreset = 'trace') =>
  VISUAL_PRESETS.find((definition) => definition.id === preset) ?? VISUAL_PRESETS[0]
