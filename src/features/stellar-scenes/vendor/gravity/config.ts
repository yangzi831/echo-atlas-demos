/**
 * Stellar Synth — default engine configuration.
 *
 * Centralizes every tunable parameter and the audio→visual gain curves so the
 * host system can re-skin the engine purely through data, without editing
 * shader or simulation code.
 */
import type { EngineConfig } from "./types";

export const DEFAULT_CONFIG: EngineConfig = {
  particleCountMobile: 45000,
  particleCountDesktop: 90000,
  pointSize: 1.7,
  swirl: 0.013,
  attractor: 0.0042,
  curl: 0.5,
  coreEase: 0.35,
  pointerInfluence: 0.018,
  pointerRadius: 5.8,
  // "Gravity Core" direction: cool white particles, aqua-tinged core.
  coreColor: [0.56, 0.86, 0.78],
  particleColor: [0.82, 0.9, 0.88],
  maxPixelRatio: 2,
  audioGain: {
    amplitude: 0.85,
    bass: 0.9,
    mid: 0.3,
    high: 1.0,
    beat: 0.9,
    drone: 0.6,
  },
};

/** Merge a partial config patch onto a base config immutably. */
export function mergeConfig(
  base: EngineConfig,
  patch?: Partial<EngineConfig>,
): EngineConfig {
  if (!patch) return { ...base };
  return {
    ...base,
    ...patch,
    audioGain: { ...base.audioGain, ...(patch.audioGain ?? {}) },
  };
}
