import type { AudioFeatures } from '../audio-engine'

export type SceneId = 'orbital' | 'mandala' | 'saturn' | 'memory-tree'

export interface SceneFrameState {
  recording: boolean
  recordingElapsed: number
}

export interface VisualScene {
  mount(container: HTMLElement): void
  update(delta: number, elapsed: number, audio: AudioFeatures, state: SceneFrameState): void
  resize(width: number, height: number, pixelRatio: number): void
  dispose(): void
}

export interface SceneDefinition {
  id: SceneId
  number: string
  name: string
  source: string
  description: string
  create: () => VisualScene
}
