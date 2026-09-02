import { useEffect, useRef } from 'react';
import { getUser } from '../../data/users';
import type { SoundMemory, VisualSession } from '../../types/sound';

type ListeningDockProps = {
  session: VisualSession;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onOpenVisual: () => void;
  onPlaybackEnded: () => void;
  onClose: () => void;
};

export function ListeningDock({ session, isPlaying, onTogglePlay, onPrevious, onNext, onOpenVisual, onPlaybackEnded, onClose }: ListeningDockProps) {
  const audioRef = useRef<HTMLAudioElement | undefined>(undefined);
  const endedCallbackRef = useRef(onPlaybackEnded);
  const activeIndex = session.memories.findIndex((memory) => memory.id === session.activeMemoryId);
  const activeMemory: SoundMemory | undefined = session.memories[activeIndex];

  useEffect(() => {
    endedCallbackRef.current = onPlaybackEnded;
  }, [onPlaybackEnded]);

  useEffect(() => {
    const audioUrl = activeMemory?.audioUrl;
    const canPlayAudio = Boolean(audioUrl && (audioUrl.startsWith('blob:') || audioUrl.startsWith('data:') || /^https?:\/\//.test(audioUrl)));
    audioRef.current?.pause();
    audioRef.current = undefined;
    if (!activeMemory || !canPlayAudio) return undefined;
    const audio = new Audio(activeMemory.audioUrl);
    audio.preload = 'metadata';
    audio.onended = () => endedCallbackRef.current();
    audioRef.current = audio;
    if (isPlaying) void audio.play().catch(() => endedCallbackRef.current());
    return () => {
      audio.pause();
      audio.onended = null;
    };
  }, [activeMemory?.id, activeMemory?.audioUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) void audio.play().catch(() => endedCallbackRef.current());
    else audio.pause();
  }, [isPlaying]);

  if (!activeMemory) return null;
  const owner = getUser(activeMemory.ownerId);

  return (
    <section className="listening-dock" aria-label="Listening Session">
      <div className={`listening-mini-imprint imprint-${activeMemory.visualImprint.type}`} aria-hidden="true"><span /><span /><span /><span /><span /></div>
      <div className="listening-now">
        <small>Listening · {activeIndex + 1}/{session.memories.length}</small>
        <strong>{activeMemory.title}</strong>
        <span>{owner.name} · {activeMemory.location.placeName}</span>
      </div>
      <div className="listening-controls">
        <button type="button" onClick={onPrevious} disabled={session.memories.length < 2} aria-label="上一段">←</button>
        <button className="listening-play" type="button" onClick={onTogglePlay}>{isPlaying ? 'Pause' : 'Play'}</button>
        <button type="button" onClick={onNext} disabled={session.memories.length < 2} aria-label="下一段">→</button>
      </div>
      <button className="open-visual-button" type="button" onClick={onOpenVisual}>Open Visual Listening</button>
      <button className="listening-close" type="button" onClick={onClose} aria-label="关闭播放器">×</button>
    </section>
  );
}
