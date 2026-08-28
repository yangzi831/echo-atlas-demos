import { getUser } from '../../data/users';
import { formatDuration, formatRecordedAt } from '../../services/time';
import type { SoundMemory } from '../../types/sound';

type SoundMemoryCardProps = {
  memory: SoundMemory;
  isPlaying: boolean;
  isSaved?: boolean;
  compact?: boolean;
  onPlay: (memory: SoundMemory) => void;
  onSave?: (memory: SoundMemory) => void;
  onViewAtlas?: (memory: SoundMemory) => void;
  onOpen?: (memory: SoundMemory) => void;
};

export function SoundMemoryCard({
  memory,
  isPlaying,
  isSaved,
  compact,
  onPlay,
  onSave,
  onViewAtlas,
  onOpen,
}: SoundMemoryCardProps) {
  const owner = getUser(memory.ownerId);

  return (
    <article className={`sound-memory-card ${compact ? 'is-compact' : ''}`}>
      <div className={`memory-imprint imprint-${memory.visualImprint.type}`} aria-label="Sound Imprint">
        {Array.from({ length: 14 }).map((_, index) => (
          <span
            key={index}
            style={{
              height: `${18 + ((memory.visualImprint.seed + index * 23) % 64)}%`,
              opacity: 0.3 + ((memory.visualImprint.seed + index * 7) % 55) / 100,
            }}
          />
        ))}
      </div>

      <button className="memory-card-main" type="button" onClick={() => onOpen?.(memory)} disabled={!onOpen}>
        <span className="memory-card-owner">{owner.name} <small>{owner.handle}</small></span>
        <strong>{memory.title}</strong>
        <span>{memory.location.placeName} · {formatRecordedAt(memory.recordedAt)}</span>
        <blockquote>“{memory.note}”</blockquote>
      </button>

      <div className="memory-card-actions">
        <button className={isPlaying ? 'is-active' : ''} type="button" onClick={() => onPlay(memory)}>
          {isPlaying ? 'Pause' : `Play ${formatDuration(memory.duration)}`}
        </button>
        {onSave && <button type="button" aria-pressed={isSaved} onClick={() => onSave(memory)}>{isSaved ? 'Saved' : 'Save'}</button>}
        {onViewAtlas && <button type="button" onClick={() => onViewAtlas(memory)}>View on Atlas</button>}
      </div>

      <footer>
        <span>{memory.tags.slice(0, 3).join(' / ')}</span>
        {memory.captureSource === 'echo-device' && <em>Echo device</em>}
      </footer>
    </article>
  );
}
