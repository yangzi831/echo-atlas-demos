import { analyzeAudioBlob, toSoundUnderstanding } from '../audioAnalyzer';
import type { SoundUnderstanding, SoundUnderstandingAdapter } from '../types';

function fileHint(audio: Blob) {
  return typeof File !== 'undefined' && audio instanceof File ? audio.name.toLowerCase() : '';
}

/** Deterministic local adapter for demos and development. */
export class MockSoundUnderstandingAdapter implements SoundUnderstandingAdapter {
  async analyze(audio: Blob): Promise<SoundUnderstanding> {
    const analysis = await analyzeAudioBlob(audio);
    const hint = fileHint(audio);
    const isRain = /rain|雨|storm|drip/.test(hint);
    const isCity = /city|street|urban|上海|街|metro|station/.test(hint);
    const isNight = /night|晚|凌晨|midnight/.test(hint);
    const semanticDescription = isRain && isCity
      ? '夜晚城市雨水落在玻璃与街道上的声音'
      : isRain
        ? '雨滴连续落下，形成柔和而有层次的环境声'
        : isCity
          ? '城市街道中人流、车辆与建筑回响交织的环境声'
          : '一段由浏览器本地分析的环境声音，等待更强的语义模型理解';
    const mood = [analysis.energy < 0.35 ? 'calm' : 'vivid'];
    if (isNight) mood.push('nostalgic');
    if (isCity) mood.push('urban');
    const tags = [
      ...(isRain ? ['rain'] : []),
      ...(isCity ? ['city', 'street'] : []),
      ...(isNight ? ['night'] : []),
      ...(analysis.rhythm > 0.6 ? ['rhythmic'] : ['ambient']),
    ];
    return {
      ...toSoundUnderstanding(analysis),
      semanticDescription,
      mood: [...new Set(mood)],
      detectedEvents: analysis.rhythm > 0.6 ? ['repeating acoustic changes'] : [],
      tags: [...new Set(tags)],
    };
  }
}

export const mockAdapter = new MockSoundUnderstandingAdapter();
