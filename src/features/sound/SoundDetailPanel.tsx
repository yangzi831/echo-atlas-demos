import type { SoundNode, SoundSourceType } from '../../types/sound';

const sourceLabels: Record<SoundSourceType, string> = {
  user_recording: 'user_recording · 用户现场录音',
  authentic_archive: 'authentic_archive · 真实历史档案',
  artistic_reconstruction: 'artistic_reconstruction · 艺术化重构',
};

type SoundDetailPanelProps = {
  node?: SoundNode;
  onClose: () => void;
};

export function SoundDetailPanel({ node, onClose }: SoundDetailPanelProps) {
  if (!node) {
    return null;
  }

  return (
    <aside className="sound-panel" aria-label="声音详情">
      <button className="panel-close" type="button" onClick={onClose}>
        Close
      </button>
      <p className="panel-kicker">Selected Echo</p>
      <h2>{node.title}</h2>
      <dl className="sound-meta">
        <div>
          <dt>地点</dt>
          <dd>{node.location}</dd>
        </div>
        <div>
          <dt>录制时间</dt>
          <dd>{node.recordedAt}</dd>
        </div>
        <div>
          <dt>声音来源</dt>
          <dd>{sourceLabels[node.sourceType]}</dd>
        </div>
      </dl>

      <button className="play-button" type="button">
        <span className="play-icon" aria-hidden="true" />
        播放这段回声
      </button>

      <div className="waveform" aria-label="自定义波形动画">
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

      <section className="detail-block">
        <span>上传者</span>
        <p>{node.uploader}</p>
      </section>
      <section className="detail-block">
        <span>AI 声音描述</span>
        <p>{node.aiDescription}</p>
      </section>

      <div className="tag-cloud" aria-label="声音标签">
        {node.tags.map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
      </div>
      <div className="mood-cloud" aria-label="情绪标签">
        {node.moods.map((mood) => (
          <span key={mood}>{mood}</span>
        ))}
      </div>

      <blockquote className="echo-message">{node.echoMessage}</blockquote>
    </aside>
  );
}
