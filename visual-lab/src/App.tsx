import { useEffect, useMemo, useState } from 'react'
import { AudioLines, CircleDot, Grid3X3, Orbit, Sprout } from 'lucide-react'
import { AudioEngine, useAudioEngine } from './audio-engine'
import { AudioMeter } from './components/AudioMeter'
import { ControlDock } from './components/ControlDock'
import { SceneGallery } from './components/SceneGallery'
import { VisualListeningLab } from './VisualListeningLab'
import { SCENES, SceneHost, getScene, type SceneId } from './visual-scenes'

const sceneIcons = {
  orbital: Orbit,
  mandala: AudioLines,
  saturn: CircleDot,
  'memory-tree': Sprout,
}

const sceneFromUrl = (): SceneId | null => {
  const candidate = new URLSearchParams(window.location.search).get('scene')
  return SCENES.some((scene) => scene.id === candidate) ? candidate as SceneId : null
}

function ThreeSceneLab() {
  const engine = useMemo(() => new AudioEngine(), [])
  const snapshot = useAudioEngine(engine)
  const captureMode = new URLSearchParams(window.location.search).get('capture') === '1' || window.location.hash === '#capture'
  const [sceneId, setSceneId] = useState<SceneId | null>(() => sceneFromUrl() ?? (captureMode ? 'orbital' : null))
  const activeScene = sceneId ? getScene(sceneId) : null

  useEffect(() => () => engine.dispose(), [engine])
  useEffect(() => {
    if (captureMode) return
    const onPopState = () => setSceneId(sceneFromUrl())
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [captureMode])

  const switchScene = async (nextScene: SceneId) => {
    if (snapshot.recording && nextScene !== 'memory-tree') await engine.stopRecording()
    setSceneId(nextScene)
    if (!captureMode) window.history.pushState({}, '', `?scene=${nextScene}`)
  }

  const showGallery = async () => {
    if (snapshot.recording) await engine.stopRecording()
    setSceneId(null)
    window.history.pushState({}, '', window.location.pathname)
  }

  if (!sceneId || !activeScene) {
    return (
      <SceneGallery
        onOpen={(id) => void switchScene(id)}
        onOpenListening={() => window.location.assign('?engine=listening')}
      />
    )
  }

  const recordingSeconds = snapshot.recordingStartedAt
    ? Math.max(0, (performance.now() - snapshot.recordingStartedAt) / 1000)
    : 0

  return (
    <main className={`app-shell scene-${sceneId} ${captureMode ? 'is-capture' : ''}`}>
      <SceneHost sceneId={sceneId} audio={snapshot} />

      <header className="topbar">
        <button className="brand-lockup brand-button" type="button" onClick={() => void showGallery()} title="返回效果索引">
          <span className="brand-mark"><i /><i /><i /></span>
          <div>
            <strong>声景视觉实验室</strong>
            <span>SOUNDSCAPE VISUAL LAB</span>
          </div>
        </button>
        <nav className="scene-tabs" aria-label="视觉场景">
          <button type="button" onClick={() => void showGallery()} title="效果索引"><Grid3X3 size={15} /><span>效果索引</span></button>
          {SCENES.map((scene) => {
            const Icon = sceneIcons[scene.id]
            return (
              <button
                key={scene.id}
                type="button"
                className={scene.id === sceneId ? 'is-active' : ''}
                onClick={() => void switchScene(scene.id)}
                aria-current={scene.id === sceneId ? 'page' : undefined}
              >
                <Icon size={15} />
                <span>{scene.name}</span>
              </button>
            )
          })}
        </nav>
        <div className="lab-status">
          <i className={snapshot.playing ? 'is-live' : ''} />
          {snapshot.trackName ?? '无输入'}
        </div>
      </header>

      <section className="scene-caption" aria-live="polite">
        <span>{activeScene.number}</span>
        <div>
          <strong>{activeScene.description}</strong>
          <small>{activeScene.source}</small>
        </div>
      </section>

      {sceneId === 'memory-tree' && (
        <div className={`recording-readout ${snapshot.recording ? 'is-active' : ''}`}>
          <i />
          <span>{snapshot.recording ? 'REC' : 'READY'}</span>
          <time>{recordingSeconds.toFixed(1)}s</time>
        </div>
      )}

      <aside className="meter-panel">
        <AudioMeter features={snapshot.features} />
      </aside>

      <footer className="bottombar">
        <div className="input-label">
          <span>INPUT</span>
          <strong>{snapshot.mode === 'file' ? 'FILE' : snapshot.mode === 'microphone' ? 'MIC' : 'IDLE'}</strong>
        </div>
        <ControlDock engine={engine} snapshot={snapshot} sceneId={sceneId} />
        <div className="engine-label">
          <span>ENGINE</span>
          <strong>01 / SHARED</strong>
        </div>
      </footer>

      {snapshot.error && <div className="error-toast" role="alert">{snapshot.error}</div>}
    </main>
  )
}

export function App() {
  const listeningMode = new URLSearchParams(window.location.search).get('engine') === 'listening'

  if (listeningMode) {
    return <VisualListeningLab onBack={() => window.location.assign(window.location.pathname)} />
  }

  return <ThreeSceneLab />
}
