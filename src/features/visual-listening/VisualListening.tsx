import { useMemo, useState } from 'react';
import { getUser } from '../../data/users';
import { formatRecordedAt } from '../../services/time';
import type { VisualSession } from '../../types/sound';
import { useListeningAudio } from './audio';
import { SceneHost } from './scenes/SceneHost';
import { VISUAL_PRESETS, type VisualPresetId } from './scenes';

type VisualListeningProps = {
  session: VisualSession;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onClose: () => void;
};

const sessionPreset = (preset?: string): VisualPresetId => {
  if (preset === 'field' || preset === 'archive' || preset === 'trace') return preset;
  return 'trace';
};

export function VisualListening({
  session,
  isPlaying,
  onTogglePlay,
  onPrevious,
  onNext,
  onClose,
}: VisualListeningProps) {
  const [presetId, setPresetId] = useState<VisualPresetId>(() => sessionPreset(session.preset));
  const audio = useListeningAudio();
  const activeIndex = session.memories.findIndex((memory) => memory.id === session.activeMemoryId);
  const activeMemory = session.memories[activeIndex];
  const owner = useMemo(() => activeMemory ? getUser(activeMemory.ownerId) : undefined, [activeMemory]);
  if (!activeMemory || !owner) return null;

  return (
    <section className="visual-listening" role="dialog" aria-modal="true" aria-label="Visual Listening">
      <SceneHost presetId={presetId} activeMemory={activeMemory} audio={audio} />
      <div className="visual-listening-vignette" aria-hidden="true" />

      <header className="visual-listening-header">
        <div>
          <p>Visual Listening</p>
          <strong>Echo Atlas</strong>
        </div>
        <button type="button" onClick={onClose} aria-label="Close Visual Listening">Close</button>
      </header>

      <div className="visual-listening-memory" aria-live="polite">
        <small>{String(activeIndex + 1).padStart(2, '0')} / {String(session.memories.length).padStart(2, '0')}</small>
        <h2>{activeMemory.title}</h2>
        <p>{activeMemory.location.placeName} · {formatRecordedAt(activeMemory.recordedAt)}</p>
        <span>{owner.name}</span>
      </div>

      <footer className="visual-listening-controls">
        <nav className="visual-preset-tabs" aria-label="Visual preset">
          {VISUAL_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              aria-pressed={preset.id === presetId}
              onClick={() => setPresetId(preset.id)}
            >
              {preset.label}
            </button>
          ))}
        </nav>
        <div className="visual-playback-controls">
          <button type="button" onClick={onPrevious} disabled={session.memories.length < 2} aria-label="Previous memory">←</button>
          <button className="visual-play-toggle" type="button" onClick={onTogglePlay}>{isPlaying ? 'Pause' : 'Play'}</button>
          <button type="button" onClick={onNext} disabled={session.memories.length < 2} aria-label="Next memory">→</button>
        </div>
        <div className="visual-signal-status" aria-live="polite">
          <i className={audio.playing ? 'is-live' : ''} />
          <span>{audio.playing ? 'LIVE AUDIO' : 'MEMORY IMPRINT'}</span>
        </div>
      </footer>
    </section>
  );
}
