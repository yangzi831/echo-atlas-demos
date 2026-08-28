import { useEffect, useMemo, useState } from 'react'
import { AudioLines, CircleDot, Orbit, Sprout } from 'lucide-react'
import { AudioEngine, useAudioEngine } from './audio-engine'
import { AudioMeter } from './components/AudioMeter'
import { ControlDock } from './components/ControlDock'
import { SCENES, SceneHost, getScene, type SceneId } from './visual-scenes'

const sceneIcons = {
  orbital: Orbit,
  mandala: AudioLines,
  saturn: CircleDot,
  'memory-tree': Sprout,
}

export function App() {
  const engine = useMemo(() => new AudioEngine(), [])
  const snapshot = useAudioEngine(engine)
  const [sceneId, setSceneId] = useState<SceneId>('orbital')
  const activeScene = getScene(sceneId)

  useEffect(() => () => engine.dispose(), [engine])

  const switchScene = async (nextScene: SceneId) => {
    if (snapshot.recording && nextScene !== 'memory-tree') await engine.stopRecording()
    setSceneId(nextScene)
  }

  const recordingSeconds = snapshot.recordingStartedAt
    ? Math.max(0, (performance.now() - snapshot.recordingStartedAt) / 1000)
    : 0

  return (
    <main className={`app-shell scene-${sceneId}`}>
      <SceneHost sceneId={sceneId} audio={snapshot} />

      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-mark"><i /><i /><i /></span>
          <div>
            <strong>声景视觉实验室</strong>
            <span>SOUNDSCAPE VISUAL LAB</span>
          </div>
        </div>
        <nav className="scene-tabs" aria-label="视觉场景">
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
