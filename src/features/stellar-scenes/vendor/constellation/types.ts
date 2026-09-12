/**
 * Stellar Synth · Visual Engine — shared types & contracts
 *
 * These are the public integration contracts that the host "星宿合成器 /
 * Stellar Synth" synthesizer talks to. Everything a host needs to drive the
 * scene flows through `AudioFrame` (audio → visual) and `InteractionEvent`
 * (tap / press / hold / release → visual), plus `EngineParams` for
 * code-level parameter control.
 */

/**
 * Normalized audio-analysis frame. The host pushes one of these per animation
 * frame (or as often as its analyzer produces data) via `engine.pushAudio()`.
 * Every field is normalized to `0..1`. The built-in demo audio source
 * (microphone / uploaded track) produces exactly the same shape, so the
 * external and internal audio paths are interchangeable.
 */
export interface AudioFrame {
  /** Overall energy → global brightness, particle activity, glow, field energy. */
  amplitude: number;
  /** Low frequency → large-scale pulses, core inflation, vortex pull, gravity. */
  bass: number;
  /** Mid frequency → mid-layer structure, particle grouping, line reorganization. */
  mid: number;
  /** High frequency → fine twinkle, star-dust sparkle, edge disturbance. */
  high: number;
  /** Beat / transient pulse → ring diffusion, flashes, local activation. */
  beat: number;
  /** Sustained tone / drone → slow growth, continuous rotation, tension buildup. */
  drone: number;
}

export const EMPTY_AUDIO_FRAME: AudioFrame = {
  amplitude: 0,
  bass: 0,
  mid: 0,
  high: 0,
  beat: 0,
  drone: 0,
};

/** Interaction inputs the host (or the built-in pointer layer) can dispatch. */
export type InteractionType = "tap" | "press" | "hold" | "release";

export interface InteractionEvent {
  type: InteractionType;
  /**
   * Optional normalized position of the interaction in the range `-1..1`
   * (x right-positive, y up-positive), matching WebGL clip space. When
   * omitted the engine uses the current pointer / center.
   */
  x?: number;
  y?: number;
  /** Optional intensity `0..1`; defaults to 1. */
  strength?: number;
}

/**
 * Runtime-tunable parameters. All optional so a host can patch a subset via
 * `engine.setParams({ ... })`. Values are read live every frame.
 */
export interface EngineParams {
  /** Master particle count target (applied on (re)build). */
  particleCount: number;
  /** Number of constellation star nodes. */
  nodeCount: number;
  /** Base ambient rotation speed of the whole field. */
  rotationSpeed: number;
  /** How strongly audio drives visuals overall (0 = ignore audio, 1 = full). */
  audioReactivity: number;
  /** How strongly the pointer creates parallax + local gravity. */
  pointerInfluence: number;
  /** Constellation line opacity range [min, max]. */
  lineOpacity: [number, number];
  /** Whether ambient self-motion runs when no audio is present. */
  ambientMotion: boolean;
  /** Bloom / glow intensity multiplier. */
  glowStrength: number;
  /** Per-channel palette (hex). */
  palette: {
    background: string;
    star: string;
    line: string;
  };
}

export const DEFAULT_PARAMS: EngineParams = {
  particleCount: 85000,
  nodeCount: 30,
  rotationSpeed: 0.008,
  audioReactivity: 1,
  pointerInfluence: 1,
  lineOpacity: [0.06, 0.34],
  ambientMotion: true,
  glowStrength: 1,
  palette: {
    background: "#05060c",
    star: "#e8d8c0",
    line: "#b89a6e",
  },
};

/** Options accepted when constructing the engine. */
export interface EngineOptions {
  /** Partial parameter overrides merged over `DEFAULT_PARAMS`. */
  params?: Partial<EngineParams>;
  /** Cap device pixel ratio (default 2). */
  maxPixelRatio?: number;
  /** Respect `prefers-reduced-motion` (default true). */
  respectReducedMotion?: boolean;
  /**
   * When true the engine attaches its own pointer listeners to the mount
   * element and translates them into interaction events. Set false to let the
   * host drive interactions purely through `dispatch()`. Default true.
   */
  attachPointerListeners?: boolean;
}
