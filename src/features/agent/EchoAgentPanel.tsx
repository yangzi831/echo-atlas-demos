import { useEffect, useMemo, useRef, useState } from 'react';
import { searchSoundMemories } from '../../services/memories';
import { interpretRecall } from '../../services/recallInterpreter';
import { getUser } from '../../data/users';
import { formatDuration, formatRecordedAt } from '../../services/time';
import type { RecallScope, SoundMemory } from '../../types/sound';
import { EchoFieldCanvas } from '../ambient-visual/EchoFieldCanvas';

type EchoAgentPanelProps = {
  ambient?: boolean;
  isOpen: boolean;
  nodes: SoundMemory[];
  scope: RecallScope;
  playingMemoryId?: string;
  savedMemoryIds: string[];
  onScopeChange: (scope: RecallScope) => void;
  onRoute: (nodeIds: string[]) => void;
  onPlay: (memory: SoundMemory, collection: SoundMemory[]) => void;
  onSave: (memory: SoundMemory) => void;
  onOpen: (memory: SoundMemory, collection: SoundMemory[]) => void;
  onViewAtlas: (memory: SoundMemory) => void;
};

export function EchoAgentPanel({
  ambient = false,
  isOpen,
  nodes,
  scope,
  playingMemoryId,
  savedMemoryIds,
  onScopeChange,
  onRoute,
  onPlay,
  onSave,
  onOpen,
  onViewAtlas,
}: EchoAgentPanelProps) {
  const [prompt, setPrompt] = useState('给我一点柏林冬天');
  const [resultIds, setResultIds] = useState<string[]>();
  const [isResolving, setIsResolving] = useState(false);
  const recallTimerRef = useRef<number | undefined>(undefined);
  const resultNodes = useMemo(
    () => (resultIds ?? []).map((id) => nodes.find((node) => node.id === id)).filter((node): node is SoundMemory => Boolean(node)),
    [nodes, resultIds],
  );
  const interpretation = useMemo(() => interpretRecall(prompt, resultNodes), [prompt, resultNodes]);
  const primaryResult = resultNodes[0];
  const primaryOwner = primaryResult ? getUser(primaryResult.ownerId) : undefined;

  useEffect(() => () => {
    if (recallTimerRef.current) window.clearTimeout(recallTimerRef.current);
  }, []);

  if (!isOpen) return null;

  const handleRecall = () => {
    const matches = searchSoundMemories(nodes, prompt);
    setIsResolving(true);
    if (recallTimerRef.current) window.clearTimeout(recallTimerRef.current);
    recallTimerRef.current = window.setTimeout(() => {
      setResultIds(matches.map((memory) => memory.id));
      onRoute(matches.map((memory) => memory.id));
      setIsResolving(false);
    }, 1700);
  };

  return (
    <aside className={`agent-panel recall-panel ${ambient ? 'ambient-recall-panel' : ''}`} aria-label="声音召回">
      {ambient && <EchoFieldCanvas input={{ mode: isResolving ? 'recall-resolving' : resultNodes.length > 0 ? 'recall-result' : 'recall-idle', memories: resultNodes.length > 0 ? resultNodes : nodes.slice(0, 16), activeMemoryId: resultNodes[0]?.id, recallQuery: prompt }} />}
      <p className="panel-kicker">Recall</p>
      <h2>现在，你想听见什么？</h2>

      <div className="recall-scope" aria-label="声音召回范围">
        <button type="button" aria-pressed={scope === 'mine'} onClick={() => onScopeChange('mine')}>我的声音</button>
        <button type="button" aria-pressed={scope === 'public'} onClick={() => onScopeChange('public')}>公共 Atlas</button>
        <button type="button" aria-pressed={scope === 'following'} onClick={() => onScopeChange('following')}>我关注的人</button>
      </div>

      <label className="agent-prompt">
        <span>地点、时间，或一种声音感受</span>
        <input value={prompt} onChange={(event) => setPrompt(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !isResolving) handleRecall(); }} />
      </label>

      <div className="prompt-chips">
        <button type="button" onClick={() => setPrompt('给我一点柏林冬天')}>柏林 · 冬天</button>
        <button type="button" onClick={() => setPrompt('东京雨夜')}>东京 · 雨</button>
        <button type="button" onClick={() => setPrompt('上海夜晚的水声')}>上海 · 夜晚 · 水</button>
      </div>

      <button className="curate-button" type="button" onClick={handleRecall} disabled={isResolving}>{isResolving ? '正在召回……' : '召回这段声音'}</button>

      {resultIds && (
        <div className="agent-route" aria-live="polite">
          <div className="recall-interpretation">
            <strong>{interpretation.headline}</strong>
            <p>{interpretation.detail}</p>
            {interpretation.matchedFields.length > 0 && <small>依据：{interpretation.matchedFields.join(' · ')}</small>}
          </div>
          {primaryResult && primaryOwner && <article className="recall-primary-memory">
            <p>{primaryOwner.name} · {primaryResult.location.city}</p>
            <h3>{primaryResult.title}</h3>
            <span>{primaryResult.location.placeName} · {formatRecordedAt(primaryResult.recordedAt)} · {formatDuration(primaryResult.duration)}</span>
            <div className="recall-imprint" aria-label="Sound Imprint">{Array.from({ length: 20 }).map((_, index) => <i key={index} style={{ height: `${18 + ((primaryResult.visualImprint.seed + index * 19) % 72)}%` }} />)}</div>
            <blockquote>“{primaryResult.note}”</blockquote>
            <div className="recall-primary-actions">
              <button type="button" onClick={() => onPlay(primaryResult, resultNodes)}>{playingMemoryId === primaryResult.id ? '暂停' : '播放这段记忆'}</button>
              <button type="button" aria-pressed={savedMemoryIds.includes(primaryResult.id)} onClick={() => onSave(primaryResult)}>{savedMemoryIds.includes(primaryResult.id) ? '已保留' : '保留'}</button>
              <button type="button" onClick={() => onViewAtlas(primaryResult)}>沿着它继续寻找</button>
            </div>
          </article>}
          {resultNodes.length > 1 && <div className="recall-candidates" aria-label="其他候选记忆">{resultNodes.slice(1, 4).map((memory) => <button key={memory.id} type="button" onClick={() => onOpen(memory, resultNodes)}><span>{memory.location.city}</span><strong>{memory.title}</strong></button>)}</div>}
          {resultNodes.length === 0 && !isResolving && <p className="recall-empty">还没有在这片档案里找到相似的声音。试试地点、季节或一种感受。</p>}
          {resultNodes.length > 0 && (
            <div className="recall-actions">
              <button type="button" onClick={() => setPrompt(`${prompt} 的另一种感觉`)}>换一种理解</button>
              <button type="button" onClick={() => onOpen(resultNodes[0], resultNodes)}>为什么是它</button>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
