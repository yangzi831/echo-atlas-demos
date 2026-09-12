import { aiSettings } from './apiSettings';
import type { SoundMemory } from '../types/sound';
export type AIResult = {title: string; summary: string; criteria: string[]; ids: string[]; shouldKeep: boolean; confidence: number; model: string};
export async function askEcho(input: {task: 'pact' | 'moment' | 'recall'; text: string; [key: string]: unknown}, signal?: AbortSignal): Promise<AIResult> {
 const response = await fetch('/api/echo-ai', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...input, credentials:aiSettings()}),signal});
 let data;
 try { data = await response.json(); } catch { throw new Error('当前站点没有可用的 AI 服务。'); }
 if (!response.ok) throw new Error(data.error || 'AI 服务暂时不可用。');
 return data;
}
export function recallMetadata(memories: SoundMemory[]) {
 return memories.filter(m=>m.aiJudgement?.reviewStatus !== 'rejected').slice(0,80).map(m=>({id:m.id,title:m.title,place:m.location.placeName,city:m.location.city,recordedAt:m.recordedAt,note:m.note.slice(0,400),reason:m.aiJudgement?.reason.slice(0,600),humanFeedback:m.aiJudgement?.humanFeedback?.slice(0,600),tags:m.tags,moods:m.moods}));
}
