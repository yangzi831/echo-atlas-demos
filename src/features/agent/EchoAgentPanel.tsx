import { useMemo, useState } from 'react';
import { searchSoundMemories } from '../../services/memories';
import { interpretRecall } from '../../services/recallInterpreter';
import { SoundMemoryCard } from '../sound/SoundMemoryCard';
import type { RecallScope, SoundMemory } from '../../types/sound';

type EchoAgentPanelProps = {
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
  const resultNodes = useMemo(
    () => (resultIds ?? []).map((id) => nodes.find((node) => node.id === id)).filter((node): node is SoundMemory => Boolean(node)),
    [nodes, resultIds],
  );
  const interpretation = useMemo(() => interpretRecall(prompt, resultNodes), [prompt, resultNodes]);

  if (!isOpen) return null;

  const handleRecall = () => {
    const matches = searchSoundMemories(nodes, prompt);
    setResultIds(matches.map((memory) => memory.id));
    onRoute(matches.map((memory) => memory.id));
  };

  return (
    <aside className="agent-panel recall-panel" aria-label="声音召回">
      <p className="panel-kicker">Recall</p>
      <h2>想听什么？</h2>

      <div className="recall-scope" aria-label="声音召回范围">
        <button type="button" aria-pressed={scope === 'mine'} onClick={() => onScopeChange('mine')}>我的声音</button>
        <button type="button" aria-pressed={scope === 'public'} onClick={() => onScopeChange('public')}>公共 Atlas</button>
        <button type="button" aria-pressed={scope === 'following'} onClick={() => onScopeChange('following')}>我关注的人</button>
      </div>

      <label className="agent-prompt">
        <span>地点、时间，或一种声音感受</span>
        <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={3} />
      </label>

      <div className="prompt-chips">
        <button type="button" onClick={() => setPrompt('给我一点柏林冬天')}>柏林 · 冬天</button>
        <button type="button" onClick={() => setPrompt('东京雨夜')}>东京 · 雨</button>
        <button type="button" onClick={() => setPrompt('上海夜晚的水声')}>上海 · 夜晚 · 水</button>
      </div>

      <button className="curate-button" type="button" onClick={handleRecall}>Recall sounds</button>

      {resultIds && (
        <div className="agent-route" aria-live="polite">
          <div className="recall-interpretation">
            <strong>{interpretation.headline}</strong>
            <p>{interpretation.detail}</p>
            {interpretation.matchedFields.length > 0 && <small>依据：{interpretation.matchedFields.join(' · ')}</small>}
          </div>
          <div className="recall-results">
            {resultNodes.map((memory) => (
              <SoundMemoryCard
                key={memory.id}
                memory={memory}
                compact
                isPlaying={playingMemoryId === memory.id}
                isSaved={savedMemoryIds.includes(memory.id)}
                onPlay={(selected) => onPlay(selected, resultNodes)}
                onSave={onSave}
                onViewAtlas={onViewAtlas}
                onOpen={(selected) => onOpen(selected, resultNodes)}
              />
            ))}
          </div>
          {resultNodes.length > 0 && (
            <div className="recall-actions">
              <button className="agent-start" type="button" onClick={() => onPlay(resultNodes[0], resultNodes)}>Play collection</button>
              <button type="button" onClick={() => setPrompt(`${prompt} 的另一种感觉`)}>换一种理解</button>
              <button type="button" onClick={() => onOpen(resultNodes[0], resultNodes)}>为什么是它</button>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
