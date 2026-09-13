import { JourneySteps } from '../../components/JourneySteps';
import { askEcho, type AIResult } from '../../services/echoAI';
import { useEffect, useRef, useState } from 'react';
import { VoicePrompt } from '../../components/VoicePrompt';
import { createListeningPact } from '../../services/coListeningDecision';
import type { ListeningPact } from '../../types/sound';
import { StellarSceneHost } from '../stellar-scenes/StellarSceneHost';

type CoListeningHomeProps = {
  onStart: (pact: ListeningPact) => void;
  onOpenUpload: () => void;
};

const criteria = [
  '旅行中偶然发生的有趣交流',
  '让我产生新想法的讨论',
  '朋友分享的真实经历',
  '需要记住的约定和下一步',
  '让我感到被理解的一段话',
  '值得回味的对话瞬间',
];

export function CoListeningHome({ onStart, onOpenUpload }: CoListeningHomeProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [intention, setIntention] = useState('');
  const [avoid, setAvoid] = useState('');
  const [ai, setAI] = useState<AIResult>();
  const [analysing,setAnalysing] = useState(false);
  const [aiError,setAIError] = useState('');
  const revision = useRef(0);
  useEffect(()=>{revision.current++;setAI(undefined);setIsConfirmed(false);setAnalysing(false);},[intention,avoid,selected]);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const hasIntention = selected.length > 0 || Boolean(intention.trim());
  const pactSummary = intention.trim()
    ? intention.trim()
    : selected.length > 0
      ? selected.join('、')
      : '值得回味的对话瞬间';
  const understand = async () => {
    const version=++revision.current;setAnalysing(true);setAIError('');
    try {const result=await askEcho({task:'pact',text:pactSummary,avoid,criteria:selected});if(version===revision.current){setAI(result);setIsConfirmed(false);}}
    catch(error){if(version===revision.current)setAIError(error instanceof Error?error.message:'暂时无法整理约定');}
    finally{if(version===revision.current)setAnalysing(false);}
  };
  const start = () => onStart(createListeningPact(
    isConfirmed && ai?.criteria.length ? ai.criteria : selected.length > 0 ? selected : [criteria[5]],
    intention,
    avoid,
  ));

  return (
    <section className="co-listening-home" aria-labelledby="listen-heading">
      <StellarSceneHost scene="aurora" className="co-listening-visual" />
      <div className="co-listening-intro">
        <p className="panel-kicker">ECHO ATLAS</p>
        <h1 id="listen-heading">今天，想和我一起记录什么？</h1>
        <div className="listening-dialogue" aria-label="聆听约定">
          <small>YOU</small>
          <p>“我今天在旅行，想记录一些路上随机发生的、有趣的交流。”</p>
          <small>AI</small>
          <p>“好。我会和你一起听。”</p>
        </div>
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
          {hasIntention && <div className={`listening-pact-summary ${isConfirmed ? 'is-confirmed' : ''}`} aria-live="polite">
            <small>{isConfirmed ? '记忆约定已确认' : ai ? 'AI 对约定的理解' : '你的记忆意图'}</small>
            <p>{ai?.summary || pactSummary}</p>
            <div>
              <button type="button" onClick={() => { setIntention(''); setIsConfirmed(false); }}>重新说一次</button>
              <button type="button" disabled={analysing} onClick={()=>void understand()}>{analysing?'正在理解…':'请 AI 理解这份约定'}</button><button type="button" onClick={() => setIsConfirmed(true)}>确认这份约定</button>
            </div>
          </div>}
        </div>

        <p className="quick-intention-help">不知道怎么说？选一个你希望在对话里记住的方向。</p>
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
        {aiError&&<p role="alert" className="capture-error">{aiError} 你仍可按原始意图开始共听。</p>}
        <p className="pact-data-note">开始后持续保存完整录音。音频发送至 Fun-ASR 转写，带时间的文字与约定交给 GPT 结合前后文分析。</p>
        <div className="co-listening-actions">
          <span className="listen-step-number">02</span>
          <button className={`co-listen-primary ${hasIntention ? 'is-ready' : ''}`} type="button" onClick={start}>开始共同聆听 <span aria-hidden="true">→</span></button>
          {!hasIntention && <small>没有设置也可以开始。我会替你留意值得回味的对话瞬间。</small>}
          <button className="co-listen-secondary" type="button" onClick={onOpenUpload}>我想主动记录这一刻</button>
        </div>
      </div>
    </section>
  );
}
