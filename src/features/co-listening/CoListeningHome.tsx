import { useState } from 'react';
import { VoicePrompt } from '../../components/VoicePrompt';
import { createListeningPact } from '../../services/coListeningDecision';
import type { ListeningPact } from '../../types/sound';
import { StellarSceneHost } from '../stellar-scenes/StellarSceneHost';

type CoListeningHomeProps = {
  onStart: (pact: ListeningPact, forceChooser?: boolean) => void;
  onOpenUpload: () => void;
};

export function CoListeningHome({ onStart, onOpenUpload }: CoListeningHomeProps) {
  const [intention, setIntention] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const hasIntention = Boolean(intention.trim());
  const start = (forceChooser = false) => onStart(createListeningPact(
    ['任何我可能错过的意外'],
    intention,
  ), forceChooser);

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
            onChange={setIntention}
            title="你"
            idleLabel="和 AI 说说你想记住什么"
            onListeningChange={setIsSpeaking}
            voiceOnly
            hideTitle
          />
        </div>

        <div className="co-listening-actions">
          <span className="listen-step-number">02</span>
          <button className={`co-listen-primary ${hasIntention ? 'is-ready' : ''}`} type="button" disabled={isSpeaking} onClick={() => start()}>{isSpeaking ? '我在听你说…' : '开始共同聆听'} <span aria-hidden="true">→</span></button>
          <small>{hasIntention ? '我会持续听，替你留意值得记住的片段。' : '也可以直接开始，听见那些意料之外。'}</small>
          <button className="co-listen-secondary" type="button" disabled={isSpeaking} onClick={() => start(true)}>更换设备</button>
          <button className="co-listen-secondary" type="button" onClick={onOpenUpload}>我想主动记录这一刻</button>
        </div>
      </div>
    </section>
  );
}
