import { CURRENT_USER_ID, followedUserIds } from '../data/users';
import type { RecallScope, SoundMemory } from '../types/sound';

const queryExpansions: Array<[RegExp, string[]]> = [
  [/柏林|berlin/i, ['柏林', 'berlin']],
  [/上海|shanghai/i, ['上海', 'shanghai']],
  [/东京|tokyo/i, ['东京', 'tokyo']],
  [/北京|beijing/i, ['北京', 'beijing']],
  [/新加坡|singapore/i, ['新加坡', 'singapore']],
  [/冬|winter|雪/i, ['冬', '冬天', '冬夜', '寒冷', '雪', 'winter']],
  [/雨|rain/i, ['雨', '雨夜', '雨声', 'rain']],
  [/夜|night/i, ['夜', '夜晚', '夜间', 'night']],
  [/水|water|river|canal/i, ['水', '水声', '河', '江', '运河', 'water', 'canal']],
  [/地铁|subway|u-?bahn|mrt/i, ['地铁', '列车', 'u-bahn', 'mrt', 'subway']],
  [/刚才|刚刚|recent|latest/i, ['刚才', '刚刚', '今天', '现场', 'recent']],
  [/黑客松|hackathon/i, ['黑客松', 'hackathon']],
];

function searchTerms(query: string) {
  const normalized = query.trim().toLowerCase();
  const terms = new Set(normalized.split(/[\s,，。！？!?]+/).filter((term) => term.length > 1));
  queryExpansions.forEach(([pattern, expansions]) => {
    if (pattern.test(normalized)) expansions.forEach((term) => terms.add(term));
  });
  return [...terms];
}

export function searchSoundMemories(memories: SoundMemory[], query: string, limit = 8) {
  const terms = searchTerms(query);
  if (terms.length === 0) return [];

  return memories
    .map((memory) => {
      const fields = [
        { value: `${memory.location.city} ${memory.cityId}`, weight: 8 },
        { value: memory.title, weight: 5 },
        { value: memory.tags.join(' '), weight: 5 },
        { value: memory.moods.join(' '), weight: 4 },
        { value: memory.location.placeName, weight: 3 },
        { value: memory.note, weight: 2 },
        { value: memory.recordedAt, weight: 1 },
      ];
      const score = terms.reduce((total, term) => total + fields.reduce(
        (fieldScore, field) => fieldScore + (field.value.toLowerCase().includes(term) ? field.weight : 0),
        0,
      ), 0);
      return { memory, score };
    })
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score || new Date(b.memory.recordedAt).getTime() - new Date(a.memory.recordedAt).getTime())
    .slice(0, limit)
    .map((result) => result.memory);
}

export function getMyMemories(memories: SoundMemory[]) {
  return memories.filter((memory) => memory.ownerId === CURRENT_USER_ID);
}

export function getPublicMemories(memories: SoundMemory[]) {
  return memories.filter((memory) => memory.visibility === 'public');
}

export function getFollowingMemories(memories: SoundMemory[]) {
  return memories.filter((memory) => (followedUserIds.includes(memory.ownerId) || memory.ownerId === CURRENT_USER_ID)
    && (memory.visibility === 'followers' || memory.visibility === 'public'));
}

export function getRecallMemories(memories: SoundMemory[], scope: RecallScope) {
  if (scope === 'mine') return getMyMemories(memories);
  if (scope === 'following') {
    return memories.filter((memory) => followedUserIds.includes(memory.ownerId)
      && (memory.visibility === 'followers' || memory.visibility === 'public'));
  }
  return getPublicMemories(memories);
}
