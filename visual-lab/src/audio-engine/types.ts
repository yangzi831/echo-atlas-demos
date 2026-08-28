export type AudioInputMode = 'idle' | 'file' | 'microphone'

export interface AudioFeatures {
  volume: number
  bass: number
  mid: number
  high: number
  beat: number
  silent: boolean
}

export interface AudioEngineSnapshot {
  features: AudioFeatures
  mode: AudioInputMode
  playing: boolean
  trackName: string | null
  recording: boolean
  recordingStartedAt: number | null
  recordingUrl: string | null
  error: string | null
}

export const SILENT_FEATURES: AudioFeatures = {
  volume: 0,
  bass: 0,
  mid: 0,
  high: 0,
  beat: 0,
  silent: true,
}
