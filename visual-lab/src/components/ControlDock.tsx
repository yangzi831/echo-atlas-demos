import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Download, Expand, Mic, Pause, Play, Radio, Upload } from 'lucide-react'
import type { AudioEngine, AudioEngineSnapshot } from '../audio-engine'
import type { SceneId } from '../visual-scenes'

interface ControlDockProps {
  engine: AudioEngine
  snapshot: AudioEngineSnapshot
  sceneId: SceneId
}

export function ControlDock({ engine, snapshot, sceneId }: ControlDockProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [isFullscreen, setIsFullscreen] = useState(Boolean(document.fullscreenElement))

  useEffect(() => {
    const onFullscreen = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onFullscreen)
    return () => document.removeEventListener('fullscreenchange', onFullscreen)
  }, [])

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) await engine.loadFile(file)
    event.target.value = ''
  }

  const toggleMicrophone = async () => {
    if (snapshot.mode === 'microphone' && !snapshot.recording) engine.stopInput()
    else await engine.useMicrophone()
  }

  const toggleRecording = async () => {
    if (snapshot.recording) await engine.stopRecording()
    else await engine.startRecording()
  }

  const toggleFullscreen = async () => {
    if (document.fullscreenElement) await document.exitFullscreen()
    else await document.documentElement.requestFullscreen()
  }

  return (
    <div className="control-dock" aria-label="音频与显示控制">
      <input ref={fileRef} className="visually-hidden" type="file" accept="audio/*" onChange={onFile} />
      <button className="command-button" type="button" onClick={() => fileRef.current?.click()} disabled={snapshot.recording} title="上传音频">
        <Upload size={17} />
        <span>音频</span>
      </button>
      <button
        className="icon-button"
        type="button"
        onClick={() => void engine.togglePlayback()}
        disabled={snapshot.mode !== 'file'}
        title={snapshot.playing ? '暂停' : '播放'}
        aria-label={snapshot.playing ? '暂停' : '播放'}
      >
        {snapshot.playing && snapshot.mode === 'file' ? <Pause size={17} /> : <Play size={17} />}
      </button>
      <span className="dock-divider" />
      <button
        className={`command-button ${snapshot.mode === 'microphone' ? 'is-active' : ''}`}
        type="button"
        onClick={() => void toggleMicrophone()}
        disabled={snapshot.recording}
        title="实时麦克风"
      >
        <Mic size={17} />
        <span>麦克风</span>
      </button>
      <button
        className={`record-button ${snapshot.recording ? 'is-recording' : ''}`}
        type="button"
        onClick={() => void toggleRecording()}
        disabled={sceneId !== 'memory-tree'}
        title={sceneId === 'memory-tree' ? (snapshot.recording ? '停止录音' : '开始录音') : '仅在记忆之树场景可用'}
      >
        <Radio size={17} />
        <span>{snapshot.recording ? '停止' : '录音'}</span>
      </button>
      {snapshot.recordingUrl && (
        <a className="icon-button" href={snapshot.recordingUrl} download="memory-tree-recording.webm" title="下载录音" aria-label="下载录音">
          <Download size={17} />
        </a>
      )}
      <span className="dock-divider" />
      <button className={`icon-button ${isFullscreen ? 'is-active' : ''}`} type="button" onClick={() => void toggleFullscreen()} title="全屏" aria-label="全屏">
        <Expand size={17} />
      </button>
    </div>
  )
}
