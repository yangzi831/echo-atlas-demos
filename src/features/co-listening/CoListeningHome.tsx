import { useState } from 'react';
import { VoicePrompt } from '../../components/VoicePrompt';
import { createListeningPact } from '../../services/coListeningDecision';
import type { ListeningPact } from '../../types/sound';
import { EchoFieldCanvas } from '../ambient-visual/EchoFieldCanvas';

type CoListeningHomeProps = {
  onStart: (pact: ListeningPact) => void;
  onOpenUpload: () => void;
};

const criteria = [
  '突然安静的时刻',
  '有节奏感的声音',
  '空间发生变化',
  '人群靠近或离开',
  '陌生的语言',
  '任何我可能错过的意外',
];

export function CoListeningHome({ onStart, onOpenUpload }: CoListeningHomeProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [intention, setIntention] = useState('');
  const [avoid, setAvoid] = useState('');
  const [isConfirmed, setIsConfirmed] = useState(false);
  const hasIntention = selected.length > 0 || Boolean(intention.trim());
  const pactSummary = intention.trim()
    ? intention.trim()
    : selected.length > 0
      ? selected.join('、')
      : '任何可能被错过的意外';
  const start = () => onStart(createListeningPact(
    selected.length > 0 ? selected : [criteria[5]],
    intention,
    avoid,
  ));

  return (
    <section className="co-listening-home" aria-labelledby="listen-heading">
      <EchoFieldCanvas input={{ mode: 'listen-setup', selectedIntentions: selected }} />
      <div className="co-listening-intro">
        <p className="panel-kicker">LISTEN / 共听</p>
        <h1 id="listen-heading">今天，想和我一起记录什么？</h1>
        <p>先和我约定如何聆听，再一起走进这一段真实发生的时间。</p>
      </div>

      <div className="listening-pact-form ambient-controls">
        <div className="listen-step listen-voice-step">
          <span className="listen-step-number">01</span>
          <VoicePrompt
            value={intention}
            onChange={(value) => { setIntention(value); setIsConfirmed(false); }}
            title="你"
            idleLabel="和 AI 说说你想记住什么"
            hideTitle
          />
          {intention.trim() && <div className={`listening-pact-summary ${isConfirmed ? 'is-confirmed' : ''}`} aria-live="polite">
            <small>{isConfirmed ? '记忆约定已确认' : 'AI 整理出的记忆约定'}</small>
            <p>我会替你留意：{pactSummary}。</p>
            <div>
              <button type="button" onClick={() => { setIntention(''); setIsConfirmed(false); }}>重新说一次</button>
              <button type="button" onClick={() => setIsConfirmed(true)}>确认这份约定</button>
            </div>
          </div>}
        </div>

        <p className="quick-intention-help">不知道怎么说？也可以直接选择我需要注意的声音。</p>
        <div className="pact-criteria" aria-label="记忆意图">
          {criteria.map((criterion) => {
            const isSelected = selected.includes(criterion);
            return (
              <button
                key={criterion}
                className={isSelected ? 'is-selected' : ''}
                type="button"
                aria-pressed={isSelected}
                onClick={() => { setSelected((current) => isSelected ? current.filter((item) => item !== criterion) : [...current, criterion]); setIsConfirmed(false); }}
              >
                <span aria-hidden="true">{isSelected ? '✓' : '+'}</span><i aria-hidden="true" />{criterion}
              </button>
            );
          })}
        </div>
        <details className="pact-avoid-details">
          <summary>有什么不希望我保存的吗？（可选）</summary>
          <label className="pact-field pact-avoid-field"><span className="sr-only">希望忽略什么</span><input value={avoid} onChange={(event) => setAvoid(event.target.value)} placeholder="例如：完整的私人谈话" /></label>
        </details>
        <div className="co-listening-actions">
          <span className="listen-step-number">02</span>
          <button className={`co-listen-primary ${hasIntention ? 'is-ready' : ''}`} type="button" onClick={start}>开始共同聆听 <span aria-hidden="true">→</span></button>
          {!hasIntention && <small>没有设置也可以开始。我会替你留意任何可能被错过的意外。</small>}
          <button className="co-listen-secondary" type="button" onClick={onOpenUpload}>我想主动记录这一刻</button>
        </div>
      </div>
    </section>
  );
}
