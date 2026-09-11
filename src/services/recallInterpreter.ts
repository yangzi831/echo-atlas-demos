import type { SoundMemory } from '../types/sound';

export type RecallInterpretation = {
  headline: string;
  detail: string;
  matchedFields: string[];
};

export function interpretRecall(query: string, memories: SoundMemory[]): RecallInterpretation {
  const normalized = query.trim().toLowerCase();
  const fields = new Set<string>();
  if (/冬|winter|雪|寒冷/.test(normalized)) fields.add('冬季语义');
  if (/雨|rain/.test(normalized)) fields.add('雨声语义');
  if (/夜|night|凌晨/.test(normalized)) fields.add('夜晚语义');
  if (/地铁|subway|u-?bahn|mrt|列车/.test(normalized)) fields.add('交通声音');
  memories.slice(0, 4).forEach((memory) => {
    if (memory.location.city.toLowerCase().split(/\s+/).some((value) => normalized.includes(value) || value.includes(normalized)) || normalized.includes(memory.cityId.toLowerCase())) fields.add('地点');
    if (memory.tags.some((tag) => normalized.includes(tag.toLowerCase()) || tag.toLowerCase().includes(normalized))) fields.add('tags');
    if (memory.moods.some((mood) => normalized.includes(mood.toLowerCase()) || mood.toLowerCase().includes(normalized))) fields.add('moods');
    if (memory.note.toLowerCase().split(/\s+/).some((value) => value.length > 2 && normalized.includes(value))) fields.add('一句话');
    if (memory.aiJudgement?.criterionLabel) fields.add('共听意图');
  });
  if (memories.length === 0) {
    return { headline: `我还没有在这组声音里找到“${query}”。`, detail: '可以换一个城市、季节、tag，或者说得更接近一种声音感受。', matchedFields: [] };
  }
  const matched = fields.size > 0 ? [...fields].join('、') : '地点、时间和声音标签';
  return {
    headline: `你要的是“${query}”。`,
    detail: `我根据${matched}整理了这段声音集合。它不只是文字匹配，也保留了声音发生的时间和地点。`,
    matchedFields: [...fields],
  };
}
