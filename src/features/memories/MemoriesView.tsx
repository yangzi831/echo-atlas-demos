import { useMemo } from 'react';
import { CURRENT_USER_ID } from '../../data/users';
import { SoundMemoryCard } from '../sound/SoundMemoryCard';
import type { SoundMemory } from '../../types/sound';

type MemoriesViewProps = {
  memories: SoundMemory[];
  playingMemoryId?: string;
  savedMemoryIds: string[];
  onPlay: (memory: SoundMemory, collection: SoundMemory[]) => void;
  onSave: (memory: SoundMemory) => void;
  onOpen: (memory: SoundMemory, collection: SoundMemory[]) => void;
};

export function MemoriesView({ memories, playingMemoryId, savedMemoryIds, onPlay, onSave, onOpen }: MemoriesViewProps) {
  const mine = useMemo(() => memories.filter((memory) => memory.ownerId === CURRENT_USER_ID).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), [memories]);
  const shared = mine.filter((memory) => memory.aiJudgement?.reviewStatus === 'accepted');
  const pending = mine.filter((memory) => memory.aiJudgement?.reviewStatus === 'pending');
  const disagreements = mine.filter((memory) => memory.aiJudgement?.reviewStatus === 'corrected' || memory.aiJudgement?.reviewStatus === 'rejected');
  const sections = [
    { title: '我们共同留下的', copy: '你接受了 AI 的判断，并把它放进自己的档案。', items: shared },
    { title: '等待我确认的', copy: '还没有成为长期记忆的片段。', items: pending },
    { title: '存在分歧的', copy: '你纠正过 AI，或者拒绝了它的判断。', items: disagreements },
    { title: '我的声音档案', copy: '包括主动记录和此前保存的声音。', items: mine.filter((memory) => !memory.aiJudgement) },
  ];
  return (
    <section className="memories-view" aria-label="Memories 记忆">
      <header className="memories-view-header"><div><p className="panel-kicker">MEMORIES / 记忆</p><h1>我们共同留下的声音</h1><p>{mine.length} 条属于你的 Sound Memory。这里同时保留人的一句话和 AI 听见的变化。</p></div><span className="memories-total">{mine.length}<small> memories</small></span></header>
      <div className="memories-sections">
        {sections.filter((section) => section.items.length > 0).map((section) => (
          <section className="memory-group" key={section.title}><header><div><h2>{section.title}</h2><p>{section.copy}</p></div><span>{section.items.length}</span></header><div className="memory-group-list">{section.items.map((memory) => <SoundMemoryCard key={memory.id} memory={memory} isPlaying={playingMemoryId === memory.id} isSaved={savedMemoryIds.includes(memory.id)} showJudgement onPlay={(selected) => onPlay(selected, mine)} onSave={onSave} onOpen={(selected) => onOpen(selected, mine)} />)}</div></section>
        ))}
      </div>
    </section>
  );
}
