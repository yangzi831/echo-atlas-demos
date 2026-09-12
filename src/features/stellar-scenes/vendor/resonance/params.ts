// Resonance Axis — tunable visual parameters.
// These genuinely affect the generative structure, not decoration.

export interface ResonanceParams {
  /** Number of concentric ring stations along the horizontal axis. */
  ringCount: number;
  /** Line/point thickness impression (point size + line opacity). */
  lineWeight: number;
  /** Overall scale of the resonance structure. */
  structureScale: number;
  /** Camera lateral drift + rotation speed multiplier. */
  flowSpeed: number;
  /** How strongly mid frequencies bend ring contours. */
  bendAmount: number;
  /** Depth spread of rings along Z-ish axis (spatial depth). */
  spaceDepth: number;
  /** Afterimage / trail persistence (fade of previous frame). */
  afterimage: number;
  /** Additive glow contrast. */
  contrast: number;
  /** Audio input sensitivity (gain on analysed bands). */
  sensitivity: number;
  /** Response smoothing (0 snappy → 1 very smooth). */
  smoothing: number;
  /** Beat / transient feedback strength. */
  beatKick: number;
  /** Autonomous macro-evolution speed when idle. */
  autoEvolve: number;
}

export const DEFAULT_PARAMS: ResonanceParams = {
  ringCount: 9,
  lineWeight: 1.1,
  structureScale: 1.0,
  flowSpeed: 1.0,
  bendAmount: 1.0,
  spaceDepth: 1.0,
  afterimage: 0.8,
  contrast: 1.15,
  sensitivity: 1.0,
  smoothing: 0.72,
  beatKick: 1.0,
  autoEvolve: 1.0,
};

export interface ParamMeta {
  key: keyof ResonanceParams;
  min: number;
  max: number;
  step: number;
}

// Ranges for the slider panel.
export const PARAM_META: ParamMeta[] = [
  { key: "ringCount", min: 3, max: 16, step: 1 },
  { key: "lineWeight", min: 0.4, max: 2.4, step: 0.05 },
  { key: "structureScale", min: 0.6, max: 1.6, step: 0.02 },
  { key: "flowSpeed", min: 0, max: 2.5, step: 0.05 },
  { key: "bendAmount", min: 0, max: 2.5, step: 0.05 },
  { key: "spaceDepth", min: 0.5, max: 2, step: 0.02 },
  { key: "afterimage", min: 0.5, max: 0.97, step: 0.005 },
  { key: "contrast", min: 0.5, max: 2, step: 0.02 },
  { key: "sensitivity", min: 0.2, max: 3, step: 0.05 },
  { key: "smoothing", min: 0, max: 0.95, step: 0.01 },
  { key: "beatKick", min: 0, max: 2.5, step: 0.05 },
  { key: "autoEvolve", min: 0, max: 2.5, step: 0.05 },
];
