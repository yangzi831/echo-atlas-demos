import { useMemo } from 'react';
import { SoundMemoryCard } from '../sound/SoundMemoryCard';
import type { SoundMemory } from '../../types/sound';

type FollowingFeedProps = {
  memories: SoundMemory[];
  playingMemoryId?: string;
  savedMemoryIds: string[];
  onPlay: (memory: SoundMemory, collection: SoundMemory[]) => void;
  onSave: (memory: SoundMemory) => void;
  onOpen: (memory: SoundMemory, collection: SoundMemory[]) => void;
  onOpenOnMap: (memory: SoundMemory) => void;
};

const featuredIds = ['aya-tokyo-rain', 'berlin-ubahn-arrival', 'bus-stop-rain-night'];

export function FollowingFeed({ memories, playingMemoryId, savedMemoryIds, onPlay, onSave, onOpen, onOpenOnMap }: FollowingFeedProps) {
  const sortedMemories = useMemo(
    () => [...memories].sort((a, b) => {
      const aFeatured = featuredIds.indexOf(a.id);
      const bFeatured = featuredIds.indexOf(b.id);
      if (aFeatured >= 0 && bFeatured >= 0) return aFeatured - bFeatured;
      if (aFeatured >= 0) return -1;
      if (bFeatured >= 0) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }),
    [memories],
  );

  return (
    <section className="following-feed" aria-label="Following 关注动态">
      <header>
        <p className="panel-kicker">Following</p>
        <h2>最近听见的地方</h2>
        <span>Aya, Ming and people you follow · {sortedMemories.length} sound memories</span>
      </header>
      <div className="following-list">
        {sortedMemories.map((memory) => (
          <SoundMemoryCard
            key={memory.id}
            memory={memory}
            isPlaying={playingMemoryId === memory.id}
            isSaved={savedMemoryIds.includes(memory.id)}
            onPlay={(selected) => onPlay(selected, sortedMemories)}
            onSave={onSave}
            onViewAtlas={onOpenOnMap}
            onOpen={(selected) => onOpen(selected, sortedMemories)}
          />
        ))}
      </div>
    </section>
  );
}
