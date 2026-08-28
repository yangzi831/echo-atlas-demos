export type VisualPreset = 'field' | 'trace' | 'archive' | 'growth'

export interface SoundFeatureFrame {
  rms: number
  low: number
  mid: number
  high: number
  centroid: number
  onset: number
  silent?: boolean
}

export interface SoundFeatureSummary {
  rms: number
  low: number
  mid: number
  high: number
  centroid: number
  rhythmDensity: number
  silenceRatio: number
}

export interface StoredVisualImprint {
  version?: 1
  seed?: string | number
  frames?: SoundFeatureFrame[]
  summary?: Partial<SoundFeatureSummary>
  palette?: readonly [string, string, string]
}

export interface SoundMemory {
  id: string
  title?: string
  audio?: string
  location?: string | { name?: string; latitude?: number; longitude?: number }
  recordedAt?: string
  duration?: number
  tags?: string[]
  moods?: string[]
  seed?: string | number
  soundFeatures?: Partial<SoundFeatureSummary>
  visualImprint?: StoredVisualImprint
}

export interface VisualSession {
  mode: 'single' | 'soundscape'
  memories: SoundMemory[]
  activeMemoryId?: string
  preset?: VisualPreset
}

export interface AudioAnalysis {
  rms: number
  loudness: number
  lowEnergy: number
  midEnergy: number
  highEnergy: number
  spectralCentroid: number
  transient: number
  onset: number
  rhythmDensity: number
  pulse: number
  progress: number
  silent: boolean
}

export interface AudioAnalysisSnapshot {
  byMemory: Readonly<Record<string, AudioAnalysis>>
  master: AudioAnalysis
  playing: boolean
  playableMemoryIds: readonly string[]
  error: string | null
}

export interface EchoPoint extends SoundFeatureFrame {
  x: number
  y: number
  width: number
  branch: number
}

export interface EchoForm {
  memoryId: string
  seed: number
  duration: number
  palette: readonly [string, string, string]
  summary: SoundFeatureSummary
  points: readonly EchoPoint[]
}

export interface VisualImprintPreviewProps {
  memory: SoundMemory
  preset?: VisualPreset
  animated?: boolean
  className?: string
  title?: string
  onClick?: () => void
}

export interface VisualListeningViewProps {
  session: VisualSession
  className?: string
  controls?: boolean
  autoPlay?: boolean
  onActiveMemoryChange?: (memoryId: string) => void
  onProgressChange?: (progress: number, memoryId?: string) => void
  onAnalysis?: (snapshot: AudioAnalysisSnapshot) => void
}

export interface VisualListeningHandle {
  play(): Promise<void>
  pause(): void
  toggle(): Promise<void>
  seek(progress: number, memoryId?: string): void
}
