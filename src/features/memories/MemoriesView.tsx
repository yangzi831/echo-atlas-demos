import { TimedTranscript } from './TimedTranscript';
import { RecordingArchivePanel } from './RecordingArchivePanel';
import type { CapturedMemoryAssets } from '../../services/captureStorage';
import { wallTime } from '../../services/transcriptTypes';
import { JourneySteps } from '../../components/JourneySteps';
import { askEcho, recallMetadata } from '../../services/echoAI';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { VoicePrompt } from '../../components/VoicePrompt';
import { CURRENT_USER_ID } from '../../data/users';
import { getRecallMemories, searchSoundMemories } from '../../services/memories';
import { interpretRecall } from '../../services/recallInterpreter';
import { formatDuration, formatRecordedAt } from '../../services/time';
import type { RecallScope, SoundMemory } from '../../types/sound';
import { EchoFieldCanvas } from '../ambient-visual/EchoFieldCanvas';

type MemoriesViewProps = {
  onCreate: (capture: CapturedMemoryAssets) => Promise<void>;
  recallMode?: boolean;
  onReview: (memory: SoundMemory) => Promise<void>;
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

export function MemoriesView({ onCreate, recallMode = false, onReview, memories, playingMemoryId, savedMemoryIds, recallScope, onRecallScopeChange, onPlay, onSave, onOpen, onViewAtlas }: MemoriesViewProps) {
  const [activeFilter, setActiveFilter] = useState<'shared' | 'pending' | 'disagreements'>('shared');
  const [selectedId, setSelectedId] = useState<string>();
  const [query, setQuery] = useState('');
  const [resultIds, setResultIds] = useState<string[]>();
  const [isResolving, setIsResolving] = useState(false);
  const [showWhyId, setShowWhyId] = useState<string>();
  const [recommendationPage, setRecommendationPage] = useState(0);
  const recallRequest = useRef<AbortController | undefined>(undefined);
  const [aiSummary,setAISummary]=useState('');
  const [aiError,setAIError]=useState('');
  const [reviewBusy,setReviewBusy]=useState(false);
  const [reviewError,setReviewError]=useState('');
  const [humanNote,setHumanNote]=useState('');

  const mine = useMemo(() => memories.filter((memory) => memory.ownerId === CURRENT_USER_ID).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), [memories]);
  const shared = mine.filter((memory) => !memory.aiJudgement || memory.aiJudgement.reviewStatus === 'accepted');
  const pending = mine.filter((memory) => memory.aiJudgement?.reviewStatus === 'pending');
  const disagreements = mine.filter((memory) => memory.aiJudgement?.reviewStatus === 'corrected' || memory.aiJudgement?.reviewStatus === 'rejected');
  const filterItems = activeFilter === 'shared' ? shared : activeFilter === 'pending' ? pending : disagreements;
  const recallPool = useMemo(() => getRecallMemories(memories, recallScope).filter(m=>m.aiJudgement?.reviewStatus !== 'rejected'), [memories, recallScope]);
  const resultMemories = useMemo(() => (resultIds ?? []).map((id) => recallPool.find((memory) => memory.id === id)).filter((memory): memory is SoundMemory => Boolean(memory)), [recallPool, resultIds]);
  const selected = selectedId ? memories.find((memory) => memory.id === selectedId) : undefined;
  const recommendations = useMemo(() => {
    const sorted = mine.filter(m=>m.aiJudgement?.reviewStatus !== 'rejected').sort((a, b) => Number(Boolean(b.aiJudgement)) - Number(Boolean(a.aiJudgement)) || new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());
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

  useEffect(() => {recallRequest.current?.abort();setIsResolving(false);setResultIds(undefined);setAISummary('');setAIError('');return()=>recallRequest.current?.abort();}, [recallScope, recallMode]);
  const recall = async (nextQuery = query) => {
    const normalized=nextQuery.trim();if(!normalized)return;
    recallRequest.current?.abort();const controller=new AbortController();recallRequest.current=controller;
    setQuery(normalized);setSelectedId(undefined);setResultIds(undefined);setIsResolving(true);setAIError('');setAISummary('');
    const pool=[...searchSoundMemories(recallPool,normalized,40),...recallPool];
    const unique=[...new Map(pool.map(m=>[m.id,m])).values()];
    try {const result=await askEcho({task:'recall',text:normalized,memories:recallMetadata(unique)},controller.signal);if(!controller.signal.aborted){setResultIds(result.ids);setAISummary(result.summary);}}
    catch(error){if(!controller.signal.aborted){setResultIds(searchSoundMemories(recallPool,normalized,4).map(m=>m.id));setAIError((error instanceof Error?error.message:'AI 暂时不可用')+' 当前显示本地关键词匹配结果。');}}
    finally{if(!controller.signal.aborted)setIsResolving(false);}
  };
  const review = async (memory:SoundMemory, reviewStatus:NonNullable<SoundMemory['aiJudgement']>['reviewStatus'])=>{
    if(!memory.aiJudgement)return;setReviewBusy(true);setReviewError('');
    try{await onReview({...memory,aiJudgement:{...memory.aiJudgement,reviewStatus,humanFeedback:reviewStatus==='corrected'?humanNote:memory.aiJudgement.humanFeedback,decidedAt:new Date().toISOString()}});setHumanNote('');}
    catch{setReviewError('反馈保存失败，请重试。');}finally{setReviewBusy(false);}
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
    <section className={`memories-view ${recallMode ? 'is-recall-mode' : 'is-leave-mode'}`} aria-label="Memories 记忆">
      <JourneySteps active={recallMode?4:3}/>
      <EchoFieldCanvas input={{ mode: isResolving ? 'recall-resolving' : resultMemories.length > 0 ? 'recall-result' : 'memories', memories: visualMemories, activeMemoryId: resultMemories[0]?.id ?? selected?.id, recallQuery: query }} />
      <header className="memories-view-header"><div><p className="panel-kicker">{recallMode?'04 / 重返':'03 / 留下'}</p><h1>{recallMode?'想回到哪一种感受里？':'AI 先注意，你有最后一票。'}</h1><p>{mine.length} 条属于你的 Sound Memory。确认、撤回，或补上只有你知道的意义。</p></div><span className="memories-total">{mine.length}<small> memories</small></span></header>

      <div className="memories-workspace">
        <div className="memories-left-column">
          <section className="memory-recall-entry" aria-label="AI 声音召回">
            <p className="memory-recall-heading">现在，你想回到哪一种声音里？</p>
            <VoicePrompt compact value={query} onChange={setQuery} title="可以直接说出一句记忆" idleLabel="说出一句记忆" />
            <small className="recall-data-note">召回会将搜索文字和最多 80 条记忆的文字、地点与标签发送给 AI；音频不上传。</small><div className="memory-recall-submit-row"><button className="memory-recall-submit" type="button" disabled={isResolving} onClick={() => recall()}>{isResolving ? '正在重新连接记忆……' : '开始召回 →'}</button><button type="button" onClick={() => recall('给我一点柏林冬天')}>例如：给我一点柏林冬天</button></div>
            <div className="memory-recall-scope" aria-label="声音召回范围">{scopeLabels.map((item) => <button key={item.id} type="button" aria-pressed={recallScope === item.id} onClick={() => { onRecallScopeChange(item.id); setResultIds(undefined); }}>{item.label}</button>)}</div>
          </section>
          <div className="memory-filters" role="tablist" aria-label="记忆状态筛选">{filters.map((filter) => <button key={filter.id} type="button" role="tab" aria-selected={activeFilter === filter.id} className={activeFilter === filter.id ? 'is-active' : ''} onClick={() => { setActiveFilter(filter.id); setSelectedId(undefined); setResultIds(undefined); }}><i />{filter.label}<small>{String(filter.count).padStart(2, '0')}</small></button>)}</div>
        </div>

        <div className="memories-field">{fieldMemories.length===0&&<p className="archive-empty">{activeFilter==='pending'?'还没有等待确认的声音。开始一次共听，让变化成为记忆。':activeFilter==='disagreements'?'暂时没有分歧。你可以随时撤回或重新解释一条记忆。':'这里等待你的第一段声音。'}</p>}<div className="memory-orbit-list" aria-label="声音记忆节点">{fieldMemories.map((memory, index) => <button key={memory.id} type="button" className={`memory-orbit-node imprint-${memory.visualImprint.type} ${memory.id === selected?.id ? 'is-active' : ''} ${memory.id === playingMemoryId ? 'is-playing' : ''}`} style={{ '--node-index': index } as CSSProperties} aria-label={`播放 ${memory.title}`} onClick={() => chooseMemory(memory)}><span className="orbit-dot"><b aria-hidden="true">▶</b></span><span>{memory.title}</span><small>{memory.location.city}</small><em>点击聆听</em></button>)}</div></div>

        <aside className="memories-conversation" aria-live="polite">
          {isResolving && <div className="memory-ai-resolving"><i /><strong>我正在沿着地点、季节和声音感受寻找……</strong><span>候选记忆正在重新聚合</span></div>}
          {!isResolving && resultIds && <section className="memory-recall-results">
            <button className="memory-panel-back" type="button" onClick={() => setResultIds(undefined)}>← 返回共同记忆</button><p className="memory-ai-kicker">这句话让我想起</p><h2>{interpretation.headline}</h2><p>{aiSummary || interpretation.detail}</p>{aiError&&<p role="status">{aiError}</p>}
            {resultMemories[0] && <article className="recall-featured-memory"><MemoryImprint memory={resultMemories[0]} /><small>最接近的一条 · {resultMemories[0].location.city}</small><h3>{resultMemories[0].title}</h3><span>{resultMemories[0].location.placeName} · {formatRecordedAt(resultMemories[0].recordedAt)}</span><blockquote>“{resultMemories[0].note}”</blockquote>{renderActions(resultMemories[0], resultMemories)}</article>}
            {resultMemories.length > 1 && <div className="recall-other-memories"><p>还有几段声音，也与“{query}”产生了联系。</p>{resultMemories.slice(1, 4).map((memory) => <button key={memory.id} type="button" onClick={() => onPlay(memory, resultMemories)}><MemoryImprint memory={memory} compact /><span><strong>{memory.title}</strong><small>{memory.location.city} · {formatDuration(memory.duration)}</small></span><b>{playingMemoryId === memory.id ? '暂停' : '播放'}</b></button>)}</div>}
            {resultMemories.length === 0 && <p className="recall-empty">还没有找到相似的声音。试试地点、季节，或一种更具体的感受。</p>}
            {resultMemories.length > 0 && <div className="recall-result-actions"><button type="button" onClick={() => recall(`${query} 的另一种感觉`)}>换一种理解</button><button type="button" onClick={() => setShowWhyId(resultMemories[0].id)}>为什么是它</button></div>}
            {showWhyId && <p className="recall-why-copy">{aiSummary || '本地匹配使用地点、时间、标题和声音标签。'}</p>}
          </section>}
          {!isResolving && !resultIds && selected && <section className="memory-focus"><button className="memory-panel-back" type="button" onClick={() => setSelectedId(undefined)}>← 返回共同记忆</button><p className="memory-focus-kicker">Sound Memory / {activeFilter}</p><h2>{selected.title}</h2><p className="memory-focus-meta">{selected.location.placeName} · {formatRecordedAt(selected.recordedAt)} · {formatDuration(selected.duration)}</p><MemoryImprint memory={selected} />{selected.timing&&<p className="memory-timing">{wallTime(selected.timing.startedAt,selected.timing.timeZone)} — {wallTime(selected.timing.endedAt,selected.timing.timeZone)} · {selected.timing.timeZone}<br/>AI 判断于 {selected.aiJudgement?wallTime(selected.aiJudgement.decidedAt,selected.timing.timeZone):'—'}</p>}<p className="memory-focus-label">人类希望记住的</p><blockquote>“{selected.note}”</blockquote><p className="memory-focus-label">AI 听见的</p><p className="memory-focus-copy">{selected.aiJudgement?.reason ?? selected.aiDescription}</p>{renderActions(selected, mine)}<TimedTranscript memory={selected}/>{selected.aiJudgement&&<div className="archive-review"><p>你的判断</p><p>{selected.aiJudgement.humanFeedback}</p><div><button disabled={reviewBusy} onClick={()=>void review(selected,'accepted')}>确认留下</button><button disabled={reviewBusy} onClick={()=>void review(selected,selected.aiJudgement?.reviewStatus==='rejected'?'pending':'rejected')}>{selected.aiJudgement.reviewStatus==='rejected'?'恢复待确认':'撤回这次判断'}</button></div><label>补上你的理解<textarea maxLength={600} value={humanNote} onChange={e=>setHumanNote(e.target.value)}/></label><button disabled={reviewBusy||!humanNote.trim()} onClick={()=>void review(selected,'corrected')}>保存我的理解</button>{reviewError&&<p role="alert">{reviewError}</p>}</div>}</section>}
          {!isResolving && !resultIds && !selected && <section className="memory-recommendations"><p className="memory-ai-kicker">AI MEMORY COMPANION</p><h2>或许，你现在想回到这些声音里。</h2><p>这里是最近记录的声音，优先展示共同聆听的片段。</p><div>{recommendations.map((memory) => <article key={memory.id}><button className="recommendation-main" type="button" onClick={() => onPlay(memory, recommendations)}><MemoryImprint memory={memory} compact /><span><strong>{memory.title}</strong><small>{memory.location.placeName} · {formatRecordedAt(memory.recordedAt)}</small><em>{memory.aiJudgement?.reason || memory.tags.slice(0,3).join(' · ')}</em></span><b>{playingMemoryId === memory.id ? '暂停' : '▶ 播放'}</b></button><button className="recommendation-why" type="button" onClick={() => setShowWhyId(showWhyId === memory.id ? undefined : memory.id)}>为什么是它</button>{showWhyId === memory.id && <p className="recommendation-reason">按最近记录时间排列，优先展示带有共听判断的记忆。</p>}</article>)}</div><button className="recommendation-refresh" type="button" onClick={() => { setRecommendationPage((page) => page + 1); setShowWhyId(undefined); }}>换一组</button></section>}
        </aside>
      </div>
      {!recallMode&&<RecordingArchivePanel onCreate={onCreate} memories={memories}/>}
    </section>
  );
}
