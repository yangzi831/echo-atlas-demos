/**
 * Stellar Synth — shared engine types.
 *
 * These types define the public contract of the visual engine so it can be
 * embedded in the host "Stellar Synth" system and driven by external audio /
 * interaction data. Everything here is framework-agnostic (no React).
 */

/**
 * Normalized audio analysis frame. Every field is expected in the [0, 1] range.
 * The host system can either let the engine analyse audio itself, or push its
 * own analysis through `StellarScene.setAudioFrame(frame)`.
 */
export interface AudioFrame {
  /** Overall energy / loudness. Drives global brightness + particle speed. */
  amplitude: number;
  /** Low-frequency energy. Drives core glow, attractor strength, ring swell. */
  bass: number;
  /** Mid-frequency energy. Drives ring rotation + flow-field reorganization. */
  mid: number;
  /** High-frequency energy. Drives point size + micro flicker + star dust. */
  high: number;
  /** Beat impulse (1 on a detected beat, decays to 0). Drives pulse rings. */
  beat: number;
  /** Sustained / drone energy. Drives slow field tension accumulation. */
  drone: number;
}

/** A partial audio frame — used when injecting external data. */
export type AudioFramePatch = Partial<AudioFrame>;

/**
 * Tunable visual parameters. Every value has a sensible default in
 * `DEFAULT_CONFIG`; the host may override any subset to re-skin the engine
 * without touching internal code.
 */
export interface EngineConfig {
  /** Particle count on small (mobile) viewports. */
  particleCountMobile: number;
  /** Particle count on large (desktop) viewports. */
  particleCountDesktop: number;
  /** Base point sprite size. */
  pointSize: number;
  /** Base swirl (tangential flow) speed. */
  swirl: number;
  /** Base gravitational attractor strength toward the core. */
  attractor: number;
  /** Curl-noise turbulence amount applied to the flow field. */
  curl: number;
  /** How fast the core halo / glow reacts (0..1 easing). */
  coreEase: number;
  /** How much the pointer bends the local flow field. */
  pointerInfluence: number;
  /** Radius (world units) of the pointer's local disturbance. */
  pointerRadius: number;
  /** Core color as an RGB triplet (0..1). */
  coreColor: [number, number, number];
  /** Particle base color as an RGB triplet (0..1). */
  particleColor: [number, number, number];
  /** Clamp device pixel ratio for performance. */
  maxPixelRatio: number;
  /** How strongly each audio band maps to visuals. See AudioReactiveMapping. */
  audioGain: AudioGain;
}

/** Per-band gain multipliers used by AudioReactiveMapping. */
export interface AudioGain {
  amplitude: number;
  bass: number;
  mid: number;
  high: number;
  beat: number;
  drone: number;
}

/** Snapshot of live engine state, useful for HUD readouts. */
export interface EngineState {
  amplitude: number;
  bass: number;
  mid: number;
  high: number;
  drone: number;
  beatCount: number;
  holding: number;
  fps: number;
}

/** Audio input source the engine can attach to. */
export type AudioSourceKind = "file" | "mic" | "external" | "none";

/**
 * The stable, host-facing interface. The React layer and any external
 * "Stellar Synth" integration only depend on this — never on internals.
 */
export interface StellarSceneApi {
  /** Attach the WebGL canvas + start the render loop. */
  mount(canvas: HTMLCanvasElement): void;
  /** Stop the loop and release all GPU resources. */
  dispose(): void;
  /** Handle a viewport resize. */
  resize(width: number, height: number): void;

  // --- Interaction interface (tap / press / hold / release) -----------------
  tap(): void;
  press(): void;
  release(): void;
  /** Advance a hold accumulation by dt seconds (for programmatic control). */
  hold(dt: number): void;
  /** Set the normalized pointer position, both in [0, 1]. */
  setPointer(x: number, y: number): void;

  // --- Audio interface ------------------------------------------------------
  /** Push an externally analysed audio frame (bypasses internal analysis). */
  setAudioFrame(frame: AudioFramePatch): void;
  /** Play a local audio file and analyse it internally. Returns cleanup. */
  playFile(file: File): Promise<void>;
  /** Start microphone input and analyse it internally. */
  startMic(): Promise<void>;
  /** Stop internal audio analysis (external frames still apply). */
  stopAudio(): void;
  /** Current audio source kind. */
  getSource(): AudioSourceKind;

  // --- Config + state -------------------------------------------------------
  /** Live-patch tunable parameters. */
  setConfig(patch: Partial<EngineConfig>): void;
  /** Read a snapshot of live state (for HUD readouts). */
  getState(): EngineState;
  /** Subscribe to per-frame state updates. Returns an unsubscribe fn. */
  onState(cb: (state: EngineState) => void): () => void;
}
