import { useEffect, useRef, useState } from 'react'
import type { AudioEngineSnapshot } from '../audio-engine'
import { getScene } from './registry'
import type { SceneId } from './types'

interface SceneHostProps {
  sceneId: SceneId
  audio: AudioEngineSnapshot
}

export function SceneHost({ sceneId, audio }: SceneHostProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const latestAudio = useRef(audio)
  const [renderError, setRenderError] = useState<string | null>(null)
  latestAudio.current = audio

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const visual = getScene(sceneId).create()
    let frameId = 0
    let disposed = false
    let previousTime = performance.now()
    const startedAt = previousTime
    const resize = () => {
      const rect = container.getBoundingClientRect()
      visual.resize(rect.width, rect.height, window.devicePixelRatio)
    }
    try {
      visual.mount(container)
      resize()
    } catch (error) {
      setRenderError(error instanceof Error ? error.message : 'WebGL 初始化失败')
      visual.dispose()
      return
    }
    const observer = new ResizeObserver(resize)
    observer.observe(container)
    const animate = (now: number) => {
      if (disposed) return
      const delta = Math.min((now - previousTime) / 1000, 0.1)
      previousTime = now
      const snapshot = latestAudio.current
      const recordingElapsed = snapshot.recordingStartedAt
        ? Math.max(0, (now - snapshot.recordingStartedAt) / 1000)
        : 0
      visual.update(delta, (now - startedAt) / 1000, snapshot.features, {
        recording: snapshot.recording,
        recordingElapsed,
      })
      frameId = requestAnimationFrame(animate)
    }
    frameId = requestAnimationFrame(animate)
    setRenderError(null)
    return () => {
      disposed = true
      cancelAnimationFrame(frameId)
      observer.disconnect()
      visual.dispose()
    }
  }, [sceneId])

  return (
    <div ref={containerRef} className="scene-host" data-scene={sceneId}>
      {renderError && <div className="render-error" role="alert">{renderError}</div>}
    </div>
  )
}
