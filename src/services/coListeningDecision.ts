import type { ListeningPact } from '../types/sound';

export type AudioFeatureFrame = {
  rms: number;
  peak: number;
  spectralCentroid: number;
  activityDensity: number;
  transientDensity: number;
  continuity: number;
  timestamp: number;
};

export type DecisionKind = 'baseline' | 'background' | 'quiet-shift' | 'rhythmic' | 'space-change' | 'surprise';

export type ListeningDecision = {
  kind: DecisionKind;
  shouldOfferMemory: boolean;
  reason: string;
  criterionLabel?: string;
  confidence: number;
  timestamp: number;
  source?: 'matched-intention' | 'ai-surprise' | 'human-manual';
};

export type ListeningContext = {
  elapsedMs: number;
  baseline?: AudioFeatureFrame;
  pact: ListeningPact;
  lastDecisionAt?: number;
  hasActiveCandidate: boolean;
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

function relativeChange(current: number, baseline: number) {
  return Math.abs(current - baseline) / Math.max(0.08, Math.abs(baseline));
}

function selected(pact: ListeningPact, pattern: RegExp) {
  return pact.selectedCriteria.some((criterion) => pattern.test(criterion))
    || pattern.test(pact.freeformIntention ?? '');
}

export function createListeningPact(criteria: string[], freeformIntention: string, avoid = ''): ListeningPact {
  return {
    id: `pact-${Date.now()}`,
    selectedCriteria: criteria,
    freeformIntention: freeformIntention.trim() || undefined,
    avoid: avoid.trim() || undefined,
    createdAt: new Date().toISOString(),
  };
}

export class CoListeningDecisionEngine {
  private baseline?: AudioFeatureFrame;
  private previous?: AudioFeatureFrame;
  private activeFrames = 0;

  reset() {
    this.baseline = undefined;
    this.previous = undefined;
    this.activeFrames = 0;
  }

  getBaseline() {
    return this.baseline;
  }

  observe(frame: AudioFeatureFrame, context: ListeningContext): ListeningDecision {
    const previous = this.previous;
    this.previous = frame;
    if (frame.rms > 0.025 || frame.activityDensity > 0.08) this.activeFrames += 1;

    if (!this.baseline) {
      this.baseline = { ...frame };
      return {
        kind: 'baseline',
        shouldOfferMemory: false,
        reason: '正在建立环境基线……',
        confidence: 0.2,
        timestamp: frame.timestamp,
      };
    }

    if (context.elapsedMs < 3000) {
      this.baseline = {...frame, rms: this.baseline.rms * .9 + frame.rms * .1};
      return {kind: 'baseline', shouldOfferMemory: false, reason: '先听三秒，建立这一刻的声音基线。', confidence: .2, timestamp: frame.timestamp};
    }
    const baseline = this.baseline;
    const quietShift = this.activeFrames > 8
      && frame.rms < Math.max(0.018, baseline.rms * 0.48)
      && frame.continuity < Math.max(0.35, baseline.continuity * 0.76);
    const rhythmic = frame.transientDensity > Math.max(0.18, baseline.transientDensity + 0.08)
      || (previous ? frame.peak > 0.35 && frame.rms - previous.rms > 0.045 : false);
    const spectralChange = relativeChange(frame.spectralCentroid, baseline.spectralCentroid) > 0.42;
    const loudnessChange = relativeChange(frame.rms, baseline.rms) > 0.62;
    const continuityChange = relativeChange(frame.continuity, baseline.continuity) > 0.4;
    const spaceChange = spectralChange && (loudnessChange || continuityChange);
    const surprise = [spectralChange, loudnessChange, continuityChange, frame.peak > 0.72].filter(Boolean).length >= 3;
    const cooldownActive = context.lastDecisionAt !== undefined
      && frame.timestamp - context.lastDecisionAt < 10000;

    if (surprise && !cooldownActive && !context.hasActiveCandidate) {
      return this.decision(frame, 'surprise', '捕捉到多个声音特征同时变化，可能有一个意外正在发生。', '任何我可能错过的意外', 0.78, context.pact);
    }
    if (quietShift && !cooldownActive && !context.hasActiveCandidate && selected(context.pact, /安静|空旷|quiet|space/i)) {
      return this.decision(frame, 'quiet-shift', '响度明显下降，持续的声音变得更弱。', '突然安静的时刻', 0.82, context.pact);
    }
    if (rhythmic && !cooldownActive && !context.hasActiveCandidate && selected(context.pact, /节奏|重复|rhythm|beat|低频/i)) {
      return this.decision(frame, 'rhythmic', '出现突出的瞬态或能量起伏，可能有节奏变化。', '有节奏感的声音', 0.72, context.pact);
    }
    if (spaceChange && !cooldownActive && !context.hasActiveCandidate && selected(context.pact, /空间|靠近|离开|变化|升高|降低|变亮|变闷|space|near/i)) {
      return this.decision(frame, 'space-change', '响度、频谱和连续性一起改变，值得回听这一段。', '空间发生变化', 0.68, context.pact);
    }

    this.baseline = {...frame, rms: baseline.rms*.98+frame.rms*.02, spectralCentroid: baseline.spectralCentroid*.98+frame.spectralCentroid*.02, continuity: baseline.continuity*.98+frame.continuity*.02};
    return {
      kind: 'background',
      shouldOfferMemory: false,
      reason: this.activeFrames < 10 ? '正在建立环境基线……' : '持续的背景声，没有保存。',
      confidence: 0.4,
      timestamp: frame.timestamp,
    };
  }

  private decision(
    frame: AudioFeatureFrame,
    kind: Exclude<DecisionKind, 'baseline' | 'background'>,
    reason: string,
    criterionLabel: string,
    confidence: number,
    pact: ListeningPact,
  ): ListeningDecision {
    const avoid = pact.avoid?.toLowerCase() ?? '';
    if (avoid && (avoid.includes(criterionLabel.toLowerCase()) || avoid.includes('谈话') && kind === 'rhythmic')) {
      return {
        kind: 'background',
        shouldOfferMemory: false,
        reason: '检测到变化，但它符合你希望忽略的内容。',
        confidence: 0.32,
        timestamp: frame.timestamp,
      };
    }
    return { kind, shouldOfferMemory: true, reason, criterionLabel, confidence: clamp01(confidence), timestamp: frame.timestamp, source: kind === 'surprise' ? 'ai-surprise' : 'matched-intention' };
  }
}
