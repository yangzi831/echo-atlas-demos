import { useMemo } from 'react';
import { CURRENT_USER_ID } from '../../data/users';
import type { SoundNode } from '../../types/sound';
import { SoundMemoryCard } from './SoundMemoryCard';

type MyLibraryPanelProps = {
  isOpen: boolean;
  nodes: SoundNode[];
  mapScope: 'all' | 'mine';
  onChangeMapScope: (scope: 'all' | 'mine') => void;
  onClose: () => void;
  onSelectNode: (node: SoundNode) => void;
  playingMemoryId?: string;
  savedMemoryIds: string[];
  onPlay: (node: SoundNode, collection: SoundNode[]) => void;
  onSave: (node: SoundNode) => void;
};

export function MyLibraryPanel({
  isOpen,
  nodes,
  mapScope,
  onChangeMapScope,
  onClose,
  onSelectNode,
  playingMemoryId,
  savedMemoryIds,
  onPlay,
  onSave,
}: MyLibraryPanelProps) {
  const memories = useMemo(
    () => nodes
      .filter((node) => node.ownerId === CURRENT_USER_ID)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [nodes],
  );

  if (!isOpen) {
    return null;
  }

  const showMineOnMap = () => {
    onChangeMapScope('mine');
    onClose();
  };

  return (
    <aside className="library-panel" aria-label="My Sounds 我的声音">
      <button className="panel-close" type="button" onClick={onClose} aria-label="关闭">×</button>
      <p className="panel-kicker">My Sounds</p>
      <h2>我的声音</h2>
      <p className="library-count">{memories.length} 段录音，按保存时间排列</p>

      <button className="library-map-action" type="button" onClick={showMineOnMap}>
        View on Atlas / 在地图上看
      </button>

      <div className="library-scope" aria-label="地图声音筛选">
        <button type="button" aria-pressed={mapScope === 'all'} onClick={() => onChangeMapScope('all')}>全部</button>
        <button type="button" aria-pressed={mapScope === 'mine'} onClick={() => onChangeMapScope('mine')}>我的声音</button>
      </div>

      <div className="library-list">
        {memories.map((node) => (
          <SoundMemoryCard
            key={node.id}
            memory={node}
            compact
            isPlaying={playingMemoryId === node.id}
            isSaved={savedMemoryIds.includes(node.id)}
            onPlay={(selected) => onPlay(selected, memories)}
            onSave={onSave}
            onViewAtlas={onSelectNode}
            onOpen={onSelectNode}
          />
        ))}
      </div>
    </aside>
  );
}
