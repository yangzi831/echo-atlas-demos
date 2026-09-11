import { useMemo, useState } from 'react';
import { createListeningPact } from '../../services/coListeningDecision';
import type { ListeningPact } from '../../types/sound';

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
  const [selected, setSelected] = useState<string[]>([criteria[0], criteria[5]]);
  const [intention, setIntention] = useState('');
  const [avoid, setAvoid] = useState('');
  const pact = useMemo(() => createListeningPact(selected, intention, avoid), [avoid, intention, selected]);

  return (
    <section className="co-listening-home" aria-labelledby="listen-heading">
      <div className="co-listening-intro">
        <p className="panel-kicker">LISTEN / 共听</p>
        <h1 id="listen-heading">今天想让我替你留意什么？</h1>
        <p>先和 AI 约定这一段时间值得注意的变化。它会持续听，也会把“不保存”当作一种判断。</p>
      </div>

      <div className="listening-pact-form">
        <div className="pact-criteria" aria-label="记忆意图">
          {criteria.map((criterion) => {
            const isSelected = selected.includes(criterion);
            return (
              <button
                key={criterion}
                className={isSelected ? 'is-selected' : ''}
                type="button"
                aria-pressed={isSelected}
                onClick={() => setSelected((current) => isSelected ? current.filter((item) => item !== criterion) : [...current, criterion])}
              >
                <span aria-hidden="true">{isSelected ? '●' : '○'}</span>{criterion}
              </button>
            );
          })}
        </div>
        <label className="pact-field">
          <span>也可以直接告诉 AI，你希望它注意什么</span>
          <textarea value={intention} onChange={(event) => setIntention(event.target.value)} rows={3} placeholder="帮我注意热闹结束后的空旷、列车进站前的低频和突然出现的雨声，不要保存完整的私人谈话。" />
        </label>
        <label className="pact-field pact-avoid-field">
          <span>希望忽略什么（可选）</span>
          <input value={avoid} onChange={(event) => setAvoid(event.target.value)} placeholder="例如：完整的私人谈话" />
        </label>
        <div className="co-listening-actions">
          <button className="co-listen-primary" type="button" disabled={pact.selectedCriteria.length === 0 && !pact.freeformIntention} onClick={() => onStart(pact)}>开始共同聆听</button>
          <button className="co-listen-secondary" type="button" onClick={onOpenUpload}>我想主动记录这一刻</button>
        </div>
      </div>
    </section>
  );
}
