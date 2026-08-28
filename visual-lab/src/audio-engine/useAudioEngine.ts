import { useSyncExternalStore } from 'react'
import type { AudioEngine } from './AudioEngine'

export const useAudioEngine = (engine: AudioEngine) =>
  useSyncExternalStore(engine.subscribe, engine.getSnapshot, engine.getSnapshot)
