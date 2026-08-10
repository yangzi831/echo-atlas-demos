import { useEffect, useState } from 'react';
import fieldImagePlaceholder from '../../../docs/map-style-studies/dark-satellite.png';
import type { ListeningStory, SoundNode } from '../../types/sound';

type StoryModePanelProps = {
  story?: ListeningStory;
  node?: SoundNode;
  stepIndex: number;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onExit: () => void;
};

function formatStoryTime(value: string) {
  const [date, time = ''] = value.split('T');
  const [, month, day] = date.split('-');
  return `${date.slice(0, 4)}.${month}.${day} · ${time.slice(0, 5)}`;
}

export function StoryModePanel({
  story,
  node,
  stepIndex,
  isPlaying,
  onTogglePlay,
  onPrevious,
  onNext,
  onExit,
}: StoryModePanelProps) {
  const [imageReady, setImageReady] = useState(false);

  useEffect(() => {
    setImageReady(false);
    const timer = window.setTimeout(() => setImageReady(true), 180);
    return () => window.clearTimeout(timer);
  }, [node?.id]);

  if (!story || !node) {
    return null;
  }

  const isFirst = stepIndex === 0;
  const isLast = stepIndex === story.nodeIds.length - 1;

  return (
    <aside className="story-panel" aria-label={`${story.title}声音漫游`}>
      <div className="story-progress">
        <span>{String(stepIndex + 1).padStart(2, '0')}</span>
        <i />
        <small>{String(story.nodeIds.length).padStart(2, '0')}</small>
      </div>

      <p className="story-location">{node.location}</p>
      <time>{formatStoryTime(node.recordedAt)}</time>

      <div className={`story-image ${imageReady ? 'is-ready' : ''}`} aria-label="声音地点图片占位">
        <img src={fieldImagePlaceholder} alt="" />
        <span>{node.cityId.toUpperCase()} / FIELD IMAGE</span>
        <strong>{node.placeName}</strong>
      </div>

      <button className={`story-play ${isPlaying ? 'is-playing' : ''}`} type="button" onClick={onTogglePlay}>
        <span aria-hidden="true" />
        {isPlaying ? '暂停' : '播放声音'}
      </button>

      <blockquote>{node.memoryText}</blockquote>
      <p className="story-sound-tags">{node.tags.join(' / ')}</p>

      <div className="story-controls">
        <button type="button" onClick={onPrevious} disabled={isFirst}>上一个</button>
        <button type="button" onClick={onExit}>退出漫游</button>
        <button type="button" onClick={onNext}>{isLast ? '回到开头' : '下一个'}</button>
      </div>
    </aside>
  );
}
