import { useEffect, useMemo, useState } from 'react'
import { DEMO_MEMORIES } from './demoData'
import { VISUAL_PRESETS, VisualImprintPreview, VisualListeningView, type VisualPreset, type VisualSession } from './visual-engine'

function PerformanceReadout() {
  const [fps, setFps] = useState(60)
  useEffect(() => {
    let frame = 0
    let animationFrame = 0
    let previous = performance.now()
    const tick = (now: number) => {
      frame += 1
      if (now - previous >= 1000) {
        setFps(Math.round((frame * 1000) / (now - previous)))
        frame = 0
        previous = now
      }
      animationFrame = requestAnimationFrame(tick)
    }
    animationFrame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animationFrame)
  }, [])
  return <span>{fps} FPS · Canvas 2D · DPR ≤ 1.8</span>
}

interface VisualListeningLabProps {
  onBack: () => void
}

export function VisualListeningLab({ onBack }: VisualListeningLabProps) {
  const [mode, setMode] = useState<VisualSession['mode']>('single')
  const [preset, setPreset] = useState<VisualPreset>('trace')
  const [activeMemoryId, setActiveMemoryId] = useState(DEMO_MEMORIES[0].id)
  const [animatedPreview, setAnimatedPreview] = useState(false)
  const [analysisLabel, setAnalysisLabel] = useState('IDLE ANALYSIS')
  const activeMemory = DEMO_MEMORIES.find((memory) => memory.id === activeMemoryId) ?? DEMO_MEMORIES[0]
  const session = useMemo<VisualSession>(() => ({
    mode,
    memories: mode === 'single' ? [activeMemory] : DEMO_MEMORIES,
    activeMemoryId,
    preset,
  }), [activeMemory, activeMemoryId, mode, preset])

  return (
    <main className="lab-shell">
      <header className="lab-header">
        <button className="lab-brand lab-brand-button" type="button" onClick={onBack} title="返回视觉效果索引">
          <span className="lab-brand-mark" aria-hidden="true"><i /><i /><i /></span>
          <div>
            <strong>Echo Atlas</strong>
            <span>VISUAL LISTENING ENGINE / 01</span>
          </div>
        </button>
        <p>Sound leaves a form. Memory gives it continuity.</p>
        <div className="lab-runtime"><i /> <PerformanceReadout /></div>
      </header>

      <aside className="lab-controls" aria-label="Visual Lab controls">
        <section>
          <div className="control-heading"><span>01</span><strong>SESSION</strong></div>
          <div className="segmented-control">
            <button type="button" className={mode === 'single' ? 'is-active' : ''} onClick={() => setMode('single')}>Single</button>
            <button type="button" className={mode === 'soundscape' ? 'is-active' : ''} onClick={() => setMode('soundscape')}>Soundscape</button>
          </div>
        </section>

        <section>
          <div className="control-heading"><span>02</span><strong>MEMORIES</strong></div>
          <div className="memory-list">
            {DEMO_MEMORIES.map((memory, index) => (
              <button key={memory.id} type="button" className={memory.id === activeMemoryId ? 'is-active' : ''} onClick={() => setActiveMemoryId(memory.id)}>
                <small>{String(index + 1).padStart(2, '0')}</small>
                <span>{memory.title}</span>
                <i />
              </button>
            ))}
          </div>
        </section>

        <section>
          <div className="control-heading"><span>03</span><strong>VISUAL GRAMMAR</strong></div>
          <div className="preset-list">
            {VISUAL_PRESETS.map((definition) => (
              <button key={definition.id} type="button" className={definition.id === preset ? 'is-active' : ''} onClick={() => setPreset(definition.id)}>
                <span>{definition.label}</span>
                <small>{definition.character}</small>
              </button>
            ))}
          </div>
        </section>

        <section className="preview-mode-control">
          <div className="control-heading"><span>04</span><strong>PREVIEW</strong></div>
          <label><input type="checkbox" checked={animatedPreview} onChange={(event) => setAnimatedPreview(event.currentTarget.checked)} /> Animated thumbnail</label>
        </section>
      </aside>

      <section className="lab-stage">
        <VisualListeningView
          session={session}
          onActiveMemoryChange={setActiveMemoryId}
          onAnalysis={(snapshot) => setAnalysisLabel(snapshot.playing ? `${snapshot.master.rms.toFixed(2)} RMS · ${snapshot.master.spectralCentroid.toFixed(2)} CENTROID` : 'IDLE ANALYSIS')}
        />
        <div className="stage-analysis">{analysisLabel}</div>
      </section>

      <aside className="imprint-rail">
        <div className="rail-heading">
          <span>STATIC IMPRINTS</span>
          <small>{animatedPreview ? 'CSS / SVG MOTION' : 'ZERO RAF · SVG'}</small>
        </div>
        {DEMO_MEMORIES.map((memory) => (
          <article key={memory.id} className={memory.id === activeMemoryId ? 'is-active' : ''}>
            <VisualImprintPreview memory={memory} preset={preset} animated={animatedPreview} onClick={() => setActiveMemoryId(memory.id)} />
            <div><strong>{memory.title}</strong><span>{typeof memory.location === 'string' ? memory.location : memory.location?.name}</span></div>
          </article>
        ))}
      </aside>
    </main>
  )
}
