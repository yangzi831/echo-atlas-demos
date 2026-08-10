import { useMemo, useState } from 'react';
import { formatDuration, formatRecordedAt } from '../../services/time';
import type { SoundNode } from '../../types/sound';

type MyLibraryPanelProps = {
  isOpen: boolean;
  nodes: SoundNode[];
  mapScope: 'all' | 'mine';
  onChangeMapScope: (scope: 'all' | 'mine') => void;
  onClose: () => void;
  onSelectNode: (node: SoundNode) => void;
};

export function MyLibraryPanel({
  isOpen,
  nodes,
  mapScope,
  onChangeMapScope,
  onClose,
  onSelectNode,
}: MyLibraryPanelProps) {
  const [playingId, setPlayingId] = useState<string>();
  const memories = useMemo(
    () => nodes
      .filter((node) => node.isMine)
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
          <article className="library-memory" key={node.id}>
            <button
              className={`library-play ${playingId === node.id ? 'is-playing' : ''}`}
              type="button"
              aria-label={`播放 ${node.title}`}
              onClick={() => setPlayingId((current) => current === node.id ? undefined : node.id)}
            >
              <span aria-hidden="true" />
            </button>
            <button className="library-memory-main" type="button" onClick={() => onSelectNode(node)}>
              <strong>{node.title}</strong>
              <span>{formatRecordedAt(node.recordedAt)} · {node.location}</span>
              <small>{formatDuration(node.durationSeconds)} · {node.hasImage ? '有图片' : '仅声音'}</small>
              <span className="library-tags">{node.tags.join(' · ')}</span>
            </button>
          </article>
        ))}
      </div>
    </aside>
  );
}
