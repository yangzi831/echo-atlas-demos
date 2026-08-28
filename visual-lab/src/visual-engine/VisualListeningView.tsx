import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { createVisualImprint } from './imprint'
import { drawListeningFrame, type RenderLayer } from './rendering'
import { EMPTY_ANALYSIS, VisualAudioEngine } from './audio'
import type { AudioAnalysis, AudioAnalysisSnapshot, EchoForm, VisualListeningHandle, VisualListeningViewProps } from './types'

interface LayerMotion {
  weight: number
  offsetX: number
  offsetY: number
  scale: number
}

const idleAnalysis = (form: EchoForm, time: number): AudioAnalysis => {
  const breath = 0.018 + (Math.sin(time * 0.7 + form.seed * 0.0001) * 0.5 + 0.5) * 0.018
  return {
    ...EMPTY_ANALYSIS,
    rms: breath,
    loudness: breath,
    lowEnergy: form.summary.low * 0.08,
    midEnergy: form.summary.mid * 0.08,
    highEnergy: form.summary.high * 0.06,
    spectralCentroid: form.summary.centroid,
    rhythmDensity: form.summary.rhythmDensity,
  }
}

export const VisualListeningView = forwardRef<VisualListeningHandle, VisualListeningViewProps>(function VisualListeningView({
  session,
  className = '',
  controls = true,
  autoPlay = false,
  onActiveMemoryChange,
  onProgressChange,
  onAnalysis,
}, forwardedRef) {
  const engine = useMemo(() => new VisualAudioEngine(), [])
  const [localActiveId, setLocalActiveId] = useState(session.activeMemoryId ?? session.memories[0]?.id)
  const [uiSnapshot, setUiSnapshot] = useState<AudioAnalysisSnapshot>(engine.getSnapshot())
  const forms = useMemo(() => session.memories.map(createVisualImprint), [session.memories])
  const effectiveSession = useMemo(() => ({
    ...session,
    activeMemoryId: session.activeMemoryId ?? localActiveId ?? session.memories[0]?.id,
  }), [localActiveId, session])
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const formsRef = useRef(forms)
  const sessionRef = useRef(effectiveSession)
  const snapshotRef = useRef(engine.getSnapshot())
  const callbacksRef = useRef({ onActiveMemoryChange, onProgressChange, onAnalysis })
  const hitRegionsRef = useRef<Array<{ id: string; x: number; y: number; radius: number }>>([])
  const hoveredRef = useRef<string | null>(null)
  formsRef.current = forms
  sessionRef.current = effectiveSession
  callbacksRef.current = { onActiveMemoryChange, onProgressChange, onAnalysis }

  useEffect(() => {
    if (session.activeMemoryId) setLocalActiveId(session.activeMemoryId)
  }, [session.activeMemoryId])

  useEffect(() => {
    engine.setSession(effectiveSession)
    setUiSnapshot(engine.getSnapshot())
  }, [effectiveSession, engine])

  useEffect(() => () => engine.dispose(), [engine])

  useEffect(() => {
    let lastUiUpdate = 0
    const unsubscribe = engine.subscribe((snapshot) => {
      snapshotRef.current = snapshot
      const now = performance.now()
      if (now - lastUiUpdate < 100) return
      lastUiUpdate = now
      setUiSnapshot(snapshot)
      callbacksRef.current.onAnalysis?.(snapshot)
      const activeId = sessionRef.current.activeMemoryId
      callbacksRef.current.onProgressChange?.(activeId ? snapshot.byMemory[activeId]?.progress ?? snapshot.master.progress : snapshot.master.progress, activeId)
    })
    return () => { unsubscribe() }
  }, [engine])

  useEffect(() => {
    if (autoPlay) void engine.play()
  }, [autoPlay, engine])

  useImperativeHandle(forwardedRef, () => ({
    play: () => engine.play(),
    pause: () => engine.pause(),
    toggle: () => engine.toggle(),
    seek: (progress, memoryId) => engine.seek(progress, memoryId),
  }), [engine])

  const activate = (memoryId: string) => {
    setLocalActiveId(memoryId)
    engine.setActiveMemory(memoryId)
    callbacksRef.current.onActiveMemoryChange?.(memoryId)
  }

  useEffect(() => {
    const canvas = canvasRef.current
    const host = hostRef.current
    if (!canvas || !host) return
    const context = canvas.getContext('2d', { alpha: false })
    if (!context) return
    let width = 1
    let height = 1
    let compact = false
    let frameId = 0
    let disposed = false
    let previous = performance.now()
    let lastReducedFrame = 0
    const started = previous
    const motion = new Map<string, LayerMotion>()
    const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    let reducedMotion = reducedQuery.matches
    const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8

    const resize = () => {
      const rect = host.getBoundingClientRect()
      width = Math.max(1, rect.width)
      height = Math.max(1, rect.height)
      compact = width < 720 || deviceMemory <= 4
      const dpr = Math.min(window.devicePixelRatio || 1, compact ? 1.35 : 1.8)
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    const onMotionPreference = (event: MediaQueryListEvent) => { reducedMotion = event.matches }
    const observer = new ResizeObserver(resize)
    observer.observe(host)
    reducedQuery.addEventListener('change', onMotionPreference)
    resize()

    const animate = (now: number) => {
      if (disposed) return
      if (reducedMotion && now - lastReducedFrame < 180) {
        frameId = requestAnimationFrame(animate)
        return
      }
      lastReducedFrame = now
      const delta = Math.min(0.08, (now - previous) / 1000)
      previous = now
      const currentForms = formsRef.current
      const currentSession = sessionRef.current
      const activeId = currentSession.activeMemoryId ?? currentForms[0]?.memoryId
      const snapshot = snapshotRef.current
      const time = (now - started) / 1000
      const regions: Array<{ id: string; x: number; y: number; radius: number }> = []
      const layers: RenderLayer[] = currentForms.map((form, index) => {
        const active = form.memoryId === activeId
        const angle = ((index / Math.max(1, currentForms.length)) * Math.PI * 2) - Math.PI / 2
        const inactiveRadiusX = Math.min(width * 0.19, 190)
        const inactiveRadiusY = Math.min(height * 0.16, 110)
        const targetX = currentSession.mode === 'single' || active ? 0 : Math.cos(angle) * inactiveRadiusX
        const targetY = currentSession.mode === 'single' || active ? 0 : Math.sin(angle) * inactiveRadiusY
        const targetWeight = currentSession.mode === 'single' ? 1 : active ? 0.96 : 0.34
        const targetScale = currentSession.mode === 'single' ? 1 : active ? 1 : 0.68
        const state = motion.get(form.memoryId) ?? { weight: targetWeight * 0.2, offsetX: targetX, offsetY: targetY, scale: targetScale }
        const response = 1 - Math.exp(-delta * (active ? 2.8 : 1.8))
        state.weight += (targetWeight - state.weight) * response
        state.offsetX += (targetX - state.offsetX) * response
        state.offsetY += (targetY - state.offsetY) * response
        state.scale += (targetScale - state.scale) * response
        motion.set(form.memoryId, state)
        const live = snapshot.byMemory[form.memoryId]
        const analysis = live && (!live.silent || live.progress > 0) ? live : idleAnalysis(form, time)
        regions.push({ id: form.memoryId, x: width * 0.5 + state.offsetX, y: height * 0.48 + state.offsetY, radius: 120 * state.scale })
        return {
          form,
          analysis,
          weight: state.weight,
          active,
          offsetX: state.offsetX,
          offsetY: state.offsetY,
          scale: state.scale,
          hover: hoveredRef.current === form.memoryId ? 1 : 0,
        }
      })
      hitRegionsRef.current = regions
      drawListeningFrame(context, layers, {
        width,
        height,
        preset: currentSession.preset ?? 'trace',
        time,
        progress: snapshot.master.progress,
        reducedMotion,
        compact,
      })
      frameId = requestAnimationFrame(animate)
    }
    frameId = requestAnimationFrame(animate)
    return () => {
      disposed = true
      cancelAnimationFrame(frameId)
      observer.disconnect()
      reducedQuery.removeEventListener('change', onMotionPreference)
    }
  }, [])

  const pointerMemory = (event: { clientX: number; clientY: number; currentTarget: HTMLCanvasElement }) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    let nearest: { id: string; distance: number } | null = null
    hitRegionsRef.current.forEach((region) => {
      const distance = Math.hypot(x - region.x, y - region.y)
      if (distance <= region.radius && (!nearest || distance < nearest.distance)) nearest = { id: region.id, distance }
    })
    return nearest?.id ?? null
  }

  const activeId = effectiveSession.activeMemoryId
  const progress = activeId ? uiSnapshot.byMemory[activeId]?.progress ?? 0 : uiSnapshot.master.progress
  const rootClass = `visual-listening-view preset-${effectiveSession.preset ?? 'trace'} ${className}`.trim()

  return (
    <section ref={hostRef} className={rootClass} data-mode={effectiveSession.mode} data-renderer="canvas-2d">
      <canvas
        ref={canvasRef}
        className="visual-listening-canvas"
        aria-label="Interactive visual soundscape"
        onPointerMove={(event) => { hoveredRef.current = pointerMemory(event) }}
        onPointerLeave={() => { hoveredRef.current = null }}
        onClick={(event) => {
          const memoryId = pointerMemory(event)
          if (memoryId) activate(memoryId)
        }}
      />
      <div className="visual-listening-meta" aria-live="polite">
        <span>{effectiveSession.mode === 'soundscape' ? 'VISUAL SOUNDSCAPE' : 'VISUAL IMPRINT'}</span>
        <strong>{effectiveSession.memories.find((memory) => memory.id === activeId)?.title ?? 'Untitled memory'}</strong>
      </div>
      {effectiveSession.mode === 'soundscape' && (
        <div className="visual-memory-switcher" aria-label="Soundscape memories">
          {effectiveSession.memories.map((memory) => (
            <button key={memory.id} type="button" className={memory.id === activeId ? 'is-active' : ''} onClick={() => activate(memory.id)}>
              {memory.title ?? memory.id}
            </button>
          ))}
        </div>
      )}
      {controls && (
        <div className="visual-transport">
          <button type="button" onClick={() => void engine.toggle()} disabled={!uiSnapshot.playableMemoryIds.length}>
            {uiSnapshot.playing ? 'Pause' : 'Listen'}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.001"
            value={progress}
            aria-label="Playback progress"
            disabled={!uiSnapshot.playableMemoryIds.length}
            onChange={(event) => engine.seek(Number(event.currentTarget.value), activeId)}
          />
          <output>{Math.round(progress * 100)}%</output>
        </div>
      )}
      {uiSnapshot.error && <p className="visual-listening-error" role="alert">{uiSnapshot.error}</p>}
    </section>
  )
})
