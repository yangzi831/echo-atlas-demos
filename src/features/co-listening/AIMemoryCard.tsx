import { useState } from 'react';
import { formatDuration, formatRecordedAt } from '../../services/time';
import { resolveAudioUrl } from '../../services/publicAssetUrl';
import type { ListeningDecision, DecisionKind } from '../../services/coListeningDecision';

type AIMemoryCardProps = {
  decision: ListeningDecision;
  audioUrl?: string;
  duration: number;
  locationLabel: string;
  recordedAt: string;
  onAccept: (title: string, note: string) => void;
  onReject: () => void;
  onCorrect: (feedback: string) => void;
};

const sourceLabel: Record<DecisionKind, string> = {
  baseline: '正在建立基线',
  background: '持续背景声',
  'quiet-shift': '符合我们的约定',
  rhythmic: '符合我们的约定',
  'space-change': '符合我们的约定',
  surprise: 'AI 发现的意外',
};

export function AIMemoryCard({ decision, audioUrl, duration, locationLabel, recordedAt, onAccept, onReject, onCorrect }: AIMemoryCardProps) {
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [feedback, setFeedback] = useState('');
  const [isCorrecting, setIsCorrecting] = useState(false);

  return (
    <section className="ai-memory-card" aria-label="AI Memory Card">
      <div className="ai-memory-card-heading">
        <div>
          <p className="panel-kicker">AI MEMORY</p>
          <h3>我替你留下了这一刻</h3>
        </div>
        <span>{formatDuration(Math.max(1, duration))}</span>
      </div>
      <div className="ai-memory-meta"><span>{formatRecordedAt(recordedAt)}</span><span>{locationLabel}</span></div>
      <div className="ai-memory-imprint" aria-label="Visual Imprint">{Array.from({ length: 13 }).map((_, index) => <i key={index} style={{ height: String(24 + ((decision.timestamp + index * 19) % 62)) + '%', opacity: 0.35 + ((decision.timestamp + index * 7) % 45) / 100 }} />)}</div>
      {audioUrl && <audio controls preload="metadata" src={resolveAudioUrl(audioUrl)} />}
      <p className="ai-memory-reason">{decision.reason}</p>
      {decision.criterionLabel && <p className="ai-memory-intention">对应记忆意图：{decision.criterionLabel}</p>}
      <p className="ai-memory-source">判断来源：{decision.source === 'human-manual' ? '人类主动保留' : sourceLabel[decision.kind]} · {Math.round(decision.confidence * 100)}%</p>
      <div className="ai-memory-fields">
        <label><span>标题（可选）</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="给这一刻一个名字" /></label>
        <label><span>一句话</span><textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} placeholder="我想记住的是……" /></label>
      </div>
      <div className="ai-memory-actions">
        <button className="submit-button" type="button" onClick={() => onAccept(title, note)}>留下它</button>
        <button type="button" onClick={onReject}>这不是我想要的</button>
        <button type="button" onClick={() => setIsCorrecting((value) => !value)}>告诉 AI 哪里判断错了</button>
        <button type="button" onClick={onReject}>删除</button>
      </div>
      {isCorrecting && (
        <div className="ai-memory-correction">
          <textarea value={feedback} onChange={(event) => setFeedback(event.target.value)} rows={2} placeholder="例如：我想记住的不是安静，而是安静之前大家同时笑的声音。" />
          <button type="button" disabled={!feedback.trim()} onClick={() => onCorrect(feedback.trim())}>保存纠正</button>
        </div>
      )}
    </section>
  );
}
