import type { MemoryExtractionContext, SoundMemory, SoundUnderstanding } from './types';

function rhythmLabel(value: number) {
  if (value >= 0.68) return '明显脉冲';
  if (value >= 0.38) return '缓慢起伏';
  return '连续平稳';
}

function defaultTitle(understanding: SoundUnderstanding, context: MemoryExtractionContext) {
  const city = context.location?.city;
  const date = new Date(context.recordedAt ?? Date.now());
  const hour = date.getHours();
  const timeLabel = hour < 6 ? '凌晨' : hour < 12 ? '清晨' : hour < 18 ? '傍晚' : '夜晚';
  if (city) return `${city}${timeLabel}的城市呼吸`;
  return understanding.tags[0] ? `${understanding.tags[0]}里的声音记忆` : '此刻的声音记忆';
}

/** Convert model output plus capture context into the hearing-layer memory shape. */
export function extractSoundMemory(
  understanding: SoundUnderstanding,
  context: MemoryExtractionContext,
): SoundMemory {
  const description = context.description?.trim() || `${understanding.semanticDescription}。声音在这一刻留下了可被再次召回的质地。`;
  return {
    id: context.id ?? `hearing-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    audio: context.audio,
    location: context.location,
    recordedAt: context.recordedAt ?? new Date().toISOString(),
    title: context.title?.trim() || defaultTitle(understanding, context),
    description,
    soundFeatures: {
      texture: understanding.acousticFeatures.texture,
      energy: understanding.acousticFeatures.energy,
      rhythm: rhythmLabel(understanding.acousticFeatures.rhythm),
    },
    semanticTags: [...new Set([...understanding.tags, ...understanding.detectedEvents])],
    mood: [...new Set(understanding.mood)],
    aiReflection: context.aiReflection ?? `我听见了${understanding.semanticDescription}，并会记住它的${understanding.acousticFeatures.texture}质地。`,
  };
}

