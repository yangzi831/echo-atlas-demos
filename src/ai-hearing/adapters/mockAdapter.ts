import { analyzeAudioBlob, toSoundUnderstanding } from '../audioAnalyzer';
import type { SoundUnderstanding, SoundUnderstandingAdapter } from '../types';

function fileHint(audio: Blob) {
  return typeof File !== 'undefined' && audio instanceof File ? audio.name.toLowerCase() : '';
}

/** Deterministic local adapter for demos and development. */
export class MockSoundUnderstandingAdapter implements SoundUnderstandingAdapter {
  async analyze(audio: Blob): Promise<SoundUnderstanding> {
    let analysis;
    try {
      analysis = await analyzeAudioBlob(audio);
    } catch {
      // Some embedded browsers cannot decode every uploaded codec. Keep the
      // mock adapter useful for the product flow with stable fallback values;
      // a real model adapter can replace this without changing the contract.
      analysis = {
        duration: 1,
        amplitude: 0.64,
        energy: 0.32,
        rhythm: 0.52,
        frequencyProfile: [0.32, 0.46, 0.7, 0.58, 0.38, 0.24, 0.18, 0.12],
        texture: 'soft / continuous',
        energyChanges: [0.04, -0.02, 0.03],
      };
    }
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
      detectedEvents: isCity
        ? ['人声', '车辆', '风', '环境回响']
        : analysis.rhythm > 0.6 ? ['repeating acoustic changes'] : [],
      tags: [...new Set(tags)],
    };
  }
}

export const mockAdapter = new MockSoundUnderstandingAdapter();
