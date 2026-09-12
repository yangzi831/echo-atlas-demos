/**
 * Stellar Synth — audio-reactive mapping.
 *
 * The single, replaceable place where a normalized {@link AudioFrame} plus the
 * interaction state are translated into concrete visual drive values. Keeping
 * this isolated means the host can swap mapping curves without touching the
 * simulation or shaders, and every "how does sound affect the visual" decision
 * lives in ONE file.
 *
 *   amplitude / overall energy -> global brightness + particle speed
 *   bass                       -> core glow, attractor pull, ring swell
 *   mid                        -> ring rotation + flow-field reorganization
 *   high                       -> point size + micro flicker + star dust
 *   beat                       -> pulse ring impulse
 *   drone                      -> sustained field tension
 */
import type { AudioFrame, AudioGain } from "./types";

/** Concrete per-frame drive values consumed by the ParticleSystem/Scene. */
export interface VisualDrive {
  /** Multiplier on point brightness. */
  brightness: number;
  /** Core glow intensity 0..~2. */
  core: number;
  /** Tangential swirl speed added on top of the base value. */
  swirlBoost: number;
  /** Attractor strength added on top of the base value. */
  attractorBoost: number;
  /** Ring rotation speed. */
  ringSpin: number;
  /** Ring radial scale factor around 1.0. */
  ringScale: number;
  /** High-frequency drive for point size + flicker. */
  high: number;
  /** Sustained tension 0..1 accumulated from drone + hold. */
  tension: number;
}

export function mapAudioToVisual(
  frame: AudioFrame,
  gain: AudioGain,
  pulse: number,
  hold: number,
): VisualDrive {
  const amp = frame.amplitude * gain.amplitude;
  const bass = frame.bass * gain.bass;
  const mid = frame.mid * gain.mid;
  const high = frame.high * gain.high;
  const drone = frame.drone * gain.drone;

  return {
    brightness: 1 + amp + pulse * 0.6 + hold * 0.7,
    core: 0.38 + bass + pulse * 0.9 + hold * 0.7,
    swirlBoost: amp * 0.018 + hold * 0.026,
    // Attractor pull follows bass only. Tap/hold intentionally do NOT increase
    // inward pull, so the field keeps its wide, open range during interaction
    // instead of contracting toward the core.
    attractorBoost: bass * 0.012,
    ringSpin: 0.12 + mid + hold * 0.35,
    ringScale: 1 + frame.bass * 0.045 + pulse * 0.09 + hold * 0.07,
    high: frame.high,
    tension: Math.min(1, drone + hold * 0.5),
  };
}
