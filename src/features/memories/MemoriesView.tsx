import { useMemo, useState, type CSSProperties } from 'react';
import { CURRENT_USER_ID } from '../../data/users';
import { SoundMemoryCard } from '../sound/SoundMemoryCard';
import type { SoundMemory } from '../../types/sound';
import { EchoFieldCanvas } from '../ambient-visual/EchoFieldCanvas';

type MemoriesViewProps = {
  memories: SoundMemory[];
  playingMemoryId?: string;
  savedMemoryIds: string[];
  onPlay: (memory: SoundMemory, collection: SoundMemory[]) => void;
  onSave: (memory: SoundMemory) => void;
  onOpen: (memory: SoundMemory, collection: SoundMemory[]) => void;
};

export function MemoriesView({ memories, playingMemoryId, savedMemoryIds, onPlay, onSave, onOpen }: MemoriesViewProps) {
  const [activeFilter, setActiveFilter] = useState<'shared' | 'pending' | 'disagreements'>('shared');
  const [selectedId, setSelectedId] = useState<string>();
  const mine = useMemo(() => memories.filter((memory) => memory.ownerId === CURRENT_USER_ID).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), [memories]);
  const shared = mine.filter((memory) => !memory.aiJudgement || memory.aiJudgement.reviewStatus === 'accepted');
  const pending = mine.filter((memory) => memory.aiJudgement?.reviewStatus === 'pending');
  const disagreements = mine.filter((memory) => memory.aiJudgement?.reviewStatus === 'corrected' || memory.aiJudgement?.reviewStatus === 'rejected');
  const filterItems = activeFilter === 'shared' ? shared : activeFilter === 'pending' ? pending : disagreements;
  const selected = mine.find((memory) => memory.id === selectedId) ?? filterItems[0] ?? mine[0];
  const fieldMemories = mine.filter((memory) => memory.id !== selected?.id);
  const filters = [
    { id: 'shared' as const, label: '共同留下', count: shared.length },
    { id: 'pending' as const, label: '等待确认', count: pending.length },
    { id: 'disagreements' as const, label: '存在分歧', count: disagreements.length },
  ];
  return (
    <section className="memories-view" aria-label="Memories 记忆">
      <EchoFieldCanvas input={{ mode: 'memories', memories: mine, activeMemoryId: selected?.id }} />
      <header className="memories-view-header"><div><p className="panel-kicker">MEMORIES / 记忆</p><h1>我们共同留下的声音</h1><p>{mine.length} 条属于你的 Sound Memory。人的一句话和 AI 听见的变化，都留在同一片声场里。</p><div className="memory-filters" role="tablist" aria-label="记忆状态筛选">{filters.map((filter) => <button key={filter.id} type="button" role="tab" aria-selected={activeFilter === filter.id} className={activeFilter === filter.id ? 'is-active' : ''} onClick={() => { setActiveFilter(filter.id); setSelectedId(undefined); }}><i />{filter.label}<small>{String(filter.count).padStart(2, '0')}</small></button>)}</div></div><span className="memories-total">{mine.length}<small> memories</small></span></header>
      <div className="memories-field">
        <div className="memory-orbit-list" aria-label="声音记忆节点">
          {fieldMemories.map((memory, index) => <button key={memory.id} type="button" className={`memory-orbit-node imprint-${memory.visualImprint.type} ${memory.id === selected?.id ? 'is-active' : ''}`} style={{ '--node-index': index } as CSSProperties} onClick={() => setSelectedId(memory.id)}><span className="orbit-dot" /><span>{memory.title}</span><small>{memory.location.city}</small></button>)}
        </div>
        {selected && <aside className="memory-focus" aria-live="polite"><p className="memory-focus-kicker">Sound Memory / {activeFilter}</p><h2>{selected.title}</h2><p className="memory-focus-meta">{selected.location.placeName} · {new Date(selected.recordedAt).toLocaleDateString('zh-CN')} · {Math.round(selected.duration)}s</p><div className="memory-focus-imprint" aria-label="Sound Imprint">{Array.from({ length: 18 }).map((_, index) => <i key={index} style={{ height: `${18 + ((selected.visualImprint.seed + index * 17) % 70)}%` }} />)}</div><p className="memory-focus-label">人类希望记住的</p><blockquote>“{selected.note}”</blockquote><p className="memory-focus-label">AI 听见的</p><p className="memory-focus-copy">{selected.aiJudgement?.reason ?? selected.aiDescription}</p><div className="memory-focus-actions"><button type="button" onClick={() => onPlay(selected, mine)}>{playingMemoryId === selected.id ? '暂停' : '播放'}</button><button type="button" onClick={() => onOpen(selected, mine)}>进入视觉</button><button type="button" onClick={() => onSave(selected)}>保留</button></div></aside>}
      </div>
      <div className="memory-archive-note">MY ARCHIVE · {mine.length} MEMORIES <span>LISTEN MORE. LIVE DEEPER.</span></div>
    </section>
  );
}
