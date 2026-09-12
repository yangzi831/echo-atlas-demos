import { useMemo, type CSSProperties } from 'react';
import { formatRecordedAt } from '../../services/time';
import type { SoundMemory, VisualSession } from '../../types/sound';
import { listeningAudioEngine, useListeningAudio } from './audio';
import { SceneHost } from './scenes/SceneHost';

type ReturnMemoryViewProps = {
  session: VisualSession;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onClose: () => void;
};

function clock(value: number) {
  if (!Number.isFinite(value)) return '00:00';
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(Math.floor(value % 60)).padStart(2, '0')}`;
}

export function ReturnMemoryView({ session, isPlaying, onTogglePlay, onClose }: ReturnMemoryViewProps) {
  const audio = useListeningAudio();
  const activeMemory = useMemo<SoundMemory | undefined>(
    () => session.memories.find((memory) => memory.id === session.activeMemoryId),
    [session.activeMemoryId, session.memories],
  );
  if (!activeMemory) return null;

  const duration = audio.duration || activeMemory.duration || 1;
  const progress = Math.min(100, Math.max(0, audio.currentTime / duration * 100));
  const bars = Array.from({ length: 84 }, (_, index) => {
    const seed = activeMemory.visualImprint.seed + index * 37;
    const base = 12 + (seed % 58);
    const active = index / 84 <= progress / 100;
    return <i key={index} className={active ? 'is-past' : ''} style={{ height: `${base}%` }} />;
  });

  return (
    <section className="return-memory-view" role="dialog" aria-modal="true" aria-label="重返声音记忆">
      <SceneHost presetId="trace" activeMemory={activeMemory} audio={audio} />
      <div className="return-memory-vignette" aria-hidden="true" />
      <header className="return-memory-header">
        <span>ECHO ATLAS</span>
        <button type="button" onClick={onClose}>返回记忆</button>
      </header>
      <div className="return-memory-intro">
        <p>“{activeMemory.note || '给我一点这段时间。'}”</p>
        <span>我为你找回了这一段。</span>
      </div>
      <div className="return-memory-core">
        <span className="return-memory-core-ring" aria-hidden="true" />
        <p>RETURN / 重返</p>
        <h1>{activeMemory.title.replace(/[《》]/g, '')}</h1>
        <span>{activeMemory.location.city} · {formatRecordedAt(activeMemory.recordedAt)}</span>
      </div>
      <div className="return-memory-playback">
        <div className="return-memory-status"><span>{isPlaying ? '正在播放' : '准备重返'}</span><span>{clock(audio.currentTime)} / {clock(duration)}</span></div>
        <div className={`return-memory-wave ${audio.playing ? 'is-playing' : ''}`} aria-label="真实音频播放进度">{bars}</div>
        <input aria-label="声音播放进度" type="range" min="0" max={duration} step="0.01" value={Math.min(audio.currentTime, duration)} style={{ '--progress': `${progress}%` } as CSSProperties} onChange={(event) => listeningAudioEngine.seek(Number(event.target.value))} />
        <button className="return-memory-toggle" type="button" onClick={onTogglePlay} aria-label={isPlaying ? '暂停声音' : '播放声音'}>{isPlaying ? 'Ⅱ' : '▶'}</button>
        <small>{isPlaying ? '暂停' : '播放这段声音'}</small>
      </div>
    </section>
  );
}
