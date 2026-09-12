import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { VoicePrompt } from '../../components/VoicePrompt';
import { CURRENT_USER_ID } from '../../data/users';
import { getRecallMemories, searchSoundMemories } from '../../services/memories';
import { interpretRecall } from '../../services/recallInterpreter';
import { formatDuration, formatRecordedAt } from '../../services/time';
import type { RecallScope, SoundMemory } from '../../types/sound';
import { EchoFieldCanvas } from '../ambient-visual/EchoFieldCanvas';

type MemoriesViewProps = {
  memories: SoundMemory[];
  playingMemoryId?: string;
  savedMemoryIds: string[];
  recallScope: RecallScope;
  onRecallScopeChange: (scope: RecallScope) => void;
  onPlay: (memory: SoundMemory, collection: SoundMemory[]) => void;
  onSave: (memory: SoundMemory) => void;
  onOpen: (memory: SoundMemory, collection: SoundMemory[]) => void;
  onViewAtlas: (memory: SoundMemory) => void;
};

const scopeLabels: Array<{ id: RecallScope; label: string }> = [
  { id: 'mine', label: '我的记忆' },
  { id: 'public', label: '公共声音' },
  { id: 'following', label: '共同关注' },
];

function MemoryImprint({ memory, compact = false }: { memory: SoundMemory; compact?: boolean }) {
  const count = compact ? 10 : 18;
  return <span className={`archive-memory-imprint imprint-${memory.visualImprint.type}`} aria-hidden="true">{Array.from({ length: count }).map((_, index) => <i key={index} style={{ height: `${18 + ((memory.visualImprint.seed + index * 19) % 72)}%` }} />)}</span>;
}

export function MemoriesView({ memories, playingMemoryId, savedMemoryIds, recallScope, onRecallScopeChange, onPlay, onSave, onOpen, onViewAtlas }: MemoriesViewProps) {
  const [activeFilter, setActiveFilter] = useState<'shared' | 'pending' | 'disagreements'>('shared');
  const [selectedId, setSelectedId] = useState<string>();
  const [query, setQuery] = useState('');
  const [resultIds, setResultIds] = useState<string[]>();
  const [isResolving, setIsResolving] = useState(false);
  const [showWhyId, setShowWhyId] = useState<string>();
  const [recommendationPage, setRecommendationPage] = useState(0);
  const recallTimerRef = useRef<number | undefined>(undefined);

  const mine = useMemo(() => memories.filter((memory) => memory.ownerId === CURRENT_USER_ID).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), [memories]);
  const shared = mine.filter((memory) => !memory.aiJudgement || memory.aiJudgement.reviewStatus === 'accepted');
  const pending = mine.filter((memory) => memory.aiJudgement?.reviewStatus === 'pending');
  const disagreements = mine.filter((memory) => memory.aiJudgement?.reviewStatus === 'corrected' || memory.aiJudgement?.reviewStatus === 'rejected');
  const filterItems = activeFilter === 'shared' ? shared : activeFilter === 'pending' ? pending : disagreements;
  const recallPool = useMemo(() => getRecallMemories(memories, recallScope), [memories, recallScope]);
  const resultMemories = useMemo(() => (resultIds ?? []).map((id) => recallPool.find((memory) => memory.id === id)).filter((memory): memory is SoundMemory => Boolean(memory)), [recallPool, resultIds]);
  const selected = selectedId ? memories.find((memory) => memory.id === selectedId) : undefined;
  const recommendations = useMemo(() => {
    const sorted = [...mine].sort((a, b) => Number(Boolean(b.aiJudgement)) - Number(Boolean(a.aiJudgement)) || new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());
    if (sorted.length <= 3) return sorted;
    const offset = (recommendationPage * 3) % sorted.length;
    return Array.from({ length: 3 }, (_, index) => sorted[(offset + index) % sorted.length]);
  }, [mine, recommendationPage]);
  const fieldMemories = filterItems.slice(0, 10);
  const visualMemories = resultMemories.length > 0 ? resultMemories : selected ? [selected, ...fieldMemories] : fieldMemories;
  const interpretation = useMemo(() => interpretRecall(query, resultMemories), [query, resultMemories]);
  const filters = [
    { id: 'shared' as const, label: '共同留下', count: shared.length },
    { id: 'pending' as const, label: '等待确认', count: pending.length },
    { id: 'disagreements' as const, label: '存在分歧', count: disagreements.length },
  ];

  useEffect(() => () => { if (recallTimerRef.current) window.clearTimeout(recallTimerRef.current); }, []);

  const recall = (nextQuery = query) => {
    const normalized = nextQuery.trim() || '当时没有注意到的声音';
    setQuery(normalized);
    setSelectedId(undefined);
    setResultIds(undefined);
    setIsResolving(true);
    if (recallTimerRef.current) window.clearTimeout(recallTimerRef.current);
    recallTimerRef.current = window.setTimeout(() => {
      setResultIds(searchSoundMemories(recallPool, normalized, 4).map((memory) => memory.id));
      setIsResolving(false);
    }, 1700);
  };

  const chooseMemory = (memory: SoundMemory) => {
    setSelectedId(memory.id);
    setResultIds(undefined);
    onPlay(memory, filterItems);
  };

  const renderActions = (memory: SoundMemory, collection: SoundMemory[]) => <div className="memory-focus-actions">
    <button className="is-primary" type="button" onClick={() => onPlay(memory, collection)}>{playingMemoryId === memory.id ? '暂停' : '播放'}</button>
    <button type="button" onClick={() => onOpen(memory, collection)}>进入视觉</button>
    <button type="button" aria-pressed={savedMemoryIds.includes(memory.id)} onClick={() => onSave(memory)}>{savedMemoryIds.includes(memory.id) ? '已保留' : '保留'}</button>
    <button type="button" onClick={() => onViewAtlas(memory)}>在 Atlas 查看</button>
  </div>;

  return (
    <section className="memories-view" aria-label="Memories 记忆">
      <EchoFieldCanvas input={{ mode: isResolving ? 'recall-resolving' : resultMemories.length > 0 ? 'recall-result' : 'memories', memories: visualMemories, activeMemoryId: resultMemories[0]?.id ?? selected?.id, recallQuery: query }} />
      <header className="memories-view-header"><div><p className="panel-kicker">MEMORIES / 记忆</p><h1>我们共同留下的声音</h1><p>{mine.length} 条属于你的 Sound Memory。这里既可以聆听档案，也可以请 AI 带你回到某一种声音里。</p></div><span className="memories-total">{mine.length}<small> memories</small></span></header>

      <div className="memories-workspace">
        <div className="memories-left-column">
          <section className="memory-recall-entry" aria-label="AI 声音召回">
            <p className="memory-recall-heading">现在，你想回到哪一种声音里？</p>
            <VoicePrompt compact value={query} onChange={setQuery} title="可以直接说出一句记忆" idleLabel="说出一句记忆" />
            <div className="memory-recall-submit-row"><button className="memory-recall-submit" type="button" disabled={isResolving} onClick={() => recall()}>{isResolving ? '正在重新连接记忆……' : '开始召回 →'}</button><button type="button" onClick={() => recall('给我一点柏林冬天')}>例如：给我一点柏林冬天</button></div>
            <div className="memory-recall-scope" aria-label="声音召回范围">{scopeLabels.map((item) => <button key={item.id} type="button" aria-pressed={recallScope === item.id} onClick={() => { onRecallScopeChange(item.id); setResultIds(undefined); }}>{item.label}</button>)}</div>
          </section>
          <div className="memory-filters" role="tablist" aria-label="记忆状态筛选">{filters.map((filter) => <button key={filter.id} type="button" role="tab" aria-selected={activeFilter === filter.id} className={activeFilter === filter.id ? 'is-active' : ''} onClick={() => { setActiveFilter(filter.id); setSelectedId(undefined); setResultIds(undefined); }}><i />{filter.label}<small>{String(filter.count).padStart(2, '0')}</small></button>)}</div>
        </div>

        <div className="memories-field"><div className="memory-orbit-list" aria-label="声音记忆节点">{fieldMemories.map((memory, index) => <button key={memory.id} type="button" className={`memory-orbit-node imprint-${memory.visualImprint.type} ${memory.id === selected?.id ? 'is-active' : ''} ${memory.id === playingMemoryId ? 'is-playing' : ''}`} style={{ '--node-index': index } as CSSProperties} aria-label={`播放 ${memory.title}`} onClick={() => chooseMemory(memory)}><span className="orbit-dot"><b aria-hidden="true">▶</b></span><span>{memory.title}</span><small>{memory.location.city}</small><em>点击聆听</em></button>)}</div></div>

        <aside className="memories-conversation" aria-live="polite">
          {isResolving && <div className="memory-ai-resolving"><i /><strong>我正在沿着地点、季节和声音感受寻找……</strong><span>候选记忆正在重新聚合</span></div>}
          {!isResolving && resultIds && <section className="memory-recall-results">
            <button className="memory-panel-back" type="button" onClick={() => setResultIds(undefined)}>← 返回共同记忆</button><p className="memory-ai-kicker">这句话让我想起</p><h2>{interpretation.headline}</h2><p>{interpretation.detail}</p>
            {resultMemories[0] && <article className="recall-featured-memory"><MemoryImprint memory={resultMemories[0]} /><small>最接近的一条 · {resultMemories[0].location.city}</small><h3>{resultMemories[0].title}</h3><span>{resultMemories[0].location.placeName} · {formatRecordedAt(resultMemories[0].recordedAt)}</span><blockquote>“{resultMemories[0].note}”</blockquote>{renderActions(resultMemories[0], resultMemories)}</article>}
            {resultMemories.length > 1 && <div className="recall-other-memories"><p>还有几段声音，也与“{query}”产生了联系。</p>{resultMemories.slice(1, 4).map((memory) => <button key={memory.id} type="button" onClick={() => onPlay(memory, resultMemories)}><MemoryImprint memory={memory} compact /><span><strong>{memory.title}</strong><small>{memory.location.city} · {formatDuration(memory.duration)}</small></span><b>{playingMemoryId === memory.id ? '暂停' : '播放'}</b></button>)}</div>}
            {resultMemories.length === 0 && <p className="recall-empty">还没有找到相似的声音。试试地点、季节，或一种更具体的感受。</p>}
            {resultMemories.length > 0 && <div className="recall-result-actions"><button type="button" onClick={() => recall(`${query} 的另一种感觉`)}>换一种理解</button><button type="button" onClick={() => setShowWhyId(resultMemories[0].id)}>为什么是它</button></div>}
            {showWhyId && <p className="recall-why-copy">我参考了地点、时间、声音标签，以及你过去与这些记忆相遇的方式。</p>}
          </section>}
          {!isResolving && !resultIds && selected && <section className="memory-focus"><button className="memory-panel-back" type="button" onClick={() => setSelectedId(undefined)}>← 返回共同记忆</button><p className="memory-focus-kicker">Sound Memory / {activeFilter}</p><h2>{selected.title}</h2><p className="memory-focus-meta">{selected.location.placeName} · {formatRecordedAt(selected.recordedAt)} · {formatDuration(selected.duration)}</p><MemoryImprint memory={selected} /><p className="memory-focus-label">人类希望记住的</p><blockquote>“{selected.note}”</blockquote><p className="memory-focus-label">AI 听见的</p><p className="memory-focus-copy">{selected.aiJudgement?.reason ?? selected.aiDescription}</p>{renderActions(selected, mine)}</section>}
          {!isResolving && !resultIds && !selected && <section className="memory-recommendations"><p className="memory-ai-kicker">AI MEMORY COMPANION</p><h2>或许，你现在想回到这些声音里。</h2><p>我从我们共同留下的声音里，重新连起了几段记忆。</p><div>{recommendations.map((memory, index) => <article key={memory.id}><button className="recommendation-main" type="button" onClick={() => onPlay(memory, recommendations)}><MemoryImprint memory={memory} compact /><span><strong>{memory.title}</strong><small>{memory.location.placeName} · {formatRecordedAt(memory.recordedAt)}</small><em>{index === 0 ? '它和此刻的环境一样，留着一段安静的等待。' : index === 1 ? '你曾经在几个相似的夜晚回到这种距离感。' : '这段声音与我们最近留下的记忆产生了联系。'}</em></span><b>{playingMemoryId === memory.id ? '暂停' : '▶ 播放'}</b></button><button className="recommendation-why" type="button" onClick={() => setShowWhyId(showWhyId === memory.id ? undefined : memory.id)}>为什么是它</button>{showWhyId === memory.id && <p className="recommendation-reason">我参考了地点、时间、声音标签，以及你过去反复回到的记忆。</p>}</article>)}</div><button className="recommendation-refresh" type="button" onClick={() => { setRecommendationPage((page) => page + 1); setShowWhyId(undefined); }}>换一组</button></section>}
        </aside>
      </div>
    </section>
  );
}
