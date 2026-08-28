import fieldImagePlaceholder from '../../../docs/map-style-studies/dark-satellite.png';
import type { SoundNode, SoundSourceType } from '../../types/sound';
import { getUser } from '../../data/users';

const sourceLabels: Record<SoundSourceType, string> = {
  user_recording: '用户现场录音',
  authentic_archive: '真实历史档案',
  artistic_reconstruction: '艺术化重构',
};

type SoundDetailPanelProps = {
  node?: SoundNode;
  onClose: () => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
};

function formatArchiveDate(value: string) {
  const [date, time = ''] = value.split('T');
  return `${date.split('-').join('.')} · ${time.slice(0, 5)}`;
}

export function SoundDetailPanel({ node, onClose, isPlaying, onTogglePlay }: SoundDetailPanelProps) {
  if (!node) {
    return null;
  }

  const owner = getUser(node.ownerId);

  return (
    <aside className="sound-panel" aria-label="声音详情">
      <button className="panel-close" type="button" onClick={onClose} aria-label="关闭声音详情">
        ×
      </button>
      <p className="panel-kicker">Sound Memory</p>
      <h2>{node.title}</h2>
      <p className="sound-place">{node.location.city} · {node.location.placeName}</p>
      <time className="sound-date">{formatArchiveDate(node.recordedAt)}</time>

      <button className={`play-button ${isPlaying ? 'is-playing' : ''}`} type="button" onClick={onTogglePlay}>
        <span className="play-icon" aria-hidden="true" />
        {isPlaying ? '暂停' : '播放'}
      </button>

      <div className={`waveform ${isPlaying ? 'is-playing' : ''}`} aria-label="声音波形">
        {Array.from({ length: 34 }).map((_, index) => (
          <span
            key={index}
            style={{
              animationDelay: `${index * 70}ms`,
              height: `${22 + ((index * 17) % 48)}%`,
            }}
          />
        ))}
      </div>

      {node.imageUrl && (
        <div className="memory-photo" aria-label={`${node.location.placeName}图片占位`}>
          <img src={fieldImagePlaceholder} alt="" />
          <span>FIELD IMAGE / {node.cityId.toUpperCase()}</span>
          <strong>{node.location.placeName}</strong>
        </div>
      )}

      <blockquote className="human-memory">“{node.note}”</blockquote>
      <p className="sound-contributor">{owner.name} · {owner.bio}</p>

      <div className="tag-cloud" aria-label="声音标签">
        {node.tags.map((tag) => <span key={tag}>{tag}</span>)}
      </div>

      <details className="sound-more">
        <summary>更多信息</summary>
        <dl className="sound-meta">
          <div>
            <dt>来源</dt>
            <dd>{sourceLabels[node.sourceType]}</dd>
          </div>
          <div>
            <dt>情绪</dt>
            <dd>{node.moods.join(' / ')}</dd>
          </div>
        </dl>
        <section className="detail-block">
          <span>声音分析</span>
          <p>{node.aiDescription}</p>
        </section>
      </details>
    </aside>
  );
}
